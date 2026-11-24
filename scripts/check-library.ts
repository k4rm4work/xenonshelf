// Checks a library file against the rules every save must pass (src/lib/validateLibrary.ts)
// and names the games that would fail. Reads only; changes nothing.
//
//   npm run check-library -- path/to/games.json
//   (in the container: node scripts/check-library.ts /data/games.json)

import { readFileSync } from 'node:fs';
import { isValidCopy, isValidGame, isValidLibrary } from '../src/lib/validateLibrary.ts';

const file = process.argv[2] ?? process.env.LIBRARY_FILE ?? 'data/games.json';
const data = JSON.parse(readFileSync(file, 'utf8'));
const games: Record<string, unknown>[] = Array.isArray(data?.games) ? data.games : [];

if (isValidLibrary(data)) {
  console.log(`OK: ${file}, ${games.length} games, every save will pass.`);
  process.exit(0);
}

console.log(`PROBLEM: ${file} would be refused on save.`);
if (data?.version !== 1 || !Array.isArray(data?.games)) console.log('- not a version 1 library with a list of games');
const ids = new Set<unknown>();
for (const game of games) {
  if (ids.has(game.id)) console.log(`- duplicate id ${String(game.id)}`);
  ids.add(game.id);
  if (isValidGame(game)) continue;
  // Name the fields at fault: each one in turn, the rest of the game left as it is.
  const bare = { id: game.id, title: game.title, list: game.list, addedAt: game.addedAt };
  const fields = Object.keys(game).filter((key) => {
    if (key === 'copies' && Array.isArray(game.copies)) return !game.copies.every(isValidCopy);
    return !isValidGame({ ...bare, [key]: game[key] });
  });
  console.log(
    `- ${String(game.title ?? game.id)}: ${fields.length ? fields.map((k) => `${k}=${JSON.stringify(game[k])}`).join(', ') : 'id, title, list or addedAt'}`,
  );
}
process.exit(1);
