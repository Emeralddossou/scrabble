<?php
// backend/MoveRepository.php - Move history data access

require_once __DIR__ . '/GameException.php';

class MoveRepository {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Log a move
     *
     * @param array $data Move data
     * @return int Move ID
     * @throws GameException
     */
    public function create(array $data): int {
        $required = ['game_id', 'user_id', 'move_type'];
        foreach ($required as $field) {
            if (!isset($data[$field])) {
                throw new GameException("Missing required field: {$field}");
            }
        }

        $stmt = $this->pdo->prepare(<<<SQL
            INSERT INTO moves (
                game_id, user_id, word, points, coordinates,
                move_type, details, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        SQL);

        $stmt->execute([
            $data['game_id'],
            $data['user_id'],
            $data['word'] ?? null,
            $data['points'] ?? 0,
            $data['coordinates'] ?? null,
            $data['move_type'],
            isset($data['details']) ? json_encode($data['details']) : null
        ]);

        return (int)$this->pdo->lastInsertId();
    }

    /**
     * Get all moves for a game
     *
     * @param int $gameId
     * @return array Moves
     * @throws GameException
     */
    public function findByGame(int $gameId): array {
        $stmt = $this->pdo->prepare(<<<SQL
            SELECT
                m.*,
                u.username,
                u.display_name
            FROM moves m
            JOIN users u ON m.user_id = u.id
            WHERE m.game_id = ?
            ORDER BY m.created_at DESC
        SQL);

        $stmt->execute([$gameId]);
        return $stmt->fetchAll();
    }

    /**
     * Get move statistics
     *
     * @param int $gameId
     * @return array Statistics
     * @throws GameException
     */
    public function getStats(int $gameId): array {
        $stmt = $this->pdo->prepare(<<<SQL
            SELECT
                COUNT(*) as total_moves,
                SUM(CASE WHEN move_type = 'play' THEN 1 ELSE 0 END) as plays,
                SUM(CASE WHEN move_type = 'pass' THEN 1 ELSE 0 END) as passes,
                SUM(CASE WHEN move_type = 'exchange' THEN 1 ELSE 0 END) as exchanges
            FROM moves
            WHERE game_id = ?
        SQL);

        $stmt->execute([$gameId]);
        return $stmt->fetch();
    }

    /**
     * Delete moves for a game (for testing/rollback)
     *
     * @param int $gameId
     * @return int Count deleted
     */
    public function deleteByGame(int $gameId): int {
        $stmt = $this->pdo->prepare("DELETE FROM moves WHERE game_id = ?");
        $stmt->execute([$gameId]);
        return $stmt->rowCount();
    }
}
