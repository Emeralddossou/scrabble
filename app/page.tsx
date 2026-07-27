'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/client';

export default function Home(): React.JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      });
      router.push('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La connexion a échoué.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="landing">
      <a className="skip-link" href="#authentication">
        Aller à la connexion
      </a>
      <section className="hero">
        <div className="tile-logo">
          <b>L</b>
          <i>1</i>
        </div>
        <p className="eyebrow">ARÈNE LEXICALE FRANCOPHONE</p>
        <h1>
          Les mots deviennent
          <br />
          <em>des coups de maître.</em>
        </h1>
        <p className="lead">
          Un Scrabble français tactique, jouable sur tous les écrans et prêt à reprendre après une
          coupure réseau.
        </p>
      </section>
      <section id="authentication" className="auth-panel" aria-labelledby="auth-title">
        <h2 id="auth-title" className="sr-only">
          Authentification
        </h2>
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Connexion
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
            Créer un compte
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Nom de joueur
            <input name="username" required minLength={3} maxLength={24} autoComplete="username" />
          </label>
          <label>
            Mot de passe
            <input
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          {mode === 'register' && (
            <small>10 caractères, majuscule, minuscule, chiffre et symbole.</small>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="cta" disabled={busy}>
            {busy ? 'Patientez…' : mode === 'login' ? 'Entrer dans l’arène' : 'Forger mon profil'}
          </button>
        </form>
      </section>
    </main>
  );
}
