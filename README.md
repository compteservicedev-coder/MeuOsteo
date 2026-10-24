# MeuOsteo 2

Application de bureau Windows de suivi de patientèle pour un cabinet d'ostéopathie, qui remplace l'outil Excel VBA « MeuOsteo v1.04 ».

- **100 % local** : les données restent sur le PC, dans une base SQLite chiffrée.
- **Logiciels gratuits et open source uniquement.**
- **Développement dans GitHub avec Claude Code** : une GitHub Action produit l'installateur `.exe`.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `CLAUDE.md` | Consignes permanentes pour Claude Code (stack, conventions, interdits) |
| `docs/SPEC.md` | Spécification fonctionnelle : écrans, règles métier numérotées, critères d'acceptation |
| `docs/DATA_MODEL.md` | Schéma SQLite et règles d'intégrité |
| `docs/MIGRATION.md` | Reprise de l'historique depuis le fichier Excel `.xlsm` |
| `docs/GMAIL_DOCTOLIB.md` | Synchronisation des RDV Doctolib par Gmail, envoi des factures, rapprochement |
| `docs/DESIGN.md` | Charte : couleurs, typographie, relief, animations, accessibilité |
| `docs/ROADMAP.md` | Découpage en lots, avec ordre et critères de fin |
| `docs/maquette/` | Sources de la maquette interactive validée (référence visuelle) |
| `resources/communes.csv` | 35 576 couples commune / code postal, issus de l'outil actuel |
| `.github/workflows/build.yml` | Compilation de l'installateur Windows |

## Maquette

La maquette interactive (8 écrans) se consulte sur claude.ai : https://claude.ai/artifact/JGyPUB5csPpxNqpd5fTYNm (privée, à partager depuis le menu Partager). Les fichiers `docs/maquette/*.dc.html` en sont les sources : on y retrouve les textes, les styles exacts et la logique d'interaction.

## Démarrer avec Claude Code

1. Créer un dépôt GitHub (privé ou public) et y déposer ce dossier.
2. Ouvrir Claude Code sur le dépôt et lui demander : « Lis CLAUDE.md et docs/ROADMAP.md, puis réalise le lot 0. »
3. Avancer lot par lot. À chaque lot : une PR, les tests au vert, un `.exe` généré par la CI, puis un test réel sur le PC.

> ⚠️ Aucune donnée réelle de patient ne doit jamais être poussée sur GitHub (voir `CLAUDE.md`).
