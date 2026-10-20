# Peek Prompt: mira lo que recibió la IA

Peek Prompt te muestra el texto exacto que Marinara Engine envió al modelo de IA para generar una respuesta. También puede mostrar una vista previa en vivo del prompt (las instrucciones enviadas a la IA) antes de enviar nada. Esta guía explica qué muestra el visor, cómo abrirlo, cómo leer la guía almacenada (**Stored guidance**) y cómo usarlo para depurar respuestas.

Un prompt es el bloque completo de instrucciones e historial del chat que Marinara arma y envía al modelo. El modelo lee ese prompt y escribe una respuesta. Peek Prompt te deja ver ese bloque una vez armado, para que nada de tu respuesta sea un misterio.

## Qué muestra Peek Prompt

Cuando abres Peek Prompt, aparece una ventana titulada **Assembled Prompt** (Prompt armado). Tiene tres partes.

Una insignia de origen aparece arriba, junto al título. Te dice qué versión del prompt estás viendo:

- **Exact Text Model Request**: la petición literal que se envió al modelo.
- **Live Preview**: una vista previa recién armada en este momento.
- **Raw Messages**: la lista sin procesar de mensajes.
- **Prompt Preview**: una vista previa general.
- **Decision test preview**: un prompt ensamblado con las respuestas de una prueba explícita de decisiones. No se ha enviado al modelo de chat.

Debajo de la insignia hay un panel de información de generación. Puede mostrar el proveedor y el nombre del modelo, un conteo estimado de tokens (un token es un fragmento de texto que los modelos cuentan en vez de palabras) y el conteo real de tokens del prompt una vez que termina una respuesta. Este panel también muestra pequeñas etiquetas con los valores usados, como **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier** y **Assistant Prefill**. Aquí también pueden aparecer valores de muestreo como **Top P**, **Top K** y **Min P**. Si la conexión a la que iba destinada la respuesta falló y tu conexión de respaldo la escribió en su lugar, el panel también nombra la conexión que falló, su modelo y un motivo breve, como "key rejected" o "rate limited".

El resto de la ventana es el prompt en sí, dividido en secciones plegables. Cada sección tiene una etiqueta y su propia estimación aproximada de tokens. Los mensajes del chat se agrupan bajo una sección **Chat History** (Historial del chat). Para una petición exacta guardada, el proveedor puede haber combinado varios turnos del chat en un solo bloque del proveedor. Expande cada bloque para inspeccionar todo el texto visible para el modelo que hay dentro. Haz clic en cualquier encabezado de sección para abrirla o cerrarla.

Para llevar el prompt completo a otro sitio, haz clic en el botón de copiar que está junto al botón de cerrar, en la parte superior de la ventana. Copia todas las secciones y todos los mensajes del chat como texto sin formato, en el orden en que se enviaron, incluidas las secciones que no has abierto. Cada mensaje empieza con una línea que nombra su rol, como `[system]`, `[user]` o `[assistant]`. Para una petición exacta guardada, copia esa petición guardada tal como se envió. Copiar no envía nada al modelo ni cambia el prompt.

## Cómo abrir Peek Prompt

Hay dos formas de abrir el visor.

La primera forma es la barra de acciones del mensaje. Sigue estos pasos:

1. Pasa el cursor sobre el mensaje de IA más reciente de tu chat.
2. Busca la acción **Peek prompt**. Su icono es una lupa.
3. Haz clic en ella. Se abre la ventana **Assembled Prompt**.

La acción **Peek prompt** solo aparece en el último mensaje de IA del chat. Los mensajes más antiguos no la muestran.

La segunda forma es un atajo escrito. Funciona incluso antes de tener cualquier respuesta de IA, así que puedes ver el prompt primero. Sigue estos pasos:

1. Haz clic en el cuadro de entrada de mensajes.
2. Escribe este texto exacto:

```
{{prompt}}
```

3. Pulsa Enter o haz clic en Send.

En vez de enviar un mensaje, Marinara borra el cuadro y abre el visor de Peek Prompt. Los atajos `{{prompt_preview}}` y `{{preview_prompt}}` hacen lo mismo.

## Cómo leer la guía almacenada (Stored guidance)

La generación guiada te deja dirigir una respuesta con una instrucción fuera de personaje. Cuando un mensaje se creó con una dirección almacenada, lleva una acción aparte llamada **Stored guidance** (Guía almacenada). Su icono es un pequeño pergamino. La acción también aparece en los mensajes creados con el comando `/impersonate`.

Haz clic en **Stored guidance** para abrir una ventana que muestra la dirección usada para ese mensaje. Para un mensaje guiado, la ventana etiqueta la dirección según de dónde vino:

- **/guided**: usaste el comando slash `/guided`.
- **Guided regenerate**: regeneraste el mensaje con una dirección escrita.
- **Game start**: la dirección vino de la configuración de Game Mode.

Un botón **Copy /guided** aparece solo para las direcciones **/guided** y **Guided regenerate**. Copia la dirección de vuelta como un comando `/guided`. Puedes pegar ese comando más tarde para reutilizar la misma dirección. El botón no aparece para las direcciones **Game start**.

