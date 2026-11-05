# Génération de vidéos de scène

Une vidéo de scène est un court clip MP4 de la scène. Elle peut animer une image de la galerie : l'image devient la première image du clip et l'IA ajoute le mouvement. En Roleplay, elle peut aussi être créée à partir du récit seul. Ce guide explique comment configurer un service vidéo, créer des clips depuis la galerie et en Game Mode, et modifier les réglages vidéo.

Les vidéos de scène fonctionnent dans les chats Roleplay et Game Mode. Les chats Conversation envoient plutôt des messages vidéo. Voir [Messages vidéo](../conversation/selfies.md#video-messages).

Game Mode et **Animate illustration** (animer l'illustration) partent toujours d'une image : génère ou téléverse donc une image d'abord. En Roleplay, `/video` et le bouton **Video** (vidéo) de la galerie suivent le réglage **First frame** (première image) d'Illustrator. Sans première image choisie, ils n'ont besoin d'aucune image.

Les vidéos de scène passent par un type de compte à part, **Video Generation** (génération de vidéos), et non par la génération d'images classique. Les clips terminés sont enregistrés avec le chat et affichés dans la galerie, où tu peux les épingler, les télécharger ou les visionner.

## Configurer un service vidéo

1. Clique sur **Connections** (Connexions) dans la barre du haut, puis sur **Add** (ajouter). La fenêtre **Add account** (ajouter un compte) s'ouvre.
2. Choisis un service dans la section **Images & video** (images et vidéo). Les services sont listés ci-dessous.
3. Colle la clé API – un code secret, un peu comme un mot de passe – d'un service cloud. ComfyUI en local n'en a pas besoin. SwarmUI n'a besoin d'un Swarm Auth Token que si ton serveur exige un compte.
4. Clique sur **Connect** (connecter), puis choisis un modèle ou garde celui par défaut. NanoGPT n'a pas de modèle par défaut : choisis-en un dans sa liste. Pour ComfyUI, laisse le modèle non défini, sauf si le workflow utilise `%model%`. Pour SwarmUI, le modèle est facultatif.
5. Ouvre le modèle vidéo et clique sur **Test video** (tester la vidéo) pour le vérifier.

Chaque service remplit une adresse par défaut et, le cas échéant, un modèle par défaut. NanoGPT n'a pas de modèle par défaut : choisis-en un.

| Service vidéo | Modèle par défaut | Notes |
| --- | --- | --- |
| **Google AI Studio** | `gemini-omni-flash-preview` | Fait tourner les modèles Gemini Omni et Veo via l'API Gemini. |
| **xAI Imagine** | `grok-imagine-video-1.5` | Grok Imagine vidéo via l'API Videos de xAI. |
| **OpenRouter Video** | `google/veo-3.1` | Tu peux saisir n'importe quel identifiant de modèle vidéo OpenRouter. |
| **NanoGPT** | aucun, à choisir | Les modèles vidéo via NanoGPT. |
| **Atlas Cloud** | `google/veo3.1/text-to-video` | Modèles hébergés texte-vers-vidéo et image-vers-vidéo. |
| **Seedance 2.0** | `seedance-2-0` | Modes texte, première image, et première et dernière image. |
| **ComfyUI** | défini par le workflow | Workflows vidéo WAN et autres, en local, au format API. |
| **SwarmUI** | défini par le workflow | Workflows vidéo ComfyUI via ton serveur SwarmUI. |

**Google AI Studio** couvre deux familles. **Gemini Omni** utilise `gemini-omni-flash-preview`. **Google Veo** utilise `veo-3.1-generate-preview`. C'est le modèle que tu choisis qui détermine laquelle tourne.

Pour **ComfyUI**, utilise `http://127.0.0.1:8188` et colle un workflow vidéo au format API dans **ComfyUI workflow (required)**. Il est obligatoire. Voir [Configuration des workflows ComfyUI](comfyui.md#comfyui-video-workflows) pour les placeholders et les nœuds de sortie.

Pour **SwarmUI**, Marinara remplit `http://127.0.0.1:7801`. Colle un workflow vidéo au format API dans **ComfyUI workflow (required)**. Il est obligatoire. SwarmUI ne peut pas utiliser les placeholders `%reference_image_name%` : utilise donc `%reference_image%`. Si ton serveur exige un compte, colle un Swarm Auth Token dans **API key** (clé API).

### En faire le modèle vidéo par défaut

Pour utiliser un modèle vidéo quand un chat n'a pas le sien, règle la tâche **Video** sous **Defaults** (valeurs par défaut), en haut du panneau **Connections**. Dans Chat Settings, elle apparaît sous le nom **Default video provider** (fournisseur vidéo par défaut). Sans modèle de chat ni modèle par défaut, les actions vidéo t'avertissent pour que tu en choisisses un.

### Instructions pour les prompts vidéo

Chaque modèle vidéo a un champ **Video prompting instructions** (instructions pour les prompts vidéo). Un prompt, c'est le texte que Marinara envoie à l'IA. Indique à l'IA qui écrit tes prompts vidéo ce qu'attend ton modèle vidéo, comme les mouvements de caméra, la longueur du prompt ou le son. Ce champ guide les animations de la galerie en Roleplay, les messages vidéo en Conversation et l'option **Image-aware shot planning** (planification des plans à partir de l'image) de Storyboard. Si l'IA en recopie une phrase entière dans le prompt, Marinara retire cette phrase. Les vidéos de scène de Game Mode, les clips d'appel et les expressions animées écrivent leurs prompts séparément et l'ignorent.

### Réglages vidéo par défaut de chaque modèle

Un modèle vidéo a un panneau **Video defaults** (réglages vidéo par défaut) pour la durée de clip, le format d'image et la résolution par défaut. Ces valeurs l'emportent sur la durée de repli valable pour toute l'application.

Durée par défaut, plage de durée, format d'image et résolution de chaque service :

- Gemini Omni : 10 s, de 1 à 60 s, 16:9, résolution par défaut du fournisseur.
- Google Veo : 8 s, 4, 6 ou 8 s, 16:9, 720p.
- xAI Imagine : 10 s, de 1 à 15 s, 16:9, 720p.
- OpenRouter Video : 10 s, de 1 à 60 s, 16:9, 720p.
- Atlas Cloud : 8 s, de 1 à 60 s, 16:9, 720p.
- Seedance 2.0 : 5 s, de 4 à 15 s, 16:9, 720p.
- ComfyUI et SwarmUI : 5 s, de 1 à 60 s, 16:9, 720p.

Gemini Omni n'a pas de champ de résolution, et sa durée est écrite dans le texte du prompt. Google Veo impose 8 secondes dès qu'il anime une image de référence, car il lui faut 8 secondes pour fondre la première et la dernière image.

<a id="seedance-reference-frames"></a>

### Images de référence de Seedance

Seedance doit récupérer ton image de référence via un lien web public. Un serveur Marinara local n'en a pas : une installation locale simple demande donc une étape de plus.

1. Ouvre le modèle Seedance.
2. Active **Upload Seedance reference frames temporarily** (téléverser temporairement les images de référence Seedance). L'image est envoyée vers un lien public temporaire.
3. Facultatif : règle **Temporary link lifetime** (durée de vie du lien temporaire). La valeur par défaut est de 12 heures.

Si ton serveur Marinara a déjà une adresse publique, tu peux plutôt définir une variable d'environnement. Voir la [Référence de configuration du serveur](../CONFIGURATION.md).

## Créer une vidéo depuis la galerie

Les chats Roleplay et Game Mode peuvent créer des vidéos de scène depuis la galerie. Ouvre **Chat Settings** (réglages du chat) et déplie **Gallery** (galerie). La galerie a un onglet **Images** et un onglet **Videos** (vidéos), chacun avec un compteur.

### En Roleplay

Le bouton **Video**, dans la rangée d'actions en haut de la galerie, crée un clip de la dernière réponse, comme `/video`. Ajoute une description après `/video` pour préciser ce que le clip doit montrer.

- **First frame** : suit le réglage **First frame** d'Illustrator. Il s'agit d'une nouvelle image d'Illustrator de la dernière réponse (dessinée d'abord, puis animée), de l'avatar ou du sprite du personnage, ou d'aucune image. Si aucune n'est choisie, le clip est créé à partir du récit seul.
- **Avatar** : le clip part de la première personne que ta description nomme, y compris ton persona. Une partie de nom que personne d'autre ne partage suffit, avec une majuscule ("Lena" pour "Dr. Lena Kowalski"). Si personne n'est nommé, il part du personnage du chat.
- **Relecture** : si **Expose media prompts before sending** (afficher les prompts médias avant l'envoi) est activé, tu peux d'abord relire et modifier le prompt du clip.
- **Contexte** : l'IA lit autant de messages récents qu'Illustrator pour une image (le réglage **Context Size** (taille du contexte) d'Illustrator, sous **Agent Budget** (budget de l'agent) sur son écran de configuration).
- **Sans image** : quand le clip part d'aucune image ou d'un avatar, l'IA décrit elle-même la scène. Ses instructions sont **Roleplay Clip Director** (réalisation des clips Roleplay), sous **Settings → Generations → Video Generation Prompt Overrides** (Paramètres → Générations → redéfinitions des prompts de génération vidéo).

Le clip terminé se lit directement sous la dernière réponse, même si l'image vient d'une réponse plus ancienne. Les clips ne s'ouvrent pas d'eux-mêmes dans une fenêtre flottante. Pour en faire flotter un, utilise **Pin video to chat** (épingler la vidéo au chat) sous **Videos**. Retire un clip d'un message avec son bouton **X**. Il reste dans la galerie.

### En Game Mode

1. Vérifie qu'au moins une image se trouve sous **Images**. Utilise **Illustrate** (illustrer) ou téléverse une image.
2. Clique sur **Video** dans la rangée d'actions en haut de la galerie.
3. Si **Expose media prompts before sending** est activé (**Settings → Generations → Overall Generations** (Paramètres → Générations → Générations globales)), relis ou modifie le prompt et clique sur **Generate** (générer). Annuler ne lance aucune requête.
4. Le bouton affiche **Generating...** et une bannière indique que la génération de vidéo est en cours.
5. Une fois terminé, le clip apparaît sous **Videos**.

S'il n'y a aucune image, Marinara affiche "Add or generate a gallery image before generating a scene video." Crée ou téléverse une image, puis réessaie.

### Animer une image

1. Ouvre l'onglet **Images**.
2. Passe le pointeur sur l'image.
3. Clique sur **Animate illustration**, l'icône de pellicule.

Quand la relecture des prompts est activée, une fenêtre affiche le prompt compilé exact, la durée, le format d'image et la résolution pour cette image. Ta modification ne vaut que pour ce clip. En Roleplay, l'IA qui planifie le mouvement lit autant de messages récents qu'Illustrator, jusqu'à la réponse à laquelle l'image appartient. Ses instructions réutilisables sont **Roleplay Gallery Animation Director** (réalisation des animations de galerie Roleplay), sous **Settings → Generations → Video Generation Prompt Overrides**.

Chaque clip sous **Videos** se lit directement dans la page, avec sa durée et le nom du modèle. Utilise **Pin video to chat** ou **Download scene video** (télécharger la vidéo de scène). Sans clip, l'onglet affiche **No videos yet**.

## Choisir un service

Les huit services créent tous de courts clips à partir de ton image.

- **Google AI Studio (Gemini Omni)** : durée jusqu'à 60 secondes, écrite dans le prompt.
- **Google AI Studio (Veo)** : très bonne qualité, durée fixée à 4, 6 ou 8 secondes. Il utilise 8 secondes quand il anime une image.
- **xAI Imagine** : de 1 à 15 secondes, avec une limite de longueur de prompt plus basse que les autres.
- **OpenRouter Video** : de 1 à 60 secondes, avec n'importe quel modèle vidéo pris en charge par ton compte.
- **NanoGPT** : de 1 à 60 secondes, sans modèle par défaut.
- **Atlas Cloud** : charge le catalogue vidéo actuel d'Atlas Cloud, avec les modèles image-vers-vidéo en premier, chacun avec son tarif de départ par seconde de vidéo produite. Si le chargement échoue, Marinara propose les modèles de départ Veo 3.1 et Seedance 2.0. Tu peux saisir l'identifiant exact d'un modèle. Les limites du modèle s'appliquent toujours.
- **Seedance 2.0** : de 4 à 15 secondes, avec les modes première image et première et dernière image. Il lui faut un lien public vers ton image de référence.
- **ComfyUI** : en local, via ton workflow au format API. Marinara téléverse l'image de référence directement quand le workflow utilise `%reference_image_name%`.
- **SwarmUI** : en local, via ton workflow et ton serveur SwarmUI. L'image de référence entre via `%reference_image%`.

Les tâches vidéo sont lentes. Le service lance la tâche, puis Marinara patiente et vérifie jusqu'à ce que le clip soit prêt. Un clip peut prendre plusieurs minutes. Les gros modèles WAN locaux peuvent avoir besoin de plus que les 30 minutes par défaut. Augmente `VIDEO_GEN_TIMEOUT_MS` et redémarre Marinara.

### Différences entre les modèles Atlas Cloud

Les modèles Atlas Cloud n'acceptent pas tous les mêmes réglages. Avant chaque requête, Marinara lit le schéma d'entrée publié du modèle sur `static.atlascloud.ai` et y adapte tes valeurs par défaut.

- L'image source est envoyée dans le champ d'image utilisé par ce modèle.
- La durée du clip est ramenée à la durée proposée la plus proche. Un modèle limité à 5 ou 10 secondes transforme une valeur par défaut de 8 secondes en 10.
- La résolution est ramenée au niveau proposé le plus proche. Les modèles qui attendent une taille en pixels reçoivent le `width*height` le plus proche pour ton format d'image et ta résolution.
- Un réglage absent du modèle est omis : la valeur par défaut du modèle s'applique.

Le log – le journal du serveur – énumère chaque valeur modifiée sur une ligne qui commence par `[video-gen/atlas-cloud] fitted request`. Si le schéma ne peut pas être lu, Marinara envoie la même requête générale qu'auparavant.

Choisis un modèle image-vers-vidéo pour les vidéos de scène. Un modèle texte-vers-vidéo n'a pas de champ d'image : il ignore ton image et crée à partir du prompt un clip sans rapport, ce que le log du serveur signale. **Test video** envoie un simple dégradé comme première image quand le modèle exige une image : les modèles image-vers-vidéo peuvent ainsi réussir le test.

De nombreux modèles Atlas Cloud ont leurs propres entrées, comme `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion` ou des listes de LoRA.

1. Ouvre le modèle Atlas Cloud et choisis ou saisis un modèle.
2. Déplie **Video defaults**, puis **Atlas Cloud setup** (configuration Atlas Cloud).
3. Cherche **Model options** (options du modèle) sous les réglages de durée, de format d'image et de résolution.

Le haut de **Model options** liste les durées, résolutions, dimensions d'image et formats d'image que le modèle accepte. Un modèle texte-vers-vidéo affiche aussi un avertissement. Chaque option reprend le nom et la description d'Atlas Cloud, et commence sur **Model default** (valeur par défaut du modèle), avec la valeur par défaut entre parenthèses. Une option laissée sur **Model default** n'est pas envoyée. Modifie-en une pour envoyer ta valeur avec chaque vidéo de ce modèle, y compris **Test video**. Les entrées de type liste ou objet, comme les LoRA, se saisissent en JSON.

Les choix sont enregistrés pour chaque modèle. **Reset model options** (réinitialiser les options du modèle) les efface pour le modèle actuel. Clique sur **Save** (enregistrer) pour conserver tes modifications. Si une option enregistrée ne correspond plus au modèle, Marinara l'omet et la nomme dans la ligne du log.

## Créer une vidéo dans Game Assets

Game Mode propose un second endroit pour créer une vidéo de scène : **Game Assets** (ressources de jeu). Clique sur son bouton en forme de dossier, près du coin supérieur droit du chat. Il s'ouvre dans une fenêtre sur ordinateur, et dans un panneau sur toute la largeur sur téléphone. Si tu l'as déplacé dans Chat Settings, ouvre plutôt la section **Game Assets** à cet endroit.

1. Ouvre **Game Assets**.
2. Clique sur **Generate video** (générer une vidéo), décrit par "Generate a scene video from the latest illustration".
3. Le clip le plus récent s'y lit dès qu'il est prêt.

**Generate video** reste inactif tant que la partie n'a pas à la fois un modèle vidéo et une illustration de scène. Si tu cliques trop tôt, tu peux voir "Choose a Video Generation connection in Game Settings first." (définis un modèle vidéo pour la partie) ou "Generate a scene illustration before generating a scene video." Si un clip échoue, le panneau affiche "Scene video generation failed." Réessaie, et vérifie ta clé si l'échec se répète.

## Choisir un modèle vidéo pour un chat

Chaque chat choisit son propre modèle vidéo sous **Chat Settings → Agents → Scene Videos** (réglages du chat → agents → vidéos de scène).

- **Roleplay** affiche une carte **Scene Videos** ("Generate manual MP4 scene videos from gallery images"). Elle n'a qu'une commande, la liste des modèles vidéo.
- **Game Mode** affiche une carte **Scene Videos** ("Generate MP4 scene videos from game illustrations") avec davantage de commandes. La liste des modèles vidéo choisit le modèle. **Game Video Prompt** (prompt vidéo de Game) est le modèle de prompt qui décide de la façon dont l'image s'anime. La valeur intégrée par défaut est **Cinematic Scene Video**. **Edit Video Prompt Presets** (modifier les presets de prompt vidéo) ajoute et modifie tes propres copies pour ce chat.

**Game Video Prompt** pilote les vidéos manuelles de la galerie et de Game Assets en Game Mode. Les animations de la galerie en Roleplay utilisent plutôt **Roleplay Gallery Animation Director**. L'agent Storyboard a son propre **Storyboard Video Prompt** (prompt vidéo de Storyboard) par défaut. Chaque chat peut le remplacer sous **Chat Settings → Agents → Storyboards**. Réinitialiser ramène à la valeur par défaut de l'agent Storyboard.

Quand tu crées un chat Game Mode, l'assistant de configuration propose un sélecteur de modèle vidéo à l'étape **Features** (fonctionnalités), une fois la génération visuelle activée.

## Réglages de génération de vidéos

Certains réglages vidéo par défaut valent pour toute l'application. Ouvre **Settings → Generations** et repère **Video Generation** ("Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls").

- **Scene video fallback length** (durée de repli des vidéos de scène) : ne sert que si le modèle vidéo sélectionné n'a pas de durée propre. La valeur par défaut est de 10 secondes. La plage va de 1 à 60.
- **Video Generation Prompt Overrides** : modifie les modèles de prompt vidéo réutilisables. **Roleplay Gallery Animation Director** définit les instructions envoyées au Prompt Model avant un clip de galerie en Roleplay. Sa variable `${durationSeconds}` devient la durée du clip.
- **Videos per reply** (vidéos par réponse) : le nombre de messages vidéo que les personnages de Conversation peuvent envoyer dans une réponse, et le nombre de clips qu'Illustrator ajoute à une réponse Roleplay. La valeur par défaut est 3. La plage va de 1 à 10. Chaque personnage de Conversation en envoie au maximum un. Ce réglage existe pour les chats de groupe et pour les demandes de plusieurs vidéos à la fois. Augmente-le pour laisser davantage de personnages envoyer un clip. Diminue-le pour économiser des requêtes. Les clips au-delà de la limite sont ignorés. `/video` et le bouton **Video** de la galerie ne comptent pas.
- **Animated expression length** (durée des expressions animées) relève des sprites de portrait animés. Voir [Expressions animées](animated-expressions.md).

## Les storyboards

L'agent Storyboard, à télécharger, construit des images-clés ordonnées et des clips en Roleplay et en Game Mode. Quand les animations sont activées, Marinara anime chaque image-clé réussie avec le modèle vidéo sélectionné et le **Storyboard Video Prompt** de l'agent. Voir le [Guide de l'agent Storyboard](../game/storyboard.md).

## Dépannage

### "Choose a Video Generation connection"

Ton chat n'a pas de modèle vidéo. Ouvre **Chat Settings → Agents → Scene Videos** et choisis-en un. Si la liste est vide, ajoutes-en un sous **Connections**.

### "Add or generate a gallery image before generating a scene video"

Game Mode et **Animate illustration** ont besoin d'une image existante. Roleplay peut créer un clip à partir du récit seul quand aucune première image n'est choisie. Utilise **Illustrate**, téléverse une image, ou clique sur **Animate illustration** sur une image que tu as déjà.

### La vidéo met longtemps à arriver

C'est normal. Google, xAI, OpenRouter, NanoGPT, Atlas Cloud et Seedance lancent tous une tâche, et Marinara attend qu'elle se termine. Un clip peut prendre plusieurs minutes.

### Seedance n'arrive pas à lire l'image de référence

Seedance a besoin d'un lien public vers ton image. Sur un serveur local, active **Upload Seedance reference frames temporarily** sur le modèle Seedance. Voir [Images de référence de Seedance](#seedance-reference-frames).

### Une requête vidéo échoue sans cesse

Vérifie que le compte a une clé API valide et l'accès à la vidéo. Ouvre le compte dans **Connections** et confirme la clé et le modèle. Pour les délais d'expiration du serveur, voir la [Référence de configuration du serveur](../CONFIGURATION.md).

## Guides associés

- [Expressions animées](animated-expressions.md)
- [Guide de l'agent Storyboard](../game/storyboard.md)
- [Les storyboards LTX 2.3 en Game Mode](../game/ltx-2-3-storyboards.md)
- [Les fournisseurs d'IA pris en charge](../connections/providers-reference.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
