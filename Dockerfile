FROM node:24-bookworm-slim AS build

WORKDIR /app

ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1 \
    WRANGLER_SEND_METRICS=false

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    WRANGLER_SEND_METRICS=false \
    WRANGLER_WRITE_LOGS=false

COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/.wrangler/state /app/.sites-runtime \
  && chown -R node:node /app/.wrangler /app/.sites-runtime

USER node

EXPOSE 3000
VOLUME ["/app/.wrangler/state"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok&&r.status!==302)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "scripts/docker-start.mjs"]
