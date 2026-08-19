# Actualizar Marinara Engine

Esta guía te muestra cómo actualizar Marinara Engine a una versión más reciente. Cubre cada tipo de instalación, las herramientas de actualización dentro de la app y qué hacer si una actualización falla. Tus chats y tu configuración se conservan al actualizar.

## Tus datos se conservan

Actualizar Marinara Engine no borra tus datos. Tus chats, personajes, personas, lorebooks (libros de trasfondo), presets (ajustes guardados), conexiones y configuración se mantienen en su lugar.

Marinara guarda tus datos en una carpeta de datos local, en la máquina que ejecuta el servidor. Docker y Podman los guardan en el volumen `marinara-data`. Actualizar solo reemplaza el código de la app, no esta carpeta de datos ni el volumen.

Cuando actualizas desde una versión que traía agentes propios, mapas, llamadas o juegos de Conversation, el primer arranque descarga sus paquetes opcionales correspondientes desde el catálogo oficial. Se conservan las selecciones de chat existentes, la configuración de los agentes, los datos de ejecución guardados y el historial. Mantén el servidor en línea durante ese primer arranque. Si no se puede llegar al catálogo, Marinara reintenta la migración la próxima vez que arranca, en lugar de borrar o desactivar tu configuración guardada.

Si usas un idioma de documentación descargado (**Settings** → **General** → **Documentation Language**), el primer arranque después de una actualización también revisa ese paquete de idioma y lo actualiza automáticamente si hubo cambios. Si no se puede llegar a la fuente de descarga, Marinara conserva tu paquete instalado (las guías que falten en él se muestran en inglés) y lo intenta de nuevo en el siguiente arranque. Una actualización nunca restablece tu elección de idioma.

Para saber dónde viven tus datos y cómo guardar una copia, consulta [Copia de seguridad y restauración de Marinara](data/backup-and-restore.md).

## Haz primero una copia de seguridad

Las actualizaciones son seguras, pero una copia de seguridad es un seguro barato. Haz una antes de cualquier salto grande entre versiones.

1. Abre **Settings** (Configuración).
2. Ve a la pestaña **Advanced** (Avanzado).
3. Busca la sección **Backup & Export** (Copia de seguridad y exportación).
4. Haz clic en **Download Backup** (Descargar copia de seguridad).
5. Guarda el archivo `.zip` en un lugar seguro.

Deberías ver que el botón cambia a **Creating backup…** mientras trabaja. Cuando termina, tu navegador guarda un archivo `.zip` con tus datos.

Los pasos completos para copias de seguridad y restauración están en [Copia de seguridad y restauración de Marinara](data/backup-and-restore.md).

## Actualizar según la plataforma

Elige la sección que coincide con la forma en que instalaste Marinara. Un "git checkout" a continuación significa una copia instalada con la herramienta Git. Un "clon" es una copia descargada hecha con Git.

### Windows

Si usaste el instalador de Windows o un git checkout, el lanzador te actualiza automáticamente.

1. Cierra Marinara Engine.
2. Ábrelo de nuevo desde el acceso directo del menú Inicio, o ejecuta `start.bat`.

El lanzador obtiene el código más reciente, reinstala lo que cambió, reconstruye la app y arranca la nueva versión. Esto funciona tanto para el instalador como para un clon manual.

Para un solo arranque, ejecuta `start.bat --skip-update`. Para mantener la versión instalada del Engine entre arranques, define `AUTO_UPDATE_ENABLED=false` en el `.env` del proyecto. Esto solo desactiva las actualizaciones automáticas del Engine; los comandos manuales y **Settings → Advanced → Check for Updates** siguen disponibles.

Si el lanzador dice que Node.js es demasiado antiguo, instala Node.js 24 LTS y luego arranca Marinara de nuevo. LTS significa Long Term Support (soporte a largo plazo), la versión estable recomendada de Node.js.

También puedes descargar el instalador más nuevo desde la página de GitHub Releases y ejecutarlo. Usa la misma ruta basada en git, así que las futuras actualizaciones siguen pasando por el lanzador.

### macOS y Linux

Cierra Marinara Engine y luego ejecuta el lanzador desde tu carpeta de Marinara.

```bash
./start.sh
```

El lanzador obtiene el código más reciente, reinstala las dependencias que cambiaron, reconstruye y arranca la nueva versión.

Usa `./start.sh --skip-update` para un solo arranque, o define `AUTO_UPDATE_ENABLED=false` en `.env` para desactivarlo de forma persistente. Los comandos manuales de actualización y los controles de actualización dentro de la app siguen disponibles.

Si dice que Node.js es demasiado antiguo, instala Node.js 24 LTS y luego ejecuta el lanzador de nuevo.

### Docker o Podman

Las instalaciones en contenedor se actualizan descargando una imagen nueva, no a través del lanzador. Ejecuta esto desde la carpeta que contiene tu archivo Compose.

```bash
docker compose down && docker compose pull && docker compose up -d
```

Para Podman, usa los mismos comandos con `podman`.

```bash
podman compose down && podman compose pull && podman compose up -d
```

Las imágenes de lanzamiento se publican como `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` y `:latest`, más las etiquetas `-lite` correspondientes. Descarga `:latest` o la etiqueta de versión más nueva, salvo que quieras quedarte en una versión más antigua a propósito. Tus datos en el volumen `marinara-data` no se tocan al descargar.

### Android (Termux)

Termux es una terminal y un entorno Linux para Android. Su lanzador actualiza Marinara cada vez que lo ejecutas.

1. Abre Termux.
2. Ejecuta el lanzador.

```bash
cd Marinara-Engine
./start-termux.sh
```

El lanzador actualiza el código, mejora Node.js cuando hace falta, reconstruye y arranca el servidor local.

Si una actualización está rota y necesitas quedarte en tu copia actual, omite la comprobación de actualización en su lugar.

```bash
cd Marinara-Engine
./start-termux.sh --skip-update
```

Para desactivarlo de forma persistente, define `AUTO_UPDATE_ENABLED=false` en el `.env` del proyecto. Esto afecta solo a las actualizaciones del Engine gestionadas por el lanzador; las actualizaciones manuales y los controles de actualización dentro de la app siguen disponibles.

Si usas el icono de la app de Android (el APK), [descarga el APK más reciente](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) y abre el archivo descargado para que Android actualice la propia envoltura. Después abre Marinara Engine y toca **Install / Start Marinara** para actualizar e iniciar la copia de Termux. La app conserva e intercambia automáticamente su credencial privada de localhost; una actualización nunca pide credenciales de firma ni ese secreto.

### iPhone y iPad

El iPhone y el iPad no ejecutan el servidor de Marinara. Abren un servidor que se ejecuta en otro dispositivo a través de Safari. La copia en tu pantalla de inicio es una PWA, abreviatura de Progressive Web App. Una PWA es un sitio web que agregas a tu pantalla de inicio para que se abra como una app.

1. Actualiza la computadora, el host de Docker o el dispositivo Android que realmente ejecuta tu servidor de Marinara. Usa la sección de ese dispositivo más arriba.
2. Vuelve a cargar la PWA de la pantalla de inicio o la pestaña de Safari en tu iPhone o iPad.

Si Safari sigue mostrando una compilación más antigua después de actualizar el host, restablece la copia en caché.

1. Quita el icono de la pantalla de inicio.
2. Borra los datos del sitio web de Safari para el host de Marinara.
3. Agrégalo de nuevo a la pantalla de inicio.

## Comprobar y aplicar actualizaciones en la app

Marinara puede comprobar en GitHub si hay una versión más reciente desde dentro de la app. Algunas instalaciones también pueden aplicar la actualización desde el navegador.

1. Abre **Settings**.
2. Ve a la pestaña **Advanced**.
3. Busca la sección **Updates** (Actualizaciones).

### Release Channel

El menú desplegable **Release Channel** (Canal de lanzamiento) elige qué compilaciones sigues. Tiene dos opciones.

- **Latest Stable**: sigue los lanzamientos etiquetados como `vX.Y.Z`. Esta es la opción normal para la mayoría de los usuarios.
- **Staging/UAT**: sigue las compilaciones de prueba previas al lanzamiento. Pueden estar sin terminar. Haz una copia de seguridad de tus datos antes de usarlas.

Elegir **Staging/UAT** muestra un aviso: "Staging builds are pre-release tester builds. Back up your app data before applying them."

Cambiar de canal se trata como una decisión deliberada. Cuando eliges un canal distinto desde un navegador en la máquina que ejecuta el servidor, el botón de actualización cambia a **Switch to** seguido del nombre del canal, y funciona incluso cuando las actualizaciones normales dentro de la app están desactivadas. Muestra **Switching…** mientras se ejecuta. Las actualizaciones normales dentro del mismo canal siguen necesitando la configuración descrita en Apply Update más abajo, y los dispositivos remotos siempre la necesitan.

### Check for Updates

Haz clic en **Check for Updates** (Comprobar actualizaciones). El botón muestra **Checking…** mientras trabaja.

Debajo del botón ves tu versión **Release** y el código de commit de tu **Build**. También aparece una línea **Branch** cuando se conoce la rama.

- Si estás al día, una fila con una marca verde dice "You're on the latest ... target" con tu versión.
- Si existe una versión más reciente, una tarjeta muestra "vX.Y.Z available" con un enlace **Release notes**.
- En una instalación de git que simplemente está atrasada, la tarjeta muestra "N commits behind" en su lugar. Un commit es un cambio guardado en el código, así que este conteo puede incluir trabajo aún no lanzado.

