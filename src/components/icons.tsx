/**
 * One family: a 20px grid with artwork kept inside 2.5–17.5, a single stroke
 * weight, and round caps and joins throughout.
 */
const iconProps = {
  viewBox: '0 0 20 20',
  className: 'size-4',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function DiscIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="2.25" />
    </svg>
  );
}

/** A case split into one band per game: a single release, a Double Pack or a Triple Pack. */
export function PackIcon({ games = 2 }: { games?: number }) {
  const top = 2.75;
  const height = 14.5;
  return (
    <svg {...iconProps}>
      <rect x="4.5" y={top} width="11" height={height} rx="1.5" />
      {Array.from({ length: games - 1 }, (_, i) => {
        const y = top + (height * (i + 1)) / games;
        return <path key={i} d={`M4.5 ${y}h11`} />;
      })}
    </svg>
  );
}

/** A four-point glint: the shine of a metal SteelBook. */
export function GlintIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 2.75c.7 3.9 2.35 5.55 6.25 6.25-3.9.7-5.55 2.35-6.25 6.25-.7-3.9-2.35-5.55-6.25-6.25 3.9-.7 5.55-2.35 6.25-6.25Z" />
      <path d="M15.5 13.5v3M14 15h3" />
    </svg>
  );
}

/** Sand running out: a time-limited trial. */
export function HourglassIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5.5 3h9M5.5 17h9" />
      <path d="M6.5 3v2.25C6.5 7.5 10 8.25 10 10s-3.5 2.5-3.5 4.75V17M13.5 3v2.25c0 2.25-3.5 3-3.5 4.75s3.5 2.5 3.5 4.75V17" />
    </svg>
  );
}

/** A cup on a stand: finished games. */
export function TrophyIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 3.5h8V8a4 4 0 0 1-8 0Z" />
      <path d="M6 5.25H4.25a.75.75 0 0 0-.75.75v.25A2.75 2.75 0 0 0 6.25 9M14 5.25h1.75a.75.75 0 0 1 .75.75v.25A2.75 2.75 0 0 1 13.75 9" />
      <path d="M10 12v4.5M6.75 16.5h6.5" />
    </svg>
  );
}

export function CloudIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5.75 15.5h8.5a3.1 3.1 0 0 0 .55-6.45A5 5 0 0 0 5.2 9.06a3.25 3.25 0 0 0 .55 6.44Z" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg {...iconProps}>
      <path d="m10 2.75 2.25 4.6 5 .72-3.62 3.53.85 4.98L10 14.23l-4.48 2.35.85-4.98L2.75 8.07l5-.72Z" />
    </svg>
  );
}

/** An arrow down into a tray: save a file. */
export function DownloadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 3v9.5M6 8.75l4 4 4-4M3.5 13.5v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </svg>
  );
}

/** An arrow up out of a tray: open a file. */
export function UploadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 13V3.5M6 7.25l4-4 4 4M3.5 13.5v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </svg>
  );
}

export function TruckIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 5.5h9v8h-9zM11.5 8.5h3.2l2.8 2.8v2.2h-6" />
      <circle cx="6" cy="14.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="14.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 6h12M8 6V4.5h4V6M5.5 6l.8 9.5h7.4l.8-9.5M8.5 9v4M11.5 9v4" />
    </svg>
  );
}

// ---- Toolbar ----

/** One retail case. */
export function CasesIcon() {
  return (
    <svg {...iconProps}>
      {/* The front of a case, with the header band across its top. */}
      <rect x="4.75" y="3" width="10.5" height="14" rx="1.25" />
      <path d="M4.75 6.75h10.5" />
    </svg>
  );
}

/** A wall of covers, upright like the cases seen from the front. */
export function CoversIcon() {
  return (
    <svg {...iconProps}>
      {/* Gaps wider than the stroke, so the four stay apart at 16px. */}
      <rect x="3.5" y="2.75" width="5.25" height="6" rx="1" />
      <rect x="11.25" y="2.75" width="5.25" height="6" rx="1" />
      <rect x="3.5" y="11.25" width="5.25" height="6" rx="1" />
      <rect x="11.25" y="11.25" width="5.25" height="6" rx="1" />
    </svg>
  );
}

/** Index entries: bullet and line. */
export function ListIcon() {
  return (
    <svg {...iconProps}>
      <g fill="currentColor" stroke="none">
        <circle cx="4.75" cy="5" r="1.4" />
        <circle cx="4.75" cy="10" r="1.4" />
        <circle cx="4.75" cy="15" r="1.4" />
      </g>
      <path d="M9 5h7.5M9 10h7.5M9 15h7.5" />
    </svg>
  );
}

