# Spécification fonctionnelle — MeuOsteo 2

**Utilisatrice** : une ostéopathe libérale qui travaille seule, sur un PC portable Windows (petit écran, 1366×768 minimum). L'application est utilisée tous les jours, entre deux séances.

**Principe** : rapide, sûre, sans saisie en double. Le planning vient de Doctolib, la fiche patient est au centre, et une facture part d'une séance.

**Référence visuelle** : `docs/maquette/` (le nom du fichier est indiqué pour chaque écran).

---

## 1. Navigation générale

**Menu latéral** (sombre, voir DESIGN.md), dans l'ordre :
1. **Planning** : l'écran d'arrivée.
2. **Patients**.
3. **Factures**.
4. **Tableau de bord**.
5. **Bilan mensuel** (R-27).
6. *(en bas)* **Aide & FAQ**, **Paramètres**, puis l'indicateur « Sauvegarde auto · il y a X min ».

Le menu Planning affiche un badge avec le nombre de cas « À rapprocher ».

**Raccourcis clavier** :
- `Ctrl+K` : recherche patient, depuis n'importe quel écran.
- `Ctrl+S` : enregistrer la séance en cours.
- `Échap` : fermer la fenêtre ouverte.

**Notifications (« toasts »)** : en bas à droite. Elles disparaissent seules après 3 s, et chaque action importante en affiche une.

**Petit écran** : sous 1100 px de large, le menu se réduit aux icônes. Les colonnes passent à la ligne, et les tableaux défilent horizontalement dans leur cadre.

---

## 2. Écran d'ouverture et code d'accès (`Splash.dc.html`)

1. **Animation** (environ 2,5 s) : halos animés, logo qui pivote, lettres de « MeuOsteo » en cascade, barre de chargement avec étapes réelles (ouverture de la base, synchronisation Gmail). Si `prefers-reduced-motion` est actif, l'animation est réduite à un simple fondu.
2. **Code d'accès**, si activé (voir R-21) : clavier numérique avec 4 à 6 points. En cas d'erreur, les points tremblent puis la saisie s'efface. Après 5 erreurs, attente de 30 s.
3. **Résumé du jour** : RDV du jour, nombre de cas à rapprocher, état de la sauvegarde, puis le bouton « Ouvrir mon planning ». Le lien « Passer » est disponible pendant l'animation.

**Verrouillage automatique** : après N minutes d'inactivité (réglable), l'écran de code revient par-dessus l'application, sans perdre la saisie en cours.

---

## 3. Planning (`Planning.dc.html`)

**Affichage** : deux lignes de 6 jours (lundi à samedi, selon les jours d'ouverture). La ligne 1 est « Cette semaine », la ligne 2 « Semaine prochaine ». Chaque ligne affiche ses dates et son nombre de RDV.
- **Jour courant** : encadré en cyan.
- **Jours passés** : estompés.
- **Cartes de RDV** : heure, nom, motif. Leur couleur dépend de l'état : rapproché, à rapprocher (orange), annulé (barré, pointillés), passé. Un clic ouvre la fiche patient sur la séance correspondante.

**Navigation** :
- **Boutons** : précédent / Aujourd'hui / suivant, d'une semaine à la fois.
- **Bouton « Mois Année ▾ »** : ouvre un calendrier du mois. Un clic sur une semaine l'affiche avec la suivante. Un point orange signale un jour bloqué.

**Jours bloqués (R-23)** :
- **Affichage** : carte hachurée orange « Journée bloquée / Matin bloqué / Après-midi bloqué » avec son motif, et un bouton « Débloquer ».
- **Bouton « Bloquer une période »** : choix des dates de début et de fin, du créneau (journée, matin ou après-midi) et du motif (Congés, Formation, Absente, Rendez-vous perso).
- **Avertissements** : la fenêtre indique s'il existe déjà des RDV sur la période, et rappelle de bloquer aussi dans Doctolib.

**Positionner un RDV (hors Doctolib, R-24)** :
- **Points d'entrée** : bouton « Nouveau RDV » dans l'en-tête (date du jour proposée) ou petit bouton « + RDV » en bas de chaque jour non passé et non bloqué toute la journée (date de ce jour pré-remplie).
- **Fenêtre « Nouveau rendez-vous »** :
  - **Patient** : recherche en direct (accents et casse ignorés) parmi les fiches existantes ; si rien ne correspond, « + Nouveau patient « saisie » » crée une fiche minimale à compléter (date de naissance demandée ensuite, R-15).
  - **Date** et **motif** (facultatif).
  - **Heure** : grille de créneaux de 30 min selon les horaires d'ouverture (Paramètres > Agenda). Les créneaux déjà pris (± 1 h autour d'un RDV) ou bloqués sont hachurés, barrés et non cliquables ; leur infobulle dit pourquoi (« Pris · Nom », « Bloqué · motif »). Un résumé indique « n RDV ce jour-là · matin bloqué ».
  - **Contrôles** : patient, date et heure obligatoires ; pas de date passée ni de dimanche ; R-08 (« X a déjà un RDV ce jour-là »). En cas d'erreur, le bouton tremble et les messages apparaissent.
  - **Rappel permanent** (bandeau ambre) : « Pensez à Doctolib : réservez aussi ce créneau dans Doctolib… ».
