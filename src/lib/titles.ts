/** A title reduced to what tells games apart, so lists written by different people still
    match: case, accents, ™ and ®, apostrophes, punctuation and a leading "The" are dropped, "&" reads
    as "and", and Roman numerals in their own word become digits ("Gears of War II" and
    "Gears of War 2" meet). */
export function titleKey(title: string): string {
  // Marks go first: NFKD would spell ™ out as "TM".
  return title
    .replace(/[™®©'’]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')
    .split(' ')
    .map((word) => ROMAN[word] ?? word)
    .join(' ');
}

const ROMAN: Record<string, string> = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9' };

/** Keys a game can be known by: its shelf title, and the English one when it is localised. */
export const gameKeys = (game: { title: string; igdbQuery?: string }) =>
  [game.title, game.igdbQuery].filter((t): t is string => !!t).map(titleKey);
