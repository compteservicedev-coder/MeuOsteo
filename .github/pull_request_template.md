## Ce qui change

<!-- En quelques lignes : le besoin, puis ce que fait la PR. Lien vers l'issue si elle existe. -->

## Règles métier couvertes

<!-- R-xx de docs/SPEC.md ajoutées ou modifiées, avec leurs tests. « Aucune » si la PR n'en touche pas. -->

## Vérifications

- [ ] `npm run lint`, `npm run typecheck`, `npx prettier --check .` et `npm test` passent
- [ ] `npm run e2e` passe (si un parcours de l'interface change)
- [ ] Aucune donnée réelle (patients, `.db`, `.xlsm`, `.eml`, captures) n'est ajoutée
- [ ] Rien de médical ni de nom de patient n'est écrit dans les logs
- [ ] La documentation (`docs/`, README) est à jour si un comportement ou une commande change