- **Résultat** : la carte apparaît dans le jour avec une animation, en style « hors Doctolib » (fond clair, bordure bleue en pointillés, motif suivi de « · hors Doctolib »). Le planning se déplace sur la semaine concernée si besoin. Notification « RDV ajouté : … · pensez à le réserver dans Doctolib ».

**Synchronisation** : bouton « Synchroniser » (l'icône tourne pendant l'opération), avec l'heure de la dernière synchronisation. Un bouton « Importer un export Doctolib » sert de solution de secours (voir GMAIL_DOCTOLIB.md §4).

### Panneau « À rapprocher »
Il liste les cas que le système n'a pas pu résoudre seul. Chaque cas réglé disparaît en se repliant. Quand il n'y en a plus : « Tout est rattaché, aucun doublon. »

1. **Nouveau patient** : aucune fiche ne correspond à un RDV. La fenêtre affiche à gauche les données Doctolib reçues, à droite un formulaire pré-rempli.
   - **Pré-remplissage** : nom, prénom, portable et e-mail, avec un repère « DOCTOLIB ».
   - **Date de naissance** : obligatoire, avec l'indication « Doctolib ne la transmet pas ».
   - **Vérification de doublon** : en direct pendant la saisie (R-17), avec un bouton « C'est cette personne : rattacher ».
   - **Validation** : « Créer la fiche et rattacher le RDV ».
2. **Plusieurs fiches possibles** : une carte par candidat, avec les critères qui concordent ✓ ou non ✗ (nom, initiale, téléphone, e-mail) et un score.
   - **Alerte contextuelle** : par exemple, un motif « enfant » alors que l'e-mail est celui de la mère.
   - **Choix** : un interrupteur « Mémoriser ce choix » (R-18), puis « Rattacher à X » ou « Aucune ne correspond : créer une fiche ».
3. **Doublon possible** : comparaison des deux fiches côte à côte, champ par champ (R-19).
   - **Champs** : les champs identiques sont en vert. Pour les autres, un clic choisit la valeur à garder.
   - **Résultat** : un résumé (séances réunies, commentaires mis bout à bout, factures inchangées).
   - **Actions** : « Ce ne sont pas les mêmes personnes » ou « Fusionner les fiches… ». La confirmation de fusion **remplace** les boutons, sans s'empiler au-dessus.

---

## 4. Patients (`Main.dc.html`)

- **Recherche** : une seule barre qui cherche dans le nom, le prénom, le téléphone (chiffres seuls), la commune et le **métier** (profession).
  - **Accents et casse** : la recherche n'en tient pas compte, « infirmiere » trouve « Infirmière ».
  - **Rapidité** : filtrage en direct, en moins de 100 ms pour 5 000 patients.
- **Liste** : « Consultés récemment » par défaut, ou « Tous les patients » (par nom, bouton « Tous », affichée d’office tant qu’aucune fiche n’a été ouverte, par exemple juste après la reprise de l’historique), puis les résultats de la recherche.
  - **Colonnes** : patient (avec le métier en petit sous le nom), âge, commune, portable, dernière séance.
  - **Mise en évidence** : quand la recherche porte sur le métier, il apparaît surligné en bleu.
- **Panneau « Aujourd'hui »** : les RDV du jour.
- **Bouton « Nouveau patient »** : ouvre le panneau d'édition vide (§5.1).

---

## 5. Fiche patient (`Fiche.dc.html`)

**Disposition**, reprise de l'outil VBA :
- **Bandeau en haut** : informations globales du patient.
- **Colonne de gauche** : la liste des séances.
- **Centre** : le détail de la séance sélectionnée.
- **Colonne de droite** : le commentaire inter-séances.

