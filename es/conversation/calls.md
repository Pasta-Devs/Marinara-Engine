# Llamadas de audio y video en Conversation

Esta guía explica las llamadas de Conversation en Marinara Engine. Aprenderás cómo funciona una llamada, cómo configurar una, cómo hablar durante una llamada y cómo resolver problemas comunes.

Las llamadas existen solo en Conversation Mode (modo Conversación). Los chats de Roleplay y de Game no tienen pantalla de llamada.

Calls es un paquete de agente opcional. Instala **Calls** desde **Agents → Download Agents** (Agentes → Descargar agentes) antes de seguir la configuración de abajo, y luego reinicia Marinara cuando el catálogo lo pida.

## Qué es una llamada

Una llamada te da una pantalla en vivo, al estilo de Discord, donde hablas con uno o más personajes. Se coloca sobre el chat normal de Conversation mientras dura la llamada.

Durante una llamada:

- Los personajes que tienen una voz de Text to Speech (TTS) que funciona dicen sus líneas en voz alta. TTS significa texto convertido en audio hablado.
- Los personajes sin voz responden como mensajes escritos en el chat de la llamada.
- Tú respondes con el micrófono o escribiendo.
- Opcionalmente puedes ver clips de video generados por IA que se repiten en bucle de un personaje, en lugar de un avatar fijo.

Una llamada no es una llamada telefónica de igual a igual. Marinara graba el micrófono o la cámara de tu navegador local. Envía esa entrada al modelo que elegiste para esa Conversation. Reproduce las respuestas a través de tu proveedor de TTS y guarda los datos de la llamada en tu propia máquina.

Cuando la llamada termina, Marinara escribe un breve resumen de la llamada de audio de vuelta en la Conversation normal. La transcripción completa de la llamada queda en un almacenamiento de llamadas aparte y no se copia mensaje por mensaje al chat principal.

## Antes de empezar

Para tener una llamada de voz que funcione, configura estas piezas en orden. Puedes saltarte los pasos marcados como Opcional.

1. Un chat en modo Conversation con al menos un personaje.
2. Una conexión de modelo normal seleccionada para ese chat. Este es el modelo que escribe las respuestas del personaje durante la llamada.
3. **Audio/Video Calls** (Llamadas de audio/video) activado para ese chat (mira la sección "Activar las llamadas en un chat" más abajo).
4. **Call Audio Pipeline** (Canal de audio de la llamada) activado. Esto es necesario para iniciar cualquier llamada, incluso una en la que solo escribes o solo escuchas. También habilita la entrada del micrófono.
5. Text to Speech configurado para que los personajes puedan hablar. Sin él, cada personaje entra solo como texto.
6. Opcional: Local Whisper descargado desde **Connections** (Conexiones) después de instalar Calls, si tu navegador no puede hacer un reconocimiento de voz fiable (Firefox necesita esto). O tu propio servidor de voz a texto en lugar de Local Whisper.
7. Opcional: una conexión de video y clips generados si quieres **Character Video Presence** (Presencia en video del personaje).
8. Opcional: una conexión de imagen configurada como la Selfie Connection del chat si quieres que los personajes envíen selfies en la llamada.

### Configurar Text to Speech

Text to Speech decide qué personajes pueden hablar y qué voz usa cada uno. Es una función compartida, así que está documentada en su propia guía.

Para el recorrido completo, lee [Configuración de Text to Speech (TTS)](../media/tts-setup.md). En resumen, abres **Connections** y luego **Text to Speech**, y después:

1. Activa Text to Speech.
2. Elige una fuente: **OpenAI-compatible**, **ElevenLabs**, **PocketTTS** o **xAI Voice**.
3. Introduce la clave del proveedor o la dirección del servidor local para esa fuente.
4. Elige un modelo y una voz.
5. Configura **Voice Option** en **One voice for all characters** o **Selected per character**.
6. Guarda y luego usa el botón de vista previa para confirmar que escuchas el audio.

Para una llamada grupal, las voces por personaje facilitan mucho saber quién habla. Si un personaje no tiene una voz que Marinara pueda resolver, ese personaje pasa a ser solo texto durante la llamada.

### Elegir un modo de entrada de micrófono

Cuando **Call Audio Pipeline** está activado, aparece un menú desplegable **Audio input mode** (Modo de entrada de audio) con cuatro opciones. Elige la que encaje con tu navegador y tu proveedor.

