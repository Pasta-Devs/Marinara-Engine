# Game Mode : le combat

Ce guide explique les combats du Game Mode de Marinara Engine. Dans l'étape **World** (monde) de l'assistant, choisis **Classic** (combat par menus) ou **Tactical** (combat sur grille) sous **Combat Preference** (préférence de combat). Le Game Master (GM) piloté par l'IA établit la rencontre et raconte les résultats ; le moteur résout les actions de combat.

<a id="tactical-battles-and-terrain"></a>

## Combats tactiques et terrain

Le combat tactique place ton groupe et les ennemis sur un champ de bataille. Sélectionne une unité, examine sa portée de déplacement, choisis une destination et une action, puis confirme. Chaque unité du groupe peut agir avant la phase ennemie. Les prévisions d'attaque montrent les conséquences attendues avant la validation.

À la création d'une partie Tactical, les réglages facultatifs du champ de bataille permettent de choisir une graine, une taille et des indications de terrain pour le GM. Laisse la graine vide pour en générer une. C'est un entier compris entre 0 et 4294967295, zéro inclus. Elle reproduit le plateau lorsque les combattants, la description du terrain et les autres données de génération sont identiques ; elle n'impose pas la même histoire ni les mêmes ennemis au GM.

Le GM fournit l'environnement, la formation et une courte description du terrain. Le moteur crée les cases et les positions de départ exactes. La description peut demander des zones de terrain et des obstacles près du centre ou d'un bord. Les indications sont une demande au GM, pas la garantie que chaque mot devienne une case. Le champ de bataille accepté est enregistré : actualiser restaure ce plateau.

Le moteur vérifie la description et la disposition obtenue. Il préserve le terrain demandé tout en assurant l'accessibilité de la rencontre. Si les contraintes sont incompatibles, le combat signale le problème. **Use generated terrain** (utiliser un terrain généré) démarre explicitement sans les éléments refusés ; il ne les efface pas en silence. Les cartes dessinées case par case et l'éditeur de champ de bataille ne sont pas encore disponibles.

| Terrain | Marche | Défense et esquive |
| --- | --- | --- |
| Plaine | Coûte 1 point de déplacement | Aucun bonus |
| Forêt | Coûte 2 points de déplacement | +1 en défense, +15 points de pourcentage d'esquive |
| Ruines | Coûte 1 point de déplacement | +1 en défense, +10 points de pourcentage d'esquive |
| Montagne, eau, mur | Bloque la marche | Aucun bonus |

Les unités disposant d'une capacité de vol ou de téléportation établie peuvent se déplacer autrement :

- **La marche** suit les cases de sol accessibles. Les ennemis bloquent le passage ; une unité ne peut pas terminer sur une case occupée.
- **Le vol** franchit le terrain et les unités intermédiaires pour un point par case, forêt comprise. Une unité volante peut rester au-dessus d'une case autrement bloquée, mais pas terminer sur une autre unité.
- **La téléportation** ignore le terrain et les unités intermédiaires. La destination doit être à portée, libre et praticable à pied. Elle ne peut pas se trouver dans un mur, sur une montagne ou au-dessus de l'eau sans support.

Ces deux déplacements spéciaux utilisent le budget actuel et la distance orthogonale entre cases. Ils conservent les bonus de défense et d'esquive du terrain d'arrivée. Ce modèle simple de grille plane ne représente ni altitude, ni plafonds, ni coûts ou exigences de visibilité propres aux sorts.

Le combat tactique utilise des phases du groupe et des ennemis, sans initiative individuelle de jeu de rôle sur table. Les murs qui bloquent le déplacement ne bloquent pas encore les attaques à distance par ligne de vue. Couverture, profils de règles sur table et combats complets avec invocations feront l'objet de travaux distincts.

## Combats classiques

Les sections suivantes sur le menu d'actions et les calculs des dés décrivent le combat Classic. Tout le groupe participe, mais la commande choisie contrôle son premier combattant vivant ; les autres compagnons agissent automatiquement.

## Le début d'une rencontre

Tu ne déclenches pas le combat toi-même. Le GM lance un combat quand l'histoire l'exige, par exemple quand tu provoques un ennemi ou que tu tombes dans une embuscade. À ce moment-là, un écran de combat complet s'ouvre par-dessus la narration. Le moteur construit le combat (ton équipe, les ennemis, leurs caractéristiques et les règles spéciales éventuelles) à partir de ce qui se passe dans l'histoire.

