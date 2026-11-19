# Game Mode: mapa, tiempo y clima

Usa el panel de mapa para ver dónde está tu grupo y para moverlo. Esta guía también cubre los sistemas que registran el mundo alrededor del grupo: el día y la hora, el clima y la moral del grupo.

## El panel de mapa

Game Mode muestra un panel de mapa en la pantalla de juego. Lista el nombre del mapa actual, el día de juego y un icono de cielo según la hora del día.

- **En una computadora**, el mapa es un panel integrado que puedes leer de un vistazo. Puedes arrastrarlo y fijarlo en su lugar. Para saber cómo funcionan los paneles arrastrables, consulta [Game Mode: widgets del HUD](hud-widgets.md).
- **En un teléfono**, toca **Map** (Mapa) para abrir el panel. Su botón empieza cerca de la esquina superior izquierda y se puede arrastrar por el chat. Usa **Lock window** (Fijar ventana) para mantener el botón en su sitio, y **Close** (Cerrar) para volver a él. La posición se guarda con el chat. El mapa del teléfono usa el estilo de widgets del chat de **Settings → Appearance → App** (Configuración → Apariencia → App), y su botón se mantiene separado del menú de tres puntos **Chat tools** (Herramientas del chat).

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

## Clima

El juego registra el clima con cálculos fijos, no con la IA. El clima depende del bioma (el tipo de lugar en el que está el grupo, como desierto, ártico, costero o montaña) y de la estación. Algunos ejemplos son despejado, nublado, lluvia, tormenta, nieve, ventisca, niebla y tormenta de arena. El clima cambia con más frecuencia cuando viajas o tomas un descanso largo, a veces cuando exploras, y rara vez en otros casos. Da matiz a cómo el GM describe cada escena.

Para ver el clima en pantalla, activa **Dynamic weather effects (rain, snow, fog, etc.)** (Efectos de clima dinámicos: lluvia, nieve, niebla, etc.) en la configuración de apariencia. Esta opción está activada de forma predeterminada. Entonces aparecen partículas de lluvia, nieve y niebla sobre el juego, que coinciden con el clima y la hora del día. Consulta [Configuración de apariencia](../appearance/appearance-settings.md).

## Moral del grupo

El juego mantiene una puntuación oculta de moral del grupo de 0 a 100. Tiene cinco niveles, del más bajo al más alto: Broken (Quebrada), Low (Baja), Steady (Estable), High (Alta) e Inspired (Inspirada).

La moral sube cuando ganas una pelea, completas una misión o encuentras un tesoro. Baja cuando pierdes una pelea, fallas una misión o pierdes a un aliado. Con el tiempo, vuelve poco a poco hacia el punto medio. No se muestra como un número. Da color a cómo el GM describe el ánimo de tu grupo. No cambia tus tiradas de dados.

<a id="dungeons-caves-and-stations"></a>

## Guías relacionadas

- [Game Mode: primeros pasos](getting-started.md)
- [Game Mode: widgets del HUD](hud-widgets.md)
- [Configuración de apariencia](../appearance/appearance-settings.md)
