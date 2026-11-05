# Aprobaciones de agentes y el Agent Suite

Los agentes pueden escribir en tu chat: entradas de lorebook (libro de trasfondo), resúmenes y ediciones de tarjetas de personaje. Esta guía muestra cómo revisar esas escrituras antes de que se guarden y cómo leer y corregir con el **Agent Suite** lo que los agentes han guardado.

## Revisar las escrituras de los agentes antes de que se guarden

De forma predeterminada, algunas escrituras de los agentes se guardan solas. **Review Agent Outputs** (Revisar salidas de los agentes) hace que cada una espere tu aprobación.

1. Abre el chat y haz clic en **Chat Settings** (Ajustes del chat).
2. Desplázate hasta la sección **Agents**.
3. En un chat de Roleplay, abre **Trackers Control** (Control de trackers). En una partida de Game, omite este paso.
4. Activa **Review Agent Outputs**.

Cuando está activado, las actualizaciones de lorebook, las actualizaciones de resumen y otras salidas revisables de agentes escritores te esperan. Cuando está desactivado, las actualizaciones de lorebook y de resumen pueden guardarse automáticamente.

Las ediciones de tarjetas de personaje siempre piden tu aprobación primero, incluso cuando **Review Agent Outputs** está desactivado. No puedes desactivar esa comprobación.

### Revisar una actualización de lorebook o de resumen

Cuando un agente propone una escritura, se abre una ventana titulada **Review Lorebook Update** o **Review Summary Update**. Muestra el nombre del agente y un cuadro **Proposed Text** (Texto propuesto) que puedes editar. Para las escrituras de lorebook, también te recuerda mantener cada entrada bajo un encabezado `###`.

- **Accept** (Aceptar) guarda el texto, incluidas tus ediciones.
- **Regenerate** (Regenerar) vuelve a ejecutar solo ese agente para obtener una propuesta nueva.
- **Discard** (Descartar) descarta la propuesta sin guardarla.

Si hay más propuestas en espera, la ventana muestra cuántas. Vuelve a abrirse para la siguiente cuando terminas con la actual.

Un agente con la capacidad **Create character cards** (Crear tarjetas de personaje) también puede proponer una tarjeta de personaje nueva. Se abre una ventana de revisión con el texto de la tarjeta. No se guarda nada hasta que aceptas.

### Revisar una actualización de tarjeta de personaje

El agente **Card Evolution Auditor** sugiere ediciones a una tarjeta de personaje según lo que pasó en el roleplay. En Conversation, la herramienta integrada `update_about_me` también puede proponer un cambio público en el About Me. Ninguno de los dos edita tu tarjeta por su cuenta. Ambos abren **Review Character Card Updates**.

Para cada edición propuesta, la ventana muestra el campo de la tarjeta que toca, una breve razón cuando el agente la da, un bloque **Before** (Antes) con el texto actual y un cuadro **After** (Después) que puedes editar.

- **Approve** (Aprobar) aplica las ediciones. El número del botón indica cuántas se aplicarán. Sube el número de versión del personaje y guarda una entrada en el historial de versiones.
- **Regenerate** vuelve a ejecutar el agente para obtener propuestas nuevas.
- **Reject** (Rechazar) las descarta sin cambiar la tarjeta.

Si la tarjeta cambió después de que el agente escribiera su propuesta, la edición se marca como obsoleta y se atenúa. Entonces aparece un botón **Override stale** (Forzar obsoleta) con la cuenta. Úsalo solo si aún quieres ese texto. Marinara te pide confirmación y luego añade el texto obsoleto al campo en lugar de reemplazar un texto que ya no coincide.

## Ver y editar lo que guardaron los agentes

El **Agent Suite** muestra todo lo que los agentes de este chat han guardado: datos de tracker (agente de seguimiento), como la escena actual, los personajes presentes y las estadísticas de la persona, además de la salida guardada de los agentes personalizados. Úsalo para corregir un nombre erróneo, arreglar una estadística o limpiar texto desordenado.

1. Abre **Chat Settings** y desplázate hasta **Agents**.
2. Haz clic en **Agent Suite**.
3. Elige un agente de la lista de la izquierda.

El lado derecho muestra bloques editables en hasta tres grupos: **Stored Memory** (Memoria guardada), **Tracker Data** (Datos de tracker; solo en agentes de tracker) y **Recent Outputs** (Salidas recientes; solo en agentes personalizados). Los agentes que no hacen seguimiento de datos muestran solo **Stored Memory**.

Cada bloque es un editor de texto o JSON. Los bloques JSON muestran números de línea y avisan enseguida cuando el JSON no es válido. **Save** (Guardar) permanece desactivado hasta que se pueda interpretar. Para buscar en todos los datos de tracker o editarlos como campos, haz clic en **Open in State Editor** en la cabecera de **Tracker Data**. Consulta [El State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

Después de cambiar un bloque, haz clic en **Save** para conservarlo o en **Reset** (Restablecer) para volver al valor guardado.

### Dejar que la IA reescriba un bloque

1. Haz clic en **AI Edit** (Edición con IA) en el bloque.
2. Para cambiar solo una parte, selecciona primero ese texto. Si no seleccionas nada, se reescribe todo el bloque.
3. Escribe una instrucción, por ejemplo "corrige los nombres de personaje distorsionados, ella se llama Mira".
4. Opcional: haz clic en **Add Context** (Añadir contexto) para adjuntar tarjetas de personaje o entradas de lorebook, de modo que la IA sepa qué significan los datos.
5. Elige la conexión (el servicio de IA y el modelo) que hace la reescritura.
6. Haz clic en **Rewrite** (Reescribir).

El resultado entra en el bloque como un borrador sin guardar. Revísalo y luego usa **Save** o **Reset**.

- Mientras aún haya agentes ejecutándose para este chat, el guardado espera hasta que terminen.
- **Clear memory** (Borrar memoria) aparece en **Stored Memory** solo cuando el agente tiene datos guardados. Borra de una vez todo lo que ese agente guardó para este chat y no se puede deshacer. Marinara te pide confirmación primero.
- Para el **Narrative Director**, los spoilers guardados están ocultos. Usa **Reveal spoilers** (Mostrar spoilers) para verlos y editarlos.

## Ver las inyecciones de prompt en caché

Antes de que se genere una respuesta, algunos agentes escritores añaden texto al prompt (las instrucciones enviadas a la IA). Esto es común en **Prose Guardian**, **Narrative Director** y los agentes de inyección personalizados. El panel **Cached prompt injections** (Inyecciones de prompt en caché) muestra ese texto para la respuesta más reciente. Es una vista de diagnóstico.

Antes de empezar: activa **Debug mode** (Modo de depuración). Consulta [Descripción general de los agentes](agents-overview.md#tell-whether-an-agent-ran). En un chat de Roleplay, abre la pestaña **Injections** de **Agent activity** (Actividad de los agentes). Consulta [Agent activity](../roleplay/getting-started.md#agent-activity).

En cada inyección puedes expandirla para leer y editar el texto, hacer clic en el icono **Save** para conservar tu edición o hacer clic en el icono **Re-run** (Volver a ejecutar) para que ese agente escriba una nueva.

Las inyecciones de **Knowledge Retrieval** y **Knowledge Router** no se pueden volver a ejecutar aquí. Las ediciones y las reejecuciones solo surten efecto si regeneras esa misma respuesta. Una reejecución usa el historial del chat desde ese punto, no los mensajes más nuevos.

## Guías relacionadas

- [Descripción general de los agentes](agents-overview.md)
- [Referencia de agentes descargables](built-in-agents.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
