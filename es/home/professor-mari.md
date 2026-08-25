# Professor Mari, tu asistente dentro de la app

Professor Mari es el asistente integrado de Marinara Engine en la pantalla de inicio. Esta guía te muestra dónde encontrarla, qué puede hacer, cómo mantiene sus cambios reversibles y cómo resolver problemas comunes.

## Dónde encontrarla

Professor Mari vive en la pantalla de inicio. La pantalla de inicio es lo que ves cuando no hay ningún chat abierto.

Busca la tarjeta con su pixel art y el título **Professor Mari**. Una línea de estado muestra **Ready to help** (Lista para ayudar) cuando está inactiva, o **Working on it...** (Trabajando en ello...) mientras está ocupada. Haz clic en el botón **Ask Professor Mari** (Pregúntale a Professor Mari) para abrir su ventana de chat completa.

Le hablas en lenguaje sencillo. Escribe un mensaje en el cuadro y pulsa Enter para enviarlo. Pulsa Shift y Enter juntas para añadir una línea nueva en su lugar.

Enviarle tu primer mensaje desbloquea el logro **Hello World**.

El **indicador de presencia de Professor Mari**, el chat normal con el personaje Professor Mari y el chat del espacio de trabajo de Inicio usan el mismo formato de traspaso.

## Qué puede hacer

Professor Mari es más que un cuadro de preguntas. Puede explicarte la app, ayudarte a configurarla y crear cosas por ti cuando se lo pides.

Pídele ayuda con cualquiera de estas tareas:

- Explicar una configuración, un modo o un concepto antes de que cambies nada.
- Crear o editar un personaje. Un personaje es una tarjeta que le da a la IA un nombre, una personalidad y una voz.
- Crear o editar una persona. Una persona es la identidad con la que juegas en un chat, el "tú" de la historia.
- Crear o editar un lorebook. Un lorebook (libro de trasfondo) es un conjunto de notas del mundo que la IA incorpora cuando son relevantes.
- Crear o editar un tema, un agente, un preset de prompt o un borrador de Personal Extension (Extensión personal). Professor Mari es la única autora de extensiones predeterminada. Sus borradores permanecen desactivados hasta que inspeccionas el código en el entorno aislado, revisas los permisos activos de tarjeta de personaje o de persona que solicite, y apruebas el hash exacto en **Settings** (Configuración) > **Addons**.
- Editar una sola parte de un preset de prompt sin tocar el resto. Puede listar las secciones individuales, los grupos de prompt y las variables de elección de un preset, leer cualquiera de ellos por completo, y agregar, cambiar o quitar solo esa pieza —por ejemplo, agregar una línea a una sección concreta— en lugar de solo crear o reemplazar el preset entero.
- Comparar los 33 agentes y paquetes de funciones oficiales descargables, explicar qué modos admiten y aconsejar cuáles encajan con el objetivo de un usuario. Distingue la disponibilidad del catálogo de lo que realmente está instalado, dirige a los usuarios a **Agents → Download Agents** (Agentes → Descargar agentes) cuando hace falta, y sabe que las fuentes de los paquetes y el catálogo completo están disponibles en [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents).
- Generar o asignar imágenes, como avatares, sprites y fondos. Un sprite (imagen del personaje) es una imagen del personaje, como un retrato o una pose de cuerpo completo, que se muestra durante un chat.
- Consultar páginas públicas de wikis de Fandom para ayudarte a investigar un personaje o un mundo.
- Seguir sugerencias en chips de respuesta rápida encima de la entrada del chat, con colores según el tipo de entidad, a lo largo de una creación o edición de varios pasos.

Lee un elemento antes de editarlo, y te pide los detalles que faltan cuando tu solicitud es vaga. Para tareas de imagen necesitas tener antes configurada una conexión de generación de imágenes que funcione. Ella no crea una por ti.

## Chips de sugerencia guiada

En un chat vacío de Professor Mari, los chips iniciales como **Create a Character** (Crear un personaje), **Create a Lorebook** (Crear un lorebook) y **Create a Persona** (Crear una persona) ayudan a empezar tareas comunes. Durante una creación o edición guiada, los chips cambian para coincidir con el siguiente paso. Al hacer clic en un chip se rellena el borrador de la entrada; puedes editar ese borrador antes de enviarlo.

Los flujos guiados hacen una pregunta enfocada cada vez, en lugar de presentar un formulario largo de golpe.

## También puede leer y editar los propios archivos de la app

Professor Mari puede mirar dentro de los propios archivos de programa de Marinara, cambiarlos y ejecutar comandos en un entorno aislado. Esta es una capacidad real y potente, así que vale la pena entenderla con claridad.

