# Génération de vidéos de scène

Ce guide explique comment Marinara Engine transforme l'illustration d'une scène en un court clip vidéo MP4. Au programme : les fournisseurs de vidéo, la génération d'un clip depuis la galerie, les commandes de Game Mode et les réglages vidéo. Une vidéo de scène est un bref clip animé fabriqué à partir d'une seule image fixe.

## À quoi sert la vidéo de scène

Une vidéo de scène part d'une image déjà présente dans la galerie et l'anime en un court clip MP4. L'image fixe devient la première image du clip, et l'IA ajoute le mouvement. Les vidéos de scène fonctionnent dans les chats **Roleplay** et **Game Mode**.

Il faut toujours une image au départ. La génération de vidéos de scène ne part jamais d'un simple texte. Génère ou téléverse une image dans la galerie avant de pouvoir l'animer.

Les vidéos de scène passent par un type de connexion à part, appelé **Video Generation** (génération de vidéos). Ce n'est pas la même chose que la génération d'images classique. Marinara enregistre les clips terminés avec le chat et les affiche dans la galerie, où tu peux les épingler, les télécharger ou les visionner.

## Les connexions Video Generation

Pour créer des vidéos de scène, commence par ajouter une connexion capable de générer de la vidéo. Cela se passe dans le même panneau **Connections** (connexions) que les connexions de chat et d'images.

1. Ouvre **Settings** (Paramètres), puis ouvre **Connections**.
2. Clique sur **Add Connection** (ajouter une connexion).
3. Règle le type de fournisseur sur **Video Generation**.
4. Sous **Video Service** (service vidéo), choisis un des six services ci-dessous.
5. Saisis la clé API – un code secret, un peu comme un mot de passe – pour un service cloud. ComfyUI en local n'en a pas besoin.
6. Pour les services cloud, choisis un modèle ou garde celui du fournisseur par défaut. Pour ComfyUI, laisse le modèle vide, sauf si le workflow utilise `%model%`.
7. Enregistre la connexion.

Le sélecteur **Video Service** propose six choix. Chacun remplit une adresse web par défaut et, le cas échéant, un modèle par défaut :

| Video Service        | Modèle par défaut                 | Notes                                                                        |
| -------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| **Google AI Studio** | `gemini-omni-flash-preview`       | Fait tourner les modèles vidéo Gemini Omni et Veo via l'API Gemini.          |
| **xAI Imagine**      | `grok-imagine-video-1.5`          | Grok Imagine vidéo via l'API Videos de xAI.                                  |
| **OpenRouter Video** | `google/veo-3.1`                  | Les modèles vidéo via OpenRouter. Tu peux saisir n'importe quel identifiant de modèle vidéo OpenRouter. |
| **Atlas Cloud**      | `google/veo3.1/text-to-video`     | Modèles hébergés texte-vers-vidéo et image-vers-vidéo via Atlas Cloud.       |
| **Seedance 2.0**     | `seedance-2-0`                    | Modes vidéo texte, première image, et première et dernière image.            |
| **ComfyUI**          | Défini par le workflow            | Workflows vidéo WAN et autres, en local, exportés au format API.             |

**Google AI Studio** couvre deux familles de modèles. **Gemini Omni** utilise `gemini-omni-flash-preview`. **Google Veo** utilise `veo-3.1-generate-preview`. C'est le modèle choisi dans la connexion qui détermine lequel des deux tourne.

Pour **ComfyUI**, utilise l'adresse locale habituelle `http://127.0.0.1:8188` et colle un workflow vidéo au format API dans le champ **ComfyUI Workflow**. Ce workflow est obligatoire. Voir [Configuration des workflows ComfyUI](comfyui.md#comfyui-video-workflows) pour les balises de remplacement et les exigences sur le nœud de sortie.

### En faire la connexion vidéo par défaut

L'éditeur d'une connexion Video Generation affiche un groupe **Default for Videos** (connexion vidéo par défaut). Active l'interrupteur **Use as default video connection** pour que Marinara puisse s'appuyer sur cette connexion quand un chat n'a pas la sienne. Ne marque qu'une seule connexion comme connexion vidéo par défaut.

### Réglages vidéo par défaut de la connexion

