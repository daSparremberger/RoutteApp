FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/app-api/package.json services/app-api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages ./packages
COPY services/app-api ./services/app-api
RUN pnpm --filter @rotavans/shared build
RUN pnpm --filter app-api build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/app-api/package.json services/app-api/package.json
RUN pnpm install --frozen-lockfile --prod --filter app-api...

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/services/app-api/dist ./services/app-api/dist
COPY --from=build /app/services/app-api/src/db ./services/app-api/src/db

WORKDIR /app/services/app-api
CMD ["pnpm", "start"]
