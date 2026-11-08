# Game Mode : combats avec un ensemble de règles

Certains ensembles de règles, comme 5e (SRD 5.1), mènent une bataille entière selon leurs propres règles au lieu de prêter quelques nombres au combat de Marinara. Ce guide montre à quoi ressemble un tel combat et comment jouer ton tour. Pour les parties utilisant les règles propres à Marinara, voir [Game Mode : combat](combat.md). Pour choisir un ensemble de règles, voir [Jouer avec un ensemble de règles](rulesets.md).

Tu ne déclenches pas ces combats. Le Game Master (GM, le maître du jeu) en déclenche un quand l'histoire le demande, comme dans toute partie. Marinara le construit à partir des fiches de l'équipe et des créatures de l'ensemble de règles, ou à partir d'adversaires que le GM décrit dans les termes de l'ensemble de règles.

## L'écran de combat

L'écran est celui de l'ensemble de règles :

- **Le menu** présente les attaques et les capacités de ton personnage. Chacune indique ce qu'elle dépense dans l'économie d'actions de l'ensemble de règles (ce que tu peux faire à chaque tour) et dans ses réserves (des stocks comme les emplacements de sorts).
- **Le panneau en dessous** affiche l'ordre des tours, le round, les états de chacun sous les noms de l'ensemble de règles et ce qui reste de chaque budget.
- **Le journal** affiche le vrai calcul, par exemple "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit."

Chaque action est écrite dans la feuille de personnage dès qu'elle aboutit. Fermer l'onglet en plein combat ne fait rien perdre, et le GM est ensuite informé que les chiffres sont réglés.

## Jouer ton tour

1. Lis le journal et le panneau pour connaître le round, l'ordre et tes budgets.
2. Choisis une attaque ou une capacité dans le menu.
3. Si elle a besoin d'une cible, choisis-en une dans la liste. Sur un champ de bataille, tu peux aussi cliquer sur une cible sur le plateau.
4. Lis la ligne du journal pour voir ce qui s'est passé.
5. Quand il ne reste rien à faire, ou si tu veux passer, choisis **Pass** (passer).

Si tu ne peux pas agir, une action peut manquer volontairement dans le menu. Vérifie ces points :

