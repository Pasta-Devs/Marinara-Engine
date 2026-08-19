# Escribir extensiones personales

Esta guía está dirigida a quienes escriben sus propias extensiones para Marinara Engine. Para instalar, revisar y ejecutar una extensión de forma segura, empieza por [Personal Extensions](personal-extensions.md).

El código que escribas e importes se trata como una **External Extension** (extensión externa). Empieza desactivado y no puede ejecutarse hasta que lo inspecciones y apruebes su hash SHA-256 exacto.

## Antes de empezar

Las External Extensions permanecen ocultas hasta que abras las dos barreras de seguridad:

1. Establece `ENABLE_EXTERNAL_EXTENSIONS=true` en el archivo `.env` del host de Marinara.
2. Abre **Settings** > **Advanced** > **Danger Zone** y activa **Allow third-party extension imports**.

Importar y administrar extensiones también requiere acceso por localhost o tener configurado **Admin Access**. Si usas Marinara desde un teléfono, una dirección LAN o un navegador remoto, establece `ADMIN_SECRET` en el servidor e introduce el mismo valor en **Settings** > **Advanced** > **Admin Access**.

Elige el entorno con menos privilegios que pueda realizar la tarea:

| Entorno | Úsalo para | Límite importante |
| --- | --- | --- |
| Sandboxed Browser Extension | Estado privado, contexto del chat activo, botones, acciones de menú y paneles renderizados por Marinara | Sin DOM de Marinara, cookies, almacenamiento del navegador, red ni HTML arbitrario |
| Server Extension | Lógica en segundo plano que necesita temporizadores administrados y almacenamiento privado de la extensión | Sandbox separada del sistema operativo; sin archivos ni secretos de Marinara, red, procesos secundarios ni módulos nativos |
| Full-page External Extension | Código heredado que realmente necesita la página de Marinara o API del mismo origen | Sin sandbox; úsalo solo con código exacto que hayas revisado y en el que confíes plenamente |

