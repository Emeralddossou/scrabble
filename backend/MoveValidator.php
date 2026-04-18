<?php
// backend/MoveValidator.php - Validation for game moves

require_once __DIR__ . '/BoardLayout.php';
require_once __DIR__ . '/GameException.php';

class MoveValidator
{
    // Board size from BoardLayout
    private const BOARD_SIZE = BoardLayout::BOARD_SIZE;

    // Valid letters in French Scrabble
    private const VALID_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ*';

    /**
     * Validate a complete move
     *
     * @param array $board Current board state
     * @param array $moves Array of move positions with letter, r, c
     * @return array Validated and normalized moves
     * @throws GameException
     */
    public static function validateMove($board, $moves): array
    {
        if (empty($moves)) {
            throw GameException::validation(
                'moves',
                'Aucune pièce posée',
                ['moves' => $moves]
            );
        }

        // Validate each individual move
        $normalized = [];
        foreach ($moves as $index => $move) {
            try {
                $normalized[] = self::validatePosition($move);
            } catch (GameException $e) {
                throw GameException::validation(
                    "moves[{$index}]",
                    $e->getMessage(),
                    ['index' => $index, 'move' => $move]
                );
            }
        }

        // Check alignment (all horizontal or all vertical)
        $isHorizontal = self::isHorizontal($normalized);
        $isVertical = self::isVertical($normalized);

        if (!$isHorizontal && !$isVertical) {
            throw new GameException(
                'Les pièces doivent être alignées horizontalement ou verticalement',
                GameException::INVALID_MOVE,
                'Les pièces doivent être alignées'
            );
        }

        // Check continuity (no gaps)
        self::validateContinuity($normalized, $board, $isHorizontal);

        // Check if connected to existing tiles or center
        self::validateConnection($normalized, $board);

        return $normalized;
    }

    /**
     * Validate individual move position
     *
     * @param array $move Move with r, c, letter
     * @return array Normalized move
     * @throws GameException
     */
    public static function validatePosition($move): array
    {
        // Check required fields
        if (!isset($move['r'], $move['c'], $move['letter'])) {
            throw new GameException(
                'Move must contain r, c, and letter',
                GameException::INVALID_MOVE,
                'Position de mouvement incomplète'
            );
        }

        $r = (int)$move['r'];
        $c = (int)$move['c'];

        // Validate bounds
        if (!BoardLayout::isValidPosition($r, $c)) {
            throw GameException::outOfBounds($r, $c, self::BOARD_SIZE);
        }

        // Validate letter
        $letter = self::validateLetter($move['letter']);
        $isBlank = !empty($move['is_blank']);

        return [
            'r' => $r,
            'c' => $c,
            'letter' => $letter,
            'is_blank' => $isBlank
        ];
    }

    /**
     * Validate letter format
     *
     * @param string $letter
     * @return string Uppercase letter
     * @throws GameException
     */
    public static function validateLetter($letter): string
    {
        $letter = strtoupper(trim($letter));

        if (empty($letter)) {
            throw new GameException(
                'Letter cannot be empty',
                GameException::INVALID_LETTER,
                'Lettre manquante'
            );
        }

        if (!preg_match('/^[' . self::VALID_LETTERS . ']$/', $letter)) {
            throw new GameException(
                "Invalid letter: {$letter}",
                GameException::INVALID_LETTER,
                "Lettre invalide: {$letter}",
                ['letter' => $letter]
            );
        }

        return $letter;
    }

    /**
     * Check if all moves share same row (horizontal)
     *
     * @param array $moves
     * @return bool
     */
    private static function isHorizontal($moves): bool
    {
        $rows = array_unique(array_column($moves, 'r'));
        return count($rows) === 1;
    }

    /**
     * Check if all moves share same column (vertical)
     *
     * @param array $moves
     * @return bool
     */
    private static function isVertical($moves): bool
    {
        $cols = array_unique(array_column($moves, 'c'));
        return count($cols) === 1;
    }

