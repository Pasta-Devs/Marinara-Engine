# Arquitectura de Game Mode: conjuntos de reglas, pruebas y combate

Este es el mapa para quien vaya a cambiar el código de reglas de Game Mode: dónde se lee un conjunto de reglas, cómo se resuelven una prueba y una pelea, dónde se conserva el estado y qué necesita una nueva clave del conjunto de reglas. La documentación para jugadores está en `docs/game/`, la guía para autores de conjuntos de reglas comienza en [`docs/extending/writing-rulesets.md`](../extending/writing-rulesets.md), y la IA de combate tiene su propia página, [IA de combate de Game Mode](game-combat-ai.md).

## Dónde está cada cosa

| Área | Código |
| --- | --- |
| El formato del conjunto de reglas | `packages/shared/src/schemas/ruleset.schema.ts`: el esquema zod, `RulesetRef` (la referencia fijada) y las comprobaciones cruzadas que ejecuta una importación. El esquema JSON del editor, `docs/extending/ruleset.schema.json`, se genera a partir de él con `pnpm ruleset:schema`. |
| Capability API | `supportedCapabilityApi` en `packages/shared/src/schemas/capability-package.schema.ts`, con una línea de comentario por versión menor que indica qué añadió. |
| Cálculos de la ficha y estado vivo | `packages/shared/src/features/rulesets/`: `sheet-math.ts`, `live-state.ts` (las operaciones de `[sheet:]`), `sheet-commands.ts`, `sheet-builder.ts`, `layers.ts`, `item-*.ts`, `loot.ts`, `market.ts`, `combat-bridge.ts` (el bloque `battle`). |
| Peleas del conjunto de reglas | `packages/shared/src/features/ruleset-combat/`: `resolve.ts`, `options.ts` (lo que aparece en el menú), `grid.ts`, `sight.ts`, `zones.ts`, `creatures.ts`, `pool.ts`, `symbols.ts`, `dice.ts`. Todas son funciones puras sobre `(definition, state)`. |
| Combate propio de Marinara | `packages/shared/src/features/tactical-combat/` (motor de Tactical, generación de cuadrícula, IA), `combat-director.ts`, `combat-conditions.ts`. |
| IA de combate | `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`; consulta [IA de combate de Game Mode](game-combat-ai.md). |
| Servidor: conjuntos de reglas | `packages/server/src/services/game/ruleset-registry.service.ts` (lee los conjuntos de reglas instalados e importados, resuelve la referencia fijada de una partida), `ruleset-catalog.service.ts`, `ruleset-sheet-turn.service.ts` (aplica los comandos `[sheet:]` de un turno), `game-ruleset-version.service.ts`, `routes/game-rulesets.routes.ts`. |
| Servidor: pruebas y dados | `skill-check-resolution.service.ts`, `skill-check.service.ts`, `dice.service.ts`, `dice-pool.service.ts`, `one-request-dice.ts`, `dice-rng.ts`. |
| Servidor: peleas | `combat-director.service.ts` (Classic y Tactical), `combat.service.ts` (los cálculos de ronda de Classic, `resolveCombatRound`), `ruleset-combat-director.service.ts` (una pelea que resuelve el conjunto de reglas), `combat-ai.service.ts`, `combat-boss.service.ts`, `tactical-battlefield.service.ts`, `made-battlefield.service.ts`. Rutas: `routes/combat-director.routes.ts` (inicio, estado y comando del director), `routes/encounter.routes.ts`, y las antiguas `POST /game/combat/round`, `/game/combat/tactical/start` y `/game/combat/tactical/action` en `routes/game.routes.ts`. |
| Prompt (las instrucciones enviadas a la IA) | `gm-prompts.ts` (`buildGmFormatReminder`, los bloques de ficha y las etiquetas enseñadas). |
| Cliente | `packages/client/src/components/game/`: `GameRulesetSheet.tsx`, `GameSetupRulesChooser.tsx`, `RulesetCombatScreen.tsx` y los demás `RulesetCombat*.tsx`, `TacticalCombatUI.tsx`, `GameCombatUI.tsx`, `DirectedCombatUI.tsx`. |

## Un conjunto de reglas, del paquete a la partida

