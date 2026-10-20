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

1. **Connection.** Elige el **Game Mode**: **Overworld RPG** o **Classic** (Clásica). Overworld RPG todavía no está listo, así que por ahora las partidas nuevas empiezan como **Classic**. Consulta [Classic u Overworld RPG](#classic-or-overworld-rpg). Define el nombre de la partida, elige la conexión del GM y, si quieres, define una conexión para los efectos de escena. Los efectos de escena usan de forma predeterminada **Local Model (Gemma)**.
2. **World.** Define el género, la ambientación, el tono, la dificultad, la clasificación de contenido y el idioma. Las ideas que se ofrecen para la ambientación, y más tarde para los objetivos, provienen de distintos tipos de ambientación, con una mezcla nueva cada vez que se abre el asistente. Elige **Classic** (Combate con menús) o **Tactical** (Combate en cuadrícula) en **Combat Preference** (Preferencia de combate). Las partidas Tactical también ofrecen semilla, tamaño e indicaciones de terreno opcionales para el campo de batalla. Si hay un conjunto de reglas Game Mode instalado, aparece **Rules** (Reglas) debajo: conserva **Marinara's own rules** (Las reglas propias de Marinara) o elige el conjunto. Consulta [Elegir las reglas](#choosing-rules). En Overworld RPG, debajo están **Setting kit** (Kit de ambientación) y **Your world** (Tu mundo). Consulta [Elegir un kit de ambientación](#choosing-a-setting-kit) y [Crear un mundo](#making-a-world).
3. **Party.** Elige tu persona (el personaje que interpretas), el **Game Master Mode** (modo del director del juego) y los miembros del grupo. **GM intro message** (Mensaje de introducción del GM) define el primer mensaje de la partida. Consulta [El mensaje de introducción del GM](#the-gm-intro-message).
4. **Goals.** Dile al GM qué esperas de la aventura.
5. **Lorebooks.** Adjunta los lorebooks (libros de trasfondo) cuyos datos el GM debe tratar como canon. Un lorebook es un conjunto de datos de trasfondo del mundo. Consulta [Lorebooks](../lorebooks/overview.md).
6. **Features.** Activa sistemas opcionales como Visual Generation, Music DJ y widgets del HUD. Los agentes instalables se pueden activar desde Chat Settings después de crear el Game.
7. **GM.** Elige el estilo de presentación y revisa las instrucciones avanzadas del GM antes de que se construya el mundo.

Cuando termines, haz clic en **Start Game**.

En partidas Tactical, dejar vacías las opciones del campo permite que el GM elija una descripción adecuada a la escena y que el motor genere el tablero. Una semilla fija reproduce la generación con las mismas entradas del encuentro; las indicaciones piden al GM elementos como un muro en ruinas o un claro del bosque. Consulta [Game Mode: Combate](combat.md#tactical-battles-and-terrain) para las reglas de movimiento, las bonificaciones del terreno y los errores de generación.

<a id="classic-or-overworld-rpg"></a>

### Classic u Overworld RPG

Una partida nueva se juega en uno de dos Game Modes, que se elige en el primer paso y se mantiene en todas las sesiones de la partida:

- **Overworld RPG** (el predeterminado cuando esté listo): un mundo creado para tu ambientación, que se recorre en un mapa del overworld, con pueblos que visitar, lugares que explorar y mazmorras a las que bajar. Necesita un kit de ambientación y un mundo; hasta que elijas un kit, se toma el de tu primer género (High fantasy para un género que no tiene uno), y se genera un mundo al azar para él.
- **Classic**: Game Mode como siempre ha sido. La historia se cuenta escena por escena, con el mapa de la escena y las batallas, y sin kit de ambientación, mundo, overworld, pueblos ni mapas de mazmorras.

Una partida creada antes de que existiera esta opción sigue jugándose como antes: con un mundo es una partida Overworld; sin él, una partida Classic.

Overworld RPG todavía se está terminando. Hasta que esté listo, su tarjeta aparece atenuada con la nota "Overworld games, with a setting kit and a generated world, are not ready yet. New games start as Classic games." Entonces todas las partidas nuevas son Classic, y las opciones de kit de ambientación y de mundo de abajo no aparecen. Describen las partidas de Overworld RPG.

<a id="choosing-rules"></a>

### Elegir las reglas

**Rules** solo aparece cuando hay al menos un conjunto de reglas instalado, y solo para una partida nueva. Es independiente de **Combat Preference**: uno decide cómo funcionan las pruebas y las fichas de personaje, y el otro decide cómo se muestran las batallas.

- **Marinara's own rules** es la opción predeterminada: las pruebas d20 integradas y la ficha de seis atributos.
- Un conjunto de reglas, como **5e (SRD 5.1)**, muestra un breve resumen de lo que cubre y una línea que dice qué harán las batallas. Un conjunto que resuelve sus propios combates lo indica. Uno que solo presta la ficha indica que las batallas usan el combate de Marinara con la salud, la energía y las habilidades propias de la ficha. Uno que no hace ninguna de las dos cosas indica que las batallas usan el combate de Marinara y nombra la **Combat Preference** que elegiste.

Cuando el conjunto de reglas resuelve sus propios combates, la pantalla de batalla es la de ese conjunto: el menú muestra los ataques y las habilidades propios de tu personaje, y cada uno indica lo que gasta de la economía de acciones y de las reservas propias del conjunto; el panel de debajo muestra el orden de turnos, la ronda, los estados de todos con los nombres propios del conjunto y lo que queda de cada presupuesto; y el registro muestra el cálculo real, como "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Cada acción se escribe en la ficha de personaje en el momento en que se produce, así que cerrar la pestaña a mitad del combate no hace perder nada, y después se le indica al Game Master que las cifras ya están resueltas. Si ese conjunto también indica cuánto vale una casilla del campo de batalla en su propia unidad de distancia, tu **Combat Preference** decide cómo se muestra el combate: **Classic** lo juega sin posiciones y **Tactical** lo juega en un tablero donde caminas, mides el alcance y la distancia en la propia unidad del conjunto y apuntas una forma a una casilla. Consulta [Combate](combat.md#games-whose-ruleset-resolves-its-own-fights). Un conjunto que no dice nada sobre la distancia conserva la preferencia y no la usa.

El conjunto de reglas se fija al crear la partida y se queda con esa partida. No se puede cambiar ni añadir más tarde.

Algunos conjuntos de reglas ofrecen **layers** (capas): variantes con nombre, como Low magic o Hard winter, que se muestran como interruptores debajo del conjunto con una línea que dice qué hace cada una. Una capa puede endurecer las dificultades, limitar una opción de la ficha de personaje, dejar fuera algunas entradas ya hechas del selector del editor de fichas y darle al Game Master instrucciones adicionales, también para el mundo que construye durante la configuración. Algunas capas se excluyen entre sí, y el asistente desactiva la que no puedes tener. Las capas quedan fijadas cuando empieza la partida, exactamente igual que el propio conjunto, y una ficha que ya usa algo que una capa retira lo conserva.

Los conjuntos de reglas vienen de dos lugares. Los oficiales se instalan desde **Download Agents**, donde están marcados con **Rules**. Los de la comunidad se importan desde un archivo o desde el repositorio de GitHub de quien los creó, y se archivan según su origen, como `local/ember-roads` o `alice/v20`. Importarlos usa el mismo interruptor **Allow custom Agent imports** (permitir importaciones de agentes personalizados) que los agentes importados. Mientras ese interruptor está desactivado, los conjuntos importados se dejan fuera de las partidas nuevas, y las partidas que ya usan uno siguen funcionando. Una partida con un conjunto importado siempre se juega con la versión exacta con la que se creó. Para escribir el tuyo, consulta [Escribir conjuntos de reglas de Game Mode](../extending/writing-rulesets.md).

Después de elegir un conjunto de reglas, el paso **Party** enumera tu persona y los miembros del grupo debajo de los selectores e indica quién **Has a sheet** (Tiene ficha) para él y quién **Starts on a blank sheet** (Empieza con una ficha vacía). Una ficha se añade en **Stats** (Estadísticas), en el editor de personajes o de personas (consulta [Fichas de conjuntos de reglas](../characters/colors-and-stats.md#ruleset-sheets)). La partida toma una copia de cada ficha cuando se genera el mundo. Nada de lo que cambias en la partida vuelve al personaje o a la persona. Un miembro sin ficha recibe una vacía con todos los valores en el predeterminado del conjunto; la generación del mundo nunca inventa puntuaciones.

Un archivo de configuración compartido recuerda su conjunto de reglas. Si importas uno y no tienes ese conjunto, o tienes una versión más antigua, el asistente te dice qué conjunto era y la partida usa las reglas propias de Marinara, salvo que lo instales y lo elijas.

<a id="choosing-a-setting-kit"></a>

### Elegir un kit de ambientación

Un **Setting kit** (Kit de ambientación) le da al Game Master las palabras con las que se escribe tu tipo de mundo: cómo se llaman sus lugares y lo grande que puede ser un asentamiento, sus tipos de facción, por qué puede ser conocido un lugar, cómo viaja la gente, cómo se llaman un año y un día, cómo nombra a su gente cada una de sus culturas, qué puede soltar un combate ganado, su dinero y las cosas cotidianas que vende, sus elementos, los lugares donde ocurren sus combates y qué familia de arte, música y sonidos usa (consulta [Recursos del juego](game-assets.md#a-settings-own-art-and-music)). También indica qué tipos de cambio tiene el mundo, como rivalidades, crímenes, guerras o desastres, y lo rápido que cambia por sí solo. Un tipo desactivado nunca se introduce como suceso de fondo, y una escena no escala hacia él, así que una riña puede quedarse en una riña.

Solo se ofrece para una partida nueva de Overworld RPG, que siempre tiene uno: hasta que elijas un kit, se toma el de tu primer género. Hay ocho para empezar: alta fantasía, wuxia y xianxia, época actual, época actual sobrenatural, los años veinte, cyberpunk, space opera y postapocalíptico. La época actual es tranquila de forma predeterminada, sin crimen, conflicto ni catástrofes y a un ritmo lento, pensada para historias cotidianas (slice of life).

Elegir un kit antes de haber elegido un género fija el género que encaja con él, como **Cyberpunk** para cyberpunk o **Wuxia** para wuxia y xianxia, y entonces las ideas de ambientación y de objetivos empiezan con las del kit. Un género que elegiste tú se queda como está.

Después de elegir uno, **Write it for my setting** (Escríbelo para mi ambientación) pide a tu conexión del Game Master que lo reescriba para el género, la ambientación y el tono que elegiste. Si lo que escribe el modelo no es coherente, se le pide una vez más indicándole los motivos, y luego el asistente te dice qué estaba mal y conserva el kit que tenías. **Change its words** (Cambiar sus palabras) abre todas las palabras del kit para editarlas. Una lista se escribe en una línea, separada por comas. Un kit con un problema, como un nombre vacío o ningún asentamiento, indica qué está mal, y la partida no puede empezar hasta que se corrija.

La partida conserva el kit con el que se creó. El Game Master lo lee en cada turno, y la generación del mundo usa sus palabras. Un archivo de configuración compartido también lleva su kit.

Una Experience puede incluir su propio **paquete de mapa**: un kit de ambientación, mapas ya hechos y sus propios mosaicos. Con esa Experience activada, la configuración muestra su kit como fijado (no hay kit que elegir) y, si incluye mapas, un **Map** (Mapa) entre el que elegir; la partida se juega en ese mapa y se dibuja con los mosaicos de la Experience. Desactivar la Experience te devuelve tus propias opciones.

**Download this kit** (Descargar este kit) guarda el kit como un archivo (`.worldkit.json`) para compartirlo, e **Import a kit file** (Importar un archivo de kit) lo vuelve a leer. **Import a world file** (Importar un archivo de mundo) trae un mundo completo de una vez (consulta más abajo).

<a id="making-a-world"></a>

### Crear un mundo

Con un kit de ambientación elegido, **Your world** (Tu mundo) dispone un mundo completo con las palabras del kit antes de que empiece la partida: sus regiones, asentamientos de todos los tamaños de la escala del kit, por qué es conocido cada lugar y los caminos entre ellos (carreteras, ríos, rutas marítimas, rutas de salto) con cuántos días dura cada trayecto. Toda partida nueva de Overworld RPG tiene uno, generado a partir de una semilla que puedes cambiar.

Un mundo se crea a partir de una **World seed** (Semilla del mundo). La misma semilla, el mismo kit y el mismo planteamiento siempre crean el mismo mundo, así que **Roll** (Tirar) te da otro y volver a escribir un número te devuelve uno anterior. La vista previa de debajo es el mundo con el que se jugará la partida: un pequeño mapa del terreno y sus asentamientos, dónde empieza el grupo y una lista de todos los asentamientos por región.

- **Start from this lore** (Empezar desde este trasfondo) lee los lorebooks que marques en busca de los lugares que mencionan y de los sucesos fechados que registran, cada uno conservado exactamente como lo dice el trasfondo, junto con las entradas de las que salió. **Build around the lore** (Construir alrededor del trasfondo) completa el mundo a su alrededor; **Only the lore's places** (Solo los lugares del trasfondo) no crea nada aparte de ellos.
- **Write the world's brief** (Escribir el planteamiento del mundo) pide a tu conexión del Game Master el resto: el presente cuando empieza la partida, los lugares principales, las facciones en torno a las que gira el presente (qué quiere cada una y quiénes son sus aliadas y rivales) y nombres para los lugares y las personas que genera el mundo, con el sonido y el orden propios de cada una de las culturas del kit. Los lugares del trasfondo se conservan escriba lo que escriba el modelo, y todo lo que no encaja con el kit se deja fuera y se cuenta, igual que los pocos nombres a los que los modelos recurren una y otra vez. **Change the brief** (Cambiar el planteamiento) abre sus palabras para editarlas, incluidos los nombres de pila y los apellidos de cada cultura.

Sin un planteamiento, el mundo es solo el kit y los lugares del trasfondo, y los lugares que genera van numerados hasta que un planteamiento les dé nombre.

Un mundo también tiene un pasado. Antes de que empiece la partida, el propio motor del mundo lo hace avanzar año a año desde su fundación: cada asentamiento se funda y crece hasta su tamaño actual, las facciones del planteamiento se fundan en sus sedes, ganan y pierden líderes, y se alían y se enemistan entre sí y, donde el mundo los tiene, los bandidos, las guerras y las hambrunas dejan su huella, y algunos lugares se pierden por ellos. Un cambio grave solo llega después de llevar un tiempo gestándose (tensión antes de una guerra, una sequía antes de una hambruna), y solo usa los tipos de cambio que permite el kit: el pasado de un mundo tranquilo también es tranquilo. Los sucesos fechados que indica tu trasfondo, o que nombra el planteamiento, ocurren cuando y donde dicen. La misma semilla y el mismo planteamiento siempre dan el mismo pasado.

Al Game Master se le cuentan los sucesos más destacados del pasado, quién controla el lugar donde está el grupo y quién dirige esa facción, y el pasado propio de ese lugar. Sobre cualquier otro lugar o facción puede preguntar, y recibe la respuesta en su siguiente turno.

Cada asentamiento tiene su gente, generada por la semilla cuando el grupo llega allí: más en los lugares más grandes, cada persona con un nombre de la lista de su propia cultura, un oficio acorde con aquello por lo que es conocido el lugar, un temperamento, lo que le importa, cómo habla y qué aspecto tiene, y algunas que vinieron de otra parte. Al Game Master se le muestran algunas personas del lugar actual que el grupo no conoce, y presenta a una de ellas cuando alguien nuevo entra en la escena. Alguien a quien nombra por su nombre completo se une a los personajes registrados de la partida con lo que hace y su aspecto, para distinguir a dos personas que comparten nombre. Sin las listas de nombres de un planteamiento, la gente se identifica por su oficio.

Durante el juego, el Game Master siempre sabe dónde está el grupo, adónde puede ir desde allí y cuánto tarda cada camino. Indica adónde va el grupo con una etiqueta de lugar. Un lugar que figura en el mundo conserva el tamaño que le dio el mundo. Con un conjunto de reglas con mercados, también toma el tamaño correspondiente en la escala del mercado, así que la capital de un mundo es el lugar más grande del mercado. Un lugar que no figura en el mundo, como una granja o un campamento, conserva el nombre que le da el Game Master. Una vez que empieza la partida, el pasado del mundo queda fijado. Su disposición también queda fijada, salvo por las ediciones manuales (consulta más abajo). Un archivo de configuración compartido lleva el mundo tal como se creó al principio.

Lo que el grupo hace al mundo queda hecho. Cuando el grupo ayuda o perjudica a una facción, hace que dos facciones sean amigas o enemigas, se pone del lado de una facción o la traiciona, mejora o daña un lugar, toma un lugar para una facción, destruye una facción, pone a alguien al frente de una facción o lleva un lugar a la ruina, el Game Master lo registra en su respuesta, igual que registra un lugar o una facción que introduce la historia. Cada cambio se comprueba con el mundo: se rechaza un cambio de un tipo que el kit tiene desactivado, como una guerra en un mundo acogedor de época actual, o uno que nombra un lugar o una facción que el mundo no tiene. A partir de entonces, al Game Master se le cuenta el mundo tal como lo dejó la historia: cómo va el lugar, quién lo controla y quién dirige esa facción, qué hizo allí el grupo, la reputación del grupo con cada facción con la que ha tratado y qué ha cambiado desde que empezó el juego. Un lugar que añadió la historia es un lugar al que el grupo puede ir. Un cambio pertenece a la respuesta que lo hizo, así que un swipe, una regeneración o un mensaje eliminado lo deshacen junto con esa respuesta.

El mundo también sigue adelante sin el grupo. Cuando el Game Master dice que pasa el tiempo (un viaje, una noche de descanso, una larga espera), el mundo da sus propios pasos, una semana cada vez, y solo en los tipos de cambio que tiene el kit: las fortunas suben y bajan, se instalan recién llegados, las facciones se acercan o se vuelven rivales, los líderes dejan su puesto y, donde el mundo los tiene, los problemas alcanzan a los lugares que pasan por malos tiempos y la tensión entre dos facciones puede convertirse en guerra tras una estación de ir en aumento. Las catástrofes nunca llegan solas; solo el Game Master puede narrar una, igual que cualquier suceso ajeno al grupo, y se rechaza si su tipo está desactivado. Nada se decide donde está el grupo: algo a punto de ocurrir allí se deja para que lo resuelva la escena. Las noticias viajan: el Game Master se entera de un cambio una vez que han pasado los días que tardan los caminos, como un rumor lejano, y ve lo que se está gestando cerca, para que el grupo pueda intervenir. Solo puede contener una guerra que se está gestando cuando no tiene sentido para el mundo o arruinaría la partida sin una oportunidad real de que el grupo la detenga. Las hazañas del grupo cuentan más a medida que se da a conocer: la ayuda de un desconocido cambia poco; la de un grupo famoso, mucho.

Un mundo también puede conservar **ediciones manuales**. Son cambios que haces con un editor de mundos, una herramienta que cambia un mundo después de crearlo. Puedes renombrar o mover lugares, pintar el terreno y añadir lugares y personas. También puedes pintar el campo de batalla táctico de un lugar (consulta [Combate](combat.md#tactical-battles-and-terrain)) y trazar un pueblo a mano (consulta [El pueblo](map-time-weather.md#the-town)). Todas las partes del juego ven las ediciones al instante: el Game Master, el overworld, los pueblos y la pestaña World. Un lugar renombrado sigue respondiendo a su nombre anterior, y al Game Master se le dice cómo se llamaba antes.

Las ediciones manuales cambian el mundo de ahora en adelante, nunca su pasado. El pasado del mundo y los cambios que hizo por sí solo se quedan como estaban. Un asentamiento que añades se queda tal como lo añadiste. Un pueblo conserva su trazado, así que los lugares y las personas que añades van a sus siguientes parcelas libres y a sus siguientes viviendas libres.

Un mundo puede viajar como archivo. **Download this world** (Descargar este mundo), en **Your world**, guarda el mundo que estás creando, y **Download the world** (Descargar el mundo), en la pestaña World de una partida, guarda el mundo de esa partida, con sus ediciones manuales incluidas, como un archivo `.world.json`. **Import a world file** (junto al kit de ambientación) lo lee en la configuración de una partida nueva: elige el kit de ambientación del archivo y crea su mundo, con sus ediciones manuales. **Your worlds** (Tus mundos) hace lo mismo con un mundo guardado en tu biblioteca, como uno creado fuera de cualquier partida con un creador como Pixelforge.

Un archivo de mundo también puede llevar la **historia** del mundo: los sucesos y las escenas que escribió para él quien lo creó. La historia viene con el mundo y se conserva en las mismas condiciones. Durante el juego, las escenas de una historia aparecen en la narración antes de la respuesta del Game Master, exactamente como se escribieron. Sus objetivos de misión aparecen en **Story** (Historia), en la pestaña World del diario, una vez que la historia los muestra. Para escribir una, consulta [Escribir guiones de historia de Game Mode](../extending/writing-story-scripts.md).

Las ediciones manuales y la historia se hicieron para esa semilla y ese planteamiento, así que se dejan fuera si cambias cualquiera de los dos. Si un archivo no se puede leer, se rechaza y el asistente dice por qué. Un archivo de mundo también lleva el mundo tal como se creó, así que un mundo creado por otra versión del creador de mundos se abre exactamente como se creó. Un archivo más antiguo que no lo lleva se rechaza. Si algo del archivo no encaja con el kit de ambientación, se deja fuera y el asistente dice qué.

A una partida creada sin mundo antes de que existiera la opción de Game Mode se le puede dar uno más adelante, solo si quieres: la pestaña **World** (Mundo) del diario ofrece **Make a world for this game** (Crear un mundo para esta partida), con las mismas opciones de kit de ambientación y de mundo que una partida nueva. El mundo empieza a partir del siguiente turno; los turnos pasados, el mapa y la gente de la partida se quedan como están. Mientras Overworld RPG no esté listo, el botón aparece atenuado con la misma nota que la configuración.

Una partida conserva su mundo tal como se creó. Los lugares, las personas, los pueblos y el pasado se guardan con la partida cuando empieza y cada vez que se guardan sus ediciones manuales, así que una actualización que cambie cómo se crean los mundos nunca cambia un mundo que ya está en juego. Una sesión nueva, una rama y un chat exportado conservan el mismo mundo, y cómo avanzó el mundo en sesiones anteriores (sus fortunas, sus gobernantes y sus guerras) se conserva tal como sucedió. Un mundo creado por una versión anterior del generador de mundos sigue jugándose tal como se creó, pero ya no se puede editar.

Una partida con un mundo se abre en el **overworld** (el mapa del mundo), el mundo dibujado como un mapa de píxeles donde puedes llevar al grupo de asentamiento en asentamiento por los caminos del mundo y entrar en el pueblo donde está; la vista de escena está a un solo cambio. Consulta [El overworld](map-time-weather.md#the-overworld).

<a id="the-gm-intro-message"></a>

### El mensaje de introducción del GM

**GM intro message** (Mensaje de introducción del GM), en el paso **Party**, decide cómo empieza la partida:

- **None** (Ninguno), el predeterminado: el Game Master abre la partida como le parezca.
- **Defined** (Definido): escribe el primer mensaje exactamente como debe leerse. La partida empieza exactamente con este mensaje, y regenerarlo da el mismo texto.
- **Guided** (Guiado): describe cómo debe ir el inicio, por ejemplo dónde empieza, quién está allí y qué ocurre primero. El Game Master escribe el inicio a partir de ello.

El texto puede tener hasta 8.000 caracteres. No puede contener llaves dobles, y el texto **Guided** tampoco puede contener corchetes. El campo indica cuándo no se puede usar el texto. La historia de un mundo puede traer su propia introducción. Cuando la historia la bloquea, el campo la muestra con "Set by this Experience and locked, so the game opens as its creator meant." y no se puede cambiar.

### Valores predeterminados que conviene conocer

Estos son los valores iniciales en los pasos **World**, **Party** y **Features**. Puedes cambiar cualquiera de ellos.

| Opción | Predeterminado | Notas |
|---|---|---|
| Genre | Fantasy | Selección múltiple, más tus propias entradas personalizadas; un kit de ambientación elegido primero fija el suyo |
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

Los chats Game requieren **Let the GM search lore** para consultar lorebooks mediante herramientas, incluso con **Enable Tool Use** activado. Mientras esté desactivado, `search_lorebook` no estará disponible en el selector de herramientas. Una entrada ya seleccionada permanece visible con una explicación para que puedas quitarla o volver a activar la búsqueda de lore.

**Game tool connection** (conexión de herramientas del juego) usa por defecto **Same as narrator** (la misma que el narrador), que conserva el bucle normal de herramientas. Elegir otra conexión ejecuta una única petición de planificación independiente antes de la narración. Ese modelo elige las herramientas y el narrador recibe sus resultados reales como texto. La petición adicional se cobra en la conexión elegida; un modelo más barato puede reducir el coste de las herramientas, pero podría elegir otras. Este único paso de planificación no puede encadenar una segunda búsqueda a partir del primer resultado. Usa **Same as narrator** si quieres que el narrador razone durante varias rondas de herramientas (hasta cuatro por turno; después narra con los resultados que tenga).

Las conexiones de suscripción de Claude y Grok no admiten llamadas nativas a herramientas. Los controles afectados lo explican y permanecen desactivados hasta que se elige una conexión de herramientas de Game compatible. Los comandos de texto y las etiquetas de dados siguen funcionando. Si falta una conexión independiente o falla su petición, el turno informa del fallo en lugar de narrar en silencio sin el trabajo solicitado a las herramientas.

**Finish rolled turns in one request** (Terminar turnos con dados en una sola solicitud) cambia el segundo tipo de llamada descrito arriba. Un turno con tiradas normalmente cuesta dos solicitudes: el borrador y una reescritura con las cifras reales. Al activarlo, el GM escribe el desenlace a ciegas y el motor añade los números después, por lo que cuesta una solicitud. Está desactivado de forma predeterminada. Dos cosas todavía añaden otra solicitud: llamar a la herramienta de dados con **Enable Tool Use** activado y una **Game tool connection** separada, que siempre hace su propia planificación. Consulta [Game Mode: Dados y pruebas de habilidad](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

Si tus modelos locales comparten una memoria GPU limitada, abre **Chat Settings → Agents** y activa **Run Game tasks one at a time** (ejecutar tareas Game de una en una). La narración, los agentes y los medios de la escena esperan unos a otros dentro de ese chat Game. La opción empieza desactivada y no reserva la GPU frente a otros chats o aplicaciones. Los controles de cancelación existentes siguen disponibles durante la ejecución y la espera.

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

<a id="the-games-controls"></a>

## Los controles del juego

En una computadora, los controles del juego se abren con los botones cercanos a la esquina superior derecha del chat. En un teléfono, búscalos en el menú móvil de tres puntos **Chat tools** (Herramientas del chat):

- **Game controls** (el mando de juego):
  - **Retry turn**, **Retry scene analysis**, **Retry Music DJ** cuando Music DJ pone la música del juego, y **Retry assets image generation**.
  - Si un storyboard se reproduce como fondo del juego, también ofrece repetir, reproducir/pausar y silenciar.
  - En una partida con un mundo, **Show the scene** (Mostrar la escena) y **Show the overworld** (Mostrar el overworld) cambian de vista, y **Show the map** (Mostrar el mapa) vuelve a un mapa abierto de mazmorra, cueva o estación.
  - **Edit game data** (Editar datos del juego) corrige a mano los datos guardados de la partida (consulta [Editar los datos del juego a mano](sessions-and-saves.md#editing-game-data-by-hand)), y **Checkpoints** (Puntos de control) devuelve la partida a un momento anterior (consulta [Cómo se guarda tu juego](sessions-and-saves.md#how-your-game-saves)).
- **Session** (la pluma): historial de sesiones, diario y controles de sesión. Consulta [Game Mode: sesiones y guardado](sessions-and-saves.md).
- **Volume** (el altavoz): volumen de **Master**, **Music**, **Sound Effects**, **TTS** y **Ambient**.
- **Game Assets** (la carpeta): medios de la escena y Asset Browser. Consulta [Recursos del juego](game-assets.md).
- **Connected chat**, cuando el juego está enlazado a Conversation. Consulta [Chats conectados](../chats/connected-chats.md#switching-between-connected-chats).

Elige una herramienta para abrir sus controles en una ventana móvil en computadora o en un panel de ancho completo en teléfono. En una computadora, arrastra su botón para moverlo. En un teléfono, mueve el menú de tres puntos, o desbloquéalo para reordenar las herramientas que contiene. Al cerrar la ventana o el panel, puedes volver a abrir la herramienta desde el mismo lugar. Consulta [Ventanas de controles y sus botones](../chats/chat-settings.md#control-windows-and-their-buttons).

También puedes guardar estos controles dentro de **Chat Settings**. Abre la ventana de un control y elige **Put back in Chat Settings**; aparecerá allí como sección desplegable. Su botón para sacarla vuelve a darle una ventana propia. Cada juego guarda tu elección y **Reset View** restaura la disposición inicial: botones en una computadora, o entradas de Chat tools en un teléfono.

**Character Profiles** (Perfiles de personajes) se queda fuera de Chat tools tanto en computadoras como en teléfonos. Arrastra su botón de retrato adonde quieras y luego ábrelo para elegir un miembro del grupo y ver o editar su hoja de personaje. En los teléfonos, **Map** (Mapa) también tiene su propio botón móvil. Ambos siguen el estilo de tus widgets de chat, guardan sus posiciones para esta partida y se pueden bloquear desde su ventana abierta. El mapa de escritorio conserva sus controles de panel de mapa actuales.

## Dónde vive cada tema de juego

Esta guía te mete en una partida. Cada tema más avanzado tiene su propia guía:

- [Game Mode: combate](combat.md) cubre los encuentros, el menú de acciones, el cálculo de daño y los eventos de tiempo rápido.
- [Game Mode: grupo y NPC](party-and-npcs.md) cubre Character Profiles, las hojas de personaje y el Adventure Journal.
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
