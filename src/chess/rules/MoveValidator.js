import { PIECES } from '../../utils/constants.js';
import { findMove, generateLegalMoves, legalMovesForSquare } from '../engine/MoveGenerator.js';

export function validateMove(state, from, to, promotion) {
  const move = findMove(state, from, to, promotion);
  return {
    valid: Boolean(move),
    move,
    reason: move ? null : 'Illegal move',
  };
}

export function getLegalTargets(state, square) {
  return legalMovesForSquare(state, square).map((move) => ({
    square: move.to,
    capture: Boolean(move.captured),
    promotion: move.piece.type === PIECES.PAWN && Boolean(move.promotion),
  }));
}

export function isLegalMove(state, from, to, promotion) {
  return validateMove(state, from, to, promotion).valid;
}
