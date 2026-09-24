# Prompts condicionales ({{#if}})

Esta guía explica cómo usar los bloques `{{#if}}` en Marinara Engine. Un bloque condicional te permite incluir cierto texto del prompt (las instrucciones enviadas a la IA) solo cuando un valor cumple una regla que tú defines. Los condicionales forman parte del sistema de macros, así que funcionan en todos los lugares donde funcionan las macros, incluidas las tarjetas de personaje, las personas, las entradas de lorebook y los presets de prompt.

## Qué hacen los prompts condicionales

Una macro es un marcador de posición con `{{double-brace}}` que Marinara Engine reemplaza por un valor en vivo mientras arma tu prompt. Un bloque condicional va un paso más allá. Comprueba un valor y luego conserva una parte del texto y descarta el resto.

Escribes una condición, algo de texto para usar cuando la condición es verdadera y (opcionalmente) texto para usar cuando es falsa. Marinara lee la condición cada vez que arma un prompt. Esto significa que la misma tarjeta o preset puede comportarse de forma distinta para diferentes personajes, personas o chats.

Un uso común son las instrucciones específicas de un personaje dentro de un mismo preset compartido. Otro uso común es incluir un campo solo cuando tiene contenido, para no enviar una etiqueta vacía al modelo.

## La sintaxis básica

Un bloque condicional empieza con `{{#if condition}}` y termina con `{{/if}}`. Todo lo que hay entre ambos es el texto que se usa cuando la condición es verdadera.

```
{{#if condition}}
Text used when the condition is true.
{{/if}}
```

Puedes añadir una rama `{{else}}` para el caso falso:

```
{{#if condition}}
Text used when true.
{{else}}
Text used when false.
{{/if}}
```

También puedes encadenar condiciones adicionales con `{{else if}}`. Marinara comprueba cada rama en orden, de arriba hacia abajo. Conserva la primera rama cuya condición sea verdadera, resuelve las macros dentro de esa rama y descarta todas las demás. Si ninguna condición es verdadera y no hay `{{else}}`, todo el bloque se resuelve en nada.

```
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

Puedes poner un bloque en varias líneas, como se muestra arriba, o en una sola línea. También puedes anidar un condicional dentro de otra rama de un condicional más grande.

## Operadores admitidos

La condición suele ser un valor a la izquierda, un operador y un valor a la derecha, como `char == "Alice"`. La tabla de abajo lista todos los operadores que puedes usar. Cada operador se muestra en estilo de código.

| Operador | Significado |
| --- | --- |
| `==`, `=`, `is` | Igual. |
| `!=`, `is not` | Distinto. |
| `>` | Mayor que (solo números). |
| `<` | Menor que (solo números). |
| `>=` | Mayor o igual que (solo números). |
| `<=` | Menor o igual que (solo números). |
| `contains`, `includes` | El valor de la izquierda contiene al de la derecha como texto. |
| `not contains`, `not includes` | El valor de la izquierda no contiene al de la derecha. |

Algunas reglas controlan cómo funciona la comparación:

1. Para `==`, `=`, `is`, `!=` e `is not`, si ambos lados parecen números, Marinara los compara como números. Así que `5` es igual a `5.0`. En caso contrario los compara como texto, ignorando mayúsculas y minúsculas. Así que `Mari` es igual a `mari`.
2. Para `>`, `<`, `>=` y `<=`, ambos lados deben ser números. Si alguno de los lados no es un número, la condición es falsa.
3. Para `contains`, `includes`, `not contains` y `not includes`, la coincidencia no distingue mayúsculas de minúsculas. Así que `contains "dr"` coincide con el texto `Dr Smith`.

## Combinar condiciones con OR y AND

Usa `||` cuando cualquiera de las condiciones pueda coincidir. Usa `&&` cuando todas las condiciones deban coincidir.

```
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared Maukie and Pantalone instructions.
{{/if}}

