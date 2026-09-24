# Guide de l'agent Storyboard

L'agent téléchargeable **Storyboard** transforme un texte d'histoire terminé en une suite ordonnée d'images-clés et, en option, en courts clips image-vers-vidéo. Il fonctionne en **Roleplay** et en **Game Mode** (le mode jeu). Les chats Conversation n'utilisent pas Storyboard.

C'est le fonctionnement actuel, désormais assuré par un agent. Le package Storyboard fournit les prompts de planification, les valeurs par défaut et les commandes propres à chaque chat. Un prompt, c'est le texte que Marinara envoie à l'IA. Marinara Engine fournit l'intégration côté hôte : elle génère les médias, les enregistre dans le panneau **Gallery** (galerie), puis les affiche dans le chat ou dans la visionneuse du jeu.

## Roleplay et Game Mode en un coup d'œil

| | Roleplay | Game Mode |
| --- | --- | --- |
| Source de l'histoire | Les messages utilisateur et assistant terminés depuis le dernier épisode réussi | Un tour de narration terminé du GM (le maître du jeu) |
| Choix automatiques | **Manual only**, **Still images** ou **Animations** | Deux interrupteurs distincts, **Automatic Storyboard Illustrations** et **Automatic Storyboard Animations** |
| Action manuelle | **Gallery > Create storyboard** pour la dernière réponse de l'assistant terminée | **Gallery > Create storyboard** pour le dernier tour GM terminé |
| Affichage | Directement sous la réponse de l'assistant qui clôt l'épisode | Visionneuse flottante ou arrière-plan du jeu, synchronisés avec la narration |
| Prompts de planification | Contrat d'épisode, style visuel, module d'animation en option et contrat de sortie | Des planificateurs distincts pour les images fixes et pour l'animation |
| Prompts finaux partagés | Prompt d'image d'illustration et prompt de vidéo d'animation | Prompt d'image d'illustration et prompt de vidéo d'animation |

Dans les deux modes, Marinara enregistre les images-clés dans l'onglet **Images** du panneau **Gallery**, et les clips dans l'onglet **Videos**.

## Installer l'agent

1. Ouvre le panneau **Agents** depuis l'icône en forme d'étincelles.
2. Choisis **Download Agents** (télécharger des agents).
3. Ouvre **Storyboard**, puis choisis **Install**.
4. Ouvre un chat Roleplay ou Game, puis va dans **Chat Settings > Agents** (réglages du chat).
5. Active **Enable Agents**, puis **Enable Storyboards** dans le bloc **Storyboard**.

Installer le package le rend disponible pour les chats compatibles, sans l'activer d'office dans chaque chat. La version actuelle du package ne demande aucun redémarrage de Marinara après l'installation.

Si Storyboard n'apparaît pas dans **Chat Settings**, vérifie que le package est bien installé et que le chat est en Roleplay ou en Game Mode.

## Réglages de l'agent Storyboard

Ouvre le panneau **Agents**, choisis **Storyboard**, puis ouvre sa configuration. Ces réglages s'appliquent par défaut à tous les chats qui n'ont pas leurs propres remplacements.

### Valeurs par défaut de génération et de médias

| Réglage | Par défaut | Rôle |
| --- | --- | --- |
| Agent connection | La connexion d'agent sélectionnée | Planifie le storyboard à l'aide d'un LLM (un modèle de langage) |
| **Image connection** | Use the Game image connection | Génère chaque image-clé ; une connexion d'image est obligatoire quelque part dans la chaîne de repli |
| **Video connection** | Use the Game video connection | Génère les clips quand les animations sont activées |
| **Automatic generation** | Still images | Définit le comportement automatique de départ des chats qui viennent d'être activés |
| **Keyframes per turn** | 3, de 1 à 6 | Règle le nombre d'images ordonnées visé |
| **Clip seconds** | 5, de 1 à 15 | Règle la durée demandée pour chaque clip |
| **Viewer display** | Floating viewer | Définit la visionneuse par défaut du Game Mode ; en Roleplay, les storyboards s'affichent toujours au fil du chat |
| **Default Roleplay episode interval** | 1, de 1 à 100 | Détermine la quantité de nouveau contenu Roleplay accumulée entre deux épisodes automatiques |
| **Attach Card Appearance** | On | Ajoute aux prompts d'image les détails d'apparence des personnages reconnus |
| **Send Avatar References** | On | Envoie les avatars des personnages et des personas reconnus quand le fournisseur d'images accepte les références |
| **Use the final image template** | On | Met en forme une image planifiée avant son envoi au fournisseur d'images |
| **Use NovelAI character prompts** | On | Utilise les prompts natifs par personnage sur les connexions officielles NovelAI V4/V4.5 prises en charge |

