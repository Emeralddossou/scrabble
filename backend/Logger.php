<?php
// backend/Logger.php - Structured Logging

class Logger {
    private $logDir;
    private static $instance = null;
    
    public function __construct($logDir = null) {
        $this->logDir = $logDir ?? __DIR__ . '/../backend/logs';
        if (!is_dir($this->logDir)) {
            mkdir($this->logDir, 0755, true);
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function log($level, $message, $context = []) {
        $timestamp = date('Y-m-d H:i:s');
        $requestId = $_SESSION['request_id'] ?? uniqid();
        
        $logEntry = [
            'timestamp' => $timestamp,
            'level' => strtoupper($level),
            'request_id' => $requestId,
            'message' => $message,
            'context' => $context,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'CLI',
            'user_id' => $_SESSION['user_id'] ?? null
        ];
        
        // Write JSON log
        $logFile = $this->logDir . '/' . date('Y-m-d') . '.log';
        $jsonLog = json_encode($logEntry) . "\n";
        file_put_contents($logFile, $jsonLog, FILE_APPEND);
        
        // Also log errors to PHP error log
        if (in_array($level, ['error', 'critical'])) {
            error_log("[{$timestamp}] {$message} " . json_encode($context));
        }
    }
    
    public function info($message, $context = []) {
        $this->log('info', $message, $context);
    }
    
    public function warning($message, $context = []) {
        $this->log('warning', $message, $context);
    }
    
    public function error($message, $context = []) {
        $this->log('error', $message, $context);
    }
    
    public function debug($message, $context = []) {
        if (getEnv('APP_DEBUG') === 'true') {
            $this->log('debug', $message, $context);
        }
    }
    
    public function logApiRequest($endpoint, $method, $statusCode, $duration = 0) {
        $this->log('api', "API Request: $method $endpoint", [
            'method' => $method,
            'endpoint' => $endpoint,
            'status' => $statusCode,
            'duration_ms' => $duration
        ]);
    }
}
?>
