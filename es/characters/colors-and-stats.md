# Colores del personaje y estadísticas RPG

Esta guía cubre la pestaña **Colors** (Colores) y la pestaña **Stats** (Estadísticas) en Marinara Engine. Ambas pestañas aparecen en el editor de personajes (Character editor) y en el editor de personas (Persona editor). Los colores cambian cómo se ve un personaje o tu persona en el chat. Las estadísticas configuran valores que se pueden seguir, como salud o hambre.

## La pestaña Colors

Cada personaje y cada persona tiene una pestaña **Colors** en su editor. Define tres colores: el color del nombre, el color del diálogo y el color del cuadro del mensaje. Deja cualquier campo vacío para usar el color predeterminado del tema de la app en esa parte.

Para abrir la pestaña Colors:

1. Abre un personaje en el Character editor, o una persona en el Persona editor.
2. Haz clic en la pestaña **Colors** de la lista de pestañas.
3. Deberías ver una tarjeta de **Preview** (Vista previa) en vivo y tres campos de color debajo.

La tarjeta de **Preview** muestra un nombre de ejemplo y una burbuja de mensaje de ejemplo. Se actualiza a medida que cambias cada color, para que veas el resultado antes de guardar.

### Extract Colors from Avatar

El botón **Extract Colors from Avatar** (Extraer colores del avatar) elige automáticamente un color de nombre, un color de diálogo y un color de cuadro del mensaje a partir de la imagen del avatar. El botón solo se activa cuando ya existe un avatar. Antes de que subas un avatar, el botón está desactivado y muestra **Upload an avatar first** (Sube primero un avatar). Después de la extracción, todavía puedes cambiar a mano cualquiera de los tres colores.

### Los tres colores

Define cada color con el campo de color, o escribe un valor:

- **Name Display Color** (Color del nombre): el color del nombre. Este campo también admite un gradiente CSS. Un gradiente es una mezcla suave entre colores. Valor de ejemplo: `linear-gradient(90deg, #f59e0b, #ef4444)`.
- **Dialogue Highlight Color** (Color de resalte del diálogo): el color del texto dentro de las comillas de diálogo. Valor de ejemplo: `#ffd700`.
- **Message Box Color** (Color del cuadro del mensaje): el color de fondo de la burbuja de mensaje del chat. Usa un color semitransparente para el mejor resultado. Valor de ejemplo: `rgba(0, 0, 0, 0.5)`.

Un color semitransparente deja ver parte del fondo a través de la burbuja. El formato `rgba` es rojo, verde, azul y un valor alfa que va de 0 (transparente) a 1 (sólido).

<a id="where-your-colors-show"></a>

## Dónde se muestran tus colores

Cada color afecta a una parte diferente del chat:

- El color del nombre da color al nombre que se muestra en los mensajes del chat. Para un personaje, también da color al nombre en las pestañas de la barra lateral. Para una persona, también da color al nombre en los selectores de persona.
- El color del diálogo da color al texto dentro de las comillas de diálogo. Funciona con comillas rectas y con otros estilos de comillas. También puedes poner este texto en negrita desde **Settings** (Configuración). Los chats de Conversation no lo usan.
- El color del cuadro del mensaje define el fondo de las burbujas de mensaje de ese personaje o persona en los chats de Roleplay. Los chats de Conversation y de Game no lo usan.

## La pestaña Stats

Cada personaje y cada persona también tiene una pestaña **Stats**. Las estadísticas son números como HP (puntos de salud), STR (fuerza) o una barra de hambre. Cuando activas las estadísticas, la app agrega los valores al prompt (instrucciones enviadas a la IA) para que la IA sepa el estado actual. Los valores que defines aquí son los valores predeterminados iniciales para los chats nuevos. Los agentes pueden cambiarlos luego durante el juego. Consulta la sección sobre agentes más abajo.

La pestaña **Stats** del personaje y la pestaña **Stats** de la persona tienen diseños distintos, así que cada una se describe por separado a continuación.

### Estadísticas del personaje: Enable RPG Stats

Un personaje tiene un interruptor: **Enable RPG Stats** (Activar estadísticas RPG). Cuando está desactivado, no se muestra ni se envía nada de lo que hay debajo. Cuando está activado, aparecen dos secciones:

- **Pools** (Reservas): barras con nombre, cada una con un valor actual, un máximo y un color. Los personajes nuevos empiezan con una reserva de HP y una reserva de MP, cada una en 100 de 100. Haz clic en **Add** (Agregar) para crear otra reserva. Haz clic en la X de una fila para quitarla.
- **Attributes** (Atributos): valores numéricos con nombre. Los personajes nuevos empiezan con STR, DEX, CON, INT, WIS y CHA, cada uno en 10. Haz clic en **Add** para crear otro atributo. Haz clic en la X de una fila para quitarla.

### Estadísticas de la persona: dos secciones

La pestaña **Stats** de una persona tiene dos bloques separados, cada uno con su propio interruptor.

El primer bloque es **Persona Status Bars** (Barras de estado de la persona), que se activa con **Enable Persona Stats** (Activar estadísticas de la persona). Estas barras siguen necesidades físicas y mentales. Cuando lo activas, las barras iniciales son Satiety, Energy, Hygiene y Mood, cada una en 100 de 100. En **Status Bars** administras la lista. Cada barra tiene un nombre, un valor actual, un máximo y un color. Haz clic en **Add** para crear una barra y en la X para quitar una.

