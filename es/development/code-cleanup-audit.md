# Auditoría de limpieza de código

**Fecha de la auditoría:** 2026-07-22

**Rama objetivo:** `staging`

**Propósito:** identificar artefactos que se pueden eliminar y simplificaciones acotadas sin cambiar el comportamiento en tiempo de ejecución.

**Estado de implementación:** los hallazgos de alta confianza y bajo riesgo se implementaron en el mismo cambio de limpieza.

## Resultado de la implementación

Completado:

- se eliminaron los cuatro módulos de código inalcanzables, el compilador de sidecar obsoleto, el ejecutor de pruebas sin pruebas y los briefs de tareas ya completadas;
- se eliminó el búfer de registro de depuración que existía solo para el panel de depuración inalcanzable, conservando los diagnósticos de la consola del navegador;
- se resolvieron los 60 hallazgos de código sin uso demostrados por el compilador y se activaron las comprobaciones de código sin uso en el cliente y el servidor;
- se eliminaron 53 hooks, ayudantes, tipos y declaraciones de UI del cliente que no se consumían, en lotes del tamaño de un dominio;
- se eliminaron las ocho dependencias huérfanas de alta confianza y se reparó el lockfile, la comprobación de instalación del workspace y el texto de solución de problemas;
- se hizo que `pnpm test` en la raíz ejecute cobertura de regresión real en lugar de informar éxito con cero pruebas;
- se reutilizó el selector de fotograma clave del storyboard (secuencia de viñetas) ya existente y se consolidó la lógica duplicada de tokens de consulta de Spotify;
- se restringió el reordenamiento de variables de preset (ajuste guardado) al preset solicitado, usando el `presetId` antes ignorado como límite de integridad.

Se retiene intencionalmente para trabajo separado de compatibilidad o de producto:

- `@rollup/wasm-node`;
- exportaciones del servidor que podrían ser API fuera del árbol o puntos de prueba (test seams);
- el parser de PNG y la consolidación de la geometría de los tutoriales;
- la refactorización amplia del editor/compositor y de los módulos grandes;
- campos de compatibilidad programados para una futura versión mayor.

Los hallazgos detallados a continuación se conservan como registro de la evidencia previa al cambio. Donde permanezca la redacción de una recomendación, este resultado de la implementación es el que manda.

## Validación

La limpieza implementada superó las vías de prueba compatibles del repositorio:

- `pnpm install --frozen-lockfile`
- `pnpm check` (aplicación de código sin uso, TypeScript, ESLint y builds de producción)
- `pnpm test` (todas las vías de regresión más la cobertura de humo del navegador: 81 aprobadas, 51 omitidas intencionalmente)

La suite del navegador también expuso cuatro supuestos de localizador dependientes del estado al hacer honesto el comando genérico de pruebas. Esas pruebas ahora navegan de forma explícita, acotan los controles móviles duplicados y apuntan al desplazador real de la línea de tiempo de Noodle sin debilitar sus afirmaciones sobre el producto.

## Resumen ejecutivo

El repositorio es grande (1665 archivos rastreados y aproximadamente 478 000 líneas en los tipos de archivo orientados al código que se inspeccionaron), pero la mayoría de los archivos grandes son código de producto activo y no restos evidentes. La limpieza más segura es un conjunto de eliminaciones pequeñas y respaldadas por evidencia, no una reescritura amplia.

La primera vía de limpieza de la auditoría original identificó:

- cuatro módulos de código sin referencias entrantes (899 líneas en total);
- un script de build de sidecar obsoleto (173 líneas);
- un ejecutor de pruebas que tiene éxito mientras ejecuta cero pruebas (54 líneas, más su conexión en el script del paquete);
- dos briefs de tareas de fase ya completadas dejados en la raíz del repositorio (235 líneas);
- 60 declaraciones, imports, parámetros y variables locales sin uso demostrados por el compilador;
- ocho dependencias directas probablemente huérfanas, sujetas a una comprobación de instalación/build limpia;
- un sprite (imagen del personaje) estático de Mari probablemente sin uso, tras una comprobación de humo en el navegador.

Los cuatro módulos inalcanzables, el script obsoleto, el ejecutor sin efecto y los briefs de tareas suman por sí solos 1361 líneas rastreadas. El trabajo propuesto debería dividirse igualmente en PR de limpieza pequeños para que cada eliminación tenga una prueba acotada y un retroceso fácil.

