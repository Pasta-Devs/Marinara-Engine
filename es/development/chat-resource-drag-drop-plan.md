# Plan de arrastrar y soltar recursos en el chat

## Estado

Las fases 1 a 4 se implementaron en `drag-me-baby-one-more-time` y están fusionadas en `staging`. Un trabajo posterior (#7362) permite arrastrar filas de la biblioteca sin asa, permite que un usuario táctil reúna una pila de recursos compatibles con toques de un segundo dedo y muestra huecos de inserción al reordenar.

La cobertura automatizada del resolutor (el módulo que decide qué acción es válida) está activa. Se añadió cobertura de Playwright en computadora para la asignación de personajes y el reemplazo de persona, pero la ejecución local en el contenedor de desarrollo actual está bloqueada porque Chromium no puede cargar `libnspr4.so`; esos casos de navegador debe ejecutarlos CI o un entorno con las dependencias de sistema de Playwright.

Antes de empezar las fases restantes, sigue las reglas de coordinación del repositorio:

1. Comprueba si existe un issue, una rama enlazada al issue, una pull request en borrador o un elemento del proyecto que cubra el arrastrar y soltar de recursos en el chat.
2. Haz visible la propiedad en el issue.
3. Abre una pull request en borrador contra `staging` cuando empiece la implementación.

## Objetivo

Permitir que los usuarios arrastren recursos compatibles desde el panel derecho hasta el chat activo, sin pasar por los ajustes del chat.

La ventana central tiene dos destinos posibles:

- **Superficie del chat:** cambia la configuración persistente del chat activo.
- **Composer:** añade un adjunto compatible al borrador actual (el composer es el cuadro donde escribes el mensaje).

Estos no son destinos universales. Un destino aparece solo cuando el elemento arrastrado tiene ahí una operación real y admitida hoy.

## Regla de producto

Arrastrar elige el recurso y el destino. La aplicación solo realiza operaciones que ya existen en el modelo de datos del chat y en la canalización de generación.

- Una sola operación aditiva válida: aplícala de inmediato y ofrece Undo (Deshacer).
- Una sola operación de reemplazo válida: pide confirmación si va a reemplazar un valor existente.
- Varias operaciones realmente admitidas: muestra un selector pequeño que contenga solo esas operaciones.
- Ninguna operación válida: no actives ningún destino.
- Recurso ya aplicado: no aceptes soltarlo de nuevo.
- Nada de contexto especulativo de un solo turno, inyección oculta de prompt (las instrucciones que se envían a la IA), menciones sintéticas ni etiquetas decorativas.

## Contratos actuales

Los contratos actuales `Chat` y `ChatMetadata` admiten estas operaciones persistentes:

- Personajes: actualizar `Chat.characterIds`.
- Persona: actualizar `Chat.personaId`.
- Preset de prompt (preset = ajuste guardado): actualizar `Chat.promptPresetId`.
- Conexión: actualizar `Chat.connectionId`.
- Lorebooks (libros de trasfondo): actualizar `ChatMetadata.activeLorebookIds`.
- Agentes: actualizar `ChatMetadata.activeAgentIds` y, cuando se acepte, `ChatMetadata.enableAgents`.
- Fondo del chat: actualizar los metadatos existentes del fondo del chat por la misma vía de asignación que usa `BackgroundPicker`.

Los composers actuales admiten archivos adjuntos. Hoy no admiten referencias a personajes, lorebooks, agentes, personas, presets ni conexiones con alcance de mensaje.

## Matriz de acciones admitidas

El resolutor de capacidades también debe aplicar las restricciones actuales del modo de chat y la disponibilidad de los recursos. La tabla describe la operación cuando la interfaz actual ya la permite en el modo activo.

| Recurso | Superficie del chat | Composer | Comportamiento al soltar |
| --- | --- | --- | --- |
| Personaje | Añadir el ID a `characterIds` | Ninguno | Añadir de inmediato; toast (mensaje de aviso) con Undo |
| Lorebook | Añadir el ID a `activeLorebookIds` | Ninguno | Añadir de inmediato; toast con Undo |
| Agente | Añadir el ID a `activeAgentIds` | Ninguno | Añadir de inmediato cuando los agentes están activados; si no, confirmar que se activen los agentes y se añada |
| Persona | Fijar `personaId` | Ninguno | Fijar de inmediato si está vacío; confirmar cuando reemplace a otra persona |
| Preset de prompt | Fijar `promptPresetId` | Ninguno | Respetar las restricciones de modo; fijar de inmediato si está vacío; confirmar cuando reemplace a otro preset |
| Conexión | Fijar `connectionId` | Ninguno | Confirmar al cambiar la conexión actual; incluir el nombre de la conexión antigua y de la nueva |
| Fondo del chat | Fijar los metadatos existentes del fondo del chat | Ninguno | Usar la semántica actual de asignación de fondo; confirmar el reemplazo solo si el flujo existente lo exige |
| Imagen o archivo compatible | Ninguno | Añadir a los adjuntos del borrador | Reutilizar la validación y la preparación de adjuntos que ya existen |
| Carpeta de personajes, lorebooks o agentes | Ninguno | Ninguno | Sin destino |
| Control de configuración | Ninguno | Ninguno | Sin destino |
| Script de regex | Ninguno | Ninguno | Sin destino hasta que exista un contrato de asignación con alcance de chat |
| Función o herramienta personalizada | Ninguno | Ninguno | Sin destino hasta que exista un contrato de asignación con alcance de chat |
| Contribución de extensión | Ninguno de forma predeterminada | Ninguno de forma predeterminada | Solo por adhesión explícita, a través de una futura API tipada de contribuciones |

### Reglas de modo

No dupliques la política de modo en los manejadores de arrastre. El resolutor de capacidades de soltado debe usar los mismos predicados que la interfaz actual de configuración y ajustes del chat.

Como mínimo:

- Los presets de prompt siguen sin estar disponibles en el modo Conversation, igual que en `PresetsPanel`.
- Soltar un agente exige que el agente esté instalado, disponible y sea válido para el modo actual.
- Las operaciones de personaje, persona, lorebook, conexión y fondo solo se ofrecen donde ya esté disponible su control de asignación.
- Los chats sin ID activo no exponen ningún destino de soltado de recursos.
- El streaming o el procesamiento de agentes no deberían bloquear actualizaciones seguras de metadatos, salvo que una vía de mutación existente ya lo haga. Las confirmaciones de reemplazo deben releer el estado actual del chat antes de aplicarse.

## Diseño de la interacción

### Inicio del arrastre

Cada fila de panel compatible escribe una única carga útil de recurso con versión:

```ts
type ChatResourceDragPayload = {
  version: 1;
  kind: "character" | "lorebook" | "agent" | "persona" | "preset" | "connection" | "background";
  ids: string[];
  label: string;
};
```

Usa un único tipo MIME propio, por ejemplo `application/x-marinara-chat-resource`. Conserva las cargas útiles MIME de carpeta existentes durante la migración, porque reordenar carpetas sigue siendo una interpretación válida y distinta del mismo arrastre.

Los efectos del arrastre de recursos deben anunciar `copyMove`:

- Los destinos de carpeta interpretan el arrastre como un movimiento.
- Los destinos de chat interpretan el arrastre como una copia o asignación.

No dependas de `text/plain` para las operaciones internas de recursos. Es ambiguo y hoy contiene IDs sueltos.

### Visibilidad del destino

Las señales de soltado permanecen ocultas en reposo.

Cuando un arrastre de recurso reconocido entra en la ventana central:

1. Analiza y valida la carga útil tipada.
2. Resuelve las acciones válidas contra el chat activo más reciente.
3. Muestra solo los destinos válidos.
4. Usa texto propio de la acción, como `Add Maris to this chat`, no un genérico `Drop here`.
5. Deja las áreas no válidas sin cambios y sin aceptar soltado.

Al arrastrar un archivo compatible, solo se resalta el composer. Al arrastrar un personaje, lorebook, agente, persona, preset, conexión o fondo, en la primera versión solo se resalta la superficie del chat.

### Soltar en la superficie del chat

El área activa de soltado es la superficie de conversación actual, sin depender de la posición de desplazamiento de la transcripción. Soltar sobre un mensaje antiguo no inserta historial ni cambia el contexto de forma retroactiva.

Al soltar:

1. Relee el ID del chat activo y los datos actuales del chat.
2. Vuelve a resolver la capacidad para evitar acciones obsoletas o duplicadas.
3. Aplica de inmediato cuando la operación es aditiva y no ambigua.
4. Abre una confirmación concreta para los reemplazos o para activar agentes.
5. Informa del éxito con un toast localizado y una acción Undo.
6. Informa del fallo de la mutación sin cambiar la transcripción.

No crees mensajes de usuario, de assistant, de narrador ni de sistema para registrar cambios de configuración. El modelo de mensajes no tiene un tipo dedicado de evento de actividad, y los eventos de configuración no deben entrar en el historial que ve el modelo.

### Soltar en el composer

Conserva el comportamiento actual de archivos tanto en `ChatInput` como en `ConversationInput`:

- Valida los tipos admitidos y el límite de tamaño de 20 MB.
- Prepara las imágenes con `prepareImageAttachment`.
- Lee los archivos de texto y PDF admitidos por la vía de adjuntos actual.
- Conserva el comportamiento del borrador de adjuntos pendientes por chat.

Afina la detección de arrastre del composer para que los arrastres internos de recursos no activen el resaltado de soltar archivos y luego no hagan nada.

### Confirmación

Pide confirmación solo cuando la operación tenga una consecuencia real:

- Reemplazar una persona activa.
- Reemplazar un preset de prompt activo.
- Cambiar una conexión activa.
- Activar los agentes como parte de añadir un agente.
- Cualquier vía existente de asignación de fondo que ya exija una elección o una confirmación de reemplazo.

Las confirmaciones deben nombrar el valor actual y el propuesto cuando aplique. No deben incluir acciones ajenas, como iniciar un chat nuevo, invocar un agente una vez o referenciar el recurso en un mensaje.

### Undo

Undo restaura el valor exacto anterior al soltado, no una suposición reconstruida.

- Personaje: restaura el array `characterIds` completo anterior.
- Lorebook: restaura el array `activeLorebookIds` completo anterior.
- Agente: restaura tanto `activeAgentIds` como `enableAgents`.
- Persona, preset, conexión y fondo: restaura el valor anterior.

Antes de ejecutar Undo, verifica que el chat activo aún tenga el valor que produjo el soltado. Si desde entonces otra edición cambió ese mismo campo, no lo sobrescribas; descarta el Undo obsoleto y avisa al usuario de que el chat cambió.

## Arquitectura

### Utilidad compartida del cliente

Añade un módulo de cliente acotado, provisionalmente `packages/client/src/lib/chat-resource-drag.ts`, que contenga:

- La constante MIME.
- El tipo de la carga útil y su analizador en tiempo de ejecución.
- `writeChatResourceDragPayload(dataTransfer, payload)`.
- La detección de arrastre de archivos.
- Las guardas de clase de recurso.

Mantén la carga útil solo en el cliente en la primera versión, porque es estado de interacción del navegador, no un contrato de API.

### Resolutor de capacidades

Añade un resolutor puro, provisionalmente `packages/client/src/lib/chat-resource-drop-capabilities.ts`:

```ts
type ChatResourceDropAction =
  | { type: "add-characters"; ids: string[] }
  | { type: "add-lorebooks"; ids: string[] }
  | { type: "add-agents"; ids: string[]; mustEnableAgents: boolean }
  | { type: "set-persona"; id: string; replacesId: string | null }
  | { type: "set-preset"; id: string; replacesId: string | null }
  | { type: "set-connection"; id: string; replacesId: string | null }
  | { type: "set-background"; id: string };
```

Las entradas incluyen la carga útil de recurso ya analizada, el chat activo, los metadatos normalizados, el modo actual y los IDs de recursos disponibles. La salida es una acción concreta o `null`.

El resolutor es dueño de:

- La supresión de duplicados.
- Las restricciones de modo.
- El filtrado de varios IDs.
- Las comprobaciones de instalado y disponible.
- La detección de reemplazos.
- La elección de la clave de acción visible para el usuario.

El resolutor no realiza mutaciones ni renderiza interfaz.

### Coordinador de mutaciones

Añade un solo hook cerca de la superficie del chat, provisionalmente `use-chat-resource-drop.ts`, que:

- Lee el chat activo más reciente desde React Query/Zustand en el momento de soltar.
- Llama a `useUpdateChat` para los campos de primer nivel del chat.
- Llama a `useUpdateChatMetadata` para los lorebooks y los agentes.
- Reutiliza la vía de mutación existente para asignar el fondo.
- Abre confirmaciones localizadas con los ayudantes de diálogo de la app que ya existen.
- Crea toasts de éxito y de error, y acciones Undo protegidas.

No pongas lógica de mutación asíncrona en un store de Zustand.

### Superposición de soltado

Añade un único componente de presentación alrededor del límite compartido del chat central, no implementaciones separadas dentro de cada transcripción:

- Recibe la carga útil de arrastre actual y la acción resuelta.
- Cubre la superficie de conversación sin tapar el composer.
- Usa un recuento de profundidad de `dragenter`/`dragleave` para evitar parpadeos entre elementos hijos.
- Muestra el icono, la etiqueta del recurso y el texto localizado de la acción.
- Se adapta al tipo de puntero y al tema.

Tanto las superficies de Conversation como las de Roleplay/Game deben pasar por el mismo coordinador. Los envoltorios específicos de cada superficie pueden aportar la geometría, pero no deben duplicar la política de capacidades.

### Integración de los paneles

Migra las filas arrastrables de forma incremental:

1. Personajes.
2. Lorebooks.
3. Agentes.
4. Personas.
5. Presets.
6. Conexiones.
7. Fondos, si el contrato de asignación existente se puede reutilizar de forma limpia.

Cada fila conserva su carga útil de arrastre de carpeta y añade la carga útil de recurso del chat. No cambies el comportamiento de movimiento de carpetas.

## Fases de entrega

### Fase 1: contrato de arrastre y superposición central

- Añade la utilidad de carga útil tipada y su analizador.
- Añade el resolutor puro de capacidades para personajes, lorebooks y agentes.
- Añade la superposición de la superficie central del chat y el coordinador de mutaciones.
- Integra las filas de panel de personaje, lorebook y agente.
- Añade texto localizado de acción, confirmación, éxito, error, duplicado y Undo.
- Asegura que los arrastres internos de recursos no disparen el resaltado de archivos del composer.

Esta fase demuestra el flujo de trabajo aditivo principal que pide la función.

### Fase 2: recursos de reemplazo

- Añade las cargas útiles de persona, preset y conexión.
- Añade la detección de reemplazo y los cuadros de diálogo de confirmación localizados.
- Reutiliza las restricciones de modo y los hooks de mutación existentes.
- Añade Undo protegido para las operaciones de reemplazo.

### Fase 3: asignación de fondo

- Determina si el flujo de elección del selector de fondos existente puede aceptar un ID de fondo soltado sin duplicar la política.
- Añade el arrastre de fondos solo si se puede reutilizar el mismo comportamiento de asignación con alcance de chat.
- Si no, deja los fondos sin admitir y anota el bloqueo en el issue o la pull request.

### Fase 4: paridad táctil y sin arrastre

El arrastrar y soltar de HTML en computadora es la primera vía de implementación. En el teléfono o la tableta no debe hacer falta arrastrar con precisión entre paneles.

- Añade `Add to active chat` a la superficie de acciones que ya tiene cada fila compatible.
- Reutiliza el mismo resolutor de capacidades, las mismas confirmaciones, mutaciones y comportamiento de Undo.
- Si se mantiene el arrastre táctil, usa las asas de arrastre táctil existentes y resuelve el destino central con `elementFromPoint`.
- No sobrecargues el comportamiento de pulsación larga de las carpetas de forma que la organización deje de ser fiable.

Esta fase es obligatoria antes de dar la función por completa en el teléfono o la tableta.

## Cambios de archivos previstos

Archivos nuevos probables:

- `packages/client/src/lib/chat-resource-drag.ts`
- `packages/client/src/lib/chat-resource-drop-capabilities.ts`
- `packages/client/src/hooks/use-chat-resource-drop.ts`
- `packages/client/src/components/chat/ChatResourceDropOverlay.tsx`

Archivos modificados probables:

- `packages/client/src/components/chat/ChatArea.tsx`, o el dueño compartido más acotado de la superficie central.
- `packages/client/src/components/chat/ChatRoleplaySurface.tsx`, si la geometría de la superficie lo exige.
- `packages/client/src/components/chat/ConversationView.tsx`, si la geometría de la superficie lo exige.
- `packages/client/src/components/chat/ChatInput.tsx`.
- `packages/client/src/components/chat/ConversationInput.tsx`.
- `packages/client/src/components/panels/CharactersPanel.tsx`.
- `packages/client/src/components/panels/LorebooksPanel.tsx`.
- `packages/client/src/components/panels/AgentsPanel.tsx`.
- `packages/client/src/components/panels/PersonasPanel.tsx`.
- `packages/client/src/components/panels/PresetsPanel.tsx`.
- `packages/client/src/components/panels/ConnectionsPanel.tsx`.
- `packages/client/src/components/panels/settings/BackgroundPicker.tsx`, solo en la fase 3.
- `packages/client/src/localization/locales/en.json`, o la ruta canónica del catálogo en inglés que esté en uso al implementarlo.

No se esperan cambios en el servidor ni en el paquete compartido para las fases 1 y 2. Si al implementar se descubre que una operación no puede usar las rutas de parcheo de chat existentes, detente y redimensiona el plan, en lugar de introducir un prompt oculto o un contrato de persistencia.

## Requisitos de accesibilidad y de entrada

- No dependas solo del color; muestra el icono del recurso y el texto de la acción.
- No exijas pasar el cursor para descubrir el equivalente sin arrastre.
- Las confirmaciones se pueden navegar con el teclado y devuelven el foco al cerrarse.
- Esc cancela una confirmación pendiente.
- Los lectores de pantalla reciben un aviso breve cuando aparece un destino de soltado válido y cuando una operación tiene éxito o falla.
- Las superposiciones de arrastre no deben interceptar el desplazamiento normal cuando no hay ningún arrastre reconocido activo.
- Los destinos táctiles respetan los tamaños mínimos actuales para teléfono y tableta.
- Quienes usan movimiento reducido reciben cambios de opacidad y de estado sin movimiento innecesario.

## Localización

Todo el texto visible nuevo usa claves de localización semánticas. Actualiza solo el catálogo canónico en inglés; los idiomas de la comunidad pueden recurrir al inglés.

Las categorías de texto incluyen:

- Etiquetas de acción para cada clase de recurso.
- Confirmaciones de reemplazo.
- Confirmación para activar agentes.
- Toasts de éxito y de fallo.
- Mensajes de Undo y de Undo obsoleto.
- Avisos de accesibilidad.
- Aviso de duplicado o de recurso ya activo, si se muestra.
- Acciones `Add to active chat` sin arrastre.

## Pruebas

No dejes archivos temporales `.test.ts` en el repositorio.

### Cobertura de regresión pura

Añade cobertura permanente del resolutor de capacidades solo en una ubicación y un formato de prueba de regresión ya admitidos:

- Personaje ausente -> acción de añadir.
- Personaje ya presente -> ninguna acción.
- Carga útil mixta con varios personajes -> añadir solo los IDs válidos que falten.
- Lorebook ausente -> acción de añadir.
- Lorebook ya activo -> ninguna acción.
- Agente ausente con los agentes activados -> acción de añadir.
- Agente ausente con los agentes desactivados -> acción de añadir que exige activarlos.
- Agente no disponible -> ninguna acción.
- Persona sin persona actual -> acción de fijar sin reemplazo.
- Persona que reemplaza a otra -> acción de reemplazo.
- Preset en un modo no admitido -> ninguna acción.
- Conexión igual a la conexión actual -> ninguna acción.
- Versión no válida, clase desconocida, IDs mal formados y carga útil demasiado grande -> rechazados.

### Cobertura de smoke en el navegador

Amplía `pnpm smoke:ui` donde sea práctico:

- Arrastra un personaje del panel a la superficie del chat y verifica la asignación.
- Usa Undo y verifica que se restaura la lista de personajes anterior.
- Verifica que arrastrar un personaje sobre el composer no muestra el aviso de soltar archivos.
- Arrastra un archivo compatible sobre el composer y verifica que el comportamiento de los adjuntos sigue intacto.
- Verifica que un recurso ya activo no tiene ningún destino de soltado activo.
- Verifica que una confirmación de reemplazo se cancela sin mutación.
- Verifica que un reemplazo confirmado actualiza el chat.
- Verifica que arrastrar y soltar en carpetas sigue moviendo recursos dentro del panel.

### Verificación manual

Verifica en computadora en los modos Conversation, Roleplay y Game donde estén admitidos:

- Temas oscuro y claro.
- El panel derecho abierto con una transcripción larga o desplazada.
- Soltado aditivo, soltado duplicado, reemplazo, cancelación, fallo, Undo y Undo obsoleto.
- Movimiento del arrastre por elementos anidados de la transcripción sin parpadeo de la superposición.
- El movimiento de carpetas del panel que ya existe.
- El soltado de archivos e imágenes que ya existe en ambos composers.

Verifica en una ventana de teléfono o de puntero grueso:

- La paridad de `Add to active chat` sin arrastre.
- El arrastre táctil de carpetas existente sigue siendo usable.
- Las confirmaciones caben y se pueden cerrar.
- Ningún texto ni control se superpone.

Comandos obligatorios:

```bash
pnpm localization:check
pnpm check
pnpm regression:prompt
pnpm smoke:ui
```

`pnpm regression:prompt` es obligatorio antes de fusionar: el cambio de `LorebooksPanel.tsx` afecta a la activación de lorebooks, que alimenta el ensamblaje del prompt.

## Riesgos y mitigaciones

### Conflicto con el arrastre de carpetas existente

Riesgo: esas mismas filas ya usan arrastrar y soltar para mover elementos a carpetas.

Mitigación: conserva los tipos MIME de carpeta existentes, añade un tipo MIME tipado aparte para los recursos del chat y deja que cada destino interprete solo su propia carga útil. Verifica el comportamiento de `copyMove` y las regresiones de carpetas.

### Resaltado falso del composer

Riesgo: los manejadores de `dragover` actuales del composer reaccionan a cualquier arrastre, incluidos los IDs internos de recursos.

Mitigación: activa el aviso del composer solo cuando `DataTransfer.types` o `DataTransfer.items` indiquen archivos u otra carga útil de adjunto admitida de forma explícita.

### Estado de chat obsoleto

Riesgo: el chat activo o los recursos asignados pueden cambiar entre el inicio del arrastre, el soltado, la confirmación y el Undo.

Mitigación: resuelve contra el estado actual al soltar y otra vez antes de la mutación o del Undo. Protege el Undo para que no sobrescriba cambios más nuevos.

### Desviación de la política de modo

Riesgo: arrastrar y soltar podría permitir una asignación que la interfaz de configuración y ajustes prohíbe.

Mitigación: extrae o reutiliza predicados compartidos de los flujos de asignación existentes. No escribas a mano una segunda matriz de políticas dentro de los componentes de panel.

### Expansión oculta del comportamiento

Riesgo: aceptar recursos visualmente en el composer podría dar a entender un contexto de un solo turno que el servidor no respeta.

Mitigación: mantén desactivado el soltado de recursos en el composer hasta que exista un contrato de contexto con alcance de mensaje diseñado por separado.

### Soltado de selecciones grandes

Riesgo: arrastrar en modo de selección podría añadir un conjunto de personajes, lorebooks o agentes inesperadamente grande.

Mitigación: filtra los IDs no válidos o ya activos, respeta los límites existentes del servidor o del modo, y exige confirmación cuando un soltado de varios elementos cruce un umbral existente. No inventes un límite arbitrario nuevo.

## No objetivos explícitos

- Soltar un recurso sobre un mensaje del historial.
- Cambiar de forma retroactiva el historial del prompt.
- Añadir los cambios de configuración como mensajes de la transcripción.
- Personajes, lorebooks, personas, presets, conexiones o agentes de un solo turno.
- Invocar un agente soltándolo en el composer.
- Iniciar un chat nuevo al soltar en la superficie central.
- Arrastrar ajustes arbitrarios al chat.
- Una API genérica de soltado de complementos en la primera versión.
- Arrastrar entre chats, de la transcripción de un chat a otra.

## Criterios de aceptación

La fase 1 es aceptable cuando:

- Un personaje, lorebook o agente se puede arrastrar desde su fila del panel derecho hasta una superficie de chat activo válida.
- Se actualiza el campo de chat correcto que ya existe, sin crear un mensaje en la transcripción.
- No se aceptan los recursos ya activos ni los no disponibles.
- Añadir un agente con los agentes desactivados exige una confirmación explícita.
- Cada mutación con éxito ofrece un Undo protegido.
- Los arrastres de recursos no disparan el aviso de adjuntos del composer.
- El soltado de archivos adjuntos que ya existe sigue funcionando en ambos composers.
- El comportamiento de arrastrar y soltar en carpetas no cambia.
- Todo el texto visible nuevo está localizado.
- La computadora y el teléfono tienen acciones equivalentes, aunque en el teléfono se use una acción de menú en lugar de arrastrar entre paneles.
- Pasan `pnpm localization:check`, `pnpm check` y las pruebas de smoke de interfaz pertinentes.

La función completa es aceptable cuando también estén listos los recursos de reemplazo de la fase 2 y la paridad obligatoria en el teléfono. La asignación de fondo sigue siendo opcional hasta que la fase 3 confirme que su semántica actual se puede reutilizar sin duplicar la política.

## Ampliación aplazada

Una futura función de contexto con alcance de mensaje podría hacer que los personajes, lorebooks, agentes, personas, presets o conexiones sean válidos al soltarlos en el composer. Ese trabajo requiere un contrato aparte de shared/servidor que defina la persistencia, el ensamblaje del prompt, el presupuesto de tokens (fragmentos de texto), el enrutamiento de proveedores, la visualización, la restauración del borrador y la semántica del historial de mensajes. No debe colarse en esta función como etiquetas solo del cliente.
