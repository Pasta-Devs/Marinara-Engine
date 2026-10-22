# Ejecutar mediante contenedor (Docker / Podman)

Esta guía te muestra cómo ejecutar Marinara Engine dentro de un contenedor usando Docker o Podman. Un contenedor es un paquete autónomo que agrupa la app y todo lo que necesita para funcionar. No tienes que instalar Node.js ni otras herramientas en tu computadora. Si eres nuevo y solo quieres tener Marinara funcionando, este es el camino más fácil.

## Requisitos previos

Antes de empezar, instala uno de estos en la máquina que va a ejecutar Marinara:

- Docker Desktop (Windows o macOS) o Docker Engine (Linux). Docker es la herramienta de contenedores más común.
- O bien Podman. Podman es un reemplazo directo de Docker. Funciona sin un servicio en segundo plano y va bien sin acceso de root.

Algunos términos que se usan más abajo:

- **Image** (imagen): una plantilla descargable de solo lectura que contiene Marinara Engine. Ejecutas una imagen para crear un contenedor en ejecución.
- **Volume** (volumen): un área de almacenamiento que la herramienta de contenedores gestiona por ti. Un volumen conserva tus datos incluso cuando eliminas y vuelves a crear el contenedor.
- **LAN**: tu red local (la red Wi-Fi o cableada de tu casa u oficina).

Las imágenes oficiales de Marinara se publican en `ghcr.io/pasta-devs/marinara-engine`.

## Descargar y ejecutar

El repositorio incluye un archivo `docker-compose.yml` listo para usar en la raíz del proyecto. Compose lee este archivo e inicia el contenedor por ti. Esta es la forma recomendada de ejecutar Marinara.

1. Consigue una copia del repositorio. Si ya tienes una copia local de Marinara Engine, abre una terminal en esa carpeta. Si no, clónalo primero:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Entra en la carpeta:

```bash
cd Marinara-Engine
```

3. Inicia el contenedor en segundo plano:

```bash
docker compose up -d
```

El archivo `docker-compose.yml` usa la imagen `ghcr.io/pasta-devs/marinara-engine:latest` y la descarga la primera vez que ejecutas este comando. La primera descarga puede tardar unos minutos.

## Comprobar que funciona

1. Abre tu navegador web.
2. Ve a esta dirección:

```text
http://127.0.0.1:7860
```

Deberías ver la pantalla de inicio de Marinara Engine. Si la ves, el contenedor está funcionando. La dirección `127.0.0.1` significa "esta misma computadora", y `7860` es el puerto predeterminado en el que Marinara escucha.

Si la página no carga, consulta la sección de Solución de problemas más abajo.

## Dónde se guardan tus datos

Tus datos (tus chats, personajes, archivos subidos, fuentes y fondos predeterminados) se guardan como archivos simples. Marinara usa almacenamiento respaldado por archivos, lo que significa que tus datos viven como archivos normales en lugar de dentro de un único archivo de base de datos. Compose mantiene estos archivos en un volumen con nombre llamado `marinara-data`.

Compose añade el nombre de la carpeta del proyecto delante de los nombres de volumen, así que el nombre real del volumen sigue un patrón `PROJECT_marinara-data`. Para encontrar el nombre exacto en tu máquina, lista los volúmenes:

```bash
docker volume ls --filter name=marinara-data
```

Luego inspecciona el de la lista para ver dónde vive:

```bash
docker volume inspect PROJECT_marinara-data
```

Reemplaza `PROJECT_marinara-data` con el nombre que imprimió el comando anterior.

Cada vez que el contenedor arranca, prepara la carpeta de datos. De forma predeterminada, el contenedor arranca como root. Corrige la propiedad de la carpeta para que la app pueda escribir en ella, y luego cambia a un usuario sin privilegios de root por seguridad. Esta reparación funciona para el volumen con nombre y también para una carpeta que montes desde tu host. Significa que las configuraciones más antiguas pueden pasar al almacenamiento respaldado por archivos sin que ejecutes ningún comando manual de propiedad.

Marinara también crea un archivo de configuración vacío en `/app/data/.env` dentro del volumen en el primer arranque. Ahí es donde puedes añadir configuraciones del servidor más adelante. Como vive en el volumen, tus configuraciones sobreviven a los reinicios del contenedor y a las actualizaciones de imagen. Consulta [Referencia de configuración del servidor](../CONFIGURATION.md) para ver la lista completa de configuraciones.

## Exponer Marinara a tu LAN

De forma predeterminada, Compose solo te deja acceder a Marinara desde la misma computadora. Este es el valor predeterminado seguro. Si quieres abrir Marinara en tu teléfono o en otra computadora de tu red, debes hacer dos cosas. Cambiar el mapeo de puertos, y activar un inicio de sesión para que los desconocidos no puedan acceder.