- **Mic recording + Local Whisper**: graba mientras no estás en silencio, ignora los silencios y convierte tu voz en texto en tu propia máquina. Es la opción predeterminada y la mejor para Firefox.
- **Browser speech recognition**: usa la función Web Speech de tu navegador. La Web Speech API es una herramienta integrada del navegador para convertir voz en texto. El soporte varía según el navegador, y Marinara recurre a Local Whisper cuando no está disponible.
- **Manual system dictation**: solo coloca el cursor en el cuadro de texto de la llamada para que el dictado de tu sistema operativo pueda escribir ahí. En este modo, Marinara no graba tu micrófono por sí sola.
- **Provider-native audio/video**: envía tu audio o video grabado directamente al modelo de la Conversation, cuando ese modelo puede aceptar medios directamente. Si el modelo no puede, usa Local Whisper o el reconocimiento de voz del navegador en su lugar.

Los botones de cámara y pantalla aparecen solo cuando **Camera and screen input** (Entrada de cámara y pantalla) está activado. Funcionan solo en el modo **Provider-native audio/video**. En cualquier otro modo, los botones son visibles pero quedan desactivados.

### Descargar Local Whisper

Local Whisper convierte tu voz en texto en la máquina que ejecuta Marinara. El audio de tu micrófono nunca sale de esa máquina para transcribirse. El texto resultante sí se envía a tu modelo de Conversation como parte de la llamada.

Local Whisper pertenece al paquete Calls y es la ruta de micrófono más fiable para navegadores con soporte de voz débil, incluido Firefox. Después de instalar Calls, abre **Connections**, abre **Local Model** (Modelo local), expande la tarjeta y busca **Local Speech Model** (Modelo de voz local). La sección está oculta cuando Calls no está instalado. Para la tarjeta general de Local Model, mira [Configuración de Local Model](../connections/local-model.md).

1. Elige un modelo. **Whisper Tiny (Multilingual)** es el predeterminado. Ocupa unos 180 MB de descarga y usa unos 350 MB de memoria mientras se ejecuta. Es la mejor primera opción para teléfonos y máquinas más antiguas.
2. O elige **Whisper Base (Multilingual)** para mayor precisión con habla poco clara. Ocupa unos 320 MB de descarga y usa unos 650 MB de memoria.
3. Haz clic en **Download Whisper**.
4. Espera a que la barra de progreso termine.

Después de la descarga, aparece un control **Delete Local Whisper** (icono de papelera) por si quieres eliminar el modelo.

Desinstalar Calls también elimina todos los modelos de Whisper descargados y su selección guardada. Esto libera el espacio en disco del modelo. Reinstalar Calls restaura los controles de descarga, pero no vuelve a descargar un modelo hasta que elijas uno.

<a id="use-your-own-speech-to-text-server"></a>

### Usar tu propio servidor de voz a texto

Si Local Whisper tiene dificultades con tu idioma o tu acento, puedes enviar tu voz grabada a otro modelo de voz a texto en su lugar. Esto funciona con cualquier servidor que ofrezca el endpoint `/audio/transcriptions` al estilo de OpenAI. Eso incluye servidores autoalojados como Speaches, servidores de faster-whisper, LocalAI y el servidor de whisper.cpp (iniciado con `--inference-path /v1/audio/transcriptions`), y proveedores como OpenAI o Groq.

1. Instala Calls, luego abre **Connections** y busca la tarjeta **Speech to Text** (Voz a texto). La tarjeta está oculta mientras Calls no está instalado.
2. Expande la tarjeta e introduce la **Server URL** (URL del servidor), por ejemplo `http://localhost:8000/v1` para un servidor en tu propia máquina.
3. Introduce una **API key** (clave de API) si tu servidor o proveedor la necesita. Se guarda cifrada, y la tarjeta solo la muestra enmascarada.
4. Introduce el nombre del **Model** (Modelo) que usa tu servidor. Déjalo vacío para enviar `whisper-1`.
5. Opcional: introduce un código de **Language** (Idioma), como `pl` o `de`. Indicarle al modelo tu idioma suele mejorar la precisión. Déjalo vacío para que el servidor lo detecte.
6. Haz clic en **Test** (Probar). Marinara envía un clip silencioso de un segundo y te dice si el servidor respondió.
7. Activa el interruptor de la tarjeta.

