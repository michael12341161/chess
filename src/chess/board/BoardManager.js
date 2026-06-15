import { BOARD_SIZE } from '../../utils/constants.js';
import { coordsToSquare, getPiece } from '../../utils/helpers.js';

export class BoardManager {
  constructor(board) {
    this.board = board;
  }

  get(square) {
    return getPiece(this.board, square);
  }

  entries() {
    const entries = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        entries.push({
          square: coordsToSquare(row, col),
          piece: this.board[row][col],
          row,
          col,
        });
      }
    }
    return entries;
  }

  pieces(color) {
    return this.entries().filter((entry) => entry.piece && (!color || entry.piece.color === color));
  }
}
