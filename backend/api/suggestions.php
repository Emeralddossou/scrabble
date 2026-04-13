<?php
// backend/api/suggestions.php - Word Suggestions API

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../GameLogic.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';

if ($action === 'get_suggestions') {
    require_csrf();
    
    if (!isset($_SESSION['user_id'])) {
        json_error('Non connecté', 401);
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $rack = $data['rack'] ?? [];
    $board = $data['board'] ?? null;
    $limit = min($data['limit'] ?? 10, 50); // Max 50 suggestions
    
    if (empty($rack)) {
        json_error('Chevalet vide');
    }
    
    $logic = new GameLogic($pdo);
    $suggestions = $logic->getWordSuggestions($rack, $board, $limit);
    
    echo json_encode(['success' => true, 'suggestions' => $suggestions]);
} else {
    json_error('Action invalide', 400);
}
