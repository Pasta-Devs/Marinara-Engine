# Extensions personnelles

Les extensions personnelles sont des brouillons de code privés que Professor Mari écrit pour toi. Ouvre la section **Settings** (Paramètres) > **Addons** > **Personal Extensions**.

Le message par défaut est le suivant :

> Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.

Cette section ne propose ni action New Draft, ni contrôle d'import. Demande à Professor Mari de créer ou de retoucher un brouillon. Elle peut enregistrer du code, mais elle ne peut ni l'approuver ni l'activer.

Pour écrire et importer ton propre paquet, consulte le [guide de création des extensions personnelles](writing-personal-extensions.md). Les paquets que tu écris passent par le flux Extensions externes, protégé séparément.

## Relire et activer

Tout brouillon arrive désactivé. Marinara calcule une empreinte SHA-256 du code exécutable exact. Ouvre le brouillon, examine le code, compare l'empreinte affichée, puis choisis **Review and Run** (relire et exécuter) seulement si tu acceptes cette version précise. La moindre modification du code exécutable, ou la restauration d'une révision, désactive l'extension et impose une nouvelle approbation.

L'isolation en bac à sable réduit les pouvoirs de l'extension, elle ne rend pas pour autant un code quelconque digne de confiance. Une extension malveillante peut encore gaspiller du processeur jusqu'à ce que le chien de garde l'arrête, saturer son propre espace de stockage dans les limites imposées, ou se montrer trompeuse dans ses logs (le journal du serveur). Les extensions pleine page renoncent délibérément à cette isolation. Relis toujours le code avant de l'activer.

## Isolation à l'exécution

Une extension navigateur (Browser Extension) tourne dans un Worker dédié, à l'intérieur d'une iframe isolée à origine opaque. Elle n'a accès ni à la page de Marinara, ni au DOM, ni aux cookies, ni au stockage du navigateur, ni aux API d'origine, ni au réseau. Ses capacités se limitent à un stockage d'extension privé, aux logs, à des minuteurs gérés, à l'enregistrement d'un nettoyage, à des fenêtres restreintes, à des points de contribution sûrs vers l'interface hôte et à un instantané en lecture seule des identifiants du chat actif et des personnages. Elle ne reçoit certains champs des fiches de personnage actives ou du persona sélectionné que si les permissions correspondantes sont déclarées et approuvées.

Une extension peut ajouter des actions dans la barre supérieure, des entrées au menu Extensions et des panneaux persistants sur le côté droit, via `marinara.ui.registerContribution(...)`. Marinara affiche ces surfaces avec le thème actif et un jeu fixe de contrôles : titres, texte, sortie préformatée, boutons, champs de saisie, listes de sélection, interrupteurs, curseurs, sélecteurs de couleur et espaceurs. Une extension fournit du contenu et un état, jamais de HTML, de CSS, d'URL, de composants React ni de gestionnaires d'événements de l'hôte.

Ces capacités d'interface et ces règles sont identiques pour toutes les extensions navigateur en bac à sable, quelle que soit leur provenance. Une extension tierce importée (External Extension) utilise ce runtime sûr, sauf si son paquet demande explicitement l'option **Full page access** (accès à la page entière) ou emploie le format `marinara.extension` antérieur au bac à sable, décrit plus bas.

### Ajouter un panneau affiché par Marinara

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

Utilise `kind: "button"` pour une action compacte et `kind: "menu-item"` pour une action du menu Extensions. Par défaut, les boutons ciblent `surface: "top-bar"`. Ils peuvent aussi viser `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` ou `settings`, avec `position` réglé sur `header`, `before-content` ou `after-content`. `icon` accepte tout nom Lucide en kebab-case pris en charge par Marinara. Les deux types d'action appellent `onActivate`. Un `panel` appelle `onActivate` à son ouverture ; ses boutons appellent `onEvent` avec les valeurs courantes de tous ses contrôles. La référence permet des mises à jour propres au type : `button` accepte `label`, `description`, `icon`, `surface` et `position` ; `menu-item` accepte `label`, `description` et `icon` ; `panel` accepte `label`, `description`, `icon` et `elements`. Toutes les références prennent en charge `remove()`. Les identifiants acceptent lettres, chiffres, `.`, `_` et `-`.

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

### Utiliser le contexte du chat actif

La version 5 de l'API des extensions navigateur expose des identifiants opaques pour le chat affiché à l'instant dans Marinara :

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

La fonction `marinara.context.get()` renvoie le même instantané, sans abonnement. Quand aucun chat n'est actif, `chatId` vaut `null` et `characterIds` est vide. Le champ `characterId` n'est renseigné que si un seul personnage participe ; dans un chat de groupe, `characterIds` liste tous les participants et `characterId` reste à `null`. Le champ `personaId` n'est renseigné que si la permission `read_active_persona` est approuvée.

