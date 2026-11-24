import { promises as fs } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiHandler, IGDB_RATE_LIMIT, KEEP_BACKUPS } from './api.ts';

let dir: string;
let server: Server;
let base: string;

const library = (titles: string[]) => ({
  version: 1,
  games: titles.map((title, index) => ({ id: `game-${index}-${title}`, title, list: 'owned', addedAt: '2026-01-01T00:00:00.000Z' })),
});
const put = (body: unknown, revision?: string | null) =>
  fetch(`${base}/api/games`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(revision && { 'If-Match': revision }) },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'xenonshelf-api-'));
  const dataFile = path.join(dir, 'games.json');
  await fs.writeFile(dataFile, JSON.stringify(library(['Halo 3'])));
  const handle = createApiHandler({ dataFile, env: () => ({}) });
  server = createServer((req, res) => void handle(req, res));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(dir, { recursive: true, force: true });
});

describe('/api/games revisions', () => {
  it('normalizes legacy Polish genre names on read and persists ids on the next save', async () => {
    const dataFile = path.join(dir, 'games.json');
    await fs.writeFile(
      dataFile,
      JSON.stringify({
        version: 1,
        games: [
          {
            id: 'legacy',
            title: 'Gra',
            list: 'owned',
            addedAt: '2026-01-01T00:00:00.000Z',
            genres: ['Strzelanka', 'Wyścigi', 'RPG'],
          },
        ],
      }),
    );
    const read = await fetch(`${base}/api/games`);
    const revision = read.headers.get('ETag');
    const payload = (await read.json()) as { games: { genres?: string[] }[] };
    expect(payload.games[0].genres).toEqual(['shooter', 'racing', 'rpg']);
    const saved = await put(
      {
        version: 1,
        games: [
          {
            id: 'legacy',
            title: 'Gra',
            list: 'owned',
            addedAt: '2026-01-01T00:00:00.000Z',
            genres: ['shooter', 'racing', 'rpg'],
          },
        ],
      },
      revision,
    );
    expect(saved.status).toBe(200);
    const stored = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    expect(stored.games[0].genres).toEqual(['shooter', 'racing', 'rpg']);
  });

  it('saves over the revision it was read at and hands back the next one', async () => {
    const read = await fetch(`${base}/api/games`);
    const first = read.headers.get('ETag');
    expect(first).toMatch(/^".+"$/);

    const saved = await put(library(['Halo 3', 'Fable II']), first);
    expect(saved.status).toBe(200);
    const second = saved.headers.get('ETag');
    expect(second).not.toBe(first);

    // The same page saving again carries on from the revision it was just given.
    expect((await put(library(['Halo 3', 'Fable II', 'Braid']), second)).status).toBe(200);
  });

  it('refuses a save from a page that missed a change made elsewhere', async () => {
    const stale = (await fetch(`${base}/api/games`)).headers.get('ETag');
    const other = (await fetch(`${base}/api/games`)).headers.get('ETag');
    expect((await put(library(['Halo 3', 'Fable II']), other)).status).toBe(200);

    const refused = await put(library(['Halo 3', 'Braid']), stale);
    expect(refused.status).toBe(409);
    // The other page's game is still there; nothing was overwritten.
    const titles = ((await (await fetch(`${base}/api/games`)).json()) as ReturnType<typeof library>).games.map((g) => g.title);
    expect(titles).toEqual(['Halo 3', 'Fable II']);
  });

  it('rejects incomplete or malformed library records before saving', async () => {
    expect((await put({ version: 1, games: [{ title: 'Broken' }] })).status).toBe(400);
    expect((await put({ version: 1, games: [{ ...library(['Halo 3']).games[0], myRating: 99 }] })).status).toBe(400);
    expect((await put({ version: 1, games: [{ ...library(['Halo 3']).games[0] }, { ...library(['Halo 3']).games[0] }] })).status).toBe(400);
  });

  it('lets a save without a revision through, as scripts send', async () => {
    expect((await put(library(['Braid']))).status).toBe(200);
  });
});

describe('IGDB request limits', () => {
  it('limits repeated proxy requests per client and tells the caller when to retry', async () => {
    const requests = await Promise.all(Array.from({ length: IGDB_RATE_LIMIT }, () => fetch(`${base}/api/igdb/search?q=Halo`)));
    expect(requests.every((response) => response.status === 503)).toBe(true);
    const limited = await fetch(`${base}/api/igdb/search?q=Halo`);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'igdbBusy' });
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});

describe('import endpoints', () => {
  const match = (body: unknown, method = 'POST') =>
    fetch(`${base}/api/igdb/match`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body),
    });

  it('takes a POST with 1 to 25 non-empty titles', async () => {
    expect((await match(null, 'GET')).status).toBe(405);
    expect((await match({ titles: [] })).status).toBe(400);
    expect((await match({ titles: ['Halo 3', ' '] })).status).toBe(400);
    expect((await match({ titles: Array(26).fill('Halo 3') })).status).toBe(400);
  });

  it('uses GET for search and game details', async () => {
    expect((await fetch(`${base}/api/igdb/search?q=Halo`, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`${base}/api/igdb/game?id=1`, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`${base}/api/igdb/games?ids=1`, { method: 'POST' })).status).toBe(405);
  });

  it('wants whole positive ids for game details', async () => {
    expect((await fetch(`${base}/api/igdb/games?ids=`)).status).toBe(400);
    expect((await fetch(`${base}/api/igdb/games?ids=1,x`)).status).toBe(400);
  });

  it('answers 503 without IGDB keys, so the page can import by title alone', async () => {
    const refused = await match({ titles: ['Halo 3'] });
    expect(refused.status).toBe(503);
    // A code the page words in its reader's language, not a sentence in the server's.
    expect(await refused.json()).toEqual({ error: 'igdbKeys' });
    expect((await fetch(`${base}/api/igdb/games?ids=1,2`)).status).toBe(503);
  });
});

describe('daily backups', () => {
  it('keeps the library as it was before the first save of each day, a month of them', async () => {
    const dataFile = path.join(dir, 'games.json');
    const backupDir = path.join(dir, 'backups');
    let day = new Date('2026-11-01T10:00:00Z');
    const handle = createApiHandler({ dataFile, env: () => ({}), backupDir, now: () => day });
    const local = createServer((req, res) => void handle(req, res));
    await new Promise<void>((resolve) => local.listen(0, resolve));
    const url = `http://localhost:${(local.address() as AddressInfo).port}/api/games`;
    const save = (titles: string[]) => fetch(url, { method: 'PUT', body: JSON.stringify(library(titles)) });

    try {
      await save(['Halo 3', 'Fable II']);
      await save(['Halo 3', 'Fable II', 'Braid']);
      // One copy for the day, holding the library from before its first save.
      expect(await fs.readdir(backupDir)).toEqual(['games-2026-11-01.json']);
      const kept = JSON.parse(await fs.readFile(path.join(backupDir, 'games-2026-11-01.json'), 'utf8'));
      expect(kept.games.map((g: { title: string }) => g.title)).toEqual(['Halo 3']);

      for (let i = 2; i <= KEEP_BACKUPS + 3; i++) {
        day = new Date(Date.UTC(2026, 10, i, 10));
        await save(['Halo 3']);
      }
      const names = (await fs.readdir(backupDir)).sort();
      expect(names).toHaveLength(KEEP_BACKUPS);
      expect(names[0]).toBe('games-2026-11-04.json');
    } finally {
      await new Promise((resolve) => local.close(resolve));
    }
  });
});
