# Avatars 2D et 3D

Deux agents téléchargeables donnent à tes personnages et à tes personas (les personnages que tu incarnes) un avatar animé qui réagit pendant qu'une réponse s'affiche. **2D Avatars** (avatars 2D) affiche des sprites façon PNGTuber ou des avatars mesh, et **3D Avatars** (avatars 3D) affiche des modèles VRM. Un sprite est l'image du personnage sur le plateau ; un avatar mesh est un modèle 2D souple, posé sur un maillage. Les visages suivent la réponse, et les bouches bougent avec le texte ou avec la synthèse vocale.

Cette fonctionnalité est encore en construction. Les sections ci-dessous se complètent à mesure que chaque partie arrive sur `staging`.

Les modèles Live2D ne sont pas pris en charge. La licence de Live2D exige un accord séparé avec Live2D, même pour les applications open source gratuites, et son runtime ne peut pas être livré avec Marinara Engine.

## Télécharger les agents

Les deux agents sont en cours de test. Pour l'instant, **Download Agents** (télécharger des agents) ne les propose que si Marinara Engine tourne sur la branche `staging`.

**2D Avatars** et **3D Avatars** se téléchargent séparément : tu peux donc n'installer que celui que tu veux. Les deux fonctionnent pour les personnages et les personas, dans les chats Roleplay et Game.

1. Ouvre **Agents → Download Agents** et installe **2D Avatars**, **3D Avatars** ou les deux. Aucun des deux ne demande de redémarrage.
2. Configure chaque avatar sur la page de l'agent, dans **Agents**. Voir [Configurer un avatar](#setting-up-an-avatar).
3. Dans un chat Roleplay ou Game, ouvre **Chat Settings → Agents → Misc Agents** (réglages du chat → Agents → agents divers) et ajoute l'agent.

Les agents n'envoient aucune requête supplémentaire à tes connexions d'IA pendant que tu discutes. Ils ont besoin d'un moteur doté de la Capability API 1.73, et un moteur plus ancien refuse de les installer.

<a id="setting-up-an-avatar"></a>

## Configurer un avatar

Les avatars se configurent sur la page de chaque agent. Ouvre **Agents**, ouvre **2D Avatars** ou **3D Avatars**, puis utilise la section **Avatars** près du haut de la page.

