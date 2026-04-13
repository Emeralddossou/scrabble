<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scrabble Français - Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="page-dashboard">
    <a href="#main-content" class="skip-link">Aller au contenu principal</a>
    <div class="container" id="main-content">
        <header class="dashboard-header">
            <div>
                <h2>Bienvenue, <span id="user-display">...</span></h2>
                <p class="muted">Prêt pour une partie élégante et rapide ?</p>
                <p class="helper">Choisissez un joueur en ligne ou lancez une partie solo. Tout se met à jour automatiquement.</p>
            </div>
            <div class="dashboard-actions">
                <button id="btn-solo-game" class="btn-primary">Jouer Solo</button>
                <button id="btn-my-profile" class="btn-ghost">Mon profil</button>
                <button id="toggle-settings" class="btn-ghost">Paramètres</button>
                <button onclick="logout()" class="btn-danger">Déconnexion</button>
            </div>
        </header>

        <div class="dashboard-grid">
            <div class="glass-card">
                <h3>Parties en cours</h3>
                <p class="helper">Vos parties actives. Rejoignez ou créez-en une nouvelle.</p>
                <div id="games-list" aria-live="polite" aria-busy="true">Chargement...</div>
            </div>

            <div class="glass-card">
                <h3>Joueurs en ligne</h3>
                <p class="helper">Qui est disponible pour une partie ?</p>
                <div id="online-users" aria-live="polite" aria-busy="true">Chargement...</div>
            </div>

            <div class="glass-card">
                <h3>Invitations</h3>
                <p class="helper">Les invitations que vous avez reçues.</p>
                <div id="invitations-list" aria-live="polite" aria-busy="true">Chargement...</div>
            </div>

            <div class="glass-card">
                <h3>Vos statistiques</h3>
                <p class="helper">Victoires, défaites, parties jouées.</p>
                <div id="stats" aria-live="polite">Chargement...</div>
            </div>

            <div class="glass-card">
                <h3>Classement</h3>
                <p class="helper">Top des victoires. Jouez pour grimper dans le tableau.</p>
                <div id="leaderboard" aria-live="polite">Chargement...</div>
            </div>

            <div class="glass-card is-hidden" id="password-card">
                <h3>Changer le mot de passe</h3>
                <p class="helper">Choisissez un mot de passe unique de 10+ caractères avec majuscule, minuscule, chiffre et caractère spécial.</p>
                <form id="change-password-form">
                    <input type="password" id="current-password" placeholder="Mot de passe actuel" required minlength="10" autocomplete="current-password">
                    <input type="password" id="new-password" placeholder="Nouveau mot de passe" required minlength="10" autocomplete="new-password">
                    <input type="password" id="new-password-confirm" placeholder="Confirmer le nouveau mot de passe" required minlength="10" autocomplete="new-password">
                    <button type="submit">Mettre à jour</button>
                </form>
            </div>
        </div>
    </div>

    <div id="solo-game-modal" class="glass-card modal" style="display:none;">
        <h3>Nouvelle partie solo</h3>
        <p class="helper">Mode libre : pas de limite de temps. Mode chronométré : temps par joueur.</p>
        <label>Mode de jeu:</label>
        <select id="solo-game-mode">
            <option value="free">Libre (Sans limite)</option>
            <option value="timer">Chronométré</option>
        </select>

        <div id="solo-timer-settings" style="display:none;">
            <label>Temps par tour (min):</label>
            <input type="number" id="solo-time-limit" value="15" min="1">
            <label>Incrément (sec):</label>
            <input type="number" id="solo-increment" value="0" min="0">
        </div>

        <div class="modal-actions">
            <button onclick="createSoloGame()">Démarrer</button>
            <button onclick="closeSoloModal()" class="btn-muted">Annuler</button>
        </div>
    </div>

    <div id="invite-modal" class="glass-card modal" style="display:none;">
        <h3>Inviter <span id="invite-target-name"></span></h3>
        <p class="helper">Choisissez un mode et un temps pour équilibrer la partie.</p>
        <label>Mode de jeu:</label>
        <select id="game-mode">
            <option value="free">Libre (Sans limite)</option>
            <option value="timer">Chronométré</option>
        </select>

        <div id="timer-settings" style="display:none;">
            <label>Temps par joueur (min):</label>
            <input type="number" id="time-limit" value="15" min="1">
            <label>Incrément (sec):</label>
            <input type="number" id="increment" value="0" min="0">
        </div>

        <div class="modal-actions">
            <button onclick="sendInvite()">Envoyer</button>
            <button onclick="closeModal()" class="btn-muted">Annuler</button>
        </div>
    </div>

    <div id="profile-modal" class="glass-card modal" style="display:none;">
        <h3 id="profile-title">Profil</h3>
        <div id="profile-stats" class="profile-grid"></div>
        <div id="profile-history" style="margin-top:12px;"></div>
        <div class="modal-actions" style="margin-top: 12px;">
            <button class="btn-muted" onclick="closeProfileModal()">Fermer</button>
        </div>
    </div>

    <?php
        require_once __DIR__ . '/backend/env.php';
        $appEnv = env_get('APP_ENV', 'development');
        $appDebug = strtolower((string)env_get('APP_DEBUG', 'false'));
        $appDebug = in_array($appDebug, ['1', 'true', 'yes', 'on'], true);
    ?>
    <script>
        window.APP_ENV = <?php echo json_encode($appEnv); ?>;
        window.APP_DEBUG = <?php echo $appDebug ? 'true' : 'false'; ?>;
    </script>
    <script src="js/app.js"></script>
    <script>
        checkAuth().then(() => {
            fetchDashboardData();
            setInterval(fetchDashboardData, 5000);
        });

        document.getElementById('game-mode').addEventListener('change', (e) => {
            document.getElementById('timer-settings').style.display = e.target.value === 'timer' ? 'block' : 'none';
        });

        document.getElementById('solo-game-mode').addEventListener('change', (e) => {
            document.getElementById('solo-timer-settings').style.display = e.target.value === 'timer' ? 'block' : 'none';
        });

        document.getElementById('btn-solo-game').addEventListener('click', openSoloModal);
    </script>
</body>
</html>

