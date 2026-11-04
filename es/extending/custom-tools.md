# Herramientas personalizadas y llamada a funciones

Una herramienta personalizada (también llamada función) permite que la IA ejecute una pequeña acción durante un chat. La acción puede devolver un texto fijo, llamar a una dirección web o ejecutar un script corto en el servidor. Úsala cuando quieras que la IA consulte o calcule algo en lugar de adivinarlo.

La llamada a funciones significa que la IA le pide a la app que ejecute una acción y luego usa el resultado en su respuesta. Marinara ya trae herramientas integradas, como las tiradas de dados, la búsqueda en el lorebook (libro de trasfondo) y las actualizaciones del estado del juego. Tus herramientas personalizadas funcionan junto a ellas. Una herramienta personalizada no se adjunta a una tarjeta de personaje. La activas para un chat, o la adjuntas a un agente (un ayudante que se ejecuta junto a tu chat).

> **Nota:** Las herramientas necesitan una conexión compatible con ellas. Las conexiones de suscripción de Claude y Grok ignoran las definiciones de herramientas, por lo que **Chat Settings** (Ajustes del chat) muestra un aviso y desactiva los controles de herramientas para ellas. Los comandos de texto y las etiquetas de dados siguen funcionando.

## Crear una herramienta

Antes de empezar, abre el panel **Presets** desde la barra superior. Las herramientas están en su sección **Functions** (icono de llave inglesa). Si abres Marinara desde otro dispositivo, guarda primero el secreto de administrador en **Settings → Advanced → Admin Access** (Configuración → Avanzado → Acceso de administrador). Debe coincidir con el `ADMIN_SECRET` del servidor; consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).

Para una primera prueba, elige **Static Result**: no necesita nada más.

### Cómo crear una herramienta

