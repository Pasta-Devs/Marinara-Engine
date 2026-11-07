# Game Mode: grupo y NPC

Esta guía cubre a las personas de tu campaña en Game Mode: los miembros de tu grupo y los NPC (personajes no jugadores) que presenta el Game Master (GM, el director del juego). Úsala para abrir y editar las hojas de personaje, gestionar el inventario, leer el Adventure Journal y elegir un modo de GM. Para la configuración y lo básico, consulta [Game Mode: primeros pasos](getting-started.md).

## Revisar tu grupo y tu inventario

1. Haz clic en **Character Profiles** (Perfiles de personajes) y elige un retrato para ver la hoja de ese personaje.
2. Haz clic en **Inventory** (Inventario) encima del texto de la historia para ver lo que lleva cada uno.

A continuación se detallan ambos.

<a id="character-profiles"></a>

## Perfiles de personajes

**Character Profiles** es un botón de retrato que muestra quién viaja contigo. Se queda fuera del menú **Chat tools** (Herramientas del chat). Consulta [Los controles del juego](getting-started.md#the-games-controls). Con varios miembros en el grupo, va alternando sus retratos y muestra una insignia con el número. Antes de que la historia añada a alguien, el grupo es solo tu persona.

1. Haz clic o toca el botón **Character Profiles**.
2. Haz clic o toca un retrato para abrir la hoja de ese personaje.

Para quitar a un compañero, en una computadora pasa el cursor sobre su retrato y haz clic en la **X**. Esto funciona con cualquier compañero que haya reclutado el GM, durante la configuración o más tarde. Tu propia persona (el personaje que interpretas) no tiene **X**.

Puedes arrastrar el botón por el chat en una computadora o en un teléfono. Ábrelo y usa **Lock window** (Fijar ventana) para mantenerlo en su sitio. En una computadora también puedes mover la ventana y cambiar su tamaño, y **Close** (Cerrar) la devuelve a su botón. Su posición se guarda con el chat, y sigue tu estilo de widgets del chat de **Settings → Appearance → App** (Configuración → Apariencia → App). En los teléfonos se mantiene separado del menú de tres puntos **Chat tools**.

## Hojas de personaje

Una hoja de personaje es un resumen de juego de un miembro del grupo, distinto de la tarjeta de personaje. En una partida con clases **MRPG**, como todas las partidas nuevas, empieza con la ficha de clase MRPG del personaje: las pestañas **Status** (Estado), **Classes** (Clases), **Skills** (Habilidades) y **Gear** (Equipo), donde cambias de clase, llevas habilidades y equipas piezas. Consulta [La ficha de personaje](mrpg-classes.md#the-character-sheet). Sus estadísticas MRPG sustituyen a los **Attributes** de abajo.

Debajo, el GM escribe la parte narrativa de la hoja a partir de tu personaje y de la historia actual. Muestra las secciones que tienen contenido:

| Sección | Qué contiene |
| --- | --- |
| **Attributes** (Atributos) | Solo en partidas Legacy: puntuaciones como STR, DEX y CON con un modificador, y barras de recursos como HP o MP. |
| **Stats** (Estadísticas) | Otras barras de estadísticas. |
| **Abilities** (Habilidades) | Cosas que el personaje puede hacer. |
| **Strengths** (Fortalezas), **Weaknesses** (Debilidades) | Listas cortas. |
| **Details** (Detalles) | Datos adicionales como Skills, Weapon o Faction. |
| **Inventory** | Objetos que lleva el personaje. |
| **Traits** (Rasgos) | Otros campos personalizados. |

Un personaje nuevo puede mostrar "Character data will populate as the story progresses." (Los datos del personaje se completarán a medida que avance la historia). La hoja se va rellenando mientras juegas.

<a id="edit-a-sheet-by-hand"></a>

### Editar una hoja a mano

**Retry** (Reintentar), **Save Sheet** (Guardar hoja) y **Cancel** (Cancelar) solo aparecen después de hacer clic en **Edit card** (Editar tarjeta).

1. Abre la hoja del personaje y haz clic en **Edit card**.
2. Cambia lo que necesites:
   - **Class** (Clase) y una descripción corta en **Sheet Details** (Detalles de la hoja).
   - **Story stats** (Estadísticas de historia; partidas Legacy): activa **Enable** (Activar) para llevar el registro de reservas y atributos. **Add Pool** (Añadir reserva) añade una barra (nombre, valor actual, valor máximo, color). **Add Attribute** (Añadir atributo) añade una puntuación como STR. Una partida con clases MRPG no los usa para pruebas ni peleas.
   - **Abilities**, **Strengths** y **Weaknesses**: **Add** (Añadir) agrega una línea.
   - **Details**: **Add Detail** (Añadir detalle) añade un dato con etiqueta.
3. Haz clic en **Save Sheet**. Haz clic en **Cancel** para descartar tus cambios.

Para que la IA vuelva a crear la hoja, haz clic en **Retry** mientras editas. Usa el personaje y el historial actual del juego, y hace una solicitud a tu modelo. Crea un borrador: "new sheet draft is ready. Review it, then save to apply." (el borrador de la hoja nueva está listo; revísalo y luego guarda para aplicarlo). Revisa el borrador y luego haz clic en **Save Sheet**. Úsalo después de que la historia haya cambiado mucho a un personaje. En una pantalla estrecha, el botón solo muestra un icono.

<a id="the-ruleset-sheet"></a>

### La ficha del conjunto

En una partida con un conjunto de reglas, cada hoja empieza con un bloque **Ruleset sheet** (Ficha del conjunto de reglas) cuya estructura define el conjunto de reglas: sus recursos, contadores, estados, descansos y un resumen de la construcción del personaje, que el GM mantiene actualizado mientras narra. Consulta [La ficha del conjunto de reglas](rulesets.md#the-ruleset-sheet).

## Reclutar y quitar miembros del grupo

El GM controla quién está en tu grupo mediante la narración. No hay ningún botón de "añadir compañero".

Cuando el GM agrega un NPC cuyo nombre coincide exactamente con el de una de tus tarjetas de personaje, o con el de varias, una ventana pregunta cuál se une. Muestra el nombre, el título y el avatar de cada tarjeta. Elige una tarjeta, o elige **Keep the game's own** (Conservar el del juego) y el nombre del NPC (por ejemplo, **Keep the game's own Emma**) para traer al personaje que creó el juego. Cerrar la ventana hace lo mismo. Una tarjeta que solo tiene un nombre parecido, como **Samantha** para un NPC llamado Sam, nunca se agrega.

Una Experience puede traer sus propios compañeros: personas de su mundo que pueden unirse a ti, cada una con una hoja ya preparada. La historia puede incorporar a uno o hacer que se vaya, y el GM solo puede reclutar a esos compañeros (los personajes de tu propia biblioteca todavía pueden unirse). Un compañero se une al nivel más alto de tu grupo y sube de nivel con el grupo.

## El inventario

Haz clic en el botón **Inventory** encima del texto de la historia. Se abre una cuadrícula de cuadros. Cada cuadro es una pila: un objeto y cuántos hay. Haz clic en una pila para seleccionarla.

Cada miembro del grupo tiene su propia bolsa. El inventario se abre en **All** (Todos), que muestra todas las bolsas juntas, con el nombre de quien lleva cada pila. Haz clic en la pestaña de un miembro del grupo para ver solo su bolsa. Mientras nadie más lleve nada, no hay pestañas.

- **Cambiar la cantidad.** Usa **-** y **+** para quitar o añadir una. O escribe un número entre ellos y pulsa <kbd>Enter</kbd>.
  - Un número fija la cantidad: `300`.
  - Un signo añade o quita esa cantidad: `+100`, `-50`.
  - Poner 0 quita la pila, y pregunta antes cuando hay más de una.
- **Dividir una pila.** Haz clic en **Split** (Dividir), escribe cuántos van a la nueva pila y vuelve a hacer clic en **Split**.
- **Dar.** Haz clic en **Give** (Dar), elige quién lo recibe y cuántos, y vuelve a hacer clic en **Give**. O arrastra una pila entera a la pestaña de esa persona.
- **Añadir.** Escribe el nombre del objeto y haz clic en **Add**. Va a la bolsa de la pestaña abierta, o a tu propia bolsa desde **All**. Añadir un objeto que la bolsa ya tiene suma uno a su primera pila.
- **Combinar.** Arrastra una pila sobre otra pila del mismo objeto. La pila combinada se queda con quien llevaba la pila sobre la que la soltaste.
- **Intercambiar.** Arrastra una pila sobre un objeto distinto para intercambiar los dos.
- **Usar.** Haz clic en **Use** (Usar) para decirle al GM que usas el objeto.
- **Apodo.** Escribe un nombre nuevo y haz clic en **Save** (Guardar). El objeto conserva su nombre propio, que aparece a su lado, y un apodo nunca combina pilas. Vuelve a escribir el nombre propio para quitar el apodo.

### Cómo cambia el GM tu inventario

El GM añade, quita y entrega objetos a medida que avanza la historia, e indica quién los lleva.

- Cuando toma un objeto sin decir de quién, sale primero de tu bolsa y luego del grupo.
- Un cambio que no puede ocurrir, como tomar algo que nadie tiene, se rechaza, y se le avisa al GM.
- Los cambios se hacen cuando se guarda la respuesta. Regenerar una respuesta vuelve a empezar desde donde empezó ese turno. Volver atrás con un swipe (respuesta alternativa) muestra lo que dejó esa versión. Una rama conserva el inventario de cada versión.
- Si cambias algo tú, una respuesta nueva añade sus cambios encima y no se deshace nada de lo que hiciste.
- Un combate usa objetos desde la acción **Items** (Objetos) y cuenta juntas todas las pilas de un objeto.
- Todas las bolsas, divisiones y apodos pasan a la siguiente sesión.

## El Adventure Journal

El Adventure Journal (Diario de aventura) es un registro continuo de tu campaña. Se construye a partir de eventos guardados del juego, no lo escribe la IA, así que se mantiene fiel a los hechos.

1. Abre **Session** (consulta [Abrir Session](sessions-and-saves.md#opening-session)).
2. Elige la pestaña **Journal** (Diario).

| Pestaña | Qué muestra |
| --- | --- |
| **Timeline** (Cronología) | Lo que ha pasado: lugares encontrados, encuentros con NPC, resultados de combate, misiones y eventos de objetos. |
| **NPCs** | Los NPC que has conocido, con retratos y etiquetas de reputación. |
| **Map** (Mapa) | Una lista simple de los nombres de lugares que has descubierto. |
| **Items** | Un registro de los objetos que adquiriste, usaste, perdiste o quitaste. |
| **Library** (Biblioteca) | Notas y libros del mundo del juego que el GM te ha mostrado, guardados para releerlos. |
| **Notes** (Notas) | Tu propio bloc de notas. |
| **World** (Mundo) | En una partida con un mundo generado, el mundo tal como lo conoce tu grupo. |

La pestaña **World** muestra dónde estás y lo conocido que es el grupo, su reputación con cada agrupación, lo que ha hecho, las noticias que le han llegado (los rumores están marcados), los problemas que se están gestando y de los que ha oído hablar, y el pasado que contaría cualquier lugareño. Solo muestra lo que el grupo podría saber. Los secretos que solo conoce el GM siguen ocultos. Sigue la historia a través de los swipes y las ramas.

### Notas del jugador

En la pestaña **Notes**, escribe a la izquierda y a la derecha se muestra una vista previa con formato. Un aviso advierte que tus notas son visibles para el GM y los miembros del grupo, así que cualquier cosa que escribas puede influir en la historia. Las notas se guardan un momento después de que dejas de escribir. La etiqueta muestra **Saving...** (Guardando...) y luego **Saved** (Guardado).

### Etiquetas de reputación de los NPC

Cada NPC de la pestaña **NPCs** muestra un retrato, un nombre y una etiqueta de reputación que cambia según cómo actúas. Un NPC aparece una vez que el GM lo ha descrito, le ha dado una reputación o ha registrado una nota de relación. Una etiqueta solo aparece después de que la reputación se ha alejado de su punto de partida, así que un NPC totalmente nuevo no muestra ninguna.

| Etiqueta | Significado |
| --- | --- |
| **Devoted** | Profundamente leal a ti |
| **Allied** | Aliado fuerte |
| **Friendly** | Positivo |
| **Neutral** | Sin sentimiento marcado |
| **Unfriendly** | Negativo |
| **Hostile** | Se volvió en tu contra |
| **Enemy** | Activamente opuesto |

Cada fila de NPC también te permite subir o reemplazar el retrato, generar un retrato con IA (si la generación de imágenes está activada) y quitar el NPC del diario.

## Modos de Game Master

Eliges quién dirige el juego en el asistente de configuración, en el paso **Party** (Grupo), bajo **Game Master Mode** (Modo del Game Master). El modo se establece cuando creas la partida.

- **Standalone GM** (predeterminado): Marinara construye un GM por ti. El asistente lo describe como "A snarky narrator running the show" (Un narrador sarcástico dirigiendo el espectáculo). No necesitas ninguna tarjeta de personaje.
- **Character GM**: una de tus propias tarjetas de personaje es el GM. El modelo actúa como ese personaje mientras sigue dirigiendo el juego. Elige esta opción para tener una voz de narrador específica.

Si es tu primera partida, usa **Standalone GM**.

## Referencia: inventario con conjunto de reglas

Estas partes solo se aplican a las partidas que usan un conjunto de reglas, o un kit de ambientación con dinero. Consulta [Jugar con un conjunto de reglas](rulesets.md).

### Objetos del conjunto de reglas

Estos controles solo aparecen cuando la partida usa un conjunto de reglas que tiene objetos.

- **From the ruleset** (Del conjunto de reglas) abre un selector con los objetos del conjunto, con su búsqueda y sus filtros. Marca objetos y haz clic en **Add**: uno de cada va adonde **Add** pone un objeto. Un nombre que escribes y que es uno de los objetos del conjunto añade ese objeto. Algunos conjuntos solo aceptan sus propios objetos, y entonces no hay nombre que escribir.
- **Starting gear** (Equipo inicial) abre el equipo con el que el conjunto ofrece empezar. Elige para quién es en **For** (Para), toma las decisiones que pida el kit y haz clic en **Take** (Tomar). El equipo que encaja con la hoja del personaje aparece primero. Tomarlo es opcional. Cuando se ha tomado todo, el botón dice **Starting gear (taken)** (Equipo inicial: tomado).
- **Use** en un objeto del conjunto que dice lo que hace, como una cataplasma curativa, hace que Marinara lo aplique primero:
  - Tira lo que devuelve el objeto y lo anota en la hoja de quien lo lleva.
  - Quita uno de la pila o gasta una carga, y le cuenta al GM lo que pasó.
  - Lo que le hace a otra persona se deja al GM.
  - Un objeto al que no le queda nada se rechaza, y uno que hay que llevar puesto solo funciona mientras está puesto.
  - Algunos objetos piden antes una prueba, como un pergamino por encima de tu nivel de lectura. Marinara la tira y, si falla, el objeto se gasta para nada.
- Al seleccionar un objeto del conjunto se muestran su tipo, rareza, etiquetas, estadísticas y descripción. Una pila solo contiene tantos como diga el conjunto, y los objetos que sobran empiezan una pila nueva.
- El GM puede inventar un objeto con las palabras del conjunto, como una espada con nombre. Funciona como un objeto del conjunto, y sus detalles indican que fue inventado y qué cambió Marinara para ajustarlo al conjunto, como una bonificación limitada a lo que permite su rareza.
- Algunos conjuntos desactivan los objetos propios de Game Mode. Entonces el GM solo da los objetos del conjunto y los que inventa, y tú todavía puedes escribir objetos propios salvo que el conjunto acepte solo los suyos.

### Llevar puesto, vincular y cargar

Un conjunto de reglas puede indicar cómo se llevan puestos y se cargan sus objetos.

- **Equipado.** Un objeto que ocupa espacios, como una armadura en el cuerpo o un arco en ambas manos, tiene un botón **Equipped** (Equipado). Su portador puede llevarlo puesto mientras esos espacios estén libres. La pestaña de la bolsa muestra los espacios en uso, como **Hands 2/2** (Manos 2/2). Equipar un objeto de una pila más grande lo pasa a una pila propia, marcada como puesta.
- **Vínculo.** Un objeto que tiene que estar vinculado para funcionar (sintonizado, investido) tiene un botón con la palabra que usa el conjunto, como **Bound** (Vinculado). Un personaje solo puede vincular tantos como permita la hoja, lo que se muestra como **Bound 1/3** (Vinculados 1/3). Un objeto maldito, una vez vinculado, no se puede desvincular, quitar, dar ni tirar. Solo la historia, a través del GM, puede acabar con la maldición.
- **Carga.** Cuando el conjunto fija pesos y capacidad, cada bolsa muestra su carga, como **Load 5/6, at most 12** (Carga 5/6, como máximo 12), y **Encumbered** (Sobrecargado) cuando supera lo que su portador lleva con comodidad. Un objeto añadido desde **All** va a alguien que pueda llevarlo sin quedar sobrecargado: primero tú y luego el grupo en orden. Si nadie puede, se reparte según el espacio que le queda a cada uno, y a nadie se le da más de lo que puede llevar en total. Lo que nadie puede llevar se queda atrás, y se te avisa. Se rechaza usar **Give** o arrastrar una pila sobre una bolsa cuando eso superaría su límite.

Dar a otra persona un objeto puesto o vinculado se lo quita y lo desvincula. En un conjunto con estas reglas, el GM también pone y quita objetos, los vincula y desvincula, y ve la carga, los espacios y los objetos vinculados de cada uno.

### Dinero y mercados

Un conjunto de reglas puede tener su propio dinero: familias de monedas, como peniques, chelines y coronas, donde cada moneda más grande vale cierto número de la más pequeña. Las monedas son pilas como cualquier objeto. Pesan lo que diga el conjunto, cuentan para la carga de quien las lleva, y puedes dividirlas, darlas y combinarlas. **From the ruleset** tiene una lista **Coins** (Monedas) para añadirlas a mano. Encima de las pilas, una línea muestra cada familia de la pestaña abierta y su total, como **Coin: crowns ×2, pennies ×12 (worth 132 pennies)** (Monedas: coronas ×2, peniques ×12; valen 132 peniques).

- El GM cobra y paga al grupo en estas monedas. Un combate ganado o un tesoro que se tira también pueden soltarlas. Un pago sale del monedero de un personaje, el tuyo salvo que diga de quién.
- Un precio solo se paga en la familia en la que está expresado, así que un precio en sal se paga en sal. Primero salen las monedas más grandes, y cuando no está la cantidad exacta se cambia una moneda más grande y la vuelta se da en monedas más pequeñas.
- Un precio que el monedero no puede cubrir se rechaza, y se le avisa al GM. Cada pago y cada ganancia aparecen como una notificación.
- Una variante del conjunto puede dejar fuera una moneda. Entonces nadie paga ni cobra con esa moneda, y un precio expresado en ella se muestra en las monedas que quedan, con el mismo valor.

Un conjunto de reglas también puede tener mercados, de modo que lo que puedes comprar depende de dónde estás.

- El GM indica en qué lugar ocurre una escena y su tamaño, una aldea o una ciudad con las palabras del conjunto. Un lugar pequeño vende menos: las cosas raras quizá solo se encuentren en un pueblo, y algunos vendedores solo tienen tienda en lugares más grandes o solo atienden a algunos compradores, como una capilla que solo vende a los fieles.
- Cuando compras, Marinara calcula el precio a partir del coste del objeto y de lo barato o caro que sea el trato, lo toma del monedero del comprador y pone el objeto en su bolsa. El alojamiento, los pasajes y otros servicios solo se pagan.
- Una compra que el lugar, el vendedor o el monedero no pueden hacer se rechaza, y se le dice al GM por qué.
- Un conjunto puede hacer que cada día en un lugar sea distinto: un lugar puede tener solo unas pocas unidades de algo raro, un vendedor puede ofrecer algo inusual, y puedes revender cosas por una parte del precio hasta que los vendedores hayan gastado lo que pagan en un día. Un día nuevo en el mismo lugar, que el GM empieza cuando el grupo se queda, vuelve a llenar los estantes y los monederos.

Una partida sin conjunto de reglas también tiene dinero y mercado cuando su kit de ambientación los tiene. Todos los kits iniciales los tienen, por ejemplo cobre, plata y oro en alta fantasía, monedas de cobre y taeles de plata en wuxia, dólares y centavos en la época actual, y créditos en cyberpunk y ópera espacial. La tienda del kit enumera bienes cotidianos con un precio y el lugar más pequeño que vende cada uno, así que una aldea tiene una cafetería pero solo un pueblo tiene un botiquín. Puedes cambiar el dinero y la tienda en **Change its words** (Cambiar sus palabras) del kit, o quitar el dinero. Consulta [Elegir un kit de ambientación](getting-started.md#choosing-a-setting-kit).

## Guías relacionadas

- [Game Mode: jugar con un conjunto de reglas](rulesets.md)
- [Game Mode: primeros pasos](getting-started.md)
- [Game Mode: sesiones y partidas guardadas](sessions-and-saves.md)
