# Game Mode : jouer avec un ensemble de règles

Un ensemble de règles explique à Game Mode le fonctionnement d'un système sur table : les dés d'un test, le contenu de la fiche, les ressources dépensées, ce qu'un repos rend et, pour certains ensembles de règles, le déroulement d'un combat entier. Ce guide explique comment obtenir un ensemble de règles, le choisir pour une partie et ce qui change quand tu joues avec. Une partie sans ensemble de règles utilise les règles propres à Marinara, décrites dans les autres guides de Game Mode.

<a id="getting-a-ruleset"></a>

## Obtenir un ensemble de règles

Les ensembles de règles viennent de deux endroits. Les officiels, comme 5e (SRD 5.1), s'installent depuis **Agent Organizer** (organisateur d'agents), où ils portent l'étiquette **Rules** (règles). Ceux de la communauté s'importent depuis un fichier ou depuis le dépôt GitHub d'un auteur, et sont rangés selon leur provenance, comme `local/ember-roads` ou `alice/v20`. L'import utilise le même interrupteur **Allow custom Agent imports** (autoriser l'import d'agents personnalisés) que les agents importés. Tant que cet interrupteur est désactivé, les ensembles de règles importés sont exclus des nouvelles parties, et les parties qui en utilisent déjà un continuent de fonctionner. Une partie sur un ensemble de règles importé se joue toujours sur la version exacte avec laquelle elle a été créée. Pour écrire le tien, consulte [Écrire des ensembles de règles](../extending/writing-rulesets.md).

### Langue

Le texte propre à un ensemble de règles, comme ses noms de compétences, ses sorts et le texte destiné au GM (maître du jeu), suit la langue définie dans **Settings** (Paramètres). Un ensemble de règles officiel ne télécharge que la traduction dans cette langue, récupère la nouvelle traduction quand tu changes de langue et utilise l'anglais pour une langue dans laquelle il n'a pas été traduit. Un ensemble de règles importé depuis un fichier ne conserve que la traduction dans la langue utilisée lors de l'import ; pour changer de langue, importe à nouveau le fichier.

<a id="choosing-a-ruleset-for-a-game"></a>

## Choisir un ensemble de règles pour une partie

**Rules** n'apparaît que si au moins un ensemble de règles est installé, et seulement pour une nouvelle partie. Ce choix est indépendant de **Combat Preference** : l'un décide du fonctionnement des tests et des feuilles de personnage, l'autre de la présentation des combats.

- **Marinara's own rules** est le choix par défaut : les tests d20 intégrés et la feuille à six attributs.
- **Un ensemble de règles**, comme **5e (SRD 5.1)**, affiche un court résumé de ce qu'il couvre, et une ligne qui indique ce que feront les combats. Un ensemble de règles qui résout ses propres combats le signale. Un ensemble qui ne fait que prêter la feuille indique que les combats se déroulent avec le combat de Marinara, en utilisant la santé, l'énergie et les capacités propres à la feuille. Un ensemble qui ne fait ni l'un ni l'autre indique que les combats se déroulent avec le combat de Marinara et nomme la **Combat Preference** que tu as choisie.

L'ensemble de règles est fixé à la création de la partie et reste attaché à cette partie. Il ne peut pas être changé ni ajouté plus tard.

Certains ensembles de règles proposent des **layers** (couches) : des variantes nommées comme Low magic ou Hard winter, affichées sous forme d'interrupteurs sous l'ensemble de règles, avec une ligne qui indique ce que fait chacune. Une couche peut durcir les difficultés, restreindre un choix sur la feuille de personnage, retirer certaines entrées toutes prêtes du sélecteur de l'éditeur de fiche, changer quelles boutiques vendent quoi et quels trésors sont obtenus, et donner des instructions supplémentaires au Game Master, y compris pour le monde qu'il construit à la configuration. Certaines couches s'excluent mutuellement, et l'assistant désactive celle que tu ne peux pas prendre. Les couches sont fixées une fois la partie commencée, exactement comme l'ensemble de règles lui-même, et une fiche qui utilise déjà quelque chose qu'une couche retire le conserve.

