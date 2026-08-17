# Entradas de lorebook: palabras clave, posición y tiempos

Esta guía explica cómo construir las entradas dentro de un lorebook (libro de trasfondo). Cubre la pestaña **Entries** (Entradas), las palabras clave disparadoras y los tres tipos de entrada. También explica dónde va cada entrada en el prompt (las instrucciones enviadas a la IA) y los controles de tiempos que deciden cuándo se activa una entrada. Si eres nuevo con los lorebooks, lee primero la [Visión general de los lorebooks](overview.md).

Una entrada es un bloque de texto más las reglas que deciden cuándo Marinara Engine agrega ese texto al prompt de la IA. Cuando una entrada se activa, su contenido se inyecta para que la IA "recuerde" un dato que tú nunca escribiste en el chat.

## La pestaña Entries

Abre un lorebook desde el panel **Lorebooks** para llegar a su editor de página completa. El editor tiene dos pestañas laterales: **Overview** (Visión general) y **Entries**. Haz clic en **Entries** para ver la lista de entradas. La insignia de la pestaña muestra cuántas entradas tiene el lorebook.

La barra de herramientas en la parte superior de la pestaña **Entries** tiene estos controles:

- Cuadro **Search entries…** (Buscar entradas): filtra la lista por nombre de entrada, palabras clave o contenido.
- Un menú desplegable de orden con **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Newest** y **Oldest**. Las opciones ↓ ordenan de mayor a menor.
- **Select** (Seleccionar): activa la selección múltiple para que puedas copiar, mover o eliminar varias entradas a la vez.
- **Add Folder** (Agregar carpeta): crea una carpeta para agrupar entradas (ver la sección Carpetas de entradas más abajo).
- **Add Entry** (Agregar entrada): crea una nueva entrada en blanco en la parte superior de la lista.

Debajo de la barra de herramientas, una línea de resumen muestra el número de entradas, el número de carpetas y el tamaño total estimado en tokens de todo el contenido de las entradas.

## Agregar y editar una entrada

Para crear una entrada, sigue estos pasos.

1. Abre tu lorebook y haz clic en la pestaña **Entries**.
2. Haz clic en **Add Entry**. Aparece una nueva fila en la lista.
3. Escribe un nombre en el campo de nombre de la fila. Cada entrada necesita un nombre.
4. Haz clic en la fila (o en su flecha en forma de chevron) para expandir el panel lateral del editor completo.
5. Rellena las palabras clave y el contenido, descritos en las secciones de abajo.

Tus cambios se guardan automáticamente. Mientras escribes, el panel lateral muestra **Autosaving…** (Guardando automáticamente), luego **Saving…** (Guardando) y luego **Saved automatically** (Guardado automáticamente). Si un guardado falla, tu texto se queda en su lugar y Marinara lo reintenta en tu siguiente edición. No necesitas un botón de guardar aparte para las entradas.

Cada entrada aparece como una fila compacta de una sola línea. La fila contiene los controles más usados. Expande la fila para llegar al resto.

Para duplicar una entrada, pasa el cursor sobre la fila y haz clic en el botón **Duplicate** (Duplicar). Para quitar una, haz clic en el botón **Delete** (Eliminar). Marinara te pide confirmar con el aviso **Delete this lorebook entry?** (¿Eliminar esta entrada del lorebook?).

## Contenido y palabras clave de la entrada

Expande una entrada para editar sus campos principales.

- **Primary Keys** (Palabras clave principales): las palabras clave que disparan esta entrada. Cuando cualquiera de estas palabras aparece en el chat reciente, la entrada se activa. Escribe una palabra clave y pulsa Enter para agregarla como un chip.
- **Content** (Contenido): el texto que se inyecta en el prompt de la IA cuando la entrada se activa. Escríbelo como un dato simple que quieres que la IA sepa. El contenido admite macros de prompt, y debajo del cuadro se muestra una estimación de tokens en vivo.
- **Secondary Keys** (Palabras clave secundarias): palabras clave adicionales que solo se usan cuando el tipo de entrada es **Selective**. Ver la sección de tipos de entrada más abajo.
- **Description** (Descripción): un resumen corto de la entrada. Solo el agente **Knowledge Router** la lee, para decidir si inyecta la entrada. Nunca se envía a la IA principal como contenido. Ver [Fuentes de conocimiento](../agents/knowledge-sources.md).

Aquí tienes un ejemplo simple.

- Nombre: `Silverhaven`
- Primary Keys: `Silverhaven`, `the capital`
- Contenido: `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.`

Cuando tú o la IA mencionan `Silverhaven` o `the capital` en el chat, la IA recibe ese dato automáticamente.

Esa es la entrada más simple posible: un nombre, un par de palabras clave y un dato. Las secciones **Estrategia de redacción** y **Ejemplo práctico** de más abajo explican cuándo recurrir a los demás controles y construyen una ambientación pequeña desde cero.

## Reglas de coincidencia de palabras clave

