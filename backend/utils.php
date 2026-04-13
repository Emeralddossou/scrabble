<?php
// backend/utils.php - Utility functions

require_once __DIR__ . '/env.php';

// Password strength validation
function validatePasswordStrength($password) {
    if (strlen($password) < 10) {
        return false;
    }
    if (!preg_match('/[A-Z]/', $password)) {
        return false;
    }
    if (!preg_match('/[a-z]/', $password)) {
        return false;
    }
    if (!preg_match('/[0-9]/', $password)) {
        return false;
    }
    if (!preg_match('/[!@#$%^&*(),.?":{}|<>]/', $password)) {
        return false;
    }
    return true;
}

// Record login attempt
function recordLoginAttempt($pdo, $userId, $ipAddress, $success) {
    $stmt = $pdo->prepare("SELECT * FROM login_attempts WHERE user_id = ? OR ip_address = ? ORDER BY id DESC LIMIT 1");
    $stmt->execute([$userId, $ipAddress]);
    $attempt = $stmt->fetch();
    
    if ($success) {
        // Reset on successful login
        if ($attempt) {
            $stmt = $pdo->prepare("UPDATE login_attempts SET attempt_count = 0, locked_until = NULL WHERE id = ?");
            $stmt->execute([$attempt['id']]);
        }
    } else {
        $attemptCount = $attempt ? $attempt['attempt_count'] + 1 : 1;
        
        if ($attemptCount >= 5) {
            $lockedUntil = date('Y-m-d H:i:s', strtotime('+30 minutes'));
            $stmt = $pdo->prepare("INSERT INTO login_attempts (user_id, ip_address, attempt_count, locked_until) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE attempt_count = ?, locked_until = ?");
            $stmt->execute([$userId, $ipAddress, $attemptCount, $lockedUntil, $attemptCount, $lockedUntil]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO login_attempts (user_id, ip_address, attempt_count) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE attempt_count = ?");
            $stmt->execute([$userId, $ipAddress, $attemptCount, $attemptCount]);
        }
    }
}
