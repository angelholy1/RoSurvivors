# `sync/SOP.md` — RO Survivors 攻略站「版本比對與資料同步」AI 自動執行手冊

> **給執行本任務的 AI**：這是一份**全自動執行規格書（Runbook）**。使用者只會叫你「看 `sync/SOP.md` 幫我更新並推上 Git」，最後只會驗收你的結果報告。請嚴格照本手冊逐步執行，做到**低 Token 消耗、零人工疏漏、零驗收錯誤**。

---

## 一、最高鐵律（違反即判定失敗）

1. **省算力鐵律（嚴禁硬讀線上 4.6 MB 原始碼）**
   - **禁止**直接把線上 `build/main-*.js`（約 4.6 MB）或 `build/soul_linker-*.js` 整份讀進上下文。
   - **禁止**無故整份讀取 `data/builds.js`（473 KB）、`data/catalog.js`（195 KB）、`data/trees.js`（109 KB）。
   - 一律先執行 `node sync/diff-live.js`，**只閱讀 `sync/last-diff.md`**。
   - 若新增裝備／卡片／怪物／天賦需要查詢實碼細節與繁中譯名，一律用**精準的 Node 腳本只抽取指定 ID（單次輸出 ≤ 60 行）**。
2. **官方繁中譯名一致鐵律（嚴禁自行翻譯或沿用非官方別名）**
   - 本站所有**裝備、卡片、寵物、寵物飾品、怪物、關卡、職業（一轉／二轉）、主動技能、一轉天賦分支與節點名稱**，一律**必須與 `ro-survivors.com` 遊戲本體 `zh-TW` 實碼譯名 100% 一致**，**嚴禁 AI 自行直譯英文或套用非遊戲本體別名**！
   - 線上官方繁中譯名由 `sync/diff-live.js` 自動從 `assets/manifest.json`（裝備／卡片英文名）＋ `build/soul_linker-*.js` 內建繁中翻譯引擎（`itemDict` 對應裝備與卡片、`uiDict` + `enDict` + `termDict` 對應怪物／關卡／職業／技能／天賦）擷取並寫入 `sync/baseline.json` 的 8 大譯名對照表：
     `itemNamesZh`、`cardNamesZh`、`monsterNamesZh`、`stageNamesZh`、`jobNamesZh`、`skillNamesZh`、`talentNamesZh`、`petNamesZh`。
   - 允許僅於極少數**同中文名不同 ID** 的區分處於尾端加上括號標籤（如燈籠節變體 `〔燈籠節〕`、雙階同名裝 `（Tier 1）/（Tier 2）/（劇情）`、關卡狀態 `（防衛劇情）/（尚未開放）`），但**基底名稱必須 100% 等於官方繁中譯名**（由 `sync/validate.js` 自動強制攔截）。
   - 同步新增或改名任何項目時，除了更新 `data/catalog.js`／`data/stages.js`／`data/trees.js` 外，**必須連同 `data/builds.js` 攻略內文、`app.js`、`index.html` 與 `meta/T0_BUILDS.md` 中提及該名稱的文案一併對齊**（注意循環譯名防撞，如 `劍魚／異變魚／狄奧斯`、`腐屍／殭屍／殭屍帽`、`蝗蟲之王／森靈`、`白幽靈／幽靈波利`）。
3. **全站零 Unicode Emoji 鐵律**
   - `index.html`、`styles.css`、`app.js` 與全部 `data/*.js` **嚴禁出現任何 Unicode Emoji**（如星星、火焰、打勾、警告符號等，由 `sync/validate.js` 以 `EMOJI_RE` 強制攔截）。
   - 站內圖示一律透過 `data/icons.js` 的 `RO_ICONS` SVG Key 渲染。
4. **二轉未實裝防呆鐵律**
   - 務必檢查 `sync/last-diff.md` 頂部的 **「二轉實裝偵測」** 欄位。
   - 只要二轉天賦樹與二轉主動技能仍未實裝：
     - **嚴禁**在 `data/trees.js` 新增二轉天賦樹（僅允許 9 大一轉職系：`swordsman`, `mage`, `archer`, `acolyte`, `thief`, `merchant`, `taekwon`, `ninja`, `gunslinger`）。
     - **嚴禁**在 `data/builds.js` 的 `runSkills` 加入未實裝二轉主動技能（維持現行一轉 1 武器＋4 主動技）。
