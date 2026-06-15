import { BLACK, BOARD_SIZE, INITIAL_FEN, PIECES, WHITE } from './constants.js';
import { boardToFenPlacement, castlingToFen } from './helpers.js';

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

export function parseFen(fen = INITIAL_FEN) {
  const parts = fen.trim().split(/\s+/);
  const [placement, turn = WHITE, castling = 'KQkq', enPassant = '-', halfmove = '0', fullmove = '1'] = parts;
  const rows = placement.split('/');
  const board = createEmptyBoard();

  rows.forEach((rowFen, rowIndex) => {
    let col = 0;
    [...rowFen].forEach((char) => {
      if (/\d/.test(char)) {
        col += Number(char);
        return;
      }
      const lower = char.toLowerCase();
      const type = Object.values(PIECES).includes(lower) ? lower : null;
      if (type && col < BOARD_SIZE) {
        board[rowIndex][col] = {
          type,
          color: char === char.toUpperCase() ? WHITE : BLACK,
        };
        col += 1;
      }
    });
  });

  return {
    board,
    turn: turn === BLACK ? BLACK : WHITE,
    castling: {
      w: { k: castling.includes('K'), q: castling.includes('Q') },
      b: { k: castling.includes('k'), q: castling.includes('q') },
    },
    enPassant: enPassant === '-' ? null : enPassant,
    halfmoveClock: Number(halfmove) || 0,
    fullmoveNumber: Number(fullmove) || 1,
  };
}

export function stateToFen(state) {
  return [
    boardToFenPlacement(state.board),
    state.turn,
    castlingToFen(state.castling),
    state.enPassant ?? '-',
    state.halfmoveClock,
    state.fullmoveNumber,
  ].join(' ');
}

export function createInitialState(fen = INITIAL_FEN) {
  const parsed = parseFen(fen);
  return {
    ...parsed,
    history: [],
    captured: { w: [], b: [] },
    result: null,
    resultReason: null,
    repetition: {},
  };
}
