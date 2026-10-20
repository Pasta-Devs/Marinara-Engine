# Mapa de arquitectura (para desarrolladores)

Esta guía es material para desarrolladores que contribuyen al proyecto. Describe la organización del código de Marinara Engine: las bases compartidas, los sistemas de funciones, la propiedad de cada modo y dónde debe vivir cada pieza de código. También lista los archivos grandes actuales y la dirección del trabajo de refactorización futuro.

Alcance: `packages/client/src`, `packages/server/src` y `packages/shared/src`. El repositorio no mantiene una suite convencional `.test.ts`. Los scripts de regresión que están bajo seguimiento y la cobertura de smoke de Playwright ofrecen la validación automatizada; los archivos temporales de prueba `.test.ts` están en gitignore y se eliminan después de usarlos.

El número de archivos, de líneas y de rutas cambia a medida que cambia el repositorio. Este mapa da formas y nombres aproximados. Consulta siempre el árbol actual para conocer los números exactos.

## Códigos de sección

Usa estos códigos al planear movimientos, etiquetar issues o añadir un encabezado corto de archivo a código que todavía no se puede mover.

| Código | Significado | Ubicación principal |
| --- | --- | --- |
| `CORE-CONTRACT` | Tipos, esquemas, constantes y ayudantes puros compartidos por cliente y servidor | `packages/shared/src` |
| `CLIENT-APP` | Arranque de la app React, capa de layout, cableado global de la UI | `packages/client/src/App.tsx`, `main.tsx`, `components/layout` |
| `CLIENT-SHARED` | Primitivos de UI solo del cliente, hooks comunes, ayudantes comunes del navegador, stores globales | `packages/client/src/components/ui`, `hooks`, `lib`, `stores` |
| `SERVER-APP` | Arranque de la app Fastify, middleware, registro de rutas, configuración de tiempo de ejecución | `packages/server/src/app.ts`, `index.ts`, `middleware`, `config` |
| `SERVER-SHARED` | Almacenamiento solo del servidor, DB, LLM, prompt, lorebook, importación y bases de integración | `packages/server/src/services`, `db`, `utils`, `lib` |
| `MODE-CONVERSATION` | UI y comportamiento del servidor solo de Conversation | componentes de Conversation, `/api/conversation`, servicios de Conversation |
| `MODE-ROLEPLAY` | UI de Roleplay, escenas, sprites, ayudantes de encuentros | componentes de chat de Roleplay, `/api/scene`, `/api/encounter`, `/api/sprites` |
| `MODE-GAME` | UI de Game Mode, prompts del GM, dados, grupo, mapa, combate, assets, sesiones | `components/game`, `/api/game`, servicios de game |
| `FEATURE-AGENTS` | Definiciones de agentes, ejecución, estado de depuración, enrutamiento de conocimiento | componentes de agentes, store de agentes, rutas/servicios de agentes |
| `FEATURE-ASSETS` | Fondos, avatares, galería, imágenes generadas, sprites, assets de juego | rutas de assets, almacenamiento de galería, servicios de imagen |
| `FEATURE-SIDECAR` | Tiempo de ejecución del modelo local, análisis de escena, descargas, control de procesos | store del sidecar, `/api/sidecar`, servicios del sidecar |
| `FEATURE-TTS` | Configuración de TTS, enrutamiento de voz, claves de caché, reproducción de audio | ajustes/hooks/rutas/servicios de TTS |
| `FEATURE-IMPORT` | Importadores de SillyTavern y Marinara y ayudantes de migración | rutas/servicios de importación |
| `TEST` | Regresión bajo seguimiento y cobertura de smoke en el navegador, más pruebas temporales de comprobación cuando hacen falta | `scripts/regressions`, `e2e` y archivos temporales `packages/server/src/**/__tests__/` que se eliminan después de usarlos |

Prefiere que la ruta comunique la sección. Un comentario como `// Section: MODE-GAME` solo es útil mientras un archivo aún esté en una carpeta mixta.

## Límites de los paquetes

### packages/shared

`CORE-CONTRACT`. Este paquete debe mantenerse agnóstico respecto al tiempo de ejecución.

Contenido actual:

- `types`: chat, personaje, juego, estado del juego, combate, escena, sidecar, TTS, agentes, prompts, lorebooks, exportaciones, temas.
- `schemas`: esquemas Zod para entidades persistidas y compartidas.
- `constants`: proveedores, valores predeterminados, modos de chat, listas de modelos, prompts de agentes.
- `utils`: ayudantes puros como la expansión de macros, el envoltura XML y la puntuación de música.
- `features`: manifiestos y registro de agentes, definiciones de llamadas a funciones, paquetes de carpetas, motores de juegos por turnos para UNO, Chess y Poker, conjuntos de reglas de Game Mode y su combate (`rulesets`, `ruleset-combat`, `tactical-combat` y los archivos `combat-*`), y el generador de mundos con sus archivos para compartir (kits de ambientación, mundos y paquetes de mosaicos, tableros y criaturas) en `world`.

Reglas:

- Nada de React, DOM, Fastify, almacenamiento del servidor, sistema de archivos, red ni código de SDK de proveedor.
- Mueve código aquí solo cuando cliente y servidor necesiten el mismo contrato o el mismo algoritmo puro.
- No conviertas `shared` en un cajón de sastre general para ayudantes solo del cliente.

### packages/client

React 19 y Vite PWA. Actualmente contiene varios cientos de archivos de código fuente.

Forma actual de nivel superior:

- `App.tsx`, `main.tsx`: arranque de la app, React Query, PWA, efectos globales.
- `components/layout`: capa de la app, barras laterales, barra superior, renderizador de ventanas.
- `components/ui`: primitivos de UI reutilizables.
- `components/chat`: UI mixta de chat común, Conversation, Roleplay, escena, sprite y encuentros.
- `components/game`: superficie y paneles de Game Mode.
- `components/panels`, `components/modals`, editores de entidades: gestión de configuración y de recursos.
- `features`: módulos de funciones extraídos, que actualmente incluyen secciones de chat-settings, piezas del panel de trackers, el multijugador, y el contrato, la configuración, el escenario y los renderizadores de los agentes de avatar (`features/avatars`).
- `hooks`: hooks de React Query y hooks de tiempo de ejecución para la mayoría de las funciones de la API.
- `lib`: ayudantes del navegador y del cliente. Actualmente mezcla ayudantes comunes con ayudantes de juego específicos del modo.
- `stores`: stores de Zustand para la UI, el tiempo de ejecución del chat, los agentes, el estado del juego, Game Mode, los assets, el sidecar, la traducción, la galería, los encuentros y los juegos por turnos.
- `styles`: hoja de estilos global y CSS específico de cada tema.

Cruces actuales importantes:

- `components/game` importa `components/chat` para piezas visuales compartidas, como los paneles laterales del clima y de la galería.
- `components/chat` importa el estado del juego y el estado de los encuentros para funciones de Roleplay.
- `hooks/use-generate.ts` toca el estado del chat, el estado de los agentes, el estado del juego, el estado de Game Mode, el estado de la traducción y la configuración de la UI.
- Los ayudantes `lib/game-*` son solo de juego, pero viven junto a ayudantes globales.

### packages/server

API de Fastify, almacenamiento nativo de archivos e integraciones de proveedores. Actualmente contiene varios cientos de archivos de código fuente.

Forma actual de nivel superior:

- `app.ts`, `index.ts`: fábrica de la app, arranque, servicio de estáticos, hidratación del almacenamiento de archivos y seeders.
- `routes`: muchos archivos de rutas. La mayoría son APIs CRUD ligeras, pero `generate.routes.ts` y `game.routes.ts` son archivos grandes de orquestación. Una carpeta `routes/generate/` contiene las piezas extraídas hasta ahora de la ruta de generación, incluidas la cadena de salida de tokens (`generation-stream-output.ts`), las rondas de llamadas a herramientas (`tool-rounds.ts`), el análisis de comandos de la respuesta y la limpieza de su texto, y el guardado de la respuesta (`save-generated-reply.ts`).
- `services/storage`: capa de fachada de almacenamiento para chats, personajes, prompts, lorebooks, configuración, assets, temas y estado del juego.
- `services/llm`: registro de proveedores, contrato base de proveedor, proveedores compatibles con OpenAI, puente del sidecar local.
- `services/prompt`: ensamblaje de prompt compartido para la generación fuera del juego.
- `services/conversation`: horarios, mensajes autónomos, conciencia, perfiles de conversación, manejo de comandos de conversación.
- `services/game`: prompts del GM, dados, combate, máquina de estados, prompts de grupo, mapas, clima, tiempo, sesiones, puntos de control, reputación, assets.
- `services/sidecar`: tiempo de ejecución local, gestión de modelos, análisis de escena, posprocesamiento de escena.
- `services/agents`: ejecución de agentes y enrutamiento de conocimiento.
- Bases de funciones: `services/import`, `services/lorebook`, `services/image`, `services/haptic`, `services/tools`, `services/regex`, `services/professor-mari`, `services/mari-db`, `services/turn-games`, `services/spotify`, `services/video`, `services/generation`, `services/chat-summary`, `services/achievements`, `services/prompt-overrides`, `services/setup`, `services/noodle`, `services/memory-recall`, `services/avatars` (almacenamiento de modelos de avatar, generación y el clasificador de emociones para los agentes de avatar), `speech-to-text.service.ts` y `discord-webhook.ts`.
- `db/schema`: definiciones de tablas de archivo para los datos almacenados bajo `DATA_DIR/storage`.
- `db/file-schema.ts`, `db/file-query.ts`: metadatos de tablas nativas y expresiones de consulta.
- `db/file-backed-store.ts`: store de tablas en memoria, límite de transacción, recuperación ante fallos y persistencia de snapshots JSON. Consulta [Almacenamiento nativo de archivos (para desarrolladores)](file-storage.md).