5. **設計風格與頁籤範圍不可退化**
   - 維持「風格 A：RO 盧恩羊皮紙公會手冊」與**雙分頁精簡結構**（分頁 1：職業流派攻略；分頁 2：關卡與掉落機率）。
   - **禁止**重新加回已移除的「寵物圖鑑分頁」「專有名詞分頁」「配點試算器」「流派對比頁」。
   - **禁止**將 `app.js` 的線上掉落公式退回舊版循序模型（`surv *= (1 - rawPct)`）；必須維持 `mysteryDrop + dropSeeded` 加權抽樣模型。
6. **Windows PowerShell 與 Git 安全規範**
   - 本機環境為 Windows PowerShell 5.1：**不可使用 `&&` 串接指令**（請改用 `;` 與 `if ($LASTEXITCODE -eq 0)`）。
   - Git 提交繁中訊息時，**必須先將訊息寫成 UTF-8 無 BOM 暫存檔再執行 `git commit -F`**，避免 PowerShell 字碼頁造成亂碼。
   - **嚴禁**執行 `git push --force` 或寫入任何本機絕對路徑（例如 `C:\Users\...`）到專案檔案中。

---

## 二、專案檔案結構與負責範圍

網站為純靜態前端（相容離線雙擊與 GitHub Pages），`data/*.js` 均以 IIFE 掛載全域物件並以單行 JSON 儲存：

| 檔案 | 全域變數 | 負責內容 | 何時需要修改 |
| :--- | :--- | :--- | :--- |
| `data/catalog.js` | `RO_CATALOG` | `version`, `buildHash`, `items[]` (裝備), `cards[]` (卡片), `pets[]` (寵物) | 新增／修改／移除裝備、卡片、寵物，或版號更新 |
| `data/stages.js` | `RO_STAGES` | `meta` (版本與通用掉率規則), `stages[]` (關卡波次/Boss/活動規則), `monsters{}` (怪物血量/速度/掉落 `M2`) | 關卡參數、波次、Boss HP、活動機率、怪物 `drops` 變動 |
| `data/trees.js` | `RO_TREES`, `RO_SKILLS` | 現行實裝之 9 大一轉天賦樹與一轉主動技能定義 | 一轉天賦數值／前置／譯名或一轉主動技變動 |
| `data/builds.js` | `RO_BUILDS` | 頂部 `version`, `buildHash`, `updatedAt` 與 16 職配點配裝流派 | 單純資料同步時**僅改頂部版號與 `updatedAt`**；若牽涉戰鬥流派調整改走 `meta/SOP.md` |
| `data/icons.js` | `RO_ICONS` | 自製 inline SVG 圖示庫 | 僅當新增全新職業或新技能圖示需求時 |
| `index.html` | — | 頁面 `<title>`、`.brand-sub`、`.banner-seal`、`.banner-meta`、分頁 2 掉率／活動橫幅、`.nav-badge` 數量、`.footer` | 版本號、建置 Hash、日期、關卡數或活動核心機率異動 |
| `sync/baseline.json` | — | 上一次驗收通過的線上實碼快照（給 `diff-live.js` 與 `validate.js` 交叉比對） | 每次資料同步完成後由 `--update-baseline` 自動寫入 |
| `sync/last-diff.md` | — | `diff-live.js` 自動產出的精簡差異報告 | 每次跑 `diff-live.js` 自動覆寫 |

> **修改 `data/*.js` 強烈建議用 Node 腳本讀寫**（`vm.runInContext` 讀出 → 精準增刪改物件 → `JSON.stringify` 寫回原 IIFE 殼），切勿手動用文字工具在幾十萬字元的單行 JSON 裡盲改，既快、省 Token 又 100% 不會產生語法錯誤。

---

## 三、標準 6 步全自動執行流程

