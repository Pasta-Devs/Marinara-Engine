# Game Mode : l'équipe et les PNJ

Ce guide explique qui peuple ta campagne Game Mode : les membres de l'équipe et les PNJ (personnages non-joueurs) que le Game Master (le maître du jeu) fait entrer en scène. Au programme : ouvrir la feuille de personnage d'un membre de l'équipe, la modifier ou la régénérer, et lire l'Adventure Journal (le journal d'aventure), étiquettes de réputation des PNJ comprises. Les deux modes de Game Master sont expliqués eux aussi.

Game Mode est l'un des modes de chat de Marinara Engine. Il fait tourner un RPG (jeu de rôle) solo mené par un Game Master piloté par l'IA, souvent abrégé en GM. Pour la configuration et les bases, voir [Game Mode : premiers pas](getting-started.md).

## La barre d'équipe

La barre d'équipe montre les personnages qui voyagent avec toi. Elle se trouve près du haut de l'écran de jeu.

Sur un écran d'ordinateur, c'est une rangée horizontale de petits portraits de personnages. Sur un téléphone, la barre se réduit à un seul avatar. Dès que l'équipe compte plus d'un membre, cet avatar affiche un badge avec le nombre. Touche-le pour ouvrir la liste des membres de l'équipe. S'il n'y a qu'un membre, toucher l'avatar ouvre directement sa feuille de personnage.

Voici ce que tu peux faire depuis la barre d'équipe :

1. Clique ou touche un portrait pour ouvrir la feuille de personnage correspondante.
2. Survole un portrait (sur ordinateur) pour faire apparaître un petit bouton **X**.
3. Clique sur le bouton **X** pour retirer ce personnage de l'équipe.

Tu peux retirer n'importe quel compagnon recruté par le Game Master, qu'il ait rejoint l'équipe pendant la configuration ou plus tard dans l'histoire. Ton persona est le personnage que tu incarnes. Il n'a pas de bouton **X** : impossible de te retirer toi-même de l'équipe.

## Les feuilles de personnage

La feuille de personnage est un résumé, propre au jeu, d'un membre de l'équipe. Elle est distincte de la fiche de personnage. Le Game Master la rédige à partir du personnage et de l'histoire en cours.

Pour ouvrir une feuille, clique sur le portrait du personnage dans la barre d'équipe. La feuille affiche celles de ces sections qui contiennent quelque chose :

- **Attributes** (attributs) : des scores à la manière du jeu de rôle sur table, comme STR, DEX et CON, chacun avec son modificateur.
- **Stats** (caractéristiques) : des barres de ressources comme HP ou MP.
- **Abilities** (capacités) : ce que le personnage sait faire.
- **Strengths** (forces) et **Weaknesses** (faiblesses) : de courtes listes.
- **Details** (détails) : des informations supplémentaires comme Skills, Weapon ou Faction.
- **Inventory** (inventaire) : les objets que transporte le personnage.
- **Traits** (traits) : les autres champs personnalisés.

Si un personnage vient d'apparaître, tu peux voir "Character data will populate as the story progresses." La feuille se remplit au fil de la partie.

### Régénérer une feuille avec l'IA

Clique sur le bouton **Regenerate Sheet** (régénérer la feuille) pour que l'IA réécrive la feuille du personnage. Elle s'appuie sur le personnage et sur le contexte de jeu en cours. Pratique quand l'histoire a beaucoup fait évoluer un personnage.

### Modifier une feuille à la main

Clique sur le bouton **Edit Sheet** (modifier la feuille) pour retoucher la feuille toi-même. En mode édition, tu règles ceci :

- Le champ **Class** (classe) et une courte description, sous **Sheet Details**.
- **RPG Attributes** : active **Enable** pour suivre des jauges de type HP et des attributs. Le bouton **Add Pool** ajoute une barre (nom, valeur actuelle, valeur maximale et couleur). Le bouton **Add Attribute** ajoute un score comme STR.
- **Abilities**, **Strengths** et **Weaknesses** : le bouton **Add** ajoute une ligne.
- **Details** : le bouton **Add Detail** ajoute une information avec son intitulé.

Une fois terminé, clique sur le bouton **Save Sheet** (enregistrer la feuille). Le bouton **Cancel** abandonne les modifications.

<a id="the-ruleset-sheet"></a>

### Fiche de l'ensemble de règles

Dans une [partie avec ensemble de règles](dice-and-skill-checks.md#games-that-use-a-ruleset), chaque fiche commence par **Ruleset sheet**. Sa disposition dépend de l'ensemble. Sans ensemble, ce bloc n'apparaît pas.

- **Resources** présente valeur actuelle et maximum de santé, emplacements de sorts ou ressources de classe. Utilise plus, moins ou la saisie directe. **Temp** représente une réserve temporaire.
- **Tracks** contient des compteurs bornés, comme l'épuisement.

- **Wound tracks** (Pistes de blessures) affichent une rangée de cases plutôt qu'un nombre, pour les systèmes qui marquent les dégâts au lieu de les compter. Chaque case indique le nom de ce degré de blessure et ce qu'il retire à tes jets. Choisis d'abord le type de dégâts si l'ensemble de règles en propose plusieurs, puis utilise **Mark** (Marquer) ou **Clear one** (Effacer une marque). Tu peux aussi cliquer sur la prochaine case vide pour ajouter une marque, ou sur la dernière case marquée pour l'effacer ; les autres cases ne répondent pas aux clics. Une marque plus grave prend la case supérieure et pousse les plus légères vers le bas ; la ligne dessous indique la pénalité active et ce qui n'a pas tenu sur la piste. Si l'ensemble de règles le prévoit, cette pénalité s'applique à tes jets : elle retire des dés d'une réserve ou s'ajoute à un jet additionné, et la carte de dés indique la valeur appliquée.
- **Notes** contient de courtes notes, comme la concentration.
- **Conditions** active et désactive les états.
- Les repos récupèrent les valeurs prévues. En 5e (SRD 5.1), un repos long restaure santé, emplacements de sorts et moitié des dés de vie, au minimum un.
- Un résumé présente ensuite caractéristiques, compétences et sauvegardes maîtrisées, ainsi que les valeurs choisies, comme la classe d'armure.

Le GM peut enregistrer dépenses, dégâts, soins, états et repos ; le moteur les valide. Une opération interdite, par exemple un sort sans emplacement disponible, est entièrement rejetée avec un message.

Utiliser une entrée de catalogue paie son coût complet et une utilisation de chaque compteur de ligne associé. Un emplacement de sort est dépensé au niveau déclaré. Le GM peut demander un niveau supérieur ; le moteur ne le choisit jamais seul. S'il manque une partie du coût, rien n'est dépensé. Une action gratuite, comme un tour de magie, est seulement racontée. Les maxima liés au niveau et les utilisations liées aux caractéristiques sont recalculés à l'édition.

L'état appartient au message. Changer de variante de réponse ou régénérer restaure la fiche d'avant le tour pour éviter les doubles dépenses. **Edit sheet** utilise le même éditeur et les mêmes catalogues que la carte pour la configuration, les listes, l'entraînement et les bonus, avec valeurs en lecture seule et **Review** pour les nouveaux textes. **Save sheet** ne change que la copie de cette partie. Le bouton distinct **Edit Sheet** modifie toujours la fiche générale. Un paquet absent ou ancien affiche un avertissement et bloque les tests jusqu'à son rétablissement.

## Recruter et retirer des membres de l'équipe

Le Game Master décide qui compose l'équipe au fil de l'histoire. Il n'existe pas de bouton "ajouter un compagnon". Le GM fait entrer ou sortir les membres de l'équipe par la narration, selon ce qui se passe dans la scène.

Pour te séparer d'un compagnon toi-même, utilise le bouton **X** de la barre d'équipe, comme décrit plus haut. Ton propre persona ne peut pas être retiré de cette façon.

## L'Adventure Journal

L'Adventure Journal tient le registre de ta campagne. Il se construit à partir des événements de jeu enregistrés, et non de textes écrits par l'IA : il reste donc factuel.

Clique sur le bouton **Session** dans la barre d'outils du haut, puis choisis l'onglet **Journal**. Un panneau Journal s'ouvre, avec ces onglets :

- **Timeline** (chronologie) : la liste de ce qui s'est passé, avec les lieux découverts, les rencontres avec des PNJ, les résultats de combat, les quêtes et les événements liés aux objets.
- **NPCs** : les PNJ que tu as rencontrés, avec leur portrait et leur étiquette de réputation (voir plus bas).
- **Map** (carte) : la simple liste des noms de lieux que tu as découverts.
- **Items** (objets) : le journal des objets obtenus, utilisés, perdus ou retirés.
- **Library** (bibliothèque) : les notes et les livres de l'univers que le Game Master t'a montrés, conservés pour que tu puisses les relire.
- **Notes** : ton bloc-notes en texte libre.

### Les notes du joueur

L'onglet **Notes** est ton bloc-notes personnel. Tu écris à gauche, un aperçu mis en forme s'affiche à droite. Une légende au-dessus du bloc-notes prévient que le Game Master et les membres de l'équipe voient tes notes. Autrement dit, tout ce que tu écris ici peut influencer l'histoire.

Les notes s'enregistrent toutes seules peu après que tu arrêtes d'écrire. Une petite étiquette affiche **Saving...** pendant l'enregistrement, puis **Saved** une fois terminé.

## Les étiquettes de réputation des PNJ

L'onglet **NPCs** de l'Adventure Journal suit ce que chaque PNJ pense de toi. Chaque PNJ listé affiche un portrait, un nom et une étiquette de réputation.

L'étiquette de réputation évolue selon tes actions dans l'histoire. Elle prend l'une de ces sept valeurs, de la meilleure à la pire :

| Étiquette | Signification |
|---|---|
| **Devoted** | Profondément loyal envers toi |
| **Allied** | Allié solide |
| **Friendly** | Positif |
| **Neutral** | Aucun sentiment marqué |
| **Unfriendly** | Négatif |
| **Hostile** | Retourné contre toi |
| **Enemy** | Ouvertement opposé |

Une étiquette n'apparaît qu'une fois la réputation du PNJ écartée de son point de départ. Un PNJ tout neuf, à la réputation inchangée, n'affiche encore aucune étiquette.

Un PNJ apparaît dans cet onglet dès que le Game Master l'a décrit, lui a donné une réputation ou a noté une relation le concernant. Chaque ligne de PNJ propose aussi ces actions :

- Téléverser ou remplacer le portrait du PNJ.
- Générer un portrait avec l'IA, si la génération d'images est activée.
- Retirer le PNJ du journal.

## Les modes de Game Master

Tu choisis qui mène la partie dans l'assistant de configuration, à l'étape **Party** (équipe), sous **Game Master Mode**. Deux possibilités :

- **Standalone GM** : le choix par défaut. Marinara construit un maître du jeu pour toi. L'assistant le décrit ainsi : "A snarky narrator running the show". Aucune fiche de personnage n'est nécessaire.
- **Character GM** : l'une de tes propres fiches de personnage sert de Game Master. Le moteur demande au modèle de jouer ce personnage tout en menant la partie. À choisir quand tu veux une voix de narrateur bien précise.

Pour une première partie, prends **Standalone GM**. Le mode se règle au moment de créer la partie. Pour le parcours de configuration complet, voir [Game Mode : premiers pas](getting-started.md).

## Guides associés

- [Game Mode : premiers pas](getting-started.md)
- [Game Mode : sessions et sauvegardes](sessions-and-saves.md)
