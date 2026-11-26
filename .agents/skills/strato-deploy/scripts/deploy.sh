#!/usr/bin/env bash
# Deploy Anni's public/ files to Strato production hosting.
# Usage:
#   .agents/skills/strato-deploy/scripts/deploy.sh            # deploy all public/ files (excluding config.local.php)
#   .agents/skills/strato-deploy/scripts/deploy.sh --dry-run  # show what would be deployed without uploading
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
ENV_FILE="$ROOT/.env"
REMOTE_DIR="/mnt/web009/c1/31/51555031/htdocs/anni"
SITE_URL="https://sv-bottrop21.de/anni"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env not found at $ENV_FILE" >&2
  exit 1
fi

# Read SSH credentials from .env
SSH_SERVER=$(grep -E '^SSH_SERVER=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]')
SSH_USER=$(grep -E '^SSH_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]')
SSH_PASSWORD=$(grep -E '^SSH_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]')

if [[ -z "$SSH_SERVER" || -z "$SSH_USER" || -z "$SSH_PASSWORD" ]]; then
  echo "Error: Missing SSH_SERVER, SSH_USER, or SSH_PASSWORD in .env" >&2
  exit 1
fi

TAR_FILE="/tmp/anni_deploy_$$.tar.gz"
trap 'rm -f "$TAR_FILE"' EXIT

# Package public/ while excluding local-only overrides
tar --no-xattrs --exclude='api/config.local.php' -czf "$TAR_FILE" -C "$ROOT/public" .

if $DRY_RUN; then
  echo "[dry-run] Would deploy archive ($(du -h "$TAR_FILE" | cut -f1)) to $SSH_USER@$SSH_SERVER:$REMOTE_DIR"
  tar -tzf "$TAR_FILE" | head -30
  exit 0
fi

echo "Uploading package to $SSH_SERVER..."
sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=no -o ConnectTimeout=15 \
  "$TAR_FILE" "$SSH_USER@$SSH_SERVER:anni_deploy.tar.gz"

sleep 2

echo "Extracting into $REMOTE_DIR..."
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 \
  "$SSH_USER@$SSH_SERVER" \
  "tar -xzf ~/anni_deploy.tar.gz -C '$REMOTE_DIR/' && rm -f ~/anni_deploy.tar.gz && echo 'DEPLOY_OK'"

echo "Smoke-checking $SITE_URL..."
for p in "" "app.js" "book.js" "book.json" "i18n.js" "styles.css" "api/index.php?a=me"; do
  code=$(curl -sS -m 10 -o /dev/null -w "%{http_code}" "$SITE_URL/$p")
  echo "  /$p -> HTTP $code"
  [[ "$code" == "200" ]] || { echo "Smoke check failed for /$p" >&2; exit 1; }
done

sec_code=$(curl -sS -m 10 -o /dev/null -w "%{http_code}" "$SITE_URL/api/config.local.php")
echo "  /api/config.local.php -> HTTP $sec_code (expected 403)"
[[ "$sec_code" == "403" ]] || echo "Warning: /api/config.local.php returned $sec_code" >&2

echo "Deployment complete."
