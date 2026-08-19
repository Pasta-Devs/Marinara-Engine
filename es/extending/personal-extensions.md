# Extensiones personales

Las extensiones personales son borradores de código privados que Professor Mari crea para ti. Abre **Settings** (Configuración) > **Addons** > **Personal Extensions**.

El mensaje predeterminado es:

> Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.

No hay una acción de nuevo borrador ni controles de importación en esta sección. Pídele a Professor Mari que cree o modifique un borrador. Ella puede guardar código, pero no puede aprobarlo ni activarlo.

Para escribir e importar tu propio paquete, usa la [guía de creación de extensiones personales](writing-personal-extensions.md). Los paquetes creados por ti usan el flujo de extensiones externas, que tiene una autorización independiente.

## Revisar y activar

Cada borrador empieza desactivado. Marinara toma la huella del código ejecutable exacto con SHA-256. Abre el borrador, inspecciona el código, compara el hash que se muestra y luego elige **Review and Run** (Revisar y ejecutar) solo si aceptas esa versión exacta. Cualquier edición ejecutable o revisión restaurada desactiva la extensión y exige una nueva aprobación.

El aislamiento en un sandbox reduce los permisos; no hace que un código arbitrario sea confiable. Una extensión maliciosa todavía puede malgastar CPU hasta que el watchdog la detenga, saturar su propio almacenamiento dentro de los límites impuestos o comportarse de forma engañosa a través de los registros. Las extensiones de página completa renuncian a propósito a ese aislamiento. Revisa siempre el código antes de activarlo.

## Aislamiento en tiempo de ejecución

Una extensión de navegador (Browser Extension) se ejecuta en un Worker dedicado dentro de un iframe con sandbox de origen opaco. No puede acceder a la página de Marinara, ni al DOM, cookies, almacenamiento del navegador, APIs de origen o red. Sus capacidades son: almacenamiento privado de la extensión, registro, temporizadores gestionados, registro de limpieza, ventanas restringidas, espacios seguros de contribución al host y una instantánea de solo lectura del chat activo y de los IDs de personaje. Puede recibir campos seleccionados de las tarjetas de personaje activas o de la persona seleccionada solo cuando los permisos correspondientes están declarados y aprobados.

Las extensiones pueden añadir acciones a la barra superior, elementos al menú Extensions y paneles persistentes en el lado derecho con `marinara.ui.registerContribution(...)`. Marinara representa estas superficies usando el tema activo y un conjunto fijo de controles: encabezados, texto, salida preformateada, botones, campos de texto, selectores, interruptores, controles deslizantes, controles de color y espaciadores. Una extensión aporta contenido y estado, nunca HTML, CSS, URLs, componentes de React ni manejadores de eventos del host.

Estas capacidades y reglas de interfaz son idénticas para toda extensión de navegador en sandbox, sin importar su origen. Una extensión de terceros (External) importada usa este entorno de ejecución seguro, salvo que su paquete solicite explícitamente **Full page access** (Acceso a la página completa) o use el formato `marinara.extension` previo al sandbox que se describe más abajo.

### Añadir un panel representado por Marinara

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

Usa `kind: "button"` para una acción compacta y `kind: "menu-item"` para una acción del menú Extensions. Los botones usan `surface: "top-bar"` de forma predeterminada. También pueden apuntar a `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` o `settings`, con `position` en `header`, `before-content` o `after-content`. `icon` acepta cualquier nombre Lucide en kebab-case compatible con Marinara. Ambos tipos de acción invocan `onActivate`. Un `panel` invoca `onActivate` al abrirse; sus botones invocan `onEvent` con los valores actuales de todos los controles. El identificador admite actualizaciones según el tipo: `button` acepta `label`, `description`, `icon`, `surface` y `position`; `menu-item` acepta `label`, `description` e `icon`; `panel` acepta `label`, `description`, `icon` y `elements`. Todos admiten `remove()`. Los IDs pueden contener letras, números, `.`, `_` y `-`.

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

### Usar el contexto del chat activo

La versión 5 de la API de extensiones de navegador expone identificadores opacos del chat que Marinara muestra en ese momento:

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

