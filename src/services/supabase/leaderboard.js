import { supabase } from './client.js';

export async function fetchLeaderboard(limit = 25) {
  if (!supabase) return { data: [], error: null };
  return supabase
    .from('leaderboard')
    .select('*')
    .order('ranking_points', { ascending: false })
    .order('wins', { ascending: false })
    .order('draws', { ascending: false })
    .order('losses', { ascending: true })
    .limit(limit);
}

export async function updateLeaderboardRow(row) {
  if (!supabase) return { data: null, error: new Error('Supabase credentials are missing.') };
  return supabase.from('leaderboard').upsert(row).select('*').single();
}
