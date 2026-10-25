# MeuOsteo 2

Application de bureau Windows de suivi de patientèle pour un cabinet d'ostéopathie, qui remplace l'outil Excel VBA « MeuOsteo v1.04 ».

- **100 % local** : les données restent sur le PC, dans une base SQLite chiffrée.
- **Logiciels gratuits et open source uniquement.**
- **Développement dans GitHub avec Claude Code** : une GitHub Action produit l'installateur `.exe`.

## Avancement

| Lot                         | Contenu                                                              | État   |
| --------------------------- | -------------------------------------------------------------------- | ------ |
| 0 · Socle                   | Projet, base chiffrée, IPC typé, interface de base, code d'accès, CI | ✅     |
| 1 · Patients et fiche       | Recherche, fiche, séances, proches, journal, suppression             | ✅     |
| 2 · Reprise de l'historique | Import du `.xlsm` avec rapport, doublons R-19 et fusion              | ✅     |
| 3 · Facturation             | Émission, PDF, envoi Gmail, registre, avoirs, export comptable       | ✅     |
| 4 · Planning et Doctolib    | Planning, blocages, nouveau RDV, rapprochement, Gmail IMAP, export   | ✅ (1) |
| 5 · Pilotage et finitions   | Tableau de bord, sauvegarde et restauration, journal, export complet | ✅ (2) |

(1) Les vrais e-mails Doctolib ne sont pas encore lus : leur parseur attend des exemples `.eml` réels (seul un parseur de test existe). L'import de l'export Doctolib fonctionne.

(2) Pas de mise à jour automatique (`electron-updater`) : elle dépend du choix public ou privé du dépôt. Pour mettre à jour, réinstaller le nouvel `.exe` par-dessus : les données sont conservées.

Le détail des lots est dans `docs/ROADMAP.md`.

## Installer l'application (utilisatrice)

1. Sur GitHub, onglet **Actions**, ouvrir la dernière exécution verte de « Build Windows installer » et télécharger l'artefact **MeuOsteo-Setup** (fichier `MeuOsteo-Setup-x.y.z.exe`).
2. Lancer l'installateur. L'installateur n'est pas signé : Windows SmartScreen affiche un avertissement, cliquer sur « Informations complémentaires » puis « Exécuter quand même ».
3. Au premier lancement, MeuOsteo propose de choisir un **code d'accès** (4 à 6 chiffres), puis affiche une **clé de secours** à imprimer. Elle sert à réinitialiser le code en cas d'oubli et n'est affichée qu'une fois.

Les données sont dans `%APPDATA%\MeuOsteo` (base `meuosteo.db`, clé `meuosteo.key` protégée par Windows, factures PDF dans `factures\AAAA\`). Elles ne sont jamais dans le dossier d'installation, et une réinstallation par-dessus ne les touche pas.

**Sauvegardes** : une copie chiffrée `MeuOsteo_AAAA-MM-JJ_HHmm.mosave` est faite à chaque fermeture (par défaut dans `Documents\MeuOsteo Sauvegardes`, réglable dans Paramètres > Sauvegarde, idéalement vers une clé USB ou un dossier synchronisé). Pour restaurer sur un **autre** ordinateur, il faut la **clé de sauvegarde** : Paramètres > Sauvegarde > « Afficher la clé de sauvegarde… », à imprimer et ranger avec la clé de secours.

## Développer

Prérequis : **Node.js 22.12 ou plus récent**.

```bash
npm install
npm run seed      # base fictive : 200 patients, 600 séances (faker, locale fr)
npm run dev       # application en mode développement (F12 : outils de développement)
```

| Commande                 | Rôle                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Lance l'application avec rechargement à chaud                                                                                   |
| `npm run build`          | Compile `main`, `preload` et `renderer` dans `out/`                                                                             |
| `npm run dist`           | Produit l'installateur dans `dist/` (`npm run dist -- --win --x64` sous Windows)                                                |
| `npm test`               | Tests Vitest (règles métier, base, composants)                                                                                  |
| `npm run lint`           | ESLint                                                                                                                          |
| `npm run typecheck`      | TypeScript strict, process main et renderer                                                                                     |
| `npm run format`         | Prettier                                                                                                                        |
| `npm run seed`           | Remplit la base de développement avec des données fictives. Refuse une base déjà remplie, sauf `npm run seed -- --reset`        |
| `npm run e2e`            | Parcours critique Playwright sur l'application compilée, dans un dossier de données jetable (Linux : `xvfb-run -a npm run e2e`) |
| `npm run make:fake-xlsm` | Écrit un classeur MeuOsteo v1.04 fictif (`MeuOsteo_fictif.xlsm`) pour essayer l'import                                          |
| `npm run db:generate`    | Génère une migration Drizzle après une modification de `src/main/db/schema.ts`                                                  |

En développement, les données vont dans `%APPDATA%\MeuOsteo-dev` (ou `~/.config/MeuOsteo-dev`), jamais dans le dossier de l'application installée : `npm run seed` ne peut pas toucher aux vraies données.

> ⚠️ Aucune donnée réelle de patient ne doit jamais être poussée sur GitHub (voir `CLAUDE.md`).

### Organisation du code

```
src/
  main/        process principal : base (db/), IPC (ipc/), services (services/)
  preload/     window.api, typé, sans accès Node pour le renderer
  renderer/    React : routes/, components/, features/<domaine>/, hooks/
  shared/
    domain/    règles métier pures et testées (R-xx)
    types/     contrat IPC et schémas Zod partagés
resources/communes.csv
```

- **Base** : SQLite chiffrée au format SQLCipher 4 (`better-sqlite3-multiple-ciphers`). La clé de 256 bits est générée au premier lancement et stockée chiffrée par `safeStorage` (DPAPI). Elle ne dépend pas du code d'accès.
- **IPC** : chaque canal est décrit dans `src/shared/types/ipc.ts`. Le process main vérifie l'origine de l'appel, valide les arguments avec Zod et refuse les données tant que l'interface est verrouillée.
- **Interface** : Tailwind (tokens de `docs/DESIGN.md` dans `tailwind.config.ts`), Radix UI, Framer Motion, police Figtree embarquée.

## Contenu de la documentation

| Fichier                       | Rôle                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `CLAUDE.md`                   | Consignes permanentes pour Claude Code (stack, conventions, interdits)                 |
| `docs/SPEC.md`                | Spécification fonctionnelle : écrans, règles métier numérotées, critères d'acceptation |
| `docs/DATA_MODEL.md`          | Schéma SQLite et règles d'intégrité                                                    |
| `docs/MIGRATION.md`           | Reprise de l'historique depuis le fichier Excel `.xlsm`                                |
| `docs/GMAIL_DOCTOLIB.md`      | Synchronisation des RDV Doctolib par Gmail, envoi des factures, rapprochement          |
| `docs/DESIGN.md`              | Charte : couleurs, typographie, relief, animations, accessibilité                      |
| `docs/ROADMAP.md`             | Découpage en lots, avec ordre et critères de fin                                       |
| `docs/maquette/`              | Sources de la maquette interactive validée (référence visuelle)                        |
| `resources/communes.csv`      | 35 576 couples commune / code postal, issus de l'outil actuel                          |
| `.github/workflows/build.yml` | Compilation de l'installateur Windows                                                  |

## Maquette

La maquette interactive (8 écrans) se consulte sur claude.ai : https://claude.ai/artifact/JGyPUB5csPpxNqpd5fTYNm (privée, à partager depuis le menu Partager). Les fichiers `docs/maquette/*.dc.html` en sont les sources : on y retrouve les textes, les styles exacts et la logique d'interaction.
