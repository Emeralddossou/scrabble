# API

Routes : `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/dashboard`, `POST /api/games`, `GET /api/games/:id`, `POST /api/games/:id/moves`, `POST /api/games/:id/actions`, `GET /api/games/:id/suggestions`, et `POST/PATCH /api/invitations`.

Chaque réponse est `{ ok, data|error, requestId }`. Les mutations envoient une origine même-site et les actions de jeu portent `expectedVersion` et `actionId` UUID.
