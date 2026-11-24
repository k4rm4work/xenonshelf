import { useEffect, useId, useState } from 'react';

/** Ring quadrants clockwise from the top-left; players fill them in the same order. */
const QUADRANTS = [
  'M14.13 29.81 A18 18 0 0 1 29.81 14.13',
  'M34.19 14.13 A18 18 0 0 1 49.87 29.81',
  'M49.87 34.19 A18 18 0 0 1 34.19 49.87',
  'M29.81 49.87 A18 18 0 0 1 14.13 34.19',
];
type Frame = { lit: number[]; ms: number };

/** The ring chasing round, as the console does three times when it powers on. */
const spin = (): Frame[] => Array.from({ length: 12 }, (_, i) => ({ lit: [i % 4], ms: 95 }));

/** Player 1 on a console that is on: where the ring settles, and the still picture for
    reduced motion. During play the lights hold steady; they never blink. */
const STILL: Frame = { lit: [0], ms: 0 };

/** The power-on, after Microsoft's description of the Ring of Light (KB 907624): three
    quick turns of the ring, then player 1 for good. */
const INTRO: Frame[] = [{ lit: [], ms: 250 }, ...spin(), { lit: [], ms: 200 }, STILL];

/** Three red quadrants, clockwise from the top-left: the console's general hardware fault,
    the "Red Ring of Death". */
const FAULT: Frame = { lit: [0, 1, 2], ms: 0 };

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The app symbol with a Ring of Light that powers on once when it first shows; the
    favicon is its still version. With `fault` it shows the red ring of a failed console,
    the mark of an error, its lights flashing as the console's do (see .ring-mark-fault). */
export function RingMark({ className = '', fault = false }: { className?: string; fault?: boolean }) {
  // Gradient ids must be unique on the page and safe inside url(#…).
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [frame, setFrame] = useState<Frame>(fault ? FAULT : STILL);

  useEffect(() => {
    if (fault || prefersReducedMotion()) return;
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;
    // Stops on the last frame.
    const next = () => {
      const f = INTRO[step++];
      setFrame(f);
      if (step < INTRO.length) timer = setTimeout(next, f.ms);
    };
    next();
    return () => clearTimeout(timer);
  }, [fault]);

  return (
    <svg viewBox="0 0 64 64" className={`ring-mark ${fault ? 'ring-mark-fault' : ''} ${className}`} aria-hidden>
      <defs>
        <linearGradient id={`${id}body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#48525b" />
          <stop offset=".5" stopColor="#262c32" />
          <stop offset="1" stopColor="#121518" />
        </linearGradient>
        <linearGradient id={`${id}rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9edf0" />
          <stop offset=".5" stopColor="#8e98a1" />
          <stop offset="1" stopColor="#3a424a" />
        </linearGradient>
        <linearGradient id={`${id}dim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a747d" />
          <stop offset="1" stopColor="#454d55" />
        </linearGradient>
        {/* Brightest on the outer edge, like light coming through the plastic ring. */}
        <radialGradient id={`${id}lit`} cx="32" cy="32" r="22" gradientUnits="userSpaceOnUse">
          <stop offset=".6" stopColor={fault ? '#e0232f' : '#5fc21e'} />
          <stop offset="1" stopColor={fault ? '#ffb3b3' : '#d4ff9e'} />
        </radialGradient>
        <radialGradient id={`${id}button`} cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".6" stopColor="#d3d9de" />
          <stop offset="1" stopColor="#8e98a1" />
        </radialGradient>
        <linearGradient id={`${id}gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      <circle cx="32" cy="32" r="29" fill={`url(#${id}body)`} stroke={`url(#${id}rim)`} strokeWidth="2" />
      <ellipse cx="32" cy="17" rx="20" ry="11" fill={`url(#${id}gloss)`} />

      <g fill="none" strokeWidth="7">
        {QUADRANTS.map((d) => (
          <path key={d} d={d} stroke={`url(#${id}dim)`} />
        ))}
      </g>
      <g fill="none" stroke={fault ? '#ff5a5a' : '#b6f37a'} strokeWidth="9" filter={`url(#${id}glow)`} opacity={0.8}>
        {QUADRANTS.map((d, i) => (
          <path key={d} d={d} className={`ring-led ${frame.lit.includes(i) ? 'is-on' : ''}`} />
        ))}
      </g>
      <g fill="none" strokeWidth="7">
        {QUADRANTS.map((d, i) => (
          <path key={d} d={d} stroke={`url(#${id}lit)`} className={`ring-led ${frame.lit.includes(i) ? 'is-on' : ''}`} />
        ))}
      </g>

      {/* The power button. */}
      <circle cx="32" cy="32" r="8" fill={`url(#${id}button)`} stroke="#2a3036" strokeWidth="1.2" />
    </svg>
  );
}
