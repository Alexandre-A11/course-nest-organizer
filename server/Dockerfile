FROM node:20-bookworm-slim
WORKDIR /app

# Instala ferramentas essenciais para compilação do SQLite + Bun
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

# Instala o Bun globalmente (gestor de pacotes do frontend)
RUN npm install -g bun

# Copia todos os ficheiros do projeto
COPY . .

# 1. Instala dependências da raiz com Bun e faz o build do Frontend
RUN bun install
RUN bun run build

# 2. Instala as dependências específicas do servidor backend
#    Usa npm aqui para que o better-sqlite3 compile corretamente a partir do source
RUN cd server && npm install --build-from-source

# Expõe as portas de ambos os serviços
EXPOSE 4173
EXPOSE 8787

# Define volumes para persistência
VOLUME ["/data", "/courses"]

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    COURSES_DIR=/courses

# Comando para iniciar os dois servidores simultaneamente via concurrently
CMD ["npm", "run", "start:all"]