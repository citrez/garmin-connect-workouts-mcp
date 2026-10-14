# Introspection only: browser login needs a graphical desktop.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
COPY scripts/build.mjs ./scripts/build.mjs
RUN npm run build

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package.json LICENSE ./
CMD ["node", "dist/cli.js"]
