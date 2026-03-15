// js/app.js

const API_BASE = 'backend/api';
const APP_DEBUG = window.APP_DEBUG === true || window.APP_DEBUG === 'true';
const APP_ENV = window.APP_ENV || 'development';
let csrfToken = sessionStorage.getItem('csrf_token') || '';

function setCsrf(token) {
    if (!token) return;
    csrfToken = token;
    sessionStorage.setItem('csrf_token', token);
}

function clearCsrf() {
    csrfToken = '';
    sessionStorage.removeItem('csrf_token');
}

async function ensureCsrf(force = false) {
    if (csrfToken && !force) return;
    const res = await api('auth.php?action=csrf');
    if (res && res.csrf) setCsrf(res.csrf);
}

function logApiError(endpoint, status, data, rawText) {
    const requestId = data && data.request_id ? data.request_id : null;
    const details = data && data.debug ? data.debug : null;
    if (details || APP_DEBUG) {
        console.groupCollapsed(`API ${endpoint} (${status})`);
        console.error(data?.error || 'Erreur API');
        if (requestId) console.info('Request ID:', requestId);
        if (details) console.info('Debug:', details);
        if (rawText && !details) console.info('Raw:', rawText);
        console.groupEnd();
    } else {
        console.error(`API ${endpoint} (${status}):`, data?.error || 'Erreur API');
        if (requestId) console.info('Request ID:', requestId);
    }
}

async function api(endpoint, method = 'GET', body = null, options = {}) {
    const retryOnCsrf = options.retryOnCsrf !== false;
    const headers = {
        'Content-Type': 'application/json'
    };
    if (method !== 'GET' && csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }
    const options = {
        method,
        headers,
        credentials: 'same-origin'
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const res = await fetch(`${API_BASE}/${endpoint}`, options);
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error('API invalid JSON:', text);
            return { error: 'Réponse serveur invalide', status: res.status };
        }

        if (data && data.error && /csrf/i.test(data.error)) {
            clearCsrf();
        }

        if (data && data.error && /csrf/i.test(data.error) && method !== 'GET' && retryOnCsrf && !endpoint.includes('action=csrf')) {
            await ensureCsrf(true);
            return api(endpoint, method, body, { retryOnCsrf: false });
        }

        if (!res.ok) {
            if (!data || typeof data !== 'object') data = {};
            if (!data.error) data.error = `Erreur serveur (${res.status})`;
            data.status = res.status;
            logApiError(endpoint, res.status, data, text);
        } else if (data && data.debug) {
            logApiError(endpoint, res.status, data, text);
        }

        return data;
    } catch (e) {
        console.error('API Error:', e);
        return { error: 'Connexion impossible', status: 0 };
    }
}

// Custom Dialogs
function ensureDialog() {
    if (document.getElementById('ui-dialog-backdrop')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'ui-dialog-backdrop';
    backdrop.className = 'ui-dialog-backdrop';
    backdrop.innerHTML = `
        <div class="ui-dialog" role="dialog" aria-modal="true">
            <h4 id="ui-dialog-title">Information</h4>
            <p id="ui-dialog-message"></p>
            <div class="ui-dialog-actions">
                <button id="ui-dialog-cancel" class="btn-muted" style="display:none;">Annuler</button>
                <button id="ui-dialog-ok">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(backdrop);
}

function uiAlert(message, title = 'Information') {
    return new Promise(resolve => {
        ensureDialog();
        const backdrop = document.getElementById('ui-dialog-backdrop');
        const titleEl = document.getElementById('ui-dialog-title');
        const msgEl = document.getElementById('ui-dialog-message');
        const okBtn = document.getElementById('ui-dialog-ok');
        const cancelBtn = document.getElementById('ui-dialog-cancel');
        titleEl.textContent = title;
        msgEl.textContent = message;
        cancelBtn.style.display = 'none';
        backdrop.style.display = 'flex';
        okBtn.onclick = () => {
            backdrop.style.display = 'none';
            resolve();
        };
    });
}

function uiConfirm(message, title = 'Confirmation') {
    return new Promise(resolve => {
        ensureDialog();
        const backdrop = document.getElementById('ui-dialog-backdrop');
        const titleEl = document.getElementById('ui-dialog-title');
        const msgEl = document.getElementById('ui-dialog-message');
        const okBtn = document.getElementById('ui-dialog-ok');
        const cancelBtn = document.getElementById('ui-dialog-cancel');
        titleEl.textContent = title;
        msgEl.textContent = message;
        cancelBtn.style.display = 'inline-block';
        backdrop.style.display = 'flex';
        okBtn.onclick = () => {
            backdrop.style.display = 'none';
            resolve(true);
        };
        cancelBtn.onclick = () => {
            backdrop.style.display = 'none';
            resolve(false);
        };
    });
}

function ensureToast() {
    if (document.getElementById('ui-toast-container')) return;
    const container = document.createElement('div');
    container.id = 'ui-toast-container';
    container.className = 'ui-toast-container';
    document.body.appendChild(container);
}

function uiToast(message, type = 'info', timeout = 2000) {
    ensureToast();
    const container = document.getElementById('ui-toast-container');
    const toast = document.createElement('div');
    toast.className = `ui-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.2s ease';
        setTimeout(() => toast.remove(), 250);
    }, timeout);
}

