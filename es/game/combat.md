# Game Mode: combate

El combate de Game Mode es de dos tipos: batallas **Turn-Based** con menús y batallas **Tactical** en cuadrícula. Eliges entre ellos con **Combat Preference** (Preferencia de combate) en el paso **World** (Mundo) del asistente de configuración. Para cambiarlo más tarde, abre **Chat Settings** (Ajustes del chat), expande **Combat Style** (Estilo de combate) y elige un **Battle system** (Sistema de batalla). Un conjunto de reglas que resuelve sus propias peleas puede limitar las opciones. El Game Master (GM, la IA que dirige el juego) plantea el encuentro y narra el resultado. Marinara resuelve las acciones de la batalla con matemáticas de dados fijas, así que la IA nunca decide quién golpea.

## Iniciar un encuentro

Tú no inicias el combate por tu cuenta. El GM inicia una pelea cuando la historia lo pide, por ejemplo cuando provocas a un enemigo o caes en una emboscada. Entonces se abre una pantalla de batalla completa sobre la narración, construida a partir de lo que está ocurriendo en la historia: tu grupo, los enemigos, sus estadísticas y cualquier regla especial.

La pantalla muestra tu grupo en un lado y los enemigos en el otro. Cada luchador tiene una barra de salud (HP, puntos de vida) y, si usa habilidades, una barra de magia (MP, puntos de magia). Arriba se muestra **Next:** seguido del nombre de quien actúa a continuación, y **Round** con el número de ronda.

La forma de decidir una pelea depende del sistema de personajes de la partida. Todas las partidas nuevas usan clases **MRPG**: cada luchador combate con las estadísticas, habilidades y equipo de su clase (consulta [Batallas en una partida MRPG](#battles-in-an-mrpg-game)). Una partida **Legacy**, creada antes de las clases MRPG, usa las reglas anteriores de Ataque y Defensa de [Cómo funcionan las matemáticas del combate](#how-combat-math-works). Las pantallas y los botones de abajo son iguales para ambas.

> **Nota:** En una partida con un conjunto de reglas que resuelve sus propias peleas, como 5e (SRD 5.1), la pelea sigue el conjunto de reglas, no esta página. Consulta [Peleas con un conjunto de reglas](fighting-on-a-ruleset.md). Un conjunto de reglas que solo presta su ficha a las batallas conserva el combate de esta página. Consulta [Qué ocurre en las batallas](rulesets.md#what-happens-in-battles).

## Jugar una batalla Turn-Based

Una batalla Turn-Based no tiene tablero. Participan todos los miembros del grupo. Tú eliges la acción de un personaje, el primer miembro vivo del grupo. Los demás compañeros actúan por su cuenta.

En tu turno, elige una acción:

| Acción | Qué hace |
| --- | --- |
| **Attack** (Atacar) | Golpea a un enemigo con un ataque básico. |
| **Skills** (Habilidades) | Usa una habilidad especial. Las habilidades pueden costar MP. Algunas curan a un aliado, algunas golpean a un enemigo y algunas aplican un buff o un debuff. |
| **Special** (Especial) | Escribe una acción libre con tus propias palabras y luego haz clic en **Ask GM** (Preguntar al GM), por ejemplo "Le lanzo arena de una patada a la lente agrietada del Ruin Guard". El GM decide qué pasa. |
| **Defend** (Defender) | Sube tu Defensa durante el resto de la ronda, así que recibes menos daño. |
| **Items** (Objetos) | Usa un objeto de tu bolsa. **Full inventory** (Inventario completo) abre tu lista completa de objetos. |
| **Flee** (Huir) | Abandona la pelea de inmediato. Siempre funciona y termina el combate al instante. |

Después de elegir, la ronda se resuelve. Los resultados aparecen como números de daño flotantes, barras de salud que cambian y líneas en **Combat Log** (Registro de combate). Un cartel de **Victory!** aparece cuando ganas, y un cartel de **Defeat...** si tu grupo cae.

En una partida con un conjunto de reglas, **Items** hace lo que dice el conjunto para sus propios objetos: cuánto curan o dañan y qué estados añaden. Un objeto con cargas se ofrece mientras le quede un uso. Si un objeto pide antes una prueba, esta se tira, y si falla, el objeto se gasta para nada. Un objeto al que el conjunto no da ningún uso no se ofrece. El resto de los objetos hacen lo que el GM decidió al empezar la pelea, salvo que el conjunto de reglas desactive los objetos propios de Game Mode.

## Jugar una batalla Tactical

El combate Tactical sitúa a tu grupo y a los enemigos en un campo de batalla en cuadrícula. Cada cuadro es una casilla, como **Plains** (Llanura) o **Forest** (Bosque).

1. Cuando es tu turno (aparece **Player Phase**, o el nombre de una unidad seguido de "'s turn"), haz clic en una de tus unidades en la cuadrícula. Su alcance de movimiento se muestra en el tablero.
2. Haz clic en una casilla de destino y luego haz clic en **Confirm Move** (Confirmar movimiento). Haz clic en **Reset Move** (Restablecer movimiento) para elegir de nuevo.
3. Después de moverte, el tablero dice "Already moved — choose an action." (Ya te moviste: elige una acción). Elige **Attack**, **Defend** o **Item** (Objeto). **Flee** también está aquí.
4. Con **Attack**, el tablero dice **Select an enemy** (Selecciona un enemigo). Haz clic en uno. La previsión de ataque muestra el resultado esperado. Haz clic en **Confirm** (Confirmar) para ejecutarlo. **← Back** (← Atrás) retrocede un paso.
5. Haz clic en **End Turn** (Terminar turno) cuando acabes. En el orden de turnos en el que el grupo va primero, después se juega la **Enemy Phase** (Fase enemiga).

Si el tablero muestra **Resolving…** (Resolviendo…), espera un momento. **Restart** (Reiniciar) vuelve a empezar la batalla desde el principio en el mismo campo de batalla, después de que lo confirmes.

Quién actúa y cuándo depende de **Turn order** (Orden de turnos). Consulta [Orden de turnos](#turn-order). Los tableros hechos a mano y las reglas del terreno están en [Batallas tácticas y terreno](#tactical-battles-and-terrain).

<a id="battles-in-an-mrpg-game"></a>

## Batallas en una partida MRPG

En una partida con clases MRPG, cada miembro del grupo combate con su clase activa: sus estadísticas, sus habilidades y el equipo de su ficha (consulta [Clases MRPG](mrpg-classes.md)). Los oponentes combaten según su categoría: minion, standard, elite o boss. Un panel junto a la pelea muestra quién actúa a continuación, la clase, el nivel, la fila y los recursos de cada luchador y, al final, lo que ganó el grupo.

<a id="turns-skills-and-resources"></a>

### Turnos, habilidades y recursos

- **Orden de turnos.** No hay tiradas de iniciativa. Los luchadores actúan en una línea temporal, y cada acción retrasa el turno siguiente de un luchador en menor medida cuanto mayor es su Speed, por lo que los luchadores rápidos actúan más a menudo.
- **Habilidades.** **Skills** enumera las habilidades de la clase activa y las que se llevan de otras clases, cada una con su costo y una estimación de lo que haría. Las habilidades mágicas cuestan **MP**, que no se recupera durante la pelea. Las demás cuestan **Stamina**, que se recupera un poco en cada turno.
- **Defender.** Aumenta la Defense en un 50% hasta el siguiente turno del luchador y recupera más Stamina.
- **Munición y elementos.** Un Marksman carga un tipo de munición y un Channeler canaliza un elemento desde el panel junto a la pelea. Cambiar cualquiera de los dos es gratis. Si no intervienes, la IA elige el mejor para el objetivo.

<a id="hitting-and-damage"></a>

### Golpes y daño

- La **probabilidad de acertar** aumenta con el Skill y la Luck del atacante y disminuye con el Speed y la Luck del objetivo. Nunca baja del 25%.
- Los **golpes críticos** dependen del Skill del atacante frente a la Luck del objetivo y causan el doble de daño.
- **Daño.** Un ataque con arma causa la Strength más la potencia del ataque, menos la Defense del objetivo. Un conjuro, o un golpe con un bastón, una varita o un foco, usa Magic contra Resistance. La potencia aumenta un poco con el nivel, como lo haría con equipo mejor.
- **Tipos de daño.** Cada golpe tiene un tipo: cortante, perforante o contundente para las armas; un elemento (fuego, hielo, rayo, viento, madera, tierra, agua o metal); o luz u oscuridad. Un enemigo puede ser débil ante un tipo (recibe un 50% más), resistirlo (recibe la mitad), ser inmune o absorberlo. Una debilidad o resistencia se muestra en el enemigo una vez que un golpe la ha descubierto, y el grupo la recuerda para todos los enemigos de ese tipo. Las debilidades elementales de los enemigos siguen el ciclo de cinco fases, en el que cada elemento vence al siguiente: la madera separa la tierra, la tierra contiene el agua, el agua apaga el fuego, el fuego funde el metal y el metal corta la madera.

<a id="rows"></a>

### Filas

Una batalla Turn-Based tiene una fila delantera y una trasera en cada lado. Un golpe cuerpo a cuerpo contra la fila trasera causa la mitad de daño, en ambos sentidos, mientras que los ataques a distancia y los conjuros causan todo el daño a cualquiera de las filas. Cuando no queda nadie en la fila delantera de un bando, su fila trasera pasa a ser la delantera. Cada clase tiene una fila predeterminada, y puedes cambiar la fila de un personaje en la pestaña **Status** (Estado) de su ficha. Las batallas Tactical no tienen filas: las posiciones del tablero deciden quién puede alcanzar a quién.

<a id="taunts-yielding-and-taming"></a>

### Provocaciones, rendición y domesticación

- **Provoke.** El Provoke de un Sentinel hace que todos los enemigos ataquen al Sentinel durante 2 turnos. En un tablero, un enemigo que no pueda alcanzarlo se acerca todo lo posible y se prepara en su lugar.
- **Rendición.** Un enemigo inteligente que está perdiendo puede rendirse o huir. Cuando los únicos enemigos que quedan se han rendido, la pelea pregunta **Spare them** (Perdonarlos) o **Finish them** (Acabar con ellos). De cualquier forma, el grupo recibe su botín y experiencia. Un enemigo que lleva un tesoro y huye escapa con su premio.
- **Domesticación.** Un Tracker puede domesticar a una bestia salvaje que esté por debajo del 30% de HP. Sale de la pelea y se convierte en compañero, que se conserva incluso si después se pierde la pelea.

<a id="after-the-fight"></a>

### Después de la pelea

Una pelea ganada da experiencia a todos los que combatieron (consulta [Niveles y experiencia](mrpg-classes.md#levels-and-experience)), y el panel final muestra cada nivel ganado, las estadísticas que aumentaron y cualquier ascenso que se haya abierto. Una pelea perdida o de la que se huye no da nada. Con **Permadeath** (Muerte permanente) activado, un miembro del grupo que esté caído cuando termine la pelea desaparece para siempre.

En una partida MRPG, la **Difficulty** (Dificultad) decide cuántos enemigos hay y lo fuertes que son, en vez de multiplicar su daño. En **Brutal**, los enemigos pueden estar varios niveles por encima del grupo.

## Interrumpir al GM

Mientras el GM escribe, puedes intervenir con el botón **Interrupt** (Interrumpir). Nada de lo que escribas se confirma hasta que lo envías.

1. Haz clic en **Interrupt**. Se abre una ventana titulada **Attempt to Interrupt?** (¿Intentar interrumpir?).
2. Elige una opción:
   - **No** cancela y deja que el GM siga escribiendo.
   - **Force Interrupt** (Forzar interrupción) interviene de forma limpia. Al GM no se le dice que interrumpiste. Tu campo de entrada recibe un contorno verde.
   - **Yes** (Sí) intenta una interrupción dentro de la historia que el GM puede resistir. Tu campo de entrada se pone rojo y la app sugiere "using dice recommended" mientras el botón de dados palpita. Tirar los dados puede ayudar.
3. Escribe tu mensaje y envíalo.

Si cambias de idea, haz clic en **Resume** (Reanudar). Retira la interrupción pendiente y la narración continúa.

## Quick-Time Events

El GM puede activar un Quick-Time Event (QTE) para momentos rápidos como esquivar o perseguir. La superposición muestra una barra de cuenta atrás que se encoge, un aviso **React quickly!** (¡Reacciona rápido!) y un botón numerado por cada opción. Haz clic en la acción que quieras antes de que se acabe el tiempo para ganar un bono. Cuanto más rápido reacciones, mayor será el bono. Si se acaba el tiempo, recibes una penalización en su lugar. Un QTE no usa dados.

Para desactivar los QTE, si juegas con un lector de pantalla o sin límite de tiempo, desactiva **Quick Time Events** en el paso **Features** (Funciones) del asistente.

## Combate en el teléfono

En un teléfono, los botones de acción se fijan en la parte inferior de la pantalla. Los paneles que no caben pasan a un cajón que se desliza hacia arriba, con cuatro pestañas: **Party** (Grupo: los miembros y su salud), **Boss Mechanics** (Mecánicas de jefe: las reglas especiales de la pelea), **Dialogue** (Diálogo: las líneas de batalla que dicen los luchadores) y **Combat Log** (Registro de combate: el registro ronda a ronda). Toca una pestaña para abrir su cajón. Toca fuera del cajón o su botón de cerrar para cerrarlo.

<a id="how-combat-math-works"></a>

## Cómo funcionan las matemáticas del combate

Las reglas de esta sección son para partidas **Legacy** y para partidas cuyo conjunto de reglas presta su ficha a las batallas de Marinara. Una partida con clases **MRPG**, como todas las partidas nuevas, combate según las reglas de [Batallas en una partida MRPG](#battles-in-an-mrpg-game).

Cada ronda se decide con matemáticas de dados fijas, no con la IA. Esto hace que el combate sea justo y consistente. Un d20 es un dado de veinte caras (del 1 al 20). Para las batallas Tactical, consulta también [Orden de turnos](#turn-order) y [Visión, cobertura y altura](#sight-cover-and-height).

**Iniciativa.** Al comienzo de cada ronda, cada luchador tira un d20 y suma un bono basado en su Velocidad (la Velocidad dividida entre 5, redondeada hacia abajo). Los totales más altos actúan primero. Un luchador se salta la ronda si está congelado, aturdido o aprisionado, o si su Velocidad ha bajado a 0.

**Ataque y defensa.** Cuando un luchador ataca a otro:

1. El atacante tira un d20 y suma un bono de su estadística de Ataque.
2. El defensor tira un d20 y suma un bono de su estadística de Defensa.
3. Si el total del atacante es menor, el ataque falla.
4. Un golpe crítico ocurre con un 20 natural, o cuando el atacante supera al defensor por 10 o más.

**Daño.** En un golpe acertado, el daño base viene de la estadística de Ataque del atacante y crece con el nivel. Se suman dados d6 extra, y los luchadores de nivel más alto tiran más de ellos. Un golpe crítico multiplica el total por 1,5. Después, la Defensa del defensor bloquea de ese daño hasta el 40 por ciento de su propio valor.

<a id="difficulty-scaling"></a>

### Escalado de dificultad

En una partida Legacy, a continuación el daño se escala según la **Difficulty** que fijas en el asistente de configuración. Después se aplican los modificadores del clima y de los efectos de estado. El multiplicador solo se aplica a los ataques de los enemigos, así que en una partida más difícil los enemigos golpean más fuerte mientras el daño de tu grupo sigue igual.

| Dificultad | Multiplicador de daño enemigo |
| --- | --- |
| Casual | 0.6 |
| Normal | 1.0 |
| Hard | 1.3 |
| Brutal | 1.6 |

Estos multiplicadores pertenecen a las reglas propias de Marinara. Un conjunto de reglas aporta su propia política de dificultad.

## Efectos de estado y reacciones elementales

Esta sección describe las batallas Legacy. Una partida MRPG tiene sus propios tipos de daño (consulta [Golpes y daño](#hitting-and-damage)), y los efectos de sus habilidades, como Poisoned, Asleep o Slowed, se describen en cada habilidad.

Un efecto de estado es un cambio temporal en el Ataque, la Defensa, la Velocidad o el HP de un luchador. Los buffs ayudan y los debuffs perjudican. Un estado dura un número fijo de rondas y luego desaparece. Los efectos de tipo veneno drenan HP cada ronda y los de tipo regeneración lo restauran. Congelado, aturdido y aprisionado hacen que el luchador se salte su turno.

Algunos ataques y habilidades llevan un elemento. El primer elemento que golpea a un objetivo deja un aura, un rastro persistente. Un elemento distinto que golpee al mismo objetivo activa una reacción elemental, que añade daño extra y, a menudo, un efecto de estado. Entre las reacciones están Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse y Electrotoxin. Ocurren automáticamente, y no tienes que activarlas.

### Elementos

Qué elementos existen depende de la ambientación:

- Sin kit de ambientación, o con un kit que no nombra ninguno: los seis clásicos (fuego, hielo, rayo, veneno, sagrado, sombra).
- Wuxia: las cinco fases (madera, fuego, tierra, metal, agua), y cada una vence a la siguiente.
- Cyberpunk y ópera espacial: cinético, térmico, EM, y químico o plasma.
- Época actual y años veinte: ninguno.

La lluvia y las tormentas en terreno abierto debilitan los elementos parecidos al fuego y refuerzan los parecidos al rayo. En un combate táctico, un elemento golpea más fuerte contra uno al que vence y más débil contra uno que lo vence. Puedes cambiar los elementos y las reacciones de un kit en **Change its words** (Cambiar sus palabras). Consulta [Elegir un kit de ambientación](getting-started.md#choosing-a-setting-kit).

## Mecánicas de jefe y botín

Los enemigos fuertes pueden tener mecánicas de jefe, reglas especiales que el GM escribe para esa pelea. Una mecánica se activa según un horario, por ejemplo cada pocas rondas, o cuando el jefe baja de un nivel de salud fijado. Puede golpear a todo tu grupo, aplicar un buff al jefe o aplicar un efecto de estado. Cuando una se activa, **Combat Log** la muestra para que puedas reaccionar.

Cuando ganas, los enemigos sueltan botín, que va directamente a las bolsas del grupo. Los objetos tienen una rareza, que va de common a uncommon, rare, epic y legendary. Una dificultad más alta inclina los objetos que caen hacia los más raros y reparte un poco más de ellos. Una notificación indica lo que cayó, y al GM se le dice que ya está en tus bolsas.

Lo que cae depende de tu ambientación. Una partida con kit de ambientación suelta el botín propio del kit (una partida de la época actual suelta una tarjeta regalo o un botiquín, nunca una espada encantada), y puedes cambiar esas palabras en **Change its words**. Una partida sin kit suelta lo que suele tener su género. Un género sin kit inicial, como Steampunk, suelta cosas sencillas que no pertenecen a ninguna ambientación. En una partida cuyo conjunto de reglas tiene sus propias tablas de botín, los enemigos sueltan en su lugar los objetos del conjunto, y un conjunto que desactiva los objetos propios de Game Mode suelta solo los suyos.

## Referencia: batallas tácticas

<a id="tactical-battles-and-terrain"></a>

### Batallas tácticas y terreno

No hay ajustes del campo de batalla que completar al crear una partida. Cada pelea recibe su propio tablero, generado a partir de una semilla nueva y de la descripción breve del GM para la escena. El GM proporciona el entorno, la formación y una descripción breve del terreno, que puede pedir áreas de terreno y barreras cerca del centro o de un borde. Marinara crea las casillas y las posiciones iniciales exactas. El campo de batalla aceptado se guarda, por lo que recargar restaura ese tablero.

Marinara comprueba la descripción y la distribución. Conserva el terreno solicitado sin dejar de garantizar que el encuentro sea accesible.

Si las restricciones no encajan entre sí, la batalla informa del problema. Entonces **Use generated terrain** (Usar terreno generado) empieza sin los elementos de terreno rechazados. Nunca los borra en silencio.

Un mundo también puede tener campos de batalla hechos a mano: tableros pintados casilla a casilla para uno de sus lugares con un editor de mundos como Pixelforge. Cuando una pelea empieza en ese lugar, o dentro de él, usa uno de esos tableros en vez de uno generado.

- El tablero se usa exactamente como se pintó. Si el lugar tiene varios, elige la semilla de la pelea (un número que escoge uno).
- La descripción del terreno del GM no se usa ahí, pero su formación sigue decidiendo dónde empieza cada bando. Al GM se le dice que el tablero se hizo para este lugar.
- Un tablero hecho a mano debe cumplir tres reglas: tiene uno de los tres tamaños de tablero, las dos columnas de cada lado son llanura, donde se forman los bandos, y cada casilla en la que puede estar un luchador conecta con las demás. El creador rechaza un tablero que incumple una regla y dice por qué.

Estos tableros se guardan con las ediciones a mano del mundo, así que viajan en los archivos de mundo, los paquetes de mapas y la biblioteca.

| Terreno | Caminar | Defensa y evasión |
| --- | --- | --- |
| Llanura | Cuesta 1 punto de movimiento | Sin bonificación |
| Bosque | Cuesta 2 puntos de movimiento | +1 de defensa, +15 puntos porcentuales de evasión |
| Ruinas | Cuesta 1 punto de movimiento | +1 de defensa, +10 puntos porcentuales de evasión |
| Montaña, agua, muro | Bloquea el movimiento a pie | Sin bonificación |

Las unidades con una capacidad establecida de vuelo o teletransporte se mueven de otra manera:

- **Caminar** sigue casillas de suelo accesibles. Las unidades enemigas bloquean el paso, y las unidades no pueden terminar en una casilla ocupada.
- **Volar** cruza terreno y unidades a un punto de movimiento por casilla, incluidos los bosques. Una unidad voladora puede mantenerse sobre una casilla que de otro modo estaría bloqueada, pero no puede terminar sobre otra unidad.
- **El teletransporte** ignora el terreno y las unidades intermedias. El destino debe estar dentro del alcance de movimiento, desocupado y ser transitable a pie. No puede terminar dentro de un muro, sobre una montaña ni sobre agua sin apoyo.

Ambos modos especiales usan la capacidad de movimiento actual y la distancia en línea recta (no en diagonal) entre casillas. Conservan las bonificaciones de defensa y evasión del terreno de destino e ignoran la altura. No se modelan la altitud de un volador, los techos, los costes específicos de hechizos ni los requisitos de visión específicos de hechizos. Las invocaciones todavía no forman parte del combate propio de Marinara.

<a id="turn-order"></a>

### Orden de turnos

Una batalla Tactical reparte los turnos de una de dos formas:

- **One at a time, by initiative** (Uno a uno, por iniciativa): cada unidad recibe un puesto en un orden tirado, y solo puede actuar la unidad a la que le toca. El tablero muestra el orden. Las partidas Overworld nuevas usan este modo.
- **Your whole party, then the enemies** (Todo tu grupo y luego los enemigos): cada unidad del grupo puede actuar y luego se juega la fase enemiga. Las partidas VN usan este modo.

Para cambiarlo, abre **Chat Settings**, expande **Combat Style** y elige un **Turn order**. Aparece mientras el **Battle system** es Tactical, salvo que el conjunto de reglas de la partida resuelva sus propias peleas. El cambio se aplica a partir de la siguiente batalla. Una batalla en curso conserva su orden.

<a id="sight-cover-and-height"></a>

### Visión, cobertura y altura

- **Visión.** Los muros y las montañas bloquean la visión. Una unidad solo puede atacar, usar una habilidad o usar un objeto sobre un objetivo que puede ver.
- **Cobertura.** Algo entre el atacante y el objetivo protege al objetivo. Una casilla de bosque o de ruinas en medio, o un muro o una montaña que tapa parte de la vista, da media cobertura. Un muro o una montaña que tapa la mayor parte de la vista da cobertura de tres cuartos. La media cobertura resta 15 puntos porcentuales a la probabilidad de acierto, y la de tres cuartos, 30. La bonificación de la casilla del propio objetivo y su cobertura no se suman: cuenta la mejor.
- **Altura.** En un tablero con montañas, una montaña tiene dos niveles de altura y el terreno que la rodea, uno. Subir un nivel caminando cuesta un punto de movimiento más, y bajar no cuesta nada. Un escalón de dos niveles o más es un acantilado, por el que nadie puede caminar. El terreno elevado también bloquea la visión entre dos casillas más bajas. Atacar hacia abajo desde un terreno elevado suma 10 a la probabilidad de acierto, un ataque a distancia desde un terreno elevado llega una casilla más lejos, y una cobertura baja, como un bosque, no oculta a un objetivo visto desde arriba. Los campos de batalla hechos a mano pueden tener sus propios acantilados.

### Escenas del campo de batalla

Un tablero táctico se distribuye como el tipo de lugar en el que ocurre la pelea: un bosque tiene árboles entre los que esconderse, una mazmorra tiene muros y pasillos, una ciudad tiene calles. Una partida con kit de ambientación nombra sus propias escenas con sus palabras, así que una pelea cyberpunk ocurre en una azotea o en el pasillo de un megabloque, y una pelea wuxia en un bosque de bambú o en una casa de té. Las casillas del tablero también usan las palabras de la ambientación (cobertura y escombros en vez de bosque y ruinas). Puedes cambiar las escenas de un kit y las palabras de sus casillas en **Change its words**.

## Guías relacionadas

- [Game Mode: peleas con un conjunto de reglas](fighting-on-a-ruleset.md)
- [Game Mode: dados y pruebas de habilidad](dice-and-skill-checks.md)
- [Game Mode: grupo y NPC](party-and-npcs.md)
- [Game Mode: primeros pasos](getting-started.md)
- [Encuentros de combate en Roleplay](../roleplay/combat-encounters.md)
