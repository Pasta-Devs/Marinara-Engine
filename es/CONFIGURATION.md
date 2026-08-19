# Referencia de configuración del servidor

Esta guía explica cómo cambiar los ajustes a nivel de servidor de Marinara Engine usando variables de entorno. Una variable de entorno es un ajuste que escribes en un archivo de texto plano que el servidor lee. La mayoría de los usuarios nunca necesitan esta página. La lista completa de variables está cerca del final.

## ¿Cuándo configurarías Marinara?

Marinara Engine funciona de inmediato sin ninguna configuración. Solo necesitas esta página para un puñado de tareas. La mayoría implican ejecutar el servidor para más de un dispositivo.

Podrías editar la configuración cuando quieras:

- Dejar que otros dispositivos de tu red lleguen al servidor (control de acceso).
- Proteger un servidor compartido con una contraseña o una lista de IP permitidas.
- Cambiar dónde se guardan tus datos en el disco.
- Subir el nivel de registro para ayudar a diagnosticar un problema.
- Dar más tiempo a los trabajos lentos de imagen, video o embedding para que terminen (tiempos de espera).
- Desbloquear acciones privilegiadas como copias de seguridad o actualizaciones desde un dispositivo remoto.

Casi todo lo demás, como tus claves de proveedor de IA, personajes y opciones de chat, se configura dentro de la app, no aquí. Para añadir un proveedor de IA, consulta [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md).

Los agentes propios opcionales también se gestionan dentro de la app. Abre **Agents → Download Agents** (Agentes → Descargar agentes) para instalarlos o desinstalarlos. Marinara selecciona automáticamente la vía del catálogo [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) que coincide con la versión mayor de su Engine.

Ciclo de vida y almacenamiento de paquetes:

- **Updates (Actualizaciones):** Marinara busca actualizaciones compatibles en los paquetes oficiales ya instalados y pregunta antes de descargar cada nueva versión. Elegir **No** mantiene la versión actual y deja disponible la acción manual **Update** en Download Agents. Una instalación nueva queda vacía hasta que eliges paquetes.
- **Platforms (Plataformas):** El mismo comportamiento se aplica a las instalaciones de escritorio, Docker y Android alojado en Termux. iOS y otros clientes de navegador usan los paquetes instalados en su servidor host de Marinara.
- **Persistence (Persistencia):** Los paquetes viven bajo `DATA_DIR/capability-packages`. Los volúmenes de Docker, los directorios de datos personalizados, las copias de seguridad y las actualizaciones normales los conservan.
- **Offline resilience (Resiliencia sin conexión):** Los paquetes existentes siguen funcionando en su versión instalada cuando el acceso saliente HTTPS a GitHub no está disponible, se rechaza una actualización o una actualización falla la verificación.

### Importaciones de agentes personalizados

Los archivos, las carpetas y los repositorios personalizados de agentes externos están bloqueados de forma predeterminada. Para permitirlos, abre **Settings → Advanced → Danger Zone** y activa **Allow custom Agent imports**. A diferencia de las extensiones externas, esta protección controlada por el usuario no requiere una variable de entorno. Los controles de importación permanecen atenuados hasta que se activa.

Cada importación muestra las capacidades solicitadas por el agente antes de guardarlo. Los permisos deben aprobarse de forma explícita, no se importan las funciones incluidas ni las selecciones de herramientas, se sanea el CSS generado y se comprueban las acciones de resultado con el conjunto de capacidades aprobado. Desactivar de nuevo la opción impide que se ejecuten los agentes importados externamente. Los agentes personalizados creados en Marinara y los paquetes oficiales instalados mediante **Download Agents** siguen pudiendo ejecutarse y no dependen de esta protección.

### Repositorios de agentes personalizados

Los repositorios personalizados están desactivados de forma predeterminada porque sus prompts y selecciones de herramientas son contenido de terceros sin verificar. Configura `ENABLE_CUSTOM_AGENT_REPOS=true`, activa **Allow custom Agent imports** en la Danger Zone y luego abre **Agents → Download Agents → Custom Sources** (Fuentes personalizadas) para previsualizar un repositorio público de GitHub. Añadir una fuente y aplicar cualquier cambio de contenido posterior requieren ambos una confirmación explícita. La sincronización es manual; Marinara no clona repositorios ni los sondea en segundo plano.

La raíz del repositorio debe contener un array `agents.json` con el mismo formato de definición de agente que los paquetes de agentes descargables. Un archivo mínimo se ve así:

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

