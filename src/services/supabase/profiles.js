import { supabase } from './client.js';

const PLAYER_LIST_STALE_SECONDS = 90;
const PROFILE_COLUMNS = [
  'id',
  'username',
  'full_name',
  'avatar_url',
  'wins',
  'losses',
  'draws',
  'ranking_points',
  'rank_title',
  'match_history',
];

function isFreshOnline(lastSeen) {
  if (!lastSeen) return false;
  const lastSeenAt = new Date(lastSeen).getTime();
  if (Number.isNaN(lastSeenAt)) return false;
  return Date.now() - lastSeenAt <= PLAYER_LIST_STALE_SECONDS * 1000;
}

function pickProfileColumns(profile) {
  return PROFILE_COLUMNS.reduce((payload, key) => {
    if (profile[key] !== undefined) payload[key] = profile[key];
    return payload;
  }, {});
}

function normalizeProfile(row) {
  if (!row) return null;
  const account = Array.isArray(row.users) ? row.users[0] : row.users;
  const { users: _users, ...profile } = row;
  return {
    ...profile,
    full_name: profile.full_name ?? profile.username ?? '',
    email: account?.email ?? profile.email ?? '',
    role: account?.role ?? profile.role ?? 'user',
    account_status: account?.account_status ?? profile.account_status ?? 'active',
    registered_at: account?.created_at ?? profile.registered_at ?? profile.created_at ?? null,
  };
}

function normalizeChallengeProfiles(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    email: row.email ?? '',
    username: row.username ?? '',
    avatar_url: row.avatar_url ?? null,
    ranking_points: row.ranking_points ?? null,
    rank_title: row.rank_title ?? null,
    online_at: row.last_seen ?? null,
    is_online: Boolean(row.is_online ?? isFreshOnline(row.last_seen)),
    challenge_id: row.challenge_id ?? null,
    challenge_status: row.challenge_status ?? null,
    challenge_direction: row.challenge_direction ?? null,
    challenge_game_id: row.challenge_game_id ?? null,
    challenge_color_preference: row.challenge_color_preference ?? null,
    challenge_updated_at: row.challenge_updated_at ?? null,
  }));
}

export async function getProfile(userId) {
  if (!supabase || !userId) return { data: null, error: null };
  const response = await supabase
    .from('profiles')
    .select('*, users(email, role, account_status, created_at)')
    .eq('id', userId)
    .single();

  if (!response.error) return { data: normalizeProfile(response.data), error: null };

  const missingColumns = /role|account_status|full_name|relationship|users/i.test(response.error.message ?? '');
  if (!missingColumns) return response;

  const fallback = await supabase.from('profiles').select('*').eq('id', userId).single();
  return fallback.error ? fallback : { data: normalizeProfile(fallback.data), error: null };
}

export async function upsertProfile(profile) {
  if (!supabase) return { data: null, error: new Error('Supabase credentials are missing.') };
  return supabase.from('profiles').upsert(pickProfileColumns(profile)).select('*').single();
}

export async function findProfileByUsername(username) {
  const searchName = username?.trim();
  if (!supabase || !searchName) return { data: null, error: null };
  return supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, ranking_points, rank_title')
    .ilike('username', searchName)
    .maybeSingle();
}

export async function listProfilesByIds(ids) {
  const uniqueIds = [...new Set((ids ?? []).filter(Boolean))];
  if (!supabase || uniqueIds.length === 0) return { data: [], error: null };
  return supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, ranking_points, rank_title')
    .in('id', uniqueIds);
}

export async function listChallengeProfiles() {
  if (!supabase) return { data: [], error: null };

  const rpcResponse = await supabase.rpc('list_challenge_profiles', {
    stale_after_seconds: PLAYER_LIST_STALE_SECONDS,
  });
  if (!rpcResponse.error) {
    return { data: normalizeChallengeProfiles(rpcResponse.data ?? []).filter((profile) => profile.is_online), error: null };
  }

  const missingFunction = rpcResponse.error.code === '42883' || /list_challenge_profiles/i.test(rpcResponse.error.message ?? '');
  if (!missingFunction) return rpcResponse;

  const fallback = await supabase.rpc('list_online_profiles', {
    stale_after_seconds: PLAYER_LIST_STALE_SECONDS,
  });
  if (fallback.error) return fallback;

  return { data: normalizeChallengeProfiles(fallback.data ?? []).filter((profile) => profile.is_online), error: null };
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