/**
 * GameManager.js - Central game state management
 *
 * This class encapsulates all game state and provides a clean API
 * for game operations. It's designed to work alongside the existing
 * global functions for gradual migration.
 */

// Import BoardLayout if using ES6 modules
if (typeof BoardLayout === 'undefined' && typeof require !== 'undefined') {
    // For Node.js/CommonJS environments
    const fs = require('fs');
    eval(fs.readFileSync('js/BoardLayout.js', 'utf8'));
}

class GameManager {
    constructor(gameId) {
        this.gameId = gameId;
        this.gameState = null;
        this.myRack = [];
        this.temporaryPlacements = [];
        this.exchangeMode = false;
        this.exchangeSelections = new Set();
        this.isMyTurn = false;
        this.lastBoard = null;
        this.performanceMetrics = {
            apiCalls: 0,
            apiErrors: 0,
            avgLatency: 0,
            lastUpdate: Date.now()
        };

        // DOM cache for better performance
        this.domCache = new Map();

        // Event emitter for decoupled communication
        this.eventEmitter = {
            listeners: new Map(),
            on(event, callback) {
                if (!this.listeners.has(event)) {
                    this.listeners.set(event, []);
                }
                this.listeners.get(event).push(callback);
            },
            emit(event, data) {
                if (this.listeners.has(event)) {
                    this.listeners.get(event).forEach(cb => cb(data));
                }
            }
        };
    }

    /**
     * Initialize the game
     */
    async initialize() {
        console.log('[GameManager] Initializing game', this.gameId);

        // Initialize after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.onDOMReady());
        } else {
            this.onDOMReady();
        }
    }

    onDOMReady() {
        console.log('[GameManager] DOM Ready');

        // Setup initial UI
        this.cacheDOMElements();
        this.initLayout();

        // Notify listeners
        this.eventEmitter.emit('ready', { gameId: this.gameId });
    }

    /**
     * Cache DOM elements for performance
     */
    cacheDOMElements() {
        this.elements = {
            rack: this.getElement('rack'),
            board: this.getElement('board'),
            player1Name: this.getElement('player1-name'),
            player1Score: this.getElement('player1-score'),
            player2Name: this.getElement('player2-name'),
            player2Score: this.getElement('player2-score'),
            gameStatus: this.getElement('game-status'),
            turnBadge: this.getElement('turn-badge'),
            historyLog: this.getElement('history-log'),
            btnSubmit: this.getElement('btn-submit'),
            btnRecall: this.getElement('btn-recall'),
            btnShuffle: this.getElement('btn-shuffle'),
            btnExchange: this.getElement('btn-exchange'),
            btnPass: this.getElement('btn-pass'),
            btnResign: this.getElement('btn-resign')
        };
    }

    /**
     * Get element with caching
     */
    getElement(id) {
        if (this.domCache.has(id)) {
            return this.domCache.get(id);
        }
        const element = document.getElementById(id);
        if (element) {
            this.domCache.set(id, element);
        }
        return element;
    }

    /**
     * Initialize board layout - uses BoardLayout utility
     */
    initLayout() {
        console.log('[GameManager] Using BoardLayout utility', {
            boardSize: BoardLayout.BOARD_SIZE,
            center: BoardLayout.getStartPosition()
        });
    }

    /**
     * Get current game state
     */
    getGameState() {
        return this.gameState;
    }

    /**
     * Set current game state
     */
    setGameState(state) {
        this.gameState = state;
        this.eventEmitter.emit('stateChanged', state);
    }

    /**
     * Get current rack
     */
    getRack() {
        return this.myRack;
    }

    /**
     * Set rack
     */
    setRack(rack) {
        this.myRack = rack;
        this.eventEmitter.emit('rackChanged', rack);
    }

    /**
     * Get temporary placements
     */
    getPlacements() {
        return this.temporaryPlacements;
    }

    /**
     * Add a placement
     */
    addPlacement(r, c, letter) {
        this.temporaryPlacements.push({ r, c, letter });
        this.eventEmitter.emit('placementAdded', { r, c, letter });
    }

    /**
     * Clear all placements
     */
    clearPlacements() {
        this.temporaryPlacements = [];
        this.eventEmitter.emit('placementsCleared');
    }

    /**
     * Check if it's player's turn
     */
    isPlayerTurn() {
        return this.isMyTurn;
    }

    /**
     * Set turn state
     */
    setTurn(isMyTurn) {
        this.isMyTurn = isMyTurn;
        this.eventEmitter.emit('turnChanged', isMyTurn);
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return { ...this.performanceMetrics };
    }

    /**
     * Record API call metrics
     */
    recordApiCall(latency, success = true) {
        this.performanceMetrics.apiCalls++;
        if (!success) {
            this.performanceMetrics.apiErrors++;
        }
        // Running average
        this.performanceMetrics.avgLatency =
            (this.performanceMetrics.avgLatency + latency) / 2;
        this.performanceMetrics.lastUpdate = Date.now();
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.domCache.clear();
        console.log('[GameManager] Destroyed');
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameManager;
}

// Global export for script tags
if (typeof window !== 'undefined') {
    window.GameManager = GameManager;
}
