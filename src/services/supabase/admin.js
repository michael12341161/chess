import { supabase } from './client.js';

const notConfigured = {
  data: null,
  error: new Error('Supabase is required for Admin Dashboard user management.'),
};

function firstRow(data) {
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

function normalizeRpcResponse(response, { single = false } = {}) {
  if (response.error) return { data: single ? null : [], error: response.error };
  return { data: single ? firstRow(response.data) : response.data ?? [], error: null };
}

export async function loginAdmin({ username, password }) {
  if (!supabase) return notConfigured;
  const response = await supabase.rpc('admin_login', {
    target_username: username,
    target_password: password,
  });
  return normalizeRpcResponse(response, { single: true });
}

export async function validateAdminSession(sessionToken) {
  if (!supabase || !sessionToken) return { data: null, error: null };
  const response = await supabase.rpc('admin_validate_session', {
    admin_session_token: sessionToken,
  });
  return normalizeRpcResponse(response, { single: true });
}

export async function logoutAdmin(sessionToken) {
  if (!supabase || !sessionToken) return { data: true, error: null };
  const response = await supabase.rpc('admin_logout', {
    admin_session_token: sessionToken,
  });
  if (response.error) return { data: false, error: response.error };
  return { data: true, error: null };
}

export async function listAdminUsers(sessionToken, filters = {}) {
  if (!supabase) return notConfigured;
  const response = await supabase.rpc('admin_list_users', {
    admin_session_token: sessionToken ?? null,
    search_text: filters.search ?? '',
    status_filter: filters.status ?? 'all',
    role_filter: filters.role ?? 'all',
  });
  return normalizeRpcResponse(response);
}

export async function getAdminUser(sessionToken, userId) {
  if (!supabase) return notConfigured;
  const response = await supabase.rpc('admin_get_user', {
    admin_session_token: sessionToken ?? null,
    target_user_id: userId,
  });
  return normalizeRpcResponse(response, { single: true });
}

export async function updateAdminUser(sessionToken, userId, patch) {
  if (!supabase) return notConfigured;
  const response = await supabase.rpc('admin_update_user', {
    admin_session_token: sessionToken ?? null,
    target_user_id: userId,
    target_full_name: patch.full_name ?? '',
    target_email: patch.email ?? '',
    target_role: patch.role ?? 'user',
    target_account_status: patch.account_status ?? 'active',
  });
  return normalizeRpcResponse(response, { single: true });
}

export async function setAdminUserStatus(sessionToken, userId, status) {
  if (!supabase) return notConfigured;
  const response = await supabase.rpc('admin_set_user_status', {
    admin_session_token: sessionToken ?? null,
    target_user_id: userId,
    target_account_status: status,
  });
  return normalizeRpcResponse(response, { single: true });
}

export async function deleteAdminUser(sessionToken, userId) {
  if (!supabase) return notConfigured;
  const response = await supabase.rpc('admin_delete_user', {
    admin_session_token: sessionToken ?? null,
    target_user_id: userId,
  });
  if (response.error) return { data: false, error: response.error };
  return { data: Boolean(response.data), error: null };
}