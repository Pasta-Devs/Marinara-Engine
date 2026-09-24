# Game Mode: dados y pruebas de habilidad

Esta guía cubre las tiradas de dados en el Game Mode (modo juego) de Marinara Engine. Explica el menú de dados rápidos, la notación de dados personalizada y los límites de las tiradas personalizadas. También explica cómo el Game Master (director del juego) resuelve una prueba de habilidad contra una Clase de Dificultad (DC).

## Tiradas de dados

La barra de entrada de mensajes en un chat de Game Mode tiene un botón de dados. Pasa el cursor por encima para ver la tooltip (texto de ayuda) **Roll dice**. Haz clic en él para abrir el menú de dados rápidos.

El menú tiene ocho presets (ajustes guardados) de un solo clic:

| Preset | Tira |
|---|---|
| d20 | un dado de 20 caras |
| d6 | un dado de 6 caras |
| 2d6 | dos dados de 6 caras |
| d10 | un dado de 10 caras |
| d100 | un dado de 100 caras |
| d4 | un dado de 4 caras |
| d8 | un dado de 8 caras |
| d12 | un dado de 12 caras |

Para hacer una tirada rápida:

1. Abre la barra de entrada de mensajes en un chat de Game Mode.
2. Haz clic en el botón de dados.
3. Haz clic en uno de los ocho presets, por ejemplo **d20**.
4. Deberías ver un pequeño chip en la barra de entrada, como `🎲 d20`.

La tirada no se envía de inmediato. Queda en cola. Para quitar una tirada en cola, haz clic en el botón de borrar del chip. Su tooltip es **Clear queued roll**.

El cálculo de los dados se ejecuta cuando envías tu siguiente mensaje. La app añade el resultado al final de tu mensaje como una etiqueta. Un solo dado sin bono se ve así:

```
[dice: d20 = 14]
```

Una tirada con más de un dado o con un bono también muestra las partes:

```
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

El Game Master lee esa etiqueta y narra en torno al resultado.

Cuando el Game Master hace varias tiradas en un turno, cada tarjeta de dados ocupa su propio lugar en la cola. Cierra una tarjeta para ver la siguiente. Todas las tiradas se guardan en el swipe (respuesta alternativa) activo de ese turno y siguen en **Logs** (registros) después de recargar. Continuar un turno conserva las tiradas anteriores; regenerarlo crea un conjunto independiente para el nuevo swipe.

El Game Master también puede pedir una tirada en la narración con `[dice: 3d8+2]`. El motor proporciona los números reales y muestra la misma tarjeta animada. Funciona en conexiones que solo admiten texto, incluidas las suscripciones de Claude y Grok. Usa la misma notación y los mismos límites que el menú de dados.

## Notación de dados personalizada

El menú de dados también tiene un campo de texto para una tirada personalizada. Usa la notación estándar `NdM`. `N` es cuántos dados tirar y `M` es cuántas caras tiene cada dado. Puedes añadir un bono o una penalización al final.

El texto de ejemplo del campo muestra un ejemplo: `3d8+2`. Eso significa tirar tres dados de 8 caras y sumar 2 al total.

Para usar una tirada personalizada:

1. Haz clic en el botón de dados para abrir el menú.
2. Escribe tu notación en el campo de texto, por ejemplo `2d6+1`.
3. Pulsa Enter, o haz clic en el pequeño botón de avión de papel (enviar) junto al campo.
4. Deberías ver la tirada en cola como un chip, lista para enviar.

Algunos ejemplos más que puedes escribir:

- `d20` tira un dado de 20 caras.
- `4d8-1` tira cuatro dados de 8 caras y resta 1.
- `2d6+3` tira dos dados de 6 caras y suma 3.

Hay dos límites estrictos. Puedes tirar como máximo 100 dados a la vez y cada dado puede tener hasta 1000 caras. Si pides más, la aplicación reduce tu solicitud a esos límites en lugar de rechazarla, y la tarjeta de resultado muestra la notación reducida: escribir `500d6` genera una tarjeta `100d6` para los cien dados que realmente tiró. Si el texto no es una notación de dados válida – `NdM` o un simple `dM` como `d20` –, la tirada falla y aparece un error que indica el formato esperado.

## Pruebas de habilidad

Una prueba de habilidad comprueba si tienes éxito en algo arriesgado, como escabullirte, detectar una pista o convencer a un NPC (personaje no jugador). Tú no inicias una prueba de habilidad por tu cuenta. El Game Master la solicita dentro de su narración. La app la convierte entonces en una tirada de d20 animada con un banner de resultado.

Una prueba solicitada por texto empieza con el intento. El motor resuelve los dados y realiza una solicitud adicional al modelo con los resultados reales para que el Game Master complete el desenlace en el mismo turno. También corrige borradores que adivinaron el resultado antes de la tirada. La solicitud adicional vuelve a enviar el prompt y consume más tokens de entrada y salida. Si falla, el turno conserva los resultados resueltos en su registro sin guardar un desenlace inventado o parcial. Un aviso con el botón **Regenerate turn** (regenerar turno) permanece en el turno, incluso después de recargar el chat.

Desactiva **Narrate dice outcomes immediately** (narrar los resultados de los dados inmediatamente) en **Chat Settings → Function Calling** para conservar los resultados reales para el siguiente turno sin esta solicitud adicional. Esta opción está activada de forma predeterminada. Las solicitudes que no producen ninguna tirada real nunca activan la solicitud de narración adicional.

Hay una tercera opción que mantiene el desenlace en el mismo turno sin la segunda solicitud. Consulta [Terminar un turno con dados en una sola solicitud](#finishing-a-rolled-turn-in-one-request).

En una conexión compatible con la herramienta de dados, el Game Master puede obtener una tirada real durante la generación. La tarjeta aparece en cuanto responde la herramienta; la prueba completada registra ese resultado sin volver a tirar. Cada prueba de habilidad resuelta recibe su propio aviso de resultado después de las tarjetas de dados en cola.

El banner muestra la habilidad y el número objetivo, por ejemplo **Stealth Check** con **DC 15** al lado. DC significa Clase de Dificultad (Difficulty Class). Es el número que tu tirada debe alcanzar o superar.

### Cómo se decide el resultado

La prueba tira un dado de 20 caras y suma dos modificadores:

- Un modificador de habilidad, a partir del nivel de habilidad que el juego lleva para tu personaje. Si el juego todavía no tiene un nivel para esa habilidad, este modificador es 0.
- Un modificador de atributo, a partir del atributo que gobierna esa habilidad.

La tirada del dado más ambos modificadores es tu total. Si el total alcanza o supera la DC, la prueba tiene éxito. Si se queda corta, la prueba falla. Cada habilidad se asigna a un atributo gobernante automáticamente. Por ejemplo, Stealth usa Dexterity, Perception usa Wisdom y Persuasion usa Charisma. Una habilidad que la app no reconoce recurre a Intelligence.

### Éxito crítico y fallo crítico

Dos tiradas anulan el cálculo:

- Un 20 natural (el dado en sí muestra 20) es un **CRITICAL SUCCESS**. Siempre pasa, incluso contra una DC alta.
- Un 1 natural (el dado en sí muestra 1) es un **CRITICAL FAILURE**. Siempre falla, incluso con modificadores grandes.

El banner muestra uno de cuatro resultados: **CRITICAL SUCCESS**, **SUCCESS**, **FAILURE** o **CRITICAL FAILURE**.

### Otros sistemas de dados

El Game Master puede indicar otra notación, como `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. Estas pruebas usan el modificador fijo de la notación en lugar de los modificadores de d20 de la ficha del personaje y tienen éxito cuando el total alcanza la DC. Las reglas del 1 y el 20 naturales solo se aplican a la prueba estándar de d20 descrita arriba.

Las reservas de éxitos deben indicar tanto el umbral por dado como el número de éxitos necesarios: `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` tira seis d10, cuenta una vez cada dado que muestre al menos 6 y tiene éxito con un mínimo de cuatro éxitos. El motor no adivina un umbral ausente ni implementa dados explosivos, pifias u otras reglas especiales de reservas. Una reserva sin un umbral válido queda sin resolver y se eliminan los números inventados por el modelo.

