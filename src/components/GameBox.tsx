import type { CSSProperties } from 'react';
import { coverSrc } from '../lib/cover';
import { isDigitalOnly, shelfCopy } from '../lib/games';
import { useI18n } from '../lib/i18n';
import type { Game } from '../types';

type Props = {
  game: Pick<Game, 'title' | 'coverImageId' | 'coverUrl' | 'coverHasBand' | 'digital' | 'demo' | 'pegi' | 'copies'>;
  /** Turns the case closer to the viewer, e.g. in the details view. */
  flat?: boolean;
  className?: string;
};

/** Hue from the title so placeholder covers differ but stay stable. */
function titleHue(title: string) {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function CoverArt({ title, src }: { title: string; src?: string }) {
  if (src) return <img src={src} alt={title} loading="lazy" draggable={false} />;
  const hue = titleHue(title);
  return (
    <div
      className="flex h-full items-end p-[9cqw]"
      style={{
        background: `radial-gradient(circle at 30% 20%, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 60% 16%) 75%)`,
      }}
    >
      <span className="text-[9cqw] leading-tight font-bold text-white drop-shadow-[0_2px_4px_rgb(0_0_0/0.6)]">{title}</span>
    </div>
  );
}

/** Every game on disc renders as a 3D retail case, SteelBook editions in brushed metal; one
    owned only digitally, which has no case, as a flat card. With several copies, the first one
    is shown. */
export function GameBox({ game, flat, className = '' }: Props) {
  if (isDigitalOnly(game)) return <DigitalCard game={game} flat={flat} className={className} />;
  return <RetailCase game={game} flat={flat} className={className} steel={!!shelfCopy(game).steelbook} />;
}

/** A game bought as a download: just its art on a card, under a flat blue band that says it
    is digital, as the console's store marked its download titles. It turns and lifts like a case. */
function DigitalCard({ game, flat, className = '' }: Props) {
  const { t } = useI18n();
  return (
    <div className={`case-scene relative ${className}`}>
      <div className={`case digital-card ${flat ? 'case-flat' : ''}`}>
        <div className="case-insert">
          <div className="digital-card-band">{t('game.digital')}</div>
          <div className="case-art">
            <CoverArt title={game.title} src={coverSrc(game)} />
          </div>
        </div>
      </div>
      <div className="case-shadow" />
    </div>
  );
}

/** A SteelBook has no printed header: the art runs edge to edge on a metal shell. */
function RetailCase({ game, flat, className = '', steel }: Props & { steel: boolean }) {
  const src = coverSrc(game);
  const showBand = !steel && !(src && game.coverHasBand);
  return (
    <div className={`case-scene relative ${className}`}>
      <div className={`case ${steel ? 'case-steel' : ''} ${flat ? 'case-flat' : ''}`}>
        <div className="case-spine">
          <div className="case-spine-insert" style={src ? ({ '--cover': `url("${src}")` } as CSSProperties) : undefined}>
            {/* Laid out like a real spine: the console logo on top, the title running
                down it, the age rating at the foot. */}
            <div className="case-spine-band">
              <img src="./brand/spine-logo.png" alt="" draggable={false} className="case-spine-logo" />
            </div>
            <span className="case-spine-title">{game.title}</span>
            {!!game.pegi && (
              <span className={`case-spine-pegi facts-pegi-${game.pegi}`} aria-hidden>
                <svg viewBox="0 0 20 16">
                  <text x="10" y="12.5">
                    {game.pegi}
                  </text>
                </svg>
              </span>
            )}
          </div>
        </div>
        <div className="case-front">
          <div className={`case-insert ${showBand ? '' : 'case-insert-full'}`}>
            {showBand && (
              <div className="case-band">
                <img src="./brand/case-band.jpg" alt="Xbox 360" draggable={false} className="case-band-print" />
              </div>
            )}
            <div className="case-art">
              <CoverArt title={game.title} src={src} />
            </div>
          </div>
        </div>
      </div>
      <div className="case-shadow" />
    </div>
  );
}
