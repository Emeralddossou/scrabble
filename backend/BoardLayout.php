<?php
// backend/BoardLayout.php - Board layout constants and utilities

class BoardLayout
{
    // Board size
    const BOARD_SIZE = 15;

    // Multiplier definitions
    const MULTIPLIER_TW = 'tw'; // Triple word
    const MULTIPLIER_DW = 'dw'; // Double word
    const MULTIPLIER_TL = 'tl'; // Triple letter
    const MULTIPLIER_DL = 'dl'; // Double letter
    const MULTIPLIER_ST = 'st'; // Start (center)

    // Complete board layout
    const LAYOUT = [
        ['tw', '', '', 'dl', '', '', '', 'tw', '', '', '', 'dl', '', '', 'tw'],
        ['', 'dw', '', '', '', 'tl', '', '', '', 'tl', '', '', '', 'dw', ''],
        ['', '', 'dw', '', '', '', 'dl', '', 'dl', '', '', '', 'dw', '', ''],
        ['dl', '', '', 'dw', '', '', '', 'dl', '', '', '', 'dw', '', '', 'dl'],
        ['', '', '', '', 'dw', '', '', '', '', '', 'dw', '', '', '', ''],
        ['', 'tl', '', '', '', 'tl', '', '', '', 'tl', '', '', '', 'tl', ''],
        ['', '', 'dl', '', '', '', 'dl', '', 'dl', '', '', '', 'dl', '', ''],
        ['tw', '', '', 'dl', '', '', '', 'st', '', '', '', 'dl', '', '', 'tw'],
        ['', '', 'dl', '', '', '', 'dl', '', 'dl', '', '', '', 'dl', '', ''],
        ['', 'tl', '', '', '', 'tl', '', '', '', 'tl', '', '', '', 'tl', ''],
        ['', '', '', '', 'dw', '', '', '', '', '', 'dw', '', '', '', ''],
        ['dl', '', '', 'dw', '', '', '', 'dl', '', '', '', 'dw', '', '', 'dl'],
        ['', '', 'dw', '', '', '', 'dl', '', 'dl', '', '', '', 'dw', '', ''],
        ['', 'dw', '', '', '', 'tl', '', '', '', 'tl', '', '', '', 'dw', ''],
        ['tw', '', '', 'dl', '', '', '', 'tw', '', '', '', 'dl', '', '', 'tw']
    ];

    /**
     * Get multiplier at position (r, c)
     *
     * @param int $r Row index (0-14)
     * @param int $c Column index (0-14)
     * @return string Multiplier string or empty string
     */
    public static function getMultiplier($r, $c): string
    {
        if (!self::isValidPosition($r, $c)) {
            return '';
        }
        return self::LAYOUT[$r][$c] ?? '';
    }

    /**
     * Check if position is within board bounds
     *
     * @param int $r Row index
     * @param int $c Column index
     * @return bool True if position is valid
     */
    public static function isValidPosition($r, $c): bool
    {
        return $r >= 0 && $r < self::BOARD_SIZE && $c >= 0 && $c < self::BOARD_SIZE;
    }

    /**
     * Get the start (center) position
     *
     * @return array [r, c] coordinates
     */
    public static function getStartPosition(): array
    {
        $center = (int)(self::BOARD_SIZE / 2);
        return [$center, $center];
    }

    /**
     * Get all special squares (multipliers) on the board
     *
     * @return array Array of ['r' => int, 'c' => int, 'multiplier' => string]
     */
    public static function getSpecialSquares(): array
    {
        $specials = [];
        for ($r = 0; $r < self::BOARD_SIZE; $r++) {
            for ($c = 0; $c < self::BOARD_SIZE; $c++) {
                $multiplier = self::LAYOUT[$r][$c];
                if ($multiplier !== '') {
                    $specials[] = [
                        'r' => $r,
                        'c' => $c,
                        'multiplier' => $multiplier
                    ];
                }
            }
        }
        return $specials;
    }

    /**
     * Check if position has a word multiplier
     *
     * @param string $multiplier
     * @return bool
     */
    public static function isWordMultiplier($multiplier): bool
    {
        return in_array($multiplier, [self::MULTIPLIER_TW, self::MULTIPLIER_DW], true);
    }

    /**
     * Check if position has a letter multiplier
     *
     * @param string $multiplier
     * @return bool
     */
    public static function isLetterMultiplier($multiplier): bool
    {
        return in_array($multiplier, [self::MULTIPLIER_TL, self::MULTIPLIER_DL], true);
    }

    /**
     * Get multiplier name for display (French)
     *
     * @param string $multiplier
     * @return string Human-readable name
     */
    public static function getMultiplierName($multiplier): string
    {
        $names = [
            self::MULTIPLIER_TW => 'MT', // Mot triple
            self::MULTIPLIER_DW => 'MD', // Mot double
            self::MULTIPLIER_TL => 'LT', // Lettre triple
            self::MULTIPLIER_DL => 'LD', // Lettre double
            self::MULTIPLIER_ST => '☆',   // Start
        ];
        return $names[$multiplier] ?? '';
    }
}
