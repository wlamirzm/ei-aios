FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
COPY packages/web-ui/package.json packages/web-ui/tsconfig.json packages/web-ui/next.config.mjs packages/web-ui/tailwind.config.ts packages/web-ui/postcss.config.mjs ./packages/web-ui/
COPY packages/web-ui/public ./packages/web-ui/public
COPY packages/web-ui/src ./packages/web-ui/src

RUN npm install
RUN npm run build --workspace=@ei-aios/shared
RUN npm run build --workspace=@ei-aios/web-ui

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/packages/web-ui/.next/standalone ./
COPY --from=builder /app/packages/web-ui/.next/static ./packages/web-ui/.next/static
COPY --from=builder /app/packages/web-ui/public ./packages/web-ui/public

EXPOSE 3000

CMD ["node", "packages/web-ui/server.js"]
