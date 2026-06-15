import { PIECES, PROMOTION_PIECES, WHITE } from '../../utils/constants.js';
import { squareToCoords } from '../../utils/helpers.js';

export function isPromotionSquare(color, square) {
  const coords = squareToCoords(square);
  if (!coords) return false;
  return color === WHITE ? coords.row === 0 : coords.row === 7;
}

export function isPromotionMove(move) {
  return move.piece.type === PIECES.PAWN && isPromotionSquare(move.piece.color, move.to);
}

export function normalizePromotion(pieceType) {
  return PROMOTION_PIECES.includes(pieceType) ? pieceType : PIECES.QUEEN;
}

export function promotionMoves(baseMove) {
  if (!isPromotionMove(baseMove)) return [baseMove];
  return PROMOTION_PIECES.map((promotion) => ({
    ...baseMove,
    promotion,
    flags: [...(baseMove.flags ?? []), 'promotion'],
  }));
}
