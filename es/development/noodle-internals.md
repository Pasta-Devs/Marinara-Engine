# Interioridades de los prompts de Noodle (para desarrolladores)

Referencia para desarrolladores sobre dónde viven en el código los prompts de generación de Noodle, cómo personalizarlos y cómo depurar los prompts finales. Los usuarios finales configuran Noodle desde su panel de Settings (Configuración); consulta las guías de Noodle en `docs/noodle/`.

Noodle es un paquete descargable. Sus rutas (`/api/noodle`, registradas cuando el paquete se activa) y su código de generación viven en el paquete Noodle de [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), en `packages/noodle/src/engine/packages/server/src/`. En la tabla de abajo, un origen marcado como **package** es relativo a esa carpeta. Engine conserva el esquema y los tipos compartidos de Noodle, el almacenamiento de Noodle, los overrides de prompt registrados que lista Settings y el texto predeterminado del prompt del timeline en `packages/server/src/services/noodle/noodle-prompt.ts`. El paquete conserva sus propias copias de `services/prompt-overrides/registry/noodle.ts` y `services/noodle/noodle-prompt.ts`.

## Mapa de origen de los prompts

Noodle tiene un prompt del timeline ensamblado, un prompt de perfil en línea y tres overrides de prompt registrados: dos para el prompt de sistema del timeline y uno para las imágenes de las publicaciones.

