<?php
// backend/GameRepository.php - Game data access layer

require_once __DIR__ . '/GameException.php';

class GameRepository {
    private $pdo;

    /**
     * Constructor
     * @param PDO $pdo
     */
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Find game by id
     *
     * @param int $gameId
     * @return array|null Game data or null if not found
     * @throws GameException
     */
    public function find(int $gameId): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM games WHERE id = ?");
        $stmt->execute([$gameId]);
        $game = $stmt->fetch();

        if (!$game) {
            return null;
        }

        return $game;
    }

    /**
     * Find game with players
     *
     * @param int $gameId
     * @return array Game with players data
     * @throws GameException
     */
    public function findWithPlayers(int $gameId): array {
        $stmt = $this->pdo->prepare(<<<SQL
            SELECT g.*,
                   gp.user_id, gp.score, gp.rack, gp.time_remaining, gp.is_current_turn
            FROM games g
            JOIN game_players gp ON g.id = gp.game_id
            WHERE g.id = ?
            ORDER BY gp.created_at
        SQL);

        $stmt->execute([$gameId]);
        $results = $stmt->fetchAll();

        if (empty($results)) {
            throw new GameException('Game not found', GameException::GAME_NOT_FOUND, 'Partie introuvable');
        }

        $game = $results[0];
        $game['players'] = [];

        foreach ($results as $row) {
            $game['players'][] = [
                'user_id' => $row['user_id'],
                'score' => $row['score'],
                'rack' => json_decode($row['rack'], true),
                'time_remaining' => $row['time_remaining'],
                'is_current_turn' => $row['is_current_turn']
            ];
        }

        return $game;
    }

    /**
     * Create new game
     *
     * @param array $data Game data
     * @return int Game ID
     * @throws GameException
     */
    public function create(array $data): int {
        $stmt = $this->pdo->prepare(<<<SQL
            INSERT INTO games (status, mode, created_by, board, bag, current_player_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        SQL);

        $stmt->execute([
            $data['status'] ?? 'waiting',
            $data['mode'] ?? 'standard',
            $data['created_by'] ?? null,
            json_encode($data['board'] ?? array_fill(0, 15, array_fill(0, 15, null))),
            json_encode($data['bag'] ?? []),
            $data['current_player_id'] ?? null
        ]);

        return (int)$this->pdo->lastInsertId();
    }

    /**
     * Update game state
     *
     * @param int $gameId
     * @param array $data Fields to update
     * @return bool Success
     * @throws GameException
     */
    public function update(int $gameId, array $data): bool {
        $fields = [];
        $params = [];

        foreach ($data as $key => $value) {
            $fields[] = "{$key} = ?";
            $params[] = $value;
        }

        if (empty($fields)) {
            return false;
        }

        $params[] = $gameId;
        $stmt = $this->pdo->prepare(
            "UPDATE games SET " . implode(', ', $fields) . ", updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        );

        return $stmt->execute($params);
    }

    /**
     * Get game state for API
     *
     * @param int $gameId
     * @return array Complete game state
     * @throws GameException
     */
    public function getGameState(int $gameId): array {
        $game = $this->findWithPlayers($gameId);

        // Get moves history
        $stmt = $this->pdo->prepare(<<<SQL
            SELECT * FROM moves
            WHERE game_id = ?
            ORDER BY created_at DESC
        SQL);
        $stmt->execute([$gameId]);
        $game['moves'] = $stmt->fetchAll();

        // Get remaining tiles count
        $stmt = $this->pdo->prepare("SELECT COUNT(*) as count FROM game_tiles WHERE game_id = ?");
        $stmt->execute([$gameId]);
        $game['remaining_tiles'] = $stmt->fetchColumn();

        return $game;
    }
}
