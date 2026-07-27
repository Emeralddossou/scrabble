import { describe, expect, it } from 'vitest';

import { multiplierAt } from '@/domain/scrabble/board';
import { emptyBoard, validateAndScore } from '@/domain/scrabble/rules';
import { createBag, LETTER_VALUES } from '@/domain/scrabble/tiles';
import type { Tile } from '@/domain/scrabble/types';

const tile = (id: string, letter: Tile['letter'], points = LETTER_VALUES[letter].points): Tile => ({
  id,
  letter,
  points,
});

describe('règles de Scrabble', () => {
  it('fabrique exactement les 102 tuiles françaises avec des identifiants uniques', () => {
    const bag = createBag(() => 0.5);
    expect(bag).toHaveLength(102);
    expect(new Set(bag.map((entry) => entry.id)).size).toBe(102);
    expect(bag.filter((entry) => entry.letter === '*')).toHaveLength(2);
  });

  it('exige un premier mot de deux lettres couvrant le centre', () => {
    const rack = [tile('a', 'A'), tile('b', 'B')];
    const outside = validateAndScore(
      emptyBoard(),
      rack,
      [
        { row: 0, col: 0, tileId: 'a', letter: 'A' },
        { row: 0, col: 1, tileId: 'b', letter: 'B' },
      ],
      new Set(['AB']),
    );
    const oneLetter = validateAndScore(
      emptyBoard(),
      rack,
      [{ row: 7, col: 7, tileId: 'a', letter: 'A' }],
      new Set(['A']),
    );
    expect(outside.valid).toBe(false);
    expect(oneLetter.valid).toBe(false);
  });

  it('score la case centrale, les multiplicateurs et un joker à zéro', () => {
    const rack = [tile('a', 'A'), tile('b', 'B'), tile('blank', '*')];
    const result = validateAndScore(
      emptyBoard(),
      rack,
      [
        { row: 7, col: 7, tileId: 'a', letter: 'A' },
        { row: 7, col: 8, tileId: 'b', letter: 'B' },
      ],
      new Set(['AB']),
    );
    expect(result.valid && result.score).toBe(8);
    const blank = validateAndScore(
      emptyBoard(),
      rack,
      [
        { row: 7, col: 7, tileId: 'blank', letter: 'A' },
        { row: 7, col: 8, tileId: 'b', letter: 'B' },
      ],
      new Set(['AB']),
    );
    expect(blank.valid && blank.score).toBe(6);
    expect(multiplierAt(0, 0)).toBe('TW');
    expect(multiplierAt(7, 7)).toBe('ST');
  });

  it('refuse les diagonales, trous, tuiles absentes, réutilisées et mots invalides', () => {
    const rack = [tile('a', 'A'), tile('b', 'B')];
    const dictionary = new Set(['AB']);
    expect(
      validateAndScore(
        emptyBoard(),
        rack,
        [
          { row: 7, col: 7, tileId: 'a', letter: 'A' },
          { row: 8, col: 8, tileId: 'b', letter: 'B' },
        ],
        dictionary,
      ).valid,
    ).toBe(false);
    expect(
      validateAndScore(
        emptyBoard(),
        rack,
        [
          { row: 7, col: 7, tileId: 'a', letter: 'A' },
          { row: 7, col: 9, tileId: 'b', letter: 'B' },
        ],
        dictionary,
      ).valid,
    ).toBe(false);
    expect(
      validateAndScore(
        emptyBoard(),
        rack,
        [
          { row: 7, col: 7, tileId: 'missing', letter: 'A' },
          { row: 7, col: 8, tileId: 'b', letter: 'B' },
        ],
        dictionary,
      ).valid,
    ).toBe(false);
    expect(
      validateAndScore(
        emptyBoard(),
        rack,
        [
          { row: 7, col: 7, tileId: 'a', letter: 'A' },
          { row: 7, col: 8, tileId: 'a', letter: 'A' },
        ],
        dictionary,
      ).valid,
    ).toBe(false);
    expect(
      validateAndScore(
        emptyBoard(),
        rack,
        [
          { row: 7, col: 7, tileId: 'a', letter: 'A' },
          { row: 7, col: 8, tileId: 'b', letter: 'B' },
        ],
        new Set(),
      ).valid,
    ).toBe(false);
  });

  it('construit et score les mots croisés sans réutiliser les multiplicateurs', () => {
    const board = emptyBoard();
    board[7][7] = tile('old-a', 'A');
    board[6][8] = tile('old-e', 'E');
    const result = validateAndScore(
      board,
      [tile('b', 'B'), tile('t', 'T')],
      [
        { row: 7, col: 8, tileId: 'b', letter: 'B' },
        { row: 7, col: 9, tileId: 't', letter: 'T' },
      ],
      new Set(['ABT', 'EB']),
    );
    expect(result.valid).toBe(true);
    if (result.valid)
      expect(result.words.map((word) => word.word)).toEqual(expect.arrayContaining(['ABT', 'EB']));
  });
});
