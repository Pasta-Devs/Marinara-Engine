# Escribir conjuntos de reglas de Game Mode

Un conjunto de reglas explica a Game Mode cómo funciona un sistema de mesa: qué dados tira una prueba, qué contiene la ficha, qué recursos se gastan y qué recupera un descanso. Esta guía es para quienes quieren escribir uno y compartirlo. Para jugar con uno creado por otra persona, empieza por [Jugar con un conjunto de reglas](../game/rulesets.md).

Un conjunto es un archivo JSON. Son datos, no código. Nada se ejecuta, así que importarlo no puede hacer nada en tu computadora. Antes de importar un archivo ajeno, lee con atención el texto del Game Master: se envía al modelo en todas las partidas que usan el conjunto.

## Lee esto primero: qué puede y qué no puede hacer un conjunto

Un conjunto solo puede rellenar los parámetros de una mecánica que el motor ya conoce. Actualmente conoce cinco formas de resolver pruebas; el archivo elige una con `resolution.kind`:

- **`dice-sum`**: tira dados, suma números de la ficha e iguala o supera una dificultad. Abarca sistemas d20, sistemas de 2d6 más atributo y muchos otros.
- **`dice-pool`**: tira la cantidad de dados del personaje y cuenta los que alcanzan un objetivo. Abarca sistemas donde una puntuación representa un puñado de dados en vez de una bonificación.

- **`dice-highest`**: tira una reserva y lee su dado más alto, o suma los pocos más altos. Abarca Blades in the Dark y Trophy Dark.
- **`roll-against`**: saca un resultado igual o inferior (o superior) al número de la ficha. Abarca las habilidades porcentuales y las pruebas de GURPS.
- **`symbol-pool`**: forma y mejora dados narrativos y después cancela los símbolos opuestos. Abarca las pruebas de Genesys y, desde Capability API 1.382, sus combates.

