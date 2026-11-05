# Escenas: ramificar un roleplay

Una escena es un roleplay breve que se ramifica a partir de un chat de Conversation. Úsala para un flashback, una cita o una pelea, sin perder el hilo principal.

Cada escena es su propio chat de Roleplay, con su propio fondo, sus propios personajes y su propio mensaje de apertura. Mientras está abierta, el chat de Conversation original muestra una tarjeta que dice **A scene is in progress** (Hay una escena en curso), con un botón **Go to Scene** (Ir a la escena).

Mientras una escena está en curso, sus personajes no responden en el chat de Conversation, y un aviso indica que están en una escena activa. Para que te respondan allí de todos modos, activa **Allow replies here** (Permitir respuestas aquí) en la tarjeta. Empieza desactivado. Con él activado, los personajes de la escena responden cuando les escribes, pero siguen sin enviar mensajes por su cuenta.

## Iniciar una escena

Antes de empezar: abre un chat de Conversation que ya tenga algunos mensajes. Consulta [Conversation Mode: primeros pasos](../conversation/getting-started.md).

1. En el cuadro de mensaje, escribe `/scene` y una descripción breve. `/rp` hace lo mismo. Por ejemplo: `/scene we sneak into the old library at midnight`
2. Pulsa <kbd>Enter</kbd>. Se abre **Scene Prompt Setup** (Preparación del prompt de escena).
3. Si ves **Scene persona** (Persona de la escena), elige qué persona te representa. **Use the Conversation persona** (Usar la persona de Conversation) conserva la persona de la Conversation.
4. Si ves **Scene characters** (Personajes de la escena), deja activado **Let the scene planner choose characters** (Dejar que el planificador de escenas elija los personajes) para que Marinara elija. O desactívalo y elige al menos un personaje.
5. Elige un **Prompt preset** (Preset de prompt). Déjalo en **None** (Ninguno) para usar el preset de tu [perfil de ajustes](../chats/settings-profiles.md#choosing-the-default-profile) predeterminado de Roleplay. Marinara recuerda tu elección para la siguiente escena.
6. En **POV**, elige **First Person**, **Second Person** o **Third Person**.
7. En **Tense**, elige **Past**, **Present** o **Future**.
8. Opcional: escribe notas en **Extra instructions** para dirigir la escena.
9. Haz clic en **Plan Scene**.

La escena se abre como un nuevo chat de Roleplay en tu lista de chats, con un mensaje de apertura que plantea la situación. Haz clic en **Cancel** (Cancelar) en la ventana de preparación para detenerte sin crear una escena.

`/scene` solo también funciona cuando la conversación tiene suficiente historial. Si la conversación aún no tiene mensajes, Marinara te pide que añadas una descripción o que chatees primero.

Un personaje también puede pedir iniciar una escena. Junto a su respuesta aparece una invitación **Set up scene** (Configurar escena). Haz clic en ella para abrir **Scene Prompt Setup** y luego continúa desde el paso 3. **Cancel** cierra la preparación, y la invitación sigue disponible, incluso después de recargar.

Cómo se abre la escena:

- Parte de tu perfil de ajustes predeterminado de Roleplay, como cualquier chat nuevo de Roleplay. Un [perfil de ajustes](../chats/settings-profiles.md) es un conjunto guardado de ajustes del chat.
- Cuando el plan de la escena los incluye, primero se publica una nota breve sobre cómo jugar la escena como mensaje del narrador, y luego la descripción de la escena como un segundo mensaje del narrador. Un plan sin nota se la salta.
- Con un solo personaje, la apertura está escrita con la voz de ese personaje, con las palabras habladas entre comillas dobles salvo que tus instrucciones de escritura fijen otro estilo.
- En una escena de grupo, la apertura sigue el modo de grupo del perfil. **Merged (Narrator)** (Fusionado: narrador) es el predeterminado: una sola respuesta da voz a todos los personajes. En el modo **Individual**, la escribe el personaje que abre la escena. Consulta [Chats grupales](../chats/group-chats.md#choose-who-speaks).

## Usar la barra de escena

Dentro de una escena, una barra encima del cuadro de mensaje decide qué pasa con ella. Los botones que aparecen dependen de si la escena tiene una conversación de origen.

| Botón | Qué hace |
| --- | --- |
| **Back to conversation** (Volver a la conversación) | Vuelve al chat de Conversation que inició la escena. La escena sigue abierta. Solo aparece cuando hay una conversación de origen. |
| **End Scene** (Terminar escena) | Guarda un resumen y termina la escena. Haz clic en **Yes** en **End and save summary?** (¿Terminar y guardar el resumen?). |
| **Discard** (Descartar) | Borra la escena y no guarda nada. Haz clic en **Yes** en **Discard scene?** (¿Descartar la escena?). |
| **Convert** (Convertir) | Convierte la escena en un Roleplay independiente propio. Consulta más abajo. |

**End Scene** muestra **Saving...**, escribe un resumen corto en la conversación como una memoria y te devuelve allí. **Discard** no conserva nada. Ambos quitan la escena de tu conversación.

## Clonar una escena a partir de un mensaje

Para copiar una escena hasta un mensaje y continuarla por separado, mientras la original sigue abierta:

1. Pasa el cursor sobre el mensaje desde el que quieres ramificar.
2. Haz clic en su acción **Clone from here** (Clonar desde aquí).

Marinara crea un nuevo Roleplay independiente con los mensajes hasta ese mensaje inclusive, muestra una confirmación y lo abre.

## Convertir una escena en un Roleplay

Usa **Convert** cuando una escena ha crecido hasta convertirse en una historia que quieres conservar como un Roleplay normal.

1. Haz clic en **Convert** en la barra de escena.
2. Lee **Convert this scene into a standalone roleplay?** (¿Convertir esta escena en un roleplay independiente?). Crea un nuevo chat de Roleplay a partir de la escena y separa la escena original de su conversación. No se escribe de vuelta ningún resumen de escena ni ninguna memoria del personaje.
3. Haz clic en **Convert**, o en **Cancel** para no cambiar nada.

Clonar mantiene abierta la escena original. Convertir no.

## Escenas y chats conectados

Una escena es autónoma. No toma contexto de una Conversation conectada, aunque el chat padre sí lo haga, e ignora las notas cortas de dirección que una conversación conectada puede enviar a un Roleplay vinculado. Para un vínculo bidireccional continuo entre una conversación y un roleplay, usa un chat conectado. Consulta [Conectar una Conversation a un Roleplay o Game](../chats/connected-chats.md).

## Guías relacionadas

- [Modo Roleplay: primeros pasos](getting-started.md)
- [Ramas de chat](../chats/branches.md)
- [Conectar una Conversation a un Roleplay o Game](../chats/connected-chats.md)
