# Conectarte a un proveedor de IA

Para chatear, Marinara Engine necesita un modelo de IA. Puedes añadir una cuenta de un servicio de IA, pegar su API key (clave de API) y elegir un modelo. Una API key es un código secreto del servicio que permite que Marinara use tu cuenta allí. Trátala como una contraseña. También puedes usar el [modelo integrado](local-model.md), un modelo pequeño que se ejecuta en tu computadora sin clave.

## Añadir una cuenta

Antes de empezar, consigue una API key de un servicio que quieras usar. La ventana **Add account** (Añadir cuenta) tiene un enlace **Where do I find my key?** (¿Dónde encuentro mi clave?) para cada servicio. Estas son las páginas que abre para los servicios más comunes.

- OpenRouter (tiene modelos gratuitos): `openrouter.ai/keys`
- NanoGPT: `nano-gpt.com/api`
- OpenAI: `platform.openai.com/api-keys`
- Anthropic: `console.anthropic.com/settings/keys`
- Google Gemini: `aistudio.google.com/apikey`

La mayoría de los servicios te piden que te registres, y algunos que añadas crédito, antes de que una clave funcione. Para otros servicios, consulta [Proveedores de IA compatibles](providers-reference.md). Para usar un modelo en tu propia computadora sin clave, consulta [Configuración del modelo integrado](local-model.md).

1. Haz clic en **Connections** (Conexiones) en la barra superior. El panel se abre a la derecha. Si todavía no tienes cuentas, pregunta **Where do your models come from?** (¿De dónde vienen tus modelos?) y muestra algunos servicios. Haz clic en un servicio (no en **Built-in model**, el modelo integrado). La ventana **Add account** se abre en el paso de la clave. Ve al paso 4.
2. Haz clic en **Add** (Añadir). Se abre la ventana **Add account**.
3. Haz clic en el servicio que quieras. Escribe en el cuadro **Search providers** (Buscar proveedores) para encontrarlo. La lista tiene las secciones **Chat**, **Images & video** (Imágenes y video), **Voice** (Voz) y **Decisions** (Decisiones). Para un modelo de chat normal, busca en **Chat**.
4. Haz clic en **API key** y pega tu clave. Haz clic en el botón del ojo para comprobar que la pegaste completa.
5. Haz clic en **Connect** (Conectar). Marinara prueba la clave. Cuando funciona, ves **Connected** con el número de modelos que encontró.
6. Lo que pasa después depende de si ya tienes un modelo Main. Main (Principal) es la tarea de escribir las respuestas de tus chats.
   - **Todavía no tienes un modelo Main, o abriste Add desde un chat nuevo:** la ventana muestra los modelos del servicio. Los modelos **Recommended** (Recomendados) están arriba. Haz clic en un modelo para añadirlo, o escribe un nombre en **Search or enter model ID…** (Buscar o escribir un ID de modelo…). Si no sabes cuál elegir, toma uno **Recommended**. Puedes cambiarlo más tarde. Deja marcada la opción **Make … my Main model** (Convertir … en mi modelo principal). Solo aparece cuando no tienes un modelo Main. Si abriste Add desde un chat nuevo y ya tienes un modelo Main, en su lugar aparece un botón **Set … as Main** (Establecer … como principal). Luego haz clic en **Done** (Listo), o en **Start chatting** (Empezar a chatear) desde un chat nuevo.
   - **Ya tienes un modelo Main:** la ventana se cierra y un mensaje dice que se añadió la cuenta, con su número de modelos. Para añadir más modelos, haz clic en **⋯** en la cuenta y elige **Add model** (Añadir modelo).