1. Dans **Character or persona** (personnage ou persona), choisis qui reçoit l'avatar. Les noms marqués "(has an avatar)" en ont déjà un enregistré.
2. Dans **Avatar type** (type d'avatar), choisis le type à configurer. 2D Avatars propose **PNGTuber sprites** (sprites PNGTuber) et **Mesh avatar** (avatar mesh). 3D Avatars propose **VRM model** (modèle VRM).
3. Configure-le dans la section propre à ce type, sous les interrupteurs : utilise tes sprites ou importe un fichier, choisis le visage de chaque émotion, ou supprime-le. Voir [Avatars 2D](#2d-avatars-pngtuber-sprites-and-mesh-avatars) et [Avatars 3D](#3d-avatars-vrm-models).
4. Utilise **Preview** (aperçu) pour le voir. **Try a face** (essayer un visage) change d'émotion et **Talk** (parler) fait bouger la bouche. Tant qu'il n'y a rien à montrer, l'aperçu affiche un avatar d'exemple.

Un personnage ou un persona qui a des sprites d'expression a déjà un avatar PNGTuber sur la page 2D Avatars : les chats où 2D Avatars est activé l'affichent sans que tu aies rien à enregistrer.

**Show this avatar in chats** (afficher cet avatar dans les chats) active ou désactive l'avatar sans le supprimer. **Movement** (mouvement) a trois interrupteurs qui valent pour tous les types : **Lip sync** (synchronisation labiale) fait bouger la bouche, **Blinking** (clignement) fait cligner des yeux toutes les quelques secondes, et **Idle motion** (mouvement au repos) fait respirer et se balancer l'avatar pendant l'attente. Si un personnage a plusieurs types d'avatar, **Show this one** (afficher celui-ci) choisit le type utilisé dans les chats. Quand l'agent de ce type est désactivé dans un chat, le chat affiche un autre type dont l'agent est activé. Supprimer un type efface ses fichiers ; tes sprites restent, et un avatar que tu as désactivé reste désactivé.

Un avatar s'affiche dans un chat Roleplay, Visual Novel ou Game quand les agents sont activés dans le chat et que l'agent correspondant y est ajouté. Il fonctionne avec ou sans l'agent Expression Engine. L'avatar ne masque pas le sprite en pied : désactive-le toi-même si l'avatar le remplace. Les avatars se placent là où serait le sprite en pied et prennent sa taille. Pour les déplacer, utilise le mode **Arrange** (disposer) des sprites, dans les réglages de sprites de l'Expression Engine.

Les fichiers importés sont vérifiés avant d'être stockés. Seule compte la limite de téléversement habituelle du serveur : les avatars n'ont pas de limite de taille plus basse. Les fichiers d'avatar se trouvent dans le dossier de données, sous `avatar-models/<character or persona>/<id>/`, à côté d'un fichier `avatar.json` qui contient les réglages. Les sauvegardes et les exports de profil incluent ce dossier. Supprimer un personnage ou un persona supprime son avatar, y compris quand la Danger Zone des réglages efface tous les **Characters** (personnages) ou tous les **Personas** (personas), et y vider **Media & Assets** (médias et ressources) vide le dossier. Les exports de fiches de personnage n'incluent jamais les avatars.

<a id="2d-avatars-pngtuber-sprites-and-mesh-avatars"></a>

## Avatars 2D : sprites PNGTuber et avatars mesh

**2D Avatars** affiche l'un de deux types d'avatar : les **sprites PNGTuber**, des images plates qui changent de visage, ouvrent la bouche et clignent des yeux, et les **avatars mesh**, des dessins qui bougent la tête, les yeux et la bouche en douceur. Configure les deux sur la page de l'agent, dans l'éditeur d'agent, après avoir choisi un personnage ou un persona.

<a id="pngtuber-sprites"></a>

### Sprites PNGTuber

Un personnage ou un persona qui a des sprites d'expression a déjà un avatar PNGTuber : ses sprites servent de visages, sans rien à configurer. Les sprites de portrait sont utilisés s'il y en a, sinon les sprites en pied, si bien qu'un avatar ne mélange jamais les deux.

- **Images pour parler et cligner des yeux.** Ajoute des sprites qui portent le nom d'un visage suivi de `_talk` pour la bouche ouverte et de `_blink` pour les yeux fermés, par exemple `happy_talk` et `happy_blink`, et `happy_blink_talk` pour les deux. `_talking`, `_speak`, `_mouth_open`, `_blinking` et `_eyes_closed` fonctionnent aussi. Un visage qui n'en a pas sautille quand même en parlant.
- **Visage pour chaque émotion.** Choisis le visage affiché pour Neutral, Happy, Angry, Sad, Relaxed et Surprised (neutre, joyeux, en colère, triste, détendu et surpris). **Resting face** (visage au repos) utilise le visage Neutral. Quand l'Expression Engine ou le Game Master (GM, le maître du jeu) choisit un sprite que tu as, c'est exactement ce visage qui s'affiche.
- **Mouvement.** **Hop while talking** (sautiller en parlant) et **Hop height** (hauteur du saut) règlent le rebond façon PNGTuber. **Time between blinks** (temps entre deux clignements) est une moyenne : chaque clignement arrive un peu plus tôt ou un peu plus tard, pour ne jamais paraître mécanique. Si la réduction des animations est activée sur ton appareil, l'avatar ne sautille pas et ne respire pas, mais son visage et sa bouche changent toujours.
- **Use my sprites** (utiliser mes sprites) enregistre les sprites comme visages de l'avatar. Choisir un visage ou modifier le mouvement l'enregistre aussi. **Update from sprites** (mettre à jour depuis les sprites) récupère les sprites ajoutés plus tard et garde les visages que tu as choisis pour chaque émotion. Après un import, choisis **Remove** (supprimer) pour revenir à tes sprites.

**Import PNGTuber Plus save** (importer une sauvegarde PNGTuber Plus) lit un avatar enregistré par [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) (un fichier `.save`). Chaque costume devient un visage, et ses calques de parole et de clignement deviennent les images pour parler et cligner des yeux. Les costumes sont associés aux émotions d'après le nom des images qu'ils affichent, comme `angry eyes.png`. Choisis un visage pour chaque émotion que les noms n'ont pas couverte. Certains éléments ne sont pas repris :

- L'oscillation (wobble), le traînage (drag), la rotation et l'étirement (stretch) ne sont pas importés ; l'avatar affiche chaque calque au repos.
- Les calques animés n'affichent que leur première image.
- Les très anciennes sauvegardes ne gardent que le chemin de leurs images sur l'ordinateur de leur auteur. Enregistre-les d'abord de nouveau avec une version plus récente de PNGTuber Plus.
- Un très grand avatar est réduit à 2048 pixels, pour que les téléphones puissent garder toutes les images.

Importer une sauvegarde demande un traitement d'image sur le serveur. Certaines installations Android (Termux) n'en disposent pas : l'import y est alors refusé, avec un message qui l'explique.

### Avatars mesh

Un avatar mesh est un fichier `.mavatar`. Marinara Engine peut en créer un à partir d'un de tes sprites (voir [Créer un avatar à partir d'un sprite](#mesh-avatar)), ou tu peux en créer un avec [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (voir [Créer ton propre modèle](#mesh-avatar-studio)). Choisis **Import .mavatar file** (importer un fichier .mavatar) pour en ajouter un, ou **Replace file** (remplacer le fichier) pour le changer. Avec le mouvement au repos activé, l'avatar respire et regarde autour de lui tout seul. Il cligne des yeux, et sa bouche suit la réponse. Si le fichier contient des formes de bouche dessinées, elles sont utilisées ; sinon, des formes simples sont dessinées pour lui.

Sous **Look for each feeling** (apparence pour chaque émotion), choisis ce que montre chaque émotion : l'une des six émotions, ou **Smile** (sourire), **Shy** (timide), **Half-closed eyes** (yeux mi-clos) ou **Wink** (clin d'œil).

Chaque fichier est vérifié à l'import, et un fichier endommagé est refusé avec une courte explication. C'est aussi le cas d'un fichier trop détaillé pour s'animer de façon fluide, ou d'un fichier qui dépasse la limite de téléversement une fois décompressé. Seules les parties dont l'avatar a besoin sont conservées : l'illustration d'origine contenue dans le fichier n'est donc pas stockée. L'illustration appartient à son créateur ; vérifie sa licence avant de la partager.

Les avatars mesh ont besoin de WebGL2, que les navigateurs actuels prennent en charge. Sans WebGL2, ou quand le navigateur arrête les graphismes de l'avatar pour économiser de la mémoire, l'avatar affiche à la place ta configuration PNGTuber ou tes sprites.

<a id="3d-avatars-vrm-models"></a>

## Avatars 3D : modèles VRM

**3D Avatars** affiche des modèles VRM, le format qu'exportent VRoid Studio, le VRM Add-on for Blender et UniVRM pour Unity. Les fichiers VRM 1.0 et VRM 0.x fonctionnent tous les deux.

1. Ouvre **3D Avatars** dans l'éditeur d'agent et choisis le personnage ou le persona.
2. Sous **VRM model**, sélectionne **Import VRM** (importer un VRM) et choisis un fichier `.vrm`.
3. Lis **The author's terms** (les conditions de l'auteur). Elles viennent du fichier du modèle. Elles indiquent qui peut utiliser le modèle comme avatar, si l'usage commercial est autorisé, si tu peux modifier le modèle, si le contenu sexuel ou très violent est autorisé et, pour les modèles VRM 1.0, si tu dois créditer l'auteur et si tu peux partager le fichier. Quand le fichier renvoie vers une licence ou vers les conditions propres de l'auteur, ouvre-les aussi. Marinara Engine affiche ces conditions mais ne les fait pas appliquer : merci de les respecter toi-même.
4. Sous **Faces and mouth shapes** (visages et formes de bouche), vérifie quelle expression du modèle affiche chaque visage (Neutral, Happy, Angry, Sad, Relaxed et Surprised), chaque forme de bouche (A, I, U, E et O) et le clignement. La plupart sont déjà remplies pour toi : **Set by the model** (défini par le modèle) signifie que le modèle a l'expression VRM standard, et **Guessed from its name** (deviné d'après son nom) signifie que l'une de ses propres expressions porte un nom correspondant. Une expression que le modèle a laissée vide ne change rien : elle n'est donc jamais attribuée à un autre visage que Neutral, qui est le modèle au repos, et l'import signale quand il en a ignoré une. Choisis une autre expression, ou **None** (aucune), dès qu'une supposition te semble fausse.
5. Si tu veux, sous **Idle animation** (animation au repos), ajoute un fichier `.vrma` que le modèle joue pendant l'attente. Sans lui, le modèle respire et se balance doucement.