Marinara acepta únicamente URLs de raíz de repositorio de GitHub y valida el archivo comprimido acotado más cada definición de agente antes de mostrar la vista previa. Durante la sincronización, los valores remotos de prompt, ajustes y herramientas reemplazan los valores gestionados por el repositorio que se muestran en esa vista previa. Las elecciones de conexión y de arte permanecen locales. Si un agente desaparece del origen remoto, Marinara lo mantiene como un agente personalizado local normal y elimina solo su enlace al repositorio. Quitar una fuente sigue la misma política de mantener lo local.

### External Extensions

Las importaciones de External Extensions (extensiones externas) requieren dos aceptaciones independientes. Configura `ENABLE_EXTERNAL_EXTENSIONS=true` en `.env`, luego abre **Settings → Advanced → Danger Zone** (Configuración → Avanzado → Zona de peligro), desplázate por debajo de los controles de eliminación de datos, lee la advertencia y activa **Allow third-party extension imports** (Permitir importaciones de extensiones de terceros). Solo entonces aparece la sección **External Extensions** bajo **Settings → Addons**.

La variable de entorno es el permiso del operador del host; el interruptor de la Danger Zone es la aceptación explícita del usuario. La sección, las rutas de importación, las rutas de aprobación y ambos cargadores en tiempo de ejecución aplican la política combinada. Cerrar cualquiera de las dos puertas desactiva los registros externos y detiene el código externo en ejecución. Los registros de extensión almacenados manualmente, heredados, importados de perfil y de origen desconocido se tratan como externos, así que soltar archivos en una carpeta relacionada con extensiones no puede saltarse las puertas.

Los borradores de Professor Mari siguen disponibles sin este indicador. Se crean desactivados y aún requieren la aprobación de su hash de código exacto.

Las Sandboxed Browser Extensions (extensiones de navegador en entorno aislado) siguen siendo la opción predeterminada. Algunos paquetes de terceros más antiguos están marcados como **Full page access** (acceso total a la página) porque dependen del DOM de Marinara. Ese modo ejecuta el código aprobado exacto dentro de la página de Marinara y puede acceder al contenido de la página, al almacenamiento del navegador, a las APIs de red y a la sesión actual del mismo origen. Solo está disponible para las External Extensions después de abrir ambas puertas y requiere una aceptación de advertencia aparte. Desactívalo y recarga la página si la extensión deja cambios visuales o de comportamiento.

## Dónde está el archivo .env

La configuración vive en un archivo llamado `.env`. Es un archivo de texto plano con un ajuste por línea, en la forma `KEY=value`. Las líneas que empiezan con `#` son comentarios y el servidor los ignora.

El archivo `.env` es datos, no un script de shell. Marinara no ejecuta `$`, sustituciones de comandos como `$(...)`, ni otra sintaxis de shell encontrada en un valor. Los lanzadores de macOS/Linux y Termux usan la misma regla de no evaluación para el pequeño conjunto de ajustes que necesitan antes de iniciar el servidor. Un valor ya proporcionado en el entorno del lanzador tiene prioridad sobre la entrada correspondiente de `.env`.

Marinara crea un `.env` vacío por ti la primera vez que arranca, así que no tienes que hacer uno a mano.

- En las instalaciones normales, el archivo `.env` está en la carpeta raíz del proyecto.
- En las imágenes oficiales de Docker o Podman, está en `/app/data/.env`, dentro del mismo volumen de almacenamiento que tus datos.

Un archivo llamado `.env.example` en la misma carpeta lista cada ajuste con su valor predeterminado. Para cambiar un ajuste, copia la línea de `.env.example` en `.env`, luego edita el valor después del signo `=`.

Aquí tienes un `.env` de ejemplo que cambia el puerto y activa una contraseña:

```
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

El servidor lee `.env` por sí mismo, sin importar cómo lo inicies. Esto incluye ejecutar `pnpm start` directamente. Los lanzadores de shell (`start.bat`, `start.sh`, `start-termux.sh`) añaden dos extras. Establecen `HOST=0.0.0.0` para que otros dispositivos puedan llegar al servidor, y abren el navegador por ti. Con `pnpm start` a secas, el servidor escucha solo en esta computadora a menos que establezcas `HOST` tú mismo.

## Reinicio o recarga en caliente

Marinara vigila el archivo `.env` mientras se ejecuta. Cuando guardas un cambio, la mayoría de los ajustes surten efecto en unos 2 segundos, sin reinicio. El servidor escribe una línea de registro que empieza con `[env-watcher]` cada vez que aplica un cambio.

Un pequeño grupo de ajustes de bajo nivel quedan fijados cuando el servidor arranca. Cambiarlos necesita un reinicio completo. Estos ajustes son:

- `PORT`, `HOST`
- `SSL_CERT`, `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`
- `ENCRYPTION_KEY`
- `MARINARA_ENV_FILE`
- `TZ`
- `AUTO_OPEN_BROWSER`, `AUTO_UPDATE_ENABLED`, `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`
- Los ajustes de tiempo de espera y sondeo de imagen, video, sprite y ComfyUI (`IMAGE_GEN_TIMEOUT_MS`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT`, y los cuatro ajustes `*_VIDEO_POLL_INTERVAL_MS`)

