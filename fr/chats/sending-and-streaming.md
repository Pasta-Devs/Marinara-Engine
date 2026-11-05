# Envoyer des messages et le streaming

Saisis un message, envoie-le et regarde la réponse apparaître. Ce guide couvre l'envoi, les pièces jointes, le streaming, l'arrêt d'une réponse, la relance et la lecture d'une erreur.

## Envoyer un message

Avant de commencer : ton chat a besoin d'un modèle. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

1. Saisis ton texte dans la barre de saisie, en bas du chat.
2. Clique sur **Send** (envoyer), ou appuie sur <kbd>Enter</kbd> si **Send on Enter** (envoyer avec Enter) est activé pour ce mode de chat.

Ton message apparaît, puis la réponse arrive en streaming. Un chat ne peut générer qu'une réponse à la fois. Pendant le streaming d'une réponse, **Send** se change en bouton d'arrêt.

Si ça n'a pas marché : si aucun modèle n'est défini pour le chat, la réponse échoue aussitôt avec un message qui indique qu'aucune connexion n'est configurée. Choisis-en un dans [Chat Settings](chat-settings.md).

### Send on Enter

Ce réglage se trouve dans **Settings → General → Input & Editing** (Paramètres → Général → Saisie et édition). Il y a un interrupteur par mode de chat.

| Mode de chat | Par défaut | Quand il est désactivé |
| --- | --- | --- |
| Roleplay | Désactivé | <kbd>Enter</kbd> ajoute une nouvelle ligne. Clique sur **Send**. |
| Conversations | Activé | <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> sur Mac) envoie le message. |
| Game | Activé | <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> sur Mac) envoie le message. |

Roleplay est désactivé par défaut, car les messages de roleplay sont souvent longs et ont besoin de sauts de ligne. Professor Mari a son propre interrupteur, **Enter sends to Professor Mari** (Enter envoie à Professor Mari), dans **Settings → General → Search and Professor Mari settings** (Paramètres → Général → réglages de Search et de Professor Mari).

## Joindre des images et des fichiers

1. Touche le trombone dans la barre de saisie.
2. Choisis un fichier. Il s'affiche sous forme de petite pastille au-dessus de la saisie.
3. Envoie comme d'habitude.

Marinara accepte les images, les fichiers PDF et les fichiers texte brut (`.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml`, `.yml`). Chaque fichier doit peser 20 Mo au maximum. Marinara refuse un fichier plus lourd ou d'un type non pris en charge, avec une note.

Un modèle ne peut voir une image que s'il prend en charge la vision. Pour un modèle qui ne traite que du texte, active **Image captioning** (description des images) dans **Chat Settings → Advanced Parameters** (réglages du chat → paramètres avancés). Ce réglage est désactivé par défaut. Marinara décrit alors chaque image en texte, avec un modèle de ton choix, et envoie cette description à la place de l'image.

## Afficher une image de galerie dans un message

Les pièces jointes sont là pour que le modèle les voie. Un lien de galerie, lui, t'affiche une image à l'intérieur du texte du message. Les messages acceptent la syntaxe d'image Markdown, et Marinara résout les liens `card://` vers les fichiers de galerie :

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

En Roleplay, le navigateur de ressources du chat peut insérer un lien pour toi. Tu peux aussi en coller un dans les messages, les salutations et les dialogues d'exemple.

