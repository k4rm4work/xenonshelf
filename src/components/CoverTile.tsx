import { memo, type ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import type { Game } from '../types';
import { GameBox } from './GameBox';
import { CompletedIcon, DroppedIcon, PlayingIcon, TruckIcon } from './icons';

// The same icons as under a case; "unplayed" is the default and gets none.
const STATUS_BADGE: Record<string, ReactNode> = {
  playing: <PlayingIcon />,
  completed: <CompletedIcon />,
  dropped: <DroppedIcon />,
};

type Props = {
  game: Game;
  onOpen: (game: Game) => void;
  index?: number;
};

/** Compact shelf tile: just the case, packed tight; the title slides in on hover. */
// Memoised: opening a dialog re-renders the page, which must not redraw every case.
export const CoverTile = memo(function CoverTile({ game, onOpen, index = 0 }: Props) {
  const { t } = useI18n();
  const status = game.playStatus ?? 'unplayed';
  const badge = game.list === 'owned' && STATUS_BADGE[status];
  return (
    <button
      type="button"
      data-tile
      onClick={() => onOpen(game)}
      aria-label={game.title}
      className="compact-tile rise group"
      style={{ animationDelay: `${Math.min(index, 60) * 12}ms` }}
    >
      <GameBox game={game} />
      {badge && (
        <span
          className={`compact-tile-badge compact-tile-badge-${status}`}
          role="img"
          aria-label={t(`status.${status}`)}
          data-tip={t(`status.${status}`)}
        >
          {badge}
        </span>
      )}
      {game.orderedAt && (
        <span className="compact-tile-badge" role="img" aria-label={t('game.orderedTitle')} data-tip={t('game.orderedTitle')}>
          <TruckIcon />
        </span>
      )}
      <span className="compact-tile-caption">
        <span className="block leading-tight font-semibold">{game.title}</span>
        {game.releaseYear && <span className="block text-white/70">{game.releaseYear}</span>}
      </span>
    </button>
  );
});
