# Game Mode: Mapa, tiempo y clima

Esta guía cubre el panel de mapa de Game Mode (modo de juego) y los sistemas que registran el mundo alrededor de tu grupo. Esos sistemas son el día y la hora, el clima y la moral del grupo. Explica las vistas del mapa, cómo moverte y hacer zoom, y cómo fijar el día y la hora a mano.

## El panel de mapa

Game Mode muestra un panel de mapa pequeño en la pantalla de juego. El panel lista el nombre del mapa actual, el día de juego y un icono de cielo según la hora del día.

En una computadora, el mapa es un panel integrado que puedes leer de un vistazo. Puedes arrastrar el panel y fijarlo en su lugar. Para saber cómo funcionan los paneles arrastrables, consulta la guía de widgets del HUD (barra de estado en pantalla) enlazada más abajo.

En un teléfono, toca **Map** (Mapa) para abrir el panel del mapa. Su botón empieza cerca de la esquina superior izquierda y se puede arrastrar por el chat. Usa el botón **Lock window** (Fijar ventana) del panel para mantener el botón del mapa en su sitio; **Close** (Cerrar) vuelve a ese botón. La posición se guarda con el chat. El mapa del teléfono usa el estilo de widgets del chat de **Settings → Appearance → App** (Configuración → Apariencia → App), y su botón se mantiene separado del menú de tres puntos **Chat tools** (Herramientas del chat).

<a id="the-overworld"></a>

## El overworld

Un juego con un mundo generado (consulta [Crear un mundo](getting-started.md#making-a-world)) se abre en el **overworld** (el mapa del mundo): el terreno del mundo dibujado como un mapa de píxeles detrás de la narración, con sus bosques, colinas, costas y mares, los caminos y rutas entre sus asentamientos, cada asentamiento dibujado según su tamaño, y tu grupo. Los lugares más grandes llevan su nombre en el mapa, y también el lugar en el que estás. Arrastra el mapa para mirar alrededor.

Toca o haz clic en un asentamiento, o elígelo en **Places** (Lugares: primero los más cercanos, con lo que tarda el camino), para ver su tamaño y el viaje desde donde estás: cuántos días u horas de camino y por qué rutas. **Walk there** (Ir caminando) lleva al grupo hasta allí por las rutas del mundo, por el camino más rápido, y los días de la caminata pasan en el reloj de inmediato. A partir de entonces el grupo está allí, y **tu siguiente turno le cuenta al Game Master** adónde caminaste, cuánto tardaste y por qué rutas, para que pueda narrar la llegada. Los días propios del mundo pasan con ella, igual que cuando el Game Master dice que pasa el tiempo. Una segunda caminata antes de tu siguiente turno continúa desde donde terminó la primera.

Las cuevas, minas, criptas y ruinas a pocos pasos de un asentamiento se dibujan en el overworld como **sitios**: un mundo nuevo tiene uno o dos en cada región, con el nombre del asentamiento que tienen al lado ("Hollin Caves", "Ashby Ruins"), y un creador de mundos puede añadir más, con un nombre así o con un mapa hecho para él. Un mundo creado antes de que existieran los sitios conserva sus lugares como estaban. **Walk there** lleva a un sitio igual que a un asentamiento: por las rutas del mundo hasta su asentamiento y luego a pie fuera del camino. En un sitio, su tarjeta ofrece **Enter** (Entrar), que abre el mapa del sitio (consulta [Mazmorras, cuevas y estaciones](#dungeons-caves-and-stations)); al salir, el grupo vuelve al overworld en el sitio. Un sitio que importa para la historia del juego sigue **cerrado** (dibujado atenuado, sin viaje hasta él y sin poder entrar) hasta que el Game Master lo abre cuando la historia llega a él; un creador de mundos también puede mantener un sitio oculto en el mapa hasta entonces, o abierto desde el principio.

Un lugar en ruinas se dibuja en ruinas. Al anochecer el mapa se oscurece y se encienden las ventanas de los asentamientos. Cada familia de ambientación tiene sus propios mosaicos: la fantasía, el wuxia, la época actual, los años veinte, la ciencia ficción y el páramo tienen cada uno sus propios colores y edificios. Un kit de ambientación sin familia dibuja mosaicos sencillos.

El overworld es una vista, y puedes cambiar en cualquier momento a la vista de escena (los fondos y el arte de personajes del juego): usa **Show the scene** (Mostrar la escena) en **Game controls** (Controles del juego), que en un teléfono está en el menú de tres puntos **Chat tools**, y **Show the overworld** (Mostrar el overworld) para volver. El juego recuerda cuál elegiste. Un combate y la repetición de una sesión usan sus propias pantallas.

### Paquetes de mosaicos

El overworld y los pueblos se dibujan a partir de **paquetes de mosaicos**: una paleta y cada mosaico (cada tipo de terreno, los asentamientos por tamaño, el grupo, y las calles, los tejados y los habitantes del pueblo) como filas de píxeles. Cada familia de ambientación tiene su propio paquete integrado. Abre el panel **Agents** (Agentes) y busca **Tile packs** (Paquetes de mosaicos) para:

- elegir con qué paquete se dibuja cada ambientación (**Built in** (Integrado) es el suyo propio);
- usar **Import a tile pack** (Importar un paquete de mosaicos) con un archivo `.tilepack.json` que alguien compartió;
- usar **Export** (Exportar) para compartir un paquete, o **Remove** (Quitar) para eliminarlo, lo que devuelve a sus propios mosaicos cualquier ambientación dibujada con él.

Un paquete solo necesita los mosaicos que cambia: todo lo que deja fuera se dibuja sencillo. Un paquete que nombra un mosaico que Marinara Engine no dibuja conserva el resto e indica lo que dejó fuera.

<a id="the-town"></a>

### El pueblo

Cuando el grupo está en un asentamiento, elígelo en el overworld y elige **Enter** para ver el pueblo. Está trazado a partir del mundo: sus calles y su plaza, los lugares que el mundo o la historia tienen en él (con su nombre en sus edificios), su gran salón en un lugar más grande, los talleres de los oficios por los que es conocido, y sus casas. Su gente está donde la hora la pone: trabajando de día, en la plaza al atardecer, en casa de noche.

Un pueblo también se puede **trazar a mano** con un creador como Pixelforge, como parte de las ediciones a mano del mundo: sus edificios se mueven a otras parcelas (un edificio movido a la parcela de otro se intercambia con él, y todos los edificios siguen dando a una calle), y su suelo se pinta con calles, pavimento, terreno abierto, árboles o un pozo (nunca bajo un edificio ni delante de su puerta, en medio de la plaza ni bajo un puesto de mercado). Quién vive y trabaja dónde nunca cambia, y una caminata hasta un edificio movido se cronometra desde su nueva puerta. El creador rechaza un trazado que no encaja con el pueblo y da el motivo; los lugares que la historia añade durante la partida siguen encontrando una parcela. Un trazado también puede colocar edificios fuera de las parcelas, pintar campos, caminos de tierra, agua con puentes por encima y setos, y repartir decoraciones por el pueblo; la vista del pueblo los dibuja todos (las decoraciones, solo con un paquete de imágenes que las tenga).

Elige un edificio o la plaza, o elige en **Places in town** (Lugares del pueblo), para ver quién está allí ahora y a cuántos minutos queda. **Walk there** lleva al grupo por el pueblo a lo largo de las calles, rodeando los edificios (y los árboles, pozos, agua y setos que pintó un trazado a mano, y cruzando sus puentes): los minutos que tarda el camino pasan en el reloj, y **tu siguiente turno le cuenta al Game Master** adónde fue el grupo y quién está allí. Una visita a un lugar con nombre, como una posada que añadió la historia, lo convierte en el lugar en el que está el grupo. **Leave town** (Salir del pueblo) vuelve al overworld. El juego recuerda en qué vista estabas.

<a id="dungeons-caves-and-stations"></a>

### Mazmorras, cuevas y estaciones

En un juego Overworld RPG (consulta [Classic u Overworld RPG](getting-started.md#classic-or-overworld-rpg)), cuando la historia baja bajo tierra o sube a bordo, el Game Master puede abrir un **mapa del lugar**: una mazmorra, una cueva o una estación, dibujado sobre la escena. Cada uno se traza a partir del juego y del nombre del lugar, así que el mismo lugar siempre tiene las mismas salas, y volver a un lugar en el que el grupo ya está conserva el mapa como estaba. El Game Master también elige su aspecto entre once: cuevas de roca, hielo, cristal y lava; una cripta, una alcantarilla y un templo; y los pasillos, el laboratorio, la cubierta de motores y la hidroponía de una estación. Con un paquete de mosaicos para ese aspecto en la biblioteca de paquetes de mosaicos, el mapa se dibuja con su arte; sin uno, se dibuja en colores sencillos.

Un lugar del pueblo al que el grupo puede bajar (una cueva, una mina, una cripta, una alcantarilla o una ruina, según su nombre; en una ambientación de ciencia ficción, una nave abandonada o un búnker) tiene **Go down** (Bajar) cuando el grupo está allí. Abre el mapa de ese lugar de la misma forma, el mismo mapa cada vez, y al salir el grupo vuelve al pueblo donde bajó. Mientras el grupo esté en otro mapa, sal primero de ese. Un lugar también puede tener un mapa **hecho a mano para él** con un creador como Pixelforge: entonces Go down abre ese mapa, se llame como se llame el lugar, dibujado con el paquete que nombra. En un mapa así, la salida está donde entró el grupo, sus objetos decorativos nunca estorban, y la gente está en sus puntos con nombre a las horas que el mapa les da; al Game Master se le dice quién está allí.

Haz clic en un lugar del mapa, o usa las teclas de flecha, para ir caminando hasta allí por el camino más corto. Los minutos pasan en el reloj (aproximadamente un minuto por cada treinta pasos), y **tu siguiente turno le cuenta al Game Master** desde qué zona y hasta qué zona caminó el grupo. La etiqueta de arriba indica en qué zona está el grupo. **Show the scene** y **Show the map** (Mostrar el mapa) en **Game controls** alternan entre el mapa y la escena; el juego recuerda en cuál estabas.

Para salir, vuelve caminando a la salida (escaleras, una escalera de mano o una trampilla, según el aspecto del lugar) y elige **Leave** (Salir). El Game Master también puede cerrar el mapa cuando la historia deja el lugar. Regenerar un turno que abrió un mapa, caminó por él o salió de él devuelve el mapa a como estaba antes de ese turno. Los juegos sin mapa se juegan como antes.

## Vista de cuadrícula y vista de nodos

El mapa tiene dos vistas. Marinara Engine elige la vista por ti según el tipo de lugar que representa el mapa. No cambias de vista a mano.

- La vista **grid** (cuadrícula) es para áreas abiertas como un mundo exterior, una región o una ciudad. Muestra cuadros de colores según el terreno, como pasto, bosque, agua, montaña, desierto, nieve, pueblo, camino y cueva.
- La vista **node** (nodos) es para áreas cerradas como mazmorras e interiores. Muestra las ubicaciones como círculos unidos por líneas. Una ubicación que aún no has descubierto muestra un icono de signo de interrogación. Una línea discontinua indica un camino que no has recorrido. Una línea continua indica un camino que ya has usado.

## Mover a tu grupo

Para viajar, elige un lugar en el mapa. Solo puedes elegir ciertos lugares. En un mapa de cuadrícula, un cuadro debe estar junto a tu grupo y ya descubierto. En un mapa de nodos, un nodo debe estar unido a tu ubicación actual, o ya descubierto. Los demás cuadros y nodos no hacen nada cuando haces clic en ellos.

1. Haz clic en un cuadro de la cuadrícula, o haz clic en un nodo en un mapa de nodos.
2. Aparece un chip **Destination:** (Destino:) encima del cuadro de mensaje con el nombre del lugar.
3. Escribe tu mensaje y envíalo. Marinara añade una línea corta como `*moves to <place>*` al comienzo de tu mensaje.

Para cancelar, haz clic en el pequeño botón de borrar (la X) del chip **Destination:**.

En un teléfono el flujo es un poco distinto. Toca un nodo una vez para seleccionarlo, luego toca **Set destination** (Fijar destino) en el pie de página. Un nodo marcado como **You are here** (Estás aquí) es tu ubicación actual.

## Hacer zoom en el mapa

Cada mapa tiene un control de zoom en la esquina superior derecha.

- Haz clic en **Zoom in** (Acercar) (el botón de más) para acercarte.
- Haz clic en **Zoom out** (Alejar) (el botón de menos) para ver más.

El zoom va del 75% al 180%, en pasos de 25%.

## Cambiar entre mapas

Algunos juegos tienen más de un mapa o región. Cuando existe más de un mapa, aparece un menú desplegable pequeño en la parte superior del panel de mapa. Úsalo para ver un mapa diferente. El mapa en el que realmente estás se marca como **(Current)** (Actual).

## Generar un mapa nuevo

El panel de mapa tiene un botón de varita en la esquina superior izquierda con la etiqueta **Generate another map** (Generar otro mapa). Haz clic en él para reemplazar el mapa actual por uno nuevo.

Si un juego aún no tiene mapa, el panel muestra **No map yet** (Aún no hay mapa) con un botón **Generate** (Generar) que hace lo mismo.

## Fijar el día y la hora a mano

El control de día y hora está en la parte superior del panel de mapa. Muestra **Day** (Día) y un número, más un pequeño icono de cielo según la hora del día.

1. Haz clic en el control **Day**.
2. Escribe un nuevo número de día en el cuadro. El día puede ir de 1 a 9999.
3. Elige una hora del día en el menú desplegable. Las opciones son **Dawn** (Amanecer), **Morning** (Mañana), **Afternoon** (Tarde), **Evening** (Anochecer), **Night** (Noche) y **Midnight** (Medianoche).
4. Haz clic fuera o pulsa Enter para guardar.

Esto es una anulación manual. Fijas el día y la hora tú mismo, aparte del reloj automático que se describe a continuación. El reloj también puede mostrar **Noon** (Mediodía) por su cuenta, pero Noon no es una de las opciones manuales.

## Cómo pasa el tiempo automáticamente

El reloj del juego avanza por su cuenta. Usa cálculos fijos, no la IA, así que siempre es consistente. Cada partida nueva empieza en el Día 1, a las 08:00 de la mañana. Cada acción que realizas mueve el reloj hacia adelante una cantidad fija.

| Acción | Tiempo añadido |
|---|---|
| Hablar | 15 minutos |
| Explorar | 30 minutos |
| Una ronda de combate | 5 minutos |
| Un descanso corto | 1 hora |
| Un descanso largo | 8 horas |
| Viajar | 2 horas |

Cuando el reloj pasa la medianoche, el número de día sube en uno.

En un juego con un mundo, el tiempo también pasa por su cuenta:

- Mientras el overworld está delante y el juego te está esperando, pasa un minuto de juego cada cinco segundos reales. Se detiene mientras el Game Master escribe, antes de que hayas leído su respuesta, mientras la vista de escena está delante y mientras la app está en segundo plano.
- Una caminata por el overworld hace pasar los días que tarda su ruta.
- Cuando el Game Master dice que pasan días (un viaje, un descanso largo, una espera), el reloj también avanza esos días. Una respuesta regenerada no lo vuelve a mover; fija el día a mano si el nuevo relato dura un tiempo distinto.

## Clima

El juego también registra el clima por su cuenta, con cálculos fijos y sin IA. El clima depende del bioma y la estación. Un bioma es el tipo de lugar en el que está tu grupo, como desierto, ártico, costero o montaña. Ejemplos de clima incluyen despejado, nublado, lluvia, tormenta, nieve, ventisca, niebla y tormenta de arena.

El clima puede cambiar cuando actúas. Cambia con más frecuencia cuando viajas o tomas un descanso largo, a veces cuando exploras, y rara vez en otros casos. El clima da matiz a cómo el Game Master (director del juego) describe cada escena.

Para ver el clima en pantalla, activa la opción con la etiqueta **Dynamic weather effects (rain, snow, fog, etc.)** (Efectos de clima dinámico (lluvia, nieve, niebla, etc.)) en la configuración de apariencia de la app. Está activada de forma predeterminada. Cuando está activada, aparecen partículas animadas como lluvia, nieve y niebla sobre el juego. Coinciden con el clima y la hora del día actuales. Para más opciones de visualización, consulta la guía de configuración de apariencia enlazada más abajo.

## Moral del grupo

El juego mantiene una puntuación oculta de moral del grupo de 0 a 100. Tiene cinco niveles, del más bajo al más alto: Broken (Quebrada), Low (Baja), Steady (Estable), High (Alta) e Inspired (Inspirada).

La moral cambia con lo que ocurre en la historia. Ganar una pelea, completar una misión o encontrar un tesoro la sube. Perder una pelea, una misión fallida o perder a un aliado la baja. Con el tiempo, la moral vuelve poco a poco hacia el punto medio.

La moral no se muestra como un número en el juego. En cambio, funciona en segundo plano. Cambia tus tiradas de dados, desde más 2 en Inspired hasta menos 2 en Broken. También da color a cómo el Game Master describe el ánimo de tu grupo.

## Guías relacionadas

- [Game Mode: Primeros pasos](getting-started.md)
- [Game Mode: Widgets del HUD](hud-widgets.md)
- [Configuración de apariencia](../appearance/appearance-settings.md)
