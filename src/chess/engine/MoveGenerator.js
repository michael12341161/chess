import { Bishop } from '../pieces/Bishop.js';
import { King } from '../pieces/King.js';
import { Knight } from '../pieces/Knight.js';
import { Pawn } from '../pieces/Pawn.js';
import { Queen } from '../pieces/Queen.js';
import { Rook } from '../pieces/Rook.js';
import { getCastlingMove, moveCastlingRook } from '../rules/Castling.js';
import { getEnPassantCaptureSquare } from '../rules/EnPassant.js';
import { promotionMoves } from '../rules/Promotion.js';
import { BOARD_SIZE, PIECES } from '../../utils/constants.js';
import { cloneBoard, coordsToSquare, getPiece, isInsideBoard, opponent, setPiece, squareToCoords } from '../../utils/helpers.js';
import { isKingInCheck } from '../rules/CheckDetector.js';

function pushMove(moves, state, from, to, flags = []) {
  const piece = getPiece(state.board, from);
  const captured = getPiece(state.board, to);
  if (!piece) return;
  const move = { from, to, piece: { ...piece }, captured: captured ? { ...captured } : null, flags };
  promotionMoves(move).forEach((candidate) => moves.push(candidate));
}

function addSlidingMoves(moves, state, from, row, col, directions) {
  const piece = state.board[row][col];
  directions.forEach(([dr, dc]) => {
    let r = row + dr;
    let c = col + dc;
    while (isInsideBoard(r, c)) {
      const target = state.board[r][c];
      const to = coordsToSquare(r, c);
      if (!target) {
        pushMove(moves, state, from, to);
      } else {
        if (target.color !== piece.color) pushMove(moves, state, from, to, ['capture']);
        break;
      }
      r += dr;
      c += dc;
    }
  });
}

function addPawnMoves(moves, state, from, row, col) {
  const piece = state.board[row][col];
  const direction = Pawn.direction(piece.color);
  const oneRow = row + direction;
  const oneSquare = coordsToSquare(oneRow, col);

  if (isInsideBoard(oneRow, col) && !state.board[oneRow][col]) {
    pushMove(moves, state, from, oneSquare);
    const twoRow = row + direction * 2;
    if (row === Pawn.startRow(piece.color) && isInsideBoard(twoRow, col) && !state.board[twoRow][col]) {
      pushMove(moves, state, from, coordsToSquare(twoRow, col), ['double-pawn']);
    }
  }

  for (const dc of [-1, 1]) {
    const r = row + direction;
    const c = col + dc;
    if (!isInsideBoard(r, c)) continue;
    const to = coordsToSquare(r, c);
    const target = state.board[r][c];
    if (target && target.color !== piece.color) {
      pushMove(moves, state, from, to, ['capture']);
    } else if (state.enPassant === to) {
      moves.push({
        from,
        to,
        piece: { ...piece },
        captured: { type: PIECES.PAWN, color: opponent(piece.color) },
        flags: ['capture', 'en-passant'],
      });
    }
  }
}

function addKnightMoves(moves, state, from, row, col) {
  const piece = state.board[row][col];
  Knight.jumps.forEach(([dr, dc]) => {
    const r = row + dr;
    const c = col + dc;
    if (!isInsideBoard(r, c)) return;
    const target = state.board[r][c];
    if (!target || target.color !== piece.color) {
      pushMove(moves, state, from, coordsToSquare(r, c), target ? ['capture'] : []);
    }
  });
}

function addKingMoves(moves, state, from, row, col) {
  const piece = state.board[row][col];
  King.directions.forEach(([dr, dc]) => {
    const r = row + dr;
    const c = col + dc;
    if (!isInsideBoard(r, c)) return;
    const target = state.board[r][c];
    if (!target || target.color !== piece.color) {
      pushMove(moves, state, from, coordsToSquare(r, c), target ? ['capture'] : []);
    }
  });

  for (const side of ['k', 'q']) {
    const castlingMove = getCastlingMove(state, piece.color, side);
    if (castlingMove) moves.push(castlingMove);
  }
}

export function boardAfterMove(state, move) {
  const board = cloneBoard(state.board);
  const movingPiece = { ...move.piece, type: move.promotion ?? move.piece.type };
  const castlingSide = move.flags?.includes('castle-kingside') ? 'k' : move.flags?.includes('castle-queenside') ? 'q' : null;

  setPiece(board, move.from, null);
  if (move.flags?.includes('en-passant')) {
    setPiece(board, getEnPassantCaptureSquare(move), null);
  }
  setPiece(board, move.to, movingPiece);

  if (castlingSide) {
    moveCastlingRook(board, move.piece.color, castlingSide);
  }

  return board;
}

export function generatePseudoLegalMoves(state, color = state.turn) {
  const moves = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.color !== color) continue;
      const from = coordsToSquare(row, col);
      if (piece.type === PIECES.PAWN) addPawnMoves(moves, state, from, row, col);
      if (piece.type === PIECES.KNIGHT) addKnightMoves(moves, state, from, row, col);
      if (piece.type === PIECES.BISHOP) addSlidingMoves(moves, state, from, row, col, Bishop.directions);
      if (piece.type === PIECES.ROOK) addSlidingMoves(moves, state, from, row, col, Rook.directions);
      if (piece.type === PIECES.QUEEN) addSlidingMoves(moves, state, from, row, col, Queen.directions);
      if (piece.type === PIECES.KING) addKingMoves(moves, state, from, row, col);
    }
  }
  return moves;
}

export function generateLegalMoves(state, color = state.turn) {
  return generatePseudoLegalMoves(state, color).filter((move) => {
    const nextBoard = boardAfterMove(state, move);
    return !isKingInCheck(nextBoard, color);
  });
}

export function legalMovesForSquare(state, square) {
  return generateLegalMoves(state).filter((move) => move.from === square);
}

export function findMove(state, from, to, promotion) {
  const matches = generateLegalMoves(state).filter((move) => {
    if (move.from !== from || move.to !== to) return false;
    if (!move.promotion) return !promotion;
    return !promotion || move.promotion === promotion;
  });

  if (matches.length === 1) return matches[0];
  return matches.find((move) => move.promotion === promotion) ?? matches.find((move) => move.promotion === PIECES.QUEEN) ?? null;
}
