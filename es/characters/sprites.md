# Sprites de personaje (expresiones y cuerpo completo)

Esta guía te muestra cómo añadir arte de personaje llamado sprites (imágenes del personaje) y generarlo con IA. También explica cómo limpiar el fondo y controlar cómo aparecen los sprites en pantalla. Los sprites funcionan en Roleplay Mode y Game Mode.

## Qué son los sprites

Un sprite es arte de personaje de pie: una imagen de un personaje que Marinara Engine muestra flotando sobre la escena del chat. Marinara usa dos tipos de sprite:

- **Facial Expressions** (expresiones faciales): imágenes de retrato para distintos estados de ánimo, como feliz, triste o enojado.
- **Full-body** (cuerpo completo): imágenes de cuerpo entero para distintas poses, como reposo, caminar o postura de batalla.

Los sprites solo aparecen en pantalla en **Roleplay Mode** y **Game Mode**. Los chats en modo Conversation normal no muestran arte de sprite. Aun así, puedes subir sprites en cualquier modo, porque un personaje conserva sus sprites sin importar qué chat lo use.

Los sprites se añaden por personaje. También puedes añadir sprites a una persona, que es el personaje que te representa. El editor de persona tiene la misma pestaña **Sprites** que se describe a continuación.

## Dónde encontrar la pestaña Sprites

Los sprites se gestionan dentro del editor de personaje (o de persona).

1. Abre un personaje para editarlo.
2. Haz clic en la pestaña **Sprites** en el editor.
3. En la parte superior de la pestaña, elige una categoría: **Facial Expressions**, **Full-body** o **Clips**.

Esta guía cubre las categorías **Facial Expressions** y **Full-body**. La categoría **Clips** es una función aparte para llamadas de voz y video. Consulta [Llamadas de audio y video en Conversation](../conversation/calls.md) para ver los clips.

## Subir tus propios sprites

Puedes subir imágenes PNG, JPEG, GIF, WebP, AVIF y SVG pasivas. Los archivos PNG transparentes dan el mejor resultado, porque el área vacía alrededor del personaje se ve a través sobre la escena. Las imágenes de reemplazo no compatibles o no válidas se rechazan sin quitar el sprite guardado.

### Subir un sprite

1. Abre la pestaña **Sprites** y elige **Facial Expressions** o **Full-body**.
2. Haz clic en **Add sprites** (añadir sprites) y luego en **Upload images** (subir imágenes). Puedes seleccionar varias imágenes a la vez.
3. El nombre de cada archivo se convierte en la etiqueta inicial del sprite. Abre un sprite para cambiarle el nombre más tarde.

Los sprites nuevos aparecen sueltos en la cuadrícula normal. En el editor de personas, usa el campo de nombre del cuadro **Add Sprite** (añadir sprite) y el botón **Upload** (subir) de siempre para un solo sprite.

### Subir una carpeta entera de una vez

Si tienes muchos sprites en una carpeta, puedes importarlos todos en un solo paso.

1. Nombra tus archivos de imagen según la expresión o la pose. Por ejemplo, nombra un archivo `admiration.png` para crear una expresión llamada admiration.
2. Abre **Add sprites** y haz clic en **Import folder** (importar carpeta). En el editor de personas, haz clic en **Upload Folder** (subir carpeta) dentro de **Add Sprite**.
3. Elige la carpeta que contiene tus imágenes.

El nombre de cada archivo (sin su sufijo) se convierte en el nombre del sprite. Una línea de progreso indica "Uploading X/Y sprites" mientras se ejecuta.

Las subcarpetas se convierten en carpetas de sprites opcionales. Un `catalog.json` exportado también restaura la pertenencia a carpetas y las etiquetas editadas. La información de carpetas no válida se informa mientras las imágenes utilizables se importan igualmente. Las importaciones fallidas o parciales informan del fallo en lugar de mostrar un éxito con cero imágenes.

Para hacer varias versiones de la misma expresión, comparte un nombre antes de un guion bajo. Por ejemplo, `happy_01.png` y `happy_blush.png` cuentan ambos como variantes de happy.

### Gestionar un sprite

Abre un sprite de personaje para previsualizarlo y ver sus acciones. Los sprites de persona mantienen sus acciones en la miniatura:

