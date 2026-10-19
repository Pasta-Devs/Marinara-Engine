# Professor Mari, tu asistente dentro de la app

Professor Mari es el asistente integrado de Marinara Engine en la pantalla de inicio. Esta guía te muestra dónde encontrarla, qué puede hacer, cómo mantiene sus cambios reversibles y cómo resolver problemas comunes.

## Dónde encontrarla

Professor Mari vive en la pantalla de inicio. La pantalla de inicio es lo que ves cuando no hay ningún chat abierto.

Busca la tarjeta con su pixel art y el título **Professor Mari**. Una línea de estado muestra **Ready to help** (Lista para ayudar) cuando está inactiva, o **Working on it...** (Trabajando en ello...) mientras está ocupada. Haz clic en el botón **Ask Prof. Mari** (Pregúntale a Professor Mari) para abrir su ventana de chat completa.

Le hablas en lenguaje sencillo. Escribe un mensaje en el cuadro y pulsa Enter para enviarlo. Pulsa Shift y Enter juntas para añadir una línea nueva en su lugar.

Enviarle tu primer mensaje desbloquea el logro **Hello World**.

Una línea fina en el borde inferior de la barra superior de la app también muestra su estado desde cualquier pantalla: ondula mientras trabaja, se vuelve verde cuando termina, dorada mientras hay una aprobación pendiente, o roja si la última ejecución falló. Desaparece en cuanto abres su chat. (No se muestra mientras **Ask Professor Mari from Search** (Preguntar a Professor Mari desde Search) esté desactivado.) Todos sus ajustes están en los ajustes de Search y Professor Mari: el engranaje de Search, o **Settings** (Configuración) > **General** > **Search and Professor Mari settings** (Ajustes de Search y Professor Mari) > **Open** (Abrir).

## Preguntar a Professor Mari desde tu trabajo actual

Professor Mari es más que un cuadro de preguntas. Puede explicarte la app, ayudarte a configurarla y crear cosas por ti cuando se lo pides.

Puedes abrir Professor Mari desde el lugar donde necesitas ayuda. Estos puntos de entrada crean un borrador editable y adjuntan un resumen de contexto breve y tipado. Puedes quitar el contexto adjunto antes de enviar el mensaje.

- Editores de **Character** (Personaje), **Persona**, **Lorebook** y **Preset**: pregunta por el recurso abierto o por un campo seleccionado.
- Respuestas de la **FAQ**: usa **Ask Prof. Mari** para incluir la pregunta encontrada y su respuesta escrita como punto de partida.
- **Search** (Búsqueda): pulsa `Cmd/Ctrl+K`, selecciona un resultado y luego usa **Ask Prof. Mari** para incluir el resultado seleccionado en el borrador. Search no envía ninguna solicitud al modelo por su cuenta, salvo que una respuesta breve esté activada; consulta **Quick answers in Search** (Respuestas breves en Search) más abajo.
- **Recent Chats** (Chats recientes) y otros estados de error: usa **Ask Prof. Mari** junto a **Retry** (Reintentar) para enviar la descripción del error y la acción de reparación solicitada.
- El chat normal con el personaje Professor Mari y el chat del área de trabajo de la pantalla de inicio usan el mismo formato de traspaso.

Los elementos adjuntos aparecen como chips **Aware of** (Al tanto de) encima de su cuadro de mensaje. Quita un elemento de contexto cuando no sea relevante. Después de que envíes el mensaje, Professor Mari resuelve en el servidor el contenido más extenso de los recursos, dentro del presupuesto de contexto. No recibe un recurso completo solo porque hayas abierto un editor.

Pídele ayuda con cualquiera de estas tareas:

