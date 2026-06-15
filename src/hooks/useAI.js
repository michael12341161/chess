import { useCallback, useEffect, useRef, useState } from 'react';
import { getBestMove } from '../chess/ai/AlphaBeta.js';
import { getDifficulty } from '../chess/ai/DifficultyManager.js';
import { findMove, generateLegalMoves } from '../chess/engine/MoveGenerator.js';
import { StockfishEngine, stockfishAvailable } from '../services/analysis/StockfishEngine.js';
import { stateToFen } from '../utils/fen.js';

function moveFromUci(state, uciMove) {
  if (!uciMove || uciMove.length < 4) return null;
  return findMove(state, uciMove.slice(0, 2), uciMove.slice(2, 4), uciMove[4]);
}

export function useAI(difficultyName = 'casual') {
  const difficulty = getDifficulty(difficultyName);
  const engineRef = useRef(null);
  const [engineReady, setEngineReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEngineReady(false);

    if (!difficulty.stockfish || !stockfishAvailable()) {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      return undefined;
    }

    const engine = new StockfishEngine({ timeoutMs: Math.max(3500, difficulty.movetime + 2500) });
    engineRef.current = engine;
    engine.init()
      .then(() => {
        if (!cancelled) setEngineReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          engine.dispose();
          if (engineRef.current === engine) engineRef.current = null;
          setEngineReady(false);
        }
      });

    return () => {
      cancelled = true;
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
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

      if (difficulty.stockfish && engineReady && engineRef.current) {
        try {
          const result = await engineRef.current.analyzeFen(stateToFen(state), { movetime: difficulty.movetime });
          const stockfishMove = moveFromUci(state, result.bestMove);
          if (stockfishMove) return stockfishMove;
        } catch {
          // Fall back to the local search when the worker is busy or unavailable.
        }
      }

      return getBestMove(state, difficulty.depth, state.turn);
    },
    [difficultyName, engineReady],
  );

  return {
    chooseMove,
    difficulty: {
      ...difficulty,
      engineReady: !difficulty.stockfish || engineReady,
      engineName: difficulty.stockfish && engineReady ? 'Stockfish 18 Lite' : 'Built-in tactical engine',
    },
  };
}