### Step 0：環境與 Git 狀態確認
1. 確認目前工作目錄位於專案根目錄（含 `index.html`、`sync/`、`data/`）。
2. 執行 `git status -sb` 確認工作區狀態，若有遠端更新先確認是否需要 `git pull`。

### Step 1：執行線上實碼差異掃描（零讀原碼）
執行：
```powershell
node sync/diff-live.js
```
完成後，**只讀取 `sync/last-diff.md`**。
- **捷徑結束條件**：如果 `sync/last-diff.md` 顯示 **「版本與資料均無變動」**，且使用者沒有額外指定手動修改 → **立即停止所有後續步驟**，直接回報使用者目前網站與線上版本一致、無須更新（不改檔案、不 Commit）。

### Step 2：精準抽取新增／異動項目細節（僅在有新增或譯名異動時執行）
`sync/last-diff.md` 已直接列出大部分差異（含 `M2` 怪物 `{id, rate}`、裝備 `slot/tier/wtype/jobs`、卡片 `mob/slot`、關卡參數、**8 大官方繁中譯名異動清單**、最新繁中 Patch Notes）。

若 `last-diff.md` 出現**新增裝備 ID、新增卡片 ID、新增寵物、新增怪物、新增關卡、譯名異動或天賦節點異動**，需要查出它的**完整數值、詞條與官方繁中譯名**時：
- **官方繁中譯名來源一律直接查詢 `sync/baseline.json`**（更新後之 `itemNamesZh` / `cardNamesZh` / `monsterNamesZh` / `stageNamesZh` / `jobNamesZh` / `skillNamesZh` / `talentNamesZh` / `petNamesZh`）或透過 `sync/diff-live.js` 內建的 `buildLiveZhTranslators()` 轉換，**嚴禁自行翻譯**！
- 用一小段臨時 `node` 腳本（可透過 PowerShell Here-String `@' ... '@ | node` 執行，**不要留暫存檔在專案內**）查詢指定 ID 的實碼數值與官方繁中鍵名。
- 線上 `main-*.js` / `soul_linker-*.js` 的常見結構提示：
  - 版本與繁中 Patch Notes：搜尋 `## Beta `。
  - 裝備基底、詞條與官方繁中字典：優先參考 `sync/diff-live.js` 的解析邏輯（`buildLiveZhTranslators()` 與 `buildLiveSnapshot()`），而非盲目全檔 grep。
  - **嚴禁**把超過 100 行的原始碼印出來讀。

### Step 3：依差異報告精準更新對應檔案
只修改 `sync/last-diff.md` 有指出異動的項目：

