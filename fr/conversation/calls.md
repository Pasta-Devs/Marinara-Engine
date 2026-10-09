# Appels audio et vidéo en mode Conversation

Ce guide explique les appels du mode **Conversation** dans Marinara Engine. Au programme : comment fonctionne un appel, comment le mettre en place, comment parler pendant l'appel et comment régler les problèmes courants.

Les appels existent uniquement en mode **Conversation**. Les chats Roleplay et Game Mode n'ont pas d'écran d'appel.

Calls est un package d'agents optionnel. Installe **Calls** depuis **Agents → Download Agents** (télécharger des agents) avant de suivre la configuration ci-dessous, puis redémarre Marinara quand le catalogue te le demande.

## Ce qu'est un appel

Un appel t'ouvre un écran en direct, façon Discord, où tu parles avec un ou plusieurs personnages. Il se superpose au chat Conversation habituel pendant toute sa durée.

Pendant un appel :

- Les personnages dotés d'une voix Text to Speech (TTS) fonctionnelle disent leurs répliques à voix haute. Text to Speech, c'est la synthèse vocale : du texte transformé en audio.
- Les personnages sans voix répondent par des messages écrits dans le chat de l'appel.
- Tu réponds au micro ou au clavier.
- Autre option : afficher des clips vidéo en boucle, générés par l'IA, à la place d'un avatar fixe.

Un appel n'est pas un appel téléphonique de pair à pair. Marinara capte le micro ou la caméra locale de ton navigateur. Il envoie cette entrée au modèle choisi pour cette Conversation. Il fait parler les réponses via ton fournisseur TTS et conserve les données de l'appel sur ta propre machine.

À la fin de l'appel, Marinara écrit un court résumé de l'appel audio dans la Conversation habituelle. La transcription complète reste dans un stockage d'appel séparé : elle n'est pas recopiée message par message dans le chat principal.

## Avant de commencer

Pour obtenir un appel vocal fonctionnel, mets en place ces éléments dans l'ordre. Les étapes marquées Optionnel peuvent être ignorées.

1. Un chat en mode Conversation avec au moins un personnage.
2. Une connexion de modèle classique sélectionnée pour ce chat. C'est ce modèle qui écrit les réponses des personnages pendant l'appel.
3. L'option **Audio/Video Calls** (appels audio et vidéo) activée pour ce chat (voir la section "Activer les appels pour un chat" plus bas).
4. L'option **Call Audio Pipeline** (chaîne audio de l'appel) activée. Elle est obligatoire pour démarrer le moindre appel, même un appel où tu ne fais qu'écrire ou qu'écouter. Elle active aussi l'entrée micro.
5. Text to Speech configuré pour que les personnages puissent parler. Sans cela, chaque personnage rejoint l'appel en texte uniquement.
6. Optionnel : Local Whisper téléchargé depuis **Connections** (connexions) une fois Calls installé, si le navigateur ne fait pas de reconnaissance vocale fiable (indispensable sur Firefox). Ou bien ton propre serveur de reconnaissance vocale à la place de Local Whisper.
7. Optionnel : une connexion vidéo et des clips générés si tu veux **Character Video Presence** (présence vidéo du personnage).
8. Optionnel : une connexion d'images définie comme Selfie Connection du chat si tu veux que les personnages envoient des selfies pendant l'appel.

### Configurer Text to Speech

Text to Speech détermine quels personnages peuvent parler et quelle voix chacun utilise. C'est une fonctionnalité partagée, documentée dans son propre guide.

Pour la marche à suivre complète, lis [Configurer la synthèse vocale (TTS)](../media/tts-setup.md). En résumé, tu ouvres la section **Connections** puis **Text to Speech**, et là :

1. Active Text to Speech.
2. Choisis une source : **OpenAI-compatible**, **ElevenLabs**, **PocketTTS** ou **xAI Voice**.
3. Saisis la clé du fournisseur ou l'adresse du serveur local pour cette source.
4. Choisis un modèle et une voix.
5. Règle **Voice Option** sur **One voice for all characters** ou **Selected per character**.
6. Enregistre, puis utilise le bouton d'aperçu pour vérifier que le son sort bien.

