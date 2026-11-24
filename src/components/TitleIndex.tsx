import { memo } from 'react';
import { shelfCopy } from '../lib/games';
import { useI18n } from '../lib/i18n';
import type { Game } from '../types';
import { DemoTag } from './Demo';
import { GameMarks } from './GameMarks';
import { CloudIcon, GlintIcon, LoanIcon, PackIcon } from './icons';

type Props = {
  games: Game[];
  /** Group under initial letters, like a book index; only meaningful when sorted by title. */
  grouped: boolean;
  onOpen: (game: Game) => void;
};

// Digits and symbols share one "#" section, the way game shops shelve them.
// Accents fold into the base letter, matching the title sort (Ś files under S).
const initial = (title: string) => {
  const c = title.trim().normalize('NFD').charAt(0).toLocaleUpperCase('pl');
  return /\p{L}/u.test(c) ? c : '#';
};

/** Text-only view: the library as a table of contents, no covers. */
export const TitleIndex = memo(function TitleIndex({ games, grouped, onOpen }: Props) {
  // Keyed by letter, so a title the sort files elsewhere (e.g. one starting with a
  // quote mark) still joins its section instead of opening a second one.
  const byKey = new Map<string, Game[]>();
  for (const g of games) {
    const key = grouped ? initial(g.title) : '';
    const section = byKey.get(key);
    if (section) section.push(g);
    else byKey.set(key, [g]);
  }
  const sections = [...byKey]
    .map(([key, games]) => ({ key, games }))
    // "#" opens the index, as in a printed one.
    .sort((a, b) => Number(b.key === '#') - Number(a.key === '#'));

  return (
    <div className="title-index gloss rounded-2xl px-6 py-5 sm:px-8">
      {sections.map((s) => (
        <section key={s.key || 'all'} className="title-index-section">
          {s.key && (
            <h3 className="title-index-letter">
              {s.key}
              <span className="title-index-count">{s.games.length}</span>
            </h3>
          )}
          <ul>
            {s.games.map((g) => (
              <li key={g.id}>
                <IndexRow game={g} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
});

function IndexRow({ game, onOpen }: { game: Game; onOpen: (game: Game) => void }) {
  const { t } = useI18n();
  // The case on the shelf: the first copy, none for a digital game.
  const shelved = shelfCopy(game);
  const borrowers = (game.copies ?? []).flatMap((copy) => (copy.lentTo ? [copy.lentTo] : []));

  return (
    <button type="button" data-tile onClick={() => onOpen(game)} className="title-index-row group">
      <span className="truncate">{game.title}</span>
      {game.demo && <DemoTag className="flex-none" />}
      {game.copies && game.copies.length > 1 && (
        <span className="flex-none text-xs font-bold text-emerald-700" data-tip={t('game.copiesTitle', { count: game.copies.length })}>
          ×{game.copies.length}
        </span>
      )}
      {!!shelved.pack && shelved.pack > 1 && (
        <span className="flex-none text-violet-600 [&>svg]:size-3.5" data-tip={t('game.packTitle', { count: shelved.pack })}>
          <PackIcon games={shelved.pack} />
        </span>
      )}
      {shelved.steelbook && (
        <span className="flex-none text-slate-500 [&>svg]:size-3.5" data-tip="SteelBook">
          <GlintIcon />
        </span>
      )}
      {game.digital && (
        <span className="flex-none text-sky-600 [&>svg]:size-3.5" data-tip={t('game.digitalVersion')}>
          <CloudIcon />
        </span>
      )}
      {borrowers.length > 0 && (
        <span className="flex-none text-rose-600 [&>svg]:size-3.5" data-tip={t('game.lentTitle', { name: borrowers.join(', ') })}>
          <LoanIcon />
        </span>
      )}
      <span className="title-index-leader" aria-hidden />
      <GameMarks game={game} />
      <span className="title-index-year">{game.releaseYear ?? '—'}</span>
    </button>
  );
}
