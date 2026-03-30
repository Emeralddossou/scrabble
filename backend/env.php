<?php
// backend/env.php - Load .env file

if (!function_exists('loadEnv')) {
    function loadEnv($filePath = null) {
        if (!$filePath) {
            $base = dirname(__DIR__);
            $candidates = [
                $base . '/.env',
                $base . '/env.production',
                $base . '/env'
            ];
            foreach ($candidates as $candidate) {
                $exists = file_exists($candidate);
                $readable = $exists ? is_readable($candidate) : false;
                error_log("Env candidate: {$candidate} exists=" . ($exists ? '1' : '0') . " readable=" . ($readable ? '1' : '0'));
                if ($exists && $readable) {
                    $filePath = $candidate;
                    break;
                }
            }
        }
        
        if (!$filePath || !file_exists($filePath)) {
            error_log("No env file found. Checked .env, env.production, env in app root.");
            return [];
        }
        
        $env = [];
        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            error_log("Env file not readable: " . $filePath);
            return [];
        }
        error_log("Env loaded from: " . $filePath);
        
        foreach ($lines as $line) {
            // Skip comments
            if (strpos(trim($line), '#') === 0) continue;
            
            // Parse key=value
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                // Strip UTF-8 BOM if present (common when editing on Windows)
                $key = preg_replace('/^\xEF\xBB\xBF/', '', $key);
                $value = trim($value);
                
                // Remove quotes if present
                if (preg_match('/^["\'](.+)["\']$/', $value, $m)) {
                    $value = $m[1];
                }
                
                $env[$key] = $value;
            }
        }
        error_log("Env keys loaded: " . count($env));
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
