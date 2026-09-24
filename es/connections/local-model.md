# Configuración del Local Model

Esta guía explica el **Local Model** (modelo local) integrado, un pequeño modelo de IA que Marinara Engine descarga y ejecuta en tu propia máquina. No necesita ninguna API key (clave de API) ni una cuenta en línea. Esta guía cubre la configuración, los **Runtime Settings** (Ajustes de ejecución) y cómo el Local Model impulsa ayudantes como los trackers (agentes de seguimiento), los efectos de escena en el Game Mode y la transcripción de llamadas sin conexión.

## Qué es el Local Model

El **Local Model** es un modelo de lenguaje compacto (Gemma) que se ejecuta por completo en tu computadora. Una API key es un código secreto que permite a Marinara comunicarse con un servicio de IA en línea. El Local Model no necesita ninguna API key, porque nada sale de tu máquina.

El Local Model es pequeño a propósito. Está pensado para trabajo de ayudante en segundo plano, no para tu chat o tu roleplay principal. Marinara lo usa para estas tareas:

- Trackers en el modo Roleplay.
- Efectos de escena en el Game Mode, como fondos, música y clima.
- Embeddings (representación numérica del texto) de lorebooks para la búsqueda semántica.
- Transcripción del micrófono en las llamadas de Conversation, a través de un modelo de voz aparte.

- Responder preguntas de activación y declaraciones de decisión, si lo eliges como tu Decision model. Consulta [Modelos de decisión](decision-models.md).
La ventana de configuración lo llama **Local AI Model**. Los menús desplegables de conexión lo llaman **Local Model (sidecar)**. Son la misma función.

No deberías usar el Local Model para el chat principal, el roleplay, la narración del Game Master ni las ediciones de Professor Mari. Es demasiado pequeño para dar buenos resultados ahí. Usa una conexión más potente para esas tareas. Consulta [Conectarse a un proveedor de IA](connecting-to-a-provider.md).

## Abrir la tarjeta del Local Model

El Local Model vive en el panel **Connections** (Conexiones).

1. Abre el panel **Connections**.
2. Busca la tarjeta titulada **Local Model**.
3. Haz clic en la tarjeta, o haz clic en su botón de engranaje titulado **Open local model settings**.

El botón de engranaje abre la ventana de configuración completa titulada **Local AI Model**. Si aún no hay ningún modelo descargado, la tarjeta también muestra un botón **Download now** y un botón **Choose model options**. Ambos abren la misma ventana de configuración.

Dentro de la ventana de configuración verás un recuadro de aviso titulado **Local Model is for helpers, not main roleplay**. Este repite que el modelo es solo para tareas de ayudante.

## Compatibilidad de hardware y sistema operativo

El Local Model descarga un runtime (el programa que ejecuta el modelo) y un archivo de modelo. Tu computadora necesita suficiente espacio libre en disco y memoria (RAM) para ambos.

La compatibilidad depende de tu sistema operativo:

- **Windows (64-bit) y Linux (64-bit)**: obtienes un selector **Runtime Target** completo, así que puedes elegir la familia de tu tarjeta gráfica (GPU) o ejecutar solo en el procesador (CPU).
- **Windows en ARM y Linux en ARM**: un conjunto reducido de opciones, casi todas basadas en CPU.
- **macOS en Apple Silicon**: Marinara usa el runtime MLX, optimizado para los chips de Apple. Los modelos personalizados son repositorios de HuggingFace en lugar de archivos sueltos.
- **macOS en Intel y Android**: en la práctica, solo CPU.

El Local Model no está disponible en las instalaciones "Lite". Una instalación Lite es una versión reducida que deja fuera el runtime local para ahorrar espacio. En una instalación Lite, la tarjeta del Local Model no aparece.

## Configuración inicial

Configura primero el runtime, luego elige un modelo.

1. Abre la ventana de configuración **Local AI Model**.
2. Haz clic en **Install Runtime**. En Apple Silicon este botón dice **Install MLX Runtime**.
3. Espera a que el runtime termine de instalarse. Una barra de progreso muestra la descarga.
4. Elige un modelo en la sección **Downloading a model** más abajo.
5. Espera a que termine la descarga del modelo.
6. Cuando el estado diga **Ready**, haz clic en **Done**.

Si aún no quieres terminar, haz clic en **Skip for Now**. Una vez que exista un modelo, ese botón dice **Close** en su lugar.

