# Colores del personaje y estadísticas de historia

Las pestañas **Colors** (Colores) y **Stats** (Estadísticas) aparecen tanto en el Character Editor como en el Persona Editor. Los colores cambian cómo se ve un personaje o una persona en el chat. Las estadísticas configuran valores que puedes seguir, como la salud o el hambre.

## La pestaña Colors

La pestaña **Colors** define tres colores: el color del nombre, el color del diálogo y el color del cuadro del mensaje. Deja un campo vacío para usar el color del tema de la app en esa parte.

1. Abre un personaje o una persona en su editor.
2. Haz clic en la pestaña **Colors**.
3. Una tarjeta **Preview** (Vista previa) en vivo muestra un nombre y una burbuja de mensaje de ejemplo, con los campos de color debajo. La vista previa se actualiza a medida que cambias cada color, antes de guardar.

### Extract Colors from Avatar

**Extract Colors from Avatar** (Extraer colores del avatar) elige los tres colores a partir de la imagen del avatar. Antes de que exista un avatar, el botón está desactivado y dice **Upload an avatar first** (Sube primero un avatar). Después puedes seguir cambiando cualquier color a mano.

### Los tres colores

Define cada uno con el campo de color, o escribe un valor:

| Campo | Qué colorea | Valor de ejemplo |
| --- | --- | --- |
| **Name Display Color** (Color del nombre) | El nombre. También admite un gradiente; consulta más abajo. | `#f59e0b` |
| **Dialogue Highlight Color** (Color de resalte del diálogo) | El texto dentro de las comillas de diálogo. | `#ffd700` |
| **Message Box Color** (Color del cuadro del mensaje) | El fondo de la burbuja de mensaje de Roleplay. | `#123456` |

**Name Display Color** también admite un gradiente CSS, una mezcla suave entre colores:

```text
linear-gradient(90deg, #f59e0b, #ef4444)
```

La pestaña **Colors** de un personaje también tiene **Name Aliases** (Alias del nombre). Escribe nombres o apodos adicionales, separados por comas, como `Kate, Kitty, Katherine`. Reciben el color del nombre del personaje cuando aparecen en los mensajes del chat. El nombre principal siempre se incluye. Actívalo por chat en **Chat Settings → Characters** (Ajustes del chat → Personajes).

Para cambiar la transparencia, usa **Settings → Appearance → Roleplay Presentation → Roleplay Messages Background Opacity** (Configuración → Apariencia → Presentación de Roleplay → Opacidad del fondo de los mensajes de Roleplay).

El control deslizante reemplaza la transparencia guardada en los colores de fondo de personajes, personas y presets (ajustes guardados), incluidos los extraídos. Tus valores de color guardados se mantienen tal como están. Los colores del nombre y del diálogo no se ven afectados.

Los puntos de personalización del fondo de los temas personalizados y el CSS de la tarjeta pueden seguir anulando el estilo de las burbujas de la app.

<a id="where-your-colors-show"></a>

### Dónde se muestran tus colores

- El color del nombre da color al nombre visible en los mensajes del chat. Para un personaje, también da color al nombre en las pestañas de la barra lateral. Para una persona, también da color al nombre en los selectores de persona.
- El color del diálogo da color al texto dentro de las comillas de diálogo, tanto con comillas rectas como con otros estilos de comillas. También puedes poner este texto en negrita en **Settings** (Configuración). Los chats de Conversation no lo usan.
- El color del cuadro del mensaje define el fondo de las burbujas de mensaje de ese personaje o persona en los chats de Roleplay. Los chats de Conversation y de Game no lo usan.

## La pestaña Stats

