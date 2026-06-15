import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { formatRankingPoints, getRankTitle } from '../utils/ranking.js';

export default function ProfileCard() {
  const { profile, updateProfile, uploadProfileAvatar } = useAuthStore();
  const [username, setUsername] = useState(profile?.username ?? '');
  const rankingPoints = profile?.ranking_points;
  const rankTitle = profile?.rank_title ?? getRankTitle(rankingPoints);

  useEffect(() => {
    setUsername(profile?.username ?? '');
  }, [profile?.username]);

  const save = async (event) => {
    event.preventDefault();
    await updateProfile({ username });
  };

  const onAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (file) await uploadProfileAvatar(file);
  };

  return (
    <section className="panel profile-card">
      <div className="avatar-block">
        <div className="avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{(profile?.username ?? 'P').slice(0, 1).toUpperCase()}</span>}</div>
        <label className="icon-button file-button">
          <Upload size={18} />
          <span>Avatar</span>
          <input type="file" accept="image/*" onChange={onAvatar} />
        </label>
      </div>
      <form onSubmit={save} className="stack-form">
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
        </label>
        <div className="stats-row">
          <span>Title <strong>{rankTitle}</strong></span>
          <span>Points <strong>{formatRankingPoints(rankingPoints)}</strong></span>
          <span>Wins <strong>{profile?.wins ?? 0}</strong></span>
          <span>Losses <strong>{profile?.losses ?? 0}</strong></span>
          <span>Draws <strong>{profile?.draws ?? 0}</strong></span>
        </div>
        <button type="submit" className="primary-button">Save profile</button>
      </form>
    </section>
  );
}
