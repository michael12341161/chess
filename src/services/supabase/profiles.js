import { supabase } from './client.js';

export async function getProfile(userId) {
  if (!supabase || !userId) return { data: null, error: null };
  return supabase.from('profiles').select('*').eq('id', userId).single();
}

export async function upsertProfile(profile) {
  if (!supabase) return { data: null, error: new Error('Supabase credentials are missing.') };
  return supabase.from('profiles').upsert(profile).select('*').single();
}

export async function findProfileByUsername(username) {
  const searchName = username?.trim();
  if (!supabase || !searchName) return { data: null, error: null };
  return supabase
    .from('profiles')
    .select('id, username, avatar_url, ranking_points, rank_title')
    .ilike('username', searchName)
    .maybeSingle();
}

export async function listProfilesByIds(ids) {
  const uniqueIds = [...new Set((ids ?? []).filter(Boolean))];
  if (!supabase || uniqueIds.length === 0) return { data: [], error: null };
  return supabase
    .from('profiles')
    .select('id, username, avatar_url, ranking_points, rank_title')
    .in('id', uniqueIds);
}

export async function getMatchHistory(userId) {
  if (!supabase || !userId) return { data: [], error: null };
  return supabase
    .from('games')
    .select('*, moves(*)')
    .or(`white_user_id.eq.${userId},black_user_id.eq.${userId}`)
    .order('created_at', { ascending: false });
}

export async function getUserStatistics(userId) {
  if (!supabase || !userId) return { data: null, error: null };
  return supabase.from('game_statistics').select('*').eq('user_id', userId).single();
}

export async function updateUserStatistics(userId, patch) {
  if (!supabase || !userId) return { data: null, error: null };
  return supabase.from('game_statistics').update(patch).eq('user_id', userId).select('*').single();
}

export async function updateLeaderboardRow(userId, patch) {
  if (!supabase || !userId) return { data: null, error: null };
  return supabase.from('leaderboard').update(patch).eq('user_id', userId).select('*').single();
}
