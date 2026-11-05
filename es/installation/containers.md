# Ejecutar mediante contenedor (Docker / Podman)

Ejecuta Marinara Engine en un contenedor con Docker o Podman. Un contenedor es un paquete que contiene la app y todo lo que necesita, así que no instalas Node.js. Si quieres tener Marinara funcionando con la menor configuración posible, empieza aquí.

## Antes de empezar

Instala uno de estos en la computadora que va a ejecutar Marinara:

- Docker Desktop (Windows o macOS) o Docker Engine (Linux).
- Podman, un reemplazo de Docker que no necesita un servicio en segundo plano y funciona sin acceso de root.

Términos que se usan más abajo:

- **Image (imagen):** una copia descargable de solo lectura de Marinara. Ejecutas una imagen para crear un contenedor.
- **Volume (volumen):** almacenamiento que gestiona la herramienta de contenedores. Conserva tus datos cuando eliminas y vuelves a crear el contenedor.

Las imágenes oficiales están en `ghcr.io/pasta-devs/marinara-engine`.

<a id="start-marinara"></a>

## Iniciar Marinara

El proyecto tiene un archivo `docker-compose.yml` listo para usar. Compose es la parte de Docker que lee este archivo e inicia el contenedor. Esta es la forma recomendada.

1. Abre una terminal, una ventana donde escribes comandos. Si ya tienes un checkout de Marinara, ábrela en esa carpeta y sáltate los dos pasos siguientes.
2. Descarga los archivos del proyecto.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Abre la carpeta nueva.

   ```bash
   cd Marinara-Engine
   ```

4. Inicia el contenedor en segundo plano.

   ```bash
   docker compose up -d
   ```

   La primera ejecución descarga la imagen `ghcr.io/pasta-devs/marinara-engine:latest`, lo que puede tardar unos minutos. Cuando termina, la terminal muestra el contenedor como `Started`.

5. Abre `http://127.0.0.1:7860` en tu navegador. Se carga la pantalla de inicio de Marinara.

Si no funcionó: puede que otro programa use el puerto `7860`. Elige un puerto libre, como `8080`. Crea un archivo llamado `.env` en la misma carpeta que `docker-compose.yml` con la línea `PORT=8080` y luego vuelve a ejecutar `docker compose up -d`. Compose lee este archivo cada vez, así que las actualizaciones posteriores conservan el puerto nuevo. Luego abre `http://127.0.0.1:8080`. Hay otras soluciones en [Solución de problemas](#troubleshooting).

## Detener Marinara

Ejecuta esto desde la misma carpeta. Detiene y elimina el contenedor. Tus datos se quedan en el volumen.

```bash
docker compose down
```

Con Podman, usa `podman compose down`.

## Dónde se guardan tus datos

Marinara guarda tus chats, personajes, archivos subidos, fuentes y fondos predeterminados como archivos simples en un volumen de Compose llamado `marinara-data`. Compose añade delante el nombre de la carpeta del proyecto, así que el nombre real se ve como `PROJECT_marinara-data`. Para encontrar el nombre exacto y dónde vive:

```bash
docker volume ls --filter name=marinara-data
docker volume inspect PROJECT_marinara-data
```

Reemplaza `PROJECT_marinara-data` con el nombre que imprimió el primer comando.

Marinara también crea un archivo de configuración vacío en `/app/data/.env` dentro del volumen en el primer arranque. Añade ahí las configuraciones del servidor. Sobreviven a los reinicios y a las actualizaciones de imagen. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).

Cada vez que el contenedor arranca, corrige la propiedad de la carpeta de datos para que la app pueda escribir en ella. Arranca como root, corrige la propiedad y luego cambia a un usuario sin privilegios de root. Esto funciona para el volumen y para una carpeta que montes desde tu computadora.

<a id="open-marinara-from-another-device"></a>

## Abrir Marinara desde otro dispositivo

De forma predeterminada, Compose solo deja que esta computadora acceda a Marinara. Para abrirla en un teléfono o en otra computadora, publica el puerto en todas las interfaces y configura antes un inicio de sesión. Nunca expongas Marinara a tu red sin un inicio de sesión.

Docker Desktop, OrbStack y Docker sin root (rootless) muestran todos los dispositivos como una sola dirección de puerta de enlace. Sin inicio de sesión, un puerto publicado en todas las interfaces deja entrar a todos. Una vez configurado el inicio de sesión, esta computadora también lo pide. Consulta [Bypass de Tailscale y Docker](../REMOTE_ACCESS.md#tailscale-and-docker-bypass).

1. Abre `docker-compose.yml`, en la carpeta de Marinara, en un editor de texto.
2. En la lista `ports:`, quita `127.0.0.1:`.

   ```yaml
   ports:
     - "${PORT:-7860}:7860"
   ```

3. En la lista `environment:`, añade un secreto de administrador. Usa tu propio valor largo y aleatorio.

   ```yaml
   environment:
     - ADMIN_SECRET=another-long-random-value
   ```

4. En la misma lista, añade un inicio de sesión. Usa tu propio nombre de usuario y una contraseña larga y aleatoria.

   ```yaml
   - BASIC_AUTH_USER=your-username
   - BASIC_AUTH_PASS=another-long-random-password
   ```

5. Guarda el archivo y reinicia el contenedor.

   ```bash
   docker compose up -d
   ```

6. En el otro dispositivo, abre `http://YOUR_COMPUTER_IP:7860`. Si definiste `PORT`, usa ese puerto. La página pide tu inicio de sesión.

Si omites `BASIC_AUTH_USER` y `BASIC_AUTH_PASS`, la página pide en su lugar un código de configuración de un solo uso. Búscalo en los registros y luego escríbelo en la página con un nombre de usuario y una contraseña nuevos.

```bash
docker logs <container> 2>&1 | grep "setup code"
```

Más tarde puedes cambiar un inicio de sesión de la app en **Settings → Advanced → Access** (Configuración → Avanzado → Acceso) en un navegador que ya haya iniciado sesión. Si olvidas la contraseña, ejecuta `docker exec <container> node scripts/reset-login.mjs`. Ese comando no cambia un inicio de sesión de `BASIC_AUTH_USER` y `BASIC_AUTH_PASS`. Edita esos valores en el archivo compose y vuelve a crear el contenedor.

En Docker Desktop, OrbStack y Docker sin root, abre Marinara en esta computadora en `http://localhost:7860` para configurar el inicio de sesión en **Settings**. Ahí una lista de IP permitidas no puede distinguir los dispositivos, así que usa un inicio de sesión. Para otras formas de limitar el acceso, y para saber qué hace el secreto de administrador, consulta [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md).

## Actualizar Marinara

Los contenedores no se actualizan solos. Haz primero una copia de seguridad (consulta [Copia de seguridad y restauración de Marinara](../data/backup-and-restore.md)), luego descarga la imagen nueva y reinicia. Ejecuta esto desde la carpeta que contiene `docker-compose.yml`:

```bash
docker compose pull && docker compose up -d
```

Con Podman, usa `podman compose` en su lugar. En la app, **Settings → Advanced → Updates → Check for Updates** muestra la etiqueta de imagen y este comando. La app no puede aplicar la actualización por sí misma en un contenedor.

Para volver a una versión anterior, pon su etiqueta en la línea `image:` de `docker-compose.yml` y luego ejecuta `docker compose up -d`. Consulta antes [Volver a una versión anterior](../UPGRADING.md#downgrading-to-an-older-version). Las compilaciones más antiguas no pueden abrir datos que guardaron compilaciones más nuevas.

## Elegir una etiqueta de imagen

| Etiqueta | Qué es |
| --- | --- |
| `latest` | La versión estable. `docker-compose.yml` la usa. |
| `X.Y.Z` | Una versión fija, como `ghcr.io/pasta-devs/marinara-engine:2.5.1`. |
| `staging` | Una compilación de prueba inestable con código no publicado. Puede fallar, y puede que no puedas volver a mover tus datos a una compilación estable. |
| `lite` | Una imagen más pequeña. Consulta abajo. |
| `X.Y.Z-lite` | Una versión fija de la imagen lite. |

Si ejecutas `staging`, usa un volumen separado para que no pueda cambiar tus datos estables:

```bash
docker run -d --name marinara-staging \
  -p 127.0.0.1:7860:7860 \
  -v marinara-staging-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:staging
```

### La imagen lite

La imagen lite es una descarga más pequeña construida sobre Wolfi, una base de Linux mínima para contenedores. Deja fuera las funciones que necesitan archivos locales grandes:

| Fuera de lite | Qué pierdes |
| --- | --- |
| Built-in model (modelo integrado) | No puedes ejecutar un modelo de IA en tu propio hardware. |
| Modelo de embedding local | Sin embeddings de texto en el dispositivo. |
| Memory Recall (búsqueda semántica) | Depende del modelo de embedding local. |
| Entrada de voz Local Whisper | Sin conversión de voz a texto para las llamadas de Conversation. |
| Lector de estado de ánimo de los avatares | 2D Avatars y 3D Avatars eligen las caras a partir de una lista de palabras, no del pequeño modelo local de emociones. |

Todo lo demás funciona: chat, roleplay, Game Mode, agentes, lorebooks, personajes y servicios de IA remotos. Para las funciones de IA debes añadir una cuenta de un servicio externo. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).

```bash
docker run -d --name marinara-lite \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:lite
```

Algunas imágenes lite más antiguas fallan en una Raspberry Pi 4 y computadoras ARM similares con un error `SIGILL` (un error de instrucción ilegal) durante las llamadas salientes de IA. En esos dispositivos, usa la imagen `latest` normal. Consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md) para ver los detalles actuales.

## Podman

Podman ejecuta las mismas imágenes. En la mayoría de los comandos, cambia `docker` por `podman`.

```bash
podman compose up -d
```

Para ejecutar un solo contenedor sin Compose:

```bash
podman run -d \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:latest
```

`podman compose` necesita el ayudante `podman-compose`. Instálalo con uno de estos:

```bash
sudo dnf install podman-compose
sudo apt install podman-compose
pip install podman-compose
```

La primera línea es para Fedora, la segunda para Debian o Ubuntu, y la tercera funciona en cualquier lugar con pip.

## Construir la imagen tú mismo

Para construirla desde el código fuente en lugar de descargarla:

```bash
docker build -t marinara-engine .
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

Para construir la imagen lite, usa el archivo de compilación lite:

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

<a id="troubleshooting"></a>

## Solución de problemas

**La página no carga, o el puerto ya está en uso.** Consulta la solución del puerto en [Iniciar Marinara](#start-marinara).

**Marinara no puede escribir archivos, o ves errores de permisos.** El contenedor corrige la propiedad de la carpeta en cada arranque. La corrección puede fallar en algunos sistemas de archivos del host, y se omite si defines `MARINARA_SKIP_DATA_CHOWN=true`. Si los errores continúan, usa el volumen predeterminado `marinara-data`. Es el más fiable.

**La imagen lite falla en una Raspberry Pi 4.** Usa la imagen `latest` normal.

Para más ayuda, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Guías relacionadas

- [Referencia de configuración del servidor](../CONFIGURATION.md)
- [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md)
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md)
