# Référence des commandes slash

Ce guide liste les commandes slash que tu peux taper dans un chat de Marinara Engine. Une commande slash est un raccourci que tu saisis dans la zone de message, en commençant par une barre oblique, pour aller plus vite. Certaines commandes agissent tout de suite sur ton écran, d'autres demandent à l'IA d'écrire quelque chose.

## Comment fonctionnent les commandes slash

Pour lancer une commande slash, tape-la dans la zone de message en bas du chat, puis clique sur **Send** (envoyer). La touche Enter l'envoie aussi si l'option **Send on Enter** (envoyer avec Enter) est activée pour ton mode de chat dans **Settings** (Paramètres). Par défaut, Enter envoie le message dans les chats **Conversation**, mais insère un saut de ligne dans les chats **Roleplay**. La zone de message rappelle l'existence des commandes slash. Dans un chat **Roleplay**, le texte indicatif affiche **Write your response, / for commands**. Dans un chat **Conversation**, il affiche le nom du personnage, par exemple "Message @Alice, / for commands". Une conversation à plusieurs personnages affiche le nom du chat à la place.

Dès que tu tapes une barre oblique, un petit menu des commandes correspondantes s'ouvre au-dessus de la zone. Chaque ligne indique le format de la commande, avec ses arguments, et une courte description. Clique ou tape sur une ligne pour la placer dans la zone de message, puis ajoute le texte voulu et envoie.

Remplace les libellés entre crochets, comme `[name]` ou `[range]`, par tes valeurs ; ne tape pas les crochets. Tu peux omettre les arguments marqués `(optional)`. Le signe `|` sépare les alternatives, que ce soient des valeurs comme `prompt|reset` ou des formats de commande complets.

Beaucoup de commandes ont des alias plus courts. Par exemple, `/continue` et son alias `/cont` font exactement la même chose. Pour consulter la liste complète dans l'application à tout moment, lance cette commande :

```
/help
```

Certaines commandes s'exécutent dans le navigateur et modifient le chat immédiatement, sans rien coûter. D'autres demandent à l'IA de générer du texte : elles passent par le fournisseur connecté et peuvent consommer des tokens. Un token est l'unité utilisée par la plupart des fournisseurs d'IA pour mesurer et facturer le texte. Les tableaux ci-dessous précisent ce que fait chaque commande.

Les commandes slash fonctionnent dans les zones de message **Conversation** et **Roleplay**. En mode **Game**, seule `/illustrate` fonctionne comme commande slash. Tout autre texte commençant par une barre oblique part comme message normal.

Plusieurs commandes utilisent des numéros de message. Marinara numérote les messages à partir du premier du chat : 1, puis 2, puis 3, et ainsi de suite. Les commandes comme `/goto`, `/hide` et `/unhide` s'appuient sur ces numéros.

## Commandes de chat et de message

Ces commandes servent à gérer le chat et ses messages. Elles fonctionnent dans les chats **Conversation** et **Roleplay**.

| Commande | Autres formes | Ce qu'elle fait |
|---|---|---|
| `/help` | | Liste toutes les commandes slash. |
| `/send [message]` | | Publie un message au nom de ton persona sans lancer de génération. |
| `/continue` | `/cont` | Ajoute du texte à la dernière réponse de l'IA, sans envoyer de nouveau message. L'option **Add a new line before /continue text** dans **Settings → General → Responses** détermine si ce texte commence après une ligne vide ou juste après la coupure. |
| `/goto [number]` | `/jump`, `/scroll` | Fait défiler le chat jusqu'à un message donné par son numéro. |
| `/hide [range] [name (optional)]` | | Masque un ou plusieurs messages à l'IA pour les tours suivants. |
| `/unhide [range]` | | Redonne à l'IA l'accès aux messages masqués. |
| `/sys [message]` | `/system` | Ajoute un message système. Cette note apparaît dans le chat et oriente l'IA, mais aucun personnage ne la prononce. |
| `/macros` | `/macro` | Liste les macros de prompt prises en charge, comme `{{user}}` et `{{char}}`. |
| `/remind [time] [message]` | `/reminder`, `/timer` | Lance un minuteur, puis publie un rappel dans le chat. |

