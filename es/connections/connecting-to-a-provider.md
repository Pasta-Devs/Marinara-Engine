# Conectarte a un proveedor de IA

Esta guía te muestra cómo conectar Marinara Engine a un proveedor de IA para que tus personajes puedan responder. Añades una cuenta, pegas su clave y eliges el modelo que responde en tus chats.

## Cuentas y modelos

Una **cuenta** es una clave, un inicio de sesión o una dirección de un proveedor de IA. Guarda el proveedor, la clave, la dirección y sus límites. Si usas dos claves para el mismo proveedor, tienes dos cuentas.

Un **modelo** es un modelo de IA que guardaste desde una cuenta, como GPT o Claude. Cada modelo guardado conserva sus propios ajustes. Los modelos aparecen debajo de su cuenta en el panel **Connections** (Conexiones).

Una API key (clave de API) es un código secreto de tu proveedor de IA. Funciona como una contraseña. Marinara guarda tu clave en la computadora que ejecuta Marinara, y nunca se incluye cuando exportas.

Marinara Engine no viene con una cuenta ya lista ni con una clave inicial gratuita. Debes añadir al menos una cuenta antes de poder empezar un chat. El **Built-in model** (Modelo integrado), en **On your computer** (En tu computadora), es la única excepción: se ejecuta en tu propia computadora sin cuenta (consulta [Configuración del modelo local](local-model.md)).

## El panel Connections

Gestionas las cuentas en el panel **Connections**, en el lado derecho de la app. De arriba abajo, muestra:

- **Search models and accounts** (Buscar modelos y cuentas), que filtra la lista a medida que escribes.
- **Add** (Añadir), que abre la ventana **Add account** (Añadir cuenta), y **More actions** (Más acciones; tres puntos), que tiene **Import account** (Importar cuenta), **Export all accounts** (Exportar todas las cuentas), el plegado y la agrupación. En un panel ancho, el menú desplegable de orden está junto a **Search models and accounts**. En un panel estrecho, el orden está en **More actions**.
- El cuadro **Jobs** (Tareas). Indica qué modelo hace cada tarea, como **Main** (Principal) para las respuestas del chat o **Images** (Imágenes) para las imágenes. Consulta [Elegir el modelo para cada tarea](#choosing-the-model-for-each-job).
- Tus cuentas, cada una con sus modelos guardados debajo. Consulta [Organizar las conexiones](organizing-connections.md).

## Añadir una cuenta

1. En el panel **Connections**, haz clic en **Add**. La ventana **Add account** enumera los proveedores en **Popular**, **Subscriptions** (Suscripciones), **On your computer** y **All providers** (Todos los proveedores). Escribe en **Search providers** (Buscar proveedores) para encontrar uno.
2. Haz clic en un proveedor, por ejemplo **OpenAI**, **Anthropic** u **OpenRouter**.
3. Pega la clave en **API key**. **Where do I find my key?** (¿Dónde encuentro mi clave?) abre la página de claves del proveedor. El botón del ojo muestra u oculta la clave. **More options** (Más opciones) tiene el campo opcional **Name** (Nombre) y los campos **Address** (Dirección), **Requests per minute** (Solicitudes por minuto) y **Parallel jobs** (Tareas en paralelo).
4. Haz clic en **Connect** (Conectar). Marinara prueba la clave. Si falla, la ventana muestra el motivo y **Try again** (Intentar de nuevo). Los servidores en tu computadora también ofrecen **Continue anyway** (Continuar de todos modos).
5. Cuando añades tu primera cuenta sin un modelo Main, o añades una cuenta mientras empiezas un chat, la ventana continúa con la selección de modelo. Elige un modelo. **Make … my Main** (Convertir … en mi Principal) lo establece como Main cuando se muestra esa opción. Haz clic en **Done** (Listo) para terminar, o en **Start chatting** (Empezar a chatear) cuando empezaste desde un chat nuevo. Si ya tienes Main y añades una cuenta desde el panel, la ventana se cierra después de Connect y el panel muestra la cuenta nueva. Los servicios de imagen, video y voz usan sus propios controles de configuración; el modelo integrado usa su pantalla de configuración local.

Más adelante puedes cambiar el modelo de cada tarea en el cuadro **Jobs**.

Si dejas vacío el campo **Name**, Marinara le pone a la cuenta el nombre del proveedor. Una segunda cuenta del mismo proveedor sin un nombre escrito recibe los últimos 4 caracteres de su clave, por ejemplo `OpenAI · …a1b2`. Un nombre que escribas nunca se cambia.

Normalmente no necesitas tocar el campo **Address**. Marinara lo rellena para los proveedores conocidos. Cámbialo solo para un proxy o un servidor en tu computadora.

Algunos proveedores usan un inicio de sesión en tu computadora en lugar de una clave. Están en **Subscriptions** y no tienen campo de clave. Consulta [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md). Para conectar un modelo que se ejecuta en tu propia computadora, consulta [Conectar un modelo local o autoalojado](local-self-hosted.md). Para ver todos los proveedores compatibles y dónde obtener cada clave, consulta [Proveedores de IA compatibles](providers-reference.md).

### Empezar un chat sin cuenta

Si empiezas un chat antes de tener un modelo, Marinara abre primero la ventana **Add account**. Después de **Connect**, muestra los modelos del proveedor. Haz clic en uno y luego en **Start chatting**. El pie de la ventana también puede convertir ese modelo en tu modelo **Main**.

<a id="choosing-the-model-for-each-job"></a>

## Elegir el modelo para cada tarea

El cuadro **Jobs** enumera todas las tareas que puede hacer un modelo, en cuatro grupos:

- **Chat**: **Main** escribe las respuestas en tus chats. **Agents** (Agentes) ejecuta los agentes auxiliares. **Impersonate** escribe como tú.
- **Omnibar**: **Professor Mari** y **Quick answers** (Respuestas breves).
- **Pictures & sound** (Imágenes y sonido): **Images**, **Video** y **Voice (Text to Speech)** (Voz: texto a voz).
- **Behind the scenes** (Entre bastidores): **Decision** (Decisión), **Embeddings** e **Image reading** (Lectura de imágenes).

Cada fila muestra el modelo que hace esa tarea y su proveedor, o lo que hace la tarea sin modelo, como **Follows Main** u **Off**. Una tarea que necesita un modelo muestra **Choose a model** (Elegir un modelo).

Haz clic en una fila para abrir **Model for** (Modelo para) esa tarea. Muestra el modelo que hace la tarea en **Now** (Ahora), tus modelos **Starred** (Con estrella) y luego tus modelos guardados por cuenta. **All models** (Todos los modelos), debajo de una cuenta, abre su catálogo completo. Escribe en **Search all models or paste a model ID** (Buscar en todos los modelos o pegar un ID de modelo) para buscar en todos los catálogos a la vez. Haz clic en cualquier modelo para darle la tarea; no tienes que guardarlo antes. **If it fails** (Si falla), en la parte superior de la ventana, elige un segundo modelo que responde cuando el primero falla. **Add account**, en la parte inferior, abre la ventana Add.

Haz clic en **Jobs** para plegar el cuadro hasta su encabezado.

### Cuando una función necesita un modelo

Un agente o una función que no puede funcionar sin cierto tipo de modelo lo indica con una etiqueta **Needs an image model** (o su equivalente para video, audio, decisión o chat). Aparece en la tarjeta del agente en el panel **Agents**, en **Chat Settings** (Ajustes del chat), en el editor de agentes y en las ventanas de imagen y video. Haz clic en **Set up** (Configurar), junto a ella, para abrir **Model for** esa tarea, donde puedes elegir un modelo o hacer clic en **Add account**. La etiqueta desaparece en cuanto la tarea tiene un modelo. Cuando una respuesta falla porque no hay ningún modelo de imagen configurado, el botón **Set up** del mensaje abre el panel **Connections**.

## Probar una cuenta

**Connect** ya prueba la clave. Para volver a probarla más tarde, abre el menú **⋯** de la cuenta en el panel y haz clic en **Test** (Probar). El editor de la cuenta (**Edit account**, Editar cuenta) tiene **Test account** (Probar cuenta), que comprueba la clave y la dirección tal como las escribiste, antes de guardar.

<a id="choosing-a-model-for-one-chat"></a>

## Elegir un modelo para un chat

Un chat nuevo usa tu modelo **Main**. Para darle a un chat un modelo distinto, abre el menú **Connections** en el área de entrada del chat, o el campo **Model** (Modelo) en **Chat Settings → Connection** (Ajustes del chat → Conexión). Ambos abren **Model for this chat** (Modelo para este chat):

- **Now** muestra el modelo que usa el chat. **This chat only** (Solo este chat) significa que el chat tiene su propia elección; **follows Main** (sigue al principal) significa que usa Main.
- **Recent** (Recientes) y **Starred** enumeran tus modelos por cuenta.
- **Search models or paste an ID…** (Buscar modelos o pegar un ID…) busca en todos los catálogos. **Browse** (Explorar) abre la lista completa de una cuenta.
- **Follow Main** (Seguir al principal) quita la elección propia del chat. **Shuffle** (Aleatorio) elige un modelo distinto cada vez.

Una elección cambia solo ese chat. El mensaje que aparece después de una elección ofrece **Make it my Main model** (Convertirlo en mi modelo principal) y **Undo** (Deshacer). En Game Mode el campo se llama **GM / Party Model**.

## Errores comunes

Si una prueba o un mensaje falla, comprueba esto primero:

- Una clave incorrecta o vencida. Abre el menú **⋯** de la cuenta, haz clic en **Replace key** (Reemplazar clave) y vuelve a pegar la clave. Una cuenta sin clave muestra **Needs key**.
- Una cuenta desactivada. Muestra **Off**; haz clic en **Turn on** (Activar) en su menú **⋯**.
- Una clave del proveedor equivocado. Cada proveedor necesita su propia clave.
- Una dirección bloqueada o inalcanzable en **Address**. Déjala vacía para usar la del propio proveedor, a menos que uses un proxy o un servidor en tu computadora.

Para más soluciones, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Guías relacionadas

- [Organizar las conexiones](organizing-connections.md)
- [Proveedores de IA compatibles](providers-reference.md)
- [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md)
- [Conectar un modelo local o autoalojado](local-self-hosted.md)
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md)
