import { multiplierAt } from './board';
import { LETTER_VALUES } from './tiles';
import type { Board, Placement, ScoredMove, Tile, WordScore } from './types';

const BOARD_SIZE = 15;
const CENTER = 7;

export const emptyBoard = (): Board =>
  Array.from({ length: BOARD_SIZE }, () => Array<Tile | null>(BOARD_SIZE).fill(null));

export function normalizeWord(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export type InvalidMove = { valid: false; error: string };
export type ValidMove = { valid: true } & ScoredMove;
export type ValidationResult = ValidMove | InvalidMove;

const isInside = (row: number, col: number) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
const isEmpty = (board: Board) => board.every((row) => row.every((cell) => cell === null));
const cellKey = (row: number, col: number) => `${row}:${col}`;

type WordCells = Array<{ row: number; col: number; tile: Tile }>;

function readWord(board: Board, row: number, col: number, horizontal: boolean): WordCells {
  let startRow = row;
  let startCol = col;
  while (
    isInside(horizontal ? startRow : startRow - 1, horizontal ? startCol - 1 : startCol) &&
    board[horizontal ? startRow : startRow - 1][horizontal ? startCol - 1 : startCol]
  ) {
    if (horizontal) startCol -= 1;
    else startRow -= 1;
  }

  const cells: WordCells = [];
  while (isInside(startRow, startCol) && board[startRow][startCol]) {
    cells.push({ row: startRow, col: startCol, tile: board[startRow][startCol] as Tile });
    if (horizontal) startCol += 1;
    else startRow += 1;
  }
  return cells;
}

function scoreWord(cells: WordCells, newlyPlaced: Set<string>): WordScore {
  let total = 0;
  let wordMultiplier = 1;
  for (const cell of cells) {
    let points = cell.tile.blank ? 0 : LETTER_VALUES[cell.tile.letter].points;
    if (newlyPlaced.has(cellKey(cell.row, cell.col))) {
      const multiplier = multiplierAt(cell.row, cell.col);
      if (multiplier === 'DL') points *= 2;
      if (multiplier === 'TL') points *= 3;
      if (multiplier === 'DW' || multiplier === 'ST') wordMultiplier *= 2;
      if (multiplier === 'TW') wordMultiplier *= 3;
    }
    total += points;
  }
  return {
    word: cells.map((cell) => cell.tile.letter).join(''),
    score: total * wordMultiplier,
    coordinates: cells.map(({ row, col }) => ({ row, col })),
  };
}

export function validateAndScore(
  board: Board,
  rack: Tile[],
  placements: Placement[],
  dictionary: ReadonlySet<string>,
): ValidationResult {
  if (placements.length === 0) return { valid: false, error: 'Posez au moins une lettre.' };
  if (placements.length > 7)
    return { valid: false, error: 'Un chevalet contient au maximum sept lettres.' };

  const byTileId = new Map(rack.map((tile) => [tile.id, tile]));
  const seenTiles = new Set<string>();
  const seenCells = new Set<string>();
  for (const placement of placements) {
    const key = cellKey(placement.row, placement.col);
    if (
      !isInside(placement.row, placement.col) ||
      seenCells.has(key) ||
      board[placement.row][placement.col]
    ) {
      return { valid: false, error: 'Une case est invalide ou déjà occupée.' };
    }
    const tile = byTileId.get(placement.tileId);
    if (!tile || seenTiles.has(tile.id))
      return { valid: false, error: 'Cette tuile ne peut pas être utilisée.' };
    const letter = normalizeWord(placement.letter);
    if (!/^[A-Z]$/.test(letter) || (tile.letter !== '*' && tile.letter !== letter)) {
      return { valid: false, error: 'La lettre ne correspond pas à la tuile.' };
    }
    seenTiles.add(tile.id);
    seenCells.add(key);
  }

  const rows = new Set(placements.map((placement) => placement.row));
  const cols = new Set(placements.map((placement) => placement.col));
  if (rows.size > 1 && cols.size > 1)
    return { valid: false, error: 'Les lettres doivent être alignées.' };
  const horizontal = rows.size === 1;
  const next = board.map((row) => [...row]);
  for (const placement of placements) {
    const original = byTileId.get(placement.tileId) as Tile;
    next[placement.row][placement.col] = {
      ...original,
      letter: normalizeWord(placement.letter) as Tile['letter'],
      blank: original.letter === '*',
    };
  }

  const opening = isEmpty(board);
  if (opening) {
    if (!next[CENTER][CENTER]) return { valid: false, error: 'Le premier mot doit couvrir H8.' };
    if (placements.length < 2)
      return { valid: false, error: 'Le premier mot doit contenir deux lettres.' };
  } else {
    const connected = placements.some(({ row, col }) =>
      [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ].some(([r, c]) => isInside(r, c) && board[r][c] !== null),
    );
    if (!connected) return { valid: false, error: 'Le coup doit se raccorder au plateau.' };
  }

  const changingAxis = placements.map((placement) => (horizontal ? placement.col : placement.row));
  const fixed = horizontal ? placements[0].row : placements[0].col;
  for (let index = Math.min(...changingAxis); index <= Math.max(...changingAxis); index += 1) {
    if (!next[horizontal ? fixed : index][horizontal ? index : fixed]) {
      return { valid: false, error: 'Les lettres posées doivent être continues.' };
    }
  }

  const candidates = [
    readWord(next, placements[0].row, placements[0].col, horizontal),
    ...placements
      .map((placement) => readWord(next, placement.row, placement.col, !horizontal))
      .filter((word) => word.length > 1),
  ];
  const uniqueWords = new Map<string, WordCells>();
  for (const cells of candidates)
    uniqueWords.set(cells.map((cell) => cellKey(cell.row, cell.col)).join('|'), cells);

  const newCells = new Set(placements.map(({ row, col }) => cellKey(row, col)));
  const words: WordScore[] = [];
  for (const cells of uniqueWords.values()) {
    if (cells.length < 2) return { valid: false, error: 'Un mot doit contenir deux lettres.' };
    const scored = scoreWord(cells, newCells);
    if (!dictionary.has(normalizeWord(scored.word))) {
      return { valid: false, error: `Mot non admis : ${scored.word}` };
    }
    words.push(scored);
  }

  return {
    valid: true,
    board: next,
    words,
    score: words.reduce((total, word) => total + word.score, placements.length === 7 ? 50 : 0),
  };
}
