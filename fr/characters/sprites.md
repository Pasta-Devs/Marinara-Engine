# Sprites de personnage (expressions et corps entier)

Ce guide explique comment ajouter des illustrations de personnage appelées sprites et comment les faire générer par l'IA. Il montre aussi comment nettoyer l'arrière-plan et régler l'affichage des sprites à l'écran. Les sprites fonctionnent en mode Roleplay et en Game Mode.

## Ce qu'est un sprite

Un sprite est une illustration de personnage debout : une image que Marinara Engine fait flotter au-dessus de la scène du chat. Marinara utilise deux types de sprite :

- **Facial Expressions** (expressions du visage) : des portraits pour différentes humeurs, comme joyeux, triste ou en colère.
- **Full-body** (corps entier) : des images en pied pour différentes poses, comme au repos, en marche ou en position de combat.

Les sprites ne s'affichent qu'en mode **Roleplay** et en **Game Mode**. Les chats en mode Conversation, eux, n'affichent aucun sprite. Rien ne t'empêche d'en téléverser depuis n'importe quel mode : un personnage conserve ses sprites, quel que soit le chat qui l'utilise.

Les sprites s'ajoutent personnage par personnage. Autre option : en ajouter à un persona, le personnage que tu incarnes. L'éditeur de persona propose le même onglet **Sprites** que celui décrit plus bas.

## Où trouver l'onglet Sprites

Les sprites se gèrent depuis l'éditeur de personnage (ou de persona).

1. Ouvre un personnage pour le modifier.
2. Clique sur l'onglet **Sprites** dans l'éditeur.
3. En haut de l'onglet, choisis une catégorie : **Facial Expressions**, **Full-body** ou **Clips**.

Ce guide traite des catégories **Facial Expressions** et **Full-body**. La catégorie **Clips** relève d'une autre fonctionnalité, dédiée aux appels audio et vidéo. Pour les clips, consulte [Appels audio et vidéo en mode Conversation](../conversation/calls.md).

## Téléverser tes propres sprites

Tu peux téléverser des images PNG, JPEG, GIF, WebP, AVIF et SVG passives. Les fichiers PNG transparents donnent le meilleur résultat : la zone vide autour du personnage laisse voir la scène. Une image de remplacement non prise en charge ou invalide est refusée sans retirer le sprite enregistré.

### Téléverser un sprite

1. Ouvre l'onglet **Sprites** et choisis **Facial Expressions** ou **Full-body**.
2. Clique sur **Add sprites** (ajouter des sprites), puis sur **Upload images** (téléverser des images). Tu peux sélectionner plusieurs images à la fois.
3. Chaque nom de fichier devient le libellé initial du sprite. Ouvre un sprite pour le renommer plus tard.

Les nouveaux sprites apparaissent hors dossier dans la grille habituelle. Dans l'éditeur de persona, utilise toujours le champ de nom de l'encadré **Add Sprite** (ajouter un sprite) et le bouton **Upload** (téléverser) pour un seul sprite.

### Téléverser un dossier entier d'un coup

Si tes sprites sont déjà rassemblés dans un dossier, importe-les tous en une seule opération.

1. Nomme chaque fichier image d'après l'expression ou la pose. Par exemple, un fichier nommé `admiration.png` crée une expression appelée admiration.
2. Ouvre **Add sprites**, puis clique sur **Import folder** (importer un dossier). Dans l'éditeur de persona, clique sur **Upload Folder** (téléverser un dossier) dans **Add Sprite**.
3. Choisis le dossier qui contient les images.

Chaque nom de fichier, extension mise à part, devient le nom du sprite. Pendant l'opération, une ligne de progression indique "Uploading X/Y sprites".

Les sous-dossiers deviennent des dossiers de sprites facultatifs. Un `catalog.json` exporté restaure aussi l'appartenance aux dossiers et les libellés modifiés. Les informations de dossier invalides sont signalées, et les images utilisables sont tout de même importées. Un import échoué ou partiel signale l'échec au lieu d'annoncer une réussite avec zéro image.

Pour créer plusieurs versions d'une même expression, donne-leur un nom commun avant un tiret bas. Par exemple, `happy_01.png` et `happy_blush.png` comptent tous deux comme des variantes de happy.

### Gérer un sprite

Ouvre un sprite de personnage pour l'afficher en aperçu avec ses actions. Les sprites de persona gardent leurs actions sur la vignette :

- **Frame** (recadrer) : recadre l'image pour placer le personnage où tu le souhaites.
- **Download** (télécharger) : enregistre le fichier du sprite sur ton ordinateur.
- **Replace** (remplacer) : téléverse une nouvelle image sous le même nom.
- **Rename** (renommer ; aperçu du personnage) : modifie son libellé, jusqu'à 160 caractères, en conservant son identifiant de fichier et son URL. Les références concrètes à l'image qui existent déjà continuent de fonctionner.
- **Folder** (dossier ; aperçu du personnage) ou **Move sprite** (déplacer le sprite ; vignette de persona) : choisis un dossier, ou **No folder** (aucun dossier), sans glisser.
- **Delete** (supprimer) : supprime ce sprite.

La suppression demande une confirmation. Dans l'éditeur de persona, **Delete All Expressions** ou **Delete All Full-Body** supprime toute la catégorie, même quand une recherche est active.

### Dossiers facultatifs et sélection

Clique sur **New folder** (nouveau dossier) pour créer un dossier replié nommé **unnamed**. Double-clique ou touche deux fois son nom pour le renommer ; utilise le chevron pour le déplier. Les expressions et les sprites en pied ont des dossiers séparés. Les dossiers apparaissent au-dessus des sprites hors dossier et se réordonnent par glisser-déposer.

Glisse des sprites un par un dans des dossiers dépliés ou repliés. Sur téléphone, maintiens le doigt sur une vignette pour commencer à la glisser ; un balayage normal fait toujours défiler la page. Glisse un sprite rangé vers la zone hors dossier pour le retirer de son dossier. La zone mise en évidence indique la destination. Le contrôle **Folder** de l'aperçu et le bouton **Move sprite** de la vignette de persona offrent une alternative au clavier.

Clique sur **Select** (sélectionner) pour afficher les cases à cocher et **Select all sprites** (sélectionner tous les sprites), puis glisse ensemble les sprites sélectionnés ou utilise les outils de nettoyage et de suppression disponibles. **Cancel** (annuler) quitte le mode sélection. La recherche filtre les sprites visibles ; une recherche sans résultat ne signifie pas que la bibliothèque est vide.

Les dossiers servent à ranger les sprites : ils ne choisissent jamais un ensemble actif et ne cachent aucune image aux chats ni aux agents. Supprimer un dossier laisse ses sprites hors dossier.

### Character Sheet

Dans l'éditeur de personnage, la ligne compacte **Character Sheet** s'ouvre avec **Manage** (gérer). Crée ou téléverse une fiche à cet endroit et active **Use as reference image** (utiliser comme image de référence) quand tu veux qu'elle soit privilégiée pour la ressemblance du personnage. Le choix des références et le repli sur l'avatar fonctionnent comme avant.

## Générer des sprites avec l'IA

Si une connexion d'images est configurée, Marinara peut dessiner les sprites à ta place. Une connexion, c'est le lien entre Marinara et un service d'IA. La génération de sprites demande une connexion d'images, et les sprites animés une connexion vidéo. Consulte [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md) pour en configurer une.

Pour commencer, clique sur **Generate Sprite** (générer un sprite) dans l'encadré **Add Sprite**. La fenêtre **Generate Sprites** s'ouvre. En haut, choisis une source : **Expressions (Portrait)** ou **Full-body**.

Remplis la fenêtre :

