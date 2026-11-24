import { memo, type CSSProperties } from 'react';
import type { Game } from '../types';
import { GameBox } from './GameBox';
import { GameMarks } from './GameMarks';

type Props = {
  game: Game;
  onOpen: (game: Game) => void;
  index?: number;
  style?: CSSProperties;
};

// Memoised: opening a dialog re-renders the page, which must not redraw every case.
export const GameTile = memo(function GameTile({ game, onOpen, index = 0, style }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(game)}
      data-tile
      className="group rise flex flex-col text-left outline-none"
      style={{ animationDelay: `${Math.min(index, 30) * 25}ms`, ...style }}
    >
      <GameBox game={game} className="text-[clamp(10px,1vw,15px)]" />
      <div className="tile-caption px-1">
        <div className="tile-title line-clamp-2 text-sm leading-[1.2] font-semibold text-white">{game.title}</div>
        <div className="tile-meta mt-[5px] flex items-center gap-1.5 text-xs text-white/80">
          {game.releaseYear && <span className="nxe-label">{game.releaseYear}</span>}
          <GameMarks game={game} />
        </div>
      </div>
    </button>
  );
});
