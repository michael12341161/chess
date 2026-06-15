import { BLACK, PIECES, WHITE } from '../../utils/constants.js';

export const Pawn = {
  type: PIECES.PAWN,
  value: 100,
  direction(color) {
    return color === WHITE ? -1 : 1;
  },
  startRow(color) {
    return color === WHITE ? 6 : 1;
  },
  promotionRow(color) {
    return color === WHITE ? 0 : 7;
  },
  enPassantRank(color) {
    return color === WHITE ? '6' : '3';
  },
  colorFromFen(char) {
    return char === char.toUpperCase() ? WHITE : BLACK;
  },
};
