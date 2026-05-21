<?php
// backend/api/auth.php - Authentication endpoints

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/db.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';
$driver = 'sqlite';

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
        json_error('Trop de tentatives. Reessayez plus tard.', 429);
    }
}

function authValidateUsername($username) {
    if (strlen($username) < 3 || strlen($username) > 20) {
        return false;
    }
    return preg_match('/^[A-Za-z0-9_.-]+$/', $username) === 1;
}

function authCheckAccountLockout($pdo, $userId, $ipAddress, $isMySQL) {
    if ($isMySQL) {
        $stmt = $pdo->prepare(
            "SELECT locked_until
             FROM login_attempts
             WHERE user_id = ? AND ip_address = ? AND locked_until > NOW()
             ORDER BY id DESC
             LIMIT 1"
        );
    } else {
        $stmt = $pdo->prepare(
            "SELECT locked_until
             FROM login_attempts
             WHERE user_id = ? AND ip_address = ? AND locked_until > datetime('now')
             ORDER BY id DESC
             LIMIT 1"
        );
    }
    $stmt->execute([$userId, $ipAddress]);
    $lock = $stmt->fetch();

    if ($lock && !empty($lock['locked_until'])) {
        $remaining = max(1, (int)ceil((strtotime($lock['locked_until']) - time()) / 60));
        json_error("Compte temporairement verrouille. Reessayez dans $remaining minute(s).", 429);
    }
}

function authRecordLoginAttempt($pdo, $userId, $ipAddress, $success, $isMySQL) {
    if ($success) {
        $stmt = $pdo->prepare("DELETE FROM login_attempts WHERE user_id = ? AND ip_address = ?");
        $stmt->execute([$userId, $ipAddress]);
        return;
    }

    $stmt = $pdo->prepare(
        "SELECT id, attempt_count
         FROM login_attempts
         WHERE user_id = ? AND ip_address = ?
         ORDER BY id DESC
         LIMIT 1"
    );
    $stmt->execute([$userId, $ipAddress]);
    $existing = $stmt->fetch();

    if ($existing) {
        $newCount = (int)$existing['attempt_count'] + 1;
        if ($newCount >= 5) {
            $lockUntil = $isMySQL ? "DATE_ADD(NOW(), INTERVAL 30 MINUTE)" : "datetime('now', '+30 minutes')";
            $stmt = $pdo->prepare(
                "UPDATE login_attempts
                 SET attempt_count = ?, locked_until = $lockUntil, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?"
            );
            $stmt->execute([$newCount, $existing['id']]);
            return;
        }

        $stmt = $pdo->prepare(
            "UPDATE login_attempts
             SET attempt_count = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?"
        );
        $stmt->execute([$newCount, $existing['id']]);
        return;
    }

    $stmt = $pdo->prepare(
        "INSERT INTO login_attempts (user_id, ip_address, attempt_count)
         VALUES (?, ?, 1)"
    );
    $stmt->execute([$userId, $ipAddress]);
}

function authRequireSession() {
    if (!isset($_SESSION['user_id'])) {
        json_error('Non connecte', 401);
    }
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

    if ($username === '' || $password === '') {
        json_error("Nom d'utilisateur et mot de passe requis");
    }
    if (!authValidateUsername($username)) {
        json_error("Nom d'utilisateur invalide (3-20 caracteres, lettres/chiffres/._-)");
    }
    if (!validatePasswordStrength($password)) {
        json_error('Mot de passe trop faible. Minimum 10 caracteres avec au moins une majuscule, une minuscule, un chiffre et un caractere special.');
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        json_error("Nom d'utilisateur deja pris");
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
    $stmt->execute([$username, $hash]);

    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'login') {
    require_csrf();
    authRateLimit();

    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    if ($username === '' || $password === '') {
        json_error("Nom d'utilisateur et mot de passe requis");
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user) {
        json_error('Identifiants invalides', 401);
    }

    authCheckAccountLockout($pdo, $user['id'], $ipAddress, $isMySQL);

    if (empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
        authRecordLoginAttempt($pdo, $user['id'], $ipAddress, false, $isMySQL);
        json_error('Identifiants invalides', 401);
    }

    authRecordLoginAttempt($pdo, $user['id'], $ipAddress, true, $isMySQL);

    $stmt = $pdo->prepare("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([$user['id']]);

    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];

    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username']
        ],
        'csrf' => csrf_token()
    ]);
    exit;
}

if ($action === 'logout') {
    require_csrf();

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();

    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'me') {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false]);
        exit;
    }

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
    exit;
}

if ($action === 'users') {
    authRequireSession();

    $recentExpr = $isMySQL ? "DATE_SUB(NOW(), INTERVAL 10 MINUTE)" : "datetime('now', '-10 minutes')";
    $stmt = $pdo->prepare(
        "SELECT id, username, last_seen
         FROM users
         WHERE id != ? AND last_seen >= $recentExpr
         ORDER BY last_seen DESC"
    );
    $stmt->execute([$_SESSION['user_id']]);

    echo json_encode(['users' => $stmt->fetchAll()]);
    exit;
}

