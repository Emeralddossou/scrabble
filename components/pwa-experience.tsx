'use client';

import { usePwaInstall } from '@/lib/use-pwa';

export function PwaExperience(): React.JSX.Element | null {
  const {
    isStandalone,
    promptEvent,
    requestInstall,
    showIosHelp,
    dismiss,
    updateReady,
    activateUpdate,
    isDismissed,
  } = usePwaInstall();
  const showInstallNotice = !isStandalone && !isDismissed && (promptEvent || showIosHelp);

  if (!showInstallNotice && !updateReady) return null;
  return (
    <aside className="pwa-notice" aria-label="Installation et mise à jour de LexiForge">
      {updateReady ? (
        <div className="pwa-notice-row" role="status">
          <span>Une mise à jour de LexiForge est prête.</span>
          <button type="button" onClick={activateUpdate}>
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
            <button type="button" onClick={() => void requestInstall()}>
              Installer
            </button>
          )}
          <button
            type="button"
            className="quiet"
            onClick={dismiss}
            aria-label="Ne plus proposer l’installation pendant 30 jours"
          >
            Plus tard
          </button>
        </div>
      )}
    </aside>
  );
}
