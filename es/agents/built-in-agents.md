# Referencia de agentes descargables

Esta guía enumera por grupos los agentes oficiales propios que hay en **Agents → Agent Organizer** (Agentes → Organizador de agentes). Los agentes no vienen incluidos en una instalación nueva. Sus fuentes y su catálogo son públicos en [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Cada entrada indica qué hace el agente, cuándo se ejecuta, dónde funciona y sus ajustes principales. Para instalar y activar agentes, lee primero la [descripción general de los agentes](agents-overview.md). Las entradas marcadas como **staging only** (solo staging) están disponibles para quienes usan Engine en staging; llegan al canal estable cuando se publica allí el paquete.

## Cómo leer esta referencia

Instala un agente desde **Agent Organizer** y luego añádelo a cada chat en el que lo quieras. Los agentes se configuran por chat, no por tarjeta de personaje. La [descripción general de los agentes](agents-overview.md) explica la instalación, las actualizaciones, la configuración por chat y el costo.

Cada entrada muestra los mismos datos rápidos.

- **Fase** o **Integración**: cuándo se ejecuta un agente de la cadena de procesamiento. **Pre-Generation** (pre-generación) se ejecuta antes de la respuesta y puede añadir texto al prompt (las instrucciones enviadas a la IA). **Parallel** (paralelo) se ejecuta al mismo tiempo que la respuesta y no ve el texto terminado. **Post-Processing** (post-procesamiento) se ejecuta después de la respuesta y puede leerla. Algunos pueden reescribirla. En cambio, los paquetes de funciones como World Maps, Calls y los juegos de Conversation se integran en su pantalla de chat. Las Apps se abren en su propia pestaña **Home** (Inicio).
- **Dónde funciona**: los modos de chat que admiten el agente. La mayoría de los agentes funcionan en Roleplay.
- **Ajustes clave**: los ajustes que es más probable que cambies, en la tarjeta del agente dentro de **Chat Settings** (Ajustes del chat).

Un intervalo de ejecución hace que un agente se ejecute una vez cada varios mensajes del usuario y del asistente en lugar de después de cada mensaje. Puedes establecerlo hasta 100.

En Roleplay, el intervalo de ejecución de Illustrator se define por chat, en su tarjeta dentro de **Chat Settings**. El valor de su configuración es el predeterminado para los chats que no tienen uno propio. Illustrator también acepta **0**: nunca se ejecuta automáticamente y sigue disponible para las acciones de Gallery.

## Apps

Las Apps tienen su propia pestaña en **Home**. Las usas por separado en lugar de añadirlas a un chat. Cada una pide reiniciar después de instalarla.

### Noodle

Añade la línea de tiempo pública, local y opcional de Noodle en su propia pestaña de **Home**. No se ejecuta en la cadena de agentes del chat.

- **Integración**: paquete de funciones con rutas locales, flujos de generación y multimedia y planificadores en segundo plano.
- **Dónde funciona**: Home, con contexto opcional traído de chats de Conversation, Roleplay y Game.
- **Ajustes clave**: instálalo desde **Agents → Agent Organizer** y reinicia cuando se te pida. Dentro de Noodle configuras las cuentas invitadas, las conexiones de texto e imagen, las actualizaciones de la línea de tiempo, los usuarios aleatorios y la transferencia de contexto del chat.
- **Datos**: al desinstalarlo, se quita la pestaña y se detienen los planificadores después de reiniciar. Tus datos de Noodle se conservan para una reinstalación posterior.
- **Guía completa**: [Noodle: la línea de tiempo social dentro de la app](noodle.md).

### Slurp

Una app social privada para tus personajes. Convierte personajes y personas en Creators, publica fotos públicas o bloqueadas y observa cómo un público simulado sigue, se suscribe, compra, comenta y envía mensajes. De forma predeterminada está pensada para contenido adulto. Todo es ficticio: los precios son inventados y no se hace ningún pago real.

- **Integración**: app en su propia pestaña **Slurp** dentro de **Home**.
- **Dónde funciona**: Home.
- **Ajustes clave**: instálala, reinicia cuando se te pida y luego abre **Home → Slurp**. Para que los personajes de un chat recuerden las publicaciones y los mensajes recientes de Slurp, activa **Include Slurp activity** (Incluir la actividad de Slurp) en **Chat Settings** de ese chat, dentro de **Connected Chats** (chats conectados). La transferencia de contexto también debe estar activada para ese modo de chat en los ajustes de Slurp. **Slurp Settings → Autopurge** elimina los archivos multimedia antiguos de Slurp para ahorrar espacio. Está desactivado de forma predeterminada.
- **Nombres anteriores**: los catálogos antiguos la muestran como **Slurp Remastered**, junto a la ya retirada **Slurp Legacy**, que no recibe más actualizaciones.
- **Guía completa**: [guía del paquete Slurp](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/slurp2/README.md).

### Gacha Forge

Un juego gacha construido a partir de un mundo que describes: banners en los que tirar, un elenco que el modelo escribe e ilustra, capítulos de historia contados por un narrador de novela visual, y batallas, equipo y eventos. Tus lorebooks (libros de trasfondo) pueden alimentar el mundo, pero basta con un escenario escrito a mano.

- **Integración**: app en su propia pestaña **Gacha Forge** dentro de **Home**.
- **Dónde funciona**: Home.
- **Ajustes clave**: instálala, reinicia cuando se te pida y luego abre **Home → Gacha Forge**. Al desinstalarla, la pestaña desaparece después de reiniciar.
- **Guía completa**: [guía del paquete Gacha Forge](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/gacha-forge/README.md).

### Modern Life Sim

Una simulación de vida. Vives en un pueblo pequeño con el reloj en marcha: tienes que conservar un trabajo, pagar las facturas y cuidar tu energía y tu hambre. Los habitantes que te rodean salen de tus tarjetas de personaje, y un narrador de novela visual cuenta las escenas importantes.

- **Integración**: app en su propia pestaña **Life Sim** dentro de **Home**.
- **Dónde funciona**: Home.
- **Disponibilidad**: **Staging only**, con Engine **2.4.4+** (< 4.0.0). Es una versión alfa. Si una actualización cambia algo de lo que depende una partida guardada antigua, Life Sim te avisa al abrir esa partida. Puedes empezar una vida nueva o continuar bajo tu propio riesgo.
- **Ajustes clave**: instálala, reinicia cuando se te pida y luego abre **Home → Life Sim**. Necesita una conexión de texto. Una conexión de imagen es opcional: sin ella, los lugares muestran tarjetas ilustradas. Los módulos opcionales permanecen desactivados hasta que los actives para una vida. El módulo **Adult** (Adultos) te pide confirmar que eres mayor de edad.
- **Guía completa**: [guía del paquete Modern Life Sim](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/modern-life-sim/README.md).

### Story Writer

Un libro que escribes junto con el modelo. Configura la historia, el reparto y los lorebooks en una barra lateral, deja las instrucciones de autor en una nota adhesiva y el modelo escribe el siguiente capítulo cuando se lo pides. Puedes hacer clic en cualquier parte del texto para cambiarlo, o escribir tú el primer capítulo.

- **Integración**: app en su propia pestaña **Story Writer** dentro de **Home**.
- **Dónde funciona**: Home.
- **Disponibilidad**: necesita una versión de Marinara Engine posterior a **v2.5.1** (la próxima versión o una compilación actual de staging).
- **Ajustes clave**: instálala, reinicia cuando se te pida, abre **Home → Story Writer** y elige una conexión de texto en su barra lateral. Las historias se guardan en tu servidor de Marinara. Puedes empezar otras nuevas, volver a las anteriores y descargarlas como Markdown o texto sin formato.
- **Guía completa**: [guía del paquete Story Writer](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/story-writer/README.md).

## Writer agents

Los Writer agents dan forma a la historia o a la prosa. Añaden orientación antes de la respuesta o limpian la respuesta después.

### Prose Guardian

Reescribe la última respuesta para eliminar palabras prohibidas y repeticiones sin cambiar el significado. Úsalo para evitar que un modelo repita frases o abuse de una palabra.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: cuadros de texto **Banned Words** (palabras prohibidas; valor predeterminado `ozone`), **Prefer In Writing** (preferir en la escritura) y **Remove From Writing** (quitar de la escritura). **Hold Message Until Rewrite** (retener el mensaje hasta reescribir; activado de forma predeterminada) oculta la respuesta hasta que termina la limpieza. Sin él, la respuesta en bruto aparece primero y se sustituye después.

### Continuity Checker

Corrige errores concretos de lógica en la última respuesta, como un personaje en dos lugares a la vez o una línea de tiempo rota. Cuando encuentra problemas, muestra una lista de verificación para que elijas qué correcciones aplicar.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: interruptor **Hold Message Until Rewrite**.

### Card Evolution Auditor

Observa cómo cambia un personaje durante el juego y sugiere ediciones a la tarjeta de ese personaje. Nunca edita automáticamente. Cada sugerencia abre la ventana **Review Character Card Updates** (revisar actualizaciones de la tarjeta de personaje) para que la apruebes o la rechaces.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: se ejecuta una vez cada 8 mensajes del usuario y del asistente de forma predeterminada. Consulta [Aprobaciones de agentes y el Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Crea un único empujón para la historia cuando lo pides. Cuando este agente está activo en un chat de Roleplay, aparece un botón **Push Story** (empujar la historia). Haz clic en él para preparar la siguiente respuesta, que entonces hace avanzar la trama o añade una sorpresa.

- **Fase**: Pre-Generation.
- **Dónde funciona**: solo Roleplay.
- **Ajustes clave**: **Story Push Mode** (modo de empuje de la historia; **Natural** hace avanzar los hilos actuales, **Random Event** añade una sorpresa plausible). También puede mantener un arco oculto a largo plazo llamado **Secret Plot** (trama secreta). Consulta [Narrative Director y Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Analiza los lorebooks que elijas, y cualquier archivo que subas, antes de la respuesta. Resume las partes que importan y añade ese resumen al prompt. Un lorebook es un conjunto de datos de trasfondo sobre tu mundo. Es una búsqueda ligera y no necesita una base de datos aparte.

- **Fase**: Pre-Generation.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Use chat-active lorebooks** (usar los lorebooks activos del chat), un selector **Fixed Source Lorebooks** (lorebooks de fuente fija) y la carga de archivos. No lo ejecutes junto con Knowledge Router, ya que se solapan. Consulta [Fuentes de conocimiento](knowledge-sources.md).

### Knowledge Router

Una alternativa más económica a Knowledge Retrieval. Lee descripciones cortas de las entradas de tu lorebook y añade palabra por palabra las entradas que coinciden. Funciona mejor cuando las entradas tienen buenas descripciones.

- **Fase**: Pre-Generation.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Use chat-active lorebooks** y un selector **Fixed Source Lorebooks**. Una insignia de cobertura muestra qué porcentaje de las entradas de origen tiene una descripción. Consulta [Fuentes de conocimiento](knowledge-sources.md).

## Tracker agents

Los Tracker agents mantienen un registro continuo de la escena, los personajes y tus estadísticas. **Add as Prompt Section** (añadir como sección del prompt) añade la salida más reciente de un agente al prompt para que el modelo se mantenga coherente. Está activado de forma predeterminada en todos los trackers excepto Expression Engine y Background.

### World State

Registra la fecha, la hora, el clima, la ubicación y qué personajes están presentes. Esto mantiene la escena anclada para que el modelo no olvide dónde y cuándo ocurre la historia.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Add as Prompt Section** (activado de forma predeterminada).

### Expression Engine

Lee la emoción en la última respuesta y elige un sprite (imagen del personaje) o expresión que coincida para el personaje. Un sprite es una imagen del personaje que se muestra en la escena. Úsalo para arte de personaje de pie que cambia con el estado de ánimo.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Sprite Source** (fuente de los sprites; **Expressions**, **Full-body** o ambos), un interruptor **Expression Avatars** (avatares de expresión), un selector **Sprite Owners** (dueños del sprite) y controles deslizantes de tamaño y opacidad. Consulta [Sprites de personaje](../characters/sprites.md).

### Quest Tracker

Gestiona los objetivos de misión, su finalización y las recompensas. Úsalo para el juego estilo aventura donde quieres una lista de tareas visible.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Add as Prompt Section** (activado de forma predeterminada).

### Background

Elige el mejor fondo para la escena actual entre los fondos que has subido. No genera imágenes. Usa Illustrator para generar fondos de escena.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: los controles estándar de conexión del agente y de contexto. Solo elige entre las imágenes que ya están en tu biblioteca de fondos.

### Character Tracker

Registra los personajes presentes, con su estado de ánimo, acciones, apariencia, atuendo, pensamientos y estadísticas por personaje como los HP. También puede crear retratos para personajes nuevos que no tienen ninguno.

Una tarjeta que describe a varias personas, como una tarjeta de escenario con un reparto, se puede seguir persona por persona. Marca a cada persona en el texto de la tarjeta con un encabezado `[CHARACTER: Name]` o un campo `Name:`. Cada miembro conserva su propio nombre, estado de ánimo, atuendo, pensamientos y retrato. No comparten el retrato de la tarjeta. Una entrada antigua con el nombre de la tarjeta permanece hasta que el rastreador informe de un miembro individual que la sustituya. Los personajes añadidos manualmente conservan su identidad manual.

Cuando un personaje vuelve después de salir de la escena, el rastreador reutiliza sus últimas estadísticas y campos personalizados guardados. Los personajes asociados a tarjetas también reciben sus reservas y atributos RPG configurados. En un grupo de Roleplay en modo Merged, los personajes presentes también pueden definir qué tarjetas de personaje están activas en la siguiente respuesta. Consulta [Automatizar personajes activos](../chats/group-chats.md#automate-active-characters-merged-only).

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Add as Prompt Section** (activado de forma predeterminada) y un ajuste opcional **Auto-Generate NPC Avatars** (generar automáticamente avatares de NPC) con su propio selector de conexión de imágenes. **Include the outfit in portraits** (Incluir el atuendo en los retratos) está activado de forma predeterminada. Desactívalo para dibujar los retratos solo a partir de la apariencia.

### Beholder

Registra la ropa de cada personaje por zona del cuerpo, los objetos que lleva en las manos, las heridas, las partes del cuerpo que faltan, las zonas que se indican expresamente como desnudas y las especies no humanas. Su última instantánea validada aparece en el panel de Beholder dentro de **Chat Settings** de Roleplay. Se envía a la siguiente llamada de seguimiento de Beholder y a la siguiente respuesta principal.

- **Fase**: Post-Processing.
- **Dónde funciona**: solo Roleplay.
- **Ajustes clave**: añádelo en **Chat Settings → Agents → Tracker Agents** (Ajustes del chat → Agentes → Agentes de seguimiento) y luego abre **Configure Beholder** para elegir su conexión, modelo, prompt, contexto y límites de salida. **Add as Prompt Section** está activado de forma predeterminada.
- **Plantilla de prompt**: elige la plantilla que corresponda al modelo de la conexión de Beholder. Marinara no puede detectar el modelo, así que la elección es manual. Una elección equivocada no es fatal, pero da peores resultados.
  - **SOTA model — one prompt** (modelo SOTA — un prompt, predeterminado): una llamada que cubre todos los campos registrados. Usa un modelo general potente.
  - **Beholder local model — five passes** (modelo local Beholder — cinco pasadas): cinco llamadas acotadas, una por categoría registrada, para el extractor [Beholder](https://huggingface.co/GetBeholder/Beholder-GGUF) entrenado específicamente para esta tarea y servido en tu computadora (por ejemplo, `Beholder-Q8_0.gguf` mediante koboldcpp o llama.cpp). Ese modelo responde una categoría a la vez, por lo que la plantilla de un solo prompt devuelve un estado parcial. Funciona sin conexión y sin costo.
- **Origen**: adaptado de [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME), con licencia AGPL-3.0-only. El paquete oficial no carga el DOM, el sondeo ni el entorno de almacenamiento local de la extensión antigua.

### Persona Stats

Registra barras de estado para tu propio personaje, como Satiety, Energy e Hygiene, además de cualquier barra personalizada que añadas. Úsalo para el juego estilo supervivencia o simulación de vida.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Add as Prompt Section** (activado de forma predeterminada). Consulta [Colores del personaje y Estadísticas de Roleplay](../characters/colors-and-stats.md).

### Custom Tracker

Registra campos que defines tú mismo, como monedas, contadores o marcadores. Úsalo cuando los trackers integrados no cubren algo que tu historia necesita.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Add as Prompt Section** (activado de forma predeterminada).

### Inventory Tracker

Sigue el dinero, el equipo puesto y los objetos que llevas en tres listas estructuradas. Los nombres duplicados se combinan y las filas bloqueadas no cambian en las siguientes ejecuciones del tracker.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: **Add as Prompt Section** (activado de forma predeterminada). El HUD y el Tracker Panel permiten editar y bloquear cada nombre y cantidad.

### Quartermaster

Gestiona el inventario de la persona activa, los espacios de equipo, las cantidades de objetos, las ubicaciones de almacenamiento y los atuendos guardados. Lee la historia después de las respuestas y aplica los cambios de objetos. Un panel flotante y el Tracker Panel te permiten editar el mismo inventario a mano. Las imágenes de objetos y atuendos son opcionales.

- **Fase**: Post-Processing, con contexto del inventario para las respuestas posteriores.
- **Dónde funciona**: Roleplay. Sigue a la persona activa, no a los miembros del grupo ni a los NPC (personajes no jugadores).
- **Disponibilidad**: requiere Engine **2.4.6+**.
- **Configuración**: instálalo y reinicia cuando se te pida. En cada chat de Roleplay, activa los agentes en **Chat Settings → Agents**, añade Quartermaster en **Tracker Agents** y elige su conexión al modelo. Abre el panel flotante desde el botón situado encima del Tracker Panel.
- **Controles principales**: equipar y almacenar objetos, guardar atuendos, restaurar el inventario o deshacer cambios recientes del tracker, y exportar o importar la configuración de un chat. La generación de imágenes usa su propia conexión de imágenes. Consulta la [guía del paquete Quartermaster](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/quartermaster/README.md) antes de activar la macro de apariencia o el reemplazo del avatar.

### Relationship Tracker

Mantiene una red editable de relaciones entre las tarjetas de personaje de un chat de grupo de Roleplay, además de la opinión que cada personaje tiene de la persona activa. Las relaciones son positivas, neutrales, negativas o complicadas. Los bloqueos manuales protegen tus ediciones frente a cambios automáticos.

- **Fase**: Post-Processing, con contexto de relaciones para las respuestas posteriores.
- **Dónde funciona**: chats de grupo de Roleplay.
- **Disponibilidad**: requiere Engine **2.4.4+** (< 4.0.0).
- **Configuración**: instálalo y reinicia cuando se te pida. En cada chat de Roleplay, activa los agentes en **Chat Settings → Agents**, añádelo en **Tracker Agents** y elige su conexión al modelo. La red aparece en el Tracker Panel. Selecciona allí **All relationships** (Todas las relaciones) o **Scene-only relationships** (Solo relaciones de la escena) una vez para iniciar el chat.
- **Controles principales**: **All relationships** o **Scene-only relationships** para el contexto del prompt, **Update from History** (Actualizar desde el historial) para analizar los mensajes recientes, edición y bloqueo manuales, y **Resume automatic updates** (Reanudar actualizaciones automáticas). **Context Size** (Tamaño del contexto; 5 mensajes de forma predeterminada), **Presence lookback** (Historial de presencia; 15 de forma predeterminada) y el número de mensajes del análisis del historial son controles separados. Consulta la [guía del paquete Relationship Tracker](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/relationship-tracker/README.md).

### Memory Nag

Mantiene un almacén breve y editable de recuerdos para cada chat de Roleplay. Escanea el chat en lotes, organiza los recuerdos por participantes actuales y anteriores, y mueve los recuerdos resueltos a una lista Resolved que se puede restaurar. Un recuerdo puede conservar literalmente una línea breve de diálogo cuando las palabras exactas importan.

Después de cada respuesta, una coincidencia de palabras entrega al tracker solo los recuerdos activos más relevantes. El tracker decide si la escena requiere un recordatorio y solo puede elegir entre esos recuerdos. No puede crear un recuerdo nuevo durante la recuperación.

- **Fase**: Post-Processing.
- **Dónde funciona**: solo Roleplay.
- **Ajustes clave**: **Vault scan connection** (de forma predeterminada, la conexión del Agent), **Messages per batch** (20), **Maximum memories created per character** (10), **Maximum memories considered per character** (5) y **Maximum memories injected** (3). Usa **Scan chat** para el primer escaneo del historial y **Open vault** para buscar, añadir, editar, resolver, restaurar o eliminar recuerdos.
- **Colocación en el prompt**: sin un marcador del preset, los recordatorios elegidos entran en la siguiente respuesta dentro de `<context><memory_nags>…</memory_nags></context>`. Añade una sección Memory Nag Agent para colocarlos tú.
- **Datos**: el almacén pertenece a un solo chat y se conserva si el paquete se desactiva o se desinstala. Eliminar un recuerdo es permanente y siempre pide confirmación antes.

### World Maps

Añade a una historia ubicaciones anidadas y vínculos espaciales. Creas regiones, áreas, salas y conexiones, te mueves entre ubicaciones, y la posición actual aporta contexto espacial a la generación. Game Mode también obtiene una vista de mapamundi.

- **Integración**: paquete de funciones con interfaz de mapas y contexto del chat, en lugar de un agente de fase de generación.
- **Dónde funciona**: Roleplay y Game.
- **Ajustes clave**: actívalo para un chat de Roleplay en **Chat Settings → Agents**, o selecciónalo al crear una partida y gestiónalo en los ajustes de esa partida. Instalarlo o quitarlo requiere reiniciar.
- **Guía completa**: [World Maps: configuración, creación y viajes](hierarchical-maps.md).

## Misc agents

Los Misc agents añaden extras como imágenes, música, reacciones del público y actualizaciones de tarjetas.

### Echo Chamber

Simula un público en vivo que reacciona a tu escena, en un widget flotante **Echo** en el área del chat. Revela una reacción nueva cada 30 segundos.

- **Fase**: Parallel.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: elige un estilo como **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad** o **Harbingers**. El widget tiene **Re-run Echo Chamber** (volver a ejecutar Echo Chamber) y **Clear messages** (borrar mensajes).

### Long-Term Memory

Extrae recuerdos duraderos de los resúmenes del chat, los registros de personajes y los lorebooks a un almacén propio del paquete y luego recupera el contexto pertinente antes de la respuesta principal. Permite explorar el almacén, importar fuentes, revisar borradores pendientes y colocar el contexto mediante un marcador del preset.

- **Integración**: paquete de funciones con contexto previo a la generación e interfaz para gestionar la memoria.
- **Dónde funciona**: Conversation, Roleplay y Game.
- **Ajustes clave**: presupuesto de tokens de recuperación (128–16.384), cantidad máxima de fragmentos recuperados (1–100), umbral de puntuación, contexto de mensajes recientes (1–20), estilo de recuperación, pesos de búsqueda, inclusión de recuerdos resueltos, preámbulo de recuperación, ajustes de extracción, límites de fuentes, plantillas de prompt, extracción de palabras clave mediante IA y extracción en Game Mode.
- **Datos**: usa los controles de copia de seguridad de Memory Settings para exportar o sustituir el almacén, los borradores y los ajustes. **Delete all data** (Borrar todos los datos) elimina de forma permanente los recuerdos, los borradores, la actividad y los índices, pero conserva los ajustes. Al desinstalarlo se conserva el almacén para una reinstalación posterior. Instalarlo, actualizarlo o quitarlo requiere reiniciar.
- **Compatibilidad**: Engine `2.3.5` hasta antes de `4.0.0`. Permisos: `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage`, `ui`.

### Illustrator

Crea imágenes y videos. Escribe prompts visuales para los momentos importantes y los envía a tu servicio de imágenes o de video.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: Illustrator se ejecuta una vez cada 5 mensajes del usuario y del asistente de forma predeterminada. Cámbialo con **Image Run Interval** (intervalo de generación de imágenes) en la tarjeta de cada chat de Roleplay. Los clips automáticos usan **Video Run Interval** (intervalo de generación de videos) cuando **Illustrator makes** está en **Pictures and clips** o **Clips only**. Pon **Video Run Interval** en **0** para desactivar los clips automáticos. Los ajustes incluyen **Prompt Model**, **Image Style**, **Attach Card Appearance** y **Send Avatar References**. Para la configuración completa, consulta [Agente Illustrator](../media/illustrator-agent.md).

### Lorebook Keeper

Crea y actualiza entradas de lorebook a partir de datos importantes de tu chat, para que tus notas del mundo crezcan a medida que juegas.

- **Fase**: Post-Processing.
- **Dónde funciona**: Roleplay. En Game Mode, una variante de fin de sesión llamada **Game Session Keeper** hace el mismo trabajo.
- **Ajustes clave**: se ejecuta una vez cada 8 mensajes del usuario y del asistente de forma predeterminada. **Target Lorebook** (lorebook de destino) elige a dónde van las entradas, con una opción de selección automática. Los prompts avanzados pueden devolver el nombre de un lorebook editable o un alias como `world`, `npc`, `scene` o `player`. Los destinos de alias que faltan se crean y se vinculan al chat. Sin destino, se mantiene el comportamiento de un solo lorebook.

### Combat

Gestiona el combate: la iniciativa, los HP y el orden de turnos. Cuando está activo, aparece un botón **Encounter** (encuentro) encima del cuadro de mensaje.

- **Fase**: Parallel.
- **Dónde funciona**: Roleplay.
- **Ajustes clave**: incluye una herramienta de tirada de dados para resolver los turnos.

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
- **Ajustes clave**: **Edit** (editar) para reescribir las elecciones y **Re-roll** (volver a generar) para generar unas nuevas. Activa **Add CYOA choices to the message box instead of sending them** (Añadir las opciones CYOA al cuadro de mensaje en lugar de enviarlas) en **Settings → General → Input & Editing** (Configuración → General → Entrada y edición) para que las elecciones en las que hagas clic vayan a tu cuadro de mensaje.

### Storyboard

Planifica storyboards (secuencias de viñetas) fijos o animados a partir de intercambios de Roleplay ya terminados y de la narración de Game. La planificación separada y el formato adaptado a cada proveedor conservan el orden de la historia, la identidad de los personajes y el estilo elegido en los fotogramas clave y los videos.

- **Integración**: paquete de agente; Game y Roleplay usan sus plantillas de prompt y sus ajustes a través de la integración de Storyboard del Engine.
- **Dónde funciona**: Roleplay y Game.
- **Ajustes clave**: planificadores de imagen fija o de animación, conexiones de imagen y de video, cantidad de fotogramas clave, duración, modo de visualización, manejo de las referencias de personaje, plantillas de episodio y de estilo de Roleplay, y plantillas de ilustración y de video de Game.
- **Compatibilidad**: Engine `2.3.5` hasta antes de `3.0.0`. Permisos: `agent-runtime`, `chat-read`, `prompt-context`, `storage`, `ui`. No requiere reiniciar.
- **Guía completa**: [El agente Storyboard: Roleplay y Game Mode](../game/storyboard.md).

### 2D Avatars

Muestra personajes y personas como avatares 2D animados que parpadean, hablan y cambian de cara con cada respuesta. Un avatar puede ser de sprites al estilo PNGTuber (tus sprites de expresión con imágenes de parpadeo y de habla) o un archivo de avatar de malla (`.mavatar`).

- **Integración**: paquete de agente. El Engine dibuja los avatares. No envía solicitudes adicionales a tus conexiones de IA mientras chateas.
- **Dónde funciona**: Roleplay y Game, para personajes y personas.
- **Disponibilidad**: en **Agent Organizer** para todas las instalaciones. Necesita Marinara Engine 2.5.1 o posterior.
- **Ajustes clave**: configura cada avatar en la página del agente en **Agents**. El agente también incluye los prompts que crean imágenes de parpadeo y de habla, y un avatar de malla, a partir de un sprite.
- **Compatibilidad**: Engine `2.5.0` hasta antes de `4.0.0`, Capability API 1.73. Permisos: `agent-runtime`, `chat-read`, `storage`, `ui`. No requiere reiniciar.
- **Guía completa**: [Avatares 2D y 3D](avatars.md).

### 3D Avatars

Muestra personajes y personas como modelos 3D animados que parpadean, hablan y cambian de cara con cada respuesta. Admite modelos VRM (`.vrm`, versiones 0.x y 1.0) con una animación en reposo opcional (`.vrma`), modelos MMD PMX y modelos GLB y FBX con rigging cuyos huesos se asignan por su nombre.

- **Integración**: paquete de agente. El Engine dibuja los avatares. No envía solicitudes adicionales a tus conexiones de IA mientras chateas.
- **Dónde funciona**: Roleplay y Game, para personajes y personas.
- **Disponibilidad**: en **Agent Organizer** para todas las instalaciones. Necesita Marinara Engine 2.5.1 o posterior.
- **Ajustes clave**: configura cada avatar en la página del agente en **Agents**.
- **Compatibilidad**: la misma que 2D Avatars.
- **Guía completa**: [Avatares 2D y 3D](avatars.md).

### Calls

Añade llamadas de audio y video en vivo con los personajes de Conversation: llamadas que inicias tú, llamadas entrantes, transcripciones solo de llamada, texto a voz, entrada de micrófono y clips de video del personaje.

- **Integración**: paquete de funciones de Conversation con controles en la barra de herramientas, en el chat y en Chat Settings.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: abre **Chat Settings → Agents → Calls** para activar las llamadas y elegir el comportamiento del habla, el micrófono, el timbre y el video. Consulta [Llamadas de audio y video de Conversation](../conversation/calls.md). Instalarlo o quitarlo requiere reiniciar.

### UNO

Añade una mesa de UNO con reglas aplicadas para ti y los personajes de Conversation, con reglas de la casa y de dos a diez jugadores.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: inícialo desde el selector de juegos o con `/uno` y luego elige los jugadores y las reglas de la casa. Instalarlo o quitarlo requiere reiniciar.

### Chess

Añade un tablero de Chess uno contra uno con comprobación de movimientos legales, detección de jaque y jaque mate, piezas capturadas y turnos del oponente dentro de personaje.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: inícialo desde el selector de juegos o con `/chess` y luego elige el oponente y tu bando. Instalarlo o quitarlo requiere reiniciar.

### Poker

Añade una mesa de Texas Hold'em para dos a ocho jugadores, con ciegas, rondas de apuestas, botes secundarios, showdowns y oponentes dentro de personaje.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: inícialo desde el selector de juegos o con `/poker` y luego elige los jugadores, las fichas iniciales y las ciegas. Instalarlo o quitarlo requiere reiniciar.

### 8-Ball Pool

Añade una mesa de billar uno contra uno con bolas lisas y rayadas, apuntado y fuerza del tiro, faltas, bola en mano y tiros del oponente dentro de personaje.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: inícialo desde el selector de juegos o con `/8ball` y luego elige el oponente. Instalarlo o quitarlo requiere reiniciar.

### Tic-Tac-Toe

Añade un tablero de Tic-Tac-Toe uno contra uno con marcas elegidas o aleatorias, manejo de turnos y detección de victoria y empate.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: inícialo desde el selector de juegos o con `/tictactoe` (alias `/ttt`) y luego elige el oponente y la marca. Instalarlo o quitarlo requiere reiniciar.

### Rock-Paper-Scissors

Añade una partida uno contra uno donde ambas elecciones permanecen ocultas hasta que se revelan.

- **Integración**: paquete de juego de Conversation.
- **Dónde funciona**: Conversation.
- **Ajustes clave**: inícialo desde el selector de juegos o con `/rps` y luego elige el oponente y una partida al mejor de tres, cinco o siete. Instalarlo o quitarlo requiere reiniciar.

## Guías relacionadas

- [Descripción general de los agentes](agents-overview.md)
- [Agente Illustrator](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Configuración de Haptic Feedback](../integrations/haptic-feedback.md)
- [Fuentes de conocimiento](knowledge-sources.md)
- [Narrative Director y Secret Plot](../roleplay/narrative-director.md)
- [Llamadas de audio y video de Conversation](../conversation/calls.md)
- [Juegos de mesa de Conversation](../conversation/table-games.md)
