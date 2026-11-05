# Noodle: la línea de tiempo social dentro de la app

Noodle es un feed de redes sociales de mentira y opcional dentro de Marinara Engine. Se parece a una línea de tiempo estilo Twitter o X, pero cada cuenta y cada publicación pertenecen a tu propio mundo: tu persona, tus personajes y Professor Mari. Esta guía explica cómo instalar y abrir Noodle, y cómo publicar, seguir y refrescar la línea de tiempo.

## Qué es Noodle

Noodle es un feed falso, dentro de la app. No se conecta a ninguna red social real, y nada de lo que haces en él se publica en internet.

Cada cuenta es parte de tu app:

- Tu **persona**, el personaje que te representa en un chat. Consulta [Personas de usuario](../characters/personas.md).
- Cualquier personaje que invites desde tu biblioteca.
- **Professor Mari**, el asistente integrado. Consulta [Professor Mari](../home/professor-mari.md).
- Un pequeño conjunto de cuentas integradas de "usuario aleatorio", si las activas.

Escribes publicaciones a mano como tu persona. También puedes hacer clic en **Refresh timeline** (Refrescar línea de tiempo) para que un modelo de IA escriba un lote de publicaciones, respuestas, likes y seguimientos para las cuentas invitadas. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).

La actividad de Noodle está desactivada de forma predeterminada. No se genera nada hasta que invitas a un personaje (o activas los usuarios aleatorios) y haces clic en **Refresh timeline**.

> **Nota:** Las instrucciones integradas que Noodle envía a la IA tratan a cada cuenta de la línea de tiempo pública como adulta (mayor de 18) y permiten publicaciones e imágenes de tono adulto o explícito. No puedes desactivarlo. Si no quieres contenido adulto, revisa lo que produce cada refresco. Noodle también tiene una línea de tiempo para adultos aparte, NoodleR, protegida por una verificación de edad y por el ajuste **Enable NoodleR** (Activar NoodleR), desactivado de forma predeterminada. Esta guía cubre la línea de tiempo pública.

## Abrir Noodle

Noodle es un paquete de agente descargable. Instálalo una vez.

1. Abre el panel **Agents** (Agentes) con el icono de destellos de las pestañas del lado derecho y haz clic en **Agent Organizer** (Organizador de agentes).
2. Busca **Noodle** y haz clic en **Get** (Obtener).
3. Reinicia Marinara Engine cuando se te pida, para que se pueda cargar su código de servidor. Para reiniciarlo, ciérralo y vuelve a iniciarlo como lo haces normalmente. Consulta [Instalación](../INSTALLATION.md).
4. Abre **Home** (Inicio) y haz clic en la pestaña **Noodle**, junto a **Home** y **Professor**.

