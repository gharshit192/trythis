# ── Stage 1: build whisper.cpp ───────────────────────────────────────────────
# Compiled separately so build tools don't bloat the final image.
FROM node:20-alpine AS whisper-builder

RUN apk add --no-cache git build-base cmake

RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp /tmp/wcpp \
 && cd /tmp/wcpp \
 && cmake -B build -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_TESTS=OFF \
 && cmake --build build -j$(nproc) \
 && cp build/bin/whisper-cli /usr/local/bin/whisper-cli

# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM node:20-alpine

# System tools
# - python3      : required by yt-dlp zipapp shebang
# - ffmpeg       : audio mux/extract for whisper
# - tesseract-ocr: frame OCR for text overlays
# - ca-certificates, wget: TLS + downloads
RUN apk add --no-cache \
    python3 ffmpeg ca-certificates wget \
    tesseract-ocr tesseract-ocr-data-hin \
    libstdc++

# yt-dlp — official binary, avoids pip/managed-env issues on Alpine
RUN wget -qO /usr/local/bin/yt-dlp \
      https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp \
 && yt-dlp --version

# whisper-cli binary from the build stage
COPY --from=whisper-builder /usr/local/bin/whisper-cli /usr/local/bin/whisper-cli

# Download whisper base model (148 MB) at build time so it's baked into the
# image — no cold-start delay when the first reel comes in.
RUN mkdir -p /models \
 && wget -q --show-progress -O /models/ggml-base.bin \
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" \
 && echo "whisper model downloaded: $(du -h /models/ggml-base.bin | cut -f1)"

# Point the app at the baked-in model (can be overridden via Railway env vars)
ENV WHISPER_MODEL=/models/ggml-base.bin

WORKDIR /app
COPY backend/package*.json ./
RUN npm install --legacy-peer-deps
COPY backend/src ./src
EXPOSE 4000
CMD ["node", "src/server.js"]
