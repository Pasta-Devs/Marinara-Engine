# Espejo de mensajes de Discord

El espejo de mensajes de Discord copia los mensajes de tu chat a un canal de Discord mientras chateas. Funciona en los modos Conversation (conversación), Roleplay y Game (juego).

Es un relé de un solo sentido. Marinara envía mensajes hacia fuera y Discord no puede enviar nada de vuelta, así que esto no es un bot de dos sentidos. Usa un webhook de Discord, una URL especial que permite a una app publicar mensajes en un canal de Discord. El espejo se configura por chat. Cada chat tiene su propia URL de webhook, y los demás chats quedan desactivados hasta que pegas una URL en cada uno.

## Crear una URL de webhook de Discord

El webhook se crea dentro de Discord, no dentro de Marinara. Necesitas permiso para administrar el canal de Discord que quieres usar.

1. Abre tu servidor de Discord y elige el canal donde deben aparecer los mensajes.
2. Abre la configuración de ese canal, luego abre **Integrations** (Integraciones) y después **Webhooks**.
3. Crea un webhook nuevo y copia su URL de webhook.

Una URL de webhook de Discord se ve así:

```text
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

Mantén esta URL privada. Cualquiera que la tenga puede publicar mensajes en tu canal de Discord.

## Activar el espejo

El cuadro del webhook está en los ajustes de cada chat, dentro de **Connected Chats** (Chats conectados). Tiene la etiqueta **Discord Mirror**, y su marcador de posición dice `https://discord.com/api/webhooks/...`.

1. Abre el chat que quieres reflejar.
2. Abre **Chat Settings** (Ajustes del chat).
3. Encuentra la sección **Connected Chats**.
4. Pega tu URL de webhook en el cuadro de texto que está cerca del final de esa sección.

El espejo ya está activo para ese chat. Para desactivarlo, vacía el cuadro.

Si no funcionó: una URL que no es un webhook de Discord válido muestra el texto rojo "Invalid webhook URL format" (Formato de URL de webhook no válido) debajo del cuadro. Corrige la URL y el espejo se guarda. Marinara vuelve a comprobar la URL en el servidor cuando guardas.

La URL del webhook se queda en esta instalación de Marinara. Las exportaciones de chats, los perfiles de ajustes exportados y los archivos de **Export Profile** (Exportar perfil) la dejan fuera, e importar cualquiera de ellos nunca activa un espejo. Para reflejar un chat que llevaste a otra instalación, vuelve a pegar allí la URL. Un perfil de ajustes que guardaste en esta instalación sigue configurando tu espejo cuando lo aplicas.

## Qué se envía

Marinara refleja tus mensajes y las respuestas de la IA a medida que se generan.

- Nombre del remitente: tus mensajes usan el nombre de tu persona activa. Los mensajes de la IA usan el nombre del personaje.
- En Game Mode, los turnos de los miembros del grupo o de los NPC (personajes no jugadores) se envían bajo el nombre "Party" (Grupo). La narración de la historia se envía bajo "Narrator" (Narrador). Si tu juego usa la opción **Character GM**, las respuestas del Game Master (director del juego) usan en su lugar el nombre de ese personaje.
- No se envía ninguna imagen. Discord muestra solo el nombre del remitente y el texto.
- Mensajes largos: Discord limita cada mensaje a 2000 caracteres. Un mensaje de más de 1997 caracteres se acorta, y la copia reflejada termina con "...".
- Las menciones como @everyone o @here dentro del texto no notifican a nadie en tu canal de Discord.

## Qué no se envía

- Las respuestas regeneradas y los swipes no se vuelven a reflejar. Un swipe es otra respuesta que se guarda en el mismo mensaje. Solo se envía la primera respuesta de cada turno.
- Los mensajes de impersonación no se reflejan. Impersonate es la función donde la IA escribe un mensaje en tu lugar.
- Un envío que falla no se vuelve a enviar. Un envío al que Discord responde con un límite de velocidad (429) tampoco se vuelve a enviar; consulta más abajo. Un envío fallido no muestra ningún error en el chat. Las fallas que no son un límite de velocidad se registran solo en el servidor.

## Límite de velocidad

Discord limita qué tan rápido puede publicar una app. Marinara envía como máximo un mensaje cada 1,2 segundos aproximadamente por webhook. Eso es alrededor de 50 mensajes por minuto. Los mensajes extra esperan en una cola y salen en orden. Si Discord responde a un envío con 429 (reduce la velocidad), ese mensaje no se vuelve a enviar. Marinara espera el tiempo de Retry-After que indica Discord y luego continúa con el siguiente mensaje de la cola.

## Guías relacionadas

- [Conectar una conversación a un roleplay o juego](../chats/connected-chats.md)
