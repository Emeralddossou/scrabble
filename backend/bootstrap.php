<?php
// backend/bootstrap.php

$isSecure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
if (getenv('APP_ENV') === 'prod' && !$isSecure) {
    header('Content-Type: application/json');
    http_response_code(403);
    echo json_encode(['error' => 'HTTPS requis en production']);
    exit;
}

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => $isSecure
]);
ini_set('session.gc_maxlifetime', '604800'); // 7 days

ini_set('display_errors', 0);
ini_set('log_errors', 1);
$logDir = __DIR__ . '/logs';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}
ini_set('error_log', $logDir . '/app.log');

session_start();

function json_error($message, $httpCode = 400, $context = null) {
    if ($context) {
        error_log($message . ' | ' . json_encode($context));
    }
    header('Content-Type: application/json');
    http_response_code($httpCode);
    echo json_encode(['error' => $message]);
    exit;
}

function csrf_token() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function require_csrf() {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (empty($token) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
            json_error('CSRF invalide', 403);
        }
    }
}

function maybe_cleanup($pdo) {
    if (rand(1, 100) !== 1) return; // 1% chance per request
    $pdo->exec("DELETE FROM invitations WHERE created_at < datetime('now', '-7 days')");
    $pdo->exec("DELETE FROM games WHERE status = 'finished' AND ended_at IS NOT NULL AND ended_at < datetime('now', '-30 days')");
    $pdo->exec("DELETE FROM password_resets WHERE expires_at < datetime('now')");
}
?>
