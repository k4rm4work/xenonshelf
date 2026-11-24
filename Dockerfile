# Self-hosted Xbox 360 library: the built app plus a tiny Node server that
# stores the library on a volume and proxies IGDB search.

# The app is plain files, the same for every processor: built once, on the builder's own.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Editable build: the UI talks to the server's API instead of a baked-in snapshot.
RUN VITE_EDITABLE=true npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    LIBRARY_FILE=/data/games.json \
    SEED_FILE=/app/data/starter-library.json
# The server and scripts only use Node built-ins, so no node_modules at runtime.
COPY --from=build /app/dist ./dist
COPY server ./server
# Shared with the app: title matching, and the library check every save passes, with the
# types it reads its allowed values from. None of them import anything else.
COPY src/lib/genres.ts src/lib/titles.ts src/lib/validateLibrary.ts ./src/lib/
COPY src/types.ts ./src/types.ts
COPY scripts ./scripts
COPY data/starter-library.json ./data/starter-library.json
# The entrypoint makes the data folder the app's, then runs it as `node` (see the script).
RUN apk add --no-cache su-exec && mkdir -p /data && chown node:node /data
COPY docker/entrypoint.sh /usr/local/bin/xenonshelf-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/xenonshelf-entrypoint && chmod +x /usr/local/bin/xenonshelf-entrypoint
VOLUME /data
EXPOSE 3000
# /api/health answers without the login, so a server with one is still seen as healthy.
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
ENTRYPOINT ["xenonshelf-entrypoint"]
CMD ["node", "server/main.ts"]
