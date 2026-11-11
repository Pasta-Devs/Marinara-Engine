# Game Mode: jugar con un conjunto de reglas

Un conjunto de reglas explica a Game Mode cómo funciona un sistema de mesa: qué dados tira una prueba, qué contiene la ficha de personaje, qué recursos se gastan, qué recupera un descanso y, en algunos conjuntos de reglas, cómo se libra una pelea completa. Usa esta guía para obtener un conjunto de reglas, elegirlo para una partida y ver qué cambia al jugar. Una partida sin conjunto de reglas usa las reglas propias de Marinara, descritas en las demás guías de Game Mode.

<a id="get-a-ruleset"></a>

## Obtener un conjunto de reglas

Para instalar un conjunto de reglas oficial, como 5e (SRD 5.1):

1. Abre el panel **Agents** (Agentes) desde el icono de destellos.
2. Selecciona **Agent Organizer** (Organizador de agentes).
3. Busca el conjunto de reglas. Los conjuntos de reglas están marcados con **Rules** (Reglas).
4. Selecciona **Install** (Instalar).

Después, empieza una partida nueva y elígelo (consulta más abajo). Los conjuntos de reglas vienen de dos lugares:

- Los conjuntos de reglas **oficiales** se instalan como se indica arriba.
- Los conjuntos de reglas **de la comunidad** se importan desde un archivo o desde el repositorio de GitHub de quien los creó. Se archivan según su origen, como `local/ember-roads` o `alice/v20`.

Cualquiera de estos también funciona en un chat de Roleplay. Consulta [Roleplay: jugar con un conjunto de reglas](../roleplay/rulesets.md).

Importarlos usa el mismo interruptor **Allow custom Agent imports** (Permitir importaciones de agentes personalizados) que los agentes importados. Mientras está desactivado, los conjuntos de reglas importados se dejan fuera de las partidas nuevas, y las partidas que ya usan uno siguen funcionando. Una partida con un conjunto de reglas importado siempre se juega con la versión exacta con la que se creó. Para escribir el tuyo, consulta [Escribir conjuntos de reglas de Game Mode](../extending/writing-rulesets.md).

El texto propio de un conjunto de reglas, como los nombres de las habilidades, los conjuros y el texto para el Game Master (GM), sigue el idioma elegido en **Settings** (Configuración). Un conjunto de reglas oficial descarga solo la traducción de ese idioma, obtiene una nueva cuando cambias de idioma y recurre al inglés para un idioma que no tiene. Un conjunto de reglas importado desde un archivo conserva solo la traducción del idioma que tenías al importarlo. Para cambiarlo, importa el archivo de nuevo.

## Elegir un conjunto de reglas para una partida

**Rules** aparece en el paso **World** (Mundo) del asistente solo cuando hay al menos un conjunto de reglas instalado, y solo para una partida nueva. Es independiente de **Combat Preference** (Preferencia de combate): **Rules** define cómo funcionan las pruebas y las fichas, y **Combat Preference** define cómo se muestran las batallas.

1. En el asistente de configuración, abre el paso **World**.
2. En **Rules**, conserva **Marinara's own rules** (Las reglas propias de Marinara: las pruebas d20 integradas y la ficha de seis atributos), o elige un conjunto de reglas como **5e (SRD 5.1)**.
3. Lee el resumen. Enumera lo que cubre el conjunto de reglas y una línea sobre las batallas (consulta [Qué ocurre en las batallas](#what-happens-in-battles)).
4. Opcional: activa las **layers** (capas; consulta más abajo).
5. En el paso **Party** (Grupo), comprueba quién **Has a sheet** (Tiene ficha) y quién **Starts on a blank sheet** (Empieza con una ficha vacía). Una ficha son los números del personaje para este conjunto de reglas, como las puntuaciones y los puntos de vida. Una ficha vacía usa los valores predeterminados del conjunto de reglas. Puedes rellenarla más tarde.

El conjunto de reglas se fija al crear la partida. No puedes cambiarlo ni añadir uno más tarde.

Las **Layers** son variantes con nombre de un conjunto de reglas, como Low magic o Hard winter. Se muestran como interruptores debajo del conjunto de reglas, con una línea sobre lo que hace cada una. Una capa puede:

- endurecer las dificultades,
- limitar una opción de la ficha,
- ocultar algunas entradas ya hechas del selector del editor de fichas,
- cambiar lo que venden las tiendas y los tesoros que se sueltan,
- darle al GM instrucciones adicionales, también para el mundo que construye.

Algunas capas se excluyen entre sí, y el asistente desactiva la que no puedes tener. Las capas quedan fijadas cuando empieza la partida. Una ficha que ya usa algo que una capa retira lo conserva.

Una ficha se añade en **Stats** (Estadísticas), en el editor de personajes o de personas (consulta [Fichas de conjuntos de reglas](../characters/colors-and-stats.md#ruleset-sheets)). La partida copia cada ficha cuando genera el mundo, y nada de lo que cambias en la partida vuelve al personaje o a la persona. Un miembro sin ficha recibe una vacía con todos los valores en el predeterminado del conjunto de reglas. La generación del mundo nunca inventa puntuaciones.

Un archivo de configuración compartido recuerda su conjunto de reglas. Si importas uno y no tienes ese conjunto de reglas, o tienes una versión más antigua, el asistente te dice qué conjunto de reglas era y la partida usa las reglas propias de Marinara, salvo que lo instales y lo elijas.

<a id="what-happens-in-battles"></a>

## Qué ocurre en las batallas

Lo que hace un conjunto de reglas en una pelea depende de cómo se haya escrito. La línea del asistente debajo del conjunto de reglas indica qué fila se aplica.

| El conjunto de reglas | Batallas |
| --- | --- |
| Resuelve sus propias peleas, como 5e (SRD 5.1) | Se libran con las reglas propias del conjunto de reglas, en su propia pantalla de batalla. Consulta [Peleas con un conjunto de reglas](fighting-on-a-ruleset.md). |
| Presta su ficha a las batallas | El combate propio de Marinara, usando la salud, los espacios de conjuro y las capacidades de la ficha (consulta más abajo). |
| No dice nada sobre las batallas | El combate propio de Marinara, exactamente como sin conjunto de reglas. Consulta [Combate](combat.md). |

Cuando un conjunto de reglas presta su ficha, el combate de Marinara usa la ficha así:

- Cada miembro del grupo empieza la pelea con la reserva de recursos y los espacios de conjuro que el conjunto de reglas haya configurado para las batallas, tal como los tiene en su ficha en ese momento.
- Las capacidades elegidas de los catálogos del conjunto de reglas pasan a ser habilidades cuando el combate de Marinara puede usarlas. Se omite una entrada que solo describe algo fuera del combate, una reacción o una cuyo coste la batalla no puede cobrar.
- Los puntos de vida se transfieren como proporción del máximo, no como el número de la ficha. Un personaje a media salud empieza con media barra de salud en la pantalla de batalla, así que una ficha con 9 de salud nunca entra en una pelea en la que un golpe hace 12.
- Cuando termina la pelea, la salud perdida o recuperada se devuelve de la misma forma, y los espacios y recursos gastados se escriben de vuelta tal cual.

El resto no cambia. El cálculo de los dados sigue siendo el de Marinara (consulta [Cómo funciona el cálculo del combate](combat.md#how-combat-math-works)), y no se aplican las tiradas de ataque, las tiradas de salvación ni la concentración del sistema de mesa. Una pelea de la que sales borrando el mensaje en el que empezó no devuelve nada a la ficha.

<a id="checks-on-a-ruleset"></a>

## Pruebas con un conjunto de reglas

El GM pide pruebas como en cualquier partida (consulta [Pruebas de habilidad](dice-and-skill-checks.md#skill-checks)), pero el conjunto de reglas decide cómo se tiran.

- El GM solo nombra la habilidad o la salvación y fija una dificultad. Recibe la escala de dificultad del conjunto de reglas, no la integrada. Una dificultad puede llegar tan lejos como esa escala, incluso más allá del 1 a 40 de las reglas propias de Marinara. Una vía sigue limitada a 1 a 40: la resolución de emergencia que tira una prueba que un turno guardado aún tiene pendiente.
- Marinara tira los dados del conjunto de reglas y suma el modificador de la **ficha del conjunto de reglas** del personaje: el modificador de atributo cuando la habilidad o la salvación nombra un atributo, la bonificación por nivel de entrenamiento (un múltiplo de una bonificación de competencia, un número fijo o ambos) y cualquier bonificación adicional de la ficha. No se usan las bonificaciones de habilidad ni los atributos integrados.
- Los resultados siguen al conjunto de reglas. En 5e (SRD 5.1), un 20 o un 1 natural no tiene ningún efecto especial en las pruebas ni en las salvaciones, así que un 20 natural que no alcanza la dificultad falla.
- Si falta el paquete del conjunto de reglas o es más antiguo que aquel con el que se creó la partida, las pruebas se guardan sin números y quedan pendientes. Nunca se tiran con las reglas de otro sistema.

Marinara no se fía de los números que escribe el GM. Una etiqueta que parece terminada se vuelve a tirar y se sustituye cuando su modificador no es el de la ficha, cuando tiró una cantidad o un tamaño de dados distintos de los del conjunto de reglas, cuando el dado que contó no es el que conserva su modo de tirada o cuando afirma un resultado natural que el conjunto de reglas no tiene.

### Lo que el GM puede añadir a una prueba

| El GM escribe | Efecto |
| --- | --- |
| `who="Name"` | La prueba usa la ficha de ese miembro del grupo. Sin él, la prueba es del jugador. Un miembro sin ficha tira con una vacía. Un nombre que no coincide con nadie, o que comparten dos miembros, tira sin modificador. Si un miembro comparte el nombre de tu propio personaje, ese nombre sigue refiriéndose a ti. Marinara nunca toma prestada la ficha de otro. |
| `with="Ability"` | Tira la habilidad o la salvación con un atributo distinto. Solo cuenta un atributo que declare el conjunto de reglas. Cualquier otro se ignora. |
| `difficulty="Hard"` | Nombra un escalón de la escala en lugar de un número. Marinara tira contra el número de ese escalón, y la prueba guardada muestra el número. Un nombre desconocido se ignora. |
| Marcadores de tirada | Pueden nombrar los atributos, las habilidades y las salvaciones del conjunto de reglas, y `PROF` para la bonificación de competencia cuando el conjunto de reglas la tiene. |

Un dado que tiraste tú antes de la prueba solo se usa cuando el conjunto de reglas tira un único d20. Un conjunto de reglas que tira otros dados, como 2d6 o una reserva, lo ignora.

### Efectos de la ficha en una tirada

- **Amuletos que cambian una tirada.** El GM nombra el amuleto en la prueba, y Marinara cobra su coste, aplica su efecto y tira. Un amuleto que no has elegido, o que no puedes pagar, no hace nada y no cuesta nada.
- **Gastar un recurso para afianzar una tirada.** El GM lo indica en la prueba. Marinara cobra los puntos, añade lo comprado y tira. Si la reserva no alcanza, no se gasta nada. El registro muestra lo que realmente se pagó. El conjunto de reglas fija cuánto puede comprar una prueba: un número fijo, un número de tu ficha o tantos como dados tenga la prueba.
- **Números que acompañan a la tirada.** Si el conjunto de reglas indica que un número de la ficha se aplica a ciertas tiradas, como una mochila pesada en cada tirada de Brawn, Marinara lo suma a cada prueba a la que se aplica, y la tarjeta de dados indica lo que añadió la ficha.
- **Habilidades sin entrenamiento.** Un conjunto de reglas puede hacer que una prueba sin entrenamiento cueste dados o puntos, sea un escalón más difícil o sea imposible. Una prueba que no puedes intentar no se tira, y la narración lo dice. Tu ficha no muestra ningún número para esa habilidad hasta que la entrenas.
- **Heridas.** Si el conjunto de reglas tiene un contador de heridas y dice que su penalización se aplica a las tiradas, estar herido hace más difícil cada prueba. En un conjunto de reglas de reservas, quita esa cantidad de dados de la reserva, sin bajar nunca de la reserva más pequeña que permite el conjunto de reglas (algunos permiten que no quede ninguno). En un conjunto de reglas que suma los dados, es una penalización fija. La prueba indica cuánto se aplicó. Consulta [La ficha del conjunto](#the-ruleset-sheet).

El GM también mantiene al día en la ficha los recursos, estados y descansos de cada personaje, y Marinara rechaza un cambio que la ficha no permite.

### Conjuntos de reglas que tiran una reserva de dados

Algunos sistemas cuentan dados en lugar de sumar una bonificación. El número de la ficha es cuántos dados tiras, y cuentas los que salen lo bastante altos.

- **El número de la ficha son dados.** Un atributo de 3 y un oficio que vale 2 tiran cinco dados. La ficha muestra "5 dice" en lugar de "+5".
- **La dificultad es un número de éxitos.** Un trabajo difícil pide tres éxitos, no un total de 15. La escala del conjunto de reglas indica cuántos necesita cada escalón.
- **Marinara tira y cuenta.** El conjunto de reglas decide qué caras cuentan, si una cara alta tira otro dado o cuenta doble, si las caras bajas cancelan éxitos y qué cuenta como pifia o como éxito excepcional. La tarjeta de dados muestra todos los dados, con los que alcanzaron el objetivo destacados, y compara los éxitos con el número necesario. Una reserva grande ocupa más filas, y la tarjeta nunca muestra un total si los dados no se sumaron.
- **El GM puede ajustar una prueba**, si el conjunto de reglas lo permite: un objetivo por dado más difícil o más fácil, dados añadidos o quitados por las circunstancias, y una cara más baja a partir de la cual los dados se vuelven a tirar o cuentan doble. Cada ajuste se mantiene dentro del rango del conjunto de reglas. Un escalón de la escala puede llevar su propio objetivo por dado. La tarjeta de dados indica cuándo una prueba usó una cara distinta de la habitual del conjunto de reglas.
- **Los dados se pueden volver a tirar**, si el conjunto de reglas tiene una regla para ello. El GM la nombra en la prueba, y los dados que salieron bajos se vuelven a tirar, una vez o hasta que salgan más altos. Un recurso que gastas puede comprar lo mismo. Una tirada solo se repite de una forma. Cuando se aplican dos, se usa la que alcanza más dados.
- **Se pueden tirar dos atributos juntos**, si el conjunto de reglas lo indica: dos puntuaciones se tiran como una sola reserva.
- **Una pifia puede venir con un resultado.** En un conjunto de reglas que cuenta como pifia que la mitad de los dados o más saquen caras bajas, una prueba que aun así consiguió sus éxitos conserva su resultado, y la tarjeta añade que algo salió mal. Sin ningún éxito, es un fallo crítico.
- **El GM nunca aporta los números.** Un resultado de reserva escrito en la narración se sustituye por la tirada propia de Marinara. No se aplican la ventaja ni un dado tirado de antemano.
- **Ver un dado de cada tamaño no se aplica.** Los dados que se le muestran al GM son de veinte caras. Una prueba de reserva se tira a ciegas y se narra como cualquier tirada a ciegas.

### Otras formas en que un conjunto de reglas puede tirar

Marinara sigue tirando los dados, y la tarjeta de dados sigue al conjunto de reglas:

- **Quedarse con los dados más altos.** Tira un puñado y lee el más alto, los dos más altos o los tres más altos.
- **Tirar contra tu ficha.** Saca un resultado igual o inferior a un número de tu ficha, como un porcentaje de habilidad.
- **Dados con sus propias caras.** Las caras pueden valer algo distinto de su número, como menos, blanco y más, o llevar símbolos como éxito, ventaja y sus opuestos.
- **Resultados por franjas.** Una prueba puede caer en una franja, como un éxito crítico o un éxito con un coste, en lugar de un simple acierto o fallo. La tarjeta nombra la franja y el GM la narra.
- **Unas pocas pruebas tiradas de otra forma.** Un conjunto de reglas puede tirar la mayoría de las pruebas de una forma y nombrar unas pocas que se tiran de forma distinta.

<a id="the-ruleset-sheet"></a>

## La ficha del conjunto

En una partida con un conjunto de reglas, cada hoja de personaje empieza con un bloque **Ruleset sheet** (Ficha del conjunto de reglas). Su estructura procede del conjunto de reglas, así que una ficha de 5e y la de otro sistema se ven distintas. Una partida sin conjunto de reglas no tiene este bloque. Consulta también [Perfiles de personajes](party-and-npcs.md#character-profiles).

| Parte | Cómo funciona |
| --- | --- |
| **Resources** (Recursos) | Los puntos de vida, los espacios de conjuro o un recurso de clase muestran lo que queda del máximo. Usa los botones de menos y más, o escribe un número. Un recurso con un margen temporal también muestra **Temp**. |
| **Tracks** (Contadores) | Como el agotamiento. Suben y bajan dentro de su rango. |
| **Notes** (Notas) | Cuadros de texto cortos, como aquello en lo que se concentra un personaje. |
| **Conditions** (Condiciones) | Botones que activas y desactivas. |
| **States** (Estados) | Una forma o una postura: un solo valor de una lista cada vez. Un estado puede cambiar los números que lo siguen, como los dados que se añaden a las tiradas, y un descanso puede restablecerlo. |
| **Botones de descanso** | Aplican uno de los descansos del conjunto de reglas. El conjunto de reglas define lo que recupera un descanso. También puede devolver las cargas de los objetos, como las de una varita, y la línea bajo los botones indica lo que volvió. En 5e (SRD 5.1), un descanso largo recupera los puntos de vida y los espacios de conjuro y devuelve la mitad de los dados de golpe, con un mínimo de uno. |
| Resumen de la construcción | Los modificadores de atributo, las habilidades y salvaciones entrenadas y los valores que elige el conjunto de reglas, como la clase de armadura. |

Los **Wound tracks** (Contadores de heridas) son una fila de casillas en vez de un número, para sistemas que marcan el daño en vez de contarlo. Cada casilla indica el nombre de ese grado de herida y cuánto resta a tus tiradas.

1. Si el conjunto de reglas tiene más de un tipo de daño, elige primero el tipo.
2. Haz clic en **Mark** (Marcar) o **Clear one** (Borrar una). También puedes hacer clic en la siguiente casilla vacía para añadir una marca, o en la última casilla marcada para quitar una. Las demás casillas no responden a los clics.

Una marca más grave ocupa la casilla superior y desplaza hacia abajo las más leves. La línea inferior indica qué penalización está activa y lo que no haya cabido en el contador. Algunos conjuntos de reglas numeran sus casillas en lugar de nombrarlas, a veces tantas como tu propia puntuación, y algunos ponen cada marca en la casilla a la que apunta. En esos puedes hacer clic en cualquier casilla libre, **Clear one** quita la marca más leve de la casilla más alta, y un contador lleno rechaza otra marca en lugar de agravar una antigua. Un conjunto de reglas puede añadir casillas a partir de una lista de tu ficha, y hacer que un descanso o una curación borre solo un tipo de daño.

### Cómo cambia el GM la ficha

El GM mantiene la ficha al día mientras narra. Cuando un personaje gasta un recurso, recibe daño, se cura, gana o pierde una condición, cambia de estado o descansa, registra el cambio y Marinara lo comprueba con la ficha. Un cambio imposible, como lanzar un conjuro sin espacios libres, se rechaza. No cambia nada, y un aviso te lo indica.

Cuando un personaje usa algo elegido de los catálogos del conjunto de reglas, como un conjuro o un rasgo de clase, el GM lo nombra y Marinara paga el precio completo: lo que el conjunto de reglas dice que cuesta, más un uso de cada contador que venía con ello. Un conjuro que cuesta un espacio se paga con el nivel de espacio que indica el conjunto de reglas, y el GM puede pedir uno superior. Marinara nunca sube por su cuenta a un espacio superior. Si alguna parte del precio no se puede pagar, se rechaza todo y no se gasta nada. Algo gratuito, como un truco, solo se narra.

Algunos números de la ficha pertenecen al conjunto de reglas: un recurso de clase cuyo máximo sigue a tu nivel, o unos usos que siguen a una puntuación de atributo, los fija el conjunto de reglas y se mantienen correctos cuando editas la ficha. Un conjunto de reglas también puede calcular un número a partir de un recurso o de un contador tal como están, dar un número para cada valor de un estado, sumar una columna de una lista (como el peso del equipo que llevas) o limitar una habilidad a un número así, de modo que una habilidad puede reducirse mientras un recurso está bajo. La ficha de la partida muestra estos valores actuales, y una prueba o un combate usa el valor de ese momento. El editor de fichas de una tarjeta de personaje no tiene partida que leer, así que los muestra como al inicio del juego.

Los valores vivos pertenecen al mensaje en el que ocurrieron. Si cambias a otra versión de un turno con un swipe (respuesta alternativa), o lo regeneras, la ficha vuelve a como estaba antes de ese turno, así que nada se gasta dos veces.

### Editar la ficha del conjunto

Cambia la construcción en sí, por ejemplo tras subir de nivel.

1. Abre la ficha del personaje y haz clic en **Edit ruleset sheet** (Editar ficha del conjunto de reglas).
2. Cambia las puntuaciones, los campos, las listas como los conjuros y el entrenamiento en habilidades y salvaciones. Los valores calculados se actualizan mientras escribes. Cuando el conjunto de reglas tiene un constructor paso a paso, elige **Guided** (Guiado) para que te guíe por cada elección (puntuaciones, habilidades, equipo inicial), o **All fields** (Todos los campos) para verlo todo a la vez.
3. Haz clic en **Save sheet** (Guardar ficha).

Es el mismo editor que el de la tarjeta de personaje. Se pueden añadir filas desde los catálogos del conjunto de reglas, las celdas que mantiene el conjunto de reglas se muestran pero no se pueden editar, y una lista cuyo texto del conjunto de reglas ha cambiado ofrece **Review** (Revisar). Guardar cambia solo la copia de esta partida. Una partida nunca cambia la ficha guardada en el personaje o la persona.

El botón separado **Edit card** (Editar tarjeta) edita la hoja general (clase, habilidades, fortalezas) y no toca la ficha del conjunto de reglas. Consulta [Editar una ficha a mano](party-and-npcs.md#edit-a-sheet-by-hand).

Si no funcionó y el paquete del conjunto de reglas se eliminó o es más antiguo que aquel con el que se creó la partida, el bloque muestra un aviso en su lugar. Las pruebas no se pueden tirar hasta que se vuelva a instalar el paquete.

## La ficha del grupo y los relojes de progreso

Algunos conjuntos de reglas llevan una ficha para todo el grupo, como una tripulación o una compañía. Aparece en la pantalla del juego cerca del mapa, con el nombre que le da el conjunto de reglas. Haz clic en el nombre para abrirla. El GM la mantiene al día igual que la ficha de cada personaje y, donde el conjunto de reglas lo permite, tú también puedes editarla. Si otra persona guardó la ficha del grupo mientras editabas, ves su versión. **Save** (Guardar) la reemplaza por la tuya y **Cancel** (Cancelar) conserva la suya.

Un conjunto de reglas también puede usar **Progress clocks** (Relojes de progreso): círculos divididos en segmentos que el GM va llenando a medida que algo aumenta, como una alarma que se extiende. Aparecen cerca del mapa, cada uno con cuántos segmentos están llenos, y muestran **Done** (Completado) cuando están llenos.

## Guías relacionadas

- [Game Mode: peleas con un conjunto de reglas](fighting-on-a-ruleset.md)
- [Game Mode: dados y pruebas de habilidad](dice-and-skill-checks.md)
- [Game Mode: grupo y NPC](party-and-npcs.md)
- [Colores del personaje y Estadísticas de Roleplay: fichas de conjuntos de reglas](../characters/colors-and-stats.md#ruleset-sheets)
- [Escribir conjuntos de reglas de Game Mode](../extending/writing-rulesets.md)
