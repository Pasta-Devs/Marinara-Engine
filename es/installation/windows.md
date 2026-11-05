# Guía de instalación en Windows

Instala Marinara Engine en una PC con Windows con el instalador (la menor cantidad de pasos) o desde el código fuente. Marinara se ejecuta entonces en tu propia PC.

## Antes de empezar

Necesitas Windows 10 o Windows 11 (64 bits), unos cuantos gigabytes de espacio libre en disco y una conexión a internet para la instalación. El instalador recomienda unos 2,5 GB libres.

También necesitas dos herramientas:

- **Node.js** 24, 25 o 26. Node.js ejecuta la app. La versión 24 es la versión LTS (Long Term Support, soporte a largo plazo) recomendada.
- **Git**. Git descarga el código y permite que Marinara se actualice sola.

Si usas el instalador, no las instales: el instalador consigue las dos por ti. Si instalas desde el código fuente, las instalas tú. No necesitas instalar pnpm (la herramienta que instala las partes de la app). El instalador y `start.bat` lo configuran.

## Instalar con el instalador de Windows

1. Abre la [página de versiones de Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine/releases).
2. Descarga el instalador de Windows más reciente. Se llama `Marinara-Engine-Installer-` seguido de la versión.
3. Ejecuta el instalador. Si Windows muestra "Windows protected your PC", elige **More info** (Más información) y luego **Run anyway** (Ejecutar de todas formas), pero solo con un archivo de la página de versiones.
4. Sigue las indicaciones. Si faltan Node.js o Git, deja que el instalador los instale.
5. Elige la carpeta de instalación, o acepta la predeterminada (`%LOCALAPPDATA%\Marinara-Engine`).
6. Espera mientras descarga y compila la app. Una lista de progreso muestra cada paso. Esto tarda unos minutos.
7. Cuando diga que la instalación terminó, haz doble clic en el acceso directo **Marinara Engine** del escritorio.

Se abre una ventana de consola (una ventana negra de texto) que muestra el progreso. Luego tu navegador abre Marinara. Si no lo hace, ve a `http://127.0.0.1:7860`.

El instalador crea una copia de Git de la versión estable más reciente, así que Marinara puede actualizarse sola en cada inicio.

> **Consejo:** algunas herramientas antivirus marcan el instalador porque descarga Node.js y Git. Ejecuta el instalador solo si lo conseguiste de la página de versiones de arriba.

## Iniciar y detener Marinara

- **Iniciar:** haz doble clic en el acceso directo del escritorio o en la entrada del menú Inicio. Si instalaste desde el código fuente, ejecuta `start.bat` en la carpeta de Marinara.
- **Detener:** el acceso directo abre una ventana de consola. Pulsa <kbd>Ctrl</kbd>+<kbd>C</kbd> en ella.

Si Marinara ya se está ejecutando, el acceso directo la vuelve a abrir en tu navegador.

## Instalar desde el código fuente

Usa este método si prefieres ejecutar los comandos tú mismo, o si quieres la versión staging (de pruebas).

