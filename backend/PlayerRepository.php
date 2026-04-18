<?php
// backend/PlayerRepository.php - Player data access layer

require_once __DIR__ . '/GameException.php';

class PlayerRepository {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Find player by user ID
     *
     * @param int $userId
     * @return array|null Player data
     * @throws GameException
     */
    public function find(int $userId): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Get player stats
     *
     * @param int $userId
     * @return array Stats
     * @throws GameException
     */
    public function getStats(int $userId): array {
        $stmt = $this->pdo->prepare(<<<SQL
            SELECT
                COUNT(CASE WHEN status = 'finished' AND winner_id = ? THEN 1 END) as wins,
                COUNT(CASE WHEN status = 'finished' AND winner_id != ? THEN 1 END) as losses,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_games
            FROM games
            WHERE EXISTS (SELECT 1 FROM game_players WHERE game_id = games.id AND user_id = ?)
        SQL);

        $stmt->execute([$userId, $userId, $userId]);
        return $stmt->fetch();
    }

    /**
     * Update player rack
     *
     * @param int $gameId
     * @param int $userId
     * @param array $rack
     * @return bool Success
     * @throws GameException
     */
    public function updateRack(int $gameId, int $userId, array $rack): bool {
        $stmt = $this->pdo->prepare(<<<SQL
            UPDATE game_players
            SET rack = ?
            WHERE game_id = ? AND user_id = ?
        SQL);

        return $stmt->execute([
            json_encode($rack),
            $gameId,
            $userId
        ]);
    }

    /**
     * Update player score
     *
     * @param int $gameId
     * @param int $userId
     * @param int $score
     * @return bool Success
     * @throws GameException
     */
    public function updateScore(int $gameId, int $userId, int $score): bool {
        $stmt = $this->pdo->prepare(<<<SQL
            UPDATE game_players
            SET score = score + ?
            WHERE game_id = ? AND user_id = ?
        SQL);

        return $stmt->execute([$score, $gameId, $userId]);
    }
}
