import { BLACK, COLOR_NAMES, WHITE } from '../utils/constants.js';
import { formatClock } from '../utils/helpers.js';

export default function ChessClock({ times, turn, result, paused = false }) {
  return (
    <section className="clock-grid">
      {[BLACK, WHITE].map((color) => (
        <div className={`clock-tile ${turn === color && !result && !paused ? 'clock-active' : ''}`} key={color}>
          <span>{COLOR_NAMES[color]}</span>
          <strong>{formatClock(times[color])}</strong>
        </div>
      ))}
    </section>
  );
}
