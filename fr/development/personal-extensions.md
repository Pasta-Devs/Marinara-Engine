# Architecture des extensions personnelles

Les extensions personnelles sont du code désactivé par défaut, approuvé par empreinte, et exécuté dans deux environnements isolés. Seuls les brouillons de Professor Mari sont disponibles par défaut. Toute autre source constitue une extension externe et exige deux verrous indépendants, ouverts par l'opérateur.

## Invariants de sécurité

Ces propriétés doivent rester vraies :

1. La création et l'import produisent toujours un brouillon désactivé et non approuvé.
2. L'approbation exige l'empreinte de contenu `sha256:` exacte du moment, ainsi qu'une confirmation explicite d'exécution de code. L'accès complet à la page exige une confirmation explicite supplémentaire.
3. Toute modification du code exécutable désactive l'extension et efface `approvedHash`.
4. Un retour en arrière restaure un brouillon désactivé.
5. La sauvegarde et l'import d'un profil effacent l'approbation et l'état activé.
6. Professor Mari peut créer et mettre à jour des brouillons, mais aucune de ses actions ne les approuve ni ne les active.
7. Toute source autre que `professor_mari` est externe, y compris `external`, `local`, `legacy`, `profile_import`, ainsi que les valeurs inconnues, normalisées en `legacy`.
8. Les enregistrements externes n'apparaissent ni dans les réponses de gestion ni dans celles de l'environnement d'exécution, sauf si `ENABLE_EXTERNAL_EXTENSIONS=true` et si l'option **Danger Zone** (zone de danger) enregistrée est elle aussi activée.
9. Fermer l'un ou l'autre verrou désactive les enregistrements externes stockés et arrête les processus serveur en cours. Côté navigateur, l'interrogation périodique de l'environnement d'exécution supprime les workers actifs.
10. Le code navigateur en bac à sable ne s'exécute jamais dans le document de Marinara. Seule une extension navigateur externe dont la permission `full_page_access` est approuvée sur empreinte exacte peut utiliser l'environnement d'exécution de page distinct. Le code serveur ne s'exécute jamais dans le processus du serveur de Marinara.
11. Marinara n'a ni installation par URL, ni catalogue distant, ni système de mise à jour automatique.
12. Les contributions à l'hôte sont de simples descripteurs validés. Le balisage, les styles, les URL, les composants et les callbacks d'une extension n'entrent jamais dans l'arbre React de Marinara.
13. L'enregistrement, l'activation, les événements, les mises à jour et la suppression d'une contribution restent liés à l'empreinte de contenu exacte approuvée pour l'extension activée.
14. Par défaut, les instantanés de contexte navigateur ne contiennent que l'identifiant du chat actif et les identifiants des personnages. Les permissions facultatives `read_active_characters` et `read_active_persona` peuvent y ajouter des champs bornés et autorisés, issus des seuls enregistrements actifs dans ce chat. Elles n'exposent jamais les messages, les bibliothèques complètes, des champs non déclarés, des métadonnées ni un accès applicatif.
15. Les permissions demandées font partie de l'empreinte du code exécutable. Tout changement de permission désactive l'extension et impose une nouvelle approbation sur empreinte exacte.
16. La permission `full_page_access` est réservée aux extensions externes, exige les deux verrous des extensions externes et n'est jamais accessible aux brouillons de Professor Mari. C'est un mode de confiance explicite, pas une promesse de bac à sable.

Les verrous sont appliqués dans les routes et dans les services d'exécution. Masquer des contrôles ne constitue pas une frontière de sécurité. Un enregistrement externe ajouté à la main, restauré, hérité d'une ancienne version ou arrivé par un canal détourné doit rester invisible et non exécutable tant que l'un des deux verrous est fermé.

## Stockage et politique

La table de fichiers `installed_extensions` stocke les métadonnées, le code exécutable, `contentHash`, `approvedHash`, la source et jusqu'à dix révisions antérieures du code exécutable. Les réglages privés d'une extension sont stockés dans `app_settings`, sous des clés préfixées par `extension-storage:`. L'option **Danger Zone** utilise la clé `external-extensions-enabled`.

Au démarrage, Marinara exécute `preparePersonalExtensionTrust`. Une ligne héritée d'une ancienne version, sans empreinte, est conservée, mais désactivée et non approuvée. Une ligne dont l'empreinte stockée ne correspond plus à ses champs exécutables est elle aussi désactivée, et son empreinte est recalculée.

Le fichier `personal-extension-policy.service.ts` combine le verrou `.env` en vigueur et le choix enregistré par l'utilisateur. Le fichier `personal-extension-storage.service.ts` peut désactiver tous les enregistrements qui ne viennent pas de Professor Mari. Le surveillant du fichier `.env` réapplique la politique en deux secondes environ et demande à l'environnement d'exécution serveur d'arrêter le code dès que le verrou se ferme.

## API

La surface de gestion se trouve sous `/api/personal-extensions` :

- `GET /policy` renvoie l'état des deux verrous et la disponibilité du bac à sable serveur.
- `PATCH /policy/external` modifie l'option **Danger Zone** et refuse la valeur `true` tant que le verrou `.env` est fermé.
- `GET /` liste les brouillons de Professor Mari, et les brouillons externes seulement lorsque les deux verrous sont ouverts.
- `POST /` importe une extension externe ; la requête est rejetée si les deux verrous ne sont pas ouverts.
- `PATCH /:id` modifie ou désactive un brouillon.
- `POST /:id/approve` approuve l'empreinte exacte du moment, applique le verrou externe et refuse d'approuver une extension serveur en l'absence d'un bac à sable pris en charge par le système.
- `POST /:id/rollback` restaure une révision antérieure désactivée.
- `DELETE /:id` supprime l'extension et ses réglages privés.

Les métadonnées d'exécution navigateur approuvées se lisent via `GET /runtime/client`. Le code en bac à sable est servi par `GET /:id/sandbox.html?hash=...`. Le code et le CSS de la page complète sont servis par `GET /:id/page-runtime.js?hash=...` et `GET /:id/page-style.css?hash=...`. Chaque point d'accès exige que l'empreinte exacte reste activée, approuvée et autorisée par la politique ; les points d'accès de page exigent en plus une source externe et la permission `full_page_access`.

## Environnement d'exécution navigateur en bac à sable

Le fichier `PersonalExtensionInjector.tsx` crée une iframe cachée avec `sandbox="allow-scripts"` et sans `allow-same-origin`. L'iframe a donc une origine opaque : elle ne peut accéder ni au DOM de Marinara, ni aux cookies, ni au stockage, ni aux API de même origine.

La réponse du bac à sable remplace la politique de page habituelle par une CSP très restrictive : aucune ressource par défaut, aucune connexion, aucun formulaire, aucun objet et aucun droit de navigation. Le CSS de l'extension reste enfermé dans l'iframe cachée. Le JavaScript s'exécute dans un Worker dédié, créé par le code d'amorçage de confiance de l'iframe. Les objets globaux liés au réseau et aux workers imbriqués sont supprimés, par défense en profondeur.

Le worker ne reçoit que :

- des logs cloisonnés dans son propre espace de noms ;
- un stockage privé d'extension, arbitré par la page parente ;
- des minuteurs gérés ;
- l'enregistrement de routines de nettoyage ;
- les identifiants, en lecture seule, du chat actif et des personnages, via `marinara.context` ;
- des champs bornés issus des fiches de personnage actives et du persona sélectionné, uniquement via des capacités approuvées séparément ;
- une fenêtre d'iframe restreinte, via `marinara.ui.showWindow(...)` ;
- des emplacements de contribution de confiance dans l'hôte, via `marinara.ui.registerContribution(...)`.

La version 5 de l'API des extensions navigateur ajoute `marinara.context.get()` et `marinara.context.subscribe(listener)`. L'instantané, immuable, a la forme suivante :

```ts
{
  chatId: string | null;
  characterId: string | null;
  characterIds: readonly string[];
  personaId: string | null;
  characters: readonly PersonalExtensionCharacterSnapshot[];
  persona: PersonalExtensionPersonaSnapshot | null;
}
```

Le client construit l'instantané à partir de `useChatStore` et l'envoie dès que le chat actif, sa liste de personnages ou le persona sélectionné change. Les identifiants sont des chaînes non vides, plafonnées à 256 caractères ; la liste des personnages est dédoublonnée et plafonnée à 256 entrées. L'iframe n'accepte une mise à jour du contexte que de sa page parente, et seulement si son champ `contentHash` correspond à la révision exacte de l'extension ; le Worker normalise et fige ensuite de nouveau la charge utile. Au démarrage, une extension attend le premier instantané de l'hôte, avec un repli sur un contexte nul au bout d'une seconde : un pont défaillant ne peut donc pas bloquer le Worker indéfiniment.

