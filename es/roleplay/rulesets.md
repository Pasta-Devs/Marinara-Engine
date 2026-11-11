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
