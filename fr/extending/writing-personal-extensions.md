# Écrire ses propres extensions personnelles

Ce guide explique comment écrire une Browser Extension ou une Server Extension, en faire un package et l'importer. Il s'adresse aux personnes qui savent écrire du JavaScript. Pour examiner et exécuter une extension, consulte [Extensions personnelles](personal-extensions.md).

Le code que tu écris et importes toi-même est traité comme une **External Extension** (extension externe). Il est désactivé au départ et ne peut pas s'exécuter tant que tu ne l'as pas examiné et que tu n'as pas approuvé son empreinte SHA-256 exacte.

## Avant de commencer

Les External Extensions restent masquées tant que tu n'as pas franchi les deux étapes de sécurité décrites dans [Autoriser les imports tiers](personal-extensions.md#allow-third-party-imports) : `ENABLE_EXTERNAL_EXTENSIONS=true` dans `.env`, et **Allow third-party extension imports** (autoriser les imports d'extensions tierces) sous **Settings → Advanced → Danger Zone** (Paramètres → Avancé → Zone de danger).

L'importation et la gestion des extensions nécessitent aussi un accès localhost ou le secret d'administration. Depuis un téléphone, une adresse LAN ou un navigateur distant, définis `ADMIN_SECRET` sur le serveur et saisis la même valeur dans **Settings → Advanced → Admin Access** (Paramètres → Avancé → Accès administrateur).

Choisis l'environnement le moins puissant qui suffit à la tâche :

| Environnement | Usage | Limite importante |
| --- | --- | --- |
| Sandboxed Browser Extension | État privé, contexte du chat actif, boutons, actions de menu et panneaux rendus par Marinara | Aucun accès au DOM de Marinara, aux cookies, au stockage du navigateur, au réseau ni à du HTML arbitraire |
| Server Extension | Logique en arrière-plan qui nécessite des minuteurs gérés et un stockage privé pour l'extension | Bac à sable distinct, géré par le système d'exploitation ; aucun accès aux fichiers ou secrets de Marinara, au réseau, aux processus enfants ni aux modules natifs |
| Full-page External Extension | Ancien code qui a besoin de la page de Marinara ou des API de même origine | Aucun bac à sable ; à réserver au code exact auquel tu fais pleinement confiance |

