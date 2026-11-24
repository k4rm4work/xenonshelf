import { describe, expect, it } from 'vitest';
import { isBackCompat } from './backcompat';
import { titleKey } from './titles';

describe('titleKey', () => {
  it('ignores case, marks, punctuation and a leading "The"', () => {
    expect(titleKey('The Elder Scrolls V: Skyrim™')).toBe(titleKey('elder scrolls 5 skyrim'));
    expect(titleKey('Lips: I Love the 80’s')).toBe(titleKey('Lips: I Love the 80s'));
    expect(titleKey('Pokémon')).toBe('pokemon');
  });

  it('reads Roman numerals and "&" the same as digits and "and"', () => {
    expect(titleKey('Gears of War II')).toBe(titleKey('Gears of War 2'));
    expect(titleKey('Banjo & Kazooie')).toBe(titleKey('Banjo and Kazooie'));
  });
});

describe('isBackCompat', () => {
  it('finds games on the list, also by their English title or without an edition suffix', () => {
    expect(isBackCompat({ title: 'Halo 3' })).toBe(true);
    expect(isBackCompat({ title: 'Auta 2', igdbQuery: 'Cars 2' })).toBe(true);
    expect(isBackCompat({ title: 'Batman: Arkham Asylum' })).toBe(false);
  });
});
