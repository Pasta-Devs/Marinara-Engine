# Escribir extensiones personales

Esta guía muestra cómo escribir una Browser Extension o una Server Extension, empaquetarla e importarla. Está dirigida a quienes saben escribir JavaScript. Para revisar y ejecutar una extensión, consulta [Personal Extensions](personal-extensions.md).

El código que escribas e importes se trata como una **External Extension** (extensión externa). Empieza desactivado y no puede ejecutarse hasta que lo inspecciones y apruebes su hash SHA-256 exacto.

## Antes de empezar

Las External Extensions permanecen ocultas hasta que completes los dos pasos de seguridad de [Permitir importaciones de terceros](personal-extensions.md#allow-third-party-imports): `ENABLE_EXTERNAL_EXTENSIONS=true` en `.env` y **Allow third-party extension imports** (Permitir importaciones de extensiones de terceros) en **Settings → Advanced → Danger Zone** (Configuración → Avanzado → Zona de peligro).

Importar y administrar extensiones también requiere acceso por localhost o el secreto de administrador. Desde un teléfono, una dirección LAN o un navegador remoto, establece `ADMIN_SECRET` en el servidor e introduce el mismo valor en **Settings → Advanced → Admin Access** (Configuración → Avanzado → Acceso de administrador).

Elige el entorno con menos privilegios que pueda realizar la tarea:

| Entorno | Úsalo para | Límite importante |
| --- | --- | --- |
| Sandboxed Browser Extension | Estado privado, contexto del chat activo, botones, acciones de menú y paneles renderizados por Marinara | Sin DOM de Marinara, cookies, almacenamiento del navegador, red ni HTML arbitrario |
| Server Extension | Lógica en segundo plano que necesita temporizadores administrados y almacenamiento privado de la extensión | Sandbox separada del sistema operativo; sin archivos ni secretos de Marinara, red, procesos secundarios ni módulos nativos |
| Full-page External Extension | Código heredado que necesita la página de Marinara o API del mismo origen | Sin sandbox; úsalo solo con código exacto en el que confíes plenamente |

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

1. Abre **Settings → Addons → External Extensions** (Configuración → Complementos → Extensiones externas).
2. Elige **Import Extension Folder** (Importar carpeta de extensión) y selecciona `Hello Panel`, o comprime la carpeta e importa el ZIP con **Import Extension File** (Importar archivo de extensión).
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
| `dice.registerFormat(options)` | Enseñar a `/roll` una notación; Marinara tira los dados que indica |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Temporizadores administrados que se eliminan cuando se detiene la extensión |
| `onCleanup(callback)` | Registrar lógica adicional de limpieza |

Usa los [paneles renderizados por Marinara](#add-a-marinara-rendered-panel) para la interfaz normal, el [contexto del chat activo](#use-active-chat-context) para un comportamiento que conozca el chat y los [formatos de dados](#add-a-dice-format) para una notación de `/roll` personalizada. El estado de la extensión debe guardarse en `marinara.storage`, no en el almacenamiento del navegador.

`showWindow({ title, elements, onEvent, onClose })` devuelve un controlador con `update({ title?, elements? })` y `close()`. El CSS del paquete aplica estilos a estas ventanas iframe aisladas; las contribuciones renderizadas por el host siempre usan el tema y los controles propios de Marinara.

El entorno Browser seguro no tiene API de DOM ni de red. No eludas este límite. Si falta una capacidad útil, solicita una capacidad específica y limitada en el host en vez de cambiar de forma predeterminada al acceso a toda la página.

### Capacidades de contexto

Declara el acceso opcional a registros en `config.capabilities`:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` rellena campos limitados de las tarjetas de personaje del chat activo.
- `read_active_persona` rellena campos limitados de la persona seleccionada.
- `full_page_access` selecciona el entorno de compatibilidad sin sandbox y solo está disponible para External Extensions.

Cambiar las capacidades modifica el hash ejecutable, desactiva la extensión y exige una revisión nueva.

<a id="what-a-browser-extension-can-do"></a>

### Qué puede hacer una Browser Extension

Una Browser Extension se ejecuta en un Worker dedicado dentro de un iframe aislado de origen opaco. No puede acceder a la página de Marinara, ni al DOM, las cookies, el almacenamiento del navegador, las API de origen o la red. Sus capacidades son el almacenamiento privado de la extensión, los registros, los temporizadores administrados, el registro de funciones de limpieza, las ventanas limitadas, los espacios seguros de contribución en el host y una instantánea de solo lectura del chat activo y de los IDs de personaje. Puede recibir campos seleccionados de las tarjetas de personaje activas o de la persona seleccionada solo cuando los permisos correspondientes están declarados y aprobados.

Las extensiones pueden añadir acciones a la barra superior o a los paneles laterales, entradas del menú Extensions y paneles persistentes en el lado derecho con `marinara.ui.registerContribution(...)`. Marinara renderiza estas superficies con el tema activo y un conjunto fijo de controles: encabezados, texto, salida preformateada, botones, campos de texto, selectores, interruptores, controles deslizantes, controles de color y espaciadores. Una extensión aporta contenido y estado, nunca HTML, CSS, URL, componentes de React ni manejadores de eventos del host.

Estas capacidades y reglas de la interfaz son idénticas para toda Browser Extension aislada, sea cual sea su origen. Una extensión de terceros (External) importada usa este entorno seguro, salvo que su paquete solicite explícitamente **Full page access** (Acceso completo a la página) o use el formato `marinara.extension` previo a la sandbox que se describe más abajo.

### Estimar los tokens de un texto

Las extensiones personales Browser, Full page access y Server pueden usar el estimador de tokens de texto integrado en Marinara:

```js
const tokens = marinara.estimateTextTokens(text);
```

La firma es `estimateTextTokens(text: string): number`, que también describe el tipo `PersonalExtensionTokenApi` exportado desde `@marinara-engine/shared`. La llamada es síncrona, no necesita ninguna capacidad adicional y devuelve el recuento estimado de tokens de Marinara, independiente del modelo, en lugar del resultado exacto de un tokenizador. En Engines anteriores, comprueba `typeof marinara.estimateTextTokens === "function"` antes de llamarla.

<a id="add-a-marinara-rendered-panel"></a>

### Añadir un panel renderizado por Marinara

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  description: "Tune a weather scene without leaving Marinara.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    {
      kind: "select",
      id: "weather",
      label: "Weather",
      value: "rain",
      options: [
        { value: "rain", label: "Rain" },
        { value: "snow", label: "Snow" },
        { value: "aurora", label: "Aurora" },
      ],
    },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => {
    const settings = await marinara.storage.get();
    // Update the panel when stored state should be reflected in the controls.
  },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});

marinara.onCleanup(() => panel.remove());
```

Usa `kind: "button"` para una acción compacta y `kind: "menu-item"` para una acción del menú Extensions. Usa `kind: "command"` para una entrada del Command Center que activa una contribución existente de la misma revisión de la extensión. Un comando requiere `targetContributionId` y no puede usar `onActivate` ni `onEvent`.

```js
marinara.ui.registerContribution({
  id: "open-weather",
  kind: "command",
  label: "Open weather controls",
  targetContributionId: "weather-settings",
});
```

El host resuelve un comando solo cuando el destino tiene el mismo ID de extensión y el mismo hash de contenido. Los destinos que faltan, los de otra extensión y los de una revisión obsoleta fallan de forma cerrada. Los botones usan `surface: "top-bar"` de forma predeterminada. En su lugar, pueden apuntar a `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` o `settings`, con `position` establecido en `header`, `before-content` o `after-content`. `icon` acepta cualquier nombre de icono de Lucide en kebab-case compatible con Marinara. Ambos tipos de acción invocan `onActivate`. Un `panel` invoca `onActivate` al abrirse; sus botones invocan `onEvent` con los valores actuales de todos los controles del panel. El controlador devuelto admite actualizaciones según el tipo: `button` acepta `label`, `description`, `icon`, `surface` y `position`; `menu-item` acepta `label`, `description` e `icon`; `panel` acepta `label`, `description`, `icon` y `elements`. Todos los controladores admiten `remove()`. Los IDs pueden contener letras, números, `.`, `_` y `-`.

Por ejemplo, esto coloca una acción nativa encima del contenido del panel Presets:

```js
marinara.ui.registerContribution({
  id: "preset-helper",
  kind: "button",
  label: "Preset helper",
  description: "Run the preset helper",
  icon: "list-sparkles",
  surface: "presets",
  position: "before-content",
  onActivate: () => {
    // Run extension behavior here.
  },
});
```

Las herramientas complejas pueden construir interfaces de varios pasos actualizando los elementos del panel después de un evento. Mantén el estado de la aplicación en `marinara.storage`; no lo codifiques en el marcado.

<a id="use-active-chat-context"></a>

### Usar el contexto del chat activo

La versión 5 de la Browser Extension API expone identificadores opacos del chat que Marinara muestra en ese momento:

```js
const renderForContext = async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
  if (!chatId) return; // Home, a library, or another surface without an active chat.

  const storage = await marinara.storage.get();
  const tab = storage.tabsByChat?.[chatId];

  // characterId is available only for a single-Character chat.
  // Use characterIds for group chats.
  marinara.log.debug("Loaded Notepad tab", {
    chatId,
    characterId,
    characterIds,
    personaId,
    characterNames: characters.map((character) => character.name),
    personaName: persona?.name ?? null,
    tab,
  });
};

const unsubscribe = marinara.context.subscribe(renderForContext);
marinara.onCleanup(unsubscribe);
```

`marinara.context.get()` devuelve la misma instantánea actual sin suscribirse. `chatId` es `null` y `characterIds` está vacío cuando no hay ningún chat activo. `characterId` solo tiene valor cuando participa exactamente un personaje; los chats grupales exponen a cada participante en `characterIds` y dejan `characterId` como `null`. `personaId` solo tiene valor cuando se aprueba `read_active_persona`.

Los IDs de chat y de personaje están siempre disponibles y permiten que una extensión separe por espacios de nombres su propio almacenamiento privado. Los campos de los registros requieren uno o ambos permisos opcionales en el manifiesto de la extensión:

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` rellena `characters` con las tarjetas que participan en el chat activo.
- `read_active_persona` rellena `persona` con la persona seleccionada por el chat activo.

Sin el permiso, su valor sigue siendo `[]` o `null`. Marinara muestra cada permiso solicitado en **Requested access** (Acceso solicitado) y otra vez en el cuadro de diálogo de aprobación del hash exacto. Añadir o quitar un permiso cambia el hash ejecutable, desactiva la extensión y exige una nueva aprobación.

Las instantáneas de personaje contienen únicamente `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` y `conversationDisplayName`. Las instantáneas de persona contienen únicamente `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` y `conversationDisplayName`. El texto se limita antes de cruzar el puente de la sandbox.

Marinara nunca envía mensajes, notas del creador, prompts de sistema, instrucciones posteriores al historial, comentarios, rutas de avatar, bibliotecas completas de personajes o de personas, campos no declarados, metadatos del chat, identificadores de base de datos, acceso a la red ni operaciones de modificación. Las actualizaciones de contexto siguen ligadas al hash de código aprobado y se entregan cuando cambian el chat activo, su lista de personajes o su persona seleccionada.

<a id="add-a-dice-format"></a>

### Añadir un formato de dados

La versión 6 de la Browser Extension API permite que una extensión enseñe a `/roll` una notación propia, como una reserva de dados narrativos. La extensión lee la notación e indica qué dados tirar; Marinara los tira con su propio generador seguro y devuelve las caras. Una extensión puede decir qué significa una tirada, nunca qué resultado sacó.

```js
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0] };