Los IDs de chat y de personaje están siempre disponibles y permiten que una extensión reserve un espacio de nombres en su propio almacenamiento privado. Los campos de los registros requieren uno o ambos permisos opcionales en el manifiesto de la extensión:

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` rellena `characters` con las tarjetas que participan en el chat activo.
- `read_active_persona` rellena `persona` con la persona seleccionada por el chat activo.

Sin el permiso, su valor sigue siendo `[]` o `null`. Marinara muestra cada permiso solicitado en **Requested access** (Acceso solicitado) y otra vez en la ventana de aprobación de hash exacto. Añadir o quitar un permiso cambia el hash ejecutable, desactiva la extensión y exige una nueva aprobación.

Las instantáneas de personaje contienen únicamente `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` y `conversationDisplayName`. Las instantáneas de persona contienen únicamente `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` y `conversationDisplayName`. El texto se limita antes de cruzar el puente del sandbox.

Marinara nunca envía mensajes, notas del creador, prompts de sistema, instrucciones posteriores al historial, comentarios, rutas de avatar, bibliotecas completas de personajes o personas, campos no declarados, metadatos del chat, identificadores de base de datos, acceso a la red ni operaciones de modificación. Las actualizaciones de contexto siguen ligadas al hash de código aprobado y se entregan cuando cambian el chat activo, su lista de personajes o la persona seleccionada.

### Extensiones antiguas y de página completa

Los controladores de clima, los editores de prompt y otros flujos de trabajo sustanciales son casos de uso válidos de contribución. Sus adaptaciones seguras pueden usar un lanzador de menú o de barra superior más paneles que se actualizan de forma progresiva. Los paquetes existentes que inyectan superposiciones en el DOM, consultan selectores CSS de Marinara, recorren los internos de React o llaman a rutas `/api` del mismo origen no se pueden importar sin cambios al entorno de ejecución seguro.

Las contribuciones de interfaz proporcionan la interfaz, no permisos ambientales. La API de contexto siempre expone los IDs del chat activo y de los personajes, y puede exponer únicamente los campos declarados de los registros activos que se listan arriba. Las funciones que necesitan mensajes, presets, lorebooks, datos no declarados de personajes o personas, o efectos visuales de escena siguen necesitando una capacidad de intermediación (broker) aparte y de alcance muy acotado que Marinara exponga. Una extensión no debe simularla mediante acceso al DOM del host ni peticiones de red sin restricciones.

Si una extensión externa depende realmente del acceso al DOM del host, puede solicitar:

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Full page access no es una capacidad del sandbox.** El JavaScript y el CSS aprobados se ejecutan dentro de la página de Marinara. El código puede leer o cambiar cualquier cosa visible para la sesión actual del navegador, inspeccionar chats y tarjetas, usar el almacenamiento del navegador, hacer peticiones de red y llamar a las APIs de Marinara del mismo origen. En la práctica tiene los mismos permisos sobre la página que un código pegado en la consola del navegador. Los borradores de Professor Mari no pueden solicitarlo.

Marinara reconoce el envoltorio v1 más antiguo `kind: "marinara.extension"` sin un campo `capabilities` explícito como un paquete previo al sandbox y le asigna **Full page access** durante la importación. Esto permite que paquetes antiguos como WeatherTweaker lleguen al flujo de revisión correcto en vez de fallar en silencio dentro de un Worker. Un paquete moderno que use ese envoltorio pero quiera el entorno de ejecución seguro debe incluir `"capabilities": []`.

Las dos puertas de las extensiones externas y la aprobación de hash exacto siguen aplicándose. Un cambio de código, de CSS o de permisos desactiva la extensión y exige una nueva aprobación. Al desactivarla se eliminan los nodos de script y de hoja de estilos de Marinara, se cancelan los temporizadores creados con la API de compatibilidad y se ejecutan las funciones registradas con `marinara.onCleanup(...)`. Como el código de la página puede crear escuchadores, temporizadores, variables globales o cambios del DOM sin registrar, la limpieza es de mejor esfuerzo; recarga la página después de desactivar una extensión si queda algo.

La API más antigua `marinara.ui.showWindow(...)` sigue disponible para una ventana temporal dentro del iframe de origen opaco. Usa los mismos controles fijos y devuelve identificadores `update(...)` y `close()`. Prefiere las contribuciones cuando la herramienta deba ser accesible a través de la navegación normal de Marinara.

Una extensión de servidor (Server Extension) se ejecuta en un proceso de Node aparte, con permisos restringidos, dentro de macOS Seatbelt o Linux Bubblewrap. No puede acceder a los archivos de Marinara, a los archivos del usuario, a los secretos heredados del servidor, a la red, a procesos hijos, a workers ni a complementos nativos. Si Marinara no puede establecer un sandbox del sistema operativo compatible, las extensiones de servidor permanecen desactivadas.

### Compatibilidad de plataformas

Las extensiones de navegador las aísla el propio navegador en un sandbox, así que funcionan en todas partes. Las extensiones de servidor necesitan un sandbox del sistema operativo compatible; donde no existe, permanecen desactivadas y no se pueden activar; Marinara nunca recurre a ejecutarlas sin sandbox.

| Plataforma              | Extensiones de navegador en sandbox | Extensiones externas de página completa | Extensiones de servidor               |
| ----------------------- | ---------------------------- | ----------------------------- | ------------------------------------- |
| macOS                   | ✅ En sandbox                 | ⚠️ Requiere confianza explícita    | ✅ En sandbox (Seatbelt)               |
| Linux (con Bubblewrap) | ✅ En sandbox                 | ⚠️ Requiere confianza explícita    | ✅ En sandbox (Bubblewrap)             |
| Linux (sin `bwrap`) | ✅ En sandbox                 | ⚠️ Requiere confianza explícita    | ⛔ Desactivadas; instala `bwrap`         |
| Windows                 | ✅ En sandbox                 | ⚠️ Requiere confianza explícita    | ⛔ Desactivadas; usa una extensión de navegador |
| Android                 | ✅ En sandbox                 | ⚠️ Requiere confianza explícita    | ⛔ Desactivadas; usa una extensión de navegador |

En Windows y Android no hay un sandbox de procesos del sistema operativo compatible, así que las extensiones de servidor no están disponibles por diseño. Usa una extensión de navegador en su lugar, o ejecuta el servidor de Marinara en macOS o Linux (con `bwrap`) si necesitas una extensión de servidor.

## Extensiones externas

Las importaciones de terceros están bloqueadas y ocultas de forma predeterminada. Se requieren dos pasos:

1. En el host de Marinara, establece `ENABLE_EXTERNAL_EXTENSIONS=true` en `.env`.
2. Abre **Settings** > **Advanced** > **Danger Zone**, desplázate por debajo de los controles de eliminación de datos, lee la advertencia y activa **Allow third-party extension imports** (Permitir importaciones de extensiones de terceros).

Solo entonces **Settings** > **Addons** muestra **External Extensions** con controles de importación de archivos y carpetas. Los formatos compatibles siempre se muestran expandidos:

- paquetes `.personal-extension.zip` y `.zip` compatibles;
- manifiestos `.json`;
- `.css`;
- `.js`, `.mjs` y `.cjs`;
- `.server.js`, `.server.mjs` y `.server.cjs`.

Las importaciones nunca traen aprobación y no pueden activarse por sí mismas. Los registros antiguos, importados de un perfil, almacenados manualmente y de origen desconocido también se tratan como externos. Permanecen ocultos, no se pueden aprobar y quedan excluidos de ambos entornos de ejecución hasta que ambas puertas estén abiertas.

Revisa la lista **Requested access** antes de aprobar un hash exacto. La mayoría de las extensiones de navegador deberían quedarse en el sandbox seguro. Un paquete marcado con **Full page access** no está aislado a propósito y solo deberías activarlo cuando hayas inspeccionado esa versión exacta y confíes en ella.

Desactivar cualquiera de las dos puertas detiene los procesos de servidor externos activos, elimina los workers del navegador y los nodos del entorno de ejecución de página completa, y desactiva los registros externos almacenados. Volver a abrir las puertas no los ejecuta de nuevo automáticamente. Recarga la página si una extensión de página completa dejó atrás cambios que no registró para la limpieza.

Las extensiones de terceros pueden contener código malicioso o peligroso. Inspecciona siempre cada línea antes de descargarla, importarla o activarla. Procedes por tu entera responsabilidad.

## Exportación, revisiones y recuperación

Usa la acción de exportar de una extensión para descargar un paquete portátil. Los paquetes exportados y restaurados permanecen desactivados. Restaurar una revisión también la devuelve a un borrador desactivado.

Si una extensión se comporta mal, elige **Disable** (Desactivar). Si la interfaz no está disponible, detén Marinara y establece el valor `enabled` del registro `installed_extensions` correspondiente en `"false"`. Nunca establezcas `approvedHash` a mano.

## Guías relacionadas

- [Crear extensiones personales](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Configuración del servidor](../CONFIGURATION.md)
- [Copia de seguridad y restauración](../data/backup-and-restore.md)
- [Acceso remoto](../REMOTE_ACCESS.md)
