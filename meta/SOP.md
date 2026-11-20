# `meta/SOP.md` — RO Survivors 攻略站「AI 數值分析師流派審查」自動執行手冊

> **給執行本任務的 AI**：這是一份**全自動流派分析與更新規格書（Runbook）**。使用者只會叫你「看 `meta/SOP.md` 針對某職系（或新流派）進行審查並更新」，最後只會驗收你的結果報告。請嚴格以**實碼公式與限時 DPS 目標函數**做判斷，禁止憑 RO 原作直覺瞎編流派。

---

## 一、定位、觸發時機與最高原則

### 1. 什麼時候才需要動用 `meta/`？
- **情況 A（改版觸發）**：`sync/last-diff.md` 顯示有「一轉天賦樹異動」、「主動技能實作異動」、「`vP` 技能標籤異動／Bug 修復」、「二轉技能樹正式開放」、或「出現改變配裝結構的超模新裝備／新卡片」。
- **情況 B（玩家回報觸發）**：使用者提供自己實測或網路看到的新流派，請你用實碼驗證強度並收錄（或將既有的 `[實碼推算]` 升級為 `[實戰驗證]`）。
- **省算力原則**：預設**只針對受影響的單一或少數職系**執行增量分析（`node meta/scan-meta.js --job <family>`），**不要**無故掃描或重寫無關職系！只有在「全職業通用傷害公式大改」或「二轉天賦樹正式開放」時才做全 9 大職系總檢。

### 2. 收錄標準（使用者明確需求）
- 本站聚焦各職業現行版本的 **T0 主流流派**（以及少數定位明確的無副作用／特化備選，**T1 以下純玩具或過時廢案不收錄**）。
- 每個職業在 `data/builds.js` 的 **`playstyles[0]` 必須是該職業現行 T0 首選**（網站切換到該職業時預設直接展開 `playstyles[0]`）。
- 每個流派必須完整涵蓋玩家實戰真正需要的 4 大內容：**① 核心運作引擎與素質配點 ② 一轉 50 點天賦與點法順序 ③ 裝備＋卡片嵌槽配置 ④ 局內 1+4 技能、升級選卡紅綠燈與寶箱神祇挑選**。

### 3. 硬性禁止事項（違反即判定失敗）
- **嚴禁憑 RO 原作印象推純奶／純坦為主推 T0**（例：服事推回血奶路線當首選、劍士推純肉坦當首選）。
- **嚴禁推薦未實裝的二轉天賦與二轉主動技能**（除非 `sync/last-diff.md` 明確偵測到二轉實裝開關已打開）。
- **嚴禁自行翻譯遊戲專有名詞**：撰寫流派文案（`data/builds.js` 與 `meta/T0_BUILDS.md`）提及任何**職業、技能、天賦、裝備、卡片、寵物、寵物飾品、怪物、關卡**時，一律**必須與 `sync/baseline.json` 中遊戲本體 `zh-TW` 官方譯名完全一致**（由 `sync/validate.js` 強制驗收），不可自行直譯或混用英文原名。
- **嚴禁出現任何 Unicode Emoji**（全站由 `sync/validate.js` 強制檢查，圖示只用 `data/icons.js`）。
- **嚴禁直接把整份線上 4.6 MB `main-*.js` 或整個 473 KB `data/builds.js` 讀進上下文**；一律透過 `meta/scan-meta.js` 與 Node 單一職系讀寫腳本操作。

---

## 二、RO Survivors 實碼戰鬥公式與目標函數（分析師必備知識）

### 1. 遊戲真實目標函數
本遊戲的核心檢定是**限時 DPS 檢定**（例如洛陽白素貞 2 分鐘限時、無限塔每層 60 秒內須清達該層生成總分 80%）。
因此 T0 流派必須同時滿足：
1. **高覆蓋清大群效率**（範圍、多目標、貫穿、免費觸發或連環爆炸）
2. **夠高的對王單體／持續輸出上限**（在 2 分鐘內穩定收掉百萬級 MVP）
3. **局內成型順滑**（開局自帶核心技能或低卡手風險，不依賴極端運氣）