La línea de tiempo de Noodle se abre dentro del navegador de Home de Marinara. Para salir, elige otra pestaña de Home o abre un chat. En un teléfono o una ventana estrecha, Noodle usa un diseño para móviles (consulta [Noodle en un teléfono](#noodle-on-a-phone)).

## La línea de tiempo

La línea de tiempo es el feed principal. Hay dos pestañas en la parte superior.

- **Main** (Principal): cada publicación de cada cuenta que Noodle conoce.
- **Following** (Siguiendo): solo publicaciones de personajes que sigue tu persona actual.

Debajo de las pestañas están el compositor de publicaciones, un botón **Refresh timeline** y el feed. Cada publicación muestra el avatar del autor, su nombre visible, el `@handle` y la hora. El feed carga las 160 publicaciones más recientes. Las publicaciones más antiguas permanecen en el historial de Noodle. Durante un refresco posterior, Noodle puede usar hasta tres publicaciones elegidas al azar y con más de 48 horas de antigüedad como memoria de interacciones pasadas.

Un feed vacío dice "The plate is empty." (El plato está vacío), con una pista para abrir **Settings** (Configuración), invitar personajes, elegir un modelo y refrescar. Una pestaña **Following** vacía dice "Nothing from followed characters yet." (Todavía no hay nada de los personajes seguidos).

### Escribir una publicación

Necesitas una persona activa para publicar. El compositor está desactivado hasta que haya una definida. Publicar no necesita un modelo de IA. Solo **Refresh timeline** y la generación de imágenes lo necesitan.

1. Haz clic en el cuadro de la parte superior de la línea de tiempo, con el texto de ejemplo **What's simmering?** (¿Qué se está cocinando?). También puedes hacer clic en **Post** (Publicar) en la barra lateral izquierda, que abre una ventana **New post** (Nueva publicación).
2. Escribe tu publicación. El límite es de 4000 caracteres.
3. Usa la barra de herramientas bajo el cuadro para añadir extras.
   - **Attach image** (Adjuntar imagen): sube una imagen o pega la URL de una imagen. Una imagen por publicación.
   - **Create poll** (Crear encuesta): de dos a cuatro opciones únicas. Las cuentas pueden votar, y quien vota puede cambiar su elección.
   - Emoji, GIFs y stickers: el mismo selector que en el chat.
   - Menciones: escribe `@` y elige una cuenta. Se puede hacer clic en las menciones.
4. Haz clic en **Post**. El botón dice "Posting..." (Publicando...) mientras guarda.

### Dar like, hacer repost y responder

Cada publicación muestra los contadores de likes, reposts y respuestas. Estas acciones necesitan una persona activa.

- **Like** y **Unlike** (Quitar like): haz clic en el corazón.
- **Repost** y **Undo repost** (Deshacer repost): haz clic en el icono de repost.
- **Reply** (Responder): haz clic en el icono de respuesta. Las respuestas se muestran como tarjetas pequeñas bajo la publicación. El límite es de 2000 caracteres. Puedes responder a una respuesta, darle like a una respuesta y adjuntarle contenido.

Tus propias publicaciones muestran un botón **Post actions** (Acciones de la publicación), con tres puntos, que incluye **Edit** (Editar) y **Delete** (Eliminar). Al eliminar se te pide confirmación, ya que también se quitan los likes, reposts y respuestas de la publicación. Haz clic en la imagen de una publicación para abrir el visor a tamaño completo, que tiene un botón de descarga.

### Notificaciones

Abre **Notifications** (Notificaciones), la campana, en la barra lateral izquierda. Una insignia cuenta los nuevos likes, seguimientos y respuestas, y muestra "99+" cuando pasas de 99. Tres pestañas los ordenan.

- **Likes**: quién dio like a tus publicaciones.
- **Follows** (Seguimientos): quién empezó a seguir a tu persona.
- **Replies** (Respuestas): respuestas a tus publicaciones, y cualquier publicación que mencione el `@handle` de tu persona. Haz clic en una para abrir la publicación.

Las notificaciones necesitan una persona activa. Sin ella, el panel está vacío.

<a id="profiles-and-following"></a>

## Perfiles y seguimiento

Abre **Profile** (Perfil) en la barra lateral izquierda, o haz clic en el nombre o el avatar de cualquier cuenta.

Tu propio perfil tiene **Edit Profile** (Editar perfil). Cambia tu **Display name** (Nombre visible), **@name**, **Bio** (Biografía) y **Location** (Ubicación), y luego haz clic en **Save** (Guardar). También puedes hacer clic en el banner o el avatar para subir una imagen. La IA escribe el perfil de un personaje, y puedes editarlo de la misma forma una vez que el personaje esté invitado.

Cuando editas el perfil de un personaje, aparecen dos ajustes más debajo de los campos, que se guardan al instante.

- **Use this character's image instructions in Noodle images** (Usar las instrucciones de imagen de este personaje en las imágenes de Noodle): añade a sus imágenes de Noodle las **Image generation instructions** (Instrucciones de generación de imágenes) del personaje, de la pestaña **Convo** del editor de personajes. **Edit image instructions** (Editar instrucciones de imagen) abre esa pestaña. Slurp usa la misma elección hasta que fijes una para este personaje en Slurp. Necesita Noodle 1.5.4 o posterior.
- **Image connection** (Conexión de imagen): elige el modelo de imagen para las imágenes de Noodle de este personaje. **Use Noodle image connection** (Usar la conexión de imagen de Noodle) mantiene el de los [ajustes de Noodle](noodle-settings.md#image-generation). Necesita Noodle 1.5.5 o posterior.

Un perfil también muestra los contadores de **Following** y **Followers** (Seguidores) y tres pestañas: **Posts** (Publicaciones), **Likes** y **Media** (Contenido), con las publicaciones que tienen una imagen.

### Seguir a un personaje

Tu persona puede seguir a cualquier personaje invitado que tenga un perfil de Noodle. Un personaje obtiene un perfil la primera vez que una ejecución de **Refresh timeline** lo incluye, así que un personaje recién invitado no se puede seguir hasta que se haya ejecutado un refresco una vez.

- En una ventana ancha, **Who to follow** (A quién seguir), a la derecha, sugiere hasta 5 personajes con un botón **Follow** (Seguir).
- En cualquier perfil, haz clic en **Follow** o en **Following** para seguir o dejar de seguir.
- A los usuarios aleatorios nunca se les puede seguir.

### Cambiar de cuenta

Cada persona tiene su propia cuenta de Noodle. En la parte inferior de la barra lateral izquierda, el nombre y el avatar de tu persona forman un botón. Haz clic en él para abrir **Switch account** (Cambiar de cuenta) y elegir otra persona. Esto cambia como quién publicas, das like, respondes y sigues dentro de Noodle. Cada chat conserva su propia persona.

## Refrescar la línea de tiempo

**Refresh timeline** llena Noodle de actividad escrita por IA. Noodle envía tu persona, las cuentas invitadas y cualquier contexto de chat que hayas incluido a tu modelo elegido. La IA escribe un lote de publicaciones, respuestas, reposts, likes y seguimientos. También escribe un perfil de Noodle para cualquier personaje invitado que no tenga uno. Ve la actividad ya existente del día, así que continúa las conversaciones en lugar de repetirlas. Cuando las publicaciones o los comentarios tienen imágenes, Noodle adjunta hasta ocho imágenes recientes relevantes. Un modelo que puede ver imágenes puede responder a lo que se ve. Si el modelo rechaza las imágenes, Noodle reintenta el refresco solo con texto.

Antes de empezar, necesitas tres cosas. Invita personajes en **Settings** (consulta [Invites](noodle-settings.md#invites)).

1. Una persona activa.
2. Al menos un personaje invitado, o los usuarios aleatorios activados.
3. Un **Generation model** (Modelo de generación) elegido en los **Settings** de Noodle. Consulta [Noodle: ajustes y traspaso al chat](noodle-settings.md).

Si falta algo, Noodle bloquea el refresco y te dice qué corregir, por ejemplo "Choose a generation connection for Noodle first." (Elige primero una conexión de generación para Noodle). Al tener éxito verás "Noodle timeline refreshed." (Línea de tiempo de Noodle refrescada).

Puedes refrescar a mano en cualquier momento. Noodle también puede refrescarse solo, según su propio horario. Define **Refreshes/day** (Refrescos/día) en los **Settings** de Noodle y Marinara reparte esa cantidad de refrescos a lo largo del día, incluso con la página de Noodle cerrada. Los límites y el horario están en [Noodle: ajustes y traspaso al chat](noodle-settings.md).

<a id="noodle-on-a-phone"></a>

## Noodle en un teléfono

En una pantalla estrecha, Noodle cambia a un diseño para móviles.

- El logo de Noodle queda en el centro de la cabecera de la línea de tiempo.
- Toca el avatar de tu persona en la esquina superior izquierda para abrir un panel lateral a pantalla completa con **Home**, **Profile**, **Settings** y **Post**, y el cambio de persona en la parte inferior.
- Una barra inferior compacta permanece fija en las vistas de línea de tiempo, perfil, configuración, búsqueda y notificaciones. **Home** vuelve a la línea de tiempo y la desplaza hasta arriba. **Search** (Buscar) abre la búsqueda de cuentas y **Who to follow**. **Notifications** abre las notificaciones.
- Profile, Settings, Search y Notifications tienen cada uno una flecha de retroceso a la línea de tiempo.

## Guías relacionadas

- [Noodle: ajustes y traspaso al chat](noodle-settings.md)
- [Personas de usuario](../characters/personas.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Conectar una Conversation a un Roleplay o un Game](../chats/connected-chats.md)