Las Browser Extensions funcionan en todas las plataformas compatibles. Las Server Extensions requieren Seatbelt en macOS o Bubblewrap en Linux. Consulta la [tabla de plataformas](personal-extensions.md#platform-support) antes de elegir una Server Extension.

## Inicio rápido de una Browser Extension

Crea una carpeta con esta estructura:

```text
Hello Panel/
  manifest.json
  extension.js
  extension.css
```

Usa este `manifest.json`:

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

Usa este `extension.js`:

```js
const saved = await marinara.storage.get();
let count = Number(saved.count) || 0;

const statusElement = () => ({
  kind: "text",
  text: `Button pressed ${count} time${count === 1 ? "" : "s"}.`,
});
const elements = () => [
  statusElement(),
  { kind: "button", id: "increment", label: "Count one" },
];

const panel = marinara.ui.registerContribution({
  id: "hello-panel",
  kind: "panel",
  label: "Hello Panel",
  description: "Minimal Personal Extension example",
  icon: "hand",
  elements: elements(),
  onEvent: async ({ elementId }) => {
    if (elementId !== "increment") return;
    count += 1;
    await marinara.storage.patch({ count });
    panel.update({ elements: elements() });
    marinara.ui.showWindow({ title: "Hello Panel", elements: [statusElement()] });
  },
});

marinara.log.info("Hello Panel loaded");
marinara.onCleanup(() => panel.remove());
```

Usa este `extension.css` para aplicar estilos a la ventana iframe limitada que abre el botón:

```css
[data-ext-root] {
  font-size: 16px;
}
```

Después, importa y ejecuta la extensión:

1. Abre **Settings** > **Addons** > **External Extensions**.
2. Elige **Import Folder** y selecciona `Hello Panel`, o comprime la carpeta e importa el ZIP.
3. Abre el borrador desactivado e inspecciona su manifiesto y su JavaScript.
4. Elige **Review and Run** y aprueba el hash exacto que se muestra.
5. Abre el menú Extensions y selecciona **Hello Panel**.

El mismo ejemplo ejecutable se encuentra en `docs/examples/personal-extensions/browser-minimal/` dentro del repositorio.

## Referencia de la Browser API

Las Browser Extensions aisladas reciben un único objeto global inmutable llamado `marinara`:

| API | Propósito |
| --- | --- |
| `runtime`, `version` | Nombre del entorno (`client`) y versión actual de la Browser API |
| `extensionId`, `extensionName`, `capabilities` | Identidad y capacidades aprobadas de esta revisión exacta de la extensión |
| `log.debug/info/warn/error(...)` | Escribir una entrada etiquetada en la consola del navegador |
| `storage.get()` | Leer el objeto JSON privado de esta extensión |
| `storage.patch(object)` | Combinar valores en el almacenamiento privado y devolver el objeto nuevo |
| `storage.delete()` | Vaciar el almacenamiento privado |
| `context.get()` | Leer la instantánea actual del chat activo |
| `context.subscribe(listener)` | Recibir cambios de contexto; devuelve una función para cancelar la suscripción |
| `ui.registerContribution(options)` | Añadir un botón seguro, una entrada del menú Extensions o un panel renderizado por Marinara |
| `ui.showWindow(options)` | Abrir una ventana iframe limitada |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Temporizadores administrados que se eliminan cuando se detiene la extensión |
| `onCleanup(callback)` | Registrar lógica adicional de limpieza |

Usa los [paneles renderizados por Marinara](personal-extensions.md#add-a-marinara-rendered-panel) para la interfaz normal y el [contexto del chat activo](personal-extensions.md#use-active-chat-context) para un comportamiento que conozca el chat. El estado de la extensión debe guardarse en `marinara.storage`, no en el almacenamiento del navegador.

`showWindow({ title, elements, onEvent, onClose })` devuelve un controlador con `update({ title?, elements? })` y `close()`. El CSS del paquete aplica estilos a estas ventanas iframe aisladas; las contribuciones renderizadas por el host siempre usan el tema y los controles propios de Marinara.

El entorno Browser seguro no tiene API de DOM ni de red. No eludas este límite. Si falta una capacidad útil, solicita una capacidad específica y limitada en el host en vez de cambiar de forma predeterminada al acceso a toda la página.

### Capacidades de contexto

Declara el acceso opcional a registros en `config.capabilities`:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` rellena campos limitados de las tarjetas Character del chat activo.
- `read_active_persona` rellena campos limitados de la Persona seleccionada.
- `full_page_access` selecciona el entorno de compatibilidad sin sandbox y solo está disponible para External Extensions.

Cambiar las capacidades modifica el hash ejecutable, desactiva la extensión y exige una revisión nueva.

## Inicio rápido de una Server Extension

Crea esta carpeta:

```text
Server Counter/
  manifest.json
  server-extension.js
```

Usa este `manifest.json`:

```json
{
  "kind": "marinara.personal-server-extension",
  "version": 1,
  "config": {
    "name": "Server Counter",
    "version": "1.0.0",
    "description": "A minimal sandboxed Server Extension.",
    "runtime": "server",
    "capabilities": [],
    "serverJsPath": "server-extension.js"
  }
}
```

Usa este `server-extension.js`:

```js
const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
```

El mismo paquete ejecutable está disponible en `docs/examples/personal-extensions/server-minimal/`.

El código del servidor recibe `marinara.runtime`, `marinara.version`, la identidad de la extensión, `log`, `storage`, temporizadores administrados y `onCleanup`. No recibe acceso al sistema de archivos, procesos, red, carga de módulos ni base de datos de Marinara.

Las Server Extensions permanecen desactivadas cuando el host no puede establecer Seatbelt o Bubblewrap. Es una restricción de la plataforma, no un error de la extensión.

## Referencia del paquete y el manifiesto

| Campo | Notas |
| --- | --- |
| `kind` | `marinara.personal-extension` o `marinara.personal-server-extension` |
| top-level `version` | Versión del contenedor del paquete; actualmente `1` |
| `config.name` | Nombre visible obligatorio, de 1 a 200 caracteres |
| `config.version` | Versión opcional de la extensión, como `1.2.0`; las versiones numéricas con puntos permiten advertir sobre una reversión |
| `config.description` | Descripción opcional de hasta 2000 caracteres |
| `config.runtime` | `client` o `server`; el valor predeterminado es `client` |
| `config.capabilities` | Capacidades Browser solicitadas; las Server Extensions deben usar una lista vacía |
| `config.jsPath` / `config.serverJsPath` | Ruta del archivo JavaScript o matriz ordenada de rutas, relativa al manifiesto |
| `config.cssPath` | Ruta opcional del archivo CSS o matriz ordenada; el CSS del entorno seguro permanece en el iframe aislado |
| `config.js`, `config.serverJs`, `config.css` | Alternativas en línea cuando no hacen falta archivos separados |

Usa JavaScript normal. Marinara no compila TypeScript ni instala dependencias de extensiones. Si son necesarias, empaqueta las dependencias dentro de tu JavaScript antes de importarlo.

También se pueden importar directamente archivos sueltos `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs` y `.css`. Es preferible usar un manifiesto porque registra explícitamente la identidad, el entorno, la versión, las capacidades y el orden de los archivos.

### Límites de validación

| Contenido | Límite actual |
| --- | --- |
| Nombre / versión / descripción | 200 caracteres / 64 caracteres / 2000 caracteres |
| JS de Browser o Server | Sin límite de código por campo; todavía se aplica el límite del archivo, archivo comprimido o solicitud que lo contiene |
| CSS | 256 KiB |
| ZIP importado | 32 MiB comprimidos, 2 MiB por entrada de texto y 16 MiB de texto extraído en total |
| Almacenamiento privado | 1 000 000 bytes de JSON serializado por extensión |

Los límites del ZIP, la solicitud, el mensaje de la sandbox y el almacenamiento protegen límites de transporte o de ejecución distintos; no son una política sobre el código fuente ejecutable.

## Ciclo de actualización y recuperación

- Cada importación nueva empieza desactivada y sin aprobar.
- Editar el código, el CSS, el entorno o las capacidades borra la aprobación y desactiva la extensión.
- Volver a importar el mismo nombre actualiza el registro existente después de confirmarlo. Una reimportación idéntica byte por byte conserva el hash y la aprobación actuales; cambiar el contenido ejecutable borra la aprobación. Marinara advierte cuando las versiones numéricas indican una reversión.
- **Export** escribe el manifiesto y los archivos de código actuales en un paquete portátil. La aprobación nunca se exporta.
- Restaurar una revisión, importar un perfil o restaurar una copia de seguridad deja la extensión desactivada hasta que se vuelva a revisar.
- **Disable** detiene el entorno y la limpieza registrada. El código de página completa puede requerir recargar la página si creó efectos secundarios no registrados.
- **Delete** elimina el registro instalado. Expórtalo primero si podrías necesitar el código más adelante.

## Depuración

| Síntoma | Comprueba |
| --- | --- |
| No aparecen los controles de importación externa | Abre las dos barreras de External Extension descritas arriba |
| La administración indica que se necesita localhost o Admin Access | Configura `ADMIN_SECRET` y guárdalo en **Admin Access** |
| La importación no encuentra ninguna extensión | Comprueba `manifest.json` y sus rutas relativas; Server necesita JS, mientras que Browser necesita CSS o JS |
| La extensión se desactiva después de editarla | Es lo esperado: inspecciona y aprueba el hash exacto nuevo |
| El código Browser no puede usar `document`, `window`, `fetch` ni almacenamiento local | Es lo esperado en la sandbox segura; usa las API intermediarias documentadas |
| Server Extension no está disponible | Usa Seatbelt en macOS o Linux con Bubblewrap, o cambia a una Browser Extension |
| Browser Extension genera una excepción | Abre las herramientas de desarrollo del navegador; `marinara.log` y los errores de inicio llevan el nombre de la extensión |
| Server Extension genera una excepción | Comprueba su estado en **Settings** > **Addons** y el registro del servidor Marinara |

El CSS, el almacenamiento privado, los archivos importados y los mensajes de ejecución mantienen límites de seguridad separados. Marinara debe indicar qué límite rechazó un paquete en vez de presentarlo como un fallo de ejecución.

## Guías relacionadas

- [Personal Extensions](personal-extensions.md)
- [Configuración del servidor](../CONFIGURATION.md)
- [Solución de problemas](../TROUBLESHOOTING.md)
- [Arquitectura de Personal Extensions](../development/personal-extensions.md)
