# Vue d'ensemble des paramètres

Trouve quelle partie de **Settings** (Paramètres) contient un contrôle, configure l'onglet **General** (Général) et apprends comment tes réglages se synchronisent entre tes appareils.

## Le panneau Settings et ses six onglets

Ouvre **Settings** avec l'icône d'engrenage de la barre du haut. Le champ **Search settings** (rechercher dans les paramètres) en haut trouve un réglage par son nom. Saisis un mot comme `delete`, `streaming` ou `quotes`, et Marinara saute à la section correspondante. La recherche trouve les noms dans la langue de ton interface et en anglais.

Le panneau a six onglets. Chaque onglet a ses propres sections.

### Je veux…

| Je veux… | Où aller |
| --- | --- |
| Changer la langue | **Settings → General → App Behavior → Language** |
| Agrandir le texte | **Settings → Appearance → App → Text & Scale** |
| Changer le thème ou les couleurs | **Settings → Appearance → App → App Style** |
| Définir un son de notification | **Settings → General → Notifications** |
| Arrêter la confirmation de suppression | **Settings → General → App Behavior** |
| Ajouter des réponses rapides | **Settings → General → Input & Editing** |
| Faire une sauvegarde | **Settings → Advanced → Backup & Export** |
| Supprimer mes données | **Settings → Advanced → Danger Zone** |
| Mettre Marinara à jour | **Settings → Advanced → Updates** |

### Ce que contient chaque onglet

**General** (Général, ce guide)

