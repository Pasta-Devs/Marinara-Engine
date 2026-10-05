# Le HUD de Roleplay et les trackers

Ce guide explique les trackers de Roleplay : les petits widgets sur téléphone, la fenêtre **Trackers** et Tracker Panel sur ordinateur. Tu apprendras à modifier et verrouiller leurs valeurs. Il concerne le mode Roleplay de Marinara Engine.

## Le HUD, qu'est-ce que c'est

Sur téléphone, le HUD (heads-up display) est une rangée de petits widgets en haut du chat. Chacun montre un élément de l'état de l'histoire, comme l'heure, tes caractéristiques ou les personnages présents. Marinara les tient à jour au fil du récit.

Sur ordinateur, les trackers ne sont pas dans la rangée du HUD. Ils apparaissent dans **Tracker Panel** quand il est affiché, sinon dans la fenêtre **Trackers** décrite ci-dessous.

Les valeurs viennent des agents de suivi, les trackers. Un agent est un petit assistant IA qui travaille en arrière-plan. Chaque tracker observe l'histoire et met à jour une partie du HUD après chaque message, sans que tu aies à le demander.

Un widget n'apparaît que si son tracker est activé pour le chat. L'activation et la désactivation des agents se font dans la section **Agents** de **Chat Settings** (réglages du chat). Sans aucun tracker actif, le HUD n'affiche aucun widget.

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

Pour changer une quantité qui vaut un, active **add mode** (mode ajout) ou **lock mode** (mode verrouillage) : les deux font apparaître le contrôle de quantité sur chaque entrée.

Le widget **Present Characters** affiche jusqu'à trois emoji de personnage, suivis d'un compteur "+N" pour les suivants. Les widgets **Inventory** et **Custom Tracker** font défiler leurs entrées une par une.

<a id="the-trackers-window"></a>

## La fenêtre Trackers

Sur ordinateur, quand **Tracker Panel** est masqué, les trackers de Roleplay utilisent la fenêtre **Trackers**. Si la place suffit à côté des messages, elle s'ouvre à gauche. Sinon, elle commence comme petit bouton **Trackers** en haut à gauche du chat. Clique dessus pour l'ouvrir. Un chat avec une disposition enregistrée garde celle que tu as choisie.

À la mise à jour d'un ancien chat, ses widgets de trackers sur ordinateur sont regroupés dans cette fenêtre. Les autres outils gardent leurs icônes sous forme de boutons déplaçables.

Tu peux déplacer la fenêtre par sa barre de titre, la redimensionner par ses bords et utiliser les boutons en haut à droite :

- **Pin** la garde ouverte au clic extérieur. Elle commence épinglée.
- **Lock** empêche de la déplacer ou redimensionner et immobilise son bouton. Celui-ci ouvre toujours la fenêtre, où tu peux la déverrouiller.
- **Close** la réduit au bouton déplaçable **Trackers**. Clique dessus pour la rouvrir là où tu l'as laissée.

Pour utiliser Tracker Panel, clique sur le dé dans la barre de titre de Chat Settings. Quand le panneau est masqué, les trackers restent accessibles par leur fenêtre ou bouton. **Reset View** dans Chat Settings efface la disposition enregistrée et choisit la fenêtre ou le bouton de départ selon la place disponible.

Pendant le travail des agents, un petit point apparaît près du titre de la fenêtre et sur le bouton **Chat Settings**.

Chaque tracker a sa section repliable, appelée tiroir. Clique sur son en-tête pour le réduire à l'aperçu du petit widget, puis à nouveau pour voir le tracker complet. Marinara mémorise les tiroirs repliés.

Un tracker peut aussi avoir sa propre fenêtre : clique sur le bouton de détachement près de sa flèche, ou fais glisser son titre hors de Trackers. La nouvelle fenêtre n'est pas épinglée au départ. Épingle-la pour la garder ouverte quand tu cliques ailleurs ou fermes Trackers. Son **X** la réduit à un bouton portant l'icône du tracker, qui la rouvre là où tu l'as laissée. Clique sur **Put back in Trackers** (la flèche courbe à gauche de **X**) ou fais-la glisser sur Trackers pour la ranger. Chaque chat mémorise les trackers détachés et leurs positions.

En bas, **Agent activity** montre ce que les agents ont fait. Tu peux y relancer les trackers, réessayer les agents en échec, arrêter ceux qui tournent et utiliser **Clear Trackers**. Tracker Panel possède la même section en bas.

