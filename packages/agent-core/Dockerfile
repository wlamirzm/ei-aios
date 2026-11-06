FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace and package manifests
COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
COPY packages/agent-core/package.json packages/agent-core/tsconfig.json ./packages/agent-core/
COPY packages/agent-core/src ./packages/agent-core/src

# Install dependencies and build shared and agent-core
RUN npm install
RUN npm run build --workspace=@ei-aios/shared
RUN npm run build --workspace=@ei-aios/agent-core

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/agent-core/package.json ./packages/agent-core/
COPY --from=builder /app/packages/agent-core/dist ./packages/agent-core/dist

EXPOSE 4000

CMD ["node", "packages/agent-core/dist/index.js"]

