import { randomUUID } from 'node:crypto';

import type { Tile } from './types';

export const LETTER_VALUES = {
  A: { count: 9, points: 1 },
  B: { count: 2, points: 3 },
  C: { count: 2, points: 3 },
  D: { count: 3, points: 2 },
  E: { count: 15, points: 1 },
  F: { count: 2, points: 4 },
  G: { count: 2, points: 2 },
  H: { count: 2, points: 4 },
  I: { count: 8, points: 1 },
  J: { count: 1, points: 8 },
  K: { count: 1, points: 10 },
  L: { count: 5, points: 1 },
  M: { count: 3, points: 2 },
  N: { count: 6, points: 1 },
  O: { count: 6, points: 1 },
  P: { count: 2, points: 3 },
  Q: { count: 1, points: 8 },
  R: { count: 6, points: 1 },
  S: { count: 6, points: 1 },
  T: { count: 6, points: 1 },
  U: { count: 6, points: 1 },
  V: { count: 2, points: 4 },
  W: { count: 1, points: 10 },
  X: { count: 1, points: 10 },
  Y: { count: 1, points: 10 },
  Z: { count: 1, points: 10 },
  '*': { count: 2, points: 0 },
} as const;

export type Random = () => number;
export const defaultRandom: Random = Math.random;

export function createBag(random: Random = defaultRandom): Tile[] {
  const bag = Object.entries(LETTER_VALUES).flatMap(([letter, value]) =>
    Array.from({ length: value.count }, () => ({
      id: randomUUID(),
      letter: letter as Tile['letter'],
      points: value.points,
    })),
  );

  for (let index = bag.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [bag[index], bag[other]] = [bag[other], bag[index]];
  }
  return bag;
}

export function draw(bag: Tile[], count: number): { bag: Tile[]; tiles: Tile[] } {
  const drawn = bag.slice(Math.max(0, bag.length - count));
  return { bag: bag.slice(0, Math.max(0, bag.length - count)), tiles: drawn };
}

export function rackValue(rack: Tile[]): number {
  return rack.reduce((total, tile) => total + (tile.blank ? 0 : tile.points), 0);
}
