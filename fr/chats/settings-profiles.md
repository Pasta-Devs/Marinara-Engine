# Profils de réglages

Un profil de réglages est un ensemble nommé de réglages de chat réutilisables. Il retient la connexion du chat, le preset de prompt (modèle de prompt enregistré), les agents, les outils, la traduction, la mémoire, les paramètres avancés et d'autres options propres au chat. Applique ce profil à un autre chat au lieu de tout reconfigurer.

Les profils se gèrent en haut de la section **Chat Settings** (réglages du chat). Ils fonctionnent dans les modes Conversation et Roleplay. Game Mode n'affiche pas ces contrôles.

## Profils de réglages et presets de prompt

Dans Marinara, le mot **preset** désigne uniquement les modèles de prompt :

- Un **prompt preset** règle la structure du prompt système (le texte que Marinara envoie à l'IA) et les paramètres de génération. Il s'édite dans le panneau **Presets**. Voir [Éditeur de presets et gestionnaire de prompts](../prompts/presets.md).
- Un **settings profile** est une configuration réutilisable plus large. Il peut inclure le preset de prompt sélectionné, mais aussi la connexion, les agents et les autres réglages du chat.

Un preset de prompt peut donc être un élément parmi d'autres à l'intérieur d'un profil de réglages.

## Ce que contient un profil

Un profil enregistre la façon dont le chat dialogue avec l'IA :

- La connexion
- Le preset de prompt (appelé source du prompt en mode Conversation)
- Les agents et les outils
- La traduction
- La section **Memory Recall**
- La section **Advanced Parameters**
- Disposition des fenêtres et boutons : positions et tailles, épinglages et verrouillages, outils rangés dans Chat Settings ou détachés, fenêtres de contrôles ouvertes et positions des boutons sur ordinateur et téléphone. Les profils sans disposition enregistrée, comme **Default**, conservent celle du chat.
- Masquage des conseils de disposition de Chat Settings. Appliquer **Default** ou un ancien profil sans ce choix affiche à nouveau les conseils.
- Les autres options de chat réutilisables

Un profil ne remplace pas le contenu qui appartient au chat : personnages, persona (le personnage que tu incarnes), lorebooks (recueils de faits sur ton univers), sprites, résumé, tags ou prompt de scène. Il ne contient pas non plus l'historique du chat.

## Appliquer un profil

Le menu déroulant des profils se trouve en haut de la section **Chat Settings**. Son infobulle indique **Apply a settings profile to this chat**.

1. Ouvre le chat que tu veux modifier.
2. Ouvre la section **Chat Settings**.
3. Ouvre le menu déroulant **Profile**.
4. Choisis un profil par son nom.

Le chat se met à jour aussitôt. Quand ses valeurs actuelles ne correspondent à aucun profil enregistré, le menu déroulant affiche **Custom settings profile**. Si un profil appliqué auparavant n'existe plus, il affiche **Missing profile - choose a profile**.

## Enregistrer un profil

La rangée d'icônes sous le menu déroulant propose ces actions :

| Bouton | Infobulle | Résultat |
|---|---|---|
| Save | **Save current chat settings into this profile** | Remplace les valeurs enregistrées du profil sélectionné |
| Rename | **Rename profile** | Change le nom du profil sélectionné |
| Save As | **Save current chat settings as a new profile** | Crée un autre profil à partir du chat en cours |
| Import | **Import settings profile (.json)** | Charge un fichier de profil |
| Export | **Export settings profile (.json)** | Télécharge le profil sélectionné |
| Delete | **Delete profile** | Supprime définitivement le profil sélectionné |

Pour créer un premier profil, règle un chat comme tu le souhaites, puis choisis **Save current chat settings as a new profile**. Pour le mettre à jour plus tard, applique le profil, modifie le chat, puis choisis **Save current chat settings into this profile**.

## Choisir le profil par défaut

L'étoile à côté du menu déroulant marque le profil utilisé automatiquement pour les nouveaux chats de ce mode. Un seul profil par mode peut être le profil par défaut.

Ses infobulles décrivent l'état en cours :

- **Mark this profile as default for new chats in this mode**
- **This profile is the default for new chats in this mode**
- **Select a profile to mark it as default**

## Dispositions de fenêtres favorites

L'étoile près de **Reset View** dans la barre de titre de Chat Settings enregistre une disposition favorite pour les nouveaux chats du mode actuel. Elle mémorise aussi si tu as masqué les conseils de disposition. Tu peux l'utiliser en Conversation, Roleplay et Game. L'étoile à côté du menu **Profile** choisit toujours le profil de réglages par défaut.

Lors de la mise à jour d'une installation existante, la disposition familière des boutons d'outils devient la favorite des nouveaux chats dans les trois modes. Cela ne se produit qu'une fois et respecte toute favorite déjà enregistrée ou effacée. Cette disposition reste le choix par défaut jusqu'à ce que tu la changes. Une installation neuve commence avec les outils dans Chat Settings et aucune favorite.

Dispose les fenêtres et les boutons, puis clique sur l'étoile de la barre de titre pour les enregistrer. Elle se remplit quand la disposition et les conseils actuels correspondent à la favorite. Si tu déplaces une fenêtre ou changes la disposition, clique à nouveau sur l'étoile pour remplacer la favorite. Clique sur l'étoile remplie pour l'effacer et utiliser la disposition standard dans les futurs chats. Ces changements ne touchent pas les chats existants.

Quand un nouveau chat utilise un profil de réglages par défaut, la disposition enregistrée dans ce profil prend le pas sur la favorite. Les profils sans disposition enregistrée conservent celle du chat, y compris celle d'une favorite. Un profil applique toujours son propre réglage de conseils ; les anciens profils sans ce réglage affichent les conseils.

Consulte les étapes dans [Choisir une disposition pour les nouveaux chats](chat-settings.md#choosing-a-layout-for-new-chats).

## Importer et exporter des profils

Le bouton **Export settings profile (.json)** télécharge un fichier `.marinara-settings-profile.json` que tu peux garder en sauvegarde ou partager. Le bouton **Import settings profile (.json)** crée un profil à partir d'un fichier compatible, sans écraser un profil existant. Les exports de profils plus anciens restent importables.

Les profils enregistrent des réglages, pas les secrets des fournisseurs.

## Le profil Default

Les modes Conversation et Roleplay disposent chacun d'un profil **Default** intégré. L'appliquer remet les réglages pilotés par le profil aux valeurs par défaut de Marinara pour ce mode.

Le profil **Default** ne peut être ni renommé, ni écrasé, ni supprimé. Les contrôles désactivés l'expliquent avec **Cannot save into the Default profile**, **Cannot rename the Default profile** et **Cannot delete the Default profile**.

## Guides associés

- [Vue d'ensemble des Chat Settings](chat-settings.md)
- [Éditeur de presets et gestionnaire de prompts](../prompts/presets.md)
- [Paramètres de génération](../prompts/generation-parameters.md)
