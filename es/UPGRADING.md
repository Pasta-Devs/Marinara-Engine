# Actualizar Marinara Engine

Actualiza Marinara Engine a una versión más reciente, busca actualizaciones en la app y vuelve atrás si algo se rompe. Tus chats y tu configuración se conservan al actualizar.

## ¿Qué método de actualización es el mío?

| Cómo lo instalaste | Cómo actualizar |
| --- | --- |
| Instalador de Windows o `start.bat` | Cierra Marinara y ábrela de nuevo. Consulta [Windows](#windows). |
| macOS o Linux | Vuelve a ejecutar `./start.sh`. Consulta [macOS y Linux](#macos-and-linux). |
| Docker o Podman | Descarga la imagen nueva y reinicia. Consulta [Docker o Podman](#docker-or-podman). |
| App de Android | Actualiza el APK y luego toca **Install / Start Marinara**. Consulta [Android (Termux)](#android-termux). |
| iPhone o iPad | Actualiza el dispositivo del servidor. Consulta [iPhone y iPad](#iphone-and-ipad). |

<a id="back-up-first"></a>

## Haz primero una copia de seguridad

Haz una copia de seguridad antes de cualquier salto grande, y siempre antes de que puedas volver a una versión anterior.

1. Abre **Settings** (Configuración).
2. Ve a la pestaña **Advanced** (Avanzado).
3. Busca la sección **Backup & Export** (Copia de seguridad y exportación).
4. Haz clic en **Download Backup** (Descargar copia de seguridad).
5. Guarda el archivo `.zip` en un lugar seguro.

El botón muestra **Creating backup…** mientras trabaja. Cuando termina, tu navegador guarda un `.zip` con tus datos. Para restaurar, consulta [Copia de seguridad y restauración de Marinara](data/backup-and-restore.md).

## Actualizar según la plataforma

Elige la sección que coincide con la forma en que instalaste Marinara. Una copia de git es una copia instalada con la herramienta Git, lo que incluye el instalador de Windows y cualquier `git clone`.

### Windows

El lanzador actualiza Marinara cuando la inicias.

1. Cierra Marinara Engine.
2. Ábrela de nuevo desde el acceso directo del escritorio o del menú Inicio, o ejecuta `start.bat`.

El lanzador obtiene el código más reciente, reinstala lo que cambió, recompila y arranca la nueva versión. Si cambiaste el código tú mismo, aparta tus cambios y los vuelve a poner después de la actualización. Si no puede, mantiene tu versión actual e imprime una nota. Copia tus datos antes de actualizar, y omite una actualización que llevaría a una versión más antigua que tus datos (consulta [Volver a una versión anterior](#downgrading-to-an-older-version)).

Para omitir la actualización una vez, ejecuta `start.bat --skip-update`. Para mantener la versión instalada entre inicios, define `AUTO_UPDATE_ENABLED=false` en el `.env` del proyecto. Esto solo desactiva las actualizaciones automáticas. Los comandos manuales y **Settings → Advanced → Check for Updates** siguen funcionando.

Si el lanzador dice que Node.js es demasiado antiguo, instala Node.js 24 LTS (Long Term Support, soporte a largo plazo, la versión estable recomendada) y luego vuelve a iniciar Marinara. También puedes descargar el instalador más nuevo desde la página de GitHub Releases y ejecutarlo.

<a id="macos-and-linux"></a>

### macOS y Linux

1. Cierra Marinara Engine.
2. Ejecuta el lanzador desde tu carpeta de Marinara.

```bash
./start.sh
```

El lanzador obtiene el código más reciente, reinstala las dependencias que cambiaron, recompila y arranca la nueva versión. Usa `./start.sh --skip-update` para omitirla una vez, o `AUTO_UPDATE_ENABLED=false` en `.env` para desactivar las actualizaciones automáticas. Si Node.js es demasiado antiguo, instala Node.js 24 LTS y vuelve a ejecutar el lanzador.

<a id="docker-or-podman"></a>

### Docker o Podman

Los contenedores se actualizan descargando una imagen nueva, no a través del lanzador. Haz una copia de seguridad y luego ejecuta esto desde la carpeta que contiene tu archivo Compose.

```bash
docker compose pull && docker compose up -d
```

Con Podman, usa `podman compose` en su lugar. Las imágenes de lanzamiento son `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` y `:latest`, más las etiquetas `-lite` correspondientes. Una descarga no toca tus datos en el volumen `marinara-data`. Consulta [Instalación en contenedor](installation/containers.md).

### Android (Termux)

Termux es la app de Android que ejecuta un pequeño sistema Linux para Marinara. Su lanzador actualiza Marinara cada vez que lo ejecutas.

1. Abre Termux.
2. Ejecuta el lanzador.

```bash
cd Marinara-Engine
./start-termux.sh
```

El lanzador actualiza el código, actualiza Node.js si hace falta, recompila y arranca el servidor. Si una actualización rompe algo y quieres quedarte en tu copia actual, añade `--skip-update`. Para desactivar las actualizaciones automáticas, define `AUTO_UPDATE_ENABLED=false` en el `.env` del proyecto.

Si usas la app de Android (el APK), [descarga el APK más reciente](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) y ábrelo para que Android actualice la app. Después abre Marinara Engine y toca **Install / Start Marinara** para actualizar e iniciar la copia de Termux. Una actualización nunca te pide credenciales de firma ni un secreto.

<a id="iphone-and-ipad"></a>

### iPhone y iPad

Estos dispositivos no ejecutan el servidor. El icono de la pantalla de inicio es una PWA, un sitio web guardado en la pantalla de inicio que se abre como una app.

1. Actualiza la computadora, el host de contenedores o el dispositivo Android que ejecuta tu servidor de Marinara. Usa su sección de arriba.
2. Vuelve a cargar la app de la pantalla de inicio o la pestaña de Safari.

Si Safari sigue mostrando una compilación más antigua, reinstala la PWA. Consulta [Borrar y reinstalar la PWA](installation/ios-pwa.md#clearing-and-reinstalling-the-pwa).

<a id="manual-update-git-copy-no-launcher"></a>

### Actualización manual (copia de git, sin lanzador)

Usa esto si ejecutas una copia de git con `pnpm start` en lugar del lanzador. Ejecuta esto desde la carpeta de Marinara.

1. Obtén el código estable más reciente.

```bash
git fetch origin +refs/heads/main:refs/remotes/origin/main
```

2. Muévete a él.

```bash
git merge --ff-only origin/main || git checkout --detach origin/main
```

3. Reinstala las dependencias, recompila e inicia.

```bash
pnpm install --force --frozen-lockfile
pnpm build
pnpm start
```

Para la versión staging (de pruebas), ejecuta estos dos comandos en lugar de los pasos 1 y 2:

```bash
git fetch origin +refs/heads/staging:refs/remotes/origin/staging
git checkout -B staging origin/staging
```

> **Advertencia:** las compilaciones staging son compilaciones de prueba previas al lanzamiento. Haz una copia de seguridad de tus datos antes de usarlas.

## Actualizar desde dentro de la app

Marinara puede comprobar en GitHub si hay una versión más reciente. Algunas instalaciones también pueden aplicar la actualización desde el navegador.

1. Abre **Settings**.
2. Ve a la pestaña **Advanced**.
3. Busca la sección **Updates** (Actualizaciones).

### Elige un canal de lanzamiento

**Release Channel** (Canal de lanzamiento) establece qué compilaciones sigues.

- **Latest Stable:** los lanzamientos etiquetados como `vX.Y.Z`. Esta es la opción normal.
- **Staging/UAT:** compilaciones de prueba previas al lanzamiento, que pueden estar sin terminar. Elegirla muestra el aviso "Staging builds are pre-release tester builds. Back up your app data before applying them."

Cuando eliges un canal distinto en un navegador de la propia computadora del servidor, el botón de actualización dice **Switch to** seguido del nombre del canal. Funciona incluso cuando las actualizaciones normales dentro de la app están desactivadas, y muestra **Switching…** mientras se ejecuta. Los dispositivos remotos no pueden hacerlo salvo que cumplan las condiciones de **Apply Update** de abajo.

### Check for Updates

Haz clic en **Check for Updates** (Comprobar actualizaciones). El botón muestra **Checking…** mientras trabaja. Debajo ves tu versión **Release**, el código de commit de tu **Build** y, cuando se conoce, tu **Branch**.

- Si estás al día, una fila verde dice "You're on the latest" con tu versión.
- Si existe una versión más reciente, una tarjeta muestra "vX.Y.Z available" con un enlace **Release notes**.
- Si una copia de git está atrasada, la tarjeta muestra "N commits behind". Un commit es un cambio guardado en el código, así que el conteo puede incluir trabajo aún no lanzado.

La comprobación de la versión de lanzamiento se guarda en caché durante unos 15 minutos y el conteo de commits durante unos 5 minutos, así que un segundo clic inmediato puede mostrar los mismos números.

Si la comprobación falla, ves "Could not check for updates. Try again later." Esto suele indicar un problema de red o de GitHub.

### Apply Update

**Apply Update** (Aplicar actualización) actualiza una copia de git desde el navegador. Aparece solo cuando se cumplen todas estas condiciones:

- La instalación es una copia de git. Los contenedores y otras instalaciones no pueden aplicar de esta forma.
- La rama es `main`, `master` o `staging`, o un checkout desacoplado (detached). Una copia en cualquier otra rama cuenta como un checkout de desarrollo y Marinara se niega.
- El dueño del servidor definió `UPDATES_APPLY_ENABLED=true` en el archivo `.env` del servidor.
- `UPDATES_APPLY_DISABLED` no está definido. Bloquea toda aplicación, incluido el cambio de canal, y los lanzadores de desarrollo lo definen.

No necesitas el secreto de administrador para aplicar desde la computadora que ejecuta el servidor. Abre Marinara en `http://127.0.0.1:7860` o `http://localhost:7860`.

Dos ajustes cambian esto:

- Una dirección servida por un proxy inverso o un túnel cuenta como otro dispositivo. `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false` hace que esos visitantes cuenten como locales, incluida la excepción local del secreto de administrador. Mantenlo activado para un proxy o un túnel públicos.
- `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true` hace que incluso las solicitudes locales necesiten el secreto.

Aplicar desde otro dispositivo está desactivado de forma predeterminada. Necesita estas tres condiciones:

- `UPDATES_ALLOW_REMOTE_APPLY=true` en el `.env` del servidor.
- `ADMIN_SECRET` definido en el `.env` del servidor. Es una segunda contraseña para acciones arriesgadas.
- El mismo secreto guardado en tu dispositivo en **Settings → Advanced → Admin Access** (Configuración → Avanzado → Acceso de administrador).

Haz clic en **Apply Update**. El botón muestra **Updating…** mientras el servidor obtiene el código, reinstala, recompila y se apaga. Luego ves "Update applied successfully. Please relaunch the app to use the new version." Vuelve a iniciar Marinara para terminar.

Si no funcionó: cuando falta **Apply Update**, Marinara muestra por qué.

- Las instalaciones en contenedor muestran la etiqueta de la imagen y el comando `docker compose pull && docker compose up -d` para ejecutar en el host.
- Las copias de git con la aplicación desactivada muestran un comando manual que puedes copiar.
- Otras instalaciones muestran un enlace **Download** al lanzamiento de GitHub.

## Refrescar la app en tu navegador

**Refresh App** (Refrescar app) está en la misma sección **Updates**. No actualiza el servidor. Quita el service worker (un pequeño script que tu navegador usa para cargar la app rápido) y borra las cachés del navegador, y luego vuelve a cargar la página. Tus chats y tu configuración se quedan.

Úsalo cuando la app se ve antigua o en blanco después de que el servidor ya se actualizó. El botón muestra **Refreshing…** mientras trabaja.

## Tus datos y las descargas opcionales

Actualizar reemplaza el código de la app, no tu carpeta de datos ni el volumen `marinara-data`. Tus chats, personajes, personas, lorebooks (libros de trasfondo), presets (ajustes guardados), conexiones y configuración se mantienen en su lugar. Para saber dónde viven los datos, lee [Copia de seguridad y restauración de Marinara](data/backup-and-restore.md).

- **Paquetes opcionales.** Cuando actualizas desde una versión que traía agentes propios, mapas, llamadas o juegos de Conversation, el primer arranque descarga sus paquetes opcionales correspondientes. Tus selecciones, ajustes e historial se conservan. Mantén el servidor en línea durante ese primer arranque. Si no se puede llegar a la fuente de descarga, Marinara lo intenta de nuevo en el siguiente arranque y no borra nada.
- **Idioma de las guías.** Si usas un idioma de documentación descargado (**Settings → General → Documentation Language**), el primer arranque después de una actualización lo actualiza. Si no se puede llegar a la fuente, Marinara conserva tu paquete instalado, muestra en inglés las guías que falten y lo intenta de nuevo en el siguiente arranque.
- **Idioma de la interfaz.** Los paquetes de idioma de la interfaz son una descarga aparte y manual. En la primera actualización desde una versión con las traducciones incluidas, la interfaz vuelve al inglés. Elige de nuevo tu idioma en **Settings → General → Language** (Configuración → General → Idioma). Las actualizaciones posteriores conservan los paquetes descargados. Usa **Refresh language pack** (Actualizar el paquete de idioma) para obtener traducciones nuevas. Las traducciones que faltan se muestran en inglés.

## Actualizar desde 2.5.0

Los pasos de arriba son los mismos. Algunos cambios afectan a un servidor que usan otros dispositivos u otras personas. Abre los detalles si es tu caso.

<details>
<summary>Cambios para servidores compartidos</summary>

- **Un proxy inverso o un túnel en la misma computadora.** Los visitantes que nginx, Caddy, Cloudflare Tunnel, Tailscale Serve o ngrok pasan a Marinara ahora cuentan como remotos. Sin un inicio de sesión ven la página de configuración, y las copias de seguridad y otras acciones protegidas necesitan el secreto de administrador. Consulta [Proxies inversos y túneles en la misma computadora](REMOTE_ACCESS.md#reverse-proxies-and-tunnels-on-the-same-computer).
- **Bypass de inicio de sesión de Tailscale.** Las conexiones directas a la dirección Tailscale de esta computadora siguen saltándose el inicio de sesión. Otras conexiones desde `100.64.0.0/10` ya no se lo saltan, y los visitantes de Tailscale Serve y Funnel necesitan un inicio de sesión. Consulta [Bypass de Tailscale y Docker](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Docker con contraseña o con lista permitida.** Con un inicio de sesión configurado (de la app o Basic Auth), el navegador de la computadora host ahora también lo pide. Lo mismo ocurre con `TRUSTED_AUTH_PROXY`, salvo que el proxy sea el que se conecta. Si solo está configurado `IP_ALLOWLIST`, el navegador del host se rechaza salvo que añadas a la lista la puerta de enlace del contenedor, así que usa un inicio de sesión. Consulta [Bypass de Tailscale y Docker](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Chats y perfiles llevados a otra instalación.** Un registro de chat, un perfil de ajustes o un perfil completo ya no lleva su **Discord Mirror**, **DeepLX URL** (URL de DeepLX), **DeepL API Key** (API key de DeepL) ni **Intiface URL** (URL de Intiface) a otra instalación. Vuelve a introducirlos allí. Tus propios perfiles, y un perfil completo restaurado en la misma instalación, los conservan.
- **¿Bloqueado después de actualizar?** Consulta [Bloqueado después de actualizar](REMOTE_ACCESS.md#locked-out-after-updating).

</details>

<a id="downgrading-to-an-older-version"></a>

## Volver a una versión anterior

Volver atrás no siempre es posible. Las versiones nuevas guardan los datos en un formato de almacenamiento más reciente, y una compilación rechaza datos en un formato más reciente que el que conoce. Las compilaciones actuales usan el formato de almacenamiento 10. Los formatos 8, 9 y 10 añadieron los avatares MMD, los vínculos de conexiones con cuentas y los avatares GLB/FBX. Una compilación que solo conoce un formato más antiguo no puede abrir datos guardados en ellos.

El lanzador omite una actualización automática que llevaría a una versión incompatible, y el actualizador de la app se niega a aplicarla. Para volver a una compilación anterior, detén Marinara y restaura una copia de seguridad completa hecha antes de actualizar. El comando de conversión de archivos de chat de abajo no puede convertir los ajustes de los avatares MMD. No cambies el número de formato a mano.

Si tus datos son anteriores al formato de almacenamiento 8, una conversión de un solo comando puede devolver los archivos de chat a la estructura anterior. Consulta [Los chats no muestran mensajes después de cambiar a una versión anterior](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version).

<a id="going-back-to-250"></a>

### Volver a 2.5.0

La versión 2.5.0 no puede abrir datos actualizados al formato de almacenamiento 8 o posterior. Usa una copia de seguridad hecha antes de la actualización.

Con datos antiguos que 2.5.0 sí puede abrir, esa versión no conoce lo que añadieron las funciones más nuevas: algunos ajustes de conexión, los detalles que se usan para regenerar las imágenes del chat, y partes de los puntos de control de las partidas, de los relojes de los conjuntos de reglas y de los videos de escena. Cuando 2.5.0 guarda un chat o una conexión, por ejemplo cuando envías un mensaje, juegas un turno de una partida, creas una imagen o cambias una conexión, elimina esos datos más nuevos de todo el chat o de toda la conexión. Volver a actualizar no los recupera.

Para volver exactamente adonde estabas, haz una copia de seguridad antes de actualizar. Consulta [Haz primero una copia de seguridad](#back-up-first).

## Si una actualización falla

La mayoría de los fallos vienen de una versión antigua de Node.js, una descarga parcial o una caché del navegador desactualizada.

- Si el lanzador dice que Node.js es demasiado antiguo, instala Node.js 24 LTS y vuelve a iniciar.
- Si la app se ve rota después de que el servidor se actualizó, haz clic en **Refresh App**.
- Si una copia de git no puede actualizarse de forma limpia, usa los comandos de [actualización manual](#manual-update-git-copy-no-launcher).

Para mensajes de error y soluciones, consulta [Solución de problemas de Marinara Engine](TROUBLESHOOTING.md).

## Guías relacionadas

- [Copia de seguridad y restauración de Marinara](data/backup-and-restore.md)
- [Solución de problemas de Marinara Engine](TROUBLESHOOTING.md)
- [Guía de instalación en Windows](installation/windows.md)
- [Guía de instalación en macOS / Linux](installation/macos-linux.md)
- [Ejecutar mediante contenedor (Docker / Podman)](installation/containers.md)
- [Guía de instalación en Android (Termux)](installation/android-termux.md)
- [Guía de PWA para iOS / iPadOS](installation/ios-pwa.md)
