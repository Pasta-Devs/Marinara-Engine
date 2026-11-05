# Agentes: ayudantes de IA para tus chats

Los agentes son pequeños ayudantes de IA que se ejecutan alrededor de la respuesta principal de tu chat. Uno lleva el control de la hora y el clima, otro elige una expresión del personaje y otro dibuja una imagen para un momento importante. Esta guía muestra cómo instalar agentes, activarlos para un chat y comprobar que se ejecutaron.

## Qué son los agentes

Los agentes se activan por chat, no por personaje. Dos chats con el mismo personaje pueden ejecutar agentes distintos.

Una instalación nueva no tiene agentes opcionales. Instálalos desde **Agent Organizer** (Organizador de agentes), la tienda de paquetes oficiales de un clic. El código fuente y el catálogo son públicos en [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Instala a través de **Agent Organizer**, para que Marinara pueda comprobar la compatibilidad, los permisos y los hashes de los archivos. Para saber qué hace cada agente, consulta [Referencia de agentes descargables](built-in-agents.md). Para crear los tuyos, consulta [Crear agentes personalizados](custom-agents.md).

## Añadir un agente a un chat

Antes de empezar: instala primero el agente. Abre el panel **Agents** (el icono de las estrellas, Sparkles, en las pestañas del lado derecho), haz clic en **Agent Organizer**, abre la página del agente y haz clic en **Get** (Obtener). Consulta [Instalar y actualizar agentes](#install-and-update-agents).

1. Abre el chat.
2. Abre **Chat Settings** (Ajustes del chat) y busca la sección **Agents** (Agentes).
3. Activa **Enable Agents** (Activar agentes). Este es el interruptor maestro: cuando está desactivado, no se ejecuta ningún agente en este chat.
4. Haz clic en **Add Agent** (Añadir agente), abre el grupo al que pertenece el agente (como **Writer Agents** o **Misc Agents**) y elígelo.

Los agentes que añadiste aparecen como activos, cada uno con un pequeño botón para quitarlo. Puedes añadir o quitar agentes en cualquier momento.

> **Nota:** Cada modo de chat muestra solo los agentes que funcionan en ese modo. En Conversation, los juegos instalados aparecen en el selector de juegos y **Calls** añade controles a la barra de herramientas. En Game Mode, elige los agentes al crear la partida o añádelos más tarde.

Si un agente no se ejecutó, comprueba que **Enable Agents** esté activado, que el agente esté activo en este chat y que su modo coincida con tu chat.

### Más controles en la sección Agents

Estos controles están en la misma sección **Agents**.

- **Agent Menus** (Menús de agentes, solo en Roleplay): haz clic en el nombre de un agente para ir directamente a sus ajustes.
- **Trackers Control** (Control de trackers, solo en Roleplay): una tarjeta cerrada con las opciones de los trackers (agentes de seguimiento) que se indican abajo.
- **Agent Suite**: abre un visor donde lees y editas lo que los agentes guardaron para este chat.
- **Review Agent Outputs** (Revisar resultados de los agentes): hace que los cambios en el lorebook (libro de trasfondo), el resumen y la tarjeta de personaje esperen tu aprobación. En Roleplay está dentro de **Trackers Control**. Consulta [Aprobaciones de agentes y el Agent Suite](approvals-and-agent-suite.md).

Opciones dentro de **Trackers Control**:

- **Attach chat summaries** (Adjuntar resúmenes del chat): desactivado de forma predeterminada. Añade los resúmenes guardados del chat a las solicitudes de los agentes, incluidos los reintentos. No elimina los resúmenes de la respuesta principal ni detiene la generación de resúmenes. Los agentes con acceso completo al prompt principal (las instrucciones enviadas a la IA) pueden seguir leyendo los resúmenes ahí.
- **Attach Lorebooks to Trackers** (Adjuntar lorebooks a los trackers): los trackers también reciben las entradas de lorebook usadas para la respuesta principal. Aparece en cuanto el chat tiene un tracker.
- **Individual tracker schedule** (Programación individual de trackers): impide que un tracker se ejecute después de cada respuesta. Lo ejecutas a mano desde el HUD (la superposición de estado en pantalla en Roleplay).

### Dar a un agente un lorebook de referencia

1. En **Chat Settings**, abre **Agents** y luego los ajustes del agente.
2. Activa **Attach lorebook for the specific agent** (Adjuntar un lorebook para este agente). Empieza desactivado.
3. Elige un libro en **Reference lorebook** (Lorebook de referencia).

La elección pertenece a este agente en este chat. Las entradas coincidentes siguen las reglas de activación habituales de los lorebooks y van a este agente, también en los reintentos manuales. Este ajuste no añade el libro a la respuesta principal ni a agentes no relacionados, pero los agentes que se ejecutan juntos también pueden ver las mismas entradas. Los libros eliminados o no disponibles no aportan nada.

## Cuándo se ejecutan los agentes

Cada agente se ejecuta en un punto alrededor de tu respuesta, llamado su **pipeline phase** (fase de la tubería). Cada agente integrado tiene un valor predeterminado. Puedes cambiarlo en el editor del agente.

| Fase | Cuándo se ejecuta | Ejemplos |
| --- | --- | --- |
| **Pre-Generation** | Antes de la respuesta. Puede añadir contexto al prompt. | Búsqueda de conocimiento |
| **Parallel** | Al mismo tiempo que la respuesta. No puede cambiar la respuesta. | Reacciones del público en vivo |
| **Post-Processing** | Después de la respuesta. Puede leer la respuesta, y los agentes de reescritura pueden editarla. | La mayoría de los trackers, limpieza de prosa, imágenes |

<a id="tell-whether-an-agent-ran"></a>

## Saber si un agente se ejecutó

- Los trackers escriben en el HUD y en los paneles de tracker. Si la hora, la ubicación, el estado de ánimo o las estadísticas cambiaron, un tracker se ejecutó.
- **Agent activity** (Actividad de los agentes) en **Chat Settings** enumera notas breves de los agentes. Su icono gira mientras trabajan y muestra un punto cuando uno falla. Consulta [Agent activity](../roleplay/getting-started.md#agent-activity).
- **Prose Guardian** y **Continuity Checker** cambian el texto de la respuesta. Una respuesta limpiada o corregida significa que se ejecutaron.
- Para un rastro completo, activa **Debug mode** (Modo de depuración) en **Settings → Advanced → Message Tools** (Configuración → Avanzado → Herramientas de mensaje). Registra el prompt y la respuesta de cada agente en la consola del servidor, y las entradas de depuración de los agentes también aparecen en la consola del navegador. Las inyecciones de prompt guardadas en caché se muestran en la pestaña **Injections** (Inyecciones) de **Agent activity**.

## Vigilar el costo

Cada agente añade sus propias instrucciones y a menudo su propia llamada al modelo. Marinara agrupa en una sola llamada los agentes que comparten una conexión cuando puede.

Un indicador encima de la lista de agentes estima los tokens (fragmentos de texto) y las llamadas adicionales por turno. Toca el icono de ayuda junto a él para ver los detalles. Se pone ámbar con un icono de advertencia cuando la carga es pesada. El costo real es más alto, porque el historial del chat y los detalles del personaje van con cada llamada.

Si ves la advertencia, quita los agentes que no necesites o mueve algunos a una conexión más barata o local. Un **Reasoning Effort** (Esfuerzo de razonamiento) guardado en una conexión también se aplica a los agentes que la usan. Consulta [Parámetros para agentes](../prompts/generation-parameters.md#parameters-for-agents).

<a id="install-and-update-agents"></a>

## Instalar y actualizar agentes

Abre el panel **Agents** (el icono de las estrellas, Sparkles, en las pestañas del lado derecho) y haz clic en **Agent Organizer**. Funciona en computadora y en el teléfono.

- **Home** (Inicio) muestra agentes destacados y un estante para cada sección: **Apps**, **Chat games** (Juegos de chat), **Trackers** (Agentes de seguimiento) y **Writing help** (Ayuda para escribir).
- **Updates** (Actualizaciones) enumera los agentes instalados que tienen una versión más reciente. **Installed** (Instalados) enumera todo lo que tienes, con la versión y el tamaño.
- La búsqueda y el filtro de modo acotan todas las listas.
- Selecciona un agente para ver su descripción, tamaño de descarga, permisos, compatibilidad y **Version history** (Historial de versiones). Haz clic en **Get** para instalarlo. El menú **⋯** ofrece **Uninstall** (Desinstalar).
- El menú **⋯** junto al título tiene **Update all** (Actualizar todo), **Install all** (Instalar todo), **Refresh catalog** (Refrescar catálogo) y **Uninstall all** (Desinstalar todo).

Los agentes instalados se agrupan como **Apps**, **Writer Agents**, **Tracker Agents** y **Misc Agents**, además de **Custom Agents** para los que tú crees. Las **Apps** son paquetes con su propia pestaña Home, como Noodle y Slurp. Las usas de forma independiente en lugar de añadirlas a un chat.

Un paquete marcado **Rules** no es un agente. Añade un conjunto de reglas de Game Mode, como 5e (SRD 5.1), que eliges en **Rules** al crear una partida. Consulta [Jugar con un conjunto de reglas](../game/rulesets.md). El paquete 5e está en vista previa, así que solo lo muestra un Engine en la rama `staging`.

Desinstalar un paquete elimina su código y sus ajustes, pero conserva los mensajes y el historial de tu chat. Borrar un agente personalizado lo elimina para siempre.

### Actualizar agentes

Cuando existe una versión compatible más reciente de un paquete instalado, se abre una ventana **Agent updates available** (Actualizaciones de agentes disponibles). Enumera cada actualización con su versión e indica si necesita un reinicio.

1. Desmarca la casilla de cualquier actualización que quieras omitir. Todas las actualizaciones empiezan seleccionadas.
2. Lee **What's new** (Novedades) si el paquete publicó notas. **More** (Más) muestra completa una nota larga. Un punto marca un cambio que vas a notar.
3. Haz clic en **Update all** (o en **Update 2 of 3**, Actualizar 2 de 3, cuando hayas desmarcado algunas). Cada fila muestra **Updated** (Actualizado) o **Failed** (Falló). Una fila fallida muestra el motivo y **Retry** (Reintentar).
4. Si una actualización necesita un reinicio, haz clic en **Restart now** (Reiniciar ahora), o reinicia Marinara más tarde.

Haz clic en **Not now** (Ahora no) para conservar tus versiones. Marinara no vuelve a preguntar por una versión que omitiste. Puedes actualizar desde **Agent Organizer** en cualquier momento. Los paquetes instalados siguen funcionando en su versión actual, incluso cuando no se puede llegar al catálogo. **See in Agent Organizer** (Ver en Agent Organizer) abre la página del agente.

Las actualizaciones solo se aplican a los paquetes que instalaste. Los paquetes viven en el servidor de Marinara, así que los clientes de navegador usan lo que el servidor tiene instalado.

Cuando actualizas desde una versión del Engine que incluía estas funciones, Marinara descarga los paquetes correspondientes una sola vez y conserva las selecciones de tus chats, los ajustes y el historial. Si no puede llegar al catálogo, lo reintenta en el siguiente arranque.

## Guías relacionadas

- [Referencia de agentes descargables](built-in-agents.md)
- [Avatares 2D y 3D](avatars.md)
- [Crear agentes personalizados](custom-agents.md)
- [Aprobaciones de agentes y el Agent Suite](approvals-and-agent-suite.md)
- [HUD y trackers de Roleplay](../roleplay/hud-and-trackers.md)
