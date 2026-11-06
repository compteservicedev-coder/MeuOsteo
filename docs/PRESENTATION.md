# MeuOsteo · présentation du projet

> Le logiciel de cabinet d'une ostéopathe qui travaille seule : patients, séances, factures, planning Doctolib, documents et bilan du mois, sur son ordinateur, sans abonnement et sans que ses données partent ailleurs.

Cette note s'adresse aux praticiens et à toute personne qui découvre le projet. Les détails techniques sont dans le [README](../README.md) et la spécification complète dans [SPEC.md](SPEC.md).

## Le besoin

Une ostéopathe en libéral, seule dans son cabinet, doit chaque jour :

- **retrouver ses patients** et l'historique de leurs séances (motif, anamnèse, ce qui a été fait) ;
- **suivre ses rendez-vous**, qui arrivent pour l'essentiel par Doctolib ;
- **faire ses notes d'honoraires**, les envoyer, suivre les paiements (espèces, chèque, virement) ;
- **savoir où elle en est** à la fin du mois : ce qui est encaissé, ce qu'il faut garder pour les cotisations et les frais, ce qu'elle peut se verser ;
- **protéger des données de santé**, dont elle est responsable (RGPD).

MeuOsteo est né d'un classeur Excel avec macros (« MeuOsteo v1.04 ») utilisé au quotidien : pratique, mais fragile, sans chiffrement ni sauvegarde, et sans lien avec Doctolib ni la facturation. Les logiciels du marché répondent au besoin, mais sur abonnement, souvent en ligne, et pensés pour des cabinets plus grands.

## Ce que fait MeuOsteo, au fil de la journée

**En ouvrant le cabinet**
- Un code d'accès protège l'écran ; l'application se verrouille seule après une absence.
- Le **planning** sur une ou deux semaines se remplit tout seul : MeuOsteo lit les e-mails de confirmation Doctolib reçus dans Gmail, rattache chaque rendez-vous à la bonne fiche, et signale ce qu'il ne sait pas trancher (nouveau patient, homonymes) dans « À rapprocher ».
- On peut bloquer des demi-journées et poser un rendez-vous pris hors Doctolib.

**Pendant la séance**
- La **fiche patient** réunit l'identité, les proches liés (enfant, conjoint…), la liste des séances et un commentaire qui suit la personne d'une séance à l'autre (antécédents importants).
- Chaque **séance** garde le motif, l'anamnèse, la pratique, le tarif et le mode de paiement. Une fois « réalisée », elle est verrouillée pour éviter les modifications par erreur.
- Les **documents** du patient (radios, comptes-rendus, courriers, e-mails d'un confrère) se glissent dans la fiche et s'affichent sans quitter l'application.

**Après la séance**
- La **note d'honoraires** est générée en PDF, numérotée sans trou, envoyée par e-mail depuis Gmail ou imprimée.
- Le registre des **factures** se filtre et se regroupe (par mois, patient, paiement) ; un virement se marque « reçu » d'un clic ; une facture supprimée laisse un avoir, comme l'exige la loi.

**En fin de mois**
- Le **bilan mensuel** reprend les séances encaissées dans le mois, avec la possibilité de cocher celles à retenir et de corriger le moyen de paiement.
- Le calcul **« Épargne & salaire »** déduit les cotisations, une réserve de sécurité, les frais fixes et les provisions, et indique ce qu'il faut laisser sur le compte professionnel et ce qui peut être versé en salaire.
- Exports Excel du bilan et export comptable pour l'expert-comptable.

**En permanence**
- Un **tableau de bord** : séances et chiffre d'affaires du mois et de l'année, paiements en attente.
- Une **sauvegarde chiffrée** à chaque fermeture, restaurable sur un autre ordinateur.
- Un **journal** des actions sensibles (factures, déverrouillages, réglages), sans aucun contenu médical.
- La **reprise de l'historique** du classeur Excel, avec un rapport des anomalies avant import.

## Les principes du projet

| Principe | Concrètement |
|---|---|
| **Les données restent au cabinet** | Tout est sur l'ordinateur, dans une base chiffrée. Aucun serveur, aucun compte en ligne, aucune statistique d'usage envoyée. Seul Gmail est utilisé, pour lire les e-mails Doctolib et envoyer les factures. |
| **Sécurité des données de santé** | Base et sauvegardes chiffrées, clé protégée par Windows, code d'accès, journal sans contenu médical, export complet possible (droit d'accès RGPD). |
| **Gratuit et libre** | Licence GNU AGPL-3.0 : chacun peut l'utiliser, l'étudier et l'améliorer ; toute version modifiée diffusée doit rester libre. |
| **Simple pour une personne seule** | Un écran par moment de la journée, des libellés du métier, des contrôles qui évitent les erreurs (facture sans adresse, séance en double, date impossible). |
| **Accessible** | Utilisable au clavier, contrastes suffisants, grandes zones cliquables, animations réduites si Windows le demande. |

## Ce que MeuOsteo n'est pas

- **Pas un dispositif médical** ni un logiciel certifié, et **pas un hébergement HDS** : chaque praticien reste responsable de ses données, de son poste et de ses sauvegardes.
- **Pas un outil multi-cabinet** : un ordinateur, une praticienne. Il n'y a ni synchronisation entre postes ni accès à distance.
- **Il n'écrit jamais dans Doctolib** : un rendez-vous posé dans MeuOsteo doit aussi être réservé dans Doctolib.
- **Pas un logiciel de comptabilité** ni de déclaration : le bilan et le calcul « Épargne & salaire » sont des aides, pas un conseil comptable ou fiscal.
- **Pas de télétransmission** : l'ostéopathie n'est pas remboursée par l'Assurance maladie ; les notes d'honoraires servent aux mutuelles.

## Où en est le projet

- **Utilisable au quotidien** depuis octobre 2026 : patients, séances, factures, planning, documents, bilan, sauvegarde et reprise de l'historique fonctionnent.
- **Lecture des e-mails Doctolib** : le mécanisme est en place, mais le format réel des e-mails reste à intégrer à partir d'exemples anonymisés. En attendant, l'import de l'export Doctolib (fichier Excel) remplit le planning.
- **Windows uniquement**, installateur non signé (Windows affiche un avertissement à l'installation).
- Mises à jour par réinstallation par-dessus l'ancienne version, sans perte de données.

## Pistes pour la suite

- Lecture des vrais e-mails Doctolib, puis d'autres plateformes de rendez-vous.
- Mise à jour automatique de l'application.
- Modèles de courriers (au médecin traitant, attestation) générés depuis la fiche.
- Signature de l'installateur.

Les idées sont les bienvenues : voir [CONTRIBUTING.md](../CONTRIBUTING.md).
