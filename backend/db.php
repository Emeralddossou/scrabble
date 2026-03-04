<?php
// backend/db.php - Phase 3: Support MySQL and SQLite

require_once __DIR__ . '/env.php';

// Get database configuration from .env
$db_type = strtolower(getEnv('DB_TYPE', 'sqlite'));
$pdo = null;

try {
    if ($db_type === 'mysql') {
        // MySQL Connection
        $db_host = getEnv('DB_HOST', 'localhost');
        $db_port = getEnv('DB_PORT', '3306');
        $db_user = getEnv('DB_USER', '');
        $db_pass = getEnv('DB_PASS', '');
        $db_name = getEnv('DB_NAME', 'scrabble');
        
        if (!$db_user) {
            throw new Exception('MySQL credentials not configured in .env');
        }
        
        $dsn = "mysql:host=$db_host;port=$db_port;charset=utf8mb4";
        $pdo = new PDO($dsn, $db_user, $db_pass);
        
        // Create database if not exists
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$db_name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `$db_name`");
    } else {
        // SQLite Connection (default)
        $db_file = getEnv('DB_FILE', dirname(__DIR__) . '/data/scrabble.db');
        $db_dir = dirname($db_file);
        if (!is_dir($db_dir)) {
            mkdir($db_dir, 0755, true);
        }
        $pdo = new PDO("sqlite:$db_file");
        $pdo->exec("PRAGMA foreign_keys = ON;");
    }
    
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // =================
    // CREATE TABLES
    // =================
    
    $commands = [
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTO_INCREMENT,
            status VARCHAR(50) DEFAULT 'waiting' COMMENT 'waiting, active, finished',
            mode VARCHAR(50) DEFAULT 'free' COMMENT 'free, timer',
            is_solo INTEGER DEFAULT 0,
            time_limit INTEGER DEFAULT 0 COMMENT 'in minutes',
            increment INTEGER DEFAULT 0 COMMENT 'in seconds',
            current_player_id INTEGER,
            winner_id INTEGER,
            board LONGTEXT COMMENT 'JSON string of the board',
            bag LONGTEXT COMMENT 'JSON string of tiles in bag',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_move_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP NULL,
            consecutive_passes INTEGER DEFAULT 0,
            FOREIGN KEY (current_player_id) REFERENCES users(id),
            FOREIGN KEY (winner_id) REFERENCES users(id)
        )",
        "CREATE TABLE IF NOT EXISTS game_players (
            game_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            score INTEGER DEFAULT 0,
            rack LONGTEXT COMMENT 'JSON string of tiles in hand',
            time_remaining INTEGER COMMENT 'in seconds',
            turn_order INTEGER COMMENT '1 or 2',
            PRIMARY KEY (game_id, user_id),
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )",
        "CREATE TABLE IF NOT EXISTS moves (
            id INTEGER PRIMARY KEY AUTO_INCREMENT,
            game_id INTEGER NOT NULL,
            user_id INTEGER,
            word VARCHAR(255),
            points INTEGER,
            coordinates LONGTEXT COMMENT 'JSON coordinates',
            move_type VARCHAR(50) DEFAULT 'play',
            details LONGTEXT COMMENT 'JSON details',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )",
        "CREATE TABLE IF NOT EXISTS invitations (
            id INTEGER PRIMARY KEY AUTO_INCREMENT,
            from_user_id INTEGER NOT NULL,
            to_user_id INTEGER NOT NULL,
            status VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, accepted, declined',
            mode VARCHAR(50) DEFAULT 'free',
            time_limit INTEGER DEFAULT 15,
            increment INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id)
        )",
        "CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTO_INCREMENT,
            user_id INTEGER NOT NULL,
            token VARCHAR(255) UNIQUE,
            expires_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )"
    ];

    // Execute table creation
    foreach ($commands as $command) {
        // Adjust for SQLite if needed
        if ($db_type === 'sqlite') {
            $command = str_replace('AUTO_INCREMENT', 'AUTOINCREMENT', $command);
            $command = str_replace('LONGTEXT', 'TEXT', $command);
            $command = str_replace("COMMENT 'JSON", "-- JSON", $command);
            $command = preg_replace("/\s+COMMENT '[^']*'/", '', $command);
            $command = preg_replace("/\s+ON UPDATE CURRENT_TIMESTAMP/", '', $command);
            $command = preg_replace("/\s+CHARACTER SET .*/", '', $command);
            $command = preg_replace("/\s+COLLATE .*/", '', $command);
        }
        
        try {
            $pdo->exec($command);
        } catch (PDOException $e) {
            // Table might already exist, that's OK
            if (strpos($e->getMessage(), 'already exists') === false) {
                error_log('Table creation warning: ' . $e->getMessage());
            }
        }
    }

    // =================
    // MIGRATIONS
    // =================
    
    // Safely add columns if they don't exist (for SQLite)
    if ($db_type === 'sqlite') {
        $cols = $pdo->query("PRAGMA table_info(users)")->fetchAll();
        $colNames = array_map(function($c) { return $c['name']; }, $cols);
        
        if (!in_array('password_hash', $colNames, true)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
        }

        $cols = $pdo->query("PRAGMA table_info(games)")->fetchAll();
        $colNames = array_map(function($c) { return $c['name']; }, $cols);
        
        if (!in_array('updated_at', $colNames, true)) {
            $pdo->exec("ALTER TABLE games ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
        }
        if (!in_array('last_move_at', $colNames, true)) {
            $pdo->exec("ALTER TABLE games ADD COLUMN last_move_at DATETIME DEFAULT CURRENT_TIMESTAMP");
        }
        if (!in_array('consecutive_passes', $colNames, true)) {
            $pdo->exec("ALTER TABLE games ADD COLUMN consecutive_passes INTEGER DEFAULT 0");
        }
        if (!in_array('ended_at', $colNames, true)) {
            $pdo->exec("ALTER TABLE games ADD COLUMN ended_at DATETIME");
        }
        if (!in_array('is_solo', $colNames, true)) {
            $pdo->exec("ALTER TABLE games ADD COLUMN is_solo INTEGER DEFAULT 0");
        }

        $cols = $pdo->query("PRAGMA table_info(moves)")->fetchAll();
        $colNames = array_map(function($c) { return $c['name']; }, $cols);
        
        if (!in_array('move_type', $colNames, true)) {
            $pdo->exec("ALTER TABLE moves ADD COLUMN move_type TEXT DEFAULT 'play'");
        }
        if (!in_array('details', $colNames, true)) {
            $pdo->exec("ALTER TABLE moves ADD COLUMN details TEXT");
        }
    } else if ($db_type === 'mysql') {
        // For MySQL, use ALTER TABLE ... ADD COLUMN IF NOT EXISTS
        $checkColumns = function($table, $columns) use ($pdo) {
            $stmt = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '$table' AND TABLE_SCHEMA = DATABASE()");
            $existing = array_map(function($row) { return $row['COLUMN_NAME']; }, $stmt->fetchAll());
            return $existing;
        };
        
        $gamesCols = $checkColumns('games', []);
        if (!in_array('is_solo', $gamesCols)) {
            $pdo->exec("ALTER TABLE games ADD COLUMN is_solo INTEGER DEFAULT 0");
        }
        
        $movesCols = $checkColumns('moves', []);
        if (!in_array('move_type', $movesCols)) {
            $pdo->exec("ALTER TABLE moves ADD COLUMN move_type VARCHAR(50) DEFAULT 'play'");
        }
        if (!in_array('details', $movesCols)) {
            $pdo->exec("ALTER TABLE moves ADD COLUMN details LONGTEXT");
        }
    }

} catch (PDOException $e) {
    echo "Connection failed: " . $e->getMessage();
    exit;
}
?>

