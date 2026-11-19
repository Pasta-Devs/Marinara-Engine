# Configuration du Text to Speech (TTS)

Le Text to Speech (TTS), ou synthèse vocale, lit à voix haute les messages du chat et la narration du jeu. Ce guide explique comment l'activer, choisir un service de voix et des voix, configurer la lecture automatique et utiliser les commandes de chaque message.

## Démarrage rapide

1. Clique sur **Connections** (Connexions) dans la barre du haut, puis sur **Add** (ajouter).
2. Clique sur **Voice** (voix) dans les filtres de type, choisis un service et colle ta clé dans **API key**. Clique sur **Connect** (connecter).
3. Sous **Found in … — use it for:**, coche **Voice**, puis clique sur **Done** (terminé). Choisir un modèle Voice active la synthèse vocale.
4. Clique sur l'engrenage de la ligne **Voice** de l'encadré **Jobs** (tâches), puis sur **Preview** (aperçu) pour écouter un exemple. Dans un chat, clique sur **Speak** (lire à voix haute) sous un message.

## Activer la synthèse vocale

Choisir un modèle pour la tâche **Voice** active la synthèse vocale. Rien ne se met à parler tout seul. Le bouton **Speak** apparaît sur chaque message, ainsi que les options **Auto-play**. Tu choisis toujours ce qui est lu et quand.

1. Clique sur **Connections** dans la barre du haut. Repère la ligne **Voice** sous **Pictures & sound** (images et son) dans l'encadré **Jobs**.
2. Clique sur la ligne et choisis un modèle vocal ou un service vocal. La ligne affiche ton choix.
3. Clique sur l'engrenage de la ligne pour ouvrir les réglages de la voix. Si tu n'as pas encore de compte vocal, clique sur **Add** dans la ligne ou ajoutes-en un comme dans le démarrage rapide.
4. Pour désactiver la synthèse vocale, clique sur la ligne et choisis **Turn voice off** (désactiver la voix). La ligne affiche **Off** (désactivé) et rien n'est lu à voix haute.

Un service vocal est le service qui produit l'audio. Marinara prend en charge ceux-ci :

- **OpenAI-compatible** : OpenAI ou tout serveur qui reproduit le format TTS d'OpenAI. C'est le choix par défaut.
- **ElevenLabs** : le service vocal d'ElevenLabs.
- **PocketTTS** : un serveur vocal gratuit que tu fais tourner sur ton propre ordinateur.
- **xAI Voice** : le service vocal de xAI.

Marinara conserve un profil séparé pour chaque service vocal : sa clé, son adresse, son modèle, ses voix et ses paramètres. Changer de service restaure sa configuration précédente. Un service que tu n'as pas encore configuré commence avec les valeurs par défaut.

Les requêtes passent par le serveur de Marinara. Ta clé API est stockée chiffrée sur le serveur. Après l'enregistrement, le champ affiche des points et la vraie clé ne revient jamais dans ton navigateur.

<a id="use-an-audio-connection"></a><a id="use-a-voice-model-from-an-account"></a>

### Utiliser un modèle Voice d'un compte

