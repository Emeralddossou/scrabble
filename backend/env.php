<?php
// backend/env.php - Load .env file

// Version marker to verify deployment
if (!defined('ENV_PHP_VERSION')) {
    define('ENV_PHP_VERSION', 'env-2026-03-30-1836');
}
error_log("ENV.PHP LOADED " . ENV_PHP_VERSION . " from " . __FILE__);

if (!function_exists('loadEnv')) {
    function loadEnv($filePath = null) {
        error_log("ENV STEP: loadEnv start");
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
        $contents = @file_get_contents($filePath);
        if ($contents === false) {
            error_log("Env file not readable: " . $filePath);
            return [];
        }
        error_log("Env loaded from: " . $filePath);

        // Handle UTF-16 encoded files (common when saved via Windows Notepad)
        if (strpos($contents, "\0") !== false) {
            $encoding = null;
            if (substr($contents, 0, 2) === "\xFF\xFE") {
                $encoding = 'UTF-16LE';
            } elseif (substr($contents, 0, 2) === "\xFE\xFF") {
                $encoding = 'UTF-16BE';
            } else {
                $encoding = 'UTF-16LE';
            }
            if (function_exists('mb_convert_encoding')) {
                $contents = mb_convert_encoding($contents, 'UTF-8', $encoding);
            } elseif (function_exists('iconv')) {
                $contents = iconv($encoding, 'UTF-8//IGNORE', $contents);
            }
            error_log("Env file encoding converted from {$encoding} to UTF-8.");
        }

        $lines = preg_split("/\r\n|\n|\r/", $contents);
        if ($lines === false) {
            error_log("Env file parse failed: " . $filePath);
            return [];
        }
        
        foreach ($lines as $line) {
            // Skip comments
            if (strpos(trim($line), '#') === 0) continue;
            if (trim($line) === '') continue;
            
            // Parse key=value
            if (preg_match('/^\s*(?:export\s+)?([A-Za-z0-9_.-]+)\s*=\s*(.*)$/', $line, $m)) {
                $key = $m[1];
                $value = $m[2];
                // Strip UTF-8 BOM if present (common when editing on Windows)
                $key = preg_replace('/^\xEF\xBB\xBF/', '', $key);
                $value = trim($value, " \t\n\r\0\x0B");
                
                // Remove quotes if present
                if (preg_match('/^["\'](.+)["\']$/', $value, $m2)) {
                    $value = $m2[1];
                }
                
                $env[$key] = $value;
            }
        }
        if (count($env) === 0) {
            $rawKeys = [];
            foreach ($lines as $line) {
                if (preg_match('/^\s*([A-Za-z0-9_.-]+)\s*=/', $line, $m)) {
                    $rawKeys[] = $m[1];
                }
            }
            if (!empty($rawKeys)) {
                error_log("Env raw keys detected (no values parsed): " . implode(',', $rawKeys));
            }
        } else {
            $keyInfo = [];
            foreach ($env as $k => $v) {
                $keyInfo[] = $k . '=' . (strlen($v) > 0 ? '1' : '0');
            }
            error_log("Env keys loaded: " . count($env) . " [" . implode(',', $keyInfo) . "]");
        }
        error_log("ENV STEP: loadEnv end (keys=" . count($env) . ")");
        return $env;
    }
}

