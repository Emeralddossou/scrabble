import { describe, expect, it } from 'vitest';

import { emptyBoard } from '@/domain/scrabble/rules';
import type { Suggestion } from '@/server/game/suggestions';
import { chooseAiMove, suggestMoves } from '@/server/game/suggestions';

const suggestion = (word: string, score: number, equity: number): Suggestion => ({
  word,
  score,
  equity,
  tilesUsed: 1,
  row: 7,
  col: 7,
  orientation: 'horizontal',
  placements: [{ row: 7, col: 8, tileId: `${word}-tile`, letter: word.at(-1) ?? 'A' }],
});

describe('moteur de suggestions solo', () => {
  it('réutilise une lettre déjà présente au lieu de repartir du bord', async () => {
    const board = emptyBoard();
    board[7][7] = { id: 'fixed-e', letter: 'E', points: 1 };
    const moves = await suggestMoves(board, [{ id: 'rack-t', letter: 'T', points: 1 }], 20, 2000);

    expect(moves.length).toBeGreaterThan(0);
    expect(
      moves.some((move) =>
        move.placements.some(
          (placement) =>
            placement.tileId === 'rack-t' &&
            Math.abs(placement.row - 7) + Math.abs(placement.col - 7) === 1,
        ),
      ),
    ).toBe(true);
  });

  it('réserve le meilleur choix stratégique au niveau expert', () => {
    const highestScore = suggestion('MAX', 30, 18);
    const bestEquity = suggestion('LEAVE', 26, 42);
    const options = [highestScore, bestEquity, suggestion('OTHER', 12, 11)];

    expect(chooseAiMove(options, 'hard', 'seed')).toBe(bestEquity);
    expect(chooseAiMove(options, 'expert', 'seed')).toBe(bestEquity);
    expect(chooseAiMove(options, 'medium', 'seed')).toBeDefined();
    expect(chooseAiMove(options, 'easy', 'seed')).toBeDefined();
  });
});
