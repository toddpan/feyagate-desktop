#!/usr/bin/env bash
# FeyaGate Desktop OTA 发布脚本
# 将编译后的 DMG/ZIP/AppImage 上传到服务器并更新 fota.json 版本信息
#
# 用法:
#   ./publish_desktop_ota.sh                              # 使用 package.json 中的版本号
#   ./publish_desktop_ota.sh 1.1.0                        # 指定版本号
#   ./publish_desktop_ota.sh 1.1.0 "新增设备管理功能"       # 指定版本号和升级说明
#   ./publish_desktop_ota.sh 1.1.0 "紧急修复" true          # 强制升级
#   ./publish_desktop_ota.sh 1.1.0 "说明" false root host  # 全部参数

cleanup() {
    if [ -n "$SSH_MASTER_STARTED" ]; then
        echo "正在关闭SSH连接..."
        ssh -o ControlPath="$SSH_CONTROL_PATH" \
            -o HostKeyAlgorithms=+ssh-rsa,rsa-sha2-512,rsa-sha2-256,ecdsa-sha2-nistp256,ssh-ed25519 \
            -O exit "$REMOTE_USER@$REMOTE_HOST" 2>/dev/null
    fi
}
trap cleanup EXIT

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 从 package.json 获取当前版本号
if [ -f "package.json" ]; then
    CURRENT_VERSION=$(grep -m 1 '"version"' package.json | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    if [ -z "$CURRENT_VERSION" ]; then
        CURRENT_VERSION="1.0.0"
    fi
    echo "从 package.json 中提取的当前版本号: $CURRENT_VERSION"
else
    echo "警告: 无法找到 package.json 文件，将使用默认版本号"
    CURRENT_VERSION="1.0.0"
fi

# 检测当前平台和架构
detect_platform() {
    local os_name=$(uname -s)
    local arch=$(uname -m)

    case "$os_name" in
        Darwin) PLATFORM="mac" ;;
        Linux)  PLATFORM="linux" ;;
        *)      PLATFORM="win" ;;
    esac

    case "$arch" in
        x86_64|amd64) ARCH="x64" ;;
        arm64|aarch64) ARCH="arm64" ;;
        *)            ARCH="x64" ;;
    esac
}
detect_platform

# 可配置参数
VERSION="${1:-$CURRENT_VERSION}"
RELEASE_NOTES="${2:-}"
FORCE_UPDATE="${3:-false}"
REMOTE_USER="${4:-root}"
REMOTE_HOST="${5:-your-ota-server.example.com}"
REMOTE_PATH="/www/wwwroot/your-ota-server.example.com/ota"
REMOTE_OTA_DIR="$REMOTE_PATH/feyagate-desktop"
REMOTE_JSON_FILE="$REMOTE_PATH/fota.json"
LOCAL_JSON_FILE="fota.json"

FOTA_TYPE="feyagate-desktop-${PLATFORM}"
RELEASE_DIR="release"

SSH_CONFIG_DIR="$HOME/.ssh"
SSH_CONTROL_PATH="$SSH_CONFIG_DIR/control-%r@%h:%p"

echo "===== FeyaGate Desktop OTA 发布工具 ====="
echo "版本号: $VERSION"
echo "平台: $PLATFORM ($ARCH)"
echo "FOTA类型: $FOTA_TYPE"
echo "升级说明: ${RELEASE_NOTES:-无}"
echo "强制升级: $FORCE_UPDATE"
echo "远程服务器: $REMOTE_USER@$REMOTE_HOST"
echo "远程路径: $REMOTE_OTA_DIR"
echo ""

