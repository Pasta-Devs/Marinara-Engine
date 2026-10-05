# Aprobaciones de agentes y el Agent Suite

Esta guía explica cómo revisas y controlas lo que los agentes (pequeños ayudantes de IA que se ejecutan junto a tus respuestas) escriben durante un chat. Cubre el interruptor **Review Agent Outputs** (Revisar salidas de los agentes), las dos ventanas de revisión, el editor **Agent Suite** y el panel **Cached prompt injections** (Inyecciones de prompt en caché).

## Review Agent Outputs

Algunos agentes quieren escribir datos nuevos en tu chat. Un agente de lorebook (libro de trasfondo) puede añadir entradas de lorebook. Un agente de resumen puede guardar un Chat Summary. De forma predeterminada, algunas de estas escrituras se guardan por ti automáticamente. El interruptor **Review Agent Outputs** te permite revisar cada escritura primero.

Para encontrar el interruptor:

1. Abre el chat que quieres controlar.
2. Abre **Chat Settings** (Ajustes del chat).
3. Desplázate hasta la sección **Agents**.
4. Activa **Review Agent Outputs**.

Cuando **Review Agent Outputs** está activado, las actualizaciones de lorebook, las actualizaciones de resumen y otras salidas revisables de agentes escritores esperan tu aprobación antes de guardarse. Cuando está desactivado, las actualizaciones de lorebook y de resumen pueden guardarse automáticamente.

Las ediciones de tarjeta de personaje son un caso especial. Siempre piden tu aprobación primero, incluso cuando **Review Agent Outputs** está desactivado. No puedes desactivar esa comprobación de seguridad.

## La ventana Agent Write Approval

Cuando **Review Agent Outputs** está activado y un agente propone una escritura de lorebook o de resumen, se abre una ventana de revisión. Su título es **Review Lorebook Update** o **Review Summary Update**, según el tipo de escritura.

La ventana muestra:

- El nombre del agente que hizo la propuesta.
- Un cuadro **Proposed Text** (Texto propuesto) que puedes editar antes de guardar.
- Para las escrituras de lorebook, un breve recordatorio de mantener cada entrada bajo un encabezado `###`.

Tienes tres opciones en la parte inferior de la ventana:

- **Accept** (Aceptar): guarda el texto (después de cualquier edición que hayas hecho) en tu chat.
- **Regenerate** (Regenerar): vuelve a ejecutar solo ese agente para obtener una propuesta nueva.
- **Discard** (Descartar): descarta la propuesta sin guardarla.

Si hay más de una propuesta en espera, la ventana muestra cuántas siguen en la cola. Vuelve a abrirse para la siguiente después de que gestiones la actual.

## Revisión de Character Card Update

El agente **Card Evolution Auditor** puede sugerir ediciones a los campos de la tarjeta de personaje según lo que pasó durante el roleplay. La herramienta integrada `update_about_me` del Conversation Mode también puede proponer un cambio público en el About Me. Ninguna vía edita tu tarjeta por su cuenta; ambas abren la ventana **Review Character Card Updates** para que tú decidas.

La ventana lista cada edición propuesta. Para cada edición ves:

- El campo de la tarjeta que toca (por ejemplo, description, personality o appearance).
- Una breve razón del cambio, cuando el agente da una.
- Un bloque **Before** (Antes) que muestra el texto actual.
- Un cuadro **After** (Después) que muestra el texto nuevo. Puedes editar este texto antes de aprobarlo.

Tienes estas acciones:

- **Approve** (Aprobar): aplica las ediciones. El número en el botón muestra cuántas ediciones se aplicarán. Aprobar sube el número de versión del personaje y guarda una entrada en el historial de versiones.
- **Regenerate** (Regenerar): vuelve a ejecutar el agente para obtener un conjunto nuevo de propuestas.
- **Reject** (Rechazar): descarta las propuestas sin cambiar la tarjeta.

A veces una tarjeta cambió desde que el agente escribió su propuesta. Cuando esto pasa, la app marca la edición como **stale** (obsoleta) y la atenúa. Si alguna edición está obsoleta, aparece un botón **Override stale** (Forzar obsoleta) con la cuenta. Úsalo solo si aún quieres conservar ese texto. La app te pide confirmación primero. Luego añade el texto obsoleto al campo en lugar de reemplazar un texto que ya no coincide.

