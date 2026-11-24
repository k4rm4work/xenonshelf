import { useEffect, useState } from 'react';
import { failureOf, reasonOf, type ApiError } from '../lib/apiError';
import { copiesOf, findDuplicate, shelvedAs, storedCopies, withCopy } from '../lib/games';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import { LISTS, type Game, type GameList, type IgdbDetails, type IgdbSearchResult } from '../types';
import { Button } from './Button';
import { ClearSearch } from './ClearSearch';
import { CopyOptions, type CopyFields } from './CopyOptions';
import { CloseButton, Dialog, useDialogClose } from './Dialog';
import { GameBox } from './GameBox';
import { GameFactList, GameSummary, GameSummarySkeleton } from './GameFacts';
import { ImportGames } from './ImportGames';
import { Segmented } from './Segmented';

type Props = {
  defaultList: GameList;
  onClose: () => void;
};

/** A search result, or a bare title typed in for a game IGDB doesn't know. */
type Candidate = IgdbSearchResult | { title: string; igdbId?: undefined; releaseYear?: undefined; genres?: undefined };

/** Series, developers, modes and the like for a picked game. Adding never waits on a failure:
    the game goes in without them and `npm run enrich` can fill them in later. */
async function fetchDetails(igdbId: number): Promise<IgdbDetails> {
  try {
    const res = await fetch(`/api/igdb/game?id=${igdbId}`);
    return res.ok ? ((await res.json()) as { details: IgdbDetails }).details : {};
  } catch {
    return {};
  }
}

export function AddGameDialog({ defaultList, onClose }: Props) {
  return (
    <Dialog onClose={onClose} label={useI18n().t('add.dialog')}>
      <AddGameFlow defaultList={defaultList} />
    </Dialog>
  );
}

/** Three steps: search by title, look the chosen game over, then say where it goes
    and what copy it is. Going back from the game keeps the search as it was. */
