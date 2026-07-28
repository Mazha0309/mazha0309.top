# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM dependencies AS build
COPY . .
RUN npm run typecheck
RUN npm run test
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Shanghai \
    MEDIA_ROOT=/data/media \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN groupadd --system --gid 1001 mazha \
    && useradd --system --uid 1001 --gid mazha --create-home mazha \
    && mkdir -p /data/media \
    && chown -R mazha:mazha /data
COPY --from=build --chown=mazha:mazha /app/package.json /app/package-lock.json ./
# Better Auth declares drizzle-kit as an optional peer for its CLI. Runtime
# migrations use Better Auth's Kysely migrator, so omit that unused toolchain.
RUN npm ci --omit=dev --omit=peer \
    && rm -rf node_modules/drizzle-kit node_modules/@esbuild-kit node_modules/@drizzle-team/brocli \
    && npm cache clean --force
COPY --from=build --chown=mazha:mazha /app/build ./build
COPY --from=build --chown=mazha:mazha /app/drizzle ./drizzle
COPY --from=build --chown=mazha:mazha /app/scripts ./scripts
COPY --from=build --chown=mazha:mazha /app/app ./app
USER mazha
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=4s --start-period=25s --retries=4 \
  CMD node -e "fetch('http://127.0.0.1:3000/readyz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm", "run", "start"]
