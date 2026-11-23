# Partidas Overworld (sin publicar)

Solo notas para desarrolladores. Las partidas **Overworld** (kits de ambientación, mundos generados, el mapa del overworld, pueblos y mapas de mazmorras) aún no están implementadas para los jugadores. Nada de esto es documentación de usuario: Professor Mari y la página Docs de la app no leen `docs/development` (salvo las pocas guías que enumeran), así que mantén el material de Overworld en este archivo hasta que se publique el modo. Cuando se publique, devuelve estas secciones a las guías para jugadores de `docs/game/`.

El modo permanece bloqueado salvo que el servidor configure esta opción. No la documentes en `docs/CONFIGURATION.md` ni en `.env.example` mientras el modo esté sin terminar.

| Variable | Valor predeterminado | Descripción |
| --- | --- | --- |
| `MARINARA_OVERWORLD_GAMES` | `false` | Permite que los jugadores creen partidas Overworld (un kit de ambientación y un mundo generado) y conviertan una partida heredada en una. Si está desactivado, el asistente solo ofrece partidas VN. |

## Configuración: modo de juego, kit de ambientación y mundo

### VN u Overworld

Una partida nueva se juega en uno de dos modos de juego, que se elige en el primer paso y se mantiene en todas sus sesiones:

- **Overworld** es un mundo creado para tu ambientación, que se recorre en un mapa del overworld, con pueblos, lugares que explorar y mazmorras. Necesita un kit de ambientación y un mundo. Hasta que elijas un kit, se usa el de tu primer género (High fantasy si el género no tiene uno), y se genera un mundo al azar para él.
- **VN** es Game Mode como siempre ha sido, contado como una novela visual: escena por escena, con el mapa de la escena y las batallas, y sin kit de ambientación, mundo, overworld, pueblos ni mapas de mazmorras.

Overworld está bloqueado salvo que quien administra el servidor defina `MARINARA_OVERWORLD_GAMES`. Mientras está bloqueado, su tarjeta aparece atenuada con la nota "Las partidas Overworld, con un kit de ambientación y un mundo generado, todavía no están listas. Las partidas nuevas empiezan como partidas VN." Entonces todas las partidas nuevas son VN, y las opciones de kit de ambientación y de mundo no aparecen. Una partida creada antes de que existiera esta opción sigue jugándose como antes: con un mundo es una partida Overworld; sin él, una partida VN.

### Elegir un kit de ambientación

Un **Setting kit** (Kit de ambientación) le da al GM las palabras con las que se escribe tu tipo de mundo: los nombres de los lugares y los tamaños de los asentamientos, los tipos de facción, cómo viaja la gente, cómo se llaman un año y un día, cómo nombra cada cultura a su gente, el dinero y los bienes, los elementos, los lugares de batalla y qué familia de arte y música usa (consulta [Recursos del juego](#art-and-music-families)). También indica qué tipos de cambio permite el mundo, como rivalidades, crímenes, guerras o desastres, y lo rápido que cambia. Un tipo desactivado nunca se introduce, así que una riña puede quedarse en una riña.

Hay ocho kits: alta fantasía, wuxia y xianxia, época actual, época actual sobrenatural, los años veinte, cyberpunk, space opera y postapocalíptico. La época actual es tranquila de forma predeterminada, sin crimen, conflicto ni catástrofes, y a un ritmo lento.

- Elegir un kit antes que un género fija el género que encaja con él. Un género que elegiste tú se queda como está.
- **Write it for my setting** (Escríbelo para mi ambientación) pide a tu modelo del GM que reescriba el kit para tu género, tu ambientación y tu tono. Si el resultado no es coherente, se le pide una vez más al modelo indicándole los motivos. Si sigue fallando, el asistente te dice qué estaba mal y conserva el kit que tenías.
- **Change its words** (Cambiar sus palabras) abre todas las palabras del kit. Escribe una lista en una línea, separada por comas. Un kit con un problema, como un nombre vacío o ningún asentamiento, indica qué está mal, y la partida no puede empezar hasta que se corrija.
- **Download this kit** (Descargar este kit) guarda un archivo `.worldkit.json` para compartirlo. **Import a kit file** (Importar un archivo de kit) vuelve a leer uno.

La partida conserva el kit con el que se creó, y un archivo de configuración compartido lo lleva consigo. Una Experience puede incluir su propio paquete de mapa (un kit, mapas ya hechos y mosaicos). Con esa Experience activada, la configuración muestra su kit como fijado y, si incluye mapas, un **Map** (Mapa) que elegir. Desactivar la Experience te devuelve tus opciones.

### Crear un mundo

Con un kit elegido, **Your world** (Tu mundo) dispone un mundo con las palabras del kit antes de que empiece la partida: las regiones, asentamientos de todos los tamaños, por qué es conocido cada lugar y los caminos entre ellos (carreteras, ríos, rutas marítimas, rutas de salto) con la duración de cada trayecto en días.

Un mundo se crea a partir de una **World seed** (Semilla del mundo). La misma semilla, el mismo kit y el mismo planteamiento siempre crean el mismo mundo. **Roll** (Tirar) te da otro, y volver a escribir un número te devuelve uno anterior. La vista previa muestra un pequeño mapa del terreno y los asentamientos, dónde empieza el grupo y una lista de los asentamientos por región.

- **Start from this lore** (Empezar desde este trasfondo) lee los lorebooks marcados en busca de los lugares y los sucesos fechados que mencionan, conservados exactamente como están escritos. **Build around the lore** (Construir alrededor del trasfondo) completa el mundo a su alrededor. **Only the lore's places** (Solo los lugares del trasfondo) no crea nada aparte de ellos.
- **Write the world's brief** (Escribir el planteamiento del mundo) pide a tu modelo del GM el presente, los lugares principales, las facciones en torno a las que gira el presente (qué quiere cada una, y sus aliadas y rivales) y nombres para los lugares y las personas con el sonido propio de cada cultura. Los lugares del trasfondo se conservan escriba lo que escriba el modelo. Todo lo que no encaja con el kit se deja fuera y se cuenta. **Change the brief** (Cambiar el planteamiento) abre sus palabras, incluidos los nombres de pila y los apellidos de cada cultura. Sin un planteamiento, los lugares van numerados y la gente se identifica por su oficio.

**Un mundo tiene un pasado.** Antes de que empiece la partida, el mundo avanza año a año desde su fundación. Los asentamientos crecen, las facciones se fundan, ganan y pierden líderes, y se alían y se enemistan entre sí. Donde el mundo los tiene, los bandidos, las guerras y las hambrunas dejan su huella. Un cambio grave solo llega después de llevar un tiempo gestándose, y solo de los tipos que permite el kit. Los sucesos fechados de tu trasfondo o del planteamiento ocurren cuando y donde dicen. La misma semilla y el mismo planteamiento dan el mismo pasado.

**Lo que sabe el GM.** El GM siempre sabe dónde está el grupo, adónde puede ir y cuánto tarda cada camino. Se le cuentan los sucesos más destacados del pasado, quién dirige el lugar actual y el pasado de ese lugar. Sobre cualquier otro lugar o facción puede preguntar, y recibe la respuesta en su siguiente turno. Indica adónde va el grupo con una etiqueta de lugar. Un lugar que figura en el mundo conserva el tamaño que le dio el mundo. Un lugar que no figura en el mundo, como una granja, conserva el nombre que le da el GM. Cada asentamiento tiene gente generada por la semilla cuando llega el grupo: un nombre de su cultura, un oficio acorde con el lugar, un temperamento, una forma de hablar y un aspecto. Cuando el GM nombra a alguien por su nombre completo, esa persona se une a los personajes registrados.

**Lo que hace el grupo queda hecho.** Cuando el grupo ayuda o perjudica a una facción, cambia lo que sienten dos facciones entre sí, toma o arruina un lugar o pone a alguien al frente de una facción, el GM lo registra en su respuesta. Cada cambio se comprueba con el mundo. Se rechaza un cambio de un tipo que el kit tiene desactivado, o uno que nombra un lugar o una facción que el mundo no tiene. A partir de entonces, al GM se le cuenta el mundo tal como lo dejó la historia. Un lugar que añadió la historia es un lugar al que el grupo puede ir. Un swipe (respuesta alternativa), una regeneración o un mensaje eliminado deshacen un cambio junto con su respuesta.

**El mundo sigue adelante sin el grupo.** Cuando el GM dice que pasa el tiempo, el mundo avanza una semana cada vez, solo en los tipos de cambio que tiene el kit. Las catástrofes nunca llegan solas: solo el GM puede narrar una, y se rechaza si su tipo está desactivado. Nada se decide donde está el grupo. Las noticias viajan: el GM se entera de un cambio lejano una vez que han pasado los días que tardan los caminos. Las hazañas del grupo cuentan más a medida que se da a conocer.

**Ediciones manuales.** En un editor de mundos puedes renombrar o mover lugares, pintar el terreno, añadir lugares y personas, pintar el campo de batalla táctico de un lugar (consulta [Combate](../game/combat.md#tactical-battles-and-terrain)) y trazar un pueblo (consulta [El pueblo](#the-town)). Todas las partes del juego ven las ediciones al instante. Un lugar renombrado sigue respondiendo a su nombre anterior. Las ediciones cambian el mundo de ahora en adelante, nunca su pasado. Un pueblo conserva su trazado, así que los lugares y las personas que añades van a sus siguientes parcelas libres y viviendas.

**Archivos de mundo.** **Download this world** (Descargar este mundo), en **Your world**, guarda el mundo que estás creando, y **Download the world** (Descargar el mundo), en la pestaña World de una partida, guarda el mundo de esa partida con sus ediciones manuales como un archivo `.world.json`. **Import a world file** (Importar un archivo de mundo), junto al kit de ambientación, lo lee en la configuración de una partida nueva: elige el kit del archivo y crea su mundo. **Your worlds** (Tus mundos) hace lo mismo con un mundo de tu biblioteca. Un archivo también puede llevar la historia del mundo: los sucesos y las escenas que escribió quien lo creó. Las escenas de una historia aparecen en la narración antes de la respuesta del GM, exactamente como se escribieron, y sus objetivos de misión aparecen en **Story** (Historia), en la pestaña World del diario. Para escribir una, consulta [Escribir guiones de historia de Game Mode](writing-story-scripts.md). Las ediciones manuales y la historia pertenecen a esa semilla y ese planteamiento, así que se dejan fuera si cambias cualquiera de los dos. Un archivo que no se puede leer se rechaza y el asistente dice por qué. Si el contenido de un archivo no encaja con el kit, una parte se deja fuera y el asistente dice cuál.

**Más adelante, y lo que se conserva.** A una partida creada sin mundo se le puede dar uno más adelante desde la pestaña **World** (Mundo) del diario, con **Make a world for this game** (Crear un mundo para esta partida). El mundo empieza a partir del siguiente turno, y los turnos pasados, el mapa y la gente se quedan como están. El botón aparece atenuado mientras Overworld RPG está bloqueado. Una partida conserva su mundo tal como se creó, así que una sesión nueva, una rama y un chat exportado conservan el mismo mundo. Un mundo creado por una versión anterior del generador sigue jugándose, pero ya no se puede editar.

Una partida con un mundo se abre en el **overworld** (el mapa del mundo): un mapa de píxeles donde llevas al grupo de un asentamiento a otro y entras en los pueblos. Consulta [El overworld](#the-overworld).

## Mapas

### El overworld

Un juego con un mundo generado (consulta [Crear un mundo](#making-a-world)) se abre en el **overworld**: el terreno del mundo dibujado como un mapa de píxeles detrás de la narración, con bosques, colinas, costas y mares, los caminos y rutas entre los asentamientos, cada asentamiento dibujado según su tamaño, y tu grupo. Los lugares más grandes llevan su nombre, y también el lugar en el que estás. Arrastra el mapa para mirar alrededor.

1. Toca o haz clic en un asentamiento, o elígelo en **Places** (Lugares: primero los más cercanos, con la duración del viaje).
2. Lee su tamaño y el viaje desde donde estás: días u horas, y por qué rutas.
3. Haz clic en **Walk there** (Ir caminando). El grupo va por las rutas del mundo por el camino más rápido, y los días de la caminata pasan en el reloj de inmediato.

Tu siguiente turno le cuenta al GM adónde caminaste, cuánto tardaste y por qué rutas, para que pueda narrar la llegada. Una segunda caminata antes de tu siguiente turno continúa desde donde terminó la primera.

Las cuevas, minas, criptas y ruinas a pocos pasos de un asentamiento se dibujan como **sitios**. Un mundo nuevo tiene uno o dos en cada región, con el nombre del asentamiento que tienen al lado ("Hollin Caves", "Ashby Ruins"). **Walk there** va por las rutas hasta su asentamiento y luego a pie fuera del camino. En un sitio, **Enter** (Entrar) abre su mapa (consulta [Mazmorras, cuevas y estaciones](#dungeons-caves-and-stations)). Un sitio que importa para la historia sigue **cerrado** (atenuado, sin viaje y sin entrada) hasta que el GM lo abre. Un creador de mundos también puede ocultar un sitio hasta entonces o abrirlo desde el principio.

Un lugar en ruinas se dibuja en ruinas. Al anochecer el mapa se oscurece y se encienden las ventanas. Cada familia de ambientación (fantasía, wuxia, época actual, los años veinte, ciencia ficción, el páramo) tiene sus propios mosaicos. Un kit sin familia dibuja mosaicos sencillos.

Para cambiar de vista, usa **Show the scene** (Mostrar la escena) y **Show the overworld** (Mostrar el overworld) en **Game controls** (Controles del juego); en un teléfono, están en el menú de tres puntos **Chat tools**. El juego recuerda tu elección. Un combate y la repetición de una sesión usan sus propias pantallas.

### Paquetes de mosaicos

Los paquetes de mosaicos guardan la paleta y cada mosaico (cada tipo de terreno, los asentamientos por tamaño, el grupo, y las calles, los tejados y los habitantes de un pueblo) como filas de píxeles. Cada familia de ambientación tiene un paquete integrado. Abre el panel **Agents** (Agentes) y busca **Tile packs** (Paquetes de mosaicos) para:

- elegir con qué paquete se dibuja cada ambientación (**Built in** (Integrado), es el suyo propio),
- usar **Import a tile pack** (Importar un paquete de mosaicos) con un archivo `.tilepack.json`,
- usar **Export** (Exportar) para compartir un paquete, o **Remove** (Quitar) para quitarlo, lo que devuelve a sus propios mosaicos cualquier ambientación dibujada con él.

Un paquete solo necesita los mosaicos que cambia, y todo lo que deja fuera se dibuja sencillo. Un paquete que nombra un mosaico que Marinara no dibuja conserva el resto e indica lo que dejó fuera.

### El pueblo

En un asentamiento, elígelo en el overworld y elige **Enter** para ver el pueblo. Está trazado a partir del mundo: calles y una plaza, los lugares que el mundo o la historia tienen en él (con su nombre en sus edificios), un gran salón en un lugar más grande, talleres de los oficios por los que es conocido el lugar, y casas. La gente está donde la pone la hora: trabajando de día, en la plaza al atardecer, en casa de noche.

Elige un edificio o la plaza, o elige en **Places in town** (Lugares del pueblo), para ver quién está allí y a cuántos minutos queda. **Walk there** cruza el pueblo a lo largo de las calles, rodeando los edificios y todo lo que pintó un trazado a mano, y cruzando sus puentes. Los minutos pasan en el reloj, y tu siguiente turno le cuenta al GM adónde fue el grupo y quién está allí. Una visita a un lugar con nombre, como una posada que añadió la historia, lo convierte en el lugar actual del grupo. **Leave town** (Salir del pueblo) vuelve al overworld. El juego recuerda en qué vista estabas.

Un pueblo se puede **trazar a mano** con un editor de mundos como Pixelforge, como parte de las ediciones a mano del mundo.

- Los edificios se pueden mover a otras parcelas. Un edificio movido a la parcela de otro se intercambia con él, y todos los edificios siguen dando a una calle.
- El suelo se puede pintar con calles, pavimento, terreno abierto, árboles o un pozo, pero nunca bajo un edificio, delante de su puerta, en medio de la plaza ni bajo un puesto de mercado.
- Quién vive y trabaja dónde nunca cambia, y una caminata hasta un edificio movido se cronometra desde su nueva puerta.
- El editor rechaza un trazado que no encaja con el pueblo y explica por qué. Los lugares que la historia añade durante la partida siguen encontrando una parcela.
- Un trazado también puede colocar edificios fuera de las parcelas, pintar campos, caminos de tierra, agua con puentes y setos, y colocar decoraciones. La vista del pueblo los dibuja todos (las decoraciones, solo con un paquete de imágenes que las tenga).

### Mazmorras, cuevas y estaciones

Cuando la historia baja bajo tierra o sube a bordo, el GM puede abrir un **mapa del lugar**: una mazmorra, una cueva o una estación, dibujado sobre la escena. Se traza a partir del juego y del nombre del lugar, así que el mismo lugar siempre tiene las mismas salas, y volver conserva el mapa como estaba. El GM elige un aspecto entre once: cuevas de roca, hielo, cristal y lava; una cripta, una alcantarilla y un templo; y los pasillos, el laboratorio, la cubierta de motores y la hidroponía de una estación. Con un paquete de mosaicos para ese aspecto, el mapa usa su arte. Sin uno, usa colores sencillos.

Un lugar del pueblo al que el grupo puede bajar (una cueva, una mina, una cripta, una alcantarilla o una ruina, según su nombre, o en ciencia ficción una nave abandonada o un búnker) muestra **Go down** (Bajar) cuando el grupo está allí.

- Abre el mismo mapa cada vez, y al salir el grupo vuelve al pueblo.
- Mientras el grupo esté en otro mapa, sal primero de ese.
- Un lugar también puede tener un mapa hecho a mano con un editor de mundos como Pixelforge. Entonces **Go down** abre ese mapa, se llame como se llame el lugar, dibujado con el paquete que nombra. En un mapa así, la salida está donde entró el grupo, los objetos decorativos nunca bloquean el paso, y la gente está en puntos con nombre a las horas que el mapa les da. Al GM se le dice quién está allí.

Haz clic en un lugar del mapa, o usa las teclas de flecha, para ir caminando hasta allí por el camino más corto. Los minutos pasan en el reloj (aproximadamente un minuto por cada treinta pasos), y tu siguiente turno le cuenta al GM desde qué zona y hasta qué zona caminó el grupo. La etiqueta de arriba indica la zona actual. **Show the scene** y **Show the map** (Mostrar el mapa) en **Game controls** alternan entre la escena y el mapa.

Para salir, vuelve caminando a la salida (escaleras, una escalera de mano o una trampilla) y elige **Leave** (Salir). El GM también puede cerrar el mapa cuando la historia deja el lugar. Regenerar un turno que abrió un mapa, caminó por él o salió de él devuelve el mapa a como estaba antes de ese turno.

## Tiempo

En un juego con un mundo, el tiempo también pasa por su cuenta:

- Mientras el overworld está delante y el juego te está esperando, pasa un minuto de juego cada cinco segundos reales. Se detiene mientras el GM escribe, antes de que hayas leído su respuesta, mientras la vista de escena está delante y mientras la app está en segundo plano.
- Una caminata por el overworld hace pasar los días que tarda su ruta.
- Cuando el Game Master (GM) dice que pasan días (un viaje, un descanso largo, una espera), el reloj avanza esos días. Una respuesta regenerada no lo vuelve a mover. Fija el día a mano si el nuevo relato dura un tiempo distinto.

## Combate

### Elementos

Qué elementos existen depende de la ambientación:

- Sin kit de ambientación, o con un kit que no nombra ninguno: los seis clásicos (fuego, hielo, rayo, veneno, sagrado, sombra).
- Wuxia: las cinco fases (madera, fuego, tierra, metal, agua), y cada una vence a la siguiente.
- Cyberpunk y ópera espacial: cinético, térmico, EM, y químico o plasma.
- Época actual y años veinte: ninguno.

La lluvia y las tormentas en terreno abierto debilitan los elementos parecidos al fuego y refuerzan los parecidos al rayo. En un combate táctico, un elemento golpea más fuerte contra uno al que vence y más débil contra uno que lo vence. Puedes cambiar los elementos y las reacciones de un kit en **Change its words**. Consulta [Elegir un kit de ambientación](#choosing-a-setting-kit).

### Botín

Lo que cae depende de tu ambientación. Una partida con kit de ambientación suelta el botín propio del kit (una partida de la época actual suelta una tarjeta regalo o un botiquín, nunca una espada encantada), y puedes cambiar esas palabras en **Change its words**. Una partida sin kit suelta lo que suele tener su género. Un género sin kit inicial, como Steampunk, suelta cosas sencillas que no pertenecen a ninguna ambientación. En una partida cuyo conjunto de reglas tiene sus propias tablas de botín, los enemigos sueltan en su lugar los objetos del conjunto, y un conjunto que desactiva los objetos propios de Game Mode suelta solo los suyos.

### Campos de batalla hechos a mano

Un mundo también puede tener campos de batalla hechos a mano: tableros pintados casilla a casilla para uno de sus lugares con un editor de mundos como Pixelforge. Cuando una pelea empieza en ese lugar, o dentro de él, usa uno de esos tableros en vez de uno generado.

- El tablero se usa exactamente como se pintó. Si el lugar tiene varios, elige la semilla de la pelea (un número que escoge uno).
- La descripción del terreno del GM no se usa ahí, pero su formación sigue decidiendo dónde empieza cada bando. Al GM se le dice que el tablero se hizo para este lugar.
- Un tablero hecho a mano debe cumplir tres reglas: tiene uno de los tres tamaños de tablero, las dos columnas de cada lado son llanura, donde se forman los bandos, y cada casilla en la que puede estar un luchador conecta con las demás. El creador rechaza un tablero que incumple una regla y dice por qué.

Estos tableros se guardan con las ediciones a mano del mundo, así que viajan en los archivos de mundo, los paquetes de mapas y la biblioteca.

### Escenas del campo de batalla

Una partida con kit de ambientación nombra sus propias escenas con sus palabras, así que una pelea cyberpunk ocurre en una azotea o en el pasillo de un megabloque, y una pelea wuxia en un bosque de bambú o en una casa de té. Las casillas del tablero también usan las palabras de la ambientación (cobertura y escombros en vez de bosque y ruinas). Puedes cambiar las escenas de un kit y las palabras de sus casillas en **Change its words**.

## Diario, dinero y sesiones

La pestaña **World** muestra dónde estás y lo conocido que es el grupo, su reputación con cada agrupación, lo que ha hecho, las noticias que le han llegado (los rumores están marcados), los problemas que se están gestando y de los que ha oído hablar, y el pasado que contaría cualquier lugareño. Solo muestra lo que el grupo podría saber. Los secretos que solo conoce el GM siguen ocultos. Sigue la historia a través de los swipes y las ramas.

Una partida sin conjunto de reglas también tiene dinero y mercado cuando su kit de ambientación los tiene. Todos los kits iniciales los tienen, por ejemplo cobre, plata y oro en alta fantasía, monedas de cobre y taeles de plata en wuxia, dólares y centavos en la época actual, y créditos en cyberpunk y ópera espacial. La tienda del kit enumera bienes cotidianos con un precio y el lugar más pequeño que vende cada uno, así que una aldea tiene una cafetería pero solo un pueblo tiene un botiquín. Puedes cambiar el dinero y la tienda en **Change its words** del kit, o quitar el dinero. Consulta [Elegir un kit de ambientación](#choosing-a-setting-kit).

En un juego con un mundo generado, el mundo continúa desde donde se dejó: los días que pasaron, las hazañas y la reputación del grupo, los lugares y las agrupaciones que añadió la historia, y adónde fue el grupo.

## Familias de arte y música

Un juego que empezó con un kit de ambientación tiene una familia artística, que aparece en **Art and music** (Arte y música) cuando cambias las palabras del kit: `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland` o una propia del kit. El juego usa las carpetas con el nombre de su familia y todas las carpetas que no llevan el nombre de ninguna familia, y deja fuera las carpetas de las demás familias. Un juego cyberpunk nunca reproduce música de batalla de fantasía ni muestra el bosque encantado. Cuando nada de su familia ni de las carpetas compartidas encaja, no suena nada en lugar de una pista de otra familia. Un juego sin kit de ambientación usa todas las carpetas.

- **Music**: pon las pistas de la ambientación en `music/<state>/<family>/<intensity>`, como `combat/wuxia/intense`. Se reproducen antes que las pistas compartidas.
- **Backgrounds**: `backgrounds/<family>`. Los fondos generados en un juego con kit de ambientación también se guardan ahí.
- **Sonidos de combate**: un sonido en `sfx/combat/<family>` con el mismo nombre que uno incluido, como `sword-swing`, lo reemplaza en los juegos de esa familia. Los sonidos de combate incluidos son de fantasía, así que los combates de otras familias quedan en silencio hasta que añadas los suyos.

Los fondos iniciales incluidos cuentan como compartidos, excepto los de fantasía (`ancient_library`, `castle_cliff`, `enchanted_forest`) y el moderno `city_night`. Un kit de ambientación guardado antes de que existieran las familias artísticas sigue funcionando: uno creado a partir de un kit inicial usa la familia de ese kit inicial, y cualquier otro usa todas las carpetas hasta que elijas una familia en **Art and music**. La barra de selección de arriba muestra la familia del juego abierto.

## World Maps: desde el mundo

- **From the world** (Desde el mundo) aparece cuando la partida de Game crea un mundo (consulta [Crear un mundo](#making-a-world)). Dispone ese mundo como el mapa: sus regiones, asentamientos y lugares, y los caminos entre ellos con sus tiempos de viaje. Lo revisas antes de que se guarde. No necesita generación por IA, y los lugares del mapa son los lugares del mundo. Durante el juego, los dos se mantienen sincronizados. El Game Master y los mercados usan el lugar donde el mapa tiene al grupo. Cuando el Game Master nombra un lugar del mundo, el mapa mueve al grupo allí. Con World Maps 1.6.0 o posterior, toma la ruta más corta. Las versiones anteriores solo se mueven un paso: a un lugar contenido en el actual, al lugar que lo rodea o a un lugar al que lleva un camino.

## Guiones de historia

Los mundos pueden incluir guiones de historia. Consulta [Escribir guiones de historia de Game Mode](writing-story-scripts.md).
