# Politique de sécurité

MeuOsteo gère des données de santé : la sécurité est prioritaire.

## Signaler une faille

**Ne publiez jamais une faille dans une issue, une discussion ou une pull request publique.**

Signalez-la en privé avec la fonction GitHub **« Report a vulnerability »** (onglet _Security_ du dépôt, puis _Advisories_). Indiquez :

- la version de MeuOsteo concernée (Paramètres > Données & import) ;
- les étapes pour reproduire le problème ;
- l'impact estimé (lecture de données, exécution de code, contournement du code d'accès…).

N'envoyez **aucune donnée réelle de patient**, même pour illustrer le problème : utilisez la base fictive (`npm run seed`).

Nous accusons réception sous 7 jours et visons un correctif sous 30 jours pour une faille grave. Une fois le correctif publié, la faille est décrite dans un avis de sécurité, avec votre nom si vous le souhaitez.

## Versions suivies

Seule la dernière version publiée reçoit des correctifs de sécurité. Installez-la par-dessus l'ancienne : les données sont conservées.

## Ce qui est dans le périmètre

- l'application installée (process principal, interface, pont IPC) ;
- le chiffrement de la base et des sauvegardes, la gestion des clés et du code d'accès ;
- la lecture des fichiers importés (Excel, e-mails, documents) ;
- la chaîne de construction (`.github/workflows`, dépendances).

Ne sont pas dans le périmètre : un attaquant qui contrôle déjà la session Windows de la praticienne (la clé de la base est protégée par cette session), et les services tiers (Gmail, Doctolib).

## Choix de sécurité du projet

Ils sont décrits dans `README.md` (section « Organisation du code ») et `CLAUDE.md` : base SQLCipher avec une clé de 256 bits protégée par Windows (DPAPI), renderer isolé (`contextIsolation`, `sandbox`, CSP), arguments IPC validés par Zod, aucune télémétrie, verrous Electron (_fuses_) dans l'installateur.