Cuando uno de estos cambia, el registro advierte que se requiere un reinicio. Los ajustes de control de acceso y los secretos como `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET` y `CSRF_TRUSTED_ORIGINS` no necesitan un reinicio.

## Control de acceso

El control de acceso decide quién tiene permiso para llegar a un servidor en ejecución. Esta sección es una referencia rápida. Para un recorrido paso a paso con ejemplos, lee [Acceso remoto: Basic Auth y lista de IP permitidas](REMOTE_ACCESS.md).

Algunos términos usados abajo:

- Loopback significa la misma computadora en la que se ejecuta el servidor. Llegas a ella en `127.0.0.1` o `localhost`.
- Un rango CIDR es una forma corta de escribir todo un bloque de direcciones IP, como `192.168.1.0/24`. CIDR significa Classless Inter-Domain Routing (enrutamiento entre dominios sin clases).
- Los rangos RFC 1918 son los rangos de direcciones privadas estándar que se usan dentro de las redes domésticas y de oficina, como `10.x.x.x` y `192.168.x.x`.

De forma predeterminada, cuando no estableces contraseña, el servidor acepta conexiones solo de fuentes de confianza. Estas son loopback, cualquier dirección en `IP_ALLOWLIST`, Tailscale y el tráfico de puente/puerta de enlace de Docker del mismo host. Cualquier otro llamante, incluida tu red doméstica normal, recibe un `403 Forbidden` hasta que eliges una de las opciones de abajo.

Los principales ajustes de control de acceso son:

| Variable                                | Predeterminado    | Qué hace                                                                                                                                              |
| --------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BASIC_AUTH_USER`                       | vacío             | Nombre de usuario para un aviso de contraseña. Configúralo con `BASIC_AUTH_PASS` para exigir un inicio de sesión.                                                                            |
| `BASIC_AUTH_PASS`                       | vacío             | Contraseña para el aviso de inicio de sesión. Deja cualquiera de los dos campos vacío para desactivar el inicio de sesión.                                                                                |
| `BASIC_AUTH_REALM`                      | `Marinara Engine` | Texto que se muestra en el cuadro de contraseña del navegador.                                                                                                                 |
| `IP_ALLOWLIST`                          | vacío             | IPs o rangos CIDR separados por comas que siempre se permiten. Loopback siempre se permite.                                                                   |
| `IP_ALLOWLIST_ENABLED`                  | `true`            | Ponlo en `false` para conservar la lista pero pausar su aplicación.                                                                                                    |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false`           | Restaura el acceso sin contraseña desde redes privadas cuando no hay inicio de sesión configurado.                                                                                  |
| `ALLOW_UNAUTHENTICATED_REMOTE`          | `false`           | Permite el acceso sin contraseña desde cualquier dirección, incluida la internet pública. No recomendado.                                                              |
| `TRUSTED_PRIVATE_NETWORKS`              | valores predeterminados integrados | Reemplaza los rangos de red privada predeterminados. Incluye cualquier valor predeterminado que aún quieras.                                                                         |
| `BYPASS_AUTH_TAILSCALE`                 | automático        | Vacío confía en sockets directos de Tailscale solo cuando ambos extremos usan direcciones de tailnet. Ponlo en `true` para el bypass heredado de todo `100.64.0.0/10` o en `false` para exigir el control de acceso normal. |
| `BYPASS_AUTH_DOCKER`                    | automático        | Vacío confía solo en una interfaz de contenedor detectada y su puerta de enlace exacta. Ponlo en `true` por compatibilidad con redes heredadas o personalizadas, o en `false` para exigir el control de acceso normal. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY`         | `true`            | Exige las comprobaciones normales de inicio de sesión y lista de permitidos para el tráfico de Docker reenviado por un proxy. Ponlo en `false` solo cuando todos los clientes anteriores sean de confianza. |
| `TRUSTED_HOSTS`                         | vacío             | Nombres de host públicos o de proxy inverso adicionales a los que Marinara puede responder. La IP directa, localhost, `.local`, `.home.arpa` y los nombres de LAN de una sola etiqueta funcionan automáticamente. |
| `SSL_CERT`                              | vacío             | Ruta a un archivo de certificado TLS. Configúralo con `SSL_KEY` para servir HTTPS directamente.                                                                               |
| `SSL_KEY`                               | vacío             | Ruta al archivo de clave privada TLS.                                                                                                                         |
| `CSRF_TRUSTED_ORIGINS`                  | vacío             | Orígenes de navegador adicionales con permiso para guardar cambios. Úsalo para un dominio público o un puerto inusual. El valor literal `null` se ignora y no debe usarse para el APK de Android; sus rutas de inicio de sesión con autenticación propia funcionan sin confiar globalmente en un origen opaco. |

Basic Auth es la forma corta de HTTP Basic Authentication (autenticación básica de HTTP), un simple aviso de nombre de usuario y contraseña. Sus credenciales solo están codificadas, no cifradas, así que siempre combínalo con HTTPS cuando tu servidor dé a la internet pública. HTTPS es la versión segura y cifrada de HTTP. Para activarlo directamente, establece tanto `SSL_CERT` como `SSL_KEY`, o pon un proxy inverso delante de Marinara.

Para dejar que otros dispositivos lleguen al servidor siquiera, el servidor debe enlazarse a una interfaz alcanzable. Establece `HOST=0.0.0.0`. Los lanzadores de shell hacen esto por ti, pero `pnpm start` se enlaza solo a loopback.

Los teléfonos, tabletas, pares de Tailscale y otras computadoras pueden seguir conectándose por la dirección IP del servidor sin añadirla a `TRUSTED_HOSTS`. Si publicas Marinara en un nombre de host público o de proxy inverso, añade ese nombre exacto, por ejemplo `TRUSTED_HOSTS=chat.example.com`. Los nombres ya presentes en `CSRF_TRUSTED_ORIGINS` o `CORS_ORIGINS` también se aceptan por compatibilidad. Esta comprobación de Host evita que el nombre DNS de un sitio web público sea reasignado a la dirección loopback de Marinara.

## Almacenamiento

Los ajustes de almacenamiento controlan dónde viven tus datos locales. Tus datos incluyen chats, personajes, avatares y medios generados.

| Variable           | Predeterminado                                | Qué hace                                                             |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------ |
| `DATA_DIR`         | `packages/server/data`                 | Carpeta raíz de todos los datos de usuario. Las imágenes de Docker establecen `/app/data`.            |
| `FILE_STORAGE_DIR` | la carpeta `storage` dentro de `DATA_DIR` | Anula la carpeta de almacenamiento de archivos.                                       |
| `ENCRYPTION_KEY`   | vacío                                  | Clave usada para cifrar las API keys guardadas. Genera una con el comando de abajo. |

Marinara guarda tus datos como archivos JSON simples. Esto hace que las copias de seguridad sean fáciles de copiar e inspeccionar.

Para generar una clave de cifrado, ejecuta este comando y pega el resultado en `ENCRYPTION_KEY`:

```
openssl rand -hex 32
```

Para saber qué contiene cada carpeta de datos, consulta [Dónde se guardan tus datos](data/where-data-is-stored.md).

## Niveles de registro

El registro controla cuánto detalle imprime el servidor en su consola. El control principal es `LOG_LEVEL`. El servidor oculta todo lo que esté por debajo del nivel que elijas.

| Nivel   | Qué muestra                                                       |
| ------- | ------------------------------------------------------------------- |
| `error` | Solo fallos graves e irrecuperables.                               |
| `warn`  | Errores más advertencias no fatales. Este es el predeterminado.                |
| `info`  | Advertencias más registros de arranque y por solicitud.                         |
| `debug` | Todo, incluidos los prompts completos y las respuestas del modelo. Muy detallado. |

Opciones recomendadas:

- Mantén el predeterminado `warn` para uso normal. Es silencioso y muestra solo problemas reales.
- Usa `info` cuando quieras ver las solicitudes y los hitos sin inundar la consola.
- Usa `debug` cuando necesites ver el prompt exacto enviado al modelo y la respuesta. Espera mucha salida.

Para leer los detalles de prompt y conexión sin los registros de solicitud rutinarios, establece un preset en lugar de un nivel:

```
LOG_PRESET=prompt-connections
```

Ese preset muestra el mismo detalle de prompt y modelo que `debug`, pero oculta las líneas de solicitud repetidas como `GET /api/chats`. Para silenciar solo esas líneas de solicitud rutinarias mientras mantienes tu nivel actual, establece esto y reinicia:

```
LOG_DISABLE_REQUEST_LOGGING=true
```

El registro del navegador es aparte y no lo controla `LOG_LEVEL`.

## Tiempos de espera

Un tiempo de espera es el tiempo máximo que el servidor aguarda por un trabajo lento antes de rendirse. Los trabajos de medios como la generación de imágenes y video pueden ser lentos, así que sus tiempos de espera son generosos de forma predeterminada. Todos los valores de tiempo de espera están en milisegundos a menos que el nombre diga lo contrario.

| Variable                               | Predeterminado                              | Qué hace                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHAT_GENERATION_TIMEOUT_MS`           | `300000` (5 minutos)                 | Tiempo de espera de encabezados del proveedor/tiempo hasta el primer token y entre fragmentos para las generaciones ordinarias de Conversation, Roleplay y Game. Rango válido: `10000`-`3600000`. No cambia los tiempos de espera de agente, medios, embedding, herramientas ni trabajos en segundo plano.                                                                                      |
| `AGENT_CALL_TIMEOUT_MS`                | `300000` (5 minutos)                 | Límite de duración total para una llamada LLM de un agente (trackers, reformateador de HTML y otros agentes), aplicado incluso mientras la respuesta aún está en streaming. Súbelo para modelos locales lentos que necesitan más de 5 minutos por pasada de agente. Rango válido: `10000`-`3600000`. El Illustrator mantiene al menos su presupuesto integrado de 30 minutos. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 segundos)                 | Límite de duración total para la llamada al modelo que convierte la escena actual de Game en un prompt de imagen dinámica. Súbelo para modelos locales más lentos. Rango válido: `10000`-`3600000`.                                                                                                                                                     |
| `EMBEDDING_TIMEOUT_MS`                 | `300000` (5 minutos)                 | Tiempo permitido para una solicitud de embedding. Más alto ayuda a los servidores de embedding locales lentos.                                                                                                                                                                                                                                         |
| `IMAGE_GEN_TIMEOUT_MS`                 | `1800000` (30 minutos)               | Tiempo permitido para una solicitud de generación de imágenes.                                                                                                                                                                                                                                                                             |
| `VIDEO_GEN_TIMEOUT_MS`                 | `1800000` (30 minutos)               | Tiempo permitido para una solicitud de generación de video de escena, incluidos los flujos de trabajo de video de ComfyUI local.                                                                                                                                                                                                                              |
| `VIDEO_GEN_MAX_RESPONSE_BYTES`         | `167772160` (160 MiB)                | Mayor descarga de video de escena que el servidor aceptará.                                                                                                                                                                                                                                                                       |
| `COMFYUI_GEN_TIMEOUT`                  | `2400` (40 minutos, en segundos)      | Tiempo permitido para un flujo de trabajo de imagen de ComfyUI después de ponerse en cola.                                                                                                                                                                                                                                            |
| `SPRITE_GENERATION_TIMEOUT_MS`         | recurre a `IMAGE_GEN_TIMEOUT_MS` | Tiempo permitido para un trabajo de generación de sprite (imagen del personaje) por IA.                                                                                                                                                                                                                                                             |
| `CUSTOM_TOOL_TIMEOUT_MS`               | `60000` (1 minuto)                   | Tiempo permitido para una llamada a una herramienta personalizada.                                                                                                                                                                                                                                                                                     |
| `MAX_TOOL_ROUNDS`                      | `100`                                | Máximo de rondas de llamada a herramientas antes de que el modelo deba dar una respuesta final.                                                                                                                                                                                                                                           |

Los tiempos de espera de imagen, video, sprite y ComfyUI quedan fijados al arrancar, así que un cambio en ellos necesita un reinicio. Los tiempos de espera de generación de chat, agente, prompt de imagen dinámica de Game, embedding y herramienta personalizada surten efecto en la siguiente solicitud o ejecución de agente, sin reinicio. Los valores inválidos, cero, negativos o fuera de rango para los tiempos de espera validados de chat, agente o prompt de imagen dinámica de Game registran una advertencia y usan de forma segura sus valores predeterminados documentados. Sube un tiempo de espera de medios cuando los trabajos grandes o de alta calidad fallen a mitad de camino. Para saber más sobre los trabajos de video, consulta [Video de escena](media/scene-video.md).

## APIs privilegiadas (ADMIN_SECRET)

Algunas acciones son destructivas o de alto riesgo, así que necesitan un secreto adicional además de las comprobaciones de acceso normales. Ejemplos son las copias de seguridad, borrar datos, aplicar actualizaciones e instalar temas.

Establece un valor largo y aleatorio para `ADMIN_SECRET` en el servidor:

```
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

En la máquina que ejecuta el servidor (loopback), estas acciones suelen funcionar sin el secreto. Desde otro dispositivo, la app debe enviar el secreto. Pega el mismo valor en la app bajo **Settings** (Configuración), luego **Advanced** (Avanzado), luego **Admin Access** (Acceso de administrador). Después de eso, la app lo envía por ti.

Ajustes privilegiados relacionados:

| Variable                                    | Predeterminado               | Qué hace                                                                                                                                                                          |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_SECRET`                              | vacío                 | Secreto compartido requerido para acciones privilegiadas desde dispositivos remotos.                                                                                                                    |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false`               | Cuando es `true`, requiere el secreto incluso en la máquina local.                                                                                                                           |
| `UPDATES_APPLY_ENABLED`                     | `false`               | Permite que el navegador aplique actualizaciones ordinarias del mismo canal. Un cambio deliberado de canal de versión desde un navegador en la máquina del servidor funciona sin este indicador. Solo instalaciones basadas en Git. |
| `UPDATES_ALLOW_REMOTE_APPLY`                | `false`               | Permite que un dispositivo remoto aplique actualizaciones, con un secreto válido.                                                                                                                         |
| `HAPTICS_ALLOW_REMOTE`                      | `false`               | Permite acciones de dispositivo háptico desde un dispositivo remoto, con un secreto válido.                                                                                                               |
| `CUSTOM_TOOL_SCRIPT_ENABLED`                | `false`               | Activa las herramientas de script personalizadas. Mantenlo desactivado para herramientas no confiables o importadas.                                                                                                                |
| `ENABLE_CUSTOM_AGENT_REPOS`                 | `false`               | Activa la vista previa y sincronización manual de repositorios de agentes de GitHub en Agents Manager. Los agentes de terceros están sin verificar y requieren confirmación explícita antes de importar o actualizar.                 |
| `ENABLE_EXTERNAL_EXTENSIONS`                | `false`               | Primera de las dos puertas para las importaciones de extensiones de terceros. El usuario también debe aceptar bajo Settings → Advanced → Danger Zone.                                                              |
| `IMPORT_ALLOWED_ROOTS`                      | vacío                 | Carpetas del sistema de archivos que la importación masiva puede leer sin un token de selector.                                                                                                                  |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES`           | `268435456` (256 MiB) | Mayor exportación de perfil JSON única que el servidor construirá.                                                                                                                             |

Si `ADMIN_SECRET` no está configurado en el servidor, las acciones privilegiadas fallan desde cualquier dispositivo excepto la máquina local. El error te indica que establezcas el secreto y lo pegues en **Admin Access**.

## Aceptaciones de direcciones locales

De forma predeterminada, las solicitudes salientes a proveedores, servicios de imagen y webhooks se niegan a llegar a direcciones privadas o locales. Esto bloquea una clase de ataque llamada SSRF (server-side request forgery, falsificación de solicitud del lado del servidor), donde se engaña a una solicitud para que llegue a una dirección interna. Las direcciones de proveedor loopback permanecen permitidas para que los servidores de modelos locales sigan funcionando.

Activa solo el interruptor que necesites para un servicio autoalojado en otra máquina de la red privada.

| Variable                      | Predeterminado | Qué hace                                                                         |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | Permite que las URLs de proveedor de IA lleguen a direcciones privadas o de LAN. Activado de forma predeterminada en Android. |
| `IMAGE_LOCAL_URLS_ENABLED`    | `false` | Permite que las URLs de proveedor de imagen lleguen a direcciones privadas o de LAN. Las URLs privadas del resultado de imagen generada aún deben coincidir con el origen exacto del proveedor configurado. |
| `TTS_LOCAL_URLS_ENABLED`      | `false` | Permite que las URLs de texto a voz lleguen a direcciones privadas o de LAN.                    |
| `DEEPLX_LOCAL_URLS_ENABLED`   | `false` | Permite que las URLs de traducción de DeepLX lleguen a direcciones privadas o de LAN.                    |
| `WEBHOOK_LOCAL_URLS_ENABLED`  | `false` | Permite que los webhooks de herramientas personalizadas lleguen a direcciones privadas o de LAN.                       |

Para conectar un modelo local o autoalojado, consulta [Conectar un modelo local o autoalojado](connections/local-self-hosted.md).

## Referencia completa de variables de entorno

Esta sección lista los ajustes restantes, agrupados por propósito. Las tablas de arriba ya cubren el control de acceso, el almacenamiento, el registro, los tiempos de espera, las acciones privilegiadas y las aceptaciones de direcciones locales.

### Servidor y arranque

| Variable                         | Predeterminado                                        | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                           | `7860`                                         | El puerto en el que escucha el servidor. Mantén Android, Docker y Termux en el mismo valor.                                                                                                                                                                                                                                                                                                                                                                                              |
| `HOST`                           | `127.0.0.1` (`0.0.0.0` en los lanzadores de shell) | La interfaz de red a la que enlazar. Usa `0.0.0.0` para acceso por LAN.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `MARINARA_ANDROID_SECRET`        | vacío                                          | Secreto interno de autenticación local para instalaciones de Termux gestionadas por el APK. No es una entrada del instalador: la envoltura de Android lo genera y aprovisiona, y el lanzador de Termux lo exporta automáticamente. No pidas a los usuarios del APK que lo proporcionen ni lo configures en instalaciones normales de escritorio o manuales de Termux. Cuando está configurado, debe tener exactamente 64 caracteres hexadecimales. Un valor no vacío que no sea válido hace que las solicitudes locales del dispositivo fallen con HTTP 503 en vez de debilitar la autenticación. |
| `MARINARA_ANDROID_SECRET_FILE`   | `~/.marinara-engine/android-secret`            | Ruta del archivo de secreto privado que usan el lanzador de Termux y la CLI local `mari`. El APK y el lanzador gestionan este archivo automáticamente; los usuarios normales del APK nunca necesitan leerlo ni copiarlo. |
| `AUTO_OPEN_BROWSER`              | `true`                                         | Si los lanzadores de shell abren la URL de la app por ti. Ponlo en `false` para detener esto. La configuración gestionada por el APK desactiva la apertura automática del navegador en su arranque para que se conecte la app de Android ya autenticada. |
| `AUTO_UPDATE_ENABLED`            | `true`                                         | Si los lanzadores basados en Git de Windows, macOS/Linux y Termux obtienen y aplican actualizaciones del Engine antes de arrancar. Ponlo en `false` para una exclusión persistente; esto surte efecto en el próximo arranque. El lanzador aún realiza una comprobación de solo lectura de nuevas versiones publicadas e imprime un recordatorio de descarga cuando hay una disponible, mientras que las comprobaciones manuales, la aplicación en la app, las actualizaciones de paquetes y las actualizaciones de modelos siguen disponibles. Usa `--skip-update` para saltar ambas comprobaciones del lanzador en un arranque. |
| `MARINARA_ENV_FILE`              | `.env` en la raíz del proyecto                            | Anulación opcional de la ruta del archivo `.env`. Configúrala antes del arranque.                                                                                                                                                                                                                                                                                                                                                                                               |
| `TZ`                             | predeterminado del sistema                                 | Zona horaria de reserva del host para los trabajos del lado del servidor. Los horarios de Conversation usan la zona horaria global seleccionada en sus controles de horario cuando se ha guardado una. Deja `TZ` sin configurar para heredar la zona horaria del host; un `TZ=` vacío también se trata como sin configurar.                                                                                                                                                                                                                 |
| `CORS_ORIGINS`                   | `http://localhost:5173,http://127.0.0.1:5173`  | Orígenes de navegador con permiso para hacer solicitudes de origen cruzado.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true`                                         | Indicador heredado. Las compilaciones actuales no incluyen ninguna clave inicial, así que esto no crea nada. Añade tu propia conexión en la app.                                                                                                                                                                                                                                                                                                                                                                  |

`AUTO_CREATE_DEFAULT_CONNECTION` se mantiene solo para instalaciones más antiguas. Las nuevas compilaciones ya no incluyen una conexión inicial empaquetada, así que dejarlo activado no hace nada. Para empezar a chatear, añade una conexión bajo [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md).

Los controles de horario de Conversation usan de forma predeterminada la zona horaria reportada por el navegador o el dispositivo de la app. **Schedule timezone** (Zona horaria del horario) se puede cambiar durante la configuración de Conversation, en Conversation Chat Settings, o en el editor de horario del personaje. La zona horaria IANA seleccionada es una preferencia global compartida por cada chat de Conversation y sincronizada con otros clientes de Marinara conectados al mismo servidor.

### Herramientas de medios y sprite

| Variable                            | Predeterminado               | Qué hace                                                                                                                                                             |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FFMPEG_PATH`                       | vacío                 | Ruta a un programa `ffmpeg`. Usado para GIFs de expresión animados. Recurre a `ffmpeg` en tu PATH.                                                                     |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 minutos)  | Tiempo permitido para convertir un clip de expresión animada.                                                                                                    |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE`  | `auto`                | Motor de limpieza de sprite. `auto` prueba la limpieza de matte adaptativa antes del respaldo opcional por IA; `builtin` mantiene solo la vía de matte; `backgroundremover` fuerza la herramienta de IA. |
| `BACKGROUNDREMOVER_AUTO_INSTALL`    | `false`               | Cuando es `true`, instala el eliminador de fondo por IA opcional al arrancar.                                                                                      |
| `BACKGROUNDREMOVER_COMMAND`         | vacío                 | Ruta a un programa `backgroundremover` del sistema.                                                                                                            |
| `BACKGROUNDREMOVER_PYTHON`          | vacío                 | Ruta a un programa de Python donde está instalado `backgroundremover`.                                                                                         |
| `BACKGROUNDREMOVER_TIMEOUT_MS`      | `600000` (10 minutos) | Tiempo permitido para una llamada de eliminación de fondo por IA.                                                                                                         |

### Proveedores de video de escena

Los proveedores de video de escena se configuran como conexiones dentro de la app, no como variables de entorno. Los ajustes de abajo solo afinan los trabajos subyacentes. Todos los valores están en milisegundos.

| Variable                            | Predeterminado | Qué hace                                                                                   |
| ----------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | Con qué frecuencia el servidor comprueba un trabajo de Google Veo.                                                  |
| `XAI_VIDEO_POLL_INTERVAL_MS`        | `5000`  | Con qué frecuencia el servidor comprueba un trabajo de xAI Imagine.                                                |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | Con qué frecuencia el servidor comprueba un trabajo de video de OpenRouter.                                           |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS`   | `10000` | Con qué frecuencia el servidor comprueba un trabajo de Seedance.                                                    |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL`   | vacío   | Dirección HTTPS pública de este servidor, usada cuando un proveedor debe obtener una imagen de referencia por URL. |

### Integraciones y extras

| Variable                          | Predeterminado                                    | Qué hace                                                                      |
| --------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| `DOCS_I18N_BASE_URL`              | rama `docs-i18n` oficial                  | De dónde se descargan los paquetes de documentación traducida (**Settings** → **General** → **Documentation Language**). Debe ser un host `https://` público; los forks y espejos pueden apuntarla a su propia copia de la rama `docs-i18n`. |
| `GIPHY_API_KEY`                   | vacío                                      | Clave de Giphy para la búsqueda de GIFs en el modo Conversation. La búsqueda está desactivada cuando no se configura.          |
| `INTIFACE_URL`                    | `ws://127.0.0.1:12345`                     | Dirección predeterminada para la app háptica Intiface.                                      |
| `SPOTIFY_REDIRECT_URI`            | derivada de la solicitud                       | Anulación de la URL de callback de inicio de sesión de Spotify. Configúrala cuando TLS se maneja aguas arriba. |
| `MARI_WIKI_CONTENT_MAX_BYTES`     | `50000`                                    | Mayor contenido de página wiki que Professor Mari lee antes de recortar.                   |
| `MARI_WIKI_REQUEST_TIMEOUT_MS`    | `30000`                                    | Tiempo permitido para una solicitud wiki de Professor Mari.                              |
| `MARI_WIKI_CACHE_TTL_MS`          | `300000`                                   | Cuánto tiempo Professor Mari almacena en caché una lectura wiki.                                       |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (el lanzador de Windows establece `true`) | Permite instalar el runtime del modelo local sin un encabezado de administrador en loopback.    |
| `SSL_CERT`                        | vacío                                      | Ruta a un certificado TLS. Consulta Control de acceso arriba.                                              |
| `SSL_KEY`                         | vacío                                      | Ruta a una clave privada TLS. Consulta Control de acceso arriba.                                              |

Para una clave de Giphy, ten en cuenta que la búsqueda de GIFs sigue no disponible hasta que establezcas `GIPHY_API_KEY` y reinicies. Para el modelo local integrado, consulta [Configuración del modelo local](connections/local-model.md).

## Guías relacionadas

- [Acceso remoto: Basic Auth y lista de IP permitidas](REMOTE_ACCESS.md)
- [Dónde se guardan tus datos](data/where-data-is-stored.md)
- [Conectarse a un proveedor de IA](connections/connecting-to-a-provider.md)
- [Video de escena](media/scene-video.md)
- [Solución de problemas de Marinara Engine](TROUBLESHOOTING.md)
