# Fournisseurs de génération d'images et configuration

La génération d'images alimente les illustrations de scène, les selfies, les arrière-plans de scène ainsi que les avatars, portraits et sprites générés. Ce guide explique comment ajouter un service d'images et ce dont chaque service a besoin. Dès qu'un modèle d'images fonctionne, toutes les fonctions d'image de l'application peuvent s'en servir.

## Ajouter un service d'images

Une clé API est un code secret qu'un service te donne pour que Marinara puisse utiliser ton compte. Marinara remplit pour toi l'adresse web de chaque service : tu en saisis donc rarement une.

1. Clique sur **Connections** (Connexions) dans la barre du haut, puis sur **Add** (ajouter). La fenêtre **Add account** (ajouter un compte) s'ouvre.
2. Trouve le service. La liste comporte une section **Images & video** (images et vidéo), et **Search providers** (rechercher des fournisseurs) t'aide à en trouver un.
3. Colle ta clé dans le champ **API key** (clé API). Les services gratuits et locaux n'en ont pas besoin. Pour un serveur que tu fais tourner toi-même, remplis le champ d'adresse.
4. Clique sur **Connect** (connecter). Marinara teste le compte.
5. Choisis un modèle d'images dans la liste, ou saisis un identifiant de modèle. C'est ton modèle d'images. Il apparaît sous le compte dans le panneau **Connections**.
6. Ouvre le modèle d'images et clique sur **Test image** (tester une image). Marinara génère une petite image de test.
7. Pour en faire le modèle que l'application utilise pour les images, règle la tâche **Images** sous **Defaults** (valeurs par défaut), en haut du panneau **Connections**.

