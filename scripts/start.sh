#!/usr/bin/env bash
# 预览启动：构建后用 Vite preview（默认 4173）
set -euo pipefail
# shellcheck source=lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

PORT="${PORT:-4173}"
HOST="${HOST:-0.0.0.0}"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

ensure_node
ensure_deps

if port_in_use "$PORT"; then
  die "端口 $PORT 已被占用。可设置 PORT 换端口，或结束占用进程后重试。"
fi

log "构建生产产物…"
npm run build

log "启动预览服务 http://127.0.0.1:$PORT/"
log "日志：$LOG_DIR/preview.log"
log "停止：Ctrl+C"

npm run preview -- --host "$HOST" --port "$PORT" 2>&1 | tee "$LOG_DIR/preview.log"
