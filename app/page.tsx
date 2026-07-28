'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { api, clearPrivateCache } from '@/lib/client';

type AuthMode = 'login' | 'register' | 'reset';

export default function Home(): React.JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [debugToken, setDebugToken] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setMessage('');
    setDebugToken('');
    try {
      if (mode === 'reset') {
        const result = await api<{ message: string; debugToken?: string }>(
          '/api/auth/password-reset/request',
          {
            method: 'POST',
            body: JSON.stringify({ identifier: form.get('identifier') }),
          },
        );
        setMessage(result.message);
        setDebugToken(result.debugToken ?? '');
        return;
      }

      await api(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(
          mode === 'login'
            ? { identifier: form.get('identifier'), password: form.get('password') }
            : {
                username: form.get('username'),
                email: form.get('email'),
                password: form.get('password'),
              },
        ),
      });
      clearPrivateCache();
      router.push('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La demande a échoué.');
    } finally {
      setBusy(false);
    }
  }

  function selectMode(nextMode: AuthMode): void {
    setMode(nextMode);
    setError('');
    setMessage('');
    setDebugToken('');
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
        {mode !== 'reset' ? (
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => selectMode('login')}
            >
              Connexion
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'active' : ''}
              onClick={() => selectMode('register')}
            >
              Créer un compte
            </button>
          </div>
        ) : (
          <div className="reset-heading">
            <p className="eyebrow">RÉCUPÉRATION</p>
            <h2>Mot de passe oublié</h2>
          </div>
        )}

        <form onSubmit={submit}>
          {mode === 'login' && (
            <label>
              Nom de joueur ou e-mail
              <input name="identifier" required maxLength={320} autoComplete="username" />
            </label>
          )}
          {mode === 'register' && (
            <>
              <label>
                Nom de joueur
                <input
                  name="username"
                  required
                  minLength={3}
                  maxLength={24}
                  autoComplete="username"
                />
              </label>
              <label>
                E-mail de récupération
                <input name="email" type="email" maxLength={320} autoComplete="email" />
              </label>
            </>
          )}
          {mode === 'reset' && (
            <label>
              Nom de joueur ou e-mail
              <input name="identifier" required maxLength={320} autoComplete="username" />
            </label>
          )}
          {mode !== 'reset' && (
            <label>
              Mot de passe
              <input
                name="password"
                type="password"
                required
                minLength={mode === 'register' ? 10 : 1}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
          )}
          {mode === 'register' && (
            <small>10 caractères, majuscule, minuscule, chiffre et symbole.</small>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          {debugToken && (
            <button
              type="button"
              className="quiet"
              onClick={() => router.push(`/reset-password?token=${encodeURIComponent(debugToken)}`)}
            >
              Ouvrir le lien de test
            </button>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="cta" disabled={busy}>
            {busy
              ? 'Patientez…'
              : mode === 'login'
                ? 'Entrer dans l’arène'
                : mode === 'register'
                  ? 'Forger mon profil'
                  : 'Envoyer le lien sécurisé'}
          </button>
          {mode === 'login' && (
            <button type="button" className="quiet" onClick={() => selectMode('reset')}>
              Mot de passe oublié ?
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" className="quiet" onClick={() => selectMode('login')}>
              Retour à la connexion
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