Mientras el interruptor está activado, **Mic recording + Local Whisper** envía tu voz a este servidor en lugar de a Local Whisper. No necesitas descargar Local Whisper para ello. Desactiva el interruptor para volver a Local Whisper. Tu audio va al servidor que introdujiste, así que usa un servidor de confianza.

Un servidor en la misma máquina que Marinara funciona tal cual. Un servidor en otra máquina de tu red doméstica se rechaza a menos que establezcas `STT_LOCAL_URLS_ENABLED=true` en el archivo `.env` del servidor. Consulta [Referencia de configuración del servidor](../CONFIGURATION.md).

Esto requiere una versión de Calls que lo admita. Si las llamadas siguen usando Local Whisper después de activar el interruptor, actualiza Calls desde **Agents → Download Agents**.

## Activar las llamadas en un chat

Puedes activar las llamadas mientras creas una nueva Conversation, o más tarde desde los ajustes del chat.

Para una nueva Conversation, termina primero el asistente de configuración, luego abre los ajustes de ese chat y sigue los mismos pasos de abajo. Los ajustes del paquete opcional se muestran solo después de instalar Calls.

Para una Conversation existente:

1. Abre el chat.
2. Abre **Chat Settings** (Ajustes del chat).
3. Ve a la sección **Agents**.
4. Abre **Calls**.
5. Activa **Audio/Video Calls**. Ahora deberías ver un botón de llamada junto al nombre de la conversación.
6. Activa **Call Audio Pipeline**. Ninguna llamada puede iniciar sin él, aunque nunca uses un micrófono.
7. Elige un **Audio input mode**.

**Audio/Video Calls** y el comando **Calls** son dos ajustes distintos. **Audio/Video Calls** muestra el botón de llamada para que puedas llamar a un personaje. El comando **Calls** deja que los personajes te llamen primero. Si desactivas **Calls**, todavía puedes iniciar llamadas tú mismo, pero los personajes no deberían iniciar llamadas entrantes.

La sección **Agents** también contiene un interruptor maestro **Commands** cuando hay instalado un paquete que provee comandos. Debe estar activado para que funcionen los comandos ocultos dentro de la llamada. La llamada en sí puede iniciar aunque esté desactivado.

### Ajustes y valores predeterminados

La mayoría de los ajustes de llamada están en **Chat Settings**, luego **Agents**, luego **Calls**. Algunos de ellos son globales, lo que significa que cambiarlos en un chat los cambia para todas las llamadas de Conversation en la app.

| Ajuste | Alcance | Predeterminado |
|---|---|---|
| **Audio/Video Calls** | Por chat | Off |
| **Calls** (comando) | Por chat | On |
| **Generate voice cues in [tags]** | Por chat | On |
| **Call Audio Pipeline** | Global | Off |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | Off |
| **Character video presence** | Global | Off |
| **Automatic video clips generation** | Global | Off |
| **Custom clips** | Global | Off |

**Generate voice cues in [tags]** pide al modelo que añada indicaciones cortas entre corchetes, como `[whispering]`, `[laughing]` o `[sighs]`, dentro de las líneas habladas. Estas indicaciones moldean cómo el TTS lee la línea y ayudan a elegir clips de video de reacción. Está activado de forma predeterminada. Desactívalo para dejar las líneas habladas sin adornos.

## Iniciar, recibir y terminar una llamada

### Iniciar una llamada

Cuando las llamadas están activadas en un chat, aparece un botón de teléfono junto al nombre de la conversación. Su tooltip (texto de ayuda) dice **Start call** cuando no hay ninguna llamada activa, o **Open call** cuando una llamada ya está en curso.

Haz clic en **Start call**. La pantalla completa de la llamada se abre de inmediato.

Solo una llamada puede estar activa o sonando por chat. Si inicias una llamada mientras ya hay una en curso, Marinara vuelve a abrir esa llamada en lugar de crear una nueva.

### Llamadas entrantes de personajes

Un personaje puede llamarte si el comando **Calls** está activado. Cuando eso pasa y estás dentro de ese chat, aparece un banner **Incoming call** encima del cuadro de mensajes. El banner tiene un botón **Decline call** y un botón **Answer call**.

Si estás en otra parte de Marinara, aparece una notificación de llamada entrante, parecida a la notificación de un mensaje autónomo de un personaje. Suena un breve tono de llamada. Marinara nunca responde por ti, así que debes hacer clic en **Answer call**.

Solo los personajes que están disponibles en ese momento se unen a una llamada. Si un horario o un estado marca a un personaje como desconectado, ese personaje no se une a la llamada, aunque pertenezca al chat.

### Terminar una llamada

Puedes terminar una llamada en cualquier momento con el botón rojo **End call**. Está en la pantalla de la llamada y en la ventana emergente minimizada. Un personaje también puede salir o terminar la llamada mediante un comando dentro de la llamada.

Cuando la llamada termina, Marinara deja de grabar, cierra los medios de forma segura y añade una tarjeta a la Conversation normal.

## La pantalla y los controles de la llamada

El escenario de la llamada muestra un recuadro por participante, lo que incluye tu persona y cada personaje disponible. Resalta a quien está hablando.

El chat de la llamada contiene los mensajes escritos y las respuestas de solo texto de los personajes. En computadora se ubica en un panel lateral. En el teléfono se esconde detrás de un botón **Open call chat**. El chat se abre como un panel lateral completo, y lo cierras con **Close call chat**. Las líneas habladas se usan para el audio, pero no se repiten como burbujas de chat aparte.

El compositor de la llamada tiene un cuadro **Message in call** y un botón **Send**. También tiene un selector de emoji, GIF y stickers, y un cambiador rápido de conexión. Los archivos adjuntos todavía no se admiten en el chat de la llamada.

La barra de control en la parte de abajo del escenario tiene botones de icono:

- Micrófono: te silencia o quita el silencio. Su tooltip cambia con el modo de entrada, por ejemplo **Unmute microphone with Local Whisper**.
- **Turn camera on** y **Turn camera off**: habilitados solo en el modo **Provider-native audio/video** con **Camera and screen input** activado.
- **Share screen** y **Stop sharing screen**: la misma regla que la cámara.
- **Character volume**: abre un panel emergente con un botón de silencio y un control deslizante de volumen de 0 a 100. El valor predeterminado es 100 por ciento, y tu elección se guarda en el navegador.
- **Soundboard**: abre una lista de sonidos con un control **Upload**.
- **End call**: el botón rojo para colgar.

Si te quedas en silencio un rato, aparece un recordatorio: "You are muted! Remember to unmute yourself first if you want to talk."

Si sales de la Conversation mientras una llamada está activa, la llamada se encoge en una pequeña ventana emergente flotante. La ventana emergente muestra el nombre del chat, el tiempo transcurrido y un botón rojo **End call**. Haz clic en el cuerpo de la ventana emergente para volver a la pantalla completa de la llamada. Marinara mantiene la llamada en curso mientras navegas por otros paneles.

### Soundboard

El soundboard es una pequeña biblioteca de sonidos que puedes reproducir durante cualquier llamada. Vienen cuatro sonidos integrados de forma predeterminada: **Soft Chime**, **Tap**, **Sparkle** y **Pop**. No puedes eliminar los sonidos integrados.

Puedes subir tu propio sonido con el botón **Upload**. Los formatos aceptados son mp3, wav, ogg, webm y m4a, hasta 8 MB cada uno. Tus archivos subidos tienen un control de eliminación. Los personajes también pueden reproducir un sonido mediante el comando del soundboard.

## Character Video Presence y clips de la llamada de video

**Character Video Presence** reemplaza el recuadro de avatar fijo con un clip de video generado por IA que se repite en bucle del personaje. Está desactivado de forma predeterminada. El interruptor es **Character video presence** en **Chat Settings**, luego **Agents**, luego **Calls**.

Para configurar los clips de la llamada de video:

1. Crea una conexión de Video Generation en **Settings** (Configuración), luego **Connections**.
2. Marca una conexión como **Default for Videos**, o elige una conexión de video cada vez que generes.
3. Abre un editor de personaje o de persona.
4. Abre la pestaña **Sprites**, luego la subpestaña **Clips**.
5. Usa **Generate Clips** o **Upload extra** para añadir los clips que quieras.

Para más información sobre los sprites y el editor, mira [Sprites del personaje (Expresiones y cuerpo completo)](../characters/sprites.md).

El botón **Generate Clips** abre la ventana **Generate Call Clips**. Ahí eliges una **Video Generation Connection** y eliges **Use avatar as reference**. Luego eliges qué clips estándar hacer. También puedes definir un clip personalizado con un **Clip name** y una descripción de la acción.

Los seis tipos de clip estándar son **Idle**, **Talking**, **Laughing**, **Angry**, **Crying** y **Sighing**. Durante un turno hablado, Marinara lee las indicaciones de voz de una línea, como `[sighs]` o `[laughs]`. Elige un clip de reacción que coincida, y luego devuelve al personaje a Idle.

Aparecen dos interruptores adicionales debajo de **Character video presence** cuando está activado:

- **Automatic video clips generation**: desactivado de forma predeterminada. Cuando está activado, Marinara genera automáticamente solo los dos clips básicos, **Idle** y **Talking**, para un participante de la llamada que los necesite. Los clips de reacción y los clips personalizados nunca se generan automáticamente. Esos los haces a mano desde la subpestaña **Clips**.
- **Custom clips**: desactivado de forma predeterminada. Cuando está activado, un personaje puede pedir en raras ocasiones un clip puntual durante una llamada en vivo, y puede volver a reproducir un clip personalizado listo después. Esto está pensado para peticiones visuales especiales, no para cada estado de ánimo o línea.

Los clips que faltan nunca bloquean una llamada. El personaje simplemente muestra un avatar fijo hasta que un clip esté listo. Si recortas un clip, se repite en bucle dentro del rango de recorte que estableces.

Desactivar **Character video presence** también desactiva **Automatic video clips generation** y **Custom clips**.

Los clips de la llamada de video no son lo mismo que los **Videos** de la Gallery (galería). Los Videos de la Gallery contienen videos de escena de chats de Roleplay, Game o Conversation. La subpestaña **Clips** contiene los bucles de presencia reutilizables descritos aquí.

## Comandos ocultos dentro de la llamada

Los personajes pueden usar los mismos comandos ocultos entre corchetes en una llamada que usan en los mensajes normales de Conversation. Cada comando necesita su interruptor correspondiente en **Chat Settings → Agents**, y el interruptor maestro **Commands** dentro de esa sección debe estar activado. Estos comandos se ejecutan en silencio y nunca se dicen ni se muestran como prosa.

