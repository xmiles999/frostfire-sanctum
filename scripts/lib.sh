#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf '[frostfire-sanctum] %s\n' "$*"; }
die() { printf '[frostfire-sanctum] ERROR: %s\n' "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令：$1"
}

ensure_node() {
  need_cmd node
  need_cmd npm
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [ "$major" -lt 20 ]; then
    die "需要 Node.js 20+，当前：$(node -v)"
  fi
}

ensure_deps() {
  if [ ! -f package.json ]; then
    die "未找到 package.json"
  fi
  if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    log "安装依赖…"
    npm install
  fi
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :$port" 2>/dev/null | tail -n +2 | grep -q .
    return $?
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  return 1
}
