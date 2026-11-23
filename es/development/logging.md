# Registros del servidor

Esta página explica cómo leer el registro del servidor Marinara Engine y escribir líneas útiles. Complementa la [sección Logging de CONTRIBUTING.md](../../CONTRIBUTING.md#logging), no la sustituye. Siguen vigentes el logger Pino compartido, los errores como primer argumento, los especificadores de formato y la tabla de cuatro niveles.

<a id="what-every-line-carries"></a>

## Qué incluye cada línea

Todas las líneas del servidor proceden de una instancia Pino: `logger` en `packages/server/src/lib/logger.ts`. Fastify la usa mediante `loggerInstance`, por lo que `req.log`, `reply.log` y `app.log` son hijos suyos. Comparten serializadores y los cambios en caliente de `LOG_LEVEL` del observador de entorno.

| Campo | Aparece en | Significado |
| --- | --- | --- |
| `pid` | cada línea | ID del proceso (predeterminado de Pino). |
| `hostname` | cada línea | Nombre de host (predeterminado de Pino). |
| `bootId` | cada línea | 8 caracteres hexadecimales nuevos por inicio de proceso. Distinguen ejecuciones que comparten archivo. |
| `requestId` | cada línea causada por una solicitud | Mismo valor que la cabecera de respuesta `x-request-id`. Está en líneas de `req.log` y del `logger` compartido dentro de servicios. |
| `route` | líneas posteriores al análisis del cuerpo | Patrón de ruta coincidente, por ejemplo `/api/chats/:id`. Nunca contiene la URL sin procesar. |

<a id="request-ids"></a>

### ID de solicitud

`lib/request-logging.ts` asigna un ID a cada solicitud:

- El cliente puede enviar `x-request-id`. Se conserva si tiene de 8 a 80 caracteres de `A-Z a-z 0-9 . _ : -`; cualquier otro valor se reemplaza.
- En otro caso se crea un UUID. El contador predeterminado `req-1` de Fastify volvía a empezar en cada arranque y repetía ID.
- El ID regresa en la cabecera `x-request-id`, expuesta por CORS. Puede incluirse en un reporte, y `grep <id>` encuentra todas las líneas de esa solicitud.

El ID se guarda en un contexto `AsyncLocalStorage` (`lib/log-context.ts`). Un mixin de Pino lo copia a cada línea. No hay que pasarlo entre funciones: `logger.warn(err, "...")` en un servicio profundo lo obtiene automáticamente. El contexto se establece de nuevo tras analizar el cuerpo, porque ese análisis usa el contexto asíncrono propio del analizador HTTP.

El contexto sigue todo lo iniciado dentro de la solicitud: temporizadores, listeners y procesos hijos. Cuando el trabajo sobrevive a la solicitud, envuelve su inicio en `runWithRootLogContext({}, fn)`, para que las líneas posteriores no conserven el ID de la solicitud inicial. El sidecar local lo hace con los procesos llama-server y MLX, y los sidecars Decision y Utility inician sus procesos igual; así un inicio compartido por solicitudes futuras no conserva el primer ID. Otro trabajo duradero iniciado desde una ruta mantiene su `requestId` hasta que se envuelve del mismo modo.

<a id="request-lines"></a>

### Líneas de solicitud

`RequestLogController` es el `LogController` predeterminado de Fastify con estos cambios:

- La etiqueta es `requestId`, no `reqId` como en Fastify. Las búsquedas guardadas y filtros de `reqId` necesitan el nombre nuevo.
- Las líneas `incoming request` y `Route ... not found` omiten parámetros de consulta, que pueden contener tokens o búsquedas. La línea entrante conserva los otros campos de `req` (`method`, `version`, `host`, `remoteAddress`, `remotePort`) y añade `route`.
- Si el cliente cierra antes de tiempo, se registra una línea `Client aborted request` en info. Fastify no registraba nada aquí.

`LOG_DISABLE_REQUEST_LOGGING` sigue funcionando e incluye la desactivación de la línea de aborto.

Una terminal recibe líneas de pino-pretty: `pnpm dev` y un servidor de producción cuya salida estándar es una terminal (los lanzadores). La salida de producción que va a otro lugar es JSON, un objeto por línea. `LOG_FORMAT=pretty|json` sustituye esa elección, y el lanzador de Termux establece `pretty` porque su salida llega a la terminal a través de `tee`. pino-pretty oculta `hostname` (su valor predeterminado) y `bootId`; la salida JSON conserva ambos.

<a id="startup-timeline"></a>

## Cronología de inicio

`lib/startup-timeline.ts` mide cada paso del arranque:

```ts
const db = await startup.phase("storage.open", () => getDB());
```

- Cada línea incluye `event: "startup.phase"`, `stage`, `elapsedMs` (tiempo transcurrido) y `selfMs` (tiempo propio sin fases internas). El nivel depende de `selfMs`: debug por debajo de 1 s, info por encima de 1 s y warn por encima de 15 s. Con `LOG_LEVEL=warn`, un inicio normal, incluso un primer arranque lento, no imprime líneas de fases.
- Las fases se anidan. `app.build` en `index.ts` engloba las fases de `buildApp`. Al depender de `selfMs`, un paso interno lento se informa una vez, por ese paso; `app.build` permanece en debug salvo que su propio trabajo exterior sea lento.
- Un fallo no se registra dentro de la fase. El error sube sin cambios; `main().catch` en `index.ts` escribe una línea `startup.failed` con el paso (`startup.stageOf(err)`).
- Cuando el servidor escucha, `index.ts` escribe una línea info `[startup] Ready in N ms` con `event: "startup.ready"`, el número de fases y los cinco pasos de mayor `selfMs`.

Las fases no añaden `stage` al contexto de registro. Los servicios que inician temporizadores conservarían de otro modo esa etapa durante toda la vida del proceso.

<a id="one-line-per-failure"></a>

## Una línea por fallo

Cada fallo debe producir exactamente una línea, escrita por el código que decide qué ocurre después.

- **Registra o relanza, no ambas cosas.** Si relanzas, deja registrar al llamador. Los detalles extra útiles van en debug, como el nombre de herramienta en `[agent-tools] ... failed`.
- **Dónde se escribe la línea:**
  - errores 500 desconocidos: `middleware/error-handler.ts`
  - fallos de agentes: `executeAgent` (warn, fallo no crítico)
  - generación de chat fallida: catch principal de `generate.routes.ts`
  - El proveedor correspondiente lanza y no registra. Como máximo añade una línea debug con modelo y error original, como Grok CLI y Claude (Subscription). Claude (Subscription) lanza un mensaje comprensible que ya contiene el error del SDK, por lo que no lo adjunta también como `cause`: el error SSE del chat y el texto de error del agente añaden el mensaje de la causa y duplicarían el texto.
- **Las cancelaciones son info.** Detener, cerrar una pestaña o abortar una señal son resultados esperados. Usa `failureLevel(err)` o `failureLevel(err, "warn")` de `lib/log-context.ts`. Devuelve `"info"` cuando `isCancellation(err)` es true. Un `TimeoutError` es un fallo real, no una cancelación.

  ```ts
  logger[failureLevel(err)](err, "[agent-batch] Batch call FAILED: %s", errMsg);
  ```

- **Conserva la causa.** Envuelve con `new Error("Could not save chat", { cause: err })`. Los serializadores `err` y `error` añaden mensaje y pila de la causa (`caused by: ...`). Un Error registrado como `{ error }` también se serializa; ya no aparece como `{}`.

<a id="repeating-failures"></a>

## Fallos repetidos

Consultas periódicas, comprobaciones de salud y hooks de cada turno pueden fallar igual cada pocos segundos. Usa `logRateLimited` de `lib/log-rate-limit.ts`:

```ts
logRateLimited("warn", "autonomous-scheduler:poll", err, "[autonomous-scheduler] Poll failed");
```

Se escribe la primera aparición de una clave. Las siguientes dentro de la ventana (60 s de forma predeterminada) se cuentan, y la próxima línea lleva `suppressedRepeats`. Incluye en la clave lo que falla, como ID de paquete o chat, para que un elemento defectuoso no oculte otro.

<a id="prompt-and-model-text"></a>

## Texto del prompt y del modelo

Prompts, salidas del modelo, cuerpos de respuesta del proveedor y de consultas van en **debug**, nunca warn o error. Pueden contener la historia del usuario, y los cuerpos del proveedor pueden repetir credenciales o prompts. En warn registra tamaño (`rawLength`, `bodyLength`) y motivo. Un error de análisis JSON puede citar el texto que falló: en warn registra solo el tipo. Pon el error y el texto en una línea debug aparte:

```ts
logger.warn(
  { errorType: err instanceof Error ? err.name : typeof err, rawLength: raw.length },
  "[game/scene-wrap] Failed to parse LLM response as JSON",
);
logger.debug({ err }, "[game/scene-wrap] Unparsed LLM response: %s", raw.slice(0, 200));
```

El interruptor de depuración de la interfaz sigue funcionando mediante `logDebugOverride`. Es la vía prevista para ver prompts cuando `LOG_LEVEL` oculta debug.

Imprime el texto del prompt tal como es, con `%s`. Para un valor estructurado (un arreglo de mensajes, el cuerpo de una solicitud al proveedor, una respuesta analizada), pasa `debugJson(value)` a `%s`, no a `%j` ni a `JSON.stringify(value)`. Imprime JSON con sangría cuyos saltos de línea dentro de cadenas son saltos de línea reales, para que un prompt de varias líneas siga siendo legible, y solo se genera cuando se imprime la línea. Una función de reemplazo que oculte datos va en su segundo argumento, como con `JSON.stringify`. Una vista de depuración dentro de la app imprime el mismo texto con `readableJson` de `@marinara-engine/shared`. La regresión `debug-log-line-breaks` cubre esto y la elección del formato.

De forma predeterminada, los archivos multimedia insertados aparecen abreviados en el registro. `debugJson` reemplaza cada bloque de datos en base64 por un marcador como `[image/png base64, ~1.2 MB: iVBORw0KGgoAAAA...ElFTkSuQmCC]`, con el tipo, el tamaño y los primeros y últimos 16 caracteres. Se aplica a las URL `data:`, tanto si ocupan toda la cadena como si están dentro de un texto, y a los campos `data` de los elementos multimedia de Anthropic y Google. También se aplica cuando el base64 ocupa varias líneas. El serializador `msg` hace lo mismo con las URL `data:` en líneas simples de `%s` y `%j`. Solo `debugJson` abrevia un campo `data` sin envoltorio. Se modifica únicamente la copia impresa. El valor original queda intacto. Para volver a imprimir los datos completos, configura `LOG_INLINE_MEDIA=full` en `.env`. La prueba de regresión `log-inline-media` comprueba este comportamiento.

<a id="checks"></a>

## Consola en la aplicación

**Settings → Advanced → Open Console** (Configuración → Avanzado → Abrir consola) muestra las líneas recientes del servidor en la aplicación. Sirve para instalaciones cuyo terminal queda fuera de alcance (un NAS, un VPS, Docker o Termux).

- `lib/log-buffer.ts` conserva las últimas 1.500 líneas en memoria, con un máximo aproximado de 4 millones de caracteres. Cada mensaje y cada bloque de campos se recortan a 16.000 caracteres. No se escribe nada en disco y el búfer se vacía al reiniciar.
- `logger.ts` copia cada línea serializada al búfer mediante `hooks.streamWrite` de Pino. Así, el búfer contiene lo mismo que recibió el terminal o el archivo de registro, con el mismo `LOG_LEVEL`. Quedan fuera las líneas que no pasan por Pino, como `injected env` de dotenv o la salida sin procesar de un proceso hijo.
- `GET /api/admin/logs?afterId=` devuelve las líneas posteriores a `afterId`, además de `latestId`, `truncated` (se descartaron líneas antes de esta lectura) y el `logLevel` del servidor. La ruta está protegida por `requirePrivilegedAccess` y usa `no-store`. Funciona con `logLevel: "silent"` para que las consultas de la propia consola nunca aparezcan en el búfer.
- Las reglas de esta página también se aplican aquí. Un administrador remoto puede leer en la aplicación todo lo que registres en warn o error. Mantén los prompts y los cuerpos de las solicitudes y respuestas del proveedor en debug.

## Comprobaciones

Las regresiones `logging-request-trail`, `logging-failure-lines` y `logging-startup-timeline` cubren esta página y `server-console-logs` cubre la consola en la aplicación:

```sh
node scripts/run-regressions.mjs --filter logging-
```
