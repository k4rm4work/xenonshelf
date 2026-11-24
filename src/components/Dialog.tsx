import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import { Shortcut } from './Shortcut';

type Props = {
  onClose: () => void;
  children: ReactNode;
  backdropImage?: string;
  label: string;
  /** Controls beside the panel rather than in it, e.g. previous/next arrows at the screen edges. */
  aside?: ReactNode;
};

const EXIT_MS = 220;

/** Closes the surrounding dialog with its exit animation; resolves once it is gone. */
const DialogCloseContext = createContext<() => Promise<void>>(async () => {});
export const useDialogClose = () => useContext(DialogCloseContext);

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Phones show a dialog as a bottom sheet (see index.css). */
const SHEET = '(max-width: 639px)';

/** How long the opening fade takes (see .nxe-backdrop); the page under it can go after that. */
const ENTER_MS = 300;

/** Open dialogs that have finished coming in. While there is one, <html> carries
    .dialog-covered: on touch screens the backdrop is opaque and the page under it is
    hidden, so a phone doesn't composite the whole shelf on every frame of scrolling
    the dialog (see index.css). */
let covering = 0;
const cover = (by: 1 | -1) => {
  covering += by;
  document.documentElement.classList.toggle('dialog-covered', covering > 0);
};

export function Dialog({ onClose, children, backdropImage, label, aside }: Props) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef<Promise<void> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    closingRef.current ??= new Promise<void>((resolve) => {
      setClosing(true);
      setTimeout(
        () => {
          onClose();
          resolve();
        },
        prefersReducedMotion() ? 0 : EXIT_MS,
      );
    });
    return closingRef.current;
  }, [onClose]);

  // Covers the page once the dialog has faded in, and shows it again as soon as it starts
  // to leave, so both fades still have the page to fade over.
  useEffect(() => {
    if (closing) return;
    let covered = false;
    const timer = setTimeout(() => {
      covered = true;
      cover(1);
    }, ENTER_MS);
    return () => {
      clearTimeout(timer);
      if (covered) cover(-1);
    };
  }, [closing]);

  // A bottom sheet pulled down from the top of its scroll follows the finger, and lets go
  // of the dialog when pulled far or flicked; otherwise it springs back. Every listener is
  // passive: a blocking touchmove makes the phone wait on script before each step of
  // scrolling, and the sheet stutters. None needs to block: at the top a sheet has nothing
  // to scroll downwards, and it neither stretches nor hands the pull on (see index.css).
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !window.matchMedia(SHEET).matches) return;
    let startY = -1;
    let startTime = 0;
    let pulled = 0;
    const onStart = (e: TouchEvent) => {
      const own = e.target instanceof Element && e.target.closest('input, textarea, .nxe-menu, .star-rating');
      // A sheet at the top can still report a fraction of a pixel of scroll.
      startY = panel.scrollTop < 2 && !own ? e.touches[0].clientY : -1;
      startTime = e.timeStamp;
      pulled = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (startY < 0) return;
      pulled = e.touches[0].clientY - startY;
      // Moving up scrolls the sheet as usual; back above where it started, it lets go.
      if (pulled <= 0) {
        startY = -1;
        panel.style.transform = '';
        return;
      }
      panel.style.transition = 'none';
      panel.style.transform = `translateY(${pulled}px)`;
    };
    const onEnd = (e: TouchEvent) => {
      if (startY < 0) return;
      startY = -1;
      const flicked = pulled > 40 && pulled / (e.timeStamp - startTime) > 0.5;
      if (pulled > panel.offsetHeight * 0.3 || flicked) {
        close();
      } else {
        panel.style.transition = 'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)';
        panel.style.transform = '';
      }
    };
    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: true });
    panel.addEventListener('touchend', onEnd, { passive: true });
    panel.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
      panel.removeEventListener('touchcancel', onEnd);
    };
  }, [close]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [close]);

  return (
    <DialogCloseContext.Provider value={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`nxe-backdrop fixed inset-0 z-50 overflow-x-hidden overflow-y-auto bg-slate-900/70 ${closing ? 'is-closing' : ''}`}
        onMouseDown={(e) => e.target === e.currentTarget && close()}
      >
        {backdropImage && <div className="nxe-backdrop-art" style={{ backgroundImage: `url(${backdropImage})` }} />}
        <div
          ref={panelRef}
          className={`nxe-panel relative mx-auto mt-6 mb-24 w-[min(960px,calc(100%-2rem))] ${closing ? 'is-closing' : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="sheet-grip" aria-hidden="true" />
          {children}
        </div>
        {aside}
      </div>
    </DialogCloseContext.Provider>
  );
}

/** Round close control in the corner of a dialog panel, with its Escape keycap beside it. */
export function CloseButton({ className = '' }: { className?: string }) {
  const close = useDialogClose();
  const { t } = useI18n();
  return (
    <div className={`flex flex-none items-center gap-2 ${className}`}>
      <Shortcut keyName="esc" />
      <button
        type="button"
        onClick={close}
        aria-keyshortcuts="Escape"
        className="nxe-field grid size-9 place-items-center rounded-full! text-slate-500 hover:text-slate-800"
        aria-label={t('dialog.close')}
        data-tip={t('dialog.closeTitle')}
      >
        <svg viewBox="0 0 16 16" className="size-3.5">
          <path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
