# Guía de instalación para macOS / Linux

Esta guía te muestra cómo instalar y ejecutar Marinara Engine en macOS o Linux. Instalarás dos herramientas necesarias, iniciarás la app con el lanzador de shell y aprenderás a actualizarla más adelante. Marinara Engine (que a partir de aquí llamamos Marinara) funciona por completo en tu propia computadora.

## Requisitos previos

Necesitas dos herramientas gratuitas instaladas antes de empezar:

- **Node.js**: el programa que ejecuta Marinara. Instala la versión 24, 25 o 26 (la versión 24 es la versión LTS recomendada).
- **Git**: la herramienta que descarga Marinara y obtiene las actualizaciones.

No necesitas instalar pnpm por tu cuenta. pnpm es el gestor de paquetes que usa Marinara para obtener sus partes. El lanzador de shell instala por ti la versión correcta de pnpm.

### Instalar en macOS

La forma más fácil es con Homebrew. Este único comando instala ambas herramientas:

```bash
brew install node git
```

Si no usas Homebrew, descarga el instalador de Node.js desde https://nodejs.org. Luego instala Git con las herramientas de línea de comandos de Xcode:

```bash
xcode-select --install
```

### Instalar en Linux

Usa el gestor de paquetes de tu distribución. En Ubuntu o Debian, la versión de Node.js predeterminada suele ser más antigua que la 24. Agrega primero la versión más nueva de NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
```

Luego instala Node.js y Git:

```bash
sudo apt install -y nodejs git
```

En Fedora:

```bash
sudo dnf install -y nodejs git
```

En Arch:

```bash
sudo pacman -S nodejs npm git
```

### Verificar las herramientas

Comprueba que ambas herramientas estén listas. Ejecuta este comando:

```bash
node -v
```

Deberías ver `v24` o un número mayor. Luego ejecuta este comando:

```bash
git --version
```

Deberías ver una versión como `git version 2.40` o superior. Si cualquiera de los comandos informa "command not found", la herramienta no está instalada correctamente.

## Inicio rápido con el lanzador

El script del lanzador `start.sh` es la forma recomendada de ejecutar Marinara. Instala todo, compila la app y la abre en tu navegador.

1. Descarga Marinara. Ejecuta este comando:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Entra en la nueva carpeta. Ejecuta este comando:

```bash
cd Marinara-Engine
```

3. Haz que el lanzador sea ejecutable. Ejecuta este comando:

```bash
chmod +x start.sh
```

4. Inicia Marinara. Ejecuta este comando:

```bash
./start.sh
```

La primera ejecución tarda unos minutos porque descarga y compila todo. Cuando termina, Marinara se abre en tu navegador en http://127.0.0.1:7860. El número 7860 es el puerto predeterminado, que es la puerta que la app usa en tu computadora.

Si tu navegador no se abre solo, ábrelo tú mismo y ve a esa misma dirección.

### Qué hace el lanzador cada vez

Cada vez que ejecutas `./start.sh` desde una descarga de Git, el lanzador:

1. Busca una versión más nueva y se actualiza a sí mismo si encuentra alguna.
2. Confirma que Node.js y la versión correcta de pnpm estén listos.
3. Instala cualquier parte que falte.
4. Vuelve a compilar la app cuando el código ha cambiado.
5. Prepara el almacenamiento local para tus datos.
6. Inicia el servidor y abre la app en tu navegador.

### Desactivar la apertura automática del navegador

De forma predeterminada, el lanzador abre tu navegador por ti. Para evitarlo, crea un archivo llamado `.env` en la carpeta de Marinara y agrega esta línea:

```bash
AUTO_OPEN_BROWSER=false
```

Un archivo `.env` es un archivo de texto plano que guarda tus opciones, una por línea. Un `.env` inicial pequeño se ve así:

```bash
PORT=7860
AUTO_OPEN_BROWSER=true
```

`PORT` establece el puerto de la dirección (7860 de forma predeterminada). De forma predeterminada, el lanzador también permite que otros dispositivos de tu LAN lleguen al servidor. LAN significa red de área local, la red de tu casa u oficina. Marinara sigue bloqueando esos dispositivos hasta que configuras un inicio de sesión u otra opción de acceso. La guía [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md) te muestra cómo hacerlo.

## Configuración manual

La mayoría de los usuarios deberían usar el lanzador de arriba. Si prefieres ejecutar cada paso tú mismo, sigue estos comandos en su lugar. Para la configuración manual necesitas tener pnpm disponible. Node.js 24 incluye Corepack, pero Node.js 25 no.

1. En Node.js 24, activa pnpm a través de Corepack:

```bash
corepack enable pnpm
```

En Node.js 25 o 26, instala primero el paquete Corepack proporcionado por el usuario y luego activa pnpm:

```bash
npm install --global corepack
corepack enable pnpm
```

2. Descarga Marinara. Ejecuta este comando:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

3. Entra en la carpeta. Ejecuta este comando:

```bash
cd Marinara-Engine
```

4. Instala las partes. Ejecuta este comando:

```bash
pnpm install --force
```

5. Compila la app. Ejecuta este comando:

```bash
pnpm build
```

6. Inicia el servidor. Ejecuta este comando:

```bash
pnpm start
```

Ahora abre http://127.0.0.1:7860 en tu navegador. Con `pnpm start`, el servidor escucha solo en tu propia computadora de forma predeterminada. Todo funciona localmente, y tu almacenamiento de datos se prepara en el primer inicio.

### Si la instalación falla en Linux

Algunos sistemas Linux rechazan las rutas de archivo muy largas durante la instalación. Si ves un error que contiene `ERR_PNPM_ENAMETOOLONG`, elimina las carpetas a medio terminar y empieza de nuevo desde el lanzador. Ejecuta este comando:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Luego ejecuta este comando:

```bash
./start.sh
```

## Eliminador de fondo opcional

Marinara puede eliminar el fondo de las imágenes de sprite de los personajes. Un sprite (imagen del personaje) es una imagen de personaje que se usa en los modos Roleplay y Game. La transparencia nativa y la limpieza adaptativa de matte integrada funcionan sin esta descarga. Instala el eliminador con IA adicional solo si además necesitas una alternativa para sprites hechos contra escenarios detallados, sombras u otros fondos que no son planos; descarga archivos grandes.

La herramienta adicional es un programa de Python. Instalarla crea un venv de Python (un entorno virtual, una carpeta privada que contiene los paquetes de Python). También descarga PyTorch, una biblioteca de aprendizaje automático. Por último, descarga los modelos U2Net, los archivos que encuentran el sujeto en una imagen.

Para instalarla una vez, ejecuta este comando desde la carpeta de Marinara:

```bash
pnpm backgroundremover:install
```

En macOS, la versión 3.11 de Python es la opción más fiable. Instálala primero con Homebrew:

```bash
brew install python@3.11
```

Luego ejecuta el comando de instalación de nuevo:

```bash
pnpm backgroundremover:install
```

Para que el lanzador instale esta herramienta por ti en el próximo inicio, agrega esta línea a tu archivo `.env`:

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Actualización

Cuando inicias Marinara con `./start.sh` desde una descarga de Git, el lanzador busca una versión más nueva. Se actualiza a sí mismo automáticamente antes de iniciar. Tus chats, personajes y opciones se conservan.

Ejecuta `./start.sh --skip-update` para omitir una comprobación. Para mantener la versión instalada de Engine entre inicios, agrega `AUTO_UPDATE_ENABLED=false` a `.env`. Todavía puedes comprobar o actualizar manualmente desde **Settings → Advanced → Updates** (Configuración → Avanzado → Actualizaciones) o con comandos de Git.

También puedes comprobarlo desde dentro de la app. Abre **Settings**, ve a la pestaña **Advanced** y busca la sección **Updates**. Haz clic en **Check for Updates** (Buscar actualizaciones) para ver si existe una versión más nueva. El botón **Apply Update** (Aplicar actualización) está desactivado de forma predeterminada. Para activarlo, configura algunas opciones del servidor. Luego guarda un secreto de administrador en **Settings**, **Advanced**, **Admin Access**. Si no lo activas, simplemente vuelve a iniciar con `./start.sh` para actualizar.

Para los pasos completos de actualización, incluido cómo hacer una copia de seguridad primero y cómo cambiar de canal de versiones, consulta la guía de actualización enlazada abajo.

## Términos clave

- **pnpm**: el gestor de paquetes que usa Marinara para descargar y organizar sus partes.
- **Corepack**: un ayudante incluido con Node.js que activa pnpm.
- **LAN**: red de área local, la red privada de tu casa u oficina.
- **.env**: un archivo de opciones de texto plano en la carpeta de Marinara, una opción por línea.
- **venv**: un entorno virtual de Python, una carpeta privada que contiene los paquetes de Python.
- **PyTorch**: una biblioteca de aprendizaje automático que usa el eliminador de fondo opcional.
- **U2Net**: los archivos de modelo que el eliminador de fondo usa para encontrar el sujeto en una imagen.

## Guías relacionadas

- [Instalación de Marinara Engine](../INSTALLATION.md): elige el método de instalación correcto para tu dispositivo.
- [Actualizar Marinara Engine](../UPGRADING.md): pasos completos de actualización y copia de seguridad para cada plataforma.
- [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md): configura una contraseña para que otros dispositivos puedan llegar a Marinara.
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md): correcciones para problemas de instalación e inicio.
