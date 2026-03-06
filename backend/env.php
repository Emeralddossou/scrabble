<?php
// backend/env.php - Load .env file

if (!function_exists('loadEnv')) {
    function loadEnv($filePath = null) {
        if (!$filePath) {
            $filePath = dirname(__DIR__) . '/.env';
        }
        
        if (!file_exists($filePath)) {
            return [];
        }
        
        $env = [];
        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        foreach ($lines as $line) {
            // Skip comments
            if (strpos(trim($line), '#') === 0) continue;
            
            // Parse key=value
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                
                // Remove quotes if present
                if (preg_match('/^["\'](.+)["\']$/', $value, $m)) {
                    $value = $m[1];
                }
                
                $env[$key] = $value;
            }
        }
        
        return $env;
    }
}

if (!function_exists('getEnv')) {
    function getEnv($key, $default = null) {
        static $env = null;
        if ($env === null) {
            $env = loadEnv();
        }
        
        // Check env array first
        if (isset($env[$key])) {
            return $env[$key];
        }
        
        // Check $_ENV
        if (isset($_ENV[$key])) {
            return $_ENV[$key];
        }
        
        // Check getenv (careful with null parameter)
        $val = getenv($key);
        if ($val !== false) {
            return $val;
        }
        
        return $default;
    }
}
?>
