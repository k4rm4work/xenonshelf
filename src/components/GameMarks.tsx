import type { ReactNode } from 'react';
import { isBackCompat } from '../lib/backcompat';
import { useI18n } from '../lib/i18n';
import type { Game } from '../types';
import { PRIORITY_ICONS, STATUS_ICONS } from './choiceIcons';
import { CloudIcon, SearchIcon, StarIcon, TruckIcon } from './icons';
import { starsText } from './SheetRows';

/** The marks beside a game's name, the same under a case and in the list: where it stands
    (status, or for a wish its priority or that it is on its way), a download beside the case,
    a boxed copy still hunted for, the player's own score and whether it plays on Xbox One /
    Series. Icons only, each named in its tooltip. */
export function GameMarks({ game }: { game: Game }) {
  const { t, lang } = useI18n();
  const status = game.playStatus ?? 'unplayed';
  const owned = game.list === 'owned';
  const mark = (label: string, icon: ReactNode) => (
    <span className="game-mark" role="img" aria-label={label} data-tip={label}>
      {icon}
    </span>
  );
  return (
    <>
      {owned
        ? // "Unplayed" is the default state, so only real progress shows.
          status !== 'unplayed' && mark(t(`status.${status}`), STATUS_ICONS[status])
        : game.orderedAt
          ? mark(
              t('game.orderedTitle'),
              <span className="status-icon status-icon-ordered">
                <TruckIcon />
              </span>,
            )
          : game.priority && mark(`${t('game.priority')}: ${t(`priority.${game.priority}`)}`, PRIORITY_ICONS[game.priority])}
      {/* A game owned only digitally says so on its card; one owned both ways, here. */}
      {owned && game.digital && game.copies?.length !== 0 && mark(t('game.digitalVersion'), <CloudIcon />)}
      {owned &&
        game.wanted &&
        (game.orderedAt
          ? mark(
              t('game.orderedTitle'),
              <span className="status-icon status-icon-ordered">
                <TruckIcon />
              </span>,
            )
          : mark(t('game.wanted'), <SearchIcon />))}
      {owned && game.myRating && (
        <span className="game-rating" aria-label={`${t('rating.title')}: ${starsText(game.myRating, lang)}`} data-tip={t('rating.title')}>
          <StarIcon />
          {starsText(game.myRating, lang)}
        </span>
      )}
      {isBackCompat(game) && (
        <span className="game-compat" aria-label={t('facts.backCompat')} data-tip={t('facts.backCompat')}>
          X<span className="game-compat-bar" />S
        </span>
      )}
    </>
  );
}
