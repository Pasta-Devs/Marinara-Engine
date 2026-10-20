# Vue d'ensemble des paramètres

Ce guide dresse le plan du panneau **Settings** (Paramètres) de Marinara Engine : ses six onglets et ce que chacun pilote. Il détaille l'onglet **General** (Général), les **Text Rules** (règles de texte) qui mettent en forme le texte du chat, et la façon dont les réglages se synchronisent entre tes appareils.

## Le panneau Settings et ses six onglets

Ouvre le panneau **Settings** avec l'icône d'engrenage de la barre du haut. Tout en haut du panneau se trouve le champ **Search settings** (rechercher dans les paramètres). Saisis n'importe quel mot (`delete`, `streaming` ou `quotes`, par exemple) et Marinara t'amène directement à la section correspondante. La recherche trouve un réglage par son nom dans la langue de ton interface ou en anglais.

Le panneau compte six onglets. Le tableau ci-dessous indique ce que chacun pilote.

| Onglet | Ce que tu y règles |
| --- | --- |
| **General** | Comportement de l'application, notifications, réponses, saisie, règles de texte et lecture en Game Mode. |
| **Appearance** | Thème, couleurs, polices, mise en page du chat, animations et arrière-plans. |
| **Generations** | Valeurs par défaut pour les images et les vidéos, et modèles de prompt réutilisables. |
| **Addons** | Brouillons Personal Extension de Professor Mari, isolés en bac à sable, External Extensions débloquées en option, et thèmes personnalisés. |
| **Imports** | Restauration de profils complets et import depuis d'autres applications. |
| **Advanced** | Accès administrateur, interrupteurs de fonctions facultatives, mises à jour, outils de message, sauvegardes et réinitialisations destructrices. |

Voici où en lire davantage sur chaque onglet :

- **General** : traité sur cette page (voir les sections ci-dessous).
- **Appearance** : voir [Réglages d'apparence](../appearance/appearance-settings.md).
- **Generations** : voir [Profils de style](../media/style-profiles.md) et [Vidéo de scène](../media/scene-video.md).
- **Addons** : voir [Extensions personnelles](../extending/personal-extensions.md) et [Thèmes CSS personnalisés](../appearance/custom-css-themes.md).
- **Imports** : voir [Importer depuis SillyTavern](../data/importing-from-sillytavern.md) et [Sauvegarde et restauration](../data/backup-and-restore.md).
- **Advanced** : voir la section **Message Tools** ci-dessous, [Interrupteurs de fonctions](../configuration/features.md), ainsi que [Mettre à jour Marinara Engine](../UPGRADING.md), [Accès à distance](../REMOTE_ACCESS.md) et [Effacer tes données](../data/clearing-data.md).

## Paramètres, onglet General

L'onglet **General** contient six sections. Cette page en traite deux de bout en bout : **App Behavior** (comportement de l'application) et **Text Rules**. Les autres sont résumées ici et détaillées dans leur propre guide.

- **App Behavior** : langue, sécurité de suppression, et interrupteurs d'affichage. Détaillé ci-dessous.
- **Notifications** : sons de notification, plus des réglages distincts pour le navigateur et pour l'application Android. Téléverse un **Custom sound** (son personnalisé) au format MP3, WAV, OGG, M4A/MP4 ou WebM (jusqu'à 10 Mo) pour remplacer la tonalité intégrée de Marinara sur tous les appareils connectés à ce serveur. Tu peux l'écouter, le remplacer ou le supprimer à tout moment. Si le fichier personnalisé est illisible, Marinara revient à la tonalité intégrée, et le fichier est inclus dans les sauvegardes et les exports de profil. Les **Background Notifications** (notifications en arrière-plan) concernent les messages autonomes en mode Conversation, tandis que les **Generation Completion Notifications** (notifications de fin de génération) concernent les réponses que tu lances toi-même en modes Conversation, Roleplay et Game. Les deux fonctionnent tant que Marinara reste ouvert sans être au premier plan, et le contenu des messages reste masqué.
- **Responses** (réponses) : comment les réponses s'affichent en streaming, s'enregistrent et se paginent. Voir [Envoyer des messages et le streaming](../chats/sending-and-streaming.md).
- **Input & Editing** (saisie et édition) : saisie des messages et raccourcis d'édition rapide. Voir [Actions sur les messages](../chats/messages.md).
- **Text Rules** : mise en forme appliquée au texte du chat. Détaillé ci-dessous.
- **Game Playback** (lecture en jeu) : lecture et navigation en Game Mode.

## App Behavior

Cette section se trouve dans **Settings** > **General** > **App Behavior**. Elle pilote le comportement quotidien de l'application et quelques interrupteurs d'affichage.

