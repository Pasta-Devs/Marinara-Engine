# Game Mode: clases MRPG

Todas las partidas nuevas usan clases **MRPG** (Marinara RPG), incluidas las creadas a partir de una Experience. Cada miembro del grupo tiene una clase, sube de nivel al ganar peleas y desbloquea clases nuevas a medida que crece. Las partidas creadas antes de que existieran las clases MRPG conservan sus fichas **Legacy** hasta que decidas migrarlas (consulta [Migrar una partida Legacy a MRPG](#move-a-legacy-game-to-mrpg)).

Una partida que usa un conjunto de reglas, como 5e (SRD 5.1), utiliza en cambio las fichas propias del conjunto de reglas, y las clases MRPG no se aplican.

## Clases y árboles

Hay ocho árboles: **Blade**, **Guard**, **Scout**, **Marksman**, **Channeler**, **Hexer**, **Mender** y **Herald**. Cada personaje se entrena en dos de ellos:

- **Árbol principal.** Se elige en su ficha. La sección **Game Mode** de la tarjeta de un personaje o una persona de la biblioteca permite elegirlo. De lo contrario, se deduce de la clase y las habilidades del personaje.
- **Árbol secundario.** Se abre según el temperamento con el que el personaje empieza la partida. Un personaje cuyo temperamento apunta a su propio árbol principal se entrena solo en él y puede llegar a clases disponibles únicamente para quien permanece en un solo árbol.

Cada árbol empieza en una clase base. Una clase asciende en el nivel de clase 10 y de nuevo en el nivel 20, y los niveles terminan en el 30. Un personaje puede llevar hasta cuatro habilidades de otras clases en las que se haya entrenado. Las clases se cambian fuera de las batallas, desde la ficha de personaje. Las estadísticas dependen de la clase activa.

## La ficha de personaje

Abre la ficha de un miembro del grupo desde la lista del grupo. Tiene cuatro pestañas: **Status** (Estado), **Classes** (Clases), **Skills** (Habilidades) y **Gear** (Equipo). Las tasas de crecimiento están ocultas. Con **Debug** (Depuración) activado, se muestran los porcentajes de crecimiento exactos.

Tu grupo sube de nivel al ganar peleas. Una pelea perdida o de la que se huye no da experiencia. Con **Permadeath** (Muerte permanente) activado, una opción de la configuración, un miembro del grupo que cae en una pelea y no se salva antes de que termine desaparece para siempre.

## Pruebas de habilidad

Las pruebas fuera de las batallas leen las estadísticas MRPG del personaje. Consulta [Dados y pruebas de habilidad](dice-and-skill-checks.md#how-the-result-is-decided) para saber qué estadística usa cada habilidad.

<a id="newcomers-to-the-party"></a>

## Recién llegados al grupo

Alguien que se une después de que haya empezado la partida entra con el nivel que le da el Game Master. La mayoría de los recién llegados empiezan con un nivel bajo, y un luchador experimentado puede empezar cerca del nivel del grupo. El Game Master también puede dar a un recién llegado:

- **Crecimiento más rápido** en algunas estadísticas, si es un talento en bruto que se pondrá al día rápidamente.
- **Mejores estadísticas desde el principio**, si ya es competente.

El Game Master lo decide cuando el personaje se une. Un recién llegado sobre el que no dice nada empieza en el nivel 1.

## Jugar con otras personas

En una partida compartida, cada invitado crea su propio personaje cuando se une a la sala: un nombre, una descripción, un **concepto de personaje** para el Game Master y las mismas elecciones de **Game Mode** que tiene una persona (árbol inicial, estadísticas fuertes y estadística débil). Elegir una de tus personas rellena estos campos con sus datos. El concepto es donde le dices al Game Master quién es tu personaje y cómo te gustaría que entrara en la historia.

El Game Master integra entonces al personaje en la historia y elige su árbol hermano.

- **Una partida nueva.** Todos, tanto el anfitrión como los invitados, empiezan en el nivel 1.
- **Una partida ya empezada.** El Game Master también decide el nivel inicial del invitado, y puede darle un crecimiento más rápido o mejores estadísticas, como a cualquier [recién llegado](#newcomers-to-the-party).
- **Un invitado que regresa.** El personaje de un invitado permanece en la partida cuando se va, con su nivel, su equipo y sus bestias domesticadas. Mientras su jugador no está, el personaje no participa en las peleas ni gana experiencia, y el Game Master lo deja fuera de las escenas. Cuando el invitado vuelve, juega con el mismo personaje y el nivel con el que se fue.

<a id="move-a-legacy-game-to-mrpg"></a>

## Migrar una partida Legacy a MRPG

Una partida Legacy conserva sus fichas Legacy todo el tiempo que quieras. Para migrarla, abre **Journal** (Diario) y, en la pestaña **All** (Todo), busca la tarjeta **MRPG classes** (Clases MRPG). Selecciona **Upgrade** (Actualizar).

La tarjeta muestra lo siguiente para cada miembro del grupo:

- **Class** (Clase). El árbol en el que empieza, rellenado a partir de la elección de su tarjeta de la biblioteca o, en su defecto, de su clase Legacy. Puedes cambiarlo.
- **Sister tree** (Árbol hermano). El árbol secundario que abre su temperamento. Un personaje que todavía no tenga temperamento recibe uno que se deduce de su descripción al actualizar.
- **Gear** (Equipo). Cada arma y pieza de armadura Legacy que lleva, y la pieza MRPG en la que se convertiría. Desmarca la casilla para dejar una tal como está.

Cuando confirmas con **Upgrade the party** (Actualizar el grupo):

- Cada miembro del grupo empieza en el nivel 10, el nivel máximo de su clase inicial, con las estadísticas de cada nivel generadas como al subir de nivel.
- La clase de su tarjeta se convierte en su clase MRPG. Su clase y sus habilidades Legacy pasan a una nota **Before the upgrade** (Antes de la actualización) de la tarjeta, para que la historia las siga conociendo. Sus estadísticas Legacy también permanecen en la tarjeta.
- Cada arma o pieza de armadura aceptada se convierte en su pieza MRPG y conserva su nombre, y el personaje la lleva puesta si su clase puede hacerlo.

> **Advertencia:** La actualización es unidireccional. Una partida que haya migrado a clases MRPG no puede volver a las fichas Legacy.

La actualización no se ofrece durante una pelea. Termina primero la pelea. Una partida que usa un conjunto de reglas no se puede actualizar: conserva las fichas de su conjunto de reglas.

## Guías relacionadas

- [Game Mode: combate](combat.md)
- [Game Mode: grupo y NPC](party-and-npcs.md)
- [Game Mode: dados y pruebas de habilidad](dice-and-skill-checks.md)
