# Audit de parité historique

| Fonctionnalité historique | Emplacement historique        | État TypeScript | Défaut observé                          | Correction                                                         | Test                         |
| ------------------------- | ----------------------------- | --------------- | --------------------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| Inscription et connexion  | `backend/api/auth.php`        | implémentée     | secret JWT de secours et session longue | session opaque, cookie HTTP-only, expiration glissante deux heures | intégration authentification |
| Plateau et score          | `backend/GameLogic.php`       | implémentée     | moteur PHP mêlé à PDO                   | règles pures et validation serveur                                 | `tests/unit/rules.test.ts`   |
| Dictionnaire ODS          | `backend/GameLogic.php`       | implémenté      | acceptait tout mot si fichier absent    | chargement strict et erreur explicite                              | règles/dictionnaire          |
| Invitations               | `backend/api/game.php`        | implémentées    | doublons et expiration absents          | clé active unique, expiration, acceptation/refus/annulation        | intégration invitations      |
| Présence                  | `dashboard.php`               | implémentée     | liste de tous les comptes               | heartbeat expirant après 90 secondes                               | intégration présence         |
| Partie chronométrée       | `backend/GameAction.php`      | implémentée     | temps client non fiable                 | calcul serveur et persistance par joueur                           | intégration minuteur         |
| IA solo                   | `backend/AIPlayer.php`        | implémentée     | aucun placement retourné                | suggestions de placements légaux et bot avec chevalet              | règles/IA                    |
| Suggestions               | `backend/api/suggestions.php` | implémentées    | endpoint PHP disparu                    | suggestions validées par le moteur officiel                        | intégration suggestions      |
| Replay                    | `replay.php`                  | implémenté      | page TypeScript absente                 | journal de coups, snapshots et contrôles de lecture                | intégration replay           |
| Migration des données     | schéma `backend/db.php`       | import JSON     | aucun outil Node                        | import transactionnel avec rapport et dry-run                      | intégration migration        |

Les fonctionnalités historiques utiles ont une destination TypeScript identifiée ci-dessus ; l’historique Git conserve l’ancien runtime pour les audits futurs.
