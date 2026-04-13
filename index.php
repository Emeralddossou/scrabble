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
    <a href="#main-content" class="skip-link">Aller au contenu principal</a>
    <div class="container auth-container" id="main-content">
        <div class="glass-card auth-card">
            <div class="brand">
                <div class="brand-mark">S</div>
                <div>
                    <h1>Scrabble FR</h1>
                    <p class="brand-sub">Compétitif. Élégant. Moderne.</p>
                </div>
            </div>

            <p class="muted center">Connectez-vous pour entrer dans l’arène.</p>
            <p class="helper center">Nouveau joueur ? Créez un compte en moins d’une minute.</p>

            <div class="auth-toggle">
                <button id="toggle-login" class="active" type="button">Connexion</button>
                <button id="toggle-register" type="button">Inscription</button>
            </div>

            <form id="login-form" aria-label="Formulaire de connexion">
                <input type="text" id="login-username" placeholder="Nom d'utilisateur" aria-label="Nom d'utilisateur" required maxlength="20" autocomplete="username">
                <input type="password" id="login-password" placeholder="Mot de passe" aria-label="Mot de passe" required minlength="10" autocomplete="current-password">
                <p class="helper">Astuce : votre mot de passe fait au moins 10 caractères.</p>
                <button type="submit">Se connecter</button>
            </form>

            <form id="register-form" style="display:none;" aria-label="Formulaire d'inscription">
                <input type="text" id="register-username" placeholder="Nom d'utilisateur" aria-label="Nom d'utilisateur" required maxlength="20" autocomplete="username">
                <input type="password" id="register-password" placeholder="Mot de passe (min 10)" aria-label="Mot de passe" required minlength="10" autocomplete="new-password">
                <input type="password" id="register-password-confirm" placeholder="Confirmer le mot de passe" aria-label="Confirmer le mot de passe" required minlength="10" autocomplete="new-password">
                <p class="helper">Conseil : choisissez un mot de passe unique et mémorisable (10+ caractères avec majuscule, minuscule, chiffre et caractère spécial).</p>
                <button type="submit">Créer le compte</button>
            </form>

            <div class="auth-reset">
                <button id="toggle-reset" type="button" class="btn-ghost" aria-label="Demander un nouveau mot de passe">Mot de passe oublié ?</button>
            </div>

            <form id="reset-form" style="display:none;" aria-label="Formulaire de réinitialisation de mot de passe">
                <p class="helper">Entrez votre nom, demandez un code, puis choisissez un nouveau mot de passe.</p>
                <input type="text" id="reset-username" placeholder="Nom d'utilisateur" aria-label="Nom d'utilisateur" required maxlength="20" autocomplete="username">
                <input type="text" id="reset-token" placeholder="Code de réinitialisation" aria-label="Code de réinitialisation" required>
                <input type="password" id="reset-password" placeholder="Nouveau mot de passe (min 10)" aria-label="Nouveau mot de passe" required minlength="10" autocomplete="new-password">
                <p class="helper">Exigences: 10+ caractères avec majuscule, minuscule, chiffre et caractère spécial (!@#$%^&*(),.?":{}|<>)</p>
                <button type="button" id="request-reset">Demander un code</button>
                <button type="submit">Réinitialiser</button>
            </form>
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
</body>
</html>

