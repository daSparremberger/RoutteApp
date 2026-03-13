FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @rotavans/shared build
RUN pnpm --filter web build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4173

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --prod --filter web...

COPY --from=build /app/apps/web/dist ./apps/web/dist

WORKDIR /app/apps/web
CMD ["pnpm", "preview", "--host", "0.0.0.0", "--port", "4173"]
