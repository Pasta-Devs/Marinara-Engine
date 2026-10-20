# Guide du thème CSS de fiche

Ce guide s'adresse aux créateurs de personnages et de personas qui veulent donner à une fiche son propre style dans le chat. Le CSS s'intègre dans le champ **Creator Notes** (notes du créateur) de la fiche, et Marinara Engine l'applique sans risque aux messages de ce personnage. La portée s'arrête au chat : le reste de l'application n'est jamais touché.

## Avant de commencer

Quelques définitions simples, utilisées dans tout ce guide :

- Le **CSS** est le langage qui règle les couleurs, les polices, les bordures et les espacements d'une page web.
- Le **CSS de fiche** est le CSS que tu intègres dans une fiche de personnage ou de persona. Il habille les messages de cette fiche.
- Le **Card Theming** (thème de fiche) est le réglage, à l'écran, qui active le CSS de fiche pour un chat.
- Un **sélecteur** est la partie d'une règle CSS qui désigne les éléments à styliser.
- Un **sélecteur descendant** utilise une espace pour dire "à l'intérieur de". `.a .b` correspond à un `.b` situé dans un `.a`.
- La **cascade** est le mécanisme CSS qui décide quelle règle l'emporte quand plusieurs règles visent le même élément.
- Une **mise en page** décrit la disposition des messages à l'écran. Marinara propose une mise en page en lignes, **Linear**, et une mise en page en bulles, **Bubbles**.

## Démarrage rapide

Le thème d'une fiche se règle à deux endroits. D'abord tu ajoutes le CSS à la fiche. Ensuite tu l'actives dans le chat.

1. Ouvre le personnage dans la fenêtre **Character Editor** (éditeur de personnage) et repère le champ **Creator Notes**. Les personas ont le même champ dans la fenêtre **Persona Editor** (éditeur de persona).
2. Colle un bloc `<style>` dans le champ **Creator Notes**, puis enregistre la fiche.
3. Ouvre un chat avec ce personnage.
4. Ouvre la section **Chat Settings** (réglages du chat), puis la section **Card Theming**.
5. Choisis **Exclusive** ou **Chat**. Le mode démarre sur **Disabled**.

Les messages du personnage changent aussitôt. Le réglage **Card Theming** n'apparaît que si un personnage actif du chat a du CSS dans son champ **Creator Notes**. Le CSS d'un persona seul ne suffit pas à le faire apparaître. Il faut qu'au moins un personnage du chat porte son propre bloc `<style>`. Si le réglage reste invisible, vérifie que le bloc `<style>` a bien été enregistré.

Voici un bloc de départ à coller dans le champ **Creator Notes** :

```html
<style>
  /* the visible message bubble (Bubbles layout, and roleplay) */
  [data-card-css] .mari-message-bubble {
    background: linear-gradient(135deg, #2a1240, #3a1030);
    border: 1px solid #ff66cc;
    border-radius: 14px;
  }
  /* the name and the text (works in every message style) */
  [data-card-css] .mari-message-name {
    color: #ff8fd4;
    text-shadow: 0 0 8px rgba(255, 102, 204, 0.6);
  }
  [data-card-css] .mari-message-content {
    color: #ffd6f0;
  }
</style>
```

Le nom du personnage brille en rose et son texte passe au rose pâle, dans toutes les mises en page. La règle de bulle ajoute un dégradé violet et une bordure rose. Une réserve : `.mari-message-bubble` n'existe que dans la mise en page **Bubbles** et en roleplay. La mise en page par défaut du mode Conversation est **Linear**, qui n'a aucun élément de bulle : la règle de bulle n'y produit donc rien. La note "Bubbles face à Linear", plus bas, détaille la différence.

**Test de vérification :** pour un essai sans ambiguïté, utilise la règle ci-dessous. Elle vise le texte du message, présent dans tous les modes et toutes les mises en page. L'arrière-plan du texte doit virer au rose vif immédiatement.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Fonctionnement du Card Theming

Quand un personnage avec du CSS dans son champ **Creator Notes** est actif, Marinara fait quatre choses :

1. Marinara lit chaque bloc `<style>` du champ **Creator Notes**.
2. Marinara nettoie le CSS et retire tout ce qui est dangereux. Voir la section "Ce que tu ne peux pas styliser", plus bas.
3. Marinara limite la portée du CSS pour qu'il n'atteigne que le chat.
4. Marinara insère le CSS pour que ses sélecteurs à portée limitée l'emportent sur le style de message de l'application.

Le mode d'application se choisit chat par chat, dans la section **Chat Settings**, puis **Card Theming**. Il existe trois modes.

| Mode | Effet |
| --- | --- |
| **Disabled** (par défaut) | Le CSS de fiche est désactivé : aucun style de personnage n'est appliqué. |
| **Exclusive** | Le CSS de chaque personnage ne touche que ses propres messages. |
| **Chat** | Tout le CSS de fiche touche l'ensemble de la zone de chat, éléments d'interface compris. |

Choisis **Exclusive** pour les chats de groupe où chaque personnage a son propre style. Choisis **Chat** pour les chats à un seul personnage, quand la fiche doit habiller toute la surface du chat.

## La seule règle de portée qui compte

Marinara réécrit ton CSS pour qu'il n'atteigne que le chat. La façon de le réécrire dépend du mode.

- Le mode **Chat** limite tout à la zone de chat. `.mari-message-bubble` correspond normalement, puisque cet élément se trouve dans la zone.
- Le mode **Exclusive** limite tout aux éléments de message de ton personnage. Ces éléments portent `data-card-css`. Une classe posée sur ce même élément ne peut pas y correspondre en tant que descendant. Seul ce qui se trouve à l'intérieur le peut.

D'où la règle portable. Utilise `[data-card-css]` pour styliser l'élément de message lui-même. Utilise des sélecteurs de classe normaux pour tout ce qui est à l'intérieur, comme `.mari-message-bubble`, `.mari-message-content` et `.mari-message-name`.

`[data-card-css]` signifie "le message de ce personnage" en mode **Exclusive** et "la zone de chat" en mode **Chat**. Cela fonctionne dans les deux cas. Les sélecteurs d'éléments internes, ceux qui comportent une espace, se comportent de la même façon dans les deux modes.

```css
[data-card-css] {
  /* the message row itself, good for a left accent border */
  border-left: 3px solid #ff66cc;
}
[data-card-css] .mari-message-bubble {
  /* the visible bubble inside it */
  border-radius: 14px;
}
```

## Viser un mode avec @chat-mode

Place tes règles dans des blocs `@chat-mode` pour viser une seule surface. Le CSS placé hors de tout bloc s'applique partout.

```html
<style>
  /* Applies in ALL modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  /* Only in Roleplay mode */
  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  /* Only in Conversation mode */
  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

Les requêtes `@media` standard fonctionnent normalement à l'intérieur des blocs `@chat-mode`. Sers-t'en pour les mises en page adaptatives.

Le **Game Mode** bénéficie d'une prise en charge de base. En mode **Chat**, le CSS de fiche atteint toute la surface de jeu. `[data-card-css]` habille donc la zone de jeu, et `@chat-mode game` la vise. Game Mode utilise sa propre mise en page. Les accroches de bulle de message vues plus haut n'y existent pas : vise large, par exemple l'arrière-plan de la zone. Le style par personnage (mode Exclusive) de la narration de jeu n'est pas encore disponible.

## Ce que tu peux styliser

La structure du chat repose sur le même squelette en Roleplay et en Conversation. Voici les éléments que le CSS de fiche peut viser. Les classes utilitaires internes ne sont pas des accroches stables : elles changent d'une version à l'autre, alors tiens-t'en aux classes `mari-*` et aux attributs `data-*` ci-dessous.

| Sélecteur | Ce qu'il vise |
| --- | --- |
| `[data-card-css]` | Toute la ligne de message (l'élément de portée). Pratique pour un liseré à gauche ou sur le bord, ou pour la zone de chat en mode **Chat**. |
| `[data-card-css] .mari-message-bubble` | La bulle visible : arrière-plan, bordure, coins, ombre. Présente dans la mise en page **Bubbles** et en roleplay. |
| `[data-card-css] .mari-message-content` | En **Bubbles**, l'élément de bulle lui-même, arrière-plan, bordure et coins compris. En **Linear**, uniquement le texte du message. |
| `[data-card-css] .mari-message-name` | Le nom affiché du personnage. |
| `[data-card-css] .mari-message-meta` | La ligne d'en-tête qui porte le nom et l'horodatage. |
| `[data-card-css] .mari-message-timestamp` | L'horodatage. |
| `[data-card-css] .mari-message-avatar` | La colonne de l'avatar. |
| `[data-card-css] .mari-message-narrator` | Les messages du narrateur (roleplay). |
| `[data-card-css] .mari-message-user` | Les messages de l'utilisateur. Utilise `.mari-message-assistant` pour les messages du personnage. |
| `[data-card-css] p`, `... span` | Les paragraphes et les éléments span en ligne dans le texte. |
| `[data-grouped]` | Les messages qui prolongent le même personnage. Mode Conversation uniquement : les lignes du roleplay ne le portent jamais. Utilise `[data-card-css]:not([data-grouped])` pour le premier message d'un groupe. |

**Bubbles face à Linear.** La mise en page **Bubbles** est celle que vise `.mari-message-bubble`. La mise en page **Linear** n'a pas d'élément de bulle : stylise plutôt `.mari-message-content` (le texte) et `[data-card-css]` (la ligne). Change de mise en page dans **Settings** (Paramètres), puis **Appearance**, puis la section **Conversation Display**, puis **Chat Layout**. Le roleplay a toujours une bulle.

Voici une bulle stylisée, en conversation comme en roleplay :

```css
[data-card-css] .mari-message-bubble {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(100, 149, 237, 0.35);
  border-radius: 1rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
[data-card-css] .mari-message-name {
  color: #6495ed;
  text-shadow: 0 0 8px rgba(100, 149, 237, 0.5);
}
[data-card-css] .mari-message-content {
  font-family: Georgia, serif;
}
```

### Indicateur de saisie

Pendant qu'un personnage rédige sa réponse, la mise en page **Linear** du mode Conversation affiche une ligne "(name) is typing...". Tu peux la styliser.

| Sélecteur | Ce qu'il vise |
| --- | --- |
| `[data-card-css] .mari-typing-text` | L'étiquette "(name) is typing...". |
| `[data-card-css] .mari-typing-dots span` | Les points animés. |
| `[data-card-css] .mari-typing-indicator` | La ligne elle-même. Elle porte aussi le nom dans `data-typing-name`. |

```css
[data-card-css] .mari-typing-text {
  color: #ff66cc;
  font-style: italic;
}
[data-card-css] .mari-typing-dots span {
  background: #ff66cc;
}
```

### Avatar

L'avatar est un cercle par défaut. Tu peux lui changer de forme et l'entourer d'un anneau en CSS pur. Les exemples ci-dessous visent le bouton d'avatar cliquable. Si une surface affiche l'avatar sans le rendre cliquable, applique la même idée au repli `.mari-message-avatar > div` de cette mise en page. En roleplay, le bouton se trouve dans un bloc `div` supplémentaire qui produit une lueur. Aplatis ce conteneur si tu ne veux garder que ton propre anneau.

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
/* roleplay only: drop the app glow wrapper so just your ring shows */
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### Panneau contextuel de profil About Me (Conversation uniquement)

En mode Conversation, un clic sur un avatar ouvre un panneau contextuel de profil avec le "about me" du personnage ou du persona. Tu peux l'habiller avec la même portée `[data-card-css]`. Ce panneau contextuel n'existe qu'en mode Conversation. Il n'existe ni en mode Roleplay ni en Game Mode. Place ces règles dans un bloc `@chat-mode conversation` si ta fiche fournit aussi du CSS pour le mode Roleplay ou pour Game Mode. Les fiches de personnage comme les personas peuvent habiller leur propre panneau contextuel depuis leur champ **Creator Notes**.

Une réserve pour les personas : le réglage **Card Theming** n'apparaît que si un personnage actif du chat a du CSS dans son champ **Creator Notes**. Le CSS d'un persona seul ne le fait pas apparaître. Pour que le thème du panneau contextuel d'un persona fonctionne, il faut donc qu'au moins un personnage du chat porte lui aussi un bloc `<style>`.

| Sélecteur | Ce qu'il vise |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | La fiche du panneau contextuel elle-même (l'élément de portée) : arrière-plan, bordure, forme. |
| `[data-card-css] .mari-about-me-banner` | La bande de bannière du haut (par défaut, la couleur du nom). |
| `[data-card-css] .mari-about-me-avatar` | Le conteneur de l'avatar agrandi. Utilise `... > div` pour le cercle. |
| `[data-card-css] .mari-about-me-status` | Le point du statut de présence (personnages uniquement). |
| `[data-card-css] .mari-about-me-name` | Le titre du nom affiché. |
| `[data-card-css] .mari-about-me-handle` | La ligne secondaire en @nom (affichée quand le nom Convo affiché diffère). |
| `[data-card-css] .mari-about-me-presence` | La ligne de statut ou d'activité (personnages uniquement). |
| `[data-card-css] .mari-about-me-box` | Le cadre conteneur du About Me. |
| `[data-card-css] .mari-about-me-label` | La légende "ABOUT ME". |
| `[data-card-css] .mari-about-me-badge` | La pastille Default ou Chat-specific. |
| `[data-card-css] .mari-about-me-text` | Le corps de texte "about me" tel qu'il est rendu. |

La fiche du panneau contextuel est l'élément de portée. Vise-la avec `[data-card-css].mari-about-me-popout` (sans espace, même élément). Vise ses enfants avec un sélecteur descendant, comme `[data-card-css] .mari-about-me-name`. En mode **Chat**, toute la zone est comprise dans la portée : tu peux donc écrire `.mari-about-me-name` directement.

Voici un panneau contextuel "about me" habillé. Colle-le dans le champ **Creator Notes** d'un personnage ou d'un persona, puis active **Card Theming** dans la section **Chat Settings**. Si tu le colles dans un persona, souviens-toi de la réserve ci-dessus. Un personnage du chat doit lui aussi avoir du CSS dans son champ **Creator Notes**, sinon le réglage reste caché.

```html
<style>
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-avatar > div {
    border-radius: 0.9rem; /* squircle avatar */
    box-shadow: 0 0 0 2px #b478ff;
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
    text-shadow: 0 0 10px rgba(180, 120, 255, 0.6);
  }
  [data-card-css] .mari-about-me-box {
    background: rgba(180, 120, 255, 0.08);
    border: 1px solid rgba(180, 120, 255, 0.25);
    border-radius: 0.75rem;
  }
  [data-card-css] .mari-about-me-label {
    color: #b478ff;
    letter-spacing: 0.12em;
  }
  [data-card-css] .mari-about-me-text {
    font-family: Georgia, serif;
    color: #f2e9ff;
  }
}
</style>
```

## Ce que tu ne peux pas styliser

Le nettoyage retire les éléments suivants, pour des raisons de sécurité.

| Bloqué | Pourquoi |
| --- | --- |
| `url(https://...)` | Aucune requête réseau, pour éviter le pistage et les fuites de données. Seul `url(data:...)` est autorisé, pour les images et les polices intégrées. |
| `@font-face` avec des URL externes | Seules les sources de police en `data:` sont conservées. Le nom de la famille est renommé automatiquement, pour qu'il ne puisse pas remplacer les polices de l'application. |
| `@import` | Aucun chargement de feuille de style externe. |
| Sélecteurs `:has()` | Impossible de sonder des éléments hors du chat. |
| Règles imbriquées et sélecteurs qui commencent par `~` ou `+` | Supprimés, pour que le CSS de la fiche ne puisse pas sortir de sa portée. Écris-les comme des sélecteurs ordinaires. |
| HTML dans `content:` | Le texte décoratif est autorisé, mais `<` et `>` sont retirés et le texte est limité à 200 caractères. `attr()` et `counter()` sont autorisés. |
| `position: fixed` | Réécrit en `position: absolute`, donc pas de surcouche plein écran. |
| `!important` | Retiré, pour que le CSS de fiche ne puisse pas forcer le remplacement des styles de l'application. |
| Jetons du thème de l'application | Les jetons comme `--primary` et `--background` sont retirés, pour que le CSS de fiche ne puisse pas repeindre l'interface. |

Marinara insère le CSS de fiche avec des sélecteurs à portée limitée qui passent devant les styles de message de l'application. Il l'emporte sur les couleurs, les arrière-plans, les bordures et les polices à l'intérieur du chat. Les seules choses hors de sa portée sont ce que le nettoyage retire, tout ce qui se trouve hors du chat, et les styles que l'application applique en ligne ou avec `!important`. La couleur et la taille de police globales du chat, définies dans **Settings**, en sont un exemple.

**Polices personnalisées.** Intègre une police avec un URI `data:` en base64, ou choisis une pile de polices système ou sûres pour le web.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

```css
font-family: "Courier New", Consolas, monospace;
```

## Exclusive face à Chat : choisir une portée

- **Exclusive** fait de `[data-card-css]` les messages de ce personnage. C'est le meilleur choix pour les chats de groupe et pour donner une identité à chaque personnage. Le CSS qui vise des éléments à l'intérieur du message se comporte comme en mode **Chat**.
- **Chat** fait de `[data-card-css]` la zone de chat entière. C'est le meilleur choix pour les fiches en tête-à-tête qui veulent habiller l'arrière-plan ou l'ambiance, et pas seulement les bulles de message.

Construis ton CSS avec des sélecteurs `[data-card-css] .mari-message-...`, et ta fiche fonctionnera correctement dans les deux modes.

## Conseils

1. Stylise la bulle avec `.mari-message-bubble`, pas avec `[data-card-css]`. Ce dernier désigne la ligne pleine largeur : un arrière-plan posé dessus reste presque invisible.
2. Utilise des couleurs `rgba()`, elles s'accordent avec les thèmes clairs comme sombres.
3. Garde des animations discrètes. Préfère `transition` à une `animation` lourde sur les appareils modestes.
4. Utilise `@media (max-width: 768px)` pour les téléphones.
5. Ne dépends pas des classes utilitaires. Seules les accroches `mari-*` documentées sont stables.

## Vitrine : Eldritch Grimoire

Cette fiche est délibérément extravagante. Elle touche à chaque accroche documentée, dans chaque mode. Elle montre :

- des noms en capitales runiques lumineuses et un texte serif assorti
- un avatar remodelé et cerclé, plus des horodatages en petites capitales
- un sigil sur le bord de la ligne de message
- une bulle de roleplay animée avec une rune dans le coin, et une narration stylisée
- une bulle de Conversation et un indicateur de saisie inquiétant
- le panneau contextuel de profil ouvert au clic sur l'avatar, entièrement habillé
- la surface de jeu

Colle-la en entier dans le champ **Creator Notes**, puis active **Card Theming** dans la section **Chat Settings**. Elle habille les messages en Roleplay et en Conversation, le panneau contextuel en Conversation, et la surface en Game Mode (règle alors le mode sur **Chat**). Les sections sont séparées par `@chat-mode`, pour que chaque mode reçoive exactement les accroches dont il dispose. Tout passe le nettoyage sans encombre.

```html
<style>
  /* shared keyframe. Animate OPACITY, never box-shadow: box-shadow is a "paint"
     property, so animating it repaints and re-blurs the whole element every frame
     (which pins weak GPUs). Animating a layer's opacity is GPU-composited and cheap. */
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* EVERYWHERE (all modes). */
  /* These descendant hooks only match where message rows exist, so they are inert
     in Game and safe to leave unwrapped. */

  /* the character name, glowing crimson rune-caps */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.82rem;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  /* header row and timestamp */
  [data-card-css] .mari-message-meta {
    align-items: baseline;
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  /* reshape, ring, and saturate the clickable avatar. For a non-clickable avatar,
     target .mari-message-avatar > div for that layout. */
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
    filter: saturate(1.2) contrast(1.05);
  }
  /* glowing serif message text */
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    text-shadow: 0 0 2px rgba(168, 85, 247, 0.4);
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  /* ROLEPLAY */
  @chat-mode roleplay {
    /* the row itself, an arcane left edge. (data-grouped does not exist in
       roleplay, so there is no first-of-run trick here.) */
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    /* roleplay wraps the avatar button in its own glow layer. Flatten it
       so only the eldritch ring above hugs the picture. */
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    /* the visible bubble and a corner sigil */
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      /* a steady outer halo. An element's own box-shadow is not clipped by its own
         overflow: hidden, so this bloom shows even though message content is clipped.
         (No inset here: the pulsing inset glow lives on the ::after, so a static inset
         would stack with it and over-brighten the inner glow.) */
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* the breathing inner glow. Animate a full-bleed overlay's OPACITY (cheap, GPU
       composited) instead of the bubble's box-shadow (expensive: a full repaint every
       frame). overflow: hidden clips a child's OUTER shadow, so the pulse rides the inset
       glow while the halo above stays steady. pointer-events keeps it click-through. */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
      will-change: opacity;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
      text-shadow: 0 0 6px rgba(220, 38, 120, 0.9);
    }
    /* narration */
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
      opacity: 0.9;
    }
  }

  /* CONVERSATION */
  @chat-mode conversation {
    /* an arcane left edge on the first message of a run. [data-grouped] marks
       continuations from the same character, and it exists only in
       Conversation mode. */
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css][data-grouped] {
      border-left: 2px solid transparent;
    }
    /* the Bubbles-layout bubble. In the Linear layout there is no bubble, so
       the EVERYWHERE row hooks above carry the theme instead. */
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    /* "(name) is typing..." (Linear layout) */
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
      letter-spacing: 0.05em;
      text-shadow: 0 0 8px rgba(255, 92, 138, 0.6);
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
      box-shadow: 0 0 6px rgba(255, 92, 138, 0.85);
    }

    /* the avatar-click profile popout. The popout card is the scope element,
       so target it with no space, and its children as descendants. */
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-avatar > div {
      border-radius: 0.9rem;
      box-shadow: 0 0 0 2px #dc2678, 0 0 14px rgba(168, 85, 247, 0.5);
    }
    [data-card-css] .mari-about-me-status {
      box-shadow: 0 0 8px rgba(255, 92, 138, 0.9);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
      text-shadow: 0 0 10px rgba(220, 38, 120, 0.6);
    }
    [data-card-css] .mari-about-me-handle {
      color: rgba(201, 168, 255, 0.8);
    }
    [data-card-css] .mari-about-me-presence {
      color: rgba(201, 168, 255, 0.7);
    }
    [data-card-css] .mari-about-me-box {
      background: rgba(168, 85, 247, 0.08);
      border: 1px solid rgba(220, 38, 120, 0.3);
      border-radius: 0.75rem;
    }
    [data-card-css] .mari-about-me-label {
      color: #dc2678;
      letter-spacing: 0.14em;
    }
    [data-card-css] .mari-about-me-badge {
      background: rgba(220, 38, 120, 0.18);
      color: #ffd7ef;
    }
    [data-card-css] .mari-about-me-text {
      color: #f3d7ff;
      font-family: "Iowan Old Style", Georgia, serif;
    }
  }

  /* GAME (set the mode to Chat) */
  @chat-mode game {
    /* Game has its own layout with no message bubbles. In Chat scope,
       [data-card-css] is the whole game surface, so theme the area broadly. */
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

**Lignes de l'utilisateur face aux lignes des personnages.** Dans la portée **Exclusive**, `[data-card-css]` désigne le message du personnage lui-même, qui est aussi `.mari-message-assistant`. Pour habiller aussi tes propres lignes, passe à la portée **Chat**. Là, `[data-card-css]` couvre toute la zone, et `[data-card-css] .mari-message-user` et `.mari-message-assistant` sélectionnent chacun un côté.

Change les couleurs, le glyphe `content` et les polices pour en faire ta création.

## Créer du CSS de fiche avec l'aide d'une IA

Si tu préfères ne pas écrire le CSS à la main, donne ce prompt (le texte que Marinara envoie à l'IA) à une IA. Complète la description de ton personnage à l'endroit indiqué.

```text
I'm creating a character card for Marinara Engine (an AI chat app). The card has a
"Creator Notes" field where I can embed <style> blocks. Write CSS that themes the
character's messages.

Character concept: [describe the aesthetic]

Technical constraints:
- Use [data-card-css] for the message row (works in both Exclusive and Chat modes);
  use normal class selectors for things inside it.
- [data-card-css] .mari-message-bubble = the visible bubble (background / border /
  corners / shadow); [data-card-css] .mari-message-content = the text;
  [data-card-css] .mari-message-name = the display name;
  [data-card-css] .mari-message-avatar button = the clickable avatar
  (non-clickable fallback: .mari-message-avatar > div; in roleplay the button sits
  under an extra glow-wrapper div).
- Style the typing indicator via [data-card-css] .mari-typing-text and
  [data-card-css] .mari-typing-dots span.
- Conversation only: the avatar-click "about me" popout is themable via
  [data-card-css].mari-about-me-popout (the card), the banner via
  .mari-about-me-banner, the avatar via .mari-about-me-avatar > div, the name via
  .mari-about-me-name, the box via .mari-about-me-box, and the body via
  .mari-about-me-text. Wrap these in @chat-mode conversation { ... }.
- Wrap roleplay-only CSS in @chat-mode roleplay { ... }, conversation-only in
  @chat-mode conversation { ... }; CSS outside applies everywhere.
- Blocked: url(https://...), @import, :has(), !important, app theme tokens
  (--primary, etc.). position: fixed becomes absolute. Use url(data:...) and
  rgba() colors.
- [data-grouped] marks continuation messages, in Conversation mode ONLY
  (roleplay rows never carry it); there, use
  [data-card-css]:not([data-grouped]) for first-in-group.

Output a single <style> block I can paste into Creator Notes.
```

## Guides associés

- [Réglages d'apparence](appearance-settings.md)
- [Thèmes CSS personnalisés (bibliothèque de thèmes)](custom-css-themes.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
