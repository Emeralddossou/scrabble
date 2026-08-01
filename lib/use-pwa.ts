'use client';

import { useCallback, useEffect, useState } from 'react';

export type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export type InstallResult = 'accepted' | 'dismissed' | 'ios-help' | 'unavailable' | 'standalone';

type UsePwaInstall = {
  isStandalone: boolean;
  promptEvent: InstallPromptEvent | null;
  requestInstall: () => Promise<InstallResult>;
  showIosHelp: boolean;
  isDismissed: boolean;
  dismiss: () => void;
  updateReady: ServiceWorker | null;
  activateUpdate: () => void;
};

const DISMISS_KEY = 'lexiforge-install-dismissed-until';
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;

function detectStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
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
    // Le stockage peut être indisponible en navigation privée.
  }
}

export function usePwaInstall(): UsePwaInstall {
  const [isStandalone, setIsStandalone] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updateReady, setUpdateReady] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    setIsStandalone(detectStandalone());
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    const handleUpdateFound = (): void => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (!disposed && installing.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateReady(registration?.waiting ?? null);
        }
      });
    };

    const register = async (): Promise<void> => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none',
        });
        if (disposed || !registration) return;
        registration.addEventListener('updatefound', handleUpdateFound);
        if (registration.waiting) setUpdateReady(registration.waiting);
        await registration.update();
        if (!disposed && registration.waiting) setUpdateReady(registration.waiting);
      } catch {
        // L’installation PWA reste facultative si le SW est bloqué par le contexte réseau.
      }
    };

    void register();
    return () => {
      disposed = true;
      registration?.removeEventListener('updatefound', handleUpdateFound);
    };
  }, []);

  useEffect(() => {
    const onBeforeInstall = (event: Event): void => {
      event.preventDefault();
      if (detectStandalone()) return;
      setPromptEvent(event as InstallPromptEvent);
      setDismissed(dismissedRecently());
    };
    const onInstalled = (): void => {
      setPromptEvent(null);
      setShowIosHelp(false);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isIosDevice() || isStandalone || dismissedRecently()) return;
    setShowIosHelp(true);
  }, [isStandalone]);

  const requestInstall = useCallback(async (): Promise<InstallResult> => {
    if (isStandalone) return 'standalone';
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        setPromptEvent(null);
        if (outcome === 'dismissed') {
          rememberDismissal();
          setDismissed(true);
        }
        return outcome;
      } catch {
        setPromptEvent(null);
        return 'unavailable';
      }
    }
    if (isIosDevice()) {
      setDismissed(false);
      setShowIosHelp(true);
      return 'ios-help';
    }
    return 'unavailable';
  }, [isStandalone, promptEvent]);

  const dismiss = useCallback((): void => {
    rememberDismissal();
    setDismissed(true);
    setPromptEvent(null);
    setShowIosHelp(false);
  }, []);

  const activateUpdate = useCallback((): void => {
    if (!updateReady) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    });
    updateReady.postMessage({ type: 'SKIP_WAITING' });
  }, [updateReady]);

  return {
    isStandalone,
    promptEvent,
    requestInstall,
    showIosHelp,
    isDismissed: dismissed,
    dismiss,
    updateReady,
    activateUpdate,
  };
}
