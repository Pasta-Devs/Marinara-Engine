# Preguntas frecuentes

Esta guía responde las preguntas que la gente hace con más frecuencia sobre Marinara Engine. Las respuestas están agrupadas por tema. Cada una enlaza con una guía completa cuando quieras más detalle.

## ¿Cómo accedo a Marinara Engine desde mi teléfono u otro dispositivo?

Marinara Engine se ejecuta como un servidor local en una computadora. Lo abres en un navegador web. Esta respuesta cubre el acceso desde el teléfono, la tableta u otra computadora en la misma red.

Los scripts de inicio (`start.sh`, `start.bat` y `start-termux.sh`) ya enlazan el servidor a todas las interfaces de red (`0.0.0.0`). Otros dispositivos pueden alcanzar el servidor a través de la red, pero el control de acceso los bloquea de forma predeterminada. Hasta que configures el acceso en la computadora anfitriona, un dispositivo remoto solo verá una página **Access blocked** (Acceso bloqueado) con instrucciones de configuración.

Sigue estos pasos:

1. Mantén Marinara en ejecución en la computadora anfitriona.
2. En la computadora anfitriona, configura el control de acceso: Basic Auth (un nombre de usuario y una contraseña) o una lista de IP permitidas (una lista de direcciones de dispositivos de confianza). [Acceso remoto](REMOTE_ACCESS.md) explica cada opción, incluida una excepción para redes privadas de total confianza.
3. Encuentra la dirección IP local de la computadora anfitriona. En Windows, ejecuta este comando y lee la **IPv4 Address** (Dirección IPv4):

```
ipconfig
```

En macOS o Linux, ejecuta este comando:

```
hostname -I
```

4. En el otro dispositivo, abre un navegador web y ve a la IP de tu anfitrión seguida del puerto. El puerto predeterminado es `7860`:

```
http://192.168.1.42:7860
```

Reemplaza `192.168.1.42` por la dirección IP de tu propio anfitrión.

5. Inicia sesión si el navegador pide el nombre de usuario y la contraseña de Basic Auth. Si en su lugar ves una página **Access blocked**, primero completa el paso 2 en el anfitrión.

En las instalaciones normales de escritorio, no necesitas contraseña en la misma computadora (`127.0.0.1`). Las instalaciones de Android gestionadas por el APK añaden un inicio de sesión privado para localhost, de modo que otra app de Android no pueda hacerse pasar por Marinara, pero la envoltura de Android crea y usa esa credencial automáticamente. Otros dispositivos quedan bloqueados hasta que configures el control de acceso (Basic Auth o una lista de IP permitidas). Cada opción se explica en [Acceso remoto](REMOTE_ACCESS.md).

Si los dos dispositivos no están en la misma red, una herramienta como Tailscale puede ayudar. Tailscale le da a cada dispositivo una dirección privada estable. Luego puedes conectarte desde cualquier lugar sin exponer Marinara a la internet pública. Si no puedes conectarte, consulta [Solución de problemas](TROUBLESHOOTING.md).

## ¿Hay una app móvil para Marinara?

No hay una app móvil nativa aparte. En un teléfono o una tableta, usas la misma app web en un navegador. La mayoría de los navegadores móviles ofrecen una opción **Add to Home Screen** (Agregar a la pantalla de inicio) o **Install App** (Instalar app) que hace que se sienta como una app de verdad, sin barra del navegador. Esto se llama PWA (Progressive Web App, un sitio web que puedes instalar como una app).

