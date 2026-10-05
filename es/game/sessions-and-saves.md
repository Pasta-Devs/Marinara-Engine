# Game Mode: Sesiones y partidas guardadas

Esta guía explica cómo Marinara Engine registra tu progreso en Game Mode (modo de juego) a lo largo de las sesiones de juego. Cubre cómo terminar y empezar una sesión y cómo leer sesiones pasadas en **Session History** (Historial de sesiones). También cubre la vista **Show Spoilers** (Mostrar spoilers) y cómo el juego guarda tus datos.

## Qué es una sesión

Game Mode divide tu aventura en sesiones numeradas. Una sesión es un tramo continuo de juego, como una sola noche de juego de mesa. El Game Master (GM, la IA que dirige tu juego, es decir, el director del juego) narra cada sesión. Cuando terminas una sesión, el GM escribe un resumen que puedes releer más tarde.

Tu primera sesión es **Session 1**. Terminarla y empezar de nuevo crea **Session 2**, y así sucesivamente.

<a id="opening-session"></a>

## Abrir Session

En **Session** terminas sesiones, empiezas otras y lees tu historial.

1. Inicia o abre un chat de Game Mode para ver la pantalla del juego.
2. Haz clic o toca el botón **Session** (la pluma). Empieza cerca de la esquina superior derecha del chat. Puedes arrastrarlo a otro sitio; consulta [Ventanas de controles y sus botones](../chats/chat-settings.md#control-windows-and-their-buttons).
3. **Session** se abre como ventana en computadora o panel de ancho completo en teléfono. Su primera línea muestra **Session** con el número y el estado actuales.
4. Tiene dos pestañas: **Session History** y **Journal**. Quédate en **Session History** para los controles de sesión y para compartir la configuración.

Si usaste **Put back in Chat Settings** para guardar esta ventana, abre la sección **Session** dentro de Chat Settings.

## Compartir la configuración que creó un juego

Game Mode conserva una instantánea inmutable de la configuración usada para crear cada campaña nueva. Esto te permite jugar primero, decidir que la combinación funciona bien y compartirla después sin anotar manualmente cada campo antes de empezar.

1. Abre la campaña de Game Mode que quieres compartir.
2. Abre **Session** (el botón de la pluma).
3. Quédate en **Session History**, luego despliega **Initial Game Setup** (Configuración inicial del juego).
4. Revisa la aventura guardada, el reparto, el modelo, el prompt (las instrucciones enviadas a la IA), los parámetros de generación efectivos, y los ajustes visuales, de storyboard (secuencia de viñetas) y de herramientas de mundo.
5. Haz clic en **Copy setup** (Copiar configuración) para poner el texto en tu portapapeles, o en **Download .txt** (Descargar .txt) para guardar un archivo de texto que puedas compartir.

El texto copiado incluye preferencias largas del jugador e instrucciones personalizadas del GM. Léelo antes de publicarlo si esos campos contienen material privado. Las credenciales de conexión, las URL de servidor, las API keys (claves de API) y los ID de base de datos local nunca se incluyen. Las tarjetas de personaje, las personas, los lorebooks (libros de trasfondo), los modelos y las cuentas de proveedor se nombran como referencia, pero no se empaquetan, así que otro jugador debe tener o seleccionar sus propios equivalentes locales.

Las campañas creadas antes de que se añadieran las instantáneas de configuración no pueden recuperar preferencias que nunca se guardaron, así que **Initial Game Setup** aparece solo cuando hay disponible una instantánea de creación fiable.

## Terminar una sesión

Termina una sesión cuando quieras cerrar el capítulo actual y dejar que el GM lo resuma.

1. Abre **Session** y quédate en la pestaña **Session History**.
2. Arriba ves la sesión actual, etiquetada como **Session N (Current)**.
3. En esa fila, haz clic en el botón **End Session** (Terminar sesión) (el pequeño icono de cuadrado junto a **Show Spoilers**).
4. Se abre una ventana titulada **End Session** que te pide confirmar.
5. Si quieres, escribe en el cuadro etiquetado **What do you want to happen in the next session (optional)?** (¿Qué quieres que pase en la próxima sesión (opcional)?). Puedes escribir hasta 5000 caracteres.
6. Deja ese cuadro vacío para dejar que el GM guíe la historia de forma natural.
7. Haz clic en **End Session** en la ventana para confirmar, o haz clic en **Cancel** (Cancelar) para retroceder.

Después de confirmar, el motor genera un resumen. Espera en esta pantalla hasta que termine. Mientras trabaja, el título de la ventana dice **Ending Session** (Terminando sesión). Cuando termina, la sesión se marca como concluida y aparece en tu historial.

## Empezar una nueva sesión

Una vez que la sesión actual está concluida, el mismo botón cambia a **New Session** (Nueva sesión).

1. Abre **Session** y ve a la pestaña **Session History**.
2. En la fila de la sesión actual, haz clic en el botón **New Session** (el icono de reproducir).
3. El GM reanuda la historia. Usa el resumen de la última sesión y cualquier nota para la próxima sesión que hayas escrito al terminarla.

## Leer sesiones pasadas

La pestaña **Session History** lista tus sesiones concluidas, la más reciente primero. Antes de terminar una, muestra **No completed sessions yet** (Aún no hay sesiones completadas).

Cada fila muestra el número de sesión, la fecha y cuántos descubrimientos registró. Haz clic en una fila para desplegarla. Una sesión desplegada puede mostrar estos campos:

- **Summary** (Resumen): qué pasó durante la sesión.
- **Resume Point** (Punto de reanudación): cómo debería retomar la próxima sesión.
- **Party Dynamics** (Dinámica del grupo): cómo se relacionaron entre sí los miembros de tu grupo.
- **Key Discoveries** (Descubrimientos clave): hechos, giros y revelaciones importantes.
- **Character Moments** (Momentos de personaje): momentos destacados de los personajes.
- **Little Details To Recall** (Pequeños detalles para recordar): hábitos, promesas o detalles pequeños.
- **NPC Updates** (Actualizaciones de NPC): cambios en los NPC (personajes no jugadores, la gente que controla el GM).
- **Next Session Request** (Petición para la próxima sesión): la nota que dejaste al terminar la sesión.
- **Stats Snapshot** (Instantánea de estadísticas) y **Party Status** (Estado del grupo): números y estado del grupo guardados.

### Volver a reproducir una sesión completada

Las sesiones completadas se pueden volver a reproducir sin cambiar tu campaña.

1. Despliega una sesión concluida en **Session History**.
2. Haz clic en **Replay Session** (Volver a reproducir sesión).
3. Usa **Next** (Siguiente) y **Next turn** (Siguiente turno) para avanzar por la narración y el diálogo originales.
4. Cuando la reproducción llega a una elección, solo la opción que seleccionaste durante la sesión original está activada. Haz clic en ella para continuar por el camino registrado.
5. Haz clic en el botón de cerrar en la parte superior de la reproducción o en **Return to current session** (Volver a la sesión actual) cuando hayas terminado.

La reproducción es de solo lectura. No llama al GM, no crea mensajes, no cambia el inventario ni las estadísticas, no actualiza el diario ni restaura un punto de control. Las sesiones creadas antes de que existiera la compatibilidad con la reproducción aún pueden usar su texto guardado, los efectos en línea, las elecciones y los recursos disponibles. Un turno más antiguo puede omitir un efecto de escena que no se guardó cuando ese turno se jugó originalmente.

### Editar una sesión pasada

Puedes editar a mano las notas de una sesión concluida para que las sesiones futuras las recuerden correctamente.

1. Despliega la sesión que quieres cambiar.
2. Haz clic en **Edit Details** (Editar detalles).
3. Cambia cualquier campo, luego haz clic en **Save Details** (Guardar detalles). Haz clic en **Cancel** para descartar tus ediciones.

Aparecen dos botones más en una sesión desplegada:

- **Regenerate** (Regenerar): vuelve a ejecutar la conclusión de la IA para esa sesión. Esto reescribe el resumen y todos los demás campos de la entrada. Cualquier cambio que hayas hecho con **Edit Details** se perderá.
- **Update Plot Arcs** (Actualizar arcos argumentales): pide a la IA que actualice los planes de historia ocultos del GM usando los eventos de esa sesión. Estos planes son el **Story Arc** (Arco de la historia), los **Plot Twists** (Giros argumentales) y los **Party Arcs** (Arcos del grupo) que se muestran en la vista **Show Spoilers**.

Un botón **Regenerate Lorebook** (Regenerar lorebook) aparece solo en tu última sesión concluida, y solo cuando la función opcional Lorebook Keeper está activada. Un lorebook es un conjunto de hechos del mundo que la IA puede recordar.

## La vista Show Spoilers

**Show Spoilers** revela las notas ocultas del GM para la sesión actual. Normalmente se mantienen en secreto para ti durante el juego. Leerlas puede arruinar giros argumentales.

1. Abre **Session** y ve a la pestaña **Session History**.
2. En la fila de la sesión actual, haz clic en **Show Spoilers** (el icono de ojo).
3. Aparece el estado privado del GM.

La vista de spoilers puede mostrar estas secciones:

- **World Overview** (Visión general del mundo): la ambientación a grandes rasgos.
- **Story Arc** (Arco de la historia): la dirección planificada de la historia.
- **Plot Twists** (Giros argumentales): sorpresas que el GM está reservando.
- **Party Arcs** (Arcos del grupo): viajes planificados para tu grupo.
- **Maps** (Mapas), **NPCs** y **Character Cards** (Tarjetas de personaje): los datos guardados del juego.

Para ocultar las notas de nuevo, haz clic en el mismo botón. Ahora dice **Hide Spoilers** (Ocultar spoilers).

También puedes editar estos secretos, lo que funciona como un panel de trucos de director del juego. Haz clic en **Edit Spoilers** (Editar spoilers), cambia el texto, luego haz clic en **Save Spoilers** (Guardar spoilers). Algunos campos se muestran como JSON, un formato de texto estructurado. Edita los campos JSON solo si entiendes el formato, ya que un JSON incorrecto no se guardará.

## Cómo se guarda tu juego

Game Mode guarda tu progreso automáticamente. No necesitas pulsar un botón de guardar. Tu mundo, tu grupo, el mapa, el inventario, el tiempo dentro del juego y los resúmenes de sesión se conservan por ti mientras juegas.

La app también registra puntos de control automáticos entre bastidores. Captura un punto de control al inicio de la sesión, al final de la sesión y cuando empieza o termina el combate. Actualmente no hay ninguna pantalla dentro de la app para explorar o restaurar estos puntos de control. Así que no cuentes con cargar un punto de control antiguo para deshacer un turno.

Para conservar tu propia copia de tus datos, usa las herramientas de copia de seguridad de la app. Consulta [Copia de seguridad y restauración](../data/backup-and-restore.md).

## Guías relacionadas

- [Game Mode: Primeros pasos](getting-started.md)
- [Copia de seguridad y restauración](../data/backup-and-restore.md)