El segundo bloque es **RPG Attributes** (Atributos RPG), que se activa con **Enable RPG Attributes** (Activar atributos RPG). Funciona como una tarjeta de personaje. Le da a tu persona **Pools** (que empiezan con HP y MP en 100 de 100) y **Attributes** (que empiezan con STR, DEX, CON, INT, WIS y CHA en 10).

<a id="ruleset-sheets"></a>

### Fichas de conjuntos de reglas

Cuando hay instalado un conjunto de reglas de Game Mode, como 5e (SRD 5.1), ambas pestañas **Stats** incluyen un bloque **Ruleset sheets** (Fichas de conjuntos de reglas) debajo de las secciones anteriores. Tiene una entrada desplegable por cada conjunto de reglas instalado. El bloque también aparece cuando una tarjeta todavía conserva una ficha de un conjunto de reglas que ya no tienes.

1. Abre la entrada y haz clic en **Add a sheet** (Añadir una ficha). Obtienes una ficha en blanco con cada valor en el predeterminado del conjunto de reglas.
2. Rellénala. El diseño lo define el propio conjunto de reglas: puntuaciones de características con sus modificadores, campos agrupados por sección, listas como ataques y conjuros, y las habilidades y salvaciones, cada una con un nivel de entrenamiento y una bonificación adicional. Los valores calculados, como una bonificación por competencia o la Percepción pasiva, se actualizan mientras escribes y no se pueden editar.
3. Guarda el personaje o la persona como de costumbre.

Una ficha aquí es la **configuración inicial** de ese personaje para ese conjunto de reglas. Una partida nueva con ese conjunto de reglas toma una copia. Los cambios hechos dentro de una partida se quedan en esa partida y nunca vuelven a la tarjeta.

Algunos conjuntos de reglas incluyen conjuros, ataques y rasgos ya preparados. Las listas que rellenan tienen un botón **Add from catalog** (Añadir desde el catálogo) que abre un selector con búsqueda, y las filas que añade son copias que puedes editar como cualquier otra. De eso se derivan dos cosas:

- Una celda que el conjunto de reglas mantiene por ti, como los usos que dependen de una puntuación de característica o un recurso de clase que crece con tu nivel, se muestra en su sitio pero no se puede escribir en ella, con la nota "Set by the ruleset". Se calcula a partir del resto de la ficha cada vez que la editas.
- Cuando el texto propio del conjunto de reglas para una de esas filas ha cambiado desde que la elegiste, una línea debajo de la lista indica cuántas filas tienen texto más reciente, con un botón **Review** (Revisar). La revisión muestra cada fila con lo que contiene tu ficha junto a lo que dice el conjunto de reglas, y una casilla por fila. **Update selected** (Actualizar seleccionadas) escribe las filas marcadas y nada más. Solo se compara el texto: los números, los interruptores y todo lo que escribiste en otra columna no se tocan, y tampoco ninguna fila que desmarques.

Una ficha de un conjunto de reglas que no tienes instalado se conserva, no se borra. Se muestra como una sola línea con un botón **Remove** (Quitar), nunca se envía a la IA y vuelve a ser editable cuando instalas ese conjunto de reglas. También viaja con la tarjeta cuando la exportas. Cada ficha tiene un límite de 64 KB.

Una ficha de un conjunto de reglas instalado que esta versión de Marinara no puede leer, por ejemplo una guardada por una versión más reciente, también se conserva tal cual. Su entrada solo ofrece **Remove this sheet** (Quitar esta ficha), así que añadir una ficha nueva nunca puede sobrescribirla por accidente.

Las fichas de conjuntos de reglas son independientes de **Enable RPG Stats** y **Enable RPG Attributes**. Una partida que usa las reglas propias de Marinara las ignora, y una partida con un conjunto de reglas las usa en lugar de los Attributes de arriba para sus pruebas.

## Cómo los agentes actualizan tus estadísticas

Los valores de la pestaña **Stats** se convierten en el estado inicial del chat. Los agentes pueden actualizar los valores de los trackers que se describen abajo. Los RPG Attributes como STR y DEX son contexto de la tarjeta, no valores de tracker gestionados por agentes.

- El agente **Character Tracker** ajusta las estadísticas registradas del personaje, incluidas las Pools como HP, según el combate, la curación y los eventos de la historia. No registra la persona del jugador.
- El agente **Persona Stats** ajusta tus **Persona Status Bars** después de cada mensaje, según lo que pasa en la historia.
- Los **RPG Attributes** del personaje y de la persona se envían con su tarjeta para el combate y Game Mode, y para las tiradas opcionales en Roleplay o Game Mode. Los agentes no actualizan esos Attributes.

Si no activas el agente de tracker correspondiente, los valores de los trackers se quedan en los predeterminados que definiste. La pestaña **Stats** por sí sola no actualiza nada por su cuenta. Consulta la guía de agentes integrados para activar estos agentes.

## Cómo se muestran las estadísticas en el HUD

Cuando las estadísticas están activadas, aparecen en el widget del HUD (barra de estado en pantalla) durante un chat. HUD significa heads-up display, un panel pequeño que muestra tus valores en vivo. Las barras se muestran como gradientes con código de color para que puedas leerlas de un vistazo. La guía del HUD cubre la pantalla completa y cómo moverlo u ocultarlo.

## Guías relacionadas

- [Crear y editar personajes](creating-and-editing-characters.md)
- [Personas del usuario: crear y editar](personas.md)
- [HUD y trackers](../roleplay/hud-and-trackers.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