### Bibliothèque de prompts Game Mode

La bibliothèque Game propose deux voies de planification distinctes. La voie active dépend de ce que la partie produit : des images fixes ou des clips.

| Réglage | Par défaut | Rôle |
| --- | --- | --- |
| **Still planner** | Still Keyframes | Découpe un tour GM terminé en moments d'image fixe aboutis |
| **Animation planner** | Comic Page Animation | Crée des premières images prêtes pour l'animation et des indications de mouvement adaptées à la durée |

Le package propose aussi des planificateurs NovelAI, BD, manga en couleur, manga en noir et blanc, épisode d'anime et orientés LTX. Le texte des prompts de planification se modifie dans la configuration globale de l'agent. Le chat Game choisit ensuite parmi les options fixes et animées dans **Chat Settings > Agents > Storyboards**.

### Bibliothèque de prompts Roleplay

Le Roleplay assemble quatre prompts sélectionnés en une seule requête de planification.

| Réglage | Par défaut | Rôle |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | Choisit les moments terminés et appuyés par le texte source, puis les garde dans l'ordre des messages |
| **Visual style** | Normal / Anime | Définit le traitement visuel de chaque image-clé |
| **Animation addon** | Simple Storyboard Motion | Ajoute le mouvement, la caméra, les dialogues et sons appuyés par le texte source, l'ambiance et une pause finale, uniquement pour les clips |
| **Output contract** | Roleplay Keyframe JSON | Définit les champs structurés d'image-clé que renvoie le planificateur |

Ouvre **Prompt library** (Bibliothèque de prompts), repliée dans Stage 1, pour modifier ces collections complètes. Clique sur **Add option** (ajouter une option) pour créer un prompt personnalisé, renomme-le, ajoute une courte description et modifie le corps du prompt. Tu peux à tout moment rétablir les valeurs par défaut du package pour les options intégrées.

### Formateurs partagés pour les fournisseurs

Une fois les images planifiées, quel que soit le mode, des formateurs partagés construisent les requêtes finales envoyées aux fournisseurs.

| Réglage | Par défaut | Rôle |
| --- | --- | --- |
| **Default image prompt** | Game Scene Illustration | Met en forme chaque image-clé planifiée pour le fournisseur d'images |
| **Default video prompt** | Cinematic Scene Video | Met en forme la première image et le plan de mouvement pour le fournisseur de vidéos |

Chaque étape numérotée a sa propre **Prompt library** repliée : Stage 2 contient les formateurs d'image, Stage 3 les planificateurs de mouvement qui tiennent compte de l'image, et Stage 4 les formateurs qui transmettent le prompt vidéo sans modification. Les choix d'image intégrés comprennent aussi **Storyboard Illustration** et **Storyboard First Frame**. Côté vidéo : **Anime Game Video**, **Comic Page Video** et **Narration Passthrough**. Les chats Game et Roleplay peuvent choisir des formateurs différents sans modifier la collection de prompts partagée.

### Valeurs par défaut globales et remplacements par chat

Chaque chat peut remplacer les valeurs par défaut de l'agent. Dans **Chat Settings**, les valeurs héritées portent la mention **Using agent default**, et un bouton de réinitialisation apparaît dès que tu crées un remplacement.

L'ordre de priorité des connexions change un peu selon le mode :

- En Roleplay, des sélecteurs de prompt, d'image et de vidéo sont disponibles chat par chat. L'option **Use global default** reprend la configuration de Storyboard.
- En Game Mode, les connexions de planification, d'image et de vidéo propres à la partie sont prioritaires ; à défaut, ce sont les valeurs par défaut de l'agent Storyboard qui s'appliquent.

Une connexion d'image est obligatoire pour les images fixes. Les animations exigent en plus une image-clé générée avec succès et une connexion vidéo.

## Les storyboards en Roleplay

En Roleplay, les storyboards regroupent des échanges terminés en un épisode visuel, affiché juste sous la réponse de l'assistant qui le clôt.

### Démarrage rapide

