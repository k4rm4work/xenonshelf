import { startTransition, useEffect, useRef, useState } from 'react';

/** Tiles built at first: a full screen of the smallest covers on a wide display, with some over. */
const FIRST = 96;
/** Tiles added each time the end of the built part comes near. */
const MORE = 96;
/** How far below the screen the end may be before more are built, so scrolling meets them ready. */
const AHEAD = '0px 0px 1500px 0px';

/**
 * A long list built a part at a time: the first screenful at once, the rest as scrolling nears
 * its end. Building every tile of a library of thousands blocks the page for seconds on a
 * phone, and again after each letter typed in the search. More is built as a transition, which
 * gives way to scrolling and typing. A new `from` (another filter, sort or list) starts over
 * from the first part; the same list with a game changed keeps what is built.
 *
 * Returns how many items to show and a ref for an element placed after them.
 */
export function useGrowingList(total: number, from: unknown) {
  const [count, setCount] = useState(FIRST);
  const [countFor, setCountFor] = useState(from);
  if (countFor !== from) {
    setCountFor(from);
    setCount(FIRST);
  }
  const end = useRef<HTMLDivElement>(null);

  // Observed afresh after each part: an observer only reports a change, and the end can still
  // be in reach after a part too short to push it away.
  useEffect(() => {
    const el = end.current;
    if (!el || count >= total) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) startTransition(() => setCount((n) => n + MORE));
      },
      { rootMargin: AHEAD },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [count, total]);

  return { count: Math.min(count, total), end };
}
