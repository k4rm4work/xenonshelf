import type { Copy, Game, GameFormat, GameList, IgdbSearchResult, PlayStatus, Priority } from '../types';
import { isBackCompat } from './backcompat';
import { gameKeys, titleKey } from './titles';

export type FormatFilter = GameFormat | 'steelbook' | 'demo' | 'forSale' | 'lent' | 'all';

/** A game's physical copies: in the collection, those noted, else the one case every game
    comes in; none for a game owned only digitally (stored as []) or for a wish. */
export function copiesOf(game: Pick<Game, 'list' | 'copies'>): Copy[] {
  if (game.list !== 'owned') return [];
  return game.copies ?? [{}];
}

/** The copy whose case stands on the shelf: the first one. */
export const shelfCopy = (game: Pick<Game, 'copies'>): Copy => game.copies?.[0] ?? {};

/** Owned as a download and in no case. */
export const isDigitalOnly = (game: Pick<Game, 'digital' | 'copies'>) => !!game.digital && game.copies?.length === 0;

/** Whether a game shows on a list: the wishlist also holds games owned but hunted for on a shelf. */
export const onList = (game: Pick<Game, 'list' | 'wanted'>, list: GameList) => game.list === list || (list === 'wishlist' && !!game.wanted);

const COPY_FIELDS = [
  'steelbook',
  'pack',
  'completeness',
  'edition',
  'region',
  'condition',
  'ean',
  'price',
  'currency',
  'forSale',
  'location',
  'lentTo',
  'lentAt',
] as const;

const isBlank = (copy: Copy) => COPY_FIELDS.every((field) => copy[field] === undefined);

/** Copies as stored: a lone copy with nothing noted is left out, as before there were
    copies; none at all stay an empty list, which only a game owned digitally may have. */
export function storedCopies(copies: Copy[]): Copy[] | undefined {
  const kept = copies.map((copy) => Object.fromEntries(Object.entries(copy).filter(([, v]) => v !== undefined)) as Copy);
  return kept.length === 1 && isBlank(kept[0]) ? undefined : kept;
}

/** The game with one more copy on the shelf; a case that was hunted for, or ordered, is found. */
export const withCopy = (game: Game, copy: Copy = {}): Game => {
  const { wanted: _wanted, orderedAt: _orderedAt, ...rest } = game;
  return { ...rest, copies: storedCopies([...copiesOf(game), copy]) };
};

/** A game as saved by an earlier version, in today's shape; games already in it come back
    unchanged. Before copies, one copy's details sat on the game itself: they move into its
    first copy. Before a game could be owned both ways, `format` said digital or physical:
    digital becomes the flag with no case. A hand-set `backCompat` is dropped, the list
    being final, and so is a cover that came with the app. */
export function migrateGame(game: Game): Game {
  const legacy = game as Game & Copy & { format?: GameFormat; backCompat?: boolean };
  let migrated: Game = game;
  if (COPY_FIELDS.some((field) => legacy[field] !== undefined)) {
    const rest = { ...legacy } as Record<string, unknown>;
    const copy: Copy = {};
    for (const field of COPY_FIELDS) {
      if (legacy[field] !== undefined) (copy as Record<string, unknown>)[field] = legacy[field];
      delete rest[field];
    }
    const moved = rest as Game;
    const [first = {}, ...others] = moved.copies ?? [];
    migrated = { ...moved, copies: storedCopies([{ ...copy, ...first }, ...others]) };
  }
  if (legacy.format !== undefined || legacy.backCompat !== undefined) {
    const { format, backCompat: _backCompat, ...rest } = migrated as typeof legacy;
    migrated = format === 'digital' && rest.list === 'owned' ? { ...rest, digital: true, copies: rest.copies ?? [] } : rest;
  }
  if (migrated.coverUrl && SHIPPED_COVER.test(migrated.coverUrl) && migrated.coverImageId) {
    const { coverUrl: _coverUrl, coverHasBand: _coverHasBand, ...rest } = migrated;
    migrated = rest;
  }
  return migrated;
}

/** Covers that came with the app until 2026-11, as "./covers/halo-3.jpg": no longer in it,
    so a game falls back to its IGDB cover, which has no printed header of its own. */
const SHIPPED_COVER = /^(\.?\/)?covers\//;

/** Playing together: any co-operative mode, or several players on one screen. */
export type ModeFilter = 'coop' | 'splitscreen' | 'all';
export const MODES: Exclude<ModeFilter, 'all'>[] = ['coop', 'splitscreen'];

export type SortKey = 'title' | 'year' | 'added' | 'status' | 'priority' | 'genre' | 'myRating';
export type SortDirection = 'asc' | 'desc';

