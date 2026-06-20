import { formatRankingPoints, getRankTitle } from '../utils/ranking.js';

const EMPTY_ROWS = [];

export default function Leaderboard({ rows = EMPTY_ROWS, loading = false }) {
  return (
    <section className="panel leaderboard-panel">
      <div className="panel-heading">
        <h2>Leaderboard</h2>
        {loading ? <span className="status-pill">Syncing</span> : null}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Title</th>
              <th>Points</th>
              <th>W</th>
              <th>L</th>
              <th>D</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.user_id ?? row.id ?? row.username}>
                <td>{index + 1}</td>
                <td>{row.username}</td>
                <td>{row.rank_title ?? getRankTitle(row.ranking_points)}</td>
                <td>{formatRankingPoints(row.ranking_points)}</td>
                <td>{row.wins ?? 0}</td>
                <td>{row.losses ?? 0}</td>
                <td>{row.draws ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
