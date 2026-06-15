import { generateLegalMoves } from '../engine/MoveGenerator.js';
import { applyMoveToState } from '../engine/StateManager.js';
import { evaluateBoard } from './Evaluation.js';
import { orderMoves } from './MoveOrdering.js';

function alphaBeta(state, depth, alpha, beta, perspective) {
  if (depth === 0 || state.result) return evaluateBoard(state, perspective);

  const moves = orderMoves(generateLegalMoves(state, state.turn));
  if (moves.length === 0) return evaluateBoard(state, perspective);

  const maximizing = state.turn === perspective;
  let best = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const score = alphaBeta(applyMoveToState(state, move), depth - 1, alpha, beta, perspective);
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }

  return best;
}

export function getBestMove(state, depth = 2, perspective = state.turn) {
  const moves = orderMoves(generateLegalMoves(state, state.turn));
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const score = alphaBeta(applyMoveToState(state, move), depth - 1, -Infinity, Infinity, perspective);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
