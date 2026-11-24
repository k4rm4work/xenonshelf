// Library API shared by the Vite dev server and the production server:
// reads/writes games.json and proxies IGDB search and game details.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { withGenreIds } from '../src/lib/genres.ts';
import { isValidLibrary } from '../src/lib/validateLibrary.ts';
import { fetchGameDetails, IgdbConfigError, matchTitles, searchXbox360Games } from './igdb.ts';

type Options = {
  dataFile: string;
  env: () => { clientId?: string; clientSecret?: string };
  /** Daily copies of the library go here; by default a backups folder beside it. */
  backupDir?: string;
  /** Today, for naming the day's copy; tests pass their own. */
  now?: () => Date;
};

/** How many daily copies are kept; the oldest go as new days come. */
export const KEEP_BACKUPS = 30;

const BACKUP_NAME = /^games-\d{4}-\d{2}-\d{2}\.json$/;

/** A game takes 1-2 KB, history included, so this holds tens of thousands of them; the
    app sends the whole library on every change and a save over the limit could never go
    through. Anything bigger is not a library. */
const MAX_BODY_BYTES = 50 * 1024 * 1024;

/** Each title takes IGDB a quarter of a second, so a match request stays a few seconds long. */
const MAX_MATCH_TITLES = 25;
const MAX_BATCH_IDS = 500;
const IGDB_RATE_WINDOW_MS = 60_000;
/** Generous enough for an import of a few hundred games, which asks once per ten titles. */
export const IGDB_RATE_LIMIT = 120;

class BodyTooLargeError extends Error {}

/** Names one exact state of the library file; sent as its ETag. */
const revisionOf = (text: string) => `"${createHash('sha1').update(text).digest('hex').slice(0, 16)}"`;

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(JSON.stringify(body));
}

/**
 * A failure as a short code the app puts in the reader's language (lib/apiError.ts); what
 * actually went wrong goes to the server's log.
 */
