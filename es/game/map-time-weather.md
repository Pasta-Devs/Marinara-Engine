# Game Mode: mapa, tiempo y clima

Usa el panel de mapa para ver dónde está tu grupo y para moverlo. Esta guía también cubre los sistemas que registran el mundo alrededor del grupo: el día y la hora, el clima y la moral del grupo.

## El panel de mapa

Game Mode muestra un panel de mapa en la pantalla de juego. Lista el nombre del mapa actual, el día de juego y un icono de cielo según la hora del día.

- **En una computadora**, el mapa es un panel integrado que puedes leer de un vistazo. Puedes arrastrarlo y fijarlo en su lugar. Para saber cómo funcionan los paneles arrastrables, consulta [Game Mode: widgets del HUD](hud-widgets.md).
- **En un teléfono**, toca **Map** (Mapa) para abrir el panel. Su botón empieza cerca de la esquina superior izquierda y se puede arrastrar por el chat. Usa **Lock window** (Fijar ventana) para mantener el botón en su sitio, y **Close** (Cerrar) para volver a él. La posición se guarda con el chat. El mapa del teléfono usa el estilo de widgets del chat de **Settings → Appearance → App** (Configuración → Apariencia → App), y su botón se mantiene separado del menú de tres puntos **Chat tools** (Herramientas del chat).

Una partida VN tiene el mapa de escena que se describe aquí. El overworld, los pueblos y los mapas de mazmorras pertenecen a las partidas Overworld, que todavía no están disponibles (consulta [VN u Overworld](getting-started.md#vn-or-overworld)).

### Vista de cuadrícula y vista de nodos

Marinara elige la vista según el tipo de lugar que muestra el mapa. No cambias de vista a mano.

- La vista **grid** (cuadrícula) es para áreas abiertas como una región o una ciudad. Muestra cuadros de colores según el terreno: pasto, bosque, agua, montaña, desierto, nieve, pueblo, camino y cueva.
- La vista **node** (nodos) es para áreas cerradas como mazmorras e interiores. Muestra las ubicaciones como círculos unidos por líneas. Una ubicación sin descubrir muestra un signo de interrogación. Una línea discontinua es un camino que no has recorrido, y una línea continua es uno que ya has usado.

## Mover a tu grupo

Solo puedes elegir ciertos lugares. En un mapa de cuadrícula, un cuadro debe estar junto a tu grupo y ya descubierto. En un mapa de nodos, un nodo debe estar unido a tu ubicación actual, o ya descubierto. Los demás cuadros y nodos no hacen nada cuando haces clic en ellos.

1. Haz clic en un cuadro de la cuadrícula, o en un nodo en un mapa de nodos.
2. Aparece un chip **Map position:** (Posición en el mapa:) con el nombre del lugar encima del cuadro de mensaje.
3. Escribe tu mensaje y envíalo. Marinara añade una línea corta como `*moves to <place>*` al comienzo de tu mensaje.

Para cancelar, haz clic en el botón de borrar (X) del chip **Map position:**. Su tooltip dice **Clear destination** (Borrar destino).

En un teléfono, toca un nodo una vez para seleccionarlo y luego toca **Set destination** (Fijar destino) en el pie de página. Un nodo marcado como **You are here** (Estás aquí) es tu ubicación actual.

Si no funcionó, comprueba que el cuadro esté junto a tu grupo y descubierto, o que el nodo esté unido a donde estás.

### Hacer zoom, cambiar y generar mapas

- **Zoom.** Usa **Zoom in** (Acercar, el botón de más) y **Zoom out** (Alejar, el botón de menos) en la esquina superior derecha. El zoom va del 75% al 180%, en pasos de 25%.
- **Cambiar de mapa.** Cuando un juego tiene más de un mapa o región, un menú desplegable en la parte superior del panel te permite ver otro. El mapa en el que estás se marca como **(Current)** (Actual).
- **Generar un mapa.** Haz clic en el botón de varita **Generate another map** (Generar otro mapa) de la esquina superior izquierda para reemplazar el mapa actual por uno nuevo. Un juego sin mapa muestra **No map yet** (Aún no hay mapa) y un botón **Generate** (Generar) que hace lo mismo.

## Fijar el día y la hora a mano

El control de día y hora está en la parte superior del panel de mapa. Muestra **Day** (Día) y un número, más un icono de cielo.

1. Haz clic en el control **Day**.
2. Escribe un número de día del 1 al 9999.
3. Elige una hora del día: **Dawn** (Amanecer), **Morning** (Mañana), **Afternoon** (Tarde), **Evening** (Anochecer), **Night** (Noche) o **Midnight** (Medianoche).
4. Haz clic fuera o pulsa <kbd>Enter</kbd> para guardar.

Esto es una anulación manual, aparte del reloj automático. El reloj también puede mostrar **Noon** (Mediodía) por su cuenta, pero Noon no es una opción manual.

## Cómo pasa el tiempo

El reloj del juego usa cálculos fijos, no la IA. Cada partida nueva empieza en el Día 1, a las 08:00. Cada acción mueve el reloj hacia adelante:

| Acción | Tiempo añadido |
| --- | --- |
| Hablar | 15 minutos |
| Explorar | 30 minutos |
| Una ronda de combate | 5 minutos |
| Un descanso corto | 1 hora |
| Un descanso largo | 8 horas |
| Viajar | 2 horas |

Cuando el reloj pasa la medianoche, el número de día sube en uno.

En un juego con un mundo, el tiempo también pasa por su cuenta:

- Mientras el overworld está delante y el juego te está esperando, pasa un minuto de juego cada cinco segundos reales. Se detiene mientras el GM escribe, antes de que hayas leído su respuesta, mientras la vista de escena está delante y mientras la app está en segundo plano.
- Una caminata por el overworld hace pasar los días que tarda su ruta.
- Cuando el Game Master (GM) dice que pasan días (un viaje, un descanso largo, una espera), el reloj avanza esos días. Una respuesta regenerada no lo vuelve a mover. Fija el día a mano si el nuevo relato dura un tiempo distinto.

## Clima

El juego registra el clima con cálculos fijos, no con la IA. El clima depende del bioma (el tipo de lugar en el que está el grupo, como desierto, ártico, costero o montaña) y de la estación. Algunos ejemplos son despejado, nublado, lluvia, tormenta, nieve, ventisca, niebla y tormenta de arena. El clima cambia con más frecuencia cuando viajas o tomas un descanso largo, a veces cuando exploras, y rara vez en otros casos. Da matiz a cómo el GM describe cada escena.

Para ver el clima en pantalla, activa **Dynamic weather effects (rain, snow, fog, etc.)** (Efectos de clima dinámicos: lluvia, nieve, niebla, etc.) en la configuración de apariencia. Esta opción está activada de forma predeterminada. Entonces aparecen partículas de lluvia, nieve y niebla sobre el juego, que coinciden con el clima y la hora del día. Consulta [Configuración de apariencia](../appearance/appearance-settings.md).

## Moral del grupo

El juego mantiene una puntuación oculta de moral del grupo de 0 a 100. Tiene cinco niveles, del más bajo al más alto: Broken (Quebrada), Low (Baja), Steady (Estable), High (Alta) e Inspired (Inspirada).

La moral sube cuando ganas una pelea, completas una misión o encuentras un tesoro. Baja cuando pierdes una pelea, fallas una misión o pierdes a un aliado. Con el tiempo, vuelve poco a poco hacia el punto medio. No se muestra como un número. Da color a cómo el GM describe el ánimo de tu grupo. No cambia tus tiradas de dados.

## El overworld y otros mapas de Overworld

Las secciones de abajo describen las partidas **Overworld**, que todavía no están disponibles. Solo se aplican si tu servidor ha activado la función.

<a id="the-overworld"></a>

### El overworld

Un juego con un mundo generado (consulta [Crear un mundo](getting-started.md#making-a-world)) se abre en el **overworld** (el mapa del mundo): el terreno del mundo dibujado como un mapa de píxeles detrás de la narración, con bosques, colinas, costas y mares, los caminos y rutas entre los asentamientos, cada asentamiento dibujado según su tamaño, y tu grupo. Los lugares más grandes llevan su nombre, y también el lugar en el que estás. Arrastra el mapa para mirar alrededor.

1. Toca o haz clic en un asentamiento, o elígelo en **Places** (Lugares: primero los más cercanos, con la duración del viaje).
2. Lee su tamaño y el viaje desde donde estás: días u horas, y por qué rutas.
3. Haz clic en **Walk there** (Ir caminando). El grupo va por las rutas del mundo por el camino más rápido, y los días de la caminata pasan en el reloj de inmediato.

Tu siguiente turno le cuenta al GM adónde caminaste, cuánto tardaste y por qué rutas, para que pueda narrar la llegada. Una segunda caminata antes de tu siguiente turno continúa desde donde terminó la primera.

Las cuevas, minas, criptas y ruinas a pocos pasos de un asentamiento se dibujan como **sitios**. Un mundo nuevo tiene uno o dos en cada región, con el nombre del asentamiento que tienen al lado ("Hollin Caves", "Ashby Ruins"). **Walk there** va por las rutas hasta su asentamiento y luego a pie fuera del camino. En un sitio, **Enter** (Entrar) abre su mapa (consulta [Mazmorras, cuevas y estaciones](#dungeons-caves-and-stations)). Un sitio que importa para la historia sigue **cerrado** (atenuado, sin viaje y sin entrada) hasta que el GM lo abre. Un creador de mundos también puede ocultar un sitio hasta entonces o abrirlo desde el principio.

Un lugar en ruinas se dibuja en ruinas. Al anochecer el mapa se oscurece y se encienden las ventanas. Cada familia de ambientación (fantasía, wuxia, época actual, los años veinte, ciencia ficción, el páramo) tiene sus propios mosaicos. Un kit sin familia dibuja mosaicos sencillos.

Para cambiar de vista, usa **Show the scene** (Mostrar la escena) y **Show the overworld** (Mostrar el overworld) en **Game controls** (Controles del juego); en un teléfono, están en el menú de tres puntos **Chat tools**. El juego recuerda tu elección. Un combate y la repetición de una sesión usan sus propias pantallas.

### Paquetes de mosaicos

Los paquetes de mosaicos guardan la paleta y cada mosaico (cada tipo de terreno, los asentamientos por tamaño, el grupo, y las calles, los tejados y los habitantes de un pueblo) como filas de píxeles. Cada familia de ambientación tiene un paquete integrado. Abre el panel **Agents** (Agentes) y busca **Tile packs** (Paquetes de mosaicos) para:

- elegir con qué paquete se dibuja cada ambientación (**Built in**, Integrado, es el suyo propio),
- usar **Import a tile pack** (Importar un paquete de mosaicos) con un archivo `.tilepack.json`,
- usar **Export** (Exportar) para compartir un paquete, o **Remove** (Quitar) para quitarlo, lo que devuelve a sus propios mosaicos cualquier ambientación dibujada con él.

Un paquete solo necesita los mosaicos que cambia, y todo lo que deja fuera se dibuja sencillo. Un paquete que nombra un mosaico que Marinara no dibuja conserva el resto e indica lo que dejó fuera.

<a id="the-town"></a>

### El pueblo

En un asentamiento, elígelo en el overworld y elige **Enter** para ver el pueblo. Está trazado a partir del mundo: calles y una plaza, los lugares que el mundo o la historia tienen en él (con su nombre en sus edificios), un gran salón en un lugar más grande, talleres de los oficios por los que es conocido el lugar, y casas. La gente está donde la pone la hora: trabajando de día, en la plaza al atardecer, en casa de noche.

Elige un edificio o la plaza, o elige en **Places in town** (Lugares del pueblo), para ver quién está allí y a cuántos minutos queda. **Walk there** cruza el pueblo a lo largo de las calles, rodeando los edificios y todo lo que pintó un trazado a mano, y cruzando sus puentes. Los minutos pasan en el reloj, y tu siguiente turno le cuenta al GM adónde fue el grupo y quién está allí. Una visita a un lugar con nombre, como una posada que añadió la historia, lo convierte en el lugar actual del grupo. **Leave town** (Salir del pueblo) vuelve al overworld. El juego recuerda en qué vista estabas.

Un pueblo se puede **trazar a mano** con un editor de mundos como Pixelforge, como parte de las ediciones a mano del mundo.

- Los edificios se pueden mover a otras parcelas. Un edificio movido a la parcela de otro se intercambia con él, y todos los edificios siguen dando a una calle.
- El suelo se puede pintar con calles, pavimento, terreno abierto, árboles o un pozo, pero nunca bajo un edificio, delante de su puerta, en medio de la plaza ni bajo un puesto de mercado.
- Quién vive y trabaja dónde nunca cambia, y una caminata hasta un edificio movido se cronometra desde su nueva puerta.
- El editor rechaza un trazado que no encaja con el pueblo y explica por qué. Los lugares que la historia añade durante la partida siguen encontrando una parcela.
- Un trazado también puede colocar edificios fuera de las parcelas, pintar campos, caminos de tierra, agua con puentes y setos, y colocar decoraciones. La vista del pueblo los dibuja todos (las decoraciones, solo con un paquete de imágenes que las tenga).

<a id="dungeons-caves-and-stations"></a>

### Mazmorras, cuevas y estaciones

Cuando la historia baja bajo tierra o sube a bordo, el GM puede abrir un **mapa del lugar**: una mazmorra, una cueva o una estación, dibujado sobre la escena. Se traza a partir del juego y del nombre del lugar, así que el mismo lugar siempre tiene las mismas salas, y volver conserva el mapa como estaba. El GM elige un aspecto entre once: cuevas de roca, hielo, cristal y lava; una cripta, una alcantarilla y un templo; y los pasillos, el laboratorio, la cubierta de motores y la hidroponía de una estación. Con un paquete de mosaicos para ese aspecto, el mapa usa su arte. Sin uno, usa colores sencillos.

Un lugar del pueblo al que el grupo puede bajar (una cueva, una mina, una cripta, una alcantarilla o una ruina, según su nombre, o en ciencia ficción una nave abandonada o un búnker) muestra **Go down** (Bajar) cuando el grupo está allí.

- Abre el mismo mapa cada vez, y al salir el grupo vuelve al pueblo.
- Mientras el grupo esté en otro mapa, sal primero de ese.
- Un lugar también puede tener un mapa hecho a mano con un editor de mundos como Pixelforge. Entonces **Go down** abre ese mapa, se llame como se llame el lugar, dibujado con el paquete que nombra. En un mapa así, la salida está donde entró el grupo, los objetos decorativos nunca bloquean el paso, y la gente está en puntos con nombre a las horas que el mapa les da. Al GM se le dice quién está allí.

Haz clic en un lugar del mapa, o usa las teclas de flecha, para ir caminando hasta allí por el camino más corto. Los minutos pasan en el reloj (aproximadamente un minuto por cada treinta pasos), y tu siguiente turno le cuenta al GM desde qué zona y hasta qué zona caminó el grupo. La etiqueta de arriba indica la zona actual. **Show the scene** y **Show the map** (Mostrar el mapa) en **Game controls** alternan entre la escena y el mapa.

Para salir, vuelve caminando a la salida (escaleras, una escalera de mano o una trampilla) y elige **Leave** (Salir). El GM también puede cerrar el mapa cuando la historia deja el lugar. Regenerar un turno que abrió un mapa, caminó por él o salió de él devuelve el mapa a como estaba antes de ese turno.

## Guías relacionadas

- [Game Mode: primeros pasos](getting-started.md)
- [Game Mode: widgets del HUD](hud-widgets.md)
- [Configuración de apariencia](../appearance/appearance-settings.md)
