# Zone de sécurité basse des PWA iOS (développeurs)

Ce guide destiné aux développeurs explique l'origine d'une bande colorée qui peut apparaître en bas de l'écran. Elle se manifeste quand Marinara Engine tourne comme application installée sur l'écran d'accueil d'un iPhone. Au programme : le correctif livré par Marinara, le compromis qu'il impose, et la méthode pour diagnostiquer la bande si une modification future la fait revenir.

Une PWA (Progressive Web App) est un site web que l'utilisateur installe sur l'écran d'accueil et ouvre comme une application native. Ce document s'adresse aux contributeurs et parle de code, ce n'est pas un guide pour l'utilisateur final.

## Le problème

Sur les iPhone équipés d'un indicateur d'accueil (les modèles Face ID), le bas de l'écran est une zone de sécurité réservée au geste d'accueil. iOS lui donne une hauteur d'environ 34px. Elle correspond à la valeur de la variable CSS `env(safe-area-inset-bottom)`.

Quand le style de la barre d'état de la PWA est réglé sur `black-translucent`, iOS empêche tout élément `position: fixed` de peindre dans cette zone. Aucun contournement CSS ne fonctionne. WebKit borne les décalages négatifs en bas, `calc(100dvh + env(safe-area-inset-bottom))` et les hauteurs négatives forcées.

Résultat : une bande visible sous la zone de saisie du chat. Cette bande, souvent surnommée le "chin" (le menton), affiche une couleur différente du reste de l'interface.

## Le correctif livré

Marinara règle le style de la barre d'état sur `black` plutôt que sur `black-translucent`. La balise meta se trouve dans `packages/client/index.html`.

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

La balise viewport conserve `viewport-fit=cover` et le comportement clavier par défaut.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

En mode `black`, iOS ne verrouille pas la zone basse. La coque de l'application utilise `fixed inset-0` sans forcer la hauteur du viewport : elle peint donc jusqu'en bas, à l'intérieur de la zone de sécurité. Le className de la coque, dans `packages/client/src/components/layout/AppShell.tsx`, est le suivant :

```
mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden
```

N'ajoute pas `interactive-widget=resizes-content` à la balise viewport. Sur les PWA mobiles, ce réglage peut redimensionner toute la coque du chat pendant l'animation du clavier et tronquer le défilement des messages.

## Le compromis

Impossible d'avoir à la fois une barre d'état translucide et un bas d'écran rempli. En mode `black`, la barre d'état est une bande sombre opaque. `black-translucent` offre un haut d'écran transparent plus élégant, mais rend la bande du bas impossible à supprimer. C'est une limitation stricte d'iOS.

<a id="landscape-the-cameras-side-insets"></a>

## Paysage : les marges latérales de la caméra

Quand un iPhone est tourné à l'horizontale, sa caméra (l'encoche ou Dynamic Island) se trouve sur le bord gauche ou droit. Avec `viewport-fit=cover`, la page passe dessous, et iOS indique cet espace par `env(safe-area-inset-left)` et `env(safe-area-inset-right)`. Sur les modèles Dynamic Island, il mesure environ 59px de chaque côté, quel que soit le sens de rotation. L'application Android de Marinara (SDK cible 34, sans affichage bord à bord) est disposée à l'écart de la découpe : les deux marges y valent donc 0. D'autres navigateurs Android peuvent signaler des marges non nulles, par exemple en plein écran ou bord à bord ; les mêmes variables les prennent en compte.

Marinara évite cet espace comme la bande de la barre d'état en portrait :

- `packages/client/src/styles/globals.css` lit une seule fois les deux marges dans `--mari-safe-area-inset-left` et `--mari-safe-area-inset-right`, sur `:root`. Tout le reste lit ces variables, jamais directement `env()`. `scripts/regressions/mobile-safe-area-inset.regression.ts` l'impose. Les boîtes de dialogue, l'omnibar, les éditeurs plein écran et les commandes TopBar conservent cette protection contre la caméra et les coins arrondis.
- Sur iPhone, `AppShell.tsx` identifie le côté de la caméra à partir de `window.orientation` (ou de `screen.orientation.angle` si la première API est indisponible). À 90°, la caméra est à gauche ; à −90°/270°, elle est à droite. Un attribut `data-mari-camera-side` sur `<html>` permet au CSS de mettre à zéro uniquement la marge du **conteneur** opposée, `--mari-shell-inset-left` ou `--mari-shell-inset-right`. Les rotations inconnues, iPad et Android gardent les marges du système.
- Dans le conteneur du téléphone, `.mari-app` prend ses valeurs `left` et `right` dans les variables du conteneur. Le fond de page du corps apparaît sur la caméra, de la même couleur que la bande de la barre d'état en portrait, sans marge symétrique sur l'autre bord.
- Les éléments fixes du conteneur se positionnent par rapport à l'écran, pas au conteneur : ils évitent donc cet espace eux-mêmes. Les panneaux du téléphone et leurs fonds dans `AppShell.tsx` utilisent `MOBILE_SHELL_PANEL_X_CLASS` avec les variables du conteneur. Les décorations, comme ses étoiles, sont `absolute` et restent ainsi à l'intérieur.

Pour vérifier sans téléphone, ouvre une zone d'affichage tactile de 874×402 et règle les deux variables sur `59px` dans une règle `:root` de la feuille de style (les styles en ligne prennent le dessus sur le sélecteur du côté de la caméra). Dans Chromium, tu peux aussi émuler les vraies marges avec la commande du protocole DevTools `Emulation.setSafeAreaInsetsOverride`. `e2e/phone-camera-side.e2e.ts` vérifie les deux sens de rotation, les anciennes et nouvelles API d'orientation, les rotations inconnues et les autres appareils. Le test e2e "a phone turned sideways keeps the app out from under its camera" vérifie le repli qui conserve les deux marges.

## Comment le diagnostic a été mené

La bande a été identifiée en colorant chaque couche puis en rouvrant l'application. Insère les styles de diagnostic dans `packages/client/dist/index.html`, à l'intérieur de son bloc `<style>` en ligne. Ce fichier n'est pas mis en cache par le service worker et il est toujours servi à jour. Les modifications apparaissent à la réouverture suivante, sans vider le cache.

```
html, body { background-color: #ff0000 !important; }
.mari-chat-input-box { background-color: #00ff00 !important; }
.mari-app { background: #0000ff !important; }
```

Voici comment lire le résultat :

- Bande rouge : c'est le canevas html qui peint là. En mode `black-translucent`, aucun élément fixed ne peut la recouvrir.
- Bande bleue : la boîte de la coque de l'application atteint le bas. C'est l'état attendu.
- Bande verte : la zone de saisie elle-même descend jusqu'au bord.

## Si une mise à jour casse le correctif

### Symptôme : la bande revient sous la zone de saisie

Vérification 1. Confirme que `apple-mobile-web-app-status-bar-style` vaut toujours `black` dans `packages/client/index.html`. Si la valeur est repassée à `black-translucent`, remets `black`.

Vérification 2. Confirme que le className d'AppShell, dans `packages/client/src/components/layout/AppShell.tsx`, contient toujours `mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden`. Ne combine jamais `inset-0` avec `h-screen`, `h-dvh` ou `max-h-screen`. Cela contraint trop la coque fixed et laisse le clavier mobile déplacer l'interface.

Vérification 3. Lance le diagnostic par couleurs décrit plus haut pour voir quelle couche peint la bande. Force la fermeture de l'application, puis rouvre-la. Inutile de vider le cache, puisque `dist/index.html` n'est pas préchargé en cache.

- Bande rouge alors que le reste est bleu : la boîte de la coque n'atteint pas le bas. Vérifie que le style de la barre d'état est bien `black`.
- Bande toujours rouge avec une coque bleue : la coque ne recouvre pas. Vérifie que `fixed inset-0` est intact.
- Bande bleue : la coque recouvre bien, mais la zone de saisie ne descend pas jusqu'en bas. Contrôle le padding du conteneur de saisie ci-dessous.

### Symptôme : la zone de saisie colle au bord de l'écran

Les trois composants de saisie ont besoin de `pb-3` sur leur conteneur externe pour garder un espacement flottant naturel, et non de `pb-0`.

- `packages/client/src/components/chat/ChatInput.tsx` : le conteneur contient `mari-chat-input chat-input-container px-3 pb-3`.
- `packages/client/src/components/chat/ConversationInput.tsx` : le conteneur contient `mari-chat-input chat-input-container relative px-2 sm:px-3 pb-3`.
- `packages/client/src/components/game/GameInput.tsx` : le conteneur contient `px-3 pt-2 pb-3`.

## Reconstruire

Le serveur sert le client compilé depuis `packages/client/dist` : toute modification des sources demande donc une reconstruction.

```
pnpm build:client
```

Efface ensuite les données du site sur l'appareil, puis rouvre la PWA. Sur le téléphone, ouvre **Settings** (Réglages), puis **Safari**, puis **Advanced** (Avancé), puis **Website Data** (données de sites web). Le service worker met en cache le JS et le CSS par hachage de contenu : un hachage modifié impose donc d'effacer les données du site pour charger les nouveaux chunks.

`dist/index.html` n'est pas mis en cache par le service worker et il est toujours servi à jour. Sers-t'en pour injecter rapidement des styles de diagnostic sans reconstruction complète.

## À retenir

- `black-translucent` donne une barre d'état transparente, mais verrouille la zone de sécurité basse. Aucun contournement CSS n'existe.
- `black` ou `default` donne une barre d'état opaque et laisse les éléments fixed atteindre la zone de sécurité basse.
- `env(safe-area-inset-bottom)` vaut environ 34px sur les iPhone Face ID. Utilise cette variable au besoin pour décaler le contenu interactif au-dessus de l'indicateur d'accueil.
- En mode `black-translucent`, les unités de viewport `dvh` et `lvh` valent la hauteur du contenu sûr, pas la hauteur physique de l'écran. Ne les utilise pas pour étendre la coque au-delà de cette limite.
- `interactive-widget=resizes-content` peut redimensionner la coque fixed du chat pendant l'ouverture du clavier. Mieux vaut garder le comportement viewport par défaut.

## Guides associés

- [Architecture du frontend (développeurs)](frontend.md)
- [Guide PWA iOS / iPadOS](../installation/ios-pwa.md)
