# Avatars 2D et 3D

Deux agents téléchargeables donnent aux personnages et aux personas (les personnages que tu incarnes) un avatar animé qui réagit pendant qu'une réponse s'affiche. **2D Avatars** (avatars 2D) affiche des sprites façon PNGTuber ou des avatars mesh. **3D Avatars** (avatars 3D) affiche des modèles VRM, MMD PMX, GLB et FBX. Un sprite est l'image du personnage sur le plateau ; un avatar mesh est un modèle 2D souple, posé sur un maillage. Les visages suivent la réponse, et les bouches bougent avec le texte ou avec la synthèse vocale.

Les modèles Live2D ne sont pas pris en charge. La licence de Live2D exige un accord séparé, même pour les applications open source gratuites, et son runtime ne peut pas être livré avec Marinara Engine.

## Installer les agents d'avatar

Les deux agents sont dans **Agent Organizer** (organisateur d'agents) pour toutes les installations, sous les filtres **Roleplay** et **Game**. Ils nécessitent Marinara Engine 2.5.1 ou une version ultérieure. Une version plus ancienne refuse de les installer. Ils se téléchargent séparément : n'installe donc que celui que tu veux. Les deux fonctionnent pour les personnages et les personas dans les chats Roleplay et Game, et n'envoient aucune requête supplémentaire à tes modèles d'IA pendant que tu discutes.

1. Ouvre **Agents → Agent Organizer** et installe **2D Avatars**, **3D Avatars** ou les deux. Aucun des deux ne demande de redémarrage.
2. Configure chaque avatar sur la page de l'agent (voir [Configurer un avatar](#set-up-an-avatar)).
3. Dans un chat Roleplay ou Game, ouvre **Chat Settings → Agents → Misc Agents** (réglages du chat → Agents → agents divers) et ajoute l'agent.

Un avatar s'affiche dans un chat Roleplay, Visual Novel ou Game quand les agents sont activés et que l'agent correspondant est ajouté. Il fonctionne avec ou sans l'agent Expression Engine. L'avatar ne masque pas le sprite en pied : désactive-le toi-même si l'avatar le remplace. Les avatars se placent là où serait le sprite en pied et prennent sa taille.

<a id="set-up-an-avatar"></a>

## Configurer un avatar

Ouvre **Agents**, ouvre **2D Avatars** ou **3D Avatars**, puis utilise la section **Avatars** près du haut de la page.

1. Dans **Character or persona** (personnage ou persona), choisis qui reçoit l'avatar. Les noms marqués "(has an avatar)" en ont déjà un.
2. Dans **Avatar type** (type d'avatar), choisis le type. 2D Avatars propose **PNGTuber sprites** (sprites PNGTuber) et **Mesh avatar** (avatar mesh). 3D Avatars propose **VRM model** (modèle VRM), **MMD PMX model** (modèle MMD PMX) et **GLB or FBX model** (modèle GLB ou FBX).
3. Configure-le dans la section de ce type, plus bas : utilise tes sprites ou importe un fichier, choisis le visage de chaque émotion, ou supprime-le.
4. Utilise **Preview** (aperçu) pour le vérifier. **Try a face** (essayer un visage) change d'émotion et **Talk** (parler) fait bouger la bouche. Tant qu'il n'y a rien à montrer, l'aperçu affiche un avatar d'exemple.
5. Active **Show this avatar in chats** (afficher cet avatar dans les chats).

**Show this avatar in chats** active ou désactive un avatar configuré sans le supprimer. Il reste désactivé jusqu'à ce que tu configures un avatar ou des sprites utilisables. Une photo de profil seule ne crée pas d'avatar 2D.

**Movement** (mouvement) a trois interrupteurs pour tous les types : **Lip sync** (synchronisation labiale) fait bouger la bouche, **Blinking** (clignement) fait cligner des yeux toutes les quelques secondes, et **Idle motion** (mouvement au repos) fait respirer et se balancer l'avatar pendant l'attente. Si un personnage a plusieurs types d'avatar, **Show this one** (afficher celui-ci) choisit le type utilisé dans les chats. Quand l'agent de ce type est désactivé dans un chat, le chat affiche un autre type dont l'agent est activé. Supprimer un type efface ses fichiers. Tes sprites restent.

### Redimensionner et déplacer les avatars dans un chat

1. Ouvre **Chat Settings → Agents** et ouvre **Avatars**.
2. Choisis un avatar dans la liste et utilise son curseur de taille.
3. Sélectionne **Arrange** (disposer) pour déplacer les avatars. Fais-les glisser avec la souris ou avec le doigt, ou mets le focus sur l'un d'eux et utilise les touches fléchées (maintiens <kbd>Shift</kbd> pour aller plus loin).
4. Sélectionne **Done** (terminé). Les avatars restent là où tu les as mis, et les clics vont de nouveau au chat. **Reset** (réinitialiser) remet chaque avatar à sa place.

Un avatar 3D a aussi **Framing** (cadrage) : **Portrait** montre la tête et les épaules (par défaut), **Half body** (mi-corps) montre le modèle jusqu'aux hanches, et **Full body** (en pied) montre le modèle entier. L'avatar garde sa taille, et un cadrage plus grand montre une plus grande partie du modèle. Les avatars 2D n'ont pas de cadrage.

La disposition est enregistrée pour ce chat sur cet appareil. Elle ne se synchronise pas avec tes autres appareils. Le bouton **Arrange** propre à l'Expression Engine déplace aussi les avatars.

### Où se trouvent les fichiers d'avatar

Les fichiers importés sont vérifiés avant d'être stockés. La seule limite de taille est la limite de téléversement habituelle du serveur. Les fichiers se trouvent dans le dossier de données, sous `avatar-models/<character or persona>/<id>/`, à côté d'un fichier `avatar.json` qui contient les réglages. Les sauvegardes et les exports de profil incluent ce dossier. Supprimer un personnage ou un persona supprime son avatar, tout comme vider entièrement **Characters** (personnages), **Personas** ou **Media & Assets** (médias et ressources) dans la Danger Zone des réglages. Les exports de fiches de personnage n'incluent jamais les avatars.

### Chats de groupe

Les chats de groupe affichent chaque membre dont l'avatar est enregistré et activé, et dont l'agent est activé, sans limite fixe. En mode **Individual**, le personnage qui répond parle et exprime ses émotions. En mode **Merged (Narrator)**, les balises de locuteur et les dialogues attribués par leur nom dirigent le personnage correspondant. Si les voix sont activées, la synchronisation labiale suit le personnage dont la voix est en cours de lecture.

<a id="2d-avatars-pngtuber-sprites-and-mesh-avatars"></a>

## Avatars 2D : sprites PNGTuber et avatars mesh

**2D Avatars** affiche l'un de deux types d'avatar. Les **sprites PNGTuber** sont des images plates qui changent de visage, ouvrent la bouche et clignent des yeux. Les **avatars mesh** sont des dessins qui bougent la tête, les yeux et la bouche en douceur. Configure les deux sur la page de l'agent, après avoir choisi un personnage ou un persona.

<a id="pngtuber-sprites"></a>

### Sprites PNGTuber

Un personnage ou un persona qui a des sprites d'expression peut les utiliser comme avatar PNGTuber, avec ses sprites comme visages. Les sprites de portrait sont utilisés s'il y en a, sinon ceux en pied : un avatar ne mélange donc jamais les deux. Prévisualise-les, puis active **Show this avatar in chats** ou enregistre-les avec **Use my sprites** (utiliser mes sprites).

- **Images pour parler et cligner des yeux.** Ajoute des sprites qui portent le nom d'un visage suivi de `_talk` pour la bouche ouverte et de `_blink` pour les yeux fermés, par exemple `happy_talk`, `happy_blink` et `happy_blink_talk` pour les deux. `_talking`, `_speak`, `_mouth_open`, `_blinking` et `_eyes_closed` fonctionnent aussi. Un visage qui n'en a pas sautille quand même en parlant.
- **Visage pour chaque émotion.** Choisis le visage affiché pour Neutral, Happy, Angry, Sad, Relaxed et Surprised (neutre, joyeux, en colère, triste, détendu et surpris). **Resting face** (visage au repos) utilise le visage Neutral. Tous les sprites sont proposés, y compris ceux ajoutés plus tard, jusqu'à 64 visages. Un import PNGTuber Plus ne propose que ses propres visages. Quand l'Expression Engine ou le Game Master (GM, le maître du jeu) choisit un sprite que tu as, c'est exactement ce visage qui s'affiche.
- **Plus d'émotions.** Sous **Face for each feeling** (visage pour chaque émotion), ouvre **More feelings** (plus d'émotions) pour choisir un visage pour 23 émotions plus précises, regroupées sous les six (tableau ci-dessous). Chacune utilise le visage de son émotion principale tant que tu n'en choisis pas un autre. Un sprite qui porte le nom de l'une d'elles, comme `fear`, `amusement` ou un mot comme `scared` ou `laughing`, est utilisé pour elle sans configuration.
- **Mouvement.** **Hop while talking** (sautiller en parlant) et **Hop height** (hauteur du saut) règlent le rebond. **Time between blinks** (temps entre deux clignements) est la moyenne. Chaque clignement arrive un peu plus tôt ou un peu plus tard. Si la réduction des animations est activée sur ton appareil, l'avatar ne sautille pas et ne respire pas, mais son visage et sa bouche changent toujours.
- **Les sprites s'affichent tels quels.** Un sprite dessiné sur un fond s'affiche avec ce fond, et tes fichiers ne sont jamais modifiés. Pour des visages sans fond, utilise [Visages tirés de l'avatar](#faces-from-the-avatar).
- **Use my sprites** enregistre les sprites comme visages. Choisir un visage ou modifier le mouvement enregistre aussi. **Update from sprites** (mettre à jour depuis les sprites) récupère les sprites ajoutés plus tard et garde les visages que tu as choisis. Après un import, choisis **Remove** (supprimer) pour revenir à tes sprites.

| Plus d'émotions, regroupées sous | Émotions |
| --- | --- |
| Neutral | Curiosity |
| Happy | Admiration, Amusement, Desire, Embarrassment, Excitement, Gratitude, Optimism, Pride |
| Angry | Annoyance, Disapproval, Disgust |
| Sad | Disappointment, Grief, Nervousness, Remorse |
| Relaxed | Approval, Caring, Love, Relief |
| Surprised | Confusion, Fear, Realization |

**Import PNGTuber Plus save** (importer une sauvegarde PNGTuber Plus) lit un avatar enregistré par [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) (un fichier `.save`). Chaque costume devient un visage, et ses calques de parole et de clignement deviennent les images pour parler et cligner des yeux. Les costumes sont associés aux émotions d'après le nom des images, comme `angry eyes.png`. Choisis un visage pour chaque émotion que les noms n'ont pas couverte. Certains éléments ne sont pas repris :

- L'oscillation (wobble), le traînage (drag), la rotation et l'étirement (stretch) ne sont pas importés. L'avatar affiche chaque calque au repos.
- Les calques animés n'affichent que leur première image.
- Les très anciennes sauvegardes ne gardent que le chemin des images sur l'ordinateur de leur auteur. Enregistre-les d'abord de nouveau dans une version plus récente de PNGTuber Plus.
- Un très grand avatar est réduit à 2048 pixels, pour que les téléphones puissent garder toutes les images.

Importer une sauvegarde demande un traitement d'image sur le serveur. Certaines installations Android (Termux) n'en disposent pas, et l'import y est refusé avec un message.

### Avatars mesh

Un avatar mesh est un fichier `.mavatar`. Marinara peut en créer un à partir d'un sprite (voir [Avatar mesh](#mesh-avatar)), ou tu peux en créer un avec [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (voir [Mesh Avatar Studio](#mesh-avatar-studio)). Choisis **Import .mavatar file** (importer un fichier .mavatar) pour en ajouter un, ou **Replace file** (remplacer le fichier) pour le changer. Avec le mouvement au repos activé, l'avatar respire et regarde autour de lui tout seul. Il cligne des yeux, et sa bouche suit la réponse. Les formes de bouche dessinées dans le fichier sont utilisées. Sinon, des formes simples sont dessinées.

Sous **Look for each feeling** (apparence pour chaque émotion), choisis ce que montre chaque émotion : l'une des six émotions, ou **Smile** (sourire), **Shy** (timide), **Half-closed eyes** (yeux mi-clos) ou **Wink** (clin d'œil).

Chaque fichier est vérifié à l'import. Un fichier endommagé, un fichier trop détaillé pour s'animer de façon fluide ou un fichier qui dépasse la limite de téléversement une fois décompressé est refusé avec une courte explication. Seules les parties dont l'avatar a besoin sont conservées : l'illustration d'origine contenue dans le fichier n'est donc pas stockée. L'illustration appartient à son créateur : vérifie donc sa licence avant de la partager.

Les avatars mesh ont besoin de WebGL2, que les navigateurs actuels prennent en charge. Sans WebGL2, ou quand le navigateur arrête les graphismes pour économiser de la mémoire, l'avatar affiche à la place ta configuration PNGTuber ou tes sprites.

<a id="3d-avatars-vrm-models"></a>

## Avatars 3D : modèles VRM

**3D Avatars** affiche des modèles VRM, le format qu'exportent VRoid Studio, le VRM Add-on for Blender et UniVRM pour Unity. Les fichiers VRM 1.0 et 0.x fonctionnent tous les deux. Si tu n'as pas encore de modèle, [crées-en un dans VRoid Studio](#get-a-3d-model), une application gratuite.

1. Ouvre **3D Avatars** et choisis le personnage ou le persona.
2. Sous **VRM model**, sélectionne **Import VRM** (importer un VRM) et choisis un fichier `.vrm`.
3. Lis **The author's terms** (les conditions de l'auteur). Elles viennent du fichier du modèle et indiquent qui peut l'utiliser comme avatar, si l'usage commercial, les modifications et le contenu sexuel ou très violent sont autorisés et, pour VRM 1.0, si tu dois créditer l'auteur et si tu peux partager le fichier. Ouvre aussi tout lien de licence présent dans le fichier. Marinara affiche ces conditions mais ne les fait pas appliquer : respecte-les toi-même.
4. Sous **Faces and mouth shapes** (visages et formes de bouche), vérifie quelle expression du modèle affiche chaque visage (Neutral, Happy, Angry, Sad, Relaxed, Surprised), chaque forme de bouche (A, I, U, E, O) et le clignement. **Set by the model** (défini par le modèle) signifie que le modèle a l'expression VRM standard. **Guessed from its name** (deviné d'après son nom) signifie que l'une de ses propres expressions porte un nom correspondant. Une expression vide ne change rien : elle n'est donc attribuée qu'à Neutral. Choisis une autre expression, ou **None** (aucune), quand une supposition te semble fausse.
5. Facultatif : sous **Idle animation** (animation au repos), ajoute un fichier `.vrma` que le modèle joue pendant l'attente. Sans lui, il respire et se balance doucement.

**Replace model** (remplacer le modèle) garde l'animation au repos, puisque les animations VRM s'adaptent à n'importe quel modèle VRM. **Remove model** (supprimer le modèle) supprime les deux.

Pendant un chat, le modèle te regarde, cligne des yeux tout seul quand il a une expression de clignement, et penche la tête pendant qu'il réfléchit ou écoute. Certains modèles VRM 1.0 gardent la bouche immobile pendant qu'ils affichent un visage. Quand un tel modèle parle, ce visage s'affiche à intensité partielle pour que la bouche puisse bouger. Avec la réduction des animations activée, les visages et la bouche changent toujours, mais le modèle cesse de se balancer, de respirer et de jouer son animation au repos.

Si ça n'a pas fonctionné, l'import indique pourquoi. Les causes habituelles :

- **Modèles compressés.** La compression Draco ou meshopt, ou les textures KTX2, ne se chargent pas. Exporte de nouveau avec la compression désactivée.
- **Modèles 3D simples.** Un `.glb` ou `.gltf` sans données VRM n'a ni expressions ni squelette humanoïde. Importe un `.glb` doté d'un squelette d'animation comme **GLB or FBX model** (voir [Avatars GLB et FBX](#glb-and-fbx-avatars-rigged-models)), ou convertis-le en VRM (voir [Blender](#blender-with-the-vrm-add-on-for-blender)).
- **Modèles incomplets.** Un modèle auquel manquent des os dont VRM a besoin, ou qui renvoie à des parties absentes du fichier ou à des fichiers extérieurs, est refusé.

