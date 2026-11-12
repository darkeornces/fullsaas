FROM node:24-alpine AS base
RUN npm i -g pnpm@11.22.0
WORKDIR /app
COPY package.json pnpm-lock.yaml ./

FROM base AS deps
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "server/index.ts"]
