<?php
// backend/api/game.php

require_once '../bootstrap.php';
require_once '../db.php';
require_once '../GameLogic.php';
require_once '../Logger.php';
require_once '../env.php';

header('Content-Type: application/json');

// Phase 7: Performance tracking
$startTime = microtime(true);
$logger = Logger::getInstance();

if (!isset($_SESSION['user_id'])) {
    json_error('Unauthorized', 401);
}

maybe_cleanup($pdo);

$user_id = $_SESSION['user_id'];
$logic = new GameLogic($pdo);
$action = $_GET['action'] ?? '';

function requireGameMember($pdo, $game_id, $user_id) {
    $stmt = $pdo->prepare("SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?");
    $stmt->execute([$game_id, $user_id]);
    return (bool)$stmt->fetchColumn();
}

function normalizeMoves($moves) {
    $normalized = [];
    foreach ($moves as $m) {
        $r = isset($m['r']) ? intval($m['r']) : -1;
        $c = isset($m['c']) ? intval($m['c']) : -1;
        $letter = strtoupper(trim($m['letter'] ?? ''));
        $isBlank = !empty($m['is_blank']);
        $normalized[] = ['r' => $r, 'c' => $c, 'letter' => $letter, 'is_blank' => $isBlank];
    }
    return $normalized;
}