Aquí está el límite de confianza en términos sencillos:

- Sus herramientas de archivos permanecen dentro de la carpeta donde está instalado Marinara. Los comandos de shell sin procesar pueden leer el área de trabajo y los programas del sistema necesarios, pero no pueden leer tus otros archivos personales.
- Los archivos con secretos de entorno como `.env` y los archivos internos de Git no están disponibles para sus herramientas de archivos ni para el shell sin procesar.
- No puede escribir directamente en tu carpeta de datos guardados, donde viven tus personajes y chats. En su lugar usa el flujo de cambios revisables que se describe abajo.
- Los comandos de shell sin procesar no tienen acceso a la red, no heredan los secretos del servidor y solo pueden escribir archivos ordinarios del área de trabajo y una carpeta temporal privada.
- Puede seguir editando archivos de código normales directamente. Los cambios en manifiestos de dependencias, archivos de bloqueo, lanzadores, instaladores y flujos de CI se preparan y se te muestran antes de que Marinara los aplique.
- Si un cambio de código necesita una biblioteca pública de npm, solicita un paquete específico como destino. Marinara resuelve `latest` a una versión exacta, muestra la integridad del registro en una tarjeta de revisión, y la instala solo después de que la apruebas. Los scripts de ciclo de vida de los paquetes permanecen desactivados.
- Si Marinara no puede proporcionar su entorno aislado de shell de macOS o Linux, los comandos de shell sin procesar quedan desactivados. Ella todavía puede usar las herramientas estructuradas más seguras de archivos y de datos de la app.
- Los comandos que ejecuta se detienen por sí solos tras un corto tiempo, así que un comando atascado no puede correr para siempre.

La mayoría de las personas nunca necesitan esto. Existe para que ella pueda inspeccionar o reparar la propia app cuando algo está roto.

## Elegir una conexión

Professor Mari necesita una conexión para pensar. Una conexión enlaza Marinara con un proveedor de IA usando una API key. Una API key (clave de API) es un código secreto de ese proveedor.

Haz clic en el icono de enlace junto al clip para abrir el menú desplegable **Connections** (Conexiones). Elige cualquier conexión de generación de texto que tengas configurada. Si has descargado el modelo local integrado, también aparece aquí como **Local Model (sidecar)**. Si la app conoce el nombre del modelo, ese nombre aparece entre paréntesis en su lugar. Tu elección se recuerda en tu navegador.

Si aún no tienes conexiones, el menú desplegable muestra **Add a connection** (Añadir una conexión) en su lugar. Si intentas enviar un mensaje sin conexión, se abre el panel **Connections** por ti. También ves este mensaje emergente (llamado toast):

> You haven't set up a connection yet! Click the link icon beside the paperclip to select one.

Para un recorrido completo, consulta la guía de conexión enlazada al final.

## Adjuntar archivos

Haz clic en el botón del clip, etiquetado **Attach files** (Adjuntar archivos), para añadir un archivo a tu mensaje.

Acepta imágenes, archivos PDF y archivos de texto comunes como `.txt`, `.md`, `.json`, `.csv` y `.log`. Cada archivo puede pesar hasta 20 MB. Los archivos adjuntos aparecen como chips que puedes quitar encima del cuadro de mensaje antes de enviar.

Para que ella lea una imagen, el modelo de la conexión que elegiste debe admitir la entrada de imágenes.

## Revisar sus cambios

Cuando Professor Mari edita algo que ya tienes, guarda el cambio de inmediato y luego muestra una tarjeta de revisión. Esto te permite deshacerlo si no te gusta el resultado.

La tarjeta se titula **Review Mari's changes** (Revisar los cambios de Mari). Muestra qué hizo y qué datos tocó. Tiene dos botones:

- **Keep** (Conservar) confirma el cambio. Ves el mensaje "Kept Mari's workspace change."
- **Restore** (Restaurar) vuelve a poner la versión guardada anterior. Ves el mensaje "Restored the previous app data snapshot."

Algunas cosas que conviene saber:

- Los elementos totalmente nuevos, como un personaje o un lorebook recién creados, suelen saltarse este paso. No se sobrescribió nada existente, así que no hay nada que deshacer.
- Una tarjeta de revisión caduca por sí sola tras 10 minutos si no la respondes.
- Los personajes y las personas también conservan su propio historial de versiones dentro de sus editores. Puedes restaurar una versión más antigua ahí como una segunda red de seguridad.

Dos cambios de mayor riesgo esperan en lugar de aplicarse primero:

- **Sensitive file changes** (Cambios en archivos sensibles) muestran la ruta y el contenido propuesto con **Apply change** (Aplicar cambio) y **Discard** (Descartar). Esto cubre archivos de dependencias, lanzadores, instaladores y flujos de CI. Las ediciones ordinarias de TypeScript, React, CSS, prompt, rutas y documentación siguen disponibles sin esta barrera adicional.
- **Dependencies** (Dependencias) muestran el paquete público exacto de npm, la versión, el área de trabajo destino, el tipo de dependencia, la integridad del registro y las dependencias directas declaradas, con **Install** (Instalar) y **Not now** (Ahora no). Los comandos de instalación sin procesar como `npm`, `pnpm`, `yarn`, `pip` y similares están bloqueados dentro de su shell, incluidas las instalaciones en caché.

Aprobar una biblioteca significa confiar en su código cuando Marinara luego la importa o la ejecuta. Desactivar los scripts de ciclo de vida evita la ejecución en el momento de la instalación, pero no puede hacer que una biblioteca sea inofensiva en tiempo de ejecución.

## Custom Skills

Un Skill es un breve documento de instrucciones que escribes para cambiar cómo maneja Professor Mari cierto tipo de solicitud.

Haz clic en el botón **Skills** en la cabecera de su chat para abrir el panel **Professor Mari Skills** (Skills de Professor Mari). Desde ahí puedes:

- Hacer clic en **New** (Nuevo) para empezar un Skill a partir de una plantilla.
- Hacer clic en **Upload** (Subir) para añadir un Skill desde un archivo `.md` o `.txt`.
- Activar o desactivar cada Skill. Un Skill que está desactivado sigue existiendo pero no se usa.
- Seleccionar un Skill para editar su **Name** (Nombre), **Description** (Descripción) e **Instructions** (Instrucciones), y luego hacer clic en **Save** (Guardar). Haz clic en **Delete** (Eliminar) para quitarlo.

Cuando aún no tienes ningún Skill, el panel muestra **No custom skills yet** (Aún no hay skills personalizados).

## Memorias guardadas

Professor Mari puede recordar tus preferencias fijas para que no tengas que repetirlas en cada conversación: cómo te gusta que se formateen tus lorebooks o tus tarjetas de personaje, tus convenciones de nombres, o cómo quieres que se comporte ella.

Hay dos formas de darle una memoria:

- **Díselo.** Escribe algo como "recuerda que siempre pongo como palabra clave de las entradas de lorebook el nombre del personaje y su apodo". Ella la guarda y te muestra una tarjeta de revisión **Keep/Restore** con el texto exacto. Una memoria que ella guarda empieza **desactivada**, así que no cambia nada hasta que tú la activas. La tarjeta ofrece un tercer botón, **Keep & Enable** (Conservar y activar), para guardarla y activarla de inmediato.
- **Agrégala tú.** Haz clic en el botón **Memories** (Memorias) en la cabecera de su chat para abrir el panel **Memories**, donde puedes crear, editar, activar o desactivar, y eliminar tus memorias. También puedes usar **Upload** con un archivo `.md` o de texto para convertir su contenido en una memoria.

Ella solo guarda o cambia una memoria cuando **tú** se lo pides, nunca porque algo que leyó (un personaje, un lorebook o un archivo) se lo haya dicho.

Cómo las usa, y por qué sigue siendo eficiente:

- En cada turno ella ve un **índice** corto de tus memorias *activadas*, solo con sus títulos y descripciones de una línea, lo cual casi no cuesta nada. Cuando una memoria es relevante para lo que estás haciendo, busca su texto completo y lo sigue. Así su prompt se mantiene pequeño a medida que agregas memorias, ya que solo el índice corto está siempre presente. La excepción es una memoria que marcas como **Persistent** (Persistente; ver abajo): su texto completo se inyecta en cada turno, así que de esas conviene tener pocas y cortas. Una memoria desactivada se conserva pero se ignora, así que puedes desactivar una para probar algo distinto y volver a activarla más tarde.
- Las memorias guardadas **tienen prioridad sobre su comportamiento predeterminado** cuando entran en conflicto. Por ejemplo, una memoria que dice "cuando yo pregunte cómo hacer algo, hazlo sin más" hace que ella vuelva a editar sin preguntarte, por delante de su costumbre de confirmar primero.
- Una directriz poco común que deba aplicarse en *cada* turno se puede marcar como **Persistent** para que su texto completo esté siempre delante de ella. Que tus memorias persistentes sean pocas y breves, ya que cada una está siempre en su prompt, y úsalas solo para describir un comportamiento que quieres que sea siempre cierto.

