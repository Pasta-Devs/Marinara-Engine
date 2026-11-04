# Storyboards LTX 2.3 dans Game Mode

Ce guide relie un workflow ComfyUI local LTX 2.3 image-vers-vidéo aux storyboards de Game Mode, pour que chaque image du storyboard devienne un court clip vidéo. C'est une configuration avancée, pour les joueurs qui ont un GPU local et ComfyUI. Certains joueurs parlent de Story Mode. Dans Marinara, les contrôles s'appellent **Game Mode** et **Storyboards**.

Cette configuration a été mise au point avec des premières images **Krea 2** et l'Image Style **Z-Image Turbo Narrative**. D'autres comptes d'images devraient convenir s'ils acceptent des prompts de scène descriptifs en langage naturel (le prompt, c'est le texte que Marinara envoie à l'IA). La vidéo LTX est rendue en local dans ComfyUI. Que la première image soit générée en local ou par un service hébergé dépend du compte d'images que tu choisis.

Le chemin complet compte ces étapes :

1. Le GM (le maître du jeu) écrit un tour de narration.
2. L'Animation Planner renvoie un `imagePrompt` et un `narrationBeat`.
3. Le `imagePrompt` part vers le compte d'images et devient l'illustration de première image.
4. Le `narrationBeat` passe par **Narration Passthrough** et devient `%prompt%`.
5. La première image et le prompt partent vers le workflow ComfyUI LTX 2.3, qui produit un clip MP4.

L'illustration est la première image du clip. LTX reçoit à la fois une image de départ et un prompt sur ce qui bouge ensuite. Si tout fonctionne, un clip apparaît dans l'onglet **Videos** (vidéos) de la galerie.

## Avant de commencer

Il te faut :

1. Une installation ComfyUI locale fonctionnelle, que Marinara peut joindre. Voir [Configurer un workflow ComfyUI](../media/comfyui.md).
2. Un GPU avec assez de VRAM (la mémoire de ta carte graphique). Une carte de 8 Go peut suffire pour un premier test en 480p avec une seule image-clé.
3. Le workflow modifiable `ltx-director-simple`, ou un graphe LTX 2.3 image-vers-vidéo équivalent qui s'exécute jusqu'au bout dans ComfyUI, ainsi que son export au format API `ltx-director-simple-api`.
4. Un compte d'images dans Marinara pour les illustrations de première image.
5. L'agent **Storyboard**, téléchargé depuis **Agents → Agent Organizer** et activé pour la partie dans **Chat Settings → Agents** (réglages du chat → Agents). Voir [Guide de l'agent Storyboard](storyboard.md).

Le workflow modifiable et son export API sont deux fichiers différents. Ouvre `ltx-director-simple` dans ComfyUI, installe tous les nœuds personnalisés que ComfyUI Manager signale comme manquants, et teste le graphe sur place. Importe `ltx-director-simple-api` dans Marinara. Après chaque changement de nœud ou de modèle, réexporte le graphe au format API et remplace le JSON enregistré sur le compte dans Marinara. Ne colle pas le workflow classique de l'éditeur visuel dans Marinara.

## Préparer le workflow API ComfyUI

Commence par mettre en file d'attente le workflow modifiable dans ComfyUI, avec une vraie image source et un prompt simple. Vérifie qu'il enregistre un MP4 avec l'audio.

Le chemin Marinara simple place un seul prompt complet dans l'entrée de prompt global du nœud LTX Director :

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Le nœud LTX Director peut toujours gérer le conditionnement par image, les données de guidage, l'audio et les deux étapes d'échantillonnage. "Simple" signifie que Marinara envoie un seul paragraphe image-vers-vidéo cohérent, au lieu d'une chronologie Prompt Relay.

### Placeholders

Dans l'export API, remplace les valeurs correspondantes par ces placeholders Marinara, entre guillemets :

| Placeholder | Valeur fournie par Marinara |
| --- | --- |
| `%prompt%` | Le prompt complet issu de l'Animation Planner et du gabarit vidéo |
| `%reference_image_name%` | La première image téléversée vers ComfyUI |
| `%duration_seconds%` | La durée du clip, en secondes |
| `%length%` | La durée exprimée en nombre d'images, à la cadence par défaut de Marinara de 16 FPS |
| `%fps%` | La fréquence d'images utilisée par Marinara |
| `%width%`, `%height%` | Les dimensions issues de la résolution et du format d'image du compte vidéo |
| `%seed%` | Une nouvelle graine aléatoire pour chaque requête |
| `%model%` | Valeur de modèle facultative venant du compte, quand le workflow ne fixe pas le modèle de son loader |

Marinara peut aussi remplir `%length_s%`, `%global_prompt%`, `%local_prompts%` et `%segment_lengths%`. Ces quatre-là sont facultatifs. Le chemin simple n'en a pas besoin et envoie son prompt via `%prompt%`.

L'image de référence se place dans le tableau `segments` du `timeline_data` du nœud LTX Director, qui est une chaîne JSON sérialisée dans le workflow API. `%length%` garde la durée du clip dynamique via `normalDurationFrames`. Le segment d'image de référence, à l'image zéro, garde sa propre valeur fixe `"length":16`.

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

- Ne place pas `%reference_image_name%` à côté de `timeline_data` ni dans un champ d'image distinct au premier niveau.
- Garde entre guillemets les placeholders de type chaîne, comme `%reference_image_name%`.
- Les entrées numériques des nœuds peuvent mettre `%length%`, `%duration_seconds%` et `%fps%` entre guillemets, car Marinara les convertit en nombres. À l'intérieur de la chaîne sérialisée `timeline_data`, laisse `%length%` sans guillemets, comme ci-dessus, pour que la valeur décodée soit un nombre.
- Garde le nombre d'images, les secondes et la fréquence d'images reliés à ces placeholders. Les nombres qu'affiche un graphe ComfyUI modifiable ne sont pas des valeurs par défaut de Marinara.

### Réexporter après chaque modification

1. Mets en file d'attente le workflow modifiable dans ComfyUI et vérifie qu'il produit un MP4 lisible.
2. Sélectionne **Save (API Format)**, **Export (API)** ou **Export to API**, selon ta version de ComfyUI.
3. Ajoute ou vérifie les placeholders dans le nouveau JSON API.
4. Remplace le workflow enregistré sur le compte dans Marinara.

Si tu supprimes un nœud tout en continuant d'utiliser un ancien export, il reste des références à un nœud qui n'existe plus. ComfyUI rejette alors la requête.

## Créer le compte vidéo

1. Ouvre **Settings → Connections** (Paramètres → Connexions).
2. Clique sur **Add account** (ajouter un compte) et choisis un compte **Video Generation** (génération de vidéos).
3. Choisis **ComfyUI**.
4. Renseigne le champ **Base URL** (URL de base), en général `http://127.0.0.1:8188` quand ComfyUI tourne sur le même ordinateur.
5. Colle le workflow complet au format API dans le champ **ComfyUI workflow** (workflow ComfyUI).
6. Pour le premier test en VRAM limitée, choisis une durée par défaut de six secondes, le format **16:9** et 480p.
7. Enregistre le compte.

Un test de connexion en texte seul ne peut pas mettre `%reference_image_name%` à l'épreuve. Après l'enregistrement, teste l'image-vers-vidéo depuis une image de la galerie ou depuis un storyboard.

## Configurer le chat en Game Mode

Ouvre le chat en Game Mode, puis **Chat Settings → Agents**. Active d'abord **Enable Agents** (activer les agents) et **Enable Storyboards** (activer les storyboards). Dans l'assistant, la présentation Storyboard Optimized n'active pas l'agent.

### Illustrator

| Réglage | Valeur conseillée |
| --- | --- |
| **Game Illustrator** | On |
| **Image model** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off pour ce workflow testé |

L'Animation Planner reçoit déjà le contexte d'apparence des personnages du tour : **Attach Card Appearance** reste donc sur Off, pour éviter de l'ajouter deux fois. **Storyboard First Frame** évite aussi de répéter la direction artistique de la campagne autour de la scène de première image déjà terminée par le planificateur.

