# Storyboards de LTX 2.3 en Game Mode

Esta guía conecta un flujo de trabajo local de imagen a video de LTX 2.3 en ComfyUI con los Storyboards (secuencias de viñetas) de Game Mode, para que cada fotograma del storyboard se convierta en un clip de video corto. Es una configuración avanzada para jugadores con una GPU local y ComfyUI. Algunos jugadores lo llaman Story Mode. En Marinara los controles se llaman **Game Mode** y **Storyboards**.

La configuración se desarrolló con imágenes de primer fotograma de **Krea 2** y el Image Style **Z-Image Turbo Narrative**. Otras cuentas de imagen deberían funcionar si aceptan prompts (instrucciones enviadas a la IA) de escena descriptivos en lenguaje natural. El video de LTX se renderiza localmente en ComfyUI. Que la imagen del primer fotograma sea local o alojada depende de la cuenta de imagen que elijas.

La ruta completa tiene estos pasos:

1. El GM escribe un turno de narración.
2. El Animation Planner devuelve un `imagePrompt` y un `narrationBeat`.
3. El `imagePrompt` va a la cuenta de imagen y se convierte en la ilustración del primer fotograma.
4. El `narrationBeat` pasa por **Narration Passthrough** y se convierte en `%prompt%`.
5. El primer fotograma y el prompt van al flujo de trabajo LTX 2.3 de ComfyUI, que crea un clip MP4.

La ilustración es el primer fotograma del clip. LTX recibe tanto una imagen de partida como un prompt sobre lo que se mueve a continuación. Si funciona, aparece un clip en la pestaña **Videos** de la Gallery.

## Antes de empezar

Necesitas:

1. Un ComfyUI local que funcione y que Marinara pueda alcanzar. Consulta [Configuración del flujo de trabajo de ComfyUI](../media/comfyui.md).
2. Una GPU con suficiente VRAM (la memoria de tu tarjeta gráfica). Una tarjeta de 8 GB puede servir para una primera prueba a 480p con un keyframe (fotograma clave).
3. El flujo de trabajo editable `ltx-director-simple`, o un grafo equivalente de imagen a video de LTX 2.3 que se complete en ComfyUI, y su exportación en formato API `ltx-director-simple-api`.
4. Una cuenta de imagen en Marinara para las ilustraciones del primer fotograma.
5. El agente **Storyboard**, descargado desde **Agents → Agent Organizer** (Agentes → Organizador de agentes) y activado para la partida en **Chat Settings → Agents** (Ajustes del chat → Agentes). Consulta [Guía del agente Storyboard](storyboard.md).

El flujo de trabajo editable y su exportación API son archivos distintos. Abre `ltx-director-simple` en ComfyUI, instala cada nodo personalizado que ComfyUI Manager indique que falta y prueba el grafo ahí. Importa `ltx-director-simple-api` en Marinara. Después de cada cambio de nodo o de modelo, vuelve a exportar el grafo en formato API y reemplaza el JSON de la cuenta de Marinara. No pegues en Marinara el flujo de trabajo normal del editor visual.

## Prepara el flujo de trabajo API de ComfyUI

Primero encola el flujo de trabajo editable en ComfyUI con una imagen de origen real y un prompt simple. Confirma que guarda un MP4 con audio.

La ruta simple de Marinara pone un prompt completo en la entrada del prompt global de LTX Director:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

El nodo LTX Director todavía puede manejar el condicionamiento de imagen, los datos de guía, el audio y las dos etapas de muestreo. "Simple" significa que Marinara envía un párrafo coherente de imagen a video en lugar de una línea de tiempo de Prompt Relay.

### Marcadores de posición

En la exportación API, reemplaza los valores correspondientes con estos marcadores de posición de Marinara entre comillas:

| Marcador de posición | Valor que suministra Marinara |
| --- | --- |
| `%prompt%` | El prompt completo del Animation Planner y de la plantilla de video |
| `%reference_image_name%` | La imagen del primer fotograma subida a ComfyUI |
| `%duration_seconds%` | La duración del clip en segundos |
| `%length%` | La duración como número de fotogramas a los 16 FPS predeterminados de Marinara |
| `%fps%` | La velocidad de fotogramas que usa Marinara |
| `%width%`, `%height%` | Dimensiones según la resolución y la relación de aspecto de la cuenta de video |
| `%seed%` | Una nueva semilla aleatoria para cada solicitud |
| `%model%` | Valor de modelo opcional de la cuenta, cuando el flujo de trabajo no fija el modelo de su nodo de carga |

Marinara también puede rellenar `%length_s%`, `%global_prompt%`, `%local_prompts%` y `%segment_lengths%`. Estos cuatro son opcionales. La ruta simple no los necesita y envía su prompt a través de `%prompt%`.

La imagen de referencia va dentro del arreglo `segments` del `timeline_data` de LTX Director, que en el flujo de trabajo API es una cadena JSON serializada. `%length%` mantiene dinámica la duración del clip a través de `normalDurationFrames`. El segmento de la imagen de referencia del fotograma cero conserva su propio valor fijo `"length":16`.

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

- No pongas `%reference_image_name%` junto a `timeline_data` ni en un campo de imagen aparte de nivel superior.
- Mantén entre comillas los marcadores de posición de texto como `%reference_image_name%`.
- Las entradas numéricas de un nodo pueden poner entre comillas `%length%`, `%duration_seconds%` y `%fps%`, porque Marinara los convierte en números. Dentro de la cadena serializada `timeline_data`, deja `%length%` sin comillas, como se muestra, para que el valor decodificado sea un número.
- Mantén el número de fotogramas, los segundos y la velocidad de fotogramas vinculados a estos marcadores de posición. Los números que muestra un grafo editable de ComfyUI no son los valores predeterminados de Marinara.

### Exporta después de cada edición

1. Encola el flujo de trabajo editable en ComfyUI y confirma que produce un MP4 reproducible.
2. Selecciona **Save (API Format)**, **Export (API)** o **Export to API**, según tu versión de ComfyUI.
3. Añade o confirma los marcadores de posición en el nuevo JSON de la API.
4. Reemplaza el flujo de trabajo guardado en la cuenta de Marinara.

Borrar un nodo y seguir usando una exportación más antigua deja referencias a un nodo que ya no existe. Entonces ComfyUI rechaza la solicitud.

## Crea la cuenta de video

1. Abre **Settings → Connections** (Configuración → Conexiones).
2. Haz clic en **Add account** (Añadir cuenta) y elige una cuenta de **Video Generation** (Generación de video).
3. Elige **ComfyUI**.
4. Introduce la **Base URL** (URL base), normalmente `http://127.0.0.1:8188` cuando ComfyUI se ejecuta en la misma computadora.
5. Pega el flujo de trabajo completo en formato API en **ComfyUI workflow** (Flujo de trabajo de ComfyUI).
6. Para la primera prueba con poca VRAM, elige una duración predeterminada de seis segundos, **16:9** y 480p.
7. Guarda la cuenta.

Una prueba de conexión solo de texto no puede poner a prueba `%reference_image_name%`. Prueba la imagen a video desde una imagen de la Gallery o un Storyboard después de guardar.

## Configura el chat de Game Mode

Abre el chat de Game Mode y luego **Chat Settings → Agents**. Primero activa **Enable Agents** (Activar agentes) y **Enable Storyboards** (Activar storyboards). La presentación Storyboard Optimized del asistente de configuración no activa el agente.

### Illustrator

| Ajuste | Valor recomendado |
| --- | --- |
| **Game Illustrator** | On |
| **Image model** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off para este flujo de trabajo probado |

El Animation Planner ya recibe el contexto de apariencia de los personajes del turno, así que **Attach Card Appearance** se queda en Off para no añadirlo dos veces. **Storyboard First Frame** también evita repetir la dirección artística de la campaña alrededor de la escena del primer fotograma que el planner ya terminó.

**Send Avatar References** controla las imágenes de referencia que se envían al servicio de imagen del primer fotograma. No controla la entrada de primer fotograma de LTX: LTX recibe la ilustración terminada a través de `%reference_image_name%`. Activa las referencias de avatar solo después de confirmar que tu cuenta de imagen las admite y que ayudan.

El primer fotograma afecta mucho a la calidad de la animación. Debería mostrar el momento exacto antes del movimiento planeado, con el sujeto, la ruta, las manos, la puerta, el objeto o el objetivo claramente visibles.

### Scene Videos

| Ajuste | Valor recomendado |
| --- | --- |
| **Video model** | La cuenta de LTX 2.3 en ComfyUI que creaste |
| **Game Video Prompt** | **Narration Passthrough** |

**Game Video Prompt** controla las animaciones manuales de la Gallery y de Game Assets. Los clips de Storyboard pueden usar su propio prompt sin cambiarlas.

### Storyboards

| Ajuste | Valor de partida recomendado |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 3 normalmente. Empieza con 1 para la primera prueba con 8 GB de VRAM. |
| **Animation Clip Duration** | 5 segundos |
| **Viewer Display** | Floating mientras haces pruebas |
| **Illustration Planner** | **Still Keyframes** (la alternativa para los turnos sin video) |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

- **LTX Simple Image-to-Video** es el planner recomendado. Planea un primer fotograma listo para animar y un prompt de movimiento directo de 4 a 8 frases, con una acción principal, un comportamiento de cámara, un movimiento contenido a su alrededor y audio relevante o un breve diálogo.
- **LTX Director Storyboard** es una opción avanzada con una dirección más detallada que tiene en cuenta la duración y con reglas de continuidad. Pruébalo cuando la ruta simple sea estable, o cuando un clip más largo necesite más fases conectadas. Ambos usan el mismo contrato `%prompt%`.
- Con las animaciones activadas, **LTX Simple Image-to-Video** escribe ambas salidas: un `imagePrompt` para Krea y un `narrationBeat` para LTX. **Still Keyframes** solo se usa para los turnos sin videos.
- **Storyboard First Frame** envía a Krea la escena completa del primer fotograma que el planner escribió en lenguaje natural, sin título de fotograma clave, etiquetas de prompt, notas de apariencia repetidas ni dirección artística de la campaña. Mantén **Use Storyboard Template** en On para que se aplique.
- **Narration Passthrough** pasa el `narrationBeat` terminado del planner a través del contrato del prompt de video sin otro resumen de la escena.

Cada fotograma clave crea una tarea de imagen de Krea y una tarea de video local de LTX, así que tres fotogramas clave lanzan tres renders de imagen y tres renders de video.

## Ejecuta la primera prueba

Usa un turno de GM completado con una acción visual obvia, como abrir una puerta, mirar hacia un sonido o decir una línea corta.

1. Para la comprobación más rápida con poca VRAM, ajusta **Keyframes per Turn** a 1 y deja **Animation Clip Duration** en 5 segundos.
2. Activa ambos ajustes automáticos de Storyboard después de que el turno de GM esté completo.
3. Abre **Chat Settings → Gallery** y selecciona **Create storyboard** (Crear storyboard). Esto inicia la ruta completa de ilustración y animación sin esperar a otro turno.
4. Si la revisión de prompts está activada, revisa el prompt del primer fotograma antes de enviarlo.
5. Comprueba que el primer fotograma es una pose de partida físicamente útil.
6. Espera al render del primer fotograma y luego al clip de ComfyUI.
7. Cuando la ruta manual funcione, vuelve a poner **Keyframes per Turn** en 3 y deja ambos ajustes automáticos activados.

Usa el visor **Floating** durante la configuración para poder inspeccionar cada imagen y cada clip. Cambia a **Background** más adelante si quieres el contenido multimedia del Storyboard en la escena de Game.

