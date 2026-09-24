# Reglas de combate versionadas: guía para la implementación

> **Estado, 19 de septiembre de 2026.** El adaptador `5e-2014` reservado en este documento se está construyendo como un tipo de combate BASADO EN DATOS, en vez de un adaptador TypeScript por sistema: el conjunto declara un bloque `combat` opcional y el motor posee el tipo que lo resuelve, igual que posee los tipos de resolución de pruebas. Los motivos, la arquitectura y las etapas están en `game-rulesets-and-sheets-implementation.md` § Real ruleset combat, y el trabajo se sigue en el [issue #6361](https://github.com/Pasta-Devs/Marinara-Engine/issues/6361). El resto sigue vigente: el conjunto Traditional y su comportamiento de velocidad aceptado, el contrato de producto, la regla de que la dificultad pertenece al conjunto y nunca se convierte en multiplicador de daño, el único registro del director controlado por el servidor, las ventanas de reacciones y acciones legendarias, y el contrato de guardado, interfaz y despliegue.
>
> Desde C3a el tipo está CONECTADO: resuelve el combate en el registro existente del director como tercer `style` junto a `classic` y `tactical`, con la misma revisión, idempotencia, exclusión mutua y única llamada al modelo para elegir un ID de candidato. Desde C3b está EN PANTALLA: un conjunto con `combat` combate en la interfaz Classic con su menú, sus palabras y los cálculos reales en el registro; las fichas se guardan durante el combate, no después. Desde C4a tiene POSICIONES: `combat.distance` permite combatir en el tablero generado del motor táctico, con movimiento, alcance, distancias, áreas de explosión, cono y línea, línea de visión, cobertura y ataques a quien se aleja, todo resuelto con las cifras del conjunto, y un adversario que se mueve. Desde C4b el tablero está EN PANTALLA: se juega sobre el terreno del estilo táctico; las casillas alcanzables y sus costes, los caminos, a quién provoca cada paso, los objetivos válidos y dónde apuntar cada área proceden de la vista del servidor y se expresan en la distancia del conjunto. Las reacciones y las ventanas de acciones especiales todavía llegarán en C5.
>
> El campo se dibuja en pantalla desde C4b. Desde C5a un TURNO puede hacer lo que un turno de mesa: un golpe puede llevar otra cláusula de daño; una acción puede comprar varios ataques; una habilidad puede no gastar presupuesto, devolverlo o permitir comprar una acción estándar con otro presupuesto; un efecto adicional puede aplicarse al primer golpe válido de un período; y un estado puede alterar las salvaciones de su portador, reducir todo daño a la mitad, impedir atacar o acercarse a quien lo aplicó, contar solo mientras esa persona esté a la vista o terminar cuando caiga. Desde C5b el combate puede QUEDAR EN ESPERA: salir del alcance de alguien detiene el movimiento donde está y le pregunta si quiere atacar, en vez de hacerlo por él; el intervalo entre actores se detiene y pregunta a cada bloque con puntos si quiere comprar una de sus acciones. Mientras una ventana esté abierta, nada más avanza; el combate retoma exactamente donde se detuvo. Desde C5c una entrada de catálogo indica QUÉ momento espera: `aimed`, antes de que algo alcance a su portador, puede cancelarlo; `harmed`, después de recibir daño, apunta de vuelta a quien lo causó. El coste se paga antes de preguntar: cancelar una acción impide que ocurra, no que se haya comprado. Las cadenas llegarán después: hay una sola ventana, no una pila, por lo que un contraataque no puede ser contrarrestado.

Estado: propuesta de implementación, 17 de septiembre de 2026. La renovación de IA no implementa estas reglas. El ataque adicional por velocidad de Traditional es una dirección de producto aceptada; los umbrales y demás valores siguientes son propuestas de ajuste. Implementa sobre `staging` actual, después de revisar el trabajo relacionado.

## Contrato de producto

Mantén independientes cuatro elecciones:

| Elección | Qué controla | Ejemplos |
| --- | --- | --- |
| Presentación | Información espacial y entrada | Menús Classic; cuadrícula Tactical |
| Participación | Quién combate | Grupo; futuro Summoning |
| Reglas | Acciones legales, recursos, tiempos de turno, resolución | Traditional; 5e con versión explícita; V20 |
| Controlador | Quién elige una acción legal | Jugador; IA local; jefes GM |

Un Cautious Mage debe seguir siendo cauteloso en ambas presentaciones. Cambiar las reglas cambia lo que puede hacer, no su personalidad. Summoning es un sistema de participación, no un tercer motor de reglas; su primera presentación puede ser no espacial. Ningún modo puede inventar distancias de cuadrícula sin un modelo de posiciones.

Muestra descripciones claras en la interfaz. Evita comparar Traditional o Tactical con otros juegos. Las reglas nombradas por un sistema implementado deben identificar la edición exacta y su cobertura.

### La dificultad debe pertenecer a las reglas

Los multiplicadores actuales de daño enemigo (Casual 0,6, Normal 1, Hard 1,3, Brutal 1,6) están previstos solo para Traditional. Revísalos al implementar alternativas: 5e, V20 y futuros adaptadores no deben heredarlos automáticamente. Define la dificultad con el modelo de encuentros y resolución de cada sistema. Separa el ajuste de decisiones de IA del escalado aritmético del daño. Añade una regresión del adaptador que demuestre que elegir otras reglas no aplica silenciosamente la tabla Traditional. Esta nota no convierte la mecánica heredada actual en un sistema Traditional ya implementado.

## Código actual y restricciones

- `packages/shared/src/types/game.ts`: `Combatant`, `CombatSkill`, resultados e instantáneas Classic. Las estadísticas actuales son números genéricos; `speed` no es Destreza de un juego de mesa ni pies de movimiento.
- `packages/server/src/services/game/combat.service.ts`: Classic tira iniciativa cada ronda, resuelve una orden por participante y usa fórmulas genéricas de daño. Las partidas heredadas intercambian estado mediante el cliente; las nuevas del asistente usan el registro del director de combate propiedad del servidor.
- `packages/shared/src/features/tactical-combat/{engine,math,types}.ts`: fases alternadas de grupo/enemigos, alcance por clase y movimiento derivado de velocidad, contraataques, todavía sin ataque adicional por velocidad.
- `packages/shared/src/features/combat-ai.ts` y adaptadores de modo: prioridades entre acciones disponibles. La IA ordinaria conserva sus límites de información; los jefes GM reciben hojas/recursos del grupo para anticiparse, pero ninguno ve tiradas futuras ni elecciones del jugador antes de declararlas.
- `packages/server/src/routes/combat-director.routes.ts` y `services/game/combat-director.service.ts`: estado autorizado versionado del encuentro, cursor de activación, reacciones pendientes, presupuestos legendarios y protección contra respuestas duplicadas/obsoletas. Amplía esta ruta de acciones aceptadas para los adaptadores; no crees otro registro. La probabilidad actual de Counterspell, el pago de slots y el costo de cancelación son políticas genéricas de Engine, no reglas 5e.
- `packages/server/src/routes/game.routes.ts`: validación heredada de ronda/inicio/acción. `GameCombatUI`, `TacticalCombatUI` y `use-game.ts`: entradas, previsiones, resultados aceptados y persistencia.
- `GameSurface.tsx`: hidratación de esquemas generados e instantáneas de combate. `encounter.routes.ts`: prompt (las instrucciones enviadas a la IA) de generación de encuentros. `game-setup-share.ts`: importación/exportación de configuraciones reutilizables.

No renombres la fórmula actual como Traditional sin implementar y verificar la velocidad aceptada. Una tirada d20 más las estadísticas actuales de Engine no equivale a compatibilidad 5e.

## Arquitectura mínima

Empieza con un registro cerrado de adaptadores integrados puros en TypeScript. No añadas un lenguaje de scripts ni paquetes de reglas ejecutables arbitrarias. Reutiliza los tipos existentes de acciones legales y resultados; extrae una función compartida solo cuando ambos consumidores la necesiten.

Guarda una referencia fija en cada encuentro nuevo:

```ts
type RulesetRef = {
  id: "engine-legacy" | "traditional" | "5e-2014" | "v20";
  version: number;
  options: Record<string, boolean | number | string>;
};
```

Cada adaptador valida su propio esquema cerrado de opciones; no acepta sin límites el registro de ejemplo. Incluye capacidades admitidas (movimiento, contraataque, slots de hechizo, gasto de sangre, invocaciones, reacciones de jefes). Rechaza opciones explícitas no admitidas con un error útil. Sin datos de reglas se usa `engine-legacy`, nunca una migración automática a Traditional.

Una interfaz pequeña debe cubrir:

1. Validar/normalizar una hoja específica sin adivinar conversiones.
2. Iniciar un encuentro, tirar o establecer el orden una vez en el momento definido por las reglas.
3. Iniciar una activación: reponer presupuestos permitidos y actualizar estados pertinentes.
4. Enumerar acciones legales y reacciones opcionales, objetivos, alcance, costo y ventana, incluido pasar.
5. Producir una previsión de solo lectura sin consumir RNG.
6. Aceptar la declaración de acción, registrar el compromiso de recursos y abrir los disparadores admitidos antes de resolver efectos.
7. Resolver efectos/reacciones pendientes en eventos ordenados y cambios de recursos; abrir ventanas de jefe al inicio/después de activación solo si están habilitadas.
8. Terminar la ronda al agotarse sus participantes; avanzar una vez los efectos limitados por ronda.

El mismo adaptador alimenta la entrada del jugador, la IA ordinaria, los menús del GM y las previsiones. El GM no puede aportar HP final, IDs de habilidades inventadas, un orden nuevo ni recursos gratuitos. La legalidad usa estado aceptado; el contexto expone la información propia del controlador y de la ventana. Los jefes GM conocen habilidades, puntos/slots de hechizo, recargas e inventario usable para prever amenazas. Las selecciones no confirmadas y otras órdenes en cola siguen privadas hasta su declaración. Una previsión da valores esperados, no resultados futuros de dados.

Mantén las hojas específicas en una unión discriminada. No fuerces todos los recursos dentro de `mp`: MP, cantidad de slots, Blood Pool, Willpower, gastos por ronda y usos por descanso tienen semánticas distintas. Las barras y costos leen descriptores del adaptador elegido. Guarda recursos actuales y máximos por separado; normaliza nombres solo para mostrarlos, nunca como identidad del recurso.

## Traditional v1: velocidad aceptada

**Cada participante vivo y habilitado tiene como máximo una activación ordinaria y un inicio de intercambio por ronda. El ataque adicional por velocidad es otro golpe del mismo intercambio, no otra activación.**

Equilibrio inicial propuesto:

| Regla | Comportamiento v1 propuesto |
| --- | --- |
| Iniciativa | Speed efectiva descendente, desempate estable del encuentro; sin activación extra por empate o alta velocidad |
| Programación Tactical | Fase del grupo y luego enemigos; el jugador elige unidades aún sin actuar, las automáticas siguen velocidad |
| Programación Classic | Orden único descendente de Speed efectiva; se encolan órdenes manuales y se resuelven objetivos legales actuales en cada posición |
| Movimiento | Presupuesto explícito independiente de Speed. Sugerencia: 4 casillas, con ajustes acotados de clase/habilidad |
| Velocidad de ataque | Speed efectiva, solo con penalizaciones/bonificaciones modeladas; sin peso ficticio de armas |
| Umbral adicional | Velocidad de ataque del atacante al menos la del defensor + 5; configurable solo como opción validada |
| Acción habilitada | Ataque básico o habilidad marcada `allowsSpeedFollowUp`; falso de forma predeterminada para habilidades |
| Intercambio | Golpe inicial → contraataque legal del defensor superviviente → golpe adicional habilitado del iniciador superviviente |
| Defensor más rápido | Un contraataque legal en v1; su golpe adicional es otra opción de equilibrio, desactivada inicialmente |
| MP | Reserva explícita y costo por habilidad, descontado una vez por activación elegida; la habilidad debe especificar costos del golpe adicional |
| Renovación de movimiento | Una vez en la siguiente activación ordinaria; contraataque/golpe adicional nunca lo renuevan |

El umbral 5 y el orden son propuestas de Marinara, no una reproducción declarada de otro juego. La mantenedora pidió que la unidad atacante más rápida golpee dos veces; eso no exige duplicar golpes del defensor.

Entre golpes, vuelve a comprobar vida, validez del objetivo, alcance, incapacitaciones y presupuestos. Si el contraataque mata al iniciador, no hay golpe adicional. Fallar el primero no cancela por sí solo el adicional por velocidad. No golpees otra vez a un objetivo derrotado ni lo reemplaces silenciosamente en el mismo intercambio. Evita recursión entre contraataques. Contraatacar no gasta el inicio ordinario del defensor ni concede otro. Curación, mejoras, objetos, invocaciones y acciones legendarias no se duplican salvo una excepción explícita admitida.

Calcula la elegibilidad con estadísticas efectivas aceptadas al comenzar el intercambio; aplica inmediatamente incapacitaciones intermedias, pero no añadas golpes retroactivos tras una mejora de velocidad. Registra el resultado como eventos y muestra en la previsión uno o dos golpes y la posibilidad de contraatacar. Recargar durante la animación reproduce eventos aceptados; no vuelve a tirar ni a gastar.

Classic no tiene alcance de movimiento: omítelo o define por separado un modelo de enfrentamiento. Sus contraataques Traditional requieren una regla `canCounter`; no apliques distancias de cuadrícula a posiciones de un arreglo. Se recomienda dejarlos desactivados en v1 hasta definir enfrentamientos básicos cuerpo a cuerpo/a distancia, conservando el golpe adicional del atacante.

## Perfil 5e: identifica la edición antes de programar

Primer objetivo recomendado: `5e-2014`, fijado a SRD 5.1. Un perfil posterior 2024/SRD 5.2 necesita identificador/versión y pruebas propios; no mezcles ediciones silenciosamente. El [índice oficial SRD](https://www.dndbeyond.com/srd) publica las versiones y [SRD 5.1](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) es la referencia primaria inicial.

Revisa la fuente primaria antes de implementar: iniciativa por Destreza; movimiento medido en distancia; disponibilidad de acción, acción adicional y reacción; slots de hechizo; concentración y estados; tiradas de ataque y salvaciones distintas. Requieren campos propios y pruebas de resolución. Nivel/ataque/defensa genéricos no los sustituyen. Los puntos de hechizo son una variante seleccionada explícitamente con fuente revisada y límites propios, no una reserva de slots renombrada.

Publica primero un subconjunto honesto, como ataques básicos de armas, movimiento, Dodge y una lista pequeña de hechizos admitidos; las acciones no admitidas quedan indisponibles. Una fórmula de iniciativa no demuestra un sistema 5e completo. Mantén desactivada la duplicación Traditional; los ataques extra solo proceden de capacidades implementadas del perfil.

## Perfil V20: requiere auditoría propia

El objetivo es Vampire: The Masquerade 20th Anniversary Edition, no V5 ni V20 Dark Ages. Obtén la referencia primaria adecuada antes de programar iniciativa exacta, orden de declaración, acciones múltiples, Celerity, daño/absorción, penalizaciones por heridas y límites de gasto. Esta guía no aprueba ninguna fórmula exacta V20.

Reserva una hoja específica para Attributes/Abilities, niveles de salud, Blood Pool y Willpower, con límites por turno donde se admitan. No conviertas Blood Pool en MP genérico ni Celerity en duplicación de velocidad Traditional. Las pruebas deben citar edición y pasaje; un foro o avance de Dark Ages no basta para justificar V20 moderno. Resuelve reutilización y atribución con la fuente realmente elegida antes de distribuir texto o bloques de estadísticas copiados; este documento no aporta ese contenido.

## Acciones legendarias, anticipación y reacciones

Dirección aceptada: los jefes GM pueden tener acciones legendarias incluso con Traditional u otras reglas no 5e. Es un **modificador explícito de encuentro de jefe**, independiente de iniciativa ordinaria, temperamento y participación. Consulta la sección de jefes del diseño de IA.

El adaptador expone `afterActivation`; el modificador de anticipación Marinara habilitado también puede exponer `activationStarted` cuando el actor confirma iniciar turno. Ambas ventanas gastan la **misma** reserva finita. Clics, inspección, menús cancelados y recargas no abren ventanas extra. El GM puede prever Fireball a partir de habilidades/recursos del mago y reglas reales de área/fuego amigo antes de la declaración; no lee una orden futura. Es una regla casera añadida al momento posterior al turno de 5e y fijada explícitamente al encuentro. Un perfil fiel conserva el tiempo nativo salvo que se active el modificador.

La regla de un inicio Traditional se aplica a activaciones ordinarias; una acción legendaria creada explícitamente no da activación ordinaria ni golpe adicional por velocidad. Classic debe detenerse en la posición de iniciativa del actor, no interrumpir antes mientras la interfaz recoge órdenes de toda la ronda. Revalida las órdenes tras una interrupción y pide reemplazo si quedan ilegales antes del compromiso. Tactical necesita un inicio de activación distinto para inspeccionar con seguridad y evitar explotar reselecciones.

Reacciones como Counterspell corresponden a **disparadores de eventos** admitidos, independientemente de ser legendario. Define al menos evento, tiempo antes/después del efecto, visibilidad/alcance, costo, disponibilidad/renovación, resultado y cancelación/reembolso de la acción original. GM e IA ordinaria usan las mismas ventanas; las unidades manuales reciben React/Pass. La IA evalúa automáticamente y puede pasar según temperamento, amenaza, éxito esperado, escasez de MP/slots y costo de perder la reacción. Estar disponible nunca obliga a gastar. Una unidad ordinaria puede reaccionar sin convertirse en jefe.

Counterspell exige un lanzamiento pendiente, no solo seleccionar al mago. Separa MP/puntos/slots. El [hechizo de 2014](https://www.dndbeyond.com/spells/2051-counterspell) usa nivel de hechizo/prueba; el [de 2024](https://www.dndbeyond.com/spells/2619072-counterspell) usa salvación de Constitución y establece que un hechizo con slot interrumpido con éxito no gasta su slot. No apliques ese reembolso de 2024 a todas las ediciones ni al pago de quien reacciona. Traditional necesita una operación de interrupción explícita y ajustada; V20 debe mapear sus propias capacidades reactivas, no heredar Counterspell por nombre.

Reserva y compromete recursos atómicamente con las declaraciones/reacciones aceptadas, registrando por separado reembolsos propios de las reglas. Propuesta Traditional: una reacción inicialmente disponible salvo condición explícita, renovada al inicio de la activación ordinaria de esa unidad. Otros adaptadores definen su disponibilidad/renovación. Las acciones legendarias y golpes adicionales nunca la renuevan implícitamente. Separa los contraataques existentes salvo mapeo explícito. Si una opción legendaria lanza un hechizo, abre reacciones solo como permitan las reglas elegidas.

Usa una pila guardada y acotada con IDs de padre/disparador para reacciones anidadas admitidas, prioridad estable y revalidación tras cada respuesta. No se puede contrarrestar otra vez un lanzamiento ya cancelado. Pasar cierra la oportunidad de esa unidad para ese disparador. Un adaptador limitado debe indicar las cadenas no admitidas. Resuelve eventos aceptados una vez y deriva de ellos la narración; la interrupción textual reversible de [PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) es un precedente de persistencia/contexto, no permiso para deshacer combate recortando texto. Consulta la sección 16 del diseño de IA para el ciclo completo y la matriz de aceptación.

## Contrato de guardado, interfaz y despliegue

- Fija en la instantánea ID, versión y opciones efectivas de reglas; controladores; hojas; orden inicial; activación actual/confirmada; presupuestos y renovaciones legendarios/de reacción; pila pendiente; IDs de disparadores/decisiones; compromisos/reembolsos; recargas; estado RNG y decisiones de interrupción aceptadas.
- Exige un registro de revisiones/acciones del servidor antes de decisiones GM asíncronas. Rechaza envíos concurrentes obsoletos y haz idempotentes los reintentos. Un ID de candidato guardado en el navegador no basta.
- Cambiar ajustes afecta al siguiente encuentro. Conserva las reglas fijas de la batalla activa tras importación, punto de control/rama, reconexión y actualización.
- Deja los combates en curso antiguos en `engine-legacy`. Ofrece conversión explícita para una futura batalla, con vista previa de estadísticas/recursos sin mapear; no sobrescribas hojas ni reservas silenciosamente.
- Las versiones desconocidas son de solo lectura/recuperables; no se interpretan silenciosamente como la última.
- Añade un selector localizado **Combat rules** (Reglas de combate), separado de **Combat presentation** (Presentación del combate) y futuro **Participation** (Participación). Describe brevemente orden, recursos y comportamiento clave; muestra límites de compatibilidad antes de empezar.
- Si faltan campos obligatorios de la hoja, solicítalos antes del combate; usa reglas heredadas solo mediante elección explícita. El generador no puede inventar estadísticas autorizadas del personaje.

## Secuencia de implementación y pruebas de salida

| Etapa | Trabajo | Prueba útil mínima |
| --- | --- | --- |
| 1 | Inventariar resolutores, definir identidad fija y adaptador heredado | Guardados antiguos y ambas presentaciones reproducen el comportamiento anterior |
| 2 | Activación/intercambio Traditional y contabilidad explícita | Matriz del umbral de velocidad; un inicio/ronda; MP y recargas |
| 3 | Integrar previsiones, selección UI y eventos aceptados guardados | Acuerdo previsión/resolución; recarga/importación/punto de control; capturas computadora/móvil |
| 4 | Límites declaración/efecto, reacciones opcionales, anticipación y ventanas posteriores | Sin explotar selección ni filtrar órdenes futuras; IA puede pasar; costos/renovaciones/reembolsos correctos; sin turno extra ni duplicación ordinaria |
| 5 | Subconjunto declarado 5e-2014 desde fuentes primarias | Ejemplos positivos/negativos específicos de edición por acción admitida |
| 6 | Auditar e implementar un subconjunto V20 declarado | Ejemplos verificados de iniciativa, recursos y daño; sin matemática accidental 5e/Traditional |
| 7 | Adaptar presupuestos Summoning/propiedad de órdenes | Tiempos de aparición/retirada/muerte, límite de población y sin multiplicación de acciones por invocaciones |

Casos Traditional: diferencia de velocidad 4 frente a 5; igualdad; contraataque mata al atacante; primer golpe mata al objetivo; primer golpe falla; incapacitación intermedia; contraataque a distancia indisponible; recarga/MP insuficiente; jugador/IA/GM usan la misma legalidad; dos unidades rápidas inician solo una vez cada una; acción legendaria no reinicia esas marcas; renovación de ronda repone una vez; versión desconocida falla con seguridad.

Casos de reacción/anticipación: selección frente a activación confirmada; reselección/recarga; posición Classic exacta; amenaza Fireball asequible frente a mago agotado; predicción errónea posible; pasar hechizo débil frente a contrarrestar uno valioso; reacción/MP/slot insuficiente; contra fallida cobra costo; reembolso del original según edición; disparador lejano/no visible; múltiples reacciones; contra anidada admitida y límites de pila; respuesta obsoleta tras muerte del objetivo; revalidar elección en cola interrumpida; tiempos nativos frente a regla casera; sin órdenes ocultas ni RNG futuro en prompts.

Ejecuta `pnpm install`, `pnpm check`, pruebas focalizadas `*.regression.ts`, regresiones de prompts al cambiar GM/esquemas y pruebas UI de ambas presentaciones. Sigue el flujo de issues/PR del repositorio e incluye textos localizados, changelog, seguimiento de traducciones y CodeRabbit antes de revisión. Deja sin marcar las casillas de verificación manual del PR.
