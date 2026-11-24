/* The bundled wallpapers, drawn in CSS after the colours and the fall of light of the
   Xbox 360 dashboard themes (NXE, 2008), no image files.

   Every light is a radial gradient whose strength eases out over many stops, mixed in
   oklab, so it melts into what is under it with no edge or ring to see. Shapes are larger
   than the screen and overlap. Ring sizes are in cqmin of the box the background sits in
   (a size container: .nxe-stage, .wallpaper-thumb), so a thumbnail is the wallpaper in
   miniature. A faint grain over the stage (see index.css) keeps the long gradients from
   banding. */

type Rgb = [number, number, number];

const rgb = ([r, g, b]: Rgb, alpha = 1) => `rgb(${r} ${g} ${b} / ${+alpha.toFixed(3)})`;

/** 1 at the centre down to 0 at the edge, flat at both ends: no visible rim. */
const fade = (t: number) => {
  const s = 1 - t;
  return s * s * (3 - 2 * s);
};

/** Stops for a light that is `alpha` strong at its heart and gone at its edge. */
function falloff(color: Rgb, alpha: number, steps = 12) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return `${rgb(color, alpha * fade(t))} ${(t * 100).toFixed(1)}%`;
  }).join(', ');
}

/** A soft light: an ellipse `w`×`h` (% of the box) centred at `x`,`y` (%). */
const glow = (x: number, y: number, w: number, h: number, color: Rgb, alpha: number) =>
  `radial-gradient(ellipse ${w}% ${h}% at ${x}% ${y}% in oklab, ${falloff(color, alpha)})`;

/** A top-to-bottom backdrop through the given colours, eased between them. */
function backdrop(stops: [number, Rgb][]) {
  const out: string[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      const e = t * t * (3 - 2 * t);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * e)) as Rgb;
      out.push(`${rgb(c)} ${(p0 + (p1 - p0) * t).toFixed(1)}%`);
    }
  }
  const [pl, cl] = stops[stops.length - 1];
  out.push(`${rgb(cl)} ${pl}%`);
  return `linear-gradient(180deg in oklab, ${out.join(', ')})`;
}

/** Concentric rings, the NXE motif, drawn faint with soft edges. */
function rings(x: number, y: number, radius: number, color: Rgb, alpha: number, count = 4) {
  const stops: string[] = ['transparent 0'];
  const soft = radius / 26;
  for (let i = 1; i <= count; i++) {
    const r = (radius / count) * i;
    // Outer rings fade, so the set dissolves rather than stops.
    const a = alpha * (1 - (i - 1) / (count + 1));
    stops.push(
      `transparent ${(r - soft * 2).toFixed(2)}cqmin`,
      `${rgb(color, a)} ${(r - soft).toFixed(2)}cqmin`,
      `transparent ${r.toFixed(2)}cqmin`,
    );
  }
  return `radial-gradient(circle at ${x}% ${y}%, ${stops.join(', ')})`;
}

type Light = [x: number, y: number, w: number, h: number, color: Rgb, alpha: number];

type Theme = {
  backdrop: [number, Rgb][];
  lights: Light[];
  /** NXE rings: their colour and strength. */
  rings?: [Rgb, number];
};

/** Lights over a backdrop, the brightest first so they sit on top. */
function paint({ backdrop: stops, lights, rings: ring }: Theme) {
  return [
    ...(ring ? [rings(74, 54, 30, ring[0], ring[1], 5), rings(6, 18, 40, ring[0], ring[1] * 0.7, 6)] : []),
    ...lights.map((l) => glow(...l)),
    backdrop(stops),
  ].join(', ');
}

const WHITE: Rgb = [255, 255, 255];

