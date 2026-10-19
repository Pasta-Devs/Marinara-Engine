# Escribir paquetes de criaturas

Un **paquete de criaturas** es el arte de las criaturas contra las que se lucha en Game Mode. Cuando se elige un
paquete, un enemigo para el que tiene arte se dibuja con ese arte en el tablero de batalla en lugar de con una ficha
redonda. El arte mira hacia donde se movió el enemigo por última vez y se dibuja al tamaño propio de la criatura. Un
enemigo para el que el paquete no tiene arte conserva su ficha. Consulta
[Batallas tácticas y terreno](../game/combat.md#tactical-battles-and-terrain) para ver cómo se ve durante el juego.

Un paquete es un solo archivo JSON (`.creatures.json`). La forma más fácil de crear uno es la pestaña
**Creatures** (Criaturas) de Pixelforge, que construye el archivo a partir de una imagen por criatura. Esta página
describe el archivo en sí, para quien construya paquetes de otra forma.

## El archivo

```json
{
  "creaturePackVersion": 1,
  "id": "my-monsters",
  "name": "My monsters",
  "version": 1,
  "author": "Robin",
  "tileSize": 48,
  "sheets": [{ "id": "s1", "png": "data:image/png;base64,iVBORw0KGgo...", "width": 2048, "height": 1536 }],
  "creatures": [
    {
      "id": "goblin",
      "match": ["5e-2014/creatures/goblin", "Goblin"],
      "size": "small",
      "w": 1,
      "h": 2,
      "frames": 1,
      "variants": [
        { "sheet": "s1", "x": 0, "y": 0 },
        { "sheet": "s1", "x": 1, "y": 0 }
      ]
    }
  ]
}
```

| Campo | Qué es |
| --- | --- |
| `creaturePackVersion` | Siempre `1`. |
| `id` | Letras minúsculas, dígitos, `_` y `-`. La biblioteca guarda un paquete importado como `local/<id>`. |
| `name`, `author` | Se muestran en la biblioteca. `author` es opcional. |
| `version` | Un número entero. Una versión nunca se reescribe: para cambiar un paquete, sube su versión. Volver a importar el mismo archivo no cambia nada. |
| `tileSize` | Una celda en píxeles, un múltiplo de 16 entre 16 y 96. La cuadrícula de Game Mode es de 48. |
| `sheets` | Hasta 64 imágenes, cada una de 8192 píxeles por lado como máximo. |
| `creatures` | Hasta 2000 criaturas. |

## Hojas

El `png` de una hoja debe ser una **data URL** de PNG: `data:image/png;base64,` seguido de base64 y nada
más. Se rechaza un enlace a una imagen alojada en otro sitio, y también cualquier cosa después del base64. Así, un
paquete solo puede mostrar sus propias imágenes. `width` y `height` deben ser el tamaño real del PNG; el motor los
lee de la cabecera de la imagen y rechaza un paquete cuyas hojas indiquen otra cosa.

## Una criatura

| Campo | Qué es |
| --- | --- |
| `id` | El ID de la criatura en el paquete; debe ser único. |
| `match` | Para qué es el arte, de 1 a 16 entradas. Una entrada es una criatura de un conjunto de reglas o un nombre, y los dos tipos pueden ir uno junto al otro. |
| `size` | `tiny`, `small`, `medium`, `large`, `huge` o `gargantuan`. Solo afecta a cómo se ve; cada unidad sigue ocupando una casilla. |
| `w`, `h` | El tamaño de un fotograma en celdas, de 1 a 6 cada uno. |
| `frames` | `1` para una criatura quieta, `3` para una que camina (paso, de pie, paso). |
| `variants` | Sus **aspectos**, de 1 a 8, cada uno con el lugar de la hoja donde empieza su bloque: `sheet` y la celda superior izquierda `x`, `y`. |

### Qué nombra `match`

- **Una criatura de un conjunto de reglas:** `<catalog>/<entry>` (por ejemplo `creatures/goblin`) coincide con esa
  entrada del bestiario en cualquier conjunto de reglas. `<ruleset>/<catalog>/<entry>` (por ejemplo
  `5e-2014/creatures/goblin`) solo coincide con ella en ese conjunto de reglas.
- **Un nombre:** coincide con un enemigo por su nombre. Se ignoran las mayúsculas y la puntuación, y también un
  número final, así que "Goblin 2" es un goblin.

Un combatiente del bestiario de un conjunto de reglas se busca primero por su entrada y luego por su nombre. Si dos
criaturas coinciden con lo mismo, tiene prioridad la que aparece primero en el paquete; el motor lo indica al
importar el paquete.

### Tamaños

Los fotogramas se miden en celdas, y una criatura se dibuja de pie sobre el borde inferior de su casilla, centrada,
así que una grande se extiende sobre las casillas de alrededor. Estos tamaños se ven bien en la cuadrícula de 48 píxeles:

| Criatura | Fotograma (`w` por `h`) |
| --- | --- |
| Diminuta, o una criatura pequeña o mediana de cuatro patas | 1 por 1 |
| Pequeña o mediana, erguida | 1 por 2 |
| Grande | 2 por 2, o 2 por 3 si está erguida (un ogro, un gólem) |
| Enorme | 3 por 3, o 3 por 4 si está erguida (un gigante) |
| Gargantuesca | 4 por 4 |

### El bloque: filas y fotogramas

Cada aspecto es un **bloque** en su hoja. Un bloque tiene `frames` fotogramas de ancho y 4 filas de alto, y cada
fotograma mide `w` por `h` celdas. Las filas son las orientaciones, en este orden:

1. abajo (hacia quien mira)
2. izquierda
3. derecha
4. arriba (vista de espaldas)

Una criatura quieta (`frames: 1`) es una columna con las cuatro orientaciones. Una que camina (`frames: 3`) tiene
paso, de pie y paso a lo largo de cada fila, como un personaje que camina en RPG Maker. Cada bloque debe quedar por
completo dentro de su hoja; el motor nombra cualquiera que sobrepase el borde.

### Aspectos

Una criatura con varios aspectos (otra ropa, otros colores u otras armas) le da uno a cada uno de sus combatientes.
Un combatiente conserva el mismo aspecto cada vez que se dibuja, y dos goblins de una misma pelea pueden verse
distintos. Todos los aspectos de una criatura tienen el mismo tamaño.

En la pestaña **Creatures** de Pixelforge, **Add looks** (Añadir aspectos), junto a una criatura, añade más imágenes
del mismo tamaño que la primera, hasta ocho en total.

## Usar un paquete

En la pestaña **Creatures** de Pixelforge, elige **Import a creature pack file** (Importar un archivo de paquete de criaturas),
o **Save to the library** (Guardar en la biblioteca) si lo creaste allí, y después **Use for fights** (Usar en las peleas).
Un solo paquete dibuja todas las peleas. Si quitas el paquete elegido o usas **Use tokens instead** (Usar fichas en su lugar), se vuelve a las fichas.
