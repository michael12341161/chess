import { supabase } from './client.js';
import { findProfileByUsername, listProfilesByIds } from './profiles.js';

function requireConfigured() {
  if (!supabase) {
    return new Error('Supabase credentials are missing.');
  }
  return null;
}

function attachProfiles(challenges, profiles) {
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return (challenges ?? []).map((challenge) => ({
    ...challenge,
    challenger: profileMap.get(challenge.challenger_id) ?? null,
    opponent: profileMap.get(challenge.opponent_id) ?? null,
  }));
}

export async function createFriendChallenge({ challengerId, opponentUsername, colorPreference = 'random' }) {
  const configError = requireConfigured();
  if (configError) return { data: null, error: configError };
  if (!challengerId) return { data: null, error: new Error('Login is required to challenge a friend.') };

  const { data: opponent, error: profileError } = await findProfileByUsername(opponentUsername);
  if (profileError) return { data: null, error: profileError };
  if (!opponent) return { data: null, error: new Error('No player found with that username.') };
  if (opponent.id === challengerId) return { data: null, error: new Error('Choose another player to challenge.') };

  return supabase
    .from('friend_challenges')
    .insert({
      challenger_id: challengerId,
      opponent_id: opponent.id,
      color_preference: colorPreference,
      status: 'pending',
    })
    .select('*')
    .single();
}

export async function listFriendChallenges(userId) {
  if (!supabase || !userId) return { data: [], error: null };

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
  return supabase
    .from('friend_challenges')
    .update({
      status,
      responded_at: ['declined', 'canceled'].includes(status) ? new Date().toISOString() : null,
    })
    .eq('id', challengeId)
    .select('*')
    .single();
}

export function subscribeToFriendChallenges(userId, onChange) {
  if (!supabase || !userId) return { unsubscribe: () => {} };
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