Los cinco se describen por completo en [Tipos de resolución](ruleset-checks.md#resolution-kinds).

Una mecánica que no encaje en estas formas no se puede escribir en el archivo. Las reservas enfrentadas son un ejemplo. Cada una necesita un nuevo tipo de resolución dentro del motor: una contribución de código con pruebas, no un JSON. Si tu sistema lo necesita, abre una solicitud de función en el repositorio del motor y describe la mecánica con varias tiradas resueltas. Esos ejemplos se convierten en las pruebas.

Game Mode puede resolver una pelea con el combate propio de Marinara o con las reglas de tu conjunto. El bloque opcional `battle` presta al combate de Marinara las cifras de las fichas: consulta [Batallas](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat). El bloque opcional `combat` define cómo resuelve el conjunto la pelea: consulta [Combate](ruleset-combat.md#combat-a-fight-your-own-rules-resolve). El motor ya aplica esas reglas. Combat Preference (Preferencia de combate) elige la presentación Classic o, si el conjunto define distancia, un campo Tactical. Un conjunto puede limitar cuáles de estos estilos usan sus partidas mediante `combat.styles` (consulta [Qué estilos puede usar una partida](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)).

## Inicio rápido

1. Copia el ejemplo que coincida con las tiradas de tu sistema. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) es un sistema pequeño de 2d6 con tres atributos que demuestra que el formato no presupone un d20 ni seis atributos. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) es una reserva pequeña de dados de diez caras con tres puntuaciones y seis oficios. Como ejemplo completo, consulta el [paquete oficial de 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014): su archivo `ruleset.json` y su carpeta `catalogs/` son lo que instala Agent Organizer.
2. Cambia `id` por el tuyo. Usa minúsculas, dígitos y guiones simples, como `ember-roads`.
3. Edita la ficha, los descansos y el texto del Game Master.
4. Impórtalo; consulta [Probar tu conjunto](#trying-your-ruleset). La importación comprueba todo el archivo e indica los errores línea por línea antes de guardar nada.
5. Crea una partida, elige tu conjunto en **Rules** (Reglas) y juega unas cuantas pruebas.

Para recibir ayuda al escribir, configura el JSON Schema en tu editor añadiendo esta primera línea dentro de las llaves exteriores del archivo:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

El esquema detecta claves mal escritas y tipos incorrectos mientras escribes. No comprueba que los nombres apunten a elementos existentes, como una habilidad que nombra un atributo. Eso lo hace la importación.

Puedes añadir una línea `"$comment": "..."` a cualquier objeto para dejarte una nota. El motor la ignora.

## Las partes del archivo

| Clave | Qué contiene |
| --- | --- |
| `schemaVersion` | Siempre `1`. |
| `id`, `version` | El nombre del conjunto para el motor y un entero que incrementas cada vez que publicas un cambio. |
| `name` | Lo que ven los jugadores en el asistente. |
| `edition` | Opcional. Una línea sobre la edición o borrador. |
| `license` | Opcional. Un ID SPDX y la atribución exigida por la fuente. |
| `coverage` | Lo que cubre el conjunto y el resumen de una línea del asistente. |
| `resolution` | Cómo se tira una prueba o salvación. |
| `sheet` | Todo lo que hay en la ficha. |
| `rests` | Lo que restaura y elimina cada descanso. |
| `gm` | El texto que recibe el modelo del Game Master y los valores de ficha que ve por personaje. |
| `catalogs` | Opcional. Entradas preparadas que ofrece el editor para evitar escribir listas largas a mano. |
| `items` | Opcional. Las palabras con las que se escriben tus objetos: categorías, rarezas, estadísticas, ranuras y dinero. |
| `battle` | Opcional. Qué lee una batalla de la ficha y qué escribe al terminar. |
| `combat` | Opcional. Cómo resuelven tus reglas una pelea y qué ejecuta la pantalla de batalla. |
| `layers` | Opcional. Variantes del conjunto que se activan al crear una partida. |

El archivo puede ocupar hasta 512 KB (256 KB antes de Capability API 1.340). El texto que llega a un prompt (nombres, etiquetas, texto del Game Master) no puede contener saltos de línea, corchetes ni llaves dobles.

Los IDs de la ficha (atributos, habilidades, campos, reservas, etc.) usan minúsculas, dígitos y guiones bajos, y empiezan por letra, como `grit_max`.

## Las páginas de esta guía

Esta página explica qué es un conjunto de reglas, cómo empezar uno y cómo probarlo y compartirlo. El resto de la guía está dividido por temas:

- [Pruebas de conjuntos de reglas](ruleset-checks.md): Cómo tira un conjunto de reglas una prueba o una salvación: los cinco tipos de resolución, las franjas de resultado, las pruebas que tiran a su manera y el gasto o los amuletos que cambian una tirada
- [Fichas de conjuntos de reglas](ruleset-sheets.md): Qué contiene la ficha de personaje de un conjunto de reglas: atributos, habilidades, campos y listas, estados vivos, contadores de heridas, penalizaciones, descansos y el texto del Game Master, además de la ficha del grupo y los relojes de progreso
- [Catálogos de conjuntos de reglas](ruleset-catalogs.md): Entradas ya preparadas que el editor de fichas ofrece en un selector: la cabecera del catálogo, las entradas, los valores que mantiene el conjunto de reglas, los comandos de ficha y el comando de uso
- [Mecánicas de las entradas de conjuntos de reglas](ruleset-mechanics.md): Qué hace una entrada de catálogo en cifras: el bloque `mechanics` de una entrada, que leen las pruebas, los descansos y las peleas
- [Creador de personajes de conjuntos de reglas](ruleset-character-builder.md): El creador guiado: crear un personaje por pasos, desde la raza y la clase hasta las puntuaciones, las competencias, los conjuros y el equipo
- [Objetos de conjuntos de reglas](ruleset-items.md): Qué lleva un grupo: categorías, armas, armaduras, munición, botín, dinero, equipo inicial y mercados
- [Combate de conjuntos de reglas](ruleset-combat.md): Cómo participa un conjunto de reglas en una pelea: el bloque `battle`, que presta la ficha al combate de Marinara, y el bloque `combat`, que resuelve toda la pelea según las reglas propias del conjunto, con su bestiario, tablero, reacciones y enfrentamientos
- [Capas, traducciones y migraciones de conjuntos de reglas](ruleset-layers-and-translations.md): Variantes que un jugador activa para una partida, traducciones del texto de un conjunto de reglas y traslado de valores a nuevos IDs cuando cambia una ficha

<a id="trying-your-ruleset"></a>

## Probar tu conjunto de reglas

Los conjuntos de reglas comunitarios usan el mismo interruptor que los agentes importados. Abre **Settings** (ajustes) > **Advanced** (avanzado) > **Danger Zone** (zona de peligro) y comprueba que **Allow custom Agent imports** (permitir importaciones de agentes personalizados) esté activado. La importación también necesita acceso desde localhost o **Admin Access** (acceso de administrador) configurado.

1. Abre el panel **Agents** (agentes) y elige el botón **Import agents** (importar agentes), el icono de descarga de la fila de botones de la parte superior del panel.
2. Elige **Game Mode ruleset** (conjunto de reglas del modo de juego) y selecciona tu archivo JSON, o un archivo de paquete de conjunto de reglas que termine en `.ruleset.json` (consulta [Compartir tu conjunto de reglas](#sharing-your-ruleset)).
3. Lee la revisión. Muestra el nombre, la versión, la licencia, lo que cubre el conjunto de reglas y el texto del Game Master. Elige **Import** (importar).

Tu conjunto aparece en la sección **Rules** (reglas) del panel y en la elección **Rules** del asistente de configuración para nuevas partidas. Uno importado desde un archivo se clasifica como `local/<your id>`, de modo que nunca pueda confundirse con uno oficial ni con el de otra persona.

### Cambiar un conjunto de reglas que ya importaste

Una versión importada nunca se reescribe. Si cambias el archivo y lo vuelves a importar con la misma `version`, la importación se rechaza y te pide aumentar el número. Es intencional: una partida está ligada a la versión exacta con la que se creó, para que una campaña en curso nunca despierte con cálculos diferentes.

Por tanto, el ciclo durante la redacción es: editar, aumentar `version`, importar, iniciar una partida nueva. Las versiones antiguas permanecen instaladas junto a la nueva hasta que retires el conjunto de reglas de la sección **Rules**. Retirar uno que todavía usa una partida hace que esta indique que falta su conjunto de reglas hasta que vuelvas a importarlo.

Si cambias la estructura de la ficha (añades, retiras o renombras elementos), aumenta también `sheet.version`. Las fichas existentes se leen con tolerancia: se conservan los valores que la nueva ficha no conoce y los ausentes toman sus valores predeterminados.

<a id="sharing-your-ruleset"></a>

## Compartir tu conjunto de reglas

**Como archivo.** Envía el archivo JSON a un amigo. Lo importa igual que tú.

**Como archivo de paquete.** Un conjunto de reglas demasiado grande para un solo archivo, con catálogos en sus propios archivos, viaja como un único archivo JSON simple llamado `<name>.ruleset.json`. Contiene el manifiesto del paquete y los documentos del conjunto, cada uno con sus bytes exactos en base64:

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

El manifiesto enumera `ruleset.json` y cada `catalogs/<id>.json` en `contributions.assets.paths` y en `files`, con el tamaño y el sha256 de cada uno. Un editor de conjuntos de reglas como Pixelforge crea uno. **Import agents** → **Game Mode ruleset** toma el archivo y muestra la misma revisión que para un archivo de conjunto de reglas, con cada catálogo y su número de entradas. No hay nada comprimido, así que nunca contiene más que su propio tamaño. Se lee como datos y nunca se instala como paquete: se rechaza, indicando el motivo, si contiene cualquier otra cosa (otra clave, cualquier otro archivo, un documento que no esté en base64 estricto o no sea texto UTF-8), si su manifiesto es algo más que el de un conjunto de reglas (cualquier código, permiso u otra contribución), si un archivo no es el que enumera el manifiesto, si un `$comment` supera los 2,000 caracteres o `$schema` nombra algo distinto del esquema propio del motor, o si no se puede leer el conjunto o un catálogo. Se clasifica como `local/<its id>`, igual que un archivo de conjunto de reglas, con un máximo de 132 MB y como máximo 12 archivos de catálogo de 2 MB cada uno y 40 traducciones de 8 MB cada una (consulta más abajo). Una versión es su conjunto de reglas y sus catálogos juntos, así que un catálogo modificado también necesita una `version` más alta. No se aceptan paquetes de conjuntos de reglas en zip.

**A través del catálogo oficial de agentes.** Un conjunto publicado en el catálogo es un archivo de paquete de conjunto de reglas con exactamente esta forma, `<id>.ruleset.json`, nunca un paquete zip (Capability API 1.374). Su manifiesto declara Capability API 1.374 o posterior, para que nunca se ofrezca a un motor anterior. El motor lo lee con el mismo lector y las mismas comprobaciones que un archivo de paquete que importas, lo valida contra el manifiesto que enumera el catálogo y lo instala como cualquier paquete del catálogo. Un conjunto del catálogo cuyo artefacto es un zip se rechaza antes de descargar nada; los conjuntos ya instalados siguen funcionando.

**Desde un repositorio de GitHub.** Si guardas tu trabajo en un repositorio público de GitHub, coloca cada conjunto de reglas en una carpeta `rulesets` en la raíz del repositorio, un archivo por conjunto:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Un usuario añade tu repositorio una sola vez mediante la lista de repositorios de agentes personalizados, revisa lo que contiene y puede sincronizarlo después para recibir nuevas versiones. La lista de repositorios personalizados es una función avanzada que quien ejecuta el servidor debe activar con `ENABLE_CUSTOM_AGENT_REPOS=true`. Los conjuntos de reglas de un repositorio se clasifican bajo el nombre de su propietario, como `alice/ember-roads`, para que dos autores puedan publicar uno llamado `v20` sin colisiones.

Se aplican dos límites. Un repositorio puede contener como máximo 32 archivos JSON directamente dentro de `rulesets`; si tiene más, se rechaza. Una cuenta llamada `local` no puede publicar conjuntos de reglas, porque `local/` se reserva para los importados desde un archivo.

**En el catálogo oficial.** Un sistema muy utilizado y con licencias claras puede ofrecerse a todo el mundo mediante **Agent Organizer** (Organizador de agentes). Eso requiere un pull request al repositorio [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Consulta allí el paquete `ruleset-5e-2014` para ver la estructura.

## Licencias

Publica solo texto de reglas que tengas derecho a compartir. Muchos sistemas publican un documento de referencia con una licencia abierta, y ese es el documento del que puedes copiar. Coloca el identificador de la licencia y el texto de atribución que exige bajo `license`. No copies texto de manuales sin licencia abierta. Un conjunto de reglas necesita principalmente nombres y números, y el texto del Game Master debe estar escrito con tus propias palabras.

## Solución de problemas

- **La importación dice que un nombre no existe.** Algo del archivo apunta a un identificador no declarado, como una habilidad que identifica una característica que retiraste. El mensaje indica la ruta hasta la línea.
- **La importación dice que una versión ya está instalada con otro contenido.** Aumenta `version` y vuelve a importar.
- **Mi conjunto de reglas no aparece en el asistente de configuración.** Comprueba que **Allow custom Agent imports** esté activado. Mientras esté desactivado, los conjuntos importados quedan fuera de las partidas nuevas. Las partidas que ya usan uno siguen funcionando.
- **Una partida dice que falta su conjunto de reglas.** No está instalada la versión exacta con la que se creó. Vuelve a importar esa versión del archivo.
