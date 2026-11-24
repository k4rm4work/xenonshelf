import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

type Option<T> = { value: T; label: string; icon: ReactNode };

type Props<T extends string> = {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

/**
 * Recessed switch for the library layout. A glossy green pill glides to the
 * chosen option, the same motion as the channel list; arrow keys move it too.
 */
export function ViewSwitch<T extends string>({ label, value, options, onChange }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  // Labels change width with the interface language too.
  const labels = options.map((o) => o.label).join();

  useLayoutEffect(() => {
    const measure = () => {
      const active = ref.current?.querySelector<HTMLElement>('[aria-checked="true"]');
      setThumb(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    // Labels change width when the webfont arrives or the breakpoint hides them.
    document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [value, labels]);

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + step + options.length) % options.length];
    onChange(next.value);
    ref.current?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
  };

  return (
    <div ref={ref} role="radiogroup" aria-label={label} className="view-switch" onKeyDown={onKeyDown}>
      {thumb && <span className="view-switch-thumb" style={{ left: thumb.left, width: thumb.width }} aria-hidden />}
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            data-value={o.value}
            aria-checked={checked}
            aria-label={o.label}
            tabIndex={checked ? 0 : -1}
            data-tip={o.label}
            onClick={() => onChange(o.value)}
            className="view-switch-option"
          >
            {o.icon}
            <span className="nxe-label hidden lg:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
