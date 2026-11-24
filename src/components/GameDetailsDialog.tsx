import { useEffect, useState } from 'react';
import { coverSrc } from '../lib/cover';
import { markAsOwned, onList, toggleOrdered, withCopy, type GameQuery } from '../lib/games';
import { useI18n } from '../lib/i18n';
import { CAN_EDIT, useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import type { Game } from '../types';
import { Button } from './Button';
import { CopySheet, LoanNotice, PlayBar } from './CopySheet';
import { CloseButton, Dialog, useDialogClose } from './Dialog';
import { GameBox } from './GameBox';
import { GameFactList, GameSummary } from './GameFacts';
import { ChevronLeftIcon, ChevronRightIcon, TrashIcon, TruckIcon } from './icons';
import { Shortcut } from './Shortcut';

type Props = {
  game: Game;
  onClose: () => void;
  /** Open the neighbouring game in the list; absent at either end. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Open another game in its place, e.g. one from the same series. */
  onOpen: (game: Game) => void;
  /** Close the game and show the list filtered by one of its facts. */
  onFilter: (filter: FactFilter) => void;
};

type FactFilter = Pick<GameQuery, 'year' | 'genre'>;

/** Arrow keys belong to whatever is focused when it uses them itself: text, radio groups, menus. */
const ownsArrowKeys = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest('input, textarea, select, [role=radiogroup], [role=listbox], [role=menu], [aria-expanded=true]');

export function GameDetailsDialog({ game, onClose, onPrev, onNext, onOpen, onFilter }: Props) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || ownsArrowKeys(e.target)) return;
      if (e.key === 'ArrowLeft') onPrev?.();
      else if (e.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPrev, onNext]);

  return (
    <Dialog
      onClose={onClose}
      label={game.title}
      backdropImage={coverSrc(game)}
      aside={
        <>
          <StepButton side="prev" label={t('game.prev')} onClick={onPrev} />
          <StepButton side="next" label={t('game.next')} onClick={onNext} />
        </>
      }
    >
      {/* Keyed so a draft note or a pending delete never carries over to the next game. */}
      <Details key={game.id} game={game} onOpen={onOpen} onFilter={onFilter} />
    </Dialog>
  );
}

