'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/client';

type ReminderState = {
  enabled: boolean;
  notificationHour: number;
  timeZone: string | null;
};

type PushConfig = { vapidPublicKey: string | null };

function fromBase64Url(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const encoded = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(encoded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes.buffer;
}

function pushSupported(): boolean {
  return (
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function DailyReminderSettings(): React.JSX.Element {
  const [reminder, setReminder] = useState<ReminderState>({
    enabled: false,
    notificationHour: 18,
    timeZone: null,
  });
  const [supported, setSupported] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const supportedHere = pushSupported();
    setSupported(supportedHere);
    if (!supportedHere) return;
    void Promise.all([api<ReminderState>('/api/push/subscription'), api<PushConfig>('/api/push/config')])
      .then(([nextReminder, config]) => {
        setReminder(nextReminder);
        setConfigured(Boolean(config.vapidPublicKey));
      })
      .catch(() => setMessage('Les réglages de rappel sont indisponibles pour le moment.'));
  }, []);

  async function enable(): Promise<void> {
    setBusy(true);
    setMessage('');
    try {
      const config = await api<PushConfig>('/api/push/config');
      if (!config.vapidPublicKey) {
        setConfigured(false);
        setMessage('Les rappels ne sont pas encore configurés sur ce serveur.');
        return;
      }
      if (Notification.permission === 'denied') {
        setMessage('Les notifications sont bloquées. Autorisez-les dans les réglages du navigateur.');
        return;
      }
      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage('Aucun rappel ne sera envoyé sans votre autorisation.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: fromBase64Url(config.vapidPublicKey),
        }));
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      await api('/api/push/subscription', {
        method: 'POST',
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          notificationHour: reminder.notificationHour,
          timeZone,
        }),
      });
      setReminder({ enabled: true, notificationHour: reminder.notificationHour, timeZone });
      setConfigured(true);
      setMessage(`Rappel quotidien activé à ${String(reminder.notificationHour).padStart(2, '0')} h.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible d’activer les rappels.');
    } finally {
      setBusy(false);
    }
  }

  async function disable(): Promise<void> {
    setBusy(true);
    setMessage('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      await subscription?.unsubscribe();
      await api('/api/push/subscription', { method: 'DELETE', body: '{}' });
      setReminder((current) => ({ ...current, enabled: false }));
      setMessage('Rappel quotidien désactivé.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible de désactiver les rappels.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="account-card reminder-card">
      <h2>Rappel quotidien</h2>
      <p className="lead-small">
        Recevez au plus une invitation par jour pour une partie rapide. Vous pouvez vous désabonner
        ici à tout moment.
      </p>
      {supported === false ? (
        <p className="notice" role="status">
          Les notifications nécessitent un navigateur compatible, une connexion HTTPS et une app
          installée sur iPhone/iPad (Safari 16.4 ou plus récent).
        </p>
      ) : (
        <div className="form-grid">
          <label>
            Heure locale
            <select
              value={reminder.notificationHour}
              disabled={busy}
              onChange={(event) =>
                setReminder((current) => ({
                  ...current,
                  notificationHour: Number(event.target.value),
                }))
              }
            >
              {Array.from({ length: 15 }, (_, index) => index + 8).map((hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, '0')} h 00
                </option>
              ))}
            </select>
          </label>
          <small>
            Fuseau détecté : {(reminder.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC'}
          </small>
          {reminder.enabled ? (
            <button type="button" className="quiet" disabled={busy} onClick={() => void disable()}>
              {busy ? 'Mise à jour…' : 'Désactiver le rappel'}
            </button>
          ) : (
            <button type="button" disabled={busy || configured === false} onClick={() => void enable()}>
              {busy ? 'Activation…' : 'Activer le rappel quotidien'}
            </button>
          )}
          {configured === false && (
            <small>Les clés de notification ne sont pas encore configurées sur ce serveur.</small>
          )}
          {message && <p className="notice" role="status">{message}</p>}
        </div>
      )}
    </article>
  );
}
