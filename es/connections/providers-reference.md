# Proveedores de IA compatibles

Esta guía enumera todos los proveedores de IA a los que Marinara Engine puede conectarse. De cada uno te dice dónde conseguir una API key (clave de API), la URL base predeterminada y cualquier detalle particular que debas conocer. Una API key es una contraseña secreta de un proveedor que permite a Marinara comunicarse con su servicio de IA.

Para conocer los pasos generales de cómo añadir una conexión, lee primero [Conectarse a un proveedor de IA](connecting-to-a-provider.md). Esta página es una referencia que puedes buscar cuando quieras detalles sobre un proveedor concreto.

## Cómo leer esta página

Eliges un proveedor cuando creas una conexión en el panel **Connections** (Conexiones). Cada proveedor tiene un botón **Provider** (Proveedor) en la ventana **Create Connection** (Crear conexión), con el nombre exacto que se muestra abajo.

La mayoría de los proveedores de esta página son servicios en la nube que alojan la IA por ti. Creas una cuenta con el proveedor, copias una API key y la pegas en el campo **API Key** (Clave de API). Tres proveedores de suscripción usan un inicio de sesión local en lugar de una clave. Sus secciones lo indican.

Verás dos términos a menudo:

- Base URL: la dirección web a la que Marinara envía las solicitudes. La mayoría de los proveedores la rellenan por ti. Solo la cambias para servidores locales o personalizados.
- Model: el modelo de IA concreto que eliges después de escoger un proveedor. Los modelos disponibles cambian a menudo, así que esta página no los enumera. Usa el menú desplegable **Model** (Modelo) o el botón **Fetch Models from API** (Obtener modelos de la API) en el editor de conexión para ver la lista actual.

## OpenAI

- Dónde conseguir una clave: `https://platform.openai.com/api-keys`
- URL base predeterminada: `https://api.openai.com/v1`

**OpenAI** ejecuta la familia de modelos GPT. Después de pegar tu clave, elige un modelo en el menú desplegable o haz clic en **Fetch Models from API** para cargar la lista actual. Esta conexión es solo para modelos de chat. Para imágenes con DALL-E, usa en su lugar el proveedor **Image Generation** (Generación de imágenes) y su servicio **OpenAI (DALL-E)**.

## Anthropic

- Dónde conseguir una clave: `https://console.anthropic.com/settings/keys`
- URL base predeterminada: `https://api.anthropic.com/v1`

**Anthropic** ejecuta los modelos Claude. Admite el almacenamiento en caché de prompts (las instrucciones enviadas a la IA), que puede reducir el costo de los chats largos. Puedes activarlo con el interruptor **Enable prompt caching** (Activar caché de prompts) en el editor de conexión.

**Anthropic** no ofrece embeddings. Los embeddings (representaciones numéricas del texto) convierten el texto en listas de números para que Marinara pueda buscar en lorebooks y en la memoria. Para esas funciones, usa una conexión de embeddings aparte (consulta la sección Embeddings más abajo).

## Google Gemini

- Dónde conseguir una clave: `https://aistudio.google.com/apikey`
- URL base predeterminada: `https://generativelanguage.googleapis.com/v1beta`

**Google Gemini** ejecuta los modelos Gemini a través de Google AI Studio. Esta es la más simple de las dos opciones de Google.

Marinara desactiva los filtros de seguridad ajustables de Google en las dos opciones de Google, salvo en cualquier categoría que configures tú en **Custom Parameters** (parámetros personalizados), pero las protecciones básicas de Google, como la seguridad infantil, se siguen aplicando.

## Google Vertex AI

