import { supabase } from './client.js';
import { listProfilesByIds } from './profiles.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireConfigured() {
  if (!supabase) {
    return new Error('Supabase credentials are missing.');
  }
  return null;
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value ?? ''));
}

function attachProfiles(challenges, profiles) {
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return (challenges ?? []).map((challenge) => ({
    ...challenge,
    challenger: profileMap.get(challenge.challenger_id) ?? null,
    opponent: profileMap.get(challenge.opponent_id) ?? null,
  }));
}

export async function createFriendChallenge({ opponentUsername, colorPreference = 'random' }) {
  const configError = requireConfigured();
  if (configError) return { data: null, error: configError };
  if (!opponentUsername?.trim()) return { data: null, error: new Error('Enter a username to challenge.') };

  return supabase.rpc('create_friend_challenge_by_username', {
    target_opponent_username: opponentUsername,
    target_color_preference: colorPreference,
  });
}

export async function createOnlinePlayerChallenge({ opponentId, colorPreference = 'random' }) {
  const configError = requireConfigured();
  if (configError) return { data: null, error: configError };
  if (!opponentId) return { data: null, error: new Error('Choose an online player to challenge.') };
  if (!isUuid(opponentId)) return { data: null, error: new Error('Choose a valid online player to challenge.') };

  return supabase.rpc('create_online_player_challenge', {
    target_opponent_id: opponentId,
    target_color_preference: colorPreference,
  });
}

export async function listFriendChallenges(userId) {
  if (!supabase || !userId) return { data: [], error: null };
  if (!isUuid(userId)) return { data: [], error: null };

  const { data: challenges, error } = await supabase
    .from('friend_challenges')
    .select('*')
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (error || !challenges?.length) return { data: challenges ?? [], error };

  const ids = challenges.flatMap((challenge) => [challenge.challenger_id, challenge.opponent_id]);
  const { data: profiles, error: profilesError } = await listProfilesByIds(ids);
  if (profilesError) return { data: challenges, error: profilesError };

  return { data: attachProfiles(challenges, profiles), error: null };
}

export async function acceptFriendChallenge(challengeId) {
  const configError = requireConfigured();
  if (configError) return { data: null, error: configError };
  return supabase.rpc('accept_friend_challenge', { target_challenge_id: challengeId });
}

export async function updateFriendChallengeStatus(challengeId, status) {
  const configError = requireConfigured();
  if (configError) return { data: null, error: configError };
  return supabase.rpc('set_friend_challenge_status', {
    target_challenge_id: challengeId,
    target_status: status,
  });
}

export function subscribeToFriendChallenges(userId, onChange) {
  if (!supabase || !userId) return { unsubscribe: () => {} };
  if (!isUuid(userId)) return { unsubscribe: () => {} };
  const channel = supabase
    .channel(`friend-challenges:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_challenges',
        filter: `challenger_id=eq.${userId}`,
      },
      onChange,
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_challenges',
        filter: `opponent_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}