Les gros modèles mettent plus de temps à charger, surtout sur téléphone.

<a id="mmd-avatars-pmx-models-and-vmd-motions"></a>

## Avatars MMD : modèles PMX et animations VMD

1. Sur la page **3D Avatars**, choisis **MMD PMX model** sous **Avatar type**.
2. Sélectionne **Import PMX or ZIP** (importer un fichier PMX ou ZIP). Choisis une archive ZIP contenant un seul modèle PMX et ses images. Garde les dossiers et les noms de fichiers du modèle, y compris les noms japonais. Un modèle qui n'a pas besoin d'images peut être un fichier `.pmx` seul.
3. Sous **Faces and mouth shapes**, choisis le visage pour chaque émotion, forme de bouche et clignement. Les noms anglais et japonais courants sont reconnus pour toi. Vérifie l'aperçu et corrige les mauvaises suppositions. Un modèle sans visages adaptés peut quand même s'afficher et bouger le corps.
4. Facultatif : sous **VMD motion** (animation VMD), ajoute un fichier `.vmd` conçu pour ce modèle. Il est joué quand **Idle motion** est activé, et les visages que tu as choisis suivent toujours le chat. Sans VMD, le modèle se balance doucement.

Les images manquantes, les chemins dangereux et les fichiers endommagés sont refusés avant de remplacer ton modèle enregistré. La configuration affiche les 256 premiers noms d'expression et t'avertit s'il y en a davantage. Remplacer un PMX supprime son ancien VMD : ajoute donc une animation pour le nouveau modèle. Supprimer un modèle MMD efface ses images et son animation, et laisse les autres types d'avatar. La réduction des animations arrête l'animation, mais conserve les visages et la synchronisation labiale.

