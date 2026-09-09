# Game Mode: primeros pasos

Game Mode convierte Marinara Engine en un juego de rol para un solo jugador dirigido por un Game Master de IA. Esta guía explica qué es Game Mode y qué necesitas antes de empezar. Después te lleva por el asistente de configuración y te muestra dónde encontrar cada función de juego. Léela una vez, empieza una partida y luego sigue los enlaces del final para temas más avanzados.

## Qué es Game Mode

Game Mode es uno de los modos de chat de Marinara. Los otros son Conversation y Roleplay.

En Game Mode, un Game Master (GM) de IA dirige una historia para ti. Un Game Master (director del juego) es la IA que narra el mundo, interpreta a cada personaje que conoces y decide qué pasa a continuación. Funciona como el Dungeon Master en un juego de mesa.

El motor lleva el registro del estado del juego por ti a lo largo de los turnos. Esto incluye el mapa, tu grupo, los personajes no jugadores (NPC), tus objetos, misiones, el tiempo dentro del mundo y el clima. Juegas a lo largo de muchos turnos. Puedes dividir una partida larga en varias **sessions** (sesiones), como un grupo de mesa que reparte una campaña entre varias noches de juego. Una campaña es toda la historia en curso.

No tienes que usar todas las mecánicas. Algunos jugadores omiten el combate y los dados y usan Game Mode para un juego visual y guiado por la historia. Los sistemas de rol están ahí cuando los quieras.

## Antes de empezar

Solo necesitas una cosa para empezar una partida: una conexión con un proveedor de IA para el GM. Una conexión enlaza Marinara con un proveedor de IA para que pueda generar texto. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md) si aún no has configurado ninguna.

Todo lo demás es opcional y está desactivado de forma predeterminada. Puedes añadir esto más tarde:

- **Generación de imágenes.** Game Mode tiene una disposición visual con fondos y arte de personajes. Para llenarla, necesitas una conexión de generación de imágenes. La opción **Visual Generation** (Generación visual) del asistente está desactivada de forma predeterminada, así que debes activarla tú. Sin ella, sigues teniendo la historia, el registro del estado y el combate, pero las áreas visuales quedan vacías.
- **Un Local Model para efectos de escena.** Marinara puede ejecutar un modelo pequeño en tu propia computadora, etiquetado como **Local Model (Gemma)**. Impulsa las sugerencias de fondo y música sin costo adicional. Es la opción predeterminada en el asistente. Consulta [Configuración del Local Model](../connections/local-model.md).
- **El agente Storyboard.** Instálalo desde **Agents > Download Agents** (Agentes > Descargar agentes) y luego actívalo para el Game ya creado en **Chat Settings > Agents** cuando quieras Storyboards fijos o animados.
- **Una conexión de generación de video.** Esto solo se necesita para videos de escena o Storyboards animados.
- **Música.** El agente **Music DJ** puede reproducir música del juego. Necesita Spotify o una carpeta de música local, y está desactivado de forma predeterminada.

## El asistente de configuración

Cuando creas un chat de Game Mode, se abre un **setup wizard** (asistente de configuración). Tiene siete pasos. El único campo obligatorio es la conexión del GM en el primer paso. Todos los demás campos tienen un valor predeterminado razonable. Puedes avanzar rápido por el asistente y dejar que Marinara rellene el resto.

Los siete pasos son:

1. **Connection.** Define el nombre de la partida, elige la conexión del GM y, si quieres, define una conexión para los efectos de escena. Los efectos de escena usan de forma predeterminada **Local Model (Gemma)**.
2. **World.** Define el género, la ambientación, el tono, la dificultad, la clasificación de contenido y el idioma.
3. **Party.** Elige tu persona (el personaje que interpretas), el **Game Master Mode** (modo del director del juego) y los miembros del grupo.
4. **Goals.** Dile al GM qué esperas de la aventura.
5. **Lorebooks.** Adjunta los lorebooks (libros de trasfondo) cuyos datos el GM debe tratar como canon. Un lorebook es un conjunto de datos de trasfondo del mundo. Consulta [Lorebooks](../lorebooks/overview.md).
6. **Features.** Activa sistemas opcionales como Visual Generation, Music DJ y widgets del HUD. Los agentes instalables se pueden activar desde Chat Settings después de crear el Game.
7. **GM.** Elige el estilo de presentación y revisa las instrucciones avanzadas del GM antes de que se construya el mundo.

Cuando termines, haz clic en **Start Game**.

### Valores predeterminados que conviene conocer

Estos son los valores iniciales en los pasos **World**, **Party** y **Features**. Puedes cambiar cualquiera de ellos.

| Opción | Predeterminado | Notas |
|---|---|---|
| Genre | Fantasy | Selección múltiple, más tus propias entradas personalizadas |
| Tone | Heroic | Selección múltiple |
| Difficulty | Normal | Casual, Normal, Hard o Brutal; los ajustes más altos hacen el combate más severo |
| Content Rating | SFW | SFW o NSFW; NSFW solo permite contenido para adultos, no lo obliga |
| Language | English | Todo el texto dentro del juego se escribe en este idioma |
| Game Master Mode | Standalone GM | Standalone GM construye un GM por ti; Character GM usa una de tus tarjetas como GM |
| Visual Generation | Off | Actívalo para imágenes; necesita una conexión de generación de imágenes |
| Game Presentation | Standard | **Storyboard Optimized** usa el Storyboard Game Prompt para dar forma a la narración del GM; no instala ni activa el agente Storyboard |
| Music DJ | Off | Necesita Spotify o una carpeta de música local |
| Custom HUD Widgets | On | Usa widgets de estado hechos por IA del nuevo mundo |
| Start Muted | Off | Empieza la partida con el audio silenciado |

¿Nuevo en Game Mode? Deja **Game Master Mode** en **Standalone GM**. Marinara construye un GM justo y un poco sarcástico por ti, y así puedes tantear el modo antes de escribir una tarjeta de GM personalizada.

Elige **Storyboard Optimized** en el paso final cuando quieras que los turnos del GM se escriban como momentos visuales filmables. Esa presentación selecciona el preset integrado **Storyboard Game Prompt** para la narración del GM. No instala ni activa el agente Storyboard, no activa la generación de imágenes ni de video, no cambia tus conexiones y no reemplaza los valores predeterminados de planificador y de formateador del agente. Después de crear el Game, instala y activa Storyboard por separado y configura sus ajustes de fotogramas clave, planificador, imagen y video en **Chat Settings > Agents > Storyboards**.

La combinación alternativa de anime en toma única sigue disponible después de la configuración: elige **Anime Episode Director** para el Animation Planner y **Anime Game Video** para el Storyboard Video Prompt.

El editor **GM Prompt** previsualiza el prompt efectivo de la presentación seleccionada. Con **Storyboard Optimized** seleccionado, al abrir el editor se muestra el Storyboard Game Prompt, incluida su macro de conteo de fotogramas clave. Dejar ese texto sin cambios mantiene seleccionado el preset integrado; editarlo crea un prompt personalizado que anula el preset de la presentación.

## Los tres tipos de llamada de IA

Game Mode usa tres tipos distintos de llamada de IA. Conocerlos te ayuda a entender de dónde vienen el costo y los errores.

1. **World generation.** Esto se ejecuta una vez, cuando haces clic en **Start Game**. La conexión del GM devuelve un documento grande y estructurado en un formato llamado JSON. Ese documento contiene el resumen del mundo, el mapa inicial, los NPC, las hojas de juego de tu grupo y los widgets en pantalla. JSON es un formato de texto estricto que la IA debe devolver exactamente, o el juego no puede leerlo. Este es el paso más exigente, por lo que la elección de tu modelo importa más aquí.
2. **Gameplay turns.** Cada mensaje que envías construye un prompt nuevo con el estado actual. Luego el GM narra y actualiza el mundo. El cálculo de las rondas de combate lo hace el motor, no el modelo, para que los resultados sigan siendo justos y consistentes.
3. **Session summaries.** Cuando terminas una sesión, el GM escribe un resumen estructurado y notas de continuidad. Cuando empiezas una nueva sesión, escribe un mensaje puente corto para que el siguiente capítulo continúe con limpieza. Las sesiones antiguas se comprimen en resúmenes para que las campañas largas no saturen el modelo.

## Modos de destinatario: con quién estás hablando

La barra de entrada tiene un pequeño botón de globo de diálogo junto al botón de adjuntar archivos. Su tooltip (texto de ayuda) dice **Choose who to address** (Elige a quién te diriges). Este botón define a quién va tu mensaje, y tiene tres estados.

- De forma predeterminada, tu mensaje va a la escena. Es una acción o una línea de diálogo normal dentro del juego. El GM y tu grupo responden en la historia.
- **Talk to Party** añade un marcador `[To the party]` y habla directamente con tus compañeros. Úsalo para conversación táctica, como "¿Qué deberíamos hacer aquí?" Esta opción solo aparece cuando tu grupo no está vacío.
- **Talk to GM** añade un marcador `[To the GM]` y le pregunta al GM fuera de personaje. Úsalo para preguntas como "¿Mi personaje sabe algo del templo?" o para pedidos de ritmo.

El modo activo muestra un marcador **On** en el menú. Para desactivar **Talk to Party** o **Talk to GM**, haz clic otra vez en esa misma entrada del menú. Tus mensajes vuelven entonces a la escena.

<a id="optional-tool-planning-and-lore-searches"></a>

## Planificación opcional de herramientas y búsquedas de trasfondo

Durante la partida, abre **Chat Settings → Function Calling** (ajustes del chat → llamadas a funciones). **Let the GM search lore** (permitir que el GM busque trasfondo) permite buscar información por su significado sin activar todas las demás herramientas opcionales. Primero activa la vectorización de los lorebooks pertinentes y vectoriza sus entradas. Las búsquedas respetan los libros y las carpetas activados, así como los interruptores de entradas específicos del chat. Usan la conexión de embeddings configurada y pueden añadir una petición de seguimiento al modelo.

**Game tool connection** (conexión de herramientas del juego) usa por defecto **Same as narrator** (la misma que el narrador), que conserva el bucle normal de herramientas. Elegir otra conexión ejecuta una única petición de planificación independiente antes de la narración. Ese modelo elige las herramientas y el narrador recibe sus resultados reales como texto. La petición adicional se cobra en la conexión elegida; un modelo más barato puede reducir el coste de las herramientas, pero podría elegir otras. Este único paso de planificación no puede encadenar una segunda búsqueda a partir del primer resultado. Usa **Same as narrator** si quieres que el narrador razone durante varias rondas de herramientas.

Las conexiones de suscripción de Claude y Grok no admiten llamadas nativas a herramientas. Los controles afectados lo explican y permanecen desactivados hasta que se elige una conexión de herramientas de Game compatible. Los comandos de texto y las etiquetas de dados siguen funcionando. Si falta una conexión independiente o falla su petición, el turno informa del fallo en lugar de narrar en silencio sin el trabajo solicitado a las herramientas.

## Activar agentes

Los agentes son ayudantes de IA opcionales que se ejecutan junto al GM. Para usarlos en una partida, abre **Chat Settings** (Ajustes del chat) durante el juego, ve a la sección **Agents** y activa **Enable Agents**. Ejecutar agentes añade costo, porque hacen llamadas adicionales.

Hay dos agentes que conviene conocer para Game Mode:

- **Game Session Keeper** ayuda a mantener la continuidad entre tus sesiones.
- **Music DJ** elige la música de fondo. Necesita Spotify o una carpeta de música local.

Game Mode también usa **Review Agent Outputs** para que puedas revisar lo que produjo un agente. Para el panorama completo de los agentes, consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md).

## Elegir un modelo

La generación del mundo es la parte más difícil de Game Mode. Le pide al modelo un documento JSON largo y estricto sin campos faltantes. Un modelo que maneja bien el chat común puede aun así fallar en este paso.

Para la generación del mundo, usa un modelo de primer nivel, actual y capaz, en una conexión de pago. A partir de 2026, los jugadores reportan buenos resultados con los niveles insignia de los grandes proveedores. Algunos ejemplos son Anthropic Claude, OpenAI GPT y Google Gemini. Los nombres específicos de los modelos cambian a menudo, así que trata estos como ejemplos, no como una lista fija.

Para los turnos de juego en curso, a veces puedes bajar a un modelo más barato, porque los turnos piden narración en lugar de JSON estricto. Si el GM empieza a olvidar NPC o a contradecir detalles anteriores, vuelve a subir a un modelo más fuerte.

Evita los modelos gratuitos o de enrutamiento automático para la generación del mundo. Pueden enrutar a un modelo más pequeño que no puede producir un JSON de generación de mundo válido. Los modelos pequeños de pesos abiertos también suelen fallar en este paso.

Para la referencia completa de parámetros, consulta [Parámetros de generación](../prompts/generation-parameters.md).

## Dónde vive cada tema de juego

Esta guía te mete en una partida. Cada tema más avanzado tiene su propia guía:

- [Game Mode: combate](combat.md) cubre los encuentros, el menú de acciones, el cálculo de daño y los eventos de tiempo rápido.
- [Game Mode: grupo y NPC](party-and-npcs.md) cubre la barra del grupo, las hojas de personaje y el Adventure Journal.
- [Game Mode: sesiones y partidas guardadas](sessions-and-saves.md) cubre cómo terminar y empezar sesiones y el historial de sesiones.
- [Game Mode: mapa, tiempo y clima](map-time-weather.md) cubre las vistas del mapa y el reloj y clima automáticos.
- [Game Mode: dados y pruebas de habilidad](dice-and-skill-checks.md) cubre el menú de dados y las reglas de pruebas de habilidad.
- [Game Mode: widgets del HUD](hud-widgets.md) cubre los widgets de estado en pantalla.
- [Recursos del juego](game-assets.md) cubre la biblioteca de música, sonido, sprites y fondos.
- [Guía del agente Storyboard](storyboard.md) cubre la instalación además de los Storyboards de Roleplay y de Game Mode.

Las Author's Notes funcionan aquí igual que en otros modos. Consulta [Roleplay Mode: primeros pasos](../roleplay/getting-started.md).

## Solución de problemas

### La generación del mundo falla con un error de JSON o 422

La causa más común es que el modelo no pudo producir el JSON estructurado completo. Prueba esto en orden.

1. Revisa qué conexión está usando el GM. Si apunta a un modelo gratuito o de enrutamiento automático, cambia a un modelo de pago capaz.
2. Inténtalo de nuevo. Algunos fallos son puntuales, y la misma configuración funciona en un segundo intento.
3. Acorta un campo de ambientación o preferencias muy largo. Las entradas largas dejan al modelo menos espacio para la salida JSON.

Si una llamada casi funcionó pero el JSON quedó un poco roto, Marinara ofrece una ventana **Repair JSON**. Abre un editor con números de línea con la salida en bruto del modelo. Una línea de estado te dice si el JSON es válido o muestra el error de análisis. Haz clic en **Format** para ordenar el JSON válido. Luego haz clic en **Apply Repaired JSON** para usar tu versión corregida sin pagar por un reintento completo. La opción **Repair JSON** también aparece para los resúmenes de sesión y otras llamadas estructuradas.

Para más síntomas y soluciones, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

### El GM narra con alegría aunque hayas elegido un tono oscuro

Algunos modelos se mantienen animados sin importar el tono. Tienes dos opciones. Añade una instrucción clara en el campo de preferencias del asistente, como "mantén la narración sombría, no suavices los fracasos". O cambia a un modelo cuya voz predeterminada coincida con el tono que quieres.

## Guías relacionadas

- [Game Mode: combate](combat.md)
- [Game Mode: grupo y NPC](party-and-npcs.md)
- [Game Mode: sesiones y partidas guardadas](sessions-and-saves.md)
- [Game Mode: mapa, tiempo y clima](map-time-weather.md)
- [Game Mode: dados y pruebas de habilidad](dice-and-skill-checks.md)
- [Game Mode: widgets del HUD](hud-widgets.md)
- [Recursos del juego](game-assets.md)
- [Guía del agente Storyboard](storyboard.md)
- [Roleplay Mode: primeros pasos](../roleplay/getting-started.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Parámetros de generación](../prompts/generation-parameters.md)
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md)