Une connexion Video Generation dispose de son propre panneau **Video Generation Defaults** (réglages vidéo par défaut) dans l'éditeur de connexion. Tu y définis la durée de clip, le format d'image et la résolution par défaut de cette connexion. Ces réglages propres à la connexion l'emportent sur la durée de repli valable pour toute l'application.

| Service          | Durée par défaut | Plage de durée | Format d'image | Résolution           |
| ---------------- | -------------- | ------------ | ------------ | ---------------- |
| Gemini Omni      | 10 s           | 1 à 60 s     | 16:9         | Celle du fournisseur |
| Google Veo       | 8 s            | 4, 6 ou 8 s  | 16:9         | 720p             |
| xAI Imagine      | 10 s           | 1 à 15 s     | 16:9         | 720p             |
| OpenRouter Video | 10 s           | 1 à 60 s     | 16:9         | 720p             |
| Atlas Cloud      | 8 s            | 1 à 60 s     | 16:9         | 720p             |
| Seedance 2.0     | 5 s            | 4 à 15 s     | 16:9         | 720p             |
| ComfyUI          | 5 s            | 1 à 60 s     | 16:9         | 720p             |

Gemini Omni n'a pas de champ de résolution, et sa durée s'écrit dans le texte du prompt – le texte que Marinara envoie à l'IA – au lieu d'un réglage à part. Google Veo impose 8 secondes dès qu'il anime une image de référence, car il lui faut 8 secondes pour faire la transition entre la première et la dernière image.

### Les images de référence de Seedance

Seedance doit récupérer l'image de référence via un lien web public avant de pouvoir l'animer. Un serveur Marinara local n'a pas de lien public : une installation locale simple demande donc une étape de plus.

Ouvre la connexion Seedance et active l'interrupteur **Upload Seedance reference frames temporarily** (téléverser temporairement les images de référence Seedance). Marinara téléverse alors l'image de référence vers un lien public temporaire, que Seedance peut lire. La durée de vie de ce lien se règle sous **Temporary link lifetime** (durée de vie du lien temporaire) ; elle est de 12 heures par défaut.

Si le serveur Marinara dispose déjà d'une adresse web publique, tu peux définir une variable d'environnement au lieu de passer par les téléversements temporaires. Voir la [Référence de configuration du serveur](../CONFIGURATION.md) pour le réglage de référence vidéo.

## Choisir un fournisseur

Les six services fabriquent tous de courts clips à partir de l'image. Ils diffèrent par la vitesse, la durée des clips et la façon de traiter les images de référence.

- **Google AI Studio (Gemini Omni)** : durée souple, jusqu'à 60 secondes. La durée est intégrée au prompt, ce n'est pas une commande à part.
- **Google AI Studio (Veo)** : très bonne qualité, mais durée figée à 4, 6 ou 8 secondes. Il passe à 8 secondes quand il anime une image.
- **xAI Imagine** : clips de 1 à 15 secondes. La limite de longueur du prompt y est plus basse que sur les autres services.
- **OpenRouter Video** : de 1 à 60 secondes, avec la possibilité de saisir n'importe quel modèle vidéo pris en charge par ton compte OpenRouter.
- **Atlas Cloud** : **Fetch Models** (Récupérer les modèles) charge le catalogue vidéo actuel d’Atlas Cloud, avec les modèles image-vers-vidéo en premier et leur tarif de départ par seconde de vidéo. Si le catalogue est inaccessible, Marinara propose les modèles de départ Veo 3.1 et Seedance 2.0. Tu peux aussi saisir l’identifiant exact d’un modèle vidéo Atlas Cloud ; ses limites de durée, de résolution et d’images de référence s’appliquent toujours.
- **Seedance 2.0** : clips de 4 à 15 secondes, avec les modes première image et première et dernière image. Il lui faut un lien public vers l'image de référence.
- **ComfyUI** : génération en local via ton propre workflow au format API. Marinara téléverse l'image de référence directement vers ComfyUI quand le workflow utilise `%reference_image_name%`.

Attends-toi à ce que les tâches vidéo prennent du temps. Le fournisseur lance la tâche, puis Marinara patiente et vérifie régulièrement jusqu'à ce que le clip soit prêt. Compte plusieurs minutes par clip, bien plus que pour une image fixe. Les gros modèles WAN locaux peuvent dépasser le délai d'expiration de 30 minutes par défaut : augmente `VIDEO_GEN_TIMEOUT_MS` et redémarre Marinara si besoin.

