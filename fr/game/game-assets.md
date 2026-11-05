# Ressources de jeu : musique, sons, sprites et arrière-plans

Les ressources de jeu sont les fichiers multimédias que Game Mode joue et affiche : musique, sons, illustrations de personnages et arrière-plans de scène. Ce guide montre comment utiliser le lot de départ, téléverser tes propres fichiers dans le panneau **Asset Browser** (explorateur de ressources), limiter les ressources qu'une partie peut utiliser et générer des effets sonores et de la musique.

Game Mode lit cette bibliothèque tout seul. Il choisit la musique, les sons d'ambiance et les arrière-plans selon la scène : tu n'as donc rien à attribuer à la main en cours de partie.

| Catégorie | Ce que c'est |
| --- | --- |
| **Music** (musique) | Les musiques de fond, qui changent selon la scène. |
| **Ambient** (ambiance) | Les sons d'environnement en boucle, par exemple la nature, la ville ou les intérieurs. |
| **Sound Effects** (effets sonores, SFX) | Les sons courts des menus, des combats et de l'exploration. |
| **Sprites** | Les illustrations de personnages et d'objets affichées à l'écran. |
| **Backgrounds** (arrière-plans) | Les images de scène affichées derrière l'histoire. |

## Le lot de départ

Marinara installe une bibliothèque de départ gratuite au premier démarrage du serveur, et l'actualise aux démarrages suivants si le lot fourni change. Elle contient :

- Cinq pistes **Music**, pour différentes ambiances de scène.
- Des boucles **Ambient** dans les dossiers `nature`, `urban` et `interior`.
- Des **Sound Effects** pour les menus, les combats et l'exploration.

Les dossiers **Backgrounds** et **Sprites** du panneau Asset Browser sont vides au départ. Aucun sprite de personnage n'est fourni : ajoute des illustrations adaptées à tes propres parties. Pour les arrière-plans, Game Mode puise aussi dans la bibliothèque d'arrière-plans de l'application elle-même. Sur une nouvelle installation, elle contient 13 images de départ plus un simple `Black.jpg`, et les parties peuvent les utiliser sans aucun téléversement. Si ce dossier contenait déjà des images, seul `Black.jpg` est restauré. Les illustrations de scène générées et tes téléversements s'y ajoutent.

Tout l'audio fourni est sous licence CC0 (domaine public, libre d'utilisation). Le crédit de chaque fichier figure dans un fichier `CREDITS.md` livré avec les ressources sur le disque. Il ne s'affiche pas dans l'application.

Les fichiers et dossiers fournis sont protégés. Tu ne peux ni les supprimer ni les déplacer dans le panneau **Asset Browser**, mais tu peux les renommer ou les copier.

## Ouvrir le panneau Asset Browser

Le panneau **Asset Browser** est un gestionnaire de fichiers pour les ressources de jeu. Ouvre-le depuis **Settings** (Paramètres) :

1. Ouvre **Settings**.
2. Va dans l'onglet **Imports**.
3. Repère **Game Assets** (ressources de jeu) et clique sur **Asset Browser**.

Ou ouvre-le depuis une partie :