- Documentación de credenciales: `https://cloud.google.com/vertex-ai/docs/authentication`
- URL base predeterminada: `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI** ejecuta los modelos Gemini a través de un proyecto de Google Cloud. Necesita más configuración que **Google Gemini**. Debes editar la **Base URL** y reemplazar `YOUR_PROJECT_ID` con el ID real de tu proyecto. Cambia también la región si no es `us-central1`.

El campo **API Key** acepta cualquiera de estos tres tipos de credencial, y Marinara detecta cuál pegaste:

1. Una clave JSON de cuenta de servicio.
2. Un token de acceso OAuth, por ejemplo de `gcloud auth print-access-token`.
3. Una clave de API de Vertex.

**Gemini 4 Argon** solo se ejecuta en las ubicaciones `global`, `us` y `eu`, no en una sola región como `us-central1`. Para usarlo, configura la **Base URL** como `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`. Con cualquier otra ubicación, Google devuelve un error y Marinara lo muestra.

Argon puede tardar varios minutos en responder, con cualquiera de las dos conexiones de Google. Si las respuestas del chat agotan el tiempo de espera, sube `CHAT_GENERATION_TIMEOUT_MS`. Si las llamadas de agentes agotan el tiempo de espera, sube `AGENT_CALL_TIMEOUT_MS` (consulta [Configuración](../CONFIGURATION.md)). Google sugiere dar al menos 15 minutos, que son `900000`.

## Mistral

- Dónde conseguir una clave: `https://console.mistral.ai/api-keys`
- URL base predeterminada: `https://api.mistral.ai/v1`

**Mistral** ejecuta la familia de modelos Mistral. No se necesita ninguna configuración especial más allá de la API key.

## Cohere

- Dónde conseguir una clave: `https://dashboard.cohere.com/api-keys`
- URL base predeterminada: `https://api.cohere.ai/compatibility/v1`

**Cohere** usa su endpoint compatible con OpenAI de forma predeterminada. Si pegas una URL más antigua de Cohere v2, Marinara la cambia por ti al endpoint de compatibilidad. Las solicitudes siguen funcionando.

## OpenRouter

- Dónde conseguir una clave: `https://openrouter.ai/keys`
- URL base predeterminada: `https://openrouter.ai/api/v1`

**OpenRouter** es un agregador. Una sola clave te da acceso a muchos modelos de muchas empresas. Añade dos opciones extra en el editor de conexión:

- **Preferred Provider** (Proveedor preferido): un campo de texto que obliga a **OpenRouter** a enrutar hacia un backend con nombre concreto. El nombre debe coincidir con el que se muestra en la página de modelos de OpenRouter. Déjalo vacío para el enrutamiento automático.
- **Enable prompt caching**: envía sugerencias de caché para los modelos Claude enrutados a través de **OpenRouter**. La mayoría de los demás modelos en **OpenRouter** usan caché por su cuenta y no necesitan esto.

## NanoGPT

- Dónde conseguir una clave: `https://nano-gpt.com/api`
- URL base predeterminada: `https://nano-gpt.com/api/v1`

**NanoGPT** también es un agregador. No tiene una lista de modelos integrada, así que el menú desplegable **Model** comienza vacío. Después de pegar tu clave, haz clic en **Fetch Models from API** para cargar los modelos que tu cuenta puede usar.

Marinara lee el catálogo detallado de modelos de NanoGPT, por lo que la lista desplegable indica qué modelos cubre tu suscripción y cuáles consumen más de su cuota:

- Un modelo incluido en tu suscripción muestra una etiqueta de **multiplicador de tokens de entrada**: `1x` en verde si consume la cuota a la tasa normal, o un valor mayor como `2x` si cada token enviado consume esa cantidad de tokens de entrada de tu cuota. Un modelo *no* incluido muestra **Paid** (de pago), porque su uso se cobra de tu saldo de pago. Un modelo sin etiqueta no tenía datos de suscripción disponibles.

### Uso de la suscripción

Si tienes una suscripción a NanoGPT, esta conexión puede mostrar tu cuota actual:

1. Activa **Show subscription usage** (mostrar uso de la suscripción) en el editor de conexiones y guarda.
2. Si quieres, pega primero un **Management Token** (token de administración).

El widget consulta el endpoint de uso de NanoGPT y muestra tus cuotas semanales y diarias de tokens de entrada. Puedes consultarlo con dos credenciales:

- **Management Token** (recomendado): créalo en `https://nano-gpt.com/settings#management-api-tokens` con el permiso **Usage only** (solo uso). Puede leer tus cuotas, pero no ejecutar modelos ni gastar tu saldo, por lo que es la opción más segura para mostrar el consumo. Marinara lo guarda cifrado y lo envía únicamente al endpoint de administración de NanoGPT.
- **Tu clave de API**: se usa automáticamente si no hay un token de administración guardado. Funciona, pero las consultas usan la misma credencial que permite gastar tu saldo.

Bajo cada barra, el widget indica lo que queda y cuándo se reinicia la ventana, por ejemplo `42M remaining · resets in 4d`.

Una cuota que NanoGPT no puede informar en ese momento aparece como **desconocida**, no como sin usar. Una suscripción inactiva se indica expresamente, en lugar de mostrar toda la cuota como disponible. El botón de actualización del widget permite actualizarlo cuando quieras.

El mismo indicador aparece debajo del indicador de contexto en el selector de conexión del chat y en sus ajustes de **Connection** (conexión), para que puedas consultar la cuota sin salir del chat. Sigue la conexión activa: solo aparece si es una conexión NanoGPT con **Show subscription usage** activado, y no aparece con **Random**, que no tiene una única conexión que consultar. En el selector tiene el mismo estilo que la barra de contexto superior y se lee igual: consumo frente al límite semanal, por ejemplo `8.9M / 60M tokens`, con la hora de reinicio junto al porcentaje.

## xAI / Grok

- Dónde conseguir una clave: `https://console.x.ai`
- URL base predeterminada: `https://api.x.ai/v1`

**xAI / Grok** ejecuta los modelos Grok. Cuando eliges este proveedor en la ventana **Create Connection**, Marinara rellena de antemano el modelo con Grok 4.5. Puedes cambiar el modelo después. Grok 4.6 y 4.7 ofrecen una ventana de contexto de 500 000 tokens y razonamiento hasta **Extra high** (`xhigh`). Admiten las herramientas existentes del chat, incluida **Web Search** (búsqueda web), para que los resultados de búsqueda puedan incorporarse a la respuesta final.

## Arli AI

- Dónde conseguir una clave: `https://www.arliai.com/account`
- URL base predeterminada: `https://api.arliai.com/v1`

**Arli AI** es un servicio de chat alojado. No tiene una lista de modelos integrada, así que el desplegable **Model** empieza vacío. Después de pegar tu clave, haz clic en **Fetch Models from API** para cargar sus modelos actuales. Para las imágenes de Arli AI, usa en su lugar el proveedor **Image Generation** y su servicio **Arli AI**.

## Z.AI

- Dónde conseguir una API key: `https://z.ai/manage-apikey/apikey-list`
- URL base predeterminada: `https://api.z.ai/api/paas/v4`

**Z.AI** ofrece los modelos GLM (GLM 5.3, GLM 5.3 Flash y anteriores) a través de su propia API. El desplegable **Model** muestra los modelos GLM actuales, y **Fetch Models from API** actualiza la lista desde tu cuenta. Los modelos GLM 5.3 siempre razonan: el ajuste **Reasoning Effort** (esfuerzo de razonamiento) de tu preset se adapta a los tres niveles que acepta Z.AI: **Low** (bajo), **High** (alto) y **Maximum** (máximo). Si lo dejas sin configurar, se usa el valor predeterminado de Z.AI: **Maximum**. La URL base predeterminada corresponde al endpoint de pago por uso. El Coding Plan de Z.AI utiliza otro endpoint que su política de uso reserva para las herramientas de su lista, así que no se espera que una API key de ese plan funcione aquí.

## DeepSeek

- Dónde conseguir una clave: `https://platform.deepseek.com/api_keys`
- URL base predeterminada: `https://api.deepseek.com/v1`