export type GameQuery = {
  list: GameList;
  search?: string;
  playStatus?: PlayStatus | 'all';
  /** A format, or one of the edition flags that cut across formats. */
  format?: FormatFilter;
  genre?: string | 'all';
  year?: number | 'all';
  /** One series from IGDB, e.g. "Halo". */
  series?: string | 'all';
  mode?: ModeFilter;
  /** Plays on Xbox One and Series X|S, or does not. */
  backCompat?: 'all' | 'yes' | 'no';
  /** Wishlist only: ordered (on its way) vs still wanted. */
  order?: 'all' | 'ordered' | 'wanted';
  /** One of the player's own tags. */
  tag?: string | 'all';
  /** Where a copy is kept. */
  location?: string | 'all';
  sort: SortKey;
  direction: SortDirection;
};

export const SORT_KEYS: SortKey[] = ['title', 'year', 'added', 'status', 'priority', 'genre', 'myRating'];

/** Direction each sort starts in when picked, e.g. newest first for dates. */
export const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  title: 'asc',
  year: 'desc',
  added: 'desc',
  status: 'asc',
  priority: 'asc',
  genre: 'asc',
  myRating: 'desc',
};

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER: Record<PlayStatus, number> = { playing: 0, unplayed: 1, completed: 2, dropped: 3 };

// One collator for every comparison: localeCompare with options builds a new one each call,
// which makes sorting a few thousand titles take a noticeable moment on a phone.
const collator = new Intl.Collator('pl', { sensitivity: 'base', ignorePunctuation: true });
const byTitle = (a: Game, b: Game) => collator.compare(a.title, b.title);

// Ascending comparators; missing values always sort last regardless of direction.
const keyOf: Record<SortKey, (g: Game) => string | number | undefined> = {
  title: (g) => g.title,
  year: (g) => g.releaseYear,
  added: (g) => g.addedAt,
  status: (g) => STATUS_ORDER[g.playStatus ?? 'unplayed'],
  priority: (g) => PRIORITY_ORDER[g.priority ?? 'medium'],
  genre: (g) => g.genres?.[0],
  myRating: (g) => g.myRating,
};

function compareKeys(a: string | number, b: string | number) {
  return typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));
}

export function queryGames(games: Game[], q: GameQuery): Game[] {
  const needle = q.search?.trim().toLocaleLowerCase('pl');
  const sign = q.direction === 'asc' ? 1 : -1;
  const key = keyOf[q.sort];
  return games
    .filter((g) => onList(g, q.list))
    .filter((g) => !needle || g.title.toLocaleLowerCase('pl').includes(needle))
    .filter((g) => !q.playStatus || q.playStatus === 'all' || (g.playStatus ?? 'unplayed') === q.playStatus)
    .filter((g) => !q.format || q.format === 'all' || matchesFormat(g, q.format))
    .filter((g) => !q.genre || q.genre === 'all' || (g.genres ?? []).includes(q.genre))
    .filter((g) => !q.order || q.order === 'all' || !!g.orderedAt === (q.order === 'ordered'))
    .filter((g) => !q.year || q.year === 'all' || g.releaseYear === q.year)
    .filter((g) => !q.series || q.series === 'all' || (g.series ?? []).includes(q.series))
    .filter((g) => !q.mode || q.mode === 'all' || !!g[q.mode])
    .filter((g) => !q.backCompat || q.backCompat === 'all' || isBackCompat(g) === (q.backCompat === 'yes'))
    .filter((g) => !q.tag || q.tag === 'all' || (g.tags ?? []).includes(q.tag))
    .filter((g) => !q.location || q.location === 'all' || copiesOf(g).some((copy) => copy.location === q.location))
    .sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka === undefined || kb === undefined) {
        if (ka !== kb) return ka === undefined ? 1 : -1;
        return byTitle(a, b);
      }
      return sign * compareKeys(ka, kb) || byTitle(a, b);
    });
}

function matchesFormat(g: Game, format: Exclude<FormatFilter, 'all'>) {
  if (format === 'demo') return !!g.demo;
  if (format === 'forSale') return copiesOf(g).some((copy) => copy.forSale);
  if (format === 'lent') return copiesOf(g).some((copy) => copy.lentTo);
  // Any copy in a SteelBook counts, not just the one on the shelf.
  if (format === 'steelbook') return copiesOf(g).some((copy) => copy.steelbook);
  return format === 'digital' ? !!g.digital : copiesOf(g).length > 0;
}

