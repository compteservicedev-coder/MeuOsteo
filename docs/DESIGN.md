# Charte graphique et interactions

Les sources de référence sont dans `docs/maquette/*.dc.html` : on y trouve les styles exacts de chaque composant. Ce document en fixe les règles générales, qui se traduisent dans `tailwind.config.ts` et dans des composants partagés.

## Couleurs (tokens)
| Token | Valeur | Usage |
|---|---|---|
| `navy-900` | `#0A1433` | bas du menu latéral, fond de l'écran d'ouverture |
| `navy-800` | `#132A6B` | haut du menu latéral |
| `royal-700` | `#17338F` | textes sur fond clair bleuté, bandeaux |
| `royal-600` | `#1F4FD8` | **couleur principale** : boutons, sélection, liens |
| `royal-500` | `#3B6CF6` | haut du dégradé des boutons principaux |
| `royal-50` | `#E6EEFF` | fonds de sélection, badges neutres |
| `cyan-500` | `#0EA5C6` | accent, anneau de focus, jour courant |
| `cyan-400` | `#22C3D6` | dégradés du logo, éclats |
| `aqua-300` | `#5EEAD4` | vert d'eau : pastilles « en ligne », icônes du bandeau |
| `aqua-50` | `#E3FAF5` | succès, réglé, commentaire inter-séances (texte `#0F4C45`) |
| `amber-500` | `#E0922F` | en attente, à rapprocher, blocages, déverrouillage |
| `amber-50` | `#FCF1E3` | fond des états d'attente (texte `#8A4B08`) |
| `red-600` | `#C2272D` | destructif (supprimer, abandonner) ; fond `#FDECEC`, texte `#A3161C` |
| `ink-900` | `#141B2D` | texte principal |
| `ink-600` | `#3A4560` | texte secondaire |
| `ink-500` | `#586380` | libellés discrets (contraste AA sur blanc) |
| `line` | `#E1E6EF` / `#D4DBE8` | bordures |
| `bg` | `#EEF2F8` | fond général, avec un halo radial `#D6E7FA` en haut à gauche |

**Répartition** : le bleu est la couleur de l'action et de la sélection, le vert d'eau celle de ce qui est réglé, enregistré ou du commentaire, et l'orange celle de ce qui attend une action. Le rouge est réservé au destructif.

## Typographie
**Figtree** (Google Fonts, licence OFL), **embarquée** dans l'application car celle-ci fonctionne hors ligne.
- **Titres** : 26 à 28 px, graisse 800, espacement −0,01em.
- **Sections** : 16 à 17 px, graisse 800.
- **Corps** : 15 px.
- **Libellés** : 13 px, graisse 600.
- **Petits textes** : 12 px.
- **Chiffres** : `font-variant-numeric: tabular-nums`.

## Relief
- **Rayons** : cartes 20 à 22 px ; champs et boutons 12 px ; pastilles 999 px.
- **Ombre des cartes** : `inset 0 1px 0 #fff, 0 1px 2px rgba(15,30,70,.06), 0 16px 36px -18px rgba(15,30,70,.25)`.
- **Bouton principal** : dégradé `#3B6CF6 → #1F4FD8`, `inset 0 1px 0 rgba(255,255,255,.25)`, ombre colorée `0 10px 22px -10px rgba(31,79,216,.8)`.
- **Bouton secondaire** : dégradé `#FFF → #F0F4FA` et bordure `rgba(15,30,70,.08)`.
- **Champs** : fond `#F7F9FC` et ombre intérieure légère. Au focus : bordure royale et anneau `0 0 0 4px rgba(31,79,216,.16)`. En erreur : bordure `#D92D20` avec un anneau rouge.
- **Lecture seule** : texte simple, sans cadre, pour une séance réalisée.
- **Segments** (tarif, paiement, filtres) : rail creusé `#EDF2F9` avec ombre intérieure. L'option active est un bouton bleu en relief.

## Mouvement (Framer Motion)
- **Courbe par défaut** : `cubic-bezier(.2,.8,.2,1)`. Durées : 250 ms pour les micro-interactions, 450 à 650 ms pour les entrées.
- **Entrée d'écran** : apparition en cascade (fondu + translation de 16 px + échelle 0,98), 60 ms entre chaque élément.
- **Boutons** :
  - **Survol** : soulèvement de 2 px et ombre renforcée.
  - **Appui** : `scale(.965)`, puis une **onde** qui part du centre (pseudo-élément radial).
- **Sélection** (tarif, statut, filtres) : petit rebond `scale(.88 → 1)` avec un ressort.
- **Changement de séance** : glissement depuis la droite de 18 px avec un fondu.
- **Accordéons** (groupes, panneau « À rapprocher ») : transition sur `grid-template-rows: 0fr → 1fr`.
- **Panneau latéral** : glisse depuis la droite. **Fenêtres** : zoom de 0,95 à 1 avec fondu, et voile `rgba(10,20,51,.5)` flouté.
- **Retours d'état** :
  - **Enregistrement** : roue qui tourne, puis coche qui se dessine (`stroke-dashoffset`).
  - **Validation refusée** : tremblement horizontal (450 ms).
  - **Facture émise ou supprimée** : tampon (rotation de −12°, échelle de 1,7 à 1).
  - **Mise à jour** : flash vert d'eau sur l'élément modifié.
  - **Tableau de bord** : compteurs animés sur 1,1 s, barres du graphique qui montent une à une.
- **Écran d'ouverture** : voir SPEC §2.
- **`prefers-reduced-motion`** : toutes les animations ramenées à 0,01 ms. Seuls les fondus sont conservés.

## Accessibilité
- **Contraste** : texte ≥ 4,5:1 (y compris les petits libellés gris).
- **Cibles** : 44 px minimum.
- **Focus** : anneau visible `2px #0EA5C6`.
- **Rôles ARIA** :
  - **Fenêtres** : Radix Dialog, avec `role=dialog` ou `role=alertdialog` et focus piégé.
  - **États** : `aria-pressed` pour les segments, `role=switch` pour les interrupteurs, `role=tablist` pour les Paramètres, `aria-current` pour l'élément actif du menu et de la liste.
- **Retours** : notifications en `role=status`, erreurs en `role=alert`.
- **Couleur** : ne jamais porter un sens par la couleur seule. Toujours un libellé ou une icône en plus (✓ / ✗, « En attente »).
