import type { CSSProperties } from 'react';
import { useI18n } from '../lib/i18n';
import { TilesLargeIcon, TilesSmallIcon } from './icons';

/** The cover sizes the slider steps through, in pixels of tile width; 170 is the default. */
const TILE_SIZES = [130, 170, 200, 230, 260];

/** The step nearest a size, so a width saved before the steps still lands on one. */
const stepOf = (size: number) => TILE_SIZES.reduce((best, s, i) => (Math.abs(s - size) < Math.abs(TILE_SIZES[best] - size) ? i : best), 0);

/** The size the covers are laid out at: the saved width, on its step. */
export const snapTileSize = (size: number) => TILE_SIZES[stepOf(size)];

/**
 * Cover size in a few steps, in a recessed tray like the layout switch: notches along a
 * groove that fills green up to a glossy knob, which glides from notch to notch. The
 * native range input stays on top, invisible, for dragging, keys and screen readers;
 * the icons at the ends step down and up.
 */
export function SizeSlider({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const { t } = useI18n();
  const step = stepOf(value);
  const last = TILE_SIZES.length - 1;
  const go = (i: number) => onChange(TILE_SIZES[Math.max(0, Math.min(last, i))]);
  return (
    <div className="size-slider">
      <button
        type="button"
        className="size-slider-end"
        onClick={() => go(step - 1)}
        disabled={step === 0}
        aria-label={t('toolbar.smaller')}
        data-tip={t('toolbar.smaller')}
      >
        <TilesSmallIcon />
      </button>
      <div className="size-slider-track" style={{ '--at': step / last } as CSSProperties}>
        <span className="size-slider-rail" aria-hidden>
          <span className="size-slider-fill" />
          {TILE_SIZES.map((s, i) => (
            <span key={s} className={`size-slider-notch ${i <= step ? 'is-lit' : ''}`} style={{ left: `${(i / last) * 100}%` }} />
          ))}
          <span className="size-slider-knob" />
        </span>
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={step}
          onChange={(e) => go(Number(e.target.value))}
          className="size-slider-input"
          aria-label={t('toolbar.tileSize')}
          aria-valuetext={`${step + 1} / ${TILE_SIZES.length}`}
        />
      </div>
      <button
        type="button"
        className="size-slider-end"
        onClick={() => go(step + 1)}
        disabled={step === last}
        aria-label={t('toolbar.larger')}
        data-tip={t('toolbar.larger')}
      >
        <TilesLargeIcon />
      </button>
    </div>
  );
}
