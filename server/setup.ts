// The server's own settings, made in the app instead of a file: the IGDB keys and the
// login. They are kept in config.json beside the library, readable by the server alone.
// Values set in the environment (.env.local) win and can't be changed from the app.
import { readFileSync, promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from './api.ts';
import { envLogin, hashPassword, loginProblem, storedLogin, type Login, type StoredPassword } from './auth.ts';
import { igdbKeysWork } from './igdb.ts';

export type ServerConfig = {
  igdb?: { clientId: string; clientSecret: string };
  login?: { user: string; password: StoredPassword };
  /** The first-run guide was finished or skipped; it isn't offered again. */
  setupDone?: boolean;
};

type Source = 'env' | 'app' | 'none';

/** What the app is told: where each setting comes from, never the secrets themselves. */
export type SetupStatus = { firstRun: boolean; igdb: Source; login: Source; user?: string };

type Env = {
  IGDB_CLIENT_ID?: string;
  IGDB_CLIENT_SECRET?: string;
  XENONSHELF_USER?: string;
  XENONSHELF_PASSWORD?: string;
};

const MAX_BODY = 4096;

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > MAX_BODY) throw new SyntaxError('Za duże dane');
  }
  const data: unknown = JSON.parse(text || '{}');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new SyntaxError('Oczekiwano obiektu');
  return data as Record<string, unknown>;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function readConfig(file: string): ServerConfig {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error('Nie można odczytać konfiguracji ' + file + '; serwer nie uruchomi się bezpiecznie.', { cause: err });
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    throw new Error('Nieprawidłowy JSON w ' + file + '; napraw lub przywróć konfigurację.', { cause: err });
  }
  const object = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
  if (!object(value)) throw new Error('Nieprawidłowa konfiguracja ' + file + ': oczekiwano obiektu.');
  if (value.setupDone !== undefined && typeof value.setupDone !== 'boolean') {
    throw new Error('Nieprawidłowa konfiguracja ' + file + ': setupDone musi być wartością logiczną.');
  }
  if (
    value.igdb !== undefined &&
    (!object(value.igdb) ||
      typeof value.igdb.clientId !== 'string' ||
      !value.igdb.clientId.trim() ||
      typeof value.igdb.clientSecret !== 'string' ||
      !value.igdb.clientSecret.trim())
  ) {
    throw new Error('Nieprawidłowa konfiguracja ' + file + ': sekcja igdb jest uszkodzona.');
  }
  if (value.login !== undefined) {
    const login = value.login;
    if (
      !object(login) ||
      typeof login.user !== 'string' ||
      !login.user.trim() ||
      login.user.includes(':') ||
      !object(login.password) ||
      typeof login.password.salt !== 'string' ||
      !/^[a-f0-9]{32}$/i.test(login.password.salt) ||
      typeof login.password.hash !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(login.password.hash)
    )
      throw new Error('Nieprawidłowa konfiguracja ' + file + ': sekcja login jest uszkodzona; logowanie nie zostanie wyłączone.');
  }
  return value as ServerConfig;
}

export function createSetup({ configFile, env }: { configFile: string; env: Env }) {
  let config = readConfig(configFile);
  const fromEnv = envLogin(env.XENONSHELF_USER, env.XENONSHELF_PASSWORD);
  let fromApp: Login | undefined = config.login && storedLogin(config.login.user, config.login.password);
  const igdbFromEnv = !!(env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET);

  // Serialize config changes and derive each from the latest value to avoid lost updates.
  let saving: Promise<void> = Promise.resolve();
  const save = (change: (current: ServerConfig) => ServerConfig): Promise<void> => {
    const run = saving.then(async () => {
      const next = change(config);
      const tmp = configFile + '.' + process.pid + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
      await fs.chmod(tmp, 0o600);
      await fs.rename(tmp, configFile);
      config = next;
      fromApp = next.login && storedLogin(next.login.user, next.login.password);
    });
    saving = run.catch(() => {});
    return run;
  };

  const status = (): SetupStatus => {
    const igdb: Source = igdbFromEnv ? 'env' : config.igdb ? 'app' : 'none';
    const login: Source = fromEnv ? 'env' : config.login ? 'app' : 'none';
    // A server set up by hand (keys in .env.local) has nothing left to guide through.
    return { firstRun: !config.setupDone && igdb === 'none' && login === 'none', igdb, login, user: (fromEnv ?? fromApp)?.user };
  };

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/setup')) return false;
    const route = `${req.method} ${url.pathname}`;
    try {
      if (route === 'GET /api/setup') return (sendJson(res, 200, status()), true);

      if (route === 'PUT /api/setup/igdb') {
        if (igdbFromEnv) return (sendJson(res, 409, { error: 'env' }), true);
        const body = await readJson(req);
        const clientId = text(body.clientId);
        const clientSecret = text(body.clientSecret);
        if (!clientId || !clientSecret) return (sendJson(res, 400, { error: 'missing' }), true);
        let works: boolean;
        try {
          works = await igdbKeysWork(clientId, clientSecret);
        } catch {
          return (sendJson(res, 502, { error: 'unreachable' }), true);
        }
        if (!works) return (sendJson(res, 400, { error: 'rejected' }), true);
        await save((current) => ({ ...current, igdb: { clientId, clientSecret } }));
        return (sendJson(res, 200, status()), true);
      }

      if (route === 'DELETE /api/setup/igdb') {
        if (igdbFromEnv) return (sendJson(res, 409, { error: 'env' }), true);
        await save((current) => {
          const { igdb: _igdb, ...rest } = current;
          return rest;
        });
        return (sendJson(res, 200, status()), true);
      }

      if (route === 'PUT /api/setup/login') {
        if (fromEnv) return (sendJson(res, 409, { error: 'env' }), true);
        const body = await readJson(req);
        const user = text(body.user);
        const password = typeof body.password === 'string' ? body.password : '';
        if (loginProblem(user, password)) return (sendJson(res, 400, { error: 'weak' }), true);
        await save((current) => ({ ...current, login: { user, password: hashPassword(password) } }));
        return (sendJson(res, 200, status()), true);
      }

      if (route === 'DELETE /api/setup/login') {
        if (fromEnv) return (sendJson(res, 409, { error: 'env' }), true);
        await save((current) => {
          const { login: _login, ...rest } = current;
          return rest;
        });
        return (sendJson(res, 200, status()), true);
      }

      if (route === 'POST /api/setup/done') {
        await save((current) => ({ ...current, setupDone: true }));
        return (sendJson(res, 200, status()), true);
      }

      sendJson(res, 404, { error: 'notFound' });
    } catch (err) {
      if (!(err instanceof SyntaxError)) console.error(err);
      sendJson(res, err instanceof SyntaxError ? 400 : 500, { error: err instanceof SyntaxError ? 'invalid' : 'server' });
    }
    return true;
  };

  return {
    handle,
    /** Keys for IGDB: from the environment, else those set in the app. */
    igdbEnv: () =>
      igdbFromEnv
        ? { clientId: env.IGDB_CLIENT_ID, clientSecret: env.IGDB_CLIENT_SECRET }
        : { clientId: config.igdb?.clientId, clientSecret: config.igdb?.clientSecret },
    /** Who may sign in: from the environment, else the login set in the app. */
    login: (): Login | undefined => fromEnv ?? fromApp,
  };
}