## Cómo se realizó la auditoría

La auditoría combinó varios tipos de evidencia:

1. Inventario de todos los archivos rastreados, tipos de archivo, áreas principales de código y archivos más grandes.
2. Análisis de import/export del AST de TypeScript, incluidos los imports relativos y los alias del repositorio.
3. Búsquedas de símbolos y nombres de archivo exactos en el código rastreado, scripts, documentación, manifiestos y workflows.
4. Sondas del compilador de TypeScript con `noUnusedLocals` y `noUnusedParameters` forzados en el cliente y el servidor.
5. Búsquedas de dependencias directas más inspección dirigida del historial de Git donde una dependencia o script parecía quedar varada por una refactorización previa.
6. Comparación normalizada de ventanas duplicadas, seguida de inspección manual de las coincidencias más sustanciales.
7. Comprobaciones de sintaxis de los archivos JSON, Python y Bash rastreados.

Etiquetas de confianza usadas más abajo:

- **High:** varias comprobaciones independientes coinciden; la eliminación debería ser mecánica.
- **Medium:** actualmente sin referencia, pero la carga dinámica, los consumidores externos o la intención del producto todavía podrían importar.
- **Defer:** una oportunidad legítima de simplificación cuya superficie de regresión es demasiado amplia para una pasada de eliminación de artefactos.

El análisis estático no puede probar la ausencia de búsquedas de cadenas en tiempo de ejecución, uso de paquetes descargados, rutas suministradas por el usuario o consumidores externos. Esos casos se señalan en lugar de tratarse como código muerto.

## 1. Eliminaciones de archivos de alta confianza

### 1.1 Módulos de código inalcanzables

| Candidato | Evidencia | Nota de limpieza | Prueba requerida |
| --- | --- | --- | --- |
| `packages/client/src/components/agents/AgentDebugPanel.tsx` (296 líneas) | Sin import entrante y `AgentDebugPanel` aparece solo en su declaración. | Elimina el componente. Luego revisa `debugLog` y `clearDebugLog` del store de agentes; por lo demás solo los consume este panel inalcanzable. No elimines `lastResults`, que usa `SpriteOverlay`. | `pnpm check`; abre la configuración de agentes/modo depuración y verifica las superficies de depuración activas. |
| `packages/client/src/components/agents/AgentThoughtBubbles.tsx` (113 líneas) | Sin import entrante y `AgentThoughtBubbles` aparece solo en su declaración. La UI actual de globos de pensamiento/lista de verificación se renderiza a través de `RoleplayHUD` / `RoleplayHUDActionsMenu`. | Elimina el componente y su entrada obsoleta en `packages/client/.instructions.md`. | `pnpm check`; `pnpm regression:roleplay`; comprueba en el navegador el HUD (barra de estado en pantalla) de roleplay y la lista de verificación de continuidad. |
| `packages/client/src/components/panels/GlobalGalleryPanel.tsx` (468 líneas) | Sin import entrante, registro de ruta ni referencia por nombre exacto. | Elimina solo este panel. **No** deduzcas que toda la capacidad de galería está muerta: `NoodleHome`, los hooks de galería, las rutas del servidor y el almacenamiento siguen teniendo referencias activas. | `pnpm check`; `pnpm smoke:ui`; verifica manualmente el comportamiento de subida de imágenes/galería de Noodle. |
| `packages/shared/src/features/turn-games/engine-utils.ts` (22 líneas) | Sin imports, sin exportación de barrel y los cuatro símbolos exportados aparecen solo en este archivo. | Elimina el archivo. | `pnpm check`; `pnpm regression`. |

### 1.2 Script de build de sidecar obsoleto

`scripts/build-sidecar-runtime.mjs` no tiene referencia en scripts de paquete, workflow, documentación ni código. Invoca `pnpm exec node-llama-cpp`, pero `node-llama-cpp` ya no es una dependencia del workspace. Su historial de Git lo vincula a la antigua vía de build del sidecar local de Gemma.

**Recomendación (alta confianza):** elimina el script. Antes de hacerlo, realiza una última búsqueda de artefactos de release fuera del repositorio por si algún pipeline de instalador está configurado externamente.

### 1.3 Briefs de implementación ya completados en la raíz

`MARI_PHASE2_TASK.md` y `MARI_PHASE3_TASK.md` son instrucciones de implementación orientadas a rama para trabajo que ahora ya está presente en el código. Nada en el repositorio los referencia, y no son documentación duradera para usuarios ni contribuidores.

**Recomendación (alta confianza):** elimínalos del árbol de trabajo. Su historial sigue disponible en Git. Si alguna justificación aún es valiosa, conserva solo esa justificación en el documento de arquitectura correspondiente en lugar de preservar las instrucciones de la tarea.

### 1.4 Ejecutor de pruebas engañoso sin pruebas

`packages/server/scripts/run-tests.mjs` apunta a tres globs `.test.ts`, pero ninguno de los directorios objetivo contiene un archivo de prueba. Ejecutar tanto `pnpm --filter @marinara-engine/server test` como `pnpm test` en la raíz termina con éxito con cero pruebas y cero suites. Las pruebas anteriores se eliminaron intencionalmente, y las reglas del repositorio prohíben conservar archivos `.test.ts`.

Esto es más peligroso que el código muerto ordinario porque un `pnpm test` en verde implica actualmente una cobertura que no existe.

**Recomendación (alta confianza):**

1. Elimina el ejecutor del servidor y el script `test` del servidor.
2. Conserva la comprobación de layout del instalador de Windows, pero dale un nombre de script propio y honesto si hace falta.
3. Redefine `test` en la raíz para ejecutar un subconjunto intencional de regresión/humo, o elimina el alias genérico y documenta `pnpm check`, `pnpm regression:*` y `pnpm smoke:ui` como los comandos de prueba reales.
4. Asegúrate de que CI no pueda informar “tests passed” únicamente a partir de una invocación sin pruebas.

## 2. Limpieza de dependencias

Estas dependencias directas no tienen import, registro, configuración ni referencia de cadena en tiempo de ejecución actual fuera de los manifiestos/lockfile, salvo que se indique lo contrario.

| Workspace | Dependencia | Confianza y evidencia |
| --- | --- | --- |
| client | `class-variance-authority` | **High.** Sin uso en código/configuración. El historial previo de limpieza de dependencias también la trató como sin uso. |
| client | `autoprefixer` | **High con prueba de build.** Sin configuración de PostCSS ni import; el cliente usa el plugin de Tailwind para Vite. |
| server | `@earendil-works/pi-ai` | **High.** El runtime de Professor Mari se refactorizó para dejar de depender de Pi. El historial del repositorio registra explícitamente que ya no se importaba y quedó para una limpieza posterior. |
| server | `@fastify/websocket` | **High.** Sin registro de plugin, ruta websocket ni import. |
| server | `png-chunk-text` | **High.** Sin import. El manejo actual de metadatos PNG se implementa directamente. |
| server | `png-chunks-encode` | **High.** Sin import. |
| server | `png-chunks-extract` | **High.** Sin import. |
| shared | `chess.js` | **High con prueba de compatibilidad.** Sin import actual en el código. La funcionalidad de ajedrez integrada se extrajo a paquetes opcionales. Eliminarla también requiere borrar su entrada en `scripts/check-workspace-install.mjs` y actualizar el texto obsoleto de solución de problemas sobre la falta de `chess.js`. |

`@rollup/wasm-node` en el cliente también está sin referencia, pero podría ser un respaldo de Rollup específico del entorno. Trátalo como **confianza media**: inspecciona el historial de empaquetado/CI y prueba los builds en las plataformas compatibles antes de eliminarlo.

No clasifiques dependencias como `workbox-window`, `pino-pretty`, `esbuild` de la raíz, paquetes de tipos o herramientas solo de CLI como sin uso basándote únicamente en el texto de los imports. Las consumen módulos generados, configuración de transporte basada en cadenas, scripts de build o scripts de paquete.

Para el PR de dependencias, actualiza `pnpm-lock.yaml`, instala desde un estado de dependencias limpio y ejecuta la vía completa de build/check. Eliminar un paquete de un árbol `node_modules` ya poblado no es prueba suficiente.

## 3. Código sin uso demostrado por el compilador

Forzar las comprobaciones de código sin uso de TypeScript produjo **57 diagnósticos del servidor** y **3 diagnósticos del cliente**. Estos son evidencia más fuerte que los candidatos basados solo en búsqueda de texto. La mayoría son imports o variables locales y se pueden eliminar de forma mecánica; los parámetros de callback y los parámetros de métodos públicos necesitan que se revisen antes sus firmas de llamada.

### 3.1 Cliente

- `ChatSettingsDrawer.tsx`: parámetro de filtro `subject` sin uso.
- `GameCombatUI.tsx`: parámetro de map `line` sin uso.
- `hooks/use-encounter.ts`: `_res` sin uso; espera la solicitud sin asignarla.

### 3.2 Servidor

- `db/file-backed-store.ts`: `TABLES_REVERSE` sin uso; campo/asignación de instancia `loadedManifest` sin uso.
- Imports/variables locales de rutas: `backup.routes.ts` (`dirname`), `sprites.routes.ts` (`readdir`), `scene.routes.ts` (`gsStorage`), `noodle.routes.ts` (`extractNoodleMentionHandles`, `NoodleInteractionType`) y `generate/dry-run-route.ts` (`lorebooksStore`).
- Parámetros de callback de rutas sin uso: `game-assets.routes.ts`, `lorebooks.routes.ts`, `sprites.routes.ts` y `youtube.routes.ts` (`reply`). Renómbralos a `_reply` solo si hay que preservar la posición de la firma de Fastify.
- `game.routes.ts`: `GmPromptContext`, `formatMoraleContext` y `sceneSpotifyTrackCandidateSchema`.
- `generate.routes.ts`: `readFileSync`, `LIMITS`, `AgentPhase`, `CharacterStat`, `GameState`, `createLLMProvider`, `formatZonedConversationDate`, `formatZonedConversationTime`, `chatsTable`, `normalizeCustomEmojiSelection`, `embedMemoryRecallTexts`, `latestHistoryUserContent`, `getActiveTurnGame`, `startTurnGame`, `pruneEmptyPromptWrappers`, `areConversationSchedulesEnabled`, `addEventEntry`, `normalizeAgentMaxTokens`, `resolveAgentRunInterval` y la variable local `chatParams`.
- `generate/dry-run-route.ts`: ayudante local muerto `wrapperMessages`.
- `services/agents/agent-executor.ts`: parámetro `agentType` sin uso en `sanitizeTextAgentResponse`; actualiza sus llamadores internos si se elimina el parámetro.
- `services/agents/agent-pipeline.ts`: `AgentPhase` sin uso.
- `services/conversation/schedule.service.ts`: `createLLMProvider` y `ConversationStatusOverride` sin uso.
- `services/game/perception.service.ts`: `RPGAttributes` sin uso.
- `services/generation/conversation-react-command-runtime.ts`: parámetro ayudante `command` sin uso.
- `services/import/st-bulk.importer.ts`: `personasTable` sin uso.
- `services/lorebook/keyword-scanner.ts`: `currentMessageIndex` desestructurado sin uso; revisa la forma de las opciones internas antes de eliminarlo.
- `services/lorebook/prompt-injector.ts`: `LorebookEntry` sin uso.
- `services/mari-db/mari-db.service.ts`: ayudante muerto `makeEmptyValidation`.
- `services/prompt/assembler.ts`: `PromptPreset`, `PromptSection`, `PromptGroup`, `groupOrder` y `chatHistoryEndIdx` sin uso.
- `services/sidecar/scene-analyzer.ts`: ayudantes muertos `widgetUpdateHint` y `widgetStateSummary`.
- `services/sidecar/scene-postprocess.ts`: ayudante muerto `normalizeExpression`.
- `services/sidecar/sidecar-process.service.ts`: `lastReadyAt` se asigna pero nunca se lee.
- `services/storage/noodle.storage.ts`: `NoodlerStageProfile` sin uso.
- `services/storage/prompts.storage.ts`: parámetro `presetId` sin uso en `reorderVariables`; verifica los llamadores y la semántica de ordenamiento del almacenamiento antes de cambiar la firma.

Una vez que esta lista esté limpia, activa `noUnusedLocals` y `noUnusedParameters` en las configuraciones de TypeScript del servidor y el cliente. Eso convierte esta auditoría de una pasada única en un invariante mantenido. Anteponer `_` a los parámetros de callback intencionalmente requeridos es preferible a volver a desactivar la regla globalmente.

## 4. Exportaciones internas sin consumidor en el repositorio

Las declaraciones exportadas están exentas de las comprobaciones ordinarias de variables locales sin uso, así que una segunda pasada buscó nombres que aparecen solo en su declaración. El cliente es una aplicación y no una librería pública, lo que hace de estos buenos candidatos a eliminar. Elimínalos en lotes del tamaño de un dominio y deja que el compilador exponga cualquier ayudante o import privado asociado.

### 4.1 Hooks y ayudantes del cliente

- Hooks de agentes: `useAgentConfig`, `useUpdateAgentByType`, `useToggleAgent`.
- Hooks de personaje: `useUpdatePersonaGalleryClipTrim`, `useCharacterGroup`.
- Hooks de chat/carpeta: `useReorderChats`, `useActiveChatPreset`, `useCreateChatPreset`, `useTouchChat`, `useMarkAutonomousUnread`, `useBulkSetMessagesHiddenFromAI`, `useSwipes`, `useMoveConnection`.
- Hooks de juego: `useRegeneratePartyCard`, `useUpdateGameMapBinding`, `useCombatLoot`, `useLootGenerate`, `useGameJournal`, `useGameCheckpoints`, `useCreateCheckpoint`, `useLoadCheckpoint`, `useDeleteCheckpoint`.
- Hooks hápticos: `useHapticStopScan`, `useHapticCommand`, `useHapticStopAll`.
- Hooks de lorebook: `useLorebookEntry`, `useBulkCreateEntries`, `useSearchLorebookEntries`.
- Otros hooks: `useCustomTool`, `useUpdateNoodleAccount`, `usePreset`, `useCreatePreset`, `usePresetGroups`, `useReorderGroups`, `usePresetSections`, `usePresetVariables`, `usePreviewPreset`, `useRegexScript`, `useUpdateSpatialContext`.
- Declaraciones de UI: `parseQteTag`, `NoodlerNotificationItem`, `LabelWithHelp`, `RESOURCE_PANEL_SORT_OPTIONS` y `SyncedSettings`.
- Ayudantes de librería: `isManagedChatBackgroundUrl`, `isBrowserSpeechRecognitionSupported`, `requestTurnGameBotGeneration`, `resolveInputMacrosForChat`, `createCustomToolFolderPackageFilename`, `resolveCurrentGameSessionChatId`, `readTextFileFromZip` y `buildTTSMessageText`.

Un hook del cliente sin uso **no** prueba que su endpoint del servidor esté sin uso. Elimina primero el hook; audita las rutas por separado frente a la UI, los paquetes de capacidad y la compatibilidad de API externas.

### 4.2 Candidatos del servidor que requieren una decisión final sobre API/punto de prueba

Las siguientes declaraciones exportadas del servidor tampoco tienen consumidor dentro del repositorio. La mayoría parecen internas, pero los puntos de prueba (test seams) y ayudantes exportados pueden usarse por herramientas fuera del árbol, así que la confianza es media hasta que los maintainers confirmen que no son API compatibles:

- runtime/autenticación básica: `getServerRoot`, `getSpotifyRedirectUri`, `isAutoOpenBrowserDisabled`, `hasBasicAuthConfigured`;
- puntos de prueba: `resetRateLimitBucketsForTests`, `buildKnowledgeRetrievalAgentMessagesForTest`, `splitRuntimeHandledAgentInjectionsForTest`, `__setSdkForTesting`;
- ayudantes de generación/prompt: `normalizeSecretPlotSceneDirections`, `buildUserMessageRegenerationPrompt`, `buildUserMessageRegenerationSourceMessage`, `wrapFields`, `mergeTruncation`, `modelAccessOptions`, `isStandaloneCharacterProfileBlock`, `resolveChatSummaryPromptFromMetadata`;
- ayudantes de juego: `buildNpcPortraitImagePrompt`, `buildBackgroundImagePrompt`, `buildSceneIllustrationImagePrompt`, `buildSessionSummaryPrompt`, `buildCardAdjustmentPrompt`, `moraleDiceModifier`, `buildNpcRelationshipSummary`, `buildSessionCarryoverContext`, `getTurnGameContextText`;
- ayudantes de lorebook: `enforceMaxActivatedEntries`, `applyPerLorebookTokenBudgets`, `resolveActivatedLorebookEntryContent`, `resolveBudgetAndRecursivelyActivateLorebookEntries`, `recursiveScan`;
- utilidades/tipos: `AgentPipelineResult`, `resolveVideoRequestDuration`, `newTimeSortableId`, `parseBoolean`, `sanitizePathFilename`.