Les Browser Extensions fonctionnent sur toutes les plateformes prises en charge. Les Server Extensions nécessitent Seatbelt sous macOS ou Bubblewrap sous Linux. Consulte le [tableau des plateformes](personal-extensions.md#platform-support) avant de choisir une Server Extension.

## Démarrage rapide d'une Browser Extension

Crée un dossier organisé comme ceci :

```text
Hello Panel/
  manifest.json
  extension.js
  extension.css
```

Utilise ce fichier `manifest.json` :

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

Utilise ce fichier `extension.js` :

```js
const saved = await marinara.storage.get();
let count = Number(saved.count) || 0;

const statusElement = () => ({
  kind: "text",
  text: `Button pressed ${count} time${count === 1 ? "" : "s"}.`,
});
const elements = () => [
  statusElement(),
  { kind: "button", id: "increment", label: "Count one" },
];

const panel = marinara.ui.registerContribution({
  id: "hello-panel",
  kind: "panel",
  label: "Hello Panel",
  description: "Minimal Personal Extension example",
  icon: "hand",
  elements: elements(),
  onEvent: async ({ elementId }) => {
    if (elementId !== "increment") return;
    count += 1;
    await marinara.storage.patch({ count });
    panel.update({ elements: elements() });
    marinara.ui.showWindow({ title: "Hello Panel", elements: [statusElement()] });
  },
});

marinara.log.info("Hello Panel loaded");
marinara.onCleanup(() => panel.remove());
```

Utilise ce fichier `extension.css` pour mettre en forme la fenêtre iframe restreinte ouverte par le bouton :

```css
[data-ext-root] {
  font-size: 16px;
}
```

Importe ensuite l'extension et exécute-la :

1. Ouvre **Settings → Addons → External Extensions** (Paramètres → Modules complémentaires → Extensions externes).
2. Choisis **Import Extension Folder** (importer un dossier d'extension) et sélectionne `Hello Panel`, ou compresse le dossier et importe le fichier ZIP avec **Import Extension File** (importer un fichier d'extension).
3. Ouvre le brouillon désactivé et examine son manifeste et son code JavaScript.
4. Choisis **Review and Run** (relire et exécuter) et approuve l'empreinte exacte affichée.
5. Ouvre le menu Extensions et sélectionne **Hello Panel**.

Le même exemple exécutable se trouve dans le dépôt, sous `docs/examples/personal-extensions/browser-minimal/`.

## Référence de la Browser API

Les Browser Extensions exécutées dans le bac à sable reçoivent un seul objet global figé nommé `marinara` :

| API | Rôle |
| --- | --- |
| `runtime`, `version` | Nom de l'environnement (`client`) et version actuelle de la Browser API |
| `extensionId`, `extensionName`, `capabilities` | Identité et capacités approuvées pour cette révision exacte de l'extension |
| `log.debug/info/warn/error(...)` | Écrire une entrée étiquetée dans la console du navigateur |
| `storage.get()` | Lire l'objet JSON privé de cette extension |
| `storage.patch(object)` | Fusionner des valeurs dans le stockage privé et renvoyer le nouvel objet |
| `storage.delete()` | Effacer le stockage privé |
| `context.get()` | Lire l'instantané actuel du chat actif |
| `context.subscribe(listener)` | Recevoir les changements de contexte ; renvoie une fonction de désabonnement |
| `ui.registerContribution(options)` | Ajouter un bouton sûr, un élément du menu Extensions ou un panneau rendu par Marinara |
| `ui.showWindow(options)` | Ouvrir une fenêtre iframe restreinte |
| `dice.registerFormat(options)` | Apprendre une notation à `/roll` ; Marinara lance les dés qu'elle désigne |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Minuteurs gérés et supprimés à l'arrêt de l'extension |
| `onCleanup(callback)` | Enregistrer une logique de nettoyage supplémentaire |

Utilise les [panneaux rendus par Marinara](#add-a-marinara-rendered-panel) pour l'interface normale, le [contexte du chat actif](#use-active-chat-context) pour les comportements qui dépendent du chat et les [formats de dés](#add-a-dice-format) pour une notation `/roll` personnalisée. L'état de l'extension doit rester dans `marinara.storage`, pas dans le stockage du navigateur.

`showWindow({ title, elements, onEvent, onClose })` renvoie un descripteur doté de `update({ title?, elements? })` et `close()`. Le CSS du package met en forme ces fenêtres iframe isolées ; les contributions rendues par l'hôte utilisent toujours le thème et les contrôles propres à Marinara.

L'environnement Browser sûr ne possède aucune API de DOM ou de réseau. Ne contourne pas cette limite. Si une capacité utile manque, demande une capacité précise et limitée à l'hôte au lieu d'adopter par défaut l'accès à la page entière.

### Capacités de contexte

Déclare l'accès facultatif aux enregistrements dans `config.capabilities` :

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` renseigne un ensemble limité de champs des fiches Character du chat actif.
- `read_active_persona` renseigne un ensemble limité de champs de la Persona sélectionnée.
- `full_page_access` sélectionne l'environnement de compatibilité sans bac à sable et n'est disponible que pour les External Extensions.

Modifier les capacités change l'empreinte de l'exécutable, désactive l'extension et impose un nouvel examen.

<a id="what-a-browser-extension-can-do"></a>

### Ce qu'une Browser Extension peut faire

Une Browser Extension s'exécute dans un Worker dédié, à l'intérieur d'une iframe isolée à origine opaque. Elle n'a accès ni à la page de Marinara, ni au DOM, ni aux cookies, ni au stockage du navigateur, ni aux API d'origine, ni au réseau. Ses capacités se limitent à un stockage d'extension privé, à la journalisation, à des minuteurs gérés, à l'enregistrement d'un nettoyage, à des fenêtres restreintes, à des emplacements de contribution sûrs dans l'interface hôte et à un instantané en lecture seule des identifiants du chat actif et des personnages. Elle ne reçoit certains champs des fiches de personnage actives ou du persona sélectionné que si les permissions correspondantes sont déclarées et approuvées.

Une extension peut ajouter des actions dans la barre supérieure ou dans un panneau latéral, des entrées au menu Extensions et des panneaux persistants sur le côté droit, via `marinara.ui.registerContribution(...)`. Marinara affiche ces surfaces avec le thème actif et un jeu fixe de contrôles : titres, texte, sortie préformatée, boutons, champs de saisie de texte, listes de sélection, interrupteurs, curseurs, sélecteurs de couleur et espaceurs. Une extension fournit du contenu et un état, jamais de HTML, de CSS, d'URL, de composants React ni de gestionnaires d'événements de l'hôte.

Ces capacités d'interface et ces règles sont identiques pour toutes les Browser Extensions en bac à sable, quelle que soit leur provenance. Une extension tierce importée (External Extension) utilise cet environnement sûr, sauf si son package demande explicitement **Full page access** (accès complet à la page) ou emploie le format `marinara.extension` antérieur au bac à sable, décrit plus bas.

### Estimer les tokens d'un texte

Les extensions personnelles Browser, Full page access et Server peuvent utiliser l'estimateur de tokens de texte intégré à Marinara :

```js
const tokens = marinara.estimateTextTokens(text);
```

La signature est `estimateTextTokens(text: string): number`, également décrite par le type exporté `PersonalExtensionTokenApi` de `@marinara-engine/shared`. L'appel est synchrone, ne nécessite aucune capacité supplémentaire et renvoie l'estimation de tokens de Marinara, indépendante du modèle, plutôt que le résultat exact d'un tokenizer. Sur une ancienne version d'Engine, vérifie `typeof marinara.estimateTextTokens === "function"` avant d'appeler la fonction.

<a id="add-a-marinara-rendered-panel"></a>

### Ajouter un panneau rendu par Marinara

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  description: "Tune a weather scene without leaving Marinara.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    {
      kind: "select",
      id: "weather",
      label: "Weather",
      value: "rain",
      options: [
        { value: "rain", label: "Rain" },
        { value: "snow", label: "Snow" },
        { value: "aurora", label: "Aurora" },
      ],
    },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => {
    const settings = await marinara.storage.get();
    // Update the panel when stored state should be reflected in the controls.
  },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});

marinara.onCleanup(() => panel.remove());
```

Utilise `kind: "button"` pour une action compacte et `kind: "menu-item"` pour une action du menu Extensions. Utilise `kind: "command"` pour une entrée du Command Center (centre de commandes) qui active une contribution existante de la même révision de l'extension. Une commande exige `targetContributionId` et ne peut utiliser ni `onActivate` ni `onEvent`.

```js
marinara.ui.registerContribution({
  id: "open-weather",
  kind: "command",
  label: "Open weather controls",
  targetContributionId: "weather-settings",
});
```

L'hôte ne résout une commande que si la cible a le même identifiant d'extension et la même empreinte de contenu. Les cibles absentes, issues d'une autre extension ou d'une révision périmée échouent par sécurité. Par défaut, les boutons ciblent `surface: "top-bar"`. Ils peuvent aussi viser `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` ou `settings`, avec `position` réglé sur `header`, `before-content` ou `after-content`. `icon` accepte tout nom d'icône Lucide en kebab-case pris en charge par Marinara. Les deux types d'action appellent `onActivate`. Un `panel` appelle `onActivate` à son ouverture ; ses boutons appellent `onEvent` avec les valeurs actuelles de tous les contrôles du panneau. Le descripteur renvoyé permet des mises à jour propres à chaque type : `button` accepte `label`, `description`, `icon`, `surface` et `position` ; `menu-item` accepte `label`, `description` et `icon` ; `panel` accepte `label`, `description`, `icon` et `elements`. Tous les descripteurs prennent en charge `remove()`. Les identifiants peuvent contenir des lettres, des chiffres, `.`, `_` et `-`.

Par exemple, ceci place une action native au-dessus du contenu du panneau Presets :

```js
marinara.ui.registerContribution({
  id: "preset-helper",
  kind: "button",
  label: "Preset helper",
  description: "Run the preset helper",
  icon: "list-sparkles",
  surface: "presets",
  position: "before-content",
  onActivate: () => {
    // Run extension behavior here.
  },
});
```

Un outil complexe peut construire une interface en plusieurs étapes en mettant à jour les éléments du panneau après un événement. Garde l'état de l'application dans `marinara.storage` ; ne l'encode pas dans le balisage.

<a id="use-active-chat-context"></a>

### Utiliser le contexte du chat actif

La version 5 de la Browser Extension API expose des identifiants opaques pour le chat affiché à l'instant dans Marinara :

```js
const renderForContext = async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
  if (!chatId) return; // Home, a library, or another surface without an active chat.

  const storage = await marinara.storage.get();
  const tab = storage.tabsByChat?.[chatId];

  // characterId is available only for a single-Character chat.
  // Use characterIds for group chats.
  marinara.log.debug("Loaded Notepad tab", {
    chatId,
    characterId,
    characterIds,
    personaId,
    characterNames: characters.map((character) => character.name),
    personaName: persona?.name ?? null,
    tab,
  });
};

const unsubscribe = marinara.context.subscribe(renderForContext);
marinara.onCleanup(unsubscribe);
```

`marinara.context.get()` renvoie le même instantané actuel, sans abonnement. Quand aucun chat n'est actif, `chatId` vaut `null` et `characterIds` est vide. `characterId` n'est renseigné que si exactement un personnage participe ; dans un chat de groupe, `characterIds` expose tous les participants et `characterId` reste à `null`. `personaId` n'est renseigné que si la permission `read_active_persona` est approuvée.

Les identifiants de chat et de personnage sont toujours disponibles et permettent à une extension de cloisonner son propre stockage privé. Les champs des enregistrements exigent une des deux permissions facultatives du manifeste de l'extension, ou les deux :

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` renseigne `characters` pour les fiches qui participent au chat actif.
- `read_active_persona` renseigne `persona` pour le persona sélectionné par le chat actif.

Sans la permission, sa valeur reste `[]` ou `null`. Marinara affiche chaque permission demandée dans **Requested access** (accès demandés), puis à nouveau dans la boîte de dialogue d'approbation de l'empreinte exacte. Ajouter ou retirer une permission change l'empreinte de l'exécutable, désactive l'extension et impose une nouvelle approbation.

Un instantané de personnage ne contient que `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` et `conversationDisplayName`. Un instantané de persona ne contient que `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` et `conversationDisplayName`. Le texte est limité en longueur avant de franchir le pont du bac à sable.

Marinara n'envoie jamais les messages, les notes du créateur, les prompts système, les instructions post-historique, les commentaires, les chemins des avatars, les bibliothèques complètes de personnages ou de personas, les champs non déclarés, les métadonnées du chat, les descripteurs de base de données, un accès réseau ni des opérations de modification. Les mises à jour du contexte restent liées à l'empreinte approuvée du code ; elles arrivent quand le chat actif, sa liste de personnages ou son persona sélectionné change.

<a id="add-a-dice-format"></a>

### Ajouter un format de dés

La version 6 de la Browser Extension API permet à une extension d'apprendre à `/roll` une notation qui lui est propre, comme une réserve de dés narratifs. L'extension lit la notation et désigne les dés à lancer ; Marinara les lance avec son propre générateur sécurisé et lui renvoie les faces. Une extension peut dire ce que signifie un jet, jamais ce que les dés ont donné.

```js
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0] };

