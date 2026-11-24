import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Gap between the tooltip and what it describes, and its distance from the screen edge. */
const GAP = 8;
const EDGE = 8;

/** How long the mouse rests before a tip shows, as with the system's own tooltips. Once one
    is showing, the next appears at once if the mouse moves on within WARM ms. */
const DELAY = 500;
const WARM = 300;

type Tip = { text: string; anchor: Element };

/**
 * Dashboard-style tooltips for the whole app, in place of the browser's slow grey ones.
 * Anything with `data-tip` shows its text when the mouse rests on it or it gets keyboard
 * focus, and fades away when left. Touch never shows them: a tap is a press, not a hover.
 */
export function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let shown: Element | null = null;
    let hiddenAt = 0;

    const open = (next: Tip) => {
      shown = next.anchor;
      setTip(next);
      setVisible(true);
    };
    // Leaving fades the tip out where it is; a press or scroll removes it at once.
    const hide = (fade = true) => {
      clearTimeout(timer);
      timer = undefined;
      if (shown) hiddenAt = performance.now();
      shown = null;
      setVisible(false);
      if (!fade) setTip(null);
    };
    const show = (target: EventTarget | null) => {
      const anchor = target instanceof Element ? target.closest('[data-tip]') : null;
      const text = anchor?.getAttribute('data-tip');
      if (!anchor || !text) return hide();
      if (anchor === shown) return;
      clearTimeout(timer);
      if (shown || performance.now() - hiddenAt < WARM) open({ text, anchor });
      else
        timer = setTimeout(() => {
          timer = undefined;
          if (anchor.isConnected) open({ text, anchor });
        }, DELAY);
    };
    const onOver = (e: PointerEvent) => e.pointerType === 'mouse' && show(e.target);
    const onFocus = (e: FocusEvent) => e.target instanceof Element && e.target.matches(':focus-visible') && show(e.target);
    const onLeave = () => hide();
    const onPress = () => hide(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    // Fired on every frame of a scroll: only does anything while a tip is up or on its way.
    const onScroll = () => (shown || timer) && hide(false);

    document.addEventListener('pointerover', onOver, true);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', onLeave, true);
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', onOver, true);
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('focusout', onLeave, true);
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  // Above the element and centred on it; below when there is no room above; kept on screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!tip || !el || !tip.anchor.isConnected) return;

    const a = tip.anchor.getBoundingClientRect();
    const { width, height } = el.getBoundingClientRect();
    const below = a.top - GAP - height < EDGE;
    const left = Math.min(Math.max(a.left + a.width / 2 - width / 2, EDGE), innerWidth - width - EDGE);
    el.style.left = `${left}px`;
    el.style.top = `${below ? a.bottom + GAP : a.top - GAP - height}px`;
    el.style.setProperty('--arrow-x', `${a.left + a.width / 2 - left}px`);
    el.dataset.side = below ? 'below' : 'above';
  }, [tip]);

  // An element gone from the page (a closed dialog) takes its tip with it.
  if (!tip || !tip.anchor.isConnected) return null;
  return (
    <div
      ref={ref}
      role="tooltip"
      className="tooltip"
      data-visible={visible || undefined}
      // Once faded out, the plate goes; the next tip mounts fresh where it belongs.
      onTransitionEnd={() => !visible && setTip(null)}
    >
      {tip.text}
    </div>
  );
}
