# CLAUDE.md — consignes pour Claude Code

Ces consignes valent pour toute personne qui contribue au projet, humaine ou assistant IA (le projet est développé avec Claude Code). Voir aussi `CONTRIBUTING.md`.

## Le projet
MeuOsteo 2 est une application de bureau **Windows**, **hors ligne**, pour une ostéopathe qui travaille seule. Elle gère les patients, les séances, la facturation, le planning, l'envoi des factures par Gmail, un tableau de bord et une sauvegarde.

Lire dans l'ordre : `docs/ROADMAP.md` (le lot en cours), `docs/SPEC.md`, puis le document technique qui concerne le lot. La maquette `docs/maquette/*.dc.html` fait référence pour l'interface : textes, couleurs, comportements.

## Interdits absolus
- **Ne jamais committer de données réelles** : pas de patients, pas de fichiers `.xlsm` / `.xlsx` / `.db` / `.eml` réels. Utiliser uniquement des données fictives générées (`npm run seed`, avec `@faker-js/faker` en locale `fr`). `.gitignore` doit exclure `*.db`, `*.xlsm`, `*.eml`, `data/`, `backups/`.
- **Aucune télémétrie, aucun service distant** en dehors de Gmail (SMTP, envoi uniquement) et, en option, de la vérification de mise à jour sur GitHub Releases.
- **Dépendances gratuites et open source uniquement** (MIT, Apache-2.0, BSD, ISC…).
- **Pas de contenu médical dans les logs.** Ni dans le journal métier, ni dans les logs techniques (`electron-log`) : jamais d'anamnèse, de pratique, de commentaire ni de motif. Les identifiants techniques sont autorisés.

## Stack (imposée)
- **Electron**, packagé avec **electron-vite**. Process `main`, `preload`, `renderer`.
- **React 18 + TypeScript strict** côté renderer, **Tailwind CSS**, avec les tokens de `docs/DESIGN.md` dans `tailwind.config`. Primitives accessibles **Radix UI** : Dialog, Popover, Tabs, Switch. Animations : **Framer Motion**.
- **Formulaires** : React Hook Form + Zod. **Tableaux** : TanStack Table pour les factures (tri, filtre, regroupement).
- **Base** : SQLite via `better-sqlite3-multiple-ciphers` (chiffrement SQLCipher), ORM **Drizzle**, migrations `drizzle-kit`. La base vit **uniquement dans le process main**.
- **E-mail** : `nodemailer` (envoi SMTP) ; `mailparser` pour afficher les `.eml` rangés dans les documents.
- **PDF** : gabarit React rendu dans une fenêtre cachée, puis `webContents.printToPDF`.
- **Excel** : `exceljs`, pour l'import de l'historique `.xlsm` et les exports.
- **Secrets** : `safeStorage` d'Electron (DPAPI sous Windows) pour le mot de passe Gmail et la clé de base. Le code d'accès est stocké en hash `scrypt` avec sel.
- **Build** : `electron-builder`, cible NSIS Windows x64. CI : `.github/workflows/build.yml`.
- **Tests** : Vitest pour la logique métier et les parseurs. Playwright pour Electron, sur les parcours critiques à partir du lot 3.

## Architecture
```
src/
  main/            # process principal : db, ipc, mail, pdf, backup, scheduler
    db/            # schema.ts (Drizzle), migrations/, repositories/
    ipc/           # handlers typés, un fichier par domaine
    services/      # mailer, invoicePdf, backup, journal, planning, documents
  preload/         # contextBridge : expose window.api (typé, aucun accès Node direct)
  renderer/        # React : routes/, components/, features/<domaine>/, hooks/
  shared/
    domain/        # règles métier PURES et testées (statuts, numérotation, validations, matching)
    types/         # types partagés main/renderer, schémas Zod
resources/communes.csv
```
- `contextIsolation: true`, `nodeIntegration: false`, sandbox activé. Le renderer passe uniquement par `window.api.*`.
- Chaque règle métier `R-xx` de `docs/SPEC.md` est implémentée dans `shared/domain`, avec au moins un test qui porte son numéro dans le nom (`it('R-11 numérotation continue…')`).
- Les écritures liées entre elles (émission de facture, fusion, import) se font dans **une transaction**.
- Dossier des données : `app.getPath('userData')` (`%APPDATA%/MeuOsteo`). La base n'est jamais placée dans le dossier d'installation.

## Conventions
- **Langue** : code, noms de fichiers et commits en anglais. **Interface utilisateur entièrement en français**, avec les libellés exacts de la maquette quand ils existent. Dates `JJ/MM/AAAA`, montants `60,00 €`, fuseau Europe/Paris.
- **Montants** stockés en **centimes entiers**. **Dates** stockées en ISO (`YYYY-MM-DD`, `HH:mm`).
- **Accessibilité** : vrais `<button>` et `<label>`, cibles de 44 px minimum, contraste AA, focus visible (anneau cyan), `prefers-reduced-motion` respecté.
- **Commits** : style Conventional Commits. Une PR par lot ou sous-lot, avec la description des règles couvertes.

## Commandes attendues
`npm run dev` · `npm run build` · `npm run dist` (exe local) · `npm test` · `npm run lint` · `npm run typecheck` · `npm run seed` (base fictive) · `npm run db:generate` (migrations)

## Définition de « terminé » pour un lot
- [ ] Les critères d'acceptation du lot (`docs/ROADMAP.md`) sont vérifiés.
- [ ] `npm test`, `lint` et `typecheck` sont au vert, et la CI produit l'exe.
- [ ] Les nouvelles règles ont leurs tests.
- [ ] Aucune donnée réelle n'est versionnée.
- [ ] Le README est mis à jour si une commande change.
