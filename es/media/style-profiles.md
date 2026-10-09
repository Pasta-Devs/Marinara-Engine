# Perfiles de estilo de imagen

Esta guía explica los perfiles de estilo de imagen en Marinara Engine. Un perfil de estilo es un "estilo de la casa" reutilizable que da forma a cada prompt (instrucciones enviadas a la IA) de imagen antes de que Marinara lo envíe a tu proveedor de imágenes. Úsalo para que avatares, retratos, selfies, fondos, ilustraciones y sprites (imágenes del personaje) tengan un aspecto consistente.

## Qué es un perfil de estilo

Marinara Engine puede generar muchos tipos de imágenes: avatares de personaje y de persona, retratos, selfies del modo Conversation, fondos de escena, ilustraciones dentro de la escena y sprites de personaje. Cada una de esas imágenes empieza como un prompt de texto.

Un perfil de estilo es un conjunto guardado de reglas que Marinara añade a ese prompt de texto. Puede añadir palabras positivas (lo que quieres), palabras negativas (lo que quieres evitar) y un estilo de prompt preferido. Esto mantiene un mismo aspecto en cada imagen, así no tienes que volver a escribir las mismas palabras de estilo cada vez.

Eliges un perfil como predeterminado para toda la app. Puedes anularlo para un solo chat o una sola conexión de imagen. Todo eso se explica más abajo.

Para encontrar el editor, sigue estos pasos.

1. Abre **Settings** (Configuración).
2. Abre la pestaña **Generations**.
3. Busca la sección **Image Generation**.
4. Desplázate hasta **Style Profiles**.

## Los perfiles integrados

Marinara viene con 10 perfiles de estilo integrados. **Auto** es el predeterminado. Puedes editar cualquiera de ellos, y puedes restablecer un perfil integrado a sus valores originales en cualquier momento.

Algunos términos que se usan más abajo:

- SDXL significa Stable Diffusion XL. Es un modelo de imagen abierto y popular que puedes ejecutar en tu propia computadora o a través de un servicio en la nube.
- Un checkpoint es un archivo de modelo de imagen ya entrenado. La gente descarga distintos checkpoints para distintos estilos de arte. Los ejemplos nombrados en estos perfiles son Illustrious, Pony y NovelAI.
- Danbooru es un gran sitio web de imágenes de anime. Sus etiquetas cortas separadas por comas (como "1girl, long hair, smile") se convirtieron en una forma común de escribir prompts para modelos de imagen de anime.

Los perfiles integrados son:

- **Off**: no añade ningún estilo de la casa. Tu prompt se envía casi tal como lo escribiste.
- **Auto**: deduce un aspecto consistente a partir del personaje, el juego, la escena y el modelo de imagen seleccionado. Este es el perfil predeterminado.
- **Anime**: etiquetas generales de estilo anime para arte de personaje limpio.
- **Danbooru / Illustrious**: etiquetas al estilo Danbooru pensadas para checkpoints de anime SDXL como Illustrious, Pony y NovelAI.
- **Realistic SDXL**: realismo en lenguaje natural para modelos SDXL.
- **Photorealistic**: prompts de estilo fotográfico con piel, iluminación y materiales creíbles.
- **Cinematic**: iluminación dramática y composición fuerte para arte principal.
- **Digital Painting**: pinceladas de arte conceptual e iluminación diseñada.
- **Painterly Fantasy**: ilustración de fantasía pictórica y suave.
- **Z-Image Turbo Narrative**: prosa compacta para modelos Z-Image Turbo, que leen bien las frases sencillas.

## Cambiar el estilo global

El perfil predeterminado global se aplica a cada imagen generada, a menos que un chat o una conexión lo anulen. Para cambiarlo, sigue estos pasos.

1. Abre **Settings**, luego la pestaña **Generations**, luego **Image Generation**, luego **Style Profiles**.
2. Abre el menú desplegable **Default style**.
3. Elige el perfil que quieres usar en toda la app.

Tu elección se guarda de inmediato. Las imágenes nuevas usan el perfil que elegiste.

## Clonar y personalizar un perfil

Puedes editar un perfil integrado en el sitio, pero el botón **Clone** te permite conservar el original y crear tu propia versión. Para crear y personalizar un perfil, sigue estos pasos.

1. Abre el menú desplegable **Editing** y elige el perfil más parecido a lo que quieres.
2. Haz clic en **Clone**. Marinara hace una copia, la selecciona para editar e inmediatamente convierte la copia en tu estilo predeterminado de toda la app.
3. Cambia el campo **Name** por algo que reconozcas.
4. Elige una **Prompt grammar** (se explica en la siguiente sección).
5. Rellena **Style text** con una descripción simple del aspecto que quieres. Cuando una IA escribe el prompt de imagen, como hacen el Illustrator, los selfies y Noodle, sigue tu Style text en lugar de copiarlo. A otras imágenes, como los avatares, se les puede añadir el Style text tal como está escrito.
6. Añade **Positive tags** (palabras que incluir) y **Negative tags** (palabras que evitar).
7. Abre la sección **Per-image tags** para añadir etiquetas extra para cada tipo de imagen (avatar, retrato, selfie, fondo, ilustración, sprite).
8. Tu clon se convirtió en el predeterminado de toda la app en el paso 2. Para devolver ese papel a otro perfil, abre **Default style** y elige el perfil que quieras.

