# Music DJ : Spotify, YouTube et musique locale

Ce guide explique comment diffuser de la musique d'arrière-plan dans Marinara Engine grâce à **Music DJ**. Au programme : connecter Spotify, YouTube ou tes propres fichiers audio locaux. Tu découvres aussi le fonctionnement du lecteur de musique, du créateur de playlists **DJ Mari** et de la musique en Game Mode.

## Ce qu'est Music DJ

**Music DJ** est un agent téléchargeable, facultatif. Un agent est un petit programme qui tourne automatiquement en arrière-plan d'un chat. Ouvre le panneau **Agents**, sélectionne **Download Agents** (télécharger des agents) et installe **Music DJ** avant de le configurer. Après chaque réponse, Music DJ peut lire l'ambiance de la scène et lancer une musique d'arrière-plan assortie.

**Music DJ** puise sa musique à trois sources :

- **Spotify** : pilote la lecture sur ton vrai compte Spotify et tes appareils.
- **YouTube** : cherche sur YouTube et lit le résultat dans un petit lecteur intégré. Aucune connexion n'est nécessaire.
- **Custom** : lit tes propres fichiers audio depuis un dossier de la machine qui fait tourner Marinara.

Quelle que soit la source active, elle apparaît sous la forme d'un petit **Music Player** (lecteur de musique) épinglé dans la barre supérieure de l'application. Sur téléphone et dans les fenêtres étroites, il devient un petit widget rond flottant que tu peux déplacer.

**Music DJ** est désactivé par défaut après l'installation. Tu l'actives pour un chat comme n'importe quel agent. Il est disponible dans les chats **Roleplay**, et en mode **Game** via un interrupteur distinct (voir Music DJ en Game Mode, plus bas). En mode **Conversation**, utilise plutôt la commande **Music** (voir La commande Music en Conversation, plus bas).

La configuration de **Music DJ** se fait à un seul endroit, commun à tout. Ouvre le panneau **Agents** à droite, puis ouvre **Music DJ**. Autre option : clique sur l'icône d'engrenage du mini-lecteur. Son infobulle indique **Music DJ setup**.

### Choisir une source de musique

Dans l'éditeur de **Music DJ**, le champ **Music Player** propose trois boutons : **Spotify**, **YouTube** et **Custom**. Le texte d'aide indique "Choose which service Music DJ should use for future music picks. The same choice switches the visible player surface."

Sous les boutons, une ligne indique la source active du moment, par exemple "Visible player: Spotify. Saved provider: Spotify." Ce choix de source vaut pour toute l'application. Il n'est pas enregistré chat par chat.

Pour choisir rapidement :

| Source | Compte nécessaire | Coût | Idéal pour |
|---|---|---|---|
| **Spotify** | Ton propre compte Spotify, plus Spotify Premium pour la lecture | Gratuit à configurer, Premium pour écouter | Des morceaux réels et nommés, sur tes propres appareils |
| **YouTube** | Une clé API Google gratuite | Gratuit | Écouter sans se connecter et sans Premium |
| **Custom** | Aucun | Gratuit | Tes propres fichiers audio locaux |

## Configurer Spotify

Spotify passe par ta propre application développeur Spotify, gratuite. Tu colles uniquement un **Spotify Client ID**. Il n'y a pas de client secret à saisir.

Ouvre l'éditeur de **Music DJ** et repère le champ **Spotify Connection**. Voici la marche à suivre :

1. Ouvre le **Spotify Developer Dashboard** via le lien affiché dans l'application.
2. Crée une nouvelle application et sélectionne "Web API".
3. Dans les Redirect URIs de l'application, ajoute l'adresse de redirection exacte que Marinara affiche à l'étape 3 de l'encadré de configuration intégré. Une adresse de redirection est l'adresse web vers laquelle Spotify te renvoie après la connexion.
4. Copie le **Client ID** de ton application Spotify et colle-le dans le champ **Spotify Client ID**.
5. Enregistre l'agent, puis clique sur **Connect Spotify Account**.

