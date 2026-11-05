# Configuración del modelo integrado

El **Built-in model** (Modelo integrado) es un pequeño modelo de IA que Marinara descarga y ejecuta en tu propia computadora. No necesita ninguna API key (clave de API) ni una cuenta en línea, y nada sale de tu computadora.

Es pequeño, así que sirve para el trabajo de ayudante en segundo plano: los agentes de seguimiento (ayudantes que llevan la cuenta de los detalles de la historia), los efectos de escena del Game Mode, los embeddings de los lorebooks (libros de trasfondo) y las comprobaciones de decisión. Es demasiado débil para un buen roleplay o para las ediciones de Professor Mari. Para eso, usa una cuenta más potente. Consulta [Conectarse a un proveedor de IA](connecting-to-a-provider.md).

Si falta la tarjeta **Built-in model**, tienes una instalación "Lite", una versión reducida sin el runtime local.

## Descargar el modelo integrado

Antes de empezar, asegúrate de tener suficiente espacio libre en disco y memoria (RAM) para el modelo. Los tamaños están en la tabla de abajo.

1. Haz clic en **Connections** (Conexiones) en la barra superior.
2. Busca la tarjeta **Built-in model** debajo del cuadro **Jobs** (Tareas). Dice **Not downloaded**.
3. Haz clic en la tarjeta o en su botón **Download** (Descargar). Se abre una ventana titulada **Built-in model**.
4. En **Which model?** (¿Qué modelo?), elige un modelo. **Gemma 4 E2B — Q8 (Best Quality)** lleva la etiqueta **Recommended** (Recomendado). Si tu computadora tiene poca memoria, elige **Q4_K_M**. Necesita unos 3,4 GB de RAM en lugar de 5,4 GB.
5. Haz clic en el botón **Download** de la parte inferior. Muestra el tamaño del modelo, por ejemplo **Download 5.0 GB**.
6. Espera. La ventana muestra tres pasos: **Install runtime** (Instalar el runtime), **Download model** (Descargar el modelo) y **Start and test** (Iniciar y probar). Un runtime es el programa que ejecuta el modelo. Marinara lo instala primero cuando falta.
7. Cuando la ventana muestre el nombre del modelo con un punto verde, haz clic en **Test** (Probar). Un recuadro titulado **Local test message** (Mensaje de prueba local) dice **Succeeded** y muestra cuánto tardó la respuesta.
8. Haz clic en **Done** (Listo).

Ahora la tarjeta dice **Ready**, con el tamaño del modelo y las tareas que hace.

Si no funcionó:

- **Sidecar runtime install is disabled** (un mensaje de error). Instalar el runtime es una acción protegida. Consulta [Permitir la instalación del runtime](#allow-runtime-installs).
- **Local runtime failed to start.** Consulta [Solución de problemas](#troubleshooting).
- **Download failed.** La ventana muestra el error. Comprueba tu conexión a internet y el espacio libre en disco, y luego vuelve a hacer clic en el botón de descarga.

También puedes llegar a esta ventana desde **Add** (Añadir) en el panel **Connections**, en **Built-in model** dentro de la ventana **Add account** (Añadir cuenta).

### Presets seleccionados

La ventana ofrece dos presets (ajustes guardados) ya listos de Gemma 4 E2B, un modelo pequeño de Google. Las computadoras con Apple Silicon reciben versiones MLX en lugar de archivos GGUF. GGUF y MLX son dos formatos de archivo para modelos locales. Los tamaños de abajo son los que muestra la ventana (en GB, donde 1 GB son 1024 × 1024 × 1024 bytes).

| Preset | Descarga | RAM en ejecución |
| --- | --- | --- |
| Q8 (Best Quality) | 5,0 GB | 5,4 GB |
| Q4_K_M (Smaller, Faster) | 3,0 GB | 3,4 GB |

En su lugar, Apple Silicon muestra dos presets MLX:

| Preset | Descarga | RAM en ejecución |
| --- | --- | --- |
| 8-bit MLX (Best Quality) | 5,5 GB | 7,0 GB |
| 4-bit MLX (Smaller, Faster) | 3,4 GB | 4,5 GB |

Marinara guarda un solo modelo integrado en disco a la vez. Elegir otro modelo reemplaza el primero. Para cambiarlo más tarde, abre la tarjeta y haz clic en **Change model** (Cambiar modelo) en la ventana **Built-in model**. En la página de la tarjeta, los botones junto a **Model** (Modelo) cambian entre los presets y antes te piden que confirmes el tamaño de la descarga.

### Usar tu propio modelo

En **Your own model** (Tu propio modelo) puedes usar un modelo GGUF de Hugging Face (un sitio público para compartir modelos) o un archivo de la computadora que ejecuta Marinara.

1. Haz clic en **Your own model** y luego elige una pestaña: **Hugging Face** o **File on the server** (Archivo en el servidor).
2. En **Hugging Face**, escribe el nombre del repositorio como `owner/repo` y luego haz clic en **Find files** (Buscar archivos). Elige un archivo de la lista.
3. En **File on the server**, escribe la ruta completa al archivo `.gguf`. Marinara usa el archivo donde está y no lo copia.
4. Haz clic en el botón de la parte inferior: **Download** o, para un archivo en el servidor, **Use this file** (Usar este archivo).

En Apple Silicon, **Find files** dice **Validate repo** (Validar el repositorio), y el repositorio debe ser nativo de MLX. Un archivo GGUF en el servidor sigue funcionando ahí y usa llama.cpp en lugar de MLX.

## Usar el modelo integrado para tareas de ayudante

Abre la tarjeta **Built-in model** cuando el modelo esté descargado. Su página muestra su estado, el uso de memoria y **Used by** (Lo usa), y tiene estos controles:

| Control | Qué hace |
| --- | --- |
| **Use for tracker agents (roleplay)** | Mantiene el modelo en ejecución para los agentes de seguimiento. Desactivado de forma predeterminada. |
| **Use for game scene analysis** | Lo mantiene en ejecución para los efectos de escena del Game Mode, como fondos, música y clima. Activado de forma predeterminada. |
| **Use the built-in model for all tracker agents** | Apunta todos los agentes de seguimiento integrados a este modelo. No activa los agentes. |
| **Change in Defaults** | Abre el cuadro **Jobs**, donde puedes darle otras tareas. |

Si ambos interruptores están desactivados, el modelo no se inicia por sí solo. Se inicia cuando activas uno, o cuando un chat o una tarea lo usa. Consulta [Memory Recall y resúmenes de chat](../agents/memory.md) para activar agentes.

En la configuración del Game Mode, **Scene effects model** (Modelo de efectos de escena) puede usar el modelo integrado. Consulta [Game Mode: primeros pasos](../game/getting-started.md).

### Embeddings de lorebooks

Los embeddings son números que permiten que un lorebook busque por significado. Para usar el modelo integrado con ellos, elige **Built-in model (on this device)** (Modelo integrado: en este dispositivo) como modelo de vectorización del lorebook. Activa primero **Use for tracker agents (roleplay)** o **Use for game scene analysis**, o la solicitud falla. Esta ruta necesita el runtime GGUF, así que no funciona con MLX en Apple Silicon. Consulta [Búsqueda semántica para lorebooks](../lorebooks/semantic-search.md).

### Modelo de decisión

También puedes elegir el modelo integrado como tu Decision model (modelo de decisión). Consulta [Modelos de decisión](decision-models.md).

### Modelo de chat

Para chatear con el modelo integrado:

1. Abre un chat y haz clic en el botón de modelo de la entrada del chat (el icono de enlace).
2. En **Model for this chat** (Modelo para este chat), elige **Built-in model (on this device)**. Está al final de la lista y aparece cuando el modelo ya está descargado.
3. Envía un mensaje. Un aviso dice que el modelo es pequeño, así que las respuestas pueden ser lentas, cortas o de baja calidad.

## Ajustes del runtime

Para abrirlos, haz clic en **Runtime settings** (Ajustes del runtime) en la página de la tarjeta, o haz clic en **Settings** (Configuración) en la ventana **Built-in model**. Están en cuatro grupos. Los menús desplegables y los interruptores se guardan al instante. Los campos numéricos se guardan cuando haces clic en **Apply settings** (Aplicar los ajustes). **Physical batch size** y **Custom GPU layers** tienen cada uno su propio botón **Apply** (Aplicar).

**Speed** (Velocidad)

| Ajuste | Predeterminado | Qué hace |
| --- | --- | --- |
| **Runtime target** | Auto detect | Para qué familia de tarjetas gráficas instala Marinara. |
| **GPU offload** | Auto offload | Cuánto trabajo va a la tarjeta gráfica. Elige **Auto offload**, **CPU only** o **Custom GPU layers** (de 1 a 1024). |

**Memory** (Memoria)

| Ajuste | Predeterminado | Qué hace |
| --- | --- | --- |
| **Context window** | 8192 | Cuánto texto lee el modelo a la vez, en tokens (fragmentos de texto). 512 o más. |
| **KV cache type** | f16 | Cómo guarda el modelo lo que ha leído. Elige f16, q8_0 o q4_0. Los dos últimos usan menos memoria y necesitan compatibilidad con Flash Attention. |

**Replies** (Respuestas)

| Ajuste | Predeterminado | Qué hace |
| --- | --- | --- |
| **Max response tokens** | 4096 | La respuesta más larga que el modelo puede escribir. 64 o más. |
| **Temperature** | 0.3 | Qué tan aleatorias son las respuestas. De 0 a 2. |
| **Top P** | 0.95 | Un límite en la elección de palabras. Mayor que 0, hasta 1. |
| **Top K** | 64 | Un límite en la elección de palabras. De 0 a 500. |

**Expert** (Experto)

| Ajuste | Predeterminado | Qué hace |
| --- | --- | --- |
| **Native tool calls** | Activado | Permite que el modelo use herramientas. Professor Mari y los agentes personalizados lo necesitan activado. |
| **Max parallel agent jobs** | 2 | Cuántas tareas se ejecutan a la vez. De 1 a 16. |
| **Pooling type** | None | Cómo convierte el modelo el texto en números para la búsqueda en lorebooks. Elige **Mean** para los embeddings de lorebooks. |
| **Physical batch size** | 512 | Texto por lote de embeddings de lorebooks. De 128 a 32.768. Súbelo cuando fallen las entradas largas. Gemma suele funcionar con 1024. |

Algunos ajustes cambian según el sistema:

- **Runtime target** en Windows y Linux (x64) ofrece Auto detect, NVIDIA GPU, AMD GPU, Intel GPU, Vulkan GPU, CPU only y System llama-server. Los demás sistemas ofrecen menos opciones.
- En Apple Silicon, MLX elige el acelerador por ti. **Runtime target**, **GPU offload**, **KV cache type**, **Native tool calls**, **Pooling type** y **Physical batch size** no aparecen.
- **Max response tokens** no limita el análisis de escena del Game Mode, que tiene su propio tope.
- **Diagnostics** (Diagnóstico), en **Expert**, muestra la compilación del runtime, la tarjeta gráfica detectada y el último comando de inicio.

<a id="allow-runtime-installs"></a>

### Permitir la instalación del runtime

Instalar o reinstalar el runtime es una acción protegida. Las instalaciones de un clic de Windows lo permiten por ti. En macOS, Linux y Docker, haz una de estas cosas y luego inténtalo de nuevo:

- Introduce el secreto de administrador en **Settings → Advanced → Admin Access** (Configuración → Avanzado → Acceso de administrador). El secreto de administrador es una segunda contraseña para las acciones de riesgo. Lo creas en **Admin Access** en la propia computadora del servidor, o lo defines como `ADMIN_SECRET` en el archivo `.env` del servidor. Consulta [Acceso de administrador](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).
- Añade `SIDECAR_RUNTIME_INSTALL_ENABLED=true` al archivo `.env` del servidor y luego reinicia Marinara. El archivo `.env` es un archivo de texto en la carpeta de Marinara. Consulta [Editar el archivo .env](../CONFIGURATION.md#edit-the-env-file).

Marinara solo descarga las versiones de llama.cpp, MLX y uv aprobadas para tu versión, y comprueba el tamaño y la suma de verificación SHA-256 de cada archivo antes de ejecutar nada.

## Modelo de voz local

El **Local speech model** (Modelo de voz local) convierte tu voz en texto en tu propia computadora para las llamadas de Conversation. Es un modelo Whisper, un modelo de voz a texto. Necesita el paquete de agente **Calls**, que instalas en **Agents → Agent Organizer** (Agentes → Organizador de agentes).

1. Abre el panel **Connections** y haz clic en el elemento **Speech to text** (Voz a texto) en **On this device** (En este dispositivo).
2. En **Local speech model**, elige un modelo del menú desplegable.
3. Haz clic en **Download Whisper** (Descargar Whisper).
4. Espera a que diga **Ready**. Reinicia Marinara por completo antes de usar Calls.

| Modelo | Descarga | RAM en ejecución |
| --- | --- | --- |
| Whisper Tiny (Multilingual) | unos 180 MB | unos 350 MB |
| Whisper Base (Multilingual) | unos 320 MB | unos 650 MB |

Tiny es la mejor primera opción para teléfonos y computadoras más antiguas. Base es más preciso con el habla desordenada, pero tarda más en arrancar. Haz clic en **Delete Local Whisper** (Borrar Local Whisper; el botón de papelera) para quitar el modelo descargado. Desinstalar Calls también lo quita.

Tu audio se queda en tu computadora. Solo el texto va a tu modelo de chat. Para usarlo en una llamada, ajusta la entrada de audio de la llamada a Local Whisper. Consulta [Llamadas de audio y video de Conversation](../conversation/calls.md). Si en su lugar activas el servidor **Speech to text**, las llamadas envían tu voz allí. Consulta [Usar tu propio servidor de voz a texto](../conversation/calls.md#use-your-own-speech-to-text-server).

<a id="troubleshooting"></a>

## Solución de problemas

| Síntoma | Solución |
| --- | --- |
| **Sidecar runtime install is disabled** (un mensaje de error). | Consulta [Permitir la instalación del runtime](#allow-runtime-installs). |
| **Local runtime failed to start.** La ventana muestra el error y la ruta de un archivo de registro. La tarjeta muestra **Local runtime unavailable**. | Haz clic en **Retry startup** (Reintentar el inicio). Si eso falla, haz clic en **Reinstall runtime** (Reinstalar el runtime) o elige otro **Runtime target**. **Continue without local AI** (Continuar sin IA local) desactiva los interruptores de ayudante y mantiene Marinara funcionando sin el modelo. |
| La descarga del runtime informa de una discrepancia de tamaño o de SHA-256. | Marinara desechó el archivo. Actualiza Marinara e inténtalo de nuevo. Si sigue fallando, no abras el archivo tú mismo. Informa del runtime target y del error. |
| La búsqueda de lorebooks dice que el modelo local no está activado. | Activa **Use for tracker agents (roleplay)** o **Use for game scene analysis**, y luego vuelve a vectorizar. |
| Un banner del Game Mode dice **Local scene helper failed to start**. | Haz clic en **Open Local AI Model** en el banner para reintentar, cambiar de modelo o desactivar el análisis de escena local. |

Para más ayuda, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Guías relacionadas

- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
- [Modelos de decisión](decision-models.md)
- [Conectar un modelo local o autoalojado](local-self-hosted.md)
- [Memory Recall y resúmenes de chat](../agents/memory.md)
- [Llamadas de audio y video de Conversation](../conversation/calls.md)
- [Game Mode: primeros pasos](../game/getting-started.md)
- [Búsqueda semántica para lorebooks](../lorebooks/semantic-search.md)
