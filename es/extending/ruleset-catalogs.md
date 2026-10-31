# Catálogos de conjuntos de reglas

Esta página forma parte de [Escribir conjuntos de reglas de Game Mode](writing-rulesets.md). Entradas ya preparadas que el editor de fichas ofrece en un selector: la cabecera del catálogo, las entradas, los valores que mantiene el conjunto de reglas, los comandos de ficha y el comando de uso.

Escribir una lista de conjuros, una tabla de equipo o una página de rasgos fila por fila es tedioso. Un catálogo es una colección con nombre de entradas preparadas que distribuyes con el conjunto. El editor las ofrece en un selector de cada lista que alimenta el catálogo; elegir una rellena la fila.

Los catálogos son opcionales. Puede haber hasta doce por conjunto; el motor no conoce su temática: todos los IDs, columnas, filtros y palabras proceden del archivo.

## La cabecera

La cabecera va en `catalogs`, en el nivel superior del archivo, junto a `gm`.

```json
"catalogs": [
  {
    "id": "knacks",
    "label": "Knacks",
    "feeds": ["knacks", "tricks"],
    "filters": [
      { "id": "grit", "label": "Grit cost", "type": "number" },
      { "id": "road", "label": "Road", "type": "text" },
      { "id": "callings", "label": "Calling", "type": "tags", "startFrom": { "field": "calling" } }
    ],
    "units": { "distance": { "label": "paces", "perCell": 2 } },
    "entries": []
  }
]
```

