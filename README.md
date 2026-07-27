# LexiForge

LexiForge est un Scrabble français en Next.js et TypeScript. Le serveur est l’autorité des règles, des scores, des horloges et de l’état des parties. Il fonctionne avec SQLite pour le développement local et MySQL pour Vercel.

## Démarrage

Utiliser Node 22 (`.nvmrc`), créer `.env.local` depuis `.env.example`, puis exécuter :

```bash
npm ci
npm run db:migrate
npm run dev
```

Le mot de passe doit comporter au moins dix caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.

## Commandes

`npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run build`, `npm run db:migrate`, `npm run db:seed` et `npm run migrate:legacy -- --source=export.json`.

## Architecture

Les règles pures sont dans `domain/scrabble`, la persistance et les services dans `server`, les routes App Router dans `app/api`, et le client dans `app`/`lib`. Les migrations sont versionnées dans `server/db/migrations.ts` ; aucune requête web ne crée le schéma.

Le client met en cache le dernier salon et le dernier état de partie, mais ne rejoue jamais automatiquement un coup. Les mutations ont un identifiant idempotent et une version attendue.

Consulter [l’architecture](docs/ARCHITECTURE.md), [les bases](docs/DATABASES.md), [la sécurité](docs/SECURITY.md), [les tests](docs/TESTING.md) et [le déploiement Vercel](docs/DEPLOYMENT_VERCEL.md).

## Licence

Voir [LICENSE](LICENSE).