Si tu as déjà ajouté un compte **Audio** (voir [Fournisseurs d'IA pris en charge](../connections/providers-reference.md#audio)), tu n'as pas à saisir à nouveau ses informations. Ses modèles vocaux apparaissent dans le sélecteur **Voice**.

1. Clique sur la ligne **Voice** de l'encadré **Jobs** et choisis le modèle.
2. Clique sur l'engrenage de la ligne. Choisis tes voix et les autres réglages.

Marinara utilise alors l'adresse, la clé, le modèle et **Request timeout (seconds)** de ce compte. Les réglages de la voix n'affichent donc pas ces champs. La clé reste dans le compte ; elle n'est jamais copiée dans les réglages de la voix ni envoyée à ton navigateur. Les changements du compte, comme une nouvelle clé, s'appliquent immédiatement.

Les voix, la vitesse et les autres réglages vocaux sont enregistrés par compte. Deux comptes du même type ne les partagent jamais. Tes réglages pour les quatre services vocaux habituels restent inchangés.

Si le compte choisi est supprimé ou inutilisable, la ligne affiche **The voice account is missing** (le compte vocal est introuvable). Rien n'est lu tant que tu ne choisis pas un autre modèle vocal. Marinara ne change jamais de compte tout seul.

## Renseigner l'adresse, la clé et le modèle

La fenêtre **Add account** (ajouter un compte) demande uniquement la clé ou l'adresse. Pour les modifier ensuite, clique sur **⋯** sur le compte dans **Connections**, puis sur **Edit account** (modifier le compte). Passe cette étape si tu as choisi un compte Audio. Le compte fournit ces informations.

1. Vérifie **Address** (adresse). Chaque service renseigne une valeur par défaut (tableau ci-dessous). Ne la change que pour un proxy ou un serveur que tu fais tourner.
2. Colle ta clé dans **API key**. Pour conserver une clé existante, laisse les points. Pour la supprimer, vide le champ.
3. Choisis le modèle ou saisis un autre identifiant de modèle que ton service prend en charge.

| Service vocal | Adresse par défaut | Modèle par défaut | Voix par défaut |
| --- | --- | --- | --- |
| OpenAI-compatible | `https://api.openai.com/v1` | `tts-1` | `alloy` |
| ElevenLabs | `https://api.elevenlabs.io` | `eleven_multilingual_v2` | aucune, tu dois en choisir une |
| PocketTTS | `http://localhost:8000` | `pocket-tts` | `alba` |
| xAI Voice | `https://api.x.ai/v1` | `grok-tts` | `eve` |

Pour **ElevenLabs**, la liste des modèles charge les modèles vocaux accessibles à ton compte. Choisis un modèle vocal normal. Les identifiants de modèle qui contiennent `ttv` désignent des modèles de création de voix qui ne peuvent pas lire du texte. Si tu en choisis un, la lecture échoue avec une erreur qui te demande d'utiliser un modèle vocal.

### PocketTTS

PocketTTS n'est pas intégré à Marinara. Installe [le serveur officiel de PocketTTS](https://github.com/kyutai-labs/pocket-tts) séparément, puis démarre-le avec `uvx pocket-tts serve`. Marinara ne le télécharge pas et ne le gère pas. Le serveur officiel utilise `http://localhost:8000`. Garde cette valeur dans **Address**, sauf si tu as changé l'hôte ou le port. Marinara détecte l'API multipart officielle `/tts`. Les URL personnalisées de l'[adaptateur PocketTTS compatible avec OpenAI](https://github.com/teddybear082/pocket-tts-openai_streaming_server) fonctionnent toujours.

<a id="request-timeout"></a>

### Délai d'attente des requêtes

Marinara attend jusqu'à 60 secondes pour chaque ligne parlée. Un serveur vocal sur ton propre ordinateur, surtout un portable, peut avoir besoin de plus de temps pour une longue ligne. Augmente **Request timeout (seconds)** sous **More** (plus) dans **Voice settings** (réglages de la voix ; l'engrenage sur la ligne **Voice** de l'encadré **Jobs**). La plage va de 10 à 3 600 secondes.

Un compte Audio a son propre **Request timeout (seconds)**, sous **Default voice** (voix par défaut) dans la fenêtre **Edit model** (modifier le modèle) de son modèle et dans **Voice settings**. Les chats qui utilisent un compte Audio pour parler, y compris un compte choisi pour la tâche **Voice**, utilisent cette limite. La limite de **Voice settings** couvre la synthèse à partir de ces réglages, y compris **Preview**. Si une ligne prend trop de temps, l'erreur indique combien de secondes Marinara a attendu et quel réglage augmenter.

## Choisir les voix

Chaque personne qui parle utilise **Shared voice** (voix partagée) tant que tu ne donnes pas une voix propre à un personnage ou à un persona. La section **Who speaks** (qui parle) de **Voice settings** regroupe ces deux options.

### Une seule voix pour tous (One voice for all)

Choisis la voix dans **Shared voice**. Pour charger la vraie liste de voix de ton service, clique sur **Refresh voices from provider** (actualiser les voix du fournisseur, l'icône de flèche circulaire). Avant la connexion, une courte liste intégrée s'affiche pour que le champ ne soit pas vide. Une erreur du service est affichée, au lieu de présenter la liste de repli comme une actualisation réussie.

Le serveur officiel de PocketTTS n'a pas de point d'accès pour lister les voix : Marinara affiche donc ses voix intégrées et garde un champ de texte à côté de la liste pour un autre nom intégré ou une URL de voix prise en charge. Les serveurs adaptateurs compatibles peuvent renvoyer leur propre liste et accepter des identifiants ou des chemins personnalisés.

Pour **ElevenLabs**, tu dois choisir une voix. Marinara charge toute la bibliothèque du compte : voix personnelles, voix de l'espace de travail, voix enregistrées et voix par défaut. Le sélecteur propose un champ de recherche et indique le nombre de voix chargées. Il démarre sur "Select an ElevenLabs voice", et la lecture reste bloquée tant que tu n'as pas choisi une vraie voix.

### Une voix par personnage ou persona (Selected per character or persona)

1. Dans **Character and persona voices** (voix des personnages et personas), clique sur **Add voice** (ajouter une voix).
2. Choisis un personnage ou un persona dans la liste de gauche et une voix dans celle de droite.
3. Répète pour chacun.

Tu peux aussi définir la voix d'un personnage sur l'onglet **Voice** du **Character Editor** (éditeur de personnage). Ce choix modifie la même ligne. Tant que les personnages partagent une voix, l'onglet indique **All characters share one voice right now.** Clique sur **Use a voice per character** pour changer, puis choisis une voix. Clique sur **Open Text to Speech settings** pour ouvrir **Voice settings**. **Refresh** (actualiser) dans **Character and persona voices** recharge la liste des voix. Crée d'abord tes personnages. Si tu n'en as aucun, l'application t'invite à ajouter un personnage ou un persona avant d'attribuer des voix.

Un personnage sans voix personnelle utilise la voix d'une fiche au nom correspondant, par exemple l'original d'une copie AU (univers alternatif). Sinon, il utilise la voix partagée. Voir [Créer et modifier des personnages](../characters/creating-and-editing-characters.md).

### Voix du narrateur

La narration, c'est le texte qu'aucun personnage ne prononce, comme une description de scène ou les répliques d'un Game Master (le maître du jeu).

1. Dans **Narrator voice** (voix du narrateur), active **Use separate narrator voice** (utiliser une voix de narrateur distincte).
2. Choisis une voix.

Elle sert quand le locuteur d'une réplique est Narrator, GM, Game Master ou System, dans les messages Roleplay et Conversation, ainsi que pour la narration de Game Mode sans locuteur nommé. Avec ElevenLabs, choisis une voix de narrateur ici. Si tu laisses ce champ vide, la narration ne se rabat sur une autre voix que si une voix globale est définie.

### Voix aléatoires des PNJ (Game Mode uniquement)

Ce réglage attribue des voix de réserve aux personnages secondaires du jeu que Game Mode suit, les PNJ (personnages non-joueurs). Il n'a aucun effet en Roleplay ni en Conversation.

1. Dans **Random NPC voices** (voix aléatoires des PNJ), active **Use default voices for random NPCs** (utiliser des voix par défaut pour les PNJ aléatoires).
2. Coche des voix dans **Male NPC defaults** (voix par défaut des PNJ masculins) et **Female NPC defaults** (voix par défaut des PNJ féminins).

Un PNJ suivi sans voix personnelle reçoit une voix stable tirée de la réserve correspondante et la garde pendant toute la session. Un PNJ à qui une voix a été attribuée garde cette voix. Les PNJ dont le genre est incertain puisent dans les deux réserves. Si l'application ne trouve pas de voix étiquetées masculines ou féminines, chaque réserve utilise la liste complète.

## Format audio et vitesse

**Audio format** (format audio) vaut **MP3** (par défaut) ou **WAV**. Utilise WAV pour les serveurs locaux incapables de produire du MP3. Ce réglage est masqué pour ElevenLabs, qui utilise toujours le MP3. Il s'affiche pour xAI Voice mais n'y a aucun effet, car xAI renvoie toujours du MP3.

La plage du curseur **Speed** (vitesse) dépend du service vocal :

| Service vocal | Plage |
| --- | --- |
| OpenAI-compatible | de 0,25 à 4,0 fois |
| PocketTTS | de 0,25 à 4,0 sur les adaptateurs compatibles. Le serveur officiel contrôle lui-même la vitesse. |
| ElevenLabs | de 0,7 à 1,2 fois |
| xAI Voice | de 0,7 à 1,5 fois |

Une vitesse enregistrée hors de la plage est ramenée à la valeur autorisée la plus proche. Pour ElevenLabs, deux réglages de plus apparaissent : **Language** (langue), qui impose une langue ou reste sur **Auto detect** (détection automatique), et **Stability** (stabilité), qui va de plus expressive à plus régulière.

## Lecture automatique

Chaque option **Auto-play** lit un type de nouveau message dès que sa génération se termine. Elle nécessite un modèle pour la tâche **Voice**. Toutes sont désactivées au départ.

- **Roleplay messages** : les nouvelles réponses en Roleplay.
- **Conversation messages** : les nouvelles réponses en mode Conversation.
- **Game narration** : les nouvelles lignes de narration et de combat de Game Mode.
- **Progressive playback** : lance tout de suite la première ligne d'une réponse en plusieurs lignes, au lieu d'attendre la réponse entière.
- **Only read dialogues** : ne lit que les répliques entre guillemets ou balisées, et saute la narration simple.

La lecture automatique ne se déclenche qu'une fois, sur la réponse la plus récente, quand elle se termine. Elle ne relit pas les anciens messages quand tu rouvres un chat ou que tu le fais défiler.

En Roleplay, la préparation de la voix commence dès que la réponse principale est enregistrée. Si un agent activé réécrit la réponse, comme Prose Guardian, Marinara attend le texte définitif.

### Filtres de texte et consignes d'émotion

Ces filtres s'appliquent à la lecture manuelle et à la lecture automatique, y compris à la narration Game et à l'identification des locuteurs en Roleplay. Les blocs de code sont ignorés par défaut. Les deux autres filtres sont désactivés au départ.

- **Skip text inside HTML and custom tags** (ignorer le texte dans les balises HTML et personnalisées) : retire le texte contenu, par exemple un bloc caché `<simulation>...</simulation>`. Les balises de locuteur utilisées pour choisir les voix restent.
- **Skip fenced code blocks** (ignorer les blocs de code délimités).
- **Skip text inside square brackets** (ignorer le texte entre crochets).

Active **Roleplay speaker extractor** (identification des locuteurs en Roleplay) pour afficher **Enable emotion indicators** (activer les indications d'émotion). Ce réglage ajoute des consignes vocales sans changer les mots du dialogue. Quand les indications d'émotion sont activées, le texte entre crochets est envoyé au service de synthèse vocale même si **Skip text inside square brackets** est activé. Cela peut inclure des notes. Pour que les notes entre crochets ne soient pas lues, désactive les indications d'émotion et laisse l'option d'exclusion activée. Les consignes comme `[Low, steady voice, restrained urgency]` restent entières quand une longue réplique est découpée. Les étiquettes de locuteur et de scène reconnues sont toujours retirées. Le modèle vocal décide comment utiliser chaque consigne. Quand un modèle est choisi pour la tâche **Voice** et que **Game narration** et les indications d'émotion sont activés, les dialogues de scène, d'équipe et de combat en Game Mode peuvent aussi contenir des consignes.

## Lire un message

Dès qu'un modèle est défini pour la tâche **Voice**, un bouton **Speak** (une icône de micro) apparaît dans la barre d'outils sous chaque message de personnage ou de narrateur.

- Clique sur **Speak** pour le lire. Le bouton affiche un état de chargement pendant la récupération de l'audio.
- Clique de nouveau pendant la lecture pour l'arrêter. L'infobulle indique **Stop speaking**.
- Un message sans texte lisible, par exemple une image seule, affiche **No dialogue to speak** et reste désactivé.

Pendant la lecture d'un message, les boutons **Pause speaking** (mettre la lecture en pause), **Resume speaking** (reprendre la lecture) et **Restart speaking** (relancer la lecture) apparaissent. Le bouton en forme de haut-parleur ouvre un curseur **Line volume** (volume de la réplique), de 0 à 100 pour cent (50 par défaut). Il est indépendant du mixeur de Game Mode et du volume des appels en Conversation.

Si ça n'a pas marché, voir [Dépannage](#troubleshooting).

## Clips en cache

Marinara garde l'audio généré dans ton navigateur pour ne pas générer deux fois la même réplique. La section **Cached clips** de **Voice settings** (clips en cache) affiche un compteur en direct et la taille totale. Clique sur **Export cached TTS clips** (exporter les clips TTS en cache), l'icône de téléchargement, pour enregistrer chaque clip en cache sous forme de fichiers audio séparés. Le cache supprime tout seul ses clips les plus anciens. L'application n'a pas de bouton pour l'effacer. Pour le vider, efface les données de ton navigateur.

## Le TTS dans chaque mode de chat

- **Roleplay** utilise l'interrupteur **Roleplay messages** et les commandes **Speak**. Voir [Mode Roleplay : premiers pas](../roleplay/getting-started.md).
- **Conversation** utilise l'interrupteur **Conversation messages** et les mêmes commandes. Les appels audio sont traités dans [Appels audio et vidéo en Conversation](../conversation/calls.md).
- **Game Mode** utilise l'interrupteur **Game narration**. Son mixeur a un canal **TTS** à côté de **Master**, **Music**, **Sound Effects** et **Ambient**. Ce canal règle le volume de l'audio parlé du jeu et démarre à 100 pour cent. Voir [Les contrôles du jeu](../game/getting-started.md#the-games-controls).

### Nom phonétique (prononciation pendant les appels)

Si la voix prononce mal le nom d'un personnage ou d'un persona, ajoute un **Phonetic name** (nom phonétique) et saisis la façon dont il doit sonner. Dans le **Character Editor**, il se trouve sur l'onglet **Voice**. Dans le **Persona Editor** (éditeur de persona), il figure avec les champs d'informations de base. Il ne sert que pendant les appels audio et vidéo en Conversation. **Speak**, la lecture automatique et la narration de Game Mode l'ignorent.

<a id="troubleshooting"></a>

## Dépannage

- **Rien n'est lu** : vérifie que la ligne **Voice** de l'encadré **Jobs** n'est pas sur **Off**. Vérifie ensuite l'option **Auto-play** correspondante, ou utilise **Speak** sur un message.
- **La ligne Voice indique The voice account is missing** : le compte du modèle vocal a été supprimé ou est inutilisable. Choisis un autre modèle vocal. Voir [Utiliser un modèle Voice d'un compte](#use-a-voice-model-from-an-account).
- **Aucune voix dans la liste** : vérifie que la ligne **Voice** a un modèle et une clé valide, puis clique sur **Refresh voices from provider**. Le serveur officiel PocketTTS utilise la liste intégrée de Marinara. Pour un serveur intermédiaire compatible PocketTTS, vérifie que `<Base URL>/v1/voices` répond.
- **ElevenLabs ne parle pas** : choisis une vraie voix, pas le texte indicatif "Select an ElevenLabs voice". Vérifie que le modèle est un modèle vocal, pas un modèle de création de voix dont l'identifiant contient `ttv`.
- **Une réplique s'arrête avec "No audio after 60 s"** : le serveur vocal a besoin de plus de temps. Augmente **Request timeout (seconds)** à l'endroit indiqué par le message. Voir [Délai d'attente des requêtes](#request-timeout).
- **Un serveur auto-hébergé sur une adresse locale est bloqué** : active `TTS_LOCAL_URLS_ENABLED` dans `.env`. Ce réglage autorise Marinara à joindre une adresse locale ou privée pour les serveurs OpenAI-compatible ou de type ElevenLabs. PocketTTS n'en a pas besoin. Voir [Référence de configuration du serveur](../CONFIGURATION.md).
- **Tester rapidement** : clique sur **Preview** dans la carte pour entendre un court extrait avec tes réglages actuels.

## Référence : musique, effets sonores et Gacha Forge

Ces sections concernent les configurations avancées.

<a id="game-music-and-sound-effects-on-a-compatible-audio-server"></a>

### Musique et effets sonores de Game avec un serveur audio compatible

1. Dans **Connections**, ouvre ton compte **Music & Sound Effects** (musique et effets sonores) avec **Edit model** (modifier le modèle) et choisis **Custom compatible server** (serveur compatible personnalisé). La fenêtre **Add account** n'a pas de tuile pour ce type de compte ; il provient d'une mise à jour ou d'un import (voir [la référence des comptes](../connections/providers-reference.md#music--sound-effects)).
2. Saisis l'adresse, la clé et le modèle de ton serveur de musique ou d'effets sonores.
3. Définis **Generation API format** (format d'API de génération) et saisis les chemins des points d'accès que ton serveur propose. Un chemin vide rend la fonction correspondante indisponible.
4. Active **Music generation** (génération de musique), **Sound-effect generation** (génération d'effets sonores) ou les deux.
5. Sélectionne ce compte dans la configuration de Game ou dans les réglages audio du jeu. Garde ton compte vocal sélectionné séparément dans les réglages de la voix de la tâche **Voice**.

Les chemins des points d'accès sont ajoutés à la Base URL du compte. Pour `http://localhost:8002/v1`, utilise `chat/completions` pour atteindre `/v1/chat/completions`. Les points d'accès HTTP locaux nécessitent `TTS_LOCAL_URLS_ENABLED=true` dans `.env`, comme les autres requêtes audio compatibles locales.

Deux formats d'API sont pris en charge :

- **Prompt JSON → MP3 audio** envoie `{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }` et attend des octets MP3. La musique de Game utilise la durée de la piste de contexte (120 secondes par défaut). Les effets sonores demandent 5 secondes.
- **Chat Completions → inline audio (ACE-Step compatible)** envoie `model`, une entrée utilisateur dans `messages`, `stream: false`, et `audio_config` avec `duration`, `instrumental: true` et `format: "mp3"`. Il accepte du MP3 intégré provenant de `choices[0].message.audio` : soit un tableau d'URL audio ACE-Step contenant une URL de données base64, soit un objet avec `data` en base64. Voir le [contrat d'API compatible ACE-Step](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md). Les URL de résultats distants et les API de tâches asynchrones ne sont pas prises en charge.

N'active que ce que ton serveur implémente. Un point d'accès de parole compatible OpenAI ne signifie pas à lui seul que le serveur prend en charge la musique ou les effets sonores. Un service comme Infermatic doit proposer l'un de ces formats ou fournir un adaptateur. Son point d'accès de musique réel n'a pas été vérifié ici. Pour la génération native avec ElevenLabs ou SunoAPI, utilise cette source sous **Music & Sound Effects**. Voir [la référence des comptes](../connections/providers-reference.md#music--sound-effects).

La musique de contexte générée est composée une fois par zone ou par niveau de rencontre, puis réutilisée. Les effets sonores répétés utilisent le cache audio. Une erreur de génération laisse le cache disponible pour réessayer.

<a id="gacha-forge-dialogue-and-audio"></a>

### Dialogues et audio dans Gacha Forge

À partir de la version 1.11.0, Gacha Forge utilise le compte sélectionné pour la tâche **Voice** et les voix que celle-ci attribue à chaque personnage. - Active **Read character dialogue** (lire les dialogues des personnages) pour lire les dialogues des personnages importés auxquels une voix a été attribuée. Ce réglage se trouve à l'étape de configuration **Lore** (contexte de l'univers) d'un nouveau monde, ou dans les réglages de monde propres à Gacha Forge pour un monde existant. La narration, les pensées, les unités générées sans identifiant de personnage de Marinara Engine et les personnages sans voix restent silencieux. Un nom seul n'emprunte jamais la voix d'un autre personnage.

- Un compte Audio sélectionné peut être utilisé quand la tâche **Voice** n'est pas sur **Off**.
- La musique et les effets sonores fournis avec Game n'ont besoin d'aucun compte de génération. Pour composer de nouvelles pistes, active **Generate music and sound effects** (générer de la musique et des effets sonores) dans Gacha Forge et choisis un compte Music & Sound Effects sous **Audio connection** (connexion audio). Ce champ apparaît quand la génération est activée. Les pistes de Home, des combats, des boss, des scènes de l'histoire et des histoires de personnages sont générées au premier besoin, puis réutilisées. Ces requêtes utilisent ton compte chez le service.
- Le bouton muet en haut à droite coupe ensemble la musique, les dialogues et les effets sonores. Les réglages visuels de Gacha Forge proposent des commandes de volume distinctes pour les trois, jusqu'à zéro, ainsi que la pause de lecture automatique (**3 seconds** par défaut, après l'affichage du texte et les éventuels dialogues parlés). Les choix attendent toujours le joueur. Les dialogues parlés sont annulés quand tu quittes une scène. Quitter le monde arrête son audio.

Mets à jour le package Gacha Forge installé ainsi que Marinara Engine pour obtenir ces commandes.

## Guides associés

- [Appels audio et vidéo en Conversation](../conversation/calls.md)
- [Synchronisation labiale avec la synthèse vocale](../agents/avatars.md#lip-sync-with-text-to-speech) pour les avatars 2D et 3D
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
- [Game Mode : premiers pas](../game/getting-started.md)
- [Fournisseurs d'IA pris en charge](../connections/providers-reference.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