if ($action === 'change_password') {
    require_csrf();
    authRequireSession();

    $data = json_decode(file_get_contents('php://input'), true);
    $current = $data['current_password'] ?? '';
    $next = $data['new_password'] ?? '';

    if (!validatePasswordStrength($next)) {
        json_error('Nouveau mot de passe trop faible. Minimum 10 caracteres avec au moins une majuscule, une minuscule, un chiffre et un caractere special.');
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
    exit;
}

if ($action === 'update_profile') {
    require_csrf();
    authRequireSession();

    $data = json_decode(file_get_contents('php://input'), true);
    $bio = trim($data['bio'] ?? '');
    $avatar = trim($data['avatar'] ?? '');

    if (strlen($bio) > 500) {
        json_error('Bio trop longue (max 500 caracteres)');
    }
    if ($avatar !== '' && !filter_var($avatar, FILTER_VALIDATE_URL)) {
        json_error("URL d'avatar invalide");
    }
    if (strlen($avatar) > 255) {
        json_error('URL d\'avatar trop longue');
    }

    $stmt = $pdo->prepare("UPDATE users SET bio = ?, avatar = ? WHERE id = ?");
    $stmt->execute([$bio, $avatar, $_SESSION['user_id']]);

    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'stats') {
    authRequireSession();

    $uid = $_SESSION['user_id'];
    $stmt = $pdo->prepare(
        "SELECT
            COUNT(*) as total,
            SUM(CASE WHEN g.winner_id = ? THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN g.winner_id IS NOT NULL AND g.winner_id != ? THEN 1 ELSE 0 END) as losses,
            SUM(CASE WHEN g.status = 'finished' AND g.winner_id IS NULL THEN 1 ELSE 0 END) as draws
         FROM games g
         JOIN game_players gp ON g.id = gp.game_id
         WHERE gp.user_id = ? AND g.status = 'finished'"
    );
    $stmt->execute([$uid, $uid, $uid]);

    echo json_encode(['success' => true, 'stats' => $stmt->fetch()]);
    exit;
}

if ($action === 'request_reset') {
    require_csrf();
    authRateLimit();

    if (is_production()) {
        json_error('Reinitialisation indisponible sur cette instance', 503);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    if ($username === '') {
        json_error("Nom d'utilisateur requis");
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

    echo json_encode(['success' => true, 'reset_token' => $token]);
    exit;
}

if ($action === 'reset_password') {
    require_csrf();

    $data = json_decode(file_get_contents('php://input'), true);
    $token = trim($data['token'] ?? '');
    $newPass = $data['new_password'] ?? '';

    if (!validatePasswordStrength($newPass)) {
        json_error('Mot de passe trop faible. Minimum 10 caracteres avec au moins une majuscule, une minuscule, un chiffre et un caractere special.');
    }
    if ($token === '') {
        json_error('Token requis');
    }

    $nowExpr = $isMySQL ? "NOW()" : "datetime('now')";
    $stmt = $pdo->prepare(
        "SELECT pr.user_id
         FROM password_resets pr
         WHERE pr.token = ? AND pr.expires_at > $nowExpr"
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Token invalide ou expire', 400);
    }

    $hash = password_hash($newPass, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $stmt->execute([$hash, $row['user_id']]);
    $stmt = $pdo->prepare("DELETE FROM password_resets WHERE user_id = ?");
    $stmt->execute([$row['user_id']]);

    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'leaderboard') {
    $stmt = $pdo->query(
        "SELECT u.username, COUNT(*) as wins
         FROM games g
         JOIN users u ON g.winner_id = u.id
         WHERE g.status = 'finished' AND g.winner_id IS NOT NULL
         GROUP BY u.id, u.username
         ORDER BY wins DESC, u.username ASC
         LIMIT 10"
    );

    echo json_encode(['success' => true, 'leaders' => $stmt->fetchAll()]);
    exit;
}

if ($action === 'profile') {
    authRequireSession();

    $target_id = intval($_GET['user_id'] ?? 0);
    if ($target_id <= 0) {
        json_error('Utilisateur invalide');
    }

    $stmt = $pdo->prepare("SELECT id, username, bio, avatar FROM users WHERE id = ?");
    $stmt->execute([$target_id]);
    $user = $stmt->fetch();
    if (!$user) {
        json_error('Utilisateur introuvable', 404);
    }

    $stmt = $pdo->prepare(
        "SELECT
            COUNT(*) as total,
            SUM(CASE WHEN g.status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN g.winner_id = ? THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN g.winner_id IS NOT NULL AND g.winner_id != ? THEN 1 ELSE 0 END) as losses,
            SUM(CASE WHEN g.status = 'finished' AND g.winner_id IS NULL THEN 1 ELSE 0 END) as draws,
            ROUND(AVG(CASE WHEN g.status = 'finished' THEN gp.score ELSE NULL END), 2) as avg_score
         FROM games g
         JOIN game_players gp ON g.id = gp.game_id
         WHERE gp.user_id = ?"
    );
    $stmt->execute([$target_id, $target_id, $target_id]);

    echo json_encode([
        'success' => true,
        'user' => $user,
        'stats' => $stmt->fetch()
    ]);
    exit;
}

json_error('Action invalide', 400);
