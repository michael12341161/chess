import { PIECES } from '../../utils/constants.js';

export const Rook = {
  type: PIECES.ROOK,
  value: 500,
  directions: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
};
