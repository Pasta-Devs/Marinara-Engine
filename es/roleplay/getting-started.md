# Modo Roleplay: primeros pasos

Esta guía explica qué es el Modo Roleplay, cómo iniciar un roleplay y qué ves en pantalla. También explica los controles de sprites, la barra de herramientas del chat, las Author's Notes y dónde leer sobre funciones más avanzadas.

## Qué es el Modo Roleplay

El Modo Roleplay es uno de los modos de chat de Marinara Engine. Los otros son Conversation y Game. El roleplay te da una vista de escena envolvente construida alrededor de una historia.

Una escena de roleplay puede mostrar una imagen de fondo, sprites de personajes y un HUD (barra de estado en pantalla) del estado del mundo. Un sprite (imagen del personaje) es una imagen del personaje que cambia según la emoción. Un heads-up display, o HUD, es la pequeña franja de widgets de información en la parte superior del chat.

El roleplay también usa ayudantes llamados agentes. Un agente es una pequeña tarea automática que se ejecuta junto a la respuesta de la IA. Los agentes hacen seguimiento del estado del mundo, eligen sprites, eligen fondos y más.

No necesitas generación de imágenes para usar el Modo Roleplay. Sin ella, el modo sigue funcionando como chat solo de texto. Las ranuras de sprites quedan vacías, el fondo muestra un color sólido y el HUD sigue haciendo seguimiento de todo. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md) para configurar una conexión.

Elige el Modo Roleplay cuando quieras una escena envolvente. Elige el [Modo Conversation](../conversation/getting-started.md) para un chat de mensajería sencillo. Elige el [Modo Game](../game/getting-started.md) para un juego de rol estructurado con grupo de aventura, combate y dados.

## Iniciar un roleplay

Crea un nuevo chat de Roleplay para abrir el asistente de configuración. El asistente tiene cinco pasos. Solo la conexión de IA es obligatoria. Todos los demás pasos son opcionales y se pueden cambiar más tarde.

1. **Name & Connection** (Nombre y conexión). Ponle nombre al roleplay y elige qué conexión de IA responde. Puedes dejar el nombre en blanco.
2. **Pick a Preset** (Elegir un preset). Un preset (ajuste guardado) controla la estructura del prompt y los ajustes de generación. El preset predeterminado funciona bien para la mayoría de los chats.
3. **Persona & Characters** (Persona y personajes). Elige la persona que interpretas y qué personajes se unen a la escena.
4. **Attach Lorebooks** (Adjuntar lorebooks). Un lorebook (libro de trasfondo) es un conjunto de datos del mundo que la IA lee cuando aparecen palabras clave. Este paso es opcional.
5. **Enable Agents** (Activar agentes). Elige qué agentes se ejecutan en este chat. Puedes añadir o quitar agentes más tarde en **Chat Settings** (Ajustes del chat), en **Agents**.

Cuando termines el asistente, tu escena se abre y puedes enviar tu primer mensaje.

## El escenario: fondo, sprites y HUD

El escenario de Roleplay es el área de escena detrás y alrededor de tus mensajes. Tiene tres partes principales.

El **background** (fondo) es una imagen de escena completa detrás de la columna de mensajes. Hace una transición suave cuando cambia. El agente **Background** puede elegir uno en cada turno de tu biblioteca de fondos. También puedes fijar un fondo por chat. Consulta [Fondos de Roleplay](backgrounds.md) para conocer todo el sistema de fondos.

Los **Sprites** son las imágenes de personajes colocadas en el escenario. No hay un límite fijo. Cada personaje con sprites activados en el chat puede aparecer. Los sprites necesitan una biblioteca de sprites subida en la tarjeta de personaje. Sin ella, la ranura de sprite no muestra nada. Consulta [Sprites de personaje](../characters/sprites.md) para añadir sprites a un personaje.

El **HUD** es una fila de pequeños widgets en la parte superior del chat. Cada widget pertenece a un tracker (agente de seguimiento), así que un widget solo aparece cuando su agente está activado. Los widgets pueden mostrar fecha, hora, clima, ubicación, personajes presentes, inventario, misiones y estadísticas. Haz clic en un widget para abrir un panel y editar sus valores. Consulta [HUD y trackers de Roleplay](hud-and-trackers.md) para conocer cada widget y modo de bloqueo.

### Controles de visualización de sprites

Los controles de sprites están en **Chat Settings**, en **Agents**, en la tarjeta **Expression Engine**. Aparecen una vez que al menos un personaje tiene sprites activados.

