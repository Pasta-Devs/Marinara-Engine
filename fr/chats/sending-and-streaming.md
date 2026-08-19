# Envoyer des messages et le streaming

Ce guide explique les bases communes à tous les chats de Marinara Engine. Au programme : comment envoyer un message, comment la réponse de l'IA s'affiche à l'écran au fil de l'écriture, et comment l'arrêter ou la relancer. Il traite aussi des pièces jointes, des indicateurs de "réflexion" et de la marche à suivre quand une erreur de génération apparaît.

## Envoyer un message

La barre de saisie se trouve en bas de chaque chat. Saisis le texte dans le champ, puis lance la réponse de l'IA de deux façons possibles :

1. Clique sur le bouton **Send** (envoyer) à droite de la barre de saisie.
2. Ou appuie sur Enter, si le réglage **Send on Enter** (envoyer avec Enter) est activé pour ce mode de chat.

Le message apparaît alors dans la liste, suivi de la réponse de l'IA au fur et à mesure de la génération.

Un seul chat ne peut générer qu'une réponse à la fois. Pendant le streaming (l'affichage au fil de l'écriture), le bouton **Send** se change en bouton d'arrêt : impossible de lancer une deuxième réponse par mégarde.

L'envoi exige une connexion qui fonctionne. Une connexion, c'est le lien vers un fournisseur d'IA (voir le guide associé plus bas). Sans elle, la réponse échoue immédiatement et un message signale qu'aucune connexion n'est configurée pour ce chat.

### Send on Enter

Le réglage **Send on Enter** se trouve dans **Settings** (Paramètres), sous l'onglet **General**, dans la section **Input & Editing**. Il propose un interrupteur par mode de chat :

| Mode de chat | Par défaut | Rôle de Enter quand c'est activé |
|---|---|---|
| Roleplay | Off | Enter envoie le message |
| Conversations | On | Enter envoie le message |
| Game | On | Enter envoie le message |

Quand l'interrupteur d'un mode est désactivé, Enter insère un saut de ligne. Il faut alors cliquer sur **Send** pour publier le message. Roleplay est désactivé par défaut, car les messages de roleplay sont souvent longs et ont besoin de sauts de ligne.

## Joindre des images et des fichiers

Joins des images ou des fichiers pour que l'IA puisse les voir ou les lire. Clique sur le trombone dans la barre de saisie et choisis un fichier. Les fichiers joints s'affichent sous forme de petites pastilles au-dessus de la saisie, avant l'envoi.

Marinara accepte ces types de fichiers :

- Les images.
- Les fichiers PDF.
- Les fichiers texte brut : `.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml` et `.yml`.

Chaque fichier doit peser 20 Mo au maximum. Un fichier plus lourd est refusé, avec un message indiquant qu'il est trop volumineux. Un type de fichier non pris en charge est refusé lui aussi, avec la liste des types autorisés.

L'IA ne "voit" une image que si le modèle connecté gère la vision. Si le modèle ne traite que du texte, active le réglage **Image Captioning** (description automatique des images). Ce réglage se trouve dans les **Chat Settings** (réglages du chat) propres à chaque chat, dans la section **Advanced Parameters** ; il est désactivé par défaut. Une fois activé, Marinara décrit chaque image jointe sous forme de texte à l'aide d'une connexion de ton choix, puis envoie cette description à la place de l'image.

## Insérer une image de galerie dans un message

Les pièces jointes servent à être *vues par l'IA*. Les références de galerie servent à être *vues par le lecteur* : elles affichent une image de galerie dans le texte du message.

Les messages acceptent les images Markdown, et Marinara résout les liens `card://` spéciaux vers les fichiers de galerie :

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

En Roleplay Mode, le navigateur de ressources du chat peut insérer ce lien. Vous pouvez aussi le coller partout où du texte est écrit : messages, salutations et dialogues d'exemple.

Pour une image de la **propre galerie du personnage**, préférez la forme portable `card://self/gallery/<filename>`, qui reste valable après export et import du personnage. Le bouton **Copy image reference** de la galerie la produit. Consultez [Galeries des personnages → Réutiliser une image de galerie dans les messages et les salutations](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings) pour les détails.

## Le streaming de la réponse

Le streaming affiche la réponse mot après mot pendant la génération, au lieu d'attendre qu'elle soit complète. Les réglages du streaming se trouvent dans **Settings**, sous l'onglet **General**, dans la section **Responses** :

| Réglage | Par défaut | Rôle |
|---|---|---|
| **Enable streaming** | On | Affiche la réponse mot après mot pendant la génération |
| **Streaming speed** | 50 | Règle la vitesse d'affichage du texte à l'écran |
| **Trim incomplete model endings** | Off | Coupe une phrase inachevée en fin de réponse avant l'enregistrement |

**Streaming speed** est un curseur de 1 à 100. Une valeur basse donne un effet machine à écrire plus lent, pratique pour lire en même temps. Une valeur haute affiche le texte presque instantanément. Marinara lisse l'arrivée irrégulière des tokens – ces petits morceaux de texte – pendant que le modèle écrit, puis termine la réponse à la vitesse choisie. Ce réglage ne change rien à la vitesse d'écriture du modèle lui-même.