Para un mensaje suplantado, la ventana muestra los detalles de la suplantación en vez de una sola dirección. Para el flujo completo de generación guiada y suplantación, consulta la guía enlazada abajo.

## Usar Peek Prompt para depurar respuestas

Peek Prompt es la mejor herramienta para entender una respuesta que no esperabas. Úsalo cuando un personaje olvida algo, ignora una regla o actúa fuera de personaje.

Abre la ventana **Assembled Prompt** y revisa estas cosas:

- Busca información que falte. Si una entrada de lorebook, una memoria o un detalle de la persona no está en ninguna sección, el modelo nunca lo vio.
- Revisa las etiquetas de parámetros. Un valor muy alto de **Temperature** puede volver las respuestas aleatorias, y un valor bajo de **Max Output Tokens** puede cortar las respuestas.
- Expande la sección **Chat History**. Confirma que los mensajes que esperas están presentes y en el orden correcto.
- Lee el conteo real de tokens después de una respuesta. Un prompt muy grande puede empujar los mensajes más antiguos fuera del límite del modelo.

Una vez que sabes lo que el modelo recibió de verdad, puedes corregir la causa. Podrías editar una tarjeta de personaje, ajustar una entrada de lorebook o cambiar un valor en tus parámetros de generación.

<a id="testing-decision-statements"></a>

## Probar declaraciones de decisión

Abre **Decision diagnostics** (diagnóstico de decisiones) dentro de Peek Prompt para inspeccionar las declaraciones del prompt y las decisiones de lorebooks del chat actual. Abrir el panel o elegir **Preview inputs** (vista previa de entradas) prepara los cuerpos de las solicitudes sin preguntar al modelo de decisión ni iniciar un modelo local. Expande **Prepared request bodies** (cuerpos de solicitudes preparados) para ver los mensajes recientes, las declaraciones resueltas, las opciones y el formato de solicitud específico del modelo. Algunas declaraciones de lorebooks solo pueden resultar accesibles después de responder una decisión anterior.

Elige **Test decisions** (probar decisiones) para enviar las preguntas permitidas al modelo de decisión seleccionado. Esto hace solicitudes reales de decisión, por las que un modelo alojado puede cobrar. No genera una respuesta de chat, ejecuta agentes, cambia el estado del juego ni guarda las respuestas o los temporizadores de la prueba en el chat.

Una prueba explícita puede esperar a un modelo local de razonamiento aunque las decisiones normales anteriores a la respuesta se aplacen. Esto no cambia tu preferencia para las respuestas en curso; la vista previa de entradas sigue sin enviar solicitudes al modelo.

Cada resultado muestra su puntuación cuando está disponible, el umbral usado para una declaración de sí/no y la respuesta resultante. Un modelo que solo devuelve una palabra de sí/no se indica como tal; su respuesta no se presenta como una probabilidad. Los resultados Choice muestran la opción elegida. Las decisiones mantenidas, aplazadas, por encima del límite, no disponibles y fallidas tienen explicaciones distintas para no confundir una respuesta ausente con una puntuación baja.

Después de una prueba, el prompt de abajo usa sus respuestas. Usa **Show original prompt** (mostrar prompt original) para volver al contenido que abriste originalmente o **Show tested prompt** (mostrar prompt probado) para regresar a la prueba. **Requests sent and results** (solicitudes enviadas y resultados) muestra los cuerpos reales de las solicitudes de decisión y sus resultados, sin encabezados de autenticación.

Las pruebas usan el chat y los ajustes actuales, incluso si abriste Peek Prompt desde una respuesta anterior. No reconstruyen las solicitudes de decisión originales. Cubren las declaraciones del prompt y las decisiones de lorebooks; no ejecutan la activación de agentes ni decisiones posteriores a la respuesta. Peek Prompt normal permanece pasivo hasta que eliges explícitamente **Test decisions**.

Cuando **Use Decision model** (usar modelo de decisión) está activado para Advanced Memory, el panel también muestra **Advanced Memory activity** (actividad de Advanced Memory). Estos informes guardados identifican la última recuperación y comprobación de fin de escena, con modelo, tiempo, puntuaciones, selecciones y estado del mecanismo de respaldo. Pueden aparecer aunque el prompt no tenga declaraciones de decisión. Describen llamadas reales anteriores, no la vista previa actual ni una repetición de la respuesta histórica seleccionada. Los swipes compatibles pueden reutilizar un informe de recuperación anterior. Se guardan hasta 128 resultados por informe, primero los seleccionados, y se cuenta cuántos se omiten. Los nuevos informes aparecen tras la siguiente llamada permitida al modelo de decisión; verlos no hace solicitudes al modelo.

## Guías relacionadas

- [Parámetros de generación](../prompts/generation-parameters.md)
- [Editor de presets y Prompt Manager](../prompts/presets.md)
- [Modelos de decisión](../connections/decision-models.md)
- [Generación guiada y suplantación](guided-and-impersonate.md)
- [Acciones de mensaje: editar, eliminar, swipe, regenerar](messages.md)
