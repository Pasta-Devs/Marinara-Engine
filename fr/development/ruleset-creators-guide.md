# Guide de création d'ensembles de règles

Utilise cette page pour préparer un ensemble de règles Game Mode pour ton propre système sur table avant d'ouvrir les pages de référence. Elle explique comment les parties d'un ensemble de règles s'articulent, quels choix comptent le plus et ce que nous avons appris en convertissant 16 systèmes très différents. La référence clé par clé commence à [Écrire des ensembles de règles Game Mode](../extending/writing-rulesets.md), et chaque section ci-dessous renvoie à la page qu'elle résume.

Un ensemble de règles est un fichier JSON (ou un package de fichiers) qui indique à Marinara Engine comment fonctionne ton système. Le moteur lance ensuite chaque test, applique chaque modification de fiche et peut mener des combats entiers selon tes règles. Rien dans un ensemble de règles n'est du code : tu le conçois donc en renseignant des mécaniques que le moteur connaît déjà. Une mécanique qu'il ne connaît pas relève d'une demande de fonctionnalité pour le moteur.

Chaque clé ci-dessous indique la version mineure de Capability API qui l'a ajoutée. Un package qui utilise cette clé déclare cette version mineure ou une plus récente (voir [Versions, tests et publication](#versioning-testing-and-publishing)).

Deux termes se confondent facilement :

- **Classic et Tactical** sont des _styles de combat_ : une bataille à menus avec des rangées avant et arrière, ou une bataille sur un plateau. Toute partie, avec ou sans ensemble de règles, utilise l'un des deux.
- **Les règles propres à Marinara** sont celles qu'une partie utilise quand elle n'a pas d'ensemble de règles. Un ensemble de règles les remplace.

## Anatomie d'un ensemble de règles

Un ensemble de règles est un fichier JSON d'au plus 512 KB, validé en entier à l'importation. Les ensembles plus gros répartissent leurs catalogues dans un package. Commence par copier l'exemple le plus proche de tes dés :

- [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) : 2d6 plus un attribut.
- [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) : une réserve de d10.
- Le [package 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) complet dans Marinara-Agents.

Indique le [schéma JSON](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/extending/ruleset.schema.json) à ton éditeur avec une ligne `$schema` pour bénéficier de l'autocomplétion et des vérifications de fautes de frappe.

| Clé                                                            | Contenu                                                                                                      | Référence                                                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `id`, `version`, `name`, `edition`, `license` | Identité. `version` est un entier augmenté à chaque modification publiée                                             | [Écrire des ensembles de règles](../extending/writing-rulesets.md)                                                                                               |
| `coverage`                                                     | Ce que l'ensemble de règles prend en charge (tests, combat, etc.) et le résumé d'une ligne affiché dans l'assistant                              | [Écrire des ensembles de règles](../extending/writing-rulesets.md)                                                                                               |
| `resolution`                                                   | Comment se lance un test : un des cinq types, plus les bandes de résultat, les dépenses et les relances                                   | [Tests](../extending/ruleset-checks.md)                                                                                                           |
| `sheet`                                                        | Attributs, compétences, champs, listes, réserves vivantes, pistes, états, pistes de blessures, pénalités, migrations                  | [Fiches](../extending/ruleset-sheets.md)                                                                                                           |
| `party`, `clocks`                                              | Une fiche d'équipe partagée (équipage, vaisseau, points d'histoire) et des décomptes de progression                                                | [Fiches](../extending/ruleset-sheets.md)                                                                                                           |
| `rests`                                                        | Ce que chaque repos restaure et efface                                                                                 | [Fiches](../extending/ruleset-sheets.md)                                                                                                           |
| `gm`, `gmReference`                                            | Texte du GM (maître du jeu), résumé par personnage, qui joue les adversaires et référence de règles d'au plus 16,000 caractères | [Fiches](../extending/ruleset-sheets.md)                                                                                                           |
| `catalogs`                                                     | Entrées toutes prêtes (sorts, talents, créatures), chacune avec un bloc `mechanics` facultatif                           | [Catalogues](../extending/ruleset-catalogs.md), [Mécaniques](../extending/ruleset-mechanics.md), [Assistant de création](../extending/ruleset-character-builder.md) |
| `items`                                                        | Catégories, armes, armures, munitions, butin, argent, équipement de départ, marchés                                       | [Objets](../extending/ruleset-items.md)                                                                                                             |
| `battle`                                                       | Prête les nombres de ta fiche aux combats Classic et Tactical propres à Marinara                                           | [Combat](../extending/ruleset-combat.md)                                                                                                           |
| `combat`                                                       | Mène le combat entier selon tes règles, avec un bestiaire, un plateau, des réactions et des confrontations                                 | [Combat](../extending/ruleset-combat.md)                                                                                                           |
| `layers`                                                       | Variantes qu'un joueur active pour une partie (Low magic, magie rare ; Hard winter, hiver rude)                                                   | [Couches et traductions](../extending/ruleset-layers-and-translations.md)                                                                         |

