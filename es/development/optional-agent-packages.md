# Paquetes opcionales de agentes y capacidades

Estado: implementado para el ciclo de desarrollo v2.3.0 en el issue #3612.

## Objetivo

La distribución base de Marinara Engine no debe compilar ni incluir implementaciones opcionales de agentes y capacidades. Las instalaciones nuevas empiezan sin paquetes opcionales. Las actualizaciones conservan las capacidades que estaban disponibles antes de que se introdujera este sistema de paquetes.

El catálogo oficial, las fuentes de los paquetes, los artefactos reproducibles, los scripts de validación y el flujo de contribución están en [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Los artefactos instalados quedan dentro de la carpeta de datos de Marinara configurada, para que las actualizaciones de la aplicación no puedan sobrescribirlos.

## Modelo de paquetes

Un paquete de agente puede aportar uno o más agentes declarativos y capacidades ejecutables de confianza opcionales:

- puntos de entrada del servidor para rutas, hooks de ciclo de vida, proveedores de prompt (instrucciones enviadas a la IA), manejadores de resultados y migraciones de almacenamiento;
- puntos de entrada del cliente para paneles, superficies de chat, secciones de configuración, opciones de configuración inicial, visualizaciones en tiempo de ejecución y superficies completas de Game Mode;
- esquemas JSON compartidos y contratos de comunicación estables;
- recursos propios del paquete, documentación y fragmentos de conocimiento de Professor Mari.

Los paquetes apuntan a una API de capacidades de Marinara con versión. No deben importar rutas de código privadas del motor.

Los elementos de capacidad del cliente reciben la configuración regional de la interfaz elegida en el Engine a través de sus atributos `lang` y `dir` y del objeto
`capabilityProps.localization`. Las interfaces propias del paquete conservan sus propios archivos de idioma y recurren al inglés del paquete; el Engine no traduce los prompts del paquete ni los valores de máquina escritos por el paquete. Los cambios de idioma reutilizan el evento
`marinara-capability-props` existente, para que una interfaz instalada pueda volver a renderizarse sin reiniciar el Engine.

### Entrega y caché

Los archivos de paquetes instalados se sirven con validadores fuertes derivados de los hashes SHA-256 por archivo del manifiesto, los mismos valores con los que Engine vuelve a verificar los bytes en cada lectura. El paquete del cliente (`/api/capability-packages/<id>/client`) y todos los recursos del paquete siempre se revalidan (`no-cache` junto con un `ETag`), por lo que un archivo sin cambios responde `304 Not Modified` en vez de descargarse de nuevo, mientras que un archivo vuelto a publicar se recoge de inmediato. Nada se sirve como `immutable`: la política de instalación permite volver a publicar la misma versión con bytes diferentes, por lo que ninguna URL de paquete está direccionada por contenido.

La API de capacidades 1.1 añade una fachada genérica de tiempo de ejecución al contexto de activación del servidor.
Los paquetes pueden leer el estado efectivo de depuración de agentes y escribir a través del
logger Pino del Engine, incluidos los reemplazos explícitos del modo de depuración, sin importar el
logger privado ni los módulos de configuración de tiempo de ejecución. La fachada expone operaciones,
no los objetos internos del Engine.

La API de capacidades 1.2 añade operaciones de chat/mensaje con alcance de transacción, escrituras
limitadas de metadatos de chat y lecturas de existencia de entradas de lore, y el almacén de
compatibilidad de instantáneas espaciales. Los paquetes pueden validar cambios de dominio dentro de una
transacción del Engine y confirmar de forma atómica los metadatos junto con un mensaje propietario, un swipe (respuesta alternativa) o una instantánea
espacial, sin recibir un manejador de base de datos ni un objeto de tabla. El Engine conserva
la reversión y la compatibilidad de almacenamiento histórico; los paquetes conservan la validación y
la política de dominio. La misma API expone registros normalizados de chat y personaje, la selección
de entradas de lore elegibles, el análisis de respuestas tipo JSON y las llamadas resueltas al modelo de lenguaje.
Las credenciales de conexión, las implementaciones de proveedor, los manejadores de base de datos y los objetos de almacenamiento
siguen siendo privados del Engine.

### Capability API 1.7: ramas de chat

Capability API 1.7 añade metadatos normalizados de rama a `CapabilityChatRecord`:

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` es el nombre de rama guardado sin espacios sobrantes. Los chats raíz devuelven `null`. Las ramas conocidas creadas por Engine exponen el chat padre inmediato, el mensaje de origen de la bifurcación y el mensaje hijo copiado. Las ramas vacías usan anclas de mensaje null. Las ramas heredadas, los metadatos no válidos y los chats hermanos de grupo importados sin una relación conocida devuelven campos de linaje null; Engine no deduce relaciones históricas. La exportación e importación genéricas omiten los ID del padre y de los mensajes porque cambian entre instalaciones. Eliminar el padre no modifica el linaje del hijo.

### Capability API 1.8: experiencias de Game

Capability API 1.8 añade experiencias de Game proporcionadas por paquetes, contexto de prompt por turno de Game y escritura de recursos.

Un paquete puede proporcionar un Game Mode completo en vez de un añadido al modo integrado. Declara la ranura `game-surface` y se elige al crear un juego, en el bloque Experiences del asistente de configuración. La elección queda guardada en el juego y no cambia durante toda su vida, por lo que una experiencia nunca se activa o desactiva en mitad de una partida. La superficie dibuja su propio HUD, menús y combate sobre la narración compartida, y declara qué sistemas integrados sustituye. Lo que no se declare sigue siendo integrado, así que una experiencia solo desactiva aquello que realmente implementa. El valor opcional `contributions.gameSurface.surfaceClass` indica una clase que Engine aplica al área de juego mientras la superficie está montada, lo que permite que la hoja de estilos del paquete cambie la interfaz compartida que se renderiza fuera de su propio elemento.

Los paquetes con el permiso `prompt-context` aportan texto al prompt del sistema de cada turno de Game generado. Así, un paquete que controla un estado activo puede mantener el modelo en consonancia con lo que ve el jugador. Una contribución también puede declarar qué sistemas integrados del juego sustituye, y Engine deja de pedir al modelo que los controle. Las contribuciones se recogen en cada turno y nunca son obligatorias: si no devuelven nada se omiten; si lanzan un error o no terminan dentro de su plazo, se registran y se omiten sin afectar a la generación.

La fachada de recursos permite escribir además de leer, por lo que el flujo de configuración de un paquete puede buscar o crear la Persona del jugador y su lorebook. Engine conserva el almacenamiento, la validación y la identidad; los paquetes conservan el contenido del dominio.

### Capability API 1.10: recursos de paquete

Capability API 1.10 añade la entrega general de recursos estáticos propios del paquete. Un manifiesto puede declarar `contributions.assets.paths`, una lista permitida de hasta 256 imágenes (`png`/`webp`/`gif`/`jpg`/`jpeg`) y archivos JSON incluidos en el paquete. Engine los sirve mediante `/api/capability-packages/<id>/assets/<path>` con la misma cadena de verificación exacta que ya usan los iconos de pestaña: contención de ruta, pertenencia del hash a `files[]`, lista permitida de tipos de contenido pasivos y nueva verificación de integridad en cada lectura. El esquema rechaza los tipos de documento activos (SVG, HTML y scripts); toda ruta declarada debe estar fijada por hash en `files[]`; y el `manifest.json` interno del paquete nunca puede servirse, aunque se declare. Declarar `contributions.assets` exige un manifiesto `schemaVersion` 2 con `capabilityApi` 1.10 o posterior; un manifiesto v1 no puede declararlo. Los recursos siempre se revalidan: como el paquete del cliente, llevan un `ETag` fuerte basado en el hash del manifiesto y responden a una revalidación sin cambios con `304 Not Modified` y sin cuerpo, de modo que un conjunto de mosaicos solo vuelve a descargarse cuando cambian sus bytes. Las respuestas nunca son `immutable` de forma deliberada: la política de instalación permite volver a publicar la misma versión con bytes distintos, así que una URL con versión no está direccionada por contenido. Esto permite que una experiencia `game-surface` incluya arte real en vez de incrustarlo en su paquete del cliente.

Un manifiesto que incumpla estas reglas se rechaza durante la instalación con uno de estos mensajes: "A declared package asset must be listed in the package file manifest", "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer", el error de extensión del esquema para una ruta que no sea de imagen o JSON, o, en archivos cuyos nombres solo difieran en mayúsculas y minúsculas y que se fusionarían en sistemas de archivos que no distinguen entre ellas, "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems".

Cada elemento de capacidad recibe su propia identidad para este fin: `capabilityProps.packageId` y `capabilityProps.packageVersion` llegan junto a `localization`, por lo que un paquete crea las URL de sus recursos como `/api/capability-packages/<packageId>/assets/<path>`, opcionalmente con `?v=<packageVersion>` para que un cambio de versión invalide cualquier caché intermedia, sin volver a solicitar la lista de instalados ni extraer información de su propia URL de importación.

### Capability API 1.11: interfaz de combate para experiencias

Capability API 1.11 añade una interfaz de combate a las propiedades de la capacidad `game-surface`. `combatActive` informa del instante en que la interfaz de combate integrada se monta de verdad, a diferencia de `chatMeta.gameActiveState`, el estado narrativo de la escena del GM, que tarda en reflejar el cambio y puede indicar "combat" sin que exista ningún encuentro. `combatStyle` contiene el estilo efectivo (`classic` o `tactical`). `requestCombat()` pide a Engine que genere un encuentro mediante el mismo proceso que usa el botón manual Start Combat, salvo por el diálogo de confirmación, porque la propia interfaz de la experiencia ya expresó la intención. El proceso de generación de Engine sigue decidiendo en qué consiste el encuentro. No existe deliberadamente ninguna forma de que el paquete suministre combatientes o un estado de combate directamente: el combate sigue siendo propiedad de Engine.

`requestCombat()` conserva una identidad estable, no muestra mensajes en la ruta del paquete y devuelve un código con el que la experiencia renderiza su propia respuesta: `"started"` o un rechazo, `"combat-active"`, `"pending"` (ya hay una generación en curso), `"no-turn"` (el GM todavía no ha escrito un turno) o `"unavailable"` (sesión terminada o repetición). `combatPending` y `combatError` reflejan el avance y el fallo de la generación para que un paquete no quede esperando `combatActive` después de un error. Como las interfaces 1.7 y 1.8, pero a diferencia de `contributions.assets` de 1.10, que tiene una barrera estricta, estas propiedades se entregan a todos los paquetes `game-surface` con independencia del valor de `capabilityApi` que declaren. La etiqueta 1.11 indica cuándo aparecieron; si un paquete las necesita, declara 1.11 y las versiones anteriores de Engine lo rechazan correctamente.

### Capability API 1.12: eventos espaciales para la experiencia propietaria

Capability API 1.12 también dirige los eventos de capacidad espacial al paquete de la experiencia propietaria del juego. `spatial_transition_committed`, `spatial_transition_rejected` y la indicación sin tipo `spatial_context_refresh`, antes dirigidos solo a `hierarchical-maps` en el evento de ventana `marinara-capability-server-event`, ahora se envían también con `packageId` establecido en el `gameExperienceId` del chat. Las cargas varían: un evento confirmado contiene `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`; un evento rechazado contiene `{ chatId, commandId, code?, message? }`, sin campos de ubicación porque el movimiento no ocurrió; la indicación de actualización contiene `data: null`. Una experiencia que envió una orden de viaje mediante el argumento `pendingSpatialTransition` de `sendMessage` puede confirmar o borrar el viaje en cuanto el host conoce el resultado, en vez de deducirlo de lecturas posteriores. La versión 1.12 también cierra una brecha que afectaba a World Maps: las transiciones rechazadas por cualquiera de las dos rutas HTTP silenciosas, la confirmación del turno propietario antes del streaming dentro de una generación o la confirmación REST independiente, antes no generaban ningún evento. Ahora ambas sintetizan `spatial_transition_rejected`, pero solo con pruebas definitivas: un código de error `spatial_*` distinto de `already_applied`. Los fallos no concluyentes, como un error de red que podría haber perdido una confirmación correcta, envían en su lugar la indicación sin tipo `spatial_context_refresh` para que los receptores se sincronicen con el estado del servidor en vez de aceptar un veredicto inventado. Un evento confirmado cuyo `travel.mode` sea `"step_by_step"` y tenga `complete: false` significa que el viaje continúa; conserva el estado pendiente hasta el evento final. Es una interfaz flexible como la 1.11: los eventos se entregan con independencia del `capabilityApi` declarado. Declara 1.12 solo si el paquete los necesita.

### Capability API 1.13: contracción transitoria de la narración

Capability API 1.13 añade `requestsCollapsedNarration` a la declaración de interfaz que un paquete `game-surface` pasa a `setExperienceChrome`. Mientras el indicador sea true, el cuadro de narración de Game Mode se pliega hasta su tirador estrecho, de modo que una experiencia puede despejar la pantalla para una cinemática o una escena a pantalla completa.

Es una SOLICITUD, no una preferencia. Nunca se escribe el ajuste de contracción del jugador, y el indicador solo se respeta mientras la experiencia sea la superficie activa. Si se elimina el indicador o deja de ser la superficie activa, el cuadro vuelve a lo que eligió el jugador. Esa es la garantía de que siempre se abre de nuevo después; un paquete no puede guardar la contracción de forma permanente.

Las reglas de seguridad de Engine tienen prioridad. El cuadro se expande a la fuerza siempre que se muestre el campo de texto del jugador, incluso al principio de una escena antes de que exista un segmento, y cuando estén activos los controles para avanzar el segmento, porque son la única forma de terminar un turno. Un paquete capaz de ocultarlos podría dejar al jugador atrapado para siempre. El tirador también sigue mostrando su indicador de atención cuando hay pendiente un reintento de análisis de escena, generación o generación de combate. Si el jugador expande el cuadro a mano durante una solicitud, permanece abierto hasta que termine la solicitud. Como las interfaces 1.11 y 1.12, esta es flexible: el campo se respeta con independencia del `capabilityApi` declarado, y la etiqueta 1.13 indica cuándo apareció, por lo que un paquete que lo necesite declara 1.13.

### Capability API 1.14: superficies de seguimiento y ciclo de vida de agentes

Capability API 1.14 añade dos valores de `contributions.slots` para paquetes de agentes Roleplay activos y habilitados con punto de entrada del cliente:

- `roleplay-tracker` monta la vista `toolbar` del paquete en el HUD de Roleplay. Sus propiedades incluyen `chatId`, `chatMode`, `mobileCompact`, `toolbarButtonClass` del host, `onRerunTracker`, `trackerRetryBusy`, `lockMode` y `onToggleLockMode`. Las funciones de retorno son opcionales: comprueba que existan antes de usarlas.
- `tracker-panel` monta la vista `tracker` dentro del Tracker Panel existente, con `chatId`, `chatMode` y `detached`. Reutiliza esa superficie en vez de abrir otro panel. Ambos espacios reciben también las propiedades habituales de identidad y localización de capacidades.

Las contribuciones de contexto del prompt siguen registrándose con `api.registerPromptContext` y requieren `prompt-context`. La solicitud ahora expone `targetCharacterIds`, `personaId` y `placedAgentTypes`, opcional por compatibilidad. Este último indica qué secciones de datos de agentes ya colocó el preset para evitar duplicaciones. El host conserva la identidad del paquete de cada contribución en `packageBlocks` para colocar su texto en la sección de agente correspondiente. El texto específico para una audiencia debe respetar los IDs de personajes destinatarios recibidos.

Un punto de entrada del servidor también puede registrar su servicio de ciclo de vida de posprocesamiento mediante `api.registerService("agent-runtime:<package-id>", service)`. Requiere `agent-runtime`; se rechaza registrar otro ID de paquete. Los hooks opcionales son:

```ts
const cleanup = api.registerService(`agent-runtime:${packageId}`, {
  prepareContext({ agent, context }) {
    // Return small, JSON-serializable context for this agent, or nothing.
    return { chatId: context.chatId };
  },
  finalizeResult({ agent, context, preparedContext, result }) {
    // Validate or enrich the result before the host publishes/applies it.
    return result;
  },
});
// Return cleanup from activate(), or include it in the activation cleanup.
```

`prepareContext` se ejecuta antes del posprocesamiento; su resultado no nulo pertenece al agente y se incluye en su prompt como contexto de ejecución serializado. `finalizeResult` recibe ese valor y el resultado generado, y devuelve un `AgentResult`. La generación y los reintentos manuales esperan a la finalización para publicar el resultado. Cada hook asíncrono tiene dos segundos: una preparación fallida se registra y se omite; una finalización fallida convierte el resultado en fallo, sin aplicar salida no validada. Son hooks breves del host, no un lugar para otra llamada lenta al modelo.

Estas adiciones no tienen un control de versión 1.14 por campo. El paquete puede detectar propiedades opcionales y funcionar con prestaciones reducidas en motores antiguos; si necesita estas superficies, colocación o ciclo de vida, debe declarar `capabilityApi: { major: 1, minor: 14 }` en su manifiesto v2 para que un motor anterior rechace limpiamente la instalación.

### Capability API 1.15: configuración actual de embeddings

`api.runtime.resolveEmbeddings()` devuelve un `Promise<CapabilityEmbeddingHost>` nuevo con la configuración actual de conexión del agente del paquete. Llámalo al iniciar cada operación de embeddings, en vez de guardar `api.runtime.embeddings`, que es la instantánea de activación y no sigue cambios posteriores de conexión sin reactivarse.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const vectors = await embeddings.embed(texts, signal);
// Store/compare embeddings.spaceId with persisted vectors; do not mix embedding spaces.
```

El host devuelto tiene `spaceId`, `label` y `embed(texts, signal?)`. Usa la fuente de embeddings configurada y recurre al generador local MiniLM integrado si no hay ninguna disponible o falla la resolución de la configuración. `embed` puede devolver `null`; se rechazan lotes vacíos, más de 128 textos o más de 200.000 caracteres combinados. Un host nuevo no recalcula vectores existentes: el paquete debe gestionar los cambios de `spaceId` antes de comparar vectores nuevos y guardados.

El método está disponible en los motores actuales independientemente de la versión API declarada. Declara API 1.15 si necesitas seguir los cambios de conexión. Para admitir motores anteriores, puedes comprobar `typeof api.runtime.resolveEmbeddings === "function"` y recurrir a `api.runtime.embeddings`, aceptando su limitación a la activación.

### Capability API 1.16: verbos del Game Master declarados por paquetes

Capability API 1.16 permite a un paquete Experience declarar una lista breve y cerrada de acciones con nombre del Game Master, llamadas verbos. El motor las representa en el recordatorio de formato del GM, las extrae de la narración terminada y las ejecuta en nombre del paquete. No se ejecuta código de servidor del paquete: una Experience `game-surface` con solo puntos de entrada `agents` y `client` puede hacer que el GM cambie su mundo mediante la prosa.

La integración está completa: esquema, nombres reservados y propiedad de claves, lectura de tabla, representación del prompt y ejecutor. Si el paquete aporta una tabla y tiene `chat-write`, sus verbos aparecen en el recordatorio de cada turno Game del chat vinculado y se ejecutan cuando el GM los usa. Sin paquete vinculado, o si no declara tabla, se resuelven cero verbos y el turno es idéntico byte por byte al anterior a esta integración.

Declara la tabla como `gm-verbs.json`, incluida en `contributions.assets.paths` y fijada por hash en `files[]`, como cualquier recurso. Se descubre por ese nombre reservado, una convención nueva: los demás archivos se leen por una ruta declarada (`entrypoints`, iconos, recursos), y nada más se descubre por su forma. Un archivo incluido en `files[]` pero omitido de `contributions.assets.paths` no genera diagnósticos al instalar ni construir el catálogo: sencillamente no hay verbos. El recurso declarado se sirve sin protección en `/api/capability-packages/<id>/assets/gm-verbs.json`, pues esa ruta no comprueba acceso privilegiado; la tabla nunca debe contener información sensible. Como 1.11–1.13, es una integración opcional: los motores anteriores ven un recurso JSON ordinario y lo ignoran. Puedes incluirlo sin restringir versiones; declara `capabilityApi` 1.16 solo si el paquete necesita los verbos, pues excluye todos los motores anteriores.

El documento es `{ "schemaVersion": 1, "verbs": [ … ] }`, con 1–16 verbos. Cada verbo es estricto: una clave desconocida se rechaza. Los campos desconocidos junto a `schemaVersion` y `verbs` reciben deliberadamente otro tratamiento: el motor los elimina y conserva los verbos que entiende de una tabla más reciente, mientras el esquema compartido de autoría es estricto y los rechaza. La validación durante la autoría es, por tanto, más estricta que la lectura en ejecución:

```json
{
  "schemaVersion": 1,
  "verbs": [
    {
      "name": "weather",
      "description": "Set the sky when the weather visibly changes.",
      "effect": "state",
      "metadataKey": "pixelforgeWeather",
      "args": [
        { "name": "word", "type": "string", "enum": ["fair", "overcast", "rain", "storm", "snow"] },
        { "name": "intensity", "type": "string", "enum": ["light", "heavy"], "optional": true }
      ]
    }
  ]
}
```

Un nombre de verbo sigue `[a-z][a-z0-9_]*`, tiene como máximo 32 caracteres y no puede coincidir con etiquetas entre corchetes del GM del motor. La comprobación ignora mayúsculas: el recordatorio escribe `[Note:` y `[Book:`, pero la expresión de análisis no distingue el caso; `note` ocultaría la etiqueta del diario. El conjunto reservado procede de todas las etiquetas que pueden representar los recordatorios de GM y grupo en cualquiera de sus ramas y de los cinco analizadores de narración: el analizador de etiquetas y formateador del cliente, el editor de segmentos del servidor, el analizador de escenas del sidecar y el reescritor de diálogo de la ruta de generación. Su vocabulario incluye además `main`, `side`, `extra`, `action`, `thought`, `whisper` y el par `qte_bonus` / `qte_result`, que solo reconoce el formateador. Un verbo `whisper` haría desaparecer `[whisper:Tam]` de una línea de diálogo antes de guardarla y esta dejaría de ser diálogo permanentemente.

Las pruebas de regresión fijan también los extractores: cada analizador que aporta nombres exclusivos, como `party-chat` / `party-turn` o el par QTE, debe seguir aportándolos. Si una fuente deja de analizarse, falla la compilación en vez de reducir silenciosamente el conjunto. Los otros tres también se recorren para detectar etiquetas nuevas. Esto no garantiza exhaustividad: una etiqueta en un archivo no examinado o escrita de una forma que el extractor no entienda puede escapar; amplía el conjunto cuando aparezca un analizador nuevo. También se reservan palabras comunes como `action`, `state`, `status` y `note`; su rechazo suele deberse a esta regla, no a un error tipográfico.

`description` ocupa una línea de 1–200 caracteres sin corchetes ni saltos, porque se inserta literalmente en `COMMANDS:`. Además de CR y LF, se prohíben `U+0085`, `U+2028`, `U+2029`, los controles C0 y DEL, incluida la tabulación, que deforman el bloque. Sin embargo, después se expanden las macros de todo el recordatorio: `{{…}}` dentro de la descripción se expande, incluso `{{setvar::…}}`, que escribe variables de chat. No concede más acceso que `chat-write`, pero evita esas llaves salvo que sea intencionado. Un verbo admite hasta seis argumentos `{ name, type, enum?, maxLength?, optional? }`, con nombres `[a-z][a-zA-Z0-9_]*` de hasta 32 caracteres. A diferencia del verbo, admiten mayúsculas porque son claves JSON, no etiquetas. Solo las cadenas admiten `enum` con 1–16 valores distintos; los duplicados se rechazan. Una cadena sin enumeración debe declarar `maxLength` de 1–500, pues el análisis acotado del ejecutor no hereda otro límite y podría admitir toda la narración. Declarar `enum` y `maxLength` juntos se rechaza: la enumeración ya limita el valor. La carga es JSON plano de una línea; un `}` anidado cierra la coincidencia antes de tiempo. Solo se analiza una instancia de cada nombre por mensaje, por lo que un verbo repetido se aplica una vez.

No necesitas explicar los argumentos en la descripción. La tabla analizada genera un esquema de carga, la descripción y un ejemplo que se puede copiar:

```
- [weather:{"word":"fair|overcast|rain|storm|snow","intensity"?:"light|heavy"}] — Set the sky when the weather visibly changes. Example: [weather:{"word":"fair"}]
```

El esquema enseña el vocabulario: argumentos en orden, opcionales marcados con `"name"?:` fuera de la cadena JSON, enumeraciones completas, el límite de cadenas libres y números o booleanos sin comillas. El validador rechaza `"3"` como número en vez de convertirlo. El ejemplo solo puede mostrar un valor de la enumeración; si el GM solo ve `{"word":"fair"}`, puede escribir "sunny", que se rechaza sin aviso visible. La etiqueta se elimina al coincidir el nombre, no al validarse: la narración queda limpia, pero el mundo no cambia. Derivar esquema y ejemplo de la misma tabla evita divergencias; los valores ya no se definen en una descripción que podría prometer algo inválido. Usa sus 200 caracteres para explicar cuándo actuar, no para repetir argumentos.

La degradación es por verbo. Un `effect` más reciente, una forma no representable, un nombre reservado o una clave ajena se omiten con una línea de registro; los demás siguen funcionando, como en `parseCapabilityCatalogWithCompat`. Si un verbo no aparece, consulta el registro. Un documento inutilizable, con `schemaVersion` desconocido, `verbs` vacío o raíz que no sea objeto, produce una tabla vacía y una línea de registro. Se rechaza también antes de leerlo si el tamaño declarado `files[].bytes` supera 64 KB; `files[]` permite hasta 100 MB y nada más limita un recurso antes de leerlo. Ante cualquier fallo, el turno sobrevive sin cambios.

Un verbo con `metadataKey` es un **verbo de estado**: escribe todos sus argumentos bajo esa clave en los metadatos del chat; el paquete ve el cambio mediante sus propiedades habituales. Sin `metadataKey`, es un **verbo de evento**, entregado en vivo como evento de cliente de capacidad, sin escritura duradera, cola, reproducción ni confirmación. Un evento rechaza `metadataKey`, para no apropiarse de una clave que no escribe; el estado la exige.

El estado es duradero y nunca revierte: cambiar de variante, editar o borrar el turno conserva el valor. Gana la última variante generada, no la última mostrada; prosa y mundo pueden discrepar sin conciliación. Un evento no recuerda nada: un fotograma, un envío síncrono. Se pierde silenciosamente si se aborta el turno, se cierra o recarga la pestaña durante la transmisión, llega antes del primer montaje del paquete, el jugador cambia de chat o está activa la pantalla de carga del paquete. No se reenvía. A cambio, su efecto puede revertir con la historia si el paquete lo guarda donde la reconstrucción al retroceder lo restaura; los metadatos de chat no retroceden. Un evento aplicado al estado vivo y perdido en una recarga forzada antes del siguiente guardado no deja rastro en ninguno de los casos.

Se prohíbe por diseño la semántica relativa en ambos tipos. El estado sobrescribe valores absolutos y no puede expresar "añadir cinco monedas". Un evento relativo también está prohibido: regenerar crea un índice de variante nuevo sin conservar las marcas de la anterior, por lo que acumularía una vez por variante generada. La deduplicación por `chatId:messageId:swipeIndex` evita reenvíos, que este canal no hace, pero no regeneraciones, que sí hace. Los valores absolutos, no un registro de transacciones, permiten aplicar un verbo dos veces sin problemas. Convierte cualquier vocabulario relativo en valores absolutos por mensaje.

Si un turno contiene ambos tipos, el evento síncrono llega antes de que termine la recarga asíncrona del estado. Su manejador no debe leer el efecto de un verbo de estado del mismo turno esperando el valor nuevo.

El motor solo valida forma: nombres y tipos de argumentos, pertenencia a enumeraciones y límites de cadenas. La semántica pertenece al paquete: no se pueden enumerar personajes al declarar un mundo compilado por chat. El rechazo del paquete a un verbo de estado es solo orientativo, pues los metadatos ya están guardados al recibirlo. Para un evento es vinculante: el motor no guardó nada y el paquete puede rechazar realmente un nombre desconocido.

`metadataKey` debe pertenecer al paquete según tres reglas: comienza con su ID normalizado a camelCase (`hierarchical-maps` → `hierarchicalMaps`), continúa con un sufijo no vacío que empieza en mayúscula, y el ID normalizado no puede ser un espacio de nombres del motor ni extenderlo a partir de una mayúscula. Así un paquete no se apropia del prefijo de otro. La lista del motor deriva de todas las claves superiores de `ChatMetadata`, sus constantes de claves y claves presentes solo en la firma de índice, como `encounterActive`, `internalAssistant` e `imageGenConnectionId`, invisibles para las dos primeras fuentes.

Ese tercer grupo requiere siete fuentes: los objetos de `patchMetadata`/`updateMetadata`; los objetos devueltos por callbacks de actualización, de frecuencia similar; la mutación `useUpdateChatMetadata()` y la propiedad `onMetadataChange` del cliente; las llamadas directas `PATCH /chats/:id/metadata`, usadas para claves de combate, escena y narración sin pasar por el hook; las lecturas `chatMetadata.key` y `chat.metadata.key`; las lecturas del resultado de `parseChatMetadata(…)`, la forma más común y la única que detecta `scenario`; y la lista manual de claves por chat para perfiles de ajustes, que cubre claves leídas y escritas a través de límites entre funciones.

Las regresiones fijan todas las fuentes y extractores. Hay dos límites deliberados. Las escrituras con una variable o resultado de función, como `patchMetadata(id, hydratedMeta)` o su equivalente en la ruta de metadatos, contienen claves que un barrido estático no puede leer: hay veinte y la prueba fija esa cifra; una vigesimoprimera exige revisión manual. Las lecturas dentro de una función auxiliar desde un parámetro también quedan fuera: ocurre con `spatialContext`, escrito por el cliente de `hierarchical-maps` distribuido desde Agents y leído aquí mediante un auxiliar y análisis local al archivo. La lista manual cubre ese segundo hueco; por eso una de las siete fuentes es seleccionada a mano. Se reconocen los límites en vez de afirmar que no existen. `persona` es además un mínimo añadido a mano que hoy no produce ninguna fuente.

La tercera regla rechaza paquetes enteros deliberadamente: `conversation-calls` se convierte en `conversationCalls`, y `conversationCalls` + `Enabled` ya es una clave del motor. Ese paquete no puede poseer claves bajo su ID; tampoco `noodle` ni `background`, que ya es una clave de metadatos por sí misma. Sí pueden declarar eventos, que no poseen claves. Las claves son planas y superiores porque esa es la forma que ya lee el reconciliador del paquete.

Los comandos del modelo declarados por un paquete solo se ejecutan si el paquete declara `chat-write`, está instalado y está listo. Este permiso también controla las escrituras mediante la API de persistencia del paquete, incluidos mensajes, metadatos del chat, eventos de roleplay e instantáneas espaciales. `chat-read` controla las lecturas de chats, mensajes, estado del juego e instantáneas espaciales. Las mismas comprobaciones se aplican dentro de las transacciones de persistencia y los bloqueos del chat; el permiso de escritura no concede implícitamente permiso de lectura. Las llamadas de persistencia del propio motor siguen siendo de confianza.

La vista de detalles de **Download Agents** (descargar agentes) muestra los permisos declarados por la versión instalada después de la instalación. Si la versión del catálogo solicita permisos diferentes, los muestra por separado. Instalar o actualizar código sigue requiriendo la aprobación existente vinculada a esa versión y suma de comprobación exactas; los comandos del modelo no solicitan una aprobación independiente en cada turno.

Son comprobaciones de la API, no un entorno aislado de JavaScript. Los permisos de red, almacenamiento e interfaz son declaraciones de acceso. El código del paquete en el navegador y el servidor sigue siendo código de confianza y puede acceder al entorno del host; instala solo paquetes en los que confíes. Se comprueba que el paquete esté listo, no solo que pueda servirse, por lo que una actualización que lo deje en `restart-required` impide resolver sus comandos hasta que se reinicie el motor.

### Capability API 1.17: preparar una Experience antes de su primer turno

Un paquete `game-surface` puede declarar `contributions.gameSurface.prepareBeforeStart: true` con la versión 2 del esquema y Capability API 1.17. Engine monta esa superficie cuando el juego está listo, antes de habilitar **Start Game** (Iniciar juego). Los juegos clásicos y los paquetes sin esta marca conservan su flujo de inicio actual.

La superficie principal que activa esta opción recibe dos propiedades adicionales:

- `startup: boolean` permanece en true hasta que el jugador termina la introducción de Engine con **Continue** (Continuar). Pausa la simulación del mundo y las acciones del jugador mientras sea true.
- `setStartupReady(context: string | null): void` comunica el estado de preparación. Envía `null` mientras cargas, guardas o te recuperas de un fallo. Envía una cadena solo cuando el mundo real esté guardado de forma persistente y se pueda usar; una cadena vacía permite iniciar sin contexto adicional.

El host bloquea **Start Game**, su confirmación de preparación de widgets y los reintentos del turno inicial hasta recibir una cadena de disponibilidad. Durante el bloqueo, la interfaz de carga y de error/reintento del propio paquete sigue visible. Cuando está listo, el paquete se oculta detrás de la introducción normal de Engine. **Continue** abre la superficie habitual, que puede montarse de nuevo: haz que la preparación del mundo sea idempotente y restaura el estado guardado en lugar de generarlo otra vez. Volver a un juego cuya introducción ya terminó no repite la preparación inicial.

El contexto de apertura tiene un límite de **8 000 caracteres**. Un contexto no válido o demasiado largo mantiene bloqueado el inicio y muestra un error; el host no recorta los hechos del mundo. Proporciona una descripción compacta de la ubicación inicial preparada y de los personajes realmente presentes. Engine añade este texto a su `generationGuide` existente del primer turno con el origen `game_start`, para que la apertura use el mundo que existe. Esto no registra contexto para turnos posteriores; sigue usando la contribución normal del paquete al prompt o su contexto de generación de turnos.

Las funciones de retorno de disponibilidad pertenecen al chat, al juego y al paquete montados. Las llamadas tardías de otro ámbito se ignoran. Un fallo del módulo o del entorno de ejecución bloquea el inicio en vez de tratar la ausencia de contexto del mundo como un éxito. Tras una recarga, el paquete debe comunicar su disponibilidad a partir del mundo guardado. El proveedor de contexto del prompt en el servidor sigue siendo de solo lectura y conserva su plazo breve; no lo uses para generar el mundo ni como barrera de inicio prolongada.

### Capability API 1.19: herramientas aportadas por paquetes

Capability API 1.16 permitía que un paquete hiciera que el modelo _dijera_ algo sobre lo que pudiera actuar. Esta versión permite que el modelo _llame_ a algo. Un paquete con el nuevo permiso `tools` registra una herramienta con nombre desde su punto de entrada del servidor. Engine la ofrece junto a las herramientas integradas en cada turno de cada chat, valida la llamada con el JSON Schema del paquete y entrega los argumentos a su manejador.

```ts
export async function activate({ api }) {
  api.registerTool({
    name: "set_time",
    description: "Move the world clock forward or back.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["advance", "rewind"] },
        minutes: { type: "integer", minimum: 0 },
      },
      required: ["action", "minutes"],
      additionalProperties: false,
    },
    handler: async (args, { chatId }) => {
      const clock = await moveClock(chatId, args.action, args.minutes);
      return { time: clock.label };
    },
  });
}
```

Se usan llamadas a herramientas en lugar de un formato de respuesta de forma deliberada. Un formato ocupa toda la respuesta: la narración tendría que ser un campo de un objeto JSON y no podría transmitirse progresivamente. Una llamada puede llegar junto al texto mientras el modelo escribe su turno. El paquete recibe argumentos que el proveedor ya restringió, en vez de extraerlos de la narración terminada: un esquema impone reglas, mientras que una convención solo le pide al modelo que las respete.

Los valores enumerados muestran la diferencia. Si un paquete conoce doce lugares, puede incluir esos doce nombres en el esquema. Un nombre decimotercero se rechaza antes de llegar al manejador. La validación de argumentos existente de Engine indica los valores válidos para que el modelo corrija la llamada. Lo que devuelve el manejador se muestra al modelo como resultado de la herramienta.

Antes de escribir una herramienta, ten en cuenta estas reglas:

- Los nombres usan `<packageId>_<name>`, reemplazando `-` por `_`: `set_time` de `world-clock` llega al modelo como `world_clock_set_time`. Se rechaza un nombre que ya pertenece a otro paquete. Las herramientas integradas y las herramientas personalizadas habilitadas conservan los nombres en conflicto; se omite la definición del paquete. El nombre completo tiene un máximo de **64 caracteres**. Tanto las definiciones como la ejecución siguen este orden: integrada, personalizada, paquete.
- Las herramientas se adjuntan mientras el paquete esté activo. No hay un segundo interruptor por chat como para las herramientas integradas: el permiso y el registro son la decisión. El proveedor seleccionado debe admitir llamadas nativas a herramientas.
- El esquema de parámetros se copia y compila al registrarse. Si Engine no puede compilarlo, falla la activación, donde puedes ver el problema durante el desarrollo, en vez de fallar a mitad del turno.
- Si el manejador lanza un error, la llamada se marca como fallida y se registra; su mensaje no se reenvía. Si no termina en **10 segundos**, el turno deja de esperar. El manejador sigue ejecutándose, pero no puede bloquear todo el turno.
- Los resultados deben poder serializarse en un máximo de **64 KiB**. Los resultados mayores o no serializables hacen fallar la llamada en vez de desplazar la conversación. Las descripciones y los resultados son contenido de confianza del paquete. Comprueba `chatId` antes de leer o cambiar datos de un chat.
- Cada definición se serializa en la solicitud al proveedor de cada turno y cuenta para el ajuste del contexto. Los límites son **16 herramientas por paquete**, **64 entre todos los paquetes**, **512 caracteres** por descripción y **8 KiB** por esquema de parámetros. Superarlos lanza un error que impide la activación. Registrar de nuevo un nombre propio reemplaza esa herramienta sin consumir otro espacio.
- El contexto de activación deja de funcionar cuando se desmonta. Si un paquete conserva `api` y llama a `registerTool` desde una devolución de llamada posterior, se rechaza: un entorno terminado no puede registrar herramientas ni reemplazar las de una nueva activación.
- Desactivar, actualizar o eliminar un paquete libera sus herramientas. El modelo no recibe herramientas de un paquete que ya no puede responder. Se eliminan antes de esperar la limpieza; cada devolución de llamada de limpieza tiene un plazo de 8 segundos.

Estos plazos solo limitan la espera asíncrona. Los paquetes se ejecutan como código de confianza en el proceso del servidor; un temporizador no puede interrumpir el trabajo síncrono que bloquea el bucle de eventos. La cancelación forzosa requeriría un worker o proceso separado, que esta API no proporciona.

`api.registerTool` solo existe a partir de esta versión de Engine. Un paquete que lo necesite debe declarar `capabilityApi` 1.19 y no se instalará en versiones anteriores.

## Declaraciones de decisión y el modelo de decisión

El **Decision model** (Modelo de decisión) del usuario responde declaraciones de sí/no y de opciones sobre el chat reciente. Consulta [Modelos de decisión](../connections/decision-models.md) para saber qué es y cómo configurarlo.

Una plantilla de prompt de agente incluida en un paquete puede usar `{{#if decision:"..."}}` y `{{#if decision_choice:"..." == "..."}}` igual que un agente personalizado. El motor las detecta y pregunta antes de ejecutar el agente (después de la respuesta, si es de posprocesamiento), y resuelve la plantilla con las respuestas. No interviene ninguna versión de la API de capacidades. Consulta la sintaxis y redacción en [Prompts condicionales](../prompts/conditional-prompts.md#asking-the-decision-model) y las fases en [Crear agentes personalizados](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

El código de ejecución del paquete todavía no puede consultar directamente el modelo de decisión. Hace falta un método de la API de capacidades con su propio aumento de versión.

Diseña cada uso para quien no tenga modelo de decisión. Una declaración sin respuesta se interpreta como no: la rama `{{else}}`, o nada, debe ser un valor predeterminado sensato. Escribe para un modelo de decisión en general, sin exigir Jev: los modelos de chat locales y otros backends compatibles usan la misma sintaxis, pero pueden responder distinto. Consulta [Umbrales](../connections/decision-models.md#thresholds) y [Límites y coste](../prompts/conditional-prompts.md#limits-and-cost) antes de depender de una puntuación, cantidad de solicitudes o respuesta en caché concreta.

### Nota para desarrolladores de Experiences de Game Mode

El combate del motor decide por sí solo qué hacen los enemigos ordinarios. Cada enemigo no jefe del GM recibe un rol por sus habilidades y clase (bruiser, bulwark, skirmisher, marksman, spellcaster, supporter o controller), competencia por su nivel salvo que la declare (novice, trained, veteran o master) y temperamento, como reckless, cautious, opportunistic o protective. Las bestias y monstruosidades siempre son mindless. El código los elige a partir de una semilla sin llamar al modelo; la dificultad cambia la constancia con que actúan según su tipo. Solo los jefes creados expresamente reciben órdenes del GM mediante una llamada al modelo. Consulta [IA de combate de Game Mode](game-combat-ai-design.md).

Se preparan más mejoras de combate. Antes de introducir decisiones, comprueba si el combate normal del motor ya cubre lo necesario. Para una personalidad concreta, asigna primero competencia y temperamento adecuados. Una decisión por turno enemigo añadiría trabajo del modelo y un plazo; un backend alojado añadiría solicitudes de red y cargos. La lucha dependería de un modelo que el usuario quizá no haya configurado y necesitaría un comportamiento sensato sin respuesta.

## Paquetes iniciales

- todos los agentes integrados actuales;
- mapas espaciales jerárquicos para Roleplay y Game;
- llamadas de audio y video de Conversation;
- UNO;
- Chess;
- Poker;
- 8-Ball Pool;
- Tic-Tac-Toe;
- Rock-Paper-Scissors.

La base conserva el gestor de paquetes, el cliente del catálogo, los contratos genéricos del pipeline de agentes, los contratos genéricos del host de juegos por turnos y las interfaces de host inertes. Las implementaciones concretas pertenecen a los paquetes.

## Confianza e instalación

El catálogo oficial es un documento JSON con versión y validado por esquema, obtenido por HTTPS. Cada entrada de versión incluye URLs de artefactos inmutables, resúmenes SHA-256, tamaños en bytes, compatibilidad con el motor, permisos y si su tiempo de ejecución requiere reinicio.

Al iniciar el servidor, el host obtiene el catálogo una vez cuando hay al menos un paquete oficial instalado, selecciona solo las versiones más nuevas compatibles con el Engine y la API de capacidades en ejecución, las verifica mediante el pipeline de instalación normal y las instala antes de que se activen los tiempos de ejecución de los paquetes. Los fallos se aíslan por paquete. Los archivos existentes y el estado del registro siguen siendo utilizables cuando el catálogo está fuera de línea o la verificación falla, y los fallos de disponibilidad del tiempo de ejecución del servidor usan la ruta de reversión a la versión anterior.

El instalador debe:

1. exigir acceso privilegiado de loopback/administrador;
2. imponer HTTPS, límites de descarga y tiempos de espera;
3. verificar la confianza del catálogo y el SHA-256 del artefacto antes de la extracción;
4. rechazar rutas absolutas, traversal, enlaces, archivos de dispositivo y archivos no declarados;
5. validar el manifiesto y la compatibilidad con el motor;
6. extraer en una carpeta hermana temporal;
7. activar de forma atómica solo después de que la validación tenga éxito;
8. conservar la versión anterior hasta que el nuevo tiempo de ejecución arranque correctamente;
9. revertir la activación en caso de fallo;
10. nunca ejecutar scripts de instalación, actualización o desinstalación.

Solo los paquetes ejecutables de confianza de primera parte quedan habilitados por el catálogo oficial. Un futuro flujo de terceros requiere un diseño de confianza explícito aparte.

## Comportamiento en tiempo de ejecución y reinicio

El servidor es dueño del registro de paquetes instalados y expone las capacidades instaladas a los clientes. Los módulos declarativos y recargables se activan de inmediato. La interfaz invalida las consultas de catálogo, agente, capacidad de modo y chat activo después de la activación.

El manifiesto puede declarar `restartRequired` solo cuando el host no puede recargar ese punto de entrada de forma segura. La activación en caliente exitosa dice `Agent installed. It is ready to use.` La activación que requiere reinicio dice `Agent installed. Restart Marinara Engine to finish setup.`

Los paquetes de juegos por turnos son recargables en caliente: la instalación registra de inmediato su motor de servidor y su lanzador manual por comando slash, y la desinstalación desacopla el tiempo de ejecución sin reiniciar el Engine. Los ajustes de Conversation Commands por chat solo controlan si los personajes pueden emitir el comando oculto del paquete; no limitan el lanzador slash del usuario. Los manifiestos oficiales actuales de juegos por turnos conservan su marcador conservador de reinicio heredado para compatibilidad con el Engine 2.x; el Engine 3.x reconoce el tipo `turn-game`, realiza la activación en caliente segura y devuelve el paquete como activo y listo.

## Migración de compatibilidad

En el primer arranque tras la actualización:

- los agentes personalizados quedan intactos;
- cada agente integrado heredado visible para esa instalación se registra como instalado;
- los mapas, las llamadas de Conversation y los juegos de Conversation conservan su disponibilidad anterior;
- la configuración por chat existente, las instantáneas, el estado del juego, el historial de llamadas y la memoria de agente permanecen en su lugar;
- la migración es idempotente y registra su finalización solo después de que todas las entradas de disponibilidad heredadas sean duraderas.

Los artefactos de paquetes heredados siguen disponibles en el catálogo oficial como fuentes de migración. Las instalaciones nuevas no los exponen ni los activan hasta que el usuario los instala.

## Desinstalación

La desinstalación quita el paquete de las selecciones del chat activo, elimina su configuración de agente y los archivos ejecutables descargados, y desacopla su tiempo de ejecución en el reinicio cuando es necesario. Los chats históricos, los mensajes, las instantáneas de mapa, los resúmenes de llamadas y los registros de juegos completados siguen siendo legibles, para que quitar un paquete no pueda destruir el trabajo del usuario. La eliminación destructiva de datos de dominio históricos es una acción de usuario aparte y explícita.

Toda desinstalación requiere confirmación. Los chats afectados vuelven a sus superficies base ordinarias sin corromper el historial.

## Interfaz del catálogo

El panel de Agents contiene un control `Download Agents` que coincide con la función `Download Cards` del Card Browser. Abre una biblioteca responsiva a pantalla completa con búsqueda, tipos de paquete, información de compatibilidad, estado de instalación/actualización, permisos, costo de almacenamiento, documentación y controles de desinstalación.

En escritorio se usa una lista de exploración con una región de detalle adyacente. En móvil se usa un solo panel con navegación de retroceso explícita y acciones de tamaño táctil. Los estados vacío, fuera de línea, incompatible, descarga corrupta, instalación interrumpida, actualización, reversión y requiere-reinicio son de primera clase.

## Puerta de extracción

Una extracción está completa solo cuando los paquetes base de producción del cliente y del servidor ya no contienen la implementación del paquete, una instalación nueva no puede activarlo sin descargar el paquete, una instalación actualizada lo conserva, y la instalación/actualización/desinstalación del paquete pasa en sistemas de archivos de escritorio, móvil y compatibles con Termux.

### Capability API 1.20: conjuntos de reglas de Game Mode

Un conjunto aporta datos validados: resolución de pruebas compatible con Engine, una ficha de elementos predefinidos, descansos y orientación para el GM. El recurso reservado `ruleset.json` se descubre como `gm-verbs.json`: mediante `contributions.assets.paths` y un hash en `files[]`.

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 20 },
  "id": "ruleset-5e-2014",
  "kind": ["ruleset"],
  "permissions": [],
  "entrypoints": {},
  "contributions": { "assets": { "paths": ["ruleset.json"] } },
  "files": [{ "path": "ruleset.json", "sha256": "<sha256 of the file>", "bytes": 25767 }]
}
```

El ejemplo solo muestra campos del conjunto. Siguen siendo obligatorios `name`, `version`, `description`, `engine` y `builtAgainst`. No hacen falta permisos, agente ni puntos de entrada de cliente o servidor. El tipo `ruleset` y `ruleset.json` se requieren mutuamente. No se ejecuta código ni expresiones de texto; una mecánica nueva requiere cambios en Engine. Consulta formato y ejemplo 5e en [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md).

Es un límite estricto de compatibilidad: el manifiesto debe declarar API 1.20 o un Engine anterior rechazará la instalación. Engine rechaza tamaños declarados superiores a 256 KB antes de leer, comprueba de nuevo el hash instalado y valida con `packages/shared/src/schemas/ruleset.schema.ts`. Un archivo inválido se omite con una entrada de registro que identifica paquete y primeros errores `path: message`. Ante IDs duplicados gana el primer paquete en orden de ID de paquete; el otro se omite con registro. `engine-legacy` y `traditional` están reservados.

La selección se guarda una vez en `chat.metadata.gameRuleset`. Sin selección se usan las reglas anteriores. Un paquete ausente o una definición antigua queda no disponible, sin sustitución automática. El vínculo comprueba ID del conjunto y paquete proveedor para impedir que otro paquete se apropie de la partida repitiendo el ID.

### Capability API 1.21: catálogos de conjuntos

Los catálogos ofrecen conjuros, capacidades de clase y equipo para el selector de la ficha. El encabezado está en `ruleset.json` bajo `catalogs`; las entradas pueden ser internas o un recurso reservado:

```json
{
  "capabilityApi": { "major": 1, "minor": 21 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } },
  "files": [
    { "path": "ruleset.json", "sha256": "<sha256>", "bytes": 25767 },
    { "path": "catalogs/spells.json", "sha256": "<sha256>", "bytes": 418204 }
  ]
}
```

`catalogs/<id>.json` debe coincidir con el ID del catálogo, no con otro. Lleva hash en `files[]` y requiere el `ruleset.json` que lo declara. Se rechazan tamaños declarados superiores a 1 MB antes de leer. Entradas internas y externas se validan contra la misma ficha. Límites: 12 catálogos por conjunto y 2000 entradas por catálogo.

El cliente carga contenido al abrir el selector mediante `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`. La lista instalada solo incluye recuentos. El texto del catálogo no entra automáticamente en el prompt: el GM solo ve lo seleccionado por `gm.sheetSummary`. Los recursos requieren API 1.21; el instalador comprueba también `catalogs` dentro de `ruleset.json` verificado. Un esquema estricto anterior rechazaría el archivo entero. No necesita permisos.

### Capability API 1.22: bloque battle

`battle` puede nombrar salud, MP opcional, reservas de espacios y listas cuyas filas de catálogo se convierten en `CombatSkill`. Al terminar, devuelve valores con las mismas operaciones de ficha que usan los controles del jugador.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Es un enlace de datos al combate de Engine, no un adaptador completo de reglas de mesa. El daño sigue siendo integrado; no se leen `attackRoll`, `save`, `concentration` ni `perCostStep`. Las reglas exactas corresponden a otra integración con adaptadores. `coverage.combat` conserva su significado independiente y no lo lee este enlace. El instalador inspecciona `ruleset.json` verificado y rechaza `battle` por debajo de API 1.22, igual que `catalogs` por debajo de 1.21. Sin permisos ni cambios para conjuntos sin ese bloque.

### Capability API 1.23: valores de catálogo escalados

`scaled` permite mantener hasta cuatro columnas numéricas propias de una fila. Usa referencias de valores existentes y una tabla de umbrales opcional, por ejemplo recursos por nivel o usos por atributo, sin nueva aritmética.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

Se recalcula al editar, no al leer. Estado de partida, prompt del GM y combate leen el número guardado. Se admiten filas en `ruleset.json` o `catalogs/<id>.json`; el instalador verifica el contenido y rechaza `scaled` por debajo de API 1.23. Sin permisos ni cambios para catálogos no escalados.

`[sheet: op="use" name="..."]` paga `mechanics.cost` y un uso de cada reserva de fila creada por la entrada. No requiere declaración adicional porque usa catálogos ya compatibles.

### Capability API 1.24: reservas de dados

`resolution` puede usar `"kind": "dice-pool"` en lugar de `"dice-sum"`. El valor de ficha determina cuántos dados se tiran; se cuentan resultados que alcanzan el umbral. El conjunto puede definir éxitos dobles, explosiones, cancelaciones, pifias, éxitos excepcionales y límites de ajustes situacionales del GM.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Se conserva la ficha: el modificador de suma pasa a indicar cantidad de dados. No se añaden elementos de ficha, espacios de editor ni código del paquete. El instalador rechaza `dice-pool` en `ruleset.json` verificado por debajo de API 1.24; los motores anteriores con solo `dice-sum` rechazarían todo el archivo. Sin permisos ni cambios para conjuntos de sumas.

### Capability API 1.25: capas y orientación del mundo

`layers` ofrece variantes con nombre, elegidas al crear la partida y fijadas en su vínculo. El bloque base `gm` admite la cadena opcional `worldGuidance`; `gm.worldGuidance` se lee una sola vez al generar el mundo para adaptarlo a las reglas del grupo.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Los efectos permitidos añaden orientación después de la del conjunto, eliminan valores enumerados, reemplazan dificultades por una escala del mismo tipo de resolución y ocultan entradas de catálogo. No añaden elementos a la ficha; las existentes siguen legibles con cualquier capa. Sin código del paquete ni llamadas adicionales al modelo. Las capas de terceros quedan para más adelante. Ambos campos requieren API 1.25 tras verificar el contenido. Sin permisos ni cambios para conjuntos que no los usan.

### Capability API 1.30: heridas, gasto en pruebas y combate sobre un contador

Una entrada `live.tracks` puede declarar `levels` y `kinds` para pasar de entero acotado a CONTADOR DE HERIDAS: casillas con etiqueta y penalización propias sobre las que se colocan marcas. `levels` tiene 1–16 niveles, del mejor al peor, cada uno con `label` y `penalty` entero. `kinds` tiene 1–6 tipos de daño, cada uno con `id`, `label` breve y `severity` distinta. Van juntos: se rechaza `kinds` sin `levels`, pues no habría dónde marcar. `resolution.penaltyFrom` nombra el contador cuya penalización afecta a todas las tiradas: en `dice-pool` resta dados sin bajar de `pool.min`; en `dice-sum` es un modificador fijo.

El resto de 1.30 incluye estas adiciones; un paquete que use cualquiera debe declarar 1.30:

- `combat.health` puede nombrar un contador de heridas en vez de una reserva. `combat.damageKinds` indica qué marca cada tipo: `default`, un mapa `byType` opcional y `marks`, con `per-blow` para marcar una casilla por golpe acertado o `per-point` para contar niveles de salud según el daño tirado. `damageKinds` es obligatorio con heridas y se rechaza con reservas.
- `resolution.spend`, solo para `dice-pool`, define la reserva que se puede gastar en una prueba, el coste de cada pago, si compra `successes` o `dice` y `perCheck`, el máximo por tirada.
- `mechanics.check` en una entrada de catálogo define lo que hace en la prueba algo ELEGIDO por el personaje: `reroll` (`upTo` y `once` o `until`), `dice`, `successes` o `threshold`. También es exclusivo de reservas.

```json
{
  "capabilityApi": { "major": 1, "minor": 30 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

La longitud del contador son sus niveles: `min` debe ser 0 y `max`, `levels.length`. Un archivo que declare otra cosa se rechaza, no se corrige silenciosamente. `resolution.penaltyFrom` debe nombrar un contador de heridas; uno ordinario no aporta penalización.

No es una integración opcional, por el mismo motivo que 1.20–1.28: un motor que no entiende `levels`, `kinds`, `penaltyFrom`, `damageKinds`, `resolution.spend` o `mechanics.check` rechaza todo el archivo. La instalación lee los bytes verificados de `ruleset.json` y rechaza el paquete con una versión declarada menor. No cambia un conjunto con contadores numéricos, salud en reserva y sin gasto en pruebas.

### Capability API 1.29: qué permite un turno de combate del conjunto

Hay cinco adiciones opcionales al bloque `combat` y las entradas de catálogo usadas por el combate:

- Un golpe puede llevar hasta tres cantidades MÁS además de la primera. `mechanics.plus` de una entrada y `damage.plus` de una acción de criatura usan `{ dice?, flat?, type?, save?: { save,
difficulty?, onSuccess: "none" | "half" } }`: cada parte se tira y tipifica por separado, se duplica por crítico por separado y admite su propia salvación del objetivo. Todo el golpe conserva una sola prueba de concentración y una sola prueba para caer.
- `combat.attacks[].strikes` referencia un valor que indica cuántos ataques compra un gasto del presupuesto de esa lista. Los restantes quedan disponibles hasta terminar el turno; mientras quede alguno, todas las filas de la lista no cuestan presupuesto.
- `mechanics.free` no consume presupuesto; `mechanics.gives` lo devuelve solo para este turno, respetando el máximo de destino; `mechanics.standard` permite comprar acciones estándar con otro presupuesto. Una entrada `utility` con `gives` o `standard` se ofrece en vez de omitirse.
- El nuevo tipo `rider`, y los `riders` propios de una criatura, añaden una cláusula de daño al primer impacto válido de un turno o ronda, pasivamente y sin aparecer en el menú.
- La lista cerrada de efectos de estado añade `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source` y `cannot-approach-source`. Un estado puede restringir las salvaciones afectadas (`saves`), contar solo mientras su origen esté a la vista (`whileSourceInSight`) o terminar cuando caiga (`endsWhenSourceDown`).

```json
{
  "capabilityApi": { "major": 1, "minor": 29 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

No es una integración opcional, por el mismo motivo que 1.20–1.28: un motor que no entienda estas claves rechaza todo el conjunto o el catálogo que las contiene. La instalación lee los bytes verificados de `ruleset.json` y de cada `catalogs/<id>.json` declarado, y rechaza cualquiera con una versión declarada menor. Sin permisos nuevos ni cambios para conjuntos que no las declaran.

### Capability API 1.28: combate del conjunto sobre un tablero

El bloque `combat` puede definir cuánto vale una casilla en su propia distancia (`distance: { label, perCell }`); esto permite que el combate tenga posiciones. `ranged` define la penalización por disparar más allá del alcance normal o con un enemigo en la casilla contigua; `cover`, cuánto añade la cobertura a la defensa; `opportunity`, el presupuesto que paga un ataque a quien se aleja. Una lista de ataques puede dar a sus filas `reach` y `range`, leídos de una columna o definidos una vez para todas; el `range` de una acción de criatura puede ser `{ "normal": 30, "long": 120 }` en vez de un número.

```json
{
  "capabilityApi": { "major": 1, "minor": 28 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Se rechaza al importar un conjunto que declare `ranged`, `cover`, `opportunity` o alcance de armas SIN `distance`: no significan nada sin una casilla en la que medir. El tablero usa el generador, terreno y despliegue del estilo táctico existente, sin añadir otro modelo de campo ni permisos.

No es una integración opcional, por el mismo motivo que 1.20–1.27: un motor que no entienda estas claves rechaza todo el conjunto o el catálogo con una criatura cuyo alcance es un par. La instalación lee los bytes verificados de `ruleset.json` y cada `catalogs/<id>.json` declarado y rechaza cualquiera con una versión declarada menor. No cambia los conjuntos que no definen distancia.

### Capability API 1.26: formato de combate

API 1.26 añade `combat` para tiradas, objetivos, economía de acciones, ataques, capacidades, estados, concentración, salud cero, tipos de daño y escala de enemigos. `mechanics` puede describir objetivos, impactos seguros, estados, puntos temporales, escalado según la ficha y consumo de presupuesto.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

### Capability API 1.27: bestiarios del conjunto

API 1.27 permite `"holds": "creatures"`. Sus bloques usan `combat`: salud fija o tirada al empezar, defensa, iniciativa, atributos y salvaciones con IDs de ficha, resistencias, debilidades, inmunidades, nivel de amenaza y rasgos para el GM. Las acciones pueden atacar, exigir salvaciones, aplicar estados, limitar usos, recargarse con dados, encadenar acciones con un presupuesto o gastar puntos especiales propios.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

Un catálogo de criaturas no declara `feeds` ni aparece en el selector de fichas. Con el director de combate activado, un juego con `combat` usa esas reglas y su bestiario en la pantalla de batalla y guarda las fichas tras cada acción. Es el estilo `ruleset`, sin un nivel adicional de Capability API. Sin `combat`, se sigue usando el bloque `battle` o la preferencia Classic/Tactical. La instalación comprueba los archivos verificados `ruleset.json` y `catalogs/<id>.json`: `combat` y las nuevas claves de `mechanics` requieren 1.26; `holds` y `creature`, 1.27. Un esquema estricto anterior rechazaría el archivo. No se añaden permisos ni cambian los reglamentos sin estos campos.

### Capability API 1.18: mantener la configuración de Experience en el asistente de Game

Un paquete `game-surface` puede declarar `contributions.gameSurface.setup` con la versión 2 del esquema y Capability API 1.18. Engine conserva sus siete pasos habituales de configuración, incluidos **Party** (Grupo), objetivos, modelos y lorebooks. Solo los juegos nuevos ofrecen Experiences; volver a abrir la configuración de un juego existente conserva su Experience y la configuración del paquete. Los paquetes sin esta declaración mantienen su diálogo de configuración anterior.

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

Los tres campos son opcionales. La semilla declarada aparece debajo de la Experience seleccionada con un botón **Randomize** (Elegir al azar). Una entrada vacía o sin un valor numérico finito bloquea **Start** (Iniciar). El host escribe la semilla numérica y las constantes declaradas en `experienceConfig`; `config` no puede contener la clave de la semilla. Las constantes deben serializarse en un máximo de 8 000 caracteres. La etiqueta de la semilla es texto de visualización escrito por el paquete; omítela para usar la etiqueta localizada de Engine.

Un requisito de widgets declarado proporciona el valor predeterminado solo hasta que el jugador cambia ese control. Desactivar la Experience restaura el valor predeterminado habitual, mientras que las decisiones explícitas del jugador se mantienen. El control explica lo que espera la Experience y sigue siendo editable. Los controles de configuración del mapa espacial se ocultan para estas Experiences, por lo que no se inicia ningún borrador, plantilla o editor de mapas aparte.

El paso **Lorebooks** (Libros de trasfondo) permite seleccionar hasta 100 entradas individuales habilitadas, incluidas las de libros no adjuntos. Se respetan los libros y las entradas deshabilitados y las exclusiones del chat. Estos identificadores se envían en `GameSetupConfig.activeLorebookEntryIds`. En `/game/setup` son entradas forzadas adicionales: omiten las tiradas de probabilidad, pero mantienen los límites habituales de tokens. El lore global, vinculado a personajes y adjunto sigue participando en el escaneo normal. Los paquetes pueden leer los mismos identificadores seleccionados desde la configuración para su propia solicitud de generación del mundo.

Importar un archivo de configuración restaura una Experience instalada y compatible y su semilla numérica válida, pero descarta cualquier configuración arbitraria del paquete. El manifiesto actual vuelve a proporcionar las constantes. Los juegos existentes omiten la importación de Experiences con una explicación. Las instantáneas de creación conservan el nombre de la Experience y la semilla para el resumen de configuración.

Usa de forma independiente la declaración existente de disponibilidad de inicio cuando el mundo deba prepararse antes del primer turno. Declara API 1.18 como mínimo del paquete; los hosts anteriores no pueden interpretar esta declaración de configuración.

### Capability API 1.34: una criatura escrita en los términos del conjunto

Una criatura de bestiario puede incluir `sheet`: una ficha expresada en los términos del conjunto, tan parcial como se desee. El combate la construye igual que la de un miembro del grupo: salud, defensa, salvaciones, iniciativa, velocidad y capacidades de sus listas proceden de las declaraciones del conjunto y se pagan con sus propias reservas. No declara además `health`, `defense`, `initiativeModifier`, `speed`, `abilities` ni `saves`, y puede no tener acciones de bloque propias:

```json
{
  "capabilityApi": { "major": 1, "minor": 34 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/creatures.json"] } }
}
```

La comprobación lee los bytes del conjunto y cada catálogo que tiene la instalación, igual que 1.27. Una fila de la ficha de la criatura puede llevar `_catalog: "<catalog>/<entry>"` para una entrada de un catálogo que alimenta esa lista; el motor carga esos catálogos junto al bestiario para el combate. No es una integración opcional, por el mismo motivo que 1.20–1.33: un motor que no entienda la clave rechaza el catálogo estricto completo. El paquete que la incluya declara 1.34. Sin permisos nuevos.

### Capability API 1.33: el momento que espera una reacción

`mechanics.reaction` de una entrada puede ser un objeto en vez de `true`. `on` nombra el momento que detecta el motor, `at` indica a quién se dirige la acción elegida y `cancels` impide que ocurra lo que la ventana dejó en espera:

```json
{
  "capabilityApi": { "major": 1, "minor": 33 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

`on` es `aimed`, antes de que algo alcance al portador, o `harmed`, después de recibir daño; declarar uno coloca la entrada en el menú de esa ventana. `at` es `source`, que rellena quién causó el momento, o `chosen`, que conserva los objetivos de la entrada. Solo una entrada `aimed` puede `cancel`: no se cancela algo ya ocurrido. El coste de una acción cancelada sigue gastado, pues se pagó antes de preguntar.

Una entrada que mantiene `"reaction": true` solo indica que no se usa en un turno, insuficiente para ofrecerla en una ventana; no aparece en ningún menú y no necesita una versión nueva. No es una integración opcional, por el mismo motivo que 1.20–1.32: un motor que no entienda el objeto rechaza todo el catálogo estricto. El paquete que lo incluya declara 1.33. Sin permisos nuevos.

### Capability API 1.32: un arma que limita sus propios ataques

Una fuente de ataques puede declarar `strikesCappedBy`, una columna booleana de su lista. Si está activa en una fila, esa fila compra un único ataque, independientemente de cuántos compre `strikes` para la lista. Así, un arma que dispara una vez por turno conserva ese límite mientras el resto ataca tantas veces como indique la ficha. Responde a la propiedad Loading de SRD 5.1: "you can fire only one piece of ammunition when you use an action, bonus action, or reaction to fire it, regardless of the number of attacks you can normally make."

```json
{
  "capabilityApi": { "major": 1, "minor": 32 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Requiere `strikes` y se rechaza sin él: una lista que compra un ataque por gasto ya limita cada fila a uno. No es una integración opcional, por el mismo motivo que 1.20–1.31: un motor que no entienda la clave rechaza todo el archivo de reglas. El paquete que la incluya declara 1.32. Sin permisos nuevos.

### Capability API 1.31: integraciones de generación del host

Los paquetes del servidor pueden usar `api.runtime.integrations` para acceder a los servicios actuales del motor de LLM, imágenes y video. Declara API de capacidades 1.31 en el manifiesto y comprueba que el host de integración esté disponible durante la activación. Los motores anteriores rechazan el requisito API antes de activar. Las operaciones con proveedores requieren `network`; guardar, preparar y eliminar medios requiere `storage`.

- `llm.createProvider(...)` acepta los mismos ajustes de conexión que la fábrica del motor, incluidos parámetros de solicitud y cabeceras personalizados. El proveedor admite `chat`, `chatComplete`, `embed`, `maxContextValue` y `maxTokensOverrideValue`. No expone propiedades de credenciales.
- `llm.localSidecar()` devuelve el proveedor sidecar local del host mediante la misma fachada.
- `llm.withFallback(...)` envuelve un proveedor creado por el mismo host del paquete. Conserva la admisión del motor, las notificaciones de alternativas y la selección del proveedor.
- `images.generate(...)` y `videos.generate(...)` usan las implementaciones activas del motor, incluidas cancelación, registro de solicitudes, comprobaciones de red y colas de medios. Reenvía `signal` y el `debugMode` de la interfaz del llamador cuando existan.
- `images.save`, `images.remove`, `images.stage` e `images.sweepStaged` reutilizan las escrituras seguras y el ciclo de archivos preparados de la galería. `videos.save` y `videos.remove` reutilizan la ruta de almacenamiento de video. `images.resolveNovelAiRequestSize` reutiliza la normalización de tamaño NovelAI del host. La duración de video y la normalización de carga pública de referencias están disponibles en `videos.resolveDuration` y `videos.resolveReferenceUpload`.

`@marinara-engine/shared` exporta los tipos compartidos de solicitud y resultado. Conserva en el paquete la construcción de prompts y la orquestación propias; usa estos puntos del host para E/S de proveedores en vez de copiar servicios del motor. Los tipos y auxiliares puros pueden seguir empaquetándose.
