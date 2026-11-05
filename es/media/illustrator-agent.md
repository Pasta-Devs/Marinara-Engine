# Agente Illustrator

El **Illustrator** (Ilustrador) es un agente descargable que dibuja imágenes de tus escenas mientras chateas. Esta guía muestra cómo activarlo, elegir un estilo de arte y un modelo de imagen, y crear clips. Un agente es un pequeño ayudante de IA que se ejecuta automáticamente para un chat.

## Qué hace el Illustrator

El Illustrator es un agente de posprocesamiento, así que se ejecuta después de que la IA termina cada respuesta. Lee la última respuesta y decide si el momento vale una imagen. Si la vale, escribe un prompt de imagen (el texto que le dice a un modelo de imágenes qué dibujar) y lo envía a tu servicio de imágenes. Cada imagen que crea se guarda en la **Gallery** (Galería) del chat.

No dibuja cada mensaje. Después de crear una imagen, espera de forma predeterminada 5 mensajes aceptados del usuario y del asistente antes de poder crear otra. Cada chat de Roleplay puede cambiar ese número. Hacer un swipe (respuesta alternativa) o regenerar una respuesta no avanza la cuenta. Si decide que un momento no vale una imagen, lo omite.

Funciona en chats de Roleplay y Game Mode. Al instalarlo también se añaden las selfies y los [mensajes de video](../conversation/selfies.md#video-messages) de Conversation. La configuración de esta guía es para Roleplay. Game Mode usa un solo interruptor (consulta [Game Mode](#game-mode-the-game-illustrator-toggle)).

## Antes de empezar

El Illustrator escribe el prompt, pero un modelo de imagen aparte dibuja la imagen. Necesitas uno. Consulta [Proveedores de generación de imágenes y configuración](image-providers.md).

Dale un modelo de imagen de una de estas dos maneras.

1. Establece la tarea **Images** (Imágenes) en **Defaults** (Predeterminados) del panel **Connections** (Conexiones).
2. O dale al Illustrator su propio modelo de imagen en su pantalla **Open Setup** (Abrir la configuración).

Si no se encuentra ningún modelo de imagen, la imagen falla y la app te pide que elijas uno.

## Activar el Illustrator

Antes de empezar: instala **Illustrator** desde **Agent Organizer** (Organizador de agentes). Consulta [Descripción general de los agentes](../agents/agents-overview.md).

1. Abre el chat de Roleplay que quieres ilustrar.
2. Abre **Chat Settings** (Ajustes del chat) y busca **Agents** (Agentes).
3. Activa **Enable Agents** (Activar agentes).
4. En el grupo **Misc Agents**, busca **Illustrator** y agrégalo con el botón del signo más.

Aparece una tarjeta **Illustrator** con sus propias opciones. Los agentes usan tokens (fragmentos de texto) adicionales y pueden añadir llamadas al modelo por turno. Las estimaciones de tokens solo incluyen las instrucciones de los agentes.

<a id="game-mode-the-game-illustrator-toggle"></a>

### Game Mode: el interruptor Game Illustrator

Game Mode no tiene las opciones **Prompt Mode** ni **Prompt Model**. Abre los **Chat Settings** del juego y activa **Game Illustrator** ("Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay").

## Elegir un estilo de arte

El selector **Prompt Mode** (Modo de prompt), con la etiqueta **Prompt** en la tarjeta, establece el estilo de arte de cada prompt que escribe el Illustrator. Un Illustrator nuevo empieza en **Background**.

| Estilo | Lo que dibuja |
| --- | --- |
| **Illustration** | Una sola imagen de escena pulida. El estilo general. |
| **Comic Page** | Una página de cómic con viñetas, bocadillos de diálogo, subtítulos y efectos de sonido. |
| **Colored Manga** | Una escena de manga a color con bocadillos estilizados y efectos de sonido. |
| **B&W Manga** | Una página de manga en blanco y negro con líneas entintadas y sombreado de trama. |
| **Background** | Una toma de ubicación o de establecimiento sin personajes. |
| **Selfie** | Una selfie en personaje o un retrato informal. |

El aspecto final también depende de tu perfil de estilo. Consulta [Perfiles de estilo de imagen](style-profiles.md).

## Elegir el modelo de prompts

El **Prompt Model** (Modelo de prompts) es el modelo de texto que escribe el prompt de imagen. No dibuja. Elígelo en la lista **Prompt Model** de la tarjeta. El valor predeterminado es **Main chat model** (Modelo principal del chat), que reutiliza el modelo de tu chat. Elige otro modelo de texto si quieres que uno diferente escriba los prompts.

El modelo de imagen que dibuja la imagen es el que estableciste en **Antes de empezar**.

## Mantener la coherencia de los personajes

Dos ajustes de la tarjeta ayudan a que los personajes se vean iguales en todas las imágenes. Ambos empiezan desactivados.

**Attach Card Appearance** (Adjuntar la apariencia de la tarjeta) añade al prompt de imagen el texto de apariencia guardado de cada personaje visible. En un chat de Roleplay es una lista con cuatro opciones.

- **Off** (Desactivado)
- **Images only** (Solo imágenes), el comportamiento habitual.
- **Videos only** (Solo videos): un clip recibe el texto de apariencia de los personajes que muestra. Esto importa sobre todo en un clip **Prompt only**, que no tiene imagen.
- **Images and videos** (Imágenes y videos): ambas cosas.

Cuando está activado, una tarjeta o persona con **Image Appearance Override** (Apariencia alternativa para imágenes) activado envía ese texto alternativo en lugar de su texto de **Appearance** (Apariencia). Úsalo cuando **Appearance** esté escrito para el narrador pero no funcione bien para un modelo de imágenes. Conserva la descripción completa en **Appearance** y pon una versión más corta, en forma de etiquetas, en la apariencia alternativa. Si la apariencia alternativa está desactivada o vacía, los prompts de imagen usan **Appearance**. El narrador siempre ve el texto completo de **Appearance**. El interruptor está debajo de **Appearance** en los editores de personajes y personas.

**Send Avatar References** (Enviar referencias de avatar) envía los avatares de personajes y personas, o sus sprites, al servicio de imágenes como imágenes de referencia, para que el modelo pueda copiar una cara o un atuendo. No todos los servicios las aceptan. En un chat de Roleplay es una lista como **Attach Card Appearance**. Si incluye videos, un clip cuyo **First frame** (Primer fotograma) sea **Prompt only** empieza desde el avatar o sprite del personaje, y la opción se muestra como **Prompt only (avatar from Send Avatar References)**.

## Controlar con qué frecuencia dibuja

La tarjeta del Illustrator tiene un botón **Open Setup** que abre la pantalla de configuración completa. Allí estableces el intervalo de ejecución predeterminado y le das su propio modelo de imagen.

Cada chat de Roleplay tiene su propio **Image Run Interval** (Intervalo de generación de imágenes) en la tarjeta dentro de **Chat Settings** ("Messages between automatic images in this chat. 0 means only when you ask."). Un chat que no define ninguno usa el valor de la pantalla de configuración, **5** de forma predeterminada. La tarjeta muestra **Using agent default** (Usando el valor predeterminado del agente) o **Chat override** (Valor propio del chat). Haz clic en **Use agent default** (Usar el valor predeterminado del agente) para volver. Cuando añades el Illustrator a un chat, la ventana para añadirlo muestra el mismo campo y lo guarda solo para ese chat.

Establece **Image Run Interval** en **0** para el modo solo manual. Detiene las ejecuciones automáticas, incluidos los fondos de escena automáticos, pero mantiene el agente disponible para las acciones de Gallery. Establece un número positivo para reanudarlas.

Para crear una imagen ahora, abre **Chat Settings**, despliega **Gallery** y haz clic en **Illustrate** (Ilustrar). El Illustrator se ejecuta una vez de inmediato y el botón muestra **Generating...**.

## Crear clips

En un chat de Roleplay, **Chat Settings → Agents → Illustrator** tiene un ajuste **Illustrator makes** (Illustrator crea).

- **Pictures** (Imágenes, predeterminado): solo imágenes.
- **Pictures and clips** (Imágenes y clips): Illustrator también puede convertir una imagen nueva en un clip corto cuando el movimiento es lo importante, como una acción, una persecución o algo que se rompe. Esto incluye las imágenes que el narrador pide con `[illustrate]`. Escribe el movimiento por sí mismo, siguiendo las **Video prompting instructions** (Instrucciones para prompts de video) del modelo de video. La imagen aparece primero y el clip se añade al mismo mensaje cuando está listo.
- **Clips only** (Solo clips): cada vez que Illustrator mostraría una imagen, muestra un clip corto. La imagen que dibuja se convierte en el fotograma inicial del clip y va a la Gallery, no a la respuesta. Si el clip falla, se muestra la imagen.

Los clips usan el modelo de video de **Scene Videos** (Videos de escena), y cada clip es una solicitud de video. Sin un modelo de video que funcione, Illustrator crea imágenes, incluso con **Clips only**. Los agentes personalizados que crean imágenes siguen el mismo ajuste. Consulta [Generación de video de escena](scene-video.md).

**Video Run Interval** (Intervalo de generación de videos) aparece cuando Illustrator crea clips. Es cuántos mensajes del usuario y del asistente deben pasar después de un clip antes del siguiente, y es independiente de **Image Run Interval**.

- Con **Clips only**, cada ejecución es un clip, **Video Run Interval** establece con qué frecuencia se ejecuta Illustrator e **Image Run Interval** se oculta.
- Un chat sin valor propio usa el **Video Run Interval** de la pantalla **Open Setup**, o 5.
- **0**: no crea clips por iniciativa propia, ni siquiera para las imágenes de `[illustrate]`, que reciben su imagen en su lugar.
- Una respuesta recibe como máximo **Videos per reply** (Videos por respuesta) clips (**Settings → Generations → Video Generation**, Configuración → Generaciones → Generación de video).
- Puedes seguir animando una imagen desde la Gallery. Con **Clips only**, el botón **Illustrate** de un mensaje crea un clip.
- Un swipe de una respuesta que recibió un clip cuenta como una respuesta nueva y puede recibir su propio clip. El swipe anterior conserva el suyo.

**First frame**, en la misma sección, establece desde qué empieza cada clip de Roleplay: los clips de Illustrator, `/video` y el botón **Video** de la Gallery. Las opciones son una imagen nueva de Illustrator, el avatar o sprite del personaje nombrado, la imagen con el avatar como alternativa o ninguna imagen. Los mensajes de video de Conversation usan el mismo ajuste.

- **Clips only** con el avatar o sin imagen: no se dibuja ninguna imagen. El clip sale de la escena y el movimiento de Illustrator.
- **Pictures and clips**: la imagen se sigue mostrando y solo el clip empieza desde el avatar o sin nada.
- Sin fotograma inicial elegido: un clip nunca dibuja una imagen solo para sí mismo. **Pictures and clips** anima la imagen que Illustrator acaba de crear. **Clips only**, `/video` y **Video** crean el clip solo a partir de la escena.

Un clip sin imagen propia describe a todos los que nombra, incluida tu persona. El fotograma inicial de avatar parte de quien se nombre primero.

Volver a ejecutar Illustrator desde el botón **Illustrate** de un mensaje también sigue **Illustrator makes** y **First frame**.

## Varios personajes en NovelAI

Cuando el modelo de imagen del Illustrator es un modelo V4, V4.5 o V5 de NovelAI, el modelo que escribe el prompt añade una descripción de personaje por cada personaje visible. Cada descripción incluye la apariencia, la expresión, la pose y la posición aproximada de ese personaje en el encuadre. Marinara compara las descripciones con la lista de personajes de la escena, quita las que no puede asociar y envía las demás a NovelAI como prompts de personaje nativos junto al prompt principal. Esto evita que el pelo, la ropa y otros rasgos se mezclen entre personajes. Las imágenes de **Illustrate** y del comando `[illustrate]` de un personaje reciben las mismas descripciones.

V5 acepta hasta 22 personajes. V4 y V4.5 aceptan hasta 6. Con más personajes visibles, se conservan los más importantes y el resto pasa a ser fondo sin nombre.

Los rasgos fijos provienen del campo **Appearance**. Si ya contiene etiquetas Danbooru, se copian tal cual. Si es prosa, el modelo que escribe el prompt la convierte en etiquetas. La ropa proviene del atuendo actual del tracker de personajes cuando el tracker se ejecuta, también convertida en etiquetas.

Con **Attach Card Appearance** activado, el modelo también recibe el texto completo de Appearance de todas las tarjetas y personas del chat, para que no se recorten las tarjetas largas o de varios personajes. Las tarjetas de varios personajes que los describen con el formato `[NAME] tags | [NAME] tags` se desglosan por personaje. El modelo copia los rasgos fijos en la descripción correspondiente, trata las etiquetas de ropa de la tarjeta como un valor predeterminado sobre el que tienen prioridad el tracker o la escena, e ignora a los personajes que no están en la escena. Cuando vuelven descripciones, Marinara no añade nada más. Sin descripciones, el caso de un solo personaje, se añade la línea habitual de apariencia al prompt principal, igual que antes.

No hace falta ningún ajuste. Las descripciones solo aparecen con NovelAI en su propio servidor, así que un proxy u otro servicio no se ven afectados. Con **Expose media prompts before sending** (Mostrar los prompts de medios antes de enviar) activado, la ventana de revisión lista las descripciones debajo del prompt principal, en solo lectura. Edita el prompt principal como siempre.

## Guardado en galerías e inspección del prompt

En **Settings → Generations → Image Generation** (Configuración → Generaciones → Generación de imágenes), **Automatically save generated images to character galleries** (Guardar automáticamente las imágenes generadas en las galerías de personajes) está activado de forma predeterminada. Desactívalo para dejar de añadir ilustraciones y selfies del chat a las galerías de los personajes y personas representados. Las imágenes siguen apareciendo en la conversación y en la Gallery del chat, y el guardado explícito en galerías sigue funcionando. Las entradas existentes no cambian. Las galerías comparten los archivos de imagen, así que este ajuste controla la pertenencia, no el borrado.

En las nuevas ilustraciones de NovelAI, el inspector de imágenes muestra el prompt de escena y estilo seguido de las descripciones positivas de los personajes, separados por ` | `. El prompt guardado en la galería es el mismo.

Para volver a dibujar una ilustración con un prompt cambiado, sin regenerar la respuesta, ábrela y usa **Regenerate image** (Regenerar imagen). Consulta [Regenerar una imagen](scene-backgrounds.md#regenerating-an-image).

Para ilustrar un mensaje anterior de Roleplay o un rango, usa `/illustrate range=12` o `/illustrate range=12-18`. Consulta [Comandos de barra](../chats/slash-commands.md).

## Guías relacionadas

- [Proveedores de generación de imágenes y configuración](image-providers.md)
- [Perfiles de estilo de imagen](style-profiles.md)
- [Fondos de escena y la galería](scene-backgrounds.md)
- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
