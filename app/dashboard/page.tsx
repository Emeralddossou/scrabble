'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cached, putCache, rpc } from '@/lib/client';
type Dash = {
  user: { id: number; username: string; wins: number; losses: number; draws: number };
  games: Array<{
    id: number;
    opponent: string | null;
    mode: 'free' | 'timer';
    status: string;
    current_player_id: number;
  }>;
  online: Array<{ id: number; username: string; wins: number }>;
  invites: Array<{ id: number; from_username: string }>;
  leaders: Array<{ id: number; username: string; wins: number }>;
};
export default function Dashboard() {
  const r = useRouter(),
    [data, setData] = useState<Dash | null>(null),
    [error, setError] = useState('');
  async function load() {
    try {
      const d = await rpc<Dash>('dashboard');
      setData(d);
      putCache('dashboard', d);
      setError('');
    } catch {
      setError('Hors connexion : dernières données affichées.');
      setData((x) => x ?? cached('dashboard'));
    }
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 12000);
    return () => clearInterval(id);
  }, []);
  async function solo() {
    const x = await rpc<{ gameId: number }>('createSolo', {
      mode: 'free',
      timeLimit: 15,
      increment: 0,
    });
    r.push(`/game/${x.gameId}`);
  }
  if (!data) return <main className="center-screen">Préparation de la table…</main>;
  return (
    <main className="dashboard">
      <header>
        <div>
          <p className="eyebrow">SALON DES JOUEURS</p>
          <h1>Bonjour, {data.user.username}</h1>
          <p>{error || 'La table est prête.'}</p>
        </div>
        <div className="header-actions">
          <button onClick={solo}>Partie solo</button>
          <button
            className="quiet"
            onClick={async () => {
              await rpc('logout');
              r.push('/');
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
            data.games.map((g) => (
              <button className="game-row" key={g.id} onClick={() => r.push(`/game/${g.id}`)}>
                <span>
                  <b>{g.opponent || 'Entraînement solo'}</b>
                  <small>
                    {g.mode === 'timer' ? 'Chronométrée' : 'Libre'} · {g.status}
                  </small>
                </span>
                <strong>
                  {Number(g.current_player_id) === data.user.id ? 'À vous →' : 'Ouvrir'}
                </strong>
              </button>
            ))
          ) : (
            <p className="empty">Aucune partie.</p>
          )}
        </article>
        <article className="panel">
          <h2>Invitations</h2>
          {data.invites.map((i) => (
            <div className="invite" key={i.id}>
              <b>{i.from_username}</b>
              <div>
                <button
                  onClick={async () => {
                    const x = await rpc<{ gameId: number }>('respondInvite', {
                      inviteId: Number(i.id),
                      accept: true,
                    });
                    r.push(`/game/${x.gameId}`);
                  }}
                >
                  Accepter
                </button>
                <button
                  className="quiet"
                  onClick={async () => {
                    await rpc('respondInvite', { inviteId: Number(i.id), accept: false });
                    load();
                  }}
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </article>
        <article className="panel">
          <h2>Joueurs</h2>
          {data.online.map((u) => (
            <div className="player" key={u.id}>
              <span>
                <b>{u.username}</b>
                <small>{u.wins} victoire(s)</small>
              </span>
              <button
                onClick={async () => {
                  await rpc('invite', {
                    toUserId: Number(u.id),
                    mode: 'free',
                    timeLimit: 15,
                    increment: 0,
                  });
                  load();
                }}
              >
                Inviter
              </button>
            </div>
          ))}
        </article>
        <article className="panel">
          <h2>Classement</h2>
          {data.leaders.map((u, i) => (
            <div className="rank" key={u.id}>
              <span>{i + 1}</span>
              <b>{u.username}</b>
              <strong>{u.wins}</strong>
            </div>
          ))}
        </article>
      </section>
    </main>
  );
}
