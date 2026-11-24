import { useI18n } from '../lib/i18n';

/** Empties a search field. Stands in for the browser's own ×, which is hidden (index.css,
    "Search fields"): it is tiny, has no hand cursor, and Firefox has none at all. */
export function ClearSearch({ onClear, className = '' }: { onClear: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={(e) => {
        onClear();
        // Back to the field, to type the next search straight away.
        e.currentTarget.parentElement?.querySelector('input')?.focus();
      }}
      aria-label={t('search.clear')}
      data-tip={t('search.clear')}
      className={`search-clear ${className}`}
    >
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
