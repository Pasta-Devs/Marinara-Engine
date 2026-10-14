# Avatares 2D y 3D

Dos agentes descargables les dan a tus personajes y personas (una persona es el perfil que te representa en el chat) un avatar animado que reacciona mientras una respuesta llega en streaming. **2D Avatars** (Avatares 2D) muestra sprites (imágenes del personaje) al estilo PNGTuber o avatares de malla, y **3D Avatars** (Avatares 3D) muestra modelos VRM. Las caras siguen la respuesta, y las bocas se mueven con el texto o con el texto a voz.

Esta función todavía está en desarrollo. Las secciones de abajo se completan a medida que cada parte llega a `staging`.

Los modelos Live2D no son compatibles. La licencia de Live2D exige un acuerdo aparte con Live2D incluso para apps gratuitas de código abierto, y su entorno de ejecución no se puede incluir con Marinara Engine.

## Descargar los agentes

Los dos agentes están en pruebas. Por ahora, **Download Agents** (Descargar agentes) solo los ofrece cuando Marinara Engine se ejecuta en la rama `staging`.

**2D Avatars** y **3D Avatars** se descargan por separado, así que puedes instalar solo el que quieras. Los dos funcionan para personajes y personas en chats de Roleplay y Game.

1. Abre **Agents → Download Agents** (Agentes → Descargar agentes) e instala **2D Avatars**, **3D Avatars** o los dos. Ninguno necesita reiniciar.
2. Configura cada avatar en la página del agente en **Agents**. Consulta [Configurar un avatar](#setting-up-an-avatar).
3. En un chat de Roleplay o Game, abre **Chat Settings → Agents → Misc Agents** (Ajustes del chat → Agentes → Agentes varios) y añade el agente.

Los agentes no envían solicitudes adicionales a tus conexiones de IA mientras chateas. Necesitan un Engine con Capability API 1.73, y un Engine más antiguo se niega a instalarlos.

<a id="setting-up-an-avatar"></a>

## Configurar un avatar

Los avatares se configuran en la página propia de cada agente. Abre **Agents**, abre **2D Avatars** o **3D Avatars** y usa la sección **Avatars** (Avatares) cerca de la parte de arriba.

1. En **Character or persona** (Personaje o persona), elige quién recibe el avatar. Los nombres marcados con "(has an avatar)" ya tienen uno guardado.
2. En **Avatar type** (Tipo de avatar), elige el tipo que quieres configurar. 2D Avatars ofrece **PNGTuber sprites** (Sprites PNGTuber) y **Mesh avatar** (Avatar de malla). 3D Avatars ofrece **VRM model** (Modelo VRM).
3. Configúralo en la sección propia de ese tipo, debajo de los selectores: usa tus sprites o importa un archivo, elige la cara para cada emoción, o quítalo. Consulta [Avatares 2D](#2d-avatars-pngtuber-sprites-and-mesh-avatars) y [Avatares 3D](#3d-avatars-vrm-models).
4. Usa **Preview** (Vista previa) para verlo. **Try a face** (Probar una cara) cambia de emoción y **Talk** (Hablar) mueve la boca. Cuando todavía no hay nada que mostrar, la vista previa muestra un avatar de ejemplo.

Un personaje o una persona con sprites de expresión ya tiene un avatar PNGTuber en la página de 2D Avatars, así que los chats con 2D Avatars activado lo muestran sin guardar nada.

**Show this avatar in chats** (Mostrar este avatar en los chats) activa o desactiva el avatar sin borrarlo. **Movement** (Movimiento) tiene tres interruptores que se aplican a todos los tipos: **Lip sync** (Sincronización labial) mueve la boca, **Blinking** (Parpadeo) hace parpadear al avatar cada pocos segundos, y **Idle motion** (Movimiento en reposo) hace que respire y se balancee mientras espera. Si un personaje tiene más de un tipo de avatar, **Show this one** (Mostrar este) elige el tipo que usan los chats. Cuando el agente de ese tipo está desactivado en un chat, el chat muestra otro tipo cuyo agente está activado. Quitar un tipo borra sus archivos; tus sprites se quedan, y un avatar que desactivaste sigue desactivado.

Un avatar se muestra en un chat de Roleplay, de novela visual o de Game cuando el chat tiene los agentes activados y el agente correspondiente añadido. Funciona con o sin el agente Expression Engine. El avatar no oculta el sprite de cuerpo completo, así que desactívalo tú si el avatar lo reemplaza. Los avatares se colocan donde iría el sprite de cuerpo completo y comparten su tamaño. Para moverlos, usa el modo **Arrange** (Organizar) de los sprites en los ajustes de sprites del Expression Engine.

Los archivos importados se comprueban antes de guardarse, y no hay un límite de tamaño propio de los avatares por debajo del límite de subida normal del servidor. Los archivos de avatar están en la carpeta de datos, en `avatar-models/<character or persona>/<id>/`, junto a un `avatar.json` con los ajustes. Las copias de seguridad y las exportaciones de perfil incluyen esta carpeta. Borrar un personaje o una persona borra su avatar, también cuando la Danger Zone de la configuración borra todos los **Characters** (Personajes) o todas las **Personas**, y borrar **Media & Assets** (Multimedia y recursos) allí vacía la carpeta. Las exportaciones de tarjetas de personaje nunca incluyen avatares.

<a id="2d-avatars-pngtuber-sprites-and-mesh-avatars"></a>

## Avatares 2D: sprites PNGTuber y avatares de malla

**2D Avatars** muestra uno de dos tipos de avatar: **sprites PNGTuber**, imágenes planas que cambian de cara, abren la boca y parpadean, y **avatares de malla**, dibujos que mueven la cabeza, los ojos y la boca con suavidad. Configura los dos en la página del agente en el editor de agentes, después de elegir un personaje o una persona.

<a id="pngtuber-sprites"></a>

### Sprites PNGTuber

Un personaje o una persona con sprites de expresión ya tiene un avatar PNGTuber: sus sprites son las caras, sin nada que configurar. Se usan los sprites de retrato cuando los hay, y si no, los de cuerpo completo, así que un avatar nunca mezcla los dos.

- **Imágenes para hablar y parpadear.** Añade sprites con el nombre de una cara y `_talk` para la boca abierta y `_blink` para los ojos cerrados, por ejemplo `happy_talk` y `happy_blink`, y `happy_blink_talk` para las dos cosas. También funcionan `_talking`, `_speak`, `_mouth_open`, `_blinking` y `_eyes_closed`. Una cara sin ellas sigue dando saltitos mientras habla.
- **Face for each feeling (Cara para cada emoción).** Elige qué cara se muestra para Neutral, Happy, Angry, Sad, Relaxed y Surprised (neutral, feliz, enojado, triste, relajado y sorprendido). **Resting face** (Cara en reposo) usa la cara Neutral. Cuando el agente Expression Engine o el Game Master eligen un sprite que tienes, se muestra exactamente esa cara.
- **Movement.** **Hop while talking** (Saltar al hablar) y **Hop height** (Altura del salto) ajustan el rebote al estilo PNGTuber. **Time between blinks** (Tiempo entre parpadeos) es el promedio; cada parpadeo llega un poco antes o un poco después, así que nunca parece mecánico. Con el movimiento reducido activado en tu dispositivo, el avatar no salta ni respira, pero su cara y su boca siguen cambiando.
- **Use my sprites** (Usar mis sprites) guarda los sprites como las caras del avatar. Elegir una cara o cambiar el movimiento también lo guarda. **Update from sprites** (Actualizar desde los sprites) toma los sprites que añadiste después y conserva las caras que elegiste para cada emoción. Después de una importación, elige **Remove** (Quitar) para volver a tus sprites.

**Import PNGTuber Plus save** (Importar guardado de PNGTuber Plus) lee un avatar guardado por [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) (un archivo `.save`). Cada disfraz (costume) se convierte en una cara, y sus capas para hablar y parpadear se convierten en las imágenes para hablar y parpadear. Los disfraces se asignan a las emociones por los nombres de las imágenes que muestran, como `angry eyes.png`. Elige una cara para cualquier emoción que los nombres no cubrieron. Algunas cosas no se transfieren:

- El bamboleo, el arrastre, la rotación y el estiramiento no se importan; el avatar muestra cada capa en reposo.
- Las capas animadas solo muestran su primer fotograma.
- Los guardados muy antiguos solo conservan las rutas de sus imágenes en la computadora de quien los creó. Primero, guárdalos de nuevo con una versión más reciente de PNGTuber Plus.
- Un avatar muy grande se reduce a 2048 píxeles para que los teléfonos puedan cargar todas las imágenes.

Importar un guardado necesita procesamiento de imágenes en el servidor. Algunas instalaciones de Android (Termux) no lo tienen, así que ahí la importación se rechaza con un mensaje que lo explica.

### Avatares de malla

Un avatar de malla es un archivo `.mavatar`. Marinara Engine puede crear uno a partir de uno de tus sprites (consulta [Crear un avatar a partir de un sprite](#mesh-avatar)), o puedes crearlo con [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (consulta [Crea tu propio modelo](#mesh-avatar-studio)). Elige **Import .mavatar file** (Importar archivo .mavatar) para añadir uno, o **Replace file** (Reemplazar archivo) para cambiarlo. Con el movimiento en reposo activado, el avatar respira y mira a su alrededor por su cuenta. Parpadea, y su boca sigue la respuesta. Si el archivo tiene formas de boca dibujadas, se usan; si no, se le dibujan unas simples.

En **Look for each feeling** (Aspecto para cada emoción), elige qué muestra cada emoción: una de las seis emociones, o **Smile** (Sonrisa), **Shy** (Timidez), **Half-closed eyes** (Ojos entrecerrados) o **Wink** (Guiño).

Cada archivo se comprueba al importarlo, y un archivo dañado se rechaza con una razón breve. Lo mismo pasa con un archivo demasiado detallado para moverse con fluidez, o con uno que al descomprimirse supera el límite de subida. Solo se conservan las partes que el avatar necesita, así que la ilustración original que hay dentro del archivo no se guarda. El arte pertenece a quien lo creó; revisa su licencia antes de compartirlo.

Los avatares de malla necesitan WebGL2, que tienen los navegadores actuales. Sin él, o cuando el navegador detiene los gráficos del avatar para ahorrar memoria, el avatar muestra tu configuración PNGTuber o tus sprites en su lugar.

<a id="3d-avatars-vrm-models"></a>

## Avatares 3D: modelos VRM

**3D Avatars** muestra modelos VRM, el formato que exportan VRoid Studio, el complemento VRM para Blender y UniVRM para Unity. Funcionan tanto los archivos VRM 1.0 como los VRM 0.x.

1. Abre **3D Avatars** en el editor de agentes y elige el personaje o la persona.
2. En **VRM model**, selecciona **Import VRM** (Importar VRM) y elige un archivo `.vrm`.
3. Lee **The author's terms** (Las condiciones de quien creó el modelo). Vienen del archivo del modelo y dicen quién puede usar el modelo como avatar, si se permite el uso comercial, si puedes modificar el modelo, si se permite contenido sexual o muy violento y, en los modelos VRM 1.0, si debes dar crédito a quien lo creó y si puedes compartir el archivo. Cuando el archivo enlaza a una licencia o a las condiciones propias de quien lo creó, ábrelas también. Marinara Engine muestra las condiciones, pero no las hace cumplir, así que respétalas tú.
4. En **Faces and mouth shapes** (Caras y formas de boca), comprueba qué expresión del modelo muestra cada cara (Neutral, Happy, Angry, Sad, Relaxed y Surprised), cada forma de boca (A, I, U, E y O) y el parpadeo. La mayoría ya vienen rellenadas: **Set by the model** (Definida por el modelo) significa que el modelo tiene la expresión VRM estándar, y **Guessed from its name** (Deducida por su nombre) significa que una de sus propias expresiones tiene un nombre que coincide. Una expresión que el modelo dejó vacía no cambia nada, así que nunca se asigna a ninguna cara salvo a Neutral, que es el modelo en reposo, y la importación avisa cuando omitió una. Elige otra expresión, o **None** (Ninguna), siempre que una suposición parezca incorrecta.
5. Si quieres, en **Idle animation** (Animación en reposo), añade un archivo `.vrma` para que el modelo lo reproduzca mientras espera. Sin uno, el modelo respira y se balancea suavemente.

**Replace model** (Reemplazar modelo) conserva la animación en reposo, porque las animaciones VRM sirven para cualquier modelo VRM. **Remove model** (Quitar modelo) borra el modelo y su animación en reposo.

Mientras un chat está en marcha, el modelo te mira, parpadea por su cuenta cuando tiene una expresión de parpadeo e inclina la cabeza mientras piensa o escucha. Su cabeza se queda cerca de la parte de arriba de su espacio: un espacio ancho muestra la cabeza y los hombros, y uno más estrecho muestra más del cuerpo. Algunos modelos VRM 1.0 mantienen la boca quieta mientras muestran una cara; mientras un modelo así habla, esa cara se muestra con intensidad parcial para que la boca pueda seguir moviéndose. Con el movimiento reducido activado, la cara y la boca siguen cambiando, pero el modelo deja de balancearse, de respirar y de reproducir su animación en reposo.

Algunos archivos no se pueden usar, y la importación dice por qué:

- **Modelos comprimidos.** Los archivos guardados con compresión Draco o meshopt, o con texturas KTX2, no se cargan. Exporta el modelo de nuevo con la compresión desactivada.
- **Modelos 3D simples.** Un modelo `.glb` o `.gltf` sin datos VRM no tiene expresiones faciales ni esqueleto humanoide. Conviértelo primero a VRM, por ejemplo con el complemento VRM para Blender (consulta [Crea tu propio modelo](#blender-with-the-vrm-add-on-for-blender)).
- **Modelos incompletos.** Se rechaza un modelo cuyo esqueleto no tiene huesos que VRM necesita o apunta a partes que no están en el archivo, o que apunta a archivos fuera de sí mismo.

No hay un límite de tamaño más allá del límite de subida habitual de la app, pero los modelos grandes tardan más en cargar, sobre todo en los teléfonos.

## Cómo las caras y las bocas siguen la respuesta

Los avatares reaccionan por su cuenta; no hay nada que configurar en esta parte.

**Caras en Roleplay.** Mientras una respuesta llega en streaming, Marinara Engine lee cada frase terminada y adivina su estado de ánimo. Para que la cara no cambie a cada momento:

- La cara solo cambia cuando el nuevo estado de ánimo es claramente más fuerte que el actual.
- Una cara se mantiene al menos dos segundos.
- La cara vuelve a la calma solo después de dos frases tranquilas seguidas.
- Unos cuatro segundos después de que termina la respuesta, la cara se relaja y vuelve a la calma.

**Cómo se lee el estado de ánimo.** No se le pregunta a tu conexión de chat. El texto de tu chat se queda en tu propio Marinara Engine y nunca se envía a un servicio externo.

- Una lista de palabras integrada responde al instante, en todas partes, y conoce palabras comunes de estado de ánimo en varios idiomas.
- En las computadoras que pueden ejecutarlo, Marinara Engine lee las frases con un pequeño modelo de emociones en su lugar: el lector de estado de ánimo. Entiende 36 idiomas. Se descarga una sola vez, unos 300 MB, la primera vez que abres un chat de Roleplay con 2D Avatars o 3D Avatars activado. No se descarga mientras los dos agentes están desactivados. La página de cada agente de avatar en **Agents** muestra el progreso de la descarga, y una descarga fallida vuelve a intentarse sola unos 10 minutos después. La lista de palabras responde hasta que el lector de estado de ánimo está listo, y después de la descarga funciona sin conexión. Usa alrededor de 1 GB de memoria mientras está en uso y se libera de la memoria tras 10 minutos de inactividad. Las instalaciones Lite, Android y las computadoras con menos de 3 GB de memoria se quedan con la lista de palabras.

**Caras en el modo Game.** Cada línea que muestra el Game Master viene con una expresión, y el avatar del personaje que habla la adopta. Los pensamientos internos de un personaje cambian la cara, pero no la boca.

**El agente Expression Engine.** Cuando está activado en el chat, lo que elige después de la respuesta es la cara final de esa respuesta. Una elección que llega después de que enviaste tu siguiente mensaje se queda con la respuesta a la que correspondía. Los avatares también funcionan sin él.

**Bocas.** A partir del texto, la boca solo se mueve con el diálogo (palabras entre comillas, líneas `[Name]:` y etiquetas de hablante), no con la narración, más o menos al ritmo del habla. Si el texto aparece más rápido de lo que nadie podría decirlo, la boca se acelera y luego salta hacia adelante para no quedarse atrás de las palabras en pantalla. Con el streaming desactivado, el diálogo de una respuesta se dice en un máximo de ocho segundos. Cuando el texto a voz reproduce una línea, la voz mueve la boca en su lugar, así que la narración de un personaje leída con su voz también mueve su boca.

**Cuerpo.** Un avatar piensa desde que envías tu mensaje hasta sus primeras palabras, habla mientras su boca se mueve, escucha mientras alguien más habla o mientras tú escribes, y descansa el resto del tiempo.

**Chats de grupo.** En un grupo Individual, habla el miembro que está respondiendo, también cuando pides un swipe (respuesta alternativa) del mensaje de un miembro. En un grupo Merged, cada párrafo pertenece al primer personaje que nombra, o al personaje del párrafo anterior. Mientras sigue apareciendo un párrafo que no nombra a nadie, su diálogo espera hasta que un nombre o el final del párrafo muestra quién lo dice. Con el streaming desactivado en un grupo Individual, por ahora solo la respuesta del último miembro mueve un avatar.

## Sincronización labial con texto a voz

Cuando el texto a voz lee una respuesta de Roleplay, el avatar del personaje que habla mueve la boca con la voz. La boca se abre más con los sonidos fuertes y se cierra en las pausas. También cambia de forma: se redondea con sonidos oscuros como "oo" y enseña los dientes con sonidos como "s". No hay nada extra que configurar. Activa el texto a voz como se describe en [Configuración de Text to Speech (TTS)](../media/tts-setup.md), y la sincronización labial funciona con **Auto-play** (Reproducción automática) y con el botón **Speak** (Hablar) de un mensaje, también en el diseño de novela visual.

- **Quién habla:** la boca que se mueve es la del personaje cuya voz lee la línea, el mismo personaje para el que **Voice Option** (Opción de voz) elige una voz. Cuando una respuesta tiene varios hablantes, la boca de cada personaje solo se mueve durante sus propias líneas. Las líneas leídas con la voz del narrador, y los hablantes que no son personajes del chat, no mueven ninguna boca. Con **Only read dialogues** (Leer solo los diálogos) desactivado, la narración propia de un personaje se lee con su voz, así que su boca también se mueve con ella.
- **Pausar, detener y cambiar de chat:** pausar o detener la voz detiene la boca. Si cambias a otro chat mientras todavía se está leyendo una respuesta, los avatares de ese chat se quedan quietos. Si vuelves al primer chat mientras la voz sigue sonando, su avatar vuelve a seguir la voz.
- **Volumen:** el control deslizante **Line volume** (Volumen de línea) cambia lo fuerte que suena la voz, no lo mucho que se abre la boca.
- **Personas:** la boca de una persona no se mueve con tus propios mensajes, con o sin texto a voz.
- **Game Mode:** la narración de Game se reproduce con el audio propio de Game Mode, así que en Game Mode las bocas de los avatares siguen el texto por ahora.

La sincronización labial no cambia cómo se reproduce la voz. Marinara Engine lee una copia aparte de cada clip de voz para sincronizar la boca, así que la reproducción funciona como antes, también en Safari y en iPhone y iPad. Si tu navegador no puede leer un clip, la voz se sigue reproduciendo y solo la boca deja de seguirla.

<a id="making-an-avatar-from-a-sprite"></a>

## Crear un avatar a partir de un sprite

En la página de **2D Avatars** en el editor de agentes, elige un personaje o una persona y luego usa **Make an avatar from a sprite** (Crear un avatar a partir de un sprite). Funciona con los sprites que ya tiene el personaje o la persona. Tu avatar no cambia hasta que guardas un resultado, así que puedes probar todas las veces que quieras.

### Imágenes de parpadeo y de habla

1. Elige uno o más sprites y luego elige **Eyes closed** (Ojos cerrados), **Mouth open** (Boca abierta) o los dos. Cuando el personaje o la persona tiene sprites de retrato, solo se ofrecen esos, porque el avatar nunca mezcla caras de retrato y de cuerpo completo.
2. Revisa la **Image connection** (Conexión de imagen); tu conexión de imagen predeterminada ya viene elegida. Luego selecciona **Make pictures** (Crear imágenes). Cada imagen es una solicitud de imagen. Con **Expose media prompts before sending** (Mostrar los prompts de medios antes de enviar) activado en la configuración, ves cada prompt (las instrucciones enviadas a la IA) y puedes editarlo antes de que se envíe.
3. Las imágenes nuevas aparecen de una en una. Selecciona **Keep** (Conservar) en las que se vean bien y **Try again** (Intentar de nuevo) en las demás. **Cancel** (Cancelar) detiene la imagen que se está creando. Las imágenes que ya tienes se quedan cuando creas más: **Make pictures** solo crea las que faltan, y si **Try again** falla, la imagen anterior se queda. Para rehacer una imagen conservada, selecciona primero **Kept** (Conservada) para soltarla.
4. Selecciona **Save kept pictures** (Guardar imágenes conservadas). Se convierten en las imágenes de parpadeo y de habla del avatar PNGTuber para esas expresiones, junto a una copia del sprite a partir del cual se dibujaron, para que siempre queden alineadas. Si el avatar todavía mostraba tus sprites tal cual, los conserva todos y gana las imágenes nuevas. Si reemplazas un sprite antes de guardar, vuelve a crear sus imágenes.

Los modelos de imagen que editan imágenes funcionan mejor, porque reciben tu sprite como referencia. Tu sprite se envía con el tamaño y la forma que acepta el modelo y se vuelve a recortar del resultado, así que un modelo que mantiene la imagen en su lugar da imágenes que quedan alineadas. Si una imagen cambia algo más que los ojos o la boca, el avatar da un salto cuando parpadea o habla; vuelve a intentarlo con esa imagen.

<a id="mesh-avatar"></a>

### Avatar de malla

1. Elige un sprite. Un busto de frente (cabeza y hombros) funciona mejor; en un sprite de cuerpo completo la cara es pequeña.
2. Elige la **Chat connection that can see pictures** (Conexión de chat que puede ver imágenes). **The agent's connection** (La conexión del agente) usa la conexión configurada en la página de 2D Avatars y, si no hay ninguna, tu conexión de agentes predeterminada. Su modelo debe aceptar imágenes.
3. Selecciona **Make mesh avatar** (Crear avatar de malla). El modelo de chat encuentra la cara, y Marinara Engine construye el avatar a partir de tu sprite. **Cancel** lo detiene.
4. Revisa la vista previa: los contornos deben quedar sobre los ojos, las cejas y la boca. Selecciona **Save as mesh avatar** (Guardar como avatar de malla), o **Discard** (Descartar) y prueba con otro sprite u otro modelo.

Un avatar de malla generado mueve la cabeza, los ojos, las cejas y la boca, y parpadea y habla con sus propios párpados y su propia boca. Su cabello se mueve con la cabeza; las manos, los mechones de cabello sueltos y los accesorios colgantes no se animan. Cuando la cara ocupa la mayor parte de un sprite grande, el avatar se construye a partir de una copia más pequeña para que crearlo siga siendo rápido.

Tu sprite se envía a la conexión de imagen para las imágenes de parpadeo y de habla (y a la conexión de imagen de respaldo de esa conexión si falla y hay una configurada), y a la conexión de chat para un avatar de malla. Los prompts vienen con el agente 2D Avatars. Con **Expose media prompts before sending** activado, puedes leer y cambiar el prompt de cada imagen antes de que se envíe. Con el modo de depuración activado, cada prompt se escribe en el registro del servidor.

## Crea tu propio modelo

No tienes que crear nada para empezar. Un personaje o una persona con sprites de expresión ya tiene un avatar PNGTuber, y [Crear un avatar a partir de un sprite](#making-an-avatar-from-a-sprite) añade imágenes de parpadeo y de habla o construye un avatar de malla por ti. Si prefieres crear tu propio modelo, usa una de estas herramientas. Los sprites se muestran en cuanto los añades, y cada archivo se importa en la página del agente en **Agents**.

| Lo que quieres | Herramienta | Lo que obtienes |
| --- | --- | --- |
| Sprites PNGTuber | Cualquier app de dibujo y luego la pestaña **Sprites** del personaje | Los sprites |
| Sprites PNGTuber con capas y disfraces | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | Un archivo `.save` |
| Un avatar de malla | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | Un archivo `.mavatar` |
| Un modelo 3D | [VRoid Studio](https://vroid.com/en/studio), o Blender con el complemento [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | Un archivo `.vrm` y, si quieres, una animación en reposo `.vrma` |

### Tus propios sprites

1. Dibuja una imagen para cada emoción, todas del mismo tamaño y con el personaje en el mismo lugar. Ponle a cada una el nombre de su emoción: `neutral`, `happy`, `angry`, `sad`, `relaxed` y `surprised`. También funcionan los nombres que contienen una palabra de emoción, como `smile`, `cry`, `calm` o `shock`.
2. Para que la boca se mueva, dibuja la misma imagen con solo la boca abierta y añade `_talk` a su nombre, por ejemplo `happy_talk`. Para el parpadeo, cierra solo los ojos y añade `_blink`; para las dos cosas, añade `_blink_talk`. Una emoción sin estas imágenes sigue dando saltitos mientras habla.
3. Añade las imágenes en la pestaña **Sprites** del personaje o de la persona, en **Facial Expressions** (Expresiones faciales). **Upload Folder** (Subir carpeta) añade una carpeta entera y le pone a cada sprite el nombre de su archivo. Consulta [Sprites de personaje](../characters/sprites.md).
4. Los chats con 2D Avatars activado los muestran enseguida. Para cambiar la cara de una emoción o el movimiento, consulta [Sprites PNGTuber](#pngtuber-sprites).

### PNGTuber Plus

1. Construye el avatar con capas separadas. Configura la boca abierta para que se muestre solo al hablar y la boca cerrada solo en silencio. Configura los ojos cerrados para que se muestren solo al parpadear y los ojos abiertos solo cuando no parpadea.
2. Para cada emoción, crea un disfraz que cambie los ojos o la boca, y ponles a esas imágenes el nombre de la emoción, por ejemplo `angry eyes.png` o `happy_mouth.png`. El disfraz 1 es la cara en reposo.
3. Guarda el avatar para obtener un archivo `.save`.
4. Abre **2D Avatars** en **Agents**, elige el personaje o la persona, luego **PNGTuber sprites** y después **Import PNGTuber Plus save**. Elige una cara para cualquier emoción que los nombres no cubrieron.

### Mesh Avatar Studio

1. Empieza con una imagen de frente de cabeza y hombros con fondo transparente. Mesh Avatar Studio se ejecuta en tu computadora con Node.js, y un agente de programación como Claude Code o Codex hace el rigging de la imagen. Su README te guía paso a paso.
2. Si quieres, añade ojos y bocas dibujados en **Drawn variants**. Marinara Engine usa automáticamente sus formas de boca (`mouth_a`, `mouth_i`, `mouth_o` y `mouth_a_half`) y sus ojos cerrados (`eyes_closed_0` y `eyes_closed_1`). Todo avatar de malla trae las seis emociones integradas, así que no hay nada que nombrar.
3. Elige **Export .mavatar**. No comprimas por tu cuenta la carpeta del proyecto en un ZIP.
4. Abre **2D Avatars** en **Agents**, elige el personaje o la persona, luego **Mesh avatar** y después **Import .mavatar file**.

### VRoid Studio

1. Crea el personaje en VRoid Studio. Sus caras, formas de boca y parpadeo son expresiones VRM estándar, así que se encuentran automáticamente.
2. Expórtalo como VRM. Funcionan tanto VRM 1.0 como VRM 0.0. Rellena los datos y las condiciones del modelo cuando VRoid Studio te lo pida.
3. Abre **3D Avatars** en **Agents**, elige el personaje o la persona y selecciona **Import VRM**.

<a id="blender-with-the-vrm-add-on-for-blender"></a>

### Blender con VRM Add-on for Blender

1. Instala VRM Add-on for Blender desde **Get Extensions**, en las **Preferences** de Blender. En las versiones de Blender anteriores a la 4.2, el archivo ZIP del complemento se instala en **Add-ons**.
2. Dale al modelo un esqueleto (armature) humanoide y asigna sus huesos VRM. El complemento puede asignarlos automáticamente.
3. Configura las expresiones en el panel VRM del complemento: **Expressions** para VRM 1.0, o **VRM 0.x Blend Shape Proxy** para VRM 0.x. Cada una debe mover una shape key (clave de forma) o un material: una expresión vacía no cambia nada, así que la importación solo la usa para Neutral. También se reconocen las expresiones personalizadas con un nombre claro, como `Smile` o `Shock`.
   - Caras: **Happy**, **Angry**, **Sad**, **Relaxed** y **Surprised**. VRM 0.x llama a las cuatro primeras **Joy**, **Angry**, **Sorrow** y **Fun**, y no tiene una expresión predefinida de sorpresa, así que añade una personalizada llamada `Surprised`.
   - Formas de boca: **Aa**, **Ih**, **Ou**, **Ee** y **Oh** (**A**, **I**, **U**, **E** y **O** en VRM 0.x).
   - Parpadeo: **Blink**.
4. Exporta con **File → Export → VRM (.vrm)**. Para una animación en reposo, anima el esqueleto y usa **File → Export → VRM Animation (.vrma)**. El complemento solo exporta una animación desde un modelo configurado como VRM 1.0, así que elige VRM 1.0 en el paso 3 si quieres una.
5. Abre **3D Avatars** en **Agents**, elige el personaje o la persona y selecciona **Import VRM**. Añade la animación con **Add animation** (Añadir animación) en **Idle animation**.

### Qué evitar al exportar

- **Compresión.** La compresión de mallas Draco o meshopt y las texturas KTX2 no se cargan. Las exportaciones VRM de arriba nunca las usan, pero la exportación glTF simple de Blender ofrece Draco, y los optimizadores de modelos pueden añadir las tres. Vuelve a exportar con la compresión desactivada.
- **glTF simple.** Un archivo `.glb` o `.gltf` simple no tiene los datos VRM que nombran sus caras y su esqueleto. Exporta un `.vrm` en su lugar.
- **Archivos separados.** No se puede usar un modelo cuyas texturas o datos están en archivos separados. Exporta un solo archivo `.vrm`.
- **Extras de PNGTuber Plus.** El bamboleo, el arrastre y la animación no se transfieren: cada capa se muestra en reposo, y una capa animada muestra su primer fotograma.

## Rendimiento y dispositivos

El código de dibujo de cada tipo de avatar solo se descarga la primera vez que se muestra un avatar de ese tipo, así que los chats sin avatares no cargan nada extra.

| | Teléfonos | Computadoras |
| --- | --- | --- |
| Avatares dibujados a la vez | 2 | 4 |
| Fotogramas por segundo al hablar | 30 | 30 |
| Fotogramas por segundo en reposo | 20, o 15 cuando el teléfono está ocupado | 30 |
| Nitidez (proporción de píxeles) | hasta 1,5× | hasta 2× |

Un chat muestra los avatares en el orden de sus personajes y luego tu persona, hasta ese límite. Los avatares dejan de dibujarse por completo mientras la pestaña está oculta, la ventana está en segundo plano, los ajustes de Appearance (Apariencia) están abiertos, o el chat está fuera de la pantalla o tapado por un panel o un editor. Con **Reduce Ambient Animations & Effects** (Reducir animaciones y efectos ambientales) o el ajuste de movimiento reducido de tu dispositivo activado, los avatares siguen cambiando de cara y moviendo la boca, pero omiten la respiración, el balanceo y las poses de espera.

## Guías relacionadas

- [Agentes: ayudantes de IA para tus chats](agents-overview.md)
- [Referencia de agentes descargables](built-in-agents.md)
