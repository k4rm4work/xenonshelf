import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type UIEvent } from 'react';
import { historyOf } from '../lib/history';
import { useI18n, type I18n, type MessageKey } from '../lib/i18n';
import { formatPrice } from '../lib/price';
import type { Game, HistoryEntry } from '../types';
import {
  CasesIcon,
  CompletedIcon,
  DiscIcon,
  DroppedIcon,
  LoanIcon,
  PlayingIcon,
  StarIcon,
  TagIcon,
  TrashIcon,
  TruckIcon,
  UnplayedIcon,
} from './icons';
import { starsText } from './SheetRows';

const lineIcon = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** A plus in a ring: a game added. */
function AddedIcon() {
  return (
    <svg {...lineIcon}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 7v6M7 10h6" />
    </svg>
  );
}

/** An arrow across: a game moved to the other list. */
function MovedIcon() {
  return (
    <svg {...lineIcon}>
      <path d="M3.5 10h12M11.5 6l4 4-4 4" />
    </svg>
  );
}

/** A pen: something written or edited. */
function PenIcon() {
  return (
    <svg {...lineIcon}>
      <path d="m12.5 4.5 3 3L8 15H5v-3l7.5-7.5Z" />
    </svg>
  );
}

const STATUS_MARKS = { unplayed: <UnplayedIcon />, playing: <PlayingIcon />, completed: <CompletedIcon />, dropped: <DroppedIcon /> };

/** Each detail's name in a line of the history. */
const FIELD_NAMES: Record<string, MessageKey> = {
  title: 'history.field.title',
  cover: 'history.field.cover',
  igdb: 'history.field.igdb',
  releaseYear: 'history.field.releaseYear',
  format: 'game.format',
  demo: 'game.demoVersion',
  priority: 'game.priority',
  digital: 'game.digitalVersion',
  wanted: 'game.wanted',
  notes: 'game.notes',
  review: 'rating.review',
  pack: 'game.case',
  steelbook: 'history.field.steelbook',
  edition: 'copy.edition',
  completeness: 'copy.completeness',
  region: 'copy.region',
  condition: 'copy.condition',
  ean: 'copy.ean',
  price: 'copy.price',
  location: 'copy.location',
  forSale: 'copy.forSale',
};

/** A copy's details, marked with a disc rather than the pen of the game's own. */
const COPY_DETAILS = new Set([
  'pack',
  'steelbook',
  'edition',
  'completeness',
  'region',
  'condition',
  'ean',
  'price',
  'location',
  'forSale',
]);

/** Fields whose values are choices with labels of their own, e.g. "edition.limited". */
const CHOICES = new Set(['format', 'priority', 'edition', 'completeness', 'region', 'condition']);

/** "49.99 PLN" as kept in the history, in the reader's own way of writing it. */
function historyPrice(text: string, lang: string) {
  const [amount, currency] = text.split(' ');
  return Number.isFinite(Number(amount)) ? formatPrice(Number(amount), currency, lang) : text;
}

/** Details that are yes or no. */
const FLAGS = new Set(['digital', 'wanted', 'demo']);

/** "Edition: Limited", "Notes edited", with the copy it was when there are several. */
function editedText(e: Extract<HistoryEntry, { kind: 'edited' }>, t: I18n['t'], has: I18n['has'], lang: string) {
  const field = FIELD_NAMES[e.field] ? t(FIELD_NAMES[e.field]) : t('history.field.details');
  const keyed = 'to' in e;
  let text: string;
  // A flag turned off before that was kept as false.
  if (!keyed && FLAGS.has(e.field)) text = t('history.edited', { field, value: t('copy.no') });
  else if (!keyed) text = t('history.changed', { field });
  else if (e.to === undefined || e.to === '') text = t('history.cleared', { field });
  else {
    const choice = `${e.field}.${e.to}`;
    const value =
      typeof e.to === 'boolean'
        ? t(e.to ? 'copy.yes' : 'copy.no')
        : e.field === 'pack'
          ? t('game.packTitle', { count: Number(e.to) })
          : e.field === 'price'
            ? historyPrice(String(e.to), lang)
            : CHOICES.has(e.field) && has(choice)
              ? t(choice as MessageKey)
              : String(e.to);
    text = t('history.edited', { field, value });
  }
  return e.copy ? `${text} · ${t('copy.tab', { n: e.copy })}` : text;
}

/** What happened to the game, newest first: one line each, its mark, its words and when.
    The marks are one family of line icons in one colour, so the words carry the news. */
export function GameHistory({ game }: { game: Pick<Game, 'history' | 'addedAt' | 'list'> }) {
  const { t, has, lang } = useI18n();
  const entries = historyOf(game);
  // Where a long history scrolls, its lines fade out at an edge with more beyond it.
  const list = useRef<HTMLOListElement>(null);
  const [fade, setFade] = useState('');
  const measure = useCallback((el: HTMLElement) => {
    const above = el.scrollTop > 1;
    const below = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setFade([above && 'top', below && 'bottom'].filter(Boolean).join(' '));
  }, []);
  useLayoutEffect(() => {
    if (list.current) measure(list.current);
  }, [entries.length, measure]);
  // The day a game from before the history was added carries no time worth showing.
  const when = (entry: HistoryEntry) =>
    new Date(entry.at).toLocaleString(lang, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...(game.history?.includes(entry) && { hour: '2-digit', minute: '2-digit' }),
    });

  const line = (e: HistoryEntry): [ReactNode, ReactNode] => {
    switch (e.kind) {
      case 'added':
        return [<AddedIcon />, t(e.list === 'owned' ? 'history.addedOwned' : 'history.addedWishlist')];
      case 'moved':
        return [<MovedIcon />, t(e.list === 'owned' ? 'history.movedOwned' : 'history.movedWishlist')];
      case 'ordered':
        return [<TruckIcon />, t('history.ordered')];
      case 'orderCancelled':
        return [<TruckIcon />, t('history.orderCancelled')];
      case 'status':
        return e.to
          ? [STATUS_MARKS[e.to], t('history.status', { status: t(`status.${e.to}`) })]
          : [<UnplayedIcon />, t('history.statusCleared')];
      case 'rating':
        return [<StarIcon />, e.to ? t('history.rating', { stars: starsText(e.to, lang) }) : t('history.ratingCleared')];
      case 'reviewed':
        return [<PenIcon />, t('history.reviewed')];
      case 'copyAdded':
        return [<CasesIcon />, t('history.copyAdded', { count: e.count })];
      case 'copyRemoved':
        return [<TrashIcon />, t('history.copyRemoved', { count: e.count })];
      case 'lent':
        return [<LoanIcon />, t('history.lent', { who: e.who })];
      case 'returned':
        return [<LoanIcon />, t('history.returned', { who: e.who })];
      case 'tagged':
        return [<TagIcon />, t('history.tagged', { tag: e.tag })];
      case 'untagged':
        return [<TagIcon />, t('history.untagged', { tag: e.tag })];
      case 'edited':
        return [COPY_DETAILS.has(e.field) ? <DiscIcon /> : <PenIcon />, editedText(e, t, has, lang)];
    }
  };

  return (
    <ol
      ref={list}
      className="history nxe-scroll"
      data-fade={fade || undefined}
      onScroll={(e: UIEvent<HTMLOListElement>) => measure(e.currentTarget)}
    >
      {entries.map((entry, i) => {
        const [icon, text] = line(entry);
        return (
          <li key={`${entry.at}-${i}`} className="history-entry">
            <span className="history-mark">{icon}</span>
            <span className="history-text">{text}</span>
            <time dateTime={entry.at} className="history-when">
              {when(entry)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
