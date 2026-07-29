'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { multiplierAt } from '@/domain/scrabble/board';
import type { Board, Tile, WordScore } from '@/domain/scrabble/types';
import { api } from '@/lib/client';

type ReplayMove = {
  id: number;
  username: string | null;
  kind: string;
  words: WordScore[];
  points: number;
  snapshot: string | null;
};
type ReplayState = {
  status: string;
  board: Board;
  players: Array<{ user_id: number; username: string; score: number }>;
  moves: ReplayMove[];
  winner_id: number | null;
  end_reason: string | null;
};

function emptyReplayBoard(): Board {
  return Array.from({ length: 15 }, () => Array<Tile | null>(15).fill(null));
}

export default function ReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const gameUuid = use(params).id;
  const router = useRouter();
  const [state, setState] = useState<ReplayState | null>(null);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    void api<ReplayState>(`/api/games/${gameUuid}`).then(setState);
  }, [gameUuid]);

  useEffect(() => {
    if (!playing || !state) return undefined;
    const timer = window.setInterval(
      () =>
        setIndex((current) =>
          current >= state.moves.length - 1 ? (setPlaying(false), current) : current + 1,
        ),
      900,
    );
    return () => window.clearInterval(timer);
  }, [playing, state]);

  const board = useMemo(() => {
    if (!state) return null;
    if (index < 0) return emptyReplayBoard();
    for (let moveIndex = index; moveIndex >= 0; moveIndex -= 1) {
      const snapshot = state.moves[moveIndex]?.snapshot;
      if (snapshot) return JSON.parse(snapshot) as Board;
    }
    return emptyReplayBoard();
  }, [index, state]);

  if (!state || !board) return <main className="center-screen">Chargement du replay…</main>;

  const selectedMove = index >= 0 ? state.moves[index] : null;
  const winner = state.players.find((player) => Number(player.user_id) === Number(state.winner_id));

  return (
    <main className="game-shell">
      <header className="game-top">
        <button className="quiet" onClick={() => router.push('/dashboard')}>
          ← Salon
        </button>
        <h1>Replay</h1>
        <span>
          {state.status === 'finished'
            ? winner
              ? `${winner.username} · ${state.end_reason ?? 'partie terminée'}`
              : `Partie nulle · ${state.end_reason ?? 'partie terminée'}`
            : 'Partie en cours'}
        </span>
      </header>
      <div className="game-grid">
        <section className="board-wrap">
          <div className="board" aria-label="Plateau du replay">
            {board.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`cell ${multiplierAt(rowIndex, colIndex) ?? ''}`}
                >
                  {cell && (
                    <>
                      <strong>{cell.letter}</strong>
                      <small>{cell.blank ? 0 : cell.points}</small>
                    </>
                  )}
                </div>
              )),
            )}
          </div>
        </section>
        <aside className="game-side">
          <section className="side-card">
            <h2>Coups</h2>
            <p>
              {index + 1} / {state.moves.length}
            </p>
            {selectedMove && (
              <p className="notice">
                {selectedMove.username ?? 'Système'} · {selectedMove.kind}
                {selectedMove.words.length > 0
                  ? ` · ${selectedMove.words.map((word) => word.word).join(', ')}`
                  : ''}
              </p>
            )}
            <div className="game-buttons">
              <button onClick={() => setIndex(-1)}>Début</button>
              <button
                className="quiet"
                onClick={() => setIndex((current) => Math.max(-1, current - 1))}
              >
                Précédent
              </button>
              <button
                className="quiet"
                onClick={() => setIndex((current) => Math.min(state.moves.length - 1, current + 1))}
              >
                Suivant
              </button>
              <button onClick={() => setPlaying((current) => !current)}>
                {playing ? 'Pause' : 'Lecture'}
              </button>
            </div>
          </section>
          <section className="side-card history">
            {state.moves.map((move, moveIndex) => (
              <button className="game-row" key={move.id} onClick={() => setIndex(moveIndex)}>
                <span>
                  <b>{move.username ?? 'Système'}</b>
                  <small>
                    {move.kind} {move.words.map((word) => word.word).join(', ')}
                  </small>
                </span>
                <strong>{move.points > 0 ? `+${move.points}` : '—'}</strong>
              </button>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}