/** Small tiles end of the size slider. */
export function TilesSmallIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="4" width="5" height="5" rx="1" />
      <rect x="11" y="4" width="5" height="5" rx="1" />
      <rect x="4" y="11" width="5" height="5" rx="1" />
      <rect x="11" y="11" width="5" height="5" rx="1" />
    </svg>
  );
}

/** Large tiles end of the size slider. */
export function TilesLargeIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="1.5" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="8.75" cy="8.75" r="5.25" />
      <path d="m12.75 12.75 3.75 3.75" />
    </svg>
  );
}

export function ArrowUpIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 16V4m0 0L5 9m5-5 5 5" />
    </svg>
  );
}

/** Three narrowing lines: the filters panel. */
export function FilterIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3.75 4.25h12.5a.5.5 0 0 1 .38.83L11.75 10.6v4.15a.75.75 0 0 1-.41.67l-2 1a.75.75 0 0 1-1.09-.67V10.6L3.37 5.08a.5.5 0 0 1 .38-.83Z" />
    </svg>
  );
}

/** Chevrons for stepping to the previous or next game. */
export function ChevronLeftIcon() {
  return (
    <svg {...iconProps}>
      <path d="m12.5 4.5-5.5 5.5 5.5 5.5" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg {...iconProps}>
      <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />
    </svg>
  );
}

/** Two faders: the settings panel. */
export function SlidersIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 6.5h2M9 6.5h8M3 13.5h8M15 13.5h2" />
      <circle cx="7" cy="6.5" r="2" />
      <circle cx="13" cy="13.5" r="2" />
    </svg>
  );
}

/** A calendar page: a day to pick. */
export function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4.25" width="14" height="12.75" rx="3" />
      <path d="M3 8.5h14M7 2.75v3M13 2.75v3" />
      <rect x="11.25" y="11.25" width="3" height="3" rx="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A price tag: copies up for sale. */
export function TagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 4.5v4.38a1.5 1.5 0 0 0 .44 1.06l6.62 6.62a1.5 1.5 0 0 0 2.12 0l4.38-4.38a1.5 1.5 0 0 0 0-2.12L9.94 3.44A1.5 1.5 0 0 0 8.88 3H4.5A1.5 1.5 0 0 0 3 4.5Z" />
      <circle cx="6.75" cy="6.75" r="1.25" />
    </svg>
  );
}

/** A game case with an arrow leaving it: a copy out on loan. */
export function LoanIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10.25 6V4.25a1.5 1.5 0 0 0-1.5-1.5h-4.5a1.5 1.5 0 0 0-1.5 1.5v11.5a1.5 1.5 0 0 0 1.5 1.5h4.5a1.5 1.5 0 0 0 1.5-1.5V14" />
      <path d="M7.5 10h9.75M14 6.75 17.25 10 14 13.25" />
    </svg>
  );
}

// ---- How far a game got, and how much a wish is wanted ----

/** A ring not yet started: unplayed. */
export function UnplayedIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="10" cy="10" r="7" strokeDasharray="2.6 2.4" />
    </svg>
  );
}

/** Play, in a ring: being played. */
export function PlayingIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="10" cy="10" r="7" />
      <path d="M8.5 7.25v5.5l4.25-2.75Z" fill="currentColor" />
    </svg>
  );
}

/** A tick, in a ring: completed. */
export function CompletedIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="10" cy="10" r="7" />
      <path d="m6.75 10.25 2.25 2.25 4.25-4.5" />
    </svg>
  );
}

/** A cross, in a ring: dropped. */
export function DroppedIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="10" cy="10" r="7" />
      <path d="m7.75 7.75 4.5 4.5m0-4.5-4.5 4.5" />
    </svg>
  );
}

/** Two chevrons up: wanted most. */
export function PriorityHighIcon() {
  return (
    <svg {...iconProps}>
      <path d="m5.5 10 4.5-4.5 4.5 4.5M5.5 14.5 10 10l4.5 4.5" />
    </svg>
  );
}

/** Level: wanted, no hurry. */
export function PriorityMediumIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 8h10M5 12h10" />
    </svg>
  );
}

/** A chevron down: someday. */
export function PriorityLowIcon() {
  return (
    <svg {...iconProps}>
      <path d="m5.5 7.75 4.5 4.5 4.5-4.5" />
    </svg>
  );
}
