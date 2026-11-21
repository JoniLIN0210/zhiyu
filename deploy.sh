#!/bin/bash
# 植遇 · 部署脚本
#   ./deploy.sh api   → 把识别接口部署到阿里云函数计算（只上传 server.py 和 data.js）
#   ./deploy.sh web   → 把网页推送到 GitHub Pages
set -e
cd "$(dirname "$0")"
case "$1" in
  api)
    grep -qE "^ZHIYU_DEEPSEEK_KEY=.+" .env 2>/dev/null || { echo "缺少 Key：请在本目录的 .env 文件里，把 Key 粘贴在 ZHIYU_DEEPSEEK_KEY= 后面"; exit 1; }
    rm -rf fc && mkdir fc && cp server.py data.js fc/
    s deploy -y
    ;;
  web)
    git add -A && git commit -m "${2:-更新网页}" || true
    git push origin main
    ;;
  *) echo "用法：./deploy.sh api | web [提交说明]"; exit 1 ;;
esac
