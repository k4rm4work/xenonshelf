export type GameList = 'owned' | 'wishlist';
export type PlayStatus = 'unplayed' | 'playing' | 'completed' | 'dropped';
export type Priority = 'high' | 'medium' | 'low';
export type GameFormat = 'physical' | 'digital';

/** Facts about a game taken from IGDB (`npm run enrich`, or when it is added). IGDB often
    lacks some of them, so each one is optional; flags are stored only when true. */
export type IgdbDetails = {
  /** IGDB's short description; IGDB has it in English only. */
  summary?: string;
  developers?: string[];
  publishers?: string[];
  /** Series the game belongs to, broadest first, e.g. ["Call of Duty", "Call of Duty: Modern Warfare"]. */
  series?: string[];
  /** Critics' average, 0–100. */
  rating?: number;
  /** PEGI age rating: 3, 7, 12, 16 or 18. */
  pegi?: number;
  /** Has a co-operative mode, online or on one console. */
  coop?: boolean;
  /** Several people can play on one screen. */
  splitscreen?: boolean;
  /** Most players on one Xbox 360, when IGDB knows it. */
  localPlayers?: number;
  /** Typical hours to finish the story, and to complete everything. */
  hoursStory?: number;
  hoursComplete?: number;
};

export type Game = IgdbDetails & {
  id: string;
  igdbId?: number;
  /** English title used to find the game in IGDB when the shelf title is localised. */
  igdbQuery?: string;
  title: string;
  coverImageId?: string;
  /** Own cover image (relative to the site root or absolute URL); wins over coverImageId. */
  coverUrl?: string;
  /** The cover scan already shows the printed Xbox 360 header, so none is drawn. */
  coverHasBand?: boolean;
  releaseYear?: number;
  genres?: string[];
  list: GameList;
  /** Owned as a download from Xbox Live. A game can be owned both ways: its cases are in
      `copies`, which is empty ([]) when there are none. */
  digital?: boolean;
  /** What the download cost, like a copy's `price` and `currency`. */
  digitalPrice?: number;
  digitalCurrency?: string;
  /** In the collection, yet still hunted for on a shelf, e.g. owned digitally while a boxed
      copy is sought: it shows on the wishlist too, at its `priority`. */
  wanted?: boolean;
  /** Only the trial version, e.g. a demo downloaded from Xbox Live. */
  demo?: boolean;
  playStatus?: PlayStatus;
  priority?: Priority;
  /** Wishlist only: set when the game is ordered and on its way. */
  orderedAt?: string;
  notes?: string;
  /** Own score in half stars, 1–10 (10 is five stars); absent until given. */
  myRating?: number;
  /** A few lines of what the player thought of it. */
  review?: string;
  /** Own labels, e.g. "party", "with Kasia"; each one also works as a collection to filter by. */
  tags?: string[];
  addedAt: string;
  /** The physical copies owned. Absent means one copy with nothing noted about it, which
      is most games; empty means none, for a game owned only digitally. See copiesOf in
      lib/games.ts. The first one is the case on the shelf. */
  copies?: Copy[];
  /** What happened to the game, oldest first (see lib/history.ts). Kept since 2026-11; older
      games show only when they were added. */
  history?: HistoryEntry[];
};

/** One line in a game's history. Ratings are in half stars like myRating. */
export type HistoryEvent =
  | { kind: 'added' | 'moved'; list: GameList }
  | { kind: 'ordered' | 'orderCancelled' | 'reviewed' }
  | { kind: 'status'; from?: PlayStatus; to?: PlayStatus }
  | { kind: 'rating'; from?: number; to?: number }
  | { kind: 'copyAdded' | 'copyRemoved'; count: number }
  | { kind: 'lent' | 'returned'; who: string }
  | { kind: 'tagged' | 'untagged'; tag: string }
  /** A detail of the game, or of a copy (numbered when there are several). Short values are
      kept; text like notes is only noted as edited. */
  | { kind: 'edited'; field: string; to?: string | number | boolean; copy?: number };

/** An event and when it happened (ISO date and time). */
export type HistoryEntry = HistoryEvent & { at: string };

/** What a collector notes about one physical copy. A collector may keep several of one
    game, e.g. a plain one and a SteelBook, or spares to sell. All optional. */
export type Copy = {
  /** A metal SteelBook case instead of the green plastic one. */
  steelbook?: boolean;
  /** Games sharing this case, e.g. 2 for a Double Pack; absent for a single game. */
  pack?: number;
  completeness?: Completeness;
  edition?: Edition;
  region?: Region;
  condition?: Condition;
  /** Barcode on the back of the case (EAN-13), typed in by hand. */
  ean?: string;
  /** What the copy cost; `currency` (an ISO 4217 code such as "EUR") only when it was written with one. */
  price?: number;
  currency?: string;
  /** Up for sale; the format filter lists these for an advert. */
  forSale?: boolean;
  /** Where the case is kept, e.g. "Living room shelf" or "Box 3 in the attic". */
  location?: string;
  /** Who has the copy on loan, and since when (YYYY-MM-DD); both clear when it comes back. */
  lentTo?: string;
  lentAt?: string;
};

export type Completeness = 'disc' | 'case' | 'cib' | 'sealed';
export type Edition = 'standard' | 'classics' | 'goty' | 'limited' | 'collectors';
export type Region = 'pal' | 'ntsc-u' | 'ntsc-j';
export type Condition = 'mint' | 'good' | 'worn';

export type Library = {
  version: 1;
  games: Game[];
};

export type IgdbSearchResult = {
  igdbId: number;
  title: string;
  /** The other name the game was found by, e.g. its Polish title. */
  alias?: string;
  /** IGDB's own name, kept when the game is shelved under the one it was found by. */
  igdbQuery?: string;
  coverImageId?: string;
  releaseYear?: number;
  genres?: string[];
};

// Choices in the order pickers show them; their labels live in lib/i18n.tsx.
export const LISTS: GameList[] = ['owned', 'wishlist'];

export const PLAY_STATUSES: PlayStatus[] = ['unplayed', 'playing', 'completed', 'dropped'];

export const FORMATS: GameFormat[] = ['physical', 'digital'];

export type PackSize = '1' | '2' | '3';

export const PACK_SIZES: PackSize[] = ['1', '2', '3'];

export const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

export const COMPLETENESS: Completeness[] = ['disc', 'case', 'cib', 'sealed'];

export const EDITIONS: Edition[] = ['standard', 'classics', 'goty', 'limited', 'collectors'];

export const REGIONS: Region[] = ['pal', 'ntsc-u', 'ntsc-j'];

export const CONDITIONS: Condition[] = ['mint', 'good', 'worn'];
