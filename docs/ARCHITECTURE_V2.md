# Architecture Node.js / TypeScript

La v2 utilise Next.js App Router sur Node.js avec TypeScript strict. Le rendu, les routes API et le déploiement Vercel sont réunis sans mélanger la logique métier avec l'interface.

## Composants

- `lib/game-engine.ts` : moteur pur pour alignement, raccordement, mots croisés, jokers, multiplicateurs et bonus Scrabble.
- `lib/game-service.ts` : transactions, remplissage du chevalet, changement de tour, échanges, abandon et fin de partie.
- `lib/db.ts` : adaptateur unique MySQL ou SQLite/libSQL.
- `app/api/rpc/route.ts` : validation Zod, session et API applicative.
- `app/` : interface tactile responsive et cache de lecture local.

Chaque partie possède une version optimiste. Une mutation envoyée depuis un état périmé est rejetée afin d'éviter les doubles coups et les conflits liés aux mauvaises connexions. Toutes les écritures importantes sont transactionnelles.

## Sécurité

Mots de passe scrypt avec sel, cookie HTTP-only signé, requêtes SQL paramétrées, validation Zod, CSP et en-têtes défensifs.

## SQLite et Vercel

Le système de fichiers des fonctions Vercel est éphémère. SQLite convient au développement local ou à un serveur Node persistant. Sur Vercel, utiliser `DB_TYPE=mysql` et une base MySQL distante compatible serverless.
