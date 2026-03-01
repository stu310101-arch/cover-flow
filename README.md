# dress

這個 repo 是純靜態網站（HTML/CSS/JS），其中 **`dressup/` 是「換裝遊戲」**。

GitHub Pages 已設定為由 GitHub Actions 發佈，並且會把 **`dressup/` 當作網站根目錄**。

部署成功後網址：
- `https://stu310101-arch.github.io/dress/`

---

## 1) 更新網站（一定要 commit + push 才會自動部署）

只要你把修改 **commit + push** 到 GitHub（`main` 或 `master`），Actions 就會自動重新部署。

在本機 repo 目錄：

```bash
git status
git add -A
git commit -m "Update dressup"

git push origin main
# 或 git push origin master
```

也可以用 GitHub 網頁上傳檔案 / 編輯檔案後按 Commit，一樣會觸發部署。

> 我（AI）可以在這個環境把檔案改好，但**不能直接幫你 push 到你的 GitHub repo**（除非你另外提供可推送的 GitHub Token / 權限）。

---

## 2) 去哪裡看部署有沒有成功

GitHub repo → **Actions** → 點最新的 workflow run：
- 綠勾 = 成功
- 紅叉 = 失敗（點進去看 log）

repo → **Settings → Pages** 也會顯示目前 Pages 狀態與網址。

---

## 3) GitHub Pages 設定（必做）

repo → **Settings → Pages → Build and deployment**
- **Source：選 GitHub Actions**

---

## 4) 換裝遊戲資產對齊（很重要）

換裝是用「分層疊圖」做的。

### 最推薦做法（最不會跑位）
- 模特兒、上衣、下身、襪子、鞋子、飾品：
  - 全部都用**同一個畫布尺寸**（例如 600×800）
  - **透明背景**
  - 位置對齊一致（同一個原點）

### 如果你用的是「裁切很緊的小 PNG」
- 需要在 `dressup/manifest.json` 的每個 item 透過 `transform`（x/y/scale/rotate）微調位置。
