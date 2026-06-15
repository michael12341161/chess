import { isKingInCheck } from './CheckDetector.js';
import { generateLegalMoves } from '../engine/MoveGenerator.js';

export function isCheckmate(state, color = state.turn) {
  return isKingInCheck(state.board, color) && generateLegalMoves(state, color).length === 0;
}

export function isStalemate(state, color = state.turn) {
  return !isKingInCheck(state.board, color) && generateLegalMoves(state, color).length === 0;
}
