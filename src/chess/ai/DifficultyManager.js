export const DIFFICULTIES = {
  beginner: { depth: 1, random: 0.55, label: 'Beginner' },
  casual: { depth: 1, random: 0.25, label: 'Casual' },
  club: { depth: 2, random: 0.08, label: 'Club' },
  tournament: { depth: 3, random: 0, label: 'Tournament' },
  superExtreme: {
    depth: 4,
    random: 0,
    label: 'Super Extreme',
    stockfish: true,
    movetime: 900,
  },
};

export function getDifficulty(name = 'casual') {
  return DIFFICULTIES[name] ?? DIFFICULTIES.casual;
}