Otros dispositivos necesitan un inicio de sesión antes de poder usar Marinara. Nunca expongas Marinara a tu red sin uno.

1. Abre `docker-compose.yml` en un editor de texto.

2. Busca la línea del puerto. Se ve así:

```yaml
ports:
  - "127.0.0.1:${PORT:-7860}:7860"
```

3. Quita la parte `127.0.0.1:` para que se pueda acceder a la app desde otros dispositivos:

```yaml
ports:
  - "${PORT:-7860}:7860"
```

4. En el mismo archivo, añade un secreto de administrador a la lista `environment:`. Usa tu propio valor:

```yaml
environment:
  - ADMIN_SECRET=another-long-random-value
```

5. Guarda el archivo y reinicia el contenedor:

```bash
docker compose up -d
```

Ahora otros dispositivos de tu red pueden acceder a Marinara en `http://YOUR_COMPUTER_IP:7860` cuando `PORT` no está definido. Si defines `PORT`, reemplaza `7860` con ese puerto del host. Ven una página que pide un inicio de sesión. Para configurarlo, busca el código de configuración de un solo uso con `docker logs <container> 2>&1 | grep "setup code"`. Escribe el código en esa página con un nombre de usuario y una contraseña nuevos. Más tarde puedes cambiar el inicio de sesión en **Settings** → **Advanced** → **Access** en un navegador que ya haya iniciado sesión. Si olvidas la contraseña, ejecuta `docker exec <container> node scripts/reset-login.mjs`. Esto no cambia un inicio de sesión de `BASIC_AUTH_USER` y `BASIC_AUTH_PASS`; edita esos valores en el archivo compose y vuelve a crear el contenedor. También puedes configurar un inicio de sesión en el archivo compose con `BASIC_AUTH_USER` y `BASIC_AUTH_PASS` en la lista `environment:`.

En Docker Desktop, OrbStack y Docker sin root (rootless), todos los dispositivos llegan al contenedor desde la misma dirección, incluido tu propio navegador. Así que, una vez configurado el inicio de sesión, esta computadora también lo pide, y una lista de IP permitidas no puede distinguir los dispositivos. Configura el inicio de sesión antes de quitar `127.0.0.1:`. En estos entornos, abre Marinara en esta computadora en `http://localhost:7860` y usa **Settings**, o configura `BASIC_AUTH_USER` y `BASIC_AUTH_PASS` en el archivo compose. Nunca quites `127.0.0.1:` sin el inicio de sesión: en estos entornos Marinara no puede distinguir los demás dispositivos de esta computadora. Para encontrar buenas formas de permitir solo ciertos dispositivos, y para aprender qué hace el secreto de administrador, lee [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md).

## Elegir una imagen: latest, staging o lite

Marinara publica varias etiquetas de imagen. Elige la que se ajuste a tus necesidades.

- `latest` es la versión estable recomendada. El archivo `docker-compose.yml` la usa de forma predeterminada.
- `X.Y.Z` es una versión fija, como `ghcr.io/pasta-devs/marinara-engine:2.0.6`. Usa esta cuando quieras fijar una versión exacta.
- `staging` es una compilación de prueba inestable hecha con el código de desarrollo más reciente. Úsala solo para probar cambios no publicados. Puede fallar, puede cambiar de comportamiento sin avisos, y puede no dejarte volver a mover tus datos a una compilación estable.
- `lite` es una imagen más pequeña. Se describe en la siguiente sección.

Si ejecutas la imagen `staging`, usa un volumen separado para que una compilación inestable no pueda cambiar tus datos estables:

```bash
docker run -d --name marinara-staging -p 127.0.0.1:7860:7860 -v marinara-staging-data:/app/data ghcr.io/pasta-devs/marinara-engine:staging
```

### La imagen lite

La imagen lite es una variante más pequeña que sacrifica algunas funciones sin conexión a cambio de una descarga mucho más pequeña. Está construida sobre Wolfi, una base de Linux mínima hecha para contenedores.

La imagen lite elimina las funciones que necesitan archivos locales grandes:

| Eliminado en lite | Qué pierdes |
| --- | --- |
| Local Model (Gemma, se ejecuta en tu máquina) | No puedes ejecutar un modelo de IA en tu propio hardware. |
| Modelo de embedding local | Sin embeddings de texto en el dispositivo. |
| Memory Recall (búsqueda semántica) | Depende del modelo de embedding local. |
| Entrada de voz Local Whisper | Se pierde la conversión de voz a texto para llamadas de Conversation. |
| Lector de estado de ánimo de los avatares | 2D Avatars y 3D Avatars eligen las caras a partir de una lista de palabras en lugar del pequeño modelo local de emociones. |