Les identifiants de chat et de personnage sont toujours disponibles : une extension peut s'en servir pour cloisonner son stockage privé. Les champs des enregistrements, eux, exigent une des deux permissions facultatives du manifeste de l'extension, ou les deux :

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- La permission `read_active_characters` renseigne `characters` pour les fiches qui participent au chat actif.
- La permission `read_active_persona` renseigne `persona` pour le persona sélectionné par le chat actif.

Sans la permission, la valeur reste `[]` ou `null`. Marinara affiche chaque permission demandée dans la section **Requested access** (accès demandés), puis à nouveau dans la fenêtre d'approbation de l'empreinte exacte. Ajouter ou retirer une permission change l'empreinte du code exécutable, désactive l'extension et impose une nouvelle approbation.

Un instantané de personnage ne contient que `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` et `conversationDisplayName`. Un instantané de persona ne contient que `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` et `conversationDisplayName`. Le texte est limité en longueur avant de franchir le pont du bac à sable.

Marinara n'envoie jamais les messages, les notes du créateur, les prompts système, les instructions post-historique, les commentaires, les chemins des avatars, les bibliothèques complètes de personnages ou de personas, les champs non déclarés, les métadonnées du chat, les descripteurs de base de données, un accès réseau ni des opérations de modification. Les mises à jour du contexte restent liées à l'empreinte approuvée du code ; elles arrivent quand le chat actif, sa liste de personnages ou son persona sélectionné change.

### Anciennes extensions et extensions pleine page

Contrôleurs météo, éditeurs de prompts et autres flux de travail conséquents sont des cas d'usage tout à fait valables pour les contributions. Leur portage sûr peut s'appuyer sur un lanceur dans le menu ou la barre supérieure, complété par des panneaux mis à jour au fil des étapes. En revanche, les paquets existants qui superposent des éléments au DOM, interrogent les sélecteurs CSS de Marinara, parcourent les entrailles de React ou appellent les routes `/api` de même origine ne peuvent pas être importés tels quels dans le runtime sûr.

Les contributions d'interface fournissent l'interface, pas des pouvoirs implicites. L'API de contexte expose toujours les identifiants du chat actif et des personnages ; au-delà, elle ne donne que les champs déclarés des enregistrements actifs listés plus haut. Une fonctionnalité qui a besoin des messages, des presets, des lorebooks, de données de personnage ou de persona non déclarées, ou d'effets visuels de scène réclame toujours une capacité de courtage distincte et étroitement délimitée, exposée par Marinara. Une extension ne doit pas la simuler en accédant au DOM de l'hôte ou en lançant des requêtes réseau sans restriction.

Si une extension externe dépend réellement d'un accès au DOM de l'hôte, elle peut demander :

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Full page access n'est pas une capacité du bac à sable.** Le JavaScript et le CSS approuvés s'exécutent à l'intérieur de la page de Marinara. Ce code peut lire ou modifier tout ce qui est visible dans la session de navigateur en cours, inspecter les chats et les fiches, utiliser le stockage du navigateur, lancer des requêtes réseau et appeler les API de Marinara de même origine. Ses pouvoirs sur la page équivalent en pratique à du code collé dans la console du navigateur. Les brouillons de Professor Mari ne peuvent pas le demander.

Marinara traite l'ancienne enveloppe v1 `kind: "marinara.extension"`, dépourvue de champ `capabilities` explicite, comme un paquet antérieur au bac à sable et lui attribue **Full page access** à l'import. Les paquets anciens comme WeatherTweaker rejoignent ainsi le bon parcours de relecture, au lieu d'échouer en silence dans un Worker. Un paquet moderne qui emploie cette enveloppe mais veut le runtime sûr doit inclure `"capabilities": []`.

Les deux verrous des extensions externes et l'approbation de l'empreinte exacte restent en vigueur. Toute modification du code, du CSS ou des permissions désactive l'extension et impose une nouvelle approbation. La désactivation supprime les nœuds de script et de feuille de style posés par Marinara, annule les minuteurs créés via l'API de compatibilité et exécute les rappels enregistrés avec `marinara.onCleanup(...)`. Comme le code de la page peut créer des écouteurs, des minuteurs, des variables globales ou des modifications du DOM non enregistrés, le nettoyage reste approximatif : recharge la page après avoir désactivé une extension s'il en reste quelque chose.

L'ancienne API `marinara.ui.showWindow(...)` reste disponible pour ouvrir une fenêtre temporaire dans l'iframe à origine opaque. Elle emploie les mêmes contrôles fixes et renvoie les références `update(...)` et `close()`. Privilégie les contributions quand l'outil doit rester accessible par la navigation habituelle de Marinara.