No apliques esta prueba de “una sola aparición textual” de forma general a `packages/shared`: las exportaciones compartidas son contratos de compatibilidad para el cliente, el servidor y los paquetes de agentes descargables, incluidos consumidores fuera de este repositorio.

## 5. Candidato de recurso estático

`packages/client/public/sprites/mari/Mari_point_down_left.png`, el único sprite de Mari incluido cuyo nombre base/ruta no tenía referencia en el repositorio, se eliminó con omnibar slice 38a.

No uses búsquedas por nombre base para podar los recursos de juego incluidos. Algunos seeders y manifiestos del servidor escanean ciertos directorios de recursos de forma dinámica.

## 6. Simplificaciones acotadas

Estas son mejoras de mantenibilidad, no eliminaciones de código muerto. Cada una debe preservar el comportamiento exactamente y llevar una prueba de regresión enfocada.

### 6.1 Lógica de negocio duplicada de forma exacta o casi exacta

1. **Selección de fotograma clave del storyboard — riesgo bajo.** `GameSurface.tsx` tiene una implementación local `findStoryboardKeyframeForSegment` que coincide con `findReplayStoryboardKeyframe` exportada en `lib/game-session-replay.ts`. Reutiliza el ayudante de la librería y elimina la copia local.
2. **Normalización de búsqueda de Spotify — riesgo bajo/medio.** `SPOTIFY_STOP_WORDS`, `SPOTIFY_MOOD_EXPANSIONS` y el flujo de expansión están duplicados entre `game-spotify-music.service.ts` y `tool-executor.ts`. Extrae un pequeño ayudante de tokens de consulta de Spotify para que las dos vías no puedan divergir.
3. **Extracción de metadatos de tarjeta de personaje en PNG — riesgo medio.** `extractCharaFromPng` está implementado de forma independiente en `import.routes.ts` y `st-bulk.importer.ts`. Extrae una sola utilidad del servidor y prueba fragmentos de texto normales, fragmentos de texto internacionales, cargas útiles base64/raw, tarjetas V2/V3 y PNG malformados con fixtures de regresión.
4. **Geometría de tooltip del tutorial — riesgo medio.** `GameTutorial.tsx` y `OnboardingTutorial.tsx` duplican la lógica de colisión/posicionamiento. Extrae solo el cálculo de geometría compartido; conserva las políticas móviles y específicas de producto de cada tutorial como opciones explícitas.
5. **Normalización de edición de segmentos de juego cliente/servidor — riesgo medio/alto.** La normalización pura en el cliente y el servidor es similar. Mueve a shared solo un schema/normalizador genuinamente neutral en tiempo de ejecución; deja en el servidor las preocupaciones de parsing y persistencia del servidor.

### 6.2 Áreas de UI grandes repetidas: pospón la consolidación amplia

- `CharacterEditor.tsx` y `PersonaEditor.tsx` contienen un flujo de trabajo de gestión de sprites sustancialmente repetido.
- `ChatInput.tsx` y `ConversationInput.tsx` repiten el comportamiento del plan guiado y del compositor.

Hay valor real en la consolidación, pero fusionar cualquiera de los dos pares por completo crearía una gran superficie de regresión. Extrae un hook/componente coherente a la vez —la gestión de sprites primero para los editores, el comportamiento del plan guiado primero para los compositores— y prueba en el navegador ambos llamadores después de cada extracción.

### 6.3 Puntos calientes de complejidad activa

