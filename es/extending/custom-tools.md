# Herramientas personalizadas y llamada a funciones

Esta guía explica las herramientas personalizadas, también llamadas Functions, en Marinara Engine. Una herramienta personalizada le enseña a la IA a ejecutar una pequeña acción durante un chat. Puede devolver un texto fijo, llamar a una dirección web externa o ejecutar un script corto en el servidor. Aprenderás a crear una, a activar el uso de herramientas en un chat y a mantener seguras las herramientas de tipo script.

## Qué es la llamada a funciones

La llamada a funciones permite que la IA le pida a la app ejecutar una acción y luego use el resultado en su respuesta. La app ya trae herramientas integradas, como las tiradas de dados, la búsqueda en el lorebook (libro de trasfondo) y las actualizaciones del estado del juego. Las herramientas personalizadas conviven con esas herramientas integradas en el mismo sistema de **Function Calling** (llamada a funciones).

Puede que quieras una herramienta personalizada para cosas como estas:

- Devolver un dato fijo, como tu horario de atención o un conjunto de reglas de la casa.
- Pedir datos en vivo a un servicio externo, como el clima o un dispositivo de hogar inteligente.
- Hacer un cálculo rápido, como sumar números o generar un resultado personalizado.

Una herramienta personalizada no se adjunta a una tarjeta de personaje. En cambio, la activas para un chat, o la adjuntas a un agente. Un agente es un ayudante que se ejecuta junto a tu chat. Más abajo se cubren ambos caminos.

Las llamadas nativas a funciones requieren una conexión compatible con herramientas. Los transportes de suscripción de Claude y Grok ignoran las definiciones nativas de herramientas, por lo que **Chat Settings** (ajustes del chat) muestra un aviso de disponibilidad y desactiva sus controles para esas conexiones. Sus comandos de texto y etiquetas de dados siguen disponibles. Los chats de Game pueden elegir una conexión de planificación de herramientas independiente; consulta [Planificación opcional de herramientas y búsquedas de trasfondo](../game/getting-started.md#optional-tool-planning-and-lore-searches) para conocer su coste y funcionamiento.

Las búsquedas en lorebooks usan una clasificación semántica cuando las entradas activadas tienen vectores compatibles. Conversation y Roleplay conservan la coincidencia por texto cuando la búsqueda semántica no está disponible. La búsqueda de trasfondo de Game se activa por separado e informa de vectores ausentes o incompatibles; nunca vectoriza un libro automáticamente.

## La sección Functions

Creas y gestionas las herramientas personalizadas en el panel **Presets**.

1. Abre la barra superior y haz clic en **Presets**.
2. Busca la sección **Functions** (su icono es una llave inglesa).
3. Debajo del encabezado verás la leyenda **Custom function calls available from Chat Settings**.

El encabezado de la sección tiene tres botones de icono:

- **Create function** (icono de signo más) abre un editor de herramientas en blanco.
- **Import functions from ZIP or JSON** (icono de descarga) abre un selector de archivos.
- **Export functions to ZIP** (icono de subida) guarda todas tus herramientas en un solo archivo. Está atenuado cuando no tienes herramientas.

Cada herramienta de la lista muestra su nombre y dos pequeñas etiquetas (el tipo y el número de parámetros). También muestra una descripción corta, un interruptor de activar/desactivar, un botón **Edit function** y un botón **Delete function**. Una herramienta de tipo **Script** muestra además una etiqueta ámbar **Script disabled** cuando las herramientas de tipo script están desactivadas en el servidor. La sección Tipo de ejecución: Script, más abajo, explica cómo activarlas. Puedes arrastrar una herramienta por su manija para reordenar la lista. El orden es solo para mostrar y no cambia el comportamiento. Cuando todavía no tienes herramientas, la lista muestra **No functions yet** (Aún no hay funciones).

La gestión de herramientas (crear, editar, eliminar, reordenar y el interruptor de activar/desactivar) usa una parte protegida de la app. Si gestionas herramientas desde otro dispositivo en lugar de la computadora que ejecuta el servidor, primero debes guardar un secreto de administrador. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md) y la nota bajo Seguridad de los scripts, más abajo.

## Crear una herramienta

Sigue estos pasos para crear una herramienta.

