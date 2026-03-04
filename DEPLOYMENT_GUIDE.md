# Quick Start Guide - Mise en Production

## 🚀 Étape 1: Vérification Locale

```bash
# Dans le dossier du projet
cd d:\CODE\scrabble

# Vérifier status Git
git status
# Devrait afficher: On branch master, nothing to commit, working tree clean

# Vérifier logs des commits
git log --oneline
# Devrait montrer 4 commits (Initial, CI/CD, Phase 7, Final)
```

## 🌐 Étape 2: Connecter à GitHub

```bash
# Ajouter le remote GitHub
git remote add origin https://github.com/Emeralddossou/scrabble.git

# Renommer branche main (optionnel mais recommandé)
git branch -M main

# Vérifier le remote
git remote -v
# Should show: origin https://github.com/Emeralddossou/scrabble.git (fetch)
```

## 📤 Étape 3: Pousser le Code

```bash
# Push vers GitHub
git push -u origin main

# Si erreur d'authentification, créer token GitHub:
# 1. https://github.com/settings/tokens
# 2. Créer "Personal access token" (Classic)
# 3. Scopes: repo, workflow
# 4. Copier token
# 5. Quand demandé pour password, coller token
```

## 🔐 Étape 4: Ajouter les Secrets

**Via l'interface GitHub:**

1. Aller à: `https://github.com/Emeralddossou/scrabble/settings/secrets/actions`

2. Cliquer **"New repository secret"** et ajouter:

| Nom | Valeur |
|-----|--------|
| `FTP_HOST` | ftpupload.net |
| `FTP_USER` | if0_41143538 |
| `FTP_PASS` | votre_mot_de_passe |

3. Click "Add secret" après chacun

## ✅ Étape 5: Tester CI/CD

```bash
# Faire un petit changement (ex: add emoji au README)
echo "🎮 Scrabble en ligne!" >> README.md

# Commit & push
git add README.md
git commit -m "Add emoji to README"
git push origin main
```

**Ensuite:**
- Aller à: `https://github.com/Emeralddossou/scrabble/actions`
- Observer le workflow `CI/CD - Build & Deploy`
- Attendre que tous les jobs complètent (vert = succès)
- Vérifier FTP qu'il y a le fichier (via FileZilla)

## 🎯 Indicateurs de Succès

### ✅ Vert = Tout OK
```
✓ Lint passed
✓ Test passed  
✓ Deploy to FTP completed
```

### ❌ Rouge = Erreur
1. Cliquer sur le job rouge
2. Lire le log d'erreur
3. Corriger localement
4. `git push` à nouveau

## 🐛 Troubleshooting Common Issues

### "fatal: could not read Username"
**Solution:** Utiliser token GitHub au lieu de password
- Voir Étape 3

### "Authentication failed (530)" on FTP
**Solution:** Vérifier les credentials FTP
```bash
ftp ftpupload.net
# Should connect sans erreur
```

### Deploy successful mais site pas à jour
**Solution:**
1. Vérifier via FileZilla: `htdocs/` a les fichiers
2. Vider cache navigateur: Ctrl+Shift+Del
3. Wait ~5 min (DNS propagation)
4. Contacter support si toujours absent

## 📝 Exemple de Workflow Complet

```bash
# 1. Clone (first time only)
git clone https://github.com/Emeralddossou/scrabble.git
cd scrabble

# 2. Make changes
nano backend/api/game.php
# ... fix bug ...

# 3. Test locally
php -S localhost:8000
# ... test gameplay ...

# 4. Commit
git add backend/api/game.php
git commit -m "Fix [bug description]"

# 5. Push (auto-deploys!)
git push origin main

# 6. Monitor
# Go to https://github.com/Emeralddossou/scrabble/actions
# Wait pour green checkmarks

# 7. Verify live
# Open https://votre-domaine.com
# Test that changes are there
```

## 🔄 Regular Workflow (après initial setup)

```bash
# Pull latest
git pull origin main

# Make changes
# ... edit files ...

# Stage & commit
git add .
git commit -m "Description of changes"

# Push (= auto-deploy via GitHub Actions)
git push origin main
```

## 📚 Helpful Commands

```bash
# Voir historique complet
git log --oneline --graph --all

# Revert dernier commit (si pas encore pushé)
git reset --soft HEAD~1

# Abandonner local changes
git checkout -- .

# Voir changements avant commit
git diff

# Voir changements avant push
git diff origin/main
```

## 🎓 Bonnes Pratiques

1. **Commit souvent**, messages clairs
2. **Push avant de dormir** → backup
3. **Test localement** avant de push
4. **Lire les logs** si déploiement échoue
5. **Monitor actions** après chaque push

## 🆘 Need Help?

**Pour GitHub Actions:**
- Docs: https://docs.github.com/en/actions
- Voir `.github/workflows/deploy.yml`

**Pour FTP:**
- Contacter support hebergement
- Utiliser FileZilla pour tester manually

**Pour Scrabble game:**
- Voir `README.md`
- Voir `TESTING_CHECKLIST.md`
- Voir `IMPROVEMENTS.md`

---

**Status:** ✅ Ready for Production!

Push et déploiement automatisé à chaque commit! 🚀
