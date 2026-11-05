# Fuentes personalizadas y Google Fonts

Cambia la fuente que Marinara usa en toda la app. Elige la fuente incorporada, añade tus propios archivos de fuente o descarga una fuente de Google Fonts por su nombre.

## Elegir una fuente para la app

1. Abre **Settings** (Configuración) y haz clic en la pestaña **Appearance** (Apariencia) y luego en el botón **App**.
2. Busca la sección **Text & Scale** (Texto y escala).
3. Abre el menú desplegable **Font** (Fuente) y elige una fuente.

La forma más fácil de conseguir una fuente nueva es [Google Fonts](#downloading-from-google-fonts). La opción predeterminada es **Default (Inter)**, una fuente limpia elegida para leer en pantalla. Las fuentes que añades aparecen en el mismo menú desplegable, debajo de ella.

Tu elección de fuente se sincroniza entre dispositivos. Cada navegador conectado al mismo servidor de Marinara cambia a ella. Consulta [Resumen de Settings](../settings/settings-overview.md).

Los widgets del chat tienen una opción **Font** aparte en **Chat widget style** (Estilo de widgets del chat). Activa allí **Apply preset font** (Aplicar fuente del preset) para usarla también en los mensajes, los campos de entrada y los controles del chat. Consulta [Estilos de ventanas de chat listos para usar](custom-css-themes.md#ready-made-chat-window-styles).

## Añadir tus propias fuentes

Antes de empezar: las fuentes van en una carpeta del servidor. El servidor es la computadora que ejecuta Marinara. Si ejecutas Marinara en tu propia computadora, esa es el servidor, y la carpeta de datos es donde Marinara guarda tus datos.

1. Haz clic en **Open Fonts Folder** (Abrir carpeta de fuentes), junto al menú desplegable **Font**, para abrir `data/fonts/` en el servidor. O busca tú mismo la carpeta `data/fonts/` en la carpeta de datos de Marinara.
2. Copia tu archivo de fuente en ella.
3. Ve a **Settings → Appearance → App → Text & Scale** (Configuración → Apariencia → App → Texto y escala).
4. Abre el menú desplegable **Font**. Tu fuente está en la lista.
5. Selecciónala. El texto de la app cambia al instante.

Marinara lee archivos `.ttf`, `.otf`, `.woff` y `.woff2` e ignora los demás tipos. Crea el nombre visible a partir del nombre del archivo, así que `OpenSans-Bold.ttf` aparece como "Open Sans". Nombra tus archivos de forma clara para tener una lista ordenada.

Cada dispositivo que se conecta al mismo servidor puede usar las fuentes de `data/fonts/`.

Si no funcionó: revisa el tipo de archivo y que el archivo esté en `data/fonts/` en el servidor, no en el dispositivo desde el que estás viendo Marinara.

<a id="downloading-from-google-fonts"></a>

## Descargar desde Google Fonts

El servidor necesita acceso a internet para esto.

1. Ve a **Settings → Appearance → App → Text & Scale**.
2. En el campo **Google Fonts**, escribe el nombre exacto de la fuente, por ejemplo `Fira Code` o `Lora`.
3. Haz clic en **Add** (Añadir).
4. Espera a que termine la descarga. La fuente aparece entonces en el menú desplegable **Font**.

El enlace **Browse fonts at fonts.google.com →** (Explorar fuentes en fonts.google.com →) junto al campo abre el sitio de Google Fonts para que puedas buscar nombres. El nombre solo puede usar letras, números y espacios. Si descargas la misma fuente otra vez, se reemplaza la copia antigua.

Si no funcionó, lee el mensaje de error.

- Si Marinara no puede acceder a Google Fonts, revisa tu conexión a internet.
- Si dice que la fuente no se encontró, revisa la ortografía y comprueba en el sitio de Google Fonts que la fuente tenga un estilo Regular (400). Marinara descarga solo ese grosor.

## Open Fonts Folder

El botón **Open Fonts Folder** junto al menú desplegable **Font** abre `data/fonts/` en el explorador de archivos de la computadora del servidor, no en el dispositivo que estás usando. Si ejecutas Marinara en tu propia computadora, te abre la carpeta. Desde un teléfono o una segunda computadora, copia tú mismo tus archivos de fuente en la carpeta `data/fonts/` del servidor.

Mientras está seleccionada la fuente predeterminada, los campos de prompt del editor de presets y el Example Dialogue de un personaje usan una fuente monoespaciada. Cualquier otra fuente también se aplica a ellos. Otros campos de prompt, como la plantilla de prompt de un agente, siguen siendo monoespaciados.

## Guías relacionadas

- [Ajustes de apariencia](appearance-settings.md)
