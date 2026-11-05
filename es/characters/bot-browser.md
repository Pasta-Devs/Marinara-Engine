# Card Browser: buscar e importar personajes

El **Card Browser** (Explorador de tarjetas) busca tarjetas de personaje en sitios públicos y las importa a tu biblioteca desde dentro de Marinara, así que no tienes que descargar y subir archivos a mano. Las versiones anteriores lo llamaban **Bot Browser** o **Browser**.

Una tarjeta de personaje es un archivo que guarda el nombre, la personalidad, el saludo inicial y otros detalles de un personaje. No necesitas una cuenta ni una API key (clave de API) para explorar e importar con la configuración predeterminada.

## Abrir el Card Browser

1. Haz clic en **Characters** (Personajes) o **Personas** en la barra de navegación superior. Si no los ves, abre primero **More** (Más).
2. Haz clic en el botón **Download** (Descargar) de la parte de arriba. Su tooltip dice **Download character cards** (Descargar tarjetas de personaje).

El Card Browser ocupa toda el área de contenido, con el título **Browse character cards online** (Explorar tarjetas de personaje en línea). Para salir, haz clic en la flecha hacia atrás de la esquina superior izquierda.

Si lo cierras y lo vuelves a abrir, tu última búsqueda, tus filtros y el personaje seleccionado siguen ahí. Al recargar la app se reinician.

## Elegir una fuente

Haz clic en el botón de fuente del encabezado. El menú muestra, en este orden: **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern**, **DataCat**, **PlotLight** y **PlotLight Personas** (Personas de PlotLight). **ChubAI** está seleccionada la primera vez. Cambiar de fuente borra tu texto de búsqueda, tus etiquetas y tus filtros. Cada fuente conserva su propia configuración de contenido para adultos y su propio inicio de sesión.