**Identifiants.** L'identifiant de l'ensemble de règles se compose de minuscules, de chiffres et de tirets simples (`ember-roads`). Ceux de la fiche se composent de minuscules, de chiffres et de traits de soulignement, et commencent par une lettre (`grit_max`). Garde les identifiants stables après publication, car les personnages sauvegardés, les autres ensembles de règles qui empruntent tes catalogues et les surcouches d'Experience y font tous référence.

**Texte compatible avec les prompts.** Tout ce qui parvient au modèle (noms, libellés, texte du GM) tient sur une seule ligne, sans crochets ni `{{` ou `}}`.

**Packages.** Un ensemble de règles trop gros pour un seul fichier se distribue sous la forme `<id>.ruleset.json` : un manifeste plus `ruleset.json`, jusqu'à 12 fichiers `catalogs/<id>.json` de 2 MB chacun et jusqu'à 40 traductions, tous en base64. Les zips sont refusés. Un éditeur d'ensembles de règles comme Pixelforge crée ce fichier pour toi. Le manifeste déclare la version mineure de Capability API dont ton ensemble de règles a besoin.

**Classement d'un ensemble de règles.** Un fichier importé devient `local/<id>`, celui d'un dépôt GitHub devient `<owner>/<id>` et celui du catalogue officiel conserve son identifiant simple. Deux auteurs peuvent chacun publier un `v20` sans conflit.

## Tests, dés et fiche

Ton premier choix, et le plus important, est `resolution.kind`, car tout le reste se lit à travers lui. Le GM ne fait que nommer une compétence et une difficulté. Le moteur lance les dés, fait les calculs à partir de la fiche et transmet le résultat au modèle : n'écris donc jamais de texte du GM qui demande au modèle de faire des calculs.

| Type           | Comment se lance le test                                                                                                                             | Systèmes adaptés                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `dice-sum`     | Lance des dés, ajoute les nombres de la fiche et atteint ou dépasse une difficulté. Les faces personnalisées, les chaînes ouvertes et les dés explosifs sont pris en charge                | Jeux d20, 2d6 plus attribut, Fate (4dF avec des faces −1/0/+1), Rolemaster  |
| `dice-pool`    | Lance un nombre de dés lu sur la fiche et compte ceux qui atteignent une cible. La cible peut venir de la fiche, varier par test, être à dépasser ou à ne pas dépasser | World of Darkness, Exalted, jeux proches de Shadowrun, Lasers & Feelings     |
| `dice-highest` | Lance une réserve et lis le dé le plus haut, ou additionne les quelques plus hauts. Une règle à zéro dé et un second jeu de dés "sombres" sont pris en charge                        | Blades in the Dark et autres jeux Forged in the Dark, Trophy Dark |
| `roll-against` | Obtiens un résultat inférieur ou égal (ou supérieur ou égal) au nombre de la fiche                                                                                            | Call of Cthulhu, GURPS, BRP, systèmes à l'ancienne avec X chances sur 6                     |
| `symbol-pool`  | Constitue et améliore des dés narratifs, annule les symboles opposés                                                                                | Genesys et systèmes similaires                                                |

Ajoute ensuite ce dont ton système a besoin. Tout figure dans [Tests des ensembles de règles](../extending/ruleset-checks.md) :

- **Bandes de résultat** (`resolution.outcomes`, 1.135) : deux à huit résultats libellés selon la marge ou le total, comme les degrés de réussite, la "réussite à un prix" ou les réussites majeures et extrêmes. Chaque bande peut porter une ligne expliquant au GM ce qu'elle signifie à la table. C'est la fonctionnalité dont les systèmes que nous avons convertis avaient le plus souvent besoin.
- **Tests qui se lancent à leur façon** (`resolution.overrides`, 1.140) : quelques compétences sur des dés différents, comme les compétences de voleur au d100 et Open Doors au d6 dans un jeu d20.
- **Dépenser pour modifier un jet** (`resolution.spend`) et relances gratuites (`resolution.reroll`) : de la volonté pour une réussite, de la Chance, des points d'héroïsme. `perCheck` limite ce qu'un seul jet peut acheter, pour qu'une réserve pleine ne puisse pas garantir la réussite.
- **Un charme qui modifie un jet** : place `mechanics.check` sur l'entrée de catalogue qu'un personnage a choisie ; son coût est payé selon celui de l'entrée.