- `id` y `label`: el ID sigue las reglas de IDs de ficha; la etiqueta da nombre al selector.
- `holds`: `"rows"` (predeterminado y usado por todos los catálogos anteriores a esta versión), `"creatures"` o `"items"`. Un catálogo de criaturas es un bestiario que lee el combate, y un catálogo de objetos enumera cosas que lleva el grupo. Ninguno de los dos escribe en fichas, declara `feeds` ni aparece nunca en el selector. Consulta [Criaturas](ruleset-combat.md#creatures-a-bestiary-a-fight-reads) y [Objetos](ruleset-items.md) más abajo.
- `feeds`: de una a ocho listas de ficha donde pueden escribir las entradas. Obligatorio para filas y rechazado para criaturas u objetos. Una entrada no puede escribir en otra lista ni colocar un valor que sus columnas no admitan.
- `filters`: opcional, hasta ocho. Define cómo acotar el selector: `number`, un valor `text` o `tags` (varias palabras). `startFrom` nombra un campo con el que se abre el selector: un personaje con Calling Tinker ve primero las entradas Tinker.
- `units`: opcional. Define qué significa en el sistema un alcance o tamaño de área del bloque `mechanics`.

## Una entrada

```json
{
  "id": "road-sense",
  "label": "Road Sense",
  "summary": "You read a road the way other people read a face.",
  "filters": { "grit": 0, "road": "Ash Flats", "callings": ["Scout", "Courier"] },
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Road Sense", "notes": "Sneak to notice where a road turns bad." }
    }
  ]
}
```

- `id`: minúsculas, dígitos y guiones simples, único dentro del catálogo.
- `label` y `summary`: lo que muestra el selector. El resumen es opcional, de una línea y hasta 300 caracteres.
- `filters`: valores de los filtros de la cabecera. Un filtro `number` recibe un número; `text`, una cadena; `tags`, una lista de cadenas.
- `rows`: lo que escribe la selección, entre una y seis filas. `list` pertenece a `feeds`; las claves de `values` son los IDs de columnas de esa lista.
- `creature`: un adversario en vez de filas, para catálogos cuyo `holds` indica criaturas. Cada entrada tiene exactamente uno entre `rows` y `creature`; una criatura no lleva `mechanics`, pues define lo que hace en sus acciones.

Cada valor se valida contra las columnas de destino. Los nombres mal escritos o números fuera de rango se notifican con su entrada de origen. Las entradas incluidas en el archivo de reglas se validan al cargarlo, que para un archivo importado es durante la importación. Un catálogo separado de paquete se valida la primera vez que lo solicita el selector; si contiene un error, muestra sus motivos en vez de entradas.

## Una entrada, varias listas

Un rasgo de usos limitados ocupa dos filas: el rasgo y su contador. Sigue siendo una sola selección.

```json
{
  "id": "last-ember",
  "label": "Last Ember",
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Last Ember", "notes": "Spend 1 Grit to give a downed friend 3 Grit back." }
    },
    { "list": "tricks", "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" } }
  ]
}
```

## Valores que mantiene actualizados el conjunto

Los números de una fila pertenecen al jugador desde que la elige. Hay una excepción útil: máximos que dependen del personaje, como usos iguales a un atributo o un recurso de clase que crece por nivel. Una fila puede nombrar hasta cuatro columnas numéricas propias en un mapa `scaled`; el editor mantiene esas celdas actualizadas.

```json
{
  "list": "tricks",
  "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" },
  "scaled": { "uses": { "from": { "abilityScore": "heart" } } }
}
```

- La clave es una columna `number` de la lista.
- `from` es una referencia de valor ordinaria, con el mismo vocabulario cerrado del resto del formato. Para algo más complejo, declara un valor `derived` y apúntalo desde `from` (`"from": { "derived": "lay_on_hands_max" }`). Aquí no se añade aritmética nueva.
- `table` es opcional. Consulta el valor de la referencia en una tabla por peldaños, como cuando un nivel determina un número: `"scaled": { "max": { "from": { "field": "level" }, "table": [[1, 2], [3, 3], [6, 4]] } }`.
- `values` debe seguir incluyendo un número ordinario para la columna; omitirlo se rechaza. Es el valor antes de conocer la ficha y el que conserva una ficha sin esa referencia.
- Una fila con `scaled` debe ser la única de la entrada para esa lista; así, una fila marcada siempre coincide con una sola especificación. O bien (Capability API 1.92) cada fila que la entrada escribe en esa lista debe llevar su propio nombre en la columna de nombre de la lista (la `nameColumn` de sus reservas o, si no, su primera columna de texto). Entonces la fila de la ficha se empareja con su especificación por ese nombre, de modo que un rasgo puede dar dos usos que crecen cada uno por su cuenta; una fila que el jugador renombra se deja como está.

El valor se calcula al editar la ficha, nunca al leerla: una fila guardada siempre contiene el número que declara. Se adapta a su columna: se limita entre `min` y `max` y se redondea hacia abajo si admite enteros. En el ejemplo, Heart 3 da tres usos y Heart 0 o menor, ninguno. La fila permanece con 0 usos; un contador con máximo 0 no es una reserva, por lo que no hay nada que gastar.

Las columnas escaladas requieren Capability API 1.23 para conjuntos empaquetados. Los comunitarios importados los valida el motor que los lee, sin requisitos adicionales.

## Las filas elegidas son copias

Cada fila elegida se copia a la ficha con la clave adicional `_catalog`, que contiene `<catalog id>/<entry id>`. Los IDs de columna empiezan por letra, así que esta clave nunca puede ser una tuya.

La copia pertenece al personaje. El jugador puede editarla, la ficha sigue funcionando sin el conjunto instalado y publicar una versión nueva nunca reescribe personajes. La marca permite al selector mostrar lo que ya tiene la ficha y a la función de actualización identificarlo.

## Actualizar desde el conjunto

La marca permite al editor avisar si el texto nuevo difiere de la fila. Una línea bajo la lista indica cuántas filas tienen texto nuevo; **Review** (Revisar) muestra el contenido guardado junto al del conjunto, con una casilla por fila. Nada se escribe hasta pulsar **Update selected** (Actualizar seleccionadas); solo cambian las columnas diferentes de las filas marcadas. Todo lo demás se conserva, incluida la marca.

La comparación es deliberadamente limitada:

- Solo compara valores existentes de columnas `text`, `longtext`, `dice` y `enum`. Los valores `number` y `boolean` pertenecen al jugador y se conservan, incluidos 0 y false. Una columna aún ausente puede ofrecerse con su valor tipado, incluidos números e interruptores. Se excluyen las columnas escaladas, porque ya siguen la ficha.
- Solo compara columnas definidas por la entrada. Las omitidas no se tocan, contengan lo que contengan.
- Se omiten valores que la propia columna rechazaría, como un `enum` retirado o texto superior a `maxLength`.
- La fila se relaciona con su fila de origen por posición entre las que comparten marca en esa lista, mientras la ficha conserve tantas como escribe la entrada. Si no, solo funciona si la entrada escribe una sola fila en esa lista. Si el jugador borra una de dos filas, se deja la entrada intacta en vez de adivinar.
- Si el catálogo ya no tiene la entrada, la fila se deja intacta sin avisos.

Así, reformular o renombrar puede llegar a personajes que ya eligieron la entrada, si lo aceptan. Cambiar el significado de un número no llega ni llegará: la columna pertenece al jugador desde que la fila es suya.

## Comandos de ficha: avance permanente

Un conjunto puede permitir cambios en la creación permanente del personaje con `sheet.advancement`:

```json
"advancement": {
  "fields": ["xp", "level", "humanity", "discipline"],
  "abilities": true,
  "skills": true,
  "saves": true,
  "text": "Award XP at the end of a session; change other values only when earned."
}
```

Incluye solo IDs de campos que tu ficha declare como número o texto (`text` o `longtext`), como máximo 24. Los booleanos permiten, respectivamente, todos los atributos, habilidades o salvaciones; omitidos o falsos significan que no hay permiso. Al importar se rechazan un conjunto de permisos vacío, un campo desconocido, un tipo de campo no admitido o una clave desconocida. `text` es una guía opcional de como máximo 400 caracteres aptos para prompts. Sin `advancement`, los comandos existentes se comportan como antes y se rechaza toda solicitud `advance`.

```
[sheet: op="advance" field="xp" by="250" who="party"]
[sheet: op="advance" field="xp" to="1200"]
[sheet: op="advance" field="humanity" by="-1"]
[sheet: op="advance" field="discipline" to="Auspex"]
[sheet: op="advance" ability="str" by="1"]
[sheet: op="advance" ability="str" to="16"]
[sheet: op="advance" skill="stealth" tier="expert"]
[sheet: op="advance" save="will" tier="trained"]
```

Nombra exactamente un objetivo. Los campos y los atributos aceptan exactamente uno de `by` o `to`; el texto solo acepta `to`. Los nombres y los niveles coinciden con IDs o etiquetas, sin distinguir mayúsculas de minúsculas. Las habilidades y las salvaciones aceptan cualquier nivel declarado en `resolution.proficiencyTiers`. Los campos numéricos respetan `integer`, `min` y `max`; los atributos respetan sus límites enteros; el texto respeta `maxLength`. Un valor no válido se rechaza con un motivo `bad-amount` que indica el límite, y nunca se ajusta en silencio. También se rechazan el avance desactivado, los objetivos no permitidos, los nombres desconocidos y los niveles desconocidos. La etiqueta reescrita lleva `result` y el nuevo valor en `now`. Omite `who` para el jugador, o usa `who="party"` para todas las tarjetas del grupo que no sean ambiguas; los rechazos parciales nombran las tarjetas que no pudieron avanzar.

El motor guarda la creación en la tarjeta de la partida mediante el mismo almacenamiento de metadatos que una edición del jugador, conservando su versión de ficha y recalculando los valores derivados a partir de la nueva creación. Las tarjetas de la biblioteca no cambian. Igual que con los comandos vivos, un swipe alternativo o una respuesta regenerada parten de antes de los cambios de la respuesta saliente. Cada respuesta registra la creación con la que termina, incluidas las respuestas sin avance. Seleccionar un swipe restaura su instantánea; eliminar la última respuesta deja a la vista la instantánea anterior. Eliminar una respuesta más antigua deja vigente una instantánea posterior hasta que se elimina esa respuesta posterior. Una continuación actualiza la instantánea de la misma respuesta. Deshacer solo cambia los valores que aún coinciden con el resultado registrado, así que las ediciones posteriores del jugador se conservan y las ediciones no relacionadas no impiden deshacer una concesión de XP.

<a id="the-use-command-letting-the-game-master-spend-a-price-you-wrote"></a>

## El comando `use`: permitir al Game Master pagar el coste que escribiste

Mientras narra, el GM actualiza fichas con comandos `[sheet: ...]`: `spend`, `restore` (`heal` significa lo mismo), `damage`, `temp`, `track`, `condition`, `note` y `rest`. Los conjuntos con catálogos reciben otro:

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"` equivale a `op="use"` y `spell=` a `name=`; así funciona la expresión que elige el GM sin que el formato deba conocer la palabra "spell".

El nombre se compara sin distinguir mayúsculas con las filas del personaje procedentes de tus catálogos. La fila responde al nombre mostrado al GM (columna de nombre de `sheetSummary`, después `pools.nameColumn` y después la primera columna de texto) y al `label` de su entrada de origen. Así, renombrar una fila no hace perder su acceso. Se rechazan tanto nombres sin coincidencia como nombres compartidos por dos entradas distintas.

Lo que gasta:

- Cada término de `mechanics.cost`. Si nombra una reserva viva, paga de ella. Si nombra un GRUPO, paga de la primera reserva del grupo que pueda costearlo, por orden de declaración. No sube automáticamente a otra reserva superior, porque un grupo no siempre es una escala.
- Además, uno de cada reserva de fila escrita por la misma entrada, como el contador de usos de un rasgo: la segunda fila de `Last Ember`. Un contador con máximo 0 no tiene usos; se rechaza el comando en vez de ejecutarlo gratis.

`pool=` es el lanzamiento a nivel superior: el mismo precio único, pagado desde otra reserva del grupo. Solo se acepta si el coste tiene un único término y la reserva nombrada comparte su grupo o paga por él. Lo demás se rechaza sin reinterpretarlo.

**Una reserva que paga por otro grupo** (Capability API 1.171). El `pays` de una reserva viva nombra hasta otros cuatro grupos cuyos costes también puede pagar, a su propio nivel (su `level`, o su posición en su propio grupo), y nunca un coste de nivel superior al suyo. Los espacios de pacto de 5e pagan conjuros cuyo coste se expresa en espacios de conjuro, como puede hacer un brujo multiclase:

```json
{
  "id": "pact_slots",
  "label": "Pact Slots",
  "group": "pact",
  "max": { "field": "pact_slot_count" },
  "level": { "field": "pact_slot_level" },
  "pays": ["slots"]
}
```

Un combate ofrece una reserva así junto a las reservas superiores del propio grupo del conjuro, y un pago con ella hace crecer el conjuro tantos pasos como su nivel supere al del conjuro: un espacio de pacto de nivel 3 paga Magic Missile como lo haría un espacio de nivel 3. Un uso cuya propia reserva está vacía se sigue ofreciendo, pagado solo con una reserva superior o con una que pague por ella, así que un conjuro de nivel 1 se lanza con un espacio de nivel 2 cuando se acaban los espacios de nivel 1. `targetsPerCostStep` (1.171, de 1 a 10) en las `mechanics` de una entrada añade esa cantidad de objetivos por cada paso que se paga por encima, hasta 20 como máximo: Hold Person es `"targetCount": 1, "targetsPerCostStep": 1`.

Es todo o nada. Si no puede pagarse alguna parte, se rechaza el comando entero, no cambia nada y se avisa al jugador. Una entrada sin coste, como un truco o rasgo pasivo, se acepta sin cambiar nada.

## Incluido en el archivo o en uno propio

Un catálogo pequeño se incluye en `ruleset.json`, dentro de `entries` de la cabecera. Uno largo vive en su propio archivo y la cabecera lo nombra con `asset`. Cada catálogo tiene exactamente una de esas opciones.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

La ruta siempre es `catalogs/<the catalog's id>.json`. El archivo tiene esta forma:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Los archivos de catálogo separados van en un paquete: uno publicado mediante el catálogo oficial o un archivo de paquete de conjunto de reglas que importas tú (consulta [Compartir tu conjunto de reglas](writing-rulesets.md#sharing-your-ruleset)). El paquete los incluye en `contributions.assets.paths` junto a `ruleset.json` y necesita Capability API 1.21. Un catálogo de criaturas, incluido o separado, necesita Capability API 1.27, y uno de objetos, 1.49. **Un conjunto importado como archivo único o compartido mediante GitHub incluye sus catálogos dentro del archivo**, de modo que deben caber en el límite total de 512 KB. Eso permite unos cientos de entradas breves.

Los límites son doce catálogos por conjunto, 2000 entradas por catálogo en ambas formas y 2 MB por archivo de catálogo. Un paquete cuyo `ruleset.json` supere los 256 KB, o con un archivo de catálogo de más de 1 MB, necesita Capability API 1.340, que subió ambos límites.
