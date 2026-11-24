import list from '../../data/backcompat.json';
import type { Game } from '../types';
import { gameKeys, titleKey } from './titles';

/** Words a list adds to the plain title of the very same release. */
const SUFFIX = / (the video ?game|the game|campaign edition|game of the year edition|goty edition|complete edition|ultimate edition)$/;

const plain = (key: string) => key.replace(SUFFIX, '');

const COMPATIBLE = new Set(list.titles.map((title) => plain(titleKey(title))));

/** Whether the game plays on Xbox One and Series X|S: whether it is on Microsoft's list,
    kept in data/backcompat.json. The list closed in 2021, so it says all there is. */
export const isBackCompat = (game: Pick<Game, 'title' | 'igdbQuery'>) => gameKeys(game).some((key) => COMPATIBLE.has(plain(key)));
