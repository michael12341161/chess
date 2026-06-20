import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, NavLink } from 'react-router-dom';
import { Crown, Handshake, History, Home, LogIn, LogOut, Settings, ShieldCheck, Trophy, User, UserPlus, Users } from 'lucide-react';
import AppRoutes from './routes/AppRoutes.jsx';
import AuthModal from './components/AuthModal.jsx';
import NotificationSystem from './components/NotificationSystem.jsx';
import { AuthProvider, useAuthStore } from './store/authStore.js';
import { LeaderboardProvider } from './store/leaderboardStore.js';
import { SettingsProvider } from './store/settingsStore.js';

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/play-ai', label: 'AI', icon: Crown },
  { to: '/play-local', label: 'Local', icon: Users },
  { to: '/challenge-friend', label: 'Online', icon: Handshake },
  { to: '/history', label: 'History', icon: History },
  { to: '/leaderboards', label: 'Leaders', icon: Trophy },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function AppShell() {
  const { adminLoading, adminSession, isAdmin, isAdminAuthenticated, isAuthenticated, loading, profile, logout, logoutAdmin } = useAuthStore();
  const [authModal, setAuthModal] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const displayName = profile?.username || profile?.email?.split('@')[0] || 'Player';
  const accountDisplayName = isAdminAuthenticated && !isAuthenticated ? 'Administrator' : displayName;
  const profileInitial = accountDisplayName.slice(0, 1).toUpperCase();
  const navLinks = isAdmin ? [...links, { to: '/admin', label: 'Admin', icon: ShieldCheck }] : links;
  const hasAccount = isAuthenticated || isAdminAuthenticated;

  useEffect(() => {
    if (!accountMenuOpen) return undefined;

    function handlePointerDown(event) {
      if (!accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!hasAccount) {
      setAccountMenuOpen(false);
    }
  }, [hasAccount]);

  async function handleLogout() {
    setAccountMenuOpen(false);
    if (adminSession?.session_token) await logoutAdmin();
    if (isAuthenticated) await logout();
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <NavLink to="/" className="brand">
            <span className="brand-mark">♞</span>
            <span>Chess Platform</span>
          </NavLink>
          <nav className="main-nav" aria-label="Primary">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                <Icon size={17} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          {loading || adminLoading ? (
            <div className="header-auth-actions" aria-label="Account loading">
              <span className="auth-loading">Account</span>
            </div>
          ) : hasAccount ? (
            <div className="header-account-menu" ref={accountMenuRef}>
              <button
                type="button"
                className="header-avatar-button"
                aria-label={`${accountDisplayName} account menu`}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="header-avatar">
                  {isAuthenticated && profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{profileInitial}</span>}
                </span>
              </button>
              {accountMenuOpen ? (
                <div className="account-dropdown" role="menu">
                  <div className="account-dropdown-header">
                    <span className="header-avatar">
                      {isAuthenticated && profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{profileInitial}</span>}
                    </span>
                    <span className="account-dropdown-name">{accountDisplayName}</span>
                  </div>
                  {isAuthenticated ? (
                    <NavLink
                      to="/profile"
                      className={({ isActive }) => (isActive ? 'account-dropdown-item active' : 'account-dropdown-item')}
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <User size={16} />
                      <span>Profile</span>
                    </NavLink>
                  ) : null}
                  {isAdmin ? (
                    <NavLink
                      to="/admin"
                      className={({ isActive }) => (isActive ? 'account-dropdown-item active' : 'account-dropdown-item')}
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <ShieldCheck size={16} />
                      <span>Admin Dashboard</span>
                    </NavLink>
                  ) : null}
                  <button type="button" className="account-dropdown-item danger-button" role="menuitem" onClick={() => void handleLogout()}>
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="header-auth-actions" aria-label="Account">
              <button type="button" className="auth-header-button icon-button" onClick={() => setAuthModal('login')}>
                <LogIn size={17} />
                <span>Login</span>
              </button>
              <button type="button" className="auth-header-button primary-button" onClick={() => setAuthModal('register')}>
                <UserPlus size={17} />
                <span>Register</span>
              </button>
            </div>
          )}
        </header>
        <main className="page-shell">
          <AppRoutes />
        </main>
        <NotificationSystem />
        <AuthModal open={Boolean(authModal)} initialMode={authModal ?? 'login'} onClose={() => setAuthModal(null)} />
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <LeaderboardProvider>
          <AppShell />
        </LeaderboardProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}