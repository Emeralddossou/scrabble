# LexiForge — Scrabble français v2

Refonte du jeu historique PHP en application **Node.js + TypeScript** moderne, responsive et déployable sur Vercel.

## Fonctionnalités

- inscription et connexion sécurisées ;
- salon, invitations, présence, statistiques et classement ;
- parties libres ou chronométrées, solo d'entraînement ou duel ;
- plateau français 15 × 15, jokers, mots croisés, multiplicateurs et bonus de 50 points ;
- passage, échange, abandon, journal des coups et fin après six tours sans score ;
- validation des mots avec le dictionnaire ODS inclus ;
- cache local en lecture et reprise après interruption réseau ;
- MySQL en production et SQLite/libSQL en local ;
- tests unitaires du moteur et CI GitHub.

## Démarrage

```bash
cp .env.example .env.local
npm install
npm run dev
```

Ouvrir `http://localhost:3000`.

## Variables

| Variable | Rôle |
|---|---|
| `DB_TYPE` | `mysql` ou `sqlite` |
| `DATABASE_URL` | URL de connexion à la base |
| `AUTH_SECRET` | secret aléatoire d'au moins 32 caractères |
| `APP_URL` | URL publique de l'application |

## Vérification

```bash
npm run typecheck
npm test
npm run build
```

Consulter [l'architecture v2](docs/ARCHITECTURE_V2.md) et [le guide Vercel](docs/DEPLOYMENT_VERCEL.md).

## Migration

La nouvelle application utilise son propre runtime et son propre schéma. Les anciennes données PHP doivent être exportées explicitement ; les mots de passe doivent être réinitialisés plutôt que recopiés. Les fichiers historiques restent disponibles dans Git pour faciliter l'audit et la migration.