| Fuente | Contenido para adultos (NSFW) |
| --- | --- |
| **ChubAI** | La casilla **NSFW** funciona. Desactivada de forma predeterminada. |
| **JannyAI** | La casilla **NSFW** funciona. Desactivada de forma predeterminada. |
| **Pygmalion** | Atenuada hasta que [inicies sesión](#log-in-to-pygmalion). Después sigue la configuración de tu cuenta de Pygmalion. |
| **Wyvern** | Siempre atenuada. Elige en su lugar el orden **🔞 Popular NSFW**. |
| **DataCat** | Todas las tarjetas están etiquetadas como para adultos, así que la casilla queda bloqueada en activado. |
| **PlotLight** y **PlotLight Personas** | Siempre atenuada. PlotLight aplica sus propias reglas. Los resultados etiquetados como para adultos llevan una insignia **NSFW**. |

¿No sabes por dónde empezar? Usa **ChubAI**, la primera fuente. Cada fuente empieza con su propio orden, y puedes cambiarlo en el menú desplegable de orden.

Las tarjetas para adultos muestran una pequeña insignia roja **NSFW** en su miniatura. El menú dice **ChubAI**, pero el enlace externo de una tarjeta dice **View on Chub** (Ver en Chub), que es el nombre propio del sitio.

### DataCat

La primera vez que eliges **DataCat**, aparece un cuadro de diálogo titulado **DataCat is NSFW only** (DataCat es solo NSFW). Haz clic en **Continue to DataCat** (Continuar a DataCat) para explorar, o en **Don't continue to DataCat** (No continuar a DataCat) para volver atrás. Su orden **Fresh** solo muestra resultados nuevos cuando no tienes ningún filtro de etiqueta ni texto de búsqueda.

### CharacterTavern

CharacterTavern rehízo su sitio y ya no ofrece la conexión que Marinara usaba. Cuando la eliges, un aviso reemplaza los resultados. Es posible que la exploración vuelva si CharacterTavern ofrece acceso a su API. Hasta entonces, importa sus tarjetas a mano:

1. Haz clic en **Open CharacterTavern** (Abrir CharacterTavern) en el aviso. El sitio se abre en una pestaña nueva.
2. Descarga el archivo de la tarjeta desde character-tavern.com.
3. Haz clic en **Import Character** (Importar personaje) en el aviso y elige el archivo. Consulta [Importar y exportar tarjetas de personaje](import-export.md).

Los personajes que ya importaste desde CharacterTavern siguen en tu biblioteca.

### PlotLight

PlotLight comparte personajes y personas públicos. **PlotLight** muestra tarjetas de personaje. **PlotLight Personas** muestra personas, los personajes que te representan en los chats. No necesitas una cuenta de PlotLight. La vista de detalle tiene un enlace **View on PlotLight** (Ver en PlotLight) a la página original.

Marinara descarga el archivo que ofrece PlotLight. Una tarjeta de personaje suele venir como un PNG con su retrato y cualquier lorebook (libro de trasfondo) que su creador permita. Una persona viene como un archivo de texto, y Marinara copia su imagen por separado. Puedes importar cualquiera de los dos tipos como personaje o como persona.

PlotLight limita la frecuencia con la que las apps pueden pedirle cosas. Si vas demasiado rápido, Marinara dice **PlotLight is busy** (PlotLight está ocupado) con un número de segundos, y espera ese tiempo. La búsqueda y la importación tienen límites separados.

Algunas tarjetas no se pueden descargar, por ejemplo cuando su creador no lo permite. Marinara dice entonces **PlotLight doesn't offer this for download.** (PlotLight no ofrece esto para descargar). No puedes importar esa tarjeta ni ver sus detalles, pero su imagen, su creador y el enlace **View on PlotLight** se mantienen.

## Buscar, ordenar y páginas

Escribe en **Search characters** (Buscar personajes). No necesitas pulsar <kbd>Enter</kbd>. Marinara busca un momento después de que dejas de escribir, y de nuevo cuando vacías el cuadro o cambias un filtro. Cada fuente tiene su propio menú desplegable de orden. Haz clic en el botón **Refresh** (Actualizar, la flecha circular) para ejecutar de nuevo la búsqueda.

Debajo de los resultados están **Previous** (Anterior) y **Next** (Siguiente) con una etiqueta como **Page 2**. Cuando una fuente no puede informar un total, solo se muestra la página actual. **PlotLight** nunca informa un total, así que el encabezado dice **Browsing PlotLight** (Explorando PlotLight). Una página de PlotLight puede tener pocas tarjetas, o ninguna, y aun así tener más páginas. **Next** sigue activado, para que puedas continuar.

## Filtrar por etiquetas

1. Haz clic en **Tags** (Etiquetas) en la barra de herramientas.
2. Escribe en **Search tags** (Buscar etiquetas) para reducir la lista.
3. Haz clic en el visto verde junto a una etiqueta para incluirla, o en el menos rojo para excluirla. Una etiqueta no puede estar en ambos estados.
4. Haz clic en un chip para quitar esa etiqueta, o en **Clear** (Limpiar) para quitarlas todas.

En la mayoría de las fuentes, la lista se arma a partir de los personajes de tus búsquedas recientes. Antes de tu primera búsqueda, el panel dice **Tags will appear after searching** (Las etiquetas aparecerán después de buscar). Si una etiqueta que quieres no está en la lista, escribe su nombre. Aparecen dos botones: uno la añade como filtro y el otro la bloquea. **DataCat** carga sus etiquetas más populares de inmediato, y aun así puedes escribir otras. En **PlotLight**, Marinara busca la etiqueta escrita en la propia lista de PlotLight, y una etiqueta que PlotLight no tiene no coincide con nada.

## Más filtros

La mayoría de las fuentes añaden un botón **Filters** (Filtros) con una insignia que cuenta los filtros activos. No aparece para **DataCat** ni **PlotLight**. El panel puede incluir:

- Casillas de contenido, como **Lorebook** o **Alt Greetings**, que conservan solo los personajes que tienen esa característica. Un lorebook es información de fondo adicional que lleva un personaje.
- **Sort Direction** (Dirección del orden), **Descending** o **Ascending**, en **ChubAI** y **Pygmalion**.
- Cuadros **Min Tokens** y **Max Output Tokens**, que limitan los resultados por tamaño. Déjalos en blanco para usar el valor predeterminado de la fuente.
- Un interruptor **Show Low Quality** (Mostrar baja calidad) en **JannyAI**. Está desactivado, lo que oculta las tarjetas que JannyAI marcó como de baja calidad.

En **Wyvern**, las casillas **Lorebook** y **Alt Greetings** y los cuadros de tokens aparecen, pero no cambian los resultados. Usa en su lugar el menú desplegable de orden y las etiquetas.

## Revisar un personaje

Haz clic en un resultado para abrir su vista de detalle. **Back to results** (Volver a los resultados) regresa a la lista.

La vista de detalle muestra el avatar, el nombre, el creador, un lema corto, hasta veinte chips de etiqueta y un enlace **View on** a la página original. Debajo están los detalles completos cuando la fuente los proporciona, con encabezados como **Creator's Notes**, **Personality**, **Scenario**, **First Message** y **Alternate Greetings**. Aparece una insignia ámbar **Has embedded lorebook** (Tiene lorebook incrustado) cuando la tarjeta lleva un lorebook. Si una fuente no devuelve detalles, la vista dice que aun así puedes importar con la información básica.

## Importar un personaje

Antes de empezar: para chatear con el personaje necesitarás una conexión de texto que funcione. Consulta [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md).

1. Abre la vista de detalle de un personaje.
2. Elige una opción de **Imported tags** (Etiquetas importadas) junto al avatar. El valor predeterminado es **All tags**. Consulta [Opciones de importación](import-export.md#import-options).
3. Haz clic en **Import** (Importar). Se abre una ventana **Import Card** (Importar tarjeta) que pregunta **Where should this card live?** (¿Dónde debe guardarse esta tarjeta?).
4. Opcionalmente, marca **Split description into fields** (Dividir la descripción en campos). Consulta [Opciones de importación](import-export.md#import-options).
5. Haz clic en **Import as Character** (Importar como personaje) para añadirla a **Characters**, o en **Import as Persona** (Importar como persona) para añadirla a **Personas**.
6. Si la tarjeta tiene un lorebook incrustado, un panel **Embedded lorebook found** (Lorebook incrustado encontrado) muestra cuántas entradas tiene. Haz clic en **Import Lorebook** (Importar lorebook) para crear además un lorebook independiente, o en **No Import** (No importar) para mantenerlo solo dentro de la tarjeta. **Back** (Atrás) vuelve al paso 5.
7. Espera mientras el botón muestra **Importing...** (Importando...). Un mensaje dice `Imported "Name" successfully!`
8. Abre **Characters** (o **Personas**) para encontrarlo.

Si no funcionó: lee el mensaje de error del aviso emergente. En **JannyAI**, un bloqueo de Cloudflare es la causa más común (consulta Solución de problemas más abajo).

### Download as PNG

Haz clic en **Download as PNG** (Descargar como PNG) en la vista de detalle para guardar la tarjeta en tu dispositivo como una tarjeta de personaje PNG estándar, sin añadirla a tu biblioteca. El botón muestra **Building PNG...** (Creando PNG...) mientras trabaja. Funciona en todas las fuentes, y el archivo lleva el nombre del personaje, como `Some_Character.png`. Una tarjeta PNG es una imagen con los datos del personaje guardados dentro. Puedes compartirla o importarla a otra app.

## Solución de problemas

| Problema | Solución |
| --- | --- |
| La búsqueda o los detalles de **JannyAI** fallan con un error que menciona Cloudflare (una comprobación de seguridad que bloquea las solicitudes automáticas), o la definición completa de la tarjeta está bloqueada. | Visita jannyai.com una vez en el mismo navegador y pasa cualquier desafío. Luego busca de nuevo. Si la tarjeta sigue bloqueada, ábrela en JannyAI, descarga su PNG e importa ese archivo. |
| Mi inicio de sesión de Pygmalion dejó de funcionar. | Reiniciar el servidor lo borra. Vuelve a iniciar sesión con un token nuevo. |
| **CharacterTavern** solo muestra un aviso. | Es lo esperado. Consulta [CharacterTavern](#charactertavern). |
| **PlotLight is busy.** | Espera los segundos que indica el mensaje y luego inténtalo de nuevo. |
| **PlotLight doesn't offer this for download.** | Puede que el creador no permita las descargas, o que la tarjeta ya no sea pública. Usa **View on PlotLight** para comprobarlo. |
| Una búsqueda falla o una fuente deja de funcionar. | Los sitios públicos cambian o bloquean el acceso en cualquier momento. Inténtalo más tarde, o descarga la tarjeta desde el sitio y usa la importación normal. Consulta [Importar y exportar tarjetas de personaje](import-export.md). |

<a id="log-in-to-pygmalion"></a>

## Iniciar sesión en Pygmalion

Pygmalion oculta su contenido para adultos detrás de un inicio de sesión. Los personajes públicos no necesitan inicio de sesión. Marinara nunca te pide tu contraseña. Pegas un valor copiado desde tu propia cuenta.

1. Haz clic en **Log In** (Iniciar sesión) en la barra de herramientas. Se abre la ventana **Pygmalion Authentication** (Autenticación de Pygmalion).
2. Ve a pygmalion.chat en tu navegador e inicia sesión.
3. Abre las herramientas de desarrollo de tu navegador, un panel integrado para usuarios avanzados. En la mayoría de los navegadores de computadora, pulsa <kbd>F12</kbd>. Los navegadores de teléfono normalmente no tienen estas herramientas, así que usa una computadora para este paso.
4. Abre la pestaña **Application** y luego **Local Storage**.
5. Busca la entrada llamada `authn` y copia su valor.
6. Pégalo en **Auth Token** en Marinara. El cuadro oculta lo que pegas.
7. Haz clic en **Save & Connect** (Guardar y conectar). Un mensaje dice que el contenido NSFW está activado.

La ventana tiene una sección de ayuda que repite estos pasos y un enlace **Website** (Sitio web) a pygmalion.chat.

Marinara comprueba primero el token con Pygmalion. Si Pygmalion lo rechaza, no se guarda nada y un mensaje explica por qué. Si Pygmalion deja de aceptarlo más adelante, Marinara cierra tu sesión y te pide que inicies sesión otra vez.

El inicio de sesión se mantiene solo en la memoria del servidor. Nunca se guarda en un archivo, así que reiniciar el servidor de Marinara cierra tu sesión. Para cerrar la sesión por tu cuenta, abre de nuevo la ventana y haz clic en **Log Out** (Cerrar sesión). Para cerrar sesión por completo, cierra sesión también en pygmalion.chat.

## Guías relacionadas

- [Importar y exportar tarjetas de personaje](import-export.md)
- [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Solución de problemas](../TROUBLESHOOTING.md)
