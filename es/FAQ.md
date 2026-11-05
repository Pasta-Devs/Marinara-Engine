# Preguntas frecuentes

Respuestas cortas a preguntas comunes sobre Marinara Engine. Cada una enlaza con la guía que tiene los pasos completos.

<a id="how-do-i-access-marinara-engine-from-my-phone-or-another-device"></a>

## ¿Cómo accedo a Marinara Engine desde mi teléfono u otro dispositivo?

Marinara se ejecuta como un servidor en una computadora, y lo abres en un navegador. Los scripts de inicio permiten que otros dispositivos lleguen al servidor, pero el control de acceso los bloquea hasta que configures un inicio de sesión (un nombre de usuario y una contraseña) en la computadora anfitriona. Hasta entonces, un dispositivo remoto solo ve una página **Access blocked** (Acceso bloqueado).

1. Mantén Marinara en ejecución en la computadora anfitriona.
2. Encuentra la dirección IP local del anfitrión. En Windows, ejecuta `ipconfig` y lee **IPv4 Address** (Dirección IPv4). En macOS o Linux, ejecuta `hostname -I`.
3. En el otro dispositivo, abre `http://<host IP>:7860` en un navegador, por ejemplo `http://192.168.1.42:7860`. `7860` es el puerto predeterminado.
4. Configura un inicio de sesión. Desde el otro dispositivo, abre Marinara: la página bloqueada tiene un formulario **Setup code** (Código de configuración). Busca el código de un solo uso en el registro del servidor de la computadora anfitriona (en Docker, ejecuta `docker logs <container> 2>&1 | grep "setup code"`) y escríbelo junto con un nombre de usuario y una contraseña nuevos. O bien, en un navegador que ya haya iniciado sesión en el anfitrión, abre **Settings → Advanced → Access** (Configuración → Avanzado → Acceso).
5. Inicia sesión. Para añadir más dispositivos sin escribir la contraseña, usa **Add a device** (Añadir un dispositivo) en **Settings → Advanced → Access**.

