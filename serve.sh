#!/usr/bin/env bash
# 战队展示页 · 本地起服务（Linux / macOS）
# 用法： ./serve.sh        默认 8080
#        ./serve.sh 3000   指定端口
set -e
PORT="${1:-8080}"
cd "$(dirname "$0")"

echo ""
echo "  战队展示页 · 本地服务"
echo "  目录：$(pwd)"
echo "  地址：http://localhost:${PORT}"
echo "  停止：Ctrl + C"
echo ""

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT"
elif command -v node >/dev/null 2>&1; then
  exec npx --yes serve -l "$PORT" .
else
  echo "  没找到 python3 / python / node，装一个再运行。"
  exit 1
fi