**Send Avatar References** règle les images de référence envoyées au service d'images qui crée la première image. Ce réglage ne pilote pas l'image d'entrée de LTX : LTX reçoit l'illustration terminée via `%reference_image_name%`. N'active les références d'avatar qu'après avoir vérifié que ton compte d'images les prend en charge et qu'elles aident.

La première image pèse beaucoup sur la qualité de l'animation. Elle doit montrer l'instant exact qui précède le mouvement prévu, avec le sujet, le trajet, les mains, la porte, l'accessoire ou la cible bien visibles.

### Scene Videos

| Réglage | Valeur conseillée |
| --- | --- |
| **Video model** | Le compte ComfyUI LTX 2.3 que tu as créé |
| **Game Video Prompt** | **Narration Passthrough** |

**Game Video Prompt** pilote les animations manuelles de la galerie et des Game Assets. Les clips de storyboard peuvent utiliser leur propre prompt sans modifier celles-ci.

### Storyboards

| Réglage | Valeur de départ conseillée |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 3 en temps normal. Commence à 1 pour le premier test en 8 Go de VRAM. |
| **Animation Clip Duration** | 5 secondes |
| **Viewer Display** | Floating pendant les tests |
| **Illustration Planner** | **Still Keyframes** (la solution de repli pour les tours sans vidéo) |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

- **LTX Simple Image-to-Video** est le planificateur recommandé. Il prépare une première image prête à animer et un prompt de mouvement direct de 4 à 8 phrases, avec une action principale, un seul comportement de caméra, un mouvement retenu autour de cette action et un son pertinent ou un bref dialogue.
- **LTX Director Storyboard** est une option avancée, avec des indications plus détaillées qui tiennent compte de la durée, et des règles de continuité. Essaie-le une fois le chemin simple stabilisé, ou quand un clip plus long a besoin de plusieurs phases enchaînées. Les deux utilisent le même contrat `%prompt%`.
- Avec les animations activées, **LTX Simple Image-to-Video** écrit les deux sorties : un `imagePrompt` pour Krea et un `narrationBeat` pour LTX. **Still Keyframes** ne sert qu'aux tours sans vidéo.
- **Storyboard First Frame** envoie à Krea la scène de première image complète, en langage naturel, écrite par le planificateur, sans titre d'image-clé, ni étiquettes de prompt, ni rappels d'apparence, ni direction artistique de campagne. Garde **Use Storyboard Template** sur On pour qu'il s'applique.
- **Narration Passthrough** fait passer le `narrationBeat` terminé du planificateur dans le contrat de prompt vidéo, sans nouveau récapitulatif de scène.

Chaque image-clé lance une tâche d'image Krea et une tâche vidéo LTX locale : trois images-clés déclenchent donc trois rendus d'image et trois rendus vidéo.

## Lancer le premier test

Pars d'un tour de GM terminé qui contient une seule action visuelle évidente, comme ouvrir une porte, regarder vers un bruit ou prononcer une courte réplique.

1. Pour la vérification la plus rapide en VRAM limitée, règle **Keyframes per Turn** sur 1 et laisse **Animation Clip Duration** à 5 secondes.
2. Active les deux réglages automatiques de storyboard une fois le tour de GM terminé.
3. Ouvre **Chat Settings → Gallery** (réglages du chat → galerie) et sélectionne **Create storyboard** (créer un storyboard). Cela démarre tout le chemin illustration et animation, sans attendre un nouveau tour.
4. Si la relecture des prompts est activée, vérifie le prompt de première image avant de l'envoyer.
5. Vérifie que la première image offre une pose de départ physiquement exploitable.
6. Attends le rendu de la première image, puis le clip ComfyUI.
7. Une fois le chemin manuel validé, remets **Keyframes per Turn** sur 3 et laisse les deux réglages automatiques activés.

Pendant la configuration, utilise l'affichage **Floating** pour pouvoir inspecter chaque image et chaque clip. Passe plus tard sur **Background** si tu veux les médias du storyboard dans la scène du Game.

Si ça n'a pas marché, voir [Résolution des problèmes](#troubleshooting).

