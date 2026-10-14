# Paramètres d'apparence

Ce guide passe en revue l'onglet **Settings -> Appearance** (Paramètres, puis Apparence) de Marinara Engine, section par section. Au programme : les couleurs, la taille du texte, la disposition du chat, le style des messages dans chaque mode, et la remise à zéro complète.

Les polices, les arrière-plans et les thèmes CSS personnalisés ont chacun leur guide. Cette page renvoie vers eux au bon endroit.

## Ouvrir les réglages d'apparence

1. Ouvre **Settings**.
2. Choisis l'onglet **Appearance**.

L'onglet se divise en sections que tu fais défiler : **App Style**, **Text & Scale**, **Conversation Display**, **Tracker Panel**, **Roleplay Messages**, **Game Presentation**, **Atmosphere**, **Conversation Theme** et **Backgrounds**.

## Color Scheme (Dark ou Light)

Le menu déroulant **Color Scheme** (jeu de couleurs) se trouve dans la section **App Style**. Il propose deux options :

- **Dark** (valeur par défaut). Plus reposant pour les yeux dans une pièce sombre.
- **Light**.

Plusieurs couleurs décrites plus bas ont une valeur par défaut distincte en Dark et en Light. Elles suivent automatiquement le Color Scheme actif, tant que tu ne définis pas ta propre couleur.

## Visual Style

**Visual Style** détermine l'allure générale de toute l'application. Tu choisis entre deux cartes :

- **Default (Marinara)** (valeur par défaut). Un look rétro Y2K avec des effets de halo.
- **SillyTavern**. Un rendu épuré et minimaliste, inspiré du SillyTavern d'origine.

Ce n'est qu'un habillage. Rien à voir avec l'import de données depuis SillyTavern, qui est un outil à part.

## Background Color et Accent Color

Ces deux réglages se trouvent dans la section **App Style**. Tous deux acceptent une couleur unie ou un dégradé. Un dégradé, c'est un fondu progressif entre deux couleurs ou plus.

