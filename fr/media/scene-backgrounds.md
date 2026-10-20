# Les arrière-plans de scène et la galerie

Ce guide explique les arrière-plans de scène générés par l'IA, ces images d'arrière-plan que Marinara Engine crée pour toi depuis la **Gallery** (la galerie), ainsi que la galerie elle-même. Deux guides voisins complètent celui-ci : [Arrière-plans de chat](../appearance/chat-backgrounds.md) présente la bibliothèque d'images téléversées que tu choisis à la main, et [Arrière-plans en Roleplay](../roleplay/backgrounds.md) présente l'agent qui choisit tout seul un arrière-plan à chaque tour.

## Où fonctionnent les arrière-plans de scène

Les arrière-plans de scène fonctionnent dans les modes Roleplay et Game. Ils ne sont pas disponibles en mode Conversation. Si tu essaies d'en générer un en mode Conversation, l'application affiche ce message :

```
Scene background generation is available in Roleplay and Game modes.
```

Pour générer un arrière-plan, il te faut une connexion **Image Generation** (génération d'images). Si ce n'est pas encore fait, commence par en configurer une. Voir [Fournisseurs de génération d'images et configuration](image-providers.md).

## Générer et appliquer un arrière-plan depuis la galerie

La **Gallery** contient les images et vidéos du chat. C'est une section de **Chat Settings** : ouvre Chat Settings et déplie Gallery. Sur ordinateur, tu peux en faire une fenêtre séparée ; consulte [Présentation de Chat Settings](../chats/chat-settings.md#popping-a-section-out-into-its-own-window). Le bouton **Background** (arrière-plan) génère le décor de la scène actuelle.

En Roleplay, le bouton **Background** apparaît dès que l'agent **Illustrator** est installé. Tu n'as pas besoin de l'ajouter au chat ni d'activer les agents. Comme **Illustrate** (illustrer), il s'exécute une seule fois et ne lance pas d'exécutions automatiques.

Pour générer un arrière-plan :

1. Ouvre la section **Gallery** de **Chat Settings**.
2. Clique sur le bouton **Background**.
3. Le libellé du bouton devient **Generating...** pendant la génération de l'image.
4. Un message d'état doit apparaître : "AI background generation is running. The new background will be applied when it finishes."
5. Une fois terminé, la nouvelle image s'applique immédiatement à la scène en cours. Le message "Background generated." te le confirme.

L'arrière-plan est construit à partir de la scène en cours. Dans une partie, cela comprend le genre, le cadre, le lieu, la météo et le moment de la journée. Les arrière-plans générés utilisent la taille de canevas **Backgrounds**, soit 1280 sur 720 pixels par défaut. Tu peux changer cette taille dans **Settings** (Paramètres), puis **Generations**, puis **Image Generation**.

### Si aucune connexion d'image n'est définie

Si Marinara ne trouve aucune connexion d'image à utiliser, l'étape de génération échoue avec ce message :

```
Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.
```

Pour corriger cela, ouvre le panneau **Connections** (Connexions), déplie la section **Defaults** et choisis une connexion d'image sous **Images**. Autre option : définir une connexion d'image spécifique sur l'agent **Illustrator**.

## La section Gallery

La **Gallery** a deux onglets, **Images** et **Videos**. Chaque onglet affiche le nombre d'éléments qu'il contient. L'onglet **Videos** contient les vidéos de scène dans les chats Roleplay et Game, et les messages vidéo dans les chats Conversation.

En haut de la section, les boutons d'action ne s'affichent que si la fonctionnalité correspondante s'applique au chat :

- **Illustrate** : lance l'agent Illustrator pour une image de scène ponctuelle. Voir [Agent Illustrator](illustrator-agent.md).
- **Selfie** : génère un selfie du personnage en mode Conversation.
- **Background** : génère et applique un arrière-plan de scène, comme décrit plus haut.
- **Video** : crée une vidéo de scène à partir de la dernière illustration. En mode Conversation, il envoie plutôt un message vidéo d'un personnage ; voir [Messages vidéo](../conversation/selfies.md#video-messages).
- **Create storyboard** : génère les images-clés du dernier tour de Game Mode ou d'un épisode de Roleplay terminé, quand Storyboard est actif.
- **Browse Images** : ouvre un explorateur des images enregistrées, à insérer.
- **View storyboard** : ouvre le dernier storyboard de Game Mode.

Sous les boutons se trouve la zone de dépôt **Upload Images** (téléverser des images). Fais-y glisser des images pour ajouter tes propres illustrations à la galerie de ce chat.

### Actions image par image

Passe le pointeur sur une image de l'onglet **Images**, ou touche-la sur mobile, pour faire apparaître ses actions :

- Ouvrir l'image en taille réelle (**Open gallery image**).
- **Pin to chat** : épingle l'image au chat sous forme d'image flottante. Fais-la glisser pour la déplacer et utilise sa poignée d'angle pour la redimensionner. Elle garde sa place et sa taille quand tu recharges la page dans ce navigateur. Le bouton de verrou, à côté du bouton de fermeture, l'empêche de bouger ou d'être redimensionnée tant que tu ne la déverrouilles pas.
- **Download image** : enregistre l'image sur l'appareil.
- **Animate illustration** : transforme cette image en vidéo de scène.
- **Copy prompt** : copie le prompt enregistré de l'image, c'est-à-dire le texte que Marinara envoie à l'IA. Si aucun prompt n'est enregistré pour l'image, le bouton affiche **No prompt saved** et reste inactif.
- **Delete gallery image** : supprime l'image après confirmation.

<a id="regenerating-an-image"></a>

### Régénérer une image

Tu peux refaire une image générée sans régénérer la réponse à laquelle elle appartient. Cela fonctionne pour les images de la galerie du chat qui ont un prompt enregistré, comme les illustrations, les selfies et les images de storyboard.

1. Ouvre l'image en taille réelle, depuis la galerie ou depuis le message qui la contient.
2. Clique sur **Regenerate image** (régénérer l'image), le bouton en forme de flèche circulaire en haut à droite de l'image.
3. Modifie ce que tu veux dans les champs sous l'image : **Prompt**, **Negative prompt** (prompt négatif), un champ pour chaque personnage sous **Character prompts** (prompts de personnage) si l'image en avait, et l'**Image connection** (connexion d'image).
4. Clique sur **Generate image** (générer l'image), ou sur **Cancel** pour laisser l'image telle quelle.

La nouvelle image remplace l'ancienne dans le message. L'ancienne reste dans la galerie : tu peux donc l'épingler de nouveau. Les images de référence sont renvoyées à partir des avatars actuels des personnages. Certaines images plus anciennes n'ont pas enregistré leur prompt négatif ni leurs prompts de personnage ; l'éditeur l'indique le cas échéant.

## Relire un prompt avant l'envoi

Tu peux vérifier et modifier le prompt avant que Marinara n'envoie une demande d'arrière-plan au fournisseur d'images.

1. Ouvre **Settings**, puis **Generations**, puis **Overall Generations**.
2. Active l'option **Expose media prompts before sending**.

Avec ce réglage activé, une fenêtre **Review Image Prompt** s'ouvre avant chaque envoi. Son texte d'aide indique : "Edit the prompt below before Marinara sends the image request to your provider."

Dans cette fenêtre, tu peux :

- Modifier le texte du prompt et le prompt négatif.
- Voir le type et la taille de l'image, ainsi qu'un compteur de caractères en direct.
- Cliquer sur **Cancel** pour tout arrêter, ou sur **Generate** pour envoyer.

Si l'un des champs de prompt est vide, le bouton **Generate** est désactivé et cette note apparaît : "Every image request needs a prompt." Le texte que tu saisis part exactement tel quel.

## Gérer les arrière-plans enregistrés

Chaque arrière-plan de scène que tu génères est enregistré dans ta bibliothèque d'arrière-plans. Tu peux aussi y ajouter tes propres images. Les arrière-plans téléversés acceptent les fichiers JPG, PNG, GIF, WebP et AVIF, jusqu'à 20 Mo chacun.

Les arrière-plans que tu as ajoutés se renomment, se taguent et se suppriment à tout moment. Les tags s'écrivent en minuscules et acceptent lettres, chiffres, espaces, traits d'union et tirets bas, dans la limite de 40 caractères chacun. Les arrière-plans fournis avec les ressources de jeu apparaissent aux côtés des tiens, mais tu ne peux ni les renommer, ni les taguer, ni les supprimer.

Cette bibliothèque se gère depuis les paramètres d'apparence, où tu définis aussi un arrière-plan par chat ou par défaut. Pour la bibliothèque complète, le sélecteur et le réglage **Background Blur**, voir [Arrière-plans de chat](../appearance/chat-backgrounds.md).

## Guides associés

- [Arrière-plans de chat](../appearance/chat-backgrounds.md) : la bibliothèque d'images téléversées dans laquelle tu choisis à la main.
- [Arrière-plans en Roleplay](../roleplay/backgrounds.md) : l'agent qui choisit tout seul un arrière-plan à chaque tour.
- [Agent Illustrator](illustrator-agent.md) : les illustrations de scène pour les modes Roleplay et Game.
- [Fournisseurs de génération d'images et configuration](image-providers.md) : configurer une connexion d'image.
- [Génération de vidéos de scène](scene-video.md) : transformer une image de la galerie en vidéo.
