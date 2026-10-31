# Capas, traducciones y migraciones de conjuntos de reglas

Esta página forma parte de [Escribir conjuntos de reglas de Game Mode](writing-rulesets.md). Variantes que un jugador activa para una partida, traducciones del texto de un conjunto de reglas y traslado de valores a nuevos IDs cuando cambia una ficha.

## Capas: variantes de tu propio conjunto de reglas

Una capa es una variante con nombre de tu conjunto de reglas que el jugador activa al crear una partida: magia escasa, invierno duro, una dificultad más cruda. Las capas residen en el archivo del conjunto de reglas, en una matriz opcional `layers`, por lo que viajan con él y nunca pueden faltar en una partida que las haya usado. El asistente las muestra como interruptores debajo de tu conjunto de reglas, y la elección queda fijada para toda la vida de esa partida, igual que el propio conjunto.

```json
"layers": [
  {
    "id": "hard_winter",
    "label": "Hard winter",
    "summary": "Cold, hunger and short days. Everything is harder.",
    "conflicts": ["mud_season"],
    "gm": {
      "guidance": "Hard winter is on. Let a failed check cost warmth, food or daylight as well as progress.",
      "worldGuidance": "Hard winter is on. Build a world of closed roads, thin stores and rationed settlements."
    },
    "fields": [{ "id": "calling", "removeValues": ["Sailor"], "default": "Hauler" }],
    "difficultyLadder": [{ "label": "Easy", "dc": 7 }],
    "catalogs": [{ "id": "knacks", "hide": { "filter": "grit", "above": 0 } }]
  },
  {
    "id": "mud_season",
    "label": "Mud season",
    "summary": "Thaw, flooded roads and slow going."
  }
]
```

**Qué puede hacer una capa.** La lista es cerrada, y cada efecto restringe algo o añade texto:

- `gm.guidance` se añade al final de tu `gm.checkGuidance`, después de tu propio texto y del de cualquier capa anterior. `gm.worldGuidance` se añade al final de `gm.worldGuidance` del mismo modo.
- `fields` retira valores de un campo **enumerado**. `removeValues` identifica valores que el campo ya contiene, debe sobrevivir al menos uno y, si el `default` del campo es uno de los retirados, la capa indica otro `default` que sobreviva.
- `difficultyLadder` sustituye tu escala por otra con la estructura de tu propio tipo de resolución: `{label, dc}` para `dice-sum` y `{label, successes, target?}` para `dice-pool`. Se somete exactamente a las mismas validaciones que tu propia escala. Cuando varias capas activas declaran una, gana la última.
- `catalogs` oculta entradas del selector del editor de fichas. Cada regla identifica uno de los `filters` declarados por ese catálogo y exactamente una comparación: `above` o `below` para un filtro `number`, `equals` o `notIn` para uno `text` o `tags`. Nunca se oculta una entrada que no establezca ese filtro.
- `currencies` retira monedas: `removeUnits` nombra monedas sueltas y `removeFamilies`, familias enteras. La moneda más pequeña de una familia solo se va con su familia, para que cada familia que queda pueda seguir pagando y dando cambio. Mientras la capa está activa, nadie gana, paga con, elige ni suelta una moneda retirada, y la línea del monedero la omite. Un precio expresado en ella se indica en la moneda más grande que queda y que lo paga exactamente, con el mismo valor: la larga noche de Gravewatch retira la crown, así que una pistola de guardia de 3 crowns cuesta 15 shillings. Un objeto cuya familia entera ha desaparecido no tiene precio.
- `items` cambia dónde se venden las cosas y qué se suelta, nunca lo que existe. `market.removeSellers` retira vendedores de tu mercado (siempre queda al menos uno: un mercado sin vendedores permite que cualquiera venda todo, así que no se aplica una retirada que lo dejaría vacío, ni siquiera por dos capas juntas). `market.unsold` retira mercancías de todos los vendedores, con filtros como los del propio mercado (se añade al `unsold` del mercado). `lootTables` sustituye tablas de botín que ya tienes, por ID, por tablas con la misma estructura, así que cada criatura, nivel de amenaza y `stock` de vendedor que nombra una tira la sustituta; cuando varias capas activas sustituyen una tabla, gana la última. Un objeto que no se vende sigue siendo un objeto: se puede llevar, usar y encontrar en el botín, el Game Master puede repartirlo, y la tabla de `stock` de un vendedor aún puede sacarlo.

