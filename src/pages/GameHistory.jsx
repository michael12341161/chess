import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { STORAGE_KEYS } from '../utils/constants.js';
import { deleteLocalGame, listLocalGames } from '../store/gameStore.js';

export default function GameHistory() {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const games = listLocalGames();

  const remove = (id) => {
    deleteLocalGame(id);
    setVersion((value) => value + 1);
  };

  const resume = (game) => {
    sessionStorage.setItem(STORAGE_KEYS.RESUME_GAME, JSON.stringify(game));
    toast.success('Resume ready');
    navigate('/play-local');
  };

  return (
    <div className="content-grid">
      <section className="panel full-panel">
        <div className="panel-heading">
          <h1>Game History</h1>
          <span className="status-pill">{games.length} saved</span>
        </div>
        <div className="history-list">
          {games.length === 0 ? (
            <p className="muted">No saved games.</p>
          ) : (
            games.map((game) => (
              <article className="history-item" key={game.id}>
                <div>
                  <h2>{game.title}</h2>
                  <p>{new Date(game.updatedAt).toLocaleString()} · {game.result ?? 'active'}</p>
                  <code>{game.fen}</code>
                </div>
                <div className="row-actions">
                  <button type="button" className="icon-button primary-button" onClick={() => resume(game)}>
                    <Play size={18} />
                    <span>Resume</span>
                  </button>
                  <button type="button" className="square-icon-button danger-button" onClick={() => remove(game.id)} title="Delete">
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
