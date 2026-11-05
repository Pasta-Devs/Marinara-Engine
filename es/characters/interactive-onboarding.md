# Onboarding interactivo

Solo necesitas esto si creas tarjetas para que otros jueguen con ellas. El onboarding interactivo (incorporación interactiva) permite que una tarjeta de personaje haga preguntas al jugador cuando empieza un chat de Roleplay, y luego crea una persona a partir de las respuestas. Quienes crean tarjetas lo configuran en el Character Editor. Los jugadores responden en el asistente de chat nuevo.

## Qué hace

Una persona es la tarjeta de personaje que te representa en un chat. Consulta [Personas](personas.md). Normalmente escribes una tú antes de jugar. Con el onboarding, la tarjeta trae en su lugar una plantilla de persona: los cinco campos de persona —**Description** (Descripción), **Personality** (Personalidad), **Backstory** (Trasfondo), **Appearance** (Apariencia) y **Scenario** (Escenario)— con espacios en blanco para el jugador, más las preguntas que los rellenan.

Cuando un jugador empieza un chat de Roleplay con la tarjeta, puede elegir **Create your persona** (Crear tu persona), responder a las preguntas y obtener una persona nueva y corriente. Las respuestas se escriben en el texto una sola vez. El jugador puede editar, conservar o eliminar la persona como cualquier otra. La tarjeta no cambia.

