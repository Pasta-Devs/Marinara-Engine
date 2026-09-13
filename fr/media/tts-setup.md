# Configuration du Text to Speech (TTS)

Ce guide explique comment configurer le Text to Speech dans Marinara Engine pour que l'application lise à voix haute les messages et la narration du jeu. Le Text to Speech (TTS), ou synthèse vocale, transforme le texte écrit du chat en audio parlé. Au programme : choisir un fournisseur de voix, sélectionner les voix, la lecture automatique et les commandes de lecture message par message.

## Où se trouvent les réglages TTS

Presque tous les réglages TTS sont regroupés au même endroit. Ouvre le panneau **Connections** (Connexions) et repère la carte **Text to Speech**. Elle est repliée par défaut : clique sur son en-tête pour la déployer.

L'application fait passer les requêtes TTS par son propre serveur. Marinara chiffre la clé API du fournisseur avant de l'enregistrer sur le serveur. Une fois la clé enregistrée, le champ n'affiche plus qu'une valeur masquée, une rangée de points, à la place de la vraie clé. La vraie clé n'est jamais renvoyée vers le navigateur.

Activer le TTS ne déclenche aucune lecture en soi. Cela fait seulement apparaître le bouton **Speak** (lire à voix haute) sur chaque message et les options **Auto-play** (lecture automatique). C'est toi qui décides ce qui est lu, et quand.

Les mêmes réglages de lecture proposent aussi **Skip text inside HTML and custom tags** (ignorer le texte dans les balises HTML et personnalisées), **Skip fenced code blocks** (ignorer les blocs de code délimités) et **Skip text inside square brackets** (ignorer le texte entre crochets). Les blocs de code sont ignorés par défaut ; les deux autres filtres sont initialement désactivés. Le filtre de balises retire le texte contenu, par exemple un bloc caché `<simulation>...</simulation>`, mais conserve les balises de locuteur utilisées pour choisir les voix. Ces filtres s'appliquent à la lecture manuelle et automatique, y compris à la narration Game et à l'identification des locuteurs en Roleplay.

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

## Étape 2 : renseigner l'URL de base, la clé API et le modèle

Chaque Source a besoin d'une adresse web et, pour la plupart d'entre elles, d'une clé API. Une clé API est un code secret fourni par le fournisseur, un peu comme un mot de passe, qui prouve que la requête vient bien de toi.

1. Vérifie le champ **Base URL** (URL de base). Chaque Source y place une valeur par défaut pertinente, indiquée dans le tableau ci-dessous. Ne la modifie que si tu passes par un proxy ou par un serveur auto-hébergé.
2. Colle la clé du fournisseur dans le champ **API Key** (clé API). Pour conserver une clé existante, laisse les points masqués en place. Pour supprimer une clé enregistrée, vide le champ.
3. Vérifie le champ **Model** (modèle). Chaque Source y place un modèle par défaut. Tu peux saisir le nom d'un autre modèle pris en charge par le fournisseur.

L'application pré-remplit ces valeurs par défaut selon la Source :

| Source            | URL de base par défaut    | Modèle par défaut      | Voix pré-remplie par l'application |
| ----------------- | ------------------------- | ---------------------- | ---------------------------------- |
| OpenAI-compatible | https://api.openai.com/v1 | tts-1                  | alloy                              |
| ElevenLabs        | https://api.elevenlabs.io | eleven_multilingual_v2 | aucune (tu dois en choisir une)    |
| PocketTTS         | http://localhost:49112    | pocket-tts             | alba                               |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                                |

Pour **ElevenLabs**, le champ **Model** charge les modèles capables de parole accessibles via la connexion, et garde toujours la liste complète visible à l'ouverture. Choisis un modèle de parole classique. Les identifiants de modèle qui contiennent `ttv` désignent des modèles de conception de voix, pas des modèles de parole : ils ne savent pas lire un texte à voix haute. Si tu en choisis un par erreur, la lecture échoue avec une erreur qui t'invite à utiliser un modèle de parole.

### PocketTTS est un programme à part

PocketTTS n'est pas intégré à Marinara Engine. L'adaptateur de Marinara s'appuie sur le [serveur PocketTTS compatible OpenAI](https://github.com/teddybear082/pocket-tts-openai_streaming_server), qui expose à la fois le point d'accès de synthèse et celui de la liste des voix dont Marinara a besoin. Installe et lance ce serveur en suivant ses instructions : Marinara ne le télécharge pas et ne le gère pas à ta place.

Le serveur compatible utilise `http://localhost:49112` par défaut. Laisse le champ **Base URL** sur cette valeur, sauf si tu as changé le port du serveur. Les URL PocketTTS personnalisées déjà en place restent inchangées.

## Étape 3 : choisir une voix (Voice Option)

Le réglage **Voice Option** détermine la façon dont les voix sont attribuées :

- **One voice for all characters** : tous les intervenants utilisent la même voix. C'est l'option par défaut.
- **Selected per character** : tu donnes leur propre voix aux personnages de ton choix.

### Une seule voix pour tous les personnages (One voice for all characters)

Choisis la voix dans le champ **All Characters Voice**. Avec PocketTTS, un menu déroulant liste les voix renvoyées par le serveur, et un champ texte à côté accepte un identifiant de voix, une URL ou un chemin personnalisé.

