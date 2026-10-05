# Recursos del juego: música, sonido, sprites y fondos

Esta guía explica la biblioteca de recursos del juego que Game Mode usa para la música, el sonido, el arte de personajes y los fondos de escena. Cubre el conjunto inicial integrado, el gestor de archivos **Asset Browser** (Explorador de recursos), cómo subir tus propios archivos y cómo elegir qué recursos puede usar cada juego.

## Qué son los recursos del juego

Los recursos del juego son los archivos multimedia que Game Mode reproduce y muestra mientras corre una sesión. Marinara Engine los ordena en cinco categorías:

- **Music**: pistas de música de fondo que cambian según la escena.
- **Ambient**: sonido ambiental en bucle, como audio de naturaleza, urbano o de interiores.
- **Sound Effects** (también llamados SFX): sonidos cortos para menús, combate y exploración.
- **Sprites**: arte de personajes y objetos que se muestra en pantalla.
- **Backgrounds**: imágenes de escena que se muestran detrás de la historia.

Game Mode lee esta biblioteca por su cuenta. Elige la música, el sonido ambiental y los fondos automáticamente según la escena, así que no tienes que asignar recursos a mano durante el juego.

## El conjunto inicial incluido

Marinara instala una biblioteca inicial gratuita la primera vez que arranca el servidor. Actualiza estos archivos en arranques posteriores si cambia el conjunto incluido. El conjunto inicial incluye:

- Cinco pistas de **Music**, una para cada uno de varios ambientes de escena.
- Un conjunto de bucles de **Ambient** dentro de las carpetas de naturaleza, urbano e interiores.
- **Sound Effects** para menús, combate y exploración.

No se incluyen **Backgrounds**. Las carpetas de fondos empiezan vacías. Se llenan solo cuando subes imágenes o cuando Game Mode genera arte de escena.
No se incluyen **Sprites** de personajes. Agrega solo el arte de personajes que encaje con tus propios juegos.

Todos los archivos incluidos tienen licencia CC0, lo que significa que son de dominio público y de uso libre. El crédito completo de cada archivo vive en un archivo de texto `CREDITS.md` que se distribuye con los recursos en el disco. No se muestra dentro de la app.

Los archivos y carpetas incluidos están protegidos. No puedes eliminarlos ni moverlos desde el **Asset Browser**, así que tu biblioteca inicial se mantiene intacta. Sí puedes renombrarlos o copiarlos.

## Abrir el Asset Browser

El **Asset Browser** es un gestor de archivos para los recursos de tu juego. Puedes abrirlo de dos maneras.

Desde **Settings** (Configuración):

1. Abre **Settings**.
2. Ve a la pestaña **Imports**.
3. Busca la sección **Game Assets**.
4. Haz clic en el botón **Asset Browser**.

Desde un juego:

1. Abre un chat de Game Mode.
2. Haz clic o toca el botón **Game Assets** (la carpeta), que empieza arriba a la derecha del chat. Puedes arrastrarlo en la computadora o el teléfono.

El botón solo aparece en Game Mode. Abre **Game Assets**, que contiene el **Asset Browser**: una ventana móvil en computadora o un panel de ancho completo en teléfono.

Si lo guardaste con **Put back in Chat Settings**, abre la sección **Game Assets** dentro de Chat Settings.

La barra de herramientas de arriba tiene una ruta de navegación que empieza en **Game Assets**. A su lado están un interruptor de **Grid view** (vista de cuadrícula) y **List view** (vista de lista), un botón **Upload** y un botón **New**. También tiene un botón **Rescan**, un botón **Open in system folder** y una caja **Search in folder**. Un árbol de carpetas a la izquierda te deja saltar entre categorías en pantallas más anchas.

## Subir tus propios recursos

Puedes subir recursos de dos maneras. Usa la que te resulte más fácil.

### Subir desde el Asset Browser

1. Abre el **Asset Browser**.
2. Entra en una de las cinco carpetas de categoría, o en una subcarpeta dentro de ella.
3. Haz clic en **Upload** y elige tus archivos, o arrastra archivos al área de archivos.

Primero debes estar dentro de una carpeta de categoría. Si sueltas archivos en el nivel superior, la app te pide que abras una carpeta de categoría antes de subir.

### Subir desde Settings

1. Abre **Settings** y ve a la pestaña **Imports**.
2. Busca la sección **Game Assets**.
3. Elige una categoría en el menú **Type**: **Music**, **Ambient**, **Sound Effects**, **Sprites** o **Backgrounds**.
4. Fija el destino en la caja **Folder**, o mantén el valor predeterminado sugerido.
5. Haz clic en **Choose Files** y selecciona tus archivos.
6. Haz clic en **Upload to Server**.

Cada **Type** llena la caja **Folder** con un valor predeterminado sensato. Los valores predeterminados son:

- **Music**: `exploration/fantasy/calm`
- **Ambient**: `nature`
- **Sound Effects**: `exploration`
- **Sprites**: `generic-fantasy`
- **Backgrounds**: `custom`

### Reglas de tipo y tamaño de archivo

El servidor comprueba cada subida contra estas reglas. Se aplican a ambas vías de subida.

| Categoría                     | Tipos de archivo aceptados           |
| ----------------------------- | ------------------------------------ |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM  |
| Sprites                       | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds                   | PNG, JPG, JPEG, GIF, WebP, AVIF      |

Los archivos de audio e imagen pueden pesar hasta 50 MB cada uno. Los archivos de texto pueden pesar hasta 10 MB. El servidor rechaza los tipos de archivo que no encajan con la categoría. El mensaje de error enumera los tipos aceptados.

### La regla de la carpeta de música

La música tiene una estructura de carpetas estricta. Cada pista de música debe estar en una ruta de tres niveles `state/genre/intensity`, por ejemplo `exploration/fantasy/calm`. Si la ruta no coincide, la subida falla.

Los valores permitidos son:

- State: `exploration`, `dialogue`, `combat`, `travel_rest`.
- Genre: `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom`.
- Intensity: `calm`, `tense`, `intense`.

Esta estructura es como Game Mode sabe cuándo reproducir cada pista. Las carpetas de sonido ambiental, efectos de sonido, sprites y fondos no tienen esta regla. Puedes nombrar sus subcarpetas libremente.

## Organizar tus recursos

El **Asset Browser** te deja mantener tus archivos ordenados. Haz clic derecho en un archivo o carpeta en la computadora, o usa su menú "...", para ver sus acciones.

Acciones sobre un archivo:

- **Rename**: dale al archivo un nombre nuevo. El renombrado falla si el nombre ya está en uso en esa carpeta.
- **Move** y **Copy**: envía el archivo a otra carpeta usando un selector de carpetas.
- **Delete**: quita el archivo.
- **Download**: guarda el archivo en tu dispositivo.

Acciones sobre una carpeta:

- **Create subfolder**: crea una carpeta nueva dentro de ella.
- **Open in system folder**: muestra la carpeta en el gestor de archivos de tu computadora.
- **Delete folder**: quita la carpeta. Si todavía tiene archivos dentro, primero debes marcar **Delete everything inside**.

El botón **New** en la barra de herramientas también crea elementos en la carpeta actual. Ofrece **New folder**, **New text file** y **New markdown file**.

Para actuar sobre muchos archivos a la vez, usa las casillas de cada archivo. Una barra muestra cuántos archivos seleccionaste, con botones **Select all**, **Move**, **Copy** y **Delete**. Las carpetas grandes muestran solo parte de su contenido a la vez, con un botón **Load more**.

Cada carpeta puede guardar una nota corta. Haz clic en el texto de descripción de la carpeta, o en la sugerencia **Add description...**, para escribir una. Las cinco carpetas de categoría tienen descripciones fijas que no puedes cambiar.

