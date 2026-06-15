export const DEFAULT_RANKING_POINTS = 1200;

export const RANK_TIERS = [
  { title: 'GM', label: 'Grandmaster', minPoints: 2500 },
  { title: 'IM', label: 'International Master', minPoints: 2400 },
  { title: 'FM', label: 'FIDE Master', minPoints: 2300 },
  { title: 'NM', label: 'National Master', minPoints: 2200 },
  { title: 'CM', label: 'Candidate Master', minPoints: 2000 },
];

export function normalizeRankingPoints(points) {
  const numericPoints = Number(points);
  if (!Number.isFinite(numericPoints)) return DEFAULT_RANKING_POINTS;
  return Math.max(0, Math.round(numericPoints));
}

export function getRankTier(points) {
  const normalizedPoints = normalizeRankingPoints(points);
  return RANK_TIERS.find((tier) => normalizedPoints >= tier.minPoints) ?? null;
}

export function getRankTitle(points) {
  return getRankTier(points)?.title ?? 'Unranked';
}

export function getRankLabel(points) {
  return getRankTier(points)?.label ?? 'Unranked';
}

export function formatRankingPoints(points) {
  return normalizeRankingPoints(points).toLocaleString();
}
