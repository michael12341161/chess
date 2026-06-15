import { COLOR_NAMES, PIECE_NAMES, PIECE_SYMBOLS } from '../utils/constants.js';

export default function ChessPiece({ piece }) {
  if (!piece) return null;
  return (
    <span className={`chess-piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`} title={`${COLOR_NAMES[piece.color]} ${PIECE_NAMES[piece.type]}`}>
      {PIECE_SYMBOLS[piece.color][piece.type]}
    </span>
  );
}