1. Choisis une connexion dans le menu déroulant **Image Generation Connection** (connexion de génération d'images).
2. Ajoute jusqu'à quatre **Reference Images** (images de référence) si tu veux que l'illustration respecte un style précis. Autre possibilité : coche la case pour utiliser l'avatar actuel comme référence.
3. Rédige une **Appearance Description** (description de l'apparence) du personnage. Ce champ est obligatoire.
4. Si tu le souhaites, active l'option **Transparent sprite background** (arrière-plan de sprite transparent). Marinara demande d'abord une transparence PNG native. Si le fournisseur ne renvoie pas de couche alpha, Marinara retient un fond vert, magenta ou cyan saturé, celui qui recoupe le moins les couleurs de la **Appearance Description**, puis le retire automatiquement.
5. Indique le nombre d'images à produire avec **Expression Count** (nombre d'expressions), ou **Pose Count** (nombre de poses) pour le corps entier, puis choisis les expressions ou les poses à remplir.
6. Clique sur le bouton **Generate** (générer).

À l'arrivée des images, tu les passes en revue. Tu peux activer ou désactiver chacune d'elles, la renommer et la recadrer avant d'enregistrer. Quand le résultat te convient, enregistre les images retenues dans le jeu de sprites du personnage.

Quand un seul sprite enregistré de cette catégorie porte le libellé généré, l'enregistrement remplace son image et conserve son dossier et son identifiant. Un sprite renommé pour ne plus porter ce libellé est préservé. Si le même libellé figure dans plusieurs dossiers, il faut choisir explicitement le sprite à remplacer pour viser le bon de façon fiable.

Dans la source **Full-body**, si le personnage possède déjà des expressions en portrait, tu peux cocher **Match existing expression sprites**. Marinara crée alors des poses en pied qui correspondent à chaque nom d'expression déjà présent.

Deux remarques sur la génération par IA :

- La génération peut prendre plusieurs minutes, même si le texte affiché dans l'application laisse entendre le contraire. Les services d'IA lents mettent plus de temps. Patiente plutôt que de tout recommencer.
- Sur certains appareils, notamment certaines installations Android, la génération de sprites par IA et le nettoyage d'arrière-plan ne sont pas disponibles. Dans ce cas, le bouton est désactivé et Marinara affiche la raison à l'écran.

### Sprites de portrait animés

Dans la source **Expressions (Portrait)** se trouve une case à cocher **Generate animated portraits** (générer des portraits animés). Une fois activée, Marinara produit de courts clips animés au lieu d'images fixes, puis transforme chaque clip en sprite GIF qui tourne en boucle. Un GIF est un fichier image qui joue une courte animation. Les portraits animés passent par une connexion vidéo, et non par une connexion d'images.

## Nettoyer l'arrière-plan des sprites

Un sprite rend mieux quand seul le personnage apparaît et que l'arrière-plan laisse voir la scène. Les sprites fixes générés utilisent la transparence native quand le fournisseur la prend en charge. Sinon, Marinara retire un fond chroma uni adaptatif avec un bord adouci, et en efface la couleur dans les cheveux, les tissus et les autres pixels partiellement transparents. Les anciens sprites sur arrière-plan blanc restent pris en charge.

### Nettoyer un sprite à la main

Ouvre l'aperçu du sprite de personnage et son action de nettoyage (la baguette), ou clique sur l'image d'un sprite de persona pour ouvrir l'éditeur de nettoyage. Tu peux y effacer l'arrière-plan, repeindre certaines zones et vérifier le résultat sur des fonds sombre, clair et en damier. Tu peux annuler, revenir à l'original et appliquer tes modifications une fois terminé.

### Nettoyer plusieurs sprites d'un coup

Dans l'éditeur de personnage, clique sur **Select**, choisis des sprites, puis clique sur **Clean Backgrounds** (nettoyer les arrière-plans). Dans l'éditeur de persona, le bouton de nettoyage s'applique aux sprites sélectionnés, ou à la catégorie affichée si rien n'est sélectionné.

1. Règle le curseur **Cleanup strength** (intensité du nettoyage). Il va de Soft à Aggressive, sur une échelle de 0 à 100, et démarre à 35. Une valeur élevée retire davantage d'arrière-plan, mais risque de mordre sur le personnage.
2. Clique sur **Clean Backgrounds** et confirme.

Après un nettoyage groupé, Marinara conserve une sauvegarde. Une ligne indique "Last cleanup has a restore point", avec un bouton **Undo Cleanup** (annuler le nettoyage). Clique dessus pour remettre chaque sprite concerné dans son état d'origine.

Le nettoyage d'arrière-plan fonctionne sur les images PNG, JPG, JPEG, WEBP et AVIF. Il ne fonctionne pas sur les fichiers GIF ni SVG.

Le nettoyage automatique examine l'image avant de choisir un moteur. Le nettoyage de fond intégré, rapide, traite d'abord les fonds chroma unis et les anciens arrière-plans blancs. Si la bordure n'est pas vraiment uniforme, Marinara peut se rabattre sur le module d'IA de suppression d'arrière-plan, à condition qu'il soit installé. Pour une scène chargée ou un sujet dont les couleurs sont presque identiques à celles de l'arrière-plan, l'éditeur de nettoyage manuel reste l'option la plus sûre.

## Exporter des sprites

Tu peux enregistrer les sprites d'un personnage sur ton ordinateur sous forme de fichier zip. Un zip est un fichier unique qui en rassemble plusieurs.

1. Ouvre l'onglet **Sprites**.
2. Clique sur **Export** (exporter) au-dessus de la grille du personnage, ou dans l'encadré **Add Sprite** du persona.
3. Choisis **Expressions only** ou **Full-body only** pour exporter la catégorie en cours, ou **All sprites** pour tout exporter.

Le téléchargement contient les fichiers image des sprites et un `catalog.json` pour les libellés et l'organisation en dossiers. Les transferts natifs pris en charge de personnages et de personas, ainsi que les sauvegardes de profil, conservent aussi ces métadonnées.

### Intégrations qui tiennent compte des dossiers

`GET /api/sprites/:ownerId` renvoie toujours tous les sprites, rangés ou non. `GET /api/sprites/:ownerId/catalog` ajoute les dossiers et l'appartenance pour les intégrations qui veulent découvrir ou importer un dossier à la fois. Chaque sprite inclut son identifiant stable `expression`, son `label` modifiable, `folderId` et son URL. Utilise les identifiants de dossier pour l'appartenance ; le tableau `folders` est l'ordre enregistré, que l'éditeur affiche à l'envers pour que les nouveaux dossiers apparaissent en premier. L'ordre des dossiers ne fixe ni la priorité ni la disponibilité pour les agents.

Le navigateur de ressources du chat affiche les libellés modifiés, mais insère des liens concrets `card://sprites/<ownerId>/<filename>`, qui fonctionnent toujours après un renommage. Les liens propres au chat comme `card://sprites/facial/joy.png` peuvent aussi résoudre le libellé modifié ; un nom de fichier correspondant existant est prioritaire.

Des métadonnées facultatives absentes ou illisibles ne masquent pas les images utilisables. Les modifications refusent les métadonnées endommagées au lieu de les remplacer en silence. Les listes en lecture seule ignorent les bibliothèques inaccessibles ; l'export et les écritures refusent toujours les dossiers de propriétaire liés.

## Comment les sprites s'affichent dans le chat

Téléverser des sprites ne fait que la moitié du travail. Tu décides aussi quand et comment ils apparaissent pendant un chat. Cela se règle dans les réglages du chat, pas dans l'éditeur de personnage.

### Mode Roleplay

En mode **Roleplay**, c'est l'agent optionnel **Expression Engine** qui pilote l'affichage des sprites. Télécharge-le depuis **Agents → Agent Organizer (organisateur d’agents)**, puis ajoute-le au chat. Il analyse l'humeur de chaque message et choisit le sprite d'expression correspondant. Consulte [Référence des agents téléchargeables](../agents/built-in-agents.md) pour le détail.

Pour que les sprites apparaissent dans un chat Roleplay, il faut que toutes ces conditions soient réunies :

- L'agent **Expression Engine** est activé pour le chat.
- Au moins un personnage ou le persona actif est désigné comme porteur de sprites.
- Au moins une source de sprites est activée.

Ouvre les réglages du chat et repère la carte de l'agent **Expression Engine**. C'est là que tu règles l'affichage des sprites :

- **Sprite Source** (source des sprites) : choisis **Expressions**, **Full-body** ou les deux. Les deux sont actives par défaut. Au moins une doit le rester.
- **Expression Avatars** : remplace le petit avatar du message par le sprite d'expression correspondant, au lieu d'afficher une image flottante par-dessus la scène. Cette option est désactivée par défaut et ne concerne que le mode Roleplay.

### Game Mode

En **Game Mode**, un sprite en pied s'affiche automatiquement pour le personnage qui parle ou qui combat. L'agent Expression Engine n'est pas nécessaire. Il suffit d'avoir téléversé des sprites de corps entier pour ce personnage. Consulte [Game Mode : premiers pas](../game/getting-started.md) pour la configuration générale du Game Mode.

### Déplacer et redimensionner les sprites (mode Arrange)

Dès qu'un porteur de sprites est activé, la carte de l'agent **Expression Engine** affiche une section **Sprite Layout** (disposition des sprites).

- Clique sur **Arrange** (disposer) pour passer en mode glisser-déposer, puis fais glisser chaque sprite à l'endroit voulu. Clique sur **Done** (terminé) une fois satisfait.
- Le bouton **Reset** efface tes positions personnalisées et rétablit la disposition automatique.
- **Default Side** (côté par défaut) définit si les nouveaux sprites penchent vers la gauche, **Left**, ou vers la droite, **Right**. La valeur par défaut est **Left**. Changer de côté retourne la disposition en cours.
- Quatre curseurs règlent la taille et la transparence : **Expression Size** et **Full-body Size** vont de 5 % à 200 %. **Expression Opacity** et **Full-body Opacity** vont de 15 % à 100 %. Tous démarrent à 100 %.

## Clips d'appel vidéo

La catégorie **Clips** de l'onglet **Sprites** relève d'une autre fonctionnalité. Elle produit de courtes vidéos en boucle qui tiennent lieu de caméra au personnage pendant un appel audio ou vidéo en mode Conversation. Comme elle appartient à la fonctionnalité d'appel, elle est documentée à part. Consulte [Appels audio et vidéo en mode Conversation](../conversation/calls.md).

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
- [Game Mode : premiers pas](../game/getting-started.md)
- [Appels audio et vidéo en mode Conversation](../conversation/calls.md)
- [Expressions animées](../media/animated-expressions.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