### 2. 實碼傷害倍率核心公式（與 `meta/scan-meta.js` 同步）
- **Lv 99 素質預算**：上限 **1,273 點**，單項範圍 `1..99`；由 `v` 升到 `v+1` 消耗 `floor((v - 1) / 10) + 2` 點。
- **階傷倍率函數 `Ni(val, rank)`**：
  - `a = max(0, val) / 15.46`
  - 一轉 (`rank = 1`，目前忍者／神槍手為單階)：`r1 = 1 + a^2 * 0.045`
  - 二轉 (`rank = 2`，其餘 14 職)：`max(1 + a^3 * 0.0075, 1.5 * r1)`
  - **關鍵意義**：二轉為**三次方曲線**，單主屬點滿 99 暴衝至約 `54.2×`；**所有輸出流派主屬性必優先點滿 99**，切忌平均亂點！
- **四大攻擊面板公式**：
  - **近戰物理**：`atkMelee = 武ATK + 3 × STR`
  - **遠程物理**：`atkRanged = 武ATK + STR + 3 × DEX` → **所有遠程流派必須主 DEX (99) 副 STR**，不可 STR > DEX！
  - **魔法攻擊**：`matk = 武MATK + 3 × INT`
  - **混傷公式**（如弓手 `arcane_shot` / `fire_arrow`）：`powerHybrid = Ni(atkRanged + matk, rank)` **不除 2**！因此 `DEX 99 / INT 80` 可衝至 **457×**，遠超純物理。
- **普攻冪次倍率 `basicPow(val, rank, extraExp)`**：
  - 基礎指數 `0.5`，二轉 `rank >= 2` 額外 `+0.15`，盜賊短劍天賦 `thief.1.dagger` 滿級再 `+0.25`。
- **實碼 `vP` 標籤 Bug 雷達（務必每次核對！）**：
  - `sync/baseline.json` 的 `vPAnomalies` 會記錄線上異常技能標籤。
  - 例如 Beta 0.7.6 中跆拳三踢技（`tornado_kick` / `roundhouse` / `counter_kick`）漏掛 `"melee"` 標籤而誤走遠程公式 `STR + 3×DEX`（導致點 DEX 99 比 STR 99 高出 17.8 倍）。
  - **一旦某次改版 `vPAnomalies` 清空代表官方修好該 Bug**：必須立即將受影響職系的 T0 主推 `statVarId` 切換回正常主屬（例如跆拳切回 `STR 99 / AGI 80 / LUK 53`），並移除／更新 `bugAlert` 提示！

### 3. 五大 T0 引擎檢核清單（幫 AI 主動發現強勢套路）
在審查某職系的一轉天賦樹（`data/trees.js`）與主動技能時，主動尋找以下 5 種超模機制，不要只盯著單一分枝往下硬點到 L6：
1. **升級倍率共享／跨技能繼承**：投資一張局內升級卡能同時強化多個技能（例：法師三導管火 18 / 冰 16 / 奧 16，三箭互吃強化斜率 ×3＋開局白送三技）。
2. **免費自動施放／不佔冷卻**：無須佔用主動冷卻即周期或觸發施放完整技能（例：服事《神聖審判》每 2 秒自動瞬發完整神聖之光、弓手《齊射風暴》普攻暴擊 40% 免費發射二連矢）。
3. **跨技能互減冷卻／連鎖引爆**：兩招互相刷 CD 形成永動循環（例：弓手奧火《奧術連發》互減 1.2s CD＋《元素匯聚》3m 連爆）。
4. **高倍率普攻／壓血常駐獨立乘區**：把普攻拉到超模倍率或永久觸發殘血詞條（例：盜賊《遊蕩暗影》1000%/1500%/2000% 三連跳＋短劍 `basicExp`＋《卸除鎧甲》+30%；劍士《狂暴》鎖 40% HP 常駐低血吃滿雙手劍 +50% 距離＋60% 流血＋殘血裝 +18%）。
5. **跨系獨立標記乘區／免費濺射**：副分枝的標記或特效可被主輸出完整繼承（例：商人鍛造 34＋交易 16《撿便宜》讓手推車共吃金幣雨對王 +30% 易傷＋《武器值最大化》無限塔免費濺射）。

