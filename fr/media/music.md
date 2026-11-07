# Music DJ : Spotify, YouTube et musique locale

**Music DJ** diffuse une musique d'arrière-plan assortie à ta scène. Ce guide explique comment connecter Spotify, YouTube ou tes propres fichiers audio, utiliser le lecteur de musique, et profiter de la musique en Game Mode et en Conversation.

## Ce qu'est Music DJ

**Music DJ** est un agent téléchargeable facultatif. Un agent est un assistant qui tourne en arrière-plan d'un chat. Après chaque réponse, il peut lire l'ambiance de la scène et lancer une musique assortie.

Avant de commencer : ouvre **Agents**, sélectionne **Agent Organizer** (organisateur d'agents) et installe **Music DJ**. Il est désactivé après l'installation. Active-le pour un chat comme n'importe quel autre agent. Il fonctionne dans les chats Roleplay, en Game Mode via un interrupteur distinct ([Music DJ en Game Mode](#music-dj-in-game-mode)), et en Conversation via la commande **Music** (musique) ([La commande Music en Conversation](#the-conversation-music-command)).

Il puise sa musique à trois sources.

| Source | Compte nécessaire | Coût | Idéal pour |
| --- | --- | --- | --- |
| **Spotify** | Ton propre compte Spotify, et Spotify Premium pour la lecture | Gratuit à configurer, Premium pour écouter | Des morceaux réels et nommés, sur tes propres appareils |
| **YouTube** | Une clé API Google gratuite | Gratuit | Écouter sans se connecter et sans Premium |
| **Custom** | Aucun | Gratuit | Tes propres fichiers audio |

La source active apparaît sous la forme d'un petit **Music Player** (lecteur de musique) épinglé dans la barre supérieure. Sur téléphone et dans les fenêtres étroites, il devient un petit widget rond flottant que tu peux déplacer.

La configuration de Music DJ se fait à un seul endroit, partagé par toute l'application. Ouvre le panneau **Agents** à droite, puis **Music DJ**. Tu peux aussi cliquer sur l'icône d'engrenage du mini-lecteur (infobulle **Music DJ setup**).

### Choisir une source de musique

Dans l'éditeur de **Music DJ**, le champ **Music Player** propose trois boutons : **Spotify**, **YouTube** et **Custom**. Une ligne en dessous indique ce qui est actif, par exemple "Visible player: Spotify. Saved provider: Spotify." Ce choix vaut pour toute l'application ; il n'est pas enregistré chat par chat. Le dossier depuis lequel **Custom** joue peut être différent pour chaque chat ou personnage : voir [Utiliser un autre dossier pour un chat ou un personnage](#use-a-different-folder-for-a-chat-or-character).

## Configurer Spotify

Spotify passe par ta propre application développeur Spotify, gratuite. Tu colles uniquement un **Spotify Client ID**. Il n'y a pas de client secret.

1. Dans l'éditeur de **Music DJ**, repère **Spotify Connection**.
2. Ouvre le **Spotify Developer Dashboard** via le lien affiché dans l'application.
3. Crée une nouvelle application et sélectionne "Web API".
4. Dans les Redirect URIs de l'application, ajoute l'adresse de redirection exacte que Marinara affiche à l'étape 3 de l'encadré de configuration intégré. Une adresse de redirection est l'adresse vers laquelle Spotify te renvoie après la connexion.
5. Copie le **Client ID** et colle-le dans **Spotify Client ID**.
6. Enregistre l'agent, puis clique sur **Connect Spotify Account** (connecter le compte Spotify).

Une fenêtre de connexion et d'autorisation Spotify s'ouvre. Après ton accord, elle affiche une courte page de réussite, puis se ferme. Marinara affiche une pastille verte **Connected to Spotify**. **Disconnect** (se déconnecter) supprime la connexion enregistrée.

> **Remarque :** Spotify Premium (la formule payante) est nécessaire pour la lecture, la pause, le passage au morceau suivant et le volume. Un compte gratuit peut se connecter. Les jetons d'accès se renouvellent automatiquement.

Si ça n'a pas marché : sur une autre machine, la fenêtre de connexion peut échouer (voir ci-dessous). Sinon, vérifie que l'adresse de redirection correspond exactement.

### Appareils Spotify

Spotify diffuse la musique par l'intermédiaire d'un appareil, comme ton téléphone, l'application Spotify de ton ordinateur ou un lecteur intégré.

- Sur ordinateur, clique sur l'icône d'ordinateur portable du mini-lecteur (**Enable Marinara player** ou **Use Marinara player**) pour transformer l'onglet du navigateur en appareil Spotify nommé "Marinara Engine". Le streaming dans l'onglet demande Premium.
- Sur mobile, le lecteur privilégie l'appareil Spotify du téléphone : la lecture se fait donc sur le téléphone, et non dans un onglet en arrière-plan.
- Si un appareil n'autorise pas le réglage du volume à distance, le curseur est remplacé par **Use device volume** (utiliser le volume de l'appareil). Sers-toi alors des boutons de volume de l'appareil.

