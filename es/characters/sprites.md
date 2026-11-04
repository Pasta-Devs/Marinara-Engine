# Sprites de personaje (expresiones y cuerpo completo)

Un sprite es una imagen de tu personaje para un estado de ánimo, como feliz o triste. Marinara la muestra flotando sobre la escena del chat. Sube los tuyos, genéralos con IA, limpia sus fondos y controla cómo aparecen.

Antes de empezar: nombra cada archivo según el estado de ánimo, como `happy.png`, para que Marinara pueda elegirlo. En un chat de Roleplay, los sprites también necesitan que el agente **Expression Engine** (un ayudante que elige el sprite) esté activado. Consulta [Cómo aparecen los sprites en tu chat](#how-sprites-show-up-in-your-chat).

Hay dos tipos de sprite:

- Las **Facial Expressions** (expresiones faciales) son imágenes de retrato para estados de ánimo como feliz, triste o enojado.
- Las imágenes **Full-body** (cuerpo completo) son imágenes de cuerpo entero para poses como reposo, caminar o postura de batalla.

Los sprites aparecen en pantalla en Roleplay Mode y Game Mode, no en los chats de Conversation. Puedes subirlos en cualquier modo, porque un personaje conserva sus sprites en todos los chats. Una persona, el personaje que te representa, tiene la misma pestaña **Sprites**.

## Encontrar la pestaña Sprites

1. Abre un personaje (o una persona) en su editor.
2. Haz clic en la pestaña **Sprites**.
3. En la parte superior, elige una categoría: **Facial Expressions**, **Full-body** o **Clips**.

Las secciones de abajo cubren **Facial Expressions** y **Full-body**. **Clips** forma parte de la función de llamadas. Consulta [Llamadas de audio y video de Conversation](../conversation/calls.md).

## Subir tus propios sprites

Puedes subir imágenes PNG, JPEG, GIF, WebP, AVIF y SVG. Los archivos PNG transparentes dan el mejor resultado, porque el área vacía alrededor del personaje sigue siendo transparente. Una imagen de reemplazo no válida se rechaza y el sprite guardado se queda.

### Subir uno o más sprites

1. Abre la pestaña **Sprites** y elige **Facial Expressions** o **Full-body**.
2. Haz clic en **Add sprites** (añadir sprites).
3. Haz clic en **Upload images** (subir imágenes) y elige tus archivos. Puedes seleccionar varios a la vez.
4. El nombre de cada archivo se convierte en el nombre del sprite (su etiqueta). Abre un sprite para cambiarle el nombre más tarde.

Los sprites nuevos aparecen en la cuadrícula, fuera de cualquier carpeta. En el editor de personas, usa el campo de nombre y el botón **Upload** (subir) de **Add Sprite** (añadir sprite) para un solo sprite.

### Subir una carpeta entera

1. Nombra tus archivos de imagen según la expresión o la pose, como `admiration.png` para una expresión llamada admiration.
2. Abre **Add sprites** y haz clic en **Import folder** (importar carpeta). En el editor de personas, haz clic en **Upload Folder** (subir carpeta) en **Add Sprite**.
3. Elige la carpeta que contiene tus imágenes.

El nombre de cada archivo sin su sufijo se convierte en el nombre del sprite. Una línea de progreso indica "Uploading X/Y sprites". Las subcarpetas se convierten en carpetas de sprites opcionales. Un `catalog.json` de una exportación también restaura las carpetas y las etiquetas editadas. Una entrada de carpeta no válida se informa mientras las imágenes utilizables se importan igualmente.

Si no funcionó: una importación fallida o parcial informa del fallo en lugar de mostrar un éxito con cero imágenes. Revisa los tipos de archivo de arriba.

### Variantes de nombre

| Nombre de archivo | Qué significa |
| --- | --- |
| `happy_01.png`, `happy_blush.png` | Dos imágenes de happy. Empieza ambos nombres con `happy_`. |
| `happy_pajamas.png` | Happy, en pijama. Pon primero el estado de ánimo y luego el atuendo. |
| `angry_formalwear_soaked_01.png` | Angry, con ropa formal, empapado. Un número final solo marca otra versión de la misma imagen. |

El Expression Engine ve tanto la expresión (`happy`) como el nombre completo (`happy_pajamas`). Si ningún sprite coincide con todas las palabras, primero se quita la última palabra, así que si falta `happy_pajamas_wounded`, se usa `happy_pajamas` y, después, cualquier sprite happy.

<a id="how-sprites-show-up-in-your-chat"></a>

## Cómo aparecen los sprites en tu chat

Eliges cuándo y cómo aparecen los sprites en los ajustes del chat, no en el editor de personaje.

### Roleplay Mode

El agente Expression Engine controla los sprites en Roleplay. Un agente es un ayudante que se ejecuta junto a las respuestas. Consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md). Lee el estado de ánimo de cada mensaje y elige un sprite de expresión que coincida. Añádelo al chat, e instálalo desde **Agent Organizer** (organizador de agentes) si no lo tienes. Consulta [Referencia de agentes descargables](../agents/built-in-agents.md#expression-engine).

Para que los sprites aparezcan, todo lo siguiente debe cumplirse:

- El agente Expression Engine está activado para el chat.
- Al menos un personaje, o la persona, está elegido como propietario de sprites.
- Al menos una fuente de sprites está activada.

Abre **Chat Settings → Agents** (ajustes del chat → agentes) y busca la tarjeta **Expression Engine**:

- **Sprite Source** (fuente de los sprites) es **Expressions**, **Full-body** o ambas. Ambas están activadas de forma predeterminada, y al menos una debe permanecer activada.
- **Expression Avatars** (avatares de expresión) reemplaza el pequeño avatar del mensaje con el sprite de expresión que coincide. Está desactivado de forma predeterminada y solo funciona en Roleplay.
- **Only show active sprites** (mostrar solo los sprites activos) muestra solo los personajes del último resultado terminado y mantiene visibles los sprites actuales mientras se genera el siguiente resultado.

### Game Mode

En Game Mode, un sprite de cuerpo completo se muestra automáticamente para quien esté hablando o luchando. No necesitas el Expression Engine, solo sprites de cuerpo completo para ese personaje. Consulta [Game Mode: primeros pasos](../game/getting-started.md).

### Mover y redimensionar sprites

Una vez que hay un propietario de sprites activado, la tarjeta **Expression Engine** muestra **Sprite Layout** (disposición de sprites).

1. Haz clic en **Arrange** (organizar) y luego arrastra cada sprite adonde quieras.
2. Haz clic en **Done** (listo).

**Reset** (restablecer) borra tus posiciones y vuelve a la disposición automática. **Default Side** (lado predeterminado) es **Left** (izquierda) o **Right** (derecha) y empieza en Left. Cambiarlo invierte tu disposición actual. **Apply to** (aplicar a) te permite definir la disposición para todos los personajes o para uno.

Cuatro controles deslizantes ajustan el tamaño y el nivel de transparencia. **Expression Size** (tamaño de expresión) y **Full-body Size** (tamaño de cuerpo completo) van del 5% al 200%. **Expression Opacity** (opacidad de expresión) y **Full-body Opacity** (opacidad de cuerpo completo) van del 0% al 100%. Los tamaños y las opacidades empiezan en 100%.

## Generar sprites con IA

Antes de empezar: añade una conexión de generación de imágenes. Para sprites animados también necesitas una conexión de video. Consulta [Conectarte a un proveedor de IA](../connections/connecting-to-a-provider.md).

1. Abre **Add sprites** y haz clic en **Generate Sprite** (generar sprite). En el editor de personas, el botón está en **Add Sprite**. Se abre la ventana **Generate Sprites** (generar sprites).
2. Elige una fuente en la parte superior: **Expressions (Portrait)** o **Full-body**.
3. Elige una **Image Generation Connection** (conexión de generación de imágenes).
4. Opcionalmente, añade hasta cuatro **Reference Images** (imágenes de referencia), o marca la casilla para usar el avatar actual como referencia.
5. Escribe una **Appearance Description** (descripción de aspecto). Es obligatoria.
6. Opcionalmente, activa **Transparent sprite background** (fondo de sprite transparente). Marinara hace que el fondo sea transparente. Si el servicio no puede hacerlo, Marinara dibuja un fondo liso verde, magenta o cian que se distinga de los colores de tu **Appearance Description**, y luego lo quita.
7. Define **Expression Count** (cantidad de expresiones), o **Pose Count** (cantidad de poses) para cuerpo completo, y elige qué expresiones o poses hacer.
8. Haz clic en **Generate** (generar).

Cuando llegan las imágenes, activa o desactiva cada una, cámbiale el nombre y recórtala. Luego guarda las imágenes seleccionadas en los sprites del personaje. Si exactamente un sprite guardado en esa categoría tiene la etiqueta generada, al guardar se reemplaza su imagen y se conservan su carpeta y su identificador. Un sprite al que le cambiaste el nombre para apartarlo de esa etiqueta se conserva. Con etiquetas duplicadas en carpetas distintas, reemplaza a mano el sprite que quieras.

En la fuente **Full-body**, si el personaje ya tiene expresiones de retrato, marca **Match existing expression sprites** (coincidir con los sprites de expresión existentes) para crear poses de cuerpo completo que coincidan con cada nombre de expresión.

La generación puede tardar unos minutos, más en los servicios lentos. Espera en lugar de empezar de nuevo. En algunos dispositivos, como ciertas instalaciones de Android, la generación de sprites con IA y la limpieza de fondo no están disponibles. El botón queda desactivado y Marinara muestra el motivo.

### Retratos animados

En la fuente **Expressions (Portrait)**, **Generate animated portraits** (generar retratos animados) hace clips cortos en movimiento y convierte cada uno en un sprite GIF en bucle. Un GIF es un archivo de imagen que reproduce una animación corta. Usa una conexión de video en lugar de una conexión de imagen. Consulta [Expresiones animadas](../media/animated-expressions.md).

## Limpiar los fondos de los sprites

Un sprite se ve mejor cuando solo se muestra el personaje. Los sprites generados usan transparencia nativa cuando el servicio la admite. De lo contrario, Marinara quita un color de fondo plano y adaptativo con un borde suave, y limpia ese color del cabello, la tela y otros píxeles parcialmente transparentes. Los sprites más antiguos con fondo blanco siguen funcionando.

### Limpiar un sprite a mano

Abre la vista previa del sprite de personaje y usa su acción de limpieza con la varita, o haz clic en la imagen de un sprite de persona. El editor de limpieza te permite borrar el fondo, volver a pintar áreas y comprobar el resultado sobre fondos oscuros, claros y de tablero de ajedrez. Puedes deshacer, restablecer al original y aplicar cuando termines.

### Limpiar muchos sprites de una vez

1. En el editor de personajes, haz clic en **Select** (seleccionar) y elige sprites. En el editor de personas, el botón de limpieza se aplica a los sprites seleccionados o, si no hay ninguno seleccionado, a la categoría visible.
2. Haz clic en **Clean Backgrounds** (limpiar fondos).
3. Ajusta el control deslizante **Cleanup strength** (intensidad de limpieza), de **Soft** a **Aggressive**, de 0 a 100. Empieza en 35. Un valor más alto quita más fondo pero puede recortar parte del personaje.
4. Confirma.

Marinara conserva una copia de seguridad. Una línea indica "Last cleanup has a restore point" con **Undo Cleanup** (deshacer limpieza). Haz clic en él para dejar cada sprite afectado como estaba.

La limpieza funciona con PNG, JPG, JPEG, WEBP y AVIF. No funciona con GIF ni SVG.

La limpieza automática examina primero la imagen. La limpieza rápida integrada maneja el color plano y los fondos blancos antiguos. Si el borde no es uniforme, Marinara puede recurrir al eliminador de fondo con IA opcional cuando está instalado. Para una escena cargada, o un sujeto cuyos colores coinciden con el fondo, el editor manual es la opción más segura.

## Gestionar sprites

Abre un sprite de personaje para previsualizarlo y ver sus acciones. Los sprites de persona mantienen sus acciones en la miniatura.

- **Frame** (encuadrar) recorta la imagen para que el personaje quede donde quieres.
- **Download** (descargar) guarda el archivo del sprite.
- **Replace** (reemplazar) sube una nueva imagen sobre el mismo nombre.
- **Rename** (renombrar; en la vista previa del personaje) cambia su etiqueta, de hasta 160 caracteres, y conserva su identificador de archivo y su URL, así que las referencias a la imagen que ya existen siguen funcionando.
- **Folder** (carpeta; en la vista previa del personaje) o **Move sprite** (mover sprite; en la miniatura de persona) elige una carpeta, o **No folder** (sin carpeta), sin arrastrar.
- **Delete** (eliminar) quita ese sprite después de que lo confirmes. En el editor de personas, **Delete All** (eliminar todo) seguido del nombre de la categoría quita toda la categoría, aunque haya una búsqueda activa.

### Carpetas y selección

Haz clic en **New folder** (nueva carpeta) para crear una carpeta contraída llamada **unnamed**. Haz doble clic en su nombre, o tócalo dos veces, para cambiarlo, y usa la flecha para expandirla. Las expresiones y los sprites de cuerpo completo tienen carpetas separadas. Las carpetas aparecen encima de los sprites sueltos y se pueden arrastrar para reordenarlas.

Arrastra sprites a una carpeta, o arrastra un sprite archivado al área suelta para quitarlo de su carpeta. En el teléfono, mantén el dedo sobre una miniatura para empezar a arrastrar. Deslizar el dedo normalmente sigue desplazando la vista. Las carpetas solo organizan: nunca eligen un conjunto activo ni ocultan imágenes a los chats o agentes. Eliminar una carpeta deja sus sprites sueltos.

Haz clic en **Select** para mostrar las casillas y **Select all sprites** (seleccionar todos los sprites), y luego arrastra juntos los sprites seleccionados o usa la limpieza y la eliminación. **Cancel** (cancelar) sale del modo de selección. La búsqueda filtra los sprites visibles. Una búsqueda sin resultados no significa que la biblioteca esté vacía.

### Character Sheet

La fila **Character Sheet** del editor de personajes se abre con **Manage** (gestionar). Crea o sube ahí una hoja. Activa **Use as reference image** (usar como imagen de referencia) para que se prefiera para el parecido del personaje.

## Exportar sprites

1. Abre la pestaña **Sprites**.
2. Haz clic en **Export** (exportar) encima de la cuadrícula del personaje, o en el cuadro **Add Sprite** de la persona.
3. Elige **Expressions only** o **Full-body only** para exportar la categoría actual, o **All sprites** para exportarlo todo.

Obtienes un zip con los archivos de los sprites y un `catalog.json` con las etiquetas y las carpetas. Las exportaciones nativas de personajes y personas, y las copias de seguridad del perfil, también conservan esos datos.

## Guías relacionadas

- [Crear y editar personajes](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Roleplay Mode: primeros pasos](../roleplay/getting-started.md)
- [Game Mode: primeros pasos](../game/getting-started.md)
- [Llamadas de audio y video de Conversation](../conversation/calls.md)
- [Expresiones animadas](../media/animated-expressions.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)

## Referencia para desarrolladores: API de sprites y enlaces

`GET /api/sprites/:ownerId` devuelve todos los sprites, archivados o sueltos. `GET /api/sprites/:ownerId/catalog` añade las carpetas y la pertenencia, para las herramientas que importan una carpeta cada vez. Cada sprite tiene un identificador estable `expression`, una `label` editable, un `folderId` y una URL. Usa los ID de carpeta para la pertenencia. El arreglo `folders` es el orden guardado, que el editor muestra al revés para que las carpetas nuevas aparezcan primero. El orden de las carpetas no fija la prioridad ni la disponibilidad para los agentes.

El explorador de recursos del chat muestra las etiquetas editadas, pero inserta enlaces concretos `card://sprites/<ownerId>/<filename>`, que siguen funcionando después de un cambio de nombre. Los enlaces del ámbito del chat como `card://sprites/facial/joy.png` también pueden resolver la etiqueta editada. Un nombre de archivo coincidente existente tiene prioridad.

Los metadatos opcionales que faltan o no se pueden leer no ocultan las imágenes utilizables. Las ediciones rechazan los metadatos dañados en lugar de reemplazarlos. Los listados de solo lectura omiten las bibliotecas inaccesibles, y las rutas de exportación y escritura rechazan los directorios de propietario enlazados.