### 4. 配點、配裝與插卡硬約束（違反會被 `sync/validate.js` 擋下）
1. **一轉 50 點天賦樹規則**：
   - 總點數嚴格 `=== 50`，單節點 `1 <= rank <= node.m`。
   - 同分枝第 `r` 層 (`r > 0`) 需滿足前層 `0..(r-1)` 合計 `>= r * 5`。
   - 所有 `req`、`req2` 前置節點必須點到**滿級 (`node.m`)**。
2. **零廢點防呆（武器鎖定 & 盾牌鎖定）**：
   - 無盾／雙手武器流派：**嚴禁**點任何盾牌限定節點（`swordsman.2.shield_mastery`, `shield_bash_dmg`, `shield_bash_reach`, `bulldozer`, `parry`），也不可在 `gears` 放盾牌或在 `cardsBySlot.shield` 放盾卡（必須為 `[]`）。
   - 武器類型鎖定天賦必須與主推武器 `gear.weapons[0]` 的韓文 `wtype` 完全相容（例：單手劍 `검` vs 雙手劍/雙手槍 `양손검/양손창`；服事鈍器/拳套/書本 `클럽/너클/책`；盜賊短劍/拳刃 `단검/카타르`；商人雙手斧 `양손도끼`），且不可同時點兩個互斥武器天賦。
3. **職業裝備白名單與卡片實碼槽位**：
   - 所有武器與防具 ID 必須存在於 `data/catalog.js` 且允許該職業（或一轉職系）裝備；防具同部位上限為 1（`acc` 上限為 2）。
   - 卡片插槽必須嚴格吻合實碼 `compound`（**高頻易錯點警告**：`#4172 書頁怪 = weapon` 武器卡、`#4372 白素貞 = headgear` 頭飾卡、`#4048 毒魔菇 = accessory` 飾品卡；**連說明文案中也不可以寫錯槽位！**）。
   - **純物理流派（`INT = 1` 且 `scaling !== "magic"`）**：禁止配法系寵物（`dokebi`, `baby_desert_wolf`, `willow`, `familiar`）或純 INT 頭飾卡（`#4052`）。

---

## 三、9 大職系參數與 16 職業對照表

執行 `node meta/scan-meta.js --job <family>` 時使用左欄的 `<family>`：

| `--job` 參數 (`firstJob`) | 對應 `data/builds.js` 的職業 Key | 現行 `rankNum` |
| :--- | :--- | :---: |
| `swordsman` | `knight`, `crusader` | `2` |
| `mage` | `wizard`, `sage` | `2` |
| `archer` | `hunter`, `bard` | `2` |
| `acolyte` | `priest`, `monk` | `2` |
| `thief` | `assassin`, `rogue` | `2` |
| `merchant` | `blacksmith`, `alchemist` | `2` |
| `taekwon` | `star_gladiator`, `soul_linker` | `2` |
| `ninja` | `ninja` | `1` |
| `gunslinger` | `gunslinger` | `1` |

---

## 四、標準 6 步全自動執行流程

