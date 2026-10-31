# Contribuer à MeuOsteo

Merci de votre intérêt ! MeuOsteo est un logiciel libre (GNU AGPL-3.0) pour les ostéopathes qui travaillent seuls. Ce guide explique comment proposer une correction ou une évolution.

## Avant de commencer

- **Une faille de sécurité ne se signale jamais dans une issue publique** : suivez [SECURITY.md](SECURITY.md).
- Pour un bug ou une idée, ouvrez d'abord une issue (modèles « Bug » et « Idée »), afin d'en discuter avant d'écrire du code.
- Lisez [CLAUDE.md](CLAUDE.md) : il contient la stack imposée, l'architecture, les conventions et les **interdits absolus**. Les spécifications sont dans `docs/` (`SPEC.md` pour les écrans et les règles métier `R-xx`).

## Interdits absolus

- **Aucune donnée réelle** : jamais de patient, de fichier `.db`, `.xlsm`, `.xlsx`, `.eml` ou `.mosave` réel, ni de capture d'écran montrant de vraies données. Utilisez `npm run seed` (données fictives) et des fixtures anonymisées.
- **Aucune télémétrie, aucun service distant** en dehors de Gmail (IMAP/SMTP) et, en option, de la vérification de mise à jour sur GitHub Releases.
- **Aucun contenu médical ni nom de patient dans les logs** (anamnèse, pratique, motif, commentaire, objet d'e-mail…).
- **Dépendances gratuites, open source et compatibles avec l'AGPL-3.0** (MIT, Apache-2.0, BSD, ISC…).

## Mettre en place le projet

Prérequis : Node.js 22.12 ou plus récent.

```bash
npm install
npm run seed   # base fictive dans %APPDATA%\MeuOsteo-dev (~/.config/MeuOsteo-dev)
npm run dev
```

## Proposer une modification

1. Créez une branche depuis `main`.
2. Codez en suivant les conventions :
   - code, noms de fichiers et commits **en anglais** ; interface **en français**, avec les libellés de la maquette ;
   - commits au format [Conventional Commits](https://www.conventionalcommits.org/fr/) (`feat:`, `fix:`, `docs:`…) ;
   - une règle métier `R-xx` vit dans `src/shared/domain`, avec au moins un test dont le nom porte son numéro (`it('R-11 numérotation continue…')`) ;
   - les écritures liées se font dans une seule transaction ;
   - montants en centimes, dates ISO, accessibilité (vrais boutons et libellés, cibles de 44 px, focus visible).
3. Vérifiez avant de pousser :

   ```bash
   npm run lint && npm run typecheck && npx prettier --check . && npm test
   npm run e2e    # parcours critique (Linux : xvfb-run -a npm run e2e)
   ```

4. Ouvrez une pull request en remplissant le modèle. La CI doit être verte et produire l'installateur.

## Licence des contributions

En proposant une contribution, vous acceptez qu'elle soit publiée sous la licence du projet (GNU AGPL-3.0 ou toute version ultérieure), et vous déclarez en avoir le droit (code écrit par vous ou compatible avec cette licence).

Le mainteneur se réserve la possibilité de proposer aussi MeuOsteo sous une licence commerciale (double licence) : en contribuant, vous l'autorisez à distribuer votre contribution sous une telle licence également. Si cela vous pose problème, dites-le dans la pull request avant qu'elle soit fusionnée.