En las instalaciones normales de escritorio, la misma computadora (`127.0.0.1`) no necesita contraseña. Un proxy inverso en la misma computadora cuenta como visitante remoto y necesita el inicio de sesión. Para todas las opciones, los códigos de configuración y Docker, consulta [Acceso remoto](REMOTE_ACCESS.md#option-1-login-recommended). Para dispositivos en redes distintas, usa Tailscale: consulta [Conectarte desde cualquier lugar con Tailscale](REMOTE_ACCESS.md#connect-from-anywhere-with-tailscale). Si no puedes conectarte, consulta [Solución de problemas](TROUBLESHOOTING.md).

## ¿Hay una app móvil para Marinara?

No hay una app nativa aparte. En un teléfono o una tableta, usa la app web en un navegador. La mayoría de los navegadores ofrecen **Add to Home Screen** (Agregar a la pantalla de inicio) o **Install App** (Instalar app), que la guarda como PWA (un sitio web que se abre como una app, sin barra del navegador).

En Android también puedes [descargar el APK más reciente](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Ejecuta Marinara en el teléfono mediante Termux. Consulta [Instalación en Android](installation/android-termux.md). En iPhone y iPad, consulta la [Guía de PWA en iOS](installation/ios-pwa.md).

En la app de Android, el lanzador ofrece **Open in browser** (Abrir en el navegador), **Retry connection** (Reintentar conexión) e **Install / Start Marinara**. Para cambiar tu elección más tarde, usa **Settings → General → App Behavior → Open Android launcher (app or browser)** (Configuración → General → Comportamiento de la app → Abrir el lanzador de Android: app o navegador). Los APK anteriores inician sesión de forma manual en `/android-login`.

<a id="can-i-play-with-other-people"></a>

## ¿Puedo jugar con otras personas?

Sí. El multijugador opcional permite que varias personas compartan una misma Conversation, Roleplay o Game. Todos activan el ajuste y luego alojan o se unen. Los invitados no necesitan clave de IA. Una contraseña no vuelve seguro a un anfitrión desconocido. Lee la [configuración, advertencias y límites del multijugador](CONFIGURATION.md#optional-multiplayer) antes de activarlo.

## ¿Cuáles son los tres modos de chat?

- **Conversation** (Conversación): un chat estilo app de mensajería con un personaje.
- **Roleplay**: una escena de historia envolvente con narración y avatares de personajes.
- **Game** (Partida): una aventura de texto dirigida por un game master (director del juego) de IA.

Consulta [Primeros pasos con Marinara Engine](home/welcome.md#choose-a-chat-mode) para elegir uno.

## ¿Cómo cambio la zona horaria que usan los horarios de Conversation?

Abre una Conversation y elige **Schedule timezone** (Zona horaria del horario) en Chat Settings. **Use device** (Usar dispositivo) la restablece a la zona horaria de tu dispositivo. Es un único ajuste global para todos los chats de Conversation, y se sincroniza con otros dispositivos en el mismo servidor. Consulta [Conversation Mode: primeros pasos](conversation/getting-started.md).

## ¿Cada chat de Conversation tiene su propio horario?

No. Un horario pertenece al personaje, así que todos los chats de Conversation con ese personaje lo usan. Edítalo en **Character Editor → Convo → Weekly schedule** (Editor de personajes → Convo → Horario semanal).

Para recibir respuestas instantáneas en un chat, desactiva **Conversation schedules** (Horarios de Conversation) en el Chat Settings de ese chat. Una anulación manual de estado, como **dnd** (no molestar), se sigue aplicando, y pertenece al personaje en todos los chats. Usa **clear** (borrar) para quitarla.

## ¿Necesito una API key para usar Marinara?

Sí, para los servicios de IA en línea. Una **API key** (clave de API) es un código secreto de un servicio de IA que permite a Marinara usar tu cuenta en ese servicio. Necesitas al menos una cuenta antes de poder empezar un chat. Abre **Connections** (Conexiones), haz clic en **Add** (Añadir), elige un servicio, pega tu clave y haz clic en **Connect** (Conectar). Consulta [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md).

Algunas opciones no necesitan clave. Las opciones de suscripción (Claude, ChatGPT y Grok) inician sesión mediante una herramienta de línea de comandos. El **Built-in model** (Modelo integrado) se ejecuta en tu computadora. Consulta [Configuración del modelo integrado](connections/local-model.md).

## ¿Qué proveedores de IA son compatibles?

Marinara admite OpenAI, Anthropic, Google Gemini, OpenRouter y muchos más servicios para generación de texto, imágenes y video, además de servidores **OpenAI-compatible** (compatibles con OpenAI) como Ollama, LM Studio y KoboldCpp. La lista completa está en [Proveedores de IA compatibles](connections/providers-reference.md). Para añadir uno, consulta [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md).

## ¿Tengo que pagar para usar Marinara?

Marinara es gratis. Pagas lo que cobre tu servicio de IA. Algunas opciones no cuestan nada para probar: las imágenes de **Pollinations** no necesitan clave, **Stable Horde** es gratis y el **Built-in model** se ejecuta en tu computadora. Las opciones de suscripción usan un plan de pago que quizá ya tengas.

## ¿Mis API keys están seguras?

Sí. Cada API key se cifra con AES-256 antes de guardarse. Las exportaciones de cuentas y de perfiles dejan fuera los valores secretos, así que vuelve a ingresar tus claves después de usar **Import Profile** (Importar perfil), incluso con un ZIP de copia de seguridad completa. Un ZIP de copia de seguridad completa contiene los registros cifrados y el archivo de clave que los desbloquea, así que mantenlo privado. Consulta [Copia de seguridad y restauración](data/backup-and-restore.md).

## ¿Qué es una tarjeta de personaje?

Una tarjeta de personaje (character card) es el perfil guardado de un personaje de IA: nombre, avatar, personalidad, trasfondo y saludo. Creas tarjetas en el **Character Editor** (Editor de personajes) o las importas de otras apps. Consulta [Crear y editar personajes](characters/creating-and-editing-characters.md).

## ¿Qué es un lorebook, y cómo uso uno con varios personajes?

Un lorebook (libro de trasfondo) es un conjunto de datos del mundo. Cada entrada se suma al prompt (las instrucciones enviadas a la IA) solo cuando sus palabras disparadoras aparecen en el chat. Puedes:

1. Completar **Linked Characters** (Personajes vinculados) o **Linked Personas** (Personas vinculadas) en el editor de lorebook. Entonces funciona en cualquier chat con ellos.
2. Abrir **Chat Settings → Lorebooks → Add Lorebook** (Ajustes del chat → Lorebooks → Agregar lorebook) para adjuntarlo a un solo chat.
3. Limitar entradas individuales a ciertos personajes.

Consulta [Lorebooks](lorebooks/overview.md).

## ¿Qué es un agente?

Un agente es un ayudante de IA opcional que se ejecuta durante un chat para hacer una tarea concreta, como seguir la escena o añadir mapas. Las instalaciones nuevas no tienen ninguno. Abre **Agents → Agent Organizer** (Agentes → Organizador de agentes), elige uno e instálalo. Luego actívalo por chat en **Chat Settings**. Consulta [Agentes](agents/agents-overview.md).

## ¿Cómo configuro Noodle?

Noodle es una red social ficticia y local para tus personajes. Instala **Noodle** desde **Agents → Agent Organizer**, reinicia Marinara cuando se te pida y luego abre **Home → Noodle** (Inicio → Noodle). Consulta [Noodle: la línea de tiempo social dentro de la app](agents/noodle.md).

## ¿Por qué no responde mi personaje?

Normalmente el chat no tiene cuenta ni modelo, la API key es incorrecta o la cuenta se quedó sin crédito. Consulta [Mi personaje no responde](TROUBLESHOOTING.md#my-character-does-not-reply).

## ¿Por qué mi personaje no recuerda mensajes anteriores?

Los modelos solo leen cierta cantidad de texto a la vez, así que los mensajes antiguos quedan fuera en los chats largos. Hay dos herramientas que ayudan. **Memory Recall** vuelve a traer mensajes antiguos relevantes, y los resúmenes comprimen los mensajes antiguos en recapitulaciones. Ambas están en **Chat Settings**. Para chats largos de Roleplay, usa **Advanced Memory Recall** (Recuperación avanzada de memoria) en **Chat Settings → Memory Recall**. Consulta [Memoria y resúmenes](agents/memory.md).

## ¿Cómo hago una copia de seguridad de mis datos?

Abre **Settings → Advanced → Backup & Export** (Configuración → Avanzado → Copia de seguridad y exportación) y haz clic en **Download Backup** (Descargar copia de seguridad). Esto guarda un `.zip` con tus datos y tus archivos subidos. Para restaurarlo, usa **Import Profile (JSON/ZIP)** en **Settings → Imports** (Configuración → Importaciones). La misma sección puede hacer una copia de seguridad diaria, semanal o mensual. Consulta [Copia de seguridad y restauración](data/backup-and-restore.md).

## ¿Cómo funcionan las extensiones, y puedo importar código de terceros?

De forma predeterminada, solo Professor Mari crea borradores de Personal Extension (Extensión personal). Un borrador empieza desactivado, y apruebas su código exacto antes de que se ejecute. Las importaciones de terceros están ocultas hasta que el operador del anfitrión establece `ENABLE_EXTERNAL_EXTENSIONS=true` en `.env` y tú aceptas la advertencia en **Settings → Advanced → Danger Zone** (Configuración → Avanzado → Zona de peligro). Consulta [Extensiones personales](extending/personal-extensions.md).

## ¿Dónde se almacenan mis datos?

En la computadora que ejecuta Marinara, en la carpeta `data` de tu instalación. Nada se almacena en la nube. Consulta [Dónde guarda Marinara tus datos](data/where-data-is-stored.md).

## ¿Perderé mis datos cuando actualice?

No. Actualizar conserva tus personajes, chats y ajustes. Aun así, haz antes una copia de seguridad. Volver a una versión anterior puede hacer que pierdas datos que solo guarda la versión más nueva. Consulta [Actualizar](UPGRADING.md) y [Volver a una versión anterior](UPGRADING.md#downgrading-to-an-older-version).

## ¿Qué puede hacer Professor Mari?

Professor Mari es el asistente integrado en la pantalla de inicio. Explica la app y crea o edita personajes, personas, lorebooks y presets (ajustes guardados) cuando se lo pides. Cada cambio muestra una tarjeta con **Undo** (Deshacer). Consulta [Professor Mari](home/professor-mari.md).

## ¿Qué es el agente Storyboard y cómo lo uso en Game Mode?

Convierte texto de historia ya terminado en imágenes. Instala **Storyboard** desde **Agents → Agent Organizer** y luego actívalo en el chat. Consulta la [Guía del agente Storyboard](game/storyboard.md).

## ¿Los personajes pueden hablar en voz alta en una llamada?

Sí, en el modo Conversation. Necesitas **Text to Speech** (Texto a voz) configurado en **Connections**. Consulta [Llamadas](conversation/calls.md) para ver los pasos, incluido el reconocimiento de voz para tu micrófono.

## ¿Puede Marinara generar imágenes?

Sí. Añade una cuenta de generación de imágenes, como **Pollinations** (no necesita clave) o un servicio de pago. Consulta [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md).

## ¿Cómo leo la documentación dentro de la app?

En la pantalla de inicio, haz clic en **Documentation** (Documentación) en los marcadores. En un teléfono, abre primero el menú de marcadores. En la FAQ de la pantalla de inicio, también puedes hacer clic en **Open Documentation** (Abrir documentación).

## ¿Dónde consigo ayuda o reporto un error?

Empieza con [Solución de problemas](TROUBLESHOOTING.md). En la pantalla de inicio, **Discord** abre el chat de la comunidad y **Support** (Soporte) abre la página de soporte del proyecto. Reporta errores y solicitudes de funciones en la página de GitHub del proyecto.

## Guías relacionadas

- [Solución de problemas](TROUBLESHOOTING.md)
- [Instalación](INSTALLATION.md)
- [Acceso remoto](REMOTE_ACCESS.md)
- [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md)
