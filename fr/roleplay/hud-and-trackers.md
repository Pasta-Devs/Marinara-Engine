# HUD et trackers en Roleplay

Le HUD (heads-up display, affichage tête haute) montre en direct les détails de l'histoire dans un chat Roleplay : l'heure, la météo, qui est présent, tes caractéristiques, tes objets et tes quêtes. Tu peux corriger n'importe quelle valeur à la main, verrouiller une valeur pour que l'IA arrête de la changer, et relancer un tracker à la demande.

Les valeurs viennent des agents trackers. Un agent est une aide qui tourne en parallèle des réponses. Un agent tracker observe l'histoire et met à jour une partie du HUD après chaque message. Un widget n'apparaît que si son agent est activé pour le chat.

## Activer le HUD

1. Ouvre **Chat Settings** (réglages du chat) avec le bouton de curseurs dans le chat.
2. Va dans **Agents** et active **Enable Agents** (activer les agents).
3. Ajoute les agents depuis les listes sous l'interrupteur. Pour un HUD de base, ajoute d'abord **World State**. Ajoute **Persona Stats**, **Character Tracker** ou **Quest Tracker** pour en avoir plus.
4. Envoie un message.

Après la réponse, le tracker apparaît. Sur téléphone, tu vois le bouton **World State**. Sur ordinateur, tu vois le **Tracker Panel** ou la fenêtre **Trackers** (voir plus bas). Le tableau des widgets indique quel agent alimente quel widget.

Si ça n'a pas marché : sans agent tracker activé, le HUD n'affiche aucun widget. Vérifie que l'interrupteur **Enable Agents** est activé.

## Où le HUD apparaît

Sur téléphone, les trackers sont les boutons déplaçables **World State** et **Player & Tracker**. Appuie sur l'un d'eux pour ouvrir son panneau, et sur **X** pour le fermer. Dès que World State a des détails, son bouton affiche une petite bannière avec le lieu, le jour, l'heure, la météo et la température. Fais glisser les boutons où tu veux. Ton chat mémorise l'endroit où tu les as placés. Ils suivent ton **Chat widget style** (style des widgets du chat) dans **Settings → Appearance → App** (Paramètres → Apparence → Application).

Sur ordinateur, les mêmes trackers apparaissent à l'un de ces deux endroits :

- Le **Tracker Panel** : un panneau latéral à côté de tes messages. Il est activé par défaut. Le bouton en forme de dé dans la barre de titre de **Chat Settings** l'active et le désactive.
- La fenêtre **Trackers** : une fenêtre déplaçable qui contient les trackers quand le Tracker Panel est désactivé.

