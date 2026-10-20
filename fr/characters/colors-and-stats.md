# Couleurs des personnages et caractéristiques RPG

Ce guide explique l'onglet **Colors** (couleurs) et l'onglet **Stats** (caractéristiques) de Marinara Engine. Les deux onglets se trouvent dans l'éditeur de personnage et dans l'éditeur de persona (le personnage que tu incarnes). Les couleurs changent l'apparence d'un personnage ou du persona dans le chat. Les caractéristiques servent à suivre des valeurs comme la santé ou la faim.

## L'onglet Colors

Chaque personnage et chaque persona possède un onglet **Colors** dans son éditeur. Il règle trois couleurs : celle du nom, celle des dialogues et celle de la bulle de message. Laisse un champ vide et Marinara applique la couleur du thème par défaut à cet élément.

Pour ouvrir l'onglet Colors :

1. Ouvre un personnage dans l'éditeur de personnage, ou un persona dans l'éditeur de persona.
2. Clique sur l'onglet **Colors** dans la liste des onglets.
3. Une carte **Preview** (aperçu) en direct apparaît, avec les trois champs de couleur en dessous.

La carte **Preview** montre un exemple de nom et un exemple de bulle de message. Elle se met à jour à chaque changement de couleur : tu vois donc le résultat avant d'enregistrer.

### Extract Colors from Avatar

