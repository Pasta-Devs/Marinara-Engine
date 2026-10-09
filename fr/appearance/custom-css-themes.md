# Thèmes CSS personnalisés (Theme Library)

Ce guide explique comment changer toute l'allure de Marinara Engine avec un thème CSS personnalisé. Au programme : créer, importer, exporter et activer un thème. Tu découvres aussi quelles variables CSS se modifient, et comment les thèmes cohabitent avec le CSS de fiche.

<a id="ready-made-chat-window-styles"></a>

## Styles de fenêtres de chat prêts à utiliser

Pour changer rapidement de style sans écrire de CSS, ouvre **Settings > Appearance > App** (Paramètres > Apparence > Application) et trouve **Chat widget style** (style des widgets du chat) en bas de **App Style**. **Dottore** donne aux contrôles des cadres d'instruments bleu glacé, des bordures en métal clair et des coins coupés. **Mari** ajoute des cadres de conte bordés d'or, des bleus de pierres précieuses et des Primo-gemmes sur les titres des fenêtres. Ses boutons ont le même fond que ses fenêtres. Chaque preset a sa propre police, fonctionne en mode clair et sombre, et habille ensemble boutons, fenêtres et sections repliables.

Les contrôles **Font** et **Shape** permettent de changer ces détails séparément. **Preset font** et **Preset shape** suivent le style sélectionné.

En dessous se trouvent trois contrôles de couleur. Chacun propose une couleur unie ou un dégradé pour mélanger des couleurs :

- **Border & Buttons Color** change les contours et les icônes des boutons. Les icônes utilisent la première couleur du dégradé.
- **Background Color** remplit les boutons, fenêtres, sections repliables et champs modifiables.
- **Text Color** change le texte des widgets. Les dégradés apparaissent sur les titres et étiquettes ; le texte des champs modifiables utilise la première couleur.

Les contrôles de couleur conservent les couleurs originales des ornements.

Utilise **Reset color** près d'un contrôle pour retrouver les couleurs claires ou sombres du preset. Choisir un preset réinitialise **Font**, **Shape** et les trois couleurs. **Default** rétablit l'apparence originale. Les fenêtres restent là où tu les as placées.

Pour étendre ce style au reste du chat, utilise les trois interrupteurs sous les sélecteurs de couleur :

- **Apply preset font** (appliquer la police du preset) utilise la police choisie pour les widgets dans les messages, les champs de saisie et les contrôles du chat, y compris les widgets du HUD, le panneau de carte, les apartés et les fiches de personnage de Game Mode.
- **Apply preset shape** (appliquer la forme du preset) utilise la forme de cadre choisie pour les messages Roleplay dans les dispositions classique et visual novel, la boîte de dialogue Game, les apartés, les widgets du HUD, le panneau de carte, les fiches de personnage, les champs de saisie et les contrôles. Les messages Conversation gardent leur propre forme.
- **Apply preset colors** (appliquer les couleurs du preset) utilise les couleurs de bordure, de fond et de texte du widget dans ces zones, y compris les messages Conversation. Tes couleurs et dégradés personnalisés s'appliquent aussi. Les dialogues entre guillemets conservent la **Dialogue Highlight Color** (couleur de surbrillance des dialogues) propre à chaque personnage ou persona.

Chaque interrupteur est désactivé au départ et fonctionne indépendamment. Tu peux par exemple utiliser la police de Mari tout en gardant les couleurs habituelles du chat. Désactiver un interrupteur rétablit cette partie du style habituel. Choisir un autre preset conserve tes choix d'interrupteurs. Professor Mari peut aussi créer des thèmes personnalisés pour ces zones.

Les thèmes CSS personnalisés peuvent toujours remplacer ces presets. Les variables publiques de fenêtres et de tiroirs ci-dessous ont la priorité sur les couleurs du preset. Utilise `--mari-window-font-family` pour la police des fenêtres, `--mari-drawer-radius` pour les coins des sections et `--mari-window-ornament: none` pour masquer l'ornement du titre. Pour retirer toute la décoration du preset, choisis d'abord **Default**.


## Qu'est-ce qu'un thème personnalisé

Un thème personnalisé, c'est un bloc de CSS qui repeint Marinara. Le CSS, abréviation de Cascading Style Sheets, est le code qui définit les couleurs, les bordures et les espacements dans toute l'application. Un thème peut changer l'arrière-plan de la page, la couleur d'accentuation, les cartes, les bordures, le texte, et bien plus encore.

