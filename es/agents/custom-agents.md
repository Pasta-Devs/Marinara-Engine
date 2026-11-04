# Crear agentes personalizados

Un agente personalizado es un ayudante que escribes tú: tus propias instrucciones, cuándo se ejecuta y qué puede cambiar. Construye uno cuando ningún [agente descargable](built-in-agents.md) haga lo que quieres. Si un agente instalado se acerca a lo que buscas, pasa el cursor sobre su tarjeta en el panel **Agents** (Agentes) y haz clic en **Copy agent** (Copiar agente) para obtener una copia editable.

Antes de empezar: lee [Agentes: ayudantes de IA para tus chats](agents-overview.md). Construir un agente no lo ejecuta. Lo añades a un chat después. Los agentes personalizados funcionan en todos los modos de chat.

## Crear un agente personalizado

1. Abre el panel **Agents**.
2. Haz clic en **New** (Nuevo), el icono del signo más, cerca de la parte superior. Se abre el editor de agentes a página completa.
3. Escribe un nombre en el campo de título, por ejemplo `Weather Reporter`.
4. Rellena **Description** (Descripción) y **Author** (Autor).
5. Elige una **Pipeline Phase** (Fase del pipeline). Consulta [Pipeline Phase](#pipeline-phase).
6. Activa los poderes que necesita en **Custom Agent Abilities** (Habilidades del agente personalizado).
7. Elige un **Result Type** (Tipo de resultado) que coincida con lo que produce el agente. Si tienes dudas, elige **Context Injection**. No necesita ninguna habilidad ni un formato de salida estricto.
8. Escribe sus instrucciones en **Prompt Template** (Plantilla de prompt).
9. Haz clic en **Save** (Guardar) en la barra superior. Aparece una insignia verde **Saved**.

El agente aparece ahora en la sección **Custom Agents** (Agentes personalizados) del panel **Agents**. Para usarlo, abre un chat, ve a **Chat Settings** (Ajustes del chat), activa **Enable Agents** (Activar agentes) y añade el agente desde **Custom Agents**.

## Pipeline Phase

**Pipeline Phase** establece cuándo se ejecuta el agente.

- **Pre-Generation**: antes de la respuesta. Puede añadir contexto o cambiar el prompt (las instrucciones enviadas a la IA).
- **Parallel**: al mismo tiempo que la respuesta. No puede ver la respuesta terminada.
- **Post-Processing**: después de la respuesta. Puede leer la respuesta y, para algunos tipos de resultado, editarla.

Algunos tipos de resultado obligan a una fase. **Text Rewrite** cambia a **Post-Processing**. **Prompt Patch** y **Character Activity** cambian a **Pre-Generation**.

Los agentes de Post-Processing también obtienen una sección **Turn Data Access** (Acceso a datos del turno) con dos interruptores, **Pre-generation injections** y **Parallel agent results**. Actívalos para que el agente pueda leer lo que otros agentes produjeron en el mismo turno.

## Custom Agent Abilities

Las habilidades son poderes que se activan de forma opcional. Cada una permanece bloqueada hasta que activas su interruptor.

- **Create lorebooks**: crear un nuevo lorebook (libro de trasfondo) hecho por el agente cuando su salida de trasfondo no tiene destino.
- **Edit lorebooks**: escribir entradas de lorebook o devolver resultados de actualización de lorebook.
- **Edit messages**: reemplazar el texto del mensaje generado o añadirle opciones de continuación.
- **Edit trackers**: actualizar el estado del tracker (agente de seguimiento) del juego, del personaje, de la persona o personalizado.
- **Frontend styling**: aplicar un estilo visual temporal durante la generación.
- **Change chat backgrounds**: cambiar y guardar el fondo de un chat.
- **Change character sprites**: cambiar las expresiones de personajes y personas que se muestran en el chat.
- **Control media playback**: controlar Spotify, YouTube o la música local.
- **Control haptic devices**: enviar comandos limitados a un dispositivo háptico conectado.
- **Edit About Me details**: cambiar el texto About Me específico del chat. Los cambios de tarjetas públicas siguen necesitando tu aprobación.
- **Image generation**: enviar un prompt de imagen al generador de imágenes.
- **Vectors/embeddings**: usar contexto de vectores. Los vectores permiten a Marinara buscar texto por su significado.
- **Main prompt edits**: editar el prompt enviado al modelo principal.
- **Create character cards**: proponer una nueva tarjeta de personaje. Solo se guarda después de que la revises y la aceptes.
- **Choose active chat characters**: elegir qué personajes adjuntos están activados para la respuesta actual de Conversation o Roleplay.

Si activas **Edit lorebooks**, aparece una sección **Lorebook Writer**. Activa **Allow lorebook entry writes** y elige un lorebook en **Target lorebook**. El agente solo puede escribir en ese lorebook.

## Result Type

**Result Type** le dice a Marinara cómo leer la respuesta del agente. La mayoría de los tipos esperan JSON, un formato de texto escrito con llaves y comillas. Un tipo permanece atenuado hasta que activas la habilidad que necesita.

Tipos que no necesitan ninguna habilidad:

- **Context Injection**: añade texto antes de la generación o registra una nota después de ella. El punto de partida más fácil.

Tipos que necesitan **Edit messages**:

- **Text Rewrite**: reemplaza el texto del mensaje después de la respuesta.
- **Interactive Choices**: añade opciones de continuación al mensaje.

Tipos que necesitan **Edit trackers**:

- **Character Tracker**: actualiza los personajes presentes.
- **Persona Stats**: actualiza las estadísticas, el estado y el inventario de la persona.
- **Custom Tracker**: reemplaza los campos de tu tracker personalizado.
- **Game State**: actualiza datos de juego al estilo del estado del mundo.

Otros tipos, cada uno con su propia habilidad:

- **Lorebook Update** (Edit lorebooks): crea o actualiza entradas de lorebook.
- **Image Prompt** (Image generation): pide al generador de imágenes que dibuje una escena.
- **Prompt Patch** (Main prompt edits): añade, antepone o reemplaza secciones del prompt.
- **Frontend Style** (Frontend styling): aplica un efecto de estilo temporal.
- **Background Change** (Change chat backgrounds): elige y guarda un fondo disponible.
- **Sprite Change** (Change character sprites): cambia las expresiones que se muestran en el chat.
- **Spotify Control**, **YouTube Control**, **Local Music Control** (Control media playback): controlan la reproducción.
- **Haptic Command** (Control haptic devices): envía un comando limitado a un dispositivo háptico.
- **About Me Update** (Edit About Me details): actualiza el texto About Me específico del chat y propone ediciones públicas.
- **Character Card Creation** (Create character cards): propone una tarjeta de personaje editable para tu aprobación.
- **Character Activity** (Choose active chat characters): selecciona las tarjetas de personaje que se usan para la respuesta actual. Se ejecuta antes de la respuesta y debe seleccionar al menos un personaje adjunto.

### Controles para agentes de imagen en un chat

Un agente con la habilidad **Image generation** recibe dos controles adicionales en **Chat Settings → Agents → Custom Agents**.

- **Image model** (Modelo de imagen): sustituye la conexión de imagen de este agente solo en este chat. Déjalo en **Agent default** (Predeterminado del agente) para conservar el ajuste propio del agente. El **Image Style** (Estilo de imagen) del chat también se aplica a las imágenes de los agentes personalizados.
- **Camera button**: crea una imagen ahora, sin esperar a las palabras clave de activación. Si la plantilla del agente se niega a escribir un prompt, recibes una notificación de error en lugar de una imagen.

## Activation Keywords

De forma predeterminada, un agente se ejecuta con su cadencia normal (la frecuencia con la que se ejecuta). Las **Activation Keywords** (Palabras clave de activación) omiten el agente a menos que la escena sea relevante, lo que ahorra tokens (fragmentos de texto).

1. En **Activation Keywords**, escribe una palabra clave o frase por línea, como `tavern` o `secret door`.
2. Establece **Scan Depth** en el número de mensajes recientes que se buscan. El valor predeterminado es 5 y el máximo es 200.

Entonces el agente solo se ejecuta cuando una palabra clave aparece en esos mensajes. Deja el cuadro vacío para desactivar el filtro. La cadencia y cualquier pregunta de activación siguen aplicándose.

## Adjuntar herramientas

Un agente puede llamar a herramientas: funciones que la IA ejecuta para obtener o cambiar algo, y cuyo resultado luego lee. Esto también se llama function calling.

1. En el editor de agentes, abre **Tools / Function Calling** y activa cada herramienta que quieras. La lista incluye herramientas integradas y las tuyas. Para construir una, consulta [Herramientas personalizadas](../extending/custom-tools.md).
2. En **Chat Settings**, abre **Function Calling** y activa **Enable Tool Use**. Sin él, las herramientas del agente permanecen desactivadas.

Los agentes importados nunca obtienen acceso a herramientas. Revisa un agente importado y luego selecciona tú sus herramientas.

Un agente recibe como máximo 16 rondas de llamadas a herramientas por ejecución (menos si el `MAX_TOOL_ROUNDS` del servidor es menor) y luego responde con lo que tenga. Un modelo que llama a las herramientas de una en una gasta una ronda en cada llamada, así que un agente que guarda muchas entradas debería hacer varias llamadas en una sola respuesta. Una ejecución de puesta al día de lorebook recibe hasta 64 rondas.

## Named prompt options

Un agente puede contener varias variantes de prompt, así que cada chat puede elegir una sin editar el agente.

1. En **Prompt Template**, busca **Named prompt options** (Opciones de prompt con nombre).
2. Haz clic en **Add option** (Añadir opción).
3. Dale un nombre y una descripción corta, y luego escribe su prompt completo.

Cuando alguien añade el agente a un chat, un menú desplegable **Prompt Mode** lista tus opciones. Si no hay ninguna, solo se muestra el prompt predeterminado.

## Otros ajustes

- **Model override** (Modelo alternativo): usa un modelo distinto para este agente, por ejemplo uno más barato. Déjalo vacío para usar el modelo del chat. El agente envía los parámetros de generación guardados en esa conexión. Consulta [Parámetros para agentes](../prompts/generation-parameters.md#parameters-for-agents).
- **Agent Budget**: **Context Size** es cuántos mensajes recientes lee el agente (5 de forma predeterminada). **Max Output Tokens** es el espacio de salida reservado (4096 de forma predeterminada, de 128 a 32768).
- **Add as Prompt Section**: expone la salida más reciente del agente como una sección que puedes colocar en un preset (ajuste guardado) de prompt.

Las macros como `{{user}}` y `{{char}}` funcionan en **Prompt Template**. Consulta [Macros](../prompts/macros.md).

## Ejemplo trabajado

Este agente reescribe cada respuesta en inglés británico.

1. Ponle el nombre `British English Editor`.
2. En **Custom Agent Abilities**, activa **Edit messages**.
3. En **Result Type**, elige **Text Rewrite**. La fase cambia a **Post-Processing**.
4. Pega esto en **Prompt Template**:

   ```text
   You are a copy editor. Rewrite the latest reply into British English.
   Change spelling and vocabulary only. Do not change the meaning, tone, or events.
   Return JSON with an "editedText" field holding the full rewritten reply,
   and a "changes" array of short notes describing what you changed.
   ```

5. Haz clic en **Save**.
6. Abre un chat de Roleplay, activa **Enable Agents** en **Chat Settings** y añade el agente desde **Custom Agents**.

Después de cada respuesta, el agente devuelve JSON como este:

```json
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara sustituye la respuesta por `editedText`. Las notas de `changes` aparecen como un breve resumen.

## Importar y exportar agentes

Para exportar un agente, haz clic en **Export agent** (Exportar agente, el icono de subir) en la barra superior del editor. El archivo contiene el prompt y los ajustes del agente, nunca definiciones de herramientas personalizadas. Para exportar varios, usa **Select agents** (Seleccionar agentes) en el panel **Agents**, elígelos y expórtalos.

Las importaciones externas están bloqueadas de forma predeterminada.

1. Abre **Settings → Advanced → Danger Zone** (Configuración → Avanzado → Zona de peligro) y activa **Allow custom Agent imports** (Permitir importaciones de agentes personalizados). No hace falta ningún cambio en `.env`.
2. En el panel **Agents**, haz clic en **Import agents** (Importar agentes) y elige archivos de agente o una carpeta.
3. Revisa la lista de permisos que muestra Marinara. Aprueba solo lo que necesita el agente. Las capacidades sin marcar permanecen bloqueadas.

Este bloqueo solo afecta a los agentes de archivos, carpetas o repositorios personalizados. Los agentes que creas y los agentes oficiales de **Agent Organizer** (Organizador de agentes) funcionan con normalidad. Cada archivo importado recibe una nueva identidad personalizada, así que no puede reemplazar a un agente oficial.

Por seguridad, Marinara ignora las funciones incluidas, borra las selecciones de herramientas, sanea el CSS temporal y comprueba las capacidades aprobadas antes de que un agente importado pueda cambiar mensajes, trackers, lorebooks, fondos, sprites, contenido multimedia, dispositivos hápticos, datos About Me, prompts o imágenes. Importa por separado las funciones de confianza, revísalas y adjúntalas tú al agente. Desactivar el interruptor de **Danger Zone** impide que se ejecuten los agentes importados.

<a id="activation-questions"></a>

## Preguntas de activación

Una pregunta de activación pregunta si la escena reciente necesita tu agente. Detecta paráfrasis que las palabras clave pasan por alto. Necesita un **Decision model** (modelo de decisión), un modelo pequeño que responde preguntas de sí o no. Elige uno en el panel Connections. Consulta [Modelos de decisión](../connections/decision-models.md). Con **Decision model** en **None** (Ninguno), el valor predeterminado, los campos de la pregunta permanecen desactivados y un agente con pregunta se ejecuta como si no tuviera ninguna.

1. Abre el agente personalizado.
2. Escribe una **Question** (Pregunta) de hasta 500 caracteres. Las macros `{{user}}` y `{{char}}` funcionan en ella.
3. Establece **Run when probability is at least** (Ejecutar cuando la probabilidad sea al menos) en el umbral de este agente. El agente se ejecuta cuando la probabilidad de "sí" lo alcanza, así que los valores más altos omiten más ejecuciones. El editor muestra un valor recomendado para tu modelo: 0,5 para modelos de chat locales y cuentas Decision, o 0,1 para los modelos Open-Jev integrados. Compruébalo con tus propios chats después de cambiar de modelo. Consulta [Umbrales](../connections/decision-models.md#thresholds).
4. Opcional: establece **Bypass the question after this many messages without a successful run** (Omitir la pregunta después de esta cantidad de mensajes sin una ejecución correcta). Después de esa cantidad de mensajes se omite la pregunta, así que un modelo que sigue respondiendo "no" no puede silenciar al agente para siempre. Las palabras clave y la cadencia siguen aplicándose.

Escribe la pregunta como una declaración sobre el último mensaje, como `The latest message moves the scene to a new place.` Un modelo pequeño respondió a esto con más fiabilidad que a `Did the scene change?` Consulta [Redactar declaraciones](../prompts/conditional-prompts.md#writing-statements).

Cómo se ejecuta:

- Las palabras clave y la cadencia se comprueban primero, así que un agente omitido no gasta ninguna solicitud de decisión. Las preguntas con la misma profundidad de análisis se agrupan por fase.
- **Scan Depth** establece los mensajes que usan tanto las palabras clave como la pregunta.
- Los agentes de pregeneración y paralelos usan el chat anterior a la respuesta. Los de posprocesamiento también ven la respuesta terminada.
- Un tiempo de espera agotado, un modelo no disponible o una respuesta inválida permiten que el agente se ejecute normalmente. El límite de tiempo depende del tipo de modelo y de si el modelo tiene que razonar primero. Consulta [Límites de tiempo](../connections/decision-models.md#time-limits).
- Los agentes importados con una pregunta de activación o declaraciones de decisión muestran un aviso que enlaza a la guía de modelos de decisión. Sin un Decision model, el agente se ejecuta siempre que lo permitan las palabras clave y **Trigger Cadence**, y las declaraciones del prompt se interpretan como no.

Las preguntas de activación solo se aplican a agentes personalizados.

<a id="decision-statements-in-the-agents-prompt"></a>

## Declaraciones de decisión en el prompt del agente

Una pregunta de activación decide si el agente se ejecuta. Una declaración de decisión en **Prompt Template** decide qué se le dice a un agente en ejecución. La sintaxis está en [Prompts condicionales](../prompts/conditional-prompts.md#asking-the-decision-model):

```text
{{#if decision:"In the latest message, the characters move to a different location"}}
Update the location field.
{{else}}
Leave the location as it is.
{{/if}}
```

Úsalas para enviar un prompt más pequeño en los turnos tranquilos. Un tracker puede actualizar la ubicación solo cuando cambió. Un agente de imágenes puede describir una imagen nueva solo cuando cambió la escena. Un agente de música puede cambiar de pista solo cuando cambió el ambiente. Para elegir uno entre varios conjuntos de instrucciones, usa `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}`, luego `{{else if decision_choice:"The kind of scene in the latest message" == "dialogue"}}`, y así sucesivamente. Consulta [Prompts condicionales](../prompts/conditional-prompts.md#asking-the-decision-model).

- Los agentes de pregeneración y paralelos leen el chat anterior a la respuesta y comparten las respuestas con el prompt principal. Los de posprocesamiento leen la respuesta terminada, y sus declaraciones se vuelven a consultar con ella.
- Volver a ejecutar un agente reutiliza las respuestas correctas que siguen en caché para el mismo turno, modelo y declaraciones. Consulta [Reutilización de respuestas](../prompts/conditional-prompts.md#answer-reuse).
- En el prompt de un agente, `{{char}}` nombra a todos los personajes del chat, así que en un grupo `{{char}} is angry` se convierte en "Kaelen, Alyssa is angry". Nombra al personaje o escribe "a character".
- Sin respuesta, una declaración se interpreta como no. Haz que la rama `{{else}}` sea sensata, porque muchos usuarios no tienen un Decision model.

Los agentes instalados desde Marinara-Agents procesan los prompts de la misma manera.

## Guías relacionadas

- [Agentes: ayudantes de IA para tus chats](agents-overview.md)
- [Modelos de decisión](../connections/decision-models.md)
- [Referencia de agentes descargables](built-in-agents.md)
- [Herramientas personalizadas](../extending/custom-tools.md)
- [Macros](../prompts/macros.md)
