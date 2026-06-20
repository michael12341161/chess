import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import GameAnalysisBoard from '../components/GameAnalysisBoard.jsx';
import { COLOR_NAMES, STORAGE_KEYS } from '../utils/constants.js';
import { formatDuration, getWinnerColor } from '../utils/gameSummary.js';

const REASON_LABELS = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  agreement: 'Draw agreed',
  resignation: 'Resignation',
  timeout: 'Timeout',
  'threefold repetition': 'Threefold repetition',
  'fifty-move rule': 'Fifty-move rule',
  'insufficient material': 'Insufficient material',
};

function readAnalysisGame(locationState) {
  if (locationState?.state?.result) return locationState;

  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEYS.ANALYSIS_GAME) ?? 'null');
  } catch {
    return null;
  }
}

export default function GameAnalysis() {
  const location = useLocation();
  const navigate = useNavigate();
  const analysisGame = readAnalysisGame(location.state);
  const state = analysisGame?.state ?? null;
  const durationSeconds = analysisGame?.durationSeconds ?? 0;
  const winnerColor = state ? getWinnerColor(state) : null;
  const reason = state ? (REASON_LABELS[state.resultReason] ?? 'Game over') : 'No completed game selected';

  return (
    <div className="content-grid analysis-page">
      <section className="panel full-panel analysis-page-header">
        <div className="section-title">
          <div className="game-title-block">
            <h1>Analysis Board</h1>
            <p className="game-status-line">{state ? `${reason} · ${winnerColor ? `${COLOR_NAMES[winnerColor]} wins` : 'Game drawn'}` : reason}</p>
          </div>
          <div className="analysis-page-actions">
            <button type="button" className="icon-button" onClick={() => navigate(-1)} title="Back">
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <button type="button" className="icon-button" onClick={() => navigate('/history')} title="History">
              <History size={18} />
              <span>History</span>
            </button>
          </div>
        </div>

        {state ? (
          <div className="result-quick-stats analysis-page-stats" aria-label="Game summary">
            <span>
              Moves
              <strong>{state.history.length}</strong>
            </span>
            <span>
              Time
              <strong>{formatDuration(durationSeconds)}</strong>
            </span>
            <span className={winnerColor ? 'winner-stat' : ''}>
              Winner
              <strong>{winnerColor ? COLOR_NAMES[winnerColor] : 'Draw'}</strong>
            </span>
          </div>
        ) : null}
      </section>

      {state ? (
        <GameAnalysisBoard key={state.history.at(-1)?.fen ?? state.result} state={state} />
      ) : (
        <section className="panel full-panel">
          <p className="muted">Finish a game, then choose Analysis Board from the result dialog.</p>
        </section>
      )}
    </div>
  );
}
