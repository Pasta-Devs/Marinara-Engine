# Expresiones animadas

Las expresiones animadas son animaciones cortas en bucle que se usan como sprites (imagen del personaje) de retrato de un personaje. Un sprite es la imagen del personaje de pie que Marinara muestra durante un chat. Un sprite de expresión normal es una imagen fija, como una cara feliz. Una expresión animada se reproduce en su lugar y se guarda como un GIF, un archivo de imagen que reproduce una animación corta en bucle por sí solo.

Marinara crea una en dos pasos. Le pide a una cuenta de **Video Generation** (Generación de video) un clip corto de la expresión y luego convierte el clip en un GIF en bucle en tu computadora. Una vez guardada, funciona como cualquier otro sprite. El agente descargable **Expression Engine** la muestra cuando la escena pide esa emoción. Consulta [Sprites de personaje](../characters/sprites.md) y [Referencia de agentes descargables](../agents/built-in-agents.md).

<a id="before-you-start"></a>

## Antes de empezar

Necesitas dos cosas.

1. Una cuenta de video. Consulta [Generación de video de escena](scene-video.md) para añadir una.
2. ffmpeg en la computadora que ejecuta Marinara. ffmpeg es una herramienta multimedia gratuita que convierte el clip en un GIF.

Si falta ffmpeg, la generación falla de inmediato con este mensaje:

```text
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

Instala ffmpeg de modo que tu sistema pueda encontrarlo, o define la variable de entorno `FFMPEG_PATH` con la ruta completa del programa ffmpeg. Una variable de entorno es un ajuste que le das al servidor antes de que arranque.

## Generar expresiones animadas

Usas la misma ventana que para los sprites fijos.

1. Abre el **Character Editor** (Editor de personaje) de un personaje, o el **Persona Editor** (Editor de persona) de una persona.
2. Abre la pestaña **Sprites** y luego la categoría **Facial Expressions**.
3. Haz clic en **Generate Sprite**. Se abre la ventana **Generate Sprites**.
4. Marca **Generate animated portraits**. La ventana cambia al modo animado. El selector de imagen se convierte en un selector de video, los controles de cuadrícula para las hojas de sprites desaparecen y Marinara crea una expresión a la vez.
5. Elige tu cuenta de video.
6. Rellena **Appearance Description** para que el servicio sepa cómo se ve el personaje.
7. Elige las expresiones que quieres generar.
8. Haz clic en **Generate Animated Portrait** para una expresión, o en **Generate Animated Portraits** para varias.

Mientras se ejecuta, ves "Generating animated portrait GIFs...". Cuando termina, revisa los resultados y haz clic en el botón de guardar para añadirlos al personaje o a la persona. Si una expresión falla, Marinara conserva las que se completaron y muestra la lista de los nombres que fallaron para que puedas reintentarlos.

Las expresiones animadas tardan más que los sprites fijos, porque se crean una a la vez. Empieza con unas pocas.

Con **Expose media prompts before sending** activado (**Settings → Generations → Overall Generations**, Configuración → Generaciones → Generaciones generales), Marinara se detiene para que puedas leer y editar cada prompt (las instrucciones enviadas a la IA) antes de que vaya al servicio.

## Duración y forma

Toda expresión animada es un clip de retrato vertical en 9:16, una forma que no puedes cambiar. Para cambiar cuánto dura cada clip, abre **Settings → Generations**, busca **Video Generation** y define **Animated expression length**. El valor predeterminado es 3 segundos. El rango va de 1 a 8 segundos. Marinara guarda un GIF pequeño en bucle, de 512 píxeles de ancho. Un clip más corto da un archivo más pequeño y un bucle más ajustado.

<a id="backgrounds-are-not-removed"></a>

## Los fondos no se quitan

A los sprites fijos se les puede quitar el fondo para que el personaje flote sobre la escena. Las expresiones animadas se saltan esa limpieza. En el modo animado, la casilla **Prefer clean transparent-style background** solo añade una indicación al prompt de video. Su ayuda dice "GIF transparency is not guaranteed." (La transparencia del GIF no está garantizada). El paso de revisión indica que la limpieza de fondo, el corte de hojas y el recorte de fotogramas se omiten en la salida GIF. Una expresión animada puede conservar un fondo visible. Pide un fondo liso en **Appearance Description** para un aspecto más limpio.

## Solución de problemas

- **La generación falla con un mensaje sobre ffmpeg**: instala ffmpeg o define `FFMPEG_PATH`. Consulta [Antes de empezar](#before-you-start).
- **El selector dice que no se encontraron cuentas de video**: añade una primero. Consulta [Generación de video de escena](scene-video.md).
- **El botón Generate Sprite está desactivado**: en algunos dispositivos, como algunas instalaciones de Android y Termux, Marinara no puede cargar su biblioteca de imágenes. Eso desactiva toda la generación de sprites, incluidas las expresiones animadas.
- **El GIF guardado todavía muestra un fondo**: es lo esperado. Consulta [Los fondos no se quitan](#backgrounds-are-not-removed).

## Guías relacionadas

- [Sprites de personaje](../characters/sprites.md)
- [Generación de video de escena](scene-video.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
