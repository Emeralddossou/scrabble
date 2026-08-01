'use client';

import { use, useEffect, useMemo, useState } from 'react';

import { multiplierAt } from '@/domain/scrabble/board';
import type { Board, Tile, WordScore } from '@/domain/scrabble/types';
import { api } from '@/lib/client';

type SharedMove = {
  id: number;
  username: string | null;
  kind: string;
  words: WordScore[];
  points: number;
  snapshot: string | null;
  placements: Array<{ row: number; col: number }>;
};
type SharedReplay = {
  status: string;
  players: Array<{ user_id: number; username: string; score: number }>;
  winner_id: number | null;
  end_reason: string | null;
  moves: SharedMove[];
};

function emptyBoard(): Board {
  return Array.from({ length: 15 }, () => Array<Tile | null>(15).fill(null));
}

export default function SharedReplayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): React.JSX.Element {
  const token = use(params).token;
  const [state, setState] = useState<SharedReplay | null>(null);
  const [index, setIndex] = useState(-1);
  const [error, setError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    void api<SharedReplay>(`/api/replays/shared/${token}`)
      .then(setState)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Replay indisponible.'));
  }, [token]);

  const board = useMemo(() => {
    if (!state || index < 0) return emptyBoard();
    for (let moveIndex = index; moveIndex >= 0; moveIndex -= 1) {
      const snapshot = state.moves[moveIndex]?.snapshot;
      if (snapshot) return JSON.parse(snapshot) as Board;
    }
    return emptyBoard();
  }, [index, state]);

  if (!state)
    return <main className="center-screen">{error || 'Chargement du replay partagé…'}</main>;
  const move = index >= 0 ? state.moves[index] : null;
  const playedCells = new Set((move?.placements ?? []).map((item) => `${item.row}:${item.col}`));
  const winner = state.players.find((player) => Number(player.user_id) === Number(state.winner_id));

  return (
    <main className="game-shell">
      <header className="game-top">
        <span>LexiForge</span>
        <h1>Replay partagé</h1>
        <span>{winner ? `${winner.username} gagne` : 'Partie nulle'}</span>
      </header>
      <section className="game-status replay-status" aria-live="polite">
        <strong>{move ? (move.username ?? 'Système') : 'Début du replay'}</strong>
        <span>
          {index + 1} / {state.moves.length} coups
        </span>
      </section>
      <div className="game-grid">
        <section className="board-wrap" aria-label="Plateau du replay partagé">
          <div className="board">
            {board.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`cell ${multiplierAt(rowIndex, colIndex) ?? ''} ${
                    playedCells.has(`${rowIndex}:${colIndex}`) ? 'played' : ''
                  }`}
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
        <aside className={`game-side ${detailsOpen ? 'details-open' : ''}`}>
          <button
            type="button"
            className="details-toggle quiet"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((current) => !current)}
          >
            {detailsOpen ? 'Masquer les détails' : 'Détails'}
          </button>
          <div className="details-panel">
            <section className="side-card">
              <h2>{state.end_reason ?? 'Partie terminée'}</h2>
              <p>
                {index + 1} / {state.moves.length} coups
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
                  onClick={() =>
                    setIndex((current) => Math.min(state.moves.length - 1, current + 1))
                  }
                >
                  Suivant
                </button>
              </div>
            </section>
            <section className="side-card history">
              {state.players.map((player) => (
                <p key={player.user_id}>
                  <b>{player.username}</b> · {player.score} points
                </p>
              ))}
              {move && (
                <p className="notice">
                  {move.words.map((word) => word.word).join(', ') || move.kind}
                </p>
              )}
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
