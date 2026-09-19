# Conexiones de suscripción de Claude, ChatGPT y Grok

Esta guía cubre las tres conexiones que inician sesión con una cuenta en lugar de con una API key (clave de API): **Claude (Subscription)**, **OpenAI (ChatGPT)** y **Grok CLI (Subscription)**. Instalas una pequeña herramienta de línea de comandos, inicias sesión una sola vez y Marinara Engine usa esa cuenta para chatear. Una herramienta de línea de comandos (CLI) es un programa que ejecutas escribiendo un comando en una ventana de terminal.

## Qué son las conexiones de suscripción

La mayoría de las conexiones en Marinara Engine usan una API key. Una API key es una cadena secreta, como una contraseña, que pegas en la conexión para que el servicio de IA pueda facturar a tu cuenta.

Estas tres conexiones funcionan de otra manera. Usan un inicio de sesión local en lugar de una API key. Inicias sesión en una CLI dentro de tu propia máquina, y Marinara reutiliza ese inicio de sesión. No pegas nada en Marinara.

Usa una conexión de suscripción cuando tu cuenta incluya acceso a través de una de estas CLI:

- **Claude (Subscription)** usa tu suscripción **Pro** o **Max** de Anthropic.
- **OpenAI (ChatGPT)** usa tu cuenta de ChatGPT.
- **Grok CLI (Subscription)** usa tu cuenta **SuperGrok** o **X Premium+**.

## Qué necesitas primero

El requisito de cuenta depende del proveedor.

- **Claude (Subscription)** necesita un plan de Claude compatible con el inicio de sesión de suscripción de Claude Code.
- **OpenAI (ChatGPT)** admite planes de ChatGPT gratuitos y de pago que sean elegibles. Los límites de uso varían según el plan.
- **Grok CLI (Subscription)** necesita SuperGrok o X Premium+.

Para los tres proveedores, la CLI debe estar instalada y con la sesión iniciada en la misma máquina que ejecuta el servidor de Marinara. Esta no es el navegador ni el teléfono desde donde ves Marinara. Marinara ejecuta la CLI de forma local, así que el inicio de sesión tiene que estar junto al servidor.

Si ejecutas Marinara en tu propia computadora, esa computadora es el servidor. Si lo ejecutas en otra máquina o en Docker, instala e inicia sesión en la CLI allí.

## Claude (Subscription)

Necesitas una suscripción Pro o Max de Anthropic. Es el mismo inicio de sesión que usan Visual Studio Code y otras herramientas de Anthropic.

1. En la máquina que ejecuta Marinara, instala la CLI de Claude Code:

```
npm i -g @anthropic-ai/claude-code
```

2. Inicia sesión una sola vez:

```
claude auth login
```

3. En Marinara, abre el panel **Connections** (Conexiones) y haz clic en **New** (Nuevo).
4. En la ventana **Create Connection** (Crear conexión), escribe un nombre y elige el proveedor **Claude (Subscription)**, luego haz clic en **Create** (Crear).
5. En el editor, fíjate en que no hay campo **API Key** ni **Base URL**. Un panel informativo confirma que no son necesarios.
6. Elige un modelo de Claude, como un modelo Opus o Sonnet, en el menú desplegable **Model** (Modelo).
7. Haz clic en **Save** (Guardar), luego haz clic en **Send Test Message** (Enviar mensaje de prueba). Una respuesta corta significa que el inicio de sesión funciona.

Las conexiones de suscripción de Claude admiten solo chat de texto. Esta conexión tiene dos controles adicionales, **Fast Mode** y **Diagnose Model Routing**, que se describen más abajo.

## OpenAI (ChatGPT)

Necesitas una cuenta de ChatGPT. Marinara enruta el chat a través del inicio de sesión de la Codex CLI.

1. En la máquina que ejecuta Marinara, instala la Codex CLI:

```
npm i -g @openai/codex
```

2. Inicia sesión una sola vez:

```
codex login
```

3. En Marinara, abre el panel **Connections** y haz clic en **New**.
4. En la ventana **Create Connection**, escribe un nombre y elige el proveedor **OpenAI (ChatGPT)**, luego haz clic en **Create**.
5. Elige un modelo en el menú desplegable **Model**. La lista proviene de tu sesión de ChatGPT cuando está disponible; de lo contrario, de una lista integrada.
6. Haz clic en **Save**, luego haz clic en **Send Test Message** para confirmar una respuesta.

Marinara lee tu archivo local de inicio de sesión de Codex y actualiza la sesión cuando puede.

## Grok CLI (Subscription)

Necesitas una cuenta SuperGrok o X Premium+.

1. En la máquina que ejecuta Marinara, instala la Grok CLI:

```
curl -fsSL https://x.ai/cli/install.sh | bash
```

2. Inicia sesión una sola vez:

```
grok login
```