1. Instala [Node.js](https://nodejs.org/en/download) y [Git for Windows](https://git-scm.com/download/win).
2. Abre una nueva ventana del Símbolo del sistema (Command Prompt, una ventana de texto donde escribes comandos).
3. Comprueba las dos herramientas. `node -v` debe mostrar la versión 24, 25 o 26.

   ```bat
   node -v
   git --version
   ```

   Si un comando no se encuentra, cierra y vuelve a abrir el Símbolo del sistema, o reinstala la herramienta que falte.

4. Descarga el código.

   ```bat
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

5. Abre su carpeta.

   ```bat
   cd Marinara-Engine
   ```

6. Opcional: cambia a la versión staging antes del primer inicio. Omite este paso para quedarte en la estable. Haz una copia de seguridad de tus datos antes de usar staging.

   ```bat
   git checkout staging
   ```

   Después, el lanzador te mantiene en staging cuando actualiza.

7. Ejecuta el lanzador, el script que configura e inicia Marinara.

   ```bat
   start.bat
   ```

El primer inicio tarda unos minutos mientras instala y compila todo. Una ventana de consola muestra el progreso. Tu navegador abre Marinara cuando está lista. Para volver a iniciarla más adelante, ejecuta `start.bat` desde la misma carpeta.

Si no funcionó: `[ERROR] Node.js 24 LTS or newer is required` significa que tu Node.js es demasiado antiguo. Instala Node.js 24 o más reciente desde [nodejs.org](https://nodejs.org) y luego vuelve a ejecutar `start.bat`.

### Configuración manual sin el lanzador

Este camino necesita el comando `pnpm`. Ejecuta esto desde dentro de la carpeta `Marinara-Engine`.

1. Instala pnpm una vez.

   ```bat
   npm install -g pnpm
   ```

2. Instala las dependencias (las partes que necesita la app), compila la app e inicia el servidor.

   ```bat
   pnpm install --force
   pnpm build
   pnpm start
   ```

3. Abre `http://127.0.0.1:7860`.

Con `pnpm start`, solo esta PC puede acceder a Marinara. Para que otros dispositivos se conecten, crea un archivo llamado `.env` en la carpeta `Marinara-Engine`, añade esta línea y reinicia el servidor.

```env
HOST=0.0.0.0
```

## Abrir Marinara desde otro dispositivo

El instalador, su acceso directo y `start.bat` dejan que otros dispositivos de tu red accedan a Marinara, pero los bloquean hasta que configures un inicio de sesión. Para los pasos, consulta [Acceso remoto](../REMOTE_ACCESS.md) y las [Preguntas frecuentes](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device).

## Actualizar Marinara

Cada vez que inicias Marinara desde el acceso directo o `start.bat`, el lanzador busca actualizaciones, las instala, recompila e inicia. Tus chats, personajes y ajustes se mantienen en su sitio. Si cambiaste el código tú mismo, el lanzador aparta tus cambios y los vuelve a poner después de la actualización. Si no puede, mantiene tu versión actual e imprime una nota. Para el botón **Apply Update** (Aplicar actualización) dentro de la app, omitir una actualización y los comandos manuales, consulta [Actualizar Marinara Engine](../UPGRADING.md#windows).

## Encontrar tus datos o desinstalar

Tus datos están en la carpeta `packages\server\data` dentro de la carpeta de Marinara. Para desinstalar, abre la entrada del menú Inicio **Uninstall Marinara Engine** (Desinstalar Marinara Engine). El desinstalador pregunta si también quieres borrar tus datos. Elige **No** para conservarlos para una reinstalación posterior. Consulta [Copia de seguridad y restauración de Marinara](../data/backup-and-restore.md).

## Opcional: eliminación del fondo de los sprites con IA

Marinara pide fondos transparentes para los sprites (imágenes del personaje) generados y limpia por sí misma los fondos planos. Como alternativa para paisajes detallados, puedes instalar la herramienta opcional `backgroundremover`. Descarga archivos grandes de aprendizaje automático, así que está desactivada de forma predeterminada.

1. Instala Python 3.11 desde [python.org](https://www.python.org/downloads/windows/). Python 3.9 a 3.11 funciona.
2. Ejecuta esto desde la carpeta `Marinara-Engine`.

   ```bat
   pnpm backgroundremover:install
   ```

Esto crea una carpeta privada de Python (un venv) dentro de tu carpeta de datos. Marinara la usa automáticamente.

Para que `start.bat` la instale en el próximo inicio, añade esta línea a tu archivo `.env`:

```env
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Si algo sale mal

Comprueba que Node.js sea la versión 24, 25 o 26 y que Git esté instalado. Para más soluciones, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Guías relacionadas

- [Instalación de Marinara Engine](../INSTALLATION.md)
- [Actualizar Marinara Engine](../UPGRADING.md)
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md)
- [Preguntas frecuentes](../FAQ.md)
