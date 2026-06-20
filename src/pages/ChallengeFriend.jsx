import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, ExternalLink, Handshake, RefreshCw, Send, Users, XCircle } from 'lucide-react';
import {
  acceptFriendChallenge,
  createOnlinePlayerChallenge,
  listFriendChallenges,
  subscribeToFriendChallenges,
  updateFriendChallengeStatus,
} from '../services/supabase/challenges.js';
import { listChallengeProfiles } from '../services/supabase/profiles.js';
import { subscribeToOnlineUserChanges, touchOnlineUser } from '../services/supabase/realtime.js';
import { isSupabaseConfigured } from '../config/supabase.js';
import { useAuthStore } from '../store/authStore.js';
import { formatRankingPoints, getRankTitle } from '../utils/ranking.js';

const ONLINE_PLAYERS_REFRESH_MS = 15000;
const ACTIVE_CHALLENGE_STATUSES = new Set(['pending', 'accepted']);
const CLOSED_CHALLENGE_STATUSES = new Set(['declined', 'canceled']);

const initialChallengeState = {
  colorPreference: 'random',
  players: [],
  challenges: [],
  loading: false,
  busyId: null,
  busyPlayerId: null,
};

function challengeStateReducer(state, action) {
  switch (action.type) {
    case 'set-color-preference':
      return { ...state, colorPreference: action.value };
    case 'set-players':
      return { ...state, players: action.players };
    case 'set-challenges':
      return { ...state, challenges: action.challenges };
    case 'set-loading':
      return { ...state, loading: action.loading };
    case 'set-busy-id':
      return { ...state, busyId: action.id };
    case 'set-busy-player-id':
      return { ...state, busyPlayerId: action.id };
    default:
      return state;
  }
}

function playerName(profile, fallback = 'Player') {
  return profile?.username ?? fallback;
}

function playerRank(profile) {
  if (!profile) return '';
  return `${profile.rank_title ?? getRankTitle(profile.ranking_points)} ${formatRankingPoints(profile.ranking_points)}`;
}

function challengeStatusText(challenge, userId, player) {
  if (!challenge) return player?.is_online ? 'Online' : 'Unavailable';
  if (challenge.status === 'pending' && challenge.opponent_id === userId) return 'Challenged you';
  if (challenge.status === 'pending') return 'Challenge sent';
  if (challenge.status === 'accepted' && challenge.game_id) return 'Game ready';
  return challenge.status ?? 'Online';
}

