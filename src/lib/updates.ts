import { useEffect, useState } from 'react';
import { BUILD } from './version';

const CHECK_EVERY_MS = 10 * 60 * 1000;

/** True once the server holds a newer build than the one running here: an open tab or an
    app on the home screen keeps its old code until it is reloaded. Every build writes
    version.json next to the page (see vite.config.ts); the dev server has none, so this
    stays false there. */
export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (available) return;
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { builtAt } = (await res.json()) as { builtAt?: string };
        if (!stopped && builtAt && builtAt !== BUILD.builtAt) setAvailable(true);
      } catch {
        // Offline, or not a build: ask again later.
      }
    };
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    // A phone wakes the app from the background rather than reloading it.
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, [available]);

  return available;
}
