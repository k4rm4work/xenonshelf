import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** Room kept free between a panel and the edges of the screen. */
const EDGE = 8;
const BOTTOM_SPACE = 24;

/** Open state for a button with a panel under it: a click outside or Esc closes it,
    and Esc hands focus back to the button.

    The panel (`panelRef`, positioned `left-0` under the wrapper `ref`) lines up with the
    button's left or right edge, slides back in where that would run off the screen, and
    scrolls inside above the bottom of the screen: spread `panelStyle` onto it. */
export function usePopover(align: 'left' | 'right' = 'left') {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    // Capture phase, as in Dropdown: a dialog panel may stop mousedown from bubbling.
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    const anchor = ref.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!open || !anchor || !panel) return setPanelStyle(undefined);
    // offsetWidth, not the box on screen: the panel opens scaled down by its animation,
    // which would make it look narrower than it ends up.
    const width = panel.offsetWidth;
    const wanted = align === 'left' ? anchor.left : anchor.right - width;
    const left = Math.max(EDGE, Math.min(wanted, document.documentElement.clientWidth - EDGE - width));
    const top = panel.getBoundingClientRect().top;
    setPanelStyle({
      translate: `${left - anchor.left}px 0`,
      maxHeight: Math.max(240, window.innerHeight - top - BOTTOM_SPACE),
    });
  }, [open, align]);

  return { open, setOpen, ref, buttonRef, panelRef, panelStyle };
}
