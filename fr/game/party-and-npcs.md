# Game Mode : l'équipe et les PNJ

Ce guide explique qui peuple ta campagne Game Mode : les membres de l'équipe et les PNJ (personnages non-joueurs) que le Game Master (le maître du jeu) fait entrer en scène. Au programme : ouvrir la feuille de personnage d'un membre de l'équipe, la modifier ou la régénérer, et lire l'Adventure Journal (le journal d'aventure), étiquettes de réputation des PNJ comprises. Les deux modes de Game Master sont expliqués eux aussi.

Game Mode est l'un des modes de chat de Marinara Engine. Il fait tourner un RPG (jeu de rôle) solo mené par un Game Master piloté par l'IA, souvent abrégé en GM. Pour la configuration et les bases, voir [Game Mode : premiers pas](getting-started.md).

## Character Profiles

Clique ou touche le bouton avatar **Character Profiles** (profils des personnages) pour voir les personnages qui voyagent avec toi. Quand l'équipe compte plusieurs membres, le bouton fait défiler leurs portraits et affiche un badge avec leur nombre.

Tu peux faire glisser ce bouton où tu veux dans le chat, sur ordinateur comme sur téléphone. Ouvre-le et utilise **Lock window** (verrouiller la fenêtre) pour le garder en place. Sur ordinateur, tu peux aussi déplacer et redimensionner la fenêtre. **Close** (fermer) la réduit de nouveau à son bouton. La position du bouton est enregistrée avec le chat, et il suit le style des widgets du chat choisi dans **Settings → Appearance → App** (Paramètres → Apparence → Application). Sur téléphone, il reste séparé du menu à trois points **Chat tools** (outils du chat).

Voici ce que tu peux faire dans **Character Profiles** :

1. Clique ou touche un portrait pour ouvrir la feuille de personnage correspondante.
2. Survole un portrait (sur ordinateur) pour faire apparaître un petit bouton **X**.
3. Clique sur le bouton **X** pour retirer ce personnage de l'équipe.

Tu peux retirer n'importe quel compagnon recruté par le Game Master, qu'il ait rejoint l'équipe pendant la configuration ou plus tard dans l'histoire. Ton persona est le personnage que tu incarnes. Il n'a pas de bouton **X** : impossible de te retirer toi-même de l'équipe.

## Les feuilles de personnage

La feuille de personnage est un résumé, propre au jeu, d'un membre de l'équipe. Elle est distincte de la fiche de personnage. Le Game Master la rédige à partir du personnage et de l'histoire en cours.

Ouvre **Character Profiles**, puis clique ou touche le portrait de ce personnage. La feuille affiche celles de ces sections qui contiennent quelque chose :

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

Dans une [partie avec ensemble de règles](dice-and-skill-checks.md#games-that-use-a-ruleset), chaque fiche commence par **Ruleset sheet**. Sa disposition dépend de l'ensemble : une fiche 5e et celle d'un autre système ne se ressemblent donc pas. Sans ensemble, ce bloc n'apparaît pas.

- **Resources** présente valeur actuelle et maximum de santé, emplacements de sorts ou ressources de classe. Utilise plus, moins ou la saisie directe. Une ressource qui a une réserve temporaire affiche aussi une case **Temp**.
- **Tracks** contient des compteurs bornés, comme l'épuisement.
- **Wound tracks** (Pistes de blessures) affichent une rangée de cases plutôt qu'un nombre, pour les systèmes qui marquent les dégâts au lieu de les compter. Chaque case indique le nom de ce degré de blessure et ce qu'il retire à tes jets. Choisis d'abord le type de dégâts si l'ensemble de règles en propose plusieurs, puis utilise **Mark** (Marquer) ou **Clear one** (Effacer une marque). Tu peux aussi cliquer sur la prochaine case vide pour ajouter une marque, ou sur la dernière case marquée pour l'effacer ; les autres cases ne répondent pas aux clics. Une marque plus grave prend la case supérieure et pousse les plus légères vers le bas ; la ligne dessous indique la pénalité active et ce qui n'a pas tenu sur la piste. Certains ensembles de règles numérotent leurs cases au lieu de les nommer, parfois autant qu'en donne une valeur du personnage, et certains placent chaque marque sur la case qu'elle vise : sur ceux-là, tu peux cliquer sur n'importe quelle case vide, **Clear one** retire la marque la plus légère de la case la plus haute, et une piste pleine refuse une nouvelle marque au lieu d'en aggraver une ancienne. Un ensemble de règles peut aussi ajouter des cases à une piste à partir d'une liste de ta fiche, et faire qu'un repos ou un soin n'efface qu'un seul type de dégâts. Si l'ensemble de règles le prévoit, cette pénalité s'applique à tes jets : elle retire des dés d'une réserve ou s'ajoute à un jet additionné, et la carte de dés indique la valeur appliquée.
- **Notes** contient de courtes notes, comme la concentration.
- **Conditions** active et désactive les états.
- **States** (états vivants), comme une forme ou une posture, prennent une seule valeur à la fois parmi une liste. Choisis la valeur dans la liste. Un état vivant peut modifier les nombres qui en dépendent, comme les dés qu'une posture ajoute à tes jets, et un repos peut le ramener à sa valeur de départ.
- Les **boutons de repos** appliquent l'un des repos de l'ensemble de règles. Ce qu'un repos restaure est défini par l'ensemble, et un repos peut aussi rendre les charges des objets que porte le personnage, comme celles d'une baguette ; la ligne sous les boutons indique alors ce qui est revenu. En 5e (SRD 5.1), un repos long restaure santé, emplacements de sorts et moitié des dés de vie, au minimum un.
- Un résumé présente ensuite caractéristiques, compétences et sauvegardes maîtrisées, ainsi que les valeurs choisies, comme la classe d'armure.

Le Game Master tient cette même fiche à jour pendant qu'il raconte. Quand un personnage dépense une ressource, subit des dégâts, se soigne, gagne ou perd un état, change d'état vivant ou se repose, il enregistre le changement, et le moteur le vérifie par rapport à la fiche. Un changement impossible, comme un sort lancé sans emplacement restant, est refusé : rien ne change et un message te le signale.

Quand un personnage utilise quelque chose qu'il a choisi dans les catalogues de l'ensemble de règles, comme un sort ou une aptitude de classe, le Game Master le nomme et le moteur en paie le prix complet : le coût indiqué par l'ensemble de règles, plus une utilisation de chaque compteur qui l'accompagne. Un sort qui coûte un emplacement est payé au niveau d'emplacement que l'ensemble de règles lui attribue, et le Game Master peut demander un niveau supérieur à la place. Le moteur ne passe jamais de lui-même à un emplacement supérieur. Si une partie du prix ne peut pas être payée, tout est refusé et rien n'est dépensé. Ce qui ne coûte rien, comme un tour de magie, est simplement raconté.

Certains nombres de la fiche appartiennent à l'ensemble de règles plutôt qu'à toi. Les maxima liés au niveau et les utilisations liées aux caractéristiques sont fixés par l'ensemble de règles et restent justes quand tu modifies la fiche.

Certaines valeurs calculées suivent le jeu lui-même : un ensemble de règles peut calculer un nombre à partir d'une ressource ou d'une piste telle qu'elle est, donner un nombre pour chaque valeur d'un état vivant, ou additionner une colonne d'une liste, comme le poids de l'équipement que tu emportes. Il peut aussi plafonner une compétence à un tel nombre : une compétence peut alors baisser tant qu'une ressource est faible. Ces valeurs affichent leur valeur actuelle dans la fiche de la partie, et un test ou un combat utilise les valeurs du moment où il a lieu. Sur une fiche de personnage, l'éditeur de fiche, qui n'a aucune partie à lire, les montre telles qu'elles seraient au début du jeu.

Ces valeurs vivantes appartiennent au message dans lequel elles ont changé. Si tu passes à un autre swipe d'un tour, ou si tu le régénères, la fiche revient à son état d'avant ce tour : rien n'est jamais dépensé deux fois.

Clique sur **Edit sheet** (modifier la fiche) pour changer la configuration du personnage elle-même, par exemple après une montée de niveau : scores, champs, listes comme les sorts, et maîtrise des compétences et des sauvegardes. Les valeurs calculées se mettent à jour pendant la saisie. C'est le même éditeur que celui de la fiche de personnage : tu peux donc aussi y ajouter des lignes depuis les catalogues de l'ensemble de règles, les cellules gérées par l'ensemble sont affichées mais ne peuvent pas être saisies, et une liste dont le texte d'origine a changé dans l'ensemble de règles propose un bouton **Review** (examiner). Quand l'ensemble de règles a un assistant pas à pas, l'éditeur propose **Guided** (guidé) à côté de **All fields** (tous les champs). **Guided** te guide à travers chaque choix, comme les scores, les compétences et l'équipement de départ, et indique ce que chaque étape attend encore. **All fields** affiche tout d'un coup. Clique sur **Save sheet** (enregistrer la fiche) quand tu as terminé. Cela ne change que la copie de la fiche propre à cette partie. La fiche enregistrée sur le personnage ou le persona n'est jamais modifiée par une partie.

Le bouton distinct **Edit Sheet** décrit plus haut modifie toujours la feuille générale (classe, capacités, forces, etc.) et laisse la fiche de l'ensemble de règles telle quelle.

Si le package de l'ensemble de règles a été supprimé, ou si la copie installée est plus ancienne que celle avec laquelle la partie a été créée, le bloc affiche un avertissement à la place, et aucun test ne peut être lancé tant que le package n'est pas réinstallé.

### La fiche d'équipe et les horloges de progression

Certains ensembles de règles tiennent une fiche pour toute l'équipe, comme un équipage ou une compagnie. Elle s'affiche sur l'écran de jeu près de la carte, sous le nom que lui donne l'ensemble de règles. Clique sur ce nom pour l'ouvrir. Le Game Master la tient à jour comme la fiche de chaque personnage et, quand l'ensemble de règles le permet, tu peux la modifier aussi. Si quelqu'un d'autre a enregistré la fiche d'équipe pendant que tu la modifiais, elle affiche sa version : **Save** (enregistrer) la remplace par la tienne, et **Cancel** (annuler) garde la sienne.

Un ensemble de règles peut aussi utiliser des **Progress clocks** (horloges de progression) : des cercles divisés en segments que le Game Master remplit à mesure que quelque chose monte, comme une alarme qui se déclenche. Elles s'affichent près de la carte, chacune avec son nombre de segments remplis, et indiquent **Done** une fois pleines.

## L'inventaire

Clique sur **Inventory** au-dessus de la narration pour l'ouvrir. Chaque case est une pile : un objet et sa quantité. Clique sur une pile pour la sélectionner.

Chaque membre de l'équipe porte ses propres affaires. L'inventaire s'ouvre sur **All** (tout), qui montre tous les sacs ensemble, avec dans le coin de chaque pile le nom de la personne qui la porte. Clique sur l'onglet d'un membre de l'équipe pour ne voir que son sac. Tant que personne d'autre ne porte rien, il n'y a pas d'onglets et toutes les piles sont à toi.

- **Changer la quantité.** Utilise **-** et **+** pour en retirer ou en ajouter un. Pour la changer davantage, tape dans le nombre placé entre les deux et appuie sur Enter : un nombre fixe la quantité (`300`), et un signe ajoute ou retire autant (`+100`, `-50`). Mettre une pile à 0 la supprime, avec une demande de confirmation quand elle en contient plus d'un.
- **Diviser une pile.** Clique sur **Split** (diviser), tape combien vont dans la nouvelle pile, puis clique de nouveau sur **Split**. Séparer 100 pommes d'une pile de 300 laisse une pile de 200 et une nouvelle pile de 100 à côté.
- **Donner.** Clique sur **Give** (donner), choisis qui le reçoit et en quelle quantité, puis clique de nouveau sur **Give**. Pour remettre une pile entière, tu peux aussi la faire glisser sur l'onglet de cette personne.
- **Ajouter.** Tape le nom de l'objet et clique sur **Add** (ajouter). Il va dans le sac de l'onglet ouvert, et dans ton propre sac depuis **All**, sauf si ton ensemble de règles fixe ce que chacun peut porter (voir plus bas). Ajouter un objet que ce sac contient déjà en ajoute un à la première pile de cet objet.
- **Fusionner ou réordonner.** Fais glisser une pile sur une autre pile du même objet pour les fusionner, quel que soit le nom de chacune. La pile fusionnée reste à la personne qui portait la pile sur laquelle tu l'as déposée. Fais glisser une pile sur un autre objet pour échanger leurs places.
- **Depuis l'ensemble de règles.** Dans une partie dont l'ensemble de règles liste ses propres objets, **From the ruleset** (depuis l'ensemble de règles) ouvre un sélecteur de ces objets, avec la recherche et les filtres de l'ensemble. Coche les objets voulus et clique sur **Add** : un exemplaire de chacun va là où **Add** place un objet, dans le sac de l'onglet ouvert, ou depuis **All** dans ton propre sac, sauf si ton ensemble de règles fixe ce que chacun peut porter. Un nom que tu tapes et qui correspond à l'un des objets de l'ensemble ajoute aussi cet objet. Un ensemble de règles peut n'accepter que ses propres objets : il n'y a alors aucun nom à taper.
- **Équipement de départ.** Quand l'ensemble de règles propose un équipement de départ, **Starting gear** (équipement de départ) l'ouvre. Choisis son destinataire dans **For** (pour), fais les choix qu'un kit demande, puis clique sur son bouton **Take** (prendre) pour le mettre dans le sac de ce personnage. L'équipement adapté à la fiche de ce personnage est listé en premier ; il peut prendre le reste si le Game Master est d'accord. Le prendre est facultatif. Une fois que tout ce qui est proposé a été pris, le bouton affiche **Starting gear (taken)**.
- **Utiliser.** Clique sur **Use** (utiliser) pour dire au Game Master que tu utilises l'objet. Pour un objet de l'ensemble de règles qui indique ce que fait son utilisation, comme un cataplasme de soin, le moteur l'applique d'abord : il lance ce que l'objet rend, l'inscrit sur la fiche de la personne qui le porte, en retire un de la pile ou dépense une charge, et dit au Game Master ce qui s'est passé pour que l'histoire suive. Ce qu'il fait à quelqu'un d'autre est laissé à la narration du Game Master. Un objet épuisé est refusé, et un objet qui doit être porté ne s'utilise que tant qu'il l'est. Certains objets demandent d'abord un test, comme un parchemin au-dessus de ce que tu sais lire : le moteur lance le test et, en cas d'échec, l'objet est consommé pour rien.
- **Surnom.** Tape un nouveau nom pour la pile et clique sur **Save**. Ce n'est que le nom que tu donnes à cette pile : elle reste le même objet, le Game Master peut toujours la désigner par son propre nom, et lui donner un surnom ne la fusionne jamais avec une autre pile. Le vrai nom de l'objet s'affiche à côté du surnom. Retape ce vrai nom pour effacer le surnom.

Un objet de l'ensemble de règles montre ce qu'il est quand tu le sélectionnes : son type, sa rareté, ses tags, ses statistiques et sa description. Une pile de cet objet ne contient que la quantité fixée par l'ensemble de règles, et le surplus commence une nouvelle pile. Le Game Master peut aussi inventer un objet dans les termes de l'ensemble de règles, comme une lame qui porte un nom. Il fonctionne comme les objets de l'ensemble, et ses détails indiquent qu'il a été inventé, avec ce que le moteur a changé pour l'adapter à l'ensemble de règles, comme un bonus limité à ce que permet sa rareté. Certains ensembles de règles désactivent les objets propres à Game Mode : le Game Master ne donne alors que les objets de l'ensemble et ceux qu'il invente, mais tu peux toujours saisir tes propres objets, sauf si l'ensemble de règles n'accepte que les siens.

### Porter, lier et transporter

Un ensemble de règles peut aussi indiquer comment ses objets se portent et se transportent :

- **Équipé.** Un objet qui occupe des emplacements, comme une armure sur le corps ou un arc à deux mains, a un bouton **Equipped** (équipé). Son porteur peut le porter tant que ces emplacements sont libres ; l'onglet du sac affiche chaque emplacement occupé, par exemple **Hands 2/2**. Équiper un objet d'une pile plus grande le place dans sa propre pile, marquée comme portée.
- **Lien.** Un objet qui doit être lié pour fonctionner (harmonisé, investi) a un bouton qui porte le mot de l'ensemble de règles pour cela, comme **Bound**. Un personnage ne peut lier que le nombre d'objets que sa fiche permet, affiché par exemple sous la forme **Bound 1/3**. Un objet maudit, une fois lié, le reste : tu ne peux ni le délier, ni l'enlever, ni le donner, ni le jeter. Seule l'histoire, par le Game Master, peut lever la malédiction.
- **Transport.** Quand l'ensemble de règles indique le poids de chaque chose et ce que chaque personnage peut porter, chaque sac affiche sa charge, par exemple **Load 5/6, at most 12**, et **Encumbered** dès qu'elle dépasse ce que son porteur porte sans peine. Un objet ajouté depuis **All** va à quelqu'un qui peut le porter sans devenir encombré : toi d'abord, puis l'équipe dans l'ordre. Quand personne ne peut tout porter, il est réparti selon la place qui reste à chacun, et personne ne reçoit jamais plus que ce qu'il peut porter au maximum. Ce que personne ne peut porter est laissé sur place, et tu en es informé. Remettre à quelqu'un plus qu'il ne peut porter est refusé, que ce soit avec **Give** ou en faisant glisser une pile sur l'une des siennes.

Donner un objet porté ou lié à quelqu'un d'autre le retire et le délie.

La feuille de personnage d'un membre de l'équipe liste ce qu'il porte.

Le Game Master ajoute, retire et remet des objets au fil de l'histoire, et indique qui les porte. Un objet qu'il nomme et qui fait partie des objets de l'ensemble de règles est bien cet objet, et il sait ce qu'est chacun des objets de l'ensemble que tu possèdes. Il utilise les objets de l'ensemble de la même façon que le bouton **Use**. Avec un ensemble de règles qui indique comment les objets se portent et se transportent, il équipe et retire aussi des objets, les lie et les délie, et voit la charge, les emplacements et les objets liés de chaque personnage ; un objet qu'il ajoute sans dire qui le reçoit est réparti de la même façon que les tiens. Chaque changement est appliqué quand la réponse est enregistrée, et sa notification apparaît quand tu atteins ce moment de l'histoire. Quand le Game Master prend un objet sans dire à qui, il le prend d'abord dans ton sac, puis dans celui du reste de l'équipe. Un changement impossible, comme prendre quelque chose que personne n'a, est refusé, et le Game Master en est informé. Quand tu régénères une réponse, ses changements repartent de l'état du début de ce tour, et revenir par swipe à une version précédente montre ce que cette version avait laissé. Supprimer la version affichée montre ce que la suivante avait laissé, et une branche du chat emporte l'inventaire de chaque version. Cela ne se produit que tant que l'inventaire est exactement tel que la réponse l'a laissé : dès que tu changes quelque chose toi-même, une nouvelle réponse ajoute ses changements par-dessus et rien de ce que tu as fait n'est annulé. Un combat utilise les objets via l'action **Items** (objets) et compte ensemble toutes les piles d'un objet, quels que soient leur porteur et leur nom. Chaque sac, divisions et surnoms compris, est conservé à la session suivante.

### L'argent

Un ensemble de règles peut avoir sa propre monnaie : une ou plusieurs familles de pièces, comme les pennies, les shillings et les couronnes, où chaque pièce plus grande vaut un certain nombre des plus petites. Les pièces sont des piles comme n'importe quel objet. Elles pèsent ce qu'indique l'ensemble de règles et comptent dans la charge de la personne qui les porte, et tu peux les diviser, les donner et les fusionner comme le reste. **From the ruleset** a une liste **Coins** (pièces) pour les ajouter à la main.

Au-dessus des piles, une ligne indique chaque famille de pièces de l'onglet ouvert et leur valeur totale, par exemple **Coin: crowns ×2, pennies ×12 (worth 132 pennies)**.

Le Game Master fait payer l'équipe et la paie dans ces pièces, et un combat gagné ou un trésor qu'il tire peut aussi en rapporter. Un paiement sort de la bourse d'un seul personnage, la tienne sauf s'il précise laquelle, et seulement dans la famille dans laquelle le prix est indiqué : les plus grosses pièces partent en premier et, quand le montant exact n'y est pas, une pièce plus grande est rompue et la monnaie revient en pièces plus petites. Un prix que la bourse ne peut pas couvrir est refusé, et le Game Master en est informé. Un prix dans une famille n'est jamais payé dans une autre : un prix en sel se paie en sel. L'argent que gagne l'équipe va dans les sacs comme n'importe quel objet. Chaque paiement et chaque gain s'affichent en notification.

Une variante de l'ensemble de règles peut exclure une pièce, comme une longue nuit pendant laquelle aucune couronne n'atteint les tertres. Personne n'est alors payé dans cette pièce ni ne paie avec, et un prix indiqué dans cette pièce s'affiche dans les pièces restantes, pour la même valeur.

Un ensemble de règles peut aussi avoir des marchés : ce que tu peux acheter dépend alors de l'endroit où tu te trouves. Le Game Master indique dans quel lieu se passe une scène et quelle est sa taille, un hameau ou une ville dans les termes de l'ensemble de règles, et un petit lieu vend moins : les choses rares ne se trouvent parfois qu'en ville, et certains vendeurs ne tiennent boutique que dans les grands lieux ou ne servent que certains acheteurs, comme une chapelle qui ne vend qu'aux fidèles. Quand tu achètes quelque chose, le moteur calcule le prix à partir du coût de l'objet et de ce que l'affaire a d'avantageux ou de coûteux, le prend dans la bourse de l'acheteur et met l'objet dans son sac. Le logement, le passage et les autres services sont seulement payés. Une notification indique ce qui a été acheté et pour combien, et un achat que le lieu, le vendeur ou la bourse ne permet pas est refusé, et le Game Master apprend pourquoi. Un ensemble de règles peut aussi rendre chaque journée différente dans un lieu : un lieu peut n'avoir que quelques exemplaires d'une chose rare, un vendeur peut proposer quelque chose d'inhabituel ce jour-là, et tu peux revendre des objets à un vendeur qui en fait commerce, pour une part du prix, jusqu'à ce que les vendeurs du lieu aient dépensé ce qu'ils déboursent en une journée. Un nouveau jour dans le même lieu, que le Game Master commence quand l'équipe reste sur place, remplit de nouveau les étals et la bourse.

Une partie sans ensemble de règles a elle aussi de l'argent et un marché quand son kit d'univers en prévoit. C'est le cas de chaque kit de départ : le cuivre, l'argent et l'or en high fantasy, les sapèques de cuivre et les taels d'argent en wuxia, les dollars et les cents à l'époque moderne, et les crédits en cyberpunk et en space opera. La boutique du kit liste les objets du quotidien que vend son univers, chacun avec un prix et le plus petit lieu qui le vend : un village a un café, mais seule une ville a une trousse de premiers secours. Tu peux changer l'argent et la boutique depuis **Change its words** (modifier ses mots) dans le kit, ou retirer complètement l'argent. Acheter, payer et gagner fonctionnent alors comme décrit plus haut, dans les pièces de l'univers.

## Recruter et retirer des membres de l'équipe

Le Game Master décide qui compose l'équipe au fil de l'histoire. Il n'existe pas de bouton "ajouter un compagnon". Le GM fait entrer ou sortir les membres de l'équipe par la narration, selon ce qui se passe dans la scène.

Quand le GM ajoute un PNJ qui porte exactement le même nom que l'une de tes fiches de personnage, ou un nom que plusieurs de tes fiches partagent, une fenêtre te demande laquelle rejoint l'équipe. Elle affiche le nom, le titre et l'avatar de chaque fiche. Sélectionne une fiche, ou choisis **Keep the game's own** (garder le personnage du jeu) suivi du nom du PNJ, par exemple **Keep the game's own Emma**, pour faire entrer le personnage créé par le jeu. Fermer la fenêtre revient au même. Une fiche dont le nom est seulement proche, comme **Samantha** pour un PNJ nommé Sam, n'est jamais ajoutée.

Pour te séparer d'un compagnon toi-même, utilise le bouton **X** à côté de son portrait dans **Character Profiles**, comme décrit plus haut. Ton propre persona ne peut pas être retiré de cette façon.

## L'Adventure Journal

L'Adventure Journal tient le registre de ta campagne. Il se construit à partir des événements de jeu enregistrés, et non de textes écrits par l'IA : il reste donc factuel.

Ouvre **Session** (voir [Ouvrir Session](sessions-and-saves.md#opening-session)), puis choisis l'onglet **Journal**. Journal contient ces onglets :

- **Timeline** (chronologie) : la liste de ce qui s'est passé, avec les lieux découverts, les rencontres avec des PNJ, les résultats de combat, les quêtes et les événements liés aux objets.
- **NPCs** : les PNJ que tu as rencontrés, avec leur portrait et leur étiquette de réputation (voir plus bas).
- **Map** (carte) : la simple liste des noms de lieux que tu as découverts.
- **Items** (objets) : le journal des objets obtenus, utilisés, perdus ou retirés.
- **Library** (bibliothèque) : les notes et les livres de l'univers que le Game Master t'a montrés, conservés pour que tu puisses les relire.
- **Notes** : ton bloc-notes en texte libre.
- **World** (monde) : dans une partie avec un monde généré, le monde tel que ton équipe le connaît. Il affiche :
  - où tu te trouves, et à quel point l'équipe est connue
  - la réputation de l'équipe auprès de chaque groupe avec lequel elle a eu affaire
  - ce que l'équipe a fait
  - les nouvelles qui lui sont parvenues, avec les rumeurs signalées
  - les troubles qui couvent et dont elle a entendu parler
  - le passé que n'importe quel habitant raconterait

  Il n'affiche que ce que l'équipe peut savoir. Les secrets que seul le Game Master connaît restent cachés. Il suit l'histoire à travers les swipes et les branches.

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
