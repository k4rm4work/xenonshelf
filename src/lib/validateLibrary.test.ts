import { describe, expect, it } from 'vitest';
import {
  COMPLETENESS,
  CONDITIONS,
  EDITIONS,
  FORMATS,
  PACK_SIZES,
  PLAY_STATUSES,
  PRIORITIES,
  REGIONS,
  type Copy,
  type Game,
} from '../types';
import { isValidGame, isValidLibrary } from './validateLibrary';

const valid = {
  id: 'halo-3',
  title: 'Halo 3',
  list: 'owned',
  addedAt: '2026-01-01T00:00:00.000Z',
  copies: [{ region: 'pal', steelbook: true }],
};

const fullCopy: Required<Copy> = {
  steelbook: true,
  pack: 2,
  completeness: 'cib',
  edition: 'collectors',
  region: 'ntsc-u',
  condition: 'mint',
  ean: '5030917077256',
  price: 49.99,
  currency: 'PLN',
  forSale: true,
  location: 'Salon, półka 2',
  lentTo: 'Kasia',
  lentAt: '2026-11-01',
};

const fullGame: Required<Game> = {
  id: 'mass-effect-3',
  igdbId: 2032,
  igdbQuery: 'Mass Effect 3',
  title: 'Mass Effect 3',
  coverImageId: 'co1x7d',
  coverUrl: './covers/mass-effect-3.jpg',
  coverHasBand: true,
  releaseYear: 2012,
  genres: ['rpg', 'shooter'],
  list: 'owned',
  digital: true,
  digitalPrice: 29.99,
  digitalCurrency: 'EUR',
  wanted: false,
  demo: false,
  playStatus: 'completed',
  priority: 'high',
  orderedAt: '2026-10-30T12:00:00.000Z',
  notes: 'Kupione na OLX',
  myRating: 9,
  review: 'Świetne zakończenie trylogii.',
  tags: ['trylogia', 'z Kasią'],
  addedAt: '2026-11-23T10:00:00.000Z',
  copies: [fullCopy, { region: 'pal' }],
  history: [
    { kind: 'added', list: 'wishlist', at: '2026-11-20T09:00:00.000Z' },
    { kind: 'moved', list: 'owned', at: '2026-11-21T09:00:00.000Z' },
    { kind: 'status', from: 'playing', to: 'completed', at: '2026-11-22T09:00:00.000Z' },
    { kind: 'rating', to: 9, at: '2026-11-22T09:05:00.000Z' },
    { kind: 'lent', who: 'Kasia', at: '2026-11-23T09:00:00.000Z' },
    { kind: 'copyAdded', count: 1, at: '2026-11-23T09:10:00.000Z' },
    { kind: 'tagged', tag: 'trylogia', at: '2026-11-23T09:20:00.000Z' },
  ],
  summary: 'Earth is burning.',
  developers: ['BioWare'],
  publishers: ['Electronic Arts'],
  series: ['Mass Effect'],
  rating: 89,
  pegi: 18,
  coop: true,
  splitscreen: false,
  localPlayers: 2,
  hoursStory: 24,
  hoursComplete: 58,
};

