# Guía del agente Storyboard

El agente descargable **Storyboard** (secuencia de viñetas) convierte un texto de historia ya terminado en imágenes ordenadas de fotogramas clave y, si quieres, en clips cortos de imagen a video. Funciona en Game Mode y en Roleplay. Los chats de Conversation no lo usan.

El paquete Storyboard aporta los prompts de planificación (las instrucciones enviadas a la IA), los valores predeterminados y los controles por chat. Marinara aporta la generación de medios, guarda los resultados en la Gallery (Galería) y los muestra en el chat o en el visor de Game. Esta guía cubre primero Game Mode. El flujo de trabajo de Roleplay viene después, en [Storyboards de Roleplay](#roleplay-storyboards). Para el resto de Roleplay, consulta [Modo Roleplay: primeros pasos](../roleplay/getting-started.md).

- **Game Mode** usa un turno de narración del GM (director del juego) ya terminado. Tiene interruptores separados de **Automatic Storyboard Illustrations** (Ilustraciones automáticas del storyboard) y **Automatic Storyboard Animations** (Animaciones automáticas del storyboard), y **Gallery → Create storyboard** (Galería → Crear storyboard) para el último turno del GM. Se muestra en un visor flotante o como fondo de Game, sincronizado con la narración, y usa planificadores separados para imágenes fijas y para animación.
- **Roleplay** usa los mensajes ya terminados desde el último episodio exitoso. Sus opciones automáticas son **Manual only** (Solo manual), **Still images** (Imágenes fijas) o **Animations** (Animaciones), y **Gallery → Create storyboard** actúa sobre la última respuesta del asistente ya terminada. Se muestra dentro del chat, debajo de la respuesta que cierra el episodio, y usa un contrato de episodio, un estilo visual, un complemento de animación opcional y un contrato de salida.

Los dos modos guardan las imágenes de fotogramas clave en la pestaña **Images** (Imágenes) de la Gallery, y los clips en su pestaña **Videos**.

## Instala el agente

1. Abre el panel **Agents** (Agentes) desde el icono de destellos.
2. Selecciona **Agent Organizer** (Organizador de agentes).
3. Abre **Storyboard** y selecciona **Install** (Instalar).
4. Abre un chat de Game o de Roleplay, y luego abre **Chat Settings → Agents** (Ajustes del chat → Agentes).
5. Activa **Enable Agents** (Activar agentes) y luego activa **Enable Storyboards** (Activar storyboards) en la tarjeta Storyboard.

Instalarlo deja el agente disponible, pero no lo activa en todos los chats. No hace falta reiniciar Marinara.

Si no funcionó y Storyboard no aparece en Chat Settings, comprueba que el paquete esté instalado, que el chat sea de Game o de Roleplay y que la versión del paquete funcione con tu versión de Marinara.

## Storyboards de Game Mode

El Storyboard de Game Mode usa exactamente un turno de narración del GM ya terminado como fuente de la historia. Elimina las etiquetas de comando ocultas del GM, planea fotogramas ordenados y ancla cada fotograma a un rango de secciones legibles del turno. El visor cambia de fotograma a medida que el lector avanza por esas secciones.

### Crea un Storyboard de Game

**Antes de empezar:** el juego necesita una cuenta de imagen (la propia del Game o una de la configuración global de Storyboard). Consulta [Proveedores de generación de imágenes y configuración](../media/image-providers.md).

1. Instala Storyboard y abre un chat de Game Mode.
2. Abre **Chat Settings → Agents**, activa **Enable Agents** y luego **Enable Storyboards**.
3. Termina un turno de narración del GM.
4. Abre **Chat Settings → Gallery** (Ajustes del chat → Galería) y selecciona **Create storyboard**.

Selecciona **View storyboard** (Ver storyboard) en la Gallery para volver a abrir un visor que hayas cerrado. La generación manual sigue el ajuste de animación actual: cuando **Automatic Storyboard Animations** está activado, un Storyboard manual también pide clips.

Si no funcionó, consulta [Solución de problemas](#troubleshooting).

### Storyboards automáticos en Game

La tarjeta Storyboard tiene dos interruptores:

- **Automatic Storyboard Illustrations** crea fotogramas clave fijos después de un turno del GM ya terminado.
- **Automatic Storyboard Animations** además crea un clip para cada fotograma clave. Activar las animaciones activa las ilustraciones, y desactivar las ilustraciones desactiva las animaciones.

La generación automática solo se ejecuta mientras el agente está activo en ese juego, y no vuelve a crear un Storyboard para un turno que ya tiene uno. Usa la acción manual de la Gallery cuando quieras otro para el último turno.

Si **Expose media prompts before sending** (Mostrar los prompts de medios antes de enviar) está activado en la configuración de Generation, un Storyboard manual de Game puede mostrar sus prompts de imagen compilados para que los revises. Los Storyboards automáticos se saltan la revisión para que la partida no se detenga.

### Ajustes de Game

Abre **Chat Settings → Agents → Storyboards**.

| Ajuste | Predeterminado del agente | Qué controla |
| --- | --- | --- |
| **Enable Storyboards** | Off en cada chat | Activa el agente instalado en este juego. |
| **Automatic Storyboard Illustrations** | Se deriva de Automatic generation | Fotogramas clave fijos después de cada turno del GM. |
| **Automatic Storyboard Animations** | Se deriva de Automatic generation | Clips MP4 para cada fotograma clave. |
| **Keyframes per Turn** (Fotogramas clave por turno) | 3 (de 1 a 200) | Cantidad de fotogramas que se busca. Los turnos cortos pueden dar menos. |
| **Animation Clip Duration** (Duración del clip de animación) | 5 segundos (de 1 a 15) | Duración que se pide para cada clip. Un servicio puede recortarla. |
| **Viewer Display** (Visualización del visor) | Floating | Visor arrastrable o fondo completo de Game. |
| **Illustration Planner** (Planificador de ilustraciones) | Still Keyframes | Planea ilustraciones fijas completas. |
| **Animation Planner** (Planificador de animación) | Comic Page Animation | Planea primeros fotogramas listos para animar e indicaciones de movimiento. |
| **Use Storyboard Template** (Usar la plantilla del storyboard) | On | Aplica el formateador de ilustración final seleccionado. |
| **Storyboard Illustration Prompt** (Prompt de ilustración del storyboard) | Game Scene Illustration | Da formato al fotograma planeado para el servicio de imágenes. |
| **Storyboard Video Prompt** (Prompt de video del storyboard) | Cinematic Scene Video | Da formato al primer fotograma y al plan de movimiento para el servicio de video. |

El paquete también aporta planificadores de NovelAI, cómic, manga y anime, además de planificadores orientados a LTX. Elegir un planificador de animación no activa el video por sí solo. Sigues necesitando **Automatic Storyboard Animations** y una cuenta de video.

Cada chat puede anular los valores predeterminados del agente. Chat Settings marca los valores heredados como **Using agent default** (Se usa el predeterminado del agente) y ofrece un control para restablecerlos en cuanto anulas uno.

### Cómo se construye un Storyboard de Game

Game Mode mantiene planificadores separados para las imágenes fijas y las animaciones.

```text
completed GM narration
  -> still or animation planner
  -> Storyboard Illustration Prompt
  -> image account
  -> optional Storyboard Video Prompt
  -> video account
```

El planificador elige y ordena los momentos de la historia. El prompt de ilustración es un formateador para el servicio, no otro planificador. Con las animaciones activadas, el planificador de animación produce una descripción exacta del primer fotograma y una indicación de movimiento, y el prompt de video convierte esa indicación de movimiento en la solicitud final.

### El visor del juego

- **Floating viewer** (Visor flotante) es un panel arrastrable y redimensionable que se coloca sobre el juego. Sigue la posición del lector en la narración y muestra el fotograma que le corresponde. Un video se reproduce cuando está listo; si no, se muestra la imagen del fotograma. Cerrarlo lo oculta durante el turno actual. Usa **Gallery → View storyboard** para volver a abrirlo.
- **Game background** (Fondo del juego) coloca el fotograma activo detrás del resto de la pantalla. Mientras está activo, reemplaza el fondo de escena generado, así que **Generate background** (Generar fondo) no está disponible. Los clips de fondo se reproducen una vez y quedan en su fotograma final.

Para repetir, reproducir/pausar y silenciar, abre **Game controls** (Controles del juego: el botón del mando de juego, cerca de la parte superior derecha del chat). Se abre como una ventana en una computadora o como un panel en un teléfono. Si lo moviste a Chat Settings, abre allí la sección **Game controls**.

### Storyboard Optimized no es el interruptor del agente

La presentación **Storyboard Optimized** del asistente cambia el prompt de narración del GM para que los turnos incluyan anclas visuales más filmables. No instala ni activa Storyboard, no activa los medios automáticos y no elige las cuentas de imagen y de video. Puedes usar el agente con **Standard** o con **Storyboard Optimized**. Instala y activa el agente por separado.

### Recetas para Game Mode

Cada receta combina una cadena de Storyboard con el resto de los ajustes de Game y del servicio. Aplica la cadena indicada si tu paquete la ofrece, o elige a mano las opciones de la lista.

#### Storyboards de cómic con Google

Cadena: **Illustration Planner** Still Keyframes, **Animation Planner** Comic Page Animation, **Storyboard Illustration Prompt** Game Scene Illustration, **Storyboard Video Prompt** Comic Page Video, **Use Storyboard Template** On.

Lista de comprobación del juego:

- **Illustrator**: On (paso Features del asistente)
- Cuenta de imagen: Google/Nano Banana, **Image Style**: Default, y conserva el estilo artístico que generó la configuración
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- Cuenta de video: None

Esto crea Storyboards fijos normales. La cadena de animación Comic Page guardada solo se aplica si más adelante eliges una cuenta de video y activas **Automatic Storyboard Animations**.

#### Etiquetas directas de NovelAI

Cadena: **Illustration Planner** NovelAI Keyframes. Para **Storyboard Illustration Prompt**, crea una opción propia cuyo prompt contenga solo el texto de abajo. Pon **Use Storyboard Template** en On. Deja sin cambios el Animation Planner y el Video Prompt.

```text
${scenePrompt}
```

Lista de comprobación del juego:

- **Image Style**: Danbooru, y quita el **Style text** en prosa del perfil Danbooru
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- Ajusta las etiquetas positivas, negativas y de ilustración según lo necesites

La plantilla de paso directo envía las etiquetas compactas de NovelAI del planificador sin envolverlas en el formateador en prosa habitual.

#### Krea 2 local + LTX 2.3

Cadena: **Illustration Planner** Still Keyframes como alternativa solo para imágenes fijas, **Animation Planner** LTX Simple Image-to-Video, **Storyboard Illustration Prompt** Storyboard First Frame, **Storyboard Video Prompt** Narration Passthrough, **Use Storyboard Template** On.

Con una GPU de 8 GB de VRAM, empieza con un solo fotograma clave a 480p. Cuando funcione, pasa a tres fotogramas clave y a tamaños más grandes. Para la cuenta de ComfyUI, los marcadores de posición y la prueba completa, consulta [Storyboards de LTX 2.3 en Game Mode](ltx-2-3-storyboards.md).

<a id="roleplay-storyboards"></a>

## Storyboards de Roleplay

Los Storyboards de Roleplay agrupan los intercambios ya terminados en un episodio visual que se muestra debajo de la respuesta del asistente que lo cierra.

### Crea un Storyboard de Roleplay

1. Instala Storyboard y actívalo en el chat de Roleplay.
2. En **Chat Settings → Agents → Storyboards**, elige una **Prompt connection** (Conexión de prompt) y un **Image model** (Modelo de imagen), o déjalos en **Use global default** (Usar el predeterminado global) cuando la configuración global esté completa.
3. Elige un **Automatic mode** (Modo automático):
   - **Manual only**: no hay episodio automático. **Create storyboard** crea un episodio de imágenes fijas cuando lo pides.
   - **Still images**: crea automáticamente un episodio ilustrado.
   - **Animations**: crea automáticamente las imágenes de fotogramas clave y un clip para cada fotograma. Hace falta una cuenta de video.
4. Fija **Messages per episode** (Mensajes por episodio) y **Keyframes per episode** (Fotogramas clave por episodio).
5. Termina una respuesta nueva del asistente, o abre **Chat Settings → Gallery** y selecciona **Create storyboard**.

Usa las flechas de un Storyboard con varios fotogramas clave para moverte entre los fotogramas. Un fotograma animado muestra su clip dentro del chat y recurre a su imagen mientras el clip está pendiente o no está disponible.

### Cómo funciona el intervalo de episodio

El intervalo es cuántos mensajes nuevos del usuario y del asistente deben acumularse entre Storyboards automáticos exitosos. Los dos roles cuentan, y el episodio incluye los mensajes nuevos en orden. El valor predeterminado es 1, así que la siguiente respuesta terminada del asistente puede crear un episodio de inmediato. Un valor más alto deja que se acumulen más diálogo y más acción. El texto de origen se limita a los 20 mensajes más recientes y a 12.000 caracteres, para que un chat largo no pueda crear una solicitud de planificación sin límite.

El contador solo avanza después de que se guarda un Storyboard completo o parcial, así que un episodio fallido no consume el texto de origen. Abrir un chat existente no procesa de forma retroactiva las respuestas antiguas. La generación automática espera a que termine una respuesta nueva del asistente.

### Biblioteca de prompts de Roleplay

Roleplay crea una sola solicitud de planificación a partir de cuatro prompts seleccionados:

| Ajuste | Predeterminado | Para qué sirve |
| --- | --- | --- |
| **Episode contract** (Contrato de episodio) | Completed Roleplay Episode | Elige los momentos que respalda el texto de origen y los mantiene en el orden de los mensajes. |
| **Visual style** (Estilo visual) | Normal / Anime | El aspecto de cada fotograma clave. Otros: NovelAI, Comic, Colored Manga, B&W Manga. |
| **Animation addon** (Complemento de animación) | Simple Storyboard Motion | Solo se usa para los clips. Añade una acción realizable, el comportamiento de la cámara, el diálogo y el sonido del texto de origen, la ambientación y una pausa final. |
| **Output contract** (Contrato de salida) | Roleplay Keyframe JSON | Los campos estructurados de fotograma clave que devuelve el planificador. |

Después, el **Storyboard Illustration Prompt** da formato a cada primer fotograma para el servicio de imágenes y, con los clips activados, el **Storyboard Video Prompt** da formato al plan de movimiento. Abre la **Prompt library** (Biblioteca de prompts) contraída en Stage 1 para editarlos. Usa **Add option** (Añadir opción) para un prompt propio, y luego cámbiale el nombre, añade una descripción corta y edita el cuerpo. Puedes restaurar las opciones integradas a sus valores predeterminados. Editar un estilo visual de Roleplay no cambia los planificadores de Game Mode.

### Storyboard e Illustrator juntos

Storyboard es independiente de Illustrator, y las acciones manuales de Illustrator siguen disponibles. Cuando el Storyboard de Roleplay está en **Still images** o en **Animations**, Marinara omite la imagen automática habitual de Illustrator para esa respuesta, para que los dos no generen medios que compitan. **Manual only** deja sin cambios el camino de Illustrator.

## Ajustes del agente Storyboard

Abre el panel **Agents**, selecciona **Storyboard** y abre su configuración. Estos valores son los predeterminados para los chats que no tienen sus propias anulaciones.

| Ajuste | Predeterminado | Para qué sirve |
| --- | --- | --- |
| Conexión del agente | La cuenta de agente que hayas seleccionado | Planea el storyboard con un modelo. |
| **Image model** | **Use the chat image connection** (Usar la conexión de imagen del chat) | Crea cada fotograma clave. Hace falta una cuenta de imagen en algún punto de la cadena de reserva. |
| **Video connection** (Conexión de video) | **Use the chat video connection** (Usar la conexión de video del chat) | Crea los clips cuando las animaciones están activadas. |
| **Automatic generation** (Generación automática) | Still images | El comportamiento automático inicial de los chats recién activados. |
| **Keyframes per turn** (Fotogramas clave por turno) | 3 (de 1 a 200) | Cantidad de fotogramas ordenados que se busca. |
| **Clip seconds** (Segundos por clip) | 5 (de 1 a 15) | Duración que se pide para cada clip. |
| **Viewer display** (Visualización del visor) | Floating viewer | El visor predeterminado de Game. Roleplay siempre muestra los Storyboards dentro del chat. |
| **Default Roleplay episode interval** (Intervalo de episodio predeterminado en Roleplay) | 1 (de 1 a 100) | El material nuevo de Roleplay que hace falta entre episodios automáticos. |
| **Attach Card Appearance** (Adjuntar la apariencia de la tarjeta) | On | Añade a los prompts de imagen la apariencia del personaje que coincide. Una tarjeta o persona con **Image Appearance Override** (Apariencia alternativa para imágenes) activado aporta ese texto en lugar de su campo **Appearance** (Apariencia). |
| **Send Avatar References** (Enviar referencias de avatar) | On | Envía los avatares del personaje y de la persona que coinciden cuando el servicio de imágenes acepta referencias. |
| **Use the final image template** (Usar la plantilla de imagen final) | On | Da formato a un fotograma planeado antes de que vaya al servicio de imágenes. En un chat de Game, es **Use Storyboard Template**. |
| **Use NovelAI character prompts** (Usar prompts de personaje de NovelAI) | On | Prompts nativos por personaje solo en cuentas oficiales compatibles de NovelAI V4 y V4.5. Los demás servicios usan el camino de prompt compartido. |

Para Game Mode, la biblioteca tiene dos vías de planificación, que se eligen según si el juego crea imágenes fijas o clips: **Still planner** (Planificador de imágenes fijas: Still Keyframes de forma predeterminada) y **Animation planner** (Planificador de animación: Comic Page Animation de forma predeterminada). El texto de los planificadores se puede editar en la configuración global del agente, y cada chat de Game elige entre las opciones en sus propios ajustes.

Después de planificar, unos formateadores compartidos crean las solicitudes finales: **Default image prompt** (Prompt de imagen predeterminado: Game Scene Illustration) y **Default video prompt** (Prompt de video predeterminado: Cinematic Scene Video). Cada etapa numerada tiene su propia **Prompt library** contraída: Stage 2 para los formateadores de imagen, Stage 3 para los planificadores de movimiento que tienen en cuenta la imagen y Stage 4 para los formateadores de video que transmiten el prompt sin cambios. Las opciones de imagen también incluyen **Storyboard Illustration** y **Storyboard First Frame**. Las opciones de video incluyen **Anime Game Video**, **Comic Page Video** y **Narration Passthrough**. Los chats de Game y de Roleplay pueden elegir formateadores distintos.

La **Image-aware shot planning** (Planificación de planos según la imagen) de Stage 3 también sigue las **Video prompting instructions** (Instrucciones para prompts de video) de la cuenta de video. Usa ese campo en el editor de cuentas para indicar lo que espera tu modelo de video, como el vocabulario de cámara, la longitud del prompt o las indicaciones de sonido.

Las cuentas se eligen de forma un poco distinta según el modo. Roleplay tiene selectores de prompt, de imagen y de video por chat, y **Use global default** hereda la configuración de Storyboard. Game Mode usa sus propias cuentas de planificación, de imagen y de video cuando están configuradas, y si no, recurre a los valores predeterminados del agente. Las imágenes fijas necesitan una cuenta de imagen. Las animaciones necesitan una imagen de fotograma clave generada con éxito y una cuenta de video.

## Prompts de imagen y consistencia de los personajes

El planificador decide qué momentos mostrar y escribe el contenido visual de cada fotograma. La plantilla de imagen final añade la estructura de cara al servicio, la apariencia del personaje que coincide, el manejo de las referencias, el contexto de la ubicación, la dirección artística de la campaña y las instrucciones de imagen.

Cuando un planificador ya devuelve la sintaxis exacta que debe recibir el servicio de imágenes, usa una plantilla de paso directo como `${scenePrompt}`. Desactiva **Use the final image template** solo para saltarte el formateador a propósito. Las instrucciones de imagen obligatorias se siguen aplicando.

Para lograr personajes más constantes:

- Mantén específicos y al día los campos Appearance de la tarjeta de personaje.
- Deja **Attach Card Appearance** activado, salvo que el planificador ya repita los detalles necesarios.
- Deja **Send Avatar References** activado cuando el servicio acepte referencias y los avatares coincidan con el aspecto que buscas.
- Prefiere un reparto pequeño y claramente visible en cada fotograma. Storyboard incluye solo los personajes y las personas visibles que coinciden, no a todos los del chat.

## Costo y rendimiento

Cada fotograma clave es un trabajo de imagen aparte. Los Storyboards animados añaden un trabajo de video por cada fotograma clave que salga bien, así que un Storyboard animado de tres fotogramas puede hacer tres solicitudes de imagen y tres solicitudes de video. Cuando pruebes un servicio nuevo o una configuración local, empieza con imágenes fijas y un solo fotograma clave. Sube la cantidad de fotogramas, la duración de los clips y el intervalo automático solo cuando el camino básico funcione.

## Juegos del sistema de Storyboard anterior

Los chats de Game existentes pueden conservar ajustes de la antigua interfaz de Storyboard integrada. Marinara los conserva como anulaciones por chat cuando el paquete está instalado, así que un juego antiguo puede comportarse de forma distinta a los valores predeterminados actuales del agente. Abre **Chat Settings → Agents → Storyboards** y usa el control de restablecer de cada campo para que vuelva a seguir el valor predeterminado del agente. Estos ajustes son solo datos de migración. La generación sigue necesitando que el paquete esté instalado y activo en el juego.

<a id="troubleshooting"></a>

## Solución de problemas

### Create storyboard está disponible, pero la generación falla

- Activa **Enable Agents** y **Enable Storyboards** en el chat.
- Elige una cuenta de generación de imágenes válida en la tarjeta Storyboard de Roleplay, en los ajustes de Game o en la configuración global de Storyboard.
- Espera a que termine la respuesta del asistente o del GM y vuelve a intentarlo.

### Roleplay no creó un episodio automático

- Elige **Still images** o **Animations**, no **Manual only**.
- Espera a que termine una respuesta nueva del asistente. Abrir un chat no procesa de forma retroactiva los mensajes antiguos.
- Revisa **Messages per episode**. Tienen que acumularse suficientes mensajes nuevos del usuario y del asistente.
- Una ejecución fallida no hace avanzar el contador, así que revisa el registro del servidor para encontrar el error original del servicio o de análisis.

### Aparecen imágenes, pero no videos

- En Roleplay, elige **Animations**. En Game Mode, activa **Automatic Storyboard Animations**.
- Elige una cuenta de Video Generation que admita entrada de imagen a video.
- Revisa la pestaña **Videos** de la Gallery. Un clip puede terminar después de la imagen de su fotograma clave.
- Si la planificación recurrió a una alternativa tras un fallo del modelo, Marinara puede conservar las imágenes de reserva y omitir los videos de esa ejecución.

### Un Storyboard está incompleto o atascado

Puede que un trabajo del servicio haya fallado, agotado el tiempo de espera o alcanzado un límite de tasa o de contenido. Si el servicio funciona bien pero va lento, sube `IMAGE_GEN_TIMEOUT_MS` o `VIDEO_GEN_TIMEOUT_MS` en `.env` y luego reinicia Marinara, porque estos valores se leen al arrancar. Consulta [Configuración](../CONFIGURATION.md).

Activa el modo Debug y busca `storyboard` en el registro del servidor para ver el planificador, el prompt de imagen compilado, la selección de referencias y el prompt de video. Los registros de depuración pueden contener texto privado del chat, así que límpialos antes de compartirlos.

## Guías relacionadas

- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Game Mode: primeros pasos](getting-started.md)
- [Modo Roleplay: primeros pasos](../roleplay/getting-started.md)
- [Proveedores de generación de imágenes y configuración](../media/image-providers.md)
- [Generación de video de escena](../media/scene-video.md)
- [Storyboards de LTX 2.3 en Game Mode](ltx-2-3-storyboards.md)
