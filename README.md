# MeuOsteo 2

> **English summary** — MeuOsteo is a free, offline Windows desktop application for solo osteopaths: patient records, sessions, invoices (PDF, sent by Gmail), a weekly planning, documents, a monthly statement and encrypted backups. All data stays on the computer in an encrypted SQLite database (SQLCipher). Built with Electron, React and TypeScript. The user interface and the documentation are in French. Licensed under the GNU AGPL-3.0.

Application de bureau Windows de suivi de patientèle pour un cabinet d'ostéopathie, qui remplace l'outil Excel VBA « MeuOsteo v1.04 ». Logiciel libre sous licence [GNU AGPL-3.0](LICENSE).

> ### ⬇️ [Télécharger MeuOsteo pour Windows](https://github.com/compteservicedev-coder/Repo1/releases/latest)
>
> Gratuit, sans compte ni abonnement. Première installation : suivez le **[guide d'installation](docs/INSTALLATION.md)** (20 à 30 minutes, réglage de Gmail compris).

**Pour découvrir le projet côté métier** (besoin, fonctions, principes, limites) : [docs/PRESENTATION.md](docs/PRESENTATION.md).

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
| 4 · Planning                | Planning, blocages, nouveau RDV, doublons à rapprocher               | ✅ (1) |
| 5 · Pilotage et finitions   | Tableau de bord, sauvegarde et restauration, journal, export complet | ✅ (2) |

(1) La lecture des RDV Doctolib (e-mails Gmail et export) a été retirée en 0.2.0 pour garder l'outil simple : Gmail sert uniquement à l'envoi.

(2) Pas de mise à jour automatique (`electron-updater`) : elle dépend du choix public ou privé du dépôt. Pour mettre à jour, réinstaller le nouvel `.exe` par-dessus : les données sont conservées.

Le détail des lots est dans `docs/ROADMAP.md`.

## Installer l'application (utilisatrice)

1. Télécharger `MeuOsteo-Setup-x.y.z.exe` sur la page **[Releases](https://github.com/compteservicedev-coder/Repo1/releases/latest)** (dernière version).
2. Suivre le **[guide d'installation](docs/INSTALLATION.md)** : avertissements de Windows, code d'accès, réglages du cabinet, Gmail, sauvegardes, mises à jour.

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

| Fichier                       | Rôle                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                   | Consignes permanentes pour les contributeurs et les assistants IA (stack, interdits)                  |
| `CHANGELOG.md`                | Journal des versions : les nouveautés de chaque version publiée, reprises sur la page Releases        |
| `docs/INSTALLATION.md`        | Mode opératoire pour une nouvelle utilisatrice : téléchargement, installation, réglages, mises à jour |
| `docs/PRESENTATION.md`        | Présentation métier : le besoin, ce que fait l'application, ses principes et ses limites              |
| `docs/SPEC.md`                | Spécification fonctionnelle : écrans, règles métier numérotées, critères d'acceptation                |
| `docs/DATA_MODEL.md`          | Schéma SQLite et règles d'intégrité                                                                   |
| `docs/MIGRATION.md`           | Reprise de l'historique depuis le fichier Excel `.xlsm`                                               |
| `docs/GMAIL.md`               | Envoi des factures et des e-mails aux patients par Gmail                                              |
| `docs/DESIGN.md`              | Charte : couleurs, typographie, relief, animations, accessibilité                                     |
| `docs/ROADMAP.md`             | Découpage en lots, avec ordre et critères de fin                                                      |
| `docs/maquette/`              | Sources de la maquette interactive validée (référence visuelle)                                       |
| `resources/communes.csv`      | 35 576 couples commune / code postal, issus de l'outil actuel                                         |
| `.github/workflows/build.yml` | Compilation de l'installateur Windows                                                                 |

## Maquette

Les fichiers `docs/maquette/*.dc.html` sont les sources de la maquette interactive validée (8 écrans) : on y retrouve les textes, les styles exacts et la logique d'interaction.

## Contribuer

Les contributions sont les bienvenues : voir [CONTRIBUTING.md](CONTRIBUTING.md) et le [code de conduite](CODE_OF_CONDUCT.md). Une faille de sécurité se signale **en privé**, jamais dans une issue publique : voir [SECURITY.md](SECURITY.md).

## Avertissement

MeuOsteo est fourni **tel quel, sans aucune garantie** (voir la licence). Ce n'est ni un dispositif médical, ni un logiciel certifié, et il n'est pas hébergé : chaque praticien qui l'utilise reste responsable de ses données au sens du RGPD (sécurité du poste, sauvegardes, durée de conservation, droits des patients) et de ses obligations de facturation. Le calcul « Épargne & salaire » est une aide, pas un conseil comptable ou fiscal.

## Licence

Copyright © 2026 les contributeurs de MeuOsteo.

Ce programme est un logiciel libre : vous pouvez le redistribuer et le modifier selon les termes de la **GNU Affero General Public License** telle que publiée par la Free Software Foundation, version 3 de la licence ou (à votre choix) toute version ultérieure. Il est distribué dans l'espoir qu'il sera utile, mais **sans aucune garantie**. Le texte complet est dans [LICENSE](LICENSE).

En résumé : toute version modifiée que vous distribuez, ou que vous mettez à disposition d'autres personnes par un réseau (version en ligne), doit être publiée sous la même licence avec son code source.
