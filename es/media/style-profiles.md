# Perfiles de estilo de imagen

Un perfil de estilo es un "estilo de la casa" reutilizable que da forma a cada prompt (instrucciones enviadas a la IA) de imagen antes de que Marinara lo envíe a tu servicio de imágenes. Úsalo para que avatares, retratos, selfies, fondos, ilustraciones y sprites (imágenes del personaje) tengan un aspecto consistente. Esta guía muestra cómo elegir, editar y probar uno.

## Qué es un perfil de estilo

Cada imagen generada empieza como un prompt de texto: avatares, retratos, selfies de Conversation, fondos de escena, ilustraciones y sprites. Un perfil de estilo es un conjunto guardado de reglas que Marinara añade a ese prompt. Puede añadir palabras positivas (lo que quieres), palabras negativas (lo que quieres evitar) y un estilo de prompt preferido. Eliges un perfil como predeterminado para toda la app. Puedes anularlo para un solo chat o un solo modelo de imagen.

Para encontrar el editor, abre **Settings → Generations → Image Generation** (Configuración → Generaciones → Generación de imágenes) y desplázate hasta **Style Profiles**.

## Los perfiles integrados

Marinara tiene 10 perfiles de estilo integrados. **Auto** es el predeterminado. Puedes editar cualquiera de ellos y restablecer un perfil integrado a sus valores originales en cualquier momento.

Términos que se usan más abajo:

- SDXL es Stable Diffusion XL, un modelo de imagen abierto y popular que puedes ejecutar en tu computadora o a través de un servicio en la nube.
- Un checkpoint es un archivo de modelo de imagen ya entrenado. Illustrious, Pony y NovelAI son ejemplos que se nombran aquí.
- Danbooru es un gran sitio web de imágenes de anime. Sus etiquetas cortas separadas por comas, como "1girl, long hair, smile", se convirtieron en una forma común de escribir prompts para modelos de imagen de anime.

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

El perfil predeterminado se aplica a cada imagen, a menos que un chat o un modelo de imagen lo anulen.

1. Abre **Settings → Generations → Image Generation → Style Profiles**.
2. Abre la lista **Default style** (Estilo predeterminado).
3. Elige un perfil.

Tu elección se guarda de inmediato, y las imágenes nuevas la usan.

## Clonar y personalizar un perfil

Puedes editar un perfil integrado en el sitio, o usar **Clone** para conservar el original y crear el tuyo.

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

**Prompt grammar** le dice a Marinara cómo prefiere el modelo de imagen leer un prompt. Elige el modo que coincida con tu modelo.

- **Hybrid**: una mezcla de frases y etiquetas. Una opción general segura.
- **Danbooru tags**: etiquetas cortas separadas por comas al estilo Danbooru. Lo mejor para checkpoints de anime SDXL como Illustrious, Pony y NovelAI.
- **Tags**: palabras clave cortas separadas por comas, sin la convención de Danbooru.
- **Natural language**: frases simples. Lo mejor para modelos que leen prosa, como DALL-E y los modelos Z-Image Turbo.

## El Test bench

El **Test bench** (banco de pruebas), dentro del editor de Style Profiles, previsualiza exactamente lo que Marinara enviaría, sin crear una imagen real.

1. Elige un **Image kind** (por ejemplo, retrato o fondo).
2. Escribe un prompt aproximado en **Sample input**.
3. Lee los cuadros **Final positive prompt** y **Final negative prompt**.

El Test bench también muestra una nota corta sobre la limpieza. Cuando no cambia nada, dice "No cleanup needed for this sample." (No se necesita limpieza para esta muestra). Cuando edita tu prompt, dice cuántos fragmentos duplicados o mal colocados limpió.

## Cómo limpia Marinara el prompt

Antes de que cualquier solicitud de imagen salga de Marinara, la app compila tu prompt con el perfil activo. El compilador:

- elimina etiquetas casi duplicadas, como una etiqueta de calidad repetida;
- mueve frases negativas simples como "avoid text" o "no watermark" al prompt negativo;
- mantiene tus propias palabras en las imágenes de fondo, ilustración y selfie, pero destila tus palabras hasta dejar etiquetas visuales cortas que reconoce en las imágenes de retrato, avatar y sprite; y
- añade las etiquetas por imagen del perfil para el tipo de imagen que se está creando.

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

Marinara puede tomar un perfil de estilo de tres lugares. Gana la elección más específica.

1. Un perfil elegido para el chat o el juego actual.
2. El perfil de estilo definido en el modelo de imagen, bajo **Local image defaults** (Valores predeterminados de imagen local) en su editor.
3. El **Default style** global en **Settings**.

La sección **Local image defaults** aparece solo para AUTOMATIC1111 / SD Web UI, ComfyUI y NovelAI. Para cualquier otro servicio, la elección pasa al **Default style** global. Para definir un perfil por modelo, abre el modelo de imagen, despliega **Local image defaults** y elige un perfil en la lista de perfiles de estilo. Déjalo en **Use global default** (Usar el predeterminado global) para seguir la elección global. Cuando Marinara puede adivinar un buen perfil a partir del nombre del modelo, muestra un botón "Use ..." que lo aplica con un solo clic.

## Guías relacionadas

- [Proveedores de generación de imágenes y configuración](image-providers.md)
- [Agente Illustrator](illustrator-agent.md)
- [Selfies](../conversation/selfies.md)
