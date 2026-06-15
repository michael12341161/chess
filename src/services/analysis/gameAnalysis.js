import { getBestMove } from '../../chess/ai/AlphaBeta.js';
import { evaluateBoard } from '../../chess/ai/Evaluation.js';
import { findMove } from '../../chess/engine/MoveGenerator.js';
import { applyMoveToState, createGameState } from '../../chess/engine/StateManager.js';
import { BLACK, COLOR_NAMES, WHITE } from '../../utils/constants.js';
import { moveToUci } from '../../utils/notation.js';
import { StockfishEngine, stockfishAvailable } from './StockfishEngine.js';

const DEFAULT_LIMIT = 80;

function fenTurn(fen) {
  return fen?.split(/\s+/)[1] === BLACK ? BLACK : WHITE;
}

function toWhiteScore(scoreCp, fen) {
  return scoreCp * (fenTurn(fen) === WHITE ? 1 : -1);
}

function winningChance(scoreCpForWhite) {
  if (scoreCpForWhite >= 90000) return 100;
  if (scoreCpForWhite <= -90000) return 0;
  return Math.round((1 / (1 + Math.exp(-scoreCpForWhite / 380))) * 100);
}

function classifyLoss(lossCp) {
  if (lossCp >= 300) return 'blunder';
  if (lossCp >= 140) return 'mistake';
  if (lossCp >= 60) return 'inaccuracy';
  if (lossCp <= 15) return 'best';
  return 'good';
}

function phaseForMove(moveNumber) {
  if (moveNumber <= 10) return 'opening';
  if (moveNumber <= 30) return 'middlegame';
  return 'endgame';
}

function moveLabel(move) {
  return move?.san ?? move?.lan ?? moveToUci(move);
}

function bestMoveDetails(fen, uciMove) {
  if (!uciMove) return { bestMoveSan: null, bestMoveUci: null };
  const state = createGameState(fen);
  const move = findMove(state, uciMove.slice(0, 2), uciMove.slice(2, 4), uciMove[4]);
  if (!move) return { bestMoveSan: null, bestMoveUci: uciMove };
  const next = applyMoveToState(state, move);
  const enrichedMove = next.history.at(-1);
  return {
    bestMoveSan: moveLabel(enrichedMove),
    bestMoveUci: moveToUci(move),
  };
}

function localAnalyzeFen(fen, { depth = 2 } = {}) {
  const state = createGameState(fen);
  const bestMove = getBestMove(state, depth, state.turn);
  if (!bestMove) {
    return {
      engine: 'Built-in tactical engine',
      scoreCp: evaluateBoard(state, state.turn),
      mate: null,
      bestMove: null,
      pv: [],
    };
  }

  const next = applyMoveToState(state, bestMove);
  return {
    engine: 'Built-in tactical engine',
    scoreCp: evaluateBoard(next, state.turn),
    mate: null,
    bestMove: moveToUci(bestMove),
    pv: [moveToUci(bestMove)],
  };
}

async function createAnalyzer({ preferStockfish = true, movetime = 90, depth = 2 } = {}) {
  if (preferStockfish && stockfishAvailable()) {
    try {
      const engine = new StockfishEngine();
      await engine.init();
      return {
        engineName: 'Stockfish 18 Lite',
        analyzeFen: (fen) => engine.analyzeFen(fen, { movetime }),
        dispose: () => engine.dispose(),
      };
    } catch {
      // Fall through to the built-in evaluator if the worker or WASM fails.
    }
  }

  return {
    engineName: 'Built-in tactical engine',
    analyzeFen: async (fen) => localAnalyzeFen(fen, { depth }),
    dispose: () => {},
  };
}

function buildComment({ classification, lossCp, bestMoveSan, move, moveColor }) {
  if (classification === 'best') return `${moveLabel(move)} matches the engine recommendation.`;
  if (classification === 'good') return `${moveLabel(move)} keeps the position playable.`;

  const side = COLOR_NAMES[moveColor];
  const best = bestMoveSan ? ` ${bestMoveSan} was stronger.` : '';
  if (classification === 'blunder') return `${side} dropped a decisive chance by roughly ${(lossCp / 100).toFixed(1)} pawns.${best}`;
  if (classification === 'mistake') return `${side} lost clear value in this position.${best}`;
  return `${side} missed a more accurate continuation.${best}`;
}

function createSideSummary(moves, color) {
  const sideMoves = moves.filter((move) => move.color === color);
  const totalLoss = sideMoves.reduce((sum, move) => sum + move.lossCp, 0);
  const averageCentipawnLoss = Math.round(totalLoss / Math.max(1, sideMoves.length));
  return {
    accuracy: Math.max(0, Math.min(100, Math.round(100 - averageCentipawnLoss / 3))),
    averageCentipawnLoss,
    bestMoves: sideMoves.filter((move) => move.classification === 'best').length,
    inaccuracies: sideMoves.filter((move) => move.classification === 'inaccuracy').length,
    mistakes: sideMoves.filter((move) => move.classification === 'mistake').length,
    blunders: sideMoves.filter((move) => move.classification === 'blunder').length,
  };
}

