import { PIECES } from '../../utils/constants.js';
import { coordsToSquare, squareToCoords } from '../../utils/helpers.js';

export function getEnPassantTarget(move) {
  if (move.piece.type !== PIECES.PAWN) return null;
  const from = squareToCoords(move.from);
  const to = squareToCoords(move.to);
  if (!from || !to || Math.abs(from.row - to.row) !== 2) return null;
  return coordsToSquare((from.row + to.row) / 2, from.col);
}

export function getEnPassantCaptureSquare(move) {
  const from = squareToCoords(move.from);
  const to = squareToCoords(move.to);
  if (!from || !to) return null;
  return coordsToSquare(from.row, to.col);
}

export function isEnPassantMove(state, from, to, piece) {
  return piece?.type === PIECES.PAWN && state.enPassant === to && from[0] !== to[0];
}
