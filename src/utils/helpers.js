import { BLACK, BOARD_SIZE, FILES, PIECES, WHITE } from './constants.js';

export function opponent(color) {
  return color === WHITE ? BLACK : WHITE;
}

export function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function squareToCoords(square) {
  if (!square || square.length !== 2) return null;
  const col = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const row = BOARD_SIZE - rank;
  if (!isInsideBoard(row, col)) return null;
  return { row, col };
}

export function coordsToSquare(row, col) {
  if (!isInsideBoard(row, col)) return null;
  return `${FILES[col]}${BOARD_SIZE - row}`;
}

export function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

export function cloneState(state) {
  return {
    ...state,
    board: cloneBoard(state.board),
    castling: {
      w: { ...state.castling.w },
      b: { ...state.castling.b },
    },
    history: state.history.map((move) => ({ ...move })),
    captured: {
      w: [...state.captured.w],
      b: [...state.captured.b],
    },
    repetition: { ...state.repetition },
  };
}

export function getPiece(board, square) {
  const coords = squareToCoords(square);
  if (!coords) return null;
  return board[coords.row][coords.col];
}

export function setPiece(board, square, piece) {
  const coords = squareToCoords(square);
  if (!coords) return board;
  board[coords.row][coords.col] = piece ? { ...piece } : null;
  return board;
}

export function findKing(board, color) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece?.color === color && piece.type === PIECES.KING) {
        return coordsToSquare(row, col);
      }
    }
  }
  return null;
}

export function serializePositionKey(state) {
  const placement = boardToFenPlacement(state.board);
  const castling = castlingToFen(state.castling);
  return `${placement} ${state.turn} ${castling} ${state.enPassant ?? '-'}`;
}

export function boardToFenPlacement(board) {
  return board
    .map((row) => {
      let empty = 0;
      let output = '';
      row.forEach((piece) => {
        if (!piece) {
          empty += 1;
          return;
        }
        if (empty) {
          output += empty;
          empty = 0;
        }
        output += piece.color === WHITE ? piece.type.toUpperCase() : piece.type;
      });
      return output + (empty ? String(empty) : '');
    })
    .join('/');
}

export function castlingToFen(castling) {
  let rights = '';
  if (castling.w.k) rights += 'K';
  if (castling.w.q) rights += 'Q';
  if (castling.b.k) rights += 'k';
  if (castling.b.q) rights += 'q';
  return rights || '-';
}

export function formatClock(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function scoreResult(result, color) {
  if (result === '1/2-1/2') return 0.5;
  if (result === '1-0') return color === WHITE ? 1 : 0;
  if (result === '0-1') return color === BLACK ? 1 : 0;
  return 0;
}