function challengePriority(challenge, userId) {
  if (challenge.status === 'pending' && challenge.opponent_id === userId) return 0;
  if (challenge.status === 'pending') return 1;
  if (challenge.status === 'accepted' && challenge.game_id) return 2;
  return 3;
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

function OnlinePlayerRow({ player, userId, challenge, busy, canSendChallenges, onChallenge, onAccept, onDecline, onCancel }) {
  const isCurrentUser = player.id === userId;
  const displayName = playerName(player, player.email?.split('@')[0] ?? 'Player');
  const initial = displayName.slice(0, 1).toUpperCase();
  const canChallenge = canSendChallenges && player.is_online && !isCurrentUser && Boolean(player.id);
  const rank = playerRank(player);
  const statusText = challengeStatusText(challenge, userId, player);
  const isIncoming = challenge?.status === 'pending' && challenge.opponent_id === userId;
  const isOutgoing = challenge?.status === 'pending' && challenge.challenger_id === userId;
  const isActive = challenge?.status === 'accepted' && challenge.game_id;

  return (
    <article className="online-player-row">
      <div className="online-player-avatar">
        {player.avatar_url ? <img src={player.avatar_url} alt="" /> : <span>{initial}</span>}
      </div>
      <div className="online-player-info">
        <strong>{displayName}</strong>
        <span>{rank ? `${rank} - ${statusText}` : statusText}</span>
      </div>
      <span
        className="online-status-dot"
        aria-label="Online"
        title="Online"
      />
      <div className="row-actions online-player-actions">
        {isCurrentUser ? (
          <button type="button" className="icon-button" disabled>
            <Users size={16} />
            <span>You</span>
          </button>
        ) : isIncoming ? (
          <>
            <button type="button" className="primary-button" disabled={busy} onClick={() => onAccept(challenge)}>
              <Check size={16} />
              <span>Accept</span>
            </button>
            <button type="button" className="icon-button danger-button" disabled={busy} onClick={() => onDecline(challenge)}>
              <XCircle size={16} />
              <span>Decline</span>
            </button>
          </>
        ) : isOutgoing ? (
          <button type="button" className="icon-button danger-button" disabled={busy} onClick={() => onCancel(challenge)}>
            <XCircle size={16} />
            <span>Cancel</span>
          </button>
        ) : isActive ? (
          <Link className="icon-button" to={`/play-friend/${challenge.game_id}`}>
            <ExternalLink size={16} />
            <span>Open</span>
          </Link>
        ) : (
          <button type="button" className="icon-button" disabled={!canChallenge || busy} onClick={() => onChallenge(player)}>
            <Send size={16} />
            <span>{busy ? 'Sending' : 'Challenge'}</span>
          </button>
        )}
      </div>
    </article>
  );
}

function OnlinePlayersPanel({ players, userId, challengeByPlayerId, busyId, busyPlayerId, canSendChallenges, onChallenge, onAccept, onDecline, onCancel }) {
  return (
    <section className="panel online-players-panel">
      <div className="panel-heading">
        <h2>Online Players</h2>
        <div className="online-panel-count">
          <Users size={18} />
          <span className="status-pill">{players.length}</span>
        </div>
      </div>
      <div className="online-player-list">
        {players.length ? (
          players.map((player) => {
            const challenge = challengeByPlayerId.get(player.id) ?? null;
            return (
              <OnlinePlayerRow
                key={player.id}
                player={player}
                userId={userId}
                challenge={challenge}
                busy={busyId === challenge?.id || busyPlayerId === player.id}
                canSendChallenges={canSendChallenges}
                onChallenge={onChallenge}
                onAccept={onAccept}
                onDecline={onDecline}
                onCancel={onCancel}
              />
            );
          })
        ) : (
          <p className="muted">No online players found.</p>
        )}
      </div>
    </section>
  );
}

export default function ChallengeFriend() {
  const auth = useAuthStore();
  const navigate = useNavigate();
  const userId = auth.isOnlineAccount ? auth.user?.id : null;
  const [challengeState, dispatchChallengeState] = useReducer(challengeStateReducer, initialChallengeState);

  const currentOnlinePlayer = useMemo(() => {
    if (!auth.isOnlineAccount || !auth.user?.id) return null;
    const email = auth.user.email ?? auth.profile?.email ?? '';
    const rankingPoints = auth.profile?.ranking_points ?? null;
    return {
      id: auth.user.id,
      email,
      username: auth.profile?.username ?? email.split('@')[0] ?? 'You',
      avatar_url: auth.profile?.avatar_url ?? null,
      ranking_points: rankingPoints,
      rank_title: auth.profile?.rank_title ?? getRankTitle(rankingPoints),
      online_at: new Date().toISOString(),
      is_online: true,
    };
  }, [auth.isOnlineAccount, auth.profile, auth.user]);

  const sortedPlayers = useMemo(() => {
    const playersById = new Map();
    if (currentOnlinePlayer) playersById.set(currentOnlinePlayer.id, currentOnlinePlayer);

    for (const player of challengeState.players) {
      if (!player.is_online || !player.id) continue;
      playersById.set(player.id, { ...playersById.get(player.id), ...player, is_online: true });
    }

    return [...playersById.values()].sort((left, right) => {
      const leftIsCurrentUser = left.id === userId;
      const rightIsCurrentUser = right.id === userId;
      if (leftIsCurrentUser !== rightIsCurrentUser) return leftIsCurrentUser ? -1 : 1;
      return (left.username || left.email || '').localeCompare(right.username || right.email || '');
    });
  }, [challengeState.players, currentOnlinePlayer, userId]);

  const refresh = useCallback(async ({ markLoading = true, touchPresence = true } = {}) => {
    if (!isSupabaseConfigured) return;
    if (markLoading) dispatchChallengeState({ type: 'set-loading', loading: true });
    if (auth.isOnlineAccount && touchPresence) {
      const presenceResponse = await touchOnlineUser();
      if (presenceResponse.error) {
        toast.error(`Online presence failed: ${presenceResponse.error.message}`);
      }
    }
    const [playersResponse, challengesResponse] = await Promise.all([
      listChallengeProfiles(),
      userId ? listFriendChallenges(userId) : Promise.resolve({ data: [], error: null }),
    ]);

    if (playersResponse.error) toast.error(playersResponse.error.message);
    else dispatchChallengeState({ type: 'set-players', players: (playersResponse.data ?? []).filter((player) => player.is_online) });

    if (challengesResponse.error) toast.error(challengesResponse.error.message);
    else dispatchChallengeState({ type: 'set-challenges', challenges: challengesResponse.data ?? [] });

    if (markLoading) dispatchChallengeState({ type: 'set-loading', loading: false });
  }, [auth.isOnlineAccount, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return undefined;
    const subscription = subscribeToFriendChallenges(userId, () => {
      refresh({ markLoading: false, touchPresence: false });
    });
    return () => subscription.unsubscribe();
  }, [refresh, userId]);

  useEffect(() => {
    if (!auth.isAuthenticated || !isSupabaseConfigured) return undefined;

    const subscription = subscribeToOnlineUserChanges(() => {
      refresh({ markLoading: false, touchPresence: false });
    });
    const refreshId = window.setInterval(() => {
      refresh({ markLoading: false, touchPresence: false });
    }, ONLINE_PLAYERS_REFRESH_MS);

    return () => {
      window.clearInterval(refreshId);
      subscription.unsubscribe();
    };
  }, [auth.isAuthenticated, refresh]);

  const groupedChallenges = useMemo(
    () => ({
      incoming: challengeState.challenges.filter((challenge) => challenge.status === 'pending' && challenge.opponent_id === userId),
      outgoing: challengeState.challenges.filter((challenge) => challenge.status === 'pending' && challenge.challenger_id === userId),
      active: challengeState.challenges.filter((challenge) => challenge.status === 'accepted' && challenge.game_id),
      closed: challengeState.challenges.filter((challenge) => CLOSED_CHALLENGE_STATUSES.has(challenge.status)),
    }),
    [challengeState.challenges, userId],
  );

  const challengeByPlayerId = useMemo(() => {
    const map = new Map();

    for (const challenge of challengeState.challenges) {
      if (!ACTIVE_CHALLENGE_STATUSES.has(challenge.status)) continue;
      if (challenge.status === 'accepted' && !challenge.game_id) continue;

      const otherPlayerId = challenge.challenger_id === userId ? challenge.opponent_id : challenge.challenger_id;
      if (!otherPlayerId || otherPlayerId === userId) continue;

      const existing = map.get(otherPlayerId);
      const nextPriority = challengePriority(challenge, userId);
      const existingPriority = existing ? challengePriority(existing, userId) : Number.POSITIVE_INFINITY;
      const nextUpdatedAt = new Date(challenge.updated_at ?? challenge.created_at ?? 0).getTime();
      const existingUpdatedAt = new Date(existing?.updated_at ?? existing?.created_at ?? 0).getTime();

      if (!existing || nextPriority < existingPriority || (nextPriority === existingPriority && nextUpdatedAt > existingUpdatedAt)) {
        map.set(otherPlayerId, challenge);
      }
    }

    return map;
  }, [challengeState.challenges, userId]);

  async function sendOnlineChallenge(player) {
    if (!player?.id || player.id === userId) return;
    if (!auth.isOnlineAccount) {
      toast.error('Logout, then sign in with a confirmed Supabase account to challenge players.');
      return;
    }

    dispatchChallengeState({ type: 'set-busy-player-id', id: player.id });
    const { data, error } = await createOnlinePlayerChallenge({
      opponentId: player.id,
      colorPreference: challengeState.colorPreference,
    });
    dispatchChallengeState({ type: 'set-busy-player-id', id: null });

    if (error) {
      toast.error(error.message);
      return;
    }

    const challenge = Array.isArray(data) ? data[0] : data;
    toast.success(challenge?.challenger_id === userId ? 'Challenge sent' : 'Challenge already pending');
    refresh({ markLoading: false, touchPresence: false });
  }

  async function acceptChallenge(challenge) {
    dispatchChallengeState({ type: 'set-busy-id', id: challenge.id });
    const { data: gameId, error } = await acceptFriendChallenge(challenge.id);
    dispatchChallengeState({ type: 'set-busy-id', id: null });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Challenge accepted');
    navigate(`/play-friend/${gameId}`);
  }

  async function setChallengeStatus(challenge, status) {
    dispatchChallengeState({ type: 'set-busy-id', id: challenge.id });
    const { error } = await updateFriendChallengeStatus(challenge.id, status);
    dispatchChallengeState({ type: 'set-busy-id', id: null });

    if (error) toast.error(error.message);
    else {
      toast.success(status === 'declined' ? 'Challenge declined' : 'Challenge canceled');
      refresh({ markLoading: false, touchPresence: false });
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
            <h1>Online Player Challenges</h1>
          </div>
          <p className="muted">Login from the header to see online players and receive challenges.</p>
        </section>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="content-grid">
        <section className="panel auth-panel">
          <div className="panel-heading">
            <h1>Online Player Challenges</h1>
          </div>
          <p className="muted">Online player challenges need Supabase. Add your Supabase URL and anon key to the React environment.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="content-grid challenge-page">
      <div className="section-title">
        <div>
          <h1>Online Player Challenges</h1>
          <p>Challenge online players and manage live match invites.</p>
        </div>
        <button type="button" className="icon-button" onClick={refresh} disabled={challengeState.loading}>
          <RefreshCw size={17} />
          <span>{challengeState.loading ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </div>

      {!auth.isOnlineAccount ? (
        <section className="panel challenge-login-notice">
          <p className="muted">Online Supabase players are shown below. To send challenges, logout and sign in with a confirmed Supabase account.</p>
        </section>
      ) : null}

      <div className="challenge-setup-grid">
        <section className="panel challenge-create-panel">
          <div className="panel-heading">
            <h2>Challenge Settings</h2>
            <Handshake size={20} />
          </div>
          <div className="challenge-form challenge-options-form">
            <label>
              Color
              <select value={challengeState.colorPreference} onChange={(event) => dispatchChallengeState({ type: 'set-color-preference', value: event.target.value })}>
                <option value="random">Random</option>
                <option value="white">I play White</option>
                <option value="black">I play Black</option>
              </select>
            </label>
          </div>
        </section>

        <OnlinePlayersPanel
          players={sortedPlayers}
          userId={userId}
          challengeByPlayerId={challengeByPlayerId}
          busyId={challengeState.busyId}
          busyPlayerId={challengeState.busyPlayerId}
          canSendChallenges={auth.isOnlineAccount}
          onChallenge={sendOnlineChallenge}
          onAccept={acceptChallenge}
          onDecline={(challenge) => setChallengeStatus(challenge, 'declined')}
          onCancel={(challenge) => setChallengeStatus(challenge, 'canceled')}
        />
      </div>

      <div className="challenge-grid">
        <ChallengeList
          title="Incoming Challenges"
          emptyText="No incoming challenges."
          challenges={groupedChallenges.incoming}
          userId={userId}
          busyId={challengeState.busyId}
          onAccept={acceptChallenge}
          onDecline={(challenge) => setChallengeStatus(challenge, 'declined')}
          onCancel={(challenge) => setChallengeStatus(challenge, 'canceled')}
        />
        <ChallengeList
          title="Outgoing Challenges"
          emptyText="No outgoing challenges."
          challenges={groupedChallenges.outgoing}
          userId={userId}
          busyId={challengeState.busyId}
          onAccept={acceptChallenge}
          onDecline={(challenge) => setChallengeStatus(challenge, 'declined')}
          onCancel={(challenge) => setChallengeStatus(challenge, 'canceled')}
        />
        <ChallengeList
          title="Accepted Games"
          emptyText="Accepted games appear here."
          challenges={groupedChallenges.active}
          userId={userId}
          busyId={challengeState.busyId}
          onAccept={acceptChallenge}
          onDecline={(challenge) => setChallengeStatus(challenge, 'declined')}
          onCancel={(challenge) => setChallengeStatus(challenge, 'canceled')}
        />
        <ChallengeList
          title="Closed"
          emptyText="Declined and canceled challenges appear here."
          challenges={groupedChallenges.closed.slice(0, 6)}
          userId={userId}
          busyId={challengeState.busyId}
          onAccept={acceptChallenge}
          onDecline={(challenge) => setChallengeStatus(challenge, 'declined')}
          onCancel={(challenge) => setChallengeStatus(challenge, 'canceled')}
        />
      </div>
    </div>
  );
}