const format = marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  // Return null for notation this format does not read.
  parse(notation) {
    const terms = [...notation.matchAll(/(\d+)\s*(boost|setback)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array(Number(count)).fill(kind));
    return { dice: kinds.map(() => 6), kinds };
  },
  // rolls[i] is the face Marinara threw for dice[i]; plan is what parse returned.
  read({ notation, dice, rolls, plan }) {
    const net = rolls.reduce((sum, face, i) => sum + SYMBOLS[plan.kinds[i]][face - 1], 0);
    return { total: net, text: net > 0 ? `${net} success` : "failure" };
  },
});
marinara.onCleanup(() => format.remove());
```

Entonces `/roll 2 boost 1 setback` publica las caras, el total y el texto de la extensión, con el nombre del formato como etiqueta. La notación normal, como `2d6` o `4d6kh3`, siempre se tira como antes y nunca llega a una extensión. Cualquier otra notación pasa a cada formato registrado por orden, y la tirada la hace el primero cuyo `parse` devuelva dados.

- `parse(notation)` devuelve `null` o `{ dice: [sides, ...] }` con 1-100 dados de 2-1000 caras. Cualquier otro dato del objeto permanece en la sandbox y se devuelve a `read` como `plan`.
- `read(...)` devuelve `{ total, text?, kept? }`: un número finito, como máximo 200 caracteres de texto sin formato y, de forma opcional, las posiciones de los dados que contaron, en orden ascendente. `/roll` tacha el resto.
- Cada extensión puede registrar 4 formatos. La notación tiene como máximo 100 caracteres. `parse` y `read` pueden ser asíncronos, pero cada uno debe responder en 2 segundos.
- El texto se muestra sin formato: los enlaces, las imágenes, el formato y el HTML se escapan.

Los formatos de dados se aplican a `/roll` en el navegador. La herramienta `roll_dice` del Game Master y las demás tiradas del servidor conservan la notación integrada y los dados del conjunto de reglas. Comprueba `typeof marinara.dice?.registerFormat === "function"` antes de llamarlo en Engines anteriores.

### Extensiones antiguas y de página completa

Los controladores de clima, los editores de prompts y otros flujos de trabajo sustanciales son casos de uso válidos de las contribuciones. Sus adaptaciones seguras pueden usar un lanzador en un menú o en la barra superior más paneles que se actualizan de forma progresiva. Los paquetes existentes que inyectan superposiciones en el DOM, consultan selectores CSS de Marinara, recorren los internos de React o llaman a rutas `/api` del mismo origen no se pueden importar sin cambios al entorno seguro.

Las contribuciones de interfaz proporcionan la interfaz, no permisos ambientales. La API de contexto siempre expone los IDs del chat activo y de los personajes, y puede exponer únicamente los campos declarados de los registros activos que se listan arriba. Las funciones que necesitan mensajes, presets, lorebooks, datos no declarados de personajes o personas, o efectos visuales de escena siguen necesitando una capacidad intermediaria (broker) aparte y de alcance muy acotado que exponga Marinara. Una extensión no debe simularla mediante el acceso al DOM del host ni con solicitudes de red sin restricciones.

Si una External Extension depende del acceso al DOM del host, puede solicitar:

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Full page access no es una capacidad de la sandbox.** El JavaScript y el CSS aprobados se ejecutan dentro de la página de Marinara. El código puede leer o cambiar cualquier cosa visible para la sesión actual del navegador, inspeccionar chats y tarjetas, usar el almacenamiento del navegador, hacer solicitudes de red y llamar a las API de Marinara del mismo origen. En la práctica tiene los mismos permisos sobre la página que un código pegado en la consola del navegador. Los borradores de Professor Mari no pueden solicitarlo.

Las extensiones de página completa deberían usar `marinara.fetch(...)` para las solicitudes de red. Tiene la misma firma y el mismo resultado que `window.fetch`, y permite que **Settings > Addons > External Extensions** muestre el número de solicitudes de esa extensión en la sesión, los bytes transferidos que indican las respuestas, la frecuencia reciente de solicitudes y una advertencia de tráfico elevado sostenido. La llamada directa a `window.fetch` sigue disponible porque el acceso a la página completa es código de confianza de la página, pero esas solicitudes no se pueden atribuir a la extensión.

Marinara reconoce el contenedor v1 más antiguo `kind: "marinara.extension"` sin un campo `capabilities` explícito como un paquete previo a la sandbox y le asigna **Full page access** durante la importación. Esto permite que paquetes antiguos como WeatherTweaker lleguen al flujo de revisión correcto en vez de fallar en silencio dentro de un Worker. Un paquete moderno que use ese contenedor pero quiera el entorno seguro debe incluir `"capabilities": []`.

Las dos barreras de las External Extensions y la aprobación del hash exacto siguen aplicándose. Un cambio de código, de CSS o de permisos desactiva la extensión y exige una nueva aprobación. Al desactivarla se eliminan los nodos de script y de hoja de estilos de Marinara, se cancelan los temporizadores creados con la API de compatibilidad y se ejecutan las funciones registradas con `marinara.onCleanup(...)`. Como el código de la página puede crear escuchadores, temporizadores, variables globales o cambios del DOM sin registrar, la limpieza es de mejor esfuerzo; recarga la página después de desactivar una extensión si queda algo.

La API más antigua `marinara.ui.showWindow(...)` sigue disponible para una ventana temporal dentro del iframe de origen opaco. Usa los mismos controles fijos y devuelve los controladores `update(...)` y `close()`. Prefiere las contribuciones cuando la herramienta deba ser accesible a través de la navegación normal de Marinara.

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
| Almacenamiento privado | 1.000.000 bytes de JSON serializado por extensión |

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
| Server Extension genera una excepción | Comprueba su estado en **Settings → Addons** y el registro del servidor Marinara |

El CSS, el almacenamiento privado, los archivos importados y los mensajes de ejecución mantienen límites de seguridad separados. Marinara debe indicar qué límite rechazó un paquete en vez de presentarlo como un fallo de ejecución.

## Guías relacionadas

- [Personal Extensions](personal-extensions.md)
- [Configuración del servidor](../CONFIGURATION.md)
- [Solución de problemas](../TROUBLESHOOTING.md)
- [Arquitectura de Personal Extensions](../development/personal-extensions.md)