1. En la sección **Functions**, haz clic en **Create function**. Se abre el editor completo de herramientas.
2. En el campo de nombre de la parte superior, escribe un nombre en snake_case en minúsculas. Este es el nombre exacto que la IA usa para llamar a la herramienta. Un nombre válido empieza con una letra minúscula y luego usa solo letras minúsculas, números y guiones bajos. Ejemplo: `check_weather`.
3. Rellena el campo **Description** (Descripción). Escríbelo como una instrucción para la IA, porque la IA lo lee para decidir cuándo llamar a la herramienta. Ejemplo: `Get the current weather for a city the user names.`
4. Añade los **Parameters** (Parámetros) que la herramienta necesite (consulta la siguiente sección).
5. Elige un **Execution Type** (Tipo de ejecución): **Static Result**, **Webhook** o **Script**.
6. Rellena el campo del tipo que elegiste.
7. Haz clic en **Save**. Deberías ver un destello verde **Saved** cerca del botón.

Algunas reglas que conviene saber:

- El nombre debe tener de 1 a 100 caracteres. La descripción debe tener de 1 a 500 caracteres.
- Dos herramientas no pueden compartir un nombre. Tampoco puedes usar el nombre de una herramienta integrada (consulta Nombres reservados, más abajo).
- Si sales del editor con cambios sin guardar, un aviso ofrece **Keep editing** (Seguir editando), **Discard** (Descartar) o **Save & close** (Guardar y cerrar).

## El constructor de Parameters

Los parámetros son las entradas que la IA pasa cuando llama a tu herramienta. Cada parámetro tiene un nombre, un tipo, una marca de obligatorio y una descripción.

1. En el grupo **Parameters**, haz clic en **Add Parameter**.
2. Escribe un nombre de parámetro, como `city`.
3. Elige un tipo del menú desplegable: `string`, `number`, `boolean`, `array` u `object`.
4. Activa **Required** (Obligatorio) si la IA siempre debe enviar este valor.
5. Escribe una descripción que le diga a la IA qué significa el valor. Ejemplo: `The city name to look up, such as Tokyo.`

Puedes añadir más filas con **Add Parameter**, o quitar una fila con su botón de menos. Una fila que quede con el nombre vacío se descarta al guardar. Las buenas descripciones de parámetros importan, porque así es como la IA aprende qué enviar.

Si parece que nunca se llama a una herramienta, una configuración de parámetros defectuosa es una causa común. Esto ocurre sobre todo cuando importas una herramienta desde un archivo editado a mano con una configuración de parámetros no válida. En ese caso, la app omite la herramienta silenciosamente durante la generación y solo escribe una nota en el registro del servidor.

## Tipo de ejecución: Static Result

Una herramienta **Static Result** devuelve un texto fijo cada vez que la IA la llama. No necesita ningún servicio externo y funciona de inmediato para cualquiera. Su tarjeta dice **Returns a fixed string when called.**

El único campo es **Static Result**, un cuadro de varias líneas. Lo que sea que escribas se devuelve a la IA cuando llama a la herramienta. Si lo dejas vacío, la herramienta devuelve `OK`.

Ejemplo práctico. Crea una herramienta llamada `store_hours` con una lista de parámetros vacía. En el cuadro **Static Result**, escribe esto:

```
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

Ahora, cuando la IA llama a `store_hours`, recibe ese texto de vuelta y puede decirle al usuario tu horario. La IA ve tu texto junto con el nombre de la herramienta y cualquier argumento que haya enviado, no la línea sola por sí misma.

## Tipo de ejecución: Webhook

Una herramienta **Webhook** envía tu llamada a la herramienta a una dirección web externa y devuelve la respuesta de ese servicio a la IA. Un webhook es una dirección web que acepta datos y devuelve datos. Su tarjeta dice **Sends a POST request to an external URL.**

El único campo es **Webhook URL**. La app envía una solicitud POST a esa dirección. Una solicitud POST es una forma de enviar datos a un servicio web. El cuerpo de la solicitud es JSON, un formato de texto plano para datos estructurados, con esta forma:

```
{ "tool": "your_tool_name", "arguments": { ... } }
```

El servicio debería responder con JSON o texto plano. Esa respuesta se devuelve a la IA.

Ejemplo práctico. Crea una herramienta llamada `check_weather` con un parámetro de tipo string obligatorio llamado `city`. Ajusta el campo **Webhook URL** a la dirección de tu propio servicio:

```
https://api.example.com/weather
```

Cuando la IA llama a `check_weather` con `city` ajustado a Tokyo, tu servicio recibe la solicitud, consulta el clima y responde. La IA luego usa esa respuesta en su mensaje.

Cosas que conviene saber sobre los webhooks:

- La respuesta tiene un límite de 512 KB.
- Cada llamada tiene un tiempo límite fijado por el servidor. El valor predeterminado es 60 segundos.
- De forma predeterminada, solo se permiten direcciones `https://`. Las direcciones privadas y locales, como `localhost` o una dirección de red doméstica, están bloqueadas. Un administrador del servidor debe activar un ajuste para permitir direcciones locales. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).
- Si la llamada falla o se agota el tiempo de espera, la IA recibe un resultado de error en lugar de bloquear el chat.

## Tipo de ejecución: Script

Una herramienta **Script** ejecuta un fragmento corto de JavaScript en el servidor y devuelve el resultado. JavaScript es un lenguaje de programación común. Su tarjeta dice **Runs a JavaScript expression server-side.**

Las herramientas de tipo script están desactivadas de forma predeterminada por seguridad. Si tu servidor no las ha activado, la tarjeta **Script** aparece atenuada y sale una advertencia. Para activar los scripts, el administrador del servidor pone esta línea en el archivo `.env` del servidor y reinicia la app:

```
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

El único campo es **Script Body**. Tu script puede leer `args` (los valores que la IA envió) y debe hacer `return` de un resultado. También tienes acceso a `JSON`, `Math` y `Date`.

Ejemplo práctico. Crea una herramienta llamada `add_numbers` con dos parámetros de tipo number obligatorios llamados `x` e `y`. En el cuadro **Script Body**, escribe esto:

```
const result = args.x + args.y;
return { sum: result };
```

Cuando la IA llama a `add_numbers` con `x` ajustado a 2 e `y` ajustado a 3, la herramienta devuelve una suma de 5. Si tu script lanza un error, la IA recibe un resultado de error en lugar de un bloqueo. Lee la sección Seguridad de los scripts, más abajo, antes de activar los scripts.

## Incluir contexto oculto del chat

Tanto las herramientas **Webhook** como las **Script** pueden recibir un objeto de contexto oculto. Estos son datos adicionales del chat que la IA no ve como entradas de la herramienta. Activa el interruptor con la etiqueta **Include hidden chat context** en el editor de herramientas. El valor predeterminado es desactivado.

Cuando está activado, tu webhook o script recibe un valor `context` junto con los argumentos. Puede incluir el modo del chat, el nombre de la persona activa y los nombres de los personajes del chat. También puede incluir variables guardadas del chat y, en Game Mode, el estado del juego. Esto permite que tu herramienta personalice su resultado sin que la IA tenga que pasar todos esos datos por sí misma.

## Activar el uso de herramientas en un chat

Crear una herramienta no hace que la IA la use. También debes activar el uso de herramientas en el chat.

1. Abre un chat y haz clic en el engranaje para abrir **Chat Settings** (Ajustes del chat).
2. Abre la sección **Function Calling** (su icono es una llave inglesa).
3. Activa **Enable Tool Use**. Su descripción dice **Allow AI to call functions (dice rolls, game state, etc.)**. Está desactivado de forma predeterminada en un chat nuevo.

Con **Enable Tool Use** activado y sin herramientas añadidas debajo, el chat puede usar todas las herramientas activadas globalmente. Eso significa las herramientas integradas, como las tiradas de dados y la búsqueda en el lorebook, más cada herramienta personalizada que hayas activado en la sección **Functions**. Para limitar un chat a un conjunto elegido, añade herramientas específicas:

1. Haz clic en **Add Functions**. Se abre un selector con un cuadro de búsqueda.
2. Marca las herramientas que quieras. La lista mezcla herramientas integradas y tus propias herramientas personalizadas.
3. Haz clic en **Add Selected** para añadirlas.

Una vez que añades una o más herramientas, solo esas herramientas funcionan en ese chat. También puedes hacer clic en **New Custom Function** en el selector para ir directo al editor de herramientas. El cuadro de búsqueda del selector coincide solo con los nombres de las herramientas, no con las descripciones.

## Adjuntar herramientas a un agente

También puedes darle una herramienta a un agente en lugar de a un chat. Un agente es un ayudante semiautónomo, como un guardián del lorebook o un seleccionador de música, que se ejecuta durante la generación.

1. Abre el panel **Agents** y abre un agente.
2. Abre su grupo **Tools / Function Calling**.
3. Activa las herramientas que quieras que use ese agente.

Incluso con un agente configurado, sigues teniendo que activar **Enable Tool Use** en la sección **Function Calling** del chat. Una nota sobre la redacción. El texto del pie del editor del agente dice que actives "Enable Function Calling". El interruptor que realmente haces clic tiene la etiqueta **Enable Tool Use**. Se refieren al mismo control. Para un recorrido más a fondo de los agentes, consulta [Crear agentes personalizados](../agents/custom-agents.md).

## Seguridad de los scripts

Una herramienta **Script** ejecuta código real en tu servidor, así que trátala con cuidado. La app ejecuta cada script en un sandbox. Un sandbox es un área aislada que limita lo que el código puede hacer. Los límites son:

- Sin acceso a la red. Un script no puede llamar a internet ni a ninguna dirección web.
- Sin acceso a archivos. Un script no puede leer ni escribir archivos en el servidor.
- Sin acceso a las variables de entorno ni a los secretos del servidor.
- Un tiempo límite. Un script que tarda demasiado se detiene. El límite predeterminado es 60 segundos.

Esto protege contra accidentes y bloquea el acceso a la red y a los archivos. No es un aislamiento completo del sistema operativo. Alguien que pueda crear herramientas todavía podría escribir un script que desperdicie CPU o memoria del servidor. Activa las herramientas de tipo script solo en servidores en los que confíes. Ten cuidado al importar herramientas de tipo script escritas por otras personas.

La gestión de herramientas desde otro dispositivo también está protegida. Si no estás en la computadora que ejecuta el servidor, guarda un secreto de administrador en **Settings** (Configuración), luego **Advanced**, luego **Admin Access**. Este secreto debe coincidir con el ajuste del servidor. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md) para el lado del servidor.

## Exportar e importar

Puedes mover herramientas entre instalaciones.

- Para exportar una herramienta, ábrela y haz clic en **Export function**. Esto guarda un archivo `.json`.
- Para exportar todas las herramientas, haz clic en **Export functions to ZIP** en la sección **Functions**.
- Para importar, haz clic en **Import functions from ZIP or JSON** y elige un archivo `.json` o `.zip`. Un mensaje informa cuántas herramientas se importaron.

Las herramientas importadas de tipo **Webhook** y **Script** siempre se guardan desactivadas y con **Include hidden chat context** desactivado, aunque el archivo pida cualquiera de esos dos permisos. Después de la importación, Marinara muestra el tipo de ejecución, el destino del webhook cuando corresponda y los permisos que pedía el archivo. Abre cada herramienta ejecutable importada, revísala y actívala solo si confías en ella. Las herramientas **Static** conservan el estado de activación que traían.

Una importación omite cualquier herramienta cuyo nombre choque con una herramienta existente o con el nombre de una herramienta integrada. Los paquetes de agentes no incluyen ni importan herramientas personalizadas: exporta las funciones de confianza por separado, revísalas en **Function Calls**, y adjúntalas explícitamente después de importar el agente.

## Nombres reservados

El nombre de tu herramienta personalizada no puede coincidir con el nombre de una herramienta integrada. Los nombres integrados incluyen `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search` y `update_about_me`, entre otros. Si intentas guardar uno, recibes este mensaje:

```
"your_name" is a reserved built-in tool name.
```

Dos herramientas personalizadas tampoco pueden compartir un nombre. Reutilizar un nombre muestra un mensaje que dice que ya existe una herramienta con ese nombre.

## Solución de problemas

La IA nunca llama a mi herramienta.

- Confirma que **Enable Tool Use** está activado en la sección **Function Calling** del chat.
- Si añadiste herramientas específicas al chat, confirma que tu herramienta está en esa lista.
- Confirma que el interruptor de activar/desactivar de la herramienta está activado en la sección **Functions**.
- Haz más claras tu **Description** y las descripciones de los parámetros, para que la IA sepa cuándo llamar a la herramienta.
- Si importaste la herramienta, una configuración de parámetros defectuosa puede hacer que la app la omita. Reconstruye los parámetros a mano.

La tarjeta Script está atenuada.

- Los scripts están desactivados en este servidor. Pídele al administrador que ponga `CUSTOM_TOOL_SCRIPT_ENABLED=true` y reinicie. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).

Mi webhook falla o se agota el tiempo de espera.

- Confirma que la dirección empieza con `https://` y es accesible.
- Una dirección local está bloqueada a menos que el administrador permita direcciones locales. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).
- Los servicios lentos pueden alcanzar el tiempo límite de 60 segundos.

No puedo crear ni editar herramientas desde mi teléfono u otro dispositivo.

- Guarda un secreto de administrador que coincida en **Settings**, luego **Advanced**, luego **Admin Access**.

## Guías relacionadas

- [Crear agentes personalizados](../agents/custom-agents.md)
- [Integración con Home Assistant](../integrations/home-assistant.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