**DeepSeek** ofrece sus propios modelos de chat, `deepseek-flash` y `deepseek-v4-pro`. Después de pegar tu clave, el desplegable **Model** los muestra, y **Fetch Models from API** actualiza la lista desde tu cuenta.

DeepSeek razona de forma predeterminada. Su **Reasoning Effort** usa los niveles propios de DeepSeek: **Low**, **High** y **Max**. **Off** (desactivado) desactiva el razonamiento para esa solicitud. No hay **Medium**: DeepSeek atiende una solicitud de nivel medio como High, así que Marinara ofrece High en lugar de un segundo botón que haría lo mismo. Su razonamiento aparece en la respuesta con la presentación habitual de los pensamientos.

Algunos ajustes del panel de parámetros no se aplican a DeepSeek, así que el panel los omite en lugar de fingir que funcionan. **Verbosity**, **Top K** y las penalizaciones están entre ellos: DeepSeek los retiró y los ignora. **Temperature** (Temperatura) y **Top P** forman un par: DeepSeek solo usa uno a la vez, según esté razonando o no, así que ves **Temperature** cuando el razonamiento está desactivado y **Top P** cuando está activado.

Conecta DeepSeek aquí en lugar de apuntar el proveedor **OpenAI** a la URL de DeepSeek. El proveedor OpenAI espera los modelos propios de OpenAI, así que con un modelo de DeepSeek oculta los controles de generación y no envía casi ninguno de tus ajustes.

## Claude (Subscription)

- API key: ninguna. En su lugar, inicias sesión en una herramienta local.

**Claude (Subscription)** usa tu plan Anthropic Pro o Max a través de la herramienta Claude Code. La herramienta se ejecuta en la computadora que aloja el servidor de Marinara, y tú inicias sesión una vez. Los campos **API Key** y **Base URL** quedan ocultos para este proveedor. No ofrece embeddings (consulta la sección Embeddings más abajo).

Los pasos de instalación e inicio de sesión están en [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md).

### Uso del plan

Esta conexión puede mostrar cuánto de los límites de tu plan de Claude has usado:

1. Activa **Show subscription usage** (mostrar el uso de la suscripción) en el editor de conexiones.
2. Deja marcadas **5-hour window** (ventana de 5 horas) y **Weekly window** (ventana semanal), o desmarca la que no quieras ver.
3. Guarda la conexión.

Cada ventana tiene una barra con el porcentaje usado y cuándo se reinicia, por ejemplo `58% · resets in 2h`. Las mismas barras aparecen bajo el indicador de contexto en el selector de conexión de un chat y en los ajustes de **Connection** del chat mientras esta conexión está activa. No aparecen con **Random**, que no tiene una única conexión que consultar.

Conviene saber:

- Las barras cuentan todo lo que se usa en tu plan de Claude, como Claude Code y claude.ai, no solo Marinara.
- Claude informa de un porcentaje por ventana y no de tokens, así que no se muestran.
- Una lectura le pide a la herramienta Claude Code del host de Marinara los mismos datos que muestra su comando `/usage`. No envía ningún mensaje a Claude ni gasta nada de tu plan. Tarda un par de segundos, y el botón de actualizar la vuelve a leer.
- El nombre del plan junto al título, como **Pro**, es el que Claude informa para la cuenta con la que has iniciado sesión.
- Claude Code marca estos datos de uso como experimentales. Si una versión futura los cambia, las barras muestran un error con un botón de reintento en lugar de un número incorrecto.

## OpenAI (ChatGPT)

- API key: ninguna. En su lugar, inicias sesión en una herramienta local.

**OpenAI (ChatGPT)** usa tu cuenta de ChatGPT a través de la herramienta Codex. La herramienta se ejecuta en la computadora que aloja el servidor de Marinara, y tú inicias sesión una vez. Los campos **API Key** y **Base URL** quedan ocultos para este proveedor. No ofrece embeddings (consulta la sección Embeddings más abajo). Su nivel de razonamiento es el **Reasoning Effort** de los parámetros de la conexión o del chat; hasta que elijas uno, Codex usa su propio valor predeterminado para el modelo.