- Elle coûte plus que ce qu'il te reste. Regarde les budgets (ce qui reste de chaque réserve et de chaque action) dans le panneau.
- Elle dépasse une limite par tour sur une ressource. Elle est de nouveau proposée à ton prochain tour.
- C'est un moyen de te libérer, qui n'apparaît que tant que quelque chose te retient.
- Elle a besoin d'une cible et personne n'est à portée. Le menu indique **Nobody is in reach. Move closer.** Voir [Sur un champ de bataille](#on-a-battlefield).

Le menu regroupe ses choix sous ces titres, quand l'ensemble de règles les a :

| Groupe | Ce qu'il contient |
| --- | --- |
| **Attacks**, **Abilities**, **Items** | Tes attaques, tes capacités et tes objets. |
| **Standard actions** | Les actions courantes de l'ensemble de règles. |
| **Stat block actions** | Les actions que liste le bloc de statistiques d'une créature. |
| **Contests** | Les saisies, les bousculades et les libérations (voir [Confrontations](#contests)). |
| **Movement** | La marche sur un champ de bataille (voir [Sur un champ de bataille](#on-a-battlefield)). |
| **Spend symbols** | Ce que les symboles restants permettent d'obtenir, dans un ensemble de règles à dés à symboles. |
| **Reload**, **Switches** | Le rechargement, et les interrupteurs que définit l'ensemble de règles. |
| **End of turn** | La fin de ton tour. |

## Ce qu'un tour peut contenir

L'ensemble de règles décide de ce qu'un tour contient.

- Un coup peut infliger plusieurs types de dégâts. Chaque partie est lancée, résistée et soumise à un jet de sauvegarde séparément, mais le tout reste un seul coup.
- Dépenser une action peut acheter plusieurs attaques. Tant qu'il en reste, le menu les propose gratuitement et indique combien tu en as en main : tu peux frapper de nouveau, utiliser autre chose ou marcher entre elles.
- Une capacité peut ne rien coûter, te donner une seconde action pour ce tour seulement, ou te permettre de sprinter, de te désengager ou de te cacher avec une plus petite part de ton tour.
- Ce que ton personnage fait toujours, comme des dégâts supplémentaires au premier coup qui porte d'un tour, s'ajoute de lui-même et apparaît dans le journal.

## États

Un état est un effet durable sur un combattant. Selon l'ensemble de règles, il peut rendre tes jets de sauvegarde (les jets pour résister à un effet) plus difficiles ou plus faciles, réduire de moitié tous les types de dégâts, t'empêcher de t'en prendre à celui qui te l'a infligé ou de t'approcher de lui, ou prendre fin quand celui-ci tombe. Il peut aussi modifier un nombre : s'ajouter à ta défense, ajouter ou retirer des dés à tes attaques, tes jets de sauvegarde et tes confrontations, ou te ralentir. Le journal montre chacun à côté du jet qu'il a modifié, et les chances affichées dans le menu en tiennent compte. Certains durent jusqu'au début de ton prochain tour, ou seulement jusqu'à la prochaine attaque ou sauvegarde à laquelle ils s'appliquent. Un ensemble de règles peut aussi compter quelque chose comme l'épuisement sur une piste de ta fiche, de sorte que chaque niveau aggrave un peu les choses tant qu'il dure.

## Ensembles avec réserves de dés

Un ensemble de règles dont les tests lancent une poignée de dés et comptent ceux qui atteignent une cible combat de la même façon.

- **Attaques.** Une attaque lance ta réserve et doit obtenir un certain nombre de succès pour porter, jamais moins d'un. Chaque succès au-delà ajoute un dé aux dégâts. Les dégâts sont aussi lancés sous forme de dés.
- **Absorption.** La cible peut absorber une partie des dégâts selon le type de dégâts. L'absorption est une défense qui soit lance des dés qui en retirent chacun un, soit retire des dés avant que les dégâts soient lancés. Ce qui reste marque ses blessures.
- **Pénalités et états.** Ta pénalité de blessures retire des dés de tes réserves comme de tes tests, et un état ajoute ou retire des dés. Les jets de sauvegarde et les confrontations sont aussi des réserves.
- **Le journal** indique combien de dés ont été lancés, ce qu'ils devaient atteindre, combien de succès ils ont obtenus et ce que l'absorption a retiré.
- **Initiative et limites.** Un tel ensemble de règles peut relancer l'initiative à chaque round, et limiter la quantité d'une ressource que tu dépenses en un tour.

Certains ensembles à réserves gardent l'initiative comme un seul nombre valable pour tout le combat, que les attaques font bouger. Tu choisis comment mener chaque attaque : prendre pour toi une partie du nombre de ta cible au lieu de la blesser, ou dépenser ton propre nombre comme dés de dégâts. Une attaque qui dépense et qui touche réinitialise ton nombre. Une attaque qui rate t'en coûte autant que le prévoit l'ensemble de règles. Celui qui tombe au seuil d'effondrement de l'ensemble de règles (sa propre limite basse pour ce nombre) s'est effondré et ne peut plus dépenser tant qu'il n'a pas récupéré. L'ordre suit les nombres à chaque round, et le nombre de chacun s'affiche à côté de sa santé.

Un ensemble de règles qui lance des dés à symboles narratifs, comme un système de type Genesys, les utilise aussi pour combattre. Une attaque lance tes dés contre les dés de difficulté de la cible, les symboles s'annulent comme lors d'un test et ce qui reste décide si elle porte. L'ensemble de règles indique ce que les symboles restants permettent d'obtenir : le GM n'a donc jamais à en décider.

<a id="contests"></a>

## Confrontations

Un ensemble de règles peut permettre à n'importe qui dans un combat de lancer une confrontation : un jet contre un adversaire. Tu peux saisir quelqu'un, le renverser ou le repousser, ou te libérer d'une prise. Les deux camps lancent les dés et ajoutent leur propre nombre, le total le plus élevé l'emporte, et le menu affiche tes chances de gagner avant que tu choisisses.

- Réussir une saisie immobilise ton adversaire jusqu'à ce qu'il se libère ou que tu tombes. Échouer n'a aucun effet.
- Se libérer n'apparaît dans le menu que tant que quelque chose te retient, et seulement contre celui qui te retient.
- Une poussée ne déplace quelqu'un que sur un champ de bataille, et s'arrête aux murs et à quiconque se trouve sur le chemin.

## Répondre à l'action de quelqu'un d'autre

Certaines capacités répondent à l'action d'un autre combattant au lieu d'être utilisées pendant ton propre tour. Le combat se met en pause et le menu propose ta réponse à côté de **Pass** quand :

- un adversaire s'apprête à utiliser quelque chose,
- quelque chose te vise,
- une attaque vient de te toucher, ou
- quelque chose vient de te blesser,

et que tu disposes d'une réponse pour ce moment. Après un coup, le journal indique ce que l'attaque a obtenu et contre quelle valeur, pour que tu voies si une réponse comme Shield la transformerait en échec. Si tu la prends, le même jet est vérifié de nouveau et le journal indique s'il porte toujours.

Les adversaires peuvent aussi répondre, avec leur propre parade. Un contre peut arrêter la capacité d'un adversaire avant qu'elle ait lieu, quelle que soit sa cible, tant que l'adversaire est à portée du contre. Un ensemble de règles peut préciser qu'il ne répond qu'à certains types de capacités, comme les sorts. Ce que coûtait la capacité arrêtée est quand même dépensé, et rien ne peut répondre à un contre.

<a id="on-a-battlefield"></a>

## Sur un champ de bataille

Un ensemble de règles peut définir ce que vaut une case d'un champ de bataille dans sa propre distance, en pieds, en pas ou dans sa propre unité. S'il le fait et que le réglage **Combat Preference** (préférence de combat) de ta partie est sur **Tactical** (tactique), le combat se déroule sur un champ de bataille : les mêmes plateaux (générés ou faits à la main pour le lieu), terrains et déploiements que les [batailles Tactical](combat.md#tactical-battles-and-terrain) propres à Marinara. Un ensemble de règles sans distance, ou une partie réglée sur **Turn-Based** (tour par tour), combat sans positions, et chacun peut cibler n'importe qui.

Sur le champ de bataille, les nombres de l'ensemble de règles déterminent tout :

- La distance qu'un tour permet de parcourir vient de la règle de mouvement de l'ensemble de règles ou de la vitesse de la créature.
- La portée d'une arme, au contact ou à distance, vient de ses propres lignes.
- La zone d'une capacité devient une véritable explosion, un cône ou une ligne, et un mur bloque un tir.
- Se tenir derrière quelque chose ajoute ce que l'ensemble de règles prévoit pour le couvert.
- Sortir de la portée de quelqu'un lui permet de te frapper quand l'ensemble de règles dit qu'une telle attaque coûte quelque chose.
- Le mouvement suit huit directions à une case chacune, comme sur les grilles de jeu sur table. Ce n'est pas le modèle à quatre directions des batailles Tactical propres à Marinara.

Utiliser le plateau :

1. Chaque case est un bouton à part entière. Utilise le pointeur ou les flèches du clavier. Chaque case indique ce qu'elle est, qui s'y tient et ce qu'il en coûte d'y aller.
2. Choisis **Move** (se déplacer). Les cases que tu peux atteindre s'éclairent avec leur coût dans l'unité de l'ensemble de règles. Le chemin se dessine quand tu passes le pointeur sur une case ou que tu lui donnes le focus. L'ambre marque une case dont le chemin provoquerait une attaque de quelqu'un, et les personnes concernées sont nommées sous le plateau.
3. Choisis quelque chose qui a besoin d'une cible. Les cibles valides s'éclairent, et tu peux cliquer dessus sur le plateau ou dans la liste.
4. Pour une capacité de zone, vise une case. Les cases que tu peux viser sont éclairées, et celle sous ton pointeur indique qui elle toucherait, alliés compris.
5. Appuie sur <kbd>Esc</kbd> pour abandonner un choix inachevé et ramener le clavier sur le menu.

Tu peux dépenser ton déplacement avant et après une action. Le menu revient avec ce qu'il reste, et le panneau l'affiche sous **Movement** dans l'unité de l'ensemble de règles.

Un ensemble de règles peut exploiter davantage le champ de bataille : un couvert gradué jusqu'au couvert aux trois quarts, des hauteurs qui modifient les attaques et les chutes, des créatures qui volent, nagent, grimpent ou creusent, **Hide** (se cacher) et **Search** (fouiller) dans le menu, et une pause qui demande à un adversaire s'il veut frapper quand quelqu'un se dégage de lui. Ce qu'un combat utilise parmi ces éléments dépend de l'ensemble de règles. Un ensemble de règles peut aussi permettre à une créature de se faufiler dans un espace plus petit, de monter une monture ou de traîner quelqu'un qu'elle tient. Le vol au-dessus des obstacles n'est pas encore implémenté : une créature volante se déplace comme n'importe qui d'autre.

## Guides associés

- [Game Mode : jouer avec un ensemble de règles](rulesets.md)
- [Game Mode : le combat](combat.md)
- [Game Mode : les dés et les tests de compétence](dice-and-skill-checks.md)
- [Écrire des ensembles de règles de Game Mode](../extending/writing-rulesets.md)
