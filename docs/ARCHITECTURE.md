# Architecture

`domain/scrabble` contient le plateau officiel, les tuiles et les règles sans I/O. `server/game` orchestre les transactions, l’idempotence, le minuteur, les suggestions et le bot. `server/db` fournit les adaptateurs SQLite/libSQL et MySQL, ainsi que les migrations. Les routes `app/api` valident les entrées Zod et ne retournent que des erreurs publiques stables.

Le polling adaptatif est l’option temps réel par défaut : il reste compatible avec les fonctions Vercel, sans WebSocket permanent ni abonnement tiers.
