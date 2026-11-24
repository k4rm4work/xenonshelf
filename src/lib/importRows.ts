// Many games at once: a plain list of titles, a CSV file, or cells pasted from a spreadsheet.
// A header row names the columns, in English or Polish; values may be our codes ("owned")
// or the labels the app shows in either language ("Kolekcja").
import {
  COMPLETENESS,
  CONDITIONS,
  EDITIONS,
  FORMATS,
  LISTS,
  PLAY_STATUSES,
  PRIORITIES,
  PACK_SIZES,
  REGIONS,
  type Copy,
  type Edition,
  type GameFormat,
  type Game,
  type GameList,
  type IgdbDetails,
  type IgdbSearchResult,
} from '../types';
import { cleanTag, copiesOf, isDigitalOnly, storedCopies } from './games';
import { inEveryLanguage, type MessageKey } from './i18n';
import { CURRENCIES, priceText, readPrice } from './price';

/** What an import row may say about the game besides its title, and about its copy. */
export type ImportFields = Partial<Pick<Game, 'list' | 'playStatus' | 'priority' | 'notes' | 'myRating' | 'review' | 'tags'>> &
  Copy & {
    /** A case, a download, or both. */
    format?: GameFormat | 'both';
  };

export type ImportRow = {
  title: string;
  fields: ImportFields;
  /** Cells that weren't understood and were left out, as "<column>: <value>". */
  problems: string[];
};

type Field = keyof ImportFields | 'title';

/** Header names each column answers to, in each language the app speaks; compared folded,
    like values. */
const COLUMNS: Record<Field, string[]> = {
  title: [
    'title',
    'tytuł',
    'gra',
    'game',
    'name',
    'nazwa',
    'titel',
    'spiel',
    'título',
    'juego',
    'nombre',
    'titre',
    'jeu',
    'nom',
    'jogo',
    'nome',
  ],
  list: ['list', 'lista', 'liste'],
  format: ['format', 'formato'],
  playStatus: ['status', 'play status', 'estado', 'statut'],
  priority: ['priority', 'priorytet', 'priorität', 'prioridad', 'priorité', 'prioridade'],
  edition: ['edition', 'wydanie', 'edycja', 'ausgabe', 'edición', 'édition', 'edição'],
  region: ['region', 'región', 'région', 'região'],
  condition: ['condition', 'stan', 'zustand', 'conservación', 'état', 'conservação'],
  completeness: ['completeness', 'kompletność', 'zawartość', 'vollständigkeit', 'contenido', 'contenu', 'conteúdo'],
  ean: ['ean', 'barcode', 'kod kreskowy', 'kod', 'upc', 'strichcode', 'código de barras', 'code-barres'],
  price: [
    'price',
    'price paid',
    'purchase price',
    'cost',
    'cena',
    'cena zakupu',
    'koszt',
    'preis',
    'kaufpreis',
    'precio',
    'precio de compra',
    'prix',
    "prix d'achat",
    'preço',
    'preço pago',
  ],
  currency: ['currency', 'waluta', 'währung', 'moneda', 'devise', 'moeda'],
  steelbook: ['steelbook', 'steel book'],
  pack: ['pack', 'case', 'pudełko', 'gry w pudełku', 'hülle', 'caja', 'boîtier', 'caixa'],
  forSale: ['for sale', 'na sprzedaż', 'sprzedaż', 'sell', 'zu verkaufen', 'verkauf', 'en venta', 'à vendre', 'à venda'],
  notes: ['notes', 'note', 'notatki', 'notatka', 'uwagi', 'notizen', 'notiz', 'notas'],
  location: ['location', 'place', 'miejsce', 'lokalizacja', 'gdzie', 'ort', 'lugar', 'emplacement', 'ubicación'],
  lentTo: [
    'lent to',
    'on loan to',
    'borrower',
    'wypożyczona',
    'wypożyczona komu',
    'komu',
    'pożyczona',
    'verliehen an',
    'prestado a',
    'prêté à',
    'emprestado para',
  ],
  lentAt: [
    'lent at',
    'lent on',
    'on loan since',
    'od kiedy',
    'data wypożyczenia',
    'wypożyczona od',
    'verliehen seit',
    'prestado desde',
    'prêté depuis',
    'emprestado desde',
  ],
  myRating: ['rating', 'my rating', 'stars', 'ocena', 'moja ocena', 'gwiazdki', 'bewertung', 'valoración', 'ma note', 'minha nota'],
  review: ['review', 'recenzja', 'opinia', 'rezension', 'reseña', 'critique', 'análise'],
  tags: ['tags', 'tag', 'tagi', 'kolekcje', 'etiquetas', 'etiqueta'],
};