Après le choix d'un ensemble de règles, l'étape **Party** liste ton persona et les membres de l'équipe sous les sélecteurs, et indique qui **Has a sheet** (a une fiche) pour cet ensemble et qui **Starts on a blank sheet** (commence avec une fiche vierge). Une fiche s'ajoute sous **Stats** dans l'éditeur de personnage ou de persona (voir [Fiches d'ensembles de règles](../characters/colors-and-stats.md#ruleset-sheets)). La partie prend une copie de chaque fiche quand le monde est généré. Rien de ce que tu changes en jeu ne revient au personnage ou au persona. Un membre sans fiche reçoit une fiche vierge où chaque valeur est celle par défaut de l'ensemble de règles ; la génération du monde n'invente jamais de valeurs.

Un fichier de configuration partagé mémorise son ensemble de règles. Si tu en importes un sans avoir cet ensemble de règles, ou avec une version plus ancienne, l'assistant t'indique de quel ensemble il s'agissait, et la partie utilise les règles propres à Marinara, sauf si tu l'installes et le choisis.

<a id="what-happens-in-battles"></a>

## Ce qui se passe dans les combats

Ce que fait un ensemble de règles dans un combat dépend de la façon dont il a été écrit. Dans l'assistant de configuration, la ligne sous l'ensemble de règles indique lequel de ces cas s'applique.

| L'ensemble de règles                                   | Les combats                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Résout ses propres combats, comme 5e (SRD 5.1) | Se déroulent selon les règles propres à l'ensemble de règles, sur son propre écran de combat. Voir [Combats avec un ensemble de règles](fighting-on-a-ruleset.md). |
| Prête sa fiche aux combats                    | Utilisent le combat propre à Marinara, avec la santé, les emplacements de sorts et les attributs de la fiche. Voir ci-dessous.                            |
| Ne dit rien des combats                    | Utilisent le combat propre à Marinara, exactement comme dans une partie sans ensemble de règles. Voir [Combat](combat.md).                             |

Quand l'ensemble de règles prête sa fiche aux batailles, chaque membre de l'équipe commence le combat avec la réserve de ressources et les emplacements de sorts que l'ensemble de règles a prévus pour les batailles, tels que sa fiche les indique à ce moment-là. Les capacités qu'il a choisies dans les catalogues de l'ensemble de règles deviennent des compétences quand le combat de Marinara peut les utiliser : une entrée qui ne décrit que quelque chose hors combat, une réaction, ou une entrée dont la bataille ne peut pas faire payer le coût est laissée de côté. Les points de vie sont transférés comme une part du maximum plutôt que comme le nombre de la fiche : un personnage à la moitié de sa santé sur la fiche commence le combat avec la moitié de la barre de vie que lui donne l'écran de bataille, parce que les nombres de la bataille sont ceux de Marinara. Une fiche à 9 points de vie n'entre pas dans un combat où un seul coup en inflige 12. À la fin du combat, la santé perdue ou regagnée est reportée de la même façon, et les emplacements et ressources dépensés sont reportés tels quels. Le reste de la bataille est inchangé : les calculs de dés restent ceux de Marinara (voir [Comment fonctionnent les calculs de combat](combat.md#how-combat-math-works)), et les jets d'attaque, les jets de sauvegarde et la concentration du système sur table ne s'appliquent pas. Un combat que tu quittes en supprimant le message dans lequel il a commencé ne reporte rien, puisqu'il n'a pas eu lieu.

<a id="checks-on-a-ruleset"></a>

## Tests avec un ensemble de règles

Avec un ensemble de règles, le GM demande des tests comme dans toute partie (voir [Tests de compétence](dice-and-skill-checks.md#skill-checks)), mais c'est l'ensemble de règles qui décide comment les dés sont lancés :

- Le Game Master se contente toujours de nommer la compétence ou le jet de sauvegarde et de fixer une difficulté. Il reçoit l'échelle de difficulté de l'ensemble de règles au lieu de l'échelle intégrée. Une difficulté peut aller aussi loin que cette échelle, même au-delà des 1 à 40 que permettent les règles de Marinara. Un seul chemin reste limité à 1 à 40, même dans une partie avec ensemble de règles : le traitement de secours qui lance un test encore dû par un tour enregistré.
- Le moteur lance les dés de l'ensemble de règles et ajoute le modificateur tiré de la **ruleset sheet** (fiche de l'ensemble de règles) du personnage, composé des éléments que déclare l'ensemble : le modificateur de caractéristique quand la compétence ou la sauvegarde nomme une caractéristique, le bonus de son niveau d'entraînement (un multiple d'un bonus de maîtrise, un nombre fixe, ou les deux), et tout bonus supplémentaire saisi sur la fiche. Les bonus de compétence et les attributs intégrés ne sont pas utilisés.
- Un test peut concerner un membre de l'équipe. Le Game Master ajoute `who="Name"` à la balise, et le moteur utilise la fiche de ce personnage. Sans `who`, c'est le joueur qui fait le test. Un membre de l'équipe qui n'a pas encore de fiche lance sur une fiche vierge, où chaque valeur est à la valeur par défaut de l'ensemble de règles. Un nom qui ne correspond à personne dans l'équipe, ou que deux membres de l'équipe partagent, lance les dés sans aucun modificateur. La seule exception est le nom de ton propre personnage : si un membre de l'équipe le partage, ce nom te désigne quand même et utilise ta fiche. Le moteur n'emprunte jamais la fiche de quelqu'un d'autre.
- Les résultats naturels suivent l'ensemble de règles. En 5e (SRD 5.1), un 20 naturel ou un 1 naturel n'a pas d'effet spécial sur les tests et les sauvegardes : un 20 naturel qui n'atteint pas la difficulté échoue donc. C'est volontairement différent des règles de Marinara.
- Le moteur ne fait pas confiance aux nombres que le Game Master écrit lui-même. Une balise qui semble terminée est relancée et remplacée quand son modificateur n'est pas celui de la fiche, quand elle a lancé un autre nombre ou une autre taille de dés que l'ensemble de règles, quand le dé compté n'est pas celui que garde son mode de jet, ou quand elle annonce un résultat naturel que l'ensemble de règles n'a pas.
- Un dé que tu as lancé toi-même avant le test n'est utilisé que si l'ensemble de règles lance un seul d20. Un ensemble qui lance d'autres dés, comme 2d6 ou une réserve, l'ignore et lance normalement.
- Le Game Master peut faire jouer une compétence ou une sauvegarde avec une autre caractéristique que celle qu'elle utilise d'habitude, en ajoutant `with="Ability"` à la balise. Seule une caractéristique déclarée par ton ensemble de règles compte ; tout le reste est ignoré et la compétence garde la sienne.
- Le Game Master peut nommer une difficulté de l'échelle au lieu d'écrire son nombre, par exemple `difficulty="Hard"`. Le moteur lance contre le nombre de ce palier, et le test enregistré affiche le nombre. Un nom absent de l'échelle est ignoré.
- Les marqueurs de jet peuvent nommer les caractéristiques, compétences et sauvegardes de l'ensemble de règles, ainsi que `PROF` pour le bonus de maîtrise quand l'ensemble en a un.
- Si le package de l'ensemble de règles est absent, ou plus ancien que celui avec lequel la partie a été créée, les tests sont enregistrés sans nombres et restent dus. Ils ne sont jamais lancés avec les règles d'un autre système.
- Si un élément choisi sur ta fiche modifie un jet, par exemple un charme qui relance les dés ratés, le GM le nomme sur le test et le moteur paie son coût, applique son effet et lance les dés. Un charme non choisi ou impossible à payer ne fait rien et ne coûte rien.
- Si l'ensemble de règles permet de dépenser une ressource pour améliorer un jet, le GM l'indique sur le test et le moteur prélève les points, ajoute ce qu'ils achètent et lance les dés ensemble. Si la réserve ne suffit pas, rien n'est dépensé et le jet reste celui d'origine. Le registre montre ce qui a vraiment été payé, pas ce qui était demandé. La quantité qu'un test peut acheter est fixée par l'ensemble de règles : un nombre fixe, un nombre de ta fiche, ou autant que le test a de dés.
- Si l'ensemble de règles indique qu'un nombre de ta fiche s'ajoute à certains jets, comme un sac lourd à chaque jet de Brawn, le moteur l'ajoute à chaque test concerné, et la carte de dés indique ce que la fiche a ajouté.
- Un ensemble de règles peut indiquer ce que fait un test quand tu n'as aucun entraînement dans la compétence : il peut te coûter des dés ou des points, être d'un palier plus difficile, ou être tout simplement impossible. Un test impossible sans entraînement n'est pas lancé, et la narration le dit au lieu d'afficher un résultat. Ta fiche n'affiche aucun nombre pour une telle compétence tant que tu ne l'as pas entraînée.
- Si une piste de blessures de l'ensemble de règles applique sa pénalité aux jets, être blessé rend chaque test plus difficile. Pour une réserve, elle retire des dés sans descendre sous le minimum autorisé, que certains systèmes fixent à zéro. Pour des dés additionnés, c'est une pénalité fixe. Le test indique la valeur appliquée pour expliquer pourquoi tu as lancé moins de dés. Consulte [La fiche de l'ensemble de règles](#the-ruleset-sheet).
- Le Game Master tient aussi à jour sur la fiche les ressources, les états et les repos de chaque personnage, et le moteur refuse un changement que la fiche ne permet pas. Voir [La fiche de l'ensemble de règles](#the-ruleset-sheet).

### Ensembles avec réserves de dés

Certains systèmes n'ajoutent pas de bonus à un jet. Le nombre de la fiche indique plutôt combien de dés tu lances, et tu comptes ceux qui font assez haut. Un ensemble de règles peut être écrit ainsi, et une partie qui l'utilise se comporte un peu différemment :

- **Le nombre de la fiche est un nombre de dés.** Une valeur de 3 et un métier qui vaut 2 lancent cinq dés. Ta fiche l'affiche comme "5 dice" plutôt que "+5", dans l'éditeur comme dans ce que lit le Game Master.
- **La difficulté est un nombre de succès.** Une tâche difficile demande trois succès, pas un total de 15. L'échelle de difficulté de l'ensemble de règles indique combien en demande chaque palier.
- **Le moteur lance les dés et les compte.** Quelles faces comptent, si une face haute fait lancer un dé de plus ou compte double, si des faces basses annulent des succès, et ce qui compte comme une maladresse ou comme un succès exceptionnel : tout cela vient de l'ensemble de règles. La carte de dés montre chaque dé lancé, en distinguant ceux qui ont atteint la cible des autres, et indique combien de succès sont sortis par rapport au nombre qu'exigeait le test. Une grande réserve passe sur plusieurs lignes plutôt que de rétrécir, et la carte n'affiche jamais un total que les dés n'ont pas formé.
- **Le Game Master peut ajuster un test**, si l'ensemble de règles le permet : une cible par dé plus dure ou plus facile, des dés ajoutés ou retirés selon les circonstances, et une face plus basse à partir de laquelle les dés sont relancés ou comptent double. Chaque ajustement reste dans la plage que déclare l'ensemble de règles. Un palier de l'échelle de difficulté peut avoir sa propre cible par dé, qui s'applique quand le Game Master choisit ce palier. La carte de dés indique quand un test a relancé ou compté double sur une autre face que la face habituelle de l'ensemble de règles.
- **Les dés peuvent être relancés**, si l'ensemble de règles a une règle pour cela : le Game Master la nomme sur le test quand la situation l'exige, et les dés tombés bas sont relancés, une fois ou jusqu'à ce qu'ils fassent mieux. Une ressource que tu dépenses peut acheter la même chose. Un jet n'est relancé que d'une seule façon ; quand deux façons s'appliqueraient, c'est celle qui touche le plus de dés qui est utilisée.
- **Deux caractéristiques peuvent être lancées ensemble**, si l'ensemble de règles le prévoit : un test de caractéristique peut ajouter les dés d'une seconde caractéristique, si bien que deux valeurs sont lancées comme une seule réserve.
- **Certains ensembles de règles peuvent mal tourner en plus du résultat.** Dans un ensemble qui compte comme une maladresse des faces basses sur la moitié des dés ou plus, un test qui a quand même obtenu ses succès garde son résultat, et la carte de dés ajoute que quelque chose a mal tourné en même temps. Sans aucun succès, c'est un échec critique.
- **Le Game Master ne fournit jamais les nombres.** Un résultat de réserve écrit dans la narration est toujours remplacé par le vrai jet du moteur. L'avantage ne s'applique pas, pas plus qu'un dé que tu as lancé toi-même avant le test.
- **Laisser le Game Master voir un dé de chaque taille ne s'applique pas à ces tests.** Les dés qu'on lui montre sont des d20 ; un test de réserve est lancé à l'aveugle par le moteur et raconté comme n'importe quel autre jet à l'aveugle.

### Autres façons de lancer les dés dans un ensemble de règles

Un ensemble de règles peut aussi lancer ses tests d'autres façons. Le moteur lance toujours les dés, et la carte de dés suit l'ensemble de règles :

- **Garder les dés les plus hauts.** Lance une poignée de dés et lis le plus haut, les deux ou les trois plus hauts, selon ce que précise l'ensemble de règles.
- **Lancer contre ta fiche.** Fais un jet égal ou inférieur à un nombre de ta fiche, comme un pourcentage de compétence, au lieu d'ajouter un bonus aux dés.
- **Des dés avec leurs propres faces.** Les faces peuvent valoir autre chose que leur nombre, comme moins, vide et plus. Certains dés portent des symboles au lieu de nombres, comme succès, avantage et leurs contraires.
- **Des résultats par paliers.** Un test peut aboutir à l'un de plusieurs résultats, comme une réussite critique ou une réussite à un prix, plutôt qu'à une simple réussite ou un simple échec. La carte de dés nomme le palier, et le Game Master le raconte.
- **Quelques tests lancés autrement.** Un ensemble de règles peut lancer la plupart des tests d'une façon et en nommer quelques-uns qui se lancent différemment.

<a id="the-ruleset-sheet"></a>

## Fiche de l'ensemble de règles

Dans une partie avec un ensemble de règles, chaque fiche commence par **Ruleset sheet**. Sa disposition dépend de l'ensemble : une fiche 5e et celle d'un autre système ne se ressemblent donc pas. Sans ensemble, ce bloc n'apparaît pas.

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

Le bouton distinct **Edit Sheet** (voir [Modifier une fiche à la main](party-and-npcs.md#edit-a-sheet-by-hand)) modifie toujours la feuille générale (classe, capacités, forces, etc.) et laisse la fiche de l'ensemble de règles telle quelle.

Si le package de l'ensemble de règles a été supprimé, ou si la copie installée est plus ancienne que celle avec laquelle la partie a été créée, le bloc affiche un avertissement à la place, et aucun test ne peut être lancé tant que le package n'est pas réinstallé.

## La fiche d'équipe et les horloges de progression

Certains ensembles de règles tiennent une fiche pour toute l'équipe, comme un équipage ou une compagnie. Elle s'affiche sur l'écran de jeu près de la carte, sous le nom que lui donne l'ensemble de règles. Clique sur ce nom pour l'ouvrir. Le Game Master la tient à jour comme la fiche de chaque personnage et, quand l'ensemble de règles le permet, tu peux la modifier aussi. Si quelqu'un d'autre a enregistré la fiche d'équipe pendant que tu la modifiais, elle affiche sa version : **Save** (enregistrer) la remplace par la tienne, et **Cancel** (annuler) garde la sienne.

Un ensemble de règles peut aussi utiliser des **Progress clocks** (horloges de progression) : des cercles divisés en segments que le Game Master remplit à mesure que quelque chose monte, comme une alarme qui se déclenche. Elles s'affichent près de la carte, chacune avec son nombre de segments remplis, et indiquent **Done** une fois pleines.

## Guides associés

- [Game Mode : combats avec un ensemble de règles](fighting-on-a-ruleset.md)
- [Game Mode : dés et tests de compétence](dice-and-skill-checks.md)
- [Game Mode : l'équipe et les PNJ](party-and-npcs.md)
- [Couleurs des personnages et statistiques RPG : fiches d'ensembles de règles](../characters/colors-and-stats.md#ruleset-sheets)
- [Écrire des ensembles de règles Game Mode](../extending/writing-rulesets.md)
