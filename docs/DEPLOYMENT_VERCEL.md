# Déploiement Vercel

1. Importer `Emeralddossou/scrabble` dans Vercel.
2. Configurer les variables :
   - `DB_TYPE=mysql`
   - `DATABASE_URL=mysql://...`
   - `AUTH_SECRET` avec au moins 32 caractères aléatoires
   - `APP_URL` avec l'URL publique
3. Déployer. Vercel détecte Next.js automatiquement.

Le schéma est initialisé au premier appel. La base MySQL doit accepter les connexions TLS depuis les fonctions Vercel.

## Local avec SQLite

```bash
cp .env.example .env.local
# Décommenter DB_TYPE=sqlite et DATABASE_URL=file:./data/scrabble-v2.db
npm install
npm run dev
```

## Vérifications

```bash
npm run typecheck
npm test
npm run build
```

Les mots de passe de l'ancienne version PHP ne sont pas automatiquement migrés. Une migration de production doit importer les utilisateurs puis déclencher une réinitialisation sécurisée des mots de passe.