- **Frame** (encuadrar): recorta la imagen para que el personaje quede donde quieres.
- **Download** (descargar): guarda el archivo del sprite en tu computadora.
- **Replace** (reemplazar): sube una nueva imagen sobre el mismo nombre.
- **Rename** (renombrar; en la vista previa del personaje): cambia su etiqueta, de hasta 160 caracteres, conservando su identificador de archivo y su URL. Las referencias concretas a la imagen que ya existen siguen funcionando.
- **Folder** (carpeta; en la vista previa del personaje) o **Move sprite** (mover sprite; en la miniatura de persona): elige una carpeta, o **No folder** (sin carpeta), sin arrastrar.
- **Delete** (eliminar): quita ese sprite.

Al eliminar se te pide confirmar. En el editor de personas, **Delete All Expressions** o **Delete All Full-Body** quita toda la categoría aunque haya una búsqueda activa.

### Carpetas opcionales y selección

Haz clic en **New folder** (nueva carpeta) para crear una carpeta contraída llamada **unnamed**. Haz doble clic o doble toque en su nombre para cambiarlo; usa la flecha para expandirla. Las expresiones y los sprites de cuerpo completo tienen carpetas separadas. Las carpetas aparecen encima de los sprites sueltos y se pueden arrastrar para reordenarlas.

Arrastra sprites individuales a carpetas expandidas o contraídas. En el teléfono, mantén pulsada una miniatura para empezar a arrastrar; un deslizamiento normal sigue desplazando la vista. Arrastra un sprite archivado al área suelta para quitarle la carpeta. El área resaltada muestra el destino. El control **Folder** de la vista previa y el botón **Move sprite** de la miniatura de persona son la alternativa con teclado.

Haz clic en **Select** (seleccionar) para mostrar las casillas y **Select all sprites** (seleccionar todos los sprites); luego arrastra juntos los sprites seleccionados o usa las herramientas de limpieza y eliminación disponibles. **Cancel** (cancelar) sale del modo de selección. La búsqueda filtra los sprites visibles; una búsqueda sin resultados no significa que la biblioteca esté vacía.

Las carpetas organizan los sprites; nunca eligen un conjunto activo ni ocultan imágenes a los chats o agentes. Eliminar una carpeta deja sus sprites sueltos.

### Character Sheet

La fila compacta **Character Sheet** del editor de personajes se abre con **Manage** (gestionar). Crea o sube ahí una hoja y activa **Use as reference image** (usar como imagen de referencia) cuando quieras que se prefiera para el parecido del personaje. La selección de referencias y el respaldo del avatar funcionan como antes.

## Generar sprites con IA

Si tienes una conexión de imagen configurada, Marinara puede dibujar sprites por ti. Una conexión es el vínculo entre Marinara y un servicio de IA. Para generar sprites necesitas una conexión de imagen, y para sprites animados necesitas una conexión de video. Consulta [Conectarte a un proveedor de IA](../connections/connecting-to-a-provider.md) para configurar una.

Para empezar, haz clic en **Generate Sprite** (generar sprite) en el cuadro **Add Sprite**. Esto abre la ventana **Generate Sprites**. En la parte superior eliges una fuente: **Expressions (Portrait)** o **Full-body**.

Rellena la ventana:

1. Elige una **Image Generation Connection** (conexión de generación de imágenes) en el menú desplegable.
2. Añade hasta cuatro **Reference Images** (imágenes de referencia) si quieres que el arte coincida con un aspecto. También puedes marcar la casilla para usar el avatar actual como referencia.
3. Escribe una **Appearance Description** (descripción de aspecto) de cómo se ve el personaje. Esto es obligatorio.
4. Opcionalmente activa **Transparent sprite background** (fondo de sprite transparente). Marinara solicita primero transparencia PNG nativa. Si el proveedor no puede devolver alfa, elige un fondo mate saturado verde, magenta o cian que menos se superponga con los colores de tu **Appearance Description**, y luego quita ese fondo mate automáticamente.
5. Elige cuántas imágenes hacer con **Expression Count** (cantidad de expresiones) (o **Pose Count** (cantidad de poses) para cuerpo completo), y luego elige qué expresiones o poses rellenar.
6. Haz clic en el botón **Generate** (generar).

Cuando llegan las imágenes, las revisas. Puedes activar o desactivar cada una, cambiarle el nombre y recortarla antes de guardar. Cuando estés conforme, guarda las imágenes seleccionadas en el conjunto de sprites del personaje.

Cuando exactamente un sprite guardado en esa categoría tiene la etiqueta generada, al guardar se reemplaza su imagen y se conservan su carpeta y su identificador. Un sprite al que se le cambió el nombre para apartarlo de esa etiqueta se conserva. Las etiquetas duplicadas en carpetas distintas necesitan que elijas un sprite de reemplazo explícito para acertar con seguridad.

