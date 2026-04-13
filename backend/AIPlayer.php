<?php
// backend/AIPlayer.php - Basic AI Player for Scrabble

require_once __DIR__ . '/GameLogic.php';

class AIPlayer {
    private $logic;
    private $difficulty; // easy, medium, hard
    
    public function __construct($pdo, $difficulty = 'medium') {
        $this->logic = new GameLogic($pdo);
        $this->difficulty = $difficulty;
    }
    
    public function makeMove($board, $rack) {
        if (empty($rack)) {
            return ['action' => 'pass'];
        }
        
        // Get word suggestions
        $suggestions = $this->logic->getWordSuggestions($rack, $board, 20);
        
        if (empty($suggestions)) {
            // Try to exchange tiles
            return $this->exchangeTiles($rack);
        }
        
        // Select move based on difficulty
        $selected = $this->selectMove($suggestions, $board, $rack);
        
        if ($selected) {
            return [
                'action' => 'play',
                'word' => $selected['word'],
                'score' => $selected['score']
            ];
        }
        
        return ['action' => 'pass'];
    }
    
    private function selectMove($suggestions, $board, $rack) {
        switch ($this->difficulty) {
            case 'easy':
                // Random selection from top 5
                $top = array_slice($suggestions, 0, 5);
                return $top[array_rand($top)];
                
            case 'medium':
                // Select from top 3
                $top = array_slice($suggestions, 0, 3);
                return $top[array_rand($top)];
                
            case 'hard':
                // Always select best word
                return $suggestions[0];
                
            default:
                return $suggestions[0];
        }
    }
    
    private function exchangeTiles($rack) {
        if (count($rack) < 2) {
            return ['action' => 'pass'];
        }
        
        // Exchange random tiles (up to 3)
        $toExchange = [];
        $rackCopy = $rack;
        $exchangeCount = min(3, count($rackCopy));
        
        for ($i = 0; $i < $exchangeCount; $i++) {
            $index = array_rand($rackCopy);
            $toExchange[] = $rackCopy[$index];
            unset($rackCopy[$index]);
        }
        
        return [
            'action' => 'exchange',
            'tiles' => $toExchange
        ];
    }
    
    public function setDifficulty($difficulty) {
        if (in_array($difficulty, ['easy', 'medium', 'hard'])) {
            $this->difficulty = $difficulty;
        }
    }
}