L'écran de combat affiche ton équipe d'un côté et les ennemis de l'autre. Chaque combattant a une barre de vie (HP, points de vie) et, s'il utilise des compétences, une barre de magie (MP, points de magie). L'ordre des tours apparaît en haut sous la forme **Next:** suivi du nom de celui qui agit ensuite. Un compteur affiche **Round** et le numéro du round en cours.

<a id="games-whose-ruleset-resolves-its-own-fights"></a>

### Parties dont l'ensemble de règles résout ses propres combats

Un ensemble de règles peut résoudre tout un combat selon ses propres règles, au lieu de prêter quelques nombres au combat de Marinara. L'écran de bataille lui appartient alors : les attaques et capacités du personnage dans le menu, sa propre économie d'actions, ses états et un journal avec les vrais calculs. Tout est enregistré dans la fiche dès que cela se produit.

L'ensemble de règles décide aussi de ce qu'un tour peut contenir. Un coup peut infliger plusieurs types de dégâts : chaque partie est lancée, résistée et soumise à un jet de sauvegarde séparément, mais l'ensemble reste un seul coup. Dépenser une action peut acheter plusieurs attaques ; tant qu'il en reste, le menu les propose gratuitement et indique leur nombre, pour te permettre de changer d'arme ou de marcher entre elles. Une capacité peut ne rien coûter, te rendre une seconde action pour ce tour seulement, ou permettre de sprinter, de te désengager ou de te cacher en dépensant une plus petite part de ton tour. Ce que ton personnage fait toujours, comme des dégâts supplémentaires au premier coup admissible d'un tour, s'ajoute automatiquement et apparaît dans le journal. Un état peut rendre tes propres sauvegardes plus difficiles ou plus faciles, réduire de moitié tous les dégâts, t'empêcher d'attaquer celui qui l'a appliqué ou de t'en approcher, ou disparaître dès qu'il tombe.

L'ensemble de règles peut aussi définir la distance que représente une case, en pieds, en pas ou dans sa propre unité. S'il le fait et que **Combat Preference** (Préférence de combat) est sur **Tactical** (Tactique), le combat utilise un champ généré avec les mêmes plateaux, terrains et déploiements que les batailles Tactical ci-dessus. La préférence a de nouveau un effet. Un ensemble de règles sans distance, ou une partie **Classic** (Classique), combat comme avant : chacun peut cibler n'importe qui.

Sur ce champ, les nombres de l'ensemble de règles déterminent tout. Le déplacement par tour vient de sa règle de mouvement ou de la vitesse de la créature ; la portée d'une arme, de ses propres lignes ; la zone d'une capacité devient une véritable explosion, un cône ou une ligne ; les murs bloquent les tirs ; le couvert ajoute ce que prévoient les règles ; sortir de la portée de quelqu'un lui permet de te frapper quand les règles définissent le coût d'une telle attaque. Le mouvement suit huit directions à une case chacune, comme les grilles de jeu de rôle sur table visées par ces règles, au lieu des quatre directions des batailles Tactical propres à Marinara décrites plus haut.

Le champ est affiché à l'écran. Chaque case est un bouton : tu peux parcourir le plateau au pointeur ou aux flèches, et chaque case annonce sa nature, son occupant et le coût pour y aller. **Move** (Déplacer) éclaire les cases accessibles avec leur coût dans l'unité des règles, dessine le chemin au survol ou au focus et marque en ambre celles dont le chemin provoque une attaque, en nommant les attaquants sous le plateau. Une action nécessitant une cible éclaire les choix valides et permet de les sélectionner sur le plateau ou dans la liste. Si personne n'est à portée, **Nobody is in reach. Move closer.** (Personne n'est à portée. Rapproche-toi.) remplace une attaque dans le vide. Une zone vise une case : les origines valides sont éclairées et la case sous le pointeur indique qui serait touché, alliés compris. Le déplacement peut être dépensé avant et après une action ; le menu revient avec ce qu'il reste et le panneau inférieur l'affiche sous **Movement** (Déplacement) dans l'unité des règles. Échap abandonne un choix inachevé et ramène le focus du clavier au menu.

Le couvert aux trois quarts, l'altitude, le vol au-dessus des obstacles, la dissimulation, le déplacement forcé et le choix d'attaquer quelqu'un qui s'éloigne sont des travaux futurs distincts.

<a id="games-that-use-a-ruleset"></a>

### Parties utilisant un ensemble de règles