Pour la galerie propre à un personnage, utilise la forme portable `card://self/gallery/<filename>`. Elle continue de fonctionner après l'export et l'import du personnage. Le bouton **Copy image reference** (copier la référence de l'image) de la galerie la produit. Voir [Galeries de personnages](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

## Le streaming de la réponse

Le streaming affiche la réponse mot après mot, au lieu de tout d'un coup. Ces réglages se trouvent dans **Settings → General → Responses** (Paramètres → Général → Réponses).

| Réglage | Par défaut | Ce qu'il fait |
| --- | --- | --- |
| **Enable streaming** (activer le streaming) | Activé | Affiche la réponse pendant son écriture. Quand il est désactivé, la réponse entière apparaît une fois que le modèle a fini. |
| **Streaming speed** (vitesse du streaming) | 50 | Curseur de 1 à 100. Plus la valeur est basse, plus l'effet machine à écrire est lent. Cela ne change pas la vitesse d'écriture du modèle. |
| **Trim incomplete sentences from the response** (retirer les phrases incomplètes de la réponse) | Désactivé | Supprime une dernière phrase inachevée avant l'enregistrement de la réponse. Les réponses complètes et les fins en style commande restent telles quelles. |

## Indicateurs de saisie et de progression

Avant l'arrivée du premier mot, tu vois le nom du personnage avec trois points animés. Dans un chat de groupe, le nom de chaque personnage qui répond s'affiche. Pendant que le serveur prépare le prompt, une ligne de progression fait défiler ces libellés. Certaines étapes ne s'exécutent que si le chat utilise la fonctionnalité concernée : tu ne les verras donc pas forcément toutes.

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

Si le statut d'un personnage indique qu'il est occupé ou absent, un indicateur d'attente remplace les points. La réponse démarre quand le personnage est disponible.

## Voir la réflexion du modèle

Certains modèles renvoient une trace de raisonnement cachée, appelée "thinking". Quand une réponse en comporte une, une icône de cerveau, **View model thoughts** (voir les pensées du modèle), apparaît sur le message. Clique dessus pour lire le raisonnement.

Pour que cela fonctionne, le modèle doit renvoyer son raisonnement. Certains modèles l'encadrent de balises en texte brut. Pour ceux-là, définis **Thinking Tags** (balises de réflexion) dans les paramètres de génération, pour que Marinara puisse séparer le raisonnement de la réponse. Voir [Paramètres de génération](../prompts/generation-parameters.md).

## Arrêter une réponse

Clique sur le bouton d'arrêt, c'est-à-dire le bouton **Send** pendant le streaming d'une réponse. Le texte déjà arrivé est en général conservé. Un arrêt volontaire n'affiche jamais d'erreur.

<a id="retry-without-retyping"></a>

## Relancer sans tout retaper

Si le dernier message est le tien et que l'IA n'a jamais répondu, laisse la zone de saisie vide et clique sur **Send** (ou appuie sur <kbd>Enter</kbd>). Marinara lance une nouvelle réponse sans ajouter de message en double. En mode Conversation, le bouton affiche une flèche circulaire dans cet état. Si la zone contient un brouillon, **Send** envoie plutôt ce brouillon.

En Roleplay, un **Send** à vide lance aussi une réponse toute neuve après que l'IA a déjà répondu. Il ne rallonge pas la réponse précédente. Pour prolonger la réponse précédente, utilise `/continue`. Voir [Actions sur un message](messages.md).

## Quand une erreur de génération apparaît

Une réponse qui échoue affiche une notification toast (un court message contextuel) en bas de l'écran pendant une quinzaine de secondes. Tu peux copier son texte. Marinara reformule certaines erreurs en prochaine étape à suivre :

| Cause | Ce que t'indique la notification |
| --- | --- |
| Le modèle refuse un paramètre qu'il ne prend pas en charge | Ouvre **Chat Settings → Advanced Parameters** et désactive **Send** pour ce paramètre. |
| Le modèle exige un paramètre qui est désactivé | Réactive **Send** au même endroit. |
| La réponse est revenue vide | Renvoie ton message. |
| Une réponse est déjà en cours de génération | Attends, ou arrête-la avec le bouton d'arrêt. |
| Aucune connexion n'est configurée | Configure une connexion pour le chat. |

Si une erreur revient sans cesse, voir [Dépannage](../TROUBLESHOOTING.md).

## Connexions lentes et onglets sur mobile

Une longue réponse peut prendre du temps. Tu peux l'arrêter à tout moment. Sur un téléphone, le navigateur peut mettre en pause l'onglet d'un chat quand tu passes à autre chose. Si une réponse était en streaming, Marinara affiche **Finishing in background...**, puis vérifie si la réponse s'est terminée sur le serveur. Si elle n'est pas apparue, actualise le chat un peu plus tard.