## El editor Agent Suite y la reescritura asistida por IA

El **Agent Suite** te permite ver y editar todo lo que los agentes de este chat han guardado. Esto incluye los datos de tracker (agente de seguimiento) (como la escena actual, los personajes presentes y las estadísticas de la persona) y la salida guardada de tus agentes personalizados. Puedes corregir un nombre erróneo, arreglar una estadística o limpiar texto guardado desordenado a mano o con ayuda de IA.

Para abrirlo:

1. Abre **Chat Settings**.
2. Desplázate hasta la sección **Agents**.
3. Haz clic en **Agent Suite**.

A la izquierda hay una lista de los agentes activos en este chat. Elige uno para ver qué ha guardado. El lado derecho muestra bloques editables. Están agrupados en **Stored Memory** (Memoria guardada), **Tracker Data** (Datos de tracker) (solo para agentes de tracker) y **Recent Outputs** (Salidas recientes) (solo para agentes personalizados). Los agentes que no hacen seguimiento de datos muestran solo **Stored Memory**.

Cada bloque es un editor de texto o JSON. Después de cambiar un bloque:

- Haz clic en **Save** (Guardar) para conservar tu edición.
- Haz clic en **Reset** (Restablecer) para deshacer tu cambio sin guardar y volver al valor guardado.

También puedes dejar que la IA reescriba un bloque por ti:

1. Haz clic en **AI Edit** (Edición con IA) en el bloque que quieres cambiar.
2. Para actuar solo sobre una parte del texto, selecciona esa parte en el editor primero. Si no seleccionas nada, se reescribe todo el bloque.
3. Escribe una instrucción, por ejemplo "corrige los nombres de personaje distorsionados, ella se llama Mira".
4. Opcional: haz clic en **Add Context** (Añadir contexto) para adjuntar tarjetas de personaje o entradas de lorebook. Esto ayuda a la IA a entender qué significan los datos.
5. Elige la conexión (el proveedor de IA y el modelo) que hará la reescritura.
6. Haz clic en **Rewrite** (Reescribir).

El texto reescrito entra en el bloque como un borrador sin guardar. Revísalo y luego haz clic en **Save** para conservarlo o en **Reset** para descartarlo.

Algunas notas:

- Si aún hay agentes ejecutándose para este chat, el guardado se pausa hasta que terminen.
- La sección **Stored Memory** tiene un botón **Clear memory** (Borrar memoria). Aparece solo cuando el agente tiene datos guardados. Borra de una vez todo lo que ese agente guardó para este chat, y no se puede deshacer. La app te pide confirmación primero.
- Para el **Narrative Director**, los spoilers guardados están ocultos. Usa **Reveal spoilers** (Mostrar spoilers) para verlos y editarlos.

## Panel Cached prompt injections

Antes de que se genere tu respuesta, algunos agentes escritores añaden texto al prompt (instrucciones enviadas a la IA). Esto es común en **Prose Guardian**, **Narrative Director** y agentes de inyección personalizados. El panel **Cached prompt injections** es una vista de diagnóstico de ese texto añadido. Lo encuentras en la pestaña **Injections** de [Agent activity](../roleplay/getting-started.md#agent-activity) en Roleplay, cuando **Debug mode** está activado. Cubre la respuesta más reciente.

Para cada inyección en caché puedes:

- Expandirla para leer y editar el texto.
- Hacer clic en el icono **Save** para conservar tu edición.
- Hacer clic en el icono **Re-run** (Volver a ejecutar) para que ese agente escriba una inyección nueva.

Las inyecciones de **Knowledge Retrieval** y **Knowledge Router** no se pueden volver a ejecutar desde este panel. Tus ediciones y reejecuciones solo surten efecto si regeneras esa misma respuesta. Una reejecución usa el historial de chat original desde ese punto, no los mensajes más nuevos.

## Guías relacionadas

- [Resumen de agentes](agents-overview.md)
- [Referencia de agentes descargables](built-in-agents.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
