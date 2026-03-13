FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/management-api/package.json services/management-api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages ./packages
COPY services/management-api ./services/management-api
RUN pnpm --filter @rotavans/shared build
RUN pnpm --filter management-api build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/management-api/package.json services/management-api/package.json
RUN pnpm install --frozen-lockfile --prod --filter management-api...

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/services/management-api/dist ./services/management-api/dist
COPY --from=build /app/services/management-api/src/db ./services/management-api/src/db

WORKDIR /app/services/management-api
CMD ["pnpm", "start"]
