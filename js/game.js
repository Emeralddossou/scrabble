// js/game.js

const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id');

let gameState = null;
let myRack = [];
let temporaryPlacements = [];
let exchangeMode = false;
let exchangeSelections = new Set();
let isMyTurn = false;
let lastBoard = null;

const BOARD_LAYOUT = [
    ['tw', '', '', 'dl', '', '', '', 'tw', '', '', '', 'dl', '', '', 'tw'],
    ['', 'dw', '', '', '', 'tl', '', '', '', 'tl', '', '', '', 'dw', ''],
    ['', '', 'dw', '', '', '', 'dl', '', 'dl', '', '', '', 'dw', '', ''],
    ['dl', '', '', 'dw', '', '', '', 'dl', '', '', '', 'dw', '', '', 'dl'],
    ['', '', '', '', 'dw', '', '', '', '', '', 'dw', '', '', '', ''],
    ['', 'tl', '', '', '', 'tl', '', '', '', 'tl', '', '', '', 'tl', ''],
    ['', '', 'dl', '', '', '', 'dl', '', 'dl', '', '', '', 'dl', '', ''],
    ['tw', '', '', 'dl', '', '', '', 'st', '', '', '', 'dl', '', '', 'tw'],
    ['', '', 'dl', '', '', '', 'dl', '', 'dl', '', '', '', 'dl', '', ''],
    ['', 'tl', '', '', '', 'tl', '', '', '', 'tl', '', '', '', 'tl', ''],
    ['', '', '', '', 'dw', '', '', '', '', '', 'dw', '', '', '', ''],
    ['dl', '', '', 'dw', '', '', '', 'dl', '', '', '', 'dw', '', '', 'dl'],
    ['', '', 'dw', '', '', '', 'dl', '', 'dl', '', '', '', 'dw', '', ''],
    ['', 'dw', '', '', '', 'tl', '', '', '', 'tl', '', '', '', 'dw', ''],
    ['tw', '', '', 'dl', '', '', '', 'tw', '', '', '', 'dl', '', '', 'tw']
];

document.addEventListener('DOMContentLoaded', () => {
    if (!gameId) {
        window.location.href = 'dashboard.php';
        return;
    }
    if (typeof ensureCsrf === 'function') {
        ensureCsrf();
    }
    initSoundToggle();
    initBoardZoom();
    initBoard();
    initProfileClickHandlers();
    initHistoryDrawer();
    fetchGameState();
    startPolling();
    startSavingPlacements();
});

function initProfileClickHandlers() {
    const p1 = document.getElementById('player1-name');
    const p2 = document.getElementById('player2-name');
    [p1, p2].forEach(el => {
        if (!el) return;
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
            const uid = el.dataset.userId;
            const name = el.textContent;
            if (uid && typeof openProfileModal === 'function') {
                openProfileModal(uid, name);
            }
        });
    });
}

