# Les arrière-plans en Roleplay

Un chat Roleplay affiche une image de scène en pleine page derrière tes messages. Tu peux laisser l'agent **Background** (arrière-plan) la choisir après chaque réponse, en créer une nouvelle à la main, ou fixer une image pour un seul chat. Quand l'image change, Marinara passe en fondu de l'ancienne à la nouvelle.

La génération d'images n'est pas nécessaire. Sans compte de génération d'images, l'arrière-plan est une couleur unie et le chat fonctionne en texte.

## Fixer un arrière-plan pour un seul chat

Sers-t'en pour garder une seule image derrière le chat ouvert, au lieu de laisser l'agent choisir. Cela ne modifie que ce chat.

1. Ouvre le chat. Ouvre ensuite **Settings → Appearance** (Paramètres → Apparence) et repère **Backgrounds** (arrière-plans).
2. Sous **Chat Background** (arrière-plan du chat), choisis une image téléversée ou l'un de tes arrière-plans issus des ressources de jeu.

Tu vois l'image derrière tes messages. Pour revenir à l'arrière-plan par défaut, clique sur **Remove** (retirer) à côté de **Chat Background**.

Pas encore d'image ? Téléverses-en une d'abord. Voir [Arrière-plans de chat](../appearance/chat-backgrounds.md).

## Laisser l'agent Background choisir l'arrière-plan

L'agent **Background** est un assistant qui travaille en parallèle des réponses. Après chaque réponse, il lit la scène en cours et choisit, parmi tous tes arrière-plans, l'image qui convient le mieux. Il ne choisit que des images existantes. C'est l'agent **Illustrator** (illustrateur) qui en crée de nouvelles automatiquement.

1. Ouvre ton chat Roleplay.
2. Ouvre **Chat Settings** (réglages du chat) avec le bouton de curseurs dans le chat.
3. Ouvre **Agents** et active **Enable Agents** (activer les agents).
4. Ajoute l'agent **Background**.

L'arrière-plan change désormais tout seul quand l'histoire passe d'un lieu à l'autre.

Si ça n'a pas marché : avec seulement un ou deux arrière-plans, l'agent continue de choisir ceux-là. Ajoutes-en d'autres à ta bibliothèque. Voir [Arrière-plans de chat](../appearance/chat-backgrounds.md).

<a id="reuse-pictures-you-already-have"></a>

## Réutiliser les images que tu possèdes déjà

