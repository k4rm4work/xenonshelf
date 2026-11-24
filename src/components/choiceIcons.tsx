import type { ReactNode } from 'react';
import type { GameFormat, PackSize, PlayStatus, Priority } from '../types';
import {
  CloudIcon,
  CompletedIcon,
  DiscIcon,
  DroppedIcon,
  PackIcon,
  PlayingIcon,
  PriorityHighIcon,
  PriorityLowIcon,
  PriorityMediumIcon,
  UnplayedIcon,
} from './icons';

/** Icons shown inside the format / pack / status / priority pickers. */
export const FORMAT_ICONS: Record<GameFormat, ReactNode> = {
  physical: <DiscIcon />,
  digital: <CloudIcon />,
};

export const PACK_ICONS: Record<PackSize, ReactNode> = {
  '1': <PackIcon games={1} />,
  '2': <PackIcon games={2} />,
  '3': <PackIcon games={3} />,
};

// Same icons as on the tile captions, so a status reads the same everywhere; each in the
// in a colour of its own: grey, blue, green, red, and amber for a wish of medium priority.
export const STATUS_ICONS: Record<PlayStatus, ReactNode> = {
  unplayed: (
    <span className="status-icon status-icon-unplayed">
      <UnplayedIcon />
    </span>
  ),
  playing: (
    <span className="status-icon status-icon-playing">
      <PlayingIcon />
    </span>
  ),
  completed: (
    <span className="status-icon status-icon-completed">
      <CompletedIcon />
    </span>
  ),
  dropped: (
    <span className="status-icon status-icon-dropped">
      <DroppedIcon />
    </span>
  ),
};

export const PRIORITY_ICONS: Record<Priority, ReactNode> = {
  high: (
    <span className="status-icon status-icon-dropped">
      <PriorityHighIcon />
    </span>
  ),
  medium: (
    <span className="status-icon status-icon-medium">
      <PriorityMediumIcon />
    </span>
  ),
  low: (
    <span className="status-icon status-icon-unplayed">
      <PriorityLowIcon />
    </span>
  ),
};