/** Genres, release years and series present in a list, for filter dropdowns. */
export function filterOptions(games: Game[], list: GameList) {
  const inList = games.filter((g) => onList(g, list));
  const genres = [...new Set(inList.flatMap((g) => g.genres ?? []))].sort((a, b) => a.localeCompare(b, 'pl'));
  const years = [...new Set(inList.map((g) => g.releaseYear).filter((y) => y !== undefined))].sort((a, b) => a - b);
  // A series with one game on the shelf filters down to that game alone, so only shared ones count.
  const seriesCount = new Map<string, number>();
  for (const name of inList.flatMap((g) => g.series ?? [])) seriesCount.set(name, (seriesCount.get(name) ?? 0) + 1);
  const series = [...seriesCount]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, 'pl'));
  const modes = { coop: inList.some((g) => g.coop), splitscreen: inList.some((g) => g.splitscreen) };
  return { genres, years, series, modes, tags: tagsOf(inList), locations: locationsOf(inList) };
}

const sorted = (values: Iterable<string>) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pl'));

/** Every tag in use, for suggestions and the tag filter. */
export const tagsOf = (games: Game[]) => sorted(games.flatMap((g) => g.tags ?? []));

/** Every place a copy is kept, for suggestions and the location filter. */
export const locationsOf = (games: Game[]) =>
  sorted(games.flatMap((g) => copiesOf(g).flatMap((copy) => (copy.location ? [copy.location] : []))));

/** A tag as stored: trimmed, inner spaces single; empty means none. */
export const cleanTag = (tag: string) => tag.trim().replace(/\s+/g, ' ');

/** The tags with one more, unless the game has it already in any letter case. */
export function withTag(tags: string[] | undefined, tag: string): string[] | undefined {
  const clean = cleanTag(tag);
  const list = tags ?? [];
  if (!clean || list.some((t) => t.toLocaleLowerCase('pl') === clean.toLocaleLowerCase('pl'))) return tags;
  return [...list, clean];
}

export type LibraryStats = ReturnType<typeof libraryStats>;

export function libraryStats(games: Game[]) {
  const owned = games.filter((g) => g.list === 'owned');
  return {
    owned: owned.length,
    completed: owned.filter((g) => g.playStatus === 'completed').length,
    playing: owned.filter((g) => g.playStatus === 'playing').length,
    // A game owned both ways counts in both.
    physical: owned.filter((g) => copiesOf(g).length > 0).length,
    digital: owned.filter((g) => g.digital).length,
    wishlist: games.filter((g) => onList(g, 'wishlist')).length,
    ordered: games.filter((g) => onList(g, 'wishlist') && g.orderedAt).length,
    backCompat: owned.filter(isBackCompat).length,
    forSale: owned.reduce((sum, g) => sum + copiesOf(g).filter((copy) => copy.forSale).length, 0),
    lent: owned.reduce((sum, g) => sum + copiesOf(g).filter((copy) => copy.lentTo).length, 0),
  };
}

export function findDuplicate(games: Game[], candidate: { igdbId?: number; title: string }) {
  const title = titleKey(candidate.title);
  return games.find((g) => (candidate.igdbId !== undefined && g.igdbId === candidate.igdbId) || gameKeys(g).includes(title));
}

/** A search result as the shelf names it: found by its Polish title, it is shelved under
    that one, with IGDB's English name kept to look it up again, like the games named by
    hand ("Obcy: Izolacja"). */
export function shelvedAs({ alias, ...result }: IgdbSearchResult): IgdbSearchResult {
  return alias ? { ...result, title: alias, igdbQuery: result.title } : result;
}

/** Letters to change, add or drop to turn one string into the other. */
function editDistance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

/** The game a title names, allowing a slip of the keyboard ("Red Dead Redemtion"): one
    letter off in eight. Short titles must match, so "Halo 3" never stands for "Halo 4". */
export function findNearDuplicate(games: Game[], title: string) {
  const wanted = titleKey(title);
  const slips = Math.floor(wanted.length / 8);
  if (!slips) return findDuplicate(games, { title });
  let best: { game: Game; distance: number } | undefined;
  for (const game of games) {
    for (const key of gameKeys(game)) {
      // Differing digits name another game in a series, however close the rest is.
      if (key.replace(/\D/g, '') !== wanted.replace(/\D/g, '')) continue;
      const distance = editDistance(key, wanted);
      if (distance <= slips && (!best || distance < best.distance)) best = { game, distance };
    }
  }
  return best?.game;
}

/** Marks a wishlist game as ordered, or clears that when it was already ordered. */
export function toggleOrdered(game: Game, now = new Date()): Game {
  const { orderedAt, ...rest } = game;
  return orderedAt ? rest : { ...rest, orderedAt: now.toISOString() };
}

/** Moves a wishlist game into the owned collection. */
export function markAsOwned(game: Game): Game {
  const { priority: _priority, orderedAt: _orderedAt, ...rest } = game;
  return { ...rest, list: 'owned', playStatus: 'unplayed' };
}
