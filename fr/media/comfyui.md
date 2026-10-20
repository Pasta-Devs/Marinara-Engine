# Configurer un workflow ComfyUI

Marinara Engine sait envoyer des demandes de génération d'images et de vidéos à un serveur ComfyUI local, et des demandes d'images à un endpoint RunPod Serverless qui fait tourner ComfyUI. Une connexion d'image locale peut se contenter du workflow de base intégré à Marinara, alors que les connexions vidéo et les montages d'images avancés réclament un workflow personnalisé au format API.

Le JSON du workflow collé dans Marinara n'est qu'un instantané. Marinara ne garde aucun lien direct avec le workflow ouvert dans ComfyUI. À chaque fois que tu modifies le workflow dans ComfyUI, teste-le de nouveau, exporte-le de nouveau, puis remplace le JSON enregistré sur la connexion Marinara.

## Avant de commencer

Installe ComfyUI, ajoute les checkpoints et les nodes personnalisés dont le workflow a besoin, puis démarre son serveur. L'adresse locale habituelle est `http://127.0.0.1:8188`.

Si ComfyUI tourne sur un autre ordinateur du réseau domestique, son serveur doit écouter sur une adresse joignable par Marinara. Les connexions d'image exigent en plus `IMAGE_LOCAL_URLS_ENABLED=true` dans le fichier `.env` de Marinara ; voir la [référence de configuration du serveur](../CONFIGURATION.md). Si la connexion échoue toujours, vérifie le pare-feu de l'autre ordinateur.

Un modèle de langage local et un modèle d'image ne tiennent pas forcément en même temps dans la mémoire du GPU, surtout sur une carte de 8 Go. La file d'attente d'images de Marinara empêche plusieurs travaux d'images de s'exécuter ensemble, mais elle ne peut pas faire entrer deux modèles chargés dans la même VRAM. En cas de mémoire insuffisante, prends un modèle de langage dans le cloud ou hébergé à part, fais tourner ComfyUI sur un autre appareil, ou décharge un modèle avant d'utiliser l'autre.

## Créer la connexion Marinara