Tu n'utilises que l'un des deux à la fois. Voir [Le panneau Tracker Panel](#the-tracker-panel) et [La fenêtre Trackers](#the-trackers-window).

## Les widgets du HUD

| Widget | Agent requis | Contenu affiché |
| --- | --- | --- |
| **World State** | World State | Le lieu, la date, l'heure, la météo, la température et tes champs de monde personnalisés |
| **Persona Stats** | Persona Stats | Les barres d'état de ton persona et une ligne de statut |
| **Present Characters** | Character Tracker | Qui est dans la scène, avec l'humeur, l'apparence et les champs personnalisés |
| **Inventory** | Persona Stats | Les objets que tu transportes, avec leurs quantités |
| **Inventory Tracker** | Inventory Tracker | Des listes séparées pour les monnaies, l'équipement porté et les objets transportés |
| **Active Quests** | Quest Tracker | Ton objectif actuel |
| **Custom Tracker** | Custom Tracker | Tes propres champs nommés, comme des compteurs ou une monnaie |

Le widget **Inventory** vient de l'agent **Persona Stats** : active cet agent pour obtenir les deux. **Inventory Tracker**, lui, est séparé. Il range les entrées en trois groupes, **Currencies** (monnaies), **Equipped** (équipé) et **Inventory** (inventaire), et ne liste jamais deux fois l'équipement porté.

Chaque entrée est une petite pastille. Une quantité ne s'affiche sous la forme `×4` que si elle dépasse un. Pour changer une quantité qui vaut un, active le mode ajout ou le mode verrouillage : les deux font apparaître le contrôle de quantité sur chaque entrée. Le mode ajout correspond au bouton **+** dans l'en-tête du Tracker Panel. Le [mode verrouillage](#lock-mode) est expliqué plus bas.

**Present Characters** affiche jusqu'à trois emoji de personnage, plus un compteur "+N". **Inventory** et **Custom Tracker** affichent leurs entrées une par une.

## Modifier une valeur de tracker

Tous les champs sont modifiables : tu peux donc corriger une valeur sur laquelle l'IA s'est trompée. Ta modification est enregistrée tout de suite. La réponse suivante part de ta valeur corrigée, y compris quand tu régénères la réponse que tu as corrigée ou que tu en demandes un swipe (une réponse alternative).

1. Ouvre le tracker : appuie sur son bouton sur téléphone, ou ouvre sa section dans le Tracker Panel ou la fenêtre Trackers sur ordinateur.
2. Clique sur la valeur et tape la nouvelle.

- **World State** : **Location**, **Date**, **Time**, **Weather**, **Temperature** et les champs de monde personnalisés.
- **Persona Stats** : une ligne **Status**, et des barres nommées avec une valeur actuelle et une valeur maximale. Ajoute ou supprime des barres.
- **Present Characters** : ajoute ou supprime des personnages. Modifie pour chacun l'emoji, le nom, **Mood** (humeur), **Look** (apparence), **Outfit** (tenue), **Thinks** (les pensées privées) et les champs personnalisés. Tu peux téléverser un avatar pour chacun. Le bouton **Auto** active ou désactive "Auto-generate avatars".
- **Inventory** : ajoute ou supprime des objets. Modifie les noms et les quantités.
- **Inventory Tracker** : ajoute ou supprime des entrées sous **Currencies**, **Equipped** et **Inventory**. Pour déplacer un objet vers un autre groupe, retire-le et ajoute-le dans cet autre groupe.
- **Active Quests** : ajoute ou supprime des quêtes. Chaque quête a des objectifs avec des cases à cocher.
- **Custom Tracker** : ajoute, supprime ou modifie les champs de nom et de valeur.

Pour corriger beaucoup de valeurs d'un coup, utilise le [State Editor](#the-state-editor).

<a id="lock-mode"></a>

## Le mode verrouillage

Les agents trackers écrasent les valeurs du HUD après chaque tour. Le mode verrouillage te permet de figer une valeur. Quand un champ est verrouillé, l'exécution automatique suivante n'y touche pas. Utilise-le quand une valeur dérive sans cesse.

1. Ouvre le tracker.
2. Clique sur l'interrupteur de verrouillage près du haut du tracker (infobulle **Enter lock mode**). Un petit bouton de verrouillage apparaît à côté de chaque valeur modifiable.
3. Clique sur le bouton de verrouillage à côté de la valeur (infobulle **Lock field**). Les champs verrouillés sont signalés.

Pour déverrouiller, clique de nouveau sur le même bouton (**Unlock field**). Pour quitter le mode verrouillage, clique de nouveau sur l'interrupteur du haut (**Exit lock mode**). Le mode verrouillage est partagé par tout le HUD : l'activer dans un tracker fait apparaître les boutons de verrouillage partout.

## Relancer un tracker

Pour mettre à jour un tracker tout de suite au lieu d'attendre le message suivant, clique sur le bouton en forme de flèche circulaire à l'intérieur. Il relance seulement ce tracker sur le dernier tour. L'infobulle nomme le tracker, par exemple **Re-run world state tracker only**.

Pour qu'un tracker ne s'exécute que quand tu le demandes, ouvre **Chat Settings → Agents → Trackers Control** (réglages du chat → Agents → contrôle des trackers) et active le tracker sous **Individual tracker schedule** (planification individuelle des trackers). Un tracker manuel ne s'exécute pas après chaque réponse. Un chat où l'ancien interrupteur **Manual Trackers** (trackers manuels) était activé affiche à cet endroit tous les trackers activés.

Tant qu'au moins un tracker est manuel, un bouton d'actualisation apparaît : dans la rangée du HUD sur téléphone, et à côté du titre de la fenêtre Trackers sur ordinateur. Clique dessus pour lancer les trackers manuels sur le tour actuel.

**Agent activity** est l'endroit où relancer tous les trackers, réessayer les agents en échec et utiliser **Clear Trackers** (effacer les trackers). Voir [Agent activity](getting-started.md#agent-activity).

> **Avertissement :** **Clear Trackers** efface tout l'état du monde suivi pour le chat, et c'est irréversible.

<a id="the-trackers-window"></a>

## La fenêtre Trackers

Sur ordinateur, les trackers utilisent la fenêtre **Trackers** quand le Tracker Panel est désactivé. S'il y a de la place à côté de tes messages, elle s'ouvre à gauche. Sinon, elle commence sous forme d'un petit bouton **Trackers** en haut à gauche du chat. Clique sur le bouton pour l'ouvrir. Un chat avec une disposition enregistrée garde ton agencement.

Déplace la fenêtre par sa barre de titre et redimensionne-la par ses bords. Ses boutons en haut à droite sont :

- **Pin** (épingler) : la garde ouverte quand tu cliques ailleurs. Elle commence épinglée.
- **Lock** (verrouiller) : l'empêche d'être déplacée ou redimensionnée, et fixe son bouton en place. Le bouton ouvre toujours la fenêtre.
- **Close** (fermer) : la réduit au bouton déplaçable **Trackers**.

**Reset View** (réinitialiser la vue) dans Chat Settings efface l'agencement enregistré et choisit la fenêtre ou le bouton de départ selon la place disponible.

Chaque tracker a une section repliable. Clique sur son en-tête pour la réduire à un petit aperçu, puis à nouveau pour l'ouvrir. Marinara mémorise celles que tu as repliées.

Pour donner à un tracker sa propre fenêtre, clique sur le bouton de détachement à côté de sa flèche, ou fais glisser son titre hors de la fenêtre Trackers. La nouvelle fenêtre n'est pas épinglée au départ. Épingle-la pour la garder ouverte. **X** la réduit à un petit bouton portant l'icône du tracker. **World State**, lui, se réduit plutôt en bannière, avec le même lieu, la même date, la même heure et la même météo que sur téléphone : tu peux donc la faire glisser où tu veux, par exemple en haut au centre du chat. Pour la ranger, clique sur **Put back in Trackers** (la flèche courbe à gauche de **X**) ou fais-la glisser sur la fenêtre Trackers. Chaque chat mémorise quels trackers sont détachés et où.

<a id="the-tracker-panel"></a>

## Le panneau Tracker Panel

Le **Tracker Panel** est un panneau latéral plus grand, avec les mêmes données. Il affiche aussi les portraits et les pensées des personnages.

1. Ouvre **Chat Settings**.
2. Clique sur le bouton **Tracker Panel** (le dé) dans sa barre de titre, à côté de l'épingle et du verrou. Il reste mis en évidence tant que le panneau est activé.
3. Clique à nouveau dessus pour masquer le panneau. Sur ordinateur, les trackers s'affichent alors dans la fenêtre Trackers.

Sur ordinateur, le panneau tient à côté de tes messages, jusqu'à la largeur définie par **Desktop size** (taille sur ordinateur). Quand la fenêtre est trop étroite pour les deux, par exemple quand la barre latérale des chats est ouverte, tes messages et la zone de saisie se rétrécissent un peu. Sur téléphone ou tablette, l'activer ajoute un bouton Tracker Panel que tu peux faire glisser. Appuie dessus pour ouvrir le panneau, et appuie de nouveau pour le fermer. Tant que le panneau ou un autre écran recouvre le chat, les boutons déplaçables du chat sont masqués, puis ils reviennent aux mêmes endroits.

### Personnaliser les champs des trackers

Les boutons de l'en-tête du panneau changent la structure du tracker :

- **+** passe en mode ajout. La section World gagne **Add world field** (ajouter un champ de monde), et la carte de chaque personnage présent gagne **Add custom field** (ajouter un champ personnalisé). Les noms des champs restent visibles en mode normal.
- L'icône de corbeille passe en mode suppression, où tu retires des champs de monde ou de personnage personnalisés. Retirer un champ retire aussi ses verrouillages.
- L'icône de cadenas passe en mode verrouillage. Les champs personnalisés se verrouillent de la même façon que les champs intégrés.
- L'icône d'œil barré passe en mode masquage. Choisis **Mood**, **Look**, **Outfit** ou **Thoughts** (pensées) sur la carte d'un personnage. Un champ masqué disparaît du Tracker Panel et du HUD, est vidé et reste verrouillé, pour que les agents ne le remplissent pas de nouveau. Repasse en mode masquage pour l'afficher de nouveau, sous forme de champ vide.

Les agents mettent à jour les valeurs de tes champs personnalisés. Ils ne suppriment jamais un champ que tu as créé.

### Créer un nouveau portrait

La grande carte d'un personnage peut créer un nouveau portrait dès que Character Tracker dispose d'une connexion d'images. Sur une carte compacte, clique sur **Feature character card** (mettre en avant la carte du personnage) pour ouvrir la grande carte. La fenêtre Trackers affiche toujours de grandes cartes. Survole le portrait et clique sur le bouton en forme d'œil pour en créer un à partir de **Look**, ou sur le bouton en forme de chemise pour **Look** et **Outfit**. Le bouton en forme de chemise n'apparaît que si le personnage a une tenue. L'ancien portrait reste en place jusqu'à ce que le nouveau soit prêt. Si la création échoue, tu gardes l'ancien. Les personnages affichés avec l'avatar de leur fiche ou un sprite d'expression n'ont pas ces boutons.

### Réglages du Tracker Panel

Ouvre **Settings → Appearance** (Paramètres → Apparence), ouvre le groupe **Roleplay** et trouve la section **Tracker Panel**.

| Réglage | Ce qu'il fait |
| --- | --- |
| **Tracker Panel** | L'interrupteur, le même que celui que le dé actionne. Activé par défaut. Quand il est activé, l'étiquette indique "Shown in the Roleplay HUD". |
| **Dock Tracker Panel to edge** (ancrer le Tracker Panel au bord) | Place le panneau contre le bord de l'écran et empêche les contrôles du chat voisins de le chevaucher. |
| **Use expression sprites for tracker portraits** (utiliser les sprites d'expression pour les portraits des trackers) | Utilise le sprite d'expression actuel d'un personnage au lieu du simple avatar, quand il en existe un. Voir [Sprites de personnage](../characters/sprites.md). |
| **Panel background** (arrière-plan du panneau) | Une couleur ou un dégradé pour le panneau. |
| **Desktop size** | La largeur du panneau : **Compact**, **Standard** ou **Expanded**. |
| **Thought display mode** (mode d'affichage des pensées) | **Docked** ouvre les pensées dans la carte du personnage. **Floating** les ouvre dans une bulle à côté du portrait. |
| **Always show Docked thoughts** (toujours afficher les pensées Docked) | Avec **Docked**, garde visible la pensée de chaque personnage mis en avant, au lieu de la cacher derrière un bouton. |
| **Stat display mode** (mode d'affichage des caractéristiques) | Affiche les caractéristiques sous forme de barres ou de jauges circulaires. |
| **Temperature unit** (unité de température) | **°C** (par défaut) ou **°F**. Cela ne change que l'affichage, pas la valeur enregistrée. |

<a id="the-state-editor"></a>

## Le State Editor

Le **State Editor** affiche tous les trackers du tour en cours dans une seule fenêtre, pour que tu puisses retrouver une valeur et la corriger sans ouvrir chaque tracker. Il fonctionne aussi sur téléphone.

Ouvre-le depuis l'un de ces endroits :

- L'engrenage (**Tracker panel settings**) dans l'en-tête du Tracker Panel, puis le bouton **{ }** (**Open in State Editor**).
- Le bouton **{ }** dans la barre de titre de la fenêtre **Trackers**, ou d'un tracker que tu as détaché.
- Sur téléphone, le bouton **{ }** dans les panneaux **World State** et **Player & Tracker**.
- Le lien **Open in State Editor** sous **Tracker Data** dans **Agent Suite**.

Il s'ouvre sur la section du tracker d'où tu viens. World State s'ouvre sur **Scene**, par exemple.

- **Ligne du tour** : sous le champ de recherche. Elle nomme le message et le swipe que tu modifies, par exemple "Editing message #12 · swipe 2 of 3". **Latest** (le plus récent) marque le tour le plus récent. Chaque swipe a son propre état : change donc de swipe d'abord pour en modifier un autre.
- **Sections** : **Scene**, **Present Characters**, **Persona Stats**, **Inventory Tracker**, **Custom Tracker Fields** et **Active Quests**. Sur téléphone, ce sont des pastilles au-dessus de l'éditeur. Un point signale une section modifiée.
- **Recherche** : tape une clé ou une valeur, comme `mood`. Clique sur un résultat pour y aller directement.
- **Fields** (champs) : chaque section s'ouvre en **Fields**, avec des champs pour le texte, les nombres et les valeurs activé/désactivé.
- **No value** (aucune valeur) : un champ vide propose un choix entre **Text** (texte), **Number** (nombre) ou **On/off** (activé/désactivé).
- **Add item** (ajouter un élément) : ajoute une entrée, en copiant celle du dessus.
- **Add** (ajouter) : ajoute un champ nommé à une section ou à une carte vide.
- **×** : retire une entrée, ou vide une valeur.
- **JSON** : modifie les données brutes. **Format** (mettre en forme) les remet en ordre. Une section au JSON invalide ne peut pas être enregistrée tant que tu ne l'as pas corrigée.
- **Revert** (annuler) : défait tes changements dans une section.

Les personnages et les quêtes appartiennent à l'histoire : tu ne peux donc pas ajouter leurs cartes ici. Tu peux modifier les listes qu'elles contiennent, comme les caractéristiques d'un personnage.

Pour enregistrer :

1. Clique sur **Review changes** (relire les changements) pour voir chaque changement, ligne par ligne.
2. Clique sur **Save changes** (enregistrer les changements). Cela écrit toutes les sections d'un coup dans le tour que tu modifiais.

D'ici là, tes brouillons restent dans la fenêtre, et la fermer demande confirmation avant de les jeter.

Si ça n'a pas marché : si l'histoire a avancé pendant que tu modifiais, l'éditeur ne l'écrase pas. Une nouvelle réponse ou un nouveau swipe, ou une mise à jour d'un tracker sur une section que tu as changée, fait refuser l'enregistrement avec un bouton **Reload** (recharger). **Reload** affiche l'état le plus récent et abandonne tes brouillons.

## Guides associés

- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Couleurs des personnages et Caractéristiques de Roleplay](../characters/colors-and-stats.md) : l'onglet **Stats** (caractéristiques) définit les barres et les attributs avec lesquels un persona ou un personnage commence.
- [Mode Roleplay : premiers pas](getting-started.md)
- [Game Mode : les widgets du HUD](../game/hud-widgets.md)
