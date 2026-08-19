# Agentes: ayudantes de IA para tus chats

Esta guía explica qué son los agentes en Marinara Engine, cómo descargarlos, cuándo se ejecutan y cómo activarlos en un chat. Cubre el panel **Agents** (Agentes), el catálogo oficial, los ajustes por chat y cómo saber cuándo un agente se ha ejecutado. Para ver el catálogo oficial completo, consulta las guías relacionadas al final.

## Qué son los agentes

Los agentes son pequeños ayudantes de IA que se ejecutan automáticamente alrededor de la respuesta principal de tu chat. Hacen tareas concretas mientras hablas con un personaje. Por ejemplo, un agente puede llevar el control de la hora y el clima, o elegir una expresión del personaje. Otro agente puede reescribir la respuesta para eliminar palabras repetidas. Otros pueden generar una imagen para un momento importante.

Los agentes se activan por chat, no por personaje. No hay un interruptor de agente en la tarjeta de personaje. Dos chats con el mismo personaje pueden ejecutar agentes completamente distintos. Tú eliges qué agentes se ejecutan en los ajustes de cada chat.

Las instalaciones nuevas de Marinara Engine empiezan sin agentes opcionales. Así la app base y la instalación de Termux ocupan menos. El catálogo oficial de la versión v2.3.0+ contiene 33 paquetes de un clic: 6 Writer Agents, 9 Tracker Agents y 18 Misc Agents, incluidos Long-Term Memory, Maps, Calls, Inventory Tracker y los seis juegos de Conversation. Su código fuente, manifiestos, artefactos descargables y catálogo a nivel de repositorio son públicos en [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Para ver la guía completa de cada agente, consulta [Downloadable Agents Reference](built-in-agents.md). Para crear los tuyos, consulta [Creating Custom Agents](custom-agents.md). Las importaciones de agentes externos requieren activar **Allow custom Agent imports** en la Danger Zone y revisar sus capacidades de forma explícita; esta protección no afecta a las descargas oficiales ni a los agentes que creas tú mismo.

## Las tres fases

Cada agente se ejecuta en uno de tres puntos alrededor de tu respuesta. Ese punto se llama la **pipeline phase** (fase de la tubería) del agente. La defines en el editor del agente, y cada agente integrado ya trae un valor predeterminado razonable.

- **Pre-Generation**: se ejecuta antes de que la IA escriba su respuesta. Puede añadir contexto útil al prompt (instrucciones enviadas a la IA) primero. Aquí se ejecutan los agentes de búsqueda de conocimiento.
- **Parallel**: se ejecuta al mismo tiempo que la respuesta. No espera a la respuesta y no puede cambiarla. Aquí se ejecuta un agente de reacción del público en vivo.
- **Post-Processing**: se ejecuta después de que la respuesta esté terminada. Puede leer la respuesta y, en el caso de los agentes de reescritura, editarla. Aquí se ejecutan la mayoría de los trackers (agentes de seguimiento), el agente de limpieza de prosa y el agente de imágenes.

## El panel Agents

Abre el panel **Agents** desde las pestañas de panel del lado derecho (el icono de las estrellas, Sparkles). Aquí exploras, creas y organizas agentes. Esta es tu biblioteca. No es el interruptor de encendido o apagado para un solo chat.

Haz clic en **Download Agents** (Descargar agentes) en la parte de arriba para abrir el catálogo oficial a pantalla completa. Funciona en computadora y en el teléfono. Selecciona un elemento para leer su descripción, el tipo de función que admite, el tamaño de descarga, los permisos, la compatibilidad de versión y la documentación. Haz clic en **Install** (Instalar) para añadirlo; la misma pantalla ofrece actualizaciones manuales inmediatas y **Uninstall** (Desinstalar) para los paquetes que ya tienes. Marinara también revisa cada paquete oficial instalado al arrancar el servidor y lo actualiza a la versión compatible más reciente del catálogo antes de que se active su tiempo de ejecución. Los paquetes siguen funcionando en su versión actual cuando el servidor anfitrión está desconectado o una actualización no se puede verificar.

El catálogo dentro de la app se respalda en el [repositorio público Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Ahí puedes inspeccionar cada paquete y artefacto, pero los usuarios normales deberían instalar a través de **Download Agents** para que Marinara pueda validar la compatibilidad, los permisos, los hashes, el contenido del archivo comprimido y los requisitos de reinicio.

El catálogo incluye agentes de chat oficiales, World Maps, las llamadas de audio/video de Conversation y todos los juegos opcionales de Conversation. Los agentes instalados se agrupan en **Writer Agents**, **Tracker Agents** y **Misc Agents**, además de una sección **Custom Agents** para los que tú crees. Desinstalar un paquete del catálogo elimina su código y sus ajustes del Engine, pero conserva los mensajes y el historial del chat. Borrar un agente personalizado lo elimina para siempre.

Cuando actualizas desde una versión del Engine que incluía estas funciones, Marinara descarga los paquetes correspondientes una sola vez y conserva las selecciones de chat existentes, los ajustes de los agentes, los datos de tiempo de ejecución guardados y el historial. Si esa migración no puede llegar al catálogo, lo reintenta en el siguiente arranque en lugar de descartar nada.

Las actualizaciones automáticas de arranque nunca instalan un paquete no seleccionado. Las instalaciones de computadora, Docker y Android/Termux actualizan los paquetes guardados por su servidor local. iOS, iPadOS y otros clientes de navegador usan los paquetes instalados y actualizados por el servidor de Marinara al que se conectan.

## Activar agentes para un chat

Los agentes se activan dentro de cada chat, en el panel lateral **Chat Settings** (Ajustes del chat).

1. Abre el chat que quieras.
2. Abre **Chat Settings** (el engranaje).
3. Encuentra la sección **Agents**.
4. Activa **Enable Agents** (Activar agentes). Este es el interruptor maestro. Cuando está apagado, no se ejecuta ningún agente para este chat.
5. Añade los agentes que quieras desde las listas debajo del interruptor, o quita los que no quieras.

Deberías ver los agentes que añadiste listados como activos, cada uno con un pequeño botón para quitarlo.

La sección **Agents** tiene algunos controles más:

- **Review Agent Outputs** (Revisar resultados de los agentes): cuando está activado, los cambios en el lorebook (libro de trasfondo), el resumen y la tarjeta de personaje esperan tu aprobación antes de guardarse. Cuando está apagado, los cambios en el lorebook y el resumen pueden guardarse por su cuenta, pero las ediciones de la tarjeta de personaje siguen preguntándote primero. Consulta [Agent Approvals and the Agent Suite](approvals-and-agent-suite.md).
- **Manual Trackers** (solo chats de Roleplay): cuando está activado, los trackers no se ejecutan después de cada respuesta. Los activas a mano desde un botón en el HUD (barra de estado en pantalla). HUD significa heads-up display, la superposición de estado en pantalla en Roleplay.
- **Agent Suite**: abre un visor donde puedes leer y editar todo lo que los agentes han guardado para este chat.

### La advertencia de costo

Los agentes cuestan tokens (fragmentos de texto) adicionales y llamadas al modelo adicionales. Cada agente añade sus propias instrucciones, y a menudo su propia llamada al modelo. Marinara agrupa en una sola llamada los agentes que comparten la misma conexión cuando puede. Encima de la lista de agentes, un indicador estima la carga para tu configuración actual. Muestra aproximadamente cuántos tokens de instrucciones de agente añadiste y aproximadamente cuántas llamadas adicionales ocurren por turno.

Este indicador se pone ámbar con un icono de advertencia cuando la carga se vuelve pesada. El costo real por turno es más alto que el número mostrado. Tu historial de chat y los detalles del personaje se envían con cada llamada. Si ves la advertencia, quita agentes que no necesites, o mueve algunos a una conexión más barata o local.

## Con qué agentes empieza cada modo

Una instalación nueva empieza sin agentes opcionales instalados ni activos. Cada modo de chat muestra solo los paquetes compatibles que tengas instalados.

- **Roleplay**: instala agentes de Roleplay desde el catálogo, luego añádelos en Chat Settings. World Maps aparece ahí como cualquier otro agente compatible.
- **Conversation**: instala Calls o juegos de mesa individuales desde el catálogo. Los juegos aparecen en el selector de juegos y registran sus comandos slash; las llamadas añaden su barra de herramientas y sus controles en Chat Settings.
- **Game Mode**: los agentes compatibles con Game instalados se pueden seleccionar durante la creación del juego o añadir más tarde. World Maps aporta su espacio de trabajo de mapa y su vista de mapa del mundo solo cuando está activo para ese juego.

Puedes añadir o quitar agentes compatibles en cualquier momento.

## Saber si un agente se ejecutó

Algunos agentes cambian algo que puedes ver de inmediato. Otros trabajan en silencio. Así puedes comprobarlo.

- Los trackers escriben en el HUD y en los paneles de tracker. Si la hora, la ubicación, el estado de ánimo o las estadísticas se actualizaron, un tracker se ejecutó.
- Una superposición de estado flotante muestra mensajes cortos de pensamiento de los agentes mientras trabajan, así puedes verlos ejecutarse en tiempo real.
- Los agentes **Prose Guardian** y **Continuity Checker** cambian el texto de la respuesta en sí. Una respuesta limpiada o corregida es señal de que se ejecutaron.
- Para un rastro completo, activa **Debug mode** (Modo de depuración) en **Settings** (Configuración), luego **Advanced** (Avanzado), luego **Message Tools** (Herramientas de mensaje). Registra el prompt y la respuesta de cada agente en la consola del servidor. También muestra una superposición **Agent Debug** con las llamadas, tokens y tiempos de cada agente.

¿Un agente que esperabas no se ejecutó? Comprueba que **Enable Agents** esté activado. Comprueba que el agente esté activo para este chat. Comprueba que tu modo de chat lo permita.

## Guías relacionadas

- [Downloadable Agents Reference](built-in-agents.md)
- [Official Marinara Agents repository](https://github.com/Pasta-Devs/Marinara-Agents)
- [Creating Custom Agents](custom-agents.md)
- [Agent Approvals and the Agent Suite](approvals-and-agent-suite.md)
- [Roleplay HUD and Trackers](../roleplay/hud-and-trackers.md)
