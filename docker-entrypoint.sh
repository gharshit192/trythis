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

YTDLP_URL="${YTDLP_URL:-https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp}"

refresh_ytdlp() {
  BEFORE="$($YTDLP_BIN --version 2>/dev/null || echo unknown)"
  echo "[entrypoint] yt-dlp before: $BEFORE"

  # Fetch the release binary rather than calling `yt-dlp -U`. Self-update is not
  # dependable: it refuses outright on pip-installed copies and exits non-zero,
  # which is indistinguishable from "already current" — a stale binary then sails
  # through looking updated. Downloading is unconditional and verifiable.
  #
  # Written to a temp path and only moved into place once it runs, so a truncated
  # or corrupt download can never replace a working binary.
  TMP="${TMPDIR:-/tmp}/yt-dlp.new"
  if timeout 90 wget -qO "$TMP" "$YTDLP_URL" && chmod +x "$TMP" && "$TMP" --version >/dev/null 2>&1; then
    mv "$TMP" "$YTDLP_BIN"
    AFTER="$($YTDLP_BIN --version 2>/dev/null || echo unknown)"
    if [ "$AFTER" = "$BEFORE" ]; then
      echo "[entrypoint] yt-dlp already current: $AFTER"
    else
      echo "[entrypoint] yt-dlp updated: $BEFORE -> $AFTER"
    fi
  else
    rm -f "$TMP"
    # Loud, because a stale extractor is invisible until every video silently
    # fails to download — which is exactly how this went unnoticed for months.
    echo "[entrypoint] WARNING: yt-dlp update FAILED — still running $BEFORE, video extraction may break"
  fi
}

# The refresh used to run BEFORE the server started, so every cold start on
# Render waited on a GitHub download (up to 90 s) before a single request could
# be answered. It now runs in the background; the baked-in binary serves any
# video job that arrives in the meantime.
if [ "${YTDLP_AUTO_UPDATE:-true}" = "true" ]; then
  refresh_ytdlp &
else
  echo "[entrypoint] yt-dlp auto-update disabled (YTDLP_AUTO_UPDATE=false)"
fi

exec "$@"
