import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

/** `count`: how many games the channel holds, raised beside its name. */
export type Channel = { to: string; label: string; count?: number };

/** Size and opacity by distance from the current channel: the dashboard's ratios,
    scaled down so the header doesn't crowd the shelf. The first size must match
    .nxe-channel's font-size. */
const STEPS = [
  { size: 28, opacity: 1 },
  { size: 20, opacity: 0.72 },
  { size: 15, opacity: 0.52 },
  { size: 12, opacity: 0.38 },
  { size: 10, opacity: 0.26 },
];
const LINE = 1.12;

/**
 * NXE channel list: the current channel sits at the bottom in large type, the
 * others stack above it, each step smaller and fainter. The list wraps around,
 * so every channel stays in view and one click away.
 */
export function ChannelNav({ channels }: { channels: Channel[] }) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const n = channels.length;
  const current = Math.max(
    0,
    channels.findIndex((c) => c.to === pathname),
  );

  // Bottom of each step, counted upwards from the bottom of the list.
  const offsets = STEPS.slice(0, n).reduce<number[]>((acc, _, d) => {
    acc.push(d === 0 ? 0 : acc[d - 1] + STEPS[d - 1].size * LINE);
    return acc;
  }, []);
  const height = offsets[n - 1] + STEPS[n - 1].size * LINE;

  return (
    <nav aria-label={t('app.channels')} className="nxe-channels" style={{ height }}>
      {channels.map((channel, i) => {
        const d = Math.min((current - i + n) % n, STEPS.length - 1);
        const { size, opacity } = STEPS[d];
        return (
          <NavLink
            key={channel.to}
            to={channel.to}
            end
            className="nxe-channel"
            style={{
              transform: `translateY(${-offsets[d]}px) scale(${size / STEPS[0].size})`,
              opacity,
            }}
          >
            {channel.label}
            {channel.count !== undefined && <sup className="nxe-channel-count">{channel.count}</sup>}
          </NavLink>
        );
      })}
    </nav>
  );
}
