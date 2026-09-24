# Arquitectura de las extensiones personales

Las extensiones personales son código desactivado de forma predeterminada y aprobado por hash, con dos entornos de ejecución aislados. Los borradores de Professor Mari son la única clase de extensión disponible de forma predeterminada. Todas las demás fuentes son extensiones externas y requieren dos controles independientes del operador.

## Invariantes de seguridad

Mantén ciertas estas propiedades:

1. La creación y la importación siempre producen un borrador desactivado y sin aprobar.
2. La aprobación requiere el hash de contenido `sha256:` exacto y actual, y una confirmación explícita de ejecución de código. El acceso a la página completa requiere una confirmación explícita adicional.
3. Cualquier cambio ejecutable desactiva la extensión y borra `approvedHash`.
4. La reversión restaura un borrador desactivado.
5. La copia de seguridad y la importación de perfil borran la aprobación y el estado de activación.
6. Professor Mari puede crear y actualizar borradores, pero no tiene ninguna acción que los apruebe ni los active.
7. Toda fuente distinta de `professor_mari` es externa, incluidas `external`, `local`, `legacy`, `profile_import` y los valores desconocidos que se normalizan a `legacy`.
8. Los registros externos no aparecen en las respuestas de gestión ni de tiempo de ejecución a menos que `ENABLE_EXTERNAL_EXTENSIONS=true` y la aceptación persistida de la Danger Zone (Zona de peligro) también sea verdadera.
9. Cerrar cualquiera de los dos controles desactiva los registros externos guardados y detiene los procesos activos del servidor. El sondeo del entorno de ejecución del navegador elimina los procesos de trabajo activos del navegador.
10. El código del navegador en el entorno aislado (sandbox) nunca se ejecuta en el documento de Marinara. Solo una extensión de navegador externa con `full_page_access` aprobado por hash exacto puede usar el entorno de ejecución de página separado. El código del servidor nunca se ejecuta en el proceso del servidor de Marinara.
11. No hay instalador por URL, catálogo remoto ni actualizador automático.
12. Las contribuciones al host son descriptores planos validados. El marcado, los estilos, las URLs, los componentes y los callbacks de la extensión nunca cruzan al árbol de React de Marinara.
13. El registro, la activación, los eventos, las actualizaciones y la eliminación de contribuciones permanecen ligados al hash de contenido aprobado y exacto de la extensión activada.
14. Las instantáneas de contexto del navegador contienen siempre, como base, solo el ID del chat activo y los IDs de los personajes. Los permisos opcionales `read_active_characters` y `read_active_persona` pueden añadir campos acotados y en lista de permitidos, solo de los registros activos en ese chat; nunca exponen mensajes, bibliotecas completas, campos no declarados, metadatos ni acceso a la aplicación.
15. Los permisos solicitados forman parte del hash ejecutable. Cualquier cambio de permisos desactiva la extensión y exige una nueva aprobación por hash exacto.
16. `full_page_access` es solo para extensiones externas, requiere los dos controles de extensiones externas y nunca está disponible para los borradores de Professor Mari. Es un modo de confianza explícito, no una afirmación de aislamiento.

Los controles se aplican en las rutas y en los servicios de tiempo de ejecución. Ocultar controles no es un límite de seguridad. Un registro externo añadido manualmente, restaurado, heredado (legacy) o creado fuera de banda debe permanecer invisible e inejecutable mientras cualquiera de los dos controles esté cerrado.

## Almacenamiento y política

La tabla de archivos `installed_extensions` guarda metadatos, código ejecutable, `contentHash`, `approvedHash`, la fuente y hasta diez revisiones ejecutables anteriores. Los ajustes privados de la extensión usan claves de `app_settings` con el prefijo `extension-storage:`. La aceptación de la Danger Zone usa `external-extensions-enabled`.

El arranque ejecuta `preparePersonalExtensionTrust`. Una fila heredada sin hash se conserva, pero queda desactivada y sin aprobar. Una fila cuyo hash guardado ya no coincide con sus campos ejecutables también se desactiva y se vuelve a calcular su huella.

