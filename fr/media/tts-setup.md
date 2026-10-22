# Configuration du Text to Speech (TTS)

Ce guide explique comment configurer le Text to Speech dans Marinara Engine pour que l'application lise à voix haute les messages et la narration du jeu. Le Text to Speech (TTS), ou synthèse vocale, transforme le texte écrit du chat en audio parlé. Au programme : choisir un fournisseur de voix, sélectionner les voix, la lecture automatique et les commandes de lecture message par message.

## Où se trouvent les réglages TTS

Presque tous les réglages TTS sont regroupés au même endroit. Ouvre le panneau **Connections** (Connexions) et repère la carte **Text to Speech**. Elle est repliée par défaut : clique sur son en-tête pour la déployer.

L'application fait passer les requêtes TTS par son propre serveur. Marinara chiffre la clé API du fournisseur avant de l'enregistrer sur le serveur. Une fois la clé enregistrée, le champ n'affiche plus qu'une valeur masquée, une rangée de points, à la place de la vraie clé. La vraie clé n'est jamais renvoyée vers le navigateur.

Activer le TTS ne déclenche aucune lecture en soi. Cela fait seulement apparaître le bouton **Speak** (lire à voix haute) sur chaque message et les options **Auto-play** (lecture automatique). C'est toi qui décides ce qui est lu, et quand.

## Étape 1 : activer le TTS et choisir une Source

1. Ouvre le panneau **Connections** et déploie la carte **Text to Speech**.
2. Clique sur l'interrupteur situé dans l'en-tête de la carte pour activer le TTS. Survole-le pour voir son infobulle : **Enable TTS** quand il est éteint, **Disable TTS** quand il est allumé.
3. Ouvre le menu déroulant **Source** et choisis ton fournisseur.

La **Source**, c'est le service qui produit l'audio. Quatre choix sont proposés :

- **OpenAI-compatible** : OpenAI, ou tout serveur qui reproduit le format TTS d'OpenAI.
- **ElevenLabs** : le service de voix ElevenLabs.
- **PocketTTS** : un serveur de voix gratuit que tu fais tourner sur ton propre ordinateur.
- **xAI Voice** : le service de voix de xAI.

La Source par défaut est **OpenAI-compatible**. Marinara garde un profil enregistré distinct pour chaque Source : clé API chiffrée, point d'accès, modèle, voix et paramètres du fournisseur. Quand tu changes de Source, Marinara restaure la configuration précédente de celle-ci. Une Source encore jamais configurée démarre avec ses valeurs par défaut.

<a id="use-an-audio-connection"></a>

### Utiliser une connexion Audio

Si tu as déjà configuré une connexion **Audio** (voir [Fournisseurs d'IA pris en charge](../connections/providers-reference.md#audio)), tu n'as pas besoin de saisir de nouveau ses informations ici. Tes connexions Audio sont listées dans le menu déroulant **Source**, sous **Audio connections** (connexions audio), chacune avec son type de source entre parenthèses.

1. Ouvre le menu déroulant **Source** et choisis la connexion.
2. Choisis ses voix et les autres réglages ci-dessous comme d'habitude.

Marinara parle alors avec l'URL de base, la clé API, le modèle et le **Request timeout (seconds)** (délai d'attente des requêtes, en secondes) de cette connexion : la carte masque donc ces champs. La clé reste dans la connexion : elle n'est ni copiée dans les réglages de la carte, ni envoyée à ton navigateur. Les modifications que tu apportes à la connexion, comme une nouvelle clé, s'appliquent tout de suite.

Les voix, la vitesse et les autres réglages de parole sont enregistrés séparément pour chaque connexion. Deux connexions du même type, comme deux serveurs OpenAI-compatible, ne les partagent jamais. Tes réglages pour les quatre Sources habituelles restent tels quels : tu peux donc revenir à l'une d'elles à tout moment. L'interrupteur de l'en-tête de la carte active et désactive toujours le Text to Speech, et la connexion audio propre à un jeu produit toujours les effets sonores et la musique de ce jeu.

Si la connexion choisie est supprimée ou inutilisable, la carte affiche **Missing Audio connection** et rien n'est lu tant que tu n'as pas choisi une autre Source. Marinara ne passe jamais tout seul à une autre connexion.

Quand la connexion liste ses voix, la carte nomme chaque voix enregistrée qui ne figure pas dans la liste, pour que tu puisses en choisir une que la connexion propose.

<a id="game-music-and-sound-effects-on-a-compatible-audio-server"></a>

## Musique et effets sonores de Game avec un serveur audio compatible

Dans **Connections**, crée ou ouvre une connexion **Audio**, puis choisis **OpenAI-compatible**. Utilise l'adresse, la clé et le modèle de ton serveur de musique ou d'effets sonores. Définis **Generation API format**, saisis les chemins des endpoints proposés par le serveur et active **Game music** ou **Game sound effects**. Un chemin vide rend la fonction correspondante indisponible. Sélectionne cette connexion Audio pendant la configuration du Game ou dans ses réglages audio. Un modèle réservé à la musique n'est pas un modèle de voix ; garde une connexion de voix distincte dans la carte Text to Speech.

Les chemins des endpoints sont ajoutés au Base URL de la connexion : pour `http://localhost:8002/v1`, utilise `chat/completions` pour atteindre `/v1/chat/completions`. Aucun nouveau fournisseur n'est nécessaire. Comme les autres requêtes audio compatibles locales, les endpoints HTTP locaux nécessitent `TTS_LOCAL_URLS_ENABLED=true` dans `.env`.

Deux contrats d'API explicites sont pris en charge :

- **Prompt JSON → MP3 audio** envoie `{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }` et attend des octets MP3. La musique de Game utilise la durée de la piste de contexte (120 secondes par défaut) ; les effets sonores demandent 5 secondes. Utilise un endpoint ou un adaptateur qui accepte ces champs.
- **Chat Completions → inline audio (ACE-Step compatible)** envoie `model`, une entrée utilisateur dans `messages`, `stream: false` et `audio_config` avec `duration`, `instrumental: true` et `format: "mp3"`. Le MP3 intégré provient de `choices[0].message.audio` : soit un tableau d'URL audio ACE-Step contenant une URL de données base64, soit un objet avec `data` en base64. Consulte le [contrat d'API compatible ACE-Step](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md). Ces contrats ne prennent pas en charge les URL de résultats distants ni les API de tâches asynchrones.

Active uniquement les fonctions réellement proposées par le serveur. Un endpoint de voix compatible OpenAI n'implique pas à lui seul la prise en charge de la musique ou des effets sonores. Un fournisseur comme Infermatic doit proposer l'un des contrats ci-dessus ou un adaptateur ; son endpoint de musique réel n'a pas été vérifié ici. ElevenLabs conserve ses requêtes natives de musique et d'effets sonores.

La musique de contexte est toujours composée une fois par zone ou niveau de rencontre, puis réutilisée. Les effets sonores répétés utilisent le cache audio. Une erreur de génération laisse le cache disponible pour réessayer.

## Étape 2 : renseigner l'URL de base, la clé API et le modèle

Passe cette étape si tu as choisi une connexion Audio comme Source : Marinara utilise les réglages propres à la connexion.

Chaque Source a besoin d'une adresse web et, pour la plupart d'entre elles, d'une clé API. Une clé API est un code secret fourni par le fournisseur, un peu comme un mot de passe, qui prouve que la requête vient bien de toi.

1. Vérifie le champ **Base URL** (URL de base). Chaque Source y place une valeur par défaut pertinente, indiquée dans le tableau ci-dessous. Ne la modifie que si tu passes par un proxy ou par un serveur auto-hébergé.
2. Colle la clé du fournisseur dans le champ **API Key** (clé API). Pour conserver une clé existante, laisse les points masqués en place. Pour supprimer une clé enregistrée, vide le champ.
3. Vérifie le champ **Model** (modèle). Chaque Source y place un modèle par défaut. Tu peux saisir le nom d'un autre modèle pris en charge par le fournisseur.

L'application pré-remplit ces valeurs par défaut selon la Source :

| Source            | URL de base par défaut    | Modèle par défaut      | Voix pré-remplie par l'application |
| ----------------- | ------------------------- | ---------------------- | ---------------------------------- |
| OpenAI-compatible | https://api.openai.com/v1 | tts-1                  | alloy                              |
| ElevenLabs        | https://api.elevenlabs.io | eleven_multilingual_v2 | aucune (tu dois en choisir une)    |
| PocketTTS         | http://localhost:8000    | pocket-tts             | alba                               |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                                |

Pour **ElevenLabs**, le champ **Model** charge les modèles capables de parole accessibles via la connexion, et garde toujours la liste complète visible à l'ouverture. Choisis un modèle de parole classique. Les identifiants de modèle qui contiennent `ttv` désignent des modèles de conception de voix, pas des modèles de parole : ils ne savent pas lire un texte à voix haute. Si tu en choisis un par erreur, la lecture échoue avec une erreur qui t'invite à utiliser un modèle de parole.

### PocketTTS est un programme à part

PocketTTS n'est pas intégré à Marinara Engine. Installe [le serveur officiel de PocketTTS](https://github.com/kyutai-labs/pocket-tts) séparément, puis démarre-le avec `uvx pocket-tts serve`. Marinara ne le télécharge pas et ne le gère pas pour toi.

Le serveur officiel utilise `http://localhost:8000` par défaut. Garde cette valeur dans **Base URL**, sauf si tu as changé l'hôte ou le port. Marinara détecte automatiquement l'API multipart officielle `/tts`. Les URL personnalisées existantes de l'[adaptateur PocketTTS compatible avec OpenAI](https://github.com/teddybear082/pocket-tts-openai_streaming_server) restent prises en charge.

<a id="request-timeout"></a>

### Délai d'attente des requêtes

Par défaut, Marinara attend jusqu'à 60 secondes pour chaque réplique lue. Un serveur vocal sur ton propre ordinateur, surtout un portable, peut avoir besoin de plus de temps pour une longue réplique. Pour attendre plus longtemps, augmente **Request timeout (seconds)** sous **Model** dans la carte. Tu peux régler entre 10 et 3 600 secondes.

Une connexion audio a son propre champ **Request timeout (seconds)**, sous **Default Voice** dans l'éditeur de connexion. Quand les chats parlent via une connexion audio, y compris une connexion choisie comme **Source** de la carte, ils utilisent la limite de cette connexion. La limite de la carte couvre la synthèse vocale issue des réglages propres à la carte, y compris son bouton **Preview** (aperçu).

Si une réplique prend trop de temps, l'erreur indique combien de secondes Marinara a attendu et quel réglage augmenter.

## Étape 3 : choisir une voix (Voice Option)

Le réglage **Voice Option** détermine la façon dont les voix sont attribuées :

- **One voice for all characters** : tous les intervenants utilisent la même voix. C'est l'option par défaut.
- **Selected per character** : tu donnes leur propre voix aux personnages de ton choix.

### Une seule voix pour tous les personnages (One voice for all characters)

Choisis la voix dans le champ **All Characters Voice**. Le serveur officiel de PocketTTS n'expose pas de point de terminaison pour lister les voix ; Marinara affiche donc ses voix intégrées et conserve un champ texte à côté du menu déroulant pour un autre nom intégré ou une URL de voix prise en charge. Les serveurs adaptateurs compatibles peuvent toujours renvoyer leur propre liste de voix et accepter des identifiants ou chemins personnalisés.

Pour charger la vraie liste de voix du fournisseur, renseigne les informations de connexion puis clique sur le bouton **Refresh voices** (actualiser les voix), l'icône en forme de flèche circulaire. Tu peux le faire avant même d'activer la lecture. L'actualisation enregistre d'abord la carte : une clé API tout juste saisie est donc prise en compte immédiatement. Tant que la connexion n'est pas établie, l'application affiche une courte liste de secours intégrée pour que le champ ne reste pas vide. En cas d'erreur du fournisseur, elle affiche cette erreur au lieu de faire passer la liste de secours pour une actualisation réussie.

Pour **ElevenLabs**, tu dois obligatoirement choisir une voix. Marinara charge la bibliothèque du compte page par page : voix personnelles, voix de l'espace de travail, voix enregistrées et voix par défaut. Le sélecteur propose un champ de recherche et une barre de défilement toujours visible quand la bibliothèque dépasse la hauteur du panneau. Il indique aussi combien de voix ont été chargées. Il démarre sur "Select an ElevenLabs voice", et la lecture reste bloquée tant qu'une vraie voix n'est pas choisie.

### Une voix par personnage (Selected per character)

1. Règle **Voice Option** sur **Selected per character**.
2. Le tableau **Character Voices** apparaît, avec les colonnes **Character** et **Voice**.
3. Clique sur **Add character voice** (ajouter une voix de personnage) pour ajouter une ligne.
4. Choisis un personnage dans le menu déroulant de gauche et une voix dans celui de droite.
5. Répète l'opération pour chaque personnage à qui tu veux donner une voix personnalisée.

Tu peux aussi choisir la voix d'un personnage dans le **Character Editor** (éditeur de personnage), sur son onglet **Voice**. Ce choix modifie la même ligne, si bien que les deux endroits affichent toujours la même voix.

Le bouton **Refresh** de l'encadré Character Voices recharge la même bibliothèque du fournisseur sans repasser en mode voix unique. Les personnages doivent exister au préalable. Si tu n'en as encore aucun, l'application t'invite à en ajouter dans l'onglet Characters avant d'attribuer des voix. Un personnage sans voix personnelle utilise celle qui est définie pour une fiche au nom correspondant, par exemple l'original d'une copie AU (univers alternatif). Sinon, il retombe sur la voix globale. Voir [Créer et modifier des personnages](../characters/creating-and-editing-characters.md).

## Voix du narrateur (Narrator Voice)

La narration, c'est le texte qu'aucun personnage ne prononce : description de scène, répliques du game master, etc. Tu peux lui donner une voix distincte.

1. Dans l'encadré **Narrator Voice**, active **Use separate narrator voice** (utiliser une voix de narrateur distincte).
2. Choisis une voix dans le sélecteur qui apparaît.

L'application emploie cette voix quand le locuteur d'une réplique est Narrator, GM, Game Master ou System. Cela fonctionne pour les messages en Roleplay et en Conversation. Cela couvre aussi les lignes de narration du Game Mode sans locuteur nommé. Avec ElevenLabs, choisis une voix de narrateur ici. Si tu laisses le champ vide, la narration ne bascule sur une autre voix que si une voix globale est définie.

## Voix aléatoires des PNJ (Random NPC Voices, Game Mode uniquement)

Cette fonctionnalité attribue des voix de réserve aux personnages secondaires du jeu. Elle ne marche qu'en Game Mode, et uniquement pour les PNJ (personnages non-joueurs) suivis par le Game Mode. Elle n'a aucun effet en Roleplay ni en Conversation.

1. Dans l'encadré **Random NPC Voices**, active **Use default voices for random NPCs** (utiliser des voix par défaut pour les PNJ aléatoires).
2. Deux grilles de cases à cocher apparaissent : **Male NPC defaults** et **Female NPC defaults**.
3. Coche les voix dans lesquelles chaque réserve doit puiser.

Un PNJ suivi qui n'a pas de voix personnelle reçoit une voix stable, tirée de la réserve correspondante. Le même PNJ garde la même voix pendant toute la session. Un PNJ à qui une voix de personnage a été attribuée conserve toujours cette voix. Si l'application ne détecte pas de voix étiquetées masculines ou féminines, chaque réserve utilise la liste complète des voix.

## Format audio et vitesse

Le réglage **Audio Format** permet de choisir **MP3** (le format par défaut) ou **WAV**. Utilise WAV pour les serveurs locaux ou auto-hébergés incapables de produire du MP3. Deux remarques :

- Le réglage **Audio Format** est masqué pour ElevenLabs, qui utilise toujours le MP3.
- Il s'affiche pour xAI Voice, mais n'y a aucun effet : xAI Voice renvoie toujours du MP3.

Le curseur **Speed** règle la vitesse d'élocution de la voix. La plage autorisée dépend de la Source :

- OpenAI-compatible : de 0.25 à 4.0 fois la vitesse normale.
- PocketTTS : les adaptateurs compatibles peuvent utiliser le réglage de vitesse de 0.25 à 4.0 ; le serveur officiel contrôle actuellement lui-même la vitesse de synthèse.
- ElevenLabs : de 0.7 à 1.2 fois.
- xAI Voice : de 0.7 à 1.5 fois.

Si une vitesse enregistrée sort de la plage de la Source active, l'application la ramène à la valeur autorisée la plus proche au moment de lire.

Pour **ElevenLabs** uniquement, deux réglages supplémentaires apparaissent. **Language** impose une langue parlée, ou reste sur **Auto detect**. **Stability** fait varier la voix entre plus expressive et plus régulière.

## Auto-play : lire les messages automatiquement

