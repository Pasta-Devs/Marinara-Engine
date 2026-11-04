# Guía de instalación para macOS / Linux

Instala Marinara Engine en una Mac o en una computadora con Linux e inícialo con el lanzador `start.sh`. Marinara se ejecuta entonces en tu propia computadora.

## Antes de empezar

Necesitas dos herramientas:

- **Node.js** 24, 25 o 26. Node.js ejecuta Marinara. La versión 24 es la versión LTS (Long Term Support, soporte a largo plazo) recomendada.
- **Git**. Git descarga Marinara y obtiene las actualizaciones.

No necesitas instalar pnpm (la herramienta que instala las partes de la app). El lanzador configura la versión correcta.

### Instalar Node.js y Git en macOS

Con Homebrew, un solo comando instala las dos:

```bash
brew install node git
```

Sin Homebrew, descarga el instalador de Node.js desde [nodejs.org](https://nodejs.org). Luego instala Git con las herramientas de línea de comandos de Xcode:

```bash
xcode-select --install
```

### Instalar Node.js y Git en Linux

Usa tu gestor de paquetes. En Ubuntu o Debian, la versión de Node.js predeterminada suele ser más antigua que la 24, así que agrega primero la versión de NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
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

```bash
node -v
git --version
```

`node -v` debe mostrar `v24` o un número mayor. Si cualquiera de los comandos dice "command not found", la herramienta no está instalada correctamente.

## Instalar e iniciar Marinara

1. Abre una terminal, una ventana donde escribes comandos. En una Mac, pulsa <kbd>Cmd</kbd>+<kbd>Space</kbd>, escribe Terminal y pulsa Enter. En Linux, abre tu app de terminal.
2. Descarga Marinara.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Abre la carpeta nueva.

   ```bash
   cd Marinara-Engine
   ```

4. Inicia Marinara con el lanzador, el script que la configura y la inicia.

   ```bash
   ./start.sh
   ```

La primera ejecución tarda unos minutos mientras descarga y compila todo. La terminal muestra el progreso y luego `Press Ctrl+C to stop`. Marinara se abre en tu navegador en `http://127.0.0.1:7860`. Si el navegador no se abre, ve tú mismo a esa dirección.

Si no funcionó:

- `permission denied`: ejecuta `chmod +x start.sh` y luego otra vez `./start.sh`.
- `[ERROR] Node.js 24 LTS or newer is required`: tu Node.js es demasiado antiguo. Instala una versión más nueva y luego vuelve a ejecutar `./start.sh`.

## Iniciar y detener Marinara

- **Volver a iniciar:** ejecuta `./start.sh` desde la carpeta de Marinara. Si Marinara ya se está ejecutando, la vuelve a abrir en tu navegador.
- **Detener:** pulsa <kbd>Ctrl</kbd>+<kbd>C</kbd> en la terminal.

Cada vez que ejecutas `./start.sh` desde una descarga de Git, el lanzador:

1. Busca una versión más nueva y se actualiza si encuentra alguna.
2. Comprueba Node.js y la versión correcta de pnpm.
3. Instala las partes que falten y vuelve a compilar la app si el código cambió.
4. Inicia el servidor y abre tu navegador.

## Cambiar las opciones del lanzador

Las opciones del lanzador viven en un archivo `.env` en la carpeta de Marinara. Un archivo `.env` es un archivo de texto plano con una opción por línea. Para que el lanzador no abra tu navegador, agrega esta línea:

```bash
AUTO_OPEN_BROWSER=false
```

`PORT` establece el puerto, el número que va después de los dos puntos en la dirección (7860 de forma predeterminada). El lanzador permite que otros dispositivos de tu red local accedan a Marinara, pero los bloquea hasta que configures un inicio de sesión. Consulta [Acceso remoto](../REMOTE_ACCESS.md).

## Actualizar Marinara

Ejecutar `./start.sh` primero actualiza Marinara. Tus chats, personajes y opciones se conservan. Si cambiaste el código tú mismo, el lanzador aparta tus cambios y los vuelve a poner después de la actualización. Para omitir una actualización, el botón **Apply Update** (Aplicar actualización) dentro de la app y los comandos manuales, consulta [Actualizar Marinara Engine](../UPGRADING.md#macos-and-linux).

## Configuración manual sin el lanzador

La mayoría de las personas deberían usar el lanzador. Para ejecutar cada paso tú mismo, necesitas pnpm. Node.js 24 incluye Corepack, una herramienta que activa pnpm. Node.js 25 no lo incluye.

1. En Node.js 24, activa pnpm:

   ```bash
   corepack enable pnpm
   ```

   En Node.js 25 o 26, instala primero Corepack:

   ```bash
   npm install --global corepack
   corepack enable pnpm
   ```

2. Descarga Marinara.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Abre su carpeta.

   ```bash
   cd Marinara-Engine
   ```

4. Instala las partes, compila la app e inicia el servidor.

   ```bash
   pnpm install --force
   pnpm build
   pnpm start
   ```

5. Abre `http://127.0.0.1:7860`.

Con `pnpm start`, el servidor escucha solo en tu propia computadora. Para que otros dispositivos se conecten, agrega `HOST=0.0.0.0` a `.env` y reinicia.

## Opcional: eliminador de fondo

Marinara pide fondos transparentes para los sprites (imágenes del personaje) generados y limpia por sí misma los fondos planos. Como alternativa para paisajes detallados o sombras, puedes instalar el eliminador de fondo con IA opcional. Configura un venv de Python (una carpeta privada para los paquetes de Python) y descarga archivos grandes: PyTorch (una biblioteca de aprendizaje automático) y los modelos U2Net (archivos que encuentran el sujeto de una imagen).

1. En macOS, Python 3.11 es lo que mejor funciona. Instálalo primero. Python 3.9 a 3.11 funciona.

   ```bash
   brew install python@3.11
   ```

2. Desde la carpeta de Marinara, ejecuta:

   ```bash
   pnpm backgroundremover:install
   ```

Para que el lanzador lo instale en el próximo inicio, agrega esta línea a `.env`:

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Si algo sale mal

En algunos sistemas Linux, la instalación falla con un error que contiene `ERR_PNPM_ENAMETOOLONG` (rutas de archivo demasiado largas). Elimina las carpetas a medio terminar y vuelve a ejecutar el lanzador:

```bash
rm -rf node_modules .pnpm .pnpm-store
./start.sh
```

Para más soluciones, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Guías relacionadas

- [Instalación de Marinara Engine](../INSTALLATION.md)
- [Actualizar Marinara Engine](../UPGRADING.md)
- [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md)
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md)
