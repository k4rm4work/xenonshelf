import { useState, type ReactNode } from 'react';
import { isBackCompat } from '../lib/backcompat';
import { useI18n } from '../lib/i18n';
import type { Game } from '../types';
import { Button } from './Button';
import { starsText } from './SheetRows';

/** Descriptions longer than this start folded to two lines. */
const FOLD_AT = 160;

/** Critics' score coloured like a review aggregator: green, amber or red. */
const ratingTone = (rating: number) => (rating >= 75 ? 'facts-score-good' : rating >= 50 ? 'facts-score-mixed' : 'facts-score-bad');

/** IGDB's description, folded when long. IGDB writes them in English only. */
export function GameSummary({ game }: { game: Game }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  if (!game.summary) return null;
  const foldable = game.summary.length > FOLD_AT;

  return (
    <div className="mt-4">
      <p lang="en" className={`text-[15px] leading-relaxed text-slate-600 ${foldable && !expanded ? 'line-clamp-2' : ''}`}>
        {game.summary}
      </p>
      {foldable && (
        <Button variant="link" onClick={() => setExpanded((e) => !e)} className="mt-0.5">
          {t(expanded ? 'game.less' : 'game.more')}
        </Button>
      )}
    </div>
  );
}

/** Stand-in while the description loads, exactly as tall as a folded one (two lines and
    the "more" link) so nothing below it moves when the text arrives. */
export function GameSummarySkeleton({ label }: { label: string }) {
  return (
    <div className="mt-4" role="status" aria-label={label}>
      <p aria-hidden className="text-[15px] leading-relaxed">
        <span className="summary-skeleton w-full" />
        <span className="summary-skeleton w-3/4" />
      </p>
      <span aria-hidden className="invisible mt-0.5 inline-block text-sm font-semibold">
        &nbsp;
      </span>
    </div>
  );
}

/** What IGDB knows about the game, compact enough to sit under the case. Only known facts show. */
export function GameFactList({ game }: { game: Game }) {
  const { t, lang } = useI18n();

  // A publisher that also developed the game would repeat the same name.
  const publishers = game.publishers?.filter((p) => !game.developers?.includes(p));
  const together = [
    game.coop && t('facts.coop'),
    game.splitscreen && t('facts.splitscreen'),
    game.localPlayers && t('facts.players', { count: game.localPlayers }),
  ].filter(Boolean);
  const time = [
    game.hoursStory && t('facts.hoursStory', { hours: game.hoursStory }),
    game.hoursComplete && t('facts.hoursComplete', { hours: game.hoursComplete }),
  ].filter(Boolean);

  const facts: [string, ReactNode][] = [];
  if (game.series?.length) facts.push([t('facts.series'), game.series[0]]);
  if (game.developers?.length)
    facts.push([
      t(publishers?.length ? 'facts.developerPublisher' : 'facts.developer'),
      <>
        {game.developers.join(', ')}
        {publishers?.length ? <span className="block text-slate-500">{publishers.join(', ')}</span> : null}
      </>,
    ]);
  if (together.length) facts.push([t('facts.together'), together.join(' · ')]);
  if (time.length) facts.push([t('facts.time'), time.join(' · ')]);
  if (isBackCompat(game)) facts.push([t('facts.platforms'), t('facts.backCompat')]);

  const badges = game.rating !== undefined || !!game.pegi || !!game.myRating;
  if (!badges && !facts.length) return null;

  return (
    <div className="facts">
      {badges && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Score and PEGI are a pair of small labels, each a number over its name. */}
          {game.rating !== undefined && (
            <span
              className={`facts-score ${ratingTone(game.rating)}`}
              role="img"
              aria-label={`${t('facts.rating')}: ${game.rating}`}
              data-tip={t('facts.rating')}
            >
              <b>{game.rating}</b>
              <small>{t('facts.critics')}</small>
            </span>
          )}
          {!!game.myRating && (
            <span
              className="facts-score facts-score-mine"
              role="img"
              aria-label={`${t('rating.title')}: ${t('rating.value', { stars: starsText(game.myRating, lang) })}`}
              data-tip={t('rating.title')}
            >
              <b>{starsText(game.myRating, lang)}</b>
              <small>{t('rating.badge')}</small>
            </span>
          )}
          {!!game.pegi && (
            <span className={`facts-pegi facts-pegi-${game.pegi}`} role="img" aria-label={`${t('facts.pegi')} ${game.pegi}`}>
              <b>{game.pegi}</b>
              <small>{t('facts.pegi')}</small>
            </span>
          )}
        </div>
      )}
      {facts.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-1">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="field-label mb-0.5!">{label}</dt>
              <dd className="text-sm leading-snug text-slate-700">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
