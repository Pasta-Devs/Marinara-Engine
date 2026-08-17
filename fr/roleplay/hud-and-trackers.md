# Le HUD de Roleplay et les trackers

Ce guide explique le HUD du mode Roleplay et les petits widgets de tracker qu'il affiche. Au programme : modifier et verrouiller leurs valeurs, et comprendre le fonctionnement du panneau **Tracker Panel** (panneau de suivi), plus grand. Tout cela concerne le mode Roleplay de Marinara Engine.

## Le HUD, qu'est-ce que c'est

Le HUD (heads-up display, le bandeau d'infos en haut du chat) est une rangée de petits widgets à icône, placée au-dessus de la zone de chat. Chaque widget affiche un élément vivant de l'histoire : l'heure, tes caractéristiques, les personnages présents. Marinara tient ces valeurs à jour au fil du récit.

Les valeurs viennent des agents de suivi, les trackers. Un agent est un petit assistant IA qui travaille en arrière-plan. Chaque tracker observe l'histoire et met à jour une partie du HUD après chaque message, sans que tu aies à le demander.

Un widget n'apparaît que si son tracker est activé pour le chat. L'activation et la désactivation des agents se font dans la section **Agents** de **Chat Settings** (réglages du chat). Sans aucun tracker actif, le HUD n'affiche que le bouton **Agents & Actions** (agents et actions), sans aucun widget.

## Les widgets du HUD

Il existe sept widgets de tracker. Chacun a besoin de son propre agent pour s'afficher.

| Widget                 | Agent requis      | Contenu affiché                                                                  |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------- |
| **World State**        | World State       | Le lieu, la date, l'heure, la météo, la température et tes champs de monde personnalisés |
| **Persona Stats**      | Persona Stats     | Les barres d'état de ton persona et une ligne de statut                          |
| **Present Characters** | Character Tracker | Qui est dans la scène, avec l'humeur, l'apparence et les champs personnalisés propres au personnage |
| **Inventory**          | Persona Stats     | Les objets que tu transportes, avec les quantités                                |
| **Inventory Tracker**  | Inventory Tracker | Des listes séparées pour les monnaies, l'équipement porté et les objets transportés |
| **Active Quests**      | Quest Tracker     | Ton objectif du moment                                                           |
| **Custom Tracker**     | Custom Tracker    | Tes propres champs nommés : compteurs, monnaie, etc.                             |

À noter : le widget **Inventory** est alimenté par l'agent **Persona Stats**, le même que celui du widget **Persona Stats**. Active **Persona Stats** et tu obtiens les deux.

L'**Inventory Tracker** dédié est indépendant de l'inventaire de Persona Stats. Il tient des entrées compactes faites d'un nom et d'une quantité dans trois groupes, **Currencies**, **Equipped** et **Inventory**, et empêche l'équipement porté d'apparaître aussi dans les objets transportés.

Chaque entrée est une petite pastille. Les pastilles se suivent sur la largeur du panneau et passent à la ligne suivante, si bien qu'une longue liste d'objets reste lisible au lieu de s'étirer en une colonne très haute. La quantité ne s'affiche que si elle dépasse un, sous la forme `×4` après le nom ; un objet seul n'affiche que son nom. Dans un panneau étroit, les pastilles se placent une par ligne.

Pour changer une quantité qui vaut un, active le mode ajout ou le mode verrouillage : les deux font apparaître le contrôle de quantité sur chaque entrée.

Le widget **Present Characters** affiche jusqu'à trois emoji de personnage, suivis d'un compteur "+N" pour les suivants. Les widgets **Inventory** et **Custom Tracker** font défiler leurs entrées une par une.

## Modifier les valeurs dans un panneau contextuel

Clique sur un widget pour ouvrir son panneau contextuel, une petite fenêtre flottante. Tous les champs y sont modifiables : corrige toi-même une valeur que l'IA a mal comprise. Marinara enregistre tes modifications immédiatement.

Voici ce que chaque panneau contextuel permet de modifier :

- **World State** : les champs **Location**, **Date**, **Time**, **Weather**, **Temperature** et les lignes des champs de monde personnalisés.
- **Persona Stats** : une ligne **Status**, plus des barres de caractéristiques nommées, avec une valeur actuelle et une valeur maximale. Tu peux ajouter ou supprimer des barres.
- **Present Characters** : ajoute ou supprime des personnages, et modifie pour chacun l'emoji, le nom, **Mood**, **Look**, **Outfit**, **Thinks** (les pensées privées) et les valeurs des champs personnalisés. Tu peux téléverser un avatar par personnage. Le bouton **Auto** bascule entre "Auto-generate avatars: ON" et "Auto-generate avatars: OFF".
- **Inventory** : ajoute ou supprime des objets, et modifie le nom et la quantité de chacun.
- **Inventory Tracker** : ajoute ou supprime des entrées sous **Currencies**, **Equipped** et **Inventory**, et modifie le nom ou la quantité de chacune. Déplacer un objet d'un groupe à l'autre ne se fait pas encore en une seule action : retire-le d'un groupe et ajoute-le à l'autre.
- **Active Quests** : ajoute ou supprime des quêtes. Chaque quête comporte des objectifs nommés, avec des cases à cocher d'achèvement.
- **Custom Tracker** : ajoute, supprime ou modifie les champs de nom et de valeur.

## Le mode verrouillage

Les trackers écrasent les valeurs du HUD après chaque tour. C'est bien pratique, mais il arrive qu'une valeur dérive sans cesse et que tu veuilles la figer à la main. C'est le rôle du mode verrouillage.

Quand un champ est verrouillé, le passage automatique suivant du tracker n'y touche pas. Les champs verrouillés sont signalés, tu les repères d'un coup d'œil.

Pour verrouiller un champ :

1. Ouvre le panneau contextuel du widget.
2. Clique sur l'interrupteur de verrouillage, en haut du panneau contextuel. Son infobulle indique **Enter lock mode**.
3. Un petit bouton de verrouillage apparaît alors à côté de chaque valeur modifiable.
4. Clique sur le bouton de verrouillage placé à côté de la valeur à figer. Son infobulle indique **Lock field**.

Pour déverrouiller, clique une nouvelle fois sur ce même bouton (infobulle **Unlock field**). Pour quitter le mode verrouillage, clique de nouveau sur l'interrupteur du haut (infobulle **Exit lock mode**). Le mode verrouillage vaut pour tout le HUD : l'activer dans un panneau contextuel fait apparaître les boutons de verrouillage partout.

## Relancer un tracker

Tu peux forcer la mise à jour d'un tracker au lieu d'attendre le message suivant.

Chaque panneau contextuel contient un petit bouton d'actualisation, en forme de flèche circulaire. Clique dessus pour relancer ce seul tracker sur le dernier tour. Les infobulles nomment le tracker concerné, par exemple **Re-run world state tracker only** ou **Re-run quest tracker only**.

Dans **Chat Settings → Agents**, l'option **Manual Trackers** fait passer tous les trackers actifs en commande manuelle. Autre possibilité : laisse cet interrupteur désactivé et règle seulement certains agents en manuel, sous **Individual tracker schedule**. Un bouton d'actualisation apparaît dans la rangée du HUD dès qu'au moins un tracker est en manuel ; clique dessus pour lancer l'ensemble des trackers manuels sur le tour en cours. Le bouton d'actualisation de chaque panneau contextuel, lui, continue de lancer directement ce tracker précis.

L'icône en forme d'étincelles, au début de la rangée du HUD, ouvre le menu **Agents & Actions**. Tu peux y relancer tous les trackers, réessayer les agents en échec et utiliser **Clear Trackers** pour effacer tout l'état du monde suivi pour ce chat. **Clear Trackers** est irréversible : à manier avec précaution.

## Le panneau Tracker Panel

Le **Tracker Panel** est un panneau latéral plus grand, qui affiche les mêmes données de suivi que les widgets compacts du HUD. Il donne plus de place aux cartes de tracker et ajoute des portraits et des pensées. La configuration se trouve dans **Settings** (Paramètres), sous l'onglet **Appearance**, dans la section **Tracker Panel**.

Les contrôles de l'en-tête du panneau permettent aussi de personnaliser la structure des trackers :

- Clique sur **+** pour passer en mode ajout. La section World gagne l'option **Add world field**, et la carte de chaque personnage présent gagne l'option **Add custom field**. Les noms des champs restent visibles en mode normal, pour que leurs valeurs soient toujours compréhensibles.
- Clique sur l'icône de corbeille pour passer en mode suppression, puis retire des champs de monde ou de personnage personnalisés. Supprimer un champ supprime aussi les verrouillages enregistrés pour ce champ.
- Clique sur l'icône de cadenas pour passer en mode verrouillage. Les valeurs des champs personnalisés se verrouillent comme les valeurs de tracker intégrées.
- Clique sur l'icône d'œil barré pour passer en mode masquage, puis choisis **Mood**, **Look**, **Outfit** ou **Thoughts** sur la carte d'un personnage. Les champs masqués disparaissent du Tracker Panel et du HUD de Roleplay, leur contenu est effacé et ils restent verrouillés, pour que les trackers ne les remplissent pas de nouveau. Repasse en mode masquage pour réafficher un champ masqué, vide.

Les noms des champs personnalisés définissent la structure et restent stables d'un passage de tracker à l'autre. Les trackers mettent leurs valeurs à jour quand l'histoire les fait évoluer, et un agent qui n'en dit rien n'efface pas les champs que tu as créés.

Voici les réglages disponibles :

- **Tracker Panel** : l'interrupteur principal, activé ou désactivé. Il est activé par défaut. Quand il est activé, l'étiquette indique "Shown in the Roleplay HUD".
- **Replace tracker HUD icons** : masque la bande d'icônes compacte, pour que le panneau puisse s'ancrer au bord de l'écran à la place. Le bouton **Agents & Actions** reste visible.
- **Use expression sprites for tracker portraits** : les portraits des trackers utilisent le sprite d'expression du personnage (l'image de son émotion du moment) au lieu du simple avatar, quand il en existe un. Les sprites d'expression sont expliqués dans [Sprites de personnage](../characters/sprites.md).
- **Panel background** : un sélecteur de couleur ou de dégradé pour l'arrière-plan du panneau.
- **Desktop size** : choisis la largeur du panneau. Les options sont **Compact**, **Standard** et **Expanded**.
- **Thought display mode** : choisis la façon dont les pensées d'un personnage s'affichent. **Docked** les ouvre dans la carte du personnage. **Floating** les ouvre en bulle, à côté du portrait.
- **Always show Docked thoughts** : quand **Thought display mode** vaut **Docked**, la pensée de chaque personnage mis en avant reste visible, au lieu d'être cachée derrière un bouton.
- **Temperature unit** : bascule l'affichage des températures entre **Celsius** et **Fahrenheit**. Celsius est la valeur par défaut. Cela ne change que l'affichage, pas la valeur enregistrée dans l'état du monde.

## Quels agents alimentent le HUD

Chaque widget du HUD est rempli par un tracker qui s'exécute après chaque tour. Le tableau des widgets, au début de ce guide, indique quel agent alimente quel widget.

Pour définir les barres de caractéristiques et les attributs de jeu de rôle d'un persona ou d'un personnage au départ, passe par l'onglet **Stats** de l'éditeur de personnage ou de persona. Les trackers ajustent ensuite ces valeurs au fil de l'histoire.

## Guides associés

- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Couleurs de personnage et caractéristiques de jeu de rôle](../characters/colors-and-stats.md)
- [Mode Roleplay : premiers pas](getting-started.md)
- [Game Mode : les widgets du HUD](../game/hud-widgets.md)