Todo lo demás funciona igual: chat, roleplay, Game Mode, agentes, lorebooks, personajes y conexiones con proveedores de IA remotos. Para usar cualquier función de IA con la imagen lite, debes conectar un proveedor externo (por ejemplo OpenRouter, OpenAI o un modelo autoalojado). Consulta [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md).

La etiqueta lite es `ghcr.io/pasta-devs/marinara-engine:lite`, y cada versión también incluye una etiqueta lite fijada a una versión, como `ghcr.io/pasta-devs/marinara-engine:X.Y.Z-lite`. Para ejecutarla:

```bash
docker run -d --name marinara-lite -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:lite
```

Algunas imágenes lite más antiguas pueden fallar en la Raspberry Pi 4 y computadoras ARM similares. El fallo muestra un error `SIGILL` (un error de instrucción ilegal del procesador) durante las llamadas salientes a proveedores de IA. Si usas uno de estos dispositivos, ejecuta la imagen `latest` normal en su lugar. Consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md) para ver los detalles actuales.

## Actualizar

Las imágenes de contenedor no se actualizan solas. Descargas una imagen más nueva y reinicias el contenedor a mano. Haz primero una copia de seguridad, para poder volver exactamente adonde estabas. Consulta [Copia de seguridad y restauración de Marinara](../data/backup-and-restore.md).

Para Docker Compose, ejecuta este único comando:

```bash
docker compose pull && docker compose up -d
```

Para Podman Compose, ejecuta este único comando:

```bash
podman compose pull && podman compose up -d
```

También puedes comprobar tu versión dentro de la app. Abre **Settings** (Configuración), ve a la pestaña **Advanced** y busca la sección **Updates**. Haz clic en **Check for Updates**. Para instalaciones en contenedor, Marinara detecta que se está ejecutando en Docker y te muestra la etiqueta de imagen de la versión más el comando del host que hay que ejecutar. No puede aplicar la actualización desde dentro del navegador, así que sigues ejecutando el comando de arriba en el host.

Para volver a una versión anterior, pon su etiqueta de versión en la línea `image:` de `docker-compose.yml`, por ejemplo `ghcr.io/pasta-devs/marinara-engine:2.5.0`, y luego ejecuta `docker compose up -d`. Volver a 2.5.0 funciona y tus chats se abren con normalidad, pero 2.5.0 no conoce los ajustes y los datos de partida que añadieron las funciones más nuevas. Cualquier chat o conexión que 2.5.0 guarde pierde esos datos, y volver a actualizar no los recupera. Consulta [Volver a 2.5.0](../UPGRADING.md#going-back-to-250).

## Podman

Podman ejecuta las mismas imágenes que Docker. En la mayoría de los casos puedes cambiar `docker` por `podman` en los comandos de arriba.

Para empezar con Compose:

```bash
podman compose up -d
```

Para ejecutar un solo contenedor sin Compose:

```bash
podman run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:latest
```

El comando `podman compose` necesita el ayudante `podman-compose`. Instálalo con el comando para tu sistema.

En Fedora:

```bash
sudo dnf install podman-compose
```

En Debian o Ubuntu:

```bash
sudo apt install podman-compose
```

Con pip:

```bash
pip install podman-compose
```

## Construir la imagen tú mismo

Si prefieres construir la imagen desde el código fuente en lugar de descargarla:

```bash
docker build -t marinara-engine .
```

Luego ejecuta tu propia compilación:

```bash
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

Para construir la imagen lite desde el código fuente, apunta Docker al archivo de compilación lite:

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

## Solución de problemas

**La página no carga, o el puerto ya está en uso.** Puede que otro programa ya use el puerto `7860`. Cambia el mapeo de puertos a un puerto libre, como `8080:7860` en la lista `ports:`. Luego reinicia con `docker compose up -d` y abre `http://127.0.0.1:8080`.

**Marinara no puede escribir archivos, o ves errores de permisos.** El contenedor repara la propiedad de la carpeta de datos cada vez que arranca. Esto funciona para volúmenes con nombre y para carpetas que montes desde tu host. La reparación puede fallar en algunos sistemas de archivos del host, y se omite si defines `MARINARA_SKIP_DATA_CHOWN=true`. Si los errores continúan, usa el volumen con nombre predeterminado `marinara-data`. Es la opción más fiable.

**La imagen lite falla en una Raspberry Pi 4.** Consulta la nota sobre la imagen lite de más arriba. Usa la imagen `latest` normal en ese hardware.

Para más ayuda, lee [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Guías relacionadas

- [Referencia de configuración del servidor](../CONFIGURATION.md)
- [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md)
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md)