/** Yes/no cells: "tak", "yes", "ja", "x" and the like, or their opposites. */
const YES = ['yes', 'y', 'tak', 't', 'true', '1', 'x', 'ja', 'j', 'sí', 'si', 's', 'oui', 'o', 'sim'];
const NO = ['no', 'n', 'nie', 'false', '0', 'nein', 'non', 'não', 'nao'];

/** Choice columns: their codes, and the i18n prefix of the labels that also name them. */
const CHOICES: Partial<Record<Field, { values: readonly string[]; prefix: string }>> = {
  list: { values: LISTS, prefix: 'list' },
  format: { values: FORMATS, prefix: 'format' },
  playStatus: { values: PLAY_STATUSES, prefix: 'status' },
  priority: { values: PRIORITIES, prefix: 'priority' },
  edition: { values: EDITIONS, prefix: 'edition' },
  region: { values: REGIONS, prefix: 'region' },
  condition: { values: CONDITIONS, prefix: 'condition' },
  completeness: { values: COMPLETENESS, prefix: 'completeness' },
  pack: { values: PACK_SIZES, prefix: 'pack' },
};

/** Common ways of writing a value that neither its code nor its labels cover. */
const SYNONYMS: Record<string, string> = {
  collection: 'owned',
  single: '1',
  double: '2',
  triple: '3',
  'platinum hits': 'classics',
  platinum: 'classics',
  'game of the year': 'goty',
  'game of the year edition': 'goty',
  'collector s edition': 'collectors',
  collector: 'collectors',
  ntsc: 'ntsc-u',
  'ntsc u': 'ntsc-u',
  'ntsc j': 'ntsc-j',
};

/** Lower case, no accents, punctuation as single spaces: "Kompletność" → "kompletnosc". */
const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const columnOf = (header: string) =>
  (Object.keys(COLUMNS) as Field[]).find((field) => COLUMNS[field].some((name) => fold(name) === fold(header)));

function readChoice(field: Field, raw: string): string | undefined {
  const choice = CHOICES[field]!;
  const wanted = fold(raw);
  const synonym = SYNONYMS[wanted];
  return choice.values.find(
    (value) =>
      value === synonym ||
      fold(value) === wanted ||
      inEveryLanguage(`${choice.prefix}.${value}` as MessageKey).some((label) => fold(label) === wanted),
  );
}

/** Splits delimited text into rows of cells; quotes may hold the delimiter, line breaks and "". */
export function splitCells(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell.trim() === '') {
      cell = '';
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      rows.push([...row, cell]);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.map((r) => r.map((c) => c.trim()));
}

/** "- Halo 3", "2. Halo 3", "• Halo 3": list markers an AI or a notes app puts in front. */
const LIST_MARKER = /^(?:[-*•–]\s+|\d{1,4}[.)]\s+)/;

/**
 * Reads pasted text or a file's contents into rows. With a header row naming a title column
 * (tab, semicolon or comma separated) every named column is read; without one, each line is
 * a title, and of cells pasted from a spreadsheet only the first is.
 */
export function parseImport(text: string, defaultList: GameList): ImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    // Excel may start a CSV with a line naming its separator.
    .replace(/^sep=.\r?\n/i, '');
  const firstLine = lines.split(/\r?\n/, 1)[0] ?? '';

  for (const delimiter of ['\t', ';', ',']) {
    const header = splitCells(firstLine, delimiter)[0] ?? [];
    const fields = header.map(columnOf);
    if (header.length > 1 && fields.includes('title')) {
      return splitCells(lines, delimiter)
        .slice(1)
        .map((cells) => readRow(cells, header, fields, defaultList))
        .filter((row): row is ImportRow => !!row);
    }
  }

  return lines
    .split(/\r?\n/)
    .map((line) => line.split('\t')[0].replace(LIST_MARKER, '').trim())
    .filter((title) => title && !title.startsWith('#'))
    .map((title) => ({ title, fields: { list: defaultList }, problems: [] }));
}

/** Owned on a disc and as a download, in the words of each language. */
const BOTH = /^(both|oba|obie|obydwie|beide|ambos|ambas|les deux)$/i;

