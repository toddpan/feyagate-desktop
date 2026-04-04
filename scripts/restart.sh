#!/bin/bash
# FeyaGate Desktop — 重启脚本 (macOS / Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "  FeyaGate Desktop 重启"
echo "========================================="

echo ""
echo "[1/2] 关闭应用..."
"$SCRIPT_DIR/stop.sh"

echo ""
echo "[2/2] 启动应用..."
sleep 1
"$SCRIPT_DIR/start.sh"

echo ""
echo "========================================="
echo "  重启完成"
echo "========================================="
