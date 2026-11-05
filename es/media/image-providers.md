# Proveedores de generación de imágenes y configuración

La generación de imágenes da vida a las ilustraciones de escena, las selfies, los fondos de escena y los avatares, retratos y sprites generados. Esta guía muestra cómo añadir un servicio de imágenes y lo que necesita cada servicio. Una vez que funciona un modelo de imagen, todas las funciones de imagen de la app pueden usarlo.

## Añadir un servicio de imágenes

Una API key (clave de API) es un código secreto que te da un servicio para que Marinara pueda usar tu cuenta. Marinara rellena por ti la dirección web de cada servicio, así que rara vez tendrás que escribir una.

1. Haz clic en **Connections** (Conexiones) en la barra superior y luego en **Add** (Añadir). Se abre la ventana **Add account** (Añadir cuenta).
2. Busca el servicio. La lista tiene una sección **Images & video** (Imágenes y video), y **Search providers** (Buscar proveedores) te ayuda a encontrarlo.
3. Pega tu clave en el campo **API key**. Los servicios gratuitos y locales no la necesitan. Para un servidor que ejecutas tú, rellena el campo de la dirección.
4. Haz clic en **Connect** (Conectar). Marinara prueba la cuenta.
5. Elige un modelo de imagen de la lista o escribe un ID de modelo. Este es tu modelo de imagen. Aparece debajo de la cuenta en el panel **Connections**.
6. Abre el modelo de imagen y haz clic en **Test image** (Probar imagen). Marinara crea una pequeña imagen de prueba.
7. Para que sea el modelo que usa la app para las imágenes, establece la tarea **Images** (Imágenes) en **Defaults** (Valores predeterminados), en la parte superior del panel **Connections**.

Para añadir otro modelo de imagen a una cuenta, abre su menú **⋯** y haz clic en **Add image model** (Añadir modelo de imagen). Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md) para ver la ventana completa.

Si no funcionó: **Test image** falla cuando la clave o la dirección son incorrectas. Revisa ambas primero. **Test provider** (Probar proveedor) solo comprueba que Marinara puede llegar al servicio. **Test image** crea una imagen real y puede gastar crédito.

## Obtener una imagen en un chat

Cuando hayas establecido un modelo de imagen como la tarea **Images**, pide una imagen en un chat.

1. Añade el agente Illustrator a un chat de Roleplay. Consulta [Agente Illustrator](illustrator-agent.md).
2. Abre **Chat Settings** (Ajustes del chat), expande **Gallery** (Galería) y haz clic en **Illustrate** (Ilustrar).
3. Espera a que termine **Generating...** (Generando...). La imagen aparece en la Gallery.

En un chat de Roleplay también puedes usar el comando `/illustrate`. Consulta [Comandos slash](../chats/slash-commands.md).

## Cómo elegir un servicio

Marinara rellena por ti la dirección de cada servicio. Los servicios en la nube necesitan una cuenta, y la mayoría necesita una API key. Los servicios gratuitos no necesitan clave. Los servicios locales ejecutan software de imágenes en tu propia computadora.

**El comienzo más fácil:** elige **Pollinations**. Es gratuito y no necesita cuenta ni clave. Más adelante, elige un servicio más potente si quieres mejores imágenes.

| Servicio | API key | Dónde se ejecuta |
| --- | --- | --- |
| OpenAI (DALL-E) | Sí | Nube |
| ChatGPT (Codex login) | No, usa `codex login` | Nube |
| Stability AI | Sí | Nube |
| Together AI | Sí | Nube |
| Arli AI | Sí | Nube |
| NovelAI | Sí | Nube |
| OpenRouter Images | Sí | Nube |
| xAI / Grok Imagine | Sí | Nube |
| Venice.ai | Sí | Nube |
| Z.AI | Sí | Nube |
| Atlas Cloud | Sí | Nube |
| fal.ai | Sí | Nube |
| SpicyAPI | Sí | Nube |
| NanoGPT | Sí | Nube |
| Block Entropy | Sí | Nube |
| RunPod Serverless (ComfyUI) | Sí | Nube |
| Pollinations | No | Nube gratuita |
| Stable Horde | Opcional | Nube gratuita |
| SD Web UI (AUTOMATIC1111 / Forge) | No | Local |
| ComfyUI | No | Local |
| SwarmUI | Opcional | Local |
| Draw Things | No | Local |

Notas sobre los servicios sencillos:

- **OpenAI (DALL-E)**: ofrece modelos DALL-E y GPT Image. Solo GPT Image 2.6 crea GIFs en bucle. Consulta [GPT Image 2.6](#gpt-image-26).
- **Stability AI**: modelos Stable Diffusion y Stable Image.
- **Together AI**: FLUX y otros modelos de imagen abiertos.
- **OpenRouter Images**: accede a los modelos de imagen a través de la interfaz de chat de OpenRouter, así que los modelos varían según la cuenta.
- **xAI / Grok Imagine**: usa Grok Imagine.
- **NanoGPT**: es un agregador, así que usa su lista de modelos.
- **Pollinations**: la forma más rápida de probar la generación de imágenes. No necesita cuenta.
- **Stable Horde**: una red de colaboración colectiva. Una clave gratuita da mayor prioridad en la cola.
- **SD Web UI** y **Draw Things**: inicia el software con su interfaz de aplicación activada. Marinara trata Draw Things como un servidor AUTOMATIC1111 (la app se ejecuta en macOS o iOS).
- **Block Entropy**: Marinara no tiene un manejador dedicado, así que envía solicitudes compatibles con OpenAI. La compatibilidad no está confirmada. Pruébalo con **Test image** antes de depender de él.

## Servicios con configuración especial

### GPT Image 2.6

GPT Image 2.6 funciona con una cuenta de **OpenAI (DALL-E)**. **GPT Image 2.6 Flare** es el modelo más rápido. **GPT Image 2.6 Sunburst** da más calidad y se mantiene más estable entre ediciones. Ambos aceptan los mismos tamaños y fondos transparentes que GPT Image 2.5, y **Image quality** (Calidad de imagen) llega hasta **Max** (Máxima).

El modelo planifica cada imagen antes de dibujarla. Para que planifique menos, añade `{"complexity": "low"}` o `{"complexity": "medium"}` a los **Custom Parameters** (Parámetros personalizados) del modelo de imagen. El valor predeterminado es `high`. Una complejidad más alta puede tardar más y, en una edición, puede cambiar más de lo que pediste.

GPT Image 2.6 también puede crear un GIF corto en bucle. Marinara solo pide uno donde una función o un agente descargado ofrezca GIFs:

| Límite | Valor |
| --- | --- |
| Cuenta | **OpenAI (DALL-E)** con una API key |
| Modelos | GPT Image 2.6 Flare o Sunburst |
| Fotogramas | De 2 a 12, 9 de forma predeterminada |
| Duración del fotograma | De 20 a 2000 ms, 200 ms de forma predeterminada |
| Tamaño del fotograma | Unos 0,66 MP: 816x816 cuadrado, 608x1088 vertical |
| Imágenes enviadas | Ninguna. Un GIF se dibuja solo a partir del prompt |
| Fondo transparente | No |

OpenAI permite más fotogramas, pero no publica cuántos píxeles puede tener un GIF, así que Marinara se limita a 12 fotogramas pequeños. **ChatGPT (Codex login)**, **OpenRouter Images**, **NanoGPT**, ToAPIs y otros servicios no pueden crear GIFs. Marinara rechaza esas solicitudes antes de enviar nada, así que no pagas nada. Con una cuenta **OpenAI-compatible** (Compatible con OpenAI), Marinara lo intenta igual que con OpenAI.

Un GIF fallido nunca se sustituye por una imagen fija. Si el servicio responde con una imagen fija, la solicitud falla. Solo se intenta con el modelo **If it fails** (Si falla) de la tarea **Images** si este puede crear GIFs.

> **Advertencia:** OpenAI no publica el precio de un GIF. Cuenta con que un GIF cueste lo mismo que varias imágenes, y una imagen fija que llegue en su lugar también se cobra.

### ChatGPT (Codex login)

Este servicio usa tu plan de ChatGPT en lugar de una API key, así que las imágenes no necesitan crédito de la API de OpenAI.

1. En la computadora que ejecuta Marinara, instala la Codex CLI y ejecuta `codex login` una sola vez. Es el mismo inicio de sesión que usa la cuenta de chat de ChatGPT. Consulta [Conexiones de suscripción de Claude, ChatGPT y Grok](../connections/subscription-clis.md#openai-chatgpt).
2. Elige el servicio. No hay clave ni dirección que rellenar. Marinara rellena el modelo `gpt-image-2`, el que usa Codex para las imágenes.

**Test provider** solo comprueba que Marinara puede leer tu inicio de sesión de Codex. **Test image** crea una imagen real y cuenta para tus límites de imágenes de ChatGPT. Este servicio no puede crear GIFs, ni siquiera con un ID de modelo de GPT Image 2.6. Con imágenes de referencia, Marinara envía una solicitud de edición con hasta 16 de ellas. ChatGPT puede devolver un tamaño en píxeles distinto, así que Marinara también indica en el prompt la relación de aspecto deseada. Este servicio usa el endpoint de imagen de ChatGPT que usa Codex, no la API pública de OpenAI, así que OpenAI puede cambiarlo sin avisar.

### Arli AI

Ejecuta modelos de Stable Diffusion alojados. Un modelo es obligatorio, así que escribe el nombre del modelo de imagen de Arli AI que quieras. Usa los mismos campos de **Local Image Defaults** (Valores predeterminados de imagen local) que SD Web UI (consulta [Valores predeterminados de imagen local](#local-image-defaults-per-connection)). La primera imagen de referencia se usa como imagen de partida. Este servicio es solo para imágenes. Para los modelos de chat de Arli AI, consulta [Proveedores de IA compatibles](../connections/providers-reference.md#arli-ai).

### NovelAI

NovelAI se centra en el arte de estilo anime. Con los modelos V4, V4.5 y V5, Marinara envía prompts de personaje nativos con posiciones para los storyboards y las escenas del Illustrator con varios personajes. Las imágenes de referencia precisas solo funcionan en un modelo V4.5.

### Venice.ai

Marinara usa el endpoint de imagen nativo de Venice, desactiva el desenfoque opcional del modo seguro de Venice y asigna los tamaños solicitados al formato de tamaño de cada modelo. La propia política de Venice o los límites del modelo aún pueden rechazar una solicitud.

### Z.AI

Usa una API key general de Z.AI. Las claves del GLM Coding Plan y la dirección `/api/coding/paas/v4` no funcionan para imágenes. Elige **GLM-Image** o **CogView 4**. Marinara asigna la relación de aspecto a un tamaño que el modelo admite y descarga el resultado temporal al almacenamiento local. Es solo de texto a imagen y no envía imágenes de referencia.

### Atlas Cloud

Marinara carga el catálogo actual de modelos de texto a imagen y de imagen a imagen de Atlas Cloud. Si no puede, muestra una lista inicial (Nano Banana, Gemini Flash Image, FLUX 1.1 Pro). Siempre puedes escribir un ID de modelo exacto. Los trabajos se ejecutan de forma asíncrona, así que Marinara inicia el trabajo y consulta su estado hasta que la imagen está lista. Las imágenes de referencia se envían a los ID de modelo que indican un comportamiento de imagen a imagen, edición o Kontext. Los esquemas de los modelos de Atlas difieren, así que consulta la documentación de Atlas Cloud del modelo para otros ID.

### fal.ai

Crea una API key en [fal.ai](https://fal.ai/dashboard/keys). La lista inicial tiene `fal-ai/flux/schnell` y `fal-ai/flux/dev`. Puedes escribir otro ID de endpoint de texto a imagen con una entrada y una salida compatibles. **Test provider** solo comprueba la configuración. **Test image** envía una solicitud real y usa crédito de fal.ai.

Marinara envía el prompt y los tamaños, y descarga la primera imagen devuelta. Los prompts negativos se añaden como texto. Usa **Custom Parameters** para opciones del modelo como `seed`, `num_inference_steps` o `image_size`. Usa solicitudes síncronas de texto a imagen, no envía imágenes de referencia y no reanuda trabajos interrumpidos. Consulta la [referencia de la API](https://fal.ai/models/fal-ai/flux/schnell/api) del modelo.

### SpicyAPI

Crea una clave en la [consola de SpicyAPI](https://spicyapi.ai/console/keys) y elige **SpicyAPI**. Marinara rellena el modelo `alibaba/z-image-spicy-pro/text-to-image`. Puedes escribir otro ID, como `bytedance/seedream-5.0-pro/text-to-image`. **Test provider** lee la lista de modelos, así que no cuesta nada. **Test image** crea una imagen real y usa tu saldo.

Elige el servicio **SpicyAPI**. No uses **OpenAI (DALL-E)** ni una cuenta compatible con OpenAI con una dirección de SpicyAPI. La dirección de estilo OpenAI de SpicyAPI solo maneja texto.

Cada modelo admite sus propios ajustes. Marinara pregunta a SpicyAPI cuáles acepta el modelo y envía solo esos, con la forma más cercana que ofrece (relación de aspecto, ancho y alto, o un tamaño fijo). Si un modelo no tiene un campo de prompt negativo, el prompt negativo se añade al final del prompt. Usa **Custom Parameters** para otras opciones como `seed`, `resolution` o `loras`.

Cada imagen es una tarea. Marinara espera, vuelve a consultar después de un minuto aproximadamente y luego descarga el resultado. Si se corta la conexión, retoma la misma tarea en lugar de pagar por una nueva. Los modelos de edición (los ID que terminan en `/edit`) reciben tus imágenes de referencia. SpicyAPI acepta hasta 1 MB por imagen y 2 MB por solicitud, así que Marinara reduce las imágenes más grandes y deja fuera las adicionales que no caben.

### SwarmUI

SwarmUI puede repartir el trabajo de ComfyUI en su propia cola. Un servidor local sin cuentas no necesita clave. Si tu servidor requiere una cuenta, pega un Swarm Auth Token en **API key**. La lista de modelos muestra los modelos de tu servidor de SwarmUI.

El campo **ComfyUI workflow (optional)** (Flujo de trabajo de ComfyUI: opcional) puede quedarse vacío. Déjalo vacío para usar los ajustes de imagen propios de SwarmUI, o pega un flujo de trabajo (ver más abajo). Activa **Save images in SwarmUI** (Guardar imágenes en SwarmUI) en **Local Image Defaults** para guardar también cada imagen en la carpeta de salida de SwarmUI. Marinara conserva su propia copia en cualquier caso.

### Servicios locales en tu red

`localhost` significa la computadora que ejecuta Marinara. Los servidores de imágenes locales en esa computadora funcionan sin configuración adicional. Si el servidor se ejecuta en otra computadora de tu red, permite las direcciones de red local en la configuración del servidor. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).

Cuando un servicio devuelve una URL en lugar de los datos de la imagen, Marinara descarga las URL públicas de CDN pasando por sus comprobaciones habituales de solicitudes salientes. Una URL de resultado privada o de loopback solo se acepta si su esquema, su nombre de host y su puerto coinciden exactamente con los del servicio de imágenes configurado. Las redirecciones desde ese origen no pueden saltar a otro servicio local. Si un proxy local guarda los resultados en un origen privado distinto, haz que sirva esos archivos a través del mismo origen que su API de imágenes.

## JSON del flujo de trabajo de ComfyUI y RunPod

Para **ComfyUI**, **SwarmUI** y **RunPod Serverless (ComfyUI)** aparece un campo **ComfyUI workflow (optional)** o **(required)** (obligatorio). Pega un JSON de flujo de trabajo que hayas exportado desde ComfyUI con **Save (API Format)**, **Export (API)** o **Export to API**, según tu versión de ComfyUI. Es opcional para ComfyUI y SwarmUI, y obligatorio para RunPod, que necesita tu token de API de RunPod como API key, un **RunPod endpoint ID** (ID del endpoint de RunPod) y el flujo de trabajo.

Pon estos marcadores de texto en el flujo de trabajo donde Marinara deba rellenar un valor:

- `%prompt%` y `%negative_prompt%` para los prompts.
- `%width%`, `%height%` y `%seed%` para el tamaño y la semilla.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` y `%denoise%` para los ajustes de generación.
- `%reference_image%` y de `%reference_image_01%` a `%reference_image_04%` para los datos de imagen de referencia.
- `%reference_image_name%` y de `%reference_image_name_01%` a `%reference_image_name_04%` para subir imágenes de referencia y rellenar sus nombres de archivo para un nodo LoadImage de ComfyUI local.

`%prompt%` es el más importante. El editor te avisa cuando falta. Para ComfyUI, un campo vacío usa un flujo de trabajo predeterminado integrado. Para SwarmUI, usa los ajustes propios de SwarmUI. RunPod no tiene predeterminado, así que el flujo de trabajo es obligatorio. Los tres aceptan hasta 4 imágenes de referencia en base64 sin procesar. Los marcadores de posición de subida por nombre de archivo solo funcionan para ComfyUI local.

Consulta [Configuración del flujo de trabajo de ComfyUI](comfyui.md) para ver los pasos de exportación completos, ejemplos, reglas de comillas, imágenes de referencia, flujos de trabajo específicos por personaje, acceso por red y solución de problemas.

<a id="local-image-defaults-per-connection"></a>

## Valores predeterminados de imagen local por conexión

En un modelo de imagen de **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI**, **Draw Things**, **Arli AI**, **SwarmUI** y **RunPod Serverless (ComfyUI)** aparece un panel **Local image defaults** (Valores predeterminados de imagen local). Draw Things y Arli AI muestran los campos de SD Web UI. SwarmUI y RunPod muestran los campos de ComfyUI. Estos valores solo se aplican cuando este modelo crea una imagen. **Reset** (Restablecer) restaura los valores integrados.

Cada servicio tiene un campo **Seed** (Semilla). -1 mantiene cada imagen aleatoria. Cualquier otro número reutiliza esa semilla cada vez. Los demás campos dependen del servicio.

| Servicio | Campo | Predeterminado |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2img denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise schedule | karras |

Cada servicio también tiene los campos **Prompt prefix** y **Negative prefix**. El texto que pongas ahí se añade al principio de cada prompt de este modelo. AUTOMATIC1111 / Forge y ComfyUI tienen un campo **Clip skip**. AUTOMATIC1111 / Forge añade un interruptor **Restore faces**. ComfyUI añade un interruptor para subir un marcador de posición de 1x1 cuando no se proporciona ninguna imagen de referencia, que solo importa para flujos de trabajo personalizados con marcadores de posición de referencia. NovelAI añade **Guidance rescale** y **UC preset**.

## La compatibilidad con imágenes de referencia varía según el servicio

Una imagen de referencia es una imagen existente que envías con tu prompt para que la imagen nueva conserve el rostro de un personaje o un estilo artístico.

| Servicio | Imágenes de referencia |
| --- | --- |
| OpenAI (DALL-E) | Hasta 16, solo modelos GPT Image. Ninguna para un GIF |
| ChatGPT (Codex login) | Hasta 16 |
| NovelAI | Hasta 16, solo modelo V4.5 |
| xAI / Grok Imagine | Hasta 3 |
| NanoGPT | Hasta 3 |
| ComfyUI, RunPod Serverless (ComfyUI), SwarmUI | Hasta 4, mediante marcadores de posición del flujo de trabajo |
| Stability AI, Arli AI, SD Web UI, Draw Things | Solo la primera imagen, como imagen a imagen |
| Atlas Cloud | La primera imagen, para ID de modelo compatibles de imagen a imagen, edición o Kontext |
| SpicyAPI | Solo modelos de edición, hasta el límite del modelo, reducidas para que quepan |
| OpenRouter Images | Compatible, sin límite fijo |
| Venice.ai, Z.AI | No compatible con texto a imagen |
| Together AI, Pollinations, Stable Horde, fal.ai | No compatible |

La referencia precisa de NovelAI solo funciona en un modelo V4.5, como `nai-diffusion-4-5-full`. NovelAI no ha publicado Precise Reference para V5. Si pides referencias en otro modelo, Marinara genera la imagen sin ellas y registra una advertencia en el servidor.

## Poner en cola las solicitudes de generación de medios

El interruptor **Queue media generation requests** (Poner en cola las solicitudes de generación de medios) está en **Settings → Generations → Overall Generations** (Configuración → Generaciones → Generaciones generales). Está activado de forma predeterminada.

Cuando está activado, Marinara envía los trabajos de imagen a cada cuenta de imágenes de uno en uno, y los trabajos de video a cada cuenta de video de uno en uno, en colas separadas. Una imagen y un video para la misma cuenta pueden ejecutarse a la vez. Se aplica a todas las funciones que los piden: el Illustrator, los trackers, los comandos, la Gallery, los recursos de Game y los agentes descargados como Slurp. Dos modelos con la misma dirección y la misma API key comparten una cola. Las cuentas distintas siguen ejecutándose al mismo tiempo. NovelAI recibe además una breve pausa entre trabajos y, cuando responde que está ocupado, Marinara espera y lo intenta dos veces más.

Mantenlo activado para los servicios que rechazan dos solicitudes a la vez. Desactívalo solo si tu servicio maneja muchas a la vez y quieres velocidad.

## Guías relacionadas

- [Configuración del flujo de trabajo de ComfyUI](comfyui.md)
- [Agente Illustrator](illustrator-agent.md)
- [Perfiles de estilo de imagen](style-profiles.md)
- [Fondos de escena y la galería](scene-backgrounds.md)
- [Selfies](../conversation/selfies.md)
- [Proveedores de IA compatibles](../connections/providers-reference.md)
