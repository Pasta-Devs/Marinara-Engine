# Game Mode: primeros pasos

Game Mode convierte Marinara Engine en un juego de rol para un solo jugador dirigido por un Game Master de IA. Usa esta guía para empezar una partida, jugar el primer turno y encontrar los controles.

Game Mode es uno de los tres modos de chat (Conversation, Roleplay y Game Mode). El Game Master (GM, director del juego) es la IA que narra el mundo, interpreta a cada personaje que conoces y decide qué pasa a continuación, como el Dungeon Master en un juego de mesa. Marinara lleva el registro del mapa, tu grupo, los personajes no jugadores (NPC), los objetos, las misiones, el tiempo dentro del mundo y el clima. Puedes dividir una partida larga en varias **sesiones**, como las noches de juego de una misma campaña.

No tienes que usar todas las mecánicas. Puedes omitir el combate y los dados y jugar por la historia.

## Antes de empezar

Necesitas una sola cosa: una cuenta de IA para el Game Master. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md) si aún no has añadido ninguna.

Todo lo demás es opcional y está desactivado de forma predeterminada. Puedes añadirlo más tarde:

- **Imágenes.** El agente **Illustrator** dibuja retratos de NPC, fondos de lugares e imágenes de escena. Descárgalo desde **Agents → Agent Organizer** (Agentes → Organizador de agentes). Necesita una cuenta de imágenes. Sin él, sigues teniendo la historia, el registro del estado y el combate, pero las áreas visuales quedan vacías.
- **Efectos de escena del Built-in model (Modelo integrado).** Marinara puede ejecutar un modelo pequeño en tu propia computadora para elegir fondos y música sin costo. Se convierte en el **Scene effects model** (Modelo de efectos de escena) predeterminado en cuanto lo descargas. Hasta entonces, el predeterminado es **Skip - use inline tags from GM** (Omitir: usar las etiquetas en línea del GM). Consulta [Configuración del modelo integrado](../connections/local-model.md).
- **Storyboards.** Descarga el agente Storyboard y luego actívalo para la partida. Consulta [Guía del agente Storyboard](storyboard.md).
- **Video.** Una cuenta de video solo hace falta para videos de escena o Storyboards animados.
- **Música.** El agente **Music DJ** reproduce música de Spotify o de una carpeta de música local.

## Empezar una partida

1. En la barra lateral de chats, abre la pestaña **GM** y haz clic en el botón **+** (**New Game**, Nueva partida). O haz clic en **Game** en la pantalla de inicio. Se abre el asistente de configuración. Consulta [Administrar chats](../chats/managing-chats.md).
2. En el primer paso, elige el **Model** (Modelo) que dirige al GM. Elige una cuenta que hayas añadido antes. Si la lista está vacía, añade una primero. Para la generación del mundo, elige un modelo de pago potente (consulta [Elegir un modelo](#choosing-a-model)).
3. Haz clic en **Next** (Siguiente) en cada paso. Todos los demás campos tienen un valor predeterminado, así que puedes avanzar sin cambiar nada.
4. En el último paso, haz clic en **Create world** (Crear mundo). El botón muestra **Generating World…** mientras Marinara construye tu mundo. Es una sola solicitud grande a tu modelo, así que espera a que termine.
5. Cuando el mundo está listo, la pantalla del juego muestra **Start Game** (Iniciar partida). Haz clic en él. Luego el GM escribe el primer mensaje.

Si los widgets personalizados del HUD están activados (lo predeterminado), hay un botón **Review Starting Widgets** (Revisar widgets iniciales) debajo de **Start Game**. Puedes omitirlo o usarlo para cambiar antes los widgets iniciales. Consulta [Game Mode: widgets del HUD](hud-widgets.md).

> **Consejo:** Si eres nuevo en Game Mode, deja **Game Master Mode** (Modo del Game Master) en **Standalone GM**. Marinara construye un narrador sarcástico por ti.

Si no funcionó, consulta [La generación del mundo falla con un error de JSON o 422](#world-generation-fails-with-a-json-or-422-error).

### El asistente de configuración

| Paso | Qué defines |
| --- | --- |
| **Connection** | **Game Name** (Nombre de la partida), el **Model** que dirige al GM y un **Scene effects model** opcional. Por ahora, la tarjeta **Game Mode** solo muestra **VN**. |
| **World** | Género, ambientación, tono, dificultad, clasificación de contenido, estilo de historia, violencia, límites de contenido e idioma. **Combat Preference** (Preferencia de combate) es **Turn-Based** o **Tactical**. Todas las partidas nuevas usan clases **MRPG** (Marinara RPG). Consulta [Clases MRPG](mrpg-classes.md). Cuando hay un conjunto de reglas instalado, aparece una opción **Rules** (Reglas). Consulta [Elegir las reglas](#choose-rules). |
| **Party** | Tu persona (el personaje que interpretas), **Game Master Mode**, los miembros del grupo y **GM intro message** (Mensaje de introducción del GM). Consulta [El mensaje de introducción del GM](#the-gm-intro-message). El árbol MRPG inicial de cada miembro procede de la sección **Game Mode** de su tarjeta (consulta [Elegir los árboles de un personaje](mrpg-classes.md#choose-a-characters-trees)). |
| **Goals** | Lo que quieres de la aventura. |
| **Lorebooks** | Los lorebooks (libros de trasfondo) que el GM trata como canon. Un lorebook es un conjunto de datos de trasfondo del mundo. Consulta [Lorebooks](../lorebooks/overview.md). |
| **Features** | **Enable Agents** (Activar agentes) y luego una tarjeta por cada agente descargado (**Illustrator**, **Music DJ**, **Lorebook Keeper**), además de **Custom HUD Widgets** (Widgets de HUD personalizados), **Quick Time Events** (Eventos de tiempo rápido) y **Start Muted** (Empezar silenciado). |
| **GM** | El estilo de presentación y el **GM Prompt**. |

Las ideas que se ofrecen para la ambientación y los objetivos cambian cada vez que se abre el asistente. En una partida Tactical, el GM escribe una descripción breve de cada pelea y Marinara genera un tablero a partir de ella. Consulta [Combate](combat.md#tactical-battles-and-terrain).

El paso **World** también tiene opciones de combate para los jefes. **GM directs bosses** (El GM dirige a los jefes) está activado de forma predeterminada. Permite que el GM decida los turnos de los jefes con tu conexión del GM, lo que puede tardar un momento. Los enemigos comunes deciden por su cuenta, salvo que **GM directs bosses** esté activado y el conjunto de reglas de la partida le dé la oposición al Game Master (consulta [Texto del Game Master](../extending/ruleset-sheets.md#game-master-text)). Mientras **GM directs bosses** está activado, **Game Master also plays named and brilliant opponents** (El Game Master también interpreta a los oponentes con nombre y brillantes; activado de forma predeterminada) permite que el GM interprete también a los personajes con nombre y a los enemigos muy astutos. Siempre se muestran dos opciones más: **Companions fight on their own** (Los compañeros luchan por su cuenta; activado de forma predeterminada, desactívalo para controlar tú a todo el grupo) y **Let cruel opponents strike the fallen** (Permitir que los oponentes crueles golpeen a los caídos; desactivado de forma predeterminada). Una partida nueva también ofrece **Permadeath** (Muerte permanente; desactivado de forma predeterminada): un miembro del grupo que cae en una pelea y no se salva antes de que termine desaparece para siempre. Consulta [Combate](combat.md).

Con el agente **Hierarchical Maps** descargado (ahora llamado World Maps; consulta [World Maps](../agents/hierarchical-maps.md)) y **Enable Agents** activado, el paso **Features** también puede crear un borrador de **Hierarchical world map** (Mapa jerárquico del mundo), usar una plantilla de mapa guardada o enlazar un mundo compartido.

### Valores predeterminados que conviene conocer

| Opción | Predeterminado | Notas |
| --- | --- | --- |
| Genre | Fantasy | Se permiten varios, además de los tuyos propios. |
| Tone | Heroic | Se permiten varios. |
| Difficulty | Normal | **Casual**, **Normal**, **Hard** o **Brutal**. Los ajustes más altos hacen las peleas más difíciles: más enemigos y más fuertes en una partida MRPG (consulta [Batallas en una partida MRPG](combat.md#battles-in-an-mrpg-game)), y enemigos que golpean más fuerte en una partida Legacy (consulta [Escalado de dificultad](combat.md#difficulty-scaling)). |
| Content Rating (sexual content) (Clasificación del contenido: contenido sexual) | SFW | **SFW** o **NSFW**. Solo abarca el contenido sexual. NSFW lo permite, no lo obliga. |
| Story style (Estilo de historia) | Standard (Estándar) | **Gentle** (Suave) ofrece un GM que genera menos estrés. Consulta [Estilo de historia, violencia y límites de contenido](#story-style-violence-and-content-boundaries). |
| Violence (Violencia) | Serious (Seria; SFW) o Graphic (Gráfica; NSFW) | **Mild** (Leve), **Serious** o **Graphic**. Se configura aparte de la clasificación del contenido. |
| Content boundaries (Límites de contenido) | Ninguno | Temas que el GM mantiene fuera de la historia. |
| Language | English | Todo el texto dentro del juego se escribe en este idioma. |
| Game Master Mode | Standalone GM | **Character GM** usa una de tus tarjetas de personaje como GM. |
| Scene effects model | Built-in model | Solo una vez que lo descargas. Hasta entonces, el predeterminado es **Skip - use inline tags from GM**. |
| Enable Agents | Off | Actívalo para ver las tarjetas de los agentes. |
| Illustrator | Off | Necesita el agente Illustrator y una cuenta de imágenes. |
| Music DJ | Off | Necesita Spotify o una carpeta de música local. |
| Custom HUD Widgets | On | El modelo diseña widgets de estado para el nuevo mundo. |
| Quick Time Events | On | Desactívalo para jugar con lector de pantalla o sin límite de tiempo. |
| Start Muted | Off | Empieza la partida con todo el audio silenciado. |
| Game Presentation | Standard | Consulta más abajo. |

### Estilo de historia, violencia y límites de contenido

El paso **World** tiene cuatro ajustes que deciden qué puede contener la historia y qué tan intensa resulta. Están juntos bajo **Content Rating (sexual content)** (Clasificación del contenido: contenido sexual). Puedes cambiarlos todos excepto la clasificación del contenido después de empezar la partida. Consulta [Cambiarlos durante una partida](#change-them-during-a-game).

| Ajuste | Qué decide |
| --- | --- |
| **Content Rating (sexual content)** | **SFW**: romance y afecto, y las escenas de sexo hacen un fundido a negro. **NSFW**: las escenas de sexo pueden escribirse de forma explícita. No decide nada más. |
| **Story style** (Estilo de historia) | **Standard** (Estándar): los errores y la mala suerte tienen consecuencias reales. **Gentle**: desafíos reales, pero los contratiempos no escalan hasta el castigo o el trauma. |
| **Violence** (Violencia) | **Mild**, **Serious** o **Graphic**: cómo se muestra la violencia. Empieza en **Serious** para SFW y **Graphic** para NSFW, que es lo que siempre significó cada clasificación. |
| **Content boundaries** (Límites de contenido) | Temas que nunca quieres en la historia, uno por línea, como `harm to animals`. |

#### El estilo de historia Gentle

Elige **Gentle** si quieres disfrutar de la historia y sus personajes sin que el GM castigue cada error. Con **Gentle**:

- Los contratiempos cuestan tiempo, prestigio, recursos o un desvío. El GM no responde con lesiones, humillación, la pérdida de alguien que te importa ni traumas hacia los que no hayas dirigido la historia.
- El GM pide una prueba de habilidad solo cuando importan la habilidad o la elección de tu propio personaje. Nunca hace tiradas contra algo que tu personaje no puede controlar, como una discapacidad, una condición, su cuerpo o su trasfondo. Consulta [Pruebas de habilidad en una partida Gentle](dice-and-skill-checks.md#skill-checks-in-a-gentle-game).
- El mundo se planifica con calidez: los arcos nacen tanto de las esperanzas y las relaciones como de las heridas, y los giros te sorprenden en lugar de traicionarte.

**Gentle** solo reemplaza las instrucciones integradas del GM. Si escribiste tu propio **GM Prompt** (Prompt del GM), el GM conserva tu texto. El combate, el daño y el ajuste de dificultad funcionan igual en ambos estilos.

#### Límites de contenido

Escribe un tema por línea, hasta 40 temas y 2.000 caracteres en total. Se omite todo lo que supere cualquiera de los dos límites. El GM trata cada tema como un límite estricto, por encima de la clasificación, el tono, la personalidad de cualquier personaje y la trama. No los menciona, no los usa como amenaza, giro o trasfondo, ni hace alusiones a ellos. Si tú mencionas uno, el GM lo trata brevemente y sigue adelante. Los límites funcionan en ambos estilos de historia y en ambas clasificaciones, y tus propias directrices de clasificación no pueden eliminarlos.

> **Nota:** La historia la escribe un modelo de IA, así que Marinara no puede garantizar que un tema de la lista nunca aparezca. Si se cuela alguno, haz un swipe o edita la respuesta.

#### Editar las directrices de clasificación

Debajo de los botones de clasificación, despliega **Edit rating guidelines** (Editar directrices de clasificación) para ver el texto que recibe el GM para la clasificación, la violencia y el estilo de historia elegidos. Edítalo para definir tus propias reglas de contenido para esta partida, o haz clic en **Reset to default** (Restablecer al predeterminado) para volver al texto integrado. Mientras lo dejes sin cambios, sigue la clasificación, la violencia y el estilo que elijas.

#### Cambiarlos durante una partida

Abre **Chat Settings → Prompt Preset** (Ajustes del chat → Preset de prompt). En una partida, esta sección también tiene **Story style**, **Violence**, **Content boundaries** y **Rating guidelines** (Directrices de clasificación). Los cambios se aplican a partir del siguiente turno. La clasificación del contenido queda fija una vez creada la partida.

Un preset de prompt también puede incluir un estilo de historia, un nivel de violencia y límites, para que puedas reutilizarlos en cada partida. Consulta [Ajustes de historia de la partida](../prompts/presets.md#game-story-settings).

<a id="choose-rules"></a>

### Elegir las reglas

**Rules** (Reglas) solo aparece para una partida nueva y solo cuando hay al menos un conjunto de reglas instalado. **Marinara's own rules** (Las reglas propias de Marinara) es la opción predeterminada: las pruebas d20 integradas y la ficha de seis atributos. Un conjunto de reglas como **5e (SRD 5.1)** las sustituye por las pruebas y la ficha de personaje propias de un sistema de mesa, y también puede resolver las batallas con sus propias reglas. El asistente muestra qué abarca cada conjunto de reglas. La elección queda fija una vez creada la partida. Consulta [Jugar con un conjunto de reglas](rulesets.md).

<a id="the-gm-intro-message"></a>

### El mensaje de introducción del GM

**GM intro message** (Mensaje de introducción del GM), en el paso **Party**, decide cómo empieza la partida:

- **None** (Ninguno), el predeterminado: el GM abre la partida como le parezca.
- **Defined** (Definido): escribe el primer mensaje exactamente como debe leerse. La partida empieza con este texto, y regenerarlo da el mismo texto.
- **Guided** (Guiado): describe cómo debe ir el inicio, por ejemplo dónde empieza y quién está allí. El GM escribe el inicio a partir de ello.

El texto puede tener hasta 8.000 caracteres. No puede contener llaves dobles, y el texto **Guided** tampoco puede contener corchetes. El campo indica cuándo no se puede usar el texto. La historia de un mundo puede definir su propia introducción. Entonces el campo la muestra como bloqueada y no puedes cambiarla.

### Storyboard Optimized

En el paso **GM**, **Game Presentation** (Presentación de Game) puede ser **Standard** o **Storyboard Optimized**. **Storyboard Optimized** usa el Storyboard Game Prompt, que da forma a los turnos del GM como momentos visuales filmables. No descarga ni activa el agente Storyboard, no activa la generación de imágenes ni de video, y no cambia tus cuentas. Después de crear la partida, configura todo eso en **Chat Settings → Agents → Storyboards** (Ajustes del chat → Agentes → Storyboards).

El editor **GM Prompt** previsualiza el prompt (las instrucciones enviadas a la IA) de la presentación seleccionada. Si dejas el texto sin cambios, el preset (ajuste guardado) integrado sigue seleccionado. Si lo editas, tu texto anula el preset.

La combinación alternativa de anime en toma única sigue disponible después de la configuración: elige **Anime Episode Director** para el Animation Planner y **Anime Game Video** para el Storyboard Video Prompt.

## Jugar tu primer turno

Escribe lo que tu personaje hace o dice y envíalo. El GM responde, actualiza el mundo y puede pedir una tirada de dados o empezar una pelea.

El botón de globo de diálogo junto al botón de adjuntar archivos (su tooltip dice **Choose who to address**, Elige a quién te diriges) define quién recibe tu mensaje:

| Modo | Qué hace |
| --- | --- |
| Predeterminado | Tu mensaje entra en la escena como una acción o una línea de diálogo. El GM y tu grupo responden en la historia. |
| **Talk to Party** (Hablar con el grupo) | Añade un marcador `[To the party]` y habla con tus compañeros. Solo se muestra cuando tu grupo no está vacío. |
| **Talk to GM** (Hablar con el GM) | Añade un marcador `[To the GM]` y le pregunta al GM fuera de personaje, por ejemplo "¿Mi personaje sabe algo del templo?". |

El modo activo muestra **On** en el menú. Haz clic otra vez en la misma entrada para desactivarlo.

<a id="the-games-controls"></a>

## Los controles del juego

En una computadora, los controles se abren con botones cerca de la esquina superior derecha del chat. En un teléfono, búscalos en el menú móvil de tres puntos **Chat tools** (Herramientas del chat).

| Control | Qué contiene |
| --- | --- |
| **Game controls** (el mando de juego) | **Retry turn**, **Retry scene analysis**, **Retry Music DJ** (cuando Music DJ pone la música) y **Retry assets image generation**. Para un fondo de storyboard, también repetir, reproducir/pausar y silenciar. **Edit game data** (Editar datos del juego) corrige a mano los datos guardados (consulta [Editar los datos del juego a mano](sessions-and-saves. md#editing-game-data-by-hand)). **Checkpoints** (Puntos de control) vuelve a un momento anterior (consulta [Cómo se guarda tu juego](sessions-and-saves. md#how-your-game-saves)). |
| **Session** (la pluma) | El historial de sesiones, el diario y los controles de sesión. Consulta [Game Mode: sesiones y partidas guardadas](sessions-and-saves.md). |
| **Volume** (el altavoz) | Volumen de **Master**, **Music**, **Sound Effects**, **TTS** y **Ambient**. |
| **Game Assets** (la carpeta) | Los medios de la escena y el Asset Browser. Consulta [Recursos del juego](game-assets.md). |
| **Connected chat** | Se muestra cuando la partida está enlazada a una Conversation. Consulta [Chats conectados](../chats/connected-chats.md#switching-between-connected-chats). |

Elige una herramienta para abrirla en una ventana móvil en una computadora o en un panel de ancho completo en un teléfono. En una computadora, arrastra el botón de una herramienta para moverlo. En un teléfono, mueve el menú de tres puntos, o desbloquéalo para reordenar las herramientas que contiene. Consulta [Ventanas de controles y sus botones](../chats/chat-settings.md#control-windows-and-their-buttons).

También puedes guardar un control dentro de **Chat Settings**. Abre la ventana del control y elige **Put back in Chat Settings** (Devolver a Chat Settings). Entonces aparece allí como una sección desplegable, y su botón para sacarla la vuelve a convertir en ventana. Cada partida guarda tu elección. **Reset View** (Restablecer vista) restaura la disposición inicial.

**Character Profiles** (Perfiles de personajes) se queda fuera de Chat tools en computadoras y teléfonos. Arrastra su botón de retrato adonde quieras y luego ábrelo para elegir un miembro del grupo y ver o editar su hoja. En los teléfonos, **Map** (Mapa) también tiene su propio botón móvil. Ambos siguen el estilo de tus widgets de chat, guardan sus posiciones para esta partida y se pueden bloquear desde su ventana abierta.

<a id="choosing-a-model"></a>

## Elegir un modelo

La generación del mundo es la parte más difícil de Game Mode. Le pide al modelo un documento JSON largo y estricto (un formato de texto que debe ser exacto o el juego no puede leerlo) sin campos faltantes. Un modelo que chatea bien puede aun así fallar en este paso.

- Para la generación del mundo, usa un modelo de primer nivel, actual y capaz, en una cuenta de pago. A partir de 2026, los jugadores reportan buenos resultados con los niveles insignia de los grandes proveedores, como Anthropic Claude, OpenAI GPT y Google Gemini. Los nombres de los modelos cambian a menudo, así que trata estos como ejemplos, no como una lista fija.
- Los modelos más baratos que recomendamos, ambos probados en partidas al 31 de octubre de 2026, son DeepSeek V4 Flash y Claude Haiku 5.5.
- Para los turnos posteriores, a veces puedes usar un modelo más barato, porque los turnos piden narración, no JSON estricto. Si el GM olvida NPC o contradice detalles anteriores, vuelve a un modelo más fuerte.
- Evita los modelos gratuitos o de enrutamiento automático para la generación del mundo. Pueden enrutar a un modelo pequeño que no puede producir un JSON válido. Los modelos pequeños de pesos abiertos también suelen fallar.

Para la referencia completa de parámetros, consulta [Parámetros de generación](../prompts/generation-parameters.md).

## Lo que cuesta un turno

Game Mode hace tres tipos de solicitud de IA:

1. **Generación del mundo.** Una vez, cuando haces clic en **Start Game**. Una sola solicitud grande que devuelve la descripción general del mundo, el mapa inicial, los NPC, las hojas del grupo y los widgets.
2. **Turnos de juego.** Cada mensaje construye un prompt nuevo con el estado actual. El GM narra y actualiza el mundo. El motor, no el modelo, calcula las cifras de las rondas de combate, para que los resultados sigan siendo justos.
3. **Resúmenes de sesión.** Cuando terminas una sesión, el GM escribe un resumen y notas de continuidad. Cuando empiezas la siguiente, escribe un mensaje puente corto. Las sesiones antiguas se comprimen en resúmenes para que las campañas largas quepan en el modelo.

<a id="optional-tool-planning-and-lore-searches"></a>

## Planificación opcional de herramientas y búsquedas de trasfondo

Durante la partida, abre **Chat Settings → Function Calling** (Ajustes del chat → Llamadas a funciones).

- **Let the GM search lore** (Permitir que el GM busque trasfondo) permite que el GM consulte datos de los lorebooks por su significado. Primero activa la vectorización de los lorebooks y vectoriza sus entradas. Las búsquedas respetan los libros y las carpetas activados y los interruptores de entradas específicos del chat. Usan tu cuenta de embeddings y pueden añadir una solicitud al modelo. Los chats de Game necesitan este interruptor para consultar lorebooks, incluso cuando **Enable Tool Use** (Activar el uso de herramientas) está activado. Mientras está desactivado, `search_lorebook` no está disponible en el selector de herramientas.
- **Game tool provider** (Proveedor de herramientas del juego) usa de forma predeterminada **Same as narrator** (El mismo que el narrador), que conserva el bucle normal de herramientas (hasta cuatro rondas de herramientas por turno). Elegir otra cuenta ejecuta una solicitud de planificación aparte antes de la narración. Ese modelo elige las herramientas y el narrador recibe sus resultados como texto. Esto cuesta una solicitud adicional por turno en esa cuenta. Un modelo más barato puede reducir el costo, pero puede elegir otras herramientas. Una sola pasada de planificación no puede encadenar una segunda búsqueda.
- **Finish rolled turns in one request** (Terminar turnos con dados en una sola solicitud) está activado de forma predeterminada y ahorra una solicitud en los turnos en los que se tiran dados. Consulta [Game Mode: dados y pruebas de habilidad](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

Las cuentas de suscripción de Claude y Grok no admiten llamadas nativas a herramientas. Los controles lo explican y permanecen desactivados salvo que se elija un **Game tool provider** compatible. Los comandos de texto y las etiquetas de dados siguen funcionando. Si falta una cuenta aparte o falla su solicitud, el turno informa del fallo en lugar de narrar sin el trabajo de las herramientas.

Si tus modelos locales comparten una GPU con memoria limitada, abre **Chat Settings → Agents** (Ajustes del chat → Agentes) y activa **Run Game tasks one at a time** (Ejecutar las tareas de Game de una en una). Entonces la narración, los agentes y los medios de la escena se esperan unos a otros dentro de ese chat de Game. Está desactivado de forma predeterminada y no reserva la GPU frente a otros chats o aplicaciones.

## Activar agentes

Los agentes son ayudantes de IA opcionales que se ejecutan junto al GM. Hacen solicitudes adicionales, así que añaden costo. Para usarlos, abre **Chat Settings → Agents** durante el juego y activa **Enable Agents**. Dos son útiles en Game Mode:

- **Game Session Keeper** ayuda a mantener la continuidad entre sesiones.
- **Music DJ** elige la música de fondo.

**Review Agent Outputs** (Revisar salidas de los agentes) te permite revisar lo que produjo un agente. Consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md).

## Solución de problemas

<a id="world-generation-fails-with-a-json-or-422-error"></a>

### La generación del mundo falla con un error de JSON o 422

Lo más probable es que el modelo no pudiera producir el JSON completo. Prueba esto en orden.

1. Revisa qué modelo usa el GM. Si es un modelo gratuito o de enrutamiento automático, cambia a uno de pago capaz.
2. Inténtalo de nuevo. Algunos fallos ocurren una sola vez.
3. Acorta un campo de ambientación o de preferencias largo. Las entradas largas dejan menos espacio para el JSON.

Si una llamada casi funcionó, Marinara ofrece una ventana **Repair JSON** (Reparar JSON) con la salida en bruto del modelo en un editor con números de línea. Una línea de estado dice si el JSON es válido o muestra el error de análisis. Haz clic en **Format** (Formatear) para ordenar el JSON válido y luego en **Apply Repaired JSON** (Aplicar JSON reparado) para usar tu corrección sin pagar por un reintento. **Repair JSON** también aparece para los resúmenes de sesión y otras llamadas estructuradas. Para más soluciones, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

### El GM narra con alegría aunque hayas elegido un tono oscuro

Comprueba que el **Story style** de la partida sea **Standard**: **Gentle** mantiene leves los contratiempos a propósito (consulta [El estilo de historia Gentle](#the-gentle-story-style)). Algunos modelos se mantienen animados. Añade una instrucción clara en el campo de preferencias del asistente, como "mantén la narración sombría, no suavices los fracasos". O cambia a un modelo cuya voz predeterminada encaje con el tono.

### El modelo rechaza un turno

Un aviso dice **The model declined this request** (El modelo rechazó esta solicitud) cuando el modelo se niega a escribir el turno. Algunos modelos rechazan ciertas formulaciones en las directrices de clasificación de una partida, un preset o una tarjeta de personaje. Prueba lo siguiente en este orden:

1. Vuelve a intentar el turno. Algunos rechazos solo ocurren una vez.
2. Si editaste las directrices de clasificación, abre **Chat Settings → Prompt Preset** y restablece **Rating guidelines** al texto integrado.
3. Prueba otro modelo para esta partida.

## Dónde vive cada tema

- [Game Mode: combate](combat.md): los encuentros, el menú de acciones, el cálculo de daño y los eventos de tiempo rápido.
- [Game Mode: clases MRPG](mrpg-classes.md): elegir clases, las estadísticas, los niveles y ascensos, la ficha de clase, las partidas compartidas y cómo migrar una partida Legacy.
- [Game Mode: grupo y NPC](party-and-npcs.md): Character Profiles, las hojas de personaje y el Adventure Journal.
- [Game Mode: sesiones y partidas guardadas](sessions-and-saves.md): terminar y empezar sesiones, el historial y los puntos de control.
- [Game Mode: mapa, tiempo y clima](map-time-weather.md): las vistas del mapa, el reloj, el clima y la moral.
- [Game Mode: dados y pruebas de habilidad](dice-and-skill-checks.md): el menú de dados y las reglas de las pruebas de habilidad.
- [Game Mode: widgets del HUD](hud-widgets.md): los widgets de estado en pantalla.
- [Recursos del juego](game-assets.md): la biblioteca de música, sonido, sprites y fondos.
- [Guía del agente Storyboard](storyboard.md): los Storyboards para Game Mode y Roleplay.
- [Roleplay Mode: primeros pasos](../roleplay/getting-started.md): las Author's Notes funcionan aquí de la misma forma.
