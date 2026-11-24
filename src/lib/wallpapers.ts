import { WALLPAPER_ART } from './wallpaperArt';

export type Wallpaper = {
  id: string;
  /** Group from the id's prefix: "nxe-green" -> "nxe". */
  group: string;
  name: string;
  /** CSS background: the gradients of a bundled one, or an added picture. */
  background: string;
  /** Pale behind the content; undefined for a picture, which is measured once loaded. */
  light?: boolean;
  /** The picture to load and measure, for an added one. */
  url?: string;
};

/** "nxe-green-light" -> group "nxe", name "green light". */
function named(id: string) {
  const [group, ...rest] = id.split('-');
  return rest.length ? { group, name: rest.join(' ') } : { group: '', name: group };
}

// Pictures dropped into src/assets/wallpapers/ join the bundled ones at build time,
// grouped by their file name the same way.
const files = import.meta.glob<string>('../assets/wallpapers/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const WALLPAPERS: Wallpaper[] = [
  ...Object.entries(WALLPAPER_ART).map(([id, art]) => ({ id, ...named(id), background: art.background, light: !!art.light })),
  ...Object.entries(files).map(([path, url]) => {
    const id = path.split('/').pop()!;
    return { id, ...named(id.replace(/\.[^.]+$/, '')), background: `url("${url}") center / cover no-repeat`, url };
  }),
]
  // The dashboard's own NXE set leads; other sets follow alphabetically.
  .sort(
    (a, b) =>
      Number(b.group === 'nxe') - Number(a.group === 'nxe') || a.group.localeCompare(b.group, 'en') || a.name.localeCompare(b.name, 'en'),
  );

/** The classic NXE green. */
const DEFAULT_ID = 'nxe-green';

const KEY = 'x360lib:wallpaper';

/** The wallpapers once had Polish file names; a choice saved under one still applies. */
const FORMER_NAMES: Record<string, string> = {
  'miasto-fioletowe': 'city-purple',
  'miasto-niebieskie': 'city-blue',
  'miasto-sepia': 'city-sepia',
  'miasto-zielone': 'city-green',
  'nxe-fioletowy': 'nxe-purple',
  'nxe-niebieski': 'nxe-blue',
  'nxe-pomarańczowy': 'nxe-orange',
  'nxe-światło-tęczowe': 'nxe-rainbow-light',
  'nxe-światło-zielone': 'nxe-green-light',
  'nxe-zielony': 'nxe-green',
};

/** Saved choice, or the default when nothing is saved or the wallpaper is gone. A choice
    saved when the bundled ones were pictures ("nxe-blue.jpg") finds its drawn successor. */
export function loadWallpaper(): string {
  try {
    const saved = localStorage.getItem(KEY)?.normalize('NFC');
    if (saved && WALLPAPERS.some((w) => w.id === saved)) return saved;
    const bare = saved?.replace(/\.[^.]+$/, '');
    const id = bare && (FORMER_NAMES[bare] ?? bare);
    if (id && WALLPAPERS.some((w) => w.id === id)) return id;
  } catch {
    /* ignore */
  }
  return DEFAULT_ID;
}

export function saveWallpaper(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

export const wallpaperById = (id: string | undefined) => WALLPAPERS.find((w) => w.id === id);
