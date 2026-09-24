# Éditeur de presets et gestionnaire de prompts

Ce guide explique les presets de prompt (modèles de prompt enregistrés) dans Marinara Engine. Au programme : à quoi ils servent, comment en construire un dans le **Preset Editor** (éditeur de presets) et comment en attribuer un à un chat. Un preset règle la structure du texte que Marinara envoie à l'IA.

## Ce qu'est un preset

Un preset est un plan réutilisable. Il décide des informations que Marinara envoie à l'IA, et dans quel ordre. Cela comprend les instructions système que tu écris, la fiche de personnage, le persona, l'historique du chat, les entrées de lorebook, et plus encore.

Les presets façonnent le prompt – le texte que Marinara envoie à l'IA – pour les chats **Roleplay** et **Game**. Le mode **Conversation** fonctionne autrement et utilise un seul champ de prompt. Voir "En quoi les modes Conversation et Game diffèrent" plus bas.

Les presets ne demandent ni clé API ni compte. Ils décrivent seulement la façon dont un prompt se construit. Il te faut quand même une connexion opérationnelle pour envoyer le prompt. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

## Ouvrir le Preset Editor

Les presets de prompt se trouvent dans la section **Prompts** du panneau **Presets**, à gauche de l'application. Les autres sections de ce panneau sont **Regexes** et **Functions**.

Le panneau comporte trois boutons en haut :

- **New** (icône plus) : créer un preset.
- **Import** (icône de téléchargement) : charger un preset depuis un fichier `.json`.
- **Select** (icône de coche) : sélectionner plusieurs presets pour les exporter ou les supprimer d'un coup.

Sous les boutons se trouvent un champ **Search presets** et un menu de tri avec **A-Z**, **Z-A**, **Newest** et **Oldest**. Le bouton **New Folder** (nouveau dossier) permet de regrouper les presets dans des dossiers. Fais glisser un preset sur un dossier pour l'y déplacer. Double-clique ou double-tape sur un dossier pour le renommer.

Chaque ligne de preset affiche son nom, son format d'encapsulation, son nombre de sections et son auteur. Un badge **DEFAULT** apparaît si le preset est celui marqué par défaut. Clique sur une ligne de preset pour l'ouvrir dans le **Preset Editor**.

## Créer et modifier un preset

Voici la marche à suivre pour créer un preset :

1. Ouvre le panneau **Presets**.
2. Clique sur le bouton **New**. La fenêtre **Create Preset** s'ouvre.
3. Saisis un **Name**. Ce champ est obligatoire.
4. Ajoute une **Description** facultative, histoire de te rappeler à quoi sert le preset.
5. Clique sur **Create**. Le nouveau preset s'ouvre dans le **Preset Editor**.
6. Construis le prompt dans l'onglet **Sections** (voir plus bas).
7. Clique sur **Save** en haut à droite quand tu as terminé.

L'éditeur n'enregistre rien tout seul. Les modifications ne sont conservées qu'après un clic sur **Save**. Si tu essaies de quitter avec des modifications non enregistrées, un avertissement s'affiche avec les boutons **Keep editing**, **Discard** et **Save & close**.

Pour exporter un preset, ouvre-le et clique sur le bouton d'export (icône de flèche vers le haut) dans la barre du haut. Marinara propose d'abord d'enregistrer si des modifications sont en attente. Pour supprimer un preset, utilise l'icône de corbeille dans la barre du haut.

## Les onglets Overview, Sections et Prompts

Le **Preset Editor** comporte trois onglets.

