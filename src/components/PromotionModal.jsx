import { useEffect, useRef, useState } from 'react';
import ChessPiece from './ChessPiece.jsx';
import { PIECE_NAMES, PROMOTION_PIECES, WHITE } from '../utils/constants.js';

export default function PromotionModal({ color = WHITE, open, onSelect }) {
  const [selected, setSelected] = useState(null);
  const optionRefs = useRef([]);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      optionRefs.current[0]?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open]);

  if (!open) return null;

  const choose = (type) => {
    if (selected) return;
    setSelected(type);
    window.setTimeout(() => {
      onSelect(type);
      setSelected(null);
    }, 120);
  };

  const focusOption = (index) => {
    const total = PROMOTION_PIECES.length;
    const nextIndex = (index + total) % total;
    optionRefs.current[nextIndex]?.focus();
  };

  const handleOptionKeyDown = (event, index) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(index + 1);
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(index - 1);
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusOption(0);
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusOption(PROMOTION_PIECES.length - 1);
    }
  };

  return (
    <div className="modal-backdrop promotion-backdrop" role="presentation">
      <div className="modal compact-modal promotion-modal" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
        <div className="promotion-heading">
          <h2 id="promotion-title">Choose a Piece for Promotion</h2>
        </div>
        <div className="promotion-grid" role="group" aria-labelledby="promotion-title">
          {PROMOTION_PIECES.map((type, index) => (
            <button
              type="button"
              className={`promotion-option ${selected === type ? 'promotion-selected' : ''}`}
              key={type}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              onClick={() => choose(type)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              disabled={Boolean(selected)}
              aria-label={`Promote to ${PIECE_NAMES[type]}`}
              aria-pressed={selected === type}
              title={`Promote to ${PIECE_NAMES[type]}`}
            >
              <span className="promotion-piece-frame" aria-hidden="true">
                <ChessPiece piece={{ type, color }} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
