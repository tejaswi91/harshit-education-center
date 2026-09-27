# syntax=docker/dockerfile:1

# ---- Build stage -------------------------------------------------------------
# Compiles the client bundle and the server, producing the two directories the
# runtime stage copies: client/dist and server/dist.
FROM node:22-alpine AS build
WORKDIR /app

# Manifests are copied on their own so `npm ci` is cached until a dependency
# actually changes, rather than being invalidated by unrelated source edits.
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage -----------------------------------------------------------
# Only production dependencies and the compiled output; no toolchain, no sources.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

# `config/paths.ts` resolves the upload directory relative to the server
# package, so locally stored material lives here. It must be writable by the
# unprivileged runtime user and is mounted as a volume in docker-compose.
RUN mkdir -p /app/server/uploads && chown -R node:node /app/server/uploads
USER node

EXPOSE 5000

# The app serves the API and the built client from one origin, so a single
# health probe covers both the process and its dependency on MongoDB.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form so the runtime sends SIGTERM to node directly and the graceful
# shutdown handler in server.ts gets a chance to drain in-flight requests.
CMD ["node", "server/dist/server.js"]