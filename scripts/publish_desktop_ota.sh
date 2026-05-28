#!/usr/bin/env bash
# Publish desktop installers + update fota.json
#
# This is a TEMPLATE. Adapt it to your own deployment.
# Run after `npm run dist:<platform>` so release/ has the artifacts.
#
# Required environment variables:
#   FEYAGATE_OTA_HOST       e.g. your-ota.example.com
#   FEYAGATE_OTA_USER       SSH user with write access to the OTA dir
#   FEYAGATE_OTA_REMOTE_DIR e.g. /var/www/feyagate-desktop/ota
#   FEYAGATE_OTA_BASE_URL   public URL prefix matching FEYAGATE_OTA_REMOTE_DIR
#
# Usage:
#   ./scripts/publish_desktop_ota.sh                    # version from package.json
#   ./scripts/publish_desktop_ota.sh 1.3.0 "notes"
#   ./scripts/publish_desktop_ota.sh 1.3.0 "notes" true # force update

set -euo pipefail

cd "$(dirname "$0")/.."

: "${FEYAGATE_OTA_HOST:?set FEYAGATE_OTA_HOST}"
: "${FEYAGATE_OTA_USER:?set FEYAGATE_OTA_USER}"
: "${FEYAGATE_OTA_REMOTE_DIR:?set FEYAGATE_OTA_REMOTE_DIR}"
: "${FEYAGATE_OTA_BASE_URL:?set FEYAGATE_OTA_BASE_URL}"

VERSION="${1:-$(node -p "require('./package.json').version")}"
NOTES="${2:-Routine update.}"
FORCE="${3:-false}"

echo "Publishing FeyaGate Desktop v${VERSION} to ${FEYAGATE_OTA_HOST}"

shopt -s nullglob
FILES=( release/FeyaGate-Desktop-${VERSION}-*.dmg \
        release/FeyaGate-Desktop-${VERSION}-*.exe \
        release/FeyaGate-Desktop-${VERSION}-*.zip \
        release/FeyaGate-Desktop-${VERSION}-*.AppImage \
        release/FeyaGate-Desktop-${VERSION}-*.deb )

if [ ${#FILES[@]} -eq 0 ]; then
  echo "no release artifacts for v${VERSION}; run 'npm run dist' first" >&2
  exit 1
fi

# Upload artifacts
rsync -avz --progress "${FILES[@]}" \
  "${FEYAGATE_OTA_USER}@${FEYAGATE_OTA_HOST}:${FEYAGATE_OTA_REMOTE_DIR}/"

# Generate fota.json from the artifacts
export FEYAGATE_VERSION="$VERSION"
export FEYAGATE_NOTES="$NOTES"
export FEYAGATE_FORCE="$FORCE"
node scripts/build-fota-manifest.mjs "${FILES[@]}" > fota.json
echo "Wrote fota.json:"
cat fota.json

# Upload manifest
rsync -avz fota.json \
  "${FEYAGATE_OTA_USER}@${FEYAGATE_OTA_HOST}:${FEYAGATE_OTA_REMOTE_DIR}/"

echo "Done. Public URL: ${FEYAGATE_OTA_BASE_URL%/}/fota.json"