Los pasos de instalación e inicio de sesión están en [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md).

### Uso del plan

Esta conexión puede mostrar cuánto de los límites de Codex de tu plan de ChatGPT has usado. Funciona como la de Claude (Subscription) de arriba: activa **Show subscription usage**, deja marcadas o desmarca **5-hour window** y **Weekly window**, y guarda. Las barras aparecen en el editor de conexiones, en el selector de conexión de un chat y en los ajustes de **Connection** del chat.

Conviene saber:

- Las barras cuentan todo el uso de Codex en tu plan de ChatGPT, como el de la Codex CLI, no solo Marinara. Los chats de chatgpt.com tienen sus propios límites y no forman parte de estas barras.
- ChatGPT informa de un porcentaje por ventana y no de tokens, así que no se muestran.
- Una lectura le pide a ChatGPT los mismos datos que la Codex CLI muestra como sus límites, usando el inicio de sesión de Codex en el host de Marinara. No envía ningún mensaje a un modelo ni gasta nada de tu plan.
- Un plan con una sola de las dos ventanas muestra una sola barra.

## Grok CLI (Subscription)

- API key: ninguna. En su lugar, inicias sesión en una herramienta local.

**Grok CLI (Subscription)** usa tu cuenta de SuperGrok o X Premium+ a través de la herramienta Grok CLI. La herramienta se ejecuta en la computadora que aloja el servidor de Marinara, y tú inicias sesión una vez. Los campos **API Key** y **Base URL** quedan ocultos para este proveedor. No ofrece embeddings (consulta la sección Embeddings más abajo).

Los pasos de instalación e inicio de sesión están en [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md).

## Custom (OAI-Compatible)

- URL base predeterminada: ninguna. Debes introducir una.

Elige **Custom (OAI-Compatible)** para conectar un servidor de modelos local o autoalojado, como Ollama, LM Studio o KoboldCpp. También funciona para cualquier proxy alojado que hable el formato de chat de OpenAI. La **API Key** puede dejarse vacía en la mayoría de los servidores locales. Configuras la **Base URL** con la dirección de tu servidor.

Para la configuración paso a paso y el interruptor **Treat as local/custom endpoint** (Tratar como endpoint local/personalizado), lee [Conectar un modelo local o autoalojado](local-self-hosted.md). Para el modelo pequeño que viene incluido dentro de Marinara, lee [Configuración del modelo local](local-model.md).

## Image Generation

**Image Generation** es un proveedor especial. Después de elegirlo, también eliges un **Service** (Servicio), que es el backend de imágenes que hace el trabajo. Cada servicio tiene su propia URL base predeterminada y su propia regla sobre si se requiere una API key. Entre los servicios hay APIs de nube de pago como **OpenAI (DALL-E)**, **Stability AI**, **NovelAI** y **Z.AI**. También incluye opciones gratuitas como **Pollinations** y **Stable Horde**. Los servidores locales como **ComfyUI** y **SD Web UI (AUTOMATIC1111 / Forge)** también funcionan.

La lista completa de servicios de imágenes, su configuración y sus ajustes de generación están en [Proveedores y configuración de generación de imágenes](../media/image-providers.md).

## Video Generation

**Video Generation** también es un proveedor especial con su propio selector **Video Service** (Servicio de video). Marinara lo usa para crear videos MP4 cortos de escenas. Los servicios son **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **NanoGPT**, **Atlas Cloud**, **Seedance 2.0**, **ComfyUI** y **SwarmUI**. Los servicios en la nube necesitan una API key. **ComfyUI** y **SwarmUI** se ejecutan en tu propia computadora y normalmente no la necesitan.

La configuración completa y los límites de cada servicio de video están en [Generación de video de escenas](../media/scene-video.md).

## Decision

- URL base predeterminada: `https://api.typesafe.ai` para la fuente **TypeSafe**.