Los resultados de la comprobación de actualización se guardan en caché. La comprobación de la versión de lanzamiento se guarda en caché durante unos 15 minutos. El conteo de "commits behind" se guarda en caché durante unos 5 minutos. Hacer clic en **Check for Updates** otra vez de inmediato puede mostrar los mismos números.

### Apply Update

El botón **Apply Update** (Aplicar actualización) aparece solo cuando tu instalación puede actualizarse a sí misma desde el navegador. Esto necesita las dos condiciones siguientes.

- Una instalación basada en git (Docker y las instalaciones empaquetadas no pueden actualizar de esta forma).
- El propietario del servidor definió `UPDATES_APPLY_ENABLED=true` en el archivo `.env` del servidor. Un archivo `.env` contiene la configuración del servidor.

Si haces clic en **Apply Update** en la máquina que ejecuta el servidor, con esto basta. Ahí no se necesita ningún secreto.

Aplicar desde un dispositivo distinto está desactivado de forma predeterminada. Necesita las tres condiciones siguientes.

- El propietario del servidor definió `UPDATES_ALLOW_REMOTE_APPLY=true` en `.env`.
- El propietario del servidor definió `ADMIN_SECRET` (una contraseña para acciones protegidas) en `.env`.
- Guardaste ese mismo secreto en **Settings -> Advanced -> Admin Access** en tu dispositivo.

Cuando haces clic en **Apply Update**, el botón muestra **Updating...**. El servidor obtiene el código nuevo, reinstala las dependencias, reconstruye y luego se apaga. Después ves: "Update applied successfully. Please relaunch the app to use the new version." Arranca Marinara de nuevo para terminar.

Si **Apply Update** no está disponible, Marinara muestra por qué y qué hacer en su lugar.

- Las instalaciones en contenedor muestran la etiqueta de la imagen y el comando `docker compose pull && docker compose up -d` para ejecutar en el host.
- Las instalaciones de git con la aplicación de actualizaciones desactivada muestran un comando de actualización manual que puedes copiar.
- Otras instalaciones muestran un enlace **Download** al lanzamiento de GitHub.

Si la comprobación en sí falla, ves: "Could not check for updates. Try again later." Esto suele indicar un problema de red o de GitHub, así que inténtalo de nuevo en un momento.

## El botón Refresh App

El botón **Refresh App** (Refrescar app) está en la misma sección **Updates**. No es una actualización del servidor. Solo refresca la app en tu navegador actual.

**Refresh App** cancela el registro del service worker y borra las cachés del navegador, luego vuelve a cargar la página. Un service worker es un pequeño script que tu navegador usa para cargar la app rápido y sin conexión. Tus chats guardados, tu configuración y otros datos locales quedan intactos.

Usa **Refresh App** cuando la app se ve desactualizada o muestra una pantalla en blanco después de una actualización, pero el servidor ya está ejecutando la nueva versión. Arregla una página web atascada. No cambia el código del servidor, así que no sustituye a una actualización real.

El botón muestra **Refreshing…** mientras trabaja, y luego la app se vuelve a cargar.

## Volver a una versión anterior

Actualizar siempre es seguro, pero no siempre es posible volver atrás directamente. Las versiones nuevas de Marinara guardan los mensajes de chat en un formato de disco más reciente, y una versión anterior al formato de tus datos no puede leerlos. Para proteger tu historial, el lanzador omite las actualizaciones automáticas que llevarían a una versión incompatible y el actualizador de la app se niega a aplicarlas.

Si necesitas una versión anterior de todos modos, un comando de conversión devuelve primero tus datos al formato antiguo. Consulta [Los chats no muestran mensajes después de cambiar a una versión anterior](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version) para ver los pasos.

## Si una actualización falla

La mayoría de los problemas de actualización vienen de una versión antigua de Node.js, una descarga parcial o una caché del navegador desactualizada.

- Si el lanzador informa que Node.js es demasiado antiguo, instala Node.js 24 LTS y arranca de nuevo.
- Si la app se ve rota después de que el servidor se actualizó, prueba el botón **Refresh App** de más arriba.
- Si una instalación de git no puede actualizar de forma limpia, ejecuta los comandos de actualización manual de tu plataforma que se muestran en esa guía de instalación.

Para mensajes de error y soluciones paso a paso, consulta [Solución de problemas de Marinara Engine](TROUBLESHOOTING.md).

## Guías relacionadas

- [Copia de seguridad y restauración de Marinara](data/backup-and-restore.md)
- [Solución de problemas de Marinara Engine](TROUBLESHOOTING.md)
- [Guía de instalación en Windows](installation/windows.md)
- [Guía de instalación en macOS / Linux](installation/macos-linux.md)
- [Ejecutar mediante contenedor (Docker / Podman)](installation/containers.md)
- [Guía de instalación en Android (Termux)](installation/android-termux.md)
- [Guía de PWA para iOS / iPadOS](installation/ios-pwa.md)
