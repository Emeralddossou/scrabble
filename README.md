# LexiForge

LexiForge est un Scrabble français en Next.js et TypeScript. Le serveur est l’autorité des règles, des scores, des horloges et de l’état des parties. Il fonctionne avec SQLite pour le développement local et MySQL pour Vercel.

## Jeu à deux

Le parcours multijoueur prend en charge :

- les invitations reçues et envoyées, avec acceptation, refus et annulation ;
- les parties **libres**, sans limite de temps ;
- les parties **chronométrées**, avec une durée définie par joueur et un incrément optionnel après chaque coup ;
- la pose de lettres, le passage, l’échange de plusieurs lettres et l’abandon ;
- le contrôle autoritaire du tour, du score et du temps par le serveur ;
- la reprise après une coupure réseau sans rejouer automatiquement une action ;
- la fin de partie, les statistiques et le replay.

## Jeu solo

Le mode solo utilise le même moteur de validation que le multijoueur. L’IA recherche des coups sur l’ensemble du plateau, réutilise les lettres déjà posées, contrôle les mots croisés, emploie les jokers et échange ses lettres lorsqu’aucun coup n’est disponible.

Trois niveaux réellement distincts sont proposés :

- **Découverte** : sélection volontairement imparfaite parmi les coups légaux ;
- **Intermédiaire** : choix varié dans le groupe des bons coups ;
- **Expert** : arbitrage entre score, qualité du chevalet restant et ouvertures offertes à l’adversaire.

Les parties solo peuvent être libres ou chronométrées.

## Comptes joueurs

Chaque joueur dispose d’un profil avec avatar, biographie, statistiques et historique récent. L’adresse e-mail facultative sert à la récupération du compte. Le changement de mot de passe révoque toutes les sessions actives.

En production, la réinitialisation utilise Resend. Configurer `RESEND_API_KEY`, `EMAIL_FROM` et `APP_URL`. Les réponses de demande restent volontairement identiques qu’un compte existe ou non afin d’empêcher l’énumération des utilisateurs.

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

Le client met en cache le dernier salon et le dernier état de partie, mais ne rejoue jamais automatiquement un coup. Les réponses API authentifiées ne sont pas stockées dans le cache partagé du service worker. Les mutations ont un identifiant idempotent et une version attendue.

Consulter [l’architecture](docs/ARCHITECTURE.md), [l’audit de parité](docs/FEATURE_PARITY_AUDIT.md), [les bases](docs/DATABASES.md), [la sécurité](docs/SECURITY.md), [les tests](docs/TESTING.md) et [le déploiement Vercel](docs/DEPLOYMENT_VERCEL.md).

## Licence

Voir [LICENSE](LICENSE).
