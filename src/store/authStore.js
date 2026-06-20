import { createContext, createElement, useCallback, use, useEffect, useMemo, useState } from 'react';
import * as adminService from '../services/supabase/admin.js';
import * as authService from '../services/supabase/auth.js';
import { getProfile, upsertProfile } from '../services/supabase/profiles.js';
import { subscribeToOnlineUsers } from '../services/supabase/realtime.js';
import { uploadAvatar } from '../services/supabase/storage.js';
import { isSupabaseConfigured } from '../config/supabase.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import { validatePassword } from '../utils/passwordSecurity.js';
import { DEFAULT_RANKING_POINTS, getRankTitle } from '../utils/ranking.js';

const AuthContext = createContext(null);
const LOCAL_USER_ID_PREFIX = 'local-';
const ADMIN_ROLE = 'admin';
const ACTIVE_STATUS = 'active';
const EMAIL_RATE_LIMIT_FALLBACK_MESSAGE =
  'Supabase email limit reached, so this account was saved on this device. Online challenges need a Supabase account after the email limit resets.';
const EMAIL_RATE_LIMIT_MESSAGE =
  'Supabase email limit reached. Try again later, or configure a custom SMTP provider in Supabase Authentication settings.';

function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

function isLocalUserId(userId) {
  return String(userId ?? '').startsWith(LOCAL_USER_ID_PREFIX);
}

function isLocalProfile(profile) {
  return isLocalUserId(profile?.id);
}

function isInactiveProfile(profile) {
  return profile?.account_status === 'inactive';
}

function profileHasAdminRole(profile) {
  return profile?.role === ADMIN_ROLE && profile?.account_status !== 'inactive';
}

function normalizeAdminSession(row) {
  if (!row?.session_token) return null;
  return {
    username: row.admin_username ?? row.username ?? 'admin',
    role: row.role ?? ADMIN_ROLE,
    session_token: row.session_token,
    expires_at: row.expires_at,
  };
}

function readAdminSession() {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) ?? 'null');
    if (!session?.session_token) return null;
    if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    return null;
  }
}

function writeAdminSession(session) {
  localStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(session));
}

function clearAdminSession() {
  localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
}

function isEmailRateLimitError(error) {
  const details = `${error?.message ?? ''} ${error?.code ?? ''} ${error?.name ?? ''}`.toLowerCase();
  return details.includes('over_email_send_rate_limit') || details.includes('email rate limit') || (details.includes('email') && details.includes('rate limit'));
}

function friendlyAuthError(error) {
  if (!error) return null;
  const message = String(error.message ?? '');
  if (isEmailRateLimitError(error)) return new Error(EMAIL_RATE_LIMIT_MESSAGE);
  if (/invalid login credentials/i.test(message)) return new Error('Invalid email or password.');
  return error;
}

function withFriendlyAuthError(response) {
  if (!response?.error) return response;
  return { ...response, error: friendlyAuthError(response.error) };
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requireLocalCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Secure local account storage is unavailable in this browser.');
  }
  return globalThis.crypto;
}

