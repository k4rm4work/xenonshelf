import type { Game } from '../types';

export function igdbCoverUrl(imageId: string, size: 'cover_big' | 'cover_small' = 'cover_big') {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

export function coverSrc(game: Pick<Game, 'coverUrl' | 'coverImageId'>) {
  if (game.coverUrl) return game.coverUrl;
  if (game.coverImageId) return igdbCoverUrl(game.coverImageId);
  return undefined;
}
