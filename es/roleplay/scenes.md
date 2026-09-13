# Escenas: ramificar un roleplay

Esta guía explica las escenas en Marinara Engine. Una escena es un roleplay breve y autónomo que se ramifica a partir de un chat de **Conversation** (Conversación). Esta guía cubre cómo iniciar una, cómo jugarla y cómo terminarla, descartarla, bifurcarla o convertirla.

## Qué es una escena

Una escena es un roleplay secundario que surge de un chat de **Conversation**. Un chat de **Conversation** es el modo de mensajería directa, estilo mensajero. Una escena te permite, a ti y a un personaje, salir de ese chat hacia un momento de roleplay concentrado. Ese momento puede ser un recuerdo, una cita o una pelea. El hilo principal no se pierde.

Cada escena es su propio chat de roleplay. Tiene su propio fondo, sus propios personajes en el escenario y su propio mensaje de apertura. El personaje o la historia escriben la preparación por ti cuando la escena comienza.

Una escena es temporal por diseño. Mientras está abierta, el chat original de **Conversation** muestra una tarjeta pequeña que dice **A scene is in progress** (Hay una escena en curso). Esa tarjeta tiene un botón **Go to Scene** (Ir a la escena) que te lleva de un salto a la escena activa.

Cuando terminas, eliges qué pasa con la escena. Puedes guardar un resumen de vuelta en la conversación, desechar la escena o conservarla como un roleplay permanente propio. Esas opciones se explican más abajo.

## Iniciar una escena

Inicias una escena desde dentro de un chat de **Conversation** con el comando `/scene`. El comando tiene un alias, `/rp`, que hace lo mismo.

Sigue estos pasos:

1. Abre un chat de **Conversation** que ya tenga algunos mensajes.
2. En la caja de mensaje, escribe el comando de escena. Puedes añadir después una descripción breve de lo que quieres.

```
/scene we sneak into the old library at midnight
```

3. Pulsa Enter. Se abre la ventana **Scene Prompt Setup** (Preparación del prompt de escena).
4. Elige un **Prompt preset** (preajuste de prompt) para la nueva escena o déjalo en **None** (ninguno). Marinara recuerda esta elección para la siguiente escena. Las instrucciones propias de la escena siguen aplicándose junto con el preajuste seleccionado.
5. En **POV**, elige cómo se enmarca la escritura: **First Person**, **Second Person** o **Third Person**.
6. En **Tense**, elige **Past**, **Present** o **Future**.
7. Opcionalmente, escribe notas en la caja **Extra instructions** para dirigir la escena.
8. Haz clic en **Plan Scene**.

Marinara planifica la escena y la abre como un nuevo chat de roleplay. Deberías ver la nueva escena aparecer en tu lista de chats y abrirse automáticamente, con un mensaje de apertura que plantea la situación. Si cambias de idea en la ventana de preparación, haz clic en **Cancel** y no se crea ninguna escena.

También puedes iniciar una escena sin descripción. Escribe solo el comando por sí mismo si la conversación ya tiene suficiente historia con la que construir.

```
/scene
```

Si la conversación aún no tiene mensajes, Marinara te pide que añadas una descripción o que converses primero antes de poder planificar una escena.

Un personaje también puede pedir iniciar una escena. Cuando eso pasa, se abre la misma ventana **Scene Prompt Setup**, con una línea como "[Character] wants to start a scene." Elige **Prompt preset**, **POV** y **Tense** y haz clic en **Plan Scene** de la misma forma, o haz clic en **Cancel** para rechazarla.

## La barra de escena: End Scene, Discard, Convert y Back to conversation

Mientras estás dentro de una escena activa, una barra se sitúa justo encima de la caja de mensaje. Contiene los controles que deciden qué pasa con la escena. Los botones exactos que ves dependen de si la escena tiene una conversación vinculada.

