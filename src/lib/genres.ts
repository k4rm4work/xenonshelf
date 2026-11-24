// Genres are stored by these ids and named in each language as `genre.<id>` (lib/i18n).
// IGDB's names map onto them; a name IGDB gives that has no id here is kept as it comes.
export const GENRES = [
  'shooter',
  'racing',
  'adventure',
  'platform',
  'rpg',
  'strategy',
  'sport',
  'music',
  'fighting',
  'hack-and-slash',
  'arcade',
  'simulator',
  'puzzle',
  'party',
  'board',
  'indie',
  // Not an IGDB genre (it lists stealth as a theme), but one collectors file games under.
  'stealth',
] as const;

export type Genre = (typeof GENRES)[number];

const FROM_IGDB: Record<string, Genre> = {
  Shooter: 'shooter',
  Racing: 'racing',
  Adventure: 'adventure',
  Platform: 'platform',
  'Role-playing (RPG)': 'rpg',
  Strategy: 'strategy',
  'Real Time Strategy (RTS)': 'strategy',
  'Turn-based strategy (TBS)': 'strategy',
  Tactical: 'strategy',
  Sport: 'sport',
  Music: 'music',
  Fighting: 'fighting',
  "Hack and slash/Beat 'em up": 'hack-and-slash',
  Arcade: 'arcade',
  Pinball: 'arcade',
  Simulator: 'simulator',
  Puzzle: 'puzzle',
  'Quiz/Trivia': 'party',
  'Card & Board Game': 'board',
  'Point-and-click': 'adventure',
  'Visual Novel': 'adventure',
  Indie: 'indie',
};

/** The Polish names genres were stored under until 2026-11, read as the ids they became. */
const FORMER: Record<string, Genre> = {
  Strzelanka: 'shooter',
  Wyścigi: 'racing',
  Przygodowa: 'adventure',
  Platformowa: 'platform',
  RPG: 'rpg',
  Strategia: 'strategy',
  Sportowa: 'sport',
  Muzyczna: 'music',
  Bijatyka: 'fighting',
  Slasher: 'hack-and-slash',
  Zręcznościowa: 'arcade',
  Symulator: 'simulator',
  Logiczna: 'puzzle',
  Imprezowa: 'party',
  Planszowa: 'board',
  Niezależna: 'indie',
  Skradanka: 'stealth',
};

/** IGDB's genre names, or ones stored before the ids, as ids; several may fold into one. */
export const genreIds = (names: string[]) => [...new Set(names.map((name) => FROM_IGDB[name] ?? FORMER[name] ?? name))];

/** A library as read from disk, its games' genres given as ids. Saving it stores them so. */
export function withGenreIds<T>(library: T): T {
  const games = (library as { games?: unknown }).games;
  if (!Array.isArray(games)) return library;
  return {
    ...library,
    games: games.map((game: { genres?: unknown }) =>
      Array.isArray(game?.genres) ? { ...game, genres: genreIds(game.genres as string[]) } : game,
    ),
  };
}