Pris en charge : les modèles PMX 2.0 et PMX 2.1 compatibles, avec des images PNG, JPEG, BMP et TGA, y compris `.sph` et `.spa`. Certaines fonctions récentes de PMX 2.1 ne sont pas prises en charge, et l'import indique pourquoi. Les modèles PMD, les poses VPD et les animations de caméra ou d'éclairage ne sont pas pris en charge. La physique n'est pas simulée : les cheveux et les vêtements peuvent donc différer de MikuMikuDance. Les modèles ayant plus de 256 chemins d'image, des chemins très longs, des images trop gourmandes en mémoire ou des structures d'animation trop complexes sont refusés. Teste ton modèle, surtout sur téléphone.

Les avatars MMD ont besoin de WebGL2 et utilisent les mêmes commandes de pause, de fréquence d'images et de cadrage que les autres avatars. Les modèles sont chargés uniquement depuis ton instance de Marinara Engine. Respecte les licences et les conditions des auteurs. Importer ou lire un modèle MMD n'envoie rien à un service d'IA.

<a id="glb-and-fbx-avatars-rigged-models"></a>

## Avatars GLB et FBX : modèles avec squelette d'animation

1. Sur la page **3D Avatars**, choisis **GLB or FBX model** sous **Avatar type**.
2. Sélectionne **Import GLB or FBX** (importer un fichier GLB ou FBX) et choisis un seul fichier `.glb` ou `.fbx` d'un personnage doté d'un squelette d'animation.

Un modèle simple n'a pas de données VRM qui nomment ses os : l'import reconnaît donc les os d'après leur nom. Les squelettes de Mixamo, Unity, VRoid, Unreal, Blender, 3ds Max, Maya HumanIK, Character Creator et DAZ utilisent des noms qu'il reconnaît. La section indique combien d'os du corps ont été reconnus. Le modèle doit avoir au moins les hanches, la colonne vertébrale, la tête, les deux bras et les deux avant-bras. Sinon, l'import le refuse et nomme les os manquants. Renomme-les dans ton logiciel 3D ou crée le squelette du modèle avec Mixamo. Les modèles en A-pose (bras écartés en oblique vers le bas), vus de dos ou créés en centimètres sont redressés, retournés et mis à l'échelle pour toi.

