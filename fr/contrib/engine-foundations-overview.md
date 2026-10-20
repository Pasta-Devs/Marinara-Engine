# Fondations du moteur : vue d'ensemble de la série

Cette page décrit la contribution aux fondations du moteur (issue #6624). Initialement ouverte en une seule grande pull request, elle est maintenant divisée en huit PR, de A à H, pour permettre des revues indépendantes. Toutes s'appuient sur du code déjà fonctionnel dans Marinara Engine. Aucune API existante n'est renommée, le logger partagé n'est pas remplacé et les conventions des fichiers restent intactes. Les changements applicables à tous sont signalés ; le reste demeure désactivé tant que tu ne l'actives pas.

<a id="the-pull-requests"></a>

## Les pull requests

| PR | Contenu | Dépendance |
| --- | --- | --- |
| **A** | Fondations : régressions isolées, suivi des requêtes et chronologie de démarrage, deux options de lorebook, options de robustesse et diagnostic d'exécution, verrou inject au démarrage, interrupteurs de fonctionnalités, helpers de meilleur effort | Aucune (cette PR) |
| **B** | Dev MCP pour assistants de programmation (`tools/dev-mcp/`) | Aucune |
| **C** | Palette Ctrl+K et panneau "?" des raccourcis (client uniquement, sans interrupteur) | Aucune |
| **D** | Correctifs serveur revus, partie 1 : routes et middleware ; récupération du stockage, chat et génération, imports, sidecars et SSRF | A |
| **E** | Correctifs serveur revus, partie 2 : services et stockage | A |
| **F** | Cache des prompts : marqueur de cache d'abonnement Claude, mise à jour Agent SDK, structure favorable au cache, avertissement avant envoi peu mis en cache, diagnostic | A |
| **G** | Générations continuant après fermeture de l'onglet, vue des tâches et icône de console Windows dans la zone de notification | A (action de palette : C aussi) |
| **H** | Diagnostic et lanceur : intégrité de compilation, télémétrie mémoire, fichiers de débogage des prompts, plafond d'appels en arrière-plan, sauvegarde et ouverture quand prêt, nouvelle tentative liée au raisonnement désactivé | A |

A, B et C sont indépendantes et peuvent être revues dans n'importe quel ordre. D à H suivent A : registre d'interrupteurs (`isFeatureEnabled`, Settings > Advanced > Features), suivi des journaux et helpers de meilleur effort, ou extensions de la chronologie et du diagnostic. Chaque PR ajoute ses interrupteurs, entrées CHANGELOG et sa section ici.

Chaque partie de A décrit l'existant, les ajouts, les invariants, les vérifications et la désactivation ou l'annulation.

Par défaut, tout changement aux données enregistrées, prompts, nouvelles tentatives ou composants démarrés est désactivé, par variable d'environnement ou **Settings > Advanced > Features** (Paramètres > Avancé > Fonctionnalités, A6). Sans activation, le comportement reste identique. Les correctifs, l'exécuteur de tests et les helpers additifs n'ont pas d'interrupteur ; chaque section le précise.

Annulation : les commits de A sont ordonnés et certains fichiers sont partagés (`app.ts`, `index.ts`, `runtime-config.ts`, `capability-module-runtime.service.ts`, `CHANGELOG.md`). Annule-les du plus récent au plus ancien pour éviter les conflits.

La plupart des vérifications utilisent l'exécuteur de régressions. Compile d'abord une fois le paquet partagé (`pnpm build:shared`), puis lance les commandes depuis la racine du dépôt.

---

<a id="pr-a-foundations"></a>

# PR A : Fondations

> **Rebasée sur la mise à jour des modèles Decision.** Les appels Decision s'exécutent déjà dans la requête concernée et portent son `requestId`. Les sidecars Decision et utilitaire démarrent dans un contexte racine de journalisation : leurs lignes ultérieures ne gardent pas l'ID du premier appelant. Un emplacement Decision défaillant émet un avertissement limité en fréquence plutôt que plusieurs par tour. Les annulations utilisateur sont au niveau info, les énoncés abandonnés sont comptés en warn et leur texte reste en debug. L'arrêt nomme les deux étapes de fermeture des sidecars. Les appels Decision n'utilisent pas le wrapper de nouvelles tentatives du fournisseur : aucune double répétition.

<a id="a1-test-harness-each-regression-file-runs-in-its-own-data-folder"></a>

## A1. Banc de test : un dossier de données par fichier de régression

**Existant.** `scripts/run-regressions.mjs` découvre les régressions et les exécute une à une via `runRegression()`, avec gestion des délais et signaux (`terminateActiveChild`, `releaseActiveChild`, `FILE_TIMEOUT_MS`). Chaque enfant reçoit tout le `process.env` du développeur. Le serveur sait déjà rediriger `.env` via `MARINARA_ENV_FILE` (`getEnvFilePath()` dans `packages/server/src/config/runtime-config.ts`) ; `e2e/start-servers.mjs` isole déjà ses serveurs ainsi.

**Ajouts.** Le helper `regressionEnvironment(scratchDir)`. `runRegression()` crée un dossier temporaire par fichier (`marinara-regression-*` dans le dossier temporaire système) et y place `DATA_DIR`, `FILE_STORAGE_DIR` et `MARINARA_ENV_FILE` pour l'enfant. Suppression après réussite, échec, délai dépassé ou démarrage impossible. Une régression non isolée ne peut plus lire le `.env` du développeur ni heurter le bail d'écriture de ses vraies données.

**Ce qui reste identique.** Fonctions, options `--filter` et `--list`, délais, résumé, scripts `package.json` et CI. Les régressions définissant leurs propres variables conservent ces valeurs. Différence visible : les `DATA_DIR`, `FILE_STORAGE_DIR` ou `MARINARA_ENV_FILE` exportés dans le shell sont remplacés pour chaque fichier. C'est volontaire et limité aux tests.

**Vérification.**

```sh
node scripts/run-regressions.mjs --filter env-watcher
```

Il ne doit ensuite rester aucun dossier `marinara-regression-*` dans le dossier temporaire.

**Désactivation / annulation.** Aucun interrupteur ; isolation par défaut. Annuler le commit de l'exécuteur restaure l'ancien, après annulation des commits plus récents ; seuls `CHANGELOG.md` et `CONTRIBUTING.md` sont partagés. Une exception comme `MARINARA_REGRESSION_INHERIT_STORAGE=1` demanderait quelques lignes, mais aucune option non demandée n'a été ajoutée.

---

<a id="a2-logging-follow-one-request-one-boot-and-one-failure"></a>

## A2. Journaux : suivre une requête, un démarrage et un échec

**Existant.** `packages/server/src/lib/logger.ts` exporte le `logger` Pino partagé. `protectTerminalLogger` protège le serveur d'un terminal fermé ; `logDebugOverride` alimente le débogage de l'interface. Logging dans `CONTRIBUTING.md` impose le logger partagé, l'erreur en premier, les spécificateurs de format et quatre niveaux, tous respectés ici. Dans `app.ts`, `buildApp()` fournissait ses propres options à Fastify, créant un second Pino au même niveau. Les ID `req-1`, `req-2` recommençaient à chaque démarrage.

**Ajouts.** Détails dans `docs/development/logging.md`, désormais lié depuis Logging de `CONTRIBUTING.md`.

- Fastify utilise le logger partagé (`loggerInstance: logger`). `req.log` partage les sérialiseurs et suit les rechargements de `LOG_LEVEL` avec `followLogLevel`, désabonné à la fermeture. Cela correspond à `CONTRIBUTING.md`.
- Toute ligne provoquée par une requête porte `requestId`, même au fond des services (`lib/log-context.ts`, contexte `AsyncLocalStorage` et mixin Pino). UUID ou `x-request-id` client valide, l'ID est renvoyé dans l'en-tête `x-request-id` pour les signalements.
- Chaque ligne porte `bootId` pour distinguer les démarrages dans un même fichier.
- Chronologie `lib/startup-timeline.ts` : étapes de `app.ts` et `index.ts` dans `startup.phase("name", fn)`. Une ligne info `[startup] Ready in N ms` liste les étapes les plus lentes ; un démarrage raté nomme l'étape.
- Une ligne par échec : fournisseurs et outils relancent l'erreur sans la journaliser auparavant. Une génération échouée donne une seule ligne error. Arrêts utilisateur en info via `failureLevel(err)` ; chaîne `cause` conservée.
- Échecs répétés des contrôles de santé, sondages du planificateur et contributeurs de contexte : `logRateLimited` avec compteur `suppressedRepeats`.
- Sorties de modèles, requêtes de dés, corps de jetons Spotify et sondages vidéo passent en debug ; warn n'indique que leur longueur.
- Trois régressions : `logging-request-trail`, `logging-failure-lines`, `logging-startup-timeline`.

**Ce qui reste identique.** Export et fichier de `logger`, `protectTerminalLogger`, `logDebugOverride`, champs `pid`/`hostname` et appels `logger.*`/`req.log`. `LogController` de Fastify est étendu par sous-classe, pas remplacé. `LOG_LEVEL` (défaut `warn`) et `LOG_DISABLE_REQUEST_LOGGING` restent identiques. La console `pnpm dev` n'affiche pas de nouveaux champs : pino-pretty masque `bootId` comme `hostname`. `CONTRIBUTING.md` reçoit seulement des ajouts.

Changements détaillés dans `logging.md` :

- `requestId` remplace `reqId` de Fastify ; les filtres `reqId` enregistrés doivent être adaptés.
- Les lignes de requête entrante et de route introuvable suppriment la chaîne de requête, susceptible de contenir un jeton. Autres champs `req` conservés, `route` ajouté.
- Nouvelle ligne info `Client aborted request`, également désactivée par `LOG_DISABLE_REQUEST_LOGGING`.
- Une étape dont le temps propre `selfMs`, hors sous-étapes, dépasse 15 s passe en warn, visible par défaut. Les étapes s'imbriquent (`app.build` contient `buildApp`), mais le niveau suit leur temps propre : une étape lente, une ligne.

**Vérification.**

```sh
node scripts/run-regressions.mjs --filter logging-
```

Ou démarre le serveur, envoie une requête et cherche avec `grep` le `x-request-id` renvoyé.

**Désactivation / annulation.** `LOG_DISABLE_REQUEST_LOGGING=true` masque toujours les lignes de requêtes ; `LOG_LEVEL=warn` masque déjà les nouvelles lignes info. Pour tout retirer, annule le commit de journalisation après les commits de code ultérieurs.

---

<a id="a3-performance"></a>

## A3. Performances

Les deux options sont désactivées par défaut ; prompts et données restent alors identiques octet par octet. Documentation dans `.env.example` et la table Lorebooks de `docs/CONFIGURATION.md`.

<a id="a3a-stable-lorebook-group-winners-lorebook_stable_group_winners-switch-stablelorebookgrouppicks"></a>

### A3a. Gagnants stables des groupes de lorebook (`LOREBOOK_STABLE_GROUP_WINNERS`, interrupteur `stableLorebookGroupPicks`)

**Existant.** `applyGroupSelection()` dans `packages/server/src/services/lorebook/keyword-scanner.ts` choisit un gagnant pondéré par groupe d'inclusion (`pickWeightedGroupEntry`), en favorisant les entrées persistantes. Source aléatoire injectable (`random`, défaut `Math.random`), ce qui facilite le changement. Un nouveau tirage à chaque génération peut modifier le gagnant sans autre changement, donc le préfixe du prompt et le cache fournisseur.

**Ajouts.** `groupSeed` facultatif dans `applyGroupSelection` et `ScanOptions`. Activé, `processLorebooks` transmet l'ID du chat : mêmes candidats activés, même gagnant à chaque tour de ce chat. Les chats et ensembles différents restent variables. Le couple existant `stableHash` + `createSeededRandom`, déjà utilisé par Active Context (Contexte actif), est déplacé sans modification de `lorebooks.routes.ts` vers `lorebook/seeded-random.ts` pour partager le générateur. Depuis A6, **Stable lorebook picks** (Sélections stables du lorebook) ; la variable d'environnement reste prioritaire.

**Ce qui reste identique.** Noms et signatures avec paramètre facultatif, persistance et pondérations. L'aléatoire injecté contrôle toujours les seuils de probabilité ; activée, la graine décide néanmoins des gagnants. Active Context concorde ainsi avec la génération. Désactivée, aucune graine et ancien chemin de code.

**Vérification.** `node scripts/run-regressions.mjs --filter lorebook-group-seed` vérifie variable et interrupteur.

**Désactivation / annulation.** Laisse `LOREBOOK_STABLE_GROUP_WINNERS` non définie et l'interrupteur désactivé.

<a id="a3b-compact-stored-lorebook-scans-lorebook_compact_stored_scans"></a>

### A3b. Compacter les analyses de lorebook enregistrées (`LOREBOOK_COMPACT_STORED_SCANS`)

**Existant.** Chaque message généré stocke le texte complet des entrées activées dans `extra.lorebookScan`, sur sa ligne et dans chaque swipe. Active Context peut montrer le contexte exact, mais les longues conversations à gros lorebooks gonflent fortement les tables.

**Ajouts.** Activée, l'option conserve le texte complet dans la ligne et tous les swipes du dernier message d'assistant ou narrateur, lu par Active Context et les nouvelles tentatives d'agents. Revenir à un swipe montre son contexte original. Une analyse sur un tour utilisateur imité est compactée sans prendre cette place. Les anciens messages ne gardent que ID, noms, clés et scores. Le compactage ne se fait jamais sur le chemin d'enregistrement de génération : une tâche de fond traite le message précédent, une file de messages à la fois. Erreurs via `logRateLimited`, nouvel essai au prochain enregistrement. Si les messages récents sont supprimés, Active Context (`lorebooks.routes.ts`) et les nouvelles tentatives (`retry-agents-route.ts` via `storedContentForTextlessScanEntries`) reprennent le texte actuellement stocké de l'entrée. `scripts/compact-lorebook-scans.mjs` applique la règle aux anciens chats : simulation par défaut, refus si le serveur détient le bail d'écriture, sauvegarde des deux tables avant `--apply`.

**Ce qui reste identique.** Désactivée, aucune nouvelle écriture et structure identique. Format d'analyse et réponses des routes Active Context/nouvelle tentative conservés ; substitution uniquement sans texte. Deux correctifs par défaut concernent les anciennes analyses sans texte : Active Context affiche le texte stocké au lieu d'une chaîne vide ; les nouvelles tentatives incluent ces entrées au lieu de les ignorer.

**Vérification.** `node scripts/run-regressions.mjs --filter lorebook-scan-compaction` couvre la structure par défaut, les anciens swipes, les tours imités, le balayage des anciens messages au premier enregistrement, le repli via la vraie route Active Context et le script d'entretien.

**Désactivation / annulation.** Laisse `LOREBOOK_COMPACT_STORED_SCANS` non définie ou à `false`. Les messages déjà compactés le restent ; le plus récent garde son texte. Les sauvegardes de `--apply` permettent de restaurer l'ancienne structure.

---

<a id="a4-robustness"></a>

## A4. Robustesse

Tous ces changements utilisent des variables désactivées par défaut, documentées dans Robustesse de `docs/CONFIGURATION.md` et `.env.example`. Fichiers séparés, donc revue, extraction et annulation indépendantes. Nouveaux paramètres/champs facultatifs ; `isRateLimitError` et `base-provider.ts` ne changent pas dans ce commit.

<a id="a4a-storage-writes"></a>

### A4a. Écritures de stockage

**Existant.** `packages/server/src/db/file-backed-store.ts` vide les fragments modifiés et `manifest.json` via `serializeTableRows()` et `atomicWriteFile()`, avec `.bak` pour récupération. Le mécanisme solide d'écriture atomique et de sauvegarde reste intact.

**Ajouts.**

- `STORAGE_SKIP_UNCHANGED_WRITES` évite l'écriture si le contenu correspond à la dernière écriture durable du processus et si taille et mtime sont inchangés sur disque. Un fichier restauré depuis `.bak` est toujours réécrit.
- `STORAGE_YIELDING_SERIALIZE` sérialise les gros fragments par tranches de 12 ms en rendant la main à la boucle événementielle. Enregistrer un long chat ne bloque pas les autres requêtes ; résultat identique à `serializeTableRows` octet par octet.

**Ce qui reste identique.** Deux options désactivées : `serializeTableRows`, `beforeTableWrite`, `atomicWriteFile` comme avant. Toute écriture réelle passe par `atomicWriteFile`.

**Vérification.** `node scripts/run-regressions.mjs --filter robustness-storage-write`

**Désactivation / annulation.** Laisse les deux variables non définies.

<a id="a4b-windows-boot"></a>

### A4b. Démarrage Windows

**Existant.** Le bail identifie le démarrage système via `readBootId()` dans `file-backed-store.ts`, avec PowerShell à chaque lancement (environ 1,5 à 2 s sous Windows) et une requête d'identité `reg.exe`.

**Ajouts.**

- `STORAGE_CACHE_WINDOWS_BOOT_ID` conserve le résultat exact par démarrage système dans `DATA_DIR/.writer-boot-id.json` (`db/writer-boot-id-cache.ts`). Rien sous `LOCALAPPDATA`.
- Toujours actif : `reg.exe` et PowerShell reçoivent `windowsHide` ; un serveur lancé sans console ne fait plus clignoter de fenêtre. Aucun autre effet.

**Ce qui reste identique.** Logique du bail et sonde ; désactivée, sonde à chaque lancement.

**Vérification.** `node scripts/run-regressions.mjs --filter robustness-boot-performance`

**Désactivation / annulation.** Laisse la variable non définie ou supprime `.writer-boot-id.json`.

<a id="a4c-shutdown"></a>

### A4c. Arrêt

**Existant.** `packages/server/src/index.ts` traite SIGINT, SIGTERM et SIGHUP hors Windows avec `shutdown(signal)`, ignore les répétitions avec warn, arme `armShutdownDeadline` de 8 s et attend tous les runtimes avant `closeDB()`. Cet ordre reste.

**Ajouts.** `lib/shutdown-signals.ts` et `lib/shutdown-steps.ts`, utilisés par `index.ts` et `app.ts` :

- `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` : Ctrl+Break et fermeture de console effectuent le même arrêt propre, dans les quelque 5 s accordées par Windows.
- `SHUTDOWN_FORCE_EXIT_ON_REPEAT` : un second Ctrl+C plus de 1,5 s après le premier force la sortie.
- `SHUTDOWN_EARLY_FLUSH` : les enregistrements en attente commencent leur vidage dès le signal. Un échec n'est pas journalisé deux fois ici : le stockage l'a déjà fait et réessaie à sa fermeture.
- `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` (maximum 2500, défaut 0 = tout attendre) : après signal, `closeDB()` s'exécute à expiration du budget même si un runtime bloque. Ces deux dernières options ne concernent que les signaux ; redémarrage Advanced Settings dans `admin.routes.ts` inchangé.
- Toujours actif : les trois arrêts de runtime sont nommés ; échec ou lenteur supérieure à 1 s est journalisé avec l'étape.

**Ce qui reste identique.** Tout désactivé : mêmes signaux, répétitions ignorées, tous les arrêts avant `closeDB()`, délai de 8 s.

**Vérification.** `node scripts/run-regressions.mjs --filter robustness-shutdown-safety`

**Désactivation / annulation.** Laisse les variables non définies ; les deux premières exigent un redémarrage, indiqué par l'observateur d'environnement.

<a id="a4d-provider-retry-on-transient-network-errors-provider_retry_transient_errors-switch-providerretry"></a>

### A4d. Réessayer les erreurs réseau transitoires (`PROVIDER_RETRY_TRANSIENT_ERRORS`, interrupteur `providerRetry`)

**Existant.** `RateLimitAwareProvider` dans `packages/server/src/services/llm/rate-limit-aware-provider.ts` réessaie les limites de débit avec attente progressive jusqu'à `MAX_RATE_LIMIT_RETRIES` et respecte `Retry-After`. `connection-fallback-provider.ts` utilise une connexion de secours. Ces mécanismes fonctionnent ; refus de connexion ou 502 faisaient simplement échouer la génération.

**Ajouts.** Connexion refusée/inaccessible ou passerelle 502/503 : au plus deux essais, attente aléatoire de 0,5 à 2 s (`Retry-After` jusqu'à 5 s), uniquement avant tout texte ou raisonnement livré. Jamais de 504 ni de réinitialisation de socket. Pas sur la connexion principale avec secours utilisable (`transientRetry: false`), pour préserver sa rapidité. Une principale possédant déjà un wrapper, par exemple fourni à `llm.withFallback` par un paquet de capacités, est aussi exclue. Depuis A6, **Retry failed provider calls** (Réessayer les appels échoués) ; priorité à la variable d'environnement.

**Ce qui reste identique.** Limites de débit : mêmes délais, sans aléa, mêmes callbacks. `isRateLimitError` et `base-provider.ts` intacts.

**Vérification.** `node scripts/run-regressions.mjs --filter robustness-provider-resilience`

**Désactivation / annulation.** Variable non définie, interrupteur désactivé.

<a id="a4e-runtime-diagnostics"></a>

### A4e. Diagnostic d'exécution

**Existant.** `packages/server/src/routes/admin.routes.ts` expose des routes privilégiées comme `/request-timeouts`, sans vue commune en lecture seule du stockage et des runtimes de capacités.

**Ajouts.** `GET /api/admin/runtime-diagnostics` (`lib/runtime-diagnostics.ts`), protégé par `requirePrivilegedAccess`, `no-store` et 30 requêtes par minute. Compteurs de données résidentes, tables modifiées, dernière erreur de vidage, runtimes actifs et dernier échec d'activation. Hooks facultatifs : `getStorageStats()` sur le contrôleur, `getFileStoreStats()` dans `db/connection.ts`, `runtimeState()` sur `CapabilityModuleRuntime`.

**Ce qui reste identique.** Lecture seule ; aucune route, réponse ou règle d'accès existante ne change.

**Vérification.** `node scripts/run-regressions.mjs --filter robustness-runtime-diagnostics` ou ouvre `/api/admin/runtime-diagnostics` sur un serveur local avec accès privilégié.

**Désactivation / annulation.** Inerte sans appel. Pour supprimer : route dans `admin.routes.ts` et `lib/runtime-diagnostics.ts`.

<a id="two-catches-that-used-to-be-silent"></a>

### Deux captures auparavant silencieuses

Conformément à CONTRIBUTING, deux erreurs absorbées passent en warn : analyse d'en-tête de chat SillyTavern dans `import.routes.ts` (type d'erreur seulement, un message JSON pouvant citer le chat) et transport des questions d'activation d'agents (fréquence limitée).

---

<a id="a5-startup-internal-requests-wait-until-route-registration-has-ended"></a>

## A5. Démarrage : les requêtes internes attendent la fin de l'enregistrement des routes

Correctif toujours actif, pas une option.

**Existant.** `buildApp()` dans `packages/server/src/app.ts` enregistre les routes principales, attend `capabilityModuleRuntime.start(app)` qui active chaque paquet via `activateOne()` dans `services/capability-packages/capability-module-runtime.service.ts`, puis lance `startServerAutonomousScheduler(app)`. Appels internes `app.inject()` : paquets via `runCapabilityInternalRoute()` dans `capability-route-registration.service.ts`, planificateur autonome dans `server-autonomous-scheduler.service.ts` et `routes/generate/prompt-preview.ts`. Le premier `inject()` démarre Fastify ; aucun ajout de route, hook ou plugin n'est ensuite possible. Un minuteur/worker précoce appelant pendant `buildApp()` faisait échouer les paquets suivants avec "Root plugin has already booted", puis `addHook` arrêtait le serveur. Le `catch` de `activateOne()` journalise et lance `capabilityPackageManager.rollbackRuntime()` ou persiste statut et disponibilité `"error"`. Un paquet sain pouvait ainsi rester rétrogradé ou marqué `"error"` aux démarrages suivants.

**Ajouts.**

- `lib/fastify-inject-gate.ts` : `buildApp()` appelle `holdInjectUntilRegistered(app)` juste après création, puis libère avant `return app`. Les `app.inject()` antérieurs, promesses ou callbacks, attendent la fin et atteignent les routes ajoutées après l'appel. Si `inject()` retenu lève une erreur, le callback la reçoit.
- `activate()` et `selfCheck()` font partie de l'enregistrement ; attendre leurs propres routes bloquerait. `activateOne()` les exécute dans `failInjectFastDuring()` : `inject()` direct échoue immédiatement avec `InjectDuringRegistrationError` (`code` : `MARINARA_INJECT_DURING_REGISTRATION`). Seul ce paquet échoue, le démarrage continue. Les minuteurs déclenchés après retour de `activate()` attendent comme tout appel de fond.
- Les autres appels retenus avertissent avec pile de l'appelant après 60 s et sont rejetés après 10 minutes avec la même erreur. Le démarrage bloqué échoue explicitement. Ces minuteurs sans référence ne maintiennent pas le processus vivant.
- `isHostLifecycleActivationError()` dans `capability-module-runtime.service.ts` reconnaît `AVV_ERR_ROOT_PLG_BOOTED` ("Root plugin has already booted") et `FST_ERR_INSTANCE_ALREADY_LISTENING` ("Fastify instance is already listening"). Aucun retour arrière ni statut/disponibilité `"error"` persistant : version et statut conservés, activation normale au prochain démarrage. Une seule ligne warn, diagnostic toujours enregistré. Les autres échecs conservent error, retour arrière et `"error"`.
- Régression : `startup-inject-gate`.

**Ce qui reste identique.** Après retour de `buildApp()`, `app.inject()` redevient l'appel Fastify sans wrapper. Forme chaînée sans arguments jamais retenue. Ordre, routes, `runCapabilityInternalRoute()`, planificateur et activation/mise à jour après démarrage inchangés. Cas sur serveur actif : un paquet activé par l'interface ajoutant une nouvelle route reçoit encore `FST_ERR_INSTANCE_ALREADY_LISTENING`, mais sa nouvelle version reste installée pour le prochain démarrage au lieu d'être annulée. L'appelant reçoit toujours l'erreur.

**Vérification.**

```sh
node scripts/run-regressions.mjs --filter startup-inject-gate
```

Vérifie libération et route ultérieure, callbacks, échec immédiat dans `activate()`, minuteur issu de `activate()`, limite de 10 minutes avec valeurs courtes, placement/libération dans `buildApp()`, et retour avant annulation avec un seul avertissement pour une erreur de cycle de vie hôte.

**Désactivation / annulation.** Aucun interrupteur. `MARINARA_INJECT_DURING_REGISTRATION` est le code de `InjectDuringRegistrationError`, pas un paramètre. Annule le commit du verrou inject.

---

<a id="a6-feature-switches-settings--advanced--features"></a>

## A6. Interrupteurs : Settings > Advanced > Features

**Existant.** Options serveur via variables d'environnement (A3/A4), sans endroit commun dans l'interface ; chaque ajout demanderait paramètre, route et UI propres.

**Ajouts.** Un registre et une section, complétés ensuite par F, G et H. Détails dans `docs/configuration/features.md`.

- `packages/shared/src/schemas/feature-settings.schema.ts` : noms et valeurs par défaut, un objet JSON dans `features`, ne sauvegardant que les écarts aux valeurs par défaut.
- Deux interrupteurs : **Stable lorebook picks** (`stableLorebookGroupPicks`, A3a) et **Retry failed provider calls** (`providerRetry`, A4d).
- `isFeatureEnabled()` dans `services/features/feature-settings.ts` lit une copie mémoire, sans coût supplémentaire sur les chemins fréquents. Chargement à l'enregistrement des routes de paramètres ; actualisation à chaque écriture/suppression de ligne, après commandes de base de données Professor Mari concernées et rechargement `.env`. `GET` et `PUT /api/app-settings/features` ; validation stricte par `PUT`.
- Les variables définies imposent activation comme désactivation. `LOREBOOK_STABLE_GROUP_WINNERS` et `PROVIDER_RETRY_TRANSIENT_ERRORS` verrouillent les interrupteurs au lieu d'être lues séparément.
- Le client les liste dans Settings > Advanced > Features ; les interrupteurs imposés sont verrouillés avec le nom de variable. Autres composants : `useFeatureEnabled()`.

**Ce qui reste identique.** Tous désactivés par défaut ; sans ouvrir la section, comportement identique. Les anciennes variables gardent leur effet.

**Vérification.** `node scripts/run-regressions.mjs --filter feature-settings` vérifie registre, défauts, normalisation, priorité, routes, stockage, invalidation type Mari et écouteurs. Dans l'app : Settings > Advanced > Features ou recherche `features`.

**Désactivation / annulation.** Laisse les deux désactivés ou retire les variables. Annuler le commit supprime le mécanisme ; les variables fonctionnent ensuite seules comme avant.

---

<a id="a7-logged-best-effort-helpers"></a>

## A7. Helpers de meilleur effort journalisés

Ajout sans interrupteur ni changement de comportement à lui seul.

**Existant.** Certaines erreurs sont volontairement ignorées par `catch` vide : nettoyage, curseur, écriture de cache. Comportement correct, mais sans trace.

**Ajouts.** `packages/server/src/lib/best-effort.ts` avec `logSuppressed`, `orFallback`, `bestEffort`. Les erreurs absorbées passent par `logRateLimited` (A2), au plus une ligne par minute pour chaque événement, chat et étape. Les correctifs D/E l'utilisent pour remplacer leurs captures vides.

**Ce qui reste identique.** Aucun appel dans cette PR, donc aucun chemin existant modifié.

**Vérification.** `node scripts/run-regressions.mjs --filter best-effort`.

**Désactivation / annulation.** Aucun interrupteur ; annuler le commit supprime le fichier.

---

<a id="coming-in-later-pull-requests"></a>

# Pull requests suivantes

Sections volontairement brèves. Chaque PR complète sa section avec les mêmes cinq parties à son ouverture.

État : la PR A a été fusionnée sous le numéro #6647 et la PR B sous le numéro #6648. La PR C (#6649) a été fermée sans fusion, et les PR D à H n'ont pas été ouvertes comme pull requests séparées. Les sections C à H ci-dessous décrivent le plan tel qu'il a été écrit ; ne les lis pas comme des fonctionnalités livrées sous cette forme.

<a id="pr-b-dev-mcp-for-coding-assistants"></a>

## PR B : Dev MCP pour assistants de programmation

Serveur local facultatif dans `tools/dev-mcp`, hors workspace pnpm et image Docker. Utilise le suivi A2. Configuration et vérifications dans `tools/dev-mcp/README.md`, ajouté par B.

<a id="pr-c-command-palette-and-keyboard-shortcuts-overlay"></a>

## PR C : Palette et panneau des raccourcis

Dans C : palette Ctrl+K et panneau "?" des raccourcis. Client seulement, sans interrupteur ni changement des touches existantes.

<a id="pr-d-reviewed-server-fixes-part-1"></a>

## PR D : Correctifs serveur revus, partie 1

Dans D : routes, middleware, récupération, chat/génération, imports, sidecars et SSRF, chacun avec régression. Correctifs sans interrupteur.

<a id="pr-e-reviewed-server-fixes-part-2"></a>

## PR E : Correctifs serveur revus, partie 2

Dans E : services et stockage, chaque correctif avec régression et sans interrupteur.

<a id="pr-f-prompt-caching"></a>

## PR F : Cache des prompts

Dans F : marqueur d'historique Claude par abonnement, mise à jour Claude Agent SDK, structure favorable au cache (interrupteur désactivé), avertissement par chat avant envoi peu mis en cache (désactivé), diagnostic facultatif.

<a id="pr-g-generation-jobs-and-console-tray"></a>

## PR G : Tâches de génération et icône de console

Dans G : images, sprites et vidéos continuant après fermeture de l'onglet, avec vue des tâches (interrupteur désactivé) et icône de console Windows (interrupteur désactivé).

<a id="pr-h-engine-diagnostics-and-launcher"></a>

## PR H : Diagnostic et lanceur

Dans H : intégrité au démarrage, télémétrie mémoire, fichiers de débogage facultatifs, plafond d'appels de fond (interrupteur désactivé), sécurité du lanceur et nouvel essai sans désactivation du raisonnement pour les modèles raisonnant toujours.

---

<a id="test-results-for-pr-a-on-the-development-machine"></a>

## Résultats de PR A sur la machine de développement

Vérifié sur `staging`, commit `dd876831a`. Aucun appel de modèle payant.

- **Régressions Node Linux**, comme CI `complete-node-regressions` (Ubuntu 24.04 sous WSL, Node 24, `pnpm install --frozen-lockfile`, `pnpm regression`) : 384 fichiers réussis. Sous charge, `server-signal-shutdown` atteint parfois 30 s, également sur `staging` inchangé. `smart-group-decision`, `agent-activation-questions`, `advanced-memory-core`, sensibles au temps, ont chacun échoué une fois puis réussi chaque relance.
- **Régressions Node Windows** : 379 sur 384. `decision-sidecar-runtime`, `gallery-previews`, `request-timeouts`, `server-signal-shutdown` et `storage-writer-lock` échouent aussi sur `staging` inchangé de cette machine : verrouillage de fichiers, signaux de console et contrôle d'espace disque locaux.
- **Types, lint, format et compilations** : `tsc --noEmit` pour shared, server, client, projet racine et estimation de jetons ; lint sans erreur ; Prettier sur `packages/**/*.{ts,tsx}` ; contrôles de locales et JSX statique ; compilations client/serveur.
- **Tests navigateur** des paramètres (`core-flows`, `issue-sweep-settings`, `ux-feedback-sweep`, `afternoon-sweep`, `client-runtime-diagnostics`) sur `mobile-chromium` : 171 réussites, 0 échec. Les échecs subsistant après relance sur `mobile-webkit` (WebKit Windows) existent aussi sur `staging` inchangé.
- **Section Features** vérifiée visuellement avec thèmes par défaut et SillyTavern, clair/sombre, tailles bureau et téléphone.
