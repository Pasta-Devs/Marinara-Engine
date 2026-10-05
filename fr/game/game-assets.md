# Ressources de jeu : musique, sons, sprites et arrière-plans

Ce guide explique la bibliothèque de ressources de jeu dans laquelle Game Mode puise sa musique, ses sons, ses illustrations de personnages et ses arrière-plans de scène. Au programme : le lot de départ fourni avec Marinara, le gestionnaire de fichiers **Asset Browser** (explorateur de ressources), l'envoi de tes propres fichiers et le choix des ressources autorisées pour chaque partie.

## À quoi servent les ressources de jeu

Les ressources de jeu sont les fichiers multimédias que Game Mode joue et affiche pendant une session. Marinara Engine les range en cinq catégories :

- **Music** : les musiques d'ambiance, qui changent selon la scène.
- **Ambient** : les sons d'environnement en boucle, par exemple la nature, la ville ou les intérieurs.
- **Sound Effects** (aussi appelés SFX) : les sons courts des menus, des combats et de l'exploration.
- **Sprites** : les illustrations de personnages et d'objets affichées à l'écran.
- **Backgrounds** : les images de scène affichées derrière l'histoire.

Game Mode lit cette bibliothèque tout seul. Il choisit la musique, les sons d'ambiance et les arrière-plans automatiquement selon la scène : tu n'as donc rien à attribuer à la main en cours de partie.

## Le lot de départ fourni

Marinara installe une bibliothèque de départ gratuite au premier démarrage du serveur. Aux démarrages suivants, ces fichiers sont rafraîchis si le lot fourni a changé. Le lot de départ contient :

- Cinq pistes **Music**, une par ambiance de scène.
- Une série de boucles **Ambient** réparties dans des dossiers nature, urbain et intérieur.
- Des **Sound Effects** pour les menus, les combats et l'exploration.

Aucun **Backgrounds** n'est fourni. Les dossiers d'arrière-plans sont vides au départ. Ils ne se remplissent qu'avec les images que tu envoies ou avec les illustrations de scène générées par Game Mode.
Aucun **Sprites** de personnage n'est fourni non plus. Ajoute uniquement les illustrations qui collent à tes propres parties.

Tous les fichiers fournis sont sous licence CC0 : ils appartiennent au domaine public et leur usage est libre. Le crédit complet de chaque fichier figure dans un fichier texte `CREDITS.md` livré avec les ressources sur le disque. Il ne s'affiche pas dans l'application.

Les fichiers et dossiers fournis sont protégés. Impossible de les supprimer ou de les déplacer depuis le panneau **Asset Browser** : ta bibliothèque de départ reste donc intacte. Tu peux en revanche les renommer ou les copier.

## Ouvrir le panneau Asset Browser

Le panneau **Asset Browser** est un gestionnaire de fichiers pour tes ressources de jeu. Deux chemins permettent de l'ouvrir.

Depuis la section **Settings** (Paramètres) :

1. Ouvre la section **Settings**.
2. Va dans l'onglet **Imports**.
3. Repère la section **Game Assets**.
4. Clique sur le bouton **Asset Browser**.

Depuis une partie :

1. Ouvre un chat en Game Mode.
2. Clique ou appuie sur le bouton **Game Assets** (le dossier), qui commence en haut à droite du chat. Tu peux le déplacer sur ordinateur ou téléphone.

Le bouton n'apparaît qu'en Game Mode. Il ouvre **Game Assets**, qui contient **Asset Browser** : une fenêtre déplaçable sur ordinateur ou un panneau sur toute la largeur sur téléphone.

Si tu l'as rangé avec **Put back in Chat Settings**, ouvre plutôt la section **Game Assets** dans Chat Settings.

La barre d'outils en haut contient un fil d'Ariane qui démarre à **Game Assets**. À côté, tu trouves un interrupteur entre **Grid view** (vue en grille) et **List view** (vue en liste), un bouton **Upload** (téléverser) et un bouton **New** (nouveau). Il y a aussi un bouton **Rescan** (réanalyser), un bouton **Open in system folder** (ouvrir dans le dossier système) et un champ **Search in folder** (chercher dans le dossier). Sur les écrans larges, une arborescence de dossiers à gauche permet de passer d'une catégorie à l'autre.

## Envoyer tes propres ressources

Deux méthodes existent pour téléverser des ressources. Prends celle qui t'arrange.

### Téléverser depuis le panneau Asset Browser

1. Ouvre le panneau **Asset Browser**.
2. Entre dans l'un des cinq dossiers de catégorie, ou dans un de ses sous-dossiers.
3. Clique sur **Upload** et choisis tes fichiers, ou fais glisser les fichiers sur la zone de fichiers.

Il faut d'abord se trouver dans un dossier de catégorie. Si tu déposes des fichiers à la racine, l'application te demande d'ouvrir un dossier de catégorie avant le téléversement.

### Téléverser depuis la section Settings

1. Ouvre la section **Settings** et va dans l'onglet **Imports**.
2. Repère la section **Game Assets**.
3. Choisis une catégorie dans le menu **Type** : **Music**, **Ambient**, **Sound Effects**, **Sprites** ou **Backgrounds**.
4. Indique la destination dans le champ **Folder**, ou garde la valeur par défaut proposée.
5. Clique sur **Choose Files** et sélectionne tes fichiers.
6. Clique sur **Upload to Server**.

Chaque **Type** remplit le champ **Folder** avec une valeur par défaut cohérente. Ces valeurs sont :

- **Music** : `exploration/fantasy/calm`
- **Ambient** : `nature`
- **Sound Effects** : `exploration`
- **Sprites** : `generic-fantasy`
- **Backgrounds** : `custom`

### Types et tailles de fichiers acceptés

Le serveur vérifie chaque téléversement selon ces règles, valables pour les deux méthodes.

| Catégorie                     | Types de fichiers acceptés           |
| ----------------------------- | ------------------------------------ |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM  |
| Sprites                       | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds                   | PNG, JPG, JPEG, GIF, WebP, AVIF      |

Les fichiers audio et image peuvent peser jusqu'à 50 Mo chacun. Les fichiers texte, jusqu'à 10 Mo. Le serveur refuse les types de fichiers qui ne correspondent pas à la catégorie. Le message d'erreur énumère alors les types acceptés.

### La règle des dossiers de musique

La musique suit une organisation stricte. Chaque piste doit se trouver dans un chemin à trois niveaux, `state/genre/intensity`, par exemple `exploration/fantasy/calm`. Si le chemin ne correspond pas, le téléversement échoue.

Les valeurs autorisées sont :

- State : `exploration`, `dialogue`, `combat`, `travel_rest`.
- Genre : `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom`.
- Intensity : `calm`, `tense`, `intense`.

C'est grâce à cette organisation que Game Mode sait quand jouer chaque piste. Les dossiers d'ambiance, d'effets sonores, de sprites et d'arrière-plans échappent à cette règle : nomme leurs sous-dossiers comme tu veux.

## Organiser tes ressources

Le panneau **Asset Browser** t'aide à garder tes fichiers en ordre. Sur ordinateur, fais un clic droit sur un fichier ou un dossier, ou passe par son menu "...", pour voir les actions disponibles.

Actions sur un fichier :

- **Rename** (renommer) : donne un nouveau nom au fichier. L'opération échoue si le nom est déjà pris dans ce dossier.
- **Move** (déplacer) et **Copy** (copier) : envoie le fichier vers un autre dossier via un sélecteur de dossier.
- **Delete** (supprimer) : supprime le fichier.
- **Download** (télécharger) : enregistre le fichier sur ton appareil.

Actions sur un dossier :

- **Create subfolder** (créer un sous-dossier) : crée un dossier à l'intérieur.
- **Open in system folder** : affiche le dossier dans le gestionnaire de fichiers de ton ordinateur.
- **Delete folder** (supprimer le dossier) : supprime le dossier. S'il contient encore des fichiers, tu dois d'abord cocher la case **Delete everything inside**.

Le bouton **New** de la barre d'outils crée lui aussi des éléments dans le dossier courant. Il propose **New folder**, **New text file** et **New markdown file**.

Pour agir sur plusieurs fichiers d'un coup, utilise les cases à cocher de chaque fichier. Une barre indique le nombre de fichiers sélectionnés, avec les boutons **Select all**, **Move**, **Copy** et **Delete**. Les gros dossiers n'affichent qu'une partie de leur contenu à la fois, avec un bouton **Load more**.

