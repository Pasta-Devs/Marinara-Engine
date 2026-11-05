# Prompts condicionales ({{#if}})

Un bloque `{{#if}}` incluye cierto texto del prompt (las instrucciones enviadas a la IA) solo cuando una condición es verdadera. Úsalo para dar a un mismo preset (ajuste guardado) compartido instrucciones distintas para diferentes personajes, personas o chats, o para omitir un campo que está vacío. Los condicionales forman parte del sistema de macros, así que funcionan en todos los lugares donde funcionan las [macros](macros.md): tarjetas de personaje, personas, entradas de lorebook (libro de trasfondo) y presets.

Marinara comprueba la condición cada vez que arma un prompt, conserva el texto que corresponde y descarta el resto. Es una función avanzada, y la mayoría de los chats nunca la necesitan.

## La sintaxis básica

Un bloque empieza con `{{#if condition}}` y termina con `{{/if}}`. Añade `{{else}}` para el caso falso, y `{{else if}}` para encadenar más condiciones. Marinara comprueba cada rama de arriba hacia abajo y conserva la primera que sea verdadera. Si ninguna es verdadera y no hay `{{else}}`, el bloque se resuelve en nada.

```text
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

Un bloque puede ir en una sola línea o en varias, y puedes anidar bloques.

## Operadores

Una condición suele ser un valor a la izquierda, un operador y un valor a la derecha, como `char == "Alice"`.

| Operador | Significado |
| --- | --- |
| `==`, `=`, `is` | Igual. |
| `!=`, `is not` | Distinto. |
| `>`, `<`, `>=`, `<=` | Mayor que, menor que, mayor o igual que, menor o igual que (solo números). |
| `contains`, `includes` | El valor de la izquierda contiene al de la derecha como texto. |
| `not contains`, `not includes` | El valor de la izquierda no contiene al de la derecha. |

Reglas de comparación:

1. Para los operadores de igualdad, si ambos lados parecen números, Marinara los compara como números, así que `5` es igual a `5.0`. Si no, compara texto e ignora mayúsculas y minúsculas, así que `Mari` es igual a `mari`.
2. Para `>`, `<`, `>=` y `<=`, ambos lados deben ser números. Si no, la condición es falsa.
3. `contains` e `includes` ignoran mayúsculas y minúsculas, así que `contains "dr"` coincide con `Dr Smith`.

### Combinar condiciones

Usa `||` para OR y `&&` para AND. `&&` se evalúa antes que `||`. Usa paréntesis para fijar el orden.

```text
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared instructions.
{{/if}}

