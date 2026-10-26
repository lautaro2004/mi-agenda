# Build desde la RAÍZ del repo:  docker build -f whatsapp-worker/Dockerfile .
# (en Railway: Root Directory = raíz del repo, Dockerfile Path = whatsapp-worker/Dockerfile)
FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts && npm i --no-save tsx@4 && npx prisma generate
COPY . .
ENV NODE_ENV=production \
    WHATSAPP_SESSIONS_DIR=/data/whatsapp-sessions
VOLUME ["/data"]
EXPOSE 8080
CMD ["npx", "tsx", "--tsconfig", "tsconfig.json", "whatsapp-worker/server.ts"]
