'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/client';
import { multiplierAt } from '@/domain/scrabble/board';
import type { Board, Tile, WordScore } from '@/domain/scrabble/types';

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

export default function ReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const gameId = Number(use(params).id);
  const router = useRouter();
  const [state, setState] = useState<ReplayState | null>(null);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    void api<ReplayState>(`/api/games/${gameId}`).then(setState);
  }, [gameId]);
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
    const move = state.moves[index];
    return move?.snapshot
      ? (JSON.parse(move.snapshot) as Board)
      : index < 0
        ? Array.from({ length: 15 }, () => Array<Tile | null>(15).fill(null))
        : state.board;
  }, [index, state]);
  if (!state || !board) return <main className="center-screen">Chargement du replay…</main>;
  return (
    <main className="game-shell">
      <header className="game-top">
        <button className="quiet" onClick={() => router.push('/dashboard')}>
          ← Salon
        </button>
        <h1>Replay</h1>
        <span>
          {state.status === 'finished'
            ? `Fin : ${state.end_reason ?? 'terminée'}`
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
                <strong>+{move.points}</strong>
              </button>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}
