# Arquitectura del frontend (para desarrolladores)

Este es material para desarrolladores, no una guía para el usuario final. Explica cómo está construido el cliente de Marinara Engine. Cubre la estructura de la app en React, los stores de Zustand, los hooks de React Query, los componentes principales y el mapa de la API del servidor. Si solo quieres usar la app, empieza mejor por las guías de usuario.

## Panorama general

Marinara Engine es una aplicación de chat con IA que tiene los modos Conversation, Roleplay y Game. El cliente es una app de una sola página (single-page app) hecha con React 19, servida por Vite, con estilos en Tailwind CSS v4, y empaquetada como Progressive Web App (PWA, una app web que se puede instalar como si fuera nativa).

El cliente vive en `packages/client`. Se comunica con un servidor de API en Fastify (`packages/server`) mediante REST y Server-Sent Events (SSE). Los contratos de datos compartidos (tipos, esquemas de Zod, constantes) viven en `packages/shared` y los importan ambos lados.

## Arquitectura de la aplicación

### Diseño de tres columnas

La interfaz usa un diseño de tres columnas inspirado en Discord, gestionado por `components/layout/AppShell.tsx`:

```
+-------------+-----------------------------+--------------+
|  Left       |         Center              |  Right       |
|  Sidebar    |                             |  Panel       |
|             |  Chat area or Editor        |              |
|  Chat list  |  (lazy-loaded)              |  Characters  |
|  Folders    |                             |  Lorebooks   |
|  Mode tabs  |  ChatConversationSurface    |  Presets     |
|             |  ChatRoleplaySurface        |  Connections |
|             |  GameSurface                |  Agents      |
|             |  CharacterEditor            |  Personas    |
|             |  LorebookEditor             |  Settings    |
|             |  PresetEditor               |  Browser     |
|             |  ...other editors           |              |
+-------------+-----------------------------+--------------+
```

- Barra lateral izquierda (`components/layout/ChatSidebar.tsx`): la lista de chats, organizada por carpetas y filtrable por modo (Conversation, Roleplay, Game).
- Panel central: o la superficie del chat activo, o un editor de página completa (personaje, lorebook, preset, etc.). Solo se muestra uno a la vez. Los editores reemplazan el área de chat.
- Panel derecho (`components/layout/RightPanel.tsx`): un explorador de recursos y ajustes, que se abre y cierra desde la barra superior. Una vez que un panel se monta, se queda en el DOM (oculto con CSS) para conservar su posición de desplazamiento y su estado local.
- Barra superior (`components/layout/TopBar.tsx`): botones de cambio rápido para cada panel derecho.

### Navegación

La navegación está dirigida por el estado. No hay un router de URL. El store de Zustand `stores/ui.store.ts` controla qué se renderiza:

| Destino de navegación   | Campo del store      | Función que lo activa                             |
| ---------------------- | -------------------- | ------------------------------------------------- |
| Abrir editor de personaje  | `characterDetailId`  | `openCharacterDetail(id)`                          |
| Abrir editor de lorebook   | `lorebookDetailId`   | `openLorebookDetail(id)`                           |
| Abrir editor de preset     | `presetDetailId`     | `openPresetDetail(id)`                             |
| Abrir editor de conexión | `connectionDetailId` | `openConnectionDetail(id)`                         |
| Abrir editor de agente      | `agentDetailId`      | `openAgentDetail(id)`                              |
| Abrir editor de persona    | `personaDetailId`    | `openPersonaDetail(id)`                            |
| Cambiar de panel derecho     | `rightPanel`         | `openRightPanel(name)` / `toggleRightPanel(name)` |
| Abrir ventana modal           | `modal`              | `openModal(type, props?)`                          |

### División del código

Los editores principales y los componentes pesados se cargan de forma diferida (lazy-loaded) en `AppShell.tsx` con `React.lazy()` más `Suspense`. Así el paquete inicial se mantiene pequeño (mira el presupuesto de paquete más abajo).

## Gestión del estado

### Stores de Zustand (estado del cliente)

El cliente usa un conjunto de stores de Zustand en `packages/client/src/stores/` para el estado de la interfaz y el estado en tiempo de ejecución. `ui.store.ts` es el único store persistido. Los demás guardan el estado en tiempo de ejecución de los chats, los agentes, los juegos, el runtime del modelo local, la traducción, los diálogos, el backfill y los juegos de mesa.

Los archivos de store actuales son: `agent.store.ts`, `backfill.store.ts`, `chat.store.ts`, `chess-game.store.ts`, `dialog.store.ts`, `encounter.store.ts`, `gallery.store.ts`, `game-asset.store.ts`, `game-mode.store.ts`, `game-state.store.ts`, `poker-game.store.ts`, `sidecar.store.ts`, `translation.store.ts`, `ui.store.ts` y `uno-game.store.ts`.

#### `ui.store.ts`: ajustes y elementos de interfaz

El único store persistido (en localStorage mediante el middleware `persist` de Zustand). Contiene:

- Tema: `visualTheme` ("default" o "sillytavern"), el valor de `data-theme` (dark o light), y los colores personalizados que lo sobreescriben.
- Apariencia: `fontSize`, `chatFontSize`, `fontFamily`, fuentes personalizadas y estilo del cursor.
- Visualización del chat: `boldDialogue`, `showTimestamps`, `showModelName` y `messagesPerPage`.
- Estilo del texto: color del texto del chat, opacidad del fondo del mensaje en Roleplay y contorno del texto.
- Streaming: `enableStreaming` y `streamingSpeed`.
- Tema de Conversation: colores del degradado para las burbujas de mensaje.
- Sonido: `convoNotificationSound` y `rpNotificationSound`.
- Comportamiento: `confirmBeforeDelete`, `enterToSendRP`, `enterToSendConvo`, `weatherEffects` y `guideGenerations`.
- Navegación: `rightPanel`, `rightPanelOpen`, `sidebarOpen`, `settingsTab`, todos los campos `*DetailId` y `modal`.

Los temas personalizados sincronizados no se guardan en `ui.store.ts`. Se obtienen del servidor mediante React Query y se reflejan en todos los dispositivos conectados a la misma instancia de Marinara.

#### `chat.store.ts`: runtime del chat

No persistido. Sigue la sesión de chat activa:

- `activeChatId`: qué chat se muestra.
- `messages`: el arreglo de mensajes actual.
- `isStreaming`, `streamBuffer`: generación en curso.
- `inputDrafts`: mensajes en borrador por chat.
- `currentInput`: el valor actual del campo de entrada del chat.
- `perChatTyping`: estado del indicador de escritura.
- `unreadCounts`, `chatNotifications`: insignias de notificación.
- `abortControllers`: cancelan las generaciones en curso.

#### `agent.store.ts`: ejecución de agentes

Sigue el estado de la canalización de agentes durante y después de la generación:

- `activeAgents`: los agentes que se están ejecutando.
- `thoughtBubbles`: el razonamiento del agente mostrado en tiempo real.
- `echoMessages`: la cámara de eco (chat simulado de espectadores).
- `cyoaChoices`: la interfaz de elección ramificada.
- `debugLog`: métricas de rendimiento y uso de tokens.
- `failedAgentTypes`: agentes que dieron error (para la interfaz de reintento).

#### `game-state.store.ts`: acompañante de RPG

Guarda el contexto de escena y del mundo para el modo Roleplay:

- `current` (GameState): fecha, hora, ubicación, clima, personajes presentes, eventos, estadísticas del jugador, misiones e inventario.
- `isVisible`, `expandedSections`: estado de visualización del HUD (barra de estado en pantalla).

#### `encounter.store.ts`: sistema de combate

Estado de combate por turnos:

- `active`: si hay un encuentro en curso.
- `party`, `enemies`: los combatientes con HP, ataques y estados.
- `environment`: detalles del escenario de combate.
- `playerActions`, `encounterLog`: la cola de acciones y el historial.
- `combatResult`: victoria, derrota, huida o interrumpido.

#### `gallery.store.ts`: superposiciones de imágenes

- `pinnedImages`: imágenes fijadas al área de chat como superposiciones.

### React Query (datos del servidor)

Todos los datos del servidor se obtienen y se almacenan en caché mediante TanStack React Query, configurado en `main.tsx`:

- Tiempo de obsolescencia: 30 segundos (predeterminado global).
- Reintento: 1 intento.
- Volver a obtener al enfocar: desactivado.
- Caché: solo en memoria (sin persistencia).

Cada entidad tiene un archivo de hook dedicado que exporta hooks de consulta y de mutación.

## Referencia de hooks

Todos los hooks viven en `src/hooks/` y siguen el patrón `use-{entity}.ts`.

### Hooks de chat (`use-chats.ts`)

| Hook                               | Tipo           | Descripción                                  |
| ---------------------------------- | -------------- | -------------------------------------------- |
| `useChats()`                       | Query          | Todos los chats                              |
| `useChat(id)`                      | Query          | Un solo chat por ID                          |
| `useChatMessages(chatId, perPage)` | Infinite Query | Mensajes paginados de un chat                |
| `useChatGroup(groupId)`            | Query          | Grupo de chats                               |
| `useCreateChat()`                  | Mutation       | Crear un chat nuevo                          |
| `useDeleteChat()`                  | Mutation       | Eliminar un chat                             |
| `useUpdateChatMetadata()`          | Mutation       | Actualizar metadatos del chat (agentes, sprites y más) |
| `useBranchChat()`                  | Mutation       | Ramificar un chat desde un mensaje concreto  |
| `useUpdateMessage()`               | Mutation       | Editar el contenido de un mensaje (actualización optimista) |
| `useDeleteMessage()`               | Mutation       | Eliminar un solo mensaje                     |
| `useDeleteMessages()`              | Mutation       | Eliminar varios mensajes                     |
| `useSetActiveSwipe()`              | Mutation       | Cambiar a otro swipe (respuesta alternativa) de la generación |
| `usePeekPrompt()`                  | Mutation       | Ver una vista previa del prompt ensamblado (las instrucciones enviadas a la IA) |
| `useClearAllData()`                | Mutation       | Eliminar todo (destructivo)                  |

### Hooks de personaje (`use-characters.ts`)

| Hook                   | Tipo     | Descripción                            |
| ---------------------- | -------- | -------------------------------------- |
| `useCharacters()`      | Query    | Todos los personajes                   |
| `useCharacter(id)`     | Query    | Un solo personaje con los datos de la tarjeta ya parseados |
| `useCreateCharacter()` | Mutation | Crear personaje                        |
| `useUpdateCharacter()` | Mutation | Actualizar los datos de la tarjeta de personaje |
| `useDeleteCharacter()` | Mutation | Eliminar personaje                     |
| `useUploadAvatar()`    | Mutation | Subir imagen de avatar                 |
| `usePersonas()`        | Query    | Todas las personas                     |
| `usePersona(id)`       | Query    | Una sola persona                       |
| `useCreatePersona()`   | Mutation | Crear persona                          |
| `useUpdatePersona()`   | Mutation | Actualizar persona                     |
| `useDeletePersona()`   | Mutation | Eliminar persona                       |
| `useCharacterGroups()` | Query    | Grupos de personajes                   |
| `usePersonaGroups()`   | Query    | Grupos de personas                     |

### Hooks de preset (`use-presets.ts`)

