import { useState, type ReactNode } from 'react';
import { copiesOf, locationsOf, storedCopies, tagsOf, withCopy } from '../lib/games';
import { useI18n, type I18n } from '../lib/i18n';
import { formatPrice, readPrice } from '../lib/price';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import {
  COMPLETENESS,
  CONDITIONS,
  EDITIONS,
  PACK_SIZES,
  PLAY_STATUSES,
  PRIORITIES,
  REGIONS,
  type Copy,
  type Game,
  type PackSize,
} from '../types';
import { Button } from './Button';
import { PACK_ICONS, PRIORITY_ICONS, STATUS_ICONS } from './choiceIcons';
import { Dropdown } from './Dropdown';
import { GameHistory } from './GameHistory';
import { CloudIcon, GlintIcon, LoanIcon, TagIcon } from './icons';
import { dayIso, LoanForm, LocationRow, StarRating, TagEditor, TextRow } from './SheetRows';

/** Stands for "not noted" in the menus, which only take strings. */
const UNSET = 'unset';

type Props = {
  game: Game;
  onChange: (patch: Partial<Game>) => void;
  disabled?: boolean;
};

/** Menu options from a picker's labels, each with its icon. */
const choices = <T extends string>(labels: Record<T, string>, icons: Partial<Record<T, ReactNode>> = {}) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label, icon: icons[value] }));

/** A yes/no row that flips on click. */
function FlagRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button type="button" aria-pressed={value} onClick={() => onChange(!value)} disabled={disabled} className="sheet-row">
      <span className="sheet-row-label">{label}</span>
      <span className={`sheet-row-value ${value ? 'sheet-row-on' : 'sheet-row-empty'}`}>{t(value ? 'copy.yes' : 'copy.no')}</span>
    </button>
  );
}

/** Places and borrowers already used anywhere in the library, offered as they are typed. */
type Known = { locations: string[]; borrowers: string[] };

/** What a collector can note about a copy, in the order its rows show: what it is (the
    release, its region, its case), the state it is in, then where it is and what it cost, up
    for sale beside the price paid, and the barcode, looked up least, last. */
const COPY_DETAILS = [
  'edition',
  'region',
  'pack',
  'steelbook',
  'completeness',
  'condition',
  'location',
  'price',
  'forSale',
  'ean',
] as const;
type CopyDetail = (typeof COPY_DETAILS)[number];

/** Each detail's name, for its row. */
const detailLabel = (detail: CopyDetail, t: I18n['t']) =>
  ({
    pack: t('game.case'),
    steelbook: t('game.steelbook'),
    edition: t('copy.edition'),
    completeness: t('copy.completeness'),
    region: t('copy.region'),
    condition: t('copy.condition'),
    ean: t('copy.ean'),
    price: t('copy.price'),
    location: t('copy.location'),
    forSale: t('copy.forSale'),
  })[detail];

