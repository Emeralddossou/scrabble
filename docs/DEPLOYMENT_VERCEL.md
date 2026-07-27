# Déploiement Vercel

Créer une base MySQL externe, configurer `DB_TYPE=mysql`, `DATABASE_URL`, `AUTH_SECRET` et `APP_URL` dans Vercel, puis exécuter `npm run db:migrate` avec les mêmes variables avant le premier déploiement. Le build n’ouvre pas de connexion tant qu’une route n’est pas appelée.

Avant une mise à jour, sauvegarder la base. Pour revenir en arrière, redéployer le précédent commit uniquement si ses migrations restent compatibles ; les migrations sont additives. Diagnostiquer avec le journal Vercel et l’identifiant de requête fourni au client.