Pour un appel de groupe, des voix par personnage rendent bien plus facile de savoir qui parle. Si Marinara ne trouve aucune voix pour un personnage, ce personnage passe en texte uniquement pour l'appel.

### Choisir un mode d'entrée micro

Quand **Call Audio Pipeline** est activé, un menu déroulant **Audio input mode** (mode d'entrée audio) apparaît avec quatre choix. Prends celui qui convient à ton navigateur et à ton fournisseur.

- **Mic recording + Local Whisper** : enregistre tant que ton micro est actif, ignore les silences et transforme ta parole en texte sur ta propre machine. C'est la valeur par défaut, et le meilleur choix sur Firefox.
- **Browser speech recognition** : utilise la fonction Web Speech du navigateur. L'API Web Speech est un outil intégré au navigateur qui transforme la parole en texte. La prise en charge varie d'un navigateur à l'autre, et Marinara bascule sur Local Whisper quand elle manque.
- **Manual system dictation** : place seulement le curseur dans le champ de texte de l'appel pour que la dictée de ton système d'exploitation puisse y écrire. Dans ce mode, Marinara n'enregistre pas le micro de lui-même.
- **Provider-native audio/video** : envoie l'audio ou la vidéo enregistrés directement au modèle de la Conversation, quand ce modèle accepte les médias en direct. Sinon, passe par Local Whisper ou par la reconnaissance vocale du navigateur.

Les boutons caméra et écran n'apparaissent que si **Camera and screen input** (entrée caméra et écran) est activé. Ils ne fonctionnent qu'en mode **Provider-native audio/video**. Dans tous les autres modes, les boutons restent visibles mais désactivés.

### Télécharger Local Whisper

Local Whisper transforme ta parole en texte sur la machine qui fait tourner Marinara. L'audio du micro ne quitte jamais cette machine pour la transcription. Le texte obtenu, lui, part quand même vers le modèle de la Conversation dans le cadre de l'appel.

Local Whisper appartient au package Calls, et c'est la voie micro la plus fiable pour les navigateurs dont la prise en charge vocale est faible, Firefox compris. Après avoir installé Calls, ouvre la section **Connections**, ouvre **Local Model**, déplie la fiche et cherche **Local Speech Model**. Cette section est masquée tant que Calls n'est pas installé. Pour la fiche **Local Model** en général, voir [Configurer un modèle local](../connections/local-model.md).

1. Choisis un modèle. **Whisper Tiny (Multilingual)** est le modèle par défaut. Il pèse environ 180 Mo au téléchargement et occupe environ 350 Mo de mémoire une fois lancé. C'est le meilleur premier choix pour les téléphones et les machines anciennes.
2. Sinon, choisis **Whisper Base (Multilingual)** pour une meilleure précision sur une parole difficile. Il pèse environ 320 Mo au téléchargement et occupe environ 650 Mo de mémoire.
3. Clique sur **Download Whisper**.
4. Attends la fin de la barre de progression.

Après le téléchargement, un contrôle **Delete Local Whisper** (icône de corbeille) apparaît si tu veux supprimer le modèle.

Désinstaller Calls supprime aussi tous les modèles Whisper téléchargés et la sélection enregistrée. Tu récupères ainsi l'espace disque occupé par le modèle. Réinstaller Calls fait revenir les contrôles de téléchargement, mais aucun modèle n'est retéléchargé tant que tu n'en choisis pas un.

<a id="use-your-own-speech-to-text-server"></a>

### Utiliser ton propre serveur de reconnaissance vocale

Si Local Whisper a du mal avec ta langue ou ton accent, tu peux plutôt envoyer ta voix enregistrée à un autre modèle de reconnaissance vocale. Cela fonctionne avec tout serveur qui propose le point de terminaison `/audio/transcriptions` au format OpenAI. Cela comprend des serveurs auto-hébergés comme Speaches, les serveurs faster-whisper, LocalAI et le serveur whisper.cpp (lancé avec `--inference-path /v1/audio/transcriptions`), ainsi que des fournisseurs comme OpenAI ou Groq.

1. Installe Calls, puis ouvre **Connections** et repère la fiche **Speech to Text** (reconnaissance vocale). Cette fiche est masquée tant que Calls n'est pas installé.
2. Déplie la fiche et renseigne le champ **Server URL** (URL du serveur), par exemple `http://localhost:8000/v1` pour un serveur sur ta propre machine.
3. Si ton serveur ou ton fournisseur demande une clé, saisis-la dans le champ **API key** (clé API). Elle est enregistrée chiffrée, et la fiche ne l'affiche que masquée.
4. Saisis dans le champ **Model** (modèle) le nom du modèle qu'utilise ton serveur. Laisse-le vide pour envoyer `whisper-1`.
5. Optionnel : saisis un code de langue dans le champ **Language** (langue), par exemple `pl` ou `de`. Indiquer ta langue au modèle améliore généralement la précision. Laisse-le vide pour que le serveur la détecte.
6. Clique sur **Test** (tester). Marinara envoie un clip silencieux d'une seconde et t'indique si le serveur a répondu.
7. Active l'interrupteur de la fiche.

Tant que l'interrupteur est activé, **Mic recording + Local Whisper** envoie ta parole à ce serveur au lieu de Local Whisper. Tu n'as pas besoin de télécharger Local Whisper pour cela. Désactive l'interrupteur pour revenir à Local Whisper. Ton audio part vers le serveur que tu as indiqué : utilise donc un serveur de confiance.

Un serveur situé sur la même machine que Marinara fonctionne tel quel. Un serveur situé sur une autre machine de ton réseau domestique est refusé, sauf si tu définis `STT_LOCAL_URLS_ENABLED=true` dans le fichier `.env` du serveur. Voir [Référence de configuration du serveur](../CONFIGURATION.md).

Cette fonction nécessite une version de Calls qui la prend en charge. Si les appels utilisent toujours Local Whisper une fois l'interrupteur activé, mets à jour Calls depuis **Agents → Download Agents**.

## Activer les appels pour un chat

Les appels s'activent pendant la création d'une nouvelle Conversation, ou plus tard depuis les réglages du chat.

Pour une nouvelle Conversation, termine d'abord l'assistant de configuration, puis ouvre les réglages de ce chat et suis les mêmes étapes ci-dessous. Les réglages des packages optionnels n'apparaissent qu'une fois Calls installé.

Pour une Conversation existante :

1. Ouvre le chat.
2. Ouvre **Chat Settings** (réglages du chat).
3. Va dans la section **Agents**.
4. Ouvre **Calls**.
5. Active **Audio/Video Calls**. Un bouton d'appel doit maintenant apparaître à côté du nom de la conversation.
6. Active **Call Audio Pipeline**. Aucun appel ne démarre sans lui, même si tu n'utilises jamais de micro.
7. Choisis un **Audio input mode**.

L'option **Audio/Video Calls** et la commande **Calls** sont deux réglages différents. **Audio/Video Calls** affiche le bouton d'appel pour que tu puisses appeler un personnage. La commande **Calls** permet aux personnages de t'appeler les premiers. Si tu désactives **Calls**, tu peux toujours lancer des appels toi-même, mais les personnages ne devraient plus déclencher d'appels entrants.

La section **Agents** contient aussi un interrupteur général **Commands** dès qu'un package fournissant des commandes est installé. Il doit être activé pour que les commandes cachées en appel fonctionnent. L'appel, lui, démarre même s'il est désactivé.

### Réglages et valeurs par défaut

La plupart des réglages d'appel se trouvent dans **Chat Settings**, puis **Agents**, puis **Calls**. Certains sont globaux : les modifier dans un chat les modifie pour tous les appels Conversation de l'application.

| Réglage | Portée | Par défaut |
|---|---|---|
| **Audio/Video Calls** | Par chat | Off |
| **Calls** (commande) | Par chat | On |
| **Generate voice cues in [tags]** | Par chat | On |
| **Call Audio Pipeline** | Global | Off |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | Off |
| **Character video presence** | Global | Off |
| **Automatic video clips generation** | Global | Off |
| **Custom clips** | Global | Off |

L'option **Generate voice cues in [tags]** demande au modèle d'ajouter de courtes indications entre crochets, comme `[whispering]`, `[laughing]` ou `[sighs]`, à l'intérieur des répliques parlées. Ces indications façonnent la lecture TTS et aident à choisir les clips vidéo de réaction. Elle est activée par défaut. Désactive-la pour garder des répliques parlées sans fioritures.

## Démarrer, recevoir et terminer un appel

### Démarrer un appel

Quand les appels sont activés pour un chat, un bouton en forme de téléphone apparaît à côté du nom de la conversation. Son infobulle indique **Start call** (démarrer l'appel) quand aucun appel n'est en cours, ou **Open call** (ouvrir l'appel) quand un appel tourne déjà.

Clique sur **Start call**. L'écran d'appel complet s'ouvre aussitôt.

Un seul appel peut être actif ou en sonnerie par chat. Si tu en lances un alors qu'un autre est déjà en cours, Marinara rouvre cet appel au lieu d'en créer un nouveau.

### Appels entrants des personnages

Un personnage peut t'appeler si la commande **Calls** est activée. Quand cela arrive et que tu es dans ce chat, une bannière **Incoming call** (appel entrant) apparaît au-dessus du champ de message. Elle contient un bouton **Decline call** (refuser l'appel) et un bouton **Answer call** (répondre à l'appel).

Si tu es ailleurs dans Marinara, une notification d'appel entrant apparaît, comme pour un message autonome de personnage. Une brève sonnerie retentit. Marinara ne répond jamais à ta place : c'est à toi de cliquer sur **Answer call**.

Seuls les personnages actuellement disponibles rejoignent un appel. Si un emploi du temps ou un statut marque un personnage comme hors ligne, ce personnage ne rejoint pas l'appel, même s'il fait partie du chat.

### Terminer un appel

Tu peux terminer un appel à tout moment avec le bouton rouge **End call** (raccrocher). Il se trouve sur l'écran d'appel et sur la fenêtre flottante réduite. Un personnage peut aussi quitter ou terminer l'appel via une commande en appel.

Quand l'appel se termine, Marinara arrête l'enregistrement, ferme proprement les médias et ajoute une carte à la Conversation habituelle.

## L'écran d'appel et ses contrôles

Le plateau de l'appel affiche une tuile par participant, ce qui inclut ton persona et chaque personnage disponible. Il met en évidence celui qui parle.

Le chat de l'appel regroupe les messages écrits et les réponses des personnages en texte uniquement. Sur ordinateur, il occupe un panneau latéral. Sur mobile, il se cache derrière un bouton **Open call chat** (ouvrir le chat de l'appel). Le chat s'ouvre alors en panneau latéral plein, et tu le refermes avec **Close call chat**. Les répliques parlées servent à l'audio, elles ne sont pas répétées sous forme de bulles séparées.

Le champ de saisie de l'appel comprend une zone **Message in call** et un bouton **Send**. Il propose aussi un sélecteur d'émojis, de GIF et de stickers, ainsi qu'un changement rapide de connexion. Les pièces jointes ne sont pas encore prises en charge dans le chat de l'appel.

La barre de contrôle, en bas du plateau, contient des boutons-icônes :

- Micro : te coupe ou te réactive. Son infobulle change selon le mode d'entrée, par exemple **Unmute microphone with Local Whisper**.
- **Turn camera on** et **Turn camera off** : actifs uniquement en mode **Provider-native audio/video** avec **Camera and screen input** activé.
- **Share screen** et **Stop sharing screen** : même règle que pour la caméra.
- **Character volume** : ouvre un panneau contextuel avec un bouton de coupure du son et un curseur de volume de 0 à 100. La valeur par défaut est 100 pour cent, et ton choix est conservé dans le navigateur.
- **Soundboard** : ouvre une liste de sons avec un contrôle **Upload**.
- **End call** : le bouton rouge pour raccrocher.

Si tu restes coupé un certain temps, un rappel apparaît : "You are muted! Remember to unmute yourself first if you want to talk."

Si tu quittes la Conversation alors qu'un appel est actif, l'appel se réduit en une petite fenêtre flottante. Elle affiche le nom du chat, le temps écoulé et un bouton rouge **End call**. Clique sur son corps pour revenir à l'écran d'appel complet. Marinara maintient l'appel pendant que tu navigues dans les autres panneaux.

### Soundboard

Le soundboard est une petite bibliothèque de sons que tu peux jouer pendant n'importe quel appel. Quatre sons intégrés sont fournis par défaut : **Soft Chime**, **Tap**, **Sparkle** et **Pop**. Les sons intégrés ne peuvent pas être supprimés.

Tu peux téléverser tes propres sons avec le bouton **Upload**. Les formats acceptés sont mp3, wav, ogg, webm et m4a, jusqu'à 8 Mo chacun. Tes téléversements disposent d'un contrôle de suppression. Les personnages peuvent eux aussi jouer un son via la commande soundboard.

## Character Video Presence et clips vidéo d'appel

L'option **Character Video Presence** remplace la tuile d'avatar fixe par un clip vidéo en boucle du personnage, généré par l'IA. Elle est désactivée par défaut. L'interrupteur s'appelle **Character video presence**, dans **Chat Settings**, puis **Agents**, puis **Calls**.

Pour mettre en place les clips vidéo d'appel :

1. Crée une connexion Video Generation dans **Settings** (Paramètres), puis **Connections**.
2. Marque une connexion comme **Default for Videos**, ou choisis une connexion vidéo à chaque génération.
3. Ouvre l'éditeur d'un personnage ou d'un persona.
4. Ouvre l'onglet **Sprites**, puis le sous-onglet **Clips**.
5. Utilise **Generate Clips** ou **Upload extra** pour ajouter les clips voulus.

Pour en savoir plus sur les sprites et l'éditeur, voir [Sprites de personnage (expressions et corps entier)](../characters/sprites.md).

Le bouton **Generate Clips** ouvre la fenêtre **Generate Call Clips**. Tu y choisis une **Video Generation Connection** et l'option **Use avatar as reference**. Tu sélectionnes ensuite les clips standards à créer. Autre possibilité : définir un clip personnalisé avec un **Clip name** et une description d'action.

Les six types de clips standards sont **Idle**, **Talking**, **Laughing**, **Angry**, **Crying** et **Sighing**. Pendant une réplique parlée, Marinara lit les indications de voix présentes dans la ligne, comme `[sighs]` ou `[laughs]`. Il choisit un clip de réaction correspondant, puis ramène le personnage à Idle.

Deux interrupteurs supplémentaires apparaissent sous **Character video presence** quand elle est activée :

- **Automatic video clips generation** : désactivé par défaut. Une fois activé, Marinara génère automatiquement les deux clips de base seulement, **Idle** et **Talking**, pour un participant qui en a besoin. Les clips de réaction et les clips personnalisés ne sont jamais générés automatiquement. Ceux-là, tu les crées à la main depuis le sous-onglet **Clips**.
- **Custom clips** : désactivé par défaut. Une fois activé, un personnage peut, rarement, demander un clip ponctuel pendant un appel en direct, puis rejouer ensuite un clip personnalisé déjà prêt. C'est prévu pour des demandes visuelles particulières, pas pour chaque humeur ou chaque réplique.

Un clip manquant ne bloque jamais un appel. Le personnage affiche simplement un avatar fixe jusqu'à ce qu'un clip soit prêt. Si tu découpes un clip, il boucle à l'intérieur de la plage de découpe définie.

Désactiver **Character video presence** désactive aussi **Automatic video clips generation** et **Custom clips**.

Les clips vidéo d'appel ne sont pas la même chose que les **Videos** de la galerie. Les Videos de la galerie contiennent les vidéos de scène issues des chats Roleplay, Game Mode ou Conversation. Le sous-onglet **Clips** contient les boucles de présence réutilisables décrites ici.

## Commandes cachées pendant l'appel

Les personnages peuvent utiliser en appel les mêmes commandes cachées entre crochets que dans les messages Conversation habituels. Chaque commande a besoin de son interrupteur correspondant dans **Chat Settings → Agents**, et l'interrupteur général **Commands** de cette section doit être activé. Ces commandes s'exécutent en silence : elles ne sont jamais prononcées ni affichées comme du texte.

- **Selfies** : un personnage génère et envoie une photo dans le chat de l'appel. Cela demande une **Selfie Connection** définie pour le chat. Voir [Selfies](selfies.md).
- **Memories** : un personnage enregistre un souvenir sur un autre personnage à partir de l'appel.
- **Music** : un personnage lance un morceau via le Music Player, si une source musicale est connectée.
- **Haptics** : un personnage pilote un appareil haptique connecté pendant les moments intimes, si un appareil est connecté.
- **Reactions** : un personnage réagit avec un émoji à ton dernier message écrit dans l'appel.
- **Cross-Post** : un personnage déplace le sujet en cours vers un autre chat Conversation partagé.
- **Schedule Updates** : un personnage change son propre statut (en ligne, inactif, ne pas déranger ou hors ligne) et son activité pendant un moment, puis revient à son emploi du temps. Voir [Emplois du temps des personnages et messages autonomes](schedules.md#characters-can-change-their-own-status).
- **Notes** et **Influence** : ces commandes enregistrent une note durable ou un coup de pouce ponctuel, et n'apparaissent que si le chat dispose d'un chat connecté.
- **Soundboard** : un personnage joue l'un des sons du soundboard de l'appel.
- Quitter et terminer : un personnage peut quitter l'appel de son côté, ou terminer l'appel pour tout le monde.

Certaines commandes ajoutent une petite entrée système dans le chat de l'appel. Un selfie, par exemple, affiche une entrée "sent a selfie" avec l'image, et un clip personnalisé affiche un texte indicatif pendant le rendu du clip.

## Le résumé de fin d'appel

Quand un appel se termine, Marinara ajoute une carte à la transcription de la Conversation habituelle. La carte indique le statut de l'appel. Tu peux voir ces titres :

- **Call Started**
- **Incoming Call**
- **Call Ended**, avec la durée de l'appel
- **Call Declined**
- **Missed Call**

Après une carte **Call Ended**, Marinara génère en arrière-plan un court résumé de l'appel audio s'il s'est passé quelque chose d'intéressant. Il ajoute ensuite ce résumé à la Conversation comme contexte masqué, que le modèle peut lire. Le modèle reste ainsi au courant de ce qui a été dit, sans que tout l'appel soit recopié dans le chat visible.

La transcription détaillée de l'appel reste dans un stockage d'appel séparé. Seul le court résumé revient dans le chat habituel.

## Résolution des problèmes

### Le démarrage échoue et indique que l'audio de l'appel n'est pas activé

Si tu cliques sur **Start call** et que tu vois "Conversation call audio is not enabled in Chat Settings", active **Call Audio Pipeline**. Ouvre **Chat Settings**, puis **Agents**, puis **Calls**, et active-le. Ce réglage est obligatoire pour tous les appels, même un appel où tu ne fais qu'écrire. Il est global : l'activer dans un chat l'active pour tous les appels Conversation.

### J'entends les personnages, mais ils ne m'entendent pas

Ouvre **Chat Settings**, puis **Agents**, puis **Calls**, et vérifie que **Call Audio Pipeline** est activé. Vérifie ensuite que ton navigateur a bien donné à la page Marinara l'autorisation d'utiliser le micro.

Sur Firefox, ou si la reconnaissance vocale du navigateur ne marche pas, installe Calls et télécharge Local Whisper. Ouvre **Connections**, puis **Local Model**, puis **Local Speech Model**. Choisis ensuite **Mic recording + Local Whisper**.

### Local Whisper se déclare indisponible

Local Whisper a besoin du runtime ONNX natif de ta plateforme. ONNX est le moteur qui fait tourner le modèle vocal local. Si le modèle a été installé pour une autre version de Node, réinstalle les dépendances avec la version de Node qui fait tourner Marinara, puis redémarre.

Si tu utilises une build "Lite" de Marinara, Local Whisper y est désactivé. L'application affiche : "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model." Passe à une installation complète pour disposer de Local Whisper.

### L'option de reconnaissance vocale du navigateur ne fait rien

La reconnaissance vocale du navigateur dépend de sa prise en charge. Firefox ne propose pas la même reconnaissance Web Speech que les navigateurs Chromium et Safari. Utilise **Mic recording + Local Whisper** pour une capture mains libres, ou **Manual system dictation** pour écrire avec la dictée de ton système d'exploitation.

### Un personnage écrit au lieu de parler

Vérifie les réglages Text to Speech et l'attribution des voix. Le personnage a besoin soit de la voix globale unique, soit d'une voix par personnage que ton fournisseur TTS sait résoudre. Voir [Configurer la synthèse vocale (TTS)](../media/tts-setup.md).

### Le modèle comprend mal ce que je dis

Essaie **Whisper Base (Multilingual)** plutôt que Whisper Tiny, il est plus précis. Réduis le bruit de fond et la musique. Si ton modèle le permet, bascule **Audio input mode** sur **Provider-native audio/video** pour qu'il entende ton audio directement. Pour une langue que Whisper gère mal, [utilise ton propre serveur de reconnaissance vocale](#use-your-own-speech-to-text-server) avec un modèle qui la connaît, et indique le code de cette langue dans le champ **Language**.

### Le test Speech to Text échoue

Lis le message sous le bouton **Test**. "Could not reach the speech-to-text server" signifie que l'adresse est erronée ou que le serveur ne tourne pas. Un message qui mentionne `STT_LOCAL_URLS_ENABLED` signifie que le serveur se trouve sur une autre machine de ton réseau ; définis cette variable à `true` dans `.env`. Un nombre comme 401 ou 404 vient de ton serveur : 401 indique généralement une clé API erronée, et 404 une adresse ou un nom de modèle erroné.

### Le bouton caméra ou écran est désactivé

Ces boutons ne fonctionnent qu'en mode **Provider-native audio/video** avec **Camera and screen input** activé. Change le **Audio input mode**, active **Camera and screen input**, puis réessaie. Ces boutons ne servent d'ailleurs à quelque chose que si ton modèle sait réellement exploiter la caméra ou l'écran.

### L'appel ne fonctionne pas sur mon téléphone

Sur mobile, le chat de l'appel s'ouvre avec le bouton **Open call chat** et se ferme avec **Close call chat**. Si un personnage refuse de parler, vérifie que Text to Speech est bien configuré. Pour les problèmes de micro sur mobile, les mêmes étapes Local Whisper et autorisations s'appliquent.

### Un personnage a cessé de répondre en plein appel

Les personnages ne répondent que tant que la connexion de modèle choisie pour le chat fonctionne. Si les réponses s'arrêtent, vérifie cette connexion, puis renvoie un message dans le chat de l'appel.

## Guides associés

- [Configurer la synthèse vocale (TTS)](../media/tts-setup.md)
- [Configurer un modèle local](../connections/local-model.md)
- [Sprites de personnage (expressions et corps entier)](../characters/sprites.md)
- [Mode Conversation : premiers pas](getting-started.md)
