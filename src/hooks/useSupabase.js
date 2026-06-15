import { isSupabaseConfigured } from '../config/supabase.js';
import { supabase } from '../services/supabase/client.js';

export function useSupabase() {
  return {
    supabase,
    isConfigured: isSupabaseConfigured,
  };
}