Chaque dossier peut porter une courte note. Clique sur le texte de description du dossier, ou sur l'indication **Add description...**, pour la rédiger. Les cinq dossiers de catégorie ont des descriptions fixes, non modifiables.

Souviens-toi que les fichiers de départ fournis sont protégés. Tu peux les renommer ou les copier, mais ni les déplacer ni les supprimer.

## Réanalyser après une modification extérieure

Marinara tient une liste interne de tes ressources pour que Game Mode les retrouve rapidement. Quand tu téléverses depuis l'application, cette liste se met à jour toute seule.

Si tu copies des fichiers directement dans le dossier des ressources de jeu sur ton ordinateur, en dehors de l'application, celle-ci ne le remarque pas tout de suite. Clique sur le bouton **Rescan** pour qu'elle relise le dossier et prenne en compte les nouveaux fichiers. Le bouton **Rescan** se trouve à la fois dans la barre d'outils du panneau **Asset Browser** et dans la section **Game Assets** de la section **Settings**.

## Choisir les ressources autorisées pour une partie

Chaque chat en Game Mode peut se limiter à une partie de tes dossiers de ressources. Pratique, par exemple, pour qu'une partie d'horreur ignore tes musiques joyeuses.

Pendant la configuration, déplie **Adjust Game Assets for this Game** à l'étape **Features**. Pour une partie existante, ouvre la fenêtre **Game Assets** de la partie.

Ensuite :

1. Clique sur le bouton **Game assets**. Il affiche **Selecting** tant qu'il est actif.
2. Sers-toi du petit contrôle d'état de chaque dossier pour l'inclure ou l'exclure.

Une barre indique "All folders included" ou le nombre de dossiers exclus, avec un bouton **Reset to all** pour tout réinclure. Ce choix n'est enregistré que pour ce chat précis. Il modifie les dossiers dans lesquels Game Mode peut puiser, mais ne supprime ni ne masque aucun fichier. Il reste sans effet en dehors de ce chat en Game Mode.

## Dossier de musique personnalisé pour Music DJ

**Music DJ** est un agent capable de jouer de la musique pendant une partie. Dans son mode Custom, il puise les pistes dans un dossier de ton choix. Ce dossier se règle à deux endroits.

Quand tu actives **Music DJ** pour un chat, le formulaire de configuration reprend la source enregistrée sur l'agent Music DJ. L'option **Game Assets** affiche un chemin situé dans tes ressources de jeu, par exemple `music` ou `music/combat`. L'option **Folder on this device** affiche le chemin enregistré sur la machine du serveur, accompagné d'un bouton **Choose Folder**.

L'éditeur complet de **Music DJ** comporte une section **Custom Music Library**. Son interrupteur **Use Game Assets music folder** bascule entre deux modes :

- Interrupteur activé : le champ **Game Assets music folder** pointe vers un dossier de tes ressources de jeu, par exemple `music` ou `music/combat`. Le bouton **Open Folder** ouvre ce dossier sur la machine du serveur.
- Interrupteur désactivé : le champ **Music folder on this device** autorise le mode Custom à jouer la musique de n'importe quel dossier de l'ordinateur qui fait tourner le serveur. Clique sur **Select Folder** pour ouvrir un sélecteur de dossier système, ou colle le chemin du dossier dans le champ.

Choisir un dossier hors de l'application demande un accès privilégié. Sur le même ordinateur que le serveur, cela fonctionne sans réglage supplémentaire. Depuis un autre appareil ou par accès distant, il faut d'abord mettre en place l'accès administrateur. La marche à suivre est décrite dans [Accès distant](../REMOTE_ACCESS.md). Pour tout le reste sur le lecteur de musique, voir [Music DJ](../media/music.md).

## Ouvrir le dossier sur ton ordinateur

Le bouton **Open in system folder** ouvre le dossier de ressources sélectionné dans le gestionnaire de fichiers habituel de ton ordinateur. Cela ne marche que si tu utilises l'application sur l'ordinateur même qui fait tourner le serveur. Depuis un téléphone, une tablette ou un autre ordinateur, l'application t'indique que les dossiers système ne s'ouvrent que depuis l'appareil qui héberge Marinara.

## Guides associés

- [Music DJ : Spotify, YouTube et musique locale](../media/music.md)
- [Game Mode : premiers pas](getting-started.md)
- [Accès distant : authentification de base et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
