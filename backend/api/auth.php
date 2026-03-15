<?php
// backend/api/auth.php

require_once '../bootstrap.php';
require_once '../db.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? '';
try {
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
} catch (Exception $e) {
    $driver = 'sqlite';
}
$isMySQL = ($driver === 'mysql');

function authRateLimit() {
    $now = time();
    if (!isset($_SESSION['auth_rate'])) {
        $_SESSION['auth_rate'] = ['count' => 0, 'reset' => $now + 300];
    }
    if ($now > $_SESSION['auth_rate']['reset']) {
        $_SESSION['auth_rate'] = ['count' => 0, 'reset' => $now + 300];
    }
    $_SESSION['auth_rate']['count']++;
    if ($_SESSION['auth_rate']['count'] > 15) {
        json_error('Trop de tentatives. Réessayez plus tard.', 429);
    }
}

function validateUsername($username) {
    if (strlen($username) < 3 || strlen($username) > 20) return false;
    return preg_match('/^[A-Za-z0-9_.-]+$/', $username);
}

if ($action === 'csrf') {
    echo json_encode(['success' => true, 'csrf' => csrf_token()]);
    exit;
}

if ($action === 'register') {
    require_csrf();
    authRateLimit();
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        json_error('Nom d\'utilisateur et mot de passe requis');
    }
    if (!validateUsername($username)) {
        json_error('Nom d\'utilisateur invalide (3-20 caractères, lettres/chiffres/._-)');
    }
    if (strlen($password) < 8) {
        json_error('Mot de passe trop court (min 8)');
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        json_error('Nom d\'utilisateur déjà pris');
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
    $stmt->execute([$username, $hash]);

    echo json_encode(['success' => true]);

} elseif ($action === 'login') {
    require_csrf();
    authRateLimit();
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        json_error('Nom d\'utilisateur et mot de passe requis');
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
        json_error('Identifiants invalides', 401);
    }

    $stmt = $pdo->prepare("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([$user['id']]);

    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $csrf = csrf_token();

    echo json_encode(['success' => true, 'user' => ['id' => $user['id'], 'username' => $user['username']], 'csrf' => $csrf]);

} elseif ($action === 'logout') {
    require_csrf();
    session_destroy();
    echo json_encode(['success' => true]);

} elseif ($action === 'me') {
    if (isset($_SESSION['user_id'])) {
        $stmt = $pdo->prepare("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username']
            ],
            'csrf' => csrf_token()
        ]);
    } else {
        echo json_encode(['success' => false]);
    }
} elseif ($action === 'users') {
    $current_id = $_SESSION['user_id'] ?? 0;
    $recentExpr = $isMySQL ? "DATE_SUB(NOW(), INTERVAL 10 MINUTE)" : "datetime('now', '-10 minutes')";
    $stmt = $pdo->prepare("SELECT id, username, last_seen FROM users WHERE id != ? AND last_seen >= $recentExpr ORDER BY last_seen DESC");
    $stmt->execute([$current_id]);
    $users = $stmt->fetchAll();
    echo json_encode(['users' => $users]);
} elseif ($action === 'change_password') {
    require_csrf();
    if (!isset($_SESSION['user_id'])) {
        json_error('Non connecté', 401);
    }
    $data = json_decode(file_get_contents('php://input'), true);
    $current = $data['current_password'] ?? '';
    $next = $data['new_password'] ?? '';

    if (strlen($next) < 8) {
        json_error('Nouveau mot de passe trop court (min 8)');
    }

    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($current, $row['password_hash'])) {
        json_error('Mot de passe actuel incorrect', 401);
    }

    $hash = password_hash($next, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $stmt->execute([$hash, $_SESSION['user_id']]);

    echo json_encode(['success' => true]);
} elseif ($action === 'stats') {
    if (!isset($_SESSION['user_id'])) {
        json_error('Non connecté', 401);
    }
    $uid = $_SESSION['user_id'];
    $stmt = $pdo->prepare("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN g.winner_id = ? THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN g.winner_id IS NOT NULL AND g.winner_id != ? THEN 1 ELSE 0 END) as losses,
            SUM(CASE WHEN g.status = 'finished' AND g.winner_id IS NULL THEN 1 ELSE 0 END) as draws
        FROM games g
        JOIN game_players gp ON g.id = gp.game_id
        WHERE gp.user_id = ? AND g.status = 'finished'
    ");
    $stmt->execute([$uid, $uid, $uid]);
    $stats = $stmt->fetch();
    echo json_encode(['success' => true, 'stats' => $stats]);
} elseif ($action === 'request_reset') {
    require_csrf();
    authRateLimit();
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    if (empty($username)) {
        json_error('Nom d\'utilisateur requis');
    }
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    if (!$user) {
        echo json_encode(['success' => true]);
        exit;
    }
    $token = bin2hex(random_bytes(24));
    $stmt = $pdo->prepare("DELETE FROM password_resets WHERE user_id = ?");
    $stmt->execute([$user['id']]);
    $expiresExpr = $isMySQL ? "DATE_ADD(NOW(), INTERVAL 30 MINUTE)" : "datetime('now', '+30 minutes')";
    $stmt = $pdo->prepare("INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, $expiresExpr)");
    $stmt->execute([$user['id'], $token]);

    $isProd = function_exists('is_production')
        ? is_production()
        : (strtolower((string)getEnv('APP_ENV', 'development')) === 'production');
    if ($isProd) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => true, 'reset_token' => $token]);
    }
} elseif ($action === 'reset_password') {
    require_csrf();
    $data = json_decode(file_get_contents('php://input'), true);
    $token = trim($data['token'] ?? '');
    $newPass = $data['new_password'] ?? '';
    if (strlen($newPass) < 8) {
        json_error('Mot de passe trop court (min 8)');
    }
    $nowExpr = $isMySQL ? "NOW()" : "datetime('now')";
    $stmt = $pdo->prepare("SELECT pr.user_id FROM password_resets pr WHERE pr.token = ? AND pr.expires_at > $nowExpr");
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Token invalide ou expiré', 400);
    }
    $hash = password_hash($newPass, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $stmt->execute([$hash, $row['user_id']]);
    $stmt = $pdo->prepare("DELETE FROM password_resets WHERE user_id = ?");
    $stmt->execute([$row['user_id']]);
    echo json_encode(['success' => true]);
} elseif ($action === 'leaderboard') {
    $stmt = $pdo->query("
        SELECT u.username, COUNT(*) as wins
        FROM games g
        JOIN users u ON g.winner_id = u.id
        WHERE g.status = 'finished' AND g.winner_id IS NOT NULL
        GROUP BY u.id
        ORDER BY wins DESC, u.username ASC
        LIMIT 10
    ");
    $leaders = $stmt->fetchAll();
    echo json_encode(['success' => true, 'leaders' => $leaders]);
} elseif ($action === 'profile') {
    if (!isset($_SESSION['user_id'])) {
        json_error('Non connecté', 401);
    }
    $target_id = intval($_GET['user_id'] ?? 0);
    if ($target_id <= 0) {
        json_error('Utilisateur invalide');
    }

    $stmt = $pdo->prepare("SELECT id, username FROM users WHERE id = ?");
    $stmt->execute([$target_id]);
    $user = $stmt->fetch();
    if (!$user) {
        json_error('Utilisateur introuvable', 404);
    }

    $stmt = $pdo->prepare("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN g.status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN g.winner_id = ? THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN g.winner_id IS NOT NULL AND g.winner_id != ? THEN 1 ELSE 0 END) as losses,
            SUM(CASE WHEN g.status = 'finished' AND g.winner_id IS NULL THEN 1 ELSE 0 END) as draws,
            ROUND(AVG(CASE WHEN g.status = 'finished' THEN gp.score ELSE NULL END), 2) as avg_score
        FROM games g
        JOIN game_players gp ON g.id = gp.game_id
        WHERE gp.user_id = ?
    ");
    $stmt->execute([$target_id, $target_id, $target_id]);
    $stats = $stmt->fetch();

    echo json_encode(['success' => true, 'user' => $user, 'stats' => $stats]);
}
?>