1. **Origen.** Un conjunto de reglas oficial es un paquete de capacidades de tipo `ruleset` que incluye `ruleset.json` (y cualquier `catalogs/<id>.json`) en `contributions.assets.paths`, fijados por hash en `files[]`. Un conjunto de reglas de la comunidad se importa como un archivo único, un archivo de paquete `<name>.ruleset.json`, o desde la carpeta `rulesets/` de un repositorio, y se almacena con un id con espacio de nombres (`local/<id>`, `<owner>/<id>`) para que nunca pueda ocultar uno oficial.
2. **Idioma.** Las traducciones de un conjunto de reglas oficial son paquetes por idioma enumerados en su entrada de catálogo; el gestor de paquetes conserva solo el idioma de Engine (`syncRulesetLocalePack` en `package-manager.service.ts`). Un archivo de paquete importado conserva solo el idioma activo al importarlo.
3. **Registro.** `ruleset-registry.service.ts` analiza cada definición con el esquema compartido y descarta las que no se pueden utilizar, con una línea de registro. Las definiciones se almacenan por id y versión; se rechaza una misma versión con bytes diferentes.
4. **La referencia fijada.** Al crear la partida se escribe `chat.metadata.gameRuleset` una vez: `{ id, version, packageId, source?, options }`, donde `options` contiene las capas elegidas. Sin referencia fijada se usan las reglas propias de Marinara. Si esta instalación no puede satisfacer una referencia fijada (porque falta o es anterior a la versión fijada), se informa de ello y las pruebas de la partida quedan pendientes; nunca se resuelven con las reglas de otro sistema.

## Estado

| Parte | Contenido | Dónde | Retrocede con los swipes (respuestas alternativas) |
| --- | --- | --- | --- |
| Configuración inicial | La ficha que un jugador completa en una tarjeta o persona | Tarjeta `data.extensions.rulesetSheets[rulesetId]`, persona `personaStats.rulesetSheets[rulesetId]` | No corresponde |
| Configuración de la partida | Una copia tomada durante la configuración, editada con **Edit sheet** (Editar ficha) y al subir de nivel | `chat.metadata.gameCharacterCards[].rulesetSheet` | No |
| Estado vivo | Reservas, contadores, estados de condición, estados, notas | `game_state_snapshots.ruleset_live` | Sí |
| Una pelea | El encuentro, su semilla y cursor de dados, de quién es el turno | La fila de almacenamiento del director de combate, una por chat | Se restaura con el turno que la inició |

El estado vivo pertenece a la instantánea para que un turno regenerado nunca gaste dos veces. Una ficha almacenada es `{ v, build }`, tiene un límite de 64 KB y se lee de forma tolerante: los campos desconocidos se conservan y los que faltan toman valores predeterminados. Una disposición que mueve valores a nuevos ids declara `sheet.migrations`, que `readRulesetSheetEnvelope` y `readStoredLiveState` aplican al leer. Una ficha de un conjunto de reglas que no está instalado se mantiene inactiva; nunca se descarta.

## Una prueba, de principio a fin

1. El Game Master escribe `[skill_check: …]`, opcionalmente con `who=`, `with=`, el nombre de un paso de la escala, un encanto o un gasto. Con los dados de una sola solicitud activados, puede escribir en su lugar un bloque de rama o un marcador de posición `[[roll: …]]` (`one-request-dice.ts`).
2. `skill-check-resolution.service.ts` lee el conjunto de reglas fijado y selecciona el procesamiento según `resolution.kind`: `dice-sum`, `dice-pool`, `dice-highest`, `roll-against` o `symbol-pool`. Los números que escribió el modelo se auditan y reemplazan, salvo que el conjunto de reglas los avale; las reservas, los dados conservados y los resultados por bandas nunca se avalan.
3. Dados: una prueba tira con `rollDieSecurely` (Web Crypto, en `packages/shared/src/utils/dice-notation.ts`). Una pelea del conjunto de reglas, sus usos de objetos, botín y mercados tiran con `seededDieRoller(seed, cursor)` del mismo módulo, de modo que una pelea se reproduce a partir de su semilla. Desde #8608 no hay otra función de tirada.
4. El resultado se escribe de vuelta como una etiqueta completa y una tarjeta de dados, y se registra en **Logs** (Registros).

## Comandos de ficha

