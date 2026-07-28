'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { api, clearPrivateCache } from '@/lib/client';

type ProfileData = {
  user: {
    id: number;
    username: string;
    email: string | null;
    bio: string;
    avatar: string | null;
    wins: number;
    losses: number;
    draws: number;
    created_at: string;
  };
  games: Array<{
    id: number;
    status: 'active' | 'finished';
    mode: 'free' | 'timer';
    is_solo: number;
    ai_level: string | null;
    winner_id: number | null;
    opponent: string;
    created_at: string;
  }>;
};

const AVATARS: Record<string, string> = {
  tile: 'L¹',
  owl: '🦉',
  fox: '🦊',
  tiger: '🐯',
  wizard: '🧙',
  crown: '👑',
};

export default function ProfilePage(): React.JSX.Element {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('tile');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<ProfileData>('/api/profile')
      .then((profile) => {
        setData(profile);
        setBio(profile.user.bio ?? '');
        setEmail(profile.user.email ?? '');
        setAvatar(profile.user.avatar || 'tile');
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Profil indisponible.'));
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ bio, email, avatar }),
      });
      setMessage('Profil mis à jour.');
      setData((current) =>
        current
          ? { ...current, user: { ...current.user, bio, email: email || null, avatar } }
          : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La mise à jour a échoué.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') ?? '');
    const nextPassword = String(form.get('nextPassword') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');
    if (nextPassword !== confirmation) {
      setError('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      clearPrivateCache();
      router.push('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le changement a échoué.');
      setBusy(false);
    }
  }

  if (!data) {
    return <main className="center-screen">{error || 'Ouverture du profil…'}</main>;
  }

  const played = Number(data.user.wins) + Number(data.user.losses) + Number(data.user.draws);

  return (
    <main className="account-shell">
      <header className="account-header">
        <div>
          <p className="eyebrow">ESPACE JOUEUR</p>
          <h1>{data.user.username}</h1>
          <p>Membre depuis le {new Date(data.user.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <button className="quiet" onClick={() => router.push('/dashboard')}>
          ← Retour au salon
        </button>
      </header>

      <section className="profile-hero">
        <div className="avatar-preview" aria-label={`Avatar ${avatar}`}>
          {AVATARS[avatar] ?? AVATARS.tile}
        </div>
        <div className="profile-stat-grid">
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
          <article>
            <b>{played}</b>
            <span>Parties</span>
          </article>
        </div>
      </section>

      {(message || error) && (
        <p
          className={error ? 'error account-feedback' : 'notice account-feedback'}
          role={error ? 'alert' : 'status'}
        >
          {error || message}
        </p>
      )}

      <section className="account-grid">
        <article className="account-card">
          <h2>Identité de joueur</h2>
          <form className="form-grid" onSubmit={saveProfile}>
            <label>
              Avatar
              <select value={avatar} onChange={(event) => setAvatar(event.target.value)}>
                {Object.entries(AVATARS).map(([value, symbol]) => (
                  <option key={value} value={value}>
                    {symbol} {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Adresse e-mail de récupération
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="joueur@exemple.com"
                autoComplete="email"
              />
            </label>
            <label>
              Présentation
              <textarea
                value={bio}
                maxLength={500}
                rows={6}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Votre style de jeu, vos mots préférés…"
              />
              <small>{bio.length}/500</small>
            </label>
            <button disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le profil'}</button>
          </form>
        </article>

        <article className="account-card">
          <h2>Changer le mot de passe</h2>
          <p className="lead-small">Toutes les sessions seront fermées après la modification.</p>
          <form className="form-grid" onSubmit={changePassword}>
            <label>
              Mot de passe actuel
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              Nouveau mot de passe
              <input
                name="nextPassword"
                type="password"
                minLength={10}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirmer
              <input
                name="confirmation"
                type="password"
                minLength={10}
                required
                autoComplete="new-password"
              />
            </label>
            <small>Majuscule, minuscule, chiffre et symbole obligatoires.</small>
            <button className="danger" disabled={busy}>
              Modifier et déconnecter
            </button>
          </form>
        </article>

        <article className="account-card wide-card">
          <h2>Historique récent</h2>
          {data.games.length === 0 ? (
            <p className="empty">Aucune partie enregistrée.</p>
          ) : (
            <div className="profile-history-list">
              {data.games.map((game) => {
                const won =
                  game.status === 'finished' && Number(game.winner_id) === Number(data.user.id);
                const draw = game.status === 'finished' && game.winner_id === null;
                return (
                  <button
                    key={game.id}
                    className="history-row"
                    onClick={() =>
                      router.push(
                        game.status === 'finished' ? `/replay/${game.id}` : `/game/${game.id}`,
                      )
                    }
                  >
                    <span>
                      <b>{game.is_solo ? `IA ${game.ai_level ?? 'medium'}` : game.opponent}</b>
                      <small>
                        {game.mode === 'timer' ? 'Chronométrée' : 'Libre'} ·{' '}
                        {new Date(game.created_at).toLocaleDateString('fr-FR')}
                      </small>
                    </span>
                    <strong>
                      {game.status === 'active'
                        ? 'En cours'
                        : draw
                          ? 'Nul'
                          : won
                            ? 'Victoire'
                            : 'Défaite'}
                    </strong>
                  </button>
                );
              })}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
