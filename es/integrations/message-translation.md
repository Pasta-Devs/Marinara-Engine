# Traducción de mensajes

Marinara Engine puede traducir los mensajes del chat entre idiomas. Esta guía cubre los cuatro proveedores de traducción, los interruptores de traducción automática, el botón **Translate** (Traducir) por mensaje y los límites de cada proveedor.

La traducción se configura por chat. Cada chat guarda su propio proveedor, idiomas y claves. Para empezar chats nuevos con los mismos ajustes, guárdalos como [valores predeterminados del traductor](#translator-defaults-for-new-chats).

## Dónde encontrar los ajustes de traducción

1. Abre un chat en cualquier modo (Conversation, Roleplay o Game).
2. Abre el panel **Chat Settings** (Ajustes del chat) de ese chat.
3. Busca la sección **Translation** (Traducción).

Todos los ajustes de proveedor e interruptores que siguen están en esa sección **Translation**.

## Elegir un proveedor

El menú desplegable **Provider** (Proveedor) tiene cuatro opciones:

| Proveedor | Qué necesita | Notas |
|---|---|---|
| **Google Translate** | Nada | Predeterminado. Gratis, sin clave. Limitado a 5000 caracteres por solicitud. |
| **DeepL API** | Una API key de DeepL | Mayor calidad. Funcionan tanto las claves gratuitas como las de pago. |
| **DeepLX (self-hosted)** | La URL de un servidor DeepLX | Para una instancia de DeepLX que ejecutas tú mismo. |
| **AI (via connection)** | Una conexión de IA | Usa uno de tus proveedores de IA para traducir. |

**Google Translate** está seleccionado de forma predeterminada y no necesita configuración. Elige otro proveedor solo si necesitas alguna de las funciones de abajo.

### Model Language y My Language

Dos campos fijan los idiomas. Ambos son `en` (inglés) de forma predeterminada.

- **Model Language** (Idioma del modelo): tus propios mensajes se traducen a este idioma antes de que la IA los lea. **Translate My Messages** (Traducir mis mensajes) y **Translate draft** (Traducir borrador) lo usan.
- **My Language** (Mi idioma): las respuestas de la IA se traducen a este idioma. **Auto-Translate Responses** (Traducir respuestas automáticamente) y el botón **Translate** por mensaje lo usan.

El formato depende del proveedor:

- Para **Google Translate**, **DeepL API** y **DeepLX (self-hosted)**, escribe un código corto de idioma. Ejemplos: `en`, `ja`, `es`, `de`, `fr`, `zh`, `ko`.
- Para **AI (via connection)**, escribe un nombre de idioma. Ejemplos: `English`, `Japanese`, `Spanish`.

### Configuración de DeepL API

Cuando eliges **DeepL API**, aparece un campo **DeepL API Key** (Clave de API de DeepL). Pega aquí la clave de tu cuenta de DeepL. Las claves de DeepL se ven así:

```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

Una clave que termina en `:fx` es una clave de nivel gratuito. Marinara la envía al servicio gratuito de DeepL. Cualquier otra clave se trata como una clave de pago.

### Configuración de DeepLX

DeepLX es un servidor de traducción gratuito y autoalojado que ejecutas tú mismo. Cuando eliges **DeepLX (self-hosted)**, aparece un campo **DeepLX URL** (URL de DeepLX). Escribe la dirección de tu servidor DeepLX, por ejemplo:

```
http://localhost:1188
```

Si tu servidor DeepLX se ejecuta en tu propia computadora o en tu red local, la dirección es una dirección local. Marinara bloquea las solicitudes a direcciones locales de forma predeterminada por seguridad. Para permitirlas, escribe esta línea en tu archivo `.env` y guarda el archivo:

```
DEEPLX_LOCAL_URLS_ENABLED=true
```

El archivo `.env` es el archivo de ajustes del servidor. La [Referencia de configuración del servidor](../CONFIGURATION.md) explica dónde encontrarlo. No necesitas reiniciar el servidor. Toma el cambio en unos pocos segundos.

Un servidor DeepLX en una dirección pública de internet no necesita este ajuste. Solo se bloquean de forma predeterminada las direcciones locales y de red privada.

### Configuración de traducción con IA

Cuando eliges **AI (via connection)**, Marinara usa uno de tus proveedores de IA para traducir. Aparecen tres campos adicionales.

El menú desplegable **Connection** (Conexión) te deja elegir qué conexión de IA hace la traducción. Este campo es obligatorio. Si lo dejas sin definir, la traducción falla con el mensaje "Connection ID is required for AI translation". Una conexión es un vínculo guardado a un proveedor de IA. Consulta la guía de conexiones de abajo para configurar una.

Los campos **Outgoing Message Prompt** (Prompt para mensajes salientes) e **Incoming Response Prompt** (Prompt para respuestas entrantes) son las instrucciones que se envían a la IA cuando traduce tus mensajes y las respuestas de la IA. Ambos vienen rellenados con un valor predeterminado integrado, y puedes editar cada uno para este chat. `{{targetLanguage}}` en un prompt se convierte en **Model Language** o **My Language**. Una vez que cambias un prompt, aparece un botón **Restore** (Restaurar) que lo restablece al valor predeterminado integrado. El prompt (instrucciones enviadas a la IA) predeterminado es:

```
You are a translator. Translate the given text accurately into {{targetLanguage}}, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## Los interruptores de traducción automática

Debajo de los ajustes de proveedor hay cuatro interruptores. Los cuatro están desactivados de forma predeterminada.

**Auto-Translate Responses** (Traducir respuestas automáticamente) traduce cada respuesta de la IA de forma automática, justo después de generarse. En el modo Game, Marinara elimina de la narración las etiquetas exclusivas del game master antes de traducirla.

**Translate My Messages** (Traducir mis mensajes) traduce tu propio mensaje a **Model Language** justo antes de enviarlo a la IA. La traducción reemplaza el texto que escribiste. Si la traducción falla, Marinara envía tu texto original en su lugar y muestra un mensaje de error.

**Show Draft Translate Button** (Mostrar el botón de traducir borrador) añade un botón **Translate draft** (Traducir borrador) junto al botón **Send** (Enviar). Esto te deja traducir tu mensaje y revisar o editar el resultado antes de enviarlo. Es la alternativa manual a **Translate My Messages**, que traduce al enviar sin oportunidad de revisar.

**Show Only Translation** (Mostrar solo la traducción) muestra la traducción de un mensaje traducido en su lugar, en vez del original y la traducción juntos.

En **Conversation**, siempre puedes traducir un borrador sin enviar desde el botón de la cara sonriente del cuadro de mensaje → **Tools → Translate draft** (Herramientas → Traducir borrador), en computadora o móvil. No necesitas activar **Show Draft Translate Button** ni la traducción automática. La acción usa los ajustes de traducción de entrada del chat y reemplaza el borrador para que lo revises; no envía un mensaje. Si la traducción falla, el borrador queda intacto.

<a id="translator-defaults-for-new-chats"></a>

## Valores predeterminados del traductor para chats nuevos

Debajo de los interruptores, **Save translator defaults** (Guardar valores predeterminados del traductor) guarda los ajustes de traducción de este chat para los chats nuevos en todos los modos. Los ajustes del asistente de configuración y de un perfil de ajustes tienen prioridad. Los chats existentes conservan sus propios ajustes. **Forget saved defaults** (Olvidar los valores predeterminados guardados) los borra. [Noodle](../noodle/settings.md#translation) usa los mismos valores predeterminados.

La API key de DeepL y la URL de DeepLX se quedan en esta instalación de Marinara. Las exportaciones de chats, los perfiles de ajustes exportados y los archivos de **Export Profile** (Exportar perfil) las dejan fuera, e importar cualquiera de ellos nunca las configura. Vuelve a introducirlas después de llevar un chat a otra instalación.

## El botón Translate por mensaje

Cada mensaje del chat, ya sea tuyo o de la IA, tiene un botón **Translate** en su barra de acciones que aparece al pasar el cursor. El botón usa un icono de idiomas. Este botón funciona por sí solo y no necesita ninguno de los interruptores de arriba.

1. Mueve el puntero sobre un mensaje para mostrar su barra de acciones.
2. Haz clic en el botón **Translate**.
3. La traducción aparece debajo del mensaje, o en su lugar si **Show Only Translation** está activado.
4. Haz clic de nuevo en el mismo botón para ocultar la traducción. Su texto de ayuda ahora dice **Hide translation** (Ocultar traducción).

Una traducción hecha de esta manera se guarda con el mensaje. Sobrevive a un refresco de página y se mantiene cuando cambias de chat y vuelves.

El botón por mensaje usa el mismo proveedor y el mismo **My Language** que fijaste en la sección **Translation**.

## Límites de los proveedores

Ten en cuenta estos límites cuando elijas un proveedor.

- **Google Translate** rechaza el texto de más de 5000 caracteres. Verás el error "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts." Cambia a DeepL o IA para texto más largo.
- **DeepL API**, **DeepLX (self-hosted)** y **AI (via connection)** aceptan texto más largo, hasta un límite del servidor de 50000 caracteres por solicitud.
- **Google Translate**, **DeepL API** y **DeepLX (self-hosted)** se detienen y muestran un error si tardan más de 15 segundos.
- **AI (via connection)** usa el modelo y el comportamiento de tiempo de espera de tu propia conexión, no el límite de 15 segundos.
- **DeepLX (self-hosted)** hacia una dirección local se bloquea a menos que fijes `DEEPLX_LOCAL_URLS_ENABLED=true` como se describe arriba.

## Guías relacionadas

- [Acciones de mensaje: editar, eliminar, swipe, regenerar](../chats/messages.md)
- [Resumen de Chat Settings](../chats/chat-settings.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
