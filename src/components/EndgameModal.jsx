import { useNavigate } from 'react-router-dom';
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

export default function EndgameModal({
  open,
  state,
  durationSeconds,
  onNewGame,
  onRematch,
}) {
  const navigate = useNavigate();

  if (!open || !state?.result) return null;

  const winnerColor = getWinnerColor(state);
  const winnerText = winnerColor ? `${COLOR_NAMES[winnerColor]} is victorious` : 'Game drawn';
  const reason = REASON_LABELS[state.resultReason] ?? 'Game over';

  const openAnalysisPage = () => {
    const analysisGame = { state, durationSeconds };
    sessionStorage.setItem(STORAGE_KEYS.ANALYSIS_GAME, JSON.stringify(analysisGame));
    navigate('/analysis', { state: analysisGame });
  };

  return (
    <div className="modal-backdrop result-backdrop" role="presentation">
      <div
        className={`result-card ${winnerColor ? 'decisive-result' : 'draw-result'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Game result"
      >
        <header className="result-header">
          <strong>{state.result}</strong>
          <p>{reason} &bull; {winnerText}</p>
        </header>

        <div className="result-quick-stats" aria-label="Game summary">
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

        <div className="result-action-stack">
          <button type="button" className="result-action-button result-action-primary" onClick={onRematch}>
            REMATCH
          </button>
          <button type="button" className="result-action-button" onClick={onNewGame}>
            NEW OPPONENT
          </button>
          <button type="button" className="result-action-button" onClick={openAnalysisPage}>
            ANALYSIS BOARD
          </button>
        </div>
      </div>
    </div>
  );
}