1. Ouvre la section **Connections** (Connexions) et crée une connexion **Image Generation** (génération d'images).
2. Choisis **ComfyUI** pour un serveur local, ou **RunPod Serverless (ComfyUI)** pour un endpoint RunPod.
3. Pour ComfyUI en local, saisis son URL de base. Aucune clé API n'est nécessaire. Si le champ **ComfyUI Workflow** (workflow ComfyUI) est vide, Marinara utilise un workflow texte-vers-image de base intégré.
4. Pour RunPod, saisis la clé API et l'Endpoint ID. Un workflow personnalisé est obligatoire.
5. Règle la section **Local Image Defaults** (valeurs d'image locales par défaut). Ces valeurs remplacent les placeholders correspondants dans le workflow.
6. Enregistre la connexion, puis utilise le bouton **Test Image** (tester l'image) une fois le workflow ajouté.

## Construire et exporter un workflow

1. Crée dans ComfyUI un workflow distinct, dédié à Marinara.
2. Configure et relie comme d'habitude le checkpoint, les LoRA, le VAE, les encodeurs de prompt, les nodes d'image latente ou d'image d'entrée, le sampler et les nodes de sortie.
3. Mets le workflow en file dans ComfyUI et vérifie qu'il produit bien l'image attendue.
4. Prévois un node de sortie. **SaveImage** est le choix le plus sûr, car Marinara lit les images ou les animations terminées dans l'historique des workflows de ComfyUI.
5. Enregistre le workflow modifiable sous un nom reconnaissable, par exemple `Marinara_Workflow`.
6. Exporte le workflow au format API. Selon la version du frontend ComfyUI, l'action s'appelle **Save (API Format)**, **Export (API)** ou **Export to API**. Si elle est masquée, active les options développeur ou le dev-mode de ComfyUI.
7. Ouvre le fichier `.json` exporté dans un éditeur de texte.

Un workflow au format API n'a rien à voir avec le workflow normal de l'éditeur visuel. Ses clés de premier niveau sont des identifiants de nodes, et chaque node contient normalement `class_type` et `inputs`. Exporte bien la version API : ne colle pas le fichier de workflow classique, qui contient la mise en page visuelle de l'éditeur.

<a id="comfyui-video-workflows"></a>

## Workflows vidéo ComfyUI

Crée une connexion **Video Generation** (génération de vidéos), choisis **ComfyUI**, puis colle un workflow au format API dans le champ obligatoire **ComfyUI Workflow**. WAN 2.2 et les autres graphes vidéo locaux fonctionnent, à condition que le même workflow s'exécute dans ComfyUI et enregistre un MP4 via une sortie comme le node **SaveVideo** du cœur de ComfyUI.

Les workflows vidéo acceptent ces placeholders entre guillemets :

| Placeholder | Valeur fournie par Marinara |
| --- | --- |
| `%prompt%` | Le prompt de scène ou d'animation compilé. |
| `%width%`, `%height%` | `832×480` en 480p ou `1280×720` en 720p, inversés en 9:16. |
| `%seed%` | Une nouvelle graine aléatoire sur 32 bits. |
| `%length%` | La durée du clip, en nombre d'images à 16 fps. |
| `%model%` | La valeur Model de la connexion, si elle est renseignée. |
| `%reference_image_name%` | Le nom du fichier de première image téléversé, pour un node **LoadImage** de ComfyUI. |

Marinara met le workflow en file via `/prompt`, interroge `/history`, puis télécharge le MP4 indiqué dans une sortie `gifs` ou `images`. Les actions image-vers-vidéo fournissent `%reference_image_name%` ; les tests de connexion en texte seul, non. Garde donc cette entrée facultative si le même workflow doit gérer les deux cas.

Un rendu WAN local peut dépasser 30 minutes sur un GPU de milieu de gamme. Les travaux vidéo ComfyUI suivent `VIDEO_GEN_TIMEOUT_MS`, et non `COMFYUI_GEN_TIMEOUT` qui ne concerne que les images. Si un workflow valide est interrompu trop tôt, augmente le délai d'expiration vidéo et redémarre Marinara.

## Ajouter les placeholders de Marinara

Remplace par les placeholders ci-dessous les valeurs que Marinara doit piloter.

Pour une connexion **ComfyUI local**, garde chaque placeholder entre les guillemets du JSON. Marinara analyse d'abord le workflow, puis convertit en nombre réel un placeholder purement numérique comme `"%width%"`. Le workflow reste ainsi valide pour les nodes qui exigent une valeur numérique.

Pour une connexion **RunPod Serverless (ComfyUI)**, garde entre guillemets les placeholders de texte comme `"%prompt%"`, `"%model%"` et `"%sampler%"`, mais laisse sans guillemets les placeholders numériques comme `%width%`, `%height%`, `%seed%`, `%steps%`, `%cfg%`, `%denoise%` et `%clip_skip%`. Chez RunPod, la substitution a lieu avant que Marinara n'analyse le workflow : le nombre inséré rend donc valide le JSON envoyé. L'éditeur de connexion peut signaler temporairement ce modèle comme du JSON invalide, puisque le token sans guillemets n'est remplacé qu'au moment de la génération. Cet avertissement n'empêche pas l'enregistrement.

Les parties utiles d'un workflow API **local** de base ressemblent à ceci :

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": "%seed%",
      "steps": "%steps%",
      "cfg": "%cfg%",
      "sampler_name": "%sampler%",
      "scheduler": "%scheduler%",
      "denoise": "%denoise%"
    }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": "%width%",
      "height": "%height%",
      "batch_size": 1
    }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "portrait, %prompt%, masterpiece"
    }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "watermark, %negative_prompt%"
    }
  }
}
```

Ce n'est qu'un extrait : conserve les liens entre nodes et les autres entrées du workflow exporté. Un placeholder de prompt peut s'insérer dans une chaîne plus longue, pour ajouter des tags fixes avant ou après. Un placeholder numérique, lui, doit normalement occuper toute la valeur. Dans la copie RunPod du workflow, enlève les guillemets autour de ces tokens numériques. Autre option : laisser un réglage codé en dur quand tu ne veux pas que les valeurs par défaut de la connexion Marinara le modifient.

| Placeholder | Valeur fournie par Marinara |
| --- | --- |
| `%prompt%` | Le prompt d'image positif. L'éditeur de connexion prévient s'il manque. |
| `%negative_prompt%` | Le prompt d'image négatif. |
| `%width%`, `%height%` | Les dimensions d'image demandées. |
| `%seed%` | La graine issue de la connexion ; `-1` produit une nouvelle graine aléatoire. |
| `%model%` | Le modèle enregistré sur la connexion. Utilise la valeur de checkpoint exacte qu'attend le node de chargement. |
| `%steps%` | Le nombre d'étapes d'échantillonnage. |
| `%cfg%` | L'échelle CFG. `%cfg_scale%` et `%scale%` sont aussi acceptés. |
| `%sampler%` | Le nom du sampler. |
| `%scheduler%` | Le nom du scheduler. |
| `%denoise%` | La force de débruitage. `%denoising_strength%` est aussi accepté. |
| `%clip_skip%` | La valeur Clip Skip pour un node compatible. |

Une fois les modifications faites, enregistre le JSON, copie tout le fichier, colle-le dans le champ **ComfyUI Workflow** de la connexion d'image, enregistre la connexion et clique sur **Test Image**.

## Utiliser des images de référence

Marinara peut fournir jusqu'à quatre images de référence, quand la fonctionnalité qui lance la génération dispose d'images à envoyer. Le workflow personnalisé doit contenir les nodes d'entrée et les placeholders compatibles : ajouter un placeholder ne crée ni ne relie ces nodes automatiquement.

### ComfyUI local : noms de fichiers téléversés pour LoadImage

Pour un node **LoadImage** standard de ComfyUI, utilise un placeholder de nom de fichier :

```json
{
  "12": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "%reference_image_name%",
      "upload": "image"
    }
  }
}
```

Marinara téléverse la référence dans le dossier d'entrée de ComfyUI, puis remplace le placeholder par le nom de fichier renvoyé par ComfyUI. `%reference_image_name%` désigne la première image. Un workflow comptant plusieurs entrées de référence peut utiliser `%reference_image_name_01%` jusqu'à `%reference_image_name_04%`.

Si le workflow exige toujours une image en entrée, active l'option **Upload a 1x1 placeholder when no reference image is provided** dans **Local Image Defaults**. Marinara fournit alors une minuscule image de remplacement quand la demande n'a aucune référence réelle.

### Données d'image brutes en base64

Utilise `%reference_image%` pour la première image brute en base64, ou `%reference_image_01%` jusqu'à `%reference_image_04%` pour des entrées numérotées. Ces valeurs contiennent des données base64 sans préfixe `data:image/...` et ne fonctionnent qu'avec les nodes personnalisés qui acceptent ce format tel quel.

Les workflows RunPod acceptent les placeholders base64 bruts. Les placeholders de nom de fichier téléversé, eux, sont réservés à ComfyUI en local et ne passent pas par le gestionnaire RunPod.

## Garder des workflows propres à chaque personnage

Rien n'empêche de créer un workflow exporté et une connexion d'image Marinara distincts pour chaque personnage qui réclame un checkpoint particulier, une pile de LoRA, un montage ControlNet ou une disposition d'images de référence spécifique. Sélectionne ensuite la bonne connexion d'image partout où ce personnage ou cette fonctionnalité d'image te laisse le choix.

Le résultat est souvent plus cohérent qu'avec un workflow générique unique, mais chaque connexion conserve sa propre copie du JSON. Après avoir modifié le workflow d'un personnage dans ComfyUI, refais pour cette connexion les étapes d'export, de modification, de copie et de collage.

## Dépannage

| Problème | À vérifier |
| --- | --- |
| Marinara signale un JSON de workflow invalide | Pour ComfyUI en local, contrôle les guillemets, les virgules et les crochets après l'ajout des placeholders. Pour RunPod, seuls les placeholders numériques doivent être sans guillemets ; tous les placeholders de texte et le reste du modèle exigent toujours une syntaxe JSON correcte. |
| Le prompt ou le placeholder arrive tel quel dans un node | Vérifie que le token est écrit exactement comme indiqué et que le workflow collé est bien la version API fraîchement exportée. |
| L'image ignore les dimensions demandées | Place `%width%` et `%height%` dans le node d'image latente, ou le node de taille équivalent, qui alimente réellement le sampler. |
| ComfyUI ne trouve pas le modèle | Utilise le nom de checkpoint exact qu'attend le node de chargement, ou garde le checkpoint codé en dur dans le workflow au lieu de `%model%`. |
| ComfyUI signale un node ou une entrée manquante | Installe les mêmes paquets de nodes personnalisés que ceux utilisés à la construction du workflow, et vérifie que leurs noms d'entrée n'ont pas changé. |
| Le travail se termine, mais Marinara ne reçoit aucune image | Ajoute une sortie **SaveImage** correctement reliée, puis teste de nouveau le workflow directement dans ComfyUI. |
| Un node d'image de référence échoue | Pour un node **LoadImage** local normal, utilise un placeholder `%reference_image_name...%`. Ne recours au base64 brut qu'avec un node prévu pour, et vérifie que la fonctionnalité Marinara a bien fourni une référence. |
| Une URL ComfyUI distante ou en réseau local est bloquée | Pour les connexions d'image, active `IMAGE_LOCAL_URLS_ENABLED`. Fais écouter ComfyUI sur l'interface réseau et vérifie le pare-feu de la machine hôte. N'expose jamais un serveur ComfyUI sans authentification sur l'internet public. |
| Erreur : `Outbound response exceeded N bytes` | La réponse a dépassé la limite configurée, de 30 Mio par défaut. Les métadonnées de workflow ou d'images de référence intégrées au fichier peuvent en être la cause. Désactive les métadonnées dans ComfyUI, ou augmente `IMAGE_GEN_MAX_RESPONSE_BYTES` dans le fichier `.env` de Marinara et redémarre Marinara. |
| Une longue génération d'images dépasse le délai | Augmente `COMFYUI_GEN_TIMEOUT` dans le fichier `.env` de Marinara. La valeur s'exprime en secondes et vaut `2400` par défaut. |
| Une longue génération de vidéos dépasse le délai | Augmente `VIDEO_GEN_TIMEOUT_MS` dans le fichier `.env` de Marinara. La valeur s'exprime en millisecondes et vaut `1800000` (30 minutes) par défaut. |
| La génération épuise la mémoire du GPU | Réduis les dimensions de l'image ou la taille du modèle, décharge le modèle de langage local, prends un modèle de langage distant, ou déplace ComfyUI sur un autre appareil. |

## Guides associés

- [Fournisseurs de génération d'images et configuration](image-providers.md) présente tous les services d'images pris en charge et les réglages d'image communs.
- [Génération de vidéos de scène](scene-video.md) présente les connexions vidéo et tous les endroits où la vidéo de scène apparaît.
- [Storyboards LTX 2.3 dans Game Mode](../game/ltx-2-3-storyboards.md) présente un workflow LTX Director API, ses placeholders et les réglages Game recommandés.
- [Profils de style d'image](style-profiles.md) explique les styles de prompt réutilisables de Marinara.
- [Agent Illustrator](illustrator-agent.md) présente l'illustration automatique des scènes.
- [Référence de configuration du serveur](../CONFIGURATION.md) documente l'accès depuis le réseau local et les délais d'expiration ComfyUI.
- [Les concepts de workflow ComfyUI](https://docs.comfy.org/development/core-concepts/workflow) expliquent les workflows dans la documentation officielle de ComfyUI.
