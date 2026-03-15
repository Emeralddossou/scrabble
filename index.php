<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scrabble Français - Connexion</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="page-auth">
    <div class="container auth-container">
        <div class="glass-card auth-card">
            <div class="brand">
                <div class="brand-mark">S</div>
                <div>
                    <h1>Scrabble FR</h1>
                    <p class="brand-sub">Compétitif. Élégant. Moderne.</p>
                </div>
            </div>

            <p class="muted center">Connectez-vous pour entrer dans l’arène.</p>

            <div class="auth-toggle">
                <button id="toggle-login" class="active" type="button">Connexion</button>
                <button id="toggle-register" type="button">Inscription</button>
            </div>

            <form id="login-form">
                <input type="text" id="login-username" placeholder="Nom d'utilisateur" required maxlength="20" autocomplete="username">
                <input type="password" id="login-password" placeholder="Mot de passe" required minlength="8" autocomplete="current-password">
                <button type="submit">Se connecter</button>
            </form>

            <form id="register-form" style="display:none;">
                <input type="text" id="register-username" placeholder="Nom d'utilisateur" required maxlength="20" autocomplete="username">
                <input type="password" id="register-password" placeholder="Mot de passe (min 8)" required minlength="8" autocomplete="new-password">
                <input type="password" id="register-password-confirm" placeholder="Confirmer le mot de passe" required minlength="8" autocomplete="new-password">
                <button type="submit">Créer le compte</button>
            </form>

            <div class="auth-reset">
                <button id="toggle-reset" type="button" class="btn-ghost">Mot de passe oublié ?</button>
            </div>

            <form id="reset-form" style="display:none;">
                <input type="text" id="reset-username" placeholder="Nom d'utilisateur" required maxlength="20" autocomplete="username">
                <input type="text" id="reset-token" placeholder="Code de réinitialisation" required>
                <input type="password" id="reset-password" placeholder="Nouveau mot de passe (min 8)" required minlength="8" autocomplete="new-password">
                <button type="button" id="request-reset">Demander un code</button>
                <button type="submit">Réinitialiser</button>
            </form>
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
</body>
</html>