La pestaña **Stats** define números como HP (puntos de salud), STR (fuerza) o una barra de hambre. Cuando activas las estadísticas, Marinara agrega los valores al prompt (las instrucciones enviadas a la IA) para que la IA sepa el estado actual. Los valores que defines son los predeterminados de inicio para los chats nuevos. Luego, los agentes pueden cambiar algunos durante el juego (consulta [Cómo los agentes actualizan tus estadísticas](#how-agents-update-your-stats)).

Las pestañas **Stats** del personaje y de la persona tienen diseños distintos.

### Estadísticas del personaje

Un personaje tiene un interruptor, **Enable story stats** (Activar estadísticas de historia). Si está desactivado, no se muestra ni se envía nada de lo que hay debajo. Si está activado, aparecen dos secciones:

- **Pools** (Reservas) son barras con nombre, con un valor actual, un máximo y un color. Los personajes nuevos empiezan con HP y MP, cada uno en 100 de 100.
- **Attributes** (Atributos) son números con nombre. Los personajes nuevos empiezan con STR, DEX, CON, INT, WIS y CHA, cada uno en 10.

Haz clic en **Add** (Agregar) para crear una reserva o un atributo, y en la X de una fila para quitarla.

### Estadísticas de la persona

La pestaña **Stats** de una persona tiene dos bloques separados, cada uno con su propio interruptor.

- **Persona Status Bars** (Barras de estado de la persona), que se activan con **Enable Persona Stats** (Activar estadísticas de la persona), siguen necesidades físicas y mentales. Las barras iniciales son Satiety, Energy, Hygiene y Mood, cada una en 100 de 100. En **Status Bars**, cada barra tiene un nombre, un valor actual, un máximo y un color. Haz clic en **Add** para crear una y en la X para quitar una.
- **Enable story stats** (Activar estadísticas de historia) funciona como en una tarjeta de personaje. Le da a tu persona **Pools** (que empiezan con HP y MP en 100 de 100) y **Attributes** (que empiezan con STR, DEX, CON, INT, WIS y CHA en 10).

<a id="mrpg-picks-on-a-card"></a>

### Elecciones MRPG en una tarjeta

Ambas pestañas **Stats** tienen una sección **Game Mode** con un bloque **MRPG**, para partidas con clases MRPG (todas las partidas nuevas). Cada partida genera de nuevo las estadísticas MRPG de cada personaje, por lo que la tarjeta no contiene números, solo tres elecciones:

- **Starting tree** (Árbol inicial): el árbol en el que empieza el personaje. **Auto** lo deduce de la descripción y la personalidad de la tarjeta, y muestra qué árbol da como resultado.
- **Strong in** (Fuerte en): hasta dos estadísticas en las que el personaje progresa bien.
- **Weak in** (Débil en): una estadística en la que progresa poco.

El bloque muestra una vista previa de la clase con la que empezaría una partida nueva, en el nivel 1, junto con su fila y sus valores iniciales de HP, MP y Stamina. Las elecciones fuertes y débiles inclinan el crecimiento oculto del personaje en cada partida. Su árbol hermano procede de su temperamento en la partida, no de la tarjeta. Consulta [Game Mode: clases MRPG](../game/mrpg-classes.md#choose-a-characters-trees).

En una tarjeta de personaje, **Story stats** (Estadísticas de historia), debajo de ese bloque, oculta de forma plegable las reservas y los atributos descritos arriba. Los chats de Roleplay y las partidas Legacy los usan. Una partida MRPG usa en su lugar el bloque de clase y nunca crea una ficha a partir de ellos.

<a id="game-mode-icon"></a>

### Icono de Game Mode

Ambas pestañas **Stats** tienen un bloque **Game Mode Icon** (Icono de Game Mode). Define la imagen de la ficha redonda de este personaje o persona en el tablero durante un combate de Game Mode. Una ficha pequeña junto a las opciones muestra lo que dibujará el tablero.

- **Avatar** es la opción predeterminada. Usa el avatar, o las iniciales cuando no hay avatar.
- **Custom image** (Imagen personalizada) usa una imagen de la galería de la propia tarjeta. Elige una de las que se muestran ahí, o sube una nueva, que se añade a la galería. Guarda la tarjeta una vez antes de usar esta opción.
- **Initials** (Iniciales) muestra siempre las iniciales, incluso con un avatar.

La misma imagen se muestra para este personaje en los demás estilos de combate. Si borras la imagen elegida de la galería, el bloque lo indica. Elige otra o vuelve a **Avatar**.

<a id="ruleset-sheets"></a>

### Fichas de conjuntos de reglas

Cuando hay instalado un conjunto de reglas de Game Mode, como 5e (SRD 5.1), ambas pestañas **Stats** incluyen un bloque **Ruleset sheets** (Fichas de conjuntos de reglas) debajo de las secciones anteriores. Tiene una entrada desplegable por cada conjunto de reglas instalado. También aparece cuando una tarjeta todavía conserva una ficha de un conjunto de reglas que ya no tienes.

Una ficha es la configuración inicial de ese personaje para ese conjunto de reglas. Una partida nueva con ese conjunto de reglas toma una copia. Los cambios hechos dentro de una partida se quedan en esa partida y nunca vuelven a la tarjeta.

1. Abre la entrada y haz clic en **Add a sheet** (Añadir una ficha). Obtienes una ficha en blanco con cada valor en el predeterminado del conjunto de reglas.
2. Rellénala. El diseño lo define el conjunto de reglas: puntuaciones de características con sus modificadores, campos agrupados por sección, listas como ataques y conjuros, y habilidades y salvaciones con un nivel de entrenamiento y una bonificación adicional. Los valores calculados, como una bonificación por competencia o la Percepción pasiva, se actualizan mientras escribes y no se pueden editar.
3. Guarda el personaje o la persona como de costumbre.

También puedes pedirle a Professor Mari que rellene o cambie una ficha, por ejemplo "dale a Rook un Brawn de 2 y añade una palanca al equipo de Rook". Solo escribe la ficha de ese conjunto de reglas, mantiene todos los valores dentro de los límites del conjunto de reglas y muestra el cambio en una tarjeta de cambios.

Algunos conjuntos de reglas incluyen conjuros, ataques y rasgos ya preparados. Las listas que rellenan tienen un botón **Add from catalog** (Añadir desde el catálogo) que abre un selector con búsqueda. Las filas que añade son copias que puedes editar como cualquier otra.

- Una celda que el conjunto de reglas mantiene por ti, como los usos que dependen de una puntuación de característica o un recurso de clase que crece con el nivel, se muestra en su sitio pero no se puede escribir en ella. Lleva la nota "Set by the ruleset" y se vuelve a calcular cada vez que editas la ficha.
- Cuando el texto propio del conjunto de reglas para una de esas filas ha cambiado desde que la elegiste, una línea debajo de la lista indica cuántas filas tienen texto más reciente, con un botón **Review** (Revisar). La revisión muestra cada fila con tu texto junto al del conjunto de reglas, y una casilla por fila. **Update selected** (Actualizar seleccionadas) escribe solo las filas marcadas. Solo se compara el texto. Los números, los interruptores y todo lo que escribiste en otra columna no se tocan.

Una ficha de un conjunto de reglas que no tienes instalado se conserva. Se muestra como una sola línea con un botón **Remove** (Quitar), nunca se envía a la IA, vuelve a ser editable cuando instalas ese conjunto de reglas y viaja con la tarjeta cuando la exportas. Una ficha de un conjunto de reglas instalado que esta versión no puede leer, como una guardada por una versión más reciente, también se conserva tal cual. Su entrada solo ofrece **Remove this sheet** (Quitar esta ficha), así que una ficha nueva nunca puede sobrescribirla por accidente. Cada ficha tiene un límite de 64 KB.

Las fichas de conjuntos de reglas son independientes de **Enable story stats** (Activar estadísticas de historia). Una partida con las reglas propias de Marinara las ignora. Una partida con un conjunto de reglas usa la ficha en lugar de los Attributes de arriba para sus pruebas.

<a id="how-agents-update-your-stats"></a>

## Cómo los agentes actualizan tus estadísticas

La pestaña **Stats** define el estado inicial del chat. Los agentes solo actualizan los valores que pertenecen a los trackers.

| Valor | Quién lo cambia |
| --- | --- |
| **Pools** del personaje, como HP | El agente **Character Tracker**, a partir del combate, la curación y los eventos de la historia. No sigue la persona del jugador. |
| **Persona Status Bars** | El agente **Persona Stats**, después de cada mensaje. |
| **Story stats** (Estadísticas de historia), como STR y DEX | Ningún agente. Se envían con la tarjeta para el combate y Game Mode, y para las tiradas opcionales en Roleplay o Game Mode. |

Si no activas el agente correspondiente, los valores de los trackers se quedan en los predeterminados que definiste. La pestaña **Stats** por sí sola no actualiza nada durante el juego. Para activar estos agentes, consulta [Referencia de agentes descargables](../agents/built-in-agents.md).

## Cómo se muestran las estadísticas en el HUD

Las estadísticas activadas aparecen en el HUD durante un chat. El HUD es el panel pequeño que muestra tus valores en vivo. Las barras se muestran como gradientes con código de color. Consulta [HUD y trackers](../roleplay/hud-and-trackers.md) para saber cómo moverlo u ocultarlo.

## Guías relacionadas

- [Crear y editar personajes](creating-and-editing-characters.md)
- [Personas](personas.md)
- [HUD y trackers](../roleplay/hud-and-trackers.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