## Comment fonctionne le passage de relais entre les prompts

Pour chaque image-clé, l'Animation Planner renvoie `imagePrompt` (uniquement la première image visible, au temps T=0) et `narrationBeat` (le prompt LTX complet de ce qui se passe ensuite). **Storyboard First Frame** met en forme `imagePrompt` et l'envoie à Krea 2. Une fois l'image obtenue, **Narration Passthrough** se résout en `narrationBeat`. Marinara le place dans le champ `prompt` de la requête vidéo, remplace `%prompt%` dans le workflow ComfyUI, téléverse la première image et remplace `%reference_image_name%` par son nom de fichier côté ComfyUI. Tu n'as pas besoin de deux segments de prompt locaux. Un seul prompt global est le fonctionnement normal.

## Écrire un bon prompt LTX

L'image source montre déjà l'apparence, la composition, le décor, la lumière et le style. Le prompt vidéo doit porter sur le mouvement :

- Un seul paragraphe fluide, au présent.
- Une action précise, adaptée à la durée du clip.
- Un mouvement de caméra décrit par rapport au sujet.
- Des réactions visibles par le regard, le visage, la posture, la respiration ou le geste.
- Au maximum un mouvement d'environnement utile.
- Un son d'ambiance, des effets, de la musique ou une courte réplique entre guillemets, quand c'est pertinent.
- Une fin naturelle, un mouvement qui se pose ou une brève tenue.

Évite les changements de scène, les coupes, les téléportations, les actions multiples sans lien entre elles, la physique complexe, les chorégraphies chargées, le texte lisible précis et la répétition de détails déjà visibles sur la première image.

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

<a id="troubleshooting"></a>

## Résolution des problèmes

### ComfyUI renvoie une erreur HTTP 400 ou "Prompt outputs failed validation"

Le workflow API ne correspond pas au graphe installé. Cherche un nœud supprimé, un identifiant de nœud orphelin, un nœud personnalisé manquant, une entrée renommée par une mise à jour de nœud ou un nom de fichier de modèle qui n'existe plus. Exporte un nouveau workflow API depuis le graphe qui fonctionne.

### Les images sont créées, mais pas les vidéos

Vérifie **Automatic Storyboard Animations** et le réglage **Video model** du Game Mode. Les animations exigent à la fois l'illustration de première image et un compte vidéo sélectionné.

### LTX ne reçoit aucune image de départ

Vérifie que `%reference_image_name%` figure dans le workflow API enregistré et qu'il alimente le segment d'image du nœud LTX Director. Marinara ne téléverse la première image que si ce placeholder est présent.

### Le clip se déforme, change de personnage ou part dans tous les sens

Reviens à **LTX Simple Image-to-Video**, utilise une seule image-clé et teste un tour avec une seule action. Une seule image ne peut pas se transformer proprement en plusieurs lieux, poses et dénouements dans un court clip. Vérifie aussi la première image : une pose de départ confuse rend l'animation plus difficile.

### Toutes les générations se ressemblent trop

Remplace toute graine d'échantillonnage codée en dur par `%seed%`. Une fois un résultat utile obtenu, fixe temporairement cette graine dans le workflow, seulement le temps de comparer des changements de prompt ou d'échantillonnage.

### La génération manque de mémoire

Commence en 480p. Réduis ensuite la durée. Garde une seule image-clé par tour pendant les tests, ferme les autres applications qui utilisent le GPU et ne garde pas de modèle de langage local chargé sur le même GPU à faible VRAM. Un checkpoint quantifié réduit la mémoire du modèle, mais pas celle qu'utilisent les latents vidéo, l'encodeur de texte, les VAE, l'audio et l'upscaling.

### Marinara arrête d'attendre alors que ComfyUI continue son rendu

Fermer la requête du navigateur ou perdre la connexion peut arrêter l'interrogation par Marinara sans annuler une tâche déjà mise en file d'attente dans ComfyUI. Regarde la file, l'historique et le dossier de sortie de ComfyUI avant de relancer le même rendu.

### Le workflow marche dans ComfyUI, mais échoue depuis Marinara

