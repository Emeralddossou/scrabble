import { multiplierAt } from '@/domain/scrabble/board';
import { validateAndScore } from '@/domain/scrabble/rules';
import type { Board, Placement, Tile } from '@/domain/scrabble/types';

import { getDictionary, wordsByLength } from './dictionary';

export type AiLevel = 'easy' | 'medium' | 'hard' | 'expert';

export type Suggestion = {
  word: string;
  row: number;
  col: number;
  orientation: 'horizontal' | 'vertical';
  score: number;
  equity: number;
  tilesUsed: number;
  placements: Placement[];
};

type Slot = {
  row: number;
  col: number;
  horizontal: boolean;
  length: number;
  pattern: string;
  emptyCount: number;
  fixedCount: number;
};

const BOARD_SIZE = 15;
const patternCache = new Map<string, readonly string[]>();

function coordinate(slot: Slot, index: number): { row: number; col: number } {
  return {
    row: slot.row + (slot.horizontal ? 0 : index),
    col: slot.col + (slot.horizontal ? index : 0),
  };
}

function inside(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function hasPerpendicularNeighbour(
  board: Board,
  row: number,
  col: number,
  horizontal: boolean,
): boolean {
  const neighbours = horizontal
    ? [
        [row - 1, col],
        [row + 1, col],
      ]
    : [
        [row, col - 1],
        [row, col + 1],
      ];
  return neighbours.some(([nextRow, nextCol]) =>
    inside(nextRow, nextCol) ? Boolean(board[nextRow][nextCol]) : false,
  );
}

function generateSlots(board: Board, rackSize: number): Slot[] {
  const emptyBoard = board.every((line) => line.every((cell) => !cell));
  const slots: Slot[] = [];

  for (const horizontal of [true, false]) {
    for (let line = 0; line < BOARD_SIZE; line += 1) {
      for (let start = 0; start < BOARD_SIZE; start += 1) {
        const beforeRow = horizontal ? line : start - 1;
        const beforeCol = horizontal ? start - 1 : line;
        if (inside(beforeRow, beforeCol) && board[beforeRow][beforeCol]) continue;

        let emptyCount = 0;
        let fixedCount = 0;
        let touchesBoard = false;
        let pattern = '';

        for (let end = start; end < BOARD_SIZE; end += 1) {
          const row = horizontal ? line : end;
          const col = horizontal ? end : line;
          const cell = board[row][col];
          if (cell) {
            fixedCount += 1;
            pattern += cell.letter;
          } else {
            emptyCount += 1;
            pattern += '.';
            touchesBoard ||= hasPerpendicularNeighbour(board, row, col, horizontal);
          }

          const length = end - start + 1;
          if (length < 2 || emptyCount === 0 || emptyCount > rackSize) continue;

          const afterRow = horizontal ? line : end + 1;
          const afterCol = horizontal ? end + 1 : line;
          if (inside(afterRow, afterCol) && board[afterRow][afterCol]) continue;

          const rowStart = horizontal ? line : start;
          const colStart = horizontal ? start : line;
          const coversCentre = Array.from({ length }, (_, index) => {
            const currentRow = rowStart + (horizontal ? 0 : index);
            const currentCol = colStart + (horizontal ? index : 0);
            return currentRow === 7 && currentCol === 7;
          }).some(Boolean);

          if (emptyBoard ? !coversCentre : fixedCount === 0 && !touchesBoard) continue;

          slots.push({
            row: rowStart,
            col: colStart,
            horizontal,
            length,
            pattern,
            emptyCount,
            fixedCount,
          });
        }
      }
    }
  }

  return slots.sort(
    (left, right) =>
      right.fixedCount - left.fixedCount ||
      right.emptyCount - left.emptyCount ||
      right.length - left.length,
  );
}

async function wordsMatching(slot: Slot): Promise<readonly string[]> {
  const key = `${slot.length}:${slot.pattern}`;
  const cached = patternCache.get(key);
  if (cached) return cached;

  const fixedLetters = [...slot.pattern]
    .map((letter, index) => ({ letter, index }))
    .filter(({ letter }) => letter !== '.');
  const matches = (await wordsByLength(slot.length)).filter((word) =>
    fixedLetters.every(({ letter, index }) => word[index] === letter),
  );
  if (patternCache.size >= 1500) patternCache.delete(patternCache.keys().next().value as string);
  patternCache.set(key, matches);
  return matches;
}

function placementsForSlot(
  word: string,
  rack: Tile[],
  board: Board,
  slot: Slot,
): Placement[] | null {
  const available = [...rack];
  const placements: Placement[] = [];

  for (let index = 0; index < word.length; index += 1) {
    const { row, col } = coordinate(slot, index);
    const boardTile = board[row][col];
    const letter = word[index];
    if (boardTile) {
      if (boardTile.letter !== letter) return null;
      continue;
    }

    let tileIndex = available.findIndex((tile) => tile.letter === letter);
    if (tileIndex < 0) tileIndex = available.findIndex((tile) => tile.letter === '*');
    if (tileIndex < 0) return null;
    const [tile] = available.splice(tileIndex, 1);
    placements.push({ row, col, tileId: tile.id, letter });
  }

  return placements.length ? placements : null;
}

export function leaveValue(rack: Tile[], placements: Placement[]): number {
  const used = new Set(placements.map((placement) => placement.tileId));
  const leave = rack.filter((tile) => !used.has(tile.id));
  const vowels = leave.filter((tile) => 'AEIOUY'.includes(tile.letter)).length;
  const consonants = leave.length - vowels;
  const counts = leave.reduce<Record<string, number>>((result, tile) => {
    result[tile.letter] = (result[tile.letter] ?? 0) + 1;
    return result;
  }, {});
  const useful = leave.reduce((score, tile) => {
    if (tile.letter === '*') return score + 14;
    if ('ERSAITN'.includes(tile.letter)) return score + 1.8;
    if ('LODU'.includes(tile.letter)) return score + 0.8;
    if ('QJKWXYZ'.includes(tile.letter)) return score - 2.2;
    return score;
  }, 0);
  const balance = leave.length <= 1 ? 0 : Math.abs(vowels - consonants) * 0.7;
  const duplicates = Object.values(counts).reduce(
    (penalty, count) => penalty + Math.max(0, count - 2),
    0,
  );
  const qWithoutU = counts.Q && !counts.U ? 4 : 0;
  const pairs = (counts.QU ? 2.5 : 0) + (counts.C && counts.H ? 1.1 : 0) + (counts.E && counts.S ? 0.8 : 0);
  return useful + pairs - balance - duplicates - qWithoutU;
}

export function exposurePenalty(board: Board, placements: Placement[]): number {
  const occupied = new Set(placements.map(({ row, col }) => `${row}:${col}`));
  let penalty = 0;
  for (const placement of placements) {
    for (const [row, col] of [
      [placement.row - 1, placement.col],
      [placement.row + 1, placement.col],
      [placement.row, placement.col - 1],
      [placement.row, placement.col + 1],
    ]) {
      if (!inside(row, col) || board[row][col] || occupied.has(`${row}:${col}`)) continue;
      const multiplier = multiplierAt(row, col);
      if (multiplier === 'TW') penalty += 3;
      else if (multiplier === 'DW' || multiplier === 'ST') penalty += 1.5;
      else if (multiplier === 'TL') penalty += 0.75;
    }
  }
  return penalty;
}

function stableIndex(seed: string, size: number): number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(1, size);
}

