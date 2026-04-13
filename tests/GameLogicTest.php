<?php
// tests/GameLogicTest.php

require_once __DIR__ . '/../backend/bootstrap.php';
require_once __DIR__ . '/../backend/GameLogic.php';

use PHPUnit\Framework\TestCase;

class GameLogicTest extends TestCase {
    private $pdo;
    private $logic;
    
    protected function setUp(): void {
        global $pdo;
        $this->pdo = $pdo;
        $this->logic = new GameLogic($this->pdo);
    }
    
    public function testInitializeBag() {
        $bag = $this->logic->initializeBag();
        
        // French Scrabble has 100 tiles
        $this->assertCount(100, $bag);
        
        // Check letter counts
        $counts = array_count_values($bag);
        $this->assertEquals(9, $counts['A']);
        $this->assertEquals(2, $counts['B']);
        $this->assertEquals(15, $counts['E']);
        $this->assertEquals(2, $counts['*']); // Jokers
    }
    
    public function testInitializeBoard() {
        $board = $this->logic->initializeBoard();
        
        // Board should be 15x15
        $this->assertCount(15, $board);
        $this->assertCount(15, $board[0]);
        
        // All cells should be null initially
        foreach ($board as $row) {
            foreach ($row as $cell) {
                $this->assertNull($cell);
            }
        }
    }
    
    public function testDrawTiles() {
        $bag = ['A', 'B', 'C', 'D', 'E'];
        $drawn = $this->logic->drawTiles($bag, 3);
        
        $this->assertCount(3, $drawn);
        $this->assertCount(2, $bag); // 5 - 3 = 2 remaining
    }
    
    public function testDrawTilesFromEmptyBag() {
        $bag = [];
        $drawn = $this->logic->drawTiles($bag, 3);
        
        $this->assertCount(0, $drawn);
    }
    
    public function testRackScore() {
        $rack = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        $score = $this->logic->rackScore($rack);
        
        // A(1) + B(3) + C(3) + D(2) + E(1) + F(4) + G(2) = 16
        $this->assertEquals(16, $score);
    }
    
    public function testRackScoreWithJoker() {
        $rack = ['A', '*', 'C']; // Joker counts as 0
        $score = $this->logic->rackScore($rack);
        
        // A(1) + *(0) + C(3) = 4
        $this->assertEquals(4, $score);
    }
    
    public function testValidateMoveEmpty() {
        $board = $this->logic->initializeBoard();
        $moves = [];
        
        $result = $this->logic->validateMove($board, $moves);
        
        $this->assertFalse($result['valid']);
        $this->assertEquals('Aucune pièce posée', $result['error']);
    }
    
    public function testValidateMoveNotAligned() {
        $board = $this->logic->initializeBoard();
        $moves = [
            ['r' => 7, 'c' => 7, 'letter' => 'A'],
            ['r' => 8, 'c' => 8, 'letter' => 'B']
        ];
        
        $result = $this->logic->validateMove($board, $moves);
        
        $this->assertFalse($result['valid']);
        $this->assertEquals('Les pièces doivent être alignées', $result['error']);
    }
    
    public function testValidateMoveFirstMoveNotOnCenter() {
        $board = $this->logic->initializeBoard();
        $moves = [
            ['r' => 0, 'c' => 0, 'letter' => 'A'],
            ['r' => 0, 'c' => 1, 'letter' => 'B']
        ];
        
        $result = $this->logic->validateMove($board, $moves);
        
        $this->assertFalse($result['valid']);
        $this->assertEquals('Le premier mot doit passer par le centre (H8)', $result['error']);
    }
    
    public function testValidateMoveFirstMoveSingleTile() {
        $board = $this->logic->initializeBoard();
        $moves = [
            ['r' => 7, 'c' => 7, 'letter' => 'A']
        ];
        
        $result = $this->logic->validateMove($board, $moves);
        
        $this->assertFalse($result['valid']);
        $this->assertEquals('Le premier mot doit faire au moins 2 lettres', $result['error']);
    }
    
    public function testValidateMoveNotConnected() {
        $board = $this->logic->initializeBoard();
        $board[7][7] = 'A'; // Place a tile on center
        
        $moves = [
            ['r' => 0, 'c' => 0, 'letter' => 'B'],
            ['r' => 0, 'c' => 1, 'letter' => 'C']
        ];
        
        $result = $this->logic->validateMove($board, $moves);
        
        $this->assertFalse($result['valid']);
        $this->assertEquals('Le mot doit être rattaché à un mot existant', $result['error']);
    }
    
    public function testGetMultiplier() {
        // Center is start (word double)
        $this->assertEquals('st', $this->logic->getMultiplier(7, 7));
        
        // Top-left is triple word
        $this->assertEquals('tw', $this->logic->getMultiplier(0, 0));
        
        // Regular cell
        $this->assertEquals('', $this->logic->getMultiplier(1, 1));
    }
    
    public function testIsValidWordWithDictionary() {
        // This test depends on the dictionary file existing
        // If it doesn't exist, isValidWord returns true for all words
        
        $result = $this->logic->isValidWord('SCRABBLE');
        $this->assertTrue($result);
    }
}
