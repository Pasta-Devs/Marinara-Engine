# Music DJ: Spotify, YouTube y música local

**Music DJ** reproduce música de fondo acorde con tu escena. Esta guía muestra cómo conectar Spotify, YouTube o tus propios archivos de audio, usar el reproductor de música y usar música en Game Mode y Conversation.

## Qué es Music DJ

**Music DJ** es un agente descargable opcional. Un agente es un ayudante que se ejecuta en segundo plano dentro de un chat. Después de cada respuesta, puede leer el ambiente de la escena y reproducir música acorde.

Antes de empezar: abre **Agents** (Agentes), elige **Agent Organizer** (Organizador de agentes) e instala **Music DJ**. Queda desactivado tras la instalación. Actívalo para un chat como cualquier otro agente. Funciona en chats de Roleplay, en Game Mode mediante un interruptor aparte ([Music DJ en Game Mode](#music-dj-in-game-mode)) y en Conversation mediante el comando **Music** ([El comando Music de Conversation](#the-conversation-music-command)).

Reproduce desde tres fuentes.

| Fuente | Cuenta necesaria | Costo | Ideal para |
| --- | --- | --- | --- |
| **Spotify** | Tu propia cuenta de Spotify, y Spotify Premium para reproducir | Gratis configurar, Premium para reproducir | Canciones reales y con nombre en tus propios dispositivos |
| **YouTube** | Una API key (clave de API) gratuita de Google | Gratis | Reproducción sin inicio de sesión y sin Premium |
| **Custom** (Personalizada) | Ninguna | Gratis | Tus propios archivos de audio |

La fuente activa aparece como un pequeño **Music Player** (Reproductor de música) fijado en la barra superior. En teléfonos y ventanas estrechas se convierte en un pequeño widget redondo flotante que puedes arrastrar.

Music DJ se configura en un único lugar compartido. Abre el panel lateral **Agents** de la derecha y luego **Music DJ**. También puedes hacer clic en el icono de engranaje del minirreproductor, cuyo tooltip (texto de ayuda) dice **Music DJ setup**.

### Elegir una fuente de música

En el editor de **Music DJ**, el campo **Music Player** tiene tres botones: **Spotify**, **YouTube** y **Custom**. Una línea debajo muestra qué está activo, por ejemplo "Visible player: Spotify. Saved provider: Spotify." Esta elección se comparte en toda la app; no se guarda por chat. La carpeta desde la que reproduce **Custom** puede ser distinta para cada chat o personaje: consulta [Usar una carpeta distinta para un chat o personaje](#use-a-different-folder-for-a-chat-or-character).

## Configurar Spotify

Spotify usa tu propia app de desarrollador de Spotify, que es gratuita. Solo pegas un **Spotify Client ID**. No hay client secret.

1. En el editor de **Music DJ**, busca **Spotify Connection** (Conexión de Spotify).
2. Abre el **Spotify Developer Dashboard** desde el enlace que se muestra en la app.
3. Crea una app nueva y elige "Web API".
4. En las Redirect URIs de la app, agrega la dirección de redirección exacta que Marinara muestra en el paso 3 del cuadro de configuración dentro de la app. Una dirección de redirección es adonde te envía Spotify después de iniciar sesión.
5. Copia el **Client ID** y pégalo en **Spotify Client ID**.
6. Guarda el agente y luego haz clic en **Connect Spotify Account** (Conectar la cuenta de Spotify).

Se abre una ventana de inicio de sesión y permisos de Spotify. Después de aprobar, muestra una breve página de confirmación y se cierra. Marinara muestra una etiqueta verde **Connected to Spotify**. **Disconnect** (Desconectar) elimina la conexión guardada.

> **Nota:** Spotify Premium (el plan de pago) es necesario para reproducir, pausar, saltar y controlar el volumen. Una cuenta gratuita puede conectarse. Los tokens se renuevan automáticamente.

Si no funcionó: en otra máquina la ventana de inicio de sesión puede fallar (consulta más abajo). Si no es el caso, comprueba que la dirección de redirección coincida exactamente.

### Dispositivos de Spotify

Spotify reproduce a través de un dispositivo, como tu teléfono, la app de escritorio de Spotify o un reproductor dentro de la app.

- En escritorio, haz clic en el icono de laptop del minirreproductor (**Enable Marinara player** o **Use Marinara player**) para convertir la pestaña del navegador en un dispositivo de Spotify llamado "Marinara Engine". El streaming en la pestaña necesita Premium.
- En móvil, el reproductor prefiere el propio dispositivo de Spotify de tu teléfono, así que la reproducción suena en el teléfono y no en una pestaña en segundo plano.
- Si un dispositivo no permite el volumen remoto, el control deslizante se reemplaza por **Use device volume** (Usar el volumen del dispositivo). Usa los propios botones de volumen del dispositivo.

### Spotify en otra máquina

Spotify solo acepta direcciones de redirección seguras `https://` o la dirección de loopback `http://127.0.0.1` (la misma computadora). Si Marinara se ejecuta en otra máquina por `http` sin cifrar, la ventana de inicio de sesión puede fallar. Hay dos soluciones:

- Mientras te conectas, abre "Browser couldn't reach the callback?" debajo de **Connect Spotify Account**. Copia la dirección completa de la ventana que falló, pégala en el cuadro y haz clic en **Complete connection** (Completar la conexión).
- O define una dirección de redirección fija como variable de entorno (un ajuste del servidor que se lee al arrancar):

```text
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).

### Elegir de dónde toma Spotify las canciones (Roleplay)

Cuando Music DJ se ejecuta en un chat de Roleplay, su tarjeta tiene una lista **Spotify source** (Fuente de Spotify).

- **Liked Songs**: elige primero entre tus pistas guardadas.
- **Playlist**: mantente dentro de una sola lista de reproducción, elegida en la lista **Playlist**.
- **Artist**: busca en torno a un artista, escrito en el campo **Artist**.
- **Any Spotify**: deja que el DJ use la búsqueda de Spotify cuando encaje.

## Configurar YouTube

El modo YouTube necesita una API key gratuita de YouTube Data. Una API key es un código secreto que permite a Marinara usar un servicio en tu nombre. No hace falta iniciar sesión en YouTube ni tener Premium.

1. En el editor de **Music DJ**, busca **YouTube Connection** (Conexión de YouTube).
2. Abre la **Google Cloud Console** desde el enlace de la app y crea o elige un proyecto.
3. Activa la **YouTube Data API v3**.
4. Ve a Credentials, Create credentials, API key.
5. Pega la clave en **YouTube Data API Key**.
6. Haz clic en **Save Key** (Guardar clave). El botón pasa a decir **Update Key** (Actualizar clave) y aparece una etiqueta verde "API key configured". **Remove** (Quitar) elimina la clave.

Deja la clave sin restricciones, o restríngela solo por API a YouTube Data API v3. No la restrinjas por HTTP referrer. La búsqueda se ejecuta en el servidor, así que un límite por referrer la bloquearía. La app dice que la cuota gratuita (unas 100 búsquedas al día) basta de sobra para un DJ personal. Esa cifra proviene del texto de la app y puede cambiar. Tu clave permanece en el servidor, cifrada.

## Usar tus propios archivos de música

El modo Custom reproduce archivos de audio desde la máquina que ejecuta Marinara. Los tipos admitidos son `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac` y `.webm`.

En el editor de **Music DJ**, busca **Custom Music Library** (Biblioteca de música personalizada). Tiene un interruptor, **Use Game Assets music folder**.

- **Activado**: el modo Custom lee el audio que subiste a Game Assets, la biblioteca de recursos de Marinara para Game Mode. Usa **Game Assets music folder** para elegir una carpeta. Escribe `music` para toda la biblioteca o una subcarpeta como `music/combat`. **Open Folder** (Abrir carpeta) la abre en la máquina del servidor.
- **Desactivado**: el modo Custom lee una carpeta en el dispositivo del servidor. Usa **Select Folder** (Seleccionar carpeta) para abrir un selector en la máquina del servidor, o pega la ruta en **Default music folder on this device** (Carpeta de música predeterminada en este dispositivo). Todos los chats sin carpeta propia usan esta carpeta.

Reproducir desde una carpeta fuera de Game Assets requiere acceso local en el servidor. Guardar una ruta de carpeta escrita a mano requiere el mismo acceso que el selector de carpetas. Desde otro dispositivo sin inicio de sesión ni secreto de administrador, ambas cosas pueden quedar bloqueadas. Consulta [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md).

<a id="use-a-different-folder-for-a-chat-or-character"></a>

### Usar una carpeta distinta para un chat o personaje

Un chat o un personaje puede tener su propia carpeta de música, para que cada historia suene con su propia banda sonora. La música de la carpeta de un personaje suena en todos los chats donde ese personaje es el único personaje.

1. Abre el chat y luego **Chat Settings** (Ajustes del chat).
2. En los ajustes de **Music DJ**, con el reproductor **Custom** seleccionado, abre **Apply to** (Aplicar a) y elige dónde se guarda la carpeta.
3. Haz clic en **Choose Folder** (Elegir carpeta), o pega la ruta en **Music folder on this device** (Carpeta de música en este dispositivo).

| Apply to | Qué chats usan la carpeta |
| --- | --- |
| **This chat** (Este chat) | Solo este chat. Una rama empieza con la misma carpeta y puede cambiarla. |
| El nombre del personaje | Todos los chats donde ese personaje es el único personaje. Solo aparece en un chat con un único personaje. |
| **All chats (default)** (Todos los chats: predeterminado) | Todos los chats sin carpeta propia. Es la carpeta predeterminada del editor de **Music DJ**. |

Music DJ usa la primera carpeta que encuentra: la de este chat, luego la del personaje y luego la predeterminada. Un chat grupal nunca usa la carpeta de un personaje. La carpeta de un chat o de un personaje se usa incluso cuando la fuente predeterminada es Game Assets.

**In use:** muestra la carpeta de la que este chat reproduce música y de dónde viene: **This chat**, **From** y el nombre del personaje, o **Default**.

- **Use default** (Usar la predeterminada) quita la carpeta de este chat. El chat pasa entonces a usar la carpeta del personaje o la predeterminada.
- **Unlink from** (Desvincular de) seguido del nombre del personaje quita la carpeta del personaje de todos los chats.

La misma opción **Apply to** aparece cuando agregas Music DJ a un chat. La carpeta propia de un chat queda fuera de las exportaciones de chats, los perfiles de ajustes y los archivos de **Export Profile** (Exportar perfil). Las exportaciones de agentes dejan fuera la carpeta predeterminada y las de los personajes. Cada ruta apunta a archivos de este servidor, así que no significa nada en otro.

## Usar el reproductor de música

El **Music Player** es una etiqueta en la barra superior en escritorio y un widget arrastrable en móvil. Para mostrarlo u ocultarlo, abre **Settings → General → App Behavior** (Configuración → General → Comportamiento de la app) y activa o desactiva **Music Player**. Está activado de forma predeterminada. Si está activado y Music DJ no está instalado, el reproductor dice **Download Music DJ Agent to configure** y ofrece un botón **Agent Organizer**.

En un perfil nuevo, la fuente empieza como **YouTube**. Cámbiala con el interruptor de fuente redondo del reproductor (tooltip "Switch to ... player"), los botones **Music Player** del editor o los ajustes de **Music DJ** de un chat.

El reproductor muestra la carátula o miniatura de la pista, el título y el artista o canal. Los controles dependen de la fuente.

- **Spotify**: aleatorio, **Previous**, reproducir o pausar, **Next**, repetir, volumen con silencio, **DJ**, el botón de laptop **Marinara player** y el engranaje **Music DJ setup**. Cuando Spotify no está conectado, el reproductor dice "Spotify not connected" y al tocarlo se abre **Music DJ setup**.
- **YouTube**: reproducir o pausar, una flecha que abre un pequeño panel de video 16:9, **Stop** y volumen con silencio.
- **Custom**: reproducir o pausar y volumen.

## DJ Mari: creador de listas de reproducción con IA

El botón **DJ** del minirreproductor de Spotify ("DJ Mari composes a playlist for you!") crea una lista de reproducción temática. DJ Mari pide a tu modelo de IA conectado que la cree a partir de tu persona, tu personaje más usado y los chats recientes de todas las conversaciones. Agrega las canciones coincidentes a una nueva lista de reproducción de Spotify llamada "DJ Mari" más la fecha de hoy, y empieza a reproducirla.

Necesita dos cosas.

- Un modelo asignado al agente **Music DJ**. Sin él verás "Configure a model connection on the Music DJ agent before using DJ Mari." Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).
- Al menos 25 canciones coincidentes de Spotify. Elige hasta 50. Si hay menos de 25, te pide que agregues más Liked Songs y lo intentes de nuevo.

Si tiene éxito, verás "DJ Mari playlist is ready" con un botón **Open playlist** (Abrir la lista de reproducción).

<a id="music-dj-in-game-mode"></a>

## Music DJ en Game Mode

Game Mode tiene su propia música de fondo desde Game Assets. Para usar Music DJ en su lugar, activa el interruptor **Music DJ** en la configuración de Game ("Use the Music DJ for this game instead of local music assets"). Está desactivado de forma predeterminada. Entonces obtienes las mismas opciones **Spotify**, **YouTube** y **Custom** y los mismos campos que en Roleplay.

Con Spotify, después de cada escena el servidor crea una lista corta de canciones candidatas reales de tu fuente elegida, y la IA elige una. Esto evita que invente una canción. Game Mode reproduce una canción en bucle a la vez. Para obtener una selección nueva para la escena actual, abre **Game controls** (Controles del juego) y elige **Retry Music DJ** (Reintentar Music DJ). Consulta [Los controles del juego](../game/getting-started.md#the-games-controls).

<a id="the-conversation-music-command"></a>

## El comando Music de Conversation

En Conversation no puedes agregar Music DJ como agente. En su lugar, los personajes reproducen canciones con el comando **Music**.

1. Abre la sección **Commands** (Comandos) del chat y activa el interruptor maestro **Commands**.
2. Activa **Music** ("Let characters play songs through the active Music Player").

Entonces un personaje puede nombrar una canción para Spotify, o describir una pista para YouTube, y Marinara la reproduce a través de la fuente activa. Esto funciona incluso cuando Music DJ no está activado en ningún lado. Solo necesita Spotify conectado o una clave de YouTube guardada. Si Spotify no está conectado o no tiene permiso de reproducción, un comando de canción de Spotify no hace nada y no muestra ningún error.

## Solución de problemas

- **El minirreproductor no aparece**: activa **Music Player** en **Settings → General → App Behavior**.
- **Spotify no reproduce nada**: la reproducción necesita Spotify Premium y un dispositivo de Spotify activo. Abre la app de escritorio en un dispositivo, o haz clic en **Enable Marinara player** en escritorio.
- **La ventana de inicio de sesión de Spotify falla en otra máquina**: usa el cuadro para pegar "Browser couldn't reach the callback?", o define `SPOTIFY_REDIRECT_URI` en el servidor.
- **La búsqueda de YouTube falla**: confirma que **YouTube Data API v3** está activada para tu proyecto y que la clave no está restringida por HTTP referrer. Si alcanzas la cuota diaria, inténtalo al día siguiente o usa otra clave.
- **La música Custom no se reproduce desde una carpeta de un dispositivo, o una ruta de carpeta escrita a mano no se guarda, por acceso remoto**: ambas cosas necesitan acceso local en el servidor. Consulta [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md).
- **Un chat reproduce música de la carpeta equivocada**: revisa **In use:** en los ajustes de **Music DJ** del chat. **This chat** tiene prioridad sobre la carpeta del personaje, así que haz clic en **Use default** para volver a seguir al personaje.
- **El comando de canción de un personaje no hace nada en Conversation**: conecta Spotify o guarda una clave de YouTube, y comprueba que los interruptores **Commands** y **Music** estén activados.

## Guías relacionadas

- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Game Assets](../game/game-assets.md)
- [Modo Conversation: primeros pasos](../conversation/getting-started.md)
