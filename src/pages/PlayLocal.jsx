import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import CapturedPieces from '../components/CapturedPieces.jsx';
import ChessBoard from '../components/ChessBoard.jsx';
import ChessClock from '../components/ChessClock.jsx';
import EndgameModal from '../components/EndgameModal.jsx';
import GameControls from '../components/GameControls.jsx';
import MoveHistory from '../components/MoveHistory.jsx';
import PromotionModal from '../components/PromotionModal.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import { useChess } from '../hooks/useChess.js';
import { useClock } from '../hooks/useClock.js';
import { useSettingsStore } from '../store/settingsStore.js';
import { saveLocalGame } from '../store/gameStore.js';
import { STORAGE_KEYS, WHITE } from '../utils/constants.js';
import { getElapsedSeconds } from '../utils/gameSummary.js';

export default function PlayLocal() {
  const { settings, updateSettings } = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chess = useChess(undefined, { autoQueen: settings.autoQueen });
  const clock = useClock({
    initialMinutes: settings.clockMinutes,
    incrementSeconds: settings.incrementSeconds,
    turn: chess.state.turn,
    result: chess.state.result,
  });

  const resetGame = () => {
    chess.reset();
    clock.reset(WHITE);
  };

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEYS.RESUME_GAME) ?? sessionStorage.getItem('resume-game');
    if (raw) {
      const saved = JSON.parse(raw);
      chess.loadState(saved.state);
      sessionStorage.removeItem(STORAGE_KEYS.RESUME_GAME);
      sessionStorage.removeItem('resume-game');
      toast.success('Game resumed');
    }
  }, [chess.loadState]);

  const save = () => {
    saveLocalGame(chess.state, { mode: 'local', fen: chess.fen, pgn: chess.pgn, title: 'Local match' });
    toast.success('Game saved');
  };

  return (
    <div className="play-layout animated-play-background">
      <section className="game-stage">
        <div className="section-title">
          <div>
            <h1>Local Match</h1>
            <p>{chess.state.result ? `${chess.state.result} ${chess.state.resultReason}` : `${chess.state.turn === 'w' ? 'White' : 'Black'} to move`}</p>
          </div>
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
        <ChessClock times={clock.times} turn={chess.state.turn} result={chess.state.result} />
        <GameControls
          onSave={save}
          onUndo={chess.undo}
          onReset={resetGame}
          onFlip={() => updateSettings({ flipped: !settings.flipped })}
          onDraw={chess.agreeDraw}
          onResign={() => chess.resign(chess.state.turn)}
          onSettings={() => setSettingsOpen(true)}
        />
        <CapturedPieces captured={chess.state.captured} />
        <MoveHistory moves={chess.state.history} />
      </aside>
      <PromotionModal color={chess.state.turn} open={Boolean(chess.pendingPromotion)} onSelect={chess.promote} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <EndgameModal
        open={Boolean(chess.state.result)}
        state={chess.state}
        durationSeconds={getElapsedSeconds(clock.times, settings.clockMinutes)}
        onRematch={resetGame}
        onNewGame={resetGame}
      />
    </div>
  );
}
