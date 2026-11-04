# Traducción de mensajes

Marinara Engine puede traducir los mensajes del chat entre idiomas. Esta guía muestra cómo elegir un servicio de traducción, fijar los idiomas, activar la traducción automática y traducir un solo mensaje.

La traducción se configura por chat. Cada chat guarda su propio servicio, idiomas y claves. Para empezar chats nuevos con los mismos ajustes, guárdalos como [valores predeterminados del traductor](#translator-defaults-for-new-chats).

## Dónde encontrar los ajustes de traducción

1. Abre un chat en cualquier modo (Conversation, Roleplay o Game).
2. Abre **Chat Settings** (Ajustes del chat).
3. Busca la sección **Translation** (Traducción).

Todos los ajustes que siguen están en esa sección.

## Elegir un proveedor

La lista **Provider** (Proveedor) tiene cuatro opciones.

| Proveedor | Qué necesita | Notas |
| --- | --- | --- |
| **Google Translate** | Nada | El predeterminado. Gratis, sin clave. Hasta 5.000 caracteres por solicitud. |
| **DeepL API** | Una API key (clave de API) de DeepL | Mayor calidad. Funcionan tanto las claves gratuitas como las de pago. |
| **DeepLX (self-hosted)** | La URL de un servidor DeepLX | Para un servidor DeepLX que ejecutas por tu cuenta. |
| **AI (via connection)** | Una cuenta de IA | Usa uno de tus modelos de IA para traducir. |

Google Translate funciona sin configuración. Elige otro solo si necesitas lo que ofrece.

### Fijar los idiomas

Dos campos fijan los idiomas. Ambos son `en` (inglés) de forma predeterminada.

- **Model Language** (Idioma del modelo) es el idioma que el modelo de IA entiende y en el que responde. Cuando escribes en tu propio idioma, tu mensaje se traduce a este antes de que la IA lo lea. **Translate My Messages** (Traducir mis mensajes) y **Translate draft** (Traducir borrador) lo usan.
- **My Language** (Mi idioma) es el idioma que lees. Las respuestas de la IA se traducen a este. **Auto-Translate Responses** (Traducir respuestas automáticamente) y el botón **Translate** (Traducir) por mensaje lo usan.

Por ejemplo, si escribes en español y la IA funciona mejor en inglés, pon **Model Language** en `en` y **My Language** en `es`.

Para Google Translate, DeepL API y DeepLX, escribe un código corto como `en`, `ja`, `es`, `de`, `fr`, `zh` o `ko`. Para AI (via connection), escribe un nombre de idioma como `English`, `Japanese` o `Spanish`.

Si no funcionó: un código o un nombre incorrecto produce un error o un texto sin cambios. Comprueba el formato de tu proveedor.

### DeepL API

Elige **DeepL API** y pega la clave de tu cuenta de DeepL en **DeepL API Key** (Clave de API de DeepL). Una clave que termina en `:fx` es una clave de nivel gratuito, y Marinara la envía al servicio gratuito de DeepL. Cualquier otra clave se trata como de pago.

```text
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

### DeepLX

DeepLX es un servidor de traducción gratuito que ejecutas por tu cuenta. Elige **DeepLX (self-hosted)** y escribe la dirección de tu servidor en **DeepLX URL** (URL de DeepLX), por ejemplo `http://localhost:1188`.

Un servidor DeepLX en tu propia computadora o en tu red local tiene una dirección local. Marinara bloquea las direcciones locales de forma predeterminada por seguridad. Para permitirlas, añade esta línea a tu archivo `.env` y guarda. No hace falta reiniciar. Normalmente surte efecto en unos segundos, hasta unos 30 segundos. La [Referencia de configuración del servidor](../CONFIGURATION.md) muestra dónde está el archivo.

```text
DEEPLX_LOCAL_URLS_ENABLED=true
```

Un servidor DeepLX en una dirección pública de internet no necesita este ajuste.

### AI (via connection)

Elige **AI (via connection)** para usar uno de tus modelos de IA. Aparecen tres campos.

- **Connection** (Conexión): qué cuenta de IA traduce. Es obligatorio. Si lo dejas sin definir, la traducción falla con "Connection ID is required for AI translation". Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).
- **Outgoing Message Prompt** (Prompt para mensajes salientes) e **Incoming Response Prompt** (Prompt para respuestas entrantes): las instrucciones que recibe la IA cuando traduce tus mensajes y sus propias respuestas. Ambos empiezan con un valor predeterminado integrado que puedes editar para este chat. `{{targetLanguage}}` se convierte en **Model Language** o **My Language**. Después de cambiar un prompt (las instrucciones enviadas a la IA), **Restore** (Restaurar) lo restablece. El prompt predeterminado es:

