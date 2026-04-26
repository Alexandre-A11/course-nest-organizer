FROM node:20-bookworm-slim
WORKDIR /app

# Instala ferramentas essenciais para compilação do SQLite
RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential ca-certificates && rm -rf /var/lib/apt/lists/*

# Copia todos os ficheiros do projeto
COPY . .

# 1. Instala dependências da raiz e faz o build do Frontend
RUN npm install
RUN npm run build

# 2. Instala as dependências específicas do servidor backend
RUN cd server && npm install --omit=dev --build-from-source

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