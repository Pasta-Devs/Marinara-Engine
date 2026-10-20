# Fundamentos del Engine: visión general de la serie

Esta página describe la contribución a los fundamentos del Engine (issue #6624). Se abrió como un gran pull request y ahora está dividida en ocho PR, A a H, para revisarlos por separado. Todos parten de código que ya funciona bien en Marinara Engine. No se renombran API existentes, no se sustituye el logger compartido ni se cambian las convenciones de los archivos. Los cambios que afectan a todos se indican expresamente; el resto permanece desactivado hasta que lo actives.

<a id="the-pull-requests"></a>

## Los pull requests

| PR | Contenido | Depende de |
| --- | --- | --- |
| **A** | Fundamentos: regresiones aisladas, seguimiento de solicitudes y cronología de arranque, dos opciones de lorebook, opciones de robustez y diagnóstico de ejecución, bloqueo de inject durante el arranque, interruptores de funciones y helpers de mejor esfuerzo | Nada (este PR) |
| **B** | Dev MCP para asistentes de programación (`tools/dev-mcp/`) | Nada |
| **C** | Paleta Ctrl+K y panel "?" de atajos (solo cliente, sin interruptor) | Nada |
| **D** | Correcciones revisadas del servidor, parte 1: rutas y middleware; recuperación de almacenamiento, rutas de chat y generación, importadores, sidecars y SSRF | A |
| **E** | Correcciones revisadas del servidor, parte 2: servicios y almacenamiento | A |
| **F** | Caché de prompts: marcador de caché de suscripción Claude, actualización del Agent SDK, estructura favorable a la caché, aviso antes de envíos con poca caché y diagnóstico | A |
| **G** | Trabajos de generación que continúan al cerrar la pestaña, visor de trabajos y bandeja de la consola de Windows | A (la acción de la paleta también necesita C) |
| **H** | Diagnóstico y lanzador: integridad de compilación, telemetría de memoria, archivos de depuración de prompts, límite de llamadas en segundo plano, copia de seguridad y apertura cuando esté listo, reintento ante razonamiento desactivado | A |

A, B y C son independientes y pueden revisarse en cualquier orden. D a H siguen a A: usan su registro de interruptores (`isFeatureEnabled`, Settings > Advanced > Features), su seguimiento de registros y helpers de mejor esfuerzo, o amplían la cronología y la ruta de diagnóstico. Cada PR añade sus interruptores, entradas de CHANGELOG y sección aquí.

Cada parte de A explica qué existe, qué se añade, qué no cambia, cómo comprobarlo y cómo desactivarlo o revertirlo.

Valores predeterminados: todo lo que cambia datos guardados, prompts, reintentos o componentes iniciados por el servidor está desactivado, mediante una variable de entorno o **Settings > Advanced > Features** (Ajustes > Avanzado > Funciones, A6). Sin activar nada, se conserva el comportamiento anterior. Las correcciones, el ejecutor de pruebas y los helpers adicionales no tienen interruptor; se indica en cada caso.

Reversión: los commits de A tienen un orden; los posteriores comparten algunos archivos (`app.ts`, `index.ts`, `runtime-config.ts`, `capability-module-runtime.service.ts`, `CHANGELOG.md`). Reviértelos desde el más reciente para evitar conflictos.

La mayoría de comprobaciones usan el ejecutor de regresiones existente. Compila primero el paquete compartido una vez (`pnpm build:shared`) y ejecuta los comandos desde la raíz del repositorio.

---

<a id="pr-a-foundations"></a>

# PR A: Fundamentos

> **Rebasado sobre la actualización de modelos Decision.** Las llamadas Decision ya se ejecutan dentro de la solicitud que las necesita y llevan su `requestId`. Los sidecars de decisión y utilidad arrancan en un contexto raíz de registro; sus líneas posteriores no conservan el ID de la primera solicitud. Un slot de decisión que falla genera un aviso limitado en frecuencia, no varios por turno. Las cancelaciones se registran en info; las afirmaciones descartadas se cuentan en warn y su texto solo aparece en debug. Al apagar, ambos sidecars se detienen como pasos identificados. Las llamadas Decision no pasan por el wrapper de reintentos del proveedor, por lo que no se reintentan dos veces.

<a id="a1-test-harness-each-regression-file-runs-in-its-own-data-folder"></a>

## A1. Entorno de pruebas: una carpeta de datos por archivo de regresión

**Qué existe.** `scripts/run-regressions.mjs` descubre las regresiones y las ejecuta individualmente mediante `runRegression()`, con gestión de tiempos de espera y señales (`terminateActiveChild`, `releaseActiveChild`, `FILE_TIMEOUT_MS`). Cada proceso hijo recibe todo el `process.env` del desarrollador. El servidor ya permite redirigir `.env` con `MARINARA_ENV_FILE` (`getEnvFilePath()` en `packages/server/src/config/runtime-config.ts`); `e2e/start-servers.mjs` ya aísla así sus servidores.

**Qué se añade.** El helper `regressionEnvironment(scratchDir)`. `runRegression()` crea por archivo una carpeta temporal (`marinara-regression-*` en la carpeta temporal del sistema) y sitúa allí `DATA_DIR`, `FILE_STORAGE_DIR` y `MARINARA_ENV_FILE` del hijo. Se elimina al terminar, tanto con éxito como con error, tiempo agotado o fallo de inicio. Una regresión sin aislamiento propio ya no puede leer el `.env` del desarrollador ni interferir con el bloqueo de escritura de sus datos reales.

**Qué no cambia.** Funciones, opciones `--filter` y `--list`, tiempos de espera, resumen, scripts de `package.json` y CI. Las regresiones que fijan esas variables mantienen sus valores. Diferencia visible: el ejecutor sustituye por archivo los `DATA_DIR`, `FILE_STORAGE_DIR` o `MARINARA_ENV_FILE` exportados en la shell. Es intencionado y solo afecta a pruebas.

**Cómo comprobarlo.**

```sh
node scripts/run-regressions.mjs --filter env-watcher
```

Después no debe quedar ninguna carpeta `marinara-regression-*` en la carpeta temporal.

**Cómo desactivarlo o revertirlo.** No hay interruptor: el aislamiento es lo predeterminado. Revertir el commit del ejecutor restaura el anterior; revierte primero los posteriores, que solo comparten `CHANGELOG.md` y `CONTRIBUTING.md`. Una exclusión como `MARINARA_REGRESSION_INHERIT_STORAGE=1` requeriría pocas líneas, pero no se añadió una opción que nadie había pedido.

---

<a id="a2-logging-follow-one-request-one-boot-and-one-failure"></a>

## A2. Registros: seguir una solicitud, un arranque y un fallo

**Qué existe.** `packages/server/src/lib/logger.ts` exporta un único `logger` Pino compartido. `protectTerminalLogger` evita que cerrar el terminal bloquee el servidor, y `logDebugOverride` alimenta el interruptor de depuración de la interfaz. Logging en `CONTRIBUTING.md` exige logger compartido, objeto de error primero, especificadores de formato y cuatro niveles; aquí se respetan. En `app.ts`, `buildApp()` daba a Fastify opciones propias, creando un segundo Pino con el mismo nivel. Los ID `req-1`, `req-2` de Fastify se reiniciaban en cada arranque.

**Qué se añade.** Detalles en `docs/development/logging.md`, ahora enlazado desde Logging en `CONTRIBUTING.md`.

- Fastify usa el logger compartido (`loggerInstance: logger`). `req.log` comparte serializadores y sigue las recargas de `LOG_LEVEL` mediante `followLogLevel`, cuya suscripción se cancela al cerrar. Ya era lo descrito en `CONTRIBUTING.md`.
- Toda línea provocada por una solicitud lleva `requestId`, también en servicios internos (`lib/log-context.ts`, contexto `AsyncLocalStorage` y mixin de Pino). Es un UUID o un `x-request-id` válido del cliente, devuelto en la cabecera `x-request-id` para incluirlo en informes.
- Cada línea lleva `bootId` para distinguir arranques dentro de un archivo.
- Cronología (`lib/startup-timeline.ts`): los pasos de `app.ts` e `index.ts` se envuelven en `startup.phase("name", fn)`. Una línea info `[startup] Ready in N ms` enumera los más lentos; si falla el arranque, identifica el paso.
- Una línea por fallo: proveedores y herramientas relanzan sin registrar previamente. Una generación fallida produce una sola línea error. Las paradas del usuario usan info mediante `failureLevel(err)`; se conserva la cadena `cause`.
- Fallos repetidos de salud, sondeos del programador y contribuidores al contexto usan `logRateLimited` y el contador `suppressedRepeats`.
- Salidas de modelos, solicitudes de dados, cuerpos de tokens de Spotify y sondeos de vídeo pasan a debug; warn solo indica su longitud.
- Tres regresiones: `logging-request-trail`, `logging-failure-lines`, `logging-startup-timeline`.

**Qué no cambia.** Exportación y archivo de `logger`, `protectTerminalLogger`, `logDebugOverride`, campos `pid` y `hostname`, llamadas `logger.*` y `req.log`. `LogController` de Fastify se amplía por herencia, no se sustituye. `LOG_LEVEL` (predeterminado `warn`) y `LOG_DISABLE_REQUEST_LOGGING` funcionan igual. La consola `pnpm dev` no muestra nuevos campos: pino-pretty oculta `bootId` junto a `hostname`. `CONTRIBUTING.md` solo recibe añadidos.

Cambios descritos en `logging.md`:

- `requestId` sustituye a `reqId` de Fastify; actualiza los filtros guardados para `reqId`.
- Las líneas de entrada y ruta no encontrada omiten la cadena de consulta, que podría contener un token. Se conservan otros campos `req` y se añade `route`.
- Nueva línea info `Client aborted request`, también desactivable con `LOG_DISABLE_REQUEST_LOGGING`.
- Un paso con tiempo propio `selfMs`, sin pasos anidados, superior a 15 s se registra en warn y se ve con el nivel predeterminado. Hay anidamiento (`app.build` engloba `buildApp`), pero el nivel depende del tiempo propio: un paso lento, una línea.

**Cómo comprobarlo.**

```sh
node scripts/run-regressions.mjs --filter logging-
```

O inicia el servidor, envía una solicitud y busca con `grep` el `x-request-id` devuelto.

**Cómo desactivarlo o revertirlo.** `LOG_DISABLE_REQUEST_LOGGING=true` silencia las líneas de solicitudes como antes; `LOG_LEVEL=warn` ya oculta las nuevas líneas info. Para quitarlo todo, revierte el commit de registros después de los commits de código posteriores.

---

<a id="a3-performance"></a>

## A3. Rendimiento

Ambas opciones están desactivadas de forma predeterminada; así, prompts y datos guardados permanecen idénticos byte a byte. Están documentadas en `.env.example` y la tabla Lorebooks de `docs/CONFIGURATION.md`.

<a id="a3a-stable-lorebook-group-winners-lorebook_stable_group_winners-switch-stablelorebookgrouppicks"></a>

### A3a. Ganadores estables en grupos de lorebook (`LOREBOOK_STABLE_GROUP_WINNERS`, interruptor `stableLorebookGroupPicks`)

**Qué existe.** `applyGroupSelection()` en `packages/server/src/services/lorebook/keyword-scanner.ts` elige un ganador ponderado por grupo de inclusión (`pickWeightedGroupEntry`), favoreciendo entradas persistentes. La fuente aleatoria es inyectable (`random`, predeterminada `Math.random`), facilitando el cambio. Tirar de nuevo en cada generación puede cambiar el ganador sin otros cambios, alterar el prefijo del prompt y romper la caché del proveedor.

**Qué se añade.** `groupSeed` opcional en `applyGroupSelection` y `ScanOptions`. Al activarlo, `processLorebooks` pasa el ID del chat: los mismos candidatos activados dan el mismo ganador en cada turno de ese chat. Otros chats y conjuntos pueden variar. El par existente `stableHash` + `createSeededRandom`, ya usado por Active Context (Contexto activo), se mueve sin cambios de `lorebooks.routes.ts` a `lorebook/seeded-random.ts` para compartir generador. Desde A6 también existe **Stable lorebook picks** (Selección estable del lorebook); la variable de entorno sigue teniendo prioridad.

**Qué no cambia.** Nombres y firmas con parámetro opcional, persistencia y pesos. La fuente inyectada sigue controlando las condiciones probabilísticas; con la opción activa, la semilla decide igualmente los ganadores, de modo que Active Context coincide con la generación. Desactivada, no se pasa semilla y se usa la ruta anterior.

**Cómo comprobarlo.** `node scripts/run-regressions.mjs --filter lorebook-group-seed` comprueba variable e interruptor.

**Cómo desactivarlo o revertirlo.** Deja `LOREBOOK_STABLE_GROUP_WINNERS` sin definir y el interruptor desactivado.

<a id="a3b-compact-stored-lorebook-scans-lorebook_compact_stored_scans"></a>

### A3b. Compactar análisis de lorebook guardados (`LOREBOOK_COMPACT_STORED_SCANS`)

**Qué existe.** Cada mensaje generado guarda el texto completo de las entradas activadas en `extra.lorebookScan`, en la fila del mensaje y en cada swipe. Permite ver el contexto exacto en Active Context, pero agranda mucho las tablas en chats largos con lorebooks grandes.

**Qué se añade.** Activada, la opción conserva texto completo en la fila y todos los swipes del mensaje de asistente o narrador más reciente, leído por Active Context y los reintentos de agentes. Volver a un swipe muestra su texto original. Un análisis de turno de usuario suplantado se compacta y nunca ocupa ese lugar. Los mensajes anteriores solo conservan ID, nombres, claves y puntuaciones. Se compactan en segundo plano, no al guardar la generación: el mensaje anterior, una cola de mensajes a la vez. Los fallos usan `logRateLimited` y se reintentan al guardar de nuevo. Si se eliminan mensajes posteriores, Active Context (`lorebooks.routes.ts`) y los reintentos (`retry-agents-route.ts` mediante `storedContentForTextlessScanEntries`) recurren al texto actual guardado de la entrada. `scripts/compact-lorebook-scans.mjs` aplica la regla a chats antiguos: simulación predeterminada, rechazo si el servidor conserva el bloqueo de escritura y copia de ambas tablas antes de `--apply`.

**Qué no cambia.** Desactivada, no escribe nada nuevo y conserva la estructura. El formato y las respuestas de Active Context y la ruta de reintento no cambian; solo hay sustitución si falta texto. Dos correcciones predeterminadas afectan únicamente a análisis antiguos sin texto: Active Context muestra el texto guardado en vez de vacío, y los reintentos incluyen esas entradas con su texto en vez de omitirlas.

**Cómo comprobarlo.** `node scripts/run-regressions.mjs --filter lorebook-scan-compaction` comprueba estructura predeterminada, regreso a swipes, turnos suplantados, barrido de mensajes anteriores al guardar por primera vez, sustitución por la ruta real de Active Context y script de mantenimiento.

**Cómo desactivarlo o revertirlo.** Deja `LOREBOOK_COMPACT_STORED_SCANS` sin definir o en `false`. Los mensajes ya compactados siguen así; el más reciente conserva su texto. Las copias creadas por `--apply` permiten restaurar la estructura anterior.

---

<a id="a4-robustness"></a>

## A4. Robustez

Todos estos cambios dependen de variables desactivadas de forma predeterminada, documentadas en Robustez de `docs/CONFIGURATION.md` y en `.env.example`. Afectan a archivos separados y pueden revisarse, dividirse o revertirse individualmente. Parámetros y campos nuevos son opcionales; `isRateLimitError` y `base-provider.ts` no cambian en este commit.

<a id="a4a-storage-writes"></a>

### A4a. Escrituras de almacenamiento

**Qué existe.** `packages/server/src/db/file-backed-store.ts` vuelca cada fragmento modificado y `manifest.json` mediante `serializeTableRows()` y `atomicWriteFile()`, conservando `.bak` para recuperación. Se mantiene el diseño de escritura atómica y copias.

**Qué se añade.**

- `STORAGE_SKIP_UNCHANGED_WRITES` omite escribir si el contenido coincide con la última escritura duradera del proceso y el archivo conserva tamaño y mtime. Un archivo recuperado de `.bak` siempre se reescribe.
- `STORAGE_YIELDING_SERIALIZE` serializa fragmentos grandes en intervalos de 12 ms que ceden al bucle de eventos. Guardar chats largos no bloquea otras solicitudes; salida idéntica byte a byte a `serializeTableRows`.

**Qué no cambia.** Ambas desactivadas: `serializeTableRows`, `beforeTableWrite`, `atomicWriteFile` como antes. Toda escritura real usa `atomicWriteFile`.

**Cómo comprobarlo.** `node scripts/run-regressions.mjs --filter robustness-storage-write`

**Cómo desactivarlo o revertirlo.** Deja ambas opciones sin definir.

<a id="a4b-windows-boot"></a>

### A4b. Arranque de Windows

**Qué existe.** El bloqueo identifica el arranque del sistema mediante `readBootId()` en `file-backed-store.ts`, que ejecuta PowerShell cada vez (unos 1,5 a 2 s en Windows), además de una consulta de identidad con `reg.exe`.

**Qué se añade.**

- `STORAGE_CACHE_WINDOWS_BOOT_ID` guarda el resultado exacto por arranque del sistema en `DATA_DIR/.writer-boot-id.json` (`db/writer-boot-id-cache.ts`). No escribe bajo `LOCALAPPDATA`.
- Siempre activo: las consultas de `reg.exe` y PowerShell pasan `windowsHide`; iniciar sin consola ya no hace aparecer una ventana fugaz. Ningún otro efecto.

**Qué no cambia.** Lógica del bloqueo y consulta; desactivada, consulta en cada inicio.

**Cómo comprobarlo.** `node scripts/run-regressions.mjs --filter robustness-boot-performance`

**Cómo desactivarlo o revertirlo.** Deja la opción sin definir o elimina `.writer-boot-id.json`.

<a id="a4c-shutdown"></a>

### A4c. Apagado

**Qué existe.** `packages/server/src/index.ts` maneja SIGINT, SIGTERM y, fuera de Windows, SIGHUP con `shutdown(signal)`; ignora repeticiones con warn, activa `armShutdownDeadline` de 8 s y espera todos los cierres de runtime antes de `closeDB()`. Se mantiene ese orden.

**Qué se añade.** `lib/shutdown-signals.ts` y `lib/shutdown-steps.ts`, usados por `index.ts` y `app.ts`:

- `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`: Ctrl+Break y cerrar la consola ejecutan el mismo apagado ordenado, dentro de los aproximadamente 5 s permitidos por Windows.
- `SHUTDOWN_FORCE_EXIT_ON_REPEAT`: un segundo Ctrl+C más de 1,5 s después del primero fuerza la salida.
- `SHUTDOWN_EARLY_FLUSH`: inicia el volcado de guardados pendientes al recibir la señal. No vuelve a registrar aquí un fallo temprano: el almacén ya lo registra y reintenta al cerrar.
- `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` (máximo 2500, predeterminado 0 = esperar todos): con señal de parada, ejecuta `closeDB()` al agotar el presupuesto aunque un runtime esté bloqueado. Estas dos últimas opciones solo afectan a señales; reiniciar desde Advanced Settings en `admin.routes.ts` no cambia.
- Siempre activo: tres cierres con nombre; fallos o duración superior a 1 s se registran con su etapa.

**Qué no cambia.** Todo desactivado: mismas señales, repeticiones ignoradas, todos los cierres antes de `closeDB()` y plazo de 8 s.

**Cómo comprobarlo.** `node scripts/run-regressions.mjs --filter robustness-shutdown-safety`

**Cómo desactivarlo o revertirlo.** Deja las opciones sin definir; las dos primeras requieren reinicio y el observador del entorno lo indica.

<a id="a4d-provider-retry-on-transient-network-errors-provider_retry_transient_errors-switch-providerretry"></a>

### A4d. Reintentos del proveedor ante errores de red transitorios (`PROVIDER_RETRY_TRANSIENT_ERRORS`, interruptor `providerRetry`)

**Qué existe.** `RateLimitAwareProvider` en `packages/server/src/services/llm/rate-limit-aware-provider.ts` reintenta límites de solicitudes con espera progresiva hasta `MAX_RATE_LIMIT_RETRIES`, respetando `Retry-After`. `connection-fallback-provider.ts` cambia a una conexión alternativa. Ambos funcionan; una conexión rechazada o un 502 simplemente hacían fallar la generación.

**Qué se añade.** Conexiones rechazadas o inaccesibles y errores 502/503 se reintentan como máximo dos veces, con espera aleatoria de 0,5 a 2 s (`Retry-After` hasta 5 s), solo antes de entregar texto o razonamiento. Nunca 504 ni reinicios de socket. No se aplica a la conexión principal con alternativa utilizable (`transientRetry: false`), conservando el cambio rápido. También se excluye una principal que ya tenga wrapper propio, como uno pasado por un paquete de capacidades a `llm.withFallback`. Desde A6 existe **Retry failed provider calls** (Reintentar llamadas fallidas); la variable de entorno tiene prioridad.

**Qué no cambia.** Límites de solicitudes: mismo calendario, sin variación aleatoria, mismos callbacks. `isRateLimitError` y `base-provider.ts` intactos.

**Cómo comprobarlo.** `node scripts/run-regressions.mjs --filter robustness-provider-resilience`

**Cómo desactivarlo o revertirlo.** Variable sin definir e interruptor desactivado.

<a id="a4e-runtime-diagnostics"></a>

### A4e. Diagnóstico de ejecución

**Qué existe.** `packages/server/src/routes/admin.routes.ts` ofrece rutas privilegiadas como `/request-timeouts`, pero no una vista conjunta de solo lectura del almacenamiento y las capacidades.

**Qué se añade.** `GET /api/admin/runtime-diagnostics` (`lib/runtime-diagnostics.ts`), protegida por `requirePrivilegedAccess`, `no-store` y límite propio de 30 solicitudes por minuto. Muestra recuentos de datos residentes, tablas modificadas, último error de volcado y runtimes activos con su último fallo de activación. Hooks opcionales: `getStorageStats()` en el controlador, `getFileStoreStats()` en `db/connection.ts` y `runtimeState()` en `CapabilityModuleRuntime`.

**Qué no cambia.** Solo lectura: no cambia rutas, respuestas ni acceso existentes.

**Cómo comprobarlo.** `node scripts/run-regressions.mjs --filter robustness-runtime-diagnostics` o abre `/api/admin/runtime-diagnostics` en un servidor local con acceso privilegiado.

**Cómo desactivarlo o revertirlo.** Inerte sin llamadas. Para quitarla, elimina la ruta de `admin.routes.ts` y `lib/runtime-diagnostics.ts`.

<a id="two-catches-that-used-to-be-silent"></a>

### Dos capturas antes silenciosas

Siguiendo CONTRIBUTING, ahora registran en warn el análisis de cabecera de chat SillyTavern en `import.routes.ts` (solo tipo de error; un mensaje JSON puede citar texto del chat) y el transporte de preguntas de activación de agentes (limitado en frecuencia).

---

<a id="a5-startup-internal-requests-wait-until-route-registration-has-ended"></a>

## A5. Arranque: las solicitudes internas esperan al registro completo de rutas

Corrección siempre activa, no una opción.

**Qué existe.** `buildApp()` en `packages/server/src/app.ts` registra rutas centrales, espera `capabilityModuleRuntime.start(app)`, que activa cada paquete mediante `activateOne()` en `services/capability-packages/capability-module-runtime.service.ts`, y después inicia `startServerAutonomousScheduler(app)`. Hay llamadas internas `app.inject()` desde paquetes mediante `runCapabilityInternalRoute()` en `capability-route-registration.service.ts`, el programador autónomo en `server-autonomous-scheduler.service.ts` y `routes/generate/prompt-preview.ts`. El primer `inject()` arranca toda la instancia Fastify; después no se añaden rutas, hooks ni plugins. Si un temporizador o worker temprano lo llamaba mientras `buildApp()` registraba, fallaban los paquetes posteriores con "Root plugin has already booted", y el siguiente `addHook` detenía el servidor. El `catch` de `activateOne()` registra el error y ejecuta `capabilityPackageManager.rollbackRuntime()` o guarda estado y disponibilidad `"error"`. Así, un paquete sano podía quedar revertido o marcado `"error"` en arranques posteriores.

**Qué se añade.**

- `lib/fastify-inject-gate.ts`: `buildApp()` llama `holdInjectUntilRegistered(app)` justo tras crear la instancia y libera antes de `return app`. Los `app.inject()` previos, con promesa o callback, esperan al final y alcanzan rutas añadidas después. Si un `inject()` retenido de tipo callback lanza error, lo entrega al callback.
- `activate()` y `selfCheck()` forman parte del registro; esperar sus propias rutas bloquearía indefinidamente. `activateOne()` los ejecuta dentro de `failInjectFastDuring()`: `inject()` directo falla inmediatamente con `InjectDuringRegistrationError` (`code`: `MARINARA_INJECT_DURING_REGISTRATION`). Solo ese paquete no se activa; el arranque continúa. Los temporizadores que disparan después de retornar `activate()` esperan como otras llamadas de fondo.
- Otras llamadas retenidas avisan con la pila del llamador a los 60 s y se rechazan con el mismo error a los 10 minutos. Un arranque bloqueado falla visiblemente. Los temporizadores sin referencia no mantienen vivo el proceso.
- `isHostLifecycleActivationError()` en `capability-module-runtime.service.ts` reconoce `AVV_ERR_ROOT_PLG_BOOTED` ("Root plugin has already booted") y `FST_ERR_INSTANCE_ALREADY_LISTENING` ("Fastify instance is already listening"). No revierte el paquete ni persiste estado/disponibilidad `"error"`; conserva versión y estado para activar normalmente al reiniciar. Registra una vez en warn y conserva el diagnóstico. Otros fallos mantienen error, reversión y estado `"error"`.
- Regresión: `startup-inject-gate`.

**Qué no cambia.** Tras retornar `buildApp()`, `app.inject()` vuelve a ser Fastify sin wrapper. La forma encadenada sin argumentos nunca espera. Orden de registro, rutas, `runCapabilityInternalRoute()`, programador y activación/actualización posterior siguen iguales. Un caso afecta al servidor activo: un paquete activado desde la interfaz que añade una ruta nueva sigue recibiendo `FST_ERR_INSTANCE_ALREADY_LISTENING`, pero la nueva versión permanece instalada para activarse al reiniciar, sin reversión. El llamador sigue recibiendo el error.

**Cómo comprobarlo.**

```sh
node scripts/run-regressions.mjs --filter startup-inject-gate
```

Comprueba liberación y ruta posterior, callbacks, fallo inmediato dentro de `activate()`, temporizador iniciado desde `activate()`, límite de 10 minutos con valores cortos, colocación/liberación del bloqueo en `buildApp()` y retorno antes de revertir con una sola advertencia ante errores de ciclo de vida del host.

**Cómo desactivarlo o revertirlo.** Sin interruptor. `MARINARA_INJECT_DURING_REGISTRATION` es el código de `InjectDuringRegistrationError`, no una opción. Revierte el commit del bloqueo de inject.

---

<a id="a6-feature-switches-settings--advanced--features"></a>

## A6. Interruptores: Settings > Advanced > Features

**Qué existe.** Las opciones del servidor son variables de entorno (A3/A4), sin lugar común en la interfaz. Cada opción requeriría ajuste, ruta e interfaz propios.

**Qué se añade.** Un registro y una sección, ampliados después por F, G y H. Detalles en `docs/configuration/features.md`.

- `packages/shared/src/schemas/feature-settings.schema.ts` define nombres y valores predeterminados; un objeto JSON en `features` guarda solo valores no predeterminados.
- Dos interruptores: **Stable lorebook picks** (`stableLorebookGroupPicks`, A3a) y **Retry failed provider calls** (`providerRetry`, A4d).
- `isFeatureEnabled()` en `services/features/feature-settings.ts` lee una copia en memoria sin coste adicional en rutas frecuentes. Se carga al registrar rutas de ajustes y actualiza al escribir/eliminar la fila, tras comandos de base de datos de Professor Mari que la cambien y tras recargar `.env`. `GET` y `PUT /api/app-settings/features`; `PUT` valida estrictamente.
- Las variables definidas prevalecen tanto para activar como desactivar. `LOREBOOK_STABLE_GROUP_WINNERS` y `PROVIDER_RETRY_TRANSIENT_ERRORS` fijan los interruptores en lugar de leerse por separado.
- El cliente los lista en Settings > Advanced > Features; los fijados aparecen bloqueados con el nombre de la variable. Otros componentes usan `useFeatureEnabled()`.

**Qué no cambia.** Todos desactivados de forma predeterminada; sin abrir la sección, nada cambia. Variables ya definidas mantienen su efecto.

**Cómo comprobarlo.** `node scripts/run-regressions.mjs --filter feature-settings` comprueba registro, valores, normalización, prioridad del entorno, rutas, almacenamiento, invalidación tipo Mari y listeners. En la app, abre Settings > Advanced > Features o busca `features`.

**Cómo desactivarlo o revertirlo.** Deja ambos desactivados o elimina las variables. Revertir el commit quita el mecanismo; las variables vuelven a funcionar por separado.

---

<a id="a7-logged-best-effort-helpers"></a>

## A7. Helpers de mejor esfuerzo con registro

Añadido sin interruptor ni cambio de comportamiento por sí solo.

**Qué existe.** Algunas operaciones ignoran deliberadamente fallos con `catch` vacío: limpieza, avance de cursor o escritura de caché. Es correcto, pero no deja rastro.

**Qué se añade.** `packages/server/src/lib/best-effort.ts` con `logSuppressed`, `orFallback` y `bestEffort`. Los fallos absorbidos se registran mediante `logRateLimited` (A2), como máximo una línea por minuto para cada evento, chat y etapa. Las correcciones D/E lo usan al sustituir capturas vacías.

**Qué no cambia.** Ninguna llamada nueva en este PR, ningún cambio en rutas existentes.

**Cómo comprobarlo.** `node scripts/run-regressions.mjs --filter best-effort`.

**Cómo desactivarlo o revertirlo.** Sin interruptor; revertir el commit elimina el archivo.

---

<a id="coming-in-later-pull-requests"></a>

# Próximos pull requests

Estas secciones son breves a propósito. Cada PR añade las mismas cinco partes al abrirse.

Estado: el PR A se fusionó como #6647 y el PR B como #6648. El PR C (#6649) se cerró sin fusionarse, y los PR D a H no se abrieron como pull requests separados. Las secciones de C a H de abajo describen el plan tal como se escribió; no las interpretes como funciones que se publicaron en esta forma.

<a id="pr-b-dev-mcp-for-coding-assistants"></a>

## PR B: Dev MCP para asistentes de programación

Servidor opcional en `tools/dev-mcp` para trabajar localmente en Marinara, fuera del workspace pnpm y de Docker. Usa el seguimiento de A2. Instalación y comprobaciones en `tools/dev-mcp/README.md`, añadido por B.

<a id="pr-c-command-palette-and-keyboard-shortcuts-overlay"></a>

## PR C: Paleta y panel de atajos

En C: paleta Ctrl+K y panel "?" de atajos. Solo cliente, sin interruptor ni cambios en combinaciones existentes.

<a id="pr-d-reviewed-server-fixes-part-1"></a>

## PR D: Correcciones revisadas del servidor, parte 1

En D: rutas, middleware, recuperación, chat/generación, importadores, sidecars y SSRF, cada una con regresión. Correcciones sin interruptor.

<a id="pr-e-reviewed-server-fixes-part-2"></a>

## PR E: Correcciones revisadas del servidor, parte 2

En E: servicios y almacenamiento, cada corrección con regresión y sin interruptor.

<a id="pr-f-prompt-caching"></a>

## PR F: Caché de prompts

En F: corregir marcador de historial de suscripción Claude, actualizar Claude Agent SDK, estructura favorable a caché (interruptor desactivado), aviso por chat antes de enviar con poca caché (desactivado) y diagnóstico opcional.

<a id="pr-g-generation-jobs-and-console-tray"></a>

## PR G: Trabajos de generación y bandeja

En G: trabajos de imágenes, sprites y vídeo que continúan al cerrar la pestaña, con visor (interruptor desactivado) e icono de bandeja de consola Windows (interruptor desactivado).

<a id="pr-h-engine-diagnostics-and-launcher"></a>

## PR H: Diagnóstico y lanzador

En H: integridad al arrancar, telemetría de memoria, archivos opcionales de depuración, límite de llamadas de fondo (interruptor desactivado), medidas de seguridad del lanzador y reintento sin desactivar razonamiento para modelos que siempre razonan.

---

<a id="test-results-for-pr-a-on-the-development-machine"></a>

## Resultados de PR A en el equipo de desarrollo

Comprobado sobre `staging`, commit `dd876831a`. Sin llamadas de pago.

- **Regresiones Node en Linux**, como CI `complete-node-regressions` (Ubuntu 24.04 en WSL, Node 24, `pnpm install --frozen-lockfile`, `pnpm regression`): pasan los 384 archivos. Con más carga, `server-signal-shutdown` llegó ocasionalmente a 30 s, también en `staging` sin cambios. `smart-group-decision`, `agent-activation-questions` y `advanced-memory-core`, sensibles al tiempo, fallaron una vez cada uno y pasaron siempre al repetir.
- **Regresiones Node en Windows**: 379 de 384 pasan. `decision-sidecar-runtime`, `gallery-previews`, `request-timeouts`, `server-signal-shutdown` y `storage-writer-lock` fallan igual en `staging` sin cambios en ese equipo: bloqueos de archivos, señales de consola y comprobación de espacio locales.
- **Tipos, lint, formato y compilación**: `tsc --noEmit` para shared, server, client, proyecto raíz y estimación de tokens; lint con 0 errores; Prettier en `packages/**/*.{ts,tsx}`; comprobaciones de locales y JSX estático; compilaciones de cliente y servidor.
- **Pruebas de navegador** de ajustes (`core-flows`, `issue-sweep-settings`, `ux-feedback-sweep`, `afternoon-sweep`, `client-runtime-diagnostics`) en `mobile-chromium`: 171 pasan, 0 fallan. Los fallos restantes tras repetir en `mobile-webkit` (WebKit en Windows) también aparecen en `staging` sin cambios.
- **Sección Features** revisada visualmente con temas predeterminado y SillyTavern, claro y oscuro, en escritorio y teléfono.
