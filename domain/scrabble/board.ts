import type { Multiplier } from './types';

const coordinate = (row: number, col: number) => `${row}:${col}`;

function symmetricCoordinates(pairs: Array<[number, number]>): Set<string> {
  const output = new Set<string>();
  for (const [row, col] of pairs) {
    for (const [r, c] of [
      [row, col],
      [row, 14 - col],
      [14 - row, col],
      [14 - row, 14 - col],
      [col, row],
      [col, 14 - row],
      [14 - col, row],
      [14 - col, 14 - row],
    ])
      output.add(coordinate(r, c));
  }
  return output;
}

const tripleWord = symmetricCoordinates([
  [0, 0],
  [0, 7],
]);
const doubleWord = symmetricCoordinates([
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
]);
const tripleLetter = symmetricCoordinates([
  [1, 5],
  [5, 5],
  [5, 1],
]);
const doubleLetter = symmetricCoordinates([
  [0, 3],
  [2, 6],
  [3, 7],
  [6, 6],
  [6, 2],
]);

export function multiplierAt(row: number, col: number): Multiplier {
  if (row === 7 && col === 7) return 'ST';
  const key = coordinate(row, col);
  if (tripleWord.has(key)) return 'TW';
  if (doubleWord.has(key)) return 'DW';
  if (tripleLetter.has(key)) return 'TL';
  if (doubleLetter.has(key)) return 'DL';
  return null;
}
