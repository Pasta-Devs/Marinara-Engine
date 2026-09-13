# Configuración de Text to Speech (TTS)

Esta guía te muestra cómo configurar Text to Speech en Marinara Engine para que la app pueda leer en voz alta los mensajes y la narración del juego. Text to Speech (TTS, texto a voz) convierte el texto escrito del chat en audio hablado. Esta guía cubre cómo elegir un proveedor de voz, elegir voces, la reproducción automática y los controles de reproducción por mensaje.

## Dónde están los ajustes de TTS

Casi todos los ajustes de TTS están en un solo lugar. Abre el panel **Connections** (Conexiones) y busca la tarjeta **Text to Speech**. La tarjeta está cerrada de forma predeterminada, así que haz clic en su encabezado para expandirla.

La app envía las solicitudes de TTS a través de su propio servidor. Tu API key (clave de API) del proveedor se guarda cifrada en el servidor. Después de guardar una clave, el campo muestra un valor enmascarado, una fila de puntos, en lugar de la clave real. La clave real nunca se envía de vuelta a tu navegador.

Activar TTS no hace que nada hable por sí solo. Solo revela el botón **Speak** (Hablar) en cada mensaje y las opciones de **Auto-play** (Reproducción automática). Tú sigues eligiendo qué se lee y cuándo.

Los mismos ajustes de reproducción permiten activar **Skip text inside HTML and custom tags** (omitir texto dentro de etiquetas HTML y personalizadas), **Skip fenced code blocks** (omitir bloques de código delimitados) o **Skip text inside square brackets** (omitir texto entre corchetes). Los bloques de código se omiten de forma predeterminada; los otros dos filtros empiezan desactivados. El filtro de etiquetas elimina el texto encerrado, como un bloque oculto `<simulation>...</simulation>`, pero conserva las etiquetas de hablante usadas para elegir voces. Estos filtros se aplican a la reproducción manual y automática, incluida la narración Game y la identificación de hablantes en Roleplay.

## Paso 1: Activa TTS y elige un Source

1. Abre el panel **Connections** y expande la tarjeta **Text to Speech**.
2. Haz clic en el interruptor del encabezado de la tarjeta para activar TTS. Pasa el cursor por encima del interruptor para ver su tooltip (texto de ayuda): **Enable TTS** cuando está apagado, **Disable TTS** cuando está encendido.
3. Abre el menú desplegable **Source** (Fuente) y elige tu proveedor.

Un **Source** es el servicio que produce el audio. Las cuatro opciones son:

- **OpenAI-compatible**: OpenAI, o cualquier servidor que copie el formato de TTS de OpenAI.
- **ElevenLabs**: el servicio de voz de ElevenLabs.
- **PocketTTS**: un servidor de voz gratuito que ejecutas en tu propia computadora.
- **xAI Voice**: el servicio de voz de xAI.

El **Source** predeterminado es **OpenAI-compatible**. Marinara mantiene un perfil guardado por separado para cada **Source**, que incluye su API key cifrada, el endpoint, el modelo, las voces y los parámetros del proveedor. Al cambiar de **Source** se restaura la configuración anterior de ese **Source**; un **Source** que aún no hayas configurado empieza con sus valores predeterminados.

## Paso 2: Introduce el Base URL, el API Key y el Model

Cada **Source** necesita una dirección web y, para la mayoría de las fuentes, un API key. Un API key es un código secreto de tu proveedor que demuestra que la solicitud es tuya.

1. Revisa el campo **Base URL**. Cada **Source** rellena un valor predeterminado razonable, mostrado en la tabla de abajo. Cámbialo solo si usas un proxy o un servidor autoalojado.
2. Pega la clave de tu proveedor en el campo **API Key**. Para conservar una clave existente, deja los puntos enmascarados en su lugar. Para eliminar una clave guardada, borra el campo.
3. Revisa el campo **Model**. Cada **Source** rellena un modelo predeterminado. Puedes escribir otro nombre de modelo que tu proveedor admita.

La app rellena estos valores predeterminados por **Source**:

| Source            | Base URL predeterminada   | Modelo predeterminado  | Voz predeterminada que la app rellena |
| ----------------- | ------------------------- | ---------------------- | ------------------------------- |
| OpenAI-compatible | https://api.openai.com/v1 | tts-1                  | alloy                           |
| ElevenLabs        | https://api.elevenlabs.io | eleven_multilingual_v2 | ninguna (debes elegir una)      |
| PocketTTS         | http://localhost:49112    | pocket-tts             | alba                            |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                             |

Para **ElevenLabs**, el campo **Model** carga los modelos capaces de sintetizar voz disponibles mediante tu conexión y siempre mantiene visible la lista completa cuando lo abres. Elige un modelo de voz normal. Los IDs de modelo que contienen `ttv` son modelos de diseño de voz, no modelos de voz, y no pueden leer texto en voz alta. Si eliges uno por error, la reproducción falla con un error que te indica que uses un modelo de voz en su lugar.

### PocketTTS es un programa aparte

PocketTTS no viene integrado en Marinara Engine. El adaptador de Marinara usa el [servidor compatible con OpenAI de PocketTTS](https://github.com/teddybear082/pocket-tts-openai_streaming_server), que expone tanto el endpoint de voz como el de lista de voces que Marinara necesita. Instala y ejecuta ese servidor siguiendo sus instrucciones; Marinara no lo descarga ni lo administra por ti.

El servidor compatible usa `http://localhost:49112` de forma predeterminada. Deja el **Base URL** en ese valor a menos que hayas cambiado el puerto del servidor. Las URLs personalizadas de PocketTTS que ya existan quedan sin cambios.

## Paso 3: Elige una voz (Voice Option)

El ajuste **Voice Option** (Opción de voz) decide cómo se asignan las voces:

- **One voice for all characters**: cada hablante usa la misma voz. Este es el valor predeterminado.
- **Selected per character**: das a ciertos personajes sus propias voces.

### One voice for all characters

Elige la voz en el campo **All Characters Voice**. PocketTTS muestra en un menú desplegable las voces que devuelve tu servidor y mantiene a su lado un campo de texto para un ID de voz, una URL o una ruta personalizados.

Para cargar la lista de voces real de tu proveedor, introduce los datos de conexión y haz clic en el botón **Refresh voices** (el icono de flecha circular). Puedes hacerlo antes de activar la reproducción. Al actualizar, primero se guarda la tarjeta actual, por lo que una clave API recién introducida se usa de inmediato. Antes de conectarte, la app muestra una breve lista de reserva integrada para que el campo no esté vacío. Si el proveedor devuelve un error, la app lo muestra en vez de presentar silenciosamente esa lista de reserva como si la actualización hubiera funcionado.

Para **ElevenLabs**, debes elegir una voz. Marinara carga la biblioteca paginada de la cuenta, incluidas las voces personales, del espacio de trabajo, guardadas y predeterminadas. El selector tiene un campo de búsqueda y una barra de desplazamiento siempre visible cuando la biblioteca es más larga que el panel. También indica cuántas voces se han cargado. El selector empieza en "Select an ElevenLabs voice", y la reproducción se bloquea hasta que elijas una voz real.

### Selected per character

1. Pon **Voice Option** en **Selected per character**.
2. Aparece la tabla **Character Voices**, con las columnas **Character** y **Voice**.
3. Haz clic en **Add character voice** para añadir una fila.
4. Elige un personaje en el menú desplegable de la izquierda y una voz en el de la derecha.
5. Repite para cada personaje al que quieras dar una voz personalizada.

El botón **Refresh** del cuadro **Character Voices** vuelve a cargar la misma biblioteca del proveedor sin cambiar al modo de una sola voz. Primero debes crear tus personajes. Si aún no tienes ninguno, la app te indica que añadas personajes en la pestaña **Characters** antes de asignar voces. Los personajes sin una voz personal recurren a la voz global. Consulta [Crear y editar personajes](../characters/creating-and-editing-characters.md).

## Narrator Voice

La narración es texto que no habla ningún personaje concreto, como la descripción de una escena o las líneas de un game master. Puedes darle una voz aparte.

1. En el cuadro **Narrator Voice**, activa **Use separate narrator voice**.
2. Elige una voz en el selector que aparece.

La app usa esta voz cuando el hablante de una línea es Narrator, GM, Game Master o System. Eso funciona en los mensajes de Roleplay y de Conversation. También cubre las líneas de narración de Game Mode que no tienen un hablante con nombre. Si usas ElevenLabs, elige aquí una voz de narrador. Si lo dejas vacío, la narración solo recurre a una voz de reserva cuando hay una voz global configurada.

## Random NPC Voices (solo en Game Mode)

Esta función asigna voces sobrantes a los personajes menores del juego. Funciona solo en Game Mode, y solo para los NPC (personajes no jugadores) que Game Mode rastrea. No tiene efecto en Roleplay ni en Conversation.

1. En el cuadro **Random NPC Voices**, activa **Use default voices for random NPCs**.
2. Aparecen dos cuadrículas de casillas: **Male NPC defaults** y **Female NPC defaults**.
3. Marca las voces de las que quieras que se surta cada grupo.

Un NPC rastreado sin una voz personal recibe una elección estable del grupo correspondiente. El mismo NPC conserva la misma voz durante una sesión. Un NPC con una voz de personaje asignada siempre conserva esa voz asignada. Si la app no puede detectar voces etiquetadas como masculinas o femeninas, cada grupo usa la lista completa de voces en su lugar.

## Audio Format y Speed

El ajuste **Audio Format** elige **MP3** (el predeterminado) o **WAV**. Usa WAV para servidores locales o autoalojados que no puedan producir MP3. Dos notas:

- El control **Audio Format** está oculto para ElevenLabs, que siempre usa MP3.
- El control aparece para xAI Voice pero no tiene efecto ahí. xAI Voice siempre devuelve MP3.

El control deslizante **Speed** controla la velocidad a la que habla la voz. El rango permitido depende del **Source**:

- OpenAI-compatible y PocketTTS: de 0.25 a 4.0 veces la velocidad normal.
- ElevenLabs: de 0.7 a 1.2 veces.
- xAI Voice: de 0.7 a 1.5 veces.

Si una velocidad guardada queda fuera del rango de la fuente actual, la app la ajusta al valor permitido más cercano cuando habla.

Solo para **ElevenLabs**, aparecen dos controles adicionales. **Language** te permite forzar un idioma hablado, o dejarlo en **Auto detect**. **Stability** se desliza entre un habla más expresiva y una más consistente.

## Auto-play: leer los mensajes automáticamente

Bajo el encabezado **Auto-play**, cada interruptor le indica a la app que lea un tipo de mensaje nuevo en cuanto termina de generarse. Todos necesitan que **Enable TTS** esté activado primero. Cada interruptor empieza apagado.

- **Roleplay messages**: lee las nuevas respuestas de Roleplay.
- **Conversation messages**: lee las nuevas respuestas de Conversation Mode.
- **Game narration**: lee la narración nueva y las líneas de combate de Game Mode.
- **Progressive playback**: cuando una respuesta tiene varias líneas, empieza a reproducir la primera línea de inmediato en lugar de esperar a la respuesta completa.
- **Only read dialogues**: lee solo las líneas habladas entre comillas o etiquetadas y omite la narración simple.

La reproducción automática se dispara una sola vez, en la respuesta más reciente, en el momento en que termina. No vuelve a leer los mensajes antiguos cuando reabres o desplazas un chat.

## Hablar un solo mensaje

Una vez que TTS está activado, aparece un botón **Speak** (un icono de micrófono) en la barra de herramientas debajo de cada mensaje de personaje o de narrador. Lee ese único mensaje cuando lo pidas.

- Haz clic en **Speak** para leer el mensaje. Mientras obtiene el audio, el botón muestra un estado de carga.
- Vuelve a hacer clic mientras se reproduce para detenerlo. El tooltip dice **Stop speaking** mientras se reproduce un mensaje.
- Un mensaje sin texto legible (por ejemplo, solo una imagen) muestra **No dialogue to speak** y permanece desactivado.

Mientras un mensaje se está reproduciendo, aparecen dos botones más. **Pause speaking** y **Resume speaking** pausan y continúan la reproducción. **Restart speaking** vuelve a empezar el mensaje desde el principio.

El botón con el icono de altavoz abre un control deslizante **Line volume** de 0 a 100 por ciento, con 50 predeterminado. Este volumen es su propio ajuste guardado. Es independiente del mezclador de Game Mode y del volumen de llamada de Conversation, así que cambiar uno no cambia los otros.

## Clips en caché

La app guarda el audio generado en tu navegador para no tener que generar la misma línea dos veces. El panel **Cached clips** muestra un recuento en vivo y el tamaño total.

Haz clic en el botón **Export cached TTS clips** (el icono de descarga) para guardar en tu dispositivo cada clip en caché como archivos de audio separados. La caché recorta sus clips más antiguos por sí sola. No hay un botón manual para vaciarla dentro de la app, así que borra los datos de tu navegador si quieres vaciarla.

## TTS en cada modo de chat

La misma configuración de TTS sirve para todos los modos, con algunos extras por modo:

- Roleplay usa el interruptor de reproducción automática **Roleplay messages** y los controles **Speak** por mensaje. Consulta [Modo Roleplay: Primeros pasos](../roleplay/getting-started.md).
- Conversation Mode usa el interruptor **Conversation messages** y los mismos controles **Speak**. Las llamadas de audio habladas son una función más amplia que se cubre en [Llamadas de audio y video de Conversation](../conversation/calls.md).
- Game Mode usa el interruptor **Game narration**. Game Mode también tiene su propio mezclador de audio con un canal **TTS** junto a **Master**, **Music**, **Sound Effects** y **Ambient**. Ese canal ajusta el volumen general del audio hablado del juego y empieza en 100 por ciento. Consulta [Game Mode: Primeros pasos](../game/getting-started.md).

## Phonetic name (pronunciación en las llamadas)

Si el nombre de un personaje o de una persona está escrito de una forma que la voz pronuncia mal, puedes añadir un **Phonetic name**. En el **Character Editor**, el campo está junto al campo **Name** del personaje. En el **Persona Editor**, está con los demás campos de información básica. Escribe cómo debería sonar el nombre.

Esta anulación se usa solo durante las llamadas de audio y video de Conversation. El botón **Speak** normal por mensaje, la reproducción automática del chat y la narración de Game Mode no leen este campo.

## Solución de problemas

- No habla nada: confirma que el interruptor **Enable TTS** está activado. Luego revisa el interruptor de **Auto-play** correcto para cada modo, o usa el botón **Speak** por mensaje. El botón **Speak** y las opciones de reproducción automática solo aparecen después de activar TTS.
- No hay voces en el menú desplegable: guarda la tarjeta con TTS activado y un API key válido, luego haz clic en **Refresh voices**. Para PocketTTS, verifica además que `<Base URL>/v1/voices` responda desde el servidor compatible.
- ElevenLabs no habla: asegúrate de haber seleccionado una voz real, no el marcador de posición "Select an ElevenLabs voice". Comprueba también que el **Model** sea un modelo de voz, no un modelo de diseño de voz cuyo ID contenga `ttv`.
- Un servidor de TTS autoalojado en una dirección local está bloqueado: activa el ajuste del servidor `TTS_LOCAL_URLS_ENABLED`. Permite que la app llegue a una dirección local o privada para servidores compatibles con OpenAI o de estilo ElevenLabs. PocketTTS no necesita este ajuste. Consulta [Referencia de configuración del servidor](../CONFIGURATION.md).
- Prueba tu configuración rápido: haz clic en el botón **Preview** de la tarjeta para reproducir una breve línea de muestra con tus ajustes actuales.

## Guías relacionadas

- [Llamadas de audio y video de Conversation](../conversation/calls.md)
- [Modo Roleplay: Primeros pasos](../roleplay/getting-started.md)
- [Game Mode: Primeros pasos](../game/getting-started.md)
- [Proveedores de IA compatibles](../connections/providers-reference.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