Si l'ensemble autorise le combat à utiliser sa [fiche](party-and-npcs.md#the-ruleset-sheet), la bataille commence avec les ressources et emplacements actuels. Les capacités de catalogue deviennent des compétences seulement si le combat de Marinara Engine sait les exécuter. Les entrées hors combat, réactions et coûts non pris en charge sont ignorés.

La santé est transférée comme proportion du maximum : une fiche à moitié de sa santé commence avec une demi-barre. Après la bataille, cette proportion revient à la fiche ; ressources et emplacements sont transférés directement. Les calculs restent ceux du combat intégré, sans jets d'attaque, de sauvegarde ou de concentration du jeu sur table. Supprimer le message qui démarrait la bataille n'enregistre aucun résultat dans la fiche. Sans déclaration de combat, les règles décrites ici restent inchangées.

## Le menu d'actions

À ton tour, tu choisis une action dans le menu. Les six actions sont :

- **Attack** (attaquer) : frappe un ennemi avec une attaque de base.
- **Skills** (compétences) : utilise une capacité spéciale. Les compétences peuvent coûter des MP. Certaines soignent un allié, d'autres frappent un ennemi, d'autres encore appliquent un buff ou un debuff, c'est-à-dire un bonus ou un malus temporaire.
- **Special** (action libre) : décris une action avec tes propres mots, puis appuie sur **Ask GM** (demander au GM). Par exemple : "Je projette du sable dans la lentille fissurée du Ruin Guard." Le GM décide de la suite.
- **Defend** (défendre) : augmente ta Défense jusqu'à la fin du round pour encaisser moins de dégâts.
- **Items** (objets) : utilise un objet de ton sac. Choisis **Full inventory** (inventaire complet) pour ouvrir la liste complète de tes objets depuis cet endroit.
- **Flee** (fuir) : quitte le combat sur-le-champ. La fuite met fin au combat immédiatement.

Une fois ton choix fait, le round se déroule. Les résultats s'affichent sous forme de nombres de dégâts flottants, de barres de vie qui bougent et de lignes dans le journal de combat.

## Comment les combats se calculent

Dès qu'un combat commence, chaque round est réglé par des jets de dés fixes, pas par l'IA. Le GM se contente de narrer les résultats. Il ne décide jamais qui touche ni combien de dégâts passent. Le combat est donc équitable et cohérent. Un "d20" ci-dessous désigne le jet d'un dé à vingt faces (un nombre de 1 à 20).

### L'initiative (ordre des tours)

Au début de chaque round, chaque combattant lance un d20 et ajoute un bonus lié à sa Vitesse. Les totaux les plus élevés agissent en premier. Un combattant saute le round entier s'il est gelé, étourdi ou emprisonné, ou si sa Vitesse est tombée à 0.

### Attaque et défense

Quand un combattant en attaque un autre :

1. L'attaquant lance un d20 et ajoute un bonus tiré de sa caractéristique d'Attaque.
2. Le défenseur lance un d20 et ajoute un bonus tiré de sa caractéristique de Défense.
3. Si le total de l'attaquant est inférieur à celui du défenseur, l'attaque échoue.
4. Un coup critique tombe sur un 20 naturel, ou quand l'attaquant dépasse le défenseur de 10 points ou plus.

### Les dégâts

Quand un coup porte, les dégâts de base viennent de la caractéristique d'Attaque de l'attaquant et augmentent avec son niveau. Des dés de dégâts supplémentaires s'y ajoutent, et les combattants de haut niveau en lancent davantage. Un coup critique multiplie le total par 1,5. La Défense du défenseur réduit ensuite les dégâts, en bloquant jusqu'à 40 pour cent de sa valeur de Défense.

### L'ajustement selon la difficulté

La dernière étape ajuste les dégâts selon la Difficulté de la partie, que tu définis dans l'assistant de configuration. Les quatre réglages multiplient les dégâts finaux ainsi :

| Difficulté | Multiplicateur de dégâts |
|---|---|
| Casual | 0.6 |
| Normal | 1.0 |
| Hard | 1.3 |
| Brutal | 1.6 |

Plus la difficulté est élevée, plus les deux camps frappent fort : les combats sont donc plus courts et plus risqués.

## Les effets de statut et les réactions élémentaires

Un effet de statut est une modification temporaire de l'Attaque, de la Défense, de la Vitesse ou des HP d'un combattant. Les buffs aident, les debuffs handicapent. Un statut dure un nombre de rounds défini, puis disparaît. Les effets de type poison drainent des HP à chaque round, tandis que les effets de type régénération en rendent. Trois effets nommés (gelé, étourdi et emprisonné) font passer son tour au combattant touché.

