# Storyboards de LTX 2.3 en Game Mode

Esta guía conecta un flujo de trabajo local de imagen a video de LTX 2.3 en ComfyUI con los storyboards (secuencias de viñetas) del **Game Mode** (modo de juego) de Marinara Engine. Algunos jugadores lo llaman Story Mode; en Marinara los controles se llaman **Game Mode** y **Storyboards**.

La configuración de abajo se desarrolló con la generación de primer fotograma de **Krea 2** y el Image Style de lenguaje natural **Z-Image Turbo Narrative**. Otras conexiones de imagen también deberían funcionar cuando aceptan prompts (instrucciones enviadas a la IA) de escena descriptivos en lenguaje natural. El render de video LTX se ejecuta localmente en ComfyUI; que la generación del primer fotograma sea local o alojada depende de la conexión de imagen seleccionada.

La ruta completa es:

```text
GM narration
  -> Animation Planner
     -> imagePrompt -> image connection -> first-frame illustration
     -> narrationBeat -> Narration Passthrough -> %prompt%
  -> first frame + prompt -> ComfyUI LTX 2.3 workflow -> MP4 clip
```

La ilustración generada es el primer fotograma del clip. Por eso LTX recibe tanto un punto de partida visual como un prompt que se concentra en lo que se mueve a continuación.

## Antes de empezar

Necesitas:

1. Una instalación local de ComfyUI que funcione y que Marinara pueda alcanzar.
2. El flujo de trabajo editable `ltx-director-simple`, o un grafo equivalente de imagen a video de LTX 2.3 que se complete correctamente dentro de ComfyUI.
3. Su exportación en formato API `ltx-director-simple-api` para la conexión de Marinara.
4. Una conexión de generación de imágenes de Marinara para las ilustraciones de primer fotograma.
5. El agente **Storyboard** instalado desde **Agents > Download Agents** (Agentes > Descargar agentes) y activado para el Game en **Chat Settings > Agents**.

El flujo de trabajo editable de ComfyUI y su exportación en formato API son archivos distintos. Abre `ltx-director-simple` en ComfyUI, instala cada nodo personalizado que falte según ComfyUI Manager y prueba el grafo ahí. Importa `ltx-director-simple-api` en la conexión de Marinara. Después de cada cambio de nodo o modelo, vuelve a exportar el grafo en formato API y reemplaza el JSON guardado en la conexión. No pegues el flujo de trabajo normal del editor visual en Marinara.

Consulta [ComfyUI Workflow Setup](../media/comfyui.md) para conocer el proceso general de exportación y conexión.

## Elige un modelo de LTX 2.3

Elige el formato del modelo según la arquitectura de la GPU y la memoria disponible después de que ComfyUI cargue el codificador de texto, los VAE y el upscaler. Trátalos como puntos de partida, no como promesas de que todo flujo de trabajo entrará en toda tarjeta.

| Familia de GPU | Punto de partida práctico | Notas |
| --- | --- | --- |
| RTX 30 series (Ampere) | INT8 ConvRot | El punto de partida de baja memoria para tarjetas de clase 3070, 3080 y 3090. |
| RTX 40 series con 16-24 GB | FP8 input-scaled | Usa la ruta FP8 acelerada disponible en el hardware de generación Ada. |
| RTX 40 series con 8-12 GB | INT8 ConvRot cuando la descarga FP8 es demasiado lenta | Compara ambos en el flujo de trabajo real; la VRAM disponible y el comportamiento de descarga siguen importando. |
| RTX 50 series (Blackwell) | NVFP4 dev workflow | Requiere un ComfyUI, CUDA y conjunto de nodos compatibles con NVFP4. |
| RTX 50 usando el flujo de trabajo destilado existente | FP8 input-scaled | Usa esta ruta de compatibilidad hasta que haya un checkpoint destilado NVFP4 oficial. |

El flujo de trabajo probado en RTX 3080 usa:

```text
ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors
```

Estos sufijos describen distintos formatos de modelo cuantizado y rutas de ejecución, no presets (ajustes guardados) de calidad que siempre se puedan intercambiar en el mismo lugar:

- **INT8 ConvRot** es la ruta de baja memoria práctica de la comunidad para tarjetas RTX 30-series y tarjetas Ada más pequeñas.
- **FP8 input-scaled** usa operaciones de matriz FP8 aceleradas en hardware NVIDIA de aproximadamente RTX 40-series y más nuevo.
- **NVFP4** es la ruta nativa de cuatro bits de Blackwell que usa el flujo de trabajo de RTX 50-series.
- Los flujos de trabajo **Dev** y **distilled** usan supuestos de muestreo distintos. No pongas un checkpoint dev en el grafo destilado adjunto sin cambiar el flujo de trabajo para que coincida.

Una tarjeta de 8 GB debería empezar en 480p y un keyframe (fotograma clave) para su primera prueba de integración. Que el checkpoint entre no garantiza que un video más largo o de mayor resolución vaya a entrar, porque los latentes de video, el codificador de texto, los VAE, el audio y el upscaling también usan memoria.

El flujo de trabajo oficial para principiantes usa estos componentes:

- `ltx-2.3-22b-dev-fp8.safetensors`
- `ltx-2.3-22b-distilled-lora-384.safetensors`
- `gemma_3_12B_it_fp4_mixed.safetensors`
- `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`

Los flujos de trabajo personalizados pueden usar un checkpoint destilado v1.1, una cuantización de terceros, nodos de carga distintos o carpetas de modelos distintas. Los nombres de archivo guardados en el flujo de trabajo API deben coincidir exactamente con los archivos visibles para ComfyUI.

Referencias oficiales:

- [LTX 2.3 image-to-video guide](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [LTX prompting guide](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [LTX 2.3 model card](https://huggingface.co/Lightricks/LTX-2.3)
- [LTX 2.3 NVFP4 model card](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Official LTX 2.3 ComfyUI examples](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Community ComfyUI-separated and FP8 weights](https://huggingface.co/Kijai/LTX2.3_comfy)

## Prepara el flujo de trabajo API de ComfyUI

Primero encola el flujo de trabajo editable directamente en ComfyUI con una imagen de origen real y un prompt simple. Confirma que guarda un MP4 con audio antes de adaptar su exportación API para Marinara.

La ruta simple de Marinara usa un prompt completo en la entrada del prompt global del LTX Director:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

El nodo LTX Director todavía puede manejar el condicionamiento de imagen, los datos de guía, el audio y las dos etapas de muestreo. "Simple" se refiere al contrato del prompt: Marinara envía un párrafo coherente de imagen a video en lugar de una línea de tiempo de Prompt Relay.

### Marcadores de posición requeridos

Reemplaza los valores correspondientes en la exportación API con marcadores de posición de Marinara entre comillas:

| Marcador de posición | Valor suministrado |
| --- | --- |
| `%prompt%` | El prompt completo producido por el Storyboard Animation Planner seleccionado y la plantilla de video |
| `%reference_image_name%` | La imagen de primer fotograma subida a ComfyUI |
| `%duration_seconds%` | La duración del clip del Storyboard en segundos |
| `%length%` | La duración convertida al contrato de fotogramas de 16 FPS de Marinara |
| `%fps%` | La velocidad de fotogramas que Marinara usa para el clip |
| `%width%`, `%height%` | Dimensiones seleccionadas de la resolución y la relación de aspecto de la conexión de video |
| `%seed%` | Una nueva semilla aleatoria para la solicitud |
| `%model%` | Valor de modelo opcional de la conexión cuando el flujo de trabajo no fija su modelo de carga en el código |

La imagen de referencia va dentro del arreglo `segments` del `timeline_data` de LTX Director. En el flujo de trabajo de la API, `timeline_data` es una cadena JSON serializada. `%length%` mantiene dinámica la duración del clip a través de `normalDurationFrames`; el segmento de imagen de referencia del fotograma cero conserva a propósito su propio valor corto y fijo `"length":16`:

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

No pongas `%reference_image_name%` junto a `timeline_data` ni en un campo de imagen aparte de nivel superior. Mantén el número de fotogramas, los segundos y la velocidad de fotogramas conectados a las entradas externas del flujo de trabajo con `%length%`, `%duration_seconds%` y `%fps%`; los valores numéricos que muestra un grafo editable de ComfyUI no son los predeterminados de Marinara.

Mantén entre comillas los marcadores de posición de texto como `%reference_image_name%`. Las entradas numéricas exactas de un nodo pueden poner entre comillas `%length%`, `%duration_seconds%` y `%fps%` porque Marinara los convierte en números. Dentro de la cadena serializada `timeline_data`, deja `%length%` sin comillas como se muestra para que el valor decodificado de la línea de tiempo sea numérico.

### Exporta después de cada edición

1. Encola el flujo de trabajo editable en ComfyUI.
2. Confirma que el grafo actual produce un MP4 reproducible.
3. Selecciona **Save (API Format)**, **Export (API)** o **Export to API**.
4. Añade o confirma los marcadores de posición en el nuevo JSON de la API.
5. Reemplaza el flujo de trabajo guardado en la conexión de Marinara.

Borrar un nodo y seguir usando una exportación API más antigua puede dejar referencias a un nodo que ya no existe. Entonces ComfyUI rechaza la solicitud antes de que empiece la generación.

## Crea la conexión de video de Marinara

1. Abre **Settings** (Configuración) y luego **Connections**.
2. Añade una conexión de **Video Generation**.
3. Elige **ComfyUI**.
4. Introduce la URL base de ComfyUI, normalmente `http://127.0.0.1:8188` cuando se ejecuta en la misma computadora.
5. Pega el flujo de trabajo completo en formato API en **ComfyUI Workflow**.
6. Elige una duración predeterminada de seis segundos, **16:9** y 480p para la primera prueba de baja VRAM.
7. Guarda la conexión.

Una prueba de conexión solo de texto no puede ejercitar `%reference_image_name%`. Valida la imagen a video desde una imagen de la Gallery o un Storyboard después de guardar la conexión.

## Configura el chat en Game Mode

Abre el chat en Game Mode, luego abre **Chat Settings** (Ajustes del chat) y selecciona **Agents**. Activa **Enable Agents** (Activar agentes) y **Enable Storyboards** (Activar storyboards) antes de configurar las secciones de abajo. La presentación Storyboard Optimized del asistente de configuración de partida nueva no activa el agente.

### Illustrator

| Ajuste | Valor recomendado |
| --- | --- |
| **Game Illustrator** | On |
| **Image Connection** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off para este flujo de trabajo probado |

El Animation Planner ya recibe el contexto de apariencia del personaje del turno del Storyboard, así que esta configuración deja **Attach Card Appearance** en Off para evitar añadir la misma información otra vez durante el formateo final de la imagen. **Storyboard First Frame** también evita repetir la dirección artística de la campaña alrededor de la escena T=0 completada del planner.

**Send Avatar References** controla las imágenes de referencia enviadas al proveedor de imagen de primer fotograma; no controla la entrada de primer fotograma de LTX. LTX recibe la ilustración terminada del Storyboard a través de `%reference_image_name%`. Deja las referencias de avatar en Off para esta configuración probada de Krea, y luego actívalas por separado solo después de confirmar que la conexión de imagen seleccionada las admite y se beneficia de ellas.

La imagen de primer fotograma tiene un gran efecto en la calidad de la animación. Debería mostrar el momento exacto justo antes del movimiento planeado, con el sujeto, la ruta, las manos, la puerta, el objeto o el objetivo claramente visibles.

### Scene Videos

| Ajuste | Valor recomendado |
| --- | --- |
| **Video Connection** | La conexión de LTX 2.3 en ComfyUI creada arriba |
| **Game Video Prompt** | **Narration Passthrough** |

El **Game Video Prompt** general controla las animaciones manuales de la Gallery y de Game Assets. Los clips de Storyboard pueden elegir su propio prompt sin cambiar esas otras acciones de animación.

### Storyboards

Usa este perfil de partida:

| Ajuste | Valor de partida recomendado |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 3 normalmente; empieza con 1 para la primera prueba de 8 GB de VRAM |
| **Animation Clip Duration** | 5 segundos |
| **Viewer Display** | Floating mientras haces pruebas |
| **Illustration Planner** | **Still Keyframes**; se conserva como alternativa solo de imágenes fijas |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

**LTX Simple Image-to-Video** es el valor predeterminado recomendado. Planea un primer fotograma listo para animar y un prompt de movimiento directo de 4 a 8 frases. Favorece una acción principal, un comportamiento de cámara, un movimiento ambiental contenido y audio relevante o un breve diálogo.

**LTX Director Storyboard** sigue disponible como opción avanzada. Ofrece una dirección más detallada consciente de la duración y reglas de continuidad. Pruébalo después de que la ruta simple sea estable, o cuando un clip más largo realmente necesite más fases conectadas. Ambos planners usan el mismo contrato de flujo de trabajo `%prompt%`.

**Illustration Planner: Still Keyframes** no crea el prompt de Krea mientras las animaciones están activadas. En modo de animación, **LTX Simple Image-to-Video** crea ambas salidas: un `imagePrompt` en lenguaje natural para Krea y un `narrationBeat` para LTX. Still Keyframes solo queda seleccionado para los turnos generados sin videos.

**Storyboard First Frame** pasa la escena T=0 completa en lenguaje natural del Animation Planner directamente a Krea sin añadir un título de fotograma clave, etiquetas de prompt, notas de apariencia repetidas ni dirección artística de la campaña. Mantén **Use Storyboard Template** en On para que este formateador se aplique de verdad.

**Narration Passthrough** es intencionadamente pequeño. Pasa el `narrationBeat` completado del Animation Planner a través del contrato universal de prompt de video sin rodearlo de otro resumen de escena.

Cada fotograma clave crea un trabajo de imagen de Krea y un trabajo de video local de LTX. Por lo tanto, tres fotogramas clave lanzan tres renders de primer fotograma y tres renders de video. Para una GPU con 8 GB de VRAM, empieza con un fotograma clave a 480p. Cuando eso funcione, avanza hacia tres fotogramas clave y resoluciones más altas.

## Ejecuta la primera prueba

Usa un turno de GM completado que contenga una acción visual obvia, como abrir una puerta, mirar hacia un sonido, dar unos pasos o decir una línea corta.

1. Para la comprobación de baja VRAM más rápida, ajusta temporalmente **Keyframes per Turn** a 1 mientras dejas **Animation Clip Duration** en 5 segundos. El perfil probado normal usa 3 fotogramas clave.
2. Activa ambos ajustes automáticos de Storyboard después de que el turno de GM actual ya esté completo.
3. Abre la Gallery y elige **Create storyboard** para ese turno de GM completado. Esto inicia manualmente la ruta completa de ilustración y animación sin esperar a otro turno.
4. Si la exposición de prompts está activada, revisa el prompt de primer fotograma antes de enviarlo.
5. Confirma que el primer fotograma generado es una pose de partida físicamente útil.
6. Espera a que termine el render de primer fotograma y luego el clip de ComfyUI.
7. Restaura **Keyframes per Turn** a 3 y deja ambos ajustes automáticos en On para turnos posteriores después de que la ruta manual funcione.

Usa el modo de visor **Floating** durante la configuración porque facilita inspeccionar cada imagen y clip. Cambia a **Background** después de que el flujo de trabajo sea fiable si quieres que el contenido del storyboard se integre en la escena del Game Mode.

## Cómo funciona el traspaso del prompt

Para cada fotograma clave, el Animation Planner devuelve:

- `imagePrompt`: solo el primer fotograma visible en el tiempo T=0;
- `narrationBeat`: el prompt completo de imagen a video de LTX que describe lo que pasa a continuación.

El Animation Planner seleccionado escribe ambos campos. **Storyboard First Frame** formatea `imagePrompt` y envía esa escena T=0 en lenguaje natural a Krea 2. Después de que la imagen existe, **Narration Passthrough** se resuelve en `narrationBeat`. Marinara lo coloca en el campo `prompt` de la solicitud de video normal, reemplaza `%prompt%` en el flujo de trabajo de ComfyUI, sube el primer fotograma y reemplaza `%reference_image_name%` con su nombre de archivo de ComfyUI.

No hay ninguna obligación de crear dos segmentos de prompt local. Un solo prompt global es la ruta normal para estos presets de Storyboard.

## Qué hace bueno a un prompt de LTX

La imagen de origen ya describe la apariencia del personaje, la composición, el entorno, la iluminación, la paleta y la textura. El prompt de video debería concentrarse en el movimiento:

- un párrafo fluido en tiempo presente;
- una acción enfocada que encaje en la duración del clip;
- movimiento de cámara descrito en relación con el sujeto;
- reacciones visibles a través de la mirada, la cara, la postura, la respiración o el gesto;
- como mucho un movimiento ambiental útil;
- sonido ambiental, efectos, música o un breve diálogo entre comillas cuando sea relevante;
- una finalización natural, un movimiento de asentamiento o una breve pausa al final.

Evita cambios de escena, cortes, teletransporte, múltiples acciones no relacionadas, física compleja, coreografías concurridas, texto legible exacto e inventarios repetidos de detalles ya visibles en el primer fotograma.

Ejemplo:

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Registra una configuración reproducible

Un resultado de "8 GB" depende de más que el checkpoint. Al compartir el flujo de trabajo, registra:

- el modelo exacto de la GPU y la VRAM;
- la versión o commit de ComfyUI;
- las versiones del controlador NVIDIA, CUDA, PyTorch y Python;
- los paquetes de nodos personalizados requeridos y sus versiones;
- los nombres de archivo exactos de los modelos y sus carpetas de ComfyUI;
- la resolución de salida, la duración, el número de fotogramas clave y el tiempo de render aproximado;
- si Krea 2 se ejecuta localmente o a través de una conexión de imagen alojada en esa configuración.

El JSON de la API adjunto guarda una instantánea de los IDs de nodo, las rutas de modelo y los nombres de entrada. Los usuarios que mantienen los modelos en una carpeta distinta, como `LTX2/`, deben actualizar los valores de carga y exportar una copia API nueva. Un flujo de trabajo que se ejecuta en la instalación de ComfyUI de su autor todavía puede fallar en otro lugar cuando un nodo personalizado o una ruta de modelo difiere.

## Solución de problemas

### ComfyUI devuelve HTTP 400 o "Prompt outputs failed validation"

El flujo de trabajo API no coincide con el grafo instalado actualmente. Busca un nodo borrado, un ID de nodo colgante, un nodo personalizado que falte, una entrada renombrada por una actualización de nodo o un nombre de archivo de modelo que ya no existe. Exporta un flujo de trabajo API nuevo desde el grafo de ComfyUI que funciona.

### Las imágenes se crean pero los videos no

Revisa **Automatic Storyboard Animations** y la **Video Connection** del Game Mode. Las animaciones requieren tanto la ilustración de primer fotograma como una conexión de video seleccionada.

### LTX no recibe imagen de partida

Confirma que `%reference_image_name%` aparece en el flujo de trabajo API guardado y alimenta el segmento de imagen de LTX Director. Marinara solo sube el primer fotograma cuando ese marcador de posición está presente.

### El clip se deforma, cambia de personajes o se vuelve caótico

Vuelve a **LTX Simple Image-to-Video**, usa un fotograma clave y prueba un turno con una acción. Una imagen de origen no puede convertirse limpiamente en varias ubicaciones, poses y resultados durante un clip continuo corto. Revisa también el primer fotograma: una pose de partida confusa produce un problema de animación más difícil incluso con un buen prompt de movimiento.

### Todas las generaciones se parecen demasiado

Reemplaza cualquier semilla de muestreo fijada en el código con `%seed%`. Una vez que aparezca un resultado útil, fija esa semilla temporalmente en el flujo de trabajo solo cuando compares cambios de prompt o de muestreo.

### La generación se queda sin memoria

Empieza en 480p. Reduce la duración a continuación si es necesario. Mantén un fotograma clave por turno durante las pruebas, cierra otras aplicaciones de GPU y evita mantener un modelo de lenguaje local cargado en la misma GPU de baja VRAM. Un checkpoint cuantizado reduce la memoria del modelo pero no elimina la memoria que usan los latentes de video, el codificador de texto, los VAE, el audio y el upscaling.

### Marinara deja de esperar pero ComfyUI sigue renderizando

Cerrar la solicitud del navegador o perder la conexión del cliente puede detener el sondeo de Marinara sin cancelar un trabajo ya encolado en ComfyUI. Revisa la cola, el historial y la carpeta de salida de ComfyUI antes de iniciar el mismo render otra vez.

### El flujo de trabajo funciona en ComfyUI pero falla desde Marinara

Compara el JSON de la conexión guardada con la exportación API más reciente. Verifica la URL base, la ortografía de los marcadores de posición, los nodos personalizados requeridos, las rutas de modelo, el nodo de salida, las dimensiones y los campos de duración. El grafo editable puede funcionar mientras Marinara todavía conserva una instantánea exportada más antigua.

Para trazas detalladas del servidor, activa el registro de depuración y busca `[debug/game/storyboard-video]` y `[video-gen/comfyui]`. Una solicitud sana muestra el prompt global completado, un nombre de archivo de imagen de referencia subido, la duración, el número de fotogramas y un ID de prompt de ComfyUI encolado.

## Guías relacionadas

- [Guía del agente Storyboard](storyboard.md)
- [ComfyUI Workflow Setup](../media/comfyui.md)
- [Scene Video Generation](../media/scene-video.md)
- [Game Mode: Getting Started](getting-started.md)