- Explicar una configuración, un modo o un concepto antes de que cambies nada.
- Crear o editar un personaje. Un personaje es una tarjeta que le da a la IA un nombre, una personalidad y una voz. También puede escribir el [onboarding interactivo](../characters/interactive-onboarding.md) de una tarjeta, es decir, las preguntas que responden los jugadores para crear su persona.
- Crear o editar una persona. Una persona es la identidad con la que juegas en un chat, el "tú" de la historia.
- Crear o editar un lorebook. Un lorebook (libro de trasfondo) es un conjunto de notas del mundo que la IA incorpora cuando son relevantes.
- Crear o editar un tema, un agente, un preset de prompt o un borrador de Personal Extension (Extensión personal). Professor Mari es la única autora de extensiones predeterminada. Sus borradores permanecen desactivados hasta que inspeccionas el código en el entorno aislado, revisas los permisos activos de tarjeta de personaje o de persona que solicite, y apruebas el hash exacto en **Settings** (Configuración) > **Addons**.
- Editar una sola parte de un preset de prompt sin tocar el resto. Puede listar las secciones individuales, los grupos de prompt y las variables de elección de un preset, leer cualquiera de ellos por completo, y agregar, cambiar o quitar solo esa pieza —por ejemplo, agregar una línea a una sección concreta— en lugar de solo crear o reemplazar el preset entero.
- Comparar los 33 agentes y paquetes de funciones oficiales descargables, explicar qué modos admiten y aconsejar cuáles encajan con el objetivo de un usuario. Distingue la disponibilidad del catálogo de lo que realmente está instalado, dirige a los usuarios a **Agents → Download Agents** (Agentes → Descargar agentes) cuando hace falta, y sabe que las fuentes de los paquetes y el catálogo completo están disponibles en [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents).
- Generar o asignar imágenes, como avatares, sprites y fondos. Un sprite (imagen del personaje) es una imagen del personaje, como un retrato o una pose de cuerpo completo, que se muestra durante un chat.
- Consultar páginas públicas de wikis de Fandom para ayudarte a investigar un personaje o un mundo.
- Seguir sugerencias en chips de respuesta rápida encima de la entrada del chat, con colores según el tipo de entidad, a lo largo de una creación o edición de varios pasos.

Lee un elemento antes de editarlo, y te pide los detalles que faltan cuando tu solicitud es vaga. Para tareas de imagen necesitas tener antes configurada una conexión de generación de imágenes que funcione. Ella no crea una por ti.

## Respuestas breves en Search

Cuando escribes una pregunta en Search y ningún resultado coincide, Professor Mari puede escribir una respuesta breve. Aparece como una tarjeta **Quick answer · Read-only** (Respuesta breve · Solo lectura) debajo de la fila **Ask Prof. Mari**.

- Una respuesta breve tiene hasta tres frases sacadas de la documentación de Marinara. Ella solo ve lo que escribiste, y la respuesta no cambia nada.
- La tarjeta nombra las páginas de la documentación que usó. Si repites la misma pregunta, se usa una copia guardada durante cinco minutos.
- Debajo de la respuesta están **Copy** (Copiar), **Answer again** (Responder de nuevo) y **Continue with Prof. Mari** (Continuar con Professor Mari). **Continue with Prof. Mari** abre su ventana en un chat nuevo con el nombre de tu pregunta y con la respuesta breve adjunta. Usa **Ask Prof. Mari more…** (Preguntar más a Professor Mari) para hacer una pregunta de seguimiento en su ventana. Las respuestas breves no tienen seguimiento propio.
- Una respuesta breve espera hasta que dejes de escribir. **Wait after typing** (Esperar después de escribir) define cuánto espera Search.
- Elige quién responde en **Settings** > **General** > **Search and Professor Mari settings** > **Quick answers** (Respuestas breves) > **Answer with** (Responder con): un modelo local que hayas descargado, **Same as Prof. Mari** (la conexión que usa ella) u otra conexión. Cada respuesta es una solicitud breve. Una conexión de pago puede costar dinero.
- Si una respuesta falla, la tarjeta dice por qué, por ejemplo que el modelo no respondió. **Try again** (Intentar de nuevo) y **Continue with Prof. Mari** siempre están disponibles. **Choose a model** (Elegir un modelo) solo aparece cuando falta una API key o un modelo. El mensaje del propio proveedor está en **Details** (Detalles).
- Las respuestas breves están desactivadas hasta que las actives con **Quick answers in Search** en el mismo grupo.

## Chips de sugerencia guiada

En un chat vacío de Professor Mari, los chips iniciales como **Create a Character** (Crear un personaje), **Create a Lorebook** (Crear un lorebook) y **Create a Persona** (Crear una persona) ayudan a empezar tareas comunes. Durante una creación o edición guiada, los chips cambian para coincidir con el siguiente paso. Al hacer clic en un chip se rellena el borrador de la entrada; puedes editar ese borrador antes de enviarlo.

