import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchLeaderboard } from '../services/supabase/leaderboard.js';
import { STORAGE_KEYS } from '../utils/constants.js';

const legacyFallbackRowIds = new Set(['local-1', 'local-2', 'local-3']);

const LeaderboardContext = createContext(null);

function readLocalRows() {
  try {
    const storedRows = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADERBOARD) ?? '[]');
    if (!Array.isArray(storedRows)) return [];
    return storedRows.filter((row) => !legacyFallbackRowIds.has(row?.user_id));
  } catch {
    return [];
  }
}

export function LeaderboardProvider({ children }) {
  const [rows, setRows] = useState(readLocalRows);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchLeaderboard();
    const nextRows = data?.length ? data : readLocalRows();
    setRows(nextRows);
    localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(nextRows));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ rows, loading, refresh }), [rows, loading, refresh]);
  return createElement(LeaderboardContext.Provider, { value }, children);
}

export function useLeaderboardStore() {
  const context = useContext(LeaderboardContext);
  if (!context) throw new Error('useLeaderboardStore must be used inside LeaderboardProvider.');
  return context;
}
