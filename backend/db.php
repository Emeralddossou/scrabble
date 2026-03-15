<?php
// backend/db.php - Phase 3: Support MySQL and SQLite

require_once __DIR__ . '/env.php';

// Get database configuration from .env
$db_type = strtolower(getEnv('DB_TYPE', 'mysql'));
$pdo = null;
$allowFallback = true;
if (function_exists('is_production')) {
    $allowFallback = !is_production();
} else {
    $env = strtolower((string)getEnv('APP_ENV', 'development'));
    $allowFallback = !in_array($env, ['production', 'prod', 'live'], true);
}
$fallbackFlag = strtolower((string)getEnv('DB_ALLOW_FALLBACK', 'true'));
if (in_array($fallbackFlag, ['0', 'false', 'no'], true)) {
    $allowFallback = false;
}

try {
    if ($db_type === 'mysql') {
        try {
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
        } catch (Exception $e) {
            if ($allowFallback) {
                error_log("MySQL connection failed, falling back to SQLite: " . $e->getMessage());
                $db_type = 'sqlite';
            } else {
                throw $e;
            }
        }
    }

    if ($db_type !== 'mysql') {
        // SQLite Connection (fallback or explicit)
        $dbFile = getEnv('DB_FILE', dirname(__DIR__) . '/data/scrabble.db');
        if (!preg_match('/^([A-Za-z]:)?[\/\\\\]/', $dbFile)) {
            $dbFile = dirname(__DIR__) . '/' . ltrim($dbFile, '/\\');
        }
        $dbFile = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $dbFile);
        
        error_log("Using SQLite path: " . $dbFile);
        
        $dbDir = dirname($dbFile);
        if (!is_dir($dbDir)) {
            error_log("Creating dir: " . $dbDir);
            @mkdir($dbDir, 0777, true);
        }
        
        error_log("Connecting to: sqlite:" . $dbFile);
        $pdo = new PDO("sqlite:" . $dbFile);
        error_log("SQLite connection OK");
        $pdo->exec("PRAGMA foreign_keys = ON;");
    }
    
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // =================
    // CREATE TABLES
    // =================
    
    $mysqlCommands = [
        "CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS games (
            id INT AUTO_INCREMENT PRIMARY KEY,
            status VARCHAR(50) DEFAULT 'waiting' COMMENT 'waiting, active, finished',
            mode VARCHAR(50) DEFAULT 'free' COMMENT 'free, timer',
            is_solo TINYINT DEFAULT 0,
            time_limit INT DEFAULT 0 COMMENT 'in minutes',
            increment INT DEFAULT 0 COMMENT 'in seconds',
            current_player_id INT,
            winner_id INT,
            board LONGTEXT COMMENT 'JSON string of the board',
            bag LONGTEXT COMMENT 'JSON string of tiles in bag',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_move_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP NULL,
            consecutive_passes INT DEFAULT 0,
            FOREIGN KEY (current_player_id) REFERENCES users(id),
            FOREIGN KEY (winner_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS game_players (
            game_id INT NOT NULL,
            user_id INT NOT NULL,
            score INT DEFAULT 0,
            rack LONGTEXT COMMENT 'JSON string of tiles in hand',
            time_remaining INT COMMENT 'in seconds',
            turn_order INT COMMENT '1 or 2',
            PRIMARY KEY (game_id, user_id),
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS moves (
            id INT AUTO_INCREMENT PRIMARY KEY,
            game_id INT NOT NULL,
            user_id INT,
            word VARCHAR(255),
            points INT,
            coordinates LONGTEXT COMMENT 'JSON coordinates',
            move_type VARCHAR(50) DEFAULT 'play',
            details LONGTEXT COMMENT 'JSON details',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS invitations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            from_user_id INT NOT NULL,
            to_user_id INT NOT NULL,
            status VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, accepted, declined',
            mode VARCHAR(50) DEFAULT 'free',
            time_limit INT DEFAULT 15,
            increment INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(255) UNIQUE,
            expires_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    ];

    $sqliteCommands = [
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status TEXT DEFAULT 'waiting',
            mode TEXT DEFAULT 'free',
            is_solo INTEGER DEFAULT 0,
            time_limit INTEGER DEFAULT 0,
            increment INTEGER DEFAULT 0,
            current_player_id INTEGER,
            winner_id INTEGER,
            board TEXT,
            bag TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_move_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ended_at DATETIME NULL,
            consecutive_passes INTEGER DEFAULT 0,
            FOREIGN KEY (current_player_id) REFERENCES users(id),
            FOREIGN KEY (winner_id) REFERENCES users(id)
        )",
        "CREATE TABLE IF NOT EXISTS game_players (
            game_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            score INTEGER DEFAULT 0,
            rack TEXT,
            time_remaining INTEGER,
            turn_order INTEGER,
            PRIMARY KEY (game_id, user_id),
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )",
        "CREATE TABLE IF NOT EXISTS moves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL,
            user_id INTEGER,
            word TEXT,
            points INTEGER,
            coordinates TEXT,
            move_type TEXT DEFAULT 'play',
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )",
        "CREATE TABLE IF NOT EXISTS invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_user_id INTEGER NOT NULL,
            to_user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            mode TEXT DEFAULT 'free',
            time_limit INTEGER DEFAULT 15,
            increment INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id)
        )",
        "CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE,
            expires_at DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )"
    ];

    $commands = ($db_type === 'mysql') ? $mysqlCommands : $sqliteCommands;

    // Execute table creation
    foreach ($commands as $command) {
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
        // For MySQL, use ALTER TABLE ... ADD COLUMN if missing
        $checkColumns = function($table) use ($pdo) {
            $stmt = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '$table' AND TABLE_SCHEMA = DATABASE()");
            return array_map(function($row) { return $row['COLUMN_NAME']; }, $stmt->fetchAll());
        };
        
        $usersCols = $checkColumns('users');
        if (!in_array('password_hash', $usersCols)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)");
        }
        if (!in_array('last_seen', $usersCols)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        }
        
        $gamesCols = $checkColumns('games');
        if (!in_array('updated_at', $gamesCols)) {
            $pdo->exec("ALTER TABLE games ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        }
        if (!in_array('last_move_at', $gamesCols)) {
            $pdo->exec("ALTER TABLE games ADD COLUMN last_move_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        }
        if (!in_array('consecutive_passes', $gamesCols)) {
            $pdo->exec("ALTER TABLE games ADD COLUMN consecutive_passes INT DEFAULT 0");
        }
        if (!in_array('ended_at', $gamesCols)) {
            $pdo->exec("ALTER TABLE games ADD COLUMN ended_at TIMESTAMP NULL");
        }
        if (!in_array('is_solo', $gamesCols)) {
            $pdo->exec("ALTER TABLE games ADD COLUMN is_solo TINYINT DEFAULT 0");
        }
        
        $movesCols = $checkColumns('moves');
        if (!in_array('move_type', $movesCols)) {
            $pdo->exec("ALTER TABLE moves ADD COLUMN move_type VARCHAR(50) DEFAULT 'play'");
        }
        if (!in_array('details', $movesCols)) {
            $pdo->exec("ALTER TABLE moves ADD COLUMN details LONGTEXT");
        }
    }

} catch (PDOException $e) {
    error_log("Database connection error: " . $e->getMessage());
    $debug = [
        'db_error' => $e->getMessage(),
        'code' => $e->getCode()
    ];
    if (function_exists('json_error')) {
        json_error('Erreur serveur', 500, $debug, $debug);
    } else {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode(['error' => 'Erreur serveur']);
        exit;
    }
}
?>
