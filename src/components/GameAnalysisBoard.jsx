import { useEffect, useState } from 'react';
import ChessBoard from './ChessBoard.jsx';
import { createGameState } from '../chess/engine/StateManager.js';
import { useGameAnalysis } from '../hooks/useGameAnalysis.js';

function formatEval(scoreCp) {
  if (typeof scoreCp !== 'number') return '0.0';
  if (Math.abs(scoreCp) >= 90000) return scoreCp > 0 ? 'Mate' : '-Mate';
  const pawns = scoreCp / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

function isTeachingMove(move) {
  return ['inaccuracy', 'mistake', 'blunder'].includes(move?.classification);
}

function moveArrowFromUci(uciMove, type) {
  if (!uciMove || uciMove.length < 4) return null;
  return {
    from: uciMove.slice(0, 2),
    to: uciMove.slice(2, 4),
    type,
  };
}

function clampReviewIndex(index, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(index, total - 1));
}

export default function GameAnalysisBoard({ state }) {
  const [reviewIndex, setReviewIndex] = useState(0);
  const analysis = useGameAnalysis(state?.result ? state : null, {
    preferStockfish: true,
    movetime: 220,
    depth: 4,
    limit: 120,
  });

  useEffect(() => {
    setReviewIndex(0);
  }, [state]);

  useEffect(() => {
    if (analysis.status !== 'ready' || !analysis.report?.moves?.length) return;
    const firstMistakeIndex = analysis.report.moves.findIndex((move) => isTeachingMove(move));
    setReviewIndex(firstMistakeIndex >= 0 ? firstMistakeIndex : analysis.report.moves.length - 1);
  }, [analysis.status, analysis.report]);

  if (!state?.result) {
    return (
      <section className="panel full-panel">
        <p className="analysis-summary">Open analysis after a completed game.</p>
      </section>
    );
  }

  const analyzedMoves = analysis.report?.moves ?? [];
  const safeReviewIndex = clampReviewIndex(reviewIndex, analyzedMoves.length);
  const reviewedMove = analyzedMoves[safeReviewIndex] ?? null;
  const reviewedHistoryMove = reviewedMove ? state.history[reviewedMove.ply - 1] : null;
  const reviewedFen = reviewedHistoryMove?.fen ?? state.history.at(-1)?.fen;
  const reviewedState = reviewedFen ? createGameState(reviewedFen) : state;
  const actualArrow = reviewedHistoryMove ? { from: reviewedHistoryMove.from, to: reviewedHistoryMove.to, type: 'actual' } : null;
  const bestArrow = reviewedMove?.bestMoveUci && reviewedMove.bestMoveUci !== reviewedMove.uci ? moveArrowFromUci(reviewedMove.bestMoveUci, 'best') : null;
  const reviewArrows = [actualArrow, bestArrow].filter(Boolean);
  const whiteEvalPercent = typeof reviewedMove?.winningChance === 'number' ? reviewedMove.winningChance : 50;
  const criticalMoments = analysis.report?.criticalMoments?.slice(0, 5) ?? [];

  return (
    <section className="panel game-analysis-board" aria-label="Analysis board">
      {analysis.status === 'idle' ? (
        <p className="analysis-summary">Preparing the analysis board.</p>
      ) : null}

      {analysis.status === 'analyzing' ? (
        <>
          <div className="analysis-board-heading">
            <strong>Super Engine Analysis</strong>
            <span>{analysis.progress.done}/{analysis.progress.total}</span>
          </div>
          <div className="analysis-progress">
            <span style={{ width: `${analysis.progress.total ? (analysis.progress.done / analysis.progress.total) * 100 : 0}%` }} />
          </div>
        </>
      ) : null}

      {analysis.status === 'ready' && analysis.report ? (
        <>
          <div className="analysis-board-heading">
            <strong>{analysis.report.engine}</strong>
            <span>{analysis.report.summary.accuracy}% accuracy</span>
          </div>
          <div className="analysis-score-grid">
            <span>
              Avg loss
              <strong>{analysis.report.summary.averageCentipawnLoss} cp</strong>
            </span>
            <span>
              Blunders
              <strong>{analysis.report.summary.blunders}</strong>
            </span>
            <span>
              Final eval
              <strong>{formatEval(analysis.report.moves.at(-1)?.evaluationCp)}</strong>
            </span>
          </div>
          <p className="analysis-summary">{analysis.report.summary.resultSummary}</p>

          {reviewedMove ? (
            <div className="analysis-review">
              <div className="review-board-wrap">
                <div className="evaluation-bar" aria-label={`Evaluation ${formatEval(reviewedMove.evaluationCp)}`}>
                  <span className="eval-label eval-label-black">Black</span>
                  <span className="eval-fill-white" style={{ height: `${whiteEvalPercent}%` }} />
                  <strong>{formatEval(reviewedMove.evaluationCp)}</strong>
                  <span className="eval-label eval-label-white">White</span>
                </div>
                <div className="review-board-shell">
                  <ChessBoard state={reviewedState} arrows={reviewArrows} />
                </div>
              </div>

              <div className="review-panel">
                <div className="review-controls">
                  <button type="button" className="review-nav-button" onClick={() => setReviewIndex((value) => clampReviewIndex(value - 1, analyzedMoves.length))}>
                    PREV
                  </button>
                  <span>{safeReviewIndex + 1}/{analyzedMoves.length}</span>
                  <button type="button" className="review-nav-button" onClick={() => setReviewIndex((value) => clampReviewIndex(value + 1, analyzedMoves.length))}>
                    NEXT
                  </button>
                </div>

                <div className={`move-guide ${isTeachingMove(reviewedMove) ? 'move-guide-warning' : ''}`}>
                  <strong>{reviewedMove.moveNumber}. {reviewedMove.san} &bull; {reviewedMove.classification}</strong>
                  <p>{reviewedMove.comment}</p>
                  {isTeachingMove(reviewedMove) && reviewedMove.bestMove ? (
                    <p><b>Correct move:</b> {reviewedMove.bestMove}. Follow the green arrow; the orange arrow is the move played.</p>
                  ) : (
                    <p>The orange arrow shows the reviewed move. Use next and previous to replay the game.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="critical-list">
            {criticalMoments.length ? (
              criticalMoments.map((move) => (
                <button type="button" className="critical-row" key={`${move.ply}-${move.uci}`} onClick={() => setReviewIndex(move.ply - 1)}>
                  <span>{move.moveNumber}. {move.san}</span>
                  <strong>{move.classification}</strong>
                  <small>{move.bestMove ? `Best: ${move.bestMove}` : 'Engine line held'}</small>
                </button>
              ))
            ) : (
              <p className="muted">No major mistakes found in the analyzed moves.</p>
            )}
          </div>
        </>
      ) : null}

      {analysis.status === 'ready' && !analysis.report ? (
        <p className="analysis-summary">No move list is available for engine analysis.</p>
      ) : null}

      {analysis.status === 'error' ? (
        <p className="analysis-summary">Analysis is unavailable right now. Try another completed game or reload the board.</p>
      ) : null}
    </section>
  );
}