- **Language** (langue) : choisis la langue de l'interface. Marinara propose aujourd'hui l'arabe, le chinois simplifié, l'anglais,
  le français, l'allemand, l'hindi, le japonais, le coréen, le polonais, le portugais brésilien, le russe et l'espagnol. L'arabe s'affiche
  de droite à gauche. Le texte d'interface pas encore traduit reste en anglais. Ce réglage change
  les contrôles et les explications de Marinara, pas les prompts envoyés au modèle ni le contenu des chats. Pour améliorer une traduction ou ajouter une
  langue, voir [Localisation de l'interface](../development/localization.md).
- **Documentation Language** (langue de la documentation) : choisis la langue des guides intégrés à Marinara, indépendamment de la langue d'interface ci-dessus. L'anglais est intégré et n'est jamais téléchargé. Si tu choisis une autre langue, le bouton **Download & Replace** (télécharger et remplacer) apparaît : il télécharge ce pack de langue une fois et supprime le pack précédent, si bien qu'une seule langue téléchargée est conservée. Les guides pas encore traduits s'ouvrent en anglais avec un petit badge `EN`, et la recherche dans la documentation fonctionne dans la langue active. Ton choix survit aux mises à jour, et le pack se rafraîchit automatiquement après une mise à jour dès que ses traductions ont changé. Si les guides téléchargés disparaissent ou sont endommagés, un bouton **Fix documentation** (réparer la documentation) apparaît : il retélécharge le pack, et rétablit les guides en anglais quand la source de téléchargement est injoignable.
- **Confirm before deleting** (confirmer avant de supprimer) : activé par défaut. Marinara demande alors confirmation avant de supprimer définitivement un chat, un personnage ou un autre élément. Garde ce réglage actif pour éviter les suppressions accidentelles.
- **Hide chat Help button** (masquer le bouton d'aide du chat) : désactivé par défaut. Une fois activé, le bouton **Help** (aide) disparaît des chats Conversation, Roleplay et Game.
- **Show Android status bar** (afficher la barre d'état Android) : désactivé par défaut, et ne fonctionne que dans l'application Android de Marinara Engine. Une fois activé, l'heure, le niveau de batterie et les icônes de notification restent visibles au-dessus de Marinara.
- **Achievements** (succès) : activé par défaut. L'écran d'accueil affiche alors le marque-page **Achievements** et les avis de déblocage. Le widget facultatif **Achievements** apparaît si tu l'as ajouté à la disposition de ton accueil. Une fois désactivé, le suivi continue en silence. Voir [Succès](../home/achievements.md).
- **Music Player** (lecteur de musique) : activé par défaut. Le lecteur de musique compact s'affiche alors. Il nécessite l'agent **Music DJ** de **Agents** > **Download Agents** (télécharger des agents), et l'interrupteur reste grisé tant que tu ne l'as pas installé. Voir [Musique](../media/music.md).
- **Search and Professor Mari settings** (réglages de Search et de Professor Mari) : choisis **Open** (ouvrir) pour aller à leur page de réglages. Tous les réglages de Search (la recherche de l'application) et de Professor Mari s'y trouvent, dans ces groupes :

  - **Search** : proposer d'améliorer un champ, et l'historique de recherche.
  - **Quick answers** (réponses rapides) : **Quick answers in Search**, **Answer with** et **Wait after typing**.
  - **Search window** (fenêtre de Search) et **Professor Mari window** (fenêtre de Professor Mari) : chaque fenêtre a des réglages **Height** (hauteur) et **Width** (largeur). Ces groupes ne s'affichent pas sur téléphone.
  - **Professor Mari** : Ask Professor Mari from Search, le mode de permissions, **Runtime** (environnement d'exécution), les pastilles de réponse, l'ouverture des encarts de modification et Enter sends to Professor Mari.
  - **Around the app** (dans le reste de l'application) : Mini Professor Mari visits.
  - **Appearance** (apparence) : son apparence. Chaque pack affiche son portrait. Celui qui est utilisé indique **In use**. Un pack verrouillé affiche ton temps de jeu en vue de le débloquer.

  L'icône d'engrenage dans Search ouvre la même page. Rechercher l'un de ces réglages, sous son nouveau ou son ancien nom, t'y amène directement.

## Text Rules

Cette section se trouve dans **Settings** > **General** > **Text Rules**. Ces règles changent la façon dont le texte du chat est traité. Les réglages **Bold dialogue in quotes** (dialogues entre guillemets en gras) et **Convert LaTeX symbols** (convertir les symboles LaTeX) touchent uniquement à l'affichage : ils ne modifient jamais les messages enregistrés. Le réglage **Quote style** (style de guillemets) est différent : il réécrit les guillemets eux-mêmes dans le texte que tu saisis et enregistres.

### Dialogues entre guillemets en gras

Activé par défaut. Le texte entre guillemets s'affiche alors en gras. Prends cette ligne :

```
"I missed you," she said.
```

Avec **Bold dialogue in quotes** activé, les mots `I missed you` apparaissent en gras. Désactive ce réglage pour conserver la couleur du dialogue sans le gras.

### Convertir les symboles LaTeX

Activé par défaut. Certains modèles écrivent les formules mathématiques avec des commandes LaTeX. Quand le réglage est actif, les commandes courantes comme `\rightarrow`, `\neq`, `\times` et `\alpha` s'affichent sous forme de symboles normaux. Par exemple, `\times` devient le signe de multiplication `×`, et `\alpha` devient la lettre grecque `α`. Les extraits de code ne sont pas touchés.

### Style de guillemets

Détermine la façon dont les guillemets sont uniformisés. Contrairement aux deux règles ci-dessus, ce réglage change le texte lui-même : les messages que tu saisis et enregistres sont réécrits dans le style choisi. Deux options existent :

- **Straight** : conserve les guillemets droits de machine à écrire, comme dans `"Hello," it's me.` C'est la valeur par défaut.
- **Typographic** : remplace les guillemets droits par des guillemets et des apostrophes courbes.

### Charger les images d'autres sites dans les messages

Le réglage **Load images from other websites in messages** est désactivé par défaut. Dans ce cas, une image provenant d'un autre site dans un message, une salutation ou l'aperçu d'une fiche affiche à la place le nom du site et un bouton **Load image** (charger l'image) : un message ne peut donc pas contacter d'autres sites de lui-même. Sélectionne **Load image** pour afficher cette image ; Marinara s'en souvient sur tous tes appareils. Active le réglage pour afficher toutes les images immédiatement. Les images stockées dans Marinara, comme les images de galerie, les avatars et les sprites, s'affichent toujours.

## Responses et Input & Editing

Ces deux sections de l'onglet **General** ajustent la façon dont les réponses arrivent et dont tu saisis et modifies le texte. Voici les réglages, avec des liens vers les guides complets.

La section **Responses** pilote :

- **Enable streaming** (activer le streaming) : affiche le texte de l'IA mot à mot pendant la génération.
- **Streaming speed** (vitesse de streaming) : la vitesse d'apparition du texte diffusé.
- **Trim incomplete sentences from the response** (couper les phrases incomplètes de la réponse) : supprime une dernière phrase inachevée avant l'enregistrement.
- **Add a new line before /continue text** (ajouter une ligne vide avant le texte de /continue) : fait commencer le texte ajouté par `/continue` après une ligne vide. Activé par défaut.
- **Messages per page** (messages par page) : le nombre de messages chargés d'un coup.

Pour en savoir plus, voir [Envoyer des messages et le streaming](../chats/sending-and-streaming.md).

La section **Input & Editing** pilote :

- **Send on Enter** (envoyer avec la touche Enter) : choisis les modes qui envoient le message quand tu appuies sur Enter.
- **Keep guidance after regenerating** (garder la consigne après la régénération) : laisse ta consigne dans le champ de message après une régénération guidée. Activé par défaut.
- **Add CYOA choices to the message box instead of sending them** (ajouter les choix CYOA au champ de message au lieu de les envoyer) : un choix CYOA cliqué va dans ton champ de message, pour que tu puisses le modifier avant de l'envoyer.
- **Quick replies** (réponses rapides) : ajoute des actions de brouillon alternatives à côté du bouton d'envoi. Voir [Génération guidée et Impersonate](../chats/guided-and-impersonate.md).
- **Speech-to-text microphone** (microphone de reconnaissance vocale) : affiche un bouton de microphone dans les champs de saisie du chat.
- **Intuitive swipe navigation** (navigation intuitive entre les swipes) : utilise les touches fléchées ou le balayage tactile pour passer d'une réponse alternative à l'autre.
- **Reroll past the newest swipe** (relancer au-delà du dernier swipe) : génère une nouvelle réponse quand tu dépasses le swipe le plus récent.
- **Up Arrow edits last message** (Up Arrow modifie le dernier message) : appuie sur Up Arrow dans un champ vide pour modifier le dernier message.
- **Double-click edits messages** (double-clic pour modifier les messages) : double-clique sur un message en mode Roleplay pour le modifier.

Pour en savoir plus, voir [Actions sur les messages](../chats/messages.md).

## Message Tools

La section **Message Tools** (outils de message) se trouve dans **Settings** > **Advanced** > **Message Tools**. C'est le point central des interrupteurs d'affichage et de réparation. Chacun d'eux est désactivé par défaut, sauf **Show context usage** (afficher l'utilisation du contexte) et **Show "older messages not sent" note** (afficher la note "anciens messages non envoyés"), qui sont activés. Le tableau indique ce que fait chaque interrupteur et où en lire davantage.

| Interrupteur | Ce qu'il fait | Guide complet |
| --- | --- | --- |
| **Show message timestamps** | Affiche la date et l'heure sur chaque message. | [Actions sur les messages](../chats/messages.md) |
| **Show characters in Persona pickers** | Liste tes personnages dans les sélecteurs de persona, pour que tu puisses en incarner un. | [Personas](../characters/personas.md) |
| **Show model name on messages** | Indique quel modèle d'IA a écrit chaque réponse. | [Actions sur les messages](../chats/messages.md) |
| **Show token usage on messages** | Affiche le nombre de tokens du prompt et de la réponse pour chaque message. | [Actions sur les messages](../chats/messages.md) |
| **Show context usage** | Indique à quel point le contexte du modèle était rempli lors de la dernière requête mesurée, dans les sélecteurs de connexion et les réglages des chats Game. | [Organiser les connexions](../connections/organizing-connections.md#the-random-pool-and-quick-connection-switcher) |
| **Show message numbers** | Affiche un numéro sur chaque message du chat. | [Actions sur les messages](../chats/messages.md) |
| **Show "older messages not sent" note** | Affiche une note sous la réponse la plus récente quand des messages plus anciens n'ont pas tenu dans le prompt. Désactive-le pour masquer cette note dans les longs chats. Une réponse coupée ou vide affiche toujours sa propre note. | [Peek Prompt](../chats/peek-prompt.md) |
| **Guide swipes/regens with chat input** | Utilise ton brouillon en cours comme consigne quand tu régénères. | [Génération guidée et Impersonate](../chats/guided-and-impersonate.md) |
| **Include reasoning in exports** | Ajoute le raisonnement masqué aux exports de chat. | [Exporter et importer des chats](../chats/export-import.md) |
| **Include private notes in exports** | Ajoute tes notes privées de message aux exports de chat JSONL et texte. Laisse-le désactivé quand tu partages une transcription. | [Exporter et importer des chats](../chats/export-import.md) |
| **Debug mode** | Enregistre les données envoyées au modèle dans la console du serveur, pour le support. | [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md) |

Le reste de l'onglet **Advanced** est traité ailleurs. Voir [Mettre à jour Marinara Engine](../UPGRADING.md) pour **Updates**, [Accès à distance](../REMOTE_ACCESS.md) pour **Admin Access**, [Sauvegarde et restauration](../data/backup-and-restore.md) pour **Backup & Export**, et [Effacer tes données](../data/clearing-data.md) pour **Danger Zone**.

## Synchronisation des réglages entre appareils

Marinara conserve la plupart des réglages sur le serveur : ils te suivent donc d'un navigateur et d'un appareil à l'autre. C'est le principe de la synchronisation des réglages.

Voici comment ça marche :

1. Tu changes un réglage n'importe où dans **Settings**.
2. Environ une seconde plus tard, Marinara enregistre la modification sur le serveur avec un horodatage.
3. Quand un autre navigateur ouvre le même serveur Marinara, il charge ces réglages enregistrés.

Chaque appareil garde la copie la plus récente : c'est le dernier écrit qui gagne, d'après l'horodatage. Attention à une conséquence de cette règle. Si tu ouvres Marinara sur un deuxième appareil, sa copie peut écraser discrètement un réglage que tu viens de changer sur le premier. Laisse à l'application le temps de se synchroniser avant de changer d'appareil.

Deux réglages ne se synchronisent jamais. Ils restent propres au navigateur de l'appareil où tu les définis :

- **Display Size** (taille de l'interface)
- **Chat Font Size** (taille du texte du chat)

Les deux se trouvent dans **Settings** > **Appearance** > **Text & Scale**. Redéfinis-les sur chaque appareil que tu utilises. Voir [Réglages d'apparence](../appearance/appearance-settings.md).

Si le serveur est injoignable, l'application continue de fonctionner avec les réglages locaux et réessaie à ta prochaine modification.

## Guides associés

- [Réglages d'apparence](../appearance/appearance-settings.md)
- [Actions sur les messages](../chats/messages.md)
- [Envoyer des messages et le streaming](../chats/sending-and-streaming.md)
- [Exporter et importer des chats](../chats/export-import.md)
- [Où sont stockées tes données](../data/where-data-is-stored.md)
- [Mettre à jour Marinara Engine](../UPGRADING.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
- [Succès](../home/achievements.md)
- [Extensions personnelles](../extending/personal-extensions.md)
- [Localisation de l'interface](../development/localization.md)
