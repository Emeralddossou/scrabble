<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scrabble Français - Replay</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="page-replay">
    <div class="container">
        <div class="glass-card replay-header">
            <div>
                <h2>Replay Partie #<span id="game-id-display"></span></h2>
                <p class="muted">Revivez les coups clés, un par un.</p>
            </div>
            <button class="btn-ghost" onclick="window.location.href='dashboard.php'">Retour</button>
        </div>

        <div class="replay-layout">
            <div id="board" class="replay-board" style="pointer-events: none;"></div>

            <div class="glass-card replay-controls">
                <h3>Contrôles</h3>
                <div class="replay-actions">
                    <button onclick="prevMove()">Précédent</button>
                    <button onclick="nextMove()">Suivant</button>
                    <button onclick="autoPlay()">Auto</button>
                </div>
                <div id="move-info">
                    Tour: <span id="current-move">0</span> / <span id="total-moves">0</span>
                    <br>
                    Mot: <span id="word-played">-</span> (<span id="points-scored">0</span> pts)
                </div>
            </div>
        </div>
    </div>

    <?php
        require_once __DIR__ . '/backend/env.php';
        $appEnv = getEnv('APP_ENV', 'development');
        $appDebug = strtolower((string)getEnv('APP_DEBUG', 'false'));
        $appDebug = in_array($appDebug, ['1', 'true', 'yes', 'on'], true);
    ?>
    <script>
        window.APP_ENV = <?php echo json_encode($appEnv); ?>;
        window.APP_DEBUG = <?php echo $appDebug ? 'true' : 'false'; ?>;
    </script>
    <script src="js/app.js"></script>
    <script>
        const gameId = new URLSearchParams(window.location.search).get('id');
        let moves = [];
        let currentStep = 0;

        document.getElementById('game-id-display').textContent = gameId;
        initBoard();
        fetchReplayData();

        function initBoard() {
            const boardEl = document.getElementById('board');
            boardEl.innerHTML = '';
            for (let r = 0; r < 15; r++) {
                for (let c = 0; c < 15; c++) {
                    const cell = document.createElement('div');
                    cell.className = `cell ${getCellClass(r, c)}`;
                    cell.dataset.r = r;
                    cell.dataset.c = c;
                    const type = getCellClass(r, c);
                    if (type === 'tw') cell.textContent = 'MT';
                    else if (type === 'dw') cell.textContent = 'MD';
                    else if (type === 'tl') cell.textContent = 'LT';
                    else if (type === 'dl') cell.textContent = 'LD';
                    boardEl.appendChild(cell);
                }
            }
        }

        function getCellClass(r, c) {
            const BOARD_LAYOUT = [
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
            const type = BOARD_LAYOUT[r][c];
            return type === 'st' ? 'start' : type;
        }

        async function fetchReplayData() {
            const res = await api(`game.php?action=history&id=${gameId}`);
            if (res.moves) {
                moves = res.moves.filter(m => m.move_type === 'play' && m.coordinates);
                document.getElementById('total-moves').textContent = moves.length;
            }
        }

        function nextMove() {
            if (currentStep >= moves.length) return;
            const move = moves[currentStep];
            const coords = JSON.parse(move.coordinates);
            coords.forEach(m => {
                const cell = document.querySelector(`.cell[data-r='${m.r}'][data-c='${m.c}']`);
                const tile = document.createElement('div');
                tile.className = 'tile locked';
                const isBlank = m.letter && m.letter.toLowerCase() === m.letter && m.letter.toUpperCase() !== m.letter;
                if (isBlank) tile.classList.add('blank');
                tile.textContent = isBlank ? m.letter.toUpperCase() : m.letter;
                cell.innerHTML = '';
                cell.appendChild(tile);
            });

            document.getElementById('word-played').textContent = move.word;
            document.getElementById('points-scored').textContent = move.points;

            currentStep++;
            document.getElementById('current-move').textContent = currentStep;
        }

        function prevMove() {
            if (currentStep <= 0) return;
            currentStep--;
            initBoard();
            for (let i = 0; i < currentStep; i++) {
                const move = moves[i];
                const coords = JSON.parse(move.coordinates);
                coords.forEach(m => {
                    const cell = document.querySelector(`.cell[data-r='${m.r}'][data-c='${m.c}']`);
                    const tile = document.createElement('div');
                    tile.className = 'tile locked';
                    const isBlank = m.letter && m.letter.toLowerCase() === m.letter && m.letter.toUpperCase() !== m.letter;
                    if (isBlank) tile.classList.add('blank');
                    tile.textContent = isBlank ? m.letter.toUpperCase() : m.letter;
                    cell.innerHTML = '';
                    cell.appendChild(tile);
                });
            }
            document.getElementById('current-move').textContent = currentStep;
        }

        let autoInterval;
        function autoPlay() {
            if (autoInterval) {
                clearInterval(autoInterval);
                autoInterval = null;
            } else {
                autoInterval = setInterval(nextMove, 1000);
            }
        }
    </script>
</body>
</html>