Quand **Enable streaming** est désactivé, la réponse complète apparaît d'un seul coup, une fois le modèle arrivé au bout.

**Trim incomplete model endings** n'agit que sur le message enregistré. Une fois activé, Marinara supprime une phrase inachevée en fin de réponse. Les réponses complètes et les fins en style commande restent intactes.

## Indicateurs de saisie et de progression

Avant l'arrivée du premier mot d'une réponse, Marinara montre que le personnage travaille. Son nom s'affiche avec trois points animés. Dans un chat de groupe, les noms de tous les personnages qui répondent apparaissent ensemble.

Pendant que le serveur prépare le prompt (le texte que Marinara envoie à l'IA), une courte ligne de progression fait défiler ces libellés :

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

Chaque libellé correspond à une étape que Marinara exécute avant ou pendant la réponse. La ligne disparaît dès que le premier mot de la réponse arrive. Certaines étapes ne s'exécutent que si le chat utilise la fonctionnalité concernée : tu ne verras donc pas forcément tous les libellés.

Si le statut de présence d'un personnage indique qu'il est occupé ou absent, un indicateur d'attente remplace les points de saisie. La réponse démarre dès que le personnage redevient disponible.

## Voir la réflexion du modèle

Certains modèles exposent une trace de raisonnement cachée, souvent appelée "thinking". Marinara la garde à part de la réponse visible.

Quand une réponse comporte une trace de réflexion, une action **View thoughts** (voir les pensées), symbolisée par un cerveau, apparaît sur ce message. Clique dessus pour ouvrir un panneau qui affiche le texte du raisonnement capturé.

Encore faut-il que le modèle renvoie effectivement ce raisonnement. Certains modèles l'encadrent avec des balises en texte brut. Dans ce cas, définis des **Thinking Tags** (balises de réflexion) personnalisées sur la connexion : Marinara pourra ainsi séparer le raisonnement caché de la réponse visible. Plusieurs paires de balises courantes sont déjà reconnues. Le guide des paramètres de génération, plus bas, explique comment renseigner les **Thinking Tags**.

## Arrêter une réponse

Pour arrêter une réponse en cours de génération, clique sur le bouton d'arrêt. Il s'agit du bouton **Send** : pendant le streaming, son icône se change en symbole d'arrêt.

Le texte déjà arrivé avant l'arrêt reste en général affiché à l'écran. Un arrêt volontaire n'est jamais présenté comme une erreur.

## Relancer sans tout retaper

Si le dernier message du chat est le tien et que l'IA n'a jamais répondu, inutile de le retaper. Laisse le champ de saisie vide. Clique ensuite sur le bouton **Send** (ou appuie sur Enter) pour lancer une nouvelle réponse sans ajouter de message en double. En mode Conversation, le bouton affiche une flèche circulaire tant que cet état est actif.

La relance ne fonctionne que si le champ est vide. Dès qu'un brouillon y est saisi, le bouton envoie ce brouillon.

Le mode Roleplay propose un raccourci voisin. Appuie sur **Send** avec un champ vide pour inciter l'IA à répondre de nouveau, même si elle a déjà répondu. Cela lance toujours une réponse entièrement neuve, sans rallonger la précédente. Pour prolonger la réponse précédente, utilise plutôt la commande `/continue`, décrite dans le guide des actions sur les messages, plus bas.

## Quand une erreur de génération apparaît

Si une réponse échoue, Marinara affiche une notification en bas de l'écran. Elle reste visible une quinzaine de secondes et son texte se copie. Une réponse arrêtée n'est pas traitée comme une erreur.

Pour certains problèmes courants, Marinara reformule l'erreur brute en une consigne claire :

- Si le modèle refuse un paramètre qu'il ne prend pas en charge, la notification explique comment corriger le tir. Va dans les **Chat Settings**, ouvre **Advanced Parameters** et désactive **Send** pour ce paramètre.
- Si le modèle exige un paramètre désactivé, la notification t'invite à le réactiver. Va au même endroit et active **Send** pour ce paramètre.
- Si la réponse revient complètement vide, la notification te propose de renvoyer le message.

Voici d'autres messages explicites que tu peux rencontrer :

- Une réponse est déjà en cours de génération pour ce chat. Attends la fin, ou arrête-la avec le bouton d'arrêt.
- Aucune connexion n'est configurée pour ce chat. Commence par en créer une (voir le guide associé plus bas).

Si une erreur revient sans cesse, le guide de dépannage, plus bas, propose d'autres solutions aux problèmes de connexion et d'erreurs de génération.

## Connexions lentes et onglets sur mobile

Une réponse longue peut prendre du temps, et c'est normal. Arrête-la quand tu veux avec le bouton d'arrêt.

Sur mobile, le navigateur peut mettre en pause l'onglet d'un chat quand tu passes à autre chose. Si la réponse était encore en streaming, Marinara affiche l'état **Finishing in background...**. Il vérifie ensuite si la réponse s'est terminée sur le serveur. Si cela traîne, un message indique que la réponse se termine toujours en arrière-plan. Recharge alors le chat un instant plus tard si elle n'est pas apparue.

## Guides associés

- [Actions sur les messages : modifier, supprimer, swipe, régénérer](messages.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Paramètres de génération](../prompts/generation-parameters.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
