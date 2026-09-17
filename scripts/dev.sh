#!/usr/bin/env bash
# 开发启动：检查依赖后启动 Vite（默认 5173）
set -euo pipefail
# shellcheck source=lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

PORT="${PORT:-5173}"
HOST="${HOST:-0.0.0.0}"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

ensure_node
ensure_deps

if port_in_use "$PORT"; then
  die "端口 $PORT 已被占用。可设置 PORT 换端口，或结束占用进程后重试。"
fi

log "启动开发服务 http://127.0.0.1:$PORT/"
log "日志：$LOG_DIR/dev.log"
log "停止：Ctrl+C"

npm run dev -- --host "$HOST" --port "$PORT" 2>&1 | tee "$LOG_DIR/dev.log"