Sous le titre **Auto-play**, chaque interrupteur demande à l'application de lire un type de nouveau message dès que sa génération se termine. Tous exigent que **Enable TTS** soit activé au préalable. Chaque interrupteur est désactivé au départ.

- **Roleplay messages** : lit les nouvelles réponses en Roleplay.
- **Conversation messages** : lit les nouvelles réponses du mode Conversation.
- **Game narration** : lit les nouvelles lignes de narration et de combat du Game Mode.
- **Progressive playback** : quand une réponse compte plusieurs lignes, lance la lecture de la première tout de suite, sans attendre la réponse entière.
- **Only read dialogues** : ne lit que les répliques entre guillemets ou balisées, et saute la narration simple.

En Roleplay, la préparation de la voix commence dès que la réponse principale est enregistrée. L'extraction des locuteurs et des émotions part de ce texte sans attendre les agents sans rapport avec cette étape. Si un agent actif réécrit la réponse, comme Prose Guardian, Marinara attend le texte réécrit définitif avant de préparer la voix.

La lecture automatique ne se déclenche qu'une fois, sur la réponse la plus récente, au moment où elle se termine. Elle ne relit pas les anciens messages quand tu rouvres un chat ou que tu le fais défiler.

Les mêmes réglages de lecture proposent aussi **Skip text inside HTML and custom tags** (ignorer le texte dans les balises HTML et personnalisées), **Skip fenced code blocks** (ignorer les blocs de code délimités) et **Skip text inside square brackets** (ignorer le texte entre crochets). Les blocs de code sont ignorés par défaut ; les deux autres filtres sont initialement désactivés. Le filtre de balises retire le texte contenu, par exemple un bloc caché `<simulation>...</simulation>`, mais conserve les balises de locuteur utilisées pour choisir les voix. Ces filtres s'appliquent à la lecture manuelle et automatique, y compris à la narration Game et à l'identification des locuteurs en Roleplay.

