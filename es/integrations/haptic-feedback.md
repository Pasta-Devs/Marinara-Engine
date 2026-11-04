# Configuración de la respuesta háptica

La respuesta háptica permite que un personaje de IA envíe señales de contacto a un dispositivo háptico conectado (un juguete íntimo) durante un chat. Esta guía muestra cómo instalar la app ayudante, agregar el agente **Haptic Feedback** a un chat, conectarte a tu dispositivo y modificar los ajustes de contacto.

Marinara Engine no se comunica con el dispositivo directamente. Envía comandos a una app complementaria gratuita, **Intiface Central**, que se comunica con tu dispositivo. Intiface Central usa **Buttplug.io**, un estándar abierto que admiten muchos juguetes y apps. Marinara se conecta a ella a través de una dirección de red. La respuesta háptica es un agente del chat (un ayudante de IA que agregas a un chat). Funciona en los modos Conversation, Roleplay y Game.

## Antes de empezar

1. Instala **Intiface Central** desde `https://intiface.com/central/`.
2. Ábrela e inicia su servidor con el botón de inicio del servidor.
3. Empareja tu dispositivo dentro de Intiface Central para que la app pueda verlo.

Si Intiface Central no se está ejecutando con su servidor iniciado, Marinara no puede enviar señales de contacto. También necesitas tener instalado el agente **Haptic Feedback**. Consulta [Descripción general de los agentes](../agents/agents-overview.md).

## Agrega el agente Haptic Feedback

1. Abre un chat de Conversation, Roleplay o Game.
2. Abre **Chat Settings** (Ajustes del chat) y ve a **Agents** (Agentes).
3. Agrega el agente **Haptic Feedback**. Aparece una tarjeta **Haptic Feedback** en la lista **Agents**.
4. Activa el interruptor **Haptic Feedback** en la parte superior de la tarjeta.

El interruptor está desactivado de forma predeterminada. Cuando está desactivado, la descripción dice "Allow this agent to send touch cues during the chat" (Permite que este agente envíe señales de contacto durante el chat). Cuando está activado, dice "Touch cues are enabled for this chat" (Las señales de contacto están activadas para este chat). Con él activado, la IA envía señales de contacto ocultas mientras escribe. No aparecen como texto en el chat. Se envían a todos los dispositivos conectados.

## Conecta y escanea

Cuando abres la tarjeta, Marinara intenta conectarse a Intiface Central usando la dirección guardada. La fila de estado muestra un punto verde cuando hay conexión y un punto rojo cuando no la hay. Junto a él aparece **Connect** (Conectar) cuando estás sin conexión y **Disconnect** (Desconectar) cuando estás conectado.

1. Haz clic en **Connect**. Si funciona, la fila muestra "Connected" (Conectado) con la dirección del servidor.
2. Haz clic en **Scan for devices** (Escanear dispositivos) para buscar de nuevo. El botón dice "Scanning..." (Escaneando...) mientras se ejecuta.

La tarjeta muestra "No devices found" (No se encontraron dispositivos) o el número de dispositivos, y enumera cada uno con su nombre exacto de Intiface y las acciones que admite. Marinara también entrega al Haptic Agent ese nombre, un tipo de juguete derivado de sus capacidades y sus acciones, para que elija el dispositivo y la acción correctos en lugar de suponer que todos los juguetes vibran.

Si no funcionó: un intento de conexión fallido muestra un mensaje que te pide que te asegures de que Intiface Central se esté ejecutando y de que su servidor esté iniciado, con un enlace a su sitio web.

## Acciones y patrones compatibles

Marinara usa todos los tipos de salida que Intiface declara para un dispositivo: vibración, rotación, oscilación, constricción, inflado, posición lineal, temperatura, rociado e iluminación. La posición lineal controla dispositivos que acarician, empujan o bombean. El inflado controla dispositivos de bombeo por presión de aire.

