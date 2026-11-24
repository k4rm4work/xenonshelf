// Refreshes data/backcompat.json: the Xbox 360 games that play on Xbox One and Series X|S,
// taken from Wikipedia's list (Microsoft keeps no machine-readable one). The list stopped
// growing in November 2021, so this rarely needs running again.
//
//   npm run backcompat
import { promises as fs } from 'node:fs';
import path from 'node:path';

const PAGE = 'List_of_backward-compatible_games_for_Xbox_One_and_Series_X/S';
const OUT = path.resolve(import.meta.dirname, '../data/backcompat.json');

const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(PAGE)}&prop=wikitext&format=json&formatversion=2`;
const res = await fetch(url, { headers: { 'User-Agent': 'XenonShelf (personal game collection app)' } });
if (!res.ok) {
  console.error(`Wikipedia answered ${res.status}`);
  process.exit(1);
}
const wikitext = ((await res.json()) as { parse: { wikitext: string } }).parse.wikitext;

// The Xbox 360 table, up to the end of its markup.
const start = wikitext.indexOf('id="360softwarelist"');
const end = wikitext.indexOf('\n|}', start);
if (start < 0 || end < 0) {
  console.error('No table of Xbox 360 games found: the page layout has changed.');
  process.exit(1);
}

// Each row opens with its title cell, some with a sort key before the bar:
// !scope=row data-sort-value="…" | ''[[Article|Shown title]]''
const titles = [...wikitext.slice(start, end).matchAll(/^!\s*scope=row[^|\n]*\|\s*(.+)$/gm)]
  .map(([, cell]) =>
    cell
      .replace(/<ref[^>]*\/>|<ref[^>]*>.*?<\/ref>/g, '')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/\{\{[^}]*\}\}/g, '')
      .replace(/'{2,}/g, '')
      .trim(),
  )
  .filter(Boolean);

const unique = [...new Set(titles)].sort((a, b) => a.localeCompare(b, 'en'));
await fs.writeFile(OUT, JSON.stringify({ source: `https://en.wikipedia.org/wiki/${PAGE}`, titles: unique }, null, 2) + '\n');
console.log(`Saved ${unique.length} games to ${path.relative(process.cwd(), OUT)}`);