/** The kind of edition a name written out in full belongs to: "N7 Collector's Edition" is
    a collector's one. */
const EDITION_WORDS: [RegExp, Edition][] = [
  [/collector|kolekcjon/, 'collectors'],
  [/limited|limitowan/, 'limited'],
  [/game of the year|goty/, 'goty'],
  [/classics|platinum|essentials/, 'classics'],
];

function readRow(cells: string[], header: string[], fields: (Field | undefined)[], defaultList: GameList): ImportRow | undefined {
  const row: ImportRow = { title: '', fields: {}, problems: [] };
  const set = row.fields as Record<string, string>;
  // Cells kept as written when no column holds them as they are, added to the notes.
  const asWritten: string[] = [];
  cells.forEach((value, i) => {
    const field = fields[i];
    if (!field || !value) return;
    if (field === 'title') row.title = value;
    else if (field === 'ean') {
      const digits = value.replace(/\D/g, '');
      if (/^\d{8,14}$/.test(digits)) set.ean = digits;
      else row.problems.push(`${header[i]}: ${value}`);
    } else if (field === 'format' && BOTH.test(value.trim())) {
      row.fields.format = 'both';
    } else if (field === 'price') {
      // A currency column, wherever it stands, wins over a symbol in the price.
      const price = readPrice(value);
      if (price) Object.assign(row.fields, price, row.fields.currency && { currency: row.fields.currency });
      else row.problems.push(`${header[i]}: ${value}`);
    } else if (field === 'currency') {
      const code = value.trim().toUpperCase();
      if ((CURRENCIES as readonly string[]).includes(code)) row.fields.currency = code;
      else row.problems.push(`${header[i]}: ${value}`);
    } else if (field === 'notes' || field === 'location' || field === 'lentTo' || field === 'review') set[field] = value;
    else if (field === 'lentAt') {
      const day = readDay(value);
      if (day) set.lentAt = day;
      else row.problems.push(`${header[i]}: ${value}`);
    } else if (field === 'myRating') {
      const rating = readRating(value);
      if (rating) row.fields.myRating = rating;
      else row.problems.push(`${header[i]}: ${value}`);
    } else if (field === 'tags') {
      const tags = [...new Set(value.split(/[,;|]/).map(cleanTag).filter(Boolean))];
      if (tags.length) row.fields.tags = tags;
    } else if (field === 'forSale' || field === 'steelbook') {
      if (YES.includes(fold(value))) row.fields[field] = true;
      else if (!NO.includes(fold(value))) row.problems.push(`${header[i]}: ${value}`);
    } else if (field === 'edition' && !readChoice(field, value)) {
      // An edition with its own name: its kind when the name tells it, and the name itself
      // in the notes, so nothing written is lost.
      const kind = EDITION_WORDS.find(([words]) => words.test(fold(value)))?.[1];
      if (kind) row.fields.edition = kind;
      asWritten.push(`${header[i]}: ${value}`);
    } else {
      const choice = readChoice(field, value);
      // A case holds 1 to 3 games; a single one is the default and isn't stored.
      if (field === 'pack' && choice) row.fields.pack = choice === '1' ? undefined : Number(choice);
      else if (choice) set[field] = choice;
      else row.problems.push(`${header[i]}: ${value}`);
    }
  });
  if (!row.title) return undefined;
  row.fields.list ??= defaultList;
  // A currency with no price to go with says nothing.
  if (row.fields.price === undefined) delete row.fields.currency;
  if (asWritten.length) row.fields.notes = [row.fields.notes, ...asWritten].filter(Boolean).join('\n');
  return row;
}

/** Stars as written in a sheet, 0.5 to 5 in halves ("4,5" too), stored as half stars 1–10. */
function readRating(raw: string): number | undefined {
  const stars = Number(raw.replace(',', '.').replace(/[★*]/g, '').trim());
  const halves = Math.round(stars * 2);
  return Number.isFinite(stars) && halves >= 1 && halves <= 10 && Math.abs(stars * 2 - halves) < 0.01 ? halves : undefined;
}