Une fenêtre de connexion et d'autorisation Spotify s'ouvre. Après ton accord, elle affiche brièvement une page "Spotify Connected!" puis se ferme. De retour dans Marinara, une pastille verte **Connected to Spotify** doit apparaître. Le bouton **Disconnect** supprime la connexion enregistrée.

L'application affiche cette note : "Requires Spotify Premium. Tokens refresh automatically, no need to reconnect." Un compte Spotify gratuit peut se connecter, mais la lecture, la pause, le passage au morceau suivant et le réglage du volume exigent Spotify Premium. Premium est la formule payante de Spotify.

### Notes sur les appareils Spotify

Spotify diffuse la musique par l'intermédiaire d'un appareil : ton téléphone, l'application Spotify de ton ordinateur ou un lecteur intégré.

Sur ordinateur, tu peux transformer l'onglet du navigateur lui-même en appareil Spotify. Clique sur l'icône d'ordinateur portable du mini-lecteur. Son infobulle indique **Enable Marinara player** ou **Use Marinara player**. Cela enregistre un appareil Spotify nommé "Marinara Engine" pour que la musique arrive dans l'onglet. Le streaming intégré (l'écoute au fil de la lecture) demande lui aussi Spotify Premium.

Sur mobile, le lecteur privilégie l'appareil Spotify du téléphone. Quand tu lances la lecture, la musique sort donc du téléphone, et non de l'onglet de navigateur en arrière-plan.

Si un appareil Spotify n'autorise pas le réglage du volume à distance, le curseur de volume laisse place à un bouton **Use device volume**. Sers-toi alors des boutons de volume de l'appareil.

### Spotify sur une autre machine

Spotify n'accepte que les adresses de redirection sécurisées en `https://` ou l'adresse de bouclage `http://127.0.0.1`. Le bouclage désigne le même ordinateur. Si Marinara tourne sur une autre machine en `http` simple, la fenêtre de connexion risque de ne pas se charger.

Deux solutions dans ce cas :

- Pendant la connexion, ouvre la section "Browser couldn't reach the callback?" sous le bouton **Connect Spotify Account**. Copie l'adresse complète depuis la fenêtre en échec, colle-la dans le champ, puis clique sur **Complete connection**.
- Autre option : fixe une adresse de redirection avec une variable d'environnement sur le serveur. Une variable d'environnement est un réglage du serveur lu au démarrage.

```
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

Consulte la [Référence de configuration du serveur](../CONFIGURATION.md) pour savoir comment définir des variables d'environnement.

## Configurer YouTube

Le mode YouTube demande une clé API YouTube Data, gratuite. Une clé API est un code secret qui autorise Marinara à utiliser un service en ton nom. Aucun compte YouTube ni abonnement Premium n'est nécessaire.

Ouvre l'éditeur de **Music DJ** et repère le champ **YouTube Connection**. Voici la marche à suivre :

1. Ouvre la **Google Cloud Console** via le lien affiché dans l'application, puis crée ou choisis un projet.
2. Active le service **YouTube Data API v3**.
3. Va dans Credentials, puis Create credentials, puis API key.
4. Colle la clé dans le champ **YouTube Data API Key**.
5. Clique sur **Save Key**. Une fois la clé enregistrée, le bouton indique **Update Key** et une pastille verte "API key configured" apparaît. Le lien **Remove** supprime la clé.

Laisse la clé sans restriction, ou restreins-la uniquement par API en choisissant YouTube Data API v3. Ne la restreins pas par référent HTTP : la recherche s'exécute sur le serveur, et une telle restriction la bloquerait.

L'application affiche cette note : "The free quota (~100 searches/day) is plenty for a personal DJ." Le quota est la limite d'utilisation quotidienne. Ce chiffre vient du texte de l'application et peut évoluer avec le temps. La clé reste sur le serveur, où Marinara la stocke chiffrée.

## Musique Custom (locale)

Le mode Custom lit tes propres fichiers audio depuis la machine qui fait tourner le serveur de Marinara. Les formats pris en charge sont `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac` et `.webm`.

Ouvre l'éditeur de **Music DJ** et repère le champ **Custom Music Library**. Il contient un seul interrupteur : **Use Game Assets music folder**.

- Interrupteur activé : le mode Custom lit l'audio que tu as téléversé dans Game Assets. Game Assets est la bibliothèque d'éléments intégrée de Marinara pour Game Mode. Le champ **Game Assets music folder** sert à choisir un dossier. Saisis `music` pour toute la bibliothèque musicale, ou un sous-dossier comme `music/combat`. Le bouton **Open Folder** ouvre ce dossier sur la machine du serveur.
- Interrupteur désactivé : le mode Custom lit un dossier de l'appareil serveur. Le bouton **Select Folder** ouvre un sélecteur de dossier sur la machine du serveur ; sinon, colle le chemin dans le champ **Music folder on this device**.

La configuration du chat en Roleplay et en Game affiche la même source sélectionnée. Si tu as choisi un dossier sur l'appareil serveur, les réglages Music DJ du chat affichent ce chemin enregistré et un bouton **Choose Folder**, au lieu de demander un chemin Game Assets.

La lecture depuis un dossier hors Game Assets exige un accès local au serveur. Si tu utilises Marinara depuis un autre appareil sans mot de passe ni secret administrateur, cette fonction précise peut être bloquée. Voir [Accès distant : Basic Auth et liste d'autorisation d'IP](../REMOTE_ACCESS.md).

## Utiliser le lecteur de musique

Le **Music Player** apparaît sous la forme d'une petite pastille dans la barre supérieure sur ordinateur, ou d'un widget flottant déplaçable sur mobile. Un réglage permet de l'afficher ou de le masquer.

Ouvre **Settings** (Paramètres), va dans l'onglet **General** et repère la section **App Behavior**. Active ou désactive l'interrupteur **Music Player**. Le texte d'aide indique "Shows the compact Music Player. Switch between Spotify, YouTube, and Custom from the player itself or the Music DJ agent settings." Cet interrupteur est toujours disponible et activé par défaut. S'il est activé sans que Music DJ soit installé, le lecteur affiche à la place **Download Music DJ Agent to configure**, avec un bouton **Download Agents**.

Sur un profil neuf, la source visible au départ est **YouTube**. Trois façons de la changer :

- Le petit bouton rond de changement de source, sur le lecteur. Son infobulle indique "Switch to ... player".
- Les boutons **Music Player** de l'éditeur de **Music DJ**.
- Les réglages **Music DJ** d'un chat.

Le lecteur affiche la pochette ou la miniature du morceau en cours, son titre et l'artiste ou la chaîne. Les commandes dépendent de la source.

- Spotify : lecture aléatoire, **Previous**, lecture ou pause, **Next**, répétition, un curseur de volume avec sourdine, le bouton **DJ**, le bouton **Marinara player** en forme d'ordinateur portable et l'engrenage **Music DJ setup**.
- YouTube : lecture ou pause, une flèche d'agrandissement qui ouvre un petit panneau vidéo en 16:9, un bouton **Stop** et un curseur de volume avec sourdine.
- Custom : lecture ou pause et volume, à partir de tes fichiers locaux.

Si Spotify n'est pas encore connecté, le lecteur affiche "Spotify not connected", et un appui dessus ouvre **Music DJ setup**.

### Source Spotify par chat

Quand **Music DJ** tourne dans un chat **Roleplay**, sa carte de réglages propose un menu déroulant **Spotify source** avec quatre choix.

- **Liked Songs** : puiser d'abord dans tes titres enregistrés.
- **Playlist** : rester dans une seule playlist Spotify. Un menu déroulant **Playlist** liste les tiennes.
- **Artist** : chercher uniquement autour d'un artiste précis. Un champ texte **Artist** apparaît.
- **Any Spotify** : laisser le DJ utiliser la recherche Spotify quand cela se prête.

## DJ Mari : le créateur de playlists par IA

Le bouton **DJ** du mini-lecteur Spotify te compose une playlist thématique. Son infobulle indique "DJ Mari composes a playlist for you!"

**DJ Mari** demande au modèle d'IA connecté de bâtir une playlist à partir de ton persona (le personnage que tu incarnes), du personnage que tu utilises le plus et des chats récents, toutes conversations confondues. Les morceaux trouvés sont ensuite ajoutés à une nouvelle playlist Spotify nommée "DJ Mari" suivi de la date du jour, et la lecture démarre.

**DJ Mari** a besoin de deux choses :

- Une connexion à un modèle assignée à l'agent **Music DJ**. Sans elle, le message "Configure a model connection on the Music DJ agent before using DJ Mari." s'affiche. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).
- Assez de morceaux Spotify trouvés. Il en faut au moins 25, et jusqu'à 50 sont retenus. En dessous de 25, DJ Mari te demande d'ajouter des Liked Songs et de réessayer.

En cas de réussite, un message "DJ Mari playlist is ready" s'affiche avec un bouton **Open playlist**.

## Music DJ en Game Mode

Game Mode dispose de sa propre musique d'arrière-plan intégrée, issue de Game Assets. Pour utiliser **Music DJ** à la place, active l'interrupteur **Music DJ** dans la configuration de la partie. Sa description indique "Use the Music DJ for this game instead of local music assets." Cet interrupteur est désactivé par défaut.

Une fois actif, tu retrouves les mêmes choix **Spotify**, **YouTube** et **Custom**, ainsi que les mêmes champs par source qu'en Roleplay.

Spotify fonctionne un peu différemment en Game Mode. Après chaque scène, le serveur dresse une courte liste de morceaux réels tirés de la source choisie. L'IA choisit ensuite un morceau dans cette liste. Elle ne peut donc pas inventer un titre qui n'existe pas. En Game Mode, un seul morceau tourne en boucle à la fois.

Ouvre **Game controls** et choisis **Retry Music DJ** pour demander une nouvelle sélection pour la scène actuelle. Cela fonctionne sur ordinateur et téléphone. Consulte [Les contrôles du jeu](../game/getting-started.md#the-games-controls).

## La commande Music en Conversation

En mode **Conversation**, tu ne peux pas ajouter **Music DJ** comme agent. À la place, les personnages peuvent lancer des morceaux via la commande **Music**.

Ouvre la section **Commands** du chat. Active d'abord l'interrupteur principal **Commands**, puis l'interrupteur **Music**. Sa description indique "Let characters play songs through the active Music Player."

Un personnage peut alors nommer un morceau pour Spotify, ou décrire un titre pour YouTube, et Marinara le lance sur la source active. Cela marche même si **Music DJ** n'est activé nulle part. Il suffit que Spotify soit connecté, ou qu'une clé YouTube soit enregistrée.

Si Spotify n'est pas connecté ou n'a pas l'autorisation de lecture, une commande de morceau Spotify ne fait rien et n'affiche aucune erreur. Configure donc la source d'abord si rien ne se lance.

## Dépannage

- Le mini-lecteur a disparu. Active **Music Player** dans **Settings**, onglet **General**, section **App Behavior**.
- Spotify ne joue rien. Le pilotage de la lecture exige Spotify Premium et un appareil Spotify actif. Ouvre l'application de bureau sur un appareil, ou clique sur **Enable Marinara player** sur ordinateur.
- La fenêtre de connexion Spotify échoue sur une autre machine. Utilise le champ de collage "Browser couldn't reach the callback?", ou définis `SPOTIFY_REDIRECT_URI` sur le serveur.
- La recherche YouTube échoue. Vérifie que le service **YouTube Data API v3** est activé pour ton projet et que la clé n'est pas restreinte par référent HTTP. Si tu atteins le quota quotidien, réessaie le lendemain ou utilise une autre clé.
- La musique Custom refuse de se lancer depuis un dossier de l'appareil en accès distant. Ce dossier exige un accès local au serveur. Voir [Accès distant : Basic Auth et liste d'autorisation d'IP](../REMOTE_ACCESS.md).
- La commande de morceau d'un personnage ne fait rien en mode Conversation. Connecte Spotify ou enregistre une clé YouTube, et vérifie que les interrupteurs **Commands** et **Music** sont activés.

## Guides associés

- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Game Assets](../game/game-assets.md)
- [Mode Conversation : premiers pas](../conversation/getting-started.md)