Cruces actuales importantes:

- Las rutas importan directamente los servicios de almacenamiento, LLM, prompt, lorebook, juego, sidecar y de funciones.
- `generate.routes.ts` sirve la ruta principal de generación de Conversation y Roleplay, además de la canalización de agentes.
- `game.routes.ts` es dueño de la orquestación del juego y también alcanza el comportamiento de LLM, sidecar, lorebook, imagen, almacenamiento y del webhook de Discord.
- El análisis de escena vive en los servicios del sidecar, pero Game Mode puede ejecutarlo a través del sidecar o de una conexión LLM seleccionada.

## Propiedad de los modos

### Compartido por todos los modos

Estas son las bases globales:

- Persistencia de chats y mensajes: `packages/server/src/routes/chats.routes.ts`, `packages/server/src/services/storage/chats.storage.ts`, tipos y esquemas de chat compartidos.
- Personajes y personas: rutas de personajes, almacenamiento, esquemas, y hooks y editores de personajes del cliente.
- Conexiones y proveedores: rutas de conexión, almacenamiento, constantes de proveedor compartidas y `services/llm`.
- Presets de prompt, lorebooks, regex, herramientas personalizadas: bases compartidas de autoría y de inyección de prompt.
- Transporte de generación: `packages/client/src/hooks/use-generate.ts`, `packages/server/src/routes/generate.routes.ts` y el registro de proveedores.
- TTS, traducción, galería, temas, configuración, importaciones, copias de seguridad.

### Conversation Mode

Código principal:

- Cliente: `components/chat/ChatConversationSurface.tsx`, `ConversationView.tsx`, `ConversationMessage.tsx`, `ConversationInput.tsx` y el cableado de inicio rápido de Conversation en `ChatArea.tsx`.
- Hooks del cliente: `use-autonomous-messaging.ts`, `use-background-autonomous.ts`.
- Servidor: `/api/conversation`, `services/conversation/*`.
- Metadatos compartidos: `conversationSchedulesEnabled`, `characterSchedules`, `scheduleWeekStart` y los resúmenes de día y de semana.

Límite esperado:

- Conversation debe ser dueña de los horarios, los avisos autónomos, la actividad de conversación y la visualización de mensajes que no son de Roleplay.
- Conversation no debe saber nada sobre los dados del juego, las etiquetas del GM, los eventos de tiempo rápido, los mapas del juego ni el combate del juego.

### Roleplay Mode

Código principal:

- Cliente: `components/chat/ChatRoleplaySurface.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`, los componentes `RoleplayHUD`, `SpriteOverlay.tsx`, `SceneBanner.tsx`, `CyoaChoices.tsx` y `EncounterModal.tsx`.
- Servidor: `/api/scene`, `/api/encounter`, `/api/sprites` y partes de `/api/generate`.
- Contratos compartidos: `scene`, los campos de metadatos de chat relacionados con Roleplay y los tipos de colocación de sprites.

Límite esperado:

- Roleplay debe ser dueña de las escenas, la visualización de sprites, las opciones CYOA, el HUD (barra de estado en pantalla) de Roleplay y los flujos de ayudante de encuentros de Roleplay.
- Los efectos visuales compartidos que Game Mode también usa deben salir de `components/chat`.

### Game Mode

Código principal:

- Cliente: `components/game/*`, `hooks/use-game.ts`, `hooks/use-scene-analysis.ts`, `stores/game-mode.store.ts`, `stores/game-state.store.ts`, `stores/game-asset.store.ts`, `lib/game-*`, `lib/party-dialogue-parser.ts`.
- Servidor: `/api/game`, `/api/game-assets`, `services/game/*` y las porciones de juego de `services/sidecar/scene-analyzer.ts` y `scene-postprocess.ts`.
- Contratos compartidos: `types/game.ts`, `types/game-state.ts`, `types/combat-encounter.ts` y los campos de juego en `ChatMetadata`.

Límite esperado:

- Game debe ser dueño de los prompts del GM, los prompts de grupo, los dados, las pruebas de habilidad, los eventos de tiempo rápido, el combate del juego, los mapas, los viajes y el descanso, el clima y el tiempo, la reputación de los NPC (personajes no jugadores), los resúmenes de sesión del juego, los assets de juego generados y los registros del juego.
- Game no debe depender de la UI de los modos de chat, salvo a través de primitivos compartidos o de componentes de función explícitamente compartidos.

## Archivos grandes actuales

Estos archivos son los que con más probabilidad frenarán el trabajo futuro, porque mezclan muchas responsabilidades en un solo lugar. El número de líneas cambia a menudo, así que esta lista da un orden aproximado y la responsabilidad en vez del tamaño exacto.

| Archivo | Sección | Responsabilidad |
| --- | --- | --- |
| `packages/server/src/routes/generate.routes.ts` | generación y agentes compartidos | La ruta, el streaming, el prompt, los agentes, el almacenamiento y los efectos secundarios viven en un solo archivo. |
| `packages/server/src/routes/game.routes.ts` | `MODE-GAME` | Los manejadores de la API, el flujo del GM, el análisis de escena, los assets, el combate y la persistencia están acoplados. |
| `packages/client/src/components/game/GameSurface.tsx` | `MODE-GAME` | El renderizado, la orquestación de estado, los assets, los registros, la narración, el combate y los efectos están acoplados. |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | chat settings mixtos | La extracción de secciones está en curso en `features/chat-settings`, pero el panel lateral sigue siendo grande. |
| `packages/client/src/components/game/GameNarration.tsx` | `MODE-GAME` | El renderizado de la visualización y el formato de comandos están fuertemente acoplados. |
| `packages/client/src/components/game/GameCombatUI.tsx` | `MODE-GAME` | La visualización de combate, los controles y los registros pueden convertirse en paneles y hooks más pequeños. |
| `packages/client/src/components/chat/RoleplayHUD.tsx` | `MODE-ROLEPLAY` | Una división está hecha en parte mediante `RoleplayHUDActionsMenu.tsx` y `RoleplayHUDPanels.tsx`. |

## Estructura objetivo

Esta es la dirección de las refactorizaciones futuras. No exige mover todo de una vez.

### Objetivo del cliente

```text
packages/client/src/
  app/                         # App bootstrap, shell integration, providers
  shared/
    components/                # UI primitives and mode-agnostic widgets
    hooks/                     # cross-feature client hooks
    lib/                       # browser/runtime helpers
    stores/                    # global client stores only
  features/
    agents/
    assets/
    gallery/
    sidecar/
    tts/
    translation/
  modules/
    conversation/
      components/
      hooks/
      lib/
    roleplay/
      components/
      hooks/
      lib/
    game/
      components/
      hooks/
      lib/
      stores/
```

### Objetivo del servidor

```text
packages/server/src/
  app/                         # Fastify setup, route registration, middleware
  shared/
    db/
    storage/
    llm/
    prompt/
    lorebook/
    utils/
  features/
    agents/
    assets/
    haptic/
    image/
    import/
    sidecar/
    tts/
  modules/
    chat/
    conversation/
    roleplay/
      scene/
      encounter/
      sprites/
    game/
      routes/
      services/
      prompts/
```

### Objetivo de shared

```text
packages/shared/src/
  contracts/
    chat/
    conversation/
    roleplay/
    game/
    providers/
  constants/
  utils/
```

La antigua distribución plana de `types`, `schemas` y `constants` ya no es toda la historia. `packages/shared/src/features/` ahora aloja agentes, llamadas a funciones, paquetes de carpetas, juegos por turnos, conjuntos de reglas y combate, y el generador de mundos. La primera limpieza de shared debería seguir siendo a nivel de tipos e incremental, no un movimiento masivo de archivos.