El agente puede aplicar los patrones **Steady**, **Tap**, **Pulse**, **Wave**, **Ramp** o **Impact** a cualquier acción que no sea detener. Los patrones posicionales alternan objetivos reales de movimiento, de modo que un patrón de bombeo o de caricia se ejecuta a lo largo del tiempo en vez de enviar varios movimientos a la vez.

## El campo Intiface URL

**Intiface URL** es la dirección WebSocket de tu servidor de Intiface Central. Una dirección WebSocket es un enlace que las dos apps usan para comunicarse. El valor predeterminado es:

```text
ws://127.0.0.1:12345
```

`127.0.0.1` significa esta misma computadora. Si dejas el campo en blanco, Marinara usa el valor predeterminado del servidor, que puedes cambiar con la variable de entorno `INTIFACE_URL` en `.env`. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md). Marinara guarda tu dirección con el chat y la recuerda en este navegador, así que los demás chats que abras aquí empiezan con ella.

La dirección se queda en esta instalación de Marinara. Las exportaciones de chats, los perfiles de ajustes exportados y los archivos de **Export Profile** (Exportar perfil) la dejan fuera, e importar cualquiera de ellos nunca la configura. Vuelve a introducirla después de llevar un chat a otra instalación.

Si ejecutas Marinara en Docker, o la abres en un navegador en un dispositivo diferente, `127.0.0.1` no alcanzará Intiface Central. Ingresa la dirección de la computadora que la ejecuta, reemplazando los números por su dirección real:

```text
ws://192.168.1.50:12345
```

## Sensibilidad al contacto

La tarjeta muestra un control **Touch sensitivity** (Sensibilidad al contacto) en todos los modos de chat. Orienta la facilidad con la que el agente elige una salida suave o fuerte. No es un tope: todas las opciones pueden usar el rango completo de intensidad `0.0-1.0` cuando la acción lo requiere. Marinara valida todos los comandos contra el rango físico de Intiface.

| Opción | Sensación |
| --- | --- |
| **Subtle** | Favorece una respuesta más suave. |
| **Standard** | Respuesta equilibrada para la mayoría de las escenas. Es la opción predeterminada. |
| **Intense** | Elige una respuesta más fuerte con mayor facilidad. |

## Contacto incidental

El interruptor **Incidental contact** (Contacto incidental), que dice "Tiny taps for accidental brushes and bumps" (Toques leves para roces y golpes accidentales), está desactivado de forma predeterminada. Cuando está desactivado, la IA ignora los pequeños contactos accidentales y solo envía señales para el contacto deliberado o firme. Actívalo para recibir también toques leves por roces y golpes.

<a id="use-it-from-another-device"></a>

## Úsalo desde otro dispositivo

De forma predeterminada, Marinara solo acepta comandos hápticos de la computadora que ejecuta el servidor de Marinara. Esto mantiene privado el control del dispositivo. Por eso, la respuesta háptica no funciona cuando abres Marinara desde un teléfono u otro dispositivo que accede a un servidor que está en otro lugar. Las acciones de conectar, escanear y enviar comandos se rechazan.

Para permitirlo, activa el ajuste del servidor `HAPTICS_ALLOW_REMOTE` y configura una protección de acceso: un inicio de sesión o un secreto de administrador. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md) y la [guía de acceso remoto](../REMOTE_ACCESS.md). El acceso de administrador se introduce en **Settings → Advanced → Admin Access** (Configuración → Avanzado → Acceso de administrador).

## Si algo no funciona

Si la IA nunca activa tu dispositivo, revisa en orden:

1. Intiface Central está abierta y su servidor está iniciado.
2. Tu dispositivo está emparejado y aparece en la lista después de **Scan for devices**.
3. El punto de estado está verde y el interruptor **Haptic Feedback** está activado.
4. Si estás en un teléfono o un dispositivo remoto, consulta [Úsalo desde otro dispositivo](#use-it-from-another-device).

Cuando Intiface Central no está conectada, o no hay ningún dispositivo conectado, Marinara omite la señal en silencio y no muestra ningún error en el chat.

## Guías relacionadas

- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md)
