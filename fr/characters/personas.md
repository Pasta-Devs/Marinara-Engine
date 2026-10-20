# Personas utilisateur : créer et modifier

Ce guide explique ce qu'est un persona, comment en créer un et le modifier, puis comment importer, exporter, dupliquer et supprimer des personas. Un persona, c'est ta propre fiche de personnage : l'identité que Marinara Engine utilise pour te représenter dans un chat.

## Ce qu'est un persona

Un persona, c'est qui tu es dans un chat. Il a un nom, une description et d'autres détails facultatifs. Marinara insère ces détails dans chaque prompt – le texte que Marinara envoie à l'IA – pour que l'IA sache à qui elle parle.

Tu peux créer plusieurs personas et les ranger dans le panneau **Personas** (personas). Choisis le persona à utiliser dans chaque chat, ou choisis **None** (aucun) pour ne pas en utiliser. Ce guide explique comment créer et modifier des personas. Pour savoir comment choisir le persona utilisé par un chat, consulte [Choisir ton persona dans un chat](choosing-your-persona.md).

### La macro {{user}}

Une macro est un espace réservé dans ton texte, que l'application remplace par une vraie valeur avant d'envoyer le prompt. La macro **{{user}}** est remplacée par le nom du persona utilisé par le chat : celui sélectionné pour ce chat. Par exemple, si ce persona s'appelle Alex, **{{user}}** devient Alex dans le prompt.

Si aucun persona n'est sélectionné pour le chat, l'IA t'appelle par le nom générique "User", et aucun détail de persona n'est envoyé. Pour savoir comment un chat choisit son persona, consulte [Choisir ton persona dans un chat](choosing-your-persona.md). Pour en savoir plus sur les macros, consulte [Macros](../prompts/macros.md).

## Le panneau Personas

Le panneau **Personas** est ta bibliothèque de personas. Ouvre-le depuis l'icône en forme de personne, dans la barre supérieure de la barre latérale droite. Il voisine avec les boutons **Lorebooks**, **Presets**, **Connections** et **Agents**.

Le panneau propose les contrôles suivants :

- Le bouton **Download** (télécharger) ouvre le [Card Browser](bot-browser.md), où tu trouves aussi des personas sur PlotLight.
- Le bouton **Open Library** (ouvrir la bibliothèque) ouvre la Persona Library en pleine page, qui s'adapte à la taille de l'écran. Elle reprend la disposition en grille avec aperçu de la Character Library : descriptions des personas, sections de la fiche, tags et estimations de tokens (un token est un petit morceau de texte).
- Le bouton **New** (nouveau) crée un persona.
- Le bouton **Import** (importer) ouvre la fenêtre **Import Persona**.
- Le bouton **Select** (sélectionner) active le mode sélection multiple, pour agir sur plusieurs personas à la fois.
- Le champ de recherche, dont le texte indicatif est **Search personas**, cherche dans le nom, la description, le commentaire et les tags.
- Le menu déroulant de tri propose **Manual order** (ordre manuel), **A-Z**, **Z-A**, **Newest**, **Oldest** et **Tokens** (taille estimée du prompt). **Manual order** garde l'ordre que tu as défini : fais glisser une ligne vers le haut ou vers le bas, ou appuie sur Alt+Up ou Alt+Down sur une ligne sélectionnée. Sur écran tactile, appuie longuement sur une ligne pour la saisir.
- Le bouton **New Folder** (nouveau dossier) crée un dossier pour organiser les personas.
- La pastille **Tags** déploie la liste des tags pour filtrer.

Chaque ligne affiche l'avatar du persona, son nom et un court aperçu de la description. Au survol d'une ligne, les actions **Duplicate** (dupliquer) et **Delete** (supprimer) apparaissent. Clique sur une ligne pour ouvrir ce persona dans le **Persona Editor** (éditeur de persona) en pleine page.

Si tes personas sont trop nombreux pour tenir sur une page, un bouton **Load more** (charger plus) apparaît en bas. Tant qu'aucun persona n'existe, le panneau affiche un court message "No personas yet".

## Créer un persona

1. Ouvre le panneau **Personas**.
2. Clique sur **New**. La fenêtre **Create Persona** s'ouvre.
3. Saisis un nom dans le champ **Name**. C'est le seul champ obligatoire.
4. Clique sur **Create** (créer).

Le persona est créé avec une description vide. Il s'ouvre aussitôt dans le **Persona Editor** complet, où tu remplis le reste. La fenêtre de création n'accepte aucun autre champ : tout le reste se modifie ensuite dans le **Persona Editor**.