1. Installe **Storyboard**, puis active-le pour le chat Roleplay.
2. Dans **Chat Settings > Agents > Storyboards**, choisis une **Prompt connection** et une **Image connection**, ou laisse-les sur **Use global default** si la configuration globale est déjà complète.
3. Choisis un **Automatic mode** :
   - **Manual only** : aucun épisode automatique ; le bouton **Create storyboard** (créer un storyboard) crée un épisode fixe à la demande.
   - **Still images** : crée automatiquement un épisode illustré.
   - **Animations** : crée automatiquement les images-clés et un clip par image ; une connexion vidéo est obligatoire.
4. Règle **Messages per episode** et **Keyframes per episode**.
5. Termine une nouvelle réponse de l'assistant, ou ouvre le panneau **Gallery** et choisis **Create storyboard**.

Sur un storyboard à plusieurs images-clés, les flèches permettent de passer d'une image à l'autre. Une image animée affiche son clip au fil du chat, et se rabat sur l'image fixe tant que le clip est en attente ou indisponible.

### Le fonctionnement de l'intervalle d'épisode

L'intervalle règle le nombre de nouveaux messages utilisateur et assistant qui s'accumulent entre deux storyboards automatiques réussis. Les deux rôles font avancer l'intervalle, et l'épisode reprend les nouveaux messages dans l'ordre chronologique.

La valeur par défaut est 1 : la prochaine réponse de l'assistant terminée peut donc déclencher un épisode aussitôt. Une valeur plus élevée laisse les dialogues et l'action s'accumuler. La source est limitée aux 20 derniers messages et à 12 000 caractères. Un chat ancien ou très long ne peut donc pas produire une requête de planification sans limite.

Le point de repère de la cadence n'avance qu'une fois un storyboard complet ou partiel enregistré. Un épisode en échec ne consomme pas la matière source. Ouvrir un chat existant ne rattrape pas les anciennes réponses : la génération automatique attend une nouvelle réponse de l'assistant terminée.

### La chaîne de prompts en Roleplay

En Roleplay, quatre couches de planification interviennent avant les formateurs partagés des fournisseurs :

1. **Episode contract** sélectionne les moments d'histoire terminés et appuyés par le texte source, puis les rattache aux messages fournis.
2. **Visual style** choisit le traitement Normal/Anime, NovelAI, Comic, Colored Manga ou B&W Manga.
3. **Animation addon** n'intervient que pour les storyboards animés. Il décrit une action réalisable, le comportement de la caméra, les dialogues et sons appuyés par le texte source, l'ambiance et une pause finale.
4. **Output contract** définit le résultat structuré d'images-clés que renvoie le planificateur.

Le **Storyboard Illustration Prompt** met ensuite en forme chaque première image planifiée pour le fournisseur d'images. Quand les clips sont activés, le **Storyboard Video Prompt** met en forme le plan de mouvement pour le fournisseur de vidéos.

La bibliothèque de prompts Roleplay est distincte de la bibliothèque de planificateurs du Game Mode. Modifier un style visuel de Roleplay ne touche pas aux planificateurs fixes ou d'animation du Game Mode.

### Storyboard et Illustrator ensemble

Storyboard et **Illustrator** sont deux agents distincts. Les actions manuelles d'Illustrator et ses autres médias restent accessibles. Quand le storyboard de Roleplay est réglé sur **Still images** ou **Animations**, Marinara supprime l'image d'avant-plan automatique habituelle d'Illustrator pour cette réponse terminée. Les deux agents évitent ainsi de produire des médias concurrents après la réponse. Avec **Manual only**, le fonctionnement normal d'Illustrator ne change pas.

## Les storyboards en Game Mode

En Game Mode, le storyboard part d'un seul tour de narration GM terminé. Marinara retire les balises de commande GM cachées, planifie des images ordonnées et rattache chaque image à une plage de sections lisibles du tour. La visionneuse change d'image à mesure que la lecture avance dans ces sections.

### Démarrage rapide

1. Installe **Storyboard**.
2. Crée ou ouvre un chat en Game Mode.
3. Ouvre **Chat Settings > Agents**, active **Enable Agents**, puis **Enable Storyboards**.
4. Vérifie que la partie dispose d'une connexion d'image, ou que la configuration globale de Storyboard en fournit une.
5. Termine un tour de narration GM.
6. Ouvre le panneau **Gallery** et choisis **Create storyboard**.

Pour rouvrir une visionneuse de jeu que tu as fermée, choisis **View storyboard** (voir le storyboard) dans le panneau **Gallery**. La génération manuelle suit le réglage d'animation en cours : si **Automatic Storyboard Animations** est activé, le storyboard manuel demande aussi les clips.

### Les storyboards automatiques en Game Mode

Le bloc **Storyboard** propose deux interrupteurs d'automatisation :

- **Automatic Storyboard Illustrations** crée des images-clés fixes après un tour GM terminé.
- **Automatic Storyboard Animations** ajoute en plus un clip par image-clé. Activer les animations active les illustrations ; désactiver les illustrations désactive les animations.

La génération automatique ne se lance que si l'agent Storyboard est actif pour cette partie. Marinara ne recrée pas non plus un storyboard pour un tour qui en possède déjà un. Passe par l'action manuelle du panneau **Gallery** quand tu veux volontairement un autre storyboard pour le dernier tour.

Si l'option **Expose image prompts before sending** est activée dans les réglages **Generation**, un storyboard de jeu créé à la main affiche les prompts d'image compilés pour relecture. Les storyboards automatiques se poursuivent sans fenêtre de relecture, pour ne pas interrompre la partie.

### Réglages du Game Mode

Ouvre **Chat Settings > Agents > Storyboards**.

| Réglage | Valeur par défaut de l'agent | Ce que ça règle |
| --- | --- | --- |
| **Enable Storyboards** | Off, chat par chat | Active l'agent installé pour cette partie |
| **Automatic Storyboard Illustrations** | Dérivé du réglage **Automatic generation** | Images-clés fixes après chaque tour GM terminé |
| **Automatic Storyboard Animations** | Dérivé du réglage **Automatic generation** | Clips MP4 pour chaque image-clé |
| **Keyframes per Turn** | 3, de 1 à 6 | Nombre d'images visé ; un tour court en donne parfois moins |
| **Animation Clip Duration** | 5 secondes, de 1 à 15 | Durée demandée pour chaque clip ; un fournisseur peut la réduire |
| **Viewer Display** | Floating | Visionneuse déplaçable ou arrière-plan de jeu plein écran |
| **Still Planner** | Still Keyframes | Planifie des illustrations fixes abouties |
| **Animation Planner** | Comic Page Animation | Planifie des premières images prêtes pour l'animation et des indications de mouvement |
| **Use Storyboard Template** | On | Applique le formateur d'illustration final sélectionné |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Met en forme l'image planifiée pour le fournisseur d'images |
| **Storyboard Video Prompt** | Cinematic Scene Video | Met en forme la première image et le plan de mouvement pour le fournisseur de vidéos |

Le package fournit aussi des planificateurs NovelAI, BD, manga, anime et orientés LTX. Choisir un planificateur d'animation n'active pas la génération de vidéos pour autant : **Automatic Storyboard Animations** et une connexion vidéo restent indispensables.

### La chaîne de prompts en Game Mode

Le Game Mode conserve des planificateurs distincts pour les résultats fixes et animés :

```text
completed GM narration
  -> Still Planner or Animation Planner
  -> Storyboard Illustration Prompt
  -> image connection
  -> optional Storyboard Video Prompt
  -> video connection
```

Le planificateur choisit les moments d'histoire et les met en ordre. Le prompt d'illustration met en forme le résultat pour le fournisseur ; ce n'est pas un second planificateur d'histoire. Quand les animations sont activées, le planificateur d'animation produit à la fois une description exacte de la première image et une indication de mouvement. Le prompt vidéo transforme ensuite cette indication en requête finale.

### Recettes revues pour le Game Mode

Chaque recette associe une chaîne Storyboard appliquée par le package aux autres réglages de la partie et du fournisseur. Applique la chaîne nommée si le package la propose, ou reproduis les sélections listées à la main.

#### Storyboards BD avec Google

Chaîne appliquée par le package :

- **Illustration Planner** : Still Keyframes
- **Animation Planner** : Comic Page Animation
- **Storyboard Illustration Prompt** : Game Scene Illustration
- **Storyboard Video Prompt** : Comic Page Video
- **Use Storyboard Template** : On

Liste de vérification côté partie :

- **Visual Generation** : On
- **Image Connection** : Google/Nano Banana
- **Image Style** : Default
- Garde le style artistique généré à la configuration.
- **Automatic Storyboard Illustrations** : On
- **Automatic Storyboard Animations** : Off
- **Keyframes per Turn** : 3
- **Video Connection** : None

Tu obtiens ainsi des storyboards fixes ordinaires. La chaîne d'animation Comic Page enregistrée ne s'active que si tu choisis plus tard une connexion vidéo et que tu actives **Automatic Storyboard Animations**.

#### Tags NovelAI directs

Chaîne appliquée par le package :

- **Illustration Planner** : NovelAI Keyframes
- **Storyboard Illustration Prompt** : crée une option personnalisée dont le prompt contient uniquement :

  ```text
  ${scenePrompt}
  ```

- **Use Storyboard Template** : On
- Laisse les sélecteurs Animation Planner et Storyboard Video Prompt inchangés.

Liste de vérification côté partie :

- **Image Style** : Danbooru
- **Use Campaign Art Style** : Off
- **Attach Card Appearance** : Off
- **Send Avatar References** : Off
- **Use NovelAI Character Prompts** : Off
- **Queue media generation requests** : On
- Retire le texte en prose du champ **Style Text** dans le profil Danbooru.
- Ajuste au besoin les tags positifs, négatifs et d'illustration.

Ce gabarit de transmission directe envoie les tags NovelAI compacts du planificateur, sans les envelopper dans le formateur d'illustration en prose habituel.

#### Krea 2 en local + LTX 2.3

Chaîne appliquée par le package :

- **Illustration Planner** : Still Keyframes, en repli pour les images fixes seules
- **Animation Planner** : LTX Simple Image-to-Video
- **Storyboard Illustration Prompt** : Storyboard First Frame
- **Storyboard Video Prompt** : Narration Passthrough
- **Use Storyboard Template** : On

Avec un GPU doté de 8 Go de VRAM, commence par une seule image-clé en 480p. Une fois ce premier essai réussi, passe à trois images-clés et à des résolutions supérieures. Voir [Storyboards LTX 2.3 dans Game Mode](ltx-2-3-storyboards.md) pour la connexion ComfyUI, les placeholders et la procédure de test complète.

### La présentation Storyboard Optimized n'est pas l'interrupteur de l'agent

Dans l'assistant de configuration de la partie, la présentation **Storyboard Optimized** modifie le prompt de narration du GM pour que les tours contiennent des repères visuels plus filmables. Elle n'installe pas Storyboard, ne l'active pas, ne déclenche aucun média automatique et ne choisit aucune connexion d'image ou de vidéo.

L'agent Storyboard fonctionne aussi bien avec la présentation Standard qu'avec la présentation Storyboard Optimized. Installe et active l'agent séparément.

### La visionneuse du jeu

**Floating viewer** (visionneuse flottante) est un panneau déplaçable et redimensionnable posé au-dessus du jeu. Il suit ta position de lecture dans la narration du GM et affiche l'image correspondante. La vidéo se lit dès qu'elle est prête ; sinon, c'est l'image fixe qui s'affiche.

**Game background** (arrière-plan du jeu) place l'image active derrière les commandes du jeu. Tant que ce mode est actif, il remplace l'arrière-plan de scène généré habituel, et l'action **Generate background** reste indisponible. Les clips d'arrière-plan se lisent une seule fois et restent figés sur leur dernière image ; les commandes du jeu proposent la relecture, la lecture/pause et la coupure du son.

Fermer la visionneuse flottante la masque pour le tour en cours. Pour la rouvrir, passe par **Gallery > View storyboard**.

## Les prompts d'image et la cohérence des personnages

Le planificateur sélectionné et le prompt d'image final ne font pas le même travail :

- Le planificateur décide des moments à montrer et rédige le contenu visuel de chaque image.
- Le gabarit d'image final ajoute la structure attendue par le fournisseur. Il y joint l'apparence des personnages reconnus, la gestion des références, le contexte du lieu, la direction artistique de la campagne et les instructions d'image.

Quand un planificateur renvoie déjà la syntaxe de prompt exacte attendue par le fournisseur d'images, utilise un gabarit de transmission directe comme `${scenePrompt}`. Ne désactive **Use the final image template** que si tu veux vraiment contourner le formateur sélectionné. Les instructions d'image obligatoires restent appliquées.

Pour des personnages plus stables :

- Garde les champs **Appearance** des fiches de personnage précis et à jour.
- Laisse **Attach Card Appearance** activé, sauf si le planificateur sélectionné répète déjà tous les détails d'apparence utiles.
- Laisse **Send Avatar References** activé quand le fournisseur accepte les références et que les avatars correspondent au rendu voulu.
- Limite le nombre de personnages bien visibles par image. Storyboard ne joint que les références des personnages et des personas (les personnages que tu incarnes) visibles et reconnus, et non tous les personnages du chat.