- **Overview** (vue d'ensemble) : le nom du preset, sa description, son format d'encapsulation et son auteur.
- **Sections** : la structure du prompt à proprement parler, bâtie à partir de blocs et de marqueurs.
- **Prompts** : les prompts de mode utilisés par les chats Conversation et Game.

### Onglet Overview

L'onglet **Overview** contient quatre champs. **Name** est le nom affiché dans le panneau **Presets**. **Description** est un court résumé du preset. **Wrap Format** règle la mise en forme des sections (voir "Formats d'encapsulation"). **Author** est un nom de créateur facultatif, utile quand tu partages un preset. Deux cartes en lecture seule affichent le nombre de **Sections** et de **Groups**.

### Onglet Prompts

L'onglet **Prompts** contient les prompts de mode.

- **Conversation Mode** : un champ de texte qui sert de prompt Conversation pour ce preset. Laisse-le vide pour utiliser le prompt de conversation intégré de Marinara.
- **Roleplay Mode** : non modifiable ici. Le Roleplay utilise le prompt assemblé à partir des **Sections**.
- **Game Mode** : un champ de texte qui sert de prompt Game pour ce preset. Laisse-le vide pour utiliser le prompt de jeu intégré de Marinara.

## Sections et marqueurs

L'onglet **Sections** est l'endroit où se construit le prompt. Chaque section fait partie du texte final envoyé à l'IA. Les sections s'assemblent de haut en bas.

Clique sur **Add Section** (ajouter une section) pour ouvrir le menu d'ajout. Il propose deux types de section.

Un **Prompt Block** est une section de texte libre que tu rédiges toi-même. Utilise-la pour les instructions système, les règles de ton, ou toute formulation que tu veux voir dans chaque prompt.

Un **marqueur** est une section remplie automatiquement. Elle n'a pas de texte propre. Marinara la remplit au moment de l'envoi avec le contenu réel du chat. Le tableau ci-dessous récapitule les marqueurs.

| Marqueur | Ce qu'il insère |
|---|---|
| **Character Info** | Les détails de la fiche de personnage active. |
| **Persona** | Les détails du persona actif. |
| **Chat History** | Les messages du chat en cours. |
| **Chat Summary** | Le résumé compilé de ce chat. |
| **Dialogue Examples** | Les exemples de dialogue du personnage. |
| **Lorebook Marker (All)** | Toutes les entrées de lorebook actives. |
| **Lorebook Marker (Before)** | Les entrées de lorebook réglées pour s'insérer avant. |
| **Lorebook Marker (After)** | Les entrées de lorebook réglées pour s'insérer après. |

Une section de type marqueur affiche un badge **MARKER** sur sa ligne. Déplie-la pour voir une note qui indique le type de marqueur. La plupart des marqueurs n'acceptent pas de contenu saisi, puisque Marinara les génère à ta place.

Quand un preset n'a pas de marqueur **Dialogue Examples** activé, les exemples de dialogue non vides sont ajoutés à **Character Info**, après le scénario. Ils reprennent la mise en forme XML, Markdown ou sans encapsulation du preset. Ajoute un marqueur Dialogue Examples si tu veux décider explicitement de leur emplacement ; Marinara ne les inclura pas deux fois.

Si le chat a des lorebooks actifs mais que le preset n'a aucun marqueur de lorebook, un avertissement apparaît. Il indique : "Add a lorebook marker when this preset should receive active lorebook entries." Ajoute un marqueur de lorebook pour que ces entrées parviennent à l'IA. Voir [Vue d'ensemble des lorebooks](../lorebooks/overview.md).

Si tu as configuré des agents personnalisés avec l'option "inject as section" activée, le menu d'ajout affiche un groupe **Agent Sections**. Chaque section d'agent insère la dernière sortie de cet agent dans le prompt. Tu peux ajouter tes propres instructions autour.

Chaque ligne de section a des commandes sur la droite. **Duplicate** copie la section. L'icône en forme d'œil active ou désactive la section. **Delete** la supprime. Pour réordonner les sections, fais glisser la poignée, utilise les flèches haut et bas, ou fais un appui long sur écran tactile.

Déplie une section (clique sur son nom ou sur le chevron) pour la modifier. Tu peux changer son **Name** et son rôle (**System**, **User** ou **Assistant**). Pour un **Prompt Block**, tu peux aussi modifier son **Content**. Le champ de contenu accepte les macros. Voir [Macros de prompt](macros.md).

## Groupes et position des sections

### Groupes

Les groupes réunissent plusieurs sections dans un même conteneur. Les sections liées restent ainsi ensemble dans le prompt final.

1. Dans l'onglet **Sections**, clique sur le bouton **Groups** de la barre d'outils.
2. Clique sur **New Group**. Un groupe nommé "New Group" apparaît.
3. Clique sur le nom du groupe pour le renommer.
4. Déplie une section et choisis ton groupe dans son menu déroulant **Group**.

Avec le format d'encapsulation **XML**, un groupe devient une balise parente autour de ses sections. Avec **Markdown**, un groupe devient un titre. Supprimer un groupe ne supprime pas ses sections : elles perdent simplement leur groupe.

### Position et profondeur

Chaque section a un réglage **Position** dans son éditeur déplié.

- **Ordered (in sequence)** : la section reste là où elle apparaît dans la liste. C'est le choix habituel.
- **Depth (from end of chat)** : la section est placée un certain nombre de messages avant la fin du chat. Quand tu choisis cette option, un champ **Depth** apparaît. Une profondeur de 0 place la section après le dernier message.

Utilise **Depth** pour les rappels que l'IA doit voir près des messages les plus récents, par exemple une courte note de style.

## Formats d'encapsulation

Le réglage **Wrap Format** de l'onglet **Overview** détermine la façon dont chaque section est encapsulée lors de l'assemblage du prompt. Il y a trois boutons.

- **XML** : chaque section est entourée de balises, par exemple une balise portant son nom autour de son contenu. Les groupes deviennent des balises parentes. C'est la valeur par défaut.
- **MARKDOWN** : chaque section est précédée d'un titre. Les groupes deviennent des titres de niveau supérieur.
- **NONE** : aucune encapsulation. Le contenu des sections part exactement tel qu'il est écrit.

XML est un bon choix par défaut pour la plupart des modèles. N'essaie **MARKDOWN** ou **NONE** que si un modèle semble mieux répondre sans balises.

## Attribuer un preset à un chat

Un preset ne fait rien tant que tu ne l'as pas attribué à un chat. Il y a deux façons de procéder dans un chat **Roleplay**.

Depuis le panneau **Presets** :

1. Ouvre le chat que tu veux modifier.
2. Dans le panneau **Presets**, survole une ligne de preset.
3. Clique sur le bouton en forme de coche **Assign to chat** (attribuer au chat). Un nouveau clic annule l'attribution.

Depuis **Chat Settings** :

1. Ouvre le chat.
2. Ouvre **Chat Settings** (réglages du chat, l'engrenage).
3. Trouve la section **Prompt Preset**.
4. Choisis un preset dans le menu déroulant.

Si un preset comporte des variables, la fenêtre **Configure Preset Variables** s'ouvre au moment de l'attribution. Renseigne tes choix à cet endroit. Voir [Variables de preset](preset-variables.md). Passer à un autre preset efface les choix de variables faits auparavant.

Les presets de prompt ne sont pas disponibles en mode **Conversation** depuis le panneau. Un clic sur le bouton d'attribution dans un chat Conversation affiche un message : "Prompt presets are not available in conversation mode." La section suivante explique comment les chats Conversation et Game utilisent les presets à la place.

## En quoi les modes Conversation et Game diffèrent

Les chats **Conversation** et **Game** ne construisent pas de prompt à partir des Sections. Ils utilisent un unique prompt de mode, que tu peux remplacer chat par chat.

Dans ces modes, **Chat Settings** affiche une section **Prompt Preset** avec un menu déroulant **Prompt source**. Le menu liste tes presets. Il est réglé par défaut sur "Default conversation prompt" ou "Default game prompt". Sans aucun preset, il indique "No presets available".

Sous le menu déroulant se trouve une ligne d'état. Elle affiche l'un des trois états suivants :

- **Default** : le prompt de mode intégré est utilisé.
- **Preset** : le prompt vient du preset choisi.
- **Custom** : tu as saisi une modification propre à ce chat.

Clique sur **Edit Prompt** pour rédiger un prompt réservé à ce chat. L'éditeur s'ouvre sous le nom **Edit Conversation Prompt** ou **Edit Game Prompt**. Si ta modification correspond exactement au preset ou à la valeur par défaut, Marinara considère qu'il n'y a pas de personnalisation. Dès qu'une modification personnalisée existe, un bouton **Reset to default prompt** apparaît pour l'effacer.

Les chats Game disposent en plus d'un champ **Extra instructions**. Le texte saisi là s'ajoute au prompt Game. La limite est de 2000 caractères. Exemple d'instruction : "Write in the style of Terry Pratchett."

<a id="decision-blocks-and-prompt-caching"></a>

## Blocs de décision et cache de prompts

Une section peut contenir un bloc `{{#if decision:"..."}}` pour envoyer cette partie du preset seulement aux tours où un énoncé sur le chat est vrai. Consulte [Interroger le Decision model](conditional-prompts.md#asking-the-decision-model).

**Place les blocs de décision changeants vers la fin du prompt**, comme dans les instructions après l'historique. Changer une branche peut empêcher la réutilisation du prompt à partir de ce point ; un changement tôt peut donc perdre l'essentiel des économies. Un préfixe antérieur inchangé peut rester admissible ; tout le prompt n'est pas nécessairement facturé comme nouveau. Garde une décision en haut seulement si elle change rarement et si ses instructions y ont leur place. Voir les détails par fournisseur dans [Cache de prompts](conditional-prompts.md#prompt-caching).

Les énoncés dans les sections et groupes désactivés ne sont jamais interrogés et ne comptent pas dans **Decision statements per turn** (énoncés de décision par tour).

## Vérifier ce que l'IA a reçu

Pour savoir quel preset et quelles sections sont réellement parvenus à l'IA, utilise **Peek Prompt**. Cette fonction montre le prompt entièrement assemblé pour un message. C'est le moyen le plus rapide de comprendre une réponse étrange. Voir [Peek Prompt : voir ce que l'IA a reçu](../chats/peek-prompt.md).

## Guides associés

- [Variables de preset](preset-variables.md)
- [Macros de prompt](macros.md)
- [Paramètres de génération](generation-parameters.md)
- [Profils de réglages](../chats/settings-profiles.md)
- [Vue d'ensemble des Chat Settings](../chats/chat-settings.md)
- [Peek Prompt : voir ce que l'IA a reçu](../chats/peek-prompt.md)
