# Bases de données

SQLite : `DB_TYPE=sqlite` et `DATABASE_URL=file:./data/scrabble.db`. Il convient au développement et à un hôte Node avec disque persistant.

MySQL : `DB_TYPE=mysql` et une URL `mysql://utilisateur:motdepasse@hote:3306/scrabble`. C’est la configuration de production Vercel recommandée.

Exécuter `npm run db:migrate` avant de démarrer. SQLite sur le système de fichiers n’est pas persistant sur Vercel ; ne pas l’utiliser en production serverless.