describe('library validation', () => {
  it('accepts a game with every field the app can store', () => {
    expect(isValidGame(fullGame)).toBe(true);
    expect(isValidLibrary({ version: 1, games: [fullGame] })).toBe(true);
  });

  it('accepts every choice the pickers offer', () => {
    for (const playStatus of PLAY_STATUSES) expect(isValidGame({ ...fullGame, playStatus })).toBe(true);
    for (const priority of PRIORITIES) expect(isValidGame({ ...fullGame, priority })).toBe(true);
    for (const format of FORMATS) expect(isValidGame({ ...fullGame, format })).toBe(true);
    for (const pack of PACK_SIZES) expect(isValidGame({ ...fullGame, copies: [{ pack: Number(pack) }] })).toBe(true);
    for (const edition of EDITIONS) expect(isValidGame({ ...fullGame, copies: [{ edition }] })).toBe(true);
    for (const region of REGIONS) expect(isValidGame({ ...fullGame, copies: [{ region }] })).toBe(true);
    for (const condition of CONDITIONS) expect(isValidGame({ ...fullGame, copies: [{ condition }] })).toBe(true);
    for (const completeness of COMPLETENESS) expect(isValidGame({ ...fullGame, copies: [{ completeness }] })).toBe(true);
    for (let myRating = 1; myRating <= 10; myRating++) expect(isValidGame({ ...fullGame, myRating })).toBe(true);
  });

  it('accepts current and minimal legacy-compatible game records', () => {
    expect(isValidGame(valid)).toBe(true);
    expect(isValidGame({ id: 'x', title: 'X', list: 'wishlist', addedAt: '2024-01-01' })).toBe(true);
  });

  it('rejects invalid required fields and enum values', () => {
    expect(isValidGame({ ...valid, title: '  ' })).toBe(false);
    expect(isValidGame({ ...valid, list: 'archive' })).toBe(false);
    expect(isValidGame({ ...valid, playStatus: 'paused' })).toBe(false);
    expect(isValidGame({ ...valid, addedAt: 'not a date' })).toBe(false);
  });

  it('rejects invalid optional values and malformed copies', () => {
    expect(isValidGame({ ...valid, myRating: 11 })).toBe(false);
    expect(isValidGame({ ...valid, releaseYear: 2201 })).toBe(false);
    expect(isValidGame({ ...valid, copies: [{ region: 'pal', pack: 0 }] })).toBe(false);
    expect(isValidGame({ ...valid, tags: ['x'.repeat(101)] })).toBe(false);
  });

  it('accepts only the exact fields and values allowed for each history event', () => {
    const history = [
      { kind: 'added', list: 'owned', at: '2026-11-23T10:00:00.000Z' },
      { kind: 'status', from: 'playing', to: 'completed', at: '2026-11-23T10:00:00.000Z' },
      { kind: 'rating', to: 8.5, at: '2026-11-23T10:00:00.000Z' },
      { kind: 'copyAdded', count: 1, at: '2026-11-23T10:00:00.000Z' },
      { kind: 'lent', who: 'Kasia', at: '2026-11-23T10:00:00.000Z' },
      { kind: 'tagged', tag: 'trilogy', at: '2026-11-23T10:00:00.000Z' },
      { kind: 'edited', field: 'title', to: 'Halo 3', at: '2026-11-23T10:00:00.000Z' },
    ];
    expect(isValidGame({ ...valid, history })).toBe(true);
    expect(isValidGame({ ...valid, history: [{ kind: 'lent', who: 'Kasia', count: 3, at: '2026-11-23T10:00:00.000Z' }] })).toBe(false);
    expect(isValidGame({ ...valid, history: [{ kind: 'status', from: 'unknown', at: '2026-11-23T10:00:00.000Z' }] })).toBe(false);
    expect(isValidGame({ ...valid, history: [{ kind: 'rating', to: 11, at: '2026-11-23T10:00:00.000Z' }] })).toBe(false);
    expect(isValidGame({ ...valid, history: [{ kind: 'copyRemoved', count: -1, at: '2026-11-23T10:00:00.000Z' }] })).toBe(false);
    expect(isValidGame({ ...valid, history: [{ kind: 'edited', field: '', at: '2026-11-23T10:00:00.000Z' }] })).toBe(false);
    expect(isValidGame({ ...valid, history: [{ kind: 'ordered' }] })).toBe(false);
  });

  it('validates complete library shape and bounds', () => {
    expect(isValidLibrary({ version: 1, games: [valid] })).toBe(true);
    expect(isValidLibrary({ version: 1, games: [valid, { ...valid, id: 'halo-3' }] })).toBe(false);
    expect(isValidGame({ ...valid, myRating: 8.3 })).toBe(false);
    expect(isValidGame({ ...valid, pegi: 10 })).toBe(false);
    expect(isValidLibrary({ version: 2, games: [valid] })).toBe(false);
    expect(isValidLibrary({ version: 1, games: [{ ...valid, title: 7 }] })).toBe(false);
    expect(isValidLibrary({ version: 1, games: 'not an array' })).toBe(false);
  });
});
