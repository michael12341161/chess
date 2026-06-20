import { useCallback, useEffect, useReducer } from 'react';
import { getBestMove } from '../chess/ai/AlphaBeta.js';
import { getDifficulty } from '../chess/ai/DifficultyManager.js';
import { findMove, generateLegalMoves } from '../chess/engine/MoveGenerator.js';
import { StockfishEngine, stockfishAvailable } from '../services/analysis/StockfishEngine.js';
import { stateToFen } from '../utils/fen.js';

function moveFromUci(state, uciMove) {
  if (!uciMove || uciMove.length < 4) return null;
  return findMove(state, uciMove.slice(0, 2), uciMove.slice(2, 4), uciMove[4]);
}

function engineReducer(state, action) {
  switch (action.type) {
    case 'dispose':
      if (state.engine && state.engine !== action.skipEngine) state.engine.dispose();
      return { engine: null, ready: false };
    case 'init':
      return { ...state, engine: action.engine, ready: false };
    case 'ready':
      return { ...state, ready: true };
    case 'failed':
      if (state.engine === action.engine) action.engine.dispose();
      return { engine: null, ready: false };
    default:
      return state;
  }
}

export function useAI(difficultyName = 'casual') {
  const difficulty = getDifficulty(difficultyName);
  const [engineState, dispatch] = useReducer(engineReducer, { engine: null, ready: false });

  useEffect(() => {
    let cancelled = false;

    if (!difficulty.stockfish || !stockfishAvailable()) {
      dispatch({ type: 'dispose', skipEngine: null });
      return undefined;
    }

    const engine = new StockfishEngine({ timeoutMs: Math.max(3500, difficulty.movetime + 2500) });
    dispatch({ type: 'init', engine });
    engine.init()
      .then(() => {
        if (!cancelled) dispatch({ type: 'ready' });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'failed', engine });
      });

    return () => {
      cancelled = true;
      dispatch({ type: 'dispose', skipEngine: engine });
      engine.dispose();
    };
  }, [difficulty.stockfish, difficulty.movetime]);

  const chooseMove = useCallback(
    async (state) => {
      const difficulty = getDifficulty(difficultyName);
      const legalMoves = generateLegalMoves(state, state.turn);
      if (legalMoves.length === 0) return null;
      if (Math.random() < difficulty.random) {
        return legalMoves[Math.floor(Math.random() * legalMoves.length)];
      }

      if (difficulty.stockfish && engineState.ready && engineState.engine) {
        try {
          const result = await engineState.engine.analyzeFen(stateToFen(state), { movetime: difficulty.movetime });
          const stockfishMove = moveFromUci(state, result.bestMove);
          if (stockfishMove) return stockfishMove;
        } catch {
          // Fall back to the local search when the worker is busy or unavailable.
        }
      }

      return getBestMove(state, difficulty.depth, state.turn);
    },
    [difficultyName, engineState.engine, engineState.ready],
  );

  return {
    chooseMove,
    difficulty: {
      ...difficulty,
      engineReady: !difficulty.stockfish || engineState.ready,
      engineName: difficulty.stockfish && engineState.ready ? 'Stockfish 18 Lite' : 'Built-in tactical engine',
    },
  };
}
