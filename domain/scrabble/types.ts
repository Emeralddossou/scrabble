export type Letter =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'
  | '*';

export type Tile = {
  id: string;
  letter: Letter;
  points: number;
  blank?: boolean;
};

export type BoardCell = Tile | null;
export type Board = BoardCell[][];

export type Placement = {
  row: number;
  col: number;
  tileId: string;
  letter: string;
};

export type GameMode = 'free' | 'timer';
export type GameStatus = 'active' | 'finished';
export type MoveKind = 'play' | 'pass' | 'exchange' | 'resign' | 'timeout' | 'end';
export type Multiplier = 'TW' | 'DW' | 'TL' | 'DL' | 'ST' | null;

export type WordScore = {
  word: string;
  score: number;
  coordinates: Array<{ row: number; col: number }>;
};

export type ScoredMove = {
  board: Board;
  score: number;
  words: WordScore[];
};
