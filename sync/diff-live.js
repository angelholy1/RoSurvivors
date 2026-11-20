#!/usr/bin/env node
/**
 * RO Survivors 線上實碼精簡 Diff 與快照引擎
 *
 * 用法：
 *   node sync/diff-live.js                      抓線上實碼 → 對比 baseline.json → 寫出 sync/last-diff.md
 *   node sync/diff-live.js --update-baseline    同步完成後將最新實碼寫入 sync/baseline.json
 *   node sync/diff-live.js --cache-dir <dir>    使用本地快取的 index.html / main.js / soul_linker.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const SYNC_DIR = __dirname;
const ROOT = path.resolve(SYNC_DIR, "..");
const BASELINE_PATH = path.join(SYNC_DIR, "baseline.json");
const DIFF_MD_PATH = path.join(SYNC_DIR, "last-diff.md");
const LIVE_ORIGIN = "https://ro-survivors.com";

const args = process.argv.slice(2);
const FLAG_UPDATE_BASE = args.includes("--update-baseline");
const cacheIdx = args.indexOf("--cache-dir");
const CACHE_DIR = cacheIdx !== -1 ? args[cacheIdx + 1] : null;

const T1_FAMILIES = ["swordsman", "mage", "archer", "acolyte", "thief", "merchant", "taekwon", "ninja", "gunslinger"];

function shortHash(str) {
  return crypto.createHash("sha1").update(String(str || "")).digest("hex").slice(0, 10);
}

function extractBalanced(src, openIdx, openCh, closeCh) {
  let depth = 0;
  let inStr = null;
  let esc = false;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return null;
}

async function fetchLiveBundles() {
  if (CACHE_DIR) {
    const manPath = path.join(CACHE_DIR, "manifest.json");
    return {
      indexHtml: fs.readFileSync(path.join(CACHE_DIR, "index.html"), "utf8"),
      mainJs: fs.readFileSync(path.join(CACHE_DIR, "main.js"), "utf8"),
      slJs: fs.readFileSync(path.join(CACHE_DIR, "soul_linker.js"), "utf8"),
      manifest: fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, "utf8")) : null,
      source: `cache:${CACHE_DIR}`
    };
  }
  const resIdx = await fetch(`${LIVE_ORIGIN}/`);
  if (!resIdx.ok) throw new Error(`GET ${LIVE_ORIGIN}/ HTTP ${resIdx.status}`);
  const indexHtml = await resIdx.text();
  const mainM = indexHtml.match(/src=["'](?:\.?\/)?(build\/main-[^"']+\.js)["']/);
  if (!mainM) throw new Error("無法解析首頁 build/main-*.js");
  const mainUrl = `${LIVE_ORIGIN}/${mainM[1].replace(/^\.?\/?/, "")}`;
  const resMain = await fetch(mainUrl);
  if (!resMain.ok) throw new Error(`GET ${mainUrl} HTTP ${resMain.status}`);
  const mainJs = await resMain.text();

  const slM = mainJs.match(/soul_linker-[A-Za-z0-9_-]+\.js/);
  if (!slM) throw new Error("無法解析 soul_linker-*.js");
  const slUrl = `${LIVE_ORIGIN}/build/${slM[0]}`;
  const resSl = await fetch(slUrl);
  if (!resSl.ok) throw new Error(`GET ${slUrl} HTTP ${resSl.status}`);
  const slJs = await resSl.text();

  const manUrl = `${LIVE_ORIGIN}/assets/manifest.json`;
  const resMan = await fetch(manUrl);
  if (!resMan.ok) throw new Error(`GET ${manUrl} HTTP ${resMan.status}`);
  const manifest = await resMan.json();

  return { indexHtml, mainJs, slJs, manifest, source: `${mainUrl} + ${slUrl} + ${manUrl}` };
}

function splitTopArgs(callStr) {
  const inner = callStr.slice(1, -1);
  const args = [];
  let depth = 0, inStr = null, esc = false, start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      args.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(inner.slice(start).trim());
  return args;
}

function extractObjByVar(src, varName) {
  if (!varName) return {};
  const esc = varName.replace(/\$/g, "\\$");
  const re = new RegExp(`(?:^|[,;\\s])${esc}=\\{`);
  const dm = re.exec(src);
  if (!dm) return {};
  const openPos = src.indexOf("{", dm.index);
  const objStr = extractBalanced(src, openPos, "{", "}");
  if (!objStr) return {};
  try {
    return vm.runInNewContext(`(${objStr})`);
  } catch {
    return {};
  }
}

function buildLiveZhTranslators(slJs) {
  // 1. Item / Card / Affix zh-TW dict (currently F5): lang==="zh-TW"?<var>[
  const itemVarM = slJs.match(/lang==="zh-TW"\?([A-Za-z0-9_$]+)\[/);
  const itemDict = extractObjByVar(slJs, itemVarM ? itemVarM[1] : null);

  // 2. UI / Skill / Talent / Stage / Monster dicts: qA={es:null,en:<Zi>,"zh-TW":<II>,...} & VI=Fp(<LA>)
  const qaM = slJs.match(/qA=\{es:null,en:([A-Za-z0-9_$]+),"zh-TW":([A-Za-z0-9_$]+),/);
  const enDict = extractObjByVar(slJs, qaM ? qaM[1] : null);
  const uiDict = extractObjByVar(slJs, qaM ? qaM[2] : null);
  const viM = slJs.match(/e==="zh-TW"\?([A-Za-z0-9_$]+)\(/);
  const laM = viM ? slJs.match(new RegExp(`\\b${viM[1].replace(/\$/g, "\\$")}=Fp\\(([A-Za-z0-9_$]+)\\)`)) : null;
  const termDict = extractObjByVar(slJs, laM ? laM[1] : null);

  const termKeys = Object.keys(termDict).sort((a, b) => b.length - a.length);
  const termRe = termKeys.length
    ? new RegExp(`(?<![\\p{L}'])(${termKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}'+]| \\p{Lu})`, "gu")
    : null;
  const applyTerms = s => (termRe ? String(s).replace(termRe, m => termDict[m] ?? m) : String(s));

  const trItem = enName => itemDict[enName] ?? enName;
  const trUi = raw => uiDict[raw] ?? applyTerms(enDict[raw] ?? raw);
  return { itemDict, enDict, uiDict, termDict, trItem, trUi };
}

function resolveTalentRawName(slJs, specExpr, depth = 0) {
  if (!specExpr || depth > 4) return null;
  const quoted = specExpr.match(/"([^"]+)"/);
  if (quoted) return quoted[1];
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(specExpr)) {
    const esc = specExpr.replace(/\$/g, "\\$");
    const re = new RegExp(`(?:^|[,;\\s])${esc}=`);
    const m = re.exec(slJs);
    if (!m) return null;
    const rhs = slJs.slice(m.index + m[0].length, m.index + m[0].length + 220);
    const nameProp = rhs.match(/^\{[^}]*name:"([^"]+)"/);
    if (nameProp) return nameProp[1];
    const spreadM = rhs.match(/^\{\.\.\.([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (spreadM) return resolveTalentRawName(slJs, spreadM[1], depth + 1);
    const fnQuoted = rhs.match(/"([^"]+)"/);
    if (fnQuoted) return fnQuoted[1];
  }
  return null;
}

function buildLiveSnapshot(mainJs, slJs, manifest, source) {
  const snap = {
    source,
    version: null,
    buildHash: null,
    buildTime: null,
    latestPatchNotesZh: "",
    gear: {},          // id -> { slot, tier, wtype, jobs, rare, season }
    itemNamesZh: {},   // id -> { nameEn, nameZh }
    cardNamesZh: {},   // id -> { nameEn, nameZh }
    monsterNamesZh: {},// mobId -> { raw, nameZh }
    stageNamesZh: {},  // stageId -> { raw, nameZh, placeZh }
    jobNamesZh: {},    // jobId -> { raw, nameZh, nameFZh }
    skillNamesZh: {},  // skillId -> { raw, nameZh }
    talentNamesZh: { branches: {}, nodes: {} },
    petNamesZh: {},    // petId -> { nameZh, eggId, eggZh, accId, accZh }
    cards: {},         // id -> { mob, slot }
    pets: {},          // id -> { eggId, from, secret }
    dropsM2: {},       // mobId -> [{ id, rate }]
    stages: {},        // stageId -> { runLength, rareId, rareChance, charExp, jobExp }
    vP: {},            // skillId -> tags[]
    vPAnomalies: [],
    t1TreeHashes: {},  // family -> { count, hash }
    skillHashes: {},   // skillId -> hash
    t2Status: {
      secondJobTalentsHint: "檢查中",
      hasDualWieldUnlock: false,
      activeSkillSlotLimit: 4
    }
  };

  // 1. Version & Build hash
  const bm = mainJs.match(/Build\s+([0-9a-f]{7,12})\s+(\d{4}-\d{2}-\d{2}T[0-9:.]+Z)/);
  if (bm) { snap.buildHash = bm[1]; snap.buildTime = bm[2]; }
  const vmM = mainJs.match(/\n##\s+(Beta\s+\d+\.\d+\.\d+)\s+[—-]/);
  if (vmM) snap.version = vmM[1];

  const zhRe = /\n##\s+(Beta\s+\d+\.\d+\.\d+)\s+—\s+\d{4}\s*年/;
  const zhM = zhRe.exec(mainJs);
  if (zhM) {
    const start = zhM.index + 1;
    const secondNext = mainJs.indexOf("\n## Beta ", mainJs.indexOf("\n## Beta ", start + 10) + 10);
    snap.latestPatchNotesZh = mainJs.slice(start, secondNext !== -1 ? Math.min(secondNext, start + 2600) : start + 1600).trim();
  }

  // 1b. Official zh-TW names from live runtime localization (manifest + F5 + II + Zi + LA)
  const { trItem, trUi } = buildLiveZhTranslators(slJs);
  if (manifest && manifest.items) {
    for (const [id, info] of Object.entries(manifest.items)) {
      if (!info || !info.name) continue;
      snap.itemNamesZh[id] = {
        nameEn: info.name,
        nameZh: trItem(info.name)
      };
    }
  }
  if (manifest && manifest.cards) {
    for (const [id, info] of Object.entries(manifest.cards)) {
      if (!info || !info.name) continue;
      snap.cardNamesZh[id] = {
        nameEn: info.name,
        nameZh: trItem(info.name)
      };
    }
  }

  // Monsters (ue({id, name, ...}))
  let m;
  const ueRe = /\bue\(\{id:"([^"]+)",name:"([^"]+)"/g;
  while ((m = ueRe.exec(slJs)) !== null) {
    snap.monsterNamesZh[m[1]] = { raw: m[2], nameZh: trUi(m[2]) };
  }

  // Stages (Pe array in mainJs + Endless Tower)
  const peIdx = mainJs.indexOf('id:"prontera",name:');
  if (peIdx !== -1) {
    let arrStart = peIdx;
    while (arrStart > 0 && mainJs[arrStart] !== "[") arrStart--;
    const peStr = extractBalanced(mainJs, arrStart, "[", "]") || "";
    const stRe = /\{id:"([^"]+)",name:"([^"]+)",place:"([^"]+)"/g;
    while ((m = stRe.exec(peStr)) !== null) {
      snap.stageNamesZh[m[1]] = { raw: m[2], nameZh: trUi(m[2]), placeZh: trUi(m[3]) };
    }
  }
  snap.stageNamesZh.endless = { raw: "Endless Tower", nameZh: trUi("Endless Tower"), placeZh: trUi("Endless Tower") };

  // Jobs (all 1st & 2nd jobs via live trUi / LA)
  const JOB_RAW = {
    novice: ["Novice"], swordsman: ["Swordsman"], mage: ["Mage"], archer: ["Archer"],
    acolyte: ["Acolyte"], thief: ["Thief"], merchant: ["Merchant"], taekwon: ["Taekwon"],
    ninja: ["Ninja"], gunslinger: ["Gunslinger"], knight: ["Knight"], crusader: ["Crusader"],
    wizard: ["Wizard"], sage: ["Sage"], hunter: ["Hunter"], bard: ["Bard", "Dancer"],
    priest: ["Priest"], monk: ["Monk"], assassin: ["Assassin"], rogue: ["Rogue"],
    blacksmith: ["Blacksmith"], alchemist: ["Alchemist"],
    star_gladiator: ["Star Gladiator"], soul_linker: ["Soul Linker"]
  };
  for (const [jid, [raw, rawF]] of Object.entries(JOB_RAW)) {
    snap.jobNamesZh[jid] = {
      raw,
      nameZh: trUi(raw),
      nameFZh: rawF ? trUi(rawF) : null
    };
  }

  // 2. Cards (w2 via ye())
  const yeRe = /ye\((\d+),"([^"]+)","([^"]+)"/g;
  while ((m = yeRe.exec(slJs)) !== null) {
    snap.cards[Number(m[1])] = { mob: m[2], slot: m[3] };
  }

  // 3. Gear (No via Z/Pr + S2 rules)
  const ynIdx = slJs.indexOf("YN={");
  let YN = {}, XN = {};
  if (ynIdx !== -1) {
    try {
      YN = vm.runInNewContext(`(${extractBalanced(slJs, ynIdx + 3, "{", "}")})`);
      const xnIdx = slJs.indexOf("XN={", ynIdx);
      if (xnIdx !== -1) XN = vm.runInNewContext(`(${extractBalanced(slJs, xnIdx + 3, "{", "}")})`);
    } catch {}
  }
  const baseToSec = {
    swordsman: ["knight", "crusader"], mage: ["wizard", "sage"], archer: ["hunter", "bard"],
    acolyte: ["priest", "monk"], thief: ["assassin", "rogue"], merchant: ["blacksmith", "alchemist"],
    taekwon: ["star_gladiator", "soul_linker"]
  };
  const computeJobs = (jobs, wtype) => {
    if (!jobs) return null;
    const s = new Set(jobs);
    for (const j of jobs) for (const sec of (baseToSec[j] || [])) s.add(sec);
    for (const addJ of (YN[wtype || ""] || [])) s.add(addJ);
    for (const delJ of (XN[wtype || ""] || [])) s.delete(delJ);
    return [...s].sort();
  };
  const itemRe = /(?:Z|Pr)\((\d+),"([^"]+)",(\d+),/g;
  while ((m = itemRe.exec(slJs)) !== null) {
    const id = Number(m[1]);
    const body = extractBalanced(slJs, m.index + (slJs[m.index] === "P" ? 2 : 1), "(", ")") || "";
    const jm = body.match(/jobs:\[([^\]]+)\]/);
    const wm = body.match(/wtype:"([^"]+)"/);
    const jobs = jm ? computeJobs(jm[1].split(",").map(s => s.trim().replace(/"/g, "")).filter(Boolean), wm ? wm[1] : null) : null;
    snap.gear[id] = {
      slot: m[2],
      tier: Number(m[3]),
      wtype: wm ? wm[1] : null,
      jobs,
      rare: /rare:!0/.test(body),
      season: (body.match(/season:"([^"]+)"/) || [])[1] || null
    };
  }

  // 4. Pets (<fn>("poring",9001,...) in main.js) + official zh-TW pet/egg/accessory names
  const petFnM = mainJs.match(/([A-Za-z_$][A-Za-z0-9_$]*)\("poring",9001,/);
  if (petFnM) {
    const petFn = petFnM[1].replace(/\$/g, "\\$");
    const block = mainJs.slice(petFnM.index, petFnM.index + 3200);
    const ktRe = new RegExp(`(?:^|[,;\\s])${petFn}\\("([^"]+)",(\\d+),([^,]+),\\[([^\\]]+)\\](?:,([^,)]+))?(?:,(\\{[^}]+\\}))?\\)`, "g");
    while ((m = ktRe.exec(block)) !== null) {
      const petId = m[1];
      const eggId = Number(m[2]);
      const accId = /^\d+$/.test(m[3].trim()) ? Number(m[3].trim()) : null;
      snap.pets[petId] = {
        eggId,
        accId,
        from: m[5] && m[5] !== "void 0" ? m[5].replace(/"/g, "") : null,
        secret: Boolean(m[6] && m[6].includes("secret:!0")),
        bonusSig: m[4]
      };
      const mobInfo = snap.monsterNamesZh[petId];
      snap.petNamesZh[petId] = {
        nameZh: mobInfo ? mobInfo.nameZh : trUi(petId),
        eggId,
        eggZh: snap.itemNamesZh[String(eggId)] ? snap.itemNamesZh[String(eggId)].nameZh : null,
        accId,
        accZh: accId && snap.itemNamesZh[String(accId)] ? snap.itemNamesZh[String(accId)].nameZh : null
      };
    }
  }

  // 5. Drops M2
  const m2Idx = slJs.indexOf("M2={poring:");
  if (m2Idx !== -1) {
    const objStr = extractBalanced(slJs, m2Idx + 3, "{", "}");
    if (objStr) snap.dropsM2 = vm.runInNewContext(`(${objStr})`);
  }

  // 6. Stages X9 key params
  const stageIds = ["prontera", "prt_sewer", "sunken", "byalan", "payon", "payon_cave", "geffen", "louyang", "prt_castle", "endless", "orc_village", "pyramid"];
  for (const sid of stageIds) {
    const idx = slJs.indexOf(`${sid}:{map:`);
    if (idx === -1) continue;
    const obj = extractBalanced(slJs, idx + sid.length + 1, "{", "}");
    if (!obj) continue;
    const rl = obj.match(/runLength:([0-9e.]+)/);
    const rc = obj.match(/rare:\{id:"([^"]+)",t:(\d+),chance:([0-9.]+)\}/);
    const ce = obj.match(/charExp:([0-9.]+)/);
    const je = obj.match(/jobExp:([0-9.]+)/);
    const bh = obj.match(/bossHp:\{([^}]+)\}/);
    snap.stages[sid] = {
      runLength: rl ? Number(rl[1]) : null,
      rareId: rc ? rc[1] : null,
      rareChance: rc ? Number(rc[3]) : null,
      charExp: ce ? Number(ce[1]) : null,
      jobExp: je ? Number(je[1]) : null,
      bossHpHash: bh ? shortHash(bh[1]) : null
    };
  }

  // 7. vP skill tags & anomalies
  const vpIdx = slJs.indexOf("vP={");
  if (vpIdx !== -1) {
    const vpStr = extractBalanced(slJs, vpIdx + 3, "{", "}");
    if (vpStr) {
      snap.vP = vm.runInNewContext(`(${vpStr})`);
      for (const [sid, tags] of Object.entries(snap.vP)) {
        if (tags.includes("physical") && tags.includes("aura") && !tags.includes("melee") && !["spread_attack", "desperado"].includes(sid)) {
          snap.vPAnomalies.push(`${sid}: ${JSON.stringify(tags)}`);
        }
      }
    }
  }

  // 8. T1 Talent Tree Hashes & Official zh-TW Branch/Node Names
  for (const fam of T1_FAMILIES) {
    const needle = `Qn("${fam}",`;
    const idx = slJs.indexOf(needle);
    if (idx !== -1) {
      const body = extractBalanced(slJs, idx + 2, "(", ")") || "";
      const nodes = body.match(/\bE\(\d+,\d+,"[^"]+"/g) || [];
      snap.t1TreeHashes[fam] = { count: nodes.length, hash: shortHash(body) };

      const brRe = /\{name:"([^"]+)",icon:"[^"]+",desc:"[^"]+",talents:\[/g;
      const brNames = [];
      let bm, bi = 0;
      while ((bm = brRe.exec(body)) !== null) {
        brNames.push(trUi(bm[1]));
        const arrStr = extractBalanced(body, bm.index + bm[0].length - 1, "[", "]") || "";
        const eRe = /\bE\(/g;
        let em;
        while ((em = eRe.exec(arrStr)) !== null) {
          const callStr = extractBalanced(arrStr, em.index + 1, "(", ")") || "";
          const callArgs = splitTopArgs(callStr);
          const shortId = (callArgs[2] || "").replace(/^"|"$/g, "");
          const rawName = resolveTalentRawName(slJs, callArgs[3] || "");
          if (shortId && rawName) {
            snap.talentNamesZh.nodes[`${fam}.${bi}.${shortId}`] = { raw: rawName, nameZh: trUi(rawName) };
          }
        }
        bi++;
      }
      snap.talentNamesZh.branches[fam] = brNames;
    }
  }

  // 9. Active Skill Ke(...) Hashes & Official zh-TW Names
  const keRe = /\bKe\("([^"]+)","([^"]+)"/g;
  while ((m = keRe.exec(slJs)) !== null) {
    const body = extractBalanced(slJs, m.index + 2, "(", ")") || "";
    snap.skillHashes[m[1]] = shortHash(body);
    snap.skillNamesZh[m[1]] = { raw: m[2], nameZh: trUi(m[2]) };
  }

  // 10. T2 Unlock Radar (prevent premature T2 build recommendations!)
  // Check if live code still restricts in-run skills / dual-wield / T2 talents
  const hasT2SkillCall = /\bKe\("(bowling_bash|storm_gust|meteor_storm|lord_of_vermilion|asura_strike|sonic_blow|acid_bomb)"/.test(slJs);
  snap.t2Status = {
    t2ActiveSkillsImplemented: hasT2SkillCall,
    summary: hasT2SkillCall
      ? "偵測到二轉主動技定義！請立即檢查是否開放二轉實裝並啟動 meta/ 全面評估！"
      : "二轉主動技尚未實裝（仍維持一轉 1 武器＋4 主動技與一轉 50 點天賦）。"
  };

  return snap;
}

function diffSnapshots(oldSnap, newSnap) {
  const lines = [];
  const affectedFamilies = new Set();
  let hasDataChanges = false;

  lines.push(`# RO Survivors 線上版本落差報告（自動產出）`);
  lines.push("");
  lines.push(`- **線上版本**：\`${newSnap.version || "?"}\`（Build \`${newSnap.buildHash || "?"}\`, \`${newSnap.buildTime || "?"}\`）`);
  lines.push(`- **基準快照**：${oldSnap ? `\`${oldSnap.version}\`（Build \`${oldSnap.buildHash}\`）` : "（首次建立基準快照）"}`);
  lines.push(`- **二轉實裝偵測**：${newSnap.t2Status.summary}`);
  lines.push("");

  if (!oldSnap) {
    lines.push("> 首次執行，已建立 `sync/baseline.json` 基準快照；下次遊戲更新再跑 `node sync/diff-live.js` 即可只讀精簡差異。");
  } else {
    const sameBuild = oldSnap.buildHash === newSnap.buildHash && oldSnap.version === newSnap.version;

    // 1. Gear diff
    const gearAdded = [], gearRemoved = [], gearChanged = [];
    for (const [id, g] of Object.entries(newSnap.gear)) {
      if (!oldSnap.gear[id]) gearAdded.push(`#${id} (${g.slot}, T${g.tier}, wtype=${g.wtype || "-"}, jobs=${JSON.stringify(g.jobs)})`);
      else if (JSON.stringify(oldSnap.gear[id]) !== JSON.stringify(g)) gearChanged.push(`#${id}: 舊=${JSON.stringify(oldSnap.gear[id])} -> 新=${JSON.stringify(g)}`);
    }
    for (const id of Object.keys(oldSnap.gear)) {
      if (!newSnap.gear[id]) gearRemoved.push(`#${id}`);
    }

    // 1b. Official zh-TW localization diffs (items, cards, monsters, stages, jobs, skills, talents, pets)
    const diffNameMap = (oldMap, newMap, prefix = "") => {
      const out = [];
      if (!oldMap || !Object.keys(oldMap).length) return out;
      for (const [k, info] of Object.entries(newMap || {})) {
        const prev = oldMap[k];
        if (prev && prev.nameZh !== info.nameZh) {
          out.push(`${prefix}${k}: 舊="${prev.nameZh}" -> 新="${info.nameZh}"`);
        }
      }
      return out;
    };
    const itemNameDiffs = diffNameMap(oldSnap.itemNamesZh, newSnap.itemNamesZh, "#");
    const cardNameDiffs = diffNameMap(oldSnap.cardNamesZh, newSnap.cardNamesZh, "#");
    const monsterNameDiffs = diffNameMap(oldSnap.monsterNamesZh, newSnap.monsterNamesZh);
    const stageNameDiffs = diffNameMap(oldSnap.stageNamesZh, newSnap.stageNamesZh);
    const jobNameDiffs = diffNameMap(oldSnap.jobNamesZh, newSnap.jobNamesZh);
    const skillNameDiffs = diffNameMap(oldSnap.skillNamesZh, newSnap.skillNamesZh);
    const talentNameDiffs = diffNameMap(oldSnap.talentNamesZh && oldSnap.talentNamesZh.nodes, newSnap.talentNamesZh && newSnap.talentNamesZh.nodes);
    const petNameDiffs = [];
    if (oldSnap.petNamesZh && Object.keys(oldSnap.petNamesZh).length) {
      for (const [pid, info] of Object.entries(newSnap.petNamesZh || {})) {
        const prev = oldSnap.petNamesZh[pid];
        if (prev && (prev.nameZh !== info.nameZh || prev.accZh !== info.accZh)) {
          petNameDiffs.push(`${pid}: 舊=${prev.nameZh}/${prev.accZh || "-"} -> 新=${info.nameZh}/${info.accZh || "-"}`);
        }
      }
    }
    const allZhNameDiffs = [...itemNameDiffs, ...cardNameDiffs, ...monsterNameDiffs, ...stageNameDiffs, ...jobNameDiffs, ...skillNameDiffs, ...talentNameDiffs, ...petNameDiffs];

    // 2. Cards diff
    const cardAdded = [], cardChanged = [];
    for (const [id, c] of Object.entries(newSnap.cards)) {
      if (!oldSnap.cards[id]) cardAdded.push(`#${id} (${c.mob}, slot=${c.slot})`);
      else if (JSON.stringify(oldSnap.cards[id]) !== JSON.stringify(c)) cardChanged.push(`#${id}: 舊=${JSON.stringify(oldSnap.cards[id])} -> 新=${JSON.stringify(c)}`);
    }

    // 3. Pets diff
    const petAdded = [], petChanged = [];
    for (const [id, p] of Object.entries(newSnap.pets)) {
      if (!oldSnap.pets[id]) petAdded.push(`${id} (egg #${p.eggId}, secret=${p.secret})`);
      else if (JSON.stringify(oldSnap.pets[id]) !== JSON.stringify(p)) petChanged.push(`${id}: 加成或條件異動`);
    }

    // 4. Drops M2 diff
    const dropDiffs = [];
    for (const [mob, arr] of Object.entries(newSnap.dropsM2)) {
      const oldArr = oldSnap.dropsM2[mob];
      if (!oldArr) dropDiffs.push(`新增怪物掉落 ${mob}: ${JSON.stringify(arr)}`);
      else if (JSON.stringify(oldArr) !== JSON.stringify(arr)) dropDiffs.push(`掉落異動 ${mob}: 舊=${JSON.stringify(oldArr)} -> 新=${JSON.stringify(arr)}`);
    }

    // 5. Stages diff
    const stageDiffs = [];
    for (const [sid, st] of Object.entries(newSnap.stages)) {
      const ost = oldSnap.stages[sid];
      if (!ost) stageDiffs.push(`新增關卡 ${sid}: ${JSON.stringify(st)}`);
      else if (JSON.stringify(ost) !== JSON.stringify(st)) stageDiffs.push(`關卡異動 ${sid}: 舊=${JSON.stringify(ost)} -> 新=${JSON.stringify(st)}`);
    }

    // 6. Combat: vP tags, skills, T1 talent trees
    const vpDiffs = [];
    for (const [sid, tags] of Object.entries(newSnap.vP)) {
      const ot = oldSnap.vP[sid];
      if (!ot) vpDiffs.push(`新增技能標籤 ${sid}: ${JSON.stringify(tags)}`);
      else if (JSON.stringify(ot) !== JSON.stringify(tags)) {
        vpDiffs.push(`技能標籤異動 ${sid}: ${JSON.stringify(ot)} -> ${JSON.stringify(tags)}`);
        if (/kick|sprint/.test(sid)) affectedFamilies.add("taekwon");
      }
    }
    const talentDiffs = [];
    for (const fam of T1_FAMILIES) {
      const nt = newSnap.t1TreeHashes[fam];
      const ot = oldSnap.t1TreeHashes && oldSnap.t1TreeHashes[fam];
      if (nt && ot && (nt.hash !== ot.hash || nt.count !== ot.count)) {
        talentDiffs.push(`${fam} 一轉天賦樹異動（節點 ${ot.count} -> ${nt.count}）`);
        affectedFamilies.add(fam);
      }
    }
    const skillDiffs = [];
    for (const [sid, h] of Object.entries(newSnap.skillHashes)) {
      if (!oldSnap.skillHashes[sid]) skillDiffs.push(`新增主動技 ${sid}`);
      else if (oldSnap.skillHashes[sid] !== h) skillDiffs.push(`主動技程式碼異動 ${sid}`);
    }

    hasDataChanges = !sameBuild || gearAdded.length || gearRemoved.length || gearChanged.length || allZhNameDiffs.length || cardAdded.length || cardChanged.length || petAdded.length || petChanged.length || dropDiffs.length || stageDiffs.length || vpDiffs.length || talentDiffs.length || skillDiffs.length;

    if (!hasDataChanges) {
      lines.push("## 總結：版本與資料均無變動（無需耗費 AI 算力更新）");
    } else {
      lines.push("## 總結：偵測到線上版本／資料異動");
      if (affectedFamilies.size || skillDiffs.length || newSnap.t2Status.t2ActiveSkillsImplemented) {
        lines.push(`- **是否需要啟動 \`meta/\` 流派審查**：需要（受影響職系：\`${[...affectedFamilies].join(", ") || "請看異動技能列表"}\`）`);
      } else {
        lines.push(`- **是否需要啟動 \`meta/\` 流派審查**：**不需要**（戰鬥天賦與技能無變動，僅需執行 \`sync/\` 資料同步）`);
      }
      lines.push("");
      const emitList = (title, arr) => {
        if (!arr.length) return;
        lines.push(`### ${title} (${arr.length})`);
        arr.slice(0, 30).forEach(x => lines.push(`- ${x}`));
        if (arr.length > 30) lines.push(`- ...（其餘 ${arr.length - 30} 筆略）`);
        lines.push("");
      };
      emitList("新增裝備 (data/catalog.js)", gearAdded);
      emitList("異動裝備 (data/catalog.js)", gearChanged);
      emitList("移除裝備 (data/catalog.js)", gearRemoved);
      emitList("裝備官方繁中譯名異動 (data/catalog.js)", itemNameDiffs);
      emitList("卡片官方繁中譯名異動 (data/catalog.js)", cardNameDiffs);
      emitList("怪物官方繁中譯名異動 (data/stages.js)", monsterNameDiffs);
      emitList("關卡官方繁中譯名異動 (data/stages.js)", stageNameDiffs);
      emitList("職業官方繁中譯名異動 (data/builds.js / trees.js)", jobNameDiffs);
      emitList("主動技官方繁中譯名異動 (data/trees.js)", skillNameDiffs);
      emitList("一轉天賦官方繁中譯名異動 (data/trees.js)", talentNameDiffs);
      emitList("寵物／寵飾官方繁中譯名異動 (data/catalog.js)", petNameDiffs);
      emitList("新增卡片 (data/catalog.js)", cardAdded);
      emitList("異動卡片 (data/catalog.js)", cardChanged);
      emitList("新增寵物 (data/catalog.js)", petAdded);
      emitList("異動寵物 (data/catalog.js)", petChanged);
      emitList("怪物掉落 M2 異動 (data/stages.js)", dropDiffs);
      emitList("關卡參數 X9 異動 (data/stages.js)", stageDiffs);
      emitList("技能標籤 vP 異動（影響 meta/）", vpDiffs);
      emitList("一轉天賦樹異動（影響 meta/）", talentDiffs);
      emitList("主動技能實作異動（影響 meta/）", skillDiffs);
    }
  }

  lines.push("## 現行線上 `vP` 標籤異常雷達");
  if (!newSnap.vPAnomalies.length) lines.push("- 無異常（全部近戰物理光環皆正確掛有 `melee` 標籤！）");
  else newSnap.vPAnomalies.forEach(a => lines.push(`- [實碼 Bug 持續中] \`${a}\`（誤走遠程公式 \`STR+3×DEX\`）`));
  lines.push("");

  if (newSnap.latestPatchNotesZh) {
    lines.push("## 最新繁中 Patch Notes 摘錄");
    lines.push(newSnap.latestPatchNotesZh.split(/\r?\n/).slice(0, 20).join("\n"));
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const bundles = await fetchLiveBundles();
  const liveSnap = buildLiveSnapshot(bundles.mainJs, bundles.slJs, bundles.manifest, bundles.source);
  const oldSnap = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) : null;

  const diffMd = diffSnapshots(oldSnap, liveSnap);
  fs.writeFileSync(DIFF_MD_PATH, diffMd, "utf8");

  if (!oldSnap || FLAG_UPDATE_BASE) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(liveSnap, null, 2), "utf8");
    console.log(`[sync] 已更新基準快照: ${path.relative(ROOT, BASELINE_PATH)} (${liveSnap.version} / ${liveSnap.buildHash})`);
  }

  console.log(`[sync] 已產出精簡差異報告: ${path.relative(ROOT, DIFF_MD_PATH)}`);
  console.log("----------------------------------------------------------------");
  console.log(diffMd.split(/\r?\n/).slice(0, 28).join("\n"));
}

main().catch(err => {
  console.error("[sync] diff-live 失敗:", err.message);
  process.exitCode = 1;
});