| Hook                           | Tipo     | Descripción                                                 |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `usePresets()`                 | Query    | Todos los presets (ajustes guardados)                      |
| `usePreset(id)`                | Query    | Un solo preset                                             |
| `usePresetFull(id)`            | Query    | Preset con secciones, grupos y opciones                    |
| `useDefaultPreset()`           | Query    | El preset predeterminado                                   |
| `useCreatePreset()`            | Mutation | Crear preset                                               |
| `useUpdatePreset()`            | Mutation | Actualizar preset                                          |
| `useDeletePreset()`            | Mutation | Eliminar preset                                            |
| `usePresetSections(presetId)`  | Query    | Secciones de prompt de un preset                           |
| `usePresetGroups(presetId)`    | Query    | Grupos de secciones                                        |
| `usePresetVariables(presetId)` | Query    | Variables del preset (antes bloques de elección)           |
| `usePreviewPreset()`           | Mutation | Vista previa del prompt renderizado para `{ presetId, chatId, choices }` |

### Hooks de agente (`use-agents.ts`)

| Hook                 | Tipo     | Descripción                     |
| -------------------- | -------- | ------------------------------- |
| `useAgentConfigs()`  | Query    | Todas las configuraciones de agentes |
| `useAgentConfig(id)` | Query    | Configuración de un solo agente |
| `useCreateAgent()`   | Mutation | Crear agente personalizado      |
| `useUpdateAgent()`   | Mutation | Actualizar configuración del agente |
| `useDeleteAgent()`   | Mutation | Eliminar agente                 |
| `useToggleAgent()`   | Mutation | Activar o desactivar un agente integrado |

### Hook de generación (`use-generate.ts`)

El hook más complejo. Devuelve `{ generate, retryAgents }`.

`generate(params)` toma un solo objeto de opciones con campos como `chatId`, `connectionId`, `userMessage`, `regenerateMessageId`, `continueMessageId`, `impersonate` y `attachments`. Devuelve `false` si ya hay una generación en curso para ese chat. El flujo es:

1. Establecer el estado de streaming en `chat.store.ts`.
2. Enviar la solicitud de generación a `/api/generate`.
3. Parsear los eventos SSE como `token`, `agent_start`, `agent_result`, `agent_error`, `thinking`, `tool_call`, `game_state`, `game_state_patch`, `text_rewrite`, `scene_created`, `done` y `error`.
4. Actualizar la caché de React Query con los mensajes nuevos.
5. Poblar el store de agentes con globos de pensamiento e información de depuración.
6. Manejar los errores con notificaciones tipo toast.

### Otros hooks

La carpeta `src/hooks/` también contiene muchos hooks específicos de cada función. Una muestra representativa:

| Archivo                        | Propósito                                 |
| ------------------------------ | ----------------------------------------- |
| `use-connections.ts`           | CRUD de conexiones de API más prueba      |
| `use-lorebooks.ts`             | CRUD de lorebook y entradas               |
| `use-scene.ts`                 | Planificación, creación y conclusión de escenas |
| `use-encounter.ts`             | Inicio, acción y resumen de encuentros de combate |
| `use-autonomous-messaging.ts`  | Sondeo y programación de mensajes autónomos |
| `use-idle-detection.ts`        | Detector de inactividad de 10 minutos     |
| `use-background-autonomous.ts` | Sondeo en segundo plano para chats inactivos |
| `use-translate.ts`             | Traducción de texto                       |
| `use-apply-regex.ts`           | Ejecución de scripts de regex en los mensajes |
| `use-custom-tools.ts`          | CRUD de herramientas personalizadas       |
| `use-knowledge-sources.ts`     | Gestión de fuentes de conocimiento        |
| `use-gallery.ts`               | Imágenes de la galería del chat           |
| `use-chat-folders.ts`          | CRUD de carpetas de chat más reordenamiento |
| `use-regex-scripts.ts`         | CRUD de scripts de regex                  |
| `use-haptic.ts`                | Conexión y comandos de dispositivos hápticos |

## Guía de componentes

### Sistema de chat (`components/chat/`)

El sistema de chat es el área de funciones más grande. `ChatArea.tsx` carga de forma diferida tres superficies de renderizado: Conversation, Roleplay y Game Mode.

#### Modo Conversation (`ChatConversationSurface.tsx`)

Burbujas de chat tipo mensajería. Los mensajes del usuario a la derecha, los del asistente a la izquierda. Funciones:

- Paginación por desplazamiento infinito (carga mensajes más antiguos cuando desplazas hacia arriba).
- Acciones por mensaje: editar, copiar, regenerar, eliminar, ramificar, ver el prompt.
- Compatibilidad con adjuntos (imágenes y archivos).
- Selectores de emoji y GIF.
- Comandos slash.
- Sonidos de notificación con mensajes nuevos.
- Persistencia de borradores por chat.

#### Modo Roleplay (`ChatRoleplaySurface.tsx`)

Una interfaz oscura e inmersiva con temática de RPG. Tiene todas las funciones de Conversation más:

- Sprites (imágenes del personaje) de los personajes, con cambios de expresión dirigidos por el agente de expresión.
- El HUD de Roleplay que muestra el estado del juego (hora, ubicación, clima, personajes presentes).
- Efectos de clima (superposiciones de partículas que coinciden con el clima de la escena).
- El panel de la cámara de eco (reacciones simuladas de espectadores).
- Encuentros de combate con un sistema de acciones por turnos.
- Un panel de World Info que muestra las entradas de lorebook activas.
- Un sistema de escenas para mini-roleplays ramificados.
- Imágenes de fondo con transiciones por fundido cruzado.

#### Game Mode (`GameSurface.tsx`)

