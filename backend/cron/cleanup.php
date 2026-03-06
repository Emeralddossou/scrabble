<?php
// backend/cron/cleanup.php

require_once __DIR__ . '/../db.php';

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
?>