Le champ `characterId` est un raccourci pour les chats à un seul personnage et reste à `null` dans les chats de groupe ; `characterIds` contient tous les participants actifs. Le champ `personaId` n'est disponible qu'avec `read_active_persona`. Sans chat actif, `chatId`, `characterId`, `personaId` et `persona` valent `null`, tandis que `characterIds` et `characters` restent vides. Une extension peut sans risque utiliser ces identifiants comme clés dans son propre stockage privé.

La permission `read_active_characters` autorise `characters` à ne contenir que les champs suivants des fiches actives : `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` et `conversationDisplayName`. La permission `read_active_persona` autorise `persona` à ne contenir que `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` et `conversationDisplayName`. Le serveur déduit les deux ensembles du chat actif, applique des bornes par champ et des bornes globales, et n'accepte jamais un identifiant d'enregistrement fourni par le client comme preuve de portée.

Les capacités sont déclarées dans la charge utile de l'extension, conservées à chaque révision, affichées dans le panneau **Settings** (Paramètres) et dans la boîte de dialogue d'approbation, puis incluses dans l'empreinte du code exécutable. L'hôte envoie d'abord l'instantané réduit aux identifiants, puis l'enrichit via l'intermédiaire approuvé, propre à l'extension. De son côté, le Worker écarte les enregistrements non déclarés, rejette les fiches de personnage dont l'identifiant n'apparaît pas dans `characterIds`, applique de nouveau les bornes et fige le résultat.

La fonction `marinara.ui.showWindow({ title, elements, onEvent, onClose })` renvoie un handle doté de `update({ title?, elements? })` et de `close()`. Le worker se contente d'envoyer des descripteurs : c'est le code d'amorçage de confiance de l'iframe qui construit chaque élément avec les API du DOM et `textContent`, jamais avec `innerHTML`. L'hôte n'affiche l'iframe de bac à sable, cachée le reste du temps, que pendant qu'une fenêtre est ouverte, puis la masque de nouveau à la fermeture.

`marinara.ui.registerContribution({ id, kind, label, description?, icon?, surface?, position?, elements?, onActivate?, onEvent? })` renvoie un handle gelé avec `update(patch)` et `remove()`. Il accepte ces emplacements de confiance de l'hôte :

- `button` : une action compacte dans la barre supérieure par défaut, ou une action rendue par l'hôte sur la surface `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` ou `settings` ;
- `menu-item` : une action dans le menu **Extensions** ;
- `panel` : une entrée qui ouvre le panneau latéral **Extensions** de confiance de Marinara.

Les boutons de panneau latéral acceptent `position: "header"`, `"before-content"` ou `"after-content"`. Les boutons de la barre supérieure omettent `position`. Les icônes sont des noms kebab-case bornés du catalogue Lucide de Marinara ; les noms non reconnus utilisent l'icône de puzzle.

Les éléments de panneau utilisent le même vocabulaire déclaratif que les fenêtres restreintes : `heading`, `text`, `pre`, `button`, `input`, `select`, `toggle`, `slider`, `color` et `spacer`. Les contrôles interactifs doivent avoir des identifiants uniques. Un bouton de panneau envoie `{ contributionId, elementId, values }` à `onEvent` ; `values` contient la valeur textuelle courante de chaque contrôle. La fonction `onActivate` s'exécute dans le Worker de l'extension quand l'utilisateur ouvre ou déclenche la contribution. L'extension peut appeler `handle.update(...)` pour remplacer son libellé, sa description, son icône ou les éléments de son panneau après un changement d'état.

Le client valide chaque descripteur de son côté avant de l'ajouter au magasin d'exécution. Les types de contribution, surfaces, positions, contrôles, identifiants, listes d'options, syntaxe des noms d'icônes, longueurs de texte, texte total du panneau, nombre d'éléments et nombre de contributions par extension sont validés et plafonnés. React affiche le texte d'une extension comme du texte. Aucun HTML, CSS, URL, composant React ni callback d'hôte contrôlé par l'extension n'est accepté. L'hôte supprime toutes les contributions dès que le worker est arrêté, que son empreinte change ou qu'il disparaît de la réponse d'exécution approuvée. Les événements ne sont transmis qu'au worker enregistré pour le même identifiant d'extension et la même empreinte de contenu.

