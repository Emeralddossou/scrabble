# Migration depuis PHP

Sauvegarder la base historique avant toute opération. Exporter les tables `users`, `games`, `game_players`, `moves` et `invitations` en JSON puis lancer d’abord `npm run migrate:legacy -- --source=export.json --dry-run`. Sur une cible vierge, relancer sans `--dry-run`. Le script conserve les identifiants et refuse d’écraser une cible contenant déjà des utilisateurs.

Les hash PHP bcrypt doivent être vérifiés lors de la première connexion avant réhachage scrypt ; ne supprimer l’ancienne base qu’après validation d’un échantillon d’utilisateurs et de replays.
