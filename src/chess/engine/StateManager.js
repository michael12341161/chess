import { boardAfterMove, findMove, generateLegalMoves } from './MoveGenerator.js';
import { detectDraw } from '../rules/DrawDetector.js';
import { getEnPassantCaptureSquare, getEnPassantTarget } from '../rules/EnPassant.js';
import { isKingInCheck } from '../rules/CheckDetector.js';
import { createInitialState, stateToFen } from '../../utils/fen.js';
import { BLACK, GAME_RESULTS, PIECES, WHITE } from '../../utils/constants.js';
import { cloneState, getPiece, opponent, serializePositionKey, setPiece } from '../../utils/helpers.js';
import { createSan, moveToLan } from '../../utils/notation.js';

function withRepetition(state) {
  const next = cloneState(state);
  const key = serializePositionKey(next);
  next.repetition = { ...next.repetition, [key]: (next.repetition[key] ?? 0) + 1 };
  return next;
}

export function createGameState(fen) {
  return withRepetition(createInitialState(fen));
}

function updateCastlingRights(state, move) {
  const rights = state.castling;
  if (move.piece.type === PIECES.KING) {
    rights[move.piece.color] = { k: false, q: false };
  }

  if (move.piece.type === PIECES.ROOK) {
    if (move.from === 'h1') rights.w.k = false;
    if (move.from === 'a1') rights.w.q = false;
    if (move.from === 'h8') rights.b.k = false;
    if (move.from === 'a8') rights.b.q = false;
  }

  if (move.captured?.type === PIECES.ROOK) {
    if (move.to === 'h1') rights.w.k = false;
    if (move.to === 'a1') rights.w.q = false;
    if (move.to === 'h8') rights.b.k = false;
    if (move.to === 'a8') rights.b.q = false;
  }
}

function applyBoardMutation(state, move) {
  state.board = boardAfterMove(state, move);
  if (move.flags?.includes('en-passant')) {
    setPiece(state.board, getEnPassantCaptureSquare(move), null);
  }
}

export function applyMoveToState(state, inputMove) {
  if (state.result) return state;
  const before = cloneState(state);
  const move = inputMove.piece ? inputMove : findMove(state, inputMove.from, inputMove.to, inputMove.promotion);
  if (!move) return state;

  const next = cloneState(state);
  const captured = move.flags?.includes('en-passant') ? move.captured : getPiece(next.board, move.to);

  applyBoardMutation(next, move);
  updateCastlingRights(next, { ...move, captured });

  if (captured) {
    next.captured[move.piece.color].push(captured);
  }

  next.enPassant = getEnPassantTarget(move);
  next.halfmoveClock = move.piece.type === PIECES.PAWN || captured ? 0 : next.halfmoveClock + 1;
  if (move.piece.color === BLACK) next.fullmoveNumber += 1;
  next.turn = opponent(next.turn);
  next.result = null;
  next.resultReason = null;

  const key = serializePositionKey(next);
  next.repetition = { ...next.repetition, [key]: (next.repetition[key] ?? 0) + 1 };

  const replies = generateLegalMoves(next, next.turn);
  const inCheckAfter = isKingInCheck(next.board, next.turn);
  if (replies.length === 0 && inCheckAfter) {
    next.result = next.turn === WHITE ? GAME_RESULTS.BLACK_WINS : GAME_RESULTS.WHITE_WINS;
    next.resultReason = 'checkmate';
  } else if (replies.length === 0) {
    next.result = GAME_RESULTS.DRAW;
    next.resultReason = 'stalemate';
  } else {
    const drawReason = detectDraw(next);
    if (drawReason) {
      next.result = GAME_RESULTS.DRAW;
      next.resultReason = drawReason;
    }
  }

  const enrichedMove = {
    ...move,
    captured,
    lan: moveToLan({ ...move, captured }),
    san: createSan({ ...move, captured }, next, replies.length, inCheckAfter),
    beforeFen: stateToFen(before),
    fen: stateToFen(next),
    moveNumber: before.fullmoveNumber,
  };

  next.history = [...next.history, enrichedMove];
  return next;
}

export function resign(state, color = state.turn) {
  return {
    ...cloneState(state),
    result: color === WHITE ? GAME_RESULTS.BLACK_WINS : GAME_RESULTS.WHITE_WINS,
    resultReason: 'resignation',
  };
}

export function drawByAgreement(state) {
  return {
    ...cloneState(state),
    result: GAME_RESULTS.DRAW,
    resultReason: 'agreement',
  };
}