La superficie del Game Master (director del juego) con IA. Vive fuera de la carpeta del chat, en `components/game/GameSurface.tsx`. `ChatArea.tsx` la renderiza cuando el modo del chat es `game`. Lee los stores de juego dedicados (`game-mode.store.ts`, `game-asset.store.ts`, `game-state.store.ts`). Dirige las sesiones, las tiradas de dados, las pruebas de habilidad, los mapas y los storyboards de turno (secuencias de viñetas) mediante los hooks de `use-game.ts` y `use-game-storyboards.ts`.

#### Componentes clave

- `ChatArea.tsx`: el orquestador central. Obtiene todos los datos (mensajes, personajes, personas), construye el mapa de personajes, determina el modo del chat y renderiza la superficie correcta.
- `ChatMessage.tsx`: renderiza un solo mensaje con Markdown, navegación de swipes, edición y menús de acción. Usa un subcomponente `EditTextarea` no controlado para evitar re-renderizados durante la edición.
- `ChatInput.tsx`: la entrada del usuario con autoajuste de tamaño, persistencia de borradores, autocompletado de comandos slash, manejo de adjuntos e inserción de emoji o GIF.

### Componentes de editor

Cada tipo de recurso tiene un editor de página completa que reemplaza el área de chat:

| Editor            | Archivo                                       | Gestiona                                                                        |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Character Editor  | `components/characters/CharacterEditor.tsx`   | Campos de la tarjeta de personaje, avatar, saludo inicial, personalidad, prompt de sistema, metadatos |
| Lorebook Editor   | `components/lorebooks/LorebookEditor.tsx`     | Metadatos del lorebook y entradas con claves, reglas de activación, ajustes de inyección |
| Preset Editor     | `components/presets/PresetEditor.tsx`         | Secciones de prompt, grupos, marcadores, parámetros de generación, bloques de elección |
| Connection Editor | `components/connections/ConnectionEditor.tsx` | Proveedor de API, URL base, modelo, ventana de contexto, indicadores            |
| Agent Editor      | `components/agents/AgentEditor.tsx`           | Plantilla de prompt del agente, fase, conexión, herramientas, ajustes           |
| Persona Editor    | `components/personas/PersonaEditor.tsx`       | La persona del usuario con nombre, descripción, estadísticas, avatar            |

### Sistema de ventanas modales (`components/modals/`)

Las ventanas modales las renderiza `components/layout/ModalRenderer.tsx`. Lee `ui.store.modal` y renderiza el componente que coincide dentro de `Suspense`. Los componentes de ventana modal viven bajo `components/modals/`.

Los tipos de ventana modal actuales incluyen (esta lista es ilustrativa, no exhaustiva):

| Tipo                       | Componente                    | Propósito                                  |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `create-character`         | `CreateCharacterModal`        | Creación rápida de personaje (nombre y avatar) |
| `create-connection`        | `CreateConnectionModal`       | Creación rápida de conexión                |
| `create-persona`           | `CreatePersonaModal`          | Creación rápida de persona                 |
| `create-lorebook`          | `CreateLorebookModal`         | Creación rápida de lorebook                |
| `create-preset`            | `CreatePresetModal`           | Creación rápida de preset                  |
| `import-character`         | `ImportCharacterModal`        | Importar desde archivo (JSON o PNG)        |
| `import-connection`        | `ImportConnectionModal`       | Importar un paquete de conexión            |
| `import-lorebook`          | `ImportLorebookModal`         | Importar desde archivo                     |
| `import-preset`            | `ImportPresetModal`           | Importar desde archivo                     |
| `import-persona`           | `ImportPersonaModal`          | Importar desde archivo                     |
| `character-card-update`    | `CharacterCardUpdateModal`    | Revisión de la evolución de tarjeta propuesta por un agente |
| `agent-write-approval`     | `AgentWriteApprovalModal`     | Consentimiento y revisión de escritura del agente |
| `docs-viewer`              | `DocsViewerModal`             | Explorador de documentación dentro de la app |
| `st-bulk-import`           | `STBulkImportModal`           | Importación masiva desde datos de SillyTavern |
| `about-me-viewer`          | `AboutMeViewerModal`          | Ver un About Me del modo Conversation      |
| `scene-prompt-preferences` | `ScenePromptPreferencesModal` | Ajustes de preferencia del prompt de escena |

Patrón de las ventanas modales: todas aceptan `{ open, onClose }`, envuelven el contenido en el componente base `Modal`, usan mutaciones para las llamadas a la API y muestran el estado de carga desde `mutation.isPending`.

### Sistema de paneles (`components/panels/`)

Los paneles del lado derecho muestran listas de recursos con búsqueda, orden y filtrado. Al hacer clic en un recurso se abre su editor de página completa en el panel central.

Los paneles se registran en `RightPanel.tsx` en dos lugares:

1. `PANEL_CONFIG`: título, icono y color del degradado.
2. `PANELS`: el mapa de componentes.

Los paneles usan persistencia a nivel de módulo. Un Set `mountedPanels` sigue qué paneles se han visitado. Una vez montado, un panel se queda en el DOM (oculto con `display: none` o `aria-hidden`) para conservar su estado.

### Primitivas de interfaz (`components/ui/`)

| Componente         | Descripción                                                            |
| ------------------ | --------------------------------------------------------------------- |
| `Modal`            | Ventana modal base con clic en el fondo, tecla escape, animaciones de entrada y salida |
| `ColorPicker`      | Selector de color sólido o degradado con muestras predeterminadas     |
| `ExpandedTextarea` | Superposición de portal a pantalla completa para editar bloques de texto grandes |
| `EmojiPicker`      | Panel emergente de emoji con búsqueda (renderizado como portal)       |
| `GifPicker`        | Búsqueda de GIF mediante la API de Giphy                              |
| `HelpTooltip`      | Icono que al pasar el cursor muestra un tooltip (texto de ayuda) posicionado como portal |

