'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { multiplierAt } from '@/lib/board';
import { cached, putCache, rpc } from '@/lib/client';
import type { Board, Placement, Tile, WordScore } from '@/lib/types';

type PlayerView = {
  user_id: number;
  username: string;
  score: number;
  time_remaining: number;
  rack?: Tile[];
  rack_count: number;
};
type MoveView = {
  id: number;
  username: string | null;
  kind: string;
  words: WordScore[];
  points: number;
};
type State = {
  board: Board;
  version: number;
  status: 'active' | 'finished';
  mode: 'free' | 'timer';
  current_player_id: number;
  winner_id: number | null;
  end_reason: string | null;
  bag_count: number;
  players: PlayerView[];
  moves: MoveView[];
};

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
}

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const gameId = Number(id);
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeIds, setExchangeIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [offline, setOffline] = useState(false);
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const next = await rpc<State>('state', { gameId });
      setState(next);
      setReceivedAt(Date.now());
      putCache(`game:${gameId}`, next);
      setOffline(false);
    } catch {
      setState((current) => current ?? cached(`game:${gameId}`));
      setOffline(true);
    }
  }, [gameId]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 5000);
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (state && draftVersion !== null && state.version !== draftVersion) {
      setPlacements([]);
      setSelected(null);
      setDraftVersion(null);
      setMessage('La partie a changé : votre brouillon local a été rappelé.');
    }
  }, [draftVersion, state]);

  const me = useMemo(() => state?.players.find((player) => player.rack !== undefined), [state]);
  const finished = state?.status === 'finished';
  const myTurn = Boolean(
    state &&
    me &&
    state.status === 'active' &&
    Number(state.current_player_id) === Number(me.user_id),
  );
  const canAct = myTurn && !offline;

  function clearDraft(): void {
    setPlacements([]);
    setSelected(null);
    setDraftVersion(null);
  }

  function choose(row: number, col: number): void {
    if (!selected || !state || !canAct || exchangeMode || state.board[row][col]) return;
    setDraftVersion((current) => current ?? state.version);
    setPlacements((current) => [
      ...current.filter(
        (placement) =>
          placement.tileId !== selected.id && (placement.row !== row || placement.col !== col),
      ),
      {
        row,
        col,
        tileId: selected.id,
        letter:
          selected.letter === '*'
            ? (window.prompt('Lettre du joker') || 'A').slice(0, 1).toUpperCase()
            : selected.letter,
      },
    ]);
    setSelected(null);
  }

  function selectRackTile(tile: Tile): void {
    if (!canAct) return;
    if (exchangeMode) {
      setExchangeIds((current) =>
        current.includes(tile.id)
          ? current.filter((tileId) => tileId !== tile.id)
          : [...current, tile.id],
      );
      return;
    }
    setSelected((current) => (current?.id === tile.id ? null : tile));
  }

  async function act(kind: 'pass' | 'resign' | 'exchange'): Promise<void> {
    if (!state || !canAct) return;
    if (kind === 'resign' && !window.confirm('Confirmer l’abandon de cette partie ?')) return;
    if (kind === 'exchange' && exchangeIds.length === 0) {
      setExchangeMode(true);
      setMessage('Sélectionnez une ou plusieurs lettres à échanger.');
      return;
    }
    try {
      await rpc('gameAction', {
        gameId,
        version: Number(state.version),
        kind,
        tileIds: kind === 'exchange' ? exchangeIds : [],
      });
      clearDraft();
      setExchangeMode(false);
      setExchangeIds([]);
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erreur');
      await load();
    }
  }

  async function submit(): Promise<void> {
    if (!state || !canAct || placements.length === 0) return;
    try {
      const result = await rpc<{ score: number; words: WordScore[] }>('play', {
        gameId,
        version: Number(state.version),
        placements,
      });
      setMessage(`${result.words.map((word) => word.word).join(', ')} : +${result.score} points`);
      clearDraft();
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erreur');
      await load();
    }
  }

  if (!state || !me) return <main className="center-screen">Installation des lettres…</main>;

  const elapsedSinceLoad = Math.max(0, Math.floor((now - receivedAt) / 1000));
  const displayedTime = (player: PlayerView): number =>
    state.mode === 'timer' &&
    state.status === 'active' &&
    Number(state.current_player_id) === Number(player.user_id)
      ? Math.max(0, Number(player.time_remaining) - elapsedSinceLoad)
      : Number(player.time_remaining);

  const board = state.board.map((row) => [...row]);
  for (const placement of placements) {
    board[placement.row][placement.col] = {
      id: placement.tileId,
      letter: placement.letter as Tile['letter'],
      points: (me.rack ?? []).find((tile) => tile.id === placement.tileId)?.points ?? 0,
      blank: me.rack?.find((tile) => tile.id === placement.tileId)?.letter === '*',
    };
  }

  const winner = state.players.find((player) => Number(player.user_id) === Number(state.winner_id));

  return (
    <main className="game-shell">
      <header className="game-top">
        <button className="quiet" onClick={() => router.push('/dashboard')}>
          ← Salon
        </button>
        <div className="scoreboard">
          {state.players.map((player) => {
            const seconds = displayedTime(player);
            return (
              <div
                className={
                  Number(state.current_player_id) === Number(player.user_id) && !finished
                    ? 'turn'
                    : ''
                }
                key={player.user_id}
              >
                <span>{player.username}</span>
                <b>{player.score}</b>
                {state.mode === 'timer' && (
                  <small className={seconds <= 30 ? 'clock-low' : ''}>{formatTime(seconds)}</small>
                )}
              </div>
            );
          })}
        </div>
        <span className={offline ? 'network bad' : 'network'}>
          {offline ? 'Hors connexion' : 'Synchronisé'}
        </span>
      </header>

      <div className="game-grid">
        <section className="board-wrap" aria-label="Plateau de Scrabble">
          <div className="board">
            {board.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const multiplier = multiplierAt(rowIndex, colIndex);
                const staged = placements.some(
                  (placement) => placement.row === rowIndex && placement.col === colIndex,
                );
                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    className={`cell ${multiplier || ''} ${staged ? 'staged' : ''}`}
                    onClick={() => choose(rowIndex, colIndex)}
                    disabled={!canAct || finished}
                    aria-label={
                      cell
                        ? `${cell.letter}, ${cell.blank ? 0 : cell.points} point(s)`
                        : `Case ${rowIndex + 1}, ${colIndex + 1}`
                    }
                  >
                    {cell ? (
                      <>
                        <strong>{cell.letter}</strong>
                        <small>{cell.blank ? 0 : cell.points}</small>
                      </>
                    ) : (
                      <span>{multiplier === 'ST' ? '★' : multiplier}</span>
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </section>

        <aside className="game-side">
          <div className="side-card">
            <p className="eyebrow">ÉTAT DE LA PARTIE</p>
            {finished ? (
              <>
                <h2>{winner ? `${winner.username} remporte la partie` : 'Partie nulle'}</h2>
                <p>Motif : {state.end_reason ?? 'fin de partie'}</p>
                <button onClick={() => router.push(`/replay/${gameId}`)}>Voir le replay</button>
              </>
            ) : (
              <>
                <h2>{myTurn ? 'À vous de composer' : 'Tour adverse'}</h2>
                <p>{state.bag_count} lettres restantes</p>
              </>
            )}
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
          </div>
          <div className="side-card history">
            <h3>Historique</h3>
            {state.moves
              .slice()
              .reverse()
              .map((move) => (
                <div key={move.id}>
                  <b>{move.username || 'Système'}</b>
                  <span>
                    {move.kind === 'play'
                      ? `${move.words.map((word) => word.word).join(', ')} · +${move.points}`
                      : move.kind}
                  </span>
                </div>
              ))}
          </div>
        </aside>
      </div>

      <footer className="rack-dock">
        <div className="rack" aria-label="Votre chevalet">
          {(me.rack ?? []).map((tile) => {
            const used = placements.some((placement) => placement.tileId === tile.id);
            const exchangeSelected = exchangeIds.includes(tile.id);
            return (
              <button
                key={tile.id}
                disabled={used || !canAct || finished}
                className={selected?.id === tile.id || exchangeSelected ? 'selected' : ''}
                onClick={() => selectRackTile(tile)}
                aria-pressed={selected?.id === tile.id || exchangeSelected}
              >
                <strong>{tile.letter}</strong>
                <small>{tile.points}</small>
              </button>
            );
          })}
        </div>
        <div className="game-buttons">
          <button
            onClick={() => void submit()}
            disabled={!canAct || placements.length === 0 || finished}
          >
            Valider
          </button>
          <button className="quiet" onClick={clearDraft} disabled={placements.length === 0}>
            Rappeler
          </button>
          <button
            className="quiet"
            onClick={() => void act('exchange')}
            disabled={!canAct || finished}
          >
            {exchangeMode
              ? exchangeIds.length
                ? `Échanger (${exchangeIds.length})`
                : 'Sélectionnez les lettres'
              : 'Échanger'}
          </button>
          {exchangeMode && (
            <button
              className="quiet"
              onClick={() => {
                setExchangeMode(false);
                setExchangeIds([]);
              }}
            >
              Annuler l’échange
            </button>
          )}
          <button className="quiet" onClick={() => void act('pass')} disabled={!canAct || finished}>
            Passer
          </button>
          <button
            className="danger"
            onClick={() => void act('resign')}
            disabled={!canAct || finished}
          >
            Abandonner
          </button>
        </div>
      </footer>
    </main>
  );
}
