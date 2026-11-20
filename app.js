/* RO Survivors 盧恩公會手冊 — 精簡互動引擎（資料來源：data/*.js，零 Emoji） */
(function () {
  "use strict";

  const ICONS = window.RO_ICONS || {};
  const TREES = window.RO_TREES || {};
  const SKILLS = window.RO_SKILLS || {};
  const CATALOG = window.RO_CATALOG || { items: [], cards: [], pets: [] };
  const STAGES = window.RO_STAGES || { meta: {}, stages: [], monsters: {} };
  const BUILDS = window.RO_BUILDS || { jobOrder: [], firstJobGroups: [], jobs: {} };

  const GEAR_MAP = Object.fromEntries((CATALOG.items || []).map(g => [g.id, g]));
  const CARD_MAP = Object.fromEntries((CATALOG.cards || []).map(c => [c.id, c]));
  const PET_MAP = Object.fromEntries((CATALOG.pets || []).map(p => [p.id, p]));
  const STAGE_MAP = Object.fromEntries((STAGES.stages || []).map(s => [s.id, s]));

  const BRANCH_COLORS = ["#a63a2b", "#20639b", "#217346"];
  const SLOT_LABEL = {
    weapon: "主武器",
    shield: "副手盾牌",
    head_top: "頭飾（上）",
    head_mid: "頭飾（中）",
    head_low: "頭飾（下）",
    armor: "鎧甲",
    garment: "披肩",
    shoes: "鞋子",
    acc: "飾品"
  };
  const GEAR_SLOT_TO_CARD_SLOT = {
    weapon: "weapon",
    shield: "shield",
    head_top: "headgear",
    head_mid: null,
    head_low: null,
    armor: "armor",
    garment: "garment",
    shoes: "shoes",
    acc: "accessory"
  };
  const NON_DAMAGING_SKILLS = new Set([
    "provoke", "endure", "hp_recovery", "frost_diver", "concentration",
    "blessing", "hiding", "crazy_uproar", "enlarge_weight", "sprint"
  ]);
  const STAT_KEYS_ORDER = ["str", "agi", "vit", "int", "dex", "luk"];
  const STAT_LABEL_UP = { str: "STR", agi: "AGI", vit: "VIT", int: "INT", dex: "DEX", luk: "LUK" };

  const state = {
    activeTab: "builds",
    activeJob: "wizard",
    playstyleIdx: {},
    statVarIdx: {},
    selectedSkillIdx: {},
    branchTab: {},
    selectedNodeId: {},
    activeStage: "prontera",
    stageDiff: 1,
    stageMobFilter: "all",
    stageQuery: ""
  };

  for (const jKey of (BUILDS.jobOrder || [])) {
    const job = BUILDS.jobs[jKey];
    if (!job) continue;
    const ps0 = (job.playstyles || [])[0];
    state.playstyleIdx[jKey] = 0;
    const svIdx = ps0 ? (job.statVariants || []).findIndex(s => s.id === ps0.statVarId) : 0;
    state.statVarIdx[jKey] = svIdx >= 0 ? svIdx : 0;
    state.selectedSkillIdx[jKey] = 0;
    state.branchTab[jKey] = ps0 && ps0.t1Plan ? (ps0.t1Plan.branchIndex || 0) : 0;
    state.selectedNodeId[jKey] = ps0 && ps0.t1Plan && ps0.t1Plan.order && ps0.t1Plan.order[0] ? ps0.t1Plan.order[0] : null;
  }

  /* ---------------- Helpers ---------------- */
  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ico(name) {
    return `<span class="ico">${ICONS[name] || ICONS.spark || ""}</span>`;
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll("[data-icon]").forEach(el => {
      const k = el.getAttribute("data-icon");
      if (ICONS[k]) el.innerHTML = ICONS[k];
    });
  }

  function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(showToast._tm);
    showToast._tm = setTimeout(() => t.classList.remove("show"), 2500);
  }

  function stepCost(v) { return Math.floor((v - 1) / 10) + 2; }
  function totalStatCost(target) {
    let c = 0;
    for (let v = 1; v < target; v++) c += stepCost(v);
    return c;
  }
  function sumStatsCost(st) {
    return ["str", "agi", "vit", "int", "dex", "luk"].reduce((a, k) => a + totalStatCost(Number(st[k]) || 1), 0);
  }

  function formatMMSS(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function formatDropPct(pct) {
    if (pct >= 10) return pct.toFixed(2) + "%";
    if (pct >= 1) return pct.toFixed(2) + "%";
    return Number(pct.toFixed(4)) + "%";
  }

  function calcGearBaseProb(itemId, rate, isBoss) {
    const g = GEAR_MAP[itemId];
    const hasOffense = Boolean(
      g && (
        (g.base && ((g.base.atk || 0) > 0 || (g.base.matk || 0) > 0)) ||
        (g.live && ((g.live.atk || 0) > 0 || (g.live.matk || 0) > 0))
      )
    );
    if (isBoss && hasOffense) return 0.05;
    const lx = Math.log(2);
    const d6 = Math.log(2000);
    const s = Math.min(1, Math.max(0, (Math.log(Math.max(2, Number(rate) || 2)) - lx) / (d6 - lx)));
    return isBoss ? (0.10 + 0.05 * s) : (0.00015 + 0.00015 * s);
  }

  /* ---------------- Tab Switching ---------------- */
  function setActiveTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll("[data-tab]").forEach(btn => {
      const act = btn.getAttribute("data-tab") === tab;
      btn.classList.toggle("active", act);
      if (btn.hasAttribute("aria-selected")) btn.setAttribute("aria-selected", act ? "true" : "false");
    });
    document.querySelectorAll("[data-tab-panel]").forEach(panel => {
      const act = panel.getAttribute("data-tab-panel") === tab;
      panel.classList.toggle("active", act);
      panel.hidden = !act;
    });
    if (tab === "stages") renderStagesTab();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- Render Roster (16 Jobs) ---------------- */
  function renderRoster() {
    const wrap = document.getElementById("roster-container");
    if (!wrap) return;
    const groupsHtml = (BUILDS.firstJobGroups || []).map(grp => {
      const single = grp.jobs.length === 1 ? "single" : "";
      const btns = grp.jobs.map(jKey => {
        const job = BUILDS.jobs[jKey];
        if (!job) return "";
        const ps0 = (job.playstyles || [])[0];
        const isAct = jKey === state.activeJob;
        return `
          <button type="button" class="job-btn ${isAct ? "active" : ""}" data-select-job="${esc(jKey)}">
            <span class="job-btn-ico">${ICONS[job.icon] || ICONS.builds}</span>
            <span style="min-width:0">
              <span class="job-btn-name">${esc(job.title)}</span>
              <span class="job-btn-sub">${esc(ps0 ? ps0.name.slice(0, 14) : "")}</span>
            </span>
          </button>`;
      }).join("");
      return `
        <div class="family-group">
          <div class="family-group-label"><span>${esc(grp.label)}</span></div>
          <div class="family-jobs-row ${single}">${btns}</div>
        </div>`;
    }).join("");
    wrap.innerHTML = `<div class="roster-grid">${groupsHtml}</div>`;
  }

  /* ---------------- Render Active Job & Playstyle ---------------- */
  function getActiveContext() {
    const job = BUILDS.jobs[state.activeJob] || BUILDS.jobs[BUILDS.jobOrder[0]];
    const styles = job.playstyles || [];
    const pIdx = Math.min(Math.max(0, state.playstyleIdx[job.key] || 0), Math.max(0, styles.length - 1));
    const ps = styles[pIdx] || styles[0];
    const svIdx = Math.min(Math.max(0, state.statVarIdx[job.key] || 0), Math.max(0, (job.statVariants || []).length - 1));
    const statVar = (job.statVariants || [])[svIdx] || (job.statVariants || [])[0];
    const tree = TREES[job.firstJob];
    return { job, styles, pIdx, ps, svIdx, statVar, tree };
  }

  function buildCopyText(ctx) {
    const { job, ps, statVar } = ctx;
    const st = statVar.stats;
    const statLine = ["str", "agi", "vit", "int", "dex", "luk"]
      .filter(k => st[k] > 1)
      .map(k => `${k.toUpperCase()} ${st[k]}`)
      .join(" / ");
    const skillsLine = (ps.runSkills || []).map((s, i) => `${i + 1}.${(SKILLS[s.id] && SKILLS[s.id].name) || s.id}`).join(" ");
    const w0 = ps.gear.weapons[0] ? GEAR_MAP[ps.gear.weapons[0].id] : null;
    const wCards = ((ps.loadout.cardsBySlot && ps.loadout.cardsBySlot.weapon) || [])
      .map(c => (CARD_MAP[c.id] && CARD_MAP[c.id].nameZh) || ("#" + c.id))
      .join(" / ");
    return [
      `【RO Survivors ${BUILDS.version}】${job.title} — ${ps.name}`,
      `定位：${ps.tagline}`,
      `Lv99 素質：${statLine}（${sumStatsCost(st)} / 1,273 點）`,
      `一轉天賦：${ps.t1Plan.branchFocus}`,
      `主動技能：${skillsLine}`,
      `主武器：${w0 ? `#${w0.id} ${w0.nameZh}` : "-"}｜武器卡：${wCards || "-"}`,
      `局內必搶：${(ps.priority.tier1 || []).join("、")}`
    ].join("\n");
  }

  function renderSocketBoxHtml(slotLabel, cardRecs) {
    if (!cardRecs || !cardRecs.length) return "";
    const rows = cardRecs.map(cr => {
      const c = CARD_MAP[cr.id];
      const cName = c ? c.nameZh : ("卡片 #" + cr.id);
      const cBonus = c ? c.bonusText : "";
      return `
        <div class="socket-row">
          <span class="socket-gem">${ICONS.card_gem || ""}</span>
          <div>
            <span class="socket-card-name">${esc(cName)}</span>
            <span class="equip-id-pill">#${cr.id}</span>
            ${cBonus ? `<div class="socket-card-stat">${esc(cBonus)}</div>` : ""}
            ${cr.note ? `<span class="socket-card-note">${esc(cr.note)}</span>` : ""}
          </div>
        </div>`;
    }).join("");
    return `
      <div class="socket-box">
        <div class="socket-box-label">${ico("card_gem")}<span>${esc(slotLabel)}插槽卡片</span></div>
        ${rows}
      </div>`;
  }

  function getPlaystyleProfile(ps, statVar) {
    const st = (statVar && statVar.stats) || {};
    const titleTxt = `${ps.name || ""} ${ps.tagline || ""}`;
    const isLowHp = /狂暴|壓血|殘血/.test(titleTxt);
    const isDot = /燃燒|地獄怒爆|毒藥|施毒|劇毒|持續傷/.test(titleTxt);
    const isMagic = ps.scaling === "magic";
    const isHybrid = ps.scaling === "hybrid" || (!isMagic && (st.int || 1) > 10 && ((st.dex || 1) > 10 || (st.str || 1) > 10));
    const isPurePhys = !isMagic && !isHybrid && (st.int || 1) <= 1;
    const isRanged = ps.scaling === "ranged";
    const sortedStats = STAT_KEYS_ORDER
      .filter(k => (st[k] || 1) > 1)
      .sort((a, b) => (st[b] || 1) - (st[a] || 1));
    return { st, isLowHp, isDot, isMagic, isHybrid, isPurePhys, isRanged, sortedStats };
  }

  function renderGearRollGuideHtml(ctx) {
    const { job, ps, statVar } = ctx;
    const prof = getPlaystyleProfile(ps, statVar);

    // 1. Damaging skills eligible for Legendary +10% ~ +20% skill-damage line
    const dmgSkills = (ps.runSkills || [])
      .filter(sk => !NON_DAMAGING_SKILLS.has(sk.id))
      .map(sk => (SKILLS[sk.id] && SKILLS[sk.id].name) || sk.id);
    const skillText = dmgSkills.length ? dmgSkills.join(" ／ ") : "本流派主力輸出技能";

    // 2. Random 6-stat priority (T2 +2 per line; Purple/Gold roll 2 distinct stats)
    const statText = prof.sortedStats.length
      ? prof.sortedStats.map(k => STAT_LABEL_UP[k]).join(" ＞ ")
      : "主攻屬性 ＞ 副屬性";

    // 3. Random offense line (T2 +2%; Blue/Purple/Gold roll 1 from crit/cd/area, plus pierce on armor & bow/gun)
    const canPierce = prof.isRanged || prof.isHybrid || ["archer", "gunslinger", "ninja"].includes(job.firstJob);
    let offenseText = "冷卻縮減 ＞ 爆擊率 ＞ 技能範圍";
    if (prof.isLowHp || /暴擊|三連跳|暗影/.test(ps.name || "")) {
      offenseText = "爆擊率 ＞ 冷卻縮減 ＞ 技能範圍";
    } else if (canPierce) {
      offenseText = "冷卻縮減 ＞ 爆擊率 ＞ 貫穿（鎧甲／弓槍） ＞ 技能範圍";
    } else if (prof.isMagic) {
      offenseText = "冷卻縮減 ＞ 技能範圍 ＞ 爆擊率";
    }

    // 4. Random defense/utility line (Purple/Gold roll 1 from spd/armor/flee/hp/discovery)
    const utilText = prof.isLowHp
      ? "護甲 +0.8 ／ 移速 +2% ／ 迴避 +2%（壓血流勿刻意追最大HP；農裝換尋寶 +6%）"
      : "移速 +2% ／ 護甲 +0.8 ＞ 迴避 +2% ／ 最大HP +10（農裝期可選尋寶率 +6%）";

    return `
      <section class="gear-roll-guide" aria-label="裝備隨機詞條與換裝指南">
        <div class="roll-guide-banner">
          <span class="roll-guide-badge">${ico("spark")}<span>隨機詞條與換裝鐵則</span></span>
          <p class="roll-guide-rule">
            防具／頭飾／飾品除 <strong>#22847 普隆德拉卷軸</strong> 具固有特效外，同階基礎 DEF 近乎相同，底材僅差在 <strong>1 條保底詞條</strong>；實戰強度順序為：<strong>品質洞數（金 2 洞 ＞ 藍紫 1 洞 ＞ 白綠 0 洞）≥ 傳說核心技能傷（+10~20%）與隨機主屬／進攻條 ＞ Tier 2 ＞ 底材名稱</strong>。先打到好詞條的次選金裝可直接穿！
          </p>
        </div>
        <div class="roll-guide-grid">
          <div class="roll-guide-cell is-legend">
            <div class="roll-cell-kicker">${ico("star")}<span>傳說金裝技能條（+10~20%）必追</span></div>
            <div class="roll-cell-val">${esc(skillText)}</div>
            <div class="roll-cell-sub">僅傳說金裝必帶 1 條技能傷；對中核心輸出技直接拉開巨大差距。</div>
          </div>
          <div class="roll-guide-cell">
            <div class="roll-cell-kicker"><span>隨機六圍詞條（T2 每條 +2）</span></div>
            <div class="roll-cell-val">${esc(statText)}</div>
            <div class="roll-cell-sub">紫／金裝固定帶 2 條不重複六圍；對中主屬在二轉三次方公式下收益極高。</div>
          </div>
          <div class="roll-guide-cell">
            <div class="roll-cell-kicker"><span>隨機進攻詞條（T2 每條 +2%）</span></div>
            <div class="roll-cell-val">${esc(offenseText)}</div>
            <div class="roll-cell-sub">藍／紫／金裝各帶 1 條；頭上／頭中／頭下金裝皆有 2 洞可插頭飾卡。</div>
          </div>
          <div class="roll-guide-cell">
            <div class="roll-cell-kicker"><span>隨機防禦／功能（紫・金必帶 1 條）</span></div>
            <div class="roll-cell-val">${esc(utilText)}</div>
            <div class="roll-cell-sub">推高難優先移速與護甲防秒殺，常駐農裝／農卡可留尋寶率。</div>
          </div>
        </div>
      </section>`;
  }

  function getAltGearsForSlot(job, ps, statVar, slot, excludeIds) {
    const prof = getPlaystyleProfile(ps, statVar);
    const primaryStat = prof.sortedStats[0] || (prof.isMagic ? "int" : prof.isRanged ? "dex" : "str");
    const secondaryStats = new Set(prof.sortedStats.slice(1));

    const scoreItem = (it) => {
      const af = it.affixLine || "";
      if (prof.isPurePhys && (/\bINT\s*\+/.test(af) || /詠唱速度/.test(af))) return -999;
      if (prof.isMagic && /\bSTR\s*\+/.test(af)) return -999;
      if (prof.isPurePhys && /毒\/火\/流血/.test(af) && !prof.isDot) return -20;

      let s = (it.effTier || 1) * 100;
      if (slot === "armor" || slot === "garment") s += (it.base && it.base.def ? it.base.def * 2 : 0);

      if (af.includes(STAT_LABEL_UP[primaryStat] + " +")) s += 42;
      for (const sk of secondaryStats) {
        if (af.includes(STAT_LABEL_UP[sk] + " +")) s += 24;
      }
      if (/總傷/.test(af)) s += 45;
      if (/冷卻縮減|Haste/.test(af)) s += 30;
      if (/暴擊率/.test(af)) s += (prof.isLowHp || !prof.isMagic ? 28 : 22);
      if (/傷害減免/.test(af)) s += 26;
      if (/固定護甲/.test(af)) s += (prof.isMagic ? 16 : 22);
      if (/移動速度/.test(af)) s += 20;
      if (/迴避|Flee/.test(af)) s += 14;
      if (/回血\/秒/.test(af)) s += 13;
      if (/最大HP/.test(af)) s += (prof.isLowHp ? 2 : 12);
      if (/詠唱速度/.test(af)) s += (prof.isMagic || prof.isHybrid ? 28 : -999);
      if (/殘血增傷/.test(af)) s += (prof.isLowHp ? 46 : -12);
      if (/持續傷/.test(af)) s += (prof.isDot ? 38 : -8);
      if (/命中暈眩/.test(af)) s += 10;
      if (/吃肉|肉塊/.test(af)) s += 5;

      // Slight preference for permanent farmable gear when stats tie
      if (it.sourceType !== "festival") s += 3;
      if (it.id === 22847) s += 35;
      return s;
    };

    const candidates = (CATALOG.items || []).filter(it => {
      if (it.slot !== slot) return false;
      if (excludeIds.has(it.id)) return false;
      if (it.sourceType === "upcoming") return false;
      if (it.jobs && it.jobs.length && !it.jobs.includes(job.key) && !it.jobs.includes(job.firstJob)) return false;
      if (it.isStoryOnce && it.storyJobs && !it.storyJobs.includes(job.firstJob)) return false;
      return true;
    });

    const scored = candidates
      .map(it => ({ it, score: scoreItem(it) }))
      .filter(x => x.score > -100)
      .sort((a, b) => b.score - a.score || a.it.id - b.it.id);

    // Prefer Tier 2+ first; fall back to Tier 1 only if fewer than 2 results
    const t2 = scored.filter(x => (x.it.effTier || 1) >= 2);
    const pool = t2.length ? t2 : scored;

    const picked = [];
    const seenName = new Set();
    const seenAffix = new Set();
    for (const { it } of pool) {
      const cleanName = (it.nameZh || "").replace(/\s*\[[^\]]*\]|\s*（[^）]*）|\s*〔[^〕]*〕/g, "").trim();
      const afKey = (it.affixLine || "").trim();
      if (seenName.has(cleanName)) continue;
      if (afKey && seenAffix.has(afKey) && pool.length > 2) continue;
      seenName.add(cleanName);
      if (afKey) seenAffix.add(afKey);
      picked.push(it);
      if (picked.length >= 2) break;
    }
    return picked;
  }

  function renderAltGearsHtml(alts) {
    if (!alts || !alts.length) return "";
    const rows = alts.map(g => {
      const cleanName = (g.nameZh || "").replace(/\s*\[[^\]]*舊碼\]/g, "");
      const srcTag = g.id === 22847 ? "普隆德拉城" : g.sourceType === "festival" ? "燈籠節" : `T${g.effTier || 1} 常駐`;
      const srcCls = g.sourceType === "festival" ? "is-season" : "";
      return `
        <div class="alt-gear-row">
          <div class="alt-gear-top">
            <strong>#${g.id} ${esc(cleanName)}</strong>
            <span class="alt-gear-tag ${srcCls}">${esc(srcTag)}</span>
          </div>
          <div class="alt-gear-affix">${ico("star")}<span>保底：${esc(g.affixLine || "隨機詞條")}</span></div>
        </div>`;
    }).join("");
    return `
      <div class="alt-gears-box">
        <div class="alt-gears-label">次選／堪用替代底材（先出金裝好詞條可直接用）</div>
        ${rows}
      </div>`;
  }

  function renderArmoryGridHtml(ctx) {
    const { job, ps, statVar } = ctx;
    const cardsBySlot = (ps.loadout && ps.loadout.cardsBySlot) || {};
    const weapons = (ps.gear && ps.gear.weapons) || [];
    const gears = (ps.gear && ps.gear.gears) || [];
    const primaryWRec = weapons[0];
    const primaryW = primaryWRec ? GEAR_MAP[primaryWRec.id] : null;
    const all2H = weapons.length > 0 && weapons.every(w => GEAR_MAP[w.id] && GEAR_MAP[w.id].isTwoHanded);
    const hasShield = gears.some(g => GEAR_MAP[g.id] && GEAR_MAP[g.id].slot === "shield");
    const isNoShield = all2H || (!hasShield && primaryW && primaryW.isTwoHanded);

    const cards = [];

    // 1. Primary Weapon + Alternate Weapons + Weapon Cards
    if (primaryW) {
      const altHtml = weapons.slice(1).map(w => {
        const g = GEAR_MAP[w.id];
        if (!g) return "";
        return `
          <div class="alt-weapon-chip">
            <strong>#${g.id} ${esc(g.nameZh)}（${esc(w.roleTag || g.wtypeZh)}）</strong>
            <span>${esc(g.affixLine || "")}${g.dropSummary ? " ・ " + esc(g.dropSummary) : ""}</span>
          </div>`;
      }).join("");
      cards.push(`
        <article class="equip-card is-weapon">
          <div>
            <div class="equip-head">
              <span class="equip-slot-tag">${ico("slot_weapon")}<span>主武器（${esc(primaryW.wtypeZh || "武器")}${primaryW.isTwoHanded ? "・雙手" : "・單手"}）</span></span>
              <span class="equip-id-pill">#${primaryW.id}</span>
            </div>
            <div class="equip-name">${esc(primaryW.nameZh)}</div>
            <div class="equip-affix">${esc(primaryWRec.roleTag || "")}${primaryW.affixLine ? " ・ 保底：" + esc(primaryW.affixLine) : ""}</div>
            <div class="equip-reason">${esc(primaryWRec.reason || ps.gear.weaponNote || "")}</div>
            ${primaryW.dropSummary ? `<div class="equip-source">掉落來源：${esc(primaryW.dropSummary)}</div>` : ""}
            ${altHtml ? `<div class="alt-weapons-list">${altHtml}</div>` : ""}
          </div>
          ${renderSocketBoxHtml("武器", cardsBySlot.weapon)}
        </article>`);
    }

    // 2. Shield (either active shield gear + alts + cards, OR explicit 2H locked slot!)
    const shieldGearRec = gears.find(gr => GEAR_MAP[gr.id] && GEAR_MAP[gr.id].slot === "shield");
    if (shieldGearRec && !isNoShield) {
      const sg = GEAR_MAP[shieldGearRec.id];
      const shieldAlts = getAltGearsForSlot(job, ps, statVar, "shield", new Set([sg.id]));
      cards.push(`
        <article class="equip-card">
          <div>
            <div class="equip-head">
              <span class="equip-slot-tag">${ico("slot_shield")}<span>副手盾牌</span></span>
              <span class="equip-id-pill">#${sg.id}</span>
            </div>
            <div class="equip-name">${esc(sg.nameZh)}</div>
            <div class="equip-affix">${ico("star")}<span>底材保底：${esc(sg.affixLine || shieldGearRec.slotTag || "")}</span></div>
            <div class="equip-reason">${esc(shieldGearRec.reason || "")}</div>
            ${sg.dropSummary ? `<div class="equip-source">來源：${esc(sg.dropSummary)}</div>` : ""}
            ${renderAltGearsHtml(shieldAlts)}
          </div>
          ${renderSocketBoxHtml("盾牌", cardsBySlot.shield)}
        </article>`);
    } else {
      cards.push(`
        <article class="equip-card is-locked">
          <div>
            <div class="equip-head">
              <span class="equip-slot-tag">${ico("lock")}<span>副手盾牌（雙手鎖定）</span></span>
              <span class="equip-id-pill">無盾槽</span>
            </div>
            <div class="equip-name">雙手武器不可裝備盾牌</div>
            <div class="equip-reason">${esc((ps.loadout && ps.loadout.shieldNote) || "此流派以雙手武器為核心，盾牌與盾牌卡片均無法裝備，生存請由披肩／鎧甲減傷與走位補足。")}</div>
          </div>
        </article>`);
    }

    // 3. Other Gear Slots (Head Top/Mid/Low, Armor, Garment, Shoes, Dual Acc) with Alts & Embedded Cards
    let accCardAttached = false;
    const usedAccIds = new Set(gears.filter(gr => GEAR_MAP[gr.id] && GEAR_MAP[gr.id].slot === "acc").map(gr => gr.id));
    for (const gr of gears) {
      const g = GEAR_MAP[gr.id];
      if (!g || g.slot === "shield") continue;
      const cardSlotKey = GEAR_SLOT_TO_CARD_SLOT[g.slot];
      let socketHtml = "";
      if (cardSlotKey === "accessory") {
        if (!accCardAttached) {
          socketHtml = renderSocketBoxHtml("雙飾品", cardsBySlot.accessory);
          accCardAttached = true;
        }
      } else if (cardSlotKey) {
        socketHtml = renderSocketBoxHtml(g.slot === "head_top" ? "頭飾（上／中／下共用）" : SLOT_LABEL[g.slot], cardsBySlot[cardSlotKey]);
      }
      const excl = g.slot === "acc" ? usedAccIds : new Set([g.id]);
      const altList = getAltGearsForSlot(job, ps, statVar, g.slot, excl);
      if (g.slot === "acc") altList.forEach(a => usedAccIds.add(a.id));
      const affixPrefix = g.id === 22847 ? "固有特效：" : "底材保底：";
      cards.push(`
        <article class="equip-card">
          <div>
            <div class="equip-head">
              <span class="equip-slot-tag">${ico("slot_" + g.slot)}<span>${esc(SLOT_LABEL[g.slot] || g.slotZh || g.slot)}</span></span>
              <span class="equip-id-pill">#${g.id}</span>
            </div>
            <div class="equip-name">${esc(g.nameZh)}</div>
            <div class="equip-affix">${ico("star")}<span>${affixPrefix}${esc(g.affixLine || gr.slotTag || "")}</span></div>
            <div class="equip-reason">${esc(gr.reason || "")}</div>
            ${g.dropSummary ? `<div class="equip-source">來源：${esc(g.dropSummary)}</div>` : ""}
            ${renderAltGearsHtml(altList)}
          </div>
          ${socketHtml}
        </article>`);
    }

    // 4. Compact Pet Recommendations inside Armory (No separate pet encyclopedia tab!)
    const pets = (ps.loadout && ps.loadout.pets) || [];
    if (pets.length) {
      const petRows = pets.map(pr => {
        const p = PET_MAP[pr.id];
        return `
          <div class="pet-mini-row">
            <div class="pet-mini-head">
              <strong>${esc(p ? p.nameZh : pr.id)}</strong>
              <span class="pet-mini-tag">${esc(pr.tag || "推薦")}</span>
            </div>
            <div class="equip-reason">${esc(pr.reason || (p ? p.maxText : ""))}</div>
          </div>`;
      }).join("");
      cards.push(`
        <article class="equip-card is-pet">
          <div>
            <div class="equip-head">
              <span class="equip-slot-tag">${ico("slot_pet")}<span>流派搭配寵物</span></span>
              <span class="equip-id-pill">精選 3 隻</span>
            </div>
            <div style="margin-top:6px">${petRows}</div>
          </div>
        </article>`);
    }

    return cards.join("");
  }

  function renderTalentTreeHtml(ctx) {
    const { job, ps, tree } = ctx;
    if (!tree || !tree.branches) return "";
    const alloc = (ps.t1Plan && ps.t1Plan.alloc) || {};
    const activeBi = Math.min(Math.max(0, state.branchTab[job.key] || 0), tree.branches.length - 1);
    const branch = tree.branches[activeBi];

    // Branch point sums
    const branchTabs = tree.branches.map((b, bi) => {
      const sum = (b.nodes || []).reduce((acc, n) => acc + (alloc[n.id] || 0), 0);
      return `
        <button type="button" class="tree-branch-btn ${bi === activeBi ? "active" : ""}" data-branch-tab="${bi}">
          <span>${esc(b.name)}</span>
          <span class="tree-branch-pts">${sum} 點</span>
        </button>`;
    }).join("");

    // Map nodes by row/col
    const byPos = {};
    let maxRow = 6;
    const allNodesById = {};
    tree.branches.forEach(b => (b.nodes || []).forEach(n => { allNodesById[n.id] = n; }));
    (branch.nodes || []).forEach(n => {
      byPos[`${n.r}:${n.c}`] = n;
      if (n.r > maxRow) maxRow = n.r;
    });

    // Ensure selectedNodeId is valid in current branch
    let selId = state.selectedNodeId[job.key];
    if (!selId || !branch.nodes.some(n => n.id === selId)) {
      const firstAllocInBranch = branch.nodes.find(n => (alloc[n.id] || 0) > 0);
      selId = firstAllocInBranch ? firstAllocInBranch.id : (branch.nodes[0] && branch.nodes[0].id);
      state.selectedNodeId[job.key] = selId;
    }
    const selNode = allNodesById[selId] || branch.nodes[0];
    const selRank = selNode ? (alloc[selNode.id] || 0) : 0;

    let rowsHtml = "";
    for (let r = 0; r <= maxRow; r++) {
      let cells = `<div class="tree-row-lbl">L${r}</div>`;
      for (let c = 0; c < 4; c++) {
        const n = byPos[`${r}:${c}`];
        if (!n) {
          cells += `<div class="tree-empty"></div>`;
        } else {
          const rk = alloc[n.id] || 0;
          const cls = ["tree-node", rk > 0 ? "allocated" : "", n.id === selId ? "selected" : ""].filter(Boolean).join(" ");
          cells += `
            <button type="button" class="${cls}" data-select-node="${esc(n.id)}">
              <span class="tree-node-name">${esc(n.name)}</span>
              <span class="tree-node-rank">${rk} / ${n.m}</span>
            </button>`;
        }
      }
      rowsHtml += `<div class="tree-row">${cells}</div>`;
    }

    const orderChips = (ps.t1Plan.order || []).map((nid, idx) => {
      const n = allNodesById[nid];
      if (!n) return "";
      const rk = alloc[nid] || 0;
      return `<span class="order-chip">${idx + 1}. ${esc(n.name)} (${rk}/${n.m})</span>`;
    }).join("");

    const reqNames = [selNode && selNode.req, selNode && selNode.req2]
      .filter(Boolean)
      .map(id => (allNodesById[id] && allNodesById[id].name) || id)
      .join("、");

    return `
      <div class="panel-block" style="margin-top:18px">
        <div class="block-head">
          <h2>${ico("tree")}<span>一轉 50 點實戰天賦樹（${esc(tree.job.name)}・點擊節點看說明）</span></h2>
          <span class="block-sub">${esc(ps.t1Plan.branchFocus)}</span>
        </div>
        <div class="tree-branch-tabs">${branchTabs}</div>
        <div class="tree-grid-wrap">
          <div class="tree-matrix">${rowsHtml}</div>
          <div class="tree-inspector">
            ${selNode ? `
              <h5>${esc(selNode.name)}（${selRank} / ${selNode.m}）</h5>
              <div class="tree-inspector-meta">
                第 L${selNode.r} 層（需同分支前層 ≥ ${selNode.r * 5} 點）${reqNames ? " ・ 前置：" + esc(reqNames) : ""}
              </div>
              <p class="tree-inspector-desc"><strong>滿級效果：</strong>${esc(selNode.dm)}</p>
              ${selNode.d1 && selNode.d1 !== selNode.dm ? `<p class="tree-inspector-desc" style="color:var(--text-muted)"><strong>1 級效果：</strong>${esc(selNode.d1)}</p>` : ""}
            ` : ""}
            <div class="tree-order-box">
              <strong>建議點選順序（合計 50 點）：</strong>
              <div class="tree-order-chips">${orderChips}</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderBuildDetail() {
    const shell = document.getElementById("detail-shell");
    if (!shell) return;
    const ctx = getActiveContext();
    const { job, styles, pIdx, ps, svIdx, statVar, tree } = ctx;

    document.body.setAttribute("data-family", job.family || job.firstJob);
    document.body.setAttribute("data-job", job.key);

    // 1. Playstyle Switcher Cards
    const psBarHtml = styles.map((s, idx) => `
      <button type="button" class="ps-card-btn ${idx === pIdx ? "active" : ""}" data-select-ps="${idx}">
        <div class="ps-badges-row">
          <span class="t0-stamp ${s.isT0 ? "" : "alt"}">${ico(s.isT0 ? "star" : "scroll")}<span>${s.isT0 ? "T0 首選" : "可玩流派"}</span></span>
          <span class="verify-stamp ${s.verified ? "" : "calc"}">${ico(s.verified ? "check" : "spark")}<span>${s.verified ? "實戰驗證" : "實碼推算"}</span></span>
        </div>
        <div class="ps-card-name">${esc(s.name)}</div>
        <div class="ps-card-tag">${esc(s.tagline)}</div>
      </button>`).join("");

    // 2. Stat Bars (only show invested stats > 1, sorted desc)
    const st = statVar.stats;
    const invested = ["str", "agi", "vit", "int", "dex", "luk"]
      .map(k => ({ k: k.toUpperCase(), key: k, v: st[k] || 1 }))
      .filter(x => x.v > 1)
      .sort((a, b) => b.v - a.v);
    const statPillsHtml = (job.statVariants || []).length > 1
      ? `<div class="stat-var-pills">${job.statVariants.map((sv, i) => `
          <button type="button" class="stat-var-pill ${i === svIdx ? "active" : ""}" data-select-sv="${i}">${esc(sv.label)}</button>
        `).join("")}</div>`
      : "";
    const statBarsHtml = invested.map(x => `
      <div class="stat-bar-row">
        <span class="stat-bar-key">${x.k}</span>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${Math.min(100, x.v)}%"></div></div>
        <span class="stat-bar-val">${x.v}</span>
      </div>`).join("");
    const orderHtml = (statVar.order || []).length
      ? `<details class="stat-order-drawer"><summary>展開 Lv 1→99 升等點法順序</summary><ul class="stat-order-list">${statVar.order.map(o => `<li><strong>${esc(o.lv)}：</strong>${esc(o.text)}</li>`).join("")}</ul></details>`
      : "";

    // Talent branch stacked bar
    const alloc = (ps.t1Plan && ps.t1Plan.alloc) || {};
    const branchSegs = (tree && tree.branches ? tree.branches : []).map((b, bi) => {
      const pts = (b.nodes || []).reduce((acc, n) => acc + (alloc[n.id] || 0), 0);
      return { name: b.name, pts, color: BRANCH_COLORS[bi % BRANCH_COLORS.length] };
    }).filter(s => s.pts > 0);

    // 3. 1+4 Skill Hotbar
    const allHotbar = [
      {
        isBasic: true,
        icon: "sk_basic",
        name: "武器普攻",
        role: (ps.weaponInfo && ps.weaponInfo.shortPill) ? ps.weaponInfo.shortPill.slice(0, 10) : "左1 武器格",
        fullTitle: (ps.weaponInfo && ps.weaponInfo.title) || "武器普通攻擊",
        tip: (ps.weaponInfo && ps.weaponInfo.desc) || ps.gear.weaponNote || ""
      },
      ...(ps.runSkills || []).slice(0, 4).map(sk => {
        const meta = SKILLS[sk.id] || { name: sk.id, icon: "sk_aoe", desc: "" };
        return {
          isBasic: false,
          icon: meta.icon || "sk_aoe",
          name: meta.name,
          role: sk.role,
          fullTitle: `${meta.name}（${sk.role}）`,
          tip: sk.tip || meta.desc || ""
        };
      })
    ];
    const selSkIdx = Math.min(Math.max(0, state.selectedSkillIdx[job.key] || 0), Math.max(0, allHotbar.length - 1));
    const selSk = allHotbar[selSkIdx] || allHotbar[0];

    const hotbarHtml = allHotbar.map((sk, idx) => `
      <button type="button" class="skill-tile ${sk.isBasic ? "is-basic" : ""} ${idx === selSkIdx ? "active" : ""}" data-select-skill="${idx}">
        <span class="skill-hotkey">${sk.isBasic ? "普" : idx}</span>
        <span class="skill-ico-wrap">${ICONS[sk.icon] || ICONS.spark}</span>
        <span class="skill-tile-name">${esc(sk.name)}</span>
        <span class="skill-tile-role">${esc(sk.role)}</span>
      </button>`).join("");

    // 4. Traffic-light in-run pick guide + Chest core
    const prio = ps.priority || {};
    const chest = prio.chest || null;
    const chestHtml = chest ? `
      <div class="chest-focus-box">
        ${chest.skillDeities ? `<div class="chest-focus-row"><strong>核心技能神祇：</strong>${esc(chest.skillDeities)}</div>` : ""}
        ${chest.generalDeities && chest.generalDeities.length ? `<div class="chest-focus-row"><strong>通用神祇優先：</strong>${esc(chest.generalDeities.join(" ／ "))}</div>` : ""}
        ${chest.potion && chest.potion.length ? `<div class="chest-focus-row"><strong>藥水／祝福：</strong>${esc((chest.potion || []).slice(0, 2).join("、"))}｜${esc((chest.blessing || []).slice(0, 2).join("、"))}</div>` : ""}
        ${chest.chestTip ? `<div class="chest-focus-row"><strong>開箱提醒：</strong>${esc(chest.chestTip)}</div>` : ""}
      </div>` : "";

    shell.innerHTML = `
      <div class="playstyle-bar">${psBarHtml}</div>

      <article class="build-hero">
        <div class="hero-top">
          <div class="hero-title-area">
            <div class="hero-job-kicker">${ico(job.icon)}<span>${esc(job.familyLabel)} ・ ${esc(job.title)}（${esc(ps.badgeText)}）</span></div>
            <h1 class="hero-title">${esc(ps.name)}</h1>
            <p class="hero-desc">${esc(ps.growthLogic)}</p>
          </div>
          <div class="hero-right">
            <div class="hero-kpi">
              <div class="hero-kpi-val">${esc(ps.kpiVal)}</div>
              <div class="hero-kpi-lbl">${esc(ps.kpiLbl)}</div>
            </div>
            <button type="button" class="copy-btn" id="btn-copy-build">${ico("copy")}<span>一鍵複製配點給朋友</span></button>
          </div>
        </div>

        <div class="status-strip">${ico("info")}<span>${esc(job.liveStatusNote)}</span></div>
        ${ps.bugAlert ? `<div class="bug-strip">${ico("warning")}<span>${esc(ps.bugAlert)}</span></div>` : ""}

        <div class="hero-grid">
          <div class="sub-card">
            <div class="sub-card-head">
              <span>Lv 99 素質分配</span>
              <span>合計 ${sumStatsCost(st).toLocaleString("en-US")} / 1,273 點</span>
            </div>
            ${statPillsHtml}
            ${statBarsHtml}
            <div class="stat-reason-mini">${esc(statVar.reason || "")}</div>
            ${orderHtml}
            <div class="talent-split-box">
              <div class="sub-card-head" style="margin-bottom:3px"><span>一轉 50 點分支比例</span><span>下方可點閱完整天賦樹</span></div>
              <div class="talent-bar">
                ${branchSegs.map(s => `<div style="width:${s.pts * 2}%;background:${s.color}"></div>`).join("")}
              </div>
              <div class="talent-legend">
                ${branchSegs.map(s => `<span><i class="talent-dot" style="background:${s.color}"></i>${esc(s.name)} ${s.pts}</span>`).join("")}
              </div>
            </div>
          </div>

          <div class="sub-card">
            <div class="sub-card-head">
              <span>1+4 遊戲實戰技能欄（點擊看定位說明）</span>
              <span>左 1 普攻 ＋ 右 4 一轉主動</span>
            </div>
            <div class="hotbar">${hotbarHtml}</div>
            <div class="skill-detail-box">
              <div class="skill-detail-title">${esc(selSk.fullTitle)}</div>
              <p class="skill-detail-tip">${esc(selSk.tip)}</p>
            </div>
            <div class="stat-reason-mini">
              <strong>配裝重點：</strong>${esc(ps.gearLogic)}<br />
              <strong>插卡重點：</strong>${esc(ps.cardLogic)}
            </div>
          </div>
        </div>
      </article>

      <!-- 裝備＋卡片一體嵌卡配裝室 -->
      <div class="section-title-row">
        <h3>${ico("slot_shield")}<span>裝備與卡片一體配裝室</span></h3>
        <span>含流派隨機詞條挑裝指南、全部位次選替代底材與實碼合法卡片插槽；雙手武器自動鎖定盾槽</span>
      </div>
      ${renderGearRollGuideHtml(ctx)}
      <section class="armory-grid">${renderArmoryGridHtml(ctx)}</section>

      <!-- 局內倖存者挑卡核心（紅綠燈） -->
      <section class="two-col-grid">
        <div class="grimoire-card">
          <h4>${ico("spark")}<span>局內倖存者升級挑卡紅綠燈</span></h4>
          <div class="light-strip go">
            <span class="light-label">${ico("light_go")}<span>必搶核心</span></span>
            <ul class="light-items">${(prio.tier1 || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
          </div>
          <div class="light-strip mid">
            <span class="light-label">${ico("light_mid")}<span>補洞次選</span></span>
            <ul class="light-items">${(prio.tier2 || []).concat(prio.tier3 || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
          </div>
          <div class="light-strip stop">
            <span class="light-label">${ico("light_stop")}<span>避坑別拿</span></span>
            <div>${esc(prio.avoid || "無特別避坑項。")}</div>
          </div>
        </div>

        <div class="grimoire-card">
          <h4>${ico("scroll")}<span>本流派局內圍繞核心與寶箱重點</span></h4>
          <p style="margin:0 0 10px;font-size:13.5px;color:var(--text)">${esc(prio.summary || ps.growthLogic)}</p>
          ${chestHtml}
        </div>
      </section>

      <!-- 互動式一轉 50 點天賦樹 -->
      ${renderTalentTreeHtml(ctx)}
    `;
  }

  /* ---------------- Stages & Weighted Drop Rate Bars ---------------- */
  function buildStageMobEntries(stage) {
    if (!stage) return [];
    const byMob = new Map();
    const mvps = [], minis = [], normals = [];

    for (const b of (stage.bosses || [])) {
      const mob = STAGES.monsters[b.id];
      if (!mob) continue;
      let e = byMob.get("b:" + b.id);
      if (!e) {
        e = { stage, mob, windows: [] };
        byMob.set("b:" + b.id, e);
        (mob.boss === "mvp" ? mvps : minis).push(e);
      }
      const lbl = b.t > 0 ? formatMMSS(b.t) : (b.note || "預覽");
      if (!e.windows.includes(lbl)) e.windows.push(lbl);
    }
    for (const w of (stage.waves || [])) {
      const win = stage.status === "upcoming" ? "預覽波次" : `${formatMMSS(w.from)}–${formatMMSS(w.to)}`;
      for (const mid of (w.pool || [])) {
        const mob = STAGES.monsters[mid];
        if (!mob) continue;
        let e = byMob.get("n:" + mid);
        if (!e) {
          e = { stage, mob, windows: [] };
          byMob.set("n:" + mid, e);
          normals.push(e);
        }
        if (!e.windows.includes(win)) e.windows.push(win);
      }
    }
    for (const sm of (stage.summons || [])) {
      const mob = STAGES.monsters[sm.id];
      if (!mob) continue;
      let e = byMob.get("n:" + sm.id);
      if (!e) {
        e = { stage, mob, windows: [] };
        byMob.set("n:" + sm.id, e);
        normals.push(e);
      }
      const lbl = sm.note || "Boss 召喚";
      if (!e.windows.includes(lbl)) e.windows.push(lbl);
    }
    return [...mvps, ...minis, ...normals];
  }

  function mobMatchesQuery(entry, q) {
    if (!q) return true;
    const { stage, mob } = entry;
    const parts = [stage.nameZh, stage.nameEn, mob.id, mob.nameZh, mob.nameEn, mob.specialNote || "", mob.festivalBall || ""];
    if (mob.cardId) {
      const c = CARD_MAP[mob.cardId];
      parts.push("#" + mob.cardId, String(mob.cardId));
      if (c) parts.push(c.nameZh, c.nameEn, c.slotZh, c.bonusText);
    }
    if (mob.petId && PET_MAP[mob.petId]) {
      const p = PET_MAP[mob.petId];
      parts.push(p.nameZh, p.nameEn, "#" + p.eggId);
    }
    for (const d of (mob.drops || [])) {
      parts.push("#" + d.id, String(d.id));
      const g = GEAR_MAP[d.id];
      if (g) parts.push(g.nameZh, g.nameEn, g.affixLine || "", g.slotZh || "", g.wtypeZh || "");
    }
    return parts.join(" ").toLowerCase().includes(q);
  }

  function renderStageMobCardHtml(entry, diffMult, showStageTag) {
    const { stage, mob, windows } = entry;
    const isBoss = Boolean(mob.boss);
    const isMvp = mob.boss === "mvp";
    const isMini = mob.boss === "mini";
    const noLootReason = stage.status === "story_only"
      ? "劇情防衛關卡（storyOnly）：不掉落一般裝備、卡片與寵物蛋。"
      : stage.status === "upcoming"
        ? `${STAGES.meta.version || "Beta 0.7.8"} 尚未開放此關卡與掉落表（僅預覽陣容）。`
        : stage.status === "endless"
          ? "魔物終結塔計分關卡（無裝備／卡片／寵蛋掉落）。"
          : "";

    let lootHtml = "";
    if (noLootReason) {
      lootHtml = `<div class="loot-empty">${esc(noLootReason)}</div>`;
    } else {
      const rows = [];
      const dropItems = mob.drops || [];
      let noDropProb = 1;
      let totalWeight = 0;
      const computed = dropItems.map(d => {
        const baseW = calcGearBaseProb(d.id, d.rate, isBoss);
        const rawProb = Math.min(1, baseW * diffMult);
        noDropProb *= (1 - rawProb);
        totalWeight += baseW;
        return { d, baseW, rawPct: rawProb * 100 };
      });
      const anyDropPct = (1 - noDropProb) * 100;
      const maxBarPct = Math.max(1, ...computed.map(x => dropItems.length > 1 && totalWeight > 0 ? anyDropPct * (x.baseW / totalWeight) : x.rawPct));

      for (const { d, baseW, rawPct } of computed) {
        const g = GEAR_MAP[d.id];
        const realPct = (dropItems.length > 1 && totalWeight > 0) ? anyDropPct * (baseW / totalWeight) : rawPct;
        const sharePct = totalWeight > 0 ? ((baseW / totalWeight) * 100).toFixed(1) : "100.0";
        const barW = Math.min(100, Math.max(4, isBoss ? (realPct / Math.max(maxBarPct, 15)) * 100 : (realPct / 0.1) * 100));
        rows.push(`
          <div class="loot-row">
            <div class="loot-row-top">
              <div>
                <span class="loot-item-name">${esc(g ? g.nameZh : ("裝備 #" + d.id))}</span>
                <span class="loot-id">#${d.id}</span>
              </div>
              <span class="loot-rate-num">${isBoss ? "實戰 " : ""}${formatDropPct(realPct)}</span>
            </div>
            <div class="loot-bar-track"><div class="loot-bar-fill" style="width:${barW.toFixed(1)}%"></div></div>
            <div class="loot-sub-meta">
              <span>${esc(g ? (g.wtypeZh || g.slotZh) : "")}${g && g.affixLine ? " ・ " + esc(g.affixLine) : ""}</span>
              ${dropItems.length > 1 ? `<span>權重 ${sharePct}%${isBoss ? "｜總掉 " + formatDropPct(anyDropPct) : ""}</span>` : ""}
            </div>
          </div>`);
      }

      if (mob.cardId) {
        const c = CARD_MAP[mob.cardId];
        const cardPct = (isBoss ? (STAGES.meta.cardBaseBoss || 0.001) : (STAGES.meta.cardBaseMob || 0.0001)) * 100 * diffMult;
        rows.push(`
          <div class="loot-row is-card">
            <div class="loot-row-top">
              <div>
                <span class="loot-item-name">${esc(c ? c.nameZh : (mob.nameZh + "卡片"))}</span>
                <span class="loot-id">#${mob.cardId}（${esc(c ? c.slotZh : "卡片")}）</span>
              </div>
              <span class="loot-rate-num">${formatDropPct(cardPct)}</span>
            </div>
            <div class="loot-bar-track"><div class="loot-bar-fill" style="width:${isBoss ? 22 : 10}%"></div></div>
            <div class="loot-sub-meta">
              <span>${esc(c ? c.bonusText : "")}</span>
              <span>${!isBoss ? "組隊小怪 ÷2 / ÷2.75" : "單場受卡片上限 o.card 限制"}</span>
            </div>
          </div>`);
      }

      if (mob.petId) {
        const p = PET_MAP[mob.petId];
        const petPct = (isBoss ? (STAGES.meta.petBaseBoss || 0.001) : (STAGES.meta.petBaseMob || 0.0001)) * 100 * diffMult;
        rows.push(`
          <div class="loot-row is-pet">
            <div class="loot-row-top">
              <div>
                <span class="loot-item-name">${esc(p ? p.nameZh + " 寵物蛋" : mob.petId)}</span>
                ${p ? `<span class="loot-id">#${p.eggId}</span>` : ""}
              </div>
              <span class="loot-rate-num">${formatDropPct(petPct)}</span>
            </div>
            <div class="loot-sub-meta"><span>同場每種寵限 1 顆，已擁有不再掉落</span></div>
          </div>`);
      }

      if (mob.festivalBall) {
        rows.push(`
          <div class="loot-row is-evo">
            <div class="loot-row-top">
              <span class="loot-item-name">季節扭蛋球掉落</span>
              <span class="loot-rate-num">必掉扭蛋</span>
            </div>
            <div class="loot-sub-meta"><span>${esc(mob.festivalBall)}</span></div>
          </div>`);
      }

      if (mob.evoBoss) {
        rows.push(`
          <div class="loot-row is-evo">
            <div class="loot-row-top">
              <span class="loot-item-name">寵物進化擊殺目標</span>
              <span class="loot-rate-num">累計 5 殺</span>
            </div>
            <div class="loot-sub-meta"><span>${esc(mob.evoBoss.note)}</span></div>
          </div>`);
      }

      lootHtml = rows.length ? `<div class="loot-list">${rows.join("")}</div>` : `<div class="loot-empty">此怪物無任何裝備、卡片或寵物蛋掉落。</div>`;
    }

    const rolePill = isMvp
      ? `<span class="mob-role-pill mvp">MVP Boss</span>`
      : isMini
        ? `<span class="mob-role-pill mini">Mini Boss</span>`
        : `<span class="mob-role-pill">一般怪物</span>`;
    const stageBadge = showStageTag ? `<span class="mob-role-pill">${esc(stage.nameZh)}</span>` : "";

    return `
      <article class="mob-card ${isMvp ? "is-mvp" : isMini ? "is-mini" : ""}">
        <div class="mob-head">
          <div>
            <h4>${esc(mob.nameZh)}<span class="mob-lv">Lv.${mob.level}</span></h4>
            <div class="mob-en">${esc(mob.nameEn)}</div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">${stageBadge}${rolePill}</div>
        </div>
        <div class="mob-stats-line">
          <span>HP ${Number(mob.hp).toLocaleString("en-US")}</span>
          <span>ATK ${mob.damage}</span>
          <span>SPD ${mob.speed}</span>
          <span>EXP ${mob.exp}</span>
        </div>
        <div class="mob-win">${isBoss ? "登場時間" : "出沒波次"}：${esc(windows.join("、"))}</div>
        ${mob.specialNote ? `<div class="mob-special">${esc(mob.specialNote)}</div>` : ""}
        ${lootHtml}
      </article>`;
  }

  function renderStagesTab() {
    const selWrap = document.getElementById("stage-selector");
    const ovWrap = document.getElementById("stage-overview");
    const gridWrap = document.getElementById("stage-monsters-grid");
    const countEl = document.getElementById("stages-count-label");
    if (!selWrap || !ovWrap || !gridWrap) return;

    selWrap.innerHTML = (STAGES.stages || []).map(s => `
      <button type="button" class="stage-pill ${s.id === state.activeStage && !state.stageQuery ? "active" : ""}" data-select-stage="${esc(s.id)}">
        <span>${esc(s.nameZh)}</span>
        <span class="stage-tier-dot">T${s.tier}</span>
      </button>`).join("");

    const q = state.stageQuery.trim().toLowerCase();
    const diffMult = state.stageDiff;
    const mobCap = Math.floor((STAGES.meta.mobCapPerMult || 4) * diffMult + 1e-6);

    let entries = [];
    if (q) {
      for (const st of (STAGES.stages || [])) {
        for (const e of buildStageMobEntries(st)) {
          if (mobMatchesQuery(e, q)) entries.push(e);
        }
      }
    } else {
      const stage = STAGE_MAP[state.activeStage] || STAGES.stages[0];
      entries = buildStageMobEntries(stage);
    }

    if (state.stageMobFilter === "boss") {
      entries = entries.filter(e => Boolean(e.mob.boss));
    } else if (state.stageMobFilter === "loot") {
      entries = entries.filter(e =>
        e.stage.status !== "story_only" &&
        e.stage.status !== "upcoming" &&
        e.stage.status !== "endless" &&
        ((e.mob.drops && e.mob.drops.length) || e.mob.cardId || e.mob.petId || e.mob.festivalBall)
      );
    }

    countEl.textContent = q
      ? `跨關卡搜尋「${state.stageQuery.trim()}」找到 ${entries.length} 筆結果（依難度 ${diffMult}× 試算）`
      : `目前顯示 ${entries.length} 隻怪物／頭目（難度 ${diffMult}×・一般怪裝備上限 ${mobCap} 件／場）`;

    if (q) {
      ovWrap.innerHTML = "";
    } else {
      const st = STAGE_MAP[state.activeStage] || STAGES.stages[0];
      const bossesHtml = (st.bosses || []).map(b => {
        const m = STAGES.monsters[b.id];
        const kind = m && m.boss === "mvp" ? "mvp" : "mini";
        return `<span class="boss-chip ${kind}">${esc(b.t > 0 ? formatMMSS(b.t) : (b.note || "預覽"))} ${esc(m ? m.nameZh : b.id)}</span>`;
      }).join("");
      const wavesHtml = (st.waves || []).map(w => {
        const mobs = (w.pool || []).map(id => (STAGES.monsters[id] && STAGES.monsters[id].nameZh) || id).join("、");
        return `
          <div class="wave-chip">
            <div class="wave-chip-time">
              <span>${st.status === "upcoming" ? "預覽" : `${formatMMSS(w.from)}–${formatMMSS(w.to)}`}</span>
              <span>${w.perSecond > 0 ? `${w.perSecond}/s · 上限${w.maxAlive}` : "未啟用"}</span>
            </div>
            <div class="wave-chip-mobs">${esc(mobs)}</div>
          </div>`;
      }).join("");

      ovWrap.innerHTML = `
        <section class="stage-overview-card">
          <div class="stage-ov-top">
            <div>
              <h3>${esc(st.nameZh)}（Tier ${st.tier}）</h3>
              <p class="stage-ov-sub">${esc(st.nameEn)} ・ ${esc(st.placeZh)} ・ 怪物等級 ${esc(st.levels)}</p>
            </div>
            <div class="stage-cap-badge">難度 ${diffMult}× ｜ 一般怪裝上限 ${mobCap} 件／場</div>
          </div>
          <div class="stage-meta-grid">
            <div class="stage-meta-cell"><span>解鎖條件</span><strong>${esc(st.unlockText)}</strong></div>
            <div class="stage-meta-cell"><span>單局時長</span><strong>${st.runLengthSec > 0 ? formatMMSS(st.runLengthSec) : "尚未開放"}</strong></div>
            <div class="stage-meta-cell"><span>Job 經驗／上限</span><strong>${st.jobExp ? st.jobExp + "×" : "無"} ／ ${st.jobCap ? "Job Lv " + st.jobCap : "無"}</strong></div>
          </div>
          ${st.storyNote ? `<div class="stage-story-box">${esc(st.storyNote)}</div>` : ""}
          ${bossesHtml ? `<div style="margin-top:8px"><strong style="font-size:12px;color:var(--text-dim)">Boss 登場時間軸：</strong><div class="boss-timeline">${bossesHtml}</div></div>` : ""}
          ${wavesHtml ? `<div style="margin-top:10px"><strong style="font-size:12px;color:var(--text-dim)">時間波次陣容：</strong><div class="wave-strip">${wavesHtml}</div></div>` : ""}
        </section>`;
    }

    gridWrap.innerHTML = entries.length
      ? entries.map(e => renderStageMobCardHtml(e, diffMult, Boolean(q))).join("")
      : `<div class="loot-empty" style="grid-column:1/-1;padding:24px">找不到符合條件的怪物或掉落物，請調整篩選或關鍵字。</div>`;
  }

  /* ---------------- Event Delegation ---------------- */
  function bindEvents() {
    document.addEventListener("click", e => {
      const tabBtn = e.target.closest("[data-tab]");
      if (tabBtn) {
        setActiveTab(tabBtn.getAttribute("data-tab"));
        return;
      }

      const jobBtn = e.target.closest("[data-select-job]");
      if (jobBtn) {
        const jKey = jobBtn.getAttribute("data-select-job");
        if (BUILDS.jobs[jKey]) {
          state.activeJob = jKey;
          renderRoster();
          renderBuildDetail();
          const detailEl = document.getElementById("detail-shell");
          if (detailEl && window.innerWidth < 768) {
            detailEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
        return;
      }

      const psBtn = e.target.closest("[data-select-ps]");
      if (psBtn) {
        const idx = Number(psBtn.getAttribute("data-select-ps"));
        const job = BUILDS.jobs[state.activeJob];
        state.playstyleIdx[job.key] = idx;
        const ps = job.playstyles[idx];
        if (ps) {
          const svIdx = (job.statVariants || []).findIndex(s => s.id === ps.statVarId);
          if (svIdx >= 0) state.statVarIdx[job.key] = svIdx;
          state.selectedSkillIdx[job.key] = 0;
          state.branchTab[job.key] = ps.t1Plan ? (ps.t1Plan.branchIndex || 0) : 0;
          state.selectedNodeId[job.key] = ps.t1Plan && ps.t1Plan.order ? ps.t1Plan.order[0] : null;
        }
        renderBuildDetail();
        return;
      }

      const svBtn = e.target.closest("[data-select-sv]");
      if (svBtn) {
        state.statVarIdx[state.activeJob] = Number(svBtn.getAttribute("data-select-sv"));
        renderBuildDetail();
        return;
      }

      const skBtn = e.target.closest("[data-select-skill]");
      if (skBtn) {
        state.selectedSkillIdx[state.activeJob] = Number(skBtn.getAttribute("data-select-skill"));
        renderBuildDetail();
        return;
      }

      const brBtn = e.target.closest("[data-branch-tab]");
      if (brBtn) {
        state.branchTab[state.activeJob] = Number(brBtn.getAttribute("data-branch-tab"));
        renderBuildDetail();
        return;
      }

      const ndBtn = e.target.closest("[data-select-node]");
      if (ndBtn) {
        state.selectedNodeId[state.activeJob] = ndBtn.getAttribute("data-select-node");
        renderBuildDetail();
        return;
      }

      if (e.target.closest("#btn-copy-build")) {
        const txt = buildCopyText(getActiveContext());
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(() => showToast("已複製本流派配點與裝備摘要！")).catch(() => showToast("複製失敗，請手動選取"));
        } else {
          showToast("已產生摘要（瀏覽器不支援自動剪貼簿）");
        }
        return;
      }

      const stBtn = e.target.closest("[data-select-stage]");
      if (stBtn) {
        state.activeStage = stBtn.getAttribute("data-select-stage");
        state.stageQuery = "";
        const inp = document.getElementById("stage-search");
        if (inp) inp.value = "";
        renderStagesTab();
        return;
      }

      const diffBtn = e.target.closest("[data-stage-diff]");
      if (diffBtn) {
        state.stageDiff = Number(diffBtn.getAttribute("data-stage-diff")) || 1;
        document.querySelectorAll("[data-stage-diff]").forEach(b => b.classList.toggle("active", b === diffBtn));
        renderStagesTab();
        return;
      }

      const mobBtn = e.target.closest("[data-stage-mob-filter]");
      if (mobBtn) {
        state.stageMobFilter = mobBtn.getAttribute("data-stage-mob-filter");
        document.querySelectorAll("[data-stage-mob-filter]").forEach(b => b.classList.toggle("active", b === mobBtn));
        renderStagesTab();
        return;
      }
    });

    const searchInput = document.getElementById("stage-search");
    if (searchInput) {
      searchInput.addEventListener("input", e => {
        state.stageQuery = e.target.value || "";
        renderStagesTab();
      });
    }
  }

  /* ---------------- Init ---------------- */
  function init() {
    hydrateIcons(document);
    bindEvents();
    renderRoster();
    renderBuildDetail();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
