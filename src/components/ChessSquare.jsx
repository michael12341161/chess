import ChessPiece from './ChessPiece.jsx';

export default function ChessSquare({ square, piece, dark, selected, legal, capture, onClick, disabled = false }) {
  const classes = [
    'chess-square',
    dark ? 'dark-square' : 'light-square',
    selected ? 'selected-square' : '',
    legal ? 'legal-square' : '',
    capture ? 'capture-square' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} onClick={() => onClick(square)} disabled={disabled} aria-label={piece ? `${square} occupied` : `${square} empty`}>
      <ChessPiece piece={piece} />
      <span className="square-coordinate">{square}</span>
    </button>
  );
}
