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

# `su-exec` lets the entrypoint start as root, fix the upload directory's
# ownership, and then drop to the unprivileged `node` user before exec'ing the
# server. It is far smaller than gosu and comes from Alpine's own repository.
RUN apk add --no-cache su-exec

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# `config/paths.ts` resolves the upload directory relative to the server
# package, so locally stored material lives here. It must be writable by the
# unprivileged runtime user and is mounted as a volume in docker-compose.
RUN mkdir -p /app/server/uploads && chown -R node:node /app/server/uploads

# The container deliberately starts as root so the entrypoint can hand the
# upload directory to the `node` user, which is what actually runs the server.
# Hosts that mount a volume here (Railway, docker-compose) mount it as root,
# so without this step the unprivileged process would hit EACCES on every
# upload. The entrypoint drops privileges again before exec'ing, so the app
# never runs as root.
USER root
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

EXPOSE 5000

# The app serves the API and the built client from one origin, so a single
# health probe covers both the process and its dependency on MongoDB.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form so the runtime sends SIGTERM to node directly and the graceful
# shutdown handler in server.ts gets a chance to drain in-flight requests.
# The entrypoint wraps this so the upload directory can be made writable first
# (see docker-entrypoint.sh) without giving the app itself root.
CMD ["node", "server/dist/server.js"]