**Bandeau** :
- **Contenu** : avatar avec initiales, nom, et la ligne « âge · sexe · situation (accordée) · enfants · profession ».
- **Pastilles** : date de naissance, portable, fixe, e-mail, adresse. Une pastille vide devient un bouton en pointillés « Ajouter un fixe… » qui ouvre l'édition.
- **Boutons** : « Modifier la fiche », « Historique » (R-20), « Documents (n) » (R-26, panneau latéral), « Ses factures (n) » (ouvre Factures filtré sur ce patient).
- **Ligne « PROCHES »** (R-25), **en lecture seule** : une pastille par proche lié (initiales, nom, « · lien », chevron). **Un clic ouvre la fiche de ce proche** (même écran, en remplaçant le patient affiché ; refusé avec une notification s'il y a des modifications non enregistrées, R-05). Un bouton « Revenir à X » apparaît alors au bout de la ligne pour remonter le fil de navigation. Aucun bouton d'ajout ni de retrait dans le bandeau ; sans proche : « Aucun proche lié · à ajouter depuis « Modifier la fiche » ».
- **Gestion des proches** : uniquement dans le panneau « Modifier la fiche » (§5.1), section « Proches ».

### 5.1 Édition du patient (panneau latéral droit)
**Blocs** :
- **Identité** : nom*, prénom*, date de naissance* avec l'âge calculé en direct (en mois avant 1 an), sexe.
- **Situation** : liste Célibataire, En couple, Pacsé(e), Marié(e), Divorcé(e), Veuf(ve) ; compteur d'enfants (− / +) ; profession.
- **Coordonnées** : adresse ; code postal, qui propose la commune (R-16) ; portable et fixe, formatés « 06 12 34 56 78 » pendant la saisie ; e-mail.

**Validation (R-15)** : au clic sur Enregistrer, le bouton tremble, les champs en erreur passent en rouge avec leur message, et un compteur « n champs à corriger » s'affiche. La validation se fait ensuite en direct.

**Enregistrement** : le panneau se ferme, le bandeau s'illumine brièvement, une notification confirme, et une ligne s'ajoute au journal (R-20).

**Annuler avec des modifications** : le bandeau « Abandonner les modifications ? » **remplace** les boutons Annuler / Enregistrer, avec « Continuer l'édition » ou « Abandonner ».

**Zone sensible** : « Supprimer ce patient… », avec confirmation (R-14).

**Ouverture pour une raison précise** : par exemple « Compléter l'adresse » depuis une séance à facturer. Un bandeau explique la raison et les champs concernés sont surlignés.

**Section « Proches »** du panneau (après Coordonnées) :
- **Liste** : une ligne par proche (initiales, nom, lien) avec un bouton « Retirer… ». Un clic **remplace** ce bouton par une confirmation en ligne « Retirer le lien avec X ? Il disparaîtra aussi de sa fiche. » [Garder] [Retirer le lien].
- **« Lier un proche… »** : ouvre la fenêtre « Est un proche de… », qui ne liste **que des fiches existantes** (recherche en direct, sans le patient courant ni les proches déjà liés). Si rien ne correspond : « Aucun patient trouvé. Le proche doit d'abord avoir sa propre fiche. » Aucun moyen de créer une fiche depuis cette fenêtre.
  - **Lien** : Conjoint, Enfant, Parent, Frère / sœur, Grand-parent, Petit-enfant, Autre. Une phrase explique la réciprocité (« Paul apparaîtra ici comme enfant, et Camille apparaîtra sur la fiche de Paul comme parent »).
  - **Confirmation** : « Lier… » remplace les boutons par « Confirmer le lien ? Les deux fiches seront mises à jour. » [Retour] [Confirmer le lien]. Changer de patient ou de lien annule l'étape de confirmation.
- **Enregistrement** : chaque ajout ou retrait confirmé est enregistré **immédiatement** (indépendamment de « Enregistrer » / « Annuler » du panneau), ce que rappelle le texte d'aide de la section.

### 5.2 Liste des séances (colonne gauche)
- **Ordre** : de la plus récente à la plus ancienne. Les séances futures sont en haut, encadrées en pointillés.
- **Chaque élément** : date, badge de statut (R-01), motif, étiquette « Doctolib · 11:30 », « Hors Doctolib » ou « Facturée ».
- **Bouton « Nouvelle »** : séance hors Doctolib (R-08). Une aide sous le titre indique : « Les RDV Doctolib apparaissent ici tout seuls. »
- **Changer de séance avec des modifications non enregistrées** : fenêtre « Rester / Ne pas enregistrer / Enregistrer » (R-05).

### 5.3 Détail de la séance (centre)
**En-tête** : « Séance n sur N », « Séance du 9 octobre 2026 », le badge de statut, le temps relatif (« Il y a 15 jours », « Aujourd'hui · 11:30 »), une pastille « Non enregistré » s'il y a des modifications, et une icône corbeille (R-06 / R-07).

**Bandeaux selon l'état** :
- **À venir / aujourd'hui (Doctolib)** : « RDV Doctolib… créé automatiquement… préparez vos notes ».
- **Hors Doctolib** : explication du rattachement automatique.
- **Réalisée** : « verrouillée pour éviter toute modification involontaire » et bouton « Modifier ».
- **En modification** (orange) : si la séance est facturée, bouton « Déverrouiller date et tarif… » (R-04).
- **Annulée** : motif, date, et bouton « Rétablir la séance ».

**Champs** : date, motif, anamnèse, pratique (grandes zones de texte), tarif (Gratuit / 50 / 55 / 60 / 65 €, valeur par défaut 60 €, voir Paramètres), paiement (Espèces / Chèque / Virement en attente / Virement reçu). En lecture seule, les champs s'affichent comme du texte simple, sans cadre.

**Pied de séance, selon l'état** :
- **À venir / aujourd'hui / à compléter** : « Enregistrer » (actif seulement s'il y a des modifications) et « ✓ Séance réalisée » (R-02).
- **Réalisée, en consultation** : actions de facture (R-10) : « Générer la facture », « Compléter l'adresse », « Voir la facture », ou une mention (séance gratuite, déjà facturée…).
- **En modification** : « Annuler » et « Enregistrer ».
- **Confirmation d'annulation ou de suppression** : un encart rouge **remplace** le pied de séance. Il contient le motif (pastilles) et, si le RDV vient de Doctolib, le rappel d'annuler aussi dans Doctolib.

### 5.4 Commentaire inter-séances (colonne droite)
- **Zone de texte** : grande zone libre, enregistrée automatiquement (sauvegarde 800 ms après la dernière frappe), avec « Modifié le … ».
- **Antécédents importants** : étiquettes ajoutées par la praticienne.

### 5.5 Émission d'une facture (fenêtre)
Elle est ouverte uniquement par « Générer la facture » depuis une séance (R-10).
- **À gauche** : aperçu de la note d'honoraires. Le numéro est « provisoire » jusqu'à l'émission.
- **À droite** : récapitulatif (patient, séance, montant, règlement, numéro), un interrupteur « Envoyer par e-mail à l'émission » (inactif si la fiche n'a pas d'e-mail), et un rappel qu'une facture émise n'est plus modifiable.
- **« Émettre et envoyer »** : la roue tourne (« Attribution du numéro, génération du PDF et envoi… »), puis un tampon « ÉMISE » apparaît et une confirmation s'affiche. Boutons : Télécharger le PDF, Imprimer, « Voir ses factures », Terminer.

---

## 6. Factures (`Facture.dc.html`, `FacturesPatient.dc.html`)
Registre de **consultation uniquement** : on n'y crée aucune facture. Un bandeau le rappelle, avec un lien « Ouvrir un patient → ».

- **En-tête** : titre « Factures », ou « Factures de X » quand un seul patient est filtré, avec un lien de retour vers sa fiche.
- **Indicateurs** (selon la sélection en cours) : factures affichées, total facturé (hors supprimées), en attente de règlement, nombre de supprimées.
- **Recherche et période** : recherche par patient ou numéro, et choix de l'année (Toutes / 2026 / 2025…).
- **Colonnes** : N°, Émise le, Patient, Montant, Statut (Acquittée / En attente / Supprimée), Envoi (E-mail / Imprimée / Non envoyé).
  - **Clic sur un titre de colonne** : un panneau propose **Trier** (croissant / décroissant, avec des libellés adaptés), **Regrouper** et **Filtrer** (valeurs cochables, chacune avec son nombre de factures). Les valeurs proposées tiennent compte des autres filtres.
  - **Indicateurs dans le titre** : ▲▼ pour le tri, entonnoir pour un filtre, liste pour un regroupement.
- **Filtres actifs** : étiquettes retirables, plus « Tout effacer ».
- **Regroupement** : en-têtes de groupe repliables, avec nombre et sous-total.
- **Panneau de détail** : aperçu, lien vers la séance, statut, historique d'envoi. Actions : PDF, Renvoyer, Imprimer, « Marquer le virement comme reçu » (si en attente), « Supprimer la facture… » (R-13).
- **Les avoirs ne sont pas affichés** dans la liste : ils n'apparaissent que dans l'export comptable.
- **Bouton « Exporter la sélection »** : fichier CSV / Excel.

---

## 7. Tableau de bord (`Dashboard.dc.html`)
- **Indicateurs**, animés au chargement (compteurs) : séances du mois (comparées au mois précédent), chiffre d'affaires du mois et de l'année, nouveaux patients, montant en attente de paiement.
- **Graphique** : chiffre d'affaires des 12 derniers mois en barres qui montent à l'affichage. Le mois en cours est mis en avant, et la valeur s'affiche au survol.
- **Paiements en attente** : liste avec un bouton « Marquer reçu » ; la ligne se replie une fois traitée.
- **Dernières factures.**

### 7.1 Bilan mensuel (R-27)
- **Mois** : navigation ‹ mois › ; « Réglages du calcul » ; « Exporter (Excel) » (feuilles Encaissements, Récapitulatif, Épargne et salaire).
- **Encaissements du mois** : une ligne par séance réalisée et encaissée dans le mois, avec une case « retenue » (cochée par défaut), la date d'encaissement, le patient (lien vers la fiche), le moyen de paiement (liste modifiable), le montant et le n° de facture. Les virements attendus pour des séances du mois apparaissent « En attente », décochés. « Tout cocher / Tout décocher ».
- **Par moyen de paiement** : nombre et total des lignes retenues pour espèces, chèque, virement, autre ; total retenu.
- **Épargne & salaire** : CA retenu − cotisations (% du CA) − réserve de sécurité (% du CA) − 1/12 des frais fixes annuels − provisions = **à garder sur le compte pro** ; puis − frais fixes mensuels − dépenses exceptionnelles du mois = **salaire possible**, ou « Mois non couvert : il manque X ».
- **Dépenses exceptionnelles du mois** : libellé et montant, ajout et retrait.
- **Réglages du calcul** (communs à tous les mois) : taux de cotisations, taux de réserve, frais fixes et provisions (libellé, montant, par mois ou par an).

---

## 8. Paramètres (`Parametres.dc.html`), en onglets
1. **Sécurité** : activer ou désactiver le code d'accès ; « Modifier le code… » (code actuel, nouveau code et confirmation, 4 à 6 chiffres) ; délai de verrouillage (5 / 15 / 30 min / jamais) ; clé de secours (R-21).
2. **Messagerie Gmail** : adresse, mot de passe d'application (masqué, chiffré), libellé lu (« Doctolib » par défaut), fréquence de vérification (5 min / 15 min / au démarrage), « Tester la connexion » (3 vérifications), « Déconnecter / Reconnecter », guide en 3 étapes.
3. **Cabinet & factures** : prénom et nom, titre, adresse, téléphone, ADELI, SIRET, image de signature ; prochain numéro (lecture seule) ; tarif par défaut et liste des tarifs ; mention TVA ; modèle de l'e-mail d'envoi (variables `{prénom}`, `{date}`).
4. **Agenda** : jours de consultation, horaires d'ouverture et de fermeture, durée d'une séance, affichage sur une ou deux semaines, interrupteur « rattacher automatiquement ».
5. **Sauvegarde** : dossier, nombre de copies conservées (30), « Sauvegarder maintenant » (barre de progression), « Restaurer une sauvegarde… » (R-22).
6. **Journal** : filtres Tout / Patients / Factures / Déverrouillages / Réglages, durée de conservation (12 / 24 / 36 mois), export CSV.
7. **Données & import** : reprise de l'historique Excel avec rapport avant import (MIGRATION.md), export complet (Excel), export comptable, version de l'application.

---

## 9. Règles métier (à implémenter dans `shared/domain`, avec tests)

**Séances**
- **R-01 · Statut affiché**, calculé à partir du statut stocké et de la date (fuseau Europe/Paris) :
  - `planned` et date > aujourd'hui → **À venir** ;
  - `planned` et date = aujourd'hui → **Aujourd'hui** ;
  - `planned` et date < aujourd'hui → **À compléter** ;
  - `done` → **statut de paiement** : « Réglée · chèque » ou « Paiement en attente », plus l'étiquette « Facturée » s'il existe une facture active ;
  - `cancelled` → **Annulée**.
- **R-02 · Valider « Séance réalisée »** : possible seulement si date ≤ aujourd'hui, motif renseigné et mode de paiement choisi. Sinon, le bouton tremble et un message explique ce qui manque. Une fois validée, la séance passe en `done` et en lecture seule.
- **R-03 · Modifier une séance réalisée** : « Modifier » passe en édition, sur une copie de travail. « Enregistrer » valide et reverrouille, « Annuler » abandonne. Une séance non facturée n'est pas journalisée.
- **R-04 · Séance facturée** : même en modification, la date et le tarif restent bloqués. « Déverrouiller date et tarif… » ouvre une alerte qui exige un motif (Erreur de saisie / Erreur de date / Changement de tarif / Autre), avec une ligne de journal « Séance du … déverrouillée (facture N) · motif ».
  - **Changement à l'enregistrement** : si la date ou le tarif a changé, la facture est marquée « modifiée le … », son PDF est régénéré, et la ligne « Facture N modifiée : tarif 60 € → 55 € » est ajoutée au journal. Une notification propose de renvoyer la facture.
  - **Pas de changement** : journal « reverrouillée, facture inchangée ».
- **R-05 · Modifications non enregistrées** : changer de séance, créer une séance ou quitter la fiche avec des modifications ouvre une fenêtre « Rester / Ne pas enregistrer / Enregistrer ».
- **R-06 · Annuler une séance** (à venir, aujourd'hui ou à compléter) : un motif est obligatoire (Annulée par le patient / Patient absent / Reportée / Erreur de saisie). La séance passe en `cancelled`, reste visible barrée avec ses notes, et peut être rétablie. Si elle vient de Doctolib, un rappel invite à l'annuler aussi dans Doctolib.
- **R-07 · Supprimer une séance réalisée non facturée** : suppression définitive après confirmation, avec une ligne de journal. **Une séance facturée ne peut pas être supprimée**, il faut d'abord supprimer la facture (R-13).
- **R-08 · Unicité** : au plus une séance non annulée par patient et par jour.
  - **« Nouvelle »** : si une séance existe déjà ce jour-là, elle s'ouvre avec une notification au lieu d'en créer une seconde. Sinon, une séance `planned` est créée avec la source `manual` et l'étiquette « Hors Doctolib ».
- **R-09 · RDV Doctolib** : un RDV rapproché à un patient crée ou met à jour automatiquement **sa** séance (`source = doctolib`, `doctolib_key`). Il n'y a jamais de création manuelle depuis un RDV.
  - **Séance manuelle existante** : si une séance manuelle existe le même jour pour ce patient, le RDV s'y rattache. Il ne crée pas de doublon.
  - **Modification** : met à jour la date et l'heure, si la séance n'est pas encore réalisée.
  - **Annulation** : la séance passe en `cancelled` (motif « Annulée sur Doctolib »), sauf si elle est déjà réalisée (une alerte s'affiche alors dans « À rapprocher »).

**Facturation**
- **R-10 · Conditions d'émission** : la facture est créée **uniquement depuis une séance**, et seulement si la séance est `done` et pas en édition, si son tarif est supérieur à 0, s'il n'existe pas déjà une facture active pour elle, et si l'adresse du patient est complète (adresse, code postal, commune). Sinon, le bouton est remplacé par l'action ou la mention qui convient.
- **R-11 · Numérotation** : format `AAAA-NNNN`, séquence continue par année civile de la date d'émission. Le numéro est attribué dans la même transaction que l'émission, puis n'est jamais réutilisé ni modifié. Le « prochain numéro » est affiché dans Paramètres.
- **R-12 · Instantané** : une facture copie au moment de l'émission le nom et l'adresse du patient, la date de séance, le montant, le règlement et les mentions du cabinet. Le PDF est archivé dans `userData/factures/AAAA/`. Les mentions obligatoires figurent dans DATA_MODEL.md §factures.
- **R-13 · « Supprimer la facture »** : vocabulaire volontairement simple pour l'utilisatrice. En interne, la facture passe en `deleted` et un **avoir** `AV-AAAA-NNNN` de montant négatif est créé dans la même transaction (numérotation continue distincte). Ensuite :
  - **Affichage** : la facture reste dans le registre, barrée, avec le statut « Supprimée ».
  - **Séance** : elle peut être refacturée.
  - **Traces** : l'avoir est visible seulement dans l'export comptable, et une ligne est ajoutée au journal.
- **Envoi** : par SMTP Gmail, avec le PDF en pièce jointe et l'objet et le texte issus du modèle. On garde la date et le destinataire de chaque envoi. « Renvoyer » est disponible à tout moment.

**Patients**
- **R-14 · Suppression d'un patient** : la fiche est d'abord masquée (suppression douce, `deleted_at`), puis **purgée définitivement au bout de 30 jours** : fiche, séances, commentaire. Un bouton « Annuler la suppression » est proposé tout de suite, et une restauration reste possible depuis Paramètres > Données pendant ces 30 jours.
  - **Factures** : elles sont conservées grâce à leur instantané (R-12).
  - **Journal** : il n'enregistre que « Patient n° {id court} supprimé (n séances) · factures conservées ».
- **R-15 · Validation** :
  - **Obligatoires** : nom, prénom, date de naissance (pas dans le futur, pas avant 1900).
  - **Si renseignés** : portable `0[67]` + 8 chiffres ; fixe `0[1-59]` + 8 chiffres ; e-mail valide ; code postal à 5 chiffres.
  - **Normalisation** : téléphones stockés en chiffres seuls et affichés par paires.
- **R-16 · Commune** : proposée à partir du code postal grâce à `resources/communes.csv`. S'il n'y a qu'une commune, elle est remplie automatiquement. S'il y en a plusieurs, une liste s'affiche. S'il n'y en a aucune, saisie libre.
- **R-17 · Doublon à la création** : on cherche des patients qui ont le même nom (sans tenir compte des accents ni de la casse), le même téléphone, le même e-mail ou la même date de naissance. Chaque patient trouvé est affiché avec ses points communs et un bouton pour le rattacher.

**Rapprochement**
- **R-18 · Rattachement d'un RDV à une fiche** :
  - **Automatique** : s'il existe une association mémorisée (contact Doctolib = téléphone et e-mail) vers ce patient, ou si une seule fiche a le même nom ET (le même téléphone OU le même e-mail). Cette option est désactivable dans Paramètres > Agenda.
  - **Plusieurs candidats** : la tâche « Plusieurs fiches possibles » apparaît. Le score est le nombre de critères concordants sur 4 (nom, initiale du prénom, téléphone, e-mail). « Mémoriser ce choix » enregistre l'association.
  - **Aucun candidat** : la tâche « Nouveau patient » apparaît.
- **R-19 · Doublons de fiches** : une analyse tourne à l'import et chaque nuit.
  - **Critère** : même date de naissance ET (même téléphone OU même e-mail OU noms proches, avec une distance de Levenshtein ≤ 2 ou un nom inclus dans l'autre, comme « Lambert » et « Lambert-Durand »).
  - **Fusion** : on choisit la valeur à garder pour chaque champ différent. Les séances et factures sont rattachées à la fiche conservée, les commentaires sont mis bout à bout avec un séparateur daté, et l'autre fiche est supprimée. Le tout dans une transaction, avec une ligne de journal.
  - **« Pas les mêmes personnes »** : la paire est mémorisée et n'est plus jamais proposée.

**Transversal**
- **R-20 · Journal**, volontairement léger : une ligne par action, avec la date et l'heure, un type, un sujet court et une action courte.
  - **Patient** : créé, modifié (avec les **noms** des champs, jamais leurs valeurs), supprimé, fiches fusionnées.
  - **Facture** : émise (montant, envoyée ou non), modifiée (ancien → nouveau pour la date et le tarif uniquement), supprimée.
  - **Verrouillage** : séance déverrouillée (motif) ou reverrouillée.
  - **Réglage** : code activé, désactivé ou modifié ; Gmail connecté ou déconnecté ; historique importé.
  - **Interdits** : aucun autre événement, et jamais de contenu médical.
  - **Conservation** : 24 mois par défaut, avec une purge automatique.
  - **Affichage** : le journal complet est dans Paramètres, et celui du patient dans le bouton « Historique » de la fiche.
- **R-21 · Code d'accès** : 4 à 6 chiffres, stocké en hash `scrypt` avec sel, jamais en clair.
  - **Modification** : demande le code actuel, et le nouveau code doit être différent de l'ancien.
  - **Clé de secours** : 24 caractères, affichée une seule fois à l'activation, avec une invitation à l'imprimer. Elle permet de réinitialiser le code.
  - **Code et chiffrement** : le code protège l'interface. La clé de chiffrement de la base est protégée par `safeStorage`, elle ne dépend pas du code.
- **R-22 · Sauvegarde** :
  - **Moments** : à chaque fermeture de l'application et à la demande.
  - **Méthode** : copie chiffrée cohérente (`VACUUM INTO` puis chiffrement) vers le dossier choisi, avec un fichier daté `MeuOsteo_AAAA-MM-JJ_HHmm.mosave`. Les 30 dernières copies sont conservées.
  - **Restauration** : on choisit le fichier, l'application vérifie son intégrité, fait une copie de l'état actuel par sécurité, puis remplace la base et redémarre.
  - **Alerte** : si aucune sauvegarde n'a été faite depuis 7 jours, une alerte s'affiche dans le tableau de bord.
- **R-23 · Blocages** : stockés par jour et par créneau (journée, matin avant 13 h, après-midi). Ils n'empêchent pas un RDV Doctolib d'arriver (une alerte s'affiche alors en cas de conflit) ; en revanche, dans la fenêtre « Nouveau RDV » (R-24), les créneaux bloqués ne sont pas sélectionnables. Aucun lien avec Doctolib n'existe dans ce sens (voir GMAIL_DOCTOLIB.md §5).
- **R-24 · RDV positionné depuis le planning** : crée directement une séance `planned`, `source = manual`, avec `date` et `heure` (même objet que « Nouvelle » dans la fiche, R-08). Pas de chevauchement : un créneau est libre s'il n'y a aucun RDV non annulé à moins de 60 min (durée par défaut, réglable dans Paramètres > Agenda) et aucun blocage. Si un RDV Doctolib arrive ensuite pour le même patient et le même jour, il se rattache à cette séance (R-09). L'application **n'écrit jamais dans Doctolib** : le rappel de réserver le créneau dans Doctolib est systématique. Journal : rien de spécial (une séance n'est pas un événement journalisé, R-20), sauf la création de patient si « Nouveau patient » a été utilisé.
- **R-25 · Proches** : lien **symétrique** entre deux fiches existantes, stocké une seule fois (`patient_links`) et affiché sur les deux fiches avec la relation inverse (Enfant ↔ Parent, Grand-parent ↔ Petit-enfant ; Conjoint, Frère / sœur et Autre sont symétriques). Un patient ne peut pas être lié à lui-même ni deux fois au même proche. Retirer le lien le supprime des deux fiches. La suppression d'un patient (R-14) masque ses liens, puis les supprime à la purge ; la fusion (R-19) reporte les liens sur la fiche conservée en éliminant les doublons. Journal (type Patient) : « Proche lié : Nom (lien) » et « Lien de proche retiré : Nom ».

- **R-26 · Documents du patient** : fichiers rattachés à une fiche (imagerie, compte-rendu, courrier ou e-mail, ordonnance, administratif, photo, autre), ajoutés par glisser-déposer ou « Ajouter des fichiers… », plusieurs à la fois.
  - **Stockage** : dans la base chiffrée (table `document_contents`, à part des métadonnées). Ils sont donc chiffrés sur le disque, inclus dans chaque sauvegarde et restaurés avec elle.
  - **Limites** : 25 Mo par fichier, fichier vide refusé, programmes refusés (`.exe`, `.bat`, `.ps1`, `.lnk`, `.js`, `.iso`… : Windows les exécuterait à l'ouverture), y compris à l'ouverture d'un document plus ancien. Les fichiers refusés sont listés sans bloquer les autres (une transaction pour les fichiers acceptés).
  - **Proposés à l'import** : titre (nom du fichier sans extension), catégorie (devinée d'après le nom et l'extension), date du document (le jour même). Les trois se modifient.
  - **Aperçu dans l'application** : images, PDF, e-mails `.eml` (expéditeur, destinataires, objet, date, texte, noms des pièces jointes) et `.txt`. Les autres (Word, `.msg`, DICOM…) s'ouvrent avec le logiciel du PC, via une copie déchiffrée temporaire effacée au démarrage et à la fermeture.
  - **Cycle de vie** : la suppression d'un document est immédiate et définitive. La suppression de la fiche (R-14) les masque, la purge les supprime. La fusion (R-19) les reporte sur la fiche conservée. L'export complet en liste les métadonnées.
  - **Journal et logs** : aucun événement de journal (R-20) ; les logs techniques ne contiennent que des nombres, jamais un titre ni un nom de fichier.

- **R-27 · Bilan mensuel** :
  - **Mois d'une séance** : le mois de son encaissement. Espèces, chèque ou paiement non renseigné : le jour de la séance. Virement reçu : le jour où il est marqué reçu (`seances.paiement_recu_le`, sinon la date d'acquittement de la facture, sinon le jour de la séance). Virement en attente : pas encaissé, la ligne apparaît décochée dans le mois de la séance. Les séances annulées et gratuites ne comptent pas.
  - **Choix du bilan** : cocher ou décocher une ligne et corriger son moyen de paiement ne modifient **que le bilan** (table `monthly_statements`), jamais la séance ni la facture.
  - **Calcul** : montants en centimes, pourcentages au centième, montants annuels ramenés au mois (÷ 12, arrondi au centime). Le salaire possible n'est jamais négatif : le manque est affiché à la place.
  - **Journal** : aucun événement (R-20).

- **R-28 · Nouvelle version** :
  - **Vérification** : au plus une fois par jour, l'application installée demande à l'API GitHub la dernière version publiée du projet (une requête anonyme, sans aucune donnée du cabinet). Hors ligne ou en erreur, rien ne s'affiche et l'application fonctionne normalement.
  - **Affichage** : si la version publiée est strictement plus récente (numérotation `X.Y.Z`, préversions ignorées), un encart « Nouvelle version X.Y.Z · Télécharger » apparaît dans le menu latéral. Il ouvre dans le navigateur la page de cette version, et uniquement une page de version du projet.
  - **Réglage** : Paramètres > Données & import, « Signaler les nouvelles versions » (activé par défaut) et « Vérifier maintenant ». Désactivé, aucune requête n'est faite.

---

## 10. Exigences non fonctionnelles
- **Démarrage** : moins de 3 s jusqu'à l'écran de code, sur un PC portable ordinaire.
- **Données** : tout est enregistré dans la base au moment de l'action. Aucune perte en cas de fermeture brutale (SQLite en mode WAL).
- **Hors ligne** : l'application fonctionne entièrement sans internet. Seules la synchronisation Gmail et l'envoi d'e-mails ont besoin du réseau, et elles réessaient en silence.
- **Mises à jour** : chaque version est publiée sur GitHub Releases (étiquette `vX.Y.Z`, installateur et résumé tiré de `CHANGELOG.md`). L'application signale une version plus récente (R-28) ; la mise à jour se fait en réinstallant par-dessus, sans perte de données.
- **RGPD et santé** : données uniquement locales, base chiffrée, aucune télémétrie, export complet possible, purge des fiches supprimées, journal sans contenu médical.
