# `meta/` — AI 數值分析師流派審查指南（極簡 SOP）

> **觸發條件**：**僅在 `sync/last-diff.md` 顯示「一轉天賦／主動技能／`vP` 標籤／二轉實裝狀態／超模新裝備卡」有變動時，才啟動本資料夾審查！** 一般修 Bug 或活動改版請直接略過以節省算力。

---

## 增量單職審查流程（節省 75%+ Token）

### Step 1：只跑受影響職系的數值速算
```bash
node meta/scan-meta.js --job <職系名稱>
# 例如：node meta/scan-meta.js --job taekwon
# 全部 9 大職系總檢：node meta/scan-meta.js
```
腳本會直接輸出該職系現行流派的實碼 `Ni` 倍率（`powerMelee / powerRanged / powerMagic / powerHybrid / basicPow`）、`vP` 標籤異常、與天賦核心引擎，不必重新讀完整遊戲原始碼。

### Step 2：以 RO Survivors 真實目標函數評定 T0
- 本遊戲核心為**限時 DPS 檢定**（白素貞 2 分鐘、無限塔每層 60 秒清 80% 怪分），**禁止憑 RO 原作印象推薦純奶／純坦為主推**。
- **核心公式提醒**：
  - `Ni(val, rank=2)` 為**三次方成長**（滿單屬 99 約 `54.2×`）。
  - 遠程公式：`atkRanged = 武ATK + STR + 3×DEX`（必主 DEX 副 STR）。
  - 混傷公式（`arcane_shot` / `fire_arrow`）：`powerHybrid = Ni(atkRanged + MATK)` **不除 2**（`DEX 99 / INT 80` 可衝至 `457×`）。
  - 普攻倍率受 `basicExp` 冪次影響（轉二轉 `+0.15`，盜賊短劍 `dagger` 最多 `+0.25`）。
  - **二轉未實裝期間，嚴禁推薦未開放的二轉技能與二轉天賦樹**。

### Step 3：五大 T0 引擎檢查
1. **升級倍率共享**（例：法師三導管火 18 / 冰 16 / 奧 16）。
2. **免費自動施放／不佔冷卻**（例：祭司《神聖審判》每 2s 瞬發完整聖光、弓手《齊射風暴》）。
3. **跨技能互減冷卻**（例：弓手奧火《奧術連發》-1.2s）。
4. **高倍普攻乘區**（例：盜賊《遊蕩暗影》2000% 三連跳＋《卸除鎧甲》+30%、劍士《狂暴》雙手劍常駐低血＋60% 流血）。
5. **跨系獨立標記乘區**（例：商人鍛造 34＋交易 16《撿便宜》雙標記＋無限塔免費濺射）。

### Step 4：更新與驗收
- 只修改受影響職業在 `data/builds.js` 的對應區塊與 `meta/T0_BUILDS.md`。
- 新推導流派一律先標 `verified: false`（`[實碼推算]`），待玩家實戰驗證後改為 `verified: true`（`[實戰驗證]`）。
- 修改完成必跑：
  ```bash
  node sync/validate.js
  ```
  確認 `0 Errors` 與 `0 Emoji` 才可交付。
