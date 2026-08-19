# Stage 1: Build the React frontend
FROM node:22-slim AS frontend-build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

COPY apps/web/ apps/web/
COPY packages/shared/ packages/shared/
RUN npm run build --workspace packages/shared
RUN npm run build --workspace apps/web

# Stage 2: Build the Express backend
FROM node:22-slim AS backend-build

WORKDIR /app

# node:*-slim (Debian) omits OpenSSL, which the Prisma engine needs.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
RUN npm run build --workspace packages/shared
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
RUN npm run build --workspace packages/db
RUN npm run build --workspace apps/api

# Stage 3: Run both applications in one image
FROM node:22-slim AS production

WORKDIR /app

# node:*-slim (Debian) omits OpenSSL, which the Prisma engine needs at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci --omit=dev

COPY packages/db/ packages/db/
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

COPY --from=backend-build /app/packages/shared/dist/ packages/shared/dist/
COPY --from=backend-build /app/packages/db/dist/ packages/db/dist/
COPY --from=backend-build /app/apps/api/dist/ apps/api/dist/
COPY --from=frontend-build /app/apps/web/dist/ apps/api/frontend/

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node apps/api/dist/index.js"]
