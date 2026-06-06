# ── Stage 1: build whisper.cpp ───────────────────────────────────────────────
# Compiled separately so build tools don't bloat the final image.
FROM node:20-alpine AS whisper-builder

RUN apk add --no-cache git build-base cmake

RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp /tmp/wcpp \
 && cd /tmp/wcpp \
 && cmake -B build \
      -DCMAKE_BUILD_TYPE=Release \
      -DWHISPER_BUILD_TESTS=OFF \
      -DBUILD_SHARED_LIBS=OFF \
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
    tesseract-ocr tesseract-ocr-data-hin

# yt-dlp — official binary, avoids pip/managed-env issues on Alpine
RUN wget -qO /usr/local/bin/yt-dlp \
      https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp \
 && yt-dlp --version

# whisper-cli binary from the build stage
COPY --from=whisper-builder /usr/local/bin/whisper-cli /usr/local/bin/whisper-cli

# Download whisper tiny model (75 MB) — 4x faster than base, fits Render free tier.
# Base model times out at 5 min on constrained CPUs; tiny finishes in ~30s.
RUN mkdir -p /models \
 && wget -q --show-progress -O /models/ggml-tiny.bin \
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin" \
 && echo "whisper model downloaded: $(du -h /models/ggml-tiny.bin | cut -f1)"

# Tesseract needs TESSDATA_PREFIX to find language data on Alpine
ENV TESSDATA_PREFIX=/usr/share/tessdata
# Point the app at the baked-in model (can be overridden via env vars)
ENV WHISPER_MODEL=/models/ggml-tiny.bin

WORKDIR /app
COPY backend/package*.json ./
RUN npm install --legacy-peer-deps
COPY backend/src ./src
EXPOSE 4000
CMD ["node", "src/server.js"]