Dos botones te ayudan a gestionar los perfiles:

- **Reset** funciona solo en perfiles integrados. Restaura ese perfil integrado a sus valores originales.
- **Delete** funciona solo en perfiles que creaste tú, y solo mientras exista más de un perfil.

## Modos de gramática de prompt

El menú desplegable **Prompt grammar** le dice a Marinara cómo prefiere el modelo de imagen leer un prompt. Elige el modo que coincida con tu modelo de imagen. Hay cuatro modos.

- **Hybrid**: una mezcla de frases y etiquetas. Una opción general segura.
- **Danbooru tags**: etiquetas cortas separadas por comas al estilo Danbooru. Lo mejor para checkpoints de anime SDXL como Illustrious, Pony y NovelAI.
- **Tags**: palabras clave cortas separadas por comas, sin la convención de Danbooru.
- **Natural language**: frases simples. Lo mejor para modelos que leen prosa, como DALL-E y los modelos Z-Image Turbo.

## El Test bench

La sección **Test bench** (banco de pruebas) te deja previsualizar exactamente lo que Marinara enviaría, sin generar una imagen real. Ábrela dentro del editor de Style Profiles. Para usarla, sigue estos pasos.

1. Elige un **Image kind** (por ejemplo, retrato o fondo).
2. Escribe un prompt aproximado en **Sample input**.
3. Lee los cuadros **Final positive prompt** y **Final negative prompt**.

El Test bench también muestra una nota corta sobre la limpieza. Cuando no cambia nada, dice "No cleanup needed for this sample." (No se necesita limpieza para esta muestra). Cuando edita tu prompt, dice cuántos fragmentos duplicados o mal colocados limpió.

## Cómo limpia Marinara el prompt

Antes de que cualquier solicitud de imagen salga de Marinara, este compila tu prompt con el perfil activo. El compilador hace algunas cosas:

- Elimina etiquetas casi duplicadas, como una etiqueta de calidad repetida.
- Mueve frases negativas simples (como "avoid text" o "no watermark") al prompt negativo.
- Mantiene tus propias palabras en las imágenes de fondo, ilustración y selfie. Para las imágenes de retrato, avatar y sprite, destila tus palabras hasta dejar etiquetas visuales cortas que reconoce.
- Añade las etiquetas por imagen del perfil para el tipo de imagen que se está creando.

## Ejemplo de antes y después

Digamos que eliges el perfil **Danbooru / Illustrious**, pones **Image kind** en retrato y escribes esto en **Sample input**:

```
masterpiece, masterpiece, red-haired knight, no watermark
```

El Test bench muestra entonces este **Final positive prompt**:

```
detailed eyes, solo, upper body, portrait, looking at viewer, anime screencap, masterpiece, best quality, absurdres
```

Pasaron tres cosas:

- "no watermark" salió del prompt positivo y pasó al **Final negative prompt**. La nota de limpieza cuenta este cambio.
- El perfil añadió sus propias etiquetas de estilo, sus etiquetas por imagen de retrato y sus etiquetas de calidad. El "masterpiece" del resultado viene de las etiquetas del propio perfil, no de las palabras que escribiste.
- Tus palabras escritas fueron destiladas. Para las imágenes de retrato, el compilador mantiene solo los fragmentos que reconoce como señales visuales claras. "red-haired knight" no es una de ellas, así que se descartó.

Si tus palabras del sujeto desaparecen en un retrato, avatar o sprite, prueba el tipo de imagen **illustration** en su lugar. Ese tipo mantiene tus propias palabras.

## Orden de prioridad: chat, conexión y luego global

Marinara puede tomar un perfil de estilo de tres lugares. Gana la elección más específica. El orden es:

1. Un perfil explícito elegido para el chat o el juego actual.
2. El **Style Profile** definido en la conexión de imagen (bajo **Local Image Defaults** en el editor de la conexión).
3. El **Default style** global que definiste en **Settings**.

La sección **Local Image Defaults** aparece solo para las conexiones locales de Stable Diffusion (AUTOMATIC1111 / SD Web UI, ComfyUI y NovelAI). Para cualquier otro proveedor, la elección pasa directamente al **Default style** global. Para definir un perfil por conexión, abre la conexión, despliega **Local Image Defaults** y elige un perfil en el menú desplegable **Style Profile**. Déjalo en **Use global default** para seguir la elección global. Cuando Marinara puede adivinar un buen perfil a partir del nombre del modelo de la conexión, muestra un botón "Use ..." que aplica ese perfil con un solo clic.

## Guías relacionadas

- [Proveedores de generación de imágenes y configuración](image-providers.md)
- [Illustrator Agent](illustrator-agent.md)
- [Selfies](../conversation/selfies.md)
