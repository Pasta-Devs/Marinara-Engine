# Card Browser: buscar e importar personajes

Esta guía explica el **Card Browser** (Explorador de tarjetas) de Marinara Engine, la herramienta integrada para encontrar tarjetas de personaje en sitios públicos e importarlas a tu biblioteca. Cubre las fuentes, cómo buscar y filtrar, y cómo funciona el contenido para adultos en cada fuente. También explica cómo importar un personaje o guardarlo como archivo. Las versiones anteriores llamaban a esta pestaña **Bot Browser** o **Browser**.

Una tarjeta de personaje es un archivo que guarda el nombre, la personalidad, el saludo inicial y otros detalles de un personaje. Normalmente descargarías una tarjeta de un sitio web y luego la subirías a Marinara. El **Card Browser** hace ambos pasos por ti en un solo lugar.

## Qué es el Card Browser

El **Card Browser** busca en varios sitios públicos de tarjetas de personaje desde dentro de Marinara. Admite cinco fuentes: **ChubAI**, **JannyAI**, **Pygmalion**, **Wyvern** y **DataCat**. **CharacterTavern** sigue en la lista, pero por ahora no se puede explorar (consulta [CharacterTavern](#charactertavern)). Puedes buscar en una fuente, filtrar los resultados y ver una vista previa con todos los detalles de un personaje. Luego puedes importar ese personaje a tu biblioteca o guardarlo como archivo PNG. No necesitas una cuenta ni una API key (clave de API) para explorar e importar tarjetas de personaje con la configuración predeterminada.

## Abrir el Card Browser

Hay dos formas de abrir el **Card Browser**.

1. Haz clic en el icono de **Card Browser** en la barra superior. Está en la fila de botones de panel del lado derecho.
2. O abre el panel **Card Browser** en la barra lateral derecha y luego haz clic en el botón **Download Cards** (Descargar tarjetas) en la parte de arriba de ese panel.

De cualquier forma, toda el área de contenido cambia a la vista completa del **Card Browser**. Esta vista reemplaza el área de chat. No es una pequeña ventana emergente.

Para salir, haz clic en el botón de flecha hacia atrás en la esquina superior izquierda del encabezado del **Card Browser**. Deberías volver a la pantalla desde la que viniste.

El **Card Browser** se mantiene cargado mientras la app está abierta. Si lo cierras y lo vuelves a abrir, tu última búsqueda, filtros y personaje seleccionado siguen ahí. Si recargas toda la app, se reinicia.

## Elegir una fuente

Haz clic en el botón de fuente en el encabezado. Muestra el nombre de la fuente actual y una pequeña flecha. Se abre un menú con las fuentes en este orden: **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern** y **DataCat**. **CharacterTavern** está marcada como **Unavailable** (No disponible).

**ChubAI** está seleccionada la primera vez que abres el **Card Browser**. Cuando cambias de fuente, se borran tu texto de búsqueda, etiquetas y filtros. Cada fuente recuerda por separado su propia configuración de contenido para adultos y su inicio de sesión, así que un cambio en una fuente no afecta a las demás.

Una nota sobre los nombres: el menú lista **ChubAI**, pero en la página de detalle de un personaje el enlace externo dice **View on Chub**. Ese es el nombre que el sitio se da a sí mismo. Las otras fuentes usan el mismo nombre en ambos lugares.

## CharacterTavern

CharacterTavern rehízo su sitio web y ya no ofrece la conexión que Marinara usaba para buscar y descargar tarjetas. Cuando eliges **CharacterTavern**, el **Card Browser** muestra un aviso breve en lugar de resultados de búsqueda. Es posible que la exploración vuelva si CharacterTavern ofrece acceso a su API.

Hasta entonces, todavía puedes traer a mano personajes de CharacterTavern a Marinara:

1. Haz clic en **Open CharacterTavern** (Abrir CharacterTavern) en el aviso. El sitio se abre en una pestaña nueva.
2. Descarga el archivo de la tarjeta de personaje desde character-tavern.com.
3. Haz clic en **Import Character** (Importar personaje) en el aviso y elige el archivo descargado. Consulta [Importar y exportar tarjetas de personaje](import-export.md).

Los personajes que ya importaste desde CharacterTavern siguen en tu biblioteca.

## Buscar, ordenar y páginas

Escribe en el cuadro **Search characters...** (Buscar personajes...) para buscar. No necesitas pulsar Enter. Marinara espera un momento (alrededor de medio segundo) después de que dejas de escribir y luego busca automáticamente. Vaciar el cuadro o cambiar un filtro también vuelve a buscar.

Junto al cuadro de búsqueda hay un menú desplegable de orden. Las opciones son distintas en cada fuente, y cada fuente empieza con su propio orden predeterminado:

| Fuente          | Orden predeterminado |
| --------------- | --------------- |
| ChubAI          | Most Downloaded |
| JannyAI         | Newest          |
| Pygmalion       | Downloads       |
| Wyvern          | Popular         |
| DataCat         | Relevance       |

Haz clic en el botón **Refresh** (Actualizar, el icono de flecha circular) para ejecutar de nuevo la búsqueda actual.

Debajo de los resultados están los botones **Previous** (Anterior) y **Next** (Siguiente) con una etiqueta de página como **Page 2**. Cuando la fuente no puede informar un total exacto, solo se muestra el número de la página actual.

Una nota sobre **DataCat**: su orden **Fresh** solo muestra resultados nuevos cuando no tienes ningún filtro de etiqueta ni texto de búsqueda. En cuanto escribes una búsqueda o eliges una etiqueta, **DataCat** vuelve a los resultados normales por relevancia.

## Filtrar por etiquetas

Haz clic en el botón **Tags** (Etiquetas) en la barra de herramientas para abrir el panel de etiquetas.

- Escribe en el cuadro **Search tags...** (Buscar etiquetas...) para reducir la lista de etiquetas.
- Haz clic en el visto verde junto a una etiqueta para incluirla. Haz clic en el menos rojo para excluirla. Una etiqueta puede estar incluida o excluida, no ambas.
- Las etiquetas incluidas aparecen como un chip verde. Las etiquetas excluidas aparecen como un chip rojo. Haz clic en cualquier chip para quitarlo.
- El botón **Clear** (Limpiar) elimina todas las etiquetas activas.

En la mayoría de las fuentes, la lista de etiquetas se arma a partir de los personajes de tus búsquedas recientes. Antes de tu primera búsqueda, el panel dice **Tags will appear after searching** (Las etiquetas aparecerán después de buscar). Si una etiqueta que quieres no está en la lista, escribe su nombre. Aparecen dos botones para que puedas añadirla como filtro o bloquearla de los resultados.

**DataCat** funciona de otra manera. Carga las etiquetas más populares de inmediato, porque tiene una lista de etiquetas muy grande. Aun así, puedes escribir a mano cualquier otro nombre de etiqueta.

## Más filtros

Algunas fuentes añaden un botón **Filters** (Filtros) en la barra de herramientas. Solo aparece cuando la fuente tiene filtros que ofrecer, así que no se muestra para **DataCat**. Una pequeña insignia indica cuántos filtros están activos.

El panel de filtros puede incluir:

- Casillas de contenido, como **Lorebook** o **Alt Greetings**, que conservan solo los personajes que tienen esa característica. Un lorebook (libro de trasfondo) es información de fondo adicional que un personaje puede llevar consigo.
- **Sort Direction** (Dirección del orden), ya sea **Descending** o **Ascending**, en **ChubAI** y **Pygmalion**.
- Cuadros numéricos **Min Tokens** y **Max Output Tokens**, que limitan los resultados por tamaño. Si los dejas en blanco, la fuente usa su propio valor predeterminado.
- **JannyAI** tiene un interruptor **Show Low Quality** (Mostrar baja calidad). Está desactivado de forma predeterminada, lo que oculta los personajes que **JannyAI** marcó como de baja calidad. Actívalo para incluirlos.

Nota sobre **Wyvern**: sus casillas **Lorebook** y **Alt Greetings** aparecen, y también sus cuadros **Min Tokens** y **Max Output Tokens**. Ninguno de ellos cambia los resultados de **Wyvern**. Para acotar los resultados de **Wyvern**, usa en su lugar el menú desplegable de orden y las etiquetas.

## Contenido para adultos (NSFW) por fuente

El contenido para adultos se etiqueta como **NSFW** en la app. Hay una sola casilla **NSFW** en la barra de herramientas, pero cada fuente la trata de forma distinta. Esta es la pregunta más común, así que léela con atención.

- **ChubAI** y **JannyAI**: la casilla **NSFW** funciona de inmediato. No hace falta iniciar sesión. Está desactivada de forma predeterminada.
- **Pygmalion**: la casilla **NSFW** está atenuada hasta que inicias sesión. Su tooltip (texto de ayuda) te indica que inicies sesión primero. Después de iniciar sesión, la app sigue la configuración de tu cuenta en Pygmalion. La casilla entonces dice **NSFW depends on your account settings** (El contenido NSFW depende de la configuración de tu cuenta). No hay un interruptor separado de encendido y apagado después de iniciar sesión.
- **Wyvern**: la casilla **NSFW** siempre está atenuada. Un aviso dice **Use "🔞 Popular NSFW" sort for NSFW content** (Usa el orden "🔞 Popular NSFW" para contenido NSFW). Para ver contenido para adultos en **Wyvern**, elige la opción **🔞 Popular NSFW** en el menú desplegable de orden.
- **DataCat**: todos los personajes están etiquetados como para adultos, así que la casilla queda bloqueada en activado. La primera vez que eliges **DataCat**, aparece una ventana titulada **DataCat is NSFW only** (DataCat es solo NSFW). Haz clic en **Continue to DataCat** para explorarla, o en **Don't continue to DataCat** para volver atrás.

Los personajes para adultos muestran una pequeña insignia roja **NSFW** en la esquina de su miniatura.

## Iniciar sesión en Pygmalion

**Pygmalion** oculta su contenido para adultos detrás de un inicio de sesión. No necesitas iniciar sesión para los personajes normales y públicos. Iniciar sesión solo desbloquea el contenido para adultos.

Para iniciar sesión, haz clic en el botón **Log In** (Iniciar sesión) en la barra de herramientas. Se abre una ventana de inicio de sesión. Pegas un valor copiado desde tu propia cuenta de Pygmalion. Marinara no te pide tu contraseña.

Para **Pygmalion**, la ventana se titula **Pygmalion Authentication** y pide un **Auth Token**:

1. Ve a pygmalion.chat e inicia sesión en tu cuenta.
2. Abre las herramientas de desarrollo de tu navegador. En la mayoría de los navegadores pulsas la tecla F12. Las herramientas de desarrollo son un panel integrado del navegador para usuarios avanzados.
3. Abre la pestaña **Application**, luego **Local Storage**.
4. Busca la entrada llamada `authn` y copia su valor.
5. Pega el valor en el cuadro **Auth Token** de Marinara. El cuadro oculta lo que pegas.
6. Haz clic en **Save & Connect** (Guardar y conectar). Deberías ver un mensaje de que el contenido NSFW está activado.

La ventana tiene una sección de ayuda que repite estos pasos y un enlace **Website** que abre pygmalion.chat.

Este es el inicio de sesión de tu cuenta de Pygmalion. Marinara lo mantiene en memoria hasta un reinicio o hasta que hagas clic en **Log Out** (Cerrar sesión). Para cerrar sesión, abre de nuevo la ventana de inicio de sesión y haz clic en **Log Out**. Para cerrar sesión por completo, cierra sesión también en pygmalion.chat.

Marinara comprueba el token con Pygmalion antes de conservarlo. Si Pygmalion no lo acepta, no se guarda nada y un mensaje explica por qué. Si Pygmalion deja de aceptarlo más adelante, Marinara cierra tu sesión y te pide que inicies sesión otra vez.

Importante: este inicio de sesión se mantiene solo en la memoria del servidor. Nunca se guarda en un archivo. Si reinicias el servidor de Marinara, se cierra tu sesión y debes pegar el token de nuevo. Marinara muestra un mensaje que te dice que inicies sesión otra vez cuando esto ocurre.

## Revisar un personaje antes de importar

Haz clic en cualquier tarjeta de resultado para abrir su vista de detalle. Usa **Back to results** (Volver a los resultados) para regresar.

La vista de detalle muestra el avatar del personaje, su nombre, su creador, un lema corto y hasta veinte chips de etiqueta. También tiene un enlace **View on** que abre la página original del personaje en una pestaña nueva.

Debajo están los detalles completos del personaje, que se muestran solo cuando la fuente los proporciona. Estas secciones usan encabezados como **Creator's Notes**, **Personality**, **Scenario**, **First Message** y **Alternate Greetings**. Aparece una insignia ámbar **Has embedded lorebook** (Tiene lorebook incrustado) cuando el personaje lleva un lorebook.

Algunas fuentes no siempre devuelven los detalles completos. Si no se carga nada, la vista dice que aún puedes importar el personaje con su información básica.

## Importar o descargar un personaje

La vista de detalle te da dos botones. **Import** (Importar) añade el personaje a tu biblioteca de Marinara. **Download as PNG** (Descargar como PNG) guarda el personaje como un archivo en tu dispositivo sin añadirlo a tu biblioteca.

Para importar tarjetas de personaje a tu biblioteca:

1. Abre la vista de detalle de un personaje.
2. Elige una opción de **Imported tags** (Etiquetas importadas) (ver la tabla de abajo).
3. Haz clic en **Import**. El botón muestra **Importing...** (Importando...) mientras trabaja.
4. Espera el mensaje de éxito. Deberías ver un mensaje de que el personaje se importó.
5. Abre el panel **Characters** (Personajes) para encontrar el personaje importado antes de empezar un chat.

El personaje importado se comporta como cualquier otro personaje. Para chatear de verdad con él, todavía necesitas una conexión de proveedor que funcione. Consulta [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md).

### Imported tags

El panel **Imported tags** junto al avatar controla qué etiquetas vienen con el personaje. El valor predeterminado es **All tags**.

| Opción        | Qué hace                                 |
| ------------- | -------------------------------------------- |
| All tags      | Conserva las etiquetas de la fuente.                     |
| No tags       | Omite las etiquetas de la fuente.                     |
| Existing only | Conserva solo las etiquetas que ya usas en Marinara. |

### Aviso de lorebook incrustado

Si el personaje lleva un lorebook incrustado, al importarlo aparece un pequeño cuadro de confirmación de tu navegador web. Te pregunta si también quieres guardar el lorebook como un lorebook de Marinara separado e independiente. Haz clic en **OK** para crear el lorebook separado más la copia adjunta al personaje. Haz clic en **Cancel** para mantener el lorebook adjunto solo al personaje.

### Download as PNG

Haz clic en **Download as PNG** para guardar el personaje como un archivo de tarjeta de personaje PNG estándar. El botón muestra **Building PNG...** (Creando PNG...) mientras trabaja. Esto funciona en todas las fuentes. El archivo guardado lleva el nombre del personaje, por ejemplo `Some_Character.png`. Puedes compartir este archivo o importarlo a otra app más adelante.

JSON y PNG son dos formatos comunes para los mismos datos de personaje. JSON es un formato de texto plano. Una tarjeta PNG es un archivo de imagen con los datos del personaje guardados dentro. Ambos contienen el personaje completo.

## Tus personajes importados

El panel **Card Browser** en la barra lateral derecha mantiene una lista separada de los personajes que importaste a través del **Card Browser**. Los personajes que hiciste a mano o importaste de otra manera no aparecen aquí. Todos ellos siguen apareciendo en la biblioteca principal **Characters**.

- El botón **Download Cards** abre la vista completa del **Card Browser**.
- El cuadro **Search imported...** (Buscar importados...) filtra esta lista.
- El menú desplegable de orden ofrece **A-Z**, **Z-A**, **Newest** y **Oldest**.
- Haz clic derecho en una fila, o usa sus botones, para encontrar **Quick Start Roleplay** y **Quick Start Conversation**. Estos abren un chat nuevo con ese personaje. También puedes eliminar el personaje de esta lista aquí.

## Solución de problemas

**La búsqueda o los detalles de JannyAI fallan con un error de Cloudflare.** Algunos sitios bloquean las solicitudes automatizadas. Visita jannyai.com una vez en el mismo navegador web, pasa cualquier desafío que muestre y luego vuelve a Marinara y busca de nuevo.

**Mi inicio de sesión de Pygmalion dejó de funcionar.** Reiniciar el servidor de Marinara borra este inicio de sesión. Abre de nuevo la ventana **Log In** y pega tu token una vez más.

**CharacterTavern solo muestra un aviso.** Eso es lo esperado. Consulta [CharacterTavern](#charactertavern) para ver cómo importar sus tarjetas como archivos.

**Una búsqueda falla o una fuente deja de funcionar.** Los sitios públicos pueden cambiar sus páginas o bloquear el acceso en cualquier momento. Inténtalo de nuevo más tarde. Si una fuente sigue fallando, abre el personaje en el sitio directamente y descarga la tarjeta tú mismo. Luego tráela a través del flujo de importación normal. Consulta [Importar y exportar tarjetas de personaje](import-export.md).

## Guías relacionadas

- [Importar y exportar tarjetas de personaje](import-export.md)
- [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Solución de problemas](../TROUBLESHOOTING.md)
