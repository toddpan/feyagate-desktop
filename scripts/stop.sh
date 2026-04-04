#!/bin/bash
# FeyaGate Desktop — 关闭脚本 (macOS / Linux)
set -e

APP_NAME="FeyaGate Desktop"
PROCESS_NAME="miloco-mcp-server"
WAIT_TIMEOUT=10

echo "[INFO] 正在关闭 ${APP_NAME}..."

# 1) Gracefully quit the Electron app
case "$(uname)" in
  Darwin)
    if pgrep -f "${APP_NAME}" > /dev/null 2>&1; then
      osascript -e "tell application \"${APP_NAME}\" to quit" 2>/dev/null || true
      echo "[INFO] 已发送退出信号给 ${APP_NAME}"
    fi
    ;;
  Linux)
    ELECTRON_PIDS=$(pgrep -f "${APP_NAME}" 2>/dev/null || true)
    if [ -n "$ELECTRON_PIDS" ]; then
      echo "$ELECTRON_PIDS" | xargs -r kill -SIGTERM 2>/dev/null || true
      echo "[INFO] 已发送 SIGTERM 给 Electron 进程"
    fi
    ;;
esac

# 2) Wait for graceful shutdown
WAITED=0
while [ $WAITED -lt $WAIT_TIMEOUT ]; do
  if ! pgrep -f "${APP_NAME}" > /dev/null 2>&1 && ! pgrep -f "${PROCESS_NAME}" > /dev/null 2>&1; then
    echo "[OK] ${APP_NAME} 已完全关闭"
    exit 0
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

# 3) Force kill remaining processes
echo "[WARN] 等待超时，强制终止残留进程..."

SERVER_PIDS=$(pgrep -f "${PROCESS_NAME}" 2>/dev/null || true)
if [ -n "$SERVER_PIDS" ]; then
  echo "[INFO] 终止 MCP Server 进程: ${SERVER_PIDS}"
  echo "$SERVER_PIDS" | xargs -r kill -9 2>/dev/null || true
fi

ELECTRON_PIDS=$(pgrep -f "${APP_NAME}" 2>/dev/null || true)
if [ -n "$ELECTRON_PIDS" ]; then
  echo "[INFO] 终止 Electron 进程: ${ELECTRON_PIDS}"
  echo "$ELECTRON_PIDS" | xargs -r kill -9 2>/dev/null || true
fi

sleep 1

if ! pgrep -f "${APP_NAME}" > /dev/null 2>&1 && ! pgrep -f "${PROCESS_NAME}" > /dev/null 2>&1; then
  echo "[OK] 所有进程已终止"
else
  echo "[ERROR] 仍有残留进程，请手动检查: ps aux | grep -E '${APP_NAME}|${PROCESS_NAME}'"
  exit 1
fi
