# Llamadas de audio y video de Conversation

Una llamada es una pantalla en vivo, como una app de chat de voz, donde hablas con uno o más personajes por micrófono o escribiendo. Se coloca encima del chat de Conversation normal mientras dura. Las llamadas existen solo en Conversation Mode (modo Conversación).

Calls es un paquete opcional. Instala **Calls** desde **Agents → Agent Organizer** (Organizador de agentes). Si el catálogo te pide reiniciar, detén Marinara y vuelve a iniciarla de la forma en que la inicias normalmente (consulta [Instalación](../INSTALLATION.md)).

Durante una llamada, los personajes con una voz de Text to Speech (TTS, texto convertido en audio hablado) que funcione hablan en voz alta. Los personajes sin voz responden con mensajes escritos en el chat de la llamada. También puedes mostrar clips de video en bucle hechos con IA de un personaje en lugar de un avatar fijo.

Marinara graba tu micrófono o tu cámara en tu navegador. Según el modo de entrada (abajo), tu voz se convierte en texto en tu propia computadora o se envía al modelo que elegiste para el chat. Las respuestas se hablan mediante tu servicio de TTS. Cuando termina la llamada, un resumen corto vuelve a la Conversation. La transcripción completa se queda en un almacenamiento de llamadas aparte.

## Qué necesitas

- **Calls** instalado.
- Un chat de Conversation con al menos un personaje, y una cuenta para el modelo que escribe las respuestas.
- **Audio/Video Calls** y **Call Audio Pipeline** activados en los ajustes del chat.
- Opcional: una cuenta de Text to Speech, para que los personajes hablen. Sin ella responden con texto.
- Opcional: el modo de micrófono predeterminado necesita una descarga única de Local Whisper (consulta [Descargar Local Whisper](#download-local-whisper)). En su lugar puedes escribir en el chat de la llamada.

## Configurar tu primera llamada

Antes de empezar: necesitas un chat de Conversation con al menos un personaje, y una cuenta para el modelo que escribe las respuestas (consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)).

1. Opcional: configura Text to Speech (consulta [Configurar Text to Speech](#set-up-text-to-speech)). Sin él, cada personaje se une solo con texto.
2. Abre el chat y luego abre **Chat Settings → Agents → Calls**.
3. Activa **Audio/Video Calls**. Aparece un botón de llamada junto al nombre de la conversación.
4. Activa **Call Audio Pipeline**. Ninguna llamada puede empezar sin él, aunque solo escribas o solo escuches. También habilita el micrófono.
5. Elige un **Audio input mode** (abajo).
6. Haz clic en **Start call**.

Si no funcionó: cuando veas "Conversation call audio is not enabled in Chat Settings", **Call Audio Pipeline** está desactivado. Es un ajuste global, así que activarlo en un chat lo activa para todas las llamadas de Conversation.

Para un chat nuevo, termina primero el asistente de configuración y luego abre los **Chat Settings** de ese chat. Los ajustes de Calls solo se muestran cuando Calls está instalado.

Dos interruptores se parecen pero hacen cosas distintas:

- **Audio/Video Calls** muestra el botón de llamada, para que puedas llamar a un personaje.
- El comando **Calls** permite que los personajes te llamen primero. Con él desactivado, igualmente puedes iniciar llamadas tú.

El interruptor general **Commands** de la misma sección debe estar activado para los comandos dentro de la llamada. La llamada en sí puede empezar con él desactivado.

<a id="set-up-text-to-speech"></a>

### Configurar Text to Speech

Text to Speech decide qué personajes pueden hablar y con qué voz. Lee [Configuración de Text to Speech (TTS)](../media/tts-setup.md) para ver el recorrido completo. En resumen, abre **Connections** (Conexiones), haz clic en **Add account** y elige **Text to speech**. Si ya aparece en **On this device**, ábrelo allí. Luego:

1. Activa Text to Speech.
2. Elige una fuente: **OpenAI-compatible**, **ElevenLabs**, **PocketTTS** o **xAI Voice**.
3. Escribe la API key (clave de API) o la dirección del servidor local de esa fuente.
4. Elige un modelo y una voz.
5. Define **Voice option** como **One voice for all** o **Selected per character or persona**. Las voces por personaje hacen que las llamadas grupales sean más fáciles de seguir.
6. Guarda y luego usa el botón de vista previa para confirmar que oyes audio.

Si un personaje no tiene una voz que Marinara pueda resolver, ese personaje es solo texto durante la llamada.

### Elegir un Audio input mode

Cuando **Call Audio Pipeline** está activado, aparece la lista **Audio input mode**. Si no estás seguro, conserva el valor predeterminado.

| Modo | Qué hace |
| --- | --- |
| **Mic recording + Local Whisper** (predeterminado) | Graba mientras no estás silenciado, ignora los silencios y convierte tu voz en texto en tu propia computadora. Lo mejor para Firefox. |
| **Browser speech recognition** | Usa la herramienta de voz integrada en tu navegador. La compatibilidad varía. Marinara recurre a Local Whisper cuando falta. |
| **Manual system dictation** | Solo coloca el cursor en el cuadro de texto de la llamada para que el dictado de tu sistema operativo escriba allí. Marinara no graba. |
| **Provider-native audio/video** | Envía tu audio o video grabado directamente al modelo, si el modelo acepta medios. |

Los botones de cámara y de pantalla necesitan **Camera and screen input** activado y funcionan solo en el modo **Provider-native audio/video**. En los demás modos se muestran pero siguen desactivados.

## Iniciar, contestar y terminar una llamada

**Iniciar una llamada.** Con las llamadas activadas, un botón de teléfono está junto al nombre de la conversación. Su tooltip es **Start call**, u **Open call** cuando hay una llamada en curso. Haz clic y se abre la pantalla de la llamada. Solo puede haber una llamada activa o sonando por chat. Iniciar otra vuelve a abrir la actual.

**Contestar una llamada.** Un personaje puede llamarte cuando el comando **Calls** está activado. En ese chat aparece un banner **Incoming call** encima del cuadro de mensaje con **Decline call** y **Answer call**. En otras partes de Marinara recibes una notificación de llamada entrante y un tono de timbre corto. Marinara nunca contesta por ti. Solo se unen los personajes que están disponibles: un personaje cuyo horario o estado es offline no se une.

**Terminar una llamada.** Haz clic en el botón rojo **End call** de la pantalla de la llamada o de la ventana flotante minimizada. Un personaje también puede salir de la llamada o terminarla con un comando dentro de la llamada. Entonces Marinara deja de grabar y añade una tarjeta a la Conversation.

## La pantalla de la llamada

El escenario muestra un mosaico por participante, tu persona y cada personaje disponible, y resalta quién está hablando. El chat de la llamada contiene los mensajes escritos y las respuestas solo de texto. Las líneas habladas no se repiten allí. En escritorio es un panel lateral. En un teléfono se abre como un cajón con **Open call chat** y se cierra con **Close call chat**.

El compositor de la llamada tiene un cuadro **Message in call**, **Send**, un selector de emoji, GIF y stickers y un selector rápido de modelo. Los archivos adjuntos no se admiten en el chat de la llamada.

| Control | Qué hace |
| --- | --- |
| Micrófono | Te silencia o te quita el silencio. El tooltip cambia con el modo, por ejemplo **Unmute microphone with Local Whisper**. |
| **Turn camera on** / **Turn camera off** | Solo en el modo Provider-native audio/video con **Camera and screen input** activado. |
| **Share screen** / **Stop sharing screen** | La misma regla que la cámara. |
| **Character volume** | Un botón de silencio y un control deslizante de 0 a 100. Predeterminado 100, guardado en el navegador. |
| **Soundboard** | Una lista de sonidos con un control **Upload**. |
| **End call** | El botón rojo de colgar. |

Si sigues silenciado un rato, ves "You are muted! Remember to unmute yourself first if you want to talk."

Si sales de la Conversation durante una llamada, se reduce a una ventana flotante con el nombre del chat, el tiempo transcurrido y **End call**. Haz clic en la ventana flotante para volver. La llamada sigue mientras navegas.

### Soundboard

El soundboard tiene cuatro sonidos integrados que no puedes borrar: **Soft Chime**, **Tap**, **Sparkle** y **Pop**. Haz clic en **Upload** para añadir los tuyos (mp3, wav, ogg, webm o m4a, hasta 8 MB cada uno). Puedes borrar tus propias subidas. Los personajes pueden reproducir un sonido con el comando del soundboard.

## Character Video Presence

Esta parte es opcional y avanzada. **Character video presence** reemplaza el mosaico de un avatar fijo por un clip en bucle hecho con IA del personaje. Está desactivado de forma predeterminada. El interruptor está en **Chat Settings → Agents → Calls**.

Antes de empezar: añade una cuenta de Video Generation en **Connections**, y marca una como **Default for Videos** o elige una cada vez.

1. Abre el editor de un personaje o de una persona.
2. Abre la pestaña **Sprites** y luego la subpestaña **Clips**.
3. Haz clic en **Generate Clips**, o en **Upload extra** para añadir los tuyos.
4. En la ventana **Generate Call Clips**, elige una **Video Generation Connection** y marca **Use avatar as reference**.
5. Elige los clips estándar que quieres crear: **Idle**, **Talking**, **Laughing**, **Angry**, **Crying**, **Sighing**. También puedes definir un clip personalizado con un **Clip name** y una descripción de la acción.

Durante un turno hablado, Marinara lee las indicaciones de voz de una línea, como `[sighs]`, elige un clip de reacción que coincida y luego vuelve a Idle. Un clip que falta nunca bloquea una llamada: el personaje muestra un avatar fijo. Un clip recortado se repite dentro de su intervalo de recorte. Consulta [Sprites de personajes (expresiones y cuerpo completo)](../characters/sprites.md).

Aparecen dos interruptores más bajo **Character video presence** cuando está activado:

- **Automatic video clips generation** (desactivado de forma predeterminada) crea solo **Idle** y **Talking** para un participante que los necesita. Los clips de reacción y los personalizados nunca se crean automáticamente.
- **Custom clips** (desactivado de forma predeterminada) permite que un personaje pida de vez en cuando un clip único en una llamada en vivo y reproduzca un clip personalizado que ya esté listo. Es para peticiones especiales, no para cada estado de ánimo.

Desactivar **Character video presence** también desactiva ambos. Los clips de aquí son bucles de presencia reutilizables, no los **Videos** de la Gallery, que contienen videos de escenas.

## Configuración de speech-to-text (avanzada)

Solo hace falta para el modo **Mic recording + Local Whisper**, o si quieres tu propio servidor de speech-to-text.

<a id="download-local-whisper"></a>

### Descargar Local Whisper

Local Whisper convierte tu voz en texto en la computadora que ejecuta Marinara, así que el audio de tu micrófono no sale de ella para la transcripción. El texto igualmente se envía a tu modelo como parte de la llamada. Es el camino de micrófono más fiable para navegadores con poca compatibilidad de voz, como Firefox.

Antes de empezar: instala Calls. La sección está oculta sin él.

1. Abre **Connections** y busca **Speech to text** en **On this device**. Si no aparece, haz clic en **Add account** y elige **Speech to text**.
2. Busca **Local speech model** en esa página.
3. Elige un modelo:
   - **Whisper Tiny (Multilingual)**: unos 180 MB de descarga y 350 MB de memoria. Lo mejor para teléfonos y computadoras antiguas.
   - **Whisper Base (Multilingual)**: unos 320 MB de descarga y 650 MB de memoria. Mejor con voz poco clara.
4. Haz clic en **Download Whisper** y espera a la barra de progreso.
5. Reinicia Marinara por completo antes de usar Calls.

Un icono de papelera, **Delete Local Whisper**, quita el modelo. Desinstalar Calls también borra los modelos de Whisper descargados; reinstalarlo no descarga uno de nuevo hasta que lo elijas.

Si no funcionó: en una compilación Lite de Marinara ves "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model." Si ves un mensaje sobre el "native ONNX runtime", falta el motor de voz para tu plataforma. Reinstala las dependencias con la misma compilación de Node con la que ejecutas Marinara y luego reinicia.

<a id="use-your-own-speech-to-text-server"></a>

### Usar tu propio servidor de speech-to-text

Si Local Whisper tiene problemas con tu idioma o tu acento, envía tu voz a otro servidor de speech-to-text. Sirve cualquier servidor que acepte el formato de speech-to-text de OpenAI (la dirección `/audio/transcriptions`), ya sea uno que ejecutes tú o un servicio como OpenAI o Groq.

1. Abre **Connections** y abre **Speech to text** en **On this device**. Si no aparece, haz clic en **Add account** y elige **Speech to text**. Está oculto mientras Calls no está instalado.
2. Escribe la **Server URL**, por ejemplo `http://localhost:8000/v1`.
3. Escribe una **API key** si el servidor la necesita. Se guarda cifrada y se muestra enmascarada.
4. Escribe el nombre del **Model** que usa tu servidor. Déjalo vacío para enviar `whisper-1`.
5. Opcional: escribe un código de **Language** como `pl` o `de`. Déjalo vacío para que el servidor lo detecte.
6. Haz clic en **Test**. Marinara envía un clip silencioso de un segundo. Ves "The server answered." o "The test failed."
7. Activa **Use your own speech-to-text server**.

Mientras está activado, **Mic recording + Local Whisper** envía tu voz a este servidor, y no necesitas descargar Local Whisper. Tu audio va a ese servidor, así que usa uno en el que confíes.

Un servidor en la misma computadora funciona tal cual. Un servidor en otra computadora de tu red se rechaza a menos que definas `STT_LOCAL_URLS_ENABLED=true` en `.env` (consulta la [Referencia de configuración del servidor](../CONFIGURATION.md)).

Si no funcionó: lee el mensaje debajo de **Test**. "Could not reach the speech-to-text server" significa que la dirección es incorrecta o que el servidor está apagado. Un mensaje que nombra `STT_LOCAL_URLS_ENABLED` significa que el servidor está en otra computadora. Un número viene de tu servidor: 401 normalmente significa una API key incorrecta, 404 una dirección o un nombre de modelo incorrectos. Si las llamadas siguen usando Local Whisper, actualiza Calls desde **Agents → Agent Organizer**.

## Ajustes y valores predeterminados

Los ajustes **Per chat** se aplican a un chat. Los ajustes **Global** se aplican a todas las llamadas de Conversation.

| Ajuste | Ámbito | Predeterminado |
| --- | --- | --- |
| **Audio/Video Calls** | Per chat | Off |
| **Calls** (command) | Per chat | On |
| **Generate voice cues in [tags]** | Per chat | On |
| **Call Audio Pipeline** | Global | Off |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | Off |
| **Character video presence** | Global | Off |
| **Automatic video clips generation** | Global | Off |
| **Custom clips** | Global | Off |

Un ajuste global cambiado en un chat cambia para todas las llamadas de Conversation. **Generate voice cues in [tags]** le pide al modelo que añada indicaciones cortas como `[whispering]`, `[laughing]` o `[sighs]` dentro de las líneas habladas. Dan forma a cómo el TTS lee la línea y ayudan a elegir los clips de reacción. Desactívalo para mantener las líneas habladas sin adornos.

## Comandos en una llamada

Los personajes usan en una llamada los mismos comandos ocultos que en los mensajes normales. Cada uno necesita su interruptor en **Chat Settings → Agents → Commands** y el interruptor general **Commands** activado. Consulta [Elegir qué Commands puede usar un personaje](getting-started.md#choose-which-commands-a-character-can-use). Se ejecutan en silencio y nunca se hablan.

Dos extras funcionan en una llamada: **Soundboard** (un personaje reproduce un sonido del soundboard) y salir o terminar (un personaje sale de la llamada, o la termina para todos). **Notes** e **Influence** aparecen solo cuando el chat tiene un chat conectado (consulta [Chats conectados](../chats/connected-chats.md)). Una selfie necesita un **Selfie model** (consulta [Selfies](selfies.md)). Algunos comandos añaden una pequeña entrada al chat de la llamada, como "sent a selfie" con la imagen.

## El resumen al terminar la llamada

Cuando termina una llamada, aparece una tarjeta en la Conversation. Su título es **Call Started**, **Incoming Call**, **Call Ended** (con la duración), **Call Declined** o **Missed Call**. Después de **Call Ended**, si pasó algo importante, Marinara escribe un resumen corto en segundo plano y lo añade como contexto oculto que el modelo puede leer. Esto mantiene al modelo al tanto de la llamada sin copiarla en el chat visible.

## Solución de problemas

| Síntoma | Solución |
| --- | --- |
| Los personajes no me oyen | Confirma que **Call Audio Pipeline** está activado y que tu navegador permite el micrófono para la página de Marinara. En Firefox, o si la voz del navegador no funciona, descarga Local Whisper y usa **Mic recording + Local Whisper**. |
| La opción de voz del navegador no hace nada | Firefox no tiene el reconocimiento Web Speech que tienen los navegadores Chromium y Safari. Usa **Mic recording + Local Whisper**, o **Manual system dictation**. |
| Un personaje escribe en lugar de hablar | Revisa tus ajustes de Text to Speech y las asignaciones de voz. Consulta [Configuración de Text to Speech (TTS)](../media/tts-setup.md). |
| El modelo entiende mal mi voz | Prueba **Whisper Base (Multilingual)**, reduce el ruido, o usa **Provider-native audio/video** si tu modelo lo admite. Para un idioma que Whisper maneja mal, [usa tu propio servidor de speech-to-text](#use-your-own-speech-to-text-server) y define su **Language**. |
| El botón de cámara o de pantalla está desactivado | Usa el modo **Provider-native audio/video** y activa **Camera and screen input**. Tu modelo también debe aceptar entrada de cámara o de pantalla. |
| Un personaje deja de responder a mitad de la llamada | Revisa la cuenta del modelo del chat y luego envía un mensaje en el chat de la llamada de nuevo. |
| La llamada no funciona en mi teléfono | El chat de la llamada se abre con **Open call chat**. Para la voz, confirma que el TTS está configurado. Para el micrófono, se aplican los mismos pasos de Local Whisper y de permisos. |

## Guías relacionadas

- [Configuración de Text to Speech (TTS)](../media/tts-setup.md)
- [Configuración del modelo integrado](../connections/local-model.md)
- [Sprites de personajes (expresiones y cuerpo completo)](../characters/sprites.md)
- [Conversation Mode: primeros pasos](getting-started.md)
