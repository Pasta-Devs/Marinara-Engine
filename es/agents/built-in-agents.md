# Referencia de agentes descargables

Esta guía enumera los 36 paquetes oficiales propios disponibles a través de **Agents → Download Agents** (Agentes → Descargar agentes), agrupados por categoría. Los agentes no vienen incluidos en una instalación nueva de Marinara Engine. Sus fuentes de paquete, manifiestos, artefactos y catálogo legible por máquina se publican en [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Para cada uno, esta guía explica qué hace el agente, cuándo se ejecuta o se integra, qué modos de chat lo permiten y los ajustes principales. Para la instalación y la activación, lee primero la [descripción general de los agentes](agents-overview.md).

## Cómo leer esta referencia

Un agente es un pequeño ayudante de IA que se ejecuta automáticamente junto a la respuesta de tu chat principal. Primero instálalo desde el catálogo, luego actívalo y configúralo por chat, no por tarjeta de personaje. Consulta la [descripción general de los agentes](agents-overview.md) para descargar, actualizar, desinstalar, configurar por chat y ver el aviso de costo.

Cada agente de abajo muestra tres datos rápidos.

- **Fase o integración**: cuándo se ejecuta un agente normal de la cadena de procesamiento. **Pre-Generation** (pre-generación) se ejecuta antes de la respuesta y puede añadir texto al prompt (las instrucciones enviadas a la IA). **Parallel** (paralelo) se ejecuta al mismo tiempo que la respuesta y no ve el texto terminado. **Post-Processing** (post-procesamiento) se ejecuta después de que la respuesta está completa y puede leerla (algunos también pueden reescribirla). Los paquetes de funciones como Maps, Calls y los juegos de Conversation se integran directamente en su propia superficie de chat.
- **Dónde funciona**: los modos de chat que te permiten añadir el agente. La mayoría de los agentes funcionan en chats de **Roleplay**. Unos pocos funcionan en otros modos, y cada entrada indica cuál.
- **Ajustes clave**: los ajustes que es más probable que cambies. Los configuras al añadir el agente, o más tarde en la tarjeta de configuración del agente dentro de **Chat Settings** (Ajustes del chat).

Marinara agrupa sus agentes en tres categorías en el panel **Agents**: **Writer Agents** (agentes escritores), **Tracker Agents** (agentes de seguimiento) y **Misc Agents** (agentes varios). Esta referencia usa la misma agrupación.

Un intervalo de ejecución significa que el agente se ejecuta una vez cada varios mensajes del usuario y del asistente en lugar de después de cada mensaje. Puedes cambiar un intervalo de ejecución en la configuración del agente, hasta 100.

## Writer agents

Los Writer agents dan forma a la historia o a la prosa. O bien añaden orientación antes de la respuesta, o bien limpian la respuesta después.

### Prose Guardian

Reescribe la última respuesta para eliminar palabras prohibidas y repeticiones, sin cambiar el significado. Úsalo para evitar que un modelo repita frases o abuse de una palabra.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: cuadros de texto **Banned Words** (palabras prohibidas; el valor predeterminado es `ozone`), **Prefer In Writing** (preferir en la escritura) y **Remove From Writing** (quitar de la escritura). Un interruptor **Hold Message Until Rewrite** (retener el mensaje hasta reescribir; activado de forma predeterminada) oculta la respuesta hasta que termina la limpieza. Sin él, la respuesta en bruto aparece primero y se sustituye después.

### Continuity Checker

Corrige errores concretos de lógica en la última respuesta, como que un personaje esté en dos lugares a la vez o una línea de tiempo rota. Cuando encuentra problemas, los muestra como una lista de verificación para que elijas qué correcciones aplicar.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: interruptor **Hold Message Until Rewrite**.

### Card Evolution Auditor

Observa cómo cambia un personaje durante el juego y sugiere ediciones a la tarjeta de ese personaje. Nunca edita automáticamente. Cada sugerencia abre la ventana **Review Character Card Updates** (revisar actualizaciones de la tarjeta de personaje) para que la apruebes o la rechaces.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: se ejecuta una vez cada 8 mensajes del usuario y del asistente de forma predeterminada. Consulta [Aprobaciones de agentes y el Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Crea un único empujón para la historia solo cuando lo pides. Cuando este agente está activo en un chat de Roleplay, aparece un botón **Push Story** (empujar la historia) encima del cuadro de mensaje. Haz clic en él para preparar la siguiente respuesta, que entonces hará avanzar la trama o introducirá una sorpresa.

- **Fase**: Pre-Generation.
- **Dónde funciona**: solo Roleplay.
- **Ajustes clave**: **Story Push Mode** (modo de empuje de la historia; **Natural** para avanzar los hilos actuales, o **Random Event** para añadir una sorpresa plausible). También puede mantener un arco a largo plazo oculto y opcional llamado **Secret Plot** (trama secreta). Para el recorrido completo, consulta [Narrative Director y Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Analiza los lorebooks (libros de trasfondo) que elijas (y cualquier archivo que subas) antes de la respuesta. Resume las partes que importan y añade ese resumen al prompt. Un lorebook es una colección de datos de trasfondo sobre tu mundo y tus personajes. Esta es una búsqueda ligera, así que no necesita una base de datos aparte.

- **Fase**: Pre-Generation.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: interruptor **Use chat-active lorebooks** (usar los lorebooks activos del chat), un selector **Fixed Source Lorebooks** (lorebooks de fuente fija) y una carga de archivos para los formatos admitidos. No ejecutes este agente junto con Knowledge Router, ya que se solapan. Para la configuración, consulta [Fuentes de conocimiento](knowledge-sources.md).

### Knowledge Router

Una alternativa más económica a Knowledge Retrieval. En lugar de resumir, lee descripciones cortas de las entradas de tu lorebook. Luego añade las entradas coincidentes palabra por palabra. Funciona mejor cuando tus entradas tienen buenas descripciones.

- **Fase**: Pre-Generation.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: interruptor **Use chat-active lorebooks** y un selector **Fixed Source Lorebooks**. Una insignia de cobertura muestra qué porcentaje de las entradas de origen tiene una descripción escrita. Para la configuración, consulta [Fuentes de conocimiento](knowledge-sources.md).

## Tracker agents

Los Tracker agents mantienen un registro continuo de la escena, los personajes y tus estadísticas. Puedes añadir su salida más reciente al prompt como una sección, para que el modelo se mantenga coherente. World State, Quest Tracker, Character Tracker, Persona Stats, Custom Tracker, Inventory Tracker y Beholder tienen **Add as Prompt Section** (añadir como sección del prompt) activado de forma predeterminada. Expression Engine y Background son las excepciones.

### World State

Registra la fecha, la hora, el clima, la ubicación y qué personajes están presentes. Esto mantiene la escena anclada para que el modelo no olvide dónde y cuándo ocurre la historia.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Add as Prompt Section** (activado de forma predeterminada).

### Expression Engine

Lee la emoción en la última respuesta y elige un sprite (imagen del personaje) o expresión que coincida para el personaje. Un sprite es una imagen del personaje que se muestra en la escena. Úsalo para arte de personaje de pie que cambia con el estado de ánimo.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Sprite Source** (fuente del sprite; **Expressions**, **Full-body** o ambos), un interruptor **Expression Avatars** (avatares de expresión), un selector **Sprite Owners** (dueños del sprite) y controles deslizantes de tamaño y opacidad. Consulta [Sprites de personaje](../characters/sprites.md).

### Quest Tracker

Gestiona los objetivos de misión, su finalización y las recompensas. Úsalo para el juego estilo aventura donde quieres una lista de tareas visible.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Add as Prompt Section** (activado de forma predeterminada).

### Background

Elige la imagen de fondo que mejor coincide con la escena actual entre los fondos que has subido. No genera imágenes; usa Illustrator cuando quieras generación automática de fondo de escena.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: los controles estándar de conexión de agente y de contexto. La selección de fondo usa solo imágenes que ya están disponibles en tu biblioteca de fondos.

### Character Tracker

Registra los personajes presentes, además de su estado de ánimo, acciones, apariencia, atuendo, pensamientos y estadísticas por personaje como los HP. También puede crear imágenes de retrato para personajes nuevos que no tienen ninguna.

Cuando un personaje recurrente regresa después de dejar la escena, Character Tracker reutiliza sus estadísticas guardadas más recientes y sus campos personalizados para mantener la continuidad. Los personajes respaldados por tarjetas también reciben como base sus grupos de reservas y atributos de RPG configurados, y siempre conservan el avatar y el recorte de la tarjeta. Los retratos generados automáticamente siguen limitados a los NPC (personajes no jugadores) que no tienen una tarjeta de personaje coincidente.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Add as Prompt Section** (activado de forma predeterminada) y un ajuste opcional **Auto-Generate NPC Avatars** (generar automáticamente avatares de NPC) con su propio selector de conexión de imágenes.

### Beholder

Registra la ropa actual de cada personaje por zona del cuerpo, los objetos que lleva en las manos, las heridas, las partes del cuerpo que faltan, las zonas que se indican expresamente como desnudas y las especies no humanas. Su última instantánea validada aparece en el panel de Chat Settings de Beholder para Roleplay y se envía tanto a la siguiente ejecución de seguimiento de Beholder como a la siguiente respuesta principal de Roleplay.

- **Fase**: Post-Processing.
- **Dónde funciona**: solo Roleplay.
- **Ajustes clave**: añádelo o quítalo en **Chat Settings → Agents → Tracker Agents**; abre **Configure Beholder** allí para elegir su conexión, modelo, prompt, contexto y límites de salida. **Add as Prompt Section** está activado de forma predeterminada.
- **Modelo recomendado**: usa un modelo SOTA como OpenAI GPT-5.5+, Claude Opus 4.8+ o Kimi K3+ para registrar el estado completo de forma fiable.
- **Origen**: adaptado al entorno nativo de agentes de Engine a partir de [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME), con licencia AGPL-3.0-only. El paquete oficial no carga el DOM, el sondeo ni el entorno de almacenamiento local de la extensión heredada.

### Persona Stats

Registra barras de estado para tu propio personaje, como Satiety, Energy e Hygiene, además de cualquier barra personalizada que añadas. Úsalo para el juego estilo supervivencia o simulación de vida.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Add as Prompt Section** (activado de forma predeterminada). Consulta [Colores y estadísticas de personaje](../characters/colors-and-stats.md).

### Custom Tracker

Registra campos que defines tú mismo, como monedas, contadores o marcadores. Úsalo cuando los trackers integrados no cubren algo que tu historia necesita.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Add as Prompt Section** (activado de forma predeterminada).

### Inventory Tracker

Sigue el dinero, el equipo puesto y los objetos que llevas en tres listas estructuradas, sin reutilizar el inventario de Persona Stats ni comprimir los datos en cadenas de Custom Tracker. Los nombres duplicados se combinan, las cantidades de uno se muestran de forma compacta y las filas bloqueadas sobreviven sin cambios a las siguientes ejecuciones del tracker.

- **Fase**: Post-Processing (posprocesamiento).
- **Dónde funciona**: Roleplay.
- **Ajustes principales**: **Add as Prompt Section** (activado de forma predeterminada). El HUD y el Tracker Panel permiten editar y bloquear cada nombre y cantidad.

### World Maps

Añade a una historia ubicaciones anidadas persistentes y relaciones espaciales. Puedes crear regiones, áreas, salas y conexiones, moverte entre ubicaciones y dejar que la posición actual aporte contexto espacial a la generación. Game Mode también obtiene la vista de mapamundi del paquete.

- **Integración**: paquete de funciones; aporta la interfaz de mapas y el contexto de tiempo de ejecución del chat en lugar de ejecutarse como un agente normal de fase de generación.
- **Dónde funciona**: Roleplay y Game.
- **Ajustes clave**: actívalo para el chat de Roleplay desde **Chat Settings → Agents**, o selecciónalo durante la creación de Game y gestiónalo más tarde desde la configuración de ese juego. Instalarlo o quitarlo requiere reiniciar Marinara.
- **Guía completa**: [World Maps: configuración, creación y viajes](hierarchical-maps.md).

## Misc agents

Los Misc agents añaden extras como imágenes, música, reacciones del público y actualizaciones de tarjetas.

### Echo Chamber

Simula un público en vivo que reacciona a tu escena, mostrado como un widget flotante **Echo** en el área del chat. Revela una reacción nueva cada 30 segundos.

- **Fase**: Parallel.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: eliges un estilo entre sus opciones con nombre, como **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad** y **Harbingers**. Los controles del widget incluyen **Re-run Echo Chamber** (volver a ejecutar Echo Chamber) y **Clear messages** (borrar mensajes).

### Noodle

Añade un mundo social local opcional con la cronología pública de Noodle y el feed de rol entre creadores y fans de NoodleR. Se abre en una pestaña dedicada de Home en lugar de ejecutarse en el flujo normal de agentes del chat.

- **Integración**: paquete de funciones; aporta la pestaña de Home, rutas locales, flujos de generación y multimedia y planificadores en segundo plano.
- **Dónde funciona**: Home, con contexto opcional traído de chats de Conversation, Roleplay y Game.
- **Ajustes principales**: instálalo desde **Agents → Download Agents** y reinicia Marinara Engine cuando se te pida. Dentro de Noodle puedes configurar cuentas invitadas, conexiones de texto e imagen, actualizaciones de la cronología, perfiles de Creator en NoodleR, acceso a publicaciones simuladas y actividad de la audiencia.
- **Ciclo de vida de los datos**: al desinstalarlo se quita la pestaña de Home y se detienen las rutas y los planificadores del paquete después de reiniciar, pero se conservan los datos existentes de Noodle y NoodleR por si vuelves a instalarlo.
- **Guía completa**: [Noodle: la cronología social integrada](../noodle/overview.md).

### Long-Term Memory

Extrae recuerdos duraderos de los resúmenes del chat, los registros de personajes y los lorebooks a un almacén propio del paquete y recupera el contexto pertinente antes de la respuesta principal. Permite explorar el almacén por ámbito, importar fuentes, revisar borradores pendientes y colocar el contexto recuperado mediante un marcador del preset.

- **Integración**: paquete de funciones; aporta contexto previo a la generación y una interfaz para gestionar la memoria, en vez de ejecutarse como un tracker normal después de la generación.
- **Dónde funciona**: Conversation, Roleplay y Game.
- **Ajustes clave**: activación, presupuesto de tokens de recuperación (128–16.384), cantidad máxima de fragmentos recuperados (1–100), umbral de puntuación, contexto de mensajes recientes (1–20), estilo de recuperación y pesos semántico, léxico, de grafo y de palabras clave, inclusión de recuerdos resueltos, preámbulo de recuperación, razonamiento y nivel de detalle de la extracción, límites de generación, límites de fuentes, plantillas de prompt, extracción de palabras clave mediante IA y extracción en Game Mode.
- **Ciclo de vida de los datos**: usa los controles de copia de seguridad de Memory Settings para exportar o sustituir el almacén, los borradores y los ajustes. Delete all data elimina de forma permanente los recuerdos, los borradores, la actividad y los índices derivados, pero conserva los ajustes. Al desinstalar el paquete se conserva el almacén de Long-Term Memory para una instalación posterior. Instalarlo, actualizarlo o eliminarlo requiere reiniciar Marinara.
- **Compatibilidad**: Engine `2.3.5` hasta antes de `4.0.0`. El paquete usa los permisos `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage` y `ui`.

### Illustrator

Responsable de las generaciones de imágenes y video. Escribe prompts visuales para los momentos importantes y luego los envía al proveedor de medios configurado.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: se ejecuta una vez cada 5 mensajes del usuario y del asistente de forma predeterminada. Los ajustes incluyen **Prompt Model** (modelo de prompt), **Image Style** (estilo de imagen), **Attach Card Appearance** (adjuntar la apariencia de la tarjeta) y **Send Avatar References** (enviar referencias de avatar). Para la configuración completa, consulta [Agente Illustrator](../media/illustrator-agent.md).

### Lorebook Keeper

Crea y actualiza entradas de lorebook a partir de datos importantes de tu chat, para que tus notas del mundo crezcan a medida que juegas.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay. En Game Mode, una variante de fin de sesión llamada **Game Session Keeper** hace el mismo trabajo al final de una sesión.
- **Ajustes clave**: se ejecuta una vez cada 8 mensajes del usuario y del asistente de forma predeterminada. Un selector **Target Lorebook** (lorebook de destino) elige a dónde van las entradas, con una opción de selección automática.

### Combat

Gestiona el combate, incluidos la iniciativa, los HP y el orden de turnos. Cuando está activo, aparece un botón **Encounter** (encuentro) encima del cuadro de mensaje.

- **Fase**: Parallel.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: viene con una herramienta de tirada de dados para resolver los turnos.

### Immersive HTML

Añade elementos visuales dentro del mundo a la última respuesta, como una nota o pantalla con estilo, sin cambiar la historia.

- **Fase**: Post-Processing.
- **Dónde funciona**: solo Roleplay.
- **Ajustes clave**: interruptor **Hold Message Until Rewrite**.

### Music DJ

Lee el estado de ánimo de la escena y reproduce música que coincida. Puede usar Spotify, YouTube o archivos de audio locales.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay y Game.
- **Ajustes clave**: un ajuste **Music Player** (reproductor de música) elige el proveedor, y cada proveedor necesita su propia configuración. Para los pasos completos de Spotify, YouTube y música local, consulta [Music DJ](../media/music.md).

### Haptic Feedback

Lee la narración y controla en tiempo real los juguetes íntimos conectados a través de Intiface Central. Intiface Central ya debe estar en ejecución con un juguete conectado antes de que actives este agente.

- **Fase**: Post-Processing.
- **Dónde funciona**: Conversation, Roleplay y Game.
- **Ajustes clave**: una opción **Touch Sensitivity** (sensibilidad al tacto; **Subtle**, **Standard** o **Intense**) y un campo **Intiface URL**. La sensibilidad orienta las elecciones del agente sin limitar el rango de intensidad disponible de `0.0-1.0`. Para la configuración completa, consulta [Configuración de Haptic Feedback](../integrations/haptic-feedback.md).

### CYOA Choices

Añade botones de elección "What will you do?" (¿qué harás?) en los que puedes hacer clic después de cada respuesta, para dar una sensación de aventura del tipo "elige tu propia aventura" (CYOA). Cada botón contiene una acción completa que puedes enviar con un clic.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Edit** (editar) para reescribir las elecciones y **Re-roll** (volver a generar) para generar unas nuevas.

### Storyboard

Planifica storyboards (secuencias de viñetas) visuales fijos o animados a partir de intercambios de Roleplay ya terminados y de la narración de Game. La planificación y el formato adaptado a cada proveedor van por separado, y así se conservan la cronología de la fuente, la identidad de los personajes y el estilo visual elegido en los fotogramas clave y los videos generados.

- **Integración**: paquete de agente; Game y Roleplay usan las plantillas de prompt y los ajustes del paquete instalado a través de la integración de Storyboard que aporta el Engine como aplicación anfitriona.
- **Dónde funciona**: Roleplay y Game.
- **Ajustes clave**: elegir planificadores de imagen fija o de animación, conexiones de imagen y de video, cantidad de fotogramas clave, duración, modo de visualización, manejo de las referencias de personaje, plantillas de episodio y de estilo de Roleplay, y plantillas de ilustración y de video de Game.
- **Compatibilidad**: Engine `2.3.5` hasta antes de `3.0.0`. El paquete usa los permisos `agent-runtime`, `chat-read`, `prompt-context`, `storage` y `ui`, y no requiere reiniciar.
- **Guía completa**: [El agente Storyboard: Roleplay y Game Mode](../game/storyboard.md).

### Calls

Añade llamadas de audio y video en vivo con los personajes de Conversation, incluidas las llamadas iniciadas por el usuario y las entrantes, transcripciones solo de llamada, texto a voz, entrada de micrófono y clips de video del personaje.

- **Integración**: paquete de funciones de Conversation; añade controles de barra de herramientas, de la superficie del chat y de Chat Settings en lugar de ejecutarse como un agente normal de fase de generación.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: abre **Chat Settings → Agents → Calls** para activar las llamadas y elegir el comportamiento del habla, el micrófono, el timbre y el video. Consulta [Llamadas de audio y video de Conversation](../conversation/calls.md). Instalarlo o quitarlo requiere reiniciar Marinara.

### UNO

Añade una mesa de UNO con reglas aplicadas para ti y los personajes de Conversation, con reglas de la casa configurables y soporte para un total de dos a diez jugadores.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: iníciala desde el selector de juegos o con `/uno`; la configuración elige los jugadores y las reglas de la casa. Instalarlo o quitarlo requiere reiniciar Marinara.

### Chess

Añade un tablero de Chess uno contra uno con aplicación de movimientos legales, detección de jaque y jaque mate, piezas capturadas y turnos del oponente dentro de personaje.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: inícialo desde el selector de juegos o con `/chess`, luego elige el oponente y con qué bando juegas. Instalarlo o quitarlo requiere reiniciar Marinara.

### Poker

Añade una mesa de Texas Hold'em para un total de dos a ocho jugadores, con ciegas, rondas de apuestas, botes secundarios, evaluación del showdown y oponentes dentro de personaje.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: iníciala desde el selector de juegos o con `/poker`, luego elige los jugadores, las fichas iniciales y los valores de las ciegas. Instalarlo o quitarlo requiere reiniciar Marinara.

### 8-Ball Pool

Añade una mesa de billar uno contra uno con bolas lisas y rayadas, apuntado y fuerza del tiro, faltas, bola en mano y tiros del oponente dentro de personaje.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: iníciala desde el selector de juegos o con `/8ball`, luego elige el oponente. Instalarlo o quitarlo requiere reiniciar Marinara.

### Tic-Tac-Toe

Añade un tablero de Tic-Tac-Toe uno contra uno con marcas seleccionables o aleatorias, manejo de turnos legales y detección de victoria y empate.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: inícialo desde el selector de juegos o con `/tictactoe` (alias `/ttt`), luego elige el oponente y la marca. Instalarlo o quitarlo requiere reiniciar Marinara.

### Rock-Paper-Scissors

Añade una partida de Rock-Paper-Scissors uno contra uno donde ambas elecciones permanecen ocultas hasta que se revelan.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: iníciala desde el selector de juegos o con `/rps`, luego elige el oponente y una partida al mejor de tres, cinco o siete. Instalarlo o quitarlo requiere reiniciar Marinara.

## Guías relacionadas

- [Descripción general de los agentes](agents-overview.md)
- [Agente Illustrator](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Configuración de Haptic Feedback](../integrations/haptic-feedback.md)
- [Fuentes de conocimiento](knowledge-sources.md)
- [Narrative Director y Secret Plot](../roleplay/narrative-director.md)
- [Llamadas de audio y video de Conversation](../conversation/calls.md)
- [Juegos de mesa de Conversation](../conversation/table-games.md)
