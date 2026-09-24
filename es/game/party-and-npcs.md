# Game Mode: grupo y NPC

Esta guía cubre a las personas de tu campaña en Game Mode: los miembros de tu grupo (de aventura) y los NPC (personajes no jugadores) que presenta el Game Master. Aprenderás a abrir las hojas de personaje del grupo, editarlas o regenerarlas, y a leer el Adventure Journal, incluidas las etiquetas de reputación de los NPC. También se explican los dos modos de Game Master.

Game Mode es uno de los modos de chat de Marinara Engine. Ejecuta un RPG (juego de rol) para un solo jugador con un Game Master (director del juego) de IA, a menudo abreviado como GM. Para la configuración y lo básico, consulta [Game Mode: primeros pasos](getting-started.md).

## La barra del grupo

La barra del grupo muestra los personajes que viajan contigo. Se ubica cerca de la parte superior de la pantalla del juego.

En una pantalla de computadora, es una fila horizontal de pequeños retratos de personajes. En un teléfono, la barra se contrae en un solo avatar. Cuando tienes más de un miembro del grupo, ese avatar muestra una insignia con el número. Tócalo para abrir la lista de miembros del grupo. Con un solo miembro, tocar el avatar abre la hoja de ese personaje directamente.

Esto es lo que puedes hacer con la barra del grupo:

1. Haz clic o toca un retrato para abrir la hoja de ese personaje.
2. Pasa el cursor sobre un retrato (en computadora) para mostrar un pequeño botón **X**.
3. Haz clic en la **X** para quitar a ese personaje del grupo.

Puedes quitar a cualquier compañero que haya reclutado el Game Master, tanto si se unió durante la configuración como más tarde en la historia. Tu propia persona es el personaje que interpretas. No tiene botón **X**, así que no puedes quitarte a ti mismo del grupo.

## Hojas de personaje

Una hoja de personaje es un resumen específico del juego de un miembro del grupo. Es distinta de la tarjeta de personaje. El Game Master la escribe a partir de tu personaje y de la historia actual.

Abre una hoja haciendo clic en el retrato de ese personaje en la barra del grupo. La hoja muestra cualquiera de estas secciones que tenga contenido:

- **Attributes** (Atributos): puntuaciones al estilo de mesa como STR, DEX y CON, cada una con un modificador.
- **Stats** (Estadísticas): barras de recursos como HP o MP.
- **Abilities** (Habilidades): cosas que el personaje puede hacer.
- **Strengths** (Fortalezas) y **Weaknesses** (Debilidades): listas cortas.
- **Details** (Detalles): datos adicionales como Skills, Weapon o Faction.
- **Inventory** (Inventario): objetos que lleva el personaje.
- **Traits** (Rasgos): otros campos personalizados.

Si un personaje es nuevo, puede que veas "Character data will populate as the story progresses" (Los datos del personaje se completarán a medida que avance la historia). La hoja se va rellenando mientras juegas.

### Regenerar una hoja con IA

Haz clic en **Regenerate Sheet** (Regenerar hoja) para que la IA reescriba la hoja de ese personaje. Usa el personaje y el contexto actual del juego. Esto es útil después de que la historia haya cambiado mucho a un personaje.

### Editar una hoja a mano

Haz clic en **Edit Sheet** (Editar hoja) para cambiar la hoja tú mismo. En el modo de edición puedes establecer lo siguiente:

- **Class** (Clase) y una descripción corta en **Sheet Details** (Detalles de la hoja).
- **RPG Attributes** (Atributos de RPG): activa **Enable** (Activar) para llevar el registro de reservas al estilo de HP y de atributos. Usa **Add Pool** (Añadir reserva) para agregar una barra (nombre, valor actual, valor máximo y color). Usa **Add Attribute** (Añadir atributo) para agregar una puntuación como STR.
- **Abilities**, **Strengths** y **Weaknesses**: usa **Add** (Añadir) para agregar una línea.
- **Details**: usa **Add Detail** (Añadir detalle) para agregar un dato con etiqueta.

Cuando termines, haz clic en **Save Sheet** (Guardar hoja). Haz clic en **Cancel** (Cancelar) para descartar tus cambios.

<a id="the-ruleset-sheet"></a>

### La ficha del conjunto