/** Round arrow fixed at the screen edge beside the panel, with its keycap under it. */
function StepButton({ side, label, onClick }: { side: 'prev' | 'next'; label: string; onClick?: () => void }) {
  const key = side === 'prev' ? 'ArrowLeft' : 'ArrowRight';
  return (
    <div className={`step-button step-button-${side}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        aria-label={label}
        data-tip={label}
        aria-keyshortcuts={key}
        className="nxe-field grid size-11 place-items-center rounded-full! text-slate-600 hover:text-slate-900 disabled:opacity-0 [&>svg]:size-5"
      >
        {side === 'prev' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </button>
      {onClick && <Shortcut keyName={side === 'prev' ? '←' : '→'} />}
    </div>
  );
}

/** The title as typed into a shop or a search engine: the platform keeps out other consoles' editions. */
const searchTitle = (title: string) => (/xbox\s*360/i.test(title) ? title : `${title} Xbox 360`);

/** The Clipboard API exists only on https or localhost; a home server on plain http falls back to execCommand. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
    field.style.cssText = 'position:fixed;opacity:0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  }
}

/** How long the tip says the title was copied before offering to copy it again. */
const COPIED_MS = 2000;

/** The title, copied by a click; its tooltip confirms it rather than a toast. */
function CopyTitle({ title }: { title: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      data-tip={t(copied ? 'game.titleCopied' : 'game.copyTitle')}
      onClick={async () => {
        // Back to the offer first, so copying again changes the tip and shows it again.
        setCopied(false);
        setCopied(await copyText(searchTitle(title)));
      }}
      className="cursor-pointer rounded-md text-left transition-colors hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-x360"
    >
      {title}
    </button>
  );
}

/** The other games of the series in the collection, oldest first; a case opens that game. */
function SeriesShelf({ game, onOpen }: { game: Game; onOpen: (game: Game) => void }) {
  const { games } = useStore();
  const { t } = useI18n();
  const series = game.series ?? [];
  const others = games
    .filter((g) => g.id !== game.id && onList(g, 'owned') && g.series?.some((s) => series.includes(s)))
    .sort((a, b) => (a.releaseYear ?? 9999) - (b.releaseYear ?? 9999) || a.title.localeCompare(b.title));
  if (!others.length) return null;

  return (
    <section className="mt-6">
      <div className="field-label">{t('game.sameSeries', { series: series[0] })}</div>
      <div className="mt-3 flex flex-wrap gap-3">
        {others.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onOpen(g)}
            aria-label={g.title}
            data-tip={[g.title, g.releaseYear].filter(Boolean).join(' · ')}
            className="w-16 cursor-pointer rounded-sm transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-x360 sm:w-20"
          >
            <GameBox game={g} flat />
          </button>
        ))}
      </div>
    </section>
  );
}

function Details({ game, onOpen, onFilter }: Pick<Props, 'game' | 'onOpen' | 'onFilter'>) {
  const { updateGame, removeGame } = useStore();
  const close = useDialogClose();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { t, rich, genre, date } = useI18n();

  const toast = useToast();

  // Small edits save quietly; only moving a game in or out of a list gets a toast.
  const update = (patch: Partial<Game>) => updateGame({ ...game, ...patch });
  const isOwned = game.list === 'owned';
  // On the wishlist: a wish, or a game owned whose case is still hunted for.
  const wished = !isOwned || !!game.wanted;
  // Each fact under the title shows the list filtered by it.
  const meta: { label: string; tip: string; filter: FactFilter }[] = [
    ...(game.releaseYear
      ? [{ label: String(game.releaseYear), tip: t('game.filterYear', { year: game.releaseYear }), filter: { year: game.releaseYear } }]
      : []),
    ...(game.genres ?? []).map((g) => ({ label: genre(g), tip: t('game.filterGenre', { genre: genre(g) }), filter: { genre: g } })),
  ];

  return (
    <div className="gloss relative grid gap-x-10 gap-y-6 rounded-3xl p-6 sm:grid-cols-[240px_1fr] sm:p-9">
      <CloseButton className="absolute top-4 right-4" />

      {/* Facts sit under the case; on a phone, where the case heads the page, they follow the title instead. */}
      <div className="flex min-w-0 flex-col gap-6">
        <GameBox game={game} flat className="case-spin-in mx-auto w-48 self-start text-[15px] sm:w-full" />
        <div className="hidden sm:block">
          <GameFactList game={game} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        <header className="pr-10">
          <div className="field-label text-x360-dark!">{t(isOwned ? 'game.inCollection' : 'game.onWishlist')}</div>
          <h2 className="text-3xl leading-tight font-light tracking-tight text-slate-800 sm:text-[40px]">
            <CopyTitle title={game.title} />
          </h2>
          {meta.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[15px] text-slate-500">
              {meta.map((m, i) => (
                <span key={m.label} className="flex items-center gap-2">
                  {i > 0 && <span className="text-slate-300">·</span>}
                  <button
                    type="button"
                    data-tip={m.tip}
                    onClick={async () => {
                      await close();
                      onFilter(m.filter);
                    }}
                    className="cursor-pointer rounded-sm transition-colors hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x360"
                  >
                    {m.label}
                  </button>
                </span>
              ))}
            </div>
          )}
          <PlayBar game={game} onChange={update} disabled={!CAN_EDIT} />
        </header>

        <LoanNotice game={game} onChange={update} disabled={!CAN_EDIT} />
        <GameSummary game={game} />
        <div className="mt-6 sm:hidden">
          <GameFactList game={game} />
        </div>

        {wished && game.orderedAt && (
          <div className="notice notice-sky mt-6">
            <TruckIcon />
            <span>{rich('game.orderedOn', { date: date(game.orderedAt), gotIt: <b>{t('game.gotIt')}</b> })}</span>
          </div>
        )}

        <div className="mt-7">
          <CopySheet game={game} onChange={update} disabled={!CAN_EDIT} aboutGame={<SeriesShelf game={game} onOpen={onOpen} />} />
        </div>

        <footer className="mt-auto flex flex-wrap items-center gap-3 pt-8">
          <span className={`text-xs text-slate-400 ${isOwned ? 'ml-auto' : ''}`}>{t('game.addedOn', { date: date(game.addedAt) })}</span>
          {/* A field like the rest of the card, kept quiet until hovered or asking to confirm. */}
          {CAN_EDIT && (
            <button
              type="button"
              onClick={async () => {
                if (!confirmDelete) return setConfirmDelete(true);
                await close();
                if (await removeGame(game.id)) toast({ kicker: t('toast.removed'), title: game.title, undoable: true });
              }}
              onBlur={() => setConfirmDelete(false)}
              className={`nxe-field flex h-8 items-center gap-1.5 px-3 text-xs font-semibold transition [&>svg]:size-3.5 ${
                confirmDelete ? 'delete-confirm' : 'text-slate-500 hover:text-rose-600'
              }`}
            >
              <TrashIcon />
              <span className="nxe-label">{t(confirmDelete ? 'game.confirmDelete' : 'game.delete')}</span>
            </button>
          )}

          {CAN_EDIT && wished && (
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => updateGame(toggleOrdered(game))}>
                <TruckIcon />
                {t(game.orderedAt ? 'game.cancelOrder' : 'game.markOrdered')}
              </Button>
              <Button
                onClick={async () =>
                  (await updateGame(isOwned ? withCopy(game) : markAsOwned(game), { undoable: true })) &&
                  toast({
                    kicker: t('toast.achievement'),
                    title: t('toast.owned', { title: game.title }),
                    undoable: true,
                  })
                }
              >
                {t('game.gotIt')}
              </Button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