function AddGameFlow({ defaultList }: { defaultList: GameList }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IgdbSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<ApiError | null>(null);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [importing, setImporting] = useState(false);

  const q = query.trim();
  const shown = q.length < 2 ? [] : results;

  useEffect(() => {
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/igdb/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw await failureOf(res);
        const body = await res.json();
        setResults((body.results as IgdbSearchResult[]).map(shelvedAs));
        setSearchError(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setSearchError(reasonOf(e));
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  if (picked) return <PickedGame candidate={picked} defaultList={defaultList} onBack={() => setPicked(null)} />;
  if (importing) return <ImportGames defaultList={defaultList} onBack={() => setImporting(false)} />;

  const title = query.trim();
  return (
    <div className="gloss rounded-3xl p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-light tracking-tight text-slate-800">{t('add.title')}</h2>
        <CloseButton />
      </div>

      <div className="relative mt-5">
        {/* The bottom padding lifts the text onto the field's optical centre: the font sits
            low in its line box, as in the toolbar's search. */}
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('add.placeholder')}
          className="h-12 w-full rounded-full border border-slate-300 bg-white/90 pr-12 pb-0.5 pl-5 text-lg shadow-inner outline-none focus:border-x360"
        />
        {query && <ClearSearch onClear={() => setQuery('')} className="absolute top-1/2 right-2 -translate-y-1/2" />}
      </div>

      {(searching || searchError) && (
        <div className="mt-2 px-2 text-sm text-slate-500">
          {searching && t('add.searching')}
          {searchError && <span className="text-amber-700">{t('add.searchError', { error: t(`apiError.${searchError}`) })}</span>}
        </div>
      )}

      {shown.length > 0 && (
        <div className="add-results nxe-scroll mt-5">
          {shown.map((r) => (
            <button
              key={r.igdbId}
              type="button"
              onClick={() => setPicked(r)}
              className="rounded-xl p-3 text-left transition hover:bg-white/60 focus-visible:bg-white/60"
            >
              <GameBox game={r} className="text-[9px]" />
              <div className="mt-4 line-clamp-2 text-xs font-semibold text-slate-700">{r.title}</div>
              <div className="text-[11px] text-slate-500">{r.releaseYear ?? '—'}</div>
            </button>
          ))}
        </div>
      )}

      {/* Not every game is on IGDB: it can still go in by its title alone. */}
      {title.length >= 2 && !searching && (
        <Button variant="quiet" onClick={() => setPicked({ title })} className="mt-4">
          {t('add.manual', { title })}
        </Button>
      )}

      <div className="mt-6 border-t border-slate-300/70 pt-4">
        <Button variant="link" onClick={() => setImporting(true)} className="px-2">
          {t('add.importLink')}
        </Button>
      </div>
    </div>
  );
}

/** The chosen game laid out like its card; adding it then asks where it goes and what copy it is. */
function PickedGame({ candidate, defaultList, onBack }: { candidate: Candidate; defaultList: GameList; onBack: () => void }) {
  const { games, addGame, updateGame } = useStore();
  const toast = useToast();
  const close = useDialogClose();
  const { t, labels, genre } = useI18n();
  // A typed-in title has nothing to look up.
  const [details, setDetails] = useState<IgdbDetails | null>(candidate.igdbId ? null : {});
  const [choosing, setChoosing] = useState(false);
  const [list, setList] = useState<GameList>(defaultList);
  const [copy, setCopy] = useState<CopyFields>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (candidate.igdbId) fetchDetails(candidate.igdbId).then(setDetails);
  }, [candidate.igdbId]);

  const duplicate = findDuplicate(games, candidate);
  const preview: Game = { ...candidate, ...details, id: '', list, addedAt: '' };
  const meta = [candidate.releaseYear, ...(candidate.genres ?? []).map(genre)].filter(Boolean);
  const owned = list === 'owned';

  const submit = async () => {
    setSaving(true);
    const { priority, pack, steelbook, format, ...ownedCopy } = copy;
    const game: Game = {
      ...candidate,
      ...(details ?? (candidate.igdbId ? await fetchDetails(candidate.igdbId) : {})),
      id: candidate.igdbId ? `igdb-${candidate.igdbId}` : crypto.randomUUID(),
      list,
      // Only the fields of the chosen list: a priority picked before switching to the collection is dropped.
      ...(owned
        ? {
            playStatus: 'unplayed',
            ...ownedCopy,
            ...(format === 'digital' ? { digital: true, copies: [] } : { copies: storedCopies([{ pack, steelbook }]) }),
          }
        : { priority: priority ?? 'medium' }),
      addedAt: new Date().toISOString(),
    };
    const added = await addGame(game);
    await close();
    if (added) toast({ kicker: t(owned ? 'toast.addedOwned' : 'toast.addedWishlist'), title: game.title, undoable: true });
  };

  /** A game owned, e.g. digitally, put on the wishlist too while a boxed copy is hunted for. */
  const hunt = async () => {
    if (!duplicate) return;
    setSaving(true);
    const changed = await updateGame({ ...duplicate, wanted: true }, { undoable: true });
    await close();
    if (changed) toast({ kicker: t('toast.addedWishlist'), title: duplicate.title, undoable: true });
  };

  /** One more copy of a game already in the collection; its details are noted on the card. */
  const addCopy = async () => {
    if (!duplicate) return;
    setSaving(true);
    const added = await updateGame(withCopy(duplicate), { undoable: true });
    await close();
    if (added) toast({ kicker: t('toast.copyAdded'), title: duplicate.title, undoable: true });
  };

  return (
    <div className="gloss relative grid gap-x-10 gap-y-6 rounded-3xl p-6 sm:grid-cols-[240px_1fr] sm:p-9">
      <CloseButton className="absolute top-4 right-4" />

      <div className="flex min-w-0 flex-col gap-6">
        <GameBox game={preview} flat className="case-spin-in mx-auto w-48 self-start text-[15px] sm:w-full" />
        <div className="hidden sm:block">
          <GameFactList game={preview} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        <header className="pr-10">
          <Button variant="back" onClick={onBack}>
            {t('add.back')}
          </Button>
          <h2 className="text-3xl leading-tight font-light tracking-tight text-slate-800 sm:text-[40px]">{candidate.title}</h2>
          {meta.length > 0 && <div className="mt-2 text-[15px] text-slate-500">{meta.join(' · ')}</div>}
        </header>

        {details ? <GameSummary game={preview} /> : <GameSummarySkeleton label={t('add.loadingDetails')} />}
        <div className="mt-6 sm:hidden">
          <GameFactList game={preview} />
        </div>

        <div className="pt-7">
          {duplicate ? (
            <div className="space-y-4">
              <p className="text-sm text-amber-700">
                {t(duplicate.list === 'owned' ? 'add.duplicateOwned' : 'add.duplicateWishlist', { title: duplicate.title })}
              </p>
              {/* Collectors keep several of a game, e.g. one sealed or spares to sell, or a case
                  beside a download; or they hunt for a case to go with the download. */}
              {duplicate.list === 'owned' && (
                <div className="flex flex-wrap gap-3">
                  <Button size="lg" disabled={saving} onClick={addCopy}>
                    {t('add.addCopy', { count: copiesOf(duplicate).length + 1 })}
                  </Button>
                  {!duplicate.wanted && copiesOf(duplicate).length === 0 && (
                    <Button size="lg" variant="secondary" disabled={saving} onClick={hunt}>
                      {t('add.hunt')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : !choosing ? (
            <Button size="lg" onClick={() => setChoosing(true)}>
              {t('add.addToLibrary')}
            </Button>
          ) : (
            <div className="add-choose space-y-5 border-t border-slate-300/70 pt-6">
              <div>
                <div className="field-label">{t('add.addTo')}</div>
                <Segmented label={t('add.addTo')} value={list} options={labels('list', LISTS)} onChange={setList} />
              </div>
              <div>
                <div className="field-label">{t(owned ? 'add.copy' : 'game.priority')}</div>
                <CopyOptions list={list} value={copy} onChange={(patch) => setCopy((c) => ({ ...c, ...patch }))} />
              </div>
              <Button size="lg" disabled={saving} onClick={submit}>
                {t(owned ? 'add.submitOwned' : 'add.submitWishlist')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