En una [partida con conjunto de reglas](dice-and-skill-checks.md#games-that-use-a-ruleset), la ficha de cada personaje empieza con **Ruleset sheet**. Su estructura depende del conjunto; sin conjunto no aparece.

- **Resources** muestra valor actual y máximo de salud, espacios de conjuro o recursos de clase. Usa los botones de más y menos o escribe un número. **Temp** es un margen temporal.
- **Tracks** son contadores limitados, como agotamiento.

- **Wound tracks** (Contadores de heridas) muestran una fila de casillas en vez de un número, para sistemas que marcan el daño en vez de sumarlo. Cada casilla indica el nombre de ese grado de herida y cuánto resta a tus tiradas. Elige primero el tipo de daño si el conjunto ofrece varios y usa **Mark** (Marcar) o **Clear one** (Borrar una). También puedes hacer clic en la siguiente casilla vacía para añadir una marca o en la última marcada para quitarla; las demás no responden. Una marca más grave ocupa la casilla superior y desplaza hacia abajo las más leves; la línea inferior indica la penalización activa y lo que no haya cabido en el contador. Si lo define el conjunto, esa penalización se aplica a tus tiradas: resta dados de una reserva o se añade a una tirada sumada, y la tarjeta de dados indica cuánto se aplicó.
- **Notes** guarda notas cortas, como concentración.
- **Conditions** activa y desactiva estados.
- Los descansos recuperan lo que indica el conjunto. En 5e (SRD 5.1), un descanso largo recupera salud, espacios y la mitad de los dados de golpe, con un mínimo de uno.
- Debajo se resumen atributos, habilidades y salvaciones entrenadas y valores elegidos, como la clase de armadura.

El GM puede registrar gasto de recursos, daño, curación, estados y descansos; el motor valida los cambios. Una operación imposible, como lanzar sin espacios disponibles, se rechaza completa con un aviso.

Usar una entrada de catálogo paga todo su coste y un uso de cada contador de fila asociado. El espacio de conjuro se paga al nivel declarado; el GM puede pedir uno superior, pero el motor nunca lo aumenta por su cuenta. Si falta cualquier parte del coste, no se gasta nada. Las acciones gratuitas, como trucos, solo se narran. Los máximos por nivel y usos por atributo se recalculan al editar.

El estado pertenece al mensaje. Cambiar la variante de respuesta o regenerarla restaura la ficha anterior al turno, evitando gastos dobles. **Edit sheet** modifica configuración, listas, entrenamiento y bonos con el mismo editor y catálogo de la tarjeta, valores de solo lectura y **Review** para textos nuevos. **Save sheet** cambia solo la copia de esta partida. El botón separado **Edit Sheet** sigue editando la ficha general. Si el paquete falta o es antiguo, aparece una advertencia y las pruebas se bloquean hasta restaurarlo.

## Reclutar y quitar miembros del grupo

El Game Master controla quién está en tu grupo a medida que se desarrolla la historia. No hay un botón manual de "añadir compañero". En su lugar, el GM agrega o quita miembros del grupo mediante la narración, según lo que ocurre en la escena.

Para soltar a un compañero tú mismo, usa el botón **X** de la barra del grupo, como se describió arriba. No puedes quitar tu propia persona de esta manera.

## El Adventure Journal

El Adventure Journal (Diario de aventura) es un registro continuo de tu campaña. Se construye a partir de eventos guardados del juego, no lo escribe la IA, así que se mantiene fiel a los hechos.

Haz clic en el botón **Session** (Sesión) de la barra de herramientas superior y luego elige la pestaña **Journal** (Diario). Se abre un panel Journal con estas pestañas:

- **Timeline** (Cronología): una lista de lo que ha pasado, como lugares encontrados, encuentros con NPC, resultados de combate, misiones y eventos de objetos.
- **NPCs**: los NPC que has conocido, con retratos y etiquetas de reputación (ver abajo).
- **Map** (Mapa): una lista simple de los nombres de lugares que has descubierto.
- **Items** (Objetos): un registro de los objetos que adquiriste, usaste, perdiste o quitaste.
- **Library** (Biblioteca): notas y libros del mundo del juego que el Game Master te ha mostrado, guardados para que puedas leerlos de nuevo.
- **Notes** (Notas): tu propio bloc de notas de texto libre.

### Notas del jugador

La pestaña **Notes** es tu bloc de notas personal. Escribe a la izquierda y una vista previa con formato se muestra a la derecha. Un aviso encima del bloc de notas advierte que tus notas son visibles para el Game Master y los miembros del grupo. Eso significa que cualquier cosa que escribas aquí puede influir en la historia.

Tus notas se guardan solas un momento después de que dejas de escribir. Una pequeña etiqueta muestra **Saving...** (Guardando...) mientras guarda y **Saved** (Guardado) cuando termina.

## Etiquetas de reputación de los NPC

La pestaña **NPCs** del Adventure Journal lleva el registro de cómo se siente cada NPC respecto a ti. Cada NPC listado muestra un retrato, un nombre y una etiqueta de reputación.

La etiqueta de reputación cambia según cómo actúas en la historia. Es una de estas siete, de mejor a peor:

| Etiqueta | Significado |
|---|---|
| **Devoted** | Profundamente leal a ti |
| **Allied** | Aliado fuerte |
| **Friendly** | Positivo |
| **Neutral** | Sin sentimiento marcado |
| **Unfriendly** | Negativo |
| **Hostile** | Se volvió en tu contra |
| **Enemy** | Activamente opuesto |

Una etiqueta aparece solo después de que la reputación de un NPC se ha alejado del punto de partida. Un NPC totalmente nuevo con la reputación sin cambios aún no muestra etiqueta.

Un NPC aparece en esta pestaña una vez que el Game Master lo ha descrito, le ha dado una reputación o ha registrado una nota de relación. Cada fila de NPC también ofrece estas acciones:

- Subir o reemplazar el retrato del NPC.
- Generar un retrato con IA, si la generación de imágenes está activada.
- Quitar el NPC del diario.

## Modos de Game Master

Eliges quién dirige el juego en el asistente de configuración, en el paso **Party** (Grupo), bajo **Game Master Mode** (Modo de Game Master). Hay dos opciones:

- **Standalone GM**: la predeterminada. Marinara construye un game master por ti. El asistente lo describe como "A snarky narrator running the show" (Un narrador sarcástico dirigiendo el espectáculo). No necesitas una tarjeta de personaje.
- **Character GM**: usa una de tus propias tarjetas de personaje como Game Master. El motor le dice al modelo que actúe como ese personaje mientras sigue dirigiendo el juego. Elige esta opción cuando quieras una voz de narrador específica.

Si es tu primer juego, usa **Standalone GM**. Puedes establecer el modo cuando creas el juego. Para el recorrido completo de configuración, consulta [Game Mode: primeros pasos](getting-started.md).

## Guías relacionadas

- [Game Mode: primeros pasos](getting-started.md)
- [Game Mode: sesiones y partidas guardadas](sessions-and-saves.md)
