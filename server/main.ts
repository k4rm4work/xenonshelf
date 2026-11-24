// Production server for self-hosting: serves the built app and the library API.
// No dependencies beyond Node itself; run with `node server/main.ts` (Node 23.6+).
//
//   PORT          port to listen on (default 3000)
//   LIBRARY_FILE  games.json location (default data/games.json); seeded on first run
//   SEED_FILE     library copied to LIBRARY_FILE when it does not exist yet (default: empty)
//   IGDB_CLIENT_ID / IGDB_CLIENT_SECRET  enable the IGDB search (or set them in the app)
//   XENONSHELF_USER / XENONSHELF_PASSWORD  ask for a login (or set one in the app)
import { createReadStream, promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { createApiHandler, sendJson } from './api.ts';
import { createBasicAuth } from './auth.ts';
import { createSetup } from './setup.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 3000);
const LIBRARY_FILE = path.resolve(process.env.LIBRARY_FILE ?? path.join(ROOT, 'data/games.json'));
const SEED_FILE = path.resolve(process.env.SEED_FILE ?? path.join(ROOT, 'data/starter-library.json'));
// The settings made in the app live beside the library, in the same volume.
const setup = createSetup({ configFile: path.join(path.dirname(LIBRARY_FILE), 'config.json'), env: process.env });
const auth = createBasicAuth(setup.login);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// First start on an empty volume: begin with the seed, an empty library unless told otherwise.
try {
  await fs.access(LIBRARY_FILE);
} catch {
  await fs.mkdir(path.dirname(LIBRARY_FILE), { recursive: true });
  await fs.copyFile(SEED_FILE, LIBRARY_FILE);
  console.log(`Utworzono ${LIBRARY_FILE} z ${SEED_FILE}`);
}

// Saves write a temp file beside the library and rename it, so the folder must be writable.
// The Docker image sees to that itself (docker/entrypoint.sh); this catches the rest.
try {
  await fs.access(path.dirname(LIBRARY_FILE), fs.constants.W_OK);
  await fs.access(LIBRARY_FILE, fs.constants.W_OK);
} catch {
  console.error(
    `Brak prawa zapisu do ${path.dirname(LIBRARY_FILE)}: zmiany w kolekcji nie zapiszą się.
` + 'Nadaj folder z danymi użytkownikowi, który uruchamia serwer (w Dockerze: UID 1000).',
  );
}

const api = createApiHandler({
  dataFile: LIBRARY_FILE,
  env: setup.igdbEnv,
});

async function serveStatic(pathname: string, res: import('node:http').ServerResponse) {
  // Resolve inside dist only; anything escaping it (../) is treated as not found.
  const file = path.join(DIST, path.normalize(decodeURIComponent(pathname)));
  const target = file.startsWith(DIST + path.sep) ? file : path.join(DIST, 'index.html');
  let stat = await fs.stat(target).catch(() => null);
  let served = target;
  if (!stat || stat.isDirectory()) {
    // Hash routing: every page is index.html.
    served = path.join(DIST, 'index.html');
    stat = await fs.stat(served);
  }
  const ext = path.extname(served);
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  // Vite fingerprints assets, so they never change; the page itself must always be fresh.
  res.setHeader('Cache-Control', served.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
  createReadStream(served).pipe(res);
}

createServer(async (req, res) => {
  try {
    // Docker's health check: says only that the server runs, so it needs no login.
    if (req.url === '/api/health') return sendJson(res, 200, { ok: true });
    if (!auth.authorize(req, res)) return;
    if (await setup.handle(req, res)) return;
    if (await api(req, res)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method' });
    await serveStatic(new URL(req.url ?? '/', 'http://localhost').pathname, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: 'server' });
    else res.end();
  }
}).listen(PORT, () => {
  console.log(`Biblioteka Xbox 360: http://localhost:${PORT}  (dane: ${LIBRARY_FILE})`);
  console.log(
    auth.enabled
      ? 'Logowanie: włączone'
      : 'Uwaga: logowanie wyłączone (włączysz je w ustawieniach aplikacji); używaj wyłącznie w zaufanej sieci lub przez VPN.',
  );
});
