# Appels audio et vidéo en Conversation

Un appel est un écran en direct, comme une application de chat vocal, où tu parles à un ou plusieurs personnages au microphone ou en tapant. Il se place par-dessus le chat Conversation normal pendant qu'il fonctionne. Les appels existent seulement en mode Conversation.

Les appels sont un package facultatif. Installe **Calls** depuis **Agents → Agent Organizer**. Si le catalogue te demande de redémarrer, arrête Marinara et démarre-le à nouveau comme tu le démarres d'habitude (voir [Installation](../INSTALLATION.md)).

Pendant un appel, les personnages qui ont un Text to Speech (TTS, synthèse vocale) fonctionnel disent leurs réponses à voix haute. Les personnages sans voix répondent par des messages tapés dans le chat de l'appel. Tu peux aussi afficher des clips vidéo en boucle faits par IA d'un personnage à la place d'un avatar fixe.

Marinara enregistre ton microphone ou ta caméra dans ton navigateur. Selon le mode d'entrée (ci-dessous), ta voix est transformée en texte sur ton propre ordinateur ou envoyée au modèle que tu as choisi pour le chat. Les réponses sont dites par ton service TTS. À la fin de l'appel, un court résumé retourne dans la Conversation. La transcription complète reste dans un stockage d'appel séparé.

## Ce dont tu as besoin

- **Calls** installé.
- Un chat Conversation avec au moins un personnage, et un compte pour le modèle qui écrit les réponses.
- **Audio/Video Calls** et **Call Audio Pipeline** activés dans les réglages du chat.
- Facultatif : un compte Text to Speech, pour que les personnages parlent. Sans lui, ils répondent en texte.
- Facultatif : le mode microphone par défaut a besoin d'un téléchargement unique de Local Whisper (voir [Télécharger Local Whisper](#download-local-whisper)). Tu peux plutôt taper dans le chat de l'appel.

## Configurer ton premier appel

**Avant de commencer :** tu as besoin d'un chat Conversation avec au moins un personnage, et d'un compte pour le modèle qui écrit les réponses (voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)).

