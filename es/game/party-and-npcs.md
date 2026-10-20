# Game Mode: grupo y NPC

Esta guía cubre a las personas de tu campaña en Game Mode: los miembros de tu grupo (de aventura) y los NPC (personajes no jugadores) que presenta el Game Master. Aprenderás a abrir las hojas de personaje del grupo, editarlas o regenerarlas, y a leer el Adventure Journal, incluidas las etiquetas de reputación de los NPC. También se explican los dos modos de Game Master.

Game Mode es uno de los modos de chat de Marinara Engine. Ejecuta un RPG (juego de rol) para un solo jugador con un Game Master (director del juego) de IA, a menudo abreviado como GM. Para la configuración y lo básico, consulta [Game Mode: primeros pasos](getting-started.md).

## Perfiles de personajes

Haz clic o toca el botón de avatar **Character Profiles** (Perfiles de personajes) para ver los personajes que viajan contigo. Con varios miembros en el grupo, el botón va alternando sus retratos y muestra una insignia con el número.

Puedes arrastrar este botón por el chat en una computadora o en un teléfono. Ábrelo y usa **Lock window** (Fijar ventana) para mantenerlo en su sitio. En una computadora también puedes mover la ventana y cambiar su tamaño. **Close** (Cerrar) la devuelve a su botón. Su posición se guarda con el chat, y sigue tu estilo de widgets del chat de **Settings → Appearance → App** (Configuración → Apariencia → App). En los teléfonos se mantiene separado del menú de tres puntos **Chat tools** (Herramientas del chat).

Esto es lo que puedes hacer dentro de **Character Profiles**:

1. Haz clic o toca un retrato para abrir la hoja de ese personaje.
2. Pasa el cursor sobre un retrato (en computadora) para mostrar un pequeño botón **X**.
3. Haz clic en la **X** para quitar a ese personaje del grupo.

Puedes quitar a cualquier compañero que haya reclutado el Game Master, tanto si se unió durante la configuración como más tarde en la historia. Tu propia persona es el personaje que interpretas. No tiene botón **X**, así que no puedes quitarte a ti mismo del grupo.

## Hojas de personaje

Una hoja de personaje es un resumen específico del juego de un miembro del grupo. Es distinta de la tarjeta de personaje. El Game Master la escribe a partir de tu personaje y de la historia actual.

Abre **Character Profiles** y luego haz clic o toca el retrato de ese personaje. La hoja muestra cualquiera de estas secciones que tenga contenido:

- **Attributes** (Atributos): puntuaciones al estilo de mesa como STR, DEX y CON, cada una con un modificador.
- **Stats** (Estadísticas): barras de recursos como HP o MP.
- **Abilities** (Habilidades): cosas que el personaje puede hacer.
- **Strengths** (Fortalezas) y **Weaknesses** (Debilidades): listas cortas.
- **Details** (Detalles): datos adicionales como Skills, Weapon o Faction.
- **Inventory** (Inventario): objetos que lleva el personaje.
- **Traits** (Rasgos): otros campos personalizados.

Si un personaje es nuevo, puede que veas "Character data will populate as the story progresses" (Los datos del personaje se completarán a medida que avance la historia). La hoja se va rellenando mientras juegas.

### Regenerar una hoja con IA

Haz clic en **Regenerate Sheet** (Regenerar hoja) para que la IA reescriba la hoja de ese personaje. Usa el personaje y el contexto actual del juego. Esto es útil después de que la historia haya cambiado mucho a un personaje.

### Editar una hoja a mano

Haz clic en **Edit Sheet** (Editar hoja) para cambiar la hoja tú mismo. En el modo de edición puedes establecer lo siguiente:

- **Class** (Clase) y una descripción corta en **Sheet Details** (Detalles de la hoja).
- **RPG Attributes** (Atributos de RPG): activa **Enable** (Activar) para llevar el registro de reservas al estilo de HP y de atributos. Usa **Add Pool** (Añadir reserva) para agregar una barra (nombre, valor actual, valor máximo y color). Usa **Add Attribute** (Añadir atributo) para agregar una puntuación como STR.
- **Abilities**, **Strengths** y **Weaknesses**: usa **Add** (Añadir) para agregar una línea.
- **Details**: usa **Add Detail** (Añadir detalle) para agregar un dato con etiqueta.