Quand Illustrator crée des arrière-plans de lui-même et que l'histoire arrive dans un nouveau lieu, il cherche d'abord un arrière-plan que tu as épinglé à ce lieu (voir [Épingler un arrière-plan à un lieu](#pin-a-background-to-a-place)). Dans un lieu épinglé, il ne peint rien. Sinon, il cherche dans ta bibliothèque d'arrière-plans. Une image convient à un lieu quand son nom de fichier, ou l'un de ses tags d'au moins deux mots, apparaît dans le lieu de World State. Par exemple, `john-bedroom.png` convient à "Smith House, John's bedroom". Les majuscules, les accents et "'s" ne comptent pas, et le nom le plus précis l'emporte sur un simple `bedroom.png`.

Sans lieu dans World State, le nom de lieu qu'Illustrator écrit pour le nouvel arrière-plan est comparé de la même façon. Si une image convient, elle s'affiche et rien n'est peint. Seul un lieu sans correspondance reçoit une nouvelle image.

Pour qu'un lieu garde son image, donne au fichier le nom du lieu (`kitchen.png` pour "Kitchen"). Un tag fonctionne aussi s'il contient au moins deux mots, comme `smith house kitchen` ; les tags d'un seul mot comme `kitchen` ou `night` sont ignorés, car ils décrivent généralement l'aspect d'une image.

## Générer un arrière-plan à la main

Marinara construit un prompt d'image – le texte que Marinara envoie à l'IA – à partir de la scène (genre, cadre, lieu, météo et moment de la journée), puis crée un nouvel arrière-plan.

Avant de commencer : installe l'agent **Illustrator** et attribue-lui un compte de génération d'images, ou marque un compte de génération d'images comme compte par défaut. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md). Tu n'as pas besoin d'ajouter Illustrator au chat.

1. Ouvre **Chat Settings** avec le bouton de curseurs dans le chat, et déplie **Gallery** (galerie).
2. Clique sur **Background**. Le bouton affiche **Generating...** pendant le traitement, et la galerie indique "Illustrator is generating a background image for this scene."
3. Attends la fin. La nouvelle image rejoint ta bibliothèque d'arrière-plans et s'applique à la scène.

La génération manuelle utilise le compte d'images de l'agent Illustrator, puis ton compte de génération d'images par défaut. Elle fonctionne en Roleplay et en Game Mode, pas en mode Conversation.

Si ça n'a pas marché : le message "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." signifie que Marinara n'a trouvé aucun compte d'images. Définis-en un, puis réessaie. Si le bouton **Background** est absent, Illustrator n'est pas installé.

<a id="pin-a-background-to-a-place"></a>

## Épingler un arrière-plan à un lieu

Utilise cette fonction quand un lieu de ton histoire doit toujours avoir le même aspect : la chambre de John affiche toujours `john-bedroom`, et ta propre chambre affiche toujours `my-bedroom`. Quand l'histoire arrive dans un lieu épinglé, son image s'affiche, quel qu'ait été le choix de l'agent Background.

1. Ouvre **Réglages du chat** avec le bouton de curseurs dans le chat, puis ouvre **Arrière-plan**.
2. Sous **Lieux épinglés**, clique sur **Ajouter un lieu**.
3. Clique sur l'image vide et choisis l'arrière-plan. Saisis le lieu tel que l'histoire l'écrit, par exemple `John's bedroom`.
4. Facultatif : en dessous, ajoute d'autres noms que l'histoire pourrait utiliser, séparés par des virgules, par exemple `John's room, the master bedroom`.

Plus rapide : quand l'histoire se déroule dans un lieu et que la bonne image est affichée, clique sur **Épingler cette image à "John's bedroom"**.

Comment les lieux sont distingués :

- Le nom le plus précis l'emporte. `John's bedroom` et `{{user}}'s bedroom` ne se mélangent jamais, et une image simplement épinglée à `bedroom` ne sert que pour les chambres auxquelles personne n'a épinglé d'image.
- Un ou deux mots intercalés comptent quand même : "John's guest bedroom" correspond à `John's bedroom`, sauf si une autre épingle nomme exactement ce lieu.
- `{{user}}` est le nom de ton persona et `{{char}}` celui de n'importe quel personnage du chat : `{{user}}'s bedroom` correspond donc à "Alyssa's bedroom".
- "My" et "our" renvoient à la personne qui a écrit le message. Quand la réponse de John situe l'histoire dans "my bedroom", il s'agit de sa chambre ; "your bedroom" dans sa réponse désigne la tienne. Dans ton propre message, "your bedroom" désigne celle du personnage quand le chat n'en compte qu'un.
- Les majuscules, les accents et les apostrophes ne comptent pas. Les noms correspondent à des mots entiers : `John` ne correspond jamais à "Johnson".
- Avec **World Maps**, choisis plutôt le lieu dans la liste **Lieu de World Maps**. Un bâtiment épinglé couvre aussi ses pièces qui n'ont pas leur propre image épinglée.

Ce qui se passe :

- L'image s'affiche une fois, à l'arrivée. Si tu choisis un autre arrière-plan à la main pendant que tu es sur place, ton choix reste jusqu'à ce que l'histoire passe à un autre lieu.
- Dans un lieu épinglé, l'agent Background ne peut pas changer l'image, et Illustrator ne peint pas de nouvel arrière-plan pour ce lieu.
- Il faut le lieu de l'agent **World State** (ou World Maps). Le bas de la liste indique où se déroule l'histoire, et **Ici** marque l'épingle utilisée. Les épingles fonctionnent dans les chats Roleplay.

Si cela n'a pas marché : vérifie que **L'histoire se déroule à** sous la liste indique le lieu, et que l'un des noms de l'épingle y figure.

<a id="backgrounds-that-follow-a-character"></a>

### Des arrière-plans qui suivent un personnage

Une image de la **Galerie** d'un personnage (ou d'un persona), marquée comme arrière-plan, apparaît dans chaque chat où ce personnage est présent, sans avoir à créer d'épingles dans chaque chat.

1. Ouvre la **Galerie** du personnage, clique sur le bouton de tag d'une image et choisis **Utiliser comme arrière-plan**.
2. Saisis les lieux qu'elle représente, séparés par des virgules, par exemple `{{char}}'s bedroom, {{char}}'s room`. Dans la galerie d'un personnage, `{{char}}` désigne ce personnage ; dans celle d'un persona, `{{user}}` désigne ce persona. Laisse le champ vide si l'image ne représente pas un lieu précis.

Les images qui nomment des lieux fonctionnent comme des lieux épinglés dans chaque chat avec ce personnage, et figurent sous **Lieux épinglés** dans **Réglages du chat → Arrière-plan**. Une épingle définie dans le chat lui-même l'emporte sur une image de galerie portant le même nom.

## Ta bibliothèque et le flou

Les images parmi lesquelles tu choisis se trouvent dans la même section **Backgrounds**. L'import, les tags, le renommage, la suppression, le curseur **Background Blur** (flou d'arrière-plan) et l'arrière-plan par défaut des nouveaux chats Roleplay sont décrits dans [Arrière-plans de chat](../appearance/chat-backgrounds.md).

## Guides associés

- [Arrière-plans de chat](../appearance/chat-backgrounds.md) : la bibliothèque d'images téléversées et les réglages d'apparence.
- [Arrière-plans de scène](../media/scene-backgrounds.md) : des illustrations de scène créées par l'IA à partir de ta galerie.
- [Mode Roleplay : premiers pas](getting-started.md) : le plateau Roleplay, les sprites et le HUD.
