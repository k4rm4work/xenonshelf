import { lazy, Suspense, useMemo, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Backdrop } from './components/Backdrop';
import { Button } from './components/Button';
import { ChannelNav } from './components/ChannelNav';
import { RingMark } from './components/RingMark';
import { ServerSettingsDialog, SetupWizard } from './components/ServerSetup';
import { SettingsMenu } from './components/SettingsMenu';
import { Tooltips } from './components/Tooltips';
import { libraryStats } from './lib/games';
import { useI18n } from './lib/i18n';
import { SettingsProvider } from './lib/settings';
import { changeSetup, useSetupStatus } from './lib/setup';
import { StoreProvider, useStore } from './lib/store';
import { ToastProvider } from './lib/toast';
import { loadWallpaper, saveWallpaper, wallpaperById } from './lib/wallpapers';
import { LibraryPage } from './pages/LibraryPage';

// Every component on one page at #/ui, while developing only: a build leaves it out.
const UiPage = import.meta.env.DEV ? lazy(() => import('./pages/UiPage')) : undefined;

export function App() {
  return (
    <StoreProvider>
      <SettingsProvider>
        <ToastProvider>
          <HashRouter>
            <Shell />
          </HashRouter>
          <Tooltips />
        </ToastProvider>
      </SettingsProvider>
    </StoreProvider>
  );
}

function Shell() {
  const { error, games, loading } = useStore();
  const { t } = useI18n();
  const stats = useMemo(() => libraryStats(games), [games]);
  const [wallpaper, setWallpaper] = useState(loadWallpaper);
  // Hovered thumbnail in the picker, shown behind the page until the pointer leaves.
  const [preview, setPreview] = useState<string>();
  // The server's own settings: a guide on a fresh server, then a row in the settings panel.
  const [setup, setSetup] = useSetupStatus();
  const [serverOpen, setServerOpen] = useState(false);
  // Once open, the guide stays until it is closed, though its steps mark the setup done.
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideShown, setGuideShown] = useState(false);
  if (setup?.firstRun && !guideShown) {
    setGuideShown(true);
    setGuideOpen(true);
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-28 sm:px-8">
      <Backdrop wallpaper={wallpaperById(preview ?? wallpaper)} />
      {/* Indented like the shelf below, whose cases stand in from the toolbar's edge. */}
      <header className="flex items-end gap-6 px-3 pt-6 pb-7">
        <ChannelNav
          channels={[
            { to: '/', label: t('list.owned'), count: loading ? undefined : stats.owned },
            { to: '/wishlist', label: t('list.wishlist'), count: loading ? undefined : stats.wishlist },
          ]}
        />
        <div className="mb-1 ml-auto flex items-center gap-2">
          <SettingsMenu
            onServer={setup && (() => setServerOpen(true))}
            wallpaper={wallpaper}
            onPreview={setPreview}
            onWallpaper={(id) => {
              setWallpaper(id);
              saveWallpaper(id);
            }}
          />
        </div>
      </header>

      {error && (
        <div role="alert" className="app-alert gloss mb-6">
          <RingMark fault className="app-alert-ring" />
          <span className="min-w-0 flex-1">
            {error.action === 'conflict'
              ? t('error.conflict', { message: '' })
              : t(`error.${error.action}`, { message: t(`apiError.${error.reason}`) })}
          </span>
          {error.action === 'conflict' && (
            <Button size="sm" onClick={() => window.location.reload()} className="flex-none">
              {t('error.reload')}
            </Button>
          )}
        </div>
      )}

      {setup && guideOpen && (
        <SetupWizard
          status={setup}
          onChange={setSetup}
          onClose={() => {
            setGuideOpen(false);
            if (setup.firstRun) changeSetup('POST', 'done').then((r) => 'status' in r && setSetup(r.status));
          }}
        />
      )}
      {setup && serverOpen && <ServerSettingsDialog status={setup} onChange={setSetup} onClose={() => setServerOpen(false)} />}

      <main>
        <Routes>
          <Route path="/" element={<LibraryPage key="owned" list="owned" />} />
          <Route path="/wishlist" element={<LibraryPage key="wishlist" list="wishlist" />} />
          {UiPage && (
            <Route
              path="/ui"
              element={
                <Suspense>
                  <UiPage />
                </Suspense>
              }
            />
          )}
        </Routes>
      </main>
    </div>
  );
}
