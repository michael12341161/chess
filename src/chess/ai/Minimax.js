import { getBestMove } from './AlphaBeta.js';

export function minimaxMove(state, depth = 1, perspective = state.turn) {
  return getBestMove(state, depth, perspective);
}
