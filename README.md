# coverflow-template

這個 repo 主要是靜態 HTML（含 `preview-heart/` 的 heart demo）。

## 1) 把修改 push 到 GitHub repo

如果這個資料夾已經是 Git repository（本 workspace 內已存在 `.git`），只需要設定 remote 並 push：

```bash
git status
git add -A
git commit -m "Update"

# 第一次推到 GitHub 時才需要 add remote
git remote add origin https://github.com/<OWNER>/<REPO>.git

# 推到預設分支（通常是 main 或 master；依你的 repo 預設分支調整）
git push -u origin main
# or
# git push -u origin master
```

## 2) 用 GitHub Pages 線上開啟 `preview-heart/`

本 repo 已新增 GitHub Actions workflow：`.github/workflows/pages.yml`

- 會把 `preview-heart/` 當作「靜態站點根目錄」發佈到 GitHub Pages（也就是 `preview-heart/index.html` 會變成網站的 `/index.html`）
- 觸發方式：
  - push 到 `main` 或 `master` 會自動部署
  - 也支援手動觸發（Actions → 選 workflow → Run workflow）

### 需要做的 GitHub 設定

到 GitHub repo：Settings → Pages → Build and deployment

- Source 請選 **GitHub Actions**（不是 Deploy from a branch）

### Pages URL

一般 repo（project pages）的 URL 會是：

- `https://<OWNER>.github.io/<REPO>/`

如果 repo 名稱剛好是 `<OWNER>.github.io`（user/organization pages），則 URL 會是：

- `https://<OWNER>.github.io/`

你也可以在 Actions workflow 跑完後，從 job 的輸出 `page_url` 取得實際網址。
