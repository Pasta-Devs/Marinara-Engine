# Conectar una Conversation a un Roleplay o un Game

Esta guía explica cómo enlazar un chat de Conversation con un chat de Roleplay o de Game para que ambos compartan el contexto. También cubre **Cross-Chat Awareness** (conciencia entre chats), las etiquetas especiales que pasan información a través de un enlace y cómo saltar entre chats enlazados.

Marinara Engine (llamado Marinara a partir de aquí) tiene dos funciones distintas que permiten que los chats se conozcan entre sí. Una es automática. La otra es un enlace explícito de uno a uno que tú mismo configuras. Esta guía las mantiene separadas, porque funcionan de maneras diferentes.

## Qué hacen los Connected Chats

**Connected Chats** (chats conectados) une un chat de Conversation con un chat de Roleplay o de Game. El enlace es de uno a uno. Cada chat puede estar conectado con un solo chat a la vez.

Una vez enlazado, el lado de Conversation lee automáticamente los mensajes recientes del chat de historia enlazado. Los incorpora a su propio contexto en cada turno. Esta es la dirección automática del enlace.

El chat de historia (el Roleplay o el Game) no lee automáticamente los mensajes de la Conversation de vuelta. Para enviar información en el otro sentido, un personaje usa etiquetas especiales. Esas etiquetas se describen más abajo.

Un uso común: ejecutas un Roleplay o Game inmersivo en un chat, y un chat casual de mensajes directos fuera de personaje (OOC) en una Conversation. El chat OOC se mantiene al tanto de la historia, así puedes hablar de ella mientras ocurre.

## Cross-Chat Awareness no es lo mismo que un enlace

Dos funciones se confunden con facilidad. Lee esta sección antes de configurar nada.

**Cross-Chat Awareness** es automática. Es un ajuste del modo Conversation. Cuando un personaje está presente en más de un chat de Conversation, puede recordar y hacer referencia a lo que ocurrió en esos otros chats. No enlazas nada a mano. El ajuste está activado de forma predeterminada.

Lo encuentras en la sección **Cross-Chat Awareness** de **Chat Settings** (Ajustes del chat). Su texto de ayuda dice: "Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats and injects them as context." Marinara empareja estos chats hermanos por personaje compartido, no por usuario compartido.

Un enlace de **Connected Chats** es diferente. Es algo que creas a propósito. Une exactamente una Conversation con un chat de Roleplay o de Game. Lleva contexto de la historia y las etiquetas especiales que se describen abajo.

En resumen: **Cross-Chat Awareness** enlaza un personaje entre sus propios chats de Conversation de forma automática. Un enlace de **Connected Chats** une una Conversation con un chat de historia a mano.

## Enlazar una Conversation con un chat de Roleplay o de Game

Empiezas el enlace desde el chat de Conversation, o desde un chat de Game. Sigue estos pasos para empezar desde el lado de Conversation.

1. Abre el chat de Conversation que quieres enlazar.
2. Abre **Chat Settings** (Ajustes del chat) con su botón en el chat. Está arriba a la derecha, salvo que lo hayas movido.
3. Busca la sección **Connected Chats**.
4. Haz clic en **Link to Roleplay or Game**.
5. Busca el chat de Roleplay o de Game en el selector y haz clic en él.

Ahora deberías ver el nombre del chat enlazado y su modo dentro de la sección **Connected Chats**. Junto a él aparece un pequeño botón para desenlazar.

Para empezar el enlace desde un chat de Game en su lugar, abre las **Chat Settings** de ese chat, busca **Connected Chats** y haz clic en **Link to Conversation**. Luego elige la Conversation.

Un chat de Roleplay no tiene su propio botón de enlace. Muestra el enlace una vez que existe, pero debes crear el enlace desde el lado de Conversation.

En el selector solo aparecen los chats que aún no están enlazados. Un chat puede tener un enlace a la vez.

### Quitar un enlace