Instalar o reinstalar el runtime es una acción protegida. En las instalaciones de un clic de Windows se activa por ti automáticamente. En macOS, Linux y Docker puede que necesites permitirlo. Consulta la sección **Troubleshooting** (Solución de problemas) más abajo.

Marinara solo descarga las versiones de llama.cpp, MLX y uv aprobadas para tu versión del Engine. Verifica el tamaño exacto del archivo y la suma de verificación SHA-256 antes de extraer o ejecutar cualquier cosa. El conjunto de dependencias de Python de MLX también tiene la versión fijada y el hash verificado antes de instalar el código revisado de mlx-lm sin resolver paquetes extra. Por eso las actualizaciones del runtime llegan mediante actualizaciones revisadas de Marinara, y no siguiendo en silencio una compilación "latest" de origen.

## Descargar un modelo

La ventana de configuración ofrece dos maneras de obtener un modelo.

### Presets seleccionados

En **Curated Gemma 4 Presets** eliges una de dos opciones ya listas. En hardware que no es de Apple, estas usan el formato GGUF:

| Preset | Tamaño de descarga | RAM en ejecución |
| --- | --- | --- |
| Q8 (Best Quality) | unos 5.4 GB | unos 5.8 GB |
| Q4_K_M (Smaller, Faster) | unos 3.2 GB | unos 3.6 GB |

La opción Q8 lleva la etiqueta **Recommended**. Da la mejor calidad. La opción Q4_K_M es más pequeña y rápida, y usa menos memoria.

En Apple Silicon estas se convierten en presets MLX. El preset MLX de 8 bits necesita unos 5.9 GB de descarga y unos 7.5 GB de RAM. El preset MLX de 4 bits necesita unos 3.6 GB de descarga y unos 4.8 GB de RAM.

Para descargar un preset:

1. Selecciona el preset que quieras.
2. Haz clic en **Use Curated Preset**. Si ya tienes un modelo, este botón dice **Switch to Curated Preset**.

### Usa tu propio modelo

En **Use Your Own Model From HuggingFace** puedes aportar tu propio modelo desde HuggingFace, un sitio público para compartir modelos.

1. Escribe el nombre del repositorio en el campo. El formato es `owner/repo`.
2. Haz clic en **List Models**. En Apple Silicon este botón dice **Validate Repo**.
3. En hardware que no es de Apple, elige un archivo específico del menú desplegable y luego haz clic en **Download Selected GGUF**.
4. En Apple Silicon, una vez validado el repositorio, haz clic en **Use Validated MLX Repo**.

Marinara guarda un solo archivo de Local Model en disco a la vez. Descargar un modelo nuevo borra el anterior primero. No hay un botón de borrado aparte para el Local Model principal. Para quitarlo, descarga un modelo distinto encima.

## Referencia de Runtime Settings

Abre la sección **Runtime Settings** dentro de la ventana de configuración para afinar cómo se ejecuta el modelo. Los campos se guardan de distintas formas:

- Los menús desplegables y el interruptor **Native Tool Calls** se guardan en cuanto los cambias.
- **Context Window**, **Max Response Tokens**, **Temperature**, **Top P** y **Top K** surten efecto solo cuando haces clic en **Apply Settings**.
- **Physical Batch Size** tiene su propio botón **Apply**. También lo tiene el campo de número de capas que aparece cuando **GPU Offload** se ajusta a **Custom GPU layers**.

| Ajuste | Predeterminado | Qué controla |
| --- | --- | --- |
| Runtime Target | Auto detect | Para qué familia de GPU instala Marinara |
| GPU Offload | Auto offload | Cuánto trabajo va a la GPU |
| Native Tool Calls | On | Permite al modelo usar herramientas y llamadas a funciones |
| Pooling Type | None | Cálculo de embeddings para la búsqueda de lorebooks |
| Physical Batch Size | 512 | Tamaño de lote para las peticiones de embedding de lorebooks |
| Context Window | 8192 | Cuánto texto puede leer el modelo a la vez |
| Max Response Tokens | 4096 | La respuesta más larga que el modelo puede escribir |
| Temperature | 0.3 | Qué tan aleatorias son las respuestas |
| Top P | 0.95 | Un límite de muestreo para la elección de palabras |
| Top K | 64 | Un límite de muestreo para la elección de palabras |

Notas sobre los campos más complicados:

- **Runtime Target** y **GPU Offload** aparecen solo en el runtime GGUF. En Apple Silicon, MLX elige el acelerador por ti.
- **Pooling Type** y **Physical Batch Size** también aparecen solo en el runtime GGUF, bajo el encabezado **Embedding Endpoint**. Solo afinan los embeddings de lorebooks. No cambian las respuestas normales del chat.
- **Pooling Type** viene en **None** de forma predeterminada. Cámbialo a **Mean** cuando uses el Local Model para embeddings de lorebooks.
- **Physical Batch Size** define cuánto texto toma el embedding endpoint en un lote. Súbelo cuando las entradas largas de lorebook no logren vectorizarse. La app sugiere 1024 para Gemma.
- **Native Tool Calls** debe estar activado para que las herramientas funcionen. El aviso dice que Professor Mari y los agentes personalizados necesitan esto activado antes de que el modelo local pueda ejecutar herramientas. Esta opción no está disponible en el runtime MLX.
- **Max Response Tokens** limita las respuestas normales del chat y de los agentes. No limita el análisis de escena del Game Mode, que tiene su propio límite interno.

## Send Test Message

Usa **Send Test Message** para comprobar que el runtime funciona. Este botón está en la sección Runtime. Está desactivado hasta que se descarga un modelo y se instala el runtime.

1. Haz clic en **Send Test Message**.
2. Espera el recuadro de resultado.
3. Un recuadro de éxito dice **Local Test Message Succeeded** con el tiempo de ida y vuelta.
4. Un recuadro de fallo dice **Local Test Message Failed** con el error.

La prueba usa un prompt (instrucciones enviadas a la IA) fijo. Ignora tus ajustes de Temperature y de tokens, así que es una comprobación limpia de si el modelo responde.

## Usar el Local Model para ayudantes

Una vez descargado un modelo, la tarjeta del Local Model muestra dos interruptores:

- **Use for tracker agents (roleplay)**. Está desactivado de forma predeterminada.
- **Use for game scene analysis**. Está activado de forma predeterminada.

Estos dos interruptores deciden si Marinara mantiene el Local Model en ejecución en segundo plano. Si ambos están desactivados, el runtime no se inicia por sí solo. Activar cualquiera de los dos hace que Marinara inicie el servidor local automáticamente. El primer arranque después de activar uno puede tardar un momento.

La tarjeta también tiene un botón **Use local model for all tracker agents**. Apunta cada tracker integrado al Local Model con un solo clic. Una línea debajo muestra cuántos trackers apuntan al modelo local, por ejemplo "3/7 built-in tracker agents currently point at the local model." Esto solo cambia qué modelo usan los agentes. No activa los agentes. Consulta [Memory Recall y resúmenes de chat](../agents/memory.md) y la guía de tu modo para activar agentes.

En el Game Mode también puedes enrutar el trabajo de escena a través del Local Model. En la configuración de Game, el menú desplegable **Scene Effects Connection** ofrece **Local Model (Gemma)**. Elegirlo activa el interruptor **Use for game scene analysis**. Consulta [Game Mode: primeros pasos](../game/getting-started.md).

### El Local Model para embeddings de lorebooks

Puedes usar el Local Model para impulsar la búsqueda semántica de lorebooks. En los controles de vectorización de un lorebook, elige **Local Model (sidecar)** como la conexión. Esto necesita que **Use for tracker agents (roleplay)** o **Use for game scene analysis** esté activado primero. Si ambos están desactivados, la petición falla con un mensaje que indica que el modelo local debe estar activado para los trackers o el análisis de escena del juego. Esta ruta usa el runtime GGUF y no está disponible en el MLX de Apple Silicon. Consulta [Búsqueda semántica para lorebooks](../lorebooks/semantic-search.md).

## Usar el Local Model como conexión de chat

Una vez descargado un modelo, el Local Model aparece al final de la mayoría de los selectores de conexión. Se muestra como **Local Model (sidecar)**, o como **Local Model** con el nombre del modelo entre paréntesis cuando se conoce un nombre.

Si lo eliges para un chat normal, aparece un aviso. Dice que el Local Model es diminuto y está pensado para ayudantes. También advierte que las respuestas del chat principal y del roleplay pueden ser lentas, cortas o de baja calidad. Esta entrada no es una conexión guardada real, así que no puedes guardar valores predeterminados de conexión para ella.

Elegirlo para un chat inicia el servidor local bajo demanda, incluso cuando ambos interruptores de ayudante están desactivados. El menú desplegable de modelo principal del Game Mode no lo incluye. El Game Mode usa el Local Model solo a través de **Scene Effects Connection**.

