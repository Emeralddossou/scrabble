# Scrabble Français - Jeu Multiplayer en Ligne

Un jeu de Scrabble français moderne, en ligne, avec support du temps réel and du mode solo pour l'entraînement.

## Fonctionnalités

- 🎮 **Jeu Multiplayer** - Jouez contre d'autres joueurs en temps réel
- ⏱️ **Mode Chronométré** - Parties avec time management
- 🎯 **Mode Solo** - Entraînez-vous seul
- 📊 **Scoring Automatique** - Calcul complet des points selon les règles du Scrabble français
- 🛡️ **Sécurisé** - Authentification utilisateur, validation serveur
- 📱 **Responsive** - Design moderne et adaptatif

## Architecture

```
frontend/
  ├── css/style.css           - Styling global
  ├── js/app.js              - Helpers, API client, UI
  └── js/game.js             - Logique de jeu (placement, drag-drop)

backend/
  ├── api/
  │   ├── auth.php           - Authentification
  │   └── game.php           - API de jeu
  ├── GameLogic.php          - Validation, scoring
  ├── db.php                 - Connexion BD (SQLite/MySQL)
  ├── bootstrap.php          - Config, sécurité
  └── env.php                - Chargement .env

data/
  ├── scrabble.db            - Base SQLite (dev)
  └── ods.txt                - Dictionnaire français Scrabble
```

## Installation

### 1. Prérequis
- PHP 7.4+
- SQLite3 OU MySQL 5.7+
- Navigateur moderne

### 2. Clone & Setup

```bash
git clone https://github.com/Emeralddossou/scrabble.git
cd scrabble

# Copier la config d'exemple
cp .env.example .env

# Configurer .env (optionnel pour SQLite, obligatoire pour MySQL)
nano .env
```

### 3. Configuration .env

**Pour SQLite (développement local):**
```env
DB_TYPE=sqlite
DB_FILE=data/scrabble.db
```

**Pour MySQL (production):**
```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=scrabble_user
DB_PASS=votre_mot_de_passe_securise
DB_NAME=scrabble
```

### 4. Initialisation BD

Les tables sont créées automatiquement au premier accès. Assurez-vous que:
- Le répertoire `data/` est writable (pour SQLite)
- Les credentials MySQL sont valides

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
1. **Lint** - Vérification de syntaxe PHP/JS
2. **Test** - Tests unitaires (si configurés)
3. **Deploy** - Upload FTP automatique (si succès)

Configuration: `.github/workflows/deploy.yml`

**Secrets GitHub requis:**
- `FTP_HOST`
- `FTP_USER`
- `FTP_PASS`
- `DB_PASS` (pour migration prod si MySQL)

### Déploiement Manuel

PowerShell script pour upload FTP:
```powershell
. .\deploy_ftp.ps1
# Vous sera demandé: FTP password
```

## Base de Données

### Schéma Principal

```sql
users          - Comptes joueurs
games          - Instances de parties
game_players   - Lien joueur-partie + scores
moves          - Historique des coups
invitations    - Invitations en attente
password_resets- Tokens réinitialisation
```

### Migration SQLite → MySQL

La base de données est compatible avec les deux. Simplement:
1. Configurer MySQL dans `.env`
2. Recharger l'app - les tables se créeront automatiquement

## Tests

### Tester le gameplay

```bash
# Créer une partie solo via le dashboard
# Ou inviter un ami pour une partie multijoueur
```

### Logs d'erreur

Voir `backend/logs/` pour les erreurs serveur.

## Règles du Scrabble

- Dictionnaire: ODS (Officiel Du Scrabble) français
- Score: Points des lettres + multiplicateurs (DL, TL, DW, TW)
- Bonus: +50 points si toutes les 7 tuiles sont jouées
- Fin: Quand la pioche est vide et un joueur vide sa rack

## Développement futur

- [ ] Rejouer une partie (replay)
- [ ] Statistiques détaillées par joueur
- [ ] Chat in-game
- [ ] Matchmaking intelligent
- [ ] Support mobile complet
- [ ] AI simple pour mode solo avancé

## Bugs connus & Fixes

**Phase 1 - Corrections effectuées:**
- ✅ BUG #1: Placements qui disparaissaient (sauvegarde en session)
- ✅ BUG #2: Transactions BD non-atomiques (ajout BEGIN/COMMIT)
- ✅ BUG #3: Validation client/serveur incohérente (unifiée)
- ✅ BUG #4: Jokers mal gérés en échange (fixed)
- ✅ BUG #5: Timer désynchronisé (ajout server_timestamp)

## Support

Pour signaler un bug ou proposer une fonctionnalité:
- GitHub Issues: [lien repo]
- Email: [contact]

## Licence

MIT License - Voir `LICENSE` pour détails

---

Développé par [Votre nom/équipe] 🎮
"?? Scrabble en ligne!" 
