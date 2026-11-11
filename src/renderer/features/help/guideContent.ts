/**
 * In-app user guide (FAQ) content, shown by the help screen. Written in French for the user,
 * every answer describes what the application actually does today. A paragraph starting with
 * "• " is rendered as a bullet.
 */

export interface GuideQuestion {
  q: string
  a: string[]
}

export interface GuideSection {
  id: string
  title: string
  intro: string
  questions: GuideQuestion[]
}

export const GUIDE: GuideSection[] = [
  {
    id: 'demarrage',
    title: 'Premiers pas',
    intro:
      'Installer MeuOsteo, choisir votre code d’accès et renseigner votre cabinet : quelques minutes suffisent.',
    questions: [
      {
        q: 'Windows ou Chrome me dit que le fichier est « dangereux ». Que faire ?',
        a: [
          'C’est normal : le programme d’installation n’est pas signé par un éditeur payant, alors Windows et Chrome se méfient par principe. Le fichier n’est pas dangereux pour autant.',
          '• Dans Chrome, ouvrez la liste des téléchargements et choisissez « Conserver ».',
          '• Au lancement, si Windows affiche « Windows a protégé votre ordinateur », cliquez sur « Informations complémentaires », puis sur « Exécuter quand même ».',
          'L’installation se fait ensuite toute seule et place un raccourci MeuOsteo sur le bureau.',
        ],
      },
      {
        q: 'Comment installer une nouvelle version ?',
        a: [
          'Quand une nouvelle version est publiée, un encart « Nouvelle version · Télécharger » apparaît en bas du menu de gauche. Il ouvre la page de la version, avec le résumé des nouveautés et le fichier d’installation (MeuOsteo vérifie une fois par jour ; réglage dans Paramètres > Données & import).',
          'Fermez MeuOsteo, puis lancez le fichier téléchargé, tout simplement, par-dessus la version actuelle.',
          'Vos données ne sont pas touchées : elles sont rangées à part, dans votre dossier Windows personnel, et non dans le dossier du programme. Même une désinstallation ne les efface pas.',
          'Par prudence, faites tout de même une sauvegarde avant (Paramètres > Sauvegarde > « Sauvegarder maintenant »).',
        ],
      },
      {
        q: 'À quoi sert le code d’accès ?',
        a: [
          'Au premier lancement, vous choisissez un code de 4 à 6 chiffres, puis vous le confirmez. Il est demandé à chaque ouverture et après une période sans utilisation.',
          'Après 5 codes faux, il faut attendre 30 secondes avant de réessayer.',
          'Dans Paramètres > Sécurité, vous pouvez « Modifier le code… », régler le délai de verrouillage (ou « Jamais ») et même désactiver le code. Vos données restent chiffrées dans tous les cas.',
        ],
      },
      {
        q: 'Qu’est-ce que la clé de secours ?',
        a: [
          'C’est une suite de 24 caractères, affichée une seule fois quand le code est créé. Imprimez-la (bouton « Imprimer ») ou recopiez-la, puis rangez-la en lieu sûr avant de cliquer sur « J’ai noté ma clé ».',
          'Si vous oubliez votre code, cliquez sur « Code oublié ? » sur l’écran de code : la clé de secours permet d’en choisir un nouveau.',
          'Clé perdue ? Tant que vous avez accès à l’application, Paramètres > Sécurité permet de générer une nouvelle clé de secours. L’ancienne ne fonctionne alors plus.',
        ],
      },
      {
        q: 'Que dois-je renseigner avant d’émettre ma première facture ?',
        a: [
          'Ouvrez Paramètres > Cabinet & factures. Ces informations apparaissent sur chaque facture.',
          '• Obligatoires : prénom et nom, adresse du cabinet, n° ADELI et SIRET.',
          '• Conseillés : titre, téléphone et image de signature.',
          '• Facturation : tarif par défaut, autres tarifs, mention en pied de facture, objet et modèle de l’e-mail d’envoi.',
          'Si vous aviez déjà une numérotation de factures cette année, le lien « Reprendre une numérotation existante… » permet de continuer à partir du bon numéro. Il n’est proposé que tant qu’aucune facture n’a été émise dans l’année.',
          'Pour envoyer les factures par e-mail, configurez aussi l’onglet Messagerie Gmail.',
        ],
      },
    ],
  },
  {
    id: 'patients',
    title: 'Patients et fiche',
    intro:
      'La fiche patient est au centre de tout : identité, proches, séances et commentaire qui suit la personne d’une séance à l’autre.',
    questions: [
      {
        q: 'Comment ranger une radio, un courrier ou un e-mail dans le dossier ?',
        a: [
          'Dans la fiche, cliquez sur « Documents » dans le bandeau. Glissez-y un ou plusieurs fichiers depuis l’Explorateur Windows, ou utilisez « Ajouter des fichiers… ».',
          'MeuOsteo propose un titre, une catégorie et une date : le crayon permet de les corriger. Les catégories servent de filtres en haut de la liste.',
          'Pour un e-mail Gmail : ouvrez le message, menu ⋮ › « Télécharger le message », puis glissez le fichier .eml obtenu. Il s’affiche ensuite comme un e-mail, avec l’expéditeur, l’objet et le texte.',
          'Les images, les PDF et les e-mails s’affichent dans l’application. Un fichier Word s’ouvre avec Word (bouton « Ouvrir avec le logiciel du PC ») ; « Enregistrer sous… » en sort une copie.',
          'Les documents sont chiffrés avec la base et inclus dans chaque sauvegarde. Limite : 25 Mo par fichier.',
        ],
      },
      {
        q: 'Comment retrouver un patient rapidement ?',
        a: [
          'Depuis n’importe quel écran, appuyez sur Ctrl+K : l’écran Patients s’ouvre avec le curseur dans la recherche.',
          'Tapez un nom, un prénom, un téléphone, une commune ou un métier. Les accents et les majuscules ne comptent pas : « infirmiere » trouve « Infirmière ».',
          'Sans recherche, la liste affiche les patients « Consultés récemment ».',
        ],
      },
      {
        q: 'Comment créer un patient ?',
        a: [
          'Cliquez sur « Nouveau patient » dans l’écran Patients. Nom, prénom et date de naissance sont obligatoires.',
          'Le code postal propose la commune, et les téléphones se mettent en forme tout seuls.',
          'Pendant la saisie, MeuOsteo signale les fiches qui se ressemblent (même nom, téléphone, e-mail ou date de naissance). Si c’est la même personne, « C’est cette personne : ouvrir sa fiche » évite de créer un doublon.',
        ],
      },
      {
        q: 'Comment lier les membres d’une même famille ?',
        a: [
          'Ouvrez « Modifier la fiche », puis la section « Proches » et « Lier un proche… ». Le proche doit déjà avoir sa propre fiche.',
          'Choisissez le lien (conjoint, enfant, parent…) et confirmez : le lien apparaît sur les deux fiches, dans le bon sens (si Paul est l’enfant de Camille, Camille est le parent de Paul).',
          'Dans le bandeau de la fiche, un clic sur un proche ouvre sa fiche, et « Revenir à… » vous ramène à la précédente.',
        ],
      },
      {
        q: 'Comment fonctionne le commentaire inter-séances ?',
        a: [
          'La colonne de droite de la fiche contient une grande zone de texte libre qui suit le patient d’une séance à l’autre. Elle s’enregistre toute seule, moins d’une seconde après votre dernière frappe : la date de modification s’affiche dessous.',
          'Juste en dessous, « Antécédents importants » accueille des étiquettes courtes : tapez-en une et appuyez sur Entrée. La petite croix la retire.',
          'Le bouton en forme d’œil masque la colonne, par exemple si un patient regarde l’écran. Il reste masqué d’une fiche à l’autre jusqu’à ce que vous cliquiez à nouveau sur l’œil.',
        ],
      },
      {
        q: 'Que contient le bouton « Historique » ?',
        a: [
          'Il ouvre l’historique de la fiche : création, modifications (seulement les noms des champs changés, jamais leur contenu), proches liés, factures, déverrouillages.',
          'Aucune note clinique n’y figure : ni motif, ni anamnèse, ni pratique, ni commentaire.',
        ],
      },
      {
        q: 'Que faire si un patient a deux fiches ?',
        a: [
          'Les doublons possibles (même date de naissance et même téléphone, même e-mail ou nom très proche) apparaissent dans le panneau « À rapprocher » du Planning.',
          'Comparez les deux fiches : les champs identiques sont en vert, et pour les autres vous choisissez d’un clic la valeur à garder. « Fusionner les fiches… » réunit les séances et les factures, et met les commentaires bout à bout.',
          'Si ce sont deux personnes différentes, « Ce ne sont pas les mêmes personnes » : la paire ne sera plus proposée.',
          'Pour supprimer un patient, utilisez « Supprimer ce patient » dans « Modifier la fiche ». La fiche reste restaurable pendant 30 jours depuis Paramètres > Données & import, ses factures sont conservées.',
        ],
      },
    ],
  },
  {
    id: 'seances',
    title: 'Séances',
    intro:
      'Les séances se trouvent dans la fiche : la liste à gauche, le détail au centre. Une séance réalisée est verrouillée pour éviter les modifications involontaires.',
    questions: [
      {
        q: 'Comment ajouter une séance ?',
        a: [
          'Dans la fiche, cliquez sur « Nouvelle » au-dessus de la liste des séances. Vous pouvez aussi passer par « Nouveau RDV » dans le Planning.',
          'Il ne peut y avoir qu’une séance par patient et par jour : si une séance existe déjà ce jour-là, elle s’ouvre au lieu d’en créer une seconde.',
        ],
      },
      {
        q: 'À quoi sert « Séance réalisée » ?',
        a: [
          'Une fois la séance faite, remplissez au moins le motif et le mode de paiement, puis cliquez sur « Séance réalisée ». Si quelque chose manque, le bouton tremble et un message vous dit quoi.',
          'La séance est alors verrouillée : ses champs s’affichent comme du texte simple, et elle peut être facturée.',
          'Raccourci : Ctrl+S enregistre la séance en cours.',
        ],
      },
      {
        q: 'Comment corriger une séance déjà réalisée ?',
        a: [
          'Cliquez sur « Modifier » dans le bandeau gris de la séance. Faites vos changements, puis « Enregistrer » (la séance se reverrouille) ou « Annuler ».',
          'Si vous changez de séance ou quittez la fiche avec des modifications non enregistrées, MeuOsteo vous demande de choisir : rester, ne pas enregistrer, ou enregistrer.',
        ],
      },
      {
        q: 'La séance est déjà facturée et je dois changer la date ou le tarif.',
        a: [
          'En modification, la date et le tarif d’une séance facturée restent bloqués. Cliquez sur « Déverrouiller date et tarif… » et choisissez un motif (erreur de saisie, erreur de date, changement de tarif, autre).',
          'Si la date ou le tarif change, la facture est marquée « modifiée » et son PDF est refait. Le déverrouillage est noté dans le journal avec son motif.',
        ],
      },
      {
        q: 'Comment annuler ou supprimer une séance ?',
        a: [
          'Utilisez l’icône corbeille en haut du détail de la séance.',
          '• Séance à venir ou pas encore validée : elle est annulée avec un motif. Elle reste visible, barrée, avec ses notes, et « Rétablir la séance » la fait revenir.',
          '• Séance réalisée et non facturée : elle est supprimée définitivement, avec ses notes.',
          '• Séance facturée : elle ne peut pas être supprimée. Supprimez d’abord sa facture.',
        ],
      },
    ],
  },
  {
    id: 'factures',
    title: 'Factures',
    intro:
      'Une facture part toujours d’une séance réalisée. L’écran Factures sert à consulter, renvoyer, imprimer et exporter.',
    questions: [
      {
        q: 'Comment émettre une facture ?',
        a: [
          'Dans la fiche, ouvrez la séance et cliquez sur « Générer la facture ». Le bouton n’apparaît que si :',
          '• la séance est réalisée et n’est pas en cours de modification ;',
          '• son tarif n’est pas gratuit ;',
          '• elle n’a pas déjà une facture ;',
          '• l’adresse du patient est complète (adresse, code postal, commune). Sinon, « Compléter l’adresse » s’affiche à la place.',
          'Une fenêtre montre l’aperçu. Cliquez sur « Émettre la facture », ou sur « Émettre et envoyer » si l’interrupteur « Envoyer par e-mail à l’émission » est activé. Une facture émise n’est plus modifiable.',
        ],
      },
      {
        q: 'Comment sont numérotées les factures ?',
        a: [
          'Les numéros suivent le format année-numéro, par exemple 2026-0001, sans trou, en repartant à 0001 chaque année civile.',
          'Un numéro n’est jamais réutilisé ni modifié, même si la facture est supprimée. Le prochain numéro est affiché dans Paramètres > Cabinet & factures.',
        ],
      },
      {
        q: 'Où est le PDF ? Comment l’envoyer ou l’imprimer ?',
        a: [
          'Le PDF est créé et archivé automatiquement sur cet ordinateur au moment de l’émission.',
          '• Juste après l’émission : « Télécharger le PDF », « Imprimer » ou « Voir ses factures → ».',
          '• Plus tard, dans l’écran Factures, cliquez sur une facture : boutons « PDF », « Renvoyer » et « Imprimer ».',
          'L’envoi passe par votre compte Gmail, avec le PDF en pièce jointe et le texte de votre modèle. Il faut que la fiche du patient ait un e-mail et que l’onglet Messagerie Gmail soit configuré. Chaque envoi et chaque impression sont notés dans la facture.',
        ],
      },
      {
        q: 'Je me suis trompée : comment annuler une facture ?',
        a: [
          'Dans l’écran Factures, ouvrez la facture et cliquez sur « Supprimer la facture… », puis confirmez.',
          'La facture reste visible, barrée, avec le statut « Supprimée ». Comptablement, MeuOsteo crée un avoir qui l’annule : il n’apparaît que dans l’export comptable.',
          'La séance peut ensuite être corrigée et facturée de nouveau, avec un nouveau numéro.',
        ],
      },
      {
        q: 'Comment noter qu’un virement est arrivé ?',
        a: [
          'Dans l’écran Factures, ouvrez la facture « En attente » et cliquez sur « Marquer le virement comme reçu ».',
          'Vous pouvez aussi le faire depuis le Tableau de bord, dans « Paiements en attente », avec « Marquer reçu ». Cela marche aussi pour une séance réglée par virement mais pas encore facturée.',
        ],
      },
      {
        q: 'Comment retrouver ou exporter des factures ?',
        a: [
          'L’écran Factures liste toutes les factures. Cherchez par patient ou par numéro, choisissez une année, et cliquez sur le titre d’une colonne pour trier, regrouper ou filtrer.',
          'Depuis une fiche, « Ses factures » ouvre la liste filtrée sur ce patient.',
          '« Exporter la sélection » enregistre les factures affichées dans un fichier lisible par Excel.',
          'Pour votre comptable : Paramètres > Données & import > « Exporter les factures pour le comptable ». Cet export contient aussi les avoirs.',
        ],
      },
    ],
  },
  {
    id: 'planning',
    title: 'Planning',
    intro:
      'Le planning affiche vos rendez-vous à la semaine. Il ne communique avec aucun agenda en ligne : si vous en utilisez un, reportez-y vos changements.',
    questions: [
      {
        q: 'Comment naviguer dans le planning ?',
        a: [
          'Les flèches passent d’une semaine à l’autre, « Aujourd’hui » revient à la semaine en cours, et le bouton du mois ouvre un calendrier pour sauter à une semaine précise.',
          'Le planning montre une ou deux semaines, au choix dans Paramètres > Agenda (avec vos horaires et la durée d’une séance).',
          'Un clic sur un rendez-vous ouvre la fiche du patient sur la bonne séance.',
        ],
      },
      {
        q: 'Comment ajouter un rendez-vous ?',
        a: [
          'Cliquez sur « Nouveau RDV » en haut, ou sur le petit bouton « + RDV » en bas d’un jour. Cherchez le patient (ou créez-le avec « Nouveau patient »), puis choisissez un créneau libre : les créneaux pris ou bloqués sont barrés.',
          'Ce rendez-vous n’existe que dans MeuOsteo : si vous utilisez un agenda en ligne, réservez-y aussi le créneau.',
          'Il ne peut y avoir qu’une séance par patient et par jour.',
        ],
      },
      {
        q: 'Comment bloquer une journée, un matin ou un après-midi ?',
        a: [
          'Cliquez sur « Bloquer une période », choisissez les dates, le créneau (journée, matin ou après-midi) et le motif (Congés, Formation, Absente, Rendez-vous perso).',
          'La fenêtre vous prévient s’il y a déjà des rendez-vous sur la période. Le bouton « Débloquer » sur la carte du jour annule le blocage.',
          'Bloquez aussi ces dates dans votre agenda en ligne si vous en utilisez un : MeuOsteo ne peut pas le faire à votre place.',
        ],
      },
      {
        q: 'Qu’est-ce que le panneau « À rapprocher » ?',
        a: [
          'Il regroupe les doublons possibles : deux fiches qui semblent être la même personne (même date de naissance et même téléphone, même e-mail ou nom très proche). Le nombre de cas apparaît aussi en badge sur le menu Planning.',
          '« Comparer les fiches » les affiche côte à côte : fusionnez-les, ou indiquez que ce sont deux personnes différentes.',
        ],
      },
    ],
  },
  {
    id: 'reprise',
    title: 'Reprise de l’historique',
    intro:
      'Vous pouvez reprendre tous vos patients et toutes vos séances de l’ancien outil Excel MeuOsteo v1.04, en une fois, sans rien ressaisir.',
    questions: [
      {
        q: 'Comment se passe la reprise de l’historique ?',
        a: [
          'Elle se fait dans Paramètres > Données & import, carte « Reprise de l’historique ». Comptez quelques minutes.',
          '• 1. Fermez votre classeur dans Excel, puis cliquez sur « Choisir le fichier MeuOsteo (.xlsm)… » et sélectionnez-le.',
          '• 2. MeuOsteo l’analyse sans rien enregistrer, puis affiche un rapport : « Prêt à importer : N patients · M séances », suivi des points à vérifier.',
          '• 3. Si besoin, corrigez les dates signalées directement dans le rapport (« Voir le détail »).',
          '• 4. Cliquez sur « Importer ». Un message confirme « Historique importé : N patients, M séances », et une ligne est ajoutée au journal.',
          'Tant que vous n’avez pas cliqué sur « Importer », rien n’est écrit : « Annuler » permet de recommencer ou de choisir un autre fichier autant de fois que vous voulez.',
        ],
      },
      {
        q: 'Y a-t-il un format type à remplir ?',
        a: [
          'Non, rien à remplir ni à préparer : MeuOsteo lit directement votre classeur MeuOsteo v1.04 (.xlsm), tel que vous l’utilisez aujourd’hui, même s’il contient beaucoup plus de patients et de séances que lors de sa création.',
          'Ne renommez pas les colonnes et ne déplacez pas les tableaux : c’est grâce à leurs noms que MeuOsteo s’y retrouve. Ajouter des lignes ou des colonnes ne pose pas de problème.',
        ],
      },
      {
        q: 'Qu’est-ce qui est lu dans le classeur ?',
        a: [
          'La feuille TEMP_BDD contient deux tableaux, repérés par leur nom et non par leur position :',
          '• Tb_patient : id_patient, nom, prenom, ddn (date de naissance), sexe, situation, enfant, profession, adresse, cdp (code postal), commune, portable, fixe, mail, commentaire.',
          '• Tb_seance : date, motif, anam (anamnèse), pratique, prix, paiement, praticien, id_patient.',
          'Les colonnes sont retrouvées par leur titre, sans tenir compte des majuscules ni des accents, quel que soit leur ordre. L’identifiant id_patient (du type NomPrénomJJ/MM/AAAA) relie chaque séance à son patient.',
          'Quelques mises en forme sont faites au passage : espaces en trop retirés, code postal complété par le 0 du début s’il manquait, téléphones en chiffres seuls, e-mails en minuscules, prix en euros convertis, « Attente de Virement » devenant « Virement en attente ».',
          'La colonne « praticien » est ignorée, et toute colonne inconnue est signalée comme ignorée dans le rapport.',
        ],
      },
      {
        q: 'Que montre le rapport avant l’import ?',
        a: [
          'Le nombre de patients et de séances trouvés, puis tout ce qui mérite votre attention, ligne Excel par ligne Excel, avec le nom du patient :',
          '• Dates de séance invalides (par exemple une année « 1024 » ou « 4444 ») et séances sans date : MeuOsteo propose une date (l’année corrigée, ou la date de la séance voisine). Bouton « Reprendre … » pour l’accepter, ou saisissez la bonne date au format JJ/MM/AAAA. Sans correction, la séance est importée à la date proposée.',
          '• Dates de naissance : si elle manque dans « ddn », elle est reprise de l’identifiant du patient. Si c’est impossible, elle doit être saisie dans le rapport avant d’importer.',
          '• Séances sans prix : importées au tarif par défaut.',
          '• Séances orphelines (identifiant patient inconnu) : listées et non importées.',
          '• Deux séances le même jour pour un même patient : elles sont toutes les deux conservées.',
          '• Codes postaux, téléphones ou e-mails non conformes, sexe ou situation non reconnus : importés tels quels ou laissés vides, à vérifier ensuite.',
          '• Doublons possibles entre patients : ils seront envoyés dans « À rapprocher ».',
        ],
      },
      {
        q: 'Que deviennent les séances importées ?',
        a: [
          'Elles arrivent comme séances réalisées, non facturées, avec leur motif, leur anamnèse, leur pratique, leur tarif et leur mode de paiement. Le commentaire de chaque patient devient son commentaire inter-séances.',
          'Elles comptent dans le chiffre d’affaires des mois concernés sur le Tableau de bord. Vous pouvez facturer une séance ancienne si besoin : la facture porte alors la date du jour.',
          'Si une date a été importée « à corriger », notez la ligne concernée dans le rapport, puis corrigez-la ensuite dans la fiche avec « Modifier ».',
        ],
      },
      {
        q: 'L’import peut-il échouer à moitié ? Puis-je le refaire ?',
        a: [
          'Non, il ne peut pas échouer à moitié : tout est enregistré en une seule opération. En cas de problème, rien n’est écrit et vous pouvez simplement réessayer.',
          'La reprise est prévue pour être faite une seule fois, sur une base vide : elle est refusée dès que la base contient déjà des patients. C’est une protection contre les doublons.',
          'Conseil : faites l’import avant de commencer à saisir de nouveaux patients. Si vous voulez pouvoir revenir en arrière, cliquez sur « Sauvegarder maintenant » juste avant, puis restaurez cette sauvegarde au besoin.',
        ],
      },
      {
        q: 'Et après l’import, que vérifier ?',
        a: [
          'Le message de fin indique le nombre de doublons possibles. « Ouvrir « À rapprocher » » vous emmène directement au Planning.',
          'Pour chaque paire, « Comparer les fiches » les montre côte à côte. Choisissez les valeurs à garder, puis « Fusionner les fiches… » : la fiche la plus ancienne est conservée, les séances et commentaires sont réunis. Ou bien « Ce ne sont pas les mêmes personnes ».',
          'Si un même identifiant apparaissait deux fois dans le classeur, les séances vont à la première fiche et la seconde est proposée en doublon.',
        ],
      },
      {
        q: 'Je n’ai pas l’ancien fichier MeuOsteo. Existe-t-il un modèle ?',
        a: [
          'Pas pour l’instant : la reprise est prévue uniquement pour le classeur MeuOsteo v1.04. Aucun modèle vierge n’est fourni avec l’application.',
          'Si vous avez vos données dans un autre format (autre logiciel, autre tableau Excel), un modèle à remplir pourra être ajouté sur demande.',
        ],
      },
    ],
  },
  {
    id: 'sauvegarde',
    title: 'Sauvegarde et sécurité',
    intro:
      'Vos données restent sur cet ordinateur, chiffrées. Une copie de sauvegarde est faite automatiquement à chaque fermeture.',
    questions: [
      {
        q: 'Quand MeuOsteo fait-il une sauvegarde ?',
        a: [
          'À chaque fermeture de l’application, automatiquement. Vous pouvez aussi en faire une à tout moment avec « Sauvegarder maintenant » (Paramètres > Sauvegarde).',
          'Chaque sauvegarde est un fichier daté, par exemple MeuOsteo_2026-10-25_0941.mosave. Les 30 dernières copies sont conservées par défaut (réglable : 10, 30, 60 ou 90), les plus anciennes sont effacées.',
        ],
      },
      {
        q: 'Que signifie « Sauvegarde auto · il y a X min » en bas du menu ?',
        a: [
          'C’est le temps écoulé depuis la dernière sauvegarde (en minutes, en heures, puis en jours).',
          '• Point vert : la dernière sauvegarde a moins de 7 jours, tout va bien.',
          '• Point orange : aucune sauvegarde depuis 7 jours ou plus, ou aucune sauvegarde pour l’instant. Le Tableau de bord affiche alors aussi une alerte avec « Sauvegarder maintenant ».',
          'Un clic sur cette ligne ouvre Paramètres > Sauvegarde.',
        ],
      },
      {
        q: 'Où sont rangées les sauvegardes ?',
        a: [
          'Par défaut dans Documents, dossier « MeuOsteo Sauvegardes ». Si l’ordinateur tombe en panne ou est volé, elles disparaissent avec lui.',
          'Mieux vaut choisir, avec « Parcourir… », une clé USB, un disque externe ou un dossier synchronisé comme OneDrive. Les fichiers restent chiffrés : personne ne peut les lire sans la clé.',
        ],
      },
      {
        q: 'Qu’est-ce que la clé de sauvegarde ?',
        a: [
          'Les sauvegardes sont chiffrées avec la clé de votre base. Sur cet ordinateur, MeuOsteo la connaît. Sur un nouvel ordinateur, il faudra la saisir pour restaurer.',
          'Dans Paramètres > Sauvegarde, cliquez sur « Afficher la clé de sauvegarde… », imprimez-la et rangez-la avec votre clé de secours. Ne l’envoyez pas par e-mail.',
          'Ne la confondez pas avec la clé de secours : la clé de secours sert à changer un code d’accès oublié, la clé de sauvegarde sert à ouvrir vos sauvegardes sur un autre PC.',
        ],
      },
      {
        q: 'Comment restaurer une sauvegarde ?',
        a: [
          'Paramètres > Sauvegarde > « Restaurer une sauvegarde… », puis choisissez le fichier .mosave.',
          'MeuOsteo vérifie que le fichier est intact, fait d’abord une copie de l’état actuel par sécurité, puis remplace les données et redémarre.',
          'Si la sauvegarde vient d’un autre ordinateur, la clé de sauvegarde de cet ordinateur-là vous est demandée (64 caractères).',
        ],
      },
      {
        q: 'Mes données sont-elles protégées ?',
        a: [
          'Oui. La base est chiffrée sur le disque, et sa clé est protégée par Windows pour votre session. Le code d’accès protège l’écran en plus.',
          'Rien ne part sur internet, sauf vers votre propre compte Gmail (envoi des factures et des e-mails aux patients). Il n’y a aucune statistique d’utilisation.',
          'Le journal (Paramètres > Journal) note les actions importantes : patients créés, modifiés ou supprimés, factures, déverrouillages, réglages sensibles. Il ne contient jamais de contenu médical : ni motif, ni anamnèse, ni pratique, ni commentaire.',
          'Attention : l’export complet (« Exporter toutes les données (Excel) ») contient, lui, les notes cliniques et n’est pas chiffré. Gardez ce fichier en lieu sûr.',
        ],
      },
    ],
  },
  {
    id: 'tableau',
    title: 'Tableau de bord et bilan',
    intro: 'Un coup d’œil sur votre activité du mois et de l’année, et le bilan de fin de mois.',
    questions: [
      {
        q: 'Comment faire mon bilan de fin de mois ?',
        a: [
          'Menu « Bilan mensuel ». Choisissez le mois avec les flèches. La liste reprend les séances encaissées dans le mois : espèces et chèques le jour de la séance, virements le jour où vous les avez marqués reçus.',
          'Décochez une séance pour ne pas la compter ; les virements encore attendus apparaissent « En attente », décochés, et peuvent être cochés.',
          'Le moyen de paiement se corrige dans la liste : la correction ne vaut que pour le bilan, la séance et la facture ne changent pas.',
          '« Exporter (Excel) » produit un fichier avec le détail, le récapitulatif par moyen de paiement et le calcul.',
        ],
      },
      {
        q: 'Pourquoi le chiffre du tableau de bord diffère-t-il de celui du bilan ?',
        a: [
          'Ils ne mesurent pas la même chose. Le tableau de bord compte le chiffre d’affaires réalisé : les séances faites dans le mois, payées ou non. Le bilan compte l’argent encaissé dans le mois.',
          'L’écart vient des virements encore attendus, des virements reçus un autre mois, et des séances que vous avez cochées ou décochées dans le bilan. L’encart « Réalisé et encaissé » du bilan détaille ce passage, montant par montant.',
        ],
      },
      {
        q: 'Comment comparer mon année avec la précédente ?',
        a: [
          'Sur le Tableau de bord, le graphique relie les points de chaque mois : l’année affichée en bleu, avec son montant au-dessus de chaque point, et la précédente en gris. Les pointillés horizontaux marquent les seuils (1 000 €, 2 000 €…). Survolez un mois pour lire les deux montants et l’évolution.',
          'Pour l’année en cours, le résumé compare le total à ce jour avec l’année précédente à la même date, puis rappelle le total de l’année précédente. Les flèches ‹ › changent d’année.',
        ],
      },
      {
        q: 'Comment est calculé « À garder sur le compte pro » et le salaire possible ?',
        a: [
          'Renseignez une fois pour toutes « Réglages du calcul » : votre taux de cotisations (donné par l’URSSAF ou votre comptable), une réserve de sécurité facultative, vos frais fixes et vos provisions, chacun par mois ou par an.',
          '• À garder sur le compte pro = cotisations + réserve + 1/12 des frais annuels + provisions.',
          '• Salaire possible = chiffre d’affaires retenu − ce qu’il faut garder − frais mensuels − dépenses exceptionnelles du mois.',
          'Si le mois ne couvre pas tout, MeuOsteo affiche le montant qui manque au lieu d’un salaire. Ce calcul est une aide : il ne remplace pas votre comptable.',
        ],
      },
      {
        q: 'Que signifient les quatre compteurs ?',
        a: [
          '• Séances ce mois : les séances réalisées depuis le début du mois, comparées au mois précédent.',
          '• Chiffre d’affaires : le total des tarifs des séances réalisées ce mois-ci, facturées ou non. En dessous, le total de l’année.',
          '• Nouveaux patients : les fiches créées ce mois-ci (les patients repris de l’ancien outil ne comptent pas). En dessous, le nombre total de patients.',
          '• En attente de paiement : le montant des séances réalisées réglées par virement pas encore reçu.',
          'Les séances annulées ou pas encore validées ne sont pas comptées.',
        ],
      },
      {
        q: 'Que montre le graphique ?',
        a: [
          'Le chiffre d’affaires des 12 derniers mois, mois par mois, selon la date des séances réalisées. Le mois en cours est mis en avant. Survolez une barre pour voir le montant.',
        ],
      },
      {
        q: 'À quoi sert la liste « Paiements en attente » ?',
        a: [
          'Elle liste les séances réglées par virement que vous n’avez pas encore reçu. Quand l’argent arrive, cliquez sur « Marquer reçu » : la séance, et sa facture si elle en a une, passent en réglées.',
          'En dessous, « Dernières factures » rappelle les dernières factures émises.',
        ],
      },
    ],
  },
]
