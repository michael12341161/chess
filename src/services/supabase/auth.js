import { supabase } from './client.js';
import { validatePassword } from '../../utils/passwordSecurity.js';

const notConfigured = { data: null, error: new Error('Supabase credentials are missing.') };

export async function register({ email, password, username }) {
  if (!supabase) return notConfigured;
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) return { data: null, error: new Error(passwordCheck.message) };

  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${window.location.origin}/settings`,
    },
  });
}

export async function login({ email, password }) {
  if (!supabase) return notConfigured;
  return supabase.auth.signInWithPassword({ email, password });
}

export async function logout() {
  if (!supabase) return { error: null };
  return supabase.auth.signOut();
}

export async function forgotPassword(email) {
  if (!supabase) return notConfigured;
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/settings`,
  });
}

export async function updatePassword(password) {
  if (!supabase) return notConfigured;
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) return { data: null, error: new Error(passwordCheck.message) };

  return supabase.auth.updateUser({ password });
}

export async function getSession() {
  if (!supabase) return { data: { session: null }, error: null };
  return supabase.auth.getSession();
}

export function onAuthChange(callback) {
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}
