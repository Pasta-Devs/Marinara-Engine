# Proveedores de IA compatibles

Esta página es una referencia de los principales servicios a los que Marinara Engine puede conectarse: dónde conseguir la API key (clave de API) de cada uno, su dirección predeterminada y sus particularidades. Para añadir una cuenta paso a paso, lee primero [Conectarse a un proveedor de IA](connecting-to-a-provider.md).

Eliges un servicio en la ventana **Add account** (Añadir cuenta), en la sección de lo que hace: **Chat**, **Images & video** (Imágenes y video), **Voice** (Voz) o **Decisions** (Decisiones). La ficha usa el nombre que se muestra abajo. La dirección es la dirección web a la que Marinara envía las solicitudes. Se llama **Address** (Dirección) en el editor de la cuenta y **Base URL** (URL base) en el editor del modelo. Marinara la rellena para los servicios conocidos. Cámbiala solo para un proxy o un servidor que ejecutes tú.

Los modelos cambian a menudo, así que esta página no los enumera. Después de conectarte, la lista de modelos se carga en el selector. Haz clic en **Refresh model list** (Actualizar la lista de modelos) en el selector para volver a cargarla.

## Servicios de chat

Estos servicios usan una API key, salvo los tres servicios de suscripción, que usan un inicio de sesión en tu computadora.

| Servicio | Dónde conseguir una clave |
| --- | --- |
| LinkAPI | `linkapi.ai` |
| OpenAI | `platform.openai.com/api-keys` |
| Anthropic | `console.anthropic.com/settings/keys` |
| Google Gemini | `aistudio.google.com/apikey` |
| Google Vertex AI | `cloud.google.com/vertex-ai/docs/authentication` (guía de credenciales) |
| Mistral | `console.mistral.ai/api-keys` |
| Cohere | `dashboard.cohere.com/api-keys` |
| OpenRouter | `openrouter.ai/keys` |
| NanoGPT | `nano-gpt.com/api` |
| xAI / Grok | `console.x.ai` |
| Arli AI | `www.arliai.com/account` |
| Z.AI | `z.ai/manage-apikey/apikey-list` |
| DeepSeek | `platform.deepseek.com/api_keys` |
| OpenAI-compatible, Claude (Subscription), OpenAI (ChatGPT), Grok CLI (Subscription) | No hay página de claves. Consulta las notas de abajo. |

Direcciones predeterminadas, que Marinara rellena por ti:

- LinkAPI: `https://linkapi.ai/v1` (una pasarela compatible con OpenAI con su propia clave)
- OpenAI: `https://api.openai.com/v1`
- Anthropic: `https://api.anthropic.com/v1`
- Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
- Google Vertex AI: la dirección `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`
- Mistral: `https://api.mistral.ai/v1`
- Cohere: `https://api.cohere.ai/compatibility/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- NanoGPT: `https://nano-gpt.com/api/v1`
- xAI / Grok: `https://api.x.ai/v1`
- Arli AI: `https://api.arliai.com/v1`
- Z.AI: `https://api.z.ai/api/paas/v4`
- DeepSeek: `https://api.deepseek.com/v1`
- OpenAI-compatible y los servicios de suscripción: ninguna. Introduces una dirección, o no hace falta ninguna.

Todas las páginas de claves empiezan por `https://`.

Los tres servicios de suscripción ocultan los campos **API key** y de dirección. No ofrecen embeddings. Los pasos de instalación e inicio de sesión están en [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md), que también trata el uso del plan.

Un agregador es un servicio en el que una sola clave da acceso a modelos de muchas empresas. OpenRouter y NanoGPT son agregadores. Una pasarela es la misma idea para un proxy que ejecutas o alquilas.

## Notas sobre los servicios

### OpenAI

**OpenAI** ejecuta los modelos GPT. Para imágenes con DALL-E, añade **OpenAI** y elige modelos **Image** (Imagen) en la misma cuenta. Esto se aplica a los demás servicios que crean imágenes con la misma clave.

