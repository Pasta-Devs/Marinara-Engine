# Game Mode: dados y pruebas de habilidad

Usa el botón de dados para tirar dados para el Game Master (GM, el director del juego) en Game Mode. Esta guía también muestra cómo el GM hace una prueba de habilidad contra una Clase de Dificultad (DC, Difficulty Class), el número que una tirada debe alcanzar o superar.

## Tirar dados

La barra de entrada de mensajes tiene un botón de dados. Su tooltip (texto de ayuda) es **Roll dice** (Tirar dados).

1. Haz clic en el botón de dados para abrir el menú de dados rápidos.
2. Haz clic en un preset (ajuste guardado): d20, d6, 2d6, d10, d100, d4, d8 o d12.
3. Aparece un chip en la barra de entrada, como `🎲 d20`. La tirada queda en cola; todavía no se envía.
4. Envía tu mensaje. Marinara tira y añade el resultado al final de tu mensaje como una etiqueta, que el GM lee y en torno a la cual narra.

Para quitar una tirada en cola antes de enviar, haz clic en **Clear queued roll** (Quitar la tirada en cola) en el chip.

Un solo dado sin bono se ve así:

```text
[dice: d20 = 14]
```

Con más de un dado, o con un bono, también se muestran las partes:

```text
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

El GM también puede pedir una tirada en su narración con `[dice: 3d8+2]`. Marinara proporciona los números reales y muestra la misma tarjeta animada. Funciona en conexiones que solo admiten texto, incluidas las suscripciones de Claude y Grok. Cuando el GM tira varias veces en un turno, cada tarjeta de dados espera su turno: cierra una para ver la siguiente. Todas las tiradas se guardan en el swipe (respuesta alternativa) activo de ese turno y siguen en **Logs** (Registros) después de recargar. Continuar un turno conserva sus tiradas anteriores. Regenerarlo crea un conjunto nuevo para el nuevo swipe.

## Tirar dados personalizados

El menú de dados tiene un campo de texto para una tirada personalizada en notación `NdM`: `N` dados de `M` caras cada uno, con un bono o una penalización opcional al final. El campo muestra el ejemplo `3d8+2` (tres dados de 8 caras, suma 2).

1. Abre el menú de dados.
2. Escribe tu notación, por ejemplo `2d6+1`.
3. Pulsa <kbd>Enter</kbd> o haz clic en el botón del avión de papel. La tirada queda en cola como un chip.

| Notación | Significado |
| --- | --- |
| `d20` | Un dado de 20 caras |
| `4d8-1` | Cuatro dados de 8 caras, resta 1 |
| `4d6kh3` | Tira cuatro dados de 6 caras, conserva los tres más altos |
| `2d20kl1` | Conserva el más bajo: una tirada con desventaja |
| `4d6dl1+2` | Descarta el dado más bajo, suma 2 |

`kh` y `kl` conservan los dados más altos o más bajos. `dh` y `dl` los descartan. Se registra cada dado tirado, y solo se suman los que se conservan.

Si no funcionó: un texto que no sea `NdM` o un simple `dM`, seguido opcionalmente de `kh`, `kl`, `dh` o `dl` y un número, falla con un error que indica el formato esperado.

Puedes tirar como máximo 100 dados a la vez, y cada dado puede tener como máximo 1000 caras. Una tirada simple que los supere se reduce a esos límites y la tarjeta muestra la notación reducida, así que `500d6` da una tarjeta `100d6`. Una tirada que conserva o descarta dados y supera los límites, como `101d6kh3`, se rechaza con un error de fuera de rango, porque reducirla cambiaría qué dados se conservan.

<a id="skill-checks"></a>

## Pruebas de habilidad

Una prueba de habilidad pone a prueba algo arriesgado, como escabullirte, detectar una pista o convencer a un NPC (personaje no jugador). Tú no la inicias. El GM la pide en su narración, y Marinara la convierte en una tirada de d20 animada con un banner de resultado. El banner muestra la habilidad y el objetivo, por ejemplo **Stealth Check** con **DC 15**. Cada prueba resuelta recibe su propio banner, después de las tarjetas de dados en cola.

### Cómo se decide el resultado

La prueba tira un d20 y suma dos modificadores:

- Un modificador de habilidad, a partir del nivel de habilidad que el juego lleva para tu personaje. Es 0 si el juego todavía no tiene un nivel para esa habilidad.
- Un modificador de atributo, a partir del atributo que gobierna la habilidad. Cada habilidad se asigna a uno automáticamente: Stealth usa Dexterity, Perception usa Wisdom y Persuasion usa Charisma. Una habilidad que Marinara no reconoce usa Intelligence.

Si el total alcanza o supera la DC, la prueba tiene éxito. Dos tiradas anulan el cálculo:

- Un 20 natural es un **CRITICAL SUCCESS** (Éxito crítico) y siempre pasa.
- Un 1 natural es un **CRITICAL FAILURE** (Fallo crítico) y siempre falla.

El banner muestra **CRITICAL SUCCESS**, **SUCCESS** (Éxito), **FAILURE** (Fallo) o **CRITICAL FAILURE**.

### Ventaja y desventaja

El GM puede pedir una prueba con ventaja (se tiran dos d20 y se conserva el más alto) o con desventaja (se conserva el más bajo). El banner muestra el modo junto a la DC y marca el dado usado. Si el GM pide ambas a la vez, Marinara deja esa prueba sin tocar en vez de adivinar, así que no recibes ningún banner para ella.

### Tirar tu propio d20 por adelantado

Pon en cola un `d20` desde el menú de dados antes de que ocurra la prueba. La prueba usa entonces tu número en lugar de tirar un dado nuevo. Tus modificadores de habilidad y de atributo se siguen aplicando.

Para saber cómo termina el GM un turno después de una tirada, y cuánto cuesta, consulta [Cómo se narra un turno con dados](#how-a-rolled-turn-is-narrated).

<a id="games-that-use-a-ruleset"></a>

### Partidas con un conjunto de reglas

En una partida con un conjunto de reglas, como 5e (SRD 5.1), las pruebas usan los propios dados, la escala de dificultad y los modificadores de la ficha del conjunto de reglas, y en algunos conjuntos de reglas, una reserva de dados o dados de símbolos. Consulta [Pruebas con un conjunto de reglas](rulesets.md#checks-on-a-ruleset).

## Referencia

<a id="how-a-rolled-turn-is-narrated"></a>

### Cómo se narra un turno con dados

Cuando el GM pide una prueba por texto, Marinara resuelve los dados y tiene tres formas de terminar el desenlace. Las tres están en **Chat Settings → Function Calling** (Ajustes del chat → Llamadas a funciones).

| Ajuste | Predeterminado | Qué ocurre |
| --- | --- | --- |
| **Finish rolled turns in one request** (Terminar los turnos con dados en una sola solicitud) | Activado | Una solicitud. El GM escribe el desenlace sin números y Marinara los rellena. Consulta abajo. |
| **Narrate dice outcomes immediately** (Narrar los resultados de los dados inmediatamente) | Activado | Dos solicitudes. El GM escribe un borrador, Marinara tira y luego una solicitud más vuelve a enviar el prompt (las instrucciones enviadas a la IA) con los resultados reales para que el GM termine el desenlace en el mismo turno. Esto cuesta más tokens (fragmentos de texto) de entrada y de salida. |
| Ambos desactivados | | Los resultados reales se guardan para el siguiente turno, sin ninguna solicitud adicional. |

Con **Narrate dice outcomes immediately**, si la solicitud adicional falla, el turno conserva los resultados resueltos en su registro sin guardar un desenlace inventado o parcial. Un aviso con un botón **Regenerate turn** (Regenerar turno) permanece en el turno, incluso después de recargar. Una solicitud sin tiradas reales nunca activa la solicitud adicional.

En una conexión compatible con la herramienta de dados, el GM puede obtener en su lugar una tirada real durante la generación. La tarjeta de dados aparece en cuanto responde la herramienta, y la prueba completada registra ese resultado sin volver a tirar.

<a id="finishing-a-rolled-turn-in-one-request"></a>

#### Terminar un turno con dados en una sola solicitud

Sin esta opción, un turno con tiradas cuesta dos solicitudes. **Finish rolled turns in one request** elimina la segunda. Está activado de forma predeterminada. Desactívalo en un chat para que ese chat reescriba en su lugar cada turno con tiradas usando los números reales.

Funciona porque el GM fija su texto antes de que exista ningún número. Nunca ve una tirada antes de decidir qué ocurre, así que no puede orientar el desenlace. Marinara tira después y guarda su propio registro. Mientras el interruptor está activado, el GM escribe una prueba de una de estas tres formas:

- **Dos desenlaces.** El GM escribe la prueba sin números, seguida de una línea de éxito y otra de fracaso. Marinara tira, conserva la mitad que eligió la tirada y elimina la otra antes de que leas el turno.
- **Solo un número.** Para daño, curación, oro, una duración, una cantidad o una distancia, el GM escribe un marcador de posición como `[[roll: 2d6+3]]` en mitad de la frase, y Marinara pone el número en su lugar. Un marcador puede nombrar un modificador de la ficha, como en `[[roll: 1d8+STR]]`. Esa forma solo se ofrece cuando tu partida tiene una ficha que leer, y un nombre que Marinara no puede resolver se rechaza en lugar de tratarse como cero. Pasa el puntero sobre un número de un marcador para ver sus dados. Cada uno aparece también en **Logs** como su propia línea de tirada.
- **Tres o más finales.** El GM pide el valor y se detiene. Marinara tira y lo registra, el turno termina sin el desenlace, y el GM narra lo que significó el número al principio del siguiente turno.

Una prueba que no se escriba de ninguna de estas formas recurre al último comportamiento, así que nada queda sin resolver y nada se inventa.

- **Narrate dice outcomes immediately** no se usa mientras esta opción está activada. Sigue visible pero desactivado, y su valor guardado se conserva para cuando desactives esta opción.
- Los turnos existentes no cambian. El interruptor solo afecta a los turnos generados después de activarlo.
- Un turno aún puede costar más de una solicitud en dos casos: si **Enable Tool Use** (Activar el uso de herramientas) está activado y la herramienta de dados está en tu lista de herramientas (una llamada a una herramienta cuesta una ronda completa adicional), o si hay configurado un **Game tool provider** (Proveedor de herramientas del juego) distinto de **Same as narrator** (El mismo que el narrador), que siempre hace una solicitud de planificación.
- Cuando algo no puede tirarse, un aviso breve sustituye al número, nunca un valor inventado. **Logs** indica qué se omitió.
- Mientras se escribe el turno, los marcadores y los bloques de ramas se retienen del texto en streaming, así que nunca ves cambiar un número.

<a id="symbol-dice-by-name"></a>

### Dados de símbolos por nombre

En una partida cuyo conjunto de reglas tira dados de símbolos (un conjunto `symbol-pool`, como un sistema de estilo Genesys), el campo personalizado también acepta esos dados por nombre. Indica una cantidad y el nombre de un dado para cada tipo, por ejemplo `2 ability 1 proficiency vs 2 difficulty`. Los nombres pueden ser el ID o la etiqueta de un dado, sin distinguir mayúsculas de minúsculas, separados por espacios, comas, `+` o `vs`. Una tirada puede nombrar hasta 40 dados.

La tarjeta muestra cada dado con los símbolos de su cara, después los símbolos que quedan tras cancelarse y si eso es un éxito. La etiqueta del mensaje lleva lo mismo, por ejemplo `[dice: 2 ability vs 1 difficulty = 1 Success, 1 Advantage; success]`. La herramienta de dados del GM también acepta estos nombres. La notación simple `NdM` sigue funcionando en todas las partidas.

### Otros dados en una prueba de habilidad

El GM puede indicar otra notación, como `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. Estas pruebas usan el modificador fijo de la notación en lugar de los modificadores de d20 de la ficha y tienen éxito cuando el total alcanza la DC. Las reglas del 1 natural y del 20 natural solo se aplican a la prueba estándar de d20.