```json
"items": {
  "market": { "removeSellers": ["magic_dealer", "scribe"], "unsold": [{ "tag": "magical" }] },
  "lootTables": [{ "id": "treasure_low", "label": "Pocket treasure", "entries": [{ "coins": "sp", "weight": 1, "count": "4d6" }] }]
}
```

**Qué no puede hacer una capa.** No puede añadir un valor enumerado, un campo, una habilidad, una reserva o un descanso, añadir un vendedor o una tabla de botín, cambiar el tipo de resolución, tocar el estado en vivo o los números de combate ni añadir una llamada a un modelo. Un valor que una capa _añadiera_ sería desconocido para todos los demás lectores de la ficha, así que los valores solo se retiran. Todo lo que quede fuera de esta lista es un cambio del propio conjunto de reglas o un segundo conjunto.

**Conflictos.** `conflicts` identifica capas que no pueden estar activas juntas. Basta con indicar un lado del par. El asistente desactiva el otro interruptor y, si una elección guardada contiene ambos de algún modo, se descarta la capa declarada **después**, para que las mismas dos elecciones siempre produzcan las mismas reglas.

**Una ficha que ya contenga un valor retirado lo conserva.** Nada reescribe al personaje. El editor simplemente deja de ofrecer el valor, y un personaje que ya lo tenía lo muestra tal como es. Desactiva la capa en una nueva partida y el valor volverá a ofrecerse. Lo mismo ocurre con una entrada de catálogo oculta: queda fuera del selector y una fila que el jugador ya eligió permanece en la ficha. Las monedas que retira una capa y que alguien ya lleva se quedan en su bolsa.

**Límites.** 12 capas por conjunto de reglas y 4000 caracteres de instrucciones por capa, contando ambas cadenas juntas. Un conjunto de reglas empaquetado que declare `layers` o un `gm.worldGuidance` base necesita Capability API 1.25, uno cuyas capas retiran monedas necesita 1.64, y uno cuyas capas cambian su `items` necesita 1.813. Uno que importes lo valida Engine al leerlo, así que no necesita nada.

**Las capas escritas por otra persona** (una capa de magia escasa para un conjunto de reglas que no escribiste, distribuida en su propio archivo) llegarán más adelante. Actualmente, una capa se distribuye dentro del conjunto de reglas al que pertenece.

## Traducciones

**Traducciones** (Capability API 1.811). Las cadenas de texto que muestra un conjunto de reglas en otro idioma se agrupan en una traducción por idioma, nombrada con el código del idioma como los paquetes de idioma del propio Engine (`ru`, `pt-BR`, `zh-Hans`). En el catálogo oficial de agentes, cada una es un paquete de idioma junto al archivo del conjunto de reglas (más abajo). Un archivo de paquete de conjunto de reglas que compartas puede, en cambio, llevarlas dentro, un archivo por idioma junto a `ruleset.json`: `locales/<language>.json`, enumerado en el manifiesto como los demás archivos. En ambos casos, cada una es un catálogo de localización de paquete con una sección `ruleset`: cada clave es una cadena de texto que muestra el conjunto de reglas o sus catálogos, palabra por palabra en inglés, y su valor es esa cadena en el idioma del archivo.

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

