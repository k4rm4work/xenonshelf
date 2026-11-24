// Bulk-adds games to data/games.json from a text file, one title per line.
//
//   npm run import -- titles.txt
//
// Line format:  <title> [| digital] [| wishlist] [| playing|completed|dropped] [| high|low]
// Lines starting with # are ignored. Titles are matched against IGDB (Xbox 360 only);
// unmatched titles are still added without a cover and reported at the end.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pickBestMatch, searchXbox360Games, type IgdbSearchResult } from '../server/igdb.ts';
import { findDuplicate } from '../src/lib/games.ts';
import type { Game, Library } from '../src/types.ts';

const DATA_FILE = path.resolve(import.meta.dirname, '../data/games.json');

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import -- <file.txt>');
  process.exit(1);
}

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../.env.local'));
} catch {
  console.warn('No .env.local: games will be added without IGDB data.');
}
const env = { clientId: process.env.IGDB_CLIENT_ID, clientSecret: process.env.IGDB_CLIENT_SECRET };
const hasIgdb = Boolean(env.clientId && env.clientSecret);

// A fresh clone has no library yet; the first import starts an empty one.
const library = JSON.parse(
  await fs.readFile(DATA_FILE, 'utf8').catch(() => fs.readFile(path.join(import.meta.dirname, '../data/starter-library.json'), 'utf8')),
) as Library;
const lines = (await fs.readFile(file, 'utf8'))
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

const report = { added: [] as string[], skipped: [] as string[], noMatch: [] as string[] };

for (const line of lines) {
  const [, ...flags] = line.split('|').map((s) => s.trim().toLowerCase());
  const title = line.split('|')[0].trim();
  const has = (flag: string) => flags.includes(flag);

  let match: IgdbSearchResult | undefined;
  if (hasIgdb) {
    try {
      match = pickBestMatch(title, await searchXbox360Games(title, env))?.result;
    } catch (e) {
      console.warn(`IGDB error for "${title}": ${(e as Error).message}`);
    }
  }
  const base = match ?? { title };

  const duplicate = findDuplicate(library.games, base);
  if (duplicate) {
    report.skipped.push(`${title} → already there as "${duplicate.title}"`);
    continue;
  }

  const list = has('wishlist') ? 'wishlist' : 'owned';
  const game: Game = {
    ...base,
    id: match ? `igdb-${match.igdbId}` : crypto.randomUUID(),
    list,
    ...(list === 'owned'
      ? {
          ...(has('digital') && { digital: true, copies: [] }),
          playStatus: has('playing') ? 'playing' : has('completed') ? 'completed' : has('dropped') ? 'dropped' : 'unplayed',
        }
      : { priority: has('high') ? 'high' : has('low') ? 'low' : 'medium' }),
    addedAt: new Date().toISOString(),
  };
  library.games.push(game);
  (match ? report.added : report.noMatch).push(match && match.title !== title ? `${title} → ${match.title}` : title);
}

await fs.writeFile(DATA_FILE, JSON.stringify(library, null, 2) + '\n', 'utf8');

console.log(`\nAdded from IGDB (${report.added.length}):`);
report.added.forEach((t) => console.log(`  ✓ ${t}`));
if (report.noMatch.length) {
  console.log(`\nAdded without an IGDB match (${report.noMatch.length}):`);
  report.noMatch.forEach((t) => console.log(`  ? ${t}`));
}
if (report.skipped.length) {
  console.log(`\nSkipped duplicates (${report.skipped.length}):`);
  report.skipped.forEach((t) => console.log(`  – ${t}`));
}