Si no funcionó, consulta [Solución de problemas](#troubleshooting).

## Cómo funciona el traspaso del prompt

Para cada fotograma clave, el Animation Planner devuelve `imagePrompt` (solo el primer fotograma visible en el tiempo T=0) y `narrationBeat` (el prompt completo de LTX para lo que pasa a continuación). **Storyboard First Frame** formatea `imagePrompt` y lo envía a Krea 2. Cuando la imagen existe, **Narration Passthrough** se resuelve en `narrationBeat`. Marinara lo coloca en el campo `prompt` de la solicitud de video, reemplaza `%prompt%` en el flujo de trabajo de ComfyUI, sube el primer fotograma y reemplaza `%reference_image_name%` con su nombre de archivo de ComfyUI. No necesitas dos segmentos de prompt locales. Un solo prompt global es la ruta normal.

## Escribe un buen prompt de LTX

La imagen de origen ya muestra la apariencia, la composición, el entorno, la luz y el estilo. El prompt de video debería tratar del movimiento:

- Un párrafo fluido en tiempo presente.
- Una acción enfocada que encaje en la duración del clip.
- Movimiento de cámara descrito en relación con el sujeto.
- Reacciones visibles a través de la mirada, la cara, la postura, la respiración o el gesto.
- Como mucho un movimiento ambiental útil.
- Sonido ambiental, efectos, música o un breve diálogo entre comillas cuando sea relevante.
- Un final natural, un movimiento de asentamiento o una breve pausa.

Evita los cambios de escena, los cortes, el teletransporte, varias acciones no relacionadas, la física compleja, las coreografías abarrotadas, el texto legible exacto y las repeticiones de detalles ya visibles en el primer fotograma.

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

<a id="troubleshooting"></a>

## Solución de problemas

### ComfyUI devuelve HTTP 400 o "Prompt outputs failed validation"

El flujo de trabajo API no coincide con el grafo instalado. Busca un nodo borrado, un ID de nodo colgante, un nodo personalizado que falte, una entrada que una actualización de nodo renombró o un nombre de archivo de modelo que ya no existe. Exporta un flujo de trabajo API nuevo desde el grafo que funciona.

### Las imágenes se crean pero los videos no

Revisa **Automatic Storyboard Animations** y el **Video model** de Game Mode. Las animaciones necesitan tanto la ilustración del primer fotograma como una cuenta de video seleccionada.

### LTX no recibe imagen de partida

Confirma que `%reference_image_name%` aparece en el flujo de trabajo API guardado y alimenta el segmento de imagen de LTX Director. Marinara solo sube el primer fotograma cuando ese marcador de posición está presente.

### El clip se deforma, cambia de personajes o se vuelve caótico

Vuelve a **LTX Simple Image-to-Video**, usa un fotograma clave y prueba un turno con una acción. Una imagen no puede convertirse limpiamente en varios lugares, poses y resultados en un clip corto. Revisa también el primer fotograma: una pose de partida confusa produce una animación más difícil.

### Todas las generaciones se parecen demasiado

Reemplaza cualquier semilla de muestreo fijada en el código con `%seed%`. Cuando consigas un resultado útil, fija esa semilla temporalmente en el flujo de trabajo, solo mientras comparas cambios de prompt o de muestreo.

### La generación se queda sin memoria

Empieza en 480p. Luego reduce la duración. Mantén un fotograma clave por turno durante las pruebas, cierra otras aplicaciones de GPU y no mantengas un modelo de lenguaje local cargado en la misma GPU con poca VRAM. Un checkpoint cuantizado reduce la memoria del modelo, pero no la memoria que usan los latentes de video, el codificador de texto, los VAE, el audio y el upscaling.

### Marinara deja de esperar pero ComfyUI sigue renderizando

Cerrar la solicitud del navegador o perder la conexión puede detener el sondeo de Marinara sin cancelar una tarea ya encolada en ComfyUI. Revisa la cola, el historial y la carpeta de salida de ComfyUI antes de iniciar el mismo render otra vez.

### El flujo de trabajo funciona en ComfyUI pero falla desde Marinara

Compara el JSON de la cuenta guardada con tu exportación API más reciente. Revisa la URL base, la ortografía de los marcadores de posición, los nodos personalizados, las rutas de modelo, el nodo de salida, las dimensiones y los campos de duración. El grafo editable puede funcionar mientras Marinara todavía conserva una instantánea exportada más antigua.

Para ver trazas del servidor, activa el registro de depuración y busca `[debug/game/storyboard-video]` y `[video-gen/comfyui]`. Una solicitud sana muestra el prompt global completado, un nombre de archivo de imagen de referencia subido, la duración, el número de fotogramas y un ID de prompt de ComfyUI encolado.

## Referencia: modelos de LTX 2.3

Elige el formato del modelo según tu familia de GPU y la memoria que queda después de que ComfyUI cargue el codificador de texto, los VAE y el upscaler. Son puntos de partida, no promesas.

| Familia de GPU | Punto de partida práctico | Notas |
| --- | --- | --- |
| RTX 30 series (Ampere) | INT8 ConvRot | El punto de partida de poca memoria para tarjetas de clase 3070, 3080 y 3090. |
| RTX 40 series, 16 a 24 GB | FP8 input-scaled | Usa la ruta FP8 acelerada del hardware Ada. |
| RTX 40 series, 8 a 12 GB | INT8 ConvRot cuando la descarga FP8 es demasiado lenta | Compara ambos en tu flujo de trabajo. |
| RTX 50 series (Blackwell) | NVFP4 dev workflow | Necesita un ComfyUI, CUDA y un conjunto de nodos compatibles con NVFP4. |
| RTX 50, flujo de trabajo destilado existente | FP8 input-scaled | Úsalo hasta que exista un checkpoint destilado NVFP4 oficial. |

El flujo de trabajo probado en RTX 3080 usa `ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors`. Estos sufijos son distintos formatos cuantizados y rutas de ejecución, no presets (ajustes guardados) de calidad que siempre puedas intercambiar. Los flujos de trabajo **Dev** y **distilled** usan supuestos de muestreo distintos, así que no pongas un checkpoint dev en el grafo destilado sin cambiar el flujo de trabajo. Que el checkpoint quepa no garantiza que vaya a caber un video más largo o de mayor resolución.

El flujo de trabajo oficial para principiantes usa `ltx-2.3-22b-dev-fp8.safetensors`, `ltx-2.3-22b-distilled-lora-384.safetensors`, `gemma_3_12B_it_fp4_mixed.safetensors` y `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`. Los flujos de trabajo personalizados pueden usar otros checkpoints, cuantizaciones, nodos de carga o carpetas. Los nombres de archivo guardados en el flujo de trabajo API deben coincidir exactamente con los archivos que ComfyUI puede ver. Si guardas los modelos en otra carpeta, como `LTX2/`, actualiza los valores de carga y exporta una copia API nueva.

Cuando compartas un flujo de trabajo, anota el modelo de tu GPU y su VRAM, la versión de ComfyUI, las versiones del controlador NVIDIA, CUDA, PyTorch y Python, los nodos personalizados y sus versiones, los nombres de archivo y las carpetas de los modelos, la resolución, la duración, el número de fotogramas clave y el tiempo de render, y si Krea 2 se ejecutó localmente o alojado.

Referencias oficiales:

- [Guía de imagen a video de LTX 2.3](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [Guía de prompts de LTX](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [Tarjeta del modelo LTX 2.3](https://huggingface.co/Lightricks/LTX-2.3)
- [Tarjeta del modelo LTX 2.3 NVFP4](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Ejemplos oficiales de LTX 2.3 para ComfyUI](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Pesos de la comunidad separados para ComfyUI y en FP8](https://huggingface.co/Kijai/LTX2.3_comfy)

## Guías relacionadas

- [Guía del agente Storyboard](storyboard.md)
- [Configuración del flujo de trabajo de ComfyUI](../media/comfyui.md)
- [Generación de video de escena](../media/scene-video.md)
- [Game Mode: primeros pasos](getting-started.md)
