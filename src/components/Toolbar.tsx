import { forwardRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_DIRECTION, MODES, SORT_KEYS, type GameQuery, type LibraryStats, type ModeFilter, type SortKey } from '../lib/games';
import { useI18n, type MessageKey } from '../lib/i18n';
import type { Layout } from '../pages/LibraryPage';
import { FORMATS, PLAY_STATUSES } from '../types';
import { Dropdown } from './Dropdown';
import { FilterPanel, NEUTRAL, type FilterGroup } from './FilterPanel';
import { ArrowUpIcon, CasesIcon, CoversIcon, ListIcon, SearchIcon } from './icons';
import { ClearSearch } from './ClearSearch';
import { Shortcut } from './Shortcut';
import { SizeSlider } from './SizeSlider';
import { StatsSummary } from './StatsSummary';
import { ViewSwitch } from './ViewSwitch';

const LAYOUTS: { value: Layout; icon: ReactNode }[] = [
  { value: 'cases', icon: <CasesIcon /> },
  { value: 'covers', icon: <CoversIcon /> },
  { value: 'list', icon: <ListIcon /> },
];

function CrossIcon() {
  return (
    <svg viewBox="0 0 12 12" className="size-2.5">
      <path d="m3 3 6 6m0-6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  query: GameQuery;
  onChange: (query: GameQuery) => void;
  genres: string[];
  years: number[];
  series: string[];
  /** Which ways of playing together occur in the list. */
  modes: Record<Exclude<ModeFilter, 'all'>, boolean>;
  /** The player's own tags, and the places copies are kept, in the list. */
  tags: string[];
  locations: string[];
  tileSize: number;
  onTileSize: (size: number) => void;
  layout: Layout;
  onLayout: (layout: Layout) => void;
  count: number;
  /** Size of the current list before filtering. */
  total: number;
  stats: LibraryStats;
  onAdd?: () => void;
};

/** Every filter back to "all" and the search emptied; the sort stays as chosen. */
const NO_FILTERS = {
  search: '',
  playStatus: 'all',
  format: 'all',
  order: 'all',
  genre: 'all',
  series: 'all',
  mode: 'all',
  backCompat: 'all',
  year: 'all',
  tag: 'all',
  location: 'all',
} satisfies Partial<GameQuery>;

export const Toolbar = forwardRef<HTMLInputElement, Props>(function Toolbar(
  { query, onChange, genres, years, series, modes, tags, locations, tileSize, onTileSize, layout, onLayout, count, total, stats, onAdd },
  searchRef,
) {
  const { t, rich, lower, genre } = useI18n();
  const set = (patch: Partial<GameQuery>) => onChange({ ...query, ...patch });
  const navigate = useNavigate();
  const isOwned = query.list === 'owned';
  const all = { value: NEUTRAL, label: t('toolbar.all') };
  // Menus list their choices in lower case, like the rest of the toolbar.
  const choices = <T extends string>(prefix: string, values: readonly T[]) =>
    values.map((value) => ({ value, label: lower(t(`${prefix}.${value}` as MessageKey)) }));
  // A wish has a priority, an owned game a status and the player's score.
  const sortKeys = SORT_KEYS.filter((k) => (isOwned ? k !== 'priority' : k !== 'status' && k !== 'myRating'));

  // Every filter the current list offers, in the order the panel shows them.
  const groups: FilterGroup[] = [];
  if (isOwned) {
    groups.push(
      {
        key: 'status',
        label: t('toolbar.status'),
        value: query.playStatus ?? NEUTRAL,
        options: [all, ...choices('status', PLAY_STATUSES)],
        onChange: (v) => set({ playStatus: v as GameQuery['playStatus'] }),
      },
      {
        key: 'format',
        label: t('toolbar.format'),
        value: query.format ?? NEUTRAL,
        options: [
          all,
          ...choices('format', FORMATS),
          { value: 'steelbook', label: t('game.steelbook') },
          { value: 'demo', label: t('game.demo') },
          { value: 'forSale', label: t('copy.forSale') },
          { value: 'lent', label: t('toolbar.lent') },
        ],
        onChange: (v) => set({ format: v as GameQuery['format'] }),
      },
    );
  } else {
    groups.push({
      key: 'order',
      label: t('toolbar.order'),
      value: query.order ?? NEUTRAL,
      options: [all, { value: 'ordered', label: t('toolbar.ordered') }, { value: 'wanted', label: t('toolbar.wanted') }],
      onChange: (v) => set({ order: v as GameQuery['order'] }),
    });
  }
  if (modes.coop || modes.splitscreen) {
    groups.push({
      key: 'mode',
      label: t('toolbar.mode'),
      value: query.mode ?? NEUTRAL,
      options: [
        all,
        ...choices(
          'mode',
          MODES.filter((m) => modes[m]),
        ),
      ],
      onChange: (v) => set({ mode: v as ModeFilter }),
    });
  }
  if (isOwned) {
    groups.push({
      key: 'backCompat',
      label: t('toolbar.backCompat'),
      value: query.backCompat ?? NEUTRAL,
      options: [all, { value: 'yes', label: t('toolbar.backCompatYes') }, { value: 'no', label: t('toolbar.backCompatNo') }],
      onChange: (v) => set({ backCompat: v as GameQuery['backCompat'] }),
    });
  }
  if (genres.length > 0) {
    groups.push({
      key: 'genre',
      label: t('toolbar.genre'),
      value: query.genre ?? NEUTRAL,
      options: [all, ...genres.map((g) => ({ value: g, label: genre(g) }))],
      onChange: (v) => set({ genre: v }),
    });
  }
  if (series.length > 0) {
    groups.push({
      key: 'series',
      label: t('toolbar.series'),
      value: query.series ?? NEUTRAL,
      options: [all, ...series.map((s) => ({ value: s, label: s }))],
      onChange: (v) => set({ series: v }),
    });
  }
  if (tags.length > 0) {
    groups.push({
      key: 'tag',
      label: t('toolbar.tag'),
      value: query.tag ?? NEUTRAL,
      options: [all, ...tags.map((tag) => ({ value: tag, label: tag }))],
      onChange: (v) => set({ tag: v }),
    });
  }
  if (isOwned && locations.length > 0) {
    groups.push({
      key: 'location',
      label: t('toolbar.location'),
      value: query.location ?? NEUTRAL,
      options: [all, ...locations.map((place) => ({ value: place, label: place }))],
      onChange: (v) => set({ location: v }),
    });
  }
  if (years.length > 1) {
    groups.push({
      key: 'year',
      label: t('toolbar.year'),
      value: String(query.year ?? NEUTRAL),
      options: [all, ...years.map((y) => ({ value: String(y), label: String(y) }))],
      columns: 4,
      onChange: (v) => set({ year: v === NEUTRAL ? NEUTRAL : Number(v) }),
    });
  }
  const active = groups.filter((g) => g.value !== NEUTRAL);
  const filtered = !!query.search?.trim() || active.length > 0;

  const shown = rich('toolbar.shown', { count: <b className="font-semibold text-slate-700">{count}</b>, total });
  const clearAll = (
    <button
      type="button"
      onClick={() => set(NO_FILTERS)}
      className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800"
    >
      <CrossIcon />
      {/* Trimmed to cap height, so the cross centres on the letters rather than the line box. */}
      <span className="nxe-label">{t('toolbar.clearAll')}</span>
    </button>
  );

  // Sticky only where there is room: on a phone it would cover half the screen.
  return (
    <div className="nxe-tray relative z-30 mb-8 p-2 sm:sticky sm:top-3 sm:mb-10">
      <div className="flex flex-wrap items-center gap-2">
        <label className="nxe-field group flex h-10 min-w-[160px] flex-1 items-center gap-2 px-3.5 max-sm:basis-full sm:has-[kbd]:pr-2 lg:max-w-72">
          {/* The lens drops a pixel to sit on the lowercase optical centre of the text. */}
          <span className="flex-none translate-y-px text-slate-400">
            <SearchIcon />
          </span>
          <input
            ref={searchRef}
            type="search"
            value={query.search ?? ''}
            onChange={(e) => set({ search: e.target.value })}
            placeholder={t('toolbar.search')}
            aria-label={t('toolbar.search')}
            aria-keyshortcuts="/"
            className="h-full w-full min-w-0 bg-transparent pb-0.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
          {/* Only a hint while the field waits: gone once it is focused or holds a query. */}
          {query.search ? (
            <ClearSearch onClear={() => set({ search: '' })} className="-mr-2.5" />
          ) : (
            <Shortcut keyName="/" className="flex-none group-focus-within:hidden" />
          )}
        </label>

        <div className="flex">
          <Dropdown<SortKey>
            label={t('toolbar.sort')}
            value={query.sort}
            options={choices('sort', sortKeys)}
            onChange={(sort) => set({ sort, direction: DEFAULT_DIRECTION[sort] })}
          />
          <button
            type="button"
            onClick={() => set({ direction: query.direction === 'asc' ? 'desc' : 'asc' })}
            className="nxe-field ml-1 grid h-10 w-10 place-items-center text-slate-500 hover:text-slate-800"
            data-tip={t(query.direction === 'asc' ? 'toolbar.ascending' : 'toolbar.descending')}
            aria-label={t('toolbar.direction')}
          >
            <span className={`grid transition ${query.direction === 'desc' ? 'rotate-180' : ''}`}>
              <ArrowUpIcon />
            </span>
          </button>
        </div>

        {groups.length > 0 && (
          <FilterPanel
            groups={groups}
            footer={
              <>
                <span>{shown}</span>
                {filtered && clearAll}
              </>
            }
          />
        )}

        {/* Takes the rest of the row: the summary starts it, the view and the add button end
            it, so on a row of its own the summary sits on the tray's left edge. */}
        <div className="flex flex-1 items-center justify-between gap-2 sm:gap-4">
          <StatsSummary
            total={total}
            stats={stats}
            query={query}
            // Only that filter, the search emptied; the other list opens with it.
            onPick={(list, filter) =>
              list === query.list
                ? set({ ...NO_FILTERS, ...filter })
                : navigate(list === 'owned' ? '/' : '/wishlist', { state: { filters: filter } })
            }
          />
          <div className="flex items-center gap-2 sm:gap-4">
            <ViewSwitch
              label={t('toolbar.layout')}
              value={layout}
              options={LAYOUTS.map((l) => ({ ...l, label: t(`layout.${l.value}`) }))}
              onChange={onLayout}
            />
            {/* Tile size means nothing without covers. */}
            <div className={`hidden ${layout === 'list' ? '' : 'xl:block'}`}>
              <SizeSlider value={tileSize} onChange={onTileSize} />
            </div>
            {onAdd && (
              <button
                type="button"
                onClick={onAdd}
                aria-keyshortcuts="N"
                className="gloss-green flex h-10 items-center gap-2.5 rounded-lg pr-4 pl-4 text-sm font-semibold whitespace-nowrap sm:has-[kbd]:pr-2"
              >
                <span className="nxe-label">{t('toolbar.add')}</span>
                <Shortcut keyName="N" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Only while something narrows the list: the set filters, each as a chip that
          takes it off again, and how much of the list is left. */}
      {filtered && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-300/60 pt-2">
          {active.map((g) => (
            <span key={g.key} className="filter-chip">
              <span className="font-normal opacity-85">{g.label}</span>
              <span>{g.options.find((o) => o.value === g.value)?.label ?? g.value}</span>
              <button type="button" onClick={() => g.onChange(NEUTRAL)} aria-label={t('toolbar.clearFilter', { label: g.label })}>
                <CrossIcon />
              </button>
            </span>
          ))}
          {/* Tucked up to the last chip: it belongs with them. */}
          <span className="-ml-1.5">{clearAll}</span>
          <span className="ml-auto pr-2 text-sm whitespace-nowrap text-slate-500">{shown}</span>
        </div>
      )}
    </div>
  );
});
