# Étape 1 : Construction
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build 

# Étape 2 : Lancement
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copie uniquement les fichiers nécessaires
COPY --from=build /app/dist ./dist 
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 5000
CMD ["node", "dist/server/index.js"]
