# Proveedores de generación de imágenes y configuración

Esta guía explica cómo conectar un servicio de generación de imágenes a Marinara Engine. También cubre lo que necesita cada uno de los 17 servicios. La generación de imágenes da vida a las ilustraciones de escena, las selfies, los fondos de escena y los avatares, retratos y sprites (imágenes del personaje) generados.

La generación de imágenes se configura como un tipo especial de conexión. Una vez que funciona una conexión de imagen, todas las funciones de imagen de la app pueden usarla.

## Cómo añadir una conexión de generación de imágenes

Una **API Key** (clave de API) es una contraseña secreta de un proveedor que permite a Marinara usar tu cuenta. Una **Base URL** es la dirección web de la interfaz de aplicación del servicio. Marinara rellena por ti la Base URL correcta cuando eliges un servicio.

Sigue estos pasos para añadir una conexión de imagen.

1. Abre el panel **Connections** (Conexiones).
2. Haz clic en **New** (Nuevo) para abrir la ventana **Create Connection** (Crear conexión).
3. Escribe un nombre y luego elige el proveedor **Image Generation** (Generación de imágenes).
4. En el editor de conexión, elige un **Service** (Servicio) de la cuadrícula.
5. Pega tu **API Key** si ese servicio necesita una. Los servicios gratuitos y locales no la necesitan.
6. Elige un **Model** (Modelo) de la lista, o escribe un ID de modelo. Algunos servicios ofrecen **Fetch Models from API** (Obtener modelos desde la API) para cargar la lista actual.
7. Haz clic en **Save** (Guardar).
8. Haz clic en **Test Image** (Probar imagen) para confirmar que funciona. Marinara genera una pequeña imagen de prueba.

Si **Test Image** devuelve una imagen, tu conexión está lista. Si falla, revisa la API key y la Base URL.

## Cómo elegir un servicio

Los 17 servicios se dividen en tres grupos. Los servicios en la nube necesitan una API key y una cuenta. Los servicios gratuitos no necesitan clave. Los servicios locales ejecutan software de imágenes en tu propia computadora.

La tabla de abajo muestra cada servicio de un vistazo. Los detalles y peculiaridades siguen en las secciones de cada servicio.

| Servicio | API key | Dónde se ejecuta |
| --- | --- | --- |
| OpenAI (DALL-E) | Sí | Nube |
| Stability AI | Sí | Nube |
| Together AI | Sí | Nube |
| NovelAI | Sí | Nube |
| OpenRouter Images | Sí | Nube |
| xAI / Grok Imagine | Sí | Nube |
| Venice.ai | Sí | Nube |
| Z.AI | Sí | Nube |
| Atlas Cloud | Sí | Nube |
| NanoGPT | Sí | Nube |
| Block Entropy | Sí | Nube |
| RunPod Serverless (ComfyUI) | Sí | Nube |
| Pollinations | No | Nube gratuita |
| Stable Horde | Opcional | Nube gratuita |
| SD Web UI (AUTOMATIC1111 / Forge) | No | Local |
| ComfyUI | No | Local |
| Draw Things | No | Local |

## OpenAI (DALL-E)

Servicio en la nube con la Base URL predeterminada `https://api.openai.com/v1`. Necesita una API key de tu cuenta de OpenAI. Ofrece modelos DALL-E y GPT Image. Acepta hasta 16 imágenes de referencia.

## Stability AI

Servicio en la nube con la Base URL predeterminada `https://api.stability.ai/v2beta`. Necesita una API key de Stability AI. Ofrece modelos Stable Diffusion y Stable Image.

## Together AI

Servicio en la nube con la Base URL predeterminada `https://api.together.xyz/v1`. Necesita una API key de Together AI. Ofrece FLUX y otros modelos de imagen abiertos.

## NovelAI

Servicio en la nube con la Base URL predeterminada `https://image.novelai.net`. Necesita una API key de NovelAI. Se centra en el arte de estilo anime. Con los modelos V4, V4.5 y V5, Marinara envía prompts de personaje nativos con posiciones para los storyboards y las escenas del Illustrator que incluyen varios personajes. Algunas funciones más recientes, como las imágenes de referencia precisas, solo funcionan en un modelo V4.5.