En Android también puedes [descargar directamente el APK más reciente](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Ejecuta Marinara localmente en el teléfono mediante Termux. La instalación no requiere una clave de firma, contraseña ni secreto de acceso local; consulta [Instalación en Android](installation/android-termux.md) para ver los avisos de permisos de Android. En iPhone y iPad, consulta la [Guía de PWA en iOS](installation/ios-pwa.md).

La envoltura de Android inicia sesión automáticamente al abrir su servidor de Termux gestionado por el APK. La credencial privada solo es visible para quien abre deliberadamente el servidor en otro navegador del mismo teléfono: abre `/android-login`, ejecuta `cat ~/.marinara-engine/android-secret` en Termux y pega el valor que aparece. La CLI local `mari` lee automáticamente ese mismo secreto gestionado por el lanzador. Las instalaciones manuales de Termux conservan las reglas normales de localhost y acceso de red.

## ¿Cuáles son los tres modos de chat?

Marinara tiene tres modos de chat, que se muestran como pestañas cuando abres la lista de chats:

- **Conversation** (Conversación): un chat estilo mensajería o mensaje directo, como escribirle a un personaje en una app de chat.
- **Roleplay**: una escena de historia envolvente con narración, avatares de personajes y arte de personaje opcional.
- **Game Mode** (modo de juego): una aventura de texto guiada dirigida por un game master, con imágenes de escena y video opcionales.

Cada modo tiene su propia guía de inicio. Empieza con el modo que quieras y luego explora sus guías detalladas.

## ¿Cómo cambio la zona horaria que usan los horarios de Conversation?

Abre una Conversation y elige **Schedule timezone** (Zona horaria del horario) en Chat Settings, o elígela mientras creas horarios en el flujo de configuración de Conversation. Marinara empieza con la zona horaria que informa tu dispositivo, pero puedes seleccionar cualquier zona horaria IANA compatible o elegir **Use device** (Usar dispositivo) para restablecerla. Esta es una preferencia global para todos los chats de Conversation, incluidos los mensajes autónomos del lado del servidor, y se sincroniza con otros dispositivos conectados al mismo servidor de Marinara.

## ¿Necesito una API key para usar Marinara?

Casi siempre, sí. Una **connection** (conexión) es un enlace guardado que le dice a Marinara cómo alcanzar un servicio de IA: qué proveedor, qué modelo y tu acceso a él. Una **API key** (clave de API) es un código secreto, un poco como una contraseña. La obtienes de un proveedor de IA para que Marinara pueda hablar con ese proveedor por ti.

Necesitas al menos una conexión antes de poder iniciar cualquier chat. Para crear una, abre el panel **Connections** (Conexiones), haz clic en **New** (Nuevo), elige un proveedor, pega tu **API Key** y elige un modelo. Para el recorrido completo, consulta [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md).

Algunos proveedores no usan una API key en absoluto. Las opciones de suscripción (Claude, ChatGPT y Grok) inician sesión mediante una herramienta de línea de comandos, y el Local Model integrado se ejecuta en tu propia máquina sin clave.

## ¿Qué proveedores de IA son compatibles?

Marinara admite muchos proveedores. Eliges uno por conexión.

Para texto de chat y roleplay, las opciones son **OpenAI**, **OpenAI (ChatGPT)**, **Anthropic**, **Claude (Subscription)**, **Grok CLI (Subscription)**, **Google Gemini**, **Google Vertex AI**, **Mistral**, **Cohere**, **OpenRouter**, **NanoGPT**, **xAI / Grok** y **Custom (OAI-Compatible)** para modelos locales o autoalojados como Ollama, LM Studio y KoboldCpp.

Para generación de imágenes, las opciones incluyen **OpenAI (DALL-E)**, **Stability AI**, **Together AI**, **NovelAI**, **OpenRouter Images**, **xAI / Grok Imagine**, **Venice.ai**, **Atlas Cloud**, **Pollinations**, **Stable Horde**, **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **RunPod Serverless (ComfyUI)**, **Draw Things**, **NanoGPT** y **Block Entropy**.

Para generación de video, las opciones son **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **Atlas Cloud**, **Seedance 2.0** y flujos de trabajo locales en formato de API de **ComfyUI**.

Puedes guardar muchas conexiones a la vez y asignar una distinta a cada chat. Consulta [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md).

## ¿Tengo que pagar para usar Marinara?

Marinara en sí es gratis y se ejecuta en tu propia computadora. Pagas lo que cobre el proveedor de IA que elijas, que varía según el proveedor y el modelo.

Algunas opciones no cuestan nada para probar. La generación de imágenes de **Pollinations** no necesita clave. **Stable Horde** es gratis, y una clave es opcional para tener prioridad más rápida. El **Local Model** integrado se ejecuta en tu máquina sin clave. Las opciones de suscripción (Claude, ChatGPT y Grok) usan un plan de pago que quizá ya tengas, en lugar de una API key de pago por uso.

## ¿Mis API keys están seguras?

Sí. Cada API key se cifra con AES-256 antes de guardarse en el disco. Las exportaciones de conexión y de perfil eliminan los valores
secretos. Una copia de seguridad completa es distinta: contiene los registros cifrados y, cuando está presente, el archivo de clave de cifrado
necesario para desbloquearlos, así que mantén privados los ZIP de copia de seguridad completa.

Como la importación de perfil deja los valores secretos fuera a propósito, debes volver a ingresar cada API key después de importar un
perfil, incluso cuando usas **Import Profile** (Importar perfil) en un ZIP de copia de seguridad completa. Una restauración manual de la carpeta de datos completa conserva
las claves cifradas cuando también se restaura su archivo de clave de cifrado correspondiente.

## ¿Qué es una tarjeta de personaje?

Una **character card** (tarjeta de personaje) es el perfil guardado de un personaje de IA: su nombre, avatar, personalidad, trasfondo y saludo inicial. Creas y editas tarjetas en el **Character Editor** (Editor de personajes). También puedes importar tarjetas hechas en otras apps. Consulta [Crear y editar personajes](characters/creating-and-editing-characters.md).

## ¿Qué es un lorebook, y cómo uso uno con varios personajes?

Un **lorebook** (libro de trasfondo) es un conjunto de entradas de World Info. Cada entrada agrega datos al prompt solo cuando sus palabras disparadoras aparecen en el chat. Esto ahorra tokens y mantiene el trasfondo coherente. Hay tres maneras de delimitar el alcance de un lorebook. Elige la que te convenga:

1. Vincúlalo a personajes o personas. En el editor de lorebook, completa **Linked Characters** (Personajes vinculados) o **Linked Personas** (Personas vinculadas). El lorebook se activa entonces en cualquier chat que incluya un personaje vinculado o use una persona vinculada. Ambos campos aceptan más de una entrada, así que agrega todos los personajes que quieras.
2. Adjúntalo a un solo chat. Abre **Chat Settings** (Ajustes del chat), encuentra la sección **Lorebooks** y usa **Add Lorebook** (Agregar lorebook). Usa esto cuando el trasfondo pertenezca a un chat específico.
3. Filtra entradas individuales por personaje. Dentro de un lorebook compartido, puedes marcar cada entrada para que se dispare solo cuando ciertos personajes estén presentes. Esto sirve para un lorebook de mundo grande donde algunas entradas son específicas de un personaje.

Para la función completa, consulta [Lorebooks](lorebooks/overview.md).

## ¿Qué es un agente?

Un **agent** (agente) es un ayudante de IA opcional que se ejecuta durante un chat para hacer una tarea específica. Los ejemplos incluyen seguir la escena actual, vigilar la calidad de escritura, agregar mapas o llamadas, o ejecutar un juego de mesa de Conversation. Las instalaciones nuevas no tienen agentes opcionales. Abre el panel **Agents** (Agentes), haz clic en **Download Agents** (Descargar agentes), lee los detalles de un elemento e instálalo. Luego activa los agentes compatibles por chat en **Chat Settings**. Cuando un paquete oficial instalado tiene una actualización compatible, Marinara pregunta antes de descargarla. Elegir **No** mantiene la versión actual y deja disponible **Update** (Actualizar) en Download Agents para más tarde. Si el anfitrión está sin conexión o la verificación falla, la versión instalada sigue funcionando. El catálogo también maneja la eliminación completa de paquetes. Consulta [Agentes](agents/agents-overview.md) y el [repositorio público Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents).

## ¿Cómo configuro Noodle?

Noodle es la red social ficticia y local de Marinara para tus personajes. Abre la pestaña **Noodle** y abre sus **Settings** (Configuración). Invita personajes o carpetas de personajes, elige una conexión de generación en **Refresh** (Actualizar), y luego selecciona **Refresh now** (Actualizar ahora) para generar la primera actividad. También puedes configurar horarios de actualización automática, generación de imágenes, usuarios aleatorios y traspaso a tus chats.

Consulta [Noodle: la línea de tiempo social dentro de la app](noodle/overview.md) y [Configuración de Noodle y traspaso al chat](noodle/settings.md) para las guías completas.

## ¿Por qué mi personaje no recuerda mensajes anteriores?

Los modelos de IA solo pueden retener cierta cantidad de texto a la vez, así que los mensajes antiguos quedan fuera de vista en chats largos. Marinara tiene dos sistemas de memoria que ayudan:

- **Memory Recall** busca en mensajes anteriores y agrega discretamente las partes más relevantes de nuevo al prompt. Actívalo en **Chat Settings**, bajo **Memory Recall**.
- Los resúmenes comprimen los mensajes antiguos en recapitulaciones breves. Los chats de Roleplay usan **Chat Summary**, y los chats de Conversation usan **Automatic Summarization** (Resumen automático).

Para la configuración y los detalles, consulta [Memoria y resúmenes](agents/memory.md).

## ¿Cómo hago una copia de seguridad de mis datos?

Abre **Settings**, ve a la pestaña **Advanced** (Avanzado), encuentra la sección **Backup & Export** (Copia de seguridad y exportación) y haz clic en **Download Backup** (Descargar copia de seguridad). Esto guarda un solo archivo `.zip` con tus datos y tus archivos subidos. Para restaurarlo más tarde, usa **Import Profile (JSON/ZIP)** en **Settings**, bajo la pestaña **Imports** (Importaciones), y elige el mismo `.zip`.

También puedes activar una copia de seguridad automática rotatoria diaria, semanal o mensual en la misma sección. Los ZIP de copia de seguridad completa pueden
contener los registros cifrados y el archivo de clave necesario para desbloquearlos, así que mantenlos privados. **Import Profile** aún
deja en blanco los secretos del proveedor, así que vuelve a ingresar las claves después de importar. Para la guía completa, consulta
[Copia de seguridad y restauración](data/backup-and-restore.md).

## ¿Cómo funcionan las extensiones, y puedo importar código de terceros?

De forma predeterminada, solo Professor Mari puede crear un borrador de Personal Extension (Extensión personal) para ti. Empieza desactivado, y debes inspeccionar su código y aprobar el hash SHA-256 exacto antes de que se ejecute.

De forma predeterminada, el código del navegador usa un Worker dedicado dentro de un iframe de origen opaco. Además de capacidades limitadas de registro, almacenamiento privado, temporizadores, limpieza e interfaz declarativa, recibe los identificadores opacos del chat activo y de los personajes, para que extensiones como Notepad puedan mantener un estado propio de cada chat. Una Browser Extension puede solicitar por separado instantáneas acotadas solo de las tarjetas de personaje que participan en ese chat o de la persona elegida para él. Esos permisos se muestran durante la aprobación por hash exacto; sin ellos, los registros correspondientes no están presentes. Las extensiones con sandbox nunca reciben mensajes, bibliotecas completas de personajes o personas, campos no declarados, metadatos del chat, acceso al DOM, acceso a la red ni APIs de modificación. El código del servidor se ejecuta en un proceso separado con sandbox del sistema operativo en anfitriones macOS y Linux compatibles, y no recibe el contexto del chat del navegador.

Las importaciones de terceros están ocultas de forma predeterminada. El operador del anfitrión debe establecer `ENABLE_EXTERNAL_EXTENSIONS=true` en `.env`, y luego el usuario debe aceptar la advertencia en **Settings → Advanced → Danger Zone**. Hasta que ambas puertas estén abiertas, los registros externos —incluidos los registros almacenados manualmente y los importados de un perfil— no aparecen, no se pueden aprobar y no se pueden ejecutar.

Una External Extension puede solicitar **Full page access** (Acceso completo a la página) cuando la compatibilidad con código antiguo realmente necesita el DOM de Marinara. Esto no tiene sandbox: el código exacto aprobado se ejecuta dentro de la página de Marinara y puede acceder al contenido de la página, al almacenamiento del navegador, a las APIs de red y a la sesión actual del mismo origen. Los borradores de Professor Mari no pueden solicitarlo. Actívalo solo después de inspeccionar esa versión exacta y confiar en ella; recarga la página después de desactivarla si quedan cambios sin registrar. Consulta [Extensiones personales](extending/personal-extensions.md).

## ¿Dónde se almacenan mis datos?

Todo vive en la computadora que ejecuta Marinara, dentro de la carpeta `data` de tu instalación. Tus personajes, chats, personas, lorebooks, presets y configuración se guardan todos ahí. Nada se almacena en la nube. Consulta [Dónde se almacenan tus datos](data/where-data-is-stored.md).

## ¿Perderé mis datos cuando actualice?

No. Actualizar Marinara mantiene tus personajes, chats y configuración en su lugar. Aun así es inteligente hacer una copia de seguridad antes de una actualización grande, por si acaso. Para los pasos de actualización en cada plataforma, consulta [Actualizar](UPGRADING.md).

## ¿Qué puede hacer Professor Mari?

Professor Mari es el asistente integrado en la pantalla de inicio. Ábrela con el botón **Ask Professor Mari** (Preguntar a Professor Mari). Puede explicar la app y ayudar con la configuración. También puede crear o editar tus datos cuando se lo pides en lenguaje sencillo: personajes, personas, lorebooks, presets de prompt (plantillas de instrucciones guardadas) y chats nuevos.

También muestra chips de sugerencia de respuesta rápida encima del campo de entrada para guiar la creación y las ediciones de varios pasos sin obligarte a escribir cada detalle a mano.

Cuando cambia tus datos, aparece una tarjeta de revisión con los botones **Keep** (Conservar) y **Restore** (Restaurar), para que puedas deshacer cualquier cosa que no quieras. Es una ayudante, no un reemplazo de estas guías cuando algo depende de la versión. Para la lista completa de lo que puede hacer, consulta [Professor Mari](home/professor-mari.md).

Professor Mari todavía puede editar archivos fuente ordinarios de Marinara. Los archivos de dependencias, los lanzadores, los instaladores y los flujos de trabajo de CI esperan una revisión explícita. Si su cambio necesita una librería pública de npm, Marinara muestra la versión resuelta exacta y la integridad del registro antes de instalarla con los scripts de ciclo de vida desactivados.

Nota: en una dirección remota ordinaria, las acciones de Professor Mari que cambian datos necesitan tanto Basic Auth como un secreto de administrador. Las rutas de red de confianza o en lista permitida pueden usar las excepciones descritas en [Acceso remoto](REMOTE_ACCESS.md).

## ¿Qué es el agente Storyboard y cómo lo uso en Game Mode?

El agente descargable **Storyboard** (secuencia de viñetas) convierte texto de historia ya terminado en una secuencia ordenada de imágenes de fotogramas clave y puede animar cada fotograma clave para convertirlo en un clip corto. En **Game Mode**, hace el storyboard de un turno de narración del GM (director del juego) ya terminado y muestra los fotogramas en un visor flotante o como fondo del Game. En **Roleplay**, combina los intercambios recién terminados en un episodio que se muestra dentro del chat.

Para usarlo en Game Mode, instala **Storyboard** desde **Agents > Download Agents**. Abre el Game, ve a **Chat Settings > Agents**, activa **Enable Agents** (Activar agentes) y **Enable Storyboards** (Activar storyboards), y selecciona una conexión de imagen en el Game o en la configuración global de Storyboard. Termina un turno de narración del GM y luego abre la **Gallery** (Galería) y haz clic en **Create storyboard** (Crear storyboard). Usa **View storyboard** (Ver storyboard) para reabrir su visor.

Para los Storyboards automáticos del Game, activa **Automatic Storyboard Illustrations** (Ilustraciones automáticas de storyboard). Activa también **Automatic Storyboard Animations** (Animaciones automáticas de storyboard) y selecciona una conexión de Video Generation cuando quieras clips. La presentación **Storyboard Optimized** del asistente de configuración de partida nueva solo da forma a la narración del GM; no instala ni activa el agente. Para la configuración, los prompts, los visores, el comportamiento de migración y la solución de problemas en Game y Roleplay, consulta la [Guía del agente Storyboard](game/storyboard.md).

## ¿Los personajes pueden hablar en voz alta en una llamada?

Sí, en el modo **Conversation**. Las llamadas de audio y video son una función exclusiva de Conversation. Para escuchar hablar a un personaje, primero configura **Text to Speech** (texto a voz) en el panel **Connections**.

Si quieres responder con tu micrófono y el propio reconocimiento de voz del navegador no es fiable, primero instala **Calls** (Llamadas) desde **Agents > Download Agents**. Luego abre el panel **Connections**, expande la tarjeta **Local Model**, encuentra **Local Speech Model**, elige **Whisper Tiny (Multilingual)** o **Whisper Base (Multilingual)** y haz clic en **Download Whisper**. Desinstalar Calls también elimina sus descargas de Whisper para recuperar espacio en el disco. Para la configuración completa de llamadas, consulta [Llamadas](conversation/calls.md).

## ¿Puede Marinara generar imágenes?

Sí. Agrega una conexión de generación de imágenes, por ejemplo **Pollinations** (no necesita clave) o un proveedor de pago. Marinara puede entonces crear avatares de personajes, arte de escenas, selfies y fotogramas clave del agente Storyboard en Roleplay o Game Mode. Consulta [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md) para agregar una.

## ¿Cómo leo la documentación dentro de la app?

Cada instalación incluye el conjunto completo de guías. Puedes leerlas sin salir de la app:

- En la pantalla de inicio, haz clic en el botón **Documentation** (Documentación) en el pie de página, junto a **Replay Tutorial** (Repetir tutorial).
- En el FAQ de la pantalla de inicio, abre la pregunta de documentación y haz clic en **Open Documentation** (Abrir documentación).

Ambos botones abren el mismo visor dentro de la app. Enumera cada guía y la muestra dentro de Marinara.

## ¿Dónde consigo ayuda o reporto un error?

Empieza con [Solución de problemas](TROUBLESHOOTING.md), que está organizada por síntoma. En el pie de página de la pantalla de inicio, el botón **Discord** abre el chat de la comunidad y el botón **Support** (Soporte) abre la página de soporte del proyecto. Para errores y solicitudes de funciones, usa la página de GitHub del proyecto.

## Guías relacionadas

- [Solución de problemas](TROUBLESHOOTING.md)
- [Instalación](INSTALLATION.md)
- [Acceso remoto](REMOTE_ACCESS.md)
- [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md)
