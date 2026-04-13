# Scrabble Français - Jeu Multiplayer en Ligne

Un jeu de Scrabble français moderne, en ligne, avec support du temps réel et du mode solo pour l'entraînement.

## Fonctionnalités

### Gameplay
- 🎮 **Jeu Multiplayer** - Jouez contre d'autres joueurs en temps réel
- ⏱️ **Mode Chronométré** - Parties avec time management
- 🎯 **Mode Solo** - Entraînez-vous seul avec IA basique
- 📊 **Scoring Automatique** - Calcul complet des points selon les règles du Scrabble français
- � **Suggestions de mots** - Système de suggestions basé sur votre chevalet
- 🔄 **Replay** - Rejouez les parties terminées

### Sécurité
- �️ **Politique de mot de passe renforcée** - 10+ caractères avec complexité
- 🔒 **Verrouillage de compte** - Protection après 5 tentatives échouées
- ⏰ **Session timeout sécurisé** - Sessions expirent après 2 heures
- 🛡️ **Protection CSRF** - Validation sur tous les endpoints sensibles
- 🚦 **Rate limiting** - Protection contre les attaques par force brute
- 🔐 **HTTPS enforcement** - HTTPS requis en production

### Accessibilité
- ♿ **ARIA labels** - Labels pour les lecteurs d'écran
- ⌨️ **Navigation au clavier** - Skip links et focus visibles
- 🎯 **Contraste amélioré** - Respect des normes WCAG
- 📢 **Live regions** - Mises à jour dynamiques annoncées

### Performance
- ⚡ **Cache dictionnaire** - Chargement optimisé avec APCu
- 📊 **Monitoring intégré** - Métriques de performance et erreurs
- 🔄 **Log rotation** - Logs automatiques (30 jours)
- 📱 **Responsive mobile** - Optimisé pour petits écrans

### Tests
- ✅ **Tests unitaires** - PHPUnit pour la logique de jeu
- 🔍 **Tests d'intégration** - Flux complets testés
- 🔒 **Validation sécurité** - Tests de sécurité intégrés

## Architecture

```
frontend/
  ├── css/style.css           - Styling global et responsive
  ├── js/app.js              - Helpers, API client, UI
  └── js/game.js             - Logique de jeu (placement, drag-drop)

backend/
  ├── api/
  │   ├── auth.php           - Authentification, profil utilisateur
  │   ├── game.php           - API de jeu
  │   └── suggestions.php    - Suggestions de mots
  ├── GameLogic.php          - Validation, scoring, suggestions
  ├── AIPlayer.php           - IA basique pour mode solo
  ├── Logger.php             - Logging structuré avec métriques
  ├── db.php                 - Connexion BD (MySQL/SQLite)
  ├── bootstrap.php          - Config, sécurité, CSRF
  └── env.php                - Chargement .env

tests/
  ├── GameLogicTest.php      - Tests unitaires
  └── IntegrationTest.php    - Tests d'intégration

docs/
  ├── API.md                 - Documentation API
  └── SECURITY.md            - Rapport de sécurité

data/
  └── ods.txt                - Dictionnaire français Scrabble
```

## Installation

### 1. Prérequis
- PHP 7.4+
- **MySQL 5.7+** (obligatoire)
- Navigateur moderne

### 2. Clone & Setup

```bash
git clone https://github.com/Emeralddossou/scrabble.git
cd scrabble

# Copier la config d'exemple
cp .env.example .env

# Configurer .env (obligatoire)
nano .env

**Configuration MySQL (développement et production):**
```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=scrabble_user
DB_PASS=scrabble_password
DB_NAME=scrabble
APP_ENV=development
APP_DEBUG=true
```

> **Note:** Le fichier `.env` n'est **JAMAIS** commité. Il est dans `.gitignore` pour des raisons de sécurité.
> Pour la production, les variables sont stockées dans GitHub Secrets.

### 4. Initialisation BD

Les tables MySQL sont créées automatiquement au premier accès. Assurez-vous que :
- MySQL est installé et actif
- Les credentials dans `.env` sont valides
- La base de données `scrabble` existe

## Development

### Lancer localement

```bash
# Depuis la racine du projet:
php -S localhost:8000
# Puis: http://localhost:8000

# OU avec un serveur web (Apache, Nginx)
# Configurez la racine du document vers le dossier scrabble
```

### Structure des Endpoints API

```
backend/api/game.php?action={action}