- **Back to conversation** (Volver a la conversación) te devuelve al chat de **Conversation** que inició la escena. Deja la escena abierta y en marcha, para que puedas volver a ella más tarde. Este botón aparece solo cuando la escena tiene una conversación de origen.
- **End Scene** (Terminar escena) finaliza la escena y guarda un resumen. Cuando haces clic, la barra pregunta **End and save summary?** (¿Terminar y guardar el resumen?) con un botón **Yes** y un botón **No**. Haz clic en **Yes** para confirmar. El botón muestra un estado **Saving...** mientras trabaja. Marinara escribe un resumen corto de la escena de vuelta en la conversación de origen como una memoria, y luego te devuelve al punto donde esa conversación se quedó.
- **Discard** (Descartar) desecha la escena sin guardar nada. Cuando haces clic, la barra pregunta **Discard scene?** (¿Descartar la escena?) con botones **Yes** y **No**. Haz clic en **Yes** para eliminar la escena y volver a la conversación. No se escribe nada de vuelta.
- **Convert** (Convertir) transforma la escena en un chat de roleplay independiente propio. Se explica en su propia sección más abajo, porque cambia la escena de forma permanente.

Tómate tu tiempo antes de hacer clic en **End Scene** o **Discard**, porque ambos quitan la escena de tu conversación. **End Scene** conserva una memoria de lo que pasó. **Discard** no conserva nada.

## Clonar una escena a partir de un mensaje

Dentro de un chat de escena, cada mensaje tiene un pequeño botón de acción cuya tooltip (texto de ayuda) dice **Clone from here** (Clonar desde aquí). Esto te permite bifurcar el contenido de la escena hacia un chat de roleplay completamente nuevo, copiado hasta ese mensaje inclusive.

Para usarlo:

1. Pasa el cursor sobre el mensaje desde el que quieres ramificar.
2. Haz clic en la acción **Clone from here**.

Marinara crea un roleplay independiente y nuevo a partir de la escena, copiando los mensajes hasta ese punto. Tu escena original sigue abierta y activa, así que esta es una forma segura de explorar un camino diferente. Deberías ver una confirmación de que la escena se clonó como un roleplay, y el nuevo chat se abre.

Clonar conserva la escena original. Convertir, que se describe a continuación, no.

## Convertir una escena en un roleplay independiente

El botón **Convert** de la barra de escena separa la escena y la vuelve un chat de roleplay permanente por sí mismo. Cuando haces clic en **Convert**, se abre una ventana de confirmación titulada **Convert this scene into a standalone roleplay?** (¿Convertir esta escena en un roleplay independiente?)

La ventana explica lo que pasará. Crea un nuevo chat de roleplay a partir de la escena actual y separa la escena original de su conversación. No se escribe de vuelta en la conversación original ningún resumen de escena ni ninguna memoria del personaje. Haz clic en **Convert** para continuar, o en **Cancel** para dejar las cosas como están.

Usa **Convert** cuando una escena ha crecido hasta convertirse en una historia que quieres conservar y continuar como un roleplay normal. Usa **Clone from here** en cambio cuando quieres una copia pero también quieres que la escena original se quede donde está.

Para mantener claros los dos caminos de bifurcación: **Clone from here** te permite bifurcar ramas de escena mientras la original sigue activa. **Convert** te permite convertir ramas de escena en un roleplay independiente, y quita la original de su conversación.

## Por qué las escenas no heredan el contexto del chat conectado

Un chat de **Conversation** puede estar conectado a un roleplay de modo que el contexto fluya entre ellos. Las escenas funcionan de otra manera a propósito. Una escena es autónoma.

Una escena no arrastra automáticamente el contexto de ida y vuelta de una conversación conectada, incluso cuando el chat padre sí lo hace. Una conversación conectada puede pasar de forma discreta notas cortas de dirección a un roleplay vinculado para orientar su historia, pero una escena ignora esas notas. Esto mantiene una escena centrada en su propio momento en lugar de arrastrar toda la conversación.

Por eso una escena se lee limpiamente como su propia pequeña historia. Si quieres el vínculo bidireccional continuo entre una conversación y un roleplay, usa un chat conectado en lugar de una escena. Consulta la guía de chats conectados enlazada más abajo para esa función.

## Guías relacionadas

- [Modo Roleplay: primeros pasos](getting-started.md)
- [Ramas del chat](../chats/branches.md)
- [Conectar una conversación a un roleplay o juego](../chats/connected-chats.md)