1. **裝備／卡片／寵物異動 → 更新 `data/catalog.js`**
   - 更新頂部 `RO_CATALOG.version` 與 `RO_CATALOG.buildHash`。
   - **裝備物件 (`RO_CATALOG.items[]`) 關鍵欄位**：
     ```json
     {
       "id": 1166,
       "nameZh": "中文名",
       "nameEn": "English Name",
       "slot": "weapon | shield | head_top | head_mid | head_low | armor | garment | shoes | acc",
       "slotZh": "武器",
       "slotShortZh": "武器",
       "wtype": "양손검 (非武器為 null；單手劍=검, 雙手劍=양손검, 單手槍=창, 雙手槍=양손창, 單手斧=도끼, 雙手斧=양손도끼, 鈍器=클럽, 拳套=너클, 書本=책, 法杖=롯드, 弓=활, 短劍=단검, 拳刃=카타르, 手槍=권총, 步槍=라이플, 霰彈槍=샷건)",
       "wtypeZh": "雙手劍",
       "isTwoHanded": true,
       "rare": false,
       "baseTier": 2,
       "effTier": 2,
       "base": { "atk": 47, "matk": 0, "def": 0, "wlv": 4, "elv": 50 },
       "jobs": ["swordsman", "knight", "crusader"],
       "jobsZh": "劍士／騎士／十字軍",
       "affixLine": "對Boss/不死傷 +6%",
       "noteZh": "簡要取得與實碼特性說明",
       "socketRule": "白0 / 綠1 / 藍2 / 紫3 / 金4 洞（可精煉）",
       "dropSummary": "來源摘要",
       "stages": ["關卡中文名"],
       "sourceType": "mob | boss | story | season",
       "isCastleReward": false,
       "storyJobs": null,
       "live": { "atk": 47, "matk": 0, "def": 0, "atkQ2": 52, "matkQ2": 0, "atkQ4": 57, "matkQ4": 0 }
     }
     ```
     - 若為跨階掉落裝備加上 `"multiTier": true`；一次性劇情獎勵加上 `"isStoryOnce": true`。
     - 注意：`jobs: null` 代表全職業通用。
   - **卡片物件 (`RO_CATALOG.cards[]`) 關鍵欄位**：
     `id, mobId, nameZh, nameEn, mobZh, mobEn, bossRank (null|"mini"|"mvp"), compound ("weapon"|"shield"|"armor"|"garment"|"shoes"|"headgear"|"accessory"), slotZh, bonusText, stats[], dropStatus ("active"|"season"|"upcoming"), dropSummary, activeStages[]`。
   - **寵物物件 (`RO_CATALOG.pets[]`) 關鍵欄位**：
     `id, nameZh, nameEn, eggId, accId, accZh, accEn, fromId, fromZh, sourceCategory, obtainMethod, stages[], loyalText, maxText, neutralText, maxMult, stats[]`。
   - 若有舊裝備的 `jobs` 白名單或卡片的 `compound` 槽位在線上改動，同步修改並檢查 `sync/validate.js` 是否因此發現 `data/builds.js` 中有不合法的配裝或插卡（有則順手修正該處）。

2. **關卡／怪物／掉落 `M2` 異動 → 更新 `data/stages.js`**
   - 更新 `RO_STAGES.meta.version`（必須與線上版本完全一致，否則 `validate.js` 會報 `VERSION_MISMATCH`）與 `RO_STAGES.meta.note`。
   - **怪物掉落 (`RO_STAGES.monsters[mobId].drops`)**：直接填入線上 `M2` 實碼原始整數陣列 `[{ "id": 1202, "rate": 100 }, ...]`，`app.js` 會自動套用實碼加權抽樣公式計算實戰掉率。
   - **關卡物件 (`RO_STAGES.stages[]`)**：同步更新 `runLengthSec`, `jobCap`, `jobExp`, `gsMin`, `status ("playable"|"story_only"|"season"|"endless"|"upcoming")`, `storyNote`, `waves[]`, `bosses[]`。
   - 若怪物新增／改名／HP 或活動規則變更（例如節慶活動開關、扭蛋機率、特殊王出現率），同步更新 `monsters[mobId]`、`storyNote` 以及 `RO_CATALOG.items` 對應裝備的 `dropSummary`。

3. **一轉天賦／主動技異動 → 更新 `data/trees.js`**
   - 僅更新現行已實裝的 9 大一轉職系節點（`name`, `d1`, `dm`, `m`, `req`, `req2`, `r`, `c`）與 `RO_SKILLS` 定義（`id`, `name`, `desc`, `icon` 必須對應 `data/icons.js` 既有 `sk_*` Key）。
   - **切記**：若官方某次改版**正式開放二轉天賦樹與二轉主動技**（`last-diff.md` 會發出紅色警訊），先完成本流程的基礎資料同步，並在最後報告明確提醒使用者啟動 `meta/SOP.md` 全面改版規劃（不要在 `sync/` 階段未經評估就硬改 `validate.js` 放行）。

4. **版號、摘要與介面文字同步 → 更新 `index.html` 與 `data/builds.js`**
   - `data/builds.js`：更新最頂層 `RO_BUILDS.version`、`RO_BUILDS.buildHash`、`RO_BUILDS.updatedAt`（格式 `YYYY-MM-DD`），以及檔案第 1 行註解版號。
   - `index.html`：同步更新所有版號與建置碼（`<title>`、`.brand-sub`、`.banner-seal`、`.banner-meta`、`<footer>`）；若開放了新關卡，更新分頁 2 按鈕的 `.nav-badge` 關卡總數；若活動機率（如蛇王率、扭蛋率）異動，同步更新分頁 2 頂部 `.banner-text`。
   - 若線上 `vP` Bug 已被官方修復（`last-diff.md` 的「現行線上 `vP` 標籤異常雷達」顯示無異常），請在最終報告標記需立即執行 `meta/SOP.md` 調整受影響職系（如 `taekwon`）。

