#!/bin/sh
# Prepares the upload directory, then runs the server as the unprivileged
# `node` user.
#
# Volume-backed deployments (Railway, docker-compose) mount the volume as root,
# which overrides the ownership baked into the image at build time. An
# unprivileged process would then get EACCES the first time a teacher uploaded
# material. Railway documents `RAILWAY_RUN_UID=0` as the alternative, but that
# leaves the whole app running as root; doing the chown here keeps root confined
# to these few lines.
#
# A chown failure is logged and ignored rather than fatal: it means the platform
# is managing permissions itself, and the server should still get to start and
# report the real problem through the health check.
set -e

UPLOAD_DIR="${UPLOAD_DIR:-/app/server/uploads}"

if [ "$(id -u)" = "0" ]; then
  if mkdir -p "$UPLOAD_DIR" 2>/dev/null; then
    chown -R node:node "$UPLOAD_DIR" 2>/dev/null ||
      echo "entrypoint: could not chown $UPLOAD_DIR, continuing" >&2
  else
    echo "entrypoint: could not create $UPLOAD_DIR, continuing" >&2
  fi
  exec su-exec node "$@"
fi

# Already unprivileged (someone overrode the image's user); nothing to do.
exec "$@"