`personal-extension-policy.service.ts` combina el control en vivo de `.env` con la aceptación persistida del usuario. `personal-extension-storage.service.ts` puede desactivar todos los registros que no sean de Professor. El observador de `.env` vuelve a aplicar la política en aproximadamente dos segundos y pide al entorno de ejecución del servidor que detenga el código cuando el control se cierra.

## API

La superficie de gestión está bajo `/api/personal-extensions`:

- `GET /policy` devuelve el estado de ambos controles y la disponibilidad del sandbox del servidor.
- `PATCH /policy/external` cambia la aceptación de la Danger Zone y rechaza `true` a menos que el control de `.env` esté abierto.
- `GET /` lista los borradores de Professor más los borradores externos solo cuando ambos controles están abiertos.
- `POST /` importa una extensión externa y se rechaza a menos que ambos controles estén abiertos.
- `PATCH /:id` edita o desactiva un borrador.
- `POST /:id/approve` aprueba el hash exacto y actual, aplica el control externo y rechaza la aprobación del servidor sin un sandbox de sistema operativo compatible.
- `POST /:id/rollback` restaura una revisión anterior desactivada.
- `DELETE /:id` elimina la extensión y los ajustes privados.

Los metadatos aprobados del entorno de ejecución del navegador se leen desde `GET /runtime/client`. El código aislado lo sirve `GET /:id/sandbox.html?hash=...`. El código y el CSS de página completa los sirven `GET /:id/page-runtime.js?hash=...` y `GET /:id/page-style.css?hash=...`. Todas estas rutas exigen que el hash exacto siga activado, aprobado y permitido por la política; las rutas de página requieren además una fuente externa y `full_page_access`.

## Entorno de ejecución aislado del navegador

`PersonalExtensionInjector.tsx` crea un iframe oculto con `sandbox="allow-scripts"` y sin `allow-same-origin`. Por tanto, el iframe tiene un origen opaco y no puede acceder al DOM, las cookies, el almacenamiento ni las APIs del mismo origen de Marinara.

La respuesta del sandbox reemplaza la política normal de la página por una CSP estrecha: sin recursos predeterminados, sin conexiones, sin formularios, sin objetos y sin autoridad de navegación. El CSS de la extensión permanece dentro del iframe oculto. El JavaScript se ejecuta en un Worker dedicado creado por el arranque del iframe de confianza. Los globales de red y de workers anidados se eliminan como defensa en profundidad.

El worker recibe solo:

- registro con espacio de nombres;
- almacenamiento privado de la extensión intermediado por el padre;
- temporizadores gestionados;
- registro de limpieza;
- identificadores de solo lectura del chat activo y de los personajes a través de `marinara.context`;
- campos acotados de las tarjetas de personaje activas y de la persona seleccionada, solo a través de capacidades aprobadas por separado;
- una ventana de iframe restringida a través de `marinara.ui.showWindow(...)`;
- ranuras de contribución del host de confianza a través de `marinara.ui.registerContribution(...)`.

La versión 5 de la API de extensiones de navegador añade `marinara.context.get()` y `marinara.context.subscribe(listener)`. La instantánea inmutable tiene esta forma:

```ts
{
  chatId: string | null;
  characterId: string | null;
  characterIds: readonly string[];
  personaId: string | null;
  characters: readonly PersonalExtensionCharacterSnapshot[];
  persona: PersonalExtensionPersonaSnapshot | null;
}
```

El cliente deriva la instantánea de `useChatStore` y la envía cuando cambia el chat activo, su lista de personajes o su persona seleccionada. Los IDs son cadenas no vacías con un tope de 256 caracteres; la lista de personajes se deduplica y tiene un tope de 256 entradas. El iframe acepta una actualización de contexto solo de su padre y solo cuando su `contentHash` coincide con la revisión exacta de la extensión; después, el Worker vuelve a normalizar y congelar la carga. El arranque de la extensión espera la primera instantánea del host, con una alternativa de contexto nulo al cabo de un segundo para que un puente fallido no pueda bloquear el Worker indefinidamente.

