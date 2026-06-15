import { BLACK, COLOR_NAMES, GAME_RESULTS, WHITE } from './constants.js';
import { formatClock } from './helpers.js';

export function getWinnerColor(state) {
  if (state.result === GAME_RESULTS.WHITE_WINS) return WHITE;
  if (state.result === GAME_RESULTS.BLACK_WINS) return BLACK;
  return null;
}

export function getWinnerLabel(state, labels = {}) {
  const winner = getWinnerColor(state);
  if (!winner) return 'Draw';
  return labels[winner] ?? COLOR_NAMES[winner];
}

export function getResultTitle(state, labels = {}) {
  const winner = getWinnerColor(state);
  if (winner) return `${getWinnerLabel(state, labels)} wins`;
  return 'Game drawn';
}

export function getEndgameMessage(state) {
  const reason = state.resultReason ?? 'game complete';
  const messages = {
    checkmate: 'Checkmate. The king has no legal escape.',
    stalemate: 'Stalemate. The side to move has no legal move.',
    agreement: 'Draw agreed.',
    resignation: 'Game ended by resignation.',
    timeout: 'The clock expired.',
    'threefold repetition': 'Draw by threefold repetition.',
    'fifty-move rule': 'Draw by the fifty-move rule.',
    'insufficient material': 'Draw by insufficient material.',
  };
  return messages[reason] ?? `Game ended by ${reason}.`;
}

export function getElapsedSeconds(times, initialMinutes) {
  const initialTotal = initialMinutes * 60 * 2;
  return Math.max(0, initialTotal - ((times?.[WHITE] ?? 0) + (times?.[BLACK] ?? 0)));
}

export function formatDuration(seconds) {
  return formatClock(Math.max(0, Math.floor(seconds)));
}
