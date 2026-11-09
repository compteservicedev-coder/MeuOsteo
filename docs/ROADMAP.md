# Feuille de route : lots de développement

Chaque lot est livrable : une PR, la CI au vert, un `.exe` téléchargeable, puis un test sur le PC. L'ordre est conçu pour que l'application soit utilisable le plus tôt possible (après le lot 3).

## Lot 0 · Socle
- **Projet** : Electron, electron-vite, React, TypeScript strict, Tailwind avec les tokens DESIGN.md, Figtree embarquée, ESLint, Prettier, Vitest.
- **Base** : SQLite chiffrée (`better-sqlite3-multiple-ciphers`), clé protégée par `safeStorage`, Drizzle avec une première migration (schéma complet de DATA_MODEL.md), chargement de `communes.csv`.
- **Échanges** : IPC typé (`preload`, `window.api`), et `npm run seed` qui génère 200 patients fictifs et 600 séances.
- **Interface de base** : mise en page avec le menu latéral (ordre de SPEC §1), routes vides, notifications, bibliothèque de composants (Button, Field, Segmented, Switch, Card, Dialog, Drawer, Badge) avec les animations de DESIGN.md.
- **Accès** : écran d'ouverture et code d'accès (R-21), verrouillage après inactivité.
- **CI** : `.github/workflows/build.yml` produit `MeuOsteo-Setup-x.y.z.exe`.

**Fin** : l'exe s'installe, s'ouvre sur l'animation puis le code, la base est créée dans `%APPDATA%/MeuOsteo`, et les tests R-21 passent.

## Lot 1 · Patients et fiche
- **Écran Patients** (SPEC §4) : recherche rapide et « Consultés récemment ».
- **Fiche** (SPEC §5) :
  - bandeau, panneau d'édition avec validations R-15, R-16 et R-17 ;
  - séances : statuts R-01, validation R-02, modification R-03, garde R-05, annulation et suppression R-06 / R-07, unicité R-08 ;
  - commentaire inter-séances avec enregistrement automatique ;
  - proches liés R-25 (table `patient_links`, navigation de fiche en fiche, « Revenir à… »).
- **Journal** R-20 (patient, verrouillage), avec le bouton « Historique ».
- **Suppression du patient** R-14 (suppression douce et purge).

**Fin** : le parcours complet fonctionne sur les données fictives, et les tests R-01 à R-08, R-14 à R-17 et R-25 passent.

## Lot 2 · Reprise de l'historique
- **Import `.xlsm`** (MIGRATION.md) : rapport d'anomalies, transaction unique, journal.
- **Doublons** : détection R-19 après l'import, avec l'écran de fusion (préparé dans ce lot, visible dans « À rapprocher »).

**Fin** : le `.xlsm` fictif s'importe avec un rapport exact, et l'utilisatrice importe son vrai fichier sur son PC.

## Lot 3 · Facturation ✅ *(utilisable au quotidien à partir d'ici)*
- **Émission** depuis la séance (SPEC §5.5) : R-10, numérotation R-11, instantané R-12, PDF avec `printToPDF`, archivage.
- **Envoi** : configuration Gmail en SMTP (onglet Messagerie, partie envoi) et envoi du PDF.
- **Déverrouillage** R-04, avec marquage « modifiée » et régénération du PDF.
- **Registre Factures** (SPEC §6) avec TanStack Table : tri, filtre, regroupement et étiquettes de filtre. Ouverture filtrée depuis la fiche. Suppression R-13 avec avoir caché. Export comptable.
- **Paramètres** : onglet Cabinet & factures.

**Fin** : on émet, on envoie, on supprime et on refacture. La numérotation est continue sous test : concurrence et transaction, aucun numéro perdu.

## Lot 4 · Planning
- **Planning sur deux semaines** (SPEC §3) : navigation, calendrier, blocages R-23, fenêtre « Nouveau RDV » R-24 (grille de créneaux libres).
- **Paramètres** : onglet Messagerie Gmail (envoi, test en 2 étapes), onglet Agenda.
- *Retiré en 0.2.0* : synchronisation des RDV Doctolib par Gmail (IMAP), import de l'export Doctolib et rapprochement R-09 / R-18.

## Lot 5 · Pilotage et finitions
- **Tableau de bord** (SPEC §7).
- **Sauvegarde et restauration** R-22, avec l'alerte des 7 jours.
- **Paramètres** : onglets Journal, Données & import (export complet).
- **Mises à jour** : publication sur GitHub Releases et signalement des nouvelles versions dans l'application (R-28).
- **Contrôles finaux** : passe d'accessibilité et de performance (5 000 patients fictifs), et tests Playwright des parcours critiques : ouverture → séance → facture → envoi.

## Questions en attente (à demander à l'utilisatrice)
1. **Informations du cabinet** pour la facture : nom, adresse, ADELI, SIRET, signature.
2. **Facturation de l'historique** : faut-il permettre de facturer des séances anciennes importées ? Choix par défaut : oui, la date d'émission étant celle du jour.
3. **Dépôt GitHub** : public ou privé ? Cela décide des mises à jour automatiques.
