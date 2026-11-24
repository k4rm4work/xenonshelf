import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { RingMark } from '../components/RingMark';
import { Shortcut } from '../components/Shortcut';
import { useI18n } from './i18n';
import { useStore } from './store';
import { useUpdateAvailable } from './updates';

export type ToastNote = {
  /** The first line, like "Achievement unlocked". */
  kicker: string;
  /** The second line: what it was about, usually the game. */
  title: string;
  /** Offer to take the change back; the store holds what to restore. */
  undoable?: boolean;
};

type Shown = ToastNote & { id: number; leaving: boolean };

const SHOW_MS = 6000;
// Words out, bar folded, emblem gone (index.css, "Toasts").
const LEAVE_MS = 560;

const ToastContext = createContext<(note: ToastNote) => void>(() => {});

/** Shows a note about the last change at the foot of the screen, in the style of the
    Xbox 360 achievement pop-up. A new note replaces the one on screen. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Shown | null>(null);
  const nextId = useRef(0);
  const updateAvailable = useUpdateAvailable();

  const show = useCallback((note: ToastNote) => {
    setToast({ ...note, id: ++nextId.current, leaving: false });
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Toast
          key={toast.id}
          toast={toast}
          onLeave={() => setToast((t) => (t?.id === toast.id ? { ...t, leaving: true } : t))}
          onGone={() => setToast((t) => (t?.id === toast.id ? null : t))}
        />
      )}
      {/* Waits in the same place while a note about a change is up. */}
      {!toast && updateAvailable && <UpdateToast />}
    </ToastContext.Provider>
  );
}

/** A newer build is on the server: stays up until the page is reloaded. */
function UpdateToast() {
  const { t } = useI18n();
  return (
    <div className="toast-dock" role="status" aria-live="polite">
      <div className="toast">
        <RingMark className="toast-orb" />
        <span className="toast-text">
          <span className="toast-kicker">{t('update.kicker')}</span>
          <span className="toast-title">{t('update.title')}</span>
        </span>
        <button type="button" onClick={() => window.location.reload()} className="toast-undo">
          {t('update.reload')}
        </button>
      </div>
    </div>
  );
}

function Toast({ toast, onLeave, onGone }: { toast: Shown; onLeave: () => void; onGone: () => void }) {
  const { t } = useI18n();
  const { undo } = useStore();
  const show = useToast();
  const [paused, setPaused] = useState(false);

  // Stays up for a while unless the pointer rests on it, then plays its exit.
  useEffect(() => {
    if (paused || toast.leaving) return;
    const timer = setTimeout(onLeave, SHOW_MS);
    return () => clearTimeout(timer);
  }, [paused, toast.leaving, onLeave]);

  useEffect(() => {
    if (!toast.leaving) return;
    const timer = setTimeout(onGone, LEAVE_MS);
    return () => clearTimeout(timer);
  }, [toast.leaving, onGone]);

  const takeBack = useCallback(async () => {
    if (await undo()) show({ kicker: t('toast.undone'), title: toast.title });
    // Nothing to take back: something else was saved since this toast appeared.
    else onLeave();
  }, [undo, show, t, toast.title, onLeave]);

  // Ctrl+Z (Cmd+Z) takes the change back, except where a text field has its own undo.
  useEffect(() => {
    if (!toast.undoable || toast.leaving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) return;
      e.preventDefault();
      takeBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toast.undoable, toast.leaving, takeBack]);

  return (
    <div className="toast-dock" role="status" aria-live="polite">
      <div
        className={`toast ${toast.leaving ? 'is-leaving' : ''}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Where the console shows its Guide button, the XenonShelf ring powering on. */}
        <RingMark className="toast-orb" />
        <span className="toast-text">
          <span className="toast-kicker">{toast.kicker}</span>
          <span className="toast-title">{toast.title}</span>
        </span>
        {toast.undoable && (
          <button type="button" onClick={takeBack} aria-keyshortcuts="Control+Z" className="toast-undo">
            {t('toast.undo')}
            <Shortcut keyName="ctrl z" className="toast-keycap" />
          </button>
        )}
      </div>
    </div>
  );
}
