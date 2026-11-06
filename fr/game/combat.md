# Game Mode : le combat

En Game Mode, le combat prend deux formes : les batailles **Turn-Based** (combat par menus) et les batailles **Tactical** (combat sur grille). Tu choisis entre les deux avec **Combat Preference** (préférence de combat), à l'étape **World** (monde) de l'assistant de configuration. Pour changer plus tard, ouvre **Chat Settings** (réglages du chat), déplie **Combat Style** (style de combat) et choisis un **Battle system** (système de combat). Un ensemble de règles qui gère ses propres combats peut limiter les choix. Le Game Master (GM, le maître du jeu : l'IA qui mène la partie) met en place la rencontre et raconte le résultat. Marinara résout les actions de combat avec des calculs de dés fixes : l'IA ne décide donc jamais qui touche.

## Le début d'une rencontre

Tu ne déclenches pas le combat toi-même. Le GM lance un combat quand l'histoire l'exige, par exemple quand tu provoques un ennemi ou que tu tombes dans une embuscade. Un écran de combat complet s'ouvre alors par-dessus la narration, construit à partir de ce qui se passe dans l'histoire : ton équipe, les ennemis, leurs caractéristiques et les règles spéciales éventuelles.

L'écran affiche ton équipe d'un côté et les ennemis de l'autre. Chaque combattant a une barre de vie (HP, points de vie) et, s'il utilise des compétences, une barre de magie (MP, points de magie). En haut s'affichent **Next:** suivi du nom de celui qui agit ensuite, et **Round** avec le numéro du round.

> **Remarque :** dans une partie dont l'ensemble de règles résout ses propres combats, comme 5e (SRD 5.1), le combat suit l'ensemble de règles, pas cette page. Consulte [Combats avec un ensemble de règles](fighting-on-a-ruleset.md). Un ensemble de règles qui se contente de prêter sa fiche aux combats garde le combat décrit ici. Consulte [Ce qui se passe dans les combats](rulesets.md#what-happens-in-battles).

## Jouer une bataille Turn-Based

Une bataille Turn-Based n'a pas de plateau. Tous les membres de l'équipe y participent. Tu choisis l'action d'un seul personnage, le premier membre vivant de l'équipe. Les autres compagnons agissent d'eux-mêmes.

À ton tour, choisis une action :

| Action | Effet |
| --- | --- |
| **Attack** (attaquer) | Frappe un ennemi avec une attaque de base. |
| **Skills** (compétences) | Utilise une capacité spéciale. Les compétences peuvent coûter des MP. Certaines soignent un allié, d'autres frappent un ennemi, d'autres encore appliquent un buff ou un debuff (un bonus ou un malus temporaire). |
| **Special** (action libre) | Écris une action libre avec tes propres mots, puis appuie sur **Ask GM** (demander au GM), par exemple "Je projette du sable dans la lentille fissurée du Ruin Guard." Le GM décide de ce qui se passe. |
| **Defend** (défendre) | Augmente ta Défense jusqu'à la fin du round, pour que tu encaisses moins de dégâts. |
| **Items** (objets) | Utilise un objet de ton sac. **Full inventory** (inventaire complet) ouvre la liste complète de tes objets. |
| **Flee** (fuir) | Quitte le combat sur-le-champ. La fuite réussit toujours et met fin au combat immédiatement. |

Une fois ton choix fait, le round se déroule. Les résultats apparaissent sous forme de nombres de dégâts flottants, de barres de vie qui changent et de lignes dans **Combat Log** (journal de combat). Une bannière **Victory!** s'affiche quand tu gagnes, et une bannière **Defeat...** si ton équipe tombe.

Dans une partie avec un ensemble de règles, **Items** applique ce que dit l'ensemble de règles pour ses propres objets : combien ils soignent ou blessent, et quels états ils ajoutent. Un objet à charges est proposé tant qu'il lui reste une utilisation. Un objet qui demande d'abord un test fait lancer ce test, et en cas d'échec l'objet est dépensé pour rien. Un objet auquel l'ensemble de règles ne donne aucune utilisation n'est pas proposé. Les autres objets font ce que le GM a jugé au début du combat, sauf si l'ensemble de règles désactive les objets propres à Game Mode.

## Jouer une bataille Tactical

Le combat Tactical place ton équipe et les ennemis sur un champ de bataille en grille. Chaque case est une tuile, comme **Plains** (plaine) ou **Forest** (forêt).

1. Quand c'est ton tour (**Player Phase** (phase du joueur), ou le nom d'une unité suivi de "'s turn"), clique sur l'une de tes unités sur la grille. Sa portée de déplacement s'affiche sur le plateau.
2. Clique sur une case de destination, puis sur **Confirm Move** (confirmer le déplacement). Clique sur **Reset Move** (réinitialiser le déplacement) pour choisir de nouveau.
3. Après le déplacement, le plateau indique "Already moved — choose an action." Choisis **Attack**, **Defend** ou **Item** (objet). **Flee** se trouve aussi ici.
4. Pour **Attack**, le plateau indique **Select an enemy**. Clique sur un ennemi. La prévision d'attaque montre le résultat attendu. Clique sur **Confirm** (confirmer) pour valider. **← Back** (retour) revient d'une étape en arrière.
5. Clique sur **End Turn** (finir le tour) quand tu as terminé. Dans l'ordre des tours où l'équipe joue en premier, la **Enemy Phase** (phase ennemie) se joue ensuite.

Si le plateau affiche **Resolving…**, patiente un instant. **Restart** (recommencer) relance la bataille depuis le début sur le même champ de bataille, après confirmation.

Qui agit à quel moment dépend de **Turn order** (ordre des tours). Consulte [Ordre des tours](#turn-order). Les plateaux faits à la main et les règles de terrain se trouvent dans [Combats tactiques et terrain](#tactical-battles-and-terrain).

## Interrompre le GM

Pendant que le GM écrit, tu peux lui couper la parole avec le bouton **Interrupt** (interrompre). Rien de ce que tu tapes n'est validé tant que tu ne l'as pas envoyé.

1. Clique sur **Interrupt**. Une fenêtre intitulée **Attempt to Interrupt?** s'ouvre.
2. Choisis une option :
   - **No** (non) annule et laisse le GM continuer à écrire.
   - **Force Interrupt** (forcer l'interruption) coupe net. Le GM n'est pas informé de ton interruption. Ton champ de saisie prend un contour vert.
   - **Yes** (oui) tente une interruption dans l'histoire, à laquelle le GM peut résister. Ton champ de saisie devient rouge et l'application suggère "using dice recommended" pendant que le bouton de dés clignote. Lancer les dés peut aider.
3. Écris ton message et envoie-le.

Pour changer d'avis, appuie sur **Resume** (reprendre). L'interruption en attente est abandonnée et la narration continue.

## Quick-Time Events

Le GM peut déclencher un Quick-Time Event (QTE) pour les moments rapides, comme une esquive ou une poursuite. La surcouche affiche une barre de compte à rebours qui rétrécit, le message **React quickly!** et un bouton numéroté par choix. Clique sur l'action voulue avant la fin du chrono pour gagner un bonus. Plus tu réagis vite, plus le bonus est important. Si le temps s'écoule, tu prends un malus à la place. Un QTE n'utilise aucun dé.

Pour désactiver les QTE (jeu avec un lecteur d'écran ou sans limite de temps), désactive **Quick Time Events** à l'étape **Features** (fonctionnalités) de l'assistant.

## Le combat sur téléphone

Sur un téléphone, les boutons d'action restent collés en bas de l'écran. Les panneaux qui ne tiennent pas passent dans un tiroir qui glisse depuis le bas, doté de quatre onglets : **Party** (les membres de l'équipe et leur vie), **Boss Mechanics** (les règles spéciales du combat), **Dialogue** (les répliques prononcées par les combattants pendant le combat) et **Combat Log** (le compte rendu round par round). Touche un onglet pour ouvrir son tiroir. Pour le fermer, touche en dehors du tiroir ou touche son bouton de fermeture.

<a id="how-combat-math-works"></a>

## Comment les combats se calculent

Chaque round est réglé par des calculs de dés fixes, pas par l'IA. Le combat reste ainsi équitable et cohérent. Un d20 est un dé à vingt faces (de 1 à 20). Les règles d'initiative, d'attaque et de dégâts ci-dessous décrivent le déroulement des batailles Turn-Based dans une partie **Legacy**. Ce sont les règles propres à Marinara, pas celles d'un ensemble de règles. Une partie utilisant les classes **MRPG** combat plutôt à partir des caractéristiques et des compétences de ses classes : consulte [Classes MRPG](mrpg-classes.md). Pour les batailles Tactical, consulte [Ordre des tours](#turn-order) et [Ligne de vue, couvert et hauteur](#sight-cover-and-height).

**Initiative.** Au début de chaque round, chaque combattant lance un d20 et ajoute un bonus tiré de sa Vitesse (la Vitesse divisée par 5, arrondie à l'inférieur). Les totaux les plus élevés agissent en premier. Un combattant saute le round s'il est gelé, étourdi ou emprisonné, ou si sa Vitesse est tombée à 0.

**Attaque et défense.** Quand un combattant en attaque un autre :

1. L'attaquant lance un d20 et ajoute un bonus tiré de sa caractéristique d'Attaque.
2. Le défenseur lance un d20 et ajoute un bonus tiré de sa caractéristique de Défense.
3. Si le total de l'attaquant est inférieur, l'attaque rate.
4. Un coup critique tombe sur un 20 naturel, ou quand l'attaquant dépasse le défenseur de 10 ou plus.

**Dégâts.** Quand un coup porte, les dégâts de base viennent de la caractéristique d'Attaque de l'attaquant et augmentent avec le niveau. Des d6 supplémentaires s'y ajoutent, et les combattants de plus haut niveau en lancent davantage. Un coup critique multiplie le total par 1,5. La Défense du défenseur retire ensuite de ces dégâts jusqu'à 40 pour cent de sa propre valeur.

<a id="difficulty-scaling"></a>

### L'ajustement selon la difficulté

Ensuite, les dégâts sont ajustés selon la **Difficulty** (difficulté) que tu définis dans l'assistant de configuration. Les modificateurs de météo et d'effets de statut s'appliquent après lui. Le multiplicateur ne s'applique qu'aux attaques des ennemis : une partie plus difficile fait frapper les ennemis plus fort, tandis que les dégâts de ton équipe restent les mêmes.

| Difficulté | Multiplicateur des dégâts ennemis |
| --- | --- |
| Casual | 0,6 |
| Normal | 1,0 |
| Hard | 1,3 |
| Brutal | 1,6 |

Ces multiplicateurs font partie des règles propres à Marinara. Un ensemble de règles fournit sa propre politique de difficulté.

## Les effets de statut et les réactions élémentaires

Un effet de statut est une modification temporaire de l'Attaque, de la Défense, de la Vitesse ou des HP d'un combattant. Les buffs aident, les debuffs pénalisent. Un statut dure un nombre de rounds défini, puis disparaît. Les effets de type poison drainent des HP à chaque round et les effets de type régénération en rendent. Gelé, étourdi et emprisonné font passer son tour au combattant.

Certaines attaques et compétences portent un élément. Le premier élément qui touche une cible y laisse une aura, une trace persistante. Un élément différent qui frappe la même cible déclenche une réaction élémentaire, qui ajoute des dégâts bonus et souvent un effet de statut. Parmi les réactions : Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse et Electrotoxin. Elles se produisent automatiquement : tu n'as pas à les activer.

### Les éléments

Les éléments qui existent dépendent de l'univers :

- Sans kit d'univers, ou avec un kit qui n'en nomme aucun : les six classiques (feu, glace, foudre, poison, sacré, ombre).
- Wuxia : les cinq phases (bois, feu, terre, métal, eau), chacune l'emportant sur la suivante.
- Cyberpunk et space opera : cinétique, thermique, EM, et chimique ou plasma.
- Époque moderne et années 1920 : aucun.

La pluie et les orages en terrain découvert affaiblissent les éléments de type feu et renforcent ceux de type foudre. Dans un combat tactique, un élément frappe plus fort contre un élément qu'il domine et moins fort contre un élément qui le domine. Tu peux changer les éléments d'un kit et ses réactions sous **Change its words** (modifier ses termes). Consulte [Choisir un kit d'univers](getting-started.md#choosing-a-setting-kit).

## Les mécaniques de boss et le butin

Les ennemis puissants peuvent avoir des mécaniques de boss, des règles spéciales que le GM écrit pour ce combat. Une mécanique se déclenche à intervalle régulier, par exemple tous les quelques rounds, ou quand le boss passe sous un seuil de vie défini. Elle peut frapper toute ton équipe, renforcer le boss ou appliquer un effet de statut. Quand l'une d'elles se déclenche, **Combat Log** l'affiche pour que tu puisses réagir.

Quand tu gagnes, les ennemis lâchent du butin, qui va directement dans les sacs de l'équipe. Les objets ont une rareté : commun, peu commun, rare, épique et légendaire. Une difficulté plus élevée oriente le butin vers les objets plus rares et en donne un peu plus. Une notification indique ce qui est tombé, et le GM est informé que c'est déjà dans tes sacs.

Ce qui tombe dépend de ton univers. Une partie avec un kit d'univers fait tomber le butin propre au kit (une partie à l'époque moderne donne une carte cadeau ou une trousse de premiers secours, jamais une épée enchantée), et tu peux changer ces mots sous **Change its words**. Une partie sans kit fait tomber ce que son genre propose d'habitude. Un genre sans kit de départ, comme Steampunk, fait tomber des objets ordinaires qui n'appartiennent à aucun univers. Dans une partie dont l'ensemble de règles a ses propres tables de butin, les ennemis lâchent plutôt les objets de l'ensemble de règles, et un ensemble de règles qui désactive les objets propres à Game Mode ne fait tomber que les siens.

## Référence : les combats tactiques

<a id="tactical-battles-and-terrain"></a>

### Combats tactiques et terrain

Il n'y a aucun réglage de champ de bataille à remplir à la création d'une partie. Chaque combat reçoit son propre plateau, généré à partir d'une nouvelle graine et de la description que le GM fournit pour la scène. Le GM fournit l'environnement, la formation et une courte description du terrain, qui peut demander des zones de terrain et des obstacles près du centre ou d'un bord. Marinara crée les cases et les positions de départ exactes. Le champ de bataille accepté est enregistré : une actualisation restaure donc ce plateau.

Marinara vérifie la description et la disposition. Il conserve le terrain demandé tout en gardant la rencontre accessible.

Si les contraintes ne peuvent pas coexister, le combat signale le problème. **Use generated terrain** (utiliser un terrain généré) démarre alors sans les éléments de terrain refusés. Il ne les efface jamais en silence.

Un monde peut aussi avoir des champs de bataille faits à la main : des plateaux peints case par case pour l'un de ses lieux, avec un éditeur de monde comme Pixelforge. Quand un combat commence dans ce lieu, ou dans un lieu qu'il contient, il utilise l'un de ces plateaux au lieu d'un plateau généré.

- Le plateau est utilisé exactement tel qu'il a été peint. Si le lieu en a plusieurs, c'est la graine du combat (un nombre qui en désigne un) qui choisit.
- La description de terrain du GM n'y est pas utilisée, mais sa formation décide toujours où chaque camp commence. Le GM est informé que le plateau a été fait pour ce lieu.
- Un plateau fait à la main doit respecter trois règles : il a l'une des trois tailles de plateau, les deux colonnes de chaque côté sont des plaines où les camps se mettent en place, et chaque case où un combattant peut se tenir est reliée aux autres. L'outil de création refuse un plateau qui enfreint une règle et explique pourquoi.

Ces plateaux sont conservés avec les modifications manuelles du monde : ils voyagent donc dans les fichiers de monde, les packs de carte et la bibliothèque.

| Terrain | Marche | Défense et esquive |
| --- | --- | --- |
| Plaine | Coûte 1 point de déplacement | Aucun bonus |
| Forêt | Coûte 2 points de déplacement | +1 en défense, +15 points de pourcentage d'esquive |
| Ruines | Coûte 1 point de déplacement | +1 en défense, +10 points de pourcentage d'esquive |
| Montagne, eau, mur | Bloque la marche | Aucun bonus |

Les unités qui disposent d'une capacité établie de vol ou de téléportation se déplacent autrement :

- **La marche** suit les cases de sol accessibles. Les unités ennemies bloquent le passage, et une unité ne peut pas terminer sur une case occupée.
- **Le vol** franchit le terrain et les unités pour un point de déplacement par case, forêts comprises. Une unité volante peut rester au-dessus d'une case autrement bloquée, mais ne peut pas terminer sur une autre unité.
- **La téléportation** ignore le terrain et les unités situés entre le départ et l'arrivée. La destination doit être à portée de déplacement, libre et praticable à pied. Elle ne peut pas se trouver dans un mur, sur une montagne ou au-dessus de l'eau sans support.

Ces deux modes spéciaux utilisent le budget de déplacement actuel et la distance en ligne droite entre cases (sans diagonale). Ils conservent les bonus de défense et d'esquive du terrain d'arrivée et ignorent la hauteur. L'altitude d'une unité volante, les plafonds, ainsi que les coûts et les exigences de visibilité propres aux sorts ne sont pas représentés. L'invocation ne fait pas encore partie du combat propre à Marinara.

<a id="turn-order"></a>

### Ordre des tours

Une bataille Tactical se joue tour par tour de l'une de ces deux façons :

- **One at a time, by initiative** : chaque unité reçoit une place dans un ordre tiré aux dés, et seule l'unité dont c'est le tour peut agir. Le plateau affiche l'ordre. Les nouvelles parties Overworld utilisent ce mode.
- **Your whole party, then the enemies** : chaque unité de l'équipe peut agir, puis la phase ennemie se joue. Les parties VN utilisent ce mode.

Pour le changer, ouvre **Chat Settings**, déplie **Combat Style** et choisis un **Turn order**. Ce réglage apparaît tant que le **Battle system** est sur Tactical, sauf si l'ensemble de règles de la partie gère ses propres combats. Le changement s'applique à partir de la bataille suivante. Une bataille en cours garde son ordre.

<a id="sight-cover-and-height"></a>

### Ligne de vue, couvert et hauteur

- **Ligne de vue.** Les murs et les montagnes bloquent la ligne de vue. Une unité ne peut attaquer, utiliser une compétence ou utiliser un objet que sur une cible qu'elle voit.
- **Couvert.** Ce qui se trouve entre l'attaquant et la cible protège la cible. Une case de forêt ou de ruines sur le trajet, ou un mur ou une montagne qui bloque une partie de la vue, donne un demi-couvert. Un mur ou une montagne qui bloque la plus grande partie de la vue donne un couvert aux trois quarts. Un demi-couvert retire 15 points de pourcentage aux chances de toucher, et un couvert aux trois quarts en retire 30. Le bonus de la case de la cible et son couvert ne s'additionnent pas : seul le meilleur compte.
- **Hauteur.** Sur un plateau avec des montagnes, une montagne s'élève sur deux niveaux et le sol qui l'entoure sur un niveau. Monter d'un niveau coûte un point de déplacement de plus, et descendre ne coûte rien. Une différence de deux niveaux ou plus est une falaise, que personne ne peut franchir à pied. Les hauteurs bloquent aussi la ligne de vue entre deux cases plus basses. Attaquer vers le bas depuis une hauteur ajoute 10 aux chances de toucher, une attaque à distance depuis une hauteur porte une case plus loin, et un couvert bas comme une forêt ne cache pas une cible vue d'en haut. Les champs de bataille faits à la main peuvent avoir leurs propres falaises.

### Les scènes de champ de bataille

Un plateau tactique est disposé comme le type de lieu où se déroule le combat : une forêt a des arbres derrière lesquels se cacher, un donjon des murs et des couloirs, une ville des rues. Une partie avec un kit d'univers nomme ses propres scènes dans ses mots : un combat cyberpunk se déroule ainsi sur un toit ou dans un couloir de mégabloc, et un combat wuxia dans une forêt de bambous ou une maison de thé. Les cases du plateau utilisent elles aussi les mots de l'univers (abri et débris plutôt que forêt et ruines). Tu peux changer les scènes d'un kit et les mots de ses cases sous **Change its words**.

## Guides associés

- [Game Mode : combats avec un ensemble de règles](fighting-on-a-ruleset.md)
- [Game Mode : jets de dés et jets de compétence](dice-and-skill-checks.md)
- [Game Mode : l'équipe et les PNJ](party-and-npcs.md)
- [Game Mode : premiers pas](getting-started.md)
- [Rencontres de combat (Roleplay)](../roleplay/combat-encounters.md)
