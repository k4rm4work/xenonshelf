import { useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { FORMAT_ICONS, PACK_ICONS, PRIORITY_ICONS, STATUS_ICONS } from '../components/choiceIcons';
import { CopyOptions, type CopyFields } from '../components/CopyOptions';
import { CopySheet, LoanNotice, PlayBar } from '../components/CopySheet';
import { CoverTile } from '../components/CoverTile';
import { DemoTag, DemoToggle, SteelbookToggle } from '../components/Demo';
import { CloseButton, Dialog } from '../components/Dialog';
import { Dropdown } from '../components/Dropdown';
import { GameBox } from '../components/GameBox';
import { GameFactList, GameSummary, GameSummarySkeleton } from '../components/GameFacts';
import { GameHistory } from '../components/GameHistory';
import { GameMarks } from '../components/GameMarks';
import { GameTile } from '../components/GameTile';
import * as Icons from '../components/icons';
import { RingMark } from '../components/RingMark';
import { Segmented } from '../components/Segmented';
import { IgdbForm, LoginForm, SETUP_STEPS, WizardSteps } from '../components/ServerSetup';
import { StarRating } from '../components/SheetRows';
import { Shortcut } from '../components/Shortcut';
import { SizeSlider } from '../components/SizeSlider';
import { StatsSummary } from '../components/StatsSummary';
import { TitleIndex } from '../components/TitleIndex';
import { Toolbar } from '../components/Toolbar';
import { ViewSwitch } from '../components/ViewSwitch';
import { filterOptions, libraryStats, type GameQuery } from '../lib/games';
import { LANGUAGES, useI18n, type Language } from '../lib/i18n';
import { THEMES, useSettings } from '../lib/settings';
import type { SetupStatus } from '../lib/setup';
import { useToast } from '../lib/toast';
import { PLAY_STATUSES, type Game, type PlayStatus } from '../types';
import type { Layout } from './LibraryPage';

// Development only (see App.tsx): every component on one page, fed with sample games that
// live in this page alone, so nothing here reaches the library.

const sample = (game: Partial<Game> & Pick<Game, 'id' | 'title'>): Game => ({
  list: 'owned',
  playStatus: 'unplayed',
  addedAt: '2026-11-01T00:00:00Z',
  ...game,
});

const GAMES: Game[] = [
  sample({
    id: 'halo3',
    title: 'Halo 3',
    coverImageId: 'co1xhc',
    releaseYear: 2007,
    genres: ['shooter'],
    series: ['Halo'],
    developers: ['Bungie'],
    publishers: ['Microsoft Game Studios'],
    summary: 'Master Chief returns to finish the fight against the Covenant and the Flood.',
    rating: 94,
    pegi: 16,
    coop: true,
    splitscreen: true,
    localPlayers: 4,
    hoursStory: 8,
    hoursComplete: 25,
    playStatus: 'completed',
    myRating: 9,
    tags: ['co-op', 'klasyk'],
    copies: [{ edition: 'limited', region: 'pal', condition: 'good', completeness: 'cib', location: 'Półka w salonie' }],
  }),
  sample({
    id: 'gow',
    title: 'Gears of War',
    coverImageId: 'co8rkr',
    releaseYear: 2006,
    genres: ['shooter'],
    playStatus: 'playing',
    copies: [{ steelbook: true }],
  }),
  sample({
    id: 'me',
    title: 'Mass Effect',
    coverImageId: 'co1x7o',
    releaseYear: 2007,
    genres: ['RPG'],
    copies: [{ lentTo: 'Kasia', lentAt: '2026-11-10' }],
  }),
  sample({
    id: 'bayo',
    title: 'Bayonetta',
    coverImageId: 'co8nf4',
    releaseYear: 2010,
    genres: ['Slasher'],
    playStatus: 'dropped',
    myRating: 5,
  }),
  sample({ id: 'wake', title: 'Alan Wake', coverImageId: 'co2dft', releaseYear: 2010, genres: ['Przygodowa'], digital: true, copies: [] }),
  sample({
    id: 'portal',
    title: 'Portal 2',
    coverImageId: 'co1rs4',
    releaseYear: 2011,
    genres: ['Platformowa'],
    digital: true,
    copies: [],
    wanted: true,
    demo: true,
  }),
  sample({ id: 'nocover', title: 'Gra bez okładki', releaseYear: 2009, copies: [{ pack: 2 }] }),
  sample({
    id: 'fable',
    title: 'Fable II',
    coverImageId: 'co1y2h',
    releaseYear: 2008,
    genres: ['RPG'],
    list: 'wishlist',
    priority: 'high',
  }),
  sample({
    id: 'rdr',
    title: 'Red Dead Redemption',
    coverImageId: 'co2lcv',
    releaseYear: 2010,
    list: 'wishlist',
    priority: 'low',
    orderedAt: '2026-11-20',
  }),
  sample({ id: 'bio', title: 'BioShock', coverImageId: 'co2mli', releaseYear: 2007, list: 'wishlist', priority: 'medium' }),
];

const SECTIONS = ['Buttons', 'Pickers', 'Toolbar', 'Shelf', 'Game card', 'Notices', 'Setup', 'Icons'] as const;

/** The server setup in each state it can be in. Saving from here reaches the dev server's own
    setup (data/config.json), never a library. */
const SETUP_STATES: Record<string, SetupStatus> = {
  'nothing set': { firstRun: true, igdb: 'none', login: 'none', updateCheck: true },
  'set in the app': { firstRun: false, igdb: 'app', login: 'app', user: 'kolekcjoner', updateCheck: false },
  'set in .env.local': { firstRun: false, igdb: 'env', login: 'env', user: 'kolekcjoner', updateCheck: true },
};

function Section({ title, children }: { title: (typeof SECTIONS)[number]; children: ReactNode }) {
  return (
    <section id={`ui-${title}`} className="gloss scroll-mt-6 rounded-3xl p-6 sm:p-8">
      <h2 className="mb-5 text-xl font-semibold text-slate-800">{title}</h2>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/** One component with its name above it. */
function Item({ name, children, wide }: { name: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'min-w-0' : 'min-w-0 sm:inline-block sm:pr-8 sm:align-top'}>
      <div className="mb-2 font-mono text-[11px] tracking-wide text-slate-500">{name}</div>
      {children}
    </div>
  );
}

const noop = () => {};

export default function UiPage() {
  // A phone preview is this page again in a frame: it has no frame of its own.
  const inFrame = new URLSearchParams(window.location.search).has('phone');
  const [phone, setPhone] = useState(false);
  const { settings, update } = useSettings();

  return (
    <div className="space-y-6">
      {!inFrame && (
        <nav className="nxe-tray sticky top-2 z-30 flex flex-wrap items-center gap-2 p-2">
          {SECTIONS.map((s) => (
            <a
              key={s}
              href={`#ui-${s}`}
              onClick={(e) => (e.preventDefault(), document.getElementById(`ui-${s}`)?.scrollIntoView({ behavior: 'smooth' }))}
              className="nxe-field flex h-8 items-center px-3 text-sm font-semibold text-slate-700"
            >
              {s}
            </a>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Segmented
              label="Theme"
              value={settings.theme}
              options={Object.fromEntries(THEMES.map((th) => [th, th])) as Record<(typeof THEMES)[number], string>}
              onChange={(theme) => update({ theme })}
            />
            <Segmented
              label="Language"
              value={settings.language}
              options={Object.fromEntries(LANGUAGES.map((l) => [l, l.toUpperCase()])) as Record<Language, string>}
              onChange={(language) => update({ language })}
            />
            <button
              type="button"
              onClick={() => setPhone((p) => !p)}
              className={`h-9 rounded-full px-4 text-sm font-semibold ${phone ? 'gloss-green' : 'nxe-field text-slate-700'}`}
            >
              Phone 390
            </button>
          </div>
        </nav>
      )}
      <div className={phone ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_414px]' : ''}>
        <Gallery />
        {phone && (
          <iframe
            title="Phone"
            src={`${window.location.pathname}?phone#/ui`}
            className="sticky top-20 h-[calc(100vh-7rem)] w-[414px] max-w-full rounded-3xl border-[12px] border-slate-900 bg-black shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}

function Gallery() {
  const { t, labels } = useI18n();
  const statusLabels = labels('status', PLAY_STATUSES);
  const toast = useToast();
  const [status, setStatus] = useState<PlayStatus>('playing');
  const [filter, setFilter] = useState('all');
  const [grid, setGrid] = useState('all');
  const [layout, setLayout] = useState<Layout>('cases');
  const [size, setSize] = useState(170);
  const [rating, setRating] = useState<number | undefined>(7);
  const [flags, setFlags] = useState({ demo: true, steel: false, check: true });
  const [copy, setCopy] = useState<CopyFields>({});
  const [card, setCard] = useState<Game>(GAMES[0]);
  const [dialog, setDialog] = useState(false);
  const owned = GAMES.filter((g) => g.list === 'owned');
  const [query, setQuery] = useState<GameQuery>({ list: 'owned', sort: 'title', direction: 'asc' });
  const statusOptions = PLAY_STATUSES.map((s) => ({ value: s, label: statusLabels[s], icon: STATUS_ICONS[s] }));

  return (
    <div className="min-w-0 space-y-6">
      <Section title="Buttons">
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <Item key={size} name={`Button size="${size}"`}>
            <div className="flex flex-wrap items-center gap-3">
              <Button size={size}>{t('import.submit', { games: 3 })}</Button>
              <Button size={size} variant="secondary">
                <Icons.TruckIcon />
                {t('game.markOrdered')}
              </Button>
              <Button size={size} variant="quiet">
                {t('copy.cancel')}
              </Button>
              <Button size={size} disabled>
                disabled
              </Button>
            </div>
          </Item>
        ))}
        <Item name='Button variant="link" / "back"'>
          <div className="flex flex-wrap items-center gap-5">
            <Button variant="link">{t('copy.addBox')}</Button>
            <Button variant="back">{t('import.back')}</Button>
          </div>
        </Item>
        <Item name="Toolbar key, icon buttons">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="gloss-green flex h-10 items-center gap-2.5 rounded-lg px-4 text-sm font-semibold sm:has-[kbd]:pr-2"
            >
              {t('toolbar.add')}
              <Shortcut keyName="N" />
            </button>
            <button type="button" className="nxe-field grid size-10 place-items-center rounded-full! text-slate-500 [&>svg]:size-5">
              <Icons.FilterIcon />
            </button>
            <CloseButton />
          </div>
        </Item>
        <Item name="Shortcut">
          <div className="flex gap-2">
            {['/', 'N', 'esc', '←', '→'].map((k) => (
              <Shortcut key={k} keyName={k} />
            ))}
          </div>
        </Item>
        <Item name=".nxe-input">
          <input className="nxe-input w-64" placeholder={t('copy.location')} />
        </Item>
        <Item name=".nxe-check">
          <input
            type="checkbox"
            className="nxe-check"
            checked={flags.check}
            onChange={(e) => setFlags((f) => ({ ...f, check: e.target.checked }))}
            aria-label="check"
          />
        </Item>
        <Item name="Dialog">
          <Button onClick={() => setDialog(true)}>Open</Button>
          {dialog && (
            <Dialog label="Dialog" onClose={() => setDialog(false)}>
              <div className="gloss relative rounded-3xl p-6 sm:p-9">
                <CloseButton className="absolute top-4 right-4" />
                <GameSummary game={GAMES[0]} />
              </div>
            </Dialog>
          )}
        </Item>
      </Section>

      <Section title="Pickers">
        <Item name="Segmented">
          <Segmented label="status" value={status} options={statusLabels} icons={STATUS_ICONS} onChange={setStatus} />
        </Item>
        <Item name="Dropdown (filter)">
          <Dropdown
            label={t('toolbar.status')}
            value={filter}
            neutral="all"
            options={[{ value: 'all', label: t('toolbar.all') }, ...statusOptions]}
            onChange={setFilter}
          />
        </Item>
        <Item name="Dropdown columns">
          <Dropdown
            label={t('toolbar.year')}
            value={grid}
            neutral="all"
            columns={3}
            options={[
              { value: 'all', label: t('toolbar.all') },
              ...['2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013'].map((y) => ({ value: y, label: y })),
            ]}
            onChange={setGrid}
          />
        </Item>
        <Item name="Dropdown chip">
          <Dropdown chip label="status" value={status} options={statusOptions} onChange={setStatus} />
        </Item>
        <Item name="Dropdown block" wide>
          <div className="w-72">
            <Dropdown
              block
              label="match"
              value={grid}
              options={[
                { value: 'all', label: 'The Witcher 2: Assassins of Kings - Enhanced Edition (2012)' },
                { value: '2010', label: 'Kameo: Elements of Power' },
              ]}
              onChange={setGrid}
            />
          </div>
        </Item>
        <Item name="ViewSwitch">
          <ViewSwitch
            label="layout"
            value={layout}
            options={[
              { value: 'cases', label: t('layout.cases'), icon: <Icons.CasesIcon /> },
              { value: 'covers', label: t('layout.covers'), icon: <Icons.CoversIcon /> },
              { value: 'list', label: t('layout.list'), icon: <Icons.ListIcon /> },
            ]}
            onChange={setLayout}
          />
        </Item>
        <Item name="SizeSlider">
          <SizeSlider value={size} onChange={setSize} />
        </Item>
        <Item name="StarRating">
          <StarRating value={rating} onChange={setRating} />
        </Item>
        <Item name="DemoToggle / SteelbookToggle">
          <div className="flex gap-2">
            <DemoToggle value={flags.demo} onChange={(demo) => setFlags((f) => ({ ...f, demo }))} />
            <SteelbookToggle value={flags.steel} onChange={(steel) => setFlags((f) => ({ ...f, steel }))} />
          </div>
        </Item>
        <Item name="CopyOptions" wide>
          <CopyOptions list="owned" value={copy} onChange={(patch) => setCopy((c) => ({ ...c, ...patch }))} />
        </Item>
      </Section>

      <Section title="Toolbar">
        <Item name="Toolbar" wide>
          <Toolbar
            query={query}
            onChange={setQuery}
            {...filterOptions(GAMES, 'owned')}
            tileSize={size}
            onTileSize={setSize}
            layout={layout}
            onLayout={setLayout}
            count={owned.length}
            total={owned.length}
            stats={libraryStats(GAMES)}
            onAdd={noop}
          />
        </Item>
        <Item name="StatsSummary" wide>
          <StatsSummary total={owned.length} stats={libraryStats(GAMES)} query={query} onPick={noop} />
        </Item>
      </Section>

      <Section title="Shelf">
        <Item name="GameBox: retail, SteelBook, digital, demo, pack, no cover" wide>
          <div className="ui-shelf flex flex-wrap items-end gap-6">
            {[GAMES[0], GAMES[1], GAMES[4], GAMES[5], GAMES[6]].map((g) => (
              <div key={g.id} className="w-32">
                <GameBox game={g} />
              </div>
            ))}
            <div className="w-32">
              <GameBox game={GAMES[0]} flat />
            </div>
          </div>
        </Item>
        <Item name="GameTile" wide>
          <div className="ui-shelf grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-8 gap-y-10">
            {GAMES.map((g, i) => (
              <GameTile key={g.id} game={g} index={i} onOpen={noop} />
            ))}
          </div>
        </Item>
        <Item name="CoverTile" wide>
          <div className="ui-shelf grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-x-4 gap-y-7">
            {GAMES.map((g, i) => (
              <CoverTile key={g.id} game={g} index={i} onOpen={noop} />
            ))}
          </div>
        </Item>
        <Item name="GameMarks">
          <div className="flex flex-col gap-2">
            {GAMES.map((g) => (
              <div key={g.id} className="flex items-center gap-2 text-sm">
                <GameMarks game={g} />
                <span className="text-slate-600">{g.title}</span>
              </div>
            ))}
          </div>
        </Item>
        <Item name="TitleIndex" wide>
          <TitleIndex games={GAMES} grouped onOpen={noop} />
        </Item>
      </Section>

      <Section title="Game card">
        <Item name="GameSummary" wide>
          <GameSummary game={card} />
        </Item>
        <Item name="GameSummarySkeleton" wide>
          <GameSummarySkeleton label="…" />
        </Item>
        <Item name="PlayBar" wide>
          <PlayBar game={card} onChange={(patch) => setCard((g) => ({ ...g, ...patch }))} />
        </Item>
        <Item name="LoanNotice" wide>
          <LoanNotice game={GAMES[2]} onChange={noop} />
        </Item>
        <Item name="CopySheet" wide>
          <CopySheet game={card} onChange={(patch) => setCard((g) => ({ ...g, ...patch }))} />
        </Item>
        <Item name="GameHistory" wide>
          <GameHistory
            game={{
              list: 'owned',
              addedAt: '2026-09-02T18:20:00.000Z',
              history: [
                { kind: 'added', list: 'wishlist', at: '2026-09-02T18:20:00.000Z' },
                { kind: 'ordered', at: '2026-10-14T20:05:00.000Z' },
                { kind: 'moved', list: 'owned', at: '2026-10-18T11:40:00.000Z' },
                { kind: 'status', from: 'unplayed', to: 'playing', at: '2026-10-19T19:00:00.000Z' },
                { kind: 'tagged', tag: 'co-op', at: '2026-10-19T19:02:00.000Z' },
                { kind: 'status', from: 'playing', to: 'completed', at: '2026-11-08T22:15:00.000Z' },
                { kind: 'rating', to: 9, at: '2026-11-08T22:16:00.000Z' },
                { kind: 'reviewed', at: '2026-11-08T22:20:00.000Z' },
                { kind: 'copyAdded', count: 1, at: '2026-11-15T12:00:00.000Z' },
                { kind: 'lent', who: 'Kasia', at: '2026-11-20T17:30:00.000Z' },
                { kind: 'edited', field: 'edition', to: 'limited', copy: 2, at: '2026-11-21T10:00:00.000Z' },
                { kind: 'edited', field: 'location', to: 'Półka w salonie', copy: 1, at: '2026-11-21T10:01:00.000Z' },
                { kind: 'edited', field: 'notes', at: '2026-11-22T09:30:00.000Z' },
                { kind: 'edited', field: 'priority', at: '2026-11-22T09:40:00.000Z' },
              ],
            }}
          />
        </Item>
        <Item name="GameFactList" wide>
          <GameFactList game={card} />
        </Item>
      </Section>

      <Section title="Notices">
        <Item name=".app-alert" wide>
          <div role="alert" className="app-alert gloss">
            <RingMark fault className="app-alert-ring" />
            <span className="min-w-0 flex-1">{t('error.conflict', { message: '' })}</span>
            <Button size="sm" className="flex-none">
              {t('error.reload')}
            </Button>
          </div>
        </Item>
        <Item name=".notice / .notice-sky / .notice-green" wide>
          <div className="space-y-3">
            <div className="notice">
              <Icons.LoanIcon />
              <span className="flex-1">Mass Effect — Kasia</span>
              <button type="button" className="notice-action">
                {t('setup.change')}
              </button>
              <button type="button" className="notice-action notice-action-primary">
                {t('copy.returned')}
              </button>
            </div>
            <div className="notice notice-sky">
              <Icons.TruckIcon />
              Red Dead Redemption — 2026-11-20
            </div>
            <div className="notice notice-green">
              <Icons.CompletedIcon />
              {t('setup.igdbOn')}
            </div>
          </div>
        </Item>
        <Item name="Toast">
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={() => toast({ kicker: t('toast.addedOwned'), title: 'Halo 3' })}>
              toast
            </Button>
          </div>
        </Item>
        <Item name="DemoTag / RingMark">
          <div className="flex items-center gap-4">
            <DemoTag />
            <RingMark className="size-10" />
            <RingMark fault className="size-10" />
          </div>
        </Item>
      </Section>

      <Section title="Setup">
        {SETUP_STEPS.map((step, i) => (
          <Item key={step} name={`SetupWizard: ${step}`} wide>
            <div className="max-w-4xl">
              <WizardSteps status={SETUP_STATES['nothing set']} onChange={noop} start={i} />
            </div>
          </Item>
        ))}
        {Object.entries(SETUP_STATES).map(([state, status]) => (
          <Item key={state} name={`IgdbForm / LoginForm: ${state}`} wide>
            <div className="max-w-4xl">
              <IgdbForm status={status} onChange={noop} />
              <LoginForm status={status} onChange={noop} />
            </div>
          </Item>
        ))}
      </Section>

      <Section title="Icons">
        <Item name="icons.tsx" wide>
          <IconGrid icons={Object.entries(Icons).map(([name, Icon]) => [name.replace(/Icon$/, ''), <Icon />])} />
        </Item>
        <Item name="choiceIcons.tsx" wide>
          <IconGrid icons={[STATUS_ICONS, PRIORITY_ICONS, FORMAT_ICONS, PACK_ICONS].flatMap((map) => Object.entries(map))} />
        </Item>
      </Section>
    </div>
  );
}

function IconGrid({ icons }: { icons: [string, ReactNode][] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
      {icons.map(([name, icon], i) => (
        <div key={`${name}-${i}`} className="nxe-slot flex flex-col items-center gap-2 p-3 text-slate-700 [&>svg]:size-6">
          {icon}
          <span className="max-w-full truncate text-[11px] text-slate-500">{name}</span>
        </div>
      ))}
    </div>
  );
}
