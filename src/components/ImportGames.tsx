import { useMemo, useRef, useState } from 'react';
import { failureOf, reasonOf, type ApiError } from '../lib/apiError';
import { igdbCoverUrl } from '../lib/cover';
import { findDuplicate, findNearDuplicate, shelvedAs, withCopy } from '../lib/games';
import { useI18n } from '../lib/i18n';
import { copyFromRow, gameFromRow, IMPORT_TEMPLATE, parseImport, type ImportRow } from '../lib/importRows';
import { useStore } from '../lib/store';
import { titleKey } from '../lib/titles';
import { useToast } from '../lib/toast';
import { LISTS, type Game, type GameList, type IgdbDetails, type IgdbSearchResult } from '../types';
import { Button } from './Button';
import { CloseButton, useDialogClose } from './Dialog';
import { Dropdown } from './Dropdown';
import { Segmented } from './Segmented';

/** Titles per match request: small enough for steady progress, IGDB takes ~¼ s each. */
const MATCH_CHUNK = 10;
/** IDs per details request; the server fetches them from IGDB in batches of 100. */
const DETAILS_CHUNK = 100;

type Confidence = 'exact' | 'close';

/** One row of the import with what IGDB made of it. `choice` is the picked IGDB id, or
    'title' to add the game by its title alone; `auto` is the one IGDB matched by itself. */
type Candidate = {
  row: ImportRow;
  results: IgdbSearchResult[];
  auto?: { igdbId: number; confidence: Confidence };
  choice: number | 'title';
  included: boolean;
};

type TitleMatch = { title: string; results: IgdbSearchResult[]; match?: { igdbId: number; confidence: Confidence } };

/** The game in the library a row names: by its IGDB match, or by its title allowing a
    slip of the keyboard when IGDB found nothing to go by. */
const ownedAs = (games: Game[], title: string, igdbId?: number) =>
  findDuplicate(games, { igdbId, title }) ?? (igdbId === undefined ? findNearDuplicate(games, title) : undefined);

/** A row as matched. One already in the library starts unticked: more often a list made
    again than a second copy. So does one IGDB answered without finding it, often a slip of
    the keyboard better corrected than added without a cover; when IGDB didn't answer at
    all, every row stays in. */
const toCandidate = (games: Game[], row: ImportRow, match?: TitleMatch): Candidate => {
  const igdbId = match?.match?.igdbId;
  const picked = igdbId === undefined ? undefined : match?.results.find((r) => r.igdbId === igdbId);
  return {
    row,
    results: match?.results ?? [],
    auto: match?.match,
    choice: igdbId ?? 'title',
    included: !ownedAs(games, picked?.title ?? row.title, igdbId) && (!match || !!match.match),
  };
};

/** A physical game in the collection: the only kind that has copies to count. */
const isShelved = (fields: { list?: GameList; format?: string }) => fields.list === 'owned' && fields.format !== 'digital';

/** Many games at once: paste or load a list, check what IGDB matched, add the lot. */
export function ImportGames({ defaultList, onBack }: { defaultList: GameList; onBack: () => void }) {
  const { t, labels, plural } = useI18n();
  const { games } = useStore();
  const [text, setText] = useState('');
  const [list, setList] = useState<GameList>(defaultList);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [matchError, setMatchError] = useState<ApiError | null>(null);
  const cancel = useRef<AbortController | null>(null);

  const rows = useMemo(() => parseImport(text, list), [text, list]);

  const match = async () => {
    const ctrl = new AbortController();
    cancel.current = ctrl;
    setMatchError(null);
    setProgress({ done: 0, total: rows.length });
    const found: Candidate[] = [];
    try {
      for (let i = 0; i < rows.length; i += MATCH_CHUNK) {
        const chunk = rows.slice(i, i + MATCH_CHUNK);
        const res = await fetch('/api/igdb/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titles: chunk.map((r) => r.title) }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw await failureOf(res);
        const body = await res.json();
        chunk.forEach((row, j) => {
          const match = (body.matches as TitleMatch[])[j];
          found.push(toCandidate(games, row, match && { ...match, results: match.results.map(shelvedAs) }));
        });
        setProgress({ done: found.length, total: rows.length });
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return setProgress(null);
      // Without IGDB the rest still goes in by title; the review says so.
      setMatchError(reasonOf(e));
      rows.slice(found.length).forEach((row) => found.push(toCandidate(games, row)));
    }
    setProgress(null);
    setCandidates(found);
  };

  if (candidates) {
    return <ImportReview candidates={candidates} onChange={setCandidates} error={matchError} onEdit={() => setCandidates(null)} />;
  }

  const readFile = async (file: File | undefined) => {
    if (file) setText(await file.text());
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([IMPORT_TEMPLATE + '\n'], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'xenonshelf-import.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="gloss rounded-3xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="back" onClick={onBack}>
            {t('import.back')}
          </Button>
          <h2 className="text-3xl font-light tracking-tight text-slate-800">{t('import.title')}</h2>
        </div>
        <CloseButton />
      </div>

      <p className="mt-3 max-w-2xl text-[15px] text-slate-600">{t('import.intro')}</p>

      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('import.placeholder')}
        disabled={!!progress}
        rows={9}
        spellCheck={false}
        className="nxe-scroll mt-5 w-full resize-y rounded-2xl border border-slate-300 bg-white/90 px-4 py-3 font-mono text-sm shadow-inner outline-none focus:border-x360"
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-sm font-semibold">
        <label className="cursor-pointer text-x360-dark hover:underline">
          {t('import.file')}
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="sr-only"
            onChange={(e) => {
              readFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <Button variant="link" onClick={downloadTemplate}>
          {t('import.template')}
        </Button>
      </div>

      <AiPrompt />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-slate-300/70 pt-6">
        <div>
          <div className="field-label">{t('import.defaultList')}</div>
          <Segmented label={t('import.defaultList')} value={list} options={labels('list', LISTS)} onChange={setList} />
        </div>
        {progress ? (
          <div className="flex min-w-60 flex-1 items-center gap-4 sm:max-w-sm">
            <div className="flex-1">
              <div className="text-sm text-slate-600">{t('import.matching', { done: progress.done, total: progress.total })}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-300/70">
                <div
                  className="h-full rounded-full bg-x360 transition-[width]"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
            <Button variant="quiet" size="sm" onClick={() => cancel.current?.abort()}>
              {t('import.cancel')}
            </Button>
          </div>
        ) : (
          <Button size="lg" disabled={!rows.length} onClick={match}>
            {rows.length ? t('import.match', { games: plural('stats.games', rows.length) }) : t('import.matchEmpty')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** The prompt that turns photos of a shelf into a sheet this import reads. */
function AiPrompt() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(t('import.aiPrompt'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <details className="group mt-5 rounded-2xl border border-slate-300/70 bg-white/40 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700 marker:text-slate-400">{t('import.aiTitle')}</summary>
      <p className="mt-2 text-sm text-slate-600">{t('import.aiIntro')}</p>
      <pre className="nxe-scroll mt-3 max-h-48 overflow-auto rounded-xl bg-slate-800/90 p-3 font-mono text-xs whitespace-pre-wrap text-slate-100">
        {t('import.aiPrompt')}
      </pre>
      {/* The clipboard needs https or localhost; elsewhere the text can still be selected by hand. */}
      {navigator.clipboard && (
        <Button variant="secondary" size="sm" onClick={copy} className="mt-3">
          {copied ? t('import.copied') : t('import.copyPrompt')}
        </Button>
      )}
    </details>
  );
}

/** How a row stands: matched by IGDB, a loose match worth a look, picked by hand, not
    found; another copy of a game in the collection or earlier in the list; or a game
    already in the library or listed twice that can't have copies (wishlist, digital). */
type RowState = 'exact' | 'close' | 'picked' | 'none' | 'copyOfOwned' | 'copyInList' | 'inLibrary' | 'repeated';

/** `key` names the game the row adds to; `owned` is that game when it is already in the library. */
type Review = Candidate & { match?: IgdbSearchResult; state: RowState; key: string; owned?: Game };

const BLOCKED: RowState[] = ['inLibrary', 'repeated'];
const COPIES: RowState[] = ['copyOfOwned', 'copyInList'];

/** Every row with its match, to correct before anything is added. A second copy of a game
    can go in; a second entry of a wished-for or digital game can't. */
function ImportReview({
  candidates,
  onChange,
  error,
  onEdit,
}: {
  candidates: Candidate[];
  onChange: (candidates: Candidate[]) => void;
  error: ApiError | null;
  onEdit: () => void;
}) {
  const { t, plural } = useI18n();
  const { games, importGames } = useStore();
  const toast = useToast();
  const close = useDialogClose();
  const [saving, setSaving] = useState(false);

  const reviewed = useMemo(() => {
    // Games the rows above add, by every key they're known by: whether each has copies.
    const seen = new Map<string, { key: string; shelved: boolean }>();
    return candidates.map((c): Review => {
      const match = c.choice === 'title' ? undefined : c.results.find((r) => r.igdbId === c.choice);
      const title = match?.title ?? c.row.title;
      const keys = [titleKey(title), ...(match ? [`igdb-${match.igdbId}`] : [])];
      const shelved = isShelved(c.row.fields);
      const inLibrary = ownedAs(games, title, match?.igdbId);
      const earlier = keys.map((k) => seen.get(k)).find(Boolean);
      const state: RowState = inLibrary
        ? shelved && isShelved(inLibrary)
          ? 'copyOfOwned'
          : 'inLibrary'
        : earlier
          ? shelved && earlier.shelved
            ? 'copyInList'
            : 'repeated'
          : !match
            ? 'none'
            : match.igdbId !== c.auto?.igdbId
              ? 'picked'
              : c.auto.confidence;
      const key = inLibrary?.id ?? earlier?.key ?? keys[keys.length - 1];
      if (c.included && !inLibrary && !earlier) keys.forEach((k) => seen.set(k, { key, shelved }));
      return { ...c, match, state, key, owned: inLibrary };
    });
  }, [candidates, games]);

  const toAdd = reviewed.filter((r) => r.included && !BLOCKED.includes(r.state));
  const extraCopies = toAdd.filter((r) => COPIES.includes(r.state)).length;
  const amount = plural('stats.games', toAdd.length - extraCopies) + (extraCopies ? ` + ${plural('import.copies', extraCopies)}` : '');
  const summary = (['exact', 'picked', 'close', 'none', 'copyOfOwned', 'copyInList', 'inLibrary', 'repeated'] as const)
    .map((state) => [state, reviewed.filter((r) => r.state === state).length] as const)
    .filter(([, n]) => n > 0);

  const update = (i: number, patch: Partial<Candidate>) => onChange(candidates.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const setAll = (included: boolean) => onChange(candidates.map((c) => ({ ...c, included })));

  const submit = async () => {
    setSaving(true);
    const ids = toAdd.flatMap((r) => (r.match ? [r.match.igdbId] : []));
    const details: Record<number, IgdbDetails> = {};
    // Adding never waits on a failure: the games go in without details, as in AddGameDialog.
    for (let i = 0; i < ids.length; i += DETAILS_CHUNK) {
      try {
        const res = await fetch(`/api/igdb/games?ids=${ids.slice(i, i + DETAILS_CHUNK).join(',')}`);
        if (res.ok) Object.assign(details, (await res.json()).details);
      } catch {
        // `npm run enrich` can fill them in later.
      }
    }
    const now = new Date();
    // New games by key; a later row naming one of them, or a game owned already, adds a copy.
    const added = new Map<string, Game>();
    const changed = new Map<string, Game>();
    for (const r of toAdd) {
      if (r.state === 'copyOfOwned' && r.owned) {
        changed.set(r.key, withCopy(changed.get(r.key) ?? r.owned, copyFromRow(r.row)));
      } else if (r.state === 'copyInList' && added.has(r.key)) {
        added.set(r.key, withCopy(added.get(r.key)!, copyFromRow(r.row)));
      } else {
        added.set(r.key, gameFromRow(r.row, r.match, r.match && details[r.match.igdbId], now));
      }
    }
    const saved = await importGames([...added.values()], [...changed.values()]);
    setSaving(false);
    if (!saved) return;
    await close();
    toast({ kicker: t('import.toast'), title: amount, undoable: true });
  };

  return (
    <div className="gloss rounded-3xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="back" onClick={onEdit} disabled={saving}>
            {t('import.edit')}
          </Button>
          <h2 className="text-3xl font-light tracking-tight text-slate-800">{t('import.reviewTitle')}</h2>
        </div>
        <CloseButton />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
        {summary.map(([state, n]) => (
          <span key={state}>
            {t(`import.state.${state}`)}: <b className="text-slate-800">{n}</b>
          </span>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-amber-700">{t('import.matchError', { error: t(`apiError.${error}`) })}</p>}

      <div className="mt-4 flex gap-4 px-1">
        <Button variant="link" onClick={() => setAll(true)}>
          {t('import.selectAll')}
        </Button>
        <Button variant="link" onClick={() => setAll(false)}>
          {t('import.selectNone')}
        </Button>
      </div>

      {/* Its own scroll on a wide screen; on a phone the sheet scrolls it with the rest. */}
      <ul className="nxe-scroll mt-2 divide-y divide-slate-300/60 rounded-2xl border border-slate-300/70 bg-white/50 sm:max-h-[min(60vh,640px)] sm:overflow-y-auto">
        {reviewed.map((r, i) => (
          <ImportRowItem key={i} review={r} disabled={saving} onChange={(patch) => update(i, patch)} />
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-4">
        {saving && <span className="text-sm text-slate-500">{t('import.adding')}</span>}
        <Button size="lg" disabled={saving || !toAdd.length} onClick={submit}>
          {t('import.submit', { games: amount })}
        </Button>
      </div>
    </div>
  );
}

function ImportRowItem({
  review: r,
  disabled,
  onChange,
}: {
  review: Review;
  disabled: boolean;
  onChange: (patch: Partial<Candidate>) => void;
}) {
  const { t, labels } = useI18n();
  const blocked = BLOCKED.includes(r.state);
  const tone = blocked ? 'muted' : r.state === 'close' || r.state === 'none' ? 'warn' : COPIES.includes(r.state) ? 'copy' : 'ok';
  const fields = r.row.fields;
  const facts = [
    fields.list && labels('list', LISTS)[fields.list],
    fields.playStatus && t(`status.${fields.playStatus}`),
    fields.format === 'digital' && t('format.digital'),
    fields.priority && t(`priority.${fields.priority}`),
    fields.edition && t(`edition.${fields.edition}`),
    fields.region && t(`region.${fields.region}`),
    fields.condition && t(`condition.${fields.condition}`),
    fields.completeness && t(`completeness.${fields.completeness}`),
    fields.ean,
    fields.forSale && t('copy.forSale'),
    fields.notes && `„${fields.notes}”`,
  ].filter(Boolean);

  const options = [
    ...r.results.map((res) => ({ value: String(res.igdbId), label: res.releaseYear ? `${res.title} (${res.releaseYear})` : res.title })),
    { value: 'title', label: t('import.withoutMatch') },
  ];

  return (
    <li className={`import-row ${blocked || !r.included ? 'is-off' : ''}`}>
      <input
        type="checkbox"
        checked={r.included && !blocked}
        disabled={disabled || blocked}
        onChange={(e) => onChange({ included: e.target.checked })}
        aria-label={r.match?.title ?? r.row.title}
        className="nxe-check"
      />
      <div className="grid h-14 w-10 flex-none place-items-center overflow-hidden rounded bg-slate-300/70 text-[9px] text-slate-500">
        {r.match?.coverImageId ? (
          <img src={igdbCoverUrl(r.match.coverImageId, 'cover_small')} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          '360'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-slate-800">
          {r.match?.title ?? r.row.title}
          {r.match?.releaseYear && <span className="ml-1.5 font-normal text-slate-500">{r.match.releaseYear}</span>}
        </div>
        {r.match && r.match.title !== r.row.title && (
          <div className="truncate text-xs text-slate-500">{t('import.fromList', { title: r.row.title })}</div>
        )}
        {/* Taken for a game in the library under another spelling: say which. */}
        {r.owned && titleKey(r.owned.title) !== titleKey(r.match?.title ?? r.row.title) && (
          <div className="truncate text-xs text-slate-500">{t('import.inLibraryAs', { title: r.owned.title })}</div>
        )}
        {facts.length > 0 && <div className="truncate text-xs text-slate-500">{facts.join(' · ')}</div>}
        {r.row.problems.length > 0 && (
          <div className="truncate text-xs text-amber-700">{t('import.problems', { cells: r.row.problems.join(', ') })}</div>
        )}
        <span className={`import-state import-state-${tone}`}>{t(`import.state.${r.state}`)}</span>
      </div>
      <div className="import-row-match">
        {r.results.length > 0 && (
          <Dropdown
            label={t('import.pick')}
            value={String(r.choice)}
            options={options}
            disabled={disabled}
            block
            onChange={(value) => onChange({ choice: value === 'title' ? 'title' : Number(value), included: true })}
          />
        )}
      </div>
    </li>
  );
}
