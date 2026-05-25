FROM node:20-alpine

# yt-dlp is shelled out by fetchSystem + transcription services.
# - python3: required by yt-dlp's zipapp shebang
# - ffmpeg : audio mux/extract for whisper transcription path
# - ca-certificates: TLS for yt-dlp's HTTPS calls to YouTube/IG
# We download the official yt-dlp release directly (avoids Alpine's
# externally-managed-environment refusal that comes with `pip install`).
RUN apk add --no-cache python3 ffmpeg ca-certificates wget \
 && wget -qO /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp \
 && yt-dlp --version

WORKDIR /app
COPY backend/package*.json ./
RUN npm install --legacy-peer-deps
COPY backend/src ./src
EXPOSE 4000
CMD ["node", "src/server.js"]