## OpenRouter Images

Servicio en la nube con la Base URL predeterminada `https://openrouter.ai/api/v1`. Necesita una API key de OpenRouter. Accede a los modelos de imagen a través de la interfaz de chat de OpenRouter, así que los modelos exactos disponibles varían según la cuenta.

## xAI / Grok Imagine

Servicio en la nube con la Base URL predeterminada `https://api.x.ai/v1`. Necesita una API key de xAI. Usa Grok Imagine para la generación de imágenes.

## Venice.ai

Servicio en la nube con la Base URL predeterminada `https://api.venice.ai/api/v1`. Necesita una API key de Venice. Usa **Fetch Models from API** para cargar los modelos de imagen disponibles en tu cuenta. Marinara usa el endpoint de imagen nativo de Venice, desactiva el desenfoque opcional del modo seguro de Venice, y asigna automáticamente las dimensiones solicitadas al formato de tamaño de cada modelo por píxel, relación de aspecto o nivel de resolución. La política del proveedor o los límites del modelo aún pueden rechazar una solicitud.

## Z.AI

Servicio en la nube con la Base URL predeterminada `https://api.z.ai/api/paas/v4`. Necesita una API key general de Z.AI; las claves del GLM Coding Plan y el endpoint `/api/coding/paas/v4` no son válidos para la generación de imágenes. Usa **Fetch Models from API** para elegir **GLM-Image** o **CogView 4**. Marinara asigna la relación de aspecto solicitada a un tamaño compatible con el modelo seleccionado, envía la solicitud al endpoint de imagen nativo de Z.AI y descarga la URL de resultado temporal al almacenamiento local. Esta primera versión es solo de texto a imagen y no envía imágenes de referencia.

## Atlas Cloud

Servicio en la nube con la Base URL predeterminada `https://api.atlascloud.ai/api/v1`. Necesita una API key de Atlas Cloud. Marinara aporta un pequeño catálogo inicial para Nano Banana, Gemini Flash Image y FLUX 1.1 Pro, y puedes escribir otro ID de modelo de imagen exacto de Atlas Cloud. Los trabajos se ejecutan de forma asíncrona, así que Marinara inicia la generación y consulta a Atlas Cloud hasta que la imagen está lista. Los controles comunes de texto a imagen se asignan automáticamente; las imágenes de referencia se envían para los ID de modelo que anuncian comportamiento de imagen a imagen, edición o Kontext. Como los esquemas de los modelos de Atlas pueden diferir, revisa la documentación de Atlas Cloud del modelo seleccionado cuando uses otro ID de modelo.

## NanoGPT

Servicio en la nube con la Base URL predeterminada `https://nano-gpt.com/api/v1`. Necesita una API key de NanoGPT. NanoGPT es un agregador, así que usa **Fetch Models from API** para cargar su lista de modelos.

## Block Entropy

Servicio en la nube con la Base URL predeterminada `https://api.blockentropy.ai`. Necesita una API key. Marinara no tiene un manejador dedicado para Block Entropy, así que envía las solicitudes en el formato compatible con OpenAI. Su compatibilidad real no está confirmada, así que pruébalo con **Test Image** antes de depender de él.

## RunPod Serverless (ComfyUI)

Servicio en la nube con la Base URL predeterminada `https://api.runpod.ai/v2`. Ejecuta un flujo de trabajo de ComfyUI en un endpoint serverless de RunPod. Necesita tres cosas: tu token de API de RunPod como **API Key**, un **RunPod Endpoint ID** y un JSON de **ComfyUI Workflow**. Consulta la sección del flujo de trabajo de ComfyUI más abajo.

## Pollinations

Servicio en la nube gratuito con la Base URL predeterminada `https://image.pollinations.ai`. No necesita cuenta ni API key. Es la forma más rápida de probar la generación de imágenes.

## Stable Horde