Esta es la reserva de una partida **sin conjunto de reglas** y no cambia. Una partida con un conjunto basado en reservas es distinta: el motor posee sus reglas. Consulta [Partidas con un conjunto de reglas](#games-that-use-a-ruleset).

Las solicitudes no compatibles, como `4d6kh3`, `3d6!` o `4dF`, no se tiran. El motor registra la notación no compatible y elimina los números inventados de los registros de pruebas. Estos resultados quedan sin resolver; el motor no sustituye silenciosamente el sistema de dados.

### Ventaja y desventaja

El Game Master puede solicitar una prueba con ventaja o con desventaja. Una prueba nunca se tira con ambas al mismo tiempo.

- Con ventaja, la app tira dos dados de 20 caras y se queda con el más alto.
- Con desventaja, la app tira dos dados y se queda con el más bajo.

Si el GM pide ambas a la vez, la app deja la prueba sin resolver en vez de adivinar su intención; no aparece ningún banner para ella.

Cuando cualquiera de las dos está activa, el banner muestra el modo junto a la DC, y marca qué dado usó.

### Tirar tu propio dado por adelantado

Puedes poner en cola tu propio `d20` desde el menú de dados antes de que ocurra la prueba. Cuando lo haces, la prueba de habilidad usa tu número tirado en lugar de tirar un dado nuevo. Tus modificadores de habilidad y de atributo se aplican igualmente por encima de él.

<a id="games-that-use-a-ruleset"></a>

## Partidas con un conjunto de reglas

Elige el conjunto una sola vez en **Rules** al crear la partida; consulta [Elegir las reglas](getting-started.md#choosing-rules). Sin conjunto se mantienen las reglas anteriores, incluidas las reservas simples de éxitos sin dados explosivos ni otras reglas especiales.

- El GM indica la habilidad o salvación y una dificultad de la escala del conjunto. Esta puede superar 1–40; la resolución de emergencia de una prueba pendiente en un turno guardado sigue limitada a 1–40.
- El motor tira los dados del conjunto. El modificador sale de su ficha: atributo, entrenamiento (múltiplo de competencia, valor fijo o ambos) y bonificación adicional. No usa los atributos ni las bonificaciones de habilidad integrados.
- `who="Name"` selecciona un compañero; sin `who` se usa al jugador. Un compañero sin ficha recibe valores predeterminados. Un nombre desconocido o ambiguo produce una tirada sin modificador. El nombre de la persona siempre identifica al jugador, aunque coincida con un compañero. Nunca se toma prestada otra ficha.
- Los resultados naturales dependen del conjunto. En 5e (SRD 5.1), un 20 o un 1 natural no tiene efecto especial en pruebas ni salvaciones; un 20 puede fallar.
- Los números escritos por el GM se validan. Un modificador, cantidad o tipo de dados, dado elegido o resultado natural no válido provoca una nueva tirada que sustituye el resultado.
- Una tirada manual previa solo se reutiliza para una d20 individual. Otros dados, como 2d6 o una reserva, se vuelven a tirar.
- `with="Ability"` permite usar otro atributo declarado por el conjunto; los desconocidos se ignoran. Los marcadores de tirada pueden nombrar atributos, habilidades, salvaciones y `PROF` si existe bonificación de competencia.
- Si falta el paquete o es demasiado antiguo, la prueba queda pendiente y sin números. El motor no la resuelve con otro sistema. Consulta los recursos, estados y descansos en [La ficha del conjunto](party-and-npcs.md#the-ruleset-sheet).

- Si algo elegido en tu ficha modifica una tirada, como un amuleto que vuelve a tirar los dados fallidos, el GM lo nombra en la prueba y el motor cobra su coste, aplica su efecto y tira. Si no lo has elegido o no puedes pagarlo, no hace ni cuesta nada.
- Si el conjunto permite gastar un recurso para mejorar una tirada, el GM lo indica en la prueba y el motor cobra los puntos, añade lo comprado y tira como una sola operación. Si la reserva no alcanza, no se gasta nada y se hace la tirada original. El registro muestra lo realmente pagado, no lo solicitado.
- Si el conjunto tiene un contador de heridas cuya penalización afecta a las tiradas, cada prueba se dificulta al recibir daño. En reservas, resta dados sin bajar del mínimo permitido, que algunos sistemas fijan en cero. En tiradas sumadas, aplica una penalización fija. La prueba indica cuánto se aplicó, para explicar por qué tiraste menos dados. Consulta [La ficha del conjunto](party-and-npcs.md#the-ruleset-sheet).

### Conjuntos con reservas de dados

La puntuación de la ficha determina cuántos dados se tiran: atributo 3 y habilidad 2 dan cinco dados. El editor y el contexto del GM muestran "5 dice" en lugar de "+5". La dificultad es el número de éxitos necesario, por ejemplo tres, no una suma de 15.

El conjunto define el umbral, éxitos dobles, explosiones, cancelaciones por resultados bajos, pifias y éxitos excepcionales. La tarjeta muestra todos los dados, destaca los éxitos y compara su cantidad con el objetivo. Las reservas grandes ocupan más filas sin encoger los dados ni mostrar una suma ficticia.

El GM solo puede modificar el umbral de cada dado o el tamaño de la reserva dentro de los límites del conjunto. Los resultados inventados por el modelo siempre se sustituyen por tiradas reales. No se aplican ventaja, tiradas manuales previas ni la vista previa de d20 del GM; el motor tira la reserva sin mostrarla de antemano.

<a id="finishing-a-rolled-turn-in-one-request"></a>

## Terminar un turno con dados en una sola solicitud

De forma predeterminada, un turno con tiradas cuesta dos solicitudes al modelo: una para el borrador y otra para reescribir el desenlace con las cifras reales. **Finish rolled turns in one request** (Terminar los turnos con dados en una sola solicitud), en **Chat Settings → Function Calling**, elimina la segunda. Está desactivado de forma predeterminada y solo afecta al chat donde lo activas.

Funciona porque el Game Master fija su texto antes de que exista ningún número. No ve la tirada antes de decidir qué ocurre, así que no puede orientar el desenlace hacia el dado recibido. El motor tira después y se guarda su registro.

Con la opción activa, se pide al GM que escriba la prueba de una de estas tres formas, según el tipo de desenlace.

**Si el desenlace tiene dos posibilidades, escribe ambas.** La prueba se escribe sin números, seguida de un bloque con una línea de éxito y otra de fracaso. El motor tira, conserva la mitad elegida por el resultado y elimina la otra antes de que leas el turno. Ves un único desenlace, igual que si se hubiera tirado primero.

**Si el resultado es solo un número, escribe un marcador y sigue.** Daño, curación, oro, duración, cantidad o distancia: el GM escribe `[[roll: 2d6+3]]` dentro de la frase y el motor lo sustituye por el número. Un marcador puede nombrar un modificador de la ficha en vez de un valor, como `[[roll: 1d8+STR]]`, y el motor lo añade; esta forma solo se ofrece cuando la partida tiene una ficha que consultar. Un nombre que no pueda resolverse se rechaza, no se trata como cero. Pasa el puntero sobre el número de un marcador para ver los dados; cada uno aparece también en **Logs** (Registros) como una línea de tirada independiente.

**Si el número debe elegir entre tres o más finales, pide el valor y se detiene.** Es la misma prueba mínima o solicitud `[dice:]` que el GM escribe actualmente. El motor tira y guarda el resultado; el turno termina sin desenlace. El GM narra lo que significó el número al principio del siguiente turno, igual que con **Narrate dice outcomes immediately** desactivado.

Una prueba que no use ninguna de esas formas vuelve a ese mismo comportamiento: nunca queda sin resolver ni se inventa un resultado.

Conviene conocer estos detalles antes de activarlo:

- **Narrate dice outcomes immediately no se usa mientras esté activo.** Sigue visible, desactivado y con una nota explicativa. Su valor guardado no cambia; al desactivar la solicitud única recuperas el ajuste anterior.
- **Los turnos existentes no cambian.** Solo afecta a los generados después de activarlo; la transcripción guardada se lee como antes.
- **Un turno aún puede costar más de una solicitud en dos casos.** Si **Enable Tool Use** está activo y la herramienta de dados está en la lista, el GM puede llamarla, lo que cuesta una ronda completa adicional. Y una **Game tool connection** distinta de **Same as narrator** siempre hace su propia solicitud de planificación. Ninguna es la reescritura del desenlace que elimina esta opción.
- **Si algo no puede tirarse, se te avisa.** Un número que el motor no pueda interpretar se sustituye por un aviso breve, no por un valor inventado. Si no puede interpretar una rama, conserva la tirada y elimina ambas mitades. En ambos casos, una línea en **Logs** indica qué se omitió.
- **Mientras se escribe el turno**, los marcadores y bloques de ramas se retienen del texto transmitido, para que no veas un número aparecer y después cambiar. La frase terminada llega al finalizar el turno.

### Dejar que el Game Master vea un dado de cada tamaño

Debajo hay otra opción, **Let the Game Master see one die of each size** (Dejar que el Game Master vea un dado de cada tamaño), desactivada de forma predeterminada. Atiende al caso que las dos formas a ciegas no pueden resolver: un número que elige entre tres o más finales, como un margen de éxito, una tabla de localización de impactos o una tirada de reacción. Sin ella, la prueba debe terminar el turno y narrarse al inicio del siguiente.

Al activarla, el motor tira un dado de cada tamaño estándar antes del turno y muestra el siguiente valor de cada uno al GM, para que pueda gastar uno y narrar lo que significa en la misma pasada.

**Este es el coste de esa decisión; conviene leerlo con atención.** El GM ve el número antes de decidir qué probar y con qué dificultad. Puede orientar los resultados de formas que las opciones a ciegas no permiten: elegir una dificultad que supere el dado recibido o evitar pedir una prueba mientras tenga un número malo. El motor no puede saber si la dificultad encaja con la ficción, por lo que tampoco puede detectar esto. Un jugador que no sabe que el GM vio los dados interpretará una sesión sospechosamente heroica como buena suerte.

El motor sí impone lo siguiente, sin depender de la cooperación del GM:

- **Los valores salen en orden y ninguno se usa dos veces.** El motor controla la cola y entrega el siguiente, diga lo que diga el turno.
- **Todos los números del registro proceden del motor.** La tirada, el modificador, el total y el resultado se recalculan a partir de la cola y la ficha. Los números del GM que no coincidan se sustituyen y se indica en **Logs**.
- **La dificultad tiene límites.** Se mantiene entre 1 y 40, algo que antes no se aplicaba a las pruebas escritas. Una partida con conjunto puede usar toda su escala de dificultad.
- **Volver a pedir no mejora la suerte.** Las variantes de respuesta, regeneraciones y continuaciones del mismo turno reciben los mismos valores; no se puede volver a tirar hasta obtener algo bueno.
- **Solo se muestra el siguiente valor de cada tamaño.** Lo controla **Values shown per size** (Valores mostrados por tamaño), cuyo valor predeterminado es 1. Las tiradas posteriores del mismo tamaño en un turno no se ven de antemano y se narran en el siguiente.
- **Un dado sin gastar se vuelve a tirar pasado un tiempo.** Lo controla **Rethrow after idle turns** (Volver a tirar tras turnos sin uso), con valor predeterminado 3. Sin ello, un valor bajo puede quedarse al frente de la cola durante todo el chat mientras el GM evita ese tamaño. El valor 0 desactiva esta renovación y permite ese comportamiento.
- **Pedir más tiradas de las que contiene la cola no produce otra.** La prueba conserva su pregunta, pierde todos los números y se narra en el siguiente turno. **Logs** indica en qué turno ocurrió.

## Guías relacionadas

- [Game Mode: Combate](combat.md)
- [Game Mode: Primeros pasos](getting-started.md)
- [Game Mode: Grupo y NPCs](party-and-npcs.md)