function createLocalId() {
  const crypto = requireLocalCrypto();
  if (crypto.randomUUID) return `${LOCAL_USER_ID_PREFIX}${crypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `${LOCAL_USER_ID_PREFIX}${bytesToHex(bytes)}`;
}

function createPasswordSalt() {
  const crypto = requireLocalCrypto();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashLocalPassword(password, salt) {
  const crypto = requireLocalCrypto();
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(digest));
}

function readLocalAccounts() {
  try {
    const accounts = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_ACCOUNTS) ?? '[]');
    if (!Array.isArray(accounts)) return [];
    return accounts.filter((account) => account?.email && account?.passwordSalt && account?.passwordHash && account?.profile?.id);
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts) {
  localStorage.setItem(STORAGE_KEYS.LOCAL_ACCOUNTS, JSON.stringify(accounts));
}

function findLocalAccountByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return readLocalAccounts().find((account) => account.email === normalizedEmail) ?? null;
}

function findLocalAccountByProfile(profile) {
  if (!profile) return null;
  const profileEmail = normalizeEmail(profile.email);
  return (
    readLocalAccounts().find(
      (account) => account.profile?.id === profile.id || (profileEmail && account.email === profileEmail),
    ) ?? null
  );
}

async function createLocalAccount(payload) {
  const email = normalizeEmail(payload.email);
  if (findLocalAccountByEmail(email)) {
    return { data: null, profile: null, error: new Error('An account already exists for this email. Use login instead.') };
  }

  let passwordSalt;
  let passwordHash;
  try {
    passwordSalt = createPasswordSalt();
    passwordHash = await hashLocalPassword(payload.password, passwordSalt);
  } catch (error) {
    return { data: null, profile: null, error };
  }

  const localProfile = createBaseProfile({
    id: createLocalId(),
    username: payload.username || email.split('@')[0],
    full_name: payload.full_name ?? payload.username ?? email.split('@')[0],
    email,
  });
  writeLocalAccounts([
    ...readLocalAccounts(),
    {
      id: localProfile.id,
      email,
      passwordSalt,
      passwordHash,
      profile: localProfile,
      createdAt: new Date().toISOString(),
    },
  ]);

  return { data: { user: localProfile }, profile: localProfile, error: null, authMode: 'local' };
}

async function loginLocalAccount(payload) {
  const email = normalizeEmail(payload.email);
  const account = findLocalAccountByEmail(email);
  if (!account) {
    return { data: null, profile: null, error: new Error('No account found for this email. Create an account first.') };
  }

  let passwordHash;
  try {
    passwordHash = await hashLocalPassword(payload.password, account.passwordSalt);
  } catch (error) {
    return { data: null, profile: null, error };
  }

  if (passwordHash !== account.passwordHash) {
    return { data: null, profile: null, error: new Error('Invalid email or password.') };
  }

  const localProfile = createBaseProfile({
    ...account.profile,
    id: account.id ?? account.profile.id,
    email: account.email,
  });
  if (isInactiveProfile(localProfile)) {
    return { data: null, profile: null, error: new Error('This account is inactive.') };
  }

  return { data: { user: localProfile }, profile: localProfile, error: null, authMode: 'local' };
}

function updateLocalAccountProfile(nextProfile) {
  const profileEmail = normalizeEmail(nextProfile.email);
  const accounts = readLocalAccounts();
  const nextAccounts = accounts.map((account) => {
    const sameAccount = account.profile?.id === nextProfile.id || (profileEmail && account.email === profileEmail);
    return sameAccount ? { ...account, profile: nextProfile } : account;
  });
  writeLocalAccounts(nextAccounts);
}

function readLocalProfile() {
  try {
    const storedProfile = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILE) ?? 'null');
    if (!storedProfile) return null;
    const localAccount = findLocalAccountByProfile(storedProfile);
    if (isLocalProfile(storedProfile) && !localAccount) {
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      return null;
    }
    if (!isSupabaseConfigured && !localAccount) {
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      return null;
    }
    if (isInactiveProfile(storedProfile)) {
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      return null;
    }
    return storedProfile;
  } catch {
    return null;
  }
}

function writeLocalProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
}

function createBaseProfile(profile) {
  const rankingPoints = profile.ranking_points ?? DEFAULT_RANKING_POINTS;
  const createdAt = profile.registered_at ?? profile.created_at ?? new Date().toISOString();
  return {
    ...profile,
    full_name: profile.full_name ?? profile.username ?? '',
    wins: profile.wins ?? 0,
    losses: profile.losses ?? 0,
    draws: profile.draws ?? 0,
    ranking_points: rankingPoints,
    rank_title: profile.rank_title ?? getRankTitle(rankingPoints),
    role: profile.role ?? 'user',
    account_status: profile.account_status ?? ACTIVE_STATUS,
    registered_at: createdAt,
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(readLocalProfile);
  const [loading, setLoading] = useState(true);
  const [adminSession, setAdminSession] = useState(readAdminSession);
  const [adminLoading, setAdminLoading] = useState(() => Boolean(readAdminSession()));
  const [onlineUsers, setOnlineUsers] = useState([]);
  const activateLocalSession = useCallback((localProfile) => {
    writeLocalProfile(localProfile);
    setProfile(localProfile);
    setSession({ user: { id: localProfile.id, email: localProfile.email } });
  }, []);

  const clearCurrentUser = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    setProfile(null);
    setSession(null);
    await authService.logout();
  }, []);

  useEffect(() => {
    let mounted = true;

    authService.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        const response = await getProfile(data.session.user.id);
        if (isInactiveProfile(response.data)) {
          await clearCurrentUser();
        } else {
          setProfile(response.data ? createBaseProfile(response.data) : null);
        }
      } else if (isSupabaseConfigured) {
        const localProfile = readLocalProfile();
        if (isLocalProfile(localProfile)) {
          setProfile(localProfile);
        } else {
          localStorage.removeItem(STORAGE_KEYS.PROFILE);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    const subscription = authService.onAuthChange(async (nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        const response = await getProfile(nextSession.user.id);
        if (isInactiveProfile(response.data)) {
          await clearCurrentUser();
        } else {
          setProfile(response.data ? createBaseProfile(response.data) : null);
        }
      } else if (isSupabaseConfigured) {
        setProfile((currentProfile) => {
          if (isLocalProfile(currentProfile) && findLocalAccountByProfile(currentProfile)) return currentProfile;
          localStorage.removeItem(STORAGE_KEYS.PROFILE);
          return null;
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearCurrentUser]);

  useEffect(() => {
    let mounted = true;
    const storedAdminSession = readAdminSession();
    if (!storedAdminSession?.session_token || !isSupabaseConfigured) {
      setAdminLoading(false);
      return undefined;
    }

    adminService.validateAdminSession(storedAdminSession.session_token).then((response) => {
      if (!mounted) return;
      if (response.error || !response.data) {
        clearAdminSession();
        setAdminSession(null);
        setAdminLoading(false);
        return;
      }

      const nextSession = normalizeAdminSession({ ...response.data, session_token: storedAdminSession.session_token });
      if (!nextSession) {
        clearAdminSession();
        setAdminSession(null);
      } else {
        writeAdminSession(nextSession);
        setAdminSession(nextSession);
      }
      setAdminLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const onlineUser = useMemo(() => {
    const user = session?.user;
    if (!isSupabaseConfigured || !user?.id || isLocalUserId(user.id) || isInactiveProfile(profile)) return null;
    const email = user.email ?? profile?.email ?? '';
    return {
      id: user.id,
      email,
      username: profile?.username ?? email.split('@')[0] ?? '',
      avatar_url: profile?.avatar_url ?? null,
      ranking_points: profile?.ranking_points ?? null,
      rank_title: profile?.rank_title ?? null,
    };
  }, [
    session?.user,
    profile,
    profile?.email,
    profile?.username,
    profile?.avatar_url,
    profile?.ranking_points,
    profile?.rank_title,
  ]);

  useEffect(() => {
    if (!onlineUser) {
      setOnlineUsers([]);
      return undefined;
    }

    const subscription = subscribeToOnlineUsers(onlineUser, setOnlineUsers);
    return () => subscription.unsubscribe();
  }, [onlineUser]);

  const register = useCallback(async (payload) => {
    const email = normalizeEmail(payload.email);
    const passwordCheck = validatePassword(payload.password);
    if (!passwordCheck.valid) return { data: null, error: new Error(passwordCheck.message) };

    if (!isSupabaseConfigured) {
      const localResponse = await createLocalAccount({ ...payload, email });
      if (!localResponse.error) activateLocalSession(localResponse.profile);
      return localResponse;
    }

    const response = await authService.register({ ...payload, email, full_name: payload.full_name ?? payload.username });
    if (isEmailRateLimitError(response.error)) {
      const localResponse = await createLocalAccount({ ...payload, email });
      if (localResponse.error) {
        return {
          data: null,
          error: new Error(`${EMAIL_RATE_LIMIT_MESSAGE} ${localResponse.error.message}`),
        };
      }
      activateLocalSession(localResponse.profile);
      return { ...localResponse, message: EMAIL_RATE_LIMIT_FALLBACK_MESSAGE };
    }

    if (!response.error && response.data?.user) {
      const nextProfile = createBaseProfile({
        id: response.data.user.id,
        username: payload.username,
        full_name: payload.full_name ?? payload.username,
        email,
      });
      await upsertProfile(nextProfile);
      setProfile(nextProfile);
    }
    return withFriendlyAuthError(response);
  }, [activateLocalSession]);

  const login = useCallback(async (payload) => {
    const email = normalizeEmail(payload.email);
    if (!isSupabaseConfigured) {
      const localResponse = await loginLocalAccount({ ...payload, email });
      if (!localResponse.error) activateLocalSession(localResponse.profile);
      return localResponse;
    }

    const response = await authService.login({ ...payload, email });
    if (!response.error) {
      const profileResponse = await getProfile(response.data?.user?.id);
      if (isInactiveProfile(profileResponse.data)) {
        await clearCurrentUser();
        return { data: null, error: new Error('This account is inactive. Contact an administrator to reactivate it.') };
      }
      if (profileResponse.data) setProfile(createBaseProfile(profileResponse.data));
      return response;
    }

    if (findLocalAccountByEmail(email)) {
      const localResponse = await loginLocalAccount({ ...payload, email });
      if (!localResponse.error) {
        activateLocalSession(localResponse.profile);
        return { ...localResponse, message: 'Logged in with the local account saved on this device.' };
      }
      return localResponse;
    }

    return withFriendlyAuthError(response);
  }, [activateLocalSession, clearCurrentUser]);

  const loginAdmin = useCallback(async (payload) => {
    const response = await adminService.loginAdmin(payload);
    if (response.error) return response;

    const nextSession = normalizeAdminSession(response.data);
    if (!nextSession) return { data: null, error: new Error('Admin login did not return a session.') };

    writeAdminSession(nextSession);
    setAdminSession(nextSession);
    return { data: nextSession, error: null };
  }, []);

  const logoutAdmin = useCallback(async () => {
    const sessionToken = adminSession?.session_token;
    clearAdminSession();
    setAdminSession(null);
    if (!sessionToken) return { error: null };
    return adminService.logoutAdmin(sessionToken);
  }, [adminSession?.session_token]);

  const logout = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    setProfile(null);
    setSession(null);
    return authService.logout();
  }, []);

  const updateProfile = useCallback(
    async (patch) => {
      const nextProfile = createBaseProfile({ ...(profile ?? {}), ...patch, id: profile?.id ?? session?.user?.id ?? 'local-user' });
      if (isSupabaseConfigured && session?.user && !isLocalUserId(session.user.id)) {
        const response = await upsertProfile(nextProfile);
        if (!response.error) setProfile(createBaseProfile({ ...nextProfile, ...response.data }));
        return response;
      }
      writeLocalProfile(nextProfile);
      updateLocalAccountProfile(nextProfile);
      setProfile(nextProfile);
      return { data: nextProfile, error: null };
    },
    [profile, session],
  );

  const uploadProfileAvatar = useCallback(
    async (file) => {
      const userId = session?.user?.id ?? profile?.id;
      if (!userId || isLocalUserId(userId)) {
        return { data: null, error: new Error('Avatar upload needs a Supabase account.') };
      }
      const response = await uploadAvatar(userId, file);
      if (!response.error && response.data?.publicUrl) {
        await updateProfile({ avatar_url: response.data.publicUrl });
      }
      return response;
    },
    [profile, session, updateProfile],
  );

  const forgotPassword = useCallback(async (emailValue) => {
    const response = await authService.forgotPassword(normalizeEmail(emailValue));
    return withFriendlyAuthError(response);
  }, []);

  const isOnlineAccount = Boolean(isSupabaseConfigured && session?.user && !isLocalUserId(session.user.id));
  const isAdmin = Boolean(adminSession?.session_token || profileHasAdminRole(profile));
  const isAdminAuthenticated = Boolean(adminSession?.session_token);

  const value = useMemo(
    () => ({
      user: session?.user ?? (profile ? { id: profile.id, email: profile.email } : null),
      session,
      profile,
      onlineUsers,
      loading,
      adminLoading,
      adminSession,
      adminAccessToken: adminSession?.session_token ?? null,
      isAuthenticated: Boolean(session || profile),
      isOnlineAccount,
      isAdmin,
      isAdminAuthenticated,
      register,
      login,
      loginAdmin,
      logout,
      logoutAdmin,
      forgotPassword,
      updateProfile,
      uploadProfileAvatar,
    }),
    [
      session,
      profile,
      onlineUsers,
      loading,
      adminLoading,
      adminSession,
      isOnlineAccount,
      isAdmin,
      isAdminAuthenticated,
      register,
      login,
      loginAdmin,
      logout,
      logoutAdmin,
      forgotPassword,
      updateProfile,
      uploadProfileAvatar,
    ],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuthStore() {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuthStore must be used inside AuthProvider.');
  return context;
}