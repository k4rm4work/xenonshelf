#!/bin/sh
# Starts the server as the unprivileged `node` user. Started as root (the default), it
# first hands the data folder to that user: a folder Docker creates for a bind mount
# belongs to root, and the app could not save into it. Started with --user, it just runs.
set -e

if [ "$(id -u)" = 0 ]; then
  mkdir -p /data
  find /data \( ! -user node -o ! -group node \) -exec chown node:node {} +
  exec su-exec node "$@"
fi
exec "$@"
