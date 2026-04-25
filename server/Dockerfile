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
# Force a static-only build: no SSR worker. Vite outputs to dist/.
RUN npm run build

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

# Static frontend bundle from the previous stage. We pick whichever folder
# the Vite/TanStack build produced (commonly dist/ or .output/public).
# At runtime, server/src/index.js auto-detects /app/public and serves it.
COPY --from=frontend /app/dist ./public

VOLUME ["/data", "/courses"]

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    COURSES_DIR=/courses \
    PUBLIC_DIR=/app/public

EXPOSE 8787

CMD ["node", "src/index.js"]