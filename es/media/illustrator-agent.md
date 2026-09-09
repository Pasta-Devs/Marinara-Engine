# Agente Illustrator

Esta guía cubre el **Illustrator** (Ilustrador), un ayudante integrado que dibuja imágenes de tus escenas mientras chateas. Aprenderás qué hace, cómo activarlo, los estilos de arte que puede usar y las dos conexiones que necesita.

## Qué hace el agente Illustrator

Un agente es un pequeño ayudante de IA que se ejecuta automáticamente para un chat. El **Illustrator** es un agente de posprocesamiento, lo que significa que se ejecuta después de que la IA termina cada respuesta. Lee la última respuesta y decide si el momento vale una imagen. Cuando la vale, el Illustrator escribe un prompt (las instrucciones enviadas a la IA) de imagen y lo envía a tu proveedor de imágenes. Un prompt es la descripción de texto que le dice a un modelo de imágenes qué dibujar.

El Illustrator no dibuja cada mensaje. De forma predeterminada, después de crear una imagen espera 5 mensajes aceptados del usuario y del asistente antes de poder crear otra. Hacer swipe (respuesta alternativa) o regenerar la misma respuesta no avanza ese intervalo. Si decide que un momento no vale la pena ilustrar, lo omite y no crea ninguna imagen. Cada imagen que crea se guarda en la **Gallery** (Galería) del chat.

Puedes usar el Illustrator en chats de **Roleplay** y **Game Mode**, y al instalarlo también se desbloquean las selfies de Conversation. Su descripción corta en la app dice: "Responsible for image and video generations." Los pasos de configuración y los ajustes de esta guía son para chats de Roleplay. Game Mode usa un único interruptor simple en su lugar, que se cubre en la sección de Game Mode más abajo.

## Antes de empezar

El Illustrator escribe el prompt de imagen, pero necesita una conexión de imagen aparte para dibujar realmente la imagen. Una conexión de imagen es un enlace guardado a un proveedor de imágenes, como OpenAI o un servidor local de Stable Diffusion.

Configura primero una conexión de imagen. Tienes dos maneras de darle una al Illustrator:

1. Marca una conexión de imagen como la predeterminada. Abre el panel **Connections** (Conexiones), expande **Defaults** (Predeterminados) y elígela bajo **Images** (Imágenes).
2. O dale al Illustrator su propia conexión de imagen desde su pantalla de configuración completa (ver **Open Setup** más abajo).

Si no se encuentra ninguna conexión de imagen, la imagen falla y la app te pide que elijas una. Consulta [Image Generation Providers and Setup](image-providers.md) para agregar un proveedor.

## Activar el Illustrator

El Illustrator está desactivado de forma predeterminada. En un chat de **Roleplay**, agrégalo así:

1. Abre el chat que quieres ilustrar.
2. Abre **Chat Settings** (Ajustes del chat) con el icono de engranaje.
3. Busca la sección **Agents** (Agentes) y activa **Enable Agents** (Activar agentes).
4. En el grupo **Misc Agents**, busca **Illustrator** y agrégalo con el botón Plus (el botón **+**).

Ahora deberías ver una tarjeta de ajustes de **Illustrator** con sus propias opciones. Agregar un agente usa tokens (fragmentos de texto) extra y hace llamadas de IA extra por turno, así que el panel muestra una estimación de costo continua.

### Game Mode: el interruptor Game Illustrator

Game Mode no usa los pasos de arriba, y no muestra las opciones **Prompt Mode** ni **Prompt Model**. En su lugar, abre los **Chat Settings** del juego y activa el único interruptor **Game Illustrator**. Su descripción dice: "Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay."

## Modos de prompt

El selector **Prompt Mode** define el estilo de arte que el Illustrator usa para cada prompt que escribe. En la tarjeta del agente este selector está etiquetado como **Prompt**. Una línea corta debajo dice: "Prompt mode controls how Illustrator writes image prompts for this chat."

El selector ofrece estos estilos:

- **Illustration**: una sola imagen de escena pulida. Este es el estilo general.
- **Comic Page**: una página de cómic con viñetas, bocadillos de diálogo, subtítulos y efectos de sonido.
- **Colored Manga**: una escena de manga a color con bocadillos estilizados y efectos de sonido.
- **B&W Manga**: una página de manga en blanco y negro con líneas entintadas y sombreado de trama.
- **Background**: una toma de ubicación o de establecimiento sin personajes en ella.
- **Selfie**: una selfie en personaje o un retrato informal.

Un agente Illustrator nuevo empieza con el estilo **Background**. Cambia el estilo en cualquier momento desde el selector. El aspecto general de la imagen final también depende de tu perfil de estilo. Consulta [Image Style Profiles](style-profiles.md) para configurarlo.

## Prompt Model y la conexión de imagen

El Illustrator usa dos conexiones diferentes, y conviene no confundirlas.

El **Prompt Model** es el modelo de texto que escribe el prompt de imagen. No es el modelo que dibuja la imagen. Elígelo desde el menú desplegable **Prompt Model** en la tarjeta del Illustrator. El valor predeterminado es **Main chat model**, que reutiliza la misma conexión que ya usa tu chat. Elige otra conexión de texto si quieres que un modelo diferente escriba los prompts.

La conexión de imagen es el proveedor de imágenes que dibuja la imagen final. La configuras como se describe en **Antes de empezar**, ya sea bajo **Defaults → Images** o desde la propia pantalla de configuración del agente.

## Attach Card Appearance y Send Avatar References

Dos interruptores en la tarjeta del Illustrator ayudan a que los personajes se vean consistentes. Ambos están desactivados de forma predeterminada.

**Attach Card Appearance** agrega el texto de apariencia guardado de cada personaje visible al prompt de imagen. Su texto de ayuda dice: "Append matched character appearance lines to image prompts, using only visible/generated names." Actívalo cuando quieras que la imagen coincida con cómo está escrito un personaje.

**Send Avatar References** envía los avatares de personajes y personas, o sus sprites (imágenes del personaje), al proveedor de imágenes como imágenes de referencia. Su texto de ayuda dice: "Send matching character and persona avatars or sprites as reference images when the provider supports them." Esto ayuda al modelo de imágenes a copiar una cara o un atuendo. No todos los proveedores aceptan imágenes de referencia, así que el efecto depende del proveedor que elegiste.

## Varios personajes en NovelAI

Cuando la conexión de imagen del Illustrator usa NovelAI con un modelo V4, V4.5 o V5, se pide al modelo que escribe el prompt una descripción adicional por cada personaje visible. Cada descripción incluye la apariencia, la expresión, la pose y la posición aproximada de ese personaje en el encuadre. Marinara compara las descripciones con la lista de personajes de la escena, descarta las que no puede asociar y envía las demás a NovelAI como prompts de personaje nativos junto al prompt principal de la escena. Esto evita que el pelo, la ropa y otros rasgos se mezclen entre personajes en las escenas de grupo.

El número de descripciones depende del modelo. V5 acepta hasta 22 personajes, y V4 o V4.5 hasta 6. Las escenas con más personajes visibles conservan los más importantes y tratan al resto como figuras de fondo sin nombre.

El modelo que escribe el prompt recibe instrucciones sobre el origen de los detalles de cada descripción. Los rasgos fijos provienen del campo **Appearance** (apariencia) del personaje o de la persona: si el campo ya contiene etiquetas Danbooru, se copian tal cual; si contiene prosa, el modelo la convierte en etiquetas. La ropa proviene del atuendo actual del tracker de personajes cuando está en funcionamiento, y también se convierte en etiquetas.

Con **Attach Card Appearance** (adjuntar la apariencia de la tarjeta) activado, el modelo también recibe como referencia el texto completo de Appearance de todas las tarjetas y personas del chat, para que no se recorten las tarjetas largas o de varios personajes. Las tarjetas que describen a varios personajes en un solo campo Appearance con el formato `[NAME] tags | [NAME] tags` se desglosan por personaje. El modelo decide qué usar: copia los rasgos fijos en la descripción correspondiente, trata las etiquetas de ropa de la tarjeta como un valor predeterminado sobre el que tienen prioridad el tracker o la escena, e ignora a los personajes que no aparecen en ella. Cuando el modelo devuelve descripciones de personajes, Marinara no añade nada más al prompt. Cuando no devuelve ninguna, como ocurre en las escenas de un solo personaje, se añade la línea habitual de apariencia al prompt principal, igual que antes.

No necesitas configurar nada. Las descripciones solo se usan con una conexión a NovelAI en su propio servidor, por lo que un proxy u otro proveedor no se ven afectados. Si activas **Review image prompts before sending** (revisar los prompts de imagen antes de enviarlos), el diálogo de revisión muestra las descripciones debajo del prompt principal para que veas qué se enviará. Allí son de solo lectura; puedes editar el prompt principal como siempre.

## Más ajustes y ejecutarlo a mano

La tarjeta del Illustrator tiene un botón **Open Setup**. Abre la pantalla de configuración completa del agente, donde puedes definir con qué frecuencia se ejecuta el agente y darle su propia conexión de imagen.

Establece **Run Interval** (intervalo de ejecución) en **0** para generar solo de forma manual. Esto detiene las ejecuciones automáticas de Illustrator, incluidos sus fondos de escena automáticos, pero mantiene al agente instalado y disponible para las acciones de Gallery. El valor predeterminado sigue siendo **5**; establece un intervalo positivo para reanudar las ejecuciones automáticas. También puedes elegir 0 al añadir Illustrator a un chat.

También puedes crear una imagen bajo demanda en lugar de esperar. Abre la **Gallery** del chat y usa el botón **Illustrate**. El Illustrator se ejecuta una vez de inmediato y el botón muestra **Generating...** mientras trabaja. Esto es útil cuando quieres una imagen del momento actual y el agente todavía no ha dibujado ninguna.

## Guías relacionadas

- [Proveedores de generación de imágenes y configuración](image-providers.md)
- [Perfiles de estilo de imagen](style-profiles.md)
- [Fondos de escena y la galería](scene-backgrounds.md)
- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