### Différences entre les modèles Atlas Cloud

Les modèles Atlas Cloud n’acceptent pas tous les mêmes réglages. Avant chaque requête, Marinara lit le schéma d’entrée publié du modèle sur `static.atlascloud.ai` et y adapte les valeurs par défaut de ta connexion :

- L’illustration source est envoyée dans le champ d’image utilisé par ce modèle.
- La durée du clip est ramenée à la durée proposée la plus proche. Un modèle limité à 5 ou 10 secondes transforme une valeur par défaut de 8 secondes en 10 secondes.
- La résolution est ramenée au niveau proposé le plus proche. Les modèles qui attendent des dimensions en pixels reçoivent le `width*height` le plus proche pour ton format et ta résolution.
- Un réglage absent du modèle est omis, afin que sa propre valeur par défaut s’applique.

Le journal du serveur énumère les valeurs modifiées dans une ligne commençant par `[video-gen/atlas-cloud] fitted request`. Si le schéma est illisible, Marinara envoie la même requête générale qu’auparavant.

Choisis un modèle **image-to-video** (image-vers-vidéo) pour les vidéos de scène. Un modèle texte-vers-vidéo n’a pas de champ d’image : il ignore donc ton illustration et produit un autre clip à partir du seul prompt. Le serveur le signale dans son journal.

**Test Video** (Tester la vidéo) envoie un simple dégradé comme première image lorsque le modèle Atlas Cloud choisi exige une image. Les modèles image-vers-vidéo peuvent ainsi réussir le test de connexion.

### Options des modèles Atlas Cloud

De nombreux modèles Atlas Cloud ont leurs propres entrées, comme `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion` ou des listes de LoRA. L’éditeur de connexion les affiche pour le modèle choisi :

1. Ouvre la connexion Atlas Cloud et choisis ou saisis un modèle.
2. Déplie **Video Defaults** (Valeurs par défaut des vidéos), puis **Atlas Cloud setup** (Configuration Atlas Cloud).
3. Cherche **Model options** (Options du modèle) sous les réglages de durée, de format et de résolution.

En haut de **Model options** figurent les durées, résolutions, dimensions d’image et formats acceptés par le modèle. Un modèle texte-vers-vidéo y affiche aussi un avertissement, car il ne peut pas utiliser l’image de ta galerie.

Chaque option reprend exactement le nom et la description donnés par Atlas Cloud. Toutes commencent sur **Model default** (Valeur par défaut du modèle), avec la valeur du fournisseur entre parenthèses. Une option laissée sur **Model default** n’est pas envoyée : Atlas Cloud décide. Modifie une option pour envoyer ta valeur avec chaque vidéo de cette connexion, y compris **Test Video**. Les listes et objets, comme les LoRA, se saisissent en JSON.

Les choix sont enregistrés par modèle : passer à un autre modèle puis revenir conserve les options de chacun. **Reset model options** (Réinitialiser les options du modèle) efface les choix du modèle actuel. Clique sur **Save** (Enregistrer) dans la connexion pour conserver tes modifications.

Si une option enregistrée ne correspond plus au modèle, par exemple après une modification des entrées par Atlas Cloud, Marinara l’omet de la requête et la nomme dans la ligne `[video-gen/atlas-cloud] fitted request` du journal.

## Générer une vidéo depuis la galerie

Les chats **Roleplay** comme **Game Mode** peuvent créer des vidéos de scène depuis le panneau **Gallery** (galerie). Ouvre-le avec l'icône d'image ou de galerie du chat. Les chats Game Mode disposent d'un second endroit pour cela, le panneau **Game Assets**, présenté plus loin dans ce guide.

La galerie a un onglet **Images** et un onglet **Videos**, chacun avec un compteur. Les images fixes se trouvent sous **Images**. Les clips terminés se trouvent sous **Videos**.

Pour animer l'image la plus récente :

