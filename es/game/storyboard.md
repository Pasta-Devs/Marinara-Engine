# Guía del agente Storyboard

El agente descargable **Storyboard** (secuencia de viñetas) convierte un texto de historia ya terminado en imágenes ordenadas de fotogramas clave y, si quieres, en clips cortos de imagen a video. Funciona en **Roleplay** y en **Game Mode** (modo juego). Los chats de Conversation no usan Storyboard.

Este es el flujo de trabajo actual, basado en agentes. El paquete Storyboard aporta los prompts de planificación (las instrucciones enviadas a la IA), los valores predeterminados y los controles por chat. Marinara Engine aporta la integración de la aplicación anfitriona que genera los medios, los guarda en la **Gallery** (Galería) y los muestra en el chat o en el visor del juego.

## Roleplay y Game Mode de un vistazo

| | Roleplay | Game Mode |
| --- | --- | --- |
| Fuente de la historia | Los mensajes del usuario y del asistente ya terminados desde el episodio exitoso anterior | Un turno de narración del GM (director del juego) ya terminado |
| Opciones automáticas | **Manual only** (Solo manual), **Still images** (Imágenes fijas) o **Animations** (Animaciones) | Interruptores separados de **Automatic Storyboard Illustrations** (Ilustraciones automáticas del storyboard) y **Automatic Storyboard Animations** (Animaciones automáticas del storyboard) |
| Acción manual | **Gallery > Create storyboard** (Crear storyboard) para la última respuesta del asistente ya terminada | **Gallery > Create storyboard** para el último turno del GM ya terminado |
| Visualización | Dentro del chat, debajo de la respuesta del asistente que cierra el episodio | Visor flotante o fondo del juego, sincronizado con la narración |
| Prompts de planificación | Contrato de episodio, estilo visual, complemento de animación opcional y contrato de salida | Planificadores separados para imágenes fijas y para animación |
| Prompts finales compartidos | Prompt de imagen para la ilustración y prompt de video para la animación | Prompt de imagen para la ilustración y prompt de video para la animación |

Los dos modos guardan las imágenes de fotogramas clave en la pestaña **Images** de la **Gallery**, y los clips en su pestaña **Videos**.

## Instala el agente

1. Abre el panel **Agents** (Agentes) desde el icono de destellos.
2. Selecciona **Download Agents** (Descargar agentes).
3. Abre **Storyboard** y selecciona **Install** (Instalar).
4. Abre un chat de Roleplay o de Game, y luego abre **Chat Settings > Agents** (Ajustes del chat > Agentes).
5. Activa **Enable Agents** (Activar agentes) y luego activa **Enable Storyboards** (Activar storyboards) en la tarjeta Storyboard.

Instalar el paquete lo deja disponible para los chats compatibles; no lo activa en silencio en todos los chats. El paquete actual no necesita que reinicies Marinara después de instalarlo.

Si Storyboard no aparece en **Chat Settings**, comprueba que el paquete esté instalado y que el chat esté en Roleplay o en Game Mode.

## Ajustes del agente Storyboard

Abre el panel **Agents**, selecciona **Storyboard** y abre su configuración. Estos valores son los predeterminados para los chats que no tienen sus propias anulaciones.

### Valores predeterminados de generación y medios

| Ajuste | Predeterminado | Para qué sirve |
| --- | --- | --- |
| Conexión del agente | La conexión de agente que hayas seleccionado | Planea el storyboard con un LLM (modelo de lenguaje) |
| **Image connection** (Conexión de imagen) | Use the Game image connection | Genera cada fotograma clave; hace falta una conexión de imagen en algún punto de la cadena de reserva |
| **Video connection** (Conexión de video) | Use the Game video connection | Genera los clips cuando las animaciones están activadas |
| **Automatic generation** (Generación automática) | Still images | Elige el comportamiento automático inicial de los chats recién activados |
| **Keyframes per turn** (Fotogramas clave por turno) | 3, rango de 1 a 6 | Fija cuántos fotogramas ordenados se buscan |
| **Clip seconds** (Segundos por clip) | 5, rango de 1 a 15 | Fija la duración que se pide para cada clip |
| **Viewer display** (Visualización del visor) | Floating viewer | Fija el visor predeterminado de Game Mode; Roleplay siempre muestra los Storyboards dentro del chat |
| **Default Roleplay episode interval** (Intervalo de episodio predeterminado en Roleplay) | 1, rango de 1 a 100 | Fija cuánto material nuevo de Roleplay se acumula entre episodios automáticos |
| **Attach Card Appearance** (Adjuntar la apariencia de la tarjeta) | On | Añade a los prompts de imagen los detalles de apariencia del personaje que coincide |
| **Send Avatar References** (Enviar avatares de referencia) | On | Envía los avatares del personaje y de la persona que coinciden, cuando el proveedor de imágenes admite referencias |
| **Use the final image template** (Usar la plantilla de imagen final) | On | Da formato a un fotograma planeado antes de enviarlo al proveedor de imágenes |
| **Use NovelAI character prompts** (Usar prompts de personaje de NovelAI) | On | Usa el sistema nativo de prompts por personaje en las conexiones oficiales compatibles de NovelAI V4/V4.5 |

### Biblioteca de prompts de Game

La biblioteca de Game aporta dos vías de planificación distintas. La vía activa depende de si el juego está creando imágenes fijas o clips.

| Ajuste | Predeterminado | Para qué sirve |
| --- | --- | --- |
| **Still planner** (Planificador de imágenes fijas) | Still Keyframes | Divide un turno del GM ya terminado en momentos completos de imagen fija |
| **Animation planner** (Planificador de animación) | Comic Page Animation | Crea primeros fotogramas listos para animar e indicaciones de movimiento que tienen en cuenta la duración |

El paquete también incluye planificadores de NovelAI, cómic, manga a color, manga en blanco y negro y episodio de anime, además de planificadores orientados a LTX. El texto del prompt de cada planificador se puede editar en la configuración global del agente. El chat de Game elige entre las opciones de imagen fija y de animación en **Chat Settings > Agents > Storyboards**.

### Biblioteca de prompts de Roleplay

Roleplay reúne cuatro prompts seleccionados en una sola solicitud de planificación.

| Ajuste | Predeterminado | Para qué sirve |
| --- | --- | --- |
| **Episode contract** (Contrato de episodio) | Completed Roleplay Episode | Elige los momentos ya terminados que respalda el texto de origen y los mantiene en el orden de los mensajes |
| **Visual style** (Estilo visual) | Normal / Anime | Define el tratamiento visual de cada fotograma clave |
| **Animation addon** (Complemento de animación) | Simple Storyboard Motion | Añade movimiento, cámara, diálogo y sonido del texto de origen, ambientación y una pausa final, solo para los clips |
| **Output contract** (Contrato de salida) | Roleplay Keyframe JSON | Define los campos estructurados de fotograma clave que devuelve el planificador |

Abre **Prompt library** (Biblioteca de prompts), contraída dentro de Stage 1, para editar estas colecciones completas. Usa **Add option** (Añadir opción) para crear un prompt propio, cámbiale el nombre, añade una descripción corta y edita el cuerpo del prompt. Las opciones integradas se pueden restaurar a los valores predeterminados del paquete.

### Formateadores de proveedor compartidos

Después de que cualquiera de los dos modos planea sus fotogramas, unos formateadores compartidos crean las solicitudes finales para el proveedor.

| Ajuste | Predeterminado | Para qué sirve |
| --- | --- | --- |
| **Default image prompt** (Prompt de imagen predeterminado) | Game Scene Illustration | Da formato a cada fotograma clave planeado para el proveedor de imágenes |
| **Default video prompt** (Prompt de video predeterminado) | Cinematic Scene Video | Da formato a la imagen del primer fotograma y al plan de movimiento para el proveedor de video |

Cada etapa numerada tiene su propia **Prompt library** contraída: Stage 2 contiene los formateadores de imagen, Stage 3 los planificadores de movimiento que tienen en cuenta la imagen y Stage 4 los formateadores que transmiten el prompt de video sin cambios. Las opciones de imagen integradas también incluyen **Storyboard Illustration** y **Storyboard First Frame**. Las opciones de video incluyen **Anime Game Video**, **Comic Page Video** y **Narration Passthrough**. Los chats de Game y de Roleplay pueden seleccionar formateadores distintos sin cambiar la colección de prompts compartida subyacente.

### Valores predeterminados globales y anulaciones por chat

Cada chat puede anular los valores predeterminados del agente. **Chat Settings** marca los valores heredados como **Using agent default** (Se usa el predeterminado del agente) y ofrece un control para restablecerlos en cuanto creas una anulación.

El orden de prioridad de las conexiones cambia un poco según el modo:

- Roleplay ofrece selectores de prompt, de imagen y de video por chat. **Use global default** (Usar el predeterminado global) hereda la configuración de Storyboard.
- Game Mode usa sus conexiones de planificación, de imagen y de video propias del juego cuando están configuradas, y si no, recurre a los valores predeterminados del agente Storyboard.

Para las imágenes fijas hace falta una conexión de imagen. Las animaciones necesitan tanto una imagen de fotograma clave generada con éxito como una conexión de video.

## Storyboards de Roleplay

Los Storyboards de Roleplay agrupan los intercambios ya terminados en un episodio visual y lo muestran debajo de la respuesta del asistente que lo cierra.

### Inicio rápido

1. Instala Storyboard y actívalo en el chat de Roleplay.
2. En **Chat Settings > Agents > Storyboards**, selecciona una **Prompt connection** (Conexión de prompt) y una **Image connection**, o déjalas en **Use global default** si la configuración global ya está completa.
3. Elige un **Automatic mode** (Modo automático):
   - **Manual only**: no hay episodio automático; **Create storyboard** crea un episodio de imágenes fijas cuando tú lo pides.
   - **Still images**: crea automáticamente un episodio ilustrado.
   - **Animations**: crea automáticamente las imágenes de fotogramas clave y un clip para cada fotograma; hace falta una conexión de video.
4. Fija **Messages per episode** (Mensajes por episodio) y **Keyframes per episode** (Fotogramas clave por episodio).
5. Termina una respuesta nueva del asistente, o abre la **Gallery** y selecciona **Create storyboard**.

Usa las flechas de un Storyboard con varios fotogramas clave para moverte entre ellos. Un fotograma animado muestra su clip reproducible dentro del chat, y recurre a su imagen mientras el clip está pendiente o no está disponible.

### Cómo funciona el intervalo de episodio

El intervalo controla cuántos mensajes nuevos del usuario y del asistente se acumulan entre Storyboards automáticos exitosos. Los dos roles de mensaje hacen avanzar el intervalo, y el episodio incluye los mensajes nuevos en orden cronológico.

El valor predeterminado es 1, así que la siguiente respuesta del asistente recién terminada ya puede producir un episodio. Un valor más alto deja que se acumulen más diálogo y más acción. El texto de origen se limita a los 20 mensajes más recientes y a 12 000 caracteres, para que un chat antiguo o muy largo no pueda crear una solicitud de planificación sin límite.

El punto de referencia de la cadencia solo avanza cuando se guarda un Storyboard completo o parcial. Un episodio fallido no consume el material de origen. Abrir un chat existente no procesa de forma retroactiva las respuestas antiguas; la generación automática espera a que termine una respuesta nueva del asistente.

### Cadena de prompts de Roleplay

Roleplay usa cuatro capas de planificación antes de los formateadores de proveedor compartidos:

1. **Episode contract** selecciona momentos de la historia ya terminados y respaldados por el texto de origen, y los ancla a los mensajes suministrados.
2. **Visual style** elige el tratamiento Normal/Anime, NovelAI, Comic, Colored Manga o B&W Manga.
3. **Animation addon** solo se añade en los Storyboards animados. Describe una acción realizable, el comportamiento de la cámara, el diálogo y el sonido respaldados por el texto de origen, la ambientación y una pausa final.
4. **Output contract** define el resultado estructurado de fotogramas clave que devuelve el planificador.

Después, el **Storyboard Illustration Prompt** (Prompt de ilustración del storyboard) da formato a cada primer fotograma planeado para el proveedor de imágenes. Cuando los clips están activados, el **Storyboard Video Prompt** (Prompt de video del storyboard) da formato al plan de movimiento para el proveedor de video.

La biblioteca de prompts de Roleplay es independiente de la biblioteca de planificadores de Game. Editar un estilo visual de Roleplay no reescribe los planificadores de imagen fija ni de animación de Game Mode.

### Storyboard e Illustrator juntos

Storyboard es un agente distinto de Illustrator. Las acciones manuales de Illustrator y sus demás medios siguen disponibles. Cuando el Storyboard de Roleplay está en **Still images** o en **Animations**, Marinara suprime la imagen automática de primer plano que Illustrator suele crear para esa respuesta terminada, para que los dos agentes no generen medios que compitan después de la respuesta. **Manual only** deja el camino normal de Illustrator sin cambios.

## Storyboards del Game Mode

El Storyboard del Game Mode usa exactamente un turno de narración del GM ya terminado como fuente de la historia. Elimina las etiquetas de comando ocultas del GM, planea fotogramas ordenados y ancla cada fotograma a un rango de secciones legibles del turno. El visor cambia de fotograma a medida que el lector avanza por esas secciones.

### Inicio rápido

1. Instala Storyboard.
2. Crea o abre un chat en Game Mode.
3. Abre **Chat Settings > Agents**, activa **Enable Agents** y luego activa **Enable Storyboards**.
4. Comprueba que el juego tenga una conexión de imagen, o que la configuración global de Storyboard aporte una.
5. Termina un turno de narración del GM.
6. Abre la **Gallery** y selecciona **Create storyboard**.

Selecciona **View storyboard** (Ver storyboard) en la **Gallery** para volver a abrir un visor del juego que hayas cerrado. La generación manual usa el ajuste de animación actual: cuando **Automatic Storyboard Animations** está activado, el Storyboard manual también pide clips.

### Storyboards automáticos en Game

La tarjeta Storyboard tiene dos interruptores de automatización:

- **Automatic Storyboard Illustrations** crea fotogramas clave fijos después de un turno del GM ya terminado.
- **Automatic Storyboard Animations** además crea un clip para cada fotograma clave. Activar las animaciones activa también las ilustraciones; desactivar las ilustraciones desactiva las animaciones.

La generación automática no se ejecuta si el agente Storyboard no está activo en ese juego. Tampoco vuelve a crear un Storyboard para un turno que ya tiene uno. Usa la acción manual de la **Gallery** cuando quieras crear otro Storyboard a propósito para el último turno.

Si **Expose image prompts before sending** (Mostrar los prompts de imagen antes de enviarlos) está activado en la configuración de Generation, un Storyboard manual de Game puede mostrarte los prompts de imagen compilados para que los revises. Los Storyboards automáticos siguen adelante sin ventana de revisión, para no detener la partida.

### Ajustes de Game

Abre **Chat Settings > Agents > Storyboards**.

| Ajuste | Predeterminado del agente | Qué controla |
| --- | --- | --- |
| **Enable Storyboards** | Off en cada chat | Activa el agente instalado en este juego |
| **Automatic Storyboard Illustrations** | Se deriva de Automatic generation | Fotogramas clave fijos después de cada turno del GM terminado |
| **Automatic Storyboard Animations** | Se deriva de Automatic generation | Clips MP4 para cada fotograma clave |
| **Keyframes per Turn** | 3, rango de 1 a 6 | Cantidad de fotogramas que se busca; los turnos cortos pueden dar menos |
| **Animation Clip Duration** (Duración del clip de animación) | 5 segundos, rango de 1 a 15 | Duración que se pide para cada clip; un proveedor puede recortarla |
| **Viewer Display** | Floating | Visor arrastrable o fondo completo del juego |
| **Still Planner** | Still Keyframes | Planea ilustraciones fijas completas |
| **Animation Planner** | Comic Page Animation | Planea primeros fotogramas listos para animar e indicaciones de movimiento |
| **Use Storyboard Template** (Usar la plantilla del storyboard) | On | Aplica el formateador de ilustración final seleccionado |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Da formato al fotograma planeado para el proveedor de imágenes |
| **Storyboard Video Prompt** | Cinematic Scene Video | Da formato al primer fotograma y al plan de movimiento para el proveedor de video |

El paquete también aporta planificadores de NovelAI, cómic, manga y anime, además de planificadores orientados a LTX. Elegir un planificador de animación no activa por sí solo la generación de video; sigues necesitando **Automatic Storyboard Animations** y una conexión de video.

### Cadena de prompts de Game

Game Mode mantiene planificadores separados para los resultados fijos y los animados:

```text
completed GM narration
  -> Still Planner or Animation Planner
  -> Storyboard Illustration Prompt
  -> image connection
  -> optional Storyboard Video Prompt
  -> video connection
```

El planificador elige y ordena los momentos de la historia. El prompt de ilustración es un formateador de cara al proveedor, no un segundo planificador de historia. Cuando las animaciones están activadas, el planificador de animación produce tanto una descripción exacta del primer fotograma como una indicación de movimiento; el prompt de video convierte esa indicación de movimiento en la solicitud final.

### Recetas revisadas para Game Mode

Estas recetas combinan una cadena de Storyboard aplicada por el paquete con el resto de los ajustes del juego y del proveedor. Aplica la cadena indicada cuando tu paquete la ofrezca, o reproduce a mano las selecciones de la lista.

#### Storyboards de cómic con Google

Cadena aplicada por el paquete:

- **Illustration Planner**: Still Keyframes
- **Animation Planner**: Comic Page Animation
- **Storyboard Illustration Prompt**: Game Scene Illustration
- **Storyboard Video Prompt**: Comic Page Video
- **Use Storyboard Template**: On

Lista de comprobación del juego:

- **Visual Generation**: On
- **Image Connection**: Google/Nano Banana
- **Image Style**: Default
- Conserva el estilo artístico que generó el asistente de configuración.
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- **Video Connection**: None

Esto crea Storyboards fijos normales. La cadena de animación Comic Page guardada solo se activa si más adelante seleccionas una conexión de video y activas **Automatic Storyboard Animations**.

#### Etiquetas directas de NovelAI

Cadena aplicada por el paquete:

- **Illustration Planner**: NovelAI Keyframes
- **Storyboard Illustration Prompt**: crea una opción propia cuyo prompt contenga solo esto:

  ```text
  ${scenePrompt}
  ```

- **Use Storyboard Template**: On
- Deja sin cambios el Animation Planner y el Storyboard Video Prompt.

Lista de comprobación del juego:

- **Image Style**: Danbooru
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- Quita el **Style Text** en prosa del perfil Danbooru.
- Ajusta las etiquetas positivas, negativas y de ilustración según lo necesites.

La plantilla propia de paso directo envía las etiquetas compactas de NovelAI del planificador sin envolverlas en el formateador de ilustración en prosa habitual.

#### Krea 2 local + LTX 2.3

Cadena aplicada por el paquete:

- **Illustration Planner**: Still Keyframes como alternativa solo para imágenes fijas
- **Animation Planner**: LTX Simple Image-to-Video
- **Storyboard Illustration Prompt**: Storyboard First Frame
- **Storyboard Video Prompt**: Narration Passthrough
- **Use Storyboard Template**: On

Con una GPU de 8 GB de VRAM, empieza con un solo fotograma clave a 480p. Cuando eso funcione bien, pasa a tres fotogramas clave y a resoluciones más altas. Consulta [Storyboards de LTX 2.3 en Game Mode](ltx-2-3-storyboards.md) para ver la conexión de ComfyUI, los marcadores de posición y el procedimiento de prueba completo.

### La presentación Storyboard Optimized no es el interruptor del agente

La presentación **Storyboard Optimized** del asistente de configuración del juego cambia el prompt de narración del GM para que los turnos incluyan anclas visuales más filmables. No instala ni activa Storyboard, no activa los medios automáticos y no elige las conexiones de imagen y de video.

Puedes usar el agente Storyboard con la presentación Standard o con Storyboard Optimized. Instala y activa el agente por separado.

### El visor del juego

**Floating viewer** es un panel arrastrable y redimensionable que se coloca sobre el juego. Sigue la posición del lector dentro de la narración del GM y muestra el fotograma que le corresponde. El video se reproduce cuando está listo; si no, recurre a la imagen del fotograma.

**Game background** coloca el fotograma activo detrás de los controles del juego. Mientras este modo está activo, reemplaza el fondo de escena generado normal, así que la acción habitual **Generate background** (Generar fondo) no está disponible. Los clips de fondo se reproducen una vez y se quedan en su fotograma final; los controles del juego ofrecen repetir, reproducir/pausar y silenciar.

Cerrar el visor flotante lo oculta durante el turno actual. Usa **Gallery > View storyboard** para volver a abrirlo.

## Prompts de imagen y consistencia de los personajes

El planificador seleccionado y el prompt de imagen final hacen trabajos distintos:

- El planificador decide qué momentos mostrar y escribe el contenido visual de cada fotograma.
- La plantilla de imagen final añade la estructura de cara al proveedor, la apariencia del personaje que coincide, el manejo de las referencias, el contexto de la ubicación, la dirección artística de la campaña y las instrucciones de imagen.

Cuando un planificador ya devuelve la sintaxis exacta de prompt que debe recibir el proveedor de imágenes, usa una plantilla de paso directo como `${scenePrompt}`. Desactiva **Use the final image template** solo si de verdad quieres saltarte el formateador seleccionado. Las instrucciones de imagen obligatorias se siguen aplicando.

Para lograr personajes más constantes:

- Mantén específicos y al día los campos de apariencia de la tarjeta de personaje.
- Deja **Attach Card Appearance** activado, salvo que el planificador seleccionado ya repita todos los detalles de apariencia necesarios.
- Deja **Send Avatar References** activado cuando el proveedor acepte referencias y los avatares coincidan con el aspecto que buscas.
- Prefiere pocos personajes claramente visibles en cada fotograma. Storyboard incluye solo las referencias de personaje y de persona visibles que coinciden, no todos los personajes del chat.

**Use NovelAI character prompts** solo cambia las solicitudes que se envían por conexiones oficiales compatibles de NovelAI V4/V4.5. Los demás proveedores usan el camino de prompt compartido aunque el interruptor esté activado.

## Costo y rendimiento

Cada fotograma clave es un trabajo de imagen aparte. Los Storyboards animados añaden un trabajo de video por cada fotograma clave que salga bien. Por eso, un Storyboard animado de tres fotogramas puede hacer tres solicitudes de imagen y tres solicitudes de video.

Cuando pruebes un proveedor nuevo o un flujo de trabajo local, empieza con imágenes fijas y un solo fotograma clave. Sube la cantidad de fotogramas, la duración de los clips y la cadencia automática solo cuando el camino básico sea fiable.

## Juegos existentes del sistema de Storyboard anterior

Ahora Storyboard es un agente descargable, pero los chats de Game existentes pueden conservar ajustes explícitos creados por la antigua interfaz de Storyboard integrada en el Engine. Cuando instalas el paquete, Marinara conserva esos valores como anulaciones por chat; no descarta una configuración de juego que ya funciona.

Esto significa que un juego antiguo puede comportarse de forma distinta a los valores predeterminados actuales del agente. Abre **Chat Settings > Agents > Storyboards** y usa el control de restablecer de cada campo cuando quieras que vuelva a heredar el valor predeterminado del agente Storyboard.

Los ajustes antiguos son datos de migración, no una segunda implementación de Storyboard. La generación actual sigue necesitando que el paquete Storyboard esté instalado y activo en ese juego.

## Solución de problemas

### Storyboard no aparece en Chat Settings

- Instala **Storyboard** desde **Agents > Download Agents**.
- Usa un chat de Roleplay o de Game; Conversation no es compatible.
- Comprueba que la versión del paquete sea compatible con la versión instalada del Engine.

### Create storyboard está disponible, pero la generación falla

- Activa **Enable Agents** y **Enable Storyboards** en el chat.
- Selecciona una conexión de generación de imágenes válida en la tarjeta Storyboard de Roleplay, en los ajustes de Game o en la configuración global de Storyboard.
- Espera a que la respuesta del asistente o del GM termine antes de volver a intentarlo.

### Roleplay no creó un episodio automático

- Elige **Still images** o **Animations**, no **Manual only**.
- Espera a que termine una respuesta nueva del asistente. Abrir un chat no recupera de forma retroactiva los mensajes antiguos.
- Revisa **Messages per episode**. El punto de referencia de la cadencia exitosa tiene que acumular suficientes mensajes nuevos del usuario y del asistente.
- Una ejecución fallida no hace avanzar ese punto de referencia, así que revisa el registro del servidor para encontrar el error original del proveedor o de análisis.

### Aparecen imágenes, pero no videos

- En Roleplay, elige **Animations**. En Game Mode, activa **Automatic Storyboard Animations**.
- Selecciona una conexión de Video Generation.
- Comprueba que la conexión de video admita entrada de imagen a video.
- Revisa la pestaña **Videos** de la **Gallery**. Un clip puede terminar después de la imagen de su fotograma clave.
- Si la planificación recurrió a una alternativa tras un fallo del LLM, Marinara puede conservar las imágenes de reserva y omitir los videos de esa ejecución.

### Un Storyboard está incompleto o atascado

Puede que uno o más trabajos del proveedor hayan fallado, agotado el tiempo de espera o alcanzado un límite de tasa o de contenido. Si el proveedor funciona bien pero va lento, sube `IMAGE_GEN_TIMEOUT_MS` o `VIDEO_GEN_TIMEOUT_MS` en `.env` y luego reinicia Marinara, porque estos valores se leen al arrancar.

Activa el modo Debug y busca `storyboard` en el registro del servidor para revisar el planificador, el prompt de imagen compilado, la selección de referencias y el prompt de video. Los registros de depuración pueden contener texto privado del chat y prompts; límpialos antes de compartirlos.

## Guías relacionadas

- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Game Mode: primeros pasos](getting-started.md)
- [Modo Roleplay: primeros pasos](../roleplay/getting-started.md)
- [Proveedores de generación de imágenes y configuración](../media/image-providers.md)
- [Generación de video de escena](../media/scene-video.md)
- [Storyboards de LTX 2.3 en Game Mode](ltx-2-3-storyboards.md)
