# Sécurité

Les mots de passe sont hachés avec scrypt et les sessions sont des jetons opaques hachés en base. Elles expirent après deux heures d’inactivité et une modification de mot de passe révoque toutes les sessions. Les mutations vérifient l’origine, les entrées Zod, l’utilisateur et l’autorisation. Connexion, inscription et invitations sont limitées en débit ; cinq échecs de connexion verrouillent temporairement l’identifiant.

`AUTH_SECRET` est obligatoire, aléatoire et long d’au moins 32 caractères. Les erreurs API incluent un identifiant de requête mais jamais une trace ou une erreur SQL.
