import ChessSquare from './ChessSquare.jsx';
import { coordsToSquare, squareToCoords } from '../utils/helpers.js';

const EMPTY_MOVES = [];
const EMPTY_LEGAL_TARGETS = [];
const EMPTY_ARROWS = [];

function arrowPoint(square, flipped) {
  const coords = squareToCoords(square);
  if (!coords) return null;
  const row = flipped ? 7 - coords.row : coords.row;
  const col = flipped ? 7 - coords.col : coords.col;
  return {
    x: ((col + 0.5) / 8) * 100,
    y: ((row + 0.5) / 8) * 100,
  };
}

export default function ChessBoard({ state, selectedSquare, legalTargets = EMPTY_LEGAL_TARGETS, selectedMoves = EMPTY_MOVES, onSquareClick, flipped = false, arrows = EMPTY_ARROWS }) {
  const rows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const captureTargets = new Set(selectedMoves.filter((move) => move.captured).map((move) => move.to));
  const interactive = typeof onSquareClick === 'function';

  return (
    <div className="board-frame" aria-label="Chess board">
      <div className="chess-board">
        {rows.flatMap((row) =>
          cols.map((col) => {
            const square = coordsToSquare(row, col);
            return (
              <ChessSquare
                key={square}
                square={square}
                piece={state.board[row][col]}
                dark={(row + col) % 2 === 1}
                selected={selectedSquare === square}
                legal={legalTargets.includes(square)}
                capture={captureTargets.has(square)}
                onClick={interactive ? onSquareClick : () => {}}
                disabled={!interactive}
              />
            );
          }),
        )}
      </div>
      {arrows.length ? (
        <svg className="board-arrows" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
          <defs>
            <marker id="actual-move-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L5,2.5 L0,5 Z" />
            </marker>
            <marker id="best-move-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L5,2.5 L0,5 Z" />
            </marker>
          </defs>
          {arrows.map((arrow, index) => {
            const from = arrowPoint(arrow.from, flipped);
            const to = arrowPoint(arrow.to, flipped);
            if (!from || !to) return null;
            const type = arrow.type === 'best' ? 'best' : 'actual';
            return (
              <line
                key={`${arrow.from}-${arrow.to}-${type}-${index}`}
                className={`board-arrow board-arrow-${type}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                markerEnd={`url(#${type}-move-arrow)`}
              />
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}
