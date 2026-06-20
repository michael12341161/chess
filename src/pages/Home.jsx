import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bot, Handshake, Save, Users } from 'lucide-react';
import ChessBoard from '../components/ChessBoard.jsx';
import EndgameModal from '../components/EndgameModal.jsx';
import MoveHistory from '../components/MoveHistory.jsx';
import PromotionModal from '../components/PromotionModal.jsx';
import { useChess } from '../hooks/useChess.js';
import { useSettingsStore } from '../store/settingsStore.js';
import { saveLocalGame } from '../store/gameStore.js';

export default function Home() {
  const { settings } = useSettingsStore();
  const chess = useChess(undefined, { autoQueen: settings.autoQueen });

  const save = () => {
    saveLocalGame(chess.state, { mode: 'home', fen: chess.fen, pgn: chess.pgn, title: 'Home board' });
    toast.success('Game saved');
  };

  return (
    <div className="home-grid">
      <section className="game-stage">
        <div className="section-title">
          <div>
            <h1>Play Chess</h1>
            <p>{chess.state.result ? `${chess.state.result} ${chess.state.resultReason}` : `${chess.state.turn === 'w' ? 'White' : 'Black'} to move`}</p>
          </div>
          <button type="button" className="icon-button primary-button" onClick={save}>
            <Save size={18} />
            <span>Save</span>
          </button>
        </div>
        <ChessBoard
          state={chess.state}
          selectedSquare={chess.selectedSquare}
          selectedMoves={settings.legalMoveHints ? chess.selectedMoves : []}
          legalTargets={settings.legalMoveHints ? chess.legalTargets : []}
          onSquareClick={chess.onSquareClick}
          flipped={settings.flipped}
        />
      </section>
      <aside className="side-stack">
        <section className="panel action-panel">
          <Link className="action-link" to="/play-ai">
            <Bot size={20} />
            <span>Play AI</span>
          </Link>
          <Link className="action-link" to="/play-local">
            <Users size={20} />
            <span>Local Match</span>
          </Link>
          <Link className="action-link" to="/challenge-friend">
            <Handshake size={20} />
            <span>Online Challenges</span>
          </Link>
        </section>
        <MoveHistory moves={chess.state.history} />
      </aside>
      <PromotionModal color={chess.state.turn} open={Boolean(chess.pendingPromotion)} onSelect={chess.promote} />
      <EndgameModal
        open={Boolean(chess.state.result)}
        state={chess.state}
        durationSeconds={0}
        onRematch={() => chess.reset()}
        onNewGame={() => chess.reset()}
      />
    </div>
  );
}
