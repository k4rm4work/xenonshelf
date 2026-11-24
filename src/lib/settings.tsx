import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LANGUAGES, languageFor, type Language } from './i18n/languages';

/** Light or dark panels, or whichever the system asks for. */
export type Theme = 'system' | 'light' | 'dark';

export const THEMES: Theme[] = ['system', 'light', 'dark'];

export type Settings = {
  language: Language;
  theme: Theme;
};

/** The browser's language when the app speaks it, English otherwise. */
const DEFAULTS: Settings = { language: languageFor(navigator.language), theme: 'system' };

const KEY = 'x360lib:settings';

// Interface settings are a per-browser convenience; storage may be unavailable.
function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    // Older versions also stored showLogo and showShortcuts switches; only known settings are kept.
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const language = parsed.language && LANGUAGES.includes(parsed.language) ? parsed.language : DEFAULTS.language;
    const theme = parsed.theme && THEMES.includes(parsed.theme) ? parsed.theme : DEFAULTS.theme;
    return { language, theme };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

type SettingsStore = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsStore>({ settings: DEFAULTS, update: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(loadSettings);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // Screen readers and the browser's spellcheck follow the page language.
  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  // The theme sits on <html> as data-theme="light" | "dark"; "system" follows the OS as it
  // changes. index.html sets it once before the first paint, so a dark page never flashes white.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (settings.theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
