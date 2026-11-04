# Réglages d'apparence

L'onglet **Appearance** (apparence) change l'aspect de Marinara : les couleurs, la taille du texte, la disposition du chat et le style des messages dans chaque mode de chat.

Tu cherches autre chose ?

- Une autre police : [Polices personnalisées et Google Fonts](fonts.md).
- Une image d'arrière-plan pour le chat : [Arrière-plans de chat](chat-backgrounds.md).
- Un thème personnalisé, dans **Settings → Addons → Theme Library** (Paramètres → Modules complémentaires → Bibliothèque de thèmes) : [Thèmes CSS personnalisés](custom-css-themes.md).
- L'apparence propre à un personnage dans le chat : [Guide du thème CSS de fiche](card-css-theming.md).

## Ouvrir les réglages d'apparence

1. Ouvre **Settings**.
2. Choisis l'onglet **Appearance**.
3. Choisis un bouton en haut : **App**, **Conversation**, **Roleplay** ou **Game**.

Les boutons regroupent les réglages par mode de chat, et l'onglet n'affiche que le groupe que tu choisis.

| Bouton | Sections |
| --- | --- |
| **App** | **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds** |
| **Conversation** | **Conversation Display**, **Conversation Theme** |
| **Roleplay** | **Tracker Panel**, **Roleplay Presentation** |
| **Game** | **Game Presentation** |

