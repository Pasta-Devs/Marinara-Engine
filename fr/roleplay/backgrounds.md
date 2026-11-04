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

## Générer un arrière-plan à la main

Marinara construit un prompt d'image – le texte que Marinara envoie à l'IA – à partir de la scène (genre, cadre, lieu, météo et moment de la journée), puis crée un nouvel arrière-plan.

Avant de commencer : installe l'agent **Illustrator** et attribue-lui un compte de génération d'images, ou marque un compte de génération d'images comme compte par défaut. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md). Tu n'as pas besoin d'ajouter Illustrator au chat.

1. Ouvre **Chat Settings** avec le bouton de curseurs dans le chat, et déplie **Gallery** (galerie).
2. Clique sur **Background**. Le bouton affiche **Generating...** pendant le traitement, et la galerie indique "Illustrator is generating a background image for this scene."
3. Attends la fin. La nouvelle image rejoint ta bibliothèque d'arrière-plans et s'applique à la scène.

La génération manuelle utilise le compte d'images de l'agent Illustrator, puis ton compte de génération d'images par défaut. Elle fonctionne en Roleplay et en Game Mode, pas en mode Conversation.

Si ça n'a pas marché : le message "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." signifie que Marinara n'a trouvé aucun compte d'images. Définis-en un, puis réessaie. Si le bouton **Background** est absent, Illustrator n'est pas installé.

## Ta bibliothèque et le flou

Les images parmi lesquelles tu choisis se trouvent dans la même section **Backgrounds**. L'import, les tags, le renommage, la suppression, le curseur **Background Blur** (flou d'arrière-plan) et l'arrière-plan par défaut des nouveaux chats Roleplay sont décrits dans [Arrière-plans de chat](../appearance/chat-backgrounds.md).

## Guides associés

- [Arrière-plans de chat](../appearance/chat-backgrounds.md) : la bibliothèque d'images téléversées et les réglages d'apparence.
- [Arrière-plans de scène](../media/scene-backgrounds.md) : des illustrations de scène créées par l'IA à partir de ta galerie.
- [Mode Roleplay : premiers pas](getting-started.md) : le plateau Roleplay, les sprites et le HUD.