Una tarjeta también puede hacer preguntas de personaje, cuyas respuestas se guardan en ese chat en lugar de en una persona. Consulta [Preguntas de personaje](#character-questions). El onboarding usa la sintaxis de macros existente y no ejecuta ningún script.

## Configurarlo en tu tarjeta

1. Abre el personaje en el Character Editor. Consulta [Crear y editar personajes](creating-and-editing-characters.md).
2. Abre la pestaña **Onboarding**, junto a **Card** (Tarjeta).
3. Activa **Interactive onboarding** (Onboarding interactivo). Debajo del interruptor aparece una breve guía, **How onboarding works** (Cómo funciona el onboarding).

Desactivar el interruptor oculta los campos de onboarding, pero conserva lo que escribiste.

### Deja que Professor Mari lo escriba

Pídeselo a [Professor Mari](../home/professor-mari.md), por ejemplo: "Escribe un onboarding divertido para Queen Ayrene, con una persona de plantilla." Ella escribe las preguntas y los campos de la persona, y activa el onboarding. La app comprueba su trabajo antes de guardar. Un nombre mal escrito, un `{{name}}` sin pregunta o una condición sin su `#` se le devuelve para que lo corrija. Para una pregunta de personaje, también añade su `{{name}}` a uno de los campos propios de la tarjeta. Sus cambios aparecen en una tarjeta de cambios que puedes revisar o deshacer.

### Añadir preguntas de persona

En **Persona Questions** (Preguntas de persona), haz clic en **Add Question** (Añadir pregunta). Cada pregunta funciona como una variable de preset (ajuste guardado), un espacio en blanco con nombre que rellena una respuesta. Consulta [Presets](../prompts/presets.md). Una tarjeta puede tener hasta 100 preguntas.

| Campo | Qué hace |
| --- | --- |
| **Variable Name** | El nombre que usas en los campos, como `faction`. Usa letras, números y guiones bajos, y empieza por una letra o un guion bajo. Los nombres distinguen mayúsculas de minúsculas: `Gender` y `gender` son distintos. |
| **Question (shown to user)** | Lo que lee el jugador. Puede usar respuestas anteriores, como `What does {{player}} look like?`. `{{char}}` es el nombre de la tarjeta y `{{user}}`, el nombre del jugador. |
| **Options** | Convierten la pregunta en una elección. La primera opción está seleccionada de forma predeterminada. Sin opciones, el jugador escribe una respuesta libre. |
| **Value** | Lo que entra en la persona. Las mayúsculas y minúsculas se mantienen tal como las escribes, y las macros que contenga se rellenan. Déjalo en blanco para usar la etiqueta de la opción. Usa un valor en minúsculas, como `ranger`, si la respuesta va en mitad de una frase. |
| **Help text for players** (Texto de ayuda para jugadores) | Texto opcional debajo de la opción. |
| **Allow own answer** (Permitir respuesta propia) | Añade una opción **Write your own** (Escribir tu propia respuesta) junto a tus opciones. |
| **Multi-Select** (selección múltiple) | Permite al jugador elegir varias opciones, que se unen con el separador. |

Una pregunta llamada `player` establece el nombre de la persona. Sin ella, primero se pregunta a los jugadores su nombre. El editor te avisa cuando un nombre está vacío, no es válido, se usa dos veces o ya lo ocupa una macro integrada, y cuando ningún campo usa una pregunta.

### Escribir los campos de la persona

Escribe los cinco campos como si fuera una persona tuya, y pon `{{name}}` donde va una respuesta. Haz clic en un campo para ver sus **Available variables** (Variables disponibles), y haz clic en una para insertarla donde está el cursor.

```text
Name: {{player}}
Class: {{class}}
Role: {{player}} is a {{class}} sworn to {{faction}}.
```

Usa `{{#if}}` para mostrar texto solo con algunas respuestas:

```text
{{#if knowsHer == yes}}Grew up next door to {{char}}. {{relationToAna}}{{/if}}
```

Una pregunta que solo aparece dentro de un `{{#if}}` solo se hace cuando la condición se cumple. Aquí, `relationToAna` es una pregunta de seguimiento que aparece cuando el jugador responde **yes** (sí). Las comparaciones no distinguen mayúsculas de minúsculas.

`{{user}}` y `{{char}}` se mantienen como macros en la persona creada. Otras macros (marcadores de posición que Marinara rellena, como `{{random}}` para un número aleatorio o `{{time}}` para la hora) se rellenan una sola vez al crear la persona, o quedan vacías si en ese momento no tienen valor.

El cuadro **Rendered preview** (Vista previa procesada) de la parte inferior muestra la persona creada a partir de respuestas de ejemplo y enumera las preguntas que se hacen, en orden.

<a id="character-questions"></a>

### Preguntas de personaje

La misma pestaña tiene una segunda lista, **Character Questions** (Preguntas de personaje). Funcionan como las preguntas de persona, pero las respuestas se guardan en el chat, no en una persona. Pon el nombre en uno de los campos propios de la tarjeta (**Description**, **Personality**, **Backstory**, **Appearance** o **Scenario**), porque esos son los campos que lee el modelo.

```text
{{char}} treats {{relationshipToUser}} with open warmth.
```

Un saludo puede usar el `{{name}}` de una pregunta de personaje y muestra la respuesta del jugador. Un saludo también puede usar el `{{name}}` de una pregunta de persona, como `Ah, so you are a {{class}}`, pero solo se rellena cuando el jugador crea esa persona en el asistente de chat nuevo, en el primer mensaje y en sus saludos alternativos. Con una persona existente o con Quick Start, la etiqueta se muestra tal como está escrita, y el Character Editor te avisa. Haz clic en un saludo y su lista **Available variables** muestra ambos tipos, con su etiqueta.

Las respuestas se guardan como variables del chat, de modo que la tarjeta lee un valor distinto en cada chat y nunca hace falta editarla. Una pregunta de personaje se hace siempre que la tarjeta está en el chat, tanto si el jugador crea una persona como si no. La ventana muestra **About you** (Sobre ti) solo cuando se está creando una persona.

Tres cosas que conviene saber:

- **Una respuesta que nunca se rellena se queda como etiqueta literal.** Una pregunta de texto libre sin valor predeterminado no recibe un valor inicial, así que un chat iniciado sin el asistente muestra `{{name}}` tal como está escrito. Las preguntas de opción reciben su primera opción como valor inicial, lo que cubre la mayoría de las tarjetas.
- **Dos tarjetas de un mismo chat que declaran el mismo nombre comparten un valor.** La última respuesta guardada es la que leen ambas. La ventana te avisa.
- **Una tarjeta que sale de un chat se lleva sus respuestas.** Cuando se quita un personaje, se eliminan las variables del chat que pertenecen a sus preguntas de personaje, salvo que otro personaje del chat declare el mismo nombre.

## Responder las preguntas como jugador

1. Empieza un chat nuevo de Roleplay. En el paso **Persona & Characters** (Persona y personajes), las tarjetas con onboarding muestran un pequeño icono de una silueta con un signo más en la lista de personajes.
2. Añade el personaje. Para obtener una persona nueva, selecciona **Create your persona** en la parte superior de **Your Persona** (Tu persona). Indica el nombre de la tarjeta a la que pertenece. Cualquier otra opción, incluida **None** (Ninguna), omite la persona.
3. Haz clic en **Next** (Siguiente). La ventana de preguntas se abre siempre que alguna tarjeta del chat tenga preguntas de personaje, tanto si creas una persona como si no.
4. Responde las preguntas. Primero van las preguntas de personaje, una sección por tarjeta, y luego **About you** cuando se está creando una persona. Las preguntas de seguimiento aparecen a medida que tus respuestas las hacen pertinentes.
5. Haz clic en **Review persona** (Revisar persona) para ver el nombre y los campos que producen tus respuestas. Las partes que rellenaron tus respuestas aparecen resaltadas. La vista previa no guarda nada.
6. Haz clic en **Create persona** (Crear persona), o en **Save answers** (Guardar respuestas) si no estás creando una. Las respuestas de personaje se guardan en el chat y el asistente continúa.

Si no funcionó: si la persona se creó pero no quedó elegida, elígela en **Your Persona**. Si no se pudieron guardar las respuestas, el chat usa en su lugar el texto predeterminado de cada tarjeta.

Las preguntas de onboarding se hacen en el asistente de chat nuevo de Roleplay. Quick Start, la configuración del modo Conversation y empezar un chat directamente desde una tarjeta de personaje todavía no las hacen. Un chat iniciado así rellena la primera opción de cada pregunta, de modo que `{{relationshipToUser}}` se resuelve en lugar de mostrar la etiqueta. Responder en el asistente sustituye ese valor predeterminado solo para ese chat.

También puedes responder después de la configuración, desde **Chat Settings** (Ajustes del chat):

- El selector **Persona** de un chat de Roleplay muestra **Create your persona** para cada tarjeta del chat que lo ofrezca. Úsalo si te saltaste el asistente o quieres una persona nueva más adelante. Consulta [Elegir tu persona en un chat](choosing-your-persona.md).
- El marcador de onboarding junto a un personaje en **Characters** (Personajes) vuelve a abrir por sí solas las preguntas de personaje de esa tarjeta. Se abre con las respuestas que el chat ya tiene, así que guardar un cambio deja las demás como estaban. Guardar también restaura una respuesta que borraste de **Chat Variables** (Variables del chat). Las respuestas de otras tarjetas no se tocan, salvo un nombre que comparten dos tarjetas, que es un solo valor, así que ambas tarjetas leen la nueva respuesta.

Al añadir una tarjeta con preguntas de personaje a un chat de Roleplay en curso, desde **Chat Settings** o soltándola sobre el chat, primero se hacen sus preguntas. Después ofrece su saludo con tus respuestas rellenadas y marcadas.

## Compartir tarjetas con onboarding

El onboarding se guarda con la tarjeta. Las exportaciones **Marinara Native** y **Compatible PNG Card** lo conservan, así que un jugador que importa la tarjeta también recibe las preguntas. **Compatible JSON** lo omite. Una tarjeta importada con más de 100 preguntas conserva las 100 primeras. Consulta [Importar y exportar tarjetas de personaje](import-export.md).

## Guías relacionadas

- [Crear y editar personajes](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Elegir tu persona en un chat](choosing-your-persona.md)
- [Macros](../prompts/macros.md)
- [Importar y exportar tarjetas de personaje](import-export.md)
