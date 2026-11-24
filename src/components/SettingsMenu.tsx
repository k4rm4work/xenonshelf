import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { LANGUAGE_OPTIONS, useI18n } from '../lib/i18n';
import { THEMES, useSettings } from '../lib/settings';
import { APP_AUTHOR, APP_NAME, BUILD, feedbackUrl } from '../lib/version';
import { WALLPAPERS, type Wallpaper } from '../lib/wallpapers';
import { Brand } from './Brand';
import { DataSettings } from './DataSettings';
import { Dropdown } from './Dropdown';
import { Segmented } from './Segmented';

type Props = {
  /** Opens the server's setup; absent where there is no server to set up. */
  onServer?: () => void;
  wallpaper: string | undefined;
  onWallpaper: (id: string) => void;
  /** Shows a wallpaper behind the page while it is hovered or focused; undefined restores. */
  onPreview: (id: string | undefined) => void;
};

const COLUMNS = 4;

/** Header button opening the settings panel: one row per setting, so the panel stays short
    as settings are added. The wallpaper row opens its own page of thumbnails, each
    previewed live behind the page. */
export function SettingsMenu({ onServer, wallpaper, onWallpaper, onPreview }: Props) {
  const { settings, update } = useSettings();
  const { t, has, rich, date, labels } = useI18n();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<'main' | 'wallpaper'>('main');
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number>();

  // The panel stops short of the bottom of the screen and scrolls inside; where it starts
  // depends on how far the page is scrolled, so measure it each time it opens.
  useLayoutEffect(() => {
    if (!open) return;
    const fit = () => {
      const top = panelRef.current?.getBoundingClientRect().top ?? 0;
      setPanelHeight(Math.max(240, window.innerHeight - top - 16));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open]);
  const gridRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPage('main');
    onPreview(undefined);
  }, [onPreview]);

  const back = () => {
    setPage('main');
    onPreview(undefined);
  };

  const focusButton = () => ref.current?.querySelector<HTMLElement>('.settings-button')?.focus();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  // The wallpaper page starts keyboard navigation on the current wallpaper; coming back
  // lands on the row that led to it. Opening the panel moves focus nowhere.
  const visited = useRef(false);
  useEffect(() => {
    if (!open) return void (visited.current = false);
    if (page === 'wallpaper') {
      visited.current = true;
      const grid = gridRef.current;
      (grid?.querySelector<HTMLElement>('[aria-checked="true"]') ?? grid?.querySelector<HTMLElement>('[role="radio"]'))?.focus();
    } else if (visited.current) panelRef.current?.querySelector<HTMLElement>('.sheet-row')?.focus();
  }, [open, page]);

  const groups = WALLPAPERS.reduce<Map<string, Wallpaper[]>>((map, w) => {
    map.set(w.group, [...(map.get(w.group) ?? []), w]);
    return map;
  }, new Map());
  const current = WALLPAPERS.find((w) => w.id === wallpaper);
  // Known groups have a name; others show their file prefix capitalised.
  const groupLabel = (group: string) => {
    const key = `settings.group.${group || 'other'}`;
    return has(key) ? t(key) : group[0].toUpperCase() + group.slice(1);
  };
  // Bundled wallpapers are named in both languages; added ones keep their file name.
  const wallpaperName = (w: Wallpaper) => {
    const key = `wallpaper.${w.id.replace(/\.[^.]+$/, '')}`;
    return has(key) ? t(key) : w.name;
  };

  // Escape steps back from the wallpaper page, and from the main page closes the panel,
  // restoring the wallpaper either way.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (page === 'wallpaper') return back();
    close();
    focusButton();
  };

  // Arrow keys walk the thumbnails as one grid.
  const onGridKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }[e.key];
    if (!step) return;
    const items = [...(gridRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = items[Math.min(items.length - 1, Math.max(0, i + step))];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div ref={ref} className="relative" onKeyDown={open ? onKeyDown : undefined}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`settings-button ${open ? 'settings-button-open' : ''}`}
        data-tip={open ? undefined : t('settings.title')}
        aria-label={t('settings.title')}
      >
        <Brand />
      </button>

      {open && (
        <div
          role="dialog"
          ref={panelRef}
          aria-label={t('settings.title')}
          className="nxe-menu nxe-menu-right settings-panel nxe-scroll absolute top-full right-0 z-[62] mt-2"
          style={{ maxHeight: panelHeight }}
          onMouseLeave={() => onPreview(undefined)}
        >
          {page === 'main' ? (
            <div className="settings-page">
              <h3 className="filter-group-label">{t('settings.appearance')}</h3>
              <div className="sheet">
                <button type="button" onClick={() => setPage('wallpaper')} className="sheet-row">
                  <span className="sheet-row-label">{t('settings.wallpaper')}</span>
                  <span className="sheet-row-value">
                    {current && (
                      <span className="settings-row-thumb">
                        <span className="wallpaper-thumb-art" style={{ background: current.background }} />
                      </span>
                    )}
                    <span>{current ? wallpaperName(current) : t('copy.unset')}</span>
                  </span>
                  <svg viewBox="0 0 12 12" className="sheet-row-chevron" aria-hidden>
                    <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
                <div className="sheet-row">
                  <span className="sheet-row-label">{t('settings.theme')}</span>
                  <span className="ml-auto">
                    <Segmented
                      label={t('settings.theme')}
                      value={settings.theme}
                      options={labels('theme', THEMES)}
                      onChange={(theme) => update({ theme })}
                    />
                  </span>
                </div>
                <Dropdown
                  row
                  label={t('settings.language')}
                  value={settings.language}
                  options={LANGUAGE_OPTIONS}
                  onChange={(language) => update({ language })}
                />
              </div>
              <DataSettings />
              {onServer && (
                <>
                  <h3 className="filter-group-label mt-3">{t('settings.server')}</h3>
                  <div className="sheet">
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onServer();
                      }}
                      className="sheet-row"
                    >
                      <span className="sheet-row-label">{t('settings.serverRow')}</span>
                      <span className="sheet-row-value">{t('settings.serverOpen')}</span>
                      <svg viewBox="0 0 12 12" className="sheet-row-chevron" aria-hidden>
                        <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
              <h3 className="filter-group-label mt-3">{t('settings.feedback')}</h3>
              <div className="sheet">
                {(['bug_report', 'idea'] as const).map((template) => (
                  <a key={template} href={feedbackUrl(template)} target="_blank" rel="noreferrer" className="sheet-row">
                    <span className="sheet-row-label">{t(template === 'idea' ? 'settings.feedbackIdea' : 'settings.feedbackBug')}</span>
                    <span className="sheet-row-value">{t('settings.feedbackOpen')}</span>
                    <svg viewBox="0 0 12 12" className="sheet-row-chevron" aria-hidden>
                      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </a>
                ))}
              </div>
              <p className="data-hint">{t('settings.feedbackHint')}</p>
            </div>
          ) : (
            <div className="settings-page settings-page-sub">
              <div className="flex items-center justify-between gap-4 pb-3">
                <button type="button" onClick={back} className="settings-back">
                  <svg viewBox="0 0 12 12" aria-hidden>
                    <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <span className="settings-heading">{t('settings.wallpaper')}</span>
                </button>
                {current && (
                  <span className="truncate text-xs text-slate-500">
                    {groupLabel(current.group)} · <b className="font-semibold text-slate-700">{wallpaperName(current)}</b>
                  </span>
                )}
              </div>
              <div
                ref={gridRef}
                role="radiogroup"
                aria-label={t('settings.wallpaper')}
                className="wallpaper-scroll"
                onKeyDown={onGridKeyDown}
              >
                {[...groups].map(([group, items]) => (
                  <section key={group} className="wallpaper-group">
                    <h3 className="wallpaper-group-label">{groupLabel(group)}</h3>
                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}>
                      {items.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          role="radio"
                          aria-checked={w.id === wallpaper}
                          tabIndex={w.id === wallpaper ? 0 : -1}
                          onClick={() => {
                            onWallpaper(w.id);
                            close();
                            focusButton();
                          }}
                          onMouseEnter={() => onPreview(w.id)}
                          onFocus={() => onPreview(w.id)}
                          className="wallpaper-option"
                        >
                          {/* The thumb is a size container, so a drawn wallpaper scales into it whole. */}
                          <span className="wallpaper-thumb">
                            <span className="wallpaper-thumb-art" style={{ background: w.background }} />
                          </span>
                          <span className="wallpaper-name">{wallpaperName(w)}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}

          <div className="settings-about">
            <span>
              <b>{APP_NAME}</b> {BUILD.version}
            </span>
            {BUILD.commit && <code>{BUILD.commit}</code>}
            <span className="ml-auto">{t('settings.build', { date: date(BUILD.builtAt) })}</span>
          </div>
          <p className="settings-credit">
            {rich('settings.author', {
              author: (
                <>
                  <b>{APP_AUTHOR}</b>
                  {/* Made in Poland: a tiny flag drawn inline, white over red. */}
                  <svg viewBox="0 0 16 10" className="settings-flag" role="img" aria-label="Polska">
                    <rect width="16" height="5" fill="#fff" />
                    <rect y="5" width="16" height="5" fill="#dc143c" />
                  </svg>
                </>
              ),
            })}
          </p>
        </div>
      )}
    </div>
  );
}