En la fuente **Full-body**, si el personaje ya tiene expresiones de retrato, puedes marcar **Match existing expression sprites** (coincidir con los sprites de expresión existentes). Esto crea poses de cuerpo completo que coinciden con cada nombre de expresión que ya tienes.

Dos notas sobre la generación con IA:

- La generación puede tardar unos minutos, aunque el texto dentro de la app sugiera menos. Los servicios de IA lentos tardan más. Espera en lugar de empezar de nuevo.
- En algunos dispositivos, como ciertas instalaciones de Android, la generación de sprites con IA y la limpieza de fondo no están disponibles. Cuando eso ocurre, el botón queda desactivado y Marinara muestra el motivo en pantalla.

### Sprites de retrato animados

En la fuente **Expressions (Portrait)** hay una casilla llamada **Generate animated portraits** (generar retratos animados). Al activarla se hacen clips cortos en movimiento en lugar de imágenes fijas, y luego cada clip se convierte en un sprite GIF en bucle. Un GIF es un archivo de imagen que reproduce una animación corta. Los retratos animados usan una conexión de video en lugar de una conexión de imagen.

## Limpiar los fondos de los sprites

Un sprite se ve mejor cuando solo se muestra el personaje y el fondo se ve a través. Los sprites fijos generados usan transparencia nativa cuando el proveedor la admite. De lo contrario, Marinara quita un fondo mate de croma plano y adaptativo con un borde suave y limpia su color del cabello, la tela y otros píxeles parcialmente transparentes. Los sprites más antiguos con fondo blanco siguen siendo compatibles.

### Limpiar un sprite a mano

Abre la vista previa del sprite de personaje y su acción de limpieza con la varita, o haz clic en la imagen de un sprite de persona para abrir el editor de limpieza. Ahí puedes borrar el fondo, volver a pintar áreas y comprobar el resultado sobre fondos oscuros, claros y de tablero de ajedrez. Puedes deshacer, restablecer al original y aplicar tus cambios cuando termines.

### Limpiar muchos sprites de una vez

En el editor de personajes, haz clic en **Select**, elige sprites y haz clic en **Clean Backgrounds** (limpiar fondos). En el editor de personas, el botón de limpieza se aplica a los sprites seleccionados o, si no hay ninguno seleccionado, a la categoría visible.

1. Ajusta el control deslizante **Cleanup strength** (intensidad de limpieza). Va de Soft a Aggressive, de 0 a 100, y empieza en 35. Un valor más alto quita más fondo pero puede recortar parte del personaje.
2. Haz clic en **Clean Backgrounds** y confirma.

Después de una limpieza por lotes, Marinara conserva una copia de seguridad. Una línea indica "Last cleanup has a restore point" con un botón **Undo Cleanup** (deshacer limpieza). Haz clic en él para dejar cada sprite afectado como estaba.

La limpieza de fondo funciona con imágenes PNG, JPG, JPEG, WEBP y AVIF. No funciona con archivos GIF ni SVG.

La limpieza automática examina la imagen antes de elegir un motor. La limpieza rápida de fondo mate integrada maneja primero el croma plano y los fondos blancos heredados. Si el borde no es realmente uniforme, Marinara puede usar el eliminador de fondo con IA opcional como alternativa cuando está instalado. El editor de limpieza manual sigue siendo la opción más segura para una escena cargada o un sujeto cuyos colores son casi idénticos al fondo.

## Exportar sprites

Puedes guardar los sprites de un personaje en tu computadora como un archivo zip. Un zip es un solo archivo que contiene muchos archivos juntos.

1. Abre la pestaña **Sprites**.
2. Haz clic en **Export** (exportar) encima de la cuadrícula del personaje, o en el cuadro **Add Sprite** de la persona.
3. Elige **Expressions only** o **Full-body only** para exportar la categoría actual, o **All sprites** para exportar todo.

La descarga contiene los archivos de imagen de los sprites y un `catalog.json` con las etiquetas y la organización en carpetas. Las transferencias nativas compatibles de personajes y personas, y las copias de seguridad del perfil, también conservan esos metadatos.

### Integraciones que conocen las carpetas

`GET /api/sprites/:ownerId` sigue devolviendo todos los sprites, archivados o sueltos. `GET /api/sprites/:ownerId/catalog` añade las carpetas y la pertenencia para las integraciones que quieran descubrir o importar una carpeta cada vez. Cada sprite incluye su identificador estable `expression`, su `label` editable, `folderId` y su URL. Usa los ID de carpeta para la pertenencia; el arreglo `folders` es el orden guardado, que el editor muestra al revés para que las carpetas nuevas aparezcan primero. El orden de las carpetas no fija la prioridad ni la disponibilidad para los agentes.

