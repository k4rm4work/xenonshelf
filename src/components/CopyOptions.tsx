import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import {
  FORMATS,
  PACK_SIZES,
  PLAY_STATUSES,
  PRIORITIES,
  type Copy,
  type Game,
  type GameFormat,
  type GameList,
  type PackSize,
} from '../types';
import { FORMAT_ICONS, PACK_ICONS, PRIORITY_ICONS, STATUS_ICONS } from './choiceIcons';
import { DemoToggle, SteelbookToggle } from './Demo';
import { Dropdown } from './Dropdown';

/** The game's own choices, and the case of the copy it is added with. */
/** What is chosen while adding a game; `format` picks a case or a download, either of which can
    be joined by the other on the game's card later. */
export type CopyFields = Pick<Game, 'playStatus' | 'demo' | 'priority'> & Pick<Copy, 'pack' | 'steelbook'> & { format?: GameFormat };

type Props = {
  list: GameList;
  value: CopyFields;
  onChange: (patch: Partial<CopyFields>) => void;
  disabled?: boolean;
};

/** Menu options from a picker's labels, each with its icon. */
const choices = <T extends string>(labels: Record<T, string>, icons: Partial<Record<T, ReactNode>>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label, icon: icons[value] }));

/** Everything about one copy in a row of menus, each naming itself: how far you got,
    what form it is in, the case. A wishlist game only has its priority. */
export function CopyOptions({ list, value, onChange, disabled }: Props) {
  const { t, labels } = useI18n();
  const physical = value.format !== 'digital';

  if (list === 'wishlist')
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          label={t('game.priority')}
          value={value.priority ?? 'medium'}
          options={choices(labels('priority', PRIORITIES), PRIORITY_ICONS)}
          onChange={(priority) => onChange({ priority })}
          disabled={disabled}
        />
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dropdown
        label={t('game.status')}
        value={value.playStatus ?? 'unplayed'}
        options={choices(labels('status', PLAY_STATUSES), STATUS_ICONS)}
        onChange={(playStatus) => onChange({ playStatus })}
        disabled={disabled}
      />
      <Dropdown
        label={t('game.format')}
        value={value.format ?? 'physical'}
        options={choices(labels('format', FORMATS), FORMAT_ICONS)}
        // SteelBooks and packs are physical cases; going digital drops them.
        onChange={(format) => onChange({ format, ...(format === 'digital' && { steelbook: undefined, pack: undefined }) })}
        disabled={disabled}
      />
      {physical && (
        <Dropdown
          label={t('game.case')}
          value={String(value.pack ?? 1) as PackSize}
          options={choices(labels('pack', PACK_SIZES), PACK_ICONS)}
          onChange={(size) => onChange({ pack: size === '1' ? undefined : Number(size) })}
          disabled={disabled}
        />
      )}
      <DemoToggle value={!!value.demo} onChange={(demo) => onChange({ demo: demo || undefined })} disabled={disabled} />
      {physical && (
        <SteelbookToggle
          value={!!value.steelbook}
          onChange={(steelbook) => onChange({ steelbook: steelbook || undefined })}
          disabled={disabled}
        />
      )}
    </div>
  );
}