Servicio en la nube gratuito con la Base URL predeterminada `https://stablehorde.net/api/v2`. Es una red de colaboración colectiva. Una API key es opcional. Una clave gratuita te da mayor prioridad en la cola.

## SD Web UI (AUTOMATIC1111 / Forge)

Servicio local con la Base URL predeterminada `http://localhost:7860`. Se comunica con una Stable Diffusion Web UI que se ejecuta en tu propia computadora. Debes iniciar ese software con su interfaz de aplicación activada. No se necesita API key.

## ComfyUI

Servicio local con la Base URL predeterminada `http://127.0.0.1:8188`. Se comunica con un servidor de ComfyUI que se ejecuta en tu propia computadora. Admite un flujo de trabajo personalizado, descrito más abajo. No se necesita API key.

## Draw Things

Servicio local con la Base URL predeterminada `http://localhost:7860`. Se comunica con la app Draw Things en macOS o iOS. Marinara lo trata como un servidor AUTOMATIC1111. No se necesita API key.

## Servicios locales en tu red

La palabra `localhost` (también llamada loopback) significa la misma computadora que ejecuta Marinara. Los servidores de imágenes locales en esa misma computadora funcionan sin configuración adicional.

Si tu servidor de imágenes se ejecuta en una computadora diferente de tu red doméstica, debes permitir las direcciones de red local en la configuración del servidor. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md) para saber cómo hacerlo.

Cuando un proveedor devuelve una URL en lugar de los bytes de la imagen, Marinara descarga las URL públicas de CDN pasando por sus comprobaciones de seguridad habituales para solicitudes salientes. Una URL de resultado privada o de loopback solo se acepta si su esquema, su nombre de host y su puerto coinciden exactamente con los del proveedor de imágenes configurado. Las redirecciones desde ese origen privado no pueden saltar a otro servicio local. Si un proxy local guarda los resultados en un origen privado distinto, configura el proxy para que sirva esos archivos a través del mismo origen que su API de imágenes.

## JSON del flujo de trabajo de ComfyUI y RunPod

Para **ComfyUI** y **RunPod Serverless (ComfyUI)**, aparece un campo **ComfyUI Workflow**. Pega un JSON de flujo de trabajo que hayas exportado desde ComfyUI con **Save (API Format)**, **Export (API)** o **Export to API**, según la versión del frontend. El campo está marcado como Optional (Opcional) para **ComfyUI** y Required (Obligatorio) para **RunPod Serverless (ComfyUI)**.

Marinara rellena tu flujo de trabajo usando marcadores de posición. Pon estos marcadores de texto en tu flujo de trabajo donde deba ir el valor.