Recuerda que los archivos iniciales incluidos están protegidos. Puedes renombrarlos o copiarlos, pero no puedes moverlos ni eliminarlos.

## Volver a escanear tras cambios externos

Marinara mantiene una lista interna de tus recursos para que Game Mode pueda encontrarlos rápido. Cuando subes a través de la app, esta lista se actualiza por su cuenta.

Si copias archivos a la carpeta de recursos del juego directamente en tu computadora, fuera de la app, la app no se da cuenta enseguida. Haz clic en el botón **Rescan** para que vuelva a leer la carpeta y detecte los archivos nuevos. **Rescan** está tanto en la barra de herramientas del **Asset Browser** como en la sección **Game Assets** dentro de **Settings**.

## Elegir qué recursos puede usar un juego

Cada chat de Game Mode puede limitarse a solo algunas de tus carpetas de recursos. Esto es útil cuando quieres que un juego de terror se salte tu música alegre, por ejemplo.

Durante la configuración, expande **Adjust Game Assets for this Game** en el paso **Features**. Para un juego existente, abre la ventana **Game Assets** del juego.

Luego:

1. Haz clic en el botón **Game assets**. Cambia a leer **Selecting** mientras está activo.
2. Usa el pequeño control de estado en cada carpeta para incluirla o excluirla.

Una barra muestra "All folders included" (Todas las carpetas incluidas) o cuántas carpetas están excluidas, con un botón **Reset to all** para volver a incluir todo. Esta elección se guarda solo para ese chat. Cambia de qué carpetas puede elegir Game Mode, pero no elimina ni oculta ningún archivo. No tiene efecto fuera de ese chat de Game Mode.

## Carpeta de música personalizada para Music DJ

**Music DJ** es un agente ayudante que puede reproducir música durante un juego. Cuando corre en su modo Custom, reproduce pistas de una carpeta que tú eliges. Puedes fijar esa carpeta en dos lugares.

Cuando activas **Music DJ** para un chat, el formulario de configuración sigue la fuente guardada en el agente Music DJ. **Game Assets** muestra una ruta dentro de tus recursos del juego, como `music` o `music/combat`. **Folder on this device** muestra la ruta de dispositivo del servidor guardada y un botón **Choose Folder**.

El editor completo de **Music DJ** tiene una sección **Custom Music Library**. Su interruptor **Use Game Assets music folder** elige entre dos modos:

- Interruptor activado: el campo **Game Assets music folder** lee una carpeta dentro de tus recursos del juego, como `music` o `music/combat`. El botón **Open Folder** abre esa carpeta en la máquina del servidor.
- Interruptor desactivado: el campo **Music folder on this device** deja que el modo Custom reproduzca música desde cualquier carpeta en la computadora que corre el servidor. Haz clic en **Select Folder** para abrir un selector de carpetas del sistema, o pega la ruta de la carpeta en la caja.

Elegir una carpeta fuera de la app necesita acceso privilegiado. En la misma computadora que el servidor, funciona sin configuración extra. Desde otro dispositivo o mediante acceso remoto, primero debes configurar el acceso de administrador. Consulta [Acceso remoto](../REMOTE_ACCESS.md) para saber cómo activarlo. Para todo lo demás sobre el reproductor de música, consulta [Music DJ](../media/music.md).

## Abrir la carpeta en tu computadora

El botón **Open in system folder** abre la carpeta de recursos seleccionada en el gestor de archivos normal de tu computadora. Esto solo funciona cuando usas la app en la misma computadora que corre el servidor. En un teléfono, una tableta u otra computadora, la app te dice que las carpetas del sistema solo se pueden abrir desde el dispositivo que aloja Marinara.

## Guías relacionadas

- [Music DJ: Spotify, YouTube y música local](../media/music.md)
- [Game Mode: primeros pasos](getting-started.md)
- [Acceso remoto: Basic Auth y lista de IP permitidas](../REMOTE_ACCESS.md)