// Login / Register Logic
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const toggleLoginBtn = document.getElementById('toggle-login');
const toggleRegisterBtn = document.getElementById('toggle-register');
const toggleResetBtn = document.getElementById('toggle-reset');
const resetForm = document.getElementById('reset-form');

function setAuthMode(mode) {
    if (!loginForm || !registerForm) return;
    const isLogin = mode === 'login';
    loginForm.style.display = isLogin ? 'block' : 'none';
    registerForm.style.display = isLogin ? 'none' : 'block';
    if (resetForm) resetForm.style.display = 'none';
    if (toggleLoginBtn && toggleRegisterBtn) {
        toggleLoginBtn.classList.toggle('active', isLogin);
        toggleRegisterBtn.classList.toggle('active', !isLogin);
    }
}

if (toggleLoginBtn && toggleRegisterBtn) {
    toggleLoginBtn.addEventListener('click', () => setAuthMode('login'));
    toggleRegisterBtn.addEventListener('click', () => setAuthMode('register'));
}

if (loginForm || registerForm) {
    ensureCsrf(true);
}

if (toggleResetBtn && resetForm) {
    toggleResetBtn.addEventListener('click', () => {
        resetForm.style.display = resetForm.style.display === 'none' ? 'block' : 'none';
    });
}

if (loginForm) {
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await ensureCsrf();
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        const res = await api('auth.php?action=login', 'POST', { username, password });
        if (res.success) {
            setCsrf(res.csrf);
            window.location.href = 'dashboard.php';
        } else {
            uiAlert(res.error || 'Connexion impossible');
        }
    });
}

if (registerForm) {
    const usernameInput = document.getElementById('register-username');
    const passwordInput = document.getElementById('register-password');
    const confirmInput = document.getElementById('register-password-confirm');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await ensureCsrf();
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const confirm = confirmInput.value;

        if (password !== confirm) {
            uiAlert('Les mots de passe ne correspondent pas.');
            return;
        }

        const res = await api('auth.php?action=register', 'POST', { username, password });
        if (res.success) {
            setAuthMode('login');
            uiAlert('Compte créé. Vous pouvez vous connecter.');
        } else {
            uiAlert(res.error || "Impossible de créer le compte");
        }
    });
}