- **Selfies**: un personaje genera y envía una foto al chat de la llamada. Esto necesita una **Selfie Connection** configurada para el chat. Mira [Selfies](selfies.md).
- **Memories**: un personaje guarda una memoria sobre otro personaje basándose en la llamada.
- **Music**: un personaje reproduce una canción a través del Music Player, si hay una fuente de música conectada.
- **Haptics**: un personaje controla un dispositivo háptico conectado durante momentos íntimos, si hay un dispositivo conectado.
- **Reactions**: un personaje reacciona a tu último mensaje escrito en la llamada con un emoji.
- **Cross-Post**: un personaje mueve el tema actual a un chat de Conversation compartido distinto.
- **Schedule Updates**: un personaje cambia durante un tiempo su propio estado en línea, ausente, no molestar o desconectado y su actividad, y luego vuelve a su horario. Mira [Horarios de personajes y mensajería autónoma](schedules.md#characters-can-change-their-own-status).
- **Notes** e **Influence**: estos guardan una nota duradera o un empujón puntual, y aparecen solo cuando el chat tiene un chat conectado configurado.
- **Soundboard**: un personaje reproduce uno de los sonidos del soundboard de la llamada.
- Salir y terminar: un personaje puede salir de la llamada por su cuenta, o terminar la llamada para todos.

Algunos comandos añaden una pequeña entrada del sistema al chat de la llamada. Por ejemplo, una selfie muestra una entrada "sent a selfie" con la imagen, y un clip personalizado muestra un marcador de posición mientras el clip se renderiza.

## El resumen de fin de llamada

Cuando una llamada termina, Marinara añade una tarjeta a la transcripción de la Conversation normal. La tarjeta muestra el estado de la llamada. Puedes ver estos títulos:

- **Call Started**
- **Incoming Call**
- **Call Ended**, con la duración de la llamada
- **Call Declined**
- **Missed Call**

Después de una tarjeta **Call Ended**, Marinara genera en segundo plano un breve resumen de la llamada de audio si pasó algo significativo. Luego añade ese resumen a la Conversation como contexto oculto que el modelo puede leer. Esto mantiene al modelo al tanto de lo que se dijo sin copiar toda la llamada al chat visible.

La transcripción detallada de la llamada queda en un almacenamiento de llamadas aparte. Solo el breve resumen vuelve al chat normal.

## Resolución de problemas

### Al iniciar la llamada falla y dice que el audio de la llamada no está habilitado

Si haces clic en **Start call** y ves "Conversation call audio is not enabled in Chat Settings", activa **Call Audio Pipeline**. Abre **Chat Settings**, luego **Agents**, luego **Calls**, y actívalo. Este ajuste es necesario para cada llamada, incluso una en la que solo escribes. Es global, así que activarlo en un chat lo activa para todas las llamadas de Conversation.

### Puedo oír a los personajes, pero ellos no pueden oírme

Abre **Chat Settings**, luego **Agents**, luego **Calls**, y confirma que **Call Audio Pipeline** está activado. Luego confirma que tu navegador le ha dado a la página de Marinara permiso para usar el micrófono.

Si estás en Firefox, o si el reconocimiento de voz del navegador no funciona, instala Calls y descarga Local Whisper. Abre **Connections**, luego **Local Model**, luego **Local Speech Model**. Luego elige **Mic recording + Local Whisper**.

### Local Whisper dice que no está disponible

Local Whisper necesita el runtime nativo de ONNX para tu plataforma. ONNX es el motor que ejecuta el modelo de voz local. Si el modelo se configuró para una compilación de Node distinta, reinstala las dependencias con la misma compilación de Node que usas para ejecutar Marinara, y luego reinicia.

Si ejecutas una compilación "Lite" de Marinara, Local Whisper está desactivado en esa compilación. La app muestra: "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model." Usa una instalación completa para obtener Local Whisper.

### La opción de voz del navegador no hace nada

El reconocimiento de voz del navegador depende del soporte del navegador. Firefox no ofrece el mismo reconocimiento de Web Speech que los navegadores Chromium y Safari. Usa **Mic recording + Local Whisper** para captura manos libres, o usa **Manual system dictation** para escribir con el dictado de tu sistema operativo.

### Un personaje solo escribe en lugar de hablar

Revisa tus ajustes de Text to Speech y las asignaciones de voz. El personaje necesita o bien la voz global única o bien una voz por personaje que tu proveedor de TTS pueda resolver. Mira [Configuración de Text to Speech (TTS)](../media/tts-setup.md).

### El modelo malinterpreta lo que digo

Prueba **Whisper Base (Multilingual)** en lugar de Whisper Tiny para mayor precisión. Reduce el ruido de fondo y la música. Si tu modelo lo admite, cambia **Audio input mode** a **Provider-native audio/video** para que el modelo oiga tu audio directamente. Para un idioma que Whisper maneja mal, [usa tu propio servidor de voz a texto](#use-your-own-speech-to-text-server) con un modelo que lo conozca, y configura su código de **Language**.

### La prueba de Speech to Text falla

Lee el mensaje que aparece bajo el botón **Test**. "Could not reach the speech-to-text server" significa que la dirección es incorrecta o que el servidor no se está ejecutando. Un mensaje que menciona `STT_LOCAL_URLS_ENABLED` significa que el servidor está en otra máquina de tu red; establece esa variable en `true` en `.env`. Un número como 401 o 404 viene de tu servidor: 401 suele indicar una API key incorrecta, y 404, una dirección o un nombre de modelo incorrectos.

### El botón de cámara o de pantalla está desactivado

Esos botones solo funcionan en el modo **Provider-native audio/video** con **Camera and screen input** activado. Cambia el **Audio input mode** y activa **Camera and screen input**, luego inténtalo de nuevo. Los botones también ayudan solo cuando tu modelo puede usar de verdad la entrada de cámara o de pantalla.

### La llamada no funciona en mi teléfono

En el teléfono, el chat de la llamada se abre con el botón **Open call chat** y se cierra con **Close call chat**. Si un personaje no habla, confirma que Text to Speech está configurado. Para problemas de micrófono en el teléfono, aplican los mismos pasos de Local Whisper y permisos de arriba.

### Un personaje dejó de responder a mitad de la llamada

Los personajes responden solo mientras la conexión de modelo que seleccionaste para el chat funciona. Si las respuestas se detienen, revisa esa conexión, y luego intenta enviar un mensaje en el chat de la llamada de nuevo.

## Guías relacionadas

- [Configuración de Text to Speech (TTS)](../media/tts-setup.md)
- [Configuración de Local Model](../connections/local-model.md)
- [Sprites del personaje (Expresiones y cuerpo completo)](../characters/sprites.md)
- [Conversation Mode: primeros pasos](getting-started.md)
