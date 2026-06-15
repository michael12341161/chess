import Leaderboard from '../components/Leaderboard.jsx';
import { useLeaderboardStore } from '../store/leaderboardStore.js';

export default function Leaderboards() {
  const { rows, loading, refresh } = useLeaderboardStore();

  return (
    <div className="content-grid">
      <div className="section-title">
        <div>
          <h1>Leaderboards</h1>
          <p>Global rankings and results.</p>
        </div>
        <button type="button" className="primary-button" onClick={refresh}>Refresh</button>
      </div>
      <Leaderboard rows={rows} loading={loading} />
    </div>
  );
}