**Decision** es un proveedor especial opcional para un modelo que responde preguntas de sí o no sobre tu chat. Por ejemplo, puede decidir si un agente personalizado debe ejecutarse. Sus respuestas guían a Marinara y no se publican en el chat. Después de seleccionarlo, elige una fuente: **TypeSafe**, **OpenRouter**, **Custom System One endpoint** (endpoint System One personalizado) u **OpenAI-compatible chat model** (modelo de chat compatible con OpenAI). Las fuentes alojadas necesitan una API key.

Qué hace un modelo de decisión, cómo elegir uno y la configuración completa están en [Modelos de decisión](decision-models.md).

## Audio

**Audio** es un proveedor especial para voces y sonido generado. Después de seleccionarlo, elige una **Audio Source** (Fuente de audio):

- **ElevenLabs**: voz, efectos de sonido y música.
- **OpenAI-compatible**: OpenAI, o cualquier servidor que copie el formato de voz de OpenAI.
- **PocketTTS**: un servidor de voz gratuito que ejecutas en tu propia computadora.
- **xAI Voice**: el servicio de voz de xAI.

Cada fuente rellena una URL base y un modelo predeterminados. **Default Voice** (Voz predeterminada) es la voz que se usa cuando no hay nada más específico configurado, como una voz por personaje. **Request timeout (seconds)** (Tiempo de espera de la solicitud, en segundos) es cuánto espera Marinara por una línea hablada, 60 segundos de forma predeterminada; súbelo si tu servidor de voz es lento. Para elegir qué conexión de audio usa Marinara de forma predeterminada, abre el panel **Connections**, expande **Defaults** (Predeterminados) y elígela en **Audio**. Para leer mensajes en voz alta con una de ellas, elígela como **Source** (Fuente) en la tarjeta **Text to Speech**. Consulta [Usar una conexión de Audio](../media/tts-setup.md#use-an-audio-connection).

Con la fuente **ElevenLabs** aparecen dos interruptores más: **Game sound effects** (Efectos de sonido del juego) y **Game music** (Música del juego). Permiten que Game Mode cree efectos de sonido y música con esta conexión. Consulta [Efectos de sonido y música generados](../game/game-assets.md#generated-sound-effects-and-music). Para las voces y la lectura de mensajes en voz alta, consulta [Configuración de Text to Speech (TTS)](../media/tts-setup.md).

## Embeddings

Los embeddings dan potencia a la búsqueda semántica de lorebooks y a Memory Recall. Convierten el texto en listas de números para que Marinara pueda encontrar entradas relacionadas. La mayoría de los proveedores de chat te dejan configurar un **Embedding Model** (Modelo de embeddings) y una **Embedding Endpoint URL** (URL del endpoint de embeddings) opcional en el editor de conexión.

Algunos proveedores no pueden crear embeddings. **Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** y **Grok CLI (Subscription)** no los ofrecen. Para esos, usa el menú desplegable **Embedding Connection** (Conexión de embeddings) para tomar prestada otra conexión, como una compatible con OpenAI, **Google Gemini** o el **Local Model** (Modelo local) integrado.

Para usar una sola fuente de embeddings en todas las conexiones que no tienen ajustes de embedding propios, abre el panel **Connections**, expande **Defaults** y elígela en **Embeddings**. **None (built-in local model)** (Ninguno: modelo local integrado) conserva el modelo local de embeddings integrado. El modelo de embedding propio de una conexión o su **Embedding Connection** siguen teniendo prioridad. Vuelve a vectorizar tus lorebooks y memorias después de cambiarlo. Consulta [Búsqueda semántica para lorebooks](../lorebooks/semantic-search.md).

## Guías relacionadas

- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
- [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md)
- [Conectar un modelo local o autoalojado](local-self-hosted.md)
- [Proveedores y configuración de generación de imágenes](../media/image-providers.md)
- [Generación de video de escenas](../media/scene-video.md)
- [Modelos de decisión](decision-models.md)
- [Configuración de Text to Speech (TTS)](../media/tts-setup.md)
