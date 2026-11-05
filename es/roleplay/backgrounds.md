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

## Generar un fondo a mano

Marinara construye un prompt de imagen a partir de la escena (género, ambientación, ubicación, clima y hora) y crea un fondo nuevo.

Antes de empezar: instala el agente **Illustrator** y asígnale una cuenta de generación de imágenes, o marca una cuenta de generación de imágenes como predeterminada. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md). No necesitas añadir Illustrator al chat.

1. Abre **Chat Settings** con el botón de controles deslizantes del chat y despliega **Gallery** (Galería).
2. Haz clic en **Background**. Muestra **Generating...** (Generando...) mientras trabaja, y la Gallery dice "Illustrator is generating a background image for this scene." (Illustrator está generando una imagen de fondo para esta escena).
3. Espera a que termine. La nueva imagen se añade a tu biblioteca de fondos y se aplica a la escena.

La generación manual usa la cuenta de imágenes del agente Illustrator y, después, tu cuenta de generación de imágenes predeterminada. Funciona en los modos Roleplay y Game, no en Conversation.

Si no funcionó: el mensaje "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." (Elige una conexión de generación de imágenes para el agente Illustrator, o marca una como la conexión de imágenes predeterminada) significa que Marinara no encontró ninguna cuenta de imágenes. Configura una y vuelve a intentarlo. Si falta el botón **Background**, Illustrator no está instalado.

## Tu biblioteca y el desenfoque

Las imágenes entre las que eliges están en la misma sección **Backgrounds**. La importación, las etiquetas, el cambio de nombre, la eliminación, el control deslizante **Background Blur** (Desenfoque del fondo) y el fondo predeterminado para los chats de Roleplay nuevos se explican en [Fondos del chat](../appearance/chat-backgrounds.md).

## Guías relacionadas

- [Fondos del chat](../appearance/chat-backgrounds.md): la biblioteca de imágenes subidas y los controles de apariencia.
- [Fondos de escena](../media/scene-backgrounds.md): arte de escena con IA creado desde tu Gallery.
- [Roleplay Mode: primeros pasos](getting-started.md): el escenario de Roleplay, los sprites y el HUD.