Certaines attaques et compétences portent un élément : Fire, Ice, Lightning, Poison, Holy ou Shadow. Le premier élément à toucher une cible y laisse une aura, c'est-à-dire une trace persistante de cet élément. Si un élément différent frappe ensuite la même cible, une réaction élémentaire se déclenche. La réaction ajoute des dégâts bonus et, souvent, un effet de statut.

Parmi les réactions possibles : Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse et Electrotoxin. Ce système fonctionne tout seul. Tu n'as rien à activer ni à régler. Les réactions se produisent automatiquement dès que les bons éléments s'enchaînent sur la même cible.

## Les mécaniques de boss et le butin

Les ennemis puissants peuvent avoir des mécaniques de boss, des règles spéciales que le GM écrit pour ce combat précis. Une mécanique peut se déclencher à intervalle régulier, par exemple tous les quelques rounds, ou quand le boss passe sous un seuil de vie défini. Les mécaniques peuvent frapper toute ton équipe, renforcer le boss ou appliquer un effet de statut. Quand l'une d'elles se déclenche, l'effet apparaît dans le journal de combat pour que tu puisses réagir.

Quand tu remportes un combat, les ennemis lâchent du butin. Chaque objet a une rareté, de la plus courante à la plus rare : commun, peu commun, rare, épique et légendaire. Une difficulté plus élevée oriente les gains vers les objets les plus rares et en donne un peu plus. Une bannière **Victory!** s'affiche quand tu gagnes, et une bannière **Defeat...** apparaît si ton équipe tombe.

## Interrompre le GM

Pendant que le GM rédige encore sa réponse, tu peux le couper avec le bouton **Interrupt**. Rien de ce que tu écris n'est validé tant que tu ne l'as pas envoyé. Un clic sur **Interrupt** ouvre une fenêtre de confirmation intitulée **Attempt to Interrupt?** avec trois choix :

- **No** (non) : annule et laisse le GM continuer à écrire.
- **Force Interrupt** (forcer l'interruption) : tu coupes net. Le GM n'est pas informé de ton interruption. Ton champ de saisie prend un contour vert.
- **Yes** (oui) : tente une interruption dans l'histoire, à laquelle le GM peut résister. Ton champ de saisie devient rouge et l'application indique "using dice recommended" pendant que le bouton de dés clignote. Lancer les dés ici peut aider ta tentative à réussir.

Après confirmation, écris ton message et envoie-le. Si tu changes d'avis, appuie sur **Resume** (reprendre) pour abandonner l'interruption en attente et laisser la narration continuer. Ce contrôle est utile dans un moment de tension, par exemple pour réagir juste avant qu'un combat n'éclate.

## Quick-Time Events

Le GM peut déclencher une surcouche Quick-Time Events, aussi appelée QTE, pour les passages d'action rapides comme une esquive ou une poursuite. Cette surcouche affiche une barre de compte à rebours qui se rétrécit, un message **React quickly!** et un bouton par choix. Chaque bouton est numéroté (1, 2, 3, et ainsi de suite). Clique sur le bouton correspondant à l'action voulue.

Choisis une action avant la fin du chrono pour gagner un bonus. Plus tu réagis vite, plus le bonus est important. Si le temps s'écoule d'abord, tu prends un malus à la place. Un Quick-Time Event n'utilise aucun dé. Tout se joue à la vitesse.

## Le combat sur mobile

Sur un téléphone, l'écran de combat se réorganise pour tenir sur un petit affichage. Les boutons d'action restent collés en bas de l'écran. Les panneaux qui ne tiennent pas dans la page passent dans un panneau latéral coulissant doté de quatre onglets :

- **Party** (équipe) : les membres de ton équipe et leur vie.
- **Boss Mechanics** (mécaniques de boss) : les règles spéciales du combat en cours.
- **Dialogue** (dialogue) : les répliques lancées par les combattants pendant le combat.
- **Combat Log** (journal de combat) : le compte rendu round par round de ce qui s'est passé.

Touche un onglet pour ouvrir son panneau latéral. Pour le refermer, touche en dehors du panneau latéral ou touche le bouton de fermeture.

## Guides associés

- [Game Mode : les dés et les jets de compétence](dice-and-skill-checks.md)
- [Game Mode : l'équipe et les PNJ](party-and-npcs.md)
- [Game Mode : premiers pas](getting-started.md)
- [Rencontres de combat (Roleplay)](../roleplay/combat-encounters.md)