Los módulos activos más grandes son `server/routes/game.routes.ts`, `client/components/game/GameSurface.tsx`, `client/features/chat-settings/ChatSettingsDrawer.tsx`, `server/routes/generate.routes.ts` y `client/components/panels/SettingsPanel.tsx`. No son candidatos a eliminar. Sigue extrayendo manejadores de ruta acotados, servicios de dominio, secciones de panel y ayudantes puros solo cuando la funcionalidad afectada ya se esté cambiando. Un PR aislado de “dividir todo” añadiría ruido sin una prueba de comportamiento fiable. El panel de ajustes del chat fue la excepción. Se dividió con una sección por PR (#9119). Las reglas de su carpeta están en `packages/client/.instructions.md`, en la sección Chat Settings.

## 7. Elementos excluidos deliberadamente de la limpieza

- Campos de compatibilidad marcados explícitamente como aceptados a lo largo de la línea 2.x, incluidas las formas de compatibilidad de estilo de imagen, estado del juego, TTS, tracker (agente de seguimiento) de persona y contexto de conversación. Elimínalos solo mediante una migración versionada en la próxima versión mayor.
- Registros y manifiestos de capacidad generados. Regenéralos con sus scripts; no los podes a mano.
- Código de los paquetes de agentes descargables Illustrator, Music DJ, Lorebook Keeper y otros. La limpieza de runtime/prompt propiedad del agente corresponde a `Pasta-Devs/Marinara-Agents`; aquí solo corresponde la integración del host.
- Módulos de Home Assistant bajo `custom_components`, cuyo descubrimiento está guiado por convención y manifiesto.
- `MarinaraLauncher.exe`, que consume el código de migración de accesos directos de la barra de tareas.
- `start-local.bat`, que no está referenciado por scripts de paquete pero sigue siendo un lanzador local plausible de cara al usuario. Elimínalo solo tras una comprobación de la intención de un maintainer.
- Declaraciones de schema que parecen sin referencia pero se ejecutan como parte de la inicialización del módulo o el registro de tablas.
- Rutas del servidor solo porque un hook de React de conveniencia esté sin uso; los paquetes descargables o los consumidores de API todavía podrían llamarlas.

## 8. Secuencia de limpieza recomendada

Mantén el trabajo simple y revisable:

1. **PR A — artefactos:** elimina los cuatro módulos inalcanzables, la entrada de documentación de componente obsoleta, el script de sidecar obsoleto, los briefs de tareas completadas y —tras confirmación manual— el sprite de Mari sin uso.
2. **PR B — superficie de pruebas honesta:** elimina el ejecutor sin pruebas y renombra/redefine los scripts de paquete para que los comandos exitosos representen comprobaciones reales.
3. **PR C — limpieza del compilador:** resuelve los 60 diagnósticos de TypeScript, luego activa las comprobaciones de código sin uso en las configuraciones de cliente/servidor.
4. **PR D — dependencias:** elimina los ocho paquetes de alta confianza, repara la comprobación de instalación del workspace y el texto de solución de problemas, regenera el lockfile y prueba una instalación/build limpia.
5. **PR E en adelante — lotes por dominio:** elimina las exportaciones del cliente sin uso por dominio, luego aborda los ayudantes duplicados de bajo riesgo uno a la vez.

Evita combinar la eliminación de dependencias, la refactorización amplia de UI y la descomposición de rutas en un solo PR de limpieza.

## 9. Matriz de validación

Ejecuta la prueba apropiada para cada cambio:

- Toda limpieza de código: `pnpm check`.
- Cambios compartidos o amplios en el servidor: `pnpm regression` o el comando acotado `pnpm regression:<domain>` primero, seguido de la vía completa antes de fusionar.
- Limpieza de componente/hook de UI: `pnpm smoke:ui` más verificación manual en el navegador del flujo afectado.
- Vías de prompt, agente o roleplay: `pnpm regression:prompt` o `pnpm regression:roleplay`.
- Limpieza de dependencias: instalación limpia/frozen, `pnpm check`, builds de producción y CI en plataformas compatibles.
- Consolidación de import de PNG: regresiones de import directo que cubran tarjetas de personaje válidas y malformadas.
- Archivos de release/versión, si se tocan de forma inesperada: `pnpm version:check` y `pnpm credits:check`.

Antes de esta limpieza, el resultado genérico de `pnpm test` no podía citarse como evidencia de pruebas porque terminaba con éxito sin ejecutar pruebas.

## 10. Validación y limitaciones de la auditoría

Durante esta auditoría:

- todos los archivos JSON rastreados se analizaron correctamente;
- los 12 archivos Python rastreados se analizaron correctamente con el parser de AST de Python;
- `start.sh`, `start-termux.sh` y `android/build-apk.sh` pasaron `bash -n`;
- las sondas de código sin uso de TypeScript produjeron los 57 hallazgos del servidor y 3 del cliente documentados arriba;
- se observó directamente que los comandos de prueba del servidor y de la raíz tenían éxito con cero pruebas.

ShellCheck y PowerShell no estaban instalados, así que no se realizó el linting semántico de shell ni el análisis de los scripts de PowerShell/Windows. Los objetivos de Android y Home Assistant se inspeccionaron estructuralmente pero no se compilaron por completo en esta auditoría. Esas comprobaciones de plataforma corresponden a los PR de limpieza que toquen sus archivos.