Pour sauter au message 27, tape ceci :

```
/goto 27
```

`/hide` et `/unhide` acceptent un numéro seul, une plage, ou un mélange des deux. Par exemple, ceci masque les messages 3 à 8 :

```
/hide 3-8
```

Tu peux aussi écrire `/hide 5` pour un message, ou `/hide 2-5,9,12` pour plusieurs. Sans nom de personnage, les messages sont masqués pour tout le monde. Les messages masqués restent dans le chat, mais l'IA ne les lit pas au tour suivant. Utilise `/unhide` avec le même type de liste de numéros pour rétablir les messages masqués globalement.

Dans **Roleplay**, ajoute un nom de personnage après la plage pour masquer ces messages uniquement pour ce personnage :

```
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

L'accès des autres personnages ne change pas. Si tu places le nom en premier, mets-le entre guillemets s'il contient des espaces : les anciennes formes `/hide Maukie 3-8` et `/hide "Powers That Be" 2-5,9` fonctionnent toujours. Si un nom correspond à plusieurs personnages, utilise le nom complet. Mets les noms numériques entre guillemets pour les distinguer des numéros de message, par exemple `/hide 1 "123"`. Dans un chat Roleplay de groupe, utilise le sélecteur d'avatars de **Hide from AI** (masquer pour l'IA) du message pour consulter ou annuler le masquage par personnage. Dans un chat Roleplay avec un seul personnage, utilise plutôt l'action **Unhide from AI** (réafficher pour l'IA) du message. `/unhide` annule uniquement le masquage global.

La commande `/remind` prend d'abord une durée, puis un message. La durée s'écrit avec `h` pour les heures, `m` pour les minutes et `s` pour les secondes. Cet exemple te rappelle quelque chose dans 30 minutes :

```
/remind 30m check the oven
```

Le rappel vit dans la session du navigateur : garde l'onglet ouvert jusqu'à ce qu'il se déclenche.

## Commandes d'histoire et de roleplay

Ces commandes servent à orienter une histoire, à jouer un personnage et à ajouter des images. La plupart donnent le meilleur résultat dans un chat **Roleplay**. Seule exception : `/scene`, qui se lance depuis un chat **Conversation**.

| Commande | Autres formes | Ce qu'elle fait |
|---|---|---|
| `/guided [direction]` \| `/guided respond for [name] [direction (optional)]` | `/narrator`, `/narrate`, `/nar` | Oriente la prochaine réponse de l'IA dans la direction que tu décris. |
| `/as [name] [message (optional)]` | `/respond` | Publie un message au nom d'un personnage, ou demande à un personnage de répondre. |
| `/emote [expression (optional)]` \| `/emote "[name]" [expression (optional)]` | `/emotion`, `/sprite` | Liste les expressions du sprite d'un personnage, ou en change. |
| `/roll [dice (optional)]` | `/r`, `/dice` | Lance les dés et publie le résultat. |
| `/random` | `/rand`, `/event` | Demande à l'IA d'ajouter un événement surprise à l'histoire. |
| `/scene [description (optional)]` | `/rp` | À lancer depuis un chat Conversation. Démarre une nouvelle scène Roleplay qui crée une branche à partir de cette conversation. |
| `/illustrate [range=N or range=N-M (optional)] [prompt (optional)]` | `/ill` | Génère une image de galerie pour le chat en cours. |
| `/impersonate [direction (optional)]` | `/imp` | Écrit une réponse à la place de ton persona. |
| `/impersonate_prompt [prompt\|reset]` | `/imp_prompt` | Définit l'instruction utilisée par `/impersonate` dans ce chat. |

Dans **Roleplay**, `/illustrate range=12` illustre le message 12 et `/illustrate range=12-18` transmet les messages 12 à 18 à Illustrator. Utilise les mêmes numéros que pour `/goto`, dans l'ordre croissant, avec un maximum de 200 messages. Les messages masqués restent exclus. L'image est jointe au dernier message visible de la plage ; la révision du prompt conserve cette sélection même si de nouveaux messages arrivent. Les anciens messages restent disponibles avec Advanced Memory activé. Sans `range=`, la commande conserve son comportement habituel pour la scène actuelle. Un prompt saisi facultatif est utilisé directement, comme avant.

Pour orienter la prochaine réponse, ajoute ta direction après `/guided` :

```
/guided make him confess he is lying
```

Dans un chat Roleplay de groupe, utilise `/guided respond for [name] [direction (optional)]` pour choisir le personnage qui répond. Par exemple :

```
/guided respond for "Powers That Be" describe the approaching storm
```

Utilise `/as [name] [message (optional)]` pour publier du texte au nom d'un personnage. Si tu omets le message, le modèle génère plutôt la prochaine réponse de ce personnage :

```
/as Dottore "The experiment begins."
/as Dottore
```

La commande `/roll` comprend la notation des dés. Ceci lance deux dés à six faces :

```
/roll 2d6
```

Tu peux ajouter un modificateur, par exemple `/roll 1d20+5`. Si tu tapes `/roll` sans rien derrière, Marinara lance `1d20`.

Un sprite est une image du personnage qui montre une expression. La commande `/emote` change celle qui est affichée. Tape `/emote` seul pour voir les expressions disponibles, ou nomme-en une pour l'afficher :

```
/emote joy
```

Pour cibler un personnage, utilise `/emote "[name]" [expression (optional)]`, par exemple `/emote "Powers That Be" joy`. Omettre l'expression affiche la liste des expressions disponibles pour ce personnage.

Le changement de sprite exige un chat Roleplay avec des sprites déjà téléversés. Voir [Sprites de personnage](../characters/sprites.md) pour savoir comment les ajouter.

Ton persona est le personnage qui te représente dans un chat, écrit `{{user}}` dans les prompts. La commande `/impersonate` écrit une réponse à ta place. Tu peux lui ajouter une direction :

```
/impersonate ask about the weather
```

`/impersonate` et `/impersonate_prompt` ne sont pas disponibles dans les chats **Conversation**. Pour un tour d'horizon complet de la génération guidée et de l'impersonation, voir [Génération guidée et Impersonate](guided-and-impersonate.md).

## Commandes du mode Conversation

Ces commandes fonctionnent uniquement dans un chat **Conversation**.

| Commande | Ce qu'elle fait |
|---|---|
| `/games` | Ouvre le sélecteur des jeux Conversation installés. `/game` et `/play` font la même chose. |
| `/selfie [name (optional)]` | Génère un selfie avec l'agent Illustrator installé. Ajoute un nom pour choisir un personnage. |
| `/uno` | Démarre une partie d'UNO avec les personnages du chat. |
| `/chess` | Démarre une partie d'échecs en tête-à-tête avec un personnage. |
| `/poker` | Démarre une partie de poker Texas Hold'em avec les personnages. |
| `/8ball` | Démarre une partie de billard 8-ball en tête-à-tête avec un personnage. `/pool` fait la même chose. |
| `/status [online\|idle\|dnd\|offline\|clear] [name (optional)]` | Définit ou efface le statut de présence d'un personnage. |

Les commandes `/uno`, `/chess`, `/poker` et `/8ball` ouvrent l'écran de configuration du jeu concerné. Une seule partie à la fois par chat. Pour les règles et les options, voir [Jeux de table](../conversation/table-games.md).

La commande `/status` remplace le statut de présence d'un personnage. Le statut peut être `online`, `idle`, `dnd` (ne pas déranger) ou `offline`. Utilise `clear` pour supprimer ce remplacement. Ceci met le personnage en absence :

```
/status idle
```

Dans un chat à plusieurs personnages, ajoute le nom du personnage à la fin, par exemple `/status online Alice`.

## Guides associés

- [Actions sur les messages](messages.md)
- [Génération guidée et Impersonate](guided-and-impersonate.md)
- [Jeux de table](../conversation/table-games.md)
- [Macros](../prompts/macros.md)
