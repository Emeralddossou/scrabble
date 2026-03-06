# GitHub Actions & CI/CD Setup

Ce guide explique comment configurer l'automatisation du déploiement avec GitHub Actions.

## 1. Ajouter les Secrets GitHub

GitHub Actions a besoin des identifiants FTP pour déployer. Vous devez les ajouter en tant que **Secrets**.

### Étapes:

1. Allez sur: `https://github.com/Emeralddossou/scrabble/settings/secrets/actions`
2. Cliquez sur **"New repository secret"** pour chacun:

| Nom | Valeur | Exemple | Obligatoire |
|-----|--------|---------|-------------|
| `FTP_HOST` | Serveur FTP | `ftpupload.net` | Oui |
| `FTP_USER` | Utilisateur FTP | `if0_41143538` | Oui |
| `FTP_PASS` | Mot de passe FTP | `votre_mot_de_passe` | Oui |
| `DB_HOST` | Serveur MySQL production | `db.example.com` | Oui |
| `DB_PORT` | Port MySQL | `3306` | Oui |
| `DB_USER` | Utilisateur MySQL production | `scrabble_prod` | Oui |
| `DB_PASS` | Mot de passe MySQL production | `secure_password` | Oui |
| `DB_NAME` | Nom de la base MySQL | `scrabble_prod` | Oui |

## 2. Structure du Workflow

Le fichier `.github/workflows/deploy.yml` exécute 3 étapes:

### Phase 1: **Lint** (Validation)
- Vérifie la syntaxe PHP
- Valide les fichiers JavaScript
- S'exécute sur chaque push et PR

### Phase 2: **Tests** (Test Units)
- Configure la base MySQL test
- Initialise le schéma de la base
- (Ajouter vos tests unitaires ici)
- Dépend du Lint

### Phase 3: **Deploy** (Déploiement)
- Upload les fichiers via FTP
- Exclut les fichiers sensibles (.env, logs, .git)
- **S'exécute UNIQUEMENT si:**
  - Le Lint & Tests réussissent
  - Le push est sur la branche `main`

## 3. Workflow d'Usage Typique

```
Vous pushez du code
    ↓
GitHub Actions se déclenche
    ↓
Étape 1: Lint ← Échoue? Build arrêté ✗
    ↓
Étape 2: Tests ← Erreurs? Build arrêté ✗
    ↓
Étape 3: Deploy ← Succès? FTP upload ✓
    ↓
Votre site est à jour!
```

## 4. Monitoring

### Visualiser les déploiements:
1. Allez sur: `https://github.com/Emeralddossou/scrabble/actions`
2. Cliquez sur le workflow `CI/CD - Build & Deploy`
3. Voyez le statut de chaque étape

### Logs détaillés:
1. Cliquez sur le run (commit) spécifique
2. Expandez chaque job pour voir les logs complets

## 5. Troubleshooting

### ❌ Erreur: "FTP_HOST secret not found"
**Solution:** Vérifiez que les secrets sont bien ajoutés: `Settings → Secrets and variables → Actions`

### ❌ Erreur: "Authentication failed (530)"
**Solution:** Vérifiez vos identifiants FTP. Test local:
```bash
ftp ftpupload.net
# Entrez vos credentials
```

### ❌ Erreur: "FILE NOT FOUND"
**Solution:** Le fichier est peut-être dans .gitignore ou deploy.yml l'exclut.
Vérifiez que vous l'avez bien commit via `git status`.

### ✅ Le déploiement réussit mais le site n'est pas à jour
**Solutions:**
1. Vérifier que `FTP_PATH` pointe vers la bonne adresse (appel le support d'hébergement)
2. Vider le cache du navigateur (Ctrl+Shift+Del)
3. Attendre quelques minutes (DNS propagation)

## 6. Customization

### Ajouter une étape Slack/Notification

Ajoutez après la dernière étape dans `.github/workflows/deploy.yml`:

```yaml
- name: Notify Slack
  if: always()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "🚀 Deployment: ${{ job.status }}",
        "blocks": [{
          "type": "section",
          "text": { "type": "mrkdwn", "text": "*Scrabble Game*\nBranch: main\nStatus: ${{ job.status }}" }
        }]
      }
```

Puis ajoutez le secret `SLACK_WEBHOOK` (depuis slack.com/apps)

### Déployer sur d'autres branches

Modifiez dans `deploy.yml`:
```yaml
if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging')
```

## 7. Checkliste de Setup

- [ ] Repository créé sur GitHub
- [ ] Secrets FTP ajoutés (Settings → Secrets)
- [ ] `.github/workflows/deploy.yml` existe
- [ ] Test d'un push sur `main` pour déclencher le workflow
- [ ] Vérifier dans Actions que le déploiement a réussi
- [ ] Tester que le site est bien à jour sur la production

---

✅ Une fois configuré, chaque `git push origin main` déploiera automatiquement votre code!
