# Entradas de lorebook: palabras clave, posición y tiempos

Una entrada es un dato de un lorebook (libro de trasfondo), más las reglas que deciden cuándo Marinara lo agrega al prompt (las instrucciones enviadas a la IA). Esta guía explica cómo agregar entradas, elegir las palabras clave y el tipo de entrada, decidir dónde cae una entrada y configurar los tiempos.

Antes de empezar: crea un lorebook y ábrelo. Consulta [Visión general de los lorebooks](overview.md).

## La pestaña Entries

Abre un lorebook desde el panel **Lorebooks**. El editor tiene dos pestañas, **Overview** (Visión general) y **Entries** (Entradas). Haz clic en **Entries** para ver la lista. La insignia de la pestaña muestra cuántas entradas tienes.

La barra de herramientas tiene estos controles.

- **Search entries…** (Buscar entradas…) filtra por nombre, palabras clave o contenido.
- El menú de orden ofrece **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Fired ↓**, **Newest** y **Oldest**. Las opciones ↓ ordenan de mayor a menor.
- **Select** (Seleccionar) activa la selección múltiple, para que puedas copiar, mover o eliminar varias entradas.
- **Add Folder** (Agregar carpeta) crea una carpeta (consulta [Carpetas de entradas](#entry-folders)).
- **Add Entry** (Agregar entrada) agrega una entrada en blanco en la parte superior.

Una línea debajo de la barra de herramientas muestra el número de entradas, el número de carpetas y el total estimado de tokens (fragmentos de texto) de todo el contenido de las entradas.

## Agregar y editar una entrada

1. Haz clic en **Add Entry**. Aparece una fila nueva.
2. Escribe un nombre en la fila. Cada entrada necesita uno. El nombre es para ti y para la búsqueda, no para la IA.
3. Haz clic en la fila, o en su flecha. Se abre un panel debajo de la fila con todos los campos.
4. Escribe una palabra clave en **Primary Keys** (Palabras clave principales) y pulsa <kbd>Enter</kbd>. Después escribe el texto para la IA en **Content** (Contenido). Consulta [Contenido y palabras clave](#content-and-keys).

Los cambios se guardan solos. El panel muestra **Autosaving…** (Guardando automáticamente…), luego **Saving…** (Guardando…) y luego **Saved automatically** (Guardado automáticamente). Si un guardado falla, tu texto se queda y Marinara lo reintenta en tu siguiente edición.

Para copiar una entrada, haz clic en **Duplicate entry** (Duplicar entrada) en su fila. Para quitarla, haz clic en **Delete entry** (Eliminar entrada) y confirma. En una computadora, estos botones aparecen cuando pasas el cursor sobre la fila.

<a id="content-and-keys"></a>

### Contenido y palabras clave

| Campo | Qué es |
| --- | --- |
| **Primary Keys** | Las palabras que disparan la entrada. Escribe una palabra clave y pulsa <kbd>Enter</kbd> para agregarla. Basta con una coincidencia para activar una entrada **Normal**. |
| **Content** | El texto que se envía a la IA. Escribe un dato simple. Puede usar [macros](../prompts/macros.md), y debajo del cuadro se muestra una estimación de tokens. |
| **Secondary Keys** (Palabras clave secundarias) | Palabras clave adicionales, que solo usan las entradas **Selective**. |
| **Description** (Descripción) | Un resumen corto que solo lee el agente **Knowledge Router**. Nunca se envía al modelo principal. Consulta [Fuentes de conocimiento](../agents/knowledge-sources.md). |

Una lista de más de 10 palabras clave muestra las 10 primeras. Haz clic en **Show N more** (Mostrar N más) para ver el resto y en **Collapse** (Contraer) para ocultarlas. Las palabras clave ocultas siguen coincidiendo.

Por ejemplo, una entrada llamada `Silverhaven` con las palabras clave `Silverhaven` y `the capital` y el contenido `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.` llega a la IA siempre que cualquiera de las dos palabras clave aparezca en el chat reciente.

### Reglas de coincidencia

De forma predeterminada, una palabra clave coincide cuando aparece en cualquier parte del chat reciente, sin distinguir mayúsculas de minúsculas. Tres controles cambian eso.

- **Whole Words** (Palabras completas; en el panel de la entrada, desactivado de forma predeterminada): la palabra clave debe ser una palabra completa. `Ash` coincide con "Ash", pero no con "cash".
- **Case Sensitive** (Distinguir mayúsculas; en el panel de la entrada, desactivado de forma predeterminada): las mayúsculas y minúsculas deben coincidir. `IT` coincide con "IT", pero no con "it".
- **Regex** (un icono en la fila cuyo tooltip dice **Enable regex key matching**; desactivado de forma predeterminada): trata cada palabra clave como una expresión regular, un patrón para buscar coincidencias en el texto. El icono se vuelve naranja cuando está activado.

Usa **Regex** solo si sabes usar expresiones regulares. Cada patrón se ejecuta con un límite de tiempo corto, y un patrón que tarda demasiado no coincide, así que mantén los patrones simples. Por ejemplo, `\bVlad(?:'s)?\b` coincide con "Vlad" y con "Vlad's".

## Elegir un tipo de entrada

Haz clic en el punto de color de la fila para abrir el menú de tipos.

- **Normal** (punto verde, el predeterminado): se activa cuando coincide una palabra clave principal. Úsalo para la mayoría de las entradas: personajes, lugares, objetos. Dale a cada una entre tres y ocho palabras clave específicas.
- **Constant** (punto amarillo): se activa cada vez que el lorebook está activo, sin palabra clave. Úsalo para los pocos datos que siempre deben estar presentes, como el año o el tono. Los tiempos, la probabilidad y los filtros se siguen aplicando.
- **Selective** (punto rojo): se activa cuando coincide una palabra clave principal y se cumple la lógica de las palabras clave secundarias. Úsalo cuando una palabra clave común se dispararía en la escena equivocada.

Cada entrada **Constant** gasta tokens en cada mensaje, así que no uses muchas.

Para una entrada **Selective**, agrega **Secondary Keys** y elige un botón de **Logic** (Lógica).

| Lógica | La entrada se dispara cuando |
| --- | --- |
| **AND Any** | También aparece al menos una palabra clave secundaria. |
| **AND All** | También aparecen todas las palabras clave secundarias. |
| **NOT Any** | No aparece ninguna palabra clave secundaria. |
| **NOT All** | No aparecen juntas todas las palabras clave secundarias. |

Por ejemplo, la palabra clave principal `king` con la palabra clave secundaria `Silverhaven` y **AND Any** solo se dispara cuando el chat menciona ambas.

Si no funcionó: una entrada **Normal** sin palabras clave no tiene nada con qué coincidir. Agrega palabras clave o hazla **Constant**. Una entrada sin palabras clave todavía puede encontrarse por su significado, pero solo cuando la [búsqueda semántica](semantic-search.md) está configurada del todo.

## Position, Depth y Order

Estos controles deciden dónde cae en el prompt una entrada activada. En una pantalla ancha están en la fila compacta. En una pantalla estrecha, toca el botón **Entry quick controls** (Controles rápidos de la entrada) de la fila.

| Control | Qué hace |
| --- | --- |
| **Position** (Posición) | Dónde va la entrada. El valor predeterminado es **Before character definitions**. |
| **Before character definitions** (Antes de las definiciones del personaje) | Antes de la tarjeta de personaje en el prompt. Etiqueta en la fila: **↑Char**. |
| **After character definitions** (Después de las definiciones del personaje) | Después de la tarjeta de personaje. Etiqueta en la fila: **↓Char**. |
| **@ Depth** | Dentro del historial del chat. Etiqueta en la fila: **@Depth**. |
| **Outlet** | En ningún sitio de forma automática (consulta más abajo). |
| **Depth** (Profundidad) | Solo aparece con **@ Depth**. Cuántos mensajes hacia atrás desde el último se sitúa la entrada. Predeterminado: 4. |
| **Order** (Orden) | La secuencia cuando se activan varias entradas. Un número más bajo va primero y sobrevive al recorte cuando el presupuesto va justo. Predeterminado: 100. |

**Role** (Rol) está en el panel expandido de la entrada, no en los controles rápidos. Etiqueta el texto inyectado como **System**, **User** o **Assistant**, solo importa con **@ Depth** y su valor predeterminado es **System**.

Deja estos controles en sus valores predeterminados salvo que una entrada necesite más. Usa **@ Depth** con moderación. El texto cae entre los mensajes recientes como una interrupción, así que resérvalo para una regla que el modelo sigue olvidando o para un dato que cambió hace un momento. Por ejemplo, "The tavern is now on fire." en **@ Depth** 1.

### Outlet

Una entrada **Outlet** solo aparece donde colocas una macro.

1. Establece **Position** en **Outlet**. Aparece un campo **Outlet name** (Nombre del Outlet).
2. Escribe un nombre exacto, que distingue mayúsculas de minúsculas, como `character_rules`.
3. Pon `{{outlet::character_rules}}` en una sección del prompt de tu [preset](../prompts/presets.md) (ajuste guardado).

Las entradas que comparten un nombre se unen según su **Order**, separadas por saltos de línea. Las macros Outlet funcionan en las secciones de prompt de los chats de Conversation, Roleplay y Game. Solo aparecen las entradas que se activaron para esta respuesta. Siguen obedeciendo las palabras clave, la probabilidad, los filtros, los tiempos, el **Entry Limit** (Límite de entradas) y el **Token Budget** (Presupuesto de tokens). Sin entradas activas, la macro no agrega nada. Una entrada Outlet no puede llamar a otra macro Outlet. Consulta [macros](../prompts/macros.md) para ver la macro.

## Probabilidad y tiempos

**Probability** (Probabilidad) es la probabilidad de que una entrada se dispare cuando sus palabras clave coinciden. El valor predeterminado es 100%. Pon 25% para una probabilidad de uno entre cuatro cada vez.

Los campos de **Timing** (Tiempos) controlan el comportamiento a lo largo de varios mensajes. Los cuatro empiezan sin configurar, lo que significa desactivados.

| Campo | Qué hace | Ejemplo |
| --- | --- | --- |
| **Sticky** (Persistente) | Después de que la entrada se dispara, permanece activa durante esta cantidad de mensajes más, incluso sin una coincidencia de palabra clave. | Un secreto revelado con 3 se queda durante tres mensajes. |
| **Cooldown** (Enfriamiento) | Después de dispararse, espera esta cantidad de mensajes antes de poder dispararse de nuevo. | Un presagio con 5 se dispara como mucho una vez cada cinco mensajes. |
| **Delay** (Retraso) | No puede dispararse hasta que el chat lleve esta cantidad de mensajes. | Un giro con 20 permanece oculto al principio. |
| **Ephemeral** (Efímero) | Se desactiva a sí misma después de esta cantidad de activaciones. 0 significa sin límite. | Una nota de introducción con 1 se dispara una vez. |

**Sticky**, **Cooldown** y **Delay** cuentan mensajes. **Ephemeral** cuenta activaciones.

<a id="decision-activation"></a>

## Activación por Decision

El campo **Decision** (decisión) permite que tu modelo de decisión, un modelo pequeño que responde preguntas de sí o no, decida si una entrada corresponde. Escribe una declaración sobre el chat reciente, como `In the latest message, a dragon is physically present`, y elige un modo.

| Modo | Efecto |
| --- | --- |
| **Off** (Desactivado) | La entrada se activa como siempre. Este es el valor predeterminado. |
| **Require** (Requerir) | La entrada se activa como siempre, y solo cuando la declaración también es verdadera. Filtra las menciones pasajeras. |
| **Trigger** (Activar) | La declaración es otra forma de activar la entrada, incluso sin ninguna palabra clave presente. Detecta paráfrasis y situaciones. |

Puedes usar macros como `{{user}}` y `{{char}}` en la declaración.

Antes de empezar: elige un modelo de decisión en **Decision model** (Modelo de decisión) del panel **Connections** (Conexiones). Sin modelo de decisión, o sin respuesta, la declaración cuenta como no. El editor te avisa cuando no hay ninguno configurado.

- En ese caso, **Require** nunca admite una entrada nueva, aunque una retención **Sticky** existente puede mantener una activa.
- **Trigger** no agrega ninguna vía, y la entrada todavía puede activarse por sus palabras clave.

Dales también una vía ordinaria a las entradas importantes, y usa **Require** solo para filtrar trasfondo opcional.

**Require** solo comprueba una entrada que ya cumple los requisitos mediante palabras clave, coincidencia semántica, **Constant** o una ubicación de mapa, y entonces solo la deja pasar si la declaración también es verdadera. En una entrada **Constant**, la vuelve situacional, por ejemplo unas reglas de combate con `A fight is happening in the latest message`. No analiza cada entrada sin usar.

Las declaraciones de decisión agregan solicitudes al modelo y comparten el límite **Decision statements per turn** (Declaraciones de decisión por turno). Para consejos de redacción, límites, costo y reutilización de respuestas, consulta [Redactar declaraciones](../prompts/conditional-prompts.md#writing-statements), [Límites y costo](../prompts/conditional-prompts.md#limits-and-cost) y [Reutilización de respuestas](../prompts/conditional-prompts.md#answer-reuse). Para configurar el modelo, consulta [Modelos de decisión](../connections/decision-models.md).

Más detalles:

- A una entrada **sticky** no se le vuelve a preguntar mientras dura su retención, y a una entrada en enfriamiento no se le pregunta en absoluto.
- La lista de lorebooks activos muestra **decision** para una entrada que activó una declaración **Trigger**.
- **Peek Prompt** nunca pregunta. Muestra las respuestas que ya tiene el turno.
- La activación por decisión solo se aplica a los turnos de chat. La configuración de Game y los análisis que los agentes ejecutan para sí mismos interpretan las entradas de decisión como no.
- Un `{{#if decision:"..."}}` dentro del contenido de la entrada es distinto. Recorta el texto de una entrada que ya se activó.

## Grupos, filtros y otras opciones

El panel expandido contiene más campos.

| Campo | Qué hace |
| --- | --- |
| **Group** (Grupo) | Las entradas del mismo grupo son mutuamente excluyentes. Solo se activa una por respuesta. Úsalo para alternativas, como tres entradas de "el clima de hoy". Combínalo con una **Probability** baja para que los rumores salgan solo de vez en cuando. |
| **Tag** (Etiqueta) | Una etiqueta de texto libre para tu propia clasificación. No afecta a la activación. |
| **Locked** (Bloqueado) | Impide que el agente **Lorebook Keeper** cambie esta entrada. Consulta [Referencia de agentes descargables](../agents/built-in-agents.md). |
| **No Vector** | Deja la entrada fuera de la búsqueda semántica. Consulta [Búsqueda semántica para lorebooks](semantic-search.md). |
| **Recursion** (Recursión) | Permite que el contenido de esta entrada dispare más entradas. Desactivado de forma predeterminada. Consulta [Presupuestos de tokens y recursión de los lorebooks](token-budgets.md). |

La sección **Context filters & matching sources** (Filtros de contexto y fuentes de coincidencia) limita una entrada a ciertos personajes, etiquetas de personaje o tipos de generación. También te permite escanear campos adicionales de la tarjeta, como la descripción del personaje, en busca de las palabras clave de la entrada. En un chat grupal en modo **Individual**, cada respuesta solo cuenta al personaje que la escribe, así que un filtro de personaje mantiene la entrada fuera de las respuestas de los demás personajes. En una respuesta **Merged (Narrator)** (Fusionado: narrador), cuenta cada personaje del chat, así que la entrada se mantiene si cualquier personaje filtrado está en el chat. Úsalo para secretos que solo conoce un personaje.

## Elegir los ajustes para un dato

Pregúntate cuándo debería ver la IA el dato y luego usa esta tabla.

| El dato | Configuración |
| --- | --- |
| Siempre es cierto | **Constant**. Que sean pocas. |
| Solo importa cuando se nombra | **Normal** con palabras clave específicas, como `Castle Dracul`, `the castle`, `the fortress`. |
| Su palabra clave es una palabra común, como `king` o `home` | **Whole Words**, o **Selective** con palabras clave secundarias. |
| Es importante, pero rara vez se nombra | **Normal** con [búsqueda semántica](semantic-search.md), o palabras clave más amplias. |
| Varias versiones que no deben aparecer juntas | El mismo **Group**. |
| Una regla que el modelo olvida a mitad de escena | **@ Depth** de alrededor de 1 a 4. |

Hábitos que mantienen pequeño un lorebook:

- Usa palabras clave específicas. Una palabra clave como `he` o `the city` coincide con casi cada mensaje y desperdicia presupuesto.
- Rellena la **Description** en cualquier entrada que esperes que enrute el **Knowledge Router**. Lee la descripción, no el contenido.
- Construye las ambientaciones grandes como un árbol. Agrega una entrada eje para un grupo, como una para El Imperio que liste a sus miembros, junto a una entrada para cada miembro.
- Deja **Recursion** desactivado en los ejes. Si no, nombrar al grupo mete de golpe en el prompt la entrada completa de cada miembro.

Por ejemplo, toma la regla de cómo se puede matar al villano, que la IA tiende a olvidar. Hazla **Selective** con **AND Any**, **Whole Words** activado y **Order** 10. Usa las palabras clave principales `weakness`, `kill`, `destroy`, `stake` y las palabras clave secundarias `Vlad`, `the count`. Las palabras clave secundarias la mantienen callada cuando el grupo mata a un lobo. **Whole Words** impide que `stake` coincida con "mistake". El orden bajo evita que se recorte en una escena concurrida.

Dónde vive un lorebook decide qué chats lo ven. Consulta [Visión general de los lorebooks](overview.md) y [Vincular lorebooks a personajes y personas](linking-to-characters.md) para los lorebooks globales, vinculados e incrustados.

## Macros en el contenido de la entrada

El **Content** se expande como cualquier otro texto del prompt antes de enviarse. Macros útiles:

- `{{char}}` y `{{user}}` dan los nombres, para que una entrada compartida se lea bien en cualquier chat.
- `{{roll:1d6}}` tira un dado. `{{setvar::mood::angry}}` guarda un valor para este chat, y `{{getvar::mood}}` lo vuelve a leer.
- `{{random::a::b::c}}` elige una opción. Agrega pesos, como en `{{random::common@3::rare@1}}`. Combínalo con una **Probability** baja para meter toda una tabla de encuentros en una sola entrada.
- `{{include::Entry name}}` inserta el texto de otra entrada del mismo lorebook, incluso una desactivada. Consulta [Macro de inclusión de lorebook](../prompts/macros.md#lorebook-include-macro).
- `{{// note}}` es un comentario. Se elimina antes de que la IA lo vea y antes de los escaneos de recursión, así que nunca puede disparar nada.

Para ver la lista completa, consulta [Macros de prompt](../prompts/macros.md).

Con **Recursive** (Recursivo) activado, Marinara vuelve a escanear el contenido expandido de las entradas activadas. El texto que produce una macro puede disparar más entradas.

## La herramienta Keyword test

El panel **Keyword test** (Prueba de palabras clave), en la parte superior de la pestaña **Entries**, comprueba tus palabras clave sin un chat.

1. Expande **Keyword test**.
2. Pega un párrafo de muestra o unos cuantos mensajes en el cuadro.

Las entradas que coincidirían reciben un acento verde y un chip **Would activate** (Se activaría). Las entradas **Constant** reciben un chip **Always active** (Siempre activa). Una línea de conteo muestra cuántas entradas habilitadas se activarían. El interruptor **Include other lorebooks** (Incluir otros lorebooks) también comprueba las entradas habilitadas de tus otros lorebooks.

La prueba ignora los tiempos, la probabilidad, los filtros de personaje y de persona, y la coincidencia por significado, así que un chat real todavía puede diferir.

<a id="entry-folders"></a>

## Carpetas de entradas

Las carpetas agrupan entradas dentro de un mismo lorebook. Son distintas de las carpetas de biblioteca del panel **Lorebooks**.

- Haz clic en **Add Folder** y luego cámbiale el nombre a la carpeta ahí mismo.
- Arrastra una entrada sobre una carpeta, o usa el selector **Folder** (Carpeta) de la entrada (funciona con un toque).
- Arrastra una carpeta sobre otra para anidarla, o sobre la franja superior para desanidarla.
- Cada carpeta tiene un interruptor de activación (su tooltip dice "Folder enabled"). Cuando está desactivado, cada entrada que contiene deja de activarse.
- **Clone folder** (Clonar carpeta) copia la carpeta con todas sus entradas y subcarpetas.
- **Delete folder** (Eliminar carpeta) quita solo la carpeta. Su contenido sube al nivel superior.

Las carpetas solo se muestran como grupos cuando ordenas por **Order** sin búsqueda. Si no, ves una lista plana y la nota **Folder view paused (clear search and sort by Order)** (Vista de carpetas en pausa: borra la búsqueda y ordena por Order).

## Solución de problemas

| Síntoma | Solución |
| --- | --- |
| Una entrada nunca se dispara. | Dale palabras clave o hazla **Constant**. Comprueba que el lorebook esté habilitado y activo en el chat. |
| Una palabra clave funcionaba y dejó de funcionar. | Marinara solo escanea los últimos mensajes (**Scan Depth**, Profundidad de escaneo; 2 de forma predeterminada). Sube **Scan Depth**, agrega **Sticky** o haz la entrada **Constant**. |
| Una entrada se dispara en las escenas equivocadas. | Usa **Whole Words**, palabras clave secundarias **Selective** o un filtro de personaje. |
| El trasfondo importante se pierde. | Dale un **Order** más bajo o sube el **Token Budget**. **Active Context** (Contexto activo) en **Chat Settings** (Ajustes del chat) muestra qué se omitió y por qué. Consulta [Presupuestos de tokens y recursión de los lorebooks](token-budgets.md). |
| La IA ignora una entrada. | Revisa **Active Context** para confirmar que se activó. Un dato lejos del último mensaje tiene menos peso que uno colocado cerca del último mensaje con **@ Depth**. |

## Guías relacionadas

- [Visión general de los lorebooks](overview.md)
- [Modelos de decisión](../connections/decision-models.md)
- [Presupuestos de tokens y recursión de los lorebooks](token-budgets.md)
- [Búsqueda semántica para lorebooks](semantic-search.md)
- [Fuentes de conocimiento: agentes de recuperación y de enrutamiento](../agents/knowledge-sources.md)