Les thèmes personnalisés vivent dans la section **Theme Library** (bibliothèque de thèmes). Marinara les stocke sur le serveur : ils se synchronisent donc sur tous les appareils et tous les navigateurs connectés au même serveur. C'est différent de la plupart des autres réglages d'apparence, qui restent sur un seul appareil. Pour les réglages propres à chaque appareil, consulte le guide [Réglages d'apparence](appearance-settings.md).

Un seul thème personnalisé peut être actif à la fois. Garde autant de thèmes que tu veux dans la bibliothèque, et passe de l'un à l'autre quand ça te chante.

## Où trouver la Theme Library

1. Ouvre **Settings** (Paramètres).
2. Ouvre l'onglet **Addons**.
3. Repère la section **Theme Library**.

La section s'intitule **Theme Library** et affiche "Create, import, activate, edit, export, or remove custom CSS themes."

## Créer un thème

1. Dans la section **Theme Library**, clique sur **Create Theme** (créer un thème).
2. Saisis un nom dans le champ **Theme name**.
3. Écris ou colle le CSS dans la grande zone de texte.
4. Laisse l'interrupteur **Preview** (aperçu) activé pour voir les changements en direct dans l'application pendant que tu tapes. Désactive **Preview** pour arrêter l'aperçu en direct.
5. Clique sur **Save** (enregistrer).

Un nouveau thème part d'un modèle. Ce modèle liste les variables les plus courantes sous forme d'exemples mis en commentaire : retire les marques de commentaire et donne tes propres valeurs. Quand tu enregistres un thème tout neuf, Marinara l'active aussitôt. Une confirmation apparaît avec le nom du thème, par exemple : Theme "My Theme" saved and activated.

Pour modifier un thème plus tard, retrouve-le dans la liste **Installed Themes** (thèmes installés). Clique sur l'icône de code (son infobulle indique **Edit theme CSS**), fais tes modifications, puis clique sur **Save**. Modifier un thème enregistré le met à jour, mais ne change pas le thème actif.

## Importer et exporter des thèmes

Les thèmes se partagent sous forme de fichiers. Pratique pour déplacer un thème d'un serveur à un autre, ou pour le transmettre à un ami.

Pour importer un thème :

1. Clique sur **Import File** (importer un fichier) dans la section **Theme Library**.
2. Choisis un fichier `.css` ou un fichier `.json`.
3. Lis le message qui s'affiche. Il indique combien de thèmes ont été importés, ignorés ou refusés.

Un fichier `.css` devient un seul thème, qui porte le nom du fichier. Un fichier `.json` peut contenir un ou plusieurs thèmes, et il en existe deux sortes.

La première sorte, c'est un fichier exporté depuis Marinara. Chaque thème y est entouré de champs supplémentaires que Marinara ajoute à l'export. Tu n'as ni à le lire ni à le modifier. Importe le fichier tel quel.

La seconde sorte, c'est un petit fichier que tu écris toi-même. Pour un thème unique, ceci suffit :

```
{ "name": "My Theme", "css": "..." }
```

Les thèmes importés se synchronisent sur le serveur, mais ils ne s'activent pas d'eux-mêmes. Un thème déjà présent sur le serveur, avec le même nom et le même CSS, est ignoré plutôt qu'ajouté en double.

Pour exporter un thème, retrouve-le dans la liste **Installed Themes** et clique sur l'icône de téléversement (son infobulle indique **Export theme**). Marinara télécharge un fichier `.json` que tu peux importer ailleurs.

## Activer un thème

La liste **Installed Themes** montre tous les thèmes, avec en haut une entrée **Default Theme** (thème par défaut).

1. Clique sur le nom d'un thème pour l'activer. Une coche signale le thème actif.
2. Clique sur **Default Theme** pour désactiver le thème personnalisé et revenir à l'allure d'origine de Marinara.

Le bouton **Reset Appearance** (réinitialiser l'apparence) se trouve en haut de la section **App Style**, dans **Settings -> Appearance**. Il désactive lui aussi le thème personnalisé actif.

Pour supprimer définitivement un thème, clique sur l'icône de corbeille sur sa ligne (son infobulle indique **Remove theme**), puis confirme dans la fenêtre **Delete Theme**. Le CSS du thème disparaît alors du serveur, sans retour possible.

## La référence des variables CSS

L'éditeur de thème contient une section dépliable **CSS Variable Reference**. Clique dessus pour voir les variables les plus utiles à redéfinir. Un thème modifie l'application en donnant une valeur à ces variables dans un bloc `:root`. Voici les variables listées dans cette référence :

| Variable | Ce qu'elle règle |
| --- | --- |
| `--background` | Arrière-plan de la page |
| `--foreground` | Texte principal |
| `--primary` | Accentuation et boutons |
| `--primary-foreground` | Texte sur la couleur primaire |
| `--secondary` | Cartes et champs de saisie |
| `--card` | Arrière-plan des cartes |
| `--border` | Bordures |
| `--muted-foreground` | Texte atténué |
| `--sidebar` | Arrière-plan de la barre latérale |
| `--sidebar-border` | Bordure de la barre latérale |
| `--marinara-shell-edge-border` | Bord gauche et droit du cadre |
| `--destructive` | Erreur et suppression |
| `--popover` | Arrière-plan des menus déroulants |
| `--accent` | Surbrillance au survol |

Tu n'es pas limité à cette liste. Un thème peut définir n'importe quelle variable CSS utilisée par Marinara, et il peut aussi ajouter d'autres styles personnalisés.

Certains effets visuels ont leur propre variable. Un thème peut par exemple demander l'animation de pulsation de l'accentuation en définissant `--marinara-theme-accent-pulse: enabled`.

Par sécurité, Marinara nettoie le CSS des thèmes personnalisés avant de l'appliquer. Les styles qui chargent un fichier depuis un autre site web ne fonctionnent pas. Pour utiliser une image ou une police dans un thème, intègre-la sous forme d'URI `data:` au lieu d'un lien web. Une URI `data:` contient directement le contenu du fichier à l'intérieur du CSS.

## Habiller les fenêtres et tiroirs du chat

Sur ordinateur, **Chat Settings** s'ouvre dans une fenêtre déplaçable. Ses sections repliables sont appelées **drawers** (tiroirs). Un tiroir peut se détacher dans sa propre fenêtre, puis se réduire à un petit bouton déplaçable, appelé **bubble** (bulle).

D'autres outils utilisent aussi ces fenêtres et boutons : Game controls, Session, Volume, Game Assets, les chats connectés et les contrôles de packages. Sur téléphone, la plupart des fenêtres s'ouvrent en panneaux sur toute la largeur ; Echo Chamber reste une fenêtre compacte que tu peux déplacer et redimensionner. Les outils sortis de Chat Settings figurent dans le menu déplaçable à trois points **Chat tools** (outils du chat) ; les boutons des trackers restent séparés.

Les classes, attributs de données et variables ci-dessous permettent d'habiller ces éléments ensemble. Les règles de ton thème remplacent les valeurs par défaut sans `!important`.

### Classes

| Élément | Classe |
| --- | --- |
| Fenêtre | `.mari-window` |
| Barre de titre | `.mari-window__header` |
| Titre et son icône | `.mari-window__title-row` |
| Titre | `.mari-window__title` |
| Boutons de la barre de titre (Reset View, étoile de disposition favorite, Tracker Panel, épingler, verrouiller, fermer, Put back) | `.mari-window__controls` (chaque bouton est `.mari-window__control`) |
| Contenu de la fenêtre | `.mari-window__body` |
| Bords et coins de redimensionnement | `.mari-window__resize-handle` |
| Repère de coin visible quand le pointeur ou le focus est dans une fenêtre | `.mari-window__resize-grip` |
| Tiroir | `.mari-drawer` |
| En-tête et titre du tiroir | `.mari-drawer__header`, `.mari-drawer__title` |
| Icône, compteur et **?** du tiroir | `.mari-drawer__icon`, `.mari-drawer__count`, `.mari-drawer__help` |
| Aperçu d'un tiroir replié (petit widget du tracker) | `.mari-drawer__summary` |
| Boutons près de la flèche et bouton de détachement du tiroir | `.mari-drawer__actions`, `.mari-drawer__popout` |
| Flèche et contenu du tiroir | `.mari-drawer__arrow`, `.mari-drawer__body` |
| Aperçu qui suit le pointeur pendant le détachement d'un tiroir | `.mari-drawer-ghost` |
| Bouton d'une fenêtre réduite (bulle) | `.mari-window-bubble` |
| Résumé en direct qu'une bulle affiche à la place de son icône (bannière de World State) | `.mari-window-bubble__banner` |
| Ligne visible quand une bulle déplacée s'aligne sur une autre | `.mari-window-snap-guide` |
| Point visible pendant le travail des agents (bouton Chat Settings, fenêtre Trackers) | `.mari-agents-running-dot` |

### Attributs de données

- `data-window` identifie une fenêtre et sa bulle : `chat-settings`, `trackers`, les fenêtres de contrôles `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` et `control:beholder:<package>`, et `drawer:<window>:<drawer>` pour un tiroir détaché, par exemple `drawer:chat-settings:chat-name`.
- `data-drawer` identifie un tiroir, par exemple `chat-name`. Certains noms commencent par le mode du chat, comme `roleplay-agents` ou `conversation-agents`. Les trackers utilisent `tracker-world`, `tracker-persona`, `tracker-characters`, `tracker-quests`, `tracker-inventory`, `tracker-custom` et `agent-activity`.
- `data-presentation` vaut `"window"` sur une fenêtre d'ordinateur ou `"sheet"` sur un panneau de téléphone.
- `data-pinned` et `data-locked` valent `"true"` quand la fenêtre est épinglée ou verrouillée.
- `data-window-control` identifie chaque bouton de la barre de titre : `"pin"`, `"lock"`, `"close"` ou `"put-back"`. Un bouton d'épinglage ou de verrouillage actif possède aussi `aria-pressed="true"`.
- `data-chat-settings-control` identifie les boutons supplémentaires de la barre de titre de Chat Settings : `"reset-view"`, `"favorite-layout"` et `"tracker-panel"`. L'étoile favorite possède `aria-pressed="true"` et une icône remplie quand la disposition actuelle correspond à la favorite enregistrée.
- `data-edge` vaut `"n"`, `"s"`, `"e"`, `"w"`, `"ne"`, `"nw"`, `"se"` ou `"sw"` sur chaque poignée de redimensionnement.
- Le bouton d'un tiroir ouvert dans `.mari-drawer__header` possède `aria-expanded="true"`.
- `data-drawer-control="pop-out"` marque le bouton de détachement d'un tiroir.
- `data-outside="true"` marque un aperçu de glissement assez éloigné de sa fenêtre pour se détacher au relâchement.
- `data-axis` vaut `"x"` pour un guide d'alignement vertical et `"y"` pour un guide horizontal.
- `data-detached` vaut `"true"` quand un tiroir apparaît dans sa propre fenêtre, sur la fenêtre et sur le tiroir qu'elle contient. Cette fenêtre est identifiée par `data-window="drawer:<window>:<drawer>"`, par exemple `data-window="drawer:chat-settings:chat-name"`, et `data-drawer-host` indique sa fenêtre d'origine.
- `data-dragging` vaut `"true"` sur un tiroir pendant le déplacement de son titre, et `data-drop-target` vaut `"true"` sur une fenêtre quand un tiroir détaché est maintenu au-dessus, prêt à y revenir.
- Une bulle possède le `data-window` de sa fenêtre et `data-minimized="true"`, par exemple `.mari-window-bubble[data-window="control:volume"]`. Les fenêtres de contrôles sont nommées `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` et `control:beholder:<package>`. `data-dragging` vaut `"true"` sur une bulle pendant son déplacement. Une bulle qui affiche un résumé en direct à la place de son icône, comme un tracker World State réduit, possède `data-banner="true"` et s'élargit à la taille du résumé.
- Une bulle verrouillée possède `data-locked="true"`, y compris le bouton Chat Settings. Elle ouvre toujours sa fenêtre, mais ne peut plus bouger tant que la fenêtre reste verrouillée. Utilise `.mari-window-bubble[data-locked="true"]` pour donner un aspect distinct à ces boutons.
- Sur téléphone, les fenêtres possèdent `data-presentation="sheet"`, comme leurs bulles, qui sont un peu plus grandes. La bulle de Tracker Panel est `.mari-window-bubble[data-tracker-panel-toggle="bubble"]`.
- Le bouton Chat Settings est aussi une bulle : `.mari-window-bubble[data-chat-settings-button]`, avec `data-open="true"` quand Chat Settings est ouvert.
- Une section détachée se réduit à une bulle avec `data-drawer-host` (sa fenêtre d'origine), et le bouton **Put back** de sa fenêtre est `[data-window-control="put-back"]`.

### Variables

Chaque variable reprend les couleurs communes des contrôles du chat si elle n'est pas définie. Un thème ne doit donc définir que celles qu'il veut changer.

| Variable | Ce qu'elle contrôle |
| --- | --- |
| `--mari-window-bg` | Fond de fenêtre |
| `--mari-window-text` | Texte de fenêtre |
| `--mari-window-border`, `--mari-window-border-width` | Bordure de fenêtre |
| `--mari-window-radius` | Arrondi des coins |
| `--mari-window-shadow` | Ombre de fenêtre |
| `--mari-window-backdrop-filter` | Flou derrière la fenêtre |
| `--mari-window-header-bg`, `--mari-window-header-text`, `--mari-window-header-border` | Couleurs de la barre de titre |
| `--mari-window-header-padding` | Espacement de la barre de titre |
| `--mari-window-control-color`, `--mari-window-control-color-hover`, `--mari-window-control-bg-hover` | Boutons de titre, dont l'étoile favorite |
| `--mari-window-control-color-active`, `--mari-window-control-bg-active` | Boutons de titre actifs, dont épinglage, verrouillage et étoile favorite remplie |
| `--mari-window-control-radius`, `--mari-window-control-gap` | Arrondi et espacement des boutons |
| `--mari-window-focus-ring` | Contour du focus clavier et de la fenêtre où un tiroir va revenir |
| `--mari-window-resize-handle-size` | Largeur des bords de redimensionnement |
| `--mari-window-bubble-size`, `--mari-window-bubble-radius`, `--mari-window-bubble-shadow` | Taille, arrondi et ombre des bulles |
| `--mari-window-bubble-bg`, `--mari-window-bubble-bg-hover`, `--mari-window-bubble-border` | Fond et bordure des bulles |
| `--mari-window-bubble-text`, `--mari-window-bubble-text-hover` | Couleur de l'icône de bulle |
| `--mari-window-snap-guide` | Couleur du guide d'alignement |
| `--mari-drawer-bg`, `--mari-drawer-border` | Fond et séparateur du tiroir |
| `--mari-drawer-header-bg`, `--mari-drawer-header-bg-hover` | Couleurs de l'en-tête du tiroir |
| `--mari-drawer-header-padding`, `--mari-drawer-body-padding-inline`, `--mari-drawer-body-padding-bottom` | Espacement du tiroir |
| `--mari-drawer-title-color`, `--mari-drawer-icon-color`, `--mari-drawer-arrow-color` | Texte et icônes de l'en-tête du tiroir |
| `--mari-drawer-count-bg`, `--mari-drawer-count-text` | Compteur du tiroir |

Définis une variable dans `:root` pour changer toutes les fenêtres, ou sur un sélecteur pour en changer une :

```css
:root {
  --mari-window-radius: 0.5rem;
  --mari-window-bubble-bg: #3b0764;
}

[data-window="chat-settings"] .mari-drawer[data-drawer="chat-name"] {
  --mari-drawer-border: transparent;
}
```

## Habiller les messages, les champs de saisie et les contrôles du chat

Les trois interrupteurs **Apply preset** permettent aussi à un thème personnalisé d'utiliser le design des widgets dans le reste du chat. Un thème peut remplacer chaque partie avec les variables ci-dessous. Demande à Professor Mari un thème de chat assorti si tu préfères ne pas écrire le CSS toi-même.

| Élément | Classe |
| --- | --- |
| Cadres des messages Roleplay et Game, apartés de Game, widgets du HUD, panneau de carte et fiches de personnage, et champs de saisie du chat | `.mari-chat-style-surface` |
| Messages Conversation (police et couleurs uniquement) | `.mari-chat-style-conversation` |
| Texte des messages Conversation sans cadre | `.mari-chat-style-text` |
| Contrôles du chat, y compris Calls et les contrôles de groupe de Conversation | `.mari-chat-style-control` |

| Variable | Ce qu'elle contrôle |
| --- | --- |
| `--mari-chat-font-family` | Police des zones de chat correspondantes |
| `--mari-chat-bg` | Fond du cadre ; accepte une couleur ou un dégradé |
| `--mari-chat-text` | Couleur unie et lisible du texte |
| `--mari-chat-border` | Contour du cadre ; accepte une couleur ou un dégradé |
| `--mari-chat-border-color` | Couleur unie de repli pour la bordure |
| `--mari-chat-radius` | Arrondi du cadre, sauf pour les messages Conversation |
| `--mari-chat-control-bg`, `--mari-chat-control-bg-hover` | Fonds des boutons du chat |
| `--mari-chat-control-color`, `--mari-chat-control-radius` | Couleur des icônes et arrondi des boutons du chat |
| `--mari-chat-input-bg` | Fond des champs modifiables |

Par exemple, avec **Apply preset font** et **Apply preset colors** activés :

```css
:root {
  --mari-chat-font-family: Georgia, serif;
  --mari-chat-bg: #251e29;
  --mari-chat-text: #f4e8dc;
  --mari-chat-border: linear-gradient(100deg, #d6aa66, #dda0b2);
}
```

Les variables non définies suivent les réglages et le preset des widgets. L'interrupteur correspondant doit être activé pour que ces variables s'appliquent via le style intégré. Les messages Conversation gardent leur propre forme même quand **Apply preset shape** est activé. Les thèmes personnalisés peuvent aussi cibler directement les classes ; garde les contours de focus, les menus et le contenu des messages hors de tout découpage décoratif.

Sur téléphone, le menu à trois points se déploie en boutons ronds. Son déclencheur est `[data-chat-tools-menu-button]`, la pile ouverte est `[data-chat-tools-menu]`, et chaque élément de liste porte `data-chat-tools-menu-item` avec l'ID de sa fenêtre. Les boutons d'outils utilisent `.mari-window-bubble.mari-chat-tools-button` et `data-chat-tools-menu-tool` avec ce même ID. La pile n'a pas de cadre de fenêtre ; ses boutons suivent les couleurs des widgets et la taille des boutons, indépendamment des trois interrupteurs pour le reste du chat, tout en gardant leur forme ronde.

## Limites de taille et de nom

Un nom de thème peut atteindre 200 caractères. Le CSS peut peser jusqu'à 256 Kio, mesurés en octets UTF-8 et non en caractères. Au-delà, le thème est refusé à l'enregistrement comme à l'import.

## Admin Access pour les installations distantes

Créer, modifier, importer, activer et supprimer un thème sont des actions protégées. Cela ne concerne que l'ouverture de Marinara à travers un réseau.

Si tu ouvres Marinara sur l'ordinateur qui fait tourner le serveur, via le loopback (aussi appelé localhost), ces actions fonctionnent directement. Si tu ouvres Marinara depuis un autre appareil, un téléphone ou un ordinateur de ton réseau par exemple, le serveur réclame d'abord un secret d'administration.

Pour gérer les thèmes à travers un réseau :

1. Sur le serveur, définis `ADMIN_SECRET` dans le fichier `.env`.
2. Dans l'application, ouvre **Settings -> Advanced -> Admin Access** (accès administrateur) et saisis la même valeur.

Sans cela, toute modification de thème à travers un réseau échoue. Pour la configuration complète, consulte la [Référence de configuration du serveur](../CONFIGURATION.md) et le [guide d'accès à distance](../REMOTE_ACCESS.md).

## Comment les thèmes et le CSS de fiche se combinent

Marinara propose deux façons d'ajouter du CSS personnalisé. Ce sont deux fonctionnalités distinctes, et elles peuvent être actives en même temps.

Un thème personnalisé repeint toute l'application. Il a le droit de redéfinir les variables fondamentales de Marinara, d'employer `!important` et d'employer `position: fixed`. C'est tout l'intérêt d'un thème.

Le CSS de fiche, c'est autre chose. Le créateur d'un personnage ou d'un persona peut intégrer du CSS dans une fiche, et tu l'actives chat par chat. Ce CSS-là est nettoyé plus sévèrement : il ne peut pas redéfinir les variables fondamentales de l'application, `!important` est retiré, et `position: fixed` devient `position: absolute`. Il met en forme les messages du chat, pas l'application entière. Consulte le [Guide du CSS de fiche](card-css-theming.md).

Si l'application a une drôle d'allure, pense à vérifier à la fois le thème actif et le CSS de fiche. L'un comme l'autre peut être en cause.

## Guides associés

- [Guide du CSS de fiche](card-css-theming.md)
- [Réglages d'apparence](appearance-settings.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
- [Accès à distance : authentification de base et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
