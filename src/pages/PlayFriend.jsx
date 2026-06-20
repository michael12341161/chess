import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Flag, Handshake, RefreshCw, RotateCcw, Settings } from 'lucide-react';
import CapturedPieces from '../components/CapturedPieces.jsx';
import ChessBoard from '../components/ChessBoard.jsx';
import MoveHistory from '../components/MoveHistory.jsx';
import PromotionModal from '../components/PromotionModal.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import { useChess } from '../hooks/useChess.js';
import { isSupabaseConfigured } from '../config/supabase.js';
import { applyRankedGameResult, loadGame, saveGame } from '../services/supabase/games.js';
import { subscribeToGame } from '../services/supabase/realtime.js';
import { listProfilesByIds } from '../services/supabase/profiles.js';
import { useAuthStore } from '../store/authStore.js';
import { useLeaderboardStore } from '../store/leaderboardStore.js';
import { useSettingsStore } from '../store/settingsStore.js';
import { BLACK, COLOR_NAMES, INITIAL_FEN, WHITE } from '../utils/constants.js';
import { formatRankingPoints, getRankTitle } from '../utils/ranking.js';

function stateKey(state, fen) {
  return `${state.history.length}|${fen}|${state.result ?? ''}|${state.resultReason ?? ''}`;
}

function profileLabel(profile, fallback) {
  return profile?.username ?? fallback;
}

function profileRank(profile) {
  if (!profile) return 'Unranked 1,200';
  return `${profile.rank_title ?? getRankTitle(profile.ranking_points)} ${formatRankingPoints(profile.ranking_points)}`;
}

const initialFriendMatchState = {
  settingsOpen: false,
  game: null,
  profiles: {},
  loading: true,
  saving: false,
};

function friendMatchStateReducer(state, action) {
  switch (action.type) {
    case 'set-settings-open':
      return { ...state, settingsOpen: action.open };
    case 'set-game':
      return { ...state, game: action.game };
    case 'set-profiles':
      return { ...state, profiles: action.profiles };
    case 'set-loading':
      return { ...state, loading: action.loading };
    case 'set-saving':
      return { ...state, saving: action.saving };
    default:
      return state;
  }
}

export default function PlayFriend() {
  const { gameId } = useParams();
  const auth = useAuthStore();
  const { refresh: refreshLeaderboard } = useLeaderboardStore();
  const { settings, updateSettings } = useSettingsStore();
  const [friendMatchState, dispatchFriendMatchState] = useReducer(friendMatchStateReducer, initialFriendMatchState);
  const chess = useChess(undefined, { autoQueen: settings.autoQueen });
  const gameRef = useRef(null);
  const skipNextPersistRef = useRef(false);
  const lastPersistKeyRef = useRef('');
  const applyingRankRef = useRef(false);

  const userId = auth.isOnlineAccount ? auth.user?.id : null;
  const playerColor = useMemo(() => {
    if (!game || !userId) return null;
    if (game.white_user_id === userId) return WHITE;
    if (game.black_user_id === userId) return BLACK;
    return null;
  }, [game, userId]);

  const whiteProfile = profiles[game?.white_user_id];
  const blackProfile = profiles[game?.black_user_id];
  const whiteName = profileLabel(whiteProfile, 'White');
  const blackName = profileLabel(blackProfile, 'Black');

  const applyGameRow = useCallback(
    (row) => {
      if (!row) return;
      gameRef.current = row;
      setGame(row);

      const remoteState = row.metadata?.state;
      skipNextPersistRef.current = true;
      if (remoteState?.board) {
        lastPersistKeyRef.current = stateKey(remoteState, row.current_fen);
        chess.loadState(remoteState);
      } else {
        lastPersistKeyRef.current = `0|${row.current_fen ?? INITIAL_FEN}|${row.result ?? ''}|${row.result_reason ?? ''}`;
        chess.reset(row.current_fen ?? INITIAL_FEN);
      }
    },
    [chess.loadState, chess.reset],
  );

  const refreshGame = useCallback(async () => {
    if (!gameId || !isSupabaseConfigured || !auth.isOnlineAccount) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await loadGame(gameId);
    if (error) toast.error(error.message);
    else applyGameRow(data);
    setLoading(false);
  }, [applyGameRow, auth.isOnlineAccount, gameId]);

  useEffect(() => {
    refreshGame();
  }, [refreshGame]);

  useEffect(() => {
    if (!gameId || !isSupabaseConfigured || !auth.isOnlineAccount) return undefined;
    const subscription = subscribeToGame(gameId, (payload) => {
      if (payload.table === 'games' && payload.new) {
        applyGameRow(payload.new);
      }
    });
    return () => subscription.unsubscribe();
  }, [applyGameRow, auth.isOnlineAccount, gameId]);

  useEffect(() => {
    const ids = [game?.white_user_id, game?.black_user_id].filter(Boolean);
    if (!ids.length) return;

    listProfilesByIds(ids).then(({ data, error }) => {
      if (error) {
        toast.error(error.message);
        return;
      }

      setProfiles(Object.fromEntries((data ?? []).map((profile) => [profile.id, profile])));
    });
  }, [game?.black_user_id, game?.white_user_id]);

  const persistGameState = useCallback(
    async (nextState, nextFen, nextPgn) => {
      const currentGame = gameRef.current;
      if (!currentGame || !playerColor) return;

      setSaving(true);
      const completed = Boolean(nextState.result);
      const nextMetadata = {
        ...(currentGame.metadata ?? {}),
        state: nextState,
        last_move_at: new Date().toISOString(),
      };
      const { data, error } = await saveGame({
        id: currentGame.id,
        white_user_id: currentGame.white_user_id,
        black_user_id: currentGame.black_user_id,
        mode: 'friend',
        status: completed ? 'completed' : 'active',
        result: nextState.result,
        result_reason: nextState.resultReason,
        current_fen: nextFen,
        final_fen: completed ? nextFen : currentGame.final_fen,
        pgn: nextPgn,
        time_control: currentGame.time_control ?? {},
        metadata: nextMetadata,
      });

      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }

      gameRef.current = data;
      setGame(data);
      lastPersistKeyRef.current = stateKey(nextState, nextFen);

      if (completed && !currentGame.ranked_result_applied && !applyingRankRef.current) {
        applyingRankRef.current = true;
        const ranked = await applyRankedGameResult(currentGame.id);
        applyingRankRef.current = false;
        if (ranked.error) toast.error(ranked.error.message);
        else {
          refreshLeaderboard();
          refreshGame();
        }
      }

      setSaving(false);
    },
    [playerColor, refreshGame, refreshLeaderboard],
  );

  useEffect(() => {
    if (!game?.id || !playerColor) return;

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    const nextKey = stateKey(chess.state, chess.fen);
    if (nextKey === lastPersistKeyRef.current) return;

    persistGameState(chess.state, chess.fen, chess.pgn);
  }, [chess.fen, chess.pgn, chess.state, game?.id, persistGameState, playerColor]);

  const boardLocked = !playerColor || chess.state.result || chess.state.turn !== playerColor || saving;
  const flipped = settings.flipped || playerColor === BLACK;
  const turnName = chess.state.turn === WHITE ? whiteName : blackName;
  const statusText = chess.state.result
    ? `${chess.state.result} ${chess.state.resultReason}`
    : !playerColor
      ? 'Spectating friend match'
      : chess.state.turn === playerColor
        ? 'Your move'
        : `${turnName} to move`;

  if (auth.loading || loading) {
    return (
      <div className="content-grid">
        <section className="panel auth-panel">
          <p className="muted">Loading friend match.</p>
        </section>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="content-grid">
        <section className="panel auth-panel">
          <div className="panel-heading">
            <h1>Friend Match</h1>
          </div>
          <p className="muted">Login from the header to open this friend match.</p>
        </section>
      </div>
    );
  }

  if (!auth.isOnlineAccount) {
    return (
      <div className="content-grid">
        <section className="panel auth-panel">
          <div className="panel-heading">
            <h1>Friend Match</h1>
          </div>
          <p className="muted">Friend matches need a confirmed Supabase login. Logout, then sign in after confirming your email.</p>
          <Link className="icon-button profile-history-link" to="/challenge-friend">Back to Online Challenges</Link>
        </section>
      </div>
    );
  }

  if (!isSupabaseConfigured || !game) {
    return (
      <div className="content-grid">
        <section className="panel auth-panel">
          <div className="panel-heading">
            <h1>Friend Match</h1>
          </div>
          <p className="muted">This friend match is unavailable.</p>
          <Link className="icon-button profile-history-link" to="/challenge-friend">Back to Online Challenges</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="play-layout animated-play-background">
      <section className="game-stage">
        <div className="section-title">
          <div className="game-title-block">
            <h1>Friend Match</h1>
            <p className="game-status-line">{statusText}</p>
          </div>
          <button type="button" className="icon-button" onClick={refreshGame} disabled={saving}>
            <RefreshCw size={17} />
            <span>{saving ? 'Syncing' : 'Refresh'}</span>
          </button>
        </div>
        <ChessBoard
          state={chess.state}
          selectedSquare={chess.selectedSquare}
          selectedMoves={settings.legalMoveHints ? chess.selectedMoves : []}
          legalTargets={settings.legalMoveHints ? chess.legalTargets : []}
          onSquareClick={boardLocked ? undefined : chess.onSquareClick}
          flipped={flipped}
        />
      </section>
      <aside className="side-stack">
        <section className="panel friend-match-panel">
          <div className="panel-heading">
            <h2>Players</h2>
            <span className="status-pill">{playerColor ? COLOR_NAMES[playerColor] : 'Viewer'}</span>
          </div>
          <div className="friend-player-list">
            <span className={chess.state.turn === WHITE && !chess.state.result ? 'active-player' : ''}>
              <strong>{whiteName}</strong>
              <small>White · {profileRank(whiteProfile)}</small>
            </span>
            <span className={chess.state.turn === BLACK && !chess.state.result ? 'active-player' : ''}>
              <strong>{blackName}</strong>
              <small>Black · {profileRank(blackProfile)}</small>
            </span>
          </div>
        </section>
        <section className="panel friend-control-panel">
          <button type="button" className="icon-button" onClick={() => updateSettings({ flipped: !settings.flipped })}>
            <RotateCcw size={18} />
            <span>Flip</span>
          </button>
          <button type="button" className="icon-button" onClick={() => setSettingsOpen(true)}>
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button type="button" className="icon-button" disabled={!playerColor || Boolean(chess.state.result)} onClick={chess.agreeDraw}>
            <Handshake size={18} />
            <span>Draw</span>
          </button>
          <button
            type="button"
            className="icon-button danger-button"
            disabled={!playerColor || Boolean(chess.state.result)}
            onClick={() => chess.resign(playerColor)}
          >
            <Flag size={18} />
            <span>Resign</span>
          </button>
        </section>
        <CapturedPieces captured={chess.state.captured} />
        <MoveHistory moves={chess.state.history} />
      </aside>
      <PromotionModal color={chess.state.turn} open={Boolean(chess.pendingPromotion)} onSelect={chess.promote} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
