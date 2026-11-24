import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cleanTag, withTag } from '../lib/games';
import { useI18n } from '../lib/i18n';
import type { Copy } from '../types';
import { Button } from './Button';
import { Dropdown } from './Dropdown';
import { CalendarIcon, TagIcon } from './icons';
import { useSuggestions } from './Suggestions';

// Rows of the game card for what the player notes themselves: a score, a few words, tags,
// and where each copy is and who has it. Each saves when it is left, like the barcode.

/** Today as YYYY-MM-DD in the player's time zone. */
const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

/** A day stored as YYYY-MM-DD, read at noon so no time zone moves it to the day before. */
export const dayIso = (day: string) => `${day}T12:00:00`;

/** Stars as people write them: "4,5" in Polish, "4.5" in English. */
export const starsText = (halves: number, lang: string) => (halves / 2).toLocaleString(lang);

function StarShape({ fill }: { fill: number }) {
  // Points and inner corners rounded off, like the soft stars of the dashboard's ratings.
  const path =
    'M9.59 3.69Q10 2.7 10.41 3.69L11.7 6.87Q12.03 7.66 12.88 7.72L16.3 7.98Q17.37 8.06 16.55 8.75L13.94 10.96Q13.28 11.52 13.49 12.35L14.3 15.68Q14.56 16.72 13.64 16.16L10.73 14.35Q10 13.9 9.27 14.35L6.36 16.16Q5.44 16.72 5.7 15.68L6.51 12.35Q6.72 11.52 6.06 10.96L3.45 8.75Q2.63 8.06 3.7 7.98L7.12 7.72Q7.97 7.66 8.3 6.87Z';
  return (
    <span className="star">
      <svg viewBox="0 0 20 20" aria-hidden>
        <path d={path} />
      </svg>
      <span className="star-fill" style={{ width: `${fill * 100}%` }}>
        <svg viewBox="0 0 20 20" aria-hidden>
          <path d={path} />
        </svg>
      </span>
    </span>
  );
}

/** Five stars taking halves: the left half of a star gives half of it. Sliding a finger or
    the pointer along them sets the score as it goes, saved on letting go; pressing the
    score already given takes it away. Arrow keys move by half a star. */
export function StarRating({
  value,
  onChange,
  disabled,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
}) {
  const { t, lang } = useI18n();
  const [hover, setHover] = useState<number>();
  // The score under a press being slid along the stars, and whether it has moved off
  // where it began (a press that stays put is a tap).
  const [drag, setDrag] = useState<{ halves: number; moved: boolean }>();
  const shown = drag?.halves ?? hover ?? value ?? 0;

  const halvesAt = (e: PointerEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - box.left, 0), box.width - 1);
    return Math.floor((x / box.width) * 10) + 1;
  };
  const pick = (halves: number) => onChange(halves === value ? undefined : halves);
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    // Keeps the moves coming when the finger slides past the last star.
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ halves: halvesAt(e), moved: false });
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (drag) {
      const halves = halvesAt(e);
      if (halves !== drag.halves) setDrag({ halves, moved: true });
    } else if (e.pointerType === 'mouse') setHover(halvesAt(e));
  };
  const onPointerUp = () => {
    if (!drag) return;
    setDrag(undefined);
    if (drag.moved) onChange(drag.halves);
    else pick(drag.halves);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (step) onChange(Math.min(10, Math.max(1, (value ?? 0) + step)));
    else if (e.key === 'Home' || e.key === 'Delete' || e.key === 'Backspace') onChange(undefined);
    else if (e.key === 'End') onChange(10);
    else return;
    e.preventDefault();
  };

  return (
    <span
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={t('rating.stars')}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-valuenow={value ?? 0}
      aria-valuetext={value ? t('rating.value', { stars: starsText(value, lang) }) : t('copy.unset')}
      aria-disabled={disabled}
      className={`star-rating ${hover !== undefined || drag ? 'star-rating-hover' : ''}`}
      onPointerDown={disabled ? undefined : onPointerDown}
      onPointerMove={disabled ? undefined : onPointerMove}
      onPointerUp={disabled ? undefined : onPointerUp}
      // A finger that turns to scroll the card instead gives the slide up, unsaved.
      onPointerCancel={() => setDrag(undefined)}
      onPointerLeave={() => setHover(undefined)}
      onKeyDown={disabled ? undefined : onKeyDown}
    >
      {[0, 1, 2, 3, 4].map((star) => (
        <StarShape key={star} fill={Math.min(Math.max(shown - star * 2, 0), 2) / 2} />
      ))}
    </span>
  );
}

