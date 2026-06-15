import { BLACK, WHITE } from '../../utils/constants.js';
import { getPiece, opponent } from '../../utils/helpers.js';
import { isSquareAttacked } from './CheckDetector.js';

export const CASTLING_PATHS = {
  [WHITE]: {
    k: {
      kingFrom: 'e1',
      kingTo: 'g1',
      rookFrom: 'h1',
      rookTo: 'f1',
      empty: ['f1', 'g1'],
      safe: ['e1', 'f1', 'g1'],
      flag: 'castle-kingside',
    },
    q: {
      kingFrom: 'e1',
      kingTo: 'c1',
      rookFrom: 'a1',
      rookTo: 'd1',
      empty: ['d1', 'c1', 'b1'],
      safe: ['e1', 'd1', 'c1'],
      flag: 'castle-queenside',
    },
  },
  [BLACK]: {
    k: {
      kingFrom: 'e8',
      kingTo: 'g8',
      rookFrom: 'h8',
      rookTo: 'f8',
      empty: ['f8', 'g8'],
      safe: ['e8', 'f8', 'g8'],
      flag: 'castle-kingside',
    },
    q: {
      kingFrom: 'e8',
      kingTo: 'c8',
      rookFrom: 'a8',
      rookTo: 'd8',
      empty: ['d8', 'c8', 'b8'],
      safe: ['e8', 'd8', 'c8'],
      flag: 'castle-queenside',
    },
  },
};

export function canCastle(state, color, side) {
  const path = CASTLING_PATHS[color]?.[side];
  if (!path || !state.castling[color][side]) return false;

  const king = getPiece(state.board, path.kingFrom);
  const rook = getPiece(state.board, path.rookFrom);
  if (king?.type !== 'k' || king.color !== color) return false;
  if (rook?.type !== 'r' || rook.color !== color) return false;

  const clear = path.empty.every((square) => !getPiece(state.board, square));
  if (!clear) return false;

  return path.safe.every((square) => !isSquareAttacked(state.board, square, opponent(color)));
}

export function getCastlingMove(state, color, side) {
  if (!canCastle(state, color, side)) return null;
  const path = CASTLING_PATHS[color][side];
  return {
    from: path.kingFrom,
    to: path.kingTo,
    piece: { type: 'k', color },
    captured: null,
    flags: ['castle', path.flag],
  };
}

export function moveCastlingRook(board, color, side) {
  const path = CASTLING_PATHS[color][side];
  const rook = getPiece(board, path.rookFrom);
  board[path.rookTo[1] === '1' ? 7 : 0][path.rookTo.charCodeAt(0) - 97] = rook;
  board[path.rookFrom[1] === '1' ? 7 : 0][path.rookFrom.charCodeAt(0) - 97] = null;
}