3. En Marinara, abre el panel **Connections** y haz clic en **New**.
4. En la ventana **Create Connection**, escribe un nombre y elige el proveedor **Grok CLI (Subscription)**, luego haz clic en **Create**.
5. Elige un modelo, o deja el campo **Model** en blanco para usar el predeterminado de la CLI. El modelo más seguro para roleplay suele ser `grok-composer-2.5-fast`.
6. Haz clic en **Save**, luego haz clic en **Send Test Message**. Esta conexión puede ejecutar una prueba incluso sin ningún modelo seleccionado.

Dos cosas tienen de especial la Grok CLI. No hace streaming, así que la respuesta aparece toda de golpe en lugar de palabra por palabra. Su ventana de contexto está en 32000 tokens de forma predeterminada, más baja que la de otros proveedores, porque los prompts (instrucciones enviadas a la IA) muy grandes pueden alcanzar el propio límite de turno de la CLI.

Para cargar los modelos de Grok, usa el botón **Fetch Models from Grok CLI** en la sección **Model**.

## Duración de la caché de prompts de Claude

En el editor de conexiones de Claude, **Prompt Caching → Extended token caching (1 hour)** solicita una caché de una hora para permitir pausas más largas entre mensajes. Requiere Claude Code **2.1.242 o posterior**. Marinara pasa el ajuste para esa solicitud sin cambiar tu configuración guardada de Claude.

Si lo desactivas, las conversaciones principales y las solicitudes del Agent SDK conservan el valor predeterminado de Claude: actualmente una hora para el uso por suscripción dentro de los límites del plan y cinco minutos para uso adicional, créditos o facturación por API. Los subagentes propios de Claude Code usan cinco minutos salvo que se configuren por separado; algunas solicitudes auxiliares controladas por el servidor pueden usar una hora. Las variables de entorno de la CLI que sobrescriben este valor siguen teniendo prioridad. Consulta [la caché de prompts de Claude Code](https://code.claude.com/docs/en/prompt-caching).

Los registros de depuración distinguen las escrituras de caché de cinco minutos y de una hora según el uso que informa el SDK. Los costos equivalentes usan los multiplicadores habituales de tokens de la API, no tu factura de suscripción. Si el SDK no desglosa las escrituras por duración, la estimación queda como desconocida.

## Por qué no hay campo de API key

Para los tres proveedores de suscripción, los campos **API Key** y **Base URL** están ocultos. Es a propósito. Tu inicio de sesión vive dentro de la CLI en la máquina del servidor, así que no hay nada que tengas que escribir en Marinara.

Si seleccionaste el proveedor equivocado por error y no ves ningún campo de clave, vuelve a elegir el proveedor que querías en la cuadrícula de proveedores. El campo de clave reaparece con los proveedores basados en API.

## Fast Mode (solo Claude)

El editor de **Claude (Subscription)** tiene una sección **Fast Mode** con un solo interruptor, **Use Claude Code fast-mode routing**. Está desactivado de forma predeterminada.

Déjalo desactivado. La propia app describe esta función como algo que hoy no hace nada. Le pide a Claude Code un nivel de modelo más rápido, pero los modelos actuales de Claude ya no ofrecen uno. Activarlo no hace nada útil y puede añadir sobrecarga. El interruptor se queda en la interfaz solo por si Anthropic reactiva la función.

Si intentas activarlo, aparece un cuadro de diálogo de confirmación titulado **YOU DON'T WANT THIS SETTING ON!**. Elige **Keep it off**.

## Diagnose Model Routing (solo Claude)

El editor de **Claude (Subscription)** tiene un botón **Diagnose Model Routing** en el área de pruebas. Úsalo cuando pidas un modelo de Claude pero sospeches que recibiste uno más pequeño.

1. Elige un modelo y haz clic en **Save**. El botón está desactivado hasta que se selecciona un modelo.
2. Haz clic en **Diagnose Model Routing**.
3. Lee el resultado. Marinara envía un prompt real a través de tu inicio de sesión de Claude Code. Luego informa por qué modelo se facturó realmente a tu cuenta.

Esto detecta una degradación silenciosa, cuando solicitas un modelo más grande como Opus y recibes en silencio Sonnet o Haiku.

## Limitaciones que conviene conocer

- Estas conexiones necesitan una suscripción de pago y la CLI con la sesión iniciada en la máquina del servidor.
- Los embeddings (representaciones numéricas del texto) no están disponibles en ninguna de las tres. La búsqueda semántica del lorebook y la memory recall necesitan una conexión aparte para los embeddings.
- **Claude (Subscription)** admite solo chat de texto.
- **Grok CLI (Subscription)** no hace streaming y empieza con una ventana de contexto más pequeña.
- **Send Test Message** necesita un modelo elegido primero, excepto para Grok CLI, que puede probar sin uno.

## Guías relacionadas

- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
- [Proveedores de IA compatibles](providers-reference.md)
