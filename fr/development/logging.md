# Journalisation du serveur

Cette page explique comment lire les logs du serveur Marinara Engine et écrire des lignes utiles. Elle complète la [section Logging de CONTRIBUTING.md](../../CONTRIBUTING.md#logging), sans la remplacer. Le logger Pino partagé, l'objet erreur en premier argument, les spécificateurs de format et la table des quatre niveaux restent applicables.

<a id="what-every-line-carries"></a>

## Contenu de chaque ligne

Toutes les lignes serveur viennent d'une instance Pino : `logger` dans `packages/server/src/lib/logger.ts`. Fastify utilise cette instance via `loggerInstance` ; `req.log`, `reply.log` et `app.log` en sont donc des enfants. Ils partagent les sérialiseurs et suivent les rechargements à chaud de `LOG_LEVEL` par l'observateur d'environnement.

| Champ | Présence | Sens |
| --- | --- | --- |
| `pid` | chaque ligne | Identifiant du processus (défaut Pino). |
| `hostname` | chaque ligne | Nom d'hôte (défaut Pino). |
| `bootId` | chaque ligne | 8 caractères hexadécimaux renouvelés à chaque démarrage. Distingue deux exécutions dans un même fichier. |
| `requestId` | chaque ligne causée par une requête | Même valeur que l'en-tête de réponse `x-request-id`. Présent sur `req.log` et sur le `logger` partagé dans les services. |
| `route` | après analyse du corps | Motif de route reconnu, par exemple `/api/chats/:id`. Jamais l'URL brute. |

<a id="request-ids"></a>

### Identifiants de requête

`lib/request-logging.ts` attribue un identifiant à chaque requête :

- Le client peut envoyer `x-request-id`. Le serveur le conserve s'il contient 8 à 80 caractères de `A-Z a-z 0-9 . _ : -`. Sinon, il le remplace.
- À défaut, le serveur crée un UUID. Le compteur Fastify `req-1` repartait à chaque démarrage et répétait donc les identifiants.
- L'identifiant revient dans l'en-tête `x-request-id`, exposé par CORS. Un rapport de bug peut le citer ; `grep <id>` retrouve alors toutes les lignes de la requête.

L'identifiant est stocké dans un contexte `AsyncLocalStorage` (`lib/log-context.ts`). Un mixin Pino le copie sur chaque ligne. Inutile de le transmettre : `logger.warn(err, "...")` au fond d'un service le récupère seul. Le contexte est rétabli après analyse du corps, car celle-ci utilise le contexte asynchrone propre de l'analyseur HTTP.

Le contexte suit tout ce qui démarre dans la requête, y compris minuteurs, écouteurs et processus enfants. Pour un travail qui survit à la requête, enveloppe son démarrage dans `runWithRootLogContext({}, fn)`, afin que ses futures lignes ne gardent pas l'identifiant initial. Le processus auxiliaire local le fait pour llama-server et MLX ; les auxiliaires Decision et Utility démarrent de même, pour qu'un processus partagé par de futures requêtes ne porte pas l'identifiant du premier appelant. Tout autre travail durable lancé depuis un gestionnaire de route garde son `requestId` jusqu'à l'application du même enveloppement.

<a id="request-lines"></a>

### Lignes de requête

`RequestLogController` reprend le `LogController` par défaut de Fastify avec ces changements :

- Le champ s'appelle `requestId`, au lieu de `reqId`. Les recherches enregistrées ou filtres sur `reqId` doivent changer de nom.
- Les lignes `incoming request` et `Route ... not found` omettent la chaîne de requête, qui peut contenir un jeton ou du texte recherché. La ligne entrante conserve les autres champs `req` (`method`, `version`, `host`, `remoteAddress`, `remotePort`) et ajoute `route`.
- Quand le client ferme prématurément, une ligne `Client aborted request` est écrite à info. Fastify ne journalisait rien ici.

`LOG_DISABLE_REQUEST_LOGGING` fonctionne comme avant et désactive aussi la ligne d'abandon.

Dans `pnpm dev`, pino-pretty masque `hostname` (son défaut) et `bootId`. La sortie JSON de production garde les deux.

<a id="startup-timeline"></a>

## Chronologie du démarrage

`lib/startup-timeline.ts` chronomètre chaque étape :

```ts
const db = await startup.phase("storage.open", () => getDB());
```

- Chaque ligne porte `event: "startup.phase"`, `stage`, `elapsedMs` (temps écoulé) et `selfMs` (temps propre, hors phases imbriquées). Le niveau suit `selfMs` : debug sous 1 s, info au-delà de 1 s, warn au-delà de 15 s. Avec le défaut `LOG_LEVEL=warn`, un démarrage normal, même un premier lancement lent, n'affiche aucune ligne de phase.
- Les phases s'imbriquent. `app.build` dans `index.ts` englobe toutes celles de `buildApp`. Grâce à `selfMs`, une étape interne lente se signale une seule fois ; `app.build` reste à debug sauf si son travail propre hors des phases internes est lent.
- Une étape échouée n'est pas journalisée dans la phase. L'erreur remonte intacte, puis `main().catch` dans `index.ts` écrit une ligne `startup.failed` nommant l'étape (`startup.stageOf(err)`).
- Dès que le serveur écoute, `index.ts` écrit une ligne info `[startup] Ready in N ms` avec `event: "startup.ready"`, le nombre de phases et les cinq étapes ayant les plus grands `selfMs`.

Les phases n'ajoutent pas `stage` au contexte de log. Les services lancés pendant une phase gardent des minuteurs, qui porteraient sinon cette étape pendant toute la vie du processus.

<a id="one-line-per-failure"></a>

## Une ligne par échec

Un échec doit produire exactement une ligne, écrite par le code qui décide de la suite.

- **Journaliser ou relancer, pas les deux.** En cas de relance, laisse l'appelant journaliser. Les précisions utiles vont à debug, comme le nom d'outil dans `[agent-tools] ... failed`.
- **Emplacement de cette ligne :**
  - erreurs 500 inconnues : `middleware/error-handler.ts`
  - échecs d'agents : `executeAgent` (warn, échec non critique)
  - génération de chat échouée : catch principal de `generate.routes.ts`
  - Le fournisseur correspondant lève sans journaliser. Au plus, il ajoute une ligne debug nommant le modèle avec l'erreur brute, comme Grok CLI et Claude (Subscription). Claude (Subscription) lève un message lisible contenant déjà l'erreur SDK ; il ne joint donc pas aussi cette erreur comme `cause`. L'erreur SSE du chat et le texte d'erreur d'agent ajoutent le message de la cause, ce qui dupliquerait le texte.
- **Les annulations sont info.** Arrêt utilisateur, onglet fermé ou signal annulé sont attendus. Utilise `failureLevel(err)` ou `failureLevel(err, "warn")` de `lib/log-context.ts`. Il renvoie `"info"` quand `isCancellation(err)` est vrai. Un `TimeoutError` est un véritable échec, pas une annulation.

  ```ts
  logger[failureLevel(err)](err, "[agent-batch] Batch call FAILED: %s", errMsg);
  ```

- **Garder la cause.** Enveloppe avec `new Error("Could not save chat", { cause: err })`. Les sérialiseurs `err` et `error` ajoutent message et pile de la cause (`caused by: ...`). Un Error journalisé comme `{ error }` est aussi sérialisé, plus affiché comme `{}`.

<a id="repeating-failures"></a>

## Échecs répétés

Interrogations périodiques, contrôles de santé et hooks de tour peuvent échouer pareil toutes les quelques secondes. Utilise `logRateLimited` de `lib/log-rate-limit.ts` :

```ts
logRateLimited("warn", "autonomous-scheduler:poll", err, "[autonomous-scheduler] Poll failed");
```

La première occurrence d'une clé est écrite. Les suivantes dans la fenêtre (60 s par défaut) sont comptées, et la prochaine ligne porte `suppressedRepeats`. Mets dans la clé l'élément qui échoue, par exemple l'identifiant du package ou du chat, pour qu'un élément défaillant n'en masque pas un autre.

<a id="prompt-and-model-text"></a>

## Texte des prompts et modèles

Prompts, sorties de modèle, corps de réponse fournisseur et d'interrogation vont à **debug**, jamais dans warn ou error. Ils peuvent contenir l'histoire de l'utilisateur, et les corps fournisseur répéter identifiants ou prompt. À warn, consigne taille (`rawLength`, `bodyLength`) et raison. Un message d'erreur JSON peut citer le texte en cause : pour l'analyse, ne journalise que le type d'erreur à warn. Place erreur et texte sur une ligne debug séparée :

```ts
logger.warn(
  { errorType: err instanceof Error ? err.name : typeof err, rawLength: raw.length },
  "[game/scene-wrap] Failed to parse LLM response as JSON",
);
logger.debug({ err }, "[game/scene-wrap] Unparsed LLM response: %s", raw.slice(0, 200));
```

Le réglage de débogage de l'interface fonctionne toujours via `logDebugOverride`. C'est le moyen prévu pour voir les prompts quand `LOG_LEVEL` masque debug.

Par défaut, les médias intégrés apparaissent sous forme abrégée dans le journal. `debugJson` remplace chaque bloc de données en base64 par un marqueur tel que `[image/png base64, ~1.2 MB: iVBORw0KGgoAAAA...ElFTkSuQmCC]`, avec le type, la taille et les 16 premiers et derniers caractères. Cela couvre les URL `data:` seules ou intégrées à du texte, ainsi que les champs `data` seuls des éléments multimédias d'Anthropic et de Google. La règle s'applique même si le base64 s'étend sur plusieurs lignes. Le sérialiseur `msg` fait de même pour les URL `data:` dans les lignes simples `%s` et `%j`. Seul `debugJson` raccourcit les champs `data` seuls. Seule la copie affichée change. La valeur transmise reste intacte. `LOG_INLINE_MEDIA=full` dans `.env` affiche de nouveau les données en entier. Le test de régression `log-inline-media` couvre ce comportement.

<a id="checks"></a>

## Console dans l'application

**Settings → Advanced → Open Console** (Paramètres → Avancé → Ouvrir la console) affiche les lignes récentes du serveur dans l'application, pour les installations dont le terminal est inaccessible (NAS, VPS, Docker ou Termux).

- `lib/log-buffer.ts` conserve les 1 500 dernières lignes en mémoire, dans la limite d'environ 4 millions de caractères, avec un maximum de 16 000 caractères par message et par bloc de champs. Rien n'est écrit sur disque et un redémarrage vide le tampon.
- `logger.ts` y copie chaque ligne sérialisée via `hooks.streamWrite` de Pino. Le tampon contient donc ce que le terminal ou le fichier journal a reçu, au même `LOG_LEVEL`. Les lignes qui ne passent pas par Pino, comme `injected env` de dotenv ou la sortie brute d'un processus enfant, n'y figurent pas.
- `GET /api/admin/logs?afterId=` renvoie les lignes après `afterId`, avec `latestId`, `truncated` (des lignes ont été supprimées avant cette lecture) et le `logLevel` du serveur. La route est protégée par `requirePrivilegedAccess` et utilise `no-store`. Elle utilise `logLevel: "silent"` pour que les interrogations de la console elle-même ne figurent jamais dans le tampon.
- Les règles de cette page s'appliquent aussi ici. Tout ce que tu journalises au niveau warn ou error est lisible à distance par un administrateur dans l'application. Garde donc les prompts et les corps des requêtes et des réponses des fournisseurs au niveau debug.

## Vérifications

Les régressions `logging-request-trail`, `logging-failure-lines` et `logging-startup-timeline` couvrent cette page, et `server-console-logs` couvre la console dans l'application :

```sh
node scripts/run-regressions.mjs --filter logging-
```
