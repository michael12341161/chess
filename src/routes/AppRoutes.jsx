import { Navigate, Route, Routes } from 'react-router-dom';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import GameHistory from '../pages/GameHistory.jsx';
import GameAnalysis from '../pages/GameAnalysis.jsx';
import ChallengeFriend from '../pages/ChallengeFriend.jsx';
import Home from '../pages/Home.jsx';
import Leaderboards from '../pages/Leaderboards.jsx';
import PlayAI from '../pages/PlayAI.jsx';
import PlayFriend from '../pages/PlayFriend.jsx';
import PlayLocal from '../pages/PlayLocal.jsx';
import Profile from '../pages/Profile.jsx';
import Settings from '../pages/Settings.jsx';
import { useAuthStore } from '../store/authStore.js';

function AdminRoute() {
  const { adminLoading, isAdmin, loading } = useAuthStore();

  if (loading || adminLoading) {
    return (
      <section className="panel auth-panel">
        <p className="muted">Checking admin access.</p>
      </section>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;
  return <AdminDashboard />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="/play-ai" element={<PlayAI />} />
      <Route path="/play-local" element={<PlayLocal />} />
      <Route path="/challenge-friend" element={<ChallengeFriend />} />
      <Route path="/play-friend/:gameId" element={<PlayFriend />} />
      <Route path="/analysis" element={<GameAnalysis />} />
      <Route path="/history" element={<GameHistory />} />
      <Route path="/leaderboards" element={<Leaderboards />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/admin" element={<AdminRoute />} />
    </Routes>
  );
}