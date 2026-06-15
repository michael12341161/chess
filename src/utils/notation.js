import { PIECE_LETTERS, PIECES } from './constants.js';

export function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

export function createSan(move, nextState, legalReplyCount, inCheckAfter) {
  if (move.flags?.includes('castle-kingside')) return 'O-O';
  if (move.flags?.includes('castle-queenside')) return 'O-O-O';

  const pieceLetter = PIECE_LETTERS[move.piece.type] ?? '';
  const isPawn = move.piece.type === PIECES.PAWN;
  const captureMark = move.captured || move.flags?.includes('en-passant') ? 'x' : '';
  const pawnFile = isPawn && captureMark ? move.from[0] : '';
  const promotion = move.promotion ? `=${PIECE_LETTERS[move.promotion]}` : '';
  const suffix = nextState.result
    ? nextState.result === '1/2-1/2'
      ? ''
      : '#'
    : inCheckAfter && legalReplyCount > 0
      ? '+'
      : '';

  return `${pieceLetter}${pawnFile}${captureMark}${move.to}${promotion}${suffix}`;
}

export function moveToLan(move) {
  const captureMark = move.captured ? 'x' : '-';
  return `${move.from}${captureMark}${move.to}${move.promotion ? `=${move.promotion.toUpperCase()}` : ''}`;
}
