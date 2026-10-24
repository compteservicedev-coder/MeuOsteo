# Gmail, Doctolib et rapprochement

## 1. Contexte et contraintes
- **Doctolib n'a pas d'API pour les praticiens** et ne propose ni flux iCal ni synchronisation officielle. Piloter le site par un robot est **exclu** : c'est contraire aux CGU, et il y a la double authentification.
- **Source retenue** : les **e-mails de notification Doctolib**, que la praticienne reçoit dans Gmail (nouveau RDV, modification, annulation).
- **Secours** : l'import manuel de l'export « Historique de RDV » (`.xlsx`) depuis Doctolib (voir §4).

## 2. Connexion Gmail (IMAP + SMTP, mot de passe d'application)
- **Prérequis côté Google** : la validation en deux étapes est activée, et un mot de passe d'application « MeuOsteo » a été créé. Un filtre Gmail range les messages dont l'expéditeur est Doctolib sous le libellé **`Doctolib`**.
- **IMAP** : `imap.gmail.com:993` en TLS avec `imapflow`. On ouvre **uniquement le dossier du libellé** (`Doctolib`), en lecture seule (`readOnly: true`) : aucun message n'est modifié, déplacé ni marqué comme lu.
- **Relève incrémentale** : on mémorise `UIDVALIDITY` et le dernier `UID` traité. Au premier lancement, on prend les 90 derniers jours.
- **Fréquence** : au démarrage, puis toutes les 5 minutes (réglable). En cas d'erreur réseau, on réessaie avec un délai croissant, sans fenêtre bloquante : seulement un indicateur d'état.
- **SMTP** : `smtp.gmail.com:465` avec `nodemailer`, en utilisant les mêmes identifiants, pour l'envoi des factures (PDF en pièce jointe).
- **Mot de passe** : chiffré avec `safeStorage`, il n'est jamais renvoyé au renderer. Le renderer ne voit que l'état « configuré oui / non ».
- **« Tester la connexion »** : trois vérifications, chacune affichée avec une coche :
  1. connexion IMAP ;
  2. nombre de messages trouvés dans le libellé ;
  3. envoi d'un e-mail de test à l'adresse elle-même.

## 3. Lecture des e-mails Doctolib (parseurs)
> ⚠️ **En attente** : des exemples réels anonymisés (`.eml`) de chaque type doivent être fournis par l'utilisatrice. **Ne pas inventer le format.** Coder le **cadre** et un parseur de test, et ne brancher les vrais parseurs qu'avec les fixtures réelles.

- **Organisation** : un registre de parseurs, `services/doctolibParser/*`. Chaque parseur fournit `canParse(mail)` et `parse(mail)`, qui renvoie `{ type: 'new'|'modified'|'cancelled', date, heure, ancienneDate?, ancienneHeure?, nom, telephone?, email?, motif? }`.
- **Sélection du parseur** : sur l'expéditeur, l'objet, puis les motifs du corps HTML ou texte (`mailparser`).
- **Tests** : sur les fixtures `.eml` anonymisées, rangées dans `tests/fixtures/doctolib/`. Ces fichiers sont fictifs, on remplace les données réelles avant de les committer.
- **E-mail non reconnu** : il est consigné dans les logs techniques sans son contenu (Message-ID et objet uniquement). Il est compté dans un indicateur « n e-mails non reconnus », et ne bloque rien.
- **Idempotence** : la clé `doctolib_rdv.key` est un hash de la date, de l'heure et de l'identité affichée. Retraiter un même e-mail ne change rien.

## 4. Import de l'export Doctolib (secours)
- **Fichier** : `.xlsx` « Historique de RDV », lu avec `exceljs`. Les colonnes sont repérées par leur **titre** (identifiant RDV, date, durée, motif, statut, honoraires, patient…), et non par leur position.
- **Traitement** : le résultat passe par le même pipeline de rapprochement (§5) que les e-mails.
- **Option** : surveiller le dossier Téléchargements pour importer automatiquement un fichier d'export dès qu'il y apparaît. Désactivée par défaut.
- **Jours bloqués** : vérifier sur un vrai export si les absences ou indisponibilités y figurent. Si oui, les importer en `blocages`. Sinon, les blocages restent saisis dans l'application (R-23).

## 5. Pipeline de rapprochement (R-09, R-18)
```
RDV reçu ─▶ normalisation (téléphone en chiffres, e-mail en minuscules, nom sans accents)
        ─▶ contact_memory ? ──oui──▶ patient
        ─▶ candidats = même nom ET (même téléphone OU même e-mail)
              1 candidat  ─▶ auto (si l'option est active)
              >1 candidats ─▶ tâche « Plusieurs fiches possibles »
              0 candidat  ─▶ tâche « Nouveau patient »
patient trouvé ─▶ séance du jour ? (non annulée)
              oui ─▶ rattacher (doctolib_key) + mettre à jour l'heure
              non ─▶ créer la séance planned/source=doctolib
type modifié  ─▶ déplacer la séance si elle n'est pas réalisée
type annulé   ─▶ séance cancelled (« Annulée sur Doctolib ») si elle n'est pas réalisée,
                 sinon tâche d'alerte
```
- **Clôture d'une tâche** : une fois résolue, la séance est créée ou rattachée tout de suite, et le planning se met à jour avec une animation.
- **Indice d'âge** : le motif peut faire penser à un enfant (`enfant`, `bébé`, `nourrisson`). Une alerte s'affiche alors sur les candidats adultes (cas « J. Moreau » de la maquette).

## 6. Ce que l'application ne fait pas
- **Écrire dans Doctolib** : impossible. Annuler un RDV ou bloquer un créneau se fait toujours dans Doctolib, et l'application le rappelle à chaque fois.
- **Lire d'autres messages** que ceux du libellé configuré.
