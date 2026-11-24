import {
  COMPLETENESS as COMPLETENESS_LIST,
  CONDITIONS as CONDITIONS_LIST,
  EDITIONS as EDITIONS_LIST,
  FORMATS as FORMATS_LIST,
  LISTS as LISTS_LIST,
  PLAY_STATUSES,
  PRIORITIES as PRIORITIES_LIST,
  REGIONS as REGIONS_LIST,
  type Copy,
  type Game,
  type Library,
} from '../types.ts';

// The same choices the pickers offer (types.ts), so a value the app can save always passes.
const LISTS = new Set<string>(LISTS_LIST);
const STATUSES = new Set<string>(PLAY_STATUSES);
const FORMATS = new Set<string>(FORMATS_LIST);
const PRIORITIES = new Set<string>(PRIORITIES_LIST);
const COMPLETENESS = new Set<string>(COMPLETENESS_LIST);
const EDITIONS = new Set<string>(EDITIONS_LIST);
const REGIONS = new Set<string>(REGIONS_LIST);
const CONDITIONS = new Set<string>(CONDITIONS_LIST);

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const string = (value: unknown, max = 20_000): value is string => typeof value === 'string' && value.length <= max;
const optionalString = (value: unknown, max?: number) => value === undefined || string(value, max);
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
const optionalNumber = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);
const optionalDate = (value: unknown) => value === undefined || (string(value, 64) && Number.isFinite(Date.parse(value)));
const stringArray = (value: unknown, maxItems = 500, maxLength = 500) =>
  value === undefined || (Array.isArray(value) && value.length <= maxItems && value.every((item) => string(item, maxLength)));

export function isValidCopy(value: unknown): value is Copy {
  if (!object(value)) return false;
  return (
    optionalBoolean(value.steelbook) &&
    (value.pack === undefined || [1, 2, 3].includes(value.pack as number)) &&
    (value.completeness === undefined || (typeof value.completeness === 'string' && COMPLETENESS.has(value.completeness))) &&
    (value.edition === undefined || (typeof value.edition === 'string' && EDITIONS.has(value.edition))) &&
    (value.region === undefined || (typeof value.region === 'string' && REGIONS.has(value.region))) &&
    (value.condition === undefined || (typeof value.condition === 'string' && CONDITIONS.has(value.condition))) &&
    optionalString(value.ean, 32) &&
    optionalNumber(value.price, 0, 10_000_000) &&
    (value.currency === undefined || (typeof value.currency === 'string' && /^[A-Z]{3}$/.test(value.currency))) &&
    optionalBoolean(value.forSale) &&
    optionalString(value.location, 500) &&
    optionalString(value.lentTo, 500) &&
    optionalDate(value.lentAt)
  );
}

/** History entries follow the discriminated event shapes produced by lib/history.ts. */
function isValidHistoryEntry(value: unknown): boolean {
  if (!object(value) || typeof value.kind !== 'string' || !string(value.at, 64) || !Number.isFinite(Date.parse(value.at))) return false;
  const only = (allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key));
  const rating = (v: unknown) =>
    v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 10 && Number.isInteger(v * 2));
  const shortText = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

  switch (value.kind) {
    case 'added':
    case 'moved':
      return only(['kind', 'list', 'at']) && typeof value.list === 'string' && LISTS.has(value.list);
    case 'ordered':
    case 'orderCancelled':
    case 'reviewed':
      return only(['kind', 'at']);
    case 'status':
      return (
        only(['kind', 'from', 'to', 'at']) &&
        (value.from === undefined || (typeof value.from === 'string' && STATUSES.has(value.from))) &&
        (value.to === undefined || (typeof value.to === 'string' && STATUSES.has(value.to))) &&
        (value.from !== undefined || value.to !== undefined)
      );
    case 'rating':
      return (
        only(['kind', 'from', 'to', 'at']) && rating(value.from) && rating(value.to) && (value.from !== undefined || value.to !== undefined)
      );
    case 'copyAdded':
    case 'copyRemoved':
      return only(['kind', 'count', 'at']) && optionalNumber(value.count, 1, 100) && Number.isInteger(value.count);
    case 'lent':
    case 'returned':
      return only(['kind', 'who', 'at']) && shortText(value.who, 500);
    case 'tagged':
    case 'untagged':
      return only(['kind', 'tag', 'at']) && shortText(value.tag, 100);
    case 'edited':
      return (
        only(['kind', 'field', 'to', 'copy', 'at']) &&
        shortText(value.field, 100) &&
        (value.to === undefined ||
          typeof value.to === 'boolean' ||
          (typeof value.to === 'number' && Number.isFinite(value.to)) ||
          string(value.to, 500)) &&
        (value.copy === undefined || (optionalNumber(value.copy, 1, 100) && Number.isInteger(value.copy)))
      );
    default:
      return false;
  }
}