Todos los componentes de interfaz usan props controladas (value más onChange) y renderizado como portal para las superposiciones.

## Cliente de API (`lib/api-client.ts`)

Toda la comunicación con el servidor usa el objeto `api`:

```typescript
import { api, ApiError } from "@/lib/api-client";
```

| Método                         | Firma               | Descripción                           |
| ------------------------------ | ------------------- | ------------------------------------- |
| `api.get<T>(path)`             | `GET /api{path}`    | Obtener JSON                          |
| `api.post<T>(path, body)`      | `POST /api{path}`   | Enviar JSON, recibir JSON             |
| `api.put<T>(path, body)`       | `PUT /api{path}`    | Actualización completa                |
| `api.patch<T>(path, body)`     | `PATCH /api{path}`  | Actualización parcial                 |
| `api.delete(path)`             | `DELETE /api{path}` | Eliminar recurso                      |
| `api.upload(path, FormData)`   | `POST /api{path}`   | Subida de archivo multiparte          |
| `api.download(path, filename)` | `GET /api{path}`    | Descarga más ventana de guardar como  |
| `api.stream(path, body)`       | `POST /api{path}`   | Generador asíncrono SSE (solo tokens) |
| `api.streamEvents(path, body)` | `POST /api{path}`   | Generador asíncrono SSE (todos los tipos de evento) |

Los errores lanzan `ApiError`, que lleva las propiedades `status` y `message`.

## Sistema de estilos

### Tailwind CSS v4

El proyecto usa Tailwind CSS v4 con el plugin `@tailwindcss/vite` (sin necesidad de configurar PostCSS). Los tokens del tema se mapean desde propiedades personalizadas de CSS en `globals.css`:

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-border: var(--border);
  /* ... */
}
```

### Arquitectura de temas

`globals.css` está organizado en secciones etiquetadas. Estas incluyen el mapeo `@theme` de Tailwind, las variables del tema oscuro, los ajustes que sobreescriben el tema claro, el reset base, los cursores personalizados, las barras de desplazamiento, los paneles de cristal, las utilidades de brillo, los componentes de interfaz y las animaciones de fotograma clave. Otras secciones cubren las animaciones del chat, el estilo del chat por modo, los sprites y el HUD del juego, las tarjetas de llamada a función, las reglas adaptativas, el tema importado de SillyTavern, las reglas de accesibilidad y las sugerencias de rendimiento.

### Temas personalizados

Los usuarios pueden crear temas personalizados. Las definiciones de tema se guardan en el servidor de Marinara y se sincronizan entre los dispositivos conectados. El tema personalizado activo también se comparte. El CSS se inyecta como una etiqueta `style` mediante `CustomThemeInjector.tsx`.

El CSS del tema sincronizado puede solicitar el motor integrado Accent Pulse con `--marinara-theme-accent-pulse: enabled`. Añade `--marinara-theme-accent-pulse-source: #a78bfa` (o un degradado) cuando el pulso deba usar un acento de tema específico en lugar del acento de Appearance actual.

### Personal Extensions

Las Personal Extensions son código en zona protegida (sandbox), guardado en el servidor y aprobado por hash exacto. La interfaz de Addons usa `use-personal-extensions.ts`; `PersonalExtensionInjector.tsx` aloja el código de navegador aprobado en un Worker dedicado, dentro de un iframe de zona protegida de origen opaco. Las extensiones de servidor se ejecutan en un proceso de Node aparte, dentro de macOS Seatbelt o Linux Bubblewrap, y fallan de forma cerrada cuando no hay ninguno de esos backends disponible. Las fuentes externas requieren la puerta de `.env` más la aceptación del Danger Zone en los límites de listado, aprobación y ejecución.

Consulta [Arquitectura de las Personal Extensions](personal-extensions.md) antes de cambiar esta función.

## Paquete compartido (`packages/shared`)

El frontend importa tipos, esquemas y constantes desde `@marinara-engine/shared`.

### Constantes

Archivos clave en `packages/shared/src/constants/`:

- `defaults.ts`: exportaciones como `APP_VERSION`, `PROFESSOR_MARI_ID`, `DEFAULT_CONNECTION_ID`, `DEFAULT_GENERATION_PARAMS`, `MAX_FILE_SIZES` y `LIMITS`. Esta es la fuente de la versión y contiene los ajustes de generación predeterminados.
- `providers.ts`: exporta `PROVIDERS`, las configuraciones de proveedores de API (OpenAI, Anthropic, Google y más) con URLs y autenticación.
- `model-lists.ts`: catálogos estáticos de modelos por proveedor, más `IMAGE_GENERATION_SOURCES` para los proveedores de generación de imágenes.
- `agent-prompts.ts`: prompts de resumen y de trama secreta solo de base, más la búsqueda en tiempo de ejecución de los prompts que aportan los paquetes de agentes instalados.

### Esquemas (Zod)

Toda la validación de entrada usa esquemas de Zod desde `packages/shared/src/schemas/`. Archivos representativos:

| Archivo de esquema      | Entidades                                                          |
| ----------------------- | ------------------------------------------------------------------ |
| `agent.schema.ts`       | Creación y actualización de AgentConfig, fases de agente, tipos de resultado |
| `character.schema.ts`   | Tarjetas de personaje, metadatos de compatibilidad, libros de personaje, grupos |
| `chat.schema.ts`        | Creación de chat, creación de mensaje, solicitud de generación     |
| `connection.schema.ts`  | Creación y actualización de conexiones de API                      |
| `custom-tool.schema.ts` | Definiciones de herramientas personalizadas                        |
| `lorebook.schema.ts`    | Creación/actualización de lorebook y entradas, condiciones de activación, horarios |
| `prompt.schema.ts`      | Preset, sección, grupo, bloque de elección, parámetros de generación |
| `regex.schema.ts`       | Creación y actualización de scripts de regex                       |
| `personal-extension.schema.ts` | Borradores de Personal Extension, aprobación por hash exacto, reversión y almacenamiento privado |

