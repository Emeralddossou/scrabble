// BoardLayout.js - Board layout constants and utilities

// Board size
const BOARD_SIZE = 15;

// Multiplier definitions
const MULTIPLIER_TW = 'tw'; // Triple word
const MULTIPLIER_DW = 'dw'; // Double word
const MULTIPLIER_TL = 'tl'; // Triple letter
const MULTIPLIER_DL = 'dl'; // Double letter
const MULTIPLIER_ST = 'st'; // Start (center)

// Complete board layout
const BOARD_LAYOUT = [
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
 * @param {number} r Row index (0-14)
 * @param {number} c Column index (0-14)
 * @returns {string} Multiplier string or empty string
 */
function getMultiplier(r, c) {
    if (!isValidPosition(r, c)) {
        return '';
    }
    return BOARD_LAYOUT[r]?.[c] ?? '';
}

/**
 * Check if position is within board bounds
 * @param {number} r Row index
 * @param {number} c Column index
 * @returns {boolean} True if position is valid
 */
function isValidPosition(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

/**
 * Get the start (center) position
 * @returns {Array<number, number>} [r, c] coordinates
 */
function getStartPosition() {
    const center = Math.floor(BOARD_SIZE / 2);
    return [center, center];
}

/**
 * Get all special squares (multipliers) on the board
 * @returns {Array<{r: number, c: number, multiplier: string}>} Array of special squares
 */
function getSpecialSquares() {
    const specials = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const multiplier = BOARD_LAYOUT[r][c];
            if (multiplier !== '') {
                specials.push({
                    r: r,
                    c: c,
                    multiplier: multiplier
                });
            }
        }
    }
    return specials;
}

/**
 * Check if position has a word multiplier
 * @param {string} multiplier
 * @returns {boolean}
 */
function isWordMultiplier(multiplier) {
    return multiplier === MULTIPLIER_TW || multiplier === MULTIPLIER_DW;
}

/**
 * Check if position has a letter multiplier
 * @param {string} multiplier
 * @returns {boolean}
 */
function isLetterMultiplier(multiplier) {
    return multiplier === MULTIPLIER_TL || multiplier === MULTIPLIER_DL;
}

/**
 * Get multiplier name for display (French)
 * @param {string} multiplier
 * @returns {string} Human-readable name
 */
function getMultiplierName(multiplier) {
    const names = {
        [MULTIPLIER_TW]: 'MT', // Mot triple
        [MULTIPLIER_DW]: 'MD', // Mot double
        [MULTIPLIER_TL]: 'LT', // Lettre triple
        [MULTIPLIER_DL]: 'LD', // Lettre double
        [MULTIPLIER_ST]: '☆',   // Start
    };
    return names[multiplier] || '';
}

// Export for ES6 modules (if supported)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BOARD_SIZE,
        BOARD_LAYOUT,
        getMultiplier,
        isValidPosition,
        getStartPosition,
        getSpecialSquares,
        isWordMultiplier,
        isLetterMultiplier,
        getMultiplierName
    };
}

// Or for script tags (global)
if (typeof window !== 'undefined') {
    window.BoardLayout = {
        BOARD_SIZE,
        BOARD_LAYOUT,
        getMultiplier,
        isValidPosition,
        getStartPosition,
        getSpecialSquares,
        isWordMultiplier,
        isLetterMultiplier,
        getMultiplierName
    };
}
