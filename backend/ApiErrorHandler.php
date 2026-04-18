<?php
// backend/ApiErrorHandler.php - Centralized API error handling

require_once __DIR__ . '/GameException.php';

class ApiErrorHandler {
    /**
     * Handle API request with automatic error catching and response formatting
     *
     * @param callable $callback The API logic to execute
     * @param bool $requireAuth Whether authentication is required
     * @return void
     */
    public static function handle(callable $callback, bool $requireAuth = true): void {
        header('Content-Type: application/json; charset=utf-8');

        try {
            if ($requireAuth) {
                self::requireAuth();
            }

            $result = $callback();

            // If result is already a string, echo it directly
            if (is_string($result)) {
                echo $result;
            } else {
                // Add metadata for debugging
                if (defined('APP_DEBUG') && APP_DEBUG) {
                    $result['debug'] = [
                        'requestId' => uniqid('req_'),
                        'timestamp' => microtime(true),
                        'request' => [
                            'method' => $_SERVER['REQUEST_METHOD'],
                            'uri' => $_SERVER['REQUEST_URI']
                        ]
                    ];
                }
                echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
            }
        } catch (GameException $e) {
            http_response_code($e->getCode() ?: 400);
            $response = [
                'error' => $e->getUserMessage(),
                'code' => $e->getCode()
            ];

            if ($e->getDetails()) {
                $response['details'] = $e->getDetails();
            }

            if (defined('APP_DEBUG') && APP_DEBUG) {
                $response['debug'] = [
                    'exception' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ];
            }

            echo json_encode($response, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            error_log("API Error: " . $e->getMessage());
            error_log($e->getTraceAsString());

            http_response_code(500);
            $response = [
                'error' => 'Internal server error',
                'code' => 500
            ];

            if (defined('APP_DEBUG') && APP_DEBUG) {
                $response['debug'] = [
                    'exception' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ];
            } else {
                $response['requestId'] = uniqid('req_');
            }

            echo json_encode($response, JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * Validate user is authenticated
     * @throws GameException
     */
    public static function requireAuth(): void {
        if (!isset($_SESSION['user_id'])) {
            throw new GameException(
                'Unauthorized',
                401,
                'Vous devez être connecté'
            );
        }
    }

    /**
     * Validate CSRF token
     * @param string $token
     * @throws GameException
     */
    public static function validateCsrf(string $token): void {
        if (empty($token)) {
            throw new GameException(
                'CSRF token missing',
                403,
                'Session expirée - veuillez recharger la page'
            );
        }

        $expected = $_SESSION['csrf_token'] ?? '';
        if ($token !== $expected) {
            throw new GameException(
                'Invalid CSRF token',
                403,
                'Session invalide'
            );
        }
    }

    /**
     * Validate user is a game member
     * @param PDO $pdo
     * @param int $gameId
     * @param int $userId
     * @throws GameException
     */
    public static function requireGameMember($pdo, int $gameId, int $userId): void {
        $stmt = $pdo->prepare("SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?");
        $stmt->execute([$gameId, $userId]);

        if (!$stmt->fetchColumn()) {
            throw new GameException(
                'Not a game member',
                403,
                'Vous n\'êtes pas un joueur de cette partie'
            );
        }
    }

    /**
     * Send JSON response directly
     * @param mixed $data
     * @param int $statusCode
     * @return void
     */
    public static function jsonResponse($data, int $statusCode = 200): void {
        http_response_code($statusCode);
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
    }

    /**
     * Send error response
     * @param string $message
     * @param int $code
     * @return void
     */
    public static function errorResponse(string $message, int $code = 400): void {
        self::jsonResponse([
            'error' => $message,
            'code' => $code
        ], $code);
    }
}