if (resetForm) {
    const resetUsername = document.getElementById('reset-username');
    const resetToken = document.getElementById('reset-token');
    const resetPassword = document.getElementById('reset-password');
    const requestResetBtn = document.getElementById('request-reset');

    requestResetBtn.addEventListener('click', async () => {
        await ensureCsrf();
        const username = resetUsername.value.trim();
        if (!username) {
            uiAlert('Entrez un nom d\'utilisateur.');
            return;
        }
        const res = await api('auth.php?action=request_reset', 'POST', { username });
        if (res.success) {
            if (res.reset_token) {
                resetToken.value = res.reset_token;
                uiAlert('Code de réinitialisation généré (mode dev).');
            } else {
                uiAlert('Si ce compte existe, un code a été envoyé.');
            }
        } else {
            uiAlert(res.error || 'Erreur');
        }
    });

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await ensureCsrf();
        const token = resetToken.value.trim();
        const newPass = resetPassword.value;
        if (!token) {
            uiAlert('Code requis.');
            return;
        }
        const res = await api('auth.php?action=reset_password', 'POST', { token, new_password: newPass });
        if (res.success) {
            uiAlert('Mot de passe réinitialisé. Vous pouvez vous connecter.');
            resetForm.reset();
        } else {
            uiAlert(res.error || 'Erreur');
        }
    });
}

// Auth Check & Dashboard Logic
let currentUser = null;
let targetUserId = null;

async function checkAuth() {
    const res = await api('auth.php?action=me');
    if (!res.success) {
        window.location.href = 'index.php';
    } else {
        currentUser = res.user;
        if (res.csrf) setCsrf(res.csrf);
        const display = document.getElementById('user-display');
        if (display) display.textContent = currentUser.username;
        const myProfileBtn = document.getElementById('btn-my-profile');
        if (myProfileBtn) {
            myProfileBtn.onclick = () => openProfileModal(currentUser.id, currentUser.username);
        }
    }
}

async function logout() {
    await ensureCsrf();
    await api('auth.php?action=logout', 'POST');
    clearCsrf();
    window.location.href = 'index.php';
}

async function fetchDashboardData() {
    if (!document.getElementById('games-list')) return;

    const gamesRes = await api('game.php?action=list');
    const gamesList = document.getElementById('games-list');
    gamesList.innerHTML = '';

    if (gamesRes.error) {
        gamesList.innerHTML = `<p class="muted">${gamesRes.error}</p>`;
    } else if (gamesRes.games && gamesRes.games.length > 0) {
        gamesRes.games.forEach(g => {
            const div = document.createElement('div');
            div.className = 'game-item';
            div.style.cssText = 'padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; gap: 8px;';
            const isFinished = g.status === 'finished';
            const opponent = g.player1 === currentUser.username ? g.player2 : g.player1;
            div.innerHTML = `
                <div>
                    <strong>vs ${opponent}</strong>
                    <br><span style="font-size: 0.8em; opacity: 0.7;">${g.status} | ${isFinished ? 'Terminé' : (g.current_player_id == currentUser.id ? 'À vous' : 'Adversaire')}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    ${isFinished ? `<button style="width: auto; padding: 5px 10px; font-size: 0.8em;" onclick="window.location.href='replay.php?id=${g.id}'">Replay</button>` : `<button style="width: auto; padding: 5px 10px; font-size: 0.8em;" onclick="window.location.href='game.php?id=${g.id}'">Jouer</button>`}
                </div>
            `;
            gamesList.appendChild(div);
        });
    } else {
        gamesList.innerHTML = '<p>Aucune partie en cours.</p>';
    }

    const usersRes = await api('auth.php?action=users');
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';

    if (usersRes.error) {
        usersList.innerHTML = `<p class="muted">${usersRes.error}</p>`;
    } else if (usersRes.users && usersRes.users.length > 0) {
        usersRes.users.forEach(u => {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;';
            div.innerHTML = `
                <span>${u.username}</span>
                <div style="display:flex; gap:6px;">
                    <button style="width: auto; padding: 5px 10px; font-size: 0.8em;" onclick="openProfileModal(${u.id}, '${u.username}')">Profil</button>
                    <button style="width: auto; padding: 5px 10px; font-size: 0.8em;" onclick="openInviteModal(${u.id}, '${u.username}')">Inviter</button>
                </div>
            `;
            usersList.appendChild(div);
        });
    } else {
        usersList.innerHTML = '<p>Aucun joueur en ligne.</p>';
    }

    await fetchInvites();
    await fetchStats();
    await fetchLeaderboard();
}

