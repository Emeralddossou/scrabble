'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const dragTileRef = useRef<Tile | null>(null);
  const touchGhostRef = useRef<HTMLDivElement | null>(null);
  const chooseRef = useRef<(row: number, col: number, tileOverride?: Tile) => void>(() => {});
  const gameStateRef = useRef({ state: null as State | null, canAct: false, exchangeMode: false });
  gameStateRef.current = { state, canAct, exchangeMode };

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

  function choose(row: number, col: number, tileOverride?: Tile): void {
    const tile = tileOverride ?? selected;
    if (!tile || !state || !canAct || exchangeMode || state.board[row][col]) return;
    setDraftVersion((current) => current ?? state.version);
    setPlacements((current) => [
      ...current.filter(
        (placement) =>
          placement.tileId !== tile.id && (placement.row !== row || placement.col !== col),
      ),
      {
        row,
        col,
        tileId: tile.id,
        letter:
          tile.letter === '*'
            ? (window.prompt('Lettre du joker') || 'A').slice(0, 1).toUpperCase()
            : tile.letter,
      },
    ]);
    setSelected(null);
  }

  // Keep chooseRef up-to-date for touch event handlers
  chooseRef.current = choose;

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

  /* ── Drag-and-drop (desktop) ────────────────────── */

  function handleDragStart(tile: Tile, event: React.DragEvent): void {
    if (!canAct || exchangeMode) return;
    event.dataTransfer.setData('text/plain', tile.id);
    event.dataTransfer.effectAllowed = 'move';
    // custom transparent image so we keep our own visual
    const blank = new Image();
    blank.src =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    event.dataTransfer.setDragImage(blank, 0, 0);
    setSelected(tile);
    setIsDragging(true);
    dragTileRef.current = tile;
  }

  function handleDragOver(row: number, col: number, event: React.DragEvent): void {
    if (!state || !dragTileRef.current || !canAct || state.board[row][col]) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleDragEnter(row: number, col: number): void {
    if (!state || !dragTileRef.current || state.board[row][col]) return;
    setHoverCell({ row, col });
  }

  function handleDragLeave(row: number, col: number): void {
    setHoverCell((current) =>
      current?.row === row && current?.col === col ? null : current,
    );
  }

  function handleDrop(row: number, col: number, event: React.DragEvent): void {
    event.preventDefault();
    setIsDragging(false);
    const tileId = event.dataTransfer.getData('text/plain');
    const tile = (me?.rack ?? []).find((t) => t.id === tileId);
    if (tile && state && !state.board[row][col]) {
      choose(row, col, tile);
    }
    setHoverCell(null);
    dragTileRef.current = null;
  }

  function handleDragEnd(): void {
    setIsDragging(false);
    setHoverCell(null);
    dragTileRef.current = null;
  }

  /* ── Touch drag-and-drop (mobile) ───────────────── */

  function handleTouchStartTile(tile: Tile, event: React.TouchEvent): void {
    if (!canAct || exchangeMode) return;
    event.preventDefault();

    setSelected(tile);
    setIsDragging(true);
    dragTileRef.current = tile;

    const touch = event.touches[0];
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    const ghostLetter = document.createElement('strong');
    ghostLetter.textContent = tile.letter === '*' ? '*' : tile.letter;
    const ghostScore = document.createElement('small');
    ghostScore.textContent = String(tile.blank ? 0 : tile.points);
    ghost.append(ghostLetter, ghostScore);
    ghost.style.left = `${touch.clientX - 24}px`;
    ghost.style.top = `${touch.clientY - 26}px`;
    document.body.appendChild(ghost);
    touchGhostRef.current = ghost;
  }

  /* Global touch-move / touch-end listeners (active only during a drag) */
  useEffect(() => {
    if (!isDragging) return;

    const ghost = touchGhostRef.current;
    if (!ghost) return;

    let targetCell: { row: number; col: number } | null = null;

    function onTouchMove(event: TouchEvent): void {
      event.preventDefault();
      const touch = event.touches[0];
      ghost.style.left = `${touch.clientX - 24}px`;
      ghost.style.top = `${touch.clientY - 26}px`;

      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const cell = el?.closest('[data-cell-row]') as HTMLElement | null;
      targetCell = cell
        ? { row: Number(cell.dataset.cellRow), col: Number(cell.dataset.cellCol) }
        : null;
    }

    function onTouchEnd(): void {
      ghost.remove();
      touchGhostRef.current = null;

      if (targetCell && dragTileRef.current) {
        const gs = gameStateRef.current;
        const { row, col } = targetCell;
        if (gs.state && !gs.state.board[row][col] && gs.canAct && !gs.exchangeMode) {
          chooseRef.current(row, col, dragTileRef.current);
        }
      }

      dragTileRef.current = null;
      setIsDragging(false);
      setSelected(null);
    }

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isDragging]);

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
                    data-cell-row={rowIndex}
                    data-cell-col={colIndex}
                    className={`cell ${multiplier || ''} ${staged ? 'staged' : ''} ${hoverCell?.row === rowIndex && hoverCell?.col === colIndex ? 'drag-hover' : ''}`}
                    onClick={() => choose(rowIndex, colIndex)}
                    disabled={!canAct || finished}
                    onDragOver={(event) => handleDragOver(rowIndex, colIndex, event)}
                    onDragEnter={() => handleDragEnter(rowIndex, colIndex)}
                    onDragLeave={() => handleDragLeave(rowIndex, colIndex)}
                    onDrop={(event) => handleDrop(rowIndex, colIndex, event)}
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
                className={`${selected?.id === tile.id || exchangeSelected ? 'selected' : ''} ${isDragging && dragTileRef.current?.id === tile.id ? 'dragging' : ''}`}
                draggable={!used && canAct && !finished && !exchangeMode}
                onClick={() => selectRackTile(tile)}
                onDragStart={(event) => handleDragStart(tile, event)}
                onDragEnd={handleDragEnd}
                onTouchStart={(event) => handleTouchStartTile(tile, event)}
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