{{#if characters contains "Maukie" && characters contains "Pantalone"}}
Both characters are present in this chat.
{{/if}}
```

`&&` se evalúa antes que `||`. Añade paréntesis cuando quieras controlar el orden de forma explícita:

```
{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

Para varias opciones de igualdad sobre el mismo valor, puedes omitir el lado izquierdo repetido después de `||`:

```
{{#if character == "Maukie" || "Pantalone"}}
Use the shared instructions.
{{/if}}
```

Este atajo significa `character == "Maukie" || character == "Pantalone"`. Aplica a los operadores de igualdad `==`, `=` e `is`. Escribe condiciones completas a ambos lados de `&&`, ya que un mismo valor normalmente no puede ser igual a dos opciones distintas a la vez.

### Comprobaciones de veracidad (sin operador)

Si escribes una condición sin operador, Marinara hace una comprobación de veracidad. Esto plantea una pregunta simple: ¿este valor tiene contenido real dentro?

```
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

Una comprobación de veracidad es verdadera cuando el valor no está vacío y no es una de estas palabras: `false`, `0`, `no`, `off`, `null` o `undefined`. La comprobación de palabras ignora mayúsculas y minúsculas. Usa una comprobación de veracidad cuando solo quieras incluir texto si un campo está rellenado.

### Qué puedes comparar

El lado izquierdo o derecho de una condición puede ser cualquiera de estos:

1. Una palabra clave de campo o identidad, como `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input` o `model`. Estas leen los mismos valores que las macros correspondientes. `group` lista los demás personajes activos del chat después de excluir al que responde en ese momento.
2. Un literal entre comillas, como `"Alice"`.
3. El nombre de una variable de preset, como `length`. Una variable de preset es un valor con nombre que tú defines en un Prompt Preset. Consulta [Variables de preset](preset-variables.md).
4. Una búsqueda explícita de variable escrita como `var:name` o `var.name`.
5. Otra macro, cuyo valor se resuelve primero y luego se compara.
6. Las preguntas y opciones de Decision, como `decision:"..."` y `decision_choice:"..."`. Piden un juicio rápido al Decision model seleccionado antes de construir el prompt. Consulta [Preguntar al modelo de decisión](#asking-the-decision-model).

Si escribes una palabra suelta que no es una palabra clave, Marinara la trata como el nombre de una variable. Si no existe ninguna variable con ese nombre, usa la palabra como su propio texto plano. Poner tus valores literales entre comillas evita esta confusión, así que ponlos entre comillas cuando tengas dudas.

## Reglas para las comillas

Cuando comparas contra un fragmento de texto fijo, ponlo entre comillas. Esto le dice a Marinara que lo trate como un literal exacto y no como una palabra clave o una variable.

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{/if}}
```

Puedes usar comillas dobles rectas o comillas simples rectas. Marinara también acepta comillas curvas (tipográficas), pero las comillas rectas son las más seguras y coinciden con todos los ejemplos de la app. Dentro de un valor entre comillas puedes escapar una comilla con una barra invertida, y puedes escribir `\n` para un salto de línea.

Pon siempre entre comillas un literal que tenga un espacio, como `"Dr Smith"`. Un valor de varias palabras sin comillas se lee como el nombre de una sola variable, que casi nunca es lo que quieres.

## Bloques de grupo para varios personajes

En un chat grupal con dos o más personajes, un bloque de grupo repite el mismo texto una vez por cada personaje. Esto te permite escribir un solo bloque que describa a todos los personajes de la escena.

Para hacer un bloque de grupo, pon un único `[` en su propia línea, luego tu texto, y después un único `]` en su propia línea. El bloque debe contener una macro de personaje, como `{{char}}` o `{{description}}`, o una condición basada en el personaje como `{{#if char == "Alice"}}`. Entonces Marinara repite el bloque una vez por personaje y resuelve las macros de personaje contra cada uno por turno.

```
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

En un chat grupal con Alice y Bob, el bloque se ejecuta dos veces. La primera pasada rellena el nombre de Alice y elige su rama. La segunda pasada rellena el nombre de Bob y elige la suya. Fuera de un bloque de grupo, una macro de personaje se resuelve solo contra el personaje actual o principal.

Los bloques de grupo solo se expanden en un chat con dos o más personajes. En un chat individual, las líneas `[` y `]` se quedan como texto plano.

## Ejemplos resueltos (antes y después)

Aquí tienes tres ejemplos completos con el resultado que recibe el modelo.

Tono específico de un personaje dentro de un preset compartido:

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

Para un personaje llamado `Dottore`, el modelo recibe `Speak in a cold, clinical tone.` Para todos los demás personajes, recibe `Speak warmly and casually.`

Incluir un campo solo cuando está rellenado:

```
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

Si el personaje tiene una **Backstory** (Historia de fondo), el modelo recibe esa línea con el texto de la historia de fondo. Si el campo **Backstory** está vacío, todo el bloque se resuelve en nada, así que no se envía ninguna etiqueta vacía.

Coincidir con parte del nombre de usuario:

```
{{#if user contains "Dr"}}
Address the user as Doctor.
{{/if}}
```

Si el nombre de tu persona contiene `Dr`, se le indica al modelo que te trate como Doctor. Si no, el bloque se resuelve en nada.

<a id="asking-the-decision-model"></a>

## Consultar al Decision model

Una condición también puede preguntar a tu **Decision model** (modelo de decisión) qué ocurre en el chat. Es el que elegiste en **Decision model** del panel Connections: el modelo local que ya ejecutas, una conexión Decision alojada o un modelo de decisión instalado. Lee los últimos mensajes y una declaración que escribes, y dice si es verdadera. Nunca escribe nada en el chat. [Modelos de decisión](../connections/decision-models.md) explica qué es y cómo elegir uno.

Así un preset, tarjeta, entrada de lorebook o prompt de agente puede enviar una instrucción solo en los turnos pertinentes, en lugar de enviar "si ocurre X, haz Y" cada turno. Para decidir si se activa una entrada completa de lorebook en vez de recortar su texto, usa su campo [Decision](../lorebooks/entries.md#decision-activation). Algunas ideas:

- **Cambios de escena.** Describe un lugar nuevo o un salto temporal solo cuando la escena realmente cambia.
- **Tipos de escena.** Carga reglas de ritmo para combate, intimidad o tensión solo mientras ocurre ese tipo de escena.
- **Responder primero la pregunta.** `{{#if decision:"In the latest message, {{user}} asks a direct question"}}Answer it before anything else.{{/if}}`
- **Estados de ánimo en tarjetas.** Una tarjeta puede incluir comportamientos "cuando se altera" o "cuando se enoja" que solo aparecen si los mensajes recientes los muestran.
- **Controles de ritmo.** Un preset de desarrollo lento puede retener instrucciones de intensificación hasta que la relación avance de forma visible.
- **Escenas grupales.** En un bloque de grupo, `{{#if decision:"{{char}} is addressed in the latest message"}}` indica que solo la sección del personaje al que se habla responda directamente.

### Sí o no: `decision:`

```
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

La condición es verdadera cuando el Decision model considera verdadera la declaración. Funciona con todo lo demás de esta guía: `{{else}}`, `{{else if}}`, `&&`, `||`, paréntesis, anidación y bloques de grupo.

```
{{#if char == "Dottore" && decision:"In the latest message, {{user}} says something that contradicts what they said earlier"}}
Dottore notices the inconsistency and files it away.
{{/if}}
```

Las macros de la declaración se completan primero, así que `{{user}}` y `{{char}}` funcionan. En un bloque de grupo, una declaración que nombra `{{char}}` se pregunta una vez por personaje.

### Una entre varias respuestas: `decision_choice:`

`decision_choice:` pide al Decision model que elija una opción. Las opciones son los valores con los que la comparas en cualquier parte del prompt:

```
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

Aquí el modelo elige entre "angry", "sad" y "none of these". También funciona la forma corta: `decision_choice:"The weather in the latest message" == "rain" || "snow"` ofrece ambas opciones. Escribe la declaración como un tema, por ejemplo "Kaelen's mood in the latest message", y las opciones como respuestas cortas.

<a id="sticky-and-cooldown"></a>

### Sticky y cooldown

Una declaración puede conservar su respuesta varios turnos en vez de preguntarse cada turno. Escribe `sticky:` y `cooldown:` después de la declaración:

```
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- **sticky:N.** Tras un sí, la declaración sigue siendo sí durante los N turnos siguientes sin preguntarse, de modo que el contenido que controla permanece en el prompt.
- **cooldown:N.** Comienza al terminar sticky, o justo después del sí si no hay sticky. Durante N turnos la declaración se interpreta como no y no se pregunta. Después vuelve a preguntarse.
- Un turno es cada mensaje nuevo que lee el Decision model. Una regeneración o swipe del mismo mensaje es el mismo turno, así que regenerar una respuesta nunca agota un temporizador.
- Mientras sticky o cooldown retienen una declaración, no se pregunta ni cuenta para **Decision statements per turn** (declaraciones de decisión por turno), dejando su lugar a otra.
- Para `decision_choice:`, sticky conserva la opción elegida y cooldown hace que toda comparación sea no. Elegir ninguna opción no inicia nada.
- Una declaración escrita en varios lugares usa los mayores valores de sticky y cooldown indicados en cualquiera de ellos.
- Peek Prompt muestra la respuesta retenida y nunca avanza un temporizador.

Juntos sirven para algo que debe aparecer una vez y descansar después: una transición de escena, un recordatorio puntual o un estado de ánimo que dure unos turnos. Para una entrada de lorebook activada por su campo **Decision**, usa sus propios **Sticky** y **Cooldown**: una entrada sticky permanece sin volver a preguntar su declaración, y una entrada en cooldown no se evalúa.

<a id="checking-every-few-turns"></a>

### Comprobar cada varios turnos

Algunas declaraciones no necesitan preguntarse cada turno. Escribe `every:` después para preguntarlas solo cada N turnos:

```
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- Se pregunta el primer turno en que se alcanza, luego otra vez 3 turnos después y así sucesivamente.
- Cambiar el número surte efecto inmediato: la próxima comprobación cuenta desde el turno de la última pregunta.
- Entre comprobaciones se interpreta como no, no se pregunta ni cuenta para **Decision statements per turn**.
- Los turnos se cuentan como para sticky y cooldown, así que una regeneración o swipe no avanza la programación. La reutilización de respuestas sigue las [reglas de la caché de respuestas](#answer-reuse).
- Sticky y cooldown siguen reteniendo la respuesta; `every:` solo decide cuándo preguntar una declaración que no retienen.
- Una declaración escrita en varios lugares usa el menor `every:` indicado en cualquiera de ellos.

<a id="priority"></a>

### Prioridad

Cuando un plan de prompt tiene más declaraciones que su presupuesto de **Decision statements per turn**, `priority:` decide cuáles se preguntan. El presupuesto se aplica en [varias etapas](#statement-allowance):

```
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- Las declaraciones `priority:high` se preguntan primero y las `priority:low` al final. Sin prioridad, una declaración tiene prioridad media.
- Dentro de una misma prioridad, sigue decidiendo el orden de aparición en el prompt.
- Al superar el límite, se descartan primero las de menor prioridad: se interpretan como no y Peek Prompt las enumera.
- Una declaración escrita en varios lugares usa la mayor prioridad indicada en cualquiera de ellos.
- Las declaraciones del propio prompt (preset, tarjetas, persona y notas de autor) se planifican primero. Las del texto de entradas de lorebook se planifican cuando el análisis conoce qué entradas se activan, con los lugares restantes; una declaración de lorebook nunca quita un lugar a las del prompt, sea cual sea su prioridad.

Todos los modificadores pueden combinarse en cualquier orden: `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### Sin respuesta significa no

Una condición de decisión es **falsa** siempre que no hay respuesta: no hay Decision model configurado, no respondió a tiempo o falló. Para `decision_choice:`, todas las comparaciones son falsas. Por tanto, un usuario sin Decision model recibe la rama `{{else}}` o nada.

Diseña teniendo esto en cuenta:

- Usa una decisión para **añadir o recortar orientación**, nunca para contenido del que dependa la historia. Una rama omitida debería hacer una respuesta un poco menos adaptada, no romperla.
- Da a cada bloque una opción predeterminada sensata: nada o un `{{else}}` adecuado para cualquier turno.
- No encadenes decisiones de forma que una respuesta equivocada cambie varias otras.
- No supedites el consentimiento, las advertencias de contenido ni las instrucciones de seguridad a una decisión. Deben estar siempre presentes.

Cualquier modelo puede equivocarse. Escribe para "un modelo de decisión", nunca "requiere Jev": un modelo de chat local también puede responder estas declaraciones. Comparten sintaxis, pero las respuestas y la precisión pueden variar.

<a id="writing-statements"></a>

### Redactar declaraciones

Estos consejos provienen de pruebas con un modelo de chat local y Open-Jev 2B y 9B:

- **Afirma un hecho verdadero o falso**, como una línea de un informe. No una pregunta ("Did the scene change?") ni una instrucción ("If the scene changed, describe it"). Un modelo de chat local respondió no a una instrucción todas las veces, así que el bloque nunca se ejecutó.
- **Di "in the latest message"** cuando te refieras a este turno. El modelo lee varios mensajes y respondió sí a "Mira asks questions" porque un mensaje anterior hacía una pregunta.
- **Nombra de quién se trata.** "He is angry" se interpretó como el personaje equivocado.
- **Describe algo visible en el texto**, una acción o algo dicho, no una palabra de estado de ánimo que el modelo deba interpretar ("The scene is intense") ni una intención oculta ("Mira is lying").
- Sé breve. Un simple "and" o una negación funcionaron bien en las pruebas; escribe lo que suene natural.

Para probar la redacción:

1. Selecciona un modelo en **Decision model** y haz clic en **Test** (probar). Comprueba la conexión con una muestra fija; no prueba tu declaración ni lee tu chat actual.
2. Añade la declaración al prompt y envía mensajes representativos: algunos en los que deba ser verdadera y otros en los que deba ser falsa.
3. Usa **Peek Prompt** para inspeccionar la rama enviada. Si necesitas la probabilidad y el resultado de sí/no, activa el [registro de depuración](../CONFIGURATION.md#logging-levels).
4. Ajusta la redacción y prueba de nuevo. Usa mensajes nuevos o cambia la declaración al probar un caso nuevo: las respuestas correctas pueden [reutilizarse](#answer-reuse). Abrir una vista previa nueva de Peek Prompt no pregunta al modelo.

Qué mostraron las pruebas. Cada redacción se probó en cuatro turnos etiquetados de Roleplay (dos previstos como sí y dos como no) con Open-Jev 2B, Open-Jev 9B y un modelo local Gemma 4 E4B. Es una muestra pequeña de una sola escena, no una prueba general de precisión ni de Jev alojado. La tabla registra observaciones de esa muestra; no promete el mismo resultado con otro modelo o chat.

| Escribe | Evita | Qué ocurrió con la redacción a evitar |
| --- | --- | --- |
| The latest message moves the scene to a new place. | Did the scene change? | La pregunta hizo que los turnos "no" de Open-Jev 2B superaran su umbral. El modelo local no se vio afectado. |
| In the latest message, a character draws a weapon or attacks someone. | The scene is intense. | Los tres llamaron "intenso" a un debate acalorado. Con una palabra vaga, el modelo decide qué significa, no tú. |
| In the latest message, Mira asks Kaelen a direct question. | Mira asks questions. | El modelo local y Open-Jev 9B dijeron sí cuando el último mensaje de Mira no preguntaba nada, porque uno anterior sí lo hacía. |
| Kaelen is angry in the latest message. | He is angry. | El modelo local interpretó "he" como el cantinero enojado. |
| In the latest message, Mira says something that contradicts what she said earlier. | Mira is lying. | Ningún modelo calificó una contradicción como mentira de forma fiable. |
| The latest message moves the scene to a new place. | If the scene changed, describe the new location in two sentences. | El modelo local respondió no a la instrucción todas las veces, así que el bloque nunca se ejecutó. |
| Someone is injured in the latest message. | A fight starts and someone is injured and the city guards arrive. | Se manejó correctamente. Separarlo sigue siendo más fácil de reutilizar y depurar. |
| In the latest message, the characters stay in the same place. | The characters did not leave the room. | No hubo diferencia. Escribe lo que suene natural. |

Las redacciones recomendadas lograron 31 de 32 en Open-Jev 2B, 31 de 32 en Open-Jev 9B y 32 de 32 en el modelo local. Las redacciones a evitar lograron 26, 25 y 24. Estos resultados de muestra pequeña ilustran decisiones de redacción; usa tus propios casos para juzgar qué modelo conviene a tus chats.

<a id="limits-and-cost"></a>

### Límites y costo

<a id="statement-allowance"></a>

#### Presupuesto de declaraciones

**Decision statements per turn**, en **Decision model**, tiene un valor predeterminado de 32. Pese a su nombre, no es un límite global de todas las solicitudes Decision ni del gasto. Marinara lo aplica por etapas:

1. Las declaraciones del prompt principal del chat se planifican dentro del presupuesto. Las decisiones de lorebook usan después lo que deja disponible ese plan.
2. Para agentes que se ejecutan antes o durante la respuesta, Marinara combina las declaraciones del prompt principal con las de sus prompts, usando otra vez el presupuesto configurado. Esta etapa no descuenta el uso previo del lorebook, así que el total puede superar el ajuste.
3. Los agentes de posprocesamiento reciben un presupuesto separado después de la respuesta. Sus declaraciones leen la respuesta terminada.

Las **preguntas de activación** de agentes y **Smart response order** (orden de respuesta Smart) son independientes de este ajuste.

Solo entran en el plan las declaraciones que la etapa actual puede usar: secciones y grupos de preset activados, opciones de variables seleccionadas y contenido de entradas de lorebook activadas. Una condición fija puede descartar una declaración: `{{#if char == "Dottore" && decision:"..."}}` no se pregunta si el personaje es Mira. Las variables pueden cambiar durante la construcción del prompt, así que una condición de variable no descarta una declaración anticipadamente.

Una declaración retenida por [sticky, cooldown](#sticky-and-cooldown) o [`every:`](#checking-every-few-turns) no ocupa ningún lugar. La [prioridad](#priority) elige cuáles caben en un plan. La activación de lorebooks usa su presupuesto restante a medida que se consideran las entradas. Las declaraciones omitidas se interpretan como no y Peek Prompt las enumera.

#### Solicitudes y tiempo

Un turno puede hacer varias solicitudes facturadas en una conexión Decision alojada. Las declaraciones pueden agruparse, pero la activación de lorebooks, el contenido de entradas recién activadas, las coincidencias recursivas y las fases de agentes pueden requerir más lotes. Las preguntas de activación se agrupan por Scan Depth y fase; Smart hace su propia solicitud. El presupuesto de declaraciones no limita el número de solicitudes ni el dinero.

Un modelo de chat local añade tiempo de procesamiento en lugar de cargos alojados. Responde a `decision_choice:` con una pregunta de sí/no por opción, así que una sola elección puede requerir varias generaciones.

Cada solicitud tiene un [límite de tiempo](../connections/decision-models.md#time-limits): 1,5 segundos de forma predeterminada para una conexión Decision o el presupuesto del backend local. Varias solicitudes pueden sumar una espera mayor. Un modelo local que debe razonar primero se abstiene antes de la respuesta salvo que actives **Also gate agents that run before the reply** (evaluar también agentes que se ejecutan antes de la respuesta).

<a id="answer-reuse"></a>

#### Reutilización de respuestas

Las respuestas correctas normalmente se reutilizan para el mismo turno y Decision model, así que regenerar suele enviar las mismas ramas sin otra solicitud. Esta caché reside en el servidor en ejecución y conserva hasta 200 claves de turno. Reiniciar o descartar la caché puede provocar otra solicitud. Un mensaje más reciente nuevo o editado, otro modelo, una declaración modificada o un conjunto de opciones cambiado también pueden necesitar otra respuesta.

Las respuestas ausentes o fallidas no se guardan como respuestas "no" obtenidas correctamente: reintentar el mismo turno puede preguntar de nuevo y tomar otra rama. Los temporizadores sticky/cooldown son independientes de esta caché.

Las declaraciones de prompts de agentes siguen las mismas reglas. Los agentes anteriores/paralelos leen el turno anterior a la respuesta; los de posprocesamiento leen la respuesta terminada, por lo que cambiar un swipe puede requerir respuestas nuevas. Volver a ejecutar manualmente un agente reutiliza las respuestas correctas que sigan en caché para sus entradas. Consulta [Declaraciones de decisión en el prompt del agente](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

<a id="prompt-caching"></a>

#### Caché de prompts

La **caché de prompts** del proveedor es independiente de la caché de respuestas Decision de Marinara. Puede reutilizar un prefijo sin cambios del prompt enviado a tu modelo de chat. Cambiar una rama de decisión puede impedir la reutilización desde ese punto; un prefijo anterior sin cambios aún puede ser válido. La parte exacta reutilizable y la facturación dependen del proveedor, los límites de caché, la longitud mínima y la duración de la caché.

**Coloca los bloques de decisión cambiantes al final del prompt**, como en instrucciones posteriores al historial o una nota de autor poco profunda. Un cambio temprano puede perder la mayor parte del ahorro de caché. Mantén una decisión cerca del inicio solo si su respuesta cambia poco y sus instrucciones deben ir allí. Lo mismo se aplica a las opciones de variables de preset: su texto aparece donde está `{{name}}`.

En una conexión directa Anthropic con **Enable prompt caching** (activar caché de prompts), Marinara marca el final del prompt de sistema y un mensaje situado **Cache depth** (profundidad de caché) mensajes antes del más reciente (5 de forma predeterminada). Un cambio antes del historial puede invalidar el límite del sistema y el historial posterior, aunque un prefijo anterior coincidente puede seguir siendo reutilizable. Un cambio después del límite marcado del historial puede conservar ese prefijo en caché. Un cambio entre ambos límites puede conservar el prefijo de sistema y perder parte del historial en caché. Leer y escribir caché tienen precios distintos.

Las longitudes mínimas de caché y los límites admitidos varían por modelo y pueden cambiar. Consulta la [guía de caché de prompts de Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) o la [guía de caché de prompts de OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching) vigentes para esos detalles y las reglas de facturación.

<a id="when-a-decision-branch-never-appears"></a>

### Cuando una rama de decisión nunca aparece

Si un usuario informa que nunca aparece una rama de decisión, las causas probables, en orden, son:

1. **No hay Decision model configurado.** Toda condición de decisión es falsa cada turno. El editor advierte debajo de cualquier campo que use una.
2. **El Decision model no responde.** Una conexión alojada con clave incorrecta, sin créditos o limitada; un modelo local detenido o demasiado lento para el presupuesto; o un modelo de decisión instalado que no arrancó.
3. **Es un modelo de razonamiento** que se abstiene antes de la respuesta.
4. **Hay demasiadas declaraciones en la etapa de planificación pertinente**, superando su presupuesto.
5. **Responde, pero por debajo del umbral.** Suele deberse a la redacción o a que el modelo puntúa ese turno más bajo de lo esperado.

Pregunta al usuario qué Decision model seleccionó y qué informa **Test**. **Peek Prompt** muestra las ramas realmente enviadas. Si debe construir una vista previa nueva, enumera las declaraciones que aún no tienen respuesta y allí se interpretan como no. Con el nivel de registro debug, se registran cada declaración, su respuesta y si se interpretó como sí; consulta [Niveles de registro](../CONFIGURATION.md#logging-levels).

La solución rara vez está en el preset. Cuando está allí, suele ser la redacción o una rama que contiene algo indispensable para el prompt.

## Guías relacionadas

- [Modelos de decisión](../connections/decision-models.md)
- [Macros de prompt](macros.md)
- [Variables de preset](preset-variables.md)
- [Chats grupales y conversaciones grupales](../chats/group-chats.md)