function summarizeResult(state, criticalMoments) {
  if (state.result === '1/2-1/2') {
    return state.resultReason === 'stalemate'
      ? 'The game ended in stalemate after the side to move ran out of legal moves.'
      : 'The game ended in a draw after neither side converted a decisive advantage.';
  }

  if (state.resultReason === 'checkmate') {
    return 'The winning side converted the final attack into checkmate, leaving the king with no legal escape.';
  }

  const largestSwing = criticalMoments[0];
  if (largestSwing) {
    return `${COLOR_NAMES[largestSwing.color]} had the key turning point on move ${largestSwing.moveNumber}. The engine preferred ${largestSwing.bestMove ?? 'a stronger continuation'}.`;
  }

  return 'The result was decided by steady pressure and cleaner move quality across the game.';
}

export async function analyzeCompletedGame(state, options = {}) {
  if (!state?.result || state.history.length === 0) {
    return null;
  }

  const limit = options.limit ?? DEFAULT_LIMIT;
  const moves = state.history.slice(0, limit);
  const analyzer = await createAnalyzer(options);
  const startedAt = performance.now();

  try {
    const analyzedMoves = [];

    for (let index = 0; index < moves.length; index += 1) {
      const move = moves[index];
      const beforeFen = move.beforeFen;
      const afterFen = move.fen;
      const moveColor = move.piece?.color ?? fenTurn(beforeFen);
      const moveNumber = move.moveNumber ?? Math.floor(index / 2) + 1;

      const before = await analyzer.analyzeFen(beforeFen);
      const after = await analyzer.analyzeFen(afterFen);

      const bestScoreForMover = before.scoreCp;
      const actualScoreForMover = -after.scoreCp;
      const lossCp = Math.max(0, Math.round(bestScoreForMover - actualScoreForMover));
      const classification = classifyLoss(lossCp);
      const bestDetails = bestMoveDetails(beforeFen, before.bestMove);
      const scoreCpForWhite = toWhiteScore(after.scoreCp, afterFen);
      const currentMoveUci = moveToUci(move);
      const missedOpportunity = Boolean(bestDetails.bestMoveUci && bestDetails.bestMoveUci !== currentMoveUci && lossCp >= 60);

      analyzedMoves.push({
        ply: index + 1,
        moveNumber,
        color: moveColor,
        san: moveLabel(move),
        uci: currentMoveUci,
        phase: phaseForMove(moveNumber),
        classification,
        lossCp,
        evaluationCp: Math.round(scoreCpForWhite),
        winningChance: winningChance(scoreCpForWhite),
        bestMove: bestDetails.bestMoveSan,
        bestMoveUci: bestDetails.bestMoveUci,
        pv: before.pv?.slice(0, 5) ?? [],
        missedOpportunity,
        comment: buildComment({ classification, lossCp, bestMoveSan: bestDetails.bestMoveSan, move, moveColor }),
      });

      if (options.onProgress) options.onProgress({ done: index + 1, total: moves.length });
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    const counts = analyzedMoves.reduce(
      (acc, move) => {
        acc[move.classification] = (acc[move.classification] ?? 0) + 1;
        if (move.missedOpportunity) acc.missedOpportunities += 1;
        acc.totalLoss += move.lossCp;
        return acc;
      },
      { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, missedOpportunities: 0, totalLoss: 0 },
    );

    const averageCentipawnLoss = Math.round(counts.totalLoss / Math.max(1, analyzedMoves.length));
    const accuracy = Math.max(0, Math.min(100, Math.round(100 - averageCentipawnLoss / 3)));
    const criticalMoments = [...analyzedMoves]
      .filter((move) => ['inaccuracy', 'mistake', 'blunder'].includes(move.classification))
      .sort((a, b) => b.lossCp - a.lossCp)
      .slice(0, 5);
    const bestMovesBySide = {
      [WHITE]: analyzedMoves.filter((move) => move.color === WHITE && move.classification === 'best').slice(0, 5),
      [BLACK]: analyzedMoves.filter((move) => move.color === BLACK && move.classification === 'best').slice(0, 5),
    };

    return {
      engine: analyzer.engineName,
      generatedAt: new Date().toISOString(),
      analyzedPlyCount: analyzedMoves.length,
      totalPlyCount: state.history.length,
      durationMs: Math.round(performance.now() - startedAt),
      summary: {
        accuracy,
        averageCentipawnLoss,
        bestMoves: counts.best,
        goodMoves: counts.good,
        inaccuracies: counts.inaccuracy,
        mistakes: counts.mistake,
        blunders: counts.blunder,
        missedOpportunities: counts.missedOpportunities,
        byColor: {
          [WHITE]: createSideSummary(analyzedMoves, WHITE),
          [BLACK]: createSideSummary(analyzedMoves, BLACK),
        },
        resultSummary: summarizeResult(state, criticalMoments),
      },
      criticalMoments,
      bestMovesBySide,
      moves: analyzedMoves,
    };
  } finally {
    analyzer.dispose();
  }
}
