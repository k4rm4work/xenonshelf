import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { createBasicAuth, envLogin, hashPassword, storedLogin, type Login } from './auth';

const basic = (credentials: string) => ({ Authorization: `Basic ${Buffer.from(credentials).toString('base64')}` });

async function serve(login: () => Login | undefined, run: (url: string) => Promise<void>) {
  const auth = createBasicAuth(login);
  const server = createServer((req, res) => {
    if (!auth.authorize(req, res)) return;
    res.end('ok');
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('self-hosted Basic authentication', () => {
  it('is disabled when no login is set', () => {
    expect(createBasicAuth(() => undefined).enabled).toBe(false);
    expect(envLogin()).toBeUndefined();
  });

  it('requires both environment values and a sufficiently long password', () => {
    expect(() => envLogin('shelf', undefined)).toThrow(/obie zmienne/);
    expect(() => envLogin('shelf', 'short')).toThrow(/12 znaków/);
  });

  it('protects requests and accepts the configured credentials', async () => {
    await serve(
      () => envLogin('shelf', 'correct-horse-battery'),
      async (url) => {
        const denied = await fetch(url);
        expect(denied.status).toBe(401);
        expect(denied.headers.get('www-authenticate')).toContain('Basic');
        expect((await fetch(url, { headers: basic('shelf:wrong') })).status).toBe(401);
        const accepted = await fetch(url, { headers: basic('shelf:correct-horse-battery') });
        expect(accepted.status).toBe(200);
        expect(await accepted.text()).toBe('ok');
      },
    );
  });

  it('checks a password set in the app against its hash, and follows a changed login', async () => {
    let login: Login | undefined = storedLogin('shelf', hashPassword('correct-horse-battery'));
    await serve(
      () => login,
      async (url) => {
        expect((await fetch(url, { headers: basic('shelf:correct-horse-battery') })).status).toBe(200);
        expect((await fetch(url, { headers: basic('shelf:correct-horse-batter') })).status).toBe(401);
        login = storedLogin('shelf', hashPassword('another-long-password'));
        expect((await fetch(url, { headers: basic('shelf:correct-horse-battery') })).status).toBe(401);
        login = undefined;
        expect((await fetch(url)).status).toBe(200);
      },
    );
  });

  it('throttles a client guessing passwords, and returns Retry-After', async () => {
    await serve(
      () => envLogin('shelf', 'correct-horse-battery'),
      async (url) => {
        for (let i = 0; i < 5; i++) {
          const denied = await fetch(url, { headers: basic(`shelf:wrong-${i}`) });
          expect(denied.status).toBe(401);
        }
        const limited = await fetch(url, { headers: basic('shelf:wrong-5') });
        expect(limited.status).toBe(429);
        expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
      },
    );
  });

  it('does not lock out a tab that keeps sending one old password', async () => {
    await serve(
      () => envLogin('shelf', 'correct-horse-battery'),
      async (url) => {
        for (let i = 0; i < 10; i++) expect((await fetch(url, { headers: basic('shelf:old-password') })).status).toBe(401);
        expect((await fetch(url, { headers: basic('shelf:correct-horse-battery') })).status).toBe(200);
      },
    );
  });

  it('never keeps the password itself', () => {
    const stored = hashPassword('correct-horse-battery');
    expect(JSON.stringify(stored)).not.toContain('correct-horse-battery');
    expect(hashPassword('correct-horse-battery').hash).not.toBe(stored.hash);
  });
});
