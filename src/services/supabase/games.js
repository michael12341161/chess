import { supabase } from './client.js';

export async function saveGame(game) {
  if (!supabase) return { data: null, error: new Error('Supabase credentials are missing.') };
  return supabase.from('games').upsert(game).select('*').single();
}

export async function saveMoves(moves) {
  if (!supabase || moves.length === 0) return { data: [], error: null };
  return supabase.from('moves').upsert(moves).select('*');
}

export async function saveGameAnalysis(analysis) {
  if (!supabase) return { data: null, error: new Error('Supabase credentials are missing.') };
  return supabase.from('game_analysis').upsert(analysis, { onConflict: 'game_id' }).select('*').single();
}

export async function saveSnapshot(snapshot) {
  if (!supabase) return { data: null, error: new Error('Supabase credentials are missing.') };
  return supabase.from('saved_games').upsert(snapshot).select('*').single();
}

export async function loadGame(gameId) {
  if (!supabase || !gameId) return { data: null, error: null };
  return supabase.from('games').select('*, moves(*)').eq('id', gameId).single();
}

export async function applyRankedGameResult(gameId) {
  if (!supabase || !gameId) return { data: null, error: null };
  return supabase.rpc('apply_ranked_game_result', { target_game_id: gameId });
}

export async function listSavedGames(userId) {
  if (!supabase || !userId) return { data: [], error: null };
  return supabase.from('saved_games').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
}

export async function deleteSavedGame(id) {
  if (!supabase || !id) return { error: null };
  return supabase.from('saved_games').delete().eq('id', id);
}
