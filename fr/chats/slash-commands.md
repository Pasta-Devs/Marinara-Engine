# Référence des commandes slash

Une commande slash est un raccourci que tu tapes dans la zone de message, en commençant par `/`, pour faire quelque chose rapidement. Certaines changent l'écran tout de suite. D'autres demandent au modèle d'écrire quelque chose.

## Comment fonctionnent les commandes slash

1. Tape la commande dans la zone de message, en bas d'un chat.
2. Clique sur **Send** (envoyer), ou appuie sur <kbd>Enter</kbd> si **Send on Enter** (envoyer avec Enter) est activé pour ton mode de chat. Voir [Envoyer des messages et le streaming](sending-and-streaming.md#send-on-enter).

Dès que tu tapes `/`, un menu des commandes correspondantes apparaît au-dessus de la zone. Chaque ligne indique le format de la commande et une courte description. Clique sur une ligne pour la placer dans la zone, ajoute le texte voulu, puis envoie. Le texte indicatif de la zone mentionne aussi les commandes : **Write your response, / for commands** en Roleplay, et "Message @Alice, / for commands" en Conversation.

Dans les tableaux, le format de chaque commande figure dans sa ligne. Remplace les libellés entre crochets, comme `[name]` ou `[range]`, par tes propres valeurs, et ne tape pas les crochets. Les éléments marqués `(optional)` peuvent être omis. Un `|` sépare les alternatives. Beaucoup de commandes ont des alias plus courts, comme `/cont` pour `/continue`. Pour voir toutes les commandes dans l'application, tape :

```text
/help
```

Certaines commandes s'exécutent dans ton navigateur et ne coûtent rien. D'autres demandent au modèle d'écrire du texte, ce qui utilise ton compte et peut consommer des tokens (les unités que les services comptent et facturent).

Les commandes slash fonctionnent dans les zones de message Conversation et Roleplay. En Game, seule `/illustrate` (ou `/ill`) employée seule, sans plage ni prompt, fonctionne, et uniquement quand les illustrations de Game sont configurées avec un compte d'images. Tout autre texte qui commence par une barre oblique est envoyé comme du texte normal. En Roleplay et en Conversation, les commandes `/illustrate`, `/selfie` et `/video` ont besoin de l'agent Illustrator et n'apparaissent que s'il est installé.

Plusieurs commandes utilisent des numéros de message. Marinara compte à partir du premier message du chat, qui porte le numéro 1. `/goto`, `/hide` et `/unhide` utilisent ces numéros. **Show message numbers** (afficher les numéros des messages) les affiche. Voir [Actions sur les messages](messages.md#message-display-toggles).

## Commandes de chat et de message

Elles fonctionnent en Conversation et en Roleplay.

| Commande | Ce qu'elle fait |
| --- | --- |
| `/help` | Liste toutes les commandes slash. |
| `/send` | Publie un message au nom de ton persona sans demander de réponse. Les macros sont remplacées, comme avec **Send**. Format : `/send [message]`. |
| `/continue` | Ajoute du texte à la dernière réponse de l'IA, sans nouveau message. Alias : `/cont`. **Settings → General → Responses → Add a new line before /continue text** (Paramètres → Général → Réponses → ajouter une nouvelle ligne avant le texte de /continue) détermine si le texte commence après une ligne vide ou juste à la coupure. |
| `/goto` | Fait défiler le chat jusqu'à un numéro de message. Alias : `/jump`, `/scroll`. Format : `/goto [number]`. |
| `/hide` | Masque des messages au modèle pour les tours suivants. Format : `/hide [range] [name (optional)]`. |
| `/unhide` | Rétablit les messages masqués globalement. Format : `/unhide [range]`. |
| `/sys` | Ajoute un message système. Il apparaît dans le chat et oriente le modèle, mais aucun personnage ne le prononce. Alias : `/system`. Format : `/sys [message]`. |
| `/macros` | Liste les macros de prompt comme `{{user}}` et `{{char}}`. Alias : `/macro`. |
| `/remind` | Lance un minuteur, puis publie un rappel dans le chat. Alias : `/reminder`, `/timer`. Format : `/remind [time] [message]`. |

Exemples :

```text
/goto 27
/hide 3-8
/remind 30m check the oven
```

`/hide` et `/unhide` acceptent un numéro, une plage, ou un mélange des deux : `/hide 5`, `/hide 3-8`, `/hide 2-5,9,12`. Les messages masqués restent dans le chat, mais le modèle ne les lit pas.

En Roleplay, ajoute un nom de personnage après la plage pour masquer les messages uniquement pour ce personnage. Les autres personnages y gardent accès.

```text
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

Mets entre guillemets les noms qui contiennent des espaces. Les anciennes formes avec le nom en premier, comme `/hide Maukie 3-8`, fonctionnent toujours. Si un nom correspond à plusieurs personnages, utilise le nom complet. Mets les noms numériques entre guillemets pour les distinguer des numéros de message, par exemple `/hide 1 "123"`. Pour consulter ou annuler un masquage propre à un personnage, utilise le sélecteur d'avatars **Hide from AI** (masquer pour l'IA) du message dans un chat Roleplay de groupe, ou **Unhide from AI** (réafficher pour l'IA) dans un chat avec un seul personnage. `/unhide` n'annule que le masquage global.

`/remind` prend une durée avec `h` (heures), `m` (minutes) ou `s` (secondes), puis un message. Le rappel vit dans la session de ton navigateur : garde l'onglet ouvert jusqu'à ce qu'il se déclenche.

## Commandes d'histoire et de roleplay

| Commande | Ce qu'elle fait |
| --- | --- |
| `/guided` | Oriente la prochaine réponse. Alias : `/narrator`, `/narrate`, `/nar`. Format : `/guided [direction]`. |
| `/as` | Publie un message au nom d'un personnage, ou demande à ce personnage de répondre. Alias : `/respond`. Format : `/as [name] [message (optional)]`. |
| `/emote` | Liste ou change une expression de sprite. Alias : `/emotion`, `/sprite`. Format : `/emote [expression]`. |
| `/roll` | Lance des dés et publie le résultat. Alias : `/r`, `/dice`. Format : `/roll [dice (optional)]`. |
| `/random` | Demande au modèle d'ajouter un événement surprise. Alias : `/rand`, `/event`. |
| `/scene` | Démarre une scène Roleplay qui crée une branche à partir de la conversation. Alias : `/rp`. Format : `/scene [description (optional)]`. |
| `/illustrate` | Roleplay uniquement. Génère une image de galerie. Nécessite l'agent Illustrator. Alias : `/ill`. Format : `/illustrate [range=N-M] [prompt]`. |
| `/html` | Roleplay uniquement. Crée un artefact propre à l'univers de l'histoire, comme `a spellbook page`, à la fin de la dernière réponse. Format : `/html [what you want]`. |
| `/video` | Roleplay uniquement. Crée un court clip de la dernière réponse, ou de ta description, sous cette réponse. Suit le réglage **First frame** (première image) d'Illustrator. Nécessite Illustrator. Format : `/video [description]`. |
| `/impersonate` | Écrit une réponse au nom de ton persona. Alias : `/imp`. Format : `/impersonate [direction (optional)]`. |
| `/impersonate_prompt` | Définit l'instruction qu'utilise `/impersonate` dans ce chat. Alias : `/imp_prompt`. Format : `/impersonate_prompt [prompt or reset]`. |

La plupart donnent le meilleur résultat en Roleplay. `/scene` se lance depuis une Conversation. `/impersonate` et `/impersonate_prompt` ne sont pas disponibles en Conversation.

### Orienter une réponse

```text
/guided make him confess he is lying
/guided respond as "Powers That Be" describe the approaching storm
```

`reply as` et `respond for` fonctionnent aussi à la place de `respond as`. Voir [Génération guidée et Impersonate](guided-and-impersonate.md).

### Publier au nom d'un personnage

Omets le message pour que le modèle écrive la prochaine réponse de ce personnage.

```text
/as Dottore "The experiment begins."
/as Dottore
```

### Lancer les dés

`/roll 2d6` lance deux dés à six faces. Ajoute un modificateur, comme dans `/roll 1d20+5`. Sans rien derrière, `/roll` lance `1d20`. Pour ne garder qu'une partie des dés, ajoute `kh` (garder les plus hauts) ou `kl` (garder les plus bas) et un nombre : `/roll 4d6kh3` additionne les trois plus hauts, et `/roll 2d20kl1` garde le plus bas des deux. `dl` et `dh` écartent plutôt les plus bas ou les plus hauts, comme dans `/roll 4d6dl1`. Les dés qui ne comptent pas restent affichés, en grisé.

### Changer de sprite

Un sprite est une image du personnage qui montre une expression. Tape `/emote` seul pour voir les expressions disponibles, ou nommes-en une :

```text
/emote joy
/emote "Powers That Be" joy
```

Avec un nom et sans expression, la commande liste les expressions de ce personnage. Elle nécessite un chat Roleplay avec des sprites téléversés. Voir [Sprites de personnage](../characters/sprites.md).

### Illustrer et créer des artefacts

`/illustrate range=12` illustre le message 12. `/illustrate range=12-18` envoie les messages 12 à 18 à Illustrator. Utilise les mêmes numéros de message que pour `/goto`, dans l'ordre croissant, avec au plus 200 messages. Les messages masqués restent exclus. L'image est jointe au dernier message visible de la plage. Les messages plus anciens restent disponibles avec Advanced Memory activé. Sans `range=`, la commande porte sur la scène actuelle. Un prompt que tu tapes est utilisé tel quel.

`/html a terminal readout` ne nécessite aucun agent et fonctionne que **HTML Artifacts** (artefacts HTML) soit activé ou non. Le narrateur peut faire la même demande avec `[html: prompt="..."]` quand **HTML Artifacts** est activé sous **Roleplay Commands** (commandes Roleplay). Voir [Artefacts à la demande](../roleplay/getting-started.md#artifacts-on-demand).

### Écrire ta réponse

`/impersonate ask about the weather` écrit une réponse avec la voix de ton persona. Ton persona est le personnage qui te représente, écrit `{{user}}` dans les prompts. Ces deux commandes ne sont pas disponibles en Conversation.

## Commandes du mode Conversation

Ces commandes fonctionnent uniquement dans un chat Conversation.

| Commande | Ce qu'elle fait |
| --- | --- |
| `/games` | Ouvre le sélecteur des jeux installés. `/game` et `/play` font la même chose. |
| `/selfie` | Génère un selfie avec l'agent Illustrator. Ajoute un nom pour choisir un personnage. Format : `/selfie [name (optional)]`. |
| `/video` | Demande à un personnage d'envoyer un court message vidéo, avec les réglages **Video messages** (messages vidéo) du chat. Voir [Messages vidéo](../conversation/selfies.md#video-messages). Format : `/video [name (optional)]`. |
| `/uno` | Démarre une partie d'UNO avec les personnages du chat. |
| `/chess` | Démarre une partie d'échecs en tête-à-tête avec un personnage. |
| `/poker` | Démarre une partie de Texas Hold'em avec les personnages. |
| `/8ball` | Démarre une partie de billard 8-ball en tête-à-tête avec un personnage. `/pool` fait la même chose. |
| `/status` | Définit ou efface le statut de présence d'un personnage. Format : `/status [online, idle, dnd, offline or clear] [name]`. |

Les commandes de jeu ouvrent l'écran de configuration du jeu concerné, et chacune n'apparaît que si l'agent de son jeu est installé. Tu peux jouer à une seule partie à la fois dans un chat. Voir [Jeux de table](../conversation/table-games.md).

`/status` remplace la présence d'un personnage. Le statut peut être `online`, `idle`, `dnd` (ne pas déranger) ou `offline`. `clear` supprime ce remplacement. Dans un chat à plusieurs personnages, ajoute le nom à la fin.

```text
/status idle
/status online Alice
```
