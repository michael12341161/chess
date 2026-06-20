import { supabase } from './client.js';

const ONLINE_STALE_SECONDS = 90;
const ONLINE_HEARTBEAT_MS = 25000;
const ONLINE_REFRESH_MS = 15000;

function normalizeOnlineUsers(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    email: row.email ?? '',
    username: row.username ?? '',
    avatar_url: row.avatar_url ?? null,
    ranking_points: row.ranking_points ?? null,
    rank_title: row.rank_title ?? null,
    online_at: row.last_seen ?? null,
    challenge_id: row.challenge_id ?? null,
    challenge_status: row.challenge_status ?? null,
    challenge_direction: row.challenge_direction ?? null,
    challenge_game_id: row.challenge_game_id ?? null,
    challenge_color_preference: row.challenge_color_preference ?? null,
    challenge_updated_at: row.challenge_updated_at ?? null,
  }));
}

export async function touchOnlineUser() {
  if (!supabase) return { data: null, error: null };

  return supabase.rpc('touch_online_user');
}

export function subscribeToOnlineUserChanges(onChange) {
  if (!supabase) return { unsubscribe: () => {} };

  const channel = supabase
    .channel('online-users-roster')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'online_users',
      },
      onChange,
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}

export function subscribeToOnlineUsers(user, onChange) {
  if (!supabase || !user?.id) {
    onChange?.([]);
    return { unsubscribe: () => {} };
  }

  let stopped = false;

  const refresh = async () => {
    if (stopped) return;
    const { data, error } = await supabase.rpc('list_online_profiles', {
      stale_after_seconds: ONLINE_STALE_SECONDS,
    });
    if (!stopped && !error) onChange(normalizeOnlineUsers(data ?? []));
  };

  const heartbeat = async () => {
    if (stopped) return;
    const { error } = await touchOnlineUser();
    if (!stopped && !error) await refresh();
  };

  const channel = supabase
    .channel('online-users-db')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'online_users',
      },
      refresh,
    )
    .subscribe();

  const heartbeatId = window.setInterval(heartbeat, ONLINE_HEARTBEAT_MS);
  const refreshId = window.setInterval(refresh, ONLINE_REFRESH_MS);
  const handleFocus = () => void heartbeat();
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') void heartbeat();
  };
  const handlePageHide = () => void supabase.rpc('leave_online_user');

  window.addEventListener('focus', handleFocus);
  window.addEventListener('pagehide', handlePageHide);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  void heartbeat();

  return {
    unsubscribe: () => {
      stopped = true;
      window.clearInterval(heartbeatId);
      window.clearInterval(refreshId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void supabase.rpc('leave_online_user');
      supabase.removeChannel(channel);
    },
  };
}

export function subscribeToGame(gameId, onChange) {
  if (!supabase || !gameId) return { unsubscribe: () => {} };
  const channel = supabase
    .channel(`game:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      onChange,
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'moves',
        filter: `game_id=eq.${gameId}`,
      },
      onChange,
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}
