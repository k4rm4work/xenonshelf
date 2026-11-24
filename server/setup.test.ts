import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSetup } from './setup';

vi.mock('./igdb.ts', () => ({ igdbKeysWork: async (id: string) => id === 'good-id' }));

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

/** What a setup route answers: its status, or the reason it refused. */
type Reply = { firstRun?: boolean; igdb?: string; login?: string; user?: string; error?: string };
type Call = (method: string, route: string, body?: unknown) => Promise<{ status: number; body: Reply }>;

async function withSetup(
  env: Record<string, string>,
  run: (call: Call, configFile: string, setup: ReturnType<typeof createSetup>) => Promise<void>,
) {
  const dir = mkdtempSync(path.join(tmpdir(), 'xs-setup-'));
  dirs.push(dir);
  const configFile = path.join(dir, 'config.json');
  const setup = createSetup({ configFile, env });
  const server = createServer(async (req, res) => {
    if (!(await setup.handle(req, res))) res.end('other');
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, route: string, body?: unknown) => {
    const res = await fetch(base + route, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as Reply };
  };
  try {
    await run(call, configFile, setup);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('server setup from the app', () => {
  it('treats a missing config as a fresh install but refuses malformed or invalid config', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'xs-config-'));
    const file = path.join(dir, 'config.json');
    try {
      expect(createSetup({ configFile: file, env: {} }).login()).toBeUndefined();
      const { writeFileSync } = await import('node:fs');
      writeFileSync(file, '{broken');
      expect(() => createSetup({ configFile: file, env: {} })).toThrow(/Invalid JSON/);
      writeFileSync(file, JSON.stringify({ login: { user: 'shelf', password: { salt: 'bad', hash: 'bad' } } }));
      expect(() => createSetup({ configFile: file, env: {} })).toThrow(/login section is damaged/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('guides a fresh server, and stops once done', async () => {
    await withSetup({}, async (call) => {
      expect((await call('GET', '/api/setup')).body).toEqual({ firstRun: true, igdb: 'none', login: 'none' });
      expect((await call('POST', '/api/setup/done')).body.firstRun).toBe(false);
    });
  });

  it('keeps IGDB keys Twitch accepts, readable by the server alone, and never sends them back', async () => {
    await withSetup({}, async (call, configFile, setup) => {
      expect((await call('PUT', '/api/setup/igdb', { clientId: 'bad-id', clientSecret: 's' })).body).toEqual({ error: 'rejected' });
      expect((await call('PUT', '/api/setup/igdb', { clientId: '', clientSecret: 's' })).status).toBe(400);
      const saved = await call('PUT', '/api/setup/igdb', { clientId: ' good-id ', clientSecret: 'secret' });
      expect(saved.body).toMatchObject({ igdb: 'app', firstRun: false });
      expect(JSON.stringify(saved.body)).not.toContain('secret');
      expect(setup.igdbEnv()).toEqual({ clientId: 'good-id', clientSecret: 'secret' });
      if (process.platform !== 'win32') expect(statSync(configFile).mode & 0o777).toBe(0o600);
      expect((await call('DELETE', '/api/setup/igdb')).body.igdb).toBe('none');
    });
  });

  it('stores a login as a hash and turns it off again', async () => {
    await withSetup({}, async (call, configFile, setup) => {
      expect((await call('PUT', '/api/setup/login', { user: 'shelf', password: 'short' })).body).toEqual({ error: 'weak' });
      expect((await call('PUT', '/api/setup/login', { user: 'shelf', password: 'correct-horse-battery' })).body).toMatchObject({
        login: 'app',
        user: 'shelf',
      });
      expect(readFileSync(configFile, 'utf8')).not.toContain('correct-horse-battery');
      expect(setup.login()?.verify('correct-horse-battery')).toBe(true);
      expect((await call('DELETE', '/api/setup/login')).body.login).toBe('none');
      expect(setup.login()).toBeUndefined();
    });
  });

  it('leaves what the environment sets alone, and has nothing to guide through', async () => {
    const env = {
      IGDB_CLIENT_ID: 'env-id',
      IGDB_CLIENT_SECRET: 'env-secret',
      XENONSHELF_USER: 'shelf',
      XENONSHELF_PASSWORD: 'correct-horse-battery',
    };
    await withSetup(env, async (call, _file, setup) => {
      expect((await call('GET', '/api/setup')).body).toEqual({ firstRun: false, igdb: 'env', login: 'env', user: 'shelf' });
      expect((await call('PUT', '/api/setup/igdb', { clientId: 'good-id', clientSecret: 's' })).status).toBe(409);
      expect((await call('DELETE', '/api/setup/login')).status).toBe(409);
      expect(setup.igdbEnv().clientId).toBe('env-id');
    });
  });

  it('preserves concurrent changes to separate config sections', async () => {
    await withSetup({}, async (call, configFile) => {
      const [igdb, login, done] = await Promise.all([
        call('PUT', '/api/setup/igdb', { clientId: 'good-id', clientSecret: 'secret' }),
        call('PUT', '/api/setup/login', { user: 'shelf', password: 'correct-horse-battery' }),
        call('POST', '/api/setup/done'),
      ]);
      expect(igdb.status).toBe(200);
      expect(login.status).toBe(200);
      expect(done.status).toBe(200);
      expect(JSON.parse(readFileSync(configFile, 'utf8'))).toMatchObject({
        igdb: { clientId: 'good-id', clientSecret: 'secret' },
        login: { user: 'shelf' },
        setupDone: true,
      });
    });
  });

  it('reads what was saved when the server starts again', async () => {
    await withSetup({}, async (call, configFile) => {
      await call('PUT', '/api/setup/login', { user: 'shelf', password: 'correct-horse-battery' });
      const again = createSetup({ configFile, env: {} });
      expect(again.login()?.user).toBe('shelf');
    });
  });
});