`characterId` es una comodidad para los chats de un solo personaje y sigue siendo `null` en los chats grupales; `characterIds` contiene a todos los participantes activos. `personaId` solo está disponible con `read_active_persona`. Sin chat activo, `chatId`, `characterId`, `personaId` y `persona` son `null`, mientras que `characterIds` y `characters` están vacíos. Las extensiones pueden usar los identificadores de forma segura como claves en su propio almacenamiento privado.

`read_active_characters` permite que `characters` contenga solo los campos `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` y `conversationDisplayName` de las tarjetas activas. `read_active_persona` permite que `persona` contenga solo `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` y `conversationDisplayName`. El servidor deriva ambos conjuntos del chat activo, aplica límites por campo y límites agregados, y nunca acepta un ID de registro enviado por el cliente como prueba de alcance.

Las capacidades se declaran en la carga de la extensión, se guardan con cada revisión, se muestran en Settings (Configuración) y en el cuadro de diálogo de aprobación, y se incluyen en el hash ejecutable. El host envía primero la instantánea con solo IDs y luego la enriquece a través del intermediario aprobado y específico de esa extensión. El Worker descarta de forma independiente los registros no declarados, rechaza los registros de personaje cuyos IDs no estén en `characterIds`, vuelve a acotar la carga y congela el resultado.

`marinara.ui.showWindow({ title, elements, onEvent, onClose })` devuelve un identificador con `update({ title?, elements? })` y `close()`. El worker solo envía descriptores, y el arranque del iframe de confianza construye cada elemento con las APIs del DOM y `textContent` (nunca `innerHTML`). El host revela el iframe del sandbox, oculto en el resto de casos, solo mientras hay una ventana abierta, y lo vuelve a ocultar al cerrarla.

`marinara.ui.registerContribution({ id, kind, label, description?, icon?, surface?, position?, elements?, onActivate?, onEvent? })` devuelve un identificador congelado con `update(patch)` y `remove()`. Admite estas ubicaciones de confianza del host:

- `button`: una acción compacta en la barra superior de forma predeterminada, o una acción renderizada por el host en la superficie `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` o `settings`;
- `menu-item`: una acción en el menú Extensions;
- `panel`: una entrada que abre el panel lateral de confianza Extensions de Marinara.

Los botones de panel lateral admiten `position: "header"`, `"before-content"` o `"after-content"`. Los de la barra superior omiten `position`. Los iconos son nombres kebab-case con límites del catálogo de iconos Lucide de Marinara; los nombres no admitidos usan el icono de rompecabezas.

Los elementos del panel usan el mismo vocabulario declarativo que las ventanas restringidas: `heading`, `text`, `pre`, `button`, `input`, `select`, `toggle`, `slider`, `color` y `spacer`. Los controles interactivos requieren IDs únicos. Un botón de panel envía `{ contributionId, elementId, values }` a `onEvent`; `values` contiene el valor de cadena actual de cada control. `onActivate` se ejecuta dentro del Worker de la extensión cuando el usuario abre o invoca la contribución. La extensión puede llamar a `handle.update(...)` para reemplazar su etiqueta, descripción, icono o elementos del panel después de cambios de estado.

El cliente valida de forma independiente cada descriptor antes de añadirlo al almacén del entorno de ejecución. Las clases de contribución, superficies, posiciones, controles, IDs, listas de opciones, sintaxis de nombres de iconos, longitudes de texto, texto total del panel, número de elementos y número de contribuciones por extensión se validan y limitan. React renderiza el texto de la extensión como texto. No se acepta ningún HTML, CSS, URL, componente de React ni callback del host controlado por la extensión. El host elimina todas las contribuciones cuando el worker se detiene, cuando su hash cambia o cuando desaparece de la respuesta del entorno de ejecución aprobado. Los eventos se envían solo al worker registrado para el mismo ID de extensión y el mismo hash de contenido.

No hay ayudante del DOM, ni acceso a la API de Marinara, ni acceso a eventos del padre, ni capacidad de red arbitraria. El iframe valida y limita la tasa de los mensajes. Un vigilante de latidos (heartbeat) termina un worker que no responde o que está en un bucle ocupado.

