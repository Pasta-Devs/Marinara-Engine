# Espejo de mensajes de Discord

Esta guía explica el espejo de mensajes de Discord en Marinara Engine. El espejo copia los mensajes de tu chat a un canal de Discord, en un solo sentido, mientras chateas. Funciona en los modos Conversation (conversación), Roleplay y Game (juego).

## Qué hace el espejo

El espejo de mensajes de Discord es un relé de un solo sentido. Marinara envía mensajes hacia un canal de Discord. Discord no puede enviar mensajes de vuelta a Marinara. Esto no es un bot de Discord de dos sentidos.

El espejo usa un webhook de Discord. Un webhook es una URL especial que permite a una app publicar mensajes en un canal de Discord.

El espejo se configura por chat. Cada chat tiene su propia URL de webhook. Activas el espejo en un chat pegando una URL ahí. Los demás chats quedan apagados hasta que pegas una URL en cada uno.

## Crear una URL de webhook de Discord

El webhook se crea dentro de Discord, no dentro de Marinara. Necesitas permiso para administrar el canal de Discord que quieres usar.

1. Abre tu servidor de Discord y elige el canal donde deben aparecer los mensajes.
2. Abre la configuración de ese canal, luego abre **Integrations** (Integraciones) y después **Webhooks**.
3. Crea un webhook nuevo y copia su URL de webhook.

Una URL de webhook de Discord se ve así:

```
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

Mantén esta URL privada. Cualquiera que la tenga puede publicar mensajes en tu canal de Discord.

## Activar el espejo

La opción del webhook vive en la configuración de cada chat. Está dentro de la sección **Connected Chats** (Chats conectados). El cuadro de texto tiene la etiqueta **Discord Mirror**, y su texto de marcador de posición dice `https://discord.com/api/webhooks/...`.

1. Abre el chat que quieres reflejar.
2. Abre **Chat Settings** (Ajustes del chat).
3. Encuentra la sección **Connected Chats**.
4. Pega tu URL de webhook en el cuadro de texto que está cerca del final de esa sección.

El espejo ya está activo para ese chat. Para apagarlo, vacía el cuadro de texto para que quede vacío.

Si la URL no es un webhook de Discord válido, verás el texto rojo "Invalid webhook URL format" (Formato de URL de webhook no válido) debajo del cuadro. Corrige la URL y el espejo se guardará. Marinara también vuelve a comprobar la URL en el servidor cuando guardas.

La URL del webhook se queda en esta instalación de Marinara. Las exportaciones de chats, los perfiles de ajustes exportados y los archivos de **Export Profile** (Exportar perfil) la dejan fuera, e importar cualquiera de ellos nunca activa un espejo. Para reflejar un chat que llevaste a otra instalación, vuelve a pegar allí la URL. Un perfil de ajustes que guardaste en esta instalación sigue configurando tu espejo cuando lo aplicas.

## Qué se envía

Marinara refleja tus mensajes y las respuestas de la IA a medida que se generan.

- Nombre del remitente: tus mensajes usan el nombre de tu persona activa. Los mensajes de la IA usan el nombre del personaje.
- En Game Mode, la narración de la historia se envía bajo el nombre "Narrator" (Narrador). Los turnos de los miembros del grupo o los NPC (personajes no jugadores) se envían bajo el nombre "Party" (Grupo). Si tu juego usa la opción **Character GM**, las respuestas del Game Master (director del juego) usan el nombre de ese personaje.
- No se envía ninguna imagen. Discord muestra solo el nombre del remitente y el texto.
- Mensajes largos: Discord limita cada mensaje a 2000 caracteres. Un mensaje de más de 1997 caracteres se acorta, y la copia reflejada termina con "...".
- Las menciones como @everyone o @here dentro del texto no notifican a nadie en tu canal de Discord.

## Qué no se envía

- Las respuestas regeneradas y los swipes (respuestas alternativas) no se vuelven a reflejar. Solo se envía a Discord la primera respuesta de cada turno.
- Los mensajes de impersonación no se reflejan. Impersonate es la función donde la IA escribe un mensaje en tu lugar.
- Si un envío a Discord falla, Marinara no muestra un error y no reintenta. La falla se registra solo en el servidor.

## Límite de velocidad

Discord limita qué tan rápido puede publicar una app. Marinara envía como máximo un mensaje cada 1.2 segundos aproximadamente por webhook. Eso es alrededor de 50 mensajes por minuto. Los mensajes extra esperan en una cola y salen en orden. Si Discord le pide a Marinara que reduzca la velocidad, Marinara espera y luego continúa enviando.

## Guías relacionadas

- [Conectar una conversación a un roleplay o juego](../chats/connected-chats.md)
