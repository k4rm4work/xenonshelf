import { useId, type ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import { usePopover } from '../lib/popover';
import { Dropdown } from './Dropdown';
import { FilterIcon } from './icons';

/** One filter: its choices, the first of them "all". */
export type FilterGroup = {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  /** Short choices, e.g. years, laid out in a grid this many wide. */
  columns?: number;
};

export const NEUTRAL = 'all';

/** "filters" button opening one panel with every filter as a row, name on the left and
    what it is set to on the right, each opening its own menu. */
export function FilterPanel({ groups, footer }: { groups: FilterGroup[]; footer: ReactNode }) {
  const { t } = useI18n();
  // Opens from the button's left edge; on a phone it spans nearly the full width.
  const { open, setOpen, ref, buttonRef, panelRef, panelStyle } = usePopover('left');
  const panelId = useId();
  const active = groups.filter((g) => g.value !== NEUTRAL).length;

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`nxe-field flex h-10 items-center gap-2 px-3.5 text-sm text-slate-600 ${open ? 'nxe-field-open' : ''}`}
      >
        <span className="text-slate-500">
          <FilterIcon />
        </span>
        <span className="nxe-label lowercase">{t('toolbar.filters')}</span>
        {active > 0 && <span className="filter-badge">{active}</span>}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={t('toolbar.filters')}
          // No scrolling of its own: it would clip the menus the rows open.
          className="nxe-menu filter-panel absolute top-full left-0 z-40 mt-2"
          style={{ translate: panelStyle?.translate }}
        >
          <div className="sheet">
            {groups.map((g) => (
              <Dropdown
                key={g.key}
                row
                label={g.label}
                value={g.value}
                neutral={NEUTRAL}
                options={g.options}
                onChange={g.onChange}
                columns={g.columns}
              />
            ))}
          </div>
          <div className="filter-panel-foot">{footer}</div>
        </div>
      )}
    </div>
  );
}
