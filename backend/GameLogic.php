<?php
// backend/GameLogic.php

class GameLogic {
    private $pdo;
    
    // French Scrabble Letter Distribution and Points
    private $letters = [
        'A' => ['count' => 9, 'points' => 1], 'B' => ['count' => 2, 'points' => 3], 'C' => ['count' => 2, 'points' => 3],
        'D' => ['count' => 3, 'points' => 2], 'E' => ['count' => 15, 'points' => 1], 'F' => ['count' => 2, 'points' => 4],
        'G' => ['count' => 2, 'points' => 2], 'H' => ['count' => 2, 'points' => 4], 'I' => ['count' => 8, 'points' => 1],
        'J' => ['count' => 1, 'points' => 8], 'K' => ['count' => 1, 'points' => 10], 'L' => ['count' => 5, 'points' => 1],
        'M' => ['count' => 3, 'points' => 2], 'N' => ['count' => 6, 'points' => 1], 'O' => ['count' => 6, 'points' => 1],
        'P' => ['count' => 2, 'points' => 3], 'Q' => ['count' => 1, 'points' => 8], 'R' => ['count' => 6, 'points' => 1],
        'S' => ['count' => 6, 'points' => 1], 'T' => ['count' => 6, 'points' => 1], 'U' => ['count' => 6, 'points' => 1],
        'V' => ['count' => 2, 'points' => 4], 'W' => ['count' => 1, 'points' => 10], 'X' => ['count' => 1, 'points' => 10],
        'Y' => ['count' => 1, 'points' => 10], 'Z' => ['count' => 1, 'points' => 10], '*' => ['count' => 2, 'points' => 0]
    ];

