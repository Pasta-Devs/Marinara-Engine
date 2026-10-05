# Fondos de Roleplay

Esta guía cubre el fondo de escena en Roleplay Mode: el agente **Background** (Fondo) que elige un fondo por ti después de cada respuesta, cómo crear un fondo a mano y cómo fijar uno a un solo chat. Tu biblioteca de fondos subidos y sus controles se cubren en [Chat Backgrounds](../appearance/chat-backgrounds.md), y el arte de escena creado con IA desde la Gallery se cubre en [Scene Backgrounds](../media/scene-backgrounds.md).

## El fondo de escena

Roleplay Mode muestra un fondo de escena completo detrás de tus mensajes. Cuando el fondo cambia, Marinara hace una transición suave con fundido de la imagen antigua a la nueva, para que los cambios de escena se sientan tranquilos en vez de bruscos.

No necesitas generación de imágenes para que esto funcione. Si no has configurado una conexión de generación de imágenes, el fondo se muestra como un color sólido. Tu chat sigue funcionando como un chat de texto normal.

## El agente Background

El agente **Background** es un ayudante opcional que elige un fondo de escena por ti. Se ejecuta después de cada respuesta. Lee la escena actual y luego elige la imagen más adecuada de entre todos los fondos disponibles. Las carpetas de la biblioteca son solo una ayuda de organización en **Settings** (Configuración) y nunca ocultan opciones al agente. Solo selecciona imágenes existentes; la generación automática de fondos corresponde al agente **Illustrator** (Ilustrador).

El agente **Background** está desactivado de forma predeterminada. Para activarlo:

1. Abre tu chat de Roleplay.
2. Abre **Chat Settings** (Ajustes del chat) con su botón en el chat. Está arriba a la derecha, salvo que lo hayas movido.
3. Abre la sección **Agents** (Agentes).
4. Activa el agente **Background**.

Después de eso, el fondo de escena se actualiza por sí solo a medida que tu historia se mueve entre lugares.

## Generar un fondo a mano

También puedes crear un fondo nuevo tú mismo, sin el agente. Marinara construye un prompt de imagen a partir de la escena (su género, ambientación, ubicación actual, clima y hora) y crea un fondo nuevo.

1. Abre **Chat Settings** y despliega **Gallery** (Galería).
2. Haz clic en el botón **Background**.
3. Espera a que el botón termine. Muestra **Generating...** (Generando...) mientras trabaja.

Mientras se ejecuta, ves esta nota: **AI background generation is running. The new background will be applied when it finishes.** (La generación de fondo con IA está en curso. El nuevo fondo se aplicará cuando termine.) La nueva imagen se añade a tu biblioteca de fondos y se aplica a la escena.

La generación manual usa la conexión de imágenes del agente **Illustrator** y, si no la encuentra, recurre a tu conexión de generación de imágenes predeterminada. El agente **Background** no necesita una conexión de imágenes porque solo selecciona imágenes que ya están en tu biblioteca. Si Marinara no puede encontrar una conexión, la generación falla con este mensaje: **Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.** (Elige una conexión de generación de imágenes para el agente Illustrator, o marca una como la conexión de imágenes predeterminada.)

La generación de fondos de escena funciona solo en los modos Roleplay y Game. No está disponible en Conversation mode.

## Fijar un fondo para un solo chat

Puedes fijar un fondo específico al chat que estás viendo, en lugar de dejar que el agente elija.

1. Abre **Settings**.
2. Abre la pestaña **Appearance** (Apariencia).
3. Busca la sección **Backgrounds** (Fondos).
4. En **Chat Background** (Fondo del chat), elige una imagen subida o uno de los fondos de tus recursos de juego.

Para volver al fondo predeterminado, haz clic en **Remove** (Quitar) junto a **Chat Background**.

## Tu biblioteca de fondos y el desenfoque

Las imágenes entre las que puedes elegir están en la misma sección **Backgrounds**, dentro de **Settings** y luego **Appearance**. La guía [Chat Backgrounds](../appearance/chat-backgrounds.md) cubre esa biblioteca por completo: importar imágenes, etiquetas, renombrar, eliminar, el control deslizante **Background Blur** (Desenfoque del fondo) y establecer un fondo predeterminado para los chats de Roleplay nuevos.

## Guías relacionadas

- [Chat Backgrounds](../appearance/chat-backgrounds.md): la biblioteca de imágenes subidas y los controles de apariencia para los fondos.
- [Scene Backgrounds](../media/scene-backgrounds.md): arte de escena generado con IA creado desde tu Gallery.
- [Roleplay Mode: Getting Started](getting-started.md): la escena completa de Roleplay, los sprites y el HUD.
