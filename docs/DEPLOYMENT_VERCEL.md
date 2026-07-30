# Déploiement Vercel

Créer une base MySQL externe, configurer `DB_TYPE=mysql`, `DATABASE_URL`, `AUTH_SECRET` et `APP_URL` dans Vercel, puis exécuter `npm run db:migrate` avec les mêmes variables avant le premier déploiement. Le build n’ouvre pas de connexion tant qu’une route n’est pas appelée.

Pour les rappels quotidiens, générer une paire VAPID une seule fois (`npx web-push generate-vapid-keys`), puis ajouter `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (une URL HTTPS ou `mailto:`) et un `CRON_SECRET` aléatoire aux variables Vercel. `vercel.json` déclenche `/api/cron/daily-push` chaque heure ; la route calcule l’heure locale de chaque joueur et enregistre un verrou unique par abonnement et par date locale avant l’envoi. Ainsi un retry du cron ne peut pas envoyer deux rappels le même jour. Les abonnements expirés (404/410) sont supprimés.

Sur iPhone/iPad, Web Push demande Safari 16.4+ et LexiForge doit d’abord être installée via « Partager → Sur l’écran d’accueil ». Le navigateur affiche cette instruction dans l’interface de réglage lorsqu’elle est pertinente.

Avant une mise à jour, sauvegarder la base. Pour revenir en arrière, redéployer le précédent commit uniquement si ses migrations restent compatibles ; les migrations sont additives. Diagnostiquer avec le journal Vercel et l’identifiant de requête fourni au client.