const format = marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  // Return null for notation this format does not read.
  parse(notation) {
    const terms = [...notation.matchAll(/(\d+)\s*(boost|setback)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array(Number(count)).fill(kind));
    return { dice: kinds.map(() => 6), kinds };
  },
  // rolls[i] is the face Marinara threw for dice[i]; plan is what parse returned.
  read({ notation, dice, rolls, plan }) {
    const net = rolls.reduce((sum, face, i) => sum + SYMBOLS[plan.kinds[i]][face - 1], 0);
    return { total: net, text: net > 0 ? `${net} success` : "failure" };
  },
});
marinara.onCleanup(() => format.remove());
```

`/roll 2 boost 1 setback` publie alors les faces, le total et le texte de l'extension, avec le nom du format comme libellé. Une notation simple comme `2d6` ou `4d6kh3` lance toujours les dés comme avant et n'est jamais transmise à une extension. Les autres notations sont transmises à chaque format enregistré à tour de rôle ; le premier dont `parse` renvoie des dés effectue le jet.

- `parse(notation)` renvoie `null` ou `{ dice: [sides, ...] }` avec 1 à 100 dés de 2 à 1 000 faces. Les autres propriétés de l'objet restent dans le bac à sable et sont renvoyées à `read` sous le nom `plan`.
- `read(...)` renvoie `{ total, text?, kept? }` : un nombre fini, au plus 200 caractères de texte brut et, facultativement, les positions des dés qui ont compté, par ordre croissant. `/roll` barre les autres.
- Chaque extension peut enregistrer 4 formats. La notation est limitée à 100 caractères. `parse` et `read` peuvent être asynchrones, mais chacune doit répondre en moins de 2 secondes.
- Le texte est affiché comme texte brut : les liens, les images, la mise en forme et le HTML sont échappés.

Les formats de dés s'appliquent à `/roll` dans le navigateur. L'outil `roll_dice` du Game Master et les autres jets côté serveur conservent la notation intégrée et les dés de l'ensemble de règles. Sur une ancienne version d'Engine, vérifie `typeof marinara.dice?.registerFormat === "function"` avant de l'appeler.

### Anciennes extensions et extensions pleine page

Contrôleurs météo, éditeurs de prompts et autres flux de travail conséquents sont des cas d'usage valables pour les contributions. Leur portage sûr peut s'appuyer sur un lanceur dans le menu ou la barre supérieure, complété par des panneaux mis à jour au fil des étapes. Les packages existants qui superposent des éléments au DOM, interrogent les sélecteurs CSS de Marinara, parcourent les entrailles de React ou appellent les routes `/api` de même origine ne peuvent pas être importés tels quels dans l'environnement sûr.

Les contributions d'interface fournissent l'interface, pas des pouvoirs implicites. L'API de contexte expose toujours les identifiants du chat actif et des personnages ; au-delà, elle ne peut exposer que les champs déclarés des enregistrements actifs listés plus haut. Une fonctionnalité qui a besoin des messages, des presets, des lorebooks, de données de personnage ou de persona non déclarées, ou d'effets visuels de scène réclame toujours une capacité de courtage distincte et étroitement délimitée, exposée par Marinara. Une extension ne doit pas la simuler en accédant au DOM de l'hôte ou en lançant des requêtes réseau sans restriction.

Si une External Extension dépend d'un accès au DOM de l'hôte, elle peut demander :

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Full page access n'est pas une capacité du bac à sable.** Le JavaScript et le CSS approuvés s'exécutent à l'intérieur de la page de Marinara. Ce code peut lire ou modifier tout ce qui est visible dans la session de navigateur en cours, inspecter les chats et les fiches, utiliser le stockage du navigateur, lancer des requêtes réseau et appeler les API de Marinara de même origine. Ses pouvoirs sur la page équivalent en pratique à du code collé dans la console du navigateur. Les brouillons de Professor Mari ne peuvent pas le demander.

Les extensions pleine page devraient utiliser `marinara.fetch(...)` pour les requêtes réseau. Cette fonction a la même signature et renvoie le même résultat que `window.fetch`, tout en permettant à **Settings > Addons > External Extensions** d'afficher le nombre de requêtes de cette extension pendant la session, les octets transférés indiqués par les réponses, la fréquence récente des requêtes et un avertissement en cas de trafic élevé prolongé. Les appels directs à `window.fetch` restent disponibles, car l'accès à la page entière exécute du code de confiance dans la page, mais ces requêtes ne peuvent pas être attribuées à l'extension.

Marinara traite l'ancienne enveloppe v1 `kind: "marinara.extension"`, dépourvue de champ `capabilities` explicite, comme un package antérieur au bac à sable et lui attribue **Full page access** à l'importation. Les packages anciens comme WeatherTweaker rejoignent ainsi le bon parcours d'examen, au lieu d'échouer en silence dans un Worker. Un package moderne qui emploie cette enveloppe mais veut l'environnement sûr doit inclure `"capabilities": []`.

Les deux protections des External Extensions et l'approbation de l'empreinte exacte restent en vigueur. Toute modification du code, du CSS ou des permissions désactive l'extension et impose une nouvelle approbation. La désactivation supprime les nœuds de script et de feuille de style posés par Marinara, annule les minuteurs créés via l'API de compatibilité et exécute les rappels enregistrés avec `marinara.onCleanup(...)`. Comme le code de la page peut créer des écouteurs, des minuteurs, des variables globales ou des modifications du DOM non enregistrés, le nettoyage se fait au mieux : recharge la page après avoir désactivé une extension s'il en reste quelque chose.

L'ancienne API `marinara.ui.showWindow(...)` reste disponible pour ouvrir une fenêtre temporaire dans l'iframe à origine opaque. Elle emploie les mêmes contrôles fixes et renvoie les descripteurs `update(...)` et `close()`. Privilégie les contributions quand l'outil doit rester accessible par la navigation habituelle de Marinara.

## Démarrage rapide d'une Server Extension

Crée ce dossier :

```text
Server Counter/
  manifest.json
  server-extension.js
