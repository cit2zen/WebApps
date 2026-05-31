# ShopScout — Next.js 16 standalone (홈서버 Coolify 배포용)
# better-sqlite3(optionalDependency)는 SHOPSCOUT_STORE=memory에서 미사용 →
# --omit=optional 로 alpine 네이티브 컴파일을 생략한다.
FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --omit=optional 로 better-sqlite3(미사용)는 빼되, agent-sdk가 런타임에 spawn하는
# 네이티브 CLI 바이너리(alpine=musl 변종)는 필수라 명시 설치한다.
RUN npm ci --omit=optional \
 && npm install --no-save --no-package-lock @anthropic-ai/claude-agent-sdk-linux-x64-musl@0.3.158

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
# agent-sdk 네이티브 CLI(musl)는 런타임 동적 resolve라 standalone 트레이싱이 누락 → 명시 복사.
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64-musl ./node_modules/@anthropic-ai/claude-agent-sdk-linux-x64-musl
# 택소노미 데이터는 런타임에 process.cwd()/data 에서 읽는다(loader.ts) — standalone에 미포함이라 별도 복사.
COPY --from=build --chown=nextjs:nodejs /app/data ./data
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
