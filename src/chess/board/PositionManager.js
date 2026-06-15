import { BOARD_SIZE, INITIAL_FEN } from '../../utils/constants.js';
import { createInitialState, parseFen, stateToFen } from '../../utils/fen.js';
import { cloneBoard, coordsToSquare, getPiece, setPiece, squareToCoords } from '../../utils/helpers.js';

export class PositionManager {
  static initial(fen = INITIAL_FEN) {
    return createInitialState(fen);
  }

  static fromFen(fen) {
    return parseFen(fen);
  }

  static toFen(state) {
    return stateToFen(state);
  }

  static clone(board) {
    return cloneBoard(board);
  }

  static get(board, square) {
    return getPiece(board, square);
  }

  static set(board, square, piece) {
    return setPiece(board, square, piece);
  }

  static squares() {
    const squares = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        squares.push(coordsToSquare(row, col));
      }
    }
    return squares;
  }

  static coords(square) {
    return squareToCoords(square);
  }
}
