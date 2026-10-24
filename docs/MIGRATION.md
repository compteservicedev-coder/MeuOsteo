# Reprise de l'historique depuis MeuOsteo v1.04 (.xlsm)

> L'import s'exécute **uniquement sur le PC de l'utilisatrice**, depuis Paramètres > Données & import. Le fichier réel ne doit jamais aller dans le dépôt. Pour les tests, générer un `.xlsm` fictif de même structure (`scripts/make-fake-xlsm.ts`).

## Structure du fichier source (analysée)
- **Feuille `TEMP_BDD`**, qui contient deux tableaux structurés :
  - `Tb_seance`, plage `B2:I…` : colonnes `date`, `motif`, `anam`, `pratique`, `prix`, `paiement`, `praticien`, `id_patient`.
  - `Tb_patient`, plage `L2:Z…` : colonnes `id_patient`, `nom`, `prenom`, `ddn`, `sexe`, `situation`, `enfant`, `profession`, `adresse`, `cdp`, `commune`, `portable`, `fixe`, `mail`, `commentaire`.
- **Feuille `PARAM`** : listes de référence. Prix : 0, 50, 55, 60, 65, 110. Paiement : Espèces, Chèque, Attente de Virement, Virement reçu. Situation : Célibataire, En couple, Pacsé(e), Marié(e), Divorcé(e), Veuf(ve). Sexe : Homme, Femme.
- **Feuille `DATA`** : la base des communes (déjà extraite dans `resources/communes.csv`).
- **Volumétrie de la version analysée** : 299 patients, 512 séances. La version utilisée au quotidien est plus récente et plus fournie. **L'import doit lire les tableaux par leur nom** (`Tb_patient`, `Tb_seance`) et ne pas supposer de plage fixe.

## Correspondance des champs
| Source | Cible | Transformation |
|---|---|---|
| `id_patient` (`NomPrenomJJ/MM/AAAA`) | `patients.legacy_key` | conservé pour le rattachement des séances |
| `nom`, `prenom` | `nom`, `prenom` | espaces superflus retirés |
| `ddn` (texte `JJ/MM/AAAA`) | `ddn` ISO | analyse stricte, sinon anomalie |
| `sexe` Homme / Femme / vide | `M` / `F` / NULL | |
| `situation` | code (voir DATA_MODEL) | correspondance des libellés |
| `enfant` (texte « 2 », vide) | INTEGER / NULL | |
| `cdp`, `commune` | `cp` (5 chiffres, avec 0 devant si besoin), `commune` | |
| `portable`, `fixe` | chiffres seuls | |
| `mail` | `email` | minuscules |
| `commentaire` | `commentaire` | |
| séance `date` (texte `JJ/MM/AAAA`) | `seances.date` | anomalie si invalide |
| `motif`, `anam`, `pratique` | `motif`, `anamnese`, `pratique` | |
| `prix` (entier en €) | `tarif_cents` | × 100 ; vide → valeur par défaut avec anomalie |
| `paiement` | `especes` / `cheque` / `virement_attente` / `virement_recu` / NULL | « Attente de Virement » → `virement_attente` |
| `praticien` | ignoré | toujours vide |
| — | `status = 'done'`, `source = 'import'` | séances importées = réalisées, non facturées |

## Anomalies connues, à présenter dans le rapport avant import
- **Années invalides** : par exemple « 1024 » et « 4444 », ou plus généralement une date hors de la plage 1990 – aujourd'hui+1 an. Elles sont listées, avec correction possible ligne par ligne ou import en « date à corriger ».
- **Séances sans date** : 2 cas, et des séances sans prix (environ 19). Les lister.
- **Séances orphelines** (`id_patient` inconnu) : à lister. Aucune dans la version analysée.
- **Doublons potentiels** entre patients : la règle R-19 est appliquée après l'import, et les cas trouvés partent dans « À rapprocher ».
- **Unicité** : deux séances pour un même patient et un même jour sont conservées toutes les deux (exception à R-08 pour l'import), et signalées.

## Déroulé dans l'interface
1. **Choix du fichier** `.xlsm`, puis analyse sans rien écrire, avec un indicateur de progression.
2. **Rapport** : nombre de patients et de séances, liste des anomalies, doublons possibles, champs ignorés.
3. **« Importer »** : une seule transaction, puis une ligne de journal « Historique importé : N patients, M séances ».
4. **Garde-fou** : l'import est refusé si la base contient déjà des patients, sauf en mode « fusion » (mise à jour par `legacy_key`), prévu en option ultérieure.

## Tests
Le fichier `.xlsm` fictif contient des cas pièges : date invalide, prix vide, code postal à 4 chiffres, sexe vide, situation avec accent, apostrophes. Les tests vérifient chaque transformation, ainsi que les comptes affichés dans le rapport.