- **App Behavior** (comportement de l'application), avec une ligne **Search and Professor Mari settings**
- **Notifications**
- **Responses** (réponses)
- **Input & Editing** (saisie et édition)
- **Text Rules** (règles de texte)
- **Game Playback** (lecture en jeu)

**Appearance** (Apparence) a quatre boutons. Voir [Réglages d'apparence](../appearance/appearance-settings.md).

- **App** : **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds**
- **Conversation** : **Conversation Display**, **Conversation Theme**
- **Roleplay** : **Tracker Panel**, **Roleplay Presentation**
- **Game** : **Game Presentation**

**Generations** (Générations) a **Overall Generations**, **Image Generation**, **Video Generation** et **Prompt Overrides**. Tant que tu n'as pas installé l'agent Illustrator, cet onglet affiche seulement une invite à le télécharger. Voir [Profils de style](../media/style-profiles.md) et [Vidéo de scène](../media/scene-video.md).

**Addons** (Modules complémentaires) a l'historique des révisions des extensions, **Personal Extensions**, **External Extensions** (seulement quand tu les as déverrouillées) et **Theme Library**. Voir [Extensions personnelles](../extending/personal-extensions.md) et [Thèmes CSS personnalisés](../appearance/custom-css-themes.md).

**Imports** a **Profile & Marinara**, **SillyTavern Import** et **Game Assets**. Voir [Sauvegarder et restaurer Marinara](../data/backup-and-restore.md) et [Importer depuis SillyTavern](../data/importing-from-sillytavern.md).

**Advanced** (Avancé) a ces sections, dans cet ordre. Voir [L'onglet Advanced](#the-advanced-tab).

- **Multiplayer WIP**
- **Access**
- **Admin Access**
- **Features**
- **Updates**
- **Support Diagnostics**
- **Request timeouts**
- **Parameters**
- **Message Tools**
- **Backup & Export**
- **Storage Optimization**
- **Danger Zone**

## L'onglet General

Chaque section de l'onglet **General** est dans **Settings → General**.

| Section | Ce qu'elle contrôle |
| --- | --- |
| **App Behavior** | La langue, la sécurité de suppression, les interrupteurs d'affichage et la ligne **Search and Professor Mari settings**. Voir [App Behavior](#app-behavior). |
| **Notifications** | Les sons de notification, et les notifications du navigateur et d'Android. Voir [Notifications](#notifications). |
| **Responses** | Le streaming, la coupe des phrases et **Messages per page**. Voir [Envoyer des messages et le streaming](../chats/sending-and-streaming.md). |
| **Input & Editing** | **Send on Enter**, **Quick replies**, les raccourcis de swipe et d'édition. Voir [Saisie et édition](#input-and-editing). |
| **Text Rules** | La mise en forme du texte du chat. Voir [Text Rules](#text-rules). |
| **Game Playback** | La lecture et la navigation en Game Mode. Voir [Game Mode : premiers pas](../game/getting-started.md). |

### App Behavior

| Réglage | Ce qu'il fait |
| --- | --- |
| **Language** | Définit la langue de l'interface. Il ne change ni les prompts du modèle ni le contenu des chats. Le texte pas encore traduit s'affiche en anglais. L'arabe s'affiche de droite à gauche. Par défaut : anglais. |
| **Documentation Language** | Définit la langue des guides intégrés. Voir plus bas. Par défaut : anglais. |
| **Confirm before deleting** | Demande confirmation avant que Marinara supprime définitivement un chat, un personnage ou un autre élément. Par défaut : activé. |
| **Hide chat Help button** | Masque le bouton **Help** dans les chats Conversation, Roleplay et Game. Par défaut : désactivé. |
| **Show Android status bar** | Garde l'heure, la batterie et les icônes de notification visibles au-dessus de Marinara. Fonctionne seulement dans l'application Android. Par défaut : désactivé. |
| **Achievements** | Suit les succès, affiche les avis de déblocage, le marque-page Home et le widget. Voir [Succès](../home/achievements.md). Par défaut : activé. |
| **Disable seasonal ME themes** | Désactive les thèmes saisonniers de Marinara. Par défaut : désactivé. |
| **Music Player** | Affiche le lecteur de musique compact. Il a besoin de l'agent **Music DJ** de **Agents → Agent Organizer**, et reste grisé tant que tu ne l'as pas installé. Voir [Musique](../media/music.md). Par défaut : activé. |

**Search and Professor Mari settings** est une ligne au bas de **App Behavior**. Sélectionne **Open** pour aller à la page de réglages de Search, des réponses rapides et de Professor Mari. Voir [Professor Mari](../home/professor-mari.md).

Les langues de l'interface sont l'arabe, le chinois simplifié, l'anglais, le français, l'allemand, l'hindi, le japonais, le coréen, le polonais, le portugais brésilien, le russe et l'espagnol. Pour améliorer une traduction ou ajouter une langue, voir [Localisation de l'interface](../development/localization.md).

Pour **Documentation Language**, l'anglais est intégré. Choisis une autre langue et clique sur **Download & Replace** (télécharger et remplacer). Marinara télécharge ce pack de langue une fois et supprime le précédent, donc il garde une seule langue téléchargée. Les guides pas encore traduits s'ouvrent en anglais avec un petit badge `EN`. La recherche dans la documentation fonctionne dans la langue active. Ton choix survit aux mises à jour, et le pack se rafraîchit après une mise à jour quand ses traductions ont changé. Si les guides téléchargés disparaissent ou sont endommagés, un bouton **Fix documentation** apparaît. Il retélécharge le pack, ou remet les guides en anglais quand la source de téléchargement est injoignable.

### Notifications

Marinara joue une tonalité intégrée pour les notifications. Pour utiliser ton propre son :

1. Ouvre **Settings → General → Notifications**.
2. Téléverse un **Custom sound** (son personnalisé) : MP3, WAV, OGG, M4A, MP4 ou WebM, jusqu'à 10 Mo.

Le son se joue sur chaque appareil connecté à ce serveur. Tu peux l'écouter, le remplacer ou le supprimer. Si Marinara ne peut pas lire le fichier, il joue la tonalité intégrée. Le fichier fait partie des sauvegardes et des exports de profil.

**Background Notifications** couvre les messages de Conversation que les personnages envoient d'eux-mêmes. **Generation Completion Notifications** couvre les réponses que tu lances toi-même en Conversation, en Roleplay et en Game Mode. Les deux fonctionnent quand Marinara est ouvert mais pas au premier plan. Elles n'affichent jamais le contenu des messages.

<a id="input-and-editing"></a>

### Saisie et édition

Réglages de **Settings → General → Input & Editing** :

| Réglage | Ce qu'il fait |
| --- | --- |
| **Send on Enter** | Choisit quels modes envoient quand tu appuies sur Enter. |
| **Keep guidance after regenerating** | Laisse ta consigne dans le champ de message après une régénération guidée. Activé par défaut. |
| **Add CYOA choices to the message box instead of sending them** | Met un choix cliqué dans ton champ de message pour que tu puisses le modifier d'abord. |
| **Quick replies** | Ajoute des actions de brouillon à côté du bouton d'envoi. Voir [Génération guidée et Impersonate](../chats/guided-and-impersonate.md). |
| **Speech-to-text microphone** | Affiche un bouton de microphone dans les champs de saisie du chat. |
| **Intuitive swipe navigation** | Passe d'un swipe à l'autre (plusieurs réponses gardées sur un message) avec les touches fléchées ou un balayage tactile. |
| **Reroll past the newest swipe** | Génère une nouvelle réponse quand tu dépasses le swipe le plus récent. |
| **Up Arrow edits last message** | Appuie sur Up Arrow dans un champ vide pour modifier ton dernier message. |
| **Double-click edits messages** | Double-clique sur un message Roleplay pour le modifier. |

La section **Responses** a **Enable streaming**, **Streaming speed**, **Trim incomplete sentences from the response**, **Add a new line before /continue text** (activé par défaut) et **Messages per page**. Voir [Envoyer des messages et le streaming](../chats/sending-and-streaming.md). Pour les actions sur les messages, voir [Actions sur les messages](../chats/messages.md).

### Text Rules

Ces règles changent le traitement du texte du chat dans **Settings → General → Text Rules**. **Bold dialogue in quotes** et **Convert LaTeX symbols** changent seulement l'apparence du texte, donc tes messages enregistrés restent identiques. **Quote style** réécrit les guillemets du texte que tu saisis et enregistres.

| Réglage | Ce qu'il fait |
| --- | --- |
| **Bold dialogue in quotes** | Affiche en gras le texte entre guillemets. Activé par défaut. |
| **Convert LaTeX symbols** | Affiche les commandes mathématiques LaTeX sous forme de symboles. Le code n'est pas touché. Activé par défaut. |
| **Quote style** | **Straight** garde les guillemets simples (par défaut). **Typographic** les réécrit en guillemets et apostrophes courbes. |
| **Load images from other websites in messages** | Contrôle les images hébergées sur d'autres sites. Désactivé par défaut. |

#### Dialogues entre guillemets en gras

Quand ce réglage est activé, les mots entre guillemets dans `"I missed you," she said.` apparaissent en gras. Désactive-le pour garder la couleur du dialogue sans le gras.

#### Convertir les symboles LaTeX

Certains modèles écrivent les maths en commandes LaTeX. Quand ce réglage est activé, `\rightarrow`, `\neq`, `\times` et `\alpha` s'affichent comme `→`, `≠`, `×` et `α`.

#### Charger les images d'autres sites dans les messages

Quand ce réglage est désactivé, une image d'un autre site dans un message, une salutation ou l'aperçu d'une fiche affiche le nom du site et un bouton **Load image**. Cela empêche un message de contacter d'autres sites de lui-même. Sélectionne **Load image** pour afficher cette image. Marinara garde ton choix sur tous tes appareils. Active le réglage pour afficher toutes les images tout de suite. Les images stockées dans Marinara, comme les images de galerie, les avatars et les sprites, s'affichent toujours.

<a id="the-advanced-tab"></a>

## L'onglet Advanced

| Section | Pour en savoir plus |
| --- | --- |
| **Admin Access** | [Accès à distance](../REMOTE_ACCESS.md) |
| **Features** | [Interrupteurs de fonctions](../configuration/features.md) |
| **Updates** | [Mettre à jour Marinara Engine](../UPGRADING.md) |
| **Message Tools** | [Message Tools](#message-tools) |
| **Backup & Export** | [Sauvegarder et restaurer Marinara](../data/backup-and-restore.md) |
| **Danger Zone** | [Effacer ou réinitialiser tes données](../data/clearing-data.md) |

### Message Tools

Ces interrupteurs sont dans **Settings → Advanced → Message Tools**. Tous sont désactivés par défaut, sauf **Show context usage** et **Show "older messages not sent" note**.

| Interrupteur | Ce qu'il fait |
| --- | --- |
| **Show message timestamps** | Affiche la date et l'heure sur chaque message. |
| **Show characters in Persona pickers** | Liste tes personnages dans les sélecteurs de persona pour que tu puisses en incarner un. |
| **Show model name on messages** | Indique quel modèle a écrit chaque réponse. |
| **Show token usage on messages** | Affiche le nombre de tokens du prompt et de la réponse pour chaque message. |
| **Show context usage** | Indique à quel point la fenêtre de contexte était pleine lors de la dernière requête mesurée, dans les sélecteurs de connexion et les réglages des chats Game. |
| **Show message numbers** | Affiche un numéro sur chaque message. |
| **Show "older messages not sent" note** | Affiche une note sous la réponse la plus récente quand des messages plus anciens n'ont pas tenu dans le prompt. Une réponse coupée ou vide affiche toujours sa propre note. |
| **Guide swipes/regens with chat input** | Utilise ton brouillon comme consigne quand tu régénères. |
| **Include reasoning in exports** | Ajoute le raisonnement masqué du modèle aux exports de chat. |
| **Include private notes in exports** | Ajoute tes notes privées de message aux exports JSONL et texte. Laisse-le désactivé quand tu partages une transcription. |
| **Debug mode** | Enregistre les données envoyées au modèle dans la console du serveur, pour le support. |

Pour en savoir plus, voir [Actions sur les messages](../chats/messages.md), [Personas](../characters/personas.md), [Choisir un modèle pour un seul chat](../connections/connecting-to-a-provider.md#choosing-a-model-for-one-chat), [Peek Prompt](../chats/peek-prompt.md), [Génération guidée et Impersonate](../chats/guided-and-impersonate.md), [Exporter et importer des chats](../chats/export-import.md) et [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Synchronisation des réglages entre appareils

Marinara enregistre la plupart des réglages sur le serveur, donc ils te suivent d'un navigateur et d'un appareil à l'autre.

1. Tu changes un réglage dans **Settings**.
2. Environ une seconde plus tard, Marinara l'enregistre sur le serveur.
3. Un autre navigateur qui ouvre le même serveur charge ces réglages.

La modification la plus récente gagne. Si tu ouvres Marinara sur un deuxième appareil peu après un changement, sa copie plus ancienne peut remplacer ta modification. Attends un moment avant de changer d'appareil.

Deux réglages ne se synchronisent jamais. Définis-les à nouveau sur chaque appareil, dans **Settings → Appearance → Text & Scale** :

- **Display Size**, la taille du texte de l'interface
- **Chat Font Size**, la taille du texte du chat

Voir [Réglages d'apparence](../appearance/appearance-settings.md). Si le serveur est injoignable, l'application continue de fonctionner avec tes réglages locaux et réessaie à ta prochaine modification.

## Guides associés

- [Réglages d'apparence](../appearance/appearance-settings.md)
- [Actions sur les messages](../chats/messages.md)
- [Où Marinara enregistre tes données](../data/where-data-is-stored.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
