import { supabase } from './client.js';

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
