# Guide de l'agent Storyboard

L'agent téléchargeable **Storyboard** transforme un texte d'histoire terminé en une suite ordonnée d'images-clés et, en option, en courts clips image-vers-vidéo. Il fonctionne en Game Mode et en Roleplay. Les chats Conversation ne l'utilisent pas.

Le package Storyboard fournit les prompts de planification, les valeurs par défaut et les commandes propres à chaque chat. Un prompt, c'est le texte que Marinara envoie à l'IA. Marinara se charge de la génération des médias, enregistre les résultats dans la galerie et les affiche dans le chat ou dans la visionneuse du jeu. Ce guide présente d'abord Game Mode. Le fonctionnement en Roleplay suit dans [Les storyboards en Roleplay](#roleplay-storyboards). Pour le reste du Roleplay, voir [Mode Roleplay : premiers pas](../roleplay/getting-started.md).

- **Game Mode** utilise un seul tour de narration terminé du GM (le maître du jeu). Il a deux interrupteurs distincts, **Automatic Storyboard Illustrations** (illustrations automatiques du storyboard) et **Automatic Storyboard Animations** (animations automatiques du storyboard), et **Gallery → Create storyboard** (galerie → créer un storyboard) pour le dernier tour du GM. Le storyboard s'affiche dans une visionneuse flottante ou en arrière-plan du jeu, synchronisé avec la narration, et Game Mode utilise des planificateurs distincts pour les images fixes et pour l'animation.
- **Roleplay** utilise les messages terminés depuis le dernier épisode réussi. Ses choix automatiques sont **Manual only** (manuel uniquement), **Still images** (images fixes) ou **Animations**, et **Gallery → Create storyboard** porte sur la dernière réponse terminée de l'assistant. Le storyboard s'affiche directement sous la réponse qui clôt l'épisode, et le Roleplay utilise un contrat d'épisode, un style visuel, un module d'animation facultatif et un contrat de sortie.

Dans les deux modes, les images-clés sont enregistrées dans l'onglet **Images** de la galerie, et les clips dans son onglet **Videos** (vidéos).

## Installer l'agent