- **Background Color** (couleur d'arrière-plan) colore la coque principale de l'application, derrière tout le reste. Par défaut : `#050312` en mode Dark et `#faf8ff` en mode Light.
- **Accent Color** (couleur d'accentuation) colore les boutons, les icônes actives, les contours de focus, les surbrillances et les bordures des panneaux. Par défaut : `#d4acfb` dans les deux jeux de couleurs.

Une valeur comme `#d4acfb` est un code couleur hexadécimal, une façon courte d'écrire une couleur. Pour revenir à la valeur par défaut du jeu de couleurs, vide le champ avec **Reset to default** (revenir à la valeur par défaut).

Deux interrupteurs changent le comportement de la couleur **Accent Color** :

- **Accent Pulse** (désactivé par défaut) anime doucement la couleur d'accentuation. Les couleurs unies s'éclaircissent puis s'assombrissent. Les dégradés défilent entre leurs couleurs.
- **RGB Mode** (désactivé par défaut) fait défiler l'accentuation dans une palette arc-en-ciel tant qu'il reste actif. La couleur enregistrée dans **Accent Color** n'est pas modifiée.

Ces deux options ne s'utilisent pas ensemble. Activer **RGB Mode** désactive **Accent Pulse**, et activer **Accent Pulse** désactive **RGB Mode**. L'effet **Accent Pulse** s'affiche en aperçu direct tant que l'onglet **Appearance** reste ouvert. Si l'appareil est réglé pour réduire les animations, les deux effets sont ignorés.

## Chat widget style

En bas de **App Style**, choisis **Default**, **Dottore** ou **Prof. Mari** pour les boutons, les fenêtres et les sections déplaçables du chat. Tu peux changer séparément la police, la forme du cadre et les trois couleurs principales. Les sélecteurs de couleur acceptent aussi les dégradés.

**Button size (px)** (taille du bouton en pixels) change la taille des boutons déplaçables du chat et de leurs icônes sans modifier Display Size. Saisis une taille de 32 à 96 pixels. Laisse le champ vide, ou utilise son bouton de réinitialisation, pour garder la valeur par défaut actuelle. La taille est enregistrée avec tes préférences d'apparence et reste identique quand tu choisis un autre preset.

Sous les sélecteurs de couleur, **Apply preset font** (appliquer la police du preset), **Apply preset shape** (appliquer la forme du preset) et **Apply preset colors** (appliquer les couleurs du preset) permettent d'assortir le reste du chat. Ils sont désactivés au départ et fonctionnent indépendamment. Ils s'appliquent aux messages, aux champs de saisie et aux contrôles du chat. En Game Mode, ils s'appliquent aussi aux widgets du HUD, au panneau de carte, aux apartés, aux fiches de personnage, aux journaux, à l'inventaire, aux panneaux de combat et aux boîtes de dialogue. Les messages Conversation utilisent la police et les couleurs facultatives, mais gardent leur propre forme. Tes choix personnalisés de police, de forme et de couleurs sont inclus. Quand **Apply preset colors** est activé, les dialogues entre guillemets utilisent toujours la **Dialogue Highlight Color** (couleur de surbrillance des dialogues) propre à chaque personnage ou persona. Pour des exemples et des thèmes personnalisés, voir [Thèmes CSS personnalisés](custom-css-themes.md#ready-made-chat-window-styles).

## Custom Mouse Pointer

**Custom Mouse Pointer** (curseur de souris personnalisé, activé par défaut) affiche le curseur aux couleurs d'accentuation de Marinara dans toute l'application. Désactive-le pour retrouver le curseur habituel du système, ou pour laisser un thème CSS personnalisé piloter le curseur.

## Display Size et Chat Font Size

Ces deux réglages se trouvent dans la section **Text & Scale**.

- **Display Size** (taille d'affichage) fixe la taille de texte de base pour toute l'application, sur cet appareil. Les choix sont **Tiny**, **Small**, **Medium**, **Default** (17px), **Large** et **Huge**.
- **Chat Font Size** (taille du texte du chat) est un curseur qui règle la taille du texte des messages. Il va de 12px à 48px. Par défaut : 16px.

Le menu déroulant **Font** se trouve dans cette même section. Pour ajouter tes propres polices ou en télécharger depuis Google Fonts, voir [Polices personnalisées et Google Fonts](fonts.md).

## Couleurs et contour du texte du chat

Toujours dans la section **Text & Scale**, quatre réglages déterminent la lisibilité du texte du chat par-dessus l'arrière-plan.

- **Chat Text Color** (couleur du texte du chat) définit la couleur principale du texte des messages. Par défaut : `#d4d4d4` en mode Dark et `#1a1025` en mode Light.
- **Default Dialogue Color** colore les dialogues entre guillemets quand une fiche de personnage ou de persona ne définit pas sa propre **Dialogue Highlight Color**. Les couleurs définies dans une fiche ont la priorité. Tant que l'interrupteur **Apply preset colors** est activé, ces dialogues prennent plutôt la couleur de texte du style de chat choisi.
- **Chat Chrome Text Color** définit le texte courant des widgets de tracker, des libellés de dossier et des descriptions de réglages. Mêmes valeurs par défaut que **Chat Text Color**.
- **Text Outline / Stroke** ajoute un contour autour du texte du chat pour qu'il reste lisible sur les arrière-plans chargés. Choisis la couleur du contour et une largeur (**Width**) de 0px à 5px. La largeur par défaut est 0.5px. Mets la largeur à 0 pour supprimer le contour.

Chaque couleur suit la valeur par défaut du Color Scheme tant que tu n'en choisis pas une. Vider un champ de couleur le ramène à cette valeur par défaut plutôt que de le laisser vide.

## Chat Layout (Conversation Display)

La section **Conversation Display** ne contient qu'un réglage, **Chat Layout** (disposition du chat), qui change l'aspect des messages en mode Conversation. Un aperçu se met à jour en direct pendant ton choix.

- **Linear** (valeur par défaut). Des lignes façon chat.
- **Bubbles**. Des bulles façon messagerie.

## Tracker Panel

La section **Tracker Panel** habille le panneau latéral des trackers (agents de suivi) en Roleplay. Ce panneau est une fonctionnalité à part entière, avec son propre guide. Voir [Le HUD et les trackers en Roleplay](../roleplay/hud-and-trackers.md).

## Apparence des messages en Roleplay

La section **Roleplay Messages** habille les messages dans les chats en mode Roleplay.

- **Chat position** choisit où se placent les messages et la zone de saisie sur un écran large : **Left**, **Center** (valeur par défaut) ou **Right**. Ils se déplacent ensemble, et une barre latérale ouverte ou le Tracker Panel du même côté les décale pour que le chat ne se retrouve jamais dessous. Sur un téléphone ou dans une fenêtre étroite, le chat garde toute la largeur, et en Game Mode la boîte de dialogue reste centrée.
- **Roleplay Messages Background Opacity** est un curseur de 0 % à 100 %. Par défaut : 90 %. Baisse-le pour laisser l'arrière-plan transparaître à travers les bulles de message.
- **Roleplay Avatars** choisit le style d'avatar affiché à côté de chaque message. Les quatre options sont **None**, **Small Circles** (valeur par défaut), **Small Rectangles** et **Glued Side Panel**.
- **Scrollable Avatars** (désactivé par défaut) garde les avatars visibles pendant que tu fais défiler un long message.
- **Message avatar scale** est un curseur de 75 % à 250 %. Par défaut : 100 %.
- **Default sprite scale** est un curseur de 50 % à 175 %. Par défaut : 100 %. Une taille de sprite (l'image du personnage sur le plateau) définie pour un chat précis reste prioritaire sur cette valeur.

## Game Presentation

La section **Game Presentation** règle la taille des illustrations en Game Mode. Le Game Mode peut afficher à la fois un portrait de dialogue et un sprite en pied. Ces deux curseurs en fixent la taille.

- **Dialogue portrait scale** est un curseur de 75 % à 175 %. Par défaut : 100 %.
- **Full-body sprite scale** est un curseur de 75 % à 275 %. Par défaut : 135 %.

**Game Dialogue Display** détermine le comportement de la boîte de dialogue :

- **Classic VN** (valeur par défaut). Un seul segment actif s'affiche dans la boîte de dialogue. Les lignes plus anciennes sont rangées dans le bouton **Logs**.
- **History Above VN**. Les segments précédents s'affichent au-dessus de la boîte de dialogue. Toute la session y reste consultable en faisant défiler.

## Les effets météo d'Atmosphere

La section **Atmosphere** ne contient qu'un interrupteur, **Dynamic weather effects (rain, snow, fog, etc.)**, activé par défaut. Il affiche des particules météo animées, selon la météo et le moment de la journée dans l'histoire.

Cet interrupteur n'a d'effet visible que si l'agent **World State** est activé pour le chat. C'est cet agent qui lit la météo dans l'histoire. Sans lui, rien ne change à l'écran. Voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md).

## Conversation Theme

La section **Conversation Theme** définit un arrière-plan en dégradé de deux couleurs pour tous les chats en mode Conversation. Elle a des onglets **Dark** et **Light** distincts, pour que chaque Color Scheme garde son propre dégradé. C'est une valeur par défaut valable sur tout l'appareil, pas un réglage chat par chat.

## Backgrounds

La section **Backgrounds** sert à importer et à choisir les images d'arrière-plan des chats, et à régler un flou avec **Background Blur**. Comme il s'agit d'un domaine à part, avec sa propre bibliothèque, il a son guide dédié. Voir [Les arrière-plans de chat](chat-backgrounds.md).

## Reset Appearance

Le bouton **Reset Appearance** (réinitialiser l'apparence) se trouve en haut de la section **App Style**. Il ramène tout l'onglet **Appearance** aux valeurs par défaut de Marinara : couleurs, tailles de texte, disposition, échelles d'avatar et de sprite, dégradés.

La réinitialisation efface aussi l'arrière-plan du chat en cours et désactive le thème personnalisé actif issu de la **Theme Library**. Utilise-la quand ton style part dans tous les sens et que tu veux repartir de zéro.

## Les réglages qui restent sur cet appareil

La plupart des réglages d'apparence se synchronisent avec tes autres appareils. Deux font exception : **Display Size** et **Chat Font Size** sont enregistrés dans le navigateur utilisé et ne se synchronisent jamais.

Pour savoir précisément quels réglages se synchronisent entre appareils et lesquels restent locaux, voir [Vue d'ensemble des paramètres](../settings/settings-overview.md).

## Guides associés

- [Polices personnalisées et Google Fonts](fonts.md)
- [Les arrière-plans de chat](chat-backgrounds.md)
- [Les thèmes CSS personnalisés (Theme Library)](custom-css-themes.md)
- [Guide du thème CSS de fiche](card-css-theming.md)
- [Vue d'ensemble des paramètres](../settings/settings-overview.md)