Cuando termines, haz clic en **Save Sheet** (Guardar hoja). Haz clic en **Cancel** (Cancelar) para descartar tus cambios.

<a id="the-ruleset-sheet"></a>

### La ficha del conjunto

En una partida que usa un conjunto de reglas (consulta [Partidas con un conjunto de reglas](dice-and-skill-checks.md#games-that-use-a-ruleset)), cada hoja de personaje empieza con un bloque **Ruleset sheet** (Ficha del conjunto de reglas). Su estructura procede del conjunto, así que una ficha de 5e y la de otro sistema se ven distintas. Una partida sin conjunto de reglas no tiene este bloque.

- **Resources** (Recursos), como los puntos de vida, los espacios de conjuro o un recurso de clase, muestran lo que queda del máximo. Usa los botones de menos y más, o escribe un número. Un recurso con un margen temporal también muestra un cuadro **Temp**.
- **Tracks** (Contadores), como el agotamiento, suben y bajan dentro de su rango.
- **Wound tracks** (Contadores de heridas) muestran una fila de casillas en vez de un número, para sistemas que marcan el daño en vez de sumarlo. Cada casilla indica el nombre de ese grado de herida y cuánto resta a tus tiradas. Elige primero el tipo de daño si el conjunto ofrece varios y usa **Mark** (Marcar) o **Clear one** (Borrar una). También puedes hacer clic en la siguiente casilla vacía para añadir una marca o en la última marcada para quitarla; las demás no responden. Una marca más grave ocupa la casilla superior y desplaza hacia abajo las más leves; la línea inferior indica la penalización activa y lo que no haya cabido en el contador. Algunos conjuntos numeran sus casillas en lugar de nombrarlas, a veces tantas como la propia puntuación del personaje, y algunos ponen cada marca en la casilla a la que apunta: en esos puedes hacer clic en cualquier casilla libre, **Clear one** quita la marca más leve de la casilla más alta, y un contador lleno rechaza otra marca en lugar de agravar una antigua. Un conjunto también puede añadir casillas a un contador a partir de una lista de tu ficha, y hacer que un descanso o una curación borre solo un tipo de daño. Si lo define el conjunto, esa penalización se aplica a tus tiradas: resta dados de una reserva o se añade a una tirada sumada, y la tarjeta de dados indica cuánto se aplicó.
- **Notes** (Notas), como aquello en lo que se concentra un personaje, son cuadros de texto cortos.
- **Conditions** (Condiciones) son botones que activas y desactivas.
- **States** (Estados), como una forma o una postura, tienen un solo valor de una lista cada vez. Elige el valor de la lista. Un estado puede cambiar los números que lo siguen, como los dados que una postura añade a tus tiradas, y un descanso puede devolverlo a su valor inicial.
- Los **botones de descanso** aplican uno de los descansos del conjunto. Lo que recupera un descanso lo define el conjunto, y un descanso también puede devolver las cargas de los objetos que lleva el personaje, como las de una varita; la línea bajo los botones indica entonces lo que volvió. En 5e (SRD 5.1), un descanso largo recupera los puntos de vida y los espacios de conjuro y devuelve la mitad de los dados de golpe del personaje, con un mínimo de uno.
- Debajo hay un breve resumen de la construcción del personaje: los modificadores de atributo, las habilidades y salvaciones entrenadas y algunos valores que elige el conjunto, como la clase de armadura.

El Game Master mantiene al día la misma ficha mientras narra. Cuando un personaje gasta un recurso, recibe daño, se cura, gana o pierde una condición, cambia de estado o descansa, registra el cambio, y el motor lo comprueba con la ficha. Un cambio que no es posible, como lanzar un conjuro sin espacios libres, se rechaza: no cambia nada y un aviso te lo indica.

Cuando un personaje usa algo que eligió de los catálogos del conjunto, como un conjuro o un rasgo de clase, el Game Master lo nombra y el motor paga el precio completo: lo que el conjunto diga que cuesta, más un uso de cada contador que venía con ello. Un conjuro que cuesta un espacio se paga con el nivel de espacio que le asigna el conjunto, y el Game Master puede pedir uno superior. El motor nunca sube por su cuenta a un espacio superior. Si alguna parte del precio no se puede pagar, se rechaza todo y no se gasta nada. Algo que no cuesta nada, como un truco, simplemente se narra.

Algunos números de la ficha pertenecen al conjunto y no a ti. Un recurso de clase cuyo máximo sigue a tu nivel, o unos usos que siguen a una puntuación de atributo, los fija el conjunto y se mantienen correctos cuando editas la ficha.

Algunos valores calculados siguen la propia partida: un conjunto puede calcular un número a partir de un recurso o de un contador tal como están, dar un número para cada valor de un estado o sumar una columna de una lista, como el peso del equipo que llevas. También puede limitar una habilidad a un número así, de modo que una habilidad puede reducirse mientras un recurso está bajo. Estos valores muestran su valor actual en la ficha de la partida, y los valores que usa una prueba o un combate son los del momento en que ocurre. El editor de fichas de una tarjeta de personaje, que no tiene partida que leer, los muestra como serían al inicio del juego.

Estos valores vivos pertenecen al mensaje en el que ocurrieron. Si cambias a otra versión de un turno con un swipe (respuesta alternativa), o lo regeneras, la ficha vuelve a como estaba antes de ese turno, así que nunca se gasta nada dos veces.

Haz clic en **Edit sheet** (Editar ficha) para cambiar la construcción en sí, por ejemplo tras subir de nivel: puntuaciones, campos, listas como los conjuros y el entrenamiento en habilidades y salvaciones. Los valores calculados se actualizan mientras escribes. Es el mismo editor que el de la tarjeta de personaje, así que aquí también se pueden añadir filas desde los catálogos del conjunto, las celdas que mantiene el conjunto se muestran pero no se pueden editar, y una lista cuyo texto del conjunto ha cambiado ofrece un botón **Review** (Revisar). Cuando el conjunto tiene un constructor paso a paso, el editor ofrece **Guided** (Guiado) junto a **All fields** (Todos los campos). **Guided** te guía por cada elección, como las puntuaciones, las habilidades y el equipo inicial, e indica qué le falta todavía a cada paso. **All fields** lo muestra todo a la vez. Haz clic en **Save sheet** (Guardar ficha) cuando termines. Esto cambia solo la copia de la ficha de esta partida. Una partida nunca cambia la ficha guardada en el personaje o la persona.

El botón separado **Edit Sheet** descrito arriba sigue editando la hoja general (clase, habilidades, fortalezas, etc.) y no toca la ficha del conjunto.

Si se eliminó el paquete del conjunto, o la copia instalada es más antigua que aquella con la que se creó la partida, el bloque muestra un aviso en su lugar, y las pruebas no se pueden tirar hasta que se vuelva a instalar el paquete.

### La ficha del grupo y los relojes de progreso

Algunos conjuntos llevan una ficha para todo el grupo, como una tripulación o una compañía. Aparece en la pantalla del juego cerca del mapa, con el nombre que le da el conjunto. Haz clic en el nombre para abrirla. El Game Master la mantiene al día igual que la ficha de cada personaje y, donde el conjunto lo permite, tú también puedes editarla. Si otra persona guardó la ficha del grupo mientras editabas, se muestra su versión: **Save** (Guardar) la reemplaza por la tuya, y **Cancel** conserva la suya.

Un conjunto también puede usar **Progress clocks** (Relojes de progreso): círculos divididos en segmentos que el Game Master va llenando a medida que algo aumenta, como una alarma que se extiende. Aparecen cerca del mapa, cada uno con cuántos segmentos están llenos, y muestran **Done** (Completado) una vez llenos.

## El inventario

Haz clic en **Inventory** encima de la narración para abrirlo. Cada cuadro es una pila: un objeto y cuántos hay. Haz clic en una pila para seleccionarla.

Cada miembro del grupo lleva sus propias cosas. El inventario se abre en **All** (Todos), que muestra todas las bolsas juntas, con el nombre de quien lleva cada pila en su esquina. Haz clic en la pestaña de un miembro del grupo para ver solo su bolsa. Mientras nadie más lleve nada, no hay pestañas y todas las pilas son tuyas.

- **Cambiar la cantidad.** Usa **-** y **+** para quitar o añadir una. Para cambiarla en más, escribe en el número que hay entre ellos y pulsa Enter: un número fija la cantidad (`300`), y un signo añade o quita esa cantidad (`+100`, `-50`). Poner una pila a 0 la quita, y pregunta antes cuando hay más de una.
- **Dividir una pila.** Haz clic en **Split** (Dividir), escribe cuántos van a la nueva pila y vuelve a hacer clic en **Split**. Separar 100 de 300 manzanas deja una pila de 200 y una pila nueva de 100 al lado.
- **Dar.** Haz clic en **Give** (Dar), elige quién lo recibe y cuántos, y vuelve a hacer clic en **Give**. Para entregar una pila entera, también puedes arrastrarla a la pestaña de esa persona.
- **Añadir.** Escribe el nombre del objeto y haz clic en **Add** (Añadir). Va a la bolsa de la pestaña abierta, y a tu propia bolsa desde **All**, salvo que tu conjunto indique lo que puede llevar cada uno (ver abajo). Añadir un objeto que esa bolsa ya tiene suma uno a su primera pila de ese objeto.
- **Combinar o reordenar.** Arrastra una pila sobre otra pila del mismo objeto para combinarlas, se llame como se llame cada una. La pila combinada se queda con quien llevaba la pila sobre la que la soltaste. Arrastra una pila sobre un objeto distinto para intercambiar los dos.
- **Del conjunto de reglas.** En una partida cuyo conjunto enumera sus propios objetos, **From the ruleset** (Del conjunto de reglas) abre un selector con ellos, con la búsqueda y los filtros del conjunto. Marca los objetos que quieras y haz clic en **Add**: uno de cada va adonde **Add** pone un objeto, a la bolsa de la pestaña abierta, o desde **All** a tu propia bolsa salvo que tu conjunto indique lo que puede llevar cada uno. Un nombre que escribes y que es uno de los objetos del conjunto también añade ese objeto. Un conjunto puede aceptar solo sus propios objetos, y entonces no hay nombre que escribir.
- **Equipo inicial.** Cuando el conjunto ofrece equipo con el que empezar, **Starting gear** (Equipo inicial) lo abre. Elige para quién es en **For** (Para), toma las decisiones que pida un kit y haz clic en su botón **Take** (Tomar) para ponerlo en su bolsa. El equipo que encaja con la ficha de ese personaje aparece primero; el resto puede tomarlo si el Game Master está de acuerdo. Tomarlo es opcional. Cuando se ha tomado todo lo ofrecido, el botón dice **Starting gear (taken)** (Equipo inicial: tomado).
- **Usar.** Haz clic en **Use** (Usar) para decirle al Game Master que usas el objeto. Con uno de los objetos del conjunto que dice qué hace al usarlo, como una cataplasma curativa, el motor lo hace primero: tira lo que devuelve, lo anota en la ficha de quien lo lleva, quita uno de la pila o gasta una carga, y le cuenta al Game Master lo que pasó para que la historia lo siga. Lo que le hace a otra persona se deja a la narración del Game Master. Un objeto al que no le queda nada se rechaza, y uno que hay que llevar puesto solo se usa mientras está puesto. Algunos objetos piden antes una prueba, como un pergamino por encima de lo que sabes leer: el motor la tira y, si falla, el objeto se gasta para nada.
- **Apodo.** Escribe un nombre nuevo para la pila y haz clic en **Save**. Es solo cómo llamas a esa pila: sigue siendo el mismo objeto, el Game Master todavía puede nombrarlo por su propio nombre, y darle un apodo nunca lo combina con otra pila. El nombre propio del objeto aparece junto al apodo. Vuelve a escribir el nombre propio para quitar el apodo.

Un objeto de un conjunto muestra lo que es cuando lo seleccionas: su tipo, rareza, etiquetas, estadísticas y descripción. Una pila solo contiene tantos como diga el conjunto, y lo que pase de ahí empieza una pila nueva. El Game Master también puede inventar un objeto con las palabras propias del conjunto, como una espada con nombre. Funciona como los objetos propios del conjunto, y sus detalles indican que fue inventado, junto con lo que el motor cambió para ajustarlo al conjunto, como una bonificación limitada a lo que permite su rareza. Algunos conjuntos desactivan los objetos propios de Game Mode: entonces el Game Master solo da los objetos del conjunto y los que inventa, mientras que tú todavía puedes escribir objetos propios salvo que el conjunto acepte solo los suyos.

### Llevar puesto, vincular y cargar

Un conjunto también puede indicar cómo se llevan puestos y se cargan sus objetos:

- **Equipado.** Un objeto que ocupa espacios, como una armadura en el cuerpo o un arco en ambas manos, tiene un botón **Equipped** (Equipado). Su portador puede llevarlo puesto mientras esos espacios estén libres; la pestaña de la bolsa muestra cada espacio en uso, como **Hands 2/2** (Manos 2/2). Equipar un objeto de una pila más grande lo pasa a una pila propia, marcada como puesta.
- **Vínculo.** Un objeto que tiene que estar vinculado para funcionar (sintonizado, investido) tiene un botón con la palabra que usa el conjunto para ello, como **Bound** (Vinculado). Un personaje solo puede vincular tantos objetos como permita su ficha, lo que se muestra, por ejemplo, como **Bound 1/3** (Vinculados 1/3). Un objeto maldito, una vez vinculado, sigue vinculado: no puedes desvincularlo, quitártelo, darlo ni tirarlo. Solo la historia, a través del Game Master, puede acabar con la maldición.
- **Carga.** Cuando el conjunto indica cuánto pesa todo y cuánto puede llevar cada personaje, cada bolsa muestra su carga, como **Load 5/6, at most 12** (Carga 5/6, como máximo 12), y **Encumbered** (Sobrecargado) cuando supera lo que su portador lleva con comodidad. Un objeto añadido desde **All** va a alguien que pueda llevarlo sin quedar sobrecargado: primero tú y luego el grupo en orden. Cuando nadie puede llevarlo entero, se reparte según el espacio que le queda a cada uno, y a nadie se le da nunca más de lo que puede llevar en total. Lo que nadie puede llevar se queda atrás, y se te avisa. Entregar a alguien más de lo que puede llevar se rechaza, tanto con **Give** como arrastrando una pila sobre una de su bolsa.

Dar a otra persona un objeto puesto o vinculado se lo quita y lo desvincula.

La hoja de personaje de un miembro del grupo enumera lo que lleva.

El Game Master añade, quita y entrega objetos a medida que avanza la historia, e indica quién los lleva. Un objeto que nombra y que es uno de los objetos del conjunto es ese objeto, y se le dice qué es cada uno de los objetos del conjunto que tienes. Usa los objetos del conjunto igual que el botón **Use**. En un conjunto que indica cómo se llevan puestos y se cargan los objetos, también pone y quita objetos, los vincula y desvincula, y ve la carga, los espacios y los objetos vinculados de cada personaje; un objeto que añade sin decir quién lo recibe se reparte igual que los tuyos. Cada cambio se hace cuando se guarda la respuesta, y su notificación aparece cuando llegas a esa parte de la historia. Cuando el Game Master toma un objeto sin decir de quién, sale primero de tu bolsa y luego del resto del grupo. Un cambio que no puede ocurrir, como tomar algo que nadie tiene, se rechaza, y se le avisa al Game Master. Cuando regeneras una respuesta, sus cambios vuelven a empezar desde donde empezó ese turno, y volver con un swipe a una versión anterior muestra lo que dejó esa versión. Eliminar la versión en la que estás muestra lo que dejó la siguiente, y una rama del chat conserva el inventario de cada versión. Esto solo ocurre mientras el inventario sigue exactamente como lo dejó la respuesta: en cuanto cambias algo tú, una respuesta nueva añade sus cambios encima y no se deshace nada de lo que hiciste. Un combate usa objetos desde la acción **Items** (Objetos) y cuenta juntas todas las pilas de un objeto, las lleve quien las lleve y se llamen como se llamen. Todas las bolsas, con sus divisiones y apodos incluidos, pasan a la siguiente sesión.

### Dinero

Un conjunto puede tener su propio dinero: una o más familias de monedas, como peniques, chelines y coronas, donde cada moneda más grande vale cierto número de la más pequeña. Las monedas son pilas como cualquier objeto. Pesan lo que diga el conjunto y cuentan para la carga de quien las lleva, y puedes dividirlas, darlas y combinarlas como cualquier otra cosa. **From the ruleset** tiene una lista **Coins** (Monedas) para añadirlas a mano.

Encima de las pilas, una línea muestra cada familia de monedas de la pestaña abierta y lo que suman, como **Coin: crowns ×2, pennies ×12 (worth 132 pennies)** (Monedas: coronas ×2, peniques ×12; valen 132 peniques).

El Game Master cobra y paga al grupo en estas monedas, y un combate ganado o un tesoro que tira también pueden soltarlas. Un pago sale del monedero de un personaje, el tuyo salvo que diga de quién, y solo en la familia en la que está el precio: primero salen las monedas más grandes, y cuando no está la cantidad exacta se cambia una moneda más grande y la vuelta se devuelve en monedas más pequeñas. Un precio que el monedero no puede cubrir se rechaza, y se le avisa al Game Master. Un precio en una familia nunca se paga en otra, así que un precio en sal se paga en sal. El dinero que gana el grupo va a las bolsas como cualquier objeto. Cada pago y cada ganancia aparecen como una notificación.

Una variante del conjunto puede dejar fuera una moneda, como una noche larga en la que no llegan coronas a los túmulos. Entonces nadie cobra ni paga con esa moneda, y un precio expresado en ella se muestra en las monedas que quedan, con el mismo valor.

Un conjunto también puede tener mercados, de modo que lo que puedes comprar depende de dónde estás. El Game Master indica en qué lugar ocurre una escena y su tamaño, una aldea o una ciudad con las palabras propias del conjunto, y un lugar pequeño vende menos: las cosas raras quizá solo se encuentren en un pueblo, y algunos vendedores solo tienen tienda en lugares más grandes o solo atienden a algunos compradores, como una capilla que solo vende a los fieles. Cuando compras algo, el motor calcula el precio a partir del coste del objeto y de lo barato o caro que sea el trato, lo toma del monedero del comprador y pone el objeto en su bolsa. El alojamiento, los pasajes y otros servicios solo se pagan. Una notificación muestra qué se compró y por cuánto; una compra que el lugar, el vendedor o el monedero no pueden hacer se rechaza, y se le dice al Game Master por qué. Un conjunto también puede hacer que cada día en un lugar sea distinto: un lugar puede tener solo unas pocas unidades de algo raro, un vendedor puede ofrecer algo inusual ese día, y puedes revender cosas a un vendedor que comercie con ellas, por una parte del precio, hasta que los vendedores del lugar hayan gastado lo que pagan en un día. Un día nuevo en el mismo lugar, que el Game Master empieza cuando el grupo se queda, vuelve a llenar los estantes y el monedero.

Una partida sin conjunto de reglas también tiene dinero y mercado cuando su kit de ambientación los tiene: todos los kits iniciales los tienen, como cobre, plata y oro en alta fantasía, monedas de cobre y taeles de plata en wuxia, dólares y centavos en la época actual, y créditos en cyberpunk y ópera espacial. La tienda del kit enumera las cosas cotidianas que vende su ambientación, cada una con un precio y el lugar más pequeño que la vende, así que una aldea tiene una cafetería pero solo un pueblo tiene un botiquín. Puedes cambiar el dinero y la tienda en **Change its words** (Cambiar sus palabras) del kit, o quitar el dinero por completo. Comprar, pagar y ganar funcionan entonces como arriba, con las monedas propias de la ambientación.

## Reclutar y quitar miembros del grupo

El Game Master controla quién está en tu grupo a medida que se desarrolla la historia. No hay un botón manual de "añadir compañero". En su lugar, el GM agrega o quita miembros del grupo mediante la narración, según lo que ocurre en la escena.

Cuando el GM agrega un NPC que tiene exactamente el mismo nombre que una de tus tarjetas de personaje, o un nombre que comparten varias de tus tarjetas, una ventana pregunta cuál se une. Muestra el nombre, el título y el avatar de cada tarjeta. Elige una tarjeta, o elige **Keep the game's own** (Conservar el del juego) seguido del nombre del NPC, como **Keep the game's own Emma**, para traer al personaje que creó el juego. Cerrar la ventana hace lo mismo. Una tarjeta que solo tiene un nombre parecido, como **Samantha** para un NPC llamado Sam, nunca se agrega.

Para soltar a un compañero tú mismo, usa la **X** junto a su retrato en **Character Profiles**, como se describió arriba. No puedes quitar tu propia persona de esta manera.

## El Adventure Journal

El Adventure Journal (Diario de aventura) es un registro continuo de tu campaña. Se construye a partir de eventos guardados del juego, no lo escribe la IA, así que se mantiene fiel a los hechos.

Abre **Session** (consulta [Abrir Session](sessions-and-saves.md#opening-session)) y elige la pestaña **Journal** (Diario). Journal tiene estas pestañas:

- **Timeline** (Cronología): una lista de lo que ha pasado, como lugares encontrados, encuentros con NPC, resultados de combate, misiones y eventos de objetos.
- **NPCs**: los NPC que has conocido, con retratos y etiquetas de reputación (ver abajo).
- **Map** (Mapa): una lista simple de los nombres de lugares que has descubierto.
- **Items** (Objetos): un registro de los objetos que adquiriste, usaste, perdiste o quitaste.
- **Library** (Biblioteca): notas y libros del mundo del juego que el Game Master te ha mostrado, guardados para que puedas leerlos de nuevo.
- **Notes** (Notas): tu propio bloc de notas de texto libre.
- **World** (Mundo): en una partida con un mundo generado, el mundo tal como lo conoce tu grupo. Muestra:
  - dónde estás y lo conocido que es el grupo
  - la reputación del grupo con cada agrupación con la que ha tratado
  - lo que ha hecho el grupo
  - las noticias que le han llegado, con los rumores marcados
  - los problemas que se están gestando y de los que ha oído hablar
  - el pasado que contaría cualquier lugareño

  Solo muestra lo que el grupo podría saber. Los secretos que solo conoce el Game Master siguen ocultos. Sigue la historia a través de los swipes y las ramas.

### Notas del jugador

La pestaña **Notes** es tu bloc de notas personal. Escribe a la izquierda y una vista previa con formato se muestra a la derecha. Un aviso encima del bloc de notas advierte que tus notas son visibles para el Game Master y los miembros del grupo. Eso significa que cualquier cosa que escribas aquí puede influir en la historia.

Tus notas se guardan solas un momento después de que dejas de escribir. Una pequeña etiqueta muestra **Saving...** (Guardando...) mientras guarda y **Saved** (Guardado) cuando termina.

## Etiquetas de reputación de los NPC

La pestaña **NPCs** del Adventure Journal lleva el registro de cómo se siente cada NPC respecto a ti. Cada NPC listado muestra un retrato, un nombre y una etiqueta de reputación.

La etiqueta de reputación cambia según cómo actúas en la historia. Es una de estas siete, de mejor a peor:

| Etiqueta | Significado |
|---|---|
| **Devoted** | Profundamente leal a ti |
| **Allied** | Aliado fuerte |
| **Friendly** | Positivo |
| **Neutral** | Sin sentimiento marcado |
| **Unfriendly** | Negativo |
| **Hostile** | Se volvió en tu contra |
| **Enemy** | Activamente opuesto |

Una etiqueta aparece solo después de que la reputación de un NPC se ha alejado del punto de partida. Un NPC totalmente nuevo con la reputación sin cambios aún no muestra etiqueta.

Un NPC aparece en esta pestaña una vez que el Game Master lo ha descrito, le ha dado una reputación o ha registrado una nota de relación. Cada fila de NPC también ofrece estas acciones:

- Subir o reemplazar el retrato del NPC.
- Generar un retrato con IA, si la generación de imágenes está activada.
- Quitar el NPC del diario.

## Modos de Game Master

Eliges quién dirige el juego en el asistente de configuración, en el paso **Party** (Grupo), bajo **Game Master Mode** (Modo de Game Master). Hay dos opciones:

- **Standalone GM**: la predeterminada. Marinara construye un game master por ti. El asistente lo describe como "A snarky narrator running the show" (Un narrador sarcástico dirigiendo el espectáculo). No necesitas una tarjeta de personaje.
- **Character GM**: usa una de tus propias tarjetas de personaje como Game Master. El motor le dice al modelo que actúe como ese personaje mientras sigue dirigiendo el juego. Elige esta opción cuando quieras una voz de narrador específica.

Si es tu primer juego, usa **Standalone GM**. Puedes establecer el modo cuando creas el juego. Para el recorrido completo de configuración, consulta [Game Mode: primeros pasos](getting-started.md).

## Guías relacionadas

- [Game Mode: primeros pasos](getting-started.md)
- [Game Mode: sesiones y partidas guardadas](sessions-and-saves.md)
