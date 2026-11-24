import type { ReactNode } from 'react';

type Props<T extends string> = {
  value: T | undefined;
  options: Record<T, string>;
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
  icons?: Partial<Record<T, ReactNode>>;
};

/** One-of-many picker: options sit in a recessed tray, the chosen one lit green. */
export function Segmented<T extends string>({ value, options, onChange, disabled, label, icons }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="nxe-slot inline-flex max-w-full flex-wrap gap-0.5 p-0.5">
      {(Object.entries(options) as [T, string][]).map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          disabled={disabled}
          onClick={() => onChange(key)}
          className={`flex h-8 items-center gap-2 rounded-md px-3.5 text-sm transition disabled:cursor-default [&>svg]:size-4 ${
            value === key ? 'gloss-green font-semibold' : 'text-slate-600 enabled:hover:text-slate-900'
          }`}
        >
          {icons?.[key]}
          <span className="nxe-label">{text}</span>
        </button>
      ))}
    </div>
  );
}
