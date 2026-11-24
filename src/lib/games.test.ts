import { describe, expect, it } from 'vitest';
import type { Game } from '../types';
import {
  copiesOf,
  filterOptions,
  findDuplicate,
  findNearDuplicate,
  shelvedAs,
  libraryStats,
  markAsOwned,
  migrateGame,
  queryGames,
  shelfCopy,
  storedCopies,
  toggleOrdered,
  withCopy,
  withTag,
  type GameQuery,
} from './games';

const game = (over: Partial<Game>): Game => ({
  id: over.title ?? 'x',
  title: 'x',
  list: 'owned',
  addedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const games: Game[] = [
  game({ title: 'Halo 3', releaseYear: 2007, genres: ['Shooter'], playStatus: 'completed', addedAt: '2026-01-02T00:00:00Z' }),
  game({ title: 'Alan Wake', releaseYear: 2010, genres: ['Adventure'], playStatus: 'playing', addedAt: '2026-01-03T00:00:00Z' }),
  game({ title: 'Gears of War', releaseYear: 2006, genres: ['Shooter'], addedAt: '2026-01-01T00:00:00Z' }),
  game({ title: 'Zoo Tycoon', digital: true, copies: [] }),
  game({ title: 'Fable II', list: 'wishlist', priority: 'low' }),
  game({ title: 'Mass Effect', list: 'wishlist', priority: 'high' }),
];

const titles = (gs: Game[]) => gs.map((g) => g.title);
const owned = (q: Partial<GameQuery>) => titles(queryGames(games, { list: 'owned', sort: 'title', direction: 'asc', ...q }));

describe('queryGames', () => {
  it('filters by list and sorts by title in both directions', () => {
    expect(owned({})).toEqual(['Alan Wake', 'Gears of War', 'Halo 3', 'Zoo Tycoon']);
    expect(owned({ direction: 'desc' })).toEqual(['Zoo Tycoon', 'Halo 3', 'Gears of War', 'Alan Wake']);
  });

  it('sorts by year and keeps games without a year last in both directions', () => {
    expect(owned({ sort: 'year', direction: 'desc' })).toEqual(['Alan Wake', 'Halo 3', 'Gears of War', 'Zoo Tycoon']);
    expect(owned({ sort: 'year', direction: 'asc' })).toEqual(['Gears of War', 'Halo 3', 'Alan Wake', 'Zoo Tycoon']);
  });

  it('sorts by status: playing first', () => {
    expect(owned({ sort: 'status' })[0]).toBe('Alan Wake');
  });

  it('searches case-insensitively and filters by status, genre and year', () => {
    expect(owned({ search: 'HALO' })).toEqual(['Halo 3']);
    expect(owned({ playStatus: 'unplayed' })).toEqual(['Gears of War', 'Zoo Tycoon']);
    expect(owned({ genre: 'Shooter' })).toEqual(['Gears of War', 'Halo 3']);
    expect(owned({ year: 2010 })).toEqual(['Alan Wake']);
    expect(owned({ year: 2006 })).toEqual(['Gears of War']);
    expect(owned({ format: 'digital' })).toEqual(['Zoo Tycoon']);
    expect(owned({ format: 'physical' })).toHaveLength(3);
  });

  it('filters editions through the format filter', () => {
    const editions = [
      // A SteelBook among several copies counts too.
      game({ title: 'Halo 3', copies: [{}, { steelbook: true }] }),
      game({ title: 'Gears of War', demo: true }),
      game({ title: 'Zoo Tycoon', digital: true, demo: true, copies: [{ steelbook: true }] }),
      game({ title: 'Braid', digital: true, copies: [] }),
    ];
    const pick = (format: GameQuery['format']) => titles(queryGames(editions, { list: 'owned', sort: 'title', direction: 'asc', format }));
    expect(pick('steelbook')).toEqual(['Halo 3', 'Zoo Tycoon']);
    expect(pick('demo')).toEqual(['Gears of War', 'Zoo Tycoon']);
    // Owned both ways, Zoo Tycoon is both physical and digital.
    expect(pick('physical')).toEqual(['Gears of War', 'Halo 3', 'Zoo Tycoon']);
    expect(pick('digital')).toEqual(['Braid', 'Zoo Tycoon']);
  });

  it('sorts wishlist by priority', () => {
    expect(titles(queryGames(games, { list: 'wishlist', sort: 'priority', direction: 'asc' }))).toEqual(['Mass Effect', 'Fable II']);
  });
});

describe('helpers', () => {
  it('lists filter options for a list', () => {
    expect(filterOptions(games, 'owned')).toEqual({
      genres: ['Adventure', 'Shooter'],
      years: [2006, 2007, 2010],
      series: [],
      modes: { coop: false, splitscreen: false },
      tags: [],
      locations: [],
    });
  });

  it('offers only series shared by two or more games, and the modes present', () => {
    const shelf = [
      game({ title: 'Halo 3', series: ['Halo'], coop: true, splitscreen: true }),
      game({ title: 'Halo Wars', series: ['Halo', 'Halo Wars'] }),
      game({ title: 'Gears of War', series: ['Gears of War'], coop: true }),
    ];
    expect(filterOptions(shelf, 'owned')).toMatchObject({ series: ['Halo'], modes: { coop: true, splitscreen: true } });
  });

  it('filters by series and by playing together', () => {
    const shelf = [
      game({ title: 'Halo 3', series: ['Halo'], coop: true, splitscreen: true }),
      game({ title: 'Halo Wars', series: ['Halo', 'Halo Wars'] }),
      game({ title: 'Gears of War', series: ['Gears of War'], coop: true }),
    ];
    const q = (over: Partial<GameQuery>) => titles(queryGames(shelf, { list: 'owned', sort: 'title', direction: 'asc', ...over }));
    expect(q({ series: 'Halo' })).toEqual(['Halo 3', 'Halo Wars']);
    expect(q({ mode: 'coop' })).toEqual(['Gears of War', 'Halo 3']);
    expect(q({ mode: 'splitscreen', series: 'Halo' })).toEqual(['Halo 3']);
  });

  it('computes stats', () => {
    expect(libraryStats(games)).toEqual({
      owned: 4,
      completed: 1,
      playing: 1,
      physical: 3,
      digital: 1,
      wishlist: 2,
      ordered: 0,
      backCompat: 3,
      forSale: 0,
      lent: 0,
    });
  });

  it('filters by backward compatibility, as the list has it', () => {
    expect(owned({ backCompat: 'yes' })).toEqual(['Alan Wake', 'Gears of War', 'Halo 3']);
    expect(owned({ backCompat: 'no' })).toEqual(['Zoo Tycoon']);
  });

  it('shows a game owned but hunted for on a shelf on the wishlist too', () => {
    const hunted = [
      ...games.filter((g) => g.title !== 'Zoo Tycoon'),
      game({ title: 'Zoo Tycoon', digital: true, copies: [], wanted: true }),
    ];
    const wishlist = titles(queryGames(hunted, { list: 'wishlist', sort: 'title', direction: 'asc' }));
    expect(wishlist).toEqual(['Fable II', 'Mass Effect', 'Zoo Tycoon']);
    expect(owned({})).toContain('Zoo Tycoon');
    expect(libraryStats(hunted).wishlist).toBe(3);
  });

  it('finds duplicates by igdbId or title', () => {
    const withId = [...games, game({ title: 'Other', igdbId: 7 })];
    expect(findDuplicate(withId, { igdbId: 7, title: 'whatever' })?.title).toBe('Other');
    expect(findDuplicate(games, { title: ' halo 3 ' })?.title).toBe('Halo 3');
    expect(findDuplicate(games, { title: 'Gears of War III' })).toBeUndefined();
    const roman = [...games, game({ title: 'Gears of War 2' })];
    expect(findDuplicate(roman, { title: 'Gears of War II' })?.title).toBe('Gears of War 2');
    expect(findDuplicate(games, { title: 'Halo 4' })).toBeUndefined();
  });

  it('moves a wishlist game to owned', () => {
    const moved = markAsOwned(games[5]);
    expect(moved).toMatchObject({ list: 'owned', playStatus: 'unplayed' });
    expect(copiesOf(moved)).toEqual([{}]);
    expect(moved.priority).toBeUndefined();
  });
});

describe('shelvedAs', () => {
  it('shelves a game found by its Polish title under it, keeping the English one for IGDB', () => {
    expect(
      shelvedAs({ igdbId: 478, title: 'The Witcher 2: Assassins of Kings', alias: 'Wiedźmin 2: Zabójcy królów', releaseYear: 2011 }),
    ).toEqual({
      igdbId: 478,
      title: 'Wiedźmin 2: Zabójcy królów',
      igdbQuery: 'The Witcher 2: Assassins of Kings',
      releaseYear: 2011,
    });
    expect(shelvedAs({ igdbId: 1, title: 'Halo 3' })).toEqual({ igdbId: 1, title: 'Halo 3' });
  });
});

describe('findNearDuplicate', () => {
  const library = [
    game({ id: 'rdr', title: 'Red Dead Redemption' }),
    game({ id: 'h3', title: 'Halo 3' }),
    game({ id: 'gow2', title: 'Gears of War 2' }),
  ];

  it('takes a slip of the keyboard for the game in the library', () => {
    expect(findNearDuplicate(library, 'Red Dead Redemtion')?.id).toBe('rdr');
    expect(findNearDuplicate(library, 'red dead redemption')?.id).toBe('rdr');
  });

  it('never takes another number in a series for the same game', () => {
    expect(findNearDuplicate(library, 'Halo 4')).toBeUndefined();
    expect(findNearDuplicate(library, 'Gears of War 3')).toBeUndefined();
  });

  it('leaves a different game alone', () => {
    expect(findNearDuplicate(library, 'Red Faction')).toBeUndefined();
  });
});

describe('toggleOrdered', () => {
  const wish: Game = { id: 'w', title: 'Wish', list: 'wishlist', priority: 'high', addedAt: '2024-01-01T00:00:00.000Z' };

  it('marks and unmarks a wishlist game as ordered', () => {
    const ordered = toggleOrdered(wish, new Date('2026-11-21T10:00:00Z'));
    expect(ordered.orderedAt).toBe('2026-11-21T10:00:00.000Z');
    expect(toggleOrdered(ordered).orderedAt).toBeUndefined();
  });

  it('clears the order once the game is owned', () => {
    expect(markAsOwned(toggleOrdered(wish)).orderedAt).toBeUndefined();
  });
});

describe('copies', () => {
  it('counts one plain copy for a game in the collection, none when it is owned only digitally', () => {
    expect(copiesOf(game({ title: 'Halo 3' }))).toEqual([{}]);
    expect(copiesOf(game({ title: 'Halo 3', copies: [{ region: 'pal' }, { forSale: true }] }))).toHaveLength(2);
    expect(copiesOf(game({ title: 'Zoo Tycoon', digital: true, copies: [] }))).toEqual([]);
    expect(copiesOf(game({ title: 'Zoo Tycoon', digital: true }))).toEqual([{}]);
    expect(copiesOf(game({ title: 'Fable II', list: 'wishlist' }))).toEqual([]);
  });

  it('stores a lone copy with nothing noted as no copies at all', () => {
    expect(storedCopies([{}])).toBeUndefined();
    expect(storedCopies([{ region: undefined }])).toBeUndefined();
    expect(storedCopies([{ region: 'pal' }])).toEqual([{ region: 'pal' }]);
    expect(storedCopies([{}, {}])).toEqual([{}, {}]);
    // No case at all, for a game owned digitally.
    expect(storedCopies([])).toEqual([]);
  });

  it('shelves the first copy, none for a game owned only digitally', () => {
    expect(shelfCopy(game({ title: 'Halo 3', copies: [{ steelbook: true }, { pack: 2 }] }))).toEqual({ steelbook: true });
    expect(shelfCopy(game({ title: 'Halo 3' }))).toEqual({});
    expect(shelfCopy(game({ title: 'Zoo Tycoon', digital: true, copies: [] }))).toEqual({});
  });

  it('adds a copy next to the one a game always has', () => {
    expect(withCopy(game({ title: 'Halo 3' }), { forSale: true }).copies).toEqual([{}, { forSale: true }]);
  });

  it('gives a game owned digitally its first case, which ends the hunt for one', () => {
    const portal = withCopy(game({ title: 'Portal 2', digital: true, copies: [], wanted: true }));
    expect(copiesOf(portal)).toEqual([{}]);
    expect(portal.digital).toBe(true);
    expect(portal).not.toHaveProperty('wanted');
    const ordered = withCopy(game({ title: 'Portal 2', digital: true, copies: [], wanted: true, orderedAt: '2026-11-24T00:00:00Z' }));
    expect(ordered).not.toHaveProperty('orderedAt');
  });

  it('swaps a cover that came with the app for the one from IGDB', () => {
    const scanned = game({ title: 'Halo 3', coverUrl: './covers/halo-3.jpg', coverHasBand: true, coverImageId: 'co1x7d' });
    const migrated = migrateGame(scanned);
    expect(migrated.coverImageId).toBe('co1x7d');
    expect(migrated).not.toHaveProperty('coverUrl');
    expect(migrated).not.toHaveProperty('coverHasBand');
    // Without one from IGDB, and for a cover from elsewhere, nothing changes.
    const alone = game({ title: 'Halo 3', coverUrl: './covers/halo-3.jpg' });
    expect(migrateGame(alone)).toBe(alone);
    const own = game({ title: 'Halo 3', coverUrl: 'https://example.com/halo.jpg', coverImageId: 'co1x7d' });
    expect(migrateGame(own)).toBe(own);
  });

  it('turns the format of older libraries into the digital flag, and drops a hand-set backCompat', () => {
    const digital = migrateGame({ ...game({ title: 'Braid' }), format: 'digital', backCompat: true } as Game);
    expect(digital).toMatchObject({ digital: true, copies: [] });
    expect(digital).not.toHaveProperty('format');
    expect(digital).not.toHaveProperty('backCompat');
    const physical = migrateGame({ ...game({ title: 'Halo 3' }), format: 'physical' } as Game);
    expect(physical).not.toHaveProperty('format');
    expect(physical).not.toHaveProperty('digital');
    expect(copiesOf(physical)).toEqual([{}]);
  });

  it('moves the details older libraries kept on the game into its first copy', () => {
    const legacy = { ...game({ title: 'Halo 3' }), edition: 'classics', ean: '5021290031392' } as Game;
    const migrated = migrateGame(legacy);
    expect(migrated.copies).toEqual([{ edition: 'classics', ean: '5021290031392' }]);
    expect(migrated).not.toHaveProperty('edition');
    expect(migrated).not.toHaveProperty('ean');
    const cased = { ...game({ title: 'Gears of War' }), steelbook: true, pack: 2, copies: [{ region: 'pal' }, {}] } as Game;
    expect(migrateGame(cased).copies).toEqual([{ steelbook: true, pack: 2, region: 'pal' }, {}]);
    const current = game({ title: 'Halo 3', copies: [{ region: 'pal' }] });
    expect(migrateGame(current)).toBe(current);
  });

  it('finds games with a copy for sale and counts those copies', () => {
    const shelf = [
      game({ title: 'Halo 3', copies: [{}, { forSale: true }, { forSale: true }] }),
      game({ title: 'Alan Wake' }),
      game({ title: 'Zoo Tycoon', digital: true, copies: [] }),
    ];
    expect(titles(queryGames(shelf, { list: 'owned', sort: 'title', direction: 'asc', format: 'forSale' }))).toEqual(['Halo 3']);
    expect(libraryStats(shelf).forSale).toBe(2);
  });
});

describe("the player's own notes", () => {
  const shelf = [
    game({
      title: 'Halo 3',
      myRating: 9,
      tags: ['co-op', 'party'],
      copies: [{ location: 'Salon' }, { lentTo: 'Kasia', lentAt: '2026-11-01' }],
    }),
    game({ title: 'Alan Wake', myRating: 6, tags: ['party'], copies: [{ location: 'Strych' }] }),
    game({ title: 'Braid', digital: true, copies: [], tags: ['indie'] }),
    game({ title: 'Fable II' }),
  ];
  const query = (over: Partial<GameQuery>) => titles(queryGames(shelf, { list: 'owned', sort: 'title', direction: 'asc', ...over }));

  it('filters by tag, by where a copy is kept, and by copies on loan', () => {
    expect(query({ tag: 'party' })).toEqual(['Alan Wake', 'Halo 3']);
    expect(query({ location: 'Strych' })).toEqual(['Alan Wake']);
    expect(query({ format: 'lent' })).toEqual(['Halo 3']);
    expect(libraryStats(shelf).lent).toBe(1);
  });

  it('sorts by the own score, best first, unrated last', () => {
    expect(query({ sort: 'myRating', direction: 'desc' })).toEqual(['Halo 3', 'Alan Wake', 'Braid', 'Fable II']);
  });

  it('offers the tags and places in use', () => {
    const { tags, locations } = filterOptions(shelf, 'owned');
    expect(tags).toEqual(['co-op', 'indie', 'party']);
    expect(locations).toEqual(['Salon', 'Strych']);
  });

  it('adds a tag once, whatever its letter case, tidied of spaces', () => {
    expect(withTag(undefined, '  na   imprezę ')).toEqual(['na imprezę']);
    const tags = ['Party'];
    expect(withTag(tags, 'party')).toBe(tags);
    expect(withTag(tags, '  ')).toBe(tags);
  });

  it('keeps a lone copy that only says where it is or who has it', () => {
    expect(storedCopies([{ location: 'Salon' }])).toEqual([{ location: 'Salon' }]);
    expect(storedCopies([{ lentTo: 'Kasia' }])).toEqual([{ lentTo: 'Kasia' }]);
  });
});
