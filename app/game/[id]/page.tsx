'use client';

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useRouter } from 'next/navigation';

import { multiplierAt } from '@/lib/board';
import { api, cached, putCache, rpc } from '@/lib/client';
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
  is_solo: number;
  ai_level: string | null;
  share_enabled: number;
  players: PlayerView[];
  moves: MoveView[];
};
type Suggestion = {
  word: string;
  score: number;
  equity: number;
  placements: Placement[];
};
type FeedbackPreferences = { sound: boolean; haptic: boolean };
type DragSession = {
  tile: Tile;
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
  targetCell: { row: number; col: number } | null;
  targetRackTileId: string | null;
};

const FEEDBACK_KEY = 'lexiforge-game-feedback';
const DRAG_THRESHOLD = 8;

function storedFeedback(): FeedbackPreferences {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? '') as FeedbackPreferences;
  } catch {
    return { sound: false, haptic: false };
  }
}

function playTone(frequency: number): void {
  try {
    const Audio =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    const context = new Audio();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
  } catch {
    // Le navigateur peut refuser Web Audio ; le jeu reste entièrement jouable sans son.
  }
}

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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [rackOrder, setRackOrder] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<FeedbackPreferences>({ sound: false, haptic: false });
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  const boardRef = useRef<HTMLDivElement>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const suppressRackClickRef = useRef(false);

  useEffect(() => setFeedback(storedFeedback()), []);

  useEffect(() => {
    const ids = (me?.rack ?? []).map((tile) => tile.id);
    setRackOrder((current) => [
      ...current.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !current.includes(id)),
    ]);
  }, [me?.rack]);

  function notifyFeedback(kind: 'tile' | 'success' | 'error'): void {
    if (feedback.sound) playTone(kind === 'error' ? 180 : kind === 'success' ? 660 : 440);
    if (feedback.haptic && 'vibrate' in navigator) {
      navigator.vibrate(kind === 'error' ? [30, 35, 30] : kind === 'success' ? 22 : 10);
    }
  }

  function updateFeedback(next: FeedbackPreferences): void {
    setFeedback(next);
    try {
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next));
    } catch {
      // Préférence locale facultative, notamment indisponible dans certains modes privés.
    }
  }

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const next = await rpc<State>('state', { gameUuid });
      setState(next);
      setReceivedAt(Date.now());
      putCache(`game:${gameUuid}`, next);
      setOffline(false);
      return true;
    } catch {
      setState((current) => current ?? cached(`game:${gameUuid}`));
      setOffline(true);
      return false;
    }
  }, [gameUuid]);

  // Polling adaptatif : rapide (2 s) pendant le tour adverse, lent (12 s) sinon.
  // Suspendu quand l'onglet est caché. Backoff en cas de réseau dégradé.
  const pollInterval = myTurn || finished ? 12_000 : 2_000;

  useEffect(() => {
    void load();
    let timer: number | undefined;
    let backoff = pollInterval;
    const schedule = (): void => {
      timer = window.setTimeout(async () => {
        if (document.visibilityState !== 'visible') {
          schedule();
          return;
        }
        const connected = await load();
        backoff = connected ? pollInterval : Math.min(backoff * 2, 30_000);
        schedule();
      }, backoff);
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
    notifyFeedback('tile');
  }

  function chooseBlankLetter(letter: string): void {
    if (!blankRequest) return;
    placeTile(blankRequest.row, blankRequest.col, blankRequest.tile, letter);
    setBlankRequest(null);
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

  function reorderRack(tileId: string, targetId: string): void {
    if (tileId === targetId) return;
    setRackOrder((current) => {
      const source = current.indexOf(tileId);
      const target = current.indexOf(targetId);
      if (source < 0 || target < 0) return current;
      const next = [...current];
      next.splice(source, 1);
      next.splice(target, 0, tileId);
      return next;
    });
  }

  function removeDragGhost(): void {
    dragGhostRef.current?.remove();
    dragGhostRef.current = null;
  }

  function createDragGhost(tile: Tile, clientX: number, clientY: number): void {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    const ghostLetter = document.createElement('strong');
    ghostLetter.textContent = tile.letter === '*' ? '*' : tile.letter;
    const ghostScore = document.createElement('small');
    ghostScore.textContent = String(tile.blank ? 0 : tile.points);
    ghost.append(ghostLetter, ghostScore);
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    updateDragGhost(clientX, clientY);
  }

  function updateDragGhost(clientX: number, clientY: number): void {
    if (!dragGhostRef.current) return;
    dragGhostRef.current.style.left = `${clientX - 24}px`;
    dragGhostRef.current.style.top = `${clientY - 26}px`;
  }

  function boardCellAtPoint(clientX: number, clientY: number): { row: number; col: number } | null {
    const boardElement = boardRef.current;
    if (!boardElement) return null;
    const rect = boardElement.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX >= rect.right ||
      clientY < rect.top ||
      clientY >= rect.bottom ||
      rect.width === 0 ||
      rect.height === 0
    ) {
      return null;
    }
    const col = Math.floor(((clientX - rect.left) / rect.width) * 15);
    const row = Math.floor(((clientY - rect.top) / rect.height) * 15);
    return row >= 0 && row < 15 && col >= 0 && col < 15 ? { row, col } : null;
  }

  function rackTileAtPoint(clientX: number, clientY: number): string | null {
    const target = document.elementFromPoint(clientX, clientY);
    const rackTile = target?.closest('[data-rack-tile]') as HTMLElement | null;
    return rackTile?.dataset.rackTile ?? null;
  }

  function updateDragTarget(session: DragSession, clientX: number, clientY: number): void {
    const cell = boardCellAtPoint(clientX, clientY);
    session.targetCell = cell;
    session.targetRackTileId = cell ? null : rackTileAtPoint(clientX, clientY);
    setHoverCell((current) => {
      const next = cell && state && !state.board[cell.row][cell.col] ? cell : null;
      if (current?.row === next?.row && current?.col === next?.col) return current;
      return next;
    });
  }

  function handlePointerDown(tile: Tile, event: ReactPointerEvent<HTMLButtonElement>): void {
    if (!canAct || finished || exchangeMode) return;
    removeDragGhost();
    setHoverCell(null);
    suppressRackClickRef.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Certains navigateurs refusent la capture si le pointeur a déjà été annulé.
    }
    dragSessionRef.current = {
      tile,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      targetCell: null,
      targetRackTileId: null,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>): void {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (!session.dragging) {
      if (distance <= DRAG_THRESHOLD) return;
      session.dragging = true;
      setIsDragging(true);
      setSelected(session.tile);
      createDragGhost(session.tile, event.clientX, event.clientY);
    }
    updateDragGhost(event.clientX, event.clientY);
    updateDragTarget(session, event.clientX, event.clientY);
  }

  function finishPointerInteraction(
    event: ReactPointerEvent<HTMLButtonElement>,
    cancelled = false,
  ): void {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const wasDragging = session.dragging;
    if (wasDragging && !cancelled) {
      const { targetCell, targetRackTileId, tile } = session;
      if (
        targetCell &&
        state &&
        !state.board[targetCell.row][targetCell.col] &&
        canAct &&
        !exchangeMode
      ) {
        choose(targetCell.row, targetCell.col, tile);
      } else if (!targetCell && targetRackTileId && !exchangeMode) {
        reorderRack(tile.id, targetRackTileId);
      }
    }
    if (wasDragging) {
      setSelected(null);
      suppressRackClickRef.current = true;
      window.setTimeout(() => {
        suppressRackClickRef.current = false;
      }, 0);
    }
    removeDragGhost();
    setHoverCell(null);
    setIsDragging(false);
    dragSessionRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // La capture peut déjà avoir été libérée par le navigateur.
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>): void {
    finishPointerInteraction(event);
  }

  function handleRackClick(tile: Tile): void {
    if (suppressRackClickRef.current) {
      suppressRackClickRef.current = false;
      return;
    }
    selectRackTile(tile);
  }

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
      notifyFeedback('success');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erreur');
      notifyFeedback('error');
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
      notifyFeedback('success');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erreur');
      notifyFeedback('error');
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
      notifyFeedback('success');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erreur');
      notifyFeedback('error');
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleReplaySharing(): Promise<void> {
    if (!state || !finished) return;
    setSubmitting(true);
    try {
      const result = await api<{ enabled: boolean; sharePath?: string }>(
        `/api/games/${gameUuid}/share`,
        {
          method: 'POST',
          body: JSON.stringify({ enabled: !Number(state.share_enabled) }),
        },
      );
      if (result.enabled && result.sharePath) {
        const url = new URL(result.sharePath, window.location.origin).href;
        try {
          await navigator.clipboard.writeText(url);
          setMessage('Lien de replay partagé copié. Vous pouvez le désactiver à tout moment.');
        } catch {
          setMessage(`Lien de replay partagé : ${url}`);
        }
      } else {
        setMessage('Le lien de replay partagé est désactivé.');
      }
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible de modifier le partage.');
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
  const orderedRack = [...(me.rack ?? [])].sort(
    (left, right) => rackOrder.indexOf(left.id) - rackOrder.indexOf(right.id),
  );

  async function loadSuggestions(): Promise<void> {
    setSuggestionsLoading(true);
    setMessage('');
    try {
      const result = await api<{ suggestions: Suggestion[] }>(`/api/games/${gameUuid}/suggestions`);
      setSuggestions(result.suggestions);
      if (!result.suggestions.length)
        setMessage('Aucun coup légal n’a été trouvé pour ce chevalet.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Les suggestions sont indisponibles.');
    } finally {
      setSuggestionsLoading(false);
    }
  }

  function previewSuggestion(suggestion: Suggestion): void {
    if (!state) return;
    setDraftVersion(state.version);
    setPlacements(suggestion.placements);
    setSelected(null);
    setMessage(
      `${suggestion.word} : +${suggestion.score} points. Vérifiez puis validez votre coup.`,
    );
  }

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

      <section className={`game-status ${finished ? 'finished' : ''}`} aria-live="polite">
        <strong>
          {finished ? 'Partie terminée' : myTurn ? 'À vous de composer' : 'Tour adverse'}
        </strong>
        {!finished && <span>{state.bag_count} lettres restantes</span>}
        {myTurn && placements.length > 0 && (
          <span className="draft-score">
            Coup en cours : <strong>≈ +{estimateDraftScore()}</strong>
          </span>
        )}
        {message && (
          <span className="game-status-message" role="status">
            {message}
          </span>
        )}
      </section>

      <div className="game-grid">
        <section className="board-wrap" aria-label="Plateau de Scrabble">
          <div className="board" ref={boardRef}>
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
            {finished && (
              <div className="side-card">
                <p className="eyebrow">ÉTAT DE LA PARTIE</p>
                <h2>{winner ? `${winner.username} remporte la partie` : 'Partie nulle'}</h2>
                <p>Motif : {state.end_reason ?? 'fin de partie'}</p>
                <button onClick={() => router.push(`/replay/${gameUuid}`)}>Voir le replay</button>
                <button
                  className="quiet"
                  disabled={submitting}
                  onClick={() => void toggleReplaySharing()}
                >
                  {Number(state.share_enabled) ? 'Désactiver le partage' : 'Partager le replay'}
                </button>
              </div>
            )}
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
            {Number(state.is_solo) === 1 && myTurn && !finished && (
              <div className="side-card training-card">
                <p className="eyebrow">ENTRAÎNEMENT SOLO</p>
                <h3>Besoin d’un indice ?</h3>
                <p>Les propositions restent privées à cette partie contre l’IA.</p>
                <button
                  type="button"
                  className="quiet"
                  disabled={suggestionsLoading || submitting}
                  onClick={() => void loadSuggestions()}
                >
                  {suggestionsLoading ? 'Recherche…' : 'Suggérer un coup'}
                </button>
                {suggestions.length > 0 && (
                  <div className="suggestion-list" aria-live="polite">
                    {suggestions.slice(0, 3).map((suggestion) => (
                      <button
                        type="button"
                        className="suggestion-row"
                        key={`${suggestion.word}:${suggestion.placements.map((item) => item.tileId).join('-')}`}
                        onClick={() => previewSuggestion(suggestion)}
                      >
                        <span>
                          <b>{suggestion.word}</b>
                          <small>{suggestion.placements.length} lettre(s) posée(s)</small>
                        </span>
                        <strong>+{suggestion.score}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="side-card feedback-card">
              <h3>Retours de jeu</h3>
              <label>
                <input
                  type="checkbox"
                  checked={feedback.sound}
                  onChange={(event) => updateFeedback({ ...feedback, sound: event.target.checked })}
                />{' '}
                Sons discrets
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={feedback.haptic}
                  onChange={(event) =>
                    updateFeedback({ ...feedback, haptic: event.target.checked })
                  }
                />{' '}
                Vibration tactile
              </label>
            </div>
            {message && (
              <p className="notice game-side-message" role="status">
                {message}
              </p>
            )}
          </div>
        </aside>
      </div>

      <footer className="rack-dock">
        <div className="rack" aria-label="Votre chevalet">
          {orderedRack.map((tile) => {
            const used = placements.some((placement) => placement.tileId === tile.id);
            const exchangeSelected = exchangeIds.includes(tile.id);
            return (
              <button
                key={tile.id}
                disabled={used || !canAct || finished}
                className={`${selected?.id === tile.id || exchangeSelected ? 'selected' : ''} ${isDragging && dragSessionRef.current?.tile.id === tile.id ? 'dragging' : ''}`}
                onClick={() => handleRackClick(tile)}
                onPointerDown={(event) => handlePointerDown(tile, event)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={(event) => finishPointerInteraction(event, true)}
                onKeyDown={(event) => {
                  if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                  event.preventDefault();
                  const index = orderedRack.findIndex((item) => item.id === tile.id);
                  const target = orderedRack[index + (event.key === 'ArrowLeft' ? -1 : 1)];
                  if (target) reorderRack(tile.id, target.id);
                }}
                data-rack-tile={tile.id}
                aria-pressed={selected?.id === tile.id || exchangeSelected}
                aria-label={`${tile.letter}, ${tile.points} point(s). Alt + flèche gauche ou droite pour réorganiser.`}
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
          <button
            className="quiet"
            onClick={clearDraft}
            disabled={placements.length === 0 || submitting}
          >
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
          <button
            className="quiet"
            onClick={() => void act('pass')}
            disabled={!canAct || finished || submitting}
          >
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