Los flujos guiados hacen una pregunta enfocada cada vez, en lugar de presentar un formulario largo de golpe.

Ante una solicitud completa de creación o edición, Professor Mari puede devolver un plan guiado acotado. Cada paso tiene un pequeño conjunto de sugerencias. Al seleccionar una, se rellena el borrador actual y el plan avanza localmente. Tu texto se mantiene en el borrador cuando cambias de sugerencia. El plan pertenece al chat actual de Professor Mari, así que cambiar de chat, reiniciar, detener una ejecución o completar el plan borra los pasos obsoletos. Las sugerencias mal formadas o excesivas se descartan, y los chips se desactivan mientras Professor Mari trabaja.

Las sugerencias solo están disponibles en los chats de Professor Mari. Los demás personajes no reciben los chips de Professor Mari.

## También puede leer y editar los propios archivos de la app

Professor Mari puede mirar dentro de los propios archivos de programa de Marinara, cambiarlos y ejecutar comandos en un entorno aislado. Esta es una capacidad real y potente, así que vale la pena entenderla con claridad.

Aquí está el límite de confianza en términos sencillos:

- Sus herramientas de archivos permanecen dentro de la carpeta donde está instalado Marinara. Los comandos de shell sin procesar pueden leer el área de trabajo y los programas del sistema necesarios, pero no pueden leer tus otros archivos personales.
- Los archivos con secretos de entorno como `.env`, el archivo de clave que protege tus API keys (claves de API) guardadas y los archivos internos de Git no están disponibles para sus herramientas de archivos ni para el shell sin procesar.
- No puede escribir directamente en tu carpeta de datos guardados, donde viven tus personajes y chats, ni con sus herramientas de archivos ni con el shell sin procesar. En su lugar usa el flujo de cambios revisables que se describe abajo.
- Los comandos de shell sin procesar no tienen acceso a la red, no heredan los secretos del servidor y solo pueden escribir archivos ordinarios del área de trabajo y una carpeta temporal privada.
- Puede seguir editando archivos de código normales directamente. Los cambios en manifiestos de dependencias, archivos de bloqueo, lanzadores, instaladores y flujos de CI se preparan y se te muestran antes de que Marinara los aplique.
- Puede leer los archivos compilados de Marinara, las carpetas `dist` desde las que se ejecuta la app, pero no puede crearlos, editarlos, moverlos ni eliminarlos. En su lugar, ella cambia los archivos de código fuente. Solo `mari code check` los vuelve a compilar, dentro del mismo entorno aislado.
- Si un cambio de código necesita una biblioteca pública de npm, solicita un paquete específico como destino. Marinara resuelve `latest` a una versión exacta, muestra la integridad del registro en una tarjeta de revisión, y la instala solo después de que la apruebas. Los scripts de ciclo de vida de los paquetes permanecen desactivados.
- Si Marinara no puede proporcionar su entorno aislado de shell de macOS o Linux, los comandos de shell sin procesar y `mari code check` quedan desactivados. Ella todavía puede usar las herramientas estructuradas más seguras de archivos y de datos de la app.
- Los comandos que ejecuta se detienen por sí solos tras un corto tiempo, así que un comando atascado no puede correr para siempre.

La mayoría de las personas nunca necesitan esto. Existe para que ella pueda inspeccionar o reparar la propia app cuando algo está roto.

## Elegir una conexión

Professor Mari necesita una conexión para pensar. Una conexión enlaza Marinara con un proveedor de IA usando una API key. Una API key (clave de API) es un código secreto de ese proveedor.

Haz clic en el icono de enlace junto al clip para abrir el menú desplegable **Connections** (Conexiones). Elige cualquier conexión de generación de texto que tengas configurada. Si has descargado el modelo local integrado, también aparece aquí como **Local Model (sidecar)**. Si la app conoce el nombre del modelo, ese nombre aparece entre paréntesis en su lugar. Tu elección se recuerda en tu navegador.

Si aún no tienes conexiones, el menú desplegable muestra **Add a connection** (Añadir una conexión) en su lugar. Si intentas enviar un mensaje sin conexión, se abre el panel **Connections** por ti. También ves este mensaje emergente (llamado toast):

