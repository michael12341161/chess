import ChessPiece from './ChessPiece.jsx';
import { BLACK, WHITE } from '../utils/constants.js';

export default function CapturedPieces({ captured }) {
  return (
    <section className="panel captured-panel">
      <div className="panel-heading">
        <h2>Captured</h2>
      </div>
      <div className="capture-lanes">
        <div>
          <span className="lane-label">White</span>
          <div className="captured-pieces">
            {captured[WHITE].map((piece, index) => (
              <ChessPiece piece={piece} key={`${piece.type}-${index}`} />
            ))}
          </div>
        </div>
        <div>
          <span className="lane-label">Black</span>
          <div className="captured-pieces">
            {captured[BLACK].map((piece, index) => (
              <ChessPiece piece={piece} key={`${piece.type}-${index}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
