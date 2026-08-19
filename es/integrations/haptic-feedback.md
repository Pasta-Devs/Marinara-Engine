# Configuración de la respuesta háptica

Esta guía te muestra cómo dejar que un personaje de IA controle dispositivos hápticos conectados en Marinara Engine. Cubre la instalación de la app ayudante, cómo agregar el agente **Haptic Feedback** a un chat, la conexión con tu dispositivo y los ajustes de contacto que puedes modificar.

## Qué es la respuesta háptica

La respuesta háptica permite que un personaje de IA envíe señales de contacto a un dispositivo háptico conectado (un juguete íntimo) durante un chat. Marinara Engine no se comunica con el dispositivo directamente. En cambio, envía comandos a una app complementaria gratuita llamada **Intiface Central**, y esa app se comunica con tu dispositivo.

**Intiface Central** usa un protocolo de dispositivos llamado **Buttplug.io**. Es el mismo estándar abierto que muchos juguetes y otras apps admiten. Instalas **Intiface Central** una vez, emparejas tu dispositivo con ella, y Marinara se conecta a ella a través de una dirección de red local.

La respuesta háptica está construida como uno de los **Agents** (Agentes) del chat, los ayudantes de IA que puedes agregar a un chat. Funciona en los modos Conversation, Roleplay y Game.

## Antes de empezar

Necesitas tener tres cosas listas antes de activar la respuesta háptica.

1. Instala **Intiface Central** desde el sitio web oficial. Abre esta dirección en tu navegador.

```
https://intiface.com/central/
```

2. Abre **Intiface Central** e inicia su servidor. Busca el botón de inicio del servidor dentro de la app.
3. Empareja o conecta tu dispositivo dentro de **Intiface Central** para que la app pueda verlo.

Si **Intiface Central** no se está ejecutando con su servidor iniciado, Marinara no puede enviar ninguna señal de contacto.

## Agrega el agente Haptic Feedback

Agregas la respuesta háptica de la misma forma en que agregas cualquier otro agente, desde los ajustes del chat.

1. Abre un chat de Conversation, Roleplay o Game.
2. Abre **Chat Settings** (Ajustes del chat) para ese chat.
3. Ve a la sección **Agents**.
4. Agrega el agente **Haptic Feedback** al chat.
5. Busca la tarjeta **Haptic Feedback** que ahora aparece en la lista **Agents**.

Activa el interruptor **Haptic Feedback** en la parte superior de la tarjeta. Cuando está desactivado, la descripción dice "Allow this agent to send touch cues during the chat" (Permite que este agente envíe señales de contacto durante el chat). Cuando está activado, la descripción dice "Touch cues are enabled for this chat" (Las señales de contacto están activadas para este chat). El interruptor está desactivado de forma predeterminada.

Una vez que el interruptor está activado, la IA puede enviar señales de contacto ocultas mientras escribe. Estas señales no aparecen como texto en el chat. Se envían a todos los dispositivos conectados.

## Conecta, escanea y encuentra tu dispositivo

Cuando abres la tarjeta **Haptic Feedback**, Marinara intenta conectarse a **Intiface Central** automáticamente usando la dirección guardada. También puedes conectarte a mano.

La tarjeta muestra una fila de estado con un punto de color. Un punto verde significa conectado. Un punto rojo significa no conectado. Junto a él hay un botón que dice **Connect** (Conectar) cuando estás sin conexión y **Disconnect** (Desconectar) cuando estás conectado.

Para conectarte a mano, haz clic en **Connect**. Si funciona, la fila muestra "Connected" (Conectado) con la dirección del servidor.

Si falla, ves un mensaje que dice que la app no pudo conectarse. Te pide que te asegures de que **Intiface Central** se esté ejecutando y de que el servidor esté iniciado. El mensaje incluye un enlace al sitio web de **Intiface Central**.

Una vez conectado, la tarjeta muestra cuántos dispositivos se encuentran. Dice "No devices found" (No se encontraron dispositivos) cuando no hay ninguno conectado, o el número de dispositivos cuando hay algunos. Haz clic en **Scan for devices** (Escanear dispositivos) para buscar de nuevo. El botón dice "Scanning..." (Escaneando...) mientras se ejecuta un escaneo. La tarjeta enumera cada dispositivo con su nombre y las acciones que admite, como vibrar o rotar.

Marinara también entrega al Haptic Agent el nombre exacto de Intiface, un tipo de juguete derivado de sus capacidades y las acciones compatibles. Así puede elegir el dispositivo y la acción correctos en lugar de suponer que todos los juguetes son vibradores.

## Acciones y patrones compatibles

Marinara usa todos los tipos de salida que Intiface declara para un dispositivo conectado: vibración, rotación, oscilación, constricción, inflado, posición lineal, temperatura, rociado e iluminación. La posición lineal controla dispositivos que acarician, empujan o bombean; el inflado controla dispositivos de bombeo por presión de aire.

