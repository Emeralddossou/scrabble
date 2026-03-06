# Configuration MySQL - Guide de Configuration

## 🎯 Résumé des Changements

Le projet a été migré de **SQLite vers MySQL** en tant que base de données par défaut. MySQL offre :
- ✅ Meilleure performance pour les données en croissance
- ✅ Support multi-utilisateur natif
- ✅ Transactions complètes ACID
- ✅ Compatibilité avec les hébergements web standard

---

## 📋 Configuration Locale (Développement)

### 1. Installer MySQL

**Windows (XAMPP/WampServer):**
```bash
# Télécharger XAMPP: https://www.apachefriends.org/
# Installer et activer Apache + MySQL dans le Control Panel
```

**Intel Mac:**
```bash
brew install mysql@8.0
brew services start mysql@8.0
```

**Apple Silicon Mac:**
```bash
brew install mysql@8.0
brew services start mysql@8.0
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install mysql-server
sudo mysql_secure_installation
```

### 2. Créer la Base de Données

```bash
# Se connecter à MySQL
mysql -u root

# Exécuter dans le shell MySQL:
CREATE DATABASE scrabble CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'scrabble_user'@'localhost' IDENTIFIED BY 'scrabble_password';
GRANT ALL PRIVILEGES ON scrabble.* TO 'scrabble_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Configurer .env

Le fichier `.env` est **déjà configuré** avec les paramètres locaux :

```dotenv
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=scrabble_user
DB_PASS=scrabble_password
DB_NAME=scrabble
```

### 4. Vérifier la Connexion

```bash
# Tester si les fichiers PHP peuvent se connecter:
php -r "
require_once 'backend/env.php';
require_once 'backend/db.php';
echo 'Connexion successful!';
"
```

---

## 🚀 Configuration Production (Hébergement Web)

### 1. Accès cPanel / Hébergement

Si votre hébergement utilise **cPanel** :

1. Connectez-vous à cPanel de votre hébergement
2. Allez à **"MySQL Databases"**
3. Créez une nouvelle base :
   - Database name: `votredomaine_scrabble`
   - Créez un utilisateur avec mot de passe fort
   - Donnez tous les privilèges

### 2. Créer les Secrets GitHub

Allez à `https://github.com/Emeralddossou/scrabble/settings/secrets/actions` et ajoutez :

| Secret | Valeur | Exemple |
|--------|--------|---------|
| `DB_HOST` | Serveur MySQL | `db.example.com` |
| `DB_PORT` | Port | `3306` |
| `DB_USER` | Utilisateur | `votredomaine_scrabble` |
| `DB_PASS` | Mot de passe fort | `abc123!@#xyz` |
| `DB_NAME` | Nom de la base | `votredomaine_scrabble` |

### 3. Ajouter aussi les secrets FTP

| Secret | Valeur |
|--------|--------|
| `FTP_HOST` | ftpupload.net |
| `FTP_USER` | Votre user FTP |
| `FTP_PASS` | Votre password FTP |

### 4. Premier Déploiement

```bash
git push origin main
```

Le workflow GitHub Actions va automatiquement :
1. Valider le code
2. Configurer MySQL sur le serveur
3. Créer la base et les tables
4. Déployer les fichiers via FTP

---

## 🔄 Migration depuis SQLite (si applicable)

Si vous aviez une base SQLite existante et voulez migrer les données :

```bash
# Export SQLite
sqlite3 data/scrabble.db ".dump" > scrabble_dump.sql

# Import MySQL (éditer l'URL de destination)
mysql -u scrabble_user -p scrabble < scrabble_dump.sql
```

---

## 🆘 Dépannage

### ❌ "Access denied for user 'scrabble_user'@'localhost'"
```bash
# Réinitialiser le mot de passe:
mysql -u root
ALTER USER 'scrabble_user'@'localhost' IDENTIFIED BY 'scrabble_password';
FLUSH PRIVILEGES;
```

### ❌ "Can't connect to MySQL server"
```bash
# Vérifier que MySQL est actif:
sudo service mysql status  # Linux
brew services list | grep mysql  # Mac
```

### ❌ "Unknown database 'scrabble'"
```bash
# La base n'existe pas. Créer via cPanel ou:
mysql -u root
CREATE DATABASE scrabble CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### ❌ "Error creating table" on production
- Vérifier les permissions de l'utilisateur MySQL
- Vérifier que la base existe avec `SHOW DATABASES;`
- Contacter le support d'hébergement

---

## 📊 Variables d'Environnement Complètes

### Développement Local (`.env` existant)
```dotenv
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=scrabble_user
DB_PASS=scrabble_password
DB_NAME=scrabble
APP_ENV=development
APP_DEBUG=true
```

### Production (vars GitHub Secrets)
```
DB_TYPE=mysql
DB_HOST={DB_HOST}
DB_PORT={DB_PORT}
DB_USER={DB_USER}
DB_PASS={DB_PASS}
DB_NAME={DB_NAME}
APP_ENV=production
APP_DEBUG=false
```

---

## ✅ Checklist Post-Migration

- [ ] MySQL installé localement
- [ ] Base `scrabble` créée avec utilisateur `scrabble_user`
- [ ] `.env` configuré avec les bonnes valeurs
- [ ] `php backend/db.php` ne produit pas d'erreurs
- [ ] Secrets GitHub ajoutés (DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME)
- [ ] Premier push sur `main` = déploiement réussi
- [ ] Site en production = accessible et fonctionne

---

## 📚 Ressources

- MySQL Documentation: https://dev.mysql.com/doc/
- cPanel MySQL: https://docs.cpanel.net/cpanel/databases/mysql-databases/
- GitHub Secrets: https://docs.github.com/en/actions/security-guides/encrypted-secrets

---

**Le projet est maintenant configuré pour MySQL! 🎉**