Les visages viennent des blend shapes du modèle (clés de forme ou morph targets). Sous **Faces and mouth shapes**, les noms courants sont reconnus : les formes de bouche de VRoid, VRChat et Oculus (`aa`, `A`, `viseme_aa`, `Fcl_MTH_A`), une mâchoire ouverte (`mouthOpen`, `jawOpen`), les émotions (`happy`, `Joy`, `mouthSmile`) et le clignement (`blink`, ou une paire gauche et droite comme `eyeBlinkLeft` et `eyeBlinkRight` d'ARKit). Vérifie l'aperçu et corrige les mauvaises suppositions. Un modèle sans blend shapes bouge quand même le corps et hoche la tête quand il parle.

Pris en charge : le glTF binaire (`.glb`) avec tout son contenu intégré, et le FBX 2014 (7.4) ou plus récent, binaire ou ASCII. Exporte le FBX en activant **Embed Media** (intégrer les médias), ou **Embed Textures** (intégrer les textures), sinon le modèle s'affiche sans ses images. Les compressions Draco, meshopt et KTX2 ne se chargent pas, et un fichier `.gltf` séparé accompagné de ses propres fichiers n'est pas utilisable. Un VRM enregistré en `.glb` se place sous **VRM model**. Les animations propres au modèle, la physique et l'édition de pose ne sont pas prises en charge. Respecte les conditions de l'auteur. Importer ou lire un modèle GLB ou FBX n'envoie rien à un service d'IA.

<a id="get-a-3d-model"></a>

## Obtenir un modèle 3D

Si le personnage ou le persona n'a pas de modèle VRM, crées-en un dans VRoid Studio. C'est une application gratuite de pixiv pour Windows, macOS et iPad. Tu peux utiliser comme tu veux les modèles que tu y crées, mais quelques éléments intégrés et les textures que tu achètes ont leurs propres conditions. Ses modèles comprennent les six visages, les cinq formes de bouche et le clignement : les visages et la synchronisation labiale fonctionnent donc tout de suite.

Sur la page **3D Avatars**, choisis le personnage ou le persona. Sous **Get a 3D model** (obtenir un modèle 3D), **Read the guide** (lire le guide) ouvre cette section et **Copy prompt** (copier le prompt) copie une description de son apparence.

1. Télécharge et installe [VRoid Studio](https://vroid.com/en/studio).
2. Facultatif : sélectionne **Copy prompt**, colle le prompt dans un générateur d'images et utilise l'image comme référence. VRoid Studio n'a pas de champ pour un prompt.
3. Dans VRoid Studio, crée un nouveau modèle. Choisis les cheveux, le visage, les yeux, le corps et la tenue les plus proches du personnage, puis modifie les formes et les couleurs pour qu'ils correspondent.
4. Exporte le modèle au format VRM (1.0 ou 0.0). Renseigne les informations et les conditions du modèle quand on te les demande.
5. Ouvre **3D Avatars** dans **Agents**, choisis le personnage ou le persona, puis sélectionne **Import VRM** sous **VRM model**. Un modèle VRoid Studio a déjà tous ses visages, toutes ses formes de bouche et son clignement remplis.

Le prompt décrit le personnage pour les outils qui créent une image ou un modèle 3D à partir d'un texte : un personnage en pied de style anime, en T-pose (bras tendus à l'horizontale), vu de face sur un fond uni. L'apparence vient du champ **Appearance** (apparence), des tags **Image Appearance Override** (apparence propre aux images) quand ils sont activés, ou de la description quand il n'y a pas d'apparence. Il ne contient que le nom et l'apparence, rien d'autre de la fiche et rien de tes chats. Il est en anglais. Modifie-le comme tu veux.

Un VRM issu d'un autre outil peut avoir moins d'expressions, voire aucune. **Faces and mouth shapes** montre lesquelles il a. Certains sites disent créer un VRM avec des expressions du visage à partir d'une image, mais aucun n'a pu être confirmé en octobre 2026 : ce guide n'en recommande donc aucun. Un modèle créé auparavant avec le générateur Tripo, aujourd'hui retiré, se charge toujours et bouge le corps, mais son visage ne bouge pas.

## Comment les visages et les bouches suivent la réponse

Les avatars réagissent tout seuls. Rien à configurer ici.

**Les visages en Roleplay.** Pendant qu'une réponse s'affiche, Marinara lit chaque phrase terminée et devine son humeur. Pour éviter que le visage ne change sans arrêt :

- Le visage ne change que si la nouvelle humeur est nettement plus forte que l'actuelle.
- Un visage reste au moins deux secondes.
- Le visage revient au calme après deux phrases calmes de suite, et environ quatre secondes après la fin de la réponse.

Avec le streaming (l'affichage au fil de l'écriture) désactivé, chaque phrase garde sa propre humeur, et les visages changent dans l'ordre pendant le temps de parole de la réponse. Quand la synthèse vocale lit la réponse, les visages suivent plutôt la voix (voir plus bas).

Un avatar PNGTuber qui a des visages pour [plus d'émotions](#pngtuber-sprites) peut afficher une émotion plus précise, comme Amusement quand il est joyeux. Il suit les mêmes règles, et une émotion sans visage propre affiche le visage de son émotion principale. Les choix de l'Expression Engine et du GM fonctionnent de la même façon : sans visage nommé `scared`, l'avatar affiche Fear. Les avatars 3D et mesh n'affichent que les six émotions.

**Comment l'humeur est lue.** Ton modèle de chat n'est pas sollicité, et le texte de ton chat n'est jamais envoyé à un service extérieur.

- Une liste de mots intégrée répond tout de suite, partout, et connaît les mots d'humeur courants dans plusieurs langues.
- Sur les ordinateurs capables de le faire tourner, un petit modèle d'émotions, le lecteur d'humeur (mood reader), lit plutôt les phrases. Il comprend 36 langues. Il se télécharge une seule fois, environ 300 Mo, la première fois que tu ouvres un chat Roleplay où 2D Avatars ou 3D Avatars est activé. La page de chaque agent d'avatar, dans **Agents**, affiche la progression. Un téléchargement qui échoue réessaie environ 10 minutes plus tard. La liste de mots répond jusqu'à ce que le lecteur d'humeur soit prêt, et ensuite il fonctionne hors ligne. Il utilise environ 1 Go de mémoire quand il sert, et se décharge après 10 minutes d'inactivité. Les installations Lite, Android et les ordinateurs de moins de 3 Go de mémoire gardent la liste de mots.

**Les visages en Game Mode.** Chaque réplique affichée par le GM arrive avec une expression, et l'avatar du personnage qui parle la prend, même quand une voix lit la réplique. Les pensées intérieures changent le visage, mais pas la bouche.

**L'Expression Engine.** Quand il est activé, son choix après la réponse est le visage final de cette réponse. Un choix qui arrive après l'envoi de ton message suivant reste attaché à sa propre réponse. Avec la synthèse vocale, ce choix s'affiche quand la voix se termine.

**Les bouches.** À partir du texte, la bouche ne bouge que pour les dialogues (les mots entre guillemets, les lignes `[Name]:` et les balises de locuteur), pas pour la narration, à peu près au rythme de la parole. Si le texte apparaît plus vite que quiconque ne pourrait le dire, la bouche accélère, puis saute en avant. Avec le streaming désactivé, les dialogues d'une réponse sont prononcés en huit secondes au plus. Quand la synthèse vocale lit une réplique, c'est la voix qui fait bouger la bouche.

**Le corps.** Un avatar réfléchit entre le moment où tu envoies ton message et ses premiers mots, parle pendant que sa bouche bouge, écoute pendant que quelqu'un d'autre parle ou que tu écris, et se repose le reste du temps.

**Les chats de groupe.** Dans un groupe Individual, c'est le membre qui répond qui parle, y compris quand tu demandes un swipe (une réponse alternative) sur le message d'un membre. Dans un groupe Merged, une balise de locuteur dirige les dialogues et le visage de ce personnage, même dans un paragraphe qui nomme quelqu'un d'autre. Les dialogues attribués par leur nom suivent aussi leur locuteur. La prose sans balise appartient au premier personnage qu'elle nomme, ou à celui d'avant. Tant qu'un paragraphe qui ne nomme personne s'affiche encore, ses dialogues attendent qu'un nom ou la fin du paragraphe indique qui parle. Avec le streaming désactivé dans un groupe Individual, seule la réponse du dernier membre fait bouger un avatar pour l'instant.

<a id="lip-sync-with-text-to-speech"></a>

## Synchronisation labiale avec la synthèse vocale

Quand la synthèse vocale lit une réponse Roleplay, l'avatar du personnage qui parle bouge la bouche avec la voix. La bouche s'ouvre plus grand sur les sons forts, se ferme pendant les pauses, s'arrondit sur des sons comme "ou" et montre les dents sur des sons comme "s". Pour l'activer, configure la synthèse vocale comme expliqué dans [Configuration du Text to Speech (TTS)](../media/tts-setup.md). Elle fonctionne alors avec **Auto-play** (lecture automatique) et le bouton **Speak** (lire à voix haute) d'un message, y compris dans la disposition visual novel.

Quand la réponse est lue à voix haute avec **Auto-play** activé, la voix démarre en général quelques secondes après l'affichage du texte : l'avatar l'attend donc.

- Pendant que le texte s'affiche, l'avatar cligne des yeux et bouge comme d'habitude, mais sa bouche reste fermée et son visage ne change pas encore.
- Quand la voix démarre, la bouche suit la voix, et le visage change à mesure que la voix arrive à chaque phrase, sauf si l'Expression Engine a déjà choisi le visage.
- Le visage se détend environ quatre secondes après la fin de la voix. Les courtes pauses entre les répliques ne le détendent pas.
- Si la voix échoue ou ne démarre pas dans les quelques secondes, l'avatar joue une fois les visages et la bouche de la réponse à partir du texte. Si elle échoue plus tard, il affiche la dernière humeur et se détend.
- Au bout de 30 secondes sans voix, l'avatar cesse d'attendre. Une voix qui démarre plus tard fait quand même bouger la bouche.

Détails :

- **Qui parle.** La bouche qui bouge est celle du personnage dont la voix lit la réplique, celui pour lequel **Voice option** (option de voix) choisit une voix. La bouche de chaque personnage ne bouge que pendant ses propres répliques. Les répliques lues avec la voix du narrateur et les locuteurs qui ne sont pas des personnages du chat ne font bouger aucune bouche. Avec **Only read dialogues** (ne lire que les dialogues) désactivé, la narration propre d'un personnage est lue avec sa voix et fait bouger sa bouche.
- **Pause, arrêt et changement de chat.** Mettre la voix en pause ou l'arrêter arrête la bouche. Si tu changes de chat pendant qu'une réponse est lue, les avatars de l'autre chat restent immobiles. Reviens pendant que la voix joue encore : l'avatar la reprend.
- **Volume.** **Line volume** (volume de la réplique) change le volume, pas l'ouverture de la bouche.
- **Personas.** La bouche d'un persona ne bouge pas pour tes propres messages.
- **Game Mode.** Avec la synthèse vocale et **Auto-play** activés, les bouches attendent la voix de leur personnage et la suivent. Les répliques sans voix gardent leur animation à partir du texte. Les voix du narrateur et du joueur ne font bouger la bouche d'aucun personnage. Les pensées intérieures ne sont pas lues à voix haute.

La synchronisation labiale ne change pas la façon dont la voix est jouée. Marinara lit une copie séparée de chaque clip pour caler la bouche : la lecture fonctionne donc comme avant, y compris dans Safari et sur iPhone et iPad. Si le premier clip commence avant que la synchronisation soit prête, son texte fait bouger la bouche jusqu'à ce que la synchronisation avec la voix prenne le relais. Si ton navigateur ne peut pas lire un clip, la voix est quand même jouée, et seule la bouche cesse de la suivre.

<a id="making-an-avatar-from-a-sprite"></a>

## Créer un avatar à partir d'un sprite

Sur la page **2D Avatars**, choisis un personnage ou un persona, puis utilise **Make an avatar from a sprite** (créer un avatar à partir d'un sprite). Cette section part des sprites que le personnage ou le persona a déjà. Ton avatar ne change pas tant que tu n'enregistres pas un résultat : tu peux donc essayer autant de fois que tu veux.

<a id="faces-from-the-avatar"></a>

### Visages tirés de l'avatar

**Make faces from the avatar** (créer des visages à partir de l'avatar) crée des visages sans fond, y compris pour un personnage ou un persona qui n'a pas encore de sprites. Il faut un avatar et un compte de génération d'images. Cela ouvre la même génération de sprites que dans les éditeurs de personnage et de persona, avec l'avatar comme référence.

1. Choisis **All faces** (tous les visages, soit les 29 émotions), **Main faces** (visages principaux, soit les six) ou choisis toi-même les visages. Chaque émotion supplémentaire se trouve sur la ligne de son visage principal jusqu'à ce qu'elle ait son propre visage.
2. Les visages sont dessinés par lots, en commençant par les visages principaux. Les anciens modèles GPT Image dessinent un visage par image. Une image qui échoue est retentée une fois. Si elle échoue encore, le traitement s'arrête avec **Retry picture** (réessayer l'image). **Cancel** (annuler) garde les visages déjà créés.
3. Si **Expose media prompts before sending** (afficher les prompts médias avant l'envoi) est activé, tu relis d'un coup tous les prompts – le texte que Marinara envoie à l'IA – avant l'envoi du premier. Chaque visage est dessiné les yeux ouverts et la bouche fermée, pour que les images de clignement et de parole aient quelque chose à fermer et à ouvrir.
4. Marinara dessine les visages sur une couleur unie, la retire, puis les enregistre comme sprites du personnage ou du persona. Un nouveau sprite remplace celui qui porte le même nom : renomme-le à la dernière étape pour garder l'ancien.

Quand l'avatar est déjà enregistré, chaque nouveau visage devient le visage de l'émotion pour laquelle il a été dessiné, même s'il a été renommé. Les autres sprites restent. Un visage refait démarre sans images de clignement et de parole, car les anciennes ne lui correspondraient plus. Crée-en de nouvelles sous [Images de clignement et de parole](#blink-and-talk-pictures). Un import PNGTuber Plus garde ses propres visages.

<a id="blink-and-talk-pictures"></a>

### Images de clignement et de parole

Chaque visage que l'avatar affiche pour une émotion forme une ligne, avec ses images **Eyes closed** (yeux fermés) et **Mouth open** (bouche ouverte) à côté de **Face** (visage). Ce sont des images que tu as enregistrées, des sprites `_blink` et `_talk` que tu as ajoutés, ou de nouvelles images. Avec des sprites de portrait, seuls ceux-là sont utilisés, car un avatar ne mélange jamais les visages de portrait et les visages en pied. Un visage qui n'est pas l'un de tes sprites, comme un visage issu d'un import PNGTuber Plus, affiche ses images mais ne peut pas en recevoir de nouvelles.

1. Vérifie **Image model** (modèle d'image) ; ton compte d'image par défaut y est déjà choisi.
2. Clique sur **Make** (créer) pour une image manquante, ou sur le bouton **Make N pictures** (créer N images) pour toutes. Chaque image correspond à une requête d'image. Si **Expose media prompts before sending** est activé dans Settings (Paramètres), tu vois chaque prompt et peux le modifier d'abord.
3. Les nouvelles images apparaissent une à une. Sélectionne **Keep** (garder) sur celles qui sont réussies et **Try again** (réessayer) sur les autres. **Try again** redessine aussi une image que tu as déjà. L'image en cours de redessin reste grisée, avec une icône de chargement. **Cancel** l'arrête, sur le serveur aussi. Si **Try again** échoue, l'ancienne image reste. Pour refaire une image gardée, sélectionne d'abord **Kept** (gardée) pour la libérer.
4. Sélectionne **Save kept pictures** (enregistrer les images gardées). Elles deviennent les images de clignement et de parole de l'avatar, à côté d'une copie du sprite à partir duquel elles ont été dessinées, pour qu'elles soient toujours bien alignées. Si tu remplaces un sprite avant d'enregistrer, crée de nouveau ses images.

Avec un compte d'image qui accepte une image de référence, ton sprite est la seule référence, à la taille et au format que le modèle accepte, avec un prompt qui demande de ne changer que les yeux ou la bouche. Les modèles déplacent, redimensionnent ou entourent de marges l'image qu'ils renvoient : elle est donc d'abord alignée sur ton sprite. Seuls les yeux (pour un clignement) ou la bouche (pour la parole) en sont repris. Tout le reste garde les pixels de ton propre sprite : l'avatar ne saute donc pas. Si les yeux ne se sont pas fermés, si la bouche ne s'est pas ouverte, ou si l'image était trop décalée pour être alignée, l'image échoue avec un message. Réessaie.

Certains comptes ne savent pas modifier les images, comme Pollinations, Together AI, Horde, DALL-E, ou un workflow ComfyUI sans emplacement de référence. Avec l'un d'eux, **Make** dessine un nouveau visage avec ses images de clignement et de parole dans une seule image, pour que les trois correspondent, comme le fait [Visages tirés de l'avatar](#faces-from-the-avatar). La ligne affiche **New face** (nouveau visage). **Keep** garde ensemble le visage et ses deux images, et l'enregistrement fait du nouveau visage le visage de cette émotion. Ton sprite n'est pas modifié. Il faut pour cela une apparence ou une description sur le personnage ou le persona.

<a id="mesh-avatar"></a>

### Avatar mesh

1. Choisis un sprite dans **Sprite to use** (sprite à utiliser). Le sprite neutre en pied est choisi pour toi s'il y en a un. Un sprite en pied ou un buste, vu de face, donne les meilleurs résultats.
2. Choisis le fournisseur dans **Chat provider that can see pictures** (fournisseur de chat qui voit les images). **The agent's provider** (le fournisseur de l'agent) utilise celui défini sur la page 2D Avatars, sinon ton compte d'agent par défaut. Son modèle doit accepter les images.
3. Sélectionne **Make mesh avatar** (créer l'avatar mesh). Le modèle de chat repère le visage, et Marinara construit l'avatar à partir de ton sprite tel quel. **Cancel** l'arrête.
4. Vérifie l'aperçu : les contours doivent tomber sur les yeux, les sourcils et la bouche. Sélectionne **Save as mesh avatar** (enregistrer comme avatar mesh), ou **Discard** (abandonner) et essaie un autre sprite ou un autre modèle.

Un avatar mesh généré bouge la tête, les yeux, les sourcils et la bouche, et cligne des yeux et parle avec ses propres paupières et sa propre bouche. Les cheveux suivent la tête. Les mains, les mèches isolées et les accessoires qui pendent ne sont pas animés. Les petits sprites sont construits à partir d'une copie agrandie, pour que la bouche corresponde au visage. Quand le visage occupe la plus grande partie d'un grand sprite, une copie plus petite est utilisée pour que la création reste rapide.

Ton sprite est envoyé au compte d'image pour les images de clignement et de parole (et à son compte d'image de secours s'il y en a un et qu'il accepte une référence), et au modèle de chat pour un avatar mesh. Un compte qui ne sait pas modifier les images ne reçoit que le prompt, qui contient l'apparence. Les prompts sont fournis avec l'agent 2D Avatars. Avec **Expose media prompts before sending** activé, tu peux lire et modifier chaque prompt. Avec le mode débogage activé, chaque prompt est écrit dans le log du serveur.

## Créer ton propre modèle

Un personnage ou un persona peut utiliser ses sprites d'expression comme avatar PNGTuber, sans rien dessiner. [Créer un avatar à partir d'un sprite](#making-an-avatar-from-a-sprite) ajoute des images de clignement et de parole ou construit un avatar mesh pour toi. Pour créer ton propre modèle, utilise l'un de ces outils. Importe chaque fichier sur la page de l'agent, dans **Agents**, et active **Show this avatar in chats**.

| Ce que tu veux | Outil | Ce que tu obtiens |
| --- | --- | --- |
| Des sprites PNGTuber | N'importe quelle application de dessin, puis l'onglet **Sprites** du personnage | Les sprites |
| Des sprites PNGTuber avec calques et costumes | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | Un fichier `.save` |
| Un avatar mesh | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | Un fichier `.mavatar` |
| Un modèle 3D | [VRoid Studio](https://vroid.com/en/studio), ou Blender avec le [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | Un fichier `.vrm`, et en option une animation au repos `.vrma` |

### Tes propres sprites

1. Dessine une image par émotion, toutes de la même taille, avec le personnage au même endroit. Nomme chacune d'après son émotion : `neutral`, `happy`, `angry`, `sad`, `relaxed`, `surprised`. Les noms qui contiennent un mot d'émotion fonctionnent aussi, comme `smile`, `cry`, `calm` ou `shock`. Pour les [émotions supplémentaires](#pngtuber-sprites) facultatives, nomme des images comme `amusement`, `fear` ou `gratitude`.
2. Pour une bouche qui bouge, dessine la même image avec la bouche ouverte et ajoute `_talk`, par exemple `happy_talk`. Pour le clignement, ferme les yeux et ajoute `_blink`. Pour les deux, ajoute `_blink_talk`.
3. Dans l'onglet **Sprites** du personnage ou du persona, sous **Facial Expressions** (expressions du visage), ajoute les images. **Upload Folder** (téléverser un dossier) ajoute un dossier et nomme chaque sprite d'après son fichier. Voir [Sprites de personnage](../characters/sprites.md).
4. Ouvre **2D Avatars** dans **Agents**, choisis le personnage ou le persona, puis active **Show this avatar in chats**.

### PNGTuber Plus

1. Construis l'avatar à partir de calques séparés. Affiche la bouche ouverte seulement pendant la parole, et la bouche fermée seulement pendant le silence. Affiche les yeux fermés seulement pendant un clignement, et les yeux ouverts seulement le reste du temps.
2. Pour chaque émotion, crée un costume qui change les yeux ou la bouche, et nomme ces images d'après l'émotion, par exemple `angry eyes.png` ou `happy_mouth.png`. Les émotions précises fonctionnent de la même façon, comme `fear eyes.png`. Le costume 1 est le visage au repos.
3. Enregistre l'avatar pour obtenir un fichier `.save`.
4. Ouvre **2D Avatars** dans **Agents**, choisis le personnage ou le persona, puis **PNGTuber sprites** et **Import PNGTuber Plus save**. Choisis un visage pour chaque émotion que les noms n'ont pas couverte.

### Mesh Avatar Studio

1. Pars d'une image de face, tête et épaules, sur fond transparent. Mesh Avatar Studio tourne sur ton ordinateur avec Node.js, et un agent de programmation comme Claude Code ou Codex prépare l'image pour l'animation. Son README t'explique la marche à suivre.
2. Facultatif : ajoute des yeux et des bouches dessinés sous **Drawn variants** (variantes dessinées). Marinara utilise les formes de bouche `mouth_a`, `mouth_i`, `mouth_o` et `mouth_a_half`, et les yeux fermés `eyes_closed_0` et `eyes_closed_1`. Chaque avatar mesh intègre les six émotions : il n'y a rien à nommer.
3. Choisis **Export .mavatar** (exporter en .mavatar). Ne crée pas toi-même d'archive ZIP du dossier du projet.
4. Ouvre **2D Avatars** dans **Agents**, choisis le personnage ou le persona, puis **Mesh avatar** et **Import .mavatar file**.

### VRoid Studio

1. Crée le personnage dans VRoid Studio. Ses visages, ses formes de bouche et son clignement sont des expressions VRM standard et sont trouvés automatiquement.
2. Exporte au format VRM (1.0 ou 0.0). Renseigne les informations et les conditions du modèle quand on te les demande.
3. Ouvre **3D Avatars** dans **Agents**, choisis le personnage ou le persona, puis sélectionne **Import VRM**.

<a id="blender-with-the-vrm-add-on-for-blender"></a>

### Blender avec le VRM Add-on for Blender

1. Installe le VRM Add-on for Blender depuis **Get Extensions** (obtenir des extensions), dans les **Preferences** (préférences) de Blender. Avant la version 4.2, Blender installe plutôt le fichier ZIP du module sous **Add-ons**.
2. Donne au modèle une armature humanoïde et attribue ses os VRM. Le module peut les attribuer automatiquement.
3. Configure les expressions dans le panneau VRM du module : **Expressions** pour VRM 1.0, ou **VRM 0.x Blend Shape Proxy** pour VRM 0.x. Chacune doit faire bouger une clé de forme (shape key) ou un matériau : une expression vide ne change rien, et l'import ne l'utilise donc que pour Neutral. Les expressions personnalisées au nom clair, comme `Smile` ou `Shock`, sont reconnues aussi.
   - Visages : **Happy**, **Angry**, **Sad**, **Relaxed** et **Surprised**. VRM 0.x appelle les quatre premiers **Joy**, **Angry**, **Sorrow** et **Fun**, et n'a pas d'expression standard pour la surprise : ajoute donc une expression personnalisée nommée `Surprised`.
   - Formes de bouche : **Aa**, **Ih**, **Ou**, **Ee** et **Oh** (**A**, **I**, **U**, **E** et **O** en VRM 0.x).
   - Clignement : **Blink**.
4. Exporte avec **File → Export → VRM (.vrm)** (Fichier → Exporter → VRM). Pour une animation au repos, anime l'armature et utilise **File → Export → VRM Animation (.vrma)**. Le module n'exporte une animation qu'à partir d'un modèle réglé sur VRM 1.0 : choisis donc VRM 1.0 à l'étape 3 si tu en veux une.
5. Ouvre **3D Avatars** dans **Agents**, choisis le personnage ou le persona, puis sélectionne **Import VRM**. Ajoute l'animation avec **Add animation** (ajouter une animation) sous **Idle animation**.

### Ce qu'il faut éviter à l'export

- **Compression.** La compression Draco ou meshopt et les textures KTX2 ne se chargent pas. Les exports VRM ci-dessus ne les utilisent jamais, mais l'export glTF simple de Blender propose Draco et les optimiseurs de modèles peuvent ajouter les trois. Exporte de nouveau avec la compression désactivée.
- **glTF simple.** Un fichier `.glb` simple n'a pas les données VRM qui nomment les visages et le squelette. Importe-le comme **GLB or FBX model**, ou exporte un fichier `.vrm`.
- **Fichiers séparés.** Un modèle dont les textures ou les données sont dans des fichiers séparés n'est pas utilisable. Exporte un seul fichier `.vrm`.
- **Extras de PNGTuber Plus.** L'oscillation, le traînage et l'animation ne sont pas repris. Chaque calque s'affiche au repos, et un calque animé affiche sa première image.

## Performances et appareils

Le code de dessin de chaque type d'avatar ne se télécharge que la première fois qu'un avatar de ce type s'affiche : les chats sans avatar ne chargent donc rien de plus.

| | Téléphones | Ordinateurs |
| --- | --- | --- |
| Avatars dessinés en même temps | Aucune limite fixe | Aucune limite fixe |
| Images par seconde pendant la parole | 30 | 30 |
| Images par seconde au repos | 20, ou 15 quand le téléphone est occupé | 30 |
| Netteté (ratio de pixels) | jusqu'à 1,5× | jusqu'à 2× |

Un chat affiche tous les avatars configurés et activés dans l'ordre de ses personnages, puis ton persona. Adapte la taille et la disposition des avatars à ton écran. Les avatars cessent d'être dessinés quand l'onglet est masqué, que la fenêtre est en arrière-plan, que les réglages d'apparence sont ouverts, ou que le chat est hors de l'écran ou recouvert par un panneau ou un éditeur. Avec **Reduce Ambient Animations & Effects** (réduire les animations et effets d'ambiance) ou le réglage de réduction des animations de ton appareil activé, les avatars changent toujours de visage et bougent toujours la bouche, mais sautent la respiration, le balancement et les poses d'attente.

## Guides associés

- [Agents : des aides IA pour tes chats](agents-overview.md)
- [Référence des agents téléchargeables](built-in-agents.md)
