# Recursos del juego: música, sonido, sprites y fondos

Los recursos del juego son los archivos multimedia que Game Mode reproduce y muestra: música, sonido, arte de personajes y fondos de escena. Esta guía muestra cómo usar el conjunto inicial, subir tus propios archivos en el **Asset Browser** (Explorador de recursos), limitar qué recursos puede usar un juego y generar efectos de sonido y música.

Game Mode lee la biblioteca por su cuenta. Elige la música, el sonido ambiental y los fondos según la escena, así que no asignas recursos a mano durante el juego.

| Categoría | Qué es |
| --- | --- |
| **Music** | Pistas de fondo que cambian según la escena. |
| **Ambient** | Sonido ambiental en bucle, como audio de naturaleza, urbano o de interiores. |
| **Sound Effects** (SFX) | Sonidos cortos para menús, combate y exploración. |
| **Sprites** | Arte de personajes y objetos que se muestra en pantalla. |
| **Backgrounds** | Imágenes de escena que se muestran detrás de la historia. |

## El conjunto inicial

Marinara instala una biblioteca inicial gratuita la primera vez que arranca el servidor, y la actualiza en arranques posteriores si cambia el conjunto incluido. Contiene:

- Cinco pistas de **Music**, para distintos ambientes de escena.
- Bucles de **Ambient** en las carpetas `nature`, `urban` e `interior`.
- **Sound Effects** para menús, combate y exploración.

Las carpetas **Backgrounds** y **Sprites** del Asset Browser empiezan vacías. No se incluyen sprites de personajes, así que agrega arte que encaje con tus propios juegos. Para los fondos, Game Mode también recurre a la biblioteca de fondos propia de la app. En una instalación nueva contiene 13 imágenes iniciales más un `Black.jpg` liso, y los juegos pueden usarlas sin subir nada. Si esa carpeta ya tenía imágenes, solo se restaura `Black.jpg`. El arte de escena generado y lo que subes se suman a ellas.

Todo el audio incluido tiene licencia CC0 (dominio público, de uso libre). El crédito de cada archivo está en un archivo `CREDITS.md` que se distribuye con los recursos en el disco. No se muestra en la app.

Los archivos y carpetas incluidos están protegidos. No puedes eliminarlos ni moverlos en el **Asset Browser**, pero sí puedes renombrarlos o copiarlos.

## Abrir el Asset Browser

El **Asset Browser** es un gestor de archivos para los recursos del juego. Ábrelo desde **Settings** (Configuración):

1. Abre **Settings**.
2. Ve a la pestaña **Imports** (Importaciones).
3. Busca **Game Assets** (Recursos del juego) y haz clic en **Asset Browser**.

O ábrelo desde un juego:

1. Abre un chat de Game Mode.
2. Haz clic o toca el botón **Game Assets** (el icono de carpeta) cerca de la esquina superior derecha del chat. Puedes arrastrarlo a otro lugar en una computadora o un teléfono.

El botón solo aparece en los chats de Game Mode. Abre **Game Assets** con el **Asset Browser** dentro, como una ventana móvil en una computadora o un panel de ancho completo en un teléfono. Si usaste **Put back in Chat Settings** para moverlo, abre en su lugar la sección **Game Assets** de Chat Settings.

La barra de herramientas muestra una ruta de navegación que empieza en **Game Assets**, un interruptor **Grid view** (Vista de cuadrícula) y **List view** (Vista de lista), **Upload** (Subir), **New** (Nuevo), **Rescan** (Volver a escanear), **Open in system folder** (Abrir en la carpeta del sistema) y un cuadro **Search in folder** (Buscar en la carpeta). Un árbol de carpetas a la izquierda te ayuda a saltar entre categorías en pantallas más anchas.

## Subir tus propios recursos

Marinara comprueba cada subida con las reglas de [Tipos y tamaños de archivo](#file-types-and-sizes). Usa cualquiera de las dos vías.

### Subir desde el Asset Browser

1. Abre el **Asset Browser**.
2. Abre una de las cinco carpetas de categoría, o una subcarpeta dentro de ella.
3. Haz clic en **Upload** y elige archivos, o arrastra archivos al área de archivos.

Debes estar dentro de una carpeta de categoría. Si sueltas archivos en el nivel superior, la app te pide que abras una primero.

### Subir desde Settings

1. Abre **Settings** y ve a la pestaña **Imports**.
2. En **Game Assets**, elige una categoría en **Type** (Tipo): **Music**, **Ambient**, **Sound Effects**, **Sprites** o **Backgrounds**.
3. Fija el destino en **Folder** (Carpeta), o mantén el valor predeterminado.
4. Haz clic en **Choose Files** (Elegir archivos) y selecciona tus archivos.
5. Haz clic en **Upload to Server** (Subir al servidor).

Si no funcionó, el mensaje de error enumera los tipos de archivo aceptados para esa categoría. Para la música, revisa la ruta de la carpeta (consulta [La regla de la carpeta de música](#the-music-folder-rule)).

Valores predeterminados de **Folder**:

| Tipo | Carpeta predeterminada |
| --- | --- |
| **Music** | `exploration/fantasy/calm` |
| **Ambient** | `nature` |
| **Sound Effects** | `exploration` |
| **Sprites** | `generic-fantasy` |
| **Backgrounds** | `custom` |

<a id="file-types-and-sizes"></a>

### Tipos y tamaños de archivo

| Categoría | Tipos de archivo aceptados |
| --- | --- |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM |
| Sprites | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds | PNG, JPG, JPEG, GIF, WebP, AVIF |

Los archivos de audio e imagen pueden pesar hasta 50 MB cada uno. Los archivos de texto pueden pesar hasta 10 MB.

<a id="the-music-folder-rule"></a>

### La regla de la carpeta de música

Cada pista de música debe estar en una ruta de tres niveles `state/genre/intensity`, por ejemplo `exploration/fantasy/calm`. Si la ruta no coincide, la subida falla. Esta estructura es como Game Mode sabe cuándo reproducir cada pista.

- State: `exploration`, `dialogue`, `combat`, `travel_rest`.
- Genre: `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom`, o la familia de una ambientación (ver abajo), como `wuxia`.
- Intensity: `calm`, `tense`, `intense`.

Las carpetas de sonido ambiental, efectos de sonido, sprites y fondos no tienen esta regla. Nombra sus subcarpetas libremente.

## Organizar tus recursos

Haz clic derecho en un archivo o una carpeta en una computadora, o usa su menú "...", para ver sus acciones.

| Acción de archivo | Qué hace |
| --- | --- |
| **Rename** (Renombrar) | Falla si el nombre ya está en uso en esa carpeta. |
| **Move** (Mover), **Copy** (Copiar) | Envía el archivo a otra carpeta con un selector de carpetas. |
| **Delete** (Eliminar), **Download** (Descargar) | Quita el archivo, o lo guarda en tu dispositivo. |

| Acción de carpeta | Qué hace |
| --- | --- |
| **Create subfolder** (Crear subcarpeta) | Crea una carpeta nueva dentro de ella. |
| **Open in system folder** | La muestra en el gestor de archivos de tu computadora. |
| **Delete folder** (Eliminar carpeta) | Si tiene archivos dentro, marca primero **Delete everything inside** (Eliminar todo lo que contiene). |

**New** en la barra de herramientas crea **New folder** (Nueva carpeta), **New text file** (Nuevo archivo de texto) o **New markdown file** (Nuevo archivo markdown) en la carpeta actual. Para actuar sobre muchos archivos, marca sus casillas. Una barra muestra cuántos hay seleccionados, con **Select all** (Seleccionar todo), **Move**, **Copy** y **Delete**. Las carpetas grandes se cargan por partes con un botón **Load more** (Cargar más).

Cada carpeta puede guardar una nota corta. Haz clic en el texto de descripción, o en la sugerencia **Add description...** (Añadir descripción...), para escribir una. Las cinco carpetas de categoría tienen descripciones fijas.

### Volver a escanear tras cambios externos

Marinara mantiene una lista interna de recursos para que Game Mode los encuentre rápido. Las subidas a través de la app la actualizan automáticamente. Si copias archivos a la carpeta de recursos del juego en tu computadora, fuera de la app, haz clic en **Rescan** para que vuelva a leer la carpeta. **Rescan** está en la barra de herramientas del **Asset Browser** y en **Game Assets**, dentro de **Settings**.

### Abrir la carpeta en tu computadora

**Open in system folder** solo funciona cuando usas la app en la misma computadora que ejecuta el servidor. En un teléfono, una tableta u otra computadora, la app te dice que las carpetas del sistema solo se pueden abrir desde el dispositivo que aloja Marinara.

## Elegir qué recursos puede usar un juego

Un chat de Game Mode puede usar solo algunas de tus carpetas de recursos, por ejemplo para que tu música alegre no suene en un juego de terror.

1. Durante la configuración, expande **Adjust Game Assets for this Game** (Ajustar los recursos para este juego) en el paso **Features** (Funciones). Para un juego existente, abre la ventana **Game Assets** del juego.
2. Haz clic en **Game assets**. Cambia a **Selecting** (Seleccionando).
3. Usa el pequeño control de estado de cada carpeta para incluirla o excluirla.

Una barra muestra "All folders included" (Todas las carpetas incluidas) o cuántas están excluidas. **Reset to all** (Restablecer todo) vuelve a incluir todo. La elección se guarda solo para ese chat. Cambia de qué carpetas puede elegir Game Mode, y no elimina ni oculta ningún archivo.

<a id="a-settings-own-art-and-music"></a>

### Arte y música propios de una ambientación

Un juego que empezó con un kit de ambientación tiene una familia artística, que aparece en **Art and music** (Arte y música) cuando cambias las palabras del kit: `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland` o una propia del kit. El juego usa las carpetas con el nombre de su familia y todas las carpetas que no llevan el nombre de ninguna familia, y deja fuera las carpetas de las demás familias. Un juego cyberpunk nunca reproduce música de batalla de fantasía ni muestra el bosque encantado. Cuando nada de su familia ni de las carpetas compartidas encaja, no suena nada en lugar de una pista de otra familia. Un juego sin kit de ambientación usa todas las carpetas.

- **Music**: pon las pistas de la ambientación en `music/<state>/<family>/<intensity>`, como `combat/wuxia/intense`. Se reproducen antes que las pistas compartidas.
- **Backgrounds**: `backgrounds/<family>`. Los fondos generados en un juego con kit de ambientación también se guardan ahí.
- **Sonidos de combate**: un sonido en `sfx/combat/<family>` con el mismo nombre que uno incluido, como `sword-swing`, lo reemplaza en los juegos de esa familia. Los sonidos de combate incluidos son de fantasía, así que los combates de otras familias quedan en silencio hasta que añadas los suyos.

Los fondos iniciales incluidos cuentan como compartidos, excepto los de fantasía (`ancient_library`, `castle_cliff`, `enchanted_forest`) y el moderno `city_night`. Un kit de ambientación guardado antes de que existieran las familias artísticas sigue funcionando: uno creado a partir de un kit inicial usa la familia de ese kit inicial, y cualquier otro usa todas las carpetas hasta que elijas una familia en **Art and music**. La barra de selección de arriba muestra la familia del juego abierto.

<a id="generated-sound-effects-and-music"></a>

## Efectos de sonido y música generados

Game Mode puede generar efectos de sonido y música mediante una cuenta **Music & Sound Effects** (Música y efectos de sonido). Elige ElevenLabs, SunoAPI o un servidor compatible personalizado. Cada sonido o pista nueva usa la cuenta de ese servicio. El audio incluido sigue disponible sin generación.

**Antes de empezar:** necesitas una cuenta **Music & Sound Effects**. La ventana **Add account** (Añadir cuenta) no tiene ninguna ficha para ella. Estas cuentas provienen de una actualización o de una importación, con **Import a backup** (Importar una copia de seguridad) en **Connections** (Conexiones). Consulta la [configuración de proveedores y los límites](../connections/providers-reference.md#music--sound-effects).

1. En **Connections**, abre el modelo de la cuenta con **Edit model** (Editar modelo).
2. Elige el servicio, introduce su clave y selecciona los modelos de música y de efectos de sonido. La música de SunoAPI también necesita una URL de callback HTTPS pública. Un servidor personalizado necesita sus rutas de endpoint.
3. Activa **Sound-effect generation** (Generación de efectos de sonido), **Music generation** (Generación de música) o ambas.
4. Guarda la cuenta. Consulta la [configuración de proveedores y los límites](../connections/providers-reference.md#music--sound-effects).

Luego actívalo al crear un juego:

1. En el paso **Features** del asistente de configuración, busca la tarjeta **Game Audio** (Audio del juego).
2. En la elección de cuenta, elige tu cuenta o deja **Use the default Music & Sound Effects account** (Usar la cuenta predeterminada de música y efectos de sonido).
3. Deja **Sound effects** (Efectos de sonido) y **Music** (Música) activados, o desactiva el que no quieras.

Cada interruptor necesita que la función correspondiente esté activada en la cuenta elegida. Una cuenta Audio que solo ofrece voz no se usa para la generación.

Durante el juego:

- **Sound effects.** Después de los turnos del GM, Marinara pide al servicio sonidos cortos que encajen con la escena.
- **Music.** Marinara compone una pista instrumental, de unos dos minutos, para cada lugar que visita el grupo y para cada tipo de combate, como un combate contra un jefe. Cada pista se crea una sola vez y luego se reutiliza. La pista de un lugar nuevo empieza en un cambio de escena posterior, para que la música no entre a mitad de una escena. La pista de un combate entra con un fundido en cuanto está lista.

Los sonidos y las pistas generados se guardan con tus recursos del juego, así que el mismo sonido no se crea dos veces. Si **Music DJ** reproduce música para el juego, Game Mode no genera música.

## Carpeta de música personalizada para Music DJ

**Music DJ** es un agente ayudante que puede reproducir música durante un juego. En su modo Custom, reproduce pistas de una carpeta que tú eliges. Cuando activas **Music DJ** para un chat, sus ajustes muestran **Apply to** (Aplicar a). Ahí se guarda la carpeta para este chat, para el único personaje del chat o para todos los chats. **In use:** muestra la carpeta de la que el chat reproduce música. Con **All chats (default)** (Todos los chats: predeterminado), la fuente **Game Assets** acepta una ruta dentro de tus recursos del juego, como `music` o `music/combat`. Para dar a un chat o a un personaje su propia carpeta, consulta [Usar una carpeta distinta para un chat o personaje](../media/music.md#use-a-different-folder-for-a-chat-or-character).

El editor completo de **Music DJ** tiene una sección **Custom Music Library** (Biblioteca de música personalizada). **Use Game Assets music folder** (Usar la carpeta de música de Game Assets) elige entre dos modos:

- Activado: el campo **Game Assets music folder** lee una carpeta dentro de tus recursos del juego. **Open Folder** (Abrir carpeta) la abre en la computadora del servidor.
- Desactivado: **Default music folder on this device** (Carpeta de música predeterminada en este dispositivo) reproduce música desde cualquier carpeta de la computadora que ejecuta el servidor. Haz clic en **Select Folder** (Seleccionar carpeta), o pega la ruta.

Elegir una carpeta fuera de la app necesita acceso privilegiado. En la misma computadora que el servidor funciona sin configuración extra. Desde otro dispositivo o mediante acceso remoto, configura primero el acceso de administrador. Consulta [Acceso remoto](../REMOTE_ACCESS.md). Para el resto del reproductor de música, consulta [Music DJ](../media/music.md).

## Guías relacionadas

- [Music DJ: Spotify, YouTube y música local](../media/music.md)
- [Proveedores de IA compatibles](../connections/providers-reference.md)
- [Game Mode: primeros pasos](getting-started.md)
- [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md)
