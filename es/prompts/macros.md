# Macros de prompt

Esta guía explica las macros de prompt en Marinara Engine. Una macro es una `{{tag}}` corta que Marinara reemplaza por un valor en vivo. El valor se rellena cuando se arma un prompt (las instrucciones enviadas a la IA), como tu nombre o la fecha actual. Aprenderás todas las macros integradas, dónde puedes escribirlas y los errores que debes evitar.

## Qué son las macros y dónde funcionan

Una macro es texto literal envuelto en llaves dobles, como `{{user}}` o `{{char}}`. Cuando Marinara arma el texto que envía a la IA, busca estas etiquetas y cambia cada una por su valor actual. No hay ningún interruptor para activar las macros. Cualquier campo que las admita siempre las resuelve.

Los nombres de las macros no distinguen mayúsculas de minúsculas para las etiquetas integradas. Así que `{{user}}` y `{{USER}}` funcionan igual.

Puedes escribir macros en muchos lugares de la app:

- Campos de personaje en el **Character Editor** (Editor de personaje): Description, Personality, Backstory, Appearance, Scenario, Example Dialogue, System Prompt, Post-History Instructions y el **Depth Prompt**.
- Campos de persona en el **Persona Editor** (Editor de persona) (los mismos campos de la tarjeta).
- Los campos Description y Content de las entradas de lorebook (libro de trasfondo).
- Secciones del preset de prompt en el **Preset Editor** (Editor de presets).
- Los campos Find, Replace y Trim de los scripts de regex.
- Plantillas de prompt de agente.
- El cuadro de mensaje del chat. Escribe `{{roll:1d20}}` en un mensaje y se resuelve antes de que el mensaje se envíe.

El valor de una macro puede contener otra macro, y Marinara también resuelve esa.

## Antes de empezar

No necesitas configurar nada. Las macros integradas funcionan de inmediato, sin API key (clave de API) y sin ninguna conexión extra. Una API key es el código secreto que permite a Marinara hablar con un proveedor de IA, pero las macros se ejecutan dentro de Marinara por sí solas.

Dos funciones de macro sí dependen de otras partes de la app:

- Las variables de preset (el comodín `{{NAME}}`) necesitan un preset de prompt que las defina. Consulta [Variables de preset](preset-variables.md).
- La macro de agente `{{agent::TYPE}}` solo muestra texto una vez que el agente correspondiente se ha ejecutado y ha producido una salida.

## Macros de identidad, personaje y persona

Estas macros traen los nombres y los campos de la tarjeta de la persona que habla y del personaje que responde. El usuario eres tú (o tu persona activa). El personaje es el bot que responde.

| Macro | Se resuelve como |
| --- | --- |
| `{{user}}` / `{{userName}}` | Tu nombre visible actual (o el nombre de la persona). El valor predeterminado es `User` cuando no hay ninguna persona definida. |
| `{{userNamePhonetic}}` | El nombre Phonetic de tu persona, o `{{user}}` cuando está vacío. |
| `{{char}}` / `{{charName}}` | El nombre del personaje actual. El valor predeterminado es `Character`. |
| `{{21-character-card-ID}}` | Nombre de otro personaje. Reemplaza el texto del marcador por el ID exacto de 21 caracteres de su tarjeta para incluirla en el contexto. |
| `{{persona-21-character-card-ID}}` | Sintaxis de marcador de posición para el nombre de otra persona. Reemplaza el texto después de `persona-` por el ID exacto de 21 caracteres de esa tarjeta para incluir el contexto de su tarjeta. |
| `{{charNamePhonetic}}` | El nombre Phonetic del personaje, o `{{char}}` cuando está vacío. |
| `{{characters}}` | Todos los personajes del chat, unidos por comas. |
| `{{group}}` | Todos los demás personajes activos del chat grupal, excluyendo al que responde en ese momento. La persona no forma parte de esta lista de personajes. |
| `{{persona}}` | Los campos Description, Personality, Backstory, Appearance y Scenario de tu persona, unidos por saltos de línea. |
| `{{personaDescription}}` | El campo Description de tu persona. |
| `{{personaPersonality}}` | El campo Personality de tu persona. |
| `{{personaBackstory}}` | El campo Backstory de tu persona. |
| `{{personaAppearance}}` | El campo Appearance de tu persona. |
| `{{personaScenario}}` | El campo Scenario de tu persona. |

Las macros de campos de personaje leen la tarjeta de personaje actual:

| Macro | Campo de la tarjeta de personaje |
| --- | --- |
| `{{description}}` | Description |
| `{{personality}}` | Personality |
| `{{backstory}}` | Backstory |
| `{{appearance}}` | Appearance |
| `{{scenario}}` | Scenario |
| `{{example}}` | Example Dialogue |
| `{{charSysInfo}}` | System Prompt |
| `{{charPostHistory}}` | Post-History Instructions |

En un chat con un solo personaje, estas se resuelven contra ese personaje. En un chat grupal, se resuelven contra el primer personaje de forma predeterminada. Para repetir texto por cada personaje, ponlo dentro de un bloque de grupo entre corchetes. Consulta [Prompts condicionales](conditional-prompts.md) para los bloques de grupo.

`{{group}}` sigue al personaje que responde en ese momento, incluso durante las generaciones grupales individuales. Por ejemplo, si Pantalone está respondiendo en un grupo de Roleplay que contiene a Powers That Be, Maukie y Pantalone, `{{group}}` se resuelve como `Powers That Be, Maukie`. Una tarjeta de personaje permanece en esta lista aunque su nombre coincida con `{{user}}`.

El campo del nombre Phonetic tiene dos funciones. Define cómo pronuncia el nombre el text-to-speech. También alimenta a `{{charNamePhonetic}}` y `{{userNamePhonetic}}`. Lo encontrarás tanto en el **Character Editor** como en el **Persona Editor**.

Para referirte a un personaje que no está en el chat actual, copia el ID de su tarjeta y colócalo directamente entre llaves dobles, como `{{V1StGXR8_Z5jdHi6B-myT}}`. No incluyas los caracteres literales `<` o `>`. Marinara reemplaza la macro por el nombre del personaje. En los chats de Roleplay que usan un preset de prompt, también añade Description, Personality, Appearance, Backstory, Scenario y Example Dialogue de la tarjeta al prompt de sistema; en los demás chats, la macro solo se convierte en el nombre. Funciona en mensajes del chat y campos de prompt, y en los chats de Roleplay con preset también en entradas activadas de lorebook. Se excluyen los saludos iniciales de la tarjeta. Los lorebooks activados vinculados a ella conservan sus reglas normales de palabras clave, constant, filtros, probabilidad y presupuesto de tokens. Si el personaje ya está en el chat, la macro se sigue reemplazando por su nombre, y su tarjeta no se añade por segunda vez.

Para referirte a una persona inactiva, antepón `persona-` al ID copiado, por ejemplo `{{persona-P1StGXR8_Z5jdHi6B-myT}}`. Marinara reemplaza la macro por el nombre de la persona y añade sus campos Description, Personality, Appearance, Backstory y Scenario a ID Macro Cards. Los lorebooks adjuntos siguen sus reglas normales de activación.

## Macros del modo de conversación

Estas cuatro macros solo funcionan en **Conversation Mode**. En todos los demás modos siempre se resuelven a nada, incluso cuando el mismo texto de tarjeta o de preset se comparte entre modos.

| Macro | Se resuelve como |
| --- | --- |
| `{{convo_display}}` | El **Convo Display Name** del personaje, o el nombre de la tarjeta cuando está vacío. |
| `{{char_about}}` | El **About Me** actual del personaje (la anulación por chat si se define, si no el valor predeterminado de la tarjeta). |
| `{{persona_about}}` | El About Me actual de tu persona. |
| `{{convo_behavior}}` | El texto **Convo Behavior** del personaje, pero solo cuando su ajuste de inserción está configurado para colocarlo en esta macro. |

Editas estos campos en la pestaña **Convo** del **Character Editor** y del **Persona Editor**. Para la configuración completa, consulta [Perfiles del modo de conversación](../conversation/profiles.md).

## Macros de colocación en la conversación

**Conversation Mode** inserta automáticamente varios bloques en el prompt por ti. Estas macros permiten que un preset **mueva** un bloque a donde tú coloques la macro. Cuando usas una, Marinara renderiza ese bloque en la macro y **omite** su inserción automática, para que el contenido nunca se duplique. Cada macro tiene uno o más alias; todos los alias se comportan igual.

| Macro (y alias) | Coloca |
| --- | --- |
| `{{context}}`, `{{status}}` | El bloque de contexto / estado de la conversación. |
| `{{commands}}`, `{{commandList}}` | El recordatorio de comandos disponibles. |
| `{{reactRules}}`, `{{emojiReact}}` | Las reglas de **reacción** con emoji personalizado. |
| `{{replyRules}}` | Las reglas de **respuesta** con emoji personalizado y sticker. |
| `{{memories}}`, `{{memoryRecall}}` | El bloque de Memory Recall. |
| `{{lorebook}}`, `{{lore}}` | Las inyecciones de lorebook. |

Estas solo se aplican en **Conversation Mode**. En una conversación con un solo personaje, colocar tú mismo las biografías de los participantes con `{{char_about}}` / `{{persona_about}}` (ver arriba) funciona de la misma forma: Marinara omite entonces su bloque automático de "about me" de los participantes para que las biografías no se inserten dos veces. Las conversaciones grupales conservan el bloque automático de participantes porque cualquiera de las dos macros singulares cubre solo a un participante y no debe ocultar la biografía de todos los demás.

## Macros de contexto

Estas macros describen el chat actual y la solicitud actual.

| Macro | Se resuelve como |
| --- | --- |
| `{{input}}` | El mensaje de usuario más reciente disponible para el prompt. |
| `{{model}}` | El nombre del modelo actual, cuando hay uno seleccionado. |
| `{{reasoning}}` | El nivel de razonamiento con el que se genera esta respuesta: `low`, `medium`, `high`, `xhigh` o `max`, o `off` cuando no se pide al modelo que piense. |
| `{{chatId}}` | El ID del chat actual. |
| `{{lastGenerationType}}` | Una etiqueta que indica por qué se está generando esta respuesta. |
| `{{idle_duration}}` | Cuánto tiempo ha pasado desde la última actividad del chat, como texto tipo `8 minutes` o `1 hour 5 minutes`. |
| `{{gameStoryboardKeyframeCount}}` | El objetivo actual de **Keyframes per Turn** del **Game Mode**, de 1 a 6. El valor predeterminado es `3`. |
| `{{agent::TYPE}}` | La salida guardada de un agente del tipo indicado. |

`{{reasoning}}` indica el nivel que el modelo recibe realmente, una vez combinados tu preset, tu conexión y los ajustes del chat. **Maximum** aparece como el nivel más alto que admite el modelo, así que puede leerse `max`, `xhigh` o `high`. Como `off` se lee como falso, `{{#if reasoning}}` conserva un bloque solo mientras el modelo piensa. Si tu preset o tu chat ya tiene una variable propia llamada `reasoning`, esa variable conserva el nombre.

El valor de `{{lastGenerationType}}` es una etiqueta simple. Los valores de ejemplo que se ven en la app incluyen `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan` y `retry_agents`. Esta lista puede crecer, así que trátala como ejemplos, no como un conjunto fijo.

`{{gameStoryboardKeyframeCount}}` se proporciona a los prompts del GM (director del juego) del **Game Mode**, incluido el **Storyboard Game Prompt** integrado. Es un objetivo narrativo, no una exigencia de exactamente ese número de párrafos. El planificador del storyboard (secuencia de viñetas) igualmente devuelve menos tomas cuando un turno no contiene suficientes momentos visuales distintos.

La macro `{{agent::TYPE}}` inserta la salida guardada de un agente (un ayudante en segundo plano que rellena cosas como un tracker de escena, es decir, un agente de seguimiento). La forma más fácil de añadirla es dentro del **Preset Editor**: haz clic en **Add Section**, abre el grupo **Agent Sections** y elige un agente. Marinara crea una sección que ya contiene la etiqueta `{{agent::TYPE}}` correcta. Esta macro se resuelve al final, así que el texto del agente no puede inyectar más macros en tu prompt.

## Macros Outlet de lorebooks

`{{outlet::name}}` inserta contenido de las entradas de lorebook cuya **Position** es **Outlet** y cuyo **Outlet name** coincide exactamente con `name`. Los nombres de Outlet distinguen mayúsculas y minúsculas. Por ejemplo, `{{outlet::character_rules}}` no coincide con un Outlet llamado `Character_Rules`.

Las entradas Outlet siguen usando la activación normal de los lorebooks. Las palabras clave, el modo Constant, la probabilidad, los filtros, los tiempos, los límites de entradas y los presupuestos de tokens deciden si una entrada está activa para la generación actual. Las entradas activas con el mismo nombre de Outlet se unen según su **Order**, separadas por saltos de línea. Solo se insertan en la macro; no se añaden también en una posición normal del lorebook.

Usa las macros Outlet en secciones de prompt de los modos Conversation, Roleplay o Game. La macro funciona aunque aparezca antes del marcador de lorebook del preset, y un preset no necesita un marcador de lorebook si solo utiliza entradas Outlet. Un Outlet desconocido o inactivo se resuelve como texto vacío. Una entrada Outlet no puede expandir otra macro Outlet, por lo que los Outlets anidados no son recursivos.

## Macro de tamaño de lorebook

`{{lorebooksize::ID}}` se resuelve como el número total de entradas del lorebook con ese ID. Reemplaza `ID` por el ID real del lorebook; cópialo desde el panel Lorebooks. Por ejemplo, si su ID es `V1StGXR8_Z5jdHi6B-myT` y contiene 151 entradas, `{{lorebooksize::V1StGXR8_Z5jdHi6B-myT}}` se resuelve como `151`.

Los IDs desconocidos se resuelven como `0`. El recuento incluye todas las entradas, estén activadas, desactivadas o en carpetas.

Usa esta macro en secciones de prompt, campos de tarjetas de personaje, contenido de entradas de lorebook o cualquier lugar donde se resuelvan macros.

<a id="lorebook-include-macro"></a>

## Macro de inclusión de lorebook

`{{include::ENTRY}}` inserta el texto de una entrada de lorebook en el lugar donde escribes la macro. Guarda un fragmento de texto compartido, como las reglas de la casa, en una sola entrada y reutilízalo en otras entradas, secciones de prompt o tarjetas, para que solo haya una copia que editar. Reemplaza `ENTRY` por el ID o el nombre de la entrada. Los nombres no distinguen mayúsculas de minúsculas.

- Dentro de una entrada de lorebook, un nombre se busca en el propio lorebook de esa entrada.
- En cualquier otro lugar, un nombre se busca en los lorebooks que usa este chat: los añadidos al chat, los vinculados a sus personajes y a su persona, y los globales.
- Un ID encuentra la entrada en cualquier lorebook.

`{{include::BOOK::ENTRY}}` toma la entrada del lorebook que indiques por su ID o su nombre. Ese lorebook no tiene que estar añadido al chat, ni siquiera activado.

```text
{{include::Rules of the arena}}
{{include::Shared lore::Rules of the arena}}
```

La entrada incluida no tiene que activarse, y puede estar desactivada, así que puedes tener entradas que existan solo para ser incluidas. Las macros del texto incluido funcionan como siempre, y ese texto también puede incluir otras entradas. Si una inclusión lleva de vuelta a una entrada dentro de la que ya está, como una entrada que se incluye a sí misma, esa inclusión se resuelve a nada en lugar de repetirse indefinidamente. Una entrada o un lorebook que no se encuentra también se resuelve a nada.

Escribe los nombres y los IDs como texto plano. Las macros dentro de ellos, como `{{include::{{char}}}}`, no se completan.

## Macros de tiempo

Todas las macros de tiempo leen un mismo momento compartido por resolución, así que siempre coinciden entre sí. La zona horaria proviene de tu navegador.

| Macro | Se resuelve como |
| --- | --- |
| `{{date}}` | La fecha actual, como `YYYY-MM-DD`. |
| `{{time}}` | La hora actual, como `HH:MM` en reloj de 24 horas. |
| `{{datetime}}` / `{{isotime}}` | Una marca de tiempo completa con el desfase de zona horaria. Los dos nombres significan lo mismo. |
| `{{weekday}}` | El nombre del día de la semana, como `Monday`. |
| `{{timezone}}` | El nombre de la zona horaria, como `Europe/Warsaw`. |

## Macros aleatorias y de dados

Estas macros añaden azar a tus prompts. Usa la macro aleatoria (`{{random}}`) para números y elecciones, y la macro de tirada (`{{roll}}`) para los dados.

| Macro | Comportamiento |
| --- | --- |
| `{{random}}` | Un número entero aleatorio de 0 a 100. |
| `{{random:X:Y}}` | Un número entero aleatorio entre X e Y, ambos incluidos. |
| `{{random::A::B::C}}` | Elige una opción al azar y luego resuelve las macros solo dentro de la opción elegida. |
| `{{random::A@2::B@0.5}}` | Una elección aleatoria ponderada. Consulta las reglas de ponderación más abajo. |
| `{{roll:XdY}}` | El total de una tirada de dados. Por ejemplo, `{{roll:2d6}}` tira dos dados de seis caras y los suma. |

Aquí tienes una elección aleatoria simple que puedes copiar:

```text
{{random::The door creaks open.::A bell rings.::Someone laughs nearby.}}
```

### Elecciones ponderadas

Añade un `@number` final a una opción para definir qué tan probable es. El número es un peso relativo. Cuanto mayor, más probable.

```text
{{random::Common event@1::Rare event@0.25}}
```

En ese ejemplo el peso total es 1.25, así que las probabilidades son:

| Opción | Peso | Probabilidad |
| --- | --- | --- |
| Common event | 1 | 80% |
| Rare event | 0.25 | 20% |

Reglas de ponderación:

- Un peso ausente cuenta como 1.
- Se permiten pesos decimales, como 0.5 o 0.01.
- Un peso de 0 mantiene la opción, pero nunca puede elegirse.
- Si todas las opciones tienen peso 0, la macro se resuelve a nada.
- Solo un `@number` final cuenta como peso. Un `@` en otro lugar, como en una dirección de correo, se deja tal cual.

## Variables dinámicas

Las variables permiten que una parte de tu prompt almacene un valor y que una parte posterior lo lea.

| Macro | Comportamiento |
| --- | --- |
| `{{setvar::name::value}}` | Almacena un valor y no deja nada en el texto. |
| `{{getvar::name}}` | Lee un valor almacenado (nada si nunca se definió). |
| `{{addvar::name::value}}` | Suma si ambos valores son numéricos; de lo contrario, añade el texto. |
| `{{addnumvar::name::value}}` | Extensión de Marinara que siempre suma numéricamente. Los valores ausentes o no válidos cuentan como 0 y se ignora el desbordamiento. |
| `{{incvar::name}}` | Suma 1 a una variable numérica e inserta el nuevo valor. |
| `{{decvar::name}}` | Resta 1 a una variable numérica e inserta el nuevo valor. |

Las variables se resuelven de izquierda a derecha durante el armado del prompt y se guardan en el chat actual. Un valor definido pronto, por ejemplo en una entrada de lorebook que aparece primero, puede leerse más adelante en el mismo prompt. Como las variables locales de SillyTavern, se conserva en turnos posteriores y tras reiniciar, sin filtrarse a otros chats.

Cualquier `{{NAME}}` que no sea una macro integrada se busca por nombre: primero entre las variables del preset y después entre las del chat. Si ninguna tiene ese nombre, la etiqueta queda en el texto exactamente como la escribiste. La variable del preset tiene prioridad cuando ambas usan el mismo nombre. Consulta [Variables de preset](preset-variables.md) para conocer esa parte.

### Variables del chat

No necesitas usar `{{setvar}}` para crear una variable. La sección **Chat Variables** (variables del chat) del panel **Chat Settings** (ajustes del chat) te permite escribir directamente un nombre y un valor, y usar ese nombre donde funcionen las macros, incluso en tus propios mensajes. Añade `char1` con el valor `Mary`, escribe `{{char1}} walks in.` y la IA lee "Mary walks in."

Ten en cuenta estas reglas:

- Los nombres admiten letras, números y guiones bajos, y deben empezar con una letra o un guion bajo. Los nombres de exactamente 21 caracteres están reservados para referencias a personajes. Un nombre con un punto o un guion todavía se puede establecer y leer con `{{setvar}}` y `{{getvar}}`, pero no se resuelve con la forma directa `{{name}}`.
- No puedes usar el nombre de una macro integrada. `{{char}}` siempre se refiere al personaje.
- Tu mensaje sigue mostrando la etiqueta que escribiste. El valor se sustituye al construir el prompt, así que cambiarlo más adelante también cambia los turnos anteriores que lo usaron.
- La sección también muestra las variables establecidas con `{{setvar}}`, porque comparten un mismo almacenamiento por chat.

Para conocer el panel, consulta [Resumen de los ajustes del chat](../chats/chat-settings.md).

## Macros de formato

Estas macros dan forma al texto que las rodea.

| Macro | Comportamiento |
| --- | --- |
| `{{newline}}` / `{{\n}}` | Inserta un salto de línea. |
| `{{trim}}` | Se elimina a sí misma y recorta los espacios en blanco alrededor de ese punto. |
| `{{trimStart}}` | Recorta los espacios en blanco al inicio del texto circundante. |
| `{{trimEnd}}` | Recorta los espacios en blanco al final del texto circundante. |
| `{{uppercase}}...{{/uppercase}}` | Convierte el texto envuelto en MAYÚSCULAS. |
| `{{lowercase}}...{{/lowercase}}` | Convierte el texto envuelto en minúsculas. |
| `{{noop}}` | Se elimina de la salida. Útil como marcador de posición inofensivo mientras editas. |
| `{{// comment}}` | Una nota del autor que se elimina de la salida. |
| `{{banned "text"}}` | Se elimina de la salida. No filtra ni bloquea nada. |

## Mostrar llaves dobles literales

No hay carácter de escape para las macros. Si quieres que las llaves dobles se queden en el texto, usa un nombre que Marinara no conozca. Cualquier `{{name}}` desconocido se deja exactamente como se escribió, siempre que ninguna variable de preset ni del chat comparta ese nombre. Si necesitas una nota privada que nunca llegue a la IA, usa `{{// like this}}` en su lugar.

## La referencia de macros y /macros

Cada campo con macros habilitadas tiene dos botones pequeños en su esquina:

- **Expand editor** (Ampliar editor) abre una ventana de edición más grande para ese campo.
- **Macro reference** (Referencia de macros) abre una ventana titulada **Macro reference** que lista todas las macros integradas por categoría, cada una con su sintaxis exacta. Esta lista se genera desde la misma fuente que usa el motor, así que siempre es precisa.

Estos campos también completan los nombres de las macros por ti. Escribe `{{ch` al final de una línea y el resto, `ar}}`, aparece en texto tenue. Pulsa Tab, o toca el texto tenue, para aceptarlo. Sigue escribiendo para ignorarlo. Para una macro que recibe un valor, como `{{getvar::`, se detiene donde escribes el valor.

También puedes escribir `/macros` en el cuadro de chat (la forma corta `/macro` también funciona). Imprime la lista completa de macros directamente en el chat como recordatorio rápido.

Los bloques condicionales pueden combinar comparaciones con `||` (OR), `&&` (AND) y paréntesis. Las listas de igualdad pueden usar la forma compacta `{{#if character == "Maukie" || "Pantalone"}}`. Consulta [Prompts condicionales](conditional-prompts.md) para la precedencia, ejemplos de chat grupal y la lista completa de operadores.

Una condición también puede consultar a tu Decision model sobre la escena: `{{#if decision:"The latest message moves the scene to a new place"}}` para sí o no y `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}` para elegir una opción. Sin Decision model o sin respuesta, se interpretan como no. Consulta [Consultar al Decision model](conditional-prompts.md#asking-the-decision-model). Añade `sticky:3 cooldown:5` después de una declaración para conservar un sí tres turnos y dejarla descansar cinco; consulta [Sticky y cooldown](conditional-prompts.md#sticky-and-cooldown). Añade `until:"..."` o `while:"..."` para conservar un sí mientras lo permita una segunda declaración; consulta [Until y while](conditional-prompts.md#until-and-while). `every:3` pregunta solo cada tres turnos, y `priority:high` o `priority:low` decide cuáles caben en un plan de prompt; consulta [Comprobar cada varios turnos](conditional-prompts.md#checking-every-few-turns), [Prioridad](conditional-prompts.md#priority) y [Límites y costo](conditional-prompts.md#limits-and-cost).

## Errores comunes

- No escribas variables dentro de un bloque `{{random::...}}`. Un `{{setvar}}` dentro de una opción aleatoria se ejecuta para cada opción antes de hacer la elección, no solo para la elegida.
- No uses una variable local como si fuera global. Los valores definidos con `{{setvar}}` solo persisten en el chat actual; cada otro chat tiene su propio valor.
- Una sección del prompt o entrada de lorebook que ejecute `{{setvar}}` sobrescribe una variable del chat con el mismo nombre, porque ambas usan un mismo almacenamiento por chat. Usa nombres distintos si quieres conservar las dos.
- `{{prompt}}` no es una macro. Si todo tu mensaje es `{{prompt}}`, Marinara abre el visor **Peek Prompt** en lugar de enviarlo. Consulta [Peek Prompt](../chats/peek-prompt.md).
- Los Custom Tools no usan texto `{{macro}}`. No pegues `{{roll:1d20}}` en un campo de herramienta esperando que se resuelva.
- La plantilla de prompt de **Impersonate** acepta solo unos pocos marcadores de posición, no la lista completa de macros. Sus nombres también difieren, así que una macro que funciona en una tarjeta puede no funcionar ahí.
- La salida de macro muy grande o muy anidada se corta de forma silenciosa. No hay error, así que mantén las expansiones de macro dentro de lo razonable.

## Guías relacionadas

- [Prompts condicionales](conditional-prompts.md)
- [Variables de preset](preset-variables.md)
- [Preset Editor y Prompt Manager](presets.md)
- [Peek Prompt](../chats/peek-prompt.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
- [Perfiles del modo de conversación](../conversation/profiles.md)