- **Sprite Source** (Fuente del sprite). Un interruptor con **Expressions** y **Full-body**. Elige uno o ambos. Al menos uno debe quedar activado.
- **Expression Size**, **Full-body Size**, **Expression Opacity** y **Full-body Opacity**. Cuatro controles deslizantes que fijan el tamaño del sprite y el nivel de transparencia. Estos ajustes se quedan en este navegador y no se sincronizan con otros dispositivos.
- **Default Side** (Lado predeterminado). Un interruptor **Left** o **Right** que fija en qué lado empiezan los sprites nuevos.
- **Expression Avatars**. Cuando está activado, los avatares de los mensajes en la transcripción usan el sprite de expresión actual del personaje.

Para mover los sprites a mano, haz clic en el botón **Arrange** en el escenario. Se convierte en **Done** mientras está activo. Arrastra un sprite, luego haz clic en la pequeña marca de verificación sobre él para confirmar. Haz clic en **Done** para terminar. El botón **Reset** borra todas las colocaciones personalizadas.

También puedes fijar una expresión escribiendo el comando **/emote** en el cuadro de chat. Funcionan dos formas:

```
/emote happy
```

```
/emote "Aria" angry
```

La primera forma fija la expresión para la escena. La segunda forma apunta a un personaje con nombre. Escribe **/emote** sin palabras para ver la lista de expresiones disponibles de cada personaje en la escena.

## La barra de herramientas del chat

La barra de herramientas está en la parte superior del área de chat. Tiene botones que abren pequeños paneles llamados popovers (paneles emergentes). Los botones principales son:

- **Chat Summary** (Resumen del chat). Muestra y edita el resumen continuo del chat.
- **Active Context** (Contexto activo). Lista los personajes vinculados, las entradas de lorebook y el preset que alimentaron la última respuesta. Muestra qué entradas de lorebook coincidieron y fueron inyectadas.
- **Author's Notes** (Notas del autor). Una nota de texto libre que se añade al prompt en cada turno. Ver más abajo.
- **Gallery** (Galería). Abre la galería de imágenes y videos del chat, donde puedes generar una ilustración o un fondo.
- **Chat Settings**. Abre el panel lateral de ajustes completo de este chat.

### Author's Notes

**Author's Notes** es una nota que escribes y que la IA lee en cada generación. Úsala para un recordatorio permanente, como una regla de tono o un dato oculto. Ábrela con el botón del bolígrafo en la barra de herramientas.

Escribe tu nota en el cuadro. Por ejemplo: "Mantén el tono oscuro y lleno de suspenso. El villano es en secreto un aliado."

Debajo de la nota hay un campo numérico **Injection Depth** (Profundidad de inyección). Fija a qué altura del historial del chat se coloca la nota. La ayuda dentro de la app dice: **Depth 0 = after the latest message, 4 = four messages from the end**. La profundidad 0 mantiene la nota lo más cerca posible de la respuesta más reciente.

Author's Notes también funciona de la misma forma en el Modo Game y el Modo Conversation. Esta guía es su referencia principal.

## El menú Agents and Actions

El botón del destello en la fila del HUD abre el menú **Agents & Actions** (Agentes y acciones). Su pestaña **Activity** lista las salidas de los agentes, llamadas globos de pensamiento. Puedes descartar cada uno o usar **Clear all**. Las salidas de agentes personalizados también aparecen aquí.

Si un agente falló en el último turno, aparece una lista de fallos con un botón para reintentar. También puedes volver a ejecutar todos los trackers desde este menú. Para un recorrido en lenguaje sencillo por todo el sistema de agentes, consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md).

Una pestaña **Injections** aparece solo cuando **Debug mode** (Modo de depuración) está activado. Actívalo en **Settings** (Configuración), en **Advanced**. Esta pestaña muestra los fragmentos de prompt que los agentes tipo escritor guardaron antes de la última respuesta. Los agentes tipo escritor incluyen **Prose Guardian**, que reescribe las respuestas para que coincidan con tus reglas de estilo, y el **Narrative Director**, que dirige la trama.

Puedes ver, editar y volver a ejecutar un fragmento guardado. Una edición cambia solo lo que se usa cuando regeneras esa misma respuesta. No cambia la respuesta que ya está en pantalla. Esto mantiene la regeneración estable y repetible.

El Narrative Director tiene un botón **Push Story** encima del cuadro de chat. Prepara al Director solo para la siguiente respuesta. El Narrative Director también puede mantener un arco oculto a largo plazo llamado **Secret Plot**. Consulta [Narrative Director y Secret Plot](narrative-director.md) para conocer ambos.

## Interrupciones de personajes

En **Chat Settings → Agents → Roleplay Commands**, activa **Interruptions** (interrupciones) para permitir que los personajes corten el último mensaje cuando sea plausible una intervención verbal o física. Está desactivado inicialmente y no necesita ningún agente descargable.

El modelo utiliza `[interrupt: part="a verbatim phrase of at least three words"]`. Marinara busca esa frase literal solo en el mensaje inmediatamente anterior a la respuesta, conserva el texto hasta la frase incluida y sustituye el final por una raya de interrupción. El diálogo conserva su comilla de cierre; las acciones no reciben una. Si no hay coincidencia o es ambigua, el mensaje no cambia.

