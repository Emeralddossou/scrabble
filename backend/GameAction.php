<?php
/**
 * GameAction.php - Game API action constants
 *
 * Defines all valid API actions to prevent typos and provide IDE autocompletion
 */

class GameAction {
    // ========== Game State ========== //

    /** @var string Get current game state */
    const STATE = 'state';

    /** @var string Get game history */
    const HISTORY = 'history';

    /** @var string Get game statistics */
    const STATS = 'stats';

    // ========== Turn Actions ========== //

    /** @var string Play a word */
    const PLAY_TURN = 'play_turn';

    /** @var string Pass turn */
    const PASS = 'pass';

    /** @var string Exchange tiles */
    const EXCHANGE = 'exchange';

    /** @var string Resign game */
    const RESIGN = 'resign';

    // ========== Game Management ========== //

    /** @var string Create new game */
    const CREATE = 'create';

    /** @var string Join game */
    const JOIN = 'join';

    /** @var string Invite player */
    const INVITE = 'invite';

    /** @var string Get available games */
    const LIST = 'list';

    // ========== Player Actions ========== //

    /** @var string Get player profile */
    const PROFILE = 'profile';

    /** @var string Update player */
    const PROFILE_UPDATE = 'profile_update';

    // ========== Special Actions ========== //

    /** @var string Validate move without playing */
    const VALIDATE = 'validate';

    /** @var string Get word suggestions */
    const SUGGESTIONS = 'suggestions';

    /** @var string Game timer check */
    const TIMER = 'timer';

    // ========== Internal Actions ========== //

    /** @var string Poll game state */
    const POLL = 'poll';

    /** @var string Game ended */
    const END = 'end';

    // ========== Public Methods ========== //

    /**
     * Get all valid actions
     * @return array<string> Array of all action constants
     */
    public static function all(): array {
        return [
            self::STATE,
            self::HISTORY,
            self::STATS,
            self::PLAY_TURN,
            self::PASS,
            self::EXCHANGE,
            self::RESIGN,
            self::CREATE,
            self::JOIN,
            self::INVITE,
            self::LIST,
            self::PROFILE,
            self::PROFILE_UPDATE,
            self::VALIDATE,
            self::SUGGESTIONS,
            self::TIMER,
            self::POLL,
            self::END
        ];
    }

    /**
     * Check if action is valid
     * @param string $action Action to validate
     * @return bool True if action is valid
     */
    public static function isValid(string $action): bool {
        return in_array($action, self::all(), true);
    }

    /**
     * Validate and return action or throw exception
     * @param string $action
     * @return string Validated action
     * @throws GameException
     */
    public static function requireValid(string $action): string {
        if (!self::isValid($action)) {
            throw new GameException(
                "Action invalide : {$action}",
                400,
                'Action non reconnue'
            );
        }

        return $action;
    }

    /**
     * Get actions that require authentication
     * @return array<string>
     */
    public static function requiresAuth(): array {
        return [
            self::STATE,
            self::HISTORY,
            self::PLAY_TURN,
            self::PASS,
            self::EXCHANGE,
            self::RESIGN,
            self::CREATE,
            self::JOIN,
            self::INVITE,
            self::PROFILE,
            self::PROFILE_UPDATE,
            self::VALIDATE,
            self::SUGGESTIONS
        ];
    }

    /**
     * Get actions that require CSRF validation
     * @return array<string>
     */
    public static function requiresCsrf(): array {
        return [
            self::PLAY_TURN,
            self::PASS,
            self::EXCHANGE,
            self::RESIGN,
            self::CREATE,
            self::JOIN,
            self::INVITE,
            self::PROFILE_UPDATE
        ];
    }
}
