# Spend backend — production container (multi-stage, small final image)
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist ./dist

EXPOSE 4000
# Push the schema (idempotent) then start the API.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.js"]
