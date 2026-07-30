'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { multiplierAt } from '@/lib/board';
import { cached, putCache, rpc } from '@/lib/client';
import type { Board, Placement, Tile, WordScore } from '@/lib/types';
import { Modal } from '@/components/modal';

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
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const gameUuid = id;
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
  const [submitting, setSubmitting] = useState(false);
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [blankRequest, setBlankRequest] = useState<{
    row: number;
    col: number;
    tile: Tile;
  } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);

  const me = useMemo(() => state?.players.find((player) => player.rack !== undefined), [state]);
  const finished = state?.status === 'finished';
  const myTurn = Boolean(
    state &&
    me &&
    state.status === 'active' &&
    Number(state.current_player_id) === Number(me.user_id),
  );
    const canAct = myTurn && !offline;

  // Refs vers les dernières versions de submit/act pour le gestionnaire de clavier.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const actRef = useRef(act);
  actRef.current = act;

  const dragTileRef = useRef<Tile | null>(null);
  const touchGhostRef = useRef<HTMLDivElement | null>(null);
  const chooseRef = useRef<(row: number, col: number, tileOverride?: Tile) => void>(() => {});
  const gameStateRef = useRef({ state: null as State | null, canAct: false, exchangeMode: false });
  gameStateRef.current = { state, canAct, exchangeMode };

  const load = useCallback(async () => {
    try {
      const next = await rpc<State>('state', { gameUuid });
      setState(next);
      setReceivedAt(Date.now());
      putCache(`game:${gameUuid}`, next);
      setOffline(false);
    } catch {
      setState((current) => current ?? cached(`game:${gameUuid}`));
      setOffline(true);
    }
  }, [gameUuid]);

  // Polling adaptatif : rapide (2 s) pendant le tour adverse, lent (12 s) sinon.
  // Suspendu quand l'onglet est caché. Backoff en cas de réseau dégradé.
  const pollInterval = myTurn || finished ? 12_000 : 2_000;

  useEffect(() => {
    void load();
    let timer: number | undefined;
    let backoff = 1000;
    const schedule = (): void => {
      timer = window.setTimeout(async () => {
        if (document.visibilityState !== 'visible') {
          schedule();
          return;
        }
        try {
          await load();
          backoff = 1000;
        } catch {
          backoff = Math.min(backoff * 2, 30_000);
        }
        schedule();
      }, pollInterval);
    };
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    schedule();
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [load, pollInterval]);

    // Raccourcis clavier (PC) : Entrée = Valider, Échap = Rappeler,
  // P = Passer, E = Échanger, A = Abandonner (confirmation).
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      if (!canAct || finished || submitting) return;
      switch (event.key) {
        case 'Enter':
          if (placements.length > 0) {
            event.preventDefault();
            void submitRef.current();
          }
          break;
        case 'Escape':
          if (placements.length > 0) {
            event.preventDefault();
            clearDraft();
          }
          break;
        case 'p':
        case 'P':
          event.preventDefault();
          void actRef.current('pass');
          break;
        case 'e':
        case 'E':
          event.preventDefault();
          setExchangeMode((current) => !current);
          setExchangeIds([]);
          break;
        case 'a':
        case 'A':
          event.preventDefault();
          setConfirmResign(true);
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canAct, finished, submitting, placements.length]);

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

  function clearDraft(): void {
    setPlacements([]);
    setSelected(null);
    setDraftVersion(null);
  }

  function recallTileAt(row: number, col: number): void {
    setPlacements((current) => {
      const next = current.filter((p) => !(p.row === row && p.col === col));
      if (next.length === 0) setDraftVersion(null);
      return next;
    });
  }

  function choose(row: number, col: number, tileOverride?: Tile): void {
    const tile = tileOverride ?? selected;
    if (!tile || !state || !canAct || exchangeMode || state.board[row][col]) return;
    if (tile.letter === '*') {
      // Ouvre la modale de choix du joker ; le placement se fera à la sélection.
      setBlankRequest({ row, col, tile });
      return;
    }
    placeTile(row, col, tile, tile.letter);
  }

  function placeTile(row: number, col: number, tile: Tile, letter: string): void {
    if (!state) return;
    setDraftVersion((current) => current ?? state.version);
    setPlacements((current) => [
      ...current.filter(
        (placement) =>
          placement.tileId !== tile.id && (placement.row !== row || placement.col !== col),
      ),
      { row, col, tileId: tile.id, letter },
    ]);
    setSelected(null);
  }

  function chooseBlankLetter(letter: string): void {
    if (!blankRequest) return;
    placeTile(blankRequest.row, blankRequest.col, blankRequest.tile, letter);
    setBlankRequest(null);
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

    const ghostEl = ghost;
    let targetCell: { row: number; col: number } | null = null;

    function onTouchMove(event: TouchEvent): void {
      event.preventDefault();
      const touch = event.touches[0];
      ghostEl.style.left = `${touch.clientX - 24}px`;
      ghostEl.style.top = `${touch.clientY - 26}px`;

      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const cell = el?.closest('[data-cell-row]') as HTMLElement | null;
      targetCell = cell
        ? { row: Number(cell.dataset.cellRow), col: Number(cell.dataset.cellCol) }
        : null;
    }

    function onTouchEnd(): void {
      ghostEl.remove();
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

  function estimateDraftScore(): number {
    if (!state || placements.length === 0 || !me) return 0;
    const tileMap = new Map((me.rack ?? []).map((t) => [t.id, t]));
    // Reconstruit le plateau avec les tuiles en cours de pose.
    const draft = state.board.map((row) => [...row]);
    for (const p of placements) {
      const tile = tileMap.get(p.tileId);
      if (!tile) continue;
      draft[p.row][p.col] = {
        id: p.tileId,
        letter: p.letter as Tile['letter'],
        points: tile.blank ? 0 : tile.points,
        blank: tile.letter === '*',
      };
    }
    const placedSet = new Set(placements.map((p) => `${p.row}:${p.col}`));

    // Détermine l'orientation du mot principal.
    const rows = new Set(placements.map((p) => p.row));
    const horizontal = rows.size === 1;
    const wordCells: Array<{ row: number; col: number }> = [];
    const anchor = placements[0];
    if (horizontal) {
      const r = anchor.row;
      let c = anchor.col;
      while (c >= 0 && draft[r][c]) c -= 1;
      c += 1;
      while (c < 15 && draft[r][c]) {
        wordCells.push({ row: r, col: c });
        c += 1;
      }
    } else {
      const c = anchor.col;
      let r = anchor.row;
      while (r >= 0 && draft[r][c]) r -= 1;
      r += 1;
      while (r < 15 && draft[r][c]) {
        wordCells.push({ row: r, col: c });
        r += 1;
      }
    }

    // Score du mot principal (inclut les lettres déjà posées, sans multiplicateur).
    let wordLetterSum = 0;
    let wordMult = 1;
    for (const cell of wordCells) {
      const tile = draft[cell.row][cell.col];
      if (!tile) continue;
      let pts = tile.blank ? 0 : tile.points;
      if (placedSet.has(`${cell.row}:${cell.col}`)) {
        const mult = multiplierAt(cell.row, cell.col);
        if (mult === 'DL') pts *= 2;
        if (mult === 'TL') pts *= 3;
        if (mult === 'DW' || mult === 'ST') wordMult *= 2;
        if (mult === 'TW') wordMult *= 3;
      }
      wordLetterSum += pts;
    }
    let total = wordLetterSum * wordMult;

    // Mots croisés perpendiculaires formés par chaque tuile posée (sous-estimation
    // volontaire : seules les lettres sont comptées, sans validation du dictionnaire).
    for (const p of placements) {
      if (horizontal) {
        let r = p.row - 1;
        while (r >= 0 && draft[r][p.col]) r -= 1;
        const top = r + 1;
        r = p.row + 1;
        while (r < 15 && draft[r][p.col]) r += 1;
        const bottom = r - 1;
        if (bottom - top < 1) continue;
        let crossSum = 0;
        let crossMult = 1;
        for (let rr = top; rr <= bottom; rr += 1) {
          const tile = draft[rr][p.col];
          if (!tile) continue;
          let pts = tile.blank ? 0 : tile.points;
          if (rr === p.row) {
            const mult = multiplierAt(rr, p.col);
            if (mult === 'DL') pts *= 2;
            if (mult === 'TL') pts *= 3;
            if (mult === 'DW' || mult === 'ST') crossMult *= 2;
            if (mult === 'TW') crossMult *= 3;
          }
          crossSum += pts;
        }
        total += crossSum * crossMult;
      } else {
        let c = p.col - 1;
        while (c >= 0 && draft[p.row][c]) c -= 1;
        const left = c + 1;
        c = p.col + 1;
        while (c < 15 && draft[p.row][c]) c += 1;
        const right = c - 1;
        if (right - left < 1) continue;
        let crossSum = 0;
        let crossMult = 1;
        for (let cc = left; cc <= right; cc += 1) {
          const tile = draft[p.row][cc];
          if (!tile) continue;
          let pts = tile.blank ? 0 : tile.points;
          if (cc === p.col) {
            const mult = multiplierAt(p.row, cc);
            if (mult === 'DL') pts *= 2;
            if (mult === 'TL') pts *= 3;
            if (mult === 'DW' || mult === 'ST') crossMult *= 2;
            if (mult === 'TW') crossMult *= 3;
          }
          crossSum += pts;
        }
        total += crossSum * crossMult;
      }
    }

    return total + (placements.length === 7 ? 50 : 0);
  }

  async function act(kind: 'pass' | 'resign' | 'exchange'): Promise<void> {
    if (!state || !canAct || submitting) return;
    if (kind === 'resign') {
      setConfirmResign(true);
      return;
    }
    if (kind === 'exchange' && exchangeIds.length === 0) {
      setExchangeMode(true);
      setMessage('Sélectionnez une ou plusieurs lettres à échanger.');
      return;
    }
    setSubmitting(true);
    try {
      await rpc('gameAction', {
        gameUuid,
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
    } finally {
      setSubmitting(false);
    }
  }

  async function performResign(): Promise<void> {
    setConfirmResign(false);
    if (!state || !canAct || submitting) return;
    setSubmitting(true);
    try {
      await rpc('gameAction', {
        gameUuid,
        version: Number(state.version),
        kind: 'resign',
        tileIds: [],
      });
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erreur');
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(): Promise<void> {
    if (!state || !canAct || placements.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await rpc<{ score: number; words: WordScore[] }>('play', {
        gameUuid,
        version: Number(state.version),
        placements,
      });
      setMessage(`${result.words.map((word) => word.word).join(', ')} : +${result.score} points`);
      clearDraft();
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erreur');
      await load();
    } finally {
      setSubmitting(false);
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
                    onClick={() => {
                      const staged = placements.some(
                        (p) => p.row === rowIndex && p.col === colIndex,
                      );
                      if (staged) recallTileAt(rowIndex, colIndex);
                      else choose(rowIndex, colIndex);
                    }}
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
                <button onClick={() => router.push(`/replay/${gameUuid}`)}>Voir le replay</button>
              </>
            ) : (
              <>
                <h2>{myTurn ? 'À vous de composer' : 'Tour adverse'}</h2>
                <p>{state.bag_count} lettres restantes</p>
                {myTurn && placements.length > 0 && (
                  <p className="draft-score">
                    Coup en cours : <strong>≈ +{estimateDraftScore()}</strong>{' '}
                    <small>estimation (validation serveur)</small>
                  </p>
                )}
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
            className={submitting ? 'submitting' : ''}
            onClick={() => void submit()}
            disabled={!canAct || placements.length === 0 || finished || submitting}
          >
            {submitting ? 'Validation…' : 'Valider'}
          </button>
          <button className="quiet" onClick={clearDraft} disabled={placements.length === 0 || submitting}>
            Rappeler
          </button>
          <button
            className="quiet"
            onClick={() => void act('exchange')}
            disabled={!canAct || finished || submitting}
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
          <button className="quiet" onClick={() => void act('pass')} disabled={!canAct || finished || submitting}>
            Passer
          </button>
          <button
            className={`danger${submitting ? ' submitting' : ''}`}
            onClick={() => void act('resign')}
            disabled={!canAct || finished || submitting}
          >
            Abandonner
          </button>
        </div>
      </footer>

      {blankRequest && (
        <Modal
          titleId="blank-title"
          title="Choisissez la lettre du joker"
          onClose={() => setBlankRequest(null)}
        >
          <p className="lead-small" style={{ marginBottom: '14px' }}>
            Le joker prend la valeur de votre choix et rapporte 0 point.
          </p>
          <div className="blank-grid" role="group" aria-label="Lettres de A à Z">
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => (
              <button
                key={letter}
                type="button"
                className="blank-tile"
                aria-label={`Joker ${letter}`}
                onClick={() => chooseBlankLetter(letter)}
              >
                {letter}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {confirmResign && (
        <Modal
          titleId="resign-title"
          title="Abandonner la partie ?"
          onClose={() => setConfirmResign(false)}
        >
          <p className="lead-small" style={{ marginBottom: '18px' }}>
            Cette action est définitive : la victoire sera attribuée à votre adversaire.
          </p>
          <div className="modal-actions">
            <button className="danger" onClick={() => void performResign()}>
              Oui, abandonner
            </button>
            <button className="quiet" onClick={() => setConfirmResign(false)}>
              Continuer la partie
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