Active **Roleplay speaker extractor** (identification des locuteurs en Roleplay) pour afficher **Enable emotion indicators** (activer les indications d'émotion). Quand les indications d'émotion sont activées, le texte entre crochets est conservé pour le service de synthèse vocale même si **Skip text inside square brackets** est activé. Cela peut inclure des notes. Pour que les notes entre crochets ne soient pas lues, désactive les indications d'émotion et laisse l'option d'exclusion activée.

Les consignes vocales comme `[Low, steady voice, restrained urgency]` restent entières lorsqu'une longue ligne est découpée pour la synthèse vocale. Les étiquettes de locuteur et de scène reconnues sont toujours supprimées. Le modèle vocal décide comment utiliser chaque consigne.

**Roleplay speaker extractor** ajoute des consignes sans changer les mots du dialogue d'origine. Lorsque **Enable TTS** et **Game narration** sont activés et que les indications d'émotion le sont aussi, les dialogues des scènes, de l'équipe et des combats en Game Mode peuvent aussi contenir ces consignes.

## Lire un message précis

Une fois le TTS activé, un bouton **Speak** (icône de microphone) apparaît dans la barre d'outils sous chaque message de personnage ou de narrateur. Il lit ce message précis, à la demande.

- Clique sur **Speak** pour lire le message. Pendant la récupération de l'audio, le bouton affiche un état de chargement.
- Clique de nouveau pendant la lecture pour l'arrêter. L'infobulle indique **Stop speaking** tant qu'un message est en cours de lecture.
- Un message sans texte lisible (une image seule, par exemple) affiche **No dialogue to speak** et reste désactivé.

Pendant la lecture d'un message, deux boutons supplémentaires apparaissent. **Pause speaking** et **Resume speaking** suspendent et reprennent la lecture. **Restart speaking** relance le message depuis le début.

Le bouton en forme de haut-parleur ouvre un curseur **Line volume**, gradué de 0 à 100 pour cent, réglé sur 50 par défaut. Ce volume est un réglage enregistré à part. Il est indépendant du mixeur du Game Mode et du volume des appels en Conversation : modifier l'un ne change pas les autres.

## Clips en cache

L'application conserve l'audio généré dans le navigateur, pour ne pas avoir à générer deux fois la même ligne. Le panneau **Cached clips** (clips en cache) affiche un compteur en direct et la taille totale.

Clique sur le bouton **Export cached TTS clips** (exporter les clips TTS en cache), l'icône de téléchargement, pour enregistrer chaque clip du cache sur ton appareil sous forme de fichiers audio séparés. Le cache supprime tout seul ses clips les plus anciens. L'application ne propose pas de bouton d'effacement manuel : efface les données du navigateur si tu veux le vider.

## Le TTS dans chaque mode de chat

La même configuration TTS sert à tous les modes, avec quelques ajouts propres à chacun :

- Le Roleplay utilise l'interrupteur de lecture automatique **Roleplay messages** et les commandes **Speak** message par message. Voir [Roleplay : premiers pas](../roleplay/getting-started.md).
- Le mode Conversation utilise l'interrupteur **Conversation messages** et les mêmes commandes **Speak**. Les appels audio font l'objet d'une fonctionnalité plus vaste, décrite dans [Appels audio et vidéo en Conversation](../conversation/calls.md).
- Le Game Mode utilise l'interrupteur **Game narration**. Le Game Mode dispose aussi de son propre mixeur audio, avec un canal **TTS** à côté de **Master**, **Music**, **Sound Effects** et **Ambient**. Ce canal fixe le volume global de l'audio parlé du jeu et démarre à 100 pour cent. Voir [Les contrôles du jeu](../game/getting-started.md#the-games-controls).

## Nom phonétique (prononciation pendant les appels)

Si le nom d'un personnage ou d'un persona, le personnage que tu incarnes, s'écrit d'une façon que la voix prononce mal, tu peux ajouter un **Phonetic name** (nom phonétique). Dans le **Character Editor**, le champ se trouve sur l'onglet **Voice**. Dans le **Persona Editor** (éditeur de persona), il figure avec les autres informations de base. Saisis la prononciation attendue.

Cette surcharge ne sert que pendant les appels audio et vidéo en Conversation. Le bouton **Speak** message par message, la lecture automatique du chat et la narration du Game Mode ne tiennent pas compte de ce champ.

## Dépannage

- La carte affiche **Missing Audio connection** : la connexion Audio choisie comme Source a été supprimée ou est inutilisable. Choisis une autre Source. Voir [Utiliser une connexion Audio](#use-an-audio-connection).
- Rien ne se lit : vérifie que l'interrupteur **Enable TTS** est activé. Regarde ensuite le bon interrupteur **Auto-play** pour le mode concerné, ou utilise le bouton **Speak** du message. Le bouton **Speak** et les options de lecture automatique n'apparaissent qu'une fois le TTS activé.
- Aucune voix dans le menu déroulant : enregistre la carte avec le TTS activé et, si le fournisseur en demande une, une clé API valide, puis clique sur **Refresh voices**. Le serveur officiel de PocketTTS utilise la liste intégrée de Marinara, car il n'a pas de point de terminaison pour lister les voix. Pour un adaptateur PocketTTS compatible, vérifie que `<Base URL>/v1/voices` répond.
- ElevenLabs refuse de parler : vérifie que tu as bien sélectionné une vraie voix, et non le texte indicatif "Select an ElevenLabs voice". Vérifie aussi que le **Model** est un modèle de parole, et non un modèle de conception de voix dont l'identifiant contient `ttv`.
- Une réplique s'arrête avec **No audio after 60 s** : le serveur vocal a besoin de plus de temps. Augmente **Request timeout (seconds)** à l'endroit indiqué par le message. Voir [Délai d'attente des requêtes](#request-timeout).
- Un serveur TTS auto-hébergé sur une adresse locale est bloqué : active le réglage serveur `TTS_LOCAL_URLS_ENABLED`. Il autorise l'application à joindre une adresse locale ou privée pour les serveurs OpenAI-compatible ou de type ElevenLabs. PocketTTS n'a pas besoin de ce réglage. Voir [Référence de configuration du serveur](../CONFIGURATION.md).
- Tester la configuration rapidement : clique sur le bouton **Preview** de la carte pour jouer un court extrait avec les réglages en cours.

## Guides associés

- [Appels audio et vidéo en Conversation](../conversation/calls.md)
- [Synchronisation labiale avec la synthèse vocale](../agents/avatars.md#lip-sync-with-text-to-speech) pour les avatars 2D et 3D
- [Roleplay : premiers pas](../roleplay/getting-started.md)
- [Game Mode : premiers pas](../game/getting-started.md)
- [Fournisseurs d'IA pris en charge](../connections/providers-reference.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
