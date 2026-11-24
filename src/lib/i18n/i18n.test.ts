import { API_ERRORS } from '../apiError';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPLETENESS, CONDITIONS, EDITIONS, FORMATS, LISTS, PACK_SIZES, PLAY_STATUSES, PRIORITIES, REGIONS } from '../../types';
import { MODES, SORT_KEYS } from '../games';
import { GENRES } from '../genres';
import { languageFor, MESSAGES, type Language } from '.';
import { THEMES } from '../settings';

const languages = Object.keys(MESSAGES) as Language[];
const keys = Object.keys(MESSAGES.pl);

/** Keys put together from a prefix and a value, e.g. `status.${playStatus}`. */
const CHOICES: Record<string, readonly string[]> = {
  list: LISTS,
  status: PLAY_STATUSES,
  format: FORMATS,
  pack: PACK_SIZES,
  priority: PRIORITIES,
  completeness: COMPLETENESS,
  edition: EDITIONS,
  region: REGIONS,
  condition: CONDITIONS,
  mode: MODES,
  sort: SORT_KEYS,
  theme: THEMES,
  genre: GENRES,
  apiError: API_ERRORS,
};

/** Keys picked by count, `${prefix}.${Intl.PluralRules category}`. */
const PLURALS = ['stats.games', 'import.copies'];

/** Keys built from data rather than a fixed list: a store error's action, an import row's state,
    a wallpaper's file and group. */
const FROM_DATA = ['error', 'import.state', 'wallpaper', 'settings.group'];

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  it('give every language the same keys, none of them empty', () => {
    for (const lang of languages) {
      expect(Object.keys(MESSAGES[lang]).sort(), lang).toEqual([...keys].sort());
      for (const key of keys) expect(MESSAGES[lang][key as keyof typeof MESSAGES.pl].trim(), `${lang} ${key}`).not.toBe('');
    }
  });

  it('fill in the same placeholders in every language', () => {
    for (const key of keys)
      for (const lang of languages)
        expect(placeholders(MESSAGES[lang][key as keyof typeof MESSAGES.pl]), `${lang} ${key}`).toEqual(
          placeholders(MESSAGES.pl[key as keyof typeof MESSAGES.pl]),
        );
  });

  it('name every choice the app offers', () => {
    for (const [prefix, values] of Object.entries(CHOICES))
      for (const value of values) expect(keys, `${prefix}.${value}`).toContain(`${prefix}.${value}`);
  });

  it('have a form for every count each language tells apart', () => {
    for (const prefix of PLURALS)
      for (const lang of languages)
        for (const category of new Intl.PluralRules(lang).resolvedOptions().pluralCategories)
          expect(keys, `${lang} ${prefix}.${category}`).toContain(`${prefix}.${category}`);
  });

  // A key nothing reads is a leftover: the code names it whole, or builds it from a prefix above.
  it('are all used', () => {
    const SRC = path.resolve(import.meta.dirname, '../..');
    const code = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts') && !file.startsWith('lib' + path.sep + 'i18n'))
      .map((file) => readFileSync(path.join(SRC, file), 'utf8'))
      .join('\n');
    const built = [...Object.keys(CHOICES), ...PLURALS, ...FROM_DATA].map((prefix) => `${prefix}.`);
    const unused = keys.filter((key) => !code.includes(`'${key}'`) && !built.some((prefix) => key.startsWith(prefix)));
    expect(unused).toEqual([]);
  });
});

describe('languageFor', () => {
  it('picks the browser language when the app speaks it, English otherwise', () => {
    expect(languageFor('de-AT')).toBe('de');
    expect(languageFor('pl')).toBe('pl');
    expect(languageFor('pt-PT')).toBe('pt-BR');
    expect(languageFor('es-419')).toBe('es');
    expect(languageFor('ja-JP')).toBe('en');
    expect(languageFor(undefined)).toBe('en');
  });
});
