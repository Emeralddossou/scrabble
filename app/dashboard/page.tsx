'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SoloLauncher } from '@/components/solo-launcher';
import { cached, putCache, rpc } from '@/lib/client';

type InvitationSummary = {
  id: number;
  mode: 'free' | 'timer';
  time_limit_seconds: number;
  increment_seconds: number;
};

type Dash = {
  user: { id: number; username: string; wins: number; losses: number; draws: number };
  games: Array<{
    id: number;
    uuid: string;
    opponent: string | null;
    mode: 'free' | 'timer';
    status: 'active' | 'finished';
    current_player_id: number;
  }>;
  online: Array<{ id: number; username: string; wins: number }>;
  invites: Array<InvitationSummary & { from_username: string }>;
  sentInvites: Array<InvitationSummary & { to_username: string }>;
  leaders: Array<{ id: number; username: string; wins: number }>;
};

function invitationLabel(invitation: InvitationSummary): string {
  return invitation.mode === 'timer'
    ? `${Math.floor(invitation.time_limit_seconds / 60)} min + ${invitation.increment_seconds} s`
    : 'Partie libre, sans limite de temps';
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState('');
  const [inviteMode, setInviteMode] = useState<'free' | 'timer'>('free');
  const [timeLimit, setTimeLimit] = useState(15);
  const [increment, setIncrement] = useState(0);
  const [busyPlayerId, setBusyPlayerId] = useState<number | null>(null);

  async function load(): Promise<void> {
    try {
      const next = await rpc<Dash>('dashboard');
      setData(next);
      putCache('dashboard', next);
      setError('');
    } catch {
      setError('Hors connexion : dernières données affichées.');
      setData((current) => current ?? cached('dashboard'));
    }
  }

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 12000);
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, []);

  async function invite(playerId: number): Promise<void> {
    setBusyPlayerId(playerId);
    setError('');
    try {
      await rpc('invite', {
        toUserId: playerId,
        mode: inviteMode,
        timeLimit,
        increment,
      });
      await load();
      setError('Invitation envoyée.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'L’invitation a échoué.');
    } finally {
      setBusyPlayerId(null);
    }
  }

  if (!data) return <main className="center-screen">Préparation de la table…</main>;

  return (
    <main className="dashboard">
      <header>
        <div>
          <p className="eyebrow">SALON DES JOUEURS</p>
          <h1>Bonjour, {data.user.username}</h1>
          <p role="status">{error || 'La table est prête.'}</p>
        </div>
        <div className="header-actions">
          <SoloLauncher />
          <button className="quiet" onClick={() => router.push('/profile')}>
            Mon profil
          </button>
          <button
            className="quiet"
            onClick={async () => {
              await rpc('logout');
              router.push('/');
            }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      <section className="stat-row">
        <article>
          <b>{data.user.wins}</b>
          <span>Victoires</span>
        </article>
        <article>
          <b>{data.user.losses}</b>
          <span>Défaites</span>
        </article>
        <article>
          <b>{data.user.draws}</b>
          <span>Nuls</span>
        </article>
      </section>

      <section className="dash-grid">
        <article className="panel wide">
          <h2>Vos tables</h2>
          {data.games.length ? (
            data.games.map((game) => (
              <button
                className="game-row"
                key={game.id}
                onClick={() =>
                  router.push(
                    game.status === 'finished' ? `/replay/${game.uuid}` : `/game/${game.uuid}`,
                  )
                }
              >
                <span>
                  <b>{game.opponent || 'Entraînement solo'}</b>
                  <small>
                    {game.mode === 'timer' ? 'Chronométrée' : 'Libre'} ·{' '}
                    {game.status === 'finished' ? 'terminée' : 'en cours'}
                  </small>
                </span>
                <strong>
                  {game.status === 'finished'
                    ? 'Replay →'
                    : Number(game.current_player_id) === data.user.id
                      ? 'À vous →'
                      : 'Ouvrir'}
                </strong>
              </button>
            ))
          ) : (
            <p className="empty">Aucune partie.</p>
          )}
        </article>

        <article className="panel">
          <h2>Invitations reçues</h2>
          {data.invites.length === 0 && <p className="empty">Aucune invitation reçue.</p>}
          {data.invites.map((invitation) => (
            <div className="invite" key={invitation.id}>
              <span>
                <b>{invitation.from_username}</b>
                <small>{invitationLabel(invitation)}</small>
              </span>
              <div>
                <button
                  onClick={async () => {
                    const result = await rpc<{ uuid: string }>('respondInvite', {
                      inviteId: Number(invitation.id),
                      accept: true,
                    });
                    router.push(`/game/${result.uuid}`);
                  }}
                >
                  Accepter
                </button>
                <button
                  className="quiet"
                  onClick={async () => {
                    await rpc('respondInvite', {
                      inviteId: Number(invitation.id),
                      accept: false,
                    });
                    await load();
                  }}
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}

          <h3>Invitations envoyées</h3>
          {data.sentInvites.length === 0 && <p className="empty">Aucune invitation en attente.</p>}
          {data.sentInvites.map((invitation) => (
            <div className="invite" key={invitation.id}>
              <span>
                <b>{invitation.to_username}</b>
                <small>{invitationLabel(invitation)}</small>
              </span>
              <button
                className="quiet"
                onClick={async () => {
                  await rpc('cancelInvite', { inviteId: Number(invitation.id) });
                  await load();
                }}
              >
                Annuler
              </button>
            </div>
          ))}
        </article>

        <article className="panel">
          <h2>Inviter un joueur</h2>
          <div className="invite-settings">
            <label>
              Mode
              <select
                value={inviteMode}
                onChange={(event) => setInviteMode(event.target.value as 'free' | 'timer')}
              >
                <option value="free">Libre, durée illimitée</option>
                <option value="timer">Chronométré</option>
              </select>
            </label>
            {inviteMode === 'timer' && (
              <>
                <label>
                  Minutes par joueur
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={timeLimit}
                    onChange={(event) => setTimeLimit(Number(event.target.value))}
                  />
                </label>
                <label>
                  Incrément par coup (s)
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={increment}
                    onChange={(event) => setIncrement(Number(event.target.value))}
                  />
                </label>
              </>
            )}
          </div>
          {data.online.length === 0 && (
            <p className="empty">Aucun autre joueur connecté pour le moment.</p>
          )}
          {data.online.map((player) => (
            <div className="player" key={player.id}>
              <span>
                <b>{player.username}</b>
                <small>{player.wins} victoire(s)</small>
              </span>
              <button
                disabled={busyPlayerId === player.id}
                onClick={() => void invite(Number(player.id))}
              >
                {busyPlayerId === player.id ? 'Envoi…' : 'Inviter'}
              </button>
            </div>
          ))}
        </article>

        <article className="panel">
          <h2>Classement</h2>
          {data.leaders.map((player, index) => (
            <div className="rank" key={player.id}>
              <span>{index + 1}</span>
              <b>{player.username}</b>
              <strong>{player.wins}</strong>
            </div>
          ))}
        </article>
      </section>
    </main>
  );
}
