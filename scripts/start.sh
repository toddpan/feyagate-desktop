#!/bin/bash
# FeyaGate Desktop — 启动脚本 (macOS / Linux)
set -e

APP_NAME="FeyaGate Desktop"
PROCESS_NAME="miloco-mcp-server"

case "$(uname)" in
  Darwin)
    APP_PATH="/Applications/${APP_NAME}.app"
    if [ ! -d "$APP_PATH" ]; then
      APP_PATH="$HOME/Applications/${APP_NAME}.app"
    fi
    ;;
  Linux)
    APP_PATH=""
    for p in \
      "/usr/bin/feyagate-desktop" \
      "/opt/${APP_NAME}/feyagate-desktop" \
      "$HOME/Applications/FeyaGate_Desktop.AppImage" \
      "$HOME/.local/bin/FeyaGate_Desktop.AppImage"; do
      if [ -f "$p" ]; then
        APP_PATH="$p"
        break
      fi
    done
    ;;
esac

# Check for already-running Electron process
if pgrep -f "${APP_NAME}" > /dev/null 2>&1; then
  echo "[INFO] ${APP_NAME} 已在运行中"
  exit 0
fi

if [ -z "$APP_PATH" ] || { [ "$(uname)" = "Darwin" ] && [ ! -d "$APP_PATH" ]; } || { [ "$(uname)" != "Darwin" ] && [ ! -f "$APP_PATH" ]; }; then
  echo "[ERROR] 未找到 ${APP_NAME}，请先安装"
  echo "  macOS: 将应用拖到 /Applications"
  echo "  Linux: 安装 .deb 或将 .AppImage 放到 ~/Applications/"
  exit 1
fi

echo "[INFO] 启动 ${APP_NAME}..."

case "$(uname)" in
  Darwin)
    open -a "$APP_PATH"
    ;;
  Linux)
    nohup "$APP_PATH" > /dev/null 2>&1 &
    ;;
esac

sleep 2

if pgrep -f "${APP_NAME}" > /dev/null 2>&1; then
  echo "[OK] ${APP_NAME} 启动成功"
else
  echo "[WARN] ${APP_NAME} 可能未成功启动，请检查日志"
fi
