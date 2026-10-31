# Game Mode: jugar con un conjunto de reglas

Un conjunto de reglas explica a Game Mode cómo funciona un sistema de mesa: qué dados tira una prueba, qué contiene la ficha, qué recursos se gastan, qué recupera un descanso y, en algunos conjuntos de reglas, cómo se libra una pelea completa. Esta guía explica cómo obtener un conjunto de reglas, elegirlo para una partida y qué cambia al jugar con él. Una partida sin conjunto de reglas usa las reglas propias de Marinara, descritas en las demás guías de Game Mode.

<a id="getting-a-ruleset"></a>

## Obtener un conjunto de reglas

Los conjuntos de reglas vienen de dos lugares. Los oficiales, como 5e (SRD 5.1), se instalan desde **Agent Organizer (Organizador de agentes)**, donde están marcados con **Rules**. Los de la comunidad se importan desde un archivo o desde el repositorio de GitHub de quien los creó, y se archivan según su origen, como `local/ember-roads` o `alice/v20`. Importarlos usa el mismo interruptor **Allow custom Agent imports** (permitir importaciones de agentes personalizados) que los agentes importados. Mientras ese interruptor está desactivado, los conjuntos importados se dejan fuera de las partidas nuevas, y las partidas que ya usan uno siguen funcionando. Una partida con un conjunto importado siempre se juega con la versión exacta con la que se creó. Para escribir el tuyo, consulta [Escribir conjuntos de reglas de Game Mode](../extending/writing-rulesets.md).

### Idioma

El texto propio de un conjunto de reglas, como los nombres de sus habilidades, sus conjuros y el texto para el Game Master, sigue el idioma elegido en **Settings** (Configuración). Un conjunto de reglas oficial descarga solo la traducción de ese idioma, obtiene la nueva cuando cambias de idioma y recurre al inglés para un idioma al que no se haya traducido. Un conjunto de reglas importado desde un archivo conserva solo la traducción del idioma que usabas cuando lo importaste; para cambiar, importa el archivo de nuevo.

<a id="choosing-a-ruleset-for-a-game"></a>

## Elegir un conjunto de reglas para una partida

**Rules** solo aparece cuando hay al menos un conjunto de reglas instalado, y solo para una partida nueva. Es independiente de **Combat Preference**: uno decide cómo funcionan las pruebas y las fichas de personaje, y el otro decide cómo se muestran las batallas.

- **Marinara's own rules** es la opción predeterminada: las pruebas d20 integradas y la ficha de seis atributos.
- **Un conjunto de reglas**, como **5e (SRD 5.1)**, muestra un breve resumen de lo que cubre y una línea que dice qué harán las batallas. Un conjunto que resuelve sus propios combates lo indica. Uno que solo presta la ficha indica que las batallas usan el combate de Marinara con la salud, la energía y las habilidades propias de la ficha. Uno que no hace ninguna de las dos cosas indica que las batallas usan el combate de Marinara y nombra la **Combat Preference** que elegiste.

El conjunto de reglas se fija al crear la partida y se queda con esa partida. No se puede cambiar ni añadir más tarde.

Algunos conjuntos de reglas ofrecen **layers** (capas): variantes con nombre, como Low magic o Hard winter, que se muestran como interruptores debajo del conjunto con una línea que dice qué hace cada una. Una capa puede endurecer las dificultades, limitar una opción de la ficha de personaje, dejar fuera algunas entradas ya hechas del selector del editor de fichas y darle al Game Master instrucciones adicionales, también para el mundo que construye durante la configuración. Algunas capas se excluyen entre sí, y el asistente desactiva la que no puedes tener. Las capas quedan fijadas cuando empieza la partida, exactamente igual que el propio conjunto, y una ficha que ya usa algo que una capa retira lo conserva.

Después de elegir un conjunto de reglas, el paso **Party** enumera tu persona y los miembros del grupo debajo de los selectores e indica quién **Has a sheet** (Tiene ficha) para él y quién **Starts on a blank sheet** (Empieza con una ficha vacía). Una ficha se añade en **Stats** (Estadísticas), en el editor de personajes o de personas (consulta [Fichas de conjuntos de reglas](../characters/colors-and-stats.md#ruleset-sheets)). La partida toma una copia de cada ficha cuando se genera el mundo. Nada de lo que cambias en la partida vuelve al personaje o a la persona. Un miembro sin ficha recibe una vacía con todos los valores en el predeterminado del conjunto; la generación del mundo nunca inventa puntuaciones.

Un archivo de configuración compartido recuerda su conjunto de reglas. Si importas uno y no tienes ese conjunto, o tienes una versión más antigua, el asistente te dice qué conjunto era y la partida usa las reglas propias de Marinara, salvo que lo instales y lo elijas.

<a id="what-happens-in-battles"></a>

## Qué ocurre en las batallas

Lo que hace un conjunto de reglas en una pelea depende de cómo se haya escrito. La línea debajo del conjunto de reglas en el asistente de configuración indica cuál de estos casos se aplica.

| El conjunto de reglas                                   | Batallas                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Resuelve sus propias peleas, como 5e (SRD 5.1) | Se libran con las reglas propias del conjunto de reglas, en su propia pantalla de batalla. Consulta [Peleas con un conjunto de reglas](fighting-on-a-ruleset.md). |
| Presta su ficha a las batallas                    | El combate propio de Marinara, usando la salud, los espacios de conjuro y los atributos de la ficha. Consulta más abajo.                            |
| No dice nada sobre las batallas                    | El combate propio de Marinara, exactamente como en una partida sin conjunto de reglas. Consulta [Combate](combat.md).                             |

Cuando el conjunto de reglas presta su ficha a las batallas, cada miembro del grupo empieza la pelea con la reserva de recursos y los espacios de conjuro que el conjunto de reglas haya configurado para las batallas, tal como los tiene en su ficha en ese momento. Las capacidades de catálogo pasan a ser habilidades solo si el combate de Marinara Engine puede ejecutarlas. Se omiten entradas no destinadas al combate, reacciones y costes incompatibles. La salud se transfiere como proporción del máximo: media salud en la ficha equivale a media barra en batalla, porque las cifras de la batalla son las de Marinara. Una ficha con 9 de salud no entra en una pelea en la que un golpe hace 12. Al terminar se devuelve esa proporción; los recursos y espacios se transfieren directamente. El resto de la batalla no cambia: el cálculo de los dados sigue siendo el de Marinara (consulta [Cómo funciona el cálculo del combate](combat.md#how-combat-math-works)), y no se aplican las tiradas de ataque, las tiradas de salvación ni la concentración del sistema de mesa. Borrar el mensaje que inició el combate no devuelve cambios a la ficha.

<a id="checks-on-a-ruleset"></a>

## Pruebas con un conjunto de reglas

Con un conjunto de reglas, el Game Master pide pruebas como en cualquier partida (consulta [Pruebas de habilidad](dice-and-skill-checks.md#skill-checks)), pero el conjunto de reglas decide cómo se tiran:

- El Game Master sigue limitándose a nombrar la habilidad o la salvación y a fijar una dificultad. Recibe la escala de dificultad propia del conjunto en lugar de la integrada. Una dificultad puede llegar tan lejos como esa escala, incluso más allá del 1–40 que permiten las reglas propias de Marinara. Hay una vía que sigue limitada a 1–40 incluso en una partida con conjunto: la resolución de emergencia de una prueba pendiente en un turno guardado.
- El motor tira los dados del conjunto y suma el modificador de la **ficha del conjunto de reglas** del personaje, formado por las partes que declare el conjunto: el modificador de atributo cuando la habilidad o la salvación nombra un atributo, la bonificación de su nivel de entrenamiento (un múltiplo de la bonificación de competencia, un valor fijo o ambos) y cualquier bonificación adicional anotada en la ficha. No usa los atributos ni las bonificaciones de habilidad integrados.
- Una prueba puede ser para un miembro del grupo. El Game Master añade `who="Name"` a la etiqueta y el motor usa la ficha de ese personaje. Sin `who`, la prueba es del jugador. Un miembro del grupo que aún no tiene ficha tira con una en blanco, con todos los valores en el predeterminado del conjunto. Un nombre que no coincide con nadie del grupo, o que comparten dos miembros, tira los dados sin ningún modificador. La única excepción es el nombre de tu propio personaje: si un miembro del grupo lo comparte, ese nombre sigue refiriéndose a ti y usa tu ficha. Nunca se toma prestada otra ficha.
- Los resultados naturales dependen del conjunto. En 5e (SRD 5.1), un 20 o un 1 natural no tiene efecto especial en pruebas ni salvaciones, así que un 20 natural que no alcanza la dificultad falla. Esto difiere a propósito de las reglas propias de Marinara.
- Los números que escribe el propio Game Master no se dan por buenos. Una etiqueta que parece terminada se vuelve a tirar y se sustituye cuando su modificador no es el de la ficha, cuando tiró una cantidad o un tamaño de dados distintos de los del conjunto, cuando el dado que contó no es el que conserva su modo de tirada o cuando afirma un resultado natural que el conjunto no tiene.
- Una tirada manual previa solo se reutiliza para una d20 individual. Otros dados, como 2d6 o una reserva, se vuelven a tirar.
- El Game Master puede tirar una habilidad o una salvación con un atributo distinto del que usa normalmente, añadiendo `with="Ability"` a la etiqueta. Solo cuenta un atributo que declare tu conjunto; cualquier otro se ignora y la habilidad conserva el suyo.
- El Game Master puede nombrar una dificultad de la escala en lugar de escribir su número, como `difficulty="Hard"`. El motor tira contra el número de ese escalón, y la prueba guardada muestra el número. Un nombre que la escala no tiene se ignora.
- Los marcadores de tirada pueden nombrar los atributos, habilidades y salvaciones del conjunto, y `PROF` para la bonificación de competencia cuando el conjunto la tiene.
- Si falta el paquete del conjunto o es más antiguo que aquel con el que se creó la partida, las pruebas se guardan sin números y quedan pendientes. Nunca se resuelven con las reglas de otro sistema.
- Si algo elegido en tu ficha modifica una tirada, como un amuleto que vuelve a tirar los dados fallidos, el GM lo nombra en la prueba y el motor cobra su coste, aplica su efecto y tira. Si no lo has elegido o no puedes pagarlo, no hace ni cuesta nada.
- Si el conjunto permite gastar un recurso para mejorar una tirada, el GM lo indica en la prueba y el motor cobra los puntos, añade lo comprado y tira como una sola operación. Si la reserva no alcanza, no se gasta nada y se hace la tirada original. El registro muestra lo realmente pagado, no lo solicitado. Cuánto puede comprar una prueba lo fija el conjunto: un número fijo, un número de tu ficha o tantos como dados tenga la prueba.
- Si el conjunto indica que un número de tu ficha acompaña a ciertas tiradas, como una mochila pesada en cada tirada de Brawn, el motor lo suma a cada prueba a la que se aplica, y la tarjeta de dados indica lo que añadió la ficha.
- Un conjunto puede indicar qué hace una prueba cuando no tienes entrenamiento en la habilidad: puede costarte dados o puntos, ser un escalón más difícil o no ser posible en absoluto. Una prueba que no puedes intentar sin entrenamiento no se tira, y la narración lo dice en lugar de mostrar un resultado. Tu ficha no muestra ningún número para esa habilidad hasta que la entrenas.
- Si el conjunto tiene un contador de heridas cuya penalización afecta a las tiradas, cada prueba se dificulta al recibir daño. En reservas, resta dados sin bajar del mínimo permitido, que algunos sistemas fijan en cero. En tiradas sumadas, aplica una penalización fija. La prueba indica cuánto se aplicó, para explicar por qué tiraste menos dados. Consulta [La ficha del conjunto](#the-ruleset-sheet).
- El Game Master también mantiene al día en la ficha los recursos, estados y descansos de cada personaje, y el motor rechaza un cambio que la ficha no permite. Consulta [La ficha del conjunto](#the-ruleset-sheet).

### Conjuntos con reservas de dados

Algunos sistemas no suman una bonificación a la tirada. En su lugar, el número de la ficha es cuántos dados tiras, y cuentas los que salen lo bastante altos. Un conjunto puede escribirse así, y una partida con uno se comporta de forma un poco distinta:

- **El número de la ficha son dados.** Un atributo de 3 y un oficio que vale 2 tiran cinco dados. Tu ficha lo muestra como "5 dice" en lugar de "+5", en el editor y en lo que lee el Game Master.
- **La dificultad es un número de éxitos.** Un trabajo difícil pide tres éxitos, no un total de 15. La escala de dificultad del conjunto indica cuántos necesita cada escalón.
- **El motor tira los dados y los cuenta.** Qué caras cuentan, si una cara alta tira otro dado o cuenta doble, si las caras bajas cancelan éxitos y qué cuenta como pifia o como éxito excepcional: todo procede del conjunto. La tarjeta de dados muestra todos los dados tirados, con los que alcanzaron el objetivo separados de los que no, e indica cuántos éxitos salieron frente a cuántos necesitaba la prueba. Una reserva grande ocupa más filas en lugar de encogerse, y la tarjeta nunca muestra una suma que los dados no hayan dado.
- **El Game Master puede ajustar una prueba**, si el conjunto lo permite: un objetivo por dado más difícil o más fácil, dados añadidos o quitados por las circunstancias, y una cara más baja a partir de la cual los dados se vuelven a tirar o cuentan doble. Cada ajuste se mantiene dentro del rango que declara el conjunto. Un escalón de la escala de dificultad puede llevar su propio objetivo por dado, que se aplica cuando el Game Master elige ese escalón. La tarjeta de dados indica cuándo una prueba volvió a tirar o contó doble en una cara distinta de la habitual del conjunto.
- **Los dados se pueden volver a tirar**, si el conjunto tiene una regla para ello: el Game Master la nombra en la prueba cuando la situación lo pide, y los dados que salieron bajos se vuelven a tirar, una vez o hasta que salgan más altos. Un recurso que gastas puede comprar lo mismo. Una tirada solo se repite de una forma; cuando se aplicarían dos, se usa la que alcanza más dados.
- **Se pueden tirar dos atributos juntos**, si el conjunto lo indica: una prueba de atributo puede añadir los dados de un segundo atributo, de modo que dos puntuaciones se tiran como una sola reserva.
- **Algunos conjuntos pueden torcerse además del resultado.** En un conjunto que cuenta como pifia que la mitad de los dados o más saquen caras bajas, una prueba que aun así consiguió sus éxitos conserva su resultado, y la tarjeta de dados añade que, además, algo salió mal. Sin ningún éxito, es un fallo crítico.
- **El Game Master nunca aporta los números.** Un resultado de reserva escrito en la narración siempre se sustituye por la tirada propia del motor. No se aplican la ventaja ni una tirada manual previa.
- **Dejar que el Game Master vea un dado de cada tamaño no se aplica a estas pruebas.** Los dados que se le muestran son de veinte caras; el motor tira la prueba de reserva a ciegas y se narra como cualquier otra tirada a ciegas.

### Otras formas de tirar de un conjunto

Un conjunto también puede tirar sus pruebas de otras formas. El motor sigue tirando los dados, y la tarjeta de dados sigue al conjunto:

- **Quedarse con los dados más altos.** Tira un puñado de dados y lee el más alto, los dos más altos o los tres más altos, según indique el conjunto.
- **Tirar contra tu ficha.** Saca un resultado igual o inferior a un número de tu ficha, como un porcentaje de habilidad, en lugar de sumar una bonificación a los dados.
- **Dados con sus propias caras.** Las caras pueden valer algo distinto de su número, como menos, blanco y más. Algunos dados llevan símbolos en lugar de números, como éxito, ventaja y sus opuestos.
- **Resultados por franjas.** Una prueba puede caer en uno de varios resultados, como un éxito crítico o un éxito con un coste, en lugar de un simple acierto o fallo. La tarjeta de dados nombra la franja, y el Game Master la narra.
- **Unas pocas pruebas tiradas de otra forma.** Un conjunto puede tirar la mayoría de las pruebas de una forma y nombrar unas pocas que se tiran de forma distinta.

<a id="the-ruleset-sheet"></a>

## La ficha del conjunto

En una partida con un conjunto de reglas, cada hoja de personaje empieza con un bloque **Ruleset sheet** (Ficha del conjunto de reglas). Su estructura procede del conjunto, así que una ficha de 5e y la de otro sistema se ven distintas. Una partida sin conjunto de reglas no tiene este bloque.

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

El botón separado **Edit Sheet** (consulta [Editar una ficha a mano](party-and-npcs.md#edit-a-sheet-by-hand)) sigue editando la hoja general (clase, habilidades, fortalezas, etc.) y no toca la ficha del conjunto.

Si se eliminó el paquete del conjunto, o la copia instalada es más antigua que aquella con la que se creó la partida, el bloque muestra un aviso en su lugar, y las pruebas no se pueden tirar hasta que se vuelva a instalar el paquete.

## La ficha del grupo y los relojes de progreso

Algunos conjuntos llevan una ficha para todo el grupo, como una tripulación o una compañía. Aparece en la pantalla del juego cerca del mapa, con el nombre que le da el conjunto. Haz clic en el nombre para abrirla. El Game Master la mantiene al día igual que la ficha de cada personaje y, donde el conjunto lo permite, tú también puedes editarla. Si otra persona guardó la ficha del grupo mientras editabas, se muestra su versión: **Save** (Guardar) la reemplaza por la tuya, y **Cancel** conserva la suya.

Un conjunto también puede usar **Progress clocks** (Relojes de progreso): círculos divididos en segmentos que el Game Master va llenando a medida que algo aumenta, como una alarma que se extiende. Aparecen cerca del mapa, cada uno con cuántos segmentos están llenos, y muestran **Done** (Completado) una vez llenos.

## Guías relacionadas

- [Game Mode: peleas con un conjunto de reglas](fighting-on-a-ruleset.md)
- [Game Mode: dados y pruebas de habilidad](dice-and-skill-checks.md)
- [Game Mode: grupo y NPC](party-and-npcs.md)
- [Colores de personaje y estadísticas RPG: fichas de conjuntos de reglas](../characters/colors-and-stats.md#ruleset-sheets)
- [Escribir conjuntos de reglas de Game Mode](../extending/writing-rulesets.md)
