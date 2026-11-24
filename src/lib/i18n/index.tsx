import { Fragment, useMemo, type ReactNode } from 'react';
import { useSettings } from '../settings';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import type { Language } from './languages';
import { pl } from './pl';
import { ptBR } from './pt-BR';

/** Every interface string, by key; Polish is the reference (see pl.ts). */
export type MessageKey = keyof typeof pl;

export const MESSAGES: Record<Language, Record<MessageKey, string>> = { pl, en, de, es, fr, 'pt-BR': ptBR };

export { LANGUAGE_NAMES, LANGUAGE_OPTIONS, LANGUAGES, languageFor, type Language } from './languages';

/** A message as every language words it, e.g. to read "Kolekcja" or "Collection" in an import. */
export const inEveryLanguage = (key: MessageKey) => Object.values(MESSAGES).map((messages) => messages[key]);

type Vars = Record<string, string | number>;

function makeI18n(lang: Language) {
  const messages = MESSAGES[lang];

  const t = (key: MessageKey, vars?: Vars) =>
    vars ? messages[key].replace(/\{(\w+)\}/g, (m, name: string) => String(vars[name] ?? m)) : messages[key];

  /** Like t, but the placeholders take elements, e.g. a bold count. */
  const rich = (key: MessageKey, vars: Record<string, ReactNode>) =>
    messages[key].split(/(\{\w+\})/).map((part, i) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      return <Fragment key={i}>{name && name in vars ? vars[name] : part}</Fragment>;
    });

  return {
    lang,
    t,
    rich,
    /** For keys built at runtime that may have no entry, e.g. a pack size without its own name. */
    has: (key: string): key is MessageKey => key in messages,
    /** Labels for a set of choices whose keys share a prefix, e.g. "status.playing". */
    labels: <T extends string>(prefix: string, values: readonly T[]) =>
      Object.fromEntries(values.map((v) => [v, t(`${prefix}.${v}` as MessageKey)])) as Record<T, string>,
    /** Display name of a stored genre; names IGDB gave us untranslated pass through. */
    genre: (name: string) => {
      const key = `genre.${name}`;
      return key in messages ? messages[key as MessageKey] : name;
    },
    /** "22 listopada 2026" / "November 22, 2026". */
    date: (iso: string) => new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }),
    /** The dashboard's lower-case labels; German keeps its capitals, which nouns can't do without. */
    lower: (text: string) => (lang === 'de' ? text : text.toLocaleLowerCase(lang)),
    /** "1 gra", "3 gry", "116 gier": the form of `prefix.one/few/many/other` the language asks for. */
    plural: (prefix: string, count: number) => t(`${prefix}.${new Intl.PluralRules(lang).select(count)}` as MessageKey, { count }),
  };
}

export type I18n = ReturnType<typeof makeI18n>;

export function useI18n(): I18n {
  const { settings } = useSettings();
  return useMemo(() => makeI18n(settings.language), [settings.language]);
}