Le bouton **Extract Colors from Avatar** (extraire les couleurs de l'avatar) choisit automatiquement une couleur de nom, une couleur de dialogue et une couleur de bulle à partir de l'image de l'avatar. Le bouton ne devient actif qu'une fois un avatar en place. Tant qu'aucun avatar n'est téléversé, le bouton est désactivé et affiche **Upload an avatar first**. Après l'extraction, tu peux encore modifier chacune des trois couleurs à la main.

### Les trois couleurs

Règle chaque couleur avec le champ de couleur, ou saisis une valeur :

- **Name Display Color** : la couleur du nom. Ce champ accepte aussi un dégradé CSS. Un dégradé est un fondu progressif entre plusieurs couleurs. Exemple de valeur : `linear-gradient(90deg, #f59e0b, #ef4444)`.
- **Dialogue Highlight Color** : la couleur du texte placé entre guillemets de dialogue. Exemple de valeur : `#ffd700`.
- **Message Box Color** : la couleur de fond de la bulle de message dans le chat. Une couleur semi-transparente donne le meilleur rendu. Exemple de valeur : `rgba(0, 0, 0, 0.5)`.

Une couleur semi-transparente laisse voir une partie de l'arrière-plan à travers la bulle. Le format `rgba` correspond au rouge, au vert, au bleu, puis à une valeur alpha allant de 0 (transparent) à 1 (opaque).

<a id="where-your-colors-show"></a>

## Où les couleurs apparaissent

Chaque couleur agit sur une partie différente du chat :

- La couleur du nom s'applique au nom affiché dans les messages du chat. Pour un personnage, elle colore aussi le nom dans les onglets de la barre latérale. Pour un persona, elle colore aussi le nom dans les sélecteurs de persona.
- La couleur des dialogues s'applique au texte placé entre guillemets de dialogue. Elle fonctionne avec les guillemets droits comme avec les autres styles de guillemets. Ce texte peut aussi être mis en gras depuis **Settings** (Paramètres). Les chats Conversation ne l'utilisent pas.
- La couleur de la bulle définit l'arrière-plan des bulles de message de ce personnage ou de ce persona dans les chats Roleplay. Les chats Conversation et Game ne l'utilisent pas.

## L'onglet Stats

Chaque personnage et chaque persona possède également un onglet **Stats**. Les caractéristiques sont des nombres comme les HP (points de vie), la STR (force) ou une barre de faim. Quand tu les actives, Marinara ajoute les valeurs au prompt – le texte que Marinara envoie à l'IA – pour que l'IA connaisse l'état actuel. Les valeurs définies ici sont les valeurs de départ par défaut des nouveaux chats. Les agents peuvent ensuite les faire évoluer en cours de partie. Voir la section sur les agents plus bas.

L'onglet **Stats** d'un personnage et l'onglet **Stats** d'un persona sont organisés différemment : chacun est donc décrit à part ci-dessous.

### Caractéristiques d'un personnage : Enable RPG Stats

Un personnage a un seul interrupteur : **Enable RPG Stats** (activer les caractéristiques RPG). Désactivé, rien de ce qui suit n'est affiché ni envoyé. Activé, deux sections apparaissent :

- **Pools** : des barres nommées avec une valeur actuelle, un maximum et une couleur. Les nouveaux personnages démarrent avec une réserve HP et une réserve MP, chacune à 100 sur 100. Clique sur **Add** (ajouter) pour créer une autre réserve. Clique sur le X d'une ligne pour la supprimer.
- **Attributes** : des valeurs numériques nommées. Les nouveaux personnages démarrent avec STR, DEX, CON, INT, WIS et CHA, chacune à 10. Clique sur **Add** pour créer un autre attribut. Clique sur le X d'une ligne pour le supprimer.

### Caractéristiques d'un persona : deux sections

L'onglet **Stats** d'un persona contient deux blocs distincts, chacun avec son propre interrupteur.

Le premier bloc, **Persona Status Bars** (barres d'état du persona), s'active avec **Enable Persona Stats**. Ces barres suivent les besoins physiques et mentaux. À l'activation, les barres de départ sont Satiety, Energy, Hygiene et Mood, chacune à 100 sur 100. La liste se gère sous **Status Bars**. Chaque barre a un nom, une valeur actuelle, un maximum et une couleur. Clique sur **Add** pour créer une barre et sur le X pour en supprimer une.

Le second bloc, **RPG Attributes**, s'active avec **Enable RPG Attributes**. Il fonctionne comme sur une fiche de personnage. Il donne au persona des **Pools** (HP et MP à 100 sur 100 au départ) et des **Attributes** (STR, DEX, CON, INT, WIS et CHA à 10 au départ).

<a id="ruleset-sheets"></a>

### Fiches d'ensembles de règles

Quand un ensemble de règles de Game Mode est installé, comme 5e (SRD 5.1), les deux onglets **Stats** gagnent un bloc **Ruleset sheets** (fiches d'ensembles de règles) sous les sections ci-dessus. Il contient une entrée dépliable par ensemble de règles installé. Le bloc apparaît aussi quand une fiche de personnage contient encore une fiche pour un ensemble de règles que tu n'as plus.

1. Déplie l'entrée et clique sur **Add a sheet** (ajouter une fiche). Tu obtiens une fiche vierge dont chaque valeur est celle par défaut de l'ensemble de règles.
2. Remplis-la. La disposition vient de l'ensemble de règles lui-même : les valeurs de caractéristiques avec leurs modificateurs, les champs regroupés par section, les listes comme les attaques et les sorts, et les compétences et sauvegardes, chacune avec un niveau d'entraînement et un bonus supplémentaire. Les valeurs calculées, comme un bonus de maîtrise ou la Perception passive, se mettent à jour pendant la saisie et ne sont pas modifiables.
3. Enregistre le personnage ou le persona comme d'habitude.

Une fiche ici est la **configuration de départ** de ce personnage pour cet ensemble de règles. Une nouvelle partie sur cet ensemble de règles en prend une copie. Les changements faits pendant une partie restent dans cette partie et ne reviennent jamais sur la fiche de personnage.

Certains ensembles de règles fournissent des sorts, des attaques et des capacités tout prêts. Les listes qu'ils remplissent ont un bouton **Add from catalog** (ajouter depuis le catalogue) qui ouvre un sélecteur avec recherche, et les lignes ajoutées sont des copies que tu peux modifier comme les autres. Il en découle deux choses :

- Une cellule que l'ensemble de règles gère pour toi, comme des utilisations qui suivent une valeur de caractéristique ou une ressource de classe qui augmente avec ton niveau, s'affiche à sa place mais ne peut pas être saisie, avec la note "Set by the ruleset". Elle est recalculée à partir du reste de la fiche à chaque modification.
- Quand le texte propre à l'ensemble de règles pour l'une de ces lignes a changé depuis que tu l'as choisie, une ligne sous la liste indique combien de lignes ont un texte plus récent, avec un bouton **Review** (examiner). L'examen montre chaque ligne avec ce que contient ta fiche à côté de ce que dit l'ensemble de règles, et une case à cocher par ligne. **Update selected** (mettre à jour la sélection) écrit les lignes cochées et rien d'autre. Seul le texte est comparé : les nombres, les interrupteurs et tout ce que tu as saisi dans une autre colonne restent intacts, tout comme chaque ligne que tu décoches.

Une fiche pour un ensemble de règles que tu n'as pas installé est conservée, pas supprimée. Elle s'affiche sur une seule ligne avec un bouton **Remove** (retirer), elle n'est jamais envoyée à l'IA, et elle redevient modifiable quand tu installes cet ensemble de règles. Elle accompagne aussi la fiche de personnage quand tu l'exportes. Chaque fiche est limitée à 64 KB.

Une fiche pour un ensemble de règles installé que cette version de Marinara ne sait pas lire, par exemple une fiche enregistrée par une version plus récente, est elle aussi conservée telle quelle. Son entrée ne propose que **Remove this sheet** (retirer cette fiche) : ajouter une nouvelle fiche ne peut donc jamais l'écraser par accident.

Les fiches d'ensembles de règles sont indépendantes de **Enable RPG Stats** et de **Enable RPG Attributes**. Une partie qui utilise les règles propres à Marinara les ignore, et une partie sur un ensemble de règles les utilise à la place des Attributes ci-dessus pour ses tests.

## Comment les agents mettent à jour les caractéristiques

Les valeurs de l'onglet **Stats** deviennent l'état de départ du chat. Les agents peuvent mettre à jour les valeurs gérées par les trackers, décrites ci-dessous. Les **RPG Attributes** comme STR et DEX servent de contexte de fiche, et ne sont pas des valeurs de tracker gérées par les agents. Un agent est une IA qui travaille en parallèle du chat.

- L'agent **Character Tracker** ajuste les caractéristiques suivies des personnages, y compris les Pools comme les HP, selon les combats, les soins et les événements de l'histoire. Il ne suit pas le persona du joueur.
- L'agent **Persona Stats** ajuste tes **Persona Status Bars** après chaque message, selon ce qui se passe dans l'histoire.
- Les **RPG Attributes** des personnages et du persona sont envoyés avec leur fiche pour le combat et le Game Mode, ainsi que pour les jets facultatifs en Roleplay ou en Game Mode. Les agents ne mettent pas à jour ces Attributes.

Si tu n'actives pas l'agent tracker correspondant, les valeurs gérées par les trackers restent celles que tu as définies par défaut. À lui seul, l'onglet **Stats** ne met rien à jour. Voir le guide des agents intégrés pour activer ces agents.

## Affichage des caractéristiques dans le HUD

Quand les caractéristiques sont activées, elles apparaissent dans le widget HUD pendant le chat. HUD signifie heads-up display : un petit panneau qui affiche les valeurs en direct. Les barres s'affichent sous forme de dégradés colorés, lisibles d'un coup d'œil. Le guide du HUD détaille l'affichage complet, ainsi que la façon de le déplacer ou de le masquer.

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Personas : création et modification](personas.md)
- [HUD et trackers](../roleplay/hud-and-trackers.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
