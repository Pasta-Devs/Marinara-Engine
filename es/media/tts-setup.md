# Configuración de Text to Speech (TTS)

Text to Speech (TTS, texto a voz) lee en voz alta los mensajes del chat y la narración del juego. Esta guía muestra cómo activarlo, elegir un servicio de voz y las voces, configurar la reproducción automática y usar los controles por mensaje.

## Inicio rápido

1. Haz clic en **Connections** (Conexiones) en la barra superior y después en **Add** (Añadir).
2. Haz clic en **Voice** (Voz) en los filtros de tipo, elige un servicio y pega tu clave en **API key**. Haz clic en **Connect** (Conectar).
3. En **Found in … — use it for:**, marca **Voice** y haz clic en **Done** (Listo). Elegir un modelo de Voice activa el texto a voz.
4. Haz clic en el engranaje junto a **Voice** en la página **Jobs** (Tareas) y después en **Preview** (Vista previa) para oír una muestra. En un chat, haz clic en **Speak** (Leer en voz alta) debajo de un mensaje.

## Activar Text to Speech

Elegir un modelo para la tarea **Voice** activa el texto a voz. No hace que nada se lea por sí solo. Muestra el botón **Speak** en cada mensaje y las opciones de **Auto-play**. Tú sigues eligiendo qué se lee y cuándo.

1. Haz clic en **Connections** en la barra superior y luego en **All jobs** (Todas las tareas), debajo de **Jobs**. Busca **Voice**.
2. Haz clic en la fila y elige un modelo o servicio de voz. La fila muestra tu selección.
3. Haz clic en el engranaje de la fila para abrir los ajustes de voz. Si aún no tienes una cuenta de voz, haz clic en **Add** en la fila, o añade una como en el inicio rápido.
4. Para desactivar el texto a voz, haz clic en la fila y elige **Turn voice off** (Desactivar la voz). La fila muestra **Off** (Desactivado) y no se lee nada en voz alta.

Un servicio de voz es el servicio que crea el audio. Marinara admite estos:

- **OpenAI-compatible**: OpenAI o cualquier servidor que imite el formato TTS de OpenAI. Es el predeterminado.
- **ElevenLabs**: el servicio de voz de ElevenLabs.
- **PocketTTS**: un servidor de voz gratuito que ejecutas en tu propia computadora.
- **xAI Voice**: el servicio de voz de xAI.

Marinara guarda un perfil separado para cada servicio de voz: su clave, dirección, modelo, voces y parámetros. Al cambiar de servicio, se recupera su configuración anterior. Un servicio que aún no has configurado empieza con los valores predeterminados.

Las solicitudes pasan por el servidor de Marinara. Tu clave API se guarda cifrada en el servidor. Después de guardarla, el campo muestra puntos y la clave real nunca vuelve a tu navegador.

<a id="use-an-audio-connection"></a><a id="use-a-voice-model-from-an-account"></a>

### Usar un modelo de Voice de una cuenta

Si ya añadiste una cuenta **Audio** (consulta [Proveedores de IA compatibles](../connections/providers-reference.md#audio)), no necesitas introducir sus datos otra vez. Sus modelos de voz aparecen en el selector de **Voice**.

1. Haz clic en **Voice** en la página **Jobs** y elige el modelo.
2. Haz clic en el engranaje de la fila. Elige las voces y los demás ajustes.

Marinara usa la dirección, la clave, el modelo y el valor **Request timeout (seconds)** de esa cuenta, así que los ajustes de voz no muestran esos campos. La clave permanece en la cuenta y nunca se copia a los ajustes de voz ni se envía a tu navegador. Los cambios de la cuenta, como una nueva clave, se aplican de inmediato.

Las voces, la velocidad y los demás ajustes de voz se guardan por cuenta. Dos cuentas del mismo tipo nunca los comparten. Tus ajustes para los cuatro servicios de voz habituales se mantienen.

Si la cuenta elegida se elimina o no se puede usar, la fila muestra **The voice account is missing** (Falta la cuenta de voz) y no se lee nada hasta que elijas otro modelo de voz. Marinara nunca cambia por su cuenta.

## Configurar la dirección, la clave y el modelo

La ventana **Add account** (Añadir cuenta) solo pide la clave o la dirección. Para cambiarlas después, haz clic en **⋯** en la cuenta de **Connections** y después en **Edit account** (Editar cuenta). Omite esto si elegiste una cuenta Audio. La cuenta proporciona estos datos.

1. Comprueba **Address** (Dirección). Cada servicio rellena un valor predeterminado (tabla siguiente). Cámbialo solo para un proxy o un servidor que tú ejecutes.
2. Pega tu clave en **API key**. Para conservar una clave existente, deja los puntos. Para quitarla, vacía el campo.
3. Elige el modelo o escribe otro ID de modelo que admita tu servicio.

| Servicio de voz | Dirección predeterminada | Modelo predeterminado | Voz predeterminada |
| --- | --- | --- | --- |
| OpenAI-compatible | `https://api.openai.com/v1` | `tts-1` | `alloy` |
| ElevenLabs | `https://api.elevenlabs.io` | `eleven_multilingual_v2` | ninguna, debes elegir una |
| PocketTTS | `http://localhost:8000` | `pocket-tts` | `alba` |
| xAI Voice | `https://api.x.ai/v1` | `grok-tts` | `eve` |

Para **ElevenLabs**, la lista de modelos carga los modelos de voz que puede usar tu cuenta. Elige un modelo de voz normal. Los ID de modelo que contienen `ttv` son modelos de diseño de voces que no pueden leer texto. Si eliges uno, la reproducción falla con un error que te indica que uses un modelo de voz.

### PocketTTS

PocketTTS no está integrado en Marinara. Instala [el servidor oficial de PocketTTS](https://github.com/kyutai-labs/pocket-tts) por separado e inícialo con `uvx pocket-tts serve`. Marinara no lo descarga ni lo administra. El servidor oficial usa `http://localhost:8000`. Deja **Address** con ese valor salvo que hayas cambiado el host o el puerto. Marinara detecta la API multipart oficial `/tts`. Las URL personalizadas del [adaptador de PocketTTS compatible con OpenAI](https://github.com/teddybear082/pocket-tts-openai_streaming_server) siguen funcionando.

<a id="request-timeout"></a>

### Tiempo de espera de la solicitud

Marinara espera hasta 60 segundos por cada línea hablada. Un servidor de voz en tu propia computadora, sobre todo en una laptop, puede necesitar más tiempo para una línea larga. Sube **Request timeout (seconds)** en **More** (Más), dentro de **Voice settings** (Ajustes de voz; el engranaje junto a **Voice** en la página **Jobs**). El rango es de 10 a 3.600 segundos.

Una cuenta Audio tiene su propio **Request timeout (seconds)**, debajo de **Default voice** (Voz predeterminada) en la ventana **Edit model** (Editar modelo) de su modelo y en **Voice settings**. Los chats que hablan mediante una cuenta Audio, incluida una elegida para la tarea **Voice**, usan ese límite. El límite de **Voice settings** cubre el habla desde esos ajustes, incluido **Preview**. Si una línea tarda demasiado, el error indica cuántos segundos esperó Marinara y qué ajuste debes aumentar.

## Elegir voces

Cada hablante usa **Shared voice** (Voz compartida) hasta que das una voz propia a un personaje o una persona. La sección **Who speaks** (Quién habla) de **Voice settings** contiene ambas opciones.

### Una voz para todos

Elige la voz en **Shared voice**. Para cargar la lista real de voces de tu servicio, haz clic en **Refresh voices from provider** (Actualizar voces del proveedor, el icono de flecha circular). Antes de conectarte, aparece una lista integrada corta para que el campo no esté vacío. Los errores del servicio se muestran, en lugar de presentar la lista de respaldo como si la actualización hubiera funcionado.

El servidor oficial de PocketTTS no tiene un endpoint para listar voces, así que Marinara muestra sus voces integradas y mantiene un campo de texto junto a la lista para otro nombre integrado o una URL de voz compatible. Los servidores adaptadores compatibles pueden devolver su propia lista y aceptar ID o rutas personalizados.

Para **ElevenLabs** debes elegir una voz. Marinara carga toda la biblioteca de la cuenta: voces personales, del espacio de trabajo, guardadas y predeterminadas. El selector tiene un cuadro de búsqueda y un recuento de las voces cargadas. Empieza en "Select an ElevenLabs voice", y la reproducción se bloquea hasta que elijas una voz real.

### Seleccionada por personaje o persona

1. En **Character and persona voices** (Voces de personajes y personas), haz clic en **Add voice** (Añadir voz).
2. Elige un personaje o una persona en la lista izquierda y una voz en la derecha.
3. Repite para cada uno.

También puedes elegir la voz de un personaje en la pestaña **Voice** del **Character Editor** (Editor de personajes). Cambia la misma fila. Mientras los personajes comparten una voz, la pestaña dice **All characters share one voice right now.** Haz clic en **Use a voice per character** para cambiar y elige una voz. Haz clic en **Open Text to Speech settings** para abrir **Voice settings**. **Refresh** (Actualizar) en **Character and persona voices** vuelve a cargar la lista de voces. Crea primero tus personajes. Si no tienes ninguno, la app te indica que añadas un personaje o una persona antes de asignar voces.

Un personaje sin una voz personal usa la voz de una tarjeta con un nombre coincidente, como el original de una copia AU. De lo contrario, usa la voz compartida. Consulta [Crear y editar personajes](../characters/creating-and-editing-characters.md).

### Voz del narrador

La narración es texto que no dice ningún personaje concreto, como la descripción de una escena o las líneas de un game master.

1. En **Narrator voice** (Voz del narrador), activa **Use separate narrator voice** (Usar una voz de narrador aparte).
2. Elige una voz.

Se usa cuando el hablante de una línea es Narrator, GM, Game Master o System, en los mensajes de Roleplay y de Conversation, y para la narración de Game Mode sin un hablante con nombre. Con ElevenLabs, elige aquí una voz de narrador. Si lo dejas vacío, la narración solo recurre a una voz de reserva cuando hay una voz global configurada.

### Voces aleatorias para NPC (solo en Game Mode)

Esto da voces sobrantes a los personajes menores del juego que Game Mode rastrea. No tiene efecto en Roleplay ni en Conversation.

1. En **Random NPC voices** (Voces aleatorias para NPC), activa **Use default voices for random NPCs** (Usar voces predeterminadas para los NPC aleatorios).
2. Marca voces en **Male NPC defaults** (Valores predeterminados para NPC masculinos) y **Female NPC defaults** (Valores predeterminados para NPC femeninos).

Un NPC (personaje no jugador) rastreado sin una voz personal recibe una elección estable del grupo correspondiente y la conserva durante la sesión. Un NPC con una voz asignada conserva esa voz. Los NPC de género poco claro eligen de ambos grupos. Si la app no encuentra voces etiquetadas como masculinas o femeninas, cada grupo usa la lista completa.

## Formato de audio y velocidad

**Audio format** (Formato de audio) es **MP3** (predeterminado) o **WAV**. Usa WAV para servidores locales que no puedan producir MP3. El control está oculto para ElevenLabs, que siempre usa MP3. Aparece para xAI Voice pero no tiene efecto, porque xAI siempre devuelve MP3.

El rango del control **Speed** (Velocidad) depende del servicio de voz:

| Servicio de voz | Rango |
| --- | --- |
| OpenAI-compatible | De 0,25 a 4,0 veces |
| PocketTTS | De 0,25 a 4,0 en los adaptadores compatibles. El servidor oficial controla la velocidad por sí mismo. |
| ElevenLabs | De 0,7 a 1,2 veces |
| xAI Voice | De 0,7 a 1,5 veces |

Una velocidad guardada fuera del rango se ajusta al valor permitido más cercano. Para ElevenLabs hay dos controles más: **Language** (Idioma: fuerza un idioma o déjalo en **Auto detect**) y **Stability** (Estabilidad: de más expresiva a más consistente).

## Reproducción automática

Cada interruptor **Auto-play** lee un tipo de mensaje nuevo en cuanto termina de generarse. Necesitan un modelo en la tarea **Voice**. Todos empiezan desactivados.

- **Roleplay messages** (Mensajes de Roleplay): las respuestas nuevas de Roleplay.
- **Conversation messages** (Mensajes de Conversation): las respuestas nuevas de Conversation.
- **Game narration** (Narración del juego): la narración nueva y las líneas de combate de Game Mode.
- **Progressive playback** (Reproducción progresiva): empieza de inmediato la primera línea de una respuesta de varias líneas en lugar de esperar a la respuesta completa.
- **Only read dialogues** (Leer solo los diálogos): lee solo las líneas habladas entre comillas o etiquetadas y omite la narración simple.

La reproducción automática se dispara una sola vez, en la respuesta más reciente, cuando termina. No vuelve a leer los mensajes antiguos cuando reabres o desplazas un chat.

En Roleplay, la preparación de voz empieza en cuanto se guarda la respuesta principal. Si un agente activo reescribe la respuesta, como Prose Guardian, Marinara espera al texto definitivo.

### Filtros de texto e indicaciones de emoción

Estos filtros se aplican a la reproducción manual y a la automática, incluidas la narración de Game y la identificación de hablantes en Roleplay. Los bloques de código se omiten de forma predeterminada. Los otros dos empiezan desactivados.

- **Skip text inside HTML and custom tags** (Omitir el texto dentro de etiquetas HTML y personalizadas): elimina el texto encerrado, como un bloque oculto `<simulation>...</simulation>`. Se conservan las etiquetas de hablante que se usan para elegir voces.
- **Skip fenced code blocks** (Omitir los bloques de código delimitados).
- **Skip text inside square brackets** (Omitir el texto entre corchetes).

Activa **Roleplay speaker extractor** (Identificación de hablantes en Roleplay) para ver **Enable emotion indicators** (Activar indicadores de emoción). Esta opción añade indicaciones de voz sin cambiar las palabras del diálogo. Con los indicadores de emoción activados, el texto entre corchetes llega al servicio de voz incluso si **Skip text inside square brackets** está activado. Esto puede incluir notas. Para que las notas entre corchetes no se lean, desactiva los indicadores de emoción y deja activada la opción de omitir. Las indicaciones como `[Low, steady voice, restrained urgency]` se mantienen completas cuando una línea larga se divide. Se siguen eliminando las etiquetas conocidas de hablante y de escena. El modelo de voz decide cómo usar cada indicación. Con un modelo en la tarea **Voice**, **Game narration** y los indicadores de emoción activados, los diálogos de escena, del grupo y de combate de Game también pueden incluir indicaciones.

## Hablar un solo mensaje

Cuando la tarea **Voice** tiene un modelo, aparece un botón **Speak** (un icono de micrófono) en la barra de herramientas debajo de cada mensaje de personaje o narrador.

- Haz clic en **Speak** para leerlo. El botón muestra un estado de carga mientras obtiene el audio.
- Vuelve a hacer clic mientras se reproduce para detenerlo. El tooltip (texto de ayuda) dice **Stop speaking** (Detener la voz).
- Un mensaje sin texto legible, como uno que solo tiene una imagen, muestra **No dialogue to speak** (No hay diálogo que leer) y permanece desactivado.

Mientras un mensaje se reproduce, aparecen los botones **Pause speaking** (Pausar la voz), **Resume speaking** (Reanudar la voz) y **Restart speaking** (Reiniciar la voz). El botón con el icono de altavoz abre un control deslizante **Line volume** (Volumen de línea) de 0 a 100 por ciento (50 de forma predeterminada). Es independiente del mezclador de Game Mode y del volumen de llamada de Conversation.

Si no funcionó, consulta [Solución de problemas](#troubleshooting).

## Clips en caché

Marinara guarda el audio generado en tu navegador para no generar la misma línea dos veces. La sección **Cached clips** (Clips en caché) de **Voice settings** muestra un recuento en vivo y el tamaño total. Haz clic en **Export cached TTS clips** (Exportar los clips de TTS en caché; el icono de descarga) para guardar cada clip en caché como archivos de audio separados. La caché recorta sus clips más antiguos por sí sola. No hay un botón para vaciarla en la app. Borra los datos de tu navegador para vaciarla.

## TTS en cada modo de chat

- **Roleplay** usa el interruptor **Roleplay messages** y los controles **Speak**. Consulta [Modo Roleplay: primeros pasos](../roleplay/getting-started.md).
- **Conversation** usa el interruptor **Conversation messages** y los mismos controles. Las llamadas de audio se cubren en [Llamadas de audio y video de Conversation](../conversation/calls.md).
- **Game Mode** usa el interruptor **Game narration**. Su mezclador tiene un canal **TTS** junto a **Master**, **Music**, **Sound Effects** y **Ambient**. Ajusta el volumen del audio hablado del juego y empieza en 100 por ciento. Consulta [Los controles del juego](../game/getting-started.md#the-games-controls).

### Phonetic name (pronunciación en las llamadas)

Si la voz pronuncia mal el nombre de un personaje o de una persona, añade un **Phonetic name** (Nombre fonético) y escribe cómo debería sonar. En el **Character Editor** está en la pestaña **Voice**. En el **Persona Editor** (Editor de persona) está con los campos de información básica. Solo se usa en las llamadas de audio y video de Conversation. **Speak**, la reproducción automática y la narración de Game Mode lo ignoran.

<a id="troubleshooting"></a>

## Solución de problemas

- **No se lee nada**: comprueba que **Voice** no esté en la parte **Off** de la página **Jobs**. Después comprueba el interruptor **Auto-play** adecuado, o usa **Speak** en un mensaje.
- **La fila Voice muestra The voice account is missing**: la cuenta del modelo de voz se eliminó o no se puede usar. Elige otro modelo de voz. Consulta [Usar un modelo de Voice de una cuenta](#use-a-voice-model-from-an-account).
- **No hay voces en la lista**: comprueba que la fila **Voice** tenga un modelo y una clave válida, y haz clic en **Refresh voices from provider**. El servidor oficial de PocketTTS usa la lista integrada de Marinara. Para un wrapper compatible con PocketTTS, comprueba que `<Base URL>/v1/voices` responda.
- **ElevenLabs no habla**: elige una voz real, no el texto provisional "Select an ElevenLabs voice". Comprueba que el modelo sea de voz, no uno de diseño de voces cuyo ID contenga `ttv`.
- **Una línea se detiene con "No audio after 60 s"**: el servidor de voz necesita más tiempo. Sube **Request timeout (seconds)** donde indica el mensaje. Consulta [Tiempo de espera de la solicitud](#request-timeout).
- **Un servidor autoalojado en una dirección local está bloqueado**: activa `TTS_LOCAL_URLS_ENABLED` en `.env`. Permite que Marinara llegue a una dirección local o privada para servidores compatibles con OpenAI o de estilo ElevenLabs. PocketTTS no lo necesita. Consulta [Referencia de configuración del servidor](../CONFIGURATION.md).
- **Prueba rápida**: haz clic en **Preview** en **Voice settings** para oír una breve muestra con tus ajustes actuales.

## Referencia: música, efectos de sonido y Gacha Forge

Estas secciones son para configuraciones avanzadas.

<a id="game-music-and-sound-effects-on-a-compatible-audio-server"></a>

### Música y efectos de sonido de Game con un servidor de audio compatible

1. En **Connections**, abre tu cuenta de **Music & Sound Effects** (Música y efectos de sonido) con **Edit model** (Editar modelo) y elige **Custom compatible server** (Servidor compatible personalizado). La ventana **Add account** no tiene ninguna ficha para este tipo de cuenta; proviene de una actualización o de una importación (consulta [la referencia de cuentas](../connections/providers-reference.md#music--sound-effects)).
2. Introduce la dirección, la clave y el modelo de tu servidor de música o de efectos de sonido.
3. Configura **Generation API format** (Formato de la API de generación) e introduce las rutas de los endpoints que ofrece tu servidor. Una ruta vacía deja esa función sin disponibilidad.
4. Activa **Music generation** (Generación de música), **Sound-effect generation** (Generación de efectos de sonido) o ambas.
5. Selecciona esta cuenta en la configuración de Game o en los ajustes de audio del juego. Conserva por separado tu cuenta de voz seleccionada en los ajustes de voz de la tarea **Voice**.

Las rutas de los endpoints se añaden a la Base URL de la cuenta. Para `http://localhost:8002/v1`, usa `chat/completions` para llegar a `/v1/chat/completions`. Los endpoints HTTP locales requieren `TTS_LOCAL_URLS_ENABLED=true` en `.env`, como las demás solicitudes locales de audio compatible.

Se admiten dos formatos de API:

- **Prompt JSON → MP3 audio** envía `{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }` y espera bytes MP3. La música de Game usa la duración de la pista de contexto (120 segundos de forma predeterminada). Los efectos de sonido piden 5 segundos.
- **Chat Completions → inline audio (ACE-Step compatible)** envía `model`, una entrada de usuario en `messages`, `stream: false` y `audio_config` con `duration`, `instrumental: true` y `format: "mp3"`. Acepta MP3 integrado de `choices[0].message.audio`, ya sea un arreglo de URL de audio de ACE-Step que contiene una URL de datos base64 o un objeto con `data` en base64. Consulta el [contrato de API compatible con ACE-Step](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md). No se admiten URL remotas de resultados ni API de tareas asíncronas.

Activa solo lo que implemente tu servidor. Un endpoint de voz compatible con OpenAI no significa por sí solo que admita música o efectos de sonido. Un servicio como Infermatic debe ofrecer uno de estos formatos o proporcionar un adaptador. Su endpoint de música real no se ha verificado aquí. Para la generación nativa de ElevenLabs o SunoAPI, usa esa fuente en **Music & Sound Effects**. Consulta [la referencia de cuentas](../connections/providers-reference.md#music--sound-effects).

La música de contexto generada se compone una vez por zona o nivel de encuentro y se reutiliza. Los efectos de sonido repetidos usan la caché de audio. Un error de generación deja la caché disponible para reintentar.

<a id="gacha-forge-dialogue-and-audio"></a>

### Diálogo y audio de Gacha Forge

Gacha Forge 1.11.0 o posterior usa la cuenta seleccionada para la tarea **Voice** y sus asignaciones de voz por personaje.

- Activa **Read character dialogue** (Leer diálogos de personajes) para leer los diálogos de los personajes importados que tienen una voz asignada. Está en el paso de configuración **Lore** (Trasfondo) de un mundo nuevo, o en los ajustes de mundo propios de Gacha Forge para un mundo existente. La narración, los pensamientos, las unidades generadas sin un ID de personaje del Engine y los personajes sin voz permanecen en silencio. Un nombre por sí solo nunca toma prestada la voz de otro personaje.

- Una cuenta Audio seleccionada puede usarse cuando la tarea **Voice** no está en **Off**.
- La música y los efectos de sonido incluidos de Game no necesitan una cuenta de generación. Para componer pistas nuevas, activa **Generate music and sound effects** (Generar música y efectos de sonido) en Gacha Forge y elige una cuenta de Music & Sound Effects en **Audio connection** (Conexión de audio). Aparece cuando la generación está activada. Las pistas de inicio, de combate, de jefe, de escena de historia y de historia de personaje se generan cuando se necesitan por primera vez y luego se reutilizan. Estas solicitudes usan tu cuenta del servicio.
- El botón de silencio de la esquina superior derecha silencia a la vez la música, el diálogo y los efectos de sonido. Los ajustes visuales de Gacha Forge tienen controles de volumen separados para los tres, incluido el cero, además de la pausa de reproducción automática (**3 segundos** de forma predeterminada, después de la aparición del texto y de cualquier diálogo hablado). Las elecciones siguen esperando al jugador. El diálogo hablado se cancela al salir de una escena. Al salir del mundo, su audio se detiene.

Actualiza tanto el paquete Gacha Forge instalado como el Engine para obtener estos controles.

## Guías relacionadas

- [Llamadas de audio y video de Conversation](../conversation/calls.md)
- [Sincronización labial con texto a voz](../agents/avatars.md#lip-sync-with-text-to-speech) para avatares 2D y 3D
- [Modo Roleplay: primeros pasos](../roleplay/getting-started.md)
- [Game Mode: primeros pasos](../game/getting-started.md)
- [Proveedores de IA compatibles](../connections/providers-reference.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
