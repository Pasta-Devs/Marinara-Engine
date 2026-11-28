# Roleplay: jugar con un conjunto de reglas

Un chat de Roleplay puede jugarse con un conjunto de reglas de mesa, del mismo tipo que usa Game Mode. El narrador pide una prueba cuando pasa algo incierto, Marinara tira los dados desde la ficha del personaje y la respuesta cuenta qué decidió la tirada. Úsalo cuando quieras dados de verdad y una ficha de personaje en un roleplay sin empezar una partida de Game Mode.

Sirve cualquier conjunto de reglas que tengas instalado para Game Mode, como 5e (SRD 5.1), y también las fichas que ya hayas hecho para él en el editor de personajes y de personas.

## Activar un conjunto de reglas para un chat

Antes de empezar: instala un conjunto de reglas. Consulta [Obtener un conjunto de reglas](../game/rulesets.md#get-a-ruleset).

1. Abre el chat de Roleplay.
2. Abre **Chat Settings** (Ajustes del chat) y busca la sección **Ruleset** (Conjunto de reglas).
3. Elige un conjunto de reglas de la lista. Muestra los conjuntos que tienes instalados.
4. Marinara da una ficha a cada miembro del chat y dice cuántas ha añadido. Cada miembro aparece listado bajo el conjunto de reglas.

Cada miembro recibe una copia de su propia ficha para ese conjunto de reglas desde el editor de personajes o de personas (consulta [Fichas de conjuntos de reglas](../characters/colors-and-stats.md#ruleset-sheets)). Un miembro sin ficha recibe una en blanco, marcada como **blank sheet** (ficha en blanco) en la lista, para rellenarla en el chat. Tu persona va primero. Los cambios en el chat se quedan en el chat y nunca vuelven al personaje ni a la persona.

Si no funcionó: un conjunto de reglas importado necesita **Allow custom Agent imports** (Permitir importaciones de agentes personalizados) activado. Consulta [Obtener un conjunto de reglas](../game/rulesets.md#get-a-ruleset).

### Rellenar una ficha en blanco

1. En la sección **Ruleset**, haz clic en **Build sheet** (Crear ficha) junto al miembro.
2. La ficha de personaje se abre en el editor de fichas. Cuando el conjunto de reglas tiene un constructor paso a paso, se abre primero ahí, igual que en Game Mode y en el editor de personajes.
3. Haz tus elecciones y haz clic en **Save sheet** (Guardar ficha).

### Añadir una ficha para un miembro nuevo

Cuando un personaje se una al chat más tarde, haz clic en **Add missing sheets** (Añadir las fichas que faltan). Los miembros que ya tienen ficha la conservan.

### Quitar una ficha

Un miembro que no debería tener ficha, como una tarjeta de narrador, puede perderla.

1. En la sección **Ruleset**, haz clic en el icono de la papelera junto al miembro.
2. Haz clic en **Remove sheet** (Quitar ficha).

El chat lo recuerda, así que **Add missing sheets** y una versión más nueva del conjunto de reglas dejan fuera a ese miembro. Para darle otra ficha, haz clic en su botón después de **No sheet:** (Sin ficha), por ejemplo **Give Mira a sheet** (Dar una ficha a Mira).

### Cambiar el conjunto de reglas o desactivarlo

- Elige **None** (Ninguno) para dejar de jugar con el conjunto de reglas. Las fichas se conservan, así que elegir el mismo conjunto otra vez continúa donde lo dejaste.
- Elegir otro conjunto reinicia todas las fichas, porque una ficha hecha para un conjunto no significa nada para otro.

## Pruebas durante el juego

Escribes tu turno como siempre. Cuando tu personaje intenta algo incierto cuyo resultado importa, el narrador pide una prueba en lugar de decidir el resultado. Marinara la tira desde la ficha y luego el narrador escribe qué decidió la tirada.

El mensaje terminado muestra una tarjeta de dados donde ocurrió la prueba, con la habilidad, la dificultad, los dados y **Success** (Éxito) o **Failure** (Fallo). Las acciones normales que en realidad no pueden fallar no reciben prueba.

> **Consejo:** Algunos modelos ignoran la instrucción de pedir pruebas y deciden el resultado por su cuenta. Si no aparecen pruebas, prueba un modelo más potente para la **Connection** (Conexión) del chat.

En los turnos de **Impersonate** (Suplantar) no se tiran pruebas. Una sala multijugador no puede jugar con un conjunto de reglas.

## Usar las fichas de personaje

Haz clic en **Open sheet** (Abrir ficha) junto a un miembro de la sección **Ruleset**. La ficha es la misma que muestra Game Mode. El botón de pergamino en la parte superior del Tracker Panel abre la ficha de tu persona.

- Haz clic en **−** y **+** junto a una reserva o un contador, como los puntos de vida o el estrés, para cambiarlo. El cambio se guarda con el mensaje actual, así que sigue a los swipes (respuestas alternativas) y a las ramas.
- Haz clic en **Edit ruleset sheet** (Editar ficha del conjunto de reglas) para cambiar puntuaciones, rangos de habilidad, campos y listas, y luego en **Save sheet** (Guardar ficha).

El narrador lee las fichas en cada turno y las cambia con comandos de ficha en su respuesta, que Marinara aplica y oculta del mensaje. Para descansar, dilo en tu turno, por ejemplo "hacemos un descanso largo". El narrador anota el descanso y las fichas recuperan lo que restaura el descanso del conjunto de reglas. También puedes hacer clic en **Rest** (Descanso) en una ficha.

## Crear tu propio conjunto de reglas

El constructor de conjuntos de reglas crea un conjunto de reglas pequeño a partir de un formulario: cómo se tiran las pruebas, qué hay en la ficha y qué se le dice al narrador. Úsalo para un sistema que Marinara no tiene. Un conjunto de reglas creado por ti funciona como uno instalado, en Roleplay y en Game Mode.

Antes de empezar: activa **Allow custom Agent imports**, porque el constructor guarda el conjunto de reglas igual que una importación. Consulta [Obtener un conjunto de reglas](../game/rulesets.md#get-a-ruleset).

1. En **Chat Settings → Ruleset**, haz clic en **New ruleset…** (Nuevo conjunto de reglas).
2. Escribe un **Name** (Nombre).
3. En **Dice** (Dados), elige cómo se tiran las pruebas (consulta la tabla de abajo). Al elegir uno se rellenan los atributos, las reservas y los contadores iniciales, que puedes cambiar.
4. Cambia **Difficulties** (Dificultades), **Stats** (Atributos), **Skills** (Habilidades) y el resto del formulario. La mayoría de las secciones se explican en una línea bajo su título.
5. Haz clic en **Create ruleset** (Crear conjunto de reglas).

Marinara guarda el conjunto de reglas. En un chat sin conjunto de reglas, además activa el nuevo. Un chat que ya tiene un conjunto de reglas lo conserva junto con sus fichas; para cambiar, elige el nuevo conjunto de reglas en la lista.

Si un conjunto de reglas instalado ya tira de la forma que elegiste, la sección **Dice** lo nombra. Cada conjunto de reglas es una ficha aparte en cada personaje, así que, para mantener una sola ficha por personaje, juega o edita ese conjunto de reglas en lugar de crear otro.

| Dados | Cómo se tira una prueba |
| --- | --- |
| **d20 + modifier** (d20 + modificador) | Un d20 más el atributo y la habilidad, contra un número de dificultad. |
| **2d6 bands** (Franjas de 2d6) | 2d6 más el atributo: 10 o más es un acierto fuerte, de 7 a 9 un acierto débil y 6 o menos un fallo. |
| **Dice pool** (Reserva de dados) | Un dado por cada punto de atributo y de habilidad. Cuenta cada dado que alcanza el número objetivo. Eliges d6 o d10 y el objetivo. |
| **Highest d6** (d6 más alto) | Un d6 por punto, quedándote con el más alto: 6 es un éxito completo, 4 o 5 uno parcial, y dos 6 un crítico. |
| **Percentile** (Percentil) | Un d100. La prueba tiene éxito con un resultado igual o inferior al número de la habilidad. |
| **Hope and Fear** (Esperanza y Miedo) | Dos d12 más el atributo. El dado más alto indica si el resultado llega con Esperanza o con Miedo. |
| **No dice** (Sin dados) | No se tira nada. El atributo y la habilidad se suman y se comparan con la dificultad. |

### Cambiar un conjunto de reglas que creaste

1. Activa el conjunto de reglas para un chat.
2. En **Chat Settings → Ruleset**, haz clic en **Edit ruleset** (Editar conjunto de reglas).
3. Haz tus cambios y haz clic en **Save new version** (Guardar nueva versión).

El chat pasa a la nueva versión y conserva todas las fichas. Cambiar el nombre de un atributo, una habilidad, una reserva o una columna de lista conserva lo que cada personaje tiene ahí. Otro chat con el mismo conjunto de reglas pasa a la nueva versión cuando haces clic en **Add missing sheets** en ese chat.

**Edit ruleset** aparece para un conjunto de reglas que creaste o importaste desde un archivo, cuando el formulario puede contenerlo entero: uno que hizo el constructor, o un archivo escrito a mano que solo usa lo que muestra el formulario. No aparece para un conjunto de reglas de un paquete o de un repositorio. El constructor nunca abre un conjunto de reglas que tenga algo más, como reglas de combate o comentarios, así que no puede perder lo que no muestra. Además, solo aparece en un chat que juega la versión más nueva; en un chat con una más antigua, haz clic primero en **Add missing sheets**.

### Organizar la ficha

| En el formulario | En la ficha |
| --- | --- |
| El orden de las filas | Los atributos, las habilidades, las reservas, los contadores, los campos y las pestañas de listas se muestran en el orden del formulario. Arrastra una fila por su tirador para moverla, o coloca el foco en el tirador y pulsa las teclas de flecha arriba y abajo. |
| El **Group** (Grupo) de un atributo o de una habilidad | Los atributos o las habilidades con el mismo grupo se muestran bajo un mismo encabezado. |
| **Skill ranks** (Rangos de habilidad) | Los rangos que eliges para cada habilidad en la ficha, cada uno con lo que añade: al total en una tirada de d20 o de 2d6, dados en una reserva, puntos en un percentil. |
| **Show ranks on the sheet as** (Mostrar los rangos en la ficha como) | Lo que muestra la ficha junto a cada habilidad y salvación entrenada: **Check value (+2)** (Valor de prueba: +2), **Rank name** (Nombre del rango), **Dots (●●○)** (Círculos: ●●○), **Roman numerals (II)** (Números romanos: II) o **Rank number (2)** (Número de rango: 2). Las pruebas y la copia de la ficha que tiene el narrador no cambian. |
| **Practice meter** (Medidor de práctica) | Cada habilidad entrenada muestra cuánto ha avanzado hacia su siguiente rango, de 0 a 99%. La práctica en la historia hace subir el medidor, y una subida de rango lo reinicia. Puedes corregirlo en la ficha. En **No meter for:** (Sin medidor para), marca un grupo para dejar fuera sus habilidades. |
| **Number** (Número), **Bar** (Barra) o **Dots** (Círculos) en una reserva o un contador | Solo el número, una barra de relleno a su lado o una fila de círculos rellenos hasta él, un círculo por punto. Más de 20 círculos se muestran como una barra. |
| **Lists** (Listas) | Cada lista tiene su propia pestaña, con el nombre de la lista salvo que escribas otro nombre de pestaña. Las listas con el mismo nombre de pestaña comparten pestaña. |
| Las columnas de una lista | Cada fila tiene un nombre, más tus columnas: **Text** (Texto), **Number** o **Checkbox** (Casilla de verificación). La primera columna de casillas de verificación se muestra como una marca de verificación junto a cada nombre. |

### Contarle tus reglas al narrador

La sección **Prompts** contiene lo que se le dice al narrador sobre tu conjunto de reglas. **Checks** (Pruebas) y **Keeping the sheets** (Mantener las fichas) muestran un texto predeterminado; deja cualquiera de los dos vacío para usarlo. Los saltos de línea se convierten en espacios. Los nombres y los prompts no pueden contener corchetes ni llaves dobles, porque las etiquetas y las macros del narrador los usan.

| Cuadro | Para qué sirve |
| --- | --- |
| **Checks** | Cuándo pedir una prueba y cómo elegir la habilidad y la dificultad. |
| **Keeping the sheets** | Cómo cambian las fichas durante el juego. |
| **Rules reference** (Referencia de reglas) | Las reglas de la casa y cualquier otra cosa que el narrador deba tener siempre delante. |
| **World (Game Mode)** (Mundo: Game Mode) | Se lee una vez cuando se crea una partida de Game Mode con el conjunto de reglas, para que su mundo encaje con las reglas. |

## Solución de problemas

| Síntoma | Solución |
| --- | --- |
| **This chat's ruleset is not installed here, so its checks and sheets are paused.** | Instala el conjunto de reglas otra vez o elige otro. |
| El narrador nunca pide pruebas. | Usa un modelo más potente para el chat. Algunos modelos se saltan la instrucción de las pruebas. |
| Un personaje nuevo no tiene ficha. | Haz clic en **Add missing sheets**. |

## Guías relacionadas

- [Game Mode: jugar con un conjunto de reglas](../game/rulesets.md)
- [Game Mode: dados y pruebas de habilidad](../game/dice-and-skill-checks.md)
- [Modo Roleplay: primeros pasos](getting-started.md)
