FROM node:24.22.0-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@12.14.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/document/package.json ./packages/document/package.json
COPY packages/editor/package.json ./packages/editor/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:24.22.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/apps/server/dist ./apps/server/dist
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/web/dist
USER node
EXPOSE 3000
CMD ["node", "apps/server/dist/index.mjs"]