/** The row for one detail of a physical copy. */
function detailRow(
  detail: CopyDetail,
  copy: Copy,
  onChange: (patch: Partial<Copy>) => void,
  disabled: boolean | undefined,
  { t, labels }: I18n,
  known: Known,
): ReactNode {
  const label = detailLabel(detail, t);
  const unset = { value: UNSET, label: t('copy.unset') };
  /** A row for one optional choice: "—" until something is picked. */
  const choice = <K extends 'edition' | 'completeness' | 'region' | 'condition', V extends string>(field: K, values: readonly V[]) => (
    <Dropdown<string>
      key={field}
      row
      label={label}
      value={copy[field] ?? UNSET}
      neutral={UNSET}
      options={[unset, ...choices(labels(field, values))]}
      onChange={(v) => onChange({ [field]: v === UNSET ? undefined : v })}
      disabled={disabled}
    />
  );
  switch (detail) {
    case 'pack':
      return (
        <Dropdown
          key="pack"
          row
          label={label}
          value={String(copy.pack ?? 1) as PackSize}
          options={choices(labels('pack', PACK_SIZES), PACK_ICONS)}
          onChange={(size) => onChange({ pack: size === '1' ? undefined : Number(size) })}
          disabled={disabled}
        />
      );
    case 'steelbook':
    case 'forSale':
      return (
        <FlagRow
          key={detail}
          label={label}
          value={!!copy[detail]}
          onChange={(on) => onChange({ [detail]: on || undefined })}
          disabled={disabled}
        />
      );
    case 'edition':
      return choice('edition', EDITIONS);
    case 'completeness':
      return choice('completeness', COMPLETENESS);
    case 'region':
      return choice('region', REGIONS);
    case 'condition':
      return choice('condition', CONDITIONS);
    case 'ean':
      // Keyed by its value too, so the field picks up a change made elsewhere, e.g. a removed copy before it.
      return <EanRow key={`ean-${copy.ean ?? ''}`} value={copy.ean} onChange={(ean) => onChange({ ean })} disabled={disabled} />;
    case 'price':
      return (
        <PriceRow
          key={`price-${copy.price ?? ''}-${copy.currency ?? ''}`}
          price={copy.price}
          currency={copy.currency}
          onChange={(price) => onChange({ price: price?.price, currency: price?.currency })}
          disabled={disabled}
        />
      );
    case 'location':
      return (
        <LocationRow
          key={`location-${copy.location ?? ''}`}
          value={copy.location}
          known={known.locations}
          onChange={(location) => onChange({ location })}
          disabled={disabled}
        />
      );
  }
}

/** Under the title: how far the player got with the game and what they make of it, or for
    a wish how badly it's wanted, then their tags. These change most, so they sit up front
    rather than in the sheet. */
export function PlayBar({ game, onChange, disabled }: Props) {
  const { t, labels } = useI18n();
  const { games } = useStore();
  const owned = game.list === 'owned';
  return (
    <div className="play-bar">
      {owned ? (
        <>
          <Dropdown
            chip
            label={t('game.status')}
            value={game.playStatus ?? 'unplayed'}
            options={choices(labels('status', PLAY_STATUSES), STATUS_ICONS)}
            onChange={(playStatus) => onChange({ playStatus })}
            disabled={disabled}
          />
          <StarRating value={game.myRating} onChange={(myRating) => onChange({ myRating })} disabled={disabled} />
        </>
      ) : (
        <Dropdown
          chip
          label={t('game.priority')}
          value={game.priority ?? 'medium'}
          options={choices(labels('priority', PRIORITIES), PRIORITY_ICONS)}
          onChange={(priority) => onChange({ priority })}
          disabled={disabled}
        />
      )}
      <TagEditor tags={game.tags} known={tagsOf(games)} onChange={(tags) => onChange({ tags })} disabled={disabled} />
    </div>
  );
}

/** Borrowers named anywhere in the library, offered as a name is typed. */
const borrowersOf = (games: Game[]) =>
  [...new Set(games.flatMap((g) => copiesOf(g).flatMap((copy) => (copy.lentTo ? [copy.lentTo] : []))))].sort();

/** A copy out on loan, said where it can't be missed: a note under the title, one per
    copy lent, each with "edit" to change who has it or since when, and "returned" to
    take it back. */
export function LoanNotice({ game, onChange, disabled }: Props) {
  const { t, date } = useI18n();
  const { games } = useStore();
  const [editing, setEditing] = useState<number>();
  const copies = copiesOf(game);
  const lent = copies.flatMap((copy, i) => (copy.lentTo ? [{ copy, i }] : []));
  if (!lent.length) return null;
  const changeCopy = (index: number, patch: Partial<Copy>) =>
    onChange({ copies: storedCopies(copies.map((copy, i) => (i === index ? { ...copy, ...patch } : copy))) });

  return (
    <div className="mt-5 flex flex-col gap-2">
      {lent.map(({ copy, i }) =>
        editing === i ? (
          <div key={i} className="loan-notice-form">
            <LoanForm
              copy={copy}
              borrowers={borrowersOf(games)}
              onChange={(patch) => changeCopy(i, patch)}
              onDone={() => setEditing(undefined)}
            />
          </div>
        ) : (
          <div key={i} className="notice">
            <LoanIcon />
            <span className="min-w-0 flex-1">
              {copies.length > 1 && <b>{t('copy.tab', { n: i + 1 })}: </b>}
              {copy.lentAt
                ? t('loan.notice', { name: copy.lentTo!, date: date(dayIso(copy.lentAt)) })
                : t('loan.noticeUndated', { name: copy.lentTo! })}
            </span>
            {!disabled && (
              <>
                <button type="button" onClick={() => setEditing(i)} className="notice-action">
                  {t('copy.editLoan')}
                </button>
                <button
                  type="button"
                  onClick={() => changeCopy(i, { lentTo: undefined, lentAt: undefined })}
                  className="notice-action notice-action-primary"
                >
                  {t('copy.returned')}
                </button>
              </>
            )}
          </div>
        ),
      )}
    </div>
  );
}

