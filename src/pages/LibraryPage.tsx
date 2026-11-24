import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AddGameDialog } from '../components/AddGameDialog';
import { Button } from '../components/Button';
import { CoverTile } from '../components/CoverTile';
import { GameDetailsDialog } from '../components/GameDetailsDialog';
import { GameTile } from '../components/GameTile';
import { snapTileSize } from '../components/SizeSlider';
import type { StatsFilter } from '../components/StatsSummary';
import { TitleIndex } from '../components/TitleIndex';
import { Toolbar } from '../components/Toolbar';
import { DEFAULT_DIRECTION, filterOptions, libraryStats, onList, queryGames, type GameQuery } from '../lib/games';
import { useI18n } from '../lib/i18n';
import { CAN_EDIT, useStore } from '../lib/store';
import { useGrowingList } from '../lib/useGrowingList';
import type { Game, GameList } from '../types';

type Props = { list: GameList };
export type Layout = 'cases' | 'covers' | 'list';

// View preferences are a per-browser convenience; storage may be unavailable.
function loadPref<T>(key: string, fallback: T, storage = () => localStorage): T {
  try {
    const raw = storage().getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function savePref(key: string, value: unknown, storage = () => localStorage) {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function LibraryPage({ list }: Props) {
  const { games, loading } = useStore();
  const { t } = useI18n();
  const defaultSort = list === 'owned' ? 'title' : 'priority';
  const prefKey = `x360lib:view:${list}`;
  const [view, setView] = useState(() =>
    loadPref(prefKey, {
      sort: defaultSort as GameQuery['sort'],
      direction: DEFAULT_DIRECTION[defaultSort],
      tileSize: 170,
      layout: 'cases' as Layout,
    }),
  );
  // A row of the stats on the other list opens this one already filtered. Otherwise the
  // filters last used on this list come back, but only for this tab's session: kept for good,
  // a forgotten filter would one day look like games missing from the shelf.
  const location = useLocation();
  const filtersKey = `x360lib:filters:${list}`;
  const [filters, setFilters] = useState<Omit<GameQuery, 'list' | 'sort' | 'direction'>>(
    () => (location.state as { filters?: StatsFilter } | null)?.filters ?? loadPref(filtersKey, {}, () => sessionStorage),
  );
  // Taken once: the browser keeps history state across a reload, which would bring the
  // filter back every time the page is refreshed.
  const navigate = useNavigate();
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => savePref(prefKey, view), [prefKey, view]);
  // A search is a one-off look for a game, not part of how the list is set up.
  useEffect(() => {
    const { search: _search, ...kept } = filters;
    savePref(filtersKey, kept, () => sessionStorage);
  }, [filtersKey, filters]);

  const searchRef = useRef<HTMLInputElement>(null);
  const dialogOpen = adding || openId !== null;

  // Keyboard shortcuts, shown as keycaps on the search field and the add button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select');
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (CAN_EDIT && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setAdding(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen]);

  const query = useMemo<GameQuery>(
    () => ({ list, sort: view.sort, direction: view.direction, ...filters }),
    [list, view.sort, view.direction, filters],
  );
  // The field shows each letter at once; the shelf follows a moment later, and gives way to
  // the next letter rather than holding it up.
  const shownQuery = useDeferredValue(query);
  const visible = useMemo(() => queryGames(games, shownQuery), [games, shownQuery]);
  // Thousands of cases are built a part at a time, as scrolling nears them (useGrowingList).
  const { count, end } = useGrowingList(visible.length, shownQuery);
  const built = useMemo(() => visible.slice(0, count), [visible, count]);
  const options = useMemo(() => filterOptions(games, list), [games, list]);
  const inList = games.filter((g) => onList(g, list));
  const opened = games.find((g) => g.id === openId);
  // Stepping through the open game's neighbours follows the list as shown: sorted and filtered.
  const openedAt = opened ? visible.findIndex((g) => g.id === opened.id) : -1;
  const prevGame = openedAt > 0 ? visible[openedAt - 1] : undefined;
  const nextGame = openedAt >= 0 ? visible[openedAt + 1] : undefined;
  const openGame = useCallback((game: Game) => setOpenId(game.id), []);
  const stats = useMemo(() => libraryStats(games), [games]);

  // Opening a game or a dialog re-renders the page; the shelf itself stays as it was, which
  // on a phone saves a pass over every tile before the dialog can show.
  const shelf = useMemo(
    () =>
      view.layout === 'list' ? (
        <TitleIndex games={built} grouped={view.sort === 'title'} onOpen={openGame} />
      ) : (
        <div
          className={`isolate grid px-2 ${view.layout === 'covers' ? 'gap-x-4 gap-y-7' : 'gap-x-4 gap-y-8 sm:gap-x-8 sm:gap-y-10'}`}
          // The cover wall packs roughly twice as many titles per row at the same slider value.
          // On a phone the slider size would leave one huge column, so the minimum gives way
          // to two cases or three covers per row.
          style={{
            gridTemplateColumns:
              view.layout === 'covers'
                ? `repeat(auto-fill, minmax(min(${Math.round(snapTileSize(view.tileSize) * 0.6)}px, calc(33.333% - 0.75rem)), 1fr))`
                : `repeat(auto-fill, minmax(min(${snapTileSize(view.tileSize)}px, calc(50% - 1rem)), 1fr))`,
          }}
        >
          {built.map((g, i) =>
            view.layout === 'covers' ? (
              <CoverTile key={g.id} game={g} index={i} onOpen={openGame} />
            ) : (
              <GameTile key={g.id} game={g} index={i} onOpen={openGame} />
            ),
          )}
        </div>
      ),
    [built, view.layout, view.sort, view.tileSize, openGame],
  );

  return (
    <>
      <Toolbar
        ref={searchRef}
        onAdd={CAN_EDIT ? () => setAdding(true) : undefined}
        query={query}
        onChange={({ sort, direction, list: _list, ...rest }) => {
          setView((v) => ({ ...v, sort, direction }));
          setFilters(rest);
        }}
        genres={options.genres}
        years={options.years}
        series={options.series}
        modes={options.modes}
        tags={options.tags}
        locations={options.locations}
        tileSize={view.tileSize}
        onTileSize={(tileSize) => setView((v) => ({ ...v, tileSize }))}
        layout={view.layout}
        onLayout={(layout) => setView((v) => ({ ...v, layout }))}
        count={visible.length}
        total={inList.length}
        stats={stats}
      />

      {loading ? (
        <p className="py-20 text-center text-white/80">{t('library.loading')}</p>
      ) : visible.length === 0 ? (
        <EmptyState list={list} filtered={inList.length > 0} onAdd={() => setAdding(true)} />
      ) : (
        <>
          {shelf}
          {count < visible.length && <div ref={end} aria-hidden />}
        </>
      )}

      {opened && (
        <GameDetailsDialog
          game={opened}
          onClose={() => setOpenId(null)}
          onPrev={prevGame && (() => setOpenId(prevGame.id))}
          onNext={nextGame && (() => setOpenId(nextGame.id))}
          onOpen={openGame}
          // The fact alone, so the shelf shows every game sharing it, from the top.
          onFilter={(filter) => {
            setFilters(filter);
            window.scrollTo({ top: 0 });
          }}
        />
      )}
      {adding && <AddGameDialog defaultList={list} onClose={() => setAdding(false)} />}
    </>
  );
}

function EmptyState({ list, filtered, onAdd }: { list: GameList; filtered: boolean; onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <div className="gloss mx-auto max-w-md rounded-3xl px-8 py-12 text-center">
      <div className="text-2xl font-light text-slate-700">
        {t(filtered ? 'library.noMatch' : list === 'owned' ? 'library.emptyOwned' : 'library.emptyWishlist')}
      </div>
      {!filtered && CAN_EDIT && (
        <Button onClick={onAdd} className="mt-6">
          {t('library.addFirst')}
        </Button>
      )}
    </div>
  );
}
