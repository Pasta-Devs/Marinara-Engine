# Conectar un modelo local o autoalojado

Esta guía te muestra cómo conectar Marinara Engine a un modelo de IA que se ejecuta en tu propia computadora o en tu propio servidor. Cubre servidores de modelos locales populares como Ollama, LM Studio y KoboldCpp, además de los ajustes que hacen que funcionen.

## Qué significa autoalojado

Un modelo autoalojado es un modelo de IA que se ejecuta en hardware que tú controlas. Instalas un servidor de modelos local, ese servidor carga un modelo y el servidor responde solicitudes en una dirección web de tu máquina. Marinara Engine entonces habla con esa dirección en lugar de con un servicio de nube de pago.

Entre los servidores de modelos locales comunes están Ollama, LM Studio y KoboldCpp. Cada uno se ejecuta en tu computadora y te da un endpoint privado. Un endpoint es la dirección web donde el servidor escucha las solicitudes.

Esta guía trata sobre servidores locales externos que tú mismo instalas y ejecutas. Marinara también incluye su propio modelo integrado pequeño que no necesita un servidor aparte. Si prefieres eso, consulta la guía [Configuración del modelo local](local-model.md).

Antes de empezar, asegúrate de que tu servidor de modelos local ya esté instalado, en ejecución y con un modelo cargado. Marinara no inicia ese servidor por ti. Solo se conecta a él.

## Configurar una conexión Custom

Marinara se conecta a servidores locales a través del proveedor **Custom (OAI-Compatible)** (Personalizado, compatible con OAI). OAI-compatible significa que el servidor habla el mismo formato de solicitud que la OpenAI Chat Completions API. Ollama, LM Studio y KoboldCpp ofrecen todos este formato.

Sigue estos pasos para crear la conexión.

1. Abre el panel **Connections** (Conexiones) desde el lado derecho de la app.
2. Haz clic en **Add** (Añadir). Se abre la ventana **Add account** (Añadir cuenta).
3. En el paso 1, elige **Custom (OAI-Compatible)**. Aparece en **On your computer** (En tu computadora).
4. En el paso 2, en el campo **Address** (Dirección), ingresa la dirección de tu servidor local (consulta la tabla de abajo).
5. Deja vacío el campo **API key** (clave de API). La mayoría de los servidores locales no necesitan una clave. Para darle a la conexión un nombre como `Ollama Local`, abre **More options** (Más opciones) y escríbelo en **Name (optional)** (Nombre: opcional).
6. Haz clic en **Connect** (Conectar).
7. En el paso 3, elige un modelo de la lista que reporta tu servidor. También puedes escribir un ID de modelo a mano. Haz clic en **Done** (Listo).

Ahora deberías ver la conexión en el panel **Connections**, con su modelo agrupado debajo. Pruébala antes de usarla en un chat. Consulta la sección "Prueba tu conexión" más abajo.

El campo **API Key** es opcional para servidores locales. Para el proveedor **Custom (OAI-Compatible)**, el editor muestra un recordatorio debajo de este campo. Dice que puedes dejar la clave vacía para modelos locales como Ollama, LM Studio y KoboldCpp. Solo configura el campo **Address** en su lugar.

## Base URLs para servidores locales comunes

El campo **Address** (también llamado Base URL) le dice a Marinara dónde escucha tu servidor local. Cada servidor tiene una dirección y un puerto predeterminados. Un puerto es el canal numerado que un servidor usa en tu máquina. Usa la dirección del servidor que ejecutas.

| Servidor local | Endpoint |
|---|---|
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |

Aquí `localhost` significa "esta misma computadora". Si Marinara se ejecuta en la misma computadora que tu servidor de modelos, estas direcciones funcionan tal como están escritas.

El campo **Address** muestra una advertencia de seguridad: "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." (Usa solo URLs de proveedores en los que confíes. Un endpoint malicioso podría interceptar tus mensajes y API keys). Ingresa solo una dirección que hayas configurado tú mismo o en la que confíes plenamente.

### Nota sobre el firewall de Windows

