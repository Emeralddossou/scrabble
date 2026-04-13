<?php
// backend/Logger.php - Structured Logging with Monitoring

require_once __DIR__ . '/env.php';

class Logger {
    private $logDir;
    private static $instance = null;
    private static $metrics = [
        'total_requests' => 0,
        'errors' => 0,
        'api_calls' => 0,
        'avg_response_time' => 0,
        'start_time' => null
    ];
    
    public function __construct($logDir = null) {
        $this->logDir = $logDir ?? __DIR__ . '/../backend/logs';
        if (!is_dir($this->logDir)) {
            mkdir($this->logDir, 0755, true);
        }
        if (self::$metrics['start_time'] === null) {
            self::$metrics['start_time'] = time();
        }
        $this->rotateLogs();
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function rotateLogs() {
        // Delete logs older than 30 days
        $files = glob($this->logDir . '/*.log');
        foreach ($files as $file) {
            if (filemtime($file) < strtotime('-30 days')) {
                unlink($file);
            }
        }
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
        
        // Update metrics
        self::$metrics['total_requests']++;
        if (in_array($level, ['error', 'critical'])) {
            self::$metrics['errors']++;
        }
        
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
    
    public function critical($message, $context = []) {
        $this->log('critical', $message, $context);
    }
    
    public function debug($message, $context = []) {
        if (env_get('APP_DEBUG') === 'true') {
            $this->log('debug', $message, $context);
        }
    }
    
    public function logApiRequest($endpoint, $method, $statusCode, $duration = 0) {
        self::$metrics['api_calls']++;
        
        // Update average response time
        if (self::$metrics['api_calls'] > 0) {
            self::$metrics['avg_response_time'] = 
                (self::$metrics['avg_response_time'] * (self::$metrics['api_calls'] - 1) + $duration) / 
                self::$metrics['api_calls'];
        }
        
        $this->log('api', "API Request: $method $endpoint", [
            'method' => $method,
            'endpoint' => $endpoint,
            'status' => $statusCode,
            'duration_ms' => $duration
        ]);
    }
    
    public static function getMetrics() {
        $uptime = time() - self::$metrics['start_time'];
        return [
            'total_requests' => self::$metrics['total_requests'],
            'errors' => self::$metrics['errors'],
            'api_calls' => self::$metrics['api_calls'],
            'avg_response_time_ms' => round(self::$metrics['avg_response_time'], 2),
            'uptime_seconds' => $uptime,
            'error_rate' => self::$metrics['total_requests'] > 0 
                ? round((self::$metrics['errors'] / self::$metrics['total_requests']) * 100, 2) 
                : 0
        ];
    }
    
    public static function resetMetrics() {
        self::$metrics = [
            'total_requests' => 0,
            'errors' => 0,
            'api_calls' => 0,
            'avg_response_time' => 0,
            'start_time' => time()
        ];
    }
}
?>