    /**
     * Validate continuity - no gaps in the word
     *
     * @param array $moves
     * @param array $board
     * @param bool $isHorizontal
     * @throws GameException
     */
    private static function validateContinuity($moves, $board, $isHorizontal): void
    {
        usort($moves, function ($a, $b) use ($isHorizontal) {
            return $isHorizontal ? $a['c'] - $b['c'] : $a['r'] - $b['r'];
        });

        $start = $isHorizontal ? $moves[0]['c'] : $moves[0]['r'];
        $end = $isHorizontal ? end($moves)['c'] : end($moves)['r'];
        $fixed = $isHorizontal ? $moves[0]['r'] : $moves[0]['c'];

        for ($i = $start; $i <= $end; $i++) {
            $r = $isHorizontal ? $fixed : $i;
            $c = $isHorizontal ? $i : $fixed;

            // Check if this position is in our moves
            $hasMove = false;
            foreach ($moves as $m) {
                if ($m['r'] === $r && $m['c'] === $c) {
                    $hasMove = true;
                    break;
                }
            }

            // If not in moves, check if board has a tile
            if (!$hasMove && empty($board[$r][$c])) {
                throw new GameException(
                    "Gap detected at position ({$r}, {$c})",
                    GameException::CONTINUITY_ERROR,
                    'Les pièces doivent être continues (pas de trous)',
                    ['r' => $r, 'c' => $c]
                );
            }
        }
    }

    /**
     * Validate connection - must touch existing tile or center
     *
     * @param array $moves
     * @param array $board
     * @throws GameException
     */
    private static function validateConnection($moves, $board): void
    {
        $isFirstMove = self::isBoardEmpty($board);
        $touchesExisting = false;

        if ($isFirstMove) {
            // First move must touch center (7,7)
            $center = BoardLayout::getStartPosition();
            $touchesCenter = false;

            foreach ($moves as $m) {
                if ($m['r'] === $center[0] && $m['c'] === $center[1]) {
                    $touchesCenter = true;
                }
            }

            if (!$touchesCenter) {
                throw new GameException(
                    'First word must pass through center',
                    GameException::BOARD_EMPTY,
                    'Le premier mot doit passer par le centre (H8)',
                    ['expected' => $center]
                );
            }

            // First word must be at least 2 letters
            if (count($moves) < 2) {
                throw new GameException(
                    'First word must be at least 2 letters',
                    GameException::BOARD_EMPTY,
                    'Le premier mot doit faire au moins 2 lettres',
                    ['count' => count($moves)]
                );
            }
        } else {
            // Check if touches existing tiles
            foreach ($moves as $m) {
                $neighbors = [
                    [$m['r'] - 1, $m['c']], [$m['r'] + 1, $m['c']],
                    [$m['r'], $m['c'] - 1], [$m['r'], $m['c'] + 1]
                ];

                foreach ($neighbors as $n) {
                    if (BoardLayout::isValidPosition($n[0], $n[1])) {
                        if ($board[$n[0]][$n[1]] !== null && $board[$n[0]][$n[1]] !== '') {
                            $touchesExisting = true;
                            break 2; // Exit both loops
                        }
                    }
                }
            }

            if (!$touchesExisting) {
                throw new GameException(
                    'Word must be connected to existing tiles',
                    GameException::NOT_CONNECTED,
                    'Le mot doit être rattaché à un mot existant'
                );
            }
        }
    }

    /**
     * Check if board is empty
     */
    private static function isBoardEmpty($board): bool
    {
        foreach ($board as $row) {
            foreach ($row as $cell) {
                if ($cell !== null) return false;
            }
        }
        return true;
    }

    /**
     * Validate rack has enough letters for exchange
     *
     * @param array $rack Current rack
     * @param array $lettersToExchange Letters to exchange
     * @throws GameException
     */
    public static function validateExchange($rack, $lettersToExchange): void
    {
        if (empty($lettersToExchange)) {
            throw new GameException(
                'No letters selected for exchange',
                GameException::INVALID_RACK,
                'Aucune lettre sélectionnée pour l\'échange'
            );
        }

        $rackCount = array_count_values($rack);
        $exchangeCount = array_count_values($lettersToExchange);

        foreach ($exchangeCount as $letter => $count) {
            $available = $rackCount[$letter] ?? 0;
            if ($available < $count) {
                throw new GameException(
                    "Not enough {$letter} letters in rack",
                    GameException::INVALID_RACK,
                    "Pas assez de lettres {$letter} dans le chevalet",
                    ['letter' => $letter, 'needed' => $count, 'available' => $available]
                );
            }
        }
    }
}
