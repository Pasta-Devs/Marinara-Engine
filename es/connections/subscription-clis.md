# Conexiones de suscripción de Claude, ChatGPT y Grok

Tres servicios te permiten chatear con un plan que ya pagas en lugar de con una API key (clave de API): **Claude (Subscription)**, **OpenAI (ChatGPT)** y **Grok CLI (Subscription)**. Instalas una pequeña herramienta de línea de comandos (CLI) e inicias sesión una sola vez. Después, Marinara Engine reutiliza ese inicio de sesión. No pegas nada en Marinara.

El plan que necesitas:

- **Claude (Subscription)**: Anthropic Pro o Max, u otro plan que acepte Claude Code.
- **OpenAI (ChatGPT)**: una cuenta de ChatGPT. Los límites de uso dependen del plan.
- **Grok CLI (Subscription)**: SuperGrok o X Premium+.

## Añadir una cuenta de suscripción

Antes de empezar, ten en cuenta que la CLI debe estar instalada y con la sesión iniciada en la computadora que ejecuta el servidor de Marinara. No es el teléfono ni el navegador desde donde ves Marinara. Si Marinara se ejecuta en otra computadora o en Docker, haz allí los pasos 1 y 2. Los comandos `npm` necesitan Node.js, que ya tienes si instalaste Marinara desde el código fuente. Consulta [Instalación](../INSTALLATION.md).

1. Abre una terminal en la computadora que ejecuta Marinara. Una terminal es la ventana donde escribes comandos. En Windows, abre PowerShell. En macOS, abre Terminal.
2. Ejecuta el comando de instalación de tu servicio y luego su comando de inicio de sesión. La herramienta muestra sus propios pasos de inicio de sesión, normalmente una página web donde inicias sesión.

