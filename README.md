# 植遇 · Zhiyu

一本关于身边植物的图鉴：251 种植物、花历与二十四番花信风、植物冷知识问答，拍照识别由 DeepSeek 提供。

## 结构

- `index.html` `styles.css` `app.js` `meta.js` `botany.js` `data.js` `config.js`：网页（发布在 GitHub Pages）
- `photos/`：植物照片，来自 Wikimedia Commons，作者与授权见每张图下方和「全部图片来源」
- `fonts/`：刊头字标用的 Shippori Mincho 子集（SIL Open Font License，见 `fonts/OFL-ShipporiMincho.txt`）
- `server.py`：识别接口。本地运行 `python3 server.py`；公开部署在阿里云函数计算（`s.yaml`）
- `_build/`：数据整理与照片挑选脚本

## 部署

```bash
./deploy.sh api   # 识别接口 → 阿里云函数计算（需要 .env 里的 ZHIYU_DEEPSEEK_KEY）
./deploy.sh web   # 网页 → GitHub Pages
```

公开接口限制：每个访客每天 5 次、全站每天 200 次（拍照识别和 AI 查询合计），在 `s.yaml` 的环境变量里调整。