Pour charger la vraie liste de voix du fournisseur, renseigne les informations de connexion puis clique sur le bouton **Refresh voices** (actualiser les voix), l'icône en forme de flèche circulaire. Tu peux le faire avant même d'activer la lecture. L'actualisation enregistre d'abord la carte : une clé API tout juste saisie est donc prise en compte immédiatement. Tant que la connexion n'est pas établie, l'application affiche une courte liste de secours intégrée pour que le champ ne reste pas vide. En cas d'erreur du fournisseur, elle affiche cette erreur au lieu de faire passer la liste de secours pour une actualisation réussie.

Pour **ElevenLabs**, tu dois obligatoirement choisir une voix. Marinara charge la bibliothèque du compte page par page : voix personnelles, voix de l'espace de travail, voix enregistrées et voix par défaut. Le sélecteur propose un champ de recherche et une barre de défilement toujours visible quand la bibliothèque dépasse la hauteur du panneau. Il indique aussi combien de voix ont été chargées. Il démarre sur "Select an ElevenLabs voice", et la lecture reste bloquée tant qu'une vraie voix n'est pas choisie.

### Une voix par personnage (Selected per character)

1. Règle **Voice Option** sur **Selected per character**.
2. Le tableau **Character Voices** apparaît, avec les colonnes **Character** et **Voice**.
3. Clique sur **Add character voice** (ajouter une voix de personnage) pour ajouter une ligne.
4. Choisis un personnage dans le menu déroulant de gauche et une voix dans celui de droite.
5. Répète l'opération pour chaque personnage à qui tu veux donner une voix personnalisée.

Le bouton **Refresh** de l'encadré Character Voices recharge la même bibliothèque du fournisseur sans repasser en mode voix unique. Les personnages doivent exister au préalable. Si tu n'en as encore aucun, l'application t'invite à en ajouter dans l'onglet Characters avant d'attribuer des voix. Les personnages sans voix personnelle retombent sur la voix globale. Voir [Créer et modifier des personnages](../characters/creating-and-editing-characters.md).

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

- OpenAI-compatible et PocketTTS : de 0.25 à 4.0 fois la vitesse normale.
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

La lecture automatique ne se déclenche qu'une fois, sur la réponse la plus récente, au moment où elle se termine. Elle ne relit pas les anciens messages quand tu rouvres un chat ou que tu le fais défiler.

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
- Le Game Mode utilise l'interrupteur **Game narration**. Le Game Mode dispose aussi de son propre mixeur audio, avec un canal **TTS** à côté de **Master**, **Music**, **Sound Effects** et **Ambient**. Ce canal fixe le volume global de l'audio parlé du jeu et démarre à 100 pour cent. Voir [Game Mode : premiers pas](../game/getting-started.md).

## Nom phonétique (prononciation pendant les appels)

Si le nom d'un personnage ou d'un persona, le personnage que tu incarnes, s'écrit d'une façon que la voix prononce mal, tu peux ajouter un **Phonetic name** (nom phonétique). Dans le **Character Editor** (éditeur de personnage), le champ se trouve à côté du champ **Name**. Dans le **Persona Editor** (éditeur de persona), il figure avec les autres informations de base. Saisis la prononciation attendue.

Cette surcharge ne sert que pendant les appels audio et vidéo en Conversation. Le bouton **Speak** message par message, la lecture automatique du chat et la narration du Game Mode ne tiennent pas compte de ce champ.

## Dépannage

- Rien ne se lit : vérifie que l'interrupteur **Enable TTS** est activé. Regarde ensuite le bon interrupteur **Auto-play** pour le mode concerné, ou utilise le bouton **Speak** du message. Le bouton **Speak** et les options de lecture automatique n'apparaissent qu'une fois le TTS activé.
- Aucune voix dans le menu déroulant : enregistre la carte avec le TTS activé et une clé API valide, puis clique sur **Refresh voices**. Avec PocketTTS, vérifie aussi que `<Base URL>/v1/voices` répond bien depuis le serveur compatible.
- ElevenLabs refuse de parler : vérifie que tu as bien sélectionné une vraie voix, et non le texte indicatif "Select an ElevenLabs voice". Vérifie aussi que le **Model** est un modèle de parole, et non un modèle de conception de voix dont l'identifiant contient `ttv`.
- Un serveur TTS auto-hébergé sur une adresse locale est bloqué : active le réglage serveur `TTS_LOCAL_URLS_ENABLED`. Il autorise l'application à joindre une adresse locale ou privée pour les serveurs OpenAI-compatible ou de type ElevenLabs. PocketTTS n'a pas besoin de ce réglage. Voir [Référence de configuration du serveur](../CONFIGURATION.md).
- Tester la configuration rapidement : clique sur le bouton **Preview** (aperçu) de la carte pour jouer un court extrait avec les réglages en cours.

## Guides associés

- [Appels audio et vidéo en Conversation](../conversation/calls.md)
- [Roleplay : premiers pas](../roleplay/getting-started.md)
- [Game Mode : premiers pas](../game/getting-started.md)
- [Fournisseurs d'IA pris en charge](../connections/providers-reference.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