- `%prompt%` y `%negative_prompt%` para los prompts.
- `%width%`, `%height%` y `%seed%` para el tamaño de la imagen y la semilla.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` y `%denoise%` para los ajustes de generación.
- `%reference_image%` y de `%reference_image_01%` a `%reference_image_04%` para inyectar datos de imagen de referencia.
- `%reference_image_name%` y de `%reference_image_name_01%` a `%reference_image_name_04%` para subir imágenes de referencia e inyectar sus nombres de archivo para un nodo LoadImage de ComfyUI local.

El marcador de posición `%prompt%` es el importante. El editor te avisa si falta. Para **ComfyUI**, dejar el campo vacío usa un flujo de trabajo predeterminado incorporado. Para **RunPod Serverless (ComfyUI)**, el flujo de trabajo es obligatorio porque el endpoint no tiene predeterminado. Ambos aceptan hasta 4 imágenes de referencia en base64 sin procesar; los marcadores de posición de subida por nombre de archivo solo están disponibles para ComfyUI local.

Consulta [Configuración del flujo de trabajo de ComfyUI](comfyui.md) para el proceso de exportación completo, ejemplos de JSON, reglas de comillas para marcadores de posición, configuración de imágenes de referencia, flujos de trabajo específicos por personaje, acceso por LAN y solución de problemas.

## Valores predeterminados de imagen local por conexión

Cuando tu servicio es **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI** o **Draw Things**, aparece un panel **Local Image Defaults** (Valores predeterminados de imagen local) en la conexión. Para **Draw Things**, el panel muestra los mismos campos y valores predeterminados que **SD Web UI (AUTOMATIC1111 / Forge)**. Estos ajustes solo se aplican cuando esta conexión genera una imagen. Un botón **Reset** (Restablecer) restaura los valores incorporados.

Cada uno de estos cuatro servicios muestra un campo **Seed** (Semilla). Un valor de -1 mantiene cada imagen aleatoria. Cualquier otro número reutiliza exactamente la misma semilla cada vez.

Los demás campos dependen del servicio.

| Servicio | Campo | Predeterminado |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG Scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2Img Denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG Scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt Guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise Schedule | karras |

Cada servicio también tiene campos de texto **Prompt Prefix** y **Negative Prefix**. El texto que pongas ahí se añade al principio de cada prompt en esta conexión. Tanto AUTOMATIC1111 / Forge como ComfyUI tienen un campo **Clip Skip**. AUTOMATIC1111 / Forge añade un interruptor **Restore faces**. ComfyUI añade un interruptor llamado **Upload a 1x1 placeholder when no reference image is provided**. Solo importa para flujos de trabajo personalizados con marcadores de posición de imagen de referencia. NovelAI añade campos **Guidance Rescale** y **UC Preset**.

## La compatibilidad con imágenes de referencia varía según el proveedor

Una **imagen de referencia** es una imagen existente que envías junto con tu prompt. Ayuda a que la imagen nueva conserve el rostro de un personaje o un estilo artístico. Los proveedores difieren en cuántas aceptan.

| Proveedor | Imágenes de referencia |
| --- | --- |
| OpenAI (DALL-E) | Hasta 16 |
| NovelAI | Hasta 16, solo modelo V4.5 |
| xAI / Grok Imagine | Hasta 3 |
| Venice.ai | No compatible con la generación de texto a imagen |
| Z.AI | No compatible en la integración actual de texto a imagen |
| Atlas Cloud | Primera imagen para ID de modelo compatibles de imagen a imagen, edición o Kontext |
| NanoGPT | Hasta 3 |
| Stability AI | Solo la primera imagen, usada como imagen a imagen |
| OpenRouter Images | Compatible, sin límite fijo |
| ComfyUI y RunPod Serverless (ComfyUI) | Hasta 4, mediante marcadores de posición del flujo de trabajo |
| Together AI, Pollinations, Stable Horde | No compatible |

Las imágenes de referencia precisas de NovelAI solo funcionan en un modelo V4.5, como `nai-diffusion-4-5-full`. NovelAI todavía no ha publicado Precise Reference para V5. Si solicitas referencias en otro modelo, Marinara genera la imagen sin ellas y registra una advertencia en el log del servidor.

## Poner en cola las solicitudes de generación de imágenes

El interruptor **Queue image generation requests** vive en **Settings** (Configuración), luego **Generations** (Generaciones), luego **Image Generation** (Generación de imágenes). Está activado de forma predeterminada.

Cuando está activado, Marinara envía los trabajos de imagen de uno en uno. Mantenlo activado para los servicios que rechazan dos solicitudes a la vez. Desactívalo solo si tu servicio maneja muchas solicitudes al mismo tiempo y quieres que sean más rápidas.

## Guías relacionadas

- [Configuración del flujo de trabajo de ComfyUI](comfyui.md) explica paso a paso el JSON de flujo de trabajo local personalizado y de RunPod.
- [Agente ilustrador](illustrator-agent.md) configura las ilustraciones de escena automáticas.
- [Perfiles de estilo de imagen](style-profiles.md) da forma al aspecto de cada imagen generada.
- [Fondos de escena y la galería](scene-backgrounds.md) cubre los fondos de escena generados.
- [Selfies](../conversation/selfies.md) es el comando de selfie del personaje en el modo Conversation.
- [Proveedores de IA compatibles](../connections/providers-reference.md) enumera todos los proveedores de chat, imagen y video.
