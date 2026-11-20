#!/usr/bin/env node
/**
 * RO Survivors 職系數值倍率與 T0 引擎速算器（支援增量單職分析）
 *
 * 用法：
 *   node meta/scan-meta.js                 掃描全部 9 大職系
 *   node meta/scan-meta.js --job archer    僅分析指定職系（swordsman/mage/archer/acolyte/thief/merchant/taekwon/ninja/gunslinger）
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const jobIdx = args.indexOf("--job");
const TARGET_FAM = jobIdx !== -1 ? String(args[jobIdx + 1]).toLowerCase() : null;

const sandbox = { window: {}, globalThis: {} };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
for (const rel of ["data/trees.js", "data/catalog.js", "data/builds.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
}
const { RO_TREES, RO_SKILLS, RO_CATALOG, RO_BUILDS } = ctx;
const GEAR_MAP = Object.fromEntries(RO_CATALOG.items.map(g => [g.id, g]));
const BASELINE_PATH = path.join(ROOT, "sync", "baseline.json");
const baseline = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) : null;

function Ni(val, rank) {
  const a = Math.max(0, val) / 15.46;
  const r1 = 1 + a * a * 0.045;
  return rank >= 2 ? Math.max(1 + a * a * a * 0.0075, 1.5 * r1) : r1;
}
function basicPow(val, rank, extraExp = 0) {
  const p = Ni(val, rank);
  const j = p / Ni(val, 1);
  const exp = Math.min(1, 0.5 + (rank >= 2 ? 0.15 : 0) + extraExp);
  return Math.pow(p / j, exp) * j;
}

const families = RO_BUILDS.firstJobGroups.filter(g => !TARGET_FAM || g.firstJob === TARGET_FAM);
if (!families.length) {
  console.error(`找不到職系 "${TARGET_FAM}"，可用值：${RO_BUILDS.firstJobGroups.map(g => g.firstJob).join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("================================================================");
  console.log(`  RO Survivors 數值分析師速算報告 (${RO_BUILDS.version} / ${RO_BUILDS.buildHash})`);
  console.log("================================================================");

  if (baseline && baseline.vPAnomalies && baseline.vPAnomalies.length) {
    console.log("\n[實碼 vP 異常雷達]");
    baseline.vPAnomalies.forEach(a => console.log(`  * ${a}`));
  }

  for (const grp of families) {
    const fam = grp.firstJob;
    console.log(`\n==================== ${grp.label} (${fam}) ====================`);

    // Highlight T0-type nodes in this family's T1 tree
    const tree = RO_TREES[fam];
    const keyNodes = [];
    for (const b of (tree.branches || [])) {
      for (const n of (b.nodes || [])) {
        if (n.r >= 5 || /(開局|導管|2000%|共享|免費|撿便宜|標記|流血|每\s*2\s*秒|元素匯聚|連發)/.test(n.dm || "")) {
          keyNodes.push(`  - [B${b.index} ${b.name} L${n.r}] ${n.name} (${n.id}): ${n.dm}`);
        }
      }
    }
    console.log("關鍵高階／引擎天賦節點：");
    keyNodes.forEach(k => console.log(k));

    for (const jKey of grp.jobs) {
      const job = RO_BUILDS.jobs[jKey];
      const rankNum = typeof job.rankNum === "number" ? job.rankNum : (["ninja", "gunslinger"].includes(jKey) ? 1 : 2);
      console.log(`\n  [職業: ${job.title} (${jKey}) | rank=${rankNum}]`);
      for (const ps of job.playstyles) {
        const sv = job.statVariants.find(s => s.id === ps.statVarId) || job.statVariants[0];
        const st = sv.stats;
        const w0 = ps.gear.weapons[0] ? GEAR_MAP[ps.gear.weapons[0].id] : null;
        const wAtk = (w0 && ((w0.live && w0.live.atk) || (w0.base && w0.base.atk))) || 35;
        const wMatk = (w0 && ((w0.live && w0.live.matk) || (w0.base && w0.base.matk))) || 0;
        const extraInt = (ps.t1Plan.alloc["archer.1.insight"] || 0) * 2;
        const atkMelee = wAtk + 3 * st.str;
        const atkRanged = wAtk + st.str + 3 * st.dex;
        const matk = wMatk + 3 * (st.int + extraInt);
        const daggerExp = (ps.t1Plan.alloc["thief.1.dagger"] || 0) * 0.05;

        const pMelee = Ni(atkMelee, rankNum).toFixed(1);
        const pRanged = Ni(atkRanged, rankNum).toFixed(1);
        const pMagic = Ni(matk, rankNum).toFixed(1);
        const pHybrid = Ni(atkRanged + matk, rankNum).toFixed(1);
        const bPow = basicPow(ps.scaling === "ranged" ? atkRanged : ps.scaling === "magic" ? matk : atkMelee, rankNum, daggerExp).toFixed(1);

        const tag = `${ps.isT0 ? "T0" : "備選"}/${ps.verified ? "實戰驗證" : "實碼推算"}`;
        const skNames = (ps.runSkills || []).map(sk => (RO_SKILLS[sk.id] && RO_SKILLS[sk.id].name) || sk.id).join("／");
        console.log(`    * [${tag}] ${ps.name} (${ps.id})`);
        console.log(`      素質: STR ${st.str} / AGI ${st.agi} / VIT ${st.vit} / INT ${st.int} / DEX ${st.dex} / LUK ${st.luk} | 主武: ${w0 ? `#${w0.id} ${w0.nameZh}` : "?"}`);
        console.log(`      1+4技能(官方繁中): ${skNames || "-"}`);
        console.log(`      實碼倍率: 近戰=${pMelee}x | 遠程=${pRanged}x | 魔法=${pMagic}x | 混傷=${pHybrid}x | 普攻=${bPow}x`);
      }
    }
  }
}