Aucun utilitaire DOM, aucun appel à l'API de Marinara, aucun accès aux événements de la page parente et aucune capacité réseau libre ne sont fournis. L'iframe valide les messages et en limite le débit. Un mécanisme de surveillance par signal de vie met fin à un worker qui ne répond plus ou qui tourne en boucle.

## Environnement d'exécution de compatibilité en page complète

Le protocole de contribution reste la voie à privilégier pour les outils riches en réglages et les flux de travail en plusieurs étapes. Une extension complexe peut remplacer au fur et à mesure les éléments de son panneau et conserver son propre état dans le stockage privé d'extension.

Les anciens paquets qui insèrent des boutons à l'aide de sélecteurs de l'hôte, parcourent les rouages internes de React, écrivent des surcouches arbitraires ou appellent des routes `/api` de même origine ne fonctionnent pas tels quels dans l'environnement d'exécution sécurisé. Mieux vaut les porter vers des descripteurs de contribution et des capacités d'intermédiation étroitement délimitées.

Quand la compatibilité exige vraiment la page hôte, une extension externe peut demander la permission `full_page_access`. Le fichier `PersonalExtensionInjector.tsx` charge alors cette révision approuvée exacte via un élément de script de même origine et une feuille de style facultative. Le code s'exécute dans une fonction asynchrone, avec un petit objet `marinara` de compatibilité pour l'identité, les logs, le stockage privé, les minuteurs gérés et l'enregistrement de routines de nettoyage. Les objets globaux de la page restent accessibles, puisque c'est précisément l'autorité demandée.

Le chargeur de page valide le champ `id`, le nom et l'empreinte de contenu par rapport aux métadonnées d'exécution avant d'appeler le code. Le serveur vérifie de son côté l'empreinte exacte, l'état activé, la source externe, la permission et la politique des deux verrous à chaque requête de script ou de feuille de style. Fermer un verrou désactive l'enregistrement : l'interrogation périodique de l'environnement d'exécution supprime alors les nœuds insérés et fait de son mieux pour nettoyer. Cela ne peut pas annuler les effets de bord déjà produits par du code de page en pleine confiance ; l'interface prévient donc qu'un rechargement peut être nécessaire.

Les imports hérités d'anciennes versions, portant `kind: "marinara.extension"` sans déclaration `capabilities` explicite, reçoivent la permission `full_page_access`. Les exports modernes écrivent toujours le champ des capacités, y compris sous forme de tableau vide : les paquets sûrs ne sont donc pas reclassés lors d'un réimport.

## Environnement d'exécution serveur

Le code serveur s'exécute dans un processus Node distinct, jamais par un import dans le processus courant. Le modèle de permissions de Node refuse l'accès au système de fichiers, au réseau, aux processus enfants, aux workers, aux modules natifs, à WASI et à l'inspecteur. Le processus enfant tourne en plus dans :

- le bac à sable Seatbelt de macOS ; ou
- Bubblewrap sous Linux, avec des espaces de noms PID, réseau, IPC et de montage séparés.

Le bac à sable reçoit un environnement minimal, un petit tas V8, aucun fichier de l'application, aucun secret du serveur et des fichiers de protocole ligne à ligne de taille bornée, placés dans son dossier temporaire privé. Il ne dispose que des logs, du stockage privé d'extension, de minuteurs gérés et de l'enregistrement de routines de nettoyage. Des quotas de messages et un fichier de signal de vie distinct limitent les inondations de protocole et les boucles infinies.

Les permissions de Node et `node:vm` sont des couches de défense en profondeur, pas la frontière de sécurité. Le bac à sable séparé fourni par le système est obligatoire. Windows, Android, Linux sans `bwrap` et toute autre plateforme non prise en charge refusent d'activer les extensions serveur.

## Validation

Lance :

```bash
pnpm check
pnpm regression:extensions-security
pnpm regression:professor-mari-shell-sandbox
pnpm smoke:ui
```

Le test de non-régression de sécurité doit démontrer : le verrouillage en deux étapes, l'invalidation sur empreinte exacte, la forme du worker à origine opaque, des instantanés de contexte bornés et liés à l'empreinte, la validation et le nettoyage des contributions à l'hôte, le routage de page complète réservé aux extensions externes et sa confirmation, la classification des anciens paquets, le dépouillement de l'environnement, le refus d'accès au système de fichiers et au réseau, le stockage privé et une disponibilité du bac à sable qui échoue en mode fermé.
