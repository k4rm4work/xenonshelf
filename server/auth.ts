import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const equalSecret = (provided: string, expected: string) => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Who may sign in: a user name and a check of the password given with it. */
export type Login = { user: string; verify: (password: string) => boolean };

/** A password as kept in the server's config file: never the password itself. */
export type StoredPassword = { salt: string; hash: string };

export const MIN_PASSWORD = 12;

/** Why a user name and password can't be used, or undefined when they can. */
export function loginProblem(user: string, password: string): string | undefined {
  if (!user.trim() || user.includes(':')) return 'The user name must not be empty or contain a colon.';
  if (password.length < MIN_PASSWORD) return `The password must have at least ${MIN_PASSWORD} characters.`;
  return undefined;
}

/** The login set with XENONSHELF_USER and XENONSHELF_PASSWORD, if any. */
export function envLogin(username?: string, password?: string): Login | undefined {
  if (!username && !password) return undefined;
  if (!username || !password) throw new Error('Set both XENONSHELF_USER and XENONSHELF_PASSWORD, or neither.');
  const problem = loginProblem(username, password);
  if (problem) throw new Error(`XENONSHELF_USER / XENONSHELF_PASSWORD: ${problem}`);
  return { user: username, verify: (given) => equalSecret(given, password) };
}

const scrypt = (password: string, salt: string) => scryptSync(password, Buffer.from(salt, 'hex'), 32).toString('hex');

export function hashPassword(password: string): StoredPassword {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: scrypt(password, salt) };
}

/** The login set in the app, its password kept as a scrypt hash. */
export const storedLogin = (user: string, { salt, hash }: StoredPassword): Login => ({
  user,
  verify: (given) => equalSecret(scrypt(given, salt), hash),
});

export type BasicAuth = {
  readonly enabled: boolean;
  authorize: (req: IncomingMessage, res: ServerResponse) => boolean;
};

/**
 * Optional HTTP Basic authentication for the complete self-hosted site and its API. The
 * login is asked for on each request, so it can be set or changed while the server runs.
 * A browser sends the password with every request; hashing it each time would slow every
 * file down, so a header once accepted is remembered until the login changes.
 */
/** Asks the browser for the name and password. */
function refuse(res: ServerResponse): false {
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', 'Basic realm="XenonShelf", charset="UTF-8"');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end('Login required');
  return false;
}

export function createBasicAuth(login: () => Login | undefined): BasicAuth {
  let accepted = new Set<string>();
  let acceptedFor: Login | undefined;
  // Per client address, the distinct wrong logins tried within a minute. Counting logins
  // rather than requests stops guessing without locking out a tab that keeps sending an old
  // password after the login changed: it repeats the same header, which counts once.
  const failed = new Map<string, { tried: Set<string>; resetAt: number }>();
  const maxFailures = 5;
  const failureWindowMs = 60_000;

  return {
    get enabled() {
      return !!login();
    },
    authorize(req, res) {
      const current = login();
      if (!current) return true;
      if (current !== acceptedFor) {
        accepted = new Set();
        acceptedFor = current;
      }
      const address = req.socket.remoteAddress ?? 'unknown';
      const header = req.headers.authorization;
      const key = header?.startsWith('Basic ') ? createHash('sha256').update(header).digest('hex') : undefined;
      if (key && accepted.has(key)) return true;
      const now = Date.now();
      let attempts = failed.get(address);
      if (attempts && attempts.resetAt <= now) {
        failed.delete(address);
        attempts = undefined;
      }
      // A login already found wrong is turned away again without hashing it once more.
      if (key && attempts?.tried.has(key)) return refuse(res);
      if (attempts && attempts.tried.size >= maxFailures) {
        res.statusCode = 429;
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((attempts.resetAt - now) / 1000))));
        res.setHeader('Cache-Control', 'no-store');
        res.end('Too many failed logins. Try again in a minute.');
        return false;
      }
      if (header?.startsWith('Basic ') && key) {
        try {
          const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
          const separator = decoded.indexOf(':');
          if (separator >= 0 && equalSecret(decoded.slice(0, separator), current.user) && current.verify(decoded.slice(separator + 1))) {
            if (accepted.size > 100) accepted.clear();
            accepted.add(key);
            failed.delete(address);
            return true;
          }
        } catch {
          // Malformed credentials are treated like any other failed login.
        }
      }
      if (key) {
        const currentAttempts = attempts ?? { tried: new Set<string>(), resetAt: now + failureWindowMs };
        currentAttempts.tried.add(key);
        failed.set(address, currentAttempts);
        if (failed.size > 1_000) {
          for (const ip of failed.keys()) {
            failed.delete(ip);
            if (failed.size <= 1_000) break;
          }
        }
      }
      return refuse(res);
    },
  };
}