## Reglas de migración

1. Coloca el código nuevo en la sección correcta más estrecha.
2. Si dos o más modos usan un componente del cliente, muévelo a `CLIENT-SHARED` antes de añadir más comportamiento específico del modo.
3. Si el cliente y el servidor necesitan un tipo, un esquema o un ayudante puro, muévelo a `CORE-CONTRACT`.
4. Si solo el servidor lo necesita, mantenlo fuera de `packages/shared`.
5. Los archivos de rutas deben validar la entrada HTTP y llamar a los servicios. Las decisiones del dominio deben moverse a los servicios.
6. Los stores deben ser o bien globales (`ui`, `chat`, `sidecar`) o bien específicos del modo (`game-mode`, `encounter`). Evita que un store sea dueño en silencio de varios modos.
7. Los metadatos deben quedar discriminados por `ChatMode`: metadatos base más los campos de Conversation, Roleplay y game.
8. Mueve una función a la vez. Deja exportaciones o envoltorios de compatibilidad cuando una ruta de importación amplia removería el repositorio de otra manera.
9. Después de cada movimiento, ejecuta lint:

   ```bash
   pnpm lint
   ```

   Luego ejecuta una comprobación dirigida de Prettier sobre los archivos tocados.

## Primeros candidatos a refactorizar

Estas son buenas primeras pasadas de limpieza, porque reducen el acoplamiento sin cambiar el comportamiento.

1. Divide `components/chat` en grupos común, Conversation y Roleplay.
   - Candidatos comunes: `ChatCommonOverlays`, `ChatBranchSelector`, `ChatGalleryDrawer`, `WeatherEffects` y los primitivos compartidos de mensaje y entrada.
   - Candidatos de Conversation: `ChatConversationSurface`, `ConversationView`, `ConversationMessage`, `ConversationInput`.
   - Candidatos de Roleplay: `ChatRoleplaySurface`, `SpriteOverlay`, `SceneBanner`, `CyoaChoices`, `EncounterModal`. La división del HUD de Roleplay está hecha en parte en `RoleplayHUDActionsMenu.tsx` y `RoleplayHUDPanels.tsx`.
2. Mueve los ayudantes del cliente solo de juego a un módulo de juego.
   - Candidatos: `game-audio`, `game-tag-parser`, `game-full-body-pose`, `game-character-name-match`, `game-segment-edits`, `party-dialogue-parser`.
3. Divide `GameSurface.tsx` en hooks de tiempo de ejecución y contenedores más pequeños.
   - Hooks candidatos: tiempo de ejecución de narración, de assets, de análisis de escena, de combate, de registro e historial, y de audio.
4. Divide `GameNarration.tsx` en análisis y formato de comandos más componentes de visualización.
5. Divide `game.routes.ts` por grupo de manejadores.
   - Grupos candidatos: configuración y sesión, generación de turnos, dados y habilidad y eventos de tiempo rápido, diario e inventario, mapa y viajes y clima, combate, assets y análisis de escena.
6. Divide `generate.routes.ts` en transporte de generación, manejo de la canalización de agentes, rutas de reintento, y ayudantes de comandos y posprocesamiento. La issue #7573 ya empezó con esto: la cadena de salida de tokens, las rondas de herramientas, los comandos de la respuesta, la limpieza del texto de la respuesta, la información de generación del mensaje guardado, el ancla de comandos ocultos y el guardado de la respuesta viven ahora en `routes/generate/`, cada uno con su propia regresión.
7. Divide `ChatMetadata` en contratos de metadatos específicos del modo.
8. Mueve los visuales compartidos de Roleplay y de juego fuera de `components/chat` antes de que game importe más internos del chat.

## Inicio práctico

Para el próximo PR de limpieza, usa este orden:

1. Crea las carpetas objetivo de una sola área.
2. Mueve primero los ayudantes puros.
3. Mueve después los componentes hoja.
4. Deja el orquestador grande en su lugar hasta que sus importaciones apunten en su mayoría al nuevo módulo.
5. Añade reexportaciones de compatibilidad solo donde el removido de importaciones distraería del cambio real.
6. Ejecuta lint:

   ```bash
   pnpm lint
   ```

   Luego ejecuta comprobaciones dirigidas de Prettier sobre los archivos tocados.

## Guías relacionadas

- [Arquitectura del frontend (para desarrolladores)](frontend.md)
- [Almacenamiento nativo de archivos (para desarrolladores)](file-storage.md)
