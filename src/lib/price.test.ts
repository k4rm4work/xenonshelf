import { describe, expect, it } from 'vitest';
import type { Game } from '../types';
import { changesBetween } from './history';
import { exportCsv, gameFromRow, parseImport } from './importRows';
import { formatPrice, priceText, readAmount, readPrice } from './price';

describe('price paid', () => {
  it('reads an amount however it is written', () => {
    expect(readAmount('49,99')).toBe(49.99);
    expect(readAmount('49.99')).toBe(49.99);
    expect(readAmount('1 299,00')).toBe(1299);
    expect(readAmount('1,299.50')).toBe(1299.5);
    expect(readAmount('1.299')).toBe(1299);
    expect(readAmount('20')).toBe(20);
    expect(readAmount('cheap')).toBeUndefined();
  });

  it('keeps a currency only when it was written', () => {
    expect(readPrice('49,99')).toEqual({ price: 49.99 });
    expect(readPrice('49,99 zł')).toEqual({ price: 49.99, currency: 'PLN' });
    expect(readPrice('€20')).toEqual({ price: 20, currency: 'EUR' });
    expect(readPrice('15 USD')).toEqual({ price: 15, currency: 'USD' });
    expect(readPrice('R$ 89,90')).toEqual({ price: 89.9, currency: 'BRL' });
    expect(readPrice('free')).toBeUndefined();
  });

  it('shows a price in the reader’s way, with its currency when it has one', () => {
    expect(formatPrice(49.99, undefined, 'pl')).toBe('49,99');
    expect(formatPrice(20, 'EUR', 'en')).toBe('€20.00');
  });

  it('comes in from a spreadsheet column and goes into the history as one value', () => {
    const [row] = parseImport('title;cena;waluta\nHalo 3;20;EUR', 'owned');
    expect(row.fields).toMatchObject({ price: 20, currency: 'EUR' });
    expect(priceText(row.fields)).toBe('20.00 EUR');

    const game: Game = {
      id: 'halo-3',
      title: 'Halo 3',
      list: 'owned',
      addedAt: '2026-01-01T00:00:00.000Z',
      copies: [{ edition: 'classics' }],
    };
    const paid = { ...game, copies: [{ edition: 'classics' as const, price: 49.99 }] };
    expect(changesBetween(game, paid)).toEqual([{ kind: 'edited', field: 'price', to: '49.99' }]);
  });

  it('goes with the download for a game owned only digitally, both ways through a sheet', () => {
    const [row] = parseImport('title;format;cena\nBraid;cyfrowa;15 USD', 'owned');
    const braid = gameFromRow(row, undefined, undefined, new Date());
    expect(braid).toMatchObject({ digital: true, copies: [], digitalPrice: 15, digitalCurrency: 'USD' });
    expect(exportCsv([braid])).toContain('15.00 USD');
    const bought = { ...braid, digitalPrice: 9.99, digitalCurrency: undefined };
    expect(changesBetween(braid, bought)).toEqual([{ kind: 'edited', field: 'price', to: '9.99' }]);
  });

  it('keeps a flag turned off as no', () => {
    const game: Game = { id: 'braid', title: 'Braid', list: 'owned', addedAt: '2026-01-01T00:00:00.000Z', demo: true };
    expect(changesBetween(game, { ...game, demo: undefined })).toEqual([{ kind: 'edited', field: 'demo', to: false }]);
  });
});
