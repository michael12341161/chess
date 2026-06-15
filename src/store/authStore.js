import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/supabase/auth.js';
import { getProfile, upsertProfile } from '../services/supabase/profiles.js';
import { uploadAvatar } from '../services/supabase/storage.js';
import { isSupabaseConfigured } from '../config/supabase.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import { validatePassword } from '../utils/passwordSecurity.js';
import { DEFAULT_RANKING_POINTS, getRankTitle } from '../utils/ranking.js';

const AuthContext = createContext(null);

function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
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
  if (crypto.randomUUID) return `local-${crypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `local-${bytesToHex(bytes)}`;
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
    if (!isSupabaseConfigured && !findLocalAccountByProfile(storedProfile)) {
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
  return {
    ...profile,
    wins: profile.wins ?? 0,
    losses: profile.losses ?? 0,
    draws: profile.draws ?? 0,
    ranking_points: rankingPoints,
    rank_title: profile.rank_title ?? getRankTitle(rankingPoints),
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(readLocalProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    authService.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        const response = await getProfile(data.session.user.id);
        setProfile(response.data ?? null);
      } else if (isSupabaseConfigured) {
        localStorage.removeItem(STORAGE_KEYS.PROFILE);
        setProfile(null);
      }
      setLoading(false);
    });

    const subscription = authService.onAuthChange(async (nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        const response = await getProfile(nextSession.user.id);
        setProfile(response.data ?? null);
      } else if (isSupabaseConfigured) {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const register = useCallback(async (payload) => {
    const email = normalizeEmail(payload.email);
    const passwordCheck = validatePassword(payload.password);
    if (!passwordCheck.valid) return { data: null, error: new Error(passwordCheck.message) };

    if (!isSupabaseConfigured) {
      if (findLocalAccountByEmail(email)) {
        return { data: null, error: new Error('An account already exists for this email. Use login instead.') };
      }

      let passwordSalt;
      let passwordHash;
      try {
        passwordSalt = createPasswordSalt();
        passwordHash = await hashLocalPassword(payload.password, passwordSalt);
      } catch (error) {
        return { data: null, error };
      }

      const localProfile = createBaseProfile({
        id: createLocalId(),
        username: payload.username || email.split('@')[0],
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
      writeLocalProfile(localProfile);
      setProfile(localProfile);
      setSession({ user: { id: localProfile.id, email } });
      return { data: { user: localProfile }, error: null };
    }

    const response = await authService.register(payload);
    if (!response.error && response.data?.user) {
      const nextProfile = createBaseProfile({
        id: response.data.user.id,
        username: payload.username,
      });
      await upsertProfile(nextProfile);
      setProfile(nextProfile);
    }
    return response;
  }, []);

  const login = useCallback(async (payload) => {
    if (!isSupabaseConfigured) {
      const email = normalizeEmail(payload.email);
      const account = findLocalAccountByEmail(email);
      if (!account) {
        return { data: null, error: new Error('No account found for this email. Create an account first.') };
      }

      let passwordHash;
      try {
        passwordHash = await hashLocalPassword(payload.password, account.passwordSalt);
      } catch (error) {
        return { data: null, error };
      }

      if (passwordHash !== account.passwordHash) {
        return { data: null, error: new Error('Invalid email or password.') };
      }

      const localProfile = createBaseProfile({
        ...account.profile,
        id: account.id ?? account.profile.id,
        email: account.email,
      });
      writeLocalProfile(localProfile);
      setProfile(localProfile);
      setSession({ user: { id: localProfile.id, email: account.email } });
      return { data: { user: localProfile }, error: null };
    }
    return authService.login(payload);
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    setProfile(null);
    setSession(null);
    return authService.logout();
  }, []);

  const updateProfile = useCallback(
    async (patch) => {
      const nextProfile = createBaseProfile({ ...(profile ?? {}), ...patch, id: profile?.id ?? session?.user?.id ?? 'local-user' });
      if (isSupabaseConfigured && session?.user) {
        const response = await upsertProfile(nextProfile);
        if (!response.error) setProfile(response.data);
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
      const response = await uploadAvatar(userId, file);
      if (!response.error && response.data?.publicUrl) {
        await updateProfile({ avatar_url: response.data.publicUrl });
      }
      return response;
    },
    [profile, session, updateProfile],
  );

  const value = useMemo(
    () => ({
      user: session?.user ?? (profile ? { id: profile.id, email: profile.email } : null),
      session,
      profile,
      loading,
      isAuthenticated: Boolean(session || profile),
      register,
      login,
      logout,
      forgotPassword: authService.forgotPassword,
      updateProfile,
      uploadProfileAvatar,
    }),
    [session, profile, loading, register, login, logout, updateProfile, uploadProfileAvatar],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuthStore() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthStore must be used inside AuthProvider.');
  return context;
}