/** The rest of what there is to note, in a sheet of rows two columns wide: name on the
    left, value on the right, a menu behind each. A game in the collection splits it in two
    tabs: the game, and what of it is owned (its cases and its download), where only the
    details noted show and the rest wait in an "add a detail" menu, so a plain copy stays a
    line or two. */
export function CopySheet({ game, onChange, disabled }: Props) {
  const { t } = useI18n();
  const owned = game.list === 'owned';
  const held = copiesOf(game).length + (owned && game.digital ? 1 : 0);
  const [part, setPart] = useState<'game' | 'copies' | 'history'>('game');
  // A wish has nothing owned to note.
  const parts = held > 0 ? (['game', 'copies', 'history'] as const) : (['game', 'history'] as const);
  const showing = (parts as readonly string[]).includes(part) ? part : 'game';
  const partName = (p: (typeof parts)[number]) =>
    p === 'history'
      ? t('card.history')
      : p === 'copies'
        ? held > 1
          ? t('card.copies', { count: held })
          : t('card.copy')
        : t(owned ? 'copy.game' : 'copy.buying');

  const rows: ReactNode[] = [
    ...(owned
      ? [
          <FlagRow
            key="demo"
            label={t('game.demo')}
            value={!!game.demo}
            onChange={(demo) => onChange({ demo: demo || undefined })}
            disabled={disabled}
          />,
        ]
      : []),
  ];

  return (
    <section className="sheet-box">
      <div role="tablist" aria-label={game.title} className="card-tabs">
        {parts.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            id={`card-tab-${p}`}
            aria-selected={showing === p}
            aria-controls="card-panel"
            onClick={() => setPart(p)}
            className="card-tab"
          >
            {partName(p)}
          </button>
        ))}
      </div>

      <div id="card-panel" role="tabpanel" aria-labelledby={`card-tab-${showing}`}>
        {showing === 'history' ? (
          <GameHistory game={game} />
        ) : showing === 'game' ? (
          <Sheet rows={rows}>
            {owned && (
              <TextRow
                key={`review-${game.id}`}
                label={t('rating.review')}
                value={game.review}
                prompt={t('rating.addReview')}
                placeholder={t('rating.reviewPlaceholder')}
                onChange={(review) => onChange({ review })}
                disabled={disabled}
              />
            )}
            <TextRow
              key={`notes-${game.id}`}
              label={t('game.notes')}
              value={game.notes}
              prompt={t('copy.addNote')}
              placeholder={t('game.notesPlaceholder')}
              onChange={(notes) => onChange({ notes })}
              disabled={disabled}
            />
          </Sheet>
        ) : (
          <CopiesPanel game={game} onChange={onChange} disabled={disabled} />
        )}
      </div>
    </section>
  );
}

/** What of a game is owned: its cases and its download, tabs when there are several, every
    detail of the open one (a case's with its loan), and their own actions. */
