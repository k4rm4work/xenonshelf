import { describe, expect, it } from 'vitest';
import type { Game } from '../types';
import { copyFromRow, exportCsv, gameFromRow, IMPORT_TEMPLATE, parseImport, splitCells } from './importRows';

describe('splitCells', () => {
  it('keeps delimiters, line breaks and doubled quotes inside quotes', () => {
    expect(splitCells('a,"b, c","say ""hi""\nthere"\nd,e', ',')).toEqual([
      ['a', 'b, c', 'say "hi"\nthere'],
      ['d', 'e'],
    ]);
  });
});

describe('parseImport', () => {
  it('reads a plain list, one title per line, dropping list markers and comments', () => {
    const rows = parseImport('- Halo 3\n2. Gears of War 2\n\n# later\n• Warhammer 40,000: Space Marine\n1942: Joint Strike', 'owned');
    expect(rows.map((r) => r.title)).toEqual(['Halo 3', 'Gears of War 2', 'Warhammer 40,000: Space Marine', '1942: Joint Strike']);
    expect(rows[0].fields).toEqual({ list: 'owned' });
  });

  it('reads the template', () => {
    const [halo, haloForSale, alanWake] = parseImport(IMPORT_TEMPLATE, 'owned');
    expect(halo).toEqual({
      title: 'Halo 3',
      fields: {
        list: 'owned',
        format: 'physical',
        playStatus: 'completed',
        edition: 'classics',
        region: 'pal',
        condition: 'good',
        completeness: 'cib',
      },
      problems: [],
    });
    expect(haloForSale.fields).toMatchObject({
      steelbook: true,
      edition: 'limited',
      condition: 'worn',
      completeness: 'case',
      forSale: true,
    });
    expect(alanWake.fields).toEqual({ list: 'wishlist', priority: 'high' });
  });

  it('reads a Polish Excel CSV: BOM, sep line, semicolons, Polish headers and labels', () => {
    const csv =
      '﻿sep=;\r\nTytuł;Lista;Status;Wydanie;Stan;Kod kreskowy\r\nFable II;Kolekcja;W trakcie;Platinum Hits;Zużyty;5 021290 031392\r\n';
    expect(parseImport(csv, 'wishlist')).toEqual([
      {
        title: 'Fable II',
        fields: { list: 'owned', playStatus: 'playing', edition: 'classics', condition: 'worn', ean: '5021290031392' },
        problems: [],
      },
    ]);
  });

  it('reads cells pasted from a spreadsheet, with or without a header', () => {
    expect(parseImport('Game\tPriority\nHalo 3\tLow', 'wishlist')[0].fields).toEqual({ list: 'wishlist', priority: 'low' });
    expect(parseImport('Halo 3\tPAL\nFable II\tPAL', 'owned').map((r) => r.title)).toEqual(['Halo 3', 'Fable II']);
  });

  it('reads a for-sale column as yes or no', () => {
    const rows = parseImport('tytuł;na sprzedaż\nHalo 3;tak\nFable II;nie\nBraid;może', 'owned');
    expect(rows.map((r) => r.fields.forSale)).toEqual([true, undefined, undefined]);
    expect(rows[2].problems).toEqual(['na sprzedaż: może']);
  });

  it('leaves out values it does not understand and says which', () => {
    const [row] = parseImport('title,status,ean\nHalo 3,maybe,123', 'owned');
    expect(row.fields).toEqual({ list: 'owned' });
    expect(row.problems).toEqual(['status: maybe', 'ean: 123']);
  });

  it('keeps an edition written out in full: its kind when the name tells it, the name in the notes', () => {
    const [n7, special] = parseImport(
      "title,edition,notes\nMass Effect 3,N7 Collector's Edition,Kupione na OLX\nHalo 3,Legendary Edition,",
      'owned',
    );
    expect(n7.fields.edition).toBe('collectors');
    expect(n7.fields.notes).toBe("Kupione na OLX\nedition: N7 Collector's Edition");
    expect(n7.problems).toEqual([]);
    expect(special.fields.edition).toBeUndefined();
    expect(special.fields.notes).toBe('edition: Legendary Edition');
  });

  it('accepts only real calendar dates in the supported date formats', () => {
    const rows = parseImport(
      'title,lent at\nGood ISO,2024-02-29\nGood local,29.02.2024\nShort ISO,2024-2-1\nBad leap,2025-02-29\nBad month,31.13.2024\nBad day,2024-04-31\nTrailing,2024-02-01T12:00:00Z',
      'owned',
    );
    expect(rows.map((row) => row.fields.lentAt)).toEqual([
      '2024-02-29',
      '2024-02-29',
      '2024-02-01',
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(rows.slice(3).every((row) => row.problems.length === 1)).toBe(true);
  });

  it('skips rows without a title', () => {
    expect(parseImport('title,list\n,owned\nHalo 3,', 'owned').map((r) => r.title)).toEqual(['Halo 3']);
  });
});

describe('gameFromRow', () => {
  const now = new Date('2026-11-23T10:00:00Z');
  const match = { igdbId: 1, title: 'Halo 3', releaseYear: 2007 };

  it('builds an owned game with the copy details and defaults', () => {
    const [row] = parseImport('title,edition,notes\nhalo 3,goty,Signed', 'owned');
    expect(gameFromRow(row, match, { pegi: 16 }, now)).toEqual({
      igdbId: 1,
      title: 'Halo 3',
      releaseYear: 2007,
      pegi: 16,
      id: 'igdb-1',
      list: 'owned',
      playStatus: 'unplayed',
      copies: [{ edition: 'goty' }],
      notes: 'Signed',
      addedAt: now.toISOString(),
    });
  });

  it('keeps only the priority for a wishlist game, and its own title without a match', () => {
    const [row] = parseImport('title,list,edition\nSome Game,wishlist,goty', 'owned');
    const game = gameFromRow(row, undefined, undefined, now);
    expect(game).toMatchObject({ title: 'Some Game', list: 'wishlist', priority: 'medium' });
    expect(game).not.toHaveProperty('copies');
    expect(game.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('copyFromRow', () => {
  it('keeps only what describes the copy', () => {
    const [row] = parseImport('title,status,region,for sale,notes\nHalo 3,playing,pal,yes,mine', 'owned');
    expect(copyFromRow(row)).toEqual({ region: 'pal', forSale: true });
  });

  it('reads the case: SteelBook and how many games it holds', () => {
    const rows = parseImport('title,pudełko,steelbook\nHalo 3,Double Pack,tak\nGears of War,single,no\nFable II,triple,maybe', 'owned');
    expect(rows.map(copyFromRow)).toEqual([{ pack: 2, steelbook: true }, {}, { pack: 3 }]);
    expect(rows[2].problems).toEqual(['steelbook: maybe']);
  });

  it('leaves a game owned only digitally without a case, and one owned both ways with its case', () => {
    const [digital, both] = parseImport('title,format,region\nBraid,digital,pal\nPortal 2,oba,pal', 'owned');
    expect(gameFromRow(digital, undefined, undefined, new Date())).toMatchObject({ digital: true, copies: [] });
    expect(gameFromRow(both, undefined, undefined, new Date())).toMatchObject({ digital: true, copies: [{ region: 'pal' }] });
  });
});

describe('own notes in a sheet', () => {
  it('reads the place, the loan, the score, the review and the tags', () => {
    const [row, bad] = parseImport(
      'tytuł;miejsce;komu;od kiedy;ocena;recenzja;tagi\nHalo 3;Salon;Kasia;03.11.2026;4,5;Świetna;co-op, party\nFable II;;;wczoraj;7;;',
      'owned',
    );
    expect(copyFromRow(row)).toEqual({ location: 'Salon', lentTo: 'Kasia', lentAt: '2026-11-03' });
    const halo = gameFromRow(row, undefined, undefined, new Date());
    expect(halo).toMatchObject({ myRating: 9, review: 'Świetna', tags: ['co-op', 'party'] });
    expect(bad.problems).toEqual(['od kiedy: wczoraj', 'ocena: 7']);
  });
});

describe('exportCsv', () => {
  const game = (over: Partial<Game>): Game => ({
    id: over.title ?? 'x',
    title: 'x',
    list: 'owned',
    addedAt: '2026-01-01T00:00:00Z',
    ...over,
  });

  it('reads back through the import, a row per copy, the game itself once', () => {
    const games = [
      game({
        title: 'Halo 3',
        playStatus: 'completed',
        myRating: 9,
        review: 'Finish the fight; "best" one',
        tags: ['co-op', 'party'],
        notes: 'Line one\nline two',
        copies: [
          { edition: 'classics', location: 'Salon' },
          { steelbook: true, pack: 2, forSale: true, lentTo: 'Kasia', lentAt: '2026-11-03', ean: '5021290031392' },
        ],
      }),
      game({ title: 'Alan Wake', list: 'wishlist', priority: 'high' }),
      game({ title: 'Braid', digital: true, copies: [] }),
      game({ title: 'Portal 2', digital: true, copies: [{ region: 'pal' }] }),
    ];
    const csv = exportCsv(games);
    expect(csv.startsWith('\uFEFF')).toBe(true);

    const rows = parseImport(csv, 'owned');
    expect(rows.map((r) => r.title)).toEqual(['Halo 3', 'Halo 3', 'Alan Wake', 'Braid', 'Portal 2']);
    expect(rows.flatMap((r) => r.problems)).toEqual([]);
    expect(rows.slice(0, 2).map(copyFromRow)).toEqual(games[0].copies);
    expect(gameFromRow(rows[0], undefined, undefined, new Date())).toMatchObject({
      playStatus: 'completed',
      myRating: 9,
      review: 'Finish the fight; "best" one',
      tags: ['co-op', 'party'],
      notes: 'Line one\nline two',
    });
    // The second copy's row brings no game details to repeat.
    expect(rows[1].fields).not.toHaveProperty('review');
    expect(rows[2].fields).toMatchObject({ list: 'wishlist', priority: 'high' });
    expect(rows[3].fields).toMatchObject({ format: 'digital' });
    expect(rows[4].fields).toMatchObject({ format: 'both', region: 'pal' });
  });
});
