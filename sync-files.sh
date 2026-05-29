#!/bin/bash
# Sync files between frontend-app (web) and frontend/src (mobile)
# Usage: ./sync-files.sh <file-path> [direction]
# direction: "to-mobile" (default), "to-web", or "both"

FILE="$1"
DIRECTION="${2:-both}"

if [ -z "$FILE" ]; then
  echo "Usage: ./sync-files.sh <file-path> [to-mobile|to-web|both]"
  exit 1
fi

# Map file paths
if [[ "$FILE" == "frontend-app/"* ]]; then
  # Source is web app
  WEB_FILE="$FILE"
  MOBILE_FILE="${FILE//frontend-app/frontend}"
  MOBILE_FILE="${MOBILE_FILE//\/src\//\/src\/}"
elif [[ "$FILE" == "frontend/"* ]]; then
  # Source is mobile app
  MOBILE_FILE="$FILE"
  WEB_FILE="${FILE//frontend/frontend-app}"
  WEB_FILE="${WEB_FILE//\/src\//\/src\/}"
else
  echo "Error: File must be in frontend/ or frontend-app/ directory"
  exit 1
fi

REPO_ROOT="/home/harshit-gupta/Harshit/TryThis"

case "$DIRECTION" in
  to-mobile)
    echo "Syncing $WEB_FILE → $MOBILE_FILE"
    cp "$REPO_ROOT/$WEB_FILE" "$REPO_ROOT/$MOBILE_FILE" || exit 1
    echo "✅ Synced to mobile"
    ;;
  to-web)
    echo "Syncing $MOBILE_FILE → $WEB_FILE"
    cp "$REPO_ROOT/$MOBILE_FILE" "$REPO_ROOT/$WEB_FILE" || exit 1
    echo "✅ Synced to web"
    ;;
  both)
    echo "Syncing $WEB_FILE ↔ $MOBILE_FILE"
    cp "$REPO_ROOT/$WEB_FILE" "$REPO_ROOT/$MOBILE_FILE" || exit 1
    echo "✅ Synced to mobile"
    ;;
  *)
    echo "Error: direction must be 'to-mobile', 'to-web', or 'both'"
    exit 1
    ;;
esac