// Invitations
async function fetchInvites() {
    const invitesList = document.getElementById('invites-list');
    if (!invitesList) return;
    const res = await api('game.php?action=invites');
    invitesList.innerHTML = '';

    if (res.error) {
        invitesList.innerHTML = `<p class="muted">${res.error}</p>`;
    } else if (res.invites && res.invites.length > 0) {
        res.invites.forEach(inv => {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; gap: 8px;';
            const modeLabel = inv.mode === 'timer' ? `Chrono ${inv.time_limit}m +${inv.increment}s` : 'Libre';
            div.innerHTML = `
                <div>
                    <strong>${inv.from_username}</strong>
                    <br><span style="font-size: 0.8em; opacity: 0.7;">${modeLabel}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button style="width: auto; padding: 5px 10px; font-size: 0.8em;" onclick="acceptInvite(${inv.id})">Accepter</button>
                    <button style="width: auto; padding: 5px 10px; font-size: 0.8em; background:#64748b;" onclick="declineInvite(${inv.id})">Refuser</button>
                </div>
            `;
            invitesList.appendChild(div);
        });
    } else {
        invitesList.innerHTML = '<p>Aucune invitation.</p>';
    }
}

async function acceptInvite(inviteId) {
    await ensureCsrf();
    const res = await api('game.php?action=accept_invite', 'POST', { invite_id: inviteId });
    if (res.success) {
        window.location.href = `game.php?id=${res.game_id}`;
    } else {
        uiAlert(res.error || 'Impossible d\'accepter');
    }
}

async function declineInvite(inviteId) {
    await ensureCsrf();
    await api('game.php?action=decline_invite', 'POST', { invite_id: inviteId });
    fetchInvites();
}

// Stats + Change Password
async function fetchStats() {
    const statsEl = document.getElementById('stats');
    if (!statsEl) return;
    const res = await api('auth.php?action=stats');
    if (res.error) {
        statsEl.innerHTML = `<p class="muted">${res.error}</p>`;
    } else if (res.success) {
        const s = res.stats || {};
        statsEl.innerHTML = `
            <div>Parties: <strong>${s.total || 0}</strong></div>
            <div>Victoires: <strong>${s.wins || 0}</strong></div>
            <div>Défaites: <strong>${s.losses || 0}</strong></div>
            <div>Nuls: <strong>${s.draws || 0}</strong></div>
        `;
    }
}

async function fetchLeaderboard() {
    const boardEl = document.getElementById('leaderboard');
    if (!boardEl) return;
    const res = await api('auth.php?action=leaderboard');
    if (res.error) {
        boardEl.innerHTML = `<p class="muted">${res.error}</p>`;
    } else if (res.success) {
        const leaders = res.leaders || [];
        if (leaders.length === 0) {
            boardEl.innerHTML = '<p>Aucun classement.</p>';
            return;
        }
        boardEl.innerHTML = leaders.map((l, idx) => (
            `<div style="display:flex; justify-content:space-between; padding:4px 0;">
                <span>${idx + 1}. ${l.username}</span>
                <strong>${l.wins}</strong>
            </div>`
        )).join('');
    }
}

