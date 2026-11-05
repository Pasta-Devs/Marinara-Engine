# Guide du thème CSS de fiche

Le CSS de fiche donne à une fiche de personnage ou de persona son propre style dans le chat. Tu intègres du CSS dans le champ **Creator Notes** (notes du créateur) de la fiche, et Marinara l'applique aux messages de ce personnage. Il ne peut styliser que le chat, jamais le reste de l'application. Ce guide s'adresse aux créateurs de fiches.

## Avant de commencer

Les termes utilisés dans ce guide :

- Le **CSS** règle les couleurs, les polices, les bordures et les espacements.
- Le **CSS de fiche** est du CSS intégré dans une fiche. Il habille les messages de cette fiche.
- **Card Theming** (thème de fiche) est la commande, propre à chaque chat, qui active le CSS de fiche. Elle se trouve dans **Chat Settings → Characters** (réglages du chat → personnages), ou dans **Party** (équipe) en Game Mode.
- Un **sélecteur** est la partie d'une règle CSS qui choisit les éléments à styliser. Une espace entre deux sélecteurs signifie "à l'intérieur de" : `.a .b` correspond donc à un `.b` situé dans un `.a`.
- Une **mise en page** décrit la disposition des messages. Conversation propose des lignes, **Linear**, et des bulles, **Bubbles**.

## Démarrage rapide

Voici un bloc de départ à coller à l'étape 2 :

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

Tu ajoutes le CSS à la fiche, puis tu l'actives dans le chat.

1. Ouvre le personnage dans le Character Editor (éditeur de personnage) et repère **Creator Notes**. Les personas ont le même champ dans le Persona Editor (éditeur de persona).
2. Colle le bloc de départ dans **Creator Notes**, puis enregistre la fiche.
3. Ouvre un chat avec ce personnage.
4. Ouvre **Chat Settings**, puis **Characters** (ou **Party** en Game Mode).
5. Choisis **Exclusive** ou **Chat** sous **Card Theming**. Le réglage démarre sur **Disabled**.

Les messages du personnage changent aussitôt.

Si ça n'a pas marché : les boutons **Disabled**, **Exclusive** et **Chat** n'apparaissent que si un personnage actif du chat a du CSS dans son champ **Creator Notes**. Le CSS d'un persona seul ne les fait pas apparaître : le thème d'un persona a donc besoin, lui aussi, d'un personnage du chat avec un bloc `<style>`. Vérifie que ton bloc `<style>` a bien été enregistré. Dans les chats Roleplay, **Color Character Names in Text** (colorer les noms des personnages dans le texte) se trouve dans **Characters**, sous **Add Character** (ajouter un personnage).

Le nom brille en rose et le texte passe au rose pâle, dans toutes les mises en page. La règle de bulle ajoute un dégradé violet et une bordure rose. `.mari-message-bubble` n'existe que dans la mise en page **Bubbles** et en roleplay : dans **Linear**, la mise en page Conversation par défaut, la règle de bulle ne produit donc rien.

Pour un test impossible à manquer, utilise cette règle. Elle vise le texte du message, présent dans tous les modes et toutes les mises en page, et fait virer son arrière-plan au rose vif.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Fonctionnement du Card Theming

Quand un personnage avec du CSS dans **Creator Notes** est actif, Marinara lit chaque bloc `<style>`, retire tout ce qui est dangereux (voir [Ce que tu ne peux pas styliser](#what-you-cannot-style)), limite la portée du CSS pour qu'il n'atteigne que le chat, puis l'insère pour que ses sélecteurs l'emportent sur le style de message de l'application.

Le mode d'application se choisit chat par chat, dans **Chat Settings → Characters** (ou **Party** en Game Mode).

| Mode | Effet |
| --- | --- |
| **Disabled** (par défaut) | Le CSS de fiche est désactivé. |
| **Exclusive** | Le CSS de chaque personnage ne touche que ses propres messages. |
| **Chat** | Tout le CSS de fiche touche l'ensemble de la zone de chat, éléments d'interface compris. |

Choisis **Exclusive** pour les chats de groupe où chaque personnage a son propre style. Choisis **Chat** pour les fiches en tête-à-tête qui habillent toute la surface du chat, comme l'arrière-plan.

## La règle de portée

Marinara réécrit ton CSS pour qu'il n'atteigne que le chat.

- En mode **Chat**, toute la portée est limitée à la zone de chat. `[data-card-css]` désigne la zone de chat.
- En mode **Exclusive**, toute la portée est limitée à chacun des éléments de message de ton personnage. `[data-card-css]` désigne le message de ce personnage.

Utilise donc `[data-card-css]` pour styliser l'élément de message lui-même, et des sélecteurs de classe normaux pour ce qui se trouve à l'intérieur, comme `.mari-message-bubble`, `.mari-message-content` et `.mari-message-name`. Une classe posée sur ce même élément ne peut pas y correspondre en tant que descendant. Construis ton CSS avec `[data-card-css] .mari-message-...`, et ta fiche fonctionnera dans les deux modes.

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

Dans la portée **Exclusive**, `[data-card-css]` désigne le message du personnage lui-même, qui est aussi `.mari-message-assistant`. Pour habiller aussi tes propres lignes, passe à la portée **Chat**. Là, `[data-card-css] .mari-message-user` et `.mari-message-assistant` sélectionnent chacun un côté.

## Viser un mode avec @chat-mode

Place tes règles dans `@chat-mode roleplay`, `@chat-mode conversation` ou `@chat-mode game` pour viser une seule surface. Le CSS placé hors de tout bloc s'applique partout. Les requêtes `@media` standard fonctionnent à l'intérieur de ces blocs.

```html
<style>
  /* Applies in all modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

Game Mode bénéficie d'une prise en charge de base. En mode **Chat**, le CSS de fiche atteint toute la surface de jeu : `[data-card-css]` habille donc la zone de jeu. Game Mode a sa propre mise en page, sans bulles de message : vise large, par exemple l'arrière-plan de la zone. Le style par personnage (**Exclusive**) de la narration de jeu n'est pas encore disponible.

## Ce que tu peux styliser

Roleplay et Conversation reposent sur le même squelette. Tiens-t'en aux classes `mari-*` et aux attributs `data-*` ci-dessous. Les autres classes changent d'une version à l'autre.

| Sélecteur | Ce qu'il vise |
| --- | --- |
| `[data-card-css]` | Toute la ligne de message (l'élément de portée). Pratique pour un liseré sur le bord, ou pour la zone de chat en mode **Chat**. |
| `[data-card-css] .mari-message-bubble` | La bulle visible : arrière-plan, bordure, coins, ombre. En **Bubbles** et en roleplay. |
| `[data-card-css] .mari-message-content` | En **Bubbles**, l'élément de bulle lui-même. En **Linear**, uniquement le texte du message. |
| `[data-card-css] .mari-message-name` | Le nom affiché du personnage. |
| `[data-card-css] .mari-message-meta` | La ligne d'en-tête qui porte le nom et l'horodatage. |
| `[data-card-css] .mari-message-timestamp` | L'horodatage. |
| `[data-card-css] .mari-message-avatar` | La colonne de l'avatar. |
| `[data-card-css] .mari-message-narrator` | Les messages du narrateur (roleplay). |
| `[data-card-css] .mari-message-user` | Les messages de l'utilisateur. Utilise `.mari-message-assistant` pour les messages du personnage. |
| `[data-card-css] p`, `[data-card-css] span` | Les paragraphes et les éléments span en ligne dans le texte. |
| `[data-grouped]` | Les messages qui prolongent ceux du même personnage. Conversation uniquement. Utilise `[data-card-css]:not([data-grouped])` pour le premier message d'un groupe. |

Pour changer de mise en page, ouvre **Settings → Appearance → Conversation** (Paramètres → Apparence → Conversation), puis **Conversation Display** (affichage de Conversation), puis **Chat Layout** (disposition du chat). En **Linear**, stylise `.mari-message-content` (le texte) et `[data-card-css]` (la ligne), puisqu'il n'y a pas de bulle.

Une bulle stylisée :

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

Dans la mise en page **Linear** de Conversation, une ligne "(name) is typing..." s'affiche pendant qu'un personnage écrit.

| Sélecteur | Ce qu'il vise |
| --- | --- |
| `[data-card-css] .mari-typing-text` | L'étiquette. |
| `[data-card-css] .mari-typing-dots span` | Les points animés. |
| `[data-card-css] .mari-typing-indicator` | La ligne. Elle porte le nom dans `data-typing-name`. |

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

L'avatar est un cercle par défaut. L'exemple vise le bouton d'avatar cliquable. Pour un avatar non cliquable, utilise `.mari-message-avatar > div`. En roleplay, le bouton se trouve dans un `div` supplémentaire qui produit une lueur. Aplatis-le si tu ne veux garder que ton propre anneau.

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### Panneau contextuel de profil About Me (Conversation uniquement)

En mode Conversation, un clic sur un avatar ouvre un panneau contextuel de profil avec le "about me". Les fiches de personnage et les personas peuvent habiller leur propre panneau contextuel. Il n'existe ni en roleplay ni en Game Mode : place donc ces règles dans `@chat-mode conversation` si ta fiche fournit aussi du CSS pour d'autres modes.

La carte du panneau contextuel est l'élément de portée. Vise-la avec `[data-card-css].mari-about-me-popout` (sans espace, même élément), et ses enfants comme des descendants. En mode **Chat**, tu peux utiliser `.mari-about-me-name` directement.

| Sélecteur | Ce qu'il vise |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | La carte du panneau contextuel : arrière-plan, bordure, forme. |
| `[data-card-css] .mari-about-me-banner` | La bande de bannière du haut (par défaut, la couleur du nom). |
| `[data-card-css] .mari-about-me-avatar` | Le conteneur de l'avatar agrandi. Utilise `... > div` pour le cercle. |
| `[data-card-css] .mari-about-me-status` | Le point du statut de présence (personnages uniquement). |
| `[data-card-css] .mari-about-me-name` | Le titre du nom affiché. |
| `[data-card-css] .mari-about-me-handle` | La ligne secondaire en @nom, affichée quand un nom affiché Convo diffère. |
| `[data-card-css] .mari-about-me-presence` | La ligne de statut ou d'activité (personnages uniquement). |
| `[data-card-css] .mari-about-me-box` | Le cadre conteneur du About Me. |
| `[data-card-css] .mari-about-me-label` | La légende "ABOUT ME". |
| `[data-card-css] .mari-about-me-badge` | La pastille Default ou Chat-specific. |
| `[data-card-css] .mari-about-me-text` | Le corps de texte "about me". |

```css
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
  }
}
```

<a id="what-you-cannot-style"></a>

## Ce que tu ne peux pas styliser

Le nettoyage retire ces éléments pour des raisons de sécurité.

| Bloqué | Pourquoi |
| --- | --- |
| `url(https://...)` | Aucune requête réseau, pour éviter le pistage et les fuites de données. Seul `url(data:...)` est autorisé, pour les images et les polices intégrées. |
| `@font-face` avec des URL externes | Seules les sources de police en `data:` sont conservées. Le nom de la famille est renommé, pour qu'il ne puisse pas remplacer les polices de l'application. |
| `@import` | Aucun chargement de feuille de style externe. |
| Sélecteurs `:has()` | Ils ne peuvent pas sonder des éléments hors du chat. |
| Règles imbriquées et sélecteurs qui commencent par `~` ou `+` | Supprimés, pour que le CSS de fiche ne puisse pas sortir de sa portée. Écris des sélecteurs ordinaires. |
| HTML dans `content:` | Le texte décoratif est autorisé, mais `<` et `>` sont retirés et le texte est limité à 200 caractères. `attr()` et `counter()` sont autorisés. |
| `position: fixed` | Réécrit en `position: absolute`, donc pas de surcouche plein écran. |
| `!important` | Retiré, pour que le CSS de fiche ne puisse pas forcer le remplacement des styles de l'application. |
| Jetons du thème de l'application | Les jetons comme `--primary` et `--background` sont retirés, pour que le CSS de fiche ne puisse pas repeindre l'interface de l'application. |

Le CSS de fiche l'emporte sur les styles de message de l'application pour les couleurs, les arrière-plans, les bordures et les polices à l'intérieur du chat. Il ne peut rien contre ce que le nettoyage retire, contre tout ce qui se trouve hors du chat, ni contre les styles que l'application applique en ligne ou avec `!important`. La couleur et la taille de police globales du chat, définies dans **Settings**, en sont un exemple.

Pour une police personnalisée, intègre-la avec un URI `data:` en base64, ou utilise une pile de polices système.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

## Conseils

1. Stylise la bulle avec `.mari-message-bubble`, pas avec `[data-card-css]`. La ligne occupe toute la largeur : un arrière-plan posé dessus reste presque invisible.
2. Utilise des couleurs `rgba()` pour qu'elles s'accordent avec les thèmes clairs comme sombres.
3. Garde des animations discrètes. Préfère `transition` à une `animation` lourde sur les appareils modestes. Anime `opacity`, pas `box-shadow`, qui redessine l'élément à chaque image.
4. Utilise `@media (max-width: 768px)` pour les téléphones.
5. Ne dépends pas des classes utilitaires. Seules les accroches `mari-*` documentées sont stables.

## Vitrine : Eldritch Grimoire

Cet exemple touche les principales accroches, dans chaque mode : des noms lumineux, un texte serif assorti, un avatar cerclé, une bulle de roleplay animée avec une rune dans le coin, une bulle de Conversation, un indicateur de saisie inquiétant et la surface de jeu. Colle-le dans **Creator Notes**, puis choisis un mode de Card Theming dans **Chat Settings → Characters** (ou **Party** en Game Mode). Choisis **Chat** pour la surface de jeu. Change les couleurs, le glyphe `content` et les polices pour en faire ta création.

```html
<style>
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* All modes */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
  }
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  @chat-mode roleplay {
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* breathing inner glow: animate a full-bleed overlay's opacity, which is cheap */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
    }
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
    }
  }

  @chat-mode conversation {
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
    }
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
    }
  }

  /* Game: in Chat scope, [data-card-css] is the whole game surface */
  @chat-mode game {
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

## Créer du CSS de fiche avec l'aide d'une IA

Pour ne pas écrire le CSS à la main, donne le prompt ci-dessous à un assistant IA. Complète la description de ton personnage à l'endroit indiqué.

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
