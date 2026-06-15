import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import CapturedPieces from '../components/CapturedPieces.jsx';
import ChessBoard from '../components/ChessBoard.jsx';
import ChessClock from '../components/ChessClock.jsx';
import EndgameModal from '../components/EndgameModal.jsx';
import GameControls from '../components/GameControls.jsx';
import MoveHistory from '../components/MoveHistory.jsx';
import PromotionModal from '../components/PromotionModal.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import { gameConfig } from '../config/gameConfig.js';
import { useAI } from '../hooks/useAI.js';
import { useChess } from '../hooks/useChess.js';
import { useClock } from '../hooks/useClock.js';
import { useSettingsStore } from '../store/settingsStore.js';
import { saveLocalGame } from '../store/gameStore.js';
import { BLACK, WHITE } from '../utils/constants.js';
import { getElapsedSeconds } from '../utils/gameSummary.js';

export default function PlayAI() {
  const { settings, updateSettings } = useSettingsStore();
  const [difficulty, setDifficulty] = useState('casual');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const chess = useChess(undefined, { autoQueen: settings.autoQueen });
  const ai = useAI(difficulty);
  const clock = useClock({
    initialMinutes: settings.clockMinutes,
    incrementSeconds: settings.incrementSeconds,
    turn: chess.state.turn,
    result: chess.state.result,
    paused: !gameStarted,
  });

  const resetGame = () => {
    chess.reset();
    clock.reset(WHITE);
    setGameStarted(false);
  };

  const toggleGameClock = () => {
    if (chess.state.result) return;
    setGameStarted((value) => !value);
  };

  useEffect(() => {
    if (!gameStarted || chess.state.turn !== BLACK || chess.state.result) return undefined;
    let cancelled = false;
    const stateAtRequest = chess.state;
    const timer = window.setTimeout(() => {
      ai.chooseMove(stateAtRequest).then((move) => {
        const currentState = chess.engine.getState();
        if (cancelled || !move || currentState.result || currentState.turn !== BLACK) return;
        if (currentState.history.length !== stateAtRequest.history.length) return;
        chess.moveObject(move);
      });
    }, gameConfig.aiMoveDelayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ai.chooseMove, chess.engine, chess.state, chess.moveObject, gameStarted]);

  const save = () => {
    saveLocalGame(chess.state, { mode: 'ai', fen: chess.fen, pgn: chess.pgn, title: `AI ${ai.difficulty.label}` });
    toast.success('Game saved');
  };

  const statusText = chess.state.result
    ? `${chess.state.result} ${chess.state.resultReason}`
    : !gameStarted
      ? chess.state.history.length > 0
        ? 'Paused'
        : 'Press Play to start'
      : chess.state.turn === BLACK
        ? `${ai.difficulty.label} is thinking with ${ai.difficulty.engineName}`
        : 'White to move';
  const boardLocked = !gameStarted || chess.state.turn === BLACK || Boolean(chess.state.result);

  return (
    <div className="play-layout animated-play-background">
      <section className="game-stage">
        <div className="section-title">
          <div className="game-title-block">
            <h1>Play AI</h1>
            <p className="game-status-line">{statusText}</p>
          </div>
          <div className="game-title-actions">
            <button
              type="button"
              className={`icon-button play-toggle-button ${gameStarted ? '' : 'primary-button'}`}
              onClick={toggleGameClock}
              disabled={Boolean(chess.state.result)}
              title={gameStarted ? 'Pause clock' : 'Play'}
            >
              {gameStarted ? <Pause size={18} /> : <Play size={18} />}
              <span>{gameStarted ? 'Pause' : 'Play'}</span>
            </button>
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} aria-label="Difficulty">
              <option value="beginner">Beginner</option>
              <option value="casual">Casual</option>
              <option value="club">Club</option>
              <option value="tournament">Tournament</option>
              <option value="superExtreme">Super Extreme</option>
            </select>
          </div>
        </div>
        <ChessBoard
          state={chess.state}
          selectedSquare={chess.selectedSquare}
          selectedMoves={settings.legalMoveHints ? chess.selectedMoves : []}
          legalTargets={settings.legalMoveHints ? chess.legalTargets : []}
          onSquareClick={boardLocked ? undefined : chess.onSquareClick}
          flipped={settings.flipped}
        />
      </section>
      <aside className="side-stack">
        <ChessClock times={clock.times} turn={chess.state.turn} result={chess.state.result} paused={!gameStarted} />
        <GameControls
          onSave={save}
          onUndo={chess.undo}
          onReset={resetGame}
          onFlip={() => updateSettings({ flipped: !settings.flipped })}
          onDraw={chess.agreeDraw}
          onResign={() => chess.resign('w')}
          onSettings={() => setSettingsOpen(true)}
        />
        <CapturedPieces captured={chess.state.captured} />
        <MoveHistory moves={chess.state.history} />
      </aside>
      <PromotionModal color="w" open={Boolean(chess.pendingPromotion)} onSelect={chess.promote} />
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
