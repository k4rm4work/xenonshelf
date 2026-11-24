import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import bundledLibrary from '@library';
import type { Game, Library } from '../types';
import { failureOf, reasonOf, type ApiError } from './apiError';
import { migrateGame } from './games';
import { recordAdded, recordChange } from './history';

/** Editing needs the library API: `npm run dev`, or a build made for the self-hosted server
    (VITE_EDITABLE=true). A plain static build is read-only. */
export const CAN_EDIT = import.meta.env.DEV || import.meta.env.VITE_EDITABLE === 'true';

/** What failed and the server's reason; the page words it in the chosen language.
    A conflict means the library was saved elsewhere since this page loaded it. */
export type StoreError = { action: 'load' | 'save'; reason: ApiError } | { action: 'conflict' };

type Store = {
  games: Game[];
  loading: boolean;
  error: StoreError | null;
  /** Each change resolves to whether it was saved. */
  addGame: (game: Game) => Promise<boolean>;
  /** New games and changed ones (more copies of a game already owned) in one save, so one
      undo takes back a whole import. */
  importGames: (added: Game[], changed: Game[]) => Promise<boolean>;
  /** Edits save without a way back unless marked undoable, like moving a game between lists. */
  updateGame: (game: Game, options?: { undoable?: boolean }) => Promise<boolean>;
  removeGame: (id: string) => Promise<boolean>;
  /** The whole library swapped for another, e.g. a backup file; undoable like any big change. */
  replaceGames: (games: Game[]) => Promise<boolean>;
  /** Puts the library back as it was before the last undoable change, unless something was
      saved since. Only one step is kept. */
  undo: () => Promise<boolean>;
};

const StoreContext = createContext<Store | null>(null);

class ConflictError extends Error {}

/** Saves the whole library over the revision it was read at; resolves to the new revision. */
async function saveLibrary(games: Game[], revision: string | null) {
  const library: Library = { version: 1, games };
  const res = await fetch('/api/games', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(revision && { 'If-Match': revision }) },
    body: JSON.stringify(library),
  });
  if (res.status === 409) throw new ConflictError();
  if (!res.ok) throw await failureOf(res);
  return res.headers.get('ETag');
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<Game[]>(() => bundledLibrary.games.map(migrateGame));
  const [loading, setLoading] = useState(CAN_EDIT);
  const [error, setError] = useState<StoreError | null>(null);

  // The library file as this page last read or wrote it; saves are refused once it moves on.
  const revision = useRef<string | null>(null);
  // Saves go out one after another, each over the revision the one before it produced.
  // A failed save fails everything queued behind it too: those changes were made on top
  // of it, so sending them would save the very change that is being taken back.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // The library as the server last confirmed it; a failed save puts the page back to this.
  const saved = useRef<Game[]>(games);

  useEffect(() => {
    if (!CAN_EDIT) return;
    // With an API, read the file fresh so edits made elsewhere show up after a reload.
    fetch('/api/games')
      .then(async (r) => {
        if (!r.ok) throw await failureOf(r);
        revision.current = r.headers.get('ETag');
        return r.json() as Promise<Library>;
      })
      .then((lib) => {
        // Older files keep a copy's details on the game; the next save writes them as copies.
        const loaded = lib.games.map(migrateGame);
        saved.current = loaded;
        setGames(loaded);
      })
      .catch((e: unknown) => setError({ action: 'load', reason: reasonOf(e) }))
      .finally(() => setLoading(false));
  }, []);

  // Changes read the latest list from here rather than a render's closure, so an undo
  // offered by a toast seconds ago still applies to the library as it is now.
  const current = useRef(games);
  useLayoutEffect(() => {
    current.current = games;
  }, [games]);
  const beforeLast = useRef<Game[] | null>(null);

  const commit = useCallback(async (change: (games: Game[]) => Game[], { undoable = false } = {}) => {
    const previous = current.current;
    const next = change(previous);
    current.current = next;
    setGames(next);
    const save = queue.current.then(() => saveLibrary(next, revision.current));
    queue.current = save;
    try {
      revision.current = await save;
      saved.current = next;
      setError(null);
      beforeLast.current = undoable ? previous : null;
      return true;
    } catch (e) {
      // The last of a failed run clears the way for the next change.
      if (queue.current === save) queue.current = Promise.resolve();
      current.current = saved.current;
      setGames(saved.current);
      beforeLast.current = null;
      setError(e instanceof ConflictError ? { action: 'conflict' } : { action: 'save', reason: reasonOf(e) });
      return false;
    }
  }, []);

  const value = useMemo<Store>(
    () => ({
      games,
      loading,
      error,
      // Each game's history notes what an edit changed (see history.ts); a restored backup
      // keeps the history it carries.
      addGame: (game) => commit((all) => [...all, recordAdded(game)], { undoable: true }),
      importGames: (added, changed) =>
        commit(
          (all) => [
            ...all.map((g) => {
              const edited = changed.find((c) => c.id === g.id);
              return edited ? recordChange(g, edited) : g;
            }),
            ...added.map((g) => recordAdded(g)),
          ],
          { undoable: true },
        ),
      updateGame: (game, options) => commit((all) => all.map((g) => (g.id === game.id ? recordChange(g, game) : g)), options),
      removeGame: (id) => commit((all) => all.filter((g) => g.id !== id), { undoable: true }),
      replaceGames: (games) => commit(() => games.map(migrateGame), { undoable: true }),
      undo: async () => {
        const before = beforeLast.current;
        return !!before && commit(() => before);
      },
    }),
    [games, loading, error, commit],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
