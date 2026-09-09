# Fournisseurs de génération d'images et configuration

Ce guide explique comment relier un service de génération d'images à Marinara Engine. Il détaille aussi ce dont chacun des 17 services a besoin. La génération d'images alimente les illustrations de scène, les selfies, les arrière-plans de scène ainsi que les avatars, portraits et sprites générés.

La génération d'images se configure comme un type de connexion à part. Dès qu'une connexion image fonctionne, toutes les fonctions d'image de l'application peuvent s'en servir.

## Ajouter une connexion de génération d'images

Une **API key** (clé API) est un mot de passe secret fourni par un fournisseur : il autorise Marinara à utiliser ton compte. Une **Base URL** (URL de base) est l'adresse web de l'interface applicative du service. Quand tu choisis un service, Marinara remplit la bonne Base URL à ta place.

Voici la marche à suivre pour ajouter une connexion image.

1. Ouvre le panneau **Connections** (Connexions).
2. Clique sur **New** (Nouveau) pour ouvrir la fenêtre **Create Connection** (créer une connexion).
3. Saisis un nom, puis choisis le fournisseur **Image Generation** (génération d'images).
4. Dans l'éditeur de connexion, choisis un **Service** dans la grille.
5. Colle la clé dans le champ **API Key** si le service en demande une. Les services gratuits et locaux n'en ont pas besoin.
6. Choisis un modèle dans la liste **Model**, ou saisis un identifiant de modèle. Certains services proposent **Fetch Models from API** (récupérer les modèles depuis l'API) pour charger la liste à jour.
7. Clique sur **Save** (Enregistrer).
8. Clique sur **Test Image** (tester une image) pour vérifier que tout marche. Marinara génère une petite image de test.

Si **Test Image** renvoie une image, la connexion est prête. En cas d'échec, vérifie la clé API et la Base URL.

## Choisir un service

Les 17 services se répartissent en trois groupes. Les services cloud demandent une clé API et un compte. Les services gratuits ne demandent aucune clé. Les services locaux font tourner un logiciel d'image sur ton propre ordinateur.

Le tableau ci-dessous présente chaque service d'un coup d'œil. Les détails et les particularités arrivent ensuite, service par service.

| Service | Clé API | Où ça tourne |
| --- | --- | --- |
| OpenAI (DALL-E) | Oui | Cloud |
| Stability AI | Oui | Cloud |
| Together AI | Oui | Cloud |
| NovelAI | Oui | Cloud |
| OpenRouter Images | Oui | Cloud |
| xAI / Grok Imagine | Oui | Cloud |
| Venice.ai | Oui | Cloud |
| Z.AI | Oui | Cloud |
| Atlas Cloud | Oui | Cloud |
| NanoGPT | Oui | Cloud |
| Block Entropy | Oui | Cloud |
| RunPod Serverless (ComfyUI) | Oui | Cloud |
| Pollinations | Non | Cloud gratuit |
| Stable Horde | Facultative | Cloud gratuit |
| SD Web UI (AUTOMATIC1111 / Forge) | Non | Local |
| ComfyUI | Non | Local |
| Draw Things | Non | Local |

## OpenAI (DALL-E)

Service cloud dont la Base URL par défaut est `https://api.openai.com/v1`. Il demande une clé API rattachée à ton compte OpenAI. Il propose les modèles DALL-E et GPT Image. Il accepte jusqu'à 16 images de référence.

## Stability AI

Service cloud dont la Base URL par défaut est `https://api.stability.ai/v2beta`. Il demande une clé API Stability AI. Il propose les modèles Stable Diffusion et Stable Image.

## Together AI

Service cloud dont la Base URL par défaut est `https://api.together.xyz/v1`. Il demande une clé API Together AI. Il propose FLUX et d'autres modèles d'image ouverts.

## NovelAI

Service cloud dont la Base URL par défaut est `https://image.novelai.net`. Il demande une clé API NovelAI. Il se concentre sur le style anime. Avec les modèles V4, V4.5 et V5, Marinara envoie des prompts de personnage natifs avec leurs positions pour les storyboards et les scènes de l'Illustrator qui comportent plusieurs personnages. Certaines nouveautés, comme les images de référence précises, ne fonctionnent que sur un modèle V4.5.

## OpenRouter Images

Service cloud dont la Base URL par défaut est `https://openrouter.ai/api/v1`. Il demande une clé API OpenRouter. Il atteint les modèles d'image via l'interface de chat d'OpenRouter : les modèles réellement disponibles varient donc d'un compte à l'autre.

## xAI / Grok Imagine

Service cloud dont la Base URL par défaut est `https://api.x.ai/v1`. Il demande une clé API xAI. Il s'appuie sur Grok Imagine pour la génération d'images.

## Venice.ai

Service cloud dont la Base URL par défaut est `https://api.venice.ai/api/v1`. Il demande une clé API Venice. Utilise **Fetch Models from API** pour charger les modèles d'image accessibles à ton compte. Marinara passe par le point d'accès image natif de Venice, désactive le floutage optionnel du mode sûr de Venice et convertit automatiquement les dimensions demandées vers le format de taille de chaque modèle : pixels, rapport d'aspect ou palier de résolution. La politique du fournisseur ou les limites du modèle peuvent malgré tout refuser une requête.

## Z.AI

Service cloud dont la Base URL par défaut est `https://api.z.ai/api/paas/v4`. Il demande une clé API Z.AI classique : les clés GLM Coding Plan et le point d'accès `/api/coding/paas/v4` ne conviennent pas pour la génération d'images. Utilise **Fetch Models from API** pour choisir **GLM-Image** ou **CogView 4**. Marinara convertit le rapport d'aspect demandé en une taille prise en charge par le modèle choisi. La requête part ensuite vers le point d'accès image natif de Z.AI, puis Marinara télécharge l'URL de résultat temporaire dans le stockage local. Cette première version fait uniquement du texte vers image et n'envoie pas d'images de référence.

## Atlas Cloud

Service cloud dont la Base URL par défaut est `https://api.atlascloud.ai/api/v1`. Il demande une clé API Atlas Cloud. Marinara fournit un petit catalogue de départ pour Nano Banana, Gemini Flash Image et FLUX 1.1 Pro, et tu peux saisir l'identifiant exact d'un autre modèle d'image Atlas Cloud. Les tâches s'exécutent de façon asynchrone : Marinara lance la génération, puis interroge Atlas Cloud jusqu'à ce que l'image soit prête. Les réglages courants de texte vers image sont convertis automatiquement ; les images de référence partent pour les identifiants de modèle qui annoncent un comportement image vers image, edit ou Kontext. Les schémas des modèles Atlas pouvant différer, consulte la documentation Atlas Cloud du modèle choisi si tu utilises un autre identifiant.

## NanoGPT

Service cloud dont la Base URL par défaut est `https://nano-gpt.com/api/v1`. Il demande une clé API NanoGPT. NanoGPT est un agrégateur : utilise **Fetch Models from API** pour charger sa liste de modèles.

## Block Entropy

Service cloud dont la Base URL par défaut est `https://api.blockentropy.ai`. Il demande une clé API. Marinara n'a pas de gestionnaire dédié pour Block Entropy et envoie donc les requêtes au format compatible OpenAI. Sa compatibilité réelle n'est pas confirmée : teste-le avec **Test Image** avant de compter dessus.

## RunPod Serverless (ComfyUI)

Service cloud dont la Base URL par défaut est `https://api.runpod.ai/v2`. Il exécute un workflow ComfyUI sur un point d'accès serverless RunPod. Il demande trois choses : la clé API RunPod dans le champ **API Key**, un **RunPod Endpoint ID** (identifiant du point d'accès RunPod) et un JSON dans le champ **ComfyUI Workflow** (workflow ComfyUI). Voir la section sur le workflow ComfyUI plus bas.

## Pollinations

Service cloud gratuit dont la Base URL par défaut est `https://image.pollinations.ai`. Il ne demande ni compte ni clé API. C'est le moyen le plus rapide d'essayer la génération d'images.

## Stable Horde

Service cloud gratuit dont la Base URL par défaut est `https://stablehorde.net/api/v2`. C'est un réseau alimenté par la communauté. La clé API est facultative. Une clé gratuite te donne une meilleure priorité dans la file d'attente.

## SD Web UI (AUTOMATIC1111 / Forge)

Service local dont la Base URL par défaut est `http://localhost:7860`. Il dialogue avec un Stable Diffusion Web UI qui tourne sur ton propre ordinateur. Ce logiciel doit être démarré avec son interface applicative activée. Aucune clé API n'est nécessaire.

## ComfyUI

Service local dont la Base URL par défaut est `http://127.0.0.1:8188`. Il dialogue avec un serveur ComfyUI qui tourne sur ton propre ordinateur. Il accepte un workflow personnalisé, décrit plus bas. Aucune clé API n'est nécessaire.

## Draw Things

Service local dont la Base URL par défaut est `http://localhost:7860`. Il dialogue avec l'application Draw Things sur macOS ou iOS. Marinara le traite comme un serveur AUTOMATIC1111. Aucune clé API n'est nécessaire.

## Services locaux sur ton réseau

Le mot `localhost` (aussi appelé loopback) désigne l'ordinateur qui fait tourner Marinara. Les serveurs d'images locaux installés sur ce même ordinateur fonctionnent sans réglage supplémentaire.

Si le serveur d'images tourne sur un autre ordinateur de ton réseau domestique, tu dois autoriser les adresses du réseau local dans la configuration du serveur. La marche à suivre est décrite dans la [référence de configuration du serveur](../CONFIGURATION.md).

Certains fournisseurs renvoient une URL au lieu des données de l'image. Marinara télécharge alors les URL de CDN publiques en appliquant ses contrôles de sécurité habituels sur les requêtes sortantes. Une URL de résultat privée ou en loopback demande une correspondance exacte. Son schéma, son nom d'hôte et son port doivent être ceux du fournisseur d'images configuré. Depuis cette origine privée, les redirections ne peuvent pas basculer vers un autre service local. Un proxy local range parfois les résultats sur une autre origine privée. Dans ce cas, règle-le pour qu'il serve ces fichiers depuis la même origine que son API d'images.

## JSON de workflow ComfyUI et RunPod

Pour **ComfyUI** et **RunPod Serverless (ComfyUI)**, un champ **ComfyUI Workflow** apparaît. Colles-y un JSON de workflow exporté depuis ComfyUI avec **Save (API Format)**, **Export (API)** ou **Export to API**, selon la version de l'interface. Le champ est marqué Optional pour **ComfyUI** et Required pour **RunPod Serverless (ComfyUI)**.

Marinara complète ton workflow à l'aide de marqueurs. Place ces marqueurs textuels dans le workflow, à l'endroit où la valeur doit arriver.

- `%prompt%` et `%negative_prompt%` pour les prompts, c'est-à-dire le texte que Marinara envoie à l'IA.
- `%width%`, `%height%` et `%seed%` pour la taille de l'image et la graine aléatoire.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` et `%denoise%` pour les réglages de génération.
- `%reference_image%` et `%reference_image_01%` à `%reference_image_04%` pour insérer les données des images de référence.
- `%reference_image_name%` et `%reference_image_name_01%` à `%reference_image_name_04%` pour téléverser les images de référence et insérer leurs noms de fichier dans un nœud LoadImage d'un ComfyUI local.

Le marqueur `%prompt%` est le plus important. L'éditeur t'avertit s'il manque. Pour **ComfyUI**, un champ laissé vide déclenche l'usage d'un workflow par défaut intégré. Pour **RunPod Serverless (ComfyUI)**, le workflow est obligatoire, car le point d'accès n'en a aucun par défaut. Les deux acceptent jusqu'à 4 images de référence en base64 brut ; les marqueurs de téléversement par nom de fichier ne sont disponibles que pour un ComfyUI local.

Le processus d'export complet, des exemples de JSON, les règles de guillemets autour des marqueurs, la configuration des images de référence, les workflows propres à un personnage, l'accès en réseau local et le dépannage sont détaillés dans [Configurer un workflow ComfyUI](comfyui.md).

## Local Image Defaults, connexion par connexion

Quand le service est **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI** ou **Draw Things**, un panneau **Local Image Defaults** (valeurs par défaut des images locales) apparaît sur la connexion. Pour **Draw Things**, le panneau affiche les mêmes champs et les mêmes valeurs par défaut que **SD Web UI (AUTOMATIC1111 / Forge)**. Ces réglages ne s'appliquent que lorsque cette connexion génère une image. Le bouton **Reset** (réinitialiser) rétablit les valeurs intégrées.

Ces quatre services affichent tous un champ **Seed** (graine aléatoire). La valeur -1 garde chaque image aléatoire. Tout autre nombre réutilise exactement la même graine à chaque fois.

Les autres champs dépendent du service.

| Service | Champ | Par défaut |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG Scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2Img Denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG Scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt Guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise Schedule | karras |

Chaque service dispose aussi des champs de texte **Prompt Prefix** (préfixe de prompt) et **Negative Prefix** (préfixe négatif). Le texte saisi là est ajouté au début de chaque prompt de cette connexion. AUTOMATIC1111 / Forge et ComfyUI ont tous deux un champ **Clip Skip**. AUTOMATIC1111 / Forge ajoute un interrupteur **Restore faces**. ComfyUI ajoute un interrupteur nommé **Upload a 1x1 placeholder when no reference image is provided**. Il ne compte que pour les workflows personnalisés contenant des marqueurs d'image de référence. NovelAI ajoute les champs **Guidance Rescale** et **UC Preset**.

## La prise en charge des images de référence varie selon le fournisseur

Une **image de référence** est une image existante que tu envoies avec le prompt. Elle aide la nouvelle image à conserver le visage d'un personnage ou un style graphique. Le nombre accepté change d'un fournisseur à l'autre.

| Fournisseur | Images de référence |
| --- | --- |
| OpenAI (DALL-E) | Jusqu'à 16 |
| NovelAI | Jusqu'à 16, modèle V4.5 uniquement |
| xAI / Grok Imagine | Jusqu'à 3 |
| Venice.ai | Non pris en charge pour la génération texte vers image |
| Z.AI | Non pris en charge dans l'intégration texte vers image actuelle |
| Atlas Cloud | Première image, pour les identifiants de modèle image vers image, edit ou Kontext compatibles |
| NanoGPT | Jusqu'à 3 |
| Stability AI | Première image uniquement, utilisée en image vers image |
| OpenRouter Images | Pris en charge, sans limite fixe |
| ComfyUI et RunPod Serverless (ComfyUI) | Jusqu'à 4, via les marqueurs du workflow |
| Together AI, Pollinations, Stable Horde | Non pris en charge |

Les images de référence précises de NovelAI ne fonctionnent que sur un modèle V4.5, comme `nai-diffusion-4-5-full`. NovelAI n'a pas encore publié Precise Reference pour V5. Si tu demandes des références sur un autre modèle, Marinara génère l'image sans elles et inscrit un avertissement dans le journal du serveur.

## Mettre les requêtes de génération d'images en file d'attente

L'interrupteur **Queue image generation requests** (mettre les requêtes de génération d'images en file d'attente) se trouve dans **Settings** (Paramètres), puis **Generations**, puis **Image Generation**. Il est activé par défaut.

Quand il est activé, Marinara envoie les tâches d'image une par une. Garde-le activé pour les services qui refusent deux requêtes simultanées. Désactive-le seulement si le service encaisse beaucoup de requêtes en même temps et que tu veux aller plus vite.

## Guides associés

- [Configurer un workflow ComfyUI](comfyui.md) explique pas à pas le JSON de workflow local et RunPod.
- [Agent Illustrator](illustrator-agent.md) met en place les illustrations de scène automatiques.
- [Profils de style d'image](style-profiles.md) façonne l'allure de chaque image générée.
- [Arrière-plans de scène et galerie](scene-backgrounds.md) traite des arrière-plans de scène générés.
- [Selfies](../conversation/selfies.md) présente la commande de selfie du personnage en mode Conversation.
- [Fournisseurs d'IA pris en charge](../connections/providers-reference.md) liste tous les fournisseurs de chat, d'image et de vidéo.