`_meta.locale` debe ser el idioma que da nombre al archivo, y el archivo contiene `$schema`, `_meta`, `package` y `ruleset` y nada más, con todos los valores de texto. Una cadena que se deja vacía aún no está traducida y se muestra en inglés; un archivo sin sección `ruleset` (la información en inglés del propio paquete, `locales/en.json`) no traduce nada. Las traducciones solo afectan a lo que se muestra: las reglas, los comandos de la ficha y todo lo que se comunica al Game Master siguen leyendo el inglés. La pantalla de una pelea (nombres, estados, acciones, conjuros, el registro y el orden de turnos) muestra cada cadena en el idioma del jugador cuando la traducción del conjunto de reglas la incluye, primero el archivo del propio idioma y luego el del idioma del que es una variante (`pt` para `pt-BR`), y en inglés en los demás casos; "Goblin 2" lee la traducción de "Goblin" con su número. Un archivo de paquete con traducciones necesita Capability API 1.811. Al importarlo, solo se conserva la traducción en el idioma en el que está configurado Engine (o en el idioma del que es una variante) y se descartan las demás; para leer el conjunto de reglas en otro idioma, cambia el idioma de Engine e importa de nuevo el archivo, lo que sustituye la traducción conservada. Las traducciones no forman parte de la versión, así que importar de nuevo la misma versión con una traducción corregida también la sustituye, y un archivo de esa versión sin traducciones deja lo que se había conservado.

Un conjunto de reglas del catálogo nunca lleva `locales/<language>.json` dentro de su archivo (si lo hace, se rechaza antes de descargarlo). Sus traducciones son paquetes de idioma (Capability API 1.811): un archivo JSON por idioma, `<id>-<version>.<language>.json`, publicado junto a `<id>-<version>.ruleset.json` y que contiene exactamente lo mismo que un `locales/<language>.json` (`_meta.locale` con el idioma que le da nombre y una sección `ruleset`). La entrada del catálogo los enumera junto a su `artifact`:

```json
"locales": {
  "ru": {
    "url": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/ember-roads-1.0.0.ru.json",
    "sha256": "<64 hex>",
    "bytes": 812345,
    "name": "Угольные дороги",
    "description": "<the store card's description in Russian>"
  }
}
```

Cada paquete es una URL https con la misma forma que la del artefacto, nombrada según su versión e idioma, con su sha256 y su tamaño (como máximo 8 MB); un conjunto de reglas enumera como máximo 40, nunca `en` (el inglés es el propio conjunto de reglas), y su manifiesto declara Capability API 1.811. `name` y `description` son los de la tarjeta de la tienda en ese idioma, así que la tarjeta se lee en el idioma de Engine sin descargar el paquete. Una instalación descarga el archivo del conjunto de reglas y luego solo el paquete en el idioma en el que está configurado Engine (o en el idioma del que es una variante), comprueba su tamaño, suma de comprobación e idioma y lo conserva con la versión instalada. Cuando cambia el idioma de Engine (y cada vez que se abre una página en él), cada conjunto de reglas del catálogo instalado que enumere un paquete en el nuevo idioma lo descarga y se elimina el paquete del idioma anterior. Un paquete que no se puede obtener (sin conexión, ninguno enumerado o distinto del archivo que enumera el catálogo) deja el conjunto de reglas en inglés; la siguiente instalación o cambio de idioma vuelve a intentarlo. Una actualización conserva la versión anterior para poder volver a ella, sin su paquete: después de volver a una versión anterior, el siguiente cambio de idioma descarga de nuevo el paquete de esa versión, si el catálogo aún lo enumera.

## Mover valores a nuevos IDs: `sheet.migrations`

Añadir cosas no necesita nada más. Cuando una nueva estructura mueve un valor a otro sitio (un campo renombrado, un único nivel que se convierte en un nivel por clase, una única reserva de dados de golpe que se convierte en una por dado), indica cómo en `sheet.migrations` (Capability API 1.77), para que cada personaje creado con la estructura antigua conserve sus números: en la biblioteca, en las partidas, en las partidas guardadas antiguas, las ramas y los puntos de control, y en las tarjetas importadas.

```json
"migrations": [
  {
    "from": 3,
    "steps": [
      { "rename": "field", "from": "xp", "to": "experience" },
      {
        "route": "level",
        "by": "class",
        "cases": [
          { "words": ["fighter"], "to": "level_fighter" },
          { "words": ["wizard"], "to": "level_wizard" }
        ],
        "else": "level_other",
        "default": 1
      },
      {
        "routeLive": "pool",
        "from": "hit_dice",
        "cases": ["hit_dice_d6", "hit_dice_d8", "hit_dice_d10", "hit_dice_d12"],
        "else": "hit_dice_d8"
      }
    ]
  }
]
```

