# Thèmes CSS personnalisés (Theme Library)

Un thème CSS personnalisé repeint l'ensemble de Marinara. Utilise la **Theme Library** (bibliothèque de thèmes) pour créer, importer, exporter et changer de thème. Ce guide liste aussi les variables et les classes CSS qu'un thème peut utiliser, et explique comment les thèmes cohabitent avec le CSS de fiche. Pour un changement rapide sans CSS, voir [Styles de fenêtres de chat prêts à utiliser](#ready-made-chat-window-styles).

Avant de commencer : si tu ouvres Marinara depuis un autre appareil, comme un téléphone, le serveur a besoin d'un secret d'administration avant que tu puisses créer, modifier, importer, activer ou supprimer des thèmes. Sur l'ordinateur qui fait tourner le serveur, aucun secret n'est nécessaire.

1. Sur le serveur, définis `ADMIN_SECRET` dans le fichier `.env`.
2. Dans l'application, ouvre **Settings → Advanced → Admin Access** (Paramètres → Avancé → Accès administrateur) et saisis la même valeur.

Voir la [Référence de configuration du serveur](../CONFIGURATION.md) et le [guide d'accès à distance](../REMOTE_ACCESS.md). Pour passer à un thème que quelqu'un t'a donné, va à [Activer un thème](#activating-a-theme).

## Ce qu'est un thème personnalisé

Le CSS, abréviation de Cascading Style Sheets, est le code qui définit les couleurs, les bordures et les espacements. Un thème est un bloc de CSS qui peut changer l'arrière-plan de la page, la couleur d'accentuation, les cartes, les bordures, le texte et plus encore.

Les thèmes vivent dans la **Theme Library**, sur ton serveur Marinara : ils se synchronisent donc sur tous les appareils connectés au même serveur. La plupart des autres réglages d'apparence restent sur un seul appareil. Un seul thème peut être actif à la fois, et tu peux en garder autant que tu veux.

## Où trouver la Theme Library

1. Ouvre **Settings**.
2. Ouvre l'onglet **Addons**.
3. Repère la section **Theme Library**.

## Créer un thème

1. Dans la section **Theme Library**, clique sur **Create Theme** (créer un thème).
2. Saisis un nom dans le champ du nom (il affiche "Theme name...").
3. Écris ou colle ton CSS dans la grande zone de texte.
4. Laisse **Preview** (aperçu) activé pour voir tes changements en direct pendant que tu tapes. Désactive-le pour arrêter l'aperçu en direct.
5. Clique sur **Save** (enregistrer).

Un nouveau thème part d'un modèle qui liste les variables courantes sous forme d'exemples mis en commentaire. Retire les marques de commentaire et donne tes propres valeurs. Un thème tout neuf est activé quand tu l'enregistres, et tu vois : Theme "My Theme" saved and activated.

Pour modifier un thème plus tard, retrouve-le dans **Installed Themes** (thèmes installés), clique sur l'icône de code (infobulle **Edit theme CSS**), fais tes modifications et clique sur **Save**. La modification ne change pas le thème actif.

## Importer et exporter des thèmes

Pour importer un thème :

1. Clique sur **Import File** (importer un fichier) dans la section **Theme Library**.
2. Choisis un fichier `.css` ou `.json`.
3. Lis le message. Il indique combien de thèmes ont été importés ou ignorés, et combien ont échoué.

Un fichier `.css` devient un seul thème, qui porte le nom du fichier. Un fichier `.json` peut contenir un ou plusieurs thèmes. Importe tel quel un fichier exporté depuis Marinara, ou écris-en un petit toi-même :

```json
{ "name": "My Theme", "css": "..." }
```

Les thèmes importés ne s'activent pas d'eux-mêmes. Un thème qui a le même nom et le même CSS qu'un thème déjà présent sur le serveur est ignoré.

Pour exporter un thème, clique sur l'icône de téléversement (infobulle **Export theme**) sur sa ligne dans **Installed Themes**. Marinara télécharge un fichier `.json` que tu peux importer ailleurs.

<a id="activating-a-theme"></a>

## Activer un thème

La liste **Installed Themes** montre tous les thèmes, avec une entrée **Default Theme** (thème par défaut) en haut.

1. Clique sur le nom d'un thème pour l'activer. Une coche signale le thème actif.
2. Clique sur **Default Theme** pour désactiver le thème personnalisé et revenir à l'apparence intégrée.

Le bouton **Reset Appearance** (réinitialiser l'apparence), en haut de **App Style** (style de l'application) dans **Settings → Appearance** (Paramètres → Apparence), désactive lui aussi le thème actif.

Pour supprimer un thème, clique sur l'icône de corbeille (infobulle **Remove theme**) et confirme dans la boîte de dialogue **Delete Theme**. Son CSS est alors supprimé définitivement du serveur.

Si ça n'a pas marché : quand l'application a une drôle d'allure, vérifie à la fois le thème actif et tout CSS de fiche présent dans le chat. Voir [Les thèmes et le CSS de fiche](#themes-and-card-css).

<a id="ready-made-chat-window-styles"></a>

## Styles de fenêtres de chat prêts à utiliser

Avant de commencer : aucun CSS n'est nécessaire.

1. Ouvre **Settings → Appearance → App** (Paramètres → Apparence → Application).
2. En bas de **App Style**, repère **Chat widget style** (style des widgets du chat).
3. Choisis un style.

| Style | Apparence |
| --- | --- |
| **Default** | L'apparence d'origine. |
| **Dottore** | Des cadres d'instruments bleu glacé, des bordures en métal clair et des coins coupés. |
| **Prof. Mari** | Des cadres de conte bordés d'or, des bleus de pierres précieuses et des Primo-gemmes sur les titres des fenêtres. Ses boutons ont le même fond que ses fenêtres. |

Chaque style a sa propre police, fonctionne en mode clair et sombre, et habille ensemble les boutons, les fenêtres et les sections repliables. Choisir un style réinitialise **Font** (police), **Shape** (forme) et les trois couleurs. Les positions de tes fenêtres ne changent pas.

Tu peux changer ces éléments séparément :

- **Font** et **Shape** suivent le style (**Preset font**, **Preset shape**) jusqu'à ce que tu en choisisses d'autres.
- **Border & Buttons Color** (couleur des bordures et des boutons) change les contours et les icônes des boutons. Les icônes utilisent la première couleur d'un dégradé.
- **Background Color** (couleur de fond) remplit les boutons, les fenêtres, les sections repliables et les champs modifiables.
- **Text Color** (couleur du texte) change le texte des widgets. Les dégradés apparaissent sur les titres et les étiquettes, et les champs modifiables utilisent la première couleur.

Chaque couleur propose un sélecteur de couleur pour une couleur unie et une option de dégradé. **Reset color** (réinitialiser la couleur), à côté d'un contrôle, revient aux couleurs claires ou sombres du style. Les écussons décoratifs gardent leurs couleurs d'origine.

### Étendre le style au chat

Trois interrupteurs sous les sélecteurs de couleur étendent le style. Chacun est désactivé au départ et fonctionne seul. En désactiver un rétablit le style habituel du chat pour cette partie, et choisir un autre style conserve tes choix d'interrupteurs.

| Interrupteur | Ce qu'il applique |
| --- | --- |
| **Apply preset font** (appliquer la police du preset) | La police des widgets, pour les messages, les champs de saisie et les contrôles du chat. |
| **Apply preset shape** (appliquer la forme du preset) | La forme du cadre, pour les messages Roleplay (classique et visual novel), la boîte de dialogue Game, les champs de saisie et les contrôles. Les messages Conversation gardent leur propre forme. |
| **Apply preset colors** (appliquer les couleurs du preset) | Les couleurs de bordure, de fond et de texte de ces zones, y compris les messages Conversation. Tes couleurs et dégradés personnalisés s'appliquent aussi. Les dialogues entre guillemets gardent la Dialogue Highlight Color (couleur de surbrillance des dialogues) propre à chaque personnage ou persona. Un message composé de HTML, comme la carte mise en forme d'un agent, garde les couleurs de texte qu'il définit lui-même. |

Les boutons d'historique, **Load More** (en charger plus) et **Show older** (afficher les plus anciens), suivent les interrupteurs comme les autres contrôles du chat. En Game Mode, les interrupteurs s'appliquent aussi aux apartés, aux widgets du HUD, au panneau de carte, aux fiches de personnage, aux journaux, à l'inventaire, aux panneaux de combat et aux boîtes de dialogue. Professor Mari peut aussi créer des thèmes personnalisés pour ces zones.

Un thème personnalisé peut toujours remplacer les styles. Les variables de fenêtres et de tiroirs ci-dessous ont la priorité sur les couleurs du style. Utilise `--mari-window-font-family` pour la police des fenêtres, `--mari-drawer-radius` pour les coins des sections et `--mari-window-ornament: none` pour masquer l'ornement du titre. Pour retirer toute la décoration du style, choisis d'abord **Default**.

<a id="themes-and-card-css"></a>

## Les thèmes et le CSS de fiche

Marinara propose deux façons d'ajouter du CSS personnalisé, et les deux peuvent être actives en même temps.

- Un thème personnalisé repeint toute l'application. Il a le droit de redéfinir les variables fondamentales de Marinara, d'employer `!important` et d'employer `position: fixed`.
- Le CSS de fiche est intégré dans une fiche de personnage ou de persona et s'active chat par chat. Il est nettoyé plus sévèrement : il ne peut pas redéfinir les variables fondamentales, `!important` est retiré, et `position: fixed` devient `position: absolute`. Il met en forme les messages du chat, pas l'application entière. Voir le [Guide du CSS de fiche](card-css-theming.md).

## Limites de taille et de nom

Un nom de thème peut atteindre 200 caractères. Le CSS peut peser jusqu'à 256 Kio, mesurés en octets UTF-8. Au-delà, le thème est refusé à l'enregistrement comme à l'import. Le CSS des thèmes personnalisés est aussi nettoyé avant de s'appliquer : les styles qui chargent un fichier depuis un autre site web ne fonctionnent pas. Intègre plutôt une image ou une police sous forme d'URI `data:`.

## La référence des variables CSS

L'éditeur de thème contient une section dépliable **CSS Variable Reference** (référence des variables CSS). Clique dessus pour voir les variables les plus utiles à redéfinir. Un thème modifie l'application en donnant une valeur à ces variables dans un bloc `:root`. La référence liste ces variables :

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

Un thème peut définir n'importe quelle variable CSS utilisée par Marinara, pas seulement celles-ci. Certains effets ont leurs propres variables. Par exemple, `--marinara-theme-accent-pulse: enabled` demande l'animation de pulsation de l'accentuation.

## Habiller les fenêtres et tiroirs du chat

Sur ordinateur, **Chat Settings** (réglages du chat) s'ouvre dans une fenêtre déplaçable. Ses sections repliables sont appelées **drawers** (tiroirs). Un tiroir peut se détacher dans sa propre fenêtre, puis se réduire à un petit bouton déplaçable, appelé **bubble** (bulle).

D'autres outils du chat utilisent aussi ces fenêtres et boutons, notamment Game controls, Session, Volume, Game Assets, les chats connectés et les contrôles de packages. Sur téléphone, la plupart des fenêtres s'ouvrent en panneaux sur toute la largeur ; Echo Chamber reste une fenêtre compacte que tu peux déplacer et redimensionner. Les outils sortis de Chat Settings figurent dans le menu déplaçable à trois points **Chat tools** (outils du chat) ; les boutons des trackers restent séparés.

Les classes, attributs de données et variables ci-dessous permettent à un thème d'habiller ces éléments ensemble. Les règles de ton thème remplacent les valeurs par défaut sans `!important`.

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
- `data-window-control` identifie chaque bouton de la barre de titre : `"pin"`, `"lock"`, `"close"` ou `"put-back"`. Un bouton d'épinglage ou de verrouillage enfoncé possède aussi `aria-pressed="true"`.
- `data-chat-settings-control` identifie les boutons supplémentaires de la barre de titre de Chat Settings : `"reset-view"`, `"favorite-layout"` et `"tracker-panel"`. L'étoile favorite possède `aria-pressed="true"` et une icône remplie quand la disposition actuelle correspond à la favorite enregistrée.
- `data-edge` vaut `"n"`, `"s"`, `"e"`, `"w"`, `"ne"`, `"nw"`, `"se"` ou `"sw"` sur chaque poignée de redimensionnement.
- Le bouton de bascule d'un tiroir ouvert, dans `.mari-drawer__header`, possède `aria-expanded="true"`.
- `data-drawer-control="pop-out"` marque le bouton de détachement d'un tiroir.
- `data-outside="true"` marque un aperçu de glissement assez éloigné de sa fenêtre pour se détacher au relâchement.
- `data-axis` vaut `"x"` sur un guide d'alignement vertical et `"y"` sur un guide horizontal.
- `data-detached` vaut `"true"` quand un tiroir apparaît dans sa propre fenêtre, sur cette fenêtre et sur le tiroir qu'elle contient. La fenêtre d'un tiroir détaché est identifiée par `data-window="drawer:<window>:<drawer>"`, par exemple `data-window="drawer:chat-settings:chat-name"`, et `data-drawer-host` indique sa fenêtre d'origine.
- `data-dragging` vaut `"true"` sur un tiroir pendant le déplacement de son titre, et `data-drop-target` vaut `"true"` sur une fenêtre quand un tiroir détaché est maintenu au-dessus, prêt à y revenir.
- Une bulle possède le `data-window` de sa fenêtre et `data-minimized="true"`, par exemple `.mari-window-bubble[data-window="control:volume"]`. Les fenêtres de contrôles sont nommées `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` et `control:beholder:<package>`. `data-dragging` vaut `"true"` sur une bulle pendant son déplacement. Une bulle qui affiche un résumé en direct à la place de son icône, comme un tracker World State réduit, possède `data-banner="true"` et s'élargit à la taille du résumé.
- Une bulle verrouillée possède `data-locked="true"`, y compris le bouton Chat Settings. Elle ouvre toujours sa fenêtre, mais ne peut pas être déplacée tant que la fenêtre n'est pas déverrouillée. Utilise `.mari-window-bubble[data-locked="true"]` pour donner un aspect distinct à ces boutons.
- Sur téléphone, les fenêtres possèdent `data-presentation="sheet"`, comme leurs bulles, qui sont un peu plus grandes. La bulle de Tracker Panel est `.mari-window-bubble[data-tracker-panel-toggle="bubble"]`.
- Le bouton Chat Settings est aussi une bulle : `.mari-window-bubble[data-chat-settings-button]`, avec `data-open="true"` quand Chat Settings est ouvert.
- Une section détachée se réduit à une bulle avec `data-drawer-host` (sa fenêtre d'origine), et le bouton **Put back** (remettre en place) de sa fenêtre est `[data-window-control="put-back"]`.

### Variables

Chaque variable reprend les couleurs communes des contrôles du chat si elle n'est pas définie. Un thème ne doit donc définir que celles qu'il veut changer.

| Variable | Ce qu'elle contrôle |
| --- | --- |
| `--mari-window-bg` | Fond de fenêtre |
| `--mari-window-text` | Texte de fenêtre |
| `--mari-window-border`, `--mari-window-border-width` | Bordure de fenêtre |
| `--mari-window-radius` | Arrondi des coins de fenêtre |
| `--mari-window-shadow` | Ombre de fenêtre |
| `--mari-window-backdrop-filter` | Flou derrière la fenêtre |
| `--mari-window-header-bg`, `--mari-window-header-text`, `--mari-window-header-border` | Couleurs de la barre de titre |
| `--mari-window-header-padding` | Espacement de la barre de titre |
| `--mari-window-control-color`, `--mari-window-control-color-hover`, `--mari-window-control-bg-hover` | Boutons de la barre de titre, dont l'étoile favorite |
| `--mari-window-control-color-active`, `--mari-window-control-bg-active` | Boutons de la barre de titre enfoncés, dont épinglage, verrouillage et étoile favorite remplie |
| `--mari-window-control-radius`, `--mari-window-control-gap` | Arrondi et espacement des boutons |
| `--mari-window-focus-ring` | Contour du focus clavier, et contour de la fenêtre où un tiroir va revenir |
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
| Journaux, inventaire, panneaux de combat, choix et boîtes de dialogue de Game ; les panneaux ont aussi l'attribut `data-game-section` avec leur nom, par exemple `logs`, `inventory` ou `combat-actions` | `.mari-game-section.mari-chat-style-surface` |
| Contenu de Game dans une fenêtre, comme l'onglet Journal, qui suit les couleurs de la fenêtre | `.mari-game-section` |
| Messages Conversation (police et couleurs uniquement) | `.mari-chat-style-conversation` |
| Texte des messages Conversation sans cadre | `.mari-chat-style-text` |
| Contrôles du chat, y compris Calls et les contrôles de groupe de Conversation | `.mari-chat-style-control` |
| Boutons d'historique : **Load More**, **Show older**, **Show newer** (afficher les plus récents), **Latest** (les plus récents) et, dans les journaux de Game, **Older** (plus anciens), **All** (tous) et **Show more older logs** (afficher plus d'anciens journaux). Ils ont aussi `.mari-chat-style-control` | `.mari-chat-history-pager` |
| Un message composé de HTML, comme la carte mise en forme d'un agent. Les couleurs de texte définies à l'intérieur sont conservées quand **Apply preset colors** est activé | `.mari-html-content` |

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

## Guides associés

- [Guide du CSS de fiche](card-css-theming.md)
- [Réglages d'apparence](appearance-settings.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
- [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
