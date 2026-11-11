# Game Mode : jouer avec un ensemble de règles

Un ensemble de règles explique à Game Mode le fonctionnement d'un système sur table : les dés d'un test, le contenu de la feuille de personnage, les ressources dépensées, ce qu'un repos rend et, pour certains ensembles de règles, le déroulement d'un combat entier. Utilise ce guide pour obtenir un ensemble de règles, le choisir pour une partie et voir ce qui change en jeu. Une partie sans ensemble de règles utilise les règles propres à Marinara, décrites dans les autres guides de Game Mode.

<a id="get-a-ruleset"></a>

## Obtenir un ensemble de règles

Pour installer un ensemble de règles officiel comme 5e (SRD 5.1) :

1. Ouvre le panneau **Agents** (l'icône Sparkles).
2. Choisis **Agent Organizer** (organisateur d'agents).
3. Trouve l'ensemble de règles. Les ensembles de règles portent l'étiquette **Rules** (règles).
4. Choisis **Install** (installer).

Lance ensuite une nouvelle partie et choisis-le (voir plus bas). Les ensembles de règles viennent de deux endroits :

- Les ensembles de règles **officiels** s'installent comme ci-dessus.
- Les ensembles de règles de la **communauté** s'importent depuis un fichier ou depuis le dépôt GitHub d'un auteur. Ils sont rangés selon leur provenance, comme `local/ember-roads` ou `alice/v20`.

Chacun de ces ensembles fonctionne aussi dans un chat Roleplay. Voir [Roleplay : jouer avec un ensemble de règles](../roleplay/rulesets.md).

L'import utilise le même interrupteur **Allow custom Agent imports** (autoriser l'import d'agents personnalisés) que les agents importés. Tant qu'il est désactivé, les ensembles de règles importés sont exclus des nouvelles parties, et les parties qui en utilisent déjà un continuent de fonctionner. Une partie sur un ensemble de règles importé se joue toujours sur la version exacte avec laquelle elle a été créée. Pour écrire le tien, voir [Écrire des ensembles de règles Game Mode](../extending/writing-rulesets.md).

Le texte propre à un ensemble de règles, comme les noms de compétences, les sorts et le texte du Game Master (GM, le maître du jeu), suit la langue définie dans **Settings** (Paramètres). Un ensemble de règles officiel ne télécharge que la traduction dans cette langue, en récupère une nouvelle quand tu changes de langue, et utilise l'anglais pour une langue qu'il n'a pas. Un ensemble de règles importé depuis un fichier ne garde que la traduction dans la langue que tu avais lors de l'import. Pour changer de langue, importe à nouveau le fichier.

## Choisir un ensemble de règles pour une partie

**Rules** apparaît à l'étape **World** (monde) de l'assistant de configuration seulement si au moins un ensemble de règles est installé, et seulement pour une nouvelle partie. Ce choix est distinct de **Combat Preference** (préférence de combat) : **Rules** règle le fonctionnement des tests et des fiches, et **Combat Preference** règle la présentation des combats.

1. Dans l'assistant de configuration, ouvre l'étape **World**.
2. Sous **Rules**, garde **Marinara's own rules** (les règles propres à Marinara, c'est-à-dire les tests d20 intégrés et la fiche à six attributs), ou choisis un ensemble de règles comme **5e (SRD 5.1)**.
3. Lis le résumé. Il liste ce que couvre l'ensemble de règles et donne une ligne sur les combats (voir [Ce qui se passe dans les combats](#what-happens-in-battles)).
4. Facultatif : active des **layers** (couches, voir plus bas).
5. À l'étape **Party** (équipe), vérifie qui **Has a sheet** (a une fiche) et qui **Starts on a blank sheet** (commence avec une fiche vierge). Une fiche, ce sont les nombres du personnage pour cet ensemble de règles, comme ses scores et ses points de vie. Une fiche vierge utilise les valeurs par défaut de l'ensemble de règles. Tu peux en remplir une plus tard.

L'ensemble de règles est fixé à la création de la partie. Tu ne peux pas le changer ni en ajouter un plus tard.

Les **layers** sont des variantes nommées d'un ensemble de règles, comme Low magic ou Hard winter. Elles s'affichent sous forme d'interrupteurs sous l'ensemble de règles, avec une ligne qui indique ce que fait chacune. Une couche peut :

- durcir les difficultés,
- restreindre un choix sur la fiche,
- masquer certaines entrées toutes prêtes dans le sélecteur de l'éditeur de fiche,
- changer ce que vendent les boutiques et les trésors obtenus,
- donner des instructions supplémentaires au GM, y compris pour le monde qu'il construit.

Certaines couches s'excluent mutuellement, et l'assistant désactive celle que tu ne peux pas prendre. Les couches sont fixées une fois la partie commencée. Une fiche qui utilise déjà quelque chose qu'une couche retire le conserve.

Une fiche s'ajoute sous **Stats** (caractéristiques) dans l'éditeur de personnage ou de persona (voir [Fiches d'ensembles de règles](../characters/colors-and-stats.md#ruleset-sheets)). La partie copie chaque fiche quand elle génère le monde, et rien de ce que tu changes en jeu ne revient au personnage ou au persona. Un membre sans fiche en reçoit une vierge, où chaque valeur est celle par défaut de l'ensemble de règles. La génération du monde n'invente jamais de scores.

Un fichier de configuration partagé mémorise son ensemble de règles. Si tu en importes un sans avoir cet ensemble de règles, ou avec une version plus ancienne, l'assistant t'indique de quel ensemble il s'agissait, et la partie utilise les règles propres à Marinara, sauf si tu l'installes et le choisis.

<a id="what-happens-in-battles"></a>

## Ce qui se passe dans les combats

Ce que fait un ensemble de règles dans un combat dépend de la façon dont il a été écrit. Dans l'assistant, la ligne sous l'ensemble de règles indique quelle ligne du tableau s'applique.

| L'ensemble de règles | Les combats |
| --- | --- |
| Résout ses propres combats, comme 5e (SRD 5.1) | Se déroulent selon les règles propres à l'ensemble de règles, sur son propre écran de combat. Voir [Combats avec un ensemble de règles](fighting-on-a-ruleset.md). |
| Prête sa fiche aux combats | Combat propre à Marinara, avec la santé, les emplacements de sorts et les capacités de la fiche (voir ci-dessous). |
| Ne dit rien des combats | Combat propre à Marinara, exactement comme sans ensemble de règles. Voir [Combat](combat.md). |

Quand un ensemble de règles prête sa fiche, le combat de Marinara utilise la fiche ainsi :

- Chaque membre de l'équipe commence le combat avec la réserve de ressources et les emplacements de sorts que l'ensemble de règles a prévus pour les combats, tels que sa fiche les indique à ce moment-là.
- Les capacités choisies dans les catalogues de l'ensemble de règles deviennent des compétences quand le combat de Marinara peut les utiliser. Une entrée qui ne décrit que quelque chose hors combat, une réaction, ou une entrée dont le combat ne peut pas faire payer le coût est laissée de côté.
- Les points de vie sont transférés comme une part du maximum, pas comme le nombre de la fiche. Un personnage à la moitié de sa santé commence à la moitié de la barre de vie de l'écran de combat : une fiche à 9 points de vie n'entre donc jamais dans un combat où un seul coup en inflige 12.
- À la fin du combat, la santé perdue ou regagnée est reportée de la même façon, et les emplacements et ressources dépensés sont reportés tels quels.

Le reste ne change pas. Les calculs de dés restent ceux de Marinara (voir [Comment fonctionnent les calculs de combat](combat.md#how-combat-math-works)), et les jets d'attaque, les jets de sauvegarde et la concentration du système sur table ne s'appliquent pas. Un combat que tu quittes en supprimant le message dans lequel il a commencé ne reporte rien.

<a id="checks-on-a-ruleset"></a>

## Tests avec un ensemble de règles

Le GM demande des tests comme dans toute partie (voir [Tests de compétence](dice-and-skill-checks.md#skill-checks)), mais c'est l'ensemble de règles qui décide comment ils se lancent.

- Le GM se contente de nommer la compétence ou le jet de sauvegarde et de fixer une difficulté. Il reçoit l'échelle de difficulté de l'ensemble de règles, pas l'échelle intégrée. Une difficulté peut aller aussi loin que cette échelle, même au-delà des 1 à 40 des règles propres à Marinara. Un seul chemin reste à 1 à 40 : le traitement de secours qui lance un test encore dû par un tour enregistré.
- Marinara lance les dés de l'ensemble de règles et ajoute le modificateur tiré de la **ruleset sheet** (fiche de l'ensemble de règles) du personnage : le modificateur de caractéristique quand la compétence ou la sauvegarde nomme une caractéristique, le bonus du niveau d'entraînement (un multiple d'un bonus de maîtrise, un nombre fixe, ou les deux) et tout bonus supplémentaire de la fiche. Les bonus de compétence et les attributs intégrés ne sont pas utilisés.
- Les résultats suivent l'ensemble de règles. En 5e (SRD 5.1), un 20 naturel ou un 1 naturel n'a pas d'effet spécial sur les tests et les sauvegardes : un 20 naturel qui n'atteint pas la difficulté échoue donc.
- Si le package de l'ensemble de règles est absent, ou plus ancien que celui avec lequel la partie a été créée, les tests sont enregistrés sans nombres et restent dus. Ils ne sont jamais lancés avec les règles d'un autre système.

Marinara ne fait pas confiance aux nombres que le GM écrit. Une balise qui semble terminée est relancée et remplacée quand son modificateur n'est pas celui de la fiche, quand elle a lancé un autre nombre ou une autre taille de dés que l'ensemble de règles, quand le dé compté n'est pas celui que garde son mode de jet, ou quand elle annonce un résultat naturel que l'ensemble de règles n'a pas.

### Ce que le GM peut ajouter à un test

| Ce que le GM écrit | Effet |
| --- | --- |
| `who="Name"` | Le test utilise la fiche de ce membre de l'équipe. Sans cela, c'est le joueur qui fait le test. Un membre sans fiche lance sur une fiche vierge. Un nom qui ne correspond à personne, ou que deux membres partagent, lance sans modificateur. Si un membre porte le même nom que ton propre personnage, ce nom te désigne quand même. Marinara n'emprunte jamais la fiche de quelqu'un d'autre. |
| `with="Ability"` | Lance la compétence ou la sauvegarde avec une autre caractéristique. Seule une caractéristique déclarée par l'ensemble de règles compte. Tout le reste est ignoré. |
| `difficulty="Hard"` | Nomme un palier de l'échelle au lieu d'un nombre. Marinara lance contre le nombre de ce palier, et le test enregistré affiche le nombre. Un nom inconnu est ignoré. |
| Espaces réservés de jet | Peuvent nommer les caractéristiques, compétences et sauvegardes de l'ensemble de règles, ainsi que `PROF` pour le bonus de maîtrise quand l'ensemble de règles en a un. |

Un dé que tu as lancé toi-même avant le test n'est utilisé que si l'ensemble de règles lance un seul d20. Un ensemble de règles qui lance d'autres dés, comme 2d6 ou une réserve, l'ignore.

### Effets de la fiche sur un jet

- **Les charmes qui modifient un jet.** Le GM nomme le charme sur le test, et Marinara prélève son coût, applique son effet et lance les dés. Un charme que tu n'as pas choisi, ou que tu ne peux pas payer, ne fait rien et ne coûte rien.
- **Dépenser une ressource pour assurer un jet.** Le GM l'indique sur le test. Marinara prélève les points, ajoute ce qu'ils achètent et lance les dés. Si la réserve ne suffit pas, rien n'est dépensé. Le registre montre ce qui a vraiment été payé. L'ensemble de règles fixe ce qu'un test peut acheter : un nombre fixe, un nombre de ta fiche, ou autant que le test a de dés.
- **Les nombres qui s'ajoutent.** Si l'ensemble de règles indique qu'un nombre de la fiche s'applique à certains jets, comme un sac lourd à chaque jet de Brawn, Marinara l'ajoute à chaque test concerné, et la carte de dés indique ce que la fiche a ajouté.
- **Les compétences non entraînées.** Avec un ensemble de règles, un test sans entraînement peut coûter des dés ou des points, être d'un palier plus difficile, ou être impossible. Un test que tu ne peux pas tenter n'est pas lancé, et la narration le dit. Ta fiche n'affiche aucun nombre pour une telle compétence tant que tu ne l'as pas entraînée.
- **Les blessures.** Si l'ensemble de règles a une piste de blessures et indique que sa pénalité s'applique aux jets, être blessé rend chaque test plus difficile. Avec un ensemble de règles à réserve, elle retire autant de dés de la réserve, sans jamais descendre sous la plus petite réserve qu'il autorise (certains acceptent zéro dé). Avec un ensemble de règles qui additionne les dés, c'est une pénalité fixe. Le test indique la valeur appliquée. Voir [La fiche de l'ensemble de règles](#the-ruleset-sheet).

Le GM tient aussi à jour sur la fiche les ressources, les états et les repos de chaque personnage, et Marinara refuse un changement que la fiche ne permet pas.

### Ensembles avec réserves de dés

Certains systèmes comptent des dés au lieu d'ajouter un bonus. Le nombre de la fiche indique combien de dés tu lances, et tu comptes ceux qui font assez haut.

- **Le nombre de la fiche est un nombre de dés.** Une valeur de 3 et un métier qui vaut 2 lancent cinq dés. La fiche affiche "5 dice" plutôt que "+5".
- **La difficulté est un nombre de succès.** Une tâche difficile demande trois succès, pas un total de 15. L'échelle de l'ensemble de règles indique combien en demande chaque palier.
- **Marinara lance les dés et les compte.** L'ensemble de règles décide quelles faces comptent, si une face haute fait lancer un dé de plus ou compte double, si des faces basses annulent des succès, et ce qui compte comme une maladresse ou un succès exceptionnel. La carte de dés montre chaque dé, en distinguant ceux qui ont atteint la cible, et compare les succès au nombre demandé. Une grande réserve passe sur plusieurs lignes, et la carte n'affiche jamais de total pour des dés qui n'ont pas été additionnés.
- **Le GM peut ajuster un test**, si l'ensemble de règles le permet : une cible par dé plus dure ou plus facile, des dés ajoutés ou retirés selon les circonstances, et une face plus basse à partir de laquelle les dés sont relancés ou comptent double. Chaque ajustement reste dans la plage de l'ensemble de règles. Un palier de l'échelle peut avoir sa propre cible par dé. La carte de dés indique quand un test a utilisé une autre face que la face habituelle de l'ensemble de règles.
- **Les dés peuvent être relancés**, si l'ensemble de règles a une règle pour cela. Le GM la nomme sur le test, et les dés tombés bas sont relancés, une fois ou jusqu'à ce qu'ils fassent plus haut. Une ressource que tu dépenses peut acheter la même chose. Un jet n'est relancé que d'une seule façon. Quand deux façons s'appliquent, c'est celle qui touche le plus de dés qui est utilisée.
- **Deux caractéristiques peuvent être lancées ensemble**, si l'ensemble de règles le prévoit : deux valeurs sont lancées comme une seule réserve.
- **Une maladresse peut accompagner un résultat.** Dans un ensemble de règles qui compte comme une maladresse des faces basses sur la moitié des dés ou plus, un test qui a quand même obtenu ses succès garde son résultat, et la carte ajoute que quelque chose a mal tourné. Sans aucun succès, c'est un échec critique.
- **Le GM ne fournit jamais les nombres.** Un résultat de réserve écrit dans la narration est remplacé par le jet de Marinara. L'avantage et un dé lancé à l'avance ne s'appliquent pas.
- **Laisser le GM voir un dé de chaque taille ne s'applique pas.** Les dés montrés au GM sont des d20. Un test de réserve est lancé à l'aveugle et raconté comme n'importe quel jet à l'aveugle.

### Autres façons de lancer les dés dans un ensemble de règles

Marinara lance toujours les dés, et la carte de dés suit l'ensemble de règles :

- **Garder les dés les plus hauts.** Lance une poignée de dés et lis le plus haut, les deux ou les trois plus hauts.
- **Lancer contre ta fiche.** Fais un jet égal ou inférieur à un nombre de ta fiche, comme un pourcentage de compétence.
- **Des dés avec leurs propres faces.** Les faces peuvent valoir autre chose que leur nombre, comme moins, vide et plus, ou porter des symboles comme succès, avantage et leurs contraires.
- **Des résultats par paliers.** Un test peut aboutir dans un palier, comme une réussite critique ou une réussite à un prix, plutôt qu'à une simple réussite ou un simple échec. La carte nomme le palier et le GM le raconte.
- **Quelques tests lancés autrement.** Un ensemble de règles peut lancer la plupart des tests d'une façon et en nommer quelques-uns qui se lancent différemment.

<a id="the-ruleset-sheet"></a>

## La fiche de l'ensemble de règles

Dans une partie avec un ensemble de règles, chaque feuille de personnage commence par un bloc **Ruleset sheet**. Sa disposition vient de l'ensemble de règles : une fiche 5e et celle d'un autre système ne se ressemblent donc pas. Une partie sans ensemble de règles n'a pas ce bloc. Voir aussi [Character Profiles](party-and-npcs.md#character-profiles).

| Partie | Fonctionnement |
| --- | --- |
| **Resources** (ressources) | Les points de vie, les emplacements de sorts ou une ressource de classe montrent ce qui reste du maximum. Utilise les boutons moins et plus, ou saisis un nombre. Une ressource avec une réserve temporaire affiche aussi **Temp**. |
| **Tracks** (pistes) | Comme l'épuisement. Elles avancent et reculent d'un cran dans leur plage. |
| **Notes** | De courtes zones de texte, comme ce sur quoi un personnage se concentre. |
| **Conditions** (états) | Des boutons que tu actives et désactives. |
| **States** (états vivants) | Une forme ou une posture : une seule valeur à la fois parmi une liste. Un état vivant peut modifier les nombres qui en dépendent, comme les dés ajoutés aux jets, et un repos peut le réinitialiser. |
| **Rest buttons** (boutons de repos) | Appliquent l'un des repos de l'ensemble de règles. L'ensemble de règles définit ce qu'un repos restaure. Un repos peut aussi rendre les charges d'objets, comme celles d'une baguette, et la ligne sous les boutons indique ce qui est revenu. En 5e (SRD 5.1), un repos long restaure les points de vie et les emplacements de sorts, et rend la moitié des dés de vie, au moins un. |
| Résumé de la construction | Les modificateurs de caractéristique, les compétences et sauvegardes maîtrisées, et les valeurs que choisit l'ensemble de règles, comme la classe d'armure. |

Les **Wound tracks** (pistes de blessures) sont une rangée de cases plutôt qu'un nombre, pour les systèmes qui marquent les dégâts au lieu de les compter. Chaque case nomme ce degré de blessure et indique ce qu'il retire à tes jets.

1. Si l'ensemble de règles a plusieurs types de dégâts, choisis d'abord le type.
2. Clique sur **Mark** (marquer) ou **Clear one** (effacer une marque). Tu peux aussi cliquer sur la prochaine case vide pour ajouter une marque, ou sur la dernière case marquée pour en effacer une. Les autres cases ne répondent pas aux clics.

Une marque plus grave prend la case supérieure et pousse les plus légères vers le bas. La ligne dessous indique la pénalité en vigueur, et ce qui n'a pas tenu sur la piste. Certains ensembles de règles numérotent leurs cases au lieu de les nommer, parfois autant que ta propre valeur, et certains placent chaque marque sur la case qu'elle vise. Sur ceux-là, tu peux cliquer sur n'importe quelle case vide, **Clear one** retire la marque la plus légère de la case la plus haute, et une piste pleine refuse une nouvelle marque au lieu d'en aggraver une ancienne. Un ensemble de règles peut ajouter des cases à partir d'une liste de ta fiche, et faire qu'un repos ou un soin n'efface qu'un seul type de dégâts.

### Comment le GM modifie la fiche

Le GM tient la fiche à jour pendant qu'il raconte. Quand un personnage dépense une ressource, subit des dégâts, se soigne, gagne ou perd un état, change d'état vivant ou se repose, le GM enregistre le changement et Marinara le vérifie par rapport à la fiche. Un changement impossible, comme un sort lancé sans emplacement restant, est refusé. Rien ne change, et un message te le signale.

Quand un personnage utilise quelque chose choisi dans les catalogues de l'ensemble de règles, comme un sort ou une aptitude de classe, le GM le nomme et Marinara en paie le prix complet : le coût indiqué par l'ensemble de règles, plus une utilisation de chaque compteur qui l'accompagne. Un sort qui coûte un emplacement est payé au niveau d'emplacement que nomme l'ensemble de règles, et le GM peut demander un niveau supérieur. Marinara ne passe jamais de lui-même à un emplacement supérieur. Si une partie du prix ne peut pas être payée, tout est refusé et rien n'est dépensé. Ce qui est gratuit, comme un tour de magie, est seulement raconté.

Certains nombres de la fiche appartiennent à l'ensemble de règles : une ressource de classe dont le maximum suit ton niveau, ou des utilisations qui suivent une caractéristique, sont fixées par l'ensemble de règles et restent justes quand tu modifies la fiche. Un ensemble de règles peut aussi calculer un nombre à partir d'une ressource ou d'une piste telle qu'elle est, donner un nombre pour chaque valeur d'un état vivant, additionner une colonne d'une liste (comme le poids de l'équipement emporté), ou plafonner une compétence à un tel nombre : une compétence peut alors baisser tant qu'une ressource est faible. La fiche de la partie affiche ces valeurs actuelles, et un test ou un combat utilise la valeur du moment. Sur une fiche de personnage, l'éditeur de fiche n'a aucune partie à lire : il les montre donc telles qu'elles seraient au début du jeu.

Les valeurs vivantes appartiennent au message dans lequel elles ont changé. Si tu passes à une autre version d'un tour par un swipe (une réponse alternative), ou si tu le régénères, la fiche revient à son état d'avant ce tour : rien n'est donc dépensé deux fois.

### Modifier la fiche de l'ensemble de règles

Change la construction du personnage elle-même, par exemple après une montée de niveau.

1. Ouvre la feuille du personnage et clique sur **Edit ruleset sheet** (modifier la fiche de l'ensemble de règles).
2. Change les scores, les champs, les listes comme les sorts, et la maîtrise des compétences et des sauvegardes. Les valeurs calculées se mettent à jour pendant la saisie. Quand l'ensemble de règles a un assistant pas à pas, choisis **Guided** (guidé) pour être guidé à travers chaque choix (scores, compétences, équipement de départ), ou **All fields** (tous les champs) pour tout voir d'un coup.
3. Clique sur **Save sheet** (enregistrer la fiche).

C'est le même éditeur que sur la fiche de personnage. Tu peux ajouter des lignes depuis les catalogues de l'ensemble de règles, les cellules que gère l'ensemble de règles sont affichées mais ne peuvent pas être saisies, et une liste dont le texte d'ensemble de règles a changé propose **Review** (examiner). L'enregistrement ne change que la copie de cette partie. La fiche enregistrée sur le personnage ou le persona n'est jamais modifiée par une partie.

Le bouton distinct **Edit card** (modifier la fiche) modifie la feuille générale (classe, capacités, forces) et laisse la fiche de l'ensemble de règles telle quelle. Voir [Modifier une feuille à la main](party-and-npcs.md#edit-a-sheet-by-hand).

Si ça n'a pas marché et que le package de l'ensemble de règles a été supprimé ou est plus ancien que celui avec lequel la partie a été créée, le bloc affiche un avertissement à la place. Les tests ne peuvent pas être lancés tant que le package n'est pas réinstallé.

## La fiche d'équipe et les horloges de progression

Certains ensembles de règles tiennent une fiche pour toute l'équipe, comme un équipage ou une compagnie. Elle s'affiche sur l'écran de jeu près de la carte, sous le nom que lui donne l'ensemble de règles. Clique sur ce nom pour l'ouvrir. Le GM la tient à jour comme la fiche de chaque personnage et, quand l'ensemble de règles le permet, tu peux la modifier aussi. Si quelqu'un d'autre a enregistré la fiche d'équipe pendant que tu la modifiais, tu vois sa version. **Save** (enregistrer) la remplace par la tienne, et **Cancel** (annuler) garde la sienne.

Un ensemble de règles peut aussi utiliser des **Progress clocks** (horloges de progression) : des cercles divisés en segments que le GM remplit à mesure que quelque chose monte, comme une alarme qui se déclenche. Elles s'affichent près de la carte, chacune avec son nombre de segments remplis, et indiquent **Done** une fois pleines.

## Guides associés

- [Game Mode : combats avec un ensemble de règles](fighting-on-a-ruleset.md)
- [Game Mode : dés et tests de compétence](dice-and-skill-checks.md)
- [Game Mode : l'équipe et les PNJ](party-and-npcs.md)
- [Couleurs des personnages et Caractéristiques de Roleplay : fiches d'ensembles de règles](../characters/colors-and-stats.md#ruleset-sheets)
- [Écrire des ensembles de règles Game Mode](../extending/writing-rulesets.md)
