export function exportPgn(state, tags = {}) {
  const safeTags = {
    Event: 'Chess Platform Game',
    Site: 'Local',
    Date: new Date().toISOString().slice(0, 10).replaceAll('-', '.'),
    Round: '-',
    White: 'White',
    Black: 'Black',
    Result: state.result ?? '*',
    ...tags,
  };

  const header = Object.entries(safeTags)
    .map(([key, value]) => `[${key} "${String(value).replaceAll('"', "'")}"]`)
    .join('\n');

  const moves = state.history.reduce((lines, move, index) => {
    if (index % 2 === 0) {
      lines.push(`${Math.floor(index / 2) + 1}. ${move.san ?? move.lan}`);
    } else {
      lines[lines.length - 1] += ` ${move.san ?? move.lan}`;
    }
    return lines;
  }, []);

  return `${header}\n\n${moves.join(' ')} ${state.result ?? '*'}`.trim();
}

export function importPgnMoves(pgn) {
  return pgn
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\{[^}]+\}/g, '')
    .replace(/\d+\.(\.\.)?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((token) => token && !['1-0', '0-1', '1/2-1/2', '*'].includes(token));
}
