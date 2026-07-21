# ---- Base ----
FROM oven/bun:1 AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Build (generate Prisma client) ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# prisma.config.ts resolves DATABASE_URL eagerly even for `generate` (which
# doesn't actually connect to a DB, just parses schema) — a syntactically
# valid placeholder unblocks the build. The real connection string comes
# from docker-compose at runtime and never touches this build stage.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/placeholder?schema=public"

RUN bunx prisma generate

# ---- Production ----
FROM oven/bun:1-slim AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "src/server.ts"]