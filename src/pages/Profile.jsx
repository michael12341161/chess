import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CircleEqual, Trophy, XCircle } from 'lucide-react';
import ProfileCard from '../components/ProfileCard.jsx';
import { listLocalGames } from '../store/gameStore.js';
import { useAuthStore } from '../store/authStore.js';
import { COLOR_NAMES, GAME_RESULTS } from '../utils/constants.js';
import { getWinnerColor } from '../utils/gameSummary.js';

function getProfileHistoryStats(games) {
  return games.reduce(
    (stats, game) => {
      if (!game.result || game.result === GAME_RESULTS.ACTIVE) {
        stats.active += 1;
        return stats;
      }

      stats.completed += 1;
      if (game.result === GAME_RESULTS.WHITE_WINS) stats.whiteWins += 1;
      else if (game.result === GAME_RESULTS.BLACK_WINS) stats.blackWins += 1;
      else stats.draws += 1;
      return stats;
    },
    { completed: 0, active: 0, whiteWins: 0, blackWins: 0, draws: 0 },
  );
}

function resultText(game) {
  if (!game.result || game.result === GAME_RESULTS.ACTIVE) return 'Active game';
  const winner = getWinnerColor(game.state ?? game);
  if (!winner) return 'Draw';
  return `${COLOR_NAMES[winner]} wins`;
}

export default function Profile() {
  const auth = useAuthStore();
  const games = useMemo(() => listLocalGames(), []);
  const recentGames = games.slice(0, 8);
  const historyStats = useMemo(() => getProfileHistoryStats(games), [games]);

  if (auth.loading) {
    return (
      <div className="profile-layout">
        <section className="panel auth-panel">
          <p className="muted">Checking account status.</p>
        </section>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <div className="profile-layout">
        <ProfileCard />
        <section className="panel profile-stats-panel">
          <div className="panel-heading">
            <h2>User Stats</h2>
            <span className="status-pill">{historyStats.completed} completed</span>
          </div>
          <div className="profile-stat-grid">
            <span>
              <Trophy size={18} />
              White wins
              <strong>{historyStats.whiteWins}</strong>
            </span>
            <span>
              <XCircle size={18} />
              Black wins
              <strong>{historyStats.blackWins}</strong>
            </span>
            <span>
              <CircleEqual size={18} />
              Draws
              <strong>{historyStats.draws}</strong>
            </span>
            <span>
              <CalendarDays size={18} />
              Active
              <strong>{historyStats.active}</strong>
            </span>
          </div>
        </section>
        <section className="panel match-card">
          <div className="panel-heading">
            <h2>Match History</h2>
            <button type="button" className="secondary-button" onClick={auth.logout}>Logout</button>
          </div>
          <div className="profile-history-list">
            {recentGames.length ? (
              recentGames.map((game) => (
                <article className="profile-history-row" key={game.id}>
                  <div>
                    <strong>{game.title}</strong>
                    <span>{new Date(game.updatedAt).toLocaleString()} · {game.mode ?? 'local'}</span>
                  </div>
                  <b>{resultText(game)}</b>
                </article>
              ))
            ) : (
              <p className="muted">Saved games appear here after you save or finish a match.</p>
            )}
          </div>
          <Link className="icon-button profile-history-link" to="/history">Open Game History</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="profile-layout">
      <section className="panel auth-panel">
        <div className="panel-heading">
          <h1>Profile</h1>
        </div>
        <p className="muted">Login from the header to view your profile, avatar, stats, and match history.</p>
      </section>
    </div>
  );
}
