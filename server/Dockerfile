# Course Vault — optional LAN sync server.
# Build:  docker build -t course-vault-server .
# Run:    docker compose up -d
FROM node:20-bookworm-slim

# better-sqlite3 needs a C++ toolchain to compile native bindings.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first to leverage Docker layer cache.
COPY package.json ./
RUN npm install --omit=dev --build-from-source

# App source
COPY src ./src

# Persistent volumes mounted by docker-compose:
#   /data    — SQLite database
#   /courses — your course folders (read-only is fine)
VOLUME ["/data", "/courses"]

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    COURSES_DIR=/courses

EXPOSE 8787

CMD ["node", "src/index.js"]