import { useEffect, useState } from 'react';
import { CAN_EDIT } from './store';

/** Where a server setting comes from: the server's .env.local, the app, or nowhere yet. */
export type SetupSource = 'env' | 'app' | 'none';

/** The server's own settings as it tells them (see server/setup.ts); never the secrets. */
export type SetupStatus = {
  firstRun: boolean;
  igdb: SetupSource;
  login: SetupSource;
  user?: string;
  /** The server asks GitHub once a day whether a newer XenonShelf is out. */
  updateCheck: boolean;
  /** That newer release, when there is one. */
  newRelease?: { version: string; url: string };
};

/** Changes one server setting; the new status, or the reason it was refused. */
export async function changeSetup(
  method: 'PUT' | 'DELETE' | 'POST',
  part: 'igdb' | 'login' | 'updates' | 'done',
  body?: unknown,
): Promise<{ status: SetupStatus } | { error: string }> {
  try {
    const res = await fetch(`/api/setup/${part}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json();
    return res.ok ? { status: data as SetupStatus } : { error: (data as { error?: string }).error ?? `HTTP ${res.status}` };
  } catch {
    return { error: 'offline' };
  }
}

/** The server's setup, on a build that has a server to ask; undefined until it answers. */
export function useSetupStatus() {
  const [status, setStatus] = useState<SetupStatus>();
  useEffect(() => {
    if (!CAN_EDIT) return;
    fetch('/api/setup')
      .then((res) => (res.ok ? res.json() : undefined))
      .then(setStatus, () => {});
  }, []);
  return [status, setStatus] as const;
}
