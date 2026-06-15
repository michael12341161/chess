import { Bishop } from './Bishop.js';
import { PIECES } from '../../utils/constants.js';
import { Rook } from './Rook.js';

export const Queen = {
  type: PIECES.QUEEN,
  value: 900,
  directions: [...Rook.directions, ...Bishop.directions],
};