export function chooseAiMove(
  suggestions: readonly Suggestion[],
  level: AiLevel,
  seed: string,
): Suggestion | undefined {
  if (!suggestions.length) return undefined;
  const byScore = [...suggestions].sort(
    (left, right) => right.score - left.score || right.equity - left.equity,
  );
  if (level === 'expert' || level === 'hard') {
    return [...suggestions].sort(
      (left, right) => right.equity - left.equity || right.score - left.score,
    )[0];
  }
  if (level === 'medium') {
    const pool = byScore.slice(0, Math.max(1, Math.ceil(byScore.length * 0.35)));
    return pool[stableIndex(seed, pool.length)];
  }
  const start = Math.floor(byScore.length * 0.55);
  const pool = byScore.slice(start).length ? byScore.slice(start) : byScore;
  return pool[stableIndex(seed, pool.length)];
}

/**
 * Pondération stratégique de l'equity selon le niveau de l'IA.
 * - `expert` valorise fortement la qualité du chevalet restant et la défense
 *   contre les ouvertures offertes à l'adversaire (jeu positionnel).
 * - `hard` applique une pondération intermédiaire (bon équilibre score/stratégie).
 * - Les autres niveaux (et le client de suggestions) utilisent la formule de base.
 */
function levelAwareEquity(
  score: number,
  leave: number,
  exposure: number,
  level?: AiLevel,
): number {
  if (level === 'expert') return score + leave * 1.4 - exposure * 1.8;
  if (level === 'hard') return score + leave * 1.1 - exposure * 1.3;
  return score + leave - exposure;
}

export async function suggestMoves(
  board: Board,
  rack: Tile[],
  limit = 24,
  budgetMs = 1200,
  level?: AiLevel,
): Promise<Suggestion[]> {
  const dictionary = await getDictionary();
  const startedAt = Date.now();
  const slots = generateSlots(board, rack.length);
  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();
  let checkedWords = 0;

  for (const slot of slots) {
    const words = await wordsMatching(slot);
    for (const word of words) {
      checkedWords += 1;
      if (checkedWords > 180_000 || Date.now() - startedAt > budgetMs) break;
      const placements = placementsForSlot(word, rack, board, slot);
      if (!placements) continue;
      const result = validateAndScore(board, rack, placements, dictionary);
      if (!result.valid) continue;
      const moveKey = placements
        .map(({ row, col, letter }) => `${row}:${col}:${letter}`)
        .sort()
        .join('|');
      if (seen.has(moveKey)) continue;
      seen.add(moveKey);
      const equity = levelAwareEquity(
        result.score,
        leaveValue(rack, placements),
        exposurePenalty(board, placements),
        level,
      );
      suggestions.push({
        word: result.words.map((entry) => entry.word).join(', '),
        row: slot.row,
        col: slot.col,
        orientation: slot.horizontal ? 'horizontal' : 'vertical',
        score: result.score,
        equity,
        tilesUsed: placements.length,
        placements,
      });
    }
    if (checkedWords > 180_000 || Date.now() - startedAt > budgetMs) break;
  }

  return suggestions
    .sort((left, right) => right.equity - left.equity || right.score - left.score)
    .slice(0, limit);
}
