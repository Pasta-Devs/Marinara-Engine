# Fondos de Roleplay

Un chat de Roleplay muestra una imagen de escena completa detrás de tus mensajes. Puedes dejar que el agente **Background** (Fondo) la elija después de cada respuesta, crear una nueva a mano o fijar una imagen a un solo chat. Cuando la imagen cambia, Marinara hace un fundido de la antigua a la nueva.

La generación de imágenes no es obligatoria. Sin una cuenta de generación de imágenes, el fondo es un color sólido y el chat funciona como texto.

## Fijar un fondo para un solo chat

Usa esto para mantener una imagen detrás del chat que tienes abierto, en lugar de dejar que el agente elija. Solo cambia ese chat.

1. Abre el chat. Luego abre **Settings → Appearance** (Configuración → Apariencia) y busca **Backgrounds** (Fondos).
2. En **Chat Background** (Fondo del chat), elige una imagen subida o uno de los fondos de tus recursos de juego.

Ves la imagen detrás de tus mensajes. Para volver al fondo predeterminado, haz clic en **Remove** (Quitar) junto a **Chat Background**.

¿Todavía no tienes imágenes? Sube una primero. Consulta [Fondos del chat](../appearance/chat-backgrounds.md).

## Dejar que el agente Background elija el fondo

El agente **Background** es un ayudante que se ejecuta junto con las respuestas. Después de cada respuesta, lee la escena actual y elige, de entre todos tus fondos, la imagen que mejor encaja. Solo elige imágenes existentes. El agente **Illustrator** (Ilustrador) crea imágenes nuevas automáticamente.

1. Abre tu chat de Roleplay.
2. Abre **Chat Settings** (Ajustes del chat) con el botón de controles deslizantes del chat.
3. Abre **Agents** (Agentes) y activa **Enable Agents**.
4. Añade el agente **Background**.

Ahora el fondo cambia por sí solo a medida que la historia se mueve entre lugares.

Si no funcionó: con solo uno o dos fondos, el agente sigue eligiendo esos. Añade más a tu biblioteca. Consulta [Fondos del chat](../appearance/chat-backgrounds.md).

## Reutilizar imágenes que ya tienes

Cuando Illustrator crea fondos por su cuenta y la historia se traslada a un lugar nuevo, primero comprueba si hay un fondo que fijaste a ese lugar (consulta [Fijar un fondo a un lugar](#pin-a-background-to-a-place)). En un lugar fijado no pinta nada. Si no, busca en tu biblioteca de fondos. Una imagen sirve para un lugar cuando su nombre de archivo, o una de sus etiquetas de dos o más palabras, aparece en la ubicación de World State. Por ejemplo, `john-bedroom.png` sirve para "Smith House, John's bedroom". Las mayúsculas, los acentos y "'s" no importan, y el nombre más específico tiene prioridad sobre un simple `bedroom.png`.

Sin una ubicación de World State, el nombre del lugar que Illustrator escribe para el fondo nuevo se compara de la misma manera. Si una imagen encaja, se muestra y no se pinta nada. Solo se crea una imagen nueva para un lugar sin coincidencias.

Para asegurarte de que un lugar conserve su imagen, dale al archivo el nombre del lugar (`kitchen.png` para "Kitchen"). Una etiqueta también funciona cuando tiene dos o más palabras, como `smith house kitchen`; se ignoran las etiquetas de una sola palabra como `kitchen` o `night`, porque suelen describir el aspecto de una imagen.

## Generar un fondo a mano

Marinara construye un prompt de imagen a partir de la escena (género, ambientación, ubicación, clima y hora) y crea un fondo nuevo.

Antes de empezar: instala el agente **Illustrator** y asígnale una cuenta de generación de imágenes, o marca una cuenta de generación de imágenes como predeterminada. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md). No necesitas añadir Illustrator al chat.

1. Abre **Chat Settings** con el botón de controles deslizantes del chat y despliega **Gallery** (Galería).
2. Haz clic en **Background**. Muestra **Generating...** (Generando...) mientras trabaja, y la Gallery dice "Illustrator is generating a background image for this scene." (Illustrator está generando una imagen de fondo para esta escena).
3. Espera a que termine. La nueva imagen se añade a tu biblioteca de fondos y se aplica a la escena.

La generación manual usa la cuenta de imágenes del agente Illustrator y, después, tu cuenta de generación de imágenes predeterminada. Funciona en los modos Roleplay y Game, no en Conversation.

Si no funcionó: el mensaje "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." (Elige una conexión de generación de imágenes para el agente Illustrator, o marca una como la conexión de imágenes predeterminada) significa que Marinara no encontró ninguna cuenta de imágenes. Configura una y vuelve a intentarlo. Si falta el botón **Background**, Illustrator no está instalado.

## Fijar un fondo a un lugar

Usa esto cuando un lugar de tu historia deba verse siempre igual: la habitación de John siempre muestra `john-bedroom` y tu propia habitación siempre muestra `my-bedroom`. Cuando la historia llega a un lugar fijado, se muestra su imagen, sin importar lo que hubiera elegido el agente Background.

1. Abre **Chat Settings** con el botón de controles deslizantes del chat y abre **Background**.
2. En **Pinned places** (Lugares fijados), haz clic en **Add place** (Agregar lugar).
3. Haz clic en la imagen vacía y elige el fondo. Escribe el lugar tal como lo escribe la historia, por ejemplo `John's bedroom`.
4. Opcional: debajo, añade otros nombres que la historia podría usar, separados por comas, como `John's room, the master bedroom`.

Más rápido: cuando la historia esté en un lugar y se muestre la imagen correcta, haz clic en **Pin this picture to "John's bedroom"** (Fijar esta imagen a "John's bedroom").

Cómo se distinguen los lugares:

- El nombre más específico tiene prioridad. `John's bedroom` y `{{user}}'s bedroom` nunca se confunden, y un fondo fijado simplemente a `bedroom` solo se usa para habitaciones que nadie haya fijado.
- Una o dos palabras intermedias no impiden la coincidencia: "John's guest bedroom" coincide con `John's bedroom`, salvo que otro fondo fijado nombre ese lugar exactamente.
- `{{user}}` es el nombre de tu persona y `{{char}}` el de cualquier personaje del chat, así que `{{user}}'s bedroom` coincide con "Alyssa's bedroom".
- "My" y "our" pertenecen a quien escribió el mensaje. Cuando la respuesta de John dice que la historia está en "my bedroom", es la habitación de John; "your bedroom" en su respuesta es la tuya. En tu propio mensaje, "your bedroom" es la del personaje cuando solo hay uno en el chat.
- Las mayúsculas, los acentos y los apóstrofos no importan. Los nombres coinciden con palabras completas: `John` nunca coincide con "Johnson".
- Con **World Maps**, elige el lugar de la lista **World Maps place** (Lugar de World Maps). Un edificio fijado también abarca sus habitaciones que no tengan un fondo fijado propio.

Qué ocurre:

- La imagen se muestra una vez al llegar. Si eliges otro fondo a mano mientras estás allí, el tuyo permanece hasta que la historia se traslada a otro lugar.
- En un lugar fijado, el agente Background no puede cambiar la imagen e Illustrator no pinta un fondo nuevo para él.
- Necesita la ubicación del agente **World State** (Estado del mundo) o World Maps. Al pie de la lista se muestra dónde está ahora la historia, y **Here** (Aquí) marca el fondo fijado en uso. Los fondos fijados funcionan en los chats de Roleplay.

Si no funcionó: comprueba que **Story is at** (La historia está en), debajo de la lista, muestre el lugar y que uno de los nombres del fondo fijado aparezca allí.

### Fondos que acompañan a un personaje

Una imagen de la **Gallery** de un personaje (o una persona) etiquetada como fondo aparece en todos los chats en los que esté ese personaje, sin tener que fijarla en cada chat.

1. Abre la **Gallery** del personaje, haz clic en el botón de etiqueta de una imagen y elige **Use as background** (Usar como fondo).
2. Escribe los lugares que muestra, separados por comas, como `{{char}}'s bedroom, {{char}}'s room`. En la galería de un personaje, `{{char}}` es ese personaje; en la de una persona, `{{user}}` es esa persona. Déjalo vacío si la imagen no representa un lugar concreto.

Las imágenes que nombran lugares funcionan como lugares fijados en todos los chats con ese personaje y aparecen en **Pinned places** dentro de **Chat Settings → Background** (Ajustes del chat → Fondo). Un fondo fijado en el propio chat tiene prioridad sobre una imagen de galería con el mismo nombre.

## Tu biblioteca y el desenfoque

Las imágenes entre las que eliges están en la misma sección **Backgrounds**. La importación, las etiquetas, el cambio de nombre, la eliminación, el control deslizante **Background Blur** (Desenfoque del fondo) y el fondo predeterminado para los chats de Roleplay nuevos se explican en [Fondos del chat](../appearance/chat-backgrounds.md).

## Guías relacionadas

- [Fondos del chat](../appearance/chat-backgrounds.md): la biblioteca de imágenes subidas y los controles de apariencia.
- [Fondos de escena](../media/scene-backgrounds.md): arte de escena con IA creado desde tu Gallery.
- [Roleplay Mode: primeros pasos](getting-started.md): el escenario de Roleplay, los sprites y el HUD.
