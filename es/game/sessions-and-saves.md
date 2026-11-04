# Game Mode: sesiones y partidas guardadas

Game Mode divide tu aventura en sesiones numeradas, como las noches de juego de mesa. Esta guía muestra cómo terminar y empezar una sesión, leer sesiones pasadas, compartir tu configuración, corregir a mano los datos guardados y volver a un momento anterior.

Tu primera sesión es **Session 1**. Terminarla y empezar de nuevo crea **Session 2**, y así sucesivamente. Cuando terminas una sesión, el Game Master (GM, la IA que dirige tu juego) escribe un resumen que puedes releer más tarde.

## Guardar y continuar

No hay botón de guardar. Tu juego se guarda solo mientras juegas.

1. Para parar por ahora, cierra la pestaña o la app.
2. Para continuar, abre el mismo chat del juego. Vuelves a donde lo dejaste.
3. Para cerrar un capítulo, termina la sesión (consulta [Terminar una sesión](#end-a-session)).

Para volver a un momento anterior, consulta [Cómo se guarda tu juego](#how-your-game-saves).

<a id="opening-session"></a>

## Abrir Session

En **Session** terminas sesiones, empiezas otras nuevas y lees tu historial.

1. Abre un chat de Game Mode.
2. Haz clic o toca el botón **Session** (la pluma) cerca de la esquina superior derecha del chat. Puedes arrastrarlo a otro sitio (consulta [Ventanas de controles y sus botones](../chats/chat-settings.md#control-windows-and-their-buttons)).
3. **Session** se abre como ventana en una computadora o como panel de ancho completo en un teléfono. Su primera línea muestra el número y el estado de la sesión actual.
4. Tiene dos pestañas: **Session History** (Historial de sesiones) y **Journal** (Diario). Quédate en **Session History** para los controles de sesión.

Si usaste **Put back in Chat Settings** para mover esta ventana, abre en su lugar la sección **Session** de Chat Settings.

<a id="end-a-session"></a>

## Terminar una sesión

Termina una sesión cuando quieras cerrar un capítulo y dejar que el GM lo resuma.

1. Abre **Session** y quédate en **Session History**.
2. Busca arriba la sesión actual, etiquetada como **Session N (Current)**.
3. En esa fila, haz clic en el botón **End Session** (Terminar sesión), el pequeño icono de cuadrado. La fila tiene varios botones pequeños de icono, así que pasa el cursor por encima para leer sus tooltips. Un cuadro de diálogo titulado **End Session** te pide que confirmes.
4. Opcional: en **What do you want to happen in the next session (optional)?** (¿Qué quieres que pase en la próxima sesión?, opcional), escribe una nota de hasta 5.000 caracteres. Déjalo vacío para que el GM guíe la historia.
5. Haz clic en **End Session** en el cuadro de diálogo. Haz clic en **Cancel** (Cancelar) para retroceder.

El título del cuadro de diálogo cambia a **Ending Session** (Terminando sesión) mientras el GM escribe el resumen. Espera en esta pantalla hasta que termine. Después, la sesión se marca como concluida y aparece en tu historial.

Si no funcionó, comprueba que tu modelo del GM esté accesible. El resumen es una solicitud al modelo y puede fallar como cualquier otra. Vuelve a intentarlo y consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Empezar una nueva sesión

Cuando una sesión está concluida, el mismo botón de su fila cambia a **New Session** (Nueva sesión).

1. Abre **Session** y ve a **Session History**.
2. En la fila de la sesión actual, haz clic en **New Session** (el icono de reproducir).

El GM reanuda la historia a partir del último resumen y de cualquier nota que hayas escrito al terminar la sesión. En un juego con un mundo generado, el mundo continúa desde donde se dejó: los días que pasaron, las hazañas y la reputación del grupo, los lugares y las agrupaciones que añadió la historia, y adónde fue el grupo.

## Leer sesiones pasadas

**Session History** lista las sesiones concluidas, la más reciente primero. Antes de que termines una, muestra **No completed sessions yet** (Aún no hay sesiones completadas). Cada fila muestra el número de sesión, la fecha y cuántos descubrimientos registró. Haz clic en una fila para desplegarla. Pueden aparecer estos campos:

| Campo | Qué contiene |
| --- | --- |
| **Summary** (Resumen) | Qué pasó. |
| **Resume Point** (Punto de reanudación) | Cómo debería retomar la próxima sesión. |
| **Party Dynamics** (Dinámica del grupo) | Cómo se relacionaron entre sí los miembros del grupo. |
| **Key Discoveries** (Descubrimientos clave) | Hechos, giros y revelaciones importantes. |
| **Character Moments** (Momentos de personaje) | Momentos destacados. |
| **Little Details To Recall** (Pequeños detalles para recordar) | Hábitos, promesas o detalles pequeños. |
| **NPC Updates** (Actualizaciones de NPC) | Cambios en los personajes no jugadores (NPC, la gente que controla el GM). |
| **Next Session Request** (Petición para la próxima sesión) | La nota que dejaste al terminar la sesión. |
| **Stats Snapshot** (Instantánea de estadísticas), **Party Status** (Estado del grupo) | Números y estado del grupo guardados. |

### Volver a reproducir una sesión

La reproducción es de solo lectura. No llama al GM, no crea mensajes, no cambia el inventario ni las estadísticas, no actualiza el diario ni restaura un punto de control.

1. Despliega una sesión concluida.
2. Haz clic en **Replay Session** (Volver a reproducir sesión).
3. Usa **Next** (Siguiente) y **Next turn** (Siguiente turno) para avanzar por la narración y el diálogo originales.
4. En una elección, solo está activada la opción que elegiste originalmente. Haz clic en ella para continuar por el camino registrado.
5. Haz clic en el botón de cerrar de la parte superior, o en **Return to current session** (Volver a la sesión actual), cuando hayas terminado.

Las sesiones de antes de que existiera la reproducción se siguen reproduciendo a partir de su texto, sus efectos, sus elecciones y sus recursos guardados. Un turno más antiguo puede omitir un efecto de escena que entonces no se guardaba.

### Editar una sesión pasada

Edita las notas de una sesión concluida para que las sesiones futuras las recuerden correctamente.

1. Despliega la sesión.
2. Haz clic en **Edit Details** (Editar detalles).
3. Cambia cualquier campo y luego haz clic en **Save Details** (Guardar detalles). Haz clic en **Cancel** para descartar tus ediciones.

Aparecen dos botones más en una sesión desplegada:

- **Regenerate** (Regenerar) vuelve a ejecutar la conclusión de la IA. Reescribe el resumen y todos los demás campos, así que se pierden los cambios hechos con **Edit Details**.
- **Update Plot Arcs** (Actualizar arcos argumentales) pide a la IA que actualice los planes de historia ocultos del GM a partir de los eventos de esa sesión. Estos planes son el **Story Arc** (Arco de la historia), los **Plot Twists** (Giros argumentales) y los **Party Arcs** (Arcos del grupo) de la vista **Show Spoilers** (Mostrar spoilers).

**Regenerate Lorebook** (Regenerar lorebook) aparece solo en tu última sesión concluida, y solo cuando la función Lorebook Keeper está activada. Un lorebook (libro de trasfondo) es un conjunto de hechos del mundo que la IA puede recordar.

## Compartir la configuración que creó un juego

Game Mode conserva una instantánea de la configuración usada para crear cada campaña nueva. Juega primero y luego comparte la combinación si funciona bien.

1. Abre la campaña y abre **Session**.
2. En **Session History**, despliega **Initial Game Setup** (Configuración inicial del juego).
3. Revisa la aventura guardada, el reparto, el modelo, el prompt (las instrucciones enviadas a la IA), los parámetros de generación, y los ajustes visuales, de storyboard (secuencia de viñetas) y de herramientas de mundo.
4. Haz clic en **Copy setup** (Copiar configuración) para copiar el texto, o en **Download setup** (Descargar configuración) para guardar un archivo de texto.

> **Advertencia:** El texto incluye tus preferencias largas de jugador y las instrucciones personalizadas del GM. Léelo antes de publicarlo. Las credenciales, las URL de servidor, las API keys (claves de API) y los ID de base de datos local nunca se incluyen.

Las tarjetas de personaje, las personas, los lorebooks, los modelos y las cuentas se nombran, pero no se empaquetan, así que otro jugador necesita sus propios equivalentes. Las campañas creadas antes de que existieran las instantáneas no pueden recuperar ajustes que nunca se guardaron, así que **Initial Game Setup** aparece solo cuando existe una instantánea fiable.

## Ver las notas ocultas del GM

**Show Spoilers** (el icono de ojo en la fila de la sesión actual) revela las notas privadas del GM para la sesión actual. Leerlas puede arruinar giros argumentales.

1. Abre **Session** y ve a **Session History**.
2. En la fila de la sesión actual, haz clic en **Show Spoilers** (el icono de ojo).

La vista puede mostrar **World Overview** (Visión general del mundo), **Story Arc**, **Plot Twists**, **Party Arcs**, y los **Maps** (Mapas), **NPCs** y **Character Cards** (Tarjetas de personaje) guardados. Haz clic en el mismo botón, que ahora dice **Hide Spoilers** (Ocultar spoilers), para ocultarlas.

Para cambiar estas notas, haz clic en **Edit Spoilers** (Editar spoilers), edita el texto y haz clic en **Save Spoilers** (Guardar spoilers). Algunos campos son JSON, un formato de texto estructurado. Edítalos solo si conoces el formato, porque un JSON incorrecto no se guardará.

<a id="editing-game-data-by-hand"></a>

## Editar los datos del juego a mano

Cuando el GM se equivoca en algo, como la reputación de un NPC o una misión que sigue abierta, puedes corregir tú mismo los datos guardados.

1. Abre **Game controls** (Controles del juego) y elige **Edit game data** (Editar datos del juego). En un teléfono, **Game controls** está en el menú de tres puntos **Chat tools** (Herramientas del chat).
2. Se abre la ventana **Game Data** (Datos del juego). Un aviso dice: "Hand edits can break a game. Every change is checked before it saves, and names can't change here." (Las ediciones a mano pueden romper una partida. Cada cambio se comprueba antes de guardarse y aquí no se pueden cambiar los nombres.)
3. Elige una sección de la lista (una fila de chips en un teléfono). El cuadro de búsqueda encuentra un valor en todas las secciones a la vez.
4. Cambia los valores en **Fields** (Campos), o cambia a **JSON** para los datos sin procesar.
5. Haz clic en **Review changes** (Revisar cambios) para ver exactamente qué cambia y luego haz clic en **Save changes** (Guardar cambios).

> **Advertencia:** Las ediciones a mano pueden corromper una partida. Antes de cada guardado, Marinara intenta crear un punto de control marcado como **Before a State Editor save** (Antes de un guardado del State Editor). Consulta [Cómo se guarda tu juego](#how-your-game-saves). Carga ese punto de control para deshacer una edición mala. Un juego tan nuevo que todavía no tiene guardado su primer turno aún no tiene nada que guardar en un punto de control.

Si no funcionó, el editor te dice por qué y conserva tu borrador para que puedas corregirlo. Si el juego cambió los mismos datos mientras editabas, el guardado se rechaza para que no deshaga el cambio del juego. **Reload** (Recargar) muestra la versión del juego y descarta tus borradores.

Puedes cambiar estas secciones: **Party Cards** (Tarjetas del grupo), **Party Sheet** (Ficha del grupo), **NPCs**, **Journal**, **Player Notes** (Notas del jugador), **Inventory** (Inventario), **Story** (Historia), **Session Summaries** (Resúmenes de sesión), **World Edits** (Ediciones del mundo), **Story Script** (Guion de historia) y **HUD Widgets** (Widgets del HUD). Una sección solo aparece cuando el juego tiene esos datos, así que un juego sin mundo no tiene **World Edits**. Secciones como **World** (Mundo), **Maps & Position** (Mapas y posición), **Time, Weather & Morale** (Hora, clima y moral), **Combat** (Combate) y **Settings** (Configuración) están marcadas como **Read-only** (Solo lectura): puedes leerlas y buscar en ellas, pero el juego las mantiene por su cuenta. Las preferencias de prompts, imágenes, música y dados se cambian en **Chat Settings** (Ajustes del chat).

Reglas que imponen las comprobaciones:

- Los nombres no se pueden cambiar, porque las tarjetas, los NPC, el grupo y las bolsas se encuentran entre sí por el nombre. Aquí no se pueden añadir ni quitar miembros del grupo.
- La reputación de un NPC va de -100 a 100.
- En **Inventory**, puedes cambiar la cantidad, el apodo y el portador de un objeto, y si se lleva puesto, está sintonizado o está activado. Deja fuera una pila para quitarla, o añade una sin id para añadir un objeto.
- En **Session Summaries**, solo se puede cambiar el texto de una sesión.
- **World Edits** guarda tus ediciones a mano sobre el mundo, como lugares renombrados o personas añadidas. El mundo en sí nunca cambia.

La ventana funciona como el State Editor de Roleplay. Consulta [El State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

<a id="how-your-game-saves"></a>

## Cómo se guarda tu juego

Game Mode guarda automáticamente. Tu mundo, tu grupo, el mapa, el inventario, el tiempo dentro del juego y los resúmenes de sesión se conservan mientras juegas, sin botón de guardar.

Marinara también registra puntos de control automáticos al inicio de la sesión, al final de la sesión, cuando empieza o termina el combate, cuando llegas a un lugar nuevo y a intervalos fijos. Conserva los cinco más recientes de cada tipo y elimina los más antiguos. El editor de datos del juego también intenta crear uno antes de cada guardado.

Para volver atrás:

1. Abre **Game controls → Checkpoints** (Controles del juego → Puntos de control). Aparecen del más reciente al más antiguo.
2. Haz clic en **Load** (Cargar) en el momento que quieras.

**Load** devuelve el juego a ese momento. El tracker, el mapa, las **World Edits**, la historia, las tarjetas y las fichas del grupo, los NPC, el diario, tus notas, el inventario, los resúmenes de sesión, los planes de historia del GM, los widgets del HUD, la hora, el clima y la moral vuelven todos atrás. Un mensaje del sistema marca el punto en que el juego retrocedió. Tus ajustes se quedan como están. **Delete** (Eliminar) borra un punto de control para siempre.

Para deshacer solo un turno malo, usa **Retry turn** (Reintentar turno) en **Game controls**, o usa un swipe (respuesta alternativa) para pasar a otra versión de la respuesta.

Para conservar tu propia copia de tus datos, consulta [Copia de seguridad y restauración](../data/backup-and-restore.md).

## Guías relacionadas

- [Game Mode: primeros pasos](getting-started.md)
- [Copia de seguridad y restauración](../data/backup-and-restore.md)
