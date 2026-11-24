// The languages the app speaks, the most widely spoken first, as the picker lists them. Kept
// apart from the messages so the settings can read them without importing the translations
// (which themselves read the settings).
export const LANGUAGES = ['en', 'es', 'pt-BR', 'fr', 'de', 'pl'] as const;

export type Language = (typeof LANGUAGES)[number];

/** Each language under its own name, as the picker shows it. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
  fr: 'Français',
  de: 'Deutsch',
  pl: 'Polski',
};

/** The languages as picker options, in the order above. */
export const LANGUAGE_OPTIONS = LANGUAGES.map((value) => ({ value, label: LANGUAGE_NAMES[value] }));

/** The browser's language when there is one for it, English otherwise. Portuguese of any
    country gets the Brazilian one, the only one there is. */
export function languageFor(locale: string | undefined): Language {
  const code = locale?.toLowerCase().split('-')[0];
  if (code === 'pt') return 'pt-BR';
  return LANGUAGES.find((lang) => lang === code) ?? 'en';
}
