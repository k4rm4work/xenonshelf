import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import { GlintIcon, HourglassIcon } from './icons';

/** Small "demo" chip marking a trial version. */
export function DemoTag({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span className={`demo-tag ${className}`} data-tip={t('game.demoVersion')}>
      {t('game.demo')}
    </span>
  );
}

type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

/** Switch next to the format picker; its icon, the one on the matching case badge, lights
    in that badge's colour. */
function FlagToggle({
  value,
  onChange,
  disabled,
  label,
  tone,
  icon,
}: ToggleProps & { label: string; tone: 'demo' | 'steel'; icon: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`flag-toggle flag-toggle-${tone} nxe-field flex h-10 items-center gap-2 px-3.5 text-sm`}
    >
      <span className="flag-toggle-icon">{icon}</span>
      <span className="nxe-label">{label}</span>
    </button>
  );
}

/** Is this only the trial version? */
export const DemoToggle = (props: ToggleProps) => (
  <FlagToggle {...props} label={useI18n().t('game.demo')} tone="demo" icon={<HourglassIcon />} />
);

/** Is this physical copy a metal SteelBook edition? */
export const SteelbookToggle = (props: ToggleProps) => (
  <FlagToggle {...props} label={useI18n().t('game.steelbook')} tone="steel" icon={<GlintIcon />} />
);