    private $multipliers = [
        'tw' => [], 'dw' => [], 'tl' => [], 'dl' => []
    ];

    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->initMultipliers();
    }

    private function initMultipliers() {
        // Using a static layout via getMultiplier.
    }

    public function getMultiplier($r, $c) {
        $layout = [
            ['tw','','','dl','','','','tw','','','','dl','','','tw'],
            ['','dw','','','','tl','','','','tl','','','','dw',''],
            ['','','dw','','','','dl','','dl','','','','dw','',''],
            ['dl','','','dw','','','','dl','','','','dw','','','dl'],
            ['','','','','dw','','','','','','dw','','','',''],
            ['','tl','','','','tl','','','','tl','','','','tl',''],
            ['','','dl','','','','dl','','dl','','','','dl','',''],
            ['tw','','','dl','','','','st','','','','dl','','','tw'],
            ['','','dl','','','','dl','','dl','','','','dl','',''],
            ['','tl','','','','tl','','','','tl','','','','tl',''],
            ['','','','','dw','','','','','','dw','','','',''],
            ['dl','','','dw','','','','dl','','','','dw','','','dl'],
            ['','','dw','','','','dl','','dl','','','','dl','',''],
            ['','dw','','','','tl','','','','tl','','','','dw',''],
            ['tw','','','dl','','','','tw','','','','dl','','','tw']
        ];
        return $layout[$r][$c] ?? '';
    }

    public function initializeBag() {
        $bag = [];
        foreach ($this->letters as $char => $info) {
            for ($i = 0; $i < $info['count']; $i++) $bag[] = $char;
        }
        shuffle($bag);
        return $bag;
    }

    public function initializeBoard() {
        return array_fill(0, 15, array_fill(0, 15, null));
    }

    public function drawTiles(&$bag, $count) {
        $drawn = [];
        for ($i = 0; $i < $count; $i++) {
            if (empty($bag)) break;
            $drawn[] = array_pop($bag);
        }
        return $drawn;
    }

    public function rackScore($rack) {
        $score = 0;
        if (!is_array($rack)) return 0;
        foreach ($rack as $letter) {
            if ($letter === '*' || ctype_lower($letter)) {
                continue;
            }
            $score += $this->letters[strtoupper($letter)]['points'] ?? 0;
        }
        return $score;
    }

    public function validateMove($board, $moves) {
        if (empty($moves)) return ['valid' => false, 'error' => 'Aucune pièce posée'];

        $rows = array_unique(array_column($moves, 'r'));
        $cols = array_unique(array_column($moves, 'c'));
        $isHorizontal = count($rows) === 1;
        $isVertical = count($cols) === 1;

        if (!$isHorizontal && !$isVertical) {
            return ['valid' => false, 'error' => 'Les pièces doivent être alignées'];
        }

        usort($moves, function($a, $b) use ($isHorizontal) {
            return $isHorizontal ? $a['c'] - $b['c'] : $a['r'] - $b['r'];
        });

        $start = $isHorizontal ? $moves[0]['c'] : $moves[0]['r'];
        $end = $isHorizontal ? end($moves)['c'] : end($moves)['r'];
        $fixed = $isHorizontal ? $moves[0]['r'] : $moves[0]['c'];

        for ($i = $start; $i <= $end; $i++) {
            $r = $isHorizontal ? $fixed : $i;
            $c = $isHorizontal ? $i : $fixed;
            
            $moveTile = null;
            foreach ($moves as $m) {
                if ($m['r'] == $r && $m['c'] == $c) {
                    $moveTile = $m;
                    break;
                }
            }

            if (!$moveTile && empty($board[$r][$c])) {
                return ['valid' => false, 'error' => 'Les pièces doivent être continues (pas de trous)'];
            }
        }

        $isFirstMove = $this->isBoardEmpty($board);
        $touchesExisting = false;
        
        if ($isFirstMove) {
            $touchesCenter = false;
            foreach ($moves as $m) {
                if ($m['r'] == 7 && $m['c'] == 7) $touchesCenter = true;
            }
            if (!$touchesCenter) return ['valid' => false, 'error' => 'Le premier mot doit passer par le centre (H8)'];
            if (count($moves) < 2) return ['valid' => false, 'error' => 'Le premier mot doit faire au moins 2 lettres'];
        } else {
            foreach ($moves as $m) {
                $neighbors = [
                    [$m['r']-1, $m['c']], [$m['r']+1, $m['c']],
                    [$m['r'], $m['c']-1], [$m['r'], $m['c']+1]
                ];
                foreach ($neighbors as $n) {
                    if ($n[0] >= 0 && $n[0] < 15 && $n[1] >= 0 && $n[1] < 15) {
                        if ($board[$n[0]][$n[1]] !== null) {
                            $touchesExisting = true;
                        }
                    }
                }
            }
        }

        if (!$isFirstMove && !$touchesExisting) {
            return ['valid' => false, 'error' => 'Le mot doit être rattaché à un mot existant'];
        }

        $formedWords = [];

        $tempBoard = $board;
        foreach ($moves as $m) {
            $tempBoard[$m['r']][$m['c']] = $m['letter'];
        }

        $mainWordObj = $this->getWordAt($tempBoard, $moves[0]['r'], $moves[0]['c'], $isHorizontal);
        $formedWords[] = $mainWordObj;
        
        foreach ($moves as $m) {
            $crossWordObj = $this->getWordAt($tempBoard, $m['r'], $m['c'], !$isHorizontal);
            if (strlen($crossWordObj['word']) > 1) {
                $formedWords[] = $crossWordObj;
            }
        }

        foreach ($formedWords as $fw) {
            if (!$this->isValidWord($fw['word'])) {
                return ['valid' => false, 'error' => "Mot invalide: " . strtoupper($fw['word'])];
            }
        }

        $totalScore = 0;
        foreach ($formedWords as $fw) {
             $wordScore = 0;
             $wordMult = 1;
             
             $r = $fw['start_r'];
             $c = $fw['start_c'];
             $dr = $fw['is_horizontal'] ? 0 : 1;
             $dc = $fw['is_horizontal'] ? 1 : 0;
             
             for ($i = 0; $i < strlen($fw['word']); $i++) {
                 $cr = $r + $i*$dr;
                 $cc = $c + $i*$dc;
                 $letter = $tempBoard[$cr][$cc];
                 $isBlank = ctype_lower($letter);
                 $pts = $isBlank ? 0 : ($this->letters[strtoupper($letter)]['points'] ?? 0);
                 
                 $isNew = false;
                 foreach ($moves as $m) {
                     if ($m['r'] == $cr && $m['c'] == $cc) $isNew = true;
                 }

                 if ($isNew) {
                     $mult = $this->getMultiplier($cr, $cc);
                     if ($mult == 'dl') $pts *= 2;
                     if ($mult == 'tl') $pts *= 3;
                     if ($mult == 'dw') $wordMult *= 2;
                     if ($mult == 'tw') $wordMult *= 3;
                     if ($mult == 'st' || $mult == 'start') $wordMult *= 2;
                 }
                 
                 $wordScore += $pts;
             }
             $totalScore += ($wordScore * $wordMult);
        }
        
        if (count($moves) == 7) {
            $totalScore += 50;
        }

        return ['valid' => true, 'score' => $totalScore, 'words' => $formedWords];
    }

    private function getWordAt($board, $r, $c, $isHorizontal) {
        $currR = $r;
        $currC = $c;
        if ($isHorizontal) {
            while ($currC > 0 && !empty($board[$currR][$currC-1])) $currC--;
        } else {
            while ($currR > 0 && !empty($board[$currR-1][$currC])) $currR--;
        }
        
        $startR = $currR;
        $startC = $currC;
        $word = "";
        
        if ($isHorizontal) {
            while ($currC < 15 && !empty($board[$currR][$currC])) {
                $word .= $board[$currR][$currC];
                $currC++;
            }
        } else {
            while ($currR < 15 && !empty($board[$currR][$currC])) {
                $word .= $board[$currR][$currC];
                $currR++;
            }
        }
        
        return ['word' => $word, 'start_r' => $startR, 'start_c' => $startC, 'is_horizontal' => $isHorizontal];
    }

    private function isBoardEmpty($board) {
        foreach ($board as $row) {
            foreach ($row as $cell) {
                if ($cell !== null) return false;
            }
        }
        return true;
    }

    public function isValidWord($word) {
        // Phase 7: Improved caching for dictionary with APCu
        static $dictionary = null;
        static $dictPath = null;
        static $useCache = true;
        
        if ($dictionary === null) {
            $dictPath = __DIR__ . '/../data/ods.txt';
            $cacheKey = 'scrabble_dict_' . md5($dictPath);
            
            // Try to load from APCu cache first
            if ($useCache && function_exists('apcu_fetch')) {
                $cachedDict = apcu_fetch($cacheKey);
                if ($cachedDict !== false) {
                    $dictionary = $cachedDict;
                    return $this->checkWordInDictionary($dictionary, $word);
                }
            }
            
            if (!file_exists($dictPath)) {
                // If dictionary doesn't exist, accept any word (for testing)
                return true;
            }
            
            // Load dictionary with case-insensitive lookup
            $lines = file($dictPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $dictionary = array_flip(array_map('strtoupper', $lines));
            
            // Store in APCu cache for 1 hour
            if ($useCache && function_exists('apcu_store')) {
                apcu_store($cacheKey, $dictionary, 3600);
            }
        }
        
        return $this->checkWordInDictionary($dictionary, $word);
    }
    
    private function checkWordInDictionary($dictionary, $word) {
        $upperWord = strtoupper($word);
        
        // Allow blanks (lowercase letters represent jokers)
        if (preg_match('/[a-z]/', $word)) {
            // Word contains jokers, still need to validate other letters
            $testWord = preg_replace('/[a-z]/', 'A', $upperWord);
            return isset($dictionary[$testWord]);
        }
        
        return isset($dictionary[$upperWord]);
    }
    
    public function getWordSuggestions($rack, $board = null, $limit = 10) {
        $suggestions = [];
        $dictPath = __DIR__ . '/../data/ods.txt';
        
        if (!file_exists($dictPath)) {
            return $suggestions;
        }
        
        // Load dictionary
        $lines = file($dictPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $dictionary = array_flip(array_map('strtoupper', $lines));
        
        // Count letter frequencies in rack
        $rackCount = array_count_values($rack);
        $blankCount = $rackCount['*'] ?? 0;
        unset($rackCount['*']);
        
        // Try each word in dictionary
        foreach (array_keys($dictionary) as $word) {
            if (strlen($word) < 2) continue; // Skip short words
            if (strlen($word) > count($rack) + $blankCount) continue; // Too long
            
            $wordCount = array_count_values(str_split($word));
            $canForm = true;
            $blanksNeeded = 0;
            
            foreach ($wordCount as $letter => $count) {
                $available = $rackCount[$letter] ?? 0;
                if ($available < $count) {
                    $blanksNeeded += ($count - $available);
                    if ($blanksNeeded > $blankCount) {
                        $canForm = false;
                        break;
                    }
                }
            }
            
            if ($canForm) {
                $score = $this->calculateWordScore($word);
                $suggestions[] = [
                    'word' => $word,
                    'score' => $score,
                    'length' => strlen($word)
                ];
            }
        }
        
        // Sort by score descending
        usort($suggestions, function($a, $b) {
            return $b['score'] - $a['score'];
        });
        
        return array_slice($suggestions, 0, $limit);
    }
    
    private function calculateWordScore($word) {
        $points = [
            'A' => 1, 'B' => 3, 'C' => 3, 'D' => 2, 'E' => 1, 'F' => 4,
            'G' => 2, 'H' => 4, 'I' => 1, 'J' => 8, 'K' => 10, 'L' => 1,
            'M' => 2, 'N' => 1, 'O' => 1, 'P' => 3, 'Q' => 8, 'R' => 1,
            'S' => 1, 'T' => 1, 'U' => 1, 'V' => 4, 'W' => 10, 'X' => 10,
            'Y' => 10, 'Z' => 10
        ];
        
        $score = 0;
        foreach (str_split($word) as $letter) {
            $score += $points[$letter] ?? 0;
        }
        
        return $score;
    }
}
?>
