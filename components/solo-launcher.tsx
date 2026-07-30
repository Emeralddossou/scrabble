'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { rpc } from '@/lib/client';

const LEVELS = [
  {
    value: 'easy',
    label: 'Découverte',
    description: 'Choisit des coups légaux simples et laisse volontairement des occasions.',
  },
  {
    value: 'medium',
    label: 'Intermédiaire',
    description: 'Joue régulièrement de bons coups tout en conservant de la variété.',
  },
  {
    value: 'hard',
    label: 'Avancé',
    description: 'Optimise le score et tient compte du chevalet restant et des ouvertures.',
  },
  {
    value: 'expert',
    label: 'Expert',
    description:
      'Jeu positionnel d’élite : valorise le chevalet, verrouille le plateau et minimise les offres.',
  },
] as const;

type Level = (typeof LEVELS)[number]['value'];

export function SoloLauncher({ autoOpen = false }: { autoOpen?: boolean }): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<Level>('medium');
  const [mode, setMode] = useState<'free' | 'timer'>('free');
  const [minutes, setMinutes] = useState(15);
  const [increment, setIncrement] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  async function create(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const result = await rpc<{ uuid: string }>('createSolo', {
        mode,
        timeLimit: minutes,
        increment,
        aiLevel: level,
      });
      router.push(`/game/${result.uuid}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La partie solo n’a pas pu être créée.');
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}>Jouer contre l’IA</button>
      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => !busy && setOpen(false)}
        >
          <section
            className="game-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="solo-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">ENTRAÎNEMENT SOLO</p>
            <h2 id="solo-title">Choisissez votre adversaire</h2>
            <div className="level-grid" aria-label="Niveau de l’intelligence artificielle">
              {LEVELS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={level === item.value ? 'level-card selected' : 'level-card'}
                  aria-pressed={level === item.value}
                  onClick={() => setLevel(item.value)}
                >
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
            <div className="form-grid compact">
              <label>
                Mode de jeu
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as 'free' | 'timer')}
                >
                  <option value="free">Libre, durée illimitée</option>
                  <option value="timer">Chronométré</option>
                </select>
              </label>
              {mode === 'timer' && (
                <>
                  <label>
                    Minutes par joueur
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={minutes}
                      onChange={(event) => setMinutes(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    Incrément par coup
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
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button disabled={busy} onClick={() => void create()}>
                {busy ? 'Préparation…' : 'Commencer la partie'}
              </button>
              <button className="quiet" disabled={busy} onClick={() => setOpen(false)}>
                Annuler
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
