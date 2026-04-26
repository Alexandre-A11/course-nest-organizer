# Course Vault — single container that serves both the frontend build (static)
# and the LAN sync + media-streaming backend.
#
# Build context MUST be the repository root so the frontend sources are visible.
# docker-compose.yml in this folder already does that ("context: ..").
#
# Build:  docker build -f server/Dockerfile -t course-vault .
# Run:    docker compose -f server/docker-compose.yml up -d

# ---------- Stage 1: build the frontend (Vite/TanStack Start) ----------
FROM node:20-bookworm-slim AS frontend
WORKDIR /app

# Use bun if available, otherwise fall back to npm. The repo already includes
# package.json + bun.lockb / package-lock.json; npm works for both.
COPY package.json package-lock.json* bun.lockb* ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copy the rest of the frontend source and build a static SPA bundle.
COPY . .
# Build the frontend. The TanStack/Cloudflare preset can emit the static client
# bundle into one of several locations depending on plugin version:
#   dist/client/   (TanStack Start SSR layout)
#   dist/public/   (Cloudflare worker assets layout)
#   dist/          (plain Vite SPA layout)
# Normalise everything into /app/frontend-dist so the runtime stage has a
# single, predictable path to copy from.
RUN npm run build \
 && mkdir -p /app/frontend-dist \
 && if [ -f dist/client/index.html ]; then \
        cp -a dist/client/. /app/frontend-dist/; \
    elif [ -f dist/public/index.html ]; then \
        cp -a dist/public/. /app/frontend-dist/; \
    elif [ -f dist/index.html ]; then \
        cp -a dist/. /app/frontend-dist/; \
    else \
        echo "ERROR: could not locate built index.html under dist/. Contents:"; \
        ls -laR dist || true; \
        exit 1; \
    fi \
 && echo "Frontend bundle staged at /app/frontend-dist:" \
 && ls -la /app/frontend-dist

# ---------- Stage 2: build native deps + assemble runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# better-sqlite3 needs a C++ toolchain to compile native bindings.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Backend deps
COPY server/package.json ./
RUN npm install --omit=dev --build-from-source --no-audit --no-fund

# Backend source
COPY server/src ./src

# Static frontend bundle from the previous stage. The Vite/TanStack build
# layout varies between plugin versions, so the previous stage normalised the
# output into /app/frontend-dist. Copy that into /app/public; server/src/index.js
# auto-detects PUBLIC_DIR and serves it as the web app.
COPY --from=frontend /app/frontend-dist ./public

VOLUME ["/data", "/courses"]

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    COURSES_DIR=/courses \
    PUBLIC_DIR=/app/public

EXPOSE 8787

CMD ["node", "src/index.js"]