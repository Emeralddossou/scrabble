# Checklist de Test Complet - Scrabble Game

## ✅ Phase 1 Bugs - Vérification

### BUG #1: Placements qui disparaissaient
- [ ] Placer mots, puis attendre 8+ secondes (polling change)
- [ ] Vérifier que les placements restent visibles après polling
- [ ] Recharger la page - placements doivent être restaurés via `load_placements`
- [ ] Test: Jouer seul, poser des mots, se déconnecter, reconnecter

### BUG #2: Transactions non-atomiques
- [ ] Jouer un coup valide
- [ ] Vérifier: Score, plateau, rack, bag tous mis à jour
- [ ] Test en BD: `SELECT * FROM game_players WHERE game_id = X;`
- [ ] Vérifier incohérences = 0

### BUG #3: Validation client/serveur
- [ ] Placer un mot, voir le score affiché
- [ ] Soumettre, vérifier que le score final = prédiction
- [ ] Test: Placer "HELLO" = doit avoir même score affiché/serveur

### BUG #4: Jokers en échange
- [ ] Avoir 1 joker + 1 lettre quelconque
- [ ] Essayer d'échanger le joker → doit réussir

### BUG #5: Timer désynchronisé
- [ ] Créer partie en mode chronométré (5 min par joueur)
- [ ] Observer timer pendant 2-3 minutes
- [ ] Timer doit décrémenter régulièrement, pas de sauts

## ✅ Phase 2 Solo Mode

### Créer partie solo
- [ ] Dashboard: Cliquer "Jouer Solo"
- [ ] Choisir mode (Libre ou Chronométré)
- [ ] Démarrer → doit créer game avec `is_solo = 1`
- [ ] Vérifier BD: `SELECT is_solo FROM games WHERE id = X;` → 1

### Jouer solo
- [ ] Poser des mots, vérifier scoring OK
- [ ] Vérifier que pas de "joueur 2" n'interfère
- [ ] Affichage: Player 2 = "Mode Solo" en italique gris

### Mode timer solo
- [ ] Créer solo avec timer 5min
- [ ] Jouer, observer timer
- [ ] Timer doit expirer après 5 min → partie fin

## ✅ Phase 3 MySQL Support

### SQLite (local dev)
- [ ] Configuration `.env` avec `DB_TYPE=sqlite`
- [ ] Créer nouvelle partie → BD créée automatiquement
- [ ] Vérifier tables dans `data/scrabble.db`

### MySQL (si serveur MySQL local)
- [ ] Configuration `.env` avec MySQL credentials
- [ ] Relancer app
- [ ] Vérifier tables créées dans `scrabble` database
- [ ] Jouer partie, vérifier données en base

## ✅ Phase 4 Configuration .env

- [ ] Fichier `.env` existe
- [ ] `.env` NOT in git (dans `.gitignore`)
- [ ] `.env.example` is in git
- [ ] `backend/env.php` peut charger variables
- [ ] Test: `php -r "require 'backend/env.php'; var_dump(getEnv('DB_TYPE'));"`

## ✅ Phase 5 Git

- [ ] `git status` = clean
- [ ] `git log` montre commits
- [ ] `.gitignore` exclut `.env`, `data/*.db`, `backend/logs/`
- [ ] Remote configuré: `git remote -v`

## ✅ Phase 6 GitHub Actions

### Sans pusher à GitHub (test local):
- [ ] Vérifier structure `.github/workflows/deploy.yml` OK
- [ ] Vérifier chemin FTP dans config

### Une fois sur GitHub:
- [ ] Aller à `https://github.com/Emeralddossou/scrabble/settings/secrets`
- [ ] Ajouter secrets: `FTP_HOST`, `FTP_USER`, `FTP_PASS`
- [ ] Faire `git push origin main`
- [ ] Aller à Actions tab
- [ ] Observer le workflow:
  - [ ] Lint réussit
  - [ ] Test réussit
  - [ ] Deploy réussit
- [ ] Vérifier que fichiers sont sur FTP (via FileZilla ou terminal)

## ✅ Phase 7 Optimisations

### Logging
- [ ] Dossier `backend/logs/` créé après une requête API
- [ ] Fichier `YYYY-MM-DD.log` contient JSON
- [ ] Vérifier structure: `{"timestamp": ..., "level": "ERROR", ...}`

### Performance
- [ ] Console browser: `console.log(performanceMetrics)`
- [ ] Voir: apiCalls > 0, avgLatency > 0
- [ ] Requête lente (> 1s) génère log warning

## 🔧 Tests Fonctionnels Complets

### Authentification
- [ ] Nouvelle inscription
- [ ] Login/Logout
- [ ] Session maintenue après refresh

### Gameplay Multiplayer
- [ ] Créer 2 comptes
- [ ] Compte A invite Compte B
- [ ] Compte B accepte → partie active
- [ ] Compte A joue coup valide → score OK
- [ ] Compte B joue → tuiles reçues
- [ ] Alternance tours fonctionne

### Gameplay Solo
- [ ] Démarrer partie solo
- [ ] Poser mots normalement
- [ ] Pas d'erreur "ce n'est pas votre tour"

### Scoring Avancé
- [ ] Placer mot au centre (+2x word)
- [ ] Placer lettre TL (+3x letter)
- [ ] Placer lettre DL (+2x letter)
- [ ] Scorer 7 lettres (+50 bonus)
- [ ] Tous scores = attendus

### Edge Cases
- [ ] Placer jokers
- [ ] Mot invalide → erreur
- [ ] Poser 0 lettres → erreur "Aucune pièce posée"
- [ ] Invalider placement → tuiles retournées
- [ ] Passer 2 fois → partie terminée
- [ ] Échanger tuiles → OK

### Finishes
- [ ] Vider rack + bag = partie terminée
- [ ] Winner calculé correctement
- [ ] Scores finaux corrects

## 📱 Tests Cross-Device

- [ ] Desktop Firefox: Gameplay complet
- [ ] Desktop Chrome: Gameplay complet
- [ ] Mobile Safari (iPhone): Clics, drag placent tuiles
- [ ] Mobile Chrome (Android): Pareil

## 🚀 Déploiement Final Check

- [ ] Code sur GitHub: `https://github.com/Emeralddossou/scrabble`
- [ ] All branches committed
- [ ] Tags/releases créés (optionnel)
- [ ] Actions ayant réussi au moins 1x
- [ ] FTP upload confirmé
- [ ] Site live accessible: `https://votre-domaine.com`

## 📊 Performance Baselines

### API Response Times (acceptable)
- [ ] `state`: < 200ms
- [ ] `play_turn`: < 500ms
- [ ] `exchange`: < 300ms
- [ ] `pass`: < 200ms

### Frontend Metrics
- [ ] Page load: < 3s
- [ ] Drag-drop réactif: < 50ms feedback
- [ ] Scoring preview instant

## 🐛 Bugs Finaux à Chercher

- [ ] Pas d'erreurs console (F12)
- [ ] Pas d'erreurs PHP logs
- [ ] Pas de double-placements d'une même tuile
- [ ] Pas de perte de placements (sauf expérés)
- [ ] Pas de scores négatifs
- [ ] Toutes tuiles comptabilisées

## ✅ Final Sign-Off

- [ ] Toutes phases implémentées
- [ ] All tests passent
- [ ] Code committé & pushé
- [ ] Déploiement automatique OK
- [ ] Site en production
- [ ] README complet pour utilisateurs
- [ ] Documentation CI-CD pour devs

---

**Status:** En Cours → ✅ Complète!

**Date:** March 4, 2026