Après avoir créé un persona, sélectionne-le dans le chat où tu veux l'utiliser.

## Le Persona Editor

Quand tu ouvres un persona, le **Persona Editor** en pleine page remplace la zone de chat. L'en-tête contient :

- Une flèche **Back** (retour) pour fermer l'éditeur.
- La tuile d'avatar. Clique dessus pour téléverser un nouvel avatar. Si une connexion de génération d'images est configurée, un bouton baguette magique **Generate avatar** (générer un avatar) apparaît aussi ici.
- Le champ de nom et un champ de commentaire (pour une courte note, par exemple "Modern AU version").
- Un bouton **Save** (enregistrer). Il reste grisé tant que rien n'a changé.
- Des actions en icônes dans l'en-tête : **Export persona** (exporter le persona), **Add persona as character** (ajouter le persona comme personnage), **Duplicate persona** (dupliquer le persona) et **Delete persona** (supprimer le persona).

Si tu quittes l'éditeur avec des modifications non enregistrées, un bandeau affiche "You have unsaved changes. Close without saving?". Il propose **Keep editing** (continuer à modifier), **Discard & close** (abandonner et fermer) et **Save & close** (enregistrer et fermer).

Le corps de l'éditeur présente une rangée d'onglets, dans cet ordre : **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors** et **Stats**.

### Onglet Metadata

L'onglet **Metadata** (métadonnées) rassemble les informations d'identité et de bibliothèque :

- Une ligne **Persona ID** avec un bouton **Copy** (copier). La plupart des gens n'en ont jamais besoin : c'est utile pour une demande d'assistance.
- Le widget de recadrage de l'avatar. Fais glisser pour repositionner le cadre rond de l'avatar ou pour zoomer.
- **Name** (nom) : le nom affiché du persona. Marinara l'insère dans les prompts comme ton identité.
- **Creator** (créateur) : qui a fait ce persona, pour le créditer quand tu le partages.
- **Phonetic name** (nom phonétique) : une prononciation de remplacement, facultative. Elle sert uniquement quand le nom du persona est lu à voix haute par le Text to Speech (TTS). Le TTS, ou synthèse vocale, est la fonction de l'application qui lit le texte à voix haute.
- **Title / Comment** (titre / commentaire) : une courte note privée, affichée sous le nom dans la bibliothèque.
- **Version** : un texte libre pour suivre tes propres modifications. Sa valeur par défaut est **1.0**.
- **Tags** : des étiquettes en texte libre. Appuie sur Enter ou clique sur **Add** (ajouter) pour en ajouter une. Un bouton **Remove All** (tout supprimer) apparaît dès que des tags existent. Les tags servent aux filtres du panneau **Personas**.
- **Creator Notes** (notes du créateur) : une note privée sur plusieurs lignes. Marinara ne l'envoie pas à l'IA.

Le panneau **Version history** (historique des versions) se trouve sous le champ **Version**. La section "Historique des versions", plus bas, explique son fonctionnement.

### Onglet Card

L'onglet **Card** (fiche) accueille les champs principaux du persona. Chaque champ est une grande zone de texte, sous laquelle s'affiche en direct une estimation du nombre de tokens. Une barre de liens rapides permet de sauter à chaque section.

- **Description** : ton identité générale et ton rôle. Marinara l'envoie dans chaque prompt pour que l'IA sache qui tu es.
- **Personality** (personnalité) : ton tempérament, ton comportement, tes façons de parler et tes réactions émotionnelles.
- **Backstory** (passé) : ton histoire, tes origines, tes relations et les événements qui t'ont façonné.
- **Appearance** (apparence) : description physique, vêtements et détails visuels que le modèle doit retenir.
- **Image Appearance Override** (apparence propre aux images) : un interrupteur facultatif sous **Appearance**, désactivé par défaut. Active-le pour afficher un second champ où tu peux décrire ton persona avec de courts tags d'image, comme le mot déclencheur d'un LoRA. S'il est activé et que le champ contient du texte, les prompts d'image utilisent ces tags tels quels, **Appearance** servant de contexte. Le narrateur reçoit toujours le texte complet d'**Appearance**.
- **Scenario** (scénario) : ta situation ou ton contexte par défaut pour les roleplays. Sers-t'en pour poser le point de départ du persona.

Ces zones de texte acceptent les macros. Les guillemets que tu saisis sont reformatés automatiquement selon le style de guillemets réglé dans l'application.

### Onglet Convo