De forma predeterminada, una palabra clave principal coincide si la palabra aparece en cualquier parte del texto del chat reciente, sin distinguir mayúsculas ni minúsculas. Tres controles cambian cómo funciona la coincidencia. **Whole Words** (Palabras completas) y **Case Sensitive** (Distinguir mayúsculas) están en el panel lateral expandido. El interruptor **Regex** es el icono pequeño en la fila compacta, y se vuelve naranja cuando está activado.

| Control | Dónde | Predeterminado | Qué hace |
|---|---|---|---|
| **Whole Words** | Panel de la entrada | Off | La palabra clave debe coincidir con una palabra completa, no con parte de una palabra más larga. |
| **Case Sensitive** | Panel de la entrada | Off | Las mayúsculas y minúsculas deben coincidir exactamente. |
| **Regex** | Fila compacta | Off | Trata cada palabra clave como un patrón de expresión regular en lugar de texto simple. |

Una expresión regular (regex) es un lenguaje de coincidencia de patrones para texto. Úsalo solo si sabes regex. Marinara ejecuta cada palabra clave de regex con un tiempo de espera de seguridad corto. Un patrón que tarda demasiado no coincide en ese escaneo, así que mantén los patrones simples.

## Tipos de entrada: Normal, Constant, Selective

Cada entrada tiene un tipo. Haz clic en el pequeño punto de color de la fila de la entrada para abrir el menú de tipos y elegir uno.

- **Normal** (punto verde): se dispara cuando una palabra clave principal coincide con el texto escaneado. Este es el predeterminado.
- **Constant** (punto amarillo): se inyecta cada vez que el lorebook está activo, sin necesidad de palabra clave. Usa esto para datos que siempre deben estar presentes.
- **Selective** (punto rojo): las palabras clave principales deben coincidir, y la lógica de las palabras clave secundarias también debe cumplirse.

Una entrada **Constant** sigue obedeciendo los tiempos, la probabilidad y cualquier filtro que configures. Solo que no necesita una palabra clave.

Cuando una entrada es **Selective**, agrega una o más **Secondary Keys** y elige un botón de **Logic** (Lógica) en el panel lateral:

- **AND Any**: al menos una palabra clave secundaria también debe aparecer.
- **AND All**: cada palabra clave secundaria también debe aparecer.
- **NOT Any**: la entrada se bloquea si aparece cualquier palabra clave secundaria.
- **NOT All**: la entrada se bloquea solo si aparecen todas las palabras clave secundarias.

Por ejemplo, toma una entrada **Selective** con la palabra clave principal `king` y la palabra clave secundaria `Silverhaven`, configurada como **AND Any**. Solo se dispara cuando el chat menciona tanto al rey como a Silverhaven. Esto evita que una palabra compartida como `king` se dispare en la escena equivocada.

## Position, Depth y Order

Estos controles deciden dónde cae en el prompt una entrada activada. Se ubican en la fila compacta en una pantalla ancha. En una pantalla estrecha, toca el botón de controles rápidos de la fila para llegar a ellos.

- **Position** (Posición): elige **Before chat**, **After chat**, **@ Depth** u **Outlet**. Before chat y After chat colocan la entrada alrededor del historial del chat. **@ Depth** inyecta la entrada dentro del historial del chat. **Outlet** no inyecta la entrada automáticamente; pone el contenido activado a disposición de una macro `{{outlet::name}}` con nombre. En una pantalla ancha, la fila muestra las tres primeras posiciones como las etiquetas cortas **↑Char**, **↓Char** y **@Depth**.
- **Depth** (Profundidad): aparece solo cuando **Position** es **@ Depth**. Establece cuántos mensajes hacia atrás desde el último mensaje se inserta la entrada. El predeterminado es 4.
- **Order** (Orden): el orden de inserción cuando varias entradas se activan a la vez. Un número más bajo va antes en el prompt. El predeterminado es 100.

Usa **@ Depth** con moderación y solo cuando tengas un motivo claro. Como inyecta la entrada *dentro* de los mensajes recientes, y no alrededor de ellos, el texto se lee como una interrupción soltada en mitad de la conversación:

> **John:** Vamos a visitar el castillo de Vlad.
> **Bob:** Hecho.
> *La debilidad del conde es el ajo —una alergia extrema que oculta a toda costa.*
> **John:** Genial, ¿vamos mañana? Tengo el día libre.

Recurre a esta posición solo cuando una nota de verdad necesite quedar junto al último turno: una regla que el modelo sigue olvidando, o un dato que acaba de cambiar. El trasfondo corriente se queda en **Before chat** o **After chat**.

Cuando eliges **Outlet**, aparece un campo **Outlet name**. Escribe un nombre exacto que distingue mayúsculas y minúsculas, como `character_rules`, y después pon `{{outlet::character_rules}}` en una sección del prompt. Cada entrada asignada a ese Outlet sigue sus reglas normales de palabras clave, modo Constant, probabilidad, filtros, tiempos, límite de entradas y presupuesto de tokens. Solo se recopilan las entradas activadas para la generación actual. Las entradas que comparten el mismo nombre de Outlet se unen según su Order, separadas por saltos de línea.

Una macro Outlet que no tenga entradas coincidentes activas se resuelve como texto vacío. El contenido de un Outlet no puede llamar a otra macro Outlet, lo que evita bucles recursivos. Las macros Outlet funcionan en secciones de prompt de los modos Conversation, Roleplay y Game.

## Probabilidad de disparo

Cada entrada tiene un valor de **Probability** (Probabilidad), mostrado como un porcentaje en la fila. El predeterminado es 100%, lo que significa que la entrada siempre se dispara cuando sus palabras clave coinciden. Bájalo para que una entrada se dispare solo algunas veces. Por ejemplo, 25% significa que la entrada tiene una probabilidad de uno entre cuatro de activarse cada vez que sus palabras clave coinciden.

## Tiempos: Sticky, Cooldown, Delay, Ephemeral

Los campos de **Timing** (Tiempos) del panel lateral controlan el comportamiento de una entrada a lo largo de varios mensajes. **Sticky**, **Cooldown** y **Delay** se cuentan en mensajes. **Ephemeral** cuenta activaciones. Los cuatro empiezan sin configurar (0, que significa desactivado).

- **Sticky** (Persistente): después de que la entrada se dispara, permanece activa durante esta cantidad de mensajes más, incluso sin una nueva coincidencia de palabra clave.
- **Cooldown** (Enfriamiento): después de que la entrada se dispara, espera esta cantidad de mensajes antes de poder dispararse de nuevo.
- **Delay** (Retraso): la entrada espera esta cantidad de mensajes dentro del chat antes de poder activarse por primera vez.
- **Ephemeral** (Efímero): la entrada se desactiva a sí misma después de esta cantidad de activaciones. Un valor de 0 significa ilimitado.

Por ejemplo, configura **Sticky** en 3 para mantener un dato en el prompt durante algunos turnos después de que surge. Así la IA no lo olvida a mitad de la escena.

## Más opciones de entrada

El panel lateral expandido contiene algunos campos más.

- **Role** (Rol): establece si el texto inyectado se etiqueta como **System**, **User** o **Assistant**. Esto solo importa cuando **Position** es **@ Depth**. El predeterminado es **System**.
- **Group** y **Tag**: pon entradas en el mismo **Group** (Grupo) para que solo una de ellas se active a la vez. La **Tag** (Etiqueta) es una etiqueta de texto libre para tu propia clasificación.
- **Locked** (Bloqueado): impide que el agente **Lorebook Keeper** cambie esta entrada. Ver [Referencia de agentes descargables](../agents/built-in-agents.md).
- **No Vector** y la insignia de estado del vector se relacionan con la búsqueda semántica. Ver [Búsqueda semántica para lorebooks](semantic-search.md).

El panel lateral también tiene una sección **Context filters & matching sources** (Filtros de contexto y fuentes de coincidencia). Allí puedes limitar una entrada a ciertos personajes, etiquetas de personaje o tipos de generación. También puedes escanear campos adicionales de la tarjeta (como la descripción del personaje) en busca de las palabras clave de la entrada.

## Estrategia de redacción: elegir la entrada adecuada

Las secciones de arriba describen qué hace cada control. Esta sección los conecta con las decisiones que tomas al escribir un lorebook: qué tipo elegir, cuándo afinar una palabra clave y cómo mantener el prompt ligero. Parte de una sola pregunta: *¿cuándo debería ver la IA este dato?*

- **Siempre tiene que ser cierto** — la premisa de la ambientación, el año, el tono, una regla que tiñe cada escena. Hazla **Constant**: se inyecta cada vez que el lorebook está activo, sin necesidad de palabra clave. Que sean pocas: cada entrada Constant gasta tokens en cada mensaje, así que una página de ellas acaba desplazando el chat en sí.
- **Solo importa cuando surge** — una persona, un lugar, una facción o un objeto. Usa el tipo **Normal** predeterminado con entre tres y ocho **Primary Keys** específicas: el nombre más las formas en que los personajes se refieren a él de verdad (`Castle Dracul`, `the castle`, `the fortress`). Este es el tipo de uso diario; la mayoría de las entradas son Normal.
- **Su palabra clave es una palabra común** que se dispararía en la escena equivocada (`king`, `home`, `hunter`) — activa **Whole Words** para que `art` deje de coincidir con `start`, o haz la entrada **Selective** y agrega **Secondary Keys** que la fijen al contexto correcto.
- **Varias entradas ocupan el mismo hueco y nunca deben aparecer juntas** — tres versiones de un mismo castillo, dos historias previas alternativas. Dales el mismo **Group** para que solo se cargue una a la vez.
- **Es importante, pero rara vez se nombra de forma directa** — un tema, una relación, una regla que nadie dice en voz alta. Déjala en **Normal** y activa la coincidencia semántica para que se recupere por significado (ver [Búsqueda semántica](semantic-search.md)). La coincidencia semántica necesita un modelo de embedding (representación numérica del texto); sin él, recurre a **Constant** (cuando de verdad deba estar siempre presente) o a palabras clave más amplias.

Algunos hábitos mantienen sanos los lorebooks:

- **Dale a cada entrada una forma de dispararse.** Una entrada **Normal** sin palabras clave no tiene nada que la coincidencia por palabra clave pueda atrapar: solo se activa si la búsqueda semántica la recupera por significado, lo que necesita un lorebook vectorizado y un modelo de embedding (ver [Búsqueda semántica](semantic-search.md)). Si un dato siempre debe estar presente, hazlo **Constant**; si no, dale palabras clave para que se dispare sin depender de la búsqueda semántica.
- **Prefiere palabras clave específicas.** Una palabra clave como `he`, `it` o `the city` coincide con casi cada mensaje y desperdicia presupuesto. Recurre a nombres exactos, a **Whole Words** o a palabras clave secundarias **Selective** cuando una palabra clave sea demasiado genérica.
- **Rellena la Description** en cualquier entrada que esperes que enrute el agente **Knowledge Router**: el agente lee la descripción, no el contenido, para decidir la relevancia (ver [Fuentes de conocimiento](../agents/knowledge-sources.md)).
- **Deja Position, Depth, Order y Role en sus valores predeterminados** salvo que tengas un motivo. Recurre a **Order** cuando varias entradas se disparan y el presupuesto va justo (un número más bajo se carga primero y sobrevive al recorte); usa **@ Depth** solo para el recordatorio excepcional que debe quedar junto al último mensaje, como se advirtió arriba. Vigila el **Token Budget** (Presupuesto de tokens) y el **Entry Limit** (Límite de entradas) del lorebook (ver [Presupuestos de tokens y recursión](token-budgets.md)).

### Estructura el trasfondo como un árbol

Las ambientaciones grandes se manejan mejor como un árbol que como un montón plano de entradas. Junto a una entrada por cada personaje, lugar u objeto, agrega **entradas eje** para los grupos a los que pertenecen: una entrada sobre *El Imperio* que lo describa y liste a sus miembros destacados, o una entrada de un reino que liste sus ciudades importantes. Un eje le da a la IA un mapa: cuando sale el Imperio, el modelo ve qué es y quién pertenece a él, sin que la entrada completa de cada miembro llene el prompt.

Deja la recursión desactivada en los ejes. El interruptor **Recursive** (Recursivo) del lorebook y el interruptor **Recursion** (Recursión) de una entrada están desactivados de forma predeterminada, lo cual es justo lo que quiere un eje: le entrega al modelo su visión general y deja que la entrada propia de cada miembro aparezca solo cuando ese miembro se nombra explícitamente. Si activas la recursión en otro sitio para encadenar trasfondo relacionado, mantenla desactivada en las entradas eje. Si no, nombrar al grupo mete de golpe en el prompt la entrada completa de cada miembro: miles de tokens de detalle que todavía no vienen al caso.

### Reutilizar el trasfondo entre personajes y chats

Dónde vive un lorebook decide qué chats pueden verlo, así que ajusta el contenedor al tipo de trasfondo:

- **Reglas de mundo compartido** —la ambientación a la que pertenece todo lo de tu biblioteca— van en un lorebook **Global**, que está activo en cada chat (activa el interruptor **Global** en la pestaña **Overview** del lorebook).
- **El trasfondo propio de un personaje** —historia previa, secretos, relaciones— va en un lorebook **vinculado** a ese personaje, así se activa solo en sus chats y en ningún otro. Cuando varios personajes comparten un mismo libro, agrega un **filtro** de personaje a las entradas que pertenecen a uno solo de ellos.
- **Una tarjeta que planeas compartir** — **incrusta** el lorebook en la tarjeta de personaje para que su World Info viaje con la exportación. La incrustación es solo para personajes, y una tarjeta tiene un lorebook incrustado a la vez.
- **Trasfondo para una sola historia** — fija un lorebook solo a ese chat desde sus ajustes.

Ver [Visión general de los lorebooks](overview.md) para saber cómo funciona la activación, y [Vincular lorebooks a personajes y personas](linking-to-characters.md) para los controles de asignación, alcance e incrustación.

## Ejemplo práctico: una ambientación pequeña

Supón que llevas un roleplay de terror gótico ambientado en la Valaquia de la década de 1890. Un lorebook mínimo sería un montón de entradas de nombre y contenido; uno bien construido usa los controles de arriba para que cada dato aparezca justo cuando debe. Así es como podría configurarse un puñado de entradas, y por qué.

Empieza por los cimientos: un dato siempre activo y un par de detalles con palabras clave.

**La premisa** — *Constant.*

- Contenido: `The year is 1890. Vampires are real and hunt the Carpathian nights; the living bar their windows after dark.`
- Por qué **Constant**: las reglas básicas tiñen cada respuesta, así que esta entrada siempre está presente, sin necesidad de palabra clave. Esta es la única entrada que puedes justificar tener siempre activa; resiste la tentación de convertir más entradas en Constant.

**Castle Dracul** — *Normal.*

- Primary Keys: `Castle Dracul`, `the castle`, `the fortress`
- Contenido: `A black-stone fortress on the ridge above the village, the seat of the vampire count.`
- Por qué **Normal** con esas palabras clave: el castillo solo importa cuando está en juego, así que espera a una palabra clave. Las palabras clave cubren su nombre y las formas en que los personajes se refieren a él.

**Count Vlad** — *Normal, con Whole Words activado.*

- Primary Keys: `Vlad`
- Description: `The setting's central vampire.`
- Contenido: `The immortal count who rules Wallachia after dark — charming, patient, and without mercy.`
- Por qué **Whole Words**: `Vlad` es corto y podría quedar dentro de otra palabra, así que la coincidencia por palabra completa evita que se dispare por error. La **Description** está rellenada para que el Knowledge Router pueda enrutar la entrada si usas ese agente.

### Combinar varios controles en una sola entrada

La mayoría de las entradas necesitan uno o dos controles; unas pocas se ganan varios a la vez. Toma la regla de cómo se puede matar de verdad al villano, un dato que la IA tiende a olvidar en el peor momento:

**La debilidad del conde** — *Selective (AND Any), Whole Words activado, Order 10 y con Description.*

- Primary Keys: `weakness`, `kill`, `destroy`, `stake`
- Secondary Keys: `Vlad`, `the count`
- Description: `How Count Vlad can actually be destroyed.`
- Contenido: `Vlad can only be destroyed by a blackthorn stake through the heart, driven at dawn. Sunlight alone merely weakens him.`

Por qué esta única entrada se gana varios controles avanzados:

- **Selective** con esas palabras clave secundarias: `weakness`, `kill` y `destroy` son palabras genéricas de combate que salen cada vez que el grupo pelea con algo. Las palabras clave secundarias fijan la entrada al conde, así que se queda callada cuando matan a un lobo o traman contra un rival, y solo se dispara cuando lo que está en juego es *su* muerte.
- **Whole Words**: sin esto, `stake` coincidiría con `mistake`, y `kill` con `skill`. Las palabras clave cortas y comunes casi siempre quieren coincidencia por palabra completa.
- **Order 10**: una escena de clímax activa muchas entradas a la vez y puede reventar el presupuesto de tokens. Un orden bajo carga esta entrada primero, así que si se recorta la cola, sobrevive el único dato del que depende la escena.
- **Description**: el agente Knowledge Router la lee para enrutar la entrada por significado, así que la regla puede salir a flote incluso cuando las palabras clave exactas no están en el último mensaje.

### Versiones alternativas que no deben acumularse

Quieres que los chismes del pueblo sobre el conde suenen inconsistentes, pero nunca quieres dos rumores contradictorios en la misma respuesta. Pon los dos en un mismo **Group** y deja que la probabilidad haga que salgan pocas veces:

**Rumor: el pacto** y **Rumor: el linaje** — *ambos en Group `count-rumor`, Probability 40%.*

- Ambos con las palabras clave: `rumor`, `they say`, `the count`
- Contenidos: `They say the count was once a crusader who bargained with something in the dark.` y `They say the count is not one man but a line of them, each wearing the last one's face.`
- Por qué **Group** `count-rumor`: las entradas del mismo grupo son mutuamente excluyentes (solo una se activa por generación), así que los dos rumores nunca se contradicen en el mismo mensaje. Por qué **Probability 40%**: un rumor que sale cada vez que se toca el tema deja de parecer un rumor; bajar las probabilidades lo mantiene como un comentario ocasional que da color a la escena.

En todo el lorebook, solo la premisa es Constant, una entrada combina lógica selectiva con un orden bajo, y todo lo demás simplemente espera a sus palabras clave. Eso es lo que mantiene el prompt ligero y a la vez pone el dato adecuado delante de la IA en el momento adecuado.

## Casos de uso por parámetro

La estrategia y el ejemplo práctico de arriba muestran estos controles en combinación. Esta sección es una referencia rápida: *para qué* sirve cada control, y un ejemplo de cada uno.

### Coincidencia

**Whole Words** — impide que una palabra clave coincida dentro de una palabra más larga.

- Úsalo para: palabras clave cortas o de una sola sílaba, siglas, o una palabra clave que sea un fragmento de otras palabras.
- *Ejemplo:* la palabra clave `Ash` (un personaje) coincide con "Ash", pero no con "ashes" ni con "cash".

**Case Sensitive** — la palabra clave debe coincidir exactamente en mayúsculas y minúsculas.

- Úsalo para: una palabra clave que también es una palabra común en minúsculas; siglas y acrónimos; códigos donde las mayúsculas tienen significado.
- *Ejemplo:* `IT` (el departamento técnico) coincide con "IT", pero no con la palabra "it".

**Regex** — trata la palabra clave como un patrón de expresión regular.

- Úsalo para: varias grafías o formas a la vez, sufijos opcionales, o números y códigos con un patrón. Mantén los patrones simples: cada uno se ejecuta con un tiempo de espera de seguridad corto.
- *Ejemplo:* `\bVlad(?:'s)?\b` coincide tanto con "Vlad" como con "Vlad's" en forma de palabras completas.

### Tipo de entrada

**Constant** — se inyecta en cada turno, sin palabra clave.

- Úsalo para: la premisa y las reglas básicas de la ambientación, una directriz de tono o de estilo, o un dato tan central que la IA nunca debería quedarse sin él.
- *Ejemplo:* una entrada Constant sin palabras clave, "Todos hablan el inglés de la época de 1800.", está presente en cada respuesta.

**Selective (palabras clave secundarias + lógica)** — agrega una segunda condición de palabra clave encima de las palabras clave principales.

- Úsalo para: una palabra clave principal común que se dispara en la escena equivocada, trasfondo que solo debe aparecer en una combinación concreta de temas, o bloquear una entrada cuando cierto término está presente.
- *Ejemplo (AND Any):* principal `king`, secundaria `Silverhaven`: la entrada del rey se dispara solo cuando también se menciona Silverhaven.
- *Ejemplo (NOT Any):* principal `the prophecy`, secundaria `fulfilled`: la entrada de la profecía sin cumplir se bloquea en cuanto la profecía se cumple.

### Ubicación

**Before chat / After chat** — dónde se sitúa la entrada respecto a la conversación.

- Úsalo para: la mayor parte del trasfondo (Before chat, el predeterminado); un empujón que quieres lo más cerca posible de la siguiente respuesta del modelo (After chat).
- *Ejemplo:* un resumen de facción en Before chat; un recordatorio corto de "no te salgas del personaje" en After chat.

**@ Depth (con Depth y Role)** — inyecta la entrada *dentro* de los mensajes recientes. Úsalo con moderación; ver la advertencia en **Position, Depth y Order** más arriba.

- Úsalo para: una regla que el modelo sigue olvidando a mitad de escena, o un dato que acaba de cambiar y debe caer junto al último turno. **Role** etiqueta la línea inyectada como **System**, **User** o **Assistant**.
- *Ejemplo:* "La taberna está ardiendo." en @ Depth 1, Role System.

**Order** — la secuencia en la que se cargan las entradas activadas.

- Úsalo para: hacer que una entrada gane cuando varias se disparan y el presupuesto va justo, o controlar el orden de entradas relacionadas.
- *Ejemplo:* una regla crítica para la trama en Order 10 se carga antes que las entradas de ambientación en el 100 predeterminado, y sobrevive al recorte por presupuesto.

**Outlet** — recoge las entradas activadas en una macro con nombre en lugar de inyectarlas directamente.

- Úsalo para: reunir varias entradas en un solo punto de tu prompt, o construir un bloque dinámico que colocas tú.
- *Ejemplo:* tres entradas con Position Outlet y el nombre `house_rules`; pon `{{outlet::house_rules}}` en una sección del prompt y ahí aparecen solo las que se activaron este turno, unidas según su Order.

### Cuándo y con qué frecuencia se dispara una entrada

**Probability** — el porcentaje de probabilidad de que la entrada se dispare cuando sus palabras clave coinciden.

- Úsalo para: detalles de ambientación ocasionales, eventos aleatorios, o una manía que solo debe salir algunas veces.
- *Ejemplo:* "hoy el posadero está de mal humor" con Probability 30%.

**Sticky** — mantiene la entrada activa durante un número fijo de mensajes después de que se dispara.

- Úsalo para: retener un dato en el prompt durante algunos turnos, para que el modelo no lo olvide a mitad de escena.
- *Ejemplo:* un secreto revelado con Sticky 3 sigue activo durante tres mensajes después de que sale.

**Cooldown** — impide que la entrada vuelva a dispararse durante un número fijo de mensajes después de que se dispara.

- Úsalo para: evitar que una entrada dramática o pesada se repita en cada mensaje, o marcar el ritmo de un evento recurrente.
- *Ejemplo:* un presagio de "la tierra tiembla" con Cooldown 5 se dispara como mucho una vez cada cinco mensajes.

**Delay** — la entrada no puede dispararse hasta que el chat lleve un número determinado de mensajes.

- Úsalo para: trasfondo que no debe aparecer al principio del todo; un giro o un dato de un arco posterior que se guarda hasta que la historia avanza.
- *Ejemplo:* una entrada de "el mentor era el traidor desde el principio" con Delay 20.

**Ephemeral** — la entrada se desactiva a sí misma después de un número fijo de activaciones.

- Úsalo para: contenido de una sola vez, o de pocas veces: una introducción, una nota de primer encuentro, una pista de tutorial.
- *Ejemplo:* "Despiertas sin recordar cómo llegaste aquí." con Ephemeral 1 se dispara una vez y luego se apaga sola.

### Organización y control

**Group** — hace que las entradas sean mutuamente excluyentes; solo una del grupo se activa por respuesta.

- Úsalo para: alternativas (uno de varios rumores, estados de ánimo o versiones), o un conjunto para elegir al azar.
- *Ejemplo:* tres entradas de "el clima de hoy" en el Group `weather`: se elige exactamente una por respuesta.

**Tag** — una etiqueta de texto libre para tu propia clasificación. No afecta a la activación.

- Úsalo para: organizar y filtrar entradas en el editor.
- *Ejemplo:* etiqueta las entradas como `npc`, `location` o `wip` para encontrarlas y manejarlas rápido.

**Description** — un resumen que el agente Knowledge Router lee para enrutar la entrada; nunca se envía a la IA como contenido.

- Úsalo para: darle a una entrada densa o llena de macros un resumen en lenguaje sencillo que el enrutador pueda emparejar por significado, o una nota para ti.
- *Ejemplo:* una entrada llena de macros de formato recibe la Description "las reglas de la arena de duelos".

**Recursion (por entrada)** — permite que el contenido de esta entrada dispare más entradas. Desactivada de forma predeterminada.

- Úsalo para: una entrada desde la que *quieres* encadenar hacia un conjunto acotado de trasfondo relacionado. Mantenla desactivada en las entradas eje (ver **Estructura el trasfondo como un árbol** más arriba).
- *Ejemplo:* "El grupo entra en el Bosque Espinoso." con Recursion activada y un contenido que nombra los puntos de referencia del bosque, para que esas entradas se activen también.

**No Vector** — excluye la entrada de la búsqueda semántica.

- Úsalo para: evitar que una entrada genérica o de plantilla ensucie las coincidencias por significado, o una entrada que solo quieres que se dispare por sus palabras clave exactas.
- *Ejemplo:* marca una entrada con instrucciones de formato como No Vector para que nunca salga como un resultado semántico de "trasfondo relacionado".

**Locked** — protege la entrada del agente Lorebook Keeper.

- Úsalo para: una entrada afinada a mano que un paso automático no debería reescribir.
- *Ejemplo:* bloquea tu premisa cuidadosamente redactada para que el Keeper no pueda editarla.

**Context filters** — limitan una entrada a ciertos personajes, etiquetas de personaje o tipos de generación.

- Úsalo para: trasfondo que se aplica solo a algunos personajes, o solo a algunos tipos de generación.
- Filtrar a un personaje hace más que ocultar la entrada en los demás chats: en un chat grupal también mantiene la entrada fuera de las respuestas de *otros personajes*, y se activa solo cuando el personaje filtrado es el que responde. Eso la hace ideal para historias previas privadas, secretos y conocimiento que un personaje tiene y los demás no deberían tener.
- *Ejemplo:* filtra a la espía la entrada sobre su lealtad secreta, para que influya en sus propias respuestas pero nunca se cuele en las respuestas de los personajes a los que engaña.

## Usar macros en el contenido de la entrada

El **Content** de una entrada se expande como cualquier otro texto del prompt: las macros de prompt se resuelven antes de que el contenido se inyecte. Estas son algunas que resultan útiles dentro de las entradas de lorebook:

- `{{char}}` y `{{user}}`: los nombres del personaje actual y del usuario o de su persona, para que una entrada compartida se lea con naturalidad en cualquier chat.
- `{{random::a::b::c}}` y `{{roll:1d6}}`: eligen una opción al azar o tiran dados, para dar un sabor que varía cada vez que la entrada se dispara. Agrega pesos con `@`, como en `{{random::common@3::rare@1}}`, para que unas opciones sean más probables que otras.
- `{{#if ...}}...{{else}}...{{/if}}`: cambia el texto según quién habla, según una variable o según el personaje activo.
- `{{getvar::name}}` y `{{setvar::name::value}}`: leen o escriben una variable persistente local del chat, para que una entrada reaccione al estado o lo modifique en turnos posteriores sin filtrarlo a otros chats.

El azar con pesos combina bien con **Probability** para meter una tabla entera en una sola entrada. En lugar de un grupo de veinte entradas de monstruos, dale a una sola entrada de "encuentro aleatorio" una **Probability** baja (para que el encuentro sea solo ocasional) y una lista con pesos de lo que aparece:

`{{random::a lone wolf@5::a bandit scout@3::a wounded traveler@2::a displacer beast@1}}`

La entrada se dispara solo a veces, y cuando lo hace elige un encuentro, con pesos para que los enemigos comunes salgan más que los raros, y sin ningún compendio de entradas sueltas que mantener.

Usa la **macro de comentario** para dejar una nota que nunca llega a la IA:

- `{{// draft wording, revisit later}}`: todo lo que está dentro de `{{// ... }}` se elimina de la salida.

**Una nota sobre la recursión.** Cuando el escaneo **Recursive** está activado para el lorebook (ver [Presupuestos de tokens y recursión](token-budgets.md)), Marinara vuelve a escanear el contenido *ya expandido* de las entradas activadas en busca de más palabras clave. Como las macros se resuelven primero, el texto que produce una macro puede disparar otras entradas: por ejemplo, un contenido que se expande a un nombre puede activar una entrada con esa palabra clave. Un `{{// comment}}` es la excepción: se elimina por completo antes del nuevo escaneo, así que su texto nunca puede disparar nada. Los comentarios son solo para notas; si quieres que un texto alimente la recursión, escríbelo de forma normal.

## Problemas frecuentes

- **Una entrada nunca se dispara.** Una entrada **Normal** sin palabras clave no tiene nada que la coincidencia por palabra clave pueda atrapar: dale palabras clave o hazla **Constant**. (Una entrada sin palabras clave todavía puede recuperarse por significado, pero solo con la búsqueda semántica configurada del todo: **Vectors** (Vectores) activado, un modelo de embedding configurado y la entrada vectorizada; ver [Búsqueda semántica](semantic-search.md).) Comprueba también que el lorebook esté habilitado y activo en el chat.
- **Una palabra clave dejó de funcionar.** Las palabras clave solo se buscan en los últimos mensajes: el **Scan Depth** (Profundidad de escaneo) del lorebook, que es 2 de forma predeterminada. En cuanto la palabra disparadora sale de esa ventana, la entrada se calla. Sube el **Scan Depth**, agrega **Sticky** para que un dato permanezca una vez que se dispara, o haz la entrada **Constant**.
- **Una entrada se dispara en las escenas equivocadas.** Una palabra clave amplia como `home` o `king` coincide con demasiado. Ajústala con **Whole Words**, contrólala con palabras clave secundarias **Selective**, o filtra la entrada al personaje correcto.
- **El trasfondo importante se pierde una y otra vez.** Cuando coinciden más entradas de las que permite el presupuesto, se recorta la cola. Dale un **Order** más bajo a las entradas que importan, sube el **Token Budget**, o mueve el trasfondo de consulta más voluminoso detrás del agente Knowledge Router. El panel **Active Context** (Contexto activo) muestra exactamente qué se saltó y por qué (ver [Presupuestos de tokens y recursión](token-budgets.md)).
- **La IA ignora tu trasfondo.** Confirma en **Active Context** que la entrada se activó de verdad. Y recuerda que compite con el resto del prompt: un dato enterrado lejos del último turno tiene menos peso que uno en **After chat** o, con moderación, en **@ Depth**.

## Lista de comprobación para escribir entradas

Un repaso rápido para cada entrada que escribas:

1. **Ponle un nombre** claro: el nombre es para ti y para la búsqueda, no para la IA.
2. **Decide cómo se dispara:** un dato siempre cierto → **Constant**; cualquier otra cosa → **Normal** con entre tres y ocho **palabras clave** específicas.
3. **Doma las palabras clave demasiado generales** con **Whole Words**, o repártelas en palabras clave secundarias **Selective**.
4. **Escribe el contenido** como un dato simple, con los menos tokens posibles.
5. **Rellena la Description** si usas el agente Knowledge Router.
6. **Deja la ubicación en sus valores predeterminados** salvo que la entrada de verdad necesite un **Position**, un **Depth** o un **Order** propios.
7. Ponles un mismo **Group** a las alternativas mutuamente excluyentes; **filtra** al personaje que corresponda el trasfondo específico de un personaje.
8. **Pruébala** en el panel **Keyword test**, y luego vigila **Active Context** en un chat real para confirmar que se dispara y que cabe en el presupuesto.

## La herramienta Keyword test

El panel **Keyword test** (Prueba de palabras clave) en la parte superior de la pestaña **Entries** te permite comprobar tus palabras clave sin iniciar un chat. Expándelo y pega un párrafo de muestra o unos cuantos mensajes en el cuadro.

Las entradas cuyas palabras clave coincidirían obtienen un acento verde y un chip **Would activate** (Se activaría). Las entradas **Constant** obtienen un chip **Always active** (Siempre activa), porque se disparan sin importar lo que diga el texto. Una línea de conteo muestra cuántas de tus entradas habilitadas se activarían.

Esta prueba comprueba solo las reglas de palabras clave. Ignora los tiempos, la probabilidad, los filtros de personaje y la coincidencia semántica, así que un chat en vivo aún puede diferir de la vista previa.

## Carpetas de entradas

Las carpetas agrupan entradas dentro de un mismo lorebook. Son distintas de las carpetas de biblioteca en el panel principal **Lorebooks**.

- Haz clic en **Add Folder** para crear una, luego cámbiale el nombre en línea.
- Arrastra una entrada sobre una carpeta para archivarla, o usa el selector **Folder** de la entrada.
- Arrastra una carpeta sobre otra carpeta para anidarla, o arrástrala a la franja superior para desanidarla.
- Cada carpeta tiene un interruptor **Enabled** (Activada). Cuando desactivas una carpeta, cada entrada dentro de ella deja de activarse, incluso si el interruptor propio de esa entrada está encendido.
- El encabezado de una carpeta también tiene **Clone** (Clonar) y **Delete**. **Clone** hace una copia profunda de la carpeta con todas sus entradas y subcarpetas. **Delete** quita solo la carpeta en sí. Sus entradas y subcarpetas suben al nivel superior.

Las carpetas solo se muestran como grupos cuando ordenas por **Order** sin una búsqueda activa. Cualquier otro orden, o una búsqueda, cambia a una lista plana y muestra la nota **Folder view paused (clear search and sort by Order)** (Vista de carpetas en pausa; borra la búsqueda y ordena por Order).

## Guías relacionadas

- [Visión general de los lorebooks](overview.md)
- [Presupuestos de tokens y recursión de los lorebooks](token-budgets.md)
- [Búsqueda semántica para lorebooks](semantic-search.md)
- [Fuentes de conocimiento: agentes de recuperación y de enrutamiento](../agents/knowledge-sources.md)
