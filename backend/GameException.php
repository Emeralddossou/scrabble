<?php
// backend/GameException.php - Custom exception for game logic errors

class GameException extends Exception
{
    // Error codes for different types of failures

    // Validation errors (400-499)
    const INVALID_MOVE = 400;
    const INVALID_POSITION = 401;
    const INVALID_LETTER = 402;
    const INVALID_WORD = 403;
    const INVALID_RACK = 404;
    const OUT_OF_BOUNDS = 405;
    const CONTINUITY_ERROR = 406;
    const NOT_CONNECTED = 407;
    const BOARD_EMPTY = 408;

    // Game state errors (410-419)
    const NOT_YOUR_TURN = 410;
    const GAME_NOT_FOUND = 411;
    const GAME_FINISHED = 412;
    const GAME_NOT_STARTED = 413;

    // Authorization errors (420-429)
    const NOT_A_PLAYER = 420;
    const ACCESS_DENIED = 421;

    // Server errors (500-599)
    const DICTIONARY_ERROR = 500;
    const DATABASE_ERROR = 501;
    const CACHE_ERROR = 502;

    // Additional error message for user
    private $userMessage;
    private $details;

    public function __construct(string $message, int $code = 400, string $userMessage = '', array $details = [])
    {
        parent::__construct($message, $code);
        $this->userMessage = $userMessage ?: $message;
        $this->details = $details;
    }

    /**
     * Get user-friendly message
     */
    public function getUserMessage(): string
    {
        return $this->userMessage;
    }

    /**
     * Get additional details
     */
    public function getDetails(): array
    {
        return $this->details;
    }

    /**
     * Convert to array for JSON response
     */
    public function toArray(): array
    {
        return [
            'error' => $this->getUserMessage(),
            'code' => $this->getCode(),
            'details' => $this->getDetails()
        ];
    }

    /**
     * Create exception from validation error
     */
    public static function validation(string $field, string $message, array $details = []): self
    {
        return new self(
            "Validation failed: {$field} - {$message}",
            self::INVALID_MOVE,
            $message,
            $details
        );
    }

    /**
     * Create exception for out of bounds
     */
    public static function outOfBounds(int $r, int $c, int $size = 15): self
    {
        return new self(
            "Position ({$r},{$c}) is out of bounds (0-{$size})",
            self::OUT_OF_BOUNDS,
            "Position invalide",
            ['r' => $r, 'c' => $c, 'size' => $size]
        );
    }

    /**
     * Create exception for invalid word
     */
    public static function invalidWord(string $word): self
    {
        return new self(
            "Invalid word: {$word}",
            self::INVALID_WORD,
            "Mot invalide: " . strtoupper($word),
            ['word' => $word]
        );
    }
}