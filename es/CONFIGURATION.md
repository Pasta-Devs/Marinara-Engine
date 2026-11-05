# Referencia de configuración del servidor

Esta guía lista los ajustes del servidor que puedes cambiar con variables de entorno, que son ajustes que el servidor lee de un archivo de texto plano llamado `.env`. Marinara funciona sin ninguna configuración. La mayoría de las personas solo la necesitan para dejar que otros dispositivos se conecten, proteger un servidor compartido, mover la carpeta de datos, subir el nivel de registro o dar más tiempo a los trabajos lentos.

Tus cuentas de IA, personajes y opciones de chat se configuran dentro de la app. Para añadir una cuenta de IA, consulta [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md).

<a id="edit-the-env-file"></a>

## Editar el archivo .env

Marinara crea un `.env` vacío la primera vez que arranca. Cada línea es `KEY=value`. Las líneas que empiezan con `#` son comentarios.

| Instalación | Dónde está `.env` |
| --- | --- |
| Instalación normal | La carpeta raíz del proyecto |
| Imagen oficial de Docker o Podman | `/app/data/.env`, en el mismo volumen que tus datos |

1. Abre `.env.example` en la misma carpeta. Lista cada ajuste con su valor predeterminado.
2. Copia en `.env` la línea que quieras.
3. Cambia el valor después de `=` y guarda el archivo.

```text
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

`.env` es datos, no un script de shell. Marinara no ejecuta `$`, `$(...)` ni otra sintaxis de shell en un valor. Un valor ya establecido en el entorno del lanzador tiene prioridad sobre la misma entrada de `.env`.

El servidor lee `.env` sin importar cómo lo inicies. Los lanzadores (`start.bat`, `start.sh`, `start-termux.sh`) también establecen `HOST=0.0.0.0` para que otros dispositivos puedan conectarse, y abren tu navegador cuando el servidor está listo. `AUTO_OPEN_BROWSER=false` lo impide. Con `pnpm start` a secas, el servidor escucha solo en esta computadora a menos que establezcas `HOST`.

<a id="restart-or-hot-reload"></a>

## Reinicio o recarga en caliente

Marinara vigila `.env` mientras se ejecuta. La mayoría de los ajustes se aplican casi de inmediato, sin reinicio. El registro muestra una línea `[env-watcher]` por cada cambio. Si la vigilancia no puede iniciarse, el servidor comprueba el archivo cada 30 segundos y lo indica en el registro.

Si no se detectan tus cambios, por ejemplo cuando editas desde otra máquina o dentro del bind mount de un contenedor, establece `MARINARA_ENV_WATCH=poll`. Para desactivar la vigilancia, establece `MARINARA_ENV_WATCH=0`. Ambas son opciones avanzadas.

Estos ajustes solo se leen al arrancar. Cambiar uno necesita un reinicio, y el registro te lo advierte:

- `PORT`, `HOST`, `SSL_CERT` y `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`, `ENCRYPTION_KEY` y `MARINARA_EAGER_STORAGE`
- `MARINARA_ENV_FILE`, `MARINARA_ENV_WATCH` y `TZ`
- `AUTO_OPEN_BROWSER` y `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING` y `LOG_FORMAT`
- `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` y `SHUTDOWN_FORCE_EXIT_ON_REPEAT`
- Los tiempos de espera y los ajustes de sondeo de imagen, video, sprite y ComfyUI: `IMAGE_GEN_TIMEOUT_MS`, `IMAGE_GEN_MAX_RESPONSE_BYTES`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT` y los cuatro ajustes `*_VIDEO_POLL_INTERVAL_MS`

Los lanzadores leen `AUTO_UPDATE_ENABLED` antes de que arranque el servidor, así que un cambio se aplica a partir del próximo arranque y el registro no lo advierte.

Los ajustes de control de acceso y los secretos (`BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET`, `CSRF_TRUSTED_ORIGINS`) no necesitan reinicio.

<a id="access-control"></a>

## Control de acceso

El control de acceso decide quién puede llegar a un servidor en ejecución. Para ver pasos y ejemplos, consulta [Acceso remoto: inicio de sesión y lista de IP permitidas](REMOTE_ACCESS.md).

También puedes configurar el inicio de sesión sin `.env`: usa **Settings → Advanced → Access** (Configuración → Avanzado → Acceso) en un navegador que ya haya iniciado sesión, o el código de configuración de un solo uso del registro del servidor. El servidor imprime ese código solo mientras no hay inicio de sesión configurado y escucha más allá de loopback. El inicio de sesión se guarda en `DATA_DIR/.remote-login.json`. `node scripts/reset-login.mjs` (ejecutado en la carpeta de Marinara) lo elimina y cierra la sesión en todos los navegadores. Un inicio de sesión en `.env` tiene prioridad. Cambiar o quitar el inicio de sesión necesita la contraseña actual. Para los proxies de inicio de sesión, consulta [Proxies de inicio de sesión (forward auth)](REMOTE_ACCESS.md#login-proxies-forward-auth).

Términos usados abajo:

- **Loopback**: la computadora en la que se ejecuta el servidor, en `127.0.0.1` o `localhost`.
- **Rango CIDR**: una forma corta de escribir un bloque de direcciones IP, como `192.168.1.0/24`.
- **Basic Auth**: un nombre de usuario y una contraseña que se envían con cada solicitud. Lo usan los scripts y los clientes de API, y los navegadores usan la página `/login`. Está codificado, no cifrado, así que usa HTTPS en un servidor público.

Sin inicio de sesión configurado, el servidor acepta solo fuentes de confianza: loopback, las direcciones de `IP_ALLOWLIST`, Tailscale y el tráfico del puente de Docker del mismo host. Todos los demás, incluida tu red doméstica, reciben `403 Forbidden`. Para que otros dispositivos puedan conectarse siquiera, el servidor debe enlazarse a una dirección alcanzable: establece `HOST=0.0.0.0`.

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `BASIC_AUTH_USER` | vacío | Nombre de usuario del inicio de sesión. Configúralo junto con `BASIC_AUTH_PASS`. |
| `BASIC_AUTH_PASS` | vacío | Contraseña del inicio de sesión. Deja cualquiera de los dos vacío para desactivar el inicio de sesión. |
| `BASIC_AUTH_REALM` | `Marinara Engine` | Nombre del realm en el desafío de Basic Auth. |
| `IP_ALLOWLIST` | vacío | IPs o rangos CIDR separados por comas que siempre se permiten. Loopback directo siempre se permite. Un proxy inverso en la misma máquina, no. |
| `IP_ALLOWLIST_ENABLED` | `true` | `false` conserva la lista pero deja de aplicarla. |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | Permite el acceso sin contraseña desde redes privadas cuando no hay inicio de sesión configurado. Excluye `100.64.0.0/10`, que los proveedores de internet comparten entre clientes. Añádelo a `TRUSTED_PRIVATE_NETWORKS` solo si confías en él. |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | Permite el acceso sin contraseña desde cualquier dirección, incluida internet. No recomendado. |
| `TRUSTED_PRIVATE_NETWORKS` | rangos integrados | Reemplaza los rangos privados predeterminados. Incluye cualquier valor predeterminado que aún quieras. |
| `BYPASS_AUTH_TAILSCALE` | automático | Vacío: un dispositivo se salta el inicio de sesión solo cuando se conecta directamente a la dirección de Tailscale de esta computadora. Tailscale Serve, Funnel u otro proxy siguen necesitando inicio de sesión. `true`: bypass heredado de todo `100.64.0.0/10`. `false`: control de acceso normal. |
| `BYPASS_AUTH_DOCKER` | automático | Vacío: confía solo en una interfaz de contenedor detectada y su puerta de enlace, y solo mientras no haya inicio de sesión, `IP_ALLOWLIST` ni `TRUSTED_AUTH_PROXY` configurados. `true`: redes heredadas o personalizadas. `false`: control de acceso normal. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | Exige el inicio de sesión o la lista de permitidos para el tráfico de Docker que reenvía un proxy. Ponlo en `false` solo cuando el propio proxy haga iniciar sesión a cada visitante. |
| `REQUIRE_AUTH_FOR_LOOPBACK_PROXY` | `true` | Trata como remotas las solicitudes que reenvía un proxy o un túnel en la misma máquina, incluidas las HTTP/1.0 como el `proxy_pass` predeterminado de nginx. Ponlo en `false` solo cuando el propio proxy haga iniciar sesión a cada visitante. |
| `TRUSTED_AUTH_PROXY` | vacío | IPs o CIDRs de un proxy de forward auth (tinyauth, Authelia, Authentik, oauth2-proxy) que hace iniciar sesión a cada visitante. Sus solicitudes se saltan el inicio de sesión y `IP_ALLOWLIST`. Debe proteger cada ruta, y Marinara no debe ser accesible sin pasar por él. |
| `TRUSTED_HOSTS` | vacío | Nombres de host públicos o de proxy adicionales a los que Marinara responde, como `chat.example.com`. Las IP directas, `localhost`, `.local`, `.home.arpa` y los nombres de LAN de una sola etiqueta funcionan sin él. Los nombres de `CSRF_TRUSTED_ORIGINS` o `CORS_ORIGINS` también se aceptan. |
| `SSL_CERT` | vacío | Ruta a un certificado TLS. Configúralo con `SSL_KEY` para servir HTTPS directamente. |
| `SSL_KEY` | vacío | Ruta a la clave privada TLS. |
| `CSRF_TRUSTED_ORIGINS` | vacío | Orígenes de navegador adicionales con permiso para guardar cambios, para un dominio público o un puerto inusual. El valor literal `null` se ignora, también para el APK de Android. |

> **Advertencia:** un rango público amplio en `IP_ALLOWLIST`, como `0.0.0.0/0`, puede dejar entrar a clientes de internet sin iniciar sesión. Incluye solo direcciones de confianza.

## Almacenamiento

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | Carpeta raíz de todos los datos de usuario. Las imágenes de Docker establecen `/app/data`. |
| `FILE_STORAGE_DIR` | `storage` dentro de `DATA_DIR` | Anula la carpeta de almacenamiento de archivos. |
| `ENCRYPTION_KEY` | vacío | Clave que cifra las API keys (claves de API) guardadas. |
| `MARINARA_MAX_RESIDENT_CHATS` | `0` (ilimitado); `8` en SteamOS y Termux | Máximo de chats que se mantienen en memoria a la vez. Superado el límite, el chat usado menos recientemente que no tenga cambios sin guardar se descarta de la memoria (nunca del disco) después de cada guardado. Un texto no válido vuelve al valor predeterminado de la plataforma. Los valores positivos por debajo de `2` se convierten en `2`. `0` desactiva el descarte. |
| `MARINARA_EAGER_STORAGE` | desactivado | `1` carga cada chat al arrancar, como antes de 2.4.5. Usa mucha más memoria en perfiles grandes. Necesita un reinicio. |

Genera una clave de cifrado y pégala en `ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

Marinara guarda tus datos como archivos JSON simples, así que puedes copiar y leer las copias de seguridad. Para saber qué contiene cada carpeta, consulta [Dónde se guardan tus datos](data/where-data-is-stored.md).

<a id="logging-levels"></a>

## Niveles de registro

`LOG_LEVEL` establece cuánto imprime el servidor. Oculta todo lo que esté por debajo del nivel que elijas.

| Nivel | Qué muestra |
| --- | --- |
| `error` | Solo fallos graves. |
| `warn` | Errores y advertencias. El predeterminado. |
| `info` | Añade los registros de arranque y por solicitud. |
| `debug` | Todo, incluidos los prompts completos (las instrucciones enviadas a la IA) y las respuestas del modelo. Produce mucha salida. |

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `LOG_LEVEL` | `warn` | El nivel de arriba. |
| `LOG_PRESET` | `default` | `prompt-connections` muestra el mismo detalle de prompt y modelo que `debug`, pero oculta las líneas de solicitud rutinarias como `GET /api/chats`. |
| `LOG_DISABLE_REQUEST_LOGGING` | `false` | `true` oculta las líneas de solicitud rutinarias y conserva tu nivel. Necesita un reinicio. |
| `LOG_FORMAT` | automático | `pretty` imprime líneas legibles en todas partes, por ejemplo para leer los prompts de **Debug mode** (Modo de depuración) en `docker logs`. `json` imprime un objeto JSON por línea. Necesita un reinicio. |

En una terminal, el servidor imprime líneas legibles. En otros lugares, como los registros de Docker, un servidor de producción imprime líneas JSON. El lanzador de Termux pide líneas legibles. El registro del navegador es aparte y no lo controla `LOG_LEVEL`.

## Tiempos de espera

Un tiempo de espera es lo máximo que el servidor aguarda por un trabajo lento. Abre **Settings → Advanced → Request timeouts** para cambiar en segundos los límites de texto, agentes, prompts de imagen de Game, imágenes, video, ComfyUI y embeddings. Los límites más altos ayudan a los backends locales lentos. No pueden anular un límite que imponga el servicio. Guardar necesita acceso de administración del servidor.

Esos ajustes se aplican a todos los perfiles y se guardan junto al `.env` activo como `.env.timeouts.json` (o `<custom-env-path>.timeouts.json`). Tienen prioridad sobre las variables correspondientes sin editar `.env`. Los cambios de texto, agentes, prompts de imagen de Game y embeddings se aplican a las nuevas solicitudes. Los cambios de medios y los paquetes de agentes instalados necesitan un reinicio. Para volver a las variables, elimina ese archivo y reinicia.

Los valores están en milisegundos a menos que el nombre diga lo contrario. Los valores no válidos, cero, negativos o fuera de rango de los tiempos de espera validados de chat, agentes y prompts de imagen de Game registran una advertencia y usan el valor predeterminado. Para saber más sobre los trabajos de video, consulta [Video de escena](media/scene-video.md).

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000` (5 min) | Tiempo hasta el primer token (un fragmento de texto) y entre fragmentos para las respuestas de Conversation, Roleplay y Game. También es el presupuesto de los trabajos en segundo plano sin tiempo de espera propio (Professor Mari, actualización de Noodle, respuestas de Slurp). Rango `10000`-`3600000`. No cambia los tiempos de espera de agentes, medios, embeddings ni herramientas. |
| `AGENT_CALL_TIMEOUT_MS` | `300000` (5 min) | Silencio máximo antes o durante una llamada al modelo de un agente, incluidos los agentes descargables. Los datos entrantes lo reinician. Rango `10000`-`3600000`. El Illustrator mantiene al menos su presupuesto integrado de 30 minutos de inactividad. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 s) | Límite de tiempo total para la llamada al modelo que convierte una escena de Game en un prompt de imagen. Rango `10000`-`3600000`. |
| `EMBEDDING_TIMEOUT_MS` | `300000` (5 min) | Tiempo para una solicitud de embedding. |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000` (30 min) | Tiempo para una solicitud de generación de imágenes. |
| `IMAGE_GEN_MAX_RESPONSE_BYTES` | `31457280` (30 MiB) | Mayor respuesta de imagen aceptada. Súbelo cuando un ComfyUI local incruste metadatos grandes. |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000` (30 min) | Tiempo para una solicitud de video de escena, incluidos los flujos de trabajo de video de ComfyUI. |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160` (160 MiB) | Mayor descarga de video de escena aceptada. |
| `COMFYUI_GEN_TIMEOUT` | `2400` (40 min, en segundos) | Tiempo para un flujo de trabajo de imagen de ComfyUI después de ponerse en cola. |
| `SPRITE_GENERATION_TIMEOUT_MS` | `IMAGE_GEN_TIMEOUT_MS` | Tiempo para un trabajo de sprite por IA. |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000` (1 min) | Tiempo para una llamada a una herramienta personalizada. |
| `MAX_TOOL_ROUNDS` | `100` | Máximo de rondas de llamadas a herramientas antes de que el modelo deba responder. Un turno de Game recibe como máximo 4, un agente 16 y una puesta al día de lorebook (libro de trasfondo) 64, o este valor si es menor. |

## APIs privilegiadas (ADMIN_SECRET)

Las acciones destructivas o de riesgo, como las copias de seguridad, borrar datos, aplicar actualizaciones e instalar temas, necesitan un secreto adicional además de las comprobaciones de acceso normales. Puedes crear uno en **Settings → Advanced → Admin Access** (Configuración → Avanzado → Acceso de administrador) en la propia computadora del servidor (consulta [Admin Access](REMOTE_ACCESS.md#admin-access-and-privileged-actions)), o establecer un valor largo y aleatorio en el servidor:

```text
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

En la propia computadora del servidor, estas acciones suelen funcionar sin el secreto. Una solicitud que reenvía un proxy o un túnel en esa computadora cuenta como remota a menos que `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`. Las solicitudes directas desde otro dispositivo necesitan el secreto. Pega el mismo valor en **Settings → Advanced → Admin Access**, y la app lo envía por ti. `ADMIN_SECRET` en `.env` tiene prioridad sobre un secreto creado en la app. Sin secreto de administrador, las acciones privilegiadas fallan desde todos los dispositivos excepto la propia computadora del servidor, y el error te indica que establezcas uno. Los agentes instalados funcionan desde cualquier dispositivo que haya entrado con el inicio de sesión; instalarlos, actualizarlos y quitarlos necesitan el secreto.

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `ADMIN_SECRET` | vacío | Secreto para acciones privilegiadas desde dispositivos remotos. |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | `true` exige el secreto también en la propia computadora del servidor. |
| `UPDATES_APPLY_ENABLED` | `false` | Permite que el navegador aplique actualizaciones del mismo canal (**Apply Update**, Aplicar actualización). Un cambio de canal de versión desde un navegador en la computadora del servidor funciona sin él. Solo instalaciones basadas en Git. |
| `UPDATES_APPLY_DISABLED` | sin configurar | Rechaza toda aplicación de actualizaciones del lado del servidor, incluido el cambio de canal. Tiene prioridad sobre `UPDATES_APPLY_ENABLED`. Los lanzadores de dev y de e2e lo establecen. |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | Permite que un dispositivo remoto aplique actualizaciones, con un secreto válido. |
| `HAPTICS_ALLOW_REMOTE` | `false` | Permite que un dispositivo remoto ejecute acciones hápticas, con un secreto válido. |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | Activa las herramientas de script personalizadas. Mantenlo desactivado para herramientas no confiables o importadas. |
| `MARI_DB_ALLOW_UNSAFE_TRANSFORMS` | `false` | Permite que los scripts de transformación de base de datos de Professor Mari se ejecuten en hosts sin un entorno aislado del sistema operativo (macOS Seatbelt o Linux Bubblewrap, que se usan cuando están presentes). Mantenlo desactivado salvo que hayas revisado el script. |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | Activa la vista previa y la sincronización manual de repositorios de agentes de GitHub en Agent Organizer. Consulta [Repositorios de agentes personalizados](#custom-agent-repositories). |
| `MARINARA_OVERWORLD_GAMES` | `false` | Permite que los jugadores creen partidas Overworld (un kit de ambientación y un mundo generado) y conviertan una partida heredada en una. Si está desactivado, el asistente solo ofrece partidas Classic. |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | Primera de las dos puertas para las importaciones de extensiones de terceros. Consulta [External Extensions](#external-extensions). |
| `IMPORT_ALLOWED_ROOTS` | vacío | Carpetas que la importación masiva puede leer sin un token de selector. |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456` (256 MiB) | Mayor exportación de perfil JSON única que construye el servidor. |

## Aceptaciones de direcciones locales

De forma predeterminada, las solicitudes salientes a servicios de IA, servicios de imagen y webhooks rechazan las direcciones privadas o locales. Esto bloquea el SSRF (server-side request forgery, falsificación de solicitud del lado del servidor), en el que se engaña a una solicitud para que llegue a una dirección interna. Los servidores de modelos en loopback siguen funcionando. Activa solo el interruptor que necesites para un servicio autoalojado en otra máquina de la red privada.

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | Las URLs de servicios de IA pueden llegar a direcciones privadas o de LAN. Activado de forma predeterminada en Android. |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | Las URLs de servicios de imagen pueden llegar a direcciones privadas o de LAN. Las URLs privadas de resultados aún deben coincidir con el origen exacto del servicio. |
| `TTS_LOCAL_URLS_ENABLED` | `false` | Las URLs de texto a voz pueden llegar a direcciones privadas o de LAN. |
| `STT_LOCAL_URLS_ENABLED` | `false` | La URL del servidor de Speech to text (voz a texto) puede llegar a direcciones privadas o de LAN. Un servidor en la misma máquina funciona sin esta variable. |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | Las URLs de traducción de DeepLX pueden llegar a direcciones privadas o de LAN. |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | Los webhooks de herramientas personalizadas pueden llegar a direcciones privadas o de LAN. |

Para conectar un modelo local o autoalojado, consulta [Conectar un modelo local o autoalojado](connections/local-self-hosted.md).

<a id="feature-switches"></a>

## Interruptores de funciones

Los comportamientos opcionales del servidor, como reintentar las llamadas fallidas al proveedor o mantener estables las selecciones de grupos del lorebook, están en **Settings → Advanced → Features** (Configuración → Avanzado → Funciones). Todos están desactivados de forma predeterminada. Algunos tienen una variable que, cuando está definida, tiene prioridad sobre el interruptor. Consulta [Interruptores de funciones](configuration/features.md).

<a id="marinara-notices"></a>

## Avisos de Marinara

Los avisos son advertencias breves de los mantenedores, como un problema de seguridad o un paso manual que necesita tu versión. Se muestran como un banner.

- Al arrancar y después cada hora, el servidor descarga un archivo pequeño, `notices.json`, de la rama `notices` del repositorio de Marinara Engine. Conserva solo los avisos que nombran tu versión. Tu navegador se los pide a tu propio servidor una vez al cargar la página y después cada hora.
- Si falla una descarga, el servidor conserva los avisos que ya tiene y el arranque no se retrasa.
- La petición no envía datos sobre ti, tus chats ni tus ajustes. Solo los mantenedores pueden cambiar la rama `notices`, y cada cambio se revisa.
- Un aviso es texto plano con un límite de tamaño. Los enlaces se conservan solo si apuntan a `https://github.com/Pasta-Devs/`. Un aviso no puede instalar, ejecutar ni cambiar nada.
- Solo tú ves los avisos: en la propia computadora del servidor, desde una dirección de `IP_ALLOWLIST` o después de iniciar sesión. Los demás visitantes reciben una lista vacía.

Para desactivar los avisos, establece `MARINARA_NOTICES_ENABLED=false`.

> **Advertencia:** con los avisos desactivados, Marinara no puede avisarte de correcciones de seguridad ni de pasos necesarios. Sigue tú mismo las [versiones en GitHub](https://github.com/Pasta-Devs/Marinara-Engine/releases).

Las bifurcaciones pueden apuntar `MARINARA_NOTICES_URL` a su propio archivo.

<a id="optional-multiplayer"></a>

## Multijugador opcional

El multijugador está desactivado de forma predeterminada. Permite compartir una sala privada de Conversation, Roleplay o Game sin un límite fijo de participantes. Cada invitado usa su propia instalación de Marinara de confianza. Los invitados no necesitan cuenta de IA. El anfitrión proporciona las cuentas de IA y puede leer y conservar el contenido compartido. Mientras cualquiera de las dos condiciones de activación esté desactivada, Marinara no hace comprobaciones de sesiones, certificados ni pares en segundo plano.

1. Establece `MULTIPLAYER_ENABLED=true` en el `.env` de cada Marinara participante y reinícialo. Solo funciona el valor exacto `true`, y la recarga en caliente no lo aplica.
2. Abre **Settings → Advanced → Multiplayer** (Configuración → Avanzado → Multijugador), lee la advertencia y activa el ajuste. Esto no inicia un puerto de escucha ni se une a una sala.
3. Para alojar, usa **Create shared session** (Crear sesión compartida) o **Play together** (Jugar juntos) en el flujo del modo o de configuración. Revisa la configuración, tu nombre visible y el texto de persona que compartes. Un chat existente solo comparte sus selecciones de configuración, nunca su transcripción, notas ni recuerdos.
4. En el anfitrión, establece `SSL_CERT` y `SSL_KEY` para un certificado válido para el nombre de host de la sala y de confianza para los invitados. Elige una dirección HTTPS y un puerto de sala independientes, como `https://room.example.org:7861`. La acción de alojar abre ese puerto. Dirige solo el puerto de la sala a través de tu firewall o router. No expongas la API normal de Marinara. No se configura por ti ningún reenvío de puertos, retransmisión ni excepción de certificados.
5. Establece una contraseña de sala de al menos 12 caracteres, distinta de tus credenciales de administración. Envía la invitación que caduca y la contraseña por separado a personas de confianza. El invitado comprueba la huella del nombre de host, el nombre de la sala y el texto de persona, y luego solicita entrar. El anfitrión aprueba cada solicitud en **Players** (Jugadores) antes de que se envíe cualquier historial.

Límites y comportamiento:

- TLS comprueba la cadena del certificado y el nombre de host, y la huella del certificado de la invitación, antes de que se envíe una contraseña. Los certificados autofirmados no se aceptan en silencio. Un certificado renovado necesita una nueva invitación.
- Las invitaciones caducan a los 30 minutos. Las sesiones admitidas duran como máximo 12 horas. Reemplazar o revocar detiene las invitaciones sin usar. **Kick** (Expulsar) elimina a un invitado admitido.
- El anfitrión controla las respuestas automáticas o manuales, **Pause** (Pausar)/**Resume** (Reanudar) y **Stop** (Detener). El cupo predeterminado es de 100 turnos de generación coordinada por sesión de alojamiento. Un turno de grupo o la configuración de Game pueden hacer más de una llamada al modelo. Es un límite de turnos, no una estimación de precio.
- En Game, revisa el grupo antes de **Start Game** (Iniciar partida). Cada jugador requerido envía una acción o pasa, y el GM resuelve cuando todos están listos. Un jugador desconectado sigue siendo requerido hasta que vuelva o el anfitrión lo haga pasar o lo elimine. Las rondas pausadas o interrumpidas nunca repiten por sí solas una solicitud de pago ni efectos del mundo ya confirmados.
- **Stop**, **Leave** (Salir), desactivar el ajuste y reiniciar el servidor terminan la sesión activa. Un reinicio nunca aloja ni se une por sí solo.
- Las herramientas personalizadas y de paquetes y los comandos inseguros siguen sin estar disponibles en las salas. Los invitados nunca ejecutan un programador ni comandos locales a partir del texto recibido. Los horarios de Conversation usan el programador del anfitrión.
- Los nuevos jugadores y los cambios de persona se aplican en la siguiente ronda.
- Las salas solo transportan texto con límites de tamaño. No hay transferencia de archivos, medios, extensiones ni paquetes. El contenedor nativo de Android no puede unirse.

> **Advertencia:** conéctate solo con personas de confianza y usa tu propio cliente de Marinara. Nunca instales un cliente, una extensión o un archivo proporcionados por el anfitrión. El anfitrión puede leer lo que compartes, y el contenido compartido puede ir a sus servicios de IA. Las conexiones directas revelan direcciones de red. No compartas contraseñas, API keys ni información personal. Sal de inmediato si algo parece ir mal.

Para las restricciones exactas y las plataformas probadas, consulta el [registro de compatibilidad y verificación](development/multiplayer.md). Si tienes problemas, consulta [Solución de problemas](TROUBLESHOOTING.md#multiplayer-connection-or-turn-problems).

## Agentes y extensiones

Instala los agentes propios opcionales en la app: **Agents → Agent Organizer** (Agentes → Organizador de agentes). Marinara elige el catálogo [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) que coincide con su versión mayor.

- **Updates (Actualizaciones):** Marinara pregunta antes de descargar una nueva versión de un paquete instalado. **Not now** (Ahora no) mantiene la versión actual y deja **Update** (Actualizar) en Agent Organizer. Una instalación nueva no tiene paquetes.
- **Where packages live (Dónde viven los paquetes):** `DATA_DIR/capability-packages`. Los volúmenes de Docker, las carpetas de datos personalizadas, las copias de seguridad y las actualizaciones normales los conservan. Esto se aplica al escritorio, Docker y Termux. iOS y otros navegadores usan los paquetes de su servidor anfitrión.
- **Disk use (Uso del disco):** Marinara conserva la versión actual y la anterior de cada paquete, y elimina las versiones más antiguas y las copias temporales de `DATA_DIR/capability-runtime-snapshots`. Los datos de los paquetes nunca se eliminan.
- **Offline (Sin conexión):** Los paquetes instalados siguen funcionando en su versión cuando GitHub es inalcanzable, se rechaza una actualización o falla la verificación.

### Importaciones de agentes personalizados

Los archivos, las carpetas y los repositorios de agentes externos están bloqueados. Para permitirlos, activa **Allow custom Agent imports** (Permitir importaciones de agentes personalizados) en **Settings → Advanced → Danger Zone** (Configuración → Avanzado → Zona de peligro). Esto no necesita ninguna variable de entorno. Los controles de importación permanecen atenuados hasta que lo hagas.

Cada importación muestra primero las capacidades que solicita el agente. Los permisos necesitan aprobación explícita. No se importan las funciones incluidas ni las selecciones de herramientas, se sanea el CSS generado y se comprueban las acciones de resultado con las capacidades aprobadas. Desactivar la puerta detiene los agentes importados. Los agentes creados en Marinara y los paquetes oficiales no se ven afectados.

<a id="custom-agent-repositories"></a>

### Repositorios de agentes personalizados

Los repositorios están desactivados de forma predeterminada porque sus prompts y herramientas no están verificados. Establece `ENABLE_CUSTOM_AGENT_REPOS=true`, activa **Allow custom Agent imports** y luego abre **Agents → Agent Organizer → Custom Sources** (Agentes → Organizador de agentes → Fuentes personalizadas) para previsualizar un repositorio público de GitHub. Añadir una fuente y aplicar cambios posteriores necesitan confirmación. La sincronización es manual, y Marinara nunca clona ni sondea repositorios en segundo plano. Solo se aceptan URLs de GitHub de la raíz de un repositorio.

Un repositorio publica agentes, conjuntos de reglas de Game Mode o ambos. En la raíz:

- `agents.json` es un array con el formato de agente descargable:

  ```json
  [
    {
      "id": "continuity-helper",
      "name": "Continuity Helper",
      "description": "Checks recent turns for contradictions.",
      "phase": "post_processing",
      "enabledByDefault": false,
      "category": "writer",
      "defaultPromptTemplate": "Check {{messages}} for continuity errors."
    }
  ]
  ```

- `rulesets` contiene un conjunto de reglas por archivo `.json`, hasta 32 archivos de 512 KB. Solo se leen los archivos que están directamente dentro. La vista previa muestra el nombre, la versión y la cobertura de cada conjunto de reglas. El texto para el Game Master de un conjunto de reglas se envía al modelo en cada partida que lo usa, así que instala solo de personas de confianza.

Los conjuntos de reglas importados llevan el nombre del propietario del repositorio, como `alice/my-5e`, así que nunca toman un nombre oficial. Se conserva cada versión, y una partida se juega con la versión exacta con la que empezó. Si llega la misma versión con un contenido diferente, Marinara conserva la instalada y te indica que pidas a quien lo creó que aumente el número de versión. Un archivo que Marinara no puede leer se lista con el motivo y se omite.

Al sincronizar, los valores remotos de prompt, ajustes y herramientas reemplazan los valores gestionados por el repositorio que muestra la vista previa. Tus elecciones de cuenta e imágenes siguen siendo locales. Si un agente desaparece del origen, se queda como un agente local normal y solo pierde su vínculo con el repositorio. Eliminar una fuente funciona igual, y sus conjuntos de reglas siguen instalados.

Los agentes personalizados también pueden activar **Previous output** (Salida anterior) en Context Sources para leer su última salida correcta. Con **JSON context output** (Salida de contexto en JSON), devuelve `{"text":"main prompt content","agent-context":"private continuation context"}`. Solo `text` va al prompt principal. **Hide output as spoilers** (Ocultar la salida como spoiler) mantiene contraídas las salidas guardadas. Las regeneraciones excluyen el turno reemplazado, y los mensajes eliminados o los swipes (respuestas alternativas) inactivos no pueden aportar contexto.

### External Extensions

Las importaciones de extensiones de terceros necesitan dos aceptaciones. La variable de entorno es el permiso del operador del anfitrión. El interruptor de la Danger Zone es la aceptación del usuario.

1. Establece `ENABLE_EXTERNAL_EXTENSIONS=true` en `.env`.
2. Abre **Settings → Advanced → Danger Zone**, desplázate por debajo de los controles de eliminación de datos, lee la advertencia y activa **Allow third-party extension imports** (Permitir importaciones de extensiones de terceros).

Entonces aparece la sección **External Extensions** (Extensiones externas) en **Settings → Addons**. Cerrar cualquiera de las dos puertas desactiva los registros externos y detiene su código. Los registros almacenados manualmente, heredados, importados de un perfil y de origen desconocido cuentan como externos, así que soltar archivos en una carpeta no puede saltarse las puertas. Los borradores de Professor Mari no necesitan ninguna de las dos puertas. Empiezan desactivados y necesitan la aprobación de su hash de código exacto.

Las Sandboxed Browser Extensions (extensiones de navegador en entorno aislado) son la opción predeterminada. Algunos paquetes más antiguos muestran **Full page access** (Acceso completo a la página) porque necesitan la página de Marinara. Ese modo ejecuta el código aprobado en la página de Marinara, con acceso al contenido de la página, al almacenamiento del navegador, a las APIs de red y a tu sesión. Solo está disponible para las External Extensions con ambas puertas abiertas, y necesita una aceptación de advertencia aparte. Recarga la página después de desactivarlo.

## Referencia completa de variables de entorno

Las tablas de arriba cubren el control de acceso, el almacenamiento, el registro, los tiempos de espera, las acciones privilegiadas y las aceptaciones de direcciones locales. Las demás variables están aquí.

### Servidor y arranque

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `PORT` | `7860` | Puerto en el que escucha el servidor. Mantén Android, Docker y Termux en el mismo valor. |
| `HOST` | `127.0.0.1` (`0.0.0.0` en los lanzadores y las imágenes de Docker) | Interfaz de red a la que enlazarse. Usa `0.0.0.0` para el acceso por LAN. El archivo Compose predeterminado publica el puerto de Docker solo en `127.0.0.1`. |
| `MARINARA_ANDROID_SECRET` | vacío | Secreto interno para las instalaciones de Termux gestionadas por el APK. La app de Android lo crea y el lanzador de Termux lo exporta. Nunca pidas a los usuarios que lo establezcan. Debe tener exactamente 64 caracteres hexadecimales. Un valor no vacío que no sea válido hace que las solicitudes locales del dispositivo fallen con HTTP 503. |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Archivo de secreto que usan el lanzador de Termux y el comando local `mari`. El APK y el lanzador lo gestionan. |
| `AUTO_OPEN_BROWSER` | `true` | Si los lanzadores abren la URL de la app. `false` lo impide. La configuración gestionada por el APK lo desactiva. |
| `AUTO_UPDATE_ENABLED` | `true` | Si los lanzadores basados en Git obtienen y aplican actualizaciones antes de arrancar. `false` lo desactiva a partir del próximo arranque. El lanzador aún comprueba en modo de solo lectura si hay versiones nuevas e imprime un recordatorio. `--skip-update` salta ambas comprobaciones en un arranque. |
| `MARINARA_NOTICES_ENABLED` | `true` | Si el servidor descarga los avisos de los mantenedores. Consulta [Avisos de Marinara](#marinara-notices). |
| `MARINARA_NOTICES_URL` | `notices.json` en la rama `notices` | Sustituye el archivo de avisos, para bifurcaciones y réplicas. Se valida igual, y los enlaces que no apuntan a `https://github.com/Pasta-Devs/` se quitan. |
| `MARINARA_ENV_FILE` | `.env` en la raíz del proyecto | Anula la ruta del archivo `.env`. Establécela antes del arranque. |
| `MARINARA_MEDIA_GENERATION_CONCURRENCY` | `4` | Máximo de solicitudes de imagen o video a la vez, en todo el servidor. Bájalo a 1-2 si un ComfyUI o SwarmUI local se queda sin VRAM. `0` quita el límite. Los valores no válidos se ignoran con una advertencia. El trabajo por lotes nunca ocupa el último hueco. Se aplica además de **Queue media generation requests** (Poner en cola las solicitudes de generación de medios), en **Settings → Generations → Overall Generations** (Configuración → Generaciones → Generaciones generales) y activado de forma predeterminada, que pone en cola los trabajos de imagen y video por cuenta. |
| `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS` | `600000` (10 min) | Cuánto espera una solicitud a que quede libre un hueco antes de fallar. `0` espera indefinidamente. |
| `MARINARA_SHARED_GPU_HOSTS` | vacío | Lista de `host:port` separados por comas para una GPU compartida por un modelo local y un backend local de imagen o video, como llama-swap. Las solicitudes de texto y de medios a un host de la lista se turnan, para que una imagen no espere indefinidamente detrás de las respuestas del chat. Una imagen o un clip espera como máximo `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS`. Los embeddings no se retienen. Se aplica a las solicitudes nuevas sin reiniciar. |
| `MARINARA_ENV_WATCH` | `1` | Cómo se vigila `.env`. Predeterminado: eventos de cambio (con una espera de unos 250 ms) y una comprobación cada 30 segundos como respaldo. `poll`: siempre la comprobación cada 30 segundos. `0`: desactivado. Consulta [Reinicio o recarga en caliente](#restart-or-hot-reload). |
| `TZ` | predeterminado del sistema | Zona horaria de reserva del host para los trabajos del servidor, como `Europe/Warsaw`. Déjala sin configurar o vacía para usar la zona horaria del host. Una **Schedule timezone** (Zona horaria del horario) guardada en Conversation tiene prioridad para los horarios. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Orígenes de navegador con permiso para hacer solicitudes de origen cruzado. |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | Indicador heredado. Las compilaciones actuales no incluyen ninguna clave inicial, así que no crea nada. Añade tu propia cuenta en la app. |

**Schedule timezone** usa de forma predeterminada la zona horaria de tu dispositivo. Puedes cambiarla durante la configuración de Conversation, en Conversation Chat Settings o en el editor de horario del personaje. Es un único ajuste global que comparten todos los chats de Conversation y que se sincroniza con otros clientes del mismo servidor.

### Herramientas de medios y sprite

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `FFMPEG_PATH` | vacío | Ruta a `ffmpeg`, que se usa para los GIFs de expresiones animadas. Recurre a `ffmpeg` en tu PATH. |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 min) | Tiempo para convertir un clip de expresión animada. |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | `auto` prueba la limpieza integrada y luego la herramienta de IA opcional. `builtin` usa solo la limpieza integrada. `backgroundremover` fuerza la herramienta de IA. |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | `true` instala el eliminador de fondo por IA opcional al arrancar. |
| `BACKGROUNDREMOVER_COMMAND` | vacío | Ruta a un programa `backgroundremover` del sistema. |
| `BACKGROUNDREMOVER_PYTHON` | vacío | Ruta a un Python donde está instalado `backgroundremover`. |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000` (10 min) | Tiempo para una llamada de eliminación de fondo por IA. |

### Proveedores de video de escena

Las cuentas de video se configuran en la app. Estos ajustes solo afinan los trabajos. Los valores están en milisegundos.

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | Con qué frecuencia el servidor comprueba un trabajo de Google Veo. |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | Con qué frecuencia comprueba un trabajo de xAI Imagine. |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | Con qué frecuencia comprueba un trabajo de video de OpenRouter. |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | Con qué frecuencia comprueba un trabajo de Seedance. |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | vacío | Dirección HTTPS pública de este servidor, para los servicios que deben obtener una imagen de referencia por URL. |

<a id="lorebooks"></a>

### Lorebooks

Ambos están desactivados de forma predeterminada y se aplican en la siguiente generación tras un cambio en `.env`. Cuando `LOREBOOK_STABLE_GROUP_WINNERS` está definida, tiene prioridad sobre el interruptor **Stable lorebook picks** (Selecciones estables del lorebook) de **Settings → Advanced → Features**. Si no, decide el interruptor. Consulta [Interruptores de funciones](configuration/features.md).

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | `false` | Conserva el mismo ganador del grupo de inclusión por chat mientras los candidatos no cambien, en vez de sortearlo en cada generación. Mantiene estable el inicio del prompt para la caché de prompts del proveedor. |
| `LOREBOOK_COMPACT_STORED_SCANS` | `false` | Guarda el texto completo de las entradas activadas solo en el mensaje de asistente o narrador más reciente. Los mensajes más antiguos conservan los ID, las claves y las puntuaciones de las entradas. Hace mucho más pequeños los chats con lorebooks grandes. Si se borran mensajes más recientes, Active Context y los reintentos de agentes muestran el texto actual de la entrada para el mensaje que vuelve a ser el más reciente. |

`scripts/compact-lorebook-scans.mjs` aplica la misma regla a los chats más antiguos. Detén primero el servidor. Es una simulación a menos que pases `--apply`, y hace una copia de seguridad de ambas tablas de mensajes antes de escribir.

<a id="robustness"></a>

### Robustez

Todos están desactivados de forma predeterminada, lo que mantiene el comportamiento anterior. `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` y `SHUTDOWN_FORCE_EXIT_ON_REPEAT` necesitan un reinicio. Los demás se aplican tras un cambio en `.env`. Cuando `PROVIDER_RETRY_TRANSIENT_ERRORS` está definida, tiene prioridad sobre el interruptor **Retry failed provider calls** (Reintentar llamadas fallidas al proveedor) de **Settings → Advanced → Features**. Si no, decide el interruptor.

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | `false` | Reintenta una conexión rechazada o inalcanzable, o un 502 o 503, hasta dos veces con una espera de como máximo 5 s, y solo antes de que te llegue cualquier texto. Nunca se reintenta un 504 ni una conexión interrumpida. No se usa cuando la cuenta tiene un respaldo, que se prueba de inmediato. Un host que falla lentamente puede retrasar el error unos 20 s. |
| `STORAGE_SKIP_UNCHANGED_WRITES` | `false` | Un guardado omite reescribir un archivo de chat o `manifest.json` cuando su contenido coincide con lo último que escribió este servidor y el archivo en disco no ha cambiado. Un archivo recién restaurado desde su `.bak` siempre se reescribe. |
| `STORAGE_YIELDING_SERIALIZE` | `false` | Prepara los archivos de chat grandes para guardarlos en fragmentos breves, para que guardar un chat muy largo no pause otras solicitudes. Los bytes escritos son los mismos. |
| `STORAGE_CACHE_WINDOWS_BOOT_ID` | `false` | Solo Windows. Recuerda, hasta el siguiente reinicio del sistema, la comprobación de la hora de arranque que hace el bloqueo de almacenamiento en cada inicio (unos 1,5 a 2 s de PowerShell), en `.writer-boot-id.json` dentro de `DATA_DIR`. |
| `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` | `false` | Solo Windows. <kbd>Ctrl</kbd>+<kbd>Break</kbd> y cerrar la consola también detienen el servidor limpiamente y escriben los guardados pendientes. Al cerrar la consola, los plazos son más breves para caber en los aproximadamente 5 s que permite Windows. |
| `SHUTDOWN_FORCE_EXIT_ON_REPEAT` | `false` | Pulsar <kbd>Ctrl</kbd>+<kbd>C</kbd> o <kbd>Ctrl</kbd>+<kbd>Break</kbd> otra vez más de 1,5 s después de la primera vez termina el servidor de inmediato. Pueden perderse los guardados no escritos. Sin este ajuste, las repeticiones se ignoran y se aplica el límite de cierre de 8 s. |
| `SHUTDOWN_EARLY_FLUSH` | `false` | Empieza a escribir los guardados pendientes cuando llega una señal de parada, mientras las conexiones aún se cierran. El reinicio de Advanced Settings no lo usa. |
| `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` | `0` | Cuánto espera una señal de parada a los runtimes en segundo plano (paquetes, extensiones, modelo integrado) antes de cerrar el almacenamiento. `0` espera a todos. Como máximo `2500`, para que el almacenamiento se cierre dentro del límite de 8 s. El reinicio de Advanced Settings sigue esperando a todos. |

### Integraciones y extras

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI` | `true` | Si las cuentas **Claude (Subscription)** usan el Claude Code de esta computadora cuando es al menos tan reciente como la copia incluida. Android no tiene copia incluida y necesita que esté activado. `false` usa siempre la copia incluida. Se aplica en un máximo de cinco minutos. |
| `DOCS_I18N_BASE_URL` | rama `docs-i18n` oficial | Origen de las descargas de los paquetes de idioma de la documentación y la interfaz. Los paquetes de interfaz usan su subárbol `ui/`. Debe ser un host público `https://`. |
| `GIPHY_API_KEY` | vacío | Clave de Giphy para la búsqueda de GIFs en el modo Conversation. La búsqueda sigue desactivada hasta que la establezcas y reinicies. |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Dirección predeterminada de la app háptica Intiface. |
| `SPOTIFY_REDIRECT_URI` | derivada de la solicitud | Anulación del callback de inicio de sesión de Spotify. Establécela cuando TLS termina aguas arriba. |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Mayor contenido de página wiki que Professor Mari lee antes de recortar. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Tiempo para una solicitud wiki de Professor Mari. |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | Cuánto tiempo guarda Professor Mari en caché una lectura wiki. |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (el lanzador de Windows establece `true`) | Permite que el runtime del **Built-in model** (Modelo integrado) se instale sin un encabezado de administrador en loopback. |

Para el **Built-in model**, consulta [Configuración del modelo integrado](connections/local-model.md).

<a id="outbound-http-proxy"></a>

### Proxy HTTP saliente

Algunas redes solo llegan a internet a través de un proxy HTTP, por ejemplo v2rayN sin el modo TUN. Marinara puede enviar a través de él las solicitudes a servicios de IA, servicios de imagen, servidores de embeddings y el catálogo de agentes. Establece estas variables en el entorno donde se inicia Marinara o en `.env`, y luego reinicia.

| Variable | Predeterminado | Qué hace |
| --- | --- | --- |
| `NODE_USE_ENV_PROXY` | sin configurar | `1` activa el proxy. Sin ella, Marinara ignora los ajustes de proxy, igual que Node.js. |
| `HTTP_PROXY` | vacío | Dirección del proxy, como `http://127.0.0.1:10809`. Se usa para todas las solicitudes cuando `HTTPS_PROXY` no está configurado. |
| `HTTPS_PROXY` | vacío | Proxy para las direcciones `https://` cuando es distinto de `HTTP_PROXY`. |
| `NO_PROXY` | vacío | Hosts separados por comas que no pasan por el proxy. Añade los servidores de modelos de tu red. `localhost`, `127.0.0.1` y `::1` nunca pasan por él. |

## Guías relacionadas

- [Interruptores de funciones](configuration/features.md)
- [Acceso remoto: inicio de sesión y lista de IP permitidas](REMOTE_ACCESS.md)
- [Dónde se guardan tus datos](data/where-data-is-stored.md)
- [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md)
- [Video de escena](media/scene-video.md)
- [Solución de problemas de Marinara Engine](TROUBLESHOOTING.md)
