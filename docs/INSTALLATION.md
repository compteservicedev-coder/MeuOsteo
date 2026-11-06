# Installer et démarrer MeuOsteo

Ce guide accompagne une nouvelle utilisatrice ou un nouvel utilisateur, du téléchargement à la première facture. Comptez 20 à 30 minutes, réglage de Gmail compris.

## 1. Avant de commencer

- Un ordinateur sous **Windows 10 ou 11 (64 bits)**.
- Pour le planning Doctolib et l'envoi des factures : un compte **Gmail**, celui qui reçoit les e-mails de Doctolib.
- Pour les sauvegardes : de préférence une **clé USB** ou un dossier synchronisé (OneDrive, Google Drive…).

## 2. Télécharger

1. Ouvrez la page des versions : **[Dernière version de MeuOsteo](https://github.com/compteservicedev-coder/Repo1/releases/latest)**.
2. Dans la partie **Assets**, cliquez sur **`MeuOsteo-Setup-x.y.z.exe`** (x.y.z est le numéro de version).

**Si le navigateur bloque le fichier** (« peut être dangereux ») : l'installateur n'est pas encore signé par un certificat payant, d'où cet avertissement.
- Chrome : ouvrez les téléchargements (Ctrl+J), puis **Conserver** ou **Conserver quand même**.
- Edge : cliquez sur les **…** à côté du fichier, puis **Conserver** et **Conserver quand même**.

## 3. Installer

1. Double-cliquez sur le fichier téléchargé.
2. Si Windows affiche **« Windows a protégé votre ordinateur »** (SmartScreen) : cliquez sur **Informations complémentaires**, puis **Exécuter quand même**.
3. L'installation se fait d'elle-même en quelques secondes. Un raccourci **MeuOsteo** est créé sur le bureau et dans le menu Démarrer, et l'application s'ouvre.

Aucun droit d'administrateur n'est demandé : MeuOsteo s'installe pour votre session Windows uniquement.

## 4. Premier lancement : le code d'accès

1. MeuOsteo propose de choisir un **code d'accès de 4 à 6 chiffres**. Il protège l'écran : l'application se verrouille après une absence et à la mise en veille du PC.
2. Une **clé de secours** s'affiche ensuite, **une seule fois**. Imprimez-la ou recopiez-la et rangez-la en lieu sûr : elle permet de choisir un nouveau code si vous l'oubliez.
3. « Plus tard » permet de commencer sans code ; vous pourrez l'activer dans **Paramètres > Sécurité**. Sans code, toute personne qui utilise votre session Windows peut ouvrir vos dossiers patients.

## 5. Renseigner le cabinet (indispensable pour facturer)

**Paramètres > Cabinet & factures** :
- **Prénom et nom**, **Titre**, **Adresse du cabinet**, **Téléphone**, **N° ADELI**, **SIRET** : ils figurent sur chaque note d'honoraires.
- Une image de **signature** (facultatif).
- **Tarif par défaut** et **Autres tarifs** (par exemple « 60 » et « 50, 55, 65, gratuit »).
- **Mention en pied de facture** : la mention de TVA qui vous concerne.
- **Numéro de la prochaine facture** : si vous facturiez déjà ailleurs cette année, reprenez à la suite de votre dernier numéro.

Cliquez sur **Enregistrer**.

## 6. Relier Gmail (planning Doctolib et envoi des factures)

MeuOsteo lit uniquement les e-mails rangés sous un libellé Gmail, sans jamais les modifier, et envoie les factures depuis votre adresse.

**Côté Google (une seule fois, environ 5 minutes)** :
1. Activez la **validation en deux étapes** sur votre compte Google (Gérer votre compte Google > Sécurité).
2. Ouvrez la page **« Mots de passe des applications »** du compte Google, créez-en un nommé « MeuOsteo » et copiez le code de 16 lettres.
3. Dans Gmail, créez un **filtre** : expéditeur contenant « doctolib », action « Appliquer le libellé » **Doctolib**.

**Dans MeuOsteo, Paramètres > Messagerie Gmail** :
1. Saisissez l'**Adresse Gmail** et le **Mot de passe d'application** (le code de 16 lettres).
2. Laissez « Doctolib » dans **Libellé Gmail à lire**, choisissez la fréquence dans **Vérifier les e-mails**.
3. Cliquez sur **Enregistrer**, puis **Tester la connexion** : les trois vérifications doivent passer, et un e-mail de test arrive dans votre boîte.

Le mot de passe d'application est conservé chiffré sur votre ordinateur. Vous pouvez le révoquer à tout moment depuis votre compte Google.

## 7. Régler les sauvegardes

**Paramètres > Sauvegarde** :
1. **Dossier de sauvegarde > Parcourir…** : choisissez de préférence une clé USB ou un dossier synchronisé, pas le même disque que l'ordinateur.
2. Cliquez sur **Afficher la clé de sauvegarde…**, imprimez-la et rangez-la avec la clé de secours. **Sans elle, une sauvegarde ne peut pas être restaurée sur un autre ordinateur.**
3. Une sauvegarde chiffrée est faite à chaque fermeture de MeuOsteo. **Sauvegarder maintenant** en fait une tout de suite.

## 8. Reprendre l'historique (si vous utilisiez le classeur Excel MeuOsteo v1.04)

**Paramètres > Données & import > Choisir le fichier MeuOsteo (.xlsm)…**

MeuOsteo analyse le fichier sans rien écrire et affiche un rapport (patients, séances, anomalies à corriger). Vérifiez-le, puis cliquez sur **Importer**. L'import n'est possible que sur une base vide : faites-le avant de créer vos premiers patients. Le détail est dans l'**Aide & FAQ** de l'application, rubrique « Reprise de l'historique ».

## 9. Premiers pas

1. **Patients > Nouveau patient** : nom, prénom, date de naissance, puis l'adresse complète (obligatoire pour facturer).
2. Dans la fiche : **Nouvelle** crée une séance du jour. Renseignez le motif, l'anamnèse, la pratique, le tarif et le paiement, puis **Séance réalisée**.
3. **Générer la facture** : la note d'honoraires est créée en PDF, à envoyer par e-mail ou à imprimer.
4. Le **Planning** se remplit avec les rendez-vous Doctolib ; les cas à vérifier apparaissent dans **À rapprocher**.

Le menu **Aide & FAQ** répond aux questions courantes, écran par écran.

## 10. Mettre à jour

Quand une nouvelle version paraît sur la [page des versions](https://github.com/compteservicedev-coder/Repo1/releases) :
1. **Fermez MeuOsteo** (une sauvegarde est faite à la fermeture).
2. Téléchargez et lancez le nouvel installateur, **par-dessus** l'ancienne version. Inutile de désinstaller.

Vos données sont conservées : elles sont dans `%APPDATA%\MeuOsteo`, jamais dans le dossier du programme.

## 11. Changer d'ordinateur

1. Sur l'ancien PC : **Paramètres > Sauvegarde > Sauvegarder maintenant**, et notez la **clé de sauvegarde**.
2. Sur le nouveau PC : installez MeuOsteo, puis **Paramètres > Sauvegarde > Restaurer une sauvegarde…**, choisissez le fichier `.mosave` et saisissez la clé de sauvegarde. L'application redémarre avec vos données.
3. Refaites le réglage Gmail (le mot de passe d'application n'est pas transféré).

## 12. Désinstaller

Paramètres Windows > Applications > MeuOsteo > Désinstaller. Les données et les sauvegardes **ne sont pas supprimées**. Pour tout effacer, supprimez aussi le dossier `%APPDATA%\MeuOsteo` et le dossier de sauvegarde.

## Besoin d'aide ?

- Dans l'application : menu **Aide & FAQ**.
- Un problème ou une idée : [ouvrir une issue](https://github.com/compteservicedev-coder/Repo1/issues/new/choose), **sans aucune donnée de patient**.
- Une faille de sécurité : en privé, voir [SECURITY.md](../SECURITY.md).
