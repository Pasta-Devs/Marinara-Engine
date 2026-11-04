# Éditeur de presets et gestionnaire de prompts

Un preset est un plan enregistré du prompt, le texte que Marinara envoie au modèle pour chaque réponse. Il décide de ce qui y entre, et dans quel ordre : tes instructions, la fiche de personnage, ton persona, l'historique du chat, les entrées de lorebook et plus encore. Sers-toi du **Preset Editor** (éditeur de presets) pour en construire un, puis attribue-le à un chat.

Les presets construisent le prompt dans les chats **Roleplay**. Les chats **Conversation** et **Game** utilisent plutôt un seul champ de prompt (voir [Les chats Conversation et Game](#conversation-and-game-chats)). Les presets ne demandent aucune clé API (un code secret, un peu comme un mot de passe), mais il te faut quand même un compte opérationnel pour envoyer le prompt. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

## Attribuer un preset à un chat

Un preset ne fait rien tant qu'un chat ne l'utilise pas. Dans un chat **Roleplay**, utilise l'une ou l'autre des deux méthodes. Pour en choisir un, attribue-le. Pour créer le tien, voir [Créer un preset](#create-a-preset).

Depuis le panneau **Presets** :

1. Ouvre le chat.
2. Dans le panneau **Presets**, repère une ligne de preset. Sur un ordinateur, passe le pointeur sur la ligne pour afficher ses boutons.
3. Clique sur le bouton en forme de coche **Assign to chat** (attribuer au chat). Une coche indique que le preset est utilisé. Clique de nouveau dessus pour annuler l'attribution.

Depuis **Chat Settings** (réglages du chat) :

1. Ouvre le chat, puis **Chat Settings**.
2. Repère **Prompt Preset** (preset de prompt) et choisis un preset dans le menu déroulant.

Si le preset a des variables, la fenêtre **Configure Preset Variables** (configurer les variables de preset) s'ouvre. Voir [Variables de preset](preset-variables.md). Passer à un autre preset efface les choix de variables faits auparavant.

<a id="create-a-preset"></a>

## Créer un preset

1. Ouvre le panneau **Presets** depuis la barre latérale.
2. Clique sur **New** (nouveau), l'icône plus. La fenêtre **Create Preset** (créer un preset) s'ouvre.
3. Saisis un **Name** (nom). Ce champ est obligatoire. Ajoute une **Description** si tu veux.
4. Clique sur **Create** (créer). Le preset s'ouvre dans le **Preset Editor**.
5. Construis le prompt dans l'onglet **Sections**.
6. Clique sur **Save** (enregistrer) en haut à droite.

L'éditeur n'enregistre rien tout seul. Clique sur **Save** après chaque modification. Si tu quittes avec des modifications non enregistrées, un avertissement propose **Keep editing** (continuer à modifier), **Discard** (abandonner) et **Save & close** (enregistrer et fermer).

Pour exporter un preset, clique sur l'icône de flèche vers le haut dans la barre du haut (infobulle **Export preset**). Marinara te demande d'abord d'enregistrer si des modifications sont en attente. Pour le supprimer, clique sur l'icône de corbeille.

## Le panneau Presets

**Prompts** est la section des presets. Les autres sections sont **Regexes** et **Functions**. Les boutons du haut sont **New**, **Import** (importer : charger un fichier `.json`) et **Select** (sélectionner : en exporter ou en supprimer plusieurs d'un coup).

- **Search presets** filtre la liste.
- Le menu de tri propose **Manual order** (ordre manuel), **A-Z**, **Z-A**, **Newest** et **Oldest**. Avec **Manual order**, fais glisser une ligne, ou appuie sur <kbd>Alt</kbd>+<kbd>Up</kbd> ou <kbd>Alt</kbd>+<kbd>Down</kbd> sur une ligne sélectionnée. Sur un écran tactile, appuie longuement sur une ligne pour la saisir.
- **New Folder** (nouveau dossier) regroupe des presets. Fais glisser un preset sur un dossier, et double-clique ou double-tape sur un dossier pour le renommer.

Chaque ligne affiche le nom, le format d'encapsulation, le nombre de sections et l'auteur. Un badge **DEFAULT** signale le preset par défaut, marqué d'une étoile. Clique sur une ligne pour l'ouvrir.

## Les onglets du Preset Editor

| Onglet | Ce qu'il contient |
| --- | --- |
| **Overview** (vue d'ensemble) | Le nom, la description, le format d'encapsulation et l'auteur. |
| **Sections** | La structure du prompt, bâtie à partir de blocs et de marqueurs. |
| **Prompts** | Les prompts de mode des chats Conversation et Game. |
| **Parameters** (paramètres) | Les réglages de génération de départ. Voir [Paramètres de génération](generation-parameters.md). |
| **Regex** | Les scripts regex liés à ce preset et le réglage **Scoped regex default** (mode par défaut des regex à portée limitée). Voir [Scripts regex](../extending/regex-scripts.md). |

### Onglet Overview

- **Name** est le titre affiché dans le panneau **Presets**.
- **Description** est un court résumé.
- **Wrap Format** (format d'encapsulation) règle la mise en forme des sections (voir [Formats d'encapsulation](#wrap-formats)).
- **Author** (auteur) est un nom de créateur facultatif, utile quand tu partages un preset.

Deux cartes en lecture seule affichent le nombre de **Sections** et de **Groups** (groupes).

### Onglet Prompts

- **Conversation Mode** est un champ de texte pour le prompt Conversation de ce preset. Laisse-le vide pour utiliser le prompt intégré.
- **Roleplay Mode** n'est pas modifiable ici. Le Roleplay utilise le prompt assemblé à partir de tes **Sections**.
- **Game Mode** est un champ de texte pour le prompt Game de ce preset. Laisse-le vide pour utiliser le prompt intégré.

Le **Marinara's Universal Preset** intégré fournit le texte du prompt, mais aucun paramètre de génération. Ses anciens réglages enregistrés d'échantillonnage, de raisonnement, de mise en forme et de tokens sont ignorés : ce sont les réglages de ton compte, les remplacements du chat et les valeurs par défaut de l'application qui s'appliquent. Crée une copie modifiable pour le personnaliser.

## Sections et marqueurs

L'onglet **Sections** est l'endroit où tu construis le prompt. Les sections s'assemblent de haut en bas.

1. Clique sur **Add Section** (ajouter une section).
2. Choisis **Prompt Block** (bloc de prompt) ou un marqueur.

Un **Prompt Block** est un texte que tu écris : instructions système, règles de ton, tout ce que tu veux voir dans chaque prompt. Un marqueur n'a pas de texte propre. Marinara le remplit avec le contenu réel du chat au moment d'envoyer le prompt.

| Marqueur | Ce qu'il insère |
| --- | --- |
| **Character Info** | Les détails de la fiche de personnage active. |
| **Persona** | Les détails de ton persona actif. |
| **Chat History** | Les messages du chat. |
| **Chat Summary** | Le résumé compilé du chat. |
| **Dialogue Examples** | Les exemples de dialogue du personnage. |
| **Lorebook Marker (All)** | Toutes les entrées de lorebook actives. |
| **Lorebook Marker (Before)** | Les entrées de lorebook réglées pour s'insérer avant. |
| **Lorebook Marker (After)** | Les entrées de lorebook réglées pour s'insérer après. |

Une ligne de marqueur affiche un badge **MARKER**. Tu ne peux pas écrire dans la plupart des marqueurs. Utilise **Lorebook Marker (All)**, sauf si tu veux répartir les entrées de lorebook entre avant et après.

Trois marqueurs plus rares :

- **Current Scene Summary** (résumé de la scène en cours) et **Recalled Scenes** (scènes rappelées) placent les résumés produits par Advanced Memory Recall. Sans marqueur **Recalled Scenes**, ils apparaissent avant l'historique du chat. Voir [Mémoire](../agents/memory.md).
- **ID Macro Cards** place les fiches de personnage que tu fais entrer dans un prompt en tapant l'identifiant de fiche d'un personnage entre doubles accolades. Sans ce marqueur, elles vont à l'emplacement par défaut. Voir [Macros de prompt](macros.md).

Sans marqueur **Dialogue Examples** activé, les exemples de dialogue non vides sont ajoutés à **Character Info**, après le scénario, dans le format d'encapsulation du preset. Ajoute le marqueur pour choisir leur emplacement. Marinara ne les inclut jamais deux fois.

Si ton chat a des lorebooks actifs mais que le preset n'a aucun marqueur de lorebook, un avertissement indique : "Add a lorebook marker when this preset should receive active lorebook entries." Ajoutes-en un pour que les entrées parviennent au modèle. Voir [Vue d'ensemble des lorebooks](../lorebooks/overview.md).

Si tu as des agents personnalisés avec l'option "inject as section" activée, le menu d'ajout affiche **Agent Sections** (sections d'agent). Chacune insère la dernière sortie de son agent, et tu peux ajouter tes propres instructions autour.

### Modifier une section

1. Clique sur le nom ou sur la flèche d'une section pour la déplier.
2. Change son **Name** ou son rôle (**System**, **User** ou **Assistant**).
3. Pour un **Prompt Block**, modifie **Content** (contenu). Il accepte les [macros](macros.md), des espaces réservés que Marinara remplace par du vrai texte.
4. Clique sur **Save** en haut à droite.

Les contrôles de la ligne :

- **Duplicate** (dupliquer) copie la section.
- L'icône en forme d'œil l'active ou la désactive.
- **Delete** (supprimer) la supprime.
- Pour réordonner, fais glisser la poignée, utilise les flèches haut et bas, ou fais un appui long sur un écran tactile.

### Groupes

Un groupe réunit plusieurs sections dans un même conteneur.

1. Dans l'onglet **Sections**, clique sur **Groups**, puis sur **New Group** (nouveau groupe).
2. Clique sur le nom du groupe pour le renommer.
3. Déplie une section et choisis le groupe dans son menu déroulant **Group**.

Avec **XML**, un groupe devient une seule balise parente. Avec **MARKDOWN**, il devient un seul titre. Supprimer un groupe ne supprime pas ses sections. Elles perdent seulement leur groupe.

### Position et profondeur

Chaque section a un réglage **Position** dans son éditeur.

- **Ordered (in sequence)** place la section là où elle se trouve dans la liste. C'est le choix habituel.
- **Depth (from end of chat)** la place un certain nombre de messages avant la fin du chat, selon le nombre **Depth** (profondeur). Une profondeur de 0 la place après le dernier message. Sers-t'en pour les rappels que le modèle doit voir près des messages les plus récents.

<a id="wrap-formats"></a>

## Formats d'encapsulation

Le réglage **Wrap Format** de l'onglet **Overview** détermine la façon dont chaque section est encapsulée.

| Format | Résultat |
| --- | --- |
| **XML** | Chaque section est entourée de balises. Les groupes deviennent des balises parentes. C'est la valeur par défaut. |
| **MARKDOWN** | Chaque section reçoit un titre. Les groupes deviennent des titres de niveau supérieur. |
| **NONE** | Aucune encapsulation. Le contenu part tel qu'il est écrit. |

XML convient à la plupart des modèles. N'essaie les autres que si un modèle répond mieux sans balises.

Pour envoyer un seul **Prompt Block** sans sa balise ni son titre, déplie-le et active **Send without wrapper** (envoyer sans encapsulation). La balise d'un groupe peut quand même l'entourer : retire le bloc de son groupe pour l'envoyer sans aucune encapsulation. Les marqueurs gardent toujours leur encapsulation, et l'interrupteur est masqué quand le format est **NONE**.

<a id="conversation-and-game-chats"></a>

## Les chats Conversation et Game

Ces chats ne construisent pas de prompt à partir des Sections. Ils utilisent un seul prompt de mode. Dans **Chat Settings**, la section **Prompt Preset** a un menu déroulant **Prompt source** (source du prompt) qui liste tes presets. Il démarre sur **Default conversation prompt** ou **Default game prompt**, ou indique **No presets available** quand tu n'en as aucun. Dans le panneau **Presets**, le bouton d'attribution affiche "Prompt presets are not available in conversation mode."

Sous le menu déroulant, un badge indique d'où vient le prompt.

| Badge | Signification |
| --- | --- |
| **Default** | Le prompt intégré. |
| **Preset** | Le prompt du preset choisi. |
| **Style** | Le prompt du style de prompt du GM (le maître du jeu) sélectionné. Chats Game uniquement. |
| **Custom** | Une modification locale, pour ce chat uniquement. Elle l'emporte sur toutes les autres. |

Le champ de texte montre le prompt utilisé. Modifie-le pour créer une copie locale au chat. Si ton texte correspond exactement au preset ou au prompt par défaut, Marinara considère qu'il n'est pas personnalisé. Tant qu'une modification personnalisée existe, une icône de réinitialisation apparaît (infobulle **Reset to default prompt**).

Les chats Game ajoutent deux contrôles. **GM prompt style** (style de prompt du GM) ne remplace que le prompt Game, et une modification locale au chat l'emporte toujours. **Extra instructions** (instructions supplémentaires) ajoute du texte au prompt Game, jusqu'à 2 000 caractères, par exemple "Write in the style of Terry Pratchett."

<a id="decision-blocks-and-prompt-caching"></a>

## Blocs de décision et cache de prompts

Une section peut contenir un bloc de décision, `{{#if decision:"..."}}`, pour que cette partie ne soit envoyée que si un énoncé sur le chat est vrai. Voir [Interroger le modèle de décision](conditional-prompts.md#asking-the-decision-model).

Place les blocs de décision qui changent souvent vers la fin du prompt, par exemple dans les instructions après l'historique. Une branche modifiée peut empêcher un fournisseur de réutiliser le prompt à partir de ce point : un changement placé tôt fait donc perdre l'essentiel des économies de cache. Une partie antérieure inchangée peut encore être réutilisée. Ne garde une décision vers le haut que si sa réponse change rarement. Voir [Cache de prompts](conditional-prompts.md#prompt-caching).

Les énoncés des sections et des groupes désactivés ne sont jamais interrogés et ne comptent pas dans **Decision statements per turn** (énoncés de décision par tour).

## Vérifier ce que l'IA a reçu

**Peek Prompt** montre le prompt entièrement assemblé pour un message. C'est le moyen le plus rapide de comprendre une réponse étrange. Voir [Peek Prompt : voir ce que l'IA a reçu](../chats/peek-prompt.md).

## Guides associés

- [Variables de preset](preset-variables.md)
- [Macros de prompt](macros.md)
- [Paramètres de génération](generation-parameters.md)
- [Profils de réglages](../chats/settings-profiles.md)
- [Vue d'ensemble des Chat Settings](../chats/chat-settings.md)
- [Peek Prompt : voir ce que l'IA a reçu](../chats/peek-prompt.md)