> You haven't set up a connection yet! Click the link icon beside the paperclip to select one.

Para un recorrido completo, consulta la guía de conexión enlazada al final.

## Probar el entorno de ejecución Pi (experimental)

Professor Mari puede trabajar de dos maneras. **Classic** (Clásico) es la predeterminada. **Pi** es una prueba que le permite pensar más antes de actuar y resolver tareas más largas.

Para cambiar, abre **Search and Professor Mari settings** y cambia **Runtime** (Entorno de ejecución), debajo de **Permissions mode** (Modo de permisos). El cambio se aplica desde su siguiente respuesta. Tu modo de permisos, las tarjetas de cambios y Undo funcionan igual en ambos.

Pi funciona con todas las conexiones, incluido el modelo local. Si Professor Mari se comporta de forma extraña en Pi, vuelve a Classic.

## Adjuntar archivos

Haz clic en el botón del clip, etiquetado **Attach files** (Adjuntar archivos), para añadir un archivo a tu mensaje.

Acepta imágenes, archivos PDF y archivos de texto comunes como `.txt`, `.md`, `.json`, `.csv` y `.log`. Cada archivo puede pesar hasta 20 MB. Los archivos adjuntos aparecen como chips que puedes quitar encima del cuadro de mensaje antes de enviar.

Para que ella lea una imagen, el modelo de la conexión que elegiste debe admitir la entrada de imágenes.

## Revisar sus cambios

Cuando Professor Mari cambia algo, guarda el cambio de inmediato y muestra una tarjeta de cambios debajo de su respuesta. La tarjeta enumera cada campo que cambió. Una edición de texto muestra las palabras antiguas y las nuevas, y un lorebook muestra sus entradas. Abre **Show all** (Mostrar todo) para ver todos los campos. **Technical details** (Detalles técnicos) muestra el comando sin procesar.

La tarjeta tiene una sola acción:

- **Undo** (Deshacer) vuelve a poner la versión guardada anterior. Todos los cambios se pueden deshacer, en cualquier modo de permisos. El modo de permisos solo decide si ella pregunta primero.
- Un cambio que no se guardó muestra **Not saved** (No guardado) y el motivo. **Try again** se lo vuelve a pedir.
- La tarjeta muestra **Undo until** (Deshacer hasta) solo durante las últimas 24 horas. Una copia para deshacer dura hasta 14 días, y solo se conservan las 50 más recientes. Después, el cambio se mantiene y la tarjeta dice **Undo closed** (Ya no se puede deshacer).

Un cambio que espera tu decisión es distinto. Un cambio retenido (en modo Manual, o un cambio en un archivo sensible o en una dependencia) muestra **Apply** (Aplicar) y **Don't apply** (No aplicar). Una eliminación muestra **Delete** (Eliminar) y **Put back** (Devolver a su lugar). Search no enumera sus cambios: abre Professor Mari para verlos, aplicarlos o deshacerlos.

- Una tarjeta pertenece al chat de Professor Mari donde hizo el cambio. Un chat nuevo empieza sin las tarjetas de otros chats. Eliminar un chat conserva sus cambios y elimina sus tarjetas. Un cambio hecho con el comando `mari` en una terminal no pertenece a ningún chat, así que su tarjeta aparece en todos los chats de Professor Mari.
- Una edición que dejaría todo igual no se guarda ni recibe tarjeta.
- Professor Mari no puede editar ni eliminar su propia tarjeta de personaje. Marinara la restablece a la versión integrada en cada inicio.
- Los personajes y las personas también conservan su propio historial de versiones dentro de sus editores. Puedes restaurar una versión más antigua ahí como una segunda red de seguridad.

Cuando Professor Mari crea o actualiza un personaje, una persona, un lorebook o un preset, el resultado puede mostrar **Open**. Úsalo para abrir el recurso exacto después de que la app actualice sus datos. Un resultado actualizado también puede mostrar **Review** (Revisar) cuando hay una revisión pendiente. **Review** abre los controles del cambio pendiente. Los elementos nuevos normalmente no tienen revisión porque no se sobrescribió ningún elemento existente.

Dos cambios de mayor riesgo esperan en lugar de aplicarse primero:

- **Sensitive file changes** (Cambios en archivos sensibles) muestran la ruta y el contenido propuesto con **Apply change** (Aplicar cambio) y **Discard** (Descartar). Esto cubre archivos de dependencias, lanzadores, instaladores y flujos de CI. Las ediciones ordinarias de TypeScript, React, CSS, prompt, rutas y documentación siguen disponibles sin esta barrera adicional.
- **Dependencies** (Dependencias) muestran el paquete público exacto de npm, la versión, el área de trabajo destino, el tipo de dependencia, la integridad del registro y las dependencias directas declaradas, con **Install** (Instalar) y **Not now** (Ahora no). Los comandos de instalación sin procesar como `npm`, `pnpm`, `yarn`, `pip` y similares están bloqueados dentro de su shell, incluidas las instalaciones en caché.

Aprobar una biblioteca significa confiar en su código cuando Marinara luego la importa o la ejecuta. Desactivar los scripts de ciclo de vida evita la ejecución en el momento de la instalación, pero no puede hacer que una biblioteca sea inofensiva en tiempo de ejecución.

## Crear contenido con Decisions

Professor Mari puede escribir **Activation questions** (preguntas de activación) para agentes, declaraciones **Decision** en entradas de lorebook y prompts condicionales en presets, tarjetas, lorebooks y prompts de agentes. Antes de introducir estas funciones, comprueba qué Decision model está seleccionado. Tener un modelo seleccionado es información de configuración, no prueba de que el proveedor sea accesible ni de que un modelo local vaya a cargarse correctamente.

Si no tienes un Decision model seleccionado, mantiene las creaciones y ediciones ordinarias libres de dependencias Decision nuevas. El contenido Decision existente permanece intacto durante ediciones no relacionadas. Si pides explícitamente contenido Decision, explica el respaldo pertinente y pregunta una vez en ese chat de Professor Mari si debe continuar. Su registro persiste al reabrir el chat y en conversaciones más largas que su ventana de mensajes recientes. Una pregunta sin responder o un rechazo no son permiso.

Puedes decirle: **"Stop reminding me to set up a Decision model."** Deja de recordarlo en el chat actual y puede guardar la preferencia como Memory. Usa **Turn on** (Activar) para aplicarla también en chats futuros. Desactivar o borrar esa Memory elimina la preferencia permanente. Silenciar los recordatorios de configuración no la invita a añadir Decisions a peticiones ordinarias.

Con un modelo seleccionado, sigue tus Memories y Skills pertinentes y activadas. Si no incluyen una preferencia de creación, pregunta si quieres usar Decisions y si debe recordar la respuesta. Puedes permitirlas, rechazarlas o aprobarlas solo para la tarea actual. Una Skill que solo explica la sintaxis Decision no cuenta como permiso. Una petición directa como "add Decision activation to this entry" ya autoriza esa tarea.

Su comportamiento predeterminado es usarlas con moderación y un control de tiempo adecuado: **Sticky** o **Cooldown** para entradas de lorebook, **Trigger Cadence** para activación de agentes y `sticky`, `cooldown` o `every` en condiciones de prompt. Sticky y Cooldown reducen las comprobaciones repetidas después de una activación positiva; no evitan repetirlas mientras una declaración siga respondiendo no. `every` omite comprobaciones entre los turnos programados y entonces se interpreta como no, así que no siempre conviene a sucesos fugaces.

Professor Mari también intenta mantener estable el inicio del prompt ensamblado. Pregunta antes de añadir contenido cambiante al principio o insertar contexto dentro del historial, salvo que tus instrucciones o preferencias activadas ya permitan esa ubicación. No existe una regla universal de "seguro después de 1.000 tokens": la reutilización de caché depende del proveedor, modelo y prefijo procesado coincidente. Aprobar el uso de Decision no aprueba automáticamente estas ubicaciones.

Los controles habituales del modo de permisos y de revisión siguen aplicándose a sus ediciones. Las Memories que guarda empiezan desactivadas hasta que las actives. Para saber qué ve cada función Decision, sus respaldos y ejemplos, consulta [Modelos de decisión](../connections/decision-models.md), [Prompts condicionales](../prompts/conditional-prompts.md), [Agentes personalizados](../agents/custom-agents.md#activation-questions) y [Entradas de lorebook](../lorebooks/entries.md#decision-activation).

## Custom Skills

Un Skill es un breve documento de instrucciones que escribes para cambiar cómo maneja Professor Mari cierto tipo de solicitud.

Haz clic en el botón **Skills** en la cabecera de su chat para abrir el panel **Professor Mari skills** (Skills de Professor Mari). Desde ahí puedes:

- Hacer clic en **New** (Nuevo) para empezar un Skill a partir de una plantilla.
- Hacer clic en **Upload** (Subir) para añadir un Skill desde un archivo `.md` o `.txt`.
- Activar o desactivar cada Skill. Un Skill que está desactivado sigue existiendo pero no se usa.
- Seleccionar un Skill para editar su **Name** (Nombre), **Description** (Descripción) e **Instructions** (Instrucciones), y luego hacer clic en **Save** (Guardar). Haz clic en **Delete** (Eliminar) para quitarlo.

Cuando aún no tienes ningún Skill, el panel muestra **No custom skills yet** (Aún no hay skills personalizados).

## Memorias guardadas

Professor Mari puede recordar tus preferencias fijas para que no tengas que repetirlas en cada conversación: cómo te gusta que se formateen tus lorebooks o tus tarjetas de personaje, tus convenciones de nombres, o cómo quieres que se comporte ella.

Hay dos formas de darle una memoria:

- **Díselo.** Escribe algo como "recuerda que siempre pongo como palabra clave de las entradas de lorebook el nombre del personaje y su apodo". Ella la guarda y te muestra una tarjeta de cambios con el texto exacto. Una memoria que ella guarda empieza **desactivada**, así que no cambia nada hasta que tú la activas. La tarjeta ofrece **Turn on** para activarla de inmediato.
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

En un teléfono o una pantalla estrecha, se convierte en un pequeño avatar redondo que puedes arrastrar. Tócalo para volver a abrir el chat completo. En una pantalla ancha, aparece una pequeña ventana arrastrable **Ask Prof. Mari**. Cada versión tiene un control para descartar el globo durante el resto de tu sesión.

## Estado de confianza y recuperación

Abre **Aware of** en la cabecera de Professor Mari para ver qué acompaña a tu próximo mensaje, qué se queda en este chat de Professor Mari y cómo trabaja: el modelo con el que responde, el presupuesto de contexto y si sus comandos de shell se ejecutan en un entorno aislado. La cabecera también muestra las aprobaciones pendientes, Skills y Memories. Revísalos antes de una solicitud cuando necesites saber qué puede leer Professor Mari.

Professor Mari mantiene los cambios importantes del área de trabajo detrás de las reglas de aprobación y revisión existentes del servidor. **Aware of** no concede acceso adicional. Los cambios en archivos sensibles, los cambios de dependencias, los límites del shell y la validación de los datos de la app se siguen aplicando en el servidor.

Cuando una solicitud falla, la transcripción conserva el motivo del fallo y muestra **Retry** cuando la solicitud se puede volver a enviar. Corrige primero el problema de conexión, entorno aislado, capacidad o acceso remoto que se muestra, y luego vuelve a intentarlo. Un reintento no empieza en silencio desde una búsqueda, la FAQ o un estado de error. Sigue siendo una acción del usuario.

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

- Sin ninguna respuesta: comprueba la conexión que se muestra en **Aware of** o selecciona una usando el icono de enlace. Si no hay ninguna configurada, abre el panel **Connections** y añade una.
- Un traspaso tiene el elemento equivocado: quita el elemento de contexto, reinicia o cambia al chat correcto de Professor Mari, y vuelve a abrir el traspaso desde el lugar de origen. El contexto se limita al traspaso y al chat actual de Professor Mari.
- Un resultado no aparece en un editor: usa **Open** en la tarjeta del resultado. Puede que Professor Mari completara el comando mientras la lista de recursos estaba desactualizada.
- Una solicitud falla: lee el estado del fallo, corrige el problema de configuración indicado y usa **Retry**. Vuelve a preguntar a Professor Mari desde el origen inicial solo cuando el propio contexto ya no sea correcto.
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