---

### Step 4：鎖定新快照並強制通過自動化驗收（順序極關鍵！）

> **順序警告**：`sync/validate.js` 會讀取 `sync/baseline.json` 交叉比對版本、`M2` 掉落表、裝備 `jobs` 白名單與卡片 `compound` 槽位。因此**必須先執行 `--update-baseline` 一次**（將基準更新到本次線上新版），**再執行 `node sync/validate.js`**！
> （`diff-live.js --update-baseline` 會先算完「舊版 → 新版」差異寫入 `last-diff.md`，再把新版寫入 `baseline.json`，所以只執行一次既保留差異紀錄又對齊最新快照。）

執行順序：
```powershell
node sync/diff-live.js --update-baseline
node sync/validate.js
```

**驗收標準：必須 `0 Errors` 且 `0 Warnings`（Exit Code 0）才算通過！**

#### 常見 `validate.js` 錯誤代碼速查與修法
| Error Code | 原因 | 修法 |
| :--- | :--- | :--- |
| `EMOJI_FORBIDDEN` | 網站檔案混入 Unicode Emoji | 移除所有 Emoji，改用純文字或 `data/icons.js` SVG |
| `UNIMPLEMENTED_T2_TREE` | `data/trees.js` 出現非 9 大一轉樹的鍵名 | 刪除未實裝二轉樹（除非官方已正式實裝並同步更新規則） |
| `VERSION_MISMATCH` | `data/stages.js` 的 `meta.version` 與 `baseline.json` 不同 | 對齊 `RO_STAGES.meta.version` 為最新線上版號 |
| `ITEM_NAME_MISMATCH` / `CARD_NAME_MISMATCH` / `CARD_MOB_NAME_MISMATCH` / `PET_NAME_MISMATCH` / `PET_ACC_NAME_MISMATCH` / `MONSTER_NAME_MISMATCH` / `STAGE_NAME_MISMATCH` / `JOB_NAME_MISMATCH` / `SKILL_NAME_MISMATCH` / `BRANCH_NAME_MISMATCH` / `TALENT_NAME_MISMATCH` | 任何裝備／卡片／寵物／寵飾／怪物／關卡／職業／主動技／天賦譯名與遊戲實碼繁中不一致 | **禁止自行另譯**！直接對齊 `sync/baseline.json` 對應的 `*NamesZh` 官方繁中譯名，並同步檢查 `data/builds.js` 攻略內文 |
| `M2_MISSING_MOB` / `M2_DROP_DIFF` | `data/stages.js` 怪物缺少或 `drops` 與線上 `M2` 不同 | 照 `last-diff.md` 或 `baseline.json.dropsM2` 精準補齊 `{id, rate}` |
| `WEAPON_ILLEGAL` / `GEAR_ILLEGAL` | 某流派配了該職業無法穿的裝備 | 更換 `data/builds.js` 該流派的合法裝備 ID，或核對 `catalog.js` |
| `CARD_WRONG_SLOT` / `PROSE_CARD_SLOT` | 卡片插槽與實碼 `compound` 不符，或文案寫錯槽位 | 核對 `baseline.json.cards[id].slot`（記住 `#4172` 紙妖卡片=武器 / `#4372` 白素貞卡片=頭飾 / `#4048` 毒魔菇卡片=飾品） |
| `SHIELD_WITH_2H` / `SHIELD_CARD_2H` | 雙手武器流派誤留盾牌或盾牌卡片 | 清空 `cardsBySlot.shield = []` 並移除 `gears` 中盾牌 |
| `TALENT_SUM_NOT_50` / `TALENT_REQ` / `TALENT_TIER` / `TALENT_SHIELD_DEAD` / `TALENT_WEAPON_MISMATCH` | 一轉 50 點天賦總點數、前置、層門檻或武器/盾鎖定衝突 | 修正該流派 `t1Plan.alloc` 與 `order`（若是因本次天賦改版造成，標記需進入 `meta/SOP.md`） |
| `PHYS_MAGIC_PET` / `PHYS_INT_CARD` | 純物理流派 (`INT=1`) 誤配法寵或純 INT 卡 | 換為物理／泛用寵物與卡片 |
| `OLD_DROP_FORMULA` | `app.js` 退回舊版循序掉落公式 | 保留 `mysteryDrop + dropSeeded` 加權抽樣公式 |

