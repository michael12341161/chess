import { DRAW_REASONS, PIECES } from '../../utils/constants.js';
import { serializePositionKey } from '../../utils/helpers.js';

function collectPieces(board) {
  const pieces = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (piece && piece.type !== PIECES.KING) {
        pieces.push({ ...piece, row, col });
      }
    }
  }
  return pieces;
}

export function hasInsufficientMaterial(board) {
  const pieces = collectPieces(board);
  if (pieces.length === 0) return true;
  if (pieces.length === 1) return [PIECES.BISHOP, PIECES.KNIGHT].includes(pieces[0].type);
  if (pieces.every((piece) => piece.type === PIECES.BISHOP)) {
    const colors = new Set(pieces.map((piece) => (piece.row + piece.col) % 2));
    return colors.size === 1;
  }
  return false;
}

export function detectDraw(state) {
  if (state.halfmoveClock >= 100) return DRAW_REASONS.FIFTY_MOVE;
  if (hasInsufficientMaterial(state.board)) return DRAW_REASONS.INSUFFICIENT_MATERIAL;
  if ((state.repetition?.[serializePositionKey(state)] ?? 0) >= 3) return DRAW_REASONS.THREEFOLD;
  return null;
}
