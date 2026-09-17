# Hoja de ruta del combate del Game Mode

Este documento recoge la dirección acordada para [terreno híbrido #6265](https://github.com/Pasta-Devs/Marinara-Engine/issues/6265) y el trabajo posterior de combate. Distingue lo planeado del juego actual. La implementación comienza en `staging`; no afirma que todas las capacidades siguientes ya estén publicadas.

## Separar participación y reglas del campo de batalla

Los valores actuales de `combatStyle` son `classic` y `tactical`. Consérvalos. Las futuras invocaciones pertenecen a una opción de participación separada, con combate de grupo como valor predeterminado para configuraciones y partidas guardadas antiguas. Los presets de creación pueden establecer ambas opciones sin introducir otra enumeración de modo persistente:

| Preset | Participación | Campo de batalla |
| --- | --- | --- |
| Grupo | Jugador y compañeros | Menús Classic |
| Invocación (planeada) | Criaturas controladas; entrenador fuera del combate | Menús Classic |
| Táctico | Jugador y compañeros | Cuadrícula Tactical |
| Invocación táctica (más adelante) | Criaturas controladas; entrenador fuera del combate | Cuadrícula Tactical |

No muestres combinaciones incompletas. Los compañeros narrativos y las unidades de combate son distintos; la posición del primer miembro en un arreglo no debe convertirse en la identidad permanente del personaje controlado.

## Prioridad actual: terreno híbrido

El GM aporta una descripción pequeña y estructurada basada en la escena. El motor resuelve terreno y posiciones exactas con una semilla, valida el tablero y guarda el resultado. Después, el GM describe el campo aceptado. Los movimientos y ataques habituales no requieren llamadas al modelo.

Amplía el flujo existente de entorno y formación con tamaño opcional, puntos de referencia, indicaciones del jugador y una semilla reutilizable. Conserva la validez de las configuraciones antiguas. Guarda la cuadrícula aceptada y la procedencia del generador para que cambios futuros no redibujen batallas existentes. Las semillas guardadas reproducen la generación con la misma descripción y combatientes; no vuelven determinista cualquier salida del modelo.

El terreno generado puede repararse para mantener la conectividad, pero las restricciones del autor no deben desaparecer silenciosamente. Limita la salida del modelo, las cantidades de casillas y unidades y las dimensiones de los elementos. Rechaza distribuciones imposibles con una razón que permita actuar y ofrece una alternativa generada explícita. El editor completo para pintar y colocar y los mapas arbitrarios son trabajos posteriores y deben usar las mismas validaciones.

### Capacidades de movimiento

Caminar, volar y teletransportarse necesitan reglas explícitas. Vuelo y teletransporte pueden cruzar muros, agua y montañas y evitar el costo adicional del bosque. Las bonificaciones de defensa y evasión son independientes del movimiento.

Omitir el modo implica caminar para los encuentros antiguos. Un modo no compatible indicado explícitamente se rechaza con un error; no sustituyas silenciosamente una capacidad solicitada por caminar. Este contrato se aplica a los planos generados y a las entradas de la API táctica.

Separa tránsito, destinos legales y ocupación. Teletransportarse a través de un muro no permite terminar dentro de él. La cuadrícula plana inicial no representa altitud, techos, requisitos de visión de hechizos ni duración limitada del vuelo; documenta ese límite en lugar de afirmar compatibilidad con todas las reglas de mesa. Reutiliza la misma legalidad de movimiento en vistas previas, resolución, animación de rutas e IA enemiga.

## Reglas de mesa: perfiles integrados y herramientas de referencia del GM

Prioriza partidas similares a 5e y V20 sobre un juego completo de colección de criaturas. Añade después perfiles acotados y versionados. Elige una edición exacta y un subconjunto compatible antes de presentar un perfil como implementación de ese reglamento.

El motor debe gestionar tiradas reales, objetivos legales, movimiento, presupuestos de acciones, consumo de recursos y resultados numéricos. El GM interpreta la ficción, elige una operación compatible, aporta intenciones de PNJ y narra el resultado real. El texto recuperado de lorebooks puede aportar referencias y reglas de campaña, sin eludir el resolvedor ni reescribir tiradas.

[El issue #5955](https://github.com/Pasta-Devs/Marinara-Engine/issues/5955) cubre la recuperación semántica de lorebooks y un acceso opcional por herramientas. La recuperación complementa los perfiles: ayuda al GM a encontrar información relevante, mientras que los perfiles explícitos hacen consistentes y comprobables las mecánicas frecuentes. Evita una consulta separada para cada tirada habitual.

Empieza por primitivas compatibles de pruebas, turnos y recursos. Un perfil de d20 y uno de reservas de d10 requieren reglas de resolución distintas; uno no es el otro con nuevo nombre. La cobertura futura debe incluir iniciativa, pruebas enfrentadas, daño y mitigación, estados y recursos. Documenta casos no compatibles y deja explícito el arbitraje del GM.

El juego táctico de mesa también necesita reglas comunes de línea de visión y cobertura. La cuadrícula actual bloquea el movimiento por muros, pero los ataques a distancia basados en distancia pueden atravesarlos. Actualiza juntos resolvedor, IA, contraataques, previsiones e indicadores de amenaza. Conserva las fases actuales del grupo y del enemigo; la iniciativa individual es un perfil de reglas seleccionable separado.

## Invocaciones: conservar el diseño, posponer el sistema mayor

Una primera entrega puede ser pequeña: una criatura activa por bando, reservas propias, un entrenador no combatiente, un cambio voluntario que consume la orden y una pausa persistente de reemplazo tras quedar fuera de combate. La derrota llega cuando no queda ninguna criatura desplegable. Los objetos del entrenador no deben conceder otra acción a la criatura.

Mantén una sola plantilla indexada por identificadores estables, más los identificadores de puestos activos. Deriva reservas y estados de incapacidad en lugar de mantener arreglos competidores. Los PS, recursos y estados de criaturas propias persisten; el generador de encuentros no debe reinventarlos en cada pelea. Define explícitamente la evolución de estados en las reservas.

Captura, evolución, crianza, combates dobles, duración temporal de invocaciones e invocaciones tácticas son adiciones separadas. El resumen del GM debe distinguir una criatura fuera de combate de un entrenador herido.

## Persistencia y pruebas

Fija las reglas efectivas al comenzar la batalla. Los nuevos campos opcionales deben conservar las partidas Classic y Tactical antiguas. Importaciones, instantáneas inmutables de creación y resúmenes deben preservar las nuevas elecciones. Recarga, reinicio, traslado a la siguiente sesión, variantes de respuesta, ramificación y restauración de puntos de control necesitan cobertura explícita individual.

El futuro estado de batalla del servidor debe aplicar juntos los cambios de batalla y plantilla, con identificadores de encuentro, revisiones e identificadores de acción idempotentes. Reutiliza colas de escritura donde corresponda. Audita los espacios de nombres de juegos por turnos y Experiences antes de reutilizar `game_engine_state`; no es automáticamente un almacén seguro para combate.

Para cada regla, añade la prueba ejecutable `*.regression.ts` más pequeña, con acciones rechazadas y entradas antiguas. La prueba en navegador debe cubrir configuración, una acción táctica real, recarga, pantallas pequeñas, contraste de temas, foco y teclado y errores útiles. Mantén localización y documentación junto a la implementación.

## Trabajo previo y puntos de entrada

[El PR #4391, cerrado sin fusionar](https://github.com/Pasta-Devs/Marinara-Engine/pull/4391), en `feat/game-mode-combat-expansion`, contiene una ampliación mayor de sesiones, maniobras, objetivos y jefes. Es una referencia útil, no el comportamiento actual de staging. Revisa responsable y estado antes de retomarlo; no fusiones toda la ampliación como requisito para el terreno.

Los archivos principales de Engine son `packages/shared/src/features/tactical-combat/`, `packages/server/src/routes/encounter.routes.ts`, `packages/server/src/routes/game.routes.ts`, `packages/client/src/components/game/GameSetupWizard.tsx`, `GameSurface.tsx` y `TacticalCombatUI.tsx`. Las definiciones de agentes y Experiences descargables y sus prompts propios corresponden a Marinara-Agents si trabajos posteriores los afectan.
