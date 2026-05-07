#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/liuguang/ai-film-prod}"
BRANCH="${BRANCH:-codex-premium-volcengine-deploy}"
PORT="${PORT:-3000}"
EXPECTED_COMMIT="${1:-${EXPECTED_COMMIT:-}}"
LOG_FILE="${LOG_FILE:-server.log}"

cd "$APP_DIR"

step() {
  printf '\n==> %s\n' "$1"
}

kill_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:${port}" | xargs -r kill -9 >/dev/null 2>&1 || true
  fi
}

stop_server() {
  kill_port "$PORT"
  kill_port 3001
  pkill -9 -f "[n]ode dist/index.js" >/dev/null 2>&1 || true
  pkill -9 -f "[p]npm start" >/dev/null 2>&1 || true
}

fetch_with_retry() {
  local attempts=5
  local delay=10
  for attempt in $(seq 1 "$attempts"); do
    if timeout 120 git fetch origin "$BRANCH:refs/remotes/origin/$BRANCH"; then
      return 0
    fi
    printf 'GitHub 拉取失败，%s 秒后重试 %s/%s\n' "$delay" "$attempt" "$attempts"
    sleep "$delay"
  done
  return 1
}

step "停止旧服务"
stop_server
sleep 2

step "备份服务器本地临时改动"
git stash push -u -m "server backup before deploy $(date +%Y%m%d-%H%M%S)" || true

step "拉取 GitHub 最新代码"
fetch_with_retry
git checkout -B "$BRANCH" "origin/$BRANCH"

step "确认代码版本"
current_commit="$(git rev-parse --short HEAD)"
git log --oneline -3
if [[ -n "$EXPECTED_COMMIT" && "$current_commit" != "$EXPECTED_COMMIT"* ]]; then
  printf '版本不对：当前是 %s，期望是 %s\n' "$current_commit" "$EXPECTED_COMMIT" >&2
  exit 1
fi

step "安装依赖"
pnpm install

step "迁移数据库"
pnpm exec drizzle-kit migrate

step "构建生产版本"
pnpm build

step "启动服务"
stop_server
rm -f "$LOG_FILE"
nohup env PORT="$PORT" STRICT_PORT=true NODE_ENV=production node dist/index.js > "$LOG_FILE" 2>&1 &
sleep 5

step "健康检查"
if ! curl -fsSI "http://127.0.0.1:${PORT}/" >/dev/null; then
  tail -80 "$LOG_FILE" || true
  exit 1
fi

if ss -lntp 2>/dev/null | grep -q ':3001'; then
  echo "警告：3001 仍有进程占用，正在清理。"
  kill_port 3001
fi

ss -lntp 2>/dev/null | grep ":${PORT}" || true
curl -I "http://127.0.0.1:${PORT}/"
tail -40 "$LOG_FILE"

printf '\n部署完成：%s，端口：%s\n' "$current_commit" "$PORT"
