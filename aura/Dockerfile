# Aura — Node 정적+Agent SDK 프록시 서버 (홈서버 Coolify 배포용)
FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json ./
# agent-sdk가 런타임에 spawn하는 네이티브 CLI 바이너리(alpine=musl 변종)는 필수라 명시 설치한다.
RUN npm install --omit=dev \
 && npm install --no-save --no-package-lock @anthropic-ai/claude-agent-sdk-linux-x64-musl@0.3.158

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S aura -u 1001
COPY --from=deps --chown=aura:nodejs /app/node_modules ./node_modules
COPY --chown=aura:nodejs server.js package.json ./
COPY --chown=aura:nodejs index.html style.css cityzen-ui.css cityzen-ui.js ./
COPY --chown=aura:nodejs src ./src
USER aura
EXPOSE 3000
CMD ["node", "server.js"]