1. Facultatif : configure Text to Speech (voir [Configurer Text to Speech](#set-up-text-to-speech)). Sans lui, chaque personnage rejoint en texte seulement.
2. Ouvre le chat, puis ouvre **Chat Settings → Agents → Calls**.
3. Active **Audio/Video Calls**. Un bouton d'appel apparaît à côté du nom de la conversation.
4. Active **Call Audio Pipeline**. Aucun appel ne peut démarrer sans lui, même si tu ne fais que parler ou écouter. Il active aussi le microphone.
5. Choisis un **Audio input mode** (ci-dessous).
6. Clique sur **Start call**.

Si ça n'a pas marché : quand tu vois "Conversation call audio is not enabled in Chat Settings", **Call Audio Pipeline** est désactivé. C'est un réglage global, donc l'activer dans un chat l'active pour tous les appels Conversation. Pour un nouveau chat, termine d'abord l'assistant de configuration, puis ouvre les **Chat Settings** de ce chat. Les réglages d'appel s'affichent seulement quand Calls est installé.

Deux interrupteurs se ressemblent mais font des choses différentes :

- **Audio/Video Calls** affiche le bouton d'appel, donc tu peux appeler un personnage.
- La commande **Calls** laisse les personnages t'appeler en premier. Si elle est désactivée, tu peux quand même lancer des appels toi-même.

L'interrupteur principal **Commands** dans la même section doit être activé pour les commandes pendant l'appel. L'appel lui-même peut démarrer avec lui désactivé.

<a id="set-up-text-to-speech"></a>

### Configurer Text to Speech

Text to Speech décide quels personnages peuvent parler et avec quelle voix. Lis [Configuration de Text to Speech (TTS)](../media/tts-setup.md) pour le guide complet. En bref, ouvre **Connections**, clique sur **Add account** et choisis **Text to speech**. S'il est déjà listé sous **On this device**, ouvre-le là. Ensuite :

1. Active Text to Speech.
2. Choisis une source : **OpenAI-compatible**, **ElevenLabs**, **PocketTTS** ou **xAI Voice**.
3. Saisis la clé API ou l'adresse du serveur local pour cette source.
4. Choisis un modèle et une voix.
5. Règle **Voice option** sur **One voice for all** ou **Selected per character or persona**. Des voix par personnage rendent les appels de groupe plus faciles à suivre.
6. Enregistre, puis utilise l'aperçu pour confirmer que tu entends l'audio.

Si un personnage n'a pas de voix que Marinara peut résoudre, ce personnage reste en texte seulement pour l'appel.

### Choisir un Audio input mode

Quand **Call Audio Pipeline** est activé, la liste **Audio input mode** apparaît. Si tu hésites, garde la valeur par défaut.

| Mode | Ce qu'il fait |
| --- | --- |
| **Mic recording + Local Whisper** (par défaut) | Enregistre pendant que tu n'es pas en sourdine, ignore le silence et transforme ta voix en texte sur ton propre ordinateur. Idéal pour Firefox. |
| **Browser speech recognition** | Utilise l'outil de reconnaissance vocale intégré à ton navigateur. La prise en charge varie. Marinara se rabat sur Local Whisper quand il manque. |
| **Manual system dictation** | Place seulement le curseur dans la zone de texte de l'appel pour que la dictée de ton système d'exploitation puisse y taper. Marinara n'enregistre pas. |
| **Provider-native audio/video** | Envoie ton audio ou ta vidéo enregistrés directement au modèle, si le modèle accepte les médias. |

Les boutons caméra et partage d'écran ont besoin de **Camera and screen input** et ne fonctionnent qu'en mode **Provider-native audio/video**. Dans les autres modes, ils s'affichent mais restent désactivés.

## Démarrer, répondre et terminer un appel

**Démarrer un appel.** Quand les appels sont activés, un bouton téléphone se trouve à côté du nom de la conversation. Son infobulle est **Start call**, ou **Open call** quand un appel est en cours. Clique dessus et l'écran d'appel s'ouvre. Un seul appel peut être actif ou en train de sonner par chat. Démarrer un autre rouvre l'appel actuel.

**Répondre à un appel.** Un personnage peut t'appeler quand la commande **Calls** est activée. Dans ce chat, une bannière **Incoming call** apparaît au-dessus du champ de message avec **Decline call** et **Answer call**. Ailleurs, tu reçois une notification d'appel entrant et une courte sonnerie. Marinara ne répond jamais pour toi. Seuls les personnages disponibles rejoignent : un personnage dont l'emploi du temps ou le statut est hors ligne ne le fait pas.

**Terminer un appel.** Clique sur le bouton rouge **End call** sur l'écran d'appel ou dans la fenêtre réduite. Un personnage peut aussi quitter l'appel ou y mettre fin avec une commande pendant l'appel. Marinara arrête alors l'enregistrement et ajoute une fiche à la Conversation.

## L'écran d'appel

La scène a une tuile par participant, ta persona et chaque personnage disponible, et met en évidence qui parle. Le chat de l'appel contient les messages tapés et les réponses en texte seulement. Les répliques parlées n'y sont pas répétées. Sur ordinateur, c'est un panneau latéral. Sur un téléphone, il s'ouvre comme un tiroir avec **Open call chat** et se ferme avec **Close call chat**.

Le champ de composition de l'appel a une zone **Message in call**, **Send**, un sélecteur d'emojis, de GIF et de stickers, et un sélecteur rapide. Les pièces jointes ne sont pas prises en charge dans le chat de l'appel.

| Contrôle | Ce qu'il fait |
| --- | --- |
| Microphone | Te met en sourdine ou rétablit le son. L'infobulle change avec le mode, par exemple **Unmute microphone with Local Whisper**. |
| **Turn camera on** / **Turn camera off** | Mode Provider-native audio/video avec **Camera and screen input** activé seulement. |
| **Share screen** / **Stop sharing screen** | Même règle que la caméra. |
| **Character volume** | Un bouton de sourdine et un curseur de 0 à 100. Par défaut 100, enregistré dans le navigateur. |
| **Soundboard** | Une liste de sons avec un contrôle **Upload**. |
| **End call** | Le bouton rouge pour raccrocher. |

Si tu es resté silencieux un moment, tu vois "You are muted! Remember to unmute yourself first if you want to talk."

Si tu quittes la Conversation pendant un appel, il se réduit en une fenêtre flottante avec le nom du chat, le temps écoulé et **End call**. Clique sur la fenêtre pour revenir. L'appel continue pendant que tu navigues.

### Soundboard

La soundboard a quatre sons intégrés que tu ne peux pas supprimer : **Soft Chime**, **Tap**, **Sparkle** et **Pop**. Clique sur **Upload** pour ajouter les tiens (mp3, wav, ogg, webm ou m4a, jusqu'à 8 Mo chacun). Tu peux supprimer tes propres fichiers. Les personnages peuvent jouer un son avec la commande soundboard.

## Présence vidéo des personnages

Cette partie est facultative et avancée. **Character video presence** remplace une tuile d'avatar fixe par un clip en boucle du personnage fait par IA. Elle est désactivée par défaut. L'interrupteur est dans **Chat Settings → Agents → Calls**.

**Avant de commencer :** ajoute un compte Video Generation dans **Connections**, et marque-en un comme **Default for Videos** ou choisis-en un à chaque fois.

1. Ouvre un éditeur de personnage ou de persona.
2. Ouvre l'onglet **Sprites**, puis le sous-onglet **Clips**.
3. Clique sur **Generate Clips**, ou sur **Upload extra** pour ajouter les tiens.
4. Dans la fenêtre **Generate Call Clips**, choisis une **Video Generation Connection** et choisis **Use avatar as reference**.
5. Choisis les clips standard à créer : **Idle**, **Talking**, **Laughing**, **Angry**, **Crying**, **Sighing**. Tu peux aussi définir un clip personnalisé avec un **Clip name** et une description d'action.

Pendant un tour parlé, Marinara lit les indices vocaux dans une ligne, comme `[sighs]`, choisit un clip de réaction correspondant, puis revient à Idle. Un clip manquant ne bloque jamais un appel : le personnage affiche un sprite fixe. Un clip rogné boucle dans sa plage de rognage. Voir [Sprites de personnages (expressions et en pied)](../characters/sprites.md).

Deux interrupteurs de plus apparaissent sous **Character video presence** quand elle est activée :

- **Automatic video clips generation** (désactivé par défaut) crée seulement **Idle** et **Talking** pour un participant qui en a besoin. Les clips de réaction et les clips personnalisés ne sont jamais faits automatiquement.
- **Custom clips** (désactivé par défaut) laisse un personnage demander rarement un clip ponctuel en plein appel et rejouer un clip prêt. C'est pour les demandes spéciales, pas pour chaque tour.

Désactiver **Character video presence** désactive aussi les deux autres. Les clips ici sont des boucles de présence réutilisables, pas les **Videos** de la Gallery, qui contiennent des vidéos de scène.

## Configuration de la reconnaissance vocale (avancé)

Nécessaire seulement pour le mode **Mic recording + Local Whisper**, ou si tu veux ton propre serveur de reconnaissance vocale.

<a id="download-local-whisper"></a>

### Télécharger Local Whisper

Local Whisper transforme ta voix en texte sur l'ordinateur qui exécute Marinara, donc l'audio de ton microphone ne le quitte pas pour la transcription. Le texte est quand même envoyé à ton modèle dans le cadre de l'appel. C'est le chemin de microphone le plus fiable pour les navigateurs à faible prise en charge de la voix, comme Firefox.

**Avant de commencer :** installe Calls. La section est masquée sans lui.

1. Ouvre **Connections** et trouve **Speech to text** sous **On this device**. S'il n'est pas listé, clique sur **Add account** et choisis **Speech to text**.
2. Trouve **Local speech model** sur cette page.
3. Choisis un modèle :
   - **Whisper Tiny (Multilingual)** : environ 180 Mo à télécharger et 350 Mo de mémoire. Idéal pour les téléphones et les ordinateurs plus anciens.
   - **Whisper Base (Multilingual)** : environ 320 Mo à télécharger et 650 Mo de mémoire. Meilleur avec une voix peu claire.
4. Clique sur **Download Whisper** et attends la barre de progression.
5. Redémarre complètement Marinara avant d'utiliser Calls.

Une icône de corbeille, **Delete Local Whisper**, supprime le modèle. Désinstaller Calls supprime aussi les modèles Whisper téléchargés. Le réinstaller ne télécharge pas à nouveau un modèle tant que tu ne le choisis pas.

Si ça n'a pas marché : sur une build Lite de Marinara, tu vois "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model." Si tu vois un message sur le "native ONNX runtime", le moteur vocal de ta plateforme manque. Réinstalle les dépendances avec la même version de Node que celle avec laquelle tu exécutes Marinara, puis redémarre.

<a id="use-your-own-speech-to-text-server"></a>

### Utiliser ton propre serveur de reconnaissance vocale

Si Local Whisper a du mal avec ta langue ou ton accent, envoie plutôt ta voix à un autre serveur de reconnaissance vocale. Tout serveur qui accepte le format de reconnaissance vocale d'OpenAI (l'adresse `/audio/transcriptions`) convient, que tu l'exécutes toi-même ou que tu utilises un service comme OpenAI ou Groq.

1. Ouvre **Connections** et ouvre **Speech to text** sous **On this device**. S'il n'est pas listé, clique sur **Add account** et choisis **Speech to text**. Il est masqué tant que Calls n'est pas installé.
2. Saisis le champ **Server URL**, par exemple `http://localhost:8000/v1`.
3. Saisis une **API key** si le serveur en a besoin. Elle est enregistrée chiffrée et affichée masquée.
4. Saisis le **Model** que ton serveur utilise. Laisse vide pour envoyer `whisper-1`.
5. Facultatif : saisis un code de **Language** comme `pl` ou `de`. Laisse vide pour que le serveur la détecte.
6. Clique sur **Test**. Marinara envoie un clip silencieux d'une seconde. Tu vois "The server answered." ou "The test failed."
7. Active **Use your own speech-to-text server**.

Tant qu'il est activé, **Mic recording + Local Whisper** envoie ta voix à ce serveur, et tu n'as pas besoin de télécharger Local Whisper. Ton audio va à ce serveur, donc utilise-en un en qui tu as confiance.

Un serveur sur le même ordinateur fonctionne tel quel. Un serveur sur un autre ordinateur de ton réseau est refusé sauf si tu définis `STT_LOCAL_URLS_ENABLED=true` dans `.env` (voir [Référence de configuration du serveur](../CONFIGURATION.md)).

Si ça n'a pas marché : lis le message sous **Test**. "Could not reach the speech-to-text server" veut dire que l'adresse est mauvaise ou que le serveur est éteint. Un message qui nomme `STT_LOCAL_URLS_ENABLED` veut dire que le serveur est sur un autre ordinateur. Un nombre vient de ton serveur : 401 veut généralement dire une mauvaise clé API, 404 une mauvaise adresse ou un mauvais nom de modèle. Si les appels utilisent encore Local Whisper, mets à jour Calls depuis **Agents → Agent Organizer**.

## Réglages et valeurs par défaut

Les réglages **Per chat** s'appliquent à un seul chat. Les réglages **Global** s'appliquent à chaque appel Conversation.

| Réglage | Portée | Par défaut |
| --- | --- | --- |
| **Audio/Video Calls** | Par chat | Désactivé |
| **Calls** (commande) | Par chat | Activé |
| **Generate voice cues in [tags]** | Par chat | Activé |
| **Call Audio Pipeline** | Global | Désactivé |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | Désactivé |
| **Character video presence** | Global | Désactivé |
| **Automatic video clips generation** | Global | Désactivé |
| **Custom clips** | Global | Désactivé |

Un réglage global modifié dans un chat change tous les chats Conversation. **Generate voice cues in [tags]** demande au modèle d'ajouter de courts indices comme `[whispering]`, `[laughing]` ou `[sighs]` dans les répliques parlées. Ils façonnent la façon dont le TTS dit la ligne et aident à choisir les clips de réaction. Désactive-le pour garder les répliques parlées simples.

## Commandes pendant un appel

Les personnages utilisent pendant un appel les mêmes commandes masquées que dans les messages normaux. Chacune a besoin de son interrupteur dans **Chat Settings → Agents → Commands** et de l'interrupteur principal **Commands** activé. Voir [Choisir quelles Commands un personnage peut utiliser](getting-started.md#choose-which-commands-a-character-can-use). Elles fonctionnent en silence et ne sont jamais dites à voix haute.

Deux commandes de plus fonctionnent pendant un appel : **Soundboard** (un personnage joue un son de la soundboard) et la commande qui permet à un personnage de quitter l'appel, ou d'y mettre fin pour tout le monde. **Notes** et **Influence** apparaissent seulement quand le chat a un chat connecté (voir [Chats connectés](../chats/connected-chats.md)). Un selfie a besoin d'un **Selfie model** (voir [Selfies](selfies.md)). Certaines commandes ajoutent une petite entrée au chat de l'appel, comme "sent a selfie" avec l'image.

## Le résumé de fin d'appel

Quand un appel se termine, une fiche apparaît dans la Conversation. Son titre est **Call Started**, **Incoming Call**, **Call Ended** (avec la durée), **Call Declined** ou **Missed Call**. Après **Call Ended**, si quelque chose de significatif s'est passé, Marinara écrit un court résumé en arrière-plan et l'ajoute comme contexte masqué que le modèle peut lire. Cela garde le modèle au courant de l'appel sans le copier dans le chat visible.

## Dépannage

| Symptôme | Solution |
| --- | --- |
| Les personnages ne m'entendent pas | Confirme que **Call Audio Pipeline** est activé et que ton navigateur autorise le microphone pour la page Marinara. Sur Firefox, ou si la reconnaissance vocale du navigateur ne fonctionne pas, télécharge Local Whisper et utilise **Mic recording + Local Whisper**. |
| L'option de reconnaissance vocale du navigateur ne fait rien | Firefox n'a pas la Web Speech recognition que les navigateurs Chromium et Safari ont. Utilise **Mic recording + Local Whisper**, ou **Manual system dictation**. |
| Un personnage tape au lieu de parler | Vérifie tes réglages Text to Speech et les voix attribuées. Voir [Configuration de Text to Speech (TTS)](../media/tts-setup.md). |
| Le modèle comprend mal ma voix | Essaie **Whisper Base (Multilingual)**, réduis le bruit, ou utilise **Provider-native audio/video** si ton modèle le prend en charge. Pour une langue que Whisper gère mal, [utilise ton propre serveur de reconnaissance vocale](#use-your-own-speech-to-text-server) et règle sa **Language**. |
| Le bouton caméra ou écran est désactivé | Utilise le mode **Provider-native audio/video** et active **Camera and screen input**. Ton modèle doit aussi accepter l'entrée caméra ou écran. |
| Un personnage arrête de répondre en plein appel | Vérifie le compte du modèle pour le chat, puis envoie à nouveau un message dans le chat de l'appel. |
| L'appel ne fonctionne pas sur mon téléphone | Le chat de l'appel s'ouvre avec **Open call chat**. Pour la voix, confirme que TTS est configuré. Pour le microphone, les mêmes étapes de Local Whisper et d'autorisation s'appliquent. |

## Guides associés

- [Configuration de Text to Speech (TTS)](../media/tts-setup.md)
- [Configuration du modèle intégré](../connections/local-model.md)
- [Sprites de personnages (expressions et en pied)](../characters/sprites.md)
- [Mode Conversation : premiers pas](getting-started.md)
