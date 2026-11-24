import type { ButtonHTMLAttributes } from 'react';

/**
 * The app's text buttons, so every one of a kind looks the same:
 * - primary: the green glossy pill of the dashboard, for the step that moves things on;
 * - secondary: the white glossy pill beside it, for the other choice;
 * - quiet: grey words, for cancelling;
 * - link: green words, for a lesser action within the text;
 * - back: a green eyebrow over a heading, leading back a step.
 * Round icon buttons and the toolbar's keys are drawn where they stand.
 */
type Variant = 'primary' | 'secondary' | 'quiet' | 'link' | 'back';

/** sm in a form or a note, md in the game card and the page, lg for a dialog's main action. */
type Size = 'sm' | 'md' | 'lg';

const BASE = 'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap disabled:opacity-50 [&>svg]:size-4';

const VARIANTS: Record<Variant, string> = {
  primary: 'gloss-green rounded-full',
  secondary: 'nxe-field rounded-full! text-slate-700 hover:text-slate-900',
  quiet: 'text-slate-500 hover:text-slate-800',
  link: 'text-sm text-x360-dark hover:underline',
  back: 'field-label text-x360-dark! hover:underline',
};

// The bottom padding lifts the label: centred on its capitals, mostly-lowercase words read
// a little low, the more so under the gloss of the pill's upper half.
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 pb-0.5 text-sm',
  md: 'h-10 px-5 pb-0.5 text-sm',
  lg: 'h-11 px-6 pb-[3px]',
};

/** Quiet buttons take a pill's height but little padding: they are words, not keys. */
const QUIET_SIZES: Record<Size, string> = {
  sm: 'h-9 px-2 pb-0.5 text-sm',
  md: 'h-10 px-2 pb-0.5 text-sm',
  lg: 'h-11 px-2 pb-[3px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const sized = variant === 'link' || variant === 'back' ? '' : variant === 'quiet' ? QUIET_SIZES[size] : SIZES[size];
  return <button type={type} className={`${BASE} ${VARIANTS[variant]} ${sized} ${className}`} {...props} />;
}