/** A few lines across the sheet's full width, e.g. notes or a review: a prompt until there are some. */
export function TextRow({
  label,
  value,
  prompt,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value?: string;
  /** Shown on the empty row, e.g. "add a note…". */
  prompt: string;
  placeholder: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [text, setText] = useState(value ?? '');
  const [writing, setWriting] = useState(false);

  if (!text && !writing)
    return (
      <button type="button" onClick={() => setWriting(true)} disabled={disabled} className="sheet-row sheet-wide">
        <span className="sheet-row-label">{label}</span>
        <span className="sheet-row-value sheet-row-empty">{disabled ? t('copy.unset') : prompt}</span>
      </button>
    );

  return (
    <label className="sheet-wide sheet-note">
      <span className="sheet-row-label">{label}</span>
      <textarea
        autoFocus={writing}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setWriting(false);
          if (text.trim() !== (value ?? '')) onChange(text.trim() || undefined);
        }}
        readOnly={disabled}
        rows={2}
        placeholder={placeholder}
        className="sheet-note-input"
      />
    </label>
  );
}

/** The player's own tags as chips, each taken off with its cross; typing one and pressing
    Enter or a comma adds it, with the tags already in use offered as it is typed. */
export function TagEditor({
  tags,
  known,
  onChange,
  disabled,
}: {
  tags?: string[];
  known: string[];
  onChange: (tags: string[] | undefined) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const pickTag = (tag: string) => {
    const next = withTag(tags, tag);
    setDraft('');
    if (next !== tags) onChange(next);
  };
  const suggestions = useSuggestions(
    draft,
    known.filter((tag) => !tags?.includes(tag)),
    pickTag,
  );
  const add = () => {
    const next = withTag(tags, draft);
    setDraft('');
    if (next !== tags) onChange(next);
  };
  const remove = (tag: string) => {
    const next = (tags ?? []).filter((t) => t !== tag);
    onChange(next.length ? next : undefined);
  };

  return (
    <span className="tag-editor" role="group" aria-label={t('tags.label')}>
      {tags?.map((tag) => (
        <span key={tag} className="tag-chip">
          <TagIcon />
          <span>{tag}</span>
          {!disabled && (
            <button type="button" onClick={() => remove(tag)} aria-label={t('tags.remove', { tag })}>
              <svg viewBox="0 0 12 12" aria-hidden>
                <path d="m3 3 6 6m0-6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <span className="suggest">
          <input
            {...suggestions.inputProps}
            value={draft}
            onChange={(e) => {
              // A comma ends a tag, as in most tag fields.
              if (e.target.value.endsWith(',')) {
                const next = withTag(tags, e.target.value.slice(0, -1));
                setDraft('');
                if (next !== tags) onChange(next);
              } else setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (suggestions.onKeyDown(e)) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              } else if (e.key === 'Backspace' && !draft && tags?.length) remove(tags[tags.length - 1]);
            }}
            onBlur={() => {
              suggestions.close();
              if (cleanTag(draft)) add();
            }}
            placeholder={t('tags.add')}
            aria-label={t('tags.placeholder')}
            className="tag-editor-input"
            size={Math.max(5, draft.length + 1)}
            enterKeyHint="done"
          />
          {suggestions.menu}
        </span>
      )}
    </span>
  );
}

/** Where collectors most often keep their games, offered before anything is typed. */
const PLACES = ['place.livingRoom', 'place.tvCabinet', 'place.byConsole', 'place.display', 'place.wardrobe', 'place.storage'] as const;

/** Picks "type your own" from the places menu. */
const OWN_PLACE = '~own';

/** Where the copy is kept: picked from the usual places and those already used, or typed. */
export function LocationRow({
  value,
  known,
  onChange,
  disabled,
}: {
  value?: string;
  known: string[];
  onChange: (location: string | undefined) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState(value ?? '');

  if (!typing) {
    const places = [...new Set([...PLACES.map((key) => t(key)), ...known, ...(value ? [value] : [])])];
    return (
      <Dropdown<string>
        row
        label={t('copy.location')}
        value={value ?? ''}
        neutral=""
        options={[
          { value: '', label: t('copy.unset') },
          ...places.map((place) => ({ value: place, label: place })),
          { value: OWN_PLACE, label: t('copy.locationOwn') },
        ]}
        onChange={(place) => (place === OWN_PLACE ? setTyping(true) : onChange(place || undefined))}
        disabled={disabled}
      />
    );
  }

  const done = () => {
    setTyping(false);
    if (text.trim() && text.trim() !== value) onChange(text.trim());
  };
  return (
    <label className="sheet-row">
      <span className="sheet-row-label">{t('copy.location')}</span>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={done}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') {
            e.stopPropagation();
            setText(value ?? '');
            setTyping(false);
          }
        }}
        placeholder={t('copy.locationPlaceholder')}
        className="sheet-row-input"
        enterKeyHint="done"
      />
    </label>
  );
}

/** Lending a copy, across the sheet's width: a name and a day (today unless changed). A copy
    already out can be marked as back from here too. */
export function LoanForm({
  copy,
  borrowers,
  onChange,
  onDone,
}: {
  copy: Copy;
  borrowers: string[];
  onChange: (patch: Pick<Copy, 'lentTo' | 'lentAt'>) => void;
  /** Saved or cancelled. */
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(copy.lentTo ?? '');
  const [day, setDay] = useState(copy.lentAt ?? today());
  const suggestions = useSuggestions(name, borrowers, setName);
  const save = () => {
    const who = name.trim();
    if (who) onChange({ lentTo: who, lentAt: day || undefined });
    onDone();
  };

  return (
    <div className="sheet-wide loan-form" onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onDone())}>
      <span className="sheet-row-label">{t('copy.lent')}</span>
      <div className="loan-form-fields">
        <label className="loan-field">
          <span>{t('copy.lentTo')}</span>
          <span className="suggest">
            <input
              {...suggestions.inputProps}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => !suggestions.onKeyDown(e) && e.key === 'Enter' && save()}
              onBlur={suggestions.close}
              placeholder={t('copy.lentToPlaceholder')}
              className="nxe-input suggest-input"
              enterKeyHint="done"
            />
            {suggestions.hasOptions && (
              <button
                type="button"
                tabIndex={-1}
                aria-label={t('copy.lentTo')}
                className="suggest-toggle"
                // Keeps the field focused, so the menu it opens stays open.
                onPointerDown={(e) => {
                  e.preventDefault();
                  suggestions.toggle();
                }}
              >
                <svg viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
            {suggestions.menu}
          </span>
        </label>
        <label className="loan-field">
          <span>{t('copy.lentAt')}</span>
          <span className="date-field">
            <input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} className="nxe-input" />
            <CalendarIcon />
          </span>
        </label>
        <div className="flex items-center gap-2 self-end">
          {copy.lentTo && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onChange({ lentTo: undefined, lentAt: undefined });
                onDone();
              }}
              className="mr-1"
            >
              {t('copy.returned')}
            </Button>
          )}
          <Button variant="quiet" size="sm" onClick={() => onDone()}>
            {t('copy.cancel')}
          </Button>
          <Button size="sm" onClick={save} disabled={!name.trim()}>
            {t('copy.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
