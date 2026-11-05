# Avatares 2D y 3D

Dos agentes descargables les dan a los personajes y a las personas (una persona es el perfil que te representa en el chat) un avatar animado que reacciona mientras una respuesta llega en streaming. **2D Avatars** (Avatares 2D) muestra sprites (imágenes del personaje) al estilo PNGTuber o avatares de malla. **3D Avatars** (Avatares 3D) muestra modelos VRM, MMD PMX, GLB y FBX. Las caras siguen la respuesta, y las bocas se mueven con el texto o con el texto a voz.

Los modelos Live2D no son compatibles. La licencia de Live2D exige un acuerdo aparte incluso para apps gratuitas de código abierto, y su entorno de ejecución no se puede incluir con Marinara Engine.

## Instalar los agentes de avatar

Los dos agentes están en **Agent Organizer** (Organizador de agentes) en todas las instalaciones, bajo los filtros **Roleplay** y **Game**. Necesitan Marinara Engine 2.5.1 o posterior. Un Engine más antiguo se niega a instalarlos. Se descargan por separado, así que instala solo el que quieras. Los dos funcionan para personajes y personas en chats de Roleplay y Game, y no envían solicitudes adicionales a tus modelos de IA mientras chateas.

1. Abre **Agents → Agent Organizer** (Agentes → Organizador de agentes) e instala **2D Avatars**, **3D Avatars** o los dos. Ninguno necesita reiniciar.
2. Configura cada avatar en la página del agente (consulta [Configurar un avatar](#set-up-an-avatar)).
3. En un chat de Roleplay o Game, abre **Chat Settings → Agents → Misc Agents** (Ajustes del chat → Agentes → Agentes varios) y añade el agente.

Un avatar se muestra en un chat de Roleplay, de novela visual o de Game cuando los agentes están activados y el agente correspondiente está añadido. Funciona con o sin el agente Expression Engine. El avatar no oculta el sprite de cuerpo completo, así que desactívalo tú si el avatar lo reemplaza. Los avatares se colocan donde iría el sprite de cuerpo completo y comparten su tamaño.

<a id="set-up-an-avatar"></a>

## Configurar un avatar

Abre **Agents**, abre **2D Avatars** o **3D Avatars** y usa la sección **Avatars** (Avatares) cerca de la parte de arriba.

1. En **Character or persona** (Personaje o persona), elige quién recibe el avatar. Los nombres marcados con "(has an avatar)" ya tienen uno.
2. En **Avatar type** (Tipo de avatar), elige el tipo. 2D Avatars ofrece **PNGTuber sprites** (Sprites PNGTuber) y **Mesh avatar** (Avatar de malla). 3D Avatars ofrece **VRM model** (Modelo VRM), **MMD PMX model** (Modelo MMD PMX) y **GLB or FBX model** (Modelo GLB o FBX).
3. Configúralo en la sección de ese tipo, más abajo: usa tus sprites o importa un archivo, elige la cara para cada emoción, o quítalo.
4. Usa **Preview** (Vista previa) para comprobarlo. **Try a face** (Probar una cara) cambia de emoción y **Talk** (Hablar) mueve la boca. Cuando todavía no hay nada que mostrar, la vista previa muestra un avatar de ejemplo.
5. Activa **Show this avatar in chats** (Mostrar este avatar en los chats).

**Show this avatar in chats** activa o desactiva un avatar configurado sin borrarlo. Sigue desactivado hasta que configures un avatar o sprites utilizables. Una foto de perfil por sí sola no crea un avatar 2D.

**Movement** (Movimiento) tiene tres interruptores para todos los tipos: **Lip sync** (Sincronización labial) mueve la boca, **Blinking** (Parpadeo) hace parpadear al avatar cada pocos segundos, e **Idle motion** (Movimiento en reposo) hace que respire y se balancee mientras espera. Si un personaje tiene más de un tipo de avatar, **Show this one** (Mostrar este) elige el tipo que usan los chats. Cuando el agente de ese tipo está desactivado en un chat, el chat muestra otro tipo cuyo agente está activado. Quitar un tipo borra sus archivos. Tus sprites se quedan.

### Cambiar el tamaño de los avatares y moverlos en un chat

1. Abre **Chat Settings → Agents** y abre **Avatars**.
2. Elige un avatar en la lista y usa su control deslizante de tamaño.
3. Selecciona **Arrange** (Organizar) para mover los avatares. Arrástralos con el mouse o con el dedo, o enfoca uno y usa las teclas de flecha (mantén pulsada la tecla <kbd>Shift</kbd> para moverlo más).
4. Selecciona **Done** (Listo). Los avatares se quedan donde los pusiste y los clics vuelven a llegar al chat. **Reset** (Restablecer) devuelve todos los avatares a su lugar.

Un avatar 3D también tiene **Framing** (Encuadre): **Portrait** (Retrato) muestra la cabeza y los hombros (la opción predeterminada), **Half body** (Medio cuerpo) muestra hasta las caderas, y **Full body** (Cuerpo completo) muestra el modelo entero. El avatar conserva su tamaño, y un encuadre más alto muestra más del modelo. Los avatares 2D no tienen encuadre.

La disposición se guarda para ese chat en este dispositivo. No se sincroniza con otros dispositivos. El botón **Arrange** propio del Expression Engine también mueve los avatares.

### Dónde se guardan los archivos de avatar

Los archivos importados se comprueban antes de guardarse. El único límite de tamaño es el límite de subida normal del servidor. Los archivos están en la carpeta de datos, en `avatar-models/<character or persona>/<id>/`, junto a un `avatar.json` con los ajustes. Las copias de seguridad y las exportaciones de perfil incluyen esta carpeta. Borrar un personaje o una persona borra su avatar, y lo mismo pasa al borrar todos los **Characters** (Personajes), todas las **Personas** o todo **Media & Assets** (Multimedia y recursos) en la Danger Zone de la configuración. Las exportaciones de tarjetas de personaje nunca incluyen avatares.

### Chats de grupo

Los chats de grupo muestran a todos los participantes con un avatar guardado y activado cuyo agente esté activado, sin un límite fijo. En el modo **Individual**, el personaje que responde habla y expresa emociones. En el modo **Merged (Narrator)**, las etiquetas de hablante y los diálogos atribuidos por nombre dirigen al personaje correspondiente. Con las voces activadas, la sincronización labial sigue al personaje cuya voz se está reproduciendo.

<a id="2d-avatars-pngtuber-sprites-and-mesh-avatars"></a>

## Avatares 2D: sprites PNGTuber y avatares de malla

**2D Avatars** muestra uno de dos tipos de avatar. Los **sprites PNGTuber** son imágenes planas que cambian de cara, abren la boca y parpadean. Los **avatares de malla** son dibujos que mueven la cabeza, los ojos y la boca con suavidad. Configura los dos en la página del agente después de elegir un personaje o una persona.

<a id="pngtuber-sprites"></a>

### Sprites PNGTuber

Un personaje o una persona con sprites de expresión puede usarlos como avatar PNGTuber, con los sprites como caras. Se usan los sprites de retrato si los hay y, si no, los de cuerpo completo, así que un avatar nunca mezcla ambos. Previsualízalos y luego activa **Show this avatar in chats** o guárdalos con **Use my sprites** (Usar mis sprites).

- **Imágenes para hablar y parpadear.** Añade sprites con el nombre de una cara y `_talk` para la boca abierta y `_blink` para los ojos cerrados, por ejemplo `happy_talk`, `happy_blink` y `happy_blink_talk` para las dos cosas. También funcionan `_talking`, `_speak`, `_mouth_open`, `_blinking` y `_eyes_closed`. Una cara sin ellas sigue dando saltitos mientras habla.
- **Face for each feeling (Cara para cada emoción).** Elige qué cara se muestra para Neutral, Happy, Angry, Sad, Relaxed y Surprised (neutral, feliz, enojado, triste, relajado y sorprendido). **Resting face** (Cara en reposo) usa la cara Neutral. Se ofrecen todos los sprites, incluidos los que se añadan después, hasta 64 caras. Una importación de PNGTuber Plus ofrece solo sus propias caras. Cuando el Expression Engine o el Game Master eligen un sprite que tienes, se muestra exactamente esa cara.
- **More feelings (Más emociones).** En **Face for each feeling**, abre **More feelings** para elegir una cara para 23 emociones más específicas, agrupadas bajo las seis (tabla de abajo). Cada una usa la cara de su emoción principal hasta que eliges otra. Un sprite con el nombre de una de ellas, como `fear`, `amusement` o una palabra como `scared` o `laughing`, se usa para ella sin configurar nada.
- **Movement.** **Hop while talking** (Saltar al hablar) y **Hop height** (Altura del salto) ajustan el rebote. **Time between blinks** (Tiempo entre parpadeos) es el promedio. Cada parpadeo llega un poco antes o un poco después. Con el movimiento reducido activado en tu dispositivo, el avatar no salta ni respira, pero su cara y su boca siguen cambiando.
- **Los sprites se muestran tal cual.** Un sprite dibujado sobre un fondo se muestra con él, y tus archivos nunca se modifican. Para tener caras sin fondo, usa [Caras a partir del avatar](#faces-from-the-avatar).
- **Use my sprites** guarda los sprites como las caras. Elegir una cara o cambiar el movimiento también guarda. **Update from sprites** (Actualizar desde los sprites) toma los sprites que añadiste después y conserva las caras que elegiste. Después de una importación, elige **Remove** (Quitar) para volver a tus sprites.

| Más emociones, agrupadas bajo | Emociones |
| --- | --- |
| Neutral | Curiosity (curiosidad) |
| Happy | Admiration, Amusement, Desire, Embarrassment, Excitement, Gratitude, Optimism, Pride (admiración, diversión, deseo, vergüenza, entusiasmo, gratitud, optimismo, orgullo) |
| Angry | Annoyance, Disapproval, Disgust (molestia, desaprobación, asco) |
| Sad | Disappointment, Grief, Nervousness, Remorse (decepción, duelo, nerviosismo, remordimiento) |
| Relaxed | Approval, Caring, Love, Relief (aprobación, cariño, amor, alivio) |
| Surprised | Confusion, Fear, Realization (confusión, miedo, comprensión) |

**Import PNGTuber Plus save** (Importar guardado de PNGTuber Plus) lee un avatar guardado por [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) (un archivo `.save`). Cada disfraz (costume) se convierte en una cara, y sus capas para hablar y parpadear se convierten en las imágenes para hablar y parpadear. Los disfraces se asignan a las emociones por nombres de imágenes como `angry eyes.png`. Elige una cara para cualquier emoción que los nombres no cubrieron. Algunas cosas no se transfieren:

- El bamboleo, el arrastre, la rotación y el estiramiento no se importan. El avatar muestra cada capa en reposo.
- Las capas animadas solo muestran su primer fotograma.
- Los guardados muy antiguos solo conservan las rutas de las imágenes en la computadora de quien los creó. Primero, guárdalos de nuevo con una versión más reciente de PNGTuber Plus.
- Un avatar muy grande se reduce a 2048 píxeles para que los teléfonos puedan cargar todas las imágenes.

Importar un guardado necesita procesamiento de imágenes en el servidor. Algunas instalaciones de Android (Termux) no lo tienen, y ahí la importación se rechaza con un mensaje.

### Avatares de malla

Un avatar de malla es un archivo `.mavatar`. Marinara puede crear uno a partir de un sprite (consulta [Avatar de malla](#mesh-avatar)), o puedes crearlo con [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (consulta [Mesh Avatar Studio](#mesh-avatar-studio)). Elige **Import .mavatar file** (Importar archivo .mavatar) para añadir uno, o **Replace file** (Reemplazar archivo) para cambiarlo. Con el movimiento en reposo activado, el avatar respira y mira a su alrededor por su cuenta. Parpadea, y su boca sigue la respuesta. Se usan las formas de boca dibujadas en el archivo. Si no las hay, se dibujan unas simples.

En **Look for each feeling** (Aspecto para cada emoción), elige qué muestra cada emoción: una de las seis emociones, o **Smile** (Sonrisa), **Shy** (Timidez), **Half-closed eyes** (Ojos entrecerrados) o **Wink** (Guiño).

Cada archivo se comprueba al importarlo. Un archivo dañado, un archivo demasiado detallado para moverse con fluidez o uno que al descomprimirse supera el límite de subida se rechaza con una razón breve. Solo se conservan las partes que el avatar necesita, así que la ilustración original que hay dentro no se guarda. El arte pertenece a quien lo creó, así que revisa su licencia antes de compartirlo.

Los avatares de malla necesitan WebGL2, que tienen los navegadores actuales. Sin él, o cuando el navegador detiene los gráficos para ahorrar memoria, el avatar muestra tu configuración PNGTuber o tus sprites en su lugar.

<a id="3d-avatars-vrm-models"></a>

## Avatares 3D: modelos VRM

**3D Avatars** muestra modelos VRM, el formato que exportan VRoid Studio, el complemento VRM para Blender y UniVRM para Unity. Funcionan tanto los archivos VRM 1.0 como los VRM 0.x. Si todavía no tienes un modelo, [crea uno en VRoid Studio](#get-a-3d-model), una app gratuita.

1. Abre **3D Avatars** y elige el personaje o la persona.
2. En **VRM model**, selecciona **Import VRM** (Importar VRM) y elige un archivo `.vrm`.
3. Lee **The author's terms** (Las condiciones de quien creó el modelo). Vienen del archivo del modelo y dicen quién puede usarlo como avatar, si se permiten el uso comercial, las modificaciones y el contenido sexual o muy violento y, en los modelos VRM 1.0, si debes dar crédito a quien lo creó y si puedes compartir el archivo. Abre también cualquier enlace de licencia que haya en el archivo. Marinara muestra las condiciones, pero no las hace cumplir, así que respétalas tú.
4. En **Faces and mouth shapes** (Caras y formas de boca), comprueba qué expresión del modelo muestra cada cara (Neutral, Happy, Angry, Sad, Relaxed y Surprised), cada forma de boca (A, I, U, E y O) y el parpadeo. **Set by the model** (Definida por el modelo) significa que tiene la expresión VRM estándar. **Guessed from its name** (Deducida por su nombre) significa que una de sus propias expresiones tiene un nombre que coincide. Una expresión vacía no cambia nada, así que solo se rellena para Neutral. Elige otra expresión, o **None** (Ninguna), cuando una suposición parezca incorrecta.
5. Opcional: en **Idle animation** (Animación en reposo), añade un archivo `.vrma` para que el modelo lo reproduzca mientras espera. Sin uno, respira y se balancea suavemente.

**Replace model** (Reemplazar modelo) conserva la animación en reposo, porque las animaciones VRM sirven para cualquier modelo VRM. **Remove model** (Quitar modelo) borra las dos cosas.

En un chat, el modelo te mira, parpadea por su cuenta cuando tiene una expresión de parpadeo e inclina la cabeza mientras piensa o escucha. Algunos modelos VRM 1.0 mantienen la boca quieta mientras muestran una cara. Mientras un modelo así habla, esa cara se muestra con intensidad parcial para que la boca pueda moverse. Con el movimiento reducido activado, la cara y la boca siguen cambiando, pero el modelo deja de balancearse, de respirar y de reproducir su animación en reposo.

Si no funcionó, la importación dice por qué. Las causas habituales:

- **Modelos comprimidos.** La compresión Draco o meshopt, o las texturas KTX2, no se cargan. Exporta de nuevo con la compresión desactivada.
- **Modelos 3D simples.** Un `.glb` o `.gltf` sin datos VRM no tiene expresiones ni esqueleto humanoide. Importa un `.glb` con rigging (con un esqueleto para animarlo) como **GLB or FBX model** (consulta [Avatares GLB y FBX](#glb-and-fbx-avatars-rigged-models)), o conviértelo a VRM (consulta [Blender](#blender-with-the-vrm-add-on-for-blender)).
- **Modelos incompletos.** Se rechaza un modelo al que le faltan huesos que VRM necesita, o que apunta a partes que no están en el archivo o a archivos fuera de él.

Los modelos grandes tardan más en cargar, sobre todo en los teléfonos.

<a id="mmd-avatars-pmx-models-and-vmd-motions"></a>

## Avatares MMD: modelos PMX y animaciones VMD

1. En la página **3D Avatars**, elige **MMD PMX model** en **Avatar type**.
2. Selecciona **Import PMX or ZIP** (Importar PMX o ZIP). Elige un ZIP con un modelo PMX y sus imágenes. Conserva las carpetas y los nombres de archivo del modelo, incluidos los nombres japoneses. Un modelo que no necesita imágenes puede ser solo un `.pmx`.
3. En **Faces and mouth shapes**, elige la cara para cada emoción, forma de boca y parpadeo. Los nombres comunes en inglés y japonés se asignan automáticamente. Revisa la vista previa y corrige las suposiciones. Un modelo sin caras adecuadas puede seguir mostrándose y moviendo el cuerpo.
4. Opcional: en **VMD motion** (Animación VMD), añade un `.vmd` hecho para ese modelo. Se reproduce mientras **Idle motion** está activado, y las caras que elegiste siguen al chat. Sin un VMD, el modelo se balancea suavemente.

Las imágenes faltantes, las rutas inseguras y los archivos dañados se rechazan antes de reemplazar tu modelo guardado. La configuración muestra los primeros 256 nombres de expresión y avisa si hay más. Reemplazar un PMX elimina su VMD anterior, así que añade una animación para el nuevo modelo. Quitar un modelo MMD borra sus imágenes y su animación y deja los otros tipos de avatar. La reducción de movimiento detiene la animación, pero mantiene las caras y la sincronización labial.

Se admiten los modelos PMX 2.0 y los modelos PMX 2.1 compatibles, con imágenes PNG, JPEG, BMP y TGA, incluidos `.sph` y `.spa`. Algunas funciones más recientes de PMX 2.1 no son compatibles, y la importación dice por qué. No se admiten modelos PMD, poses VPD ni animaciones de cámara o luz. No se simula la física, así que el pelo y la ropa pueden verse distintos que en MikuMikuDance. Se rechazan los modelos con más de 256 rutas de imagen, rutas muy largas, imágenes que necesitan demasiada memoria o esqueletos demasiado complejos. Prueba tu modelo, sobre todo en un teléfono.

Los avatares MMD necesitan WebGL2 y usan los mismos controles de pausa, frecuencia de fotogramas y encuadre que los demás avatares. Los modelos solo se cargan desde tu Engine. Respeta las licencias y las condiciones de quienes los crearon. Importar o reproducir uno no envía nada a un servicio de IA.

<a id="glb-and-fbx-avatars-rigged-models"></a>

## Avatares GLB y FBX: modelos con rigging

1. En la página **3D Avatars**, elige **GLB or FBX model** en **Avatar type**.
2. Selecciona **Import GLB or FBX** (Importar GLB o FBX) y elige un solo archivo `.glb` o `.fbx` de un personaje con rigging.

Un modelo simple no tiene datos VRM que nombren sus huesos, así que la importación asigna los huesos por su nombre. Los esqueletos de Mixamo, Unity, VRoid, Unreal, Blender, 3ds Max, Maya HumanIK, Character Creator y DAZ usan nombres que reconoce. La sección muestra cuántos huesos del cuerpo se asignaron. El modelo necesita al menos las caderas, la columna, la cabeza y los dos brazos y antebrazos. Si no, la importación lo rechaza y dice qué huesos faltan. Cambia el nombre de esos huesos en tu app de 3D o haz el rigging del modelo con Mixamo. Los modelos en pose en A, de espaldas o que se hicieron en centímetros se enderezan, se giran y se ajustan de tamaño automáticamente.

Las caras salen de las blend shapes del modelo (shape keys o morph targets). En **Faces and mouth shapes**, se asignan los nombres comunes: las formas de boca de VRoid, VRChat y Oculus (`aa`, `A`, `viseme_aa`, `Fcl_MTH_A`), una mandíbula abierta (`mouthOpen`, `jawOpen`), las emociones (`happy`, `Joy`, `mouthSmile`) y el parpadeo (`blink`, o un par izquierdo y derecho como `eyeBlinkLeft` y `eyeBlinkRight` de ARKit). Revisa la vista previa y corrige las suposiciones. Un modelo sin blend shapes sigue moviendo el cuerpo y asiente con la cabeza al hablar.

Se admiten el glTF binario (`.glb`) con todo incrustado, y FBX 2014 (7.4) o posterior, binario o ASCII. Exporta los archivos FBX con **Embed Media** (o **Embed Textures**) activado, o el modelo se mostrará sin sus imágenes. Las compresiones Draco, meshopt y KTX2 no se cargan, y no se puede usar un `.gltf` separado con sus propios archivos. Un VRM guardado como `.glb` va en **VRM model**. No se admiten las animaciones propias del modelo, la física ni la edición de poses. Respeta las condiciones de quien creó el modelo. Importar o reproducir uno no envía nada a un servicio de IA.

<a id="get-a-3d-model"></a>

## Obtener un modelo 3D

Si el personaje o la persona no tiene un modelo VRM, crea uno en VRoid Studio. Es una app gratuita de pixiv para Windows, macOS y iPad. Los modelos que creas con ella son tuyos para usarlos, pero algunos elementos integrados y las texturas que compres tienen sus propias condiciones. Sus modelos traen las seis caras, las cinco formas de boca y el parpadeo, así que las caras y la sincronización labial funcionan desde el principio.

En la página **3D Avatars**, elige el personaje o la persona. En **Get a 3D model** (Obtener un modelo 3D), **Read the guide** (Leer la guía) abre esta sección y **Copy prompt** (Copiar prompt) copia una descripción de su aspecto.

1. Descarga [VRoid Studio](https://vroid.com/en/studio) e instálalo.
2. Opcional: selecciona **Copy prompt**, pégalo en un generador de imágenes y usa la imagen como referencia. VRoid Studio no tiene ningún cuadro para un prompt (las instrucciones enviadas a la IA).
3. En VRoid Studio, crea un modelo nuevo. Elige el cabello, la cara, los ojos, el cuerpo y la ropa más parecidos a los del personaje y luego cambia las formas y los colores hasta que coincidan.
4. Exporta el modelo como VRM (1.0 o 0.0). Rellena los datos y las condiciones del modelo cuando te lo pida.
5. Abre **3D Avatars** en **Agents**, elige el personaje o la persona y selecciona **Import VRM** en **VRM model**. Un modelo de VRoid Studio ya tiene rellenadas todas las caras, las formas de boca y el parpadeo.

El prompt describe al personaje para las herramientas que crean una imagen o un modelo 3D a partir de texto: un personaje de estilo anime de cuerpo completo en pose en T, visto de frente sobre un fondo liso. El aspecto viene del campo **Appearance** (Apariencia), de las etiquetas de **Image Appearance Override** (Apariencia alternativa para imágenes) cuando esa opción está activada, o de la descripción cuando no hay apariencia. Solo tiene el nombre y el aspecto, nada más de la tarjeta y nada de tus chats. Está en inglés. Cámbialo como quieras.

Un VRM de otra herramienta puede tener menos expresiones o ninguna. **Faces and mouth shapes** muestra cuáles tiene. Algunos sitios web dicen que crean un VRM con expresiones faciales a partir de una imagen, pero no se pudo confirmar ninguno en octubre de 2026, así que esta guía no recomienda ninguno. Un modelo creado antes con el generador de Tripo, que ya se eliminó, todavía se carga y mueve el cuerpo, pero su cara no se mueve.

## Cómo las caras y las bocas siguen la respuesta

Los avatares reaccionan por su cuenta. Aquí no hay nada que configurar.

**Caras en Roleplay.** Mientras una respuesta llega en streaming, Marinara lee cada frase terminada y adivina su estado de ánimo. Para que la cara no cambie a cada momento:

- La cara solo cambia cuando el nuevo estado de ánimo es claramente más fuerte que el actual.
- Una cara se mantiene al menos dos segundos.
- La cara vuelve a la calma después de dos frases tranquilas seguidas, y unos cuatro segundos después de que termina la respuesta.

Con el streaming desactivado, cada frase sigue teniendo su propio estado de ánimo, y las caras cambian en orden a lo largo del tiempo de habla de la respuesta. Cuando el texto a voz lee la respuesta, las caras siguen la voz en su lugar (consulta más abajo).

Un avatar PNGTuber con caras para [más emociones](#pngtuber-sprites) puede mostrar una emoción más específica, como Amusement mientras está feliz. Sigue las mismas reglas, y una emoción sin cara propia muestra la cara de su emoción principal. Las elecciones del Expression Engine y del Game Master funcionan igual: si no hay ninguna cara con el nombre `scared`, el avatar muestra Fear. Los avatares 3D y de malla solo muestran las seis emociones.

**Cómo se lee el estado de ánimo.** No se le pregunta a tu modelo de chat, y el texto de tu chat nunca se envía a un servicio externo.

- Una lista de palabras integrada responde al instante, en todas partes, y conoce palabras comunes de estado de ánimo en varios idiomas.
- En las computadoras que pueden ejecutarlo, un pequeño modelo de emociones, el lector de estado de ánimo, lee las frases en su lugar. Entiende 36 idiomas. Se descarga una sola vez, unos 300 MB, la primera vez que abres un chat de Roleplay con 2D Avatars o 3D Avatars activado. La página de cada agente de avatar en **Agents** muestra el progreso. Una descarga fallida vuelve a intentarse unos 10 minutos después. La lista de palabras responde hasta que el lector está listo, y después funciona sin conexión. Usa alrededor de 1 GB de memoria mientras está en uso y se libera de la memoria tras 10 minutos de inactividad. Las instalaciones Lite, Android y las computadoras con menos de 3 GB de memoria se quedan con la lista de palabras.

**Caras en Game Mode.** Cada línea que muestra el Game Master viene con una expresión, y el avatar del personaje que habla la adopta, incluso cuando una voz lee la línea. Los pensamientos internos cambian la cara, pero no la boca.

**Expression Engine.** Cuando está activado, lo que elige después de la respuesta es la cara final de esa respuesta. Una elección que llega después de que envías tu siguiente mensaje se queda con su propia respuesta. Con el texto a voz, la elección se muestra cuando termina la voz.

**Bocas.** A partir del texto, la boca solo se mueve con el diálogo (palabras entre comillas, líneas `[Name]:` y etiquetas de hablante), no con la narración, más o menos al ritmo del habla. Si el texto aparece más rápido de lo que nadie podría decirlo, la boca se acelera y luego salta hacia adelante. Con el streaming desactivado, el diálogo de una respuesta se dice en un máximo de ocho segundos. Cuando el texto a voz reproduce una línea, la voz mueve la boca en su lugar.

**Cuerpo.** Un avatar piensa desde que envías tu mensaje hasta sus primeras palabras, habla mientras su boca se mueve, escucha mientras alguien más habla o mientras tú escribes, y descansa el resto del tiempo.

**Chats de grupo.** En un grupo Individual, habla el miembro que responde, también cuando pides un swipe (respuesta alternativa) del mensaje de un miembro. En un grupo Merged, una etiqueta de hablante dirige el diálogo y la cara de ese personaje, incluso en un párrafo que nombra a otro. Los diálogos atribuidos por nombre también siguen a su hablante. La prosa sin etiquetas pertenece al primer personaje que nombra, o al personaje anterior. Mientras sigue apareciendo un párrafo que no nombra a nadie, su diálogo espera hasta que un nombre o el final del párrafo muestra quién habla. Con el streaming desactivado en un grupo Individual, por ahora solo la respuesta del último miembro mueve un avatar.

<a id="lip-sync-with-text-to-speech"></a>

## Sincronización labial con texto a voz

Cuando el texto a voz lee una respuesta de Roleplay, el avatar del personaje que habla mueve la boca con la voz. La boca se abre más con los sonidos fuertes, se cierra en las pausas, se redondea con sonidos como "oo" y enseña los dientes con sonidos como "s". Para activarla, configura el texto a voz como se describe en [Configuración de Text to Speech (TTS)](../media/tts-setup.md). Entonces funciona con **Auto-play** (Reproducción automática) y con el botón **Speak** (Hablar) de un mensaje, también en el diseño de novela visual.

Cuando la respuesta se lee en voz alta con **Auto-play** activado, la voz suele empezar unos segundos después de que aparece el texto, así que el avatar la espera.

- Mientras aparece el texto, el avatar parpadea y se mueve como siempre, pero su boca se queda cerrada y su cara todavía no cambia.
- Cuando empieza la voz, la boca sigue la voz, y la cara cambia a medida que la voz llega a cada frase, salvo que el Expression Engine ya haya elegido la cara.
- La cara se relaja unos cuatro segundos después de que termina la voz. Las pausas cortas entre líneas no la relajan.
- Si la voz falla o no empieza a los pocos segundos, el avatar reproduce una vez las caras y la boca de la respuesta a partir del texto. Si falla más tarde, muestra el último estado de ánimo y se relaja.
- Tras 30 segundos sin voz, el avatar deja de esperar. Una voz que empieza más tarde sigue moviendo la boca.

Detalles:

- **Quién habla.** La boca que se mueve es la del personaje cuya voz lee la línea, aquel para el que **Voice option** (Opción de voz) elige una voz. La boca de cada personaje solo se mueve durante sus propias líneas. Las líneas con la voz del narrador y los hablantes que no son personajes del chat no mueven ninguna boca. Con **Only read dialogues** (Leer solo los diálogos) desactivado, la narración propia de un personaje se lee con su voz y mueve su boca.
- **Pausar, detener y cambiar de chat.** Pausar o detener la voz detiene la boca. Si cambias de chat mientras se lee una respuesta, los avatares de allí se quedan quietos. Vuelve mientras la voz sigue sonando y el avatar la retoma.
- **Volumen.** **Line volume** (Volumen de línea) cambia lo fuerte que suena, no lo mucho que se abre la boca.
- **Personas.** La boca de una persona no se mueve con tus propios mensajes.
- **Game Mode.** Con el texto a voz y **Auto-play** activados, las bocas esperan la voz de su personaje y la siguen. Las líneas sin voz mantienen su animación por texto. Las voces del narrador y del jugador no mueven la boca de ningún personaje. Los pensamientos internos no se leen en voz alta.

La sincronización labial no cambia cómo se reproduce la voz. Marinara lee una copia aparte de cada clip para sincronizar la boca, así que la reproducción funciona como antes, también en Safari y en iPhone y iPad. Si el primer clip empieza antes de que la sincronización esté lista, su texto mueve la boca hasta que la sincronización con la voz toma el relevo. Si tu navegador no puede leer un clip, la voz se sigue reproduciendo y solo la boca deja de seguirla.

<a id="making-an-avatar-from-a-sprite"></a>

## Crear un avatar a partir de un sprite

En la página **2D Avatars**, elige un personaje o una persona y luego usa **Make an avatar from a sprite** (Crear un avatar a partir de un sprite). Funciona con los sprites que ya tiene. Tu avatar no cambia hasta que guardas un resultado, así que puedes probar todas las veces que quieras.

<a id="faces-from-the-avatar"></a>

### Caras a partir del avatar

**Make faces from the avatar** (Crear caras a partir del avatar) crea caras sin fondo, también para un personaje o una persona que todavía no tiene sprites. Necesita un avatar y una cuenta de generación de imágenes. Abre la misma generación de sprites que los editores de personajes y de personas, con el avatar como referencia.

1. Elige **All faces** (Todas las caras: las 29 emociones), **Main faces** (Caras principales: las seis) o elige tú las caras. Cada emoción extra está en la fila de su cara principal hasta que tiene su propia cara.
2. Las caras se dibujan por lotes, primero las principales. Los modelos GPT Image más antiguos dibujan una cara por imagen. Una imagen que falla se vuelve a intentar una vez. Si vuelve a fallar, el proceso se detiene con **Retry picture** (Reintentar imagen). **Cancel** (Cancelar) conserva las caras ya creadas.
3. Con **Expose media prompts before sending** (Mostrar los prompts de medios antes de enviar) activado, revisas todos los prompts a la vez antes de que se envíe el primero. Cada cara se dibuja con los ojos abiertos y la boca cerrada, para que las imágenes de parpadeo y de habla tengan algo que cerrar y abrir.
4. Marinara dibuja las caras sobre un color liso, quita ese color y las guarda como sprites del personaje o de la persona. Un sprite nuevo reemplaza al que tiene el mismo nombre, así que cámbiale el nombre en el último paso para conservar el anterior.

Cuando el avatar ya está guardado, cada cara nueva pasa a ser la cara de la emoción para la que se dibujó, aunque le hayas cambiado el nombre. Los otros sprites se quedan. Una cara que se vuelve a crear empieza sin imágenes de parpadeo ni de habla, porque las anteriores no coincidirían. Crea otras nuevas en [Imágenes de parpadeo y de habla](#blink-and-talk-pictures). Una importación de PNGTuber Plus conserva sus propias caras.

<a id="blink-and-talk-pictures"></a>

### Imágenes de parpadeo y de habla

Cada cara que muestra el avatar para una emoción es una fila, con sus imágenes **Eyes closed** (Ojos cerrados) y **Mouth open** (Boca abierta) junto a la **Face** (Cara). Son imágenes que guardaste, sprites `_blink` y `_talk` que añadiste, o unas nuevas. Con sprites de retrato, solo se usan esos, porque un avatar nunca mezcla caras de retrato y de cuerpo completo. Una cara que no es uno de tus sprites, como una de una importación de PNGTuber Plus, muestra sus imágenes, pero no puede recibir imágenes nuevas.

1. Revisa **Image model** (Modelo de imagen). Tu cuenta de imagen predeterminada ya viene elegida.
2. Haz clic en **Make** (Crear) para una imagen que falta, o en el botón **Make N pictures** (Crear N imágenes) para todas. Cada imagen es una solicitud de imagen. Con **Expose media prompts before sending** activado (en la configuración), ves y editas cada prompt primero.
3. Las imágenes nuevas aparecen de una en una. Selecciona **Keep** (Conservar) en las buenas y **Try again** (Intentar de nuevo) en las demás. **Try again** también vuelve a dibujar una imagen que ya tienes. La imagen que se está volviendo a dibujar se queda atenuada, con un indicador de carga. **Cancel** la detiene, también en el servidor. Si **Try again** falla, la imagen anterior se queda. Para rehacer una imagen conservada, selecciona primero **Kept** (Conservada) para soltarla.
4. Selecciona **Save kept pictures** (Guardar imágenes conservadas). Se convierten en las imágenes de parpadeo y de habla del avatar, junto a una copia del sprite a partir del cual se dibujaron, para que siempre queden alineadas. Si reemplazas un sprite antes de guardar, vuelve a crear sus imágenes.

Con una cuenta de imagen que acepta una imagen de referencia, tu sprite es la única referencia, con el tamaño y la forma que acepta el modelo, junto con un prompt que pide cambiar solo los ojos o la boca. Los modelos mueven, escalan o añaden márgenes a la imagen que devuelven, así que primero se alinea con tu sprite. Solo se toman de ella los ojos (para un parpadeo) o la boca (para hablar). Todo lo demás conserva los píxeles propios de tu sprite, así que el avatar no da saltos. Si los ojos no se cerraron, la boca no se abrió o la imagen estaba demasiado desplazada para alinearla, la imagen falla con un mensaje. Vuelve a intentarlo.

Algunas cuentas no pueden editar imágenes, como Pollinations, Together AI, Horde, DALL-E o un flujo de trabajo de ComfyUI sin un espacio para una imagen de referencia. Con una de ellas, **Make** dibuja una cara nueva con sus imágenes de parpadeo y de habla en una sola imagen, para que las tres coincidan, como hace [Caras a partir del avatar](#faces-from-the-avatar). La fila muestra **New face** (Cara nueva). **Keep** conserva juntas la cara y las dos imágenes, y al guardar, la cara nueva pasa a ser la cara de esa emoción. Tu sprite no cambia. Esto necesita una apariencia o una descripción en el personaje o la persona.

<a id="mesh-avatar"></a>

### Avatar de malla

1. Elige un **Sprite to use** (Sprite que se usará). El sprite neutral de cuerpo completo ya viene elegido cuando hay uno. Funciona mejor un sprite de frente, de cuerpo completo o de busto.
2. Elige el **Chat provider that can see pictures** (Proveedor de chat que puede ver imágenes). **The agent's provider** (El proveedor del agente) usa el que está configurado en la página de 2D Avatars y, si no hay ninguno, tu cuenta de agentes predeterminada. Su modelo debe aceptar imágenes.
3. Selecciona **Make mesh avatar** (Crear avatar de malla). El modelo de chat encuentra la cara, y Marinara construye el avatar a partir de tu sprite tal cual. **Cancel** lo detiene.
4. Revisa la vista previa: los contornos deben quedar sobre los ojos, las cejas y la boca. Selecciona **Save as mesh avatar** (Guardar como avatar de malla), o **Discard** (Descartar) y prueba con otro sprite u otro modelo.

Un avatar de malla generado mueve la cabeza, los ojos, las cejas y la boca, y parpadea y habla con sus propios párpados y su propia boca. El cabello se mueve con la cabeza. Las manos, los mechones de cabello sueltos y los accesorios colgantes no tienen rigging. Los sprites pequeños se construyen a partir de una copia más grande para que la boca encaje en la cara. Cuando la cara ocupa la mayor parte de un sprite grande, se usa una copia más pequeña para que siga siendo rápido.

Tu sprite se envía a la cuenta de imagen para las imágenes de parpadeo y de habla (y a su cuenta de imagen de respaldo si hay una configurada y acepta una referencia), y al modelo de chat para un avatar de malla. Una cuenta que no puede editar imágenes solo recibe el prompt, que incluye la apariencia. Los prompts vienen con el agente 2D Avatars. Con **Expose media prompts before sending** activado, puedes leer y cambiar cada prompt. Con el modo de depuración activado, cada prompt se escribe en el registro del servidor.

## Crea tu propio modelo

Un personaje o una persona puede usar sus sprites de expresión como avatar PNGTuber sin dibujar nada. [Crear un avatar a partir de un sprite](#making-an-avatar-from-a-sprite) añade imágenes de parpadeo y de habla o construye un avatar de malla por ti. Para crear tu propio modelo, usa una de estas herramientas. Importa cada archivo en la página del agente en **Agents** y activa **Show this avatar in chats**.

| Lo que quieres | Herramienta | Lo que obtienes |
| --- | --- | --- |
| Sprites PNGTuber | Cualquier app de dibujo y luego la pestaña **Sprites** del personaje | Los sprites |
| Sprites PNGTuber con capas y disfraces | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | Un archivo `.save` |
| Un avatar de malla | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | Un archivo `.mavatar` |
| Un modelo 3D | [VRoid Studio](https://vroid.com/en/studio), o Blender con el complemento [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | Un archivo `.vrm` y, si quieres, una animación en reposo `.vrma` |

### Tus propios sprites

1. Dibuja una imagen por cada emoción, todas del mismo tamaño y con el personaje en el mismo lugar. Ponle a cada una el nombre de su emoción: `neutral`, `happy`, `angry`, `sad`, `relaxed`, `surprised`. También funcionan los nombres que contienen una palabra de emoción, como `smile`, `cry`, `calm` o `shock`. Para las [emociones adicionales](#pngtuber-sprites) opcionales, ponles a las imágenes nombres como `amusement`, `fear` o `gratitude`.
2. Para que la boca se mueva, dibuja la misma imagen con la boca abierta y añade `_talk`, por ejemplo `happy_talk`. Para el parpadeo, cierra los ojos y añade `_blink`. Para las dos cosas, añade `_blink_talk`.
3. En la pestaña **Sprites** del personaje o de la persona, en **Facial Expressions** (Expresiones faciales), añade las imágenes. **Upload Folder** (Subir carpeta) añade una carpeta y le pone a cada sprite el nombre de su archivo. Consulta [Sprites de personaje](../characters/sprites.md).
4. Abre **2D Avatars** en **Agents**, elige el personaje o la persona y activa **Show this avatar in chats**.

### PNGTuber Plus

1. Construye el avatar con capas separadas. Muestra la boca abierta solo al hablar y la boca cerrada solo en silencio. Muestra los ojos cerrados solo al parpadear y los ojos abiertos solo cuando no parpadea.
2. Para cada emoción, crea un disfraz que cambie los ojos o la boca, y ponles a esas imágenes el nombre de la emoción, por ejemplo `angry eyes.png` o `happy_mouth.png`. Las emociones específicas funcionan igual, como `fear eyes.png`. El disfraz 1 es la cara en reposo.
3. Guarda el avatar para obtener un archivo `.save`.
4. Abre **2D Avatars** en **Agents**, elige el personaje o la persona, luego **PNGTuber sprites** y después **Import PNGTuber Plus save**. Elige una cara para cualquier emoción que los nombres no cubrieron.

### Mesh Avatar Studio

1. Empieza con una imagen de frente de cabeza y hombros con fondo transparente. Mesh Avatar Studio se ejecuta en tu computadora con Node.js, y un agente de programación como Claude Code o Codex hace el rigging de la imagen. Su README te guía paso a paso.
2. Opcional: añade ojos y bocas dibujados en **Drawn variants**. Marinara usa las formas de boca `mouth_a`, `mouth_i`, `mouth_o` y `mouth_a_half`, y los ojos cerrados `eyes_closed_0` y `eyes_closed_1`. Todo avatar de malla trae las seis emociones integradas, así que no hay nada que nombrar.
3. Elige **Export .mavatar**. No comprimas tú la carpeta del proyecto en un ZIP.
4. Abre **2D Avatars** en **Agents**, elige el personaje o la persona, luego **Mesh avatar** y después **Import .mavatar file**.

### VRoid Studio

1. Crea el personaje en VRoid Studio. Sus caras, formas de boca y parpadeo son expresiones VRM estándar y se encuentran automáticamente.
2. Exporta como VRM (1.0 o 0.0). Rellena los datos y las condiciones del modelo cuando te lo pida.
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

- **Compresión.** La compresión Draco o meshopt y las texturas KTX2 no se cargan. Las exportaciones VRM de arriba nunca las usan, pero la exportación glTF simple de Blender ofrece Draco, y los optimizadores de modelos pueden añadir las tres. Vuelve a exportar con la compresión desactivada.
- **glTF simple.** Un `.glb` simple no tiene los datos VRM que nombran las caras y el esqueleto. Impórtalo como **GLB or FBX model**, o exporta un `.vrm`.
- **Archivos separados.** No se puede usar un modelo cuyas texturas o datos están en archivos separados. Exporta un solo archivo `.vrm`.
- **Extras de PNGTuber Plus.** El bamboleo, el arrastre y la animación no se transfieren. Cada capa se muestra en reposo, y una capa animada muestra su primer fotograma.

## Rendimiento y dispositivos

El código de dibujo de cada tipo de avatar solo se descarga la primera vez que se muestra un avatar de ese tipo, así que los chats sin avatares no cargan nada extra.

| | Teléfonos | Computadoras |
| --- | --- | --- |
| Avatares dibujados a la vez | Sin límite fijo | Sin límite fijo |
| Fotogramas por segundo al hablar | 30 | 30 |
| Fotogramas por segundo en reposo | 20, o 15 cuando el teléfono está ocupado | 30 |
| Nitidez (proporción de píxeles) | hasta 1,5× | hasta 2× |

Un chat muestra todos los avatares configurados y activados en el orden de sus personajes y luego tu persona. Ajusta el tamaño y la disposición de los integrantes a tu pantalla. Los avatares dejan de dibujarse mientras la pestaña está oculta, la ventana está en segundo plano, los ajustes de Appearance (Apariencia) están abiertos, o el chat está fuera de la pantalla o tapado por un panel o un editor. Con **Reduce Ambient Animations & Effects** (Reducir animaciones y efectos ambientales) o el ajuste de movimiento reducido de tu dispositivo activado, los avatares siguen cambiando de cara y moviendo la boca, pero omiten la respiración, el balanceo y las poses de espera.

## Guías relacionadas

- [Agentes: ayudantes de IA para tus chats](agents-overview.md)
- [Referencia de agentes descargables](built-in-agents.md)
