# Generación de video de escena

Un video de escena es un clip MP4 corto de la escena. Puede animar una imagen de la Gallery, con la imagen como primer fotograma y la IA añadiendo movimiento. En Roleplay también puede crearse solo a partir de la historia. Esta guía muestra cómo configurar un servicio de video, crear clips desde la Gallery y desde Game Mode, y cambiar los ajustes de video.

Los videos de escena funcionan en chats de Roleplay y de Game Mode. Los chats de Conversation envían mensajes de video en su lugar. Consulta [Mensajes de video](../conversation/selfies.md#video-messages).

Game Mode y **Animate illustration** (Animar ilustración) siempre parten de una imagen, así que genera o sube una primero. En Roleplay, `/video` y el botón **Video** de la Gallery siguen el ajuste **First frame** (Primer fotograma) de Illustrator. Sin un First frame elegido, no necesitan ninguna imagen.

Los videos de escena usan un tipo de cuenta aparte, **Video Generation** (Generación de video), no la generación de imágenes normal. Los clips terminados se guardan con el chat y se muestran en la Gallery, donde puedes fijarlos, descargarlos o verlos.

## Configurar un servicio de video

1. Haz clic en **Connections** (Conexiones) en la barra superior y luego en **Add** (Añadir). Se abre la ventana **Add account** (Añadir cuenta).
2. Elige un servicio de la sección **Images & video** (Imágenes y video). Los servicios se enumeran abajo.
3. Pega la API key (clave de API) de un servicio en la nube. La versión local de ComfyUI no necesita ninguna. SwarmUI necesita un Swarm Auth Token solo si tu servidor requiere una cuenta.
4. Haz clic en **Connect** (Conectar) y luego elige un modelo o conserva el predeterminado. NanoGPT no tiene predeterminado, así que elige uno de su lista. Para ComfyUI, deja el modelo sin configurar salvo que el flujo de trabajo use `%model%`. Para SwarmUI, el modelo es opcional.
5. Abre el modelo de video y haz clic en **Test video** (Probar video) para comprobarlo.

Cada servicio rellena una dirección predeterminada y, cuando corresponde, un modelo predeterminado. NanoGPT no tiene modelo predeterminado, así que elige uno.

| Servicio de video | Modelo predeterminado | Notas |
| --- | --- | --- |
| **Google AI Studio** | `gemini-omni-flash-preview` | Ejecuta modelos Gemini Omni y Veo a través de la API de Gemini. |
| **xAI Imagine** | `grok-imagine-video-1.5` | Video de Grok Imagine a través de la API de Videos de xAI. |
| **OpenRouter Video** | `google/veo-3.1` | Puedes escribir cualquier ID de modelo de video de OpenRouter. |
| **NanoGPT** | ninguno, elige uno | Modelos de video a través de NanoGPT. |
| **Atlas Cloud** | `google/veo3.1/text-to-video` | Modelos alojados de texto a video e imagen a video. |
| **Seedance 2.0** | `seedance-2-0` | Modos de texto, primer fotograma, y primer y último fotograma. |
| **ComfyUI** | definido por el flujo de trabajo | Flujos de trabajo de video WAN y otros, locales, en formato API. |
| **SwarmUI** | definido por el flujo de trabajo | Flujos de trabajo de video de ComfyUI a través de tu servidor de SwarmUI. |

**Google AI Studio** cubre dos familias. **Gemini Omni** usa `gemini-omni-flash-preview`. **Google Veo** usa `veo-3.1-generate-preview`. El modelo que elijas decide cuál se ejecuta.

Para **ComfyUI**, usa `http://127.0.0.1:8188` y pega un flujo de trabajo de video en formato API en **ComfyUI workflow (required)** (Flujo de trabajo de ComfyUI: obligatorio). Es obligatorio. Consulta [Configuración del flujo de trabajo de ComfyUI](comfyui.md#comfyui-video-workflows) para ver los marcadores de posición y los nodos de salida.

Para **SwarmUI**, Marinara rellena `http://127.0.0.1:7801`. Pega un flujo de trabajo de video en formato API en **ComfyUI workflow (required)**. Es obligatorio. SwarmUI no puede usar los marcadores de posición `%reference_image_name%`, así que usa `%reference_image%`. Si tu servidor requiere una cuenta, pega un Swarm Auth Token en **API key**.

### Convertirlo en el modelo de video predeterminado

Para usar un modelo de video cuando un chat no tiene uno propio, establece la tarea **Video** en **Defaults** (Valores predeterminados), en la parte superior del panel **Connections**. Chat Settings (Ajustes del chat) lo muestra como **Default video provider** (Proveedor de video predeterminado). Sin un modelo del chat y sin un predeterminado, las acciones de video muestran un aviso para que elijas uno.

### Instrucciones para los prompts de video

Cada modelo de video tiene un cuadro **Video prompting instructions** (Instrucciones para prompts de video). Indícale a la IA que escribe tus prompts de video (las instrucciones enviadas a la IA) lo que espera tu modelo de video, como movimientos de cámara, la longitud del prompt o el sonido. Guía las animaciones de la Gallery de Roleplay, los mensajes de video de Conversation y la **Image-aware shot planning** (Planificación de planos según la imagen) de Storyboard. Si la IA copia una frase completa del cuadro en el prompt, Marinara elimina esa frase. Los videos de escena de Game Mode, los clips de llamada y las expresiones animadas escriben sus prompts por separado y lo ignoran.

### Valores predeterminados de video por modelo

Un modelo de video tiene un panel **Video defaults** (Valores predeterminados de video) para la duración de clip, la relación de aspecto y la resolución predeterminadas. Tienen prioridad sobre la duración de reserva de toda la app.

Duración predeterminada, rango, relación de aspecto y resolución de cada servicio:

- Gemini Omni: 10s, de 1 a 60s, 16:9, resolución predeterminada del proveedor.
- Google Veo: 8s, 4, 6 u 8s, 16:9, 720p.
- xAI Imagine: 10s, de 1 a 15s, 16:9, 720p.
- OpenRouter Video: 10s, de 1 a 60s, 16:9, 720p.
- Atlas Cloud: 8s, de 1 a 60s, 16:9, 720p.
- Seedance 2.0: 5s, de 4 a 15s, 16:9, 720p.
- ComfyUI y SwarmUI: 5s, de 1 a 60s, 16:9, 720p.

Gemini Omni no tiene campo de resolución, y su duración va en el texto del prompt. Google Veo fuerza 8 segundos siempre que anima una imagen de referencia, porque necesita 8 segundos para fusionar el primer y el último fotograma.

<a id="seedance-reference-frames"></a>

### Fotogramas de referencia de Seedance

Seedance debe obtener tu imagen de referencia a través de un enlace web público. Un servidor local de Marinara no tiene ninguno, así que las instalaciones locales simples necesitan un paso extra.

1. Abre el modelo de Seedance.
2. Activa **Upload Seedance reference frames temporarily** (Subir temporalmente los fotogramas de referencia de Seedance). El fotograma va a un enlace público temporal.
3. Opcional: configura **Temporary link lifetime** (Duración del enlace temporal). El valor predeterminado es 12 horas.

Si tu servidor de Marinara ya tiene una dirección pública, puedes configurar una variable de entorno en su lugar. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).

## Crear un video desde la Gallery

Los chats de Roleplay y de Game Mode pueden crear videos de escena desde la Gallery. Abre **Chat Settings** y despliega **Gallery** (Galería). La Gallery tiene una pestaña **Images** (Imágenes) y una pestaña **Videos**, cada una con un contador.

### En Roleplay

**Video**, en la fila de acciones de la parte superior de la Gallery, crea un clip de la respuesta más reciente, igual que `/video`. Añade una descripción después de `/video` para indicar qué debe mostrar el clip.

- **First frame**: sigue el ajuste **First frame** de Illustrator. Puede ser una imagen nueva de Illustrator de la respuesta más reciente (dibujada primero y luego animada), el avatar o sprite del personaje, o ninguna imagen. Sin ninguno elegido, el clip se crea solo a partir de la historia.
- **Avatar**: el clip empieza desde quien tu descripción nombra primero, incluida tu persona. Basta con una parte del nombre que nadie más comparta, escrita con mayúscula ("Lena" para "Dr. Lena Kowalski"). Si no se nombra a nadie, empieza desde el personaje del chat.
- **Revisión**: con **Expose media prompts before sending** (Mostrar los prompts de medios antes de enviar) activado, puedes revisar y editar primero el prompt del clip.
- **Contexto**: la IA lee tantos mensajes recientes como Illustrator para una imagen —el **Context Size** (Tamaño del contexto) de Illustrator, en **Agent Budget** (Presupuesto del agente), en su pantalla de configuración—.
- **Sin imagen**: cuando el clip parte sin imagen o desde un avatar, la IA describe la escena por sí misma. Sus instrucciones son **Roleplay Clip Director** (Director de clips de Roleplay), en **Settings → Generations → Video Generation Prompt Overrides** (Configuración → Generaciones → Anulaciones del prompt de generación de video).

El clip terminado se reproduce en línea debajo de la respuesta más reciente, incluso cuando la imagen venía de una anterior. Los clips no se abren solos en una ventana flotante. Para que uno flote, usa **Pin video to chat** (Fijar video al chat) en **Videos**. Para quitar un clip de un mensaje, usa su botón **X**. El clip sigue en la Gallery.

### En Game Mode

1. Asegúrate de que haya al menos una imagen en **Images**. Usa **Illustrate** (Ilustrar) o sube una.
2. Haz clic en **Video** en la fila de acciones de la parte superior de la Gallery.
3. Si **Expose media prompts before sending** está activado (**Settings → Generations → Overall Generations**, Configuración → Generaciones → Generaciones generales), revisa o edita el prompt y haz clic en **Generate** (Generar). Cancelar no inicia una solicitud.
4. El botón muestra **Generating...** (Generando...) y un aviso indica que la generación de video está en curso.
5. Cuando termina, el clip aparece en **Videos**.

Si no hay ninguna imagen, Marinara dice "Add or generate a gallery image before generating a scene video." Crea o sube una y vuelve a intentarlo.

### Animar una imagen

1. Abre la pestaña **Images**.
2. Pasa el cursor sobre la imagen.
3. Haz clic en **Animate illustration** (el icono de película).

Con la revisión de prompts activada, una ventana muestra el prompt compilado exacto, la duración, la relación de aspecto y la resolución para esa imagen. Tu edición se aplica solo a ese clip. En Roleplay, la IA que planea el movimiento lee tantos mensajes recientes como Illustrator, hasta la respuesta a la que pertenece la imagen. Sus instrucciones reutilizables son **Roleplay Gallery Animation Director** (Director de animación de la galería de Roleplay), en **Settings → Generations → Video Generation Prompt Overrides**.

Cada clip en **Videos** se reproduce en línea con su duración y el nombre del modelo. Usa **Pin video to chat** o **Download scene video** (Descargar video de escena). Si no hay clips, la pestaña dice **No videos yet** (Aún no hay videos).

## Elegir un servicio

Los ocho servicios crean clips cortos a partir de tu imagen.

- **Google AI Studio (Gemini Omni)**: duración de hasta 60 segundos, escrita en el prompt.
- **Google AI Studio (Veo)**: gran calidad, fija en 4, 6 u 8 segundos. Usa 8 cuando anima una imagen.
- **xAI Imagine**: de 1 a 15 segundos, con un límite de prompt más corto que los demás.
- **OpenRouter Video**: de 1 a 60 segundos, con cualquier modelo de video que admita tu cuenta.
- **NanoGPT**: de 1 a 60 segundos, sin modelo predeterminado.
- **Atlas Cloud**: carga el catálogo de video actual de Atlas Cloud, con los modelos de imagen a video primero, cada uno con su precio inicial por segundo de video generado. Si no puede, Marinara muestra los modelos iniciales Veo 3.1 y Seedance 2.0. Puedes escribir el ID exacto de un modelo. Siguen aplicándose los límites del modelo.
- **Seedance 2.0**: de 4 a 15 segundos, con modos de primer fotograma, y de primer y último fotograma. Necesita un enlace público a tu imagen de referencia.
- **ComfyUI**: local, a través de tu flujo de trabajo en formato API. Marinara sube la imagen de referencia directamente cuando el flujo de trabajo usa `%reference_image_name%`.
- **SwarmUI**: local, a través de tu flujo de trabajo y tu servidor de SwarmUI. La imagen de referencia entra mediante `%reference_image%`.

Los trabajos de video son lentos. El servicio inicia el trabajo, y Marinara espera y comprueba hasta que el clip está listo. Un clip puede tardar varios minutos. Los modelos WAN locales grandes pueden necesitar más de los 30 minutos predeterminados. Sube `VIDEO_GEN_TIMEOUT_MS` y reinicia Marinara.

### Diferencias entre los modelos de Atlas Cloud

Los modelos de Atlas Cloud no aceptan todos los mismos ajustes. Antes de cada solicitud, Marinara lee el esquema de entrada publicado del modelo en `static.atlascloud.ai` y adapta tus valores predeterminados a él.

- La imagen de origen va en el campo de imagen que usa ese modelo.
- La duración del clip pasa a la duración más cercana que ofrece el modelo. Un modelo limitado a 5 o 10 segundos convierte un valor predeterminado de 8 segundos en 10.
- La resolución pasa al nivel más cercano que ofrece el modelo. Los modelos que usan un tamaño en píxeles reciben el `width*height` más cercano para tu relación de aspecto y tu resolución.
- Un ajuste que el modelo no tiene se omite, así que se aplica el valor predeterminado del modelo.

El registro del servidor enumera cada valor modificado en una línea que empieza por `[video-gen/atlas-cloud] fitted request`. Si no se puede leer el esquema, Marinara envía la misma solicitud general que antes.

Elige un modelo de imagen a video para los videos de escena. Un modelo de texto a video no tiene campo de imagen. Ignora tu imagen y crea un clip sin relación a partir del prompt, y el registro del servidor lo indica. **Test video** envía un degradado simple como primer fotograma cuando el modelo necesita una imagen, así que los modelos de imagen a video pueden superar la prueba.

Muchos modelos de Atlas Cloud tienen entradas propias, como `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion` o listas de LoRA.

1. Abre el modelo de Atlas Cloud y elige o escribe un modelo.
2. Despliega **Video defaults** y luego **Atlas Cloud setup** (Configuración de Atlas Cloud).
3. Busca **Model options** (Opciones del modelo) debajo de los controles de duración, relación de aspecto y resolución.

La parte superior de **Model options** enumera las duraciones, resoluciones, tamaños de fotograma y relaciones de aspecto que acepta el modelo. Un modelo de texto a video también muestra un aviso. Cada opción usa el nombre y la descripción propios de Atlas Cloud, y empieza en **Model default** (Valor predeterminado del modelo), con el valor predeterminado entre corchetes. Una opción que se deja en **Model default** no se envía. Cambia una para enviar tu valor con cada video de este modelo, incluido **Test video**. Las entradas de listas y objetos, como las LoRA, aceptan JSON.

Las elecciones se guardan por modelo. **Reset model options** (Restablecer opciones del modelo) las borra para el modelo actual. Haz clic en **Save** (Guardar) para conservar tus cambios. Si una opción guardada ya no encaja con el modelo, Marinara la omite y la nombra en la línea del registro.

## Crear un video en Game Assets

Game Mode tiene un segundo lugar para crear un video de escena: **Game Assets** (Recursos del juego). Haz clic en su botón de carpeta, cerca de la esquina superior derecha del chat. Se abre como una ventana en una computadora y como un panel de ancho completo en un teléfono. Si lo moviste a Chat Settings, abre allí la sección **Game Assets**.

1. Abre **Game Assets**.
2. Haz clic en **Generate video** (Generar video; "Generate a scene video from the latest illustration").
3. El clip más reciente se reproduce allí cuando está listo.

**Generate video** permanece inactivo hasta que el juego tenga tanto un modelo de video como una ilustración de escena. Si haces clic demasiado pronto, puedes ver "Choose a Video Generation connection in Game Settings first." (configura un modelo de video para el juego) o "Generate a scene illustration before generating a scene video." Si un clip falla, el panel muestra "Scene video generation failed." Vuelve a intentarlo y revisa tu clave si sigue fallando.

## Elegir un modelo de video para un chat

Cada chat elige su propio modelo de video en **Chat Settings → Agents → Scene Videos** (Ajustes del chat → Agentes → Videos de escena).

- **Roleplay** muestra una tarjeta **Scene Videos** ("Generate manual MP4 scene videos from gallery images"). Tiene un solo control, la lista de modelos de video.
- **Game Mode** muestra una tarjeta **Scene Videos** ("Generate MP4 scene videos from game illustrations") con más controles. La lista de modelos de video elige el modelo. **Game Video Prompt** (Prompt de video del juego) es la plantilla que decide cómo se anima la imagen. El valor predeterminado integrado es **Cinematic Scene Video**. **Edit Video Prompt Presets** (Editar los presets de prompts de video) añade y edita tus propias copias para este chat.

**Game Video Prompt** controla los videos manuales de la Gallery y de Game Assets en Game Mode. Las animaciones de la Gallery en Roleplay usan **Roleplay Gallery Animation Director** en su lugar. El agente Storyboard tiene su propio **Storyboard Video Prompt** (Prompt de video del storyboard) predeterminado. Cada chat puede anularlo en **Chat Settings → Agents → Storyboards**. Al restablecerlo, se vuelve al valor predeterminado del agente Storyboard.

Cuando creas un chat de Game Mode, el asistente de configuración tiene un selector de modelo de video en el paso **Features** (Funciones), después de que actives la generación visual.

## Ajustes de generación de video

Algunos valores predeterminados de video son de toda la app. Abre **Settings → Generations** y busca **Video Generation** ("Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls").

- **Scene video fallback length** (Duración de reserva del video de escena): se usa solo cuando el modelo de video seleccionado no tiene duración propia. El valor predeterminado es 10 segundos. El rango es de 1 a 60.
- **Video Generation Prompt Overrides**: edita las plantillas reutilizables de prompts de video. **Roleplay Gallery Animation Director** define las instrucciones que se envían al Prompt Model antes de un clip de la Gallery de Roleplay. Su variable `${durationSeconds}` se convierte en la duración del clip.
- **Videos per reply** (Videos por respuesta): cuántos mensajes de video pueden enviar los personajes de Conversation en una respuesta, y cuántos clips añade Illustrator a una respuesta de Roleplay. El valor predeterminado es 3. El rango es de 1 a 10. Cada personaje de Conversation envía como máximo uno. Existe para los chats grupales y para pedir varios videos a la vez. Súbelo para que más personajes puedan enviar un clip. Bájalo para ahorrar solicitudes. Los clips que superan el límite se omiten. `/video` y el botón **Video** de la Gallery no cuentan.
- **Animated expression length** (Duración de la expresión animada) pertenece a los sprites de retrato animado. Consulta [Expresiones animadas](animated-expressions.md).

## Storyboards

El agente descargable Storyboard crea imágenes de fotograma clave ordenadas y clips en Roleplay y en Game Mode. Cuando las animaciones están activadas, Marinara anima cada fotograma clave que se haya generado correctamente con el modelo de video seleccionado y el **Storyboard Video Prompt** del agente. Consulta la [Guía del agente Storyboard](../game/storyboard.md).

## Solución de problemas

### "Choose a Video Generation connection"

Tu chat no tiene un modelo de video. Abre **Chat Settings → Agents → Scene Videos** y elige uno. Si la lista está vacía, añade uno en **Connections**.

### "Add or generate a gallery image before generating a scene video"

Game Mode y **Animate illustration** necesitan una imagen existente. Roleplay puede crear un clip solo a partir de la historia cuando no se elige un primer fotograma. Usa **Illustrate**, sube una imagen o haz clic en **Animate illustration** en una que ya tengas.

### El video tarda mucho

Esto es normal. Google, xAI, OpenRouter, NanoGPT, Atlas Cloud y Seedance inician un trabajo y Marinara lo espera. Un clip puede tardar varios minutos.

### Seedance no logra leer la imagen de referencia

Seedance necesita un enlace público a tu imagen. En un servidor local, activa **Upload Seedance reference frames temporarily** en el modelo de Seedance. Consulta [Fotogramas de referencia de Seedance](#seedance-reference-frames).

### Una solicitud de video sigue fallando

Comprueba que la cuenta tenga una API key válida y acceso a video. Abre la cuenta en **Connections** y confirma la clave y el modelo. Para los tiempos de espera del servidor, consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).

## Guías relacionadas

- [Expresiones animadas](animated-expressions.md)
- [Guía del agente Storyboard](../game/storyboard.md)
- [Storyboards con LTX 2.3 en Game Mode](../game/ltx-2-3-storyboards.md)
- [Proveedores de IA compatibles](../connections/providers-reference.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
