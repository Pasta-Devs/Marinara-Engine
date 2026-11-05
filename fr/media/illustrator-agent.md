# Agent Illustrator

L'agent **Illustrator** est un agent téléchargeable qui dessine des images de tes scènes pendant que tu discutes. Ce guide explique comment l'activer, choisir un style graphique et un modèle d'image, et créer des clips. Un agent est un petit assistant IA qui tourne automatiquement pour un chat.

## Ce que fait l'agent Illustrator

L'agent Illustrator est un agent de post-traitement : il s'exécute une fois que l'IA a terminé chaque réponse. Il lit la dernière réponse et juge si le moment mérite une image. Si c'est le cas, il rédige un prompt d'image (le texte qui indique à un modèle d'image ce qu'il doit dessiner) et l'envoie à ton service d'images. Chaque image qu'il crée est enregistrée dans la **Gallery** (galerie) du chat.

Il ne dessine pas à chaque message. Après avoir créé une image, il attend par défaut 5 messages acceptés, les tiens comme ceux de l'assistant, avant de pouvoir en créer une autre. Chaque chat Roleplay peut modifier ce nombre. Faire un swipe (réponse alternative) ou régénérer une réponse ne fait pas avancer le compteur. S'il juge qu'un moment ne mérite pas d'image, il le laisse passer.

Il fonctionne dans les chats Roleplay et Game Mode. Son installation ajoute aussi les selfies et les [messages vidéo](../conversation/selfies.md#video-messages) en Conversation. La configuration décrite dans ce guide concerne Roleplay. Game Mode utilise un seul interrupteur (voir [Game Mode](#game-mode-the-game-illustrator-toggle)).

## Avant de commencer

L'agent Illustrator rédige le prompt, mais c'est un modèle d'image distinct qui dessine l'image. Il t'en faut un. Voir [Fournisseurs de génération d'images et configuration](image-providers.md).

Tu peux lui fournir un modèle d'image de deux façons.

1. Règle la tâche **Images** sous **Defaults** (valeurs par défaut) dans le panneau **Connections** (Connexions).
2. Ou donne à l'agent Illustrator son propre modèle d'image sur son écran **Open Setup** (ouvrir la configuration).

Si aucun modèle d'image n'est trouvé, l'image échoue et l'application te demande d'en choisir un.

## Activer l'agent Illustrator

