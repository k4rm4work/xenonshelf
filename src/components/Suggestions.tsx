import { useId, useState, type KeyboardEvent } from 'react';

/** How many suggestions show at once; typing narrows them down. */
const MAX_SHOWN = 8;

/**
 * Known values offered under a field as it is typed, in the app's own menu: the browser's
 * datalist can't be styled and draws its own black popup and arrow. Arrow keys move through
 * them, Enter or a click picks one, Escape closes the menu.
 */
export function useSuggestions(value: string, options: string[], onPick: (value: string) => void) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const wanted = value.trim().toLocaleLowerCase();
  const shown = options
    .filter((o) => {
      const name = o.toLocaleLowerCase();
      return name !== wanted && name.includes(wanted);
    })
    .slice(0, MAX_SHOWN);
  const visible = open && shown.length > 0;

  const pick = (option: string) => {
    onPick(option);
    setOpen(false);
    setActive(-1);
  };

  /** Handles the keys that move through the menu; true when the key was used. */
  const onKeyDown = (e: KeyboardEvent): boolean => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!shown.length) return false;
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + step + shown.length) % shown.length);
      return true;
    }
    if (!visible) return false;
    if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(shown[active]);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return true;
    }
    return false;
  };

  const inputProps = {
    role: 'combobox',
    autoComplete: 'off',
    'aria-autocomplete': 'list' as const,
    'aria-expanded': visible,
    'aria-controls': listId,
    'aria-activedescendant': visible && active >= 0 ? `${listId}-${active}` : undefined,
    onFocus: () => setOpen(true),
    onInput: () => {
      setOpen(true);
      setActive(-1);
    },
  };

  const menu = visible && (
    <ul id={listId} role="listbox" className="nxe-menu suggest-menu nxe-scroll">
      {shown.map((option, i) => (
        <li
          key={option}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={i === active}
          className={`nxe-menu-item ${i === active ? 'is-highlighted' : ''}`}
          onMouseEnter={() => setActive(i)}
          // Picked before the field loses focus, which would close the menu first.
          onPointerDown={(e) => {
            e.preventDefault();
            pick(option);
          }}
        >
          <span className="nxe-label">{option}</span>
        </li>
      ))}
    </ul>
  );

  return {
    inputProps,
    onKeyDown,
    menu,
    /** Closes the menu, e.g. when the field is left. */
    close: () => setOpen(false),
    /** Opens or closes it from a button beside the field. */
    toggle: () => setOpen((o) => !o),
    hasOptions: options.some((o) => o.toLocaleLowerCase() !== wanted),
  };
}
