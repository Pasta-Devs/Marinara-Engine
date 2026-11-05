# Conectar una Conversation a un Roleplay o un Game

Enlaza un chat de Conversation con un chat de Roleplay o de Game para que ambos compartan el contexto. Un uso común: llevas una historia en un chat y hablas de ella fuera de personaje (OOC) en una Conversation que se mantiene al tanto de la historia.

La sección **Connected Chats** (Chats conectados) de **Chat Settings** (Ajustes del chat) contiene dos funciones distintas. Un enlace de **Connected Chats** es de uno a uno y lo configuras a mano. **Cross-Chat Awareness** (Conciencia entre chats) es un interruptor que funciona por sí solo y permite que un personaje recuerde sus otros chats de Conversation.

## Cómo funciona un enlace

Un enlace une una Conversation con un chat de Roleplay o de Game. Cada chat puede tener un solo enlace a la vez.

- La Conversation lee automáticamente los mensajes recientes del chat de historia enlazado, en cada turno.
- El chat de historia no lee la Conversation de vuelta. Los personajes pasan información en el otro sentido con etiquetas, que se describen más abajo.

## Enlazar una Conversation con un chat de Roleplay o de Game

Antes de empezar: ten listos los dos chats. Consulta [Gestionar tu lista de chats](managing-chats.md).

1. Abre el chat de Conversation y abre **Chat Settings**. Consulta [Descripción general de Chat Settings](chat-settings.md).
2. Abre la sección **Connected Chats**.
3. Haz clic en **Link to Roleplay or Game**.
4. Busca el chat en el selector y haz clic en él.

La sección ahora muestra el nombre y el modo del chat enlazado, con un pequeño botón para desenlazar.

Si no funcionó: en el selector solo aparecen los chats que aún no están enlazados. Desenlaza primero el otro chat.

Para empezar desde un chat de Game, abre **Chat Settings → Connected Chats** en ese chat, haz clic en **Link to Conversation** y elige la Conversation. Un chat de Roleplay no tiene botón de enlace. Muestra el enlace una vez que existe, así que créalo desde el lado de Conversation.

### Quitar un enlace

Abre **Chat Settings → Connected Chats** y haz clic en el botón de desenlazar (su etiqueta es **Disconnect**). Esto también borra las influencias pendientes y las notas guardadas ligadas al enlace. Eliminar un chat también lo desconecta.

## Cross-Chat Awareness

**Cross-Chat Awareness** es un interruptor de la sección **Connected Chats** de una Conversation. Su descripción dice "Characters know what happens in their other chats". Cuando un personaje está en más de un chat de Conversation, puede recordar y mencionar lo que ocurrió en los otros. Marinara empareja esos chats por personaje compartido, no por usuario compartido. Está activado de forma predeterminada y no necesita ningún enlace.

## Pasar información a través del enlace

Los personajes escriben estas etiquetas dentro de sus mensajes. No necesitas hacer nada. Así es como los dos chats se comunican entre sí.

| Etiqueta | Qué hace |
| --- | --- |
| `<influence>` | Un empujón único desde la Conversation hacia el chat de historia enlazado. Afecta al siguiente turno enlazado y luego se consume. |
| `<note>` | Guarda un dato duradero de la Conversation en el chat de historia. Permanece en el prompt (las instrucciones enviadas a la IA) del chat de historia en cada turno hasta que lo borras. |
| `<ooc>` | Permite que un personaje de Roleplay salga de la historia y responda a la Conversation enlazada. Marinara publica el texto allí. |

### Conversation Notes

Los datos `<note>` guardados aparecen en una sección **Conversation Notes** (Notas de la conversación) en **Chat Settings** del chat de historia. Cada nota tiene un botón de eliminar. **Clear all notes** (Borrar todas las notas) las quita todas después de que confirmes, y esto no se puede deshacer. Si no hay notas, la sección dice que las notas envueltas en una etiqueta `<note>` aparecerán allí.

<a id="switching-between-connected-chats"></a>

## Cambiar entre chats conectados

Cuando hay un enlace, aparece un botón **Connected chat** (un icono de doble flecha) en los dos chats. En una computadora empieza arriba a la derecha, y puedes arrastrarlo. En un teléfono, abre el menú de tres puntos **Chat tools** (Herramientas del chat), abre **Connected chat** y elige **Switch to** y el nombre del otro chat.

Para mantener el control dentro de Chat Settings, elige **Put back in Chat Settings**. Entonces aparece como su propia sección **Connected chat**. Usa el botón para sacar esa sección y volver a convertirla en una ventana aparte.

## Otros controles en esta sección

- **Discord webhook URL**: un cuadro sin etiqueta, solo con un marcador de posición que empieza por `https://discord.com/api/webhooks/`. Pega una URL de webhook para reflejar los mensajes del chat en un canal de Discord. Tiene su propia guía.
- **Allow Noodle references** (Permitir referencias de Noodle): permite que la línea de tiempo de Noodle extraiga mensajes recientes de este chat. Está desactivado de forma predeterminada y solo aparece cuando Noodle está instalado.
- **Allow character DMs** (Permitir mensajes directos de personajes), en Roleplay: permite que un personaje de Roleplay abra un nuevo mensaje directo de Conversation contigo desde dentro de la historia. Está desactivado de forma predeterminada y funciona incluso sin enlace.