export function isValidGame(value: unknown): value is Game {
  if (!object(value)) return false;
  return (
    string(value.id, 200) &&
    value.id.length > 0 &&
    string(value.title, 500) &&
    value.title.trim().length > 0 &&
    typeof value.list === 'string' &&
    LISTS.has(value.list) &&
    string(value.addedAt, 64) &&
    Number.isFinite(Date.parse(value.addedAt)) &&
    optionalNumber(value.igdbId, 1) &&
    (value.igdbId === undefined || (typeof value.igdbId === 'number' && Number.isInteger(value.igdbId))) &&
    optionalString(value.igdbQuery, 500) &&
    optionalString(value.coverImageId, 500) &&
    optionalString(value.coverUrl, 4_000) &&
    optionalBoolean(value.coverHasBand) &&
    optionalNumber(value.releaseYear, 1950, 2200) &&
    (value.releaseYear === undefined || (typeof value.releaseYear === 'number' && Number.isInteger(value.releaseYear))) &&
    // format and backCompat are from earlier versions: still valid, read once by migrateGame.
    (value.format === undefined || (typeof value.format === 'string' && FORMATS.has(value.format))) &&
    optionalBoolean(value.digital) &&
    optionalNumber(value.digitalPrice, 0, 10_000_000) &&
    (value.digitalCurrency === undefined || (typeof value.digitalCurrency === 'string' && /^[A-Z]{3}$/.test(value.digitalCurrency))) &&
    optionalBoolean(value.wanted) &&
    optionalBoolean(value.demo) &&
    (value.playStatus === undefined || (typeof value.playStatus === 'string' && STATUSES.has(value.playStatus))) &&
    (value.priority === undefined || (typeof value.priority === 'string' && PRIORITIES.has(value.priority))) &&
    optionalDate(value.orderedAt) &&
    optionalString(value.notes, 20_000) &&
    optionalNumber(value.myRating, 1, 10) &&
    (value.myRating === undefined || (typeof value.myRating === 'number' && Number.isInteger(value.myRating * 2))) &&
    optionalString(value.review, 20_000) &&
    optionalString(value.summary, 20_000) &&
    stringArray(value.developers) &&
    stringArray(value.publishers) &&
    stringArray(value.series) &&
    optionalNumber(value.rating, 0, 100) &&
    (value.rating === undefined || (typeof value.rating === 'number' && Number.isInteger(value.rating))) &&
    (value.pegi === undefined || [3, 7, 12, 16, 18].includes(value.pegi as number)) &&
    optionalBoolean(value.coop) &&
    optionalBoolean(value.splitscreen) &&
    optionalNumber(value.localPlayers, 1, 256) &&
    (value.localPlayers === undefined || (typeof value.localPlayers === 'number' && Number.isInteger(value.localPlayers))) &&
    optionalNumber(value.hoursStory, 1, 100_000) &&
    (value.hoursStory === undefined || (typeof value.hoursStory === 'number' && Number.isInteger(value.hoursStory))) &&
    optionalNumber(value.hoursComplete, 1, 100_000) &&
    (value.hoursComplete === undefined || (typeof value.hoursComplete === 'number' && Number.isInteger(value.hoursComplete))) &&
    stringArray(value.genres) &&
    stringArray(value.tags, 500, 100) &&
    optionalBoolean(value.backCompat) &&
    (value.copies === undefined ||
      (Array.isArray(value.copies) &&
        value.copies.length <= 100 &&
        value.copies.every(isValidCopy) &&
        // No case at all only for a game owned digitally.
        (value.copies.length > 0 || value.digital === true))) &&
    (value.history === undefined ||
      (Array.isArray(value.history) && value.history.length <= 1_000 && value.history.every(isValidHistoryEntry)))
  );
}

export function isValidLibrary(value: unknown): value is Library {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.games) || value.games.length > 100_000) return false;
  if (!value.games.every(isValidGame)) return false;
  const ids = value.games.map((game) => game.id);
  return new Set(ids).size === ids.length;
}
