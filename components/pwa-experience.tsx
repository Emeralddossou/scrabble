'use client';

import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'lexiforge-install-dismissed-until';
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function dismissedRecently(): boolean {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

function rememberDismissal(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_FOR_MS));
  } catch {
    // Le mode privé peut refuser le stockage : l'invite reste simplement discrète à cette session.
  }
}

export function PwaExperience(): React.JSX.Element | null {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [updateReady, setUpdateReady] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    const register = async () => {
      registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      await registration.update();
      if (registration.waiting) setUpdateReady(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration?.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(registration?.waiting ?? null);
          }
        });
      });
    };
    void register().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (!isStandalone() && !dismissedRecently()) setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos && !isStandalone() && !dismissedRecently()) setShowIosHelp(true);
  }, []);

  async function install(): Promise<void> {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'dismissed') rememberDismissal();
    setPromptEvent(null);
  }

  function dismiss(): void {
    rememberDismissal();
    setPromptEvent(null);
    setShowIosHelp(false);
  }

  if (!promptEvent && !showIosHelp && !updateReady) return null;
  return (
    <aside className="pwa-notice" aria-label="Installation et mise à jour de LexiForge">
      {updateReady ? (
        <div className="pwa-notice-row" role="status">
          <span>Une mise à jour de LexiForge est prête.</span>
          <button
            type="button"
            onClick={() => {
              navigator.serviceWorker.addEventListener(
                'controllerchange',
                () => window.location.reload(),
                { once: true },
              );
              updateReady.postMessage({ type: 'SKIP_WAITING' });
            }}
          >
            Mettre à jour
          </button>
        </div>
      ) : (
        <div className="pwa-notice-row" role="status">
          <span>
            {showIosHelp
              ? 'Installez LexiForge : Safari → Partager → Sur l’écran d’accueil.'
              : 'Installez LexiForge pour jouer comme dans une app.'}
          </span>
          {promptEvent && (
            <button type="button" onClick={() => void install()}>
              Installer
            </button>
          )}
          <button type="button" className="quiet" onClick={dismiss} aria-label="Ne plus proposer l’installation pendant 30 jours">
            Plus tard
          </button>
        </div>
      )}
    </aside>
  );
}
