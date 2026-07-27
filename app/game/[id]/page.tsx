'use client';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cached, putCache, rpc } from '@/lib/client';
import { multiplierAt } from '@/lib/board';
import type { Board, Placement, Tile, WordScore } from '@/lib/types';

type PlayerView = { user_id: number; username: string; score: number; rack?: Tile[] };
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
  current_player_id: number;
  bag_count: number;
  players: PlayerView[];
  moves: MoveView[];
};
export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params),
    gameId = Number(id),
    r = useRouter(),
    [state, setState] = useState<State | null>(null),
    [placements, setPlacements] = useState<Placement[]>([]),
    [selected, setSelected] = useState<Tile | null>(null),
    [message, setMessage] = useState(''),
    [offline, setOffline] = useState(false);
  const load = useCallback(async () => {
    try {
      const s = await rpc<State>('state', { gameId });
      setState(s);
      putCache(`game:${gameId}`, s);
      setOffline(false);
    } catch {
      setState((x) => x ?? cached(`game:${gameId}`));
      setOffline(true);
    }
  }, [gameId]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  const me = useMemo(() => state?.players.find((player) => player.rack), [state]);
  function choose(row: number, col: number) {
    if (!selected || !state || state.board[row][col]) return;
    setPlacements((p) => [
      ...p.filter((x) => x.tileId !== selected.id && !(x.row === row && x.col === col)),
      {
        row,
        col,
        tileId: selected.id,
        letter:
          selected.letter === '*'
            ? (prompt('Lettre du joker') || 'A').slice(0, 1).toUpperCase()
            : selected.letter,
      },
    ]);
    setSelected(null);
  }
  async function act(kind: 'pass' | 'resign' | 'exchange') {
    if (!state) return;
    try {
      await rpc('gameAction', {
        gameId,
        version: Number(state.version),
        kind,
        tileIds: kind === 'exchange' && selected ? [selected.id] : [],
      });
      setPlacements([]);
      setSelected(null);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur');
    }
  }
  async function submit() {
    if (!state) return;
    try {
      const x = await rpc<{ score: number; words: WordScore[] }>('play', {
        gameId,
        version: Number(state.version),
        placements,
      });
      setMessage(`${x.words.map((word) => word.word).join(', ')} : +${x.score} points`);
      setPlacements([]);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur');
    }
  }
  if (!state || !me) return <main className="center-screen">Installation des lettres…</main>;
  const board = state.board.map((row) => [...row]);
  for (const p of placements)
    board[p.row][p.col] = {
      id: p.tileId,
      letter: p.letter as Tile['letter'],
      points: (me.rack ?? []).find((t: Tile) => t.id === p.tileId)?.points || 0,
      blank: me.rack?.find((tile) => tile.id === p.tileId)?.letter === '*',
    };
  return (
    <main className="game-shell">
      <header className="game-top">
        <button className="quiet" onClick={() => r.push('/dashboard')}>
          ← Salon
        </button>
        <div className="scoreboard">
          {state.players.map((p) => (
            <div
              className={Number(state.current_player_id) === Number(p.user_id) ? 'turn' : ''}
              key={p.user_id}
            >
              <span>{p.username}</span>
              <b>{p.score}</b>
            </div>
          ))}
        </div>
        <span className={offline ? 'network bad' : 'network'}>
          {offline ? 'Hors connexion' : 'Synchronisé'}
        </span>
      </header>
      <div className="game-grid">
        <section className="board-wrap">
          <div className="board">
            {board.flatMap((row, ri) =>
              row.map((cell, ci) => {
                const m = multiplierAt(ri, ci),
                  staged = placements.some((p) => p.row === ri && p.col === ci);
                return (
                  <button
                    key={`${ri}-${ci}`}
                    className={`cell ${m || ''} ${staged ? 'staged' : ''}`}
                    onClick={() => choose(ri, ci)}
                  >
                    {cell ? (
                      <>
                        <strong>{cell.letter}</strong>
                        <small>{cell.blank ? 0 : cell.points}</small>
                      </>
                    ) : (
                      <span>{m === 'ST' ? '★' : m}</span>
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </section>
        <aside className="game-side">
          <div className="side-card">
            <p className="eyebrow">TOUR ACTUEL</p>
            <h2>
              {Number(state.current_player_id) === Number(me.user_id)
                ? 'À vous de composer'
                : 'Tour adverse'}
            </h2>
            <p>{state.bag_count} lettres restantes</p>
            {message && <p className="notice">{message}</p>}
          </div>
          <div className="side-card history">
            <h3>Historique</h3>
            {state.moves
              .slice()
              .reverse()
              .map((m) => (
                <div key={m.id}>
                  <b>{m.username || 'Système'}</b>
                  <span>
                    {m.kind === 'play'
                      ? `${m.words.map((word) => word.word).join(', ')} · +${m.points}`
                      : m.kind}
                  </span>
                </div>
              ))}
          </div>
        </aside>
      </div>
      <footer className="rack-dock">
        <div className="rack">
          {(me.rack ?? []).map((t: Tile) => {
            const used = placements.some((p) => p.tileId === t.id);
            return (
              <button
                key={t.id}
                disabled={used}
                className={selected?.id === t.id ? 'selected' : ''}
                onClick={() => setSelected(t)}
              >
                <strong>{t.letter}</strong>
                <small>{t.points}</small>
              </button>
            );
          })}
        </div>
        <div className="game-buttons">
          <button onClick={submit} disabled={!placements.length || offline}>
            Valider
          </button>
          <button className="quiet" onClick={() => setPlacements([])}>
            Rappeler
          </button>
          <button className="quiet" onClick={() => act('exchange')} disabled={!selected}>
            Échanger
          </button>
          <button className="quiet" onClick={() => act('pass')}>
            Passer
          </button>
          <button className="danger" onClick={() => act('resign')}>
            Abandonner
          </button>
        </div>
      </footer>
    </main>
  );
}
