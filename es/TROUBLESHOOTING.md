# Solución de problemas de Marinara Engine

Busca tu síntoma y sigue la solución. La mayoría de los problemas se resuelven si reinicias Marinara con su lanzador (`start.bat`, `start.sh` o `start-termux.sh`).

## Primeras cosas que probar

1. Haz una recarga forzada de la página: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> en Windows o Linux, <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> en una Mac.
2. Mira la consola del servidor (la ventana de terminal que ejecuta Marinara) por si aparecen líneas de error en rojo. Normalmente nombran el problema real.
3. Para pedir ayuda, activa primero **Debug mode** (Modo de depuración). Consulta [Cómo obtener más ayuda](#get-more-help).

<a id="my-character-does-not-reply"></a>

## Mi personaje no responde

Revisa esto en orden.

1. Busca un aviso (un mensaje breve en la parte inferior de la pantalla). Normalmente nombra el problema. Consulta [Errores de conexión y de generación](#connection-and-generation-errors).
2. Comprueba que el chat tiene una cuenta y un modelo: abre **Chat Settings** (Ajustes del chat) y mira la conexión. Si no hay ninguna, añade una cuenta en **Connections** (Conexiones). Consulta [Conectar a un proveedor de IA](connections/connecting-to-a-provider.md).
3. Comprueba que la API key (clave de API) es correcta y que la cuenta tiene crédito. Una clave incorrecta o un saldo vacío son una causa habitual.
4. Comprueba el nombre del modelo y, en un servidor local como Ollama o LM Studio, que el servidor esté en marcha.
5. Envía tu mensaje de nuevo, o elige otro modelo.

Si nada funciona, activa **Debug mode** y lee la consola del servidor. Consulta [Cómo obtener más ayuda](#get-more-help).

## La app no carga en un teléfono u otro dispositivo

¿No puedes abrir Marinara desde un teléfono, una tableta u otra computadora?

Lo más frecuente es una de estas tres causas:

- **Dirección.** El servidor escucha en `127.0.0.1` (solo esta computadora) de forma predeterminada. Los lanzadores fijan `HOST=0.0.0.0`. Si iniciaste con `pnpm start`, fija primero `HOST=0.0.0.0` en `.env`.
- **Red.** Ambos dispositivos deben estar en la misma red Wi-Fi, y ningún firewall debe bloquear el puerto. El puerto predeterminado es `7860`, o tu `PORT`.
- **Inicio de sesión.** Configura uno. En el dispositivo bloqueado, escribe el código de configuración de un solo uso del registro del servidor con un nombre de usuario y una contraseña nuevos. En Docker, busca el código con `docker logs <container> 2>&1 | grep "setup code"`. O configúralo en **Settings → Advanced → Access** (Configuración → Avanzado → Acceso) en un navegador que ya haya iniciado sesión. En un servidor sin pantalla, ejecuta `ssh -L 7860:127.0.0.1:7860 user@server`, abre `http://localhost:7860` y usa **Settings**. Consulta [Acceso remoto](REMOTE_ACCESS.md#option-1-login-recommended).

Más causas:

- **Proxy o túnel en la misma máquina.** Un proxy inverso o un túnel en la misma máquina necesita el inicio de sesión. El tráfico directo por Tailscale es de confianza de forma predeterminada. Tailscale Serve o Funnel y el `proxy_pass` HTTP/1.0 predeterminado de nginx cuentan como reenviados y necesitan el inicio de sesión. El tráfico del puente Docker del mismo host solo es de confianza mientras no haya ningún inicio de sesión, `IP_ALLOWLIST` ni `TRUSTED_AUTH_PROXY` configurados.
- **Nombre personalizado para esta computadora.** Un nombre que apunta a `127.0.0.1` en `/etc/hosts` cuenta como reenviado. Usa en su lugar `localhost`, `127.0.0.1`, el nombre de host de la máquina o un nombre `*.localhost`.
- **Too many wrong passwords (Demasiadas contraseñas incorrectas).** Espera 15 minutos y luego inicia sesión. ¿Olvidaste la contraseña? Ejecuta `node scripts/reset-login.mjs` en la carpeta de Marinara de la computadora que ejecuta Marinara. En Docker, ejecuta `docker exec <container> node scripts/reset-login.mjs`. Reiniciar el servidor también le permite volver a intentarlo.
- **Untrusted request host (Host de solicitud no confiable).** Para un dominio público o de proxy inverso, añade su nombre de host exacto a `TRUSTED_HOSTS` en `.env`. Las direcciones IP directas se siguen aceptando.
- **Acciones de riesgo bloqueadas** (copias de seguridad, borrado de datos, actualizaciones) desde ese dispositivo. En la propia computadora del servidor, abre **Settings → Advanced → Admin Access** (Configuración → Avanzado → Acceso de administrador) y haz clic en **Make admin secret** (Crear secreto de admin), o fija `ADMIN_SECRET` en el `.env` del servidor. Escribe el secreto en **Admin Access** en el otro dispositivo y haz clic en **Save** (Guardar).

Consulta [Acceso remoto](REMOTE_ACCESS.md) y las [Preguntas frecuentes](FAQ.md). Si te quedaste bloqueado después de una actualización, consulta [Bloqueado después de actualizar](REMOTE_ACCESS.md#locked-out-after-updating).

## Guardado bloqueado, o ajustes que no persisten

Un guardado parece funcionar, pero se revierte al recargar. La protección entre sitios (CSRF) lo está bloqueando porque no confía en esta dirección del navegador. Verás un banner rojo que dice que los guardados fallarán en silencio, o un aviso titulado **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** o **Save blocked: origin not trusted**.

Loopback, las direcciones de red privada, Tailscale y el puente Docker son de confianza automáticamente. Esto ocurre sobre todo con una IP pública o un nombre de dominio. Añade la dirección a `CSRF_TRUSTED_ORIGINS` en `.env`, separando las direcciones con comas. El banner tiene un botón **Copy** (Copiar) que rellena la línea. No hace falta reiniciar.

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

<a id="connection-and-generation-errors"></a>

## Errores de conexión y de generación

Los errores de generación aparecen como un aviso en la parte inferior de la pantalla. El aviso nombra el motivo y permanece el tiempo suficiente para copiarlo.

| Mensaje o síntoma | Solución |
| --- | --- |
| **No API connection configured for this chat** | El chat no tiene ninguna cuenta. Añade una en **Connections** y luego elígela para el chat. Consulta [Conectar a un proveedor de IA](connections/connecting-to-a-provider.md). |
| El modelo no acepta un parámetro | Abre **Chat Settings → Advanced Parameters** (Ajustes del chat → Parámetros avanzados) y desactiva el interruptor junto al parámetro que nombra el aviso. |
| El modelo dice que un parámetro es obligatorio | Activa el interruptor de ese parámetro. |
| **This model's chat template needs user and assistant messages to take turns** | Algunos modelos locales, como los modelos basados en Mistral en llama.cpp, necesitan mensajes que se alternen. Marinara combina los mensajes consecutivos y lo intenta una vez más. Si persiste, establece **Post-Processing Messages** (Posprocesamiento de mensajes) en **Single User Message** (Un solo mensaje de usuario) en **Chat Settings → Advanced Parameters**, o sirve el modelo con una plantilla de chat menos estricta. |
| **The AI returned an empty response. Try sending your message again.** | Envía de nuevo. Si se repite, prueba otro modelo u otra cuenta. |
| **A generation is already in progress for this chat** | Todavía hay una respuesta en streaming. Espera, o haz clic en **Stop** (Detener), y luego vuelve a intentarlo. |
| **No connections are marked for the random pool** | El enrutamiento aleatorio está activado, pero no hay ninguna cuenta en el grupo. Añade una, o desactiva el enrutamiento aleatorio. |
| Todos los mensajes fallan con un error de red, y tu computadora solo llega a internet a través de un proxy | Indícale el proxy a Marinara. Consulta [Proxy HTTP saliente](CONFIGURATION.md#outbound-http-proxy). |

## Después de una actualización

Problemas justo después de una actualización, primero en palabras sencillas:

- La pantalla está en blanco o se ve antigua: consulta [Pantalla en blanco, desactualizada o con aspecto antiguo](#blank-stale-or-old-looking-screen) y [Página en blanco o JavaScript servido como HTML después de una actualización](#blank-page-or-javascript-served-as-html-after-an-update).
- Parece que faltan chats o presets (ajustes guardados): consulta [Los datos parecen faltar después de una actualización](#data-seems-missing-after-an-update). Tus datos casi siempre siguen en el disco.
- Los chats se ven vacíos después de volver a una versión anterior: consulta [Los chats no muestran mensajes después de cambiar a una versión anterior](#chats-show-no-messages-after-switching-to-an-older-version).

<a id="blank-stale-or-old-looking-screen"></a>

### Pantalla en blanco, desactualizada o con aspecto antiguo

El servidor está en marcha, pero el navegador muestra una página en blanco, o la app se ve antigua después de una actualización. El navegador conserva una copia en caché de la app web.

1. Haz una recarga forzada.
2. Si eso no ayuda, abre **Settings → Advanced → Updates** (Configuración → Avanzado → Actualizaciones) y haz clic en **Refresh App** (Refrescar app).

**Refresh App** borra el service worker del navegador (un script en segundo plano que guarda la app en caché) y la caché, y luego recarga. No cambia tus datos ni actualiza el servidor. Para actualizar la app en sí, consulta [Actualizar Marinara Engine](UPGRADING.md).

<a id="blank-page-or-javascript-served-as-html-after-an-update"></a>

### Página en blanco o JavaScript servido como HTML después de una actualización

Un error como "Failed to load module script" con el tipo `text/html` significa que el navegador pidió un archivo JavaScript que falta en la compilación. Borrar tus datos no lo soluciona.

1. Detén el servidor.
2. Vuelve a ejecutar `start.bat`, `start.sh` o `start-termux.sh`. El lanzador recompila los archivos incompletos del cliente antes de arrancar. En una instalación manual, ejecuta primero `pnpm build` desde la raíz del repositorio.
3. Si la página sigue en blanco, haz una recarga forzada o prueba una ventana privada.

Si sigue fallando, informa la URL completa del archivo que falla, el estado HTTP, el Content-Type y la primera línea de la respuesta, junto con la salida del lanzador.

<a id="data-seems-missing-after-an-update"></a>

### Los datos parecen faltar después de una actualización

No borres ninguna carpeta de datos. Marinara guarda los datos activos en una carpeta `storage` dentro de su carpeta de datos. Busca `storage` en `packages/server/data/` y en `data/`. El servidor imprime en el arranque las carpetas que resolvió.

<a id="chats-show-no-messages-after-switching-to-an-older-version"></a>

### Los chats no muestran mensajes después de cambiar a una versión anterior

Las versiones nuevas de Marinara guardan los registros de cada chat —mensajes, swipes (respuestas alternativas), recuerdos, imágenes— en archivos propios, lo que acelera el guardado de chats largos. Las versiones antiguas no pueden leer esa estructura, así que los chats se ven vacíos. Los datos siguen en el disco.

Marinara bloquea los cambios evidentes a versiones anteriores. El lanzador omite una actualización automática que llevaría a una versión incompatible, y el actualizador de la app muestra un error que apunta aquí.

Si actualizaste y luego volviste a una versión anterior, restaura la copia de seguridad que hiciste antes de la actualización. Consulta [Volver a una versión anterior](UPGRADING.md#downgrading-to-an-older-version). A continuación van los detalles técnicos.

Tus datos están ahora en el formato de almacenamiento 10. Los formatos 8, 9 y 10 añaden ajustes de avatares 3D (MMD, y luego GLB y FBX) y vínculos de cuentas de conexión que las compilaciones antiguas no pueden leer de forma segura. Si tus datos llegaron al formato 8 o posterior, restaura una copia de seguridad completa hecha antes de esa actualización para usar una compilación antigua. El siguiente comando solo convierte estructuras antiguas de archivos de chat. No cambies el número de formato a mano. Consulta [Volver a una versión anterior](UPGRADING.md#downgrading-to-an-older-version).

Para datos por debajo del formato 8, convierte la estructura de archivos de chat:

1. Detén el servidor de Marinara.
2. Desde la carpeta de Marinara, ejecuta:

   ```bash
   node scripts/protect-launcher-data.mjs unshard
   ```

3. Cambia a la versión anterior e iníciala.

El comando reconstruye la estructura de un solo archivo a partir de los archivos por chat. No se borra nada. Los archivos por chat se quedan en carpetas llamadas `<table>.post-unshard-<timestamp>`, y los originales `.pre-shard` que haya se conservan. Cuando vuelvas a actualizar, Marinara convertirá de nuevo tus datos.

En Docker o Podman, los datos están en el volumen `marinara-data`. Detén el contenedor, ejecuta el comando de abajo y luego inicia la imagen anterior:

```bash
docker compose run --rm marinara node scripts/protect-launcher-data.mjs unshard
```

## Problemas de instalación y arranque

### Termux: CANNOT LINK EXECUTABLE "node"

Termux muestra `CANNOT LINK EXECUTABLE "node"` con `cannot locate symbol` o `library ... not found`. Node.js se actualizó sin el resto de Termux. Entonces la app de Android puede detenerse con **Could not verify that this Marinara Android build can safely read your stored data**. Tus datos no son la causa, y volver a instalar el APK no lo soluciona.

1. En Termux, ejecuta:

   ```bash
   pkg upgrade -y
   ```

2. Toca **Install / Start Marinara** en la app de Android. En una instalación manual, ejecuta `cd "$HOME/Marinara-Engine" && ./start-termux.sh`.

Si la actualización te pregunta si quieres conservar un archivo de configuración, pulsa Enter para conservar el tuyo. Los lanzadores y las apps de Android actuales ejecutan esta actualización por sí solos.

### Termux: JavaScript heap out of memory al compilar el cliente

Vite se detiene con `Reached heap limit` o `JavaScript heap out of memory`. Actualiza y vuelve a ejecutar `./start-termux.sh`. Las compilaciones del cliente usan su propio heap de 1536 MiB, limitado a la mitad de la RAM del dispositivo, pero nunca por debajo de 1280 MiB. Un límite de heap que hayas fijado en `NODE_OPTIONS` tiene prioridad, así que quita una anulación antigua de 1024 MiB. Cierra otras apps antes de reintentar. Los teléfonos con menos de unos 3 GB de RAM aún pueden quedarse sin memoria. No borres tus chats ni tu perfil para corregir un fallo de compilación.

### Escritorio: JavaScript heap out of memory en la comprobación de tipos del cliente

La compilación se detiene y dice `The client type-check needs about 2.5 GiB of Node.js heap`. El límite de tu `NODE_OPTIONS` es demasiado pequeño, y la compilación respeta el límite que fijaste. Sube `--max-old-space-size` a 2560 o más. Si `NODE_OPTIONS` contiene `--max-old-space-size-percentage`, sube ese en su lugar, porque anula al otro. O quita ambas opciones. Luego vuelve a ejecutar el lanzador. Tus datos no se tocan.

### Termux: falta un archivo del cliente invitado multijugador

El inicio indica que falta `packages/client/dist/multiplayer/guest.js`. Actualiza Marinara y vuelve a ejecutar `./start-termux.sh`, que ejecuta la compilación completa del cliente. No necesitas activar el modo multijugador.

### Termux: el servidor se detiene al abrir Marinara o Sharp no puede cargarse

Sharp es la biblioteca de imágenes que Marinara usa para las miniaturas y los sprites. En Android funciona mediante una alternativa WebAssembly. Actualiza Marinara y deja que el lanzador reinstale las dependencias. Si el servidor se detiene antes de que puedas actualizar, repara la instalación a mano en Termux:

```bash
cd ~/Marinara-Engine
rm -f node_modules/.modules.yaml
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile --prefer-offline
./start-termux.sh
```

Tus chats y tu configuración no se tocan. Si Sharp sigue sin poder cargarse, Marinara sigue funcionando con el procesamiento de imágenes desactivado. Las miniaturas existentes se siguen mostrando, las nuevas usan la imagen a tamaño completo, y la generación de sprites y la eliminación de fondo integrada no están disponibles. No sustituyas Sharp por otra versión. Conserva toda la salida del error para el reporte.

<a id="browser-opens-before-startup-finishes"></a>

### El navegador se abre antes de que termine el inicio

Actualiza y reinicia con el lanzador. El lanzador abre el navegador solo cuando el servidor informa que está listo. Si el inicio falla, no se abre ninguna pestaña, así que conserva el error de la terminal. Para abrir la app por tu cuenta, fija `AUTO_OPEN_BROWSER=false`.

### Windows: error EPERM o de firma de corepack al instalar pnpm

pnpm es el gestor de paquetes que Marinara usa para instalar su código. `EPERM: operation not permitted` o un error de firma de corepack significa que corepack no pudo escribir en la carpeta de instalación de Node. Prueba una solución y luego vuelve a ejecutar el lanzador:

1. Haz clic derecho en tu terminal, elige **Run as administrator** (Ejecutar como administrador) y ejecuta el lanzador.
2. Instala pnpm tú mismo: `npm install -g pnpm@12.15.0`
3. En una terminal de administrador, actualiza corepack: `npm install -g corepack`

### Error de versión de pnpm, o `'pnpm' is not recognized`

Marinara usa pnpm 12.15.0. El lanzador obtiene la versión correcta por ti, y no hace falta reemplazar primero una versión global anterior de pnpm. Actualiza Marinara (`git pull` en su carpeta si el lanzador no puede) y luego vuelve a ejecutar el lanzador. Si sigue fallando, instala la versión exacta y vuelve a ejecutar el lanzador:

```bash
npm install -g pnpm@12.15.0
```

### Linux: ERR_PNPM_ENAMETOOLONG durante la instalación

Una instalación anterior dejó rutas de carpeta largas. Desde la carpeta de Marinara, ejecuta:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Luego vuelve a ejecutar `./start.sh`. En una instalación manual, ejecuta `pnpm install`.

### La instalación dice "Ignored build scripts: @google/genai"

El aviso es inofensivo. No ejecutes `pnpm approve-builds`, porque modifica un archivo que Marinara controla. Si el aviso se sigue mostrando después de una actualización, borra `node_modules/.modules.yaml` en la carpeta de Marinara y vuelve a ejecutar el lanzador.

### ERR_PNPM_TRUST_DOWNGRADE durante la instalación

Esto casi siempre es una instalación a medias. Vuelve a ejecutar el lanzador. En una instalación manual, ejecuta esto desde la carpeta de Marinara:

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Problemas con el modelo integrado

El **Built-in model** (Modelo integrado) se ejecuta en tu computadora sin API key. Algunos mensajes de error lo llaman sidecar. Para la configuración, consulta [Configuración del modelo integrado](connections/local-model.md).

- **Sidecar runtime install is disabled.** En tu propia computadora, fija `SIDECAR_RUNTIME_INSTALL_ENABLED=true` en `.env`. Desde otro dispositivo, guarda primero tu secreto de administrador en **Settings → Advanced → Admin Access**.
- **La descarga o la configuración del modelo falla desde otro dispositivo** (una dirección de red o Docker). Puede que también necesite el secreto de administrador. En tu propia computadora no lo necesita.
- **Desajuste de tamaño o de SHA-256** en un archivo incluido de llama.cpp, MLX o uv. Marinara rechazó el archivo antes de usarlo. Actualiza o reinstala Marinara y vuelve a intentarlo. No descomprimas, edites ni eludas el archivo.

## Memoria y resúmenes

### Memory Recall no recuerda nada

**Memory Recall** busca en mensajes anteriores y añade los más relevantes de vuelta al prompt (las instrucciones enviadas a la IA).

1. Abre **Chat Settings → Memory Recall** y confirma que **Enable Memory Recall** está activado.
2. Abre **Access memories for this chat**. En **Memories for This Chat**, mira el estado de cada fragmento.
3. **Waiting for vector** significa que la memoria todavía se está procesando. Espera y luego vuelve a chatear.
4. **Embedding unavailable** significa que ninguna fuente de embeddings funciona. Configura una cuenta de embeddings o deja que se cargue el modelo integrado. Para usar una sola fuente en todos los chats, elígela en **Embeddings** dentro de la sección **Defaults** (Valores predeterminados) de **Connections**.

Una memoria necesita al menos 5 mensajes nuevos antes de crearse. Recall solo muestra las memorias que coinciden de cerca con tu nuevo mensaje, así que puede no devolver nada incluso cuando existen memorias.

<a id="advanced-memory-says-scenes-need-attention"></a>

### Advanced Memory indica que hay escenas que necesitan atención

Un punto fijo en el botón **Chat Settings**, o un aviso de que Advanced Memory encontró problemas, significa que algunas memorias de escenas no están claras, están desactualizadas o faltan.

1. Abre **Chat Settings → Memory Recall**, o haz clic en **Fix** (Reparar) en el aviso.
2. Haz clic en **Fix**. Repara todas las escenas que puede con el Helper model (modelo auxiliar) y nunca cambia los resúmenes que editaste.
3. Selecciona cada número de escena bajo **need your review** (necesitan tu revisión), revisa su texto y sus personajes en **Access memories for this chat** y haz clic en **Save correction** (Guardar corrección).

Si **Fix** se detiene con un error, revisa la cuenta del Helper model y luego haz clic en **Resume processing** (Reanudar el procesamiento) o de nuevo en **Fix**. Consulta [Reparar problemas de memoria](agents/memory.md#fixing-memory-problems).

### Los resúmenes no se generan

Los resúmenes necesitan una cuenta de texto que funcione.

- Modo Roleplay: abre **Chat Settings → Chat Summary**, confirma que hay una cuenta establecida y usa **Backfill Summary** para poner al día un chat más antiguo.
- Modo Conversation: abre **Automatic Summarization** y usa **Backfill** para reintentar los días que fallaron.
- Si tu chat requiere aprobación de escritura del agente, un resumen de IA espera tu revisión.
- Un resumen que sigue fallando, por ejemplo por una API key incorrecta, se reintenta más tarde. Corrige la cuenta y luego usa **Backfill**.

## Problemas con los agentes descargables

- **Catálogo no disponible en Agent Organizer.** La computadora que ejecuta el servidor, no solo tu navegador, debe poder llegar al catálogo [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) por HTTPS. Los agentes instalados siguen funcionando sin conexión. Restaura la conexión y luego haz clic en **Refresh** o **Try again**.
- **Un mapa o una llamada instalados no aparecen.** Cierra Marinara por completo e inícialo de nuevo. Estos paquetes permanecen en **Restart required** hasta el siguiente arranque. Los juegos del modo Conversation se activan de inmediato. Si la instalación falló, refresca el catálogo y comprueba que el juego aparece como listo. Añadir un juego en la configuración de **Commands** de un chat solo es necesario para que los personajes puedan iniciarlo por sí mismos, no para su comando slash manual.
- **La primera migración de paquetes no puede terminar.** No borres `data/capability-packages` ni tus datos de chat. Marinara lo reintenta en el siguiente arranque, y tus selecciones de chat siguen guardadas.
- **`data/capability-runtime-snapshots` o `data/capability-packages/versions` muy grandes.** No hace falta limpiarlos. Marinara elimina las copias antiguas al arrancar y conserva la versión actual y la anterior de cada agente.
- **Se rechaza la descarga de un paquete.** El checksum, la lista de archivos, el rango de versiones de Marinara o las rutas del archivo comprimido no coinciden con el catálogo oficial. Actualiza Marinara, refresca el catálogo y vuelve a intentarlo. No extraigas un artefacto a mano dentro de la carpeta de datos.
- **Actualizaciones.** Las actualizaciones de agentes nunca se aplican en el arranque. Marinara pregunta primero. **Not now** (Ahora no) conserva la versión instalada, y **Update** (Actualizar) sigue disponible en **Agents → Agent Organizer** (Agentes → Organizador de agentes). Una actualización fallida deja la versión instalada en su lugar. Un runtime del servidor que falla su comprobación de arranque vuelve a la versión anterior.

## Problemas del Card Browser

El **Card Browser** busca en sitios públicos de personajes. Ábrelo con el botón **Download** (Descargar) en la parte superior del panel **Characters** (Personajes) o **Personas**.

- **JannyAI muestra un bloqueo de Cloudflare.** Visita el sitio de JannyAI una vez en el mismo navegador para superar el desafío y luego vuelve a intentarlo.
- **El inicio de sesión de Pygmalion deja de funcionar después de reiniciar.** Es lo esperado. Ese inicio de sesión vive solo en la memoria del servidor. Abre la ventana de inicio de sesión y pega tu token de nuevo.
- **CharacterTavern muestra un aviso en lugar de resultados.** Es lo esperado. Su nuevo sitio web ya no ofrece la conexión que usaba Marinara. Descarga la tarjeta desde character-tavern.com e importa el archivo.

## Problemas de generación de medios

### La limpieza del fondo del sprite tiene dificultades con una escena compleja

Los sprites generados normalmente usan transparencia nativa o un fondo plano que Marinara elimina. Una habitación fotografiada, un decorado detallado, sombras marcadas o colores que coinciden con el fondo pueden necesitar el respaldo opcional con IA:

```bash
pnpm backgroundremover:install
```

Luego reinicia Marinara y haz clic en **Reapply Cleanup** en la ventana de generación de sprites. Marinara prueba primero la limpieza integrada y usa el modelo de IA solo cuando el borde no se ve uniforme. Si la instalación falla:

- Confirma que tienes instalado Python 3.9 a 3.11. Las versiones más nuevas pueden forzar compilaciones nativas lentas.
- Ejecuta `pnpm backgroundremover:reinstall`.
- Para omitir el respaldo con IA mientras solucionas el problema, fija `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` en `.env`.

### Los storyboards del Game Mode o de Roleplay no aparecen

Los storyboards convierten la narración terminada en imágenes de fotograma clave y clips opcionales. Consulta la [Guía del agente Storyboard](game/storyboard.md) y [Game Mode: primeros pasos](game/getting-started.md).

- Instala **Storyboard** desde **Agents → Agent Organizer** y luego activa **Enable Agents** (Activar agentes) y **Enable Storyboards** (Activar storyboards) para el chat.
- Los fotogramas clave necesitan una cuenta de imagen. Los clips también necesitan una cuenta de video.
- Modo Game, automático: abre **Chat Settings → Agents → Storyboards** y confirma que **Automatic Storyboard Illustrations** está activado. Activa **Automatic Storyboard Animations** para tener clips.
- Video de escena manual: abre **Chat Settings → Gallery**, genera o sube una imagen y luego usa **Video** o **Animate**. Revisa la pestaña **Videos**.
- Modo Roleplay: añade el agente **Storyboard** al chat. Elige **Still images** o **Animations**, fija **Messages per episode** y elige la cuenta de imagen. **Manual only** se ejecuta desde **Create storyboard** en la sección **Gallery** de **Chat Settings**.
- Si un prompt personalizado funciona mejor con todos los personajes combinados, desactiva **Use NovelAI Character Prompts**.
- Los servicios lentos pueden agotar el tiempo de espera. Sube `IMAGE_GEN_TIMEOUT_MS` o `VIDEO_GEN_TIMEOUT_MS` en `.env` y luego reinicia Marinara.
- `Outbound response exceeded 31457280 bytes`: de forma predeterminada, una respuesta de imagen de más de 30 MiB falla. Los archivos de ComfyUI que incrustan el flujo de trabajo y las imágenes de referencia pueden llegar a ese tamaño. Sube `IMAGE_GEN_MAX_RESPONSE_BYTES` en `.env` y reinicia, o desactiva los metadatos en ComfyUI.

### La generación del mundo del Game Mode muestra un error de JSON

Si el modelo devuelve JSON roto (texto estructurado), Marinara abre la ventana **Repair JSON** en lugar de descartar el turno.

1. Corrige los corchetes, las comas o los campos en el editor. El banner dice **JSON is valid.** cuando el texto se analiza correctamente.
2. Haz clic en **Format** para ordenar el diseño.
3. Haz clic en **Apply Repaired JSON** para usarlo sin regenerar la respuesta.

## Voz, llamadas y TTS

- **Los personajes no hablan en una llamada.** Text to Speech (texto a voz) no está configurado. Abre **Connections → Text to Speech**, actívalo, elige una fuente, introduce tu clave, elige una voz y guarda. Un personaje sin voz aparece solo como texto.
- **La voz se detiene con "No audio after N s".** Tu servidor de voz es más lento de lo que Marinara espera, algo habitual en un servidor local en una laptop. `N` es tu tiempo de espera actual. Sube **Request timeout (seconds)** (Tiempo de espera de la solicitud, en segundos) en **Connections → Text to Speech**, o en la cuenta de audio que indica el mensaje. Consulta [Tiempo de espera de la solicitud](media/tts-setup.md#request-timeout).
- **El micrófono no funciona.** Instala **Calls** desde **Agents → Agent Organizer**. Luego abre **Connections → Speech to text**, busca **Local speech model** en **On this device**, elige un modelo Whisper y haz clic en **Download Whisper**. Firefox lo necesita porque no tiene reconocimiento de voz del navegador. Desinstalar Calls borra sus modelos Whisper. También puedes usar tu propio servidor: consulta [Usar tu propio servidor de speech-to-text](conversation/calls.md#use-your-own-speech-to-text-server).
- **Local Whisper is disabled in Lite mode.** La imagen lite no puede ejecutar el modelo de voz local. Usa una instalación completa.

### El inicio de sesión de Spotify del Music DJ falla en una instalación remota o de red

El modo Spotify del agente Music DJ usa OAuth, un traspaso de inicio de sesión en el que Spotify te devuelve a una dirección de retorno (la redirect URI). Spotify solo acepta direcciones `https://` o `http://127.0.0.1`, y rechaza las direcciones IP de red normales.

- En localhost, el editor muestra un retorno de `127.0.0.1`. Regístralo con Spotify.
- Por HTTPS, el editor muestra tu retorno HTTPS. Registra ese.
- Si HTTPS termina más arriba y el host no coincide, fija `SPOTIFY_REDIRECT_URI` en `.env` con tu dirección de retorno pública.
- En una instalación de red con HTTP simple, la ventana emergente no puede cargar, pero su barra de direcciones contiene un código válido. Copia la URL completa, expande **Browser couldn't reach the callback?** debajo del botón Connect y pégala. La URL es válida durante 10 minutos.

La solución más limpia es servir Marinara por HTTPS.

## Almacenamiento y datos

### El servidor no vuelve después de Restart Server

Inicia Marinara con `start.bat`, `start-local.bat`, `start.sh`, `start-termux.sh` o `pnpm start`. Estos mantienen el servidor vinculado a su lanzador e inician un reemplazo cuando el proceso anterior termina. El reinicio desde la app cierra las conexiones persistentes después de cuatro segundos y fuerza la salida después de ocho. Una salida forzada puede interrumpir escrituras pendientes. Las ejecuciones directas con `node` y los procesos que vigilan archivos durante el desarrollo no se reemplazan: detenlos y vuelve a iniciarlos tú. Docker usa su política de reinicio de contenedores. En Windows, pulsa <kbd>Ctrl</kbd>+<kbd>C</kbd> en la consola del lanzador y espera a **Shutdown complete** (Apagado completado) antes de cerrarla.

No inicies un segundo servidor con la misma carpeta de datos mientras el primero siga en ejecución. Detén primero cualquier proceso que haya quedado.

### El inicio dice que otro proceso puede estar usando el directorio de datos

Solo un servidor puede escribir en una carpeta de datos local. Si el inicio indica que **Another Marinara Engine process ... may be using** la carpeta, cierra el otro proceso de Marinara e inicia de nuevo.

Después de una caída o de mover un volumen de Docker, el inicio puede indicar **The storage writer lease ... is incomplete or invalid**, o nombrar un proceso que ya no existe.

1. Confirma que todos los procesos y contenedores de Marinara que usan esa carpeta de datos estén detenidos.
2. Elimina solo la carpeta `.writer-lease` que nombra el error.
3. Reinicia Marinara. No elimines la carpeta `storage` ni ningún archivo de tabla.

Marinara borra por sí solo la concesión que dejó un proceso caído en Linux, Android, contenedores y Windows cuando la carpeta de datos está en una unidad local. El paso manual es el respaldo para el almacenamiento en red o compartido, las unidades extraíbles y (en Windows) una computadora a la que se le cambió el nombre después de la caída.

### La copia de seguridad o la exportación devuelve 403

Las sesiones desde la misma computadora pueden hacer copias de seguridad sin un secreto de administrador. Las solicitudes desde otro dispositivo, una dirección de red, Docker, o un proxy o un túnel en la misma computadora lo necesitan. Créalo en **Settings → Advanced → Admin Access** en la propia computadora del servidor, o fija `ADMIN_SECRET` en el servidor, y luego guarda el mismo valor en **Admin Access** en el otro dispositivo. Para que loopback también lo requiera, fija `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`. Si `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`, los visitantes reenviados obtienen la excepción local. Mantén activada esa protección para un proxy o un túnel públicos.

### La importación dice que el archivo no es un archivo ZIP legible

Marinara lee las tarjetas `.charx`, los paquetes `.marinara`, los paquetes de agentes y los repositorios de agentes personalizados como archivos ZIP. Rechaza un archivo comprimido dañado, o uno cuyo contenido no coincide con su lista de archivos, con **The file is not a readable ZIP archive** (o **Could not read .marinara package**). La causa habitual es una descarga incompleta: vuelve a descargar el archivo. Si creaste tú el archivo comprimido, vuelve a crearlo con la opción de comprimir de tu sistema, `zip` o 7-Zip.

**Package contains too many files** significa que un paquete de agente o un repositorio contiene más de 8.192 archivos. **.marinara package has too many entries** significa que un paquete `.marinara` contiene más de 8. Quita los archivos sobrantes y vuelve a intentarlo.

### Los horarios de Conversation o Noodle usan la zona horaria equivocada, o muestran `Etc/Unknown`

Para los horarios de Conversation, elige **Schedule timezone** en Conversation Chat Settings o en el editor de horario de un personaje. **Use device** la restablece.

Para Noodle u otras tareas del servidor, elimina cualquier línea `TZ=` en blanco de `.env` y reinicia Marinara para que use la zona horaria del host. Para fijar una, usa un nombre IANA como `TZ=Europe/Warsaw`.

## Problemas de Android

### La app de Android se queda en Connecting o Waiting for Server

La app de Android es una pequeña carcasa alrededor de Termux, una app de terminal Linux para Android que ejecuta el servidor real de Marinara.

1. Toca **Install / Start Marinara**.
2. Si Android pide instalar Termux, aprueba los avisos.
3. Si Android pide ejecutar comandos en Termux, concédelo.
4. Espera a que el lanzador inicie el servidor y luego vuelve a la app.

La app crea su credencial privada de localhost e inicia sesión automáticamente. Nunca tienes que pegar un secreto. No añadas `null`, `http://null` ni el secreto del APK a `CSRF_TRUSTED_ORIGINS`.

Confirma también que la app y Termux usan el mismo puerto. El predeterminado es `7860`. Si compilaste la app con otro puerto, fija el `PORT` correspondiente en el `.env` de Termux.

<a id="android-localhost-opens-the-login-page-or-returns-401503"></a>

### Android localhost abre la página de inicio de sesión o devuelve 401/503

Las instalaciones de Termux gestionadas por el APK protegen localhost con un secreto privado por instalación, y la app inicia sesión automáticamente. Si la página de inicio de sesión aparece dentro de la app, instala el [APK más reciente](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk), toca **Install / Start Marinara** otra vez y vuelve cuando Termux termine.

Un error que menciona el origen `null` significa una pareja antigua de APK y servidor. Editar `.env` no puede corregirlo. Actualiza el APK y Marinara.

Para abrir un navegador en el mismo teléfono, toca **Open in browser** (Abrir en el navegador) en el lanzador de Android y luego **Retry connection** (Reintentar conexión). Vuelve a abrirlo así tras reiniciar el servidor o cuando caduque la sesión. Para volver al lanzador, usa **Settings → General → App Behavior → Open Android launcher (app or browser)** (Configuración → General → Comportamiento de la app → Abrir el lanzador de Android: app o navegador).

Los APK anteriores inician sesión en `/android-login` con el valor de `cat ~/.marinara-engine/android-secret`. Un enlace del navegador funciona una vez y caduca al cabo de un minuto, así que abre uno nuevo desde el lanzador.

- **401:** se rechazó el secreto pegado o el desafío. Vuelve a cargar `/android-login` y pega el valor actual.
- **503:** el servidor recibió un secreto con un formato incorrecto. Reinicia con `./start-termux.sh`. Si el lanzador indica que su archivo de secreto no es válido o está vacío, toca **Install / Start Marinara** en la app para aprovisionarlo de nuevo.

El comando local `mari` lee el mismo archivo automáticamente. No incluyas el secreto en capturas de pantalla ni en informes de problemas.

### La actualización de Android se detiene con exit status 134

Android se quedó sin memoria durante un paso de compilación. Vuelve a ejecutar el lanzador:

```bash
./start-termux.sh
```

Si se detiene de nuevo, cierra otras apps, reabre Termux y vuelve a intentarlo.

### Termux se cierra o reinicia mientras Marinara está funcionando

El lanzador solicita un wake lock mientras el servidor funciona y guarda cada sesión en `~/.marinara-engine/logs/`. Después de un reinicio inesperado, incluye en tu reporte el `server-*.log` más reciente. Si termina sin un error de Marinara o de Node, lo más probable es que Android o el fabricante del teléfono haya terminado Termux.

En los ajustes de Android, permite que Termux funcione en segundo plano y quítale la optimización de batería. `termux-wake-lock` y `termux-wake-unlock` vienen con la instalación estándar de Termux. Estos ajustes no pueden evitar todos los cierres específicos del fabricante.

### Marinara deja de responder hasta que Termux está en primer plano

Los chats se quedan colgados en "Opening chat...", la app informa **Server unreachable** (Servidor inalcanzable), la copia de Support Diagnostics muestra **Unreachable (request timed out)** (Inalcanzable: se agotó el tiempo de espera de la solicitud) en los campos del servidor, y todo se recupera en el instante en que abres Termux. El congelador de apps en caché de Android suspendió el proceso de Termux. El teléfono acepta la conexión, pero el servidor congelado nunca responde. Un wake lock no lo evita. El registro de la sesión muestra un salto en las marcas de tiempo durante el intervalo congelado, no un error.

Exime a Termux de la optimización de batería, permite la actividad en segundo plano, fija Termux en la pantalla de recientes si tu teléfono lo permite y mantén visible su notificación. Si las congelaciones continúan, mantén Termux en primer plano o la pantalla encendida mientras usas Marinara.

### La actualización de Android se queda sin almacenamiento al instalar dependencias

Una huella temporal grande durante una actualización normalmente viene del almacén de dependencias de pnpm, después de varias versiones o de una reinstalación interrumpida. El lanzador actual poda los paquetes antiguos, y las actualizaciones dentro de la app instalan solo los paquetes de Android. Si un lanzador más antiguo llenó el dispositivo, libera el espacio y vuelve a intentarlo:

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

No borres `data`, `storage` ni `marinara-engine.db`, porque pueden contener tus chats y tu configuración. Si sigue deteniéndose, captura las líneas a partir de `Installing dependencies` e incluye en tu reporte el espacio libre y la memoria del teléfono.

### La actualización dentro de la app falla al cambiar entre Stable y Staging en Android

Cambiar de canal fuerza una reinstalación casi completa de dependencias, que es lenta en el almacenamiento de Termux. El actualizador dentro de la app concede tiempo extra para cada paso. Si una actualización sigue fallando, el error nombra el paso que falló y muestra el final de su salida. Un error real de dependencia o de lockfile aparece ahí. También puedes actualizar a mano desde Termux con el comando de la pista del error, o liberar espacio primero:

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

## Problemas de Docker

### Permiso denegado del contenedor en un montaje de volumen

- Volumen con nombre después de una actualización: ejecuta `docker compose pull && docker compose up -d`. La imagen oficial repara la propiedad al arrancar.
- Bind mount: haz que la carpeta del host sea escribible por el ID de usuario y de grupo `1000`, o usa un volumen con nombre.
- Sistemas SELinux como Fedora o RHEL: añade el sufijo `:Z` al montaje del volumen.

### El contenedor Lite se cae en una Raspberry Pi 4

Si la imagen lite se reinicia cada vez que envía una petición de IA en una Raspberry Pi 4 o un dispositivo ARM similar, revisa el código de salida. Exit 132 o SIGILL (la CPU alcanzó una instrucción que no puede ejecutar) apunta a un problema conocido de origen ascendente en la compilación de Node de la imagen lite en algunos chips ARM. Usa la imagen regular en ese dispositivo.

<a id="a-server-extension-says-no-supported-sandbox-is-available"></a>

### Una Server Extension dice que no hay ningún sandbox compatible disponible

Las Server Extensions y los comandos de shell sin procesar de Professor Mari solo funcionan con Seatbelt de macOS o Bubblewrap de Linux. En un host Linux nativo, instala `bwrap` y reinicia Marinara. La imagen oficial de Docker incluye Bubblewrap, pero el contenedor predeterminado no puede crear sus espacios de nombres anidados, así que Marinara mantiene desactivadas estas funciones.

Si aceptas privilegios de contenedor más amplios, guarda esto como `docker-compose.override.yml` junto a `docker-compose.yml` y luego vuelve a crear el contenedor:

```yaml
services:
  marinara:
    environment:
      MARINARA_DOCKER_USER: root
    cap_add:
      - SYS_ADMIN
    security_opt:
      - apparmor=unconfined
```

> **Advertencia:** ejecutar el servidor como root con `SYS_ADMIN` y sin perfil de AppArmor es una escalada de privilegios amplia. No lo actives solo para ocultar este mensaje.

El perfil seccomp predeterminado de Docker se adapta a las capacidades añadidas, así que en las versiones actuales de Docker no debería hacer falta `seccomp=unconfined`.

Windows, Android y otros hosts no compatibles rechazan la ejecución de Server Extensions. Las Browser Extensions siguen ejecutándose en su sandbox.

## Problemas con las extensiones

### External Extensions no aparece en Addons

La sección permanece oculta hasta que se abran ambas puertas.

1. Fija `ENABLE_EXTERNAL_EXTENSIONS=true` en el `.env` del host.
2. Espera un momento y luego abre **Settings → Advanced → Danger Zone** (Configuración → Avanzado → Zona de peligro), desplázate por debajo de los controles de borrado de datos y activa **Allow third-party extension imports**.

Si el interruptor está desactivado, la marca del host sigue siendo falsa o la app no ha visto el cambio. Confirma que editaste el `.env` activo descrito en [Configuración del servidor](CONFIGURATION.md). En Docker normalmente es `/app/data/.env`.

Mientras alguna de las puertas esté cerrada, las extensiones externas registradas no aparecen ni pueden ejecutarse. Volver a abrir las puertas no las vuelve a activar.

### Una extensión de navegador importada aparece pero no funciona

Ábrela en **Settings → Addons → External Extensions** y lee **Requested access**. Los paquetes antiguos `marinara.extension` v1 sin declaración de capacidades muestran **Full page access**. Aprueba solo el hash exacto que inspeccionaste y en el que confías.

Un paquete que se volvió a exportar con una lista de capacidades vacía se trata como una extensión de sandbox segura, y el código que necesita el DOM de la página no funcionará. Añade `full_page_access` a su manifiesto solo si aceptas que el código obtenga toda la página, el almacenamiento del navegador, las APIs de red y tu sesión.

Después de desactivar una extensión con acceso a toda la página, recarga Marinara si queda algún elemento de la barra de herramientas, una capa superpuesta o un listener. La limpieza se hace en la medida de lo posible, porque el código de la página puede causar efectos secundarios que Marinara no rastrea.

<a id="multiplayer-connection-or-turn-problems"></a>

## Problemas de conexión o turnos multijugador

| Síntoma | Solución |
| --- | --- |
| Controles no disponibles | Pon `MULTIPLAYER_ENABLED=true` en el `.env` de la instancia de Marinara correcta, reiníciala y luego activa el ajuste por separado. La carcasa nativa de Android no puede unirse. |
| Anfitrión no disponible | Usa un puerto HTTPS de sala independiente y accesible, una cadena de certificados y un nombre de host válidos, y la huella correspondiente de la invitación. No desactives las comprobaciones TLS, no añadas `null` a los orígenes de confianza, no expongas la API normal ni abras un cliente proporcionado por el anfitrión. |
| Esperando aprobación | El anfitrión debe aprobarte en Players. No ves ningún historial antes de la aprobación. Pide una nueva invitación si caducó. |
| Desconectado | Mantén en ejecución tu propio Marinara. Se reconecta al mismo anfitrión mientras la sesión siga activa, y los borradores sin enviar se conservan. Después de un reinicio, vuelve a unirte. Para conservar el mismo nombre de persona, pide antes al anfitrión que elimine tu asiento anterior. |
| Juego en espera | Abre Players. A los jugadores desconectados no se les pasa el turno automáticamente. El anfitrión puede usar **Pass**, **Kick** o **Pause**. |
| Generación interrumpida | No reenvíes la ronda. El anfitrión debe revisar la narración y el estado guardados, y luego reanudar o detener la sala. El multijugador nunca repite una solicitud de resultado dudoso ni aplica dos veces sus efectos en el mundo. |
| Comando restringido o medios ausentes | Las salas solo transmiten texto. Consulta la [tabla de compatibilidad](development/multiplayer.md#command-and-feature-compatibility). No instales un archivo ni una extensión que te pase otro participante. |

Al reportar un error de conexión, incluye el modo, la plataforma, el error visible y si la aprobación funcionó. No publiques invitaciones, contraseñas de sala, tokens de sesión, historiales privados ni API keys.

## La instalación como PWA en Chrome de Android falla detrás de un inicio de sesión

Usa una dirección HTTPS, inicia sesión y recarga después de actualizar Marinara. La app solicita su manifiesto con credenciales, así que el inicio de sesión puede permanecer activado. Si la instalación sigue sin estar disponible, comprueba que tu proxy entregue `/manifest.json` como JSON, no como una página de inicio de sesión o un error.

<a id="get-more-help"></a>

## Cómo obtener más ayuda

1. Abre **Settings → Advanced → Message Tools** (Configuración → Avanzado → Herramientas de mensaje) y activa **Debug mode**. Registra el prompt y la respuesta en la consola del servidor.
2. Anota tu sistema operativo, tu versión de Node.js y el texto completo del error de la consola.
3. Elimina las API keys, los tokens de acceso, los secretos de administrador y el contenido de chat privado antes de compartir nada.

Luego pide ayuda a la comunidad:

- Lee los [issues abiertos](https://github.com/Pasta-Devs/Marinara-Engine/issues).
- Únete al [Discord](https://discord.com/invite/KdAkTg94ME).
- Presenta un reporte de error en los mismos issues de GitHub, con los detalles de arriba.

## Guías relacionadas

- [Preguntas frecuentes](FAQ.md)
- [Referencia de configuración del servidor](CONFIGURATION.md)
- [Acceso remoto](REMOTE_ACCESS.md)
- [Actualizar Marinara Engine](UPGRADING.md)
- [Conectar a un proveedor de IA](connections/connecting-to-a-provider.md)
- [Configuración del modelo integrado](connections/local-model.md)
- [Game Mode: primeros pasos](game/getting-started.md)
- [Descripción general de la configuración](settings/settings-overview.md)

<details>
<summary>Mantenedores: actualizar los runtimes locales fijados</summary>

No está garantizado que los archivos de código fuente generados por GitHub sigan siendo estables byte a byte, aunque el contenido de su commit no cambie. Nunca "arregles" el desajuste de un usuario aceptando los bytes que se ven en su máquina ni debilitando la verificación. Vuelve a fijar las entradas de runtime solo dentro de un cambio revisado del Engine:

1. Elige una revisión ascendente inmutable o un recurso de release y revisa los cambios ascendentes.
2. Descarga el artefacto en un directorio temporal, anota su número exacto de bytes y calcula su hash SHA-256 de forma independiente.
3. Actualiza `runtime-integrity-manifest.ts` con la revisión, la URL, el tamaño y el hash. Para MLX, vuelve a generar `packages/server/src/assets/mlx-runtime-requirements.lock` desde su archivo `.in` con la versión fijada de uv en Apple Silicon/Python 3.12, revisa cada cambio de dependencia y actualiza `requirementsLockSha256`.
4. Ejecuta `pnpm regression:runtime-integrity`, `pnpm check` y una instalación limpia y real del runtime en la plataforma afectada.
5. Publica la actualización revisada del Engine antes de pedir a los usuarios que vuelvan a intentarlo. No ofrezcas una anulación manual de la suma de verificación.

</details>
