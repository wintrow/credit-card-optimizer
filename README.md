# 信用卡回饋比較器（極簡版）

這個網站用來快速比較「同一筆消費」用哪張卡較划算，並集中顯示：

- 商家輸入/下拉選單後，各卡回饋試算
- 各卡優惠內容
- 機場接送規則
- 海外消費手續費
- 有效期限活動自動標註，過期自動移除

## 啟動方式

```bash
npm run serve
```

預設開在 [http://localhost:5173](http://localhost:5173)。

## 定期更新優惠（爬網頁）

```bash
npm run update:offers
```

此指令會做 3 件事：

1. 依 `data/cards.json` 內 `sourceUrls` 抓取最新頁面內容
2. 寫入 `data/snapshots/` 供後續人工複核
3. 自動移除已過期的 `benefits` 與 `merchantRewards`

## GitHub Pages（手機瀏覽）+ GitHub Actions（自動更新）

### 1) 第一次啟用 GitHub Pages

1. 進入 GitHub 專案 `Settings` -> `Pages`
2. `Build and deployment` 選 `GitHub Actions`
3. 之後每次 push 到 `main` 都會自動部署

### 2) 自動更新優惠資料（不需要開電腦）

- Workflow 檔案：`.github/workflows/update-offers.yml`
- 觸發方式：
  - 每天固定排程（UTC 00:15）
  - 手動觸發（`Actions` 頁面中的 `Run workflow`）
- 若 `data/cards.json` 或 `data/snapshots` 有變更，會自動 commit + push

### 3) 自動部署網站

- Workflow 檔案：`.github/workflows/deploy-pages.yml`
- 觸發方式：
  - push 到 `main` 自動部署
  - 可手動觸發

部署完成後，手機可直接開 GitHub Pages 網址瀏覽。

## Windows 本機排程（可選）

```powershell
schtasks /Create /SC DAILY /TN "CreditCardOfferUpdate" /TR "powershell -NoProfile -ExecutionPolicy Bypass -Command cd C:\Users\LENOVO\CursorExamples\credit-card-optimizer; npm run update:offers" /ST 08:00
```

## 資料可信度說明

- `sourceStatus = official`：來源頁可抓取並已整理
- `sourceStatus = partial`：來源頁有防爬（如 403）或暫時 unavailable，需人工再複核

美卡（Chase / BofA）目前可能受防爬限制，請定期人工確認官方頁變動。
