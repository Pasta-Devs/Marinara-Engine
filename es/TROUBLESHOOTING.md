# Solución de problemas de Marinara Engine

Esta guía enumera problemas comunes en Marinara Engine y cómo resolverlos. Busca la sección que coincide con tu síntoma y sigue los pasos. Si nada de esto te ayuda, revisa la última sección, Cómo obtener más ayuda.

## Primeras cosas que probar

Muchos problemas se resuelven con dos pasos rápidos.

1. Haz una recarga forzada de la página. Pulsa **Ctrl+Shift+R** en Windows o Linux, o **Cmd+Shift+R** en una Mac.
2. Mira la consola del servidor (la ventana de terminal que ejecuta Marinara) por si aparecen líneas de error en rojo. Esas líneas normalmente nombran el problema real.

Si le vas a pedir ayuda al equipo, activa primero **Debug mode** (Modo de depuración) para que el servidor registre el prompt (las instrucciones enviadas a la IA) y la respuesta. Revisa Cómo obtener más ayuda al final de esta guía.

## Problemas de instalación y arranque

### Windows: error EPERM o de firma de corepack al instalar pnpm

pnpm es el gestor de paquetes que Marinara usa para instalar su código. Si ves `EPERM: operation not permitted` o un fallo de verificación de firma de corepack, corepack no pudo escribir en la carpeta de instalación de Node.

Elige una solución:

1. Haz clic derecho en tu terminal, elige Ejecutar como administrador y vuelve a ejecutar el lanzador.
2. Instala pnpm tú mismo. Ejecuta este comando y luego vuelve a ejecutar el lanzador:

```bash
npm install -g pnpm
```

3. Actualiza corepack en una terminal de administrador y luego vuelve a ejecutar el lanzador:

```bash
npm install -g corepack
```

### Windows: `'pnpm' is not recognized` al compilar el paquete compartido

Marinara v2.3.0 podía iniciar pnpm mediante Corepack correctamente y luego fallar durante la compilación del paquete compartido porque esa compilación intentaba lanzar un segundo ejecutable global de `pnpm`. v2.3.1 elimina ese requisito anidado. Cierra el lanzador que falló y vuelve a ejecutar `start.bat` para que pueda obtener el script de compilación corregido antes de recompilar. No hace falta eliminar tus datos.

Si el propio checkout no puede actualizarse, ejecuta `git pull` en la carpeta de Marinara e inícialo de nuevo. Como solución temporal para v2.3.0, instala el gestor de paquetes fijado de forma global, vuelve a ejecutar el lanzador y luego actualiza normalmente:

```bash
npm install -g pnpm@10.33.2
```

### Linux: ERR_PNPM_ENAMETOOLONG durante la instalación

Esto significa que una instalación anterior dejó rutas de carpeta largas. Desde la carpeta de Marinara, limpia la instalación parcial y vuelve a ejecutar el lanzador:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Luego inicia Marinara de nuevo con `./start.sh`. Si instalas a mano, ejecuta `pnpm install` después de eliminar esas carpetas.

### ERR_PNPM_TRUST_DOWNGRADE durante la instalación

Esto casi siempre es una instalación a medias. Primero vuelve a ejecutar el lanzador para que pueda reparar el espacio de trabajo. Si instalas a mano, ejecuta este único comando desde la carpeta de Marinara:

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Pantalla en blanco, desactualizada o con aspecto antiguo

A veces el servidor está en marcha pero el navegador muestra una página en blanco, o la app parece una versión antigua después de una actualización. En ese caso, tu navegador conserva una copia en caché de la app web.

1. Haz una recarga forzada (**Ctrl+Shift+R** o **Cmd+Shift+R**).
2. Si eso no ayuda, abre **Settings** (Configuración), ve a la pestaña **Advanced**, luego a la sección **Updates** y haz clic en **Refresh App**.

**Refresh App** borra el service worker del navegador (un script en segundo plano que guarda la app web en caché) y la caché del navegador, y luego recarga. No cambia tus datos. Tus chats, tu configuración y otros datos locales quedan intactos. Tampoco actualiza el código del servidor, así que no sustituye a una actualización real. Revisa [Actualizar Marinara Engine](UPGRADING.md) para actualizar la app en sí.

## Problemas con los agentes descargables

Si **Agents → Download Agents** dice que el catálogo no está disponible, la máquina que ejecuta el servidor de Marinara —no solo el navegador— debe poder llegar al catálogo oficial [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) por GitHub HTTPS. Los agentes ya instalados siguen funcionando sin conexión en su versión actual. Restaura la conexión del servidor y luego haz clic en **Refresh** o **Try again** para explorar el catálogo y buscar actualizaciones.

Si un mapa o una llamada ya instalados no aparecen, cierra Marinara Engine por completo e inícialo de nuevo. Esos paquetes que traen rutas permanecen en estado **Restart required** hasta el siguiente arranque del proceso. Los juegos de conversación son distintos: las compilaciones actuales del Engine los activan en caliente de inmediato. Refresca el catálogo si la instalación falló, luego confirma que el juego aparece como listo; añadirlo en la configuración de **Commands** de un chat solo es necesario cuando quieres que los personajes lo inicien por sí mismos, no para el comando slash manual del juego.

Si una instalación más antigua no puede completar su primera migración de paquetes, no elimines la carpeta `data/capability-packages` ni tus datos de chat. Marinara deja la migración incompleta y reintenta en el siguiente arranque. Las selecciones y la configuración de chat existentes permanecen guardadas mientras el catálogo no esté disponible.

Las descargas de paquetes se rechazan cuando su checksum, su lista declarada de archivos, su rango de versiones del Engine o las rutas del archivo comprimido no coinciden con el catálogo oficial. Actualiza primero Marinara Engine, refresca el catálogo y vuelve a intentarlo. No extraigas manualmente un artefacto dentro de la carpeta de datos.

Las actualizaciones de agentes nunca se aplican en el arranque. Cuando hay una versión compatible más reciente, Marinara pregunta si quieres aplicarla. Elige **No** para conservar la versión instalada; el botón **Update** sigue disponible en **Agents → Download Agents**. Una actualización fallida también deja registrada la versión instalada, y un runtime del servidor recién actualizado que falle su autocomprobación de arranque vuelve a la versión anterior.

## Acceder a Marinara desde otro dispositivo

Si no puedes acceder a Marinara desde un teléfono, una tableta u otra computadora de tu red, repasa estas comprobaciones.

- Vincula el servidor a una dirección accesible. El servidor escucha en `127.0.0.1` (loopback, solo tu propia máquina) de forma predeterminada. Los lanzadores de shell fijan `HOST=0.0.0.0` por ti. Si iniciaste con `pnpm start` a mano, fija primero `HOST=0.0.0.0` en tu archivo `.env`.
- Confirma que ambos dispositivos están en la misma red Wi-Fi.
- Confirma que ningún firewall bloquea el puerto. El puerto predeterminado es `7860`, o el que hayas fijado como `PORT`.
- Configura el control de acceso. Para clientes de red normales o públicos, fija `BASIC_AUTH_USER` y `BASIC_AUTH_PASS` en `.env`. Loopback se queda sin contraseña. El tráfico directo por Tailscale y por el puente Docker del mismo host o la puerta de enlace de contenedor detectada es de confianza de forma predeterminada; el tráfico de Docker reenviado por proxy requiere autorización normal salvo que fijes explícitamente `REQUIRE_AUTH_FOR_DOCKER_PROXY=false`.
- Para acciones privilegiadas desde ese dispositivo (copias de seguridad, borrado de datos, actualizaciones), fija `ADMIN_SECRET` en el `.env` del servidor. Luego pega el mismo valor en **Settings** > **Advanced** > **Admin Access** en ese dispositivo y haz clic en **Save**.
- Si usas un dominio público o de proxy inverso y ves **Untrusted request host**, añade su nombre de host exacto a `TRUSTED_HOSTS` en `.env`. Las direcciones IP directas que usan teléfonos, computadoras de la LAN y pares de Tailscale se siguen aceptando automáticamente.

Para el recorrido completo, revisa [Acceso remoto](REMOTE_ACCESS.md) y las [Preguntas frecuentes](FAQ.md).

## Guardado bloqueado, o ajustes que no persisten

Si un guardado parece funcionar pero se revierte al recargar, la protección entre sitios de Marinara lo está bloqueando. La protección CSRF (cross-site request forgery, o falsificación de petición entre sitios) protege las acciones que cambian datos. Solo confía en ciertos orígenes del navegador.

Verás una de estas señales, o ambas:

- Un banner rojo en la parte superior de la pantalla que advierte que los guardados fallarán en silencio porque este origen no es de confianza.
- Un aviso titulado **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** o **Save blocked: origin not trusted**.

Loopback, las direcciones de red privada, Tailscale y el puente Docker son de confianza automáticamente. Esto normalmente solo ocurre cuando llegas a Marinara a través de una dirección IP pública o un nombre de dominio. Añade esa dirección a `CSRF_TRUSTED_ORIGINS` en `.env`. Usa una lista separada por comas para más de una, por ejemplo:

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

No hace falta reiniciar. El banner tiene un botón Copy que rellena la línea exacta por ti. Revisa [Acceso remoto](REMOTE_ACCESS.md) para más información.

## Errores de conexión y de generación

Los errores de generación aparecen como un aviso en la parte inferior de la pantalla. Si una conexión falló, el aviso nombra el motivo. El aviso permanece el tiempo suficiente para leerlo y copiarlo.

- **No API connection configured for this chat**: el chat no tiene ninguna conexión seleccionada. Abre el panel **Connections**, crea una y luego elígela para el chat. Revisa [Conectar a un proveedor de IA](connections/connecting-to-a-provider.md). Una API key (clave de API) es un código secreto de un proveedor que permite a Marinara usar sus modelos.
- El modelo no acepta un parámetro: el aviso te dice cuál. Abre **Chat Settings** (Ajustes del chat) > **Advanced Parameters** y busca ese parámetro. Desactiva el interruptor junto a su nombre (la tooltip, o texto de ayuda, dice "This parameter is sent to the model").
- El modelo dice que un parámetro es obligatorio: haz lo mismo, pero activa el interruptor junto a ese parámetro.
- **The AI returned an empty response. Try sending your message again.**: envía tu mensaje de nuevo. Si sigue pasando, prueba un modelo o una conexión diferentes.
- **A generation is already in progress for this chat**: todavía se está transmitiendo por streaming una respuesta. Espera a que termine o haz clic en el botón Stop, y luego vuelve a intentarlo.
- **No connections are marked for the random pool**: activaste el enrutamiento de conexión aleatorio pero no marcaste ninguna conexión para el grupo. Añade al menos una conexión al grupo, o desactiva el enrutamiento aleatorio.

## Problemas con el Local Model

El **Local Model** (Modelo local) es un modelo de IA que se ejecuta en tu propia máquina sin API key. Algunos mensajes de error usan la palabra sidecar para esta función.

- Si instalar un runtime falla con **Sidecar runtime install is disabled**, el servidor tiene esa acción desactivada por seguridad. En tu propia máquina, fija `SIDECAR_RUNTIME_INSTALL_ENABLED=true` en `.env`. Desde otro dispositivo, pega primero tu admin secret en **Settings** > **Advanced** > **Admin Access**.
- Si la descarga o la configuración del modelo falla desde otro dispositivo (una dirección de red o Docker), también puede necesitar el admin secret. En tu propia máquina no hace falta ningún admin secret. Revisa el punto anterior para saber dónde pegar el secreto.
- Si una comprobación del llama.cpp incluido, de MLX, de uv o del bloqueo de dependencias de MLX informa de un desajuste de tamaño de archivo o de SHA-256, Marinara ya lo descartó o lo rechazó antes de extraerlo o instalarlo. Actualiza o reinstala Marinara y vuelve a intentarlo; no ejecutes, descomprimas, edites ni eludas manualmente el artefacto rechazado.

### Mantenedores: actualizar los runtimes locales fijados

No está garantizado que los archivos de código fuente generados por GitHub sigan siendo estables byte a byte, aunque el contenido de su commit no cambie. Nunca "arregles" el desajuste de un usuario aceptando los bytes que se ven en su máquina ni debilitando la verificación. Vuelve a fijar las entradas de runtime solo dentro de un cambio revisado del Engine:

1. Elige una revisión ascendente inmutable o un recurso de release y revisa los cambios ascendentes.
2. Descarga el artefacto en una carpeta temporal, anota su número exacto de bytes y calcula su resumen SHA-256 de forma independiente.
3. Actualiza `runtime-integrity-manifest.ts` con la revisión, la URL, el tamaño y el resumen. Para MLX, vuelve a generar `packages/server/src/assets/mlx-runtime-requirements.lock` desde su archivo `.in` con la versión fijada de uv en Apple Silicon/Python 3.12, revisa cada cambio de dependencia y actualiza `requirementsLockSha256`.
4. Ejecuta `pnpm regression:runtime-integrity`, `pnpm check` y una instalación limpia y real del runtime en la plataforma afectada.
5. Publica la actualización revisada del Engine antes de pedir a los usuarios que vuelvan a intentarlo. No ofrezcas una anulación manual de la suma de verificación.

Para la configuración completa, revisa [Configuración del Local Model](connections/local-model.md).

## Memoria y resúmenes

### Memory Recall no recuerda nada

**Memory Recall** busca en mensajes anteriores y añade en silencio los más relevantes de vuelta al prompt. Si parece que no recuerda nada, revisa esto.

1. Abre **Chat Settings** > **Memory Recall** y confirma que **Enable Memory Recall** está activado.
2. Abre **Access memories for this chat**. En la ventana **Memories for This Chat**, mira el estado de cada fragmento.
3. Un estado de **Waiting for vector** significa que la memoria todavía se está procesando. Espera y luego vuelve a chatear.
4. Un estado de **Embedding unavailable** significa que no hay ninguna fuente de embedding (representación numérica del texto) funcionando. Configura una conexión de embedding, o deja que se cargue el modelo local integrado. Revisa [Configuración del Local Model](connections/local-model.md).

Una memoria necesita al menos 5 mensajes nuevos antes de crearse. Recall también solo muestra memorias que coinciden de cerca con tu nuevo mensaje, así que puede no devolver nada incluso cuando existen memorias.

### Los resúmenes no se generan

Los resúmenes de chat necesitan una conexión de texto que funcione para escribirlos.

- En el modo Roleplay, abre el panel emergente **Chat Summary** y confirma que hay una conexión establecida. Usa **Backfill Summary** para poner al día un chat más antiguo.
- En el modo Conversation, abre **Automatic Summarization** y usa **Backfill** para reintentar los días que fallaron.
- Si tu chat requiere aprobación de escritura del agente, un resumen de IA espera tu revisión antes de aplicarse.
- Un resumen que sigue fallando (por ejemplo, una API key incorrecta) se reintenta tras un retardo. Corrige la conexión y luego usa **Backfill**.

## Problemas del Card Browser

El **Card Browser** te permite buscar en sitios públicos de personajes e importar personajes. Ábrelo desde el icono **Card Browser** en la barra superior y luego haz clic en **Download Cards**.

- Si la búsqueda de JannyAI o una página de personaje falla con un bloqueo de Cloudflare, Marinara muestra un mensaje. Te pide que visites el sitio de JannyAI una vez en el mismo navegador para superar el desafío, y luego reintentes.
- Si tu inicio de sesión de CharacterTavern o Pygmalion deja de funcionar después de reiniciar el servidor, eso es lo esperado. Esos inicios de sesión viven solo en la memoria del servidor y se borran al reiniciar. Abre la ventana de inicio de sesión y pega tu cookie o token de nuevo.

## Problemas de generación de medios

### La limpieza del fondo del sprite tiene dificultades con una escena compleja

Los sprites (imágenes del personaje) estáticos generados normalmente usan transparencia nativa o una capa chroma plana adaptativa. La limpieza integrada también reconoce capas blancas más antiguas, preserva los detalles encerrados del sujeto, suaviza el borde alfa y elimina el derrame de color de la capa. Una habitación fotografiada, un decorado detallado, sombras marcadas o un sujeto cuyos colores coinciden con el fondo pueden requerir aún la opción de respaldo con IA:

```bash
pnpm backgroundremover:install
```

Luego reinicia Marinara y haz clic en **Reapply Cleanup** en la ventana de generación de sprites. Marinara seguirá probando primero la ruta de capa integrada y usará el modelo de IA solo cuando el borde no se vea uniforme. Si la instalación falla:

- Confirma que tienes Python 3.9 a 3.11 instalado. Las versiones más nuevas de Python pueden forzar compilaciones nativas lentas.
- Recompila la herramienta con `pnpm backgroundremover:reinstall`.
- Para forzar la limpieza automática de capa sin el respaldo con IA mientras solucionas el problema, fija `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` en `.env`.

### Los storyboards del Game Mode o de Roleplay no aparecen

Los Game Mode Storyboards (secuencias de viñetas) convierten una narración terminada del GM (director del juego) en imágenes de fotograma clave y clips opcionales. Los Roleplay Storyboards combinan intercambios terminados y muestran el resultado en línea, después de la respuesta del asistente.

- Confirma que has instalado **Storyboard** desde **Agents** > **Download Agents** y luego activa **Enable Agents** (Activar agentes) y **Enable Storyboards** (Activar storyboards) para el chat.
- Para un video de escena manual, genera o sube primero una imagen de **Gallery** y luego usa su acción **Video** o **Animate**. La **Gallery** separa **Images** y **Videos** en pestañas, así que revisa la pestaña **Videos**.
- Para los Game Mode Storyboards automáticos, abre **Chat Settings** > **Agents** > **Storyboards** y confirma que **Automatic Storyboard Illustrations** está activado. Activa también **Automatic Storyboard Animations** si además quieres clips.
- En Roleplay, añade el agente **Storyboard** al chat. Elige **Still images** o **Animations**, fija **Messages per episode** y selecciona la conexión de imagen del Storyboard. **Manual only** se ejecuta en su lugar desde **Create storyboard** en la Gallery.
- Las imágenes de fotograma clave necesitan una conexión de imagen. Los clips también necesitan una conexión de video.
- Si un prompt personalizado funciona mejor con todos los personajes combinados, desactiva **Use NovelAI Character Prompts**.
- Los proveedores lentos pueden alcanzar un tiempo de espera. Sube `IMAGE_GEN_TIMEOUT_MS` o `VIDEO_GEN_TIMEOUT_MS` en `.env` y luego reinicia Marinara. El servidor solo lee estos valores en el arranque.

Revisa la [Guía del agente Storyboard](game/storyboard.md) para ambos flujos de trabajo y [Game Mode: Primeros pasos](game/getting-started.md) para la configuración del Game.

### La generación del mundo del Game Mode muestra un error de JSON

Si iniciar un juego falla porque el modelo devolvió JSON roto, Marinara abre la ventana **Repair JSON** en lugar de descartar todo el turno. JSON es el formato de texto estructurado que el modelo debe devolver.

1. Corrige los corchetes, las comas o los campos en el editor. El banner dice **JSON is valid.** una vez que el texto se analiza.
2. Haz clic en **Format** para ordenar el diseño.
3. Haz clic en **Apply Repaired JSON** para usarlo sin regenerar toda la respuesta.

## Voz, llamadas y TTS

- Si los personajes no hablan durante una llamada, Text to Speech (texto a voz) no está configurado. Abre **Connections** > **Text to Speech**, actívalo, elige una fuente, introduce tu clave, elige una voz y guarda. Un personaje sin voz aparece solo como texto.
- Si el micrófono no funciona, puede que necesites el modelo de voz local. Instala **Calls** desde **Agents > Download Agents**, luego abre **Connections** > **Local Model**, expande la tarjeta, busca **Local Speech Model**, elige un modelo Whisper y haz clic en **Download Whisper**. Firefox en particular necesita esto porque carece de reconocimiento de voz del navegador. Desinstalar Calls elimina sus modelos Whisper para recuperar espacio en disco.
- En una compilación Lite, el mensaje **Local Whisper is disabled in Lite mode** significa que esa compilación pequeña no puede ejecutar el modelo de voz local. Usa en su lugar una instalación completa de Marinara.

### El inicio de sesión de Spotify del Music DJ falla en una instalación remota o de red

El modo Spotify del agente Music DJ usa OAuth. OAuth es un traspaso de inicio de sesión donde Spotify te envía de vuelta a una dirección de retorno. Una redirect URI es esa dirección de retorno, y Spotify solo acepta direcciones `https://` o la dirección de loopback `http://127.0.0.1`. Rechaza las direcciones IP de red normales.

- Si llegas a Marinara en localhost, el editor muestra un retorno de `127.0.0.1`. Regístralo con Spotify y el inicio de sesión se completa.
- Si llegas a Marinara por HTTPS, el editor muestra tu retorno HTTPS. Regístralo.
- Si HTTPS se termina más arriba y el host no coincide, fija `SPOTIFY_REDIRECT_URI` en `.env` con tu dirección de retorno pública.
- En una instalación de red con HTTP simple, la ventana emergente no puede cargar, pero la barra de direcciones aún contiene un código válido. Copia la URL completa de la ventana emergente. Luego expande **Browser couldn't reach the callback?** debajo del botón Connect y pégala. La URL pegada es válida durante 10 minutos.

La solución más limpia a largo plazo es poner el servidor detrás de HTTPS. Comprobado por última vez con Marinara Engine 2.2.0. Spotify endureció estas reglas en febrero de 2025.

## Almacenamiento y datos

### Los datos parecen faltar después de una actualización

Si tus chats o presets (ajustes guardados) parecen faltar después de una actualización, no elimines todavía ninguna carpeta de datos. Marinara mantiene tus datos activos en una carpeta `storage` dentro de su carpeta de datos.

Revisa estas dos ubicaciones locales por si hay una carpeta `storage`:

1. `packages/server/data/`
2. `data/`

El servidor imprime las carpetas de datos y de storage que resolvió en el arranque.

### La copia de seguridad o la exportación devuelve 403

Las sesiones de loopback pueden hacer copias de seguridad sin un admin secret. Desde otro dispositivo, una dirección de red o Docker, las copias de seguridad y las exportaciones de perfil necesitan más. Fija `ADMIN_SECRET` en el servidor y guarda el mismo valor en **Settings** > **Advanced** > **Admin Access**. Si quieres que loopback también requiera el secreto, fija `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`.

## Android y Docker

### La app de Android se queda en Connecting o Waiting for Server

La app de Android es una pequeña carcasa alrededor de Termux. Termux es una app de terminal Linux para Android, y ejecuta el servidor real de Marinara.

1. Toca **Install / Start Marinara**.
2. Si Android pide instalar Termux, aprueba los avisos.
3. Si Android pide ejecutar comandos en Termux, concédelo.
4. Espera a que el lanzador termine e inicie el servidor, luego vuelve a la app.

Confirma también que la app y Termux usan el mismo puerto. El predeterminado es `7860`. Si compilaste la app con un puerto diferente, fija el `PORT` correspondiente en el `.env` de Termux también.

### Android localhost abre la página de inicio de sesión o devuelve 401/503

Las instalaciones de Termux gestionadas por el APK protegen localhost con un secreto privado por instalación. La app de Android se autentica automáticamente. En otro navegador del mismo teléfono, abre `/android-login` y pega el valor que muestra este comando de Termux:

```bash
cat ~/.marinara-engine/android-secret
```

La CLI local `mari` lee el mismo archivo automáticamente. Un 401 significa que se rechazó el secreto pegado o un desafío de autenticación; vuelve a cargar `/android-login` y pega el valor actual. Un 503 significa que el servidor recibió un secreto configurado con un formato incorrecto. Reinicia mediante `./start-termux.sh`; si el lanzador indica que su archivo de secreto no es válido o está vacío, vuelve a la app de Android y toca **Install / Start Marinara** para que el APK lo aprovisione otra vez. No incluyas este secreto en capturas de pantalla ni en informes de problemas.

### La actualización de Android se detiene con exit status 134

El exit status 134 normalmente significa que Android se quedó sin memoria durante un paso de compilación. Actualiza de nuevo desde el lanzador más reciente:

```bash
./start-termux.sh
```

Si sigue deteniéndose, cierra otras apps de Android, reabre Termux y ejecuta el comando de nuevo.

### Termux se cierra o reinicia mientras Marinara está funcionando

El lanzador solicita un wake lock de Android mientras el servidor funciona y guarda cada sesión del servidor en `~/.marinara-engine/logs/`. Después de un reinicio inesperado, adjunta al informe el archivo `server-*.log` más reciente. Si termina sin un error de Marinara o Node, lo más probable es que Android o el fabricante del teléfono haya terminado Termux fuera del proceso del servidor.

Permite que Termux funcione en segundo plano y quítale la optimización de batería en los ajustes de Android. En dispositivos compatibles con el complemento Termux:API, instala ese complemento y el paquete `termux-api` para disponer de `termux-wake-lock`. Estos ajustes no evitan todos los cierres de procesos específicos del fabricante, pero eliminan la causa habitual de suspensión por inactividad, mientras el registro persistente conserva pruebas de los fallos de la aplicación.

### La actualización de Android se queda sin almacenamiento al instalar dependencias

La app de Marinara compilada no ocupa varios gigabytes, y Noodle no descarga sus propios modelos de IA. Una huella temporal grande durante una actualización normalmente viene del almacén de dependencias y del almacén virtual de pnpm, sobre todo después de varias versiones o de una reinstalación forzada interrumpida.

El lanzador actual poda los paquetes que quedaron de versiones anteriores y evita recompilar el almacén de dependencias más de una vez para la misma actualización. Si un lanzador más antiguo ya llenó el dispositivo, actualiza el lanzador y recupera su caché sin referencias antes de intentarlo de nuevo:

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

No elimines `data`, `storage` ni `marinara-engine.db`; esas ubicaciones pueden contener tus chats y tu configuración. Si el comando sigue deteniéndose, captura las líneas que empiezan en `Installing dependencies` e incluye en el reporte las cifras de espacio libre y de memoria del teléfono.

### La actualización dentro de la app falla al cambiar entre Stable y Staging en Android

Cambiar de canal (Stable ↔ Staging) fuerza una reinstalación casi completa de dependencias, que en el almacenamiento más lento de Termux puede tardar mucho más que una actualización normal. El actualizador dentro de la app ahora concede tiempo extra para cada paso en Android, así que un cambio de canal que antes se detenía con un simple `Update failed: Command failed: corepack pnpm ... install` debería completarse.

Si una actualización sigue fallando, el error ahora nombra el paso que falló e incluye el final de su salida. Lee ese mensaje: un error real de dependencia o de lockfile se reporta ahí. También puedes ejecutar la actualización a mano desde Termux con el comando manual que se muestra en la pista del error, o recuperar espacio primero:

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

### Noodle muestra `Etc/Unknown` o los horarios usan la zona horaria equivocada

Para los horarios de Conversation, abre Conversation Chat Settings o un editor de horario de personaje y elige **Schedule timezone**. Esta selección global se aplica a cada chat de Conversation, incluidos los mensajes autónomos en segundo plano, y se puede restablecer con **Use device**.

Para Noodle o para trabajos del servidor sin una anulación de Conversation, elimina cualquier línea `TZ=` en blanco de `.env` y reinicia Marinara para que el servidor herede la zona horaria del host. Para elegir un valor de reserva del host explícitamente, fija un nombre IANA válido como `TZ=Europe/Warsaw` o `TZ=America/New_York`. Las versiones actuales tratan un valor en blanco como no establecido, pero aún se requiere un reinicio para que el estado de zona horaria de Node y los trabajos programados se reconstruyan de forma consistente.

### Permiso denegado del contenedor en un montaje de volumen

Si un contenedor Docker o Podman falla con errores de permiso en el volumen de datos:

- Para volúmenes con nombre después de una actualización, obtén la imagen más reciente y reinicia con `docker compose pull && docker compose up -d`. La imagen oficial repara la propiedad en el arranque.
- Para bind mounts, haz que la carpeta del host sea escribible por el ID de usuario y de grupo `1000`, o usa un volumen con nombre en su lugar.
- En sistemas SELinux como Fedora o RHEL, añade el sufijo `:Z` al montaje del volumen.

### El contenedor Lite se cae en una Raspberry Pi 4

Si el contenedor lite se reinicia cada vez que envía una petición de IA en una Raspberry Pi 4 o un dispositivo ARM similar, revisa el código de salida. Exit 132 o SIGILL apunta a un problema conocido de origen ascendente en la compilación de Node de la imagen lite en algunos chips ARM. SIGILL significa que el programa alcanzó una instrucción que la CPU no puede ejecutar.

La imagen regular (no lite) no está afectada. Hasta que llegue la corrección ascendente, usa la imagen regular en ese dispositivo. Entre las imágenes lite afectadas conocidas están `1.5.7-lite` y `1.5.8-lite`. Comprobado por última vez con Marinara Engine 2.2.0.

### External Extensions no aparece en Addons

La sección está oculta a propósito hasta que se abran ambas puertas de seguridad:

1. Fija `ENABLE_EXTERNAL_EXTENSIONS=true` en el `.env` del host.
2. Espera unos dos segundos al observador de configuración, luego abre **Settings → Advanced → Danger Zone**, desplázate por debajo de los controles de borrado de datos y activa **Allow third-party extension imports**.

Si el interruptor de Danger Zone está desactivado, la marca del host sigue siendo falsa o la app no ha observado el cambio. Confirma que editaste la ruta `.env` activa descrita en [Configuración del servidor](CONFIGURATION.md). En Docker, esa normalmente es `/app/data/.env`.

Cuando alguna de las puertas está cerrada, los registros de extensiones externas, heredadas, importadas de perfil, almacenadas manualmente y de origen desconocido no aparecen ni pueden ejecutarse. Reabrir las puertas no las vuelve a activar automáticamente.

### Una extensión de navegador importada aparece pero no funciona

Abre la extensión en **Settings → Addons → External Extensions** e inspecciona **Requested access**. Los paquetes antiguos que usan el formato `marinara.extension` v1 sin declaración de capacidades deberían mostrar **Full page access**. Aprueba solo el hash exacto que inspeccionaste y en el que confías.

Si un paquete antiguo se volvió a exportar con una lista de capacidades vacía explícita, Marinara lo trata como una extensión de sandbox segura; ahí no funcionará el código que depende del DOM. Añade `full_page_access` a su manifiesto solo si entiendes que el código obtendrá acceso a toda la página de Marinara, al almacenamiento del navegador, a las APIs de red y a la sesión del mismo origen.

Después de desactivar una extensión con acceso a toda la página, recarga Marinara si queda algún elemento de la barra de herramientas, una capa superpuesta, un listener o un cambio visual. La limpieza se hace en la medida de lo posible, porque el código de la página puede crear efectos secundarios fuera de la API de compatibilidad que Marinara rastrea.

### Una Server Extension dice que no hay ningún sandbox compatible disponible

Las Server Extensions se ejecutan solo con macOS Seatbelt o Linux Bubblewrap. Instala `bwrap` en el host Linux y luego reinicia Marinara. Windows, Android y otros hosts no compatibles rechazan deliberadamente la ejecución de Server Extensions en lugar de recurrir al proceso principal del servidor. Las Browser Extensions aún pueden usar su sandbox de Worker con origen opaco.

## Cómo obtener más ayuda

Si todavía necesitas ayuda, reúne primero buenos detalles.

1. Abre **Settings** > **Advanced** > **Message Tools** y activa **Debug mode**. Esto registra las cargas del prompt y de la respuesta en la consola del servidor para que puedas compartirlas.
2. Anota tu sistema operativo, tu versión de Node.js y el texto completo del error de la consola del servidor.

Antes de compartir la salida de depuración, elimina las API keys, los tokens de acceso, los admin secrets, los prompts privados y el contenido de chat privado.

Luego contacta con la comunidad:

- Lee los issues abiertos en https://github.com/Pasta-Devs/Marinara-Engine/issues
- Únete al Discord para obtener ayuda de la comunidad en https://discord.com/invite/KdAkTg94ME
- Presenta un reporte de error en https://github.com/Pasta-Devs/Marinara-Engine/issues con tus detalles de arriba.

## Guías relacionadas

- [Preguntas frecuentes](FAQ.md)
- [Referencia de configuración del servidor](CONFIGURATION.md)
- [Acceso remoto](REMOTE_ACCESS.md)
- [Actualizar Marinara Engine](UPGRADING.md)
- [Conectar a un proveedor de IA](connections/connecting-to-a-provider.md)
- [Configuración del Local Model](connections/local-model.md)
- [Game Mode: Primeros pasos](game/getting-started.md)
- [Descripción general de los ajustes](settings/settings-overview.md)