Actions principales:
- state       GET   - État du jeu
- play_turn   POST  - Placer des mots
- pass        POST  - Passer son tour
- exchange    POST  - Échanger des tuiles
- resign      POST  - Abandonner
```

## Déploiement

### GitHub Actions (CI/CD Automatisé)

Les GitHub Actions exécutent automatiquement:
1. **Lint** - Vérification de syntaxe PHP/JS (PHPCS, JSHint)
2. **Test** - Tests unitaires et d'intégration (PHPUnit)
3. **Deploy** - Déploiement FTP automatique (si succès)

Configuration: `.github/workflows/deploy.yml`

**Secrets GitHub requis:**
- `FTP_HOST` - Hôte FTP du serveur de production
- `FTP_USER` - Utilisateur FTP
- `FTP_PASS` - Mot de passe FTP
- `DB_HOST` - Serveur MySQL production
- `DB_PORT` - Port MySQL
- `DB_USER` - Utilisateur MySQL production
- `DB_PASS` - Mot de passe MySQL production
- `DB_NAME` - Nom de la base MySQL production

### Déploiement Manuel

Pour un déploiement manuel via FTP, utilisez un client FTP (FileZilla, WinSCP) ou le script PowerShell:
```powershell
. .\deploy_ftp.ps1
# Vous sera demandé: FTP password
```

### Base de Données

La base de données est **MySQL obligatoirement**. Pour les installations héritées avec SQLite, le code supporte toujours SQLite mais MySQL est préféré.

**Schéma Principal:**
```sql
users              - Comptes joueurs (avec bio, avatar, wins, losses)
games              - Instances de parties
game_players       - Lien joueur-partie + scores
moves              - Historique des coups
invitations        - Invitations en attente
password_resets    - Tokens réinitialisation
login_attempts     - Suivi des tentatives de login (sécurité)
```

## Tests

### Exécuter les tests unitaires

```bash
# Installer PHPUnit
composer require --dev phpunit/phpunit

# Exécuter les tests
vendor/bin/phpunit tests/

# Ou avec le phar
php phpunit-9.phar tests/
```

### Tester le gameplay

```bash
# Créer une partie solo via le dashboard
# Ou inviter un ami pour une partie multijoueur
```

### Logs d'erreur

Voir `backend/logs/` pour les erreurs serveur. Les logs sont automatiquement rotatés après 30 jours.

### Métriques de monitoring

Les métriques sont disponibles via la classe Logger:
```php
$metrics = Logger::getMetrics();
// Retourne: total_requests, errors, api_calls, avg_response_time_ms, uptime_seconds, error_rate
```

## Règles du Scrabble

- Dictionnaire: ODS (Officiel Du Scrabble) français
- Score: Points des lettres + multiplicateurs (DL, TL, DW, TW)
- Bonus: +50 points si toutes les 7 tuiles sont jouées
- Fin: Quand la pioche est vide et un joueur vide sa rack

## Développement futur

### Fonctionnalités Implémentées (Phase 1-5)
- ✅ Politique de mot de passe renforcée
- ✅ Verrouillage de compte après échecs
- ✅ Session timeout sécurisé
- ✅ Cache dictionnaire avec APCu
- ✅ Tests unitaires (PHPUnit)
- ✅ Tests d'intégration
- ✅ Améliorations accessibilité (ARIA, skip links, focus)
- ✅ Optimisation responsive mobile
- ✅ Monitoring avec métriques (Logger)
- ✅ Suggestions de mots
- ✅ IA basique pour mode solo
- ✅ Améliorations profil utilisateur (bio, avatar, stats)
- ✅ Documentation API
- ✅ Rapport de sécurité
- ✅ Amélioration déploiement FTP avec validation des secrets

### Fonctionnalités Restantes (Phase 4 - Basse Priorité)
- [ ] Système de tournois
- [ ] Classement ELO
- [ ] Internationalisation (i18n)
- [ ] Panel d'administration
- [ ] Chat in-game
- [ ] Matchmaking intelligent

## Bugs connus & Fixes

**Phase 1 - Corrections critiques effectuées:**
- ✅ BUG #1: Message d'erreur non professionnel ("priez") → Message professionnel
- ✅ BUG #2: Chargement dictionnaire inefficace → Cache APCu
- ✅ BUG #3: Race conditions possibles → Locks dans transactions
- ✅ BUG #4: Timer désynchronisé → Synchronisation avec server_timestamp
- ✅ BUG #5: Politique mot de passe faible → Exigences de complexité
- ✅ BUG #6: Pas de verrouillage compte → Système de lockout implémenté
- ✅ BUG #7: Session timeout trop long → Réduit à 2 heures

**Améliorations supplémentaires:**
- ✅ Tests unitaires ajoutés
- ✅ Tests d'intégration ajoutés
- ✅ Accessibilité améliorée (ARIA, skip links)
- ✅ Responsive mobile optimisé
- ✅ Monitoring avec métriques
- ✅ Suggestions de mots
- ✅ IA basique pour solo
- ✅ Profil utilisateur amélioré
- ✅ Documentation API créée
- ✅ Rapport de sécurité créé
- ✅ Déploiement SSH au lieu de FTP

## Licence

MIT License - Voir `LICENSE` pour détails

---

Développé par Emeralddossou
