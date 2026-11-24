import type { Copy } from '../types';

/** The currencies a price may be written in. A price needs none: most collectors keep one
    currency in their head, and write it out only for a game bought abroad. */
export const CURRENCIES = [
  'PLN',
  'EUR',
  'USD',
  'GBP',
  'BRL',
  'CAD',
  'AUD',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'CZK',
  'HUF',
  'MXN',
  'JPY',
] as const;

/** An amount as typed: "49,99", "49.99", "1 299,00" or "1,299.00"; undefined when it is none. */
export function readAmount(text: string): number | undefined {
  // \s takes in the no-break space some locales group thousands with.
  const compact = text.replace(/[\s']/g, '');
  if (!/^\d[\d.,]*$/.test(compact)) return undefined;
  // The last separator is the decimal one when two digits or fewer follow it; any other groups thousands.
  const decimal = compact.match(/[.,](\d{1,2})$/);
  const whole = (decimal ? compact.slice(0, -decimal[0].length) : compact).replace(/[.,]/g, '');
  const amount = Number(decimal ? `${whole}.${decimal[1]}` : whole);
  return Number.isFinite(amount) && amount <= 10_000_000 ? Math.round(amount * 100) / 100 : undefined;
}

const SYMBOLS: [RegExp, string][] = [
  [/zł|zl\b/i, 'PLN'],
  [/R\$/, 'BRL'],
  [/€/, 'EUR'],
  [/£/, 'GBP'],
  [/\$/, 'USD'],
  [/¥/, 'JPY'],
];

/** A price as a spreadsheet cell may hold it: "49,99 zł", "€20", "20 EUR" or a bare "20". */
export function readPrice(text: string): Pick<Copy, 'price' | 'currency'> | undefined {
  const code = text.match(/\b[A-Z]{3}\b/)?.[0];
  const currency = code && (CURRENCIES as readonly string[]).includes(code) ? code : SYMBOLS.find(([re]) => re.test(text))?.[1];
  const price = readAmount(text.replace(/[^\d\s.,']/g, '').trim());
  return price === undefined ? undefined : { price, ...(currency && { currency }) };
}

/** A price for people: "49,99", or with the currency it was paid in, "20,00 €". */
export function formatPrice(price: number, currency: string | undefined, lang: string): string {
  const options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  if (!currency) return price.toLocaleString(lang, options);
  try {
    return new Intl.NumberFormat(lang, { ...options, style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(price);
  } catch {
    return `${price.toLocaleString(lang, options)} ${currency}`;
  }
}

/** A price as the history and the export keep it, unambiguous in any language: "49.99 PLN". */
export const priceText = (copy: Pick<Copy, 'price' | 'currency'>) =>
  copy.price === undefined ? undefined : `${copy.price.toFixed(2)} ${copy.currency ?? ''}`.trim();
