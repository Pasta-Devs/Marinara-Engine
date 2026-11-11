# Couleurs des personnages et Caractéristiques de Roleplay

Les onglets **Colors** (couleurs) et **Stats** (caractéristiques) se trouvent à la fois dans le Character Editor (éditeur de personnage) et dans le Persona Editor (éditeur de persona). Les couleurs changent l'apparence d'un personnage ou d'un persona dans le chat. Les caractéristiques permettent de suivre des valeurs comme la santé ou la faim.

## L'onglet Colors

L'onglet **Colors** règle trois couleurs : celle du nom, celle des dialogues et celle de la bulle de message. Laisse un champ vide pour utiliser la couleur du thème de l'application pour cet élément.

1. Ouvre un personnage ou un persona dans son éditeur.
2. Clique sur l'onglet **Colors**.
3. Une carte **Preview** (aperçu) en direct montre un exemple de nom et de bulle de message, avec les champs de couleur en dessous. L'aperçu se met à jour à chaque changement de couleur, avant que tu enregistres.

### Extract Colors from Avatar

**Extract Colors from Avatar** (extraire les couleurs de l'avatar) choisit les trois couleurs à partir de l'image de l'avatar. Tant qu'aucun avatar n'existe, le bouton est désactivé et affiche **Upload an avatar first**. Tu peux ensuite encore modifier chaque couleur à la main.

### Les trois couleurs

Règle chaque couleur avec le champ de couleur, ou saisis une valeur :

| Champ | Ce qu'il colore | Exemple de valeur |
| --- | --- | --- |
| **Name Display Color** (couleur d'affichage du nom) | Le nom. Il accepte aussi un dégradé, voir plus bas. | `#f59e0b` |
| **Dialogue Highlight Color** (couleur de surbrillance des dialogues) | Le texte placé entre guillemets de dialogue. | `#ffd700` |
| **Message Box Color** (couleur de la bulle de message) | Le fond de la bulle de message en Roleplay. | `#123456` |

**Name Display Color** accepte aussi un dégradé CSS, un fondu progressif entre plusieurs couleurs :

```text
linear-gradient(90deg, #f59e0b, #ef4444)
```

L'onglet **Colors** d'un personnage contient aussi **Name Aliases** (alias du nom). Saisis d'autres noms ou surnoms, séparés par des virgules, par exemple `Kate, Kitty, Katherine`. Ils prennent la couleur du nom du personnage quand ils apparaissent dans les messages du chat. Le nom principal est toujours inclus. Active cette option chat par chat dans **Chat Settings → Characters** (réglages du chat → personnages).

Pour changer la transparence, utilise **Settings → Appearance → Roleplay Presentation → Roleplay Messages Background Opacity** (Paramètres → Apparence → Présentation Roleplay → Opacité de l'arrière-plan des messages Roleplay).

Ce curseur met à l'échelle la transparence enregistrée dans la couleur de la bulle de message de ton personnage et de ton persona : une couleur qui a son propre alpha, comme `rgba(255, 255, 255, 0.25)` ou `#FFFFFF40`, s'affiche avec cet alpha multiplié par la valeur du curseur. Tes valeurs de couleur enregistrées restent telles quelles. Les couleurs du nom et des dialogues ne sont pas affectées.

Avec **Apply preset colors** (appliquer les couleurs du preset) activé, une couleur d'arrière-plan que tu choisis pour le widget du chat définit le remplissage de la bulle, et le curseur règle directement la transparence de ce remplissage.

Les points d'accroche d'arrière-plan des thèmes personnalisés et le CSS de fiche peuvent toujours prendre le pas sur le style des bulles de l'application.

<a id="where-your-colors-show"></a>

### Où tes couleurs apparaissent

- La couleur du nom colore le nom affiché dans les messages du chat. Pour un personnage, elle colore aussi le nom dans les onglets de la barre latérale. Pour un persona, elle colore aussi le nom dans les sélecteurs de persona.
- La couleur des dialogues colore le texte placé entre guillemets de dialogue, avec les guillemets droits comme avec les autres styles de guillemets. Tu peux aussi mettre ce texte en gras dans **Settings** (Paramètres). Les chats Conversation ne l'utilisent pas.
- La couleur de la bulle définit l'arrière-plan des bulles de message de ce personnage ou de ce persona dans les chats Roleplay. Les chats Conversation et Game ne l'utilisent pas.

## L'onglet Stats

L'onglet **Stats** définit des nombres comme les HP (points de vie), la STR (force) ou une barre de faim. Quand tu actives les caractéristiques, Marinara ajoute les valeurs au prompt – le texte que Marinara envoie à l'IA – pour que l'IA connaisse l'état actuel. Les valeurs que tu définis sont les valeurs de départ par défaut des nouveaux chats. Les agents peuvent ensuite en modifier certaines en cours de partie (voir [Comment les agents mettent à jour tes caractéristiques](#how-agents-update-your-stats)).

Les onglets **Stats** d'un personnage et d'un persona sont organisés différemment.

### Caractéristiques d'un personnage

Un personnage a un seul interrupteur, **Enable Roleplay Stats** (Activer les Caractéristiques de Roleplay). Désactivé, rien de ce qui suit n'est affiché ni envoyé. Activé, deux sections apparaissent :

- Les **Pools** sont des barres nommées avec une valeur actuelle, un maximum et une couleur. Les nouveaux personnages démarrent avec HP et MP, chacune à 100 sur 100.
- Les **Attributes** sont des nombres nommés. Les nouveaux personnages démarrent avec STR, DEX, CON, INT, WIS et CHA, chacun à 10.

Clique sur **Add** (ajouter) pour créer une réserve ou un attribut, et sur le X d'une ligne pour le supprimer.

### Caractéristiques d'un persona

L'onglet **Stats** d'un persona contient deux blocs distincts, chacun avec son propre interrupteur.

- Les **Persona Status Bars** (barres d'état du persona), activées avec **Enable Persona Stats** (activer les caractéristiques du persona), suivent les besoins physiques et mentaux. Les barres de départ sont Satiety, Energy, Hygiene et Mood, chacune à 100 sur 100. Sous **Status Bars** (barres d'état), chaque barre a un nom, une valeur actuelle, un maximum et une couleur. Clique sur **Add** pour en créer une et sur le X pour en supprimer une.
- **Enable Roleplay Stats** (Activer les Caractéristiques de Roleplay) fonctionne comme sur une fiche de personnage. Il donne à ton persona des **Pools** (au départ HP et MP à 100 sur 100) et des **Attributes** (au départ STR, DEX, CON, INT, WIS et CHA à 10).

<a id="mrpg-picks-on-a-card"></a>

### Choix MRPG sur une fiche

Les deux onglets **Stats** ont une section **Game Mode** avec un bloc **MRPG**, pour les parties utilisant les classes MRPG (toutes les nouvelles parties). Chaque partie tire à nouveau les caractéristiques MRPG de chaque personnage : la fiche ne contient donc aucun nombre, seulement trois choix. Un assistant les demande un par un :

1. **Tree** (arbre) : l'arbre dans lequel le personnage commence. **Auto** le déduit de la description et de la personnalité de la fiche, et affiche l'arbre obtenu.
2. **Strong in** (fort en) : jusqu'à deux caractéristiques dans lesquelles le personnage progresse bien. Chacune indique son effet.
3. **Weak in** (faible en) : une caractéristique dans laquelle il progresse mal, ou aucune.
4. **Review** (récapitulatif) : la classe avec laquelle une nouvelle partie le fait commencer, au niveau 1, avec sa ligne, toutes ses caractéristiques, ses MP et sa Stamina.

Chaque choix est conservé dès que tu le fais, et **Back** (retour), **Next** (suivant) et les noms des étapes permettent de passer d'une étape à l'autre. Clique sur **Finish** (terminer) à la dernière étape. Le bloc affiche alors le récapitulatif : la classe de départ et ses caractéristiques, avec les fortes et la faible signalées. Clique sur **Edit** (modifier) pour reprendre l'assistant. Enregistre la fiche comme d'habitude pour conserver les changements.

Les choix forts et faibles orientent la progression cachée du personnage dans chaque partie. Son arbre frère vient de son tempérament dans la partie, pas de la fiche. Voir [Game Mode : classes MRPG](../game/mrpg-classes.md#choose-a-characters-trees).

Les **Roleplay Stats** (Caractéristiques de Roleplay) sous le bloc sont les réserves et les attributs décrits plus haut. Les chats Roleplay et les parties Legacy les utilisent. Une partie MRPG utilise plutôt le bloc MRPG et ne crée jamais de fiche à partir d'eux.

<a id="game-mode-icon"></a>

### Icône de Game Mode

Les deux onglets **Stats** ont un bloc **Game Mode Icon** (icône de Game Mode). Il définit l'image du pion rond de ce personnage ou de ce persona sur le plateau lors d'un combat en Game Mode. Un petit pion à côté des choix montre ce que le plateau affichera.

- **Avatar** : c'est l'option par défaut. Elle utilise l'avatar, ou les initiales quand il n'y a pas d'avatar.
- **Custom image** : utilise une image de la galerie de la fiche elle-même. Choisis l'une de celles qui y sont affichées, ou téléverses-en une nouvelle, qui est ajoutée à la galerie. Enregistre la fiche une fois avant d'utiliser cette option.
- **Initials** : affiche toujours les initiales, même avec un avatar.

La même image s'affiche pour ce personnage dans les autres styles de combat. Si tu supprimes l'image choisie de la galerie, le bloc le signale. Choisis-en une autre ou reviens à **Avatar**.

<a id="ruleset-sheets"></a>

### Fiches d'ensembles de règles

Quand un ensemble de règles de Game Mode est installé, comme 5e (SRD 5.1), les deux onglets **Stats** gagnent un bloc **Ruleset sheets** (fiches d'ensembles de règles) sous les sections ci-dessus. Il contient une entrée dépliable par ensemble de règles installé. Il apparaît aussi quand une fiche de personnage contient encore une fiche pour un ensemble de règles que tu n'as plus.

Une fiche d'ensemble de règles est la configuration de départ de ce personnage pour cet ensemble. Une nouvelle partie sur cet ensemble de règles en prend une copie. Les changements faits pendant une partie restent dans cette partie et ne reviennent jamais sur la fiche de personnage.

1. Déplie l'entrée et clique sur **Add a sheet** (ajouter une fiche). Tu obtiens une fiche vierge dont chaque valeur est celle par défaut de l'ensemble de règles.
2. Remplis-la. La disposition vient de l'ensemble de règles : les valeurs de caractéristiques avec leurs modificateurs, les champs regroupés par section, les listes comme les attaques et les sorts, et les compétences et sauvegardes avec un niveau d'entraînement et un bonus supplémentaire. Les valeurs calculées, comme un bonus de maîtrise ou la Perception passive, se mettent à jour pendant la saisie et ne sont pas modifiables.
3. Enregistre le personnage ou le persona comme d'habitude.

Tu peux aussi demander à Professor Mari de remplir ou de modifier une fiche, par exemple "donne à Rook une valeur de Brawn de 2 et ajoute un pied-de-biche à l'équipement de Rook". Elle écrit uniquement la fiche de cet ensemble de règles, garde chaque valeur dans les limites de l'ensemble de règles et affiche la modification dans un encart de modification.

Certains ensembles de règles fournissent des sorts, des attaques et des capacités tout prêts. Les listes qu'ils remplissent ont un bouton **Add from catalog** (ajouter depuis le catalogue) qui ouvre un sélecteur avec recherche. Les lignes qu'il ajoute sont des copies que tu peux modifier comme les autres.

- Une cellule que l'ensemble de règles gère pour toi, comme des utilisations qui suivent une valeur de caractéristique ou une ressource de classe qui augmente avec le niveau, s'affiche à sa place mais ne peut pas être saisie. Elle porte la note "Set by the ruleset" et est recalculée chaque fois que tu modifies la fiche.
- Quand le texte propre à l'ensemble de règles pour l'une de ces lignes a changé depuis que tu l'as choisie, une ligne sous la liste indique combien de lignes ont un texte plus récent, avec un bouton **Review** (examiner). L'examen montre chaque ligne avec ton texte à côté de celui de l'ensemble de règles, et une case à cocher par ligne. **Update selected** (mettre à jour la sélection) écrit uniquement les lignes cochées. Seul le texte est comparé. Les nombres, les interrupteurs et tout ce que tu as saisi dans une autre colonne restent intacts.

Une fiche pour un ensemble de règles que tu n'as pas installé est conservée. Elle s'affiche sur une seule ligne avec un bouton **Remove** (retirer), n'est jamais envoyée à l'IA, redevient modifiable quand tu installes cet ensemble de règles et accompagne la fiche de personnage quand tu l'exportes. Une fiche pour un ensemble de règles installé que cette version ne sait pas lire, par exemple une fiche enregistrée par une version plus récente, est elle aussi conservée telle quelle. Son entrée ne propose que **Remove this sheet** (retirer cette fiche) : une nouvelle fiche ne peut donc jamais l'écraser par accident. Chaque fiche est limitée à 64 Ko.

Les fiches d'ensembles de règles sont indépendantes de **Enable Roleplay Stats** (Activer les Caractéristiques de Roleplay). Une partie sur les règles propres à Marinara les ignore. Une partie sur un ensemble de règles utilise la fiche à la place des Attributes ci-dessus pour ses tests.

<a id="how-agents-update-your-stats"></a>

## Comment les agents mettent à jour tes caractéristiques

L'onglet **Stats** définit l'état de départ du chat. Les agents ne mettent à jour que les valeurs gérées par les trackers.

| Valeur | Qui la modifie |
| --- | --- |
| Les **Pools** des personnages, comme les HP | L'agent **Character Tracker**, selon les combats, les soins et les événements de l'histoire. Il ne suit pas le persona du joueur. |
| **Persona Status Bars** | L'agent **Persona Stats**, après chaque message. |
| Les **Roleplay Stats** (Caractéristiques de Roleplay), comme STR et DEX | Aucun agent. Elles sont envoyées avec la fiche pour le combat et le Game Mode, ainsi que pour les jets facultatifs en Roleplay ou en Game Mode. |

Si tu n'actives pas l'agent correspondant, les valeurs gérées par les trackers restent aux valeurs par défaut que tu as définies. À lui seul, l'onglet **Stats** ne met rien à jour en cours de partie. Pour activer ces agents, voir [Référence des agents téléchargeables](../agents/built-in-agents.md).

## Affichage des caractéristiques dans le HUD

Les caractéristiques activées apparaissent dans le HUD pendant un chat. Le HUD est le petit panneau qui affiche tes valeurs en direct. Les barres s'affichent sous forme de dégradés à code couleur. Voir [HUD et trackers](../roleplay/hud-and-trackers.md) pour savoir comment le déplacer ou le masquer.

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Personas](personas.md)
- [HUD et trackers](../roleplay/hud-and-trackers.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
