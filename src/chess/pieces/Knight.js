import { PIECES } from '../../utils/constants.js';

export const Knight = {
  type: PIECES.KNIGHT,
  value: 320,
  jumps: [
    [2, 1],
    [2, -1],
    [-2, 1],
    [-2, -1],
    [1, 2],
    [1, -2],
    [-1, 2],
    [-1, -2],
  ],
};
