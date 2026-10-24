# Maquette validée (sources)

Ces fichiers sont les sources de la maquette interactive publiée sur claude.ai : https://claude.ai/artifact/JGyPUB5csPpxNqpd5fTYNm

Ils utilisent un format propre à l'outil de maquette (`<x-dc>`, `<sc-for>`, `<sc-if>`, une classe `Component` avec `renderVals()`) et **ne s'exécutent pas seuls**. Il faut les lire comme une référence :
- **libellés exacts** de l'interface ;
- **styles inline** : couleurs, rayons, ombres, espacements ;
- **règles d'animation** : bloc `<style>` en tête de chaque fichier ;
- **comportements** : la logique de démonstration se trouve dans le `<script>` en fin de fichier (statuts, validations, filtres, rapprochement…).

Les données présentes sont **fictives**.

| Fichier | Écran | SPEC |
|---|---|---|
| `Splash.dc.html` | Ouverture et code | §2 |
| `Planning.dc.html` | Planning sur deux semaines, nouveau RDV, blocages, rapprochement | §3 |
| `Main.dc.html` | Patients | §4 |
| `Fiche.dc.html` | Fiche patient, proches, séances, émission de facture | §5 |
| `Facture.dc.html` | Registre des factures | §6 |
| `FacturesPatient.dc.html` | Registre filtré sur un patient | §6 |
| `Dashboard.dc.html` | Tableau de bord | §7 |
| `Parametres.dc.html` | Paramètres en onglets | §8 |