Para quitar un enlace, abre **Chat Settings**, busca **Connected Chats** y haz clic en el botón de desenlazar (su tooltip, o texto de ayuda, dice **Disconnect**). Desconectar también borra cualquier influencia pendiente y las notas guardadas ligadas a ese enlace.

Eliminar un chat también lo desconecta de su chat enlazado.

## Pasar información a través del enlace

La Conversation lee el chat de historia automáticamente. Las otras direcciones usan etiquetas. Estas etiquetas aparecen dentro de los mensajes de un personaje. La IA las escribe. Normalmente no las escribes tú, pero saber qué hacen te ayuda a entender el puente.

Escribe estas etiquetas como texto literal si alguna vez necesitas referirte a ellas. Cada una se muestra aquí en código para que se vea exactamente.

- `<influence>` envía un empujón único desde la Conversation hacia el chat de historia enlazado. Afecta al siguiente turno enlazado y luego se consume.
- `<note>` guarda un dato duradero de la Conversation en el chat de historia enlazado. Permanece en el prompt (las instrucciones enviadas a la IA) del chat de historia en cada turno hasta que lo borras.
- `<ooc>` permite que un personaje de Roleplay salga de la historia y responda directamente a la Conversation enlazada. Marinara publica ese texto en el chat de mensajes directos enlazado.

Así, un personaje de Conversation puede moldear o informar la historia con discreción usando `<influence>` y `<note>`. Un personaje de Roleplay puede responder a la Conversation con `<ooc>`.

## Conversation Notes

Cuando un personaje de Conversation guarda una `<note>` duradera, esta aparece en el lado de la historia. El chat de Roleplay o de Game obtiene una sección **Conversation Notes** (notas de la conversación) en sus **Chat Settings**.

Esta sección lista cada nota guardada. Cada nota tiene un botón de eliminar. Para quitarlas todas de una vez, usa el botón **Clear all notes**. Marinara te pide que confirmes antes de borrarlas, y esto no se puede deshacer.

Si ningún personaje ha guardado aún una nota, la sección explica que las notas envueltas en una etiqueta `<note>` aparecerán aquí una vez guardadas.

<a id="switching-between-connected-chats"></a>

## Cambiar entre chats conectados

Cuando un chat tiene otro enlazado, aparece un botón móvil **Connected chat** con un icono de doble flecha, inicialmente arriba a la derecha. Puedes arrastrarlo en la computadora o el teléfono. Haz clic o tócalo para abrir una ventana pequeña y elige **Switch to** seguido del nombre del otro chat.

La acción te lleva directamente al chat conectado, sin tener que buscarlo en la lista. El botón aparece tanto en el lado de Conversation como en el de Roleplay de un enlace.

Si prefieres tenerlo dentro de Chat Settings, elige **Put back in Chat Settings** en la ventana. Pasa a ser la sección **Connected chat**. Su botón para sacar la sección vuelve a darle una ventana propia.

## Otros controles en esta sección

La sección **Connected Chats** también contiene dos controles adicionales que pertenecen a otras funciones. Se muestran aquí por comodidad.

- Un cuadro **Discord webhook URL**. No tiene una etiqueta visible, solo un marcador de posición que empieza por `https://discord.com/api/webhooks/`. Pegar aquí una URL de webhook de Discord refleja los mensajes del chat en un canal de Discord. Esto es parte de la función de reflejo de mensajes en Discord, que tiene su propia guía.
- Un interruptor **Allow Noodle references** (desactivado de forma predeterminada). Permite que la línea de tiempo de Noodle dentro de la app extraiga mensajes recientes de este chat. Noodle tiene su propia guía.

En el lado de Roleplay, también verás un interruptor **Allow character DMs** (desactivado de forma predeterminada). Cuando está activado, permite que un personaje de Roleplay abra un nuevo mensaje directo de Conversation contigo desde dentro de la historia. Esto funciona incluso cuando aún no hay ninguna Conversation enlazada.

## Guías relacionadas

- [Conversation Mode: primeros pasos](../conversation/getting-started.md)
- [Roleplay Mode: primeros pasos](../roleplay/getting-started.md)