**Replace model** (remplacer le modèle) garde l'animation au repos, car les animations VRM s'adaptent à n'importe quel modèle VRM. **Remove model** (supprimer le modèle) supprime le modèle et son animation au repos.

Pendant un chat, le modèle te regarde, cligne des yeux tout seul quand il a une expression de clignement, et penche la tête pendant qu'il réfléchit ou écoute. Sa tête reste près du haut de son emplacement : un emplacement large montre la tête et les épaules, et un emplacement plus étroit montre davantage le corps. Certains modèles VRM 1.0 gardent la bouche immobile pendant qu'ils affichent un visage ; quand un tel modèle parle, ce visage s'affiche à intensité partielle pour que la bouche puisse encore bouger. Avec la réduction des animations activée, le visage et la bouche changent toujours, mais le modèle cesse de se balancer, de respirer et de jouer son animation au repos.

Certains fichiers ne sont pas utilisables, et l'import indique pourquoi :

- **Modèles compressés.** Les fichiers enregistrés avec la compression Draco ou meshopt, ou avec des textures KTX2, ne se chargent pas. Exporte de nouveau le modèle avec la compression désactivée.
- **Modèles 3D simples.** Un modèle `.glb` ou `.gltf` sans données VRM n'a ni expressions du visage ni squelette humanoïde. Convertis-le d'abord en VRM, par exemple avec le VRM Add-on for Blender (voir [Créer ton propre modèle](#blender-with-the-vrm-add-on-for-blender)).
- **Modèles incomplets.** Un modèle est refusé si son squelette n'a pas tous les os dont VRM a besoin, s'il renvoie à des parties absentes du fichier, ou s'il renvoie à des fichiers extérieurs.

Il n'y a pas d'autre limite de taille que la limite de téléversement habituelle de l'application, mais les gros modèles mettent plus de temps à charger, surtout sur téléphone.

## Comment les visages et les bouches suivent la réponse

Les avatars réagissent tout seuls ; cette partie ne demande aucune configuration.

**Les visages en Roleplay.** Pendant qu'une réponse s'affiche, Marinara Engine lit chaque phrase terminée et devine son humeur. Pour que le visage ne change pas sans arrêt :

- Le visage ne change que si la nouvelle humeur est nettement plus forte que l'actuelle.
- Un visage reste au moins deux secondes.
- Le visage ne revient au calme qu'après deux phrases calmes de suite.
- Environ quatre secondes après la fin de la réponse, le visage se détend et revient au calme.

**Comment l'humeur est lue.** Ta connexion de chat n'est pas sollicitée. Le texte de ton chat reste sur ta propre installation de Marinara Engine et n'est jamais envoyé à un service extérieur.

- Une liste de mots intégrée répond tout de suite, partout, et connaît les mots d'humeur courants dans plusieurs langues.
- Sur les ordinateurs capables de le faire tourner, Marinara Engine lit plutôt les phrases avec un petit modèle d'émotions, le lecteur d'humeur (Mood reader). Il comprend 36 langues. Il se télécharge une seule fois, environ 300 Mo, la première fois que tu ouvres un chat Roleplay où 2D Avatars ou 3D Avatars est activé. Il ne se télécharge pas tant que les deux agents sont désactivés. La page de chaque agent d'avatar, dans **Agents**, affiche la progression du téléchargement, et un téléchargement qui échoue réessaie de lui-même environ 10 minutes plus tard. La liste de mots répond jusqu'à ce que le lecteur d'humeur soit prêt, et une fois téléchargé, il fonctionne hors ligne. Il utilise environ 1 Go de mémoire quand il sert, et se décharge après 10 minutes d'inactivité. Les installations Lite, Android et les ordinateurs de moins de 3 Go de mémoire gardent la liste de mots.

**Les visages en Game Mode.** Chaque réplique affichée par le GM arrive avec une expression, et l'avatar du personnage qui parle la prend. Les pensées intérieures d'un personnage changent son visage, mais pas sa bouche.

**L'Expression Engine.** Quand il est activé dans le chat, son choix après la réponse est le visage final de cette réponse. Un choix qui arrive après l'envoi de ton message suivant reste attaché à la réponse qu'il concernait. Les avatars fonctionnent aussi sans lui.

**Les bouches.** À partir du texte, la bouche ne bouge que pour les dialogues (les mots entre guillemets, les lignes `[Name]:` et les balises de locuteur), pas pour la narration, à peu près au rythme de la parole. Si le texte apparaît plus vite que quiconque ne pourrait le dire, la bouche accélère, puis saute en avant pour rester au niveau des mots affichés. Avec le streaming (l'affichage au fil de l'écriture) désactivé, les dialogues d'une réponse sont prononcés en huit secondes au plus. Quand la synthèse vocale lit une réplique, c'est la voix qui fait bouger la bouche : la narration d'un personnage lue avec sa voix fait donc aussi bouger sa bouche.

**Le corps.** Un avatar réfléchit entre le moment où tu envoies ton message et ses premiers mots, parle pendant que sa bouche bouge, écoute pendant que quelqu'un d'autre parle ou pendant que tu écris, et se repose le reste du temps.

**Les chats de groupe.** Dans un groupe Individual, c'est le membre qui répond qui parle, y compris quand tu demandes un swipe (une réponse alternative) sur le message d'un membre. Dans un groupe Merged, chaque paragraphe appartient au premier personnage qu'il nomme, ou à celui du paragraphe précédent. Tant qu'un paragraphe qui ne nomme personne s'affiche encore, ses dialogues attendent qu'un nom ou la fin du paragraphe indique qui parle. Avec le streaming désactivé dans un groupe Individual, seule la réponse du dernier membre fait bouger un avatar pour l'instant.

## Synchronisation labiale avec la synthèse vocale

Quand la synthèse vocale lit une réponse Roleplay, l'avatar du personnage qui parle bouge la bouche avec la voix. La bouche s'ouvre plus grand sur les sons forts et se ferme pendant les pauses. Elle change aussi de forme : elle s'arrondit sur les sons sombres comme "ou" et montre les dents sur des sons comme "s". Il n'y a rien de plus à configurer. Active la synthèse vocale comme expliqué dans [Configuration du Text to Speech (TTS)](../media/tts-setup.md) : la synchronisation labiale fonctionne avec **Auto-play** (lecture automatique) et avec le bouton **Speak** (lire à voix haute) d'un message, y compris dans la disposition visual novel.

- **Qui parle :** la bouche qui bouge est celle du personnage dont la voix lit la réplique, le même personnage pour lequel **Voice Option** (option de voix) choisit une voix. Quand une réponse a plusieurs locuteurs, la bouche de chaque personnage ne bouge que pendant ses propres répliques. Les répliques lues avec la voix du narrateur, et les locuteurs qui ne sont pas des personnages du chat, ne font bouger aucune bouche. Avec **Only read dialogues** (ne lire que les dialogues) désactivé, la narration propre d'un personnage est lue avec sa voix : sa bouche bouge donc aussi pour elle.
- **Pause, arrêt et changement de chat :** mettre la voix en pause ou l'arrêter arrête la bouche. Si tu passes à un autre chat pendant qu'une réponse est encore lue, les avatars de cet autre chat restent immobiles. Reviens au premier chat pendant que la voix joue encore : son avatar reprend la voix.
- **Volume :** le curseur **Line volume** (volume de la réplique) change le volume de la voix, pas l'ouverture de la bouche.
- **Personas :** la bouche d'un persona ne bouge pas pour tes propres messages, avec ou sans synthèse vocale.
- **Game Mode :** la narration de Game passe par l'audio propre au Game Mode ; en Game Mode, la bouche des avatars suit donc le texte pour l'instant.

La synchronisation labiale ne change pas la façon dont la voix est jouée. Marinara Engine lit une copie séparée de chaque clip vocal pour caler la bouche : la lecture fonctionne comme avant, y compris dans Safari et sur iPhone et iPad. Si ton navigateur ne peut pas lire un clip, la voix est quand même jouée, et seule la bouche cesse de la suivre.

<a id="making-an-avatar-from-a-sprite"></a>

## Créer un avatar à partir d'un sprite

Sur la page **2D Avatars** de l'éditeur d'agent, choisis un personnage ou un persona, puis utilise **Make an avatar from a sprite** (créer un avatar à partir d'un sprite). Cette section part des sprites que le personnage ou le persona a déjà. Ton avatar ne change pas tant que tu n'enregistres pas un résultat : tu peux donc essayer autant de fois que tu veux.

### Images de clignement et de parole

1. Choisis un ou plusieurs sprites, puis **Eyes closed** (yeux fermés), **Mouth open** (bouche ouverte) ou les deux. Quand le personnage ou le persona a des sprites de portrait, seuls ceux-là sont proposés, car l'avatar ne mélange jamais les visages de portrait et les visages en pied.
2. Vérifie le champ **Image connection** (connexion d'image) : ta connexion d'image par défaut y est déjà choisie. Sélectionne ensuite **Make pictures** (créer les images). Chaque image correspond à une requête d'image. Si **Expose media prompts before sending** (afficher les prompts médias avant l'envoi) est activé dans **Settings** (Paramètres), tu vois chaque prompt – le texte que Marinara envoie à l'IA – et tu peux le modifier d'abord.
3. Les nouvelles images apparaissent une à une. Sélectionne **Keep** (garder) sur celles qui sont réussies et **Try again** (réessayer) sur les autres. **Cancel** (annuler) arrête l'image en cours. Les images que tu as déjà restent quand tu en crées d'autres : **Make pictures** ne crée que celles qui manquent, et si **Try again** échoue, l'ancienne image reste. Pour refaire une image gardée, sélectionne d'abord **Kept** (gardée) pour la libérer.
4. Sélectionne **Save kept pictures** (enregistrer les images gardées). Elles deviennent les images de clignement et de parole de l'avatar PNGTuber pour ces expressions, à côté d'une copie du sprite d'origine, pour qu'elles soient toujours bien alignées. Si l'avatar affichait encore tes sprites tels quels, il les garde tous et reçoit en plus les nouvelles images. Si tu remplaces un sprite avant d'enregistrer, crée de nouveau ses images.

Les modèles d'image qui savent retoucher des images donnent les meilleurs résultats, car ils reçoivent ton sprite comme référence. Ton sprite est envoyé à la taille et au format que le modèle accepte, puis redécoupé dans le résultat : un modèle qui garde l'image en place donne donc des images bien alignées. Si une image change plus que les yeux ou la bouche, l'avatar saute quand il cligne des yeux ou parle ; réessaie celle-là.

<a id="mesh-avatar"></a>

### Avatar mesh

1. Choisis un sprite. Un buste de face (tête et épaules) donne les meilleurs résultats ; sur un sprite en pied, le visage est petit.
2. Choisis la connexion dans **Chat connection that can see pictures** (connexion de chat qui voit les images). **The agent's connection** (la connexion de l'agent) utilise la connexion définie sur la page 2D Avatars, sinon ta connexion d'agent par défaut. Son modèle doit accepter les images.
3. Sélectionne **Make mesh avatar** (créer l'avatar mesh). Le modèle de chat repère le visage, et Marinara Engine construit l'avatar à partir de ton sprite. **Cancel** l'arrête.
4. Vérifie l'aperçu : les contours doivent tomber sur les yeux, les sourcils et la bouche. Sélectionne **Save as mesh avatar** (enregistrer comme avatar mesh), ou **Discard** (abandonner) et essaie un autre sprite ou un autre modèle.

Un avatar mesh généré bouge la tête, les yeux, les sourcils et la bouche, et cligne des yeux et parle avec ses propres paupières et sa propre bouche. Ses cheveux suivent la tête ; les mains, les mèches isolées et les accessoires qui pendent ne sont pas animés. Quand le visage occupe la plus grande partie d'un grand sprite, l'avatar est construit à partir d'une copie plus petite, pour que la création reste rapide.

Ton sprite est envoyé à la connexion d'image pour les images de clignement et de parole (et à la connexion d'image de secours de cette connexion si elle échoue et qu'une connexion de secours est définie), et à la connexion de chat pour un avatar mesh. Les prompts sont fournis avec l'agent 2D Avatars. Avec **Expose media prompts before sending** activé, tu peux lire et modifier le prompt de chaque image avant son envoi. Avec le mode débogage activé, chaque prompt est écrit dans le log, le journal du serveur.

## Créer ton propre modèle

Tu n'as rien à créer pour commencer. Un personnage ou un persona qui a des sprites d'expression a déjà un avatar PNGTuber, et [Créer un avatar à partir d'un sprite](#making-an-avatar-from-a-sprite) ajoute des images de clignement et de parole ou construit un avatar mesh pour toi. Pour créer plutôt ton propre modèle, utilise l'un de ces outils. Les sprites s'affichent dès que tu les ajoutes, et chaque fichier s'importe sur la page de l'agent, dans **Agents**.

| Ce que tu veux | Outil | Ce que tu obtiens |
| --- | --- | --- |
| Des sprites PNGTuber | N'importe quelle application de dessin, puis l'onglet **Sprites** du personnage | Les sprites |
| Des sprites PNGTuber avec calques et costumes | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | Un fichier `.save` |
| Un avatar mesh | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | Un fichier `.mavatar` |
| Un modèle 3D | [VRoid Studio](https://vroid.com/en/studio), ou Blender avec le [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | Un fichier `.vrm`, et en option une animation au repos `.vrma` |

### Tes propres sprites

1. Dessine une image pour chaque émotion, toutes de la même taille et avec le personnage au même endroit. Nomme chacune d'après son émotion : `neutral`, `happy`, `angry`, `sad`, `relaxed` et `surprised`. Les noms qui contiennent un mot d'émotion fonctionnent aussi, comme `smile`, `cry`, `calm` ou `shock`.
2. Pour une bouche qui bouge, dessine la même image avec seulement la bouche ouverte et ajoute `_talk` à son nom, par exemple `happy_talk`. Pour le clignement, ferme seulement les yeux et ajoute `_blink` ; pour les deux, ajoute `_blink_talk`. Une émotion sans ces images sautille quand même en parlant.
3. Ajoute les images dans l'onglet **Sprites** du personnage ou du persona, sous **Facial Expressions** (expressions du visage). **Upload Folder** (téléverser un dossier) ajoute un dossier entier et nomme chaque sprite d'après son fichier. Voir [Sprites de personnage](../characters/sprites.md).
4. Les chats où 2D Avatars est activé les affichent tout de suite. Pour changer le visage d'une émotion ou le mouvement, voir [Sprites PNGTuber](#pngtuber-sprites).

### PNGTuber Plus

1. Construis l'avatar à partir de calques séparés. Règle la bouche ouverte pour qu'elle ne s'affiche que pendant la parole, et la bouche fermée seulement pendant le silence. Règle les yeux fermés pour qu'ils ne s'affichent que pendant un clignement, et les yeux ouverts seulement en dehors des clignements.
2. Pour chaque émotion, crée un costume qui change les yeux ou la bouche, et nomme ces images d'après l'émotion, par exemple `angry eyes.png` ou `happy_mouth.png`. Le costume 1 est le visage au repos.
3. Enregistre l'avatar pour obtenir un fichier `.save`.
4. Ouvre **2D Avatars** dans **Agents**, choisis le personnage ou le persona, puis **PNGTuber sprites** et **Import PNGTuber Plus save**. Choisis un visage pour chaque émotion que les noms n'ont pas couverte.

### Mesh Avatar Studio

1. Pars d'une image de face, tête et épaules, sur fond transparent. Mesh Avatar Studio tourne sur ton ordinateur avec Node.js, et un agent de programmation comme Claude Code ou Codex prépare l'image pour l'animation. Son README t'explique la marche à suivre.
2. Si tu veux, ajoute des yeux et des bouches dessinés sous **Drawn variants** (variantes dessinées). Marinara Engine utilise automatiquement ses formes de bouche (`mouth_a`, `mouth_i`, `mouth_o` et `mouth_a_half`) et ses yeux fermés (`eyes_closed_0` et `eyes_closed_1`). Chaque avatar mesh intègre les six émotions : il n'y a rien à nommer.
3. Choisis **Export .mavatar** (exporter en .mavatar). Ne crée pas toi-même une archive ZIP du dossier du projet.
4. Ouvre **2D Avatars** dans **Agents**, choisis le personnage ou le persona, puis **Mesh avatar** et **Import .mavatar file**.

### VRoid Studio

1. Crée le personnage dans VRoid Studio. Ses visages, ses formes de bouche et son clignement sont des expressions VRM standard : ils sont donc trouvés automatiquement.
2. Exporte-le au format VRM. VRM 1.0 et VRM 0.0 fonctionnent tous les deux. Renseigne les informations et les conditions du modèle quand VRoid Studio te les demande.
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

- **Compression.** La compression de maillage Draco ou meshopt et les textures KTX2 ne se chargent pas. Les exports VRM ci-dessus ne les utilisent jamais, mais l'export glTF simple de Blender propose Draco, et les optimiseurs de modèles peuvent ajouter les trois. Exporte de nouveau avec la compression désactivée.
- **glTF simple.** Un fichier `.glb` ou `.gltf` simple n'a pas les données VRM qui nomment ses visages et son squelette. Exporte plutôt un fichier `.vrm`.
- **Fichiers séparés.** Un modèle dont les textures ou les données sont dans des fichiers séparés n'est pas utilisable. Exporte un seul fichier `.vrm`.
- **Extras de PNGTuber Plus.** L'oscillation, le traînage et l'animation ne sont pas repris : chaque calque s'affiche au repos, et un calque animé affiche sa première image.

## Performances et appareils

Le code de dessin de chaque type d'avatar ne se télécharge que la première fois qu'un avatar de ce type s'affiche : les chats sans avatar ne chargent rien de plus.

| | Téléphones | Ordinateurs |
| --- | --- | --- |
| Avatars dessinés en même temps | 2 | 4 |
| Images par seconde pendant la parole | 30 | 30 |
| Images par seconde au repos | 20, ou 15 quand le téléphone est occupé | 30 |
| Netteté (ratio de pixels) | jusqu'à 1,5× | jusqu'à 2× |

Un chat affiche les avatars dans l'ordre de ses personnages, puis ton persona, jusqu'à cette limite. Les avatars cessent complètement d'être dessinés quand l'onglet est masqué, que la fenêtre est en arrière-plan, que les réglages d'apparence sont ouverts, ou que le chat est hors de l'écran ou recouvert par un panneau ou un éditeur. Avec **Reduce Ambient Animations & Effects** (réduire les animations et effets d'ambiance) ou le réglage de réduction des animations de ton appareil activé, les avatars changent toujours de visage et bougent toujours la bouche, mais sautent la respiration, le balancement et les poses d'attente.

## Guides associés

- [Agents : des aides IA pour tes chats](agents-overview.md)
- [Référence des agents téléchargeables](built-in-agents.md)
