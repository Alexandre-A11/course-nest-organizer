# Course Vault — single container running BOTH:
#   - Express API + LAN sync + media streaming on :8787
#   - Vite preview server (frontend) on :4173
#
# Build context MUST be the repository root so the frontend sources are visible.
# server/docker-compose.yml already does that ("context: ..").
#
# Build:  docker build -f server/Dockerfile -t course-vault .
# Run:    docker compose -f server/docker-compose.yml up -d

FROM node:20-bookworm-slim
WORKDIR /app

# Native build deps — better-sqlite3 compiles a C++ addon.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ---------- Frontend deps + build ----------
COPY package.json package-lock.json* bun.lockb* ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copy the rest of the repo (frontend sources + server/).
COPY . .

# Build the frontend bundle (Vite/TanStack Start).
RUN npm run build

# ---------- Backend deps (server/) ----------
# Install separately so server/node_modules has its own better-sqlite3 native build.
RUN cd server \
 && npm install --omit=dev --build-from-source --no-audit --no-fund

VOLUME ["/data", "/courses"]

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    COURSES_DIR=/courses

# 4173 = Vite preview (frontend), 8787 = Express API + streaming
EXPOSE 4173
EXPOSE 8787

# Runs both processes in parallel via concurrently (declared in root package.json).
CMD ["npm", "run", "start:all"]