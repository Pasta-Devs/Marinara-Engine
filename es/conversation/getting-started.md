# Conversation Mode: primeros pasos

Esta guía trata sobre Conversation Mode (modo Conversación) en Marinara Engine, el modo de chat con estilo de mensajería. Explica qué es el modo y cómo funciona el asistente de configuración de cuatro pasos. También cubre las funciones exclusivas de Conversation que obtienes, como los mensajes autónomos, el estado de presencia, las reacciones, las selfies y los juegos de mesa.

## Qué es Conversation Mode

Conversation Mode es uno de los modos de chat de Marinara Engine. Funciona como una app de mensajería. Obtienes uno o más personajes, una barra de entrada y un historial de mensajes con desplazamiento.

Piénsalo como enviar mensajes directos, o DM, igual que le escribirías a un amigo. No hay Game Master (director del juego), ni arte de escena, ni mecánicas obligatorias. Es el modo de chat más ligero, y muchos usuarios pasan aquí la mayor parte de su tiempo.

Conversation Mode añade funciones que solo tienen sentido en una relación de mensajería continua. Los personajes tienen un estado en línea o ausente y horarios semanales. Pueden escribirte primero, enviar selfies, reaccionar con emoji y jugar juegos de mesa. Cada personaje y persona también recibe un pequeño perfil estilo Discord con un nombre visible y una sección "sobre mí". Consulta [Conversation Mode Profiles](profiles.md) para conocer esos campos del perfil.

Ninguna de estas funciones exclusivas de Conversation se aplica en Roleplay ni en Game Mode (modo Juego), aunque reutilices la misma tarjeta de personaje allí.

