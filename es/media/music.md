# Music DJ: Spotify, YouTube y música local

Esta guía explica cómo reproducir música de fondo en Marinara Engine con **Music DJ**. Aprenderás a conectar Spotify, YouTube o tus propios archivos de música local. También aprenderás cómo funcionan el reproductor de música, el creador de listas de reproducción **DJ Mari** y la música de Game Mode.

## Qué es Music DJ

**Music DJ** es un agente descargable opcional. Un agente es un ayudante que se ejecuta de forma automática en segundo plano dentro de un chat. Abre **Agents** (Agentes), elige **Download Agents** (Descargar agentes) e instala **Music DJ** antes de configurarlo. Después de cada respuesta, Music DJ puede leer el ambiente de la escena y reproducir música de fondo acorde.

**Music DJ** puede reproducir música desde tres fuentes:

- **Spotify**: controla la reproducción en tu propia cuenta y dispositivos reales de Spotify.
- **YouTube**: busca en YouTube y reproduce el resultado en un pequeño reproductor dentro de la app. No hace falta iniciar sesión.
- **Custom** (Personalizada): reproduce tus propios archivos de audio desde una carpeta en la máquina que ejecuta Marinara.

Sea cual sea la fuente activa, aparece como un pequeño **Music Player** (Reproductor de música) fijado en la barra superior de la app. En teléfonos y ventanas estrechas se convierte en un pequeño widget redondo flotante que puedes arrastrar.

**Music DJ** está desactivado de forma predeterminada tras la instalación. Lo activas para un chat como cualquier otro agente. Está disponible en chats de **Roleplay** y en el modo **Game** mediante un interruptor aparte (consulta Music DJ en Game Mode más abajo). En el modo **Conversation** usas en su lugar el comando **Music** (consulta El comando Music de Conversation más abajo).

**Music DJ** se configura en un único lugar compartido. Abre el panel lateral **Agents** de la derecha y luego abre **Music DJ**. También puedes hacer clic en el icono de engranaje del minirreproductor. Su tooltip (texto de ayuda) dice **Music DJ setup**.

### Elegir una fuente de música

En el editor de **Music DJ**, el campo **Music Player** tiene tres botones: **Spotify**, **YouTube** y **Custom**. El texto de ayuda dice "Choose which service Music DJ should use for future music picks. The same choice switches the visible player surface."

Debajo de los botones, una línea muestra qué fuente está activa ahora, por ejemplo "Visible player: Spotify. Saved provider: Spotify." Esta elección de fuente se comparte en toda la app. No se guarda por chat.

Aquí tienes una forma rápida de elegir:

| Fuente | Cuenta necesaria | Costo | Ideal para |
|---|---|---|---|
| **Spotify** | Tu propia cuenta de Spotify más Spotify Premium para la reproducción | Gratis configurar, Premium para reproducir | Canciones reales y con nombre en tus propios dispositivos |
| **YouTube** | Una API key gratuita de Google | Gratis | Reproducción sin inicio de sesión y sin Premium |
| **Custom** | Ninguna | Gratis | Tus propios archivos de audio locales |

## Configuración de Spotify

Spotify usa tu propia app de desarrollador de Spotify, que es gratuita. Solo pegas un **Spotify Client ID**. No hay ningún client secret que introducir.

Abre el editor de **Music DJ** y busca el campo **Spotify Connection**. Luego sigue estos pasos.

1. Abre el **Spotify Developer Dashboard** en el enlace que se muestra en la app.
2. Crea una app nueva y elige "Web API".
3. En las Redirect URIs de la app, agrega la dirección de redirección exacta que Marinara te muestra en el paso 3 del cuadro de configuración dentro de la app. Una dirección de redirección es la dirección web a la que Spotify te devuelve después de iniciar sesión.
4. Copia el **Client ID** de tu app de Spotify y pégalo en el campo **Spotify Client ID**.
5. Guarda el agente y luego haz clic en **Connect Spotify Account**.

Se abre una ventana de inicio de sesión y permisos de Spotify. Después de aprobar, la ventana muestra una breve página "Spotify Connected!" y se cierra. De vuelta en Marinara deberías ver una etiqueta verde **Connected to Spotify**. Un botón **Disconnect** elimina la conexión guardada.

La app muestra esta nota: "Requires Spotify Premium. Tokens refresh automatically, no need to reconnect." Una cuenta gratuita de Spotify puede conectarse, pero reproducir, pausar, saltar y controlar el volumen requieren Spotify Premium. Premium es el plan de pago de Spotify.

### Notas sobre dispositivos de Spotify

Spotify reproduce a través de un dispositivo, como tu teléfono, tu app de escritorio de Spotify o un reproductor dentro de la app.

En escritorio puedes convertir la propia pestaña del navegador en un dispositivo de Spotify. Haz clic en el icono de laptop del minirreproductor. Su tooltip dice **Enable Marinara player** o **Use Marinara player**. Esto registra un dispositivo de Spotify llamado "Marinara Engine" para que la música se reproduzca en streaming dentro de la pestaña. El streaming dentro de la app también requiere Spotify Premium.

En móvil, el reproductor prefiere el propio dispositivo de Spotify de tu teléfono. Así que al tocar reproducir, la música suena en tu teléfono, no en la pestaña del navegador en segundo plano.

Si un dispositivo de Spotify no permite el volumen remoto, el control deslizante de volumen se reemplaza por un botón **Use device volume**. Usa en su lugar los propios botones de volumen de tu dispositivo.

### Spotify en otra máquina

Spotify solo acepta direcciones de redirección seguras `https://` o la dirección de bucle invertido (loopback) `http://127.0.0.1`. Loopback significa la misma computadora. Si Marinara se ejecuta en otra máquina por `http` sin cifrar, la ventana de inicio de sesión puede no cargar.

Aquí ayudan dos opciones:

- Mientras te conectas, abre la sección "Browser couldn't reach the callback?" debajo del botón **Connect Spotify Account**. Copia la dirección completa de la ventana que falló y pégala en el cuadro, luego haz clic en **Complete connection**.
- O define una dirección de redirección fija con una variable de entorno en el servidor. Una variable de entorno es un ajuste del servidor que se lee al arrancar.

```
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md) para saber cómo definir variables de entorno.

## Configuración de YouTube

El modo YouTube necesita una API key gratuita de YouTube Data. Una API key (clave de API) es un código secreto que permite a Marinara usar un servicio en tu nombre. No hace falta iniciar sesión en una cuenta de YouTube ni tener Premium.

Abre el editor de **Music DJ** y busca el campo **YouTube Connection**. Luego sigue estos pasos.

1. Abre la **Google Cloud Console** en el enlace que se muestra en la app y crea o elige un proyecto.
2. Activa la **YouTube Data API v3**.
3. Ve a Credentials, luego a Create credentials y luego a API key.
4. Pega la clave en el campo **YouTube Data API Key**.
5. Haz clic en **Save Key**. Una vez guardada, el botón dice **Update Key** y aparece una etiqueta verde "API key configured". Un enlace **Remove** elimina la clave.

Deja la clave sin restricciones, o restríngela solo por API y elige YouTube Data API v3. No la restrinjas por HTTP referrer. La búsqueda se ejecuta en el servidor, así que una restricción por referrer la bloquearía.

La app muestra esta nota: "The free quota (~100 searches/day) is plenty for a personal DJ." Quota (cuota) significa el límite de uso diario. Esta cifra proviene del propio texto de la app y puede cambiar con el tiempo. Tu clave permanece en el servidor y se almacena cifrada.

## Música Custom (local)

El modo Custom reproduce tus propios archivos de audio desde la máquina que ejecuta el servidor de Marinara. Los tipos de archivo admitidos son `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac` y `.webm`.

Abre el editor de **Music DJ** y busca el campo **Custom Music Library**. Tiene un interruptor: **Use Game Assets music folder**.

- Interruptor activado: el modo Custom lee el audio que subiste a Game Assets. Game Assets es la biblioteca de recursos integrada de Marinara para Game Mode. Usa el campo **Game Assets music folder** para elegir una carpeta. Escribe `music` para toda la biblioteca de música, o una subcarpeta como `music/combat`. El botón **Open Folder** abre esa carpeta en la máquina del servidor.
- Interruptor desactivado: el modo Custom lee una carpeta en el dispositivo del servidor. Usa **Select Folder** para abrir un selector de carpetas en la máquina del servidor, o pega la ruta en el campo **Music folder on this device**.

La configuración de chat de Roleplay y Game muestra la misma fuente seleccionada. Si elegiste una carpeta en el dispositivo del servidor, la configuración de Music DJ del chat muestra esa ruta guardada y un botón **Choose Folder** en lugar de pedir una ruta de Game Assets.

Reproducir desde una carpeta fuera de Game Assets requiere acceso local en el servidor. Si usas Marinara desde otro dispositivo sin una contraseña o secreto de administrador, esta función en concreto puede quedar bloqueada. Consulta [Acceso remoto: Basic Auth y lista de IP permitidas](../REMOTE_ACCESS.md).

## Usar el reproductor de música

El **Music Player** aparece como una pequeña etiqueta en la barra superior en escritorio, o como un widget flotante arrastrable en móvil. Puedes ocultarlo o mostrarlo con un ajuste.

Abre **Settings** (Configuración), ve a la pestaña **General** y busca la sección **App Behavior**. Activa o desactiva **Music Player**. El texto de ayuda dice "Shows the compact Music Player. Switch between Spotify, YouTube, and Custom from the player itself or the Music DJ agent settings." Este interruptor siempre está disponible y está activado de forma predeterminada. Si está activado sin Music DJ instalado, el reproductor de escritorio o móvil muestra en su lugar **Download Music DJ Agent to configure** y ofrece un botón **Download Agents**.

En un perfil nuevo la fuente visible empieza como **YouTube**. Puedes cambiar la fuente de tres maneras:

- Usa el pequeño interruptor de fuente redondo del reproductor. Su tooltip dice "Switch to ... player".
- Usa los botones **Music Player** del editor de **Music DJ**.
- Usa la configuración de **Music DJ** de un chat.

El reproductor muestra la carátula o miniatura de la pista actual, el título y el artista o canal. Los controles dependen de la fuente.

- Spotify: aleatorio, **Previous**, reproducir o pausar, **Next**, repetir, un control deslizante de volumen con silencio, el botón **DJ**, el botón de laptop **Marinara player** y el engranaje **Music DJ setup**.
- YouTube: reproducir o pausar, una flecha de expansión que abre un pequeño panel de video 16:9, un botón **Stop** y un control deslizante de volumen con silencio.
- Custom: reproducir o pausar y volumen, usando tus archivos locales.

Si Spotify aún no está conectado, el reproductor dice "Spotify not connected" y al tocarlo se abre **Music DJ setup**.

### Fuente de Spotify por chat

Cuando **Music DJ** se ejecuta en un chat de **Roleplay**, su tarjeta de configuración muestra un menú desplegable **Spotify source** con cuatro opciones.

- **Liked Songs**: elige primero entre tus pistas guardadas.
- **Playlist**: mantén las elecciones dentro de una sola lista de reproducción de Spotify. Un menú desplegable **Playlist** enumera tus listas de reproducción.
- **Artist**: busca solo en torno a un artista con nombre. Aparece un campo de texto **Artist**.
- **Any Spotify**: deja que el DJ use la búsqueda de Spotify cuando encaje.

## DJ Mari: creador de listas de reproducción con IA

El botón **DJ** del minirreproductor de Spotify crea una lista de reproducción temática para ti. Su tooltip dice "DJ Mari composes a playlist for you!"

**DJ Mari** pide a tu modelo de IA conectado que cree una lista de reproducción basada en tu persona, tu personaje más usado y los chats recientes de todas tus conversaciones. Luego agrega las canciones coincidentes a una nueva lista de reproducción de Spotify llamada "DJ Mari" más la fecha de hoy, y empieza a reproducirla.

**DJ Mari** necesita dos cosas:

- Una conexión de modelo asignada al agente **Music DJ**. Sin ella verás "Configure a model connection on the Music DJ agent before using DJ Mari." Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).
- Suficientes canciones coincidentes de Spotify. Necesita al menos 25 canciones y elige hasta 50. Si encuentra menos de 25, te pide que agregues más Liked Songs y lo intentes de nuevo.

Si tiene éxito, verás un mensaje "DJ Mari playlist is ready" con un botón **Open playlist**.

## Music DJ en Game Mode

Game Mode tiene su propia música de fondo integrada desde Game Assets. Para usar **Music DJ** en su lugar, activa el interruptor **Music DJ** en la configuración de Game. Su descripción dice "Use the Music DJ for this game instead of local music assets." Este interruptor está desactivado de forma predeterminada.

Cuando está activado, obtienes las mismas opciones **Spotify**, **YouTube** y **Custom** y los mismos campos por fuente que en Roleplay.

Spotify funciona un poco diferente en Game Mode. Después de cada escena, el servidor crea una lista corta de canciones candidatas reales de tu fuente elegida. Luego la IA elige una canción de esa lista. Esto evita que la IA invente una canción que no existe. Game Mode elige una canción en bucle a la vez.

Abre **Game controls** y elige **Retry Music DJ** para pedir una selección nueva para la escena actual. Funciona en computadoras y teléfonos. Consulta [Los controles del juego](../game/getting-started.md#the-games-controls).

## El comando Music de Conversation

En el modo **Conversation** no puedes agregar **Music DJ** como agente. En su lugar, los personajes pueden reproducir canciones con el comando **Music**.

Abre la sección **Commands** del chat. Activa primero el interruptor maestro **Commands**. Luego activa el interruptor **Music**. Su descripción dice "Let characters play songs through the active Music Player."

Ahora un personaje puede nombrar una canción para Spotify, o describir una pista para YouTube, y Marinara la reproduce a través de la fuente activa. Esto funciona incluso cuando **Music DJ** no está activado en ningún lado. Solo necesita Spotify conectado o una clave de YouTube guardada.

Si Spotify no está conectado o no tiene permiso de reproducción, un comando de canción de Spotify no hace nada y no muestra ningún error. Así que configura tu fuente primero si las canciones no se reproducen.

## Solución de problemas

- El minirreproductor no aparece. Activa **Music Player** en **Settings**, pestaña **General**, sección **App Behavior**.
- Spotify no reproduce nada. El control de reproducción requiere Spotify Premium y un dispositivo de Spotify activo. Abre la app de escritorio en un dispositivo, o haz clic en **Enable Marinara player** en escritorio.
- La ventana de inicio de sesión de Spotify falla en otra máquina. Usa el cuadro para pegar "Browser couldn't reach the callback?", o define `SPOTIFY_REDIRECT_URI` en el servidor.
- La búsqueda de YouTube falla. Confirma que la **YouTube Data API v3** está activada para tu proyecto y que la clave no está restringida por HTTP referrer. Si alcanzas la cuota diaria, inténtalo al día siguiente o usa otra clave.
- La música Custom no se reproduce desde una carpeta de un dispositivo por acceso remoto. Esa carpeta necesita acceso local en el servidor. Consulta [Acceso remoto: Basic Auth y lista de IP permitidas](../REMOTE_ACCESS.md).
- El comando de canción de un personaje no hace nada en el modo Conversation. Conecta Spotify o guarda una clave de YouTube, y asegúrate de que los interruptores **Commands** y **Music** estén activados.

## Guías relacionadas

- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Game Assets](../game/game-assets.md)
- [Modo Conversation: primeros pasos](../conversation/getting-started.md)
