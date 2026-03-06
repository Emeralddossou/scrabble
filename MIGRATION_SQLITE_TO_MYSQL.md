# Migration SQLite → MySQL ✅

## Résumé des Changements

Le projet **Scrabble** a été entièrement migré de SQLite (optionnel) vers **MySQL comme base de données par défaut**. Tous les fichiers de configuration, le code, les workflows et la documentation ont été alignés.

---

## 📋 Fichiers Modifiés

### 1. **Configuration Environnement**

#### `.env` (Fichier local)
```diff
- DB_TYPE=sqlite
- DB_FILE=data/scrabble.db

+ DB_TYPE=mysql
+ DB_HOST=localhost
+ DB_PORT=3306
+ DB_USER=scrabble_user
+ DB_PASS=scrabble_password
+ DB_NAME=scrabble
```

#### `.env.example` (Template)
- ✅ Mis à jour avec configuration MySQL par défaut
- SQLite mentionné comme optionnel/legacy seulement

### 2. **Code Backend**

#### `backend/db.php`
- ✅ Changé le défaut : `getEnv('DB_TYPE', 'mysql')` (était `'sqlite'`)
- Toutes les conditions SQLite/MySQL restent compatibles

#### `backend/bootstrap.php`
- ✅ Fonction `maybe_cleanup()` refactorisée
- Détecte automatiquement le type de BD (MySQL vs SQLite)
- Utilise `DATE_SUB(NOW(), INTERVAL X DAY)` pour MySQL
- Utilise `datetime('now', '-X days')` pour SQLite

#### `backend/cron/cleanup.php`
- ✅ Même refactorisation que bootstrap.php
- Support dual-DB automatisé

### 3. **CI/CD et Déploiement**

#### `.github/workflows/deploy.yml`
- ✅ Étape Lint : `extensions: pdo, mysql` (supprimé sqlite)
- ✅ Étape Test : Setup MySQL automatisé
  - Utilise `ankane/setup-mysql@v1` pour créer une BD test
  - Crée utilisateur test et BD test avec permissions
- ✅ Étape Deploy : `.env` production avec variables MySQL
  - `DB_TYPE=mysql`
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` via secrets

### 4. **Documentation**

#### `README.md`
- ✅ Architecture : `.db` supprimé, MySQL souligné
- ✅ Prérequis : MySQL 5.7+ obligatoire
- ✅ .env : MySQL par défaut, SQLite optionnel/legacy
- ✅ GitHub Secrets : Tous les paramètres MySQL ajoutés

#### `CICD_SETUP.md`
- ✅ Secrets GitHub : Tableau mis à jour avec 8 paramètres
- ✅ Phase 2 (Tests) : "MySQL test" au lieu de "SQLite test"

#### `DEPLOYMENT_GUIDE.md`
- ✅ Secrets GitHub : Table complète pour MySQL
- ✅ Note de sécurité sur les permissions MySQL

#### `TESTING_CHECKLIST.md`
- ✅ Phase 3 : SQLite marqué optionnel/legacy
- ✅ MySQL est obligatoire pour tous les tests

#### `IMPLEMENTATION_SUMMARY.md`
- ✅ Phase 3 : "Migration vers MySQL (Obligatoire)"
- ✅ Phase 4 : Template .env avec MySQL
- ✅ Configuration Finale : 8 secrets GitHub obligatoires

#### `SETUP_MYSQL.md` (Nouveau)
- ✅ Guide complet de configuration MySQL
- Installation locale (Windows, Mac, Linux)
- Configuration cPanel pour production
- Troubleshooting détaillé
- Checklist post-migration

---

## 🔄 Compatibilité Rétroactive

Le code **reste compatible avec SQLite** pour les installations héritées :

```php
function maybe_cleanup($pdo) {
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $isMySQL = ($driver === 'mysql');
    
    if ($isMySQL) {
        // Requêtes MySQL
        $pdo->exec("DELETE FROM ... WHERE ... < DATE_SUB(NOW(), INTERVAL 7 DAY)");
    } else {
        // Requêtes SQLite
        $pdo->exec("DELETE FROM ... WHERE ... < datetime('now', '-7 days')");
    }
}
```

---

## ✅ Configuration Requise Après Migration

### Développement Local
```bash
# 1. Installer MySQL
brew install mysql@8.0  # ou winget install MySQL

# 2. Créer la base
mysql -u root
> CREATE DATABASE scrabble CHARACTER SET utf8mb4;
> CREATE USER 'scrabble_user'@'localhost' IDENTIFIED BY 'scrabble_password';
> GRANT ALL PRIVILEGES ON scrabble.* TO 'scrabble_user'@'localhost';
> FLUSH PRIVILEGES;

# 3. Configurer .env
DB_TYPE=mysql
DB_HOST=localhost
DB_USER=scrabble_user
DB_PASS=scrabble_password
DB_NAME=scrabble

# 4. Tester
php backend/db.php  # Ne doit pas lever d'erreur
```

### Production (Hébergement Web)
1. Accéder à cPanel → MySQL Databases
2. Créer base : `votredomaine_scrabble`
3. Créer utilisateur avec mot de passe fort
4. Ajouter 8 secrets GitHub (voir README.md)
5. Push → Déploiement automatique avec création des tables

---

## 🚀 Avantages de MySQL

| Aspect | SQLite | MySQL |
|--------|--------|-------|
| **Performance** | OK pour 1-2 joueurs | Excellente multi-users |
| **Concurrence** | Très limitée | Native |
| **Transactions** | Basiques | ACID complètes |
| **Scaling** | Impossible | Horizontal (réplication) |
| **Production** | Déconseillé | Standard industrie |
| **Locks** | À niveau fichier | À niveau table/row |

---

## ⚠️ Notes Importantes

1. **Pas de régression SQLite** : SQLite reste supporté comme fallback
2. **Migration facile** : Exécuter script fourni si besoin de migrer données existantes
3. **Secrets GitHub** : 8 paramètres obligatoires pour production
4. **Fichier .env** : JAMAIS committer, il est dans `.gitignore`

---

## 📞 Support

Pour problèmes de configuration MySQL :
- Voir [SETUP_MYSQL.md](SETUP_MYSQL.md) pour guide détaillé
- Voir [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) pour production
- Voir [CICD_SETUP.md](CICD_SETUP.md) pour GitHub Actions

---

**Status:** ✅ Migration complète et testée. Prêt pour production! 🚀

