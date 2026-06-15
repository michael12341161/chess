export const supabaseConfig = {
  url: process.env.REACT_APP_SUPABASE_URL ?? '',
  anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY ?? '',
};

export const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey);