Para gestionar tus memorias, usa el panel **Memories**, o simplemente pregúntale: "¿qué recuerdas?", "actualiza mi memoria de formato de lorebooks para que también incluya los títulos" u "olvida eso".

## Historial de chats y Restart

Professor Mari conserva sus propios chats separados. No aparecen en tu lista de chats normal.

Haz clic en el botón **Chats** en su cabecera para abrir tus chats guardados de Professor Mari. El panel indica: "Restart saves the current chat here." Puedes hacer clic en un chat guardado para abrirlo, cambiarle el nombre o eliminarlo.

Haz clic en el botón **Restart** (Reiniciar) para empezar una conversación nueva con ella. Restart primero guarda tu chat actual en la lista **Chats**. También puedes escribir `/restart` en el cuadro de mensaje para hacer lo mismo. Ves el mensaje "Professor Mari's previous chat was saved."

Mientras ella trabaja, aparece un botón **Stop** (Detener) en la cabecera. Haz clic en él para cancelar la tarea actual.

## El globo de chat flotante

Si dejas su ventana de chat abierta y luego te mueves a otra página, Professor Mari puede seguirte como un pequeño globo flotante.

En un teléfono o una pantalla estrecha, se convierte en un pequeño avatar redondo que puedes arrastrar. Tócalo para volver a abrir el chat completo. En una pantalla ancha, aparece una pequeña ventana arrastrable **Ask Professor Mari**. Cada versión tiene un control para descartar el globo durante el resto de tu sesión.

## Su FAQ está separada del chat

Junto a su tarjeta de chat, la pantalla de inicio muestra un panel **FAQ**. Esta es una lista fija y escrita de preguntas y respuestas. No es el chat con IA.

Escribe en el cuadro **Search FAQ** (Buscar en la FAQ) para filtrar las preguntas. Cada pregunta tiene una etiqueta de categoría con color, como **Setup** (Configuración), **Connections** (Conexiones) o **Game Mode**. Toca una pregunta para leer su respuesta.

Como la FAQ está escrita dentro de la app, no conoce tu configuración en vivo. Para cualquier cosa sobre tus propios datos o tu estado actual, usa el chat.

## Limitaciones y seguridad

Professor Mari es un ayudante, no la documentación completa. Ten presentes estos límites:

- No puede garantizar que su conocimiento integrado coincida con la versión exacta de tu app. Cuando algo depende de la versión o cambió hace poco, confía primero en las guías y en las notas de la versión.
- Crear contenido nuevo suele ser seguro, ya que no se sobrescribe nada. Editar contenido existente merece más cuidado.
- Una dependencia revisada es código de terceros con el mismo acceso en tiempo de ejecución que el código de Marinara que la importa. Revisa el nombre del paquete, la versión exacta, el propósito y la integridad que se muestran en la tarjeta de aprobación.
- Para las ediciones, nombra el elemento exacto y el campo exacto que quieres cambiar. Una solicitud como "reescribe todo este personaje" es más arriesgada que "haz más corto el saludo inicial de Luna, mantén su personalidad igual".
- Para una creación de varios pasos, usa los chips de sugerencia para responder una pregunta enfocada cada vez, en lugar de intentar dar todos los campos de golpe.
- Si dice que terminó una tarea pero la app no la muestra, confía en la app. Termina la tarea tú mismo desde el panel correspondiente.
- Si llegas a Marinara desde otro dispositivo en lugar de la misma computadora, sus acciones de edición necesitan tener configurado el acceso remoto. Consulta la guía de acceso remoto.

## Solución de problemas

- Sin ninguna respuesta: comprueba que haya una conexión seleccionada usando el icono de enlace. Si no hay ninguna configurada, abre el panel **Connections** y añade una.
- Mensaje emergente "You haven't set up a connection yet": elige una conexión desde el menú desplegable del icono de enlace, o añade una primero.
- No puede leer tu imagen adjunta: tu modelo debe admitir la entrada de imágenes. Cambia a una conexión cuyo modelo pueda ver imágenes.
- Las consultas a Fandom fallan: estas necesitan una conexión a internet, ya que Fandom es un sitio web externo.
- Sus acciones se bloquean con un error de permiso: estás llegando a Marinara a través de una red, no desde la misma computadora. Configura primero el acceso remoto.

## Guías relacionadas

- [Primeros pasos con Marinara Engine](welcome.md)
- [El tutorial de la primera vez](tutorial.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Acceso remoto: Basic Auth y lista de IP permitidas](../REMOTE_ACCESS.md)
