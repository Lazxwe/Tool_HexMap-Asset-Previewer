# 專案遷移與方案 A 網頁部署交接指引 (Handover & Deployment Guide)

> **本文件旨在提供專案遷移至 Git/GitHub 版本控制後的快速接軌步驟，以及如何順利執行「方案 A：靜態網頁託管」交付給美術團隊。**

---

## 1. 專案目前現況 (Project State Baseline)

* **技術棧**：TypeScript + Vite + HTML5 Canvas 2D + Vitest
* **介面狀態**：**已全面完成繁體中文化**（含工具列、按鈕、提示、側欄素材庫、註冊彈窗與底部狀態列）。
* **功能完整性**：**Release Candidate Ready**
  * 支援噪聲隨機地形生成（種子 / 尺度控制）。
  * 支援外部 JSON 地圖載入（含未知地形 Transactional 防禦與 Rollback）。
  * 支援 PNG 素材雙入口匯入（檔案選取器 + 畫布拖曳 Drag & Drop）。
  * 支援素材變體自動命名（`地形 N`）、多變體權重分配（含 `weight = 0` 停用）。
  * 支援種子隔離與變體重新隨機分配（`Reroll Assets` 絕不更動地形地貌）。
  * 支援畫布平滑縮放（以游標為錨點）、拖曳平移、一鍵重設視角置中。
  * 支援 Missing Asset 底色與文字標籤 Fallback 預覽。
* **驗證基準**：
  * Typecheck: `PASS` (`tsc --noEmit`)
  * Unit Tests: `PASS` (29 Test Files, 262 Tests 全部通過)
  * Production Build: `PASS` (`tsc && vite build`)

---

## 2. 專案檔案遷移與 Git 初始化步驟 (Migration Checklist)

當您將本專案複製到預計保管的目錄時，請遵循以下步驟：

### 步驟 2.1：複製專案檔案（乾淨遷移）
建議**不要複製**以下快取與暫存資料夾（體積龐大且會重新生成）：
* ❌ `node_modules/`
* ❌ `dist/`
* ❌ `src-tauri/target/`（若有）
* ❌ `.DS_Store`

專案根目錄中已具備標準 [.gitignore](file:///Users/lazxwe/Documents/GameDev/六角地圖編輯器/.gitignore)。

### 步驟 2.2：新目錄環境安裝與驗證
在新的專案目錄下開啟終端機，依序執行：

```bash
# 1. 安裝所有依賴
npm install

# 2. 執行型別檢查與測試確認無誤
npm run typecheck
npm test

# 3. 測試本機開發伺服器
npm run dev
```

### 步驟 2.3：初始化 Git 與推送到遠端（GitHub）

```bash
# 初始化 Git 倉庫
git init

# 加入所有檔案並進行第一次提交
git add .
git commit -m "feat: initial commit - hex terrain previewer RC baseline (zh-TW localized)"

# 關聯至 GitHub 遠端倉庫（請替換您的 GitHub Repo 網址）
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
git push -u origin main
```

---

## 3. 方案 A：靜態網頁託管部署指南 (Option A Deployment)

專案是 100% 純前端架構，無後端或資料庫，以下推薦三種最主流、全自動的部署途徑：

### 推薦途徑 1：GitHub Pages（最推薦，Push 即自動更新）

#### 步驟 A：確保 Vite 使用相對路徑
在 `vite.config.ts` 中加入 `base: './'`，確保在 GitHub Pages 子路徑下（`https://username.github.io/repo-name/`）資源路徑正常：

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // 確保靜態資源使用相對路徑
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
```

#### 步驟 B：建立 GitHub Actions 自動部署工作流
在專案中建立檔案 `.github/workflows/deploy.yml`：

```yaml
name: Deploy Web Previewer to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"

      - name: Install Dependencies
        run: npm ci

      - name: Run Tests
        run: npm test

      - name: Build Production Bundle
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload Pages Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: "./dist"

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

#### 步驟 C：啟用 GitHub Pages
1. 前往 GitHub Repo 網頁 ➔ **Settings** ➔ **Pages**。
2. 在 **Build and deployment** ➔ **Source** 選擇 **GitHub Actions**。
3. 只要 `git push origin main`，約 1 分鐘內就會自動部署完成，並在 Actions 頁面顯示專屬網址（例如 `https://username.github.io/hex-terrain-preview/`）。

---

### 推薦途徑 2：Cloudflare Pages / Vercel（免設定 YAML，點擊即發布）

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/) 或 [Vercel](https://vercel.com/)。
2. 點選 **Add New Project / Create Application** ➔ **Pages** ➔ **Connect to Git**。
3. 授權並選擇您的 GitHub 專案。
4. 設定建置參數：
   * **Framework Preset**：`Vite`
   * **Build Command**：`npm run build`
   * **Output Directory**：`dist`
5. 點擊 **Deploy**，即可獲得永久的免費 HTTPS 專屬網址。

---

### 推薦途徑 3：公司內網 / 本機手動發布

若地圖或素材有高度機密需求，不便使用公有雲：
1. 執行 `npm run build`。
2. 將產出的 `dist/` 資料夾內所有檔案直接上傳到公司內部 NAS、Web 伺服器，或使用 Nginx/Apache 託管。

---

## 4. 給美術同仁的快速上手說明 (Artist Quick Start Guide)

部署完成後，您可以直接將網址提供給美術，並附上這份超簡短說明：

> ### 🎨 六角地形地圖預覽器 - 快速操作指南
>
> 1. **打開網址**：使用 Chrome / Safari / Edge 開啟預覽器網址。
> 2. **生成或載入地圖**：
>    * 點擊上方「**生成地圖**」或 🎲 按鈕隨機生成大地圖。
>    * 或點擊「**JSON 檔案**」➔「**開啟地圖 JSON...**」載入企劃給的地圖檔。
> 3. **匯入自己的素材**：
>    * 直接將設計好的 **PNG 圖檔** 拖曳進畫布，或點擊「**匯入素材 PNG...**」。
>    * 在彈窗中選擇該圖檔所屬的地形類別（如「森林」、「水域」）與出現權重，點擊「**確認註冊**」。
> 4. **檢視與調整視覺效果**：
>    * **滾輪縮放 / 滑鼠拖曳**：檢視局部或整張大地圖效果。
>    * **重新分配素材（Reroll）**：點擊「重新分配素材」按鈕，可在**地貌完全不變**的情況下，重新抽樣變體分布。
>    * **右側素材庫**：可隨時調整每張圖片的出現權重（設為 `0` 可暫時停用該圖片）。
