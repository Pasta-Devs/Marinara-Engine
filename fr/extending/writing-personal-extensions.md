# Écrire ses propres extensions personnelles

Ce guide s'adresse aux personnes qui écrivent leurs propres extensions pour Marinara Engine. Pour installer, examiner et exécuter une extension en toute sécurité, commence par [Personal Extensions](personal-extensions.md).

Le code que tu écris et importes toi-même est traité comme une **External Extension** (extension externe). Il est désactivé au départ et ne peut pas s'exécuter tant que tu ne l'as pas examiné et que tu n'as pas approuvé son empreinte SHA-256 exacte.

## Avant de commencer

Les External Extensions restent masquées tant que les deux protections ne sont pas ouvertes :

1. Définis `ENABLE_EXTERNAL_EXTENSIONS=true` dans le fichier `.env` de l'hôte Marinara.
2. Ouvre **Settings** > **Advanced** > **Danger Zone**, puis active **Allow third-party extension imports**.

L'importation et la gestion des extensions nécessitent aussi un accès localhost ou un **Admin Access** configuré. Si tu utilises Marinara depuis un téléphone, une adresse LAN ou un navigateur distant, définis `ADMIN_SECRET` sur le serveur et saisis la même valeur dans **Settings** > **Advanced** > **Admin Access**.

Choisis l'environnement le moins puissant qui suffit à la tâche :

| Environnement | Usage | Limite importante |
| --- | --- | --- |
| Sandboxed Browser Extension | État privé, contexte du chat actif, boutons, actions de menu et panneaux rendus par Marinara | Aucun accès au DOM de Marinara, aux cookies, au stockage du navigateur, au réseau ni à du HTML arbitraire |
| Server Extension | Logique en arrière-plan qui nécessite des minuteurs gérés et un stockage privé pour l'extension | Bac à sable distinct du système d'exploitation ; aucun accès aux fichiers ou secrets de Marinara, au réseau, aux processus enfants ni aux modules natifs |
| Full-page External Extension | Ancien code qui a réellement besoin de la page de Marinara ou des API de même origine | Aucun bac à sable ; à réserver au code exact que tu as entièrement examiné et auquel tu fais pleinement confiance |

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

1. Ouvre **Settings** > **Addons** > **External Extensions**.
2. Choisis **Import Folder** et sélectionne `Hello Panel`, ou compresse le dossier et importe le fichier ZIP.
3. Ouvre le brouillon désactivé et examine son manifeste et son code JavaScript.
4. Choisis **Review and Run** et approuve l'empreinte exacte affichée.
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
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Minuteurs gérés et supprimés à l'arrêt de l'extension |
| `onCleanup(callback)` | Enregistrer une logique de nettoyage supplémentaire |

Utilise les [panneaux rendus par Marinara](personal-extensions.md#add-a-marinara-rendered-panel) pour l'interface normale et le [contexte du chat actif](personal-extensions.md#use-active-chat-context) pour les comportements qui dépendent du chat. L'état de l'extension doit rester dans `marinara.storage`, pas dans le stockage du navigateur.

`showWindow({ title, elements, onEvent, onClose })` renvoie un descripteur doté de `update({ title?, elements? })` et `close()`. Le CSS du paquet met en forme ces fenêtres iframe isolées ; les contributions rendues par l'hôte utilisent toujours le thème et les contrôles propres à Marinara.

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

Le même paquet exécutable est disponible sous `docs/examples/personal-extensions/server-minimal/`.

Le code serveur reçoit `marinara.runtime`, `marinara.version`, l'identité de l'extension, `log`, `storage`, les minuteurs gérés et `onCleanup`. Il ne reçoit aucun accès au système de fichiers, aux processus, au réseau, au chargement de modules ou à la base de données de Marinara.

Les Server Extensions restent désactivées lorsque l'hôte ne peut pas mettre en place Seatbelt ou Bubblewrap. Il s'agit d'une restriction de la plateforme, pas d'une erreur de l'extension.

## Référence du paquet et du manifeste

| Champ | Remarques |
| --- | --- |
| `kind` | `marinara.personal-extension` ou `marinara.personal-server-extension` |
| top-level `version` | Version de l'enveloppe du paquet ; actuellement `1` |
| `config.name` | Nom d'affichage obligatoire, de 1 à 200 caractères |
| `config.version` | Version facultative de l'extension, par exemple `1.2.0` ; les versions numériques séparées par des points permettent les avertissements de rétrogradation |
| `config.description` | Description facultative, jusqu'à 2 000 caractères |
| `config.runtime` | `client` ou `server` ; valeur par défaut : `client` |
| `config.capabilities` | Capacités Browser demandées ; les Server Extensions doivent utiliser une liste vide |
| `config.jsPath` / `config.serverJsPath` | Chemin du fichier JavaScript ou tableau ordonné de chemins, relatif au manifeste |
| `config.cssPath` | Chemin facultatif du fichier CSS ou tableau ordonné ; le CSS de l'environnement sûr reste dans l'iframe isolée |
| `config.js`, `config.serverJs`, `config.css` | Solutions intégrées lorsque des fichiers distincts sont inutiles |

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
- **Export** écrit le manifeste et les fichiers sources actuels dans un paquet portable. L'approbation n'est jamais exportée.
- Restaurer une révision, importer un profil ou restaurer une sauvegarde laisse l'extension désactivée jusqu'à un nouvel examen.
- **Disable** arrête l'environnement et le nettoyage enregistré. Le code en pleine page peut nécessiter un rechargement s'il a créé des effets secondaires non enregistrés.
- **Delete** supprime l'enregistrement installé. Exporte-le d'abord si tu risques d'avoir encore besoin des sources.

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
| Server Extension lève une exception | Vérifie son état dans **Settings** > **Addons** et le journal du serveur Marinara |

Le CSS, le stockage privé, les archives importées et les messages d'exécution conservent des limites de sécurité distinctes. Marinara doit signaler la limite qui a rejeté un paquet au lieu de présenter le problème comme un échec d'exécution.

## Guides connexes

- [Personal Extensions](personal-extensions.md)
- [Configuration du serveur](../CONFIGURATION.md)
- [Dépannage](../TROUBLESHOOTING.md)
- [Architecture des Personal Extensions](../development/personal-extensions.md)