El explorador de recursos del chat muestra las etiquetas editadas, pero inserta enlaces concretos `card://sprites/<ownerId>/<filename>`, que siguen funcionando después de un cambio de nombre. Los enlaces del ámbito del chat como `card://sprites/facial/joy.png` también pueden resolver la etiqueta editada; un nombre de archivo coincidente existente tiene prioridad.

Los metadatos opcionales que faltan o no se pueden leer no ocultan las imágenes utilizables. Las ediciones rechazan los metadatos dañados en lugar de reemplazarlos en silencio. Los listados de solo lectura omiten las bibliotecas inaccesibles; las rutas de exportación y escritura siguen rechazando los directorios de propietario enlazados.

## Cómo aparecen los sprites en tu chat

Subir sprites es solo la mitad del trabajo. También decides cuándo y cómo aparecen durante un chat. Esto se hace en los ajustes del chat, no en el editor de personaje.

### Roleplay Mode

En **Roleplay Mode**, el agente opcional **Expression Engine** controla la visualización de los sprites. Descárgalo desde **Agents → Agent Organizer (Organizador de agentes)** , y luego añádelo al chat. Lee el estado de ánimo de cada mensaje y elige un sprite de expresión que coincida. Consulta [Referencia de agentes descargables](../agents/built-in-agents.md) para más detalles.

Para que los sprites aparezcan en un chat de Roleplay, todo lo siguiente debe cumplirse:

- El agente **Expression Engine** está activado para el chat.
- Al menos un personaje o la persona activa está elegido como propietario de sprites.
- Al menos una fuente de sprites está activada.

Abre los ajustes del chat y busca la tarjeta del agente **Expression Engine**. Ahí controlas cómo se muestran los sprites:

- **Sprite Source** (fuente de sprites): elige **Expressions**, **Full-body** o ambas. Ambas están activadas de forma predeterminada. Al menos una debe permanecer activada.
- **Expression Avatars** (avatares de expresión): reemplaza el pequeño avatar del mensaje con el sprite de expresión que coincide, en lugar de mostrar una superposición flotante. Está desactivado de forma predeterminada y es solo para Roleplay Mode.

### Game Mode

En **Game Mode**, un sprite de cuerpo completo se muestra automáticamente para el personaje que esté hablando o luchando. No necesitas el agente Expression Engine para esto. Solo necesitas tener sprites de cuerpo completo subidos para ese personaje. Consulta [Game Mode: primeros pasos](../game/getting-started.md) para la configuración más amplia de Game Mode.

### Mover y redimensionar sprites (modo Arrange)

Una vez que un propietario de sprites está activado, la tarjeta del agente **Expression Engine** muestra una sección **Sprite Layout** (disposición de sprites).

- Haz clic en **Arrange** (organizar) para entrar en el modo de arrastre, y luego arrastra cada sprite adonde quieras. Haz clic en **Done** (listo) cuando termines.
- **Reset** (restablecer) borra tus posiciones personalizadas y vuelve a la disposición automática.
- **Default Side** (lado predeterminado) define si los sprites nuevos se inclinan hacia la **Left** (izquierda) o la **Right** (derecha). Left es lo predeterminado. Cambiar el lado invierte tu disposición actual.
- Cuatro controles deslizantes ajustan el tamaño y el nivel de transparencia: **Expression Size** (tamaño de expresión) y **Full-body Size** (tamaño de cuerpo completo) van del 5% al 200%. **Expression Opacity** (opacidad de expresión) y **Full-body Opacity** (opacidad de cuerpo completo) van del 15% al 100%. Todos empiezan en 100%.

## Clips de videollamada

La categoría **Clips** en la pestaña **Sprites** es una función distinta. Hace videos cortos en bucle que actúan como la cámara de un personaje durante una llamada de voz o video en modo Conversation. Como pertenece a la función de llamada, está documentada por separado. Consulta [Llamadas de audio y video en Conversation](../conversation/calls.md).

## Guías relacionadas

- [Crear y editar personajes](creating-and-editing-characters.md)
- [Roleplay Mode: primeros pasos](../roleplay/getting-started.md)
- [Game Mode: primeros pasos](../game/getting-started.md)
- [Llamadas de audio y video en Conversation](../conversation/calls.md)
- [Expresiones animadas](../media/animated-expressions.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
