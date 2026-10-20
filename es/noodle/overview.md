# Noodle: la línea de tiempo social dentro de la app

Noodle es un feed de redes sociales de mentira y opcional para Marinara Engine. Se parece a una línea de tiempo estilo Twitter o X, pero cada cuenta y cada publicación pertenecen a tu propio mundo: tu persona, tus personajes y Professor Mari. Esta guía explica cómo instalar y abrir Noodle, y cómo publicar, seguir y refrescar la línea de tiempo.

## Qué es Noodle

Noodle es un feed social falso, dentro de la app. No se conecta a ninguna red social real. Nada de lo que haces en Noodle se publica en internet.

Cada cuenta de Noodle es parte de tu app:

- Tu **persona**, el personaje que te representa en un chat. Consulta [User Personas](../characters/personas.md).
- Cualquier personaje que invites desde tu biblioteca.
- **Professor Mari**, el asistente integrado de la app. Consulta [Professor Mari](../home/professor-mari.md).
- Un pequeño conjunto de cuentas integradas de "usuario aleatorio", si las activas.

Escribes publicaciones a mano como tu persona. También puedes hacer clic en **Refresh timeline** (Refrescar línea de tiempo) para que una conexión de IA se encargue de escribir. En una sola pasada crea nuevas publicaciones, respuestas, likes y seguimientos para las cuentas invitadas. Una conexión de IA es un enlace a un proveedor de IA que genera texto. Consulta [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

La actividad de Noodle es opcional y está desactivada de forma predeterminada. No se genera nada hasta que invitas a un personaje (o activas los usuarios aleatorios) y pulsas **Refresh timeline**.

Nota sobre el contenido: las instrucciones integradas que Noodle envía a la IA tratan a cada cuenta como adulta (mayor de 18). Permiten publicaciones e imágenes de tono adulto o explícito. Esto viene integrado y no es una opción que puedas desactivar. Si no quieres contenido adulto, vigila lo que produce cada refresco.

## Cómo abrir Noodle

Noodle es un paquete de agente descargable. Instálalo una vez antes de buscar su pestaña en Home:

1. Abre **Agents** (Agentes), elige **Download Agents** (Descargar agentes) e instala **Noodle**.
2. Reinicia Marinara Engine cuando se te pida, para que se puedan cargar su servidor y sus aportaciones a Home.
3. Abre **Home** (Inicio) y haz clic en la pestaña **Noodle**, junto a **Home** y **Professor**.

Deberías ver la conocida interfaz de navegador falso y la línea de tiempo de Noodle dentro del navegador de Home de Marinara. La fila de dirección de Home muestra `marinara/noodle`; el estilo de navegador propio de Noodle sigue formando parte de la página.

Para salir de Noodle, elige otra pestaña del navegador de Home o abre un chat.

En un teléfono o una ventana estrecha, Noodle cambia a un diseño para móviles con su propia navegación. Consulta la sección "Noodle en un teléfono" más abajo.

## La línea de tiempo

La línea de tiempo es el feed principal. Hay dos pestañas en la parte superior:

- **Main** (Principal): cada publicación de cada cuenta que Noodle conoce.
- **Following** (Siguiendo): solo publicaciones de personajes que sigue tu persona actual.

Debajo de las pestañas está el compositor de publicaciones, luego un botón **Refresh timeline**, y después el feed. Cada publicación muestra el avatar del autor, su nombre visible, el `@handle` y una marca de tiempo. El feed carga las 160 publicaciones más recientes. Las publicaciones más antiguas permanecen en el historial de Noodle aunque ya no se vean en el feed actual. Durante un refresco posterior de la línea de tiempo, Noodle puede usar hasta tres publicaciones seleccionadas al azar y con más de 48 horas de antigüedad como memoria de interacciones pasadas.

Si el feed está vacío, verás "The plate is empty." (El plato está vacío). Una pista te dice que abras **Settings** (Configuración), invites personajes, elijas una conexión y luego refresques. Si la pestaña **Following** todavía no tiene a nadie, muestra "Nothing from followed characters yet." (Todavía no hay nada de los personajes seguidos).

### Cómo escribir una publicación

Necesitas una persona activa para publicar. El compositor está desactivado hasta que haya una definida.

1. Haz clic en el cuadro de la parte superior de la línea de tiempo, con el texto de ejemplo **What's simmering?** (¿Qué se está cocinando?). En la barra lateral izquierda también puedes hacer clic en el botón **Post** (Publicar), que abre una ventana **New post** (Nueva publicación).
2. Escribe tu publicación. El texto está limitado a 4000 caracteres.
3. Usa la pequeña barra de herramientas bajo el cuadro para añadir extras:
   - **Attach image** (Adjuntar imagen): sube una imagen desde tu dispositivo o pega la URL de una imagen. Una imagen por publicación.
   - **Create poll** (Crear encuesta): añade una encuesta con dos a cuatro opciones únicas. Las cuentas pueden votar, y quien vota puede cambiar su elección.
   - **Emoji, GIFs and stickers** (Emoji, GIFs y stickers): el mismo selector que se usa en el chat.
   - Menciones: escribe `@` y elige una cuenta entre las sugerencias. Las menciones se muestran como enlaces de cuenta en los que se puede hacer clic.
4. Haz clic en **Post**.

El botón muestra "Posting..." (Publicando...) mientras guarda. Escribir una publicación no necesita una conexión de IA. Solo **Refresh timeline** y la generación de imágenes necesitan una.

## Acciones sobre publicaciones: like, repost, responder

Cada publicación muestra un contador de likes, un contador de reposts y un contador de respuestas. Todas estas acciones necesitan una persona activa.

- **Like** / **Unlike** (Quitar like): haz clic en el corazón para dar like a una publicación; vuelve a hacer clic para quitar tu like.
- **Repost** / **Undo repost** (Deshacer repost): haz clic en el icono de repost para compartir una publicación; vuelve a hacer clic para deshacerlo.
- **Reply** (Responder): haz clic en el icono de respuesta para abrir un cuadro de respuesta. Las respuestas se muestran como tarjetas pequeñas bajo la publicación. El texto de respuesta está limitado a 2000 caracteres. También puedes responder directamente a otra respuesta, dar like a una respuesta y adjuntar contenido a una respuesta.

Para editar o eliminar una publicación, debe ser tuya. Tus publicaciones muestran un botón **Post actions** (Acciones de la publicación), con un icono de tres puntos, que incluye **Edit** (Editar) y **Delete** (Eliminar). Al eliminar se te pide confirmación, ya que también se quitan los likes, reposts y respuestas de esa publicación.

Haz clic o toca la imagen de una publicación para abrir el visor de contenido a tamaño completo. El visor también tiene un botón de descarga.

## Notificaciones

Abre **Notifications** (Notificaciones) desde la barra lateral izquierda (el icono de la campana). Una insignia sobre la campana cuenta los nuevos likes, seguimientos y respuestas. Muestra "99+" en cuanto pasas de 99.

Hay tres pestañas:

- **Likes**: quién dio like a tus publicaciones.
- **Follows** (Seguimientos): quién empezó a seguir a tu persona.
- **Replies** (Respuestas): respuestas a tus publicaciones, más cualquier publicación que mencione el `@handle` de tu persona. Haz clic en una notificación de respuesta para abrir la publicación relacionada, y así poder darle like o responderla ahí mismo.

Las notificaciones necesitan una persona activa. Sin ella, el panel se queda vacío.

<a id="profiles-and-following"></a>

## Perfiles y seguimiento

Abre **Profile** (Perfil) desde la barra lateral izquierda, o haz clic en el nombre o el avatar de cualquier cuenta en cualquier parte de Noodle.

Tu propio perfil tiene un botón **Edit Profile** (Editar perfil). Haz clic en él para cambiar tu **Display name** (Nombre visible), **@name**, **Bio** (Biografía) y **Location** (Ubicación), y luego haz clic en **Save** (Guardar). También puedes hacer clic en el banner o el avatar para subir una imagen. La IA escribe el perfil de un personaje, y puedes cambiarlo de la misma forma una vez que el personaje esté invitado.

Cuando editas el perfil de un personaje, aparecen dos ajustes más debajo de los campos del perfil. Se guardan al instante.

- **Use this character's image instructions in Noodle images** (Usar las instrucciones de imagen de este personaje en las imágenes de Noodle) añade a sus imágenes de Noodle las **Image generation instructions** (Instrucciones de generación de imágenes) del personaje, de la pestaña **Convo** del editor de personajes. **Edit image instructions** (Editar instrucciones de imagen) abre esa pestaña. Slurp usa la misma elección hasta que fijes una para este personaje en Slurp. Necesita Noodle 1.5.4 o posterior.
- **Image connection** (Conexión de imagen) elige la conexión de imagen para las imágenes de Noodle de este personaje. **Use Noodle image connection** (Usar la conexión de imagen de Noodle) mantiene la de los [ajustes de Noodle](settings.md#image-generation). Necesita Noodle 1.5.5 o posterior.

Debajo de la cabecera verás los contadores de **Following** y **Followers** (Seguidores), y luego tres pestañas: **Posts** (Publicaciones), **Likes** y **Media** (Contenido): publicaciones que tienen una imagen.

### Cómo seguir a un personaje

Tu persona puede seguir a cualquier personaje invitado, pero solo después de que ese personaje tenga un perfil de Noodle. Un personaje obtiene un perfil la primera vez que una pasada de **Refresh timeline** lo incluye.

- En una ventana ancha, un panel **Who to follow** (A quién seguir) a la derecha sugiere hasta 5 personajes con un botón **Follow** (Seguir) de un solo clic.
- En cualquier perfil, haz clic en **Follow** para seguir, o en **Following** para dejar de seguir.
- Un personaje recién invitado no se podrá seguir hasta que se haya ejecutado un refresco al menos una vez.
- A los usuarios aleatorios nunca se les puede seguir.

## Selector de cuenta

Cada persona que creas obtiene su propia cuenta de Noodle. En la parte inferior de la barra lateral izquierda, el nombre y el avatar de tu persona son un botón. Haz clic en él para abrir **Switch account** (Cambiar de cuenta) y elegir una persona distinta.

Cambiar de cuenta aquí cambia como qué persona publicas, das like, respondes y sigues dentro de Noodle. Cada chat conserva su propia selección de persona.

## Refrescar la línea de tiempo

**Refresh timeline** es la forma en que Noodle se llena de actividad generada por IA. Cuando haces clic, Noodle envía tu persona, las cuentas invitadas y cualquier contexto del chat que hayas incluido a tu conexión de IA elegida. La IA escribe un lote de publicaciones, respuestas, reposts, likes y seguimientos de una vez. También escribe un perfil de Noodle para cualquier personaje invitado que todavía no tenga uno. La IA ve también la actividad ya existente del día actual, así que puede continuar las conversaciones en lugar de repetirlas. Si esas publicaciones o comentarios contienen imágenes, Noodle adjunta hasta ocho de las imágenes relevantes más recientes, con etiquetas que identifican su publicación o respuesta. Un modelo de generación con capacidad de visión puede inspeccionar las imágenes reales y responder a lo que se ve. Si el modelo seleccionado rechaza la entrada de imágenes, Noodle reintenta automáticamente ese refresco usando solo el contexto de texto de la línea de tiempo.

Las publicaciones antiguas también pueden volver. Cuando existen publicaciones con más de 48 horas de antigüedad, un refresco a veces le muestra de una a tres de ellas a la IA, que puede recordarlas, retomarlas o construir sobre ellas.

Para que un refresco funcione, necesitas tres cosas:

1. Una persona activa.
2. Al menos un personaje invitado, o los usuarios aleatorios integrados activados.
3. Una **Generation connection** (Conexión de generación) elegida en los **Settings** de Noodle. Consulta [Noodle Settings and Chat Carryover](settings.md).

Si falta algo, Noodle bloquea el refresco y muestra un mensaje que te dice qué corregir. Por ejemplo, "Choose a generation connection for Noodle first." (Elige primero una conexión de generación para Noodle). Al tener éxito verás "Noodle timeline refreshed." (Línea de tiempo de Noodle refrescada).

Puedes refrescar a mano en cualquier momento con **Refresh timeline**. Noodle también puede refrescarse solo según un horario. Define **Refreshes/day** (Refrescos por día) en los **Settings** de Noodle, y Marinara reparte esa cantidad de refrescos a lo largo del día. El horario se ejecuta dentro del servidor, así que la página de Noodle no necesita quedarse abierta.

Todo lo que genera un refresco, además de cuántas cuentas participan y cuánto crean, se controla en los **Settings** de Noodle. Ese recorrido completo, incluido el horario automático, está en [Noodle Settings and Chat Carryover](settings.md).

## Noodle en un teléfono

En una pantalla estrecha, Noodle cambia a un diseño para móviles:

- El logo de Noodle queda en el centro de la cabecera de la línea de tiempo.
- Toca el avatar de tu persona en la esquina superior izquierda para abrir un panel lateral de Noodle a pantalla completa. Contiene **Home** (Inicio), **Profile**, **Settings** y **Post**, con el cambio de persona en la parte inferior.
- Una barra inferior compacta permanece fija mientras ves la línea de tiempo, el perfil, la configuración, la búsqueda y las notificaciones.
- **Home** vuelve a la línea de tiempo y la desplaza hasta arriba. **Search** (Buscar) abre la búsqueda de cuentas y **Who to follow**. **Notifications** abre las notificaciones de Noodle.
- Profile, Settings, Search y Notifications muestran cada uno una flecha de retroceso que vuelve a la línea de tiempo.

El diseño de escritorio conserva sus columnas laterales.

## Guías relacionadas

- [Noodle Settings and Chat Carryover](settings.md): invitaciones, límites de refresco, generación de imágenes y cómo alimentar tus chats con la actividad de Noodle.
- [User Personas](../characters/personas.md): crea las personas que publican en Noodle.
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md): configura la conexión que necesita un refresco.
- [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md): otras formas en que tus chats comparten contexto.
