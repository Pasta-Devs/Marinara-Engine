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
