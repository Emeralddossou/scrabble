<?php
// backend/cron/cleanup.php

require_once __DIR__ . '/../db.php';

$pdo->exec("DELETE FROM invitations WHERE created_at < datetime('now', '-7 days')");
$pdo->exec("DELETE FROM games WHERE status = 'finished' AND ended_at IS NOT NULL AND ended_at < datetime('now', '-30 days')");
$pdo->exec("DELETE FROM password_resets WHERE expires_at < datetime('now')");
?>