L'onglet **Convo** contient des champs qui ne s'appliquent qu'au mode Conversation. Ils ne sont jamais envoyés en mode Roleplay ni en Game Mode. On y trouve **Convo Display Name**, **About Me** et **Convo Behavior**. Comme ces champs sont partagés avec les personnages, ils ont leur propre guide. Consulte [Profils du mode Conversation](../conversation/profiles.md).

### Onglet Lorebook

L'onglet **Lorebook** permet de rattacher des entrées de lorebook à ton persona. Un lorebook – un recueil de faits sur ton univers – regroupe des entrées World Info qui ajoutent du contexte quand elles sont pertinentes. Les entrées liées à un persona peuvent se déclencher quand ce persona est dans le chat. Consulte [Vue d'ensemble des lorebooks](../lorebooks/overview.md).

### Onglet Sprites

L'onglet **Sprites** permet de téléverser des illustrations de personnage en pied pour ton persona. Un sprite est l'image du personnage affichée sur le plateau ; les sprites servent en Game Mode et en Roleplay. L'onglet propose des onglets de catégorie : **Facial Expressions**, **Full-body** et **Clips**. Téléverse une image à la fois, ou utilise **Upload Folder** (téléverser un dossier) pour importer en bloc un dossier d'images PNG. Comme les sprites forment un système partagé, consulte [Sprites de personnage](sprites.md) pour tous les détails.

### Onglet Gallery

L'onglet **Gallery** conserve les illustrations et vidéos de référence attachées à ton persona. Il comporte deux sous-onglets, **Images** et **Videos**. Utilise **Upload Persona Images** (téléverser des images de persona) ou **Upload Persona Videos** (téléverser des vidéos de persona) pour ajouter des fichiers. Le sous-onglet **Videos** gère aussi les clips d'appel vidéo de la fonction d'appel du mode Conversation. Consulte [Galeries de personnages et de personas](galleries.md).

### Onglet Colors

L'onglet **Colors** (couleurs) définit l'apparence de ton persona dans le chat. Les couleurs s'appliquent au nom, aux dialogues et à la bulle de message.

