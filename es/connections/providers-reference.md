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

## Google Vertex AI

- Documentación de credenciales: `https://cloud.google.com/vertex-ai/docs/authentication`
- URL base predeterminada: `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI** ejecuta los modelos Gemini a través de un proyecto de Google Cloud. Necesita más configuración que **Google Gemini**. Debes editar la **Base URL** y reemplazar `YOUR_PROJECT_ID` con el ID real de tu proyecto. Cambia también la región si no es `us-central1`.

El campo **API Key** acepta cualquiera de estos tres tipos de credencial, y Marinara detecta cuál pegaste:

1. Una clave JSON de cuenta de servicio.
2. Un token de acceso OAuth, por ejemplo de `gcloud auth print-access-token`.
3. Una clave de API de Vertex.

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

## xAI / Grok

- Dónde conseguir una clave: `https://console.x.ai`
- URL base predeterminada: `https://api.x.ai/v1`

**xAI / Grok** ejecuta los modelos Grok. Cuando eliges este proveedor en la ventana **Create Connection**, Marinara rellena de antemano el modelo con Grok 4.5. Puedes cambiar el modelo después.

## Z.AI

- Dónde conseguir una API key: `https://z.ai/manage-apikey/apikey-list`
- URL base predeterminada: `https://api.z.ai/api/paas/v4`

**Z.AI** ofrece los modelos GLM (GLM 5.3, GLM 5.3 Flash y anteriores) a través de su propia API. El desplegable **Model** muestra los modelos GLM actuales, y **Fetch Models from API** actualiza la lista desde tu cuenta. Los modelos GLM 5.3 siempre razonan: el ajuste **Reasoning Effort** (esfuerzo de razonamiento) de tu preset se adapta a los tres niveles que acepta Z.AI: **Low** (bajo), **High** (alto) y **Maximum** (máximo). Si lo dejas sin configurar, se usa el valor predeterminado de Z.AI: **Maximum**. La URL base predeterminada corresponde al endpoint de pago por uso. El Coding Plan de Z.AI utiliza otro endpoint que su política de uso reserva para las herramientas de su lista, así que no se espera que una API key de ese plan funcione aquí.

## Claude (Subscription)

- API key: ninguna. En su lugar, inicias sesión en una herramienta local.

**Claude (Subscription)** usa tu plan Anthropic Pro o Max a través de la herramienta Claude Code. La herramienta se ejecuta en la computadora que aloja el servidor de Marinara, y tú inicias sesión una vez. Los campos **API Key** y **Base URL** quedan ocultos para este proveedor. No ofrece embeddings (consulta la sección Embeddings más abajo).

Los pasos de instalación e inicio de sesión están en [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md).

## OpenAI (ChatGPT)

- API key: ninguna. En su lugar, inicias sesión en una herramienta local.

**OpenAI (ChatGPT)** usa tu cuenta de ChatGPT a través de la herramienta Codex. La herramienta se ejecuta en la computadora que aloja el servidor de Marinara, y tú inicias sesión una vez. Los campos **API Key** y **Base URL** quedan ocultos para este proveedor. No ofrece embeddings (consulta la sección Embeddings más abajo).

Los pasos de instalación e inicio de sesión están en [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md).

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

**Video Generation** también es un proveedor especial con su propio selector **Video Service** (Servicio de video). Game Mode lo usa para crear videos MP4 cortos de escenas. Los servicios son **Google AI Studio**, **xAI Imagine**, **OpenRouter Video** y **Seedance 2.0**. Cada servicio necesita una API key.

La configuración completa y los límites de cada servicio de video están en [Generación de video de escenas](../media/scene-video.md).

## Embeddings

Los embeddings dan potencia a la búsqueda semántica de lorebooks y a Memory Recall. Convierten el texto en listas de números para que Marinara pueda encontrar entradas relacionadas. La mayoría de los proveedores de chat te dejan configurar un **Embedding Model** (Modelo de embeddings) y una **Embedding Endpoint URL** (URL del endpoint de embeddings) opcional en el editor de conexión.

Algunos proveedores no pueden crear embeddings. **Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** y **Grok CLI (Subscription)** no los ofrecen. Para esos, usa el menú desplegable **Embedding Connection** (Conexión de embeddings) para tomar prestada otra conexión, como una compatible con OpenAI, **Google Gemini** o el **Local Model** (Modelo local) integrado.

## Guías relacionadas

- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
- [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md)
- [Conectar un modelo local o autoalojado](local-self-hosted.md)
- [Proveedores y configuración de generación de imágenes](../media/image-providers.md)
- [Generación de video de escenas](../media/scene-video.md)