Algunos campos de la tarjeta funcionan al revés. Un chat de Conversation no empieza con el **First Message** (Primer mensaje) de la tarjeta ni con otro saludo; solo lo hacen los chats de Roleplay. Tampoco usa el **Dialogue Highlight Color** (Color de resalte del diálogo) ni el **Message Box Color** (Color del cuadro del mensaje) de la tarjeta. El **Name Display Color** (Color del nombre) sigue coloreando el nombre del personaje encima de cada mensaje. Consulta [Dónde se muestran tus colores](../characters/colors-and-stats.md#where-your-colors-show).

### Cuándo elegir Conversation Mode

Elige Conversation Mode cuando quieras cualquiera de estas cosas:

- Chatear con un personaje igual que le escribirías por DM a un amigo, con texto de entrada y texto de salida.
- Hablar con más de un personaje a la vez en un solo hilo.
- Dejar que los personajes actúen por su cuenta, enviando mensajes, siguiendo horarios y reaccionando con el tiempo.

Elige en su lugar Roleplay o Game Mode cuando quieras arte de escena como sprites (imágenes del personaje) y fondos, o mecánicas de juego estructuradas.

## El asistente de configuración de cuatro pasos

Cuando inicias un nuevo chat de Conversation, aparece un asistente de configuración de cuatro pasos. También puedes cerrarlo y configurar las cosas más tarde desde el panel lateral de ajustes del chat. Los cuatro pasos son:

1. **Name & Connection** (Nombre y conexión): dale nombre al chat y elige la conexión de IA que usarán tus personajes. Una conexión es un enlace guardado a un proveedor de IA. Consulta [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).
2. **Prompt Preset** (Preset de prompt): elige qué preset (ajuste guardado) suministra el prompt (instrucciones enviadas a la IA) de Conversation, o mantén el predeterminado.
3. **Persona & Characters** (Persona y personajes): elige tu persona y uno o más personajes.
4. **Automation** (Automatización): decide cuánto pueden hacer los personajes por su cuenta.

Tu persona es el personaje que interpretas. Consulta [User Personas](../characters/personas.md).

La cantidad de personajes que eliges define la forma del chat. Un personaje crea un DM privado. Dos o más personajes crean un chat grupal, sin ningún modo extra que activar. Los controles del chat grupal están en [Group Chats](../chats/group-chats.md).

Cuando hay una conexión y al menos un personaje configurados, haz clic en **Start Chatting** (Empezar a chatear) para abrir el chat.

### El paso Automation

El paso **Automation** siempre incluye estos controles:

| Interruptor | Predeterminado | Qué hace |
|---|---|---|
| **Autonomous Messages** | On | Los personajes pueden escribirte primero cuando estás inactivo. |
| **Generate Schedules** | Off | Crea rutinas semanales opcionales. Solo se muestra cuando Autonomous Messages está activado. |

Si has instalado un paquete de agente que aporta comandos de Conversation, el paso también muestra **Commands** (Comandos). Calls, las selfies de Illustrator, Music DJ, Haptic Feedback y cada juego de mesa aparecen solo cuando sus paquetes correspondientes están instalados. Para las llamadas, consulta [Conversation Audio and Video Calls](calls.md).

### La cuadrícula de Commands

Cuando **Commands** está disponible y activado, aparece una cuadrícula de hasta 17 familias de comandos. Cada una es una acción oculta que un personaje puede tomar por su cuenta. Las opciones que pertenecen a un paquete aparecen solo cuando ese paquete está instalado. Cada familia visible empieza activada. Desactivar un interruptor solo quita esa familia. Los comandos son acciones dirigidas por el modelo, no cosas que tú escribes.

El conjunto completo de familias de comandos es:

- **Schedule Updates**: deja que los personajes cambien su estado actual.
- **Cross-Post**: deja que los personajes redirijan un mensaje a otro chat.
- **Selfies**: deja que los personajes soliciten selfies generadas.
- **Memories**: deja que los personajes creen memorias para otros personajes.
- **Scenes**: deja que los personajes inicien una escena inmersiva.
- **Music**: deja que los personajes reproduzcan canciones a través del Music Player activo.
- **Haptics**: deja que los personajes controlen dispositivos hápticos conectados.
- **Influence**: deja que los personajes influyan en un chat conectado.
- **Notes**: deja que los personajes guarden notas duraderas para un chat conectado.
- **Calls**: deja que los personajes te llamen para una llamada de Conversation.
- **Reactions**: deja que los personajes reaccionen a los mensajes con distintivos de emoji.
- **UNO**: deja que los personajes inicien una partida de UNO en la mesa cuando aceptas jugar.
- **Chess**: deja que los personajes acepten un reto de ajedrez uno contra uno en la mesa.
- **Poker**: deja que los personajes se sienten a una partida de póquer Texas Hold'em en la mesa.
- **8-Ball Pool**: deja que los personajes preparen una partida de billar de bola 8 en la mesa.
- **Tic-Tac-Toe**: deja que los personajes acepten un reto de tres en raya uno contra uno.
- **Rock-Paper-Scissors**: deja que los personajes acepten una partida de piedra, papel o tijera uno contra uno.

Un único interruptor maestro **Commands** controla todos ellos. Cuando el interruptor maestro está desactivado, ninguna familia de comandos funciona, aunque parezca activada.

## Los mensajes autónomos y tu estado de presencia

Los mensajes autónomos permiten que un personaje se comunique contigo primero. Cuando **Autonomous Messages** está activado, un personaje puede enviarte un mensaje después de que hayas estado en silencio un rato. El personaje sopesa su propia locuacidad y, si los horarios están activados, su disponibilidad. Los mensajes autónomos están activados de forma predeterminada cuando terminas el asistente.

Puedes cambiar este interruptor más tarde. Abre el panel lateral de ajustes del chat y busca la sección **Autonomous Messaging**.

### Tu estado de presencia

Tienes un estado de presencia que define cuándo se comunican los personajes contigo. Está en el pie de la barra lateral como una pastilla de color con tu estado actual. Haz clic en la pastilla para elegir una de cuatro opciones:

- **Active**: estás en línea y disponible.
- **Idle**: se establece automáticamente cuando estás ausente.
- **Do Not Disturb**: suprime los mensajes autónomos.
- **Invisible**: oculta tu estado a los personajes.

Junto a la pastilla hay un campo **What are you doing?** (¿Qué estás haciendo?). Escribe aquí una actividad personalizada corta si quieres que los personajes sepan qué haces. Tu estado de presencia es global, así que se mantiene igual en todos los chats.

## Reacciones y notificaciones

Cualquier mensaje de Conversation puede recibir una reacción de emoji. Usa el botón de reacción en un mensaje para añadir la tuya. Marinara guarda tu reacción como una nota del tipo `[User reacted with ...]`, y las respuestas futuras pueden verla. Esto permite que un personaje note que reaccionaste.

Cuando la familia de comandos **Reactions** está activada, los personajes también pueden reaccionar. Pueden reaccionar a tus mensajes o a los mensajes de los demás. Las reacciones resultan útiles en los chats grupales, ya que un personaje puede responder de forma ligera sin un mensaje completo.

Cuando un personaje te escribe en un chat que no estás viendo en ese momento, aparece un globo de avatar flotante en el borde de la pantalla. Haz clic en el globo para saltar a ese chat, o descártalo con la X. En el teléfono, varios globos pendientes se agrupan en uno solo que puedes tocar.

## Selfies

Los personajes pueden enviarte selfies, que son fotos del personaje generadas por IA. Las selfies se diferencian del arte de escena usado en Roleplay y Game Mode, porque una selfie está ligada a un solo personaje.

Para usar selfies, instala **Illustrator** desde **Agents → Download Agents**. Luego abre el panel lateral de ajustes del chat, ve a **Agents → Illustrator Settings** y establece una **Selfie Connection**. Una conexión de selfie es un proveedor de generación de imágenes. Cada selfie cuesta una llamada de generación de imágenes.

La configuración completa, incluido el estilo, la resolución y el botón de solicitud manual, está en [Selfies](selfies.md).

## Juegos de mesa

Conversation Mode tiene seis paquetes opcionales de juegos de mesa: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** y **Rock-Paper-Scissors**. Instala los juegos que quieras desde **Agents → Download Agents**. La app reparte el tablero, hace cumplir las reglas y hace que cada personaje narre sus propios movimientos manteniéndose en personaje. Los juegos de mesa solo se ejecutan en chats de Conversation.

Puedes iniciar un juego de tres formas:

1. Escribe un comando slash en el cuadro de mensaje y luego pulsa Enter.
2. Escribe un mensaje normal como "let's play uno".
3. Deja que un personaje te invite, cuando su familia de comandos está activada.

Los comandos slash son:

```
/uno
```

```
/chess
```

```
/poker
```

```
/8ball
```

```
/tictactoe
```

```
/rps
```

Cada juego tiene su propio cuadro de configuración con opciones. Para conocer las reglas completas, los cuadros de configuración y los tableros, consulta [Table Games](table-games.md).

## Horarios de los personajes

Cada personaje en un chat de Conversation puede tener un horario semanal. Un horario establece el estado y la actividad del personaje a lo largo de una cuadrícula de 7 días y 24 horas. Hace que los mensajes autónomos se sientan conscientes de la rutina, de modo que un personaje marcado como ausente no se comunicará durante esas horas.

Puedes crear un horario durante la configuración activando **Generate Schedules**. También puedes crear o editar uno más tarde desde la sección **Autonomous Messaging** del panel lateral de ajustes del chat. [Character Schedules and Autonomous Messaging](schedules.md) cubre el editor de horarios completo, los límites diarios y el comando de anulación `/status`.

## Solución de problemas

### Los mensajes autónomos son demasiado frecuentes

Abre el panel lateral de ajustes del chat y desactiva **Autonomous Messages** en la sección **Autonomous Messaging**. También puedes poner tu estado de presencia en **Do Not Disturb**, que suprime los mensajes autónomos. Si usas horarios, marca más horas como ausente en [Character Schedules and Autonomous Messaging](schedules.md).

### Un personaje responde a todo en un chat grupal

Los chats grupales tienen controles para turnarse, como **Reply When Mentioned**. Abre [Group Chats](../chats/group-chats.md) para configurar quién habla y cuándo.

### Un personaje olvida cosas de antes

Los chats largos llenan la memoria del modelo. Prueba un modelo con una ventana de contexto más grande, o añade datos clave a una entrada de lorebook (libro de trasfondo) para que se mantengan en el contexto. También puedes iniciar un chat nuevo con el mismo personaje y persona. Para más ayuda, consulta [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

### Una selfie no se parece al personaje

Abre los ajustes de **Selfies** y establece **Attach Card Appearance** en **Images only** (Solo imágenes) o **Images and videos** (Imágenes y videos). Si tu proveedor de imágenes admite imágenes de referencia, establece también **Send Avatar References**. Consulta [Selfies](selfies.md) para más detalles.

## Guías relacionadas

- [Conversation Audio and Video Calls](calls.md)
- [Character Schedules and Autonomous Messaging](schedules.md)
- [Conversation Mode Profiles](profiles.md)
- [Selfies](selfies.md)
- [Custom Emojis, Stickers, and GIFs](emoji-stickers-gifs.md)
- [Table Games](table-games.md)
- [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md)
