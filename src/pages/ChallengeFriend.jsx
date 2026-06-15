import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, ExternalLink, Handshake, RefreshCw, Send, XCircle } from 'lucide-react';
import {
  acceptFriendChallenge,
  createFriendChallenge,
  listFriendChallenges,
  subscribeToFriendChallenges,
  updateFriendChallengeStatus,
} from '../services/supabase/challenges.js';
import { isSupabaseConfigured } from '../config/supabase.js';
import { useAuthStore } from '../store/authStore.js';
import { formatRankingPoints, getRankTitle } from '../utils/ranking.js';

function playerName(profile, fallback = 'Player') {
  return profile?.username ?? fallback;
}

function playerRank(profile) {
  if (!profile) return '';
  return `${profile.rank_title ?? getRankTitle(profile.ranking_points)} ${formatRankingPoints(profile.ranking_points)}`;
}

function ChallengeRow({ challenge, userId, busy, onAccept, onDecline, onCancel }) {
  const isIncoming = challenge.opponent_id === userId;
  const friend = isIncoming ? challenge.challenger : challenge.opponent;
  const friendLabel = playerName(friend, isIncoming ? 'Challenger' : 'Opponent');
  const status = challenge.status ?? 'pending';

  return (
    <article className="challenge-row">
      <div className="challenge-player">
        <strong>{friendLabel}</strong>
        <span>{playerRank(friend) || status}</span>
      </div>
      <div className="challenge-meta">
        <span className="status-pill">{status}</span>
        <small>{new Date(challenge.updated_at ?? challenge.created_at).toLocaleString()}</small>
      </div>
      <div className="row-actions">
        {status === 'pending' && isIncoming ? (
          <>
            <button type="button" className="primary-button" disabled={busy} onClick={() => onAccept(challenge)}>
              <Check size={17} />
              <span>Accept</span>
            </button>
            <button type="button" className="icon-button danger-button" disabled={busy} onClick={() => onDecline(challenge)}>
              <XCircle size={17} />
              <span>Decline</span>
            </button>
          </>
        ) : null}
        {status === 'pending' && !isIncoming ? (
          <button type="button" className="icon-button danger-button" disabled={busy} onClick={() => onCancel(challenge)}>
            <XCircle size={17} />
            <span>Cancel</span>
          </button>
        ) : null}
        {status === 'accepted' && challenge.game_id ? (
          <Link className="icon-button" to={`/play-friend/${challenge.game_id}`}>
            <ExternalLink size={17} />
            <span>Open</span>
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function ChallengeList({ title, emptyText, challenges, userId, busyId, onAccept, onDecline, onCancel }) {
  return (
    <section className="panel challenge-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <span className="status-pill">{challenges.length}</span>
      </div>
      <div className="challenge-list">
        {challenges.length ? (
          challenges.map((challenge) => (
            <ChallengeRow
              key={challenge.id}
              challenge={challenge}
              userId={userId}
              busy={busyId === challenge.id}
              onAccept={onAccept}
              onDecline={onDecline}
              onCancel={onCancel}
            />
          ))
        ) : (
          <p className="muted">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

export default function ChallengeFriend() {
  const auth = useAuthStore();
  const navigate = useNavigate();
  const userId = auth.user?.id;
  const [opponentUsername, setOpponentUsername] = useState('');
  const [colorPreference, setColorPreference] = useState('random');
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) return;
    setLoading(true);
    const { data, error } = await listFriendChallenges(userId);
    if (error) toast.error(error.message);
    else setChallenges(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return undefined;
    const subscription = subscribeToFriendChallenges(userId, () => {
      refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh, userId]);

  const groupedChallenges = useMemo(
    () => ({
      incoming: challenges.filter((challenge) => challenge.status === 'pending' && challenge.opponent_id === userId),
      outgoing: challenges.filter((challenge) => challenge.status === 'pending' && challenge.challenger_id === userId),
      active: challenges.filter((challenge) => challenge.status === 'accepted' && challenge.game_id),
      closed: challenges.filter((challenge) => ['declined', 'canceled'].includes(challenge.status)),
    }),
    [challenges, userId],
  );

  async function sendChallenge(event) {
    event.preventDefault();
    setSending(true);
    const { error } = await createFriendChallenge({
      challengerId: userId,
      opponentUsername,
      colorPreference,
    });
    setSending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setOpponentUsername('');
    toast.success('Challenge sent');
    refresh();
  }

  async function acceptChallenge(challenge) {
    setBusyId(challenge.id);
    const { data: gameId, error } = await acceptFriendChallenge(challenge.id);
    setBusyId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Challenge accepted');
    navigate(`/play-friend/${gameId}`);
  }

  async function setChallengeStatus(challenge, status) {
    setBusyId(challenge.id);
    const { error } = await updateFriendChallengeStatus(challenge.id, status);
    setBusyId(null);

    if (error) toast.error(error.message);
    else {
      toast.success(status === 'declined' ? 'Challenge declined' : 'Challenge canceled');
      refresh();
    }
  }

  if (auth.loading) {
    return (
      <div className="content-grid">
        <section className="panel auth-panel">
          <p className="muted">Checking account status.</p>
        </section>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="content-grid">
        <section className="panel auth-panel">
          <div className="panel-heading">
            <h1>Challenge Friend</h1>
          </div>
          <p className="muted">Login from the header to send and receive friend challenges.</p>
        </section>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="content-grid">
        <section className="panel auth-panel">
          <div className="panel-heading">
            <h1>Challenge Friend</h1>
          </div>
          <p className="muted">Friend challenges need Supabase. Add your Supabase URL and anon key to the React environment.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="content-grid challenge-page">
      <div className="section-title">
        <div>
          <h1>Challenge Friend</h1>
          <p>Send a match invite by username and play a synced friend game.</p>
        </div>
        <button type="button" className="icon-button" onClick={refresh} disabled={loading}>
          <RefreshCw size={17} />
          <span>{loading ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </div>

      <section className="panel challenge-create-panel">
        <div className="panel-heading">
          <h2>New Challenge</h2>
          <Handshake size={20} />
        </div>
        <form className="challenge-form" onSubmit={sendChallenge}>
          <label>
            Friend username
            <input
              value={opponentUsername}
              onChange={(event) => setOpponentUsername(event.target.value)}
              placeholder="Enter exact username"
              required
            />
          </label>
          <label>
            Color
            <select value={colorPreference} onChange={(event) => setColorPreference(event.target.value)}>
              <option value="random">Random</option>
              <option value="white">I play White</option>
              <option value="black">I play Black</option>
            </select>
          </label>
          <button type="submit" className="primary-button" disabled={sending || !opponentUsername.trim()}>
            <Send size={17} />
            <span>{sending ? 'Sending' : 'Send Challenge'}</span>
          </button>
        </form>
      </section>

      <div className="challenge-grid">
        <ChallengeList
          title="Incoming"
          emptyText="No incoming challenges."
          challenges={groupedChallenges.incoming}
          userId={userId}
          busyId={busyId}
          onAccept={acceptChallenge}
          onDecline={(challenge) => setChallengeStatus(challenge, 'declined')}
          onCancel={(challenge) => setChallengeStatus(challenge, 'canceled')}
        />
        <ChallengeList
          title="Outgoing"
          emptyText="No outgoing challenges."
          challenges={groupedChallenges.outgoing}
          userId={userId}
          busyId={busyId}
          onAccept={acceptChallenge}
          onDecline={(challenge) => setChallengeStatus(challenge, 'declined')}
          onCancel={(challenge) => setChallengeStatus(challenge, 'canceled')}
        />
        <ChallengeList
          title="Accepted Games"
          emptyText="Accepted games appear here."
          challenges={groupedChallenges.active}
          userId={userId}
          busyId={busyId}
          onAccept={acceptChallenge}
          onDecline={(challenge) => setChallengeStatus(challenge, 'declined')}
          onCancel={(challenge) => setChallengeStatus(challenge, 'canceled')}
        />
        <ChallengeList
          title="Closed"
          emptyText="Declined and canceled challenges appear here."
          challenges={groupedChallenges.closed.slice(0, 6)}
          userId={userId}
          busyId={busyId}
          onAccept={acceptChallenge}
          onDecline={(challenge) => setChallengeStatus(challenge, 'declined')}
          onCancel={(challenge) => setChallengeStatus(challenge, 'canceled')}
        />
      </div>
    </div>
  );
}
