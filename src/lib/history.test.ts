import { describe, expect, it } from 'vitest';
import type { Game } from '../types';
import { changesBetween, HISTORY_LIMIT, historyOf, recordAdded, recordChange, withEvents } from './history';

const game = (patch: Partial<Game> = {}): Game => ({
  id: 'halo-3',
  title: 'Halo 3',
  list: 'owned',
  addedAt: '2026-01-01T10:00:00.000Z',
  ...patch,
});
const at = (minutes: number) => new Date(Date.UTC(2026, 10, 23, 12, minutes)).toISOString();

describe('game history', () => {
  it('notes what a collector would look back on', () => {
    expect(changesBetween(game({ list: 'wishlist' }), game({ list: 'owned' }))).toEqual([{ kind: 'moved', list: 'owned' }]);
    expect(changesBetween(game(), game({ playStatus: 'playing', myRating: 8 }))).toEqual([
      { kind: 'status', from: undefined, to: 'playing' },
      { kind: 'rating', from: undefined, to: 8 },
    ]);
    expect(changesBetween(game({ tags: ['co-op'] }), game({ tags: ['klasyk'] }))).toEqual([
      { kind: 'tagged', tag: 'klasyk' },
      { kind: 'untagged', tag: 'co-op' },
    ]);
    expect(changesBetween(game({ list: 'wishlist' }), game({ list: 'wishlist', orderedAt: at(0) }))).toEqual([{ kind: 'ordered' }]);
  });

  it('notes edited details, with short values and the copy they belong to', () => {
    expect(changesBetween(game(), game({ notes: 'z OLX', priority: 'high' }))).toEqual([
      { kind: 'edited', field: 'notes' },
      { kind: 'edited', field: 'priority', to: 'high' },
    ]);
    expect(changesBetween(game({ copies: [{}, {}] }), game({ copies: [{}, { region: 'pal' }] }))).toEqual([
      { kind: 'edited', field: 'region', to: 'pal', copy: 2 },
    ]);
    expect(changesBetween(game(), game({ summary: 'x', rating: 80, coverImageId: 'co1' }))).toEqual([
      { kind: 'edited', field: 'igdb' },
      { kind: 'edited', field: 'cover' },
    ]);
  });

  it('does not take copies put in another order for edits', () => {
    expect(changesBetween(game({ copies: [{ steelbook: true }, {}] }), game({ copies: [{}, { steelbook: true }] }))).toEqual([]);
  });

  it('tells loans apart from copies moving around', () => {
    const lent = game({ copies: [{ lentTo: 'Kasia' }, {}] });
    expect(changesBetween(game({ copies: [{}, {}] }), lent)).toEqual([{ kind: 'lent', who: 'Kasia' }]);
    expect(changesBetween(lent, game({ copies: [{}, { lentTo: 'Kasia' }] }))).toEqual([]);
    expect(changesBetween(lent, game({ copies: [{}, {}] }))).toEqual([{ kind: 'returned', who: 'Kasia' }]);
  });

  it('counts copies added and taken off, not the case a game gets when bought', () => {
    expect(changesBetween(game(), game({ copies: [{}, {}] }))).toEqual([{ kind: 'copyAdded', count: 1 }]);
    expect(changesBetween(game({ copies: [{}, {}] }), game())).toEqual([{ kind: 'copyRemoved', count: 1 }]);
    expect(changesBetween(game({ list: 'wishlist' }), game({ copies: [{}, {}] }))).toEqual([{ kind: 'moved', list: 'owned' }]);
  });

  it('folds quick revisions into one line and drops those that cancel out', () => {
    let history = withEvents(undefined, [{ kind: 'rating', to: 6 }], at(0));
    history = withEvents(history, [{ kind: 'rating', from: 6, to: 8 }], at(1));
    expect(history).toEqual([{ kind: 'rating', to: 8, at: at(1) }]);

    history = withEvents(history, [{ kind: 'status', from: 'unplayed', to: 'playing' }], at(2));
    history = withEvents(history, [{ kind: 'status', from: 'playing', to: 'unplayed' }], at(3));
    expect(history).toEqual([{ kind: 'rating', to: 8, at: at(1) }]);

    history = withEvents(history, [{ kind: 'rating', from: 8, to: 9 }], at(40));
    expect(history).toHaveLength(2);
  });

  it('keeps the newest entries up to the limit', () => {
    let history = undefined;
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) history = withEvents(history, [{ kind: 'tagged', tag: `t${i}` }], at(0));
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history?.at(-1)).toMatchObject({ tag: `t${HISTORY_LIMIT + 4}` });
  });

  it('records on save and returns the game unchanged when nothing happened', () => {
    const added = recordAdded(game({ list: 'wishlist' }), at(0));
    expect(added.history).toEqual([{ kind: 'added', list: 'wishlist', at: at(0) }]);
    const bought = recordChange(added, { ...added, list: 'owned' }, at(5));
    expect(bought.history?.map((e) => e.kind)).toEqual(['added', 'moved']);
    const same = { ...bought };
    expect(recordChange(bought, same)).toBe(same);
  });

  it('shows older games from when they were added, newest first', () => {
    expect(historyOf(game())).toEqual([{ kind: 'added', list: 'owned', at: '2026-01-01T10:00:00.000Z' }]);
    const shown = historyOf(game({ history: [{ kind: 'moved', list: 'owned', at: at(0) }] }));
    expect(shown.map((e) => e.kind)).toEqual(['moved', 'added']);
    expect(shown[1]).toMatchObject({ list: 'wishlist' });
  });
});