El Game Master cambia una ficha con `[sheet: who="Name" op="…"]`. Las operaciones que puede indicar una etiqueta son `spend`, `restore` (alias `heal`), `damage`, `temp`, `track`, `condition`, `state`, `note`, `rest`, `use` (alias `cast`), `pass`, `advance`, `dismiss`, `prepare` y `unprepare` (`RULESET_SHEET_OP_NAMES` y `RulesetSheetOp` en `live-state.ts`). `ruleset-sheet-turn.service.ts` valida cada una contra la ficha viva; una que no puede realizarse, como un lanzamiento sin espacios restantes, se rechaza, se registra y se muestra una vez por turno, y nada se aplica a medias. `sheet` es una etiqueta reservada del GM.

## Una pelea, de principio a fin

La pelea de una partida se juega en uno de tres estilos, elegidos por el conjunto de reglas y la **Combat Preference** (Preferencia de combate) de la partida:

| Conjunto de reglas | Estilo | Servidor |
| --- | --- | --- |
| Ninguno, o sin bloque `battle`/`combat` | Combate Classic o Tactical de Marinara | `combat-director.service.ts` |
| Bloque `battle` | Combate de Marinara, que toma prestadas las reservas, ranuras y habilidades de catálogo de la ficha; la salud se traslada como una proporción del máximo y se escribe de vuelta | `combat-director.service.ts` con `combat-bridge.ts` |
| Bloque `combat` | La pelea propia del conjunto de reglas, en un tablero cuando `combat` indica la distancia de una casilla y la partida es Tactical | `ruleset-combat-director.service.ts` |

Los tres comparten el registro del director: una fila de almacenamiento por chat, una revisión, una protección por id de solicitud y una cola por chat. El registro cubre solo las peleas gestionadas por el director. Las rutas antiguas de `game.routes.ts`, `POST /game/combat/round` (que llama a `resolveCombatRound` sobre los combatientes que recibe), `/game/combat/tactical/start` y `/game/combat/tactical/action`, no mantienen un registro: el cliente conserva el estado de la pelea y lo envía de vuelta con cada llamada. En una pelea del conjunto de reglas, el menú decide la legalidad (`options.ts`), el resolutor aplica una elección (`resolve.ts`), los dados provienen de la semilla y el cursor de la pelea, y todo lo que un miembro del grupo gasta o pierde se escribe mediante las reglas propias de la ficha, de modo que cerrar la pestaña a mitad de la pelea no pierde nada. Los oponentes que nadie ha creado se construyen a partir del bestiario y el presupuesto de encuentro del conjunto de reglas; el Game Master puede controlar a los oponentes con nombre y a los jefes, eligiendo entre las sugerencias ordenadas por puntuación de Engine.

## Añadir una clave del conjunto de reglas

1. Añádela a `ruleset.schema.ts`, con sus comprobaciones cruzadas, y a los tipos de TypeScript que lee el resolutor.
2. Incrementa `supportedCapabilityApi` en una versión menor y añade su línea de comentario. Restringe la clave para que un conjunto de reglas que la use deba declarar esa versión menor o una más reciente.
3. Impleméntala primero en el código compartido puro, luego conecta el servidor y después el cliente.
4. Ejecuta `pnpm ruleset:schema` para regenerar `docs/extending/ruleset.schema.json`.
5. Documéntala en la página correspondiente de la guía para autores (`docs/extending/ruleset-*.md`), y en la documentación para jugadores si la verán.
6. Añade un `scripts/regressions/*.regression.ts` que la ejercite a través del código puro e incluya una entrada rechazada.
7. Enumera las páginas en inglés modificadas en la incidencia abierta de `[docs-i18n]`.

`docs/development/ruleset-5e-2014.example.json` es un borrador reducido de 5e que cientos de pruebas de regresión y de extremo a extremo leen como datos de prueba. No es el paquete SRD distribuido, que está en Marinara-Agents, bajo `packages/ruleset-5e-2014/`.

## Trabajo pendiente

- Volar sobre obstáculos en un tablero del conjunto de reglas: quien vuela se mueve como cualquier otra unidad.
- Invocación en el combate propio de Marinara en Classic y Tactical (las peleas de los conjuntos de reglas ya invocan). El diseño está en [IA de combate de Game Mode](game-combat-ai.md#summoning-design-extension).
- Un agente Battlefield Scout que prepara el informe del terreno de una pelea, descrito en [IA de combate de Game Mode](game-combat-ai.md#encounter-environment-agent-handoff).
