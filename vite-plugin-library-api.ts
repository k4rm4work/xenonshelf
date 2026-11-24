// Dev-only API: the shared library API mounted into the Vite dev server.
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { loadEnv, type Plugin } from 'vite';
import { createApiHandler } from './server/api.ts';
import { createSetup } from './server/setup.ts';

const DATA_FILE = path.resolve(__dirname, 'data/games.json');
const STARTER = path.resolve(__dirname, 'data/starter-library.json');
const CONFIG = path.resolve(__dirname, 'data/config.json');

export function libraryApi(): Plugin {
  let env: Record<string, string> = {};

  return {
    name: 'library-api',
    apply: 'serve',
    configResolved(config) {
      env = loadEnv(config.mode, config.root, ['IGDB_', 'XENONSHELF_']);
    },
    configureServer(server) {
      // A fresh clone has no library of its own yet: begin with an empty one.
      if (!existsSync(DATA_FILE)) copyFileSync(STARTER, DATA_FILE);

      // Saving games.json must not trigger a full page reload.
      server.watcher.unwatch(DATA_FILE);

      // The setup works here as on a server, the login apart: it isn't asked for while developing.
      const setup = createSetup({ configFile: CONFIG, env });
      const handle = createApiHandler({ dataFile: DATA_FILE, env: setup.igdbEnv });
      server.middlewares.use(async (req, res, next) => {
        if (!(await setup.handle(req, res)) && !(await handle(req, res))) next();
      });
    },
  };
}