Abre la información de comandos de la respuesta y elige **Restore original message** (restaurar el mensaje original) para recuperar el mensaje inicial. Regenerar restaura primero la entrada original completa, para que la nueva respuesta pueda decidir si interrumpe. Seleccionar una variante existente aplica su interrupción, salvo que la hayas restaurado explícitamente. Se conservan las ediciones manuales posteriores en lugar de sobrescribirlas con una interrupción antigua.

## Echo Chamber

**Echo Chamber** es un agente opcional que añade un público en vivo que reacciona a tu escena. Funciona como un chat de streaming que publica una nueva reacción según un temporizador. Actívalo en **Chat Settings**, en **Agents**, en la tarjeta **Echo Chamber**. El panel flota sobre la escena y puede colapsarse en una pequeña pastilla.

## Opciones CYOA

**CYOA** significa Choose Your Own Adventure (Elige tu propia aventura). El agente **CYOA Choices** está desactivado de forma predeterminada. Cuando está activado, añade botones de opción en los que puedes hacer clic después de una respuesta. Al hacer clic en una opción, se envía como tu siguiente mensaje. Funciona solo en el Modo Roleplay.

## Encuentros de combate

El Modo Roleplay tiene una capa de combate ligera. Activa el agente **Combat**, luego haz clic en el botón **Encounter** encima del cuadro de chat (su tooltip dice **Start Combat Encounter**). Esto abre una ventana de configuración y luego una pantalla de combate con barras de salud y botones de acción. Esto es independiente del combate propio del Modo Game. Consulta [Encuentros de combate (Roleplay)](combat-encounters.md) para conocer el flujo completo.

## Escenas

Una **scene** (escena) es una rama lateral de un roleplay. Úsala para un flashback, una ubicación secundaria o un camino alternativo, sin perder el hilo principal. Una escena no toma contexto de una Conversation conectada, aunque el roleplay padre sí lo haga. Consulta [Escenas: ramificar un roleplay](scenes.md).

## Elegir modelos

Los valores predeterminados funcionan bien para el Modo Roleplay. Dos consejos generales ayudan en la mayoría de las configuraciones.

Tu conexión de chat escribe la prosa del personaje. Un modelo de gama media o mejor mantiene la voz estable a lo largo de escenas largas. Tus conexiones de agentes ejecutan pequeñas tareas estructuradas, como leer el estado o elegir una expresión. Los modelos muy débiles pueden producir un estado incorrecto o malas elecciones de sprites.

Puedes fijar un modelo más barato para los agentes que para el chat. Muchos usuarios ejecutan el chat en un modelo potente y los agentes en uno rápido y de bajo costo. Si tus valores del HUD o tus sprites siguen saliendo mal, mueve la conexión de los agentes a un modelo más capaz. Para los ajustes del muestreador, consulta [Parámetros de generación](../prompts/generation-parameters.md).

## Solución de problemas

**Los widgets del HUD muestran un valor incorrecto.** Un tracker llena cada widget. Abre el panel del widget y edita el valor a mano. Si los valores siguen desviándose, cambia la conexión del agente a un modelo más potente. También puedes bloquear un campo para que la siguiente ejecución automática no lo sobrescriba.

**Las expresiones de los sprites no cambian.** Comprueba que el personaje tiene una biblioteca de sprites subida. La generación de imágenes solo se necesita cuando quieres que Marinara cree sprites nuevos. Sin sprites que mostrar, el agente de expresiones se ejecuta pero no tiene nada que mostrar. También puedes fijar una expresión a mano con el comando **/emote**.

**El fondo nunca cambia.** El agente **Background** elige de tu biblioteca de fondos. Con solo uno o dos fondos, sigue eligiendo esos. Añade más fondos para que el agente tenga más opciones. Consulta [Fondos de Roleplay](backgrounds.md).

**Una respuesta regenerada mantiene la dirección incorrecta.** Activa **Debug mode** en **Settings**, en **Advanced**. Abre el menú **Agents & Actions**, busca la pestaña **Injections**, luego edita o vuelve a ejecutar el fragmento guardado antes de regenerar. Para más ayuda, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Guías relacionadas

- [Fondos de Roleplay](backgrounds.md)
- [HUD y trackers de Roleplay](hud-and-trackers.md)
- [Encuentros de combate (Roleplay)](combat-encounters.md)
- [Narrative Director y Secret Plot](narrative-director.md)
- [Escenas: ramificar un roleplay](scenes.md)
- [Sprites de personaje](../characters/sprites.md)
- [Conectar una Conversation a un Roleplay o Game](../chats/connected-chats.md)
- [Macros](../prompts/macros.md)