L'option **Use NovelAI character prompts** ne modifie que les requêtes envoyées via les connexions officielles NovelAI V4/V4.5 prises en charge. Les autres fournisseurs passent par le chemin de prompt partagé, même quand l'interrupteur est activé.

## Coût et performances

Chaque image-clé correspond à une tâche d'image distincte. Un storyboard animé ajoute une tâche vidéo par image-clé réussie. Un storyboard animé de trois images lance donc trois requêtes d'image et trois requêtes vidéo.

Pour valider un nouveau fournisseur ou un workflow local, commence par des images fixes et une seule image-clé. N'augmente le nombre d'images, la durée des clips et la cadence automatique qu'une fois le fonctionnement de base fiable.

## Les parties créées avec l'ancien système de storyboard

Storyboard est désormais un agent téléchargeable, mais les chats Game existants peuvent encore contenir des réglages définis par l'ancienne interface de storyboard intégrée au moteur. À l'installation du package, Marinara conserve ces valeurs comme remplacements propres au chat, plutôt que de jeter une configuration de partie qui fonctionne.

Une ancienne partie peut donc se comporter autrement que les valeurs par défaut actuelles de l'agent. Ouvre **Chat Settings > Agents > Storyboards** et sers-toi du bouton de réinitialisation de chaque champ pour lui rendre la valeur par défaut de l'agent Storyboard.

Ces anciens réglages sont des données de migration, pas une seconde implémentation de Storyboard. La génération actuelle exige toujours que le package Storyboard soit installé et actif pour la partie.

## Dépannage

### Storyboard n'apparaît pas dans Chat Settings

- Installe **Storyboard** depuis **Agents > Download Agents**.
- Utilise un chat Roleplay ou Game : le mode Conversation n'est pas pris en charge.
- Vérifie que la version du package est compatible avec la version installée du moteur.

### Create storyboard est disponible, mais la génération échoue

- Active **Enable Agents** et **Enable Storyboards** pour le chat.
- Choisis une connexion de génération d'images valide dans le bloc Storyboard du Roleplay, dans les réglages de la partie ou dans la configuration globale de Storyboard.
- Attends la fin de la réponse de l'assistant ou du GM avant de réessayer.

### Le Roleplay n'a pas créé d'épisode automatique

- Choisis **Still images** ou **Animations**, pas **Manual only**.
- Attends une nouvelle réponse de l'assistant terminée. Ouvrir un chat ne rattrape pas les anciens messages.
- Vérifie **Messages per episode**. Assez de nouveaux messages utilisateur et assistant doivent s'accumuler depuis le dernier point de repère réussi.
- Une exécution en échec ne fait pas avancer ce point de repère. Consulte le log du serveur, c'est-à-dire son journal, pour retrouver l'erreur d'origine renvoyée par le fournisseur, ou l'erreur d'analyse.

### Les images apparaissent, mais pas les vidéos

- En Roleplay, choisis **Animations**. En Game Mode, active **Automatic Storyboard Animations**.
- Sélectionne une connexion Video Generation.
- Vérifie que la connexion vidéo accepte une entrée image-vers-vidéo.
- Regarde l'onglet **Videos** du panneau **Gallery**. Un clip se termine parfois après son image-clé.
- Si la planification est passée en repli après un échec du LLM, Marinara peut garder les images de repli et sauter les vidéos pour cette exécution.

### Un storyboard est incomplet ou bloqué

Une ou plusieurs tâches du fournisseur ont sans doute échoué, expiré ou atteint une limite de débit ou de contenu. Si le fournisseur fonctionne bien mais reste lent, augmente les variables `IMAGE_GEN_TIMEOUT_MS` ou `VIDEO_GEN_TIMEOUT_MS` dans le fichier `.env`, puis redémarre Marinara : ces valeurs sont lues au démarrage.

Active le mode Debug et cherche `storyboard` dans le log du serveur pour examiner le planificateur, le prompt d'image compilé, la sélection des références et le prompt vidéo. Les logs de debug peuvent contenir du texte de chat privé et des prompts : nettoie-les avant de les partager.

## Guides associés

- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Game Mode : premiers pas](getting-started.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
- [Fournisseurs de génération d'images et configuration](../media/image-providers.md)
- [Génération de vidéos de scène](../media/scene-video.md)
- [Storyboards LTX 2.3 dans Game Mode](ltx-2-3-storyboards.md)
