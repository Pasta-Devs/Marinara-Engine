# Referencia de comandos slash

Un comando slash es un atajo que escribes en el cuadro de mensaje, empezando con `/`, para hacer algo rápido. Algunos cambian la pantalla al instante. Otros piden al modelo que escriba algo.

## Cómo funcionan los comandos slash

1. Escribe el comando en el cuadro de mensaje, en la parte inferior de un chat.
2. Haz clic en **Send** (Enviar), o pulsa <kbd>Enter</kbd> si **Send on Enter** (Enviar con Enter) está activado para tu modo de chat. Consulta [Enviar mensajes y streaming](sending-and-streaming.md#send-on-enter).

En cuanto escribes `/`, aparece encima del cuadro un menú de comandos coincidentes. Cada fila muestra el formato del comando y una descripción corta. Haz clic en una fila para rellenarla en el cuadro, añade cualquier texto extra y envíalo. La indicación del cuadro también menciona los comandos: **Write your response, / for commands** (Escribe tu respuesta, / para comandos) en Roleplay, y "Message @Alice, / for commands" en Conversation.

En las tablas, el formato de cada comando está en su fila. Sustituye las etiquetas entre corchetes, como `[name]` o `[range]`, por tus propios valores y no escribas los corchetes. Puedes omitir las entradas marcadas con `(optional)`. Un `|` separa alternativas. Muchos comandos tienen alias más cortos, como `/cont` para `/continue`. Para ver todos los comandos en la app, escribe:

```text
/help
```

Algunos comandos se ejecutan en tu navegador y no cuestan nada. Otros piden al modelo que escriba texto, lo que usa tu cuenta y puede gastar tokens (las unidades que los servicios cuentan y facturan).

Los comandos slash funcionan en los cuadros de mensaje de Conversation y Roleplay. En Game, solo funciona un `/illustrate` (o `/ill`) sin rango ni prompt (las instrucciones enviadas a la IA), y solo cuando las ilustraciones de Game están configuradas con una cuenta de imágenes. Cualquier otra cosa que empiece con una barra se envía como texto normal. En Roleplay y Conversation, los comandos `/illustrate`, `/selfie` y `/video` necesitan el agente Illustrator y solo aparecen cuando está instalado.

Varios comandos usan números de mensaje. Marinara cuenta desde el primer mensaje del chat como número 1. `/goto`, `/hide` y `/unhide` usan estos números. **Show message numbers** (Mostrar números de mensaje) los muestra. Consulta [Acciones de mensaje](messages.md#message-display-toggles).

## Comandos de chat y mensajes

Funcionan en Conversation y Roleplay.

| Comando | Qué hace |
| --- | --- |
| `/help` | Enumera todos los comandos slash. |
| `/send` | Publica un mensaje como tu persona sin pedir una respuesta. Las macros se sustituyen, como con **Send**. Formato: `/send [message]`. |
| `/continue` | Añade más texto a la última respuesta de la IA, sin un mensaje nuevo. También `/cont`. **Settings → General → Responses → Add a new line before /continue text** (Configuración → General → Respuestas → Añadir una línea nueva antes del texto de /continue) define si el texto empieza después de una línea en blanco o en el punto de corte. |
| `/goto` | Desplaza el chat hasta un número de mensaje. También `/jump`, `/scroll`. Formato: `/goto [number]`. |
| `/hide` | Oculta mensajes al modelo en los turnos siguientes. Formato: `/hide [range] [name (optional)]`. |
| `/unhide` | Vuelve a mostrar los mensajes ocultos globalmente. Formato: `/unhide [range]`. |
| `/sys` | Añade un mensaje de sistema. Aparece en el chat y guía al modelo, pero ningún personaje lo dice. También `/system`. Formato: `/sys [message]`. |
| `/macros` | Enumera las macros de prompt, como `{{user}}` y `{{char}}`. También `/macro`. |
| `/remind` | Configura un temporizador y luego publica un recordatorio en el chat. También `/reminder`, `/timer`. Formato: `/remind [time] [message]`. |

Ejemplos:

```text
/goto 27
/hide 3-8
/remind 30m check the oven
```

`/hide` y `/unhide` aceptan un número, un rango o una mezcla: `/hide 5`, `/hide 3-8`, `/hide 2-5,9,12`. Los mensajes ocultos siguen en el chat, pero el modelo no los lee.

En Roleplay, añade un nombre de personaje después del rango para ocultar los mensajes solo a ese personaje. Los demás personajes conservan el acceso.

```text
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

Escribe entre comillas los nombres que contienen espacios. Las formas anteriores con el nombre primero, como `/hide Maukie 3-8`, siguen funcionando. Si un nombre coincide con varios personajes, usa el nombre completo. Escribe entre comillas los nombres numéricos para distinguirlos de los números de mensaje, por ejemplo `/hide 1 "123"`. Para revisar o deshacer la ocultación por personaje, usa el selector de avatares **Hide from AI** (Ocultar a la IA) del mensaje en un chat grupal de Roleplay, o **Unhide from AI** (Mostrar a la IA) en un chat con un solo personaje. `/unhide` solo deshace la ocultación global.

`/remind` toma un tiempo con `h` (horas), `m` (minutos) o `s` (segundos) y luego un mensaje. El recordatorio vive en la sesión de tu navegador, así que mantén la pestaña abierta hasta que se active.

## Comandos de historia y roleplay

| Comando | Qué hace |
| --- | --- |
| `/guided` | Guía la siguiente respuesta. También `/narrator`, `/narrate`, `/nar`. Formato: `/guided [direction]`. |
| `/as` | Publica un mensaje como un personaje, o pide a ese personaje que responda. También `/respond`. Formato: `/as [name] [message (optional)]`. |
| `/emote` | Enumera o cambia una expresión del sprite. También `/emotion`, `/sprite`. Formato: `/emote [expression]`. |
| `/roll` | Tira dados y publica el resultado. También `/r`, `/dice`. Formato: `/roll [dice (optional)]`. |
| `/random` | Pide al modelo que añada un evento sorpresa. También `/rand`, `/event`. |
| `/scene` | Inicia una escena de Roleplay que se ramifica a partir de la conversación. También `/rp`. Formato: `/scene [description (optional)]`. |
| `/illustrate` | Solo en Roleplay. Genera una imagen de galería. Necesita el agente Illustrator. También `/ill`. Formato: `/illustrate [range=N-M] [prompt]`. |
| `/html` | Solo en Roleplay. Crea un artefacto dentro del mundo, como `a spellbook page`, al final de la respuesta más reciente. Formato: `/html [what you want]`. |
| `/video` | Solo en Roleplay. Crea un clip corto de la respuesta más reciente, o de tu descripción, debajo de esa respuesta. Sigue el ajuste **First frame** (Primer fotograma) de Illustrator. Necesita Illustrator. Formato: `/video [description]`. |
| `/impersonate` | Escribe una respuesta como tu persona. También `/imp`. Formato: `/impersonate [direction (optional)]`. |
| `/impersonate_prompt` | Establece la instrucción que usa `/impersonate` en este chat. También `/imp_prompt`. Formato: `/impersonate_prompt [prompt or reset]`. |

La mayoría funcionan mejor en Roleplay. `/scene` se ejecuta desde una Conversation. `/impersonate` e `/impersonate_prompt` no están disponibles en Conversation.

### Guiar una respuesta

```text
/guided make him confess he is lying
/guided respond as "Powers That Be" describe the approaching storm
```

`reply as` y `respond for` también funcionan en lugar de `respond as`. Consulta [Generación guiada e Impersonate](guided-and-impersonate.md).

### Publicar como un personaje

Omite el mensaje para que el modelo escriba la siguiente respuesta de ese personaje.

```text
/as Dottore "The experiment begins."
/as Dottore
```

### Tirar dados

`/roll 2d6` tira dos dados de seis caras. Añade un modificador, como en `/roll 1d20+5`. Sin nada después, `/roll` tira `1d20`. Para conservar solo algunos dados, añade `kh` (conservar los más altos) o `kl` (conservar los más bajos) y un número: `/roll 4d6kh3` suma los tres más altos, y `/roll 2d20kl1` conserva el menor de dos. En cambio, `dl` y `dh` eliminan los más bajos o los más altos, como en `/roll 4d6dl1`. Los dados que no cuentan se siguen mostrando, atenuados.

### Cambiar un sprite

Un sprite es una pieza de arte del personaje que muestra una expresión. Escribe `/emote` solo para ver las expresiones disponibles, o nombra una:

```text
/emote joy
/emote "Powers That Be" joy
```

Con un nombre y sin expresión, enumera las expresiones de ese personaje. Necesita un chat de Roleplay con sprites subidos. Consulta [Sprites de personaje](../characters/sprites.md).

### Ilustrar y crear artefactos

`/illustrate range=12` ilustra el mensaje 12. `/illustrate range=12-18` envía los mensajes del 12 al 18 al Illustrator. Usa los mismos números de mensaje que `/goto`, en orden ascendente y con un máximo de 200 mensajes. Los mensajes ocultos quedan fuera. La imagen se adjunta al último mensaje visible del rango. Los mensajes anteriores siguen disponibles con Advanced Memory activado. Sin `range=`, el comando trabaja sobre la escena actual. Un prompt que escribas se usa tal como está.

`/html a terminal readout` no necesita ningún agente y funciona tanto si **HTML Artifacts** (Artefactos HTML) está activado como si no. El narrador puede pedir lo mismo con `[html: prompt="..."]` cuando **HTML Artifacts** está activado en **Roleplay Commands** (Comandos de Roleplay). Consulta [Artefactos bajo demanda](../roleplay/getting-started.md#artifacts-on-demand).

### Escribir tu respuesta

`/impersonate ask about the weather` escribe una respuesta con la voz de tu persona. Tu persona es el personaje que te representa, escrito `{{user}}` en los prompts. Estos dos comandos no están disponibles en Conversation.

## Comandos del modo Conversation

Solo funcionan en un chat de Conversation.

| Comando | Qué hace |
| --- | --- |
| `/games` | Abre el selector de juegos instalados. `/game` y `/play` hacen lo mismo. |
| `/selfie` | Genera una selfie con el agente Illustrator. Añade un nombre para elegir un personaje. Formato: `/selfie [name (optional)]`. |
| `/video` | Hace que un personaje envíe un mensaje de video corto, con los ajustes de **Video messages** (Mensajes de video) del chat. Consulta [Mensajes de video](../conversation/selfies.md#video-messages). Formato: `/video [name (optional)]`. |
| `/uno` | Inicia una partida de UNO con los personajes del chat. |
| `/chess` | Inicia una partida de ajedrez uno contra uno con un personaje. |
| `/poker` | Inicia una partida de Texas Hold'em con los personajes. |
| `/8ball` | Inicia una partida uno contra uno de billar bola 8 con un personaje. `/pool` hace lo mismo. |
| `/status` | Establece o borra el estado de presencia de un personaje. Formato: `/status [online, idle, dnd, offline or clear] [name]`. |

Los comandos de juegos abren la pantalla de configuración de ese juego, y cada uno solo aparece cuando su agente de juego está instalado. Puedes jugar una partida a la vez en un chat. Consulta [Juegos de mesa](../conversation/table-games.md).

`/status` anula la presencia de un personaje. El estado puede ser `online`, `idle`, `dnd` (no molestar) u `offline`. `clear` quita la anulación. En un chat con varios personajes, añade el nombre al final.

```text
/status idle
/status online Alice
```