## Local Speech Model para llamadas

El **Local Speech Model** es una descarga opcional de Calls para la transcripción del micrófono sin conexión. Impulsa las llamadas de Conversation cuando eliges transcribir tu voz en tu propia máquina. Es un modelo Whisper, un modelo de voz a texto que convierte tus palabras habladas en texto.

Primero instala **Calls** desde **Agents > Download Agents**. Luego puedes gestionar Whisper desde la tarjeta **Local Model** en Connections, bajo el encabezado **Local Speech Model**. El encabezado y los controles de descarga permanecen ocultos cuando Calls no está instalado.

Se ofrecen dos opciones:

- **Whisper Tiny (Multilingual)**: unos 180 MB de descarga, unos 350 MB de RAM. La mejor primera opción para teléfonos y máquinas más antiguas.
- **Whisper Base (Multilingual)**: unos 320 MB de descarga, unos 650 MB de RAM. Mejor precisión para habla desordenada, pero más lento al arrancar.

Para configurarlo:

1. Abre la tarjeta **Local Model** y expándela.
2. En **Local Speech Model**, elige un modelo del menú desplegable.
3. Haz clic en **Download Whisper**.
4. Cuando diga **Ready**, ya está configurado.

Para quitar solo el modelo seleccionado, haz clic en el botón de papelera titulado **Delete Local Whisper**. Desinstalar Calls quita todas las opciones de Whisper descargadas y su selección guardada automáticamente para recuperar su espacio en disco. Si reinstalas Calls más tarde, los controles del Local Speech Model regresan y puedes descargar Whisper de nuevo.

Tu audio grabado nunca sale de tu máquina. Solo el texto transcrito se envía a la conexión de chat que elijas. Para usarlo en una llamada, ajusta el modo de entrada de audio de la llamada a la opción Local Whisper. Consulta [Llamadas de audio y video de Conversation](../conversation/calls.md).

## Solución de problemas

**"Sidecar runtime install is disabled."** Instalar o reinstalar el runtime es una acción protegida. Las instalaciones de un clic de Windows lo activan por ti. En macOS, Linux y Docker, tienes dos opciones. Establece `SIDECAR_RUNTIME_INSTALL_ENABLED=true` en el archivo `.env` del servidor, por ejemplo:

```
SIDECAR_RUNTIME_INSTALL_ENABLED=true
```

O introduce tu secreto de Admin Access una vez en **Settings -> Advanced -> Admin Access**, luego inténtalo de nuevo. Consulta [Referencia de configuración del servidor](../CONFIGURATION.md).

**El runtime no logró iniciarse.** La ventana de configuración muestra un recuadro titulado **Local runtime failed to start** con el error y una ruta de archivo de registro. Haz clic en **Retry Startup**. Si eso falla, haz clic en **Reinstall Runtime**, o prueba un **Runtime Target** distinto. Puedes hacer clic en **Continue Without Local AI** para seguir usando Marinara sin el Local Model. La tarjeta de Connections muestra el mismo problema como **Local runtime unavailable**.

**La descarga del runtime informa de una discrepancia de tamaño o de SHA-256.** Marinara descartó la descarga antes de extraerla. Actualiza Marinara primero, luego inténtalo de nuevo para que el manifiesto del runtime aprobado y la descarga coincidan. Si la misma versión sigue fallando, no extraigas ni ejecutes el archivo comprimido a mano; informa del runtime target y del error a los mantenedores.

**La búsqueda de lorebooks dice que el modelo local no está activado.** Activa **Use for tracker agents (roleplay)** o **Use for game scene analysis** en la tarjeta del Local Model, luego intenta la vectorización de nuevo.

**Un aviso del Game Mode dice "Local scene helper failed to start."** Haz clic en **Open Local AI Model** en el aviso para reintentar, cambiar de modelo o desactivar el análisis de escena local.

Para más ayuda, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Guías relacionadas

- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
- [Modelos de decisión](decision-models.md)
- [Conectar un modelo local o autoalojado](local-self-hosted.md)
- [Memory Recall y resúmenes de chat](../agents/memory.md)
- [Llamadas de audio y video de Conversation](../conversation/calls.md)
- [Game Mode: primeros pasos](../game/getting-started.md)
- [Búsqueda semántica para lorebooks](../lorebooks/semantic-search.md)
