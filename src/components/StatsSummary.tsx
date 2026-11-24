import { useId, type ReactNode } from 'react';
import type { GameQuery, LibraryStats } from '../lib/games';
import { useI18n } from '../lib/i18n';
import { usePopover } from '../lib/popover';
import type { GameList } from '../types';
import { CloudIcon, DiscIcon, HourglassIcon, LoanIcon, StarIcon, TagIcon, TrophyIcon, TruckIcon } from './icons';

/** The filters a row of the breakdown stands for. */
export type StatsFilter = Pick<GameQuery, 'format' | 'playStatus' | 'order'>;

type Props = {
  total: number;
  stats: LibraryStats;
  /** The list and filters shown now, to mark the row that matches them. */
  query: GameQuery;
  /** Shows the games a row counts. */
  onPick: (list: GameList, filter: StatsFilter) => void;
};

/** The size of the list on a quiet button; the whole breakdown folds out under it, each
    row showing the games it counts. */
export function StatsSummary({ total, stats, query, onPick }: Props) {
  const { t, lower, plural } = useI18n();
  // Lines up with the button's right edge, unless that would run off the screen.
  const { open, setOpen, ref, buttonRef, panelRef, panelStyle } = usePopover('right');
  const cardId = useId();

  const row = (icon: ReactNode, label: string, value: number, list: GameList, filter: StatsFilter) => {
    const active =
      query.list === list && (Object.keys(filter) as (keyof StatsFilter)[]).every((key) => (query[key] ?? 'all') === filter[key]);
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => {
          onPick(list, filter);
          setOpen(false);
        }}
        className={`stats-row ${active ? 'stats-row-active' : ''}`}
      >
        <span className="text-slate-400">{icon}</span>
        <span>{label}</span>
        <b>{value}</b>
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        className={`nxe-field flex h-10 items-center gap-2 pr-2.5 pl-3.5 text-sm whitespace-nowrap text-slate-600 ${open ? 'nxe-field-open' : ''}`}
      >
        <span className="nxe-label">{plural('stats.games', total)}</span>
        <svg viewBox="0 0 12 12" className={`size-3 text-slate-400 transition ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4.5 6 8l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          id={cardId}
          role="dialog"
          aria-label={t('stats.label')}
          className="nxe-menu nxe-scroll stats-card absolute top-full left-0 z-40 mt-2 overflow-y-auto"
          style={panelStyle}
        >
          <div className="filter-group-label">{t('stats.label')}</div>
          {row(<DiscIcon />, lower(t('stats.physical')), stats.physical, 'owned', { format: 'physical' })}
          {row(<CloudIcon />, lower(t('stats.digital')), stats.digital, 'owned', { format: 'digital' })}
          {row(<HourglassIcon />, lower(t('stats.playing')), stats.playing, 'owned', { playStatus: 'playing' })}
          {row(<TrophyIcon />, lower(t('stats.completed')), stats.completed, 'owned', { playStatus: 'completed' })}
          {stats.forSale > 0 && row(<TagIcon />, lower(t('stats.forSale')), stats.forSale, 'owned', { format: 'forSale' })}
          {stats.lent > 0 && row(<LoanIcon />, lower(t('stats.lent')), stats.lent, 'owned', { format: 'lent' })}
          <div className="stats-divider" />
          {row(<StarIcon />, lower(t('stats.wishlist')), stats.wishlist, 'wishlist', { order: 'all' })}
          {stats.ordered > 0 && row(<TruckIcon />, lower(t('stats.ordered')), stats.ordered, 'wishlist', { order: 'ordered' })}
        </div>
      )}
    </div>
  );
}
