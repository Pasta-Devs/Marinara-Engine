# Expresiones animadas

Esta guía explica las expresiones animadas en Marinara Engine: animaciones cortas en bucle que se usan como sprites (imagen del personaje) de retrato de un personaje. Un sprite es la imagen fija del personaje que Marinara muestra durante un chat. Las expresiones animadas hacen que esos retratos se muevan en lugar de quedarse quietos.

## Qué son las expresiones animadas

Un sprite de expresión normal es una imagen fija, como una cara feliz o una cara enfadada. Una expresión animada es una animación corta en bucle que se reproduce en lugar de esa imagen fija. Marinara guarda cada una como un sprite GIF. Un GIF es un archivo de imagen que reproduce una animación corta en bucle por sí solo.

Marinara crea una expresión animada en dos pasos. Primero le pide a una conexión de **Video Generation** (Generación de video) que cree un clip de video corto de la expresión. Luego convierte ese clip en un sprite GIF en bucle en tu equipo.

Una vez guardada, una expresión animada funciona como cualquier otro sprite. El agente descargable **Expression Engine** la elige y la muestra cuando la escena pide esa emoción. Consulta [Sprites de personaje](../characters/sprites.md) para saber cómo se muestran los sprites, y [Referencia de agentes descargables](../agents/built-in-agents.md) para el Expression Engine.

## Antes de empezar

Necesitas tener dos cosas listas antes de poder generar expresiones animadas.

1. Una conexión de **Video Generation**. Es un enlace guardado a un proveedor que puede crear video. Consulta [Generación de video de escena](scene-video.md) para añadir una.
2. ffmpeg instalado en el equipo donde se ejecuta Marinara. ffmpeg es una herramienta multimedia gratuita que convierte el clip de video en un sprite GIF.

Si no se encuentra ffmpeg, la generación falla de inmediato con este mensaje:

```
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

Para solucionarlo, instala ffmpeg y asegúrate de que tu sistema pueda encontrarlo. También puedes definir la variable de entorno `FFMPEG_PATH` con la ruta completa del programa ffmpeg. Una variable de entorno es un ajuste que le das al servidor antes de que arranque.

## Activar los retratos animados

Generas las expresiones animadas desde la misma ventana que usas para los sprites fijos.

1. Abre el **Character Editor** (Editor de personaje) para tu personaje, o el **Persona Editor** (Editor de persona) para una persona.
2. Ve a la pestaña **Sprites**, y luego a la categoría **Facial Expressions**.
3. Haz clic en **Generate Sprite**. Se abre la ventana **Generate Sprites**.
4. Marca la casilla llamada **Generate animated portraits**. La ventana cambia al modo animado:
   - El selector de conexión cambia de **Image Generation Connection** a **Video Generation Connection**.
   - Los controles de cuadrícula para las hojas de sprites fijos desaparecen.
   - Marinara ahora genera una expresión a la vez en lugar de una hoja completa.
5. Elige tu **Video Generation Connection** en el menú desplegable.
6. Rellena la **Appearance Description** para que el proveedor sepa cómo se ve el personaje.
7. Elige qué expresiones generar.
8. Haz clic en **Generate Animated Portrait** para una expresión, o en **Generate Animated Portraits** para varias.

Mientras se ejecuta, deberías ver el mensaje "Generating animated portrait GIFs...". Cada expresión se convierte primero en un video corto, y luego Marinara lo convierte en un sprite GIF.

Cuando termina la generación, revisa los resultados y haz clic en el botón de guardar para añadirlos al personaje o a la persona. Si una expresión falla, Marinara conserva las que sí se completaron. Muestra la lista de los nombres que fallaron para que puedas reintentarlos.

## Duración y forma

Toda expresión animada es un clip de retrato vertical. La forma está fija en 9:16 (vertical) y no la puedes cambiar.

Puedes cambiar cuánto dura cada clip. Abre **Settings** (Configuración) y busca la sección **Video Generation**. El ajuste se llama **Animated expression length**. Su valor predeterminado es 3 segundos. Puedes definirlo de 1 a 8 segundos.

Marinara guarda el resultado final como un GIF pequeño en bucle, de 512 píxeles de ancho. Un clip más corto da un archivo más pequeño y un bucle más rápido y ajustado.

## Advertencia sobre la transparencia

A los sprites fijos se les puede quitar el fondo para que el personaje flote sobre la escena. Las expresiones animadas son distintas. Marinara no les aplica la limpieza de fondo.

En el modo animado, la casilla de fondo transparente se llama **Prefer clean transparent-style background**. Esta casilla solo añade una pista al prompt (instrucciones enviadas a la IA) de video. Su texto de ayuda lo dice con claridad: "Adds a flat transparent-friendly background instruction to the video prompt. GIF transparency is not guaranteed."

El paso de revisión confirma lo mismo. Muestra esta nota: "Animated portrait sprites are saved as looping GIFs. Static background cleanup, sheet slicing, and frame cropping are skipped for GIF output." Así que una expresión animada puede conservar un fondo visible. Pide un fondo liso en tu **Appearance Description** si quieres un aspecto más limpio.

## Qué esperar

Las expresiones animadas tardan más que los sprites fijos. Marinara las genera una expresión a la vez, no en lote. Elegir muchas expresiones a la vez puede tardar un rato, así que empieza con unas pocas.

Si activaste **Expose media prompts before sending** (en **Settings**, en la sección **Overall Generations** (Generaciones generales)), Marinara se detiene en un paso de revisión del prompt. Puedes leer y editar cada prompt antes de que Marinara lo envíe al proveedor. Deja este ajuste desactivado para saltarte la revisión.

## Solución de problemas

La generación falla con un mensaje sobre ffmpeg. Instala ffmpeg y asegúrate de que el servidor pueda encontrarlo, o define la variable de entorno `FFMPEG_PATH`. Consulta "Antes de empezar" más arriba.

El menú desplegable dice que no se encontraron conexiones de generación de video. Añade primero una conexión de **Video Generation**. Consulta [Generación de video de escena](scene-video.md).

El botón **Generate Sprite** está desactivado. En algunos dispositivos, Marinara no puede cargar su biblioteca de imágenes, lo que apaga toda la generación de sprites, incluidas las expresiones animadas. Esto ocurre en algunas instalaciones de Android y Termux.

El GIF guardado todavía muestra un fondo. Esto es lo esperado. Las expresiones animadas se saltan la limpieza de fondo. Consulta "Advertencia sobre la transparencia" más arriba.

## Guías relacionadas

- [Sprites de personaje](../characters/sprites.md)
- [Generación de video de escena](scene-video.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
