# Gmail : envoi des factures et des e-mails aux patients

MeuOsteo envoie des e-mails depuis l'adresse Gmail de la praticienne : notes d'honoraires (PDF en pièce jointe), e-mails de test. Il ne lit aucun e-mail.

> **Historique** : jusqu'à la 0.2.0, l'application lisait aussi les e-mails de confirmation Doctolib (IMAP) et l'export Doctolib pour remplir le planning. Cette fonction a été retirée pour garder l'outil simple : les RDV sont posés dans le planning (SPEC R-24). Les tables `doctolib_rdv` et `contact_memory` restent dans le schéma, inutilisées, pour ne pas imposer de migration.

## 1. Connexion (SMTP, mot de passe d'application)
- **Prérequis côté Google** : la validation en deux étapes est activée, et un mot de passe d'application « MeuOsteo » a été créé (16 lettres).
- **SMTP** : `smtp.gmail.com:465` en TLS avec `nodemailer`.
- **Certificats** : les autorités installées dans Windows sont acceptées en plus de celles de Node, comme dans le navigateur (antivirus qui analysent les e-mails sortants).
- **Mot de passe** : chiffré avec `safeStorage`, il n'est jamais renvoyé au renderer. Le renderer ne voit que l'état « configuré oui / non ».

## 2. « Tester la connexion »
Deux vérifications, chacune affichée avec une coche :
1. connexion et authentification SMTP ;
2. envoi d'un e-mail de test à l'adresse elle-même.

En cas d'échec, le message explique la cause probable (mot de passe refusé, réseau ou pare-feu sur le port 465, certificat) et affiche le code technique.

## 3. Envoi
- **Factures** : objet et texte issus du modèle (Paramètres > Cabinet & factures), PDF en pièce jointe. La date et le destinataire de chaque envoi sont conservés ; « Renvoyer » est disponible à tout moment.
- **Logs** : jamais de contenu médical ni de nom de patient ; seulement des identifiants techniques et le code d'erreur.