if (!function_exists('readEnvFile')) {
    function readEnvFile() {
        $base = dirname(__DIR__);
        $candidates = [
            $base . '/.env',
            $base . '/env.production',
            $base . '/env'
        ];
        $filePath = null;
        foreach ($candidates as $candidate) {
            $exists = file_exists($candidate);
            $readable = $exists ? is_readable($candidate) : false;
            error_log("Env candidate: {$candidate} exists=" . ($exists ? '1' : '0') . " readable=" . ($readable ? '1' : '0'));
            if ($exists && $readable) {
                $filePath = $candidate;
                break;
            }
        }
        if (!$filePath) {
            error_log("No env file found. Checked .env, env.production, env in app root.");
            return [];
        }
        $contents = @file_get_contents($filePath);
        if ($contents === false) {
            error_log("Env file not readable: " . $filePath);
            return [];
        }
        error_log("Env loaded from: " . $filePath);

        if (strpos($contents, "\0") !== false) {
            $encoding = null;
            if (substr($contents, 0, 2) === "\xFF\xFE") {
                $encoding = 'UTF-16LE';
            } elseif (substr($contents, 0, 2) === "\xFE\xFF") {
                $encoding = 'UTF-16BE';
            } else {
                $encoding = 'UTF-16LE';
            }
            if (function_exists('mb_convert_encoding')) {
                $contents = mb_convert_encoding($contents, 'UTF-8', $encoding);
            } elseif (function_exists('iconv')) {
                $contents = iconv($encoding, 'UTF-8//IGNORE', $contents);
            }
            error_log("Env file encoding converted from {$encoding} to UTF-8.");
        }

        $lines = preg_split("/\r\n|\n|\r/", $contents);
        if ($lines === false) {
            error_log("Env file parse failed: " . $filePath);
            return [];
        }

        $env = [];
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) continue;
            if (trim($line) === '') continue;
            if (preg_match('/^\s*(?:export\s+)?([A-Za-z0-9_.-]+)\s*=\s*(.*)$/', $line, $m)) {
                $key = $m[1];
                $value = $m[2];
                $key = preg_replace('/^\xEF\xBB\xBF/', '', $key);
                $value = trim($value, " \t\n\r\0\x0B");
                if (preg_match('/^["\'](.+)["\']$/', $value, $m2)) {
                    $value = $m2[1];
                }
                $env[$key] = $value;
            }
        }

        if (count($env) === 0) {
            $rawKeys = [];
            foreach ($lines as $line) {
                if (preg_match('/^\s*([A-Za-z0-9_.-]+)\s*=/', $line, $m)) {
                    $rawKeys[] = $m[1];
                }
            }
            if (!empty($rawKeys)) {
                error_log("Env raw keys detected (no values parsed): " . implode(',', $rawKeys));
            }
        } else {
            $keyInfo = [];
            foreach ($env as $k => $v) {
                $keyInfo[] = $k . '=' . (strlen($v) > 0 ? '1' : '0');
            }
            error_log("Env keys loaded: " . count($env) . " [" . implode(',', $keyInfo) . "]");
        }

        return $env;
    }
}

if (!function_exists('env_debug_info')) {
    function env_debug_info() {
        $base = dirname(__DIR__);
        $candidates = [
            $base . '/.env',
            $base . '/env.production',
            $base . '/env'
        ];
        $info = [];
        foreach ($candidates as $candidate) {
            $exists = file_exists($candidate);
            $readable = $exists ? is_readable($candidate) : false;
            $size = $exists ? @filesize($candidate) : 0;
            $sample = '';
            $hasBom = false;
            $hasNulls = false;
            if ($readable) {
                $sample = @file_get_contents($candidate, false, null, 0, 4);
                if ($sample !== false) {
                    if (substr($sample, 0, 3) === "\xEF\xBB\xBF" || substr($sample, 0, 2) === "\xFF\xFE" || substr($sample, 0, 2) === "\xFE\xFF") {
                        $hasBom = true;
                    }
                    if (strpos($sample, "\0") !== false) {
                        $hasNulls = true;
                    }
                }
            }
            $info[] = [
                'path' => $candidate,
                'exists' => $exists ? 1 : 0,
                'readable' => $readable ? 1 : 0,
                'size' => $size,
                'bom' => $hasBom ? 1 : 0,
                'nulls' => $hasNulls ? 1 : 0
            ];
        }
        return $info;
    }
}

if (!function_exists('getEnv')) {
    function getEnv($key, $default = null) {
        static $env = null;
        static $reloaded = false;
        if ($env === null) {
            $env = function_exists('loadEnv') ? loadEnv() : [];
            if (!is_array($env)) {
                $env = [];
            }
            if (empty($env) && function_exists('readEnvFile')) {
                error_log("loadEnv returned empty. Using fallback reader.");
                $env = readEnvFile();
            }
        }
        if (!$reloaded && is_array($env) && count($env) === 0) {
            $reloaded = true;
            $env = function_exists('loadEnv') ? loadEnv() : [];
            if (!is_array($env)) {
                $env = [];
            }
            if (empty($env) && function_exists('readEnvFile')) {
                error_log("loadEnv returned empty on reload. Using fallback reader.");
                $env = readEnvFile();
            }
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