```

Utilise ce fichier `manifest.json` :

```json
{
  "kind": "marinara.personal-server-extension",
  "version": 1,
  "config": {
    "name": "Server Counter",
    "version": "1.0.0",
    "description": "A minimal sandboxed Server Extension.",
    "runtime": "server",
    "capabilities": [],
    "serverJsPath": "server-extension.js"
  }
}
```

Utilise ce fichier `server-extension.js` :

```js
const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
```

Le même package exécutable est disponible sous `docs/examples/personal-extensions/server-minimal/`.

Le code serveur reçoit `marinara.runtime`, `marinara.version`, l'identité de l'extension, `log`, `storage`, les minuteurs gérés et `onCleanup`. Il ne reçoit aucun accès au système de fichiers, aux processus, au réseau, au chargement de modules ou à la base de données de Marinara.

Les Server Extensions restent désactivées lorsque l'hôte ne peut pas mettre en place Seatbelt ou Bubblewrap. Il s'agit d'une restriction de la plateforme, pas d'une erreur de l'extension.

## Référence du package et du manifeste

| Champ | Remarques |
| --- | --- |
| `kind` | `marinara.personal-extension` ou `marinara.personal-server-extension` |
| `version` de premier niveau | Version de l'enveloppe du package ; actuellement `1` |
| `config.name` | Nom d'affichage obligatoire, de 1 à 200 caractères |
| `config.version` | Version facultative de l'extension, par exemple `1.2.0` ; les versions numériques séparées par des points permettent les avertissements de rétrogradation |
| `config.description` | Description facultative, jusqu'à 2 000 caractères |
| `config.runtime` | `client` ou `server` ; valeur par défaut : `client` |
| `config.capabilities` | Capacités Browser demandées ; les Server Extensions doivent utiliser une liste vide |
| `config.jsPath` / `config.serverJsPath` | Chemin du fichier JavaScript ou tableau ordonné de chemins, relatif au manifeste |
| `config.cssPath` | Chemin facultatif du fichier CSS ou tableau ordonné ; le CSS de l'environnement sûr reste dans l'iframe isolée |
| `config.js`, `config.serverJs`, `config.css` | Variantes en ligne lorsque des fichiers distincts sont inutiles |

Utilise du JavaScript simple. Marinara ne compile pas TypeScript et n'installe pas les dépendances d'une extension. Si nécessaire, regroupe les dépendances dans ton JavaScript avant l'importation.

Les fichiers indépendants `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs` et `.css` peuvent aussi être importés directement. Un manifeste reste préférable, car il enregistre explicitement l'identité, l'environnement, la version, les capacités et l'ordre des fichiers.

### Limites de validation

| Contenu | Limite actuelle |
| --- | --- |
| Nom / version / description | 200 caractères / 64 caractères / 2 000 caractères |
| JS Browser ou Server | Aucune limite de source par champ ; la limite du fichier, de l'archive ou de la requête englobante reste applicable |
| CSS | 256 KiB |
| ZIP importé | 32 MiB compressés, 2 MiB par entrée de texte et 16 MiB de texte extrait au total |
| Stockage privé | 1 000 000 octets de JSON sérialisé par extension |

Les limites du ZIP, de la requête, des messages du bac à sable et du stockage protègent des frontières distinctes du transport ou de l'exécution ; elles ne constituent pas une règle sur le code source exécutable.

## Cycle de mise à jour et de récupération

- Chaque nouvelle importation commence désactivée et non approuvée.
- Modifier le code, le CSS, l'environnement ou les capacités efface l'approbation et désactive l'extension.
- Réimporter le même nom met à jour l'enregistrement existant après confirmation. Une réimportation identique octet par octet conserve l'empreinte et l'approbation actuelles ; un contenu exécutable modifié efface l'approbation. Marinara avertit lorsque les versions numériques indiquent une rétrogradation.
- **Export** (exporter) écrit le manifeste et les fichiers sources actuels dans un package portable. L'approbation n'est jamais exportée.
- Restaurer une révision, importer un profil ou restaurer une sauvegarde laisse l'extension désactivée jusqu'à un nouvel examen.
- **Disable** (désactiver) arrête l'environnement et le nettoyage enregistré. Le code en pleine page peut nécessiter un rechargement de la page s'il a créé des effets secondaires non enregistrés.
- **Delete** (supprimer) supprime l'enregistrement installé. Exporte-le d'abord si tu risques d'avoir encore besoin des sources.

## Débogage

| Symptôme | Vérification |
| --- | --- |
| Les contrôles d'importation externe sont absents | Ouvre les deux protections External Extension décrites plus haut |
| La gestion indique que localhost ou Admin Access est requis | Configure `ADMIN_SECRET` et enregistre-le sous **Admin Access** |
| L'importation ne trouve aucune extension | Vérifie `manifest.json` et ses chemins relatifs ; Server nécessite du JS, tandis que Browser nécessite du CSS ou du JS |
| L'extension se désactive après une modification | C'est normal : examine et approuve la nouvelle empreinte exacte |
| Le code Browser ne peut pas utiliser `document`, `window`, `fetch` ou le stockage local | C'est normal dans le bac à sable sûr ; utilise les API intermédiaires documentées |
| Server Extension est indisponible | Utilise Seatbelt sous macOS ou Linux avec Bubblewrap, ou passe à une Browser Extension |
| Browser Extension lève une exception | Ouvre les outils de développement du navigateur ; `marinara.log` et les erreurs de démarrage portent le nom de l'extension |
| Server Extension lève une exception | Vérifie son état dans **Settings → Addons** et le journal du serveur Marinara |

Le CSS, le stockage privé, les archives importées et les messages d'exécution conservent des limites de sécurité distinctes. Marinara devrait signaler la limite qui a rejeté un package au lieu de présenter le problème comme un échec d'exécution.

## Guides connexes

- [Extensions personnelles](personal-extensions.md)
- [Configuration du serveur](../CONFIGURATION.md)
- [Dépannage](../TROUBLESHOOTING.md)
- [Architecture des extensions personnelles](../development/personal-extensions.md)
