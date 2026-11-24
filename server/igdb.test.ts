import { describe, expect, it } from 'vitest';
import { exactTitlesFirst, mapIgdbDetails, mapIgdbGame, pickBestMatch } from './igdb';

describe('mapIgdbGame', () => {
  it('maps a full IGDB record', () => {
    expect(
      mapIgdbGame({
        id: 1020,
        name: 'Grand Theft Auto IV',
        cover: { image_id: 'co2lbv' },
        first_release_date: 1209427200, // 2008-04-29
        genres: [{ name: 'Shooter' }, { name: 'Adventure' }],
      }),
    ).toEqual({
      igdbId: 1020,
      title: 'Grand Theft Auto IV',
      coverImageId: 'co2lbv',
      releaseYear: 2008,
      genres: ['shooter', 'adventure'],
    });
  });

  it('tolerates missing optional fields', () => {
    expect(mapIgdbGame({ id: 5, name: 'Obscure' })).toEqual({
      igdbId: 5,
      title: 'Obscure',
      coverImageId: undefined,
      releaseYear: undefined,
      genres: undefined,
    });
  });
});

describe('pickBestMatch', () => {
  const r = (igdbId: number, title: string) => ({ igdbId, title });

  it('prefers an exact title over the first result', () => {
    const results = [r(1, 'Halo 3: ODST'), r(2, 'Halo 3')];
    expect(pickBestMatch('Halo 3', results)).toEqual({ result: results[1], confidence: 'exact' });
  });

  it('ignores punctuation and trademark signs', () => {
    expect(pickBestMatch("Tom Clancy's H.A.W.X", [r(3, "Tom Clancy's HAWX")])?.confidence).toBe('exact');
    expect(pickBestMatch('BioShock™', [r(4, 'BioShock')])?.confidence).toBe('exact');
  });

  it('matches a game by the other name it was found by', () => {
    const witcher = { ...r(478, 'The Witcher 2: Assassins of Kings'), alias: 'Wiedźmin 2: Zabójcy królów' };
    expect(pickBestMatch('Wiedźmin 2: Zabójcy Królów', [witcher])).toEqual({ result: witcher, confidence: 'exact' });
    expect(pickBestMatch('Wiedźmin 2', [witcher])?.confidence).toBe('close');
  });

  it('reads Roman numerals and digits as the same title', () => {
    expect(pickBestMatch('Gears of War II', [r(7, 'Gears of War 2')])?.confidence).toBe('exact');
    expect(pickBestMatch('Fable 2', [r(8, 'Fable II')])?.confidence).toBe('exact');
  });

  it('accepts a subtitle or edition as a close match', () => {
    expect(pickBestMatch('Burnout Paradise', [r(5, 'Burnout Paradise: The Ultimate Box')])?.confidence).toBe('close');
  });

  it('returns nothing rather than guessing an unrelated game', () => {
    expect(pickBestMatch('Auta 2', [r(6, 'Cars 2: The Video Game')])).toBeUndefined();
  });

  it('requires whole-word boundaries for approximate matches', () => {
    expect(pickBestMatch('Halo', [r(9, 'Halogen')])).toBeUndefined();
    expect(pickBestMatch('Halo 3', [r(10, 'Halo 30')])).toBeUndefined();
    expect(pickBestMatch('Halo 3', [r(11, 'Halo 3: ODST')])?.confidence).toBe('close');
  });
});

describe('exactTitlesFirst', () => {
  const r = (igdbId: number, title: string) => ({ igdbId, title });

  it('puts the game whose name was typed ahead of bundles and editions', () => {
    // IGDB's own order for "Halo 3", seen on 2026-11-24.
    const results = [r(1, 'Halo 3 + Halo Wars'), r(2, 'Halo 3: Legendary Edition'), r(3, 'Halo 3: ODST'), r(4, 'Halo 3')];
    expect(exactTitlesFirst('Halo 3', results).map((x) => x.igdbId)).toEqual([4, 1, 2, 3]);
  });

  it('reads the title the way the import does', () => {
    expect(exactTitlesFirst('gears of war ii', [r(1, 'Gears of War 3'), r(2, 'Gears of War 2')])[0].igdbId).toBe(2);
  });

  it('keeps IGDB order when nothing matches exactly', () => {
    const results = [r(1, 'Halo 3: ODST'), r(2, 'Halo Wars')];
    expect(exactTitlesFirst('Halo', results)).toEqual(results);
  });
});

describe('mapIgdbDetails', () => {
  it('maps companies, series, ratings, modes and play time', () => {
    expect(
      mapIgdbDetails(
        {
          id: 548,
          summary: ' A shooter. ',
          involved_companies: [
            { developer: true, company: { name: 'Epic Games' } },
            { publisher: true, company: { name: 'Microsoft Game Studios' } },
          ],
          collections: [{ name: 'Gears of War: Trilogy' }, { name: 'Gears of War' }],
          aggregated_rating: 92.6,
          age_ratings: [
            { organization: 1, rating_category: { rating: 'M' } },
            { organization: 2, rating_category: { rating: '18' } },
          ],
          game_modes: [{ name: 'Single player' }, { name: 'Co-operative' }],
          multiplayer_modes: [
            { platform: 6, offlinecoopmax: 8 },
            { platform: 12, offlinecoop: true, splitscreen: true, offlinecoopmax: 2 },
          ],
        },
        { game_id: 548, normally: 9 * 3600 + 1200, completely: 20 * 3600 },
      ),
    ).toEqual({
      summary: 'A shooter.',
      developers: ['Epic Games'],
      publishers: ['Microsoft Game Studios'],
      series: ['Gears of War', 'Gears of War: Trilogy'],
      rating: 93,
      pegi: 18,
      coop: true,
      splitscreen: true,
      localPlayers: 2,
      hoursStory: 9,
      hoursComplete: 20,
    });
  });

  it('leaves out what IGDB does not know, and ignores other platforms', () => {
    expect(
      mapIgdbDetails({ id: 1, game_modes: [{ name: 'Single player' }], multiplayer_modes: [{ platform: 6, splitscreen: true }] }),
    ).toEqual({});
  });
});