**Ce qu'un test ne peut pas encore faire.** Les réserves opposées (comparaison des jets de deux participants) et les réserves dont on additionne les dés avec un dé libre, comme dans OpenD6. Les deux nécessitent un nouveau type de résolution dans le moteur. Si ton système dépend de l'un d'eux, ouvre une demande de fonctionnalité sur le dépôt du moteur avec quelques jets détaillés ; ils deviendront les tests.

**La fiche** ([Fiches des ensembles de règles](../extending/ruleset-sheets.md)) contient les attributs, les compétences, les champs, les listes et les valeurs dérivées, ainsi que l'état en cours que le moteur modifie pendant le jeu :

- **Réserves** comme les points de vie, la volonté, les points d'essence ou les emplacements de sort, dépensés et restaurés par les commandes de fiche et les repos.
- **Pistes** comme le stress, Ruin ou les XP, avec des déclencheurs lorsqu'elles sont pleines.
- **Pistes de blessures**, pour une santé représentée par des niveaux nommés ou des cases numérotées plutôt que par un nombre, avec des pénalités aux jets.
- **États vivants** comme une forme, une posture ou une anima, qui peuvent modifier les jets tant qu'ils se maintiennent.
- **Fiche d'équipe et décomptes** : un équipage, un vaisseau ou des points d'histoire partagés, et des décomptes de progression à 4, 6 ou 8 segments.

Le GM modifie la fiche au moyen de commandes de fiche que le moteur lui enseigne automatiquement, avec tes propres identifiants : tu n'as donc pas à les expliquer dans `gm.sheetGuidance`. La progression permanente (XP, nouveaux points, montées de niveau) utilise les commandes de fiche des catalogues ; voir [Catalogues des ensembles de règles](../extending/ruleset-catalogs.md).

**Créer des personnages.** L'[assistant de création de personnages](../extending/ruleset-character-builder.md) guide le joueur dans des étapes que tu définis : origine et classe, scores (tirés aux dés, achetés ou attribués), maîtrises, sorts, équipement et argent de départ, avec des vérifications de conformité aux règles et la création de l'équipe partagée. Les catalogues peuvent emprunter le catalogue d'un autre ensemble de règles installé avec `from` (1.220) : une variante de 5e peut donc réutiliser les créatures et les sorts du SRD plutôt que les copier.

**Texte du GM.** `gm.checkGuidance` et `gm.sheetGuidance` (1,500 caractères chacun) sont envoyés à chaque tour : reste donc concis. `gm.worldGuidance` est lu une seule fois, à la création du monde ("pas de poudre à canon", "la magie est rare"). `gmReference` contient jusqu'à 16,000 caractères de règles plus détaillées dans le prompt système stable. `gm.sheetSummary` choisit ce que le modèle voit par personnage, et tout ce qui y figure coûte des tokens à chaque tour. Rédige tout dans tes propres mots, sans jamais copier le texte d'un livre de règles.

## Combat

Un ensemble de règles intervient dans les combats à l'un de trois degrés. Tu peux commencer par une intégration légère et l'approfondir ensuite. Choisis selon la place des combats dans l'identité de ton système.

| Degré          | Ce que tu écris                                                                        | Ce qui se passe pendant un combat                                                                                                                                   | Adapté à                                                          |
| -------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Aucun           | Aucun bloc `battle` ou `combat`                                                         | Le combat Classic ou Tactical propre à Marinara crée lui-même les combattants. La fiche reste intacte                                                              | Systèmes narratifs où les combats relèvent de la fiction (Fate, Blades, Trophy) |
| Prêter la fiche | Un bloc `battle` : réserve de santé, réserve d'énergie facultative, emplacements de sort, jusqu'à 8 listes de compétences | Les calculs et les dés de Marinara, mais la santé commence à la même proportion de la barre que sur la fiche, et le résultat y est réécrit                                  | Systèmes légers qui veulent conserver les conséquences                     |
| Tes propres règles | Un bloc `combat`                                                                      | Tes dés résolvent chaque attaque, sauvegarde et confrontation. Les adversaires viennent de ton bestiaire ou de ton échelle de menace, et chaque coût est inscrit sur la fiche au moment où il survient | Systèmes tactiques détaillés (5e, Pathfinder, Storyteller, Genesys)   |