- Le bouton **Extract Colors from Avatar** (extraire les couleurs de l'avatar) choisit automatiquement les couleurs à partir de l'image d'avatar. Il reste grisé, avec la mention "Upload an avatar first", tant qu'aucun avatar n'existe.
- Le champ **Name Display Color** règle la couleur du nom du persona. Il accepte les dégradés CSS.
- Le champ **Dialogue Highlight Color** règle la couleur du texte placé entre guillemets.
- Le champ **Message Box Color** règle la couleur d'arrière-plan de la bulle de chat du persona.

Laisse l'un de ces champs vide pour garder les couleurs par défaut du thème de l'application. Pour un tour d'horizon complet des couleurs et des caractéristiques, consulte [Couleurs de personnage et caractéristiques RPG](colors-and-stats.md).

### Onglet Stats

L'onglet **Stats** comporte deux blocs distincts. Tous deux alimentent l'affichage des caractéristiques à l'écran, le HUD, ce bandeau d'infos en haut du chat.

- L'interrupteur **Enable Persona Stats** (activer les caractéristiques du persona) affiche des barres d'état pour des besoins comme la faim, l'énergie et l'humeur. À la première activation, tu obtiens des barres de départ : Satiety, Energy, Hygiene et Mood, chacune à 100 sur 100. L'agent **Persona Stats** ajuste ces valeurs au fil de l'histoire.
- L'interrupteur **Enable RPG Attributes** (activer les attributs RPG) active des Pools et des Attributes de type jeu de rôle. À la première activation, tu obtiens des Pools de départ HP et MP à 100 sur 100 et les Attributes de départ STR, DEX, CON, INT, WIS et CHA, chacun à 10. Ces valeurs sont envoyées avec la fiche du persona pour le combat et le Game Mode, ainsi que pour les jets facultatifs en Roleplay ou en Game Mode. Les agents trackers ne les mettent pas à jour.

Quand un ensemble de règles de Game Mode est installé, ou que le persona conserve encore une fiche pour un ensemble de règles que tu n'as plus, un bloc **Ruleset sheets** (fiches d'ensembles de règles) apparaît sous ces deux sections. Il contient la configuration de départ de ton persona pour chaque ensemble de règles, qu'une nouvelle partie sur cet ensemble copie. Voir [Fiches d'ensembles de règles](colors-and-stats.md#ruleset-sheets).

Les valeurs définies ici servent de point de départ par défaut aux nouveaux chats. Les Persona Status Bars peuvent se mettre à jour automatiquement quand l'agent Persona Stats est activé ; les Pools et Attributes RPG du persona ne sont pas gérés par les agents. Pour l'explication complète, consulte [Couleurs de personnage et caractéristiques RPG](colors-and-stats.md).

## Historique des versions

Chaque fois que tu enregistres une modification des champs de fiche d'un persona, Marinara conserve automatiquement un instantané. Le panneau **Version history** de l'onglet **Metadata** liste ces versions enregistrées avec leur horodatage.

Pour chaque version enregistrée, tu peux :

1. Cliquer sur son titre pour ouvrir une comparaison avec le persona actuel.
2. Cliquer sur **Rename this saved version** (renommer cette version enregistrée), l'icône crayon, pour corriger son étiquette de version de fiche sans la restaurer.
3. Cliquer sur **Restore this version** (restaurer cette version) pour écraser le persona actuel avec cette version enregistrée. Une boîte de dialogue te demande de confirmer.
4. Cliquer sur **Delete this saved version** (supprimer cette version enregistrée) pour retirer cette entrée de l'historique. Le persona actuel reste inchangé.

Avant ta première modification, le panneau affiche "Previous persona states will appear here after the next edit.".

Le bouton **Reset** (réinitialiser), dans l'en-tête du panneau, supprime tous les instantanés enregistrés du persona et remet la version de fiche actuelle à `0.0`. Marinara demande confirmation, car l'historique supprimé est irrécupérable.

## Dupliquer un persona

Clique sur **Duplicate** dans la ligne d'un persona, ou sur l'icône **Duplicate persona** dans l'en-tête du **Persona Editor**. Marinara crée une copie complète du persona, nommée "{original name} (Copy)". Tous les champs de fiche, les couleurs, les caractéristiques et les champs Convo sont copiés. Dupliquer un persona ne change le persona sélectionné d'aucun chat.

## Supprimer des personas

Pour supprimer un persona, clique sur l'icône corbeille de sa ligne, ou sur l'icône **Delete persona** dans l'en-tête du **Persona Editor**. Une boîte de dialogue de confirmation s'affiche. La suppression d'un persona est définitive.

Pour en supprimer plusieurs d'un coup, clique sur **Select** dans le panneau **Personas** et coche les personas voulus. Utilise ensuite la barre de sélection pour les supprimer avec **Delete**. Si une suppression échoue, les éléments concernés restent sélectionnés pour que tu puisses réessayer.

## Importer et exporter des personas

### Import

Clique sur **Import** dans le panneau **Personas** pour ouvrir la fenêtre **Import Persona**. Fais glisser des fichiers dedans, ou clique pour les parcourir. Plusieurs fichiers s'importent en une fois. Deux types de fichiers sont acceptés :

- Les fichiers de paquet natif **.marinara**. Ils restaurent l'intégralité des détails du persona, les sprites et la structure de la galerie.
- Les fichiers **.json**. Un export JSON de Marinara s'importe intégralement. Un fichier JSON générique venu d'un autre outil est transposé champ par champ dans un nouveau persona. Le nom est obligatoire. Les autres champs reconnus sont repris quand ils sont présents.

Chaque fichier affiche une icône de réussite ou d'échec, accompagnée d'un message. Une ligne de synthèse indique combien d'imports ont réussi et combien ont échoué.

### Export

L'export part de l'icône **Export persona** du **Persona Editor**, ou de l'action groupée **Export** (exporter) en mode sélection dans le panneau. La fenêtre **Export Persona** propose deux formats :

- **Marinara Native** : conserve tous les détails du persona propres à Marinara, les sprites et les lorebooks attachés. Ce format sert à déplacer un persona d'une installation de Marinara à une autre.
- **Compatible JSON** : n'exporte que les champs de persona simples. Ce format sert pour les autres outils, qui ne comprennent pas le format de Marinara.

Un export groupé télécharge un seul fichier zip, contenant un fichier par persona sélectionné.

## Ajouter un persona comme personnage

L'en-tête du **Persona Editor** comporte une icône **Add persona as character**. Elle crée une nouvelle fiche de personnage dans ta bibliothèque Characters. La nouvelle fiche reprend le nom, la description, la personnalité, le scénario, le passé, l'apparence, les tags, le créateur, la version et l'avatar du persona.

Pratique quand tu veux plutôt jouer un ancien persona en tant que personnage. Le persona d'origine n'est ni supprimé ni modifié. Pour tout savoir sur la modification des personnages, consulte [Créer et modifier des personnages](creating-and-editing-characters.md).

## Guides associés

- [Choisir ton persona dans un chat](choosing-your-persona.md)
- [Couleurs de personnage et caractéristiques RPG](colors-and-stats.md)
- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Profils du mode Conversation](../conversation/profiles.md)
- [Macros](../prompts/macros.md)
