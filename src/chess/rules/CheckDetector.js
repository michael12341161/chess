import { Bishop } from '../pieces/Bishop.js';
import { King } from '../pieces/King.js';
import { Knight } from '../pieces/Knight.js';
import { Queen } from '../pieces/Queen.js';
import { Rook } from '../pieces/Rook.js';
import { PIECES, WHITE } from '../../utils/constants.js';
import { findKing, getPiece, isInsideBoard, squareToCoords } from '../../utils/helpers.js';

function hasAttackingSlider(board, row, col, attackerColor, directions, allowedTypes) {
  return directions.some(([dr, dc]) => {
    let r = row + dr;
    let c = col + dc;
    while (isInsideBoard(r, c)) {
      const piece = board[r][c];
      if (piece) {
        return piece.color === attackerColor && allowedTypes.includes(piece.type);
      }
      r += dr;
      c += dc;
    }
    return false;
  });
}

export function isSquareAttacked(board, square, attackerColor) {
  const coords = squareToCoords(square);
  if (!coords) return false;
  const { row, col } = coords;
  const pawnDirection = attackerColor === WHITE ? -1 : 1;
  const pawnRow = row - pawnDirection;

  for (const pawnCol of [col - 1, col + 1]) {
    if (isInsideBoard(pawnRow, pawnCol)) {
      const pawn = board[pawnRow][pawnCol];
      if (pawn?.color === attackerColor && pawn.type === PIECES.PAWN) return true;
    }
  }

  for (const [dr, dc] of Knight.jumps) {
    const piece = isInsideBoard(row + dr, col + dc) ? board[row + dr][col + dc] : null;
    if (piece?.color === attackerColor && piece.type === PIECES.KNIGHT) return true;
  }

  for (const [dr, dc] of King.directions) {
    const piece = isInsideBoard(row + dr, col + dc) ? board[row + dr][col + dc] : null;
    if (piece?.color === attackerColor && piece.type === PIECES.KING) return true;
  }

  if (hasAttackingSlider(board, row, col, attackerColor, Rook.directions, [PIECES.ROOK, PIECES.QUEEN])) {
    return true;
  }

  return hasAttackingSlider(board, row, col, attackerColor, Bishop.directions, [PIECES.BISHOP, PIECES.QUEEN]);
}

export function isKingInCheck(board, color) {
  const kingSquare = findKing(board, color);
  if (!kingSquare) return true;
  return isSquareAttacked(board, kingSquare, color === WHITE ? 'b' : 'w');
}

export function attackedPieces(board, attackerColor) {
  const targets = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (piece && piece.color !== attackerColor) {
        const square = `${String.fromCharCode(97 + col)}${8 - row}`;
        if (isSquareAttacked(board, square, attackerColor)) targets.push({ square, piece });
      }
    }
  }
  return targets;
}