Una reserva de éxitos debe indicar tanto el umbral por dado como el número de éxitos necesarios: `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` tira seis d10, cuenta cada dado que muestre al menos 6 y tiene éxito con al menos cuatro. Marinara no adivina un umbral que falte ni implementa dados explosivos, pifias u otras reglas especiales de reservas. Una reserva sin un umbral válido queda sin resolver, y se eliminan los números inventados.

Esta es la reserva que recibe una partida sin conjunto de reglas. Una partida con un conjunto de reglas basado en reservas de dados es distinta: consulta [Pruebas con un conjunto de reglas](rulesets.md#checks-on-a-ruleset).

El atributo `dice=` de una prueba solo acepta `NdM` simple. Las solicitudes como `4d6kh3`, `3d6!` o `4dF` no se tiran: Marinara registra la notación no compatible y elimina los números inventados, y el desenlace queda abierto.

### Dejar que el Game Master vea un dado de cada tamaño

**Let the Game Master see one die of each size** (Dejar que el Game Master vea un dado de cada tamaño) está debajo de **Finish rolled turns in one request**. Está desactivado de forma predeterminada. Atiende un caso que las formas a ciegas no pueden resolver: un número que debe elegir entre tres o más finales, como un margen de éxito o una tabla de localización de impactos. Sin él, esa prueba termina el turno y se narra en el siguiente.

Al activarlo, Marinara tira un dado de cada tamaño estándar antes del turno y muestra al GM el siguiente valor de cada uno, para que pueda escribir lo que significa en la misma pasada.

> **Advertencia:** El GM ve entonces el número antes de decidir qué probar y con qué dificultad. Puede elegir una dificultad que el dado que tiene vaya a superar, o evitar pedir una prueba mientras tenga un número malo. Marinara no puede saber si una dificultad encaja con la ficción, así que no puede detectarlo. Una sesión sospechosamente heroica puede deberse a que el GM está moldeando la suerte.

Lo que Marinara impone sin depender de la cooperación del GM:

- Los valores salen en orden y ninguno sale dos veces.
- Todos los números del registro son de Marinara. La tirada, el modificador, el total y el resultado se recalculan a partir de la cola y de tu ficha. Un número que no coincide se sustituye, y **Logs** lo indica.
- La dificultad se mantiene entre 1 y 40. Una partida con un conjunto de reglas puede llegar hasta donde llegue la escala de dificultad de su conjunto.
- Un swipe, una regeneración o una continuación del mismo turno se enfrenta a los mismos valores, así que no se puede volver a tirar para tener suerte.
- **Values shown per size** (Valores mostrados por tamaño) fija cuántos valores ve el GM por tamaño. El valor predeterminado es 1. Las tiradas posteriores de ese tamaño en un turno no se ven y se narran en el siguiente turno.
- **Rethrow after idle turns** (Volver a tirar tras turnos sin uso), con valor predeterminado 3, vuelve a tirar un dado sin gastar después de esa cantidad de turnos. Sin ello, un valor bajo podría quedarse al frente durante el resto del chat. Pon 0 para desactivar esta nueva tirada.
- Si el GM pide más tiradas de las que contiene la cola, la prueba conserva su pregunta, pierde todos los números y se narra en el siguiente turno. **Logs** indica en qué turno.

## Guías relacionadas

- [Game Mode: jugar con un conjunto de reglas](rulesets.md)
- [Game Mode: combate](combat.md)
- [Game Mode: primeros pasos](getting-started.md)
- [Game Mode: grupo y NPC](party-and-npcs.md)
