# Conectar un modelo local o autoalojado

Esta guía conecta Marinara Engine a un modelo de IA que se ejecuta en tu propia computadora o en tu propio servidor, a través de un programa como Ollama, LM Studio, KoboldCpp o llama.cpp. Para el modelo pequeño que Marinara ejecuta por su cuenta, sin un servidor aparte, consulta [Configuración del modelo integrado](local-model.md).

## Configurar una conexión Custom

En la app, este tipo de cuenta se llama **OpenAI-compatible** (compatible con OpenAI). Significa que el servidor acepta el mismo formato de solicitud que la API de chat de OpenAI. Ollama, LM Studio, KoboldCpp y llama.cpp lo aceptan.

Antes de empezar, instala un servidor de modelos, inícialo y carga un modelo en él. Por ejemplo, descarga Ollama desde `ollama.com` y sigue sus pasos para descargar un modelo. Marinara se conecta al servidor y no lo inicia por ti. El servidor responde las solicitudes en una dirección web de tu computadora, llamada endpoint.

1. Haz clic en **Connections** (Conexiones) en la barra superior y luego en **Add** (Añadir). Se abre la ventana **Add account** (Añadir cuenta).
2. En **Chat**, haz clic en tu servidor: **Ollama**, **LM Studio**, **KoboldCpp** o **llama.cpp**. Estas fichas tienen la etiqueta **Self-hosted** (Autoalojado). Para cualquier otro servidor, haz clic en **OpenAI-compatible address** (Dirección compatible con OpenAI).
3. Revisa **Server address** (Dirección del servidor). Para los cuatro servidores nombrados ya está rellenada. Para otro servidor, escribe su dirección. Consulta la tabla de abajo.
4. Deja vacío **API key (optional)** (Clave de API: opcional). La mayoría de los servidores locales no necesitan una clave. Para ponerle nombre a la cuenta, escribe un **Name (optional)** (Nombre: opcional).
5. Haz clic en **Connect** (Conectar). Marinara prueba la dirección. **Connected** significa que llegó al servidor.
6. Lo que pasa después depende de si ya tienes un modelo Main (Principal). Si no lo tienes, o abriste Add desde un chat nuevo, la ventana muestra los modelos que reporta tu servidor. Elige uno, o escribe un ID de modelo en **Search or enter model ID…** (Buscar o escribir un ID de modelo…), y luego haz clic en **Done** (Listo). Si ya tienes un modelo Main, la ventana se cierra y un mensaje dice que se añadió la cuenta. Luego haz clic en **⋯** en la cuenta y elige **Add model** (Añadir modelo).

Ahora el panel muestra la cuenta. Pruébala antes de depender de ella (consulta [Probar la conexión](#test-the-connection)).

Si no funcionó:

- **Marinara could not reach** la dirección (Marinara no pudo llegar a la dirección). Comprueba que el servidor esté en ejecución y que la dirección y el puerto coincidan. **Continue anyway** (Continuar de todos modos) guarda la cuenta sin que la prueba haya pasado.
- La dirección está en otra computadora. Consulta [Alcanzar un servidor en otra computadora](#reach-a-server-on-another-computer).

## Direcciones de los servidores locales comunes

Un puerto es el canal numerado que usa un servidor en tu computadora. `localhost` significa esta misma computadora, así que estas direcciones funcionan tal como están escritas cuando Marinara y el servidor se ejecutan en la misma computadora.

| Servidor | Dirección |
| --- | --- |
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |
| llama.cpp | `http://localhost:8080/v1` |

En **Edit model** (Editar modelo), el campo de dirección advierte: "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." (Usa solo URLs de proveedores en los que confíes. Un endpoint malicioso podría interceptar tus mensajes y API keys). Introduce solo una dirección que hayas configurado tú o en la que confíes plenamente.

En Windows, un servidor en ejecución puede quedar bloqueado de todos modos. Si Marinara no lo detecta, puede que Windows Defender Firewall lo esté bloqueando. Abre **Windows Security → Firewall & network protection → Allow an app through firewall** (Seguridad de Windows → Firewall y protección de red → Permitir una aplicación a través del firewall) y añade Node.js o tu programa de servidor.

<a id="test-the-connection"></a>

## Probar la conexión

**Connect** ya comprobó la dirección. El editor del modelo tiene una tarjeta **Provider tests** (Pruebas del proveedor) para una segunda comprobación.

1. Haz clic en tu modelo en el panel **Connections**. Se abre el editor del modelo.
2. Haz clic en **Test provider** (Probar proveedor). Comprueba que la dirección sea alcanzable y muestra cuánto tardó.
3. Elige un modelo si aún no lo has hecho y luego haz clic en **Send test message** (Enviar mensaje de prueba). Envía un mensaje breve y muestra la respuesta.

Si ambas pasan, abre un chat y elige la cuenta en **Model for this chat** (Modelo para este chat). Consulta [Elegir un modelo para un chat](connecting-to-a-provider.md#choosing-a-model-for-one-chat).

Si una prueba falla, comprueba que el servidor esté en ejecución con un modelo cargado y que la dirección y el puerto coincidan exactamente. Para un servidor en otra computadora, revisa los pasos de abajo.

<a id="reach-a-server-on-another-computer"></a>

## Alcanzar un servidor en otra computadora

Las direcciones como `localhost` y `127.0.0.1` siempre funcionan. Si tu servidor de modelos está en otra computadora de tu red, Marinara bloquea esa dirección privada de forma predeterminada. Quien ejecuta el servidor de Marinara puede permitirla con una variable de entorno, un ajuste que el servidor lee cuando arranca.

1. Abre el archivo `.env` del servidor. En una instalación normal está en la carpeta del proyecto de Marinara. Para Docker y Podman, consulta [Referencia de configuración del servidor](../CONFIGURATION.md#edit-the-env-file).
2. Añade esta línea:

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

3. Guarda el archivo y reinicia el servidor de Marinara.
4. Usa la dirección de la otra computadora, como `http://192.168.1.50:11434/v1`.

En Android, este ajuste está activado de forma predeterminada cuando no lo configuras.

## Usar el modelo para decisiones

El mismo modelo puede responder preguntas de decisión, como las comprobaciones de activación de agentes, sin cargar una segunda copia. Haz clic en **⋯** en el modelo, en el panel, y elige **Use this model for decisions** (Usar este modelo para decisiones). Aparece en un modelo compatible con OpenAI que tiene un nombre de modelo. Consulta [Modelos de decisión](decision-models.md#on-a-server-you-already-run).

## El interruptor Treat as local/custom endpoint

En **Edit model**, un interruptor llamado **Treat as local/custom endpoint** (Tratar como endpoint local/personalizado) está en **Local / custom endpoint** (Endpoint local / personalizado). Está desactivado de forma predeterminada. Solo aparece en modelos antiguos que no están vinculados a una cuenta. Los modelos que añades ahora nunca lo muestran.

Actívalo para un proxy o un servidor autoalojado que no sea un servicio conocido. Hace que Marinara siempre intente las llamadas a herramientas, y permite que Professor Mari use un método de herramientas de respaldo (un protocolo de herramientas JSON) en lugar de solo las llamadas nativas a herramientas. Actívalo si Professor Mari se detiene después de usar una herramienta, o si tu servidor afirma ser compatible con OpenAI pero no maneja bien las llamadas a herramientas. Si tu modelo funciona sin él, déjalo desactivado.

## Guías relacionadas

- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
- [Configuración del modelo integrado](local-model.md)
- [Modelos de decisión](decision-models.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