function CopiesPanel({ game, onChange, disabled }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const { games, updateGame } = useStore();
  const toast = useToast();
  const known: Known = { locations: locationsOf(games), borrowers: borrowersOf(games) };
  const copies = copiesOf(game);
  // The download comes after the cases.
  const held = copies.length + (game.digital ? 1 : 0);
  const [tab, setTab] = useState(0);
  // A copy removed elsewhere, or by undo, can leave the open tab past the end.
  const open = Math.min(tab, held - 1);
  const onDigital = !!game.digital && open === copies.length;
  const copy = copies[open] ?? {};
  const [lending, setLending] = useState(false);

  const showCopy = (index: number) => {
    setTab(index);
    setLending(false);
  };

  const changeCopy = (index: number) => (patch: Partial<Copy>) =>
    onChange({ copies: storedCopies(copies.map((c, i) => (i === index ? { ...c, ...patch } : c))) });
  const change = changeCopy(open);

  // A case found ends the hunt for one.
  const addCopy = () => {
    onChange({ copies: withCopy(game).copies, wanted: undefined, orderedAt: undefined });
    showCopy(copies.length);
  };

  const addDigital = () => {
    onChange({ digital: true });
    showCopy(copies.length);
  };

  /** Moves a copy to the front, so its case is the one on the shelf. */
  const shelveCopy = (index: number) => {
    onChange({ copies: [copies[index], ...copies.filter((_, i) => i !== index)] });
    showCopy(0);
  };

  /** Takes off a case, or the download; something owned always stays. */
  const remove = async (index: number) => {
    const { digital: _digital, digitalPrice: _price, digitalCurrency: _currency, ...rest } = game;
    const changed = onDigital ? rest : { ...game, copies: storedCopies(copies.filter((_, i) => i !== index)) };
    showCopy(Math.max(0, index - 1));
    if (await updateGame(changed, { undoable: true })) toast({ kicker: t('toast.copyRemoved'), title: game.title, undoable: true });
  };

  // Who has the copy, as the last row; pressing it lends the copy or changes the loan.
  const loanRow = (
    <button key="loan" type="button" onClick={() => setLending(true)} disabled={disabled} className="sheet-row">
      <span className="sheet-row-label">{t('copy.lendDetail')}</span>
      <span className={`sheet-row-value ${copy.lentTo ? '' : 'sheet-row-empty'}`}>
        {copy.lentTo ? (
          <>
            <LoanIcon />
            <span className="nxe-label">{copy.lentTo}</span>
          </>
        ) : disabled ? (
          t('copy.unset')
        ) : (
          t('copy.lendPrompt')
        )}
      </span>
    </button>
  );

  // A download has no case to note, nor can it be lent or sold: only what it cost. With no
  // case beside it, one can be hunted for, which puts the game on the wishlist too.
  const digitalRows = [
    <PriceRow
      key={`price-${game.digitalPrice ?? ''}-${game.digitalCurrency ?? ''}`}
      price={game.digitalPrice}
      currency={game.digitalCurrency}
      onChange={(price) => onChange({ digitalPrice: price?.price, digitalCurrency: price?.currency })}
      disabled={disabled}
    />,
    ...(copies.length === 0
      ? [
          <FlagRow
            key="wanted"
            label={t('game.wanted')}
            value={!!game.wanted}
            onChange={(on) => onChange(on ? { wanted: true } : { wanted: undefined, orderedAt: undefined })}
            disabled={disabled}
          />,
        ]
      : []),
  ];

  const tabClass = (i: number) =>
    `flex h-8 items-center gap-1.5 rounded-md px-3.5 text-sm transition [&>svg]:size-3.5 ${
      i === open ? 'gloss-green font-semibold' : 'text-slate-600 hover:text-slate-900'
    }`;

  return (
    <div>
      {held > 1 && (
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label={t('copy.copies')} className="nxe-slot inline-flex max-w-full flex-wrap gap-0.5 p-0.5">
            {copies.map((c, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === open} onClick={() => showCopy(i)} className={tabClass(i)}>
                <span className="nxe-label">{t('copy.tab', { n: i + 1 })}</span>
                {c.steelbook && <GlintIcon />}
                {c.forSale && <TagIcon />}
                {c.lentTo && <LoanIcon />}
              </button>
            ))}
            {game.digital && (
              <button
                type="button"
                role="tab"
                aria-selected={onDigital}
                onClick={() => showCopy(copies.length)}
                className={tabClass(copies.length)}
              >
                <CloudIcon />
                <span className="nxe-label">{t('game.digitalVersion')}</span>
              </button>
            )}
          </div>
          {!disabled && (
            <button type="button" onClick={() => remove(open)} className="text-xs font-semibold text-slate-400 hover:text-rose-600">
              {t(onDigital ? 'copy.removeDigital' : 'copy.remove')}
            </button>
          )}
        </div>
      )}
      {/* The one thing owned, when it is the download, still says what it is. */}
      {held === 1 && onDigital && (
        <div className="mb-2.5 flex items-center gap-1.5 px-1 text-sm font-semibold text-slate-600 [&>svg]:size-3.5">
          <CloudIcon />
          <span className="nxe-label">{t('game.digitalVersion')}</span>
        </div>
      )}

      {/* Keyed by the copy, so its fields start over with the copy they show. */}
      <Sheet
        key={open}
        rows={onDigital ? digitalRows : [...COPY_DETAILS.map((d) => detailRow(d, copy, change, disabled, i18n, known)), loanRow]}
      >
        {lending && !onDigital && <LoanForm copy={copy} borrowers={known.borrowers} onChange={change} onDone={() => setLending(false)} />}
      </Sheet>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
        {!onDigital &&
          copies.length > 1 &&
          (open === 0 ? (
            <span className="text-xs text-slate-500">{t('copy.onShelf')}</span>
          ) : (
            !disabled && (
              <Button variant="link" onClick={() => shelveCopy(open)}>
                {t('copy.shelve')}
              </Button>
            )
          ))}
        {!disabled && (
          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
            <Button variant="link" onClick={addCopy}>
              {t('copy.addBox')}
            </Button>
            {/* Recorded only: downloads were last sold in 2024, when the store closed. */}
            {!game.digital && (
              <Button variant="link" onClick={addDigital}>
                {t('copy.addDigital')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** One white card of rows; an odd row out leaves its neighbour's cell empty rather than stretching. */
function Sheet({ rows, children }: { rows: ReactNode[]; children?: ReactNode }) {
  const shown = rows.filter(Boolean);
  return (
    <div className="sheet">
      {shown}
      {shown.length % 2 === 1 && <div className="sheet-filler" aria-hidden />}
      {children}
    </div>
  );
}

/** What the copy cost, as one field: the amount alone, or with the currency it was paid in
    for a game bought abroad ("20 €", "15 USD"). No currency is assumed. */
function PriceRow({
  price,
  currency,
  onChange,
  disabled,
}: {
  price?: number;
  currency?: string;
  onChange: (price: Pick<Copy, 'price' | 'currency'> | undefined) => void;
  disabled?: boolean;
}) {
  const { t, lang } = useI18n();
  const shown = price === undefined ? '' : formatPrice(price, currency, lang);
  const [text, setText] = useState(shown);
  const commit = () => {
    // Untouched, it stays as it was: "$" read back would say dollars of any country.
    if (text === shown) return;
    if (!text.trim()) return onChange(undefined);
    const typed = readPrice(text);
    // Something that is no amount goes back to what was there.
    if (!typed) return setText(shown);
    onChange(typed);
  };
  return (
    <label className="sheet-row">
      <span className="sheet-row-label">{t('copy.price')}</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        inputMode="decimal"
        disabled={disabled}
        placeholder={t('copy.unset')}
        className="sheet-row-input"
      />
    </label>
  );
}

/** The barcode on the back of the case. */
function EanRow({ value, onChange, disabled }: { value?: string; onChange: (ean: string | undefined) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const [ean, setEan] = useState(value ?? '');
  return (
    <label className="sheet-row">
      <span className="sheet-row-label">{t('copy.ean')}</span>
      <input
        value={ean}
        onChange={(e) => setEan(e.target.value.replace(/\D/g, '').slice(0, 14))}
        onBlur={() => ean !== (value ?? '') && onChange(ean || undefined)}
        inputMode="numeric"
        disabled={disabled}
        placeholder={t('copy.unset')}
        className="sheet-row-input"
      />
    </label>
  );
}
