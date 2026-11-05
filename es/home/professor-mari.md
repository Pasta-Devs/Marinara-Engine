# Professor Mari, tu asistente dentro de la app

Professor Mari es el asistente integrado de la pantalla de inicio. Explica la app, te ayuda a configurarla y crea o edita por ti personajes, personas, lorebooks (libros de trasfondo) y presets (ajustes guardados). Puedes deshacer sus cambios desde la tarjeta de cambios durante un tiempo limitado (consulta [Revisar sus cambios](#reviewing-her-changes)).

<a id="where-to-find-her"></a>

## Dónde encontrarla

1. Ve a la pantalla de inicio. Aparece cuando no hay ningún chat abierto.
2. Haz clic en **Ask Professor Mari** (Pregúntale a Professor Mari) en el widget **Professor Mari**, o haz clic en la pestaña **Professor**.

Se abre su ventana. También puedes llegar a ella desde cualquier pantalla: escribe en Search (Búsqueda) y elige **Ask Prof. Mari** (Pregúntale a Professor Mari), pulsa <kbd>Ctrl</kbd>+<kbd>J</kbd> (<kbd>⌘</kbd>+<kbd>J</kbd> en un Mac), o desliza hacia abajo desde la barra superior en un teléfono. Su cabecera muestra **Ready to help** (Lista para ayudar) cuando está inactiva y **Working on it...** (Trabajando en ello...) mientras trabaja.

Escribe tu mensaje en lenguaje sencillo y pulsa <kbd>Enter</kbd>. <kbd>Shift</kbd>+<kbd>Enter</kbd> añade una línea nueva. Si desactivas **Enter sends to Professor Mari** (Enter envía a Professor Mari) en sus ajustes, <kbd>Enter</kbd> añade una línea nueva y <kbd>Ctrl</kbd>+<kbd>Enter</kbd> envía. Tu primer mensaje desbloquea el logro **Hello World**.

Todos sus ajustes están en **Settings → General → Search and Professor Mari settings → Open** (Configuración → General → Ajustes de Search y Professor Mari → Abrir), o en el engranaje de Search. En una computadora, los controles deslizantes **Height** (Alto) y **Width** (Ancho) de **Professor Mari window** (Ventana de Professor Mari) cambian el tamaño de su ventana. En un teléfono, su ventana ocupa toda la pantalla.

## Crear un personaje con Mari

Antes de empezar: añade una cuenta para generación de texto. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md) y [Elegir una cuenta para ella](#pick-an-account-for-her).

1. Abre su ventana (consulta arriba).
2. Si el chat ya tiene mensajes, haz clic primero en **New chat** (Chat nuevo). El chat actual se guarda en **Chats**.
3. Haz clic en el chip **Create a character** (Crear un personaje). Rellena el cuadro de mensaje. Si no aparece ningún chip, escribe tu solicitud.
4. Añade tu idea al texto, por ejemplo el nombre y la personalidad, y luego pulsa <kbd>Enter</kbd>.
5. Responde a sus preguntas. Elige una opción o escribe la tuya, y luego haz clic en **Submit** (Enviar).
6. Cuando termine, haz clic en **Open** (Abrir) en el resultado para ver el personaje nuevo.
7. Si no te gusta un cambio, haz clic en **Undo** (Deshacer) en su tarjeta de cambios.

Si no funcionó: si no hay ninguna cuenta añadida, la lista **Connections** (Conexiones) se abre cuando pulsas enviar. Elige o añade una cuenta ahí.

## Qué puede hacer

Lee un elemento antes de editarlo, y pregunta cuando tu solicitud es vaga.

- Explicar un ajuste, un modo o un concepto.
- Crear o editar un personaje, una persona o un lorebook. Una tarjeta de personaje le da a la IA un nombre, una personalidad y una voz. Una persona es la tarjeta de personaje que te representa. Un lorebook es un conjunto de datos del mundo que la IA lee cuando aparecen sus palabras clave.
- Escribir el [onboarding interactivo](../characters/interactive-onboarding.md) de un personaje y rellenar una [ficha de conjunto de reglas](../characters/colors-and-stats.md#ruleset-sheets) para un conjunto de reglas de Game Mode instalado. Su cambio se rechaza, con un motivo, cuando un valor no encaja con el conjunto de reglas.
- Crear o editar un tema, un agente, un preset de prompt o un borrador de Personal Extension (Extensión personal). Un borrador permanece desactivado hasta que lees su código y lo apruebas en **Settings → Addons** (Configuración → Complementos).
- Editar una sección de un preset directamente, en lugar de reemplazar el preset entero.
- Comparar los agentes descargables y decirte cuáles encajan con tu objetivo. Te envía a **Agents → Agent Organizer** (Agentes → Organizador de agentes) para instalarlos. Consulta [Referencia de agentes descargables](../agents/built-in-agents.md).
- Crear o asignar imágenes, como avatares, sprites y fondos. Primero necesitas una cuenta de generación de imágenes. Ella no crea una.
- Consultar páginas públicas de wikis de Fandom cuando investigas un personaje o un mundo.

### Empezar con un chip

En un chat vacío de Professor Mari, los chips iniciales te ayudan a empezar: **Create a character**, **Create a lorebook** (Crear un lorebook) y **Create a persona** (Crear una persona). Haz clic en un chip para rellenar el cuadro de mensaje y luego edita el texto antes de enviarlo. Durante una tarea guiada, los chips cambian para encajar con el siguiente paso. Los chips solo aparecen en los chats de Professor Mari.

Cuando tu solicitud deja decisiones reales sin resolver, puede preguntar en una tarjeta de preguntas bajo su respuesta: hasta cuatro preguntas, una a la vez, con opciones y con su recomendación marcada. Elige una opción o escribe la tuya, y luego haz clic en **Submit**. Tus respuestas se envían como tu siguiente mensaje. También puedes ignorar la tarjeta y escribir un mensaje. Nada de lo que propuso junto con la pregunta se ejecuta hasta que respondas.

### Preguntar desde el lugar donde trabajas

Estos lugares la abren con un borrador editable y un pequeño chip **Context** (Contexto: una etiqueta encima del cuadro de mensaje) que puedes quitar antes de enviar:

- Los editores de **Character** (Personaje), **Persona**, **Lorebook** y **Preset**.
- Las respuestas de la **FAQ**: **Ask Prof. Mari about this** (Preguntarle a Professor Mari sobre esto).
- Search: elige un resultado y luego **Ask Prof. Mari**.
- Estados de error como **Try again** (Intentar de nuevo): **Ask Professor Mari**.

No recibe un elemento completo solo porque hayas abierto su editor.

<a id="pick-an-account-for-her"></a>

## Elegir una cuenta para ella

Antes de empezar: añade una cuenta para generación de texto. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).

1. Haz clic en el botón de conexión junto al clip. Muestra el nombre de su cuenta, o **Select connection** (Seleccionar conexión) cuando no hay ninguna elegida.
2. Elige una cuenta de generación de texto de la lista **Connections**. Si descargaste el **Built-in model** (Modelo integrado), también aparece aquí.
3. Haz clic en un modelo de la lista para usarlo. El modelo se guarda en la cuenta, así que tus otros chats con esa cuenta también cambian. El **Built-in model** no tiene lista de modelos.

En un teléfono, toca una cuenta para usarla, o toca la flecha del final de su fila para ver primero sus modelos. Si aún no tienes cuentas, la lista muestra **Add a connection** (Añadir una conexión).

<a id="reviewing-her-changes"></a>

## Revisar sus cambios

Cuando cambia algo, lo guarda de inmediato y muestra una tarjeta de cambios debajo de su respuesta. La tarjeta enumera cada campo que cambió. Una edición de texto muestra las palabras antiguas y las nuevas. **Show all** (Mostrar todo) muestra todos los campos, y **Technical details** (Detalles técnicos) muestra el comando sin procesar.

La tarjeta tiene una sola acción: **Undo**. Vuelve a poner la versión guardada anterior. Mientras se conserve su copia para deshacer, todos los cambios se pueden deshacer en cualquier modo de permisos. El modo de permisos solo decide si ella pregunta primero.

- **Not saved** (No guardado) con un motivo significa que el cambio falló. **Try again** se lo vuelve a pedir.
- **Undo until** (Deshacer hasta) solo aparece durante las últimas 24 horas. Una copia para deshacer dura hasta 14 días, y solo se conservan las 50 más recientes. Después, la tarjeta dice **Undo closed** (Ya no se puede deshacer) y el cambio se mantiene.
- Un paso de su lista de trabajo que termina en **· not saved** (· no guardado) solo fue una vista previa. No cambió nada.
- Una edición que no cambiaría nada no se guarda ni recibe tarjeta.
- Los personajes y las personas también conservan un historial de versiones en sus editores, como segunda forma de volver atrás.
- No puede editar ni eliminar su propia tarjeta de personaje. Marinara la restablece en cada inicio.

Una tarjeta pertenece al chat donde ella hizo el cambio. Eliminar un chat conserva sus cambios y elimina sus tarjetas.

### Cambios que te esperan

Un cambio retenido espera en lugar de guardarse. Muestra **Apply** (Aplicar) y **Don't apply** (No aplicar). Una eliminación muestra **Delete** (Eliminar) y **Put back** (Devolver a su lugar). Los cambios se retienen en modo Manual, y también los de archivos sensibles y dependencias (consulta [Cambios retenidos para archivos y bibliotecas](#held-changes-for-files-and-libraries)). Search no enumera sus cambios: abre Professor Mari para aplicarlos o deshacerlos.

Cuando crea o actualiza un personaje, una persona, un lorebook o un preset, el resultado puede mostrar **Open**, que abre ese elemento. Un resultado actualizado también puede mostrar **Review** (Revisar) mientras hay una revisión pendiente.

## El menú del clip

Haz clic en el botón del clip, etiquetado **Attach** (Adjuntar). Tiene tres secciones.

| Sección | Elementos |
| --- | --- |
| **Attach** | **Attach files or photos** (Adjuntar archivos o fotos), **Add chat history** (Añadir historial de chat: comparte uno de tus chats anteriores), **View attached context** (Ver contexto adjunto) |
| **Reference** | **Link with @** (Vincular con @) |
| **Mari** | **New chat**, **Chat history**, **Skills**, **Memories** (Memorias), **Model** (Modelo), **Permissions**. **Pending approvals** (Aprobaciones pendientes) aparece mientras un cambio te espera. |

Puedes escribir las mismas acciones con `/`. Consulta [Comandos con /](#commands-with-).

### Adjuntar archivos

Elige **Attach files or photos** o escribe `/attach`. Acepta imágenes, archivos PDF y archivos de texto como `.txt`, `.md`, `.json`, `.csv` y `.log`, de hasta 20 MB cada uno. También puedes pegar una captura de pantalla o un archivo en el cuadro de mensaje. Para que ella lea una imagen, el modelo seleccionado debe admitir la entrada de imágenes.

### Vincular elementos con @

Escribe `@` para señalarle algo de tu biblioteca. Se abre una lista, agrupada en **Characters** (Personajes), **Personas**, **Lorebooks**, **Presets**, **Skills**, **Memories**, **Chats**, **Agents** (Agentes) y **Docs**. Sigue escribiendo para reducirla. Los nombres con espacios no necesitan comillas.

- Usa las teclas de flecha para moverte, <kbd>Enter</kbd> o <kbd>Tab</kbd> para elegir y <kbd>Escape</kbd> para cerrar. En un lorebook, la flecha derecha muestra sus **Entries** (Entradas) para que puedas vincular una sola entrada.
- Junto a un editor, la primera fila, **Open beside me** (Abrir a mi lado), vincula lo que el editor tiene abierto. Junto al editor de personajes, su › (o la flecha derecha) enumera los **Fields** (Campos). Elegir un campo cambia el campo en el que ella trabaja y reemplaza el chip de campo de su fila de contexto.
- Un nombre elegido aparece como un chip encima del cuadro de mensaje. Si borras el nombre, el vínculo desaparece con él. La **×** del chip quita el vínculo y conserva tu texto.
- En texto normal, <kbd>Tab</kbd> completa un nombre que ella sugiere en gris. Pulsa <kbd>Tab</kbd> otra vez para vincularlo. En una pantalla táctil, toca el nombre gris y luego **Tap to link** (Toca para vincular).

| Vínculo | Qué recibe ella |
| --- | --- |
| Personaje, persona, preset | El elemento completo |
| Lorebook | Sus ajustes y su lista de entradas |
| Entrada de lorebook | La entrada y el lorebook al que pertenece |
| Skill | Las instrucciones de tu Skill. Un Skill integrado se abre como su manual para ese mensaje. |
| Memoria | El texto completo de la memoria, incluso cuando está desactivada |
| Chat | Los detalles del chat y sus 30 mensajes más recientes |
| Agente | Los ajustes del agente |
| Página de la documentación | La página completa de esta documentación |

Un vínculo se envía una vez, con el mensaje en el que lo añades. Después, ella ve una nota de una línea y vuelve a leer el elemento si lo necesita. Un mensaje admite hasta 8 vínculos. Si suman más de aproximadamente un cuarto del contexto del modelo, 60.000 caracteres como máximo, los últimos no se envían. En su lugar ella recibe una nota y puede leerlos por sí misma. Los elementos vinculados cuentan como información, nunca como instrucciones.

<a id="commands-with-"></a>

### Comandos con /

Escribe `/` al principio de una línea para ver la lista de sus comandos. Sigue escribiendo para filtrar y luego pulsa <kbd>Enter</kbd>. La lista también muestra tus Skills y Memories. Al elegir uno se vincula, igual que con `@`.

| Comando | Qué hace |
| --- | --- |
| `/new` | Empieza un chat nuevo y guarda el actual (`/restart` también funciona) |
| `/history` | Abre tus chats anteriores con ella |
| `/skills` | Abre el panel **Skills** |
| `/memories` | Abre el panel **Memories** |
| `/context` | Muestra lo que está adjunto a este chat |
| `/attach` | Elige archivos o fotos para enviar |
| `/model` | Elige la cuenta que usa ella |
| `/permissions` | Elige qué puede cambiar ella |
| `/approvals` | Abre los cambios que te esperan (solo mientras haya uno pendiente) |

<a id="sending-messages-while-she-works"></a>

## Enviar mensajes mientras ella trabaja

El cuadro de mensaje sigue abierto mientras ella trabaja. Tú eliges cuándo le llega tu mensaje.

- **Send now** (Enviar ahora) entra en su siguiente paso sin detenerla. Su respuesta hasta ese momento se guarda, tu mensaje aparece debajo y ella sigue teniéndolo en cuenta.
- **Send after her answer** (Enviar después de su respuesta) espera en una lista encima del cuadro, marcado con **Sends when she finishes** (Se envía cuando ella termine). Cuando termina sin problemas, toma los mensajes en espera uno por uno.

- **Enter sends** activado (predeterminado): <kbd>Enter</kbd> envía ahora. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> pone en cola.
- **Enter sends** desactivado: <kbd>Ctrl</kbd>+<kbd>Enter</kbd> envía ahora. <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd> pone en cola.

En un Mac, usa <kbd>⌘</kbd> en lugar de <kbd>Ctrl</kbd>. Mientras ella trabaja, un cuadro de mensaje vacío solo muestra un botón **Stop** (Detener), que cancela la tarea actual. Cuando escribes, **Stop** cambia al botón de enviar. Haz clic en él para elegir **Send now** o **Send after her answer**, lo que ayuda en un teléfono.

Send now es solo para palabras. Un mensaje con archivos, vínculos con `@` o un campo que le pasaste se pone en cola en su lugar. Lo mismo pasa con un mensaje sobre un tema distinto, o con uno enviado después de cambiar el modo de permisos. Un breve aviso lo indica. Haz clic en la **X** de un mensaje para quitarlo. Un chat puede contener hasta 20 mensajes en espera.

Los mensajes en espera no se envían solos en estos casos:

- **Pulsas Stop.** Vuelven al cuadro de mensaje.
- **Ella te espera** (una aprobación o una respuesta), **la ejecución falló o la app se reinició.** Muestran **Held** (Retenido) con un botón **Send** (Enviar). **Send** envía solo ese.

`/restart` y `/title` no hacen nada mientras ella trabaja. Se quedan en el cuadro hasta que termine.

En un trabajo más largo, lleva una lista de tareas bajo su último mensaje, con un recuento como **2 of 5** (2 de 5). No puedes editarla. Después de que escribas un mensaje nuevo, se muestra atenuada como **Plan from before your last message** (Plan de antes de tu último mensaje).

## Encontrar tus chats de Professor Mari

Sus chats están separados de tu lista de chats normal.

1. Haz clic en **Chats** en su cabecera.
2. Usa **Search Prof. Mari chats** (Buscar en los chats de Professor Mari) para encontrar uno. Haz clic en un chat para abrirlo, cambiarle el nombre o eliminarlo.

Haz clic en **New chat** o escribe `/new` para empezar de nuevo. Primero guarda tu chat actual y muestra **Professor Mari's previous chat was saved.** (Se guardó el chat anterior de Professor Mari).

## Respuestas breves en Search

Las respuestas breves están desactivadas hasta que activas **Quick answers in Search** (Respuestas breves en Search) en **Search and Professor Mari settings**. Cuando escribes una pregunta en Search y ningún resultado coincide, ella escribe una respuesta breve de solo lectura en una tarjeta **Quick answer · Read-only** (Respuesta breve · Solo lectura).

- Tiene hasta tres frases sacadas de la documentación de Marinara, nombra las páginas que usó y no cambia nada. La misma pregunta reutiliza una copia guardada durante cinco minutos.
- Debajo: **Copy** (Copiar), **Answer again** (Responder de nuevo) y **Continue with Prof. Mari** (Continuar con Professor Mari). La última abre su ventana en un chat nuevo con el nombre de tu pregunta.
- **Wait after typing** (Esperar después de escribir) define cuánto espera Search. **Answer with** (Responder con) elige quién responde: un modelo que hayas descargado, **Same as Prof. Mari** (Igual que Professor Mari) u otra cuenta. Cada respuesta es una solicitud breve, así que una cuenta de pago puede costar dinero.
- Si una respuesta falla, la tarjeta dice por qué. **Choose a model** (Elegir un modelo) solo aparece cuando falta una clave o un modelo. El mensaje del propio servicio está en **Details** (Detalles).

## Referencia: ajustes, skills y memorias

### Línea de estado y píldora de la barra superior

Puedes cerrar su ventana mientras trabaja. Una línea fina a lo largo del borde inferior de la barra superior ondula mientras trabaja, se vuelve verde cuando termina, dorada mientras hay una aprobación pendiente y roja si la última ejecución falló. Mientras su ventana está cerrada, una píldora en la barra superior muestra **Working** (Trabajando), **Needs you** (Te necesita), **Done** (Listo) o **Failed** (Falló). Haz clic en la píldora para volver a su chat.

### Apariencia

En **Search and Professor Mari settings → Appearance** (Ajustes de Search y Professor Mari → Apariencia), elige un aspecto como **Basic**, **Prof. Mari loves Dottore** o **Safari Prof. Mari**. Se muestra en su chat, en Search, en la pantalla de inicio y en la barra superior. Algunos aspectos se desbloquean después de suficiente tiempo de juego, y un aspecto bloqueado muestra tus horas hasta ahora.

### Skills

Un Skill es un breve documento de instrucciones que cambia cómo maneja ella cierto tipo de solicitud.

1. Haz clic en **Skills** en su cabecera. Se abre el panel **Professor Mari skills** (Skills de Professor Mari).
2. Haz clic en **New** (Nuevo) para empezar desde una plantilla, o en **Upload** (Subir) para añadir un archivo `.md` o `.txt`.
3. Selecciona un Skill para editar su **Name** (Nombre), **Description** (Descripción) e **Instructions** (Instrucciones), y luego haz clic en **Save** (Guardar). Haz clic en **Delete** para quitarlo.

Desactiva un Skill para conservarlo sin usarlo. Sin Skills, el panel muestra **No custom skills yet** (Aún no hay skills personalizados).

Los skills integrados aparecen en **Always on** (Siempre activos), marcados con **Built-in** (Integrado). Son sus manuales para personajes, lorebooks, presets, temas, extensiones, widgets de la pantalla de inicio y más. Son de solo lectura, y una actualización de la app los reemplaza. Para cambiar uno, copia su texto en un Skill nuevo propio.

### Memorias

Una memoria es una preferencia fija que ella conserva, como la forma en que te gusta poner las palabras clave de las entradas de lorebook. Pídeselo ("recuerda que siempre pongo como palabra clave de las entradas el nombre del personaje"), o abre **Memories** en su cabecera para crear, editar, activar o desactivar y eliminar memorias, o usa **Upload** para subir un archivo de texto.

- Una memoria que ella guarda empieza desactivada. La tarjeta de cambios ofrece **Turn on** (Activar). Solo guarda una cuando tú se lo pides, nunca porque algo que leyó se lo haya dicho.
- En cada turno solo ve un índice corto de tus memorias activadas, y lee el texto completo cuando una es relevante. Una memoria **Persistent** (Persistente) está delante de ella en cada turno, así que conviene que esas sean pocas y pequeñas.
- Las memorias tienen prioridad sobre sus costumbres predeterminadas cuando entran en conflicto.

## Estado de confianza y recuperación

Abre **Context** en su cabecera para ver qué acompaña a tu próximo mensaje, qué se queda en este chat y cómo trabaja: el modelo, el presupuesto de contexto y si su shell se ejecuta en un entorno aislado. La cabecera también muestra las aprobaciones pendientes, los Skills y las Memories. **Context** no concede acceso adicional.

Cuando una solicitud falla, el chat conserva el motivo y muestra **Retry** (Reintentar) cuando puedes volver a enviarla. Corrige primero el problema de cuenta, entorno aislado o acceso que se indique. Si tu pregunta no se guardó, vuelve al cuadro de mensaje con sus archivos. **Retry** y **Retry with another model** (Reintentar con otro modelo) envían entonces lo que hay en el cuadro.

## Leer la FAQ

Haz clic en el marcador **FAQ**, o en **Read FAQ** (Leer la FAQ) en el widget **Learn the engine** (Aprende a usar el motor), para abrir **Professor Mari's FAQ** (La FAQ de Professor Mari). Es una lista fija y escrita, no el chat con IA, así que no conoce tu configuración. Escribe en **Search FAQ** (Buscar en la FAQ) para filtrar. Cada pregunta tiene una etiqueta de categoría como **Setup** (Configuración), **Connections** o **Game Mode**. Toca una pregunta para leer la respuesta.

## Límites y seguridad

- No puede garantizar que su conocimiento integrado coincida con la versión de tu app. Para cualquier cosa que dependa de la versión, confía en las guías y en las notas de la versión.
- Crear contenido nuevo suele ser seguro. Editar contenido existente necesita más cuidado. Nombra el elemento y el campo exactos: "haz más corto el saludo de Luna, mantén su personalidad" es más seguro que "reescribe este personaje".
- Si dice que terminó pero la app no lo muestra, confía en la app y termina la tarea en el panel correspondiente.
- Cuando llegas a Marinara desde otro dispositivo, sus acciones de edición necesitan tener configurado el acceso remoto. Consulta [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md).

## Solución de problemas

| Síntoma | Solución |
| --- | --- |
| Sin respuesta | Comprueba la cuenta que se muestra en **Context**, o elige una con el botón de conexión. Si no hay ninguna, añade una en **Connections**. |
| La lista **Connections** se abre cuando pulsas enviar | No hay ninguna cuenta elegida. Elige una, o haz clic en **Add a connection**. |
| Un traspaso tiene el elemento equivocado | Quita el elemento de contexto, cambia al chat correcto de Professor Mari y vuelve a abrir el traspaso desde el lugar de origen. |
| Un resultado no aparece en un editor | Haz clic en **Open** en la tarjeta del resultado. Puede que la lista de elementos estuviera desactualizada. |
| Una solicitud falla | Lee el fallo, corrige el problema indicado y luego haz clic en **Retry**. |
| No puede leer tu imagen | Cambia a una cuenta cuyo modelo admita la entrada de imágenes. |
| Las consultas a Fandom fallan | Necesitan una conexión a internet. |
| Las acciones se bloquean con un error de permiso | Llegas a Marinara a través de una red. Configura primero el acceso remoto. |

## Referencia para uso avanzado

Estas partes son para quienes editan los propios archivos de Marinara o quieren ajustar cómo trabaja ella. Puedes saltártelas.

### Entorno de ejecución

En **Runtime** (Entorno de ejecución) puedes elegir **Pi (experimental)**, la opción predeterminada, o **Classic** (Clásico). Pi es un modo en el que ella piensa más antes de actuar y resuelve tareas más largas. Si tu cuenta no puede ejecutar Pi, usa Classic. El cambio se aplica desde su siguiente respuesta, y Undo funciona igual en ambos. Si se comporta de forma extraña en Pi, cambia a Classic.

**Read the handbook before the first write** (Leer el manual antes de la primera escritura), también en **Runtime**, está activado de forma predeterminada. Su primer cambio en un área con un skill integrado se rechaza hasta que haya leído ese skill. Esto ayuda a los modelos más pequeños. Solo tú puedes desactivarlo.

### Qué puede alcanzar en tu computadora

Puede leer y cambiar los propios archivos de programa de Marinara y ejecutar comandos en un entorno aislado, así que puede reparar la app. La mayoría de las personas nunca necesitan esto.

- Sus herramientas de archivos permanecen dentro de la carpeta donde está instalado Marinara. Los comandos de shell sin procesar no pueden leer tus otros archivos personales, no tienen acceso a la red y no heredan los secretos del servidor.
- `.env`, el archivo de clave que protege tus API keys (claves de API) guardadas y los archivos internos de Git no están disponibles para ella.
- No puede escribir directamente en tu carpeta de datos, donde viven tus personajes y chats. Usa el flujo de cambios revisables descrito arriba.
- Los manifiestos de dependencias, los archivos de bloqueo, los lanzadores, los instaladores y los flujos de CI se preparan primero para tu aprobación. Los scripts de instalación de paquetes permanecen desactivados.
- Los comandos se detienen solos tras un corto tiempo.
- Si Marinara no puede proporcionar su entorno aislado de shell de macOS o Linux, los comandos de shell sin procesar y `mari code check` quedan desactivados. Ella todavía puede usar las herramientas estructuradas de archivos y de datos de la app.

<a id="held-changes-for-files-and-libraries"></a>

### Cambios retenidos para archivos y bibliotecas

- **Sensitive files** (Archivos sensibles: archivos de dependencias, lanzadores, instaladores, flujos de CI) muestran la ruta y el contenido nuevo con **Apply change** (Aplicar cambio) y **Discard** (Descartar).
- **Dependencies** (Dependencias) muestran el paquete de npm, la versión exacta y la integridad del registro con **Install** (Instalar) y **Not now** (Ahora no). Los comandos de instalación están bloqueados en su shell. Aprobar una biblioteca significa confiar en su código cuando Marinara lo ejecuta.

### Cómo maneja las Decisions

Un modelo de decisión es un modelo pequeño que responde preguntas de sí o no. Para las **Activation questions** (Preguntas de activación) de los agentes, las declaraciones **Decision** de los lorebooks y los prompts condicionales, primero comprueba qué modelo de decisión elegiste.

- Pregunta antes de añadir contenido Decision y, sin un modelo de decisión, mantiene el trabajo nuevo libre de Decisions salvo que tú lo pidas.
- Prefiere un uso moderado con un control de tiempo: **Sticky** o **Cooldown** para las entradas de lorebook, **Trigger Cadence** para la activación de agentes, y `sticky`, `cooldown` o `every` en las condiciones de prompt.
- Pregunta antes de añadir contenido que cambia al principio de un prompt o dentro del historial del chat, para que el inicio del prompt se mantenga estable para la caché de prompts del servicio.
- Dile "Stop reminding me to set up a Decision model" para detener los recordatorios.

Consulta [Modelos de decisión](../connections/decision-models.md), [Prompts condicionales](../prompts/conditional-prompts.md), [Agentes personalizados](../agents/custom-agents.md#activation-questions) y [Entradas de lorebook](../lorebooks/entries.md#decision-activation).

### El comando mari

Un cambio hecho con el comando `mari` en una terminal no pertenece a ningún chat, así que su tarjeta de cambios aparece en todos los chats de Professor Mari.

## Guías relacionadas

- [Primeros pasos con Marinara Engine](welcome.md)
- [El tutorial de primera vez](tutorial.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md)
