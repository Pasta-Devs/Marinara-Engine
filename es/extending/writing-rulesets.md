# Escribir conjuntos de reglas de Game Mode

Un conjunto de reglas explica a Game Mode cómo funciona un sistema de mesa: qué dados tira una prueba, qué contiene la ficha de personaje, qué recursos se gastan y qué recupera un descanso. Escribe uno para llevar tu propio sistema a Game Mode y compartirlo. Para jugar con un conjunto de reglas creado por otra persona, consulta [Jugar con un conjunto de reglas](../game/rulesets.md).

Un conjunto de reglas es un archivo JSON. Son datos, no código, así que nada de lo que contiene se ejecuta e importarlo no puede dañar tu computadora. Lee el texto del Game Master antes de importar un archivo ajeno, porque ese texto se envía al modelo en todas las partidas que usan el conjunto de reglas.

## Empezar un conjunto de reglas

1. Copia el archivo de ejemplo que coincida con la forma de tirar de tu sistema:
   - [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) es un sistema pequeño de 2d6 con tres atributos. Demuestra que nada en el formato presupone un d20 ni seis atributos.
   - [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) es una reserva pequeña de dados de diez caras con tres puntuaciones y seis oficios.
   - El [paquete oficial de 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014), un ejemplo de tamaño completo. Su archivo `ruleset.json` y su carpeta `catalogs/` son lo que instala Agent Organizer.