## Entorno de ejecución de compatibilidad de página completa

El protocolo de contribuciones sigue siendo la vía preferida para las herramientas cargadas de ajustes y los flujos de trabajo de varios pasos. Una extensión compleja puede reemplazar progresivamente los elementos de un panel y mantener su propio estado en el almacenamiento privado de la extensión.

Los paquetes heredados existentes que inyectan botones con selectores del host, recorren los internos de React, escriben superposiciones arbitrarias o llaman a rutas `/api` del mismo origen no funcionan sin cambios en el entorno de ejecución seguro. Es preferible portarlos a descriptores de contribución y a capacidades de intermediación de alcance estrecho.

Cuando la compatibilidad necesita de verdad la página del host, una extensión externa puede solicitar `full_page_access`. `PersonalExtensionInjector.tsx` carga esa revisión aprobada exacta mediante un elemento de script del mismo origen y una hoja de estilos opcional. El código fuente se ejecuta dentro de una función asíncrona con un pequeño objeto `marinara` de compatibilidad para identidad, registro, almacenamiento privado, temporizadores gestionados y registro de limpieza; los globales del entorno de la página siguen disponibles porque esa es la autoridad solicitada.

El cargador de página valida el `id`, el nombre y el hash de contenido contra los metadatos del entorno de ejecución antes de invocar el código. El servidor verifica por separado el hash exacto, el estado de activación, la fuente externa, el permiso y la política de los dos controles en cada petición de script o de hoja de estilos. Cerrar un control desactiva el registro; después, el sondeo del entorno de ejecución elimina los nodos inyectados y hace una limpieza en la medida de lo posible. Esto no puede revocar los efectos secundarios arbitrarios que ya haya creado el código de página con confianza total, así que el flujo visible para el usuario avisa de que puede hacer falta recargar.

Las importaciones heredadas con `kind: "marinara.extension"` y sin una declaración explícita de `capabilities` reciben `full_page_access`. Las exportaciones modernas siempre escriben el campo de capacidades, incluso vacío, para que los paquetes seguros no se reclasifiquen al volver a importarlos.

## Entorno de ejecución del servidor

El código fuente del servidor se ejecuta en un proceso de Node separado, nunca a través de una importación dentro del mismo proceso. El modelo de permisos de Node deniega las capacidades de sistema de archivos, red, proceso hijo, worker, complemento nativo, WASI e inspector. El proceso hijo también se ejecuta dentro de:

- macOS Seatbelt; o
- Linux Bubblewrap con espacios de nombres separados de PID, red, IPC y montaje.

El sandbox recibe un entorno mínimo, un heap de V8 pequeño, ningún archivo de la aplicación, ningún secreto del servidor y archivos de protocolo delimitados por líneas y acotados dentro de su directorio temporal privado. Recibe solo registro, almacenamiento privado de la extensión, temporizadores gestionados y registro de limpieza. Las cuotas de mensajes y un archivo de latidos separado contienen la inundación del protocolo y los bucles ocupados.

Los permisos de Node y `node:vm` son capas de defensa en profundidad, no el límite de seguridad. El sandbox de sistema operativo separado es obligatorio. Windows, Android, Linux sin `bwrap` y cualquier otra plataforma no compatible se niegan a activar las extensiones de servidor.

## Validación

Ejecuta:

```bash
pnpm check
pnpm regression:extensions-security
pnpm regression:professor-mari-shell-sandbox
pnpm smoke:ui
```

La regresión de seguridad debe demostrar el control de dos pasos, la invalidación por hash exacto, la forma del worker de origen opaco, las instantáneas de contexto acotadas y ligadas al hash, la validación y limpieza de las contribuciones del host, el enrutamiento y la confirmación de página completa solo para extensiones externas, la clasificación de los paquetes heredados, la depuración del entorno, la denegación de sistema de archivos y red, el almacenamiento privado y la disponibilidad del sandbox que falla en estado cerrado (fail-closed).