En Windows, un servidor local puede quedar bloqueado incluso cuando está en ejecución. El editor muestra esta nota para el proveedor **Custom (OAI-Compatible)**: si no se detecta tu proxy o servidor local, Windows Defender Firewall puede estar bloqueando la conexión. Para solucionarlo, abre Windows Security, luego Firewall and network protection, luego Allow an app through firewall, y agrega Node.js o tu aplicación de servidor.

## El interruptor Treat as local/custom endpoint

El editor de conexión tiene una sección **Local / Custom Endpoint** (Endpoint local / personalizado) con un interruptor etiquetado **Treat as local/custom endpoint** (Tratar como endpoint local/personalizado). Está desactivado de forma predeterminada. Actívalo para endpoints autoalojados o con proxy, especialmente una dirección web personalizada que apunte a un servidor de modelos en tu red local.

Cuando este interruptor está desactivado, Marinara actúa con cautela con las llamadas a herramientas para los modelos que no reconoce. Activar el interruptor le dice a Marinara que siempre intente las llamadas a herramientas. También le dice a Professor Mari que use un método de herramientas de respaldo (un protocolo de herramientas JSON) en lugar de solo las llamadas nativas a herramientas. Professor Mari es el asistente dentro de la app.

Activa este interruptor si Professor Mari se detiene después de usar una herramienta. Actívalo también si tu endpoint afirma ser compatible con OpenAI pero no admite de forma fiable las llamadas a herramientas. Si tu modelo local funciona bien sin él, puedes dejarlo desactivado.

## Alcanzar un servidor en otra computadora

Marinara siempre permite conexiones a tu propia computadora. Direcciones como `localhost` y `127.0.0.1` se llaman direcciones de loopback, que significan "esta misma máquina". Estas siempre funcionan para una conexión, sin configuración adicional.

Si tu servidor de modelos se ejecuta en una computadora diferente en tu red doméstica o de oficina, esa es una dirección de red privada. Marinara bloquea las direcciones de red privada de forma predeterminada por seguridad. Para permitirlas, la persona que ejecuta el servidor de Marinara debe configurar una variable de entorno. Una variable de entorno es un ajuste que el servidor lee cuando arranca.

Agrega esta línea al archivo `.env` del servidor:

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

Guarda el archivo y reinicia el servidor de Marinara para que el cambio surta efecto. Después de eso, puedes usar una Base URL que apunte a otra máquina de tu red, como `http://192.168.1.50:11434/v1`.

En Android, este ajuste está activado de forma predeterminada cuando no lo configuras. Para más información sobre el archivo `.env` y los ajustes del servidor, consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).

## Prueba tu conexión

**Connect**, en el flujo de Add, ya comprobó la conexión. El editor del modelo tiene una tarjeta **Connection Tests** (Pruebas de conexión) en la parte inferior para una segunda comprobación. Úsala antes de depender de la conexión en un chat.

1. Haz clic en tu modelo en el panel **Connections**. Se abre el editor del modelo.
2. Haz clic en **Test Connection** (Probar conexión). Esto comprueba que tu Base URL y tu configuración sean alcanzables e informa cuánto tardó.
3. Elige un modelo si aún no lo has hecho.
4. Haz clic en **Send Test Message** (Enviar mensaje de prueba). Esto envía la palabra "hi" a tu modelo elegido y muestra la respuesta.

Si ambas pruebas tienen éxito, tu modelo local está listo para usarse en un chat. Abre un chat, abre sus ajustes y elige esta conexión, o usa el menú **Connections** del área de entrada del chat.

El mismo modelo también puede responder decisiones, como las preguntas de activación de agentes, sin que Marinara cargue una segunda copia. Haz clic en **Use this model for decisions** (usar este modelo para decisiones) en los ajustes de la conexión; consulta [Modelos de decisión](decision-models.md#on-a-server-you-already-run).

Si una prueba falla, primero comprueba que tu servidor local siga en ejecución y que el modelo esté cargado. Luego comprueba que el campo **Address** coincida exactamente con la dirección y el puerto del servidor. Para un servidor en otra computadora, confirma que `PROVIDER_LOCAL_URLS_ENABLED` esté configurado y que hayas reiniciado el servidor de Marinara.

## Guías relacionadas

- [Conectar a un proveedor de IA](connecting-to-a-provider.md)
- [Configuración del modelo local](local-model.md)
- [Modelos de decisión](decision-models.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
