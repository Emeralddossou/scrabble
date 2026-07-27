# Audit de parité historique

| Fonctionnalité historique | Emplacement historique | État TypeScript | Correction ou situation actuelle | Vérification |
| --- | --- | --- | --- | --- |
| Inscription et connexion | `backend/api/auth.php` | implémentée | session opaque, cookie HTTP-only, expiration glissante de deux heures et isolation du cache entre comptes | intégration authentification et Playwright |
| Plateau et score | `backend/GameLogic.php` | implémentée | règles pures, dictionnaire obligatoire et validation autoritaire côté serveur | `tests/unit/rules.test.ts` |
| Invitations à deux joueurs | `backend/api/game.php` | implémentées | envoi, réception, annulation, refus et acceptation atomique ; doublons croisés et invitations expirées bloqués | intégration et `tests/e2e/multiplayer.spec.ts` |
| Présence | `dashboard.php` | implémentée | heartbeat expirant après 90 secondes, y compris pendant une partie | parcours navigateur à deux comptes |
| Partie libre | `backend/GameAction.php` | implémentée | durée illimitée, sans décompte ni expiration temporelle | `multiplayer-lifecycle.test.ts` sur SQLite et MySQL |
| Partie chronométrée | `backend/GameAction.php` | implémentée | durée définie par joueur, incrément par coup, calcul serveur et expiration atomique | `multiplayer-lifecycle.test.ts` sur SQLite et MySQL |
| Passage, échange et abandon | `backend/GameAction.php` | implémentés | contrôle du tour, transactions, idempotence, échange multiple et attribution correcte de la victoire | intégration multijoueur et Playwright |
| Fin de partie et statistiques | `backend/GameAction.php` | implémentées | sortie de chevalet, six tours sans score, abandon et timeout ; statistiques mises à jour une seule fois | intégration multijoueur |
| Replay | `replay.php` | implémenté | journal, snapshots et plateau stable pendant les passages, échanges, abandons et expirations | parcours Playwright |
| Résilience réseau | JavaScript historique | implémentée | dernier état local lisible hors connexion, mutations jamais rejouées automatiquement, API privée exclue du cache du service worker | revue de sécurité et build PWA |
| MySQL / SQLite | SQLite historique | implémentés | même service métier avec migrations versionnées et tests d’intégration sur les deux moteurs | GitHub Actions |
| IA solo et suggestions | `backend/AIPlayer.php` | non prioritaire | le socle existe, mais la qualité de jeu de l’IA n’est pas un critère de disponibilité de la version multijoueur actuelle | à approfondir dans une passe distincte |
| Migration des données | schéma `backend/db.php` | import JSON | import transactionnel avec rapport et mode dry-run | intégration migration |

La parité déclarée comme prête dans cette passe concerne le jeu à deux. Le mode solo reste présent, mais n’est pas présenté comme finalisé au même niveau de qualité.
