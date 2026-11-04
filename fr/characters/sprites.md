# Sprites de personnage (expressions et corps entier)

Un sprite est une image de ton personnage pour une humeur donnée, comme joyeux ou triste. Marinara l'affiche en surimpression au-dessus de la scène du chat. Tu peux téléverser les tiens, les générer avec l'IA, nettoyer leur arrière-plan et régler leur affichage.

Avant de commencer : nomme chaque fichier d'après l'humeur, par exemple `happy.png`, pour que Marinara puisse le choisir. Dans un chat Roleplay, les sprites demandent aussi que l'agent **Expression Engine** (une aide qui choisit le sprite) soit activé. Voir [Comment les sprites s'affichent dans le chat](#how-sprites-show-up-in-your-chat).

Il existe deux types de sprite :

- **Facial Expressions** (expressions du visage) : des portraits pour des humeurs comme joyeux, triste ou en colère.
- **Full-body** (corps entier) : des images en pied pour des poses comme au repos, en marche ou en position de combat.

Les sprites s'affichent à l'écran en mode Roleplay et en Game Mode, pas dans les chats Conversation. Tu peux les téléverser depuis n'importe quel mode, car un personnage garde ses sprites dans chaque chat. Un persona possède le même onglet **Sprites**.

## Trouver l'onglet Sprites

1. Ouvre un personnage (ou un persona) dans son éditeur.
2. Clique sur l'onglet **Sprites**.
3. En haut, choisis une catégorie : **Facial Expressions**, **Full-body** ou **Clips**.

Les sections ci-dessous traitent de **Facial Expressions** et de **Full-body**. **Clips** relève de la fonctionnalité d'appel. Voir [Appels audio et vidéo en Conversation](../conversation/calls.md).

## Téléverser tes propres sprites

Tu peux téléverser des images PNG, JPEG, GIF, WebP, AVIF et SVG. Les fichiers PNG transparents donnent le meilleur résultat, car la zone vide autour du personnage reste transparente. Une image de remplacement invalide est refusée, et le sprite enregistré reste en place.

### Téléverser un ou plusieurs sprites

1. Ouvre l'onglet **Sprites** et choisis **Facial Expressions** ou **Full-body**.
2. Clique sur **Add sprites** (ajouter des sprites).
3. Clique sur **Upload images** (téléverser des images) et choisis tes fichiers. Tu peux en sélectionner plusieurs à la fois.
4. Chaque nom de fichier devient le nom du sprite (son libellé). Ouvre un sprite pour le renommer plus tard.

Les nouveaux sprites apparaissent dans la grille, hors de tout dossier. Dans l'éditeur de persona, utilise le champ de nom **Add Sprite** (ajouter un sprite) et le bouton **Upload** (téléverser) pour un seul sprite.

### Téléverser un dossier entier

1. Nomme tes fichiers image d'après l'expression ou la pose, par exemple `admiration.png` pour une expression appelée admiration.
2. Ouvre **Add sprites** et clique sur **Import folder** (importer un dossier). Dans l'éditeur de persona, clique sur **Upload Folder** (téléverser un dossier) dans **Add Sprite**.
3. Choisis le dossier qui contient tes images.

Chaque nom de fichier, extension mise à part, devient le nom du sprite. Une ligne de progression indique "Uploading X/Y sprites". Les sous-dossiers deviennent des dossiers de sprites facultatifs. Un `catalog.json` issu d'un export restaure aussi les dossiers et les libellés modifiés. Une entrée de dossier défectueuse est signalée, et les images utilisables sont tout de même importées.

Si ça n'a pas marché : un import échoué ou partiel signale l'échec au lieu d'annoncer une réussite avec zéro image. Vérifie les types de fichier ci-dessus.

### Variantes de nom

| Nom de fichier | Ce qu'il signifie |
| --- | --- |
| `happy_01.png`, `happy_blush.png` | Deux images joyeuses. Commence les deux noms par `happy_`. |
| `happy_pajamas.png` | Joyeux, en pyjama. Mets d'abord l'humeur, puis la tenue. |
| `angry_formalwear_soaked_01.png` | En colère, en tenue habillée, trempé. Un nombre final indique seulement une autre version de la même image. |

L'agent Expression Engine voit à la fois l'expression (`happy`) et le nom complet (`happy_pajamas`). Si aucun sprite ne porte tous les mots, c'est le dernier mot qui est retiré en premier : en l'absence de `happy_pajamas_wounded`, Marinara se rabat sur `happy_pajamas`, puis sur n'importe quel sprite happy.

<a id="how-sprites-show-up-in-your-chat"></a>

## Comment les sprites s'affichent dans le chat

Tu choisis quand et comment les sprites apparaissent dans les réglages du chat, pas dans l'éditeur de personnage.

### Mode Roleplay

L'agent Expression Engine pilote les sprites en Roleplay. Un agent est une aide qui fonctionne en parallèle des réponses. Voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md). L'Expression Engine lit l'humeur de chaque message et choisit le sprite d'expression correspondant. Ajoute-le au chat, et installe-le depuis **Agent Organizer** si tu ne l'as pas. Voir [Référence des agents téléchargeables](../agents/built-in-agents.md#expression-engine).

Pour que les sprites apparaissent, toutes ces conditions doivent être réunies :

- L'agent Expression Engine est activé pour le chat.
- Au moins un personnage, ou le persona, est désigné comme porteur de sprites.
- Au moins une source de sprites est activée.

Ouvre **Chat Settings → Agents** (réglages du chat → Agents) et repère la carte **Expression Engine** :

- **Sprite Source** (source des sprites) vaut **Expressions**, **Full-body** ou les deux. Les deux sont activées par défaut, et au moins une doit le rester.
- **Expression Avatars** (avatars d'expression) remplace le petit avatar du message par le sprite d'expression correspondant. Cette option est désactivée par défaut et ne fonctionne qu'en Roleplay.
- **Only show active sprites** (n'afficher que les sprites actifs) n'affiche que les personnages du dernier résultat terminé, et garde les sprites actuels visibles pendant la production du résultat suivant.

### Game Mode

En Game Mode, un sprite en pied s'affiche automatiquement pour le personnage qui parle ou qui combat. Tu n'as pas besoin de l'Expression Engine, seulement de sprites en pied pour ce personnage. Voir [Game Mode : premiers pas](../game/getting-started.md).

### Déplacer et redimensionner les sprites

Dès qu'un porteur de sprites est activé, la carte **Expression Engine** affiche **Sprite Layout** (disposition des sprites).

1. Clique sur **Arrange** (disposer), puis fais glisser chaque sprite à l'endroit voulu.
2. Clique sur **Done** (terminé).

**Reset** (réinitialiser) efface tes positions et rétablit la disposition automatique. **Default Side** (côté par défaut) vaut **Left** ou **Right**, et démarre sur Left. Le changer retourne ta disposition actuelle. **Apply to** (appliquer à) permet de régler la disposition pour tous les personnages ou pour un seul.

Quatre curseurs règlent la taille et la transparence. **Expression Size** et **Full-body Size** vont de 5 % à 200 %. **Expression Opacity** et **Full-body Opacity** vont de 0 % à 100 %. Les tailles et les opacités démarrent à 100 %.

## Générer des sprites avec l'IA

Avant de commencer : ajoute une connexion de génération d'images. Pour les sprites animés, il te faut aussi une connexion vidéo. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

1. Ouvre **Add sprites** et clique sur **Generate Sprite** (générer un sprite). Dans l'éditeur de persona, le bouton se trouve dans **Add Sprite**. La fenêtre **Generate Sprites** s'ouvre.
2. En haut, choisis une source : **Expressions (Portrait)** ou **Full-body**.
3. Choisis une connexion dans **Image Generation Connection** (connexion de génération d'images).
4. Si tu veux, ajoute jusqu'à quatre **Reference Images** (images de référence), ou coche la case pour utiliser l'avatar actuel comme référence.
5. Remplis le champ **Appearance Description** (description de l'apparence). Il est obligatoire.
6. Si tu le souhaites, active **Transparent sprite background** (arrière-plan de sprite transparent). Marinara rend l'arrière-plan transparent. Si le service ne peut pas le faire, Marinara dessine un fond uni vert, magenta ou cyan, différent des couleurs du champ **Appearance Description**, puis le retire.
7. Règle **Expression Count** (nombre d'expressions), ou **Pose Count** (nombre de poses) pour le corps entier, et choisis les expressions ou les poses à créer.
8. Clique sur **Generate** (générer).

À l'arrivée des images, active ou désactive chacune d'elles, renomme-la et recadre-la. Enregistre ensuite les images sélectionnées dans les sprites du personnage. Si exactement un sprite enregistré de cette catégorie porte le libellé généré, l'enregistrement remplace son image et conserve son dossier et son identifiant. Un sprite que tu as renommé pour ne plus porter ce libellé est conservé. Si le même libellé figure dans plusieurs dossiers, remplace à la main le sprite que tu vises.

Dans la source **Full-body**, si le personnage a déjà des expressions en portrait, coche **Match existing expression sprites** (accorder aux sprites d'expression existants) pour créer des poses en pied qui correspondent à chaque nom d'expression.

La génération peut prendre quelques minutes, davantage sur les services lents. Patiente plutôt que de tout recommencer. Sur certains appareils, comme certaines installations Android, la génération de sprites par IA et le nettoyage d'arrière-plan ne sont pas disponibles. Le bouton est désactivé et Marinara affiche la raison.

### Portraits animés

Dans la source **Expressions (Portrait)**, **Generate animated portraits** (générer des portraits animés) crée de courts clips animés et transforme chacun en sprite GIF qui tourne en boucle. Un GIF est un fichier image qui joue une courte animation. Cette option utilise une connexion vidéo au lieu d'une connexion d'images. Voir [Expressions animées](../media/animated-expressions.md).

## Nettoyer l'arrière-plan des sprites

Un sprite rend mieux quand seul le personnage apparaît. Les sprites générés utilisent la transparence native quand le service la prend en charge. Sinon, Marinara retire une couleur de fond unie et adaptative avec un bord adouci, et efface cette couleur des cheveux, des tissus et des autres pixels partiellement transparents. Les anciens sprites sur fond blanc fonctionnent toujours.

### Nettoyer un sprite à la main

Ouvre l'aperçu du sprite de personnage et utilise son action de nettoyage (la baguette), ou clique sur l'image d'un sprite de persona. L'éditeur de nettoyage te permet d'effacer l'arrière-plan, de repeindre certaines zones et de vérifier le résultat sur des fonds sombre, clair et en damier. Tu peux annuler, revenir à l'original et appliquer tes modifications une fois terminé.

### Nettoyer plusieurs sprites d'un coup

1. Dans l'éditeur de personnage, clique sur **Select** (sélectionner) et choisis des sprites. Dans l'éditeur de persona, le bouton de nettoyage s'applique aux sprites sélectionnés, ou à la catégorie affichée si rien n'est sélectionné.
2. Clique sur **Clean Backgrounds** (nettoyer les arrière-plans).
3. Règle le curseur **Cleanup strength** (intensité du nettoyage), de **Soft** à **Aggressive**, sur une échelle de 0 à 100. Il démarre à 35. Une valeur élevée retire davantage d'arrière-plan, mais risque de mordre sur le personnage.
4. Confirme.

Marinara conserve une copie de sécurité. Une ligne indique "Last cleanup has a restore point", avec **Undo Cleanup** (annuler le nettoyage). Clique dessus pour remettre chaque sprite concerné dans son état d'avant.

Le nettoyage fonctionne sur les formats PNG, JPG, JPEG, WEBP et AVIF. Il ne fonctionne pas sur GIF ni SVG.

Le nettoyage automatique examine d'abord l'image. Le nettoyage intégré, rapide, traite les fonds de couleur unie et les anciens fonds blancs. Si la bordure n'est pas uniforme, Marinara peut se rabattre sur le module d'IA facultatif de suppression d'arrière-plan, s'il est installé. Pour une scène chargée, ou un sujet dont les couleurs ressemblent à celles de l'arrière-plan, l'éditeur manuel reste l'option la plus sûre.

## Gérer les sprites

Ouvre un sprite de personnage pour l'afficher en aperçu et voir ses actions. Les sprites de persona gardent leurs actions sur la vignette.

- **Frame** (recadrer) recadre l'image pour placer le personnage où tu le souhaites.
- **Download** (télécharger) enregistre le fichier du sprite.
- **Replace** (remplacer) téléverse une nouvelle image sous le même nom.
- **Rename** (renommer ; aperçu du personnage) modifie son libellé, jusqu'à 160 caractères, et conserve son identifiant de fichier et son URL : les références existantes à l'image continuent donc de fonctionner.
- **Folder** (dossier ; aperçu du personnage) ou **Move sprite** (déplacer le sprite ; vignette de persona) choisit un dossier, ou **No folder** (aucun dossier), sans glisser.
- **Delete** (supprimer) supprime ce sprite après confirmation. Dans l'éditeur de persona, **Delete All** (tout supprimer) suivi du nom de la catégorie supprime toute la catégorie, même quand une recherche est active.

### Dossiers et sélection

Clique sur **New folder** (nouveau dossier) pour créer un dossier replié nommé **unnamed**. Double-clique ou touche deux fois son nom pour le renommer, et utilise le chevron pour le déplier. Les expressions et les sprites en pied ont des dossiers séparés. Les dossiers apparaissent au-dessus des sprites hors dossier et se réordonnent par glisser-déposer.

Glisse des sprites dans un dossier, ou glisse un sprite rangé vers la zone hors dossier pour le retirer de son dossier. Sur téléphone, maintiens le doigt sur une vignette pour commencer à la glisser. Un balayage normal fait toujours défiler la page. Les dossiers servent seulement à ranger : ils ne choisissent jamais un ensemble actif et ne cachent aucune image aux chats ni aux agents. Supprimer un dossier laisse ses sprites hors dossier.

Clique sur **Select** pour afficher les cases à cocher et **Select all sprites** (sélectionner tous les sprites), puis glisse ensemble les sprites sélectionnés ou utilise le nettoyage et la suppression. **Cancel** (annuler) quitte le mode sélection. La recherche filtre les sprites visibles. Une recherche sans résultat ne signifie pas que la bibliothèque est vide.

### Character Sheet

Dans l'éditeur de personnage, la ligne **Character Sheet** s'ouvre avec **Manage** (gérer). Crée ou téléverse une fiche à cet endroit. Active **Use as reference image** (utiliser comme image de référence) pour qu'elle soit privilégiée pour la ressemblance du personnage.

## Exporter des sprites

1. Ouvre l'onglet **Sprites**.
2. Clique sur **Export** (exporter) au-dessus de la grille du personnage, ou dans l'encadré **Add Sprite** du persona.
3. Choisis **Expressions only** ou **Full-body only** pour exporter la catégorie en cours, ou **All sprites** pour tout exporter.

Tu obtiens un zip avec les fichiers des sprites et un `catalog.json` pour les libellés et les dossiers. Les exports natifs de personnages et de personas, ainsi que les sauvegardes de profil, conservent aussi ces données.

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
- [Game Mode : premiers pas](../game/getting-started.md)
- [Appels audio et vidéo en Conversation](../conversation/calls.md)
- [Expressions animées](../media/animated-expressions.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)

## Référence pour les développeurs : API des sprites et liens

`GET /api/sprites/:ownerId` renvoie tous les sprites, rangés ou non. `GET /api/sprites/:ownerId/catalog` ajoute les dossiers et l'appartenance, pour les outils qui importent un dossier à la fois. Chaque sprite a un identifiant stable `expression`, un `label` modifiable, un `folderId` et une URL. Utilise les identifiants de dossier pour l'appartenance. Le tableau `folders` suit l'ordre enregistré, que l'éditeur affiche à l'envers pour que les nouveaux dossiers apparaissent en premier. L'ordre des dossiers ne fixe ni la priorité ni la disponibilité pour les agents.

Le navigateur de ressources du chat affiche les libellés modifiés, mais insère des liens concrets `card://sprites/<ownerId>/<filename>`, qui fonctionnent toujours après un renommage. Les liens propres au chat comme `card://sprites/facial/joy.png` peuvent aussi résoudre le libellé modifié. Un nom de fichier correspondant existant est prioritaire.

Des métadonnées facultatives absentes ou illisibles ne masquent pas les images utilisables. Les modifications refusent les métadonnées endommagées au lieu de les remplacer. Les listes en lecture seule ignorent les bibliothèques inaccessibles, et l'export et les écritures refusent les dossiers de propriétaire liés.
