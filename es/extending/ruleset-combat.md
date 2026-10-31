# Combate de conjuntos de reglas

Esta página forma parte de [Escribir conjuntos de reglas de Game Mode](writing-rulesets.md). Cómo participa un conjunto de reglas en una pelea: el bloque `battle`, que presta la ficha al combate de Marinara, y el bloque `combat`, que resuelve toda la pelea según las reglas propias del conjunto, con su bestiario, tablero, reacciones y enfrentamientos.

<a id="battles-lending-the-sheet-to-marinaras-combat"></a>

## Batallas: prestar la ficha al combate de Marinara

De forma predeterminada, una batalla no conoce la ficha. Construye los combatientes como siempre; un personaje puede salir de una pelea sin cambios en los puntos de golpe de su ficha.

El bloque opcional `battle` cambia eso en una sola dirección: presta las cifras al combate y escribe su resultado de vuelta. **No hace que el combate siga tus reglas.** Los dados, quién acierta y cuánto daño hace siguen siendo de Marinara. Por eso la salud se transfiere como proporción del máximo, no como tu cifra: media salud en la ficha equivale a media barra de la que Marinara creó. Tu reserva de 9 puntos no entra directamente en una pelea donde un golpe hace 12.

```json
"battle": {
  "health": { "pool": "grit" },
  "energy": { "pool": "luck" },
  "skills": [{ "list": "knacks" }]
}
```

- `health`: obligatorio. Reserva viva que representa los puntos de golpe. Debe pertenecer a `sheet.live.pools`, no ser una lista cuyas filas son reservas.
- `energy`: opcional. Reserva que puede gastar el combate y que se convierte en la barra MP. Debe ser distinta de `health`, pues no se pueden gastar puntos de golpe como energía.
- `slots`: opcional. Reservas gastadas de una en una, cada una con `level` de 1 a 9: `[{ "pool": "slots_1", "level": 1 }]`. Cada nivel y reserva se usa una sola vez.
- `skills`: opcional, hasta ocho. Listas cuyas filas pasan a ser habilidades de combate. Solo cuentan filas de tus catálogos cuya entrada tenga `mechanics`: una fila escrita a mano no expresa efectos numéricos. `onlyWhen` nombra una columna booleana que debe estar activada, como un conjuro preparado. `alwaysWhen` nombra una columna y un valor que permiten entrar de todos modos, como conjuros que no requieren preparación. Es la excepción a `onlyWhen` y se rechaza sin él.

### Qué entra y qué vuelve

**Al entrar**, para cada miembro cuya ficha tiene la partida: la proporción de salud determina el punto inicial en la barra de Marinara; la reserva de energía se convierte en MP; cada reserva de espacios se convierte en espacios de ese nivel; las filas marcadas se convierten en habilidades. Salud máxima, ataque, defensa, velocidad y nivel siguen siendo cifras de Marinara. Una reserva de salud a cero hace empezar caído; por encima de cero nunca se empieza con menos de un punto, para que el redondeo no derribe a alguien por una proporción pequeña.

**Al salir**, una vez terminada la pelea: la proporción final de la barra se convierte a la escala de la reserva y se aplica como daño o curación la diferencia respecto al inicio. Energía y espacios son cantidades, no proporciones, y vuelven tal cual. Todo sigue las reglas de los botones de la ficha; los cambios rechazados se omiten y notifican, no se fuerzan. Una pelea que no cambió la salud no escribe ningún cambio, para que las conversiones por sí solas nunca alteren la ficha.

**En ninguna dirección**: tiradas de ataque, salvaciones, concentración y efectos de pagar más. Están en `mechanics` para que los lea un sistema de combate completo en el futuro; este puente no los aplica y el conjunto no debe afirmar que sí.

Una batalla abandonada no escribe nada. Si borras el mensaje que la inició o nunca llega al final, la ficha queda igual: la pelea no ocurrió.

### Cómo se convierte una entrada en habilidad

El bloque `mechanics` se interpreta así:

- `kind` determina el tipo de habilidad. Se omiten entradas `utility` y las marcadas `reaction`, pues el combate de Marinara no tiene dónde aplicarlas.
- `amount` determina la fuerza como multiplicador del ataque del combatiente, no como daño fijo. Dados mayores nunca golpean más suave; el multiplicador permanece en el rango usado por habilidades generadas.
- `range` y `area.size` se dividen por `units.distance.perCell` del catálogo para obtener casillas, sin redondear nunca a cero. Una explosión usa su radio, un cono la mitad y una línea una casilla. Un área afecta a todos los enemigos cubiertos y respeta `friendlyFire`.
- `damageType` se convierte en elemento. No se transfiere `targets`: Marinara determina los objetivos válidos de curaciones, mejoras y ataques por el tipo de habilidad.
- Un `cost` de energía se convierte en coste MP; varios se suman. Un `cost` de exactamente un espacio gasta uno de ese nivel. Marinara cobra una cantidad de energía o un espacio, nunca ambos: omite entradas con dos espacios, espacios de dos niveles o espacio más energía. También omite costes de otras reservas, como salud o recursos de clase, para no concederlos gratis.
- `buff` y `debuff` se convierten en los efectos propios de Marinara. Otras promesas del texto, como quitar un estado de la ficha, no se aplican. Omite `mechanics` si el efecto solo tiene sentido fuera de batalla.

`coverage.combat` sigue siendo independiente y conserva su significado: actívalo solo si las batallas siguen realmente las reglas de tu sistema.

<a id="combat-a-fight-your-own-rules-resolve"></a>

## Combate: una pelea que resuelven tus propias reglas

El bloque `battle` presta al combate las cifras de la ficha, manteniendo la aritmética de Marinara. El bloque opcional `combat` define cómo RESUELVEN tus reglas la pelea. Parametriza un tipo de combate del motor, igual que `resolution` parametriza pruebas; todos sus nombres son tuyos. Hay tres tipos: `attack-vs-defense`, donde los dados se suman y se comparan con un número; `dice-pool`, donde un combate tira las reservas propias de tu conjunto `dice-pool` y cuenta éxitos (consulta Un combate tirado con reservas, más abajo); y `symbol-pool`, donde un combate tira los dados narrativos de tu conjunto `symbol-pool` y gasta los símbolos que quedan (consulta Un combate tirado con dados de símbolos, más abajo).

**Una partida cuyo conjunto declara `combat` pelea según ese bloque.** Las cifras del grupo vienen de sus fichas, los adversarios de tu bestiario o escala de amenaza, y cada turno se resuelve con tus dados. Todo lo gastado o perdido se guarda en la ficha en el momento, así que cerrar la pestaña a mitad no pierde nada. La pantalla usa tus palabras: ataques y capacidades en el menú, presupuestos, estados y registro con los cálculos reales. Las carencias se enumeran en la sección sobre lo que falta.

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "grit" },
  "defense": { "derived": "guard" },
  "initiative": { "dice": { "count": 2, "sides": 6 }, "modifier": { "abilityMod": "wits" } },
  "attackRoll": { "dice": { "count": 2, "sides": 6 } },
  "economy": { "budgets": [{ "id": "act", "label": "Action", "per": "turn", "count": 1 }] },
  "attacks": [
    {
      "list": "gear",
      "budget": "act",
      "name": "name",
      "toHit": { "ability": { "column": "swing" } },
      "damage": { "dice": { "column": "damage" }, "ability": { "column": "swing" }, "type": { "column": "harm" } }
    }
  ],
  "abilities": [{ "list": "knacks", "budget": "act" }],
  "standard": ["dodge", "help"],
  "conditions": [
    { "condition": "shaken", "effects": ["own-attacks-disadvantage", "ends-on-damage"] },
    { "condition": "pinned", "effects": ["cannot-act", "speed-zero"] }
  ]
}
```

Ese es todo el bloque Ember Roads y sus partidas lo usan para combatir. El borrador 5e usa las mismas claves para d20:

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "hp" },
  "defense": { "field": "ac" },
  "initiative": { "dice": { "count": 1, "sides": 20 }, "modifier": { "derived": "initiative" } },
  "attackRoll": {
    "dice": { "count": 1, "sides": 20 },
    "advantage": true,
    "naturals": { "max": "critical", "min": "miss" },
    "critical": "double-dice"
  },
  "economy": {
    "budgets": [
      { "id": "action", "label": "Action", "per": "turn", "count": 1 },
      { "id": "bonus", "label": "Bonus action", "per": "turn", "count": 1 },
      { "id": "reaction", "label": "Reaction", "per": "turn", "count": 1 }
    ],
    "movement": { "field": "speed" }
  },
  "abilities": [
    {
      "list": "spells",
      "onlyWhen": "prepared",
      "alwaysWhen": { "column": "level", "equals": 0 },
      "budget": "action",
      "toHit": { "derived": "spell_attack" },
      "saveDifficulty": { "derived": "spell_save_dc" }
    }
  ],
  "concentration": { "text": "concentration", "save": "con_save", "floor": 10, "fromDamage": 0.5 }
}
```

<a id="every-key"></a>

### Todas las claves

- `kind`: `"attack-vs-defense"` (un bando tira contra la defensa del otro; acertar causa daño), `"dice-pool"` (consulta Un combate tirado con reservas) o `"symbol-pool"` (consulta Un combate tirado con dados de símbolos). Cada clave siguiente significa lo mismo en todos, leída como ese tipo lee los números.
- `health`: obligatorio. Lo que quita la pelea: `{ "pool": "grit" }`, una reserva que disminuye y cuyo margen temporal absorbe primero el daño si existe; o `{ "track": "harm" }`, un contador de heridas que MARCA. Un contador de heridas necesita `damageKinds` a su lado. O bien `{ "track": "wounds" }`, que nombra un contador ordinario (sin `levels` ni `boxes`) que SE LLENA desde su `min` hasta su `max` (Capability API 1.383): el daño suma puntos, una curación los quita y un contador en su `max` queda fuera del combate, igual que una reserva a cero. Wounds (Heridas) de Genesys es uno, con Wound Threshold (Umbral de heridas) como `max`; un sistema en el que solo caes al SUPERAR el umbral fija `max` en uno más que este. Un contador de salud ordinario empieza en su `default` (no en un `startFrom`), no puede empezar en su `max` y no admite `damageKinds`. Un `max` que calcula la ficha es propio de cada personaje, igual que el máximo de una reserva. Ningún contador concede puntos temporales.
- `defense`: obligatorio, referencia de valor. Un campo introducido por el jugador o un valor derivado que calculas.
- `initiative`: obligatorio. Dados tirados una vez al inicio y referencia opcional de modificador. Los empates favorecen el modificador mayor y después el orden de preparación del combate. `"each": "round"` vuelve a tirar la iniciativa de todos al empezar cada ronda nueva, con el modificador tal como esté entonces (así, un modificador que lee un contador de heridas es más lento una vez herido), y la ronda empieza por quien quede primero en el nuevo orden. Capability API 1.47. Un combate `dice-pool` puede tirarla en su lugar como reserva: `pool` (una referencia de valor) es cuántos dados, y sus éxitos más `plus` son el número, sin `dice` ni `modifier` al lado. `resource`, que necesita `pool`, conserva ese número y permite que los ataques lo muevan (consulta "Iniciativa que mueven los ataques", más abajo). Capability API 1.48.
- `attackRoll`: obligatorio en `attack-vs-defense` y rechazado en `dice-pool`, que tira las reservas propias de tu resolución. Define dados, si se tira dos veces y se conserva una (`advantage`), qué hacen las caras extremas de un dado (`naturals.max`: `critical`, `hit` o `none`; `naturals.min`: `miss` o `none`) y qué hace el crítico (`critical`: `double-dice` vuelve a tirar los dados de daño; `max-dice` añade una vez sus caras máximas; `none` es un impacto normal). Las caras especiales requieren un único dado, igual que en pruebas. Las salvaciones de combate usan estos mismos dados. `criticalFrom` amplía la cara de crítico: un valor que se lee de la ficha del atacante y que es la cara natural más baja que cuenta como crítico, como `{ "field": "critical_from" }` para un Champion de 5e cuya ficha dice 19. Se limita a la cara más alta del dado, un valor inferior a 2 significa que no hay rango (solo la cara más alta, como en un personaje cuyo campo se deja en 0), y necesita un único dado con `naturals.max` fijado en `critical`. Capability API 1.81.
- `economy`: obligatorio. `budgets` define lo que cabe en un turno: ID, etiqueta, `per` (`turn` se repone al inicio del turno del portador; `round`, al empezar una ronda) y `count`. El PRIMER presupuesto es el principal, gastado por acciones estándar. `movement` es una referencia opcional de distancia recorrida por turno, en tu unidad. La leen combates sobre tablero; consulta Posiciones.
- `attacks`: opcional. Listas de ficha cuyas filas son armas. `name` es la columna de nombre; `damage.dice`, la de dados; `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` y `damage.type` nombran columnas de la misma lista. Una columna `ability` es un `enum` con un ID de atributo; otros valores no añaden nada. `proficiency` es `boolean`: activarlo añade competencia. Sin dados legibles, la fila no es un ataque; una cuerda sigue siendo cuerda. `toHit.skill` nombra una columna `enum` con uno de tus IDs de habilidad: la fila suma lo que suma una prueba de esa habilidad, con el `ability` propio de la fila en lugar del de la habilidad si nombra uno, exactamente como lo cambia el `with=` de una prueba (Capability API 1.47).
  `abilityChoices` asocia un valor de la columna de atributo de la fila con dos o más de tus IDs de atributo (Capability API 1.793): una fila que lo lee ataca con el que más sume para acertar y causa su daño con ese mismo atributo. La propiedad Finesse de SRD 5.1 es la regla para la que existe, escrita como `{ "finesse": ["str", "dex"] }` con `finesse` entre los valores de la columna. El valor se rechaza si él mismo es un atributo, si nombra uno que tu ficha no tiene o si no se ofrece en una columna de atributo.
  `toHit.sheetBonus` (Capability API 1.800) suma un número de la ficha para acertar: `value` es cualquier referencia de valor, y `when: { "column": ..., "equals": ... }` lo limita a las filas cuya columna contiene ese valor. Archery de SRD 5.1, "+2 de bonificación a las tiradas de ataque que hagas con armas a distancia", lee el `listSum` de una columna de rasgos en las filas cuyo `reach` es 0, así que una daga arrojada no recibe nada.
  `strikes` referencia cuántos ataques compra UN gasto del presupuesto. Elegir una fila sin ataques disponibles gasta el presupuesto y deja el resto disponibles. Mientras quede alguno, todas las filas que declaran `strikes` son gratuitas: cambiar arma, objetivo o caminar entre ataques surge del propio menú. `strikesCappedBy` nombra una columna booleana que limita SU fila a un único ataque, por muchos que compre la lista: sirve para armas que disparan una vez por turno, como la propiedad Loading de SRD 5.1. No tiene sentido, y se rechaza, en listas que ya compran un ataque por gasto. Los ataques disponibles pertenecen al COMBATIENTE, no a una lista: dos listas con `strikes` comparten la misma cantidad, use la fila que use. Se borran al terminar el turno que los compró. Sin declaración se compra uno por gasto, como antes.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`: opcional. Listas cuyas filas marcadas por catálogo son capacidades, filtradas como `battle.skills` mediante `onlyWhen` y `alwaysWhen`. Sus efectos son el `mechanics` de la entrada; el bloque establece el `budget` predeterminado, el `toHit` añadido si tira para acertar y la `saveDifficulty` de las salvaciones. Se rechaza una entrada que pide salvación, propia o para terminar un estado aplicado, si su lista no tiene `saveDifficulty`: una salvación contra nada siempre tendría éxito. Con Capability API 1.108, `byColumn: { "column": "class", "values": { "cleric": { "toHit": { "derived": "spell_attack_cleric" }, "saveDifficulty": { "derived": "spell_dc_cleric" } }, "wizard": { "toHit": { "derived": "spell_attack_wizard" }, "saveDifficulty": { "derived": "spell_dc_wizard" } } }` selecciona referencias según la clase de una fila. Un clérigo 3 / mago 2 puede derivar el ataque del clérigo de la competencia más Sabiduría y la CD de 8 más ese ataque, y los del mago, de Inteligencia. La columna debe existir en la lista de origen, y `values` contiene de 1 a 20 entradas. Cada entrada puede sustituir cualquiera de las dos referencias; una referencia omitida, un valor de columna ausente o un valor no incluido conservan la referencia propia del origen. El combate, el resumen de filas de la ficha y el resumen del Game Master leen los mismos números por fila. Tanto `stamp` como `byColumn` requieren schemaVersion 2 y capabilityApi 1.108 o posterior.
- `standard`: opcional, lista cerrada `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. Siempre se resuelven `dodge` (los ataques recibidos se tiran dos veces y conservan el peor) y `help` (el siguiente ataque del aliado se tira dos veces y conserva el mejor). `dash` (otro movimiento completo) y `disengage` (nadie ataca por alejarte este turno) se resuelven en tablero y solo se registran sin él. `hide` y `ready` se aceptan, pero aún no hacen nada.
- `standardEffects`: opcional, efectos de acciones estándar que su indicador no contiene. Hoy solo `dodge`: `{ "dodge": { "saves": ["dex_save"] } }` indica qué salvaciones tira dos veces conservando la mejor mientras dura. Solo nombra salvaciones declaradas, y solo si `standard` incluye `dodge`. Sin esto, esquivar sigue dificultando los impactos y nada más. `{ "help": { "beside": true } }` (Capability API 1.771) ofrece Help (Ayudar) solo junto a un oponente, y la ayuda solo cuenta contra un oponente que estaba junto a quien ayuda; necesita `help` en tu lista `standard`.
- `conditions`: opcional. Asigna TUS IDs de estado a sus efectos para que ficha y combate compartan un registro: un personaje envenenado sigue así después. Lista cerrada: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side` (1.278) y `cannot-approach-source`. `failsSaves` nombra las salvaciones que falla sin tirar. Los seis efectos que requieren distancia o movimiento (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) solo tienen efecto en tablero; consulta Posiciones. `cannot-react` excluye al portador de las ventanas abiertas por movimiento, por lo que no se le pregunta. Hay otras cuatro claves:
  - `modifiers`: los números que cambia mientras está activo. Consulta Números que cambia un estado, más abajo.
  - `saves`: salvaciones a las que se refieren los dos efectos de salvación y cualquier modificador a las salvaciones. Sin ella, todas; declararla sin ninguno de ellos se rechaza.
  - `skills`: habilidades a las que se refieren los dos efectos de prueba y cualquier modificador a las pruebas que no nombra habilidades propias. Sin ella, todas; declararla sin ninguno de ellos se rechaza. Los enfrentamientos de un combate tiran las pruebas propias del combate, no habilidades, así que algo restringido a habilidades nunca llega a uno; una prueba fuera de un combate con una de esas habilidades sí lo lee (consulta [Pruebas fuera de un combate](ruleset-items.md#checks-outside-a-fight)). Capability API 1.53.
  - `whileSourceInSight`: lo que solo cuenta mientras quien lo aplicó esté a la vista del portador. `true` condiciona todo el estado; una lista de sus efectos condiciona solo esos y conserva el resto, como un miedo que impide acercarte aunque no veas el origen. Se rechazan efectos que el estado no tenga. Sin tablero no hay línea de visión que romper y todo cuenta igualmente.
  - `endsWhenSourceDown`: se quita en cuanto cae quien lo aplicó.
  - Sentidos (Capability API 1.127): el `lacks` de un estado nombra los sentidos que no tiene quien lo tiene, y el `mechanics.needs` de una entrada de catálogo o el `needs` de la acción de una criatura nombran los sentidos que debe tener un objetivo para que le afecte. Para el Deafened de 5e, escribe `"lacks": ["hearing"]`; para Command, escribe `"needs": ["hearing"]` en sus mecánicas. Un objetivo ensordecido queda fuera del menú de objetivos de Command. Un efecto de área o de varios objetivos que necesita el oído se salta ese objetivo por completo: ni salvación, ni daño, ni estados. Cuando termina Deafened, el objetivo vuelve a ser válido. Cada lista tiene de uno a cuatro IDs de sentido únicos, con las palabras del propio conjunto; el motor no conoce ningún nombre de sentido.
  - Solo utilizable mientras la ficha lo permita (Capability API 1.166): el `mechanics.usableWhen` de una entrada de catálogo es `{ "value": <value reference>, "atLeast": n, "atMost": n }` (uno de los límites o ambos). En un combate, la entrada se ofrece, en el turno de quien la tiene o en una ventana de reacción, solo mientras el valor que se lee de su ficha, su estado vivo y sus objetos esté dentro de los límites; se lee cada vez que se dibuja el menú. El Protection de 5e necesita un escudo en la mano: `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. El "sin armadura pesada" de Rage es lo mismo con `"atMost": 0` sobre la cuenta de armaduras pesadas. Una criatura escrita como perfil no tiene ficha, así que nada la retiene.
  - Estados que solo se aplican mientras lo permita la ficha de quien los aplica (Capability API 1.167): una entrada de `applies` en las mecánicas de una entrada de catálogo o en el uso de un objeto puede llevar `"when"`, con la misma forma que `usableWhen`. Se lee de la ficha, el estado vivo y los objetos de quien lo aplica, en el momento en que se aplicaría, y una entrada fuera de sus límites se omite; las demás se siguen aplicando. El Rage de 5e aplica `raging` y uno de tres estados de daño dentro del límite de cuatro entradas: `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, después `raging_damage_3` con `"atLeast": 9, "atMost": 15` y `raging_damage_4` con `"atLeast": 16`. Quien aplica sin ficha aplica todas las entradas. El perfil de una criatura y el `onEnd` de un estado no tienen ficha de quien aplica que leer, así que ahí se rechaza `when`. Requiere schemaVersion 2 y capabilityApi 1.167 o posterior.
  - Tipos de criatura y pruebas de objetivo (Capability API 1.168): `combat.creatureTypes` enumera lo que puede ser un combatiente, `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id":
"devil", "label": "devil" }], "field": "race", "default": "humanoid" }`.
    Una criatura nombra su propio `type` y sus `tags`; el tipo de un personaje es el valor del campo de texto o de elección `field` cuando es uno de los tipos y, si no, `default` (los personajes de 5e son humanoides). Una prueba de objetivo es `{ "types": [...], "tags": [...] }` y se cumple con cualquier coincidencia; un combatiente sin tipo ni etiquetas nunca coincide. Va en tres sitios: el `targetIs` de una cláusula de daño solo inflige esa cláusula a un objetivo que coincide (una dragon slayer: `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`; el agua bendita: `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`); el `targetIs` de una entrada de `applies` solo aplica ese estado a un objetivo que coincide; y `mechanics.targetTypes: { "is": test, "not": test }` indica a quién se puede elegir o alcanzar (Animal Friendship: `{ "is": { "types": ["beast"] } }`; Sleep: `{ "not": { "types": ["undead"] } }`). Un área pasa de largo a quien deja fuera `targetTypes`. Una previsión solo cuenta una cláusula `targetIs` contra un objetivo al que alcanzaría; la media simple de la ficha la deja fuera. El panel de batalla y el Game Master ven el tipo y las etiquetas de cada combatiente. Requiere schemaVersion 2 y capabilityApi 1.168 o posterior.
  - Finales de estado (Capability API 1.125): Charm Person usa `"endsWhen": ["harmed-by-source-side"]`. Un daño mayor que cero de quien lo aplicó o de cualquiera de su bando, o que estos apunten a quien lo tiene con un ataque, una salvación o un estado dañino, lo termina después de que la acción dañina se resuelva por completo, aunque el ataque falle o la salvación tenga éxito. `"saveWhenDamaged": true` repite una salvación de turno al recibir daño: cada cantidad de daño mayor que cero repite el `saveEnds` de la acción que lo aplicó con su CD guardada; un éxito lo termina. Sin una salvación o una CD guardadas, no se tira nada. Hypnotic Pattern usa `"endsWhen": ["damaged"]` y `"shakeOff": { "budget": "action" }`: cualquier daño mayor que cero lo termina de inmediato, o bien otro combatiente del bando de quien lo tiene puede gastar ese presupuesto en su propio turno para terminarlo. `shakeOff.reach` está en la unidad de distancia del conjunto y vale una casilla de forma predeterminada; sin tablero no se mide ninguna distancia. La economía debe declarar su presupuesto. `endsWhen` tiene una o dos entradas únicas. Estas claves no cambian los finales por caída del origen ni por concentración. Para una salvación solo ante un daño mayor que cero, nunca al inicio ni al final del turno, usa `saveEnds.at: "damaged"` (Capability API 1.129): el applies de Dominate Person es `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`, que tira una vez por golpe con la CD guardada de la acción que lo aplicó sin necesitar `saveWhenDamaged`.
  - La economía de acciones (Capability API 1.76), tal como la cambian Haste y Slow:
    - `budgets`: `[{ "budget": "haste", "flat": 1 }]` da a quien lo tiene esa cantidad más (o menos) de un presupuesto de turno en cada turno, nunca por debajo de cero. Solo se puede cambiar así un presupuesto que se repone `per` turno. Un presupuesto puede declararse con `"count": 0` para uno que solo llena un estado, y la pantalla solo lo muestra mientras alguien tenga algo de él. Un oponente inventado nunca gasta uno.
    - `grants`: `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true,
