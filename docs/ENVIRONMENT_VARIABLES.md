# Variables d’environnement

```env
DB_TYPE=sqlite
DATABASE_URL=file:./data/scrabble.db
AUTH_SECRET=une-valeur-aleatoire-de-plus-de-32-caracteres
APP_URL=http://localhost:3000

# Web Push (générer une seule paire : npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=clé-publique-vapid
VAPID_PRIVATE_KEY=clé-privée-vapid
VAPID_SUBJECT=mailto:admin@example.com
CRON_SECRET=secret-aléatoire-long-pour-le-cron
```

Pour Vercel, remplacer SQLite par `DB_TYPE=mysql` et une URL MySQL externe.

`VAPID_PUBLIC_KEY` est la seule clé lue par le navigateur. `VAPID_PRIVATE_KEY` et `CRON_SECRET`
restent uniquement dans les variables d’environnement du serveur. La route cron refuse toute requête
sans en-tête `Authorization: Bearer $CRON_SECRET`.