/** Each bundled wallpaper by id ("group-name"), and whether it is pale behind the content. */
export const WALLPAPER_ART: Record<string, { background: string; light?: boolean }> = {
  'nxe-blue': {
    background: paint({
      backdrop: [
        [0, [11, 62, 132]],
        [50, [22, 98, 190]],
        [100, [8, 40, 92]],
      ],
      lights: [
        [52, 47, 50, 22, [200, 235, 255], 0.6],
        [50, 46, 85, 38, [80, 165, 245], 0.8],
        [0, 100, 70, 60, [6, 30, 75], 0.6],
      ],
      rings: [[150, 205, 255], 0.12],
    }),
  },
  'nxe-green': {
    background: paint({
      backdrop: [
        [0, [74, 140, 8]],
        [48, [110, 170, 14]],
        [100, [40, 82, 4]],
      ],
      lights: [
        [55, 42, 46, 22, [245, 240, 60], 0.65],
        [52, 42, 85, 40, [205, 220, 10], 0.75],
        [100, 0, 40, 45, [95, 75, 100], 0.75],
        [0, 100, 70, 55, [30, 65, 3], 0.6],
      ],
      rings: [[240, 245, 190], 0.14],
    }),
  },
  'nxe-orange': {
    background: paint({
      backdrop: [
        [0, [130, 20, 6]],
        [48, [165, 42, 8]],
        [100, [70, 6, 3]],
      ],
      lights: [
        [56, 42, 46, 22, [255, 196, 40], 0.65],
        [54, 42, 85, 40, [240, 140, 0], 0.8],
        [100, 0, 40, 45, [95, 50, 95], 0.8],
        [0, 100, 70, 55, [60, 4, 2], 0.6],
      ],
      rings: [[255, 215, 170], 0.14],
    }),
  },
  'nxe-purple': {
    background: paint({
      backdrop: [
        [0, [58, 28, 98]],
        [50, [86, 50, 130]],
        [100, [42, 18, 70]],
      ],
      lights: [
        [62, 36, 40, 20, [215, 165, 220], 0.55],
        [58, 38, 85, 45, [165, 105, 190], 0.7],
        [104, 86, 60, 70, [215, 125, 40], 0.75],
        [0, 100, 60, 50, [35, 14, 60], 0.6],
      ],
      rings: [[215, 190, 245], 0.13],
    }),
  },
  'nxe-green-light': {
    light: true,
    background: paint({
      backdrop: [
        [0, [86, 140, 26]],
        [30, [140, 170, 120]],
        [56, [228, 240, 244]],
        [100, [240, 245, 238]],
      ],
      lights: [
        [45, 62, 120, 40, WHITE, 0.85],
        [100, 56, 26, 40, [250, 232, 70], 0.95],
        [0, 0, 60, 55, [25, 70, 5], 0.85],
        [100, 0, 45, 50, [32, 46, 42], 0.85],
      ],
    }),
  },
  'nxe-rainbow-light': {
    background: paint({
      backdrop: [
        [0, [58, 64, 76]],
        [48, [108, 118, 132]],
        [100, [92, 102, 116]],
      ],
      lights: [
        [26, 47, 34, 22, [255, 250, 245], 0.95],
        [50, 52, 100, 16, [242, 236, 255], 0.85],
        [16, 38, 34, 34, [245, 140, 70], 0.8],
        [46, 18, 30, 34, [150, 190, 130], 0.55],
        [80, 30, 32, 36, [140, 130, 215], 0.65],
        [20, 88, 40, 36, [130, 150, 110], 0.5],
      ],
    }),
  },
  'city-blue': {
    background: paint({
      backdrop: [
        [0, [4, 12, 34]],
        [55, [10, 28, 74]],
        [100, [6, 18, 52]],
      ],
      lights: [
        [62, 100, 90, 60, [55, 115, 235], 0.75],
        [14, 82, 50, 45, [40, 95, 215], 0.55],
        [72, 10, 50, 40, [25, 60, 150], 0.45],
        [0, 0, 60, 60, [0, 0, 0], 0.5],
      ],
    }),
  },
  'city-green': {
    background: paint({
      backdrop: [
        [0, [2, 12, 6]],
        [55, [6, 32, 14]],
        [100, [3, 20, 9]],
      ],
      lights: [
        [62, 100, 90, 60, [35, 175, 75], 0.7],
        [14, 82, 50, 45, [25, 140, 60], 0.5],
        [72, 10, 50, 40, [20, 90, 45], 0.45],
        [0, 0, 60, 60, [0, 0, 0], 0.5],
      ],
    }),
  },
  'city-purple': {
    background: paint({
      backdrop: [
        [0, [10, 4, 22]],
        [55, [28, 12, 52]],
        [100, [16, 6, 34]],
      ],
      lights: [
        [62, 100, 90, 60, [135, 65, 205], 0.7],
        [14, 82, 50, 45, [100, 45, 170], 0.5],
        [72, 10, 50, 40, [65, 30, 120], 0.45],
        [0, 0, 60, 60, [0, 0, 0], 0.5],
      ],
    }),
  },
  'city-sepia': {
    background: paint({
      backdrop: [
        [0, [14, 10, 7]],
        [55, [36, 26, 17]],
        [100, [20, 14, 9]],
      ],
      lights: [
        [55, 92, 80, 60, [170, 125, 80], 0.6],
        [50, 30, 40, 50, [120, 88, 55], 0.45],
        [100, 50, 40, 70, [0, 0, 0], 0.5],
        [0, 50, 40, 70, [0, 0, 0], 0.55],
      ],
    }),
  },
};
