import { memo, useEffect, useRef, useState } from 'react';
import type { Wallpaper } from '../lib/wallpapers';

/** How long a new wallpaper takes to fade in over the old one (see .nxe-stage-layer). */
const FADE_MS = 420;

type Layer = { id: number; wallpaper?: Wallpaper };

/** Above this average brightness, white text on the wallpaper needs a heavier shadow. */
const LIGHT_ABOVE = 0.6;

/** Mean brightness (0–1) of where the content sits: the picture minus its top quarter. */
function brightness(img: HTMLImageElement) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, size / 4, size, (size * 3) / 4).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  return sum / (data.length / 4);
}

/** Lets the page adapt to the wallpaper: [data-backdrop="light"] on <html> for a pale one.
    A drawn wallpaper says so itself; an added picture is measured. */
function markTone(light: boolean) {
  document.documentElement.dataset.backdrop = light ? 'light' : 'dark';
}

const isLight = (img?: HTMLImageElement) => !!img?.naturalWidth && brightness(img) > LIGHT_ABOVE;

/**
 * Dashboard wallpaper fixed behind the page, so scrolling content slides over a
 * still background. Without one a plain green gradient stands in.
 *
 * A change fades the new wallpaper in over the old one, as the dashboard does when you
 * browse themes: a picture is loaded first so it never flashes in half-drawn, and
 * layers that have been covered are dropped once the fade is over.
 */
export const Backdrop = memo(function Backdrop({ wallpaper }: { wallpaper?: Wallpaper }) {
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, wallpaper }]);
  const nextId = useRef(1);
  // The wallpaper on top of the stack, shown or fading in.
  const top = useRef(wallpaper);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const show = (light: boolean) => {
      if (cancelled) return;
      markTone(light);
      if (wallpaper === top.current) return;
      top.current = wallpaper;
      const id = nextId.current++;
      setLayers((all) => [...all, { id, wallpaper }]);
      timer = setTimeout(() => setLayers((all) => all.filter((l) => l.id >= id)), FADE_MS);
    };
    if (!wallpaper?.url) show(!!wallpaper?.light);
    else {
      const img = new Image();
      img.onload = () => show(isLight(img));
      img.onerror = () => show(false);
      img.src = wallpaper.url;
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wallpaper]);

  return (
    <div aria-hidden className="nxe-stage">
      {layers.map((l, i) => (
        <div
          key={l.id}
          // The first layer is there from the start; only later ones fade in.
          className={`nxe-stage-layer ${i > 0 ? 'is-entering' : ''}`}
          style={l.wallpaper ? { background: l.wallpaper.background } : undefined}
        />
      ))}
    </div>
  );
});
