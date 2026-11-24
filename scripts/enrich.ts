// Fills in IGDB data for games already in data/games.json: the id, release year and genres,
// then the details shown in the game view (series, developers, modes, ratings, play time…).
//
//   npm run enrich            match games without an igdbId; fetch details they lack
//   npm run enrich -- --all   match and refresh every game
//   npm run enrich -- --dry   show what would change, write nothing
//
// Games whose shelf title is localised can carry an English `igdbQuery`.
// Only exact or close title matches are applied; anything else is reported, never guessed.
// Own covers (coverUrl) are kept; the IGDB cover id is stored as a fallback.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fetchGameDetails, IGDB_DETAIL_KEYS, pickBestMatch, searchXbox360Games } from '../server/igdb.ts';
import { createSetup } from '../server/setup.ts';
import type { Library } from '../src/types.ts';

// LIBRARY_FILE points at the live library on the self-hosted server.
const DATA_FILE = path.resolve(process.env.LIBRARY_FILE ?? path.join(import.meta.dirname, '../data/games.json'));
const all = process.argv.includes('--all');
const dry = process.argv.includes('--dry');

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../.env.local'));
} catch {
  // Reported below together with missing keys.
}
// The keys from the environment, else those set in the app, kept beside the library.
const env = createSetup({ configFile: path.join(path.dirname(DATA_FILE), 'config.json'), env: process.env }).igdbEnv();
if (!env.clientId || !env.clientSecret) {
  console.error('No IGDB keys: add them in the app (Settings → Server) or in .env.local, see DEVELOPMENT.md.');
  process.exit(1);
}

// IGDB allows 4 requests per second.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const library = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')) as Library;
const todo = library.games.filter((g) => all || g.igdbId === undefined);
const report = { exact: [] as string[], close: [] as string[], missing: [] as string[] };

for (const [i, game] of todo.entries()) {
  const query = game.igdbQuery ?? game.title;
  process.stdout.write(`\r[${i + 1}/${todo.length}] ${query.padEnd(60).slice(0, 60)}`);
  let match;
  try {
    match = pickBestMatch(query, await searchXbox360Games(query, env));
  } catch (e) {
    report.missing.push(`${game.title} (error: ${(e as Error).message})`);
    continue;
  } finally {
    await sleep(300);
  }
  if (!match) {
    report.missing.push(game.title);
    continue;
  }
  const { result, confidence } = match;
  // Year and genres are only filled in when missing: ones already on the shelf may be
  // hand-picked (IGDB lists many genres per game). Differences are reported instead.
  const changes: string[] = [];
  if (result.releaseYear && game.releaseYear === undefined) changes.push(`year → ${result.releaseYear}`);
  else if (result.releaseYear && result.releaseYear !== game.releaseYear)
    changes.push(`year ${game.releaseYear} (IGDB: ${result.releaseYear})`);
  if (result.genres?.length && !game.genres?.length) changes.push(`genres → ${result.genres.join(', ')}`);

  game.igdbId = result.igdbId;
  game.releaseYear ??= result.releaseYear;
  if (!game.genres?.length && result.genres?.length) game.genres = result.genres;
  if (result.coverImageId) game.coverImageId = result.coverImageId;

  const line = `${game.title}${result.title !== game.title ? ` = "${result.title}"` : ''}${changes.length ? `: ${changes.join('; ')}` : ''}`;
  report[confidence].push(line);
}
process.stdout.write('\n');

// Details for every matched game that has never had them (or all of them with --all).
// A game counts as done once it has a developer or a summary; IGDB has those for nearly all.
const needDetails = library.games.filter((g) => g.igdbId !== undefined && (all || (g.developers === undefined && g.summary === undefined)));
let detailed = 0;
if (needDetails.length) {
  console.log(`Fetching details for ${needDetails.length} games…`);
  const details = await fetchGameDetails([...new Set(needDetails.map((g) => g.igdbId!))], env);
  for (const game of needDetails) {
    const found = details.get(game.igdbId!);
    if (!found) continue;
    for (const key of IGDB_DETAIL_KEYS) delete game[key];
    Object.assign(game, found);
    detailed++;
  }
}

if (!dry) await fs.writeFile(DATA_FILE, JSON.stringify(library, null, 2) + '\n', 'utf8');

console.log(`\nExact matches (${report.exact.length}):`);
report.exact.forEach((t) => console.log(`  ✓ ${t}`));
if (report.close.length) {
  console.log(`\nMatched by a similar title, worth a look (${report.close.length}):`);
  report.close.forEach((t) => console.log(`  ~ ${t}`));
}
if (report.missing.length) {
  console.log(`\nNo match, nothing changed (${report.missing.length}):`);
  report.missing.forEach((t) => console.log(`  ? ${t}`));
  console.log('  Tip: give the game an "igdbQuery" field with its English title and run again.');
}
console.log(`\nDetails (series, modes, developer, ratings, play time): ${detailed} games.`);
console.log(dry ? '\n--dry: nothing saved.' : `\nSaved ${DATA_FILE}.`);
