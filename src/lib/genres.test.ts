import { describe, expect, it } from 'vitest';
import { genreIds, withGenreIds } from './genres';

describe('genreIds', () => {
  it('maps IGDB names to ids, merges duplicates and keeps unknown names', () => {
    expect(genreIds(['Real Time Strategy (RTS)', 'Strategy', 'MOBA'])).toEqual(['strategy', 'MOBA']);
  });

  it('reads the Polish names genres were once stored under', () => {
    expect(genreIds(['Strzelanka', 'Zręcznościowa', 'shooter'])).toEqual(['shooter', 'arcade']);
  });
});

describe('withGenreIds', () => {
  it('gives every game in a library its genres as ids, leaving the rest as it is', () => {
    const library = { version: 1, games: [{ id: 'a', genres: ['RPG', 'Wyścigi'] }, { id: 'b' }] };
    expect(withGenreIds(library)).toEqual({ version: 1, games: [{ id: 'a', genres: ['rpg', 'racing'] }, { id: 'b' }] });
  });

  it('passes anything that is not a library through', () => {
    expect(withGenreIds({ error: 'x' })).toEqual({ error: 'x' });
  });
});