Une extension serveur (Server Extension) tourne dans un processus Node distinct, aux permissions restreintes, sous macOS Seatbelt ou Linux Bubblewrap. Elle n'a accès ni aux fichiers de Marinara, ni à tes fichiers, ni aux secrets hérités du serveur, ni au réseau, ni aux processus enfants, ni aux workers, ni aux modules natifs. Si Marinara ne parvient pas à mettre en place un bac à sable pris en charge par le système, les extensions serveur restent désactivées.

### Plateformes prises en charge

Les extensions navigateur sont isolées par le navigateur lui-même : elles fonctionnent donc partout. Les extensions serveur exigent un bac à sable système pris en charge ; à défaut, elles restent désactivées et ne peuvent pas être activées – jamais Marinara ne se rabat sur une exécution sans bac à sable.

| Plateforme              | Extensions navigateur en bac à sable | Extensions externes pleine page | Extensions serveur                               |
| ----------------------- | ------------------------------------ | ------------------------------- | ------------------------------------------------ |
| macOS                   | ✅ Isolées                           | ⚠️ Confiance explicite requise  | ✅ Isolées (Seatbelt)                            |
| Linux (avec Bubblewrap) | ✅ Isolées                           | ⚠️ Confiance explicite requise  | ✅ Isolées (Bubblewrap)                          |
| Linux (sans `bwrap`)    | ✅ Isolées                           | ⚠️ Confiance explicite requise  | ⛔ Désactivées – installe `bwrap`                |
| Windows                 | ✅ Isolées                           | ⚠️ Confiance explicite requise  | ⛔ Désactivées – utilise une extension navigateur |
| Android                 | ✅ Isolées                           | ⚠️ Confiance explicite requise  | ⛔ Désactivées – utilise une extension navigateur |

Sous Windows et Android, aucun bac à sable de processus n'est pris en charge par le système : les extensions serveur y sont donc indisponibles, par conception. Utilise plutôt une extension navigateur, ou fais tourner le serveur Marinara sous macOS ou Linux (avec `bwrap`) si tu as vraiment besoin d'une extension serveur.

## Extensions externes

Les imports tiers sont verrouillés et masqués par défaut. Il faut passer deux étapes :

1. Sur la machine qui héberge Marinara, définis `ENABLE_EXTERNAL_EXTENSIONS=true` dans le fichier `.env`.
2. Ouvre la section **Settings** > **Advanced** > **Danger Zone**, descends sous les contrôles de suppression de données, lis l'avertissement, puis active l'option **Allow third-party extension imports** (autoriser les imports d'extensions tierces).

Alors seulement la section **Settings** > **Addons** affiche **External Extensions** avec ses contrôles d'import de fichier et de dossier. Les formats pris en charge sont toujours décompressés :

- `.personal-extension.zip` et les paquets `.zip` compatibles ;
- les manifestes `.json` ;
- `.css` ;
- `.js`, `.mjs` et `.cjs` ;
- `.server.js`, `.server.mjs` et `.server.cjs`.

Un import n'apporte jamais d'approbation avec lui et ne peut pas s'activer tout seul. Les enregistrements anciens, importés depuis un profil, stockés manuellement ou de provenance inconnue comptent eux aussi comme externes. Ils restent masqués, ne peuvent pas être approuvés et sont exclus des deux runtimes tant que les deux verrous ne sont pas levés.

Parcours la liste **Requested access** avant d'approuver une empreinte exacte. La plupart des extensions navigateur devraient rester dans le bac à sable sûr. Un paquet marqué **Full page access** n'est délibérément pas isolé : ne l'active que si tu as inspecté cette version précise et que tu lui fais confiance.

Refermer l'un ou l'autre verrou arrête les processus serveur externes actifs, supprime les workers du navigateur ainsi que les nœuds du runtime pleine page, et désactive les enregistrements externes stockés. Rouvrir les verrous ne les relance pas automatiquement. Recharge la page si une extension pleine page a laissé derrière elle des modifications qu'elle n'avait pas enregistrées pour le nettoyage.

Une extension tierce peut contenir du code malveillant ou dangereux. Examine toujours chaque ligne avant de la télécharger, de l'importer ou de l'activer. Tu procèdes entièrement sous ta propre responsabilité.

## Export, révisions et récupération

L'action d'export d'une extension télécharge un paquet transportable. Les paquets exportés puis restaurés restent désactivés. Restaurer une révision la ramène également à l'état de brouillon désactivé.

Si une extension se comporte mal, choisis **Disable** (désactiver). Si l'interface est inaccessible, arrête Marinara et passe la valeur `enabled` de l'enregistrement `installed_extensions` concerné à `"false"`. Ne définis jamais `approvedHash` à la main.

## Guides associés

- [Écrire des extensions personnelles](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Configuration du serveur](../CONFIGURATION.md)
- [Sauvegarde et restauration](../data/backup-and-restore.md)
- [Accès à distance](../REMOTE_ACCESS.md)