El panel muestra tu cuenta. **Connected** en el paso 5 ya significa que la clave funciona. Si el modelo nuevo es tu modelo Main, empieza un chat y envía un mensaje: una respuesta significa que todo funciona. Si ya tenías un modelo Main, los chats nuevos lo siguen usando. Para usar la cuenta nueva, añádele un modelo (**⋯** → **Add model**) y luego elige ese modelo para un chat o una tarea (consulta [Elegir el modelo para cada tarea](#choosing-the-model-for-each-job)).

Si no funcionó:

- **The key was not accepted. Check that you copied all of it.** (No se aceptó la clave. Comprueba que la copiaste completa.) Vuelve a pegar la clave y haz clic en **Try again** (Intentar de nuevo). La clave debe venir del servicio que elegiste.
- **The service is busy, or your credit is used up.** (El servicio está ocupado o se acabó tu crédito.) Añade crédito en el sitio web del servicio, o espera e inténtalo de nuevo.
- **Marinara could not reach** el servicio (Marinara no pudo llegar al servicio). Comprueba tu conexión a internet y luego haz clic en **Try again**.

### Campos opcionales de la cuenta

El paso de la clave también muestra estos campos. Déjalos vacíos a menos que los necesites.

- **Name (optional)** (Nombre: opcional): el nombre que se muestra en el panel. Si está vacío, se usa el nombre del servicio. Una segunda cuenta del mismo servicio recibe los últimos 4 caracteres de su clave, por ejemplo `OpenAI · …a1b2`.
- **Address** (Dirección): adónde envía Marinara las solicitudes. Marinara usa la dirección propia del servicio cuando el campo está vacío. Rellénalo solo para un proxy, una pasarela o un servidor que tú ejecutes. Los servicios que inician sesión en tu computadora no lo muestran.
- **Requests per minute** (Solicitudes por minuto): frena a Marinara en esta cuenta. Vacío significa sin límite. Los valores permitidos van de 1 a 600.
- **Parallel jobs** (Tareas en paralelo): cuántas solicitudes se ejecutan a la vez. Vacío significa sin límite. Los valores permitidos van de 1 a 16. En **Edit account** (Editar cuenta), el mismo ajuste se llama **Parallel requests** (Solicitudes en paralelo).

Algunos servicios usan un inicio de sesión en tu computadora en lugar de una clave. Muestran una etiqueta **Sign in** (Iniciar sesión) y no tienen campo de clave. Consulta [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md). Para un servidor en tu propia computadora, consulta [Conectar un modelo local o autoalojado](local-self-hosted.md). Después de una prueba fallida aparece **Continue anyway** (Continuar de todos modos). Guarda la cuenta sin que la prueba haya pasado.

### Empezar un chat sin cuenta

Si empiezas un chat antes de tener un modelo, Marinara abre primero la ventana **Add account**. Después de **Connect**, haz clic en un modelo y luego en **Start chatting**.

## El panel Connections

Gestionas las cuentas en el panel **Connections**. De arriba abajo, muestra:

- Un cuadro de búsqueda que filtra la lista a medida que escribes. Su etiqueta es **Search models and accounts** (Buscar modelos y cuentas).
- **Add**, que abre **Add account**, y **More actions** (Más acciones; tres puntos), que tiene **Import account** (Importar cuenta), **Export all accounts** (Exportar todas las cuentas), el plegado y la agrupación. En un panel ancho, el menú desplegable de orden está junto a la búsqueda. En un panel estrecho, el orden está en **More actions**.
- El cuadro **Jobs** (Tareas). Indica qué modelo hace cada tarea.
- La tarjeta **Built-in model**. Consulta [Configuración del modelo integrado](local-model.md).
- Tus cuentas, cada una con sus modelos guardados debajo. Consulta [Organizar las conexiones](organizing-connections.md).

Una **cuenta** es una clave, un inicio de sesión o una dirección guardados para un servicio. Si usas dos claves para el mismo servicio, tienes dos cuentas. Un **modelo** es un modelo de IA que guardaste desde una cuenta. Cada modelo guardado conserva sus propios ajustes.

<a id="choosing-the-model-for-each-job"></a>

## Elegir el modelo para cada tarea

Una tarea es algo que un modelo hace por ti. El cuadro **Jobs** las enumera en cuatro grupos:

| Grupo | Tareas |
| --- | --- |
| **Chat** | **Main** (Principal) escribe las respuestas en tus chats. **Agents** (Agentes) ejecuta los agentes auxiliares. **Impersonate** escribe como tú. |
| **Omnibar** | **Professor Mari** y **Quick answers** (Respuestas breves). |
| **Pictures & sound** (Imágenes y sonido) | **Images** (Imágenes), **Video**, **Voice (Text to Speech)** (Voz: texto a voz) y **Dictation (Speech to Text)** (Dictado: voz a texto) cuando está disponible. |
| **Behind the scenes** (Entre bastidores) | **Decision** (Decisión), **Embeddings** e **Image reading** (Lectura de imágenes). |

Cada fila muestra el modelo que hace esa tarea, o lo que hace la tarea sin modelo, como **Follows Main** u **Off**. Una tarea que necesita un modelo muestra **Choose a model** (Elegir un modelo). Haz clic en **Jobs** para plegar el cuadro.

Para cambiar el modelo de una tarea, haz clic en su fila. Se abre **Model for** (Modelo para) esa tarea, excepto en tres filas. **Decision** y **Embeddings** abren sus propios controles (consulta [Modelos de decisión](decision-models.md) y [Proveedores de IA compatibles](providers-reference.md#embeddings)). **Dictation (Speech to Text)** abre la configuración de voz.

En **Model for**:

1. Mira la lista.
2. Haz clic en un modelo. La lista lo muestra en **Now** (Ahora), luego tus modelos **Starred** (Con estrella) y después tus modelos guardados por cuenta. **All models** (Todos los modelos), debajo de una cuenta, abre su lista completa. Escribe en **Search all models or paste a model ID** (Buscar en todos los modelos o pegar un ID de modelo) para buscar en todas las cuentas a la vez. No tienes que guardar un modelo antes.

**If it fails** (Si falla), en la parte superior de la ventana, elige un segundo modelo que responde cuando el primero falla. **Add account**, en la parte inferior, abre la ventana Add.

### Cuando una función necesita un modelo

Una función que no puede funcionar sin cierto tipo de modelo muestra una etiqueta **Needs an image model** (Necesita un modelo de imagen), o su equivalente para video, audio, decisión o chat. La ves en la tarjeta del agente en el panel **Agents**, en **Chat Settings** (Ajustes del chat), en el editor de agentes y en las ventanas de imagen y video. Haz clic en **Set up** (Configurar), junto a ella, y luego elige un modelo o haz clic en **Add account**. La etiqueta desaparece en cuanto la tarea tiene un modelo.

## Probar una cuenta

**Connect** ya prueba la clave. Para volver a probarla más tarde, abre el menú **⋯** de la cuenta en el panel y haz clic en **Test** (Probar). El editor de la cuenta (**Edit account**) tiene **Test account** (Probar cuenta), que comprueba la clave y la dirección tal como las escribiste, antes de guardar.

<a id="choosing-a-model-for-one-chat"></a>

## Elegir un modelo para un chat

Un chat nuevo usa tu modelo **Main**. Para darle a un chat un modelo distinto, haz clic en el botón de modelo de la entrada del chat (el icono de enlace, con el nombre del modelo actual), o usa el campo **Model** (Modelo) en **Chat Settings → Connection** (Ajustes del chat → Conexión). Ambos abren **Model for this chat** (Modelo para este chat):

- **Now** muestra el modelo que usa el chat. **This chat only** (Solo este chat) significa que el chat tiene su propia elección. **follows Main** (sigue al principal) significa que usa Main.
- **Recent** (Recientes) y **Starred** enumeran tus modelos por cuenta.
- **Search models or paste an ID…** (Buscar modelos o pegar un ID…) busca en todas las cuentas. **Browse** (Explorar) abre la lista completa de una cuenta.
- **Follow Main** (Seguir al principal) quita la elección propia del chat. **Shuffle** (Aleatorio) elige un modelo distinto cada vez.

Una elección cambia solo ese chat. El mensaje que aparece después de una elección ofrece **Make it my Main model** (Convertirlo en mi modelo principal) y **Undo** (Deshacer). En Game Mode el campo se llama **Game Master model** (Modelo del Game Master).

## Errores comunes

Si una prueba o un mensaje falla, comprueba esto primero:

- Una clave incorrecta o vencida. Haz clic en **⋯** en la cuenta, elige **Replace key** (Reemplazar clave) y vuelve a pegar la clave. Una cuenta sin clave muestra **Needs key**.
- Una cuenta desactivada. Muestra **Off**. Haz clic en **Turn on** (Activar) en su menú **⋯**.
- Una clave de otro servicio. Cada servicio necesita su propia clave.
- Una dirección bloqueada en **Address**. Si el campo está vacío, se usa la dirección propia del servicio.

Para más soluciones, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Guías relacionadas

- [Organizar las conexiones](organizing-connections.md)
- [Proveedores de IA compatibles](providers-reference.md)
- [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md)
- [Conectar un modelo local o autoalojado](local-self-hosted.md)