2. Cambia `id` por el tuyo. Un ID se compone de minúsculas, dígitos y guiones simples, como `ember-roads`.
3. Abre tu copia en un editor de texto como Notepad o VS Code, y guárdala con la terminación `.json`. Cambia primero `name`, después los nombres de los atributos en `sheet` y luego `rests` y el texto de `gm`. [Partes del archivo](#parts-of-the-file) enumera cada clave, y [Páginas de referencia](#reference-pages) enlaza las páginas que las explican.
4. Impórtalo (consulta [Probar tu conjunto de reglas](#try-your-ruleset)). La importación comprueba todo el archivo e indica los errores, línea por línea, antes de guardar nada.
5. Crea una partida nueva (consulta [Game Mode: primeros pasos](../game/getting-started.md)), elige tu conjunto de reglas en **Rules** (Reglas) y juega unas cuantas pruebas.

Si no funcionó, consulta [Solución de problemas](#troubleshooting).

Para recibir ayuda en tu editor mientras escribes, añade esto como primera línea dentro de las llaves exteriores del archivo. Hace que el editor use el JSON Schema:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

El esquema detecta claves mal escritas y tipos incorrectos. No puede comprobar que los nombres apunten a elementos existentes, como una habilidad que nombra un atributo. Eso lo hace la importación. Puedes añadir una línea `"$comment": "..."` a cualquier objeto para dejarte una nota. El motor la ignora.

## Qué puede y qué no puede hacer un conjunto de reglas

Un conjunto de reglas rellena los huecos de una mecánica que el motor ya conoce. El motor conoce cinco formas de resolver una prueba, y tu archivo elige una con `resolution.kind`:

- **`dice-sum`**: tira dados, suma números de la ficha e iguala o supera una dificultad. Abarca sistemas d20, sistemas de 2d6 más atributo y muchos otros.
- **`dice-pool`**: tira la cantidad de dados del personaje y cuenta los que alcanzan un objetivo. Abarca sistemas donde una puntuación representa un puñado de dados en vez de una bonificación.
- **`dice-highest`**: tira una reserva y lee su dado más alto, o suma los pocos más altos. Abarca Blades in the Dark y Trophy Dark.
- **`roll-against`**: saca un resultado igual o inferior (o superior) al número de la ficha. Abarca las habilidades porcentuales y las pruebas de GURPS.
- **`symbol-pool`**: forma y mejora dados narrativos y después cancela los símbolos opuestos. Abarca las pruebas de Genesys y, desde Capability API 1.382, sus combates.

Los cinco se describen por completo en [Tipos de resolución](ruleset-checks.md#resolution-kinds).

Una mecánica que no encaje en estas formas, como las reservas enfrentadas, no se puede escribir en un archivo de conjunto de reglas. Necesita un nuevo tipo de resolución dentro del motor, que es una contribución de código con pruebas. Si tu sistema lo necesita, abre una solicitud de función en el repositorio del motor y describe la mecánica con varias tiradas resueltas. Esas tiradas se convierten en las pruebas.

Game Mode resuelve una pelea con el combate propio de Marinara o con las reglas de tu conjunto. Un bloque opcional `battle` presta al combate de Marinara las cifras de tus fichas de personaje: consulta [Batallas](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat). Un bloque opcional `combat` define cómo resuelve el propio conjunto la pelea: consulta [Combate](ruleset-combat.md#combat-a-fight-your-own-rules-resolve). La Combat Preference (Preferencia de combate) de la partida elige la presentación Classic o, si el conjunto de reglas define distancia, un campo de batalla Tactical. Un conjunto de reglas puede limitar cuáles de estos estilos usan sus partidas con `combat.styles` (consulta [Qué estilos puede usar una partida](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)).

<a id="parts-of-the-file"></a>

## Partes del archivo

| Clave | Qué contiene |
| --- | --- |
| `schemaVersion` | Siempre `1`. |
| `id`, `version` | El nombre de tu conjunto de reglas para el motor y un número entero que aumentas cada vez que publicas un cambio. |
| `name` | Lo que ven los jugadores en el asistente de configuración. |
| `edition` | Opcional. Una línea sobre qué edición o borrador es. |
| `license` | Opcional. Un ID SPDX y el texto de atribución que exige tu fuente. |
| `coverage` | Lo que cubre el conjunto de reglas, más el resumen de una línea que se muestra en el asistente de configuración. |
| `resolution` | Cómo se tira una prueba o una salvación. |
| `sheet` | Todo lo que hay en la ficha de personaje. |
| `rests` | Lo que restaura y elimina cada tipo de descanso. |
| `gm` | El texto que recibe el modelo del Game Master y los valores de la ficha que ve de cada personaje. |
| `catalogs` | Opcional. Entradas ya preparadas que ofrece el editor de fichas, para que los jugadores no escriban listas largas a mano. |
| `items` | Opcional. Las palabras con las que se escriben tus objetos: categorías, rarezas, estadísticas, ranuras y dinero. |
| `battle` | Opcional. Qué puede leer una batalla de la ficha y qué escribe en ella después. |
| `combat` | Opcional. Cómo resuelven tus propias reglas una pelea y qué ejecuta luego la pantalla de batalla. |
| `layers` | Opcional. Variantes de tu conjunto de reglas que un jugador activa al crear una partida. |

El archivo puede ocupar hasta 512 KB (256 KB antes de Capability API 1.340). El texto que llega a un prompt (nombres, etiquetas, texto del Game Master) no puede contener saltos de línea, corchetes ni llaves dobles.

Los IDs de la ficha (atributos, habilidades, campos, reservas, etc.) usan minúsculas, dígitos y guiones bajos, y empiezan por letra, como `grit_max`.

<a id="reference-pages"></a>

## Páginas de referencia

Esta página explica cómo empezar, probar y compartir un conjunto de reglas. Cada una de las demás páginas trata un tema:

- [Pruebas de conjuntos de reglas](ruleset-checks.md): los cinco tipos de resolución, las franjas de resultado, las pruebas que tiran a su manera y el gasto o los amuletos que cambian una tirada.
- [Fichas de conjuntos de reglas](ruleset-sheets.md): atributos, habilidades, campos y listas, estados vivos, contadores de heridas, penalizaciones, descansos, el texto del Game Master, la ficha del grupo y los relojes de progreso.
- [Catálogos de conjuntos de reglas](ruleset-catalogs.md): entradas ya preparadas que el editor de fichas ofrece en un selector.
- [Mecánicas de las entradas de conjuntos de reglas](ruleset-mechanics.md): el bloque `mechanics` de una entrada de catálogo, que leen las pruebas, los descansos y las peleas.
- [Creador de personajes de conjuntos de reglas](ruleset-character-builder.md): crear un personaje por pasos, desde la raza y la clase hasta las puntuaciones, las competencias, los conjuros y el equipo.
- [Objetos de conjuntos de reglas](ruleset-items.md): categorías, armas, armaduras, munición, botín, dinero, equipo inicial y mercados.
- [Combate de conjuntos de reglas](ruleset-combat.md): el bloque `battle` y el bloque `combat`, con el bestiario, el tablero, las reacciones y los enfrentamientos.
- [Capas, traducciones y migraciones de conjuntos de reglas](ruleset-layers-and-translations.md): variantes que un jugador activa para una partida, traducciones y traslado de valores a nuevos IDs cuando cambia una ficha.

<a id="try-your-ruleset"></a>

## Probar tu conjunto de reglas

Antes de empezar, activa **Allow custom Agent imports** (Permitir importaciones de agentes personalizados) en **Settings → Advanced → Danger Zone** (Configuración → Avanzado → Zona de peligro). Los conjuntos de reglas importados usan el mismo interruptor de seguridad que los agentes importados, así que está desactivado hasta que lo actives. La importación también necesita acceso desde localhost o el secreto de administrador (**Settings → Advanced → Admin Access**, Configuración → Avanzado → Acceso de administrador).

1. Abre el panel **Agents** (Agentes) y elige el botón **Import agents** (Importar agentes), el icono de descarga de la fila de botones de la parte superior del panel.
2. Elige **Game Mode ruleset** (Conjunto de reglas de Game Mode) y selecciona tu archivo JSON, o un archivo de paquete de conjunto de reglas que termine en `.ruleset.json` (consulta [Compartir tu conjunto de reglas](#sharing-your-ruleset)).
3. Lee la revisión. Muestra el nombre, la versión, la licencia, lo que cubre el conjunto de reglas y el texto del Game Master. Elige **Import** (Importar).

Tu conjunto de reglas aparece en la sección **Rules** del panel y en la opción **Rules** del asistente de configuración para partidas nuevas. Un conjunto de reglas importado desde un archivo se clasifica como `local/<your id>`, así que nunca se confunde con uno oficial ni con el de otra persona.

### Cambiar un conjunto de reglas que ya importaste

Una versión importada nunca se reescribe. Si importas un archivo modificado con la misma `version`, la importación se rechaza y te pide aumentar el número. Una partida está ligada a la versión exacta con la que se creó, así que una campaña en curso nunca cambia sus cálculos.

Mientras redactas, el ciclo es: editar, aumentar `version`, importar, iniciar una partida nueva. Las versiones antiguas permanecen instaladas junto a la nueva hasta que retires el conjunto de reglas de la sección **Rules**. Retirar un conjunto de reglas que todavía usa una partida hace que esa partida indique que falta su conjunto de reglas hasta que vuelvas a importarlo.

Si cambias la estructura de la ficha (añades, retiras o renombras elementos), aumenta también `sheet.version`. Las fichas existentes se leen con tolerancia: se conservan los valores que la nueva ficha no conoce y los que faltan toman sus valores predeterminados.

<a id="sharing-your-ruleset"></a>

## Compartir tu conjunto de reglas

Hay cinco formas de compartirlo.

### Como archivo

Envía el archivo JSON a un amigo. Lo importa igual que tú.

### Como archivo de paquete

Un conjunto de reglas demasiado grande para un solo archivo, con catálogos en sus propios archivos, viaja como un único archivo JSON simple llamado `<name>.ruleset.json`. Contiene el manifiesto del paquete y los documentos del conjunto de reglas, cada uno guardado en base64 (una forma de escribir un archivo como texto simple):

```json
{
  "format": "marinara-ruleset",
  "version": 1,
  "manifest": { "kind": ["ruleset"], "…": "the package manifest" },
  "files": {
    "ruleset.json": "<base64>",
    "catalogs/spells.json": "<base64>"
  }
}
```

El manifiesto enumera `ruleset.json` y cada `catalogs/<id>.json` en `contributions.assets.paths` y en `files`, con el tamaño y el sha256 (una huella del archivo) de cada uno. Un editor de conjuntos de reglas como Pixelforge crea uno. **Import agents** → **Game Mode ruleset** toma el archivo y muestra la misma revisión que para un archivo de conjunto de reglas, con cada catálogo y su número de entradas.

El archivo se lee como datos y nunca se instala como paquete. No hay nada comprimido, así que nunca contiene más que su propio tamaño. Límites:

- Se clasifica como `local/<its id>`, igual que un archivo de conjunto de reglas.
- Ocupa como máximo 132 MB, con un máximo de 12 archivos de catálogo de 2 MB cada uno y 40 traducciones de 8 MB cada una (consulta más abajo).
- Una versión es su conjunto de reglas y sus catálogos juntos, así que un catálogo modificado también necesita una `version` más alta.
- No se aceptan paquetes de conjuntos de reglas en zip.

Se rechaza, indicando el motivo, si:

- contiene otra clave o cualquier otro archivo, o un documento que no esté en base64 estricto o no sea texto UTF-8
- su manifiesto pide más de lo que necesita un conjunto de reglas (cualquier código, permiso u otra contribución)
- un archivo no es el que enumera el manifiesto
- un `$comment` supera los 2.000 caracteres, o `$schema` nombra algo distinto del esquema propio del motor
- no se puede leer el conjunto de reglas o un catálogo

### A través del catálogo oficial de agentes

Un conjunto de reglas publicado en el catálogo es un archivo de paquete de conjunto de reglas con exactamente esta forma, `<id>.ruleset.json`, nunca un paquete zip. Su manifiesto declara Capability API 1.374 o posterior, así que nunca se ofrece a un motor anterior. El motor lo lee con el mismo lector y las mismas comprobaciones que un archivo de paquete que importas, lo valida contra el manifiesto que enumera el catálogo y lo instala como cualquier paquete del catálogo. Un conjunto de reglas del catálogo cuyo artefacto es un zip se rechaza antes de descargar nada; los conjuntos de reglas ya instalados siguen funcionando.

### Desde un repositorio de GitHub

Si guardas tu trabajo en un repositorio público de GitHub, coloca cada conjunto de reglas en una carpeta `rulesets` en la raíz del repositorio, un archivo por conjunto:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Un usuario añade tu repositorio una sola vez, revisa lo que contiene y lo sincroniza después para recibir nuevas versiones. La lista de repositorios personalizados es una función avanzada. Quien ejecuta el servidor la activa con `ENABLE_CUSTOM_AGENT_REPOS=true` y luego abre **Agents → Agent Organizer → Custom Sources** (Agentes → Organizador de agentes → Fuentes personalizadas). Los conjuntos de reglas de un repositorio se clasifican bajo el nombre de quien es propietario del repositorio, como `alice/ember-roads`, para que dos autores puedan publicar uno llamado `v20` sin colisiones.

Se aplican dos límites. Un repositorio puede contener como máximo 32 archivos JSON directamente dentro de `rulesets`; si tiene más, se rechaza. Una cuenta llamada `local` no puede publicar conjuntos de reglas, porque `local/` se reserva para los importados desde un archivo.

### En el catálogo oficial

Un sistema muy jugado y con licencias claras puede ofrecerse a todo el mundo mediante **Agent Organizer** (Organizador de agentes). Para proponer uno, abre un pull request al repositorio [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Consulta allí el paquete `ruleset-5e-2014` para ver la estructura.

## Licencias

Publica solo texto de reglas que tengas derecho a compartir. Muchos sistemas publican un documento de referencia con una licencia abierta, y ese es el documento del que puedes copiar. Coloca bajo `license` el ID de la licencia (un ID SPDX, un nombre estándar corto como `CC-BY-4.0`) y el texto de atribución que exige la licencia. No copies texto de manuales que no tengan licencia abierta. Un conjunto de reglas necesita principalmente nombres y números. Escribe el texto del Game Master con tus propias palabras.

<a id="troubleshooting"></a>

## Solución de problemas

- **La importación dice que un nombre no existe.** Algo del archivo apunta a un ID no declarado, como una habilidad que nombra un atributo que retiraste. El mensaje indica la ruta hasta la línea.
- **La importación dice que una versión ya está instalada con otro contenido.** Aumenta `version` y vuelve a importar.
- **Mi conjunto de reglas no aparece en el asistente de configuración.** Comprueba que **Allow custom Agent imports** esté activado. Mientras esté desactivado, los conjuntos de reglas importados quedan fuera de las partidas nuevas, y las partidas que ya usan uno siguen funcionando.
- **Una partida dice que falta su conjunto de reglas.** No está instalada la versión exacta con la que se creó la partida. Vuelve a importar esa versión del archivo.