### Spotify sur une autre machine

Spotify n'accepte que les adresses de redirection sécurisées en `https://` ou l'adresse de bouclage `http://127.0.0.1` (le même ordinateur). Si Marinara tourne sur une autre machine en `http` simple, la fenêtre de connexion peut échouer. Deux solutions :

- Pendant la connexion, ouvre "Browser couldn't reach the callback?" sous **Connect Spotify Account**. Copie l'adresse complète depuis la fenêtre en échec, colle-la dans le champ et clique sur **Complete connection** (terminer la connexion).
- Ou fixe une adresse de redirection avec une variable d'environnement (un réglage du serveur lu au démarrage) :

```text
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

Voir la [Référence de configuration du serveur](../CONFIGURATION.md).

### Choisir où Spotify puise les morceaux (Roleplay)

Quand Music DJ tourne dans un chat Roleplay, sa carte propose une liste **Spotify source** (source Spotify).

- **Liked Songs** : puiser d'abord dans tes titres enregistrés.
- **Playlist** : rester dans une seule playlist, choisie dans la liste **Playlist**.
- **Artist** : chercher autour d'un artiste, saisi dans le champ **Artist**.
- **Any Spotify** : laisser le DJ utiliser la recherche Spotify quand cela s'y prête.

## Configurer YouTube

Le mode YouTube demande une clé API YouTube Data, gratuite. Une clé API est un code secret qui permet à Marinara d'utiliser un service en ton nom. Aucune connexion à YouTube ni abonnement Premium n'est nécessaire.

1. Dans l'éditeur de **Music DJ**, repère **YouTube Connection**.
2. Ouvre la **Google Cloud Console** via le lien de l'application, puis crée ou choisis un projet.
3. Active **YouTube Data API v3**.
4. Va dans Credentials, puis Create credentials, puis API key.
5. Colle la clé dans **YouTube Data API Key**.
6. Clique sur **Save Key** (enregistrer la clé). Le bouton indique ensuite **Update Key** et une pastille verte "API key configured" apparaît. **Remove** (retirer) supprime la clé.

Laisse la clé sans restriction, ou restreins-la uniquement par API à YouTube Data API v3. Ne la restreins pas par référent HTTP. La recherche s'exécute sur le serveur : une restriction par référent la bloquerait. L'application indique que le quota gratuit (environ 100 recherches par jour) suffit largement pour un DJ personnel. Ce chiffre vient du texte de l'application et peut changer. Ta clé reste sur le serveur, chiffrée.

## Utiliser tes propres fichiers de musique

Le mode Custom lit des fichiers audio depuis la machine qui fait tourner Marinara. Les formats pris en charge sont `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac` et `.webm`.

Dans l'éditeur de **Music DJ**, repère **Custom Music Library** (bibliothèque musicale personnalisée). Elle contient un seul interrupteur, **Use Game Assets music folder** (utiliser le dossier de musique des ressources de jeu).

- **On** : le mode Custom lit l'audio que tu as téléversé dans Game Assets, la bibliothèque de ressources de Marinara pour Game Mode. Utilise **Game Assets music folder** pour choisir un dossier. Saisis `music` pour toute la bibliothèque, ou un sous-dossier comme `music/combat`. **Open Folder** (ouvrir le dossier) l'ouvre sur la machine du serveur.
- **Off** : le mode Custom lit un dossier de l'appareil serveur. Utilise **Select Folder** (sélectionner un dossier) pour ouvrir un sélecteur sur la machine du serveur, ou colle le chemin dans **Default music folder on this device** (dossier de musique par défaut sur cet appareil). Tout chat qui n'a pas son propre dossier utilise celui-ci.

La lecture depuis un dossier hors de Game Assets demande un accès local au serveur. L'enregistrement d'un chemin de dossier saisi à la main demande le même accès que le sélecteur de dossier. Depuis un autre appareil, sans identifiants de connexion ni secret d'administration, les deux peuvent être bloqués. Voir [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md).

<a id="use-a-different-folder-for-a-chat-or-character"></a>

### Utiliser un autre dossier pour un chat ou un personnage

Un chat ou un personnage peut avoir son propre dossier de musique, pour que chaque histoire ait sa propre bande-son. Le dossier d'un personnage est lu dans tous les chats où ce personnage est le seul personnage.

1. Ouvre le chat et ses **Chat Settings** (réglages du chat).
2. Dans les réglages **Music DJ**, avec le lecteur **Custom** sélectionné, ouvre **Apply to** (appliquer à) et choisis où enregistrer le dossier.
3. Clique sur **Choose Folder** (choisir un dossier), ou colle le chemin dans **Music folder on this device** (dossier de musique sur cet appareil).

| Apply to | Chats qui utilisent le dossier |
| --- | --- |
| **This chat** (ce chat) | Uniquement ce chat. Une branche démarre avec le même dossier et peut le changer. |
| Le nom du personnage | Tous les chats où ce personnage est le seul personnage. N'apparaît que dans un chat avec un seul personnage. |
| **All chats (default)** (tous les chats, par défaut) | Tous les chats qui n'ont pas leur propre dossier. C'est le dossier par défaut défini dans l'éditeur de **Music DJ**. |

Music DJ utilise le premier dossier qu'il trouve : le dossier de ce chat, puis celui du personnage, puis le dossier par défaut. Un chat de groupe n'utilise jamais le dossier d'un personnage. Le dossier d'un chat ou d'un personnage est lu même quand la source par défaut est Game Assets.

**In use:** (en cours d'utilisation) affiche le dossier que lit ce chat et sa provenance : **This chat**, **From** (depuis) suivi du nom du personnage, ou **Default** (par défaut).

- **Use default** (utiliser le dossier par défaut) retire le dossier propre à ce chat. Le chat lit alors le dossier du personnage, ou le dossier par défaut.
- **Unlink from** (dissocier de) suivi du nom du personnage retire le dossier du personnage de tous les chats.

Le même choix **Apply to** apparaît quand tu ajoutes Music DJ à un chat. Les exports de chat, les profils de réglages et les fichiers **Export Profile** (exporter le profil) laissent de côté le dossier propre à un chat. Les exports d'agent laissent de côté le dossier par défaut et les dossiers de personnage. Chaque chemin pointe vers des fichiers de ce serveur : il n'a donc aucun sens sur un autre.

## Utiliser le lecteur de musique

Le **Music Player** est une pastille dans la barre supérieure sur ordinateur et un widget déplaçable sur mobile. Pour l'afficher ou le masquer, ouvre **Settings → General → App Behavior** (Paramètres → Général → Comportement de l'application) et active ou désactive **Music Player**. Il est activé par défaut. S'il est activé alors que Music DJ n'est pas installé, le lecteur affiche **Download Music DJ Agent to configure** et propose un bouton **Agent Organizer**.

Sur un profil neuf, la source de départ est **YouTube**. Change-la avec le bouton rond de changement de source sur le lecteur (infobulle "Switch to ... player"), avec les boutons **Music Player** de l'éditeur, ou dans les réglages **Music DJ** d'un chat.

Le lecteur affiche la pochette ou la miniature du morceau, son titre et l'artiste ou la chaîne. Les commandes dépendent de la source.

- **Spotify** : lecture aléatoire, **Previous** (précédent), lecture ou pause, **Next** (suivant), répétition, volume avec sourdine, **DJ**, le bouton **Marinara player** en forme d'ordinateur portable et l'engrenage **Music DJ setup**. Quand Spotify n'est pas connecté, le lecteur affiche "Spotify not connected", et un appui dessus ouvre **Music DJ setup**.
- **YouTube** : lecture ou pause, une flèche qui ouvre un petit panneau vidéo en 16:9, **Stop** (arrêter), et volume avec sourdine.
- **Custom** : lecture ou pause et volume.

## DJ Mari : le créateur de playlists par IA

Le bouton **DJ** du mini-lecteur Spotify ("DJ Mari composes a playlist for you!") compose une playlist thématique. DJ Mari demande à ton modèle d'IA connecté de la bâtir à partir de ton persona, du personnage que tu utilises le plus et de tes chats récents, tous chats confondus. Les morceaux trouvés sont ajoutés à une nouvelle playlist Spotify nommée "DJ Mari" suivi de la date du jour, et la lecture démarre.

DJ Mari a besoin de deux choses.

- Un modèle attribué à l'agent **Music DJ**. Sans modèle, tu vois "Configure a model connection on the Music DJ agent before using DJ Mari." Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).
- Au moins 25 morceaux Spotify trouvés. DJ Mari en retient jusqu'à 50. En dessous de 25, DJ Mari te demande d'ajouter des Liked Songs et de réessayer.

En cas de réussite, tu vois "DJ Mari playlist is ready" avec un bouton **Open playlist** (ouvrir la playlist).

<a id="music-dj-in-game-mode"></a>

## Music DJ en Game Mode

Game Mode a sa propre musique d'arrière-plan, issue de Game Assets. Pour utiliser Music DJ à la place, active l'interrupteur **Music DJ** dans la configuration de la partie ("Use the Music DJ for this game instead of local music assets"). Il est désactivé par défaut. Tu retrouves alors les mêmes choix **Spotify**, **YouTube** et **Custom**, et les mêmes champs, qu'en Roleplay.

Avec Spotify, après chaque scène, le serveur dresse une courte liste de vrais morceaux candidats tirés de la source choisie, et l'IA en choisit un. Cela l'empêche d'inventer un morceau. Game Mode joue un seul morceau en boucle à la fois. Pour obtenir une nouvelle sélection pour la scène actuelle, ouvre **Game controls** (contrôles du jeu) et choisis **Retry Music DJ** (relancer Music DJ). Voir [Les contrôles du jeu](../game/getting-started.md#the-games-controls).

<a id="the-conversation-music-command"></a>

## La commande Music en Conversation

En Conversation, tu ne peux pas ajouter Music DJ comme agent. Les personnages lancent plutôt des morceaux via la commande **Music**.

1. Ouvre la section **Commands** (commandes) du chat et active l'interrupteur principal **Commands**.
2. Active **Music** ("Let characters play songs through the active Music Player").

Un personnage peut alors nommer un morceau pour Spotify, ou décrire un titre pour YouTube, et Marinara le lance sur la source active. Cela fonctionne même si Music DJ n'est activé nulle part. Il suffit que Spotify soit connecté ou qu'une clé YouTube soit enregistrée. Si Spotify n'est pas connecté ou n'a pas l'autorisation de lecture, une commande de morceau Spotify ne fait rien et n'affiche aucune erreur.

## Dépannage

- **Le mini-lecteur a disparu** : active **Music Player** dans **Settings → General → App Behavior**.
- **Spotify ne joue rien** : la lecture exige Spotify Premium et un appareil Spotify actif. Ouvre l'application de bureau sur un appareil, ou clique sur **Enable Marinara player** sur ordinateur.
- **La fenêtre de connexion Spotify échoue sur une autre machine** : utilise le champ de collage "Browser couldn't reach the callback?", ou définis `SPOTIFY_REDIRECT_URI` sur le serveur.
- **La recherche YouTube échoue** : vérifie que **YouTube Data API v3** est activé pour ton projet et que la clé n'est pas restreinte par référent HTTP. Si tu atteins le quota quotidien, réessaie le lendemain ou utilise une autre clé.
- **La musique Custom ne se lance pas depuis un dossier de l'appareil, ou un chemin de dossier saisi ne s'enregistre pas, en accès à distance** : les deux demandent un accès local au serveur. Voir [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md).
- **Un chat lit le mauvais dossier** : vérifie **In use:** dans les réglages **Music DJ** du chat. **This chat** l'emporte sur le dossier du personnage : clique donc sur **Use default** pour revenir au dossier du personnage.
- **La commande de morceau d'un personnage ne fait rien en Conversation** : connecte Spotify ou enregistre une clé YouTube, et vérifie que les interrupteurs **Commands** et **Music** sont activés.

## Guides associés

- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Game Assets](../game/game-assets.md)
- [Mode Conversation : premiers pas](../conversation/getting-started.md)
