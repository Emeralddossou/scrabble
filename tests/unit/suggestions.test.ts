import { describe, expect, it } from 'vitest';

import { emptyBoard } from '@/domain/scrabble/rules';
import type { Tile } from '@/domain/scrabble/types';
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

  it('réserve le meilleur choix stratégique aux niveaux avancé et expert', () => {
    const highestScore = suggestion('MAX', 30, 18);
    const bestEquity = suggestion('LEAVE', 26, 42);
    const options = [highestScore, bestEquity, suggestion('OTHER', 12, 11)];

    expect(chooseAiMove(options, 'hard', 'seed')).toBe(bestEquity);
    expect(chooseAiMove(options, 'expert', 'seed')).toBe(bestEquity);
    expect(chooseAiMove(options, 'medium', 'seed')).toBeDefined();
    expect(chooseAiMove(options, 'easy', 'seed')).toBeDefined();
  });

  it('pondère différemment l’equity selon le niveau (expert plus défensif)', async () => {
    const board = emptyBoard();
    board[7][7] = { id: 'fixed-e', letter: 'E', points: 1 };
    const rack: Tile[] = [
      { id: 'r-a', letter: 'A', points: 1 },
      { id: 'r-t', letter: 'T', points: 1 },
      { id: 'r-r', letter: 'R', points: 1 },
    ];
    const base = await suggestMoves(board, rack, 30, 3000);
    const expert = await suggestMoves(board, rack, 30, 3000, 'expert');
    const hard = await suggestMoves(board, rack, 30, 3000, 'hard');
    expect(base.length).toBeGreaterThan(0);
    expect(expert.length).toBeGreaterThan(0);
    expect(hard.length).toBeGreaterThan(0);
    // Les classements diffèrent : l'expert et l'avancé ne partagent pas
    // systématiquement le même meilleur coup, car la pondération change.
    const topEquity = (moves: typeof base) => moves[0]?.equity ?? 0;
    expect(topEquity(expert)).not.toEqual(topEquity(hard));
  });
});