async function openProfileModal(userId, username) {
    const modal = document.getElementById('profile-modal');
    const title = document.getElementById('profile-title');
    const statsEl = document.getElementById('profile-stats');
    const historyEl = document.getElementById('profile-history');
    if (!modal || !title || !statsEl || !historyEl) return;

    title.textContent = `Profil de ${username || 'Joueur'}`;
    statsEl.innerHTML = 'Chargement...';
    historyEl.innerHTML = '';
    modal.style.display = 'block';

    const res = await api(`auth.php?action=profile&user_id=${encodeURIComponent(userId)}`);
    if (!res.success) {
        statsEl.innerHTML = `<p>${res.error || 'Erreur'}</p>`;
        return;
    }

    const s = res.stats || {};
    statsEl.innerHTML = `
        <div class="profile-card">Parties<br><strong>${s.total || 0}</strong></div>
        <div class="profile-card">En cours<br><strong>${s.active || 0}</strong></div>
        <div class="profile-card">Victoires<br><strong>${s.wins || 0}</strong></div>
        <div class="profile-card">Défaites<br><strong>${s.losses || 0}</strong></div>
        <div class="profile-card">Nuls<br><strong>${s.draws || 0}</strong></div>
        <div class="profile-card">Score moyen<br><strong>${s.avg_score || 0}</strong></div>
    `;

    const gamesRes = await api(`game.php?action=list_user&user_id=${encodeURIComponent(userId)}`);
    if (gamesRes.games && gamesRes.games.length > 0) {
        historyEl.innerHTML = gamesRes.games.map(g => {
            const opponent = g.player1_id == userId ? g.player2 : g.player1;
            const isFinished = g.status === 'finished';
            const statusLabel = isFinished ? 'Terminé' : 'En cours';
            const actionBtn = isFinished ? `<button style="width:auto; padding:4px 8px;" onclick="window.location.href='replay.php?id=${g.id}'">Replay</button>` : `<button style="width:auto; padding:4px 8px;" onclick="window.location.href='game.php?id=${g.id}'">Jouer</button>`;
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div>
                        <strong>vs ${opponent}</strong>
                        <br><span class="muted" style="font-size:0.8rem;">${statusLabel}</span>
                    </div>
                    ${actionBtn}
                </div>
            `;
        }).join('');
    } else {
        historyEl.innerHTML = '<p>Aucune partie.</p>';
    }
}

function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.style.display = 'none';
}

const changePasswordForm = document.getElementById('change-password-form');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await ensureCsrf();
        const current = document.getElementById('current-password').value;
        const next = document.getElementById('new-password').value;
        const confirm = document.getElementById('new-password-confirm').value;
        if (next !== confirm) {
            uiAlert('Les mots de passe ne correspondent pas.');
            return;
        }
        const res = await api('auth.php?action=change_password', 'POST', { current_password: current, new_password: next });
        if (res.success) {
            uiAlert('Mot de passe mis à jour.');
            changePasswordForm.reset();
        } else {
            uiAlert(res.error || 'Erreur');
        }
    });
}

const toggleSettingsBtn = document.getElementById('toggle-settings');
const passwordCard = document.getElementById('password-card');
if (toggleSettingsBtn && passwordCard) {
    toggleSettingsBtn.addEventListener('click', () => {
        passwordCard.classList.toggle('is-hidden');
    });
}

// Modal Logic
function openInviteModal(userId, username) {
    targetUserId = userId;
    document.getElementById('invite-target-name').textContent = username;
    document.getElementById('invite-modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('invite-modal').style.display = 'none';
    targetUserId = null;
}

async function sendInvite() {
    if (!targetUserId) return;

    const mode = document.getElementById('game-mode').value;
    const timeLimit = document.getElementById('time-limit').value;
    const increment = document.getElementById('increment').value;

    await ensureCsrf();
    const res = await api('game.php?action=invite', 'POST', {
        to_user_id: targetUserId,
        mode,
        time_limit: timeLimit,
        increment
    });

    if (res.success) {
        closeModal();
        fetchDashboardData();
    } else {
        uiAlert('Erreur: ' + (res.error || 'Impossible d\'envoyer l\'invitation'));
    }
}

// Phase 2: Solo game
function openSoloModal() {
    const modal = document.getElementById('solo-game-modal');
    if (modal) modal.style.display = 'flex';
}

function closeSoloModal() {
    const modal = document.getElementById('solo-game-modal');
    if (modal) modal.style.display = 'none';
}

async function createSoloGame() {
    const mode = document.getElementById('solo-game-mode').value;
    const timeLimit = document.getElementById('solo-time-limit').value;
    const increment = document.getElementById('solo-increment').value;

    await ensureCsrf();
    const res = await api('game.php?action=create_solo', 'POST', {
        mode,
        time_limit: timeLimit,
        increment
    });

    if (res.success && res.game_id) {
        closeSoloModal();
        window.location.href = `game.php?id=${res.game_id}`;
    } else {
        uiAlert('Erreur: ' + (res.error || 'Impossible de créer la partie solo'));
    }
}