function sendFailure(res: ServerResponse, err: unknown, otherwise: 'igdbDown' | 'server') {
  if (err instanceof IgdbConfigError) return sendJson(res, 503, { error: 'igdbKeys' });
  if (err instanceof BodyTooLargeError) return sendJson(res, 413, { error: 'tooLarge' });
  if (err instanceof SyntaxError) return sendJson(res, 400, { error: 'invalid' });
  console.error(err);
  sendJson(res, otherwise === 'igdbDown' ? 502 : 500, { error: otherwise });
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BodyTooLargeError('Za duże dane');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Handles /api/* requests. Returns false for any other path so the caller can
 * serve it (static files in production, Vite in dev).
 */
export function createApiHandler({ dataFile, env, backupDir, now = () => new Date() }: Options) {
  const backups = backupDir ?? path.join(path.dirname(dataFile), 'backups');

  // The first save of a day keeps the library as it was before it, as games-YYYY-MM-DD.json,
  // so a bad change or a bad restore can be taken back to any of the last month's days.
  // A failed copy never stops the save.
  const keepDailyCopy = async () => {
    try {
      const name = `games-${now().toISOString().slice(0, 10)}.json`;
      await fs.mkdir(backups, { recursive: true });
      const existing = (await fs.readdir(backups)).filter((f) => BACKUP_NAME.test(f));
      if (existing.includes(name)) return;
      await fs.copyFile(dataFile, path.join(backups, name));
      const stale = [...existing, name].sort().slice(0, -KEEP_BACKUPS);
      await Promise.all(stale.map((old) => fs.rm(path.join(backups, old), { force: true })));
    } catch (err) {
      console.warn('Daily backup failed:', (err as Error).message);
    }
  };

  // Atomic write: a crash mid-save never leaves a half-written library.
  const writeLibrary = async (data: unknown) => {
    await keepDailyCopy();
    const text = JSON.stringify(data, null, 2) + '\n';
    const tmp = `${dataFile}.tmp`;
    const handle = await fs.open(tmp, 'w');
    try {
      await handle.writeFile(text, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, dataFile);
    return revisionOf(text);
  };

  // Bound per-client IGDB proxy use so an exposed instance cannot burn through the API quota.
  const igdbRequests = new Map<string, { count: number; resetAt: number }>();
  const allowIgdbRequest = (req: IncomingMessage, res: ServerResponse) => {
    const nowMs = Date.now();
    const key = req.socket.remoteAddress ?? 'unknown';
    let bucket = igdbRequests.get(key);
    if (!bucket || bucket.resetAt <= nowMs) {
      bucket = { count: 0, resetAt: nowMs + IGDB_RATE_WINDOW_MS };
      igdbRequests.set(key, bucket);
    }
    if (bucket.count >= IGDB_RATE_LIMIT) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - nowMs) / 1000))));
      sendJson(res, 429, { error: 'igdbBusy' });
      return false;
    }
    bucket.count += 1;
    if (igdbRequests.size > 1_000) {
      for (const [address, entry] of igdbRequests) if (entry.resetAt <= nowMs) igdbRequests.delete(address);
    }
    return true;
  };

  // Saves run one at a time, so two arriving together can't both pass the revision check.
  let saving: Promise<unknown> = Promise.resolve();
  const oneAtATime = <T>(task: () => Promise<T>): Promise<T> => {
    const run = saving.then(task, task);
    saving = run.catch(() => {});
    return run;
  };

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/api/games') {
      try {
        if (req.method === 'GET') {
          const text = await fs.readFile(dataFile, 'utf8');
          res.setHeader('ETag', revisionOf(text));
          // Read as the app stores it now: genres saved under their old Polish names come back as ids.
          sendJson(res, 200, withGenreIds(JSON.parse(text)));
        } else if (req.method === 'PUT') {
          const data = JSON.parse(await readBody(req));
          if (!isValidLibrary(data)) {
            sendJson(res, 400, { error: 'invalid' });
            return true;
          }
          // A save names the revision it started from (If-Match). If the file has changed
          // since, another tab or device saved in between: refuse rather than overwrite it.
          // Saves without If-Match (scripts, older pages) go through as before.
          const expected = req.headers['if-match'];
          const revision = await oneAtATime(async () => {
            if (expected && expected !== revisionOf(await fs.readFile(dataFile, 'utf8'))) return null;
            return writeLibrary(data);
          });
          if (!revision) sendJson(res, 409, { error: 'conflict' });
          else {
            res.setHeader('ETag', revision);
            sendJson(res, 200, { ok: true });
          }
        } else {
          sendJson(res, 405, { error: 'method' });
        }
      } catch (err) {
        sendFailure(res, err, 'server');
      }
      return true;
    }

    if (url.pathname.startsWith('/api/igdb/') && !allowIgdbRequest(req, res)) return true;

    if (url.pathname === '/api/igdb/search') {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'method' });
        return true;
      }
      const q = url.searchParams.get('q')?.trim();
      if (!q) {
        sendJson(res, 400, { error: 'invalid' });
        return true;
      }
      try {
        sendJson(res, 200, { results: await searchXbox360Games(q, env()) });
      } catch (err) {
        sendFailure(res, err, 'igdbDown');
      }
      return true;
    }

    if (url.pathname === '/api/igdb/game') {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'method' });
        return true;
      }
      const id = Number(url.searchParams.get('id'));
      if (!Number.isInteger(id) || id <= 0) {
        sendJson(res, 400, { error: 'invalid' });
        return true;
      }
      try {
        sendJson(res, 200, { details: (await fetchGameDetails([id], env())).get(id) ?? {} });
      } catch (err) {
        sendFailure(res, err, 'igdbDown');
      }
      return true;
    }

    // Details for many games at once, for an import: { details: { [igdbId]: IgdbDetails } }.
    if (url.pathname === '/api/igdb/games') {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'method' });
        return true;
      }
      const ids = (url.searchParams.get('ids') ?? '').split(',').map(Number);
      if (!ids.length || ids.length > MAX_BATCH_IDS || !ids.every((id) => Number.isInteger(id) && id > 0)) {
        sendJson(res, 400, { error: 'invalid' });
        return true;
      }
      try {
        sendJson(res, 200, { details: Object.fromEntries(await fetchGameDetails(ids, env())) });
      } catch (err) {
        sendFailure(res, err, 'igdbDown');
      }
      return true;
    }

    // Titles of an import matched against IGDB, a small batch per request so the page can
    // show progress: POST { titles: string[] } → { matches: TitleMatch[] }.
    if (url.pathname === '/api/igdb/match') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method' });
        return true;
      }
      try {
        const { titles } = JSON.parse(await readBody(req)) as { titles?: unknown };
        if (
          !Array.isArray(titles) ||
          !titles.length ||
          titles.length > MAX_MATCH_TITLES ||
          !titles.every((t) => typeof t === 'string' && t.trim())
        ) {
          sendJson(res, 400, { error: 'invalid' });
          return true;
        }
        sendJson(res, 200, {
          matches: await matchTitles(
            titles.map((t: string) => t.trim()),
            env(),
          ),
        });
      } catch (err) {
        sendFailure(res, err, 'igdbDown');
      }
      return true;
    }

    if (url.pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'notFound' });
      return true;
    }
    return false;
  };
}