1. Ouvre un chat en Game Mode.
2. Clique ou appuie sur le bouton **Game Assets** (l'icône de dossier), près du coin supérieur droit du chat. Tu peux le faire glisser ailleurs, sur ordinateur comme sur téléphone.

Le bouton n'apparaît que dans les chats en Game Mode. Il ouvre **Game Assets**, avec le panneau **Asset Browser** à l'intérieur : une fenêtre déplaçable sur ordinateur, ou un panneau sur toute la largeur sur téléphone. Si tu l'as déplacé avec **Put back in Chat Settings** (remettre dans les réglages du chat), ouvre plutôt la section **Game Assets** dans Chat Settings.

La barre d'outils affiche un fil d'Ariane qui commence à **Game Assets**, un interrupteur entre **Grid view** (vue en grille) et **List view** (vue en liste), **Upload** (téléverser), **New** (nouveau), **Rescan** (réanalyser), **Open in system folder** (ouvrir dans le dossier système) et un champ **Search in folder** (chercher dans le dossier). Sur les écrans larges, une arborescence de dossiers à gauche t'aide à passer d'une catégorie à l'autre.

## Téléverser tes propres ressources

Marinara vérifie chaque téléversement selon les règles de [Types et tailles de fichiers](#file-types-and-sizes). Utilise l'une ou l'autre méthode.

### Téléverser depuis le panneau Asset Browser

1. Ouvre le panneau **Asset Browser**.
2. Ouvre l'un des cinq dossiers de catégorie, ou l'un de ses sous-dossiers.
3. Clique sur **Upload** et choisis des fichiers, ou fais glisser des fichiers sur la zone de fichiers.

Tu dois te trouver dans un dossier de catégorie. Si tu déposes des fichiers à la racine, l'application te demande d'abord d'en ouvrir un.

### Téléverser depuis Settings

1. Ouvre **Settings** et va dans l'onglet **Imports**.
2. Dans **Game Assets**, choisis une catégorie dans le menu **Type** : **Music**, **Ambient**, **Sound Effects**, **Sprites** ou **Backgrounds**.
3. Indique la destination dans le champ **Folder** (dossier), ou garde la valeur par défaut.
4. Clique sur **Choose Files** (choisir des fichiers) et sélectionne tes fichiers.
5. Clique sur **Upload to Server** (téléverser sur le serveur).

Si ça n'a pas marché, le message d'erreur énumère les types de fichiers acceptés pour cette catégorie. Pour la musique, vérifie le chemin du dossier (voir [La règle des dossiers de musique](#the-music-folder-rule)).

Valeurs par défaut du champ **Folder** :

| Type | Dossier par défaut |
| --- | --- |
| **Music** | `exploration/fantasy/calm` |
| **Ambient** | `nature` |
| **Sound Effects** | `exploration` |
| **Sprites** | `generic-fantasy` |
| **Backgrounds** | `custom` |

<a id="file-types-and-sizes"></a>

### Types et tailles de fichiers

| Catégorie | Types de fichiers acceptés |
| --- | --- |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM |
| Sprites | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds | PNG, JPG, JPEG, GIF, WebP, AVIF |

Les fichiers audio et image peuvent peser jusqu'à 50 Mo chacun. Les fichiers texte, jusqu'à 10 Mo.

<a id="the-music-folder-rule"></a>

### La règle des dossiers de musique

Chaque piste de musique doit se trouver dans un chemin à trois niveaux, `state/genre/intensity`, par exemple `exploration/fantasy/calm`. Si le chemin ne correspond pas, le téléversement échoue. C'est grâce à cette organisation que Game Mode sait quand jouer chaque piste.

- State : `exploration`, `dialogue`, `combat`, `travel_rest`.
- Genre : `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom`, ou la famille d'un univers (voir plus bas), comme `wuxia`.
- Intensity : `calm`, `tense`, `intense`.

Les dossiers d'ambiance, d'effets sonores, de sprites et d'arrière-plans n'ont pas cette règle. Nomme leurs sous-dossiers comme tu veux.

## Organiser tes ressources

Sur ordinateur, fais un clic droit sur un fichier ou un dossier, ou passe par son menu "...", pour voir ses actions.

| Action sur un fichier | Effet |
| --- | --- |
| **Rename** (renommer) | Échoue si le nom est déjà pris dans ce dossier. |
| **Move** (déplacer), **Copy** (copier) | Envoie le fichier vers un autre dossier avec un sélecteur de dossier. |
| **Delete** (supprimer), **Download** (télécharger) | Supprime le fichier, ou l'enregistre sur ton appareil. |

| Action sur un dossier | Effet |
| --- | --- |
| **Create subfolder** (créer un sous-dossier) | Crée un nouveau dossier à l'intérieur. |
| **Open in system folder** | L'affiche dans le gestionnaire de fichiers de ton ordinateur. |
| **Delete folder** (supprimer le dossier) | S'il contient des fichiers, coche d'abord **Delete everything inside** (tout supprimer à l'intérieur). |

**New**, dans la barre d'outils, crée **New folder** (nouveau dossier), **New text file** (nouveau fichier texte) ou **New markdown file** (nouveau fichier Markdown) dans le dossier courant. Pour agir sur plusieurs fichiers, coche leurs cases. Une barre indique combien sont sélectionnés, avec **Select all** (tout sélectionner), **Move**, **Copy** et **Delete**. Les gros dossiers se chargent par parties, avec un bouton **Load more** (charger plus).

Chaque dossier peut porter une courte note. Clique sur le texte de description, ou sur l'indication **Add description...** (ajouter une description), pour en écrire une. Les cinq dossiers de catégorie ont des descriptions fixes.

### Réanalyser après une modification extérieure

Marinara tient une liste interne des ressources pour que Game Mode les retrouve vite. Les téléversements faits dans l'application la mettent à jour automatiquement. Si tu copies des fichiers dans le dossier des ressources de jeu sur ton ordinateur, en dehors de l'application, clique sur **Rescan** pour relire le dossier. **Rescan** se trouve dans la barre d'outils du panneau **Asset Browser** et dans **Game Assets**, sous **Settings**.

### Ouvrir le dossier sur ton ordinateur

**Open in system folder** ne fonctionne que si tu utilises l'application sur l'ordinateur même qui fait tourner le serveur. Depuis un téléphone, une tablette ou un autre ordinateur, l'application t'indique que les dossiers système ne s'ouvrent que depuis l'appareil qui héberge Marinara.

## Choisir les ressources qu'une partie peut utiliser

Un chat en Game Mode peut se limiter à une partie de tes dossiers de ressources, par exemple pour tenir tes musiques joyeuses à l'écart d'une partie d'horreur.

1. Pendant la configuration, déplie **Adjust Game Assets for this Game** (ajuster les ressources de jeu pour cette partie) à l'étape **Features** (fonctionnalités). Pour une partie existante, ouvre la fenêtre **Game Assets** de la partie.
2. Clique sur le bouton **Game assets**. Il affiche alors **Selecting**.
3. Sers-toi du petit contrôle d'état de chaque dossier pour l'inclure ou l'exclure.

Une barre indique "All folders included" ou le nombre de dossiers exclus. **Reset to all** (tout réinclure) inclut de nouveau tous les dossiers. Le choix n'est enregistré que pour ce chat. Il modifie les dossiers dans lesquels Game Mode peut puiser, et ne supprime ni ne masque aucun fichier.

<a id="a-settings-own-art-and-music"></a>

### Les visuels et la musique propres à un univers

Une partie lancée avec un kit d'univers a une famille artistique, affichée sous **Art and music** (visuels et musique) quand tu modifies les mots du kit : `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland`, ou une famille propre au kit. La partie utilise les dossiers qui portent le nom de sa famille et tous les dossiers qui ne portent le nom d'aucune famille, et laisse de côté les dossiers des autres familles. Une partie cyberpunk ne joue jamais de musique de bataille fantasy et n'affiche jamais la forêt enchantée. Quand rien ne convient dans sa famille ni dans les dossiers partagés, rien n'est joué, plutôt qu'une piste d'une autre famille. Une partie sans kit d'univers utilise tous les dossiers.

- **Music** : place les pistes de l'univers dans `music/<state>/<family>/<intensity>`, par exemple `combat/wuxia/intense`. Elles passent avant les pistes partagées.
- **Backgrounds** : `backgrounds/<family>`. Les arrière-plans générés dans une partie avec un kit d'univers y sont aussi enregistrés.
- **Sons de combat** : un son placé dans `sfx/combat/<family>` qui porte le même nom qu'un son fourni, comme `sword-swing`, le remplace dans les parties de cette famille. Les sons de combat fournis sont de style fantasy : les combats des autres familles restent donc silencieux tant que tu n'ajoutes pas les leurs.

Les arrière-plans de départ fournis comptent comme partagés, sauf ceux de fantasy (`ancient_library`, `castle_cliff`, `enchanted_forest`) et `city_night`, de la famille modern. Un kit d'univers enregistré avant l'arrivée des familles artistiques fonctionne toujours : un kit créé à partir d'un kit de départ utilise la famille de ce kit de départ, et tout autre kit utilise tous les dossiers jusqu'à ce que tu choisisses une famille sous **Art and music**. La barre de sélection décrite plus haut indique la famille de la partie ouverte.

<a id="generated-sound-effects-and-music"></a>

## Effets sonores et musique générés

Game Mode peut générer des effets sonores et de la musique avec un compte **Music & Sound Effects** (musique et effets sonores). Choisis ElevenLabs, SunoAPI ou un serveur compatible personnalisé. Chaque nouveau son ou nouvelle piste utilise ce compte de service. L'audio fourni reste disponible sans génération.

**Avant de commencer :** tu as besoin d'un compte **Music & Sound Effects**. La fenêtre **Add account** (ajouter un compte) n'a pas de tuile pour lui. Ces comptes proviennent d'une mise à jour ou d'un import (**Import a backup** (importer une sauvegarde) dans **Connections** (connexions)). Consulte la [configuration des fournisseurs et ses limites](../connections/providers-reference.md#music--sound-effects).

1. Dans **Connections**, ouvre le modèle du compte avec **Edit model** (modifier le modèle).
2. Choisis le service, saisis sa clé et sélectionne les modèles de musique et d'effets sonores. La musique SunoAPI nécessite aussi une URL de rappel HTTPS publique. Un serveur personnalisé a besoin des chemins de ses points d'accès.
3. Active **Sound-effect generation** (génération d'effets sonores), **Music generation** (génération de musique) ou les deux.
4. Enregistre le compte. Consulte la [configuration des fournisseurs et ses limites](../connections/providers-reference.md#music--sound-effects).

Active ensuite la génération quand tu crées une partie :

1. À l'étape **Features** de l'assistant de configuration, repère la carte **Game Audio** (audio du jeu).
2. Sous le choix du compte, choisis ton compte ou garde **Use the default Music & Sound Effects account** (utiliser le compte de musique et d'effets sonores par défaut).
3. Laisse **Sound effects** (effets sonores) et **Music** activés, ou désactive celui dont tu ne veux pas.

Chaque interrupteur nécessite que la fonction correspondante soit activée dans le compte choisi. Un compte Audio réservé à la parole n'est pas utilisé pour la génération.

Pendant la partie :

- **Sound effects.** Après les tours du GM (le maître du jeu), Marinara demande au service de courts sons adaptés à la scène.
- **Music.** Marinara compose une piste instrumentale d'environ deux minutes pour chaque lieu que visite l'équipe et pour chaque type de combat, comme un combat de boss. Chaque piste n'est créée qu'une fois, puis réutilisée. La piste d'un nouveau lieu démarre à un changement de scène ultérieur, pour que la musique ne coupe pas en pleine scène. La piste d'un combat arrive en fondu dès qu'elle est prête.

Les sons et pistes générés sont enregistrés avec tes ressources de jeu : le même son n'est donc pas créé deux fois. Si **Music DJ** joue de la musique pour la partie, Game Mode ne génère pas de musique.

## Dossier de musique personnalisé pour Music DJ

**Music DJ** est un agent d'appoint capable de jouer de la musique pendant une partie. Dans son mode Custom, il joue les pistes d'un dossier de ton choix. Quand tu actives **Music DJ** pour un chat, le formulaire de configuration suit la source enregistrée sur l'agent. L'option **Game Assets** affiche un chemin situé dans tes ressources de jeu, par exemple `music` ou `music/combat`. L'option **Folder on this device** (dossier sur cet appareil) affiche le chemin enregistré sur l'appareil du serveur et un bouton **Choose Folder** (choisir un dossier).

L'éditeur complet de **Music DJ** comporte une section **Custom Music Library** (bibliothèque musicale personnalisée). **Use Game Assets music folder** (utiliser le dossier de musique des ressources de jeu) bascule entre deux modes :

- Activé : le champ **Game Assets music folder** lit un dossier situé dans tes ressources de jeu. **Open Folder** (ouvrir le dossier) l'ouvre sur l'ordinateur du serveur.
- Désactivé : **Music folder on this device** joue la musique de n'importe quel dossier de l'ordinateur qui fait tourner le serveur. Clique sur **Select Folder** (sélectionner un dossier), ou colle le chemin.

Choisir un dossier hors de l'application demande un accès privilégié. Sur le même ordinateur que le serveur, cela fonctionne sans réglage supplémentaire. Depuis un autre appareil ou en accès à distance, mets d'abord en place l'accès administrateur. Consulte [Accès à distance](../REMOTE_ACCESS.md). Pour le reste du lecteur de musique, voir [Music DJ](../media/music.md).

## Guides associés

- [Music DJ : Spotify, YouTube et musique locale](../media/music.md)
- [Fournisseurs d'IA pris en charge](../connections/providers-reference.md)
- [Game Mode : premiers pas](getting-started.md)
- [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