### Step 1：鎖定受影響職系並執行數值速算
執行增量掃描（不要無故掃全職）：
```powershell
node meta/scan-meta.js --job <family>
# 僅全職業大改或二轉實裝才執行全掃：
# node meta/scan-meta.js
```
仔細檢視輸出的：
- `[實碼 vP 異常雷達]`（確認有無公式錯掛或剛修復的 Bug）
- `關鍵高階／引擎天賦節點`（確認該職系最強的 L5/L6 或跨系連攜引擎）
- 該職系下每個職業既有流派的 `實碼倍率`（近戰 / 遠程 / 魔法 / 混傷 / 普攻）與素質配置

### Step 2：必要時查驗單一職系實碼細節（低 Token 模式）
若某技能倍率／天賦機制剛改版，或使用者提到某個玩家開發的新連攜想驗證：
- 用精簡 `node` 指令讀取 `data/trees.js` 裡**該單一 `RO_TREES[family]`** 與 `data/builds.js` 裡**該單一 `RO_BUILDS.jobs[jobKey]`**，不要整檔載入全文。
- 若需核對線上實碼傷害函式（例如確認新技能到底走 `atkMelee`、`atkRanged` 還是 `powerHybrid`），用 Node 精準擷取該技能 ID 所在片段（≤ 60 行）即可。

### Step 3：設計／調整 T0 流派並寫入 `data/builds.js`
**強烈建議用 Node 腳本讀寫 `data/builds.js`**（`vm.runInContext` 載入 → 僅改目標 `RO_BUILDS.jobs[jobKey]` → 序列化寫回），確保 473 KB 單行檔案零語法破損。

#### `playstyle` 物件完整必填結構（新增或改寫時必齊全）
```json
{
  "id": "唯一英文短代號",
  "isT0": true,
  "verified": false,
  "badgeText": "T0 主流・簡短亮點",
  "name": "流派正式名稱",
  "tagline": "分枝配點比（如 狂怒 32 ＋ 守護 18）｜一句話點出核心引擎",
  "kpiVal": "短數值亮點（如 457× 混傷 / ×1.60 流血）",
  "kpiLbl": "數值亮點註解（≤ 18 字）",
  "bugAlert": null,
  "statVarId": "對應 job.statVariants 中的 id",
  "scaling": "melee | ranged | magic | hybrid",
  "growthLogic": "核心運作引擎與數值依據（說明為何為 T0）",
  "gearLogic": "核心武器與關鍵部位配裝思路",
  "cardLogic": "各部位嵌卡重點與寵物搭配（不可寫錯卡槽）",
  "weaponInfo": {
    "shortPill": "簡短武器標籤",
    "title": "主推武器說明標題",
    "tag": "開局最左獨立武器格",
    "desc": "武器機制與選擇原因"
  },
  "t1Plan": {
    "branchIndex": 0,
    "branchFocus": "分枝分配與總點數摘要（合計 50/50 點）",
    "alloc": { "family.branch.nodeId": 5 },
    "order": ["依建議優先順序排列的 nodeId 陣列"]
  },
  "runSkills": [
    { "id": "存在於 RO_SKILLS 的技能 id（共 4 個）", "role": "定位標籤", "tip": "實戰抓法與操作提示" }
  ],
  "gear": {
    "weaponNote": "武器選用重點說明",
    "weapons": [{ "id": 1648, "roleTag": "畢業／過渡標籤", "reason": "選用理由" }],
    "gears": [{ "id": 2255, "slotTag": "部位標籤", "reason": "選用理由與掉落來源" }]
  },
  "loadout": {
    "weaponMode": "持武模式（如 雙手劍無盾 / 單手法杖＋鏡盾）",
    "shieldNote": "無盾或持盾補充說明",
    "pets": [{ "id": "petId", "tag": "定位", "reason": "選用理由" }],
    "cardsBySlot": {
      "weapon": [{ "id": 4137, "note": "插卡說明" }],
      "shield": [],
      "armor": [],
      "garment": [],
      "shoes": [],
      "headgear": [],
      "accessory": []
    }
  },
  "priority": {
    "tier1": ["綠燈必搶升級詞條（3 項）"],
    "tier2": ["黃燈視況補強（3 項）"],
    "tier3": ["次要或低優先（2 項）"],
    "avoid": "避坑提醒（明確指出不要抓的廢技／廢卡與原因）",
    "summary": "一句話總結局內挑卡節奏",
    "chest": {
      "skillDeities": "專屬技能神祇推薦",
      "generalDeities": ["泛用神祇 1", "泛用神祇 2", "泛用神祇 3"],
      "potion": ["藥水推薦 1", "藥水推薦 2", "藥水推薦 3"],
      "elixir": ["秘藥推薦 1", "秘藥推薦 2", "秘藥推薦 3"],
      "blessing": ["祝福推薦 1", "祝福推薦 2", "祝福推薦 3"],
      "dish": ["料理推薦 1", "料理推薦 2", "料理推薦 3"],
      "chestTip": "寶箱與神祇鎖定策略"
    }
  }
}
```