## Modifier les valeurs dans un panneau contextuel

Sur téléphone, appuie sur un widget pour ouvrir son panneau contextuel. Sur ordinateur, les mêmes éditeurs se trouvent dans les tiroirs de la fenêtre Trackers. Un panneau contextuel est un petit panneau flottant. Tous ses champs sont modifiables pour corriger les erreurs de l'IA. Les changements sont enregistrés immédiatement.

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

Dans **Chat Settings → Agents**, **Manual Trackers** passe tous les trackers actifs en commande manuelle. Tu peux aussi le laisser désactivé et choisir seulement certains agents sous **Individual tracker schedule**. Dès qu'un tracker est manuel, un bouton d'actualisation apparaît : dans la rangée du HUD sur téléphone, et près du titre de Trackers sur ordinateur. Clique dessus pour lancer les trackers manuels sur le tour actuel. Le bouton de chaque tracker continue de lancer ce tracker seul.

**Agent activity** a sa section sous **Agents** dans **Chat Settings**, en bas de Tracker Panel et, sur ordinateur, en bas de la fenêtre Trackers. Tu peux y relancer tous les trackers, réessayer les agents en échec et utiliser **Clear Trackers** pour effacer tout l'état du monde suivi dans le chat. **Clear Trackers** est irréversible : utilise-le avec précaution.

## Le panneau Tracker Panel

Le **Tracker Panel** est un panneau latéral plus grand, qui affiche les mêmes données de suivi que les widgets compacts du HUD. Il donne plus de place aux cartes de tracker et ajoute des portraits et des pensées. La configuration se trouve dans **Settings** (Paramètres), sous l'onglet **Appearance**, dans la section **Tracker Panel**.

Pour l'activer dans un chat Roleplay, ouvre **Chat Settings** et clique sur **Tracker Panel** (le dé) dans la barre de titre, près de l'épinglage et du verrouillage. Il reste mis en évidence quand le panneau est actif, et le panneau apparaît à côté du chat. Clique à nouveau pour le désactiver et le masquer. Sur ordinateur, les trackers passent alors dans la fenêtre Trackers.

Sur téléphone, l'activer ajoute au chat un bouton Tracker Panel que tu peux déplacer librement. Appuie dessus pour ouvrir le panneau ; le fermer ramène le bouton. Quand le panneau est désactivé, la rangée du HUD garde les widgets.

Les contrôles de l'en-tête du panneau permettent aussi de personnaliser la structure des trackers :

- Clique sur **+** pour passer en mode ajout. La section World gagne l'option **Add world field**, et la carte de chaque personnage présent gagne l'option **Add custom field**. Les noms des champs restent visibles en mode normal, pour que leurs valeurs soient toujours compréhensibles.
- Clique sur l'icône de corbeille pour passer en mode suppression, puis retire des champs de monde ou de personnage personnalisés. Supprimer un champ supprime aussi les verrouillages enregistrés pour ce champ.
- Clique sur l'icône de cadenas pour passer en mode verrouillage. Les valeurs des champs personnalisés se verrouillent comme les valeurs de tracker intégrées.
- Clique sur l'icône d'œil barré pour passer en mode masquage, puis choisis **Mood**, **Look**, **Outfit** ou **Thoughts** sur la carte d'un personnage. Les champs masqués disparaissent du Tracker Panel et du HUD de Roleplay, leur contenu est effacé et ils restent verrouillés, pour que les trackers ne les remplissent pas de nouveau. Repasse en mode masquage pour réafficher un champ masqué, vide.

Les noms des champs personnalisés définissent la structure et restent stables d'un passage de tracker à l'autre. Les trackers mettent leurs valeurs à jour quand l'histoire les fait évoluer, et un agent qui n'en dit rien n'efface pas les champs que tu as créés.

Voici les réglages disponibles :

- **Tracker Panel** : l'interrupteur principal, le même que contrôle le dé de Chat Settings. Il est activé par défaut. Quand il est actif, l'étiquette indique "Shown in the Roleplay HUD". Quand il est désactivé, les trackers sur ordinateur apparaissent dans la fenêtre Trackers.
- **Replace tracker HUD icons** : masque la bande compacte d'icônes sur téléphone et permet au panneau de s'ancrer au bord de l'écran.
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