Compare le JSON enregistré sur le compte avec ton dernier export API. Vérifie l'URL de base, l'orthographe des placeholders, les nœuds personnalisés, les chemins de modèles, le nœud de sortie, les dimensions et les champs de durée. Le graphe modifiable peut fonctionner alors que Marinara conserve encore un instantané exporté plus ancien.

Pour les traces serveur, active les logs de débogage (le journal du serveur) et cherche `[debug/game/storyboard-video]` et `[video-gen/comfyui]`. Une requête saine affiche le prompt global complet, le nom de fichier de l'image de référence téléversée, la durée, le nombre d'images et l'identifiant du prompt mis en file d'attente dans ComfyUI.

## Référence : modèles LTX 2.3

Choisis le format de modèle selon la famille de ton GPU et la mémoire qui reste une fois que ComfyUI a chargé l'encodeur de texte, les VAE et l'upscaler. Ce sont des points de départ, pas des promesses.

| Famille de GPU | Point de départ pratique | Remarques |
| --- | --- | --- |
| RTX série 30 (Ampere) | INT8 ConvRot | Le point de départ économe en mémoire pour les cartes de classe 3070, 3080 et 3090. |
| RTX série 40, 16 à 24 Go | FP8 input-scaled | Utilise le chemin FP8 accéléré du matériel Ada. |
| RTX série 40, 8 à 12 Go | INT8 ConvRot quand le déchargement FP8 est trop lent | Compare les deux sur ton workflow. |
| RTX série 50 (Blackwell) | Workflow NVFP4 dev | Demande une pile ComfyUI, CUDA et nœuds compatible NVFP4. |
| RTX 50, workflow distilled existant | FP8 input-scaled | Utilise-le tant qu'aucun checkpoint distilled NVFP4 officiel n'existe. |

Le workflow testé sur RTX 3080 utilise `ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors`. Ces suffixes désignent des formats quantifiés et des chemins d'exécution différents, pas des presets de qualité qu'on peut toujours intervertir. Les workflows **Dev** et **distilled** reposent sur des hypothèses d'échantillonnage différentes : ne place donc pas un checkpoint dev dans le graphe distilled sans modifier le workflow. Qu'un checkpoint tienne en mémoire ne garantit pas qu'une vidéo plus longue ou plus définie tiendra aussi.

Le workflow officiel pour débuter utilise `ltx-2.3-22b-dev-fp8.safetensors`, `ltx-2.3-22b-distilled-lora-384.safetensors`, `gemma_3_12B_it_fp4_mixed.safetensors` et `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`. Les workflows personnalisés peuvent utiliser d'autres checkpoints, quantifications, nœuds de chargement ou dossiers. Les noms de fichiers enregistrés dans le workflow API doivent correspondre exactement aux fichiers que ComfyUI voit. Si tu ranges les modèles dans un autre dossier, comme `LTX2/`, mets à jour les valeurs du loader et exporte une nouvelle copie API.

Quand tu partages un workflow, note le modèle de ton GPU et sa VRAM, la version de ComfyUI, les versions du pilote NVIDIA, de CUDA, de PyTorch et de Python, les nœuds personnalisés et leurs versions, les noms de fichiers et les dossiers des modèles, la résolution, la durée, le nombre d'images-clés et le temps de rendu, et si Krea 2 tournait en local ou sur un service hébergé.

Références officielles :

- [Guide LTX 2.3 image-vers-vidéo](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [Guide de prompting LTX](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [Fiche du modèle LTX 2.3](https://huggingface.co/Lightricks/LTX-2.3)
- [Fiche du modèle LTX 2.3 NVFP4](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Exemples ComfyUI LTX 2.3 officiels](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Poids communautaires ComfyUI-separated et FP8](https://huggingface.co/Kijai/LTX2.3_comfy)

## Guides associés

- [Guide de l'agent Storyboard](storyboard.md)
- [Configurer un workflow ComfyUI](../media/comfyui.md)
- [Génération de vidéos de scène](../media/scene-video.md)
- [Game Mode : premiers pas](getting-started.md)
