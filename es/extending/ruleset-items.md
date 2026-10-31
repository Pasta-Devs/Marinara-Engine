# Objetos de conjuntos de reglas

Esta página forma parte de [Escribir conjuntos de reglas de Game Mode](writing-rulesets.md). Qué lleva un grupo: categorías, armas, armaduras, munición, botín, dinero, equipo inicial y mercados.

Las armaduras, las armas, las pociones, el equipo, la munición y el dinero son objetos. Un bloque opcional `items` declara las palabras con las que se escribe cada objeto de tu conjunto, y un catálogo con `holds: "items"` enumera los propios objetos. Ambos necesitan Capability API 1.49; `rarityCaps` y `propose` del bloque, que rigen los objetos que inventa el Game Master, necesitan 1.51; un valor que lee los objetos de un personaje (`itemStat`) necesita 1.52; lo que hace un objeto en las pruebas mientras se lleva puesto o encima, con los límites de `bonus` del bloque, necesita 1.53; lo que un objeto exige a quien lo lleva puesto y los atributos que cambia necesitan 1.54; el `attack` de un arma necesita 1.55; lo que hace un objeto en un combate necesita 1.56; lo que dispara un arma y lo que tiene cargado necesitan 1.57; los modos de un arma, el ataque con la mano secundaria, el mínimo y los estados al impactar necesitan 1.58; lo que hace usar un objeto en un combate, con las cargas que contiene, necesita 1.59; un uso que restaura una reserva necesita 1.60; las cargas recuperadas al descansar o un objeto que se rompe al vaciarse necesitan 1.61; un uso que pide antes una prueba (`gate`) necesita 1.62; las tablas de botín y el botín de una criatura necesitan 1.63; una línea de botín que suelta monedas o una capa que retira monedas necesita 1.64; un mercado, el lugar `sold` de un objeto y un `service` necesitan 1.65; un día de mercado (unos fondos diarios, `buyBack`, el `stock` de un vendedor, una cantidad `limited` o un `sold` que no nombra ningún lugar) necesita 1.69; un efecto adicional que se activa con las armas que se empuñan (`weapons`) necesita 1.70; el equipo inicial (`startingGear`) necesita 1.78; un objeto arriesgado, una falsificación o un vendedor deshonesto necesitan 1.79, y el `unsold` de un mercado (o el `items` de una capa) necesita 1.813.

## El bloque de objetos

El bloque va en `items`, en el nivel superior del archivo. Este es el de Ember Roads, algo abreviado:

```json
"items": {
  "categories": [
    { "id": "weapon", "label": "Weapon" },
    { "id": "armor", "label": "Armor" },
    { "id": "ammunition", "label": "Ammunition" }
  ],
  "rarities": [
    { "id": "common", "label": "Common" },
    { "id": "storied", "label": "Storied" }
  ],
  "tags": [
    { "id": "thrown", "label": "Thrown" },
    { "id": "ranged", "label": "Ranged" },
    { "id": "two_handed", "label": "Two-handed" },
    { "id": "arrow", "label": "Arrow" }
  ],
  "stats": [
    { "id": "bulk", "label": "Bulk", "type": "number", "min": 0, "max": 10, "default": 0 },
    { "id": "guard", "label": "Guard", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "damage", "label": "Damage", "type": "dice", "example": "1d6" },
    { "id": "swing", "label": "Rolls with", "type": "enum", "values": ["brawn", "wits", "heart"], "default": "brawn" },
    { "id": "reach", "label": "Reach", "type": "enum", "values": ["close", "near", "far"], "default": "close" }
  ],
  "slots": [
    { "id": "body", "label": "Body", "count": 1 },
    { "id": "hands", "label": "Hands", "count": 2 }
  ],
  "carry": { "stat": "bulk", "encumberedAbove": { "derived": "load" }, "limit": { "const": 12 } },
  "rarityCaps": [
    { "rarity": "common", "stats": { "guard": 1 }, "bonus": 1 },
    { "rarity": "storied", "stats": { "guard": 3 }, "bonus": 2 }
  ],
  "currencies": [
    {
      "id": "coin",
      "label": "Coin",
      "perWeight": 100,
      "units": [
        { "id": "bit", "label": "bits", "value": 1 },
        { "id": "mark", "label": "marks", "value": 10 },
        { "id": "sovereign", "label": "sovereigns", "value": 100 }
      ]
    },
    {
      "id": "salt",
      "label": "Salt",
      "perWeight": 10,
      "units": [
        { "id": "pinch", "label": "pinches", "value": 1 },
        { "id": "cake", "label": "cakes", "value": 20 }
      ]
    }
  ]
}
```

- `categories`: de una a 24. Cada objeto tiene exactamente una, como armadura, arma o poción.
- `rarities`: opcional, hasta 12. Enuméralas de la más común a la más rara.
- `tags`: opcional, hasta 48. Propiedades que puede tener un objeto, como arrojadizo o plateado.
- `stats`: opcional, hasta 24. Los números y palabras que lleva un objeto, declarados exactamente como una columna de lista: `number`, `text`, `boolean`, `enum` o `dice`, con rango, valores y valor predeterminado cuando el tipo los tiene. `promptVisible` (`true` de forma predeterminada) indica si se muestra al Game Master la estadística junto al objeto. Ponlo en `false` para algo que solo debe ver el jugador, como dónde está escondido un objeto.
- `slots`: opcional, hasta 12. Dónde se lleva puesto o se empuña un objeto, y cuántas ranuras de ese tipo tiene un personaje, de 1 a 20.
- `binding`: opcional. Sintonización, investidura o cualquier otra cosa que limite cuántos objetos puede tener vinculados a la vez un personaje. `label` es su nombre y `max` es un valor leído de la ficha del personaje, como `{ "abilityScore": "nerve" }` o un valor derivado. No puede leer el estado vivo, porque cuántos objetos puede vincular un personaje no cambia con cada golpe.
- `carry`: opcional. `stat` nombra la estadística numérica que es el peso de un objeto, cuyo `min` es 0 o más. `encumberedAbove` es cuánto lleva un personaje antes de quedar sobrecargado, y `limit` (opcional), lo máximo que puede llevar. Ambos se leen de la ficha como `binding.max`. Sin `carry`, el peso no significa nada y nadie queda nunca sobrecargado. `unit` (opcional, hasta 12 letras, Capability API 1.791) es la unidad en que se cuenta un peso, como `"lb"`: la carga del inventario, los pesos del selector de equipo inicial y el peso de una opción de kit la indican después del número.
- `currencies`: opcional, hasta seis familias de una a diez monedas cada una.
  - Las monedas de una familia se cambian entre sí según `value`, que cuenta la moneda más pequeña de la familia. Así, la moneda más pequeña vale 1 y no hay dos monedas de una familia que valgan lo mismo.
  - Dos familias nunca se cambian entre sí. La moneda de otra nación, o los favores de una ambientación, son una familia propia.
  - El ID de una moneda es único entre todas las familias, porque el coste de un objeto nombra solo la moneda.
  - La `label` de una moneda es su nombre para cualquier cantidad (`pennies`); `one` (Capability API 1.89) es su nombre para exactamente una (`penny`), que se usa siempre que un precio, unos fondos o un mercado nombran una sola moneda. Sin él, la `label` también vale para una.
  - `perWeight` (opcional, y solo junto a `carry`) indica cuántas monedas de la familia pesan una unidad de la estadística de carga.
  - Las monedas son el dinero del grupo y se llevan en las bolsas como cualquier objeto (consulta Dinero, más abajo).
- `rarityCaps`: opcional, como máximo una por rareza. Lo máximo que puede dar un objeto que inventa el Game Master en esa rareza: el valor más alto de cada estadística numérica nombrada en `stats`, dentro del rango de esa estadística y como número entero si la estadística admite enteros, y `bonus` (Capability API 1.53), la bonificación fija más alta que puede sumar uno de sus modificadores al llevarse puesto o encima. En una rareza con `bonus`, se omite una bonificación en dados, porque los dados no pueden limitarse a un número; una penalización nunca se limita. Un objeto inventado queda sujeto a ello; los objetos que enumeran tus catálogos son tuyos y nunca se limitan.
- `propose`: `true` de forma predeterminada. `false` prohíbe al Game Master inventar objetos de tu conjunto.
- `native`: `true` de forma predeterminada. `false` desactiva los objetos sin tipo propios de Game Mode en las partidas de tu conjunto (consulta **Dónde se leen los objetos**). El Game Master puede seguir inventando objetos, escritos con las palabras de tu conjunto.
- `freeform`: en qué se convierte un objeto que escribe el jugador. `"plain"` (predeterminado) lo conserva como objeto sin reglas, como hasta ahora. `"refuse"` solo permite objetos de tu conjunto.
- `lootTables` (Capability API 1.63): opcional, hasta 24. Lo que sueltan las criaturas de un combate ganado y el `[loot:]` del Game Master (consulta Botín, más abajo).

## Un objeto

Un catálogo de objetos no declara `feeds`:

```json
{ "id": "outfitter", "label": "Outfitter", "holds": "items", "entries": [] }
```

Cada entrada lleva un `item` en vez de `rows` o una `creature`:

```json
{
  "id": "hunting-bow",
  "label": "Hunting bow",
  "summary": "Yew, waxed string, and a grip worn smooth by someone else's hand.",
  "item": {
    "category": "weapon",
    "rarity": "common",
    "tags": ["ranged", "two_handed"],
    "stats": { "bulk": 2, "damage": "1d8", "swing": "wits", "reach": "far" },
    "slots": { "hands": 2 },
    "cost": { "amount": 3, "unit": "sovereign" }
  }
}
```

- `id`, `label`, `summary` y `filters` funcionan igual que en cualquier entrada. La etiqueta es el nombre del objeto.
- `category` es obligatorio. `rarity` y `tags` son opcionales, y los tres nombran IDs propios del bloque. Un objeto solo puede tener rareza si el bloque declara alguna.
- `stats`: valores para las estadísticas del bloque. Cada uno es un valor que su estadística podría contener.
- `slots`: cuántas ranuras de cada tipo ocupa el objeto, nunca más de las que tiene un personaje.
- `stack`: lo máximo que contiene una pila, de 1 a 999.999. Sin él, una pila contiene tantos como cualquier pila de Game Mode. Un objeto que contiene `charges` va solo en su pila.
- `cost`: una cantidad entera (`amount`) de una moneda, nombrada por su ID en `unit`. El selector la muestra, y el Game Master la ve junto al objeto (consulta Dinero, más abajo).
- `sold` (Capability API 1.65): `{ "place": "city" }`, el más pequeño de los lugares de tu mercado que vende el objeto, por encima de cualquier regla que diga otra cosa; con 1.69 puede, en su lugar o además, indicar cuántos tiene disponibles un lugar en un día (`"limited": 2` o `"limited": "1d3"`) (consulta Mercados, más abajo).
- `service` (Capability API 1.65): `true` para alojamiento, un pasaje o una bendición: se compra como un objeto y nunca se lleva encima. Comprarlo solo paga; nada más lo mete en una bolsa (añadir uno se rechaza como `service`), y el selector omite los servicios. Un servicio tiene un `cost`, y nada relacionado con llevarlo o usarlo (`slots`, `stack`, `binds`, `worn`, `carried`, `requires`, `attack`, `use`, `charges`).
- `binds`: el objeto debe vincularse antes de hacer nada mientras se lleva puesto. `restriction` (opcional) indica con palabras quién puede vincularlo, y `cursed: true` marca uno que no se deja soltar. Solo un conjunto con `binding` puede tener objetos que se vinculan.
- `worn` y `carried` (opcionales, Capability API 1.53): lo que hace el objeto en las pruebas y salvaciones de quien lo tiene mientras lo lleva puesto y mientras solo lo lleva encima, (1.54) los atributos que fija o aumenta y (1.56) lo que hace en un combate. Consulta [Pruebas fuera de un combate](#checks-outside-a-fight) y [Armadura y efectos puestos en un combate](#armor-and-worn-effects-in-a-fight).
- `requires` (opcional, Capability API 1.54): lo que exige el objeto a quien lo lleva puesto y lo que se aplica mientras no lo cumple. Consulta [Pruebas fuera de un combate](#checks-outside-a-fight).
- `attack` (opcional, Capability API 1.55): lo que hace el objeto como arma en un combate mientras se lleva puesto, (1.57) lo que dispara y tiene cargado, y (1.58) sus otros modos, un ataque con la mano secundaria, un mínimo para su daño y los estados que aplica al impactar. Consulta [Armas en un combate](#weapons-in-a-fight), [Munición y recarga](#ammunition-and-reloading) y [Modos, una segunda arma, un mínimo y estados al impactar](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit).
- `toggle` (opcional, Capability API 1.170): un interruptor que lleva el objeto, `{ "label", "budget" }`. Un combate lo ofrece como opción con ese presupuesto ("Turn on Flame Tongue: Flames"), el inventario como un botón con la etiqueta, y se queda en la pila entre combates tal como se dejó; empieza apagado. Un objeto con interruptor va solo en su pila mientras está encendido. Una cláusula `plus` de un arma con `when: "toggled"` solo se inflige mientras está encendido. La flame tongue de 5e: `"toggle": { "label": "Flames", "budget": "bonus" }` y `"plus": [{ "dice": "2d6", "type": "fire", "when": "toggled" }]`.
- `use` y `charges` (opcionales, Capability API 1.59): lo que hace usar el objeto, en un combate y fuera de él, y las cargas que contiene para que ese uso las gaste, y (1.60) una reserva que restaura. Consulta [Usar objetos en un combate](#using-items-in-a-fight) y [Usar objetos fuera de un combate](#using-items-outside-a-fight).

Un objeto no lleva `mechanics`: lo que hace se escribe en su bloque `item`.

## Dónde se leen los objetos

Todo lo anterior se comprueba al importar el conjunto, y tus catálogos de objetos se distribuyen con él. En una partida, los lee el inventario de Game Mode:

- **Tus objetos están en la bolsa.** Una pila puede ser uno de tus objetos y sigue siendo ese objeto, lo llame como lo llame el jugador. El botón **From the ruleset** (Del conjunto de reglas) del inventario abre un selector con todos los objetos que enumeran tus catálogos, con la búsqueda y los filtros del catálogo, y una capa que oculta una entrada también la oculta ahí.
- **Los nombres encuentran tus objetos.** Un nombre que escribe el jugador, o uno que escribe el Game Master en `[inventory: action="add"]`, que sea la `label` de uno de tus objetos, con cualquier combinación de mayúsculas, añade ese objeto. Si dos objetos comparten etiqueta, un nombre encuentra el que tus catálogos enumeran primero.
- **`stack`** se respeta: añadir, fijar, combinar o dar por encima de él llena la pila y empieza una nueva.
- **`freeform: "refuse"`** deja al jugador solo tus objetos: el selector y los nombres que son tus objetos.
- **`native: false`** deja al Game Master solo tus objetos y los que inventa: se rechaza un nombre que no es ninguna de las dos cosas (`not-ruleset-item`), aunque sigue pudiendo añadirse más de algo que ya se tiene, y sus instrucciones lo indican. Un combate ya no pregunta a un modelo qué hacen los objetos del inventario, así que solo combaten tus objetos: en un combate del conjunto, tus armas empuñadas y los usos de tus objetos (consulta Armas en un combate, más abajo), y en una batalla Classic o Tactical, tus objetos con un `use` (consulta Objetos en batallas Classic y Tactical, más abajo). Lo que escribe el jugador sigue rigiéndose por `freeform`, y lo que llevaba el grupo vuelve en una sesión nueva en cualquier caso.
- **Qué es un objeto** se muestra en la pila seleccionada: su categoría, rareza y propiedades por sus etiquetas, las estadísticas que da, su resumen y cuántos contiene una pila. El selector también muestra su `cost`. El Game Master ve cada uno de tus objetos que tiene con su categoría, rareza, propiedades y las estadísticas que dejaste en `promptVisible`, como `Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`.

- **`slots`**: un objeto que ocupa ranuras puede equiparlo quien lo lleva mientras tenga esas ranuras libres, y un objeto de una pila mayor se separa en su propia pila para llevarlo puesto. El inventario muestra cada ranura en uso por personaje.
- **`binding`**: un objeto que `binds` puede vincularse, hasta `binding.max` leído de la ficha de su portador (un personaje sin ficha lee una en blanco). Un objeto `cursed`, una vez vinculado, sigue vinculado: el jugador no puede desvincularlo, quitárselo, regalarlo ni eliminarlo, y solo el Game Master puede terminar la maldición.
- **`carry`**: un objeto pesa su valor de `carry.stat` (un objeto sin él no pesa nada), y la carga de un personaje es lo que pesa su bolsa, comparada con `encumberedAbove` y `limit` leídos de su propia ficha. Un objeto añadido a la vista compartida del inventario, por el jugador o por el Game Master sin `who=`, va a quien pueda llevarlo sin quedar sobrecargado (primero el jugador y después el grupo en orden), repartido según el espacio que le queda a cada uno cuando nadie puede llevarlo entero. Nada supera el `limit` de nadie: lo que nadie puede llevar se queda atrás y se informa al Game Master. Dale a una estadística de peso `"integer": false` para pesos como un cuarto de libra.
- **El Game Master inventa objetos con tus palabras.** Salvo que pongas `propose: false`, su `[inventory: action="add"]` puede describir un objeto nuevo: `like=` uno de tus objetos como punto de partida y después cualquiera de `category=`, `rarity=`, `tags=`, `stats=` (pares `id=value`), `slots=` (`id=count`), `binds=` (`yes`, `cursed` o `no`), `worn=` y `carried=` (cambios separados por `;`, cada uno `+N`, `-N`, `advantage`, `disadvantage` o `fails` para salvaciones, en habilidades o salvaciones por nombre, o en `checks` o `saves` para todas ellas, `+N` o `-N` en el nombre de un atributo para subirlo o bajarlo y, si tienes combates, `+N`, `-N`, ventaja o desventaja en los ataques y `+N` o `-N` en la defensa o en tu palabra para ella: `worn="+1 Sneak; disadvantage on Sway checks"`, `carried="+1 Brawn"`, `worn="+1 Guard"` o `none`) y `summary=`, cada parte por su ID o etiqueta. Una estadística de objeto que ya cuenta tu defensa (Guard de Ember Roads suma el `guard` de lo que se lleva puesto) es la forma en que una armadura la aumenta, así que se omite un cambio puesto en la defensa junto a esa estadística y la respuesta lo indica: un modelo pequeño escribe `guard=1` y `+1 Guard` para un único +1. También lee lo que suele escribir en su lugar un modelo pequeño: un número tras el nombre (`Brawn +1`), "bonus" tras los ataques o la defensa (`+1 attack roll bonus`), `none` para una lista vacía de propiedades, estadísticas o ranuras, y `worn=`, `carried=` o `summary=` dentro de `stats=` cuando no tienes ninguna estadística con ese nombre. El motor solo conserva lo que tiene tu bloque: se omite una categoría, propiedad, estadística, ranura, habilidad o salvación desconocida, una rareza que no tienes se convierte en la más baja, un número se limita al rango de su estadística y después a `rarityCaps` para su rareza, una bonificación puesta o encima a la `bonus` de su rareza (incluida la parte de la que partió `like`), y un nombre que es uno de tus objetos es simplemente ese objeto. La respuesta indica al Game Master qué se cambió (nunca sobre una estadística que no le muestras), y los detalles del objeto muestran cada cambio al jugador. La partida conserva el objeto, así que el mismo nombre es ese objeto el resto de la partida, y una sesión nueva lo conserva mientras alguien lo siga teniendo.
- El Game Master puede hacer `equip` y `unequip` de tus objetos con su comando de inventario si tienes `slots`, y `bind` y `unbind` si tienes `binding`: solo se le informa de los que tiene tu conjunto. Ve la carga de cada personaje, sus objetos vinculados y sus ranuras, y lo que lleva puesto o vinculado.

- **Lo que hace un objeto mientras se lleva puesto o encima** se muestra en la pila seleccionada y en el selector ("While worn: -1 on checks (Sneak)"), y el Game Master lo ve junto al objeto (`worn: -1 on checks (Sneak)`). Las pruebas fuera de un combate lo aplican (consulta Pruebas fuera de un combate, más abajo).
- **Lo que hace un arma** se muestra igual ("Attack (Action): Brawn to hit, 1d6 + Brawn cut damage"), y un combate la ofrece mientras se empuña (consulta Armas en un combate, más abajo).
- **Lo que hace usar un objeto** se muestra igual ("Use (Action): heals 1d4 + 1, range 0 paces, used up"), con las cargas que le quedan. Lo ofrece un combate, y también el botón **Use** (Usar) del inventario y el `[inventory: action="use"]` del Game Master (consulta Usar objetos en un combate y Usar objetos fuera de un combate, más abajo).

En una batalla Classic o Tactical, cada uno de tus objetos con un `use` hace ahí lo que indica, y uno sin él no se ofrece (consulta Objetos en batallas Classic y Tactical, más abajo). Diga lo que diga `native`, la ficha puede leer tus objetos (abajo), un arma empuñada es un ataque en un combate del conjunto y dispara lo que saca de la bolsa, lo que hace un objeto mientras se lleva puesto o encima cuenta en él (consulta Armadura y efectos puestos en un combate, más abajo), un objeto con un `use` se usa según sus propias reglas, en un combate y fuera de él (consulta Usar objetos en un combate y Usar objetos fuera de un combate, más abajo), y tus `currencies` son el dinero del grupo (consulta Dinero, más abajo).

<a id="items-on-the-sheet"></a>

## Objetos en la ficha

Una referencia de valor puede leer los objetos que tiene un personaje con `itemStat` (Capability API 1.52). Ember Roads suma la guardia de la armadura que lleva puesta un viajero a su Guard, que es lo que debe superar un golpe:

```json
{
  "id": "guard",
  "label": "Guard",
  "op": "sum",
  "of": [{ "const": 6 }, { "abilityMod": "wits" }, { "itemStat": { "stat": "guard", "from": "worn", "pick": "sum" } }]
}
```

- `from`: `"worn"` son los objetos que lleva puestos el personaje: un objeto que ocupa ranuras mientras está equipado, uno que `binds` mientras está vinculado, y uno que hace ambas cosas mientras cumple ambas. Un objeto que no hace ninguna nunca se lleva puesto. `"carried"` es el resto de lo que tiene, y `"all"`, ambos.
- `pick`: `"sum"` suma el valor de cada objeto multiplicado por cuántos hay; `"max"` y `"min"` leen el valor individual más alto o más bajo, y `"count"` cuenta los objetos según cuántos hay.
- `stat` nombra una de tus estadísticas de objeto. `sum`, `max` y `min` necesitan una estadística `number`. `count` puede omitirla para contar todos los objetos, o nombrar cualquier estadística para contar solo los objetos que la dan.
- `slot`, `category` y `tag` (opcionales) conservan solo los objetos que ocupan esa ranura, son de esa categoría o tienen esa propiedad.
- `default` (opcional, 0 si se omite) es lo que lee cuando no se elige ningún objeto o ninguno da la estadística.

Los objetos cambian durante el juego, así que `itemStat` sigue la misma regla que una lectura viva: el `max` de una reserva o de un contador, la bonificación de competencia, `binding.max`, los números de `carry` y la columna escalada o el escalado de un catálogo no pueden leerlo, ni siquiera mediante un valor derivado. En cualquier otro lugar donde se lea un número, sí puede: un valor derivado, el `adjust` de una prueba, el `cap` de una habilidad, la defensa, la absorción o la iniciativa de un combate.

Los objetos de un personaje son los de su propia bolsa. La tarjeta del jugador (la que lleva el nombre del personaje con el que juega el chat o, si no, la primera) lee la bolsa del jugador, y cada una de las demás tarjetas, la suya. Solo cuentan los objetos de tu conjunto, porque un objeto simple no tiene estadísticas que leer. La ficha en pantalla, una prueba, el bloque de ficha del Game Master y un combate al empezar leen lo que tiene cada personaje en ese momento. Fuera de una partida, en el editor de fichas o en la revisión de una importación, nadie tiene nada e `itemStat` lee su `default`.

<a id="checks-outside-a-fight"></a>

## Pruebas fuera de un combate

Una prueba o salvación que el Game Master pide fuera de un combate lee más que la ficha: los estados activos del propio personaje, los niveles que ha alcanzado, lo que hacen sus objetos mientras los lleva puestos o encima, y lo que cuesta el requisito de un objeto puesto mientras no lo cumple. Es el mismo vocabulario que usan los estados de un combate (Capability API 1.53 para las claves de objeto y la restricción).

Un objeto indica lo que hace con `worn`, que se aplica mientras lo lleva puesto (y vinculado, si se vincula), y `carried`, que se aplica mientras solo lo lleva encima. El abrigo de cuero de Ember Roads cruje cuando te mueves a hurtadillas, y una piedra de camino hace que la gente de las caravanas confíe en ti:

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["sneak"], "flat": -1 }] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }] }
```

Cada uno toma las partes de un estado que lee una prueba:

- `effects`: `own-checks-advantage`, `own-checks-disadvantage`, `own-saves-advantage` y `own-saves-disadvantage`.
- `modifiers`: cambios `to` pruebas o salvaciones, con `flat`, `dice` (y `minus`), `mode` y sus propios `skills` o `saves`, exactamente como los de un estado.
- `failsSaves`: salvaciones que su portador falla sin tirar.
- `skills` y `saves`: a qué habilidades o salvaciones se refieren los efectos y los modificadores que no nombran las suyas.
- `abilities` (Capability API 1.54): atributos que cambia, por ID, cada uno `{ "set": N }` (al menos N: una puntuación más alta se mantiene) o `{ "add": N }` (un número negativo lo reduce). Se aplican antes de calcular la ficha, así que todo lo que lee el atributo lee el valor cambiado: la ficha en pantalla, los valores derivados, las pruebas, el bloque de ficha del Game Master y un combate al empezar. Primero se aplican las sumas, después el `set` más alto, y se respetan el `min` y el `max` del propio atributo. El máximo de una reserva o de un contador y la bonificación de competencia se calculan solo a partir de la ficha, así que un objeto no los mueve.

Los guanteletes de piel de buey de Ember Roads prestan a un agarre débil el de un boyero:

```json
"worn": { "abilities": { "brawn": { "set": 2 } } }
```

Lo que hace un objeto en un combate (defensa, ataques, velocidad, los demás efectos del combate y el daño y los estados que evita) está en [Armadura y efectos puestos en un combate](#armor-and-worn-effects-in-a-fight); una prueba fuera de un combate solo lee las partes anteriores. Un objeto se aplica una vez, por muchas pilas de él que tenga alguien.

Un objeto también puede exigir algo a quien lo lleva puesto, con `requires`: un valor de su ficha (`value`, cualquier referencia de valor, leída como todo lo que está en juego), lo mínimo que puede ser (`atLeast`) y lo que se aplica mientras no lo alcanza (`otherwise`, con el mismo vocabulario, salvo que no puede cambiar un atributo, porque lo que exige puede leer uno). Hasta cuatro. La pala de sepulturero de Gravewatch es un trabajo pesado para un guardián débil:

```json
"requires": [
  {
    "value": { "abilityScore": "sinew" },
    "atLeast": 3,
    "otherwise": { "modifiers": [{ "to": "checks", "skills": ["dig"], "flat": -1 }] }
  }
]
```

Un requisito lee el atributo tal como lo dejan los objetos de quien lo lleva puesto, así que unos guanteletes que fijan Sinew en 3 cumplen el de la pala.

En una prueba:

- Cada modificador que se refiere a ella suma su número, y sus dados se tiran: un número fijo en una prueba sumada, dados en una reserva. Una prueba de atributo, y una prueba que el conjunto no puede nombrar, solo leen lo que no está restringido a nada, y una salvación solo lee lo que se refiere a salvaciones.
- La ventaja y la desventaja de todas las fuentes, incluido el `mode=` del Game Master, se anulan entre sí: con cualquiera de cada una, la prueba se tira una sola vez. Solo se inclina un conjunto que tira dos veces (`resolution.advantage`).
- Una salvación que un estado u objeto hace fallar falla sin tirar, y no se gasta nada en ella.
- El registro indica lo que la cambió: `effects="-1"` para el número, `from="Leather coat"` para lo que la cambió y `automatic="true"` para una salvación fallada sin tirar. La tarjeta de dados muestra lo mismo, y el Game Master lo lee en el turno siguiente. Se le indica que el motor aplica estos cambios, para que no vuelva a sumarlos.

Gravewatch muestra lo mismo en una reserva: la Dawn bell vinculada añade un dado a Ward, y Rattled quita uno de Soothe y de Barter.

## Defensas por tipo de daño de estados, niveles, objetos y filas de la ficha

`combat.conditions[]` y `combat.levels[]` pueden conceder `resist`, `vulnerable`, `immune` (de 1 a 30 entradas cada uno) y `conditionImmunities` (de 1 a 40 IDs de estado). Se aplican mientras dura el estado o mientras se alcanza el umbral del nivel. Una inmunidad a un estado recién obtenida termina ese estado si ya está activo e impide volver a aplicarlo. La inmunidad tiene prioridad sobre la resistencia; la resistencia y la vulnerabilidad se anulan. Varias resistencias nunca reducen el daño a la mitad dos veces.

`resist` e `immune` usan la forma de las criaturas: una palabra de daño o `{ "type": "bludgeoning", "except": ["magical"] }`. Cualquier etiqueta nombrada en el golpe se salta esa entrada. `vulnerable` sigue siendo solo palabras de daño. La misma forma de excepción funciona en los efectos `worn` y `carried` de los objetos. Declara las etiquetas de excepción en `items.tags` y ponlas en las cualidades del arma o del conjuro. Por ejemplo, Stoneskin es una asignación de estado:

```json
{
  "condition": "stoneskin",
  "resist": [
    { "type": "bludgeoning", "except": ["magical"] },
    { "type": "piercing", "except": ["magical"] },
    { "type": "slashing", "except": ["magical"] }
  ]
}
```

La armor of invulnerability usa ese mismo array `resist` dentro de su efecto `worn`. Protection from Energy puede conceder `resist: ["fire"]`; un rasgo como Brave puede conceder `conditionImmunities: ["frightened"]`. Un nivel puede conceder `resist: ["poison"]` en su umbral. Las palabras de daño estáticas desconocidas se señalan cuando `combat.damageTypes` declara el vocabulario, igual que en las criaturas; sin esa declaración, las palabras de daño son texto libre.

Para los rasgos de ascendencia o de catálogo, `combat.sheetHides` contiene hasta ocho fuentes (se permite un array vacío). Cada una nombra una lista de la ficha, una columna de texto o enum de esa lista y uno de los cuatro tipos. Para un enano cuya fila de rasgos contiene `"poison"` en una columna `resistance`:

```json
"sheetHides": [{ "list": "traits", "column": "resistance", "kind": "resist" }]
```

Cada fila aporta palabras separadas por comas, recortadas y comparadas sin distinguir mayúsculas de minúsculas; las palabras vacías se omiten. Añadir una fila con `"fire"` añade resistencia al fuego; eliminarla quita esa fuente. Las palabras de resistencia e inmunidad pueden incluir `except`, como en `"bludgeoning except magical silvered"`. Las vulnerabilidades y las inmunidades a estados son palabras simples. Las palabras de daño declaradas desconocidas en el texto de la ficha se ignoran, igual que los IDs de estado desconocidos; una columna enum para inmunidades a estados solo debe declarar IDs de estado al importar. Los resúmenes de la ficha, de la batalla y del Game Master incluyen estas defensas y sus excepciones.

<a id="weapons-in-a-fight"></a>

## Armas en un combate

Un objeto puede ser un arma (Capability API 1.55). Su `attack` tiene la forma de las [filas de ataque](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) de un bloque de combate, con valores en lugar de columnas, y un [combate del conjunto](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) lo ofrece como ataque mientras el objeto se lleva puesto: empuñado con las manos que ocupa y vinculado si se vincula. Uno guardado o que solo se lleva encima no ofrece nada, y las filas de ataque y las acciones propias de una criatura funcionan exactamente como antes. El hacha de mano de Ember Roads:

```json
"attack": {
  "budget": "act",
  "toHit": { "abilities": { "stat": "swing" } },
  "damage": { "dice": { "stat": "damage" }, "abilities": { "stat": "swing" }, "type": "cut" },
  "reach": 2,
  "range": { "normal": 10, "long": 20 }
}
```

- `budget`: el presupuesto que gasta, uno de `combat.economy.budgets`.
- `toHit`: lo que suma para acertar. `abilities` son uno o más IDs de atributo, y cuenta el mejor de ellos (un arma de destreza enumera dos). `skill` suma lo que suma una prueba de esa habilidad, con el atributo del ataque en lugar del propio de la habilidad, igual que en una fila de ataque. `proficiency` es un valor de la ficha del portador: si lee más de 0, se suma la bonificación de competencia del conjunto (`{ "const": 1 }` para siempre). `bonus` es un número. `sheetBonus` es un número que se lee de la ficha del portador y se suma tal cual, para lo que el portador aporta a todas las armas de un tipo y no lo que es el arma: el estilo de combate Archery de 5e da `{ "derived": "archery" }` a cada arma a distancia, un valor derivado que es 2 para un arquero y 0 para cualquier otro (Capability API 1.95; los datos del objeto lo nombran por su nombre en la ficha). `target` es el objetivo por dado propio de un combate de reservas para el ataque de esta arma (la pala de Gravewatch cuenta cada dado desde 6 en vez del 7 de la reserva), y solo puede darlo un conjunto `dice-pool` cuyo `target` pueda moverse; en un combate sumado, su `bonus` dice lo mismo.
- `damage`: los `dice` que inflige, con el mejor de sus `abilities` de daño sumado, un `bonus` y un `type`. Un combate sumado necesita `dice`; en un combate de reservas, un impacto inflige sus éxitos y `dice` añade esa cantidad más del dado propio de la reserva. `sheetBonus` (Capability API 1.97) es un número de la ficha del portador que se suma al daño igual que el de `toHit`, y con `"oneHanded": true` solo cuenta mientras el arma se sostiene con una mano: no un arma `versatile` empuñada a dos manos, ni una que ocupa dos de una ranura. El Dueling de 5e da `{ "derived": "dueling" }`, 2 para un duelista que sostiene un arma. `rerollUpTo` (Capability API 1.98) es un valor de la ficha del portador: los dados de daño propios del arma iguales o inferiores a él se vuelven a tirar una vez y vale la cara nueva, también los dados extra de un crítico, solo mientras el arma se empuña a dos manos (un arma `versatile` con las manos libres, o una que ocupa dos de una ranura) y solo en un combate sumado. El Great Weapon Fighting de 5e da `{ "derived": "great_weapon_fighting" }`, 2 con el estilo.
- `reach` y `range` (`normal`, y `long` para lo que sigue alcanzando más allá) están en tu unidad de `combat.distance` y la necesitan. Un arma con ambos es arrojadiza, igual que una fila de ataque: un golpe de cerca, un lanzamiento más allá. Sin ninguno, alcanza una casilla.
- `versatile`: los `dice` que inflige en su lugar mientras cada ranura que ocupa tenga sitio para otro tanto entre lo que lleva puesto su portador: una lanza en una mano con la otra libre.
- `strikes`: cuántos ataques compra un gasto, leído de la ficha del portador, igual que el `strikes` de una fila de ataque. Un arma sin él da un ataque por gasto, por muchos ataques que tenga quien la empuña.

Cualquiera de esos números o palabras puede leer en su lugar una estadística del propio objeto: `{ "stat": "damage" }` es el `damage` del objeto, y una estadística a la que el objeto no da nada es como si el valor no estuviera escrito. `abilities` y `skill` leen una estadística enum cuyas palabras son IDs de atributo o de habilidad, y `type`, una estadística de texto o enum. Así, un objeto que el Game Master inventa `like=` un arma también es un arma y combate con sus propias estadísticas, limitadas por `rarityCaps` como cualquier estadística (un valor que escribes se copia tal cual). Uno inventado sin ranura ni vinculación nunca se lleva puesto, así que se crea sin el ataque. Un modelo pequeño suele describir un arma y omitir `like=`, así que uno inventado en una categoría de tus armas sin nada de lo que partir combate como el arma de esa categoría a la que más se parece por nombre (una palabra compartida en cualquier sentido, así que una ballesta se parece a un arco) o, si no, como la primera de ellas, tomando cualquier estadística que lea ese ataque y que la propuesta omitió, y la respuesta lo indica ("It fights as Hand axe does."). El formulario de propuesta del Game Master también le indica que un arma creada como otra combate como ella.

Las propiedades de un arma son lo que llevan sus golpes. Una entrada `resist` o `immune` de una criatura puede indicar qué la atraviesa: `{ "type": "tearing", "except": ["silver"] }` se recibe completo de un arma con la propiedad `silver` y se resiste de cualquier otra cosa. El grave wight de Gravewatch está escrito así, y su silver coffin nail lo atraviesa. El daño que no procede de un objeto arma nombra lo que lleva con `qualities` (Capability API 1.101), con las mismas etiquetas de objeto: en las `mechanics` de una entrada de catálogo (un conjuro) y en el `damage` de la acción de una criatura (la maza de un deva). La "resistencia al daño contundente, perforante y cortante de ataques no mágicos" de 5e es `{ "type": "slashing", "except": ["magical"] }` junto a lo mismo para los otros dos, con `magical` en las etiquetas de sus armas mágicas y `"qualities": ["magical"]` en sus conjuros y en los ataques de criatura que el SRD considera mágicos.

Los detalles del arma y la línea del Game Master indican lo que hace: `attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces`, con `1d8 with a hand free` para la boar spear de Ember Roads y `at 6` junto a la pala de Gravewatch.

<a id="ammunition-and-reloading"></a>

### Munición y recarga

Un arma puede disparar algo y puede tener una cantidad cargada propia (Capability API 1.57). El arco de caza de Ember Roads dispara flechas, y la pistola de guardia de Gravewatch lleva una bala, cargada con la munición y la pólvora del guardián:

```json
"ammo": { "tag": "arrow", "recover": 0.5 }
```

```json
"ammo": { "tag": "shot" },
"clip": { "max": 1, "reload": "act" }
```

- `ammo`: lo que dispara el arma, según una de tus `tags` de objeto. Cada ataque toma `perAttack` (1 si no dice nada) de los objetos con esa propiedad que lleva su portador, puestos o no, de la primera pila de ese tipo de su bolsa y después de la siguiente. El arma solo se ofrece mientras lleve suficientes, y el menú del combate indica cuántos quedan. Tras un combate que gana el grupo, `recover` (de 0 a 1) de lo que disparó cada uno vuelve a la pila de la que salió: la proporción se suma a lo largo de todo el combate y se redondea hacia abajo una vez por pila, así que la mitad de cinco flechas disparadas desde un carcaj son dos. Un combate perdido o del que se huye no devuelve nada.
- `clip`: una cantidad cargada que el arma lleva consigo. `max` es cuánto contiene, escrito o leído de una estadística numérica del objeto, y `reload` es el presupuesto que gasta una recarga. Un ataque gasta lo cargado en vez de tomar de la bolsa, y el arma solo se ofrece mientras contenga suficiente para uno. Una opción **Reload** (Recargar) en el menú del combate gasta `reload` y la llena: desde la bolsa si tiene `ammo` (todo lo que aún contenga la bolsa si es menos) y por completo si no tiene. La cantidad se guarda en la pila de inventario del arma, así que una pistola vaciada en un combate sigue vacía en el siguiente. Un arma que nadie ha disparado aún está cargada, y también una que un jugador combina en una pila de varias, porque una cantidad cargada pertenece a un arma. Las balas de un cargador no se recogen tras un combate, así que `recover` es para un arma sin cargador.

Lo que un combate dispara, carga y recoge se escribe en el inventario a medida que se da cada paso, igual que la salud del grupo, y el diario indica lo que se usó. Se rechaza un paso cuya pila ya no existe o contiene menos de lo que contaba el combate, igual que un objeto gastado que el combate no encuentra. El registro del combate indica cada disparo, recarga y recogida ("Hunting bow: 2 left to shoot.", "Ada loads 1 into Watch pistol: 1 of 1 loaded."), y los detalles del objeto y la línea del Game Master indican lo que dispara y contiene el arma: `ammunition Arrow (1 an attack, 50% picked up after a won fight)` y `holds 1, reload (Act)`.

<a id="modes-a-second-weapon-a-floor-and-conditions-on-a-hit"></a>

### Modos, una segunda arma, un mínimo y estados al impactar

Un arma puede tener otras formas de hacer su ataque, una compañera en la mano secundaria, un daño mínimo que inflige y estados que aplica a lo que golpea (Capability API 1.58). El arco de caza de Ember Roads puede disparar una andanada, y el silver coffin nail de Gravewatch puede empuñarse en cada mano y marca aquello en lo que se clava hondo:

```json
"modes": [{ "id": "volley", "label": "Volley", "ammo": 2, "toHit": -2, "targets": 2 }]
```

```json
"offHand": true,
"onHit": [{ "condition": "marked", "atLeast": 2, "rounds": 2 }]
```

- `modes`: hasta seis formas más de hacer el ataque, cada una con un `id`, una `label` y lo que cambia. `ammo` es cuántos disparos hace un ataque con ese modo, así que el arma tiene `ammo` o un `clip` desde el que disparar. `toHit` es lo que suma para acertar: dados en un combate de reservas y un número en uno sumado. `target` mueve en esa cantidad el objetivo por dado de un combate de reservas (desde el propio del arma o, si no, el de la reserva; `+1` es más difícil), si el objetivo de la reserva puede moverse. `targets` es a cuántos puede apuntar, cada uno con su propia tirada de ataque. El menú del combate pregunta de qué forma una vez elegido el ataque (después de su estilo de iniciativa, si hay estilos), cada una con lo que se espera que haga, y solo ofrece los modos para los que su portador tiene disparos. Un miembro del grupo que interpreta el motor evalúa cada modo dirigido a un objetivo, y deja a un jugador los modos para varios. En una ventana, un ataque se hace tal cual.
- `offHand`: un arma para la mano secundaria. El bloque de combate nombra el presupuesto que gasta un segundo ataque y si su daño conserva un atributo positivo:

  ```json
  "offHand": { "budget": "quick", "ability": "full" }
  ```

  Una vez que su portador ha atacado este turno con un arma marcada `offHand`, cada una de las demás armas de ese tipo que lleva puestas ofrece un segundo ataque con ese presupuesto, llamado "Silver coffin nail, off hand" en el menú. `ability` es `full` (predeterminado) o `penalty-only`, que suma el atributo de daño solo cuando resta algo, como hace el combate con dos armas de 5e. Un ataque con la mano secundaria es un único golpe, compre los ataques que compre el ataque principal, y nunca un golpe contra alguien que se aleja. Un arma marcada `offHand` necesita el `offHand` del bloque de combate. `fullWhen` (Capability API 1.97) es un valor de la ficha del combatiente: si es mayor que 0, la mano secundaria de ese combatiente conserva el atributo completo diga lo que diga `ability`, como hace el estilo Two-Weapon Fighting de 5e.

- `floor`: lo mínimo que inflige un impacto, escrito o leído de una estadística numérica del objeto. El daño de un combate de reservas después de la absorción, o el daño de un combate sumado, se sube hasta él antes de que una resistencia lo reduzca a la mitad, y el registro lo indica. Un golpe que gasta tira el número de quien lo hace y nunca se sube.
- `onHit`: hasta cuatro de tus estados que recibe el objetivo cuando el daño que infligió el golpe alcanzó `atLeast`, durante `rounds` de sus propios turnos o, sin él, hasta que algo lo quite. El daño es lo que le llegó después de la absorción y de sus resistencias; un golpe que toma quita iniciativa en vez de causar daño, así que no aplica ninguno. Una entrada también puede llevar `save: { "save": <save id>, "difficulty": n }`, que el objetivo tira cuando el estado se le iba a aplicar, y un éxito lo evita, y `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`, que hace que dure hasta que quien lo tiene supere esa salvación al principio o al final de cada uno de sus turnos o al recibir un daño mayor que cero (entonces no tiene `rounds`). Ambas cuentan como salvaciones contra ese estado, y contra la magia cuando el arma es mágica (Capability API 1.169). La sword of wounding de 5e: `{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`.
- `plus`: hasta tres cantidades más en cada impacto, cada una `{ "dice", "flat", "type", "save", "targetIs", "when" }`, tirada, con su tipo y resistida por separado (Capability API 1.169). `save` nombra su propia `difficulty` y su `onSuccess` (`half` o `none`). `targetIs` solo la inflige a un objetivo de esos tipos o etiquetas de criatura (consulta Tipos de criatura y pruebas de objetivo en [Cada clave](ruleset-combat.md#every-key), en la página de combate). `when: "critical"` solo la inflige en un impacto crítico; los dados de cualquier cláusula se duplican en un impacto crítico igual que los del arma. Una javelin of lightning es `{ "dice": "4d6", "type": "lightning" }`; una dragon slayer, `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`; una sword of sharpness, `{ "flat": 14, "type": "slashing", "when": "critical" }`. Una previsión solo cuenta una cláusula contra un objetivo al que alcanza, y nunca una que sea solo para críticos. `when: "toggled"` solo la inflige mientras el interruptor del objeto está encendido (Capability API 1.170; consulta `toggle` más abajo).

Los detalles del arma y la línea del Game Master lo indican todo: `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` y `Marked for 2 rounds when a hit deals 2 or more`.

<a id="armor-and-worn-effects-in-a-fight"></a>

## Armadura y efectos puestos en un combate

Lo que hace un objeto mientras se lleva puesto o encima también puede cambiar un combate (Capability API 1.56) para su portador, junto a sus estados y niveles. Cada uno toma las partes de un estado que lee un combate:

- `effects`: cualquiera de los de un estado salvo los cinco que no puede tener un nivel (`half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side`, `cannot-approach-source`), porque nadie le puso un objeto a su portador y nunca termina por sí solo: `own-attacks-advantage`, `attacks-against-disadvantage`, `resist-all`, `speed-zero` y los demás.
- `modifiers`: cambios `to` la defensa, los ataques y la velocidad, además de las pruebas y salvaciones, exactamente como los de un estado; en un combate `dice-pool`, un cambio a los ataques es un número fijo de dados, igual que el de un estado.
- `resist`, `vulnerable` e `immune`: tipos de daño de los que su portador recibe la mitad, el doble o nada, igual que los de una criatura (y comprobados contra `combat.damageTypes` si declaras alguno). `conditionImmunities`: tus propios estados que nunca se aplican a su portador.

El widow's ring maldito de Gravewatch cuesta un dado en cada ataque, su Dawn bell vinculada impide que a su portador se le aplique Rattled, y una piedra de camino de Ember Roads llevada encima protege del calor:

```json
"worn": { "modifiers": [{ "to": "attacks", "flat": -1 }] }
```

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["ward"], "flat": 1 }], "conditionImmunities": ["rattled"] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }], "resist": ["burn"] }
```

Un combate lee cada objeto una vez, con el nombre de la pila ("Widow's ring" junto a una tirada en el registro, y en una defensa), igual que una prueba; el `otherwise` de un requisito no cumplido también cuenta en un combate, así que una armadura demasiado pesada para quien la lleva puede costar velocidad. Los detalles de un objeto y la línea del Game Master lo indican todo ("While worn: -1 on attacks", "worn: +1 on checks (Ward), immune to Rattled"). Una armadura que simplemente suma a una defensa o a una absorción es una estadística de objeto leída con `itemStat` (consulta Objetos en la ficha), igual que el Guard de Ember Roads lee el abrigo que se lleva puesto.

**Dureza.** Si la iniciativa es un número que mueven los ataques, `combat.pool.hardness` es la dureza de un combatiente, leída de su ficha al empezar el combate (la de su armadura, mediante `itemStat`), y una criatura da su propia `hardness`. Un golpe que gasta cuyos dados están por debajo de ella impacta y no hace nada: el número de quien lo hace sigue volviendo a la base, el registro lo indica ("Ada's Grave spade lands on the warden with 5 dice, below a hardness of 6, and does nothing.") y el menú no le prevé ningún daño. Solo puede tenerla un conjunto con un estilo que gasta, y una criatura escrita como ficha la toma de la ficha.

<a id="using-items-in-a-fight"></a>

## Usar objetos en un combate

Un objeto puede usarse en un combate (Capability API 1.59): una cataplasma sobre un corte, un tónico que se traga, una campana que se toca. Su `use` indica lo que hace usarlo con las palabras que usa el `mechanics` de una entrada de catálogo (consulta [Qué lee un combate de `mechanics`](ruleset-combat.md#what-a-fight-reads-from-mechanics)): `kind` (`heal`, `attack`, `buff` o `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire` y, desde Capability API 1.174, `concentration` y `zone`, con el `budget` que gasta, o `free`. La cataplasma de Ember Roads y el tónico de calor y la campana del alba de Gravewatch:

```json
"use": { "kind": "heal", "budget": "act", "range": 0, "targets": "ally", "amount": { "dice": "1d4", "flat": 1 }, "consumes": true }
```

```json
"use": { "kind": "heal", "budget": "quick", "targets": "self", "amount": { "flat": 1 }, "consumes": true }
```

```json
"stack": 1,
"use": {
  "kind": "debuff",
  "budget": "act",
  "targets": "enemy",
  "save": { "save": "steel", "onSuccess": "negates" },
  "saveDifficulty": 7,
  "applies": [{ "condition": "rattled", "duration": { "rounds": 2 } }],
  "charges": 1
},
"charges": { "max": 3 }
```

- Un uso aparece en el menú del combate bajo **Items** (Objetos), con el nombre del objeto ("Poultice") se llame como se llame la pila. Un objeto que ocupa ranuras o se vincula se usa mientras se lleva puesto (y vinculado, si se vincula), como la campana; cualquier otro, mientras se lleva encima.
- Gasta un presupuesto, o es `free`, y paga consigo mismo: un `cost`, `perCostStep`, `check`, `concentration`, `reaction`, `scales`, `gives`, `standard` o `rider` es para una entrada de catálogo que tiene una ficha, y se rechaza en un uso.
- `toHit`, en un uso con `attackRoll`, es lo que suma para acertar, tal como lo indica el `toHit` de un arma (consulta Armas en un combate): atributos, una habilidad, una bonificación y, en un combate de reservas, un objetivo por dado. Sin él, la tirada no suma nada.
- `saveDifficulty`: el número contra el que se tira una salvación que pide (la suya propia, una que termina un estado que aplica, o la de una cláusula sin `difficulty`), escrito o leído de una estadística numérica del objeto. Una entrada de una ficha lee ese número de la fuente de su catálogo; un objeto no tiene ninguna, así que indica el suyo.
- `consumes: true` quita uno de la pila del objeto cada vez que se usa, y el menú indica cuántos quedan. El último que se usa se lleva la pila con él.
- `restore` (Capability API 1.60) devuelve parte de una reserva de cada ficha a la que llega, como una bolsa de sangre devuelve sangre: `{ "pool": "resolve", "amount": { "flat": 1 } }`, con `dice` y `flat` como los tiene un `amount`. Nombra una de tus reservas vivas, nunca la reserva de salud (la salud vuelve con una curación), y va en un uso que ayuda, un `heal` o un `buff`. Una criatura no tiene reservas, así que no recibe nada. El registro lo indica ("Ada gets back 1 Resolve, and is on 3 of 4."), y un miembro del grupo que interpreta el motor deja en paz una reserva llena. El tónico de calor de Gravewatch restaura un punto de Resolve junto a su curación.
- `charges` gasta esa cantidad de las `charges` propias del objeto, cuyo `max` es cuántas contiene, de 1 a 100, escrito o leído de una estadística numérica del objeto (se rechaza un objeto que da esa estadística como menos de 1, y uno que pasa de 100 contiene 100). La cantidad se guarda en la pila de inventario del objeto, así que una campana tocada dos veces en un combate tiene una carga en el siguiente, y una que nadie ha tocado está llena. Las cargas pertenecen a un objeto, así que un objeto que las contiene tiene un `stack` de 1. Un uso se consume o gasta cargas, nunca ambas cosas, y las cargas de un objeto siempre las gasta su uso. Dos claves de `charges` van más allá (Capability API 1.61), como las tiene la campana del alba de Gravewatch:

  ```json
  "charges": { "max": 3, "recharge": { "rests": ["vigil"], "amount": "max" }, "breaksOn": { "die": 20, "atMost": 1 } }
  ```

  - `recharge`: cuáles de tus `rests` devuelven las cargas y cuántas: `"max"` llena el objeto, y una cantidad (`{ "dice": "1d6", "flat": 1 }`) devuelve esa cantidad, nunca por encima de `max`. Un descanso devuelve las cargas de cada objeto que lleva su personaje y que lo nombra, tanto si lo hace el botón Rest de la ficha como el `[sheet: op="rest"]` del Game Master; la ficha y la bolsa se escriben juntas, y una respuesta regenerada solo recarga una vez. La ficha indica lo que volvió tras el descanso ("Dawn bell 3/3 charges"), y el Game Master ve las cargas que le quedan a cada objeto junto a él en el inventario ("2 of 3 charges left").
  - `breaksOn`: cuando un uso gasta la última carga, el motor tira un d`die`, y con `atMost` o menos el objeto se rompe y desaparece de la bolsa, en un combate y fuera de él. El registro del combate lo indica ("Dawn bell breaks (a 1 on its die)."), también el informe del botón Use ("Its last charge spent, it breaks."), y el diario lo cuenta como perdido.

- `gate` (Capability API 1.62) es una prueba que su usuario supera antes de que el objeto funcione, como pide un pergamino de un conjuro por encima del nivel de quien lo lee. `check` nombra lo que se tira: `{ "skill": "ward" }`, `{ "ability": "wits" }` o un valor de la ficha (`{ "value": { "derived": "spell_mod" } }`, para un número que varía de un personaje a otro, como el modificador de lanzamiento de conjuros de un lanzador de 5e). `difficulty` va de 1 a 100, escrito o leído de una estadística numérica del objeto (un objeto que no lo da queda fuera del menú, y su botón Use lo dice claramente). `unless` omite la prueba cuando un valor de la ficha del usuario es al menos `atLeast`. Una prueba fallida consume el objeto (o gasta sus cargas) para nada. En un combate, la prueba se tira al gastar el objeto, con los dados propios del combate (una reserva en un combate de reservas, donde `difficulty` son los éxitos que necesita) y el número de la ficha leído al empezar el combate, y cuenta lo que suman a esa prueba los estados y objetos puestos del usuario, incluido lo propio de una habilidad. El registro lo indica ("Ada rolls Ward to use Page of the vigil litany: 2 successes from 2 dice at 7 or more (8, 9), needing 2 successes, a success."). La página de la letanía de vigilia de Gravewatch tiene una:

  ```json
  "gate": { "check": { "skill": "ward" }, "difficulty": 2, "unless": { "value": { "abilityScore": "nerve" }, "atLeast": 3 } }
  ```

Lo que un combate consume y las cargas que deja se escriben en el inventario a medida que se da cada paso, igual que los disparos de un arma, y el diario indica lo que se usó. El registro del combate indica cada uso ("Poultice: 1 of 2 left.", "Dawn bell: 2 of 3 left."). Un miembro del grupo que interpreta el motor solo usa una curación en alguien herido, y nadie usa un objeto para golpear a alguien que se aleja. Los detalles del objeto y la línea del Game Master indican lo que hace usarlo: "Use (Action): heals 1d4 + 1, range 0 paces, used up" y `use (Act): Steel 7 save negates it, Rattled, 1 of 3 charges`, y los detalles muestran las cargas que quedan. Un objeto que el Game Master inventa `like=` uno de los tuyos se usa como ese, cargas incluidas.

## Objetos en batallas Classic y Tactical

Un conjunto que no resuelve sus propios combates los deja a las batallas Classic y Tactical propias de Game Mode, donde se pregunta a un modelo qué hacen los objetos del inventario cuando empieza un combate. Tus objetos no se adivinan: cada uno con un `use` hace lo que este indica, con los números propios del motor, y la suposición del Game Master solo se pide para los objetos que no son tuyos (y para ninguno con `native: false`).

- Un `heal` cura y un `attack` daña en una proporción de la salud máxima del objetivo, según la media de su `amount`: una media de 7, el `1d8+3` de un arma básica, es algo más de una quinta parte, nunca menos de una vigésima parte y como mucho toda. Esa es la escala con la que el puente de combate lee los números de una entrada de catálogo. El `damageType` es el elemento.
- El primer estado de `applies` se aplica como estado con su propio nombre, durante sus `rounds` (2 si no las tiene), y un `buff` o `debuff` es solo ese estado, que sube o baja la defensa como lo hacen los estados propios del motor.
- `targets` indica en quién se usa. Sin él, una curación o una mejora va a un aliado, y un ataque o un perjuicio, a un enemigo.
- `consumes: true` quita uno de la pila, y un uso sin él deja el objeto donde está.
- Una tirada para acertar, una salvación, un área, los puntos temporales y una reserva restaurada no tienen cabida en estas batallas, igual que ahí con el `mechanics` de una entrada de catálogo: la descripción del objeto en el menú sigue indicándolos.
- Un objeto que ocupa ranuras solo se usa mientras se lleva puesto, y uno que se vincula, solo mientras está vinculado, igual que en un combate del conjunto. Uno que se consume se toma de lo que se lleva puesto, nunca de uno de repuesto de la bolsa.
- Un objeto cuyo uso gasta `charges` se ofrece mientras le quede un uso, y el menú Items cuenta sus usos. Cada uso las gasta de la pila del objeto, primero la del propio jugador, y el último gasto tira su `breaksOn`: si se rompe, desaparece de la bolsa y el diario lo cuenta como perdido.
- Un objeto que pide antes una prueba (`gate`) la tira en el servidor cuando lo usa un miembro del grupo, con la ficha de ese miembro y lo que lleva puesto (un acompañante sin tarjeta propia tira con una ficha en blanco, y solo la unidad propia del jugador recurre a la tarjeta del jugador), igual que la tira el botón Use, y se omite cuando se cumple `unless`. Si falla, el objeto se gasta (o se gastan sus cargas) y no hace nada, y el registro lo indica: "Ada rolls Ward to use Page of the vigil litany: 0 against 2, failed, and it is used up for nothing."
- Un objeto sin `use` no se ofrece en estas batallas, ni tampoco una curación sin `amount`.

El motor calcula por sí mismo el efecto de cada objeto, así que lo que envía la pantalla nunca decide lo que hace uno de tus objetos.

<a id="loot"></a>

## Botín

Un combate ganado suelta botín en toda partida de Game Mode, una vez, en las bolsas del grupo. Sin conjunto, procede de las tablas propias de Game Mode (más y más raro en una partida más difícil), y lo mismo ocurre en un conjunto que no declara tablas de botín y deja `native` activado. Un conjunto que declara tablas de botín suelta en su lugar sus propios objetos, y uno con `native: false` y sin tablas no suelta nada.

`lootTables` en el bloque `items` (Capability API 1.63) las enumera, como hacen los ajuares funerarios de Gravewatch:

```json
"lootTables": [
  {
    "id": "grave_goods",
    "label": "Grave goods",
    "rolls": "1d2",
    "entries": [
      { "item": "kit/shot-and-powder", "weight": 4, "count": "1d4" },
      { "item": "kit/warming-tonic", "weight": 3 },
      { "item": "kit/litany-page", "weight": 2 },
      { "filter": { "category": "arm" }, "weight": 1 },
      { "coins": "shilling", "weight": 2, "count": "1d6" }
    ]
  }
]
```

- `rolls` es cuántas elecciones hace la tabla: un número de 0 a 20, o dados (`"1d2"`), 1 de forma predeterminada.
- Cada elección saca una línea según su `weight` (1 de forma predeterminada) frente a las demás. Una línea nombra uno de tus objetos como `<catalog>/<entry>`, un `filter` por `rarity`, `category` y `tag`, que elige por igual entre todos los objetos que coinciden, o (Capability API 1.64) `coins`, una de tus monedas por su ID. `count` es cuántos se sueltan, un número o dados, 1 de forma predeterminada. Un objeto o una moneda que retira una capa no suelta nada, ni tampoco un filtro que no encuentra ninguno.
- Una criatura del bestiario nombra la tabla que lleva con `loot` (consulta [Criaturas](ruleset-combat.md#creatures-a-bestiary-a-fight-reads)). Un combate del conjunto ganado tira la tabla de cada criatura derrotada, y un combate que el motor no resuelve con tus reglas no tiene criaturas del bestiario, así que no suelta nada.
- Lo que se suelta va a la vista compartida igual que una adición, preguntando primero a la bolsa del jugador, y lo que nadie puede llevar se queda atrás. El resumen que recibe el Game Master indica lo que se soltó y que ya está en las bolsas, el diario lo indica y una notificación lo muestra.
- El Game Master tira una tabla en la historia con `[loot: table="grave_goods" who="Ada"]` (`who=` para la bolsa de un personaje), medido desde donde empezó el turno, igual que sus etiquetas de inventario, así que una respuesta regenerada suelta una sola vez. Cada objeto que se suelta se responde como una adición, y sus instrucciones enumeran tus tablas.

## Dinero

Tus `currencies` son el dinero del grupo. Una moneda es un objeto en las bolsas, una pila de cada moneda como cualquier otra, con el nombre de su `label`:

- Pesa una unidad de tu estadística de carga por cada `perWeight` monedas de su familia, cuenta para la carga de su portador y se coloca según la regla de carga cuando entra. Una familia sin `perWeight` no pesa nada.
- El jugador añade monedas desde la lista **Coins** (Monedas) del selector, y las divide, regala y combina como cualquier pila.
- Una línea sobre las pilas del inventario muestra las monedas de cada familia a la vista y su valor en la moneda más pequeña de la familia. El Game Master ve ese valor junto a cada bolsa (`Coin worth 432 pennies`, o `no coins` para un monedero vacío, con la bolsa del jugador incluida aunque no contenga nada), y el `cost` de un objeto junto al objeto (`costs 3 shillings`).
- El Game Master paga con `[inventory: action="pay" amount="3 shillings" who="Ada"]` y cobra con `action="earn"`. `amount` es una cantidad y una moneda, por su ID o etiqueta, en singular o plural, con cualquier combinación de mayúsculas (`1 penny`, `12 pennies`). Un pago sale de una bolsa (la del jugador sin `who=`), solo en la familia propia de la moneda: primero van las monedas más grandes que caben, después se cambia la moneda más pequeña restante que cubre lo que aún se debe, y el cambio vuelve en las monedas más pequeñas de la familia, empezando por las más grandes. La respuesta indica lo que se pagó y lo que volvió: pagar 3 shillings de un monedero que contiene una crown es `Paid with crowns ×1; shillings ×2 back.` Se rechaza un pago que la bolsa no puede cubrir (`cannot-afford`), una moneda que no tienes (`unknown-coin`) y cualquier pago en un conjunto sin monedas (`no-currencies`). Un cobro es una adición de esa moneda, a la bolsa de `who` o repartida según la regla de carga. El diario enumera lo gastado y lo cobrado, y una notificación lo muestra. Sus instrucciones enumeran tus monedas, y solo las tiene un conjunto que tenga alguna.
- Comprar es un pago seguido de una adición o, en un conjunto con mercado, un `buy` (abajo). No hay pantalla de tienda.

## Equipo inicial

`items.startingGear` (Capability API 1.78) enumera el equipo que un personaje puede meter en su bolsa al empezar: el kit de una clase, el de un trasfondo, el de una vocación. Nunca se da por sí solo. El inventario muestra una fila **Starting gear** (Equipo inicial), y el jugador elige un equipo, una opción para cada una de sus elecciones y un objeto de cada lista, y después lo mete en su bolsa o en la de un miembro del grupo. Primero aparece el equipo que encaja (`fits`) con la ficha del personaje y después el equipo sin `fits` (para cualquier personaje, como el de un trasfondo); se ofrece todo el equipo, porque el concepto de un personaje lo acuerdan el jugador y el Game Master.

```json
"startingGear": [
  {
    "id": "fighter", "label": "Fighter", "group": "class",
    "fits": { "value": { "field": "level_fighter" }, "atLeast": 1 },
    "lines": [{ "item": "equipment/shield", "equip": true }],
    "choices": [
      {
        "label": "Armor",
        "options": [
          { "label": "Chain mail", "lines": [{ "item": "equipment/chain-mail", "equip": true }] },
          { "label": "Leather armor and a longbow", "lines": [
            { "item": "equipment/leather-armor", "equip": true },
            { "item": "equipment/longbow" }, { "item": "equipment/arrow", "count": 20 }
          ] }
        ]
      },
      { "label": "A martial weapon", "options": [
        { "label": "Pick one", "lines": [{ "oneOf": ["equipment/longsword", "equipment/battleaxe"] }] },
        { "label": "A greataxe", "lines": [{ "item": "equipment/greataxe" }] }
      ] }
    ]
  },
  { "id": "acolyte", "label": "Acolyte", "group": "background", "lines": [{ "coins": "gp", "count": 15 }, { "name": "Vestments" }] }
]
```

- Una línea es uno de los objetos del conjunto (`item`), monedas (`coins`, un ID de unidad), un objeto que el jugador elige de una lista fija (`oneOf`, de 2 a 48 objetos) o un objeto simple por su nombre (`name`, cuando `freeform` permite objetos simples; sujeto a las reglas de una etiqueta, así que sin corchetes, `{{` ni saltos de línea). `count` va de 1 a 999; `equip: true` hace que se ponga un objeto al tomarlo, si sus ranuras están libres, así que la armadura cuenta desde el principio.
- `choices` va de 0 a 8, cada una con 2 a 6 opciones con sus propias líneas.
- `group`: el equipo que un personaje toma una vez por grupo (el de una clase y el de un trasfondo). Volver a tomar el mismo grupo es una decisión que el jugador toma en el cuadro de diálogo, y se suma a lo que ya hay en la bolsa. El equipo sin grupo es su propio grupo, nunca el mismo que un grupo con el mismo nombre.
- `fits` lee la ficha sin su estado vivo, igual que la carga. Solo ordena la lista.
- Tomarlo es todo o nada: el equipo demasiado pesado para quien lo va a llevar se rechaza entero, y el cuadro de diálogo indica cuánto pesa frente a lo que aún puede llevar. Un objeto que una capa saca de la partida se omite y se nombra, igual que una lista de la que saca todos los objetos; las monedas de un tipo que una capa saca se pagan en la moneda más grande que quede del mismo valor, y el cuadro de diálogo las muestra así. Se rechaza el equipo del que no queda nada, para que nunca se marque como tomado a cambio de nada. Un servicio nunca se ofrece desde una lista.
- La importación comprueba cada objeto (en un catálogo incluido en el archivo; un catálogo en su propio archivo se comprueba al tomar el equipo), moneda, objeto simple y referencia `fits`, rechaza un servicio y rechaza una cantidad que necesitaría más pilas de las que admite una bolsa a la vez.

## Mercados

Un `market` en el bloque `items` (Capability API 1.65) indica qué vende un lugar y a qué precio, en vez de que todas las tiendas vendan de todo a su precio de lista. El de Gravewatch, algo abreviado:

```json
"market": {
  "prices": [
    { "id": "cheap", "label": "cheap", "times": 0.75 },
    { "id": "fair", "label": "fair", "times": 1, "default": true },
    { "id": "dear", "label": "dear", "times": 1.5 }
  ],
  "places": [
    { "id": "hamlet", "label": "hamlet" },
    { "id": "village", "label": "village" },
    { "id": "town", "label": "market town" },
    { "id": "city", "label": "city" }
  ],
  "sold": [
    { "filter": { "rarity": "rare" }, "place": "town" },
    { "filter": { "category": "arm" }, "place": "village" }
  ],
  "sellers": [
    { "id": "chandler", "label": "chandler", "sells": [{ "category": "coat" }, { "category": "tonic" }] },
    { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "place": "village" },
    {
      "id": "chapel",
      "label": "chapel of the Vigil",
      "sells": [{ "category": "page" }],
      "place": "town",
      "only": { "value": { "abilityScore": "nerve" }, "atLeast": 3, "label": "wardens of Nerve 3 or more" }
    }
  ]
}
```

- `prices`: de uno a ocho niveles, cada uno un multiplicador (`times`, mayor que 0) sobre el `cost` de un objeto, y uno de ellos el `default`. Un precio es el coste en la moneda más pequeña de su familia multiplicado por el nivel y redondeado en ella (nunca por debajo de una moneda para algo que cuesta algo), y se expresa en la moneda en la que está escrito su coste si esa moneda lo paga exactamente o, si no, en la moneda más grande que dejan tus capas y que lo hace: en `dear`, un abrigo que cuesta 8 shillings cuesta 12 shillings, y una poción de 5e que cuesta 50 gp cuesta 50 gold pieces, nunca 5 platinum. Regatear o el humor de un vendedor mueven el nivel, nunca el número.
- `places`: de uno a doce tamaños de lugar, del más pequeño al más grande, con tus propias palabras.
- `sold`: reglas para el lugar más pequeño que vende lo que elige un filtro. Un filtro nombra una `rarity`, una `category` y una `tag`, cualquiera de ellas, y coincide con un objeto que tenga todas las que nombra; decide la primera regla que coincide con un objeto. El `sold` propio de un objeto tiene prioridad sobre las reglas, y un objeto que nada nombra se vende en cualquier lugar.
- `sellers`: tipos de vendedor, cada uno con lo que `sells` (filtros, cualquiera de los cuales elige un objeto), el `place` más pequeño que tiene uno (cualquier lugar, sin él) y, opcionalmente, a quién vende `only`: un valor de la ficha del comprador, con su estado vivo y lo que lleva encima, al menos `atLeast`, que se indica al Game Master como `label`. Sin `sellers`, cualquiera en un lugar vende lo que vende ese lugar.
- `unsold` (Capability API 1.813): filtros para lo que ningún vendedor tiene entre su mercancía, dondequiera que lo situaran `sold` y `sells`. La tabla de `stock` de un vendedor aún puede sacar uno, así que un lote ocasional es la única forma de comprarlo, y los vendedores siguen comprándolo de vuelta. Una capa puede añadirle filtros (el `[{ "tag": "magical" }]` de un entorno de magia escasa, consulta [capas](ruleset-layers-and-translations.md)).
- Un objeto sin `cost` no está a la venta, ni tampoco uno que oculta una capa o uno cuyas monedas retiró una capa.

**Dónde está el grupo.** El Game Master indica en qué lugar está una escena y su tamaño con `[place: name="Millbrook" size="market town"]`, el tamaño por su ID o etiqueta, y omite el tamaño para un lugar sin mercado (un camino, las tierras salvajes). El motor responde a cada etiqueta en su sitio, rechazando un tamaño que no tienes, y el último lugar al que respondió en sus propias respuestas que ve el jugador, desde el inicio de conversación más reciente, es el lugar vigente hasta que se indique otro. Una etiqueta de lugar que escribe un jugador nunca cuenta. Una respuesta regenerada solo lee lo que vino antes de la indicación que sustituye.

**Comprar.** El Game Master compra con `[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]`, con `level` (el predeterminado sin él) y `seller` (cualquier vendedor de aquí que venda el objeto, sin él) opcionales. El motor le pone precio en el lugar vigente cuando termina la respuesta, saca el precio del monedero del comprador (el del jugador sin `who=`) igual que un pago, con cambio, y mete el objeto en su bolsa, o solo paga un servicio. Ocurren ambas cosas o ninguna. La respuesta indica lo que costó (`price="12 shillings"`) y lo que se pagó y se devolvió, y una notificación lo muestra. Una compra se rechaza, sin cambiar nada, si no se ha indicado lugar (`no-place`), si un nivel, objeto o vendedor no existe (`unknown-level`, `unknown-item`), si no hay precio (`not-for-sale`), si el lugar es demasiado pequeño para el objeto (`not-here`), si no hay aquí ningún vendedor que lo venda (`no-seller`), si el comprador no cumple el `only` de un vendedor (`not-to-you`), si el monedero no puede cubrirlo (`cannot-afford`) o si una bolsa no puede llevarlo.

**Lo que ve el Game Master.** Mientras una escena está en un lugar con mercado, un bloque MARKET nombra el lugar y su tamaño, los niveles de precio y cada vendedor que hay allí con una docena de lo que vende al nivel predeterminado, de lo más barato a lo más caro; cualquier cosa que venda puede comprarse por su nombre. Sus instrucciones enseñan `[place:]` y `buy`, y solo las tiene un conjunto con mercado.

### Un día de mercado

Un día de mercado (Capability API 1.69) hace que las existencias de un lugar cambien y se agoten, y permite al grupo vender. El de Gravewatch, algo abreviado:

```json
"places": [
  { "id": "hamlet", "label": "hamlet", "purse": { "amount": 10, "unit": "shilling" } },
  { "id": "town", "label": "market town", "purse": { "amount": 100, "unit": "shilling" } }
],
"buyBack": 0.5,
"sold": [{ "filter": { "rarity": "rare" }, "place": "town", "limited": "1d2" }],
"sellers": [
  { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "stock": { "table": "smiths_odd_lot" } }
]
```

- **El día.** Un día en un lugar dura hasta que el Game Master nombra otro lugar; empieza un día nuevo en el mismo lugar volviendo a indicarlo con `day="new"` (`[place: name="Millbrook" size="market town" day="new"]`). Todo lo siguiente se calcula por día a partir de las respuestas del Game Master que ve el jugador, así que un swipe, una respuesta regenerada o una rama no necesitan guardar nada, y un día siempre tira las mismas existencias.
- **`limited`** en una regla `sold` o en el `sold` propio de un objeto: cuántos tiene disponibles un lugar en un día, un número o dados tirados para el día. Una regla puede nombrar un límite sin lugar (se vende en cualquier lugar, unos pocos cada vez); el lugar de un objeto procede de la primera regla que nombra un lugar, y su límite, de la primera que nombra un límite. Una vez comprados, una compra se rechaza (`sold-out`) hasta un día nuevo.
- **`stock`** en un vendedor: una de tus tablas de botín, tirada una vez al día para lo que ese vendedor tiene en existencias además de lo que vende. Lo que sale (solo objetos, nunca monedas) lo vende únicamente ese vendedor, tantos como salieron, digan lo que digan `sells` y `sold`; el `only` de un vendedor sigue aplicándose.
- **`buyBack`**: la proporción (mayor que 0, como máximo 1) del precio predeterminado de un objeto que paga un vendedor por él. Lo compra un vendedor de aquí que venda ese tipo de cosa (cualquiera, sin vendedores). Sin `buyBack`, nadie compra nada.
- **`purse`** en un tamaño de lugar: lo máximo que pagan en total sus vendedores en un día, en una de tus monedas. Las ventas pagadas en la familia de esa moneda cuentan contra ese máximo; sin fondos, compran sin límite.
- **Vender.** El Game Master vende con `[inventory: action="sell" item="Silver coffin nail" count="1" seller="smith" who="Ada"]`. El motor le pone precio, lo saca de la bolsa de quien vende (la del jugador sin `who=`; nunca un objeto maldito vinculado) y mete sus monedas, empezando por las más grandes, o lo rechaza sin cambiar nada: si no se ha indicado lugar, si nadie aquí lo compra (`not-bought`), si no hay precio (`not-for-sale`), si los fondos del día se han agotado (`purse-spent`), si no se tiene ninguno o si la bolsa no puede llevar las monedas. La respuesta indica lo que se obtuvo (`price="4 shillings"`), el diario lo registra como vendido y una notificación lo muestra.
- El bloque MARKET añade lo que tiene cada vendedor en existencias hoy, cuántos quedan de un objeto limitado, lo que pagan los vendedores de aquí y cuánto queda de los fondos del día; sus instrucciones enseñan `sell` y `day="new"`.

### Vendedores honrados y deshonestos

Capability API 1.79 permite que un objeto sea arriesgado o una falsificación, y que un vendedor sea deshonesto.

```json
"items": { "market": { "sellers": [
  { "id": "fence", "label": "Fence", "sells": [{ "tag": "magical" }], "place": "town", "honest": false, "stock": { "table": "fences_odd_lot" } }
] } }
```

```json
{ "id": "bag-of-devouring", "label": "Bag of Devouring", "item": { "category": "wondrous", "passesFor": "magic_items/bag-of-holding", "cost": { "amount": 5, "unit": "gp" } } }
{ "id": "wand-of-wonder", "label": "Wand of Wonder", "item": { "category": "wand", "risky": "every wave is a gamble; some effects turn on the one who waves it" } }
```

- **`risky`** en un objeto: la advertencia que hace un vendedor honrado antes de venderlo. El bloque MARKET lo muestra con "(warn the buyer first: ...)" junto a la mercancía de un vendedor honrado; un vendedor deshonesto no dice nada.
- **`passesFor`** en un objeto lo convierte en una falsificación de otro objeto (`<catalog>/<entry>`): un objeto real y vendible de la misma categoría, que se lleva puesto en las mismas ranuras y que se vincula si la falsificación se vincula. Se comprueba al importar cuando ambos se pueden leer, al instalar para cada archivo de catálogo y de nuevo cuando un mercado lo ofrece, así que nunca se vende una falsificación cuyo objetivo falta o está oculto por una capa. Un objeto maldito (`binds.cursed`) o una falsificación nunca están entre la mercancía de nadie, ni en las existencias de un vendedor honrado.
- **`honest: false`** en un vendedor: una falsificación que sale en su tabla de `stock` se ofrece como el objeto por el que se hace pasar, al precio de ese objeto, y el bloque MARKET muestra al Game Master la verdad a su lado. Una compra que nombra a ese vendedor y ese objeto recibe la falsificación; una compra que no nombra a ningún vendedor nunca la recibe.
- **Una falsificación en la bolsa** se muestra como el objeto por el que se hace pasar en todos los sitios que mira el jugador (la bolsa, el diario, las notificaciones, los combates), y conserva lo que es en realidad. El bloque de inventario del Game Master la marca como `[FAKE: really ...]` y le pide que la siga llamando por el nombre con el que se muestra.
- **Descubierta**: `[inventory: action="reveal" item="Bag of Holding" who="Ada"]`, vincularla (al sintonizarla se revela una maldición), usarla (ocurre lo que hace en realidad; cuando eso es nada que las reglas puedan calcular, lo cuenta el Game Master) o vendérsela a un comprador honrado, que dice lo que es en realidad y paga lo que vale eso (su propio `cost`), o la rechaza si no tiene. Un comprador deshonesto acepta una falsificación como lo que parece. A partir de entonces es su objeto verdadero.
- **Puesta o llevada**: una falsificación hace en la ficha del personaje lo que hace en realidad (sus efectos `worn` o `carried` y sus estadísticas). El primer cambio de inventario tras el cual la ficha muestra un número, o lo que suma una prueba, que no daría el objeto por el que se hace pasar la descubre, y el diario y la pantalla indican lo que era. Una diferencia que solo lee un combate (una resistencia) no la descubre, ni tampoco un cambio solo en la ficha hasta el siguiente cambio de inventario. En un combate, un arma falsa puesta sigue atacando como el arma por la que se hace pasar.
- Con la confianza de un solo jugador, Peek Prompt muestra la vista del Game Master, incluida la verdad.

<a id="spotting-fakes"></a>

### Detectar falsificaciones

Capability API 1.802 permite que un personaje reconozca una falsificación como tal, mediante una prueba que haga o al advertirla antes de que nadie pague. El Engine no conoce ninguna de las pruebas por su nombre: las escribe el conjunto de reglas.

```json
{
  "id": "potion-of-poison",
  "label": "Potion of Poison",
  "item": {
    "category": "potion",
    "passesFor": "magic_items/potion-of-healing",
    "tells": [
      {
        "check": { "value": { "derived": "poisoners_kit_check" } },
        "dc": 13,
        "carries": { "anyOf": ["gear/poisoners-kit"] },
        "says": "a faint bitterness under the sweetness"
      },
      { "check": { "skill": "arcana" }, "dc": 18, "says": "its magic does not feel like healing magic" }
    ],
    "foolsReveal": ["identify"]
  }
}
```

```json
"items": {
  "namesItAt": 5,
  "revealsFakes": [{ "id": "identify", "label": "Identify" }, { "id": "detect-poison", "label": "Detect Poison and Disease", "items": ["magic_items/potion-of-poison"] }],
  "market": { "sellers": [
    { "id": "fence", "label": "Fence", "honest": false, "sells": [{ "tag": "magical" }],
      "manner": { "check": { "skill": "insight" }, "dc": 13, "advantageIf": [{ "value": { "derived": "knows_trade" }, "atLeast": 1 }], "says": "their eyes slide away when you ask about it" } }
  ] }
}
```

- **`tells`** en una falsificación (hasta seis): cada uno es una prueba que cualquiera puede hacer (`check` es una habilidad, un atributo o un valor de la ficha, tal como los nombra el `gate` de un uso), su dificultad `dc` y lo que se ve al superarla (`says`). `needs` indica lo que debe cumplir la ficha para poder siquiera hacerla (con `needsAny`, basta con cualquiera de ellos), y `carries`, un objeto que quien hace la prueba debe tener en su propia bolsa, como el kit con el que se hace una prueba de herramientas. Si se cumple cualquier línea de `advantageIf`, se tira con ventaja; si se cumple cualquiera de `disadvantageIf`, con desventaja.
- **`manner`** en un vendedor deshonesto: una prueba sobre el vendedor en lugar del objeto, con las mismas partes. Superarla indica que algo no está bien en lo que vende, nunca qué es.
- **Inspeccionar**: `[inventory: action="inspect" item="Potion of Healing" who="Mira"]` examina un objeto en la bolsa de Mira, y `seller="Fence"` examina una mercancía que un vendedor de aquí ofrece hoy, antes de que alguien compre. El botón **Inspect** (Inspeccionar) del inventario, que ofrece un conjunto de reglas cuyas falsificaciones pueden detectarse, dice "Examino mi Potion of Healing cuidadosamente antes de confiar en ella." para que el Game Master escriba la etiqueta. Engine tira la mejor prueba que el personaje pueda hacer al respecto, con los dados propios del conjunto de reglas: los indicios de una falsificación y la actitud de un vendedor deshonesto. Superar una prueba sobre una falsificación la vuelve sospechosa: la respuesta dice lo que se vio y la bolsa muestra "Mira cree que es una falsificación", mientras sigue llamándose como aquello por lo que se hace pasar. Superar la dificultad de un indicio por `items.namesItAt` o más (5 en 5e) también la identifica, y a partir de entonces es su objeto verdadero. Para un objeto real se tiran los indicios de las falsificaciones que se hacen pasar por él, así que preguntar no revela nada, y superar la prueba indica que parece auténtico. Cada personaje lo intenta una vez por objeto (una pila conserva quién lo ha intentado; una mercancía se recuerda durante el día de mercado); fallar indica que no puede determinarlo. Un objeto que nada podría delatar, o uno sobre el que un personaje no pueda hacer ninguna prueba, se rechaza con `nothing-to-check`, y no se gasta el intento.
- **Darse cuenta antes de comprar**: cuando una compra daría una falsificación de un vendedor deshonesto, cada uno de los demás miembros del grupo evalúa todas las pruebas que puede hacer sobre ella y el vendedor, sin dados: `items.passiveBase` (10 de forma predeterminada) más su número, 5 más con ventaja y 5 menos con desventaja. El primero que alcanza una dificultad se ha dado cuenta: no se paga nada y la compra recibe la respuesta `reason="held"`, con quién se dio cuenta de qué. Se pide al Game Master que lo interprete como ese compañero advirtiendo al comprador dentro del personaje, sin acusar al vendedor en su cara a menos que la personalidad de ese compañero lo lleve a hacerlo, y que deje decidir al comprador. No se le dice nada más al jugador. Si se vuelve a solicitar la misma compra a ese vendedor ese día, se lleva a cabo. `items.warnBy: "roll"` tira esas pruebas en su lugar.
- **Desenmascarar falsificaciones**: `items.revealsFakes` enumera los medios para desenmascarar falsificaciones que un personaje puede lanzar sobre un objeto (un conjuro, un ritual), cada uno con un `id`, su `label` y, para uno que solo detecta algunas falsificaciones, los `tags` que llevan o las propias falsificaciones por referencia (`items`, que solo pueden ser falsificaciones). Nombrar las falsificaciones evita ponerles una etiqueta que las delate: una poción de veneno etiquetada como "poison" se delataría junto a la poción de curación por la que se hace pasar. `[inventory: action="inspect" item="Potion of Healing" who="Mira" with="Identify"]` nombra uno: una falsificación que ese medio detecta queda identificada, una cuyo `foolsReveal` lo enumera se muestra como aquello por lo que se hace pasar, y una falsificación que no puede detectar, o un objeto real, no muestra nada ("auténtico" para un medio que detecta cualquier falsificación; en otro caso, "incierto"). No gasta ningún intento; el coste de lanzarlo queda a cargo del Game Master, como el de cualquier conjuro.
- Un conjunto de reglas que use cualquiera de estas opciones necesita Capability API 1.802. Se rechazan al instalar los `tells` propios de una falsificación o `foolsReveal` en un objeto que no sea una falsificación, un objeto de `carries` o de `revealsFakes` que no pertenezca al conjunto de reglas (una falsificación, para `items`), y un ID de `foolsReveal` que no esté enumerado en `revealsFakes`.

<a id="using-items-outside-a-fight"></a>

## Usar objetos fuera de un combate

El mismo `use` funciona fuera de un combate (Capability API 1.60 para `restore`; el resto no necesita nada nuevo). El botón **Use** del inventario, en uno de tus objetos con un `use`, y el `[inventory: action="use" item="Poultice" who="Juno"]` del Game Master hacen lo que hace el objeto a quien lo lleva, con los dados del motor:

- Una curación devuelve salud: la cantidad en una reserva de salud o un contador de salud ordinario, o una marca eliminada en un contador de heridas, igual que una curación en un combate. Los puntos `temporary` van a una reserva de salud, `restore` devuelve su reserva y cada estado que `applies` se aplica hasta que algo lo quite.
- Un uso que daña, o que apunta al otro bando (`kind` `attack` o `debuff`, o `targets` `enemy`), no alcanza a nadie: fuera de un combate no hay nadie en el tablero a quien golpear. El objeto se usa igualmente, y se informa al Game Master de lo que hace para que lo narre.
- Quita uno de la pila o gasta sus cargas exactamente igual que un combate, y uno al que no le queda ninguna, o uno que ocupa una ranura o se vincula y no se lleva puesto, se rechaza sin cambiar nada. La ficha y la bolsa se escriben juntas.
- Un `gate` se tira primero, igual que una prueba: los dados propios del conjunto con el número de la ficha, la penalización por heridas del usuario y lo que hacen a esa prueba sus estados y sus objetos puestos o encima. Uno fallido consume el objeto para nada, y la línea lo indica ("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

Lo que ocurrió se indica en una línea: "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." El botón Use lo envía al Game Master en un bloque `[item_used]` después de "I use my Poultice.", que el chat muestra como una insignia; la propia etiqueta del Game Master se responde con él, medida desde donde empezó el turno igual que sus otras etiquetas, así que una respuesta regenerada nunca usa un objeto dos veces. Un objeto sin `use`, o en una partida sin conjunto, se sigue indicando sin más: "I use my rope."