La carpeta también contiene esquemas para los ajustes de la app, los perfiles de ajustes del chat, las llamadas de conversación, los emojis y stickers personalizados, Noodle y los temas.

### Tipos

Las definiciones de tipo de las entidades viven en `packages/shared/src/types/`. Una muestra de los archivos clave:

| Archivo de tipo       | Interfaces clave                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `agent.ts`            | `AgentConfig`, `AgentResult`, `AgentContext`, `ToolDefinition`, `ToolCall`, `ToolResult`, `BUILT_IN_AGENTS` |
| `character.ts`        | `Character`, `CharacterCardV2`, `CharacterData`, `RPGStatsConfig`                                           |
| `chat.ts`             | `Chat`, `ChatMetadata`, `Message`, `MessageExtra`, `GenerationInfo`, `StreamEvent`                          |
| `connection.ts`       | `APIConnection`, `ModelInfo`, `ModelCapabilities`, `ConnectionTestResult`                                   |
| `combat-encounter.ts` | `CombatPartyMember`, `CombatEnemy`, `CombatActionResult`, `EncounterSettings`                               |
| `game-state.ts`       | `GameState`, `PresentCharacter`, `PlayerStats`, `QuestProgress`, `InventoryItem`                            |
| `lorebook.ts`         | `Lorebook`, `LorebookEntry`, `ActivationCondition`, `LorebookSchedule`, `QuestData`                         |
| `persona.ts`          | `Persona`, `PersonaStatsConfig`                                                                             |
| `personal-extension.ts` | `PersonalExtension`, metadatos de runtime, revisiones, fuente y estado del runtime del servidor           |
| `prompt.ts`           | `PromptPreset`, `PromptSection`, `PromptGroup`, `ChoiceBlock`, `GenerationParameters`                       |
| `scene.ts`            | `SceneMeta`, `SceneFullPlan`                                                                                |
| `haptic.ts`           | `HapticDevice`, `HapticStatus`, `HapticDeviceCommand`                                                       |

### Utilidades

| Archivo           | Propósito                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `macro-engine.ts` | `resolveMacros(template, context)`: reemplaza macros como `{{date}}`, `{{char}}`, `{{random}}`, `{{roll:2d6}}` y `{{getvar::name}}`         |
| `xml-wrapper.ts`  | `nameToXmlTag()`: convierte un nombre visible en un slug de etiqueta XML ("World Info (Before)" se convierte en "world_info_before")        |

## Endpoints de la API

El servidor (`packages/server`) expone APIs REST bajo `/api`. Este es un mapa de alto nivel, no la lista exhaustiva. El archivo `packages/server/src/routes/index.ts` y los archivos de ruta individuales son la fuente de verdad.

### Recursos principales

| Prefijo              | Métodos                  | Descripción                                                                               |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `/api/characters`    | GET, POST, PATCH, DELETE | CRUD de personajes, grupos, exportación (JSON o PNG)                                       |
| `/api/chats`         | GET, POST, PATCH, DELETE | CRUD de chats, mensajes, metadatos, conectar y desconectar                                |
| `/api/prompts`       | GET, POST, PATCH, DELETE | CRUD de presets, secciones, grupos, bloques de elección, exportación                      |
| `/api/connections`   | GET, POST, PATCH, DELETE | CRUD de conexiones de API, duplicar, probar                                               |
| `/api/agents`        | GET, POST, PATCH, DELETE | CRUD de agentes, mensajes de eco, ejecuciones; los interruptores de los integrados usan `PUT /api/agents/toggle/:agentType` |
| `/api/lorebooks`     | GET, POST, PATCH, DELETE | CRUD de lorebook, entradas, exportación                                                   |
| `/api/custom-tools`  | GET, POST, PATCH, DELETE | CRUD de herramientas personalizadas                                                       |
| `/api/regex-scripts` | GET, POST, PATCH, DELETE | CRUD de scripts de regex                                                                  |

Las herramientas de memoria de los agentes usan `/api/agents/memory/:agentType/:chatId`, donde `agentType` es la cadena de tipo del agente y `chatId` es el id del chat de destino.

### Generación

| Endpoint                     | Método | Descripción                                          |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `/api/generate`              | POST   | Generación SSE principal con la canalización de agentes |
| `/api/generate/retry-agents` | POST   | Reintento SSE para los tipos de agente que aporte quien llama |

### Funciones del chat

| Prefijo                   | Endpoints                        | Descripción                  |
| ------------------------- | -------------------------------- | ---------------------------- |
| `/api/chat-folders`       | CRUD más reordenar               | Gestión de carpetas de chat  |
| `/api/conversation`       | schedule, status, message, check | Sistema de mensajes autónomos |
| `/api/scene`              | create, plan, conclude           | Ramificación de escenas      |
| `/api/encounter`          | init, action, summary            | Encuentros de combate        |
| `/api/translate`          | POST                             | Traducción de texto          |
| `/api/game`               | CRUD y acciones                  | Sesiones y estado de Game Mode |
| `/api/game-assets`        | CRUD y subida                    | Recursos del juego           |
| `/api/turn-games`         | Rutas de Chess, UNO, Poker       | Juegos de mesa de Conversation |
| `/api/conversation-calls` | rutas de llamada y sesión        | Llamadas de audio de Conversation |

### Medios y recursos

| Prefijo                       | Descripción                  |
| ----------------------------- | ---------------------------- |
| `/api/avatars/file/:filename` | Servicio de imágenes de avatar |
| `/api/backgrounds`            | CRUD de fondos más subida    |
| `/api/sprites/:characterId`   | Gestión de expresiones de sprites |
| `/api/fonts`                  | Gestión de fuentes personalizadas |
| `/api/gallery/:chatId`        | Imágenes de galería por chat |
| `/api/global-gallery`         | Imágenes de la galería global |
| `/api/tts`                    | Rutas de Text-to-Speech (texto a voz) |
| `/api/youtube`                | Rutas del DJ de YouTube      |
| `/api/custom-emojis`          | Recursos de emoji personalizados |
| `/api/custom-stickers`        | Recursos de sticker personalizados |
| `/api/gifs/search`            | Búsqueda de GIF (proxy de Giphy) |

### Integraciones externas

| Prefijo                         | Descripción                  |
| ------------------------------- | ---------------------------- |
| `/api/bot-browser/chub/*`       | Búsqueda de personajes en Chub |
| `/api/bot-browser/chartavern/*` | Búsqueda en CharacterTavern  |
| `/api/bot-browser/janny/*`      | Búsqueda en JannyAI          |
| `/api/bot-browser/pygmalion/*`  | Búsqueda en Pygmalion        |
| `/api/bot-browser/wyvern/*`     | Búsqueda en Wyvern           |
| `/api/bot-browser/datacat/*`    | Búsqueda en DataCat          |
| `/api/haptic/*`                 | Control de dispositivos hápticos |
| `/api/spotify/*`                | Autenticación de Spotify     |
| `/api/knowledge-sources`        | Base de conocimiento para recuperación |

### Sistema

| Endpoint                        | Descripción                             |
| ------------------------------- | --------------------------------------- |
| `/api/updates/check`            | Comprobación de versión contra las releases de GitHub |
| `/api/updates/latest`           | Metadatos de la última release          |
| `/api/updates/commits-behind`   | Distancia de actualización de la instalación con Git |
| `/api/backup`                   | Copia de seguridad completa, exportar, importar |
| `/api/import/*`                 | Importación de perfiles de SillyTavern y Marinara |
| `/api/admin/clear-all`          | Borrado completo de datos               |
| `/api/themes`                   | Temas personalizados sincronizados      |
| `/api/personal-extensions`      | Política de extensiones en zona protegida, borradores, aprobación, runtime y almacenamiento privado |
| `/api/app-settings`             | Ajustes de la app del lado del servidor |
| `/api/sidecar`                  | Runtime del modelo local                |
| `/api/chat-presets`             | Perfiles de ajustes del chat (nombre heredado del endpoint) |
| `/api/connection-folders`       | Carpetas de conexiones                  |
| `/api/prompt-overrides`         | Anulaciones de prompts integrados       |
| `/api/achievements`             | Desbloqueo de logros                    |
| `/api/noodle`                   | Línea de tiempo social de Noodle        |
| `/api/professor-mari/workspace` | Operaciones del espacio de trabajo de Professor Mari |

## Compatibilidad con PWA

La app es una Progressive Web App configurada con VitePWA:

- Manifest: `public/manifest.json` con el nombre de app "Marinara Engine", modo de visualización standalone y tema oscuro.
- Iconos: un favicon de 64px, iconos maskable de 192px y 512px, y un logo de pantalla de carga.
- Service worker: Workbox con una estrategia de actualización automática.
- Caché: los recursos estáticos se guardan en caché; las rutas `/api/*` usan NetworkOnly.
- Keep-alive: `lib/keep-alive.ts` usa la Web Locks API más pings de BroadcastChannel para evitar que la pestaña se duerma.

### Detección de desfase de versión

`App.tsx` sondea `/api/health` cada 5 minutos. Si la versión del servidor difiere de la versión que el cliente tiene en caché, el cliente cancela el registro del service worker. También borra las cachés para forzar una actualización.

## Sistema de agentes

El sistema de agentes procesa las respuestas de la IA a través de canalizaciones configurables. Los agentes se ejecutan en tres fases:

1. Pregeneración: antes de la llamada principal al LLM (por ejemplo, inyección de contexto o recuperación de conocimiento).
2. Paralela: junto a la generación principal (por ejemplo, seguimiento del estado del mundo o combate).
3. Posprocesamiento: después de la respuesta principal (por ejemplo, reescritura de la prosa o actualizaciones del lorebook).

Las solicitudes de reintento pasan por `/api/generate/retry-agents` con una lista `agentTypes` explícita. Una acción de interfaz amplia como **Re-run Trackers** (Volver a ejecutar trackers) pasa todos los tipos de tracker activos. Un control de widget individual pasa solo su tracker (agente de seguimiento) de destino.

Las herramientas de memoria de los agentes, como el panel Narrative Director Secret Plot, usan `/api/agents/memory/:agentType/:chatId`. La ruta aplica a los agentes configurados que guardan memoria por chat. La memoria de Secret Plot se guarda bajo `director` en las configuraciones actuales, mientras que `secret-plot-driver` se sigue aceptando en chats heredados.

### Agentes descargables de primera parte

El Engine ligero se envía con un registro de agentes en tiempo de ejecución vacío. Los paquetes instalados desde el catálogo público [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) aportan manifiestos de agente validados, puntos de entrada de funciones de cliente/servidor y ranuras de interfaz en tiempo de ejecución. Las definiciones activas se exponen mediante `BUILT_IN_AGENTS` por compatibilidad, pero provienen de los paquetes instalados en lugar de implementaciones empaquetadas. El catálogo oficial contiene estos paquetes:

| Agente                   | Fase            | Qué hace                                                          |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `prose-guardian`         | post_processing | Impone la calidad de la escritura (antirrepetición, mostrar en vez de contar) |
| `continuity`             | post_processing | Detecta problemas de continuidad y puede producir orientación para reescribir |
| `director`               | pre_generation  | Inyecta direcciones narrativas y el estado opcional de Secret Plot |
| `echo-chamber`           | parallel        | Simula reacciones de la audiencia                                 |
| `world-state`            | post_processing | Extrae fecha, hora, ubicación y clima de la narrativa             |
| `expression`             | post_processing | Selecciona las expresiones del sprite del personaje               |
| `quest`                  | post_processing | Sigue la creación, actualización y finalización de misiones       |
| `background`             | post_processing | Selecciona las imágenes de fondo adecuadas                        |
| `character-tracker`      | post_processing | Sigue los cambios de estado de los personajes                     |
| `persona-stats`          | post_processing | Sigue los cambios de estadísticas de la persona del jugador       |
| `custom-tracker`         | post_processing | Sigue el estado estructurado definido por el usuario              |
| `illustrator`            | post_processing | Genera prompts de imagen de escena y solicitudes de medios        |
| `lorebook-keeper`        | post_processing | Crea y actualiza automáticamente entradas de lorebook             |
| `card-evolution-auditor` | post_processing | Audita las tarjetas de personaje en busca de evolución sugerida   |
| `combat`                 | parallel        | Sigue las rondas de combate, HP, iniciativa y resultados          |
| `html`                   | post_processing | Reescribe las respuestas de Roleplay terminadas para añadir elementos visuales HTML diegéticos |
| `spotify`                | post_processing | Controla la reproducción del Music DJ (Spotify, YouTube o música local) |
| `knowledge-retrieval`    | pre_generation  | Recupera contexto de las fuentes de conocimiento                  |
| `knowledge-router`       | pre_generation  | Enruta las entradas relevantes de lorebook y de conocimiento      |
| `haptic`                 | post_processing | Envía comandos a dispositivos hápticos                            |
| `cyoa`                   | post_processing | Genera prompts de elección                                        |
| `conversation-calls`     | feature         | Añade llamadas de audio/video de Conversation y ajustes relacionados |
| `hierarchical-maps`      | feature         | Añade mapas de Roleplay/Game, contexto espacial y movimiento      |
| `uno`                    | feature         | Añade la mesa de UNO de Conversation                              |
| `chess`                  | feature         | Añade el tablero de Chess de Conversation                         |
| `poker`                  | feature         | Añade la mesa de Texas Hold'em de Conversation                    |
| `eightball`              | feature         | Añade la mesa de 8-Ball Pool de Conversation                      |
| `tic-tac-toe`            | feature         | Añade el tablero de Tic-Tac-Toe de Conversation                   |
| `rock-paper-scissors`    | feature         | Añade las partidas de Rock-Paper-Scissors de Conversation         |

### Tipos de resultado de los agentes

Los agentes producen resultados tipados que el frontend maneja. La unión `AgentResultType` en `packages/shared/src/types/agent.ts` incluye:

`game_state_update`, `text_rewrite`, `sprite_change`, `echo_message`, `quest_update`, `image_prompt`, `context_injection`, `continuity_check`, `director_event`, `lorebook_update`, `character_card_update`, `background_change`, `character_tracker_update`, `persona_stats_update`, `custom_tracker_update`, `spotify_control`, `youtube_control`, `local_music_control`, `haptic_command`, `cyoa_choices`, `secret_plot`, `game_master_narration`, `party_action`, `game_map_update`, `game_state_transition`, `prompt_patch`, `frontend_theme_update` y `about_me_update`.

## Modos de chat

### Modo Conversation

Diálogo simple con uno o más personajes de IA. Los personajes pueden tener distintos estados (online, ausente, no molestar, offline) que influyen en el momento y el estilo de la respuesta. Los agentes integrados se añaden por chat en lugar de activarse de forma global.

### Modo Roleplay

Una experiencia narrativa inmersiva con seguimiento del estado del juego: contexto de escena (ubicación, hora, clima), presencia y ánimo de los personajes, estadísticas del jugador, inventario y misiones, encuentros de combate, World Info de los lorebooks y expresiones de sprites.

### Game Mode

Sesiones con un Game Master de IA con miembros del grupo, dados, estado del juego, recursos, storyboards, un diario y un ciclo de vida de sesión estructurado. Game Mode usa stores y rutas dedicados para el estado del juego, los recursos, los juegos de mesa, los videos de escena y los storyboards. Consulta [Game Mode: primeros pasos](../game/getting-started.md) para el flujo de trabajo de cara al usuario.

## Desarrollo

### Comandos

Instala las dependencias:

```bash
pnpm install
```

Inicia el servidor y el cliente con recarga en caliente:

```bash
pnpm dev
```

Ejecuta solo el servidor de desarrollo del cliente:

```bash
pnpm dev:client
```

Ejecuta solo el servidor de API:

```bash
pnpm dev:server
```

Ejecuta la validación de referencia (TypeScript más ESLint):

```bash
pnpm check
```

Compila para producción:

```bash
pnpm build
```

### Presupuesto de paquete

- Entrada principal: máximo 1 MB.
- Por chunk: máximo 500 KB.
- Divisiones de proveedores (vendor): react, tanstack, motion, zustand, icons y misc.

### Alias de ruta

`@/*` se resuelve a `./src/*` tanto en la configuración de TypeScript como en la de Vite.

## Guías relacionadas

- [Mapa de arquitectura (para desarrolladores)](architecture-map.md)
- [Almacenamiento nativo en archivos (para desarrolladores)](file-storage.md)
