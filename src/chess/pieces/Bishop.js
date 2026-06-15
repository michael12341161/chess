import { PIECES } from '../../utils/constants.js';

export const Bishop = {
  type: PIECES.BISHOP,
  value: 330,
  directions: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
};
