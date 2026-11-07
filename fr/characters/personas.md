# Personas

Un persona est la fiche de personnage qui te représente dans un chat : ton nom, ta description et d'autres détails facultatifs. Marinara les insère dans chaque prompt – le texte que Marinara envoie à l'IA – pour que l'IA sache à qui elle parle. Tu peux garder plusieurs personas et en choisir un par chat. Pour en utiliser un, voir [Choisir ton persona dans un chat](choosing-your-persona.md).

## Créer un persona

1. Clique sur **Personas** dans la barre de navigation supérieure. Si tu ne le vois pas, ouvre d'abord **More** (plus).
2. Clique sur **New** (nouveau). La fenêtre **Create Persona** (créer un persona) s'ouvre.
3. Saisis un nom dans **Name** (nom). C'est le seul champ obligatoire.
4. Clique sur **Create** (créer).

Le persona est créé avec une description vide et s'ouvre dans le Persona Editor (éditeur de persona).

5. Ouvre l'onglet **Card** (fiche) et écris ta **Description** : ton nom, ton apparence et ta façon d'agir.
6. Clique sur **Save** (enregistrer) dans l'en-tête.

Sélectionne-le ensuite dans le chat où tu veux l'utiliser. Voir [Choisir ton persona dans un chat](choosing-your-persona.md).

## Ce que fait un persona

Marinara envoie ton persona à l'IA dans chaque prompt. Choisis **None** (aucun) dans un chat pour n'envoyer aucun persona. Sans persona, l'IA t'appelle "User".

La macro `{{user}}` est un espace réservé. Marinara la remplace par le nom du persona avant d'envoyer le prompt. Si ton persona s'appelle Alex, `{{user}}` devient Alex. Voir [Macros](../prompts/macros.md).

## Le panneau Personas

Le panneau **Personas** est ta bibliothèque de personas. Clique sur une ligne pour ouvrir ce persona dans le Persona Editor.

