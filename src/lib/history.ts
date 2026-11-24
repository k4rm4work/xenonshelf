import type { Copy, Game, GameList, HistoryEntry, HistoryEvent } from '../types';
import { copiesOf } from './games';
import { priceText } from './price';

/** Entries kept per game; the oldest go first. */
export const HISTORY_LIMIT = 200;

/** Changes of the same kind this close together are one change: clicking through the
    stars or the statuses to the one meant leaves a single line. */
const MERGE_WITHIN_MS = 15 * 60_000;

/** Names in a list, counted, so a loan can be told apart when copies move around. */
function tally(names: (string | undefined)[]) {
  const counts = new Map<string, number>();
  for (const name of names) if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  return counts;
}

/** Names that are in `after` more times than in `before`. */
function gained(before: Map<string, number>, after: Map<string, number>) {
  return [...after].flatMap(([name, n]) => Array<string>(Math.max(0, n - (before.get(name) ?? 0))).fill(name));
}

/** Fields with events of their own, and those that are not the game's details. */
const OWN_EVENTS = new Set(['id', 'list', 'orderedAt', 'playStatus', 'myRating', 'tags', 'copies', 'history', 'addedAt']);

/** Details noted with their new value, short enough to read back in a line. */
const WITH_VALUE = new Set(['title', 'digital', 'wanted', 'demo', 'priority', 'releaseYear']);

/** What IGDB fills in, often all at once when a game is enriched. */
const IGDB_FIELDS = [
  'igdbId',
  'igdbQuery',
  'summary',
  'developers',
  'publishers',
  'series',
  'rating',
  'pegi',
  'coop',
  'splitscreen',
  'localPlayers',
  'hoursStory',
  'hoursComplete',
  'genres',
];

/** Fields that change together, one line for the lot. */
const GROUPS: Record<string, string> = {
  coverImageId: 'cover',
  coverUrl: 'cover',
  coverHasBand: 'cover',
  digitalPrice: 'price',
  digitalCurrency: 'price',
  ...Object.fromEntries(IGDB_FIELDS.map((key) => [key, 'igdb'])),
};

/** A copy's details, its loan aside (that has its own events). */
const COPY_FIELDS = ['edition', 'region', 'pack', 'steelbook', 'completeness', 'condition', 'location', 'price', 'forSale', 'ean'] as const;

/** A copy's detail as the history keeps it: a price with its currency, as one value. */
const detailOf = (copy: Copy, field: (typeof COPY_FIELDS)[number]) => (field === 'price' ? priceText(copy) : copy[field]);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A copy as text that ignores its loan and the order of its keys, to spot copies only moved around. */
const copyKey = (copy: Copy) => JSON.stringify(COPY_FIELDS.map((field) => detailOf(copy, field) ?? null));

/** The game's details edited between two saves: one event per field (or group of fields). */
function editsBetween(before: Game, after: Game): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  const seen = new Set<string>();
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof Game>;
  for (const key of keys) {
    if (OWN_EVENTS.has(key) || same(before[key], after[key])) continue;
    // The first review written is an event of its own.
    if (key === 'review' && !before.review?.trim()) continue;
    const field = GROUPS[key] ?? key;
    if (seen.has(field)) continue;
    seen.add(field);
    if (field === 'price') {
      events.push({ kind: 'edited', field, to: priceText({ price: after.digitalPrice, currency: after.digitalCurrency }) });
      continue;
    }
    // A flag cleared is kept as false: an undefined value would not survive the save.
    const value = after[key] === undefined && typeof before[key] === 'boolean' ? false : after[key];
    const short = WITH_VALUE.has(field) && (value === undefined || typeof value !== 'object');
    events.push(short ? { kind: 'edited', field, to: value as string | number | boolean | undefined } : { kind: 'edited', field });
  }
  return events;
}

/** Details edited on the copies, when the copies are the same ones: not added, taken off or
    only put in another order. */
function copyEditsBetween(before: Copy[], after: Copy[]): HistoryEvent[] {
  if (before.length !== after.length) return [];
  const sorted = (copies: Copy[]) => copies.map(copyKey).sort().join('|');
  if (sorted(before) === sorted(after)) return [];
  return after.flatMap((copy, i) =>
    COPY_FIELDS.filter((field) => !same(detailOf(before[i], field), detailOf(copy, field))).map((field): HistoryEvent => ({
      kind: 'edited',
      field,
      to: detailOf(copy, field),
      ...(after.length > 1 && { copy: i + 1 }),
    })),
  );
}

/** What happened to a game between two saves, in the order it reads best: the events a
    collector looks back on first, then any detail edited. */
