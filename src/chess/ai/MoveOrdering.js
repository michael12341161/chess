import { PIECE_VALUES } from '../../utils/constants.js';

export function orderMoves(moves) {
  return moves.toSorted((a, b) => moveScore(b) - moveScore(a));
}

function moveScore(move) {
  let score = 0;
  if (move.captured) score += 1000 + PIECE_VALUES[move.captured.type] - PIECE_VALUES[move.piece.type] / 10;
  if (move.promotion) score += PIECE_VALUES[move.promotion];
  if (move.flags?.includes('castle')) score += 50;
  return score;
}