function initHistoryDrawer() {
    const btn = document.getElementById('mobile-history-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => openHistoryDrawer());
}

function initBoardZoom() {
    const btn = document.getElementById('board-zoom-toggle');
    if (!btn) return;
    const root = document.body;
    const saved = localStorage.getItem('board_zoomed') === '1';
    if (saved) root.classList.add('board-zoomed');
    btn.textContent = saved ? 'Zoom: ON' : 'Zoom plateau';
    btn.addEventListener('click', () => {
        root.classList.toggle('board-zoomed');
        const on = root.classList.contains('board-zoomed');
        localStorage.setItem('board_zoomed', on ? '1' : '0');
        btn.textContent = on ? 'Zoom: ON' : 'Zoom plateau';
        uiToast(on ? 'Zoom activé' : 'Zoom désactivé', 'info', 900);
    });
}

function openHistoryDrawer() {
    const drawer = document.getElementById('history-drawer');
    if (drawer) {
        drawer.classList.add('open');
        uiToast('Historique ouvert', 'info', 900);
    }
}

function closeHistoryDrawer() {
    const drawer = document.getElementById('history-drawer');
    if (drawer) {
        drawer.classList.remove('open');
        uiToast('Historique fermé', 'info', 900);
    }
}

async function openJokerDialog() {
    return new Promise(resolve => {
        if (!document.getElementById('joker-dialog-backdrop')) {
            const backdrop = document.createElement('div');
            backdrop.id = 'joker-dialog-backdrop';
            backdrop.className = 'ui-dialog-backdrop';
            backdrop.innerHTML = `
                <div class="ui-dialog" role="dialog" aria-modal="true">
                    <h4>Joker</h4>
                    <p>Choisissez une lettre (A-Z)</p>
                    <div id="joker-grid" class="joker-grid"></div>
                    <div class="ui-dialog-actions">
                        <button id="joker-cancel" class="btn-muted">Annuler</button>
                        <button id="joker-ok">Valider</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);
        }
        const backdrop = document.getElementById('joker-dialog-backdrop');
        const grid = document.getElementById('joker-grid');
        const okBtn = document.getElementById('joker-ok');
        const cancelBtn = document.getElementById('joker-cancel');
        backdrop.style.display = 'flex';
        let selected = '';

        grid.innerHTML = '';
        for (let i = 0; i < 26; i++) {
            const letter = String.fromCharCode(65 + i);
            const key = document.createElement('div');
            key.className = 'joker-key';
            key.textContent = letter;
            key.addEventListener('click', () => {
                selected = letter;
                grid.querySelectorAll('.joker-key').forEach(k => k.classList.remove('selected'));
                key.classList.add('selected');
            });
            grid.appendChild(key);
        }

        okBtn.onclick = () => {
            const letter = (selected || '').trim().toUpperCase();
            if (!/^[A-Z]$/.test(letter)) {
                uiToast('Lettre invalide', 'error');
                return;
            }
            backdrop.style.display = 'none';
            resolve(letter);
        };
        cancelBtn.onclick = () => {
            backdrop.style.display = 'none';
            resolve(null);
        };
    });
}

let soundEnabled = localStorage.getItem('sound_enabled') !== '0';
let audioCtx = null;

function initSoundToggle() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    btn.textContent = soundEnabled ? 'Son: ON' : 'Son: OFF';
    btn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem('sound_enabled', soundEnabled ? '1' : '0');
        btn.textContent = soundEnabled ? 'Son: ON' : 'Son: OFF';
        if (soundEnabled) playSound('toggle');
    });
}

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    ensureAudio();
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const now = ctx.currentTime;

    let freq = 520;
    let duration = 0.08;
    if (type === 'submit') { freq = 740; duration = 0.12; }
    if (type === 'pass') { freq = 360; duration = 0.1; }
    if (type === 'exchange') { freq = 620; duration = 0.1; }
    if (type === 'error') { freq = 180; duration = 0.16; }
    if (type === 'resign') { freq = 260; duration = 0.2; }
    if (type === 'toggle') { freq = 420; duration = 0.06; }

    o.type = 'sine';
    o.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now + duration + 0.02);
}

let pollTimer = null;
let savePlacementsTimer = null;
let serverTime = null;

function startPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    const interval = document.hidden ? 8000 : 3000;
    pollTimer = setTimeout(async () => {
        await fetchGameState();
        startPolling();
    }, interval);
}

// BUG #1 Fix: Periodically save placements to server
function startSavingPlacements() {
    if (savePlacementsTimer) clearTimeout(savePlacementsTimer);
    savePlacementsTimer = setInterval(async () => {
        if (temporaryPlacements.length > 0 && isMyTurn) {
            await api('game.php?action=save_placements', 'POST', {
                game_id: gameId,
                placements: temporaryPlacements
            });
        }
    }, 2000); // Save every 2 seconds if there are placements
}

document.addEventListener('visibilitychange', () => {
    startPolling();
    if (!document.hidden) startSavingPlacements();
});

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
            if (type === 'dw') cell.textContent = 'MD';
            if (type === 'tl') cell.textContent = 'LT';
            if (type === 'dl') cell.textContent = 'LD';
            if (r === 7 && c === 7) cell.classList.add('start');

            cell.addEventListener('dragover', allowDrop);
            cell.addEventListener('drop', dropOnBoard);
            cell.addEventListener('click', () => handleCellClick(r, c));

            boardEl.appendChild(cell);
        }
    }
}

function getCellClass(r, c) {
    const type = BOARD_LAYOUT[r][c];
    return type === 'st' ? 'start' : type;
}

async function fetchGameState() {
    const res = await api(`game.php?action=state&id=${gameId}`);
    if (res.error) {
        uiAlert(res.error);
        return;
    }

    gameState = res.game;
    const me = res.me;

    // BUG #5 Fix: Store server timestamp for timer calculation
    serverTime = res.server_timestamp || Math.floor(Date.now() / 1000);

    // BUG #1 Fix: Restore saved placements when fetching game state
    if (me == res.game.current_player_id && temporaryPlacements.length === 0) {
        const savedRes = await api(`game.php?action=load_placements&game_id=${gameId}`);
        if (savedRes.placements && savedRes.placements.length > 0) {
            temporaryPlacements = savedRes.placements;
        }
    }

    const p1 = res.players[0];
    const p2 = res.players[1];

    const p1NameEl = document.getElementById('player1-name');
    const p2NameEl = document.getElementById('player2-name');
    p1NameEl.textContent = p1.username;
    p1NameEl.dataset.userId = p1.user_id;
    document.getElementById('player1-score').textContent = p1.score;
    if (gameState.mode === 'timer') {
        document.getElementById('p1-timer').textContent = formatTime(p1.time_remaining ?? 0);
    } else {
        document.getElementById('p1-timer').textContent = "";
    }

    // Phase 2: Handle solo mode
    if (gameState.is_solo) {
        p2NameEl.textContent = 'Mode Solo';
        p2NameEl.style.fontStyle = 'italic';
        p2NameEl.style.color = '#999';
        document.getElementById('player2-score').textContent = '—';
        document.getElementById('p2-timer').textContent = '';
    } else if (p2) {
        p2NameEl.textContent = p2.username;
        p2NameEl.dataset.userId = p2.user_id;
        document.getElementById('player2-score').textContent = p2.score;
        if (gameState.mode === 'timer') {
            document.getElementById('p2-timer').textContent = formatTime(p2.time_remaining ?? 0);
        } else {
            document.getElementById('p2-timer').textContent = "";
        }
    }

    isMyTurn = gameState.current_player_id == me;
    if (gameState.status === 'finished') {
        const winner = res.players.find(p => p.user_id == gameState.winner_id);
        document.getElementById('game-status').textContent = winner ? `Terminé - Victoire de ${winner.username}` : 'Terminé - Match nul';
        document.getElementById('game-status').style.color = '#fbbf24';
        const badge = document.getElementById('turn-badge');
        if (badge) badge.style.display = 'none';
        disableActions();
        if (exchangeMode) cancelExchangeMode();
    } else {
        document.getElementById('game-status').textContent = isMyTurn ? "C'est à votre tour !" : "Adverse...";
        document.getElementById('game-status').style.color = isMyTurn ? '#4ade80' : '#f87171';
        const badge = document.getElementById('turn-badge');
        if (badge) badge.style.display = isMyTurn ? 'none' : 'inline-flex';
        setActionState(isMyTurn);
    }

    lastBoard = gameState.board;
    updateBoardUI(gameState.board);

    if (!isMyTurn && exchangeMode) {
        cancelExchangeMode();
    }

    if (isMyTurn && (temporaryPlacements.length > 0 || isDragging || exchangeMode)) {
        // keep local changes
    } else {
        myRack = res.my_rack || [];
        renderRack();
    }

    const bagCount = document.getElementById('bag-count');
    if (bagCount) bagCount.textContent = gameState.bag_count ?? '--';

    if (res.moves) renderHistory(res.moves);

    updatePreviewScore();
    
    // Start saving placements if not already saving and it's our turn
    if (isMyTurn && !savePlacementsTimer) {
        startSavingPlacements();
    }
}

function disableActions() {
    ['btn-submit','btn-recall','btn-shuffle','btn-exchange','btn-cancel-exchange','btn-pass','btn-resign'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });
}

function setActionState(isMyTurn) {
    const disabledIds = ['btn-submit','btn-exchange','btn-cancel-exchange','btn-pass','btn-resign'];
    disabledIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !isMyTurn;
    });
}

function updateBoardUI(serverBoard) {
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            const cell = document.querySelector(`.cell[data-r='${r}'][data-c='${c}']`);
            const isTemp = temporaryPlacements.some(t => t.r === r && t.c === c);
            if (!isTemp) {
                cell.innerHTML = '';
                if (!serverBoard[r][c]) {
                    const type = getCellClass(r, c);
                    if (type === 'tw') cell.textContent = 'MT';
                    if (type === 'dw') cell.textContent = 'MD';
                    if (type === 'tl') cell.textContent = 'LT';
                    if (type === 'dl') cell.textContent = 'LD';
                }
            }
            if (serverBoard[r][c]) {
                const letter = serverBoard[r][c];
                const tile = createTileElement(letter, true);
                cell.innerHTML = '';
                cell.appendChild(tile);
            }
        }
    }
}

function renderRack() {
    const rackEl = document.getElementById('rack');
    rackEl.innerHTML = '';

    let displayRack = [...myRack];

    temporaryPlacements.forEach(temp => {
        const idx = displayRack.indexOf(temp.rack_letter);
        if (idx > -1) displayRack.splice(idx, 1);
    });

    displayRack.forEach(letter => {
        const tile = createTileElement(letter, false, true);
        rackEl.appendChild(tile);
    });
}

function createTileElement(letter, locked, fromRack = false) {
    const div = document.createElement('div');
    div.className = 'tile';
    if (locked) div.classList.add('locked');
    const isLower = letter && letter.toLowerCase() === letter && letter.toUpperCase() !== letter;
    const isBlank = letter === '*' || isLower;
    const displayLetter = isLower ? letter.toUpperCase() : (letter === '*' ? '' : letter);
    div.textContent = displayLetter;
    div.draggable = !locked;

    if (isBlank) div.classList.add('blank');

    if (!locked) {
        div.addEventListener('dragstart', dragStart);
        div.addEventListener('dragend', dragEnd);
        div.addEventListener('click', () => handleRackTileClick(div));
    }

    const points = getPoints(letter);
    const pSpan = document.createElement('span');
    pSpan.className = 'points';
    pSpan.textContent = points;
    div.appendChild(pSpan);

    div.dataset.letter = letter;
    div.dataset.rackLetter = fromRack ? letter : '';
    if (isBlank && fromRack) {
        div.dataset.rackLetter = '*';
    }
    return div;
}

// DnD + Tap Logic
let draggedTile = null;
let isDragging = false;
let selectedTile = null;

function dragStart(e) {
    if (exchangeMode) return;
    const ok = prepareTileForPlacement(e.target, false);
    if (!ok) return;
    draggedTile = e.target;
    isDragging = true;
}

function dragEnd() {
    isDragging = false;
    draggedTile = null;
}

function handleRackTileClick(tileEl) {
    if (exchangeMode) {
        toggleExchangeSelection(tileEl);
        return;
    }
    selectTile(tileEl);
}

function selectTile(tileEl, skipJoker = false) {
    if (!tileEl || tileEl.classList.contains('locked')) return;
    if (!skipJoker) {
        const ok = prepareTileForPlacement(tileEl, true);
        if (!ok) return;
    }
    if (selectedTile) selectedTile.classList.remove('selected');
    selectedTile = tileEl;
    selectedTile.classList.add('selected');
}

function clearSelectedTile() {
    if (selectedTile) selectedTile.classList.remove('selected');
    selectedTile = null;
}

function prepareTileForPlacement(tileEl, autoSelect) {
    if (!tileEl) return false;
    const rackLetter = tileEl.dataset.rackLetter || tileEl.dataset.letter;
    if (rackLetter === '*' && tileEl.dataset.isBlank !== '1') {
        openJokerDialog().then(letter => {
            if (!letter) return;
            tileEl.dataset.letter = letter;
            tileEl.dataset.isBlank = '1';
            tileEl.classList.add('blank');
            tileEl.childNodes[0].nodeValue = letter;
            const pts = tileEl.querySelector('.points');
            if (pts) pts.textContent = '0';
            uiToast('Joker défini', 'info', 1200);
            if (autoSelect) {
                selectTile(tileEl, true);
            }
        });
        return false;
    }
    return true;
}

function allowDrop(e) {
    e.preventDefault();
}

function dropOnBoard(e) {
    e.preventDefault();
    if (!draggedTile) return;

    let cell = e.target;
    if (!cell.classList.contains('cell')) {
        cell = cell.closest('.cell');
    }
    if (!cell || cell.children.length > 0) return;
    placeTileOnCell(cell, draggedTile);
}

function handleCellClick(r, c) {
    if (exchangeMode) return;
    const cell = document.querySelector(`.cell[data-r='${r}'][data-c='${c}']`);
    const hasTempTile = cell && cell.querySelector('.tile:not(.locked)');

    if (selectedTile && !hasTempTile && cell.children.length === 0) {
        placeTileOnCell(cell, selectedTile);
        return;
    }

    if (hasTempTile) {
        returnTileToRack(r, c);
    }
}

function placeTileOnCell(cell, tileEl) {
    if (!cell || !tileEl) return;
    if (cell.children.length > 0) return;

    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);
    const letter = tileEl.dataset.letter;
    const rackLetter = tileEl.dataset.rackLetter || letter;
    const isBlank = tileEl.dataset.isBlank === '1';

    temporaryPlacements.push({ r, c, letter, is_blank: isBlank, rack_letter: rackLetter });
    tileEl.parentNode.removeChild(tileEl);
    cell.innerHTML = '';
    cell.appendChild(tileEl);
    clearSelectedTile();
    playSound('place');
    updatePreviewScore();
}

function returnTileToRack(r, c) {
    const idx = temporaryPlacements.findIndex(t => t.r === r && t.c === c);
    if (idx === -1) return;

    temporaryPlacements.splice(idx, 1);
    renderRack();
    updatePreviewScore();

    const cell = document.querySelector(`.cell[data-r='${r}'][data-c='${c}']`);
    cell.innerHTML = '';
    const type = getCellClass(r, c);
    if (type === 'tw') cell.textContent = 'MT';
    else if (type === 'dw') cell.textContent = 'MD';
    else if (type === 'tl') cell.textContent = 'LT';
    else if (type === 'dl') cell.textContent = 'LD';
}

function recallTiles() {
    temporaryPlacements = [];
    const cells = document.querySelectorAll('.cell');
    cells.forEach(c => {
        if (c.querySelector('.tile:not(.locked)')) {
            c.innerHTML = '';
            const r = c.dataset.r;
            const cIdx = c.dataset.c;
            const type = getCellClass(r, cIdx);
            if (type === 'tw') c.textContent = 'MT';
            else if (type === 'dw') c.textContent = 'MD';
            else if (type === 'tl') c.textContent = 'LT';
            else if (type === 'dl') c.textContent = 'LD';
        }
    });
    clearSelectedTile();
    renderRack();
    updatePreviewScore();
}

async function submitMove() {
    if (temporaryPlacements.length === 0) return;
    if (exchangeMode) return;
    if (!isMyTurn) {
        uiAlert("Ce n'est pas votre tour.");
        return;
    }

    const payload = {
        game_id: gameId,
        moves: temporaryPlacements.map(m => ({ r: m.r, c: m.c, letter: m.letter, is_blank: m.is_blank }))
    };

    const res = await api('game.php?action=play_turn', 'POST', payload);
    if (res.success) {
        temporaryPlacements = [];
        clearSelectedTile();
        playSound('submit');
        uiToast('Coup validé', 'success', 1200);
        fetchGameState();
    } else {
        playSound('error');
        uiAlert('Erreur: ' + res.error);
    }
}

function shuffleRack() {
    if (exchangeMode) return;
    myRack.sort(() => Math.random() - 0.5);
    renderRack();
    updatePreviewScore();
}

async function passTurn() {
    if (exchangeMode) return;
    if (await uiConfirm("Passer votre tour ?")) {
        const res = await api('game.php?action=pass', 'POST', { game_id: gameId });
        if (res.success) {
            playSound('pass');
            uiToast('Tour passé', 'info', 1200);
        }
        recallTiles();
        fetchGameState();
    }
}

async function resignGame() {
    if (await uiConfirm("Abandonner la partie ?")) {
        const res = await api('game.php?action=resign', 'POST', { game_id: gameId });
        if (res.success) {
            playSound('resign');
            uiToast('Partie abandonnée', 'info', 1200);
        } else if (res.error) {
            playSound('error');
            uiAlert(res.error);
        }
        fetchGameState();
    }
}

function toggleExchangeMode() {
    if (temporaryPlacements.length > 0) {
        uiAlert('Rappelez vos lettres avant un échange.');
        return;
    }
    clearSelectedTile();
    if (exchangeMode) {
        confirmExchange();
        return;
    }
    exchangeMode = true;
    exchangeSelections = new Set();
    document.getElementById('exchange-banner').style.display = 'block';
    document.getElementById('btn-exchange').textContent = 'Confirmer échange';
    document.getElementById('btn-cancel-exchange').style.display = 'inline-block';
}

function cancelExchangeMode() {
    exchangeMode = false;
    exchangeSelections.clear();
    document.getElementById('exchange-banner').style.display = 'none';
    document.getElementById('btn-exchange').textContent = 'Échanger';
    document.getElementById('btn-cancel-exchange').style.display = 'none';
    clearExchangeSelections();
}

function toggleExchangeSelection(tileEl) {
    if (!tileEl || tileEl.classList.contains('locked')) return;
    const id = tileEl;
    if (exchangeSelections.has(id)) {
        exchangeSelections.delete(id);
        tileEl.classList.remove('exchange-selected');
    } else {
        exchangeSelections.add(id);
        tileEl.classList.add('exchange-selected');
    }
}

function clearExchangeSelections() {
    exchangeSelections.forEach(tile => tile.classList.remove('exchange-selected'));
    exchangeSelections.clear();
}

async function confirmExchange() {
    if (exchangeSelections.size === 0) {
        uiAlert('Sélectionnez au moins une lettre à échanger.');
        return;
    }
    const letters = Array.from(exchangeSelections).map(tile => tile.dataset.rackLetter || tile.dataset.letter);
    const res = await api('game.php?action=exchange', 'POST', { game_id: gameId, letters });
    if (res.success) {
        playSound('exchange');
        uiToast('Échange effectué', 'success', 1200);
        cancelExchangeMode();
        fetchGameState();
    } else {
        playSound('error');
        uiAlert(res.error || 'Échange impossible');
    }
}

function getPoints(letter) {
    if (!letter) return 0;
    if (letter === '*' || (letter.toLowerCase() === letter && letter.toUpperCase() !== letter)) return 0;
    const pts = {
        'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1, 'J': 8, 'K': 10, 'L': 1, 'M': 2, 'N': 1, 'O': 1, 'P': 3, 'Q': 8, 'R': 1, 'S': 1, 'T': 1, 'U': 1, 'V': 4, 'W': 10, 'X': 10, 'Y': 10, 'Z': 10
    };
    return pts[letter.toUpperCase()] || 0;
}

function formatTime(seconds) {
    if (seconds < 0) return "(0:00)";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `(${m}:${s.toString().padStart(2, '0')})`;
}

function renderHistory(moves) {
    const log = document.getElementById('history-log');
    if (!log) return;
    log.innerHTML = '';
    moves.forEach(m => {
        const div = document.createElement('div');
        div.className = 'history-item';
        let text = '';
        const name = m.username || 'Système';
        if (m.move_type === 'play') {
            text = `${name} : ${m.word} (+${m.points})`;
        } else if (m.move_type === 'pass') {
            text = `${name} passe.`;
        } else if (m.move_type === 'exchange') {
            const details = m.details ? JSON.parse(m.details) : {};
            const count = details.count || 0;
            text = `${name} échange ${count} lettre(s).`;
        } else if (m.move_type === 'resign') {
            text = `${name} abandonne.`;
        } else if (m.move_type === 'end') {
            text = `Fin de partie.`;
        } else {
            text = m.word || '';
        }
        div.textContent = text;
        log.appendChild(div);
    });
    log.scrollTop = log.scrollHeight;

    const drawerLog = document.getElementById('history-log-drawer');
    if (drawerLog) {
        drawerLog.innerHTML = log.innerHTML;
        drawerLog.scrollTop = drawerLog.scrollHeight;
    }
}

function updatePreviewScore() {
    const scoreEl = document.getElementById('preview-score');
    const noteEl = document.getElementById('preview-note');
    if (!scoreEl || !noteEl) return;
    if (!lastBoard) {
        scoreEl.textContent = '0';
        noteEl.textContent = '';
        return;
    }
    if (temporaryPlacements.length === 0) {
        scoreEl.textContent = '0';
        noteEl.textContent = '';
        return;
    }
    const res = computeScorePreview(lastBoard, temporaryPlacements);
    if (!res.valid) {
        scoreEl.textContent = '0';
        noteEl.textContent = res.error;
    } else {
        scoreEl.textContent = res.score;
        noteEl.textContent = '';
    }
}

function computeScorePreview(board, placements) {
    const moves = placements.map(p => ({
        r: p.r,
        c: p.c,
        letter: p.is_blank ? p.letter.toLowerCase() : p.letter
    }));

    const rows = [...new Set(moves.map(m => m.r))];
    const cols = [...new Set(moves.map(m => m.c))];
    const isHorizontal = rows.length === 1;
    const isVertical = cols.length === 1;
    if (!isHorizontal && !isVertical) return { valid: false, error: 'Non aligné' };

    const sorted = [...moves].sort((a, b) => isHorizontal ? a.c - b.c : a.r - b.r);
    const start = isHorizontal ? sorted[0].c : sorted[0].r;
    const end = isHorizontal ? sorted[sorted.length - 1].c : sorted[sorted.length - 1].r;
    const fixed = isHorizontal ? sorted[0].r : sorted[0].c;

    for (let i = start; i <= end; i++) {
        const r = isHorizontal ? fixed : i;
        const c = isHorizontal ? i : fixed;
        const isPlaced = moves.some(m => m.r === r && m.c === c);
        if (!isPlaced && !board[r][c]) {
            return { valid: false, error: 'Pas de continuité' };
        }
    }

    const isFirstMove = isBoardEmpty(board);
    if (isFirstMove) {
        const touchesCenter = moves.some(m => m.r === 7 && m.c === 7);
        if (!touchesCenter) return { valid: false, error: 'Doit passer par le centre' };
        if (moves.length < 2) return { valid: false, error: 'Au moins 2 lettres' };
    } else {
        let touchesExisting = false;
        moves.forEach(m => {
            const neighbors = [
                [m.r - 1, m.c], [m.r + 1, m.c],
                [m.r, m.c - 1], [m.r, m.c + 1]
            ];
            neighbors.forEach(n => {
                if (n[0] >= 0 && n[0] < 15 && n[1] >= 0 && n[1] < 15) {
                    if (board[n[0]][n[1]]) touchesExisting = true;
                }
            });
        });
        if (!touchesExisting) return { valid: false, error: 'Doit toucher un mot' };
    }

    const temp = board.map(row => row.slice());
    moves.forEach(m => { temp[m.r][m.c] = m.letter; });

    const formed = [];
    const mainWord = getWordAt(temp, moves[0].r, moves[0].c, isHorizontal);
    formed.push(mainWord);
    moves.forEach(m => {
        const cross = getWordAt(temp, m.r, m.c, !isHorizontal);
        if (cross.word.length > 1) formed.push(cross);
    });

    let total = 0;
    formed.forEach(w => {
        let wordScore = 0;
        let wordMult = 1;
        for (let i = 0; i < w.word.length; i++) {
            const r = w.start_r + (w.is_horizontal ? 0 : i);
            const c = w.start_c + (w.is_horizontal ? i : 0);
            const letter = temp[r][c];
            const isBlank = letter && letter.toLowerCase() === letter && letter.toUpperCase() !== letter;
            let pts = isBlank ? 0 : getPoints(letter);
            const isNew = moves.some(m => m.r === r && m.c === c);
            if (isNew) {
                const mult = getMultiplier(r, c);
                if (mult === 'dl') pts *= 2;
                if (mult === 'tl') pts *= 3;
                if (mult === 'dw') wordMult *= 2;
                if (mult === 'tw') wordMult *= 3;
                if (mult === 'st') wordMult *= 2;
            }
            wordScore += pts;
        }
        total += (wordScore * wordMult);
    });
    if (moves.length === 7) total += 50;
    return { valid: true, score: total };
}

function getMultiplier(r, c) {
    const type = BOARD_LAYOUT[r][c];
    return type === 'st' ? 'st' : type;
}

function getWordAt(board, r, c, isHorizontal) {
    let cr = r;
    let cc = c;
    if (isHorizontal) {
        while (cc > 0 && board[cr][cc - 1]) cc--;
    } else {
        while (cr > 0 && board[cr - 1][cc]) cr--;
    }
    const start_r = cr;
    const start_c = cc;
    let word = '';
    if (isHorizontal) {
        while (cc < 15 && board[cr][cc]) {
            word += board[cr][cc];
            cc++;
        }
    } else {
        while (cr < 15 && board[cr][cc]) {
            word += board[cr][cc];
            cr++;
        }
    }
    return { word, start_r, start_c, is_horizontal: isHorizontal };
}

function isBoardEmpty(board) {
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            if (board[r][c]) return false;
        }
    }
    return true;
}
