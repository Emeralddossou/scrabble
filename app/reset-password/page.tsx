'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/client';

export default function ResetPasswordPage(): React.JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setMessage('Mot de passe modifié. Vous pouvez maintenant vous connecter.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La réinitialisation a échoué.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-shell narrow">
      <section className="account-card">
        <p className="eyebrow">SÉCURITÉ DU COMPTE</p>
        <h1>Nouveau mot de passe</h1>
        <p className="lead-small">
          Le lien est utilisable une seule fois et expire après une heure.
        </p>
        {message ? (
          <>
            <p className="notice" role="status">
              {message}
            </p>
            <button onClick={() => router.push('/')}>Retour à la connexion</button>
          </>
        ) : (
          <form className="form-grid" onSubmit={submit}>
            <label>
              Jeton de réinitialisation
              <input value={token} onChange={(event) => setToken(event.target.value)} required />
            </label>
            <label>
              Nouveau mot de passe
              <input
                name="password"
                type="password"
                minLength={10}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirmer le mot de passe
              <input
                name="confirmation"
                type="password"
                minLength={10}
                required
                autoComplete="new-password"
              />
            </label>
            <small>10 caractères minimum, avec majuscule, minuscule, chiffre et symbole.</small>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="account-actions">
              <button disabled={busy}>{busy ? 'Modification…' : 'Modifier le mot de passe'}</button>
              <button type="button" className="quiet" onClick={() => router.push('/')}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
