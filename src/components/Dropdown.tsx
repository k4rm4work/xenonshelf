import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useI18n } from '../lib/i18n';

type Option<T> = { value: T; label: string; icon?: ReactNode };

/** Room kept free between a long menu and the edge of the viewport. */
const EDGE_SPACE = 24;

/** Gap between the trigger and its menu (Tailwind's mt-2 / mb-2). */
const MENU_GAP = 8;

type Props<T extends string | number> = {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  /** Value that means "no filter"; the control is highlighted when something else is picked. */
  neutral?: T;
  /** Lays short options out in a grid this many wide; the neutral option keeps a full row. */
  columns?: number;
  disabled?: boolean;
  /** Drawn as a row of a sheet (CopySheet): name on the left, value on the right; the
      neutral value then reads as not set rather than as a filter. */
  row?: boolean;
  /** Drawn as a small pill of the value alone, e.g. the status under a game's title. */
  chip?: boolean;
  /** Fills the width it is given, a long value cut short on one line: one of a column. */
  block?: boolean;
};

/** NXE-style menu: glossy panel, green highlight bar on the active row. */
export function Dropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  neutral,
  columns = 1,
  disabled,
  row,
  chip,
  block,
}: Props<T>) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [alignRight, setAlignRight] = useState(false);
  // Opens upwards when the room below the trigger is too short and there is more above.
  const [above, setAbove] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const [listMaxHeight, setListMaxHeight] = useState<number>();
  const listId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[selectedIndex];
  const active = !row && neutral !== undefined && value !== neutral;
  const grid = columns > 1;
  // In a grid the neutral option heads the list on a row of its own.
  const first = neutral !== undefined && options[0]?.value === neutral ? 1 : 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    // Capture phase: a dialog panel stops mousedown from bubbling so clicks inside it
    // don't close the dialog, which would otherwise hide outside clicks from this menu.
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open]);

  // Menus open from the trigger's left edge, unless that would run off the right of the screen,
  // and downwards, unless the menu doesn't fit below and there is more room above, e.g. a row
  // at the foot of a card on a phone. Long lists scroll inside the menu, short of the edge.
  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current?.getBoundingClientRect();
    const list = listRef.current;
    const trigger = ref.current?.getBoundingClientRect();
    if (!menu || !list || !trigger) return;
    if (menu.right > document.documentElement.clientWidth - 8) setAlignRight(true);
    // The menu at full length, and what it holds besides its list (heading, padding).
    const chrome = menu.height - list.clientHeight;
    const full = chrome + list.scrollHeight;
    const below = window.innerHeight - trigger.bottom - MENU_GAP - EDGE_SPACE;
    const over = trigger.top - MENU_GAP - EDGE_SPACE;
    const up = full > below && over > below;
    setAbove(up);
    setListMaxHeight(Math.max(160, (up ? over : below) - chrome));
  }, [open]);

  // A menu opened near the bottom of a scrolling card is brought into view whole.
  useEffect(() => {
    if (open && listMaxHeight !== undefined) menuRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open, listMaxHeight]);

  // Keep the keyboard highlight in view while scrolling a long list.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${highlight}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight, listId]);

  const openMenu = () => {
    setHighlight(selectedIndex);
    setAlignRight(false);
    setAbove(false);
    setOpen(true);
  };

  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
  };

  // Focus stays on the trigger; the highlighted row is tracked via aria-activedescendant.
  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    const last = options.length - 1;
    if (grid && e.key === 'ArrowDown') setHighlight((i) => (i < first ? first : Math.min(last, i + columns)));
    else if (grid && e.key === 'ArrowUp') setHighlight((i) => (i - columns < first ? 0 : i - columns));
    else if (grid && e.key === 'ArrowRight') setHighlight((i) => Math.min(last, i + 1));
    else if (grid && e.key === 'ArrowLeft') setHighlight((i) => Math.max(0, i - 1));
    else if (e.key === 'ArrowDown') setHighlight((i) => (i >= last ? 0 : i + 1));
    else if (e.key === 'ArrowUp') setHighlight((i) => (i <= 0 ? last : i - 1));
    else if (e.key === 'Home') setHighlight(0);
    else if (e.key === 'End') setHighlight(last);
    else if (e.key === 'Enter' || e.key === ' ') choose(highlight);
    else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      if (e.key === 'Tab') return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div ref={ref} className="relative" onKeyDown={onKeyDown}>
      {chip ? (
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openMenu())}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
          aria-label={`${label}: ${current.label}`}
          className={`quick-chip ${open ? 'quick-chip-open' : ''}`}
        >
          {current.icon}
          <span className="nxe-label">{current.label}</span>
          {!disabled && (
            <svg viewBox="0 0 12 12" className="quick-chip-chevron" aria-hidden>
              <path d="M2 4.5 6 8l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
      ) : row ? (
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openMenu())}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
          className={`sheet-row ${open ? 'sheet-row-open' : ''}`}
        >
          <span className="sheet-row-label">{label}</span>
          <span className={`sheet-row-value ${value === neutral ? 'sheet-row-empty' : ''}`}>
            {current.icon}
            <span className="nxe-label">{current.label}</span>
          </span>
          {!disabled && <RowChevron />}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openMenu())}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
          className={`nxe-field flex h-10 items-center gap-2 pl-3.5 text-sm disabled:cursor-default ${
            active ? 'nxe-field-active pr-10' : 'pr-2.5'
          } ${open ? 'nxe-field-open' : ''} ${block ? 'w-full' : ''}`}
        >
          {/* An unset filter shows just its name to keep the toolbar on one row. */}
          {neutral !== undefined && !active ? (
            <span className="text-slate-600 lowercase">{label}</span>
          ) : (
            <>
              <span className="text-slate-500 lowercase">{label}</span>
              <span
                className={`flex items-center gap-1.5 [&>svg]:size-4 ${active ? 'nxe-chip' : 'font-semibold text-slate-700'} ${block ? 'min-w-0 flex-1' : ''}`}
              >
                {current.icon}
                <span className={`nxe-label ${block ? 'truncate' : ''}`}>{current.label}</span>
              </span>
            </>
          )}
          {!active && (
            <svg viewBox="0 0 12 12" className={`size-3 text-slate-400 transition ${open ? 'rotate-180' : ''} ${disabled ? 'hidden' : ''}`}>
              <path d="M2 4.5 6 8l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
      )}
      {/* A set filter swaps its chevron for a quick way back to "all". It sits beside the
          trigger rather than in it, since a button can't hold another button. */}
      {active && (
        <button
          type="button"
          onClick={() => {
            onChange(neutral);
            setOpen(false);
          }}
          aria-label={t('toolbar.clearFilter', { label })}
          data-tip={t('toolbar.clearFilter', { label })}
          className="hit-area absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-900/8 hover:text-slate-700"
        >
          <svg viewBox="0 0 12 12" className="size-2.5">
            <path d="m3 3 6 6m0-6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {open && (
        <div
          ref={menuRef}
          className={`nxe-menu absolute z-40 w-max min-w-[max(100%,200px)] p-1.5 ${above ? 'nxe-menu-up bottom-full mb-2' : 'top-full mt-2'} ${
            alignRight ? 'nxe-menu-right right-0' : 'left-0'
          }`}
        >
          <div className="px-2.5 pt-1.5 pb-2 text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">{label}</div>
          <ul
            ref={listRef}
            role="listbox"
            id={listId}
            aria-label={label}
            className={`nxe-menu-list nxe-scroll overflow-y-auto overscroll-contain ${grid ? 'nxe-menu-grid' : 'flex flex-col gap-0.5 *:flex-none'}`}
            style={{ maxHeight: listMaxHeight, ...(grid && { gridTemplateColumns: `repeat(${columns}, minmax(3.5rem, 1fr))` }) }}
          >
            {options.map((o, i) => {
              const selected = i === selectedIndex;
              return (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(i)}
                  className={`nxe-menu-item ${selected ? 'nxe-menu-item-selected' : ''} ${
                    i === highlight ? 'is-highlighted' : ''
                  } ${neutral !== undefined && o.value === neutral ? 'nxe-menu-item-neutral' : ''}`}
                >
                  {o.icon ? (
                    <span className="flex items-center gap-2 [&>svg]:size-4">
                      {o.icon}
                      <span className="nxe-label">{o.label}</span>
                    </span>
                  ) : (
                    <span className="nxe-label">{o.label}</span>
                  )}
                  <svg viewBox="0 0 16 16" className="nxe-menu-check" aria-hidden>
                    <path
                      d="m3.5 8.5 3 3 6-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Points at the menu a sheet row opens. */
function RowChevron() {
  return (
    <svg viewBox="0 0 12 12" className="sheet-row-chevron" aria-hidden>
      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
