# Game Mode : classes MRPG

Chaque nouvelle partie utilise les classes **MRPG** (Marinara RPG), y compris celles créées à partir d'une Experience. Chaque membre de l'équipe a une classe, gagne des niveaux au fil des combats et débloque de nouvelles classes en progressant. Les parties créées avant l'apparition des classes MRPG conservent leurs fiches **Legacy** jusqu'à ce que tu choisisses de les faire passer à MRPG (voir [Faire passer une partie Legacy à MRPG](#move-a-legacy-game-to-mrpg)).

Une partie jouée avec un ensemble de règles, comme 5e (SRD 5.1), utilise plutôt les fiches propres à cet ensemble, et les classes MRPG ne s'y appliquent pas.

<a id="classes-and-trees"></a>

## Classes et arbres

Il existe huit arbres : **Blade**, **Guard**, **Scout**, **Marksman**, **Channeler**, **Hexer**, **Mender** et **Herald**. Chaque personnage s'entraîne dans deux d'entre eux :

- **Primary tree** (arbre principal). Choisi depuis sa fiche. La section **Game Mode** d'une fiche de personnage ou de persona dans la bibliothèque permet de le sélectionner. Sinon, il est déduit de la classe et des capacités du personnage.
- **Secondary tree** (arbre secondaire). Ouvert par le tempérament avec lequel le personnage commence la partie. Un personnage dont le tempérament correspond à son propre arbre principal s'entraîne uniquement dans celui-ci et peut atteindre des classes réservées à ceux qui restent dans un seul arbre.

Chaque arbre commence par une classe de base. Une classe évolue au niveau de classe 10, puis de nouveau au niveau 20, et les niveaux s'arrêtent à 30. Un personnage peut conserver jusqu'à quatre compétences issues d'autres classes dans lesquelles il s'est entraîné. Le changement de classe se fait hors combat, depuis la fiche du personnage. Les caractéristiques dépendent de la classe active.

<a id="the-character-sheet"></a>

## La fiche du personnage

Ouvre la fiche d'un membre de l'équipe depuis la liste de l'équipe. Elle comporte quatre onglets : **Status** (statut), **Classes**, **Skills** (compétences) et **Gear** (équipement). Les taux de progression sont masqués. Quand **Debug** (débogage) est activé, les pourcentages de progression exacts s'affichent.

Ton équipe gagne des niveaux grâce aux combats qu'elle remporte. Un combat perdu ou fui ne rapporte aucune expérience. Quand **Permadeath** (mort permanente), une option de configuration, est activé, un membre de l'équipe qui tombe au combat et n'est pas sauvé avant la fin disparaît définitivement.

<a id="skill-checks"></a>

## Jets de compétence

Les jets hors combat lisent les caractéristiques MRPG du personnage. Consulte [Jets de dés et jets de compétence](dice-and-skill-checks.md#how-the-result-is-decided) pour savoir quelle caractéristique utilise chaque compétence.

<a id="newcomers-to-the-party"></a>

## Nouveaux venus dans l'équipe

Un personnage qui rejoint l'équipe après le début de la partie arrive au niveau que lui attribue le Game Master. La plupart des nouveaux venus commencent à un niveau faible, tandis qu'un combattant aguerri peut commencer près du niveau de l'équipe. Le Game Master peut aussi donner à un nouveau venu :

- **Une progression plus rapide** de certaines caractéristiques, pour un talent brut qui rattrapera vite son retard.
- **De meilleures caractéristiques dès le départ**, pour quelqu'un qui a déjà un bon niveau.

Le Game Master en décide quand le personnage rejoint l'équipe. Un nouveau venu au sujet duquel il ne précise rien commence au niveau 1.

<a id="playing-with-others"></a>

## Jouer à plusieurs

Dans une partie partagée, chaque invité construit son propre personnage lorsqu'il rejoint le salon : un nom, une description, un **concept de personnage** pour le Game Master et les mêmes choix de **Game Mode** qu'un persona (arbre de départ, caractéristiques fortes et caractéristique faible). Choisir l'un de tes personas renseigne ces champs à partir de celui-ci. Le concept te permet d'indiquer au Game Master qui est ton personnage et comment tu aimerais qu'il entre dans l'histoire.

Le Game Master intègre ensuite le personnage à l'histoire et choisit son arbre frère.

- **Une nouvelle partie.** Tout le monde, l'hôte comme les invités, commence au niveau 1.
- **Une partie déjà en cours.** Le Game Master décide aussi du niveau de départ de l'invité et peut lui donner une progression plus rapide ou de meilleures caractéristiques, comme pour tout [nouveau venu](#newcomers-to-the-party).
- **Un invité qui revient.** Le personnage d'un invité reste dans la partie après son départ, avec son niveau, son équipement et ses bêtes apprivoisées. En l'absence de son joueur, le personnage ne participe pas aux combats, ne gagne aucune expérience et le Game Master ne l'inclut pas dans les scènes. Quand l'invité revient, il reprend le même personnage au niveau où il l'avait laissé.

<a id="move-a-legacy-game-to-mrpg"></a>

## Faire passer une partie Legacy à MRPG

Une partie Legacy conserve ses fiches Legacy aussi longtemps que tu le souhaites. Pour la faire passer à MRPG, ouvre **Journal**, puis trouve l'encart **MRPG classes** (classes MRPG) dans l'onglet **All** (tout). Sélectionne **Upgrade** (mettre à niveau).

Pour chaque membre de l'équipe, l'encart affiche :

- **Class** (classe). L'arbre dans lequel il commence, renseigné à partir du choix de sa fiche dans la bibliothèque ou, à défaut, de sa classe Legacy. Tu peux le modifier.
- **Sister tree** (arbre frère). L'arbre secondaire ouvert par son tempérament. Un personnage qui n'a pas encore de tempérament en reçoit un déduit de sa Description lors de la mise à niveau.
- **Gear**. Chaque arme et pièce d'armure Legacy qu'il transporte, ainsi que son équivalent MRPG. Décoche la case pour laisser un objet tel quel.

Quand tu confirmes avec **Upgrade the party** (mettre l'équipe à niveau) :

- Chaque membre de l'équipe commence au niveau 10, le niveau maximal de sa classe de départ, avec les caractéristiques de chaque niveau tirées comme lors d'un gain de niveau.
- La classe de sa fiche devient sa classe MRPG. Sa classe et ses capacités Legacy passent dans une note **Before the upgrade** (avant la mise à niveau) sur la fiche, afin que l'histoire en garde connaissance. Ses caractéristiques Legacy restent également sur la fiche.
- Chaque arme ou pièce d'armure acceptée devient son équivalent MRPG et garde son nom ; le personnage l'équipe si sa classe le permet.

> **Avertissement :** la mise à niveau est irréversible. Une partie passée aux classes MRPG ne peut pas revenir aux fiches Legacy.

La mise à niveau n'est pas proposée pendant un combat. Termine d'abord le combat. Une partie jouée avec un ensemble de règles ne peut pas être mise à niveau : elle conserve les fiches de son ensemble de règles.

<a id="related-guides"></a>

## Guides associés

- [Game Mode : le combat](combat.md)
- [Game Mode : l'équipe et les PNJ](party-and-npcs.md)
- [Game Mode : jets de dés et jets de compétence](dice-and-skill-checks.md)