# 1. 查找发布文件
find_release_file() {
    case "$PLATFORM" in
        mac)
            RELEASE_FILE=$(ls -t "$RELEASE_DIR"/FeyaGate*Desktop*-${PLATFORM}-${ARCH}.dmg 2>/dev/null | head -1)
            if [ -z "$RELEASE_FILE" ]; then
                RELEASE_FILE=$(ls -t "$RELEASE_DIR"/*-${PLATFORM}-${ARCH}.dmg 2>/dev/null | head -1)
            fi
            RELEASE_EXT="dmg"
            ;;
        win)
            RELEASE_FILE=$(ls -t "$RELEASE_DIR"/FeyaGate*Desktop*.exe 2>/dev/null | head -1)
            RELEASE_EXT="exe"
            ;;
        linux)
            RELEASE_FILE=$(ls -t "$RELEASE_DIR"/FeyaGate*Desktop*.AppImage 2>/dev/null | head -1)
            RELEASE_EXT="AppImage"
            ;;
    esac
}
find_release_file

if [ -z "$RELEASE_FILE" ] || [ ! -f "$RELEASE_FILE" ]; then
    echo "错误: 找不到发布文件"
    echo "请先运行: npm run dist:${PLATFORM}"
    echo "查找路径: $RELEASE_DIR/"
    exit 1
fi

FILE_SIZE=$(stat -f%z "$RELEASE_FILE" 2>/dev/null || stat -c%s "$RELEASE_FILE" 2>/dev/null)
echo "发布文件: $(basename "$RELEASE_FILE")"
echo "文件大小: $((FILE_SIZE / 1024 / 1024)) MB"

# 2. 计算 MD5
if command -v md5sum &> /dev/null; then
    FILE_MD5=$(md5sum "$RELEASE_FILE" | awk '{print $1}')
elif command -v md5 &> /dev/null; then
    FILE_MD5=$(md5 -q "$RELEASE_FILE")
else
    echo "警告: 无法计算 MD5"
    FILE_MD5=""
fi
echo "MD5: $FILE_MD5"

# 3. 准备上传文件名
UPLOAD_NAME="FeyaGate-Desktop-v${VERSION}-${PLATFORM}-${ARCH}.${RELEASE_EXT}"
UPLOAD_PATH="/tmp/$UPLOAD_NAME"
cp "$RELEASE_FILE" "$UPLOAD_PATH"

if [ $? -ne 0 ]; then
    echo "错误: 无法复制文件"
    exit 2
fi
echo "上传文件名: $UPLOAD_NAME"

# 4. 建立 SSH 连接
echo ""
echo "正在建立SSH连接..."
mkdir -p "$SSH_CONFIG_DIR"

ssh -o ControlMaster=yes \
    -o ControlPath="$SSH_CONTROL_PATH" \
    -o ControlPersist=600 \
    -o HostKeyAlgorithms=+ssh-rsa,rsa-sha2-512,rsa-sha2-256,ecdsa-sha2-nistp256,ssh-ed25519 \
    "$REMOTE_USER@$REMOTE_HOST" "echo '连接成功'"

if [ $? -ne 0 ]; then
    echo "错误: 无法连接到远程服务器"
    exit 3
fi
SSH_MASTER_STARTED=1

SSH_HOST_OPTS="-o HostKeyAlgorithms=+ssh-rsa,rsa-sha2-512,rsa-sha2-256,ecdsa-sha2-nistp256,ssh-ed25519"

run_ssh() {
    ssh -o ControlMaster=no -o ControlPath="$SSH_CONTROL_PATH" $SSH_HOST_OPTS "$REMOTE_USER@$REMOTE_HOST" "$@"
}

run_scp() {
    scp -o ControlMaster=no -o ControlPath="$SSH_CONTROL_PATH" $SSH_HOST_OPTS "$@"
}

run_ssh "mkdir -p $REMOTE_OTA_DIR"

# 5. 上传发布文件
echo "正在上传发布文件到服务器..."
run_scp "$UPLOAD_PATH" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_OTA_DIR/"

if [ $? -ne 0 ]; then
    echo "错误: 文件上传失败"
    exit 4
fi
echo "文件上传成功!"

# 6. 生成新的下载 URL
NEW_URL="https://your-ota-server.example.com/ota/feyagate-desktop/$UPLOAD_NAME"

# 7. 更新远程 fota.json
echo ""
echo "正在更新远程版本信息..."
run_ssh "cd $REMOTE_PATH && [ -f fota.json ] && cp fota.json fota.json.bak"

if command -v jq &> /dev/null; then
    REMOTE_JSON=$(run_ssh "cat $REMOTE_JSON_FILE 2>/dev/null")

    if [ -n "$REMOTE_JSON" ]; then
        HAS_TYPE=$(echo "$REMOTE_JSON" | jq --arg type "$FOTA_TYPE" 'map(select(.type == $type)) | length')

        if [ "$HAS_TYPE" -gt 0 ]; then
            UPDATED_JSON=$(echo "$REMOTE_JSON" | jq \
                --arg ver "$VERSION" \
                --arg url "$NEW_URL" \
                --arg type "$FOTA_TYPE" \
                --arg md5 "$FILE_MD5" \
                --arg notes "$RELEASE_NOTES" \
                --argjson force "$FORCE_UPDATE" \
                --argjson size "$FILE_SIZE" \
                'map(if .type == $type then .version = $ver | .url = $url | .md5 = $md5 | .release_notes = $notes | .force_update = $force | .size = $size else . end)')
        else
            UPDATED_JSON=$(echo "$REMOTE_JSON" | jq \
                --arg ver "$VERSION" \
                --arg url "$NEW_URL" \
                --arg type "$FOTA_TYPE" \
                --arg md5 "$FILE_MD5" \
                --arg notes "$RELEASE_NOTES" \
                --argjson force "$FORCE_UPDATE" \
                --argjson size "$FILE_SIZE" \
                '. + [{"type": $type, "version": $ver, "url": $url, "md5": $md5, "release_notes": $notes, "force_update": $force, "size": $size}]')
        fi

        echo "$UPDATED_JSON" | run_ssh "cat > $REMOTE_JSON_FILE"
        echo "远程 fota.json 更新成功"
    else
        # No existing fota.json, create new
        NEW_JSON=$(jq -n \
            --arg ver "$VERSION" \
            --arg url "$NEW_URL" \
            --arg type "$FOTA_TYPE" \
            --arg md5 "$FILE_MD5" \
            --arg notes "$RELEASE_NOTES" \
            --argjson force "$FORCE_UPDATE" \
            --argjson size "$FILE_SIZE" \
            '[{"type": $type, "version": $ver, "url": $url, "md5": $md5, "release_notes": $notes, "force_update": $force, "size": $size}]')
        echo "$NEW_JSON" | run_ssh "cat > $REMOTE_JSON_FILE"
        echo "远程 fota.json 已创建"
    fi
else
    echo "警告: 未安装 jq, 请手动更新 fota.json"
    echo "  type: $FOTA_TYPE"
    echo "  version: $VERSION"
    echo "  url: $NEW_URL"
    echo "  md5: $FILE_MD5"
    echo "  release_notes: $RELEASE_NOTES"
    echo "  force_update: $FORCE_UPDATE"
    echo "  size: $FILE_SIZE"
fi

# 8. 同时更新本地 fota.json (用于版本追踪)
echo ""
echo "正在更新本地版本信息..."
if command -v jq &> /dev/null; then
    if [ -f "$LOCAL_JSON_FILE" ]; then
        TMP_JSON=$(mktemp)
        HAS_TYPE=$(cat "$LOCAL_JSON_FILE" | jq --arg type "$FOTA_TYPE" 'map(select(.type == $type)) | length')

        if [ "$HAS_TYPE" -gt 0 ]; then
            cat "$LOCAL_JSON_FILE" | jq \
                --arg ver "$VERSION" \
                --arg url "$NEW_URL" \
                --arg type "$FOTA_TYPE" \
                --arg md5 "$FILE_MD5" \
                --arg notes "$RELEASE_NOTES" \
                --argjson force "$FORCE_UPDATE" \
                --argjson size "$FILE_SIZE" \
                'map(if .type == $type then .version = $ver | .url = $url | .md5 = $md5 | .release_notes = $notes | .force_update = $force | .size = $size else . end)' > "$TMP_JSON"
        else
            cat "$LOCAL_JSON_FILE" | jq \
                --arg ver "$VERSION" \
                --arg url "$NEW_URL" \
                --arg type "$FOTA_TYPE" \
                --arg md5 "$FILE_MD5" \
                --arg notes "$RELEASE_NOTES" \
                --argjson force "$FORCE_UPDATE" \
                --argjson size "$FILE_SIZE" \
                '. + [{"type": $type, "version": $ver, "url": $url, "md5": $md5, "release_notes": $notes, "force_update": $force, "size": $size}]' > "$TMP_JSON"
        fi

        if [ $? -eq 0 ]; then
            mv "$TMP_JSON" "$LOCAL_JSON_FILE"
            echo "本地 fota.json 更新成功"
        else
            rm -f "$TMP_JSON"
        fi
    else
        jq -n \
            --arg ver "$VERSION" \
            --arg url "$NEW_URL" \
            --arg type "$FOTA_TYPE" \
            --arg md5 "$FILE_MD5" \
            --arg notes "$RELEASE_NOTES" \
            --argjson force "$FORCE_UPDATE" \
            --argjson size "$FILE_SIZE" \
            '[{"type": $type, "version": $ver, "url": $url, "md5": $md5, "release_notes": $notes, "force_update": $force, "size": $size}]' > "$LOCAL_JSON_FILE"
        echo "本地 fota.json 已创建"
    fi
fi

# 9. 验证远程文件
echo ""
echo "===== 验证远程文件 ====="
echo "远程发布文件:"
run_ssh "ls -lh $REMOTE_OTA_DIR/$UPLOAD_NAME"
echo ""
echo "远程 fota.json 内容:"
run_ssh "cat $REMOTE_JSON_FILE" | jq . 2>/dev/null || run_ssh "cat $REMOTE_JSON_FILE"

echo ""
echo "===== 发布完成 ====="
echo "本地文件: $RELEASE_FILE"
echo "远程文件: $REMOTE_OTA_DIR/$UPLOAD_NAME"
echo "下载地址: $NEW_URL"
echo "新版本号: $VERSION"
echo "平台: $PLATFORM ($ARCH)"
echo "MD5: $FILE_MD5"
echo "文件大小: $((FILE_SIZE / 1024 / 1024)) MB"
echo "升级说明: ${RELEASE_NOTES:-无}"
echo "强制升级: $FORCE_UPDATE"

# 清理临时文件
rm -f "$UPLOAD_PATH"
