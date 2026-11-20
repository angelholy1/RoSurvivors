#!/usr/bin/env node
/**
 * RO Survivors 攻略站自動化驗收腳本（適配模組化 data/*.js 架構）
 *
 * 檢查項目：
 *   1. 全站 JS 語法檢查（app.js + data/*.js）
 *   2. 零 Unicode Emoji 強制檢驗（index.html / styles.css / app.js / data/*.js）
 *   3. 零未實裝二轉天賦樹檢查（data/trees.js 僅允許現行生效的 9 大一轉樹）
 *   4. 全 16 職業 × 47 流派：素質預算(≤1273)、遠程 DEX/STR 方向、一轉 50 點天賦合法性
 *      （節點存在、maxRank、req/req2、r×5 層數門檻、武器/盾牌鎖定廢點）
 *   5. 裝備職業合法性、同部位不重複、雙手武器零盾牌/零盾卡
 *   6. 卡片插槽完全吻合實碼 compound（含文字防呆：#4172 武器 / #4372 頭飾 / #4048 飾品）
 *   7. 純物理 INT=1 零法寵／零純 INT 卡；runSkills 皆存在於 RO_SKILLS
 *   8. 線上加權掉落公式檢查（禁止退回舊版循序 surv *=）與過時文案掃描
 *   9. 若 sync/baseline.json 存在，額外交叉比對 M2 掉落表與卡片插槽！
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const BASELINE_PATH = path.join(__dirname, "baseline.json");

const EXPECTED_T1_FAMILIES = new Set([
  "swordsman", "mage", "archer", "acolyte", "thief", "merchant", "taekwon", "ninja", "gunslinger"
]);

const NEEDS_SHIELD_TALENTS = new Set([
  "swordsman.2.shield_mastery",
  "swordsman.2.shield_bash_dmg",
  "swordsman.2.shield_bash_reach",
  "swordsman.2.bulldozer",
  "swordsman.2.parry"
]);

const WEAPON_GATE_TALENTS = {
  "swordsman.0.sword_mastery": ["검"],
  "swordsman.0.two_hand": ["양손검", "양손창"],
  "swordsman.1.quicken": ["양손검", "양손창"],
  "swordsman.2.faith": ["검", "창"],
  "acolyte.2.mace_mastery": ["클럽", "너클", "책"],
  "acolyte.2.smite_dmg": ["클럽", "너클", "책"],
  "acolyte.2.fervor": ["클럽", "너클", "책"],
  "acolyte.2.iron_hand": ["클럽", "너클", "책"],
  "acolyte.2.triple_attack": ["클럽", "너클", "책"],
  "acolyte.2.blessed_hand": ["클럽", "너클", "책"],
  "acolyte.2.holy_sweep": ["클럽", "너클", "책"],
  "acolyte.2.faith_power": ["클럽", "너클", "책"],
  "acolyte.2.bless_proc": ["클럽", "너클", "책"],
  "thief.1.raid": ["단검", "카타르"],
  "merchant.1.axe_mastery": ["양손도끼"]
};

const WTYPE_ZH_TO_KR = {
  "單手劍": "검", "劍": "검", "雙手劍": "양손검",
  "單手槍": "창", "單手長矛": "창", "長矛": "창", "雙手槍": "양손창", "雙手長矛": "양손창",
  "單手斧": "도끼", "斧": "도끼", "雙手斧": "양손도끼",
  "鈍器": "클럽", "權杖": "클럽", "拳套": "너클", "護拳": "너클", "爪": "너클",
  "書本": "책", "書": "책", "法杖": "롯드", "魔杖": "롯드", "弓": "활", "弓弩": "활",
  "短劍": "단검", "拳刃": "카타르", "手槍": "권총", "步槍": "라이플", "霰彈槍": "샷건"
};

const PURE_MAGIC_PETS = new Set(["dokebi", "baby_desert_wolf", "willow", "familiar"]);
const PURE_INT_CARDS = new Set([4052]);
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

const errors = [];
const warnings = [];
const addError = (code, scope, msg) => errors.push({ code, scope, msg });
const addWarn = (code, scope, msg) => warnings.push({ code, scope, msg });

const stepCost = v => Math.floor((v - 1) / 10) + 2;
const totalStatCost = target => { let c = 0; for (let v = 1; v < target; v++) c += stepCost(v); return c; };
const sumStatsCost = st => ["str", "agi", "vit", "int", "dex", "luk"].reduce((a, k) => a + totalStatCost(Number(st[k]) || 1), 0);

function getKoreanWtype(item) {
  if (!item) return null;
  if (item.wtype && /[가-힣]/.test(item.wtype)) return item.wtype;
  return WTYPE_ZH_TO_KR[item.wtypeZh] || WTYPE_ZH_TO_KR[item.wtype] || null;
}

function main() {
  // 1. Check files exist & syntax + zero Unicode Emoji across all site files
  const jsFiles = [
    "data/icons.js",
    "data/trees.js",
    "data/catalog.js",
    "data/stages.js",
    "data/builds.js",
    "app.js"
  ];
  const textFiles = ["index.html", "styles.css", ...jsFiles];

  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  for (const rel of textFiles) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      addError("MISSING_FILE", rel, `缺少網站必要檔案 ${rel}`);
      continue;
    }
    const content = fs.readFileSync(full, "utf8");
    const emojis = content.match(EMOJI_RE);
    if (emojis && emojis.length) {
      addError("EMOJI_FORBIDDEN", rel, `偵測到 ${emojis.length} 個 Unicode Emoji（如 ${[...new Set(emojis)].slice(0, 5).join(" ")}），本站全面改用 data/icons.js 自製 SVG`);
    }
    if (rel.endsWith(".js")) {
      try {
        new vm.Script(content, { filename: rel });
      } catch (e) {
        addError("SYNTAX_ERROR", rel, `JS 語法錯誤: ${e.message}`);
        continue;
      }
      if (rel.startsWith("data/")) {
        vm.runInContext(content, ctx);
      }
    }
  }

  const { RO_ICONS, RO_TREES, RO_SKILLS, RO_CATALOG, RO_STAGES, RO_BUILDS } = ctx;
  if (!RO_TREES || !RO_SKILLS || !RO_CATALOG || !RO_STAGES || !RO_BUILDS || !RO_ICONS) {
    printReport();
    return;
  }

  // 2. Ensure data/trees.js has ONLY live T1 trees (no premature T2 trees!)
  for (const fam of Object.keys(RO_TREES)) {
    if (!EXPECTED_T1_FAMILIES.has(fam)) {
      addError("UNIMPLEMENTED_T2_TREE", `data/trees.js:${fam}`, `不應收錄尚未實裝的二轉天賦樹 "${fam}"`);
    }
  }

  // Build lookups
  const GEAR_MAP = Object.fromEntries(RO_CATALOG.items.map(g => [g.id, g]));
  const CARD_MAP = Object.fromEntries(RO_CATALOG.cards.map(c => [c.id, c]));
  const PET_MAP = Object.fromEntries(RO_CATALOG.pets.map(p => [p.id, p]));
  const treeIndex = {};
  for (const [fam, tree] of Object.entries(RO_TREES)) {
    const byId = new Map();
    (tree.branches || []).forEach((b, bi) => (b.nodes || []).forEach(n => byId.set(n.id, { ...n, branchIdx: bi })));
    treeIndex[fam] = byId;
  }

  // Optional cross-check with sync/baseline.json
  const baseline = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) : null;

  // 3. Validate all 16 jobs & playstyles
  let playstyleCount = 0;
  for (const jobKey of RO_BUILDS.jobOrder) {
    const job = RO_BUILDS.jobs[jobKey];
    if (!job) { addError("MISSING_JOB", jobKey, "data/builds.js 缺少此職業"); continue; }
    const famNodes = treeIndex[job.firstJob];
    if (!famNodes) { addError("MISSING_TREE", jobKey, `缺少一轉樹 ${job.firstJob}`); continue; }

    // Stat variants budget check
    for (const sv of (job.statVariants || [])) {
      const cost = sumStatsCost(sv.stats || {});
      if (cost > 1273) addError("STAT_OVER_BUDGET", `${jobKey}.${sv.id}`, `素質消耗 ${cost} > 1273`);
      for (const k of ["str", "agi", "vit", "int", "dex", "luk"]) {
        if (sv.stats[k] < 1 || sv.stats[k] > 99) addError("STAT_RANGE", `${jobKey}.${sv.id}`, `${k}=${sv.stats[k]}`);
      }
    }

    for (const ps of (job.playstyles || [])) {
      playstyleCount++;
      const scope = `${jobKey}/${ps.id}`;
      const statVar = (job.statVariants || []).find(s => s.id === ps.statVarId);
      if (!statVar) addError("MISSING_STAT_VAR", scope, `找不到 statVarId="${ps.statVarId}"`);
      else if (ps.scaling === "ranged" && (statVar.stats.int || 1) <= 1 && statVar.stats.str > statVar.stats.dex) {
        addError("RANGED_STAT_INVERTED", scope, `遠程流派主推 STR(${statVar.stats.str}) > DEX(${statVar.stats.dex})`);
      }

      // T1 50-pt talent checks
      const alloc = (ps.t1Plan && ps.t1Plan.alloc) || {};
      const pts = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
      if (pts !== 50) addError("TALENT_SUM_NOT_50", scope, `一轉天賦總點數 ${pts} != 50`);

      const branchRows = {};
      for (const [nid, rank] of Object.entries(alloc)) {
        const node = famNodes.get(nid);
        if (!node) { addError("TALENT_UNKNOWN", scope, `未知天賦節點 ${nid}`); continue; }
        if (rank < 1 || rank > node.m) addError("TALENT_RANK", scope, `${nid} 點數 ${rank} 超出 1..${node.m}`);
        branchRows[node.branchIdx] = branchRows[node.branchIdx] || {};
        branchRows[node.branchIdx][node.r] = (branchRows[node.branchIdx][node.r] || 0) + rank;
      }
      for (const [nid, rank] of Object.entries(alloc)) {
        if (rank <= 0) continue;
        const node = famNodes.get(nid);
        if (!node) continue;
        if (node.req) {
          const rn = famNodes.get(node.req);
          if (!rn || (alloc[node.req] || 0) < rn.m) addError("TALENT_REQ", scope, `${nid} 缺前置滿級 ${node.req}`);
        }
        if (node.req2) {
          const rn2 = famNodes.get(node.req2);
          if (!rn2 || (alloc[node.req2] || 0) < rn2.m) addError("TALENT_REQ", scope, `${nid} 缺第二前置滿級 ${node.req2}`);
        }
        if (node.r > 0) {
          let below = 0;
          for (let r = 0; r < node.r; r++) below += (branchRows[node.branchIdx] && branchRows[node.branchIdx][r]) || 0;
          if (below < node.r * 5) addError("TALENT_TIER", scope, `${nid} (L${node.r}) 需前層 ≥ ${node.r * 5}，目前 ${below}`);
        }
      }

      // RunSkills exist in active RO_SKILLS
      for (const sk of (ps.runSkills || [])) {
        if (!RO_SKILLS[sk.id]) addError("SKILL_UNKNOWN", scope, `主動技能 "${sk.id}" 不在現行實裝一轉技能表 RO_SKILLS 中`);
      }

      // Weapons & Gears legality
      const weapons = (ps.gear && ps.gear.weapons) || [];
      const gears = (ps.gear && ps.gear.gears) || [];
      const weaponItems = [];

      const checkAllowed = (item, kind) => {
        const liveJobs = baseline && baseline.gear && baseline.gear[item.id] ? baseline.gear[item.id].jobs : item.jobs;
        if (liveJobs && liveJobs.length && !liveJobs.includes(jobKey) && !liveJobs.includes(job.firstJob)) {
          addError(kind === "weapon" ? "WEAPON_ILLEGAL" : "GEAR_ILLEGAL", scope, `${kind} #${item.id}(${item.nameZh}) 不允許 ${jobKey} 裝備`);
        }
      };

      for (const w of weapons) {
        const g = GEAR_MAP[w.id];
        if (!g) { addError("GEAR_UNKNOWN", scope, `未知武器 #${w.id}`); continue; }
        weaponItems.push(g);
        checkAllowed(g, "weapon");
      }

      const slotCounts = {};
      let hasShieldGear = false;
      for (const gr of gears) {
        const g = GEAR_MAP[gr.id];
        if (!g) { addError("GEAR_UNKNOWN", scope, `未知防具 #${gr.id}`); continue; }
        checkAllowed(g, "gear");
        slotCounts[g.slot] = (slotCounts[g.slot] || 0) + 1;
        if (g.slot === "shield") hasShieldGear = true;
      }
      for (const [slot, cnt] of Object.entries(slotCounts)) {
        const lim = slot === "acc" ? 2 : 1;
        if (cnt > lim) addError("GEAR_DUP_SLOT", scope, `部位 ${slot} 超過上限 (${cnt} > ${lim})`);
      }

      const primaryWeapon = weaponItems[0] || null;
      const all2H = weaponItems.length > 0 && weaponItems.every(w => w.isTwoHanded);
      const primary2H = Boolean(primaryWeapon && primaryWeapon.isTwoHanded);
      const noShield = all2H || (primary2H && /無盾|雙手/.test((ps.loadout && ps.loadout.weaponMode) || ""));

      if (all2H && hasShieldGear) addError("SHIELD_WITH_2H", scope, "全雙手武器不可推薦盾牌裝備");
      const shieldCards = (ps.loadout && ps.loadout.cardsBySlot && ps.loadout.cardsBySlot.shield) || [];
      if (noShield && shieldCards.length > 0) addError("SHIELD_CARD_2H", scope, "雙手/無盾配置不可推薦盾牌卡片");

      // Weapon/shield-gated talent checks
      const gates = [];
      for (const [nid, rank] of Object.entries(alloc)) {
        if (rank <= 0) continue;
        if (NEEDS_SHIELD_TALENTS.has(nid) && noShield) addError("TALENT_SHIELD_DEAD", scope, `無盾配置誤點盾牌限定天賦 ${nid}`);
        if (WEAPON_GATE_TALENTS[nid]) gates.push({ nid, allowed: WEAPON_GATE_TALENTS[nid] });
      }
      if (gates.length > 1) {
        let inter = new Set(gates[0].allowed);
        for (let i = 1; i < gates.length; i++) inter = new Set([...inter].filter(x => gates[i].allowed.includes(x)));
        if (inter.size === 0) addError("TALENT_WEAPON_CONFLICT", scope, `互斥武器鎖定天賦：${gates.map(g => g.nid).join(" vs ")}`);
      }
      if (gates.length && primaryWeapon) {
        const pw = getKoreanWtype(primaryWeapon);
        for (const g of gates) {
          if (pw && !g.allowed.includes(pw)) addError("TALENT_WEAPON_MISMATCH", scope, `天賦 ${g.nid} 與主推武器 #${primaryWeapon.id}(${pw}) 不相容`);
        }
      }

      // Card slots + pets check
      const cbs = (ps.loadout && ps.loadout.cardsBySlot) || {};
      for (const [slot, arr] of Object.entries(cbs)) {
        for (const cr of (arr || [])) {
          const c = CARD_MAP[cr.id];
          if (!c) { addError("CARD_UNKNOWN", scope, `未知卡片 #${cr.id}`); continue; }
          const trueSlot = baseline && baseline.cards && baseline.cards[cr.id] ? baseline.cards[cr.id].slot : c.compound;
          if (trueSlot !== slot) addError("CARD_WRONG_SLOT", scope, `卡片 #${cr.id}(${c.nameZh}) 放入 [${slot}]，實碼為 [${trueSlot}]`);
        }
      }

      const isPurePhys = statVar && (statVar.stats.int || 1) <= 1 && ps.scaling !== "magic";
      if (isPurePhys) {
        for (const pr of ((ps.loadout && ps.loadout.pets) || [])) {
          if (!PET_MAP[pr.id]) addError("PET_UNKNOWN", scope, `未知寵物 ${pr.id}`);
          if (PURE_MAGIC_PETS.has(pr.id)) addError("PHYS_MAGIC_PET", scope, `純物理流派誤配法系寵物 ${pr.id}`);
        }
        for (const cr of (cbs.headgear || [])) {
          if (PURE_INT_CARDS.has(cr.id)) addError("PHYS_INT_CARD", scope, `純物理流派誤配純 INT 卡 #${cr.id}`);
        }
      }

      // Prose card-slot checks
      const prose = [ps.cardLogic, ps.gearLogic, ps.growthLogic].filter(Boolean).join(" ");
      if (/飾品[^。；;\n]{0,20}#?4172|飾品[^。；;\n]{0,12}書頁怪/.test(prose)) addError("PROSE_CARD_SLOT", scope, "文案誤寫 #4172 書頁怪為飾品卡");
      if (/鎧甲[^。；;\n]{0,20}#?4372|鎧甲[^。；;\n]{0,12}白素貞/.test(prose)) addError("PROSE_CARD_SLOT", scope, "文案誤寫 #4372 白素貞為鎧甲卡");
      if (/頭飾[^。；;\n]{0,20}#?4048|頭飾[^。；;\n]{0,12}毒魔菇/.test(prose)) addError("PROSE_CARD_SLOT", scope, "文案誤寫 #4048 毒魔菇為頭飾卡");
    }
  }

  // 4. Cross-check drops & version against baseline.json if present
  if (baseline) {
    if (baseline.version && RO_STAGES.meta.version !== baseline.version) {
      addError("VERSION_MISMATCH", "data/stages.js", `版本 ${RO_STAGES.meta.version} != baseline ${baseline.version}`);
    }
    for (const [mobId, liveDrops] of Object.entries(baseline.dropsM2 || {})) {
      const m = RO_STAGES.monsters[mobId];
      if (!m) { addError("M2_MISSING_MOB", `data/stages.js:${mobId}`, "缺少線上 M2 掉落怪物"); continue; }
      const aSig = (m.drops || []).map(d => `${d.id}:${d.rate}`).sort().join(",");
      const lSig = liveDrops.map(d => `${d.id}:${d.rate}`).sort().join(",");
      if (aSig !== lSig) addError("M2_DROP_DIFF", `data/stages.js:${mobId}`, `掉落不同: 本站[${aSig}] vs 線上[${lSig}]`);
    }
  }

  // 5. Check app.js does NOT regress to old sequential boss drop formula
  const appText = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  if (/surv\s*\*=\s*\(1\s*-\s*rawPct/.test(appText)) {
    addError("OLD_DROP_FORMULA", "app.js", "退回舊版循序首中即停掉率公式");
  }

  printReport(RO_BUILDS.jobOrder.length, playstyleCount, RO_CATALOG.cards.length, RO_CATALOG.items.length, RO_STAGES.stages.length);
}

function printReport(jobs, styles, cards, items, stages) {
  console.log("================================================================");
  console.log("  RO Survivors 攻略站自動化驗收報告 (sync/validate.js)");
  console.log("================================================================");
  if (jobs) console.log(`[INFO] 檢驗範圍：${jobs} 職業・${styles} 流派・${stages} 關卡・${items} 裝備・${cards} 卡片・全站零 Emoji`);
  console.log(`\n--- Errors (${errors.length}) ---`);
  if (!errors.length) console.log("  (0 Errors！全部檢驗通過)");
  else errors.forEach((e, i) => console.log(`  ${i + 1}. [${e.code}] (${e.scope}) ${e.msg}`));
  console.log(`\n--- Warnings (${warnings.length}) ---`);
  if (!warnings.length) console.log("  (0 Warnings)");
  else warnings.forEach((w, i) => console.log(`  ${i + 1}. [${w.code}] (${w.scope}) ${w.msg}`));
  console.log("================================================================");
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
