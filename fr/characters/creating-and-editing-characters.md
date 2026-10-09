# Créer et modifier des personnages

Ce guide explique comment créer un personnage dans Marinara Engine. Il montre aussi comment se servir de l'éditeur **Character Editor** (éditeur de fiche de personnage) pour écrire, enregistrer et gérer les versions d'une fiche. Au programme : les onglets **Metadata**, **Card**, **Voice** et **Advanced**, les avatars et l'historique des versions enregistrées.

## Ce qu'est une fiche de personnage

La fiche de personnage est le fichier qui définit un personnage IA. Elle contient son identité, sa façon de parler, son apparence et la manière dont un chat démarre avec lui. Ces détails s'écrivent dans l'éditeur **Character Editor**. Tu peux créer une fiche de zéro, en importer une depuis une autre application, ou exporter la tienne pour la partager.

L'essentiel de la rédaction tient dans quelques champs de texte. L'IA relit ces champs à chaque réponse : plus l'écriture est claire et précise, plus le personnage reste cohérent.

## Créer un personnage

1. Ouvre le panneau **Characters** (Personnages) depuis la barre latérale.
2. Clique sur le bouton **New** (l'icône plus). La fenêtre **Create Character** s'ouvre.
3. Clique sur le cercle rond de l'avatar pour téléverser une image. Cette étape est facultative.
4. Saisis un nom dans le champ **Name \***. Le nom est obligatoire.
5. Clique sur **Create**.

La nouvelle fiche est enregistrée avec des champs vides. L'éditeur **Character Editor** complet s'ouvre ensuite pour que tu remplisses le reste. Autre option : commencer par **Import** plutôt que par **New** si tu as déjà un fichier de fiche. Voir [Importer et exporter des fiches de personnage](import-export.md).

## L'éditeur Character Editor en un coup d'œil

L'éditeur **Character Editor** remplace la zone de chat par un espace de travail pleine page. L'en-tête s'étire en haut et regroupe les éléments les plus utilisés.

En haut à gauche se trouvent la flèche **Back**, la vignette de l'avatar, un champ de nom et un champ de titre ou de commentaire. Le champ de commentaire sert à noter une courte étiquette comme `Modern AU version`. Juste en dessous, une petite ligne affiche le créateur et la version.

En haut à droite, tu disposes de ces boutons :

- **Save** (enregistrer). Ce bouton reste inactif tant que tu n'as rien modifié. Son libellé indique l'état en cours : **Uploading…**, **Embedding…** ou **Saving…**.
- L'étoile **Favorite**, qui marque la fiche comme favorite.
- **Export character**.
- **Import character as persona**, qui copie cette fiche dans un nouveau persona (le personnage que tu incarnes).
- **Duplicate character**.
- **Delete character**.

Si tu essaies de partir avec des modifications non enregistrées, un bandeau affiche `You have unsaved changes. Close without saving?` Il propose **Keep editing**, **Discard & close** et **Save & close**.

L'éditeur est découpé en onglets. Sur un écran large, ils s'alignent verticalement à gauche. Sur un écran étroit, ils deviennent une bande défilante en haut. Les onglets, dans l'ordre, sont **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors**, **Voice**, **Stats** et **Advanced**.

Ce guide traite des onglets **Metadata**, **Card**, **Voice** et **Advanced**, ainsi que des avatars et de l'historique des versions. Les autres onglets ont leur propre guide :

- **Convo** : [Profils du mode Conversation](../conversation/profiles.md).
- **Lorebook** : [Lier des lorebooks à des personnages](../lorebooks/linking-to-characters.md).
- **Sprites** : [Sprites de personnage](sprites.md).
- **Gallery** : [Galeries de personnages et de personas](galleries.md).
- **Colors** et **Stats** : [Couleurs et caractéristiques RPG des personnages](colors-and-stats.md).

## Onglet Metadata

L'onglet **Metadata** rassemble les informations d'identité et de classement. Elles servent à trier, partager et suivre une fiche, mais la plupart ne sont pas envoyées à l'IA.

- **Character ID**. Une valeur en lecture seule, visible seulement après l'enregistrement de la fiche. Clique sur **Copy** pour la copier.
- **Name**. Le nom affiché. Il correspond à `{{char}}` dans les prompts, c'est-à-dire dans le texte que Marinara envoie à l'IA.
- **Creator**. La personne qui a créé la fiche, pour la créditer lors du partage.
- **Version**. Un numéro de version que tu choisis, par exemple `1.0`.
- **Talkativeness**. Un curseur de 0 à 100 pour cent. Il règle la fréquence à laquelle ce personnage prend la parole dans les chats de groupe. La valeur par défaut est 50 pour cent.
- **Tags**. Saisis un ou plusieurs tags dans le champ d'ajout, puis appuie sur Enter ou clique sur **Add**. Tu peux en ajouter plusieurs d'un coup en les séparant par des virgules. Retire un tag avec son X, ou efface-les tous avec **Remove All**.
- **Creator Notes**. Des notes privées qui ne sont jamais envoyées à l'IA. Elles apparaissent quand même en résumé dans ta bibliothèque.

Le panneau **Version history** (historique des versions) se trouve lui aussi sur cet onglet. Il est décrit plus bas, dans la section sur l'enregistrement et l'historique des versions.

## Onglet Card

L'onglet **Card** est l'espace de rédaction principal. Il contient les champs que l'IA lit pour incarner le personnage. Des liens de navigation en haut permettent de sauter directement à une section. Chaque champ affiche un compteur de caractères en direct.

- **Description**. L'identité générale et le rôle du personnage. Ce texte part dans chaque prompt.
- **Personality**. Un court résumé du tempérament, des habitudes de langage et des comportements types.
- **Backstory**. Le passé, les origines et les relations importantes.
- **Appearance**. La description physique, les vêtements et les détails visuels. Marinara se sert aussi de ce texte pour préremplir un prompt d'avatar IA.
- **Image Appearance Override** (apparence propre aux images). Un interrupteur facultatif sous **Appearance**, désactivé par défaut. Active-le pour afficher un second champ où tu peux décrire le personnage avec un texte adapté à la génération d'images. S'il est activé et que le champ contient du texte, les prompts d'image utilisent ce texte à la place d'**Appearance** ; il sert aussi à préremplir le prompt d'avatar IA. Le narrateur reçoit toujours le texte complet d'**Appearance**. Si l'interrupteur est désactivé ou le champ vide, **Appearance** reste utilisé comme avant.
- **Scenario**. Le cadre par défaut des nouveaux chats avec ce personnage.

La section **Dialogue & Greetings** définit l'ouverture du chat et le ton du personnage :

- **First Message**. Le message d'accueil affiché au démarrage d'un nouveau chat.
- **Alternate Greetings**. Des messages d'accueil supplémentaires. Au lancement d'un chat, tu choisis lequel utiliser. Les commandes haut et bas les réordonnent, et le X en supprime un.
- **Example Dialogue**. Des échanges d'exemple qui donnent sa voix au personnage. Utilise `<START>` pour séparer les échanges. Utilise `{{user}}` et `{{char}}` comme espaces réservés.

Les salutations et les messages d'exemple peuvent aussi afficher des images de la Gallery du personnage ; consulte [Galeries de personnages → Réutiliser une image de galerie dans les messages et les salutations](galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

Quand les salutations affichent des images venues d'autres sites web, **Save images locally** (enregistrer les images localement) en garde une copie dans la Gallery du personnage ; consulte [Galeries de personnages → Enregistrer les images web des salutations](galleries.md#save-web-images-from-greetings).

Une courte entrée Example Dialogue ressemble à ceci :

```
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

## Ajouter un avatar

L'avatar est l'image affichée pour le personnage dans le chat et dans ta bibliothèque. Tu peux en téléverser un, ajuster son cadrage, ou en générer un avec l'IA.

### Téléverser une image

1. Clique sur la vignette de l'avatar dans l'en-tête de l'éditeur.
2. Choisis un fichier image. La nouvelle image apparaît aussitôt.

Dès qu'un personnage a un avatar, un outil de recadrage apparaît sur l'onglet **Metadata**. Il sert à repositionner ou à zoomer l'image dans son cercle sans téléverser le fichier à nouveau. Cet outil propose également une commande pour retirer l'avatar.

### Générer un avatar avec l'IA

L'option d'avatar IA n'apparaît que si au moins une connexion de génération d'images est configurée. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

1. Survole la vignette de l'avatar et clique sur le petit bouton baguette **Generate avatar**.
2. La fenêtre **Generate Character Avatar** s'ouvre.
3. Choisis une **Image Generation Connection**.
4. Relis ou modifie l'**Avatar Prompt**. Il est prérempli avec le texte d'**Image Appearance Override** si l'option est activée et que son champ contient du texte. Sinon, Marinara utilise **Appearance** ; si ce champ est vide, il utilise **Description**, puis **Personality**.
5. Si la fiche a déjà un avatar, tu peux cocher **Use current avatar as a reference**.
6. Clique sur **Generate**. Pour un nouvel essai, clique sur **Regenerate**.
7. Quand le résultat te convient, clique sur **Use Avatar**.

La taille de l'image vient du réglage de taille **Portraits**, dans les réglages de génération d'images, qui vaut 1024 par 1024 par défaut. Si tu as activé **Expose media prompts before sending**, une étape de relecture du prompt s'intercale avant chaque requête.

## Onglet Voice

L'onglet **Voice** (voix) définit la voix que prend le personnage quand le Text to Speech (synthèse vocale) lit ses répliques à voix haute.

- **Voice**. La voix que le Text to Speech utilise pour ce personnage. Toute modification est enregistrée aussitôt, sans passer par **Save**. C'est le même réglage que la ligne de ce personnage dans **Connections → Text to Speech** (Connexions → Synthèse vocale) : les deux concordent donc toujours. Laisse le champ vide pour utiliser la voix par défaut. Si une fiche au nom correspondant a une voix, par exemple l'original d'une copie AU (univers alternatif), le champ vide affiche le nom de cette voix, car cette fiche l'utilise aussi.
- **Preview** (écouter). Joue une courte phrase avec cette voix. La phrase dit le nom du personnage, ou le nom phonétique s'il est défini, pour que tu entendes comment il est prononcé.
- **Phonetic name** (nom phonétique). Une orthographe facultative, utilisée uniquement pour corriger la prononciation en synthèse vocale. Laisse le champ vide pour garder le nom normal. Contrairement à la voix, ce champ fait partie de la fiche : clique donc sur **Save** pour le conserver.

Si le Text to Speech est désactivé, ou si tous les personnages partagent une seule voix, une courte note remplace le champ **Voice**. Avec une voix commune, la note propose le bouton **Use a voice per character** (utiliser une voix par personnage). Le bouton **Open Text to Speech settings** (ouvrir les réglages de synthèse vocale) ouvre le panneau Connections, où la carte **Text to Speech** regroupe tous les réglages. Voir [Configuration du Text to Speech (TTS)](../media/tts-setup.md).

## Onglet Advanced

L'onglet **Advanced** regroupe des réglages de prompt destinés aux utilisateurs avancés. Pour un personnage classique, tu peux tout laisser vide.

Ces réglages de prompt définis dans la fiche s'appliquent aux modes Conversation, Roleplay et Game. Un preset Conversation ou Game sélectionné – un preset étant un modèle de prompt enregistré – modifie le prompt qui l'entoure, mais ne désactive ni les Post-History Instructions ni le Depth Prompt du personnage.

- **System Prompt**. Des instructions propres au personnage, ajoutées via le bloc de personnage du preset actif, le contexte de personnage en mode Conversation, ou la fiche de personnage/GM en Game Mode, selon le cas. Cela ne remplace pas le prompt système principal du chat.
- **Post-History Instructions**. Un texte placé vers la fin du prompt, juste avant la génération. Usage courant : un bref rappel du type "Stay in character".
- **Depth Prompt**. Un texte inséré à un endroit choisi de l'historique du chat. Le champ **Depth** définit de combien de messages on remonte. La profondeur 0 place le texte juste après le dernier message, et la profondeur 4 quatre messages plus haut. La profondeur par défaut est 4. Le champ **Role** détermine si le texte est inséré en tant que **System**, **User** ou **Assistant**. Le rôle par défaut est System.

La section **Regex Scripts** de cet onglet contient les scripts de recherche-remplacement limités à ce seul personnage. Ils s'appuient sur le moteur de regex partagé. Voir [Scripts regex](../extending/regex-scripts.md) pour comprendre leur fonctionnement.

## Enregistrement et historique des versions

Clique sur **Save** dans l'en-tête pour enregistrer tes modifications. Le bouton reste inactif tant que rien n'a changé, puis s'active.

Chaque enregistrement peut ajouter un instantané dans **Version history**, sur l'onglet **Metadata**. Avant ta première modification supplémentaire, le panneau affiche `Previous card states will appear here after the next edit.` Un compteur indique le nombre d'instantanés enregistrés.

Pour comparer une version enregistrée avec la fiche actuelle :

1. Ouvre l'onglet **Metadata**.
2. Dans **Version history**, clique sur une version enregistrée.
3. La fenêtre **Compare** s'ouvre. Elle liste côte à côte des champs comme Name, Description, Personality, Scenario, First Message et Example Dialogue. Chaque champ modifié est signalé.

Pour revenir à une version plus ancienne :

1. Ouvre la fenêtre **Compare** de la version voulue, ou clique sur son icône de restauration dans la liste.
2. Clique sur **Restore this version**, puis confirme.

La restauration remplace la fiche actuelle par cet instantané. Elle n'ajoute pas de nouvelle entrée d'historique. L'icône crayon sert à corriger l'étiquette de version d'un instantané enregistré sans le restaurer. Tu peux aussi supprimer un instantané depuis la liste : cela ne change rien à la fiche actuelle.

Utilise **Reset** dans l'en-tête de **Version history** quand tu veux repartir de zéro sur le suivi des versions de la fiche. Après confirmation, Marinara supprime tous les instantanés enregistrés et remet la version de la fiche à `0.0`. Cette action est irréversible.

## Relire les mises à jour de fiche proposées par un agent

Pendant un chat en mode Roleplay, un agent facultatif peut suggérer de petites modifications des champs de la fiche d'après ce qui s'est passé dans la scène. Le cas échéant, la fenêtre **Review Character Card Updates** apparaît pour que tu gardes la main. C'est toi qui décides de ce qui est retenu.

Pour chaque modification proposée, tu peux :

- **Approve**. Appliquer le changement. Cela incrémente aussi le numéro de version et ajoute une entrée dans l'historique des versions.
- **Regenerate**. Demander à l'agent un nouvel essai.
- **Reject**. Écarter la proposition.

Si le texte concerné a changé depuis la proposition, l'application te prévient avant de te laisser forcer la modification. Pour savoir comment activer ou désactiver ces agents, voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md).

## Un mot sur Professor Mari

**Professor Mari** est un personnage assistant intégré, livré avec Marinara. Impossible de la supprimer : si tu essaies, l'application bloque l'opération et t'indique qu'il s'agit d'un personnage intégré. Pour découvrir son rôle, voir [Professor Mari, ton assistante intégrée](../home/professor-mari.md).

## Guides associés

- [Les personas : créer et modifier](personas.md)
- [Sprites de personnage](sprites.md)
- [Galeries de personnages et de personas](galleries.md)
- [Importer et exporter des fiches de personnage](import-export.md)
- [Couleurs et caractéristiques RPG des personnages](colors-and-stats.md)
- [Profils du mode Conversation](../conversation/profiles.md)
- [Lier des lorebooks à des personnages](../lorebooks/linking-to-characters.md)