- Cada entrada mueve una ficha guardada de la versión `from` a `from + 1`, y se ejecuta, en orden, para cada ficha guardada en esa versión o en una anterior. No elimines nunca ninguna después de publicarla: una ficha guardada hace mucho la sigue necesitando. Una versión que solo añade no necesita ninguna.
- `rename` (un `ability`, `skill`, `save` o `field`): el valor se copia a su nuevo ID. Una habilidad o salvación se lleva su bonificación. Un renombrado puede continuar uno de una entrada anterior, o alimentar un campo que un `route` posterior envía a otro sitio; la importación sigue la cadena hasta donde termina.
- `route`: el valor de un campo va al campo que nombra el texto de otro campo. Un caso gana cuando sus palabras aparecen en el texto de `by` como palabras completas (solo las letras forman una palabra, así que "Fighter3" nombra a un guerrero), sin distinguir mayúsculas de minúsculas, y gana exactamente un caso. Si no gana ninguno, o varios ("Fighter 3 / Wizard 2", entre los que no se puede repartir un único número sin preguntar), va a `else`. `default` sustituye al valor en una ficha que nunca lo guardó. `by` es un campo que tiene la ficha, o uno que una estructura anterior renombró. Los destinos son campos numéricos o de texto sin valor predeterminado, o con un valor predeterminado de 0 o vacío: el valor llega a uno de ellos y todos los demás conservan su valor predeterminado, así que cualquier otro valor predeterminado se leería como un nivel que nadie dio. Se sigue hasta su nuevo sitio un destino que un renombrado posterior mueve.
- `routeLive` (un `pool` o `track` del estado vivo): el valor guardado va al de los `cases` que muestre la ficha migrada (una reserva con un máximo mayor que 0, un contador que la ficha no oculte) o, si no, a `else`. Los contadores a los que va un valor son todos contadores de heridas (lleva las marcas) o todos simples (lleva el número).
- `setColumn` (Capability API 1.794): `{ "setColumn": { "list": "attacks", "where": { "name": ["Dagger", "Rapier"], "ability": ["str", "dex"] }, "column": "ability", "to": "finesse" } }` establece una columna en cada fila de una lista cuyas columnas de `where` contengan, cada una, uno de los valores enumerados (el texto coincide sin distinguir mayúsculas de minúsculas ni espacios en sus extremos; un número coincide exactamente). Úsalo para corregir filas creadas antes de que tu conjunto de reglas contemplara ese caso, como filas de ataque creadas antes de que existiera la elección de atributo de un arma. La lista y cada columna que nombra deben estar en la ficha.
- Todos los demás pasos de creación copian: el valor antiguo se queda donde estaba, así que una versión anterior de tu conjunto sigue leyendo la ficha como antes, y el paso nunca sobrescribe un valor que ya esté en su destino. `setColumn` es el único paso que sobrescribe.
- La importación rechaza una entrada igual o superior a `sheet.version`, dos entradas de la misma versión, un paso que escribe en un ID que la ficha no tiene, un caso que aparece dos veces, y un `rename` o `routeLive` que lee de un ID que la ficha todavía tiene (un ID del que se ha movido el valor nunca se vuelve a usar, que es lo que hace que esos pasos se puedan volver a ejecutar sin riesgo).
- Las fichas se migran siempre que se leen, y la nueva estructura se guarda en la siguiente edición. El estado vivo no tiene versión propia, así que `routeLive` se ejecuta en cada lectura: la clave antigua se descarta y su valor solo se mueve mientras la clave nueva no exista todavía, de modo que nunca se sobrescribe un valor que se haya gastado o recuperado descansando desde entonces. Adónde fue lo decide la primera escritura después de la actualización: una ficha corregida más tarde (un nivel de clase movido a mano) no lo vuelve a mover. Un combate que ya estaba en curso cuando llega la nueva versión termina igualmente, como antes.
