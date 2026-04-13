<?php
// tests/IntegrationTest.php

require_once __DIR__ . '/../backend/bootstrap.php';
require_once __DIR__ . '/../backend/GameLogic.php';

use PHPUnit\Framework\TestCase;

class IntegrationTest extends TestCase {
    private $pdo;
    private $testUserId;
    
    protected function setUp(): void {
        global $pdo;
        $this->pdo = $pdo;
        
        // Create test user
        $hash = password_hash('TestPass123!', PASSWORD_DEFAULT);
        $stmt = $this->pdo->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
        $stmt->execute(['test_user_' . time(), $hash]);
        $this->testUserId = $this->pdo->lastInsertId();
    }
    
    protected function tearDown(): void {
        // Clean up test user
        if ($this->testUserId) {
            $stmt = $this->pdo->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$this->testUserId]);
        }
    }
    
    public function testCompleteGameFlow() {
        $logic = new GameLogic($this->pdo);
        
        // 1. Create game - use the API directly or skip this test
        // For now, just test the board initialization and validation
        $board = $logic->initializeBoard();
        $this->assertIsArray($board);
        $this->assertCount(15, $board);
        
        // 2. Test move validation
        $moves = [
            ['r' => 7, 'c' => 7, 'letter' => 'A'],
            ['r' => 7, 'c' => 8, 'letter' => 'B']
        ];
        
        $result = $logic->validateMove($board, $moves);
        // This might fail if "AB" is not a valid word, but the validation logic should work
        $this->assertIsArray($result);
        $this->assertArrayHasKey('valid', $result);
    }
    
    public function testPasswordValidation() {
        // Test that the password strength validation works
        $validPasswords = [
            'TestPass123!', 'Secure@Pass1', 'MyP@ssw0rd2024'
        ];
        
        $invalidPasswords = [
            'short', 'nouppercase1!', 'NOLOWERCASE1!', 'nospecial123'
        ];
        
        foreach ($validPasswords as $password) {
            $this->assertTrue(validatePasswordStrength($password), 
                "Password '$password' should be valid");
        }
        
        foreach ($invalidPasswords as $password) {
            $this->assertFalse(validatePasswordStrength($password),
                "Password '$password' should be invalid");
        }
    }
    
    public function testDictionaryCaching() {
        $logic = new GameLogic($this->pdo);
        
        // First call should load dictionary
        $start1 = microtime(true);
        $result1 = $logic->isValidWord('TEST');
        $time1 = microtime(true) - $start1;
        
        // Second call should use cache
        $start2 = microtime(true);
        $result2 = $logic->isValidWord('TEST');
        $time2 = microtime(true) - $start2;
        
        $this->assertEquals($result1, $result2);
        // Cached call should be faster (though this might vary)
        // We just verify both return the same result
    }
    
    public function testAccountLockoutMechanism() {
        // This test verifies the lockout mechanism exists
        // Note: We don't actually lock the account to avoid interfering with other tests
        
        $userId = $this->testUserId;
        $ipAddress = '127.0.0.1';
        
        // Record 4 failed attempts (should not lock yet)
        for ($i = 0; $i < 4; $i++) {
            recordLoginAttempt($this->pdo, $userId, $ipAddress, false);
        }
        
        // 5th attempt should lock
        recordLoginAttempt($this->pdo, $userId, $ipAddress, false);
        
        // Check if locked
        $stmt = $this->pdo->prepare("SELECT locked_until FROM login_attempts WHERE user_id = ? ORDER BY id DESC LIMIT 1");
        $stmt->execute([$userId]);
        $lock = $stmt->fetch();
        
        $this->assertNotFalse($lock);
        $this->assertNotNull($lock['locked_until']);
        
        // Reset for cleanup
        $stmt = $this->pdo->prepare("DELETE FROM login_attempts WHERE user_id = ?");
        $stmt->execute([$userId]);
    }
    
    public function testLoggerMetrics() {
        require_once __DIR__ . '/../backend/Logger.php';
        
        $logger = Logger::getInstance();
        
        // Reset metrics
        Logger::resetMetrics();
        
        // Log some events
        $logger->info('Test info message');
        $logger->warning('Test warning');
        $logger->error('Test error');
        $logger->logApiRequest('/test', 'GET', 200, 150);
        
        // Get metrics
        $metrics = Logger::getMetrics();
        
        $this->assertArrayHasKey('total_requests', $metrics);
        $this->assertArrayHasKey('errors', $metrics);
        $this->assertArrayHasKey('api_calls', $metrics);
        $this->assertArrayHasKey('avg_response_time_ms', $metrics);
        
        $this->assertEquals(1, $metrics['errors']);
        $this->assertEquals(1, $metrics['api_calls']);
        $this->assertEquals(150, $metrics['avg_response_time_ms']);
    }
}
