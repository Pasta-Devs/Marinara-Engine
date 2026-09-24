# Storyboards LTX 2.3 dans Game Mode

Ce guide explique comment relier un workflow ComfyUI local LTX 2.3 image-vers-vidéo aux storyboards du Game Mode de Marinara Engine. Certains joueurs parlent de Story Mode ; dans Marinara, les contrôles s'appellent **Game Mode** et **Storyboards**.

La configuration ci-dessous a été mise au point avec la génération de première image **Krea 2** et l'Image Style en langage naturel **Z-Image Turbo Narrative**. D'autres connexions d'images devraient convenir aussi, à condition qu'elles acceptent des prompts de scène descriptifs en langage naturel. Le rendu vidéo LTX tourne en local dans ComfyUI ; que la génération de première image soit locale ou hébergée dépend de la connexion d'images choisie.

Voici le chemin complet :

```text
GM narration
  -> Animation Planner
     -> imagePrompt -> image connection -> first-frame illustration
     -> narrationBeat -> Narration Passthrough -> %prompt%
  -> first frame + prompt -> ComfyUI LTX 2.3 workflow -> MP4 clip
```

L'illustration générée devient la première image du clip. LTX reçoit donc à la fois un point de départ visuel et un prompt (le texte que Marinara envoie à l'IA) centré sur ce qui bouge ensuite.

## Avant de commencer

Il te faut :

1. Une installation ComfyUI locale fonctionnelle, accessible depuis Marinara.
2. Le workflow modifiable `ltx-director-simple`, ou un graphe LTX 2.3 image-vers-vidéo équivalent qui s'exécute jusqu'au bout dans ComfyUI.
3. Son export au format API `ltx-director-simple-api`, destiné à la connexion Marinara.
4. Une connexion Marinara de génération d'images pour les illustrations de première image.
5. L'agent **Storyboard**, installé depuis **Agents > Download Agents** et activé pour la partie dans **Chat Settings > Agents**.

Le workflow ComfyUI modifiable et son export API sont deux fichiers différents. Ouvre `ltx-director-simple` dans ComfyUI, installe tous les nœuds personnalisés manquants signalés par ComfyUI Manager, puis teste le graphe sur place. Importe `ltx-director-simple-api` dans la connexion Marinara. Après chaque changement de nœud ou de modèle, réexporte le graphe au format API et remplace le JSON enregistré sur la connexion. Ne colle jamais le workflow de l'éditeur visuel classique dans Marinara.

Voir [Configurer un workflow ComfyUI](../media/comfyui.md) pour la procédure générale d'export et de connexion.

## Choisir un modèle LTX 2.3

Choisis le format de modèle en fonction de l'architecture du GPU et de la mémoire restante une fois que ComfyUI a chargé l'encodeur de texte, les VAE et l'upscaler. Ces indications sont des points de départ, pas la garantie que chaque workflow tiendra sur chaque carte.

| Famille de GPU | Point de départ conseillé | Remarques |
| --- | --- | --- |
| RTX série 30 (Ampere) | INT8 ConvRot | Le point de départ économe en mémoire pour les cartes de classe 3070, 3080 et 3090. |
| RTX série 40 avec 16 à 24 Go | FP8 input-scaled | Utilise le chemin FP8 accéléré disponible sur le matériel de génération Ada. |
| RTX série 40 avec 8 à 12 Go | INT8 ConvRot si le déchargement FP8 est trop lent | Compare les deux sur le workflow réel : la VRAM disponible et le comportement de déchargement pèsent aussi. |
| RTX série 50 (Blackwell) | Workflow NVFP4 dev | Demande une pile ComfyUI, CUDA et nœuds compatible NVFP4. |
| RTX série 50 avec le workflow distilled existant | FP8 input-scaled | Reste sur ce chemin de compatibilité tant qu'aucun checkpoint distilled NVFP4 officiel n'existe. |

Le workflow testé sur RTX 3080 utilise :

```text
ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors
```

Ces suffixes désignent des formats de modèle quantifiés et des chemins d'exécution différents, pas des presets de qualité interchangeables :

- **INT8 ConvRot** est le chemin communautaire économe en mémoire pour les cartes RTX série 30 et les petites cartes Ada.
- **FP8 input-scaled** exploite les opérations matricielles FP8 accélérées, disponibles à peu près à partir des cartes NVIDIA RTX série 40.
- **NVFP4** est le chemin quatre bits natif Blackwell, utilisé par le workflow RTX série 50.
- Les workflows **dev** et **distilled** reposent sur des hypothèses d'échantillonnage différentes. Ne place pas un checkpoint dev dans le graphe distilled fourni sans adapter le workflow en conséquence.

Avec une carte de 8 Go, commence en 480p et avec une seule image-clé pour le premier test d'intégration. Le fait que le checkpoint tienne en mémoire ne garantit pas qu'une vidéo plus longue ou plus définie tiendra aussi : les latents vidéo, l'encodeur de texte, les VAE, l'audio et l'upscaling consomment également de la mémoire.

Le workflow officiel pour débuter s'appuie sur ces composants :

- `ltx-2.3-22b-dev-fp8.safetensors`
- `ltx-2.3-22b-distilled-lora-384.safetensors`
- `gemma_3_12B_it_fp4_mixed.safetensors`
- `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`

Un workflow personnalisé peut utiliser un checkpoint distilled v1.1, une quantification tierce, d'autres nœuds de chargement ou d'autres dossiers de modèles. Les noms de fichiers enregistrés dans le workflow API doivent correspondre exactement aux fichiers visibles par ComfyUI.

Références officielles :

- [Guide LTX 2.3 image-vers-vidéo](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [Guide de prompting LTX](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [Fiche du modèle LTX 2.3](https://huggingface.co/Lightricks/LTX-2.3)
- [Fiche du modèle LTX 2.3 NVFP4](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Exemples ComfyUI LTX 2.3 officiels](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Poids communautaires ComfyUI-separated et FP8](https://huggingface.co/Kijai/LTX2.3_comfy)

## Préparer le workflow API ComfyUI

Commence par lancer le workflow modifiable directement dans ComfyUI, avec une vraie image source et un prompt simple. Vérifie qu'il enregistre bien un MP4 avec l'audio avant d'adapter son export API pour Marinara.

Le chemin Marinara simple repose sur un seul prompt complet, placé dans l'entrée de prompt global du nœud LTX Director :

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Le nœud LTX Director peut toujours gérer le conditionnement par image, les données de guidage, l'audio et les deux étapes d'échantillonnage. "Simple" qualifie le contrat de prompt : Marinara envoie un seul paragraphe image-vers-vidéo cohérent, pas une chronologie Prompt Relay.

### Placeholders obligatoires

Remplace les valeurs correspondantes de l'export API par les placeholders Marinara, entre guillemets :

| Placeholder | Valeur fournie |
| --- | --- |
| `%prompt%` | Le prompt complet produit par l'Animation Planner du storyboard sélectionné et le modèle vidéo |
| `%reference_image_name%` | La première image téléversée vers ComfyUI |
| `%duration_seconds%` | La durée du clip de storyboard, en secondes |
| `%length%` | La durée convertie dans le contrat de 16 images par seconde de Marinara |
| `%fps%` | La fréquence d'images que Marinara utilise pour le clip |
| `%width%`, `%height%` | Les dimensions issues de la résolution et du format d'image de la connexion vidéo |
| `%seed%` | Une nouvelle graine aléatoire pour la requête |
| `%model%` | Valeur de modèle facultative venant de la connexion, quand le workflow ne code pas en dur le modèle de son loader |

L'image de référence se place dans le tableau `segments` du `timeline_data` du nœud LTX Director. Dans le workflow API, `timeline_data` est une chaîne JSON sérialisée. Le placeholder `%length%` garde la durée du clip dynamique via `normalDurationFrames` ; le segment d'image de référence, à l'image zéro, conserve volontairement sa propre valeur courte et fixe `"length":16` :

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

Ne place pas `%reference_image_name%` à côté de `timeline_data` ni dans un champ d'image distinct au premier niveau. Garde le nombre d'images, les secondes et la fréquence d'images reliés aux entrées externes du workflow avec `%length%`, `%duration_seconds%` et `%fps%` ; les valeurs numériques affichées par un graphe ComfyUI modifiable ne sont pas des valeurs par défaut de Marinara.

Garde entre guillemets les placeholders de type chaîne, comme `%reference_image_name%`. Les entrées de nœud strictement numériques peuvent mettre `%length%`, `%duration_seconds%` et `%fps%` entre guillemets, car Marinara les convertit en nombres. À l'intérieur de la chaîne sérialisée `timeline_data`, laisse `%length%` sans guillemets, comme ci-dessus, pour que la valeur décodée de la chronologie soit numérique.

### Réexporter après chaque modification

1. Lance le workflow modifiable dans ComfyUI.
2. Vérifie que le graphe actuel produit un MP4 lisible.
3. Choisis **Save (API Format)**, **Export (API)** ou **Export to API**.
4. Ajoute ou vérifie les placeholders dans le nouveau JSON API.
5. Remplace le workflow enregistré sur la connexion Marinara.

Si tu supprimes un nœud tout en continuant d'utiliser un ancien export API, le fichier peut encore renvoyer à un nœud qui n'existe plus. ComfyUI rejette alors la requête avant même de commencer la génération.

## Créer la connexion vidéo Marinara

1. Ouvre **Settings** (Paramètres), puis **Connections** (Connexions).
2. Ajoute une connexion **Video Generation** (génération de vidéos).
3. Choisis **ComfyUI**.
4. Saisis l'URL de base de ComfyUI, en général `http://127.0.0.1:8188` quand il tourne sur le même ordinateur.
5. Colle le workflow complet au format API dans le champ **ComfyUI Workflow**.
6. Choisis une durée par défaut de six secondes, le format **16:9** et 480p pour le premier test en VRAM limitée.
7. Enregistre la connexion.

Un test de connexion en texte seul ne peut pas mettre `%reference_image_name%` à l'épreuve. Une fois la connexion enregistrée, valide l'image-vers-vidéo depuis une image de la galerie ou depuis un storyboard.

## Configurer le chat en Game Mode

Ouvre le chat en Game Mode, puis ouvre **Chat Settings** (réglages du chat) et sélectionne l'onglet **Agents**. Active **Enable Agents** et **Enable Storyboards** avant de configurer les sections ci-dessous. Dans l'assistant de création de partie, la présentation Storyboard Optimized n'active pas l'agent.

### Illustrator

| Réglage | Valeur conseillée |
| --- | --- |
| **Game Illustrator** | On |
| **Image Connection** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off pour ce workflow testé |

L'Animation Planner reçoit déjà le contexte d'apparence des personnages du tour de storyboard. Cette configuration laisse donc **Attach Card Appearance** sur Off, pour éviter d'ajouter une seconde fois la même information au moment de la mise en forme finale de l'image. De même, **Storyboard First Frame** évite de répéter la direction artistique de la campagne autour de la scène T=0 déjà terminée par le planificateur.

**Send Avatar References** règle les images de référence envoyées au fournisseur d'images de première image ; ce réglage ne pilote pas l'image d'entrée de LTX. LTX reçoit l'illustration de storyboard finie via `%reference_image_name%`. Laisse les références d'avatar désactivées pour cette configuration Krea testée, puis active-les à part seulement après avoir vérifié que la connexion d'images choisie les prend en charge et en tire un vrai bénéfice.

La première image pèse énormément sur la qualité de l'animation. Elle doit montrer l'instant exact qui précède le mouvement prévu, avec le sujet, le trajet, les mains, la porte, l'accessoire ou la cible bien visibles.

### Scene Videos

| Réglage | Valeur conseillée |
| --- | --- |
| **Video Connection** | La connexion ComfyUI LTX 2.3 créée plus haut |
| **Game Video Prompt** | **Narration Passthrough** |

Le réglage général **Game Video Prompt** pilote les animations manuelles de la galerie et des Game Assets. Les clips de storyboard peuvent choisir leur propre prompt sans modifier ces autres actions d'animation.

### Storyboards

Pars de ce profil :

| Réglage | Valeur de départ conseillée |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 3 en temps normal ; commence à 1 pour le premier test en 8 Go de VRAM |
| **Animation Clip Duration** | 5 secondes |
| **Viewer Display** | Floating pendant les tests |
| **Illustration Planner** | **Still Keyframes** ; conservé comme solution de repli pour les images fixes seules |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

**LTX Simple Image-to-Video** est la valeur par défaut recommandée. Il prépare une première image prête à animer et un prompt de mouvement direct de 4 à 8 phrases. Il privilégie une action principale, un seul comportement de caméra, un mouvement d'environnement retenu, plus un son ou un court dialogue quand c'est pertinent.

**LTX Director Storyboard** reste disponible comme option avancée. Il fournit des indications plus détaillées, tenant compte de la durée, ainsi que des règles de continuité. Essaie-le une fois le chemin simple stabilisé, ou quand un clip plus long a vraiment besoin de plusieurs phases enchaînées. Les deux planificateurs utilisent le même contrat de workflow `%prompt%`.

**Illustration Planner : Still Keyframes** ne crée pas le prompt destiné à Krea tant que les animations sont activées. En mode animation, **LTX Simple Image-to-Video** produit les deux sorties : un `imagePrompt` en langage naturel pour Krea et un `narrationBeat` pour LTX. Still Keyframes ne sert donc plus qu'aux tours générés sans vidéo.

**Storyboard First Frame** transmet à Krea la scène T=0 complète, en langage naturel, telle que l'Animation Planner l'a écrite, sans y ajouter de titre d'image-clé, d'étiquettes de prompt, de rappels d'apparence ni de direction artistique de campagne. Garde **Use Storyboard Template** sur On pour que ce formateur s'applique réellement.

**Narration Passthrough** est volontairement minimal. Il fait passer le `narrationBeat` terminé de l'Animation Planner dans le contrat universel de prompt vidéo, sans l'entourer d'un nouveau récapitulatif de scène.

Chaque image-clé lance une tâche d'image Krea et une tâche vidéo LTX locale. Trois images-clés déclenchent donc trois rendus de première image et trois rendus vidéo. Sur un GPU de 8 Go de VRAM, commence avec une seule image-clé en 480p. Une fois que ça passe, monte vers trois images-clés et des résolutions plus élevées.

## Lancer le premier test

Pars d'un tour de GM terminé qui contient une action visuelle évidente : ouvrir une porte, tourner la tête vers un bruit, faire quelques pas ou prononcer une courte réplique.

1. Pour la vérification la plus rapide en VRAM limitée, règle temporairement **Keyframes per Turn** sur 1, en laissant **Animation Clip Duration** à 5 secondes. Le profil testé habituel utilise 3 images-clés.
2. Active les deux réglages automatiques de storyboard une fois le tour de GM en cours déjà terminé.
3. Ouvre la galerie et choisis **Create storyboard** pour ce tour de GM terminé. Cela démarre manuellement tout le chemin illustration + animation, sans attendre un nouveau tour.
4. Si l'affichage des prompts est activé, relis le prompt de première image avant de l'envoyer.
5. Vérifie que la première image générée offre une pose de départ réellement exploitable.
6. Attends la fin du rendu de la première image, puis celle du clip ComfyUI.
7. Une fois le chemin manuel validé, remets **Keyframes per Turn** sur 3 et laisse les deux réglages automatiques activés pour les tours suivants.

Pendant la configuration, utilise le mode d'affichage **Floating** : il rend l'inspection de chaque image et de chaque clip plus facile. Passe ensuite sur **Background** une fois le workflow fiable, si tu veux intégrer les médias du storyboard à la scène du Game Mode.

## Le passage de relais entre les prompts

Pour chaque image-clé, l'Animation Planner renvoie :

- `imagePrompt` : uniquement la première image visible au temps T=0 ;
- `narrationBeat` : le prompt LTX image-vers-vidéo complet, qui décrit la suite.

L'Animation Planner sélectionné écrit les deux champs. **Storyboard First Frame** met en forme `imagePrompt` et envoie cette scène T=0 en langage naturel à Krea 2. Une fois l'image obtenue, **Narration Passthrough** se résout en `narrationBeat`. Marinara le place dans le champ `prompt` de la requête vidéo habituelle, remplace `%prompt%` dans le workflow ComfyUI, téléverse la première image et remplace `%reference_image_name%` par son nom de fichier côté ComfyUI.

Rien n'oblige à créer deux segments de prompt locaux. Un seul prompt global est le fonctionnement normal de ces presets de storyboard.

## Ce qui fait un bon prompt LTX

L'image source décrit déjà l'apparence des personnages, la composition, le décor, la lumière, la palette et les textures. Le prompt vidéo doit se concentrer sur le mouvement :

- un seul paragraphe fluide, au présent ;
- une action précise, adaptée à la durée du clip ;
- un mouvement de caméra décrit par rapport au sujet ;
- des réactions visibles par le regard, le visage, la posture, la respiration ou le geste ;
- au maximum un mouvement d'environnement utile ;
- son d'ambiance, effets, musique ou courte réplique entre guillemets quand c'est pertinent ;
- une fin naturelle, un mouvement qui se pose ou une brève tenue à la fin.

Évite les changements de scène, les coupes, les téléportations, les actions multiples sans lien entre elles, la physique complexe, les chorégraphies chargées, le texte lisible précis et les inventaires répétés de détails déjà visibles sur la première image.

Exemple :

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Documenter une configuration reproductible

Un résultat "en 8 Go" dépend de bien plus que du checkpoint. Quand tu partages le workflow, note :

- le modèle exact de GPU et sa VRAM ;
- la version ou le commit de ComfyUI ;
- les versions du pilote NVIDIA, de CUDA, de PyTorch et de Python ;
- les paquets de nœuds personnalisés requis et leurs versions ;
- les noms de fichiers de modèles exacts et leurs dossiers ComfyUI ;
- la résolution de sortie, la durée, le nombre d'images-clés et le temps de rendu approximatif ;
- si Krea 2 tourne en local ou via une connexion d'images hébergée dans cette configuration.

Le JSON API joint enregistre un instantané des identifiants de nœuds, des chemins de modèles et des noms d'entrées. Si tu ranges les modèles dans un autre dossier, `LTX2/` par exemple, mets à jour les valeurs du loader et exporte une nouvelle copie API. Un workflow qui tourne sur l'installation ComfyUI de son auteur peut très bien échouer ailleurs, dès qu'un nœud personnalisé ou un chemin de modèle diffère.

## Résolution des problèmes

### ComfyUI renvoie une erreur HTTP 400 ou "Prompt outputs failed validation"

Le workflow API ne correspond pas au graphe actuellement installé. Cherche un nœud supprimé, un identifiant de nœud orphelin, un nœud personnalisé manquant, une entrée renommée par une mise à jour de nœud ou un nom de fichier de modèle qui n'existe plus. Exporte un nouveau workflow API depuis le graphe ComfyUI qui fonctionne.

### Les images sont créées, mais pas les vidéos

Vérifie le réglage **Automatic Storyboard Animations** et la **Video Connection** du Game Mode. Les animations exigent à la fois l'illustration de première image et une connexion vidéo sélectionnée.

### LTX ne reçoit aucune image de départ

Vérifie que `%reference_image_name%` figure bien dans le workflow API enregistré et qu'il alimente le segment d'image du nœud LTX Director. Marinara ne téléverse la première image que si ce placeholder est présent.

### Le clip se déforme, change de personnage ou part dans tous les sens

Reviens à **LTX Simple Image-to-Video**, utilise une seule image-clé et teste un tour avec une seule action. Une image source ne peut pas se transformer proprement en plusieurs lieux, poses et dénouements pendant un court clip continu. Vérifie aussi la première image : une pose de départ confuse rend l'animation plus difficile, même avec un bon prompt de mouvement.

### Toutes les générations se ressemblent trop

Remplace toute graine d'échantillonnage codée en dur par `%seed%`. Une fois un résultat intéressant obtenu, ne fixe temporairement cette graine dans le workflow que pour comparer des changements de prompt ou d'échantillonnage.

### La génération manque de mémoire

Commence en 480p. Réduis ensuite la durée si nécessaire. Garde une seule image-clé par tour pendant les tests, ferme les autres applications qui utilisent le GPU et évite de laisser un modèle de langage local chargé sur le même GPU à faible VRAM. Un checkpoint quantifié réduit la mémoire du modèle, mais ne supprime pas celle qu'occupent les latents vidéo, l'encodeur de texte, les VAE, l'audio et l'upscaling.

### Marinara arrête d'attendre alors que ComfyUI continue son rendu

Si la requête du navigateur se ferme ou si la connexion du client se perd, l'interrogation par Marinara peut s'arrêter sans annuler une tâche déjà mise en file d'attente dans ComfyUI. Regarde la file, l'historique et le dossier de sortie de ComfyUI avant de relancer le même rendu.

### Le workflow marche dans ComfyUI, mais échoue depuis Marinara

Compare le JSON enregistré sur la connexion avec le dernier export API. Vérifie l'URL de base, l'orthographe des placeholders, les nœuds personnalisés requis, les chemins de modèles, le nœud de sortie, les dimensions et les champs de durée. Le graphe modifiable peut fonctionner alors que Marinara conserve encore un instantané exporté plus ancien.

Pour des traces serveur détaillées, active les logs de débogage (le journal du serveur) et cherche `[debug/game/storyboard-video]` et `[video-gen/comfyui]`. Une requête saine affiche le prompt global complet, le nom de fichier de l'image de référence téléversée, la durée, le nombre d'images et l'identifiant du prompt mis en file d'attente dans ComfyUI.

## Guides associés

- [Guide de l'agent Storyboard](storyboard.md)
- [Configurer un workflow ComfyUI](../media/comfyui.md)
- [Génération de vidéos de scène](../media/scene-video.md)
- [Game Mode : premiers pas](getting-started.md)