/** A day as YYYY-MM-DD, written that way or as DD.MM.YYYY. */
function readDay(raw: string): string | undefined {
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const local = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  const parts = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : undefined;
  if (!parts) return undefined;
  const [year, month, day] = parts.map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return undefined;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return undefined;
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

/** The details of the copy an import row describes; empty when it names none. */
export function copyFromRow(row: ImportRow): Copy {
  const {
    list: _list,
    format: _format,
    playStatus: _playStatus,
    priority: _priority,
    notes: _notes,
    myRating: _myRating,
    review: _review,
    tags: _tags,
    ...copy
  } = row.fields;
  return copy;
}

/** The game an import row becomes: matched on IGDB or by its title alone. Only the fields
    of its list are kept, as when a game is added by hand; a digital one has no copy to describe. */
export function gameFromRow(row: ImportRow, match: IgdbSearchResult | undefined, details: IgdbDetails | undefined, now: Date): Game {
  const { list = 'owned', format = 'physical', playStatus, priority, notes, myRating, review, tags } = row.fields;
  return {
    ...(match ?? { title: row.title }),
    ...details,
    id: match ? `igdb-${match.igdbId}` : crypto.randomUUID(),
    list,
    ...(list === 'owned'
      ? {
          playStatus: playStatus ?? 'unplayed',
          // With no case, the price paid is the download's.
          ...(format === 'digital'
            ? { digital: true, copies: [], digitalPrice: row.fields.price, digitalCurrency: row.fields.currency }
            : { copies: storedCopies([copyFromRow(row)]) }),
          ...(format === 'both' && { digital: true }),
        }
      : { priority: priority ?? 'medium' }),
    ...(notes && { notes }),
    ...(myRating && { myRating }),
    ...(review && { review }),
    ...(tags && { tags }),
    addedAt: now.toISOString(),
  };
}

/** A sheet to fill in: the header, then two copies of a game in the collection (one for
    sale) and one game from the wishlist. */
export const IMPORT_TEMPLATE = [
  'title,list,format,status,priority,pack,steelbook,edition,region,condition,completeness,ean,for sale,notes',
  'Halo 3,owned,physical,completed,,,,classics,pal,good,cib,,,',
  'Halo 3,owned,physical,,,,yes,limited,pal,worn,case,,yes,',
  'Alan Wake,wishlist,,,high,,,,,,,,,',
].join('\n');

/** Columns of a spreadsheet export, in the order the import template has them. */
const EXPORT_COLUMNS = [
  'title',
  'list',
  'format',
  'status',
  'priority',
  'pack',
  'steelbook',
  'edition',
  'region',
  'condition',
  'completeness',
  'ean',
  'price',
  'for sale',
  'location',
  'lent to',
  'lent at',
  'rating',
  'review',
  'tags',
  'notes',
];

const csvCell = (value: string | number | undefined) => {
  const text = value === undefined ? '' : String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * The library as a spreadsheet the import reads back: a row per copy, the game's own
 * details (status, rating, review, tags, notes) on its first row only, so they come back
 * once. Semicolons, as a spreadsheet set to Polish expects, and a byte-order mark so it
 * opens the accents right.
 */
export function exportCsv(games: Game[]): string {
  const lines = [EXPORT_COLUMNS.join(';')];
  for (const game of games) {
    const copies = copiesOf(game);
    (copies.length ? copies : [undefined]).forEach((copy, i) => {
      const first = i === 0;
      const cells: (string | number | undefined)[] = [
        game.title,
        game.list,
        game.list === 'owned' ? (isDigitalOnly(game) ? 'digital' : game.digital ? 'both' : 'physical') : undefined,
        first && game.list === 'owned' ? (game.playStatus ?? 'unplayed') : undefined,
        first && game.list === 'wishlist' ? (game.priority ?? 'medium') : undefined,
        copy?.pack,
        copy?.steelbook ? 'yes' : undefined,
        copy?.edition,
        copy?.region,
        copy?.condition,
        copy?.completeness,
        copy?.ean,
        copy ? priceText(copy) : isDigitalOnly(game) ? priceText({ price: game.digitalPrice, currency: game.digitalCurrency }) : undefined,
        copy?.forSale ? 'yes' : undefined,
        copy?.location,
        copy?.lentTo,
        copy?.lentAt,
        // A decimal comma: a Polish spreadsheet reads "4.5" as a date.
        first && game.myRating ? String(game.myRating / 2).replace('.', ',') : undefined,
        first ? game.review : undefined,
        first ? game.tags?.join(', ') : undefined,
        first ? game.notes : undefined,
      ];
      lines.push(cells.map(csvCell).join(';'));
    });
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
