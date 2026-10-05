FROM node:20.19-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20.19-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/patches ./patches
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -q -O - http://127.0.0.1:3000/healthz || exit 1
CMD ["pnpm", "start"]
