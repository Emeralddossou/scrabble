import { validateAndScore } from '@/domain/scrabble/rules';
import type { Board, Placement, Tile } from '@/domain/scrabble/types';

import { getDictionary, wordsByLength } from './dictionary';

export type Suggestion = {
  word: string;
  row: number;
  col: number;
  orientation: 'horizontal' | 'vertical';
  score: number;
  placements: Placement[];
};

function placementsForWord(
  word: string,
  rack: Tile[],
  row: number,
  col: number,
  horizontal: boolean,
): Placement[] | null {
  const available = [...rack];
  const placements: Placement[] = [];
  for (let index = 0; index < word.length; index += 1) {
    const letter = word[index];
    const tileIndex = available.findIndex((tile) => tile.letter === letter || tile.letter === '*');
    if (tileIndex < 0) return null;
    const [tile] = available.splice(tileIndex, 1);
    placements.push({
      row: row + (horizontal ? 0 : index),
      col: col + (horizontal ? index : 0),
      tileId: tile.id,
      letter,
    });
  }
  return placements;
}

function canBuild(word: string, rack: Tile[]): boolean {
  const available = rack.reduce<Record<string, number>>((counts, tile) => {
    counts[tile.letter] = (counts[tile.letter] ?? 0) + 1;
    return counts;
  }, {});
  for (const letter of word) {
    if (available[letter]) available[letter] -= 1;
    else if (available['*']) available['*'] -= 1;
    else return false;
  }
  return true;
}

export async function suggestMoves(board: Board, rack: Tile[], limit = 12): Promise<Suggestion[]> {
  const dictionary = await getDictionary();
  const candidates: string[] = [];
  for (let length = Math.min(7, rack.length); length >= 2 && candidates.length < 300; length -= 1) {
    for (const word of await wordsByLength(length)) {
      if (canBuild(word, rack)) candidates.push(word);
      if (candidates.length >= 300) break;
    }
  }
  const suggestions: Suggestion[] = [];
  const empty = board.every((line) => line.every((cell) => !cell));
  for (const word of candidates) {
    const positions: Array<[number, number, boolean]> = empty
      ? [
          [7, 7 - Math.floor(word.length / 2), true],
          [7 - Math.floor(word.length / 2), 7, false],
        ]
      : Array.from(
          { length: 15 },
          (_, index) =>
            [
              [index, 0, true],
              [0, index, false],
            ] as Array<[number, number, boolean]>,
        ).flat();
    for (const [row, col, horizontal] of positions) {
      const placements = placementsForWord(word, rack, row, col, horizontal);
      if (!placements) continue;
      const result = validateAndScore(board, rack, placements, dictionary);
      if (result.valid) {
        suggestions.push({
          word: result.words.map((entry) => entry.word).join(', '),
          row,
          col,
          orientation: horizontal ? 'horizontal' : 'vertical',
          score: result.score,
          placements,
        });
      }
      if (suggestions.length >= limit * 5) break;
    }
    if (suggestions.length >= limit * 5) break;
  }
  return suggestions
    .sort((left, right) => right.score - left.score || left.word.localeCompare(right.word))
    .slice(0, limit);
}