Pour repartir de zéro, clique sur **Reset Appearance** (réinitialiser l'apparence) en haut de **App Style**. Ce bouton ramène tout l'onglet aux valeurs par défaut de Marinara, efface l'arrière-plan du chat en cours et désactive le thème actif issu de la Theme Library.

## Le bouton App

### Color Scheme et Visual Style

Dans **App Style**, le menu déroulant **Color Scheme** (jeu de couleurs) propose **Dark** (valeur par défaut) et **Light**. L'application change aussitôt. Les couleurs qui ont une valeur par défaut distincte en Dark et en Light suivent ce choix tant que tu ne définis pas les tiennes.

**Visual Style** (style visuel) propose deux cartes. **Default (Marinara)** est un look rétro Y2K avec des effets de halo. **SillyTavern** est un rendu épuré et minimaliste. Ce choix ne change que l'apparence et n'a rien à voir avec l'import depuis SillyTavern.

### Background Color et Accent Color

Les deux acceptent une couleur unie ou un dégradé, un fondu progressif entre deux couleurs ou plus. Pour revenir à la valeur par défaut, vide le champ avec **Reset to default** (revenir à la valeur par défaut).

| Réglage | Ce qu'il colore | Par défaut |
| --- | --- | --- |
| **Background Color** (couleur d'arrière-plan) | La coque principale de l'application. | `#050312` en Dark, `#faf8ff` en Light |
| **Accent Color** (couleur d'accentuation) | Les boutons, les icônes actives, les contours de focus, les surbrillances, les bordures des panneaux et les contrôles autour du chat. | **Marinara Gradient**, un dégradé de rose, d'orange et de cyan |

Une valeur comme `#050312` est un code couleur hexadécimal, une façon courte d'écrire une couleur.

Deux interrupteurs changent le comportement de l'accentuation. Un seul peut être activé à la fois.

- **Accent Pulse** anime ta couleur d'accentuation. Les couleurs unies s'éclaircissent puis s'assombrissent, et les dégradés défilent entre leurs couleurs. Il est activé par défaut sur ordinateur et désactivé sur téléphone.
- **RGB Mode** fait défiler l'accentuation dans une palette arc-en-ciel. La couleur enregistrée dans **Accent Color** ne change pas. Il est désactivé par défaut.

Si ton appareil demande de réduire les animations, les deux effets sont ignorés.

### Les autres contrôles de la section App Style

- **Custom Mouse Pointer** (curseur de souris personnalisé, activé par défaut) affiche le curseur aux couleurs d'accentuation de Marinara. Désactive-le pour retrouver le curseur du système, ou pour laisser un thème personnalisé gérer le curseur.
- **Reduce Ambient Animations & Effects** (réduire les animations et effets d'ambiance) arrête les animations décoratives, les particules d'ambiance, les aperçus qui tournent et l'apparition progressive du texte. Marinara le fait aussi quand ton appareil demande de réduire les animations.
- **Desktop sidebar width** (largeur des barres latérales sur ordinateur) règle la largeur des deux barres latérales sur ordinateur. **Reset width** (réinitialiser la largeur) la rétablit. Les téléphones gardent leur disposition.

### Chat widget style

En bas de **App Style**, choisis **Default**, **Dottore** ou **Prof. Mari** pour les boutons, les fenêtres et les sections déplaçables du chat. Tu peux changer séparément la police, la forme et les trois couleurs principales, et les trois interrupteurs **Apply preset** (appliquer le preset) étendent le style aux messages, aux champs de saisie et aux contrôles du chat. **Button size (px)** (taille du bouton en pixels) change la taille des boutons déplaçables du chat et de leurs icônes sans modifier **Display Size** (taille d'affichage). Saisis une valeur de 32 à 96, ou laisse le champ vide pour la valeur par défaut. Pour le détail de chaque contrôle, voir [Thèmes CSS personnalisés](custom-css-themes.md#ready-made-chat-window-styles).

### Display Size et Chat Font Size

Dans **Text & Scale** :

- **Display Size** fixe la taille de texte de base de toute l'application sur cet appareil. Le changement s'applique aussitôt. Choisis l'une de ces valeurs :

| Choix | Taille |
| --- | --- |
| **Tiny** | 12 px |
| **Small** | 14 px |
| **Medium** | 16 px |
| **Default** | 17 px |
| **Large** | 19 px |
| **Huge** | 22 px |
| **Extra large** | 26 px |
| **Extra extra large** | 30 px |
| **Maximum** | 34 px |

- **Chat Font Size** (taille du texte du chat) est un curseur qui règle la taille du texte des messages, de 12 px à 72 px. Par défaut : 16 px.

Le menu déroulant **Font** (police) se trouve dans la même section. Voir [Polices personnalisées et Google Fonts](fonts.md).

### Couleurs et contour du texte du chat

Toujours dans **Text & Scale** :

- **Chat Text Color** (couleur du texte du chat) est la couleur principale du texte des messages. Par défaut : `#d4d4d4` en Dark et `#1a1025` en Light.
- **Default Dialogue Color** (couleur par défaut des dialogues) colore les dialogues entre guillemets quand un personnage ou un persona n'a pas sa propre Dialogue Highlight Color. Les couleurs des fiches ont la priorité. Tant que l'interrupteur **Apply preset colors** (appliquer les couleurs du preset) est activé, les dialogues prennent la couleur de texte du style de chat.
- **Chat Chrome Text Color** définit le texte des contrôles autour du chat : les widgets de tracker, les libellés de dossier et les descriptions de réglages. Mêmes valeurs par défaut que **Chat Text Color**.
- **Text Outline / Stroke** ajoute un contour pour que le texte reste lisible sur les arrière-plans chargés. Règle la couleur et une largeur (**Width**) de 0 à 5 px. Par défaut : 0,5 px, et 0 supprime le contour.

Vider un champ de couleur le ramène à la valeur par défaut du jeu de couleurs.

### Atmosphere

L'interrupteur **Dynamic weather effects (rain, snow, fog, etc.)** est activé par défaut. Il affiche des particules météo selon la météo et le moment de la journée dans l'histoire. Il n'affiche quelque chose que si l'agent **World State** est activé pour le chat. Voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md).

### Backgrounds

La section **Backgrounds** (arrière-plans) contient le sélecteur **Chat Background** (arrière-plan du chat) et le curseur **Background Blur** (flou d'arrière-plan). Deux autres contrôles s'y trouvent. **Conversation background image opacity** (opacité de l'image d'arrière-plan en Conversation) règle la visibilité de l'arrière-plan du chat en mode Conversation, le dégradé restant visible. **Chat List Backgrounds** (arrière-plans de la liste des chats) affiche l'arrière-plan de chaque chat sous forme de bandeau atténué derrière sa ligne, dans la liste des chats. Choisis **Active & Hovered**, **Every Row** ou **Off**. Voir [Arrière-plans de chat](chat-backgrounds.md).

## Le bouton Conversation

- **Chat Layout** (disposition du chat, dans **Conversation Display**) change l'aspect des messages en mode Conversation, avec un aperçu en direct. **Linear** (valeur par défaut) affiche des lignes façon chat. **Bubbles** affiche des bulles façon messagerie.
- **Avatar Shape** (forme de l'avatar) vaut **Circular** ou **Square**. La taille de l'avatar ne change pas.
- **Always display swipe menu** (toujours afficher le menu des swipes) affiche dès la première réponse les flèches de swipe, qui font passer d'une réponse alternative à l'autre, et le compteur. Désactive-le pour ne les afficher qu'après une régénération.
- **Conversation Theme** (thème de Conversation) définit un dégradé de deux couleurs derrière tous les chats Conversation. Les onglets **Dark** et **Light** gardent chacun leur propre dégradé. C'est une valeur par défaut valable sur tout l'appareil, pas un réglage chat par chat.

## Le bouton Roleplay

**Tracker Panel** habille le panneau latéral des trackers (agents de suivi) en Roleplay. Voir [HUD et trackers en Roleplay](../roleplay/hud-and-trackers.md).

**Roleplay Presentation** habille les messages Roleplay.

| Réglage | Rôle | Par défaut |
| --- | --- | --- |
| **Chat position** (position du chat) | L'emplacement des messages et de la zone de saisie sur un écran large : **Left**, **Center** ou **Right**. Une barre latérale ouverte ou un Tracker Panel du même côté les décale. Sur téléphone, le chat garde toute la largeur. | **Center** |
| **Visual Novel display** (affichage visual novel) | Affiche un paragraphe terminé à la fois, avec un portrait de dialogue et tes sprites (les images des personnages sur le plateau). Il change le Roleplay en cours et la valeur par défaut des chats sans style enregistré. | Désactivé |
| **Roleplay Messages Background Opacity** | Un curseur de 0 % à 100 %. Baisse-le pour laisser l'arrière-plan transparaître à travers les bulles de message. | 90 % |
| **Roleplay Avatars** | Le style d'avatar affiché à côté de chaque message : **None**, **Small Circles**, **Small Rectangles** ou **Glued Side Panel**. | **Small Circles** |
| **Scrollable Avatars** | Garde les avatars visibles pendant que tu fais défiler un long message. | Désactivé |
| **Message avatar scale** | Un curseur de 75 % à 250 %. | 100 % |
| **Default sprite scale** | Un curseur de 50 % à 175 %. La taille de sprite propre à un chat reste prioritaire. | 100 % |

Cette section contient aussi **Custom chat width** (largeur de chat personnalisée), **Always display swipe menu**, **Reduced paint effects** (aplatit les transparences et les ombres coûteuses pour garder une navigation fluide), **Show Thinking In Messages** (afficher le raisonnement dans les messages), **Don't Collapse Thinking** (ne pas replier le raisonnement) et **Narrator's Cycling Avatars** (avatars changeants du narrateur). Quand l'affichage **Visual Novel display** est activé, **Auto-play VN paragraphs** (lecture automatique des paragraphes VN) avec un **Paragraph delay** (délai entre paragraphes), **Dialogue portrait scale** (taille du portrait de dialogue) et **Full-body sprite scale** (taille du sprite en pied) apparaissent aussi.

## Le bouton Game

Dans **Game Presentation**, **Game VN Art** propose deux curseurs : **Dialogue portrait scale** (de 75 % à 175 %, 100 % par défaut) et **Full-body sprite scale** (de 75 % à 275 %, 135 % par défaut).

**Game Dialogue Display** (affichage des dialogues en Game Mode) détermine le comportement de la boîte de dialogue.

- **Classic Dialogue Box** (valeur par défaut) affiche un seul segment actif. Les lignes plus anciennes sont rangées dans le bouton **Logs** (journaux).
- **History Above Dialogue Box** affiche les segments précédents au-dessus de la boîte, où toute la session reste consultable en faisant défiler.

**Game text effects** (effets de texte en Game Mode, activé par défaut) anime les mots dramatiques, l'emphase en MAJUSCULES, les apartés entre parenthèses et les balises d'effet de texte. Désactive-le pour un texte simple.

## Les réglages qui restent sur cet appareil

La plupart des réglages d'apparence se synchronisent avec tes autres appareils. **Display Size** et **Chat Font Size**, non. Ils sont enregistrés dans le navigateur que tu utilises. Pour savoir ce qui se synchronise, voir [Vue d'ensemble des paramètres](../settings/settings-overview.md).

## Guides associés

- [Polices personnalisées et Google Fonts](fonts.md)
- [Arrière-plans de chat](chat-backgrounds.md)
- [Thèmes CSS personnalisés (Theme Library)](custom-css-themes.md)
- [Guide du thème CSS de fiche](card-css-theming.md)
- [Vue d'ensemble des paramètres](../settings/settings-overview.md)