"items": true }`
      indica en qué se puede gastar ese presupuesto: las acciones estándar nombradas (de la propia lista `standard` del conjunto, nunca en el primer presupuesto, donde ya están todas las acciones estándar), un ataque con arma de un solo golpe (compre los ataques que compre normalmente una acción; para una criatura, un ataque de su perfil contra un solo objetivo, nunca un ataque múltiple) y el uso de un objeto: `true` para cualquier objeto, o `{ "tags": ["mundane"] }` solo para un objeto con una de esas etiquetas de objeto (el Use an Object de 5e es el de un objeto mundano, nunca la activación de un objeto mágico). Se ofrecen cuando se ha agotado el presupuesto que gastarían normalmente, y solo en el propio turno de quien lo tiene: una concesión nunca paga una reacción.
    - `exclusive`: `["action", "bonus"]`, dos presupuestos de los que un turno solo gasta uno: gastar cualquiera de ellos vacía el otro.
    - `attacksPerTurn`: cuántos ataques (acciones que tiran para acertar, cada parte de ataque de una secuencia y un enfrentamiento que ocupa el lugar de un golpe, como un agarre) hace quien lo tiene en su propio turno, dé lo que dé una acción. Una reacción en el turno de otro ni se limita ni se cuenta.
    - `onEnd`: `{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`, lo que deja atrás cuando termina definitivamente (se agota, una salvación o un daño lo terminan, se rompe la concentración), nunca cuando se vuelve a aplicar. Dura algunas `rounds` (nunca `"until-save"` ni `"instant"`). Si se deja atrás en mitad del propio turno de quien lo tiene, sus rondas empiezan con el turno siguiente, así que una ronda es todo el turno siguiente.
  - Cuando termina un combate, termine como termine, cada estado que aplicó con un reloj, un `endsAfter` o una concentración se retira de la ficha sin dejar nada atrás, y la concentración termina. Un estado sin reloj (el derribo de una caída) se queda.

  `own-saves-advantage` y su opuesto tiran dos veces y conservan una, como los ataques; se cancelan entre sí. `own-checks-advantage` y su opuesto hacen lo mismo con el lado del portador en un enfrentamiento, que es donde un combate hace sus pruebas de atributo, y con sus pruebas fuera de un combate. `resist-all` reduce a la mitad todo daño además de las defensas propias del objetivo y se cancela con una vulnerabilidad de la misma manera. `cannot-target-source` impide apuntar cualquier cosa a quien lo aplicó (`cannot-target-source-side`, 1.278: ni a nadie de su bando, salvo que sea el del portador). `cannot-approach-source` impide acercarse más que la casilla actual, incluido el camino: permite rodear hasta otra igual de distante, pero no pasar cerca y salir por el otro lado.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **Daño que cambia un estado (Capability API 1.133).** `damage` cambia lo que inflige quien lo tiene; `damage-taken` cambia lo que recibe quien lo tiene. Ambos aceptan `flat`, `dice` (y `minus`) o `times: 0.5 | 2`. Las sumas se aplican una vez por impacto de ataque, aunque el impacto tenga varias cláusulas de daño; los críticos duplican los dados añadidos igual que el conjunto duplica sus demás dados. Las salvaciones y los impactos automáticos no reciben ninguna. `times` cambia todo el impacto después de las sumas y antes de la resistencia, redondeando el total hacia abajo una sola vez entre todas sus cláusulas. Las cantidades añadidas se enfrentan a la resistencia con su propio `damageType`, o con el tipo del impacto si se omite. Las sumas del mismo tipo se unen a esa cantidad antes de la resistencia.

  `attacks` es `weapon`, `spell` o `any` (el predeterminado). Las filas de listas de ataques y los ataques de objetos equipados son armas, igual que las tiradas de ataque de perfil contra un solo objetivo; las capacidades de catálogo (incluido el lanzamiento de conjuros de las criaturas) y los usos de objetos son ataques de conjuro u otros. `blow: "melee" | "ranged"` sigue a 1.118, así que un arma arrojadiza a su alcance es cuerpo a cuerpo. `ability` nombra el atributo realmente elegido para la tirada de ataque: el atributo de una fila, o el primer mejor atributo que ofrece un objeto (incluido el de destreza). Las acciones de perfil simples no tienen ninguno y nunca coinciden con una restricción de atributo. Estas claves y `damageType` se rechazan en otros objetivos de modificador. `fromSource: true` solo es para `damage-taken`: el impacto debe venir de quien aplicó el estado registrado. Un estado no registrado, un nivel o un objeto no tienen origen que los aplique y no pueden coincidir.

  En 5e, declara estos IDs de estado en la ficha y pon después estas entradas en `combat.conditions`:

  ```json
  [
    {
      "condition": "divine_favor",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "1d4", "damageType": "radiant" }]
    },
    {
      "condition": "rage",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "blow": "melee", "ability": "str", "flat": 2 }]
    },
    {
      "condition": "enfeebled",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "ability": "str", "times": 0.5 }]
    },
    {
      "condition": "hunters_mark",
      "modifiers": [{ "to": "damage-taken", "attacks": "weapon", "fromSource": true, "dice": "1d6" }]
    }
  ]
  ```

  Divine Favor y Rage recaen en su lanzador; Ray of Enfeeblement y Hunter's Mark, en su objetivo. Hex usa la entrada `damage-taken` de la marca con `attacks: "any"` y `damageType: "necrotic"`. Los niveles y los efectos `worn`, `carried` y `otherwise` de requisito de los objetos comparten estos modificadores. El menú de ataque solo cuenta las propias sumas y multiplicadores de quien lo tiene; nunca promete ahí la marca de un objetivo. Los resúmenes de la ficha y del prompt describen los propios modificadores de daño de quien lo tiene, y la vista de batalla también describe los que recibe. Los paquetes que usan cualquiera de los dos objetivos requieren schemaVersion 2 y capabilityApi 1.133 o posterior, también cuando el objeto está en un archivo de catálogo separado.

  **Números que cambia un estado.** Cada entrada de `modifiers` nombra lo que cambia, `to`, y en cuánto:
  - `defense`: el número que debe alcanzar un ataque contra el portador. Solo un número fijo.
  - `attacks`, `saves`, `checks`: las tiradas de ataque, salvaciones y pruebas de enfrentamiento del propio portador. Un número fijo, o `dice` tirados cada vez que se hace la tirada (`"1d4"`); `minus: true` resta los dados en vez de sumarlos.
  - `speed`: cuánto camina el portador, en tu propia unidad de distancia (`flat`), o `times` 0.5 o 2 para la mitad o el doble, aplicado después de cada cambio fijo. Solo se lee en un tablero, igual que `speed-zero`.
  - `health-max`: `times` 0.5 y nada más reduce a la mitad el máximo de salud de quien lo tiene, redondeado hacia abajo y nunca por debajo de 1 (Capability API 1.115). Un contador de salud de casillas no tiene máximo que reducir. La salud por encima del máximo reducido se pierde al empezar el combate, y la curación nunca lo supera.

  Un modificador a `checks` puede nombrar sus propias `skills`, y uno a `saves` sus propias `saves`, que lo restringen en lugar de las del estado. Cualquiera de ellos puede tirar dos veces con `mode: "advantage"` o `"disadvantage"`, que se cuenta junto con los efectos del mismo nombre y se cancela igual que ellos, con o sin un número al lado; así, un mismo estado puede hacer Sneak más difícil y Climb más fácil a la vez. Estas tres claves necesitan Capability API 1.53.

  ```json
  { "condition": "muddy", "modifiers": [{ "to": "checks", "skills": ["sneak"], "mode": "disadvantage" }] }
  ```

  Un número fijo lleva su propio signo, y 0 se rechaza. Cada modificador se muestra en el registro junto a la tirada que cambió, con el nombre del estado ("12 + 5 + 3 (Blessed) = 20"), y la probabilidad de acertar y la de ganar del menú lo tienen en cuenta. Los estados se acumulan entre sí; el mismo estado dos veces sigue siendo un estado.

  ```json
  "conditions": [
    { "condition": "blessed", "modifiers": [{ "to": "attacks", "dice": "1d4" }, { "to": "saves", "dice": "1d4" }] },
    { "condition": "shielded", "modifiers": [{ "to": "defense", "flat": 5 }] },
    { "condition": "slowed", "modifiers": [{ "to": "speed", "times": 0.5 }, { "to": "defense", "flat": -2 }] }
  ]
  ```

- `levels`: opcional. Niveles de un contador vivo que cuentan como estados mientras el contador esté lo bastante alto, que es como se expresa un estado que empeora por pasos, como el agotamiento. Cada entrada nombra un `track` simple (no un contador de heridas), el nivel `at` en el que empieza y lo que hace, con los mismos `effects`, `modifiers`, `failsSaves`, `saves` y `skills` que tiene un estado. Cuenta cada nivel que ha alcanzado el contador, así que se suman a medida que sube. Un nivel no tiene origen y solo termina cuando baja lo que lee, así que `half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side` y `cannot-approach-source` se rechazan en uno. Solo un combatiente con ficha tiene contadores. El registro nombra un nivel por su contador y número ("- 1 (Heat 3)").

  En lugar de `track`, un nivel puede leer un valor `derived` (Capability API 1.54), calculado con el estado vivo y los objetos del personaje, para que nadie tenga que marcar nada: Ember Roads ralentiza a cualquiera que lleve 10 de volumen o más.

  ```json
  {
    "derived": "bulk_carried",
    "at": 10,
    "modifiers": [
      { "to": "speed", "flat": -2 },
      { "to": "checks", "skills": ["sneak"], "flat": -1 }
    ]
  }
  ```

  Un umbral que varía de un personaje a otro ("more than five times Strength") es un valor derivado que lo resta: `scale` por -1 da la parte que hay que restar, y una `sum` de ambos es lo que lee el nivel.

  ```json
  "levels": [
    { "track": "exhaustion", "at": 1, "effects": ["own-checks-disadvantage"] },
    { "track": "exhaustion", "at": 2, "modifiers": [{ "to": "speed", "times": 0.5 }] },
    { "track": "exhaustion", "at": 3, "effects": ["own-attacks-disadvantage", "own-saves-disadvantage"] },
    { "track": "exhaustion", "at": 4, "modifiers": [{ "to": "health-max", "times": 0.5 }] },
    { "track": "exhaustion", "at": 5, "effects": ["speed-zero"] },
    { "track": "exhaustion", "at": 6, "defeats": true }
  ]
  ```

  `"defeats": true` saca del combate para siempre a quien lo tiene en cuanto empieza, antes de que nadie se mueva (Capability API 1.115). Este y la salud perdida por un máximo reducido se resuelven una sola vez, al empezar el combate; cualquier otro nivel se lee cada vez que se lee el número que cambia.

  Los oponentes también llevan contadores (Capability API 1.115). Uno sin ficha empieza con los `tracks` que se le dan, por tus IDs de contador: una criatura que propone el Game Master puede nombrarlos (`"tracks": { "exhaustion": 2 }`), igual que un oponente del bestiario que se pone en un combate. Los `conditionImmunities` de una criatura pueden nombrar un contador que lee un nivel, y entonces ninguno de los niveles de ese contador le afecta, tenga ficha o no: los muertos vivientes y los constructos de 5e, inmunes al agotamiento.

  Los modificadores, los niveles y los efectos de prueba necesitan Capability API 1.45.

- `checks` y `contests`: opcionales. Lo que lee un enfrentamiento y los enfrentamientos que cualquiera puede iniciar en un combate: agarrar, empujar, liberarse. Consulta Enfrentamientos, más abajo. Capability API 1.43.
- `concentration`: opcional. Campo vivo `text` que registra lo mantenido, `save` exigida por el daño, `floor` mínimo de dificultad y `fromDamage`, proporción del daño que la fija si es mayor. Empezar otra capacidad de concentración termina la anterior; fallar la salvación la termina y quita los estados que mantenía.
- `dying`: opcional, `kind: "saves"`. Dos contadores de tiradas (la cantidad necesaria es el máximo de cada uno), `dice`, `succeedAt`, efectos de caras extremas (`naturals.max`: `revive-1` o `success`; `naturals.min`: `one-failure` o `two-failures`), coste de daño estando caído (`damageWhileDown`, `criticalWhileDown`) y `condition` del personaje caído. Sin bloque, salud cero solo lo deja caído y curar lo devuelve.
- `damageTypes`: opcional. Tipos del sistema, comparados sin distinguir mayúsculas.
- `damageKinds`: obligatorio si `health` es un contador de heridas y rechazado si es una reserva; solo una marca conserva un tipo (consulta [Contadores de heridas](ruleset-sheets.md#wound-tracks-health-that-is-a-track-not-a-number)). Define qué `kinds` marca cada golpe y cuántas casillas. `default` recibe lo no asignado, incluido daño sin tipo; `byType` asigna `damageTypes` a tipos de marca, ignorando mayúsculas: `"Fire"` y `"fire"` son una clave y declarar ambas se rechaza. `marks` no tiene predeterminado porque las respuestas son opuestas: `"per-point"` cuenta niveles de salud según daño, así que tres de daño marcan tres casillas y reducirlo ayuda; `"per-blow"` marca una casilla si el golpe acierta, sea cual sea su fuerza. Un golpe con varias cláusulas marca una casilla usando el tipo más grave que llegó. Indica cuál usa el sistema: `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool`: obligatorio en `dice-pool` y rechazado en `attack-vs-defense`. Consulta Un combate tirado con reservas.
- `spendLimits`: opcional. Cuánto de una reserva viva puede gastar un combatiente por `turn` o por `round` en un combate, sea del tipo que sea: `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max` se lee una vez al empezar el combate. Un coste que supera lo que queda del límite no se puede pagar, así que queda fuera del menú, por mucho que haya en la reserva. Un límite por turno vuelve a empezar al inicio del turno de su portador, y uno por ronda, al empezar una ronda. Un oponente escrito con números simples no paga nada de una ficha, así que un límite nunca le afecta; un oponente escrito como ficha paga de sus propias reservas y queda sujeto al límite como cualquier otro. Capability API 1.47.
- `threat`: opcional y necesario para bestiarios. `tiers` es la escala de adversarios: ID, etiqueta, intervalo `health`, `defense`, `toHit`, intervalo `damagePerRound` y `saveDifficulty`. Cada criatura nombra un nivel; un adversario no escrito se adapta al que pidió el GM, sin salirse de tu escala. `damagePerRound` expresa lo que hace a UN objetivo por ronda, incluida toda su secuencia.
  Un nivel puede llevar `worth`, el valor que representa una criatura de ese nivel frente a un presupuesto de encuentro (los puntos de experiencia según el valor de desafío de 5e), y `threat` puede llevar `budget`, lo que puede contener una pelea para el grupo que la afronta (Capability API 1.803):
  - `level`: los campos numéricos cuya suma es el nivel de un miembro (5e: uno por clase).
  - `steps`: los pasos de dificultad, de menor a mayor, cada uno `{ "id", "label" }`.
  - `byLevel`: `[{ "level": 5, "worth": [500, 750, 1100] }]`, un valor por paso para un miembro de ese nivel en adelante, con los niveles en orden ascendente.
  - `crowd`: opcional, `[{ "from": 2, "times": 1.5 }]`, el factor por el que se multiplica el valor de los oponentes una vez que hay esa cantidad; `smallParty` y `largeParty` leen una fila más arriba para un grupo menor que el primero y una fila más abajo para uno mayor que el segundo (los multiplicadores de 5e 2014). Omítelo para el presupuesto de SRD 5.2, que suma los valores tal como son.
  - `forGame`: opcional, el paso en el que se juega cada dificultad del juego (`casual`, `normal`, `hard`, `brutal`). Si no se indica, toman los pasos en orden, y cualquiera que exceda el último se juega en el último.

  Se informa al Game Master del valor de cada nivel y del presupuesto del grupo antes de que escriba una pelea. Si inventa una pelea cuyo valor supera el presupuesto, se reduce: el oponente inventado de mayor valor baja un nivel, y vuelve a bajar hasta que se ajuste; una pelea con un jefe puede llegar al siguiente paso superior. Una criatura de bestiario y una que regresa de una pelea anterior se cuentan tal como son, y la pelea de una historia pertenece a su autor. Las reducciones se indican en los ajustes de la pelea.

### Salvaciones contra estados, daño o magia

Un modificador con `to: "saves"` puede llevar `against`. Necesita al menos uno de `conditions` (IDs de estado de la ficha), `damage` (tipos de daño) o `magic: true`. Basta con una coincidencia cualquiera; `saves` sigue restringiendo qué salvación, como una condición Y adicional. Usa el `mode: "advantage"` del modificador, no `effects`, para restringir la ventaja de esta forma. Estos modificadores funcionan en estados, en niveles de contador o derivados alcanzados y en efectos de objetos. Para los rasgos de raza, deriva un valor de la raza elegida en la ficha y vincula el modificador a un nivel que se alcanza cuando ese valor es 1. Modificadores de ejemplo:

```json
[
  {
    "$comment": "Dwarven Resilience",
    "to": "saves",
    "mode": "advantage",
    "against": { "conditions": ["poisoned"], "damage": ["poison"] }
  },
  { "$comment": "Fey Ancestry", "to": "saves", "mode": "advantage", "against": { "conditions": ["charmed"] } },
  {
    "$comment": "Gnome Cunning",
    "to": "saves",
    "saves": ["int_save", "wis_save", "cha_save"],
    "mode": "advantage",
    "against": { "magic": true }
  }
]
```

Brave usa `conditions: ["frightened"]`. Magic Resistance usa `magic: true` sin `saves`, en un nivel derivado de la ficha o un nivel de contador de una criatura. El `applies` de una acción cuenta aunque la salvación evite el estado; su daño incluye cada cláusula `plus`. Los nombres de daño se comparan sin distinguir mayúsculas de minúsculas. La magia es la cualidad `"magical"` de 1.101: las `mechanics.qualities` de un catálogo (incluso sin daño), el `damage.qualities` de la acción de una criatura o las etiquetas de un objeto arma. Un conjuro debe llevar esa cualidad; su nombre o su catálogo por sí solos no lo hacen mágico. Una salvación para terminar un estado, incluidos `saveWhenDamaged` y `saveEnds.at: "damaged"`, es solo contra ese estado. Las salvaciones de concentración y de muerte no son contra nada. Fuera del combate, las peticiones de salvación del Game Master no llevan un origen ni un estado estructurados; `against` nunca coincide con esas peticiones. La ficha, los detalles del objeto, los detalles de la batalla y el resumen de la ficha del Game Master muestran estas restricciones. Requiere schemaVersion 2 y capabilityApi 1.134 o posterior.

### Un combate tirado con reservas: `dice-pool`

Un conjunto `dice-pool` cuenta éxitos en vez de sumar dados, y sus combates también pueden hacerlo. `"kind": "dice-pool"` necesita que `resolution.kind` sea `"dice-pool"`, y lee la ficha como ya lo hacen tus pruebas de reserva: **cada número que suma una tirada es una cantidad de dados, y cada número con el que se compara es una cantidad de éxitos.** Así que no se renombra nada:

- Un número para acertar (el de una fila de ataque, el `toHit` de una lista de capacidades, el de una acción de criatura) es la reserva que tira un ataque. El dado, el objetivo que debe alcanzar un dado y las caras con las que se duplica, explota, cancela y pifia son las de tu `resolution`. El contador de heridas que nombra tu `resolution.penaltyFrom` resta su penalización de la reserva, igual que en una prueba.
- `defense` es cuántos éxitos necesita un ataque, y nunca menos de uno. El modificador de un estado a `defense` y la cobertura (`cover.bonus`, o `cover.threeQuarters`) se suman a ella.
- Cada éxito por encima de los necesarios añade un dado de daño. Una pifia falla, cuente lo que cuente. No hay críticos: un impacto fuerte vale sus dados extra.
- El número de una salvación es su reserva, y su dificultad, los éxitos que necesita. Un enfrentamiento tira la prueba de cada bando como reserva, y gana el bando con más éxitos.
- El modificador de un estado a ataques, salvaciones o pruebas son dados que se añaden o se quitan, así que es un número `flat`: un modificador tirado (`dice`) se rechaza.
- El daño son dados de tu dado: los `dice` de una cantidad (de una criatura, de una entrada) indican cuántos y deben ser de tu dado, y su parte `flat` son éxitos automáticos, que nunca se tiran. La columna de dados de daño de una fila de ataque se lee por su cantidad, `damage.ability` añade como dados la puntuación de ese atributo y `damage.bonus` añade éxitos automáticos. `perCostStep` y `scales` añaden dados, como siempre. La curación y los puntos temporales son cantidades, y se suman como antes.
- La iniciativa es una suma (`initiative.dice` y `modifier`), o una reserva si la pides (`initiative.pool`, abajo), y una regla de muerte conserva sus propios dados.

Lo que tira un combate de reservas más allá de eso es su bloque `pool`:

```json
"pool": {
  "advantage": true,
  "damageTarget": 6,
  "soak": { "roll": true, "byKind": { "knock": { "abilityMod": "sinew" } } }
}
```

- `advantage`: si una tirada que se inclina se tira dos veces y se conserva la que tiene más éxitos (una pifia cuenta como menos que cualquier tirada que no pifió). Sin él, un combate tira una vez diga lo que diga un estado.
- `damageTarget`: el objetivo por dado contra el que se tiran los dados de daño y de absorción. El objetivo predeterminado de tu resolución si lo omites. Esos dados cuentan una vez cada cara igual o superior a él y nada más: con ellos nada se duplica, explota, cancela ni pifia.
- `soak`: lo que un objetivo resta del daño que hace un impacto, por tipo de daño. `all` es una referencia de valor para cualquier tipo, y `byKind`, una por cada tipo de tu contador de salud, que tiene prioridad sobre `all` para su tipo; un tipo que no nombra ninguno de los dos no se absorbe. Con `"roll": true`, el objetivo tira esa cantidad de dados contra el objetivo de daño y cada éxito resta uno. Con `"roll": false`, el número se resta de los dados de daño antes de tirarlos, así que nunca afecta a los éxitos automáticos, que la absorción tirada resta como cualquier otro. Nada baja de cero, y no se tira nada para absorber un golpe que no contó nada. Una criatura da sus propios números como `soak: { "all": 1, "byKind": { "knock": 3 } }`, lo que necesita que el `soak` del bloque indique cómo se absorbe. La resistencia, la vulnerabilidad, la inmunidad y `resist-all` se aplican después de la absorción, a lo que queda.
- `hardness`: una referencia de valor para la dureza de un combatiente, si la iniciativa es un número que mueven los ataques. Consulta [Armadura y efectos puestos en un combate](ruleset-items.md#armor-and-worn-effects-in-a-fight).

El daño de cada objetivo se tira para ese objetivo, porque lo que ganó un impacto por encima de los éxitos necesarios, y lo que absorbe, es suyo. La segunda cláusula de un golpe y un efecto adicional son cada uno su propia reserva de daño de su propio tipo, sin dados extra del impacto. El menú prevé una reserva con exactitud: la probabilidad de alcanzar los éxitos necesarios y lo que valen los dados de daño después de lo que absorbe el primer objetivo.

Gravewatch está escrito así: sus guardianes tiran una puntuación y un oficio, absorben los golpes contundentes con Sinew y no absorben en absoluto los desgarros, pueden gastar un punto de Resolve por turno y vuelven a tirar la iniciativa cada ronda.

**Declarar en orden inverso no está implementado.** Algunos sistemas hacen que todos declaren su acción antes de que nadie actúe, empezando por el más lento. En un combate donde cada combatiente elige una acción cuando llega su turno, declarar primero no cambia nada que lea ninguna regla, así que no hay nada que pueda decir una clave.

<a id="a-fight-thrown-in-symbol-dice-symbol-pool"></a>

### Un combate tirado con dados de símbolos: `symbol-pool`

Un conjunto `symbol-pool` lee símbolos en vez de números, y sus combates también pueden hacerlo, así que el motor resuelve toda la pelea sin preguntar al Game Master qué compró una ventaja. `"kind": "symbol-pool"` necesita que `resolution.kind` sea `"symbol-pool"` y lee la ficha como ya lo hacen tus pruebas de símbolos:

- El número para acertar son los dados del atacante. En una ficha, el número de una fila de ataque combina su atributo y los rangos de su habilidad: el mayor indica cuántos dados se tiran y el menor cuántos se mejoran, igual que `pool.build: "larger-upgraded"` construye una prueba. Una acción de criatura lo expresa con `toHit` (sus dados) y `upgrades` (cuántos se mejoran), que necesita una reserva con un dado `upgrade` que no se construya mediante `sum`.
- `defense` indica cuántos dados de dificultad se tiran contra los del atacante. La `defense` de una criatura es su propio número de estos dados. La cobertura y el modificador a `defense` de un estado añaden dados de dificultad.
- El modificador de un estado a ataques, salvaciones o pruebas, y la penalización por heridas que nombra tu `penaltyFrom`, son dados de impulso cuando ayudan y de contratiempo cuando perjudican, así que son números `flat`: se rechaza un modificador tirado (`dice`). Una tirada inclinada hacia un lado (larga distancia, la desventaja de un estado) tira un dado de contratiempo más, o un dado de impulso más si se inclina hacia el otro.
- Los éxitos netos (la cantidad que indica tu `success.needed`) hacen acertar un golpe. El número de una salvación son sus dados y su dificultad los dados contra ellos; un enfrentamiento tira los dados de cada bando y gana el que tenga más éxitos netos. La iniciativa puede tirarse como reserva (`initiative.pool`): sus éxitos netos son el número.
- El daño se suma como en un combate `attack-vs-defense`. Cada éxito neto añade `damage.perSuccess` (uno) a un impacto, todos los éxitos (`"counts": "all"`) o solo los que superan los necesarios para acertar (`"beyond"`), y la absorción del objetivo se resta del golpe entero, sin bajar de cero.
- Nada causa una pifia ni duplica una tirada de daño. Un crítico es algo que se compra con un gasto.

Lo que hacen los símbolos lo define el bloque `symbols`:

```json
"symbols": {
  "damage": { "perSuccess": 1, "counts": "all" },
  "soak": { "all": { "derived": "soak" } },
  "spends": [
    { "id": "boost", "label": "Boost an ally", "by": "attacker", "symbol": "a", "cost": 1, "boost": { "dice": 1, "on": "attacker-ally" } },
    { "id": "crit", "label": "Critical", "by": "attacker", "symbol": "a", "cost": 2, "when": "hit", "critical": true, "condition": { "id": "injured", "on": "target", "rounds": 3 } },
    { "id": "triumph", "label": "Triumphant blow", "by": "attacker", "symbol": "t", "cost": 1, "when": "hit", "critical": true, "damage": 2 },
    { "id": "strain", "label": "Overextend", "by": "target", "symbol": "h", "cost": 2, "track": { "id": "strain", "by": 1, "on": "attacker" } },
    { "id": "setback", "label": "Opening", "by": "target", "symbol": "h", "cost": 1, "setback": { "dice": 1, "on": "attacker" } },
    { "id": "despair", "label": "Weapon slips", "by": "target", "symbol": "d", "cost": 1, "condition": { "id": "disarmed", "on": "attacker" } }
  ]
}
```

- `soak`: lo que un objetivo resta de cada impacto, leído en su ficha. `all` es una referencia de valor para cualquier tipo de daño y `byKind` una por cada tipo de tu contador de salud, que tiene prioridad sobre `all` para su tipo. Una criatura da la suya con `soak: { "all": 2 }`, que necesita que se declare este `soak`.
- `spends`: hasta 16 cosas que puede comprar un símbolo que quede en la tirada de un ataque. `cost` de `symbol` lo compra una vez, y `max` (uno) indica cuántas veces puede comprarlo una tirada; un gasto que da un `condition` o un `critical` se aplica una sola vez, así que su `max` se queda en uno, y dos gastos no aplican un mismo estado (ni dos de un tipo `oneAtATime`) al mismo combatiente en la misma tirada. Un gasto no se compra si no haría nada: su estado no se aplicaría (se impide, o ya se tiene uno de su tipo) o su contador no tiene espacio para un paso entero en esa dirección (espacio que puede haber usado un gasto anterior de la misma tirada). `by` indica qué bando lo elige: el atacante gasta los símbolos que le favorecen (ventaja, triunfo) y el objetivo los que favorecen al objetivo (amenaza, desesperación). Un solo bando gasta un símbolo dado, y un gasto nunca compra con los éxitos, que ya hacen acertar el golpe y aumentan su daño.
- `when`: solo se compra en un `hit`, solo en un `miss` o en cualquiera (`any`, el predeterminado). `damage` (daño añadido al impacto, antes de la absorción) y `critical` (el impacto es crítico, así que se aplica una cláusula que diga `onCritical` y el registro lo indica) necesitan `"when": "hit"` y `"by": "attacker"`.
- Lo que hace un gasto, cualquiera de estas opciones: `condition` aplica uno de tus estados a alguien, durante `rounds` o hasta que algo lo termine; `track` mueve un contador vivo ordinario en `by` (tensión, estrés), nunca el contador de salud; `boost` y `setback` añaden esa cantidad de dados a la siguiente tirada que haga en este combate quien los recibe, y esa tirada los consume. `on` es `attacker`, `target`, `attacker-ally` o `target-ally`; un aliado es el siguiente de ese bando en actuar, y un gasto que no tiene a nadie que pueda ser ese aliado no se compra.
- `worth`: opcional, el valor que la IA asigna al gasto en puntos de daño. Sin él, el motor lo calcula a partir de los efectos: el daño vale sus puntos, un estado vale dos, un dado en la siguiente tirada un poco más de medio punto y un paso de un contador medio punto, contra el otro bando, o para el propio bando de quien elige cuando baja un contador o añade impulso a ese bando. Un gasto que no vale nada para quien lo elige nunca se compra.

El motor compra, para cada bando, los gastos de mayor valor que permiten los símbolos que tiene, tanto para jugadores como para oponentes, e indica cada uno en el registro. Un jugador puede elegir los suyos: con "Choose my own symbol spends" (Elegir mis propios gastos de símbolos) marcado en la pantalla de combate, una tirada que deja algo que comprar a un miembro del grupo que controla espera mientras elige los gastos uno a uno, acepta la elección del motor para el resto o deja de gastar. Su elección sigue las mismas reglas que la del motor (coste, `max`, `when` y lo que se aplicaría), y el motor sigue eligiendo por todos los demás. El conjunto no necesita nada para ello. Los símbolos que nadie gasta quedan en la tirada para que los narre el Game Master. La previsión del menú cuenta todos los resultados posibles de la tirada: la probabilidad de acertar y el daño que causa un impacto con sus éxitos y gastos, después de la absorción. La IA valora cada ataque según ello, restando lo que le costarían los gastos del otro bando.

**Lo que sigue en manos del Game Master.** El coste de un gasto pertenece al conjunto, no a cada arma, así que un arma con su propia puntuación de crítico se escribe como un gasto compartido por el conjunto; la tabla propia de un crítico la tira el Game Master. La ventaja en una salvación, una prueba o un enfrentamiento no compra nada: solo se gasta la tirada de un ataque. Mejorar los dados de dificultad en un combate no está implementado.

### Dados de daño mínimos

Un combate de reservas puede conservar dados incluso contra una absorción alta, como hace el **Overwhelming** de Exalted:

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

Esto es `combat.damage.minimum`, una referencia de valor que se lee de la ficha actual del **atacante**. Después de que la absorción estática quite dados a la primera reserva de daño de un impacto, la reserva sube al menos hasta este número. Son dados enteros, redondeados hacia abajo y limitados entre cero y `resolution.pool.max`, no éxitos automáticos: cada dado que sobrevive puede fallar. La absorción tirada sigue quitando éxitos después de la tirada de daño; no reduce una reserva de dados, así que el mínimo no protege los éxitos frente a ella. La resistencia y la inmunidad se siguen aplicando. Los golpes que gastan iniciativa ignoran el mínimo, igual que ignoran el daño del arma y la absorción; los golpes que quitan iniciativa lo usan.

Un arma puede sustituir el mínimo común con `item.attack.damage.minimum`. Acepta las mismas referencias de valor sobre quien la sostiene, o `{ "stat": "overwhelming" }` para una de las estadísticas numéricas propias del objeto. Un cero declarado también sustituye al mínimo común. Esto es distinto del `floor` de arma existente, que garantiza una cantidad de daño después de la absorción. Las cláusulas de daño adicionales y los efectos adicionales no reciben otro mínimo. El registro del combate y el diario muestran el mínimo resuelto junto a los dados. Tanto la clave de combate como la clave del arma requieren **Capability API 1.146** en un paquete, incluidas las armas de archivos de catálogo externos.

### Un impacto que aturde

```json
"daze": {
  "over": { "abilityScore": "stamina" },
  "measure": "damage",
  "condition": "dazed",
  "text": "The blow leaves them reeling until their next turn passes."
}
```

`combat.daze` es para los combates de reservas. `over` lee la ficha actual del **objetivo**, justo antes del impacto. Un solo impacto debe infligir **estrictamente más** daño que ese número, después de la absorción, las salvaciones y la resistencia. Sus cláusulas de daño cuentan juntas; los impactos separados nunca se acumulan para aturdir. En un contador que marca por golpe, un impacto que causa daño cuenta como un nivel. Un golpe que quita iniciativa en vez de salud no puede aturdir. Por ahora, `measure` solo es `"damage"`.

El objetivo se salta exactamente su siguiente turno. Los impactos que aturden antes de ese turno no acumulan más turnos saltados. El turno saltado sigue haciendo avanzar los relojes de los estados y el resto de la contabilidad de turnos, incluidos los cambios de ronda y la iniciativa que se vuelve a tirar. Guardar y volver a cargar el combate conserva el salto pendiente. `condition`, cuando aparece, nombra un estado declarado de la ficha. El combate lo marca hasta que pasa el turno saltado o termina el combate. Un estado que ya estaba presente se deja como está; la inmunidad al estado impide la marca, pero no el salto. `text` es una narración opcional, no otro efecto. El registro y el contexto de combate del Game Master registran el impacto y el salto. La clave requiere **Capability API 1.147**.

### El objetivo elige el tipo de herida

Añade `remap` a la asignación existente `combat.damageKinds`; conserva su `default`, `byType` y `marks`:

```json
"damageKinds": {
  "default": "bashing",
  "byType": { "bullet": "lethal", "fire": "aggravated" },
  "marks": "per-point",
  "remap": [
    { "when": { "field": "vampire" }, "from": "lethal", "to": "bashing", "tags": ["firearm"] }
  ]
}
```

Un combate de reservas elige primero el tipo del ataque con su asignación normal y después lee el `when` de cada reasignación en el **objetivo**. Un número distinto de cero activa la regla. `from` y `to` deben ser tipos del contador de heridas de salud. Gana la primera regla que coincide; las reasignaciones no se encadenan. Se pueden dar como máximo 12. Con `tags`, al menos una debe coincidir con el ataque: un arma ya lleva `item.tags`, y las mecánicas de catálogo y el daño de las criaturas ya llevan `qualities`. Estos nombres proceden de `items.tags`. Sin `tags`, puede coincidir cualquier ataque de ese tipo. No hace falta ningún campo nuevo de etiqueta de ataque.

El tipo resultante decide tanto la **absorción** como las marcas de herida. Así, el impacto letal de un arma de fuego puede volverse contundente contra un vampiro y usar la absorción contundente; la misma arma de fuego contra otra persona, o una hoja contra ese vampiro, conserva su tipo normal. El _tipo_ de daño original del ataque no cambia para la resistencia y la inmunidad. Cada cláusula de daño usa su propio tipo y las etiquetas del ataque. El registro del combate y el diario muestran los tipos original y reasignado, y la previsión de daño lee la misma regla. Una criatura simple sin ficha puede cumplir una referencia constante, pero no puede aportar valores de ficha para estas reglas; dale una ficha de criatura para eso. Solo la nueva clave `remap` requiere **Capability API 1.148**; las asignaciones de tipos de daño anteriores mantienen su compatibilidad actual.

### Iniciativa que mueven los ataques

Algunos sistemas de reservas mantienen la iniciativa como un número durante todo el combate y permiten que los ataques la muevan: una forma de atacar se la quita al objetivo, otra gasta la del propio atacante como daño, y quien cae hasta una línea fijada se derrumba. Un combate `dice-pool` puede expresarlo (Capability API 1.48):

```json
"initiative": {
  "pool": { "abilityMod": "nerve" },
  "plus": 3,
  "resource": {
    "base": 3,
    "styles": [
      { "id": "press", "label": "Press", "takes": { "gain": 1 } },
      { "id": "telling", "label": "Telling blow", "spends": { "onMiss": [[0, 1], [6, 2], [11, 3]] } }
    ],
    "crash": { "at": 0, "condition": "reeling", "bonus": 5, "recoverAfter": 3 }
  }
}
```

- **La apertura.** Todos tiran `pool` dados al empezar el combate, y los éxitos más `plus` son su número, así que `resource` necesita `pool`: los dados sumados son un orden, no una cantidad de dados. El `initiativeModifier` de una criatura es su reserva, porque cada número que suma un combate de reservas son dados. El número se conserva: nunca se vuelve a tirar (`each` se rechaza junto a `resource`), y al empezar cada ronda el orden se ordena según los números tal como estén.
- **Estilos.** Cada ataque (una fila de ataque, una capacidad o entrada de catálogo que tira para acertar y causa daño, una acción de criatura que lo hace y una acción formada por otras acciones) se ofrece una vez por estilo, y un jugador elige el estilo antes que el objetivo. Hasta cuatro, cada uno toma o gasta, y al menos uno toma. Una elección que no nombra ningún estilo se hace en el primero; se rechaza una en la que no se ofrece el ataque. Un ataque conserva el estilo con el que se hizo hasta que termina, aunque una respuesta cambie el número de quien lo hace antes de que impacte.
- **Un estilo que toma.** Al impactar, el daño se tira como siempre (los dados extra del impacto, los dados del arma, la absorción por tipo, los éxitos automáticos), y lo que cuenta se resta del número del objetivo en vez de su salud. El atacante gana todo eso más `gain`.
- **Un estilo que gasta.** Solo se ofrece mientras el número del atacante esté por encima de la línea de derrumbe (0 si no das `crash`), y nunca para una acción formada por otras acciones, porque un número se gasta en un solo golpe. Al impactar, el daño es el número del atacante en el momento de hacer el ataque, en dados contra el objetivo de daño, y nada más: sin dados del arma, sin dados extra del impacto, sin éxitos automáticos, sin absorción. Marca la salud con el propio tipo de daño del ataque. Una vez terminado el ataque, un número que impactó en alguien vuelve a `base`, y uno que no impactó en nadie pierde lo que indica `onMiss` según el número con el que se hizo (una tabla por peldaños: pares `[at least, lose]`, ascendentes; nada por debajo del primer peldaño).
- **Derrumbarse.** Un número que cae hasta `crash.at` o por debajo se ha derrumbado: se le aplica la `condition` (uno de tus propios estados, y opcional), y quien lo llevó hasta ahí gana `bonus`. Un fallo que derrumba a quien lo hizo no da bonificación a nadie. Un combatiente derrumbado no puede gastar. El derrumbe se levanta, estado incluido, cuando su número vuelve a superar la línea, después de `recoverAfter` de sus propios turnos (su número vuelve a `base` al empezar ese turno) y cuando termina el combate, termine como termine. Alguien cuya tirada de apertura esté en la línea o por debajo empieza el combate derrumbado. `base` debe estar por encima de `crash.at`, o volver a él lo derrumbaría de nuevo.

El menú muestra la previsión propia de cada estilo: la probabilidad de impactar, y lo que tomaría un estilo que toma o el daño que haría uno que gasta. El panel de estado muestra el número de todos, y el registro indica cada cambio y su motivo: "Ada gains 5 initiative for crashing Rats, and is on 14." El selector del motor evalúa un golpe que toma con un turno de antelación: tomar y después gastar frente a gastar ahora y de nuevo desde la base.

<a id="what-a-fight-reads-from-mechanics"></a>

### Qué lee un combate de `mechanics`

`kind` determina si `amount` es daño o curación; cualquier entrada marcada como `reaction` queda fuera del menú, al igual que una entrada `utility`, salvo que cambie lo que puede contener el propio turno (véase más abajo). `attackRoll` realiza una tirada contra la defensa del objetivo con el `toHit` de la lista; `autoHit` omite por completo ese paso. `save` tira la salvación del propio objetivo contra la `saveDifficulty` de la lista, y `onSuccess` determina si un éxito recibe la mitad o nada. `targetCount` indica a cuántos objetivos puede dirigirse. Una capacidad que no tira para atacar (un área contra la que todos realizan una salvación, algo que impacta directamente) tira sus dados UNA VEZ para todos ellos; una que tira para impactar a cada objetivo vuelve a tirar sus dados por cada impacto. `applies` impone condiciones a lo que afecta, cada una con una `duration` de `instant` (sin reloj propio: permanece hasta que algo la retire), `until-save` (que necesita `saveEnds` a su lado) o `{ "rounds": n }`, y un `saveEnds` opcional que identifica la salvación y si se repite en `turn-end` o `turn-start`. Las rondas descuentan los turnos propios del portador a medida que termina cada uno; `{ "rounds": 1, "at": "turn-start" }` los cuenta a medida que empieza cada uno, que es como se dice "hasta el inicio de tu siguiente turno". `"of": "source"` (Capability API 1.119) cuenta en su lugar los turnos de quien lo aplicó, empezando por el siguiente, que es como se dice de otra persona "hasta el final de tu siguiente turno". El `{ "duration": { "rounds": 1, "of": "source" }, "endsAfter": "attacked" }` de Guiding Bolt da ventaja a la siguiente tirada de ataque contra su objetivo antes del final del siguiente turno del lanzador. Si el origen sale del combate, las rondas se cuentan en los propios turnos del portador. Los `delays` de un estado de combate (Capability API 1.120) retienen lo que usa quien lo tiene: una acción de uno de sus `catalogs`, pagada con su `budget`, tira un dado de `chance.sides` y, con `chance.atLeast` o más, todavía no ocurre. Al empezar el siguiente turno de quien lo tiene, se completa con ese mismo presupuesto y sigue como habría seguido, respuestas incluidas, y si no puede actuar o no le queda nada de ese presupuesto, se pierde. Lo que costó sigue gastado en ambos casos. El Slow de 5e es `"delays": { "catalogs": ["spells"], "budget": "action", "chance": { "sides": 20, "atLeast": 11 } }`. `endsAfter` quita el estado tras el primer `own-attack` (la siguiente tirada de ataque del portador), `attacked` (la siguiente tirada de ataque contra el portador) u `own-save` (la siguiente salvación del portador), diga lo que diga su reloj, así que `{ "duration": { "rounds": 1 }, "endsAfter": "own-attack" }` es "en su siguiente ataque antes del final de su siguiente turno". Uno que dura un ataque dura todo el ataque, daño incluido, y uno nuevo que aplica el mismo golpe se queda. Ambos necesitan Capability API 1.45. `temporary` concede puntos temporales a la reserva de salud, que nunca se acumulan: se conserva la protección mayor. `scales` aumenta la cantidad con los DADOS adicionales que su tabla indica para el valor que lee. `cost` se paga mediante el comando `use` de la propia ficha, y `budget` sustituye qué parte de la economía se consume.

`plus` contiene hasta tres cantidades MÁS en el mismo golpe, junto a `amount`, cada una con su propia tirada y tipo ("and 2d6 fire"). Una cláusula es `{ "dice": "2d6", "flat": 1, "type": "fire" }` y puede llevar su propia `save`, `{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`, que tira el OBJETIVO con independencia de lo que ya le haya exigido la acción: `none` elimina toda esa cláusula con un éxito y `half` deja la mitad, mientras que el resto del golpe no cambia en ninguno de los casos. Sin `difficulty`, utiliza el número de la salvación de la propia acción y, después, la `saveDifficulty` de la lista. Un crítico duplica los dados de cada cláusula con la misma regla que duplica los de la primera cantidad; una cláusula sin `type` utiliza el tipo de daño del propio golpe, y el golpe completo sigue siendo UNA prueba de concentración, con el daño sumado, y una prueba para caer. Una cláusula necesita un `amount` al que acompañar, y un `heal` no lleva ninguna.

```json
{
  "kind": "attack",
  "attackRoll": true,
  "amount": { "dice": "1d8" },
  "damageType": "piercing",
  "plus": [{ "dice": "2d6", "type": "fire" }]
}
```

Tres claves indican qué hace una entrada con la economía del propio turno, y una entrada `utility` que declare cualquiera de ellas se ofrece en lugar de descartarse:

- `free`: no consume ningún presupuesto. Sigue pagando el `cost` que indique y no puede indicar también un `budget`.
- `gives`: `[{ "budget": "action", "count": 1 }]`, hasta cuatro. Usarla añade esos presupuestos en ese mismo momento, con un límite igual a lo que contiene un turno más lo concedido, para que nada pueda ahorrarse para un turno posterior.
- `standard`: `{ "actions": ["dash", "disengage", "hide"], "budget": "bonus" }`. Su poseedor puede realizar esas acciones estándar con ESE presupuesto. Se ofrecen junto a las ordinarias como `standard:<id>@<budget>`, y la propia entrada queda fuera del menú cuando solo concede ese permiso, porque un permiso no es algo que se ejecute.

Una entrada del nuevo `kind: "rider"` es PASIVA: nadie la ejecuta, nunca aparece en el menú y añade automáticamente una cláusula de daño al primer impacto que cumpla los requisitos en un período. Lleva `rider` y nada más que pueda ejecutarse:

```json
{
  "kind": "rider",
  "rider": {
    "on": "hit",
    "sources": ["attacks"],
    "requires": { "column": "finesse" },
    "when": ["advantage", "ally-adjacent-no-disadvantage"],
    "oncePer": "turn",
    "amount": { "dice": "1d6" }
  },
  "scales": {
    "from": { "field": "level" },
    "table": [
      [1, 0],
      [3, 1]
    ]
  }
}
```

`sources` identifica las listas de ataques de las que procede y `requires` una columna de sus filas con valor verdadero, de modo que un efecto adicional que solo se activa con ciertas armas puede especificarlas sin que Engine sepa qué es un arma; no indicar ninguna significa cualquier impacto de su poseedor. Un arma empuñada desde la bolsa no es una fila, así que `weapons` (Capability API 1.70) nombra además las propiedades de objeto con las que se activa: `"weapons": { "tags": ["finesse", "ranged"] }` se activa con un impacto de un arma empuñada que tenga cualquiera de esas propiedades, incluido su golpe con la mano secundaria. Nombrar solo `weapons` no se activa con ninguna fila, y nombrar solo filas no se activa con ninguna arma empuñada. `when` acepta CUALQUIERA de sus opciones: `advantage` es la inclinación final de la tirada de ataque, y `ally-adjacent` es un aliado del atacante que esté en pie y pueda actuar, a una casilla del objetivo en un tablero o en cualquier lugar si no hay tablero. `ally-adjacent-no-disadvantage` (Capability API 1.126) exige además que la tirada final no tenga desventaja una vez que la ventaja y la desventaja se anulan; el ejemplo anterior lo usa para Sneak Attack. `oncePer` es `turn` (se renueva al inicio de todos los turnos, de modo que un golpe realizado mientras actúa otra persona todavía puede incluir uno) o `round`. `amount` crece con el `scales` de la propia entrada, y `type` es el tipo de daño, cuyo valor predeterminado es el del propio golpe.

<a id="creatures-a-bestiary-a-fight-reads"></a>

### Criaturas: un bestiario que lee el combate

Un catálogo que declara `"holds": "creatures"` contiene oponentes en lugar de filas de ficha. No alimenta ninguna lista, el selector del editor de fichas nunca lo ofrece y todos sus números se escriben con las claves que ya declara tu bloque `combat`. Necesita un bloque `combat` y una escala `threat`, porque cada criatura se clasifica en uno de tus propios niveles.

```json
{
  "id": "road_trouble",
  "label": "Road trouble",
  "holds": "creatures",
  "filters": [{ "id": "tier", "label": "How bad", "type": "text" }],
  "entries": [
    {
      "id": "rust-jackal",
      "label": "Rust Jackal",
      "summary": "A lean thing that lives on the metal roads.",
      "filters": { "tier": "Pack trouble" },
      "creature": {
        "health": { "dice": "3d6" },
        "defense": 6,
        "initiativeModifier": 1,
        "speed": 16,
        "abilities": { "brawn": 1, "wits": 0, "heart": -1 },
        "tier": "pack",
        "actions": [
          {
            "id": "bite",
            "name": "Bite",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d6", "flat": 1, "type": "cut" },
            "reach": 2
          },
          {
            "id": "worry",
            "name": "Worry",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d4", "type": "cut" },
            "applies": [{ "condition": "shaken", "duration": { "rounds": 2 } }]
          },
          {
            "id": "snap_and_worry",
            "name": "Snap and worry",
            "budget": "act",
            "sequence": [
              { "action": "bite", "times": 1 },
              { "action": "worry", "times": 1 }
            ]
          }
        ]
      }
    }
  ]
}
```

Los números siguientes son la forma directa de escribir una criatura. Una escrita en los términos de tu propio conjunto de reglas, como `sheet`, obtiene de esa ficha `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`, `checks`, `soak` y `hardness` (véase "Una criatura escrita en los términos de tu conjunto de reglas", más abajo).

- `health`: un número, o `{ "dice": "3d6", "flat": 2 }`, que se tira una vez al crear el combate. Una previsión lee la media, de modo que un menú nunca promete un dado que nadie ha tirado.
- `defense`, `initiativeModifier`, `speed`: contra qué se tira un ataque, qué se suma a la iniciativa (o, si la iniciativa se tira como reserva, cuántos dados tira) y cuánto camina en un turno, en tu propia unidad de distancia.
- `abilities` y `saves`: usan como claves los identificadores de características y salvaciones que declara tu ficha. Una salvación no indicada se lee como cero.
- `checks`: lo que suma en un enfrentamiento, con los IDs de `combat.checks` como claves. Uno no indicado se lee como cero. Capability API 1.43.
- `soak`: solo en un combate `dice-pool`, lo que absorbe: `all` para cualquier daño, `byKind` para un tipo de tu contador de salud. Capability API 1.47.
- `hardness`: si la iniciativa es un número que mueven los ataques, un golpe que gasta cuyos dados están por debajo de ella no hace nada. Capability API 1.56.
- `speeds` y `hover`: cómo se mueve además de caminar (consulta Otras formas de moverse, en Posiciones). Capability API 1.113.
- `shield: true`: tiene las manos ocupadas, así que no se aplica la alternativa `twoHanded` de una acción. Capability API 1.102.
- `size`: uno de los `combat.sizes`, por ID, que lee el `maxSizeAbove` de un enfrentamiento (consulta Tamaños y CD de escape). Capability API 1.103.
- `type` y `tags`: uno de los `combat.creatureTypes.types` y hasta ocho de sus `tags`, por ID, que leen las pruebas de objetivo (consulta Tipos de criatura y pruebas de objetivo). Capability API 1.168.
- `resist`, `vulnerable`, `immune`: tipos de daño, comparados sin distinguir mayúsculas, que se validan contra `combat.damageTypes` cuando declaras alguno. Una entrada `resist` o `immune` también puede indicar qué la atraviesa, `{ "type": "tearing", "except": ["silver"] }`: un golpe de un objeto arma con una de esas propiedades de objeto se recibe tal cual (Capability API 1.55, consulta [Armas en un combate](ruleset-items.md#weapons-in-a-fight)), igual que una acción cuyo `damage.qualities` o una entrada de catálogo cuyas `mechanics.qualities` nombren una (Capability API 1.101). `conditionImmunities` identifica tus propias condiciones, o un contador que leen tus `combat.levels` (Capability API 1.115).
- `tier`: a qué peldaño de `combat.threat` pertenece.
- `loot` (Capability API 1.63): el ID de la tabla de botín que tira un combate ganado por ella (consulta [Botín](ruleset-items.md#loot)).
- `inventory` (Capability API 1.795): lo que puede llevar encima al comenzar una pelea, hasta 16 líneas. Cada línea nombra uno de tus objetos (`item`, como `<catalog>/<entry>`) o una de tus tablas de botín (`table`), con `chance` (sobre cien, valor predeterminado 100) y `count` (un número o dados, valor predeterminado 1; se tira en una tabla esa cantidad de veces). Usa lo que puede en la pelea: una criatura con una `sheet` usa sus objetos como un miembro del grupo, y un bloque de estadísticas simple usa un objeto cuyo `use` se agota al usarlo y no lee nada de su usuario (una poción, un aceite). Lo que le quede cae cuando es derrotada, junto a su `loot`; una que huye se lo lleva. El Game Master puede, en cambio, darle a un oponente su propio inventario (`carrying` en el encuentro), que sustituye a estas líneas.
- `traits`: pares breves de nombre y texto que se muestran al Game Master. Nunca se resuelven, por lo que cualquier cosa con números pertenece a una acción.
- `signaturePoints`: puntos que se recuperan al inicio de su propio turno y se gastan en acciones `signature`.
- `riders`: hasta cuatro, equivalentes al `rider` de una entrada de catálogo, escritos en el bloque. Cada uno es `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, con un `type` opcional y un `actions` opcional que indica con cuáles de las acciones del propio bloque se activa. El efecto adicional de un bloque no lee ninguna lista de ficha, por lo que no tiene las claves `sources` y `requires`. Una criatura escrita como ficha obtiene los efectos adicionales de sus listas, exactamente igual que un personaje.
- `actions`: hasta doce, cada una con su propio `id`. Una acción lleva lo mismo que un bloque de estadísticas escrito a mano (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`), más cuatro cosas exclusivas de las criaturas. `reach` indica hasta dónde golpea, `range` hasta dónde se lanza o dispara y `area` la forma en la que impacta, todo en tu propia unidad de distancia; `range` puede ser un número simple o `{ "normal": 30, "long": 120 }` si llega más lejos con una penalización, y `area` es `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (véase Posiciones):
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. Cuando se agotan, la acción sale del menú.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Empieza el combate disponible, se gasta al usarla y se tira al inicio del propio turno de la criatura: `from` o más la recupera. El registro incluye los dados en ambos casos.
  - `damage.alternatives` (Capability API 1.102): hasta cuatro cantidades que inflige en lugar de la primera, cada una `{ "when": ..., "dice": "1d10", "flat": 3 }`; gana la primera que se cumple. El tipo, las cláusulas y las cualidades siguen siendo los de la acción. `"when": "twoHanded"` se cumple salvo que la criatura tenga `"shield": true`, que es el "o 8 (1d10 + 3) de daño cortante si se usa a dos manos" de 5e; `"when": { "selfHealthAtMost": 0.5 }` se cumple mientras su salud sea como máximo esa parte de su máximo, que es el "o 5 (2d4) de daño perforante si al enjambre le quedan la mitad de sus puntos de golpe o menos" de un enjambre. La previsión del menú y el golpe la leen tal como está.
  - `sequence`: otras acciones del mismo bloque, en orden, cada una con su propio objetivo. **Así se escribe una criatura que golpea dos veces con una sola acción.** Un presupuesto paga toda la secuencia. Una secuencia no lleva nada propio y nunca puede identificar otra secuencia.
  - `signature`: `{ "cost": n }`, se compra con los puntos de la propia criatura en lugar de un presupuesto y solo mientras actúa otra persona: el combate la ofrece en la ventana entre un turno y el siguiente (véase Ventanas).
  - `reaction`: el mismo objeto que el `mechanics.reaction` de una entrada de catálogo (consulta Ventanas): la acción no está en el menú de ningún turno y se ofrece en su lugar en el momento que nombra. Una reacción no es también una acción distintiva, y ninguna secuencia puede crear una.
  - `self: true`: recae sobre la propia criatura en vez de sobre otra persona, así que no lleva `targetCount` ni `area`. Ambos necesitan Capability API 1.46. Una Parry es ambas cosas, con un estado `parrying` que suma 2 a la defensa:

    ```json
    {
      "id": "parry",
      "name": "Parry",
      "budget": "reaction",
      "self": true,
      "reaction": { "on": "hit" },
      "applies": [{ "condition": "parrying", "duration": { "rounds": 1 }, "endsAfter": "attacked" }]
    }
    ```
- Una salvación necesita una dificultad en la propia acción: `save.difficulty` para una salvación que impone la acción, o `saveDifficulty` para una condición que termina con una salvación cuando la acción no tiene la suya propia. Una acción de bloque se escribe con números simples incluso en una criatura con ficha, así que ese número reside en la acción. La salvación de una cláusula puede omitir su `difficulty` y recurrir al mismo número.
- `damage.plus` es la misma lista de cláusulas que el `plus` de una entrada de catálogo y se lee exactamente igual: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` es un mordisco cuyo calor tiene su propia cantidad, a la que se aplica resistencia y que se duplica por separado.

Una acción de criatura puede devolver puntos de golpe con `heal` (dados, una cantidad fija o ambos), limitados al máximo de su objetivo. `targets: "ally"` alcanza a su propio bando, incluida ella misma; `targets: "any"` alcanza a cualquiera de los dos bandos. Sin `targets`, alcanza al otro bando como antes. Estas claves necesitan Capability API 1.121. Una curación no lleva `damage`, `toHit`, `save` ni `area`; `targets` no acepta `self` ni `sequence`, y una secuencia no lleva ninguna de las dos claves. El Healing Touch de un deva es:

```json
{
  "id": "healing_touch",
  "name": "Healing Touch",
  "budget": "action",
  "heal": { "dice": "4d8", "flat": 2 },
  "targets": "ally",
  "uses": { "per": "day", "count": 3 }
}
```

El `spellcasting` de una criatura (Capability API 1.123) lanza conjuros de catálogo sin gastar espacios ni puntos. Su `saveDifficulty` y su `toHit` aportan los números del conjuro; una criatura con `sheet` puede omitirlos para usar los números de lanzamiento de conjuros de su ficha. Una criatura simple debe aportar cualquier número que necesiten sus conjuros. Cada `entry` nombra una entrada de catálogo existente con `mechanics`. Si se omite `uses`, es a voluntad; `level` es el nivel de lanzamiento para escalar con `perCostStep`, o la base de la entrada si se omite. La entrada sigue aportando su presupuesto, sus objetivos, su concentración, sus reacciones, sus áreas y sus invocaciones. La lista de una dríade podría escribirse así; estos IDs de conjuro son ilustrativos y deben aportarse en un catálogo `spells`:

```json
"spellcasting": {
  "saveDifficulty": 14,
  "spells": [
    { "entry": "spells/druidcraft" },
    { "entry": "spells/entangle", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/goodberry", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/barkskin", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/pass-without-trace", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/shillelagh", "uses": { "per": "day", "count": 1 } }
  ]
}
```

Para un aquelarre de brujas, añade `"coven": { "id": "marsh_hags", "size": 3, "within": 30 }` junto a `spells` y `"coven": true` en cada conjuro compartido. Esos conjuros solo se ofrecen mientras al menos tres combatientes en pie del bando del lanzador lleven ese ID de aquelarre, cada uno a 30 unidades de distancia del conjunto o menos del lanzador, medidas en casillas sin más. Sin tablero, cuentan todos los miembros en pie. Los usos de cada conjuro son una reserva compartida por todo el aquelarre, identificada por el ID del aquelarre y la entrada. Un bloque de aquelarre necesita un conjuro de aquelarre y un conjuro de aquelarre necesita el bloque; se rechazan las entradas duplicadas. Una criatura que propone el Game Master pierde `spellcasting` al ajustarse, porque una escala de amenaza no puede limitar una lista de conjuros.

La copia de prueba de un borrador de 5e del Engine, `docs/development/ruleset-5e-2014.example.json`, contiene un bestiario de cinco criaturas escritas a mano, que cubren una secuencia, una recarga, una salvación con una condición, resistencias e inmunidades, usos limitados, puntos de acciones distintivas y una criatura escrita como ficha. El bestiario completo del SRD está en `catalogs/creatures.json` del [paquete oficial 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014).

#### Una criatura escrita en los términos de tu conjunto de reglas

Una criatura no tiene que escribirse con números simples. Dale una `sheet`, con exactamente la misma estructura que la ficha de un personaje, y el combate la construye igual que a un miembro del grupo: su salud, defensa, salvaciones, iniciativa, velocidad y todos los ataques y capacidades de sus listas son lo que determinen tus propias fórmulas de ficha. Así expresa un conjunto de reglas que sus oponentes tienen las mismas características, habilidades y listas que sus personajes, sean cuales sean. El Toll Warden de Ember Roads:

```json
{
  "id": "toll-warden",
  "label": "Toll Warden",
  "creature": {
    "tier": "pack",
    "traits": [{ "name": "Knows the road", "text": "It will not follow anyone past the last milestone." }],
    "sheet": {
      "abilities": { "brawn": 2, "wits": 1, "heart": 1 },
      "skills": { "sway": "trained" },
      "fields": { "calling": "Hauler", "toughness": 3 },
      "lists": {
        "gear": [{ "name": "Toll hook", "swing": "brawn", "damage": "1d6", "harm": "cut" }],
        "knacks": [{ "name": "Hold the Line", "_catalog": "knacks/hold-the-line" }]
      }
    }
  }
}
```

- **Todas las partes son opcionales**: `abilities`, `skills`, `saves`, `bonuses`, `fields` y `lists`, con los identificadores que declara tu ficha como claves. Lo omitido se lee con el valor predeterminado de tu ficha, exactamente como en un personaje en blanco. El Grit del guardián es 9 porque tu `grit_max` suma 4, su Toughness y su Brawn, y su Guard es 7 por una razón semejante.
- **Cada número tiene un único origen.** Una criatura con ficha no proporciona también `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves` o `checks`, y Engine rechaza el archivo si lo hace. Puede no tener `actions` propias, porque sus listas son lo que hace. Una criatura sin ficha sigue proporcionando los tres primeros y al menos una acción.
- **Se valida como los datos de autoría que es.** Cada identificador debe estar declarado en tu ficha; una habilidad o salvación se establece en uno de los niveles de competencia que ofreces para ella; un campo, puntuación, bonificación o columna contiene lo que declara admitir (un entero dentro de su intervalo, uno de sus valores, etc.), y una lista no contiene más filas de las permitidas. No hay parte `live`, porque el combate guarda lo que la criatura ha gastado.
- **Una fila puede proceder de un catálogo.** `_catalog: "<catalog>/<entry>"` identifica la entrada de la que se seleccionó una fila, como en la ficha de un personaje, y el combate lee de esa entrada qué cuesta y qué hace la fila. El catálogo debe alimentar esa lista. Cuando el catálogo está escrito en línea, la entrada debe existir en él; cuando reside en su propio archivo, una fila que identifica una entrada ausente del archivo simplemente no concede nada a la criatura. Los catálogos que identifican las fichas de un bestiario se cargan para el combate junto con el bestiario.
- **Lo que la entrada declara junto a la ficha sigue contando**: `tier`, `traits`, `actions`, `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune` y `conditionImmunities`.
- **Paga de sus propias reservas.** Empiezan llenas, las gasta en lo que le proporcionan sus listas y se le ofrecen las formas de pago mayores (un conjuro con un espacio superior) exactamente como a un miembro del grupo, tanto si decide Engine como si decide el Game Master. Hold the Line le cuesta Luck al guardián.
- **Con un contador de heridas, su salud es el contador.** Un golpe marca el contador propio de la criatura según tus `damageKinds`, después de aplicar sus `resist`, `vulnerable` e `immune`, por lo que una criatura inmune a un tipo de daño no recibe ninguna marca de él.
- **Sigue siendo un oponente.** A cero queda fuera de combate en lugar de agonizar; nunca tira contra la muerte; la pantalla muestra lo que siempre mostraba de un oponente y nada de su ficha, y no se escribe lo que haya gastado en ningún otro lugar, ni siquiera cuando un personaje comparte su nombre.
- **Una ficha cuya salud total sea cero** queda fuera del combate, y el registro inicial explica el motivo, en lugar de introducir algo a lo que nadie puede dañar.
- Una capa que retire un valor de uno de tus campos enumerados nunca elimina a una criatura que lo utilice: mientras la capa esté activa, ese campo toma su valor predeterminado para la criatura, exactamente como para un personaje, y no se rechaza a la criatura por ello.
- Un Game Master también puede inventar una, que queda limitada a su nivel (véase Oponentes que nadie escribió).
- Un paquete que incluya una declara Capability API 1.34.

El Toll Sergeant del borrador de 5e es lo mismo en una ficha d20: su Armor Class, puntos de golpe, salvaciones y dos golpes por acción proceden de sus propios campos y su lista de ataques.

#### Oponentes que nadie escribió

Cuando un Game Master inventa un oponente, Engine ajusta la propuesta a tu escala `threat` antes de cualquier tirada: la salud entra en la franja del nivel; la defensa, el ataque y las dificultades de salvación se limitan a dos por encima de los del nivel, y el daño se reduce hasta que la mejor ronda de la criatura (su secuencia más potente o su acción individual más potente, medida contra un objetivo) quepa en el `damagePerRound` del nivel. Primero reduce la cantidad de dados, luego la parte fija, después un golpe de una secuencia y, solo entonces, el tamaño del dado, sin reducir nunca nada a cero. Se descartan los nombres que no contiene tu conjunto de reglas: tipos de daño, condiciones y salvaciones desconocidos, y cualquier acción después de las seis primeras. Un nivel que nunca declaraste recurre al más bajo de tu escala. Cada cambio se devuelve como una frase sencilla para que el registro pueda explicar qué se hizo.

Una invención también puede escribirse como `sheet`, igual que una criatura de bestiario; así obtiene espacios y conjuros un mago inventado. El Game Master ve los identificadores de tu ficha y lo que puede contener cada uno, las listas que lee un combate y los nombres que ofrecen tus catálogos para ellas, de modo que un conjuro se identifica en lugar de describirse: una fila que identifica una entrada de catálogo, con cualquier combinación de mayúsculas, se convierte en esa entrada, y los valores propios del Game Master (como que un conjuro esté preparado) se aplican encima. La ficha se lee con tolerancia porque la escribió un modelo: se descarta un nombre que no exista en tu conjunto de reglas, un valor se ajusta a su campo o columna y no se usan los números escritos junto a la ficha.

Una criatura inventada que no sea un jefe queda limitada a lo que le abre tu conjunto de reglas. Un filtro de catálogo con `startFrom` identifica el campo de ficha por el que se organizan sus entradas (la lista de conjuros del paquete 5e por `class`), y una criatura inventada conserva solo las entradas cuyo filtro coincide con su propio valor de ese campo, comparado como lo hace el selector al abrirse. Así, un Sorcerer nunca tiene toda la lista de conjuros, y quien no indique clase no obtiene nada de un catálogo organizado por clase. Después se completan las elecciones que dejó abiertas sin volver a consultar al Game Master: para cada lista cuyas filas solo cuentan una vez elegidas (`onlyWhen` en una fuente de capacidades de combate), entre las entradas disponibles que puede pagar con sus propias reservas, se completa cada reserva con un pequeño número de entradas (más para una criatura más competente), así como aquello que puede usar a voluntad. Lo que recibe depende de su temperamento y competencia, los mismos con los que combate: una criatura protectora o de apoyo busca lo que sostiene a su bando; una temeraria, daño; una metódica o paciente, lo que frena al enemigo; y cuanto más competente sea, más probable es que lleve una reacción, una contra o cualquier otra cosa que altere el turno. La selección utiliza la semilla del propio combate, por lo que un mismo combate siempre se completa de la misma manera. Una fila que el Game Master haya identificado de una lista así cuenta como elegida.

Un jefe queda enteramente en manos del Game Master, como excepción que puede ser: no se le quita nada ni se le completa nada.

Después, ambos quedan limitados a su nivel:

- La salud entra en la franja del nivel mediante el único campo del que se lee: el máximo de la reserva es ese campo o una `sum` con exactamente un campo (el máximo de puntos de golpe de 5e, Toughness de Ember Roads). Una fórmula de salud sin un único campo se deja como está y el registro lo indica. La longitud de un contador de heridas es tuya y nunca cambia.
- Una vez construida la criatura, la defensa, el ataque y las dificultades de salvación se limitan a dos por encima de los del nivel, y el daño se reduce hasta que su mejor ronda quepa en el `damagePerRound` del nivel, contando el mayor pago que pueda permitirse. Primero se reduce lo que compra un pago mayor, luego los dados, la parte fija, un golpe y, solo entonces, el tamaño del dado.

Tu propio bestiario nunca se limita. Son datos que escribiste tú, así que Engine los acepta tal como están.

### Posiciones: un combate sobre un tablero

Un combate se desarrolla en el teatro de la mente hasta que tu bloque indica cuánto vale una casilla de tablero. Declara `distance` y podrá librarse sobre una cuadrícula; entonces movimiento, alcance, distancias, áreas, línea de visión, cobertura y golpes contra quien se aleja empiezan a tener significado. Todos son números que escribiste tú; Engine proporciona el tablero y nada más.

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2, "threeQuarters": 5, "saves": ["dex_save"], "creatures": true },
"opportunity": { "budget": "reaction" }
```

Ember Roads declara una sola línea y nada más; ese es el propósito: nada del resto es obligatorio.

```json
"distance": { "label": "paces", "perCell": 2 }
```

**La casilla.** `distance.perCell` indica cuánta cantidad de TU unidad vale una casilla, y `label` es el nombre de esa unidad. Todas las distancias del mundo del bloque la utilizan: `economy.movement`, la `speed` de una criatura, el `reach` y el `range` de un arma, y el `reach` y el `range` de una acción de criatura. Un catálogo que declare su propio `units.distance` convierte sus propios `mechanics.range` y `area.size` con su `perCell`; uno que no lo declare usa este. Una distancia mayor que cero se redondea a la casilla más cercana, nunca a ninguna, por lo que cualquier cosa a la que hayas dado un número alcanza al menos una. Cero no es una distancia corta, sino que conserva su propio significado: un `mechanics.range` de 0 es uno mismo o contacto (y tocar a otra persona alcanza la casilla siguiente), y una columna `reach` o `range` de arma con valor 0 en una fila significa que esa fila no tiene esa distancia.

**Si el combate usa un tablero.** Deben coincidir dos cosas: tu bloque declara `distance` y la partida del jugador tiene el estilo de combate Tactical. Con el estilo Classic, o con un conjunto de reglas sin `distance`, el combate sigue siendo teatro de la mente: cualquiera puede apuntar a cualquiera y no se lee nada de lo siguiente.

**Qué estilos puede usar una partida.** `combat.styles` nombra los estilos de combate que puede usar una partida con tu conjunto por su ID: `classic`, `tactical` o un estilo registrado por un cliente (hasta 8, cada uno una sola vez, y al menos uno de `classic` y `tactical`). Si lo omites, se ofrecen todos los estilos, como antes. Un conjunto cuyas reglas necesitan un tablero (áreas, alcance, cobertura, flanqueo) indica `"styles": ["tactical"]`: el asistente New Game y los ajustes de la partida solo ofrecen Tactical, así que sus combates siempre tienen posiciones. Una partida ya guardada con un estilo que no incluyes usa el primero de tu lista que el cliente pueda dibujar (el primer estilo integrado de la lista si el cliente no tiene un estilo registrado que incluyes), y no se puede crear una partida con un estilo que omites ni cambiarla a él en sus ajustes. Un combate ya en curso conserva el estilo con el que empezó. La lista se aplica tanto si el director de combate está activado como si no, así que también limita las batallas Classic y Tactical propias de Marinara en tu conjunto. Un conjunto que use `styles` necesita Capability API 1.379.

```json
"combat": {
  "kind": "attack-vs-defense",
  "styles": ["tactical"],
  "distance": { "label": "feet", "perCell": 5 }
}
```

**Lo que ve el jugador.** Se dibuja el tablero con el terreno del propio estilo táctico. Cada casilla es un botón, accesible con el puntero o las teclas de dirección, e indica qué es, quién está en ella y qué significa para la elección parcialmente realizada. Caminar ilumina las casillas ofrecidas por el menú, cada una con su coste EN TU UNIDAD, dibuja el camino hasta ellas y marca en ámbar cualquier casilla cuyo camino provocaría un golpe de alguien, identificándolo debajo del tablero. Una opción que requiere un objetivo ilumina a quienes pueden elegirse, simultáneamente en el tablero y en la lista. Una opción con `area` apunta a una casilla, y la casilla bajo el puntero indica a quién atraparía, incluidos los aliados. Lo que queda del movimiento permitido se muestra junto a tus presupuestos, también en tu unidad. La pantalla no mide nada: el servidor envía cada casilla, coste, camino, objetivo y punto de mira.

**Movimiento.** El movimiento permitido de un turno es `economy.movement` para un miembro del grupo, o la `speed` propia de la criatura, dividido por `perCell` y redondeado HACIA ABAJO, nunca menos de una casilla mientras pueda moverse. Se repone al inicio del turno de su poseedor y puede gastarse antes, entre y después de las acciones: caminar, golpear, volver a caminar. Entrar en una casilla cuesta uno, o más si el terreno es difícil. Ocho direcciones, todas con el mismo coste, porque así se juegan las cuadrículas de mesa a las que se dirige. Se puede pasar por un aliado, pero no detenerse sobre nadie; un oponente es un muro; no se puede entrar en nada sólido ni cortar una esquina entre dos casillas sólidas.

**Otras formas de moverse** (Capability API 1.113). Los `speeds` de una criatura indican cómo se mueve además de caminar, `{ "fly": 60, "swim": 30, "climb": 30, "burrow": 20 }` en tu unidad, y `"hover": true` indica que un volador no necesita moverse para mantenerse en el aire (necesita una velocidad `fly`). Las de un miembro del grupo salen de la ficha mediante `economy.movementModes`, referencias de valor con las mismas claves, como lo harían la velocidad de nado de una raza o la velocidad de vuelo de un conjuro; un cero significa que no se mueve de esa forma. `speed` y `economy.movement` siguen siendo la marcha. Sobre un tablero:

- el margen es la forma más rápida en que se mueven, y cada casilla recorrida se descuenta de todas las formas a la vez, así que una criatura que camina 30 y vuela 60 puede caminar 10 y después volar 40, y nunca caminar más de 30;
- un volador entra en cualquier casilla que no sea sólida por una casilla, incluidos el agua y un desnivel de cualquier altura;
- un nadador cruza el agua por una casilla y camina por tierra;
- un escalador supera un desnivel de cualquier altura por lo que cueste el terreno al que sube;
- la velocidad de excavación se conserva para el Game Master y se mueve como una marcha, ya que un tablero no tiene suelo por el que excavar.

Cada paso se da de la forma más barata a la que le quede suficiente. Un combate sin tablero no lee nada de esto, y quien solo camina se mueve exactamente como antes.

**Altura de vuelo** (Capability API 1.114). Sobre un tablero cuyo conjunto da `combat.elevation.levelHeight` y `combat.distance.perCell`, a un volador se le ofrecen Fly up y Fly down donde está, cada uno al coste de un nivel de su vuelo (un nivel de 5 pies en casillas de 5 pies es una casilla). Hasta 20 niveles por encima del suelo sobre el que está. Mientras está en el aire:

- solo vuela, una casilla por paso por encima de todo lo que no sea sólido;
- la distancia entre él y cualquier otro es la mayor entre la distancia en el plano y la altura entre ellos, así que una espada con 5 pies de alcance no puede tocar a un dragón a 30 pies de altura, y su mordisco tampoco puede tocar al caballero;
- tiene la ventaja de la altura sobre cualquiera que esté más bajo, como se la daría una colina;
- salir del alcance de alguien para quien está demasiado alto no provoca ningún ataque;
- si lo derriban, lo tumban o lo dejan con velocidad cero, cae al suelo de debajo según indique `falling`, salvo que tenga `hover`.

Volar hasta un terreno tan alto como él, o más, lo hace aterrizar, igual que un volador en el suelo vuela hasta lo alto de un acantilado. No hay clave nueva: un motor anterior a 1.114 mantiene a los voladores en el suelo, así que un paquete que dependa de la altura declara 1.114.

**En el aire** (Capability API 1.354). En cualquier tablero, estar en el aire es un estado propio de cada volador: uno sin marcha, o con `hover`, empieza en el aire; uno en el suelo despega con la acción gratuita Take off (Despegar), volando hacia arriba o con un paso que solo pueda dar volando (sobre el agua o donde volar sea más barato que caminar), y baja con la acción gratuita Land (Aterrizar), solo si tiene marcha, o cuando lo tumban, lo derriban o lo dejan con velocidad cero, salvo que se mantenga suspendido en el aire. Fly down (Volar hacia abajo) hasta el suelo lo mantiene en el aire a la altura del suelo hasta que aterrice. Su imagen de criatura es la de vuelo mientras está en el aire. Ninguna otra parte de las reglas lo consulta todavía.

**Alcance y distancia.** Una fila de arma los obtiene de `combat.attacks[].reach` y `.range`, cada uno una columna de esa misma lista o el mismo número en todas las filas:

```json
"attacks": [
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "toHit": { "ability": { "column": "ability" } },
    "damage": { "dice": { "column": "damage" } },
    "reach": { "column": "reach" },
    "range": { "normal": { "column": "range" }, "long": { "column": "long_range" } }
  }
]
```

Una columna con valor 0 en una fila indica que esa fila no tiene esa distancia; así puede convivir una espada ordinaria con un hacha arrojadiza en la misma lista. Una fila sin alcance llega a una casilla. Una acción de criatura utiliza su propio `reach` o `range`, y una capacidad de catálogo utiliza `mechanics.range` (0 es uno mismo o contacto, que equivale a una casilla cuando se dirige a otra persona).

Una fila con AMBOS es un arma arrojadiza: dentro de su alcance golpea cuerpo a cuerpo y fuera dispara. Por tanto, las reglas siguientes para disparos no le afectan en la mano de alguien, y sirve para golpear a quien pasa cerca, cosa que no hace un arco.

Una acción de criatura también puede llevar el `area` en la que impacta, en tu propia unidad: `{ "shape": "cone",
"size": 15 }`, con `"friendlyFire": false` para perdonar a su propio bando. Así, un arma de aliento es un cono real sobre el tablero en lugar de un número de objetivos. Una secuencia no tiene forma propia; las acciones que identifica tienen las suyas. Un combate sin tablero ignora la forma y utiliza `targetCount`, por lo que una entrada de criatura puede llevar ambos y ser fiel en los dos casos.

**Hasta dónde se puede enviar una forma.** Lo indica `range`: una bola lanzada a cien pies lleva uno. Sin distancia, una explosión se produce donde se coloca, en la casilla del propio actor, y un cono o una línea pueden apuntar a cualquier lugar dentro de la longitud que dibujan, porque ahí la casilla solo indica su dirección. Esto se aplica tanto a `mechanics.area` de una entrada de catálogo como al área de una criatura.

`ranged` indica qué cuesta un disparo efectuado más allá de su distancia ordinaria `normal`, o con alguien del bando contrario en la casilla siguiente. Cada uno es `"disadvantage"` o `"normal"`; omite el bloque y ninguno cuesta nada. Un golpe cuerpo a cuerpo nunca es un disparo, así que ninguna regla le afecta, ni tampoco a un arma arrojadiza usada dentro de su propio alcance.

**Áreas.** El `mechanics.area` de una entrada se convierte en una forma real en el tablero, dirigida a una casilla en lugar de a alguien, y `targetCount` no determina nada: la forma decide a cuántos alcanza. Atrapa a todos los que estén en esas casillas, amigos y enemigos, salvo que la entrada indique `"friendlyFire": false`.

```
burst, size 2, aimed at X        cone, size 3, aimed right      line, size 3, aimed right
. . . . .                        . . . .                        . . . .
. # # # .                        . . # .                        A # # #
. # X # .                        A # # #                        . . . .
. # # # .                        . . # .
. . . . .                        . . . .
```

Una explosión abarca todas las casillas dentro de su tamaño alrededor de la casilla a la que se apuntó. Un cono parte del actor hacia esa casilla, con una anchura en cada paso igual a la distancia recorrida. Una línea avanza igual, con una casilla de ancho. Las tres se detienen ante cualquier cosa sólida.

Una línea en el `mechanics.area` de una entrada o en el `area` de la acción de una criatura puede llevar `width` en la misma unidad que `size`, redondeada a casillas con un mínimo de una (Capability API 1.128), por ejemplo `{ "shape": "line", "size": 60, "width": 10 }` para una línea de 60 pies que tiene 10 pies de ancho; omítelo para una casilla, y un ancho de casillas par pone su columna extra a la izquierda del lanzador.

**Línea de visión y cobertura.** Una línea recta de casillas entre ambos: un muro o una montaña en ella bloquean un disparo e impiden que un área se extienda más allá, y el objetivo simplemente no aparece en el menú. Sobre el agua se ve: un disparo cruza un río, y un área en línea continúa por encima de él. Los combates propios del motor usan la misma prueba de visión.

La cobertura se lee desde donde está el atacante, con las líneas entre esquinas de la regla opcional de cuadrícula de la DMG: desde la mejor esquina del atacante, una línea hasta cada esquina de la casilla del objetivo. Tres o cuatro líneas que atraviesan un muro o una montaña son cobertura de tres cuartos; cualquier línea que atraviese uno, o un terreno que sirva de cobertura (bosque, ruinas), es media cobertura; el terreno bajo por sí solo nunca da más de media. Un objetivo al que el atacante no puede ver en absoluto tiene cobertura total y no aparece en el menú. Contra un ataque, un objetivo que está sobre un terreno que sirve de cobertura tiene al menos media, como siempre; a una salvación solo le ayuda lo que hay entre ella y el efecto.

- `cover.bonus` es lo que suma la media cobertura a la defensa contra la que se tira un ataque, y el registro lo indica.
- `cover.threeQuarters` (Capability API 1.74) es lo que suma la de tres cuartos; sin él, `bonus` sirve para ambas.
- `cover.saves` (1.74) nombra las salvaciones a las que también ayuda la cobertura, contra la propia salvación de una acción (nunca una salvación que termina un estado o mantiene la concentración): desde donde cae una explosión, y desde su creador para todo lo demás. El registro también lo indica.
- `cover.creatures` (1.74) hace que cualquiera que esté en medio dé media cobertura, sea amigo o enemigo.
- Una salvación cuyo texto dice que el objetivo no gana nada con la cobertura (el Sacred Flame de 5e) indica `"ignoresCover": true` (1.74), en el `mechanics.save` de una entrada, en el `save` de la acción de una criatura o en el `save` del uso de un objeto.

**Altura.** Un tablero puede tener altura, hasta tres niveles, y todo combate con posiciones camina y ve según ella, diga lo que diga el conjunto: subir un nivel cuesta una casilla más, bajar no cuesta nada, un desnivel de dos niveles o más es un acantilado por el que nadie camina (y por el que no se empuja a nadie hacia arriba), y un terreno más alto que ambos extremos bloquea la visión. Al disparar hacia abajo desde un terreno más alto, la cobertura baja de en medio no oculta nada. Un conjunto indica lo que añade su sistema con `elevation` (Capability API 1.75, y necesita `distance`):

```json
"elevation": {
  "levelHeight": 5,
  "highGround": "advantage",
  "rangeBonus": 1,
  "falling": { "per": 10, "dice": { "count": 1, "sides": 6 }, "max": 20, "type": "bludgeoning", "prone": "prone" }
}
```

- `levelHeight` es la altura de un nivel en la distancia propia del conjunto.
- `highGround` es lo que da a una tirada de ataque golpear hacia abajo desde un terreno más alto: `"advantage"`, o `{ "bonus": n }`, que se resta de la defensa contra la que se tira el ataque. Si se omite, no da nada.
- `rangeBonus` es cuántas casillas más llega un disparo desde un terreno más alto.
- `falling` es lo que hace una caída: alguien empujado desde un desnivel de dos niveles o más cae abajo y recibe `dice` por cada `per` de la caída (niveles por `levelHeight`), como máximo `max` dados, de `type`, y después recibe el estado `prone`, si lo hay. Los dados se tiran como el sistema tira el daño: sumados o, en `dice-pool`, contados como éxitos con la absorción restada. Una caída es un golpe como cualquier otro, así que puede derribar a alguien o romper su concentración. El registro indica desde cuánta altura cayó. Sin `falling`, la caída se anota y no hace nada.

**Golpes contra quien se aleja.** Declara `opportunity.budget` y, cuando un combatiente salga caminando del alcance de un enemigo en pie que pueda actuar, tenga ese presupuesto y disponga de algo cuerpo a cuerpo con lo que golpear, el movimiento se DETIENE donde está y se pregunta al enemigo si desea golpear. Aceptar gasta el presupuesto y se resuelve exactamente como el mismo ataque en su propio turno; dejarlo pasar no cuesta nada. En ambos casos, el movimiento se reanuda donde se detuvo, pagando cada casilla realmente cruzada, y un golpe que derribe a quien se mueve termina su movimiento donde cayó. Una oportunidad por enemigo para todo el recorrido, por muchas veces que el camino salga del mismo alcance. `disengage` lo impide durante el resto del turno, y un conjunto de reglas sin `opportunity` no tiene nada de esto.

La pregunta es una VENTANA y detiene todo el combate: nada más se mueve hasta que respondan todos los consultados. La ventana de un miembro del grupo la responde el jugador, con el golpe o **Pass** (pasar) a su lado; la de los demás la responde quien los interpreta, y un jefe del Game Master mediante la decisión del propio Game Master. Véase Ventanas más abajo.

**Qué hace un oponente con el tablero.** Un oponente que nadie interpreta evalúa cada casilla alcanzable frente a todas las opciones que podría tomar desde allí, resta valor por cada golpe que recibiría durante el recorrido y prefiere no moverse si ya puede hacer lo mejor desde donde está. Si no tiene nada al alcance, se acerca, y primero esprinta si tu lista `standard` incluye `dash`.

**Rechazos que puedes ver.** `out-of-reach` (más lejos de lo que alcanza), `no-line-of-sight` (algo sólido en medio), `unreachable` (una casilla cuyo coste no puede pagar el movimiento o en la que no puede terminar) y `bad-cell` (una forma dirigida a un lugar al que no puede apuntar).

### Qué hace un combate con tu bloque en el servidor

Una partida cuyo conjunto de reglas declare `combat` obtiene un combate resuelto por él, sobre la misma batalla guardada que siempre ha usado Engine:

- **Quién participa.** El Game Master indica quién combate; Engine lee los números de cada miembro del grupo en su propia ficha. Un miembro sin ficha para tu conjunto de reglas se rechaza por nombre, en lugar de recibir números que no escribiste.
- **De dónde proceden los números de un oponente**, por este orden: la criatura que el Game Master identificó en tu bestiario; luego una cuya etiqueta coincida con el nombre del oponente; después un bloque de estadísticas propuesto por el Game Master para este combate, ajustado a tu escala de amenaza; y, por último, una criatura simple construida con los números del propio peldaño. Cada alternativa y cada ajuste se registran con palabras sencillas para que el combate pueda explicar qué hizo. Un conjunto de reglas sin entrada de bestiario, propuesta ni escala de amenaza rechaza el combate en lugar de inventar uno.
- **Tus fichas son el registro.** La salud, las reservas, las condiciones, la concentración y los contadores de tu regla de agonía se escriben mediante las reglas de la propia ficha tras cada acción aceptada, de modo que recargar a mitad del combate muestra exactamente lo que dejó, sin un recuento final que pueda contradecirlo.
- **Tu menú es la única fuente de legalidad.** Todo aquel que actúa, jugador u oponente, elige un identificador del mismo menú que produce tu bloque. Un oponente controlado por Engine elige de él con las tácticas del propio Engine; a uno controlado por el Game Master se le pide elegir un identificador de ese mismo menú, mostrándole tus números sin decirle nunca qué harán los dados.
- **Tus dados.** Un combate lleva su propia semilla y un cursor, por lo que uno recuperado del disco continúa con los dados que habría tirado.

### En pantalla

El combate se desarrolla en la pantalla de batalla con tus palabras. El menú contiene tus ataques, tus capacidades, tus enfrentamientos y las acciones estándar que enumeraste, indicando cada una qué gasta de tus presupuestos y reservas. Se muestran el orden de turnos, la ronda, cada condición que identificaste con sus rondas restantes, los puntos temporales, la concentración y los dos contadores de tu regla de agonía. El registro imprime la aritmética real en tus términos: "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Cada acción aceptada se escribe en la ficha al ocurrir, por lo que recargar a mitad del combate es exacto y después se indica al Game Master que no vuelva a cambiar esos números.

Un combate con posiciones se dibuja en el tablero en lugar del escenario de retratos; véase Posiciones para saber qué hace el jugador con él. Toda distancia en él, en el menú y en el registro se expresa en TU unidad: "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Enfrentamientos: agarrar, empujar, liberarse

Algunos movimientos no son un ataque contra una defensa, sino un enfrentamiento: ambos bandos tiran y quien saca más se sale con la suya. Agarrar a alguien, derribarlo o apartarlo de un empujón y liberarse tienen la misma forma, así que un conjunto expresa cada uno como datos:

```json
"checks": [
  { "id": "brawn", "label": "Brawn", "value": { "abilityMod": "brawn" } },
  { "id": "wits", "label": "Wits", "value": { "abilityMod": "wits" } }
],
"contests": [
  {
    "id": "grab",
    "label": "Grab",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn", "wits"] },
    "onWin": { "applies": [{ "condition": "held" }] }
  },
  {
    "id": "break_free",
    "label": "Break free",
    "budget": "act",
    "attacker": { "checks": ["brawn", "wits"] },
    "defender": { "checks": ["brawn"] },
    "from": { "holding": "held" },
    "onWin": { "ends": [{ "condition": "held", "on": "actor" }] }
  },
  {
    "id": "shove",
    "label": "Shove back",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn"] },
    "ties": "attacker",
    "onWin": { "push": 4 }
  }
]
```

- **`checks`** son los números que lee un enfrentamiento, cada uno un valor de la ficha, leído una vez al empezar el combate igual que una defensa o una salvación. Una criatura escrita con números simples da los suyos (`"checks": { "brawn": 2 }`); una con ficha los lee de ella. Hasta doce.
- **La tirada.** Ambos bandos tiran tus `attackRoll.dice` y suman la mejor de las pruebas que pueden usar aquí (`attacker.checks`, `defender.checks`). Gana el total más alto; un empate favorece al defensor salvo que `ties` diga `"attacker"`. El registro indica ambos bandos: "Juno tries Grab on Ash-hound: 12 (6 + 6) + 3 = 15 with Brawn against 2 (1 + 1) + 2 = 4 with Brawn, and wins."
- **Ganar** hace lo que indica `onWin`, al menos una cosa:
  - `applies` aplica estados al perdedor con el ganador como origen, así que un estado que marques con `endsWhenSourceDown` termina cuando cae quien sujeta. `rounds` le da un reloj; sin él, dura hasta que algo lo termine.
  - `ends` quita estados al actor o al objetivo.
  - `push` aleja al perdedor del ganador en línea recta, esa distancia en tu unidad, deteniéndose antes de cualquier cosa sólida, de cualquiera que esté en pie, del borde del tablero y de una esquina demasiado estrecha para pasar. Es forzado: no gasta nada de su movimiento y nadie le golpea por ello. Un combate sin tablero no mueve a nadie.
    Perder no hace nada, que es lo que es un agarre fallido.
- **`from: { "holding": "held" }`** hace que un enfrentamiento solo apunte a quien aplicó ese estado al actor, y solo lo pone en el menú mientras dura: así se expresa liberarse.
- **`reach`**, en tu unidad de distancia, es hasta dónde llega; la casilla siguiente si lo omites. `reach` y `push` necesitan `combat.distance`.
- **`strike: true`** le permite ocupar el lugar de un ataque cuando una acción compra varios, igual que un ataque: si se elige primero, gasta el presupuesto y deja disponibles el resto de los ataques; si se elige con ataques disponibles, cuesta uno de ellos. La referencia de 5e hace así los agarres y los empujones.
- **En el menú**, un enfrentamiento tiene su propio grupo e indica su probabilidad de ganar. Un oponente que interpreta el motor lo evalúa como cualquier otra cosa, pero con moderación: un agarre o un empujón prepara algo, y liberarse es lo que más vale, solo mientras se está sujeto. Un Game Master que interpreta a un oponente elige uno del mismo menú.
- Las pruebas de un oponente que inventa un Game Master se limitan a su nivel, igual que su probabilidad de acertar.

Los enfrentamientos requieren Capability API 1.43 en un conjunto empaquetado.

<a id="windows-holding-the-fight-open"></a>

### Ventanas: mantener abierto el combate

Algunos momentos pertenecen a alguien distinto de quien está actuando. Engine mantiene el combate abierto para esa persona en lugar de decidir por ella, y esa pausa es una ventana.

Siete cosas abren una, y dos proceden de lo que ya declaraste:

- **Alguien se aleja.** Un movimiento que sale del alcance de un enemigo capaz de golpear se detiene en ese paso y le pregunta. Véase Golpes contra quien se aleja, más arriba.
- **Entre un turno y el siguiente.** Cuando termina un turno, se pregunta a cada oponente con `signaturePoints` que pueda pagar una de sus propias acciones `signature` si desea comprarla, antes de iniciar el siguiente turno. Es el único momento en el que se compran salvo que `combat.signatureAtTurnStart` indique lo contrario: una acción distintiva no aparece en el menú de turno de nadie, incluido el suyo.
- **Empieza el turno de un enemigo** (Capability API 1.805). Con `"combat": {"signatureAtTurnStart": true}`, también se pregunta a todos los que tengan `signaturePoints` al empezar el turno de un oponente, una vez que haya ocurrido lo que ese inicio activa (estados, salvaciones, reacciones) y antes de que el oponente actúe: un jefe que responde al héroe que está a punto de actuar, como hace la anticipación de una pelea genérica. Las acciones de una guarida mantienen su propia cuenta y no se ofrecen en ese momento. Si se omite, las acciones distintivas solo se compran entre turnos, como las acciones legendarias de 5e. Un conjunto de reglas que lo use necesita Capability API 1.805.
- **Alguien usa algo.** Antes de resolverlo, se pregunta a todos los del OTRO bando que tengan una entrada a la espera de ese momento, sea quien sea el objetivo, siempre que esa entrada alcance a quien lo usa. Una acción estándar y un enfrentamiento no abren ese momento.
- **Algo apunta a alguien.** Antes de resolverlo, se pregunta a todos los objetivos del OTRO bando que tengan una entrada a la espera de ese momento. Un amigo que te cura no es una amenaza a la que responder, así que una acción de un amigo no abre ninguna ventana.
- **Una tirada de ataque impacta a alguien.** Antes de su daño, se pregunta a quien recibió el impacto, si tiene una entrada a la espera de ese momento. Lo que elija cuenta para este ataque: consulta El momento después de un impacto, más abajo.
- **Algo ha dañado a alguien.** Después de resolverlo, se pregunta a todos los que hayan recibido daño y tengan una entrada a la espera de ESE momento, sea quien sea el causante. Recibir daño es un hecho sobre ti; una entrada dirigida de vuelta a quien lo causó sigue sin poder apuntar a un amigo.
- **Alguien cae.** Antes del daño y del derribo, para quien tenga una reacción que alcance a quien cae y permita su bando (Capability API 1.124).

- **Alguien empieza su turno.** Antes de que actúe, para una entrada que lo alcance en su bando objetivo (Capability API 1.131).

Las seis últimas son las que solicita una entrada de catálogo, o una acción propia de una criatura, al identificar el momento que espera. Cuando una acción abre tanto `used` como `aimed`, primero se pregunta por el uso; si nadie lo anula, a continuación se pregunta a aquellos a quienes apunta, y se resuelve una vez que ambos han respondido. Por recibir un impacto se pregunta a medida que impacta cada una de sus tiradas, y por recibir daño, una vez terminada toda la acción.

Qué hace una ventana, sea cual sea su causa:

- **Nada más se mueve mientras está abierta.** Ni el actor cuyo turno está en curso, ni el final de ese turno, ni otra ventana. El combate espera. Una caída retiene su aterrizaje mientras termina el paso de la acción que la causó; por las caídas posteriores se pregunta después.
- **Pregunta de uno en uno**, en orden de turno, una sola vez a cada uno. Pasar siempre es una respuesta y no cuesta nada. Si alguien consultado no tiene ninguna opción que pueda ejecutar, se omite en lugar de preguntarle.
- **Continúa exactamente donde se detuvo.** Un movimiento termina por las casillas que le quedaban, pagando cada una de las que realmente cruzó.
- **Responde quien los interpreta.** La ventana de tu propio miembro del grupo es tuya, con la opción y **Pass** (pasar) a su lado en el menú; la de un oponente la responde quien lo interpreta, y a un jefe del Game Master se le pregunta mediante el Game Master, con dejar pasar el momento como una de las respuestas.
- **Se guarda con el combate.** Una partida cerrada a mitad de un movimiento vuelve con las mismas personas pendientes de responder y las mismas casillas por recorrer.

No declaras nada para las dos primeras: un conjunto de reglas con `opportunity.budget` obtiene una, un bestiario con `signaturePoints` obtiene la otra, y uno sin ambos nunca las ve.

**Indicar qué momento espera una entrada.** Escribe `mechanics.reaction` como un objeto en lugar de `true`:

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` es `used`, `aimed`, `hit`, `harmed`, `falls` o `turn-start`, y es lo que coloca la entrada en el menú de esa ventana. Son los únicos seis momentos que vigila Engine. Una entrada que todavía indique `"reaction": true` solo dice que no se ejecuta en un turno; eso no basta para ofrecerla en ningún lugar, así que no aparece en ningún menú.
- `at` es `source` (el valor predeterminado), `target` o `chosen`. `source` dirige lo ejecutado hacia quien causó el momento y completa el objetivo, de modo que no se pide elegir a nadie; `chosen` conserva los objetivos propios de la entrada y pregunta. `target` apunta a la criatura de la que trata el momento. Una respuesta `falls` recae en los que caen elegidos.
- `cancels` impide por completo que suceda lo que retenía la ventana. Solo una entrada `used` o `aimed` puede indicarlo: un momento que ya ocurrió no puede cancelarse, y un impacto ya se ha tirado.
- `against` restringe lo que responde la entrada a cosas usadas desde ciertos catálogos: `"against": { "catalogs": ["spells"] }` responde a un conjuro y a nada más. Una acción sin entrada detrás (un arma de una lista, una acción propia de una criatura) no procede de ningún catálogo, así que nunca abre el momento para una entrada que nombra catálogos. Omite `against` y la entrada responde a cualquier cosa.

Dale también un `budget`, o gastará el predeterminado de la lista. Una reacción casi siempre gasta un presupuesto propio, lo que impide que un turno contenga varias.

**Su coste se gasta antes de preguntar a nadie.** Una acción cancelada deja de suceder, pero no deja de haberse comprado: el presupuesto y las reservas ya se gastaron. Si tu sistema los devuelve, todavía no puede expresarlo.

Una contra se escribe así, y en un tablero solo responde a alguien dentro de su propio `range`:

```json
"mechanics": {
  "kind": "utility",
  "range": 8,
  "free": true,
  "cost": [{ "pool": "luck", "amount": 1 }],
  "reaction": { "on": "used", "cancels": true, "against": { "catalogs": ["knacks"] } }
}
```

**Una respuesta que solo llega hasta cierto nivel** (Capability API 1.116). `"upTo": "paid"` en una reacción `used` que anula solo detiene lo que se pagó a un nivel no superior al que se pagó la propia respuesta, y `"above": { "check": <value>, "dc": 10 }` es la prueba que, aun así, detiene algo superior, contra `dc` más su nivel. El Counterspell de 5e, que detiene un conjuro del nivel de su espacio o inferior y pide por encima de eso una prueba de atributo de lanzamiento de conjuros contra 10 + el nivel del conjuro, lanzado a nivel superior como cualquier conjuro:

```json
"reaction": {
  "on": "used",
  "cancels": true,
  "against": { "catalogs": ["spells"] },
  "upTo": "paid",
  "above": { "check": { "abilityModFromField": "spellcasting_ability" }, "dc": 10 }
}
```

El nivel de cualquier cosa pagada es el nivel de la reserva de la que salió: el `level` propio de una reserva, un valor que se lee de la ficha de quien la tiene, cuando indica uno (los espacios de pacto de 5e, lanzados al nivel de espacio del brujo) y, si no, su posición en su grupo, siendo 1 la primera reserva. Algo que no costó nada, o que salió de una reserva sin grupo, es de nivel 0, así que lo detiene cualquier respuesta de este tipo. La prueba son los propios dados del combate con los estados de quien responde que afectan a las pruebas; un combate `dice-pool` no tiene CD que alcanzar y rechaza `above`. Una criatura sin ficha escribe su prueba como `{ "const": n }`. El registro indica el nivel y la tirada siempre que la respuesta llega por encima de sí misma, y le sigue la línea habitual cuando lo detiene. Sin `above`, algo superior simplemente no se detiene, y lo que costó la respuesta sigue gastado.

**El momento después de un impacto.** Una entrada en `hit` es la forma de expresar Shield, una Parry y Uncanny Dodge. El ataque se retiene después de su tirada, y se pregunta a quien recibió el impacto antes de infligir ningún daño. Lo que elija cuenta para ese ataque: su tirada no se repite, sino que se vuelve a comprobar contra su defensa tal como esté ahora, así que un estado que suma a la defensa puede convertir el impacto en un fallo, y una cara natural que siempre impacta sigue impactando. Un estado que dura un ataque (`endsAfter: "attacked"`) aplicado como respuesta cubre este ataque, daño incluido, y se gasta con él, que es como se dice "reduce a la mitad el daño de ese ataque": `resist-all` durante un ataque.

```json
"mechanics": {
  "kind": "buff",
  "targets": "self",
  "budget": "reaction",
  "reaction": { "on": "hit" },
  "applies": [{ "condition": "shielded", "duration": { "rounds": 1, "at": "turn-start" } }]
}
```

El ataque continúa exactamente donde se retuvo: el resto de sus objetivos y, en una acción de criatura formada por otras acciones, el resto de sus partes. Cada tirada que impacta a alguien que tiene una respuesta así se retiene en su turno, y un combate guardado mientras la ventana está abierta vuelve igual. Un ataque hecho dentro de una ventana (un golpe contra alguien que se aleja, una acción distintiva, una respuesta) nunca se retiene, porque nada abierto dentro de una ventana abre otra. El registro muestra la tirada y contra qué se hizo cuando se abre la ventana y, si la respuesta cambió la defensa, si ahora falla. Los oponentes que interpreta Engine solo se protegen cuando eso convierte el impacto en un fallo.

Un paquete que identifique un momento necesita Capability API 1.33, y uno que use `used` o `against` necesita 1.44. Uno que espera `hit` necesita 1.46.

**Responder a un conjuro por su nombre** (Capability API 1.117). `against` puede nombrar `entries` como `<catalog>/<entry>` junto a `catalogs`, y cualquiera de los dos que coincida abre el momento. `also` hace la misma respuesta en hasta tres momentos más, cada uno con su propio `against`. El `noDamageFrom` de un estado mantiene totalmente lejos de quien lo tiene el daño de esas entradas mientras dura, sea cual sea el tipo de daño. El Shield de 5e se usa cuando un ataque impacta y cuando se apunta Magic Missile a su lanzador, y bajo él Magic Missile no hace nada:

```json
"reaction": {
  "on": "hit",
  "also": [{ "on": "aimed", "against": { "entries": ["spells/magic-missile"] } }]
}
```

```json
{
  "condition": "shielded",
  "modifiers": [{ "to": "defense", "flat": 5 }],
  "noDamageFrom": ["spells/magic-missile"]
}
```

Solo el primer momento puede anular, así que una reacción que anula no tiene `also`. El catálogo que nombra una entrada tiene que ser uno que tenga el conjunto. Una entrada que no está en él simplemente nunca abre el momento. Un golpe que se evita así aparece en el registro como uno al que el objetivo es inmune.

**Responder solo a algunos golpes** (Capability API 1.118). Un momento `hit` puede indicar `"blow": "melee"` o `"blow": "ranged"`. Un golpe es cuerpo a cuerpo mientras su objetivo esté al alcance del arma, así que una daga lanzada desde lejos es a distancia y la misma daga usada junto a su objetivo es cuerpo a cuerpo. Un arma con alcance y sin distancia es siempre cuerpo a cuerpo, y una con distancia y sin alcance es siempre a distancia. En un combate sin tablero, un arma que tiene alcance se considera blandida en la mano. `"seesSource": true`, en cualquier momento salvo `falls`, solo lo abre mientras quien lo tiene ve a quien lo causó. Eso significa una línea de visión entre ellos en el tablero (sin tablero, todos ven a todos), y nunca a alguien que ha hecho la acción estándar Hide hasta que se le pasa al inicio de su siguiente turno. El Parry de 5e es ambas cosas:

```json
"reaction": { "on": "hit", "blow": "melee", "seesSource": true }
```

Ambas claves también pueden escribirse en un momento de `also`, y `blow` solo en uno `hit`.

**Detener una caída** (Capability API 1.124). Una reacción a `falls`, también en `also`, responde a una criatura que cae de un saliente o a un volador obligado a bajar al suelo, antes de que la caída cause daño o la deje tumbada. Su distancia y su bando objetivo se comprueban respecto a quien cae, y su respuesta recae en esa criatura. Para Feather Fall, da a la entrada estas mecánicas y declara `feather_falling` en los estados vivos de la ficha:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 60,
  "budget": "reaction",
  "cost": [{ "pool": "slots_1", "amount": 1 }],
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

Su entrada de `combat.conditions` es `{ "condition": "feather_falling", "fallsSafely": true }`. Mientras dura, este estado impide el daño por caída y el estado tumbado que aplicaría una caída; no elimina un estado que causó la caída. Usa `targets: "self"` para una respuesta solo a la propia caída del lanzador. Una caída no tiene entrada de origen, así que su reacción no puede llevar `cancels`, `blow`, `seesSource` ni `against`. Una entrada de un solo objetivo pregunta por cada caída por separado. Esto resuelve el aterrizaje; no registra un descenso ralentizado.

**Responder por otra criatura** (Capability API 1.131). `for` es `self` de forma predeterminada; `ally` excluye a quien la tiene, mientras que `any` lo incluye. Ambos preguntan a quienes la tienen en el bando del objetivo dentro del `within` exigido, en la unidad de distancia del catálogo, y solo en `aimed` o `hit`. Estas claves también funcionan en cada momento de `also`. `seesSource` sigue exigiendo ver al atacante. Protection aplica `own-attacks-disadvantage` al origen antes de tirar los dados de ataque. Su duración `this-action` termina cuando la acción se resuelve o se anula. Sin una distancia explícita al origen, la respuesta de un tercero alcanza a ese origen; `within` mide la distancia hasta la criatura protegida. Declara `protected_attack` en la ficha y da ese efecto a su estado de combate:

```json
{
  "kind": "debuff",
  "targets": "enemy",
  "budget": "reaction",
  "reaction": { "on": "aimed", "for": "ally", "within": 5, "at": "source", "seesSource": true },
  "applies": [{ "condition": "protected_attack", "duration": "this-action" }]
}
```

**Poner la respuesta en el objetivo.** `at: "target"` se aplica a la criatura atacada, mientras que `source` sigue siendo el atacante. Shield Guardian representa a quien lleva el amuleto como un aliado a 5 o menos; `parrying` concede `+2` a la defensa. El impacto retenido vuelve a comprobar la defensa de ese aliado después de la respuesta:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 5,
  "budget": "reaction",
  "reaction": { "on": "hit", "for": "ally", "within": 5, "at": "target" },
  "applies": [{ "condition": "parrying", "duration": "this-action" }]
}
```

**Al inicio de un turno.** `on: "turn-start"` pregunta cuando una criatura del bando objetivo de la entrada empieza su turno dentro de su distancia, antes de que esa criatura actúe. Esa criatura es el `source`. Una entrada dañina responde al otro bando; una que ayuda, a su propio bando. No puede llevar `cancels`, `blow`, `against` ni `upTo`. La acción de criatura Unnerving Mask pide una salvación de Sabiduría; una ronda en el reloj de la criatura afectada dura todo este turno y expira al final (omite `of: "source"`):

```json
{
  "id": "unnerving_mask",
  "name": "Unnerving Mask",
  "range": 30,
  "budget": "reaction",
  "reaction": { "on": "turn-start", "at": "source", "seesSource": true },
  "save": { "save": "wis_save", "difficulty": 14, "onSuccess": "negates" },
  "applies": [{ "condition": "frightened", "duration": { "rounds": 1 } }]
}
```

**Anular con una salvación.** `cancelSave: { save, dc }` requiere `cancels`; quien la tiene tira con sus modificadores de salvación habituales. Un éxito anula, un fallo deja que la acción original se resuelva, y ambos gastan la reacción. `against.actions` nombra de una a doce acciones de perfil, comparando el nombre completo sin distinguir mayúsculas de minúsculas (como máximo 80 caracteres cada uno). Rock Catching representa atrapar la roca anulando todo el ataque, incluido todo su daño, en vez de solo su daño contundente. Los IDs de salvación son los de tu conjunto (`dex` aquí; `dex_save` en el ejemplo de 5e incluido):

```json
{
  "on": "aimed",
  "cancels": true,
  "cancelSave": { "save": "dex", "dc": 10 },
  "against": { "actions": ["Rock"] }
}
```

**Detener a varios que caen.** Una entrada `falls` con un `targetCount` mayor que uno ofrece las criaturas elegibles que caen por un mismo golpe o efecto, dentro de su distancia y en su bando objetivo. El menú y el director eligen de forma predeterminada a todos los elegibles hasta la cantidad, empezando por los más cercanos; el jugador puede cambiar la selección. Una caída posterior es un evento aparte. Feather Fall usa el mismo estado `fallsSafely` de antes:

```json
{
  "kind": "buff",
  "targets": "ally",
  "targetCount": 5,
  "range": 60,
  "budget": "reaction",
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

### Todavía no

Dicho claramente, porque un conjunto de reglas no debe prometer lo que Engine no hace:

- **Más allá del tablero modesto**: no hay vuelo sobre obstáculos. A una criatura solo la mueven su propio movimiento, el movimiento de una montura, un teletransporte, lo que la empuja (un enfrentamiento, una entrada, la acción de una criatura o una zona) y quien la arrastra.
- **Un enfrentamiento es simple.** Su tirada no abre ninguna ventana, pero sí se puede responder a una caída que cause.
- **Una entrada solo puede esperar seis momentos**, `used`, `aimed`, `hit`, `harmed`, `falls` y `turn-start` (véase Ventanas, más arriba). Son los momentos que Engine detecta en nombre de una entrada; las otras dos ventanas, alguien que se aleja y la pausa entre turnos, las abre el propio combate y no son momentos que pueda solicitar una entrada. No existe un momento para una tirada de salvación ni para una muerte.
- **No se encadenan.** El combate mantiene una ventana en lugar de una pila, así que nada abierto dentro de una ventana abre otra: una contra no puede recibir a su vez una contra, lo que inflige una reacción no abre otro momento, y un ataque hecho dentro de una ventana no se retiene cuando impacta. Una caída a la que se puede responder y que se produce durante una ventana se retiene hasta que esta se cierra, y después se pregunta por ella cuando le toca.
- **Solo una tirada de ataque es un impacto.** Algo que alcanza sin ella (dardos que simplemente impactan, un área contra la que todos hacen una salvación) no abre ningún momento `hit`.
- **Los modificadores de daño son de los impactos de ataque.** Una respuesta puede poner un modificador de daño a quien la tiene o reducir a la mitad el daño recibido con `resist-all`; los modificadores de daño nunca cambian un efecto que solo pide una salvación.
- **No se devuelve nada.** Lo que costó una acción cancelada queda gastado.
- **Lo que cambia un estado es una lista cerrada.** La defensa, las tiradas de ataque, las salvaciones, las pruebas de enfrentamiento, la velocidad, el máximo de salud, el daño infligido y el daño recibido (también para los niveles y los efectos de los objetos). Los modificadores de daño solo cambian los impactos de ataque; nunca se suman al daño basado en salvaciones ni a los impactos automáticos.
- **Una criatura escrita con números simples no tiene contador de heridas.** En un conjunto de reglas cuya salud sea un contador, esa criatura sigue perdiendo puntos; dale una `sheet` y sus golpes marcarán casillas, mitigados primero por sus propios `resist`, `vulnerable` e `immune`.
- **Un efecto adicional se activa solo.** `on` tiene un único valor, `hit`, así que lo aplica el primer impacto del período que cumpla los requisitos, sin ningún momento en el que se pregunte si deseas gastarlo.
- **Un número que mueven los ataques es simple.** Un golpe que gasta tira el número y nada más, así que ningún arma lo cambia, incluido su `floor` (un objetivo resistente absorbe un golpe que toma, y su dureza detiene uno que gasta, pero nada más reduce ninguno de los dos); un derrumbe se levanta tras un número fijo de turnos por muy profundo que fuera; y un ataque hecho en una ventana (un golpe contra alguien que se aleja, una reacción, un movimiento distintivo) se hace en el primer estilo.
- **Un oponente inventado no absorbe nada y no tiene dureza.** Una criatura que el Game Master inventa para un combate queda limitada a tu escala de amenaza, que no dice nada sobre absorción ni dureza, así que no tiene ninguna de las dos.