1. Vérifie qu'au moins une image existe sous l'onglet **Images**. Passe d'abord par **Illustrate** (illustrer) ou téléverse une image.
2. Clique sur **Video** dans la rangée d'actions en haut de la galerie.
3. Si l'option **Expose media prompts before sending** est activée sous **Settings**, **Generations**, **Overall Generations**, relis ou modifie le prompt d'animation compilé, puis clique sur **Generate**. Fermer cette fenêtre sans valider n'envoie aucune requête au fournisseur.
4. Le bouton devient **Generating...**, et une bannière signale que la génération de vidéos est en cours.
5. Une fois terminé, le clip apparaît sous l'onglet **Videos**.

Pour animer une image précise plutôt que la plus récente :

1. Ouvre l'onglet **Images**.
2. Survole l'image voulue.
3. Clique sur le bouton **Animate illustration** (animer l'illustration), l'icône de pellicule, dans les commandes de survol.

La même fenêtre **Review Video Prompt** (relire le prompt vidéo) s'affiche pour **Animate illustration** quand la relecture du prompt est activée. Elle montre le prompt exact compilé par le serveur, la durée, le format d'image et la résolution qui seront utilisés pour l'image sélectionnée. Ta modification ne vaut que pour cette génération. En Roleplay, les instructions réutilisables qui produisent ce prompt se règlent à part, avec **Roleplay Gallery Animation Director**, sous **Settings**, **Generations**, **Video Generation Prompt Overrides**.

Sous l'onglet **Videos**, chaque clip se lit directement dans la page et affiche sa durée et le nom du modèle. Épingle un clip avec **Pin video to chat** (épingler la vidéo au chat), ou enregistre-le avec **Download scene video** (télécharger la vidéo de scène). S'il n'y a encore aucun clip, l'onglet affiche **No videos yet**.

Si tu tentes de créer une vidéo alors que le chat ne contient aucune image, Marinara affiche ce message : "Add or generate a gallery image before generating a scene video." Génère ou téléverse d'abord une image, puis réessaie.

## La vidéo de scène en Game Mode

Game Mode offre un second endroit pour créer une vidéo de scène : le panneau **Game Assets** (ressources de la partie). Ouvre-le avec le bouton **Game Assets** dans les commandes de jeu.

1. Ouvre le panneau **Game Assets**.
2. Clique sur **Generate video** (générer une vidéo). Son infobulle indique "Generate a scene video from the latest illustration."
3. Le clip le plus récent se lit dans le panneau dès qu'il est prêt.

Le bouton **Generate video** reste inactif tant que la partie n'a pas à la fois une connexion vidéo et une illustration de scène. Si tu cliques trop tôt, un de ces messages peut apparaître :

- "Choose a Video Generation connection in Game Settings first." Définis une connexion vidéo pour la partie.
- "Generate a scene illustration before generating a scene video." Crée d'abord une image.

Si un clip échoue, le panneau affiche "Scene video generation failed." Réessaie et, si l'échec se répète, vérifie la connexion et la clé API.

## Choisir une connexion vidéo pour un chat

Chaque chat choisit sa propre connexion vidéo. Cela se règle sous **Chat Settings** (réglages du chat), puis **Agents**, puis **Scene Videos**.

Les chats **Roleplay** affichent une carte **Scene Videos** décrite ainsi : "Generate manual MP4 scene videos from gallery images." Elle contient une seule commande, le menu déroulant **Video Connection**. Choisis-y ta connexion Video Generation.

Les chats **Game Mode** affichent une carte **Scene Videos** décrite ainsi : "Generate MP4 scene videos from game illustrations." Elle propose davantage de commandes :

- **Video Connection** : la connexion Video Generation utilisée par cette partie.
- **Game Video Prompt** : le modèle de prompt qui décide de la façon dont l'image s'anime. Le modèle intégré par défaut est **Cinematic Scene Video**.
- **Edit Video Presets** : ajoute et modifie tes propres copies du modèle de prompt vidéo pour ce chat.

Le **Game Video Prompt** continue de piloter les vidéos manuelles de la galerie et de **Game Assets** en Game Mode. Les animations de la galerie en Roleplay passent, elles, par **Roleplay Gallery Animation Director**. L'agent Storyboard installé possède son propre **Storyboard Video Prompt** par défaut, que chaque chat Roleplay ou Game Mode peut remplacer dans **Chat Settings > Agents > Storyboards**. Réinitialiser ce choix ramène à la valeur par défaut de l'agent Storyboard ; le chat n'hérite pas du prompt d'un autre chat.

À la création d'un chat Game Mode, l'assistant de configuration propose lui aussi un sélecteur **Video Generation Connection**. Il se trouve à l'étape **Features** et apparaît une fois que tu as activé **Visual Generation**.

Si un chat n'a pas de connexion vidéo à lui, Marinara se rabat sur la connexion marquée **Use as default video connection**. En l'absence de connexion de chat et de connexion par défaut, les actions vidéo affichent un avertissement qui t'invite à en choisir une.

## Les réglages de génération de vidéos

Certains réglages vidéo par défaut se trouvent dans les paramètres de l'application, pas sur une connexion. Ouvre **Settings**, puis **Generations**, puis la section **Video Generation**. Elle est décrite ainsi : "Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls."

Le principal réglage de vidéo de scène ici est **Scene video fallback length** (durée de repli des vidéos de scène), fixé à 10 secondes par défaut. Il ne sert que si la connexion vidéo sélectionnée n'a pas de durée propre. Tu peux le régler de 1 à 60 secondes.

Cette section contient aussi **Video Generation Prompt Overrides**, où tu modifies les modèles de prompt vidéo réutilisables. **Roleplay Gallery Animation Director** pilote les instructions envoyées au Prompt Model sélectionné avant la génération d'un clip de galerie en Roleplay. Sa variable `${durationSeconds}` est remplacée par la durée de clip choisie. C'est la méthode avancée pour changer la façon dont les clips bougent, sans toucher au code.

La même section propose un réglage **Animated expression length**. Il relève d'une autre fonctionnalité, les sprites de portrait animés. Voir [Expressions animées](animated-expressions.md) à ce sujet.

## Les storyboards

L'agent Storyboard, à télécharger, sait construire des images-clés ordonnées et des clips, en Roleplay comme en Game Mode. En Game Mode, il part d'un tour terminé du Game Master (le maître du jeu) ; en Roleplay, il réunit des échanges terminés en un épisode dans le fil. Quand les animations sont activées, Marinara anime chaque image-clé réussie avec la connexion vidéo choisie et le **Storyboard Video Prompt** de l'agent.

Les storyboards ont leurs propres commandes et leur propre guide. Voir [Guide de l'agent Storyboard](../game/storyboard.md) pour l'installation et le fonctionnement dans les deux modes.

## Dépannage

### "Choose a Video Generation connection"

Aucune connexion vidéo n'est sélectionnée pour le chat. Ouvre **Chat Settings**, puis **Agents**, puis **Scene Videos**, et choisis une connexion. Si le menu déroulant est vide, ajoute une connexion sous **Settings**, puis **Connections**.

### "Add or generate a gallery image before generating a scene video"

Une vidéo de scène anime toujours une image existante. Passe par **Illustrate**, téléverse une image, ou clique sur **Animate illustration** sur une image que tu possèdes déjà.

### La vidéo met longtemps à arriver

C'est normal. Le fournisseur lance la tâche, et Marinara patiente et vérifie régulièrement jusqu'à ce que le clip soit prêt. Veo, xAI, OpenRouter, Atlas Cloud et Seedance fonctionnent tous ainsi, et un clip peut demander plusieurs minutes.

### Seedance n'arrive pas à lire l'image de référence

Seedance a besoin d'un lien public vers l'image. Sur un serveur local, ouvre la connexion Seedance et active l'interrupteur **Upload Seedance reference frames temporarily**. Voir la section Seedance ci-dessus.

### Une requête vidéo échoue systématiquement

Vérifie que la connexion a une clé API valide et que ton compte a bien accès à la vidéo. Ouvre la connexion sous **Settings**, puis **Connections**, et confirme la clé et le modèle. Les délais d'expiration côté serveur pour la vidéo sont traités dans la [Référence de configuration du serveur](../CONFIGURATION.md).

## Guides associés

- [Expressions animées](animated-expressions.md)
- [Guide de l'agent Storyboard](../game/storyboard.md)
- [Les storyboards LTX 2.3 en Game Mode](../game/ltx-2-3-storyboards.md)
- [Les fournisseurs d'IA pris en charge](../connections/providers-reference.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