1. Abre **Presets** y busca **Functions**.
2. Haz clic en **Create function** (icono de signo más). Se abre un editor de herramientas en blanco.
3. Escribe un nombre en snake_case en minúsculas, como `check_weather`. Es el nombre exacto que usa la IA para llamarla. Empieza con una letra minúscula y luego usa letras minúsculas, números y guiones bajos.
4. Rellena **Description** (Descripción). Escríbela como una instrucción para la IA, porque la IA la lee para decidir cuándo llamar a la herramienta. Ejemplo: `Get the current weather for a city the user names.`
5. Añade los parámetros que necesite la herramienta (consulta [Añadir parámetros](#add-parameters)).
6. Elige un **Execution Type** (Tipo de ejecución): **Static Result**, **Webhook** o **Script**.
7. Rellena el campo de ese tipo (consulta [Elegir un tipo de ejecución](#choose-an-execution-type)).
8. Haz clic en **Save** (Guardar). Aparece un destello verde **Saved** cerca del botón.

Reglas para nombres y descripciones:

- El nombre tiene de 1 a 100 caracteres. La descripción tiene de 1 a 500 caracteres.
- Dos herramientas no pueden compartir un nombre, y una herramienta no puede usar un nombre integrado como `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search` o `update_about_me`. Un choque muestra un mensaje como `"your_name" is a reserved built-in tool name.`
- Si sales del editor con cambios sin guardar, un aviso ofrece **Keep editing** (Seguir editando), **Discard** (Descartar) o **Save & close** (Guardar y cerrar).

El encabezado de **Functions** tiene tres botones de icono:

- **Create function** (icono de signo más)
- **Import functions from ZIP or JSON**
- **Export functions to ZIP** (atenuado cuando no tienes herramientas)

Cada herramienta de la lista muestra:

- su nombre, tipo, número de parámetros y descripción
- un interruptor de activar/desactivar
- **Edit function** y **Delete Function**

Arrastra una herramienta por su manija para reordenar la lista. El orden es solo para mostrar. Sin herramientas, la lista dice **No functions yet** (Aún no hay funciones).

<a id="add-parameters"></a>

## Añadir parámetros

Los parámetros son las entradas que la IA envía cuando llama a tu herramienta. Cada uno tiene un nombre, un tipo, una marca de obligatorio y una descripción.

1. En el grupo **Parameters** (Parámetros), haz clic en **Add Parameter**.
2. Escribe un nombre, como `city`.
3. Elige un tipo: `string`, `number`, `boolean`, `array` u `object`.
4. Activa **Required** (Obligatorio) si la IA siempre debe enviar este valor.
5. Escribe una descripción que le diga a la IA qué significa el valor, como `The city name to look up, such as Tokyo.`

Añade más filas con **Add Parameter**, o quita una fila con su botón de menos. Una fila con el nombre vacío se descarta al guardar.

Si parece que la IA nunca llama a una herramienta importada, puede que sus parámetros no sean válidos, y entonces la app omite la herramienta sin avisarte. Borra los parámetros y vuelve a añadirlos a mano.

<a id="choose-an-execution-type"></a>

## Elegir un tipo de ejecución

### Static Result

Una herramienta **Static Result** devuelve el mismo texto cada vez. No necesita ningún servicio externo. Su tarjeta dice **Returns a fixed string when called.**

El único campo es **Static Result**, un cuadro de varias líneas. Si lo dejas vacío, la herramienta devuelve `OK`.

Ejemplo: una herramienta llamada `store_hours` sin parámetros y con este **Static Result**:

```text
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

Cuando la IA llama a `store_hours`, recibe ese texto junto con el nombre de la herramienta y cualquier argumento que haya enviado, y puede decirle al usuario tu horario.

### Webhook

Una herramienta **Webhook** envía la llamada a una dirección web y devuelve a la IA la respuesta de ese servicio. Un webhook es una dirección que acepta datos y devuelve datos. Su tarjeta dice **Sends a POST request to an external URL.**

El único campo es **Webhook URL**. La app envía una solicitud POST, que es una forma de enviar datos a un servicio web. El cuerpo es JSON, un formato de texto plano para datos estructurados, con esta forma:

```json
{ "tool": "your_tool_name", "arguments": { ... } }
```

Si activas **Include hidden chat context**, el cuerpo también incluye un valor `context`. El servicio responde con JSON o texto plano, y esa respuesta vuelve a la IA.

Ejemplo: una herramienta llamada `check_weather` con un parámetro obligatorio de tipo string llamado `city`, y esta **Webhook URL**:

```text
https://api.example.com/weather
```

Cuando la IA la llama con `city` ajustado a Tokyo, tu servicio consulta el clima y responde, y la IA usa la respuesta en su mensaje.

Límites:

- La respuesta tiene un límite de 512 KB.
- Cada llamada tiene un tiempo límite. El valor predeterminado es 60 segundos (`CUSTOM_TOOL_TIMEOUT_MS`).
- De forma predeterminada, solo se permiten direcciones `https://`. Las direcciones privadas y locales, como `localhost` o una dirección de red doméstica, están bloqueadas hasta que un administrador del servidor las permita. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).
- Si la llamada falla o se agota el tiempo de espera, la IA recibe un resultado de error y el chat sigue adelante.

Si no funcionó: comprueba que la dirección empieza con `https://` y es accesible. Una dirección local sigue bloqueada a menos que el administrador la permita. Un servicio lento puede alcanzar el límite de 60 segundos.

### Script

Una herramienta **Script** ejecuta un fragmento corto de JavaScript en el servidor y devuelve el resultado. JavaScript es un lenguaje de programación común. Su tarjeta dice **Runs a JavaScript expression server-side.**

Las herramientas de tipo script están desactivadas de forma predeterminada. Si tu servidor no las ha activado, la tarjeta **Script** aparece atenuada y se muestra una etiqueta ámbar **Script disabled**. Para activarlas, el administrador del servidor añade esta línea al archivo `.env` del servidor y reinicia Marinara:

```text
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

El único campo es **Script Body**. El script lee `args` (los valores que envió la IA) y debe hacer `return` de un resultado. Están disponibles `JSON`, `Math` y `Date`.

Ejemplo: una herramienta llamada `add_numbers` con dos parámetros obligatorios de tipo number llamados `x` e `y`, y este **Script Body**:

```js
const result = args.x + args.y;
return { sum: result };
```

Cuando la IA la llama con `x` ajustado a 2 e `y` ajustado a 3, la herramienta devuelve una suma de 5. Si el script lanza un error, la IA recibe un resultado de error.

Un script ejecuta código real en tu servidor, dentro de un sandbox (un área aislada que limita lo que el código puede hacer):

- Sin acceso a la red ni a archivos.
- Sin acceso a las variables de entorno ni a los secretos del servidor.
- Un tiempo límite. El valor predeterminado es 60 segundos.

El sandbox no es un aislamiento completo del sistema operativo. Alguien que pueda crear herramientas todavía podría escribir un script que desperdicie CPU o memoria. Activa las herramientas de tipo script solo en servidores en los que confíes, y ten cuidado con los scripts escritos por otras personas.

Si no funcionó: cuando la tarjeta **Script** esté atenuada, pide al administrador que ponga `CUSTOM_TOOL_SCRIPT_ENABLED=true` y reinicie.

### Incluir contexto oculto del chat

Las herramientas **Webhook** y **Script** pueden recibir datos adicionales del chat que la IA no ve como entradas de la herramienta. Activa **Include hidden chat context** en el editor de herramientas (desactivado de forma predeterminada). Tu herramienta recibe entonces un valor `context` que puede incluir:

- el modo del chat
- el nombre de la persona activa y los nombres de los personajes
- las variables guardadas del chat
- en Game Mode, el estado del juego

Esto permite que una herramienta personalice su resultado sin que la IA tenga que pasar todos esos datos.

## Activar herramientas en un chat

Crear una herramienta no hace que la IA la use. También tienes que activar el uso de herramientas en el chat.

1. Abre un chat y luego abre **Chat Settings**.
2. Abre la sección **Function Calling** (icono de llave inglesa).
3. Activa **Enable Tool Use**. Su descripción dice **Allow AI to call functions (dice rolls, game state, etc.)**. Está desactivado de forma predeterminada en un chat nuevo.
4. Comprueba que funciona: pregúntale a la IA algo que responda tu herramienta, como "What are your store hours?" para el ejemplo `store_hours`. La respuesta debería usar el texto de la herramienta.

Con **Enable Tool Use** activado y nada añadido debajo, el chat puede usar todas las herramientas habilitadas globalmente que admita: las herramientas integradas más cada herramienta personalizada cuyo interruptor esté activado en **Functions**. Los chats de Game también necesitan **Let the GM search lore** (Permitir que el GM busque trasfondo) para `search_lorebook`.

Para limitar un chat a un conjunto elegido:

1. Haz clic en **Add Functions**. Se abre un selector con un cuadro de búsqueda que solo coincide con los nombres de las herramientas.
2. Marca las herramientas que quieras. La lista mezcla herramientas integradas y personalizadas.
3. Haz clic en **Add Selected**.

Una vez que añades herramientas, solo esas herramientas funcionan en ese chat. **New Custom Function** en el selector lleva al editor de herramientas.

Los chats de Game pueden usar una conexión independiente para planificar herramientas. Consulta [Planificación opcional de herramientas y búsquedas de trasfondo](../game/getting-started.md#optional-tool-planning-and-lore-searches) para conocer su coste y funcionamiento.

Si no funcionó: confirma que **Enable Tool Use** está activado, que la herramienta está en la lista del chat si añadiste herramientas específicas y que el interruptor de la herramienta en **Functions** está activado. Una **Description** más clara y descripciones de parámetros más claras ayudan a la IA a decidir cuándo llamarla.

## Adjuntar herramientas a un agente

También puedes darle una herramienta a un agente en lugar de a un chat.

1. Abre el panel **Agents** (Agentes) y abre un agente.
2. Abre su grupo **Tools / Function Calling**.
3. Activa las herramientas que puede usar ese agente.

Sigues teniendo que activar **Enable Tool Use** en la sección **Function Calling** del chat. El pie del editor del agente te lo recuerda. Para los agentes en general, consulta [Crear agentes personalizados](../agents/custom-agents.md).

## Exportar e importar herramientas

- Para exportar una herramienta, ábrela y haz clic en **Export function**. Esto guarda un archivo `.json`.
- Para exportar todas las herramientas, haz clic en **Export functions to ZIP**.
- Para importar, haz clic en **Import functions from ZIP or JSON** y elige un archivo `.json` o `.zip`. Un mensaje informa cuántas herramientas se importaron.

Las herramientas webhook y script importadas siempre se guardan desactivadas, con **Include hidden chat context** desactivado, aunque el archivo pida cualquiera de las dos cosas. Después, Marinara muestra el tipo, la dirección del webhook y los permisos que pedía el archivo. Abre cada herramienta importada, revísala y actívala solo si confías en ella. Las herramientas estáticas conservan el estado de activación importado.

Una importación omite cualquier herramienta cuyo nombre choque con una herramienta existente o integrada. Los paquetes de agentes no incluyen herramientas personalizadas: expórtalas y revísalas por separado, y luego adjúntalas después de importar el agente.

## Guías relacionadas

- [Crear agentes personalizados](../agents/custom-agents.md)
- [Integración con Home Assistant](../integrations/home-assistant.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