| Propósito                                                     | Origen                                                             | Símbolo principal                                     | Cómo personalizarlo                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Publicaciones, respuestas, seguimientos, encuestas, votos y resúmenes del timeline | **package** `services/noodle/noodle-public-prompt.service.ts`      | `buildRefreshPrompt()`                          | El mensaje de sistema es el override **Noodle Timeline Prompt** seguido del override **Noodle Timeline Voice & Tone** (ambos más abajo). Los dos mensajes de usuario, el contexto (cuentas, persona, perfiles, horarios, trasfondo, contexto de chat con participación voluntaria, el timeline, las funciones activadas y las cuotas) y el mensaje `# JSON Output Format` se ensamblan en el código. |
| Prompt de sistema base del timeline                                 | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_BASE` (`noodle.timelineBase`)   | Edita **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Prompt**, o cambia `NOODLE_TIMELINE_BASE_DEFAULT_PROMPT` en `noodle-prompt.ts` en el código. El valor predeterminado contiene las reglas de plataforma para adultos, de autoría de la persona, de interacción y de JSON, así que una reescritura puede romper el análisis de `noodleGeneratedRefreshSchema`. |
| Instrucciones de voz/tono del timeline (se añaden después de la base) | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE` (`noodle.timelineVoice`) | Edita **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone**, o cambia en el código el valor predeterminado registrado (`noodleTimelineVoiceDefaultText(enhanced, allowRandomUsers)` en `noodle-prompt.ts`). El valor predeterminado sin editar sigue el ajuste `enableEnhancedTimelineWriting` de Noodle (`ctx.enhanced`, desactivado de forma predeterminada, reproduce la instrucción de tono original de una sola línea) y si se permiten usuarios aleatorios; una vez que un usuario guarda su propio texto de override, ese texto gana sin importar esos ajustes. |
| Perfiles de cuentas de personaje por primera vez                       | **package** `services/noodle/noodle-public-profiles.service.ts`    | `generateMissingNoodleProfiles()`               | Edita en el código los mensajes de sistema y de usuario en línea. La selección de participantes se ejecuta primero, y a este prompt solo se pasan las cuentas de personaje seleccionadas que no tengan `profileGenerated`.                       |
| Prompt de imagen de una publicación generada                                 | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST` (`noodle.imagePost`)        | Edita **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image**, o cambia en el código el valor predeterminado registrado. |
| Instrucciones de imagen predeterminadas específicas de Noodle                  | `packages/shared/src/schemas/noodle.schema.ts`                     | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | Cambia el ajuste de Noodle en la interfaz o su valor predeterminado del esquema en el código.                                                                    |
| Contexto de chat con participación voluntaria insertado en la generación del timeline     | **package** `services/noodle/noodle-public-prompt.service.ts`      | `buildOptedInChatContext()`                     | Cambia en el código el ensamblado del contexto; la participación voluntaria del usuario sigue estando en los ajustes de cada chat.                                                     |
| Entradas de imagen de publicaciones y respuestas del timeline                        | **package** `services/noodle/noodle-vision.ts`                     | `prepareNoodleVisionAttachments()`              | Cambia en el código la selección de imágenes, la normalización, los límites o la alternativa de compatibilidad solo texto.                                           |
| Actividad de Noodle insertada en los prompts del chat                  | **package** `services/noodle/noodle-context.ts`                    | `buildRecentSocialMediaActivityBlock()`         | El paquete lo registra como el servicio `noodle:prompt-context`. Cambia en el código el filtrado o el ensamblado del bloque; los usuarios controlan los modos de destino y los límites de elementos en Noodle Settings, mientras que el bloque envuelto tiene un tope duro de 8192 tokens.                                  |
| Contrato JSON generado                                     | `packages/shared/src/schemas/noodle.schema.ts`                     | `noodleGeneratedRefreshSchema`                  | Cámbialo solo junto con el prompt, el procesamiento de la ruta, los tipos compartidos y la cobertura de regresión.                                            |
| Contexto de mundo/lore del lorebook insertado en la generación del timeline | **package** `services/noodle/noodle-public-prompt.service.ts`    | `buildRefreshPrompt()` (llama a `processLorebooks()`) | Controlado por el ajuste de Noodle **Lorebook context** (`enableLorebookContext`, desactivado de forma predeterminada). Reutiliza el mismo `processLorebooks()` multipersonaje que usan los chats grupales, con un presupuesto de tokens específico de Noodle desde `noodleLorebookTokenBudget()` en `noodle-prompt.ts`, escalado según el número de personajes activos y con un tope duro de 8192 tokens. Se ejecuta con `previewOnly: true` porque Noodle no tiene un espacio por chat donde guardar el estado de temporización de fijado/enfriamiento. |

El prompt de perfil no aparece en la interfaz de Prompt Overrides. Las plantillas **Noodle Timeline Prompt**, **Noodle Timeline Voice & Tone** y **Noodle Post Image** sí aparecen. Cuando **Noodle image generation** está activado (`enableImagePrompts`), el ajuste de Noodle **Image instructions (sent to your LLM)** va al modelo del timeline, que lo sigue cuando escribe la idea de imagen de cada publicación; la plantilla predeterminada **Noodle Post Image** ya no lo añade, aunque las plantillas personalizadas aún pueden usarlo como `${userInstructions}`.

El servicio de imágenes (**package** `services/noodle/noodle-public-images.service.ts`) carga `NOODLE_IMAGE_POST` y luego pasa el resultado por `compileImagePrompt()` antes de enviarlo al proveedor de imágenes. Esto significa que la solicitud final también puede verse afectada por el perfil de estilo de imagen seleccionado y por los valores predeterminados de la conexión.

## Inspeccionar los prompts finales

Un refresco manual solicitado con Debug Mode activado registra los mensajes finales de modelo del perfil y del timeline a través del logger compartido del servidor. Busca:

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

Las cargas de imagen del timeline nunca se escriben como base64 en los registros de depuración. El texto registrado contiene las mismas claves de adjunto de publicación/respuesta enviadas al modelo, más el número de entradas de imagen nativas. Noodle normaliza y limita estas entradas en `noodle-vision.ts`. Si un proveedor rechaza de forma explícita el contenido de visión, el paquete lo registra y envía en su lugar el prompt alternativo solo texto ya ensamblado.

Para las imágenes, activa **Expose media prompts before sending** en **Settings -> Generations -> Overall Generations** para inspeccionar y editar los prompts positivo y negativo finales ya compilados antes de enviar la solicitud.

## Editar con seguridad

El ensamblado del prompt es un límite de compatibilidad de alto riesgo. Cuando lo edites, mantén alineados el prompt, `noodleGeneratedRefreshSchema`, el procesamiento de la ruta y las regresiones de menciones y encuestas de Noodle. En Engine, ejecuta al menos:

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

Los cambios en el código que pertenece al paquete se hacen y se validan en Marinara-Agents, contra su rama `staging`.

## Guías relacionadas

- [Noodle: el timeline social dentro de la app](../noodle/overview.md)
- [Ajustes de Noodle y traspaso del chat](../noodle/settings.md)
- [Paquetes opcionales de agentes y capacidades](optional-agent-packages.md)
- [Mapa de arquitectura (para desarrolladores)](architecture-map.md)