export function changesBetween(before: Game, after: Game): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  const moved = before.list !== after.list;
  if (moved) events.push({ kind: 'moved', list: after.list });
  else if (!before.orderedAt && after.orderedAt) events.push({ kind: 'ordered' });
  else if (before.orderedAt && !after.orderedAt) events.push({ kind: 'orderCancelled' });

  if (before.playStatus !== after.playStatus && (before.playStatus || after.playStatus))
    events.push({ kind: 'status', from: before.playStatus, to: after.playStatus });
  if (before.myRating !== after.myRating) events.push({ kind: 'rating', from: before.myRating, to: after.myRating });
  if (!before.review?.trim() && after.review?.trim()) events.push({ kind: 'reviewed' });

  // A game moved between the lists gains or loses its cases as a matter of course; only a
  // copy added or taken off a game that stays in the collection is news.
  const copiesBefore = copiesOf(before);
  const copiesAfter = copiesOf(after);
  if (!moved) {
    const diff = copiesAfter.length - copiesBefore.length;
    if (diff > 0) events.push({ kind: 'copyAdded', count: diff });
    if (diff < 0) events.push({ kind: 'copyRemoved', count: -diff });
  }

  const lentBefore = tally(copiesBefore.map((c) => c.lentTo));
  const lentAfter = tally(copiesAfter.map((c) => c.lentTo));
  for (const who of gained(lentAfter, lentBefore)) events.push({ kind: 'returned', who });
  for (const who of gained(lentBefore, lentAfter)) events.push({ kind: 'lent', who });

  const tagsBefore = new Set(before.tags);
  const tagsAfter = new Set(after.tags);
  for (const tag of tagsAfter) if (!tagsBefore.has(tag)) events.push({ kind: 'tagged', tag });
  for (const tag of tagsBefore) if (!tagsAfter.has(tag)) events.push({ kind: 'untagged', tag });

  events.push(...editsBetween(before, after));
  if (!moved) events.push(...copyEditsBetween(copiesBefore, copiesAfter));
  return events;
}

/** Folds a new event into the last one when it only revises it a moment later; undefined
    when the two cancel out (a status changed and changed back). */
function merged(last: HistoryEntry, event: HistoryEvent, at: string): HistoryEntry | null | undefined {
  if (Date.parse(at) - Date.parse(last.at) > MERGE_WITHIN_MS) return null;
  if ((last.kind === 'status' && event.kind === 'status') || (last.kind === 'rating' && event.kind === 'rating')) {
    if (last.from === event.to) return undefined;
    return { ...last, to: event.to, at } as HistoryEntry;
  }
  if (last.kind === 'tagged' && event.kind === 'untagged' && last.tag === event.tag) return undefined;
  // The same detail edited again, e.g. a location typed in two goes.
  if (last.kind === 'edited' && event.kind === 'edited' && last.field === event.field && last.copy === event.copy) return { ...event, at };
  return null;
}

/** The history with these events added at `at`, newest last, cut to the limit. */
export function withEvents(history: HistoryEntry[] | undefined, events: HistoryEvent[], at: string): HistoryEntry[] | undefined {
  if (!events.length) return history;
  const next = [...(history ?? [])];
  for (const event of events) {
    const last = next.at(-1);
    const folded = last && merged(last, event, at);
    if (folded === null || !last) next.push({ ...event, at });
    else {
      next.pop();
      if (folded) next.push(folded);
    }
  }
  const kept = next.slice(-HISTORY_LIMIT);
  return kept.length ? kept : undefined;
}

/** The game as saved after an edit, its history carrying what changed. */
export function recordChange(before: Game, after: Game, at = new Date().toISOString()): Game {
  const history = withEvents(after.history, changesBetween(before, after), at);
  return history === after.history ? after : { ...after, history };
}

/** A game newly added to a list, its history starting there. */
export function recordAdded(game: Game, at = new Date().toISOString()): Game {
  return { ...game, history: withEvents(game.history, [{ kind: 'added', list: game.list }], at) };
}

/** The history to show, newest first. Games from before the history was kept still show
    when they were added, from the date they carry. */
export function historyOf(game: Pick<Game, 'history' | 'addedAt' | 'list'>): HistoryEntry[] {
  const entries = [...(game.history ?? [])];
  if (!entries.some((e) => e.kind === 'added')) {
    const first: GameList = entries.find((e) => e.kind === 'moved') ? otherList(entries) : game.list;
    entries.unshift({ kind: 'added', list: first, at: game.addedAt });
  }
  return entries.reverse();
}

/** The list a game started on, before its first move. */
function otherList(entries: HistoryEntry[]): GameList {
  const move = entries.find((e) => e.kind === 'moved');
  return move?.kind === 'moved' && move.list === 'owned' ? 'wishlist' : 'owned';
}