{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

Para varias opciones de igualdad sobre un mismo valor, puedes omitir el lado izquierdo repetido: `character == "Maukie" || "Pantalone"`. Esto funciona con `==`, `=` e `is`. Escribe condiciones completas a ambos lados de `&&`.

### Comprobaciones de veracidad

Una condición sin operador es verdadera cuando el valor tiene contenido real. Es falsa cuando el valor está vacío o es uno de `false`, `0`, `no`, `off`, `null` o `undefined`, escrito con cualquier combinación de mayúsculas y minúsculas.

```text
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

### Qué puedes comparar

Cualquiera de los dos lados de una condición puede ser:

1. Una palabra clave de campo o identidad, como `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input`, `model` o `reasoning`. Estas leen los mismos valores que las macros correspondientes. `group` lista los demás personajes activos, sin el que responde en ese momento.
2. Un literal entre comillas, como `"Alice"`.
3. El nombre de una variable de preset, como `length`. Consulta [Variables de preset](preset-variables.md).
4. Una búsqueda explícita de variable, escrita como `var:name` o `var.name`.
5. Otra macro, que se resuelve primero.
6. Una pregunta para tu Decision model (modelo de decisión): `decision:"..."` o `decision_choice:"..."`. Consulta [Consultar al Decision model](#asking-the-decision-model).

Una palabra suelta que no es una palabra clave se trata como el nombre de una variable. Si no existe ninguna variable con ese nombre, se usa como texto plano. Pon los valores literales entre comillas para evitar confusiones.

### Comillas

Pon el texto fijo entre comillas dobles rectas o comillas simples rectas. Dentro de un valor entre comillas, escapa una comilla con una barra invertida y escribe `\n` para un salto de línea. Pon siempre entre comillas un literal que tenga un espacio, como `"Dr Smith"`. Un valor de varias palabras sin comillas se lee como el nombre de una sola variable.

## Bloques de grupo para varios personajes

En un chat grupal con dos o más personajes, un bloque de grupo repite su texto una vez por cada personaje. Pon `[` solo en una línea, luego tu texto, y después `]` solo en una línea. El bloque debe contener una macro de personaje, como `{{char}}` o `{{description}}`, o una condición basada en el personaje.

```text
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

Con Alice y Bob, el bloque se ejecuta dos veces, una por personaje. Fuera de un bloque de grupo, una macro de personaje se resuelve solo contra el personaje actual o principal. En un chat con un solo personaje, las líneas `[` y `]` se quedan como texto plano.

## Ejemplos

Un tono distinto para cada personaje:

```text
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

Incluir un campo solo cuando está rellenado. Si **Backstory** (Historia de fondo) está vacío, el bloque se resuelve en nada, así que no se envía ninguna etiqueta vacía.

```text
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

Instrucciones para una familia de modelos. `model` es el ID del modelo, como `claude-opus-5-5`, así que `contains` coincide con todas las versiones de Opus y `==` coincide con un modelo exacto.

```text
{{#if model contains "opus"}}
Keep replies under 400 words.
{{/if}}
```

Instrucciones de planificación que dependen de si el modelo piensa. Con el razonamiento activado en cualquier nivel, el modelo recibe la primera línea. Con el razonamiento desactivado, `{{reasoning}}` vale `off`, que se lee como falso. Para actuar según un nivel concreto, compáralo, como en `{{#if reasoning == "max"}}`.

```text
{{#if reasoning}}
Plan the reply in your thinking before you write it.
{{else}}
Before replying, write your plan inside <plan></plan> tags.
{{/if}}
```

<a id="asking-the-decision-model"></a>

## Consultar al Decision model

Una condición puede preguntar a tu Decision model qué ocurre en el chat. El Decision model es un modelo pequeño que lee los últimos mensajes y una declaración que escribes, y dice si la declaración es verdadera. Nunca escribe nada en el chat. Así un preset, una tarjeta, una entrada de lorebook o un prompt de agente puede enviar una instrucción solo en los turnos en que corresponde.

Antes de empezar: elige un Decision model en **Decision model** (modelo de decisión) del panel **Connections** (Conexiones). Consulta [Modelos de decisión](../connections/decision-models.md) para saber qué es y cómo elegir uno. Para decidir si se activa una entrada de lorebook completa, usa en su lugar el campo [Decision](../lorebooks/entries.md#decision-activation) de la entrada.

Algunas ideas: describir un lugar nuevo solo cuando la escena cambió de sitio, cargar reglas de ritmo de combate solo durante una pelea, retener la intensificación en un preset de desarrollo lento o hacer que, en un bloque de grupo, solo el personaje al que se habla responda directamente.

### Sí o no: `decision:`

```text
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

La condición es verdadera cuando el Decision model dice que la declaración es verdadera. Funciona con `{{else}}`, `&&`, `||`, paréntesis, anidación y bloques de grupo. Las macros de la declaración se completan primero, así que `{{user}}` y `{{char}}` funcionan. En un bloque de grupo, una declaración que nombra `{{char}}` se pregunta una vez por personaje.

### Una entre varias respuestas: `decision_choice:`

`decision_choice:` pide al modelo que elija una opción. Las opciones son los valores con los que la comparas.

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

El modelo elige entre "angry", "sad" y "none of these". Escribe la declaración como un tema y las opciones como respuestas cortas. La forma corta `== "rain" || "snow"` ofrece ambas opciones.

Para decir qué significa una opción en tu historia, añade criterios después de ella, separados por dos puntos, con el mismo tipo de comillas en las dos partes: `== "angry":"Kaelen raises his voice, makes threats or breaks something"`. El modelo sigue respondiendo "angry". Si una opción tiene criterios distintos en varios lugares, se usan los primeros.

<a id="sticky-and-cooldown"></a>

### Sticky y cooldown

Añade `sticky:` y `cooldown:` después de una declaración para conservar su respuesta unos turnos en vez de preguntarla cada turno.

```text
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- `sticky:N`: tras un sí, la declaración sigue siendo sí durante N turnos sin preguntarse.
- `cooldown:N`: comienza al terminar sticky, o justo después del sí. Durante N turnos la declaración se interpreta como no y no se pregunta.
- Un turno es cada mensaje nuevo que lee el Decision model. Una regeneración o un swipe (respuesta alternativa) del mismo mensaje es el mismo turno, así que regenerar nunca agota un temporizador.
- Una declaración retenida no se pregunta ni cuenta para **Decision statements per turn** (declaraciones de decisión por turno).
- Para `decision_choice:`, sticky conserva la opción elegida y cooldown hace que toda comparación se interprete como no.
- Una declaración escrita en varios lugares usa los valores de sticky y cooldown más largos.
- Peek Prompt muestra la respuesta retenida y nunca avanza un temporizador.

Para una entrada de lorebook activada por su campo **Decision**, usa en su lugar los propios **Sticky** y **Cooldown** de la entrada.

<a id="until-and-while"></a>

### Until y while

Para mantener un bloque activo mientras dure algo, añade `until:` o `while:` con una segunda declaración.

```text
{{#if decision:"A fight starts in the latest message" until:"The fight ends in the latest message"}}
Keep combat pacing rules in effect.
{{/if}}
```

- Tras un sí, el bloque sigue activo. La primera declaración no se pregunta. En su lugar, cada turno se pregunta la declaración `until`, y el bloque se desactiva en el turno en que es verdadera.
- `while:` funciona al revés: el bloque sigue activo mientras su declaración sea verdadera, y se desactiva cuando es falsa.
- Usa uno u otro. Si se escriben ambos, solo cuenta el primero.
- Cuando el bloque se desactiva, cooldown comienza como de costumbre. Si no hay respuesta en un turno, el bloque sigue activo.
- La declaración `until` o `while` cuenta para **Decision statements per turn**. La primera declaración no cuenta mientras el bloque está activo.
- Funciona con `decision:`, no con `decision_choice:`.

Con **sticky**, añade `:and` (también `:restrict`) o `:or` (también `:extend`) después de la segunda declaración para elegir cómo se combinan las dos.

| Si escribes | Tras el sí, el bloque sigue activo |
| --- | --- |
| `until:"..." sticky:5` o `until:"...":and sticky:5` | Hasta 5 turnos más, y se desactiva antes si la declaración until es verdadera. |
| `until:"...":or sticky:5` | Al menos 5 turnos más, y después hasta que la declaración until sea verdadera. |
| `while:"..." sticky:5` o `while:"...":or sticky:5` | Al menos 5 turnos más, y después mientras la declaración while sea verdadera. |
| `while:"...":and sticky:5` | Hasta 5 turnos más, y se desactiva antes si la declaración while es falsa. |

<a id="checking-every-few-turns"></a>

### Comprobar cada varios turnos

Añade `every:N` para preguntar una declaración solo cada N turnos.

```text
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- Se pregunta el primer turno en que se alcanza, luego otra vez 3 turnos después, y así sucesivamente. Entre comprobaciones se interpreta como no, no se pregunta y no cuenta para **Decision statements per turn**.
- Una regeneración o un swipe no avanza la programación.
- Sticky y cooldown siguen reteniendo una respuesta. `every:` solo decide cuándo se pregunta una declaración que no está retenida.
- Una declaración escrita en varios lugares usa el `every:` más pequeño.

<a id="priority"></a>

### Prioridad

Cuando un plan de prompt tiene más declaraciones que el presupuesto de **Decision statements per turn**, `priority:high` o `priority:low` decide cuáles se preguntan. Sin prioridad, es media.

```text
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- Las declaraciones de prioridad alta se preguntan primero y las de prioridad baja al final. Dentro de una misma prioridad, decide el orden en el prompt.
- Las declaraciones que superan el límite se interpretan como no, empezando por las de menor prioridad, y Peek Prompt las enumera.
- Una declaración escrita en varios lugares usa la prioridad más alta.
- Las declaraciones del propio prompt (preset, tarjetas, persona, notas de autor) se planifican primero. Las declaraciones de lorebook usan los lugares que quedan, sea cual sea su prioridad.

Puedes combinar todos los modificadores en cualquier orden: `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### Sin respuesta significa no

Una condición de decisión es falsa siempre que no hay respuesta: no hay Decision model configurado, no respondió a tiempo o falló. Para `decision_choice:`, todas las comparaciones son falsas. Diseña teniendo esto en cuenta.

- Usa una decisión para añadir o recortar orientación, nunca para llevar contenido del que dependa la historia.
- Da a cada bloque de decisión una opción predeterminada: nada o un `{{else}}` que sirva en cualquier turno.
- No encadenes decisiones de forma que una respuesta equivocada cambie varias otras.
- No supedites el consentimiento, las advertencias de contenido ni las instrucciones de seguridad a una decisión.

Cualquier modelo puede equivocarse. Escribe para "un modelo de decisión", no para un producto concreto.

<a id="writing-statements"></a>

### Redactar declaraciones

- Afirma un hecho verdadero o falso, como una línea de un informe. No una pregunta ("Did the scene change?") ni una instrucción ("If the scene changed, describe it"). Los modelos pequeños suelen responder no a una instrucción, así que el bloque nunca se ejecuta.
- Di "in the latest message" cuando te refieras a este turno. El modelo lee varios mensajes, y uno anterior puede hacer que responda sí.
- Nombra de quién se trata. "He is angry" puede interpretarse como el personaje equivocado.
- Describe algo visible en el texto, como una acción o una frase dicha. Evita las palabras de estado de ánimo ("The scene is intense") y las intenciones ocultas ("Mira is lying").
- Sé breve. Divide una declaración larga en partes si quieres reutilizarlas o depurarlas.

Para probar la redacción:

1. Selecciona un modelo en **Decision model** y haz clic en **Test** (probar). Esto comprueba la conexión con una muestra fija. No prueba tu declaración.
2. Añade la declaración al prompt y envía mensajes en los que deba ser verdadera y mensajes en los que deba ser falsa.
3. Usa **Peek Prompt** para ver qué rama se envió. Abre **Decision diagnostics** (diagnóstico de decisiones) y luego elige **Test decisions** (probar decisiones) para obtener respuestas nuevas sin generar una respuesta de chat. Las pruebas alojadas pueden costar dinero. Consulta [Probar declaraciones de decisión](../chats/peek-prompt.md#testing-decision-statements).
4. Ajusta la redacción y vuelve a probar. Para ver las respuestas de las generaciones en curso, activa Debug Mode o el [registro de depuración](../CONFIGURATION.md#logging-levels).

<a id="limits-and-cost"></a>

### Límites y costo

<a id="statement-allowance"></a>

#### Presupuesto de declaraciones

**Decision statements per turn**, en **Decision model**, tiene un valor predeterminado de 32. No es un límite único para todas las solicitudes Decision ni para el gasto. Marinara lo aplica por etapas.

1. Las declaraciones del prompt principal del chat se planifican dentro del presupuesto. Las decisiones de lorebook usan lo que queda.
2. Los agentes que se ejecutan antes o durante la respuesta reciben un plan combinado con el prompt principal, que vuelve a usar el presupuesto. Esta etapa no descuenta el uso del lorebook, así que el total puede superar el ajuste.
3. Los agentes de posprocesamiento reciben un presupuesto separado después de la respuesta.

Las preguntas de activación de agentes y Smart response order (orden de respuesta Smart) son independientes de este ajuste.

Solo entran en el plan de una etapa las declaraciones que esa etapa puede usar: secciones y grupos de preset activados, opciones de variables seleccionadas y contenido de entradas de lorebook activadas. Una condición fija puede descartar una declaración, como `{{#if char == "Dottore" && decision:"..."}}` mientras el personaje es Mira. Una condición de variable no la descarta, porque las variables pueden cambiar mientras se construye el prompt. Las declaraciones retenidas por sticky, cooldown o `every:` no ocupan ningún lugar. Las declaraciones que quedan fuera se interpretan como no.

#### Solicitudes y tiempo

En una cuenta Decision alojada, un turno puede hacer varias solicitudes facturadas. Las declaraciones pueden agruparse, pero la activación de lorebooks, el contenido de entradas recién activadas, las coincidencias recursivas y las fases de agentes pueden necesitar más lotes. Un modelo de chat local añade tiempo de procesamiento en lugar de cargos, y responde a un `decision_choice:` con una pregunta de sí/no por opción.

Cada solicitud tiene un límite de tiempo: 1,5 segundos de forma predeterminada para una cuenta Decision alojada, o 4 segundos para una cuenta de modelo de chat compatible con OpenAI o un modelo local. Consulta [Límites de tiempo](../connections/decision-models.md#time-limits). Un modelo local de razonamiento se abstiene antes de la respuesta salvo que actives **Also gate agents that run before the reply** (evaluar también los agentes que se ejecutan antes de la respuesta).

<a id="answer-reuse"></a>

#### Reutilización de respuestas

Marinara normalmente reutiliza las respuestas correctas para el mismo turno y Decision model, así que una regeneración suele enviar las mismas ramas sin una solicitud nueva. La caché reside en el servidor en ejecución y conserva hasta 200 turnos. Un reinicio, un descarte, un último mensaje nuevo o editado, otro modelo, o una declaración o un conjunto de opciones modificados pueden necesitar una respuesta nueva.

Las respuestas ausentes o fallidas no se guardan en caché, así que un reintento puede preguntar de nuevo y tomar otra rama. Las declaraciones de prompts de agentes siguen las mismas reglas. Volver a ejecutar manualmente un agente reutiliza las respuestas que sigan en caché para sus entradas. Consulta [Declaraciones de decisión en el prompt del agente](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

<a id="prompt-caching"></a>

#### Caché de prompts

La caché de prompts del proveedor es independiente de la caché de respuestas de Marinara. Puede reutilizar un inicio sin cambios del prompt enviado a tu modelo de chat. Cambiar una rama de decisión puede impedir la reutilización desde ese punto, aunque una parte anterior sin cambios aún puede ser válida. La facturación depende del proveedor.

Coloca al final del prompt los bloques de decisión que cambian a menudo, como en instrucciones posteriores al historial o una nota de autor poco profunda. Mantén una decisión cerca del inicio solo cuando su respuesta cambie poco. Las opciones de variables de preset funcionan igual, porque su texto va dondequiera que aparezca `{{name}}`.

En una cuenta directa de Anthropic con **Enable prompt caching** (activar caché de prompts) activado, Marinara marca el final del prompt de sistema y un mensaje del chat situado **Cache depth** (profundidad de caché) mensajes antes del más reciente (5 de forma predeterminada). Un cambio antes del historial puede invalidar el límite del sistema y el historial posterior. Un cambio después del límite marcado del historial puede conservar la parte en caché. Las longitudes mínimas de caché varían según el modelo. Consulta la [guía de caché de prompts de Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) o la [guía de caché de prompts de OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching) vigentes del proveedor.

<a id="when-a-decision-branch-never-appears"></a>

### Cuando una rama de decisión nunca aparece

Causas probables, en orden:

1. No hay Decision model configurado. Toda condición de decisión es falsa. El editor muestra una advertencia debajo de cualquier campo que use una.
2. El Decision model no responde: una clave incorrecta, sin créditos o un límite de solicitudes en una cuenta alojada, un modelo local detenido o demasiado lento, o un modelo de decisión instalado que no arrancó.
3. Es un modelo de razonamiento que se abstiene antes de la respuesta.
4. Hay demasiadas declaraciones en la etapa de planificación, por encima del presupuesto.
5. Responde, pero por debajo de su umbral. Suele deberse a la redacción.

Comprueba qué informa **Test** y usa **Peek Prompt** para ver las ramas que se enviaron. Enumera las declaraciones que aún no tienen respuesta, que se interpretan como no. Con el nivel de registro en debug, se registran cada declaración, su respuesta y si se interpretó como sí. Consulta [Niveles de registro](../CONFIGURATION.md#logging-levels). La solución rara vez está en el preset. Suele ser la redacción, o una rama que contiene algo indispensable para el prompt.

## Guías relacionadas

- [Modelos de decisión](../connections/decision-models.md)
- [Macros de prompt](macros.md)
- [Variables de preset](preset-variables.md)
- [Chats grupales y conversaciones grupales](../chats/group-chats.md)
