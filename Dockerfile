# ==============================================================================
# SAFSEY IA - Dockerfile de production
# Compatible : Railway, Render, Fly.io, VPS Ubuntu
# ==============================================================================

# — Stage 1 : Dépendances npm —
FROM node:22-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# — Stage 2 : Build du frontend Vite —
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# En production same-domain, VITE_API_URL est vide -> chemins relatifs /api
ENV VITE_API_URL=""
RUN npm run build

# — Stage 3 : Image finale de production —
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copier uniquement ce qui est nécessaire au runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
COPY server ./server
COPY tsconfig.json ./
# Copier les logos Wave/Orange Money si présents
# COPY public ./public

EXPOSE 5000
CMD ["node", "server/index.js"]