Avant de commencer : installe **Illustrator** depuis **Agent Organizer** (organisateur d'agents). Voir [Présentation des agents](../agents/agents-overview.md).

1. Ouvre le chat Roleplay que tu veux illustrer.
2. Ouvre **Chat Settings** (réglages du chat) et repère **Agents**.
3. Active **Enable Agents** (activer les agents).
4. Dans le groupe **Misc Agents** (agents divers), repère **Illustrator** et ajoute-le avec le bouton plus.

Une carte **Illustrator** avec ses propres options apparaît. Les agents consomment des tokens supplémentaires et peuvent ajouter des appels au modèle à chaque tour. Les estimations de tokens ne portent que sur les instructions des agents.

<a id="game-mode-the-game-illustrator-toggle"></a>

### Game Mode : l'interrupteur Game Illustrator

Game Mode n'a ni option **Prompt Mode** (mode de prompt) ni option **Prompt Model** (modèle de rédaction du prompt). Ouvre les **Chat Settings** de la partie et active **Game Illustrator** ("Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay").

## Choisir un style graphique

Le sélecteur **Prompt Mode** (libellé **Prompt** sur la carte) définit le style graphique de chaque prompt que l'agent Illustrator rédige. Un nouvel agent Illustrator démarre sur **Background**.

| Style | Ce qu'il dessine |
| --- | --- |
| **Illustration** | Une image de scène unique et soignée. Le style généraliste. |
| **Comic Page** | Une page de bande dessinée avec cases, bulles de dialogue, cartouches et onomatopées. |
| **Colored Manga** | Une scène de manga en couleur, avec bulles stylisées et onomatopées. |
| **B&W Manga** | Une page de manga en noir et blanc, au trait encré et aux ombres en trames. |
| **Background** | Un lieu ou un plan d'ambiance, sans personnage. |
| **Selfie** | Un selfie dans la peau du personnage, ou un portrait pris sur le vif. |

Le rendu final dépend aussi de ton profil de style. Voir [Profils de style d'image](style-profiles.md).

## Choisir le modèle de rédaction du prompt

Le **Prompt Model** est le modèle de texte qui écrit le prompt d'image. Il ne dessine pas. Choisis-le dans la liste **Prompt Model** de la carte. La valeur par défaut est **Main chat model** (modèle principal du chat), qui réutilise le modèle de ton chat. Choisis un autre modèle de texte si tu veux que ce soit un autre modèle qui rédige les prompts.

Le modèle d'image qui dessine l'image est celui que tu as défini dans **Avant de commencer**.

## Garder des personnages cohérents

Deux réglages de la carte aident les personnages à garder la même apparence d'une image à l'autre. Les deux sont désactivés au départ.

**Attach Card Appearance** (joindre l'apparence de la fiche) ajoute au prompt d'image le texte d'apparence enregistré de chaque personnage visible. Dans un chat Roleplay, c'est une liste à quatre choix.

- **Off** (désactivé)
- **Images only** (images seulement), le comportement habituel.
- **Videos only** (vidéos seulement) : un clip reçoit le texte d'apparence des personnages qu'il montre. C'est surtout utile pour un clip **Prompt only**, qui n'a pas d'image.
- **Images and videos** (images et vidéos) : les deux.

Quand il est activé, une fiche ou un persona dont **Image Appearance Override** (apparence propre aux images) est activé envoie ce remplacement à la place de son texte **Appearance** (apparence). Utilise-le quand **Appearance** est écrit pour le narrateur mais convient mal à un modèle d'image. Garde la description complète dans **Appearance** et mets une version plus courte, sous forme de tags, dans le remplacement. Si le remplacement est désactivé ou vide, les prompts d'image utilisent **Appearance**. Le narrateur voit toujours **Appearance** en entier. L'interrupteur se trouve sous **Appearance** dans les éditeurs de personnage et de persona.

**Send Avatar References** (envoyer les avatars en référence) envoie au service d'images les avatars des personnages et des personas, ou leurs sprites, comme images de référence, pour que le modèle puisse reprendre un visage ou une tenue. Tous les services ne les acceptent pas. Dans un chat Roleplay, c'est une liste comme **Attach Card Appearance**. Si les vidéos sont incluses, un clip dont **First frame** (première image) vaut **Prompt only** part de l'avatar ou du sprite du personnage, et le choix s'affiche comme **Prompt only (avatar from Send Avatar References)**.

## Contrôler la fréquence des images

La carte Illustrator a un bouton **Open Setup** qui ouvre l'écran de configuration complet. Tu y règles l'intervalle d'exécution par défaut et tu donnes à l'agent son propre modèle d'image.

Chaque chat Roleplay a son propre **Image Run Interval** (intervalle des images) sur la carte, dans **Chat Settings** ("Messages between automatic images in this chat. 0 means only when you ask."). Un chat sans valeur définie utilise celle de l'écran de configuration, **5** par défaut. La carte affiche **Using agent default** ou **Chat override**. Appuie sur **Use agent default** (utiliser la valeur par défaut de l'agent) pour y revenir. Quand tu ajoutes l'agent Illustrator à un chat, la fenêtre d'ajout affiche le même champ et l'enregistre pour ce chat uniquement.

Règle **Image Run Interval** sur **0** pour passer en mode manuel uniquement. Cela arrête les exécutions automatiques, y compris les arrière-plans de scène automatiques, mais garde l'agent disponible pour les actions de la Gallery. Indique un nombre positif pour reprendre.

Pour créer une image tout de suite, ouvre **Chat Settings**, déplie **Gallery** et clique sur **Illustrate** (illustrer). L'agent Illustrator s'exécute une fois, sur-le-champ, et le bouton affiche **Generating...**.

## Créer des clips

Dans un chat Roleplay, **Chat Settings → Agents → Illustrator** (réglages du chat → Agents → Illustrator) propose un réglage **Illustrator makes** (ce que crée Illustrator).

- **Pictures** (par défaut) : des images seulement.
- **Pictures and clips** : Illustrator peut aussi transformer une nouvelle image en court clip quand le mouvement fait tout l'intérêt du moment, par exemple une scène d'action, une poursuite ou un objet qui se brise. Cela comprend les images que le narrateur demande avec `[illustrate]`. Il décrit lui-même le mouvement, en suivant les **Video prompting instructions** (instructions de prompt vidéo) du modèle vidéo. L'image s'affiche d'abord, puis le clip rejoint le même message lorsqu'il est prêt.
- **Clips only** : partout où Illustrator afficherait une image, il affiche un court clip. L'image qu'il dessine devient l'image de départ du clip et va dans la Gallery, pas dans la réponse. Si le clip échoue, l'image s'affiche.

Les clips utilisent le modèle vidéo défini sous **Scene Videos** (vidéos de scène), et chaque clip représente une requête vidéo. Sans modèle vidéo fonctionnel, Illustrator crée des images, même avec **Clips only**. Les agents personnalisés qui créent des images suivent le même réglage. Voir [Génération de vidéos de scène](scene-video.md).

**Video Run Interval** (intervalle des vidéos) apparaît dès qu'Illustrator crée des clips. C'est le nombre de messages, les tiens comme ceux de l'assistant, qui doivent passer après un clip avant le suivant. Il est distinct de **Image Run Interval**.

- Avec **Clips only**, chaque exécution produit un clip, **Video Run Interval** fixe la fréquence d'exécution d'Illustrator, et **Image Run Interval** est masqué.
- Un chat sans valeur utilise la valeur **Video Run Interval** de l'écran **Open Setup**, ou 5.
- **0** : Illustrator ne crée aucun clip de lui-même, y compris pour les images demandées avec `[illustrate]`, qui reçoivent leur image à la place.
- Une réponse reçoit au plus le nombre de clips fixé par **Videos per reply** (vidéos par réponse), sous **Settings → Generations → Video Generation** (Paramètres → Générations → Génération de vidéos).
- Tu peux toujours animer une image depuis la Gallery. Avec **Clips only**, le bouton **Illustrate** d'un message crée un clip.
- Un swipe d'une réponse qui a reçu un clip compte comme une nouvelle réponse et peut recevoir son propre clip. Le swipe précédent garde son clip.

**First frame**, dans la même section, détermine le point de départ de chaque clip Roleplay : les clips d'Illustrator, `/video` et le bouton **Video** de la Gallery. Les choix sont une nouvelle image d'Illustrator, l'avatar ou le sprite du personnage nommé, l'image avec l'avatar comme solution de repli, ou aucune image. Les messages vidéo de Conversation utilisent le même réglage.

- **Clips only** avec l'avatar ou sans image : aucune image n'est dessinée. Le clip est créé à partir de la scène et du mouvement décrits par Illustrator.
- **Pictures and clips** : l'image s'affiche toujours, et seul le clip part de l'avatar ou de rien.
- Aucune première image choisie : un clip ne fait jamais dessiner une image rien que pour lui. **Pictures and clips** anime l'image qu'Illustrator vient de créer. **Clips only**, `/video` et **Video** créent le clip à partir de la scène seule.

Un clip sans image propre décrit toutes les personnes qu'il nomme, y compris ton persona. L'avatar de départ est celui de la première personne nommée.

Relancer Illustrator depuis le bouton **Illustrate** d'un message suit aussi **Illustrator makes** et **First frame**.

## Plusieurs personnages avec NovelAI

Quand le modèle d'image de l'agent Illustrator est NovelAI avec un modèle V4, V4.5 ou V5, le modèle qui rédige le prompt ajoute une description de personnage pour chaque personnage visible. Chaque description contient l'apparence, l'expression, la pose et la position approximative du personnage dans l'image. Marinara compare les descriptions à la liste des personnages de la scène, écarte celles qu'il ne peut pas associer et envoie les autres à NovelAI comme prompts de personnage natifs, à côté du prompt principal. Cela évite que les cheveux, les vêtements et les autres traits se mélangent entre les personnages. Les images issues du bouton **Illustrate** et de la commande `[illustrate]` d'un personnage reçoivent les mêmes descriptions.

V5 accepte jusqu'à 22 personnages. V4 et V4.5 en acceptent jusqu'à 6. S'il y a davantage de personnages visibles, les plus importants sont conservés et les autres deviennent des figurants anonymes à l'arrière-plan.

Les traits fixes viennent du champ **Appearance**. S'il contient déjà des tags Danbooru, ils sont copiés tels quels. S'il est rédigé en prose, le modèle qui rédige le prompt le convertit en tags. Les vêtements viennent de la tenue actuelle du tracker de personnages quand celui-ci tourne, convertie elle aussi en tags.

Avec **Attach Card Appearance** activé, ce modèle reçoit aussi le texte Appearance complet de chaque fiche et de chaque persona du chat, pour que les fiches longues ou regroupant plusieurs personnages ne soient pas tronquées. Les fiches de groupe qui décrivent plusieurs personnages sous la forme `[NAME] tags | [NAME] tags` sont listées personnage par personnage. Le modèle copie les traits fixes dans la description correspondante, considère les tags de vêtements de la fiche comme une valeur par défaut que le tracker ou la scène remplace, et ignore les personnages absents de la scène. Quand des descriptions reviennent, Marinara n'ajoute rien de plus. Sans description, c'est-à-dire dans le cas d'un seul personnage, la ligne d'apparence habituelle est ajoutée au prompt principal comme avant.

Aucun réglage n'est nécessaire. Les descriptions n'apparaissent qu'avec NovelAI sur son propre serveur : un proxy ou un autre service n'est donc pas concerné. Avec **Expose media prompts before sending** (afficher les prompts médias avant l'envoi) activé, la fenêtre de vérification liste les descriptions sous le prompt principal, en lecture seule. Modifie le prompt principal comme d'habitude.

## Enregistrement dans les galeries et inspection du prompt

Dans **Settings → Generations → Image Generation** (Paramètres → Générations → Génération d'images), **Automatically save generated images to character galleries** (enregistrer automatiquement les images générées dans les galeries des personnages) est activé par défaut. Désactive-le pour ne plus ajouter les illustrations et les selfies du chat aux galeries des personnages et des personas représentés. Les images apparaissent toujours dans le chat et dans sa Gallery, et les enregistrements explicites dans une galerie fonctionnent toujours. Les entrées existantes ne changent pas. Les galeries partagent les fichiers d'images : ce réglage contrôle leur présence dans les galeries, pas leur suppression.

Pour les nouvelles illustrations NovelAI, l'inspecteur d'image affiche le prompt de scène et de style, suivi des descriptions positives des personnages, séparés par ` | `. Le prompt enregistré dans la galerie est le même.

Pour redessiner une illustration avec un prompt modifié, sans régénérer la réponse, ouvre-la et utilise **Regenerate image** (régénérer l'image). Voir [Régénérer une image](scene-backgrounds.md#regenerating-an-image).

Pour illustrer un ancien message Roleplay ou une plage de messages, utilise `/illustrate range=12` ou `/illustrate range=12-18`. Voir [Commandes slash](../chats/slash-commands.md).

## Guides associés

- [Fournisseurs de génération d'images et configuration](image-providers.md)
- [Profils de style d'image](style-profiles.md)
- [Arrière-plans de scène et galerie](scene-backgrounds.md)
- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