| Servicio | Instalar | Iniciar sesión |
| --- | --- | --- |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude login` |
| ChatGPT | `npm i -g @openai/codex` | `codex login` |
| Grok | consulta más abajo | `grok login` |

Para Grok, la app muestra este comando de instalación. Si no funciona en tu sistema, sigue las instrucciones propias de x.ai para la Grok CLI.

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

3. En Marinara, haz clic en **Connections** (Conexiones) en la barra superior y luego en **Add** (Añadir).
4. En **Chat**, haz clic en tu servicio. Estos servicios tienen la etiqueta **Sign in** (Iniciar sesión).
5. La ventana dice **Sign in first** (Inicia sesión primero) y nombra el comando. No hay campo de clave. Haz clic en **Connect** (Conectar). Marinara prueba el inicio de sesión. **Connected** significa que funciona.
6. Elige un modelo de la lista y luego haz clic en **Done** (Listo). Con Grok CLI también puedes dejar el modelo vacío, lo que usa el predeterminado de la propia CLI (consulta [Grok CLI (Subscription)](#grok-cli-subscription)).

Envía un mensaje en un chat para confirmarlo. Una respuesta significa que funciona.

Si no funcionó:

- **Marinara could not use the login on this computer.** (Marinara no pudo usar el inicio de sesión de esta computadora.) La CLI no está instalada o no tiene la sesión iniciada en la computadora de Marinara. Ejecuta allí el comando de inicio de sesión y luego haz clic en **Try again** (Intentar de nuevo).

## Claude (Subscription)

Las secciones a partir de aquí son ajustes opcionales. No los necesitas para chatear.

Este servicio usa tu plan de Claude a través de Claude Code. Tiene tres controles adicionales en el editor del modelo (**Edit model**, Editar modelo): la caché de prompts, **Fast mode** (Modo rápido) y **Diagnose model routing** (Diagnosticar el enrutamiento del modelo).

### Caché de tokens extendida

La caché de prompts permite que Claude reutilice el principio de tu prompt (las instrucciones enviadas a la IA), así que las solicitudes repetidas consumen menos de tu límite. **Prompt caching → Extended token caching (1 hour)** (Caché de prompts → Caché de tokens extendida: 1 hora) pide una caché de una hora, lo que ayuda cuando haces pausas entre mensajes. Necesita Claude Code 2.1.242 o posterior. Marinara envía el ajuste con la solicitud y no cambia tu configuración guardada de Claude.

Cuando está desactivado, Claude usa su propio valor predeterminado para tu cuenta. Consulta [la caché de prompts de Claude Code](https://code.claude.com/docs/en/prompt-caching).

### Fast mode

**Fast mode → Use Claude Code fast-mode routing** (Modo rápido → Usar el enrutamiento de modo rápido de Claude Code) está desactivado de forma predeterminada. Déjalo desactivado. Le pide a Claude Code un nivel de modelo más rápido, pero la app dice que los modelos actuales ya no ofrecen uno, así que activarlo no hace nada útil y puede añadir sobrecarga. Si intentas activarlo, aparece un cuadro de diálogo titulado **Turn on fast mode?** (¿Activar el modo rápido?). Haz clic en **Keep it off** (Mantenerlo desactivado).

### Diagnose model routing

Usa **Diagnose model routing** cuando pediste un modelo grande como Opus pero sospechas que recibiste uno más pequeño.

1. Elige un modelo. El botón sigue desactivado hasta que hay un modelo configurado.
2. Haz clic en **Diagnose model routing**. Marinara guarda primero los cambios sin guardar.
3. Lee el resultado. Marinara envía un prompt real a través de tu inicio de sesión de Claude Code e informa por qué modelo se facturó a tu cuenta.

## OpenAI (ChatGPT)

Este servicio usa tu cuenta de ChatGPT a través de la Codex CLI. Marinara lee el archivo local de inicio de sesión de Codex y actualiza la sesión cuando puede.

Para ajustar cuánto tiempo piensa Codex antes de responder, abre **Edit model**, activa **Use custom defaults for this model** (Usar valores predeterminados personalizados para este modelo) y elige un **Reasoning Effort** (Esfuerzo de razonamiento). Empieza en **Default** (Predeterminado), que conserva el nivel propio de Codex para el modelo. Un chat puede elegir su propio nivel en **Advanced Parameters** (Parámetros avanzados). El nivel de un preset (ajuste guardado) no lo cambia. Un modelo de Codex usado como respaldo solo sigue su propio nivel, y los agentes que usan el modelo usan el nivel del modelo. Los niveles que ves coinciden con los disponibles para el modelo que elegiste.

## Grok CLI (Subscription)

Este servicio ejecuta la Grok CLI en la computadora de Marinara. Dos cosas son distintas de otros servicios:

- No hace streaming. Una respuesta aparece toda de golpe en lugar de palabra por palabra.
- Su ventana de contexto está en 32.000 tokens de forma predeterminada. Los tokens son pequeños fragmentos de texto que cuentan los modelos. Los prompts grandes pueden alcanzar el propio límite de turno de la CLI, así que el valor predeterminado se mantiene bajo. Puedes establecer una **Max Context Window** (Ventana de contexto máxima) más grande en el modelo.

En el editor del modelo, **Use the Grok CLI default** (Usar el predeterminado de la Grok CLI) deja el modelo vacío para que la CLI elija el suyo. El editor señala `grok-composer-2.5-fast` como el modelo que suele ser más seguro para roleplay, porque Marinara ejecuta la CLI sin interfaz (headless), con las herramientas, la memoria, la búsqueda web, los planes y los subagentes propios de Grok desactivados.

## Uso del plan

Las cuentas Claude (Subscription) y OpenAI (ChatGPT) pueden mostrar cuánto has usado de los límites de tu plan.

1. Haz clic en **⋯** en la fila de la cuenta, elige **Edit account** (Editar cuenta) y abre **Usage and balance** (Uso y saldo).
2. Si las lecturas externas están desactivadas, haz clic en **Turn on** (Activar).
3. Activa **Show the usage meter on the card** (Mostrar el medidor de uso en la tarjeta) y luego guarda.

Cada ventana de límite tiene una barra con el porcentaje usado y cuándo se restablece, por ejemplo `58% · resets in 2h`. Las mismas barras aparecen en el selector de conexión de un chat y en los ajustes **Connection** (Conexión) del chat mientras esta cuenta está activa. No aparecen con **Shuffle** (Aleatorio).

- Las barras cuentan todo lo de tu plan, no solo Marinara. Para Claude, eso incluye Claude Code y claude.ai. Para ChatGPT, incluye todo el uso de Codex, como la Codex CLI. Los chats en chatgpt.com tienen sus propios límites y no se incluyen.
- Los servicios informan un porcentaje por cada ventana y ningún recuento de tokens.
- Una lectura le pide a la CLI de la computadora de Marinara los mismos datos que muestra su propio comando de uso. No envía ningún mensaje a un modelo y no consume nada de tu plan. El botón de actualizar vuelve a leerlos.
- Un plan con una sola ventana muestra una sola barra.
- Claude Code marca sus datos de uso como experimentales. Si una versión nueva los cambia, las barras muestran un error y un botón para reintentar en lugar de un número incorrecto.

## Límites de estos servicios

- Necesitan un plan de pago (o un plan de ChatGPT elegible) y la CLI con la sesión iniciada en la computadora de Marinara.
- Ninguno ofrece embeddings (representaciones numéricas del texto). La búsqueda semántica de los lorebooks (libros de trasfondo) y la memory recall necesitan una cuenta aparte para los embeddings.
- **Send test message** (Enviar mensaje de prueba) necesita un modelo elegido primero, excepto con Grok CLI.

## Guías relacionadas

- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
- [Proveedores de IA compatibles](providers-reference.md)