function logMove($pdo, $game_id, $user_id, $type, $word = null, $points = 0, $coordinates = null, $details = null) {
    $stmt = $pdo->prepare("INSERT INTO moves (game_id, user_id, word, points, coordinates, move_type, details) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$game_id, $user_id, $word, $points, $coordinates, $type, $details]);
}

function applyEndScores($pdo, $game_id, $logic) {
    $stmt = $pdo->prepare("SELECT user_id, rack, score FROM game_players WHERE game_id = ?");
    $stmt->execute([$game_id]);
    $players = $stmt->fetchAll();
    $rackScores = [];
    foreach ($players as $p) {
        $rack = json_decode($p['rack'], true);
        $rackScores[$p['user_id']] = $logic->rackScore($rack);
    }

    foreach ($players as $p) {
        $penalty = $rackScores[$p['user_id']] ?? 0;
        $stmt = $pdo->prepare("UPDATE game_players SET score = score - ? WHERE game_id = ? AND user_id = ?");
        $stmt->execute([$penalty, $game_id, $p['user_id']]);
    }

    if (count($players) === 2) {
        $u1 = $players[0]['user_id'];
        $u2 = $players[1]['user_id'];
        $bonus1 = $rackScores[$u2] ?? 0;
        $bonus2 = $rackScores[$u1] ?? 0;
        $stmt = $pdo->prepare("UPDATE game_players SET score = score + ? WHERE game_id = ? AND user_id = ?");
        $stmt->execute([$bonus1, $game_id, $u1]);
        $stmt = $pdo->prepare("UPDATE game_players SET score = score + ? WHERE game_id = ? AND user_id = ?");
        $stmt->execute([$bonus2, $game_id, $u2]);
    }
}

function finishGame($pdo, $game_id, $winner_id = null, $reason = 'end') {
    $stmt = $pdo->prepare("UPDATE games SET status = 'finished', winner_id = ?, ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, last_move_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([$winner_id, $game_id]);
    logMove($pdo, $game_id, $winner_id ?? 0, 'end', strtoupper($reason), 0, null, json_encode(['reason' => $reason]));
}

function updateTimerIfExpired($pdo, $game, $players) {
    if ($game['mode'] !== 'timer' || $game['status'] !== 'active') return $players;
    $now = time();
    $last_move = strtotime($game['last_move_at'] ?? 'now');
    $elapsed = max(0, $now - $last_move);
    foreach ($players as &$p) {
        if ($p['user_id'] == $game['current_player_id']) {
            $effective = max(0, intval($p['time_remaining']) - $elapsed);
            $p['time_remaining'] = $effective;
            if ($effective <= 0) {
                $stmt = $pdo->prepare("UPDATE game_players SET time_remaining = 0 WHERE game_id = ? AND user_id = ?");
                $stmt->execute([$game['id'], $p['user_id']]);
                $stmt = $pdo->prepare("SELECT user_id FROM game_players WHERE game_id = ? AND user_id != ?");
                $stmt->execute([$game['id'], $p['user_id']]);
                $winner = $stmt->fetchColumn();
                finishGame($pdo, $game['id'], $winner, 'timeout');
            }
            break;
        }
    }
    return $players;
}

if ($action === 'invite') {
    require_csrf();
    $data = json_decode(file_get_contents('php://input'), true);
    $to_user_id = intval($data['to_user_id'] ?? 0);
    $mode = ($data['mode'] ?? 'free') === 'timer' ? 'timer' : 'free';
    $time_limit = max(1, intval($data['time_limit'] ?? 15));
    $increment = max(0, intval($data['increment'] ?? 0));

    if ($to_user_id <= 0 || $to_user_id === $user_id) {
        json_error('Adversaire invalide');
    }
    $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
    $stmt->execute([$to_user_id]);
    if (!$stmt->fetch()) {
        json_error('Adversaire introuvable');
    }

    $stmt = $pdo->prepare("INSERT INTO invitations (from_user_id, to_user_id, status, mode, time_limit, increment) VALUES (?, ?, 'pending', ?, ?, ?)");
    $stmt->execute([$user_id, $to_user_id, $mode, $time_limit, $increment]);
    $invite_id = $pdo->lastInsertId();

    echo json_encode(['success' => true, 'invite_id' => $invite_id]);

} elseif ($action === 'invites') {
    $stmt = $pdo->prepare("SELECT i.id, i.from_user_id, u.username as from_username, i.mode, i.time_limit, i.increment, i.created_at FROM invitations i JOIN users u ON i.from_user_id = u.id WHERE i.to_user_id = ? AND i.status = 'pending' ORDER BY i.created_at DESC");
    $stmt->execute([$user_id]);
    echo json_encode(['invites' => $stmt->fetchAll()]);

} elseif ($action === 'accept_invite') {
    require_csrf();
    $data = json_decode(file_get_contents('php://input'), true);
    $invite_id = intval($data['invite_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM invitations WHERE id = ? AND to_user_id = ? AND status = 'pending'");
    $stmt->execute([$invite_id, $user_id]);
    $invite = $stmt->fetch();
    if (!$invite) {
        json_error('Invitation invalide');
    }

    $opponent_id = intval($invite['from_user_id']);
    $mode = $invite['mode'] === 'timer' ? 'timer' : 'free';
    $time_limit = max(1, intval($invite['time_limit'] ?? 15));
    $increment = max(0, intval($invite['increment'] ?? 0));
    $bag = $logic->initializeBag();
    $board = $logic->initializeBoard();
    $bag_json = json_encode($bag);
    $board_json = json_encode($board);

    $stmt = $pdo->prepare("INSERT INTO games (status, mode, time_limit, increment, current_player_id, bag, board, last_move_at) VALUES ('active', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)");
    $stmt->execute([$mode, $time_limit, $increment, $opponent_id, $bag_json, $board_json]);
    $game_id = $pdo->lastInsertId();

    $p1_tiles = $logic->drawTiles($bag, 7);
    $stmt = $pdo->prepare("INSERT INTO game_players (game_id, user_id, rack, time_remaining, turn_order) VALUES (?, ?, ?, ?, 1)");
    $stmt->execute([$game_id, $opponent_id, json_encode($p1_tiles), $time_limit * 60]);

    $p2_tiles = $logic->drawTiles($bag, 7);
    $stmt = $pdo->prepare("INSERT INTO game_players (game_id, user_id, rack, time_remaining, turn_order) VALUES (?, ?, ?, ?, 2)");
    $stmt->execute([$game_id, $user_id, json_encode($p2_tiles), $time_limit * 60]);
    
    $stmt = $pdo->prepare("UPDATE games SET bag = ? WHERE id = ?");
    $stmt->execute([json_encode($bag), $game_id]);

    $stmt = $pdo->prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?");
    $stmt->execute([$invite_id]);

    echo json_encode(['success' => true, 'game_id' => $game_id]);

} elseif ($action === 'decline_invite') {
    require_csrf();
    $data = json_decode(file_get_contents('php://input'), true);
    $invite_id = intval($data['invite_id'] ?? 0);
    $stmt = $pdo->prepare("UPDATE invitations SET status = 'declined' WHERE id = ? AND to_user_id = ?");
    $stmt->execute([$invite_id, $user_id]);
    echo json_encode(['success' => true]);

} elseif ($action === 'create') {
    require_csrf();
    $data = json_decode(file_get_contents('php://input'), true);
    $opponent_id = intval($data['opponent_id'] ?? 0);
    $mode = ($data['mode'] ?? 'free') === 'timer' ? 'timer' : 'free';
    $time_limit = max(1, intval($data['time_limit'] ?? 15));
    $increment = max(0, intval($data['increment'] ?? 0));

    if ($opponent_id <= 0 || $opponent_id === $user_id) {
        json_error('Adversaire invalide');
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
    $stmt->execute([$opponent_id]);
    if (!$stmt->fetch()) {
        json_error('Adversaire introuvable');
    }

    $bag = $logic->initializeBag();
    $board = $logic->initializeBoard();
    $bag_json = json_encode($bag);
    $board_json = json_encode($board);

    $stmt = $pdo->prepare("INSERT INTO games (status, mode, time_limit, increment, current_player_id, bag, board, last_move_at) VALUES ('active', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)");
    $stmt->execute([$mode, $time_limit, $increment, $user_id, $bag_json, $board_json]);
    $game_id = $pdo->lastInsertId();

    $p1_tiles = $logic->drawTiles($bag, 7);
    $stmt = $pdo->prepare("INSERT INTO game_players (game_id, user_id, rack, time_remaining, turn_order) VALUES (?, ?, ?, ?, 1)");
    $stmt->execute([$game_id, $user_id, json_encode($p1_tiles), $time_limit * 60]);

    $p2_tiles = $logic->drawTiles($bag, 7);
    $stmt = $pdo->prepare("INSERT INTO game_players (game_id, user_id, rack, time_remaining, turn_order) VALUES (?, ?, ?, ?, 2)");
    $stmt->execute([$game_id, $opponent_id, json_encode($p2_tiles), $time_limit * 60]);
    
    $stmt = $pdo->prepare("UPDATE games SET bag = ? WHERE id = ?");
    $stmt->execute([json_encode($bag), $game_id]);

    echo json_encode(['success' => true, 'game_id' => $game_id]);

} elseif ($action === 'create_solo') {
    // Phase 2: Create a solo game for training
    require_csrf();
    $data = json_decode(file_get_contents('php://input'), true);
    $mode = ($data['mode'] ?? 'free') === 'timer' ? 'timer' : 'free';
    $time_limit = max(1, intval($data['time_limit'] ?? 0));
    $increment = max(0, intval($data['increment'] ?? 0));

    $bag = $logic->initializeBag();
    $board = $logic->initializeBoard();
    $bag_json = json_encode($bag);
    $board_json = json_encode($board);

    $stmt = $pdo->prepare("INSERT INTO games (status, mode, time_limit, increment, current_player_id, bag, board, is_solo, last_move_at) VALUES ('active', ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)");
    $stmt->execute([$mode, $time_limit, $increment, $user_id, $bag_json, $board_json]);
    $game_id = $pdo->lastInsertId();

    // Create single game_player entry (user is both players)
    $tiles = $logic->drawTiles($bag, 7);
    $stmt = $pdo->prepare("INSERT INTO game_players (game_id, user_id, rack, time_remaining, turn_order) VALUES (?, ?, ?, ?, 1)");
    $stmt->execute([$game_id, $user_id, json_encode($tiles), $time_limit * 60]);
    
    $stmt = $pdo->prepare("UPDATE games SET bag = ? WHERE id = ?");
    $stmt->execute([json_encode($bag), $game_id]);

    echo json_encode(['success' => true, 'game_id' => $game_id]);

} elseif ($action === 'list') {
    $stmt = $pdo->prepare("
        SELECT g.id, g.status, g.current_player_id, g.winner_id, g.ended_at,
               u1.username as player1, u2.username as player2,
               gp.score as my_score
        FROM games g
        JOIN game_players gp ON g.id = gp.game_id
        JOIN game_players gp1 ON g.id = gp1.game_id AND gp1.turn_order = 1
        JOIN users u1 ON gp1.user_id = u1.id
        JOIN game_players gp2 ON g.id = gp2.game_id AND gp2.turn_order = 2
        JOIN users u2 ON gp2.user_id = u2.id
        WHERE gp.user_id = ?
        ORDER BY g.updated_at DESC
    ");
    $stmt->execute([$user_id]);
    echo json_encode(['games' => $stmt->fetchAll()]);

} elseif ($action === 'list_user') {
    $target_id = intval($_GET['user_id'] ?? 0);
    if ($target_id <= 0) {
        json_error('Utilisateur invalide', 400);
    }
    $stmt = $pdo->prepare("
        SELECT g.id, g.status, g.current_player_id, g.winner_id, g.ended_at,
               gp.score as user_score,
               u1.id as player1_id, u1.username as player1,
               u2.id as player2_id, u2.username as player2
        FROM games g
        JOIN game_players gp ON g.id = gp.game_id AND gp.user_id = ?
        JOIN game_players gp1 ON g.id = gp1.game_id AND gp1.turn_order = 1
        JOIN users u1 ON gp1.user_id = u1.id
        JOIN game_players gp2 ON g.id = gp2.game_id AND gp2.turn_order = 2
        JOIN users u2 ON gp2.user_id = u2.id
        ORDER BY g.updated_at DESC
        LIMIT 50
    ");
    $stmt->execute([$target_id]);
    echo json_encode(['games' => $stmt->fetchAll()]);

} elseif ($action === 'state') {
    $game_id = intval($_GET['id'] ?? 0);
    if ($game_id <= 0 || !requireGameMember($pdo, $game_id, $user_id)) {
        json_error('Accès refusé', 403);
    }

    $stmt = $pdo->prepare("SELECT * FROM games WHERE id = ?");
    $stmt->execute([$game_id]);
    $game = $stmt->fetch();

    if (!$game) { json_error('Game not found', 404); }

    $stmt = $pdo->prepare("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([$user_id]);

    $stmt = $pdo->prepare("SELECT gp.*, u.username FROM game_players gp JOIN users u ON gp.user_id = u.id WHERE game_id = ? ORDER BY turn_order");
    $stmt->execute([$game_id]);
    $players = $stmt->fetchAll();

    $players = updateTimerIfExpired($pdo, $game, $players);
    $stmt = $pdo->prepare("SELECT * FROM games WHERE id = ?");
    $stmt->execute([$game_id]);
    $game = $stmt->fetch();

    $my_rack = [];
    foreach ($players as $p) {
        if ($p['user_id'] == $user_id) $my_rack = json_decode($p['rack']);
    }

    $game['board'] = json_decode($game['board']);
    $bag = json_decode($game['bag']);
    $game['bag_count'] = is_array($bag) ? count($bag) : 0;
    unset($game['bag']); 

    $stmt = $pdo->prepare("SELECT m.*, u.username FROM moves m LEFT JOIN users u ON m.user_id = u.id WHERE m.game_id = ? ORDER BY m.id DESC LIMIT 20");
    $stmt->execute([$game_id]);
    $moves = array_reverse($stmt->fetchAll());

    echo json_encode([
        'game' => $game,
        'players' => $players,
        'me' => $user_id,
        'my_rack' => $my_rack,
        'moves' => $moves,
        'server_timestamp' => time()
    ]);

} elseif ($action === 'play_turn') {
    require_csrf();
    $input = json_decode(file_get_contents('php://input'), true);
    $game_id = intval($input['game_id'] ?? 0);
    $moves = normalizeMoves($input['moves'] ?? []);

    if ($game_id <= 0 || !requireGameMember($pdo, $game_id, $user_id)) {
        json_error('Accès refusé', 403);
    }

    $stmt = $pdo->prepare("SELECT * FROM games WHERE id = ?");
    $stmt->execute([$game_id]);
    $game = $stmt->fetch();

    if ($game['status'] !== 'active') {
        json_error('Partie terminée', 400);
    }

    if ($game['current_player_id'] != $user_id) {
        json_error('Ce n\'est pas votre tour', 400);
    }

    if (empty($moves)) {
        json_error('Aucune pièce posée');
    }

    $seen = [];
    foreach ($moves as $m) {
        if ($m['r'] < 0 || $m['r'] > 14 || $m['c'] < 0 || $m['c'] > 14) {
            json_error('Coordonnées invalides');
        }
        if (!preg_match('/^[A-Z]$/', $m['letter'])) {
            json_error('Lettre invalide');
        }
        $key = $m['r'] . ',' . $m['c'];
        if (isset($seen[$key])) {
            json_error('Doublon de position');
        }
        $seen[$key] = true;
    }

    $board = json_decode($game['board'], true);
    foreach ($moves as $m) {
        if (!empty($board[$m['r']][$m['c']])) {
            json_error('Case déjà occupée');
        }
    }

    $stmt = $pdo->prepare("SELECT rack FROM game_players WHERE game_id = ? AND user_id = ?");
    $stmt->execute([$game_id, $user_id]);
    $rack = json_decode($stmt->fetch()['rack']);
    $rackCounts = array_count_values($rack);
    foreach ($moves as $m) {
        $letter = $m['letter'];
        if ($m['is_blank']) {
            if (empty($rackCounts['*'])) {
                json_error('Vous ne possédez pas de joker');
            }
            $rackCounts['*']--;
        } else {
            if (empty($rackCounts[$letter])) {
                json_error('Vous ne possédez pas cette lettre');
            }
            $rackCounts[$letter]--;
        }
    }

    // Apply to board with lowercase for blanks
    $movesForLogic = [];
    foreach ($moves as $m) {
        $movesForLogic[] = [
            'r' => $m['r'],
            'c' => $m['c'],
            'letter' => $m['is_blank'] ? strtolower($m['letter']) : $m['letter']
        ];
    }

    $validation = $logic->validateMove($board, $movesForLogic);
    if (!$validation['valid']) {
        json_error($validation['error']);
    }

    // Begin transaction for atomicity (BUG #2)
    $pdo->beginTransaction();
    try {
        $now = time();
        $stmt = $pdo->prepare("SELECT last_move_at FROM games WHERE id = ?");
        $stmt->execute([$game_id]);
        $last_move = strtotime($stmt->fetch()['last_move_at'] ?? 'now');
        $time_spent = max(0, $now - $last_move);
        
        foreach ($movesForLogic as $m) {
            $board[$m['r']][$m['c']] = $m['letter'];
        }
        
        $increment = $game['increment'] ?? 0;
        if ($game['mode'] === 'timer') {
             $stmt = $pdo->prepare("UPDATE game_players SET score = score + ?, time_remaining = MAX(0, time_remaining - ? + ?) WHERE game_id = ? AND user_id = ?");
             $stmt->execute([$validation['score'], $time_spent, $increment, $game_id, $user_id]);
        } else {
             $stmt = $pdo->prepare("UPDATE game_players SET score = score + ? WHERE game_id = ? AND user_id = ?");
             $stmt->execute([$validation['score'], $game_id, $user_id]);
        }
        
        foreach ($moves as $m) {
            if ($m['is_blank']) {
                $idx = array_search('*', $rack);
            } else {
                $idx = array_search($m['letter'], $rack);
            }
            if ($idx !== false) {
                array_splice($rack, $idx, 1);
            }
        }
        
        $bag = json_decode($game['bag']);
        $needed = 7 - count($rack);
        if ($needed > 0) {
            $newTiles = $logic->drawTiles($bag, $needed);
            $rack = array_merge($rack, $newTiles);
        }
        
        $stmt = $pdo->prepare("UPDATE games SET board = ?, bag = ?, current_player_id = (SELECT user_id FROM game_players WHERE game_id = ? AND user_id != ?), updated_at = CURRENT_TIMESTAMP, last_move_at = CURRENT_TIMESTAMP, consecutive_passes = 0 WHERE id = ?");
        $stmt->execute([json_encode($board), json_encode($bag), $game_id, $user_id, $game_id]);
        
        $stmt = $pdo->prepare("UPDATE game_players SET rack = ? WHERE game_id = ? AND user_id = ?");
        $stmt->execute([json_encode($rack), $game_id, $user_id]);
        
        $mainWord = strtoupper($validation['words'][0]['word']);
        logMove($pdo, $game_id, $user_id, 'play', $mainWord, $validation['score'], json_encode($movesForLogic), null);
        
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        json_error('Erreur lors de la sauvegarde: ' . $e->getMessage(), 500);
    }

    // End game if rack empty and bag empty
    if (count($rack) === 0 && is_array($bag) && count($bag) === 0) {
        applyEndScores($pdo, $game_id, $logic);
        $stmt = $pdo->prepare("SELECT user_id, score FROM game_players WHERE game_id = ? ORDER BY score DESC");
        $stmt->execute([$game_id]);
        $scores = $stmt->fetchAll();
        $winner = null;
        if (count($scores) >= 2 && $scores[0]['score'] != $scores[1]['score']) {
            $winner = $scores[0]['user_id'];
        }
        finishGame($pdo, $game_id, $winner, 'rack_empty');
    }

    echo json_encode(['success' => true]);
    
} elseif ($action === 'exchange') {
    require_csrf();
    $input = json_decode(file_get_contents('php://input'), true);
    $game_id = intval($input['game_id'] ?? 0);
    $letters = $input['letters'] ?? [];

    if ($game_id <= 0 || !requireGameMember($pdo, $game_id, $user_id)) {
        json_error('Accès refusé', 403);
    }
    if (empty($letters)) {
        json_error('Aucune lettre sélectionnée');
    }

    $stmt = $pdo->prepare("SELECT * FROM games WHERE id = ?");
    $stmt->execute([$game_id]);
    $game = $stmt->fetch();

    if ($game['status'] !== 'active') {
        json_error('Partie terminée', 400);
    }
    if ($game['current_player_id'] != $user_id) {
        json_error('Ce n\'est pas votre tour', 400);
    }

    $bag = json_decode($game['bag'], true);
    if (!is_array($bag) || count($bag) < count($letters)) {
        json_error('La pioche est insuffisante pour échanger');
    }

    $stmt = $pdo->prepare("SELECT rack FROM game_players WHERE game_id = ? AND user_id = ?");
    $stmt->execute([$game_id, $user_id]);
    $rack = json_decode($stmt->fetch()['rack'], true);

    // BUG #4 Fix: Properly handle jokers/blanks in exchange
    $rackCounts = array_count_values($rack);
    $lettersToExchange = [];
    foreach ($letters as $letter) {
        $letter = strtoupper($letter);
        // If letter not in rack but joker available, swap
        $checkLetter = $letter;
        if (empty($rackCounts[$checkLetter]) && !empty($rackCounts['*'])) {
            $checkLetter = '*';
        }
        if (empty($rackCounts[$checkLetter])) {
            json_error('Vous ne possédez pas toutes ces lettres');
        }
        $lettersToExchange[] = $checkLetter;
        $rackCounts[$checkLetter]--;
    }

    foreach ($lettersToExchange as $letter) {
        $idx = array_search($letter, $rack);
        if ($idx !== false) {
            array_splice($rack, $idx, 1);
        }
    }

    // Put exchanged letters back in bag and draw new
    foreach ($lettersToExchange as $letter) {
        $bag[] = $letter;
    }
    shuffle($bag);
    $newTiles = $logic->drawTiles($bag, count($letters));
    $rack = array_merge($rack, $newTiles);

    $stmt = $pdo->prepare("UPDATE game_players SET rack = ? WHERE game_id = ? AND user_id = ?");
    $stmt->execute([json_encode($rack), $game_id, $user_id]);
    $stmt = $pdo->prepare("UPDATE games SET bag = ?, current_player_id = (SELECT user_id FROM game_players WHERE game_id = ? AND user_id != ?), updated_at = CURRENT_TIMESTAMP, last_move_at = CURRENT_TIMESTAMP, consecutive_passes = consecutive_passes + 1 WHERE id = ?");
    $stmt->execute([json_encode($bag), $game_id, $user_id, $game_id]);

    logMove($pdo, $game_id, $user_id, 'exchange', null, 0, null, json_encode(['count' => count($letters)]));

    // End game if two consecutive passes/exchanges
    $stmt = $pdo->prepare("SELECT consecutive_passes FROM games WHERE id = ?");
    $stmt->execute([$game_id]);
    $passes = intval($stmt->fetchColumn());
    if ($passes >= 2) {
        applyEndScores($pdo, $game_id, $logic);
        $stmt = $pdo->prepare("SELECT user_id, score FROM game_players WHERE game_id = ? ORDER BY score DESC");
        $stmt->execute([$game_id]);
        $scores = $stmt->fetchAll();
        $winner = null;
        if (count($scores) >= 2 && $scores[0]['score'] != $scores[1]['score']) {
            $winner = $scores[0]['user_id'];
        }
        finishGame($pdo, $game_id, $winner, 'passes');
    }

    echo json_encode(['success' => true]);

} elseif ($action === 'pass') {
    require_csrf();
    $input = json_decode(file_get_contents('php://input'), true);
    $game_id = intval($input['game_id'] ?? 0);

    if ($game_id <= 0 || !requireGameMember($pdo, $game_id, $user_id)) {
        json_error('Accès refusé', 403);
    }

    $stmt = $pdo->prepare("SELECT * FROM games WHERE id = ?");
    $stmt->execute([$game_id]);
    $game = $stmt->fetch();

    if ($game['status'] !== 'active') {
        json_error('Partie terminée', 400);
    }

    if ($game['current_player_id'] != $user_id) {
        json_error('Not your turn');
    }

    $stmt = $pdo->prepare("UPDATE games SET current_player_id = (SELECT user_id FROM game_players WHERE game_id = ? AND user_id != ?), updated_at = CURRENT_TIMESTAMP, last_move_at = CURRENT_TIMESTAMP, consecutive_passes = consecutive_passes + 1 WHERE id = ?");
    $stmt->execute([$game_id, $user_id, $game_id]);
    
    logMove($pdo, $game_id, $user_id, 'pass', null, 0, null, null);

    $stmt = $pdo->prepare("SELECT consecutive_passes FROM games WHERE id = ?");
    $stmt->execute([$game_id]);
    $passes = intval($stmt->fetchColumn());
    if ($passes >= 2) {
        applyEndScores($pdo, $game_id, $logic);
        $stmt = $pdo->prepare("SELECT user_id, score FROM game_players WHERE game_id = ? ORDER BY score DESC");
        $stmt->execute([$game_id]);
        $scores = $stmt->fetchAll();
        $winner = null;
        if (count($scores) >= 2 && $scores[0]['score'] != $scores[1]['score']) {
            $winner = $scores[0]['user_id'];
        }
        finishGame($pdo, $game_id, $winner, 'passes');
    }

    echo json_encode(['success' => true]);

} elseif ($action === 'resign') {
    require_csrf();
    $input = json_decode(file_get_contents('php://input'), true);
    $game_id = intval($input['game_id'] ?? 0);

    if ($game_id <= 0 || !requireGameMember($pdo, $game_id, $user_id)) {
        json_error('Accès refusé', 403);
    }

    $stmt = $pdo->prepare("SELECT * FROM games WHERE id = ?");
    $stmt->execute([$game_id]);
    $game = $stmt->fetch();

    if ($game['status'] !== 'active') {
        json_error('Partie terminée', 400);
    }

    $stmt = $pdo->prepare("SELECT user_id FROM game_players WHERE game_id = ? AND user_id != ?");
    $stmt->execute([$game_id, $user_id]);
    $winner = $stmt->fetchColumn();

    logMove($pdo, $game_id, $user_id, 'resign', null, 0, null, null);
    finishGame($pdo, $game_id, $winner, 'resign');
    echo json_encode(['success' => true]);

} elseif ($action === 'save_placements') {
    // BUG #1 Fix: Save temporary placements to session
    $input = json_decode(file_get_contents('php://input'), true);
    $game_id = intval($input['game_id'] ?? 0);
    $placements = $input['placements'] ?? [];
    
    if ($game_id <= 0 || !requireGameMember($pdo, $game_id, $user_id)) {
        json_error('Accès refusé', 403);
    }
    
    if (!isset($_SESSION['game_placements'])) {
        $_SESSION['game_placements'] = [];
    }
    
    $_SESSION['game_placements'][$game_id] = $placements;
    echo json_encode(['success' => true]);

} elseif ($action === 'load_placements') {
    // BUG #1 Fix: Load temporary placements from session
    $game_id = intval($_GET['game_id'] ?? 0);
    
    if ($game_id <= 0 || !requireGameMember($pdo, $game_id, $user_id)) {
        json_error('Accès refusé', 403);
    }
    
    $placements = $_SESSION['game_placements'][$game_id] ?? [];
    echo json_encode(['placements' => $placements]);

} elseif ($action === 'history') {
    $game_id = intval($_GET['id'] ?? 0);
    if ($game_id <= 0 || !requireGameMember($pdo, $game_id, $user_id)) {
        json_error('Accès refusé', 403);
    }
    $stmt = $pdo->prepare("SELECT m.*, u.username FROM moves m LEFT JOIN users u ON m.user_id = u.id WHERE m.game_id = ? ORDER BY id ASC");
    $stmt->execute([$game_id]);
    echo json_encode(['moves' => $stmt->fetchAll()]);
}

// Phase 7: Log API request performance
$endTime = microtime(true);
$duration = ($endTime - $startTime) * 1000; // milliseconds
$logger->logApiRequest('game.php', $_SERVER['REQUEST_METHOD'], 200, $duration);

// Log slow requests (> 1 second)
if ($duration > 1000) {
    $logger->warning('Slow API request', [
        'action' => $action,
        'duration_ms' => $duration,
        'game_id' => $_GET['id'] ?? $_POST['game_id'] ?? null
    ]);
}
?>
