#!/bin/sh
# Container start-up: refresh yt-dlp, then hand off to the app.
#
# yt-dlp is the one dependency that expires on its own. Sites change their
# delivery, extractors break, and upstream ships a fix within days — but a Docker
# image installs whatever was current at build time and then keeps running it
# forever. Instagram changed in July 2026 and a months-old image returned "empty
# media response" for every single reel, with no code change to blame and nothing
# to trigger a rebuild.
#
# Strictly best-effort. A refresh failure (no network, GitHub down, read-only FS)
# must never stop the server from booting — the baked-in binary still works for
# everything that hasn't changed.

set -e

YTDLP_BIN="${YTDLP_BIN:-/usr/local/bin/yt-dlp}"

if [ "${YTDLP_AUTO_UPDATE:-true}" = "true" ]; then
  echo "[entrypoint] yt-dlp before: $($YTDLP_BIN --version 2>/dev/null || echo unknown)"
  # -U replaces the binary in place. Capped so a hung download can't stall boot.
  if timeout 60 "$YTDLP_BIN" -U --no-warnings >/dev/null 2>&1; then
    echo "[entrypoint] yt-dlp after:  $($YTDLP_BIN --version 2>/dev/null || echo unknown)"
  else
    echo "[entrypoint] yt-dlp self-update skipped (offline or already current) — continuing"
  fi
else
  echo "[entrypoint] yt-dlp auto-update disabled (YTDLP_AUTO_UPDATE=false)"
fi

exec "$@"