> 若修正後仍卡關且無法自行完成，請用 `git checkout -- sync/baseline.json` 還原基準快照並回報使用者受阻細節，切勿提交未過驗收的破損資料。

---

### Step 5：輕量載入冒煙檢查（變更關卡、結構或 UI 時執行）
如果本次更新有新增關卡、新增怪物、新增流派、或有動到 `index.html`／`app.js`，請用一段簡短 Node 腳本確認：
1. `data/icons.js`, `trees.js`, `catalog.js`, `stages.js`, `builds.js` 依序載入無錯誤。
2. 所有關卡 `waves[].pool`、`bosses[].id`、`summons[].id` 都存在於 `RO_STAGES.monsters`（零 undefined 怪物）。
3. 所有怪物 `drops[].id` 都存在於 `RO_CATALOG.items`，所有 `cardId` 存在於 `RO_CATALOG.cards`。

---

### Step 6：Git 提交推送與結構化交付報告

1. **檢查不應提交的殘留檔案**
   - 執行 `git status --short` 確認沒有多餘的測試／暫存腳本。
   - 確認沒有把本機路徑（如 `C:\Users\...`）寫入追蹤檔。
2. **UTF-8 安全 Commit & Push**（若使用者明確要求不要推 Git 則只做到 Commit 或留工作區）
   ```powershell
   $msg = @"
   同步線上版本：<舊版> -> <新版> (<buildHash>)

   - <摘要條列 1>
   - <摘要條列 2>
   - 通過 sync/validate.js 驗收 (0 Errors / 0 Warnings)
   "@
   $msgPath = Join-Path $env:TEMP 'rosurvivors_commit.txt'
   [System.IO.File]::WriteAllText($msgPath, $msg, (New-Object System.Text.UTF8Encoding($false)))
   git add -A
   git commit -F $msgPath
   Remove-Item $msgPath -ErrorAction SilentlyContinue
   if ($LASTEXITCODE -eq 0) { git push -u origin main }
   ```
   - 若 `git push` 因憑證或網路失敗，**不要嘗試繞過驗證**，直接回報本機 Commit Hash 與錯誤訊息請使用者自行推送。
3. **固定結果回報格式（讓使用者一眼看完）**
   回覆使用者時請使用精簡繁體中文，包含以下 5 個段落：
   - **版本變動**：`舊版本 (舊hash)` → `新版本 (新hash)`（若無變動直接寫「與線上完全一致，無須更新」）
   - **本次更新摘要**：條列實際更新了哪些資料與對應檔案（附 clickable `file:///` 連結）
   - **自動化驗收**：`sync/validate.js` 統計結果（確認 `0 Errors / 0 Warnings / 0 Emoji`）
   - **Git 狀態**：Branch、Commit Hash 與是否已成功推送至 GitHub
   - **是否需要啟動 `meta/` 流派審查**：
     - 若**不需要**：明確寫「本次改版未涉及技能／天賦／戰鬥公式異動，**無須啟動 `meta/` 流派分析**。」
     - 若**需要**：列出受影響職系與原因（例如 `taekwon` 修復 `vP` 標籤或某職系天賦數值更動），並直接附上一句使用者可原樣貼上的啟動指令：
       > 「請先閱讀 `meta/SOP.md`，針對 `<受影響職系>` 執行增量流派審查、更新 `data/builds.js` 與 `meta/T0_BUILDS.md`，通過 `sync/validate.js` 後推上 Git。」