```text
You are a translator. Translate the given text accurately into {{targetLanguage}},
preserving formatting, markdown, and any special characters like *asterisks* for actions.
Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## Activar la traducción automática

Debajo de los ajustes del proveedor hay cuatro interruptores. Todos empiezan desactivados.

- **Auto-Translate Responses**: traduce cada respuesta de la IA justo después de generarse. En el modo Game, Marinara primero elimina de la narración las etiquetas exclusivas del game master.
- **Translate My Messages**: traduce tu mensaje a **Model Language** justo antes de que llegue a la IA, y reemplaza el texto que escribiste. Si la traducción falla, Marinara envía tu texto original y muestra un error.
- **Show Draft Translate Button** (Mostrar el botón de traducir borrador): añade un botón **Translate draft** junto a **Send** (Enviar), para que puedas revisar y editar la traducción antes de enviar. Es la alternativa manual a **Translate My Messages**.
- **Show Only Translation** (Mostrar solo la traducción): muestra la traducción de un mensaje traducido en lugar del original, en vez de ambos juntos.

En Conversation siempre puedes traducir un borrador sin enviar desde el botón de la cara sonriente del cuadro de mensaje y luego **Tools → Translate draft** (Herramientas → Traducir borrador), en computadora o en el teléfono. No necesitas ninguno de los dos interruptores. Usa los ajustes de traducción de entrada de este chat y reemplaza el borrador para que lo revises. No envía nada. Si la traducción falla, el borrador queda como estaba.

<a id="translator-defaults-for-new-chats"></a>

## Valores predeterminados del traductor para chats nuevos

**Save translator defaults** (Guardar valores predeterminados del traductor), debajo de los interruptores, guarda los ajustes de traducción de este chat para los chats nuevos en todos los modos. Los ajustes del asistente de configuración y de un perfil de ajustes tienen prioridad. Los chats existentes conservan sus propios ajustes. **Forget saved defaults** (Olvidar los valores predeterminados guardados) los borra. [Noodle](../agents/noodle-settings.md#translation) usa los mismos valores predeterminados.

La API key de DeepL y la URL de DeepLX se quedan en esta instalación de Marinara. Las exportaciones de chats, los perfiles de ajustes exportados y los archivos de **Export Profile** (Exportar perfil) las dejan fuera, e importar cualquiera de ellos nunca las configura. Vuelve a introducirlas después de llevar un chat a otra instalación.

## Traducir un mensaje

Cada mensaje, tuyo o de la IA, tiene un botón **Translate** (un icono de idiomas) en su barra de acciones. Funciona sin ninguno de los interruptores de arriba.

1. Mueve el puntero sobre el mensaje, o tócalo en un teléfono, para mostrar su barra de acciones.
2. Haz clic en **Translate**.
3. La traducción aparece debajo del mensaje, o en su lugar si **Show Only Translation** está activado.
4. Haz clic de nuevo en el botón para ocultarla. Su etiqueta pasa a decir **Hide translation** (Ocultar traducción).

La traducción se guarda con el mensaje y sobrevive a un refresco de página y a los cambios de chat. Usa el mismo proveedor y el mismo **My Language** que la sección de arriba.

## Límites de los proveedores

- **Google Translate** rechaza el texto de más de 5.000 caracteres con "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts."
- **DeepL API**, **DeepLX (self-hosted)** y **AI (via connection)** aceptan texto más largo, hasta un límite del servidor de 50.000 caracteres por solicitud.
- **Google Translate**, **DeepL API** y **DeepLX (self-hosted)** se detienen con un error después de 15 segundos.
- **AI (via connection)** sigue el tiempo de espera propio de tu modelo de IA, no el límite de 15 segundos.
- **DeepLX (self-hosted)** en una dirección local se bloquea a menos que `DEEPLX_LOCAL_URLS_ENABLED=true` esté configurado.

## Guías relacionadas

- [Acciones de mensaje: editar, eliminar, swipe, regenerar](../chats/messages.md)
- [Resumen de Chat Settings](../chats/chat-settings.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