#### 標籤與排序規則
- **驗證標籤 (`verified`)**：
  - AI 依實碼公式新推導出來、尚未經玩家回報實戰體感的流派 → 一律設 `verified: false`（前台顯示 `[實碼推算]`）。
  - 經使用者或玩家社群實戰確認過的流派 → 設 `verified: true`（前台顯示 `[實戰驗證]`）。
- **T0 置頂規則**：若新流派經實碼計算明顯超越原 `playstyles[0]`，請將新 T0 移至 `playstyles[0]`（`isT0: true`），舊流派改為 `isT0: false`（若仍具獨特手感或安全定位可保留為備選；若已完全被上位取代且屬於 T1 以下，直接淘汰移除）。
- **`bugAlert` 欄位**：僅在該流派牽涉現行實碼 Bug（如 `vP` 標籤漏掛）時填入提醒文字；無 Bug 或修復後設為 `null`。

### Step 4：同步更新 `meta/T0_BUILDS.md`
將本次受影響職系在 `meta/T0_BUILDS.md` 表格中的對應列更新（包含版本號、流派名稱、標籤 `[實碼推算]`/`[實戰驗證]`、一轉 50 點分配、Lv 99 素質、實碼倍率與勝出引擎依據）。

### Step 5：強制雙重驗收（缺一不可）
依序執行：
```powershell
node sync/validate.js
node meta/scan-meta.js --job <family>
```
必須同時滿足：
1. `sync/validate.js` 結果為 **`0 Errors / 0 Warnings / 0 Emoji`**（Exit Code 0）。
2. `meta/scan-meta.js --job <family>` 輸出的新實碼倍率、素質、主武與預期完全吻合，無任何意外倍率暴跌或錯用 `statVarId`。

### Step 6：Git 提交推送與分析師交付報告
1. 用 `git status --short` 確認僅修改了預期檔案（通常是 `data/builds.js` 與 `meta/T0_BUILDS.md`），無殘留暫存腳本。
2. 依 UTF-8 安全規範提交並推送（Windows PowerShell 5.1 須將 commit message 寫入 UTF-8 無 BOM 暫存檔再 `git commit -F`，切勿 `--force`）。
3. **固定結果回報格式（讓使用者直接審查結論）**：
   - **審查範圍**：受影響職系／職業與觸發原因
   - **前後數值與流派對比表**：列出舊配置 vs 新配置的素質、50 點天賦分配、實碼倍率變化、主推武器／核心卡異動、以及標籤狀態（`[實碼推算]` 或 `[實戰驗證]`）
   - **驗收結果**：`sync/validate.js`（0 Errors / 0 Warnings）＋ `meta/scan-meta.js` 複算結果
   - **Git 狀態**：Commit Hash 與推送狀態
   - **待玩家實戰複核項目**（若有標為 `[實碼推算]` 的新流派，一句話說明體感確認重點，方便使用者玩過後叫你升級為 `[實戰驗證]`）
