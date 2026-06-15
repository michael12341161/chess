import { PIECE_VALUES, WHITE } from '../../utils/constants.js';

const CENTER = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 5, 5, 5, 5, 5, 5, 0],
  [0, 5, 10, 10, 10, 10, 5, 0],
  [0, 5, 10, 20, 20, 10, 5, 0],
  [0, 5, 10, 20, 20, 10, 5, 0],
  [0, 5, 10, 10, 10, 10, 5, 0],
  [0, 5, 5, 5, 5, 5, 5, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

export function evaluateBoard(state, perspective = WHITE) {
  if (state.result === '1-0') return perspective === WHITE ? 100000 : -100000;
  if (state.result === '0-1') return perspective === WHITE ? -100000 : 100000;
  if (state.result === '1/2-1/2') return 0;

  let score = 0;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = state.board[row][col];
      if (!piece) continue;
      const sign = piece.color === perspective ? 1 : -1;
      score += sign * (PIECE_VALUES[piece.type] + CENTER[row][col]);
    }
  }
  return score;
}
