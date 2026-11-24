// IGDB access via Twitch client credentials. Runs on the server (Vite dev or the self-hosted one)
// and in the enrich/import scripts, never in the browser.
import { genreIds } from '../src/lib/genres.ts';
import { titleKey } from '../src/lib/titles.ts';
import type { IgdbDetails } from '../src/types.ts';

const XBOX_360_PLATFORM_ID = 12;

export type IgdbSearchResult = {
  igdbId: number;
  title: string;
  /** The other name the game was found by, e.g. its Polish title. */
  alias?: string;
  coverImageId?: string;
  releaseYear?: number;
  genres?: string[];
};

type RawIgdbGame = {
  id: number;
  name: string;
  cover?: { image_id?: string };
  first_release_date?: number;
  genres?: { name: string }[];
  game_status?: { status?: string };
};

/** A game IGDB knows was never released, e.g. Kameo 2: no one has it on a shelf. */
const isCancelled = (raw: RawIgdbGame) => raw.game_status?.status === 'Cancelled';

export class IgdbConfigError extends Error {}

const normalize = (s: string) =>
  s
    .toLocaleLowerCase('pl')
    .replace(/[®™]/g, '')
    // Dots and apostrophes join letters: H.A.W.X = HAWX, Clancy's = Clancys.
    .replace(/[.'’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export type MatchConfidence = 'exact' | 'close';

// titleKey also equates "II" with "2", "&" with "and" and drops a leading "The".
const forms = (s: string) => [normalize(s), titleKey(s)];
// A game is known by its own name and by the one it was found by, e.g. its Polish title.
const names = (r: IgdbSearchResult) => [r.title, ...(r.alias ? [r.alias] : [])].map(forms);

/** Whether a result is the game the title names, not merely one that contains it. */
function isExactTitle(title: string, result: IgdbSearchResult) {
  const wanted = forms(title);
  return names(result).some((f) => f.some((name, i) => name === wanted[i]));
}

/**
 * Picks the IGDB result for a shelf title. "exact" when the normalised names are equal,
 * "close" when one name contains the other (subtitles, editions); otherwise no match,
 * so a wrong game is never filled in silently.
 */
export function pickBestMatch(
  title: string,
  results: IgdbSearchResult[],
): { result: IgdbSearchResult; confidence: MatchConfidence } | undefined {
  const wanted = forms(title);
  const exact = results.find((r) => isExactTitle(title, r));
  if (exact) return { result: exact, confidence: 'exact' };
  const close = results.find((r) =>
    names(r).some((f) =>
      f.some((name, i) => {
        const target = wanted[i];
        return !!name && !!target && (name.startsWith(`${target} `) || target.startsWith(`${name} `));
      }),
    ),
  );
  return close && { result: close, confidence: 'close' };
}

/** IGDB's search ranks bundles and editions ("Halo 3 + Halo Wars") above the game whose
    name was typed; that game goes first, the rest keep IGDB's order. */
export function exactTitlesFirst(query: string, results: IgdbSearchResult[]): IgdbSearchResult[] {
  const exact = results.filter((r) => isExactTitle(query, r));
  return [...exact, ...results.filter((r) => !exact.includes(r))];
}

// Kept for the keys it was issued to: keys changed in the app's setup get a token of their own.
let cachedToken: { clientId: string; clientSecret: string; value: string; expiresAt: number } | null = null;

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken?.clientId === clientId && cachedToken.clientSecret === clientSecret && cachedToken.expiresAt > Date.now() + 60_000)
    return cachedToken.value;

  const url = new URL('https://id.twitch.tv/oauth2/token');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('grant_type', 'client_credentials');

  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch auth failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { clientId, clientSecret, value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

/** Whether Twitch accepts these keys, checked when they are entered in the app's setup;
    throws when Twitch can't be reached. */
export async function igdbKeysWork(clientId: string, clientSecret: string): Promise<boolean> {
  try {
    await getToken(clientId, clientSecret);
    return true;
  } catch (err) {
    // Twitch turned the keys down; anything else (no network) is not their fault.
    if ((err as Error).message.startsWith('Twitch auth failed')) return false;
    throw err;
  }
}

export function mapIgdbGame(raw: RawIgdbGame): IgdbSearchResult {
  return {
    igdbId: raw.id,
    title: raw.name,
    coverImageId: raw.cover?.image_id,
    releaseYear: raw.first_release_date ? new Date(raw.first_release_date * 1000).getUTCFullYear() : undefined,
    genres: raw.genres && genreIds(raw.genres.map((g) => g.name)),
  };
}

type Env = { clientId?: string; clientSecret?: string };

/** One APIcalypse query against an IGDB endpoint. */
async function queryIgdb<T>(endpoint: string, body: string, env: Env): Promise<T[]> {
  if (!env.clientId || !env.clientSecret) {
    throw new IgdbConfigError('No IGDB keys: add them in the app under Settings → Server.');
  }
  const token = await getToken(env.clientId, env.clientSecret);
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': env.clientId,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body,
  });
  if (res.status === 401) cachedToken = null;
  if (!res.ok) throw new Error(`IGDB request failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

const GAME_FIELDS = 'name, cover.image_id, first_release_date, genres.name, game_status.status';

/**
 * Xbox 360 games for a title, cancelled ones left out. IGDB's search knows only the
 * English names; when it finds nothing, the title is looked up among the other names
 * IGDB keeps, where the Polish ones are ("Wiedźmin 2" → The Witcher 2).
 */
export async function searchXbox360Games(query: string, env: Env): Promise<IgdbSearchResult[]> {
  const escaped = query.replace(/["\\]/g, '');
  const body = [`search "${escaped}";`, `fields ${GAME_FIELDS};`, `where platforms = (${XBOX_360_PLATFORM_ID});`, 'limit 20;'].join(' ');
  const found = (await queryIgdb<RawIgdbGame>('games', body, env)).filter((raw) => !isCancelled(raw)).map(mapIgdbGame);
  return exactTitlesFirst(query, found.length ? found : await searchByOtherNames(escaped, env));
}

type RawAlternativeName = { name: string; game?: RawIgdbGame };

async function searchByOtherNames(escaped: string, env: Env): Promise<IgdbSearchResult[]> {
  const body = [
    `fields name, ${GAME_FIELDS.split(', ')
      .map((f) => `game.${f}`)
      .join(', ')};`,
    `where name ~ *"${escaped}"* & game.platforms = (${XBOX_360_PLATFORM_ID});`,
    'limit 20;',
  ].join(' ');
  const seen = new Set<number>();
  return (await queryIgdb<RawAlternativeName>('alternative_names', body, env)).flatMap(({ name, game }) => {
    if (!game || isCancelled(game) || seen.has(game.id)) return [];
    seen.add(game.id);
    return [{ ...mapIgdbGame(game), alias: name }];
  });
}

type RawIgdbDetails = {
  id: number;
  summary?: string;
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: { name: string } }[];
  collections?: { name: string }[];
  aggregated_rating?: number;
  age_ratings?: { organization?: number; rating_category?: { rating?: string } }[];
  game_modes?: { name: string }[];
  multiplayer_modes?: {
    platform?: number;
    offlinecoop?: boolean;
    onlinecoop?: boolean;
    splitscreen?: boolean;
    offlinecoopmax?: number;
    offlinemax?: number;
  }[];
};

/** Typical play times in seconds, from IGDB's player submissions. */
export type RawTimeToBeat = { game_id: number; normally?: number; completely?: number };

const PEGI_ORGANIZATION = 2;

const hours = (seconds?: number) => (seconds ? Math.max(1, Math.round(seconds / 3600)) : undefined);
const unique = (names: (string | undefined)[]) => [...new Set(names.filter((n): n is string => !!n))];

export function mapIgdbDetails(raw: RawIgdbDetails, time?: RawTimeToBeat): IgdbDetails {
  const companies = raw.involved_companies ?? [];
  const modes = new Set((raw.game_modes ?? []).map((m) => m.name));
  // Multiplayer details are per platform; only the Xbox 360 ones describe this copy.
  const x360 = (raw.multiplayer_modes ?? []).filter((m) => m.platform === XBOX_360_PLATFORM_ID);
  const localPlayers = Math.max(0, ...x360.map((m) => Math.max(m.offlinecoopmax ?? 0, m.offlinemax ?? 0)));
  const pegi = Number(raw.age_ratings?.find((a) => a.organization === PEGI_ORGANIZATION)?.rating_category?.rating);
  const series = unique((raw.collections ?? []).map((c) => c.name)).sort((a, b) => a.length - b.length);
  const developers = unique(companies.filter((c) => c.developer).map((c) => c.company?.name));
  const publishers = unique(companies.filter((c) => c.publisher).map((c) => c.company?.name));

  const details: IgdbDetails = {
    summary: raw.summary?.trim() || undefined,
    developers: developers.length ? developers : undefined,
    publishers: publishers.length ? publishers : undefined,
    series: series.length ? series : undefined,
    rating: raw.aggregated_rating === undefined ? undefined : Math.round(raw.aggregated_rating),
    pegi: Number.isFinite(pegi) ? pegi : undefined,
    coop: modes.has('Co-operative') || x360.some((m) => m.offlinecoop || m.onlinecoop) || undefined,
    splitscreen: modes.has('Split screen') || x360.some((m) => m.splitscreen) || undefined,
    localPlayers: localPlayers > 1 ? localPlayers : undefined,
    hoursStory: hours(time?.normally),
    hoursComplete: hours(time?.completely),
  };
  // Leave absent facts out entirely, so stored games carry only what IGDB knows.
  return Object.fromEntries(Object.entries(details).filter(([, v]) => v !== undefined)) as IgdbDetails;
}

/** Every IgdbDetails key, so a refresh can clear facts IGDB no longer has. */
export const IGDB_DETAIL_KEYS: (keyof IgdbDetails)[] = [
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
];

const DETAIL_FIELDS = [
  'summary',
  'involved_companies.developer',
  'involved_companies.publisher',
  'involved_companies.company.name',
  'collections.name',
  'aggregated_rating',
  'age_ratings.organization',
  'age_ratings.rating_category.rating',
  'game_modes.name',
  'multiplayer_modes.*',
].join(', ');

/** IGDB answers at most 500 rows per query; stay well below. */
const BATCH = 100;

// IGDB allows 4 requests per second.
const pause = () => new Promise((r) => setTimeout(r, 260));

/** Details for the given IGDB ids; ids IGDB does not know are left out of the map. */
export async function fetchGameDetails(ids: number[], env: Env): Promise<Map<number, IgdbDetails>> {
  const result = new Map<number, IgdbDetails>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH).join(',');
    const games = await queryIgdb<RawIgdbDetails>('games', `fields ${DETAIL_FIELDS}; where id = (${chunk}); limit ${BATCH};`, env);
    await pause();
    const times = await queryIgdb<RawTimeToBeat>(
      'game_time_to_beats',
      `fields game_id, normally, completely; where game_id = (${chunk}); limit ${BATCH};`,
      env,
    );
    await pause();
    const timeOf = new Map(times.map((t) => [t.game_id, t]));
    for (const game of games) result.set(game.id, mapIgdbDetails(game, timeOf.get(game.id)));
  }
  return result;
}

/** A title from an import, with IGDB's best guess and the other candidates to pick from. */
export type TitleMatch = {
  title: string;
  results: IgdbSearchResult[];
  match?: { igdbId: number; confidence: MatchConfidence };
};

/** Looks up a batch of titles one after another, keeping under IGDB's rate limit. */
export async function matchTitles(titles: string[], env: Env): Promise<TitleMatch[]> {
  const matches: TitleMatch[] = [];
  for (const title of titles) {
    const results = await searchXbox360Games(title, env);
    const best = pickBestMatch(title, results);
    // A few candidates are plenty to choose from, as long as the picked one is among them.
    const shown = results.slice(0, 8);
    if (best && !shown.includes(best.result)) shown.push(best.result);
    matches.push({
      title,
      results: shown,
      match: best && { igdbId: best.result.igdbId, confidence: best.confidence },
    });
    await pause();
  }
  return matches;
}