Pour ajouter un autre modèle d'images à un compte, ouvre son menu **⋯** et clique sur **Add image model** (ajouter un modèle d'images). La fenêtre complète est décrite dans [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

Si ça n'a pas marché : **Test image** échoue quand la clé ou l'adresse est fausse. Vérifie d'abord les deux. **Test provider** (tester le fournisseur) vérifie seulement que Marinara peut joindre le service. **Test image** génère une vraie image et peut consommer du crédit.

## Obtenir une image dans un chat

Une fois qu'un modèle d'images est défini pour la tâche **Images**, demande une image dans un chat.

1. Ajoute l'agent Illustrator à un chat Roleplay. Voir [Agent Illustrator](illustrator-agent.md).
2. Ouvre **Chat Settings** (réglages du chat), déplie **Gallery** (galerie) et clique sur **Illustrate** (illustrer).
3. Attends la fin de **Generating...**. L'image apparaît dans la galerie.

Dans un chat Roleplay, tu peux aussi utiliser la commande `/illustrate`. Voir [Commandes slash](../chats/slash-commands.md).

## Choisir un service

Marinara remplit pour toi l'adresse de chaque service. Les services cloud demandent un compte, et la plupart une clé API. Les services gratuits ne demandent aucune clé. Les services locaux font tourner un logiciel d'image sur ton propre ordinateur.

**Pour démarrer le plus simplement :** choisis **Pollinations**. Ce service est gratuit et ne demande ni compte ni clé. Choisis plus tard un service plus puissant si tu veux de meilleures images.

| Service | Clé API | Où ça tourne |
| --- | --- | --- |
| OpenAI (DALL-E) | Oui | Cloud |
| ChatGPT (Codex login) | Non, via `codex login` | Cloud |
| Stability AI | Oui | Cloud |
| Together AI | Oui | Cloud |
| Arli AI | Oui | Cloud |
| NovelAI | Oui | Cloud |
| OpenRouter Images | Oui | Cloud |
| xAI / Grok Imagine | Oui | Cloud |
| Venice.ai | Oui | Cloud |
| Z.AI | Oui | Cloud |
| Atlas Cloud | Oui | Cloud |
| fal.ai | Oui | Cloud |
| SpicyAPI | Oui | Cloud |
| NanoGPT | Oui | Cloud |
| Block Entropy | Oui | Cloud |
| RunPod Serverless (ComfyUI) | Oui | Cloud |
| Pollinations | Non | Cloud gratuit |
| Stable Horde | Facultative | Cloud gratuit |
| SD Web UI (AUTOMATIC1111 / Forge) | Non | Local |
| ComfyUI | Non | Local |
| SwarmUI | Facultative | Local |
| Draw Things | Non | Local |

Remarques sur les services simples :

- **OpenAI (DALL-E)** : propose les modèles DALL-E et GPT Image. Seul GPT Image 2.6 génère des GIF en boucle. Voir [GPT Image 2.6](#gpt-image-26).
- **Stability AI** : modèles Stable Diffusion et Stable Image.
- **Together AI** : FLUX et d'autres modèles d'image ouverts.
- **OpenRouter Images** : atteint les modèles d'image via l'interface de chat d'OpenRouter ; les modèles varient donc d'un compte à l'autre.
- **xAI / Grok Imagine** : utilise Grok Imagine.
- **NanoGPT** : un agrégateur ; utilise donc sa liste de modèles.
- **Pollinations** : le moyen le plus rapide d'essayer la génération d'images. Aucun compte n'est nécessaire.
- **Stable Horde** : un réseau alimenté par la communauté. Une clé gratuite donne une meilleure priorité dans la file d'attente.
- **SD Web UI** et **Draw Things** : démarre le logiciel avec son interface applicative activée. Marinara traite Draw Things comme un serveur AUTOMATIC1111 (l'application tourne sur macOS ou iOS).
- **Block Entropy** : Marinara n'a pas de gestionnaire dédié et envoie donc des requêtes compatibles OpenAI. La compatibilité n'est pas confirmée. Teste-le avec **Test image** avant de compter dessus.

## Services à configuration particulière

### GPT Image 2.6

GPT Image 2.6 fonctionne avec un compte **OpenAI (DALL-E)**. **GPT Image 2.6 Flare** est le modèle le plus rapide. **GPT Image 2.6 Sunburst** offre une meilleure qualité et reste plus stable d'une édition à l'autre. Les deux acceptent les mêmes tailles et les mêmes arrière-plans transparents que GPT Image 2.5, et **Image quality** (qualité d'image) monte jusqu'à **Max**.

Le modèle planifie chaque image avant de la dessiner. Pour qu'il planifie moins, ajoute `{"complexity": "low"}` ou `{"complexity": "medium"}` dans les **Custom Parameters** (paramètres personnalisés) du modèle d'images. La valeur par défaut est `high`. Une complexité plus élevée peut prendre plus de temps et, lors d'une édition, changer davantage que ce que tu as demandé.

GPT Image 2.6 peut aussi générer un court GIF en boucle. Marinara n'en demande un que là où une fonctionnalité ou un agent téléchargé propose des GIF :

| Limite | Valeur |
| --- | --- |
| Compte | **OpenAI (DALL-E)** avec une clé API |
| Modèles | GPT Image 2.6 Flare ou Sunburst |
| Images du GIF | De 2 à 12, 9 par défaut |
| Durée d'une image | De 20 à 2 000 ms, 200 ms par défaut |
| Taille d'une image | Environ 0,66 mégapixel : 816x816 en carré, 608x1088 en portrait |
| Images envoyées | Aucune. Un GIF est dessiné à partir du seul prompt |
| Arrière-plan transparent | Non |

OpenAI autorise davantage d'images, mais ne publie pas le nombre de pixels qu'un GIF peut contenir : Marinara s'en tient donc à 12 petites images. **ChatGPT (Codex login)**, **OpenRouter Images**, **NanoGPT**, ToAPIs et les autres services ne peuvent pas générer de GIF. Marinara refuse ces requêtes avant d'envoyer quoi que ce soit : tu ne paies donc rien. Un compte **OpenAI-compatible** (compatible OpenAI) est essayé comme un compte OpenAI.

Un GIF qui échoue n'est jamais remplacé par une image fixe. Si le service répond avec une image fixe, la requête échoue. Le modèle **If it fails** (en cas d'échec) de la tâche **Images** n'est essayé que s'il peut générer des GIF.

> **Avertissement :** OpenAI ne publie pas le prix d'un GIF. Attends-toi à ce qu'un GIF coûte le prix de plusieurs images, et une image fixe renvoyée à la place est facturée elle aussi.

### ChatGPT (Codex login)

Ce service utilise ton forfait ChatGPT au lieu d'une clé API : les images ne demandent donc aucun crédit de l'API OpenAI.

1. Sur l'ordinateur qui fait tourner Marinara, installe le CLI Codex et lance `codex login` une fois. C'est la même identification que celle du compte de chat ChatGPT. Voir [Connexions par abonnement Claude, ChatGPT et Grok](../connections/subscription-clis.md#openai-chatgpt).
2. Choisis le service. Il n'y a ni clé ni adresse à remplir. Marinara remplit le modèle `gpt-image-2`, celui que Codex utilise pour les images.

**Test provider** vérifie seulement que Marinara peut lire ton identification Codex. **Test image** génère une vraie image, qui compte dans tes limites d'images ChatGPT. Ce service ne peut pas générer de GIF, même avec un identifiant de modèle GPT Image 2.6. Avec des images de référence, Marinara envoie une requête d'édition qui en contient jusqu'à 16. ChatGPT peut renvoyer une taille en pixels différente : Marinara indique donc aussi le rapport d'aspect voulu dans le prompt. Ce service passe par le point d'accès image de ChatGPT qu'utilise Codex, et non par l'API publique d'OpenAI : OpenAI peut donc le modifier sans prévenir.

### Arli AI

Ce service fait tourner des modèles Stable Diffusion hébergés. Un modèle est obligatoire : saisis le nom du modèle d'image Arli AI que tu veux. Il utilise les mêmes champs **Local Image Defaults** (valeurs par défaut des images locales) que SD Web UI (voir [Local Image Defaults](#local-image-defaults-per-connection)). La première image de référence sert d'image de départ. Ce service sert uniquement aux images. Pour les modèles de chat Arli AI, voir [Fournisseurs d'IA pris en charge](../connections/providers-reference.md#arli-ai).

### NovelAI

NovelAI se concentre sur le style anime. Avec les modèles V4, V4.5 et V5, Marinara envoie des prompts de personnage natifs, avec leurs positions, pour les storyboards à plusieurs personnages et les scènes de l'Illustrator. Les images de référence précises ne fonctionnent que sur un modèle V4.5.

### Venice.ai

Marinara passe par le point d'accès image natif de Venice, désactive le floutage optionnel du mode sûr de Venice et convertit les dimensions demandées vers le format de taille de chaque modèle. La politique de Venice ou les limites du modèle peuvent malgré tout refuser une requête.

### Z.AI

Utilise une clé API Z.AI générale. Les clés GLM Coding Plan et l'adresse `/api/coding/paas/v4` ne fonctionnent pas pour les images. Choisis **GLM-Image** ou **CogView 4**. Marinara convertit le rapport d'aspect en une taille prise en charge par le modèle et télécharge le résultat temporaire dans le stockage local. Ce service fait uniquement du texte vers image et n'envoie pas d'images de référence.

### Atlas Cloud

Marinara charge le catalogue actuel des modèles texte-vers-image et image-vers-image d'Atlas Cloud. S'il n'y arrive pas, il affiche une liste de départ (Nano Banana, Gemini Flash Image, FLUX 1.1 Pro). Tu peux toujours saisir l'identifiant exact d'un modèle. Les tâches sont asynchrones : Marinara lance la tâche, puis interroge Atlas Cloud jusqu'à ce que l'image soit prête. Les images de référence sont envoyées aux identifiants de modèle qui annoncent un fonctionnement image-vers-image, d'édition ou Kontext. Les schémas des modèles Atlas varient : pour d'autres identifiants, consulte la documentation Atlas Cloud du modèle.

### fal.ai

Crée une clé API sur [fal.ai](https://fal.ai/dashboard/keys). La liste de départ propose `fal-ai/flux/schnell` et `fal-ai/flux/dev`. Tu peux saisir l'identifiant d'un autre point d'accès texte-vers-image dont l'entrée et la sortie sont compatibles. **Test provider** vérifie uniquement la configuration. **Test image** envoie une vraie requête et consomme du crédit fal.ai.

Marinara envoie le prompt et les dimensions, puis télécharge la première image renvoyée. Les prompts négatifs sont ajoutés sous forme de texte. Utilise **Custom Parameters** pour les options du modèle, comme `seed`, `num_inference_steps` ou `image_size`. Ce service utilise des requêtes synchrones texte-vers-image, n'envoie pas d'images de référence et ne reprend pas les tâches interrompues. Voir la [référence API](https://fal.ai/models/fal-ai/flux/schnell/api) du modèle.

### SpicyAPI

Crée une clé dans la [console SpicyAPI](https://spicyapi.ai/console/keys) et choisis **SpicyAPI**. Marinara remplit le modèle `alibaba/z-image-spicy-pro/text-to-image`. Tu peux saisir un autre identifiant, comme `bytedance/seedream-5.0-pro/text-to-image`. **Test provider** lit la liste des modèles : cela ne coûte donc rien. **Test image** crée une vraie image et consomme ton solde.

Choisis le service **SpicyAPI**. N'utilise ni **OpenAI (DALL-E)** ni un compte compatible OpenAI avec une adresse SpicyAPI. L'adresse de style OpenAI de SpicyAPI ne gère que le texte.

Chaque modèle prend ses propres paramètres. Marinara demande à SpicyAPI lesquels le modèle accepte et n'envoie que ceux-là, sous la forme la plus proche qu'il propose (rapport d'aspect, largeur et hauteur, ou taille fixe). Si un modèle n'a pas de champ de prompt négatif, le prompt négatif est ajouté à la fin du prompt. Utilise **Custom Parameters** pour les autres options, comme `seed`, `resolution` ou `loras`.

Chaque image est une tâche. Marinara attend, revient vérifier au bout d'une minute environ, puis télécharge le résultat. Si la connexion tombe, il reprend la même tâche au lieu d'en payer une nouvelle. Les modèles d'édition (identifiants qui se terminent par `/edit`) reçoivent tes images de référence. SpicyAPI accepte jusqu'à 1 Mo par image et 2 Mo par requête : Marinara réduit donc les images plus grandes et laisse de côté celles en trop qui ne tiennent pas.

### SwarmUI

SwarmUI peut répartir le travail de ComfyUI dans sa propre file d'attente. Un serveur local sans comptes ne demande aucune clé. Si ton serveur exige un compte, colle un Swarm Auth Token dans **API key**. La liste des modèles affiche les modèles de ton serveur SwarmUI.

Le champ **ComfyUI workflow (optional)** peut rester vide. Laisse-le vide pour utiliser les propres réglages d'image de SwarmUI, ou colle un workflow (voir plus bas). Active **Save images in SwarmUI** (enregistrer les images dans SwarmUI) dans **Local Image Defaults** pour garder aussi chaque image dans le dossier de sortie de SwarmUI. Marinara conserve sa propre copie dans tous les cas.

### Services locaux sur ton réseau

`localhost` désigne l'ordinateur qui fait tourner Marinara. Les serveurs d'images locaux installés sur cet ordinateur fonctionnent sans réglage supplémentaire. Si le serveur tourne sur un autre ordinateur de ton réseau, autorise les adresses du réseau local dans la configuration du serveur. Voir la [référence de configuration du serveur](../CONFIGURATION.md).

Quand un service renvoie une URL au lieu des données de l'image, Marinara télécharge les URL de CDN publiques en appliquant ses contrôles habituels sur les requêtes sortantes. Une URL de résultat privée ou en loopback n'est acceptée que si son schéma, son nom d'hôte et son port correspondent exactement à ceux du service d'images configuré. Depuis cette origine, les redirections ne peuvent pas basculer vers un autre service local. Si un proxy local range les résultats sur une autre origine privée, règle-le pour qu'il serve ces fichiers depuis la même origine que son API d'images.

## JSON de workflow ComfyUI et RunPod

Pour **ComfyUI**, **SwarmUI** et **RunPod Serverless (ComfyUI)**, un champ **ComfyUI workflow (optional)** ou **(required)** apparaît. Colles-y un JSON de workflow exporté depuis ComfyUI avec **Save (API Format)**, **Export (API)** ou **Export to API**, selon ta version de ComfyUI. Il est facultatif pour ComfyUI et SwarmUI, et obligatoire pour RunPod, qui demande ton jeton d'API RunPod comme clé API, un **RunPod endpoint ID** (identifiant du point d'accès RunPod) et le workflow.

Place ces placeholders, des marqueurs de texte, dans le workflow, là où Marinara doit insérer une valeur :

- `%prompt%` et `%negative_prompt%` pour les prompts.
- `%width%`, `%height%` et `%seed%` pour la taille et la graine aléatoire.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` et `%denoise%` pour les réglages de génération.
- `%reference_image%` et `%reference_image_01%` à `%reference_image_04%` pour les données des images de référence.
- `%reference_image_name%` et `%reference_image_name_01%` à `%reference_image_name_04%` pour téléverser les images de référence et insérer leurs noms de fichier dans un nœud LoadImage d'un ComfyUI local.

`%prompt%` est le plus important. L'éditeur t'avertit quand il manque. Pour ComfyUI, un champ vide utilise un workflow par défaut intégré. Pour SwarmUI, il utilise les propres réglages de SwarmUI. RunPod n'a aucun workflow par défaut : le workflow y est donc obligatoire. Les trois acceptent jusqu'à 4 images de référence en base64 brut. Les placeholders de téléversement par nom de fichier ne fonctionnent qu'avec un ComfyUI local.

La marche à suivre complète pour l'export, des exemples, les règles de guillemets, les images de référence, les workflows propres à un personnage, l'accès réseau et le dépannage sont détaillés dans [Configurer un workflow ComfyUI](comfyui.md).

<a id="local-image-defaults-per-connection"></a>

## Local Image Defaults, connexion par connexion

Un panneau **Local image defaults** apparaît sur un modèle d'images pour **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI**, **Draw Things**, **Arli AI**, **SwarmUI** et **RunPod Serverless (ComfyUI)**. Draw Things et Arli AI affichent les champs de SD Web UI. SwarmUI et RunPod affichent les champs de ComfyUI. Ces réglages ne s'appliquent que lorsque ce modèle génère une image. **Reset** (réinitialiser) rétablit les valeurs intégrées.

Chaque service a un champ **Seed** (graine aléatoire). La valeur -1 garde chaque image aléatoire. Tout autre nombre réutilise cette graine à chaque fois. Les autres champs dépendent du service.

| Service | Champ | Par défaut |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2img denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise schedule | karras |

Chaque service a aussi les champs **Prompt prefix** (préfixe de prompt) et **Negative prefix** (préfixe négatif). Le texte saisi là est ajouté au début de chaque prompt de ce modèle. AUTOMATIC1111 / Forge et ComfyUI ont un champ **Clip skip**. AUTOMATIC1111 / Forge ajoute un interrupteur **Restore faces**. ComfyUI ajoute un interrupteur qui téléverse une image de remplacement de 1x1 quand aucune image de référence n'est fournie, ce qui ne compte que pour les workflows personnalisés contenant des placeholders d'image de référence. NovelAI ajoute **Guidance rescale** et **UC preset**.

## La prise en charge des images de référence varie selon le service

Une image de référence est une image existante que tu envoies avec ton prompt, pour que la nouvelle image garde le visage d'un personnage ou un style graphique.

| Service | Images de référence |
| --- | --- |
| OpenAI (DALL-E) | Jusqu'à 16, modèles GPT Image uniquement. Aucune pour un GIF |
| ChatGPT (Codex login) | Jusqu'à 16 |
| NovelAI | Jusqu'à 16, modèle V4.5 uniquement |
| xAI / Grok Imagine | Jusqu'à 3 |
| NanoGPT | Jusqu'à 3 |
| ComfyUI, RunPod Serverless (ComfyUI), SwarmUI | Jusqu'à 4, via les placeholders du workflow |
| Stability AI, Arli AI, SD Web UI, Draw Things | Première image uniquement, en image vers image |
| Atlas Cloud | Première image, pour les identifiants de modèle compatibles image vers image, édition ou Kontext |
| SpicyAPI | Modèles d'édition uniquement, jusqu'à la limite du modèle, réduites pour tenir |
| OpenRouter Images | Pris en charge, sans limite fixe |
| Venice.ai, Z.AI | Non pris en charge pour le texte vers image |
| Together AI, Pollinations, Stable Horde, fal.ai | Non pris en charge |

La référence précise de NovelAI ne fonctionne que sur un modèle V4.5 comme `nai-diffusion-4-5-full`. NovelAI n'a pas publié Precise Reference pour V5. Si tu demandes des références sur un autre modèle, Marinara génère l'image sans elles et inscrit un avertissement dans le journal du serveur.

## Mettre les requêtes de génération de médias en file d'attente

L'interrupteur **Queue media generation requests** (mettre les requêtes de génération de médias en file d'attente) se trouve dans **Settings → Generations → Overall Generations** (Paramètres → Générations → Générations globales). Il est activé par défaut.

Quand il est activé, Marinara envoie les tâches d'image à chaque compte d'images une par une, et les tâches de vidéo à chaque compte de vidéos une par une, dans des files séparées. Une image et une vidéo pour le même compte peuvent s'exécuter en même temps. Cela vaut pour toutes les fonctionnalités qui les demandent : l'Illustrator, les trackers, les commandes, la galerie, les ressources de Game Mode et les agents téléchargés comme Slurp. Deux modèles qui ont la même adresse et la même clé API partagent une file. Des comptes différents s'exécutent toujours en même temps. NovelAI bénéficie aussi d'une courte pause entre deux tâches, et quand il répond qu'il est occupé, Marinara attend et réessaie deux fois.

Garde-le activé pour les services qui refusent deux requêtes simultanées. Désactive-le seulement si ton service gère beaucoup de requêtes à la fois et que tu veux aller plus vite.

## Guides associés

- [Configurer un workflow ComfyUI](comfyui.md)
- [Agent Illustrator](illustrator-agent.md)
- [Profils de style d'image](style-profiles.md)
- [Arrière-plans de scène et galerie](scene-backgrounds.md)
- [Selfies](../conversation/selfies.md)
- [Fournisseurs d'IA pris en charge](../connections/providers-reference.md)
