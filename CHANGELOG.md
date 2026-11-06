# Journal des versions

Les nouveautés de chaque version publiée, en résumé. Le texte de la section d'une version est repris sur sa page **Releases**.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), numérotation [SemVer](https://semver.org/lang/fr/).

## [0.2.0] - 2026-11-06

Première version publiée : l'application couvre le quotidien du cabinet.

### Nouveautés

- **Patients et séances** : recherche rapide, liste de tous les patients, fiche avec proches liés, commentaire inter-séances, séances verrouillées une fois réalisées.
- **Facturation** : notes d'honoraires PDF numérotées sans trou, envoi par Gmail, impression, registre filtrable, avoirs, export comptable.
- **Planning** : rendez-vous Doctolib lus dans Gmail ou importés depuis l'export Doctolib, blocages, rendez-vous hors Doctolib, cas « À rapprocher ».
- **Documents du patient** : radios, comptes-rendus, courriers et e-mails rangés dans la fiche, chiffrés avec la base.
- **Bilan mensuel** : encaissements du mois, récapitulatif par moyen de paiement, calcul « Épargne & salaire », export Excel.
- **Reprise de l'historique** du classeur Excel MeuOsteo v1.04, avec rapport des anomalies ; séances importées visibles dans le planning.
- **Tableau de bord**, **sauvegardes chiffrées** à chaque fermeture et restauration, **journal**, **Aide & FAQ** intégrée.
- **Nouvelle version** : l'application signale quand une version plus récente est disponible (désactivable dans Paramètres > Données & import).

### Sécurité

- Base et sauvegardes chiffrées (SQLCipher), code d'accès, verrouillage automatique.
- Programmes et scripts refusés dans les documents ; exports CSV protégés contre les formules Excel ; aucun nom de patient dans le journal technique.
- Installateur durci (verrous Electron), Electron 45.

### Limites connues

- Installateur non signé : le navigateur et Windows affichent un avertissement (voir le [guide d'installation](docs/INSTALLATION.md)).
- Les e-mails Doctolib réels ne sont pas encore reconnus : le planning se remplit par l'import de l'export Doctolib en attendant.

[0.2.0]: https://github.com/compteservicedev-coder/Repo1/releases/tag/v0.2.0