### Anthropic

**Anthropic** ejecuta los modelos Claude. El almacenamiento en caché de prompts (las instrucciones enviadas a la IA) permite que el servicio reutilice el inicio de tu prompt, lo que puede reducir el costo de los chats largos. Actívalo con **Enable prompt caching** (Activar caché de prompts) en el editor del modelo. **Anthropic** no ofrece embeddings (consulta [Embeddings](#embeddings)).

### Google Gemini y Google Vertex AI

**Google Gemini** ejecuta los modelos Gemini a través de Google AI Studio. Es la opción de Google más sencilla. En las dos opciones de Google, Marinara desactiva los filtros de seguridad ajustables de Google, salvo en cualquier categoría que configures tú en **Custom Parameters** (Parámetros personalizados). Las protecciones básicas de Google, como la seguridad infantil, se siguen aplicando.

**Google Vertex AI** ejecuta Gemini a través de un proyecto de Google Cloud y necesita más configuración. Edita la dirección y reemplaza `YOUR_PROJECT_ID` por el ID de tu proyecto. Cambia la región si no es `us-central1`. El campo **API key** acepta cualquiera de estas opciones, y Marinara detecta cuál pegaste:

1. Una clave JSON de cuenta de servicio (un archivo que te da Google Cloud y que nombra una cuenta de servicio).
2. Un token de acceso OAuth, por ejemplo de `gcloud auth print-access-token`.
3. Una API key de Vertex.

**Gemini 4 Argon** y **Gemini 4 Carbon** solo se ejecutan en las ubicaciones `global`, `us` y `eu`, no en una sola región como `us-central1`, según una nota en el código de Marinara que sigue la documentación de Google. Para usar cualquiera de los dos, establece la dirección en `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`. Con otra ubicación, Google devuelve un error y Marinara lo muestra.

### Cohere

**Cohere** usa su endpoint compatible con OpenAI. Si pegas una dirección más antigua de Cohere v2, Marinara la cambia por ti al endpoint de compatibilidad.

### OpenRouter

**OpenRouter** es un agregador con dos opciones extra en el editor del modelo:

- **Preferred provider** (Proveedor preferido) obliga a enrutar hacia un backend concreto con nombre. El nombre debe coincidir con el de la página de modelos de OpenRouter. Déjalo vacío para el enrutamiento automático.
- **Enable prompt caching** envía indicaciones de caché para los modelos Claude enrutados a través de OpenRouter. La mayoría de los demás modelos usan caché por su cuenta.

### NanoGPT

**NanoGPT** es un agregador sin lista de modelos integrada. Después de conectarte, el selector carga los modelos que tu cuenta puede usar. Lee el catálogo detallado de NanoGPT y marca qué modelos cubre tu suscripción:

| Etiqueta | Significado |
| --- | --- |
| `1x` en verde | Incluido en tu suscripción, a la tasa normal. |
| Un valor mayor, como `2x` | Incluido, pero cada token de entrada cuesta esa cantidad de tokens de tu cuota. |
| **Paid** (De pago) | No incluido. El uso se cobra de tu saldo de pago. |
| Sin etiqueta | NanoGPT no tenía datos de suscripción para él. |

#### Uso de la suscripción

Con una suscripción a NanoGPT, la cuenta puede mostrar tu cuota en tiempo real.

1. Haz clic en **⋯** en la fila de la cuenta, elige **Edit account** (editar cuenta) y abre **Usage and balance** (uso y saldo).
2. Si las lecturas externas están desactivadas, haz clic en **Turn on** (activar). Para añadir una clave de administración, haz clic en **Add a usage-only key** (añadir una clave solo de uso), pégala y haz clic en **Show usage** (mostrar uso).
3. Activa **Show the usage meter on the card** (mostrar el medidor de uso en la tarjeta) y guarda.

El medidor muestra tus cuotas semanales y diarias de tokens de entrada, con lo que queda y cuándo se reinicia cada una, por ejemplo `42M remaining · resets in 4d`. Una cuota que NanoGPT no puede informar aparece como desconocida, no como sin usar. Una suscripción inactiva se indica expresamente en lugar de mostrarse llena. El botón de actualizar la vuelve a leer.

Dos credenciales pueden leer el uso:

- **Management key** (clave de administración; recomendada). Crea una en `https://nano-gpt.com/settings#management-api-tokens` solo para lecturas de uso. Lee las cuotas, pero no puede ejecutar modelos ni gastar tu saldo. Marinara la guarda cifrada y la envía únicamente al endpoint de administración de NanoGPT.
- **Tu API key**, que se usa cuando no hay ninguna clave de administración guardada. Funciona, pero la lectura de la cuota usa entonces una clave que puede gastar tu saldo.

El mismo medidor aparece debajo de la barra de contexto en el selector de conexión de un chat y en los ajustes de **Connection** (conexión) del chat. Solo aparece cuando el modelo del chat es de NanoGPT y tiene el medidor activado, y no con **Shuffle** (aleatorio).

### xAI / Grok

**xAI / Grok** ejecuta los modelos Grok. Grok 4.6 y 4.7 tienen una ventana de contexto de 500.000 tokens y razonamiento hasta **Extra high** (Muy alto). Admiten las herramientas del chat, incluida **Web Search** (Búsqueda web), para que los resultados de búsqueda puedan incorporarse a la respuesta final.

### Arli AI

**Arli AI** es un servicio de chat alojado sin lista de modelos integrada. Después de conectarte, el selector carga sus modelos. Para imágenes de Arli AI, añade **Arli AI** y elige modelos **Image** en la misma cuenta.

### Z.AI

**Z.AI** ofrece los modelos GLM (GLM 5.3, GLM 5.3 Flash y anteriores) a través de su propia API. Los modelos GLM 5.2 y 5.3 aceptan el nivel de razonamiento **Maximum** (Máximo). La dirección predeterminada corresponde al endpoint de pago por uso. El Coding Plan de Z.AI usa otro endpoint, así que es posible que una clave del Coding Plan no funcione aquí.

### DeepSeek

**DeepSeek** ofrece `deepseek-flash` y `deepseek-v4-pro`. DeepSeek razona de forma predeterminada. Su **Reasoning Effort** (Esfuerzo de razonamiento) usa los niveles propios de DeepSeek, y **Off** (Desactivado) desactiva el razonamiento para esa solicitud. DeepSeek atiende una solicitud de nivel medio como High. El razonamiento aparece en la respuesta con la presentación habitual de los pensamientos.

Algunos parámetros no se aplican, así que el panel los omite: **Verbosity**, **Top K** y las penalizaciones están retirados y se ignoran. **Temperature** (Temperatura) y **Top P** forman un par, porque DeepSeek usa uno a la vez. Ves **Temperature** cuando el razonamiento está desactivado y **Top P** cuando está activado.

Conecta DeepSeek con su propia ficha, no apuntando **OpenAI** a la dirección de DeepSeek. El servicio OpenAI espera los modelos de OpenAI, así que oculta los controles de generación para un modelo de DeepSeek y no envía casi ninguno de tus ajustes.

### OpenAI-compatible

**OpenAI-compatible** (Compatible con OpenAI) conecta un servidor o proxy que acepta el formato de solicitud de OpenAI, como Ollama, LM Studio o KoboldCpp. En la ventana **Add account** aparece como **OpenAI-compatible address** (Dirección compatible con OpenAI). La clave puede quedar vacía en la mayoría de los servidores locales. Tú introduces la dirección. Consulta [Conectar un modelo local o autoalojado](local-self-hosted.md). Para el modelo pequeño que Marinara ejecuta por su cuenta, consulta [Configuración del modelo integrado](local-model.md).

## Imágenes y video

En **Images & video**, cada ficha tiene su propia dirección y su propia regla sobre si se necesita una clave. Las fichas son Stability AI, Together AI, NovelAI, Venice.ai, Atlas Cloud, fal.ai, SpicyAPI, Pollinations, Stable Horde, Seedance 2.0 y servidores locales: ComfyUI, SD Web UI (AUTOMATIC1111 / Forge), SwarmUI, RunPod Serverless (ComfyUI), Draw Things y Block Entropy. Draw Things, ComfyUI, SwarmUI, SD Web UI y RunPod llevan la etiqueta **Self-hosted** (Autoalojado).

Los modelos de imagen y video de OpenAI, OpenRouter, xAI, NanoGPT, Arli AI, Z.AI y Google vienen de tu cuenta de chat de ese servicio. Añade la cuenta de chat y luego elige en ella modelos **Image** o **Video**.

Consulta [Proveedores y configuración de generación de imágenes](../media/image-providers.md) y [Generación de video de escenas](../media/scene-video.md).

## Decisión

En **Decisions**, las fichas son **TypeSafe** (dirección predeterminada `https://api.typesafe.ai`), **Own decision server** (Servidor de decisiones propio) y **Built-in model (decisions)** (Modelo integrado: decisiones). Los servicios de chat que usan el formato de chat de OpenAI también pueden hacer decisiones, pero solo con un modelo que devuelva log-probabilidades (puntuaciones para cada respuesta posible). Un modelo de decisión responde preguntas de sí o no sobre tu chat. Consulta [Modelos de decisión](decision-models.md).

## Audio

En **Voice**, un servicio de audio pronuncia las voces de los personajes y la narración. Elige una **Audio source** (Fuente de audio):

| Fuente | Qué es |
| --- | --- |
| ElevenLabs | Voces de personajes y narración. |
| OpenAI-compatible | OpenAI, o cualquier servidor que copie el formato de voz de OpenAI. |
| PocketTTS | Un servidor de voz gratuito que ejecutas en tu propia computadora. |
| xAI Voice | El servicio de voz de xAI. |

Cada fuente rellena una dirección y un modelo predeterminados. **Default voice** (Voz predeterminada) es la voz que se usa cuando no hay nada más específico configurado, como una voz por personaje. **Request timeout (seconds)** (Tiempo de espera de la solicitud, en segundos) es cuánto espera Marinara por una línea hablada. Súbelo para un servidor de voz lento.

Para elegir la cuenta de voz que Marinara usa de forma predeterminada, haz clic en la fila **Voice (Text to Speech)** (Voz: texto a voz) del cuadro **Jobs** (Tareas). Para leer mensajes en voz alta con una de ellas, elígela como **Source** (Fuente) en la tarjeta **Text to Speech** (Texto a voz). Consulta [Configuración de Text to Speech (TTS)](../media/tts-setup.md) y [Usar una conexión de Audio](../media/tts-setup.md#use-an-audio-connection).

<a id="music--sound-effects"></a>

## Música y efectos de sonido

Este tipo de cuenta genera música instrumental y efectos de sonido, por separado de la voz. La ventana **Add account** no tiene ninguna ficha para él. Estas cuentas provienen de una actualización (consulta abajo) o de una importación. Editas una con **Edit model** (Editar modelo), donde eliges su servicio y activas **Music generation** (Generación de música), **Sound-effect generation** (Generación de efectos de sonido) o ambas. La configuración de Game pide una en **Music & Sound Effects account** (Cuenta de música y efectos de sonido), y su opción predeterminada es **Use the default Music & Sound Effects account** (Usar la cuenta predeterminada de música y efectos de sonido).

Los servicios:

- **ElevenLabs**: dirección predeterminada `https://api.elevenlabs.io`. Necesita una clave de ElevenLabs. La música y los efectos de sonido tienen campos de modelo separados.
- **SunoAPI**: dirección predeterminada `https://apibox.erweima.ai`. Necesita una clave de [sunoapi.org](https://sunoapi.org/) y una **SunoAPI music callback URL** (URL de callback de música de SunoAPI) HTTPS pública cuando la música está activada. Es el servicio propio de SunoAPI, no un inicio de sesión de una suscripción de Suno.
- **Custom compatible server** (Servidor compatible personalizado): la dirección de tu servidor. Necesita una ruta explícita de endpoint de música o de efectos de sonido y un formato de solicitud compatible. Consulta los [contratos de audio compatibles](../media/tts-setup.md#game-music-and-sound-effects-on-a-compatible-audio-server).

Notas:

- SunoAPI necesita la dirección de callback aunque Marinara comprueba por su cuenta si la pista está lista. Tú proporcionas la dirección. Marinara no crea ninguna.
- Los prompts de estilo musical pueden tener hasta 1.000 caracteres. Los prompts de efectos de sonido pueden tener hasta 500.
- Cada solicitud puede costar dinero con tu proveedor. Consulta la [API de música](https://docs.sunoapi.org/suno-api/generate-music) y la [API de efectos de sonido](https://docs.sunoapi.org/suno-api/generate-sounds). Los efectos de sonido de SunoAPI no se han verificado con una cuenta de pago.

Al actualizar, cada cuenta de Audio con la generación activada obtiene una cuenta de Music & Sound Effects independiente. Los ajustes independientes antiguos de ElevenLabs para Game pueden crear la suya propia, así que puede que veas más de una. Las cuentas de voz y las asignaciones de voces no cambian, y los IDs de cuenta guardados en Game tampoco cambian. La generación solo funciona cuando la cuenta migrada correspondiente está disponible y tiene activada la opción de música o de efectos de sonido. De lo contrario, elige otra cuenta adecuada. Eliminar una cuenta migrada no la vuelve a crear al reiniciar. Los endpoints restaurados desde un perfil siguen sin estar disponibles hasta que los revises y los guardes localmente.

Activa el audio generado en cada juego, o activa **Sound effects** (Efectos de sonido) en los ajustes de comandos de Roleplay para usar `[sound: description]`. Gacha Forge tiene su propio ajuste de audio generativo. El audio incluido de Game sigue disponible cuando la generación está desactivada.

## Embeddings

Los embeddings convierten el texto en listas de números para que Marinara pueda encontrar texto relacionado. Hacen funcionar la búsqueda semántica de lorebooks (libros de trasfondo) y Memory Recall. La mayoría de los servicios de chat te permiten configurar un modelo de embeddings y una **Embedding endpoint URL** (URL del endpoint de embeddings) opcional en **Semantic search (embeddings)** (Búsqueda semántica: embeddings), en el editor del modelo.

**Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** y **Grok CLI (Subscription)** no pueden crear embeddings. Para esos, usa el menú desplegable **Embedding provider** (Proveedor de embeddings) para tomar prestada otra cuenta, como una compatible con OpenAI, **Google Gemini** o el **Built-in model** (Modelo integrado).

Para usar una sola fuente de embeddings en todas las cuentas que no tienen ajustes de embeddings propios, haz clic en la fila **Embeddings** del cuadro **Jobs**. **Marinara's own search** (La búsqueda propia de Marinara) conserva el modelo de embeddings integrado. El modelo de embeddings propio de una cuenta o su **Embedding provider** siguen teniendo prioridad. Vuelve a vectorizar tus lorebooks y memorias después de cambiarlo. Consulta [Búsqueda semántica para lorebooks](../lorebooks/semantic-search.md).

## Tiempos de espera

Los modelos lentos pueden alcanzar los límites de tiempo del servidor para las respuestas del chat y las llamadas de agentes. Los ajustes del servidor para ellos están en [Configuración](../CONFIGURATION.md).

## Guías relacionadas

- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
- [Conexiones de suscripción de Claude, ChatGPT y Grok](subscription-clis.md)
- [Conectar un modelo local o autoalojado](local-self-hosted.md)
- [Proveedores y configuración de generación de imágenes](../media/image-providers.md)
- [Generación de video de escenas](../media/scene-video.md)
- [Modelos de decisión](decision-models.md)
- [Configuración de Text to Speech (TTS)](../media/tts-setup.md)