| Contrôle | Ce qu'il fait |
| --- | --- |
| **Download** (télécharger) | Ouvre le [Card Browser](bot-browser.md), où tu trouves aussi des personas sur PlotLight. |
| **Open Library** (ouvrir la bibliothèque) | Ouvre la Persona Library en pleine page, avec la même grille et le même aperçu que la Character Library. |
| **New** | Crée un persona. |
| **Import** (importer) | Ouvre la fenêtre **Import Persona** (importer un persona). |
| **Select** (sélectionner) | Active le mode sélection, pour supprimer et exporter en bloc. |
| Champ de recherche | Texte indicatif **Search personas/tags** (rechercher des personas/tags). Il cherche dans le nom, la description, le commentaire et les tags. Pour les recherches par tag, voir [Recherche](library-organization.md#search). |
| Menu déroulant de tri | **Manual order** (ordre manuel), **A-Z**, **Z-A**, **Newest**, **Oldest** ou **Tokens** (taille estimée du prompt). |
| **New Folder** (nouveau dossier) | Crée un dossier. |
| **Tags** | Déploie la liste des tags pour filtrer. |

En **Manual order**, fais glisser une ligne, ou appuie sur <kbd>Alt</kbd>+<kbd>Up</kbd> ou <kbd>Alt</kbd>+<kbd>Down</kbd> sur une ligne qui a le focus. Sur écran tactile, appuie longuement sur une ligne pour la saisir. Passe le pointeur sur une ligne pour voir **Duplicate** (dupliquer) et **Delete** (supprimer). Un bouton **Load more** (charger plus) apparaît quand tes personas ne tiennent pas sur une seule page. Sans aucun persona, le panneau affiche **No personas yet**.

## Le Persona Editor

Ouvrir un persona remplace la zone de chat par le Persona Editor en pleine page. L'en-tête contient :

- Une flèche **Back** (retour).
- La tuile d'avatar. Clique dessus pour téléverser une image. Si une connexion de génération d'images est configurée, un bouton baguette peut aussi en générer une.
- Le champ de nom et un champ de commentaire, pour une courte étiquette comme `Modern AU version`.
- **Save**, désactivé tant que tu n'as rien modifié.
- **Export persona** (exporter le persona), **Add persona as character** (ajouter le persona comme personnage), **Duplicate persona** (dupliquer le persona) et **Delete persona** (supprimer le persona).

Quitter l'éditeur enregistre d'abord tes modifications. Si l'enregistrement échoue, l'éditeur reste ouvert avec ton brouillon.

Les onglets sont, dans l'ordre, **Metadata** (métadonnées), **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery** (galerie), **Colors** (couleurs) et **Stats** (caractéristiques). Chaque onglet mène à sa section d'un même long formulaire.

L'éditeur de persona fonctionne comme le [Character Editor](creating-and-editing-characters.md). Les notes ci-dessous couvrent ce qui diffère.

| Onglet | Notes propres aux personas |
| --- | --- |
| **Metadata** | Les informations d'identité et de bibliothèque. Voir la liste sous ce tableau. |
| **Card** | Voir [Onglet Card](#card-tab) plus bas. |
| **Convo** | Des champs utilisés uniquement en mode Conversation. Voir [Profils du mode Conversation](../conversation/profiles.md). |
| **Lorebook** | Rattache des entrées de lorebook qui s'activent quand ce persona est dans le chat. Voir [Vue d'ensemble des lorebooks](../lorebooks/overview.md). |
| **Sprites** | Des illustrations en pied pour le Game Mode et le Roleplay. Comprend **Facial Expressions**, **Full-body** et **Clips**, ainsi que **Upload Folder** (téléverser un dossier). Voir [Sprites de personnage](sprites.md). |
| **Gallery** | Des images et des vidéos de référence, avec **Upload Persona Images** (téléverser des images de persona) et **Upload Persona Videos** (téléverser des vidéos de persona). Voir [Galeries de personnages et de personas](galleries.md). |
| **Colors** | Les couleurs du nom, des dialogues et de la bulle de message. Voir [Couleurs des personnages et caractéristiques narratives](colors-and-stats.md). |
| **Stats** | Les barres d'état et les attributs RPG. Voir [Onglet Stats](#stats-tab) plus bas. |

L'onglet **Metadata** affiche :

- **Persona ID**, avec **Copy** (copier).
- Le recadrage de l'avatar.
- **Name** et **Creator** (créateur).
- **Phonetic name** (nom phonétique), utilisé uniquement quand la synthèse vocale (text-to-speech) lit ton nom.
- **Title / Comment** (titre / commentaire), une courte étiquette.
- **Version**, `1.0` par défaut, avec un interrupteur **Automatic versioning** (gestion automatique des versions).
- **Tags**.
- **Creator Notes** (notes du créateur), jamais envoyées à l'IA.

<a id="card-tab"></a>

### Onglet Card

L'onglet **Card** contient les champs qui te décrivent à l'IA. Chacun affiche en direct une estimation du nombre de tokens (un token est un petit morceau de texte).

| Champ | Quoi écrire | Envoyé à l'IA |
| --- | --- | --- |
| **Summary** (résumé) | Une présentation pour la bibliothèque et les aperçus. | Non |
| **Description** | Ton identité générale et ton rôle. | Dans chaque prompt |
| **Personality** (personnalité) | Tempérament, comportement, façons de parler. | Oui |
| **Backstory** (passé) | Histoire, origines, relations. | Oui |
| **Appearance** (apparence) | Physique, vêtements, détails visuels. | Oui |
| **Scenario** (scénario) | Ta situation par défaut dans les roleplays. | Oui |
| **Example Dialogue** (exemples de dialogue) | Des exemples d'échanges. Sépare-les avec `<START>`. Utilise `{{user}}` pour ton persona et `{{char}}` pour l'autre personnage. | Oui |

**Image Appearance Override** (apparence propre aux images), sous **Appearance**, fonctionne comme pour les personnages. Voir [Onglet Card](creating-and-editing-characters.md#card-tab). Les zones de texte acceptent les macros.

Ces fonctions marchent comme sur les personnages, avec le persona pour sujet :

- Le bouton baguette au-dessus de chaque champ l'écrit pour toi. Voir [Écrire un champ de la fiche avec la baguette](creating-and-editing-characters.md#write-a-card-field-with-the-wand).
- **Add Alternative Field** (ajouter un champ alternatif), sous chaque champ, donne une autre version du champ à certains chats. La liste **Active in** (actif dans) ne montre que les chats qui utilisent ce persona, et les affectations sont suspendues quand un chat choisit un autre persona. Voir [Utiliser un champ alternatif dans certains chats](creating-and-editing-characters.md#use-an-alternative-field-in-selected-chats).
- **Version history** (historique des versions) se trouve dans l'onglet **Metadata**. Avant ta première modification, il affiche `Previous persona states will appear here after the next edit.` **Reset** (réinitialiser) supprime tous les instantanés et remet la version à 1.0. Voir [Historique des versions](creating-and-editing-characters.md#version-history).

<a id="stats-tab"></a>

### Onglet Stats

L'onglet **Stats** comporte deux blocs distincts. Tous deux alimentent le HUD, le panneau de caractéristiques affiché à l'écran pendant un chat.

- **Enable Persona Stats** (activer les caractéristiques du persona) active les barres d'état, des jauges pour des besoins comme la faim et l'humeur. Au départ, il y a Satiety, Energy, Hygiene et Mood, chacune à 100 sur 100. L'agent **Persona Stats** les ajuste au fil de l'histoire.
- **Enable story stats** (activer les caractéristiques narratives) active les Pools (des barres comme HP et MP) et les Attributes (des nombres comme la force). Les deux sont expliqués dans [Couleurs des personnages et caractéristiques narratives](colors-and-stats.md). Au départ, HP et MP sont à 100 sur 100, et STR, DEX, CON, INT, WIS et CHA à 10. Ces valeurs sont envoyées avec le persona pour le combat et le Game Mode, ainsi que pour les jets facultatifs. Les agents ne les mettent pas à jour.

Un bloc **Game Mode Icon** (icône de Game Mode) définit l'image de ton pion dans un combat en Game Mode. Voir [Icône de Game Mode](colors-and-stats.md#game-mode-icon). Quand un ensemble de règles de Game Mode (des règles pour des jeux façon jeu de table) est installé, un bloc **Ruleset sheets** (fiches d'ensembles de règles) contient ta configuration de départ pour cet ensemble. Voir [Fiches d'ensembles de règles](colors-and-stats.md#ruleset-sheets). Les valeurs que tu définis servent de valeurs de départ par défaut pour les nouveaux chats.

## Importer et exporter des personas

Pour importer, clique sur **Import** dans le panneau **Personas**. La fenêtre **Import Persona** accepte les fichiers `.marinara` et `.json`, y compris plusieurs à la fois. Un fichier Marinara restaure l'intégralité des détails, les sprites et la structure de la galerie. Un fichier JSON générique venu d'un autre outil est transposé champ par champ dans un nouveau persona. Le nom est obligatoire. Chaque fichier affiche une marque de réussite ou d'échec.

Pour exporter, clique sur **Export persona** dans l'éditeur, ou utilise **Export** (exporter) en mode sélection. La fenêtre **Export Persona** propose deux formats :

| Format | Ce que tu obtiens |
| --- | --- |
| **Marinara Native** | Tous les détails du persona propres à Marinara, les sprites et les lorebooks attachés. Sers-t'en pour déplacer un persona d'une installation de Marinara à une autre. |
| **Compatible JSON** | Uniquement les champs de persona simples, pour les autres outils. |

Un export groupé télécharge un seul zip, avec un fichier par persona.

## Dupliquer ou supprimer un persona

Pour dupliquer, clique sur **Duplicate** dans une ligne ou sur **Duplicate persona** dans l'éditeur. La copie s'appelle "{original name} (Copy)" et garde tous les champs de fiche, les couleurs, les caractéristiques et les champs Convo. Aucun chat ne change de persona.

Pour supprimer, clique sur **Delete** dans une ligne ou sur **Delete persona** dans l'éditeur, puis confirme. Tu ne peux pas annuler la suppression. Pour en supprimer plusieurs, clique sur **Select**, coche les personas et utilise **Delete** dans la barre de sélection. Si une suppression échoue, ces personas restent sélectionnés pour que tu puisses réessayer.

## Ajouter un persona comme personnage

**Add persona as character**, dans l'en-tête de l'éditeur, crée une nouvelle fiche parmi tes personnages. Elle reprend le nom, la description, la personnalité, le scénario, le passé, l'apparence, les tags, le créateur, la version et l'avatar. Le persona reste tel quel. Pour modifier la nouvelle fiche, voir [Créer et modifier des personnages](creating-and-editing-characters.md).

## Guides associés

- [Choisir ton persona dans un chat](choosing-your-persona.md)
- [Couleurs des personnages et caractéristiques narratives](colors-and-stats.md)
- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Profils du mode Conversation](../conversation/profiles.md)
- [Macros](../prompts/macros.md)