**Le bloc `combat`** paramètre l'un des trois types que possède le moteur : `attack-vs-defense` (dés contre un nombre de défense), `dice-pool` (tes réserves, dont on compte les réussites) ou `symbol-pool` (dés narratifs avec dépenses, 1.382). Les éléments essentiels sont `health` (une réserve qui diminue, une piste de blessures que l'on marque ou une piste ordinaire qui se remplit, 1.383), `defense`, `initiative`, `attackRoll`, une économie d'actions `economy` et les listes qui deviennent `attacks` et `abilities`. Un petit bloc complet fait environ 25 lignes ; le bloc d'Ember Roads dans [Combat des ensembles de règles](../extending/ruleset-combat.md#combat-a-fight-your-own-rules-resolve) est un bon modèle.

Au-delà de ces bases, ajoute ce dont ton système a besoin :

- **États**, avec des effets issus d'une liste fermée (défense, jets d'attaque, sauvegardes, confrontations, vitesse, santé maximale, dégâts infligés et subis).
- **Sauvegardes**, concentration, règles de mort et réactions réservées à des **fenêtres** (une entrée peut attendre `used`, `aimed`, `hit`, `harmed`, `falls` ou `turn-start`).
- **Confrontations** pour saisir, bousculer et se libérer.
- **Créatures** : un catalogue de bestiaire lu par le combat, avec des blocs de statistiques, des actions, des sens et de l'incantation. Une **échelle de menace** permet au GM d'inventer un adversaire pour un combat, et `combat.threat.budget` (1.803) crée des rencontres selon un budget d'expérience par difficulté.
- **Mécaniques des entrées** sur les entrées de catalogue : formes de zone, zones persistantes, murs, invocations, guérisons et sens. Voir [Mécaniques des entrées des ensembles de règles](../extending/ruleset-mechanics.md).

**Classic ou Tactical.** Tes propres combats n'ont un plateau que si `combat` déclare `distance` (`label`, `perCell`) et si la fiche ou les créatures indiquent un déplacement. Sans cela, une partie Tactical joue quand même tes règles en théâtre de l'esprit. Si tes règles dépendent de la position (zones, allonge, prise en tenaille), définis `"styles": ["tactical"]` (1.379) pour que chaque partie utilisant ton ensemble de règles ait un plateau.

**Les illustrations des créatures** sont distinctes des règles : un [pack de créatures](../extending/writing-creature-packs.md) (`.creatures.json`, plus facile à créer dans Pixelforge) dessine ton bestiaire sur le plateau Tactical en faisant correspondre les identifiants des créatures. Tout ce qui n'a pas d'illustration garde un pion.

**Les limites connues** sont listées sous [Pas encore](../extending/ruleset-combat.md#not-yet). Celles que les conversions ont le plus souvent rencontrées étaient les jets de défense opposés (Esquive et Riposte, Parade et Blocage), les localisations des coups, l'initiative par camp et les réactions aux réactions. Le GM les raconte autour du combat du moteur.

## L'IA de combat : esprits, tempéraments et contrôle des adversaires

Le moteur joue chaque adversaire et compagnon IA que personne d'autre ne contrôle, sans appel au modèle à chaque tour. Il est indépendant de l'ensemble de règles : nous l'avons testé sur des conversions de Storyteller, Exalted, de systèmes à l'ancienne, de Call of Cthulhu, GURPS et Genesys, ainsi que de 5e. Il fonctionne sans aucune des clés ci-dessous ; elles font combattre tes créatures selon leur nature. Toutes figurent dans [Mécaniques des entrées des ensembles de règles](../extending/ruleset-mechanics.md), et la conception est décrite dans [IA de combat de Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-combat-ai.md).

| Clé                                                               | Ce qu'elle contrôle                                                                                                                                                                                                          | API            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `mind` sur une créature, ou paliers de `combat.minds` selon un attribut | Le degré de réflexion : `mindless`, `instinct`, `cunning`, `tactical`, `genius`. Par défaut, les bêtes sont instinctives, les créatures artificielles et les vases sans réflexion                                                                        | 1.761          |
| `behavior.temperament`                                            | Sa façon de combattre : reckless, cautious, opportunistic, protective, supportive, disciplined, cowardly, patient, methodical, coordinated                                                                                         | 1.763          |
| Tempéraments réservés à l'histoire                                           | `fanatical` (ne cède jamais), `arrogant` (se retient, s'envole s'il est légendaire et perd), `territorial`, `cruel`, `honourable` (propose **Surrender** (se rendre) à l'équipe), `hungry` (emporte une victime). Jamais attribués au hasard | 1.778 à 1.784 |
| `behavior.role`                                                   | bruiser, bulwark, skirmisher, marksman, spellcaster, supporter, controller, `solo` (1.776). Attribué d'après ses capacités s'il n'est pas indiqué                                                                                            | 1.763          |
| `behavior.targets`, `opens`, `pack`, `ambush`                     | Priorités de ciblage, action d'ouverture, tactiques de meute, attente en embuscade                                                                                                                                                       | 1.763          |
| `behavior.shifts`                                                 | Un tempérament qui change quand la créature passe sous la moitié de sa santé, qu'un allié tombe, que le chef tombe ou qu'elle est acculée                                                                                                                                 | 1.779          |
| `combat.morale`                                                   | Quand et comment les ennemis testent leur courage (2d6 sous un score, ou une sauvegarde), et qui se rend                                                                                                                                    | 1.762, 1.775   |
| `gm.opposition: "game-master"`                                    | Le GM joue chaque adversaire, en choisissant parmi les options légales du moteur, qui prend le relais en cas de besoin                                                                                                                | 1.774          |

