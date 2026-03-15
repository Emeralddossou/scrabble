<?php
// backend/bootstrap.php

require_once __DIR__ . '/env.php';

// Setup error logging first
error_reporting(E_ALL);
@mkdir(__DIR__ . DIRECTORY_SEPARATOR . 'logs', 0777, true);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'app.log');

error_log("=== Bootstrap started ===");

function app_env() {
    return strtolower((string)getEnv('APP_ENV', 'development'));
}

function is_production() {
    $env = app_env();
    return in_array($env, ['production', 'prod', 'live'], true);
}

function is_debug() {
    $flag = strtolower((string)getEnv('APP_DEBUG', 'false'));
    return in_array($flag, ['1', 'true', 'yes', 'on'], true);
}

function request_id() {
    static $rid = null;
    if ($rid !== null) {
        return $rid;
    }
    $rid = $_SERVER['HTTP_X_REQUEST_ID'] ?? bin2hex(random_bytes(6));
    return $rid;
}

$isSecure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

if (is_production() && !$isSecure) {
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

session_start();
request_id();

function send_json($payload, $httpCode = 200) {
    if (!headers_sent()) {
        header('Content-Type: application/json');
        http_response_code($httpCode);
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
}

set_error_handler(function($errno, $errstr, $errfile, $errline) {
    $context = [
        'errno' => $errno,
        'message' => $errstr,
        'file' => $errfile,
        'line' => $errline,
        'request_id' => request_id()
    ];
    error_log("[$errno] $errstr in $errfile:$errline");
    $debug = is_debug() ? $context : null;
    json_error('Erreur serveur', 500, $context, $debug);
    return true;
});

set_exception_handler(function($e) {
    $context = [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'code' => $e->getCode(),
        'request_id' => request_id()
    ];
    $debug = null;
    if (is_debug()) {
        $debug = $context;
        $debug['trace'] = explode("\n", $e->getTraceAsString());
    }
    json_error('Erreur serveur', 500, $context, $debug);
});

register_shutdown_function(function() {
    $error = error_get_last();
    if (!$error) return;
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
    if (!in_array($error['type'], $fatalTypes, true)) return;

    $context = [
        'type' => $error['type'],
        'message' => $error['message'] ?? '',
        'file' => $error['file'] ?? '',
        'line' => $error['line'] ?? 0,
        'request_id' => request_id()
    ];
    error_log("[FATAL] {$context['message']} in {$context['file']}:{$context['line']}");

    $payload = [
        'error' => 'Erreur serveur',
        'request_id' => request_id()
    ];
    if (is_debug()) {
        $payload['debug'] = $context;
    }
    send_json($payload, 500);
});

function json_error($message, $httpCode = 400, $context = null, $debug = null) {
    if ($context) {
        error_log($message . ' | ' . json_encode($context));
    }
    if (is_debug() && $debug === null && $context !== null) {
        $debug = $context;
    }
    $payload = [
        'error' => $message,
        'request_id' => request_id()
    ];
    if (is_debug() && $debug) {
        $payload['debug'] = $debug;
    }
    send_json($payload, $httpCode);
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
    
    // Detect database type
    try {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $isMySQL = ($driver === 'mysql');
    } catch (Exception $e) {
        $isMySQL = false;
    }
    
    if ($isMySQL) {
        // MySQL syntax
        $pdo->exec("DELETE FROM invitations WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)");
        $pdo->exec("DELETE FROM games WHERE status = 'finished' AND ended_at IS NOT NULL AND ended_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
        $pdo->exec("DELETE FROM password_resets WHERE expires_at < NOW()");
    } else {
        // SQLite syntax
        $pdo->exec("DELETE FROM invitations WHERE created_at < datetime('now', '-7 days')");
        $pdo->exec("DELETE FROM games WHERE status = 'finished' AND ended_at IS NOT NULL AND ended_at < datetime('now', '-30 days')");
        $pdo->exec("DELETE FROM password_resets WHERE expires_at < datetime('now')");
    }
}
?>