1. Ouvre le panneau **Agents** (l'icône Sparkles).
2. Choisis **Agent Organizer** (organisateur d'agents).
3. Ouvre **Storyboard** et choisis **Install** (installer).
4. Ouvre un chat Game ou Roleplay, puis ouvre **Chat Settings → Agents** (réglages du chat → agents).
5. Active **Enable Agents** (activer les agents), puis active **Enable Storyboards** (activer les storyboards) dans la carte Storyboard.

L'installation rend l'agent disponible, sans l'activer dans chaque chat. Aucun redémarrage de Marinara n'est nécessaire.

Si ça n'a pas marché et que Storyboard n'apparaît pas dans Chat Settings, vérifie que le package est installé, que le chat est un chat Game ou Roleplay, et que la version du package fonctionne avec ta version de Marinara.

## Les storyboards en Game Mode

En Game Mode, Storyboard prend comme source exactement un tour de narration terminé du GM. Il retire les balises de commande cachées du GM, planifie des images ordonnées et rattache chaque image à une plage de sections lisibles du tour. La visionneuse change d'image à mesure que la lecture avance dans ces sections.

### Créer un storyboard en Game Mode

**Avant de commencer :** la partie a besoin d'un compte d'images (celui de la partie, ou celui de la configuration globale de Storyboard). Voir [Fournisseurs de génération d'images et configuration](../media/image-providers.md).

1. Installe Storyboard et ouvre un chat en Game Mode.
2. Ouvre **Chat Settings → Agents**, active **Enable Agents**, puis **Enable Storyboards**.
3. Termine un tour de narration du GM.
4. Ouvre **Chat Settings → Gallery** (réglages du chat → galerie) et choisis **Create storyboard**.

Choisis **View storyboard** (voir le storyboard) dans la galerie pour rouvrir une visionneuse fermée. La génération manuelle suit le réglage d'animation en cours : quand **Automatic Storyboard Animations** est activé, un storyboard manuel demande aussi des clips.

Si ça n'a pas marché, voir [Dépannage](#troubleshooting).

### Les storyboards automatiques en Game Mode

La carte Storyboard a deux interrupteurs :

- **Automatic Storyboard Illustrations** crée des images-clés fixes après un tour terminé du GM.
- **Automatic Storyboard Animations** crée aussi un clip pour chaque image-clé. Activer les animations active les illustrations, et désactiver les illustrations désactive les animations.

La génération automatique ne fonctionne que tant que l'agent est actif pour cette partie, et ne recrée pas de storyboard pour un tour qui en a déjà un. Utilise l'action manuelle de la galerie quand tu en veux un autre pour le dernier tour.

Si **Expose media prompts before sending** (afficher les prompts médias avant l'envoi) est activé dans les réglages de génération, un storyboard de jeu créé à la main peut afficher ses prompts d'image compilés pour relecture. Les storyboards automatiques sautent la relecture pour ne pas interrompre la partie.

### Réglages de la partie

Ouvre **Chat Settings → Agents → Storyboards**.

| Réglage | Valeur par défaut de l'agent | Ce que ça règle |
| --- | --- | --- |
| **Enable Storyboards** | Off, chat par chat | Active l'agent installé pour cette partie. |
| **Automatic Storyboard Illustrations** | Repris du réglage Automatic generation | Images-clés fixes après chaque tour du GM. |
| **Automatic Storyboard Animations** | Repris du réglage Automatic generation | Clips MP4 pour chaque image-clé. |
| **Keyframes per Turn** | 3 (de 1 à 200) | Nombre d'images visé. Un tour court peut en produire moins. |
| **Animation Clip Duration** | 5 secondes (de 1 à 15) | Durée demandée pour chaque clip. Un service peut la ramener dans ses propres limites. |
| **Viewer Display** | Floating | Visionneuse déplaçable, ou arrière-plan complet du jeu. |
| **Illustration Planner** | Still Keyframes | Planifie des illustrations fixes abouties. |
| **Animation Planner** | Comic Page Animation | Planifie des premières images prêtes pour l'animation et des indications de mouvement. |
| **Use Storyboard Template** | On | Applique le formateur d'illustration final sélectionné. |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Met en forme l'image planifiée pour le service d'images. |
| **Storyboard Video Prompt** | Cinematic Scene Video | Met en forme la première image et le plan de mouvement pour le service vidéo. |

Le package fournit aussi des planificateurs NovelAI, BD, manga, anime et orientés LTX. Choisir un planificateur d'animation n'active pas la vidéo à lui seul. **Automatic Storyboard Animations** et un compte vidéo restent nécessaires.

Chaque chat peut remplacer les valeurs par défaut de l'agent. Chat Settings affiche la mention **Using agent default** sur les valeurs héritées et propose une commande de réinitialisation dès que tu en remplaces une.

### Comment un storyboard est construit en Game Mode

Game Mode garde des planificateurs distincts pour les images fixes et pour les animations.

```text
completed GM narration
  -> still or animation planner
  -> Storyboard Illustration Prompt
  -> image account
  -> optional Storyboard Video Prompt
  -> video account
```

Le planificateur choisit les moments de l'histoire et les met en ordre. Le prompt d'illustration est un formateur pour le service, pas un second planificateur. Quand les animations sont activées, le planificateur d'animation produit une description exacte de la première image et une indication de mouvement, et le prompt vidéo transforme cette indication en requête finale.

### La visionneuse du jeu

- **Floating viewer** (visionneuse flottante) est un panneau déplaçable et redimensionnable posé au-dessus du jeu. Il suit la position de lecture dans la narration et affiche l'image correspondante. Une vidéo se lit quand elle est prête ; sinon, c'est l'image qui s'affiche. Fermer ce panneau le masque pour le tour en cours. Utilise **Gallery → View storyboard** pour le rouvrir.
- **Game background** (arrière-plan du jeu) place l'image active derrière le reste de l'écran. Tant qu'il est activé, il remplace l'arrière-plan de scène généré, donc **Generate background** (générer un arrière-plan) n'est pas disponible. Les clips d'arrière-plan se lisent une fois et restent sur leur dernière image.

Pour relire, lire/mettre en pause et couper le son, ouvre **Game controls** (contrôles du jeu, le bouton manette près du coin supérieur droit du chat). Il s'ouvre en fenêtre sur ordinateur et en panneau sur téléphone. Si tu l'as déplacé dans Chat Settings, ouvre la section **Game controls** à cet endroit.

### Storyboard Optimized n'est pas l'interrupteur de l'agent

La présentation **Storyboard Optimized** de l'assistant de configuration modifie le prompt de narration du GM pour que les tours contiennent des repères visuels plus faciles à filmer. Elle n'installe pas Storyboard, ne l'active pas, n'active pas les médias automatiques et ne choisit aucun compte d'images ou vidéo. Tu peux utiliser l'agent avec **Standard** comme avec **Storyboard Optimized**. Installe et active l'agent séparément.

### Recettes pour Game Mode

Chaque recette associe une chaîne Storyboard aux autres réglages de la partie et du service. Applique la chaîne nommée si ton package la propose, ou choisis à la main les options listées.

#### Storyboards BD avec Google

Chaîne : **Illustration Planner** Still Keyframes, **Animation Planner** Comic Page Animation, **Storyboard Illustration Prompt** Game Scene Illustration, **Storyboard Video Prompt** Comic Page Video, **Use Storyboard Template** On.

Liste de vérification de la partie :

- **Illustrator** : On (étape Features de l'assistant)
- Compte d'images : Google/Nano Banana, **Image Style** : Default, et garde le style artistique généré à la configuration
- **Automatic Storyboard Illustrations** : On
- **Automatic Storyboard Animations** : Off
- **Keyframes per Turn** : 3
- Compte vidéo : None

Tu obtiens ainsi des storyboards fixes ordinaires. La chaîne d'animation Comic Page enregistrée ne s'applique que si tu choisis plus tard un compte vidéo et que tu actives **Automatic Storyboard Animations**.

#### Tags NovelAI directs

Chaîne : **Illustration Planner** NovelAI Keyframes. Pour **Storyboard Illustration Prompt**, crée une option personnalisée dont le prompt contient uniquement le texte ci-dessous. Règle **Use Storyboard Template** sur On. Laisse Animation Planner et Video Prompt inchangés.

```text
${scenePrompt}
```

Liste de vérification de la partie :

- **Image Style** : Danbooru, et retire le texte en prose du champ **Style text** du profil Danbooru
- **Use Campaign Art Style** : Off
- **Attach Card Appearance** : Off
- **Send Avatar References** : Off
- **Use NovelAI Character Prompts** : Off
- **Queue media generation requests** : On
- Ajuste au besoin les tags positifs, négatifs et d'illustration

Le gabarit de transmission directe envoie les tags NovelAI compacts du planificateur sans les envelopper dans le formateur en prose habituel.

#### Krea 2 en local + LTX 2.3

Chaîne : **Illustration Planner** Still Keyframes, en repli pour les images fixes seules, **Animation Planner** LTX Simple Image-to-Video, **Storyboard Illustration Prompt** Storyboard First Frame, **Storyboard Video Prompt** Narration Passthrough, **Use Storyboard Template** On.

Avec un GPU doté de 8 Go de VRAM, commence par une seule image-clé en 480p. Une fois que ça marche, passe progressivement à trois images-clés et à des tailles plus grandes. Pour le compte ComfyUI, les placeholders et le test complet, voir [Storyboards LTX 2.3 dans Game Mode](ltx-2-3-storyboards.md).

<a id="roleplay-storyboards"></a>

## Les storyboards en Roleplay

En Roleplay, les storyboards regroupent des échanges terminés en un épisode visuel, affiché sous la réponse de l'assistant qui le clôt.

### Créer un storyboard en Roleplay

1. Installe Storyboard et active-le pour le chat Roleplay.
2. Dans **Chat Settings → Agents → Storyboards**, choisis une **Prompt connection** (connexion de prompt) et un **Image model** (modèle d'image), ou laisse-les sur **Use global default** (utiliser la valeur globale par défaut) si la configuration globale est complète.
3. Choisis un **Automatic mode** (mode automatique) :
   - **Manual only** : aucun épisode automatique. **Create storyboard** crée un épisode fixe à la demande.
   - **Still images** : crée automatiquement un épisode illustré.
   - **Animations** : crée automatiquement des images-clés et un clip pour chaque image. Un compte vidéo est nécessaire.
4. Règle **Messages per episode** (messages par épisode) et **Keyframes per episode** (images-clés par épisode).
5. Termine une nouvelle réponse de l'assistant, ou ouvre **Chat Settings → Gallery** et choisis **Create storyboard**.

Sur un storyboard à plusieurs images-clés, utilise les flèches pour passer d'une image à l'autre. Une image animée affiche son clip dans le chat, et affiche son image à la place tant que le clip est en attente ou indisponible.

### Le fonctionnement de l'intervalle d'épisode

L'intervalle, c'est le nombre de nouveaux messages utilisateur et assistant qui doivent s'accumuler entre deux storyboards automatiques réussis. Les deux rôles comptent, et l'épisode reprend les nouveaux messages dans l'ordre. La valeur par défaut est 1 : la prochaine réponse terminée de l'assistant peut donc créer un épisode tout de suite. Une valeur plus grande laisse s'accumuler davantage de dialogues et d'action. La source est limitée aux 20 derniers messages et à 12 000 caractères, donc un long chat ne peut pas produire une requête de planification sans limite.

Le compteur n'avance qu'une fois un storyboard complet ou partiel enregistré : un épisode en échec ne consomme donc pas la source. Ouvrir un chat existant ne rattrape pas les anciennes réponses. La génération automatique attend une nouvelle réponse terminée de l'assistant.

### Bibliothèque de prompts Roleplay

Le Roleplay construit une seule requête de planification à partir de quatre prompts sélectionnés :

| Réglage | Par défaut | Rôle |
| --- | --- | --- |
| **Episode contract** (contrat d'épisode) | Completed Roleplay Episode | Choisit les moments appuyés par la source et les garde dans l'ordre des messages. |
| **Visual style** (style visuel) | Normal / Anime | Le rendu de chaque image-clé. Autres choix : NovelAI, Comic, Colored Manga, B&W Manga. |
| **Animation addon** (module d'animation) | Simple Storyboard Motion | Utilisé uniquement pour les clips. Ajoute une action réalisable, le comportement de la caméra, les dialogues et sons de la source, l'ambiance et une pause finale. |
| **Output contract** (contrat de sortie) | Roleplay Keyframe JSON | Les champs structurés d'image-clé que renvoie le planificateur. |

Le **Storyboard Illustration Prompt** met ensuite en forme chaque première image pour le service d'images et, quand les clips sont activés, le **Storyboard Video Prompt** met en forme le plan de mouvement. Ouvre la **Prompt library** (bibliothèque de prompts) repliée dans Stage 1 pour les modifier. Utilise **Add option** (ajouter une option) pour un prompt personnalisé, puis renomme-le, ajoute une courte description et modifie son contenu. Tu peux rétablir les valeurs par défaut des options intégrées. Modifier un style visuel de Roleplay ne change pas les planificateurs de Game Mode.

### Storyboard et Illustrator ensemble

Storyboard est distinct d'Illustrator, et les actions manuelles d'Illustrator restent disponibles. Quand le storyboard Roleplay est réglé sur **Still images** ou **Animations**, Marinara saute l'image automatique habituelle d'Illustrator pour cette réponse, afin que les deux ne produisent pas de médias concurrents. **Manual only** ne change pas le fonctionnement d'Illustrator.

## Réglages de l'agent Storyboard

Ouvre le panneau **Agents**, choisis **Storyboard** et ouvre sa configuration. Ces valeurs sont les valeurs par défaut des chats qui n'ont pas leurs propres remplacements.

| Réglage | Par défaut | Rôle |
| --- | --- | --- |
| Agent connection | Le compte d'agent que tu as choisi | Planifie le storyboard avec un modèle. |
| **Image model** | **Use the chat image connection** | Crée chaque image-clé. Un compte d'images est nécessaire quelque part dans la chaîne de repli. |
| **Video connection** | **Use the chat video connection** | Crée les clips quand les animations sont activées. |
| **Automatic generation** | Still images | Le comportement automatique de départ des chats qui viennent d'être activés. |
| **Keyframes per turn** | 3 (de 1 à 200) | Nombre visé d'images ordonnées. |
| **Clip seconds** | 5 (de 1 à 15) | Durée demandée pour chaque clip. |
| **Viewer display** | Floating viewer | La visionneuse par défaut en Game Mode. En Roleplay, les storyboards s'affichent toujours dans le chat. |
| **Default Roleplay episode interval** | 1 (de 1 à 100) | Nouveau contenu Roleplay nécessaire entre deux épisodes automatiques. |
| **Attach Card Appearance** | On | Ajoute aux prompts d'image l'apparence des personnages reconnus. Une fiche ou un persona (un personnage que tu incarnes) dont **Image Appearance Override** (apparence propre aux images) est activé fournit ce texte à la place de son champ **Appearance** (apparence). |
| **Send Avatar References** | On | Envoie les avatars des personnages et des personas reconnus quand le service d'images accepte les références. |
| **Use the final image template** | On | Met en forme une image planifiée avant son envoi au service d'images. Dans un chat Game, ce réglage s'appelle **Use Storyboard Template**. |
| **Use NovelAI character prompts** | On | Prompts natifs par personnage, uniquement sur les comptes officiels NovelAI V4 et V4.5 pris en charge. Les autres services utilisent le chemin de prompt partagé. |

En Game Mode, la bibliothèque a deux voies de planification, choisies selon que la partie produit des images fixes ou des clips : **Still planner** (planificateur d'images fixes, par défaut Still Keyframes) et **Animation planner** (planificateur d'animation, par défaut Comic Page Animation). Le texte des planificateurs se modifie dans la configuration globale de l'agent, et chaque chat Game choisit parmi les options dans ses propres réglages.

Après la planification, des formateurs partagés créent les requêtes finales : **Default image prompt** (prompt d'image par défaut, Game Scene Illustration) et **Default video prompt** (prompt vidéo par défaut, Cinematic Scene Video). Chaque étape numérotée a sa propre **Prompt library** repliée : Stage 2 pour les formateurs d'image, Stage 3 pour les planificateurs de mouvement qui tiennent compte de l'image et Stage 4 pour les formateurs qui transmettent le prompt vidéo tel quel. Les choix d'image comprennent aussi **Storyboard Illustration** et **Storyboard First Frame**. Les choix vidéo comprennent **Anime Game Video**, **Comic Page Video** et **Narration Passthrough**. Les chats Game et Roleplay peuvent choisir des formateurs différents.

Dans Stage 3, **Image-aware shot planning** (planification des plans à partir de l'image) suit aussi les **Video prompting instructions** (instructions de prompt vidéo) du compte vidéo. Utilise ce champ dans l'éditeur de compte pour indiquer ce que ton modèle vidéo attend, par exemple le vocabulaire de caméra, la longueur du prompt ou les indications sonores.

Le choix des comptes diffère un peu selon le mode. Le Roleplay a des sélecteurs de prompt, d'image et de vidéo propres à chaque chat, et **Use global default** reprend la configuration de Storyboard. Game Mode utilise ses propres comptes de planification, d'images et vidéo quand ils sont définis, puis se rabat sur les valeurs par défaut de l'agent. Les images fixes ont besoin d'un compte d'images. Les animations ont besoin d'une image-clé réussie et d'un compte vidéo.

## Les prompts d'image et la cohérence des personnages

Le planificateur décide des moments à montrer et rédige le contenu visuel de chaque image. Le gabarit d'image final ajoute la structure attendue par le service, l'apparence des personnages reconnus, la gestion des références, le contexte du lieu, la direction artistique de la campagne et les instructions d'image.

Quand un planificateur renvoie déjà la syntaxe exacte que doit recevoir le service d'images, utilise un gabarit de transmission directe comme `${scenePrompt}`. Ne désactive **Use the final image template** que pour contourner volontairement le formateur. Les instructions d'image obligatoires s'appliquent quand même.

Pour des personnages plus stables :

- Garde les champs Appearance des fiches de personnage précis et à jour.
- Laisse **Attach Card Appearance** activé, sauf si le planificateur répète déjà les détails nécessaires.
- Laisse **Send Avatar References** activé quand le service accepte les références et que les avatars correspondent au rendu voulu.
- Préfère une petite distribution bien visible dans chaque image. Storyboard n'inclut que les personnages et les personas visibles et reconnus, pas tout le monde dans le chat.

## Coût et performances

Chaque image-clé est une tâche d'image distincte. Les storyboards animés ajoutent une tâche vidéo par image-clé réussie : un storyboard animé de trois images peut donc lancer trois requêtes d'image et trois requêtes vidéo. Quand tu testes un nouveau service ou une configuration locale, commence par des images fixes et une seule image-clé. N'augmente le nombre d'images, la durée des clips et l'intervalle automatique qu'une fois le fonctionnement de base au point.

## Les parties créées avec l'ancien système de storyboard

Les chats Game existants peuvent contenir des réglages de l'ancienne interface Storyboard intégrée. Quand le package est installé, Marinara les garde comme remplacements propres au chat : une ancienne partie peut donc se comporter autrement que les valeurs par défaut actuelles de l'agent. Ouvre **Chat Settings → Agents → Storyboards** et utilise la commande de réinitialisation de chaque champ pour qu'il suive à nouveau la valeur par défaut de l'agent. Ces réglages ne sont que des données de migration. La génération exige toujours que le package soit installé et activé pour la partie.

<a id="troubleshooting"></a>

## Dépannage

### Create storyboard est disponible, mais la génération échoue

- Active **Enable Agents** et **Enable Storyboards** pour le chat.
- Choisis un compte de génération d'images valide dans la carte Storyboard du Roleplay, dans les réglages de la partie ou dans la configuration globale de Storyboard.
- Attends la fin de la réponse de l'assistant ou du GM, puis réessaie.

### Le Roleplay n'a pas créé d'épisode automatique

- Choisis **Still images** ou **Animations**, pas **Manual only**.
- Attends une nouvelle réponse terminée de l'assistant. Ouvrir un chat ne rattrape pas les anciens messages.
- Vérifie **Messages per episode**. Assez de nouveaux messages utilisateur et assistant doivent s'accumuler.
- Une exécution en échec ne fait pas avancer le compteur : cherche donc dans le log du serveur, c'est-à-dire son journal, l'erreur d'origine du service ou l'erreur d'analyse.

### Les images apparaissent, mais pas les vidéos

- En Roleplay, choisis **Animations**. En Game Mode, active **Automatic Storyboard Animations**.
- Choisis un compte Video Generation qui accepte une entrée image-vers-vidéo.
- Regarde l'onglet **Videos** de la galerie. Un clip peut se terminer après son image-clé.
- Si la planification est passée en repli après un échec du modèle, Marinara peut garder des images de repli et sauter les vidéos pour cette exécution.

### Un storyboard est incomplet ou bloqué

Une tâche du service a peut-être échoué, expiré ou atteint une limite de débit ou de contenu. Si le service fonctionne mais reste lent, augmente `IMAGE_GEN_TIMEOUT_MS` ou `VIDEO_GEN_TIMEOUT_MS` dans `.env`, puis redémarre Marinara, car ces valeurs sont lues au démarrage. Voir [Configuration](../CONFIGURATION.md).

Active le mode Debug et cherche `storyboard` dans le log du serveur pour voir le planificateur, le prompt d'image compilé, la sélection des références et le prompt vidéo. Les logs de debug peuvent contenir du texte de chat privé : nettoie-les avant de les partager.

## Guides associés

- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Game Mode : premiers pas](getting-started.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
- [Fournisseurs de génération d'images et configuration](../media/image-providers.md)
- [Génération de vidéos de scène](../media/scene-video.md)
- [Storyboards LTX 2.3 dans Game Mode](ltx-2-3-storyboards.md)