`behavior` peut se placer sur le bloc `combat` entier, sur un type de créature ou sur un bloc de statistiques, chacun prenant le pas sur le précédent. Exemples du SRD : un loup `{"targets": ["wounded"], "pack": true}`, un gobelin `{"temperament": "cowardly", "targets": ["weakest"]}`, une goule `{"ambush": true}`.

**Pour les combats sur plateau, l'IA a besoin de** `combat.distance`, d'un déplacement (`combat.economy.movement` ou le `speed` d'une créature), d'une `range` sur les attaques à distance et les lignes d'armes, et d'une `area` sur tout ce qui touche une zone. Sans portée, un pistolet ne fonctionne qu'à bout de bras. Sans zones, l'IA ne disperse jamais ses combattants.

**Systèmes narratifs.** Par défaut, le moteur joue les ennemis ordinaires et le GM joue les boss. Pour un système où l'opposition relève de la fiction plutôt que des dégâts (Fate, Blades, Trophy, Lasers & Feelings), `gm.opposition: "game-master"` permet au modèle de jouer chaque adversaire selon son personnage. Cela ne prend effet que si le joueur a activé "GM directs bosses" lors de la configuration, car c'est ainsi qu'il consent aux appels au modèle pendant les combats.

**Sans bloc de combat**, tes parties ont quand même du moral dans les combats Classic et Tactical : chaque ennemi qui n'est ni un boss ni une créature sans réflexion reçoit un score de 2 à 12 selon son esprit et son tempérament, et les ennemis capables de réfléchir peuvent se rendre. L'auteur de la rencontre peut marquer le `leader` d'un camp.

**Tempérament de l'équipe.** Chaque membre de l'équipe reçoit un tempérament d'après sa Description au début d'une partie, et il ne change que pour des raisons narratives lors du bilan de fin de session. Les compagnons IA combattent selon ce tempérament. Un ensemble de règles ne le définit pas, mais ton texte du GM peut s'appuyer dessus.

## Couches, surcouches et migrations

Trois mécanismes modifient un ensemble de règles sans en créer une version dérivée. Utilise une couche pour une variante choisie par le joueur, une surcouche pour le contenu propre à une aventure et une migration quand tu remanies la fiche.

**Les couches** (`layers`, jusqu'à 12) sont des interrupteurs dans l'assistant **New Game** (nouvelle partie), fixés pour toute la durée de vie de cette partie. Une couche ne peut que restreindre ou ajouter du texte, jamais ajouter des règles :

- ajouter à la fin des consignes du GM (`gm.guidance`, `gm.worldGuidance` ; 4,000 caractères par couche) ;
- retirer des valeurs d'un champ énuméré, remplacer l'échelle de difficulté ou masquer des entrées de catalogue selon un filtre déclaré ;
- retirer des pièces (1.64), retirer des vendeurs du marché, marquer des objets comme non vendus ou remplacer des tables de butin (1.813) ;
- déclarer des `conflicts` avec d'autres couches.

Une couche ne peut pas ajouter de champ, de valeur, de compétence, de réserve, de repos, de vendeur ni de table de butin, changer le type de résolution ou toucher aux nombres de combat. Les personnages conservent tout ce qu'une couche retire. La couche **Low magic** du SRD est un bon modèle : sorts limités au niveau 5, objets au-dessus de peu commun plus rares et normalement pas à vendre, créatures très magiques exclues des rencontres aléatoires et consignes de monde demandant au GM d'expliquer pourquoi la magie est rare. D'autres auteurs peuvent la copier. Les couches écrites pour l'ensemble de règles de quelqu'un d'autre ne sont pas encore prises en charge.

**Les surcouches** (1.355) permettent au pack de cartes d'une Experience d'ajouter des créatures, des états, des états de fiche, des objets et des pistes (1.367) à ton ensemble de règles pendant que cette Experience est active. Garde les monstres et le butin propres à l'aventure dans une surcouche, pas dans ton ensemble de règles de base. Une surcouche qui réutilise l'un de tes identifiants, ou qui ne convient pas, est rejetée en entier : une raison de plus de garder les identifiants stables. Référence : [surcouches d'ensembles de règles](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/optional-agent-packages.md#capability-api-1355-ruleset-overlays).

**Les migrations** (`sheet.migrations`, 1.77) indiquent comment les personnages sauvegardés sont adaptés quand tu renommes un champ, divises un niveau en niveaux par classe ou scindes une réserve. Les ajouts ne nécessitent pas de migration ; augmente `sheet.version` quand la structure de la fiche change. Référence : [Couches, traductions et migrations](../extending/ruleset-layers-and-translations.md).

## Traductions

Écris l'ensemble de règles en anglais et distribue chaque autre langue dans son propre fichier de traduction (1.811). Les traductions ne concernent que l'affichage : les règles, les commandes de fiche et tout ce qui est transmis au GM restent en anglais, si bien qu'une traduction ne peut jamais casser une partie.

Une traduction utilise comme clé la chaîne anglaise, mot pour mot :

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

- Les codes de langue correspondent à ceux du moteur (`ru`, `pt-BR`, `zh-Hans`). Une chaîne manquante ou vide s'affiche en anglais, et `pt-BR` se replie d'abord sur `pt`.
- **Dans un fichier de package partagé**, place-les à `locales/<language>.json`, jusqu'à 40 fichiers de 8 MB chacun. L'importation ne conserve que la langue actuelle du moteur ; pour changer, change de langue et importe à nouveau.
- **Dans le catalogue officiel**, chaque langue est un pack distinct, `<id>-<version>.<language>.json`, listé sous `locales` dans l'entrée du catalogue avec son URL, son sha256, sa taille et un nom et une description traduits pour la boutique. Le moteur ne télécharge que le pack de sa langue actuelle et le remplace quand la langue change. Inclure les 11 langues du SRD dans un seul fichier faisait passer le téléchargement de 7 MB à 34 MB : c'est pourquoi les packs sont distincts.
- Une traduction corrigée ne nécessite pas de nouvelle `version`.

Le package du SRD distribue 11 langues de cette manière et sert de modèle à copier. Référence : [Traductions](../extending/ruleset-layers-and-translations.md#translations).

## Le package 5e (SRD 5.1) : un exemple complet

Le [package ruleset-5e-2014](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) dans Marinara-Agents utilise presque toutes les fonctionnalités de cette page : consulte-le quand tu veux voir une clé en usage réel. Voici ce qui mérite d'être repris :

- **Structure** : `ruleset.json` plus un fichier par catalogue sous `catalogs/` (créatures, sorts, objets magiques et autres), assemblés en un package `.ruleset.json`. Son README et son MODELING.md expliquent comment chaque règle a été modélisée.
- **Licence** : attribution CC BY 4.0 sous `license`, une mention d'absence d'affiliation et aucun nom de produit déposé où que ce soit.
- **Combat complet** : un bloc `attack-vs-defense` au d20 avec des budgets d'action, d'action bonus et de réaction, de la concentration, des réactions comme Shield et Counterspell, un plateau, un bestiaire complet avec esprits et tempéraments et un budget de rencontre.
- **Assistant de création** : race, classe, scores tirés aux dés ou achetés, maîtrises, sorts et équipement de départ.
- **Une couche** (Low magic) et **11 traductions** sous forme de packs à la demande.
- **Identifiants stables** : d'autres ensembles de règles empruntent ses créatures et ses sorts ; ses identifiants ne changent donc jamais.
- **Tests de non-régression** exécutés dans leur propre tâche de CI à chaque modification.

Si ton système est une variante de d20, envisage d'emprunter ses catalogues avec `from` (1.220) plutôt que de les copier.

## Concevoir des systèmes similaires : les leçons des conversions

Nous avons converti à ce format 16 systèmes issus d'une collection communautaire, des jeux narratifs aux règles légères jusqu'à Rolemaster. La plus grande leçon : ici, un ensemble de règles est appliqué, pas suggéré. Le moteur lance chaque test et applique chaque modification de fiche : tout ce que tu laisses à "le GM s'en chargera" reste donc réellement sans prise en charge. Décide tôt de ce que le moteur gère et de ce que le GM raconte.

| Famille de systèmes      | Exemples                            | Résolution     | Clés qui ont permis le fonctionnement                                                                                                       | Laissé au GM                                                      |
| ------------------ | ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Systèmes détaillés d20 et d%  | 5e, Pathfinder 2e, Rolemaster       | `dice-sum`     | Bandes de résultat pour les degrés de réussite ; `openEnded` et `unmodified` pour Rolemaster ; `gmReference` pour les grandes tables              | Types de bonus non cumulables de Pathfinder ; tables de critiques de Rolemaster au-delà des bandes |
| À l'ancienne         | OSE                                 | `dice-sum`     | `resolution.overrides` pour les compétences de voleur (d100) et X chances sur 6 (d6) ; moral à 2d6                                                   | Initiative par camp (jouée individuellement)                                       |
| Jets sous un seuil         | Call of Cthulhu 7e, GURPS Lite      | `roll-against` | `against`, dés `tens` de bonus et de pénalité, faces critiques, bandes majeures et extrêmes                                             | Esquive, Riposte et Parade opposées ; localisations des coups de GURPS                        |
| Réserves Storyteller  | V20, W20, Exalted 3e, Exalted WoD   | `dice-pool`    | Pistes de blessures avec pénalités, états vivants (formes, anima), règles de remplacement pour les 1 qui n'annulent pas, bloc `combat` fondé sur les réserves    | Disciplines et Dons de zone, sauf s'ils sont écrits comme des entrées                         |
| Forged in the Dark | Blades in the Dark, Trophy Dark     | `dice-highest` | `keep`, `zeroDice`, jeu de dés `dark`, bandes (6 / 4 à 5 / 1 à 3), pistes avec `onFull`, décomptes, fiche d'équipe pour l'équipage | Combats, par `gm.opposition: "game-master"`                               |
| Réserves selon la posture       | Lasers & Feelings, un jeu original | `dice-pool`    | `target` lu sur la fiche, `stances` (en dessous ou au-dessus), `exact` pour une égalité exacte, fiche d'équipe pour le vaisseau               | Combats, dans la fiction                                                           |
| Fate               | Fate Core                           | `dice-sum`     | Faces personnalisées pour 4dF, bandes pour une égalité et une réussite avec style                                                                 | Invocations et contraintes dans l'histoire ; combats dans la fiction                              |
| Dés narratifs     | Genesys                             | `symbol-pool`  | `combat.kind: "symbol-pool"` avec `symbols.spends`, absorption et santé sur une piste de Blessures qui se remplit                               | Dépenses sur les tests hors combat                                              |

**Conseils pratiques issus de ces conversions :**

1. **Commence par les dés, puis la fiche, puis le texte du GM.** Fais fonctionner correctement un test avant d'ajouter des catalogues ou du combat.
2. **Utilise des bandes de résultat partout où ton système en a.** Le `text` de chaque bande indique au modèle ce qui se passe à la table, là où prennent vie les systèmes narratifs.
3. **Préfère l'absence de bloc de combat à un bloc à moitié correct.** Un système narratif se joue mieux avec les combats propres à Marinara (ou des adversaires joués par le GM) qu'avec un bloc de combat qui ne modélise ses règles qu'à moitié.
4. **Si tu écris un bloc de combat, donne-lui les bases du plateau** : `distance`, déplacement, portées sur les armes à distance et au moins une attaque de zone. Il en manquait dans chaque conversion que nous avons testée avec l'IA, et ses combats se bloquaient ou n'utilisaient jamais le placement.
5. **Vérifie le déplacement par rapport à ton échelle.** À 2 mètres par case, une créature avec une vitesse de 2 ne pouvait pas gravir les collines et les combats se bloquaient.
6. **Consigne tes sources.** Garde un fichier de notes par ensemble de règles, qui liste chaque règle source et la manière dont elle a été convertie, surtout lorsque tu as choisi entre des interprétations contradictoires. C'est la première chose que demandent les relecteurs.
7. **Quand il manque vraiment une mécanique au moteur**, confie-la au GM dans `gmReference` et ouvre une demande de fonctionnalité avec des exemples détaillés. Beaucoup de fonctionnalités de cette page (bandes de résultat, `dice-highest`, `roll-against`, combats à symboles, décomptes, fiches d'équipe) existent parce qu'une conversion en a eu besoin.

<a id="versioning-testing-and-publishing"></a>

## Versions, tests et publication

**Deux numéros de version comptent.** La `version` de ton ensemble de règles est un entier que tu augmentes à chaque modification publiée. Une version installée n'est jamais réécrite, et chaque partie reste liée à la version exacte sur laquelle elle a été créée : une campagne en cours ne change donc jamais de calculs. La version de **Capability API** indique les fonctionnalités du moteur dont ton fichier a besoin. Le manifeste d'un package déclare `schemaVersion: 2` et `capabilityApi: { "major": 1, "minor": N }`, où N est la version mineure la plus élevée de toutes les clés que tu utilises, pour qu'un moteur plus ancien ne se voie jamais proposer ton ensemble de règles. Les ensembles de règles du catalogue officiel nécessitent au moins 1.374. Un fichier simple que tu importes n'a besoin de rien, car le moteur qui le lit le valide.

**Le cycle de rédaction.** Modifie, augmente `version`, importe, commence une nouvelle partie. Importer la même version avec un contenu différent est refusé. Les anciennes versions restent installées jusqu'à ce que tu retires l'ensemble de règles. Augmente `sheet.version` quand la structure de la fiche change et écris une migration quand des valeurs sont déplacées.

**Tests.**

- Utilise la ligne `$schema` pour que ton éditeur repère les fautes de frappe et les mauvais types pendant la rédaction.
- Importe-le : active **Settings → Advanced → Danger Zone → Allow custom Agent imports** (Paramètres → Avancé → Zone de danger → autoriser l'importation d'agents personnalisés), puis utilise **Agents → Import agents → Game Mode ruleset** (Agents → importer des agents → ensemble de règles Game Mode). L'examen liste chaque problème avec son chemin avant tout enregistrement, y compris les noms qui ne désignent rien.
- Joue quelques tests de chaque type déclaré, y compris les règles de remplacement, les dépenses et chaque bande de résultat. Le journal montre les calculs réels.
- Si tu as un bloc `combat`, combats en Classic et en Tactical, avec des compagnons IA, contre des créatures de chaque esprit. Surveille les blocages (personne ne peut atteindre personne), les tirs alliés des zones et les ennemis qui n'utilisent jamais leurs meilleures actions.
- Active et désactive chaque couche, et change la langue du moteur si tu distribues des traductions.
- Si une Experience applique une surcouche à ton ensemble de règles, `POST /api/game/experience/check` signale ce qui ne convient pas.
- Demande à un testeur qui ne connaît pas ton système de créer un personnage avec l'assistant de création.

**Publication.** Il existe cinq voies, en commençant par la plus simple (détails dans [Partager ton ensemble de règles](../extending/writing-rulesets.md#sharing-your-ruleset)) :

1. Envoie le fichier `.json`.
2. Envoie un package `.ruleset.json`, avec les catalogues et les traductions à l'intérieur.
3. Place-le dans un dépôt GitHub public sous `rulesets/` (au plus 32 fichiers). Les utilisateurs ajoutent le dépôt comme source personnalisée, et l'ensemble de règles est classé sous ton nom GitHub.
4. Propose-le pour le catalogue officiel avec une pull request sur [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), structuré comme `ruleset-5e-2014`. Cette voie s'adresse aux systèmes largement joués dont la licence est claire.
5. Distribue une Experience dont le pack de cartes ajoute le contenu de l'aventure à ton ensemble de règles par une surcouche.

**Licence.** Ne publie que du texte de règles que tu as le droit de partager. Beaucoup de systèmes ont un document de référence sous licence ouverte ; place son identifiant SPDX et l'attribution requise sous `license`. Un ensemble de règles a surtout besoin de noms et de nombres : rédige donc tout le texte du GM dans tes propres mots.

### Avant de partager

- [ ] Les identifiants sont définitifs et respectent les règles de nommage.
- [ ] `license` contient l'identifiant SPDX et l'attribution, et aucun nom déposé n'est utilisé sans autorisation.
- [ ] Chaque type de test, règle de remplacement, dépense et bande a été joué au moins une fois dans une partie.
- [ ] `gm.checkGuidance` et `gm.sheetGuidance` sont courts, ne demandent jamais au modèle de faire des calculs et sont rédigés dans tes propres mots.
- [ ] Des combats ont été joués dans chaque style autorisé par ton ensemble de règles, ou `combat.styles` les limite.
- [ ] Le manifeste du package déclare la bonne version mineure de Capability API.
- [ ] `version` a été augmenté depuis le dernier fichier que quelqu'un d'autre possède.
- [ ] Un fichier de notes explique comment chaque règle source a été convertie.

## Guides associés

- [Écrire des ensembles de règles Game Mode](../extending/writing-rulesets.md)
- [Architecture de Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-mode-architecture.md), pour modifier le code des règles du moteur
- [IA de combat de Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-combat-ai.md)
- [Jouer avec un ensemble de règles](../game/rulesets.md)