El agente puede aplicar los patrones **Steady**, **Tap**, **Pulse**, **Wave**, **Ramp** o **Impact** a cualquier acción que no sea detener. Los patrones posicionales alternan objetivos reales de movimiento, de modo que un patrón de bombeo o empuje se ejecuta a lo largo del tiempo en vez de enviar varios movimientos a la vez.

### El campo Intiface URL

El campo **Intiface URL** contiene la dirección de red de tu servidor de **Intiface Central**. Es una dirección WebSocket, que es solo un enlace local que las dos apps usan para comunicarse. El valor predeterminado se muestra a continuación.

```
ws://127.0.0.1:12345
```

La dirección `127.0.0.1` significa "esta misma computadora". Si dejas el campo en blanco, Marinara usa el valor predeterminado del servidor. Marinara también recuerda tu dirección en el navegador, así que se reutiliza en todos los chats y dispositivos.

Si ejecutas Marinara en Docker, o abres Marinara en un navegador en un dispositivo diferente, `127.0.0.1` no alcanzará tu **Intiface Central**. En ese caso, ingresa la dirección de la computadora que ejecuta **Intiface Central**. Se parece al ejemplo de abajo, donde reemplazas los números con la dirección real de esa computadora.

```
ws://192.168.1.50:12345
```

## Sensibilidad al contacto

La tarjeta **Haptic Feedback** muestra un control de **Touch sensitivity** (Sensibilidad al contacto) con tres opciones en todos los modos de chat. La sensibilidad orienta la facilidad con la que el agente elige una salida suave o fuerte; no impone un tope rígido. Todas las opciones pueden usar el rango completo de intensidad del dispositivo, `0.0-1.0`, cuando la acción lo requiere.

Las tres opciones orientan el estilo de respuesta del agente.

| Opción | Sensación | Notas |
|---|---|---|
| **Subtle** | Favorece una respuesta más suave | El rango completo sigue disponible |
| **Standard** | Respuesta equilibrada para la mayoría de las escenas | La predeterminada; rango completo disponible |
| **Intense** | Elige una respuesta más fuerte con mayor facilidad | Puede usar la salida completa |

**Standard** está seleccionada de forma predeterminada. Elige el estilo de respuesta que se sienta bien para tu escena. Marinara sigue validando todos los comandos contra el rango físico de Intiface, `0.0-1.0`.

## Contacto incidental

Debajo del control de sensibilidad, todos los modos de chat también muestran un interruptor **Incidental contact** (Contacto incidental). Dice "Tiny taps for accidental brushes and bumps" (Toques leves para roces y golpes accidentales). Este interruptor está desactivado de forma predeterminada.

Cuando está desactivado, la IA ignora los pequeños contactos accidentales en la historia. Solo envía señales para el contacto deliberado o firme. Actívalo si quieres toques leves para los roces y golpes también.

## Usarlo desde otro dispositivo

De forma predeterminada, Marinara solo acepta comandos hápticos de la misma computadora que ejecuta el servidor de Marinara. Esto mantiene el control del dispositivo local y privado.

Por esto, la respuesta háptica no funcionará si abres Marinara desde un teléfono u otro dispositivo. Esto aplica cuando ese dispositivo alcanza un servidor de Marinara que se ejecuta en otro lugar. Las acciones de conectar, escanear y enviar comandos se rechazan a menos que cambies los ajustes del servidor.

Para permitir el control háptico desde otro dispositivo, activa un ajuste del servidor llamado `HAPTICS_ALLOW_REMOTE`. También debes configurar una protección de acceso, como Basic Auth o un secreto de administrador. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md) para el ajuste. Consulta la [guía de acceso remoto](../REMOTE_ACCESS.md) para la protección de acceso. Ingresas el acceso de administrador en **Settings** (Configuración), en el área **Advanced** (Avanzado), en la sección **Admin Access** (Acceso de administrador).

## Si algo no funciona

Si la IA nunca activa tu dispositivo, revisa esto en orden.

1. Asegúrate de que **Intiface Central** esté abierto y de que su servidor esté iniciado.
2. Asegúrate de que tu dispositivo esté emparejado y aparezca en la lista de dispositivos después de que hagas clic en **Scan for devices**.
3. Asegúrate de que el punto de estado esté verde y de que el interruptor **Haptic Feedback** esté activado.
4. Si estás en un teléfono o un dispositivo remoto, revisa las notas de acceso remoto de arriba.

Cuando **Intiface Central** no está conectado, o no hay ningún dispositivo conectado, Marinara omite la señal de contacto de la IA en silencio. No verás un error en el chat.

## Guías relacionadas

- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Acceso remoto: Basic Auth y lista de IP permitidas](../REMOTE_ACCESS.md)
