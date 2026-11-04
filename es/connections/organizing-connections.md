# Organizar las conexiones

Esta guía explica cómo mantener ordenadas tus cuentas y tus modelos en el panel **Connections** (Conexiones): plegar, marcar con estrella, mover, quitar, las carpetas, Shuffle y la exportación. Para añadir una cuenta, consulta [Conectarse a un proveedor de IA](connecting-to-a-provider.md).

## La lista de cuentas

Debajo del cuadro **Jobs** (Tareas), el panel enumera tus cuentas. Cada cuenta muestra su imagen, su nombre, su número de modelos y su dirección. Una fila de modelo muestra la imagen del modelo, su nombre e insignias como la tarea que hace —**Main** (Principal), **Agents** (Agentes), **Images** (Imágenes)—, **Custom settings** (Ajustes personalizados), su precio o **Plan** para los modelos incluidos en una suscripción. La tarjeta **Built-in model** (Modelo integrado) está debajo del cuadro **Jobs**. Consulta [Configuración del modelo integrado](local-model.md).

Haz clic en la fila de una cuenta para plegar sus modelos, y haz clic de nuevo para mostrarlos. Marinara recuerda qué cuentas plegaste. **More actions** (Más acciones; tres puntos), en la parte superior del panel, tiene estos elementos:

| Elemento | Qué hace |
| --- | --- |
| **Fold all accounts** (Plegar todas las cuentas), **Open all accounts** (Abrir todas las cuentas) | Pliega o abre todas las cuentas. |
| **Show only Off or Needs key** (Mostrar solo las cuentas desactivadas o sin clave) | Muestra solo las cuentas que necesitan atención. |
| **Show cost badges** (Mostrar insignias de costo) | Muestra el precio de cada modelo. |
| **Group by folder** (Agrupar por carpeta), **Group by account** (Agrupar por cuenta) | Cambia cómo se agrupan los modelos. Consulta [Carpetas](#folders). |
| **Import account** (Importar cuenta), **Export all accounts** (Exportar todas las cuentas) | Consulta [Exportar e importar](#export-and-import). |

En un panel ancho, el menú desplegable de orden está junto a **Search models and accounts** (Buscar modelos y cuentas). En un panel estrecho, el orden está en **More actions**. Las opciones de orden son **Custom** (Personalizado), **A–Z**, **Z–A**, **Newest** (Más recientes) y **Oldest** (Más antiguos). **Search models and accounts** filtra la lista a medida que escribes.

Algunas cuentas llegan a modelos de varios creadores, como NanoGPT o un proxy. Sus modelos se agrupan bajo encabezados como **via NanoGPT**.

### Acciones de la cuenta

Haz clic en **⋯** en la fila de una cuenta:

| Acción | Qué hace |
| --- | --- |
| **Edit account** (Editar cuenta) | Abre sus ajustes, incluidos **Name** (Nombre), **Address** (Dirección), **API key** (clave de API) y **Use this account** (Usar esta cuenta). |
| **Replace key** (Reemplazar clave) | Pega una clave nueva. Si la clave antigua está en otras cuentas, Marinara pregunta si también quieres actualizarlas. |
| **Test** (Probar) | Comprueba la clave y muestra el resultado. |
| **Add model** (Añadir modelo) | Abre la lista de modelos de la cuenta. **Add image model** (Añadir modelo de imagen) aparece con los servicios que también crean imágenes. |
| **Select models** (Seleccionar modelos) | Te permite mover o borrar varios modelos a la vez. |
| **Duplicate** (Duplicar) | Añade una copia de la cuenta con copias de sus modelos. |
| **Turn off** (Desactivar) / **Turn on** (Activar) | Hace que Marinara deje de usar la cuenta o vuelva a usarla. |
| **Delete account** (Borrar cuenta) | Consulta más abajo. |

Para borrar una cuenta, haz clic en **Delete account**. Marinara te pide que confirmes y enumera lo que usa sus modelos en **Used by** (Lo usa): chats, agentes, modelos y tareas. Haz clic en **Delete with its N models** (Borrar con sus N modelos) para quitar la cuenta y sus modelos. Después, esos chats y esas tareas necesitan otro modelo. Si un modelo no se puede quitar, el editor lo enumera en **This account still has models. Remove these first:** (Esta cuenta todavía tiene modelos. Quita estos primero:). Abre cada uno y quítalo.

En **Edit account**, **Test account** (Probar cuenta) comprueba la clave, **Usage and balance** (Uso y saldo) muestra el uso del plan y **More options** (Más opciones) tiene **Requests per minute** (Solicitudes por minuto) y **Parallel requests** (Solicitudes en paralelo).

### Iconos de proveedor

Cada cuenta muestra el icono de su servicio. Los iconos vienen con Marinara y nunca se cargan desde internet. Una dirección personalizada muestra el icono de un servidor o una pasarela conocidos cuando su dirección o su nombre contiene uno, por ejemplo Ollama, LM Studio, KoboldCpp, Bifrost o LiteLLM. Si no, muestra la primera letra de su nombre. Para elegir el tuyo, haz clic en la imagen de una cuenta y luego elige el logotipo de un servicio, sube una imagen o usa letras.

## Modelos con estrella

Una estrella marca los modelos que quieres encontrar rápido. Los modelos con estrella aparecen en **Starred** (Con estrella), cerca de la parte superior de cada selector de modelos: las ventanas **Model for** (Modelo para) del cuadro **Jobs**, **Model for this chat** (Modelo para este chat) y los campos de modelo de **Chat Settings** (Ajustes del chat) y del editor de agentes.

Para marcar un modelo con estrella, haz clic en su estrella en la lista **Add model** de la cuenta, o elige **Star** (Marcar con estrella) en el menú **⋯** del modelo. Darle una tarea a un modelo también lo guarda.

Para quitarle la estrella a un modelo, haz clic de nuevo en su estrella. Marinara quita el modelo y muestra **Undo** (Deshacer) durante unos segundos. El modelo se queda, sin su estrella, cuando un chat lo usa, tiene un papel en **Jobs**, tiene sus propios ajustes o es el último modelo de su cuenta. El mensaje indica el motivo.

## Acciones del modelo

Haz clic en **⋯** en una fila de modelo:

| Acción | Qué hace |
| --- | --- |
| **Make default for…** (Hacer predeterminado para…) | Le da una tarea al modelo, igual que elegirlo en el cuadro **Jobs**. |
| **Edit model** (Editar modelo) | Abre sus ajustes. Hacer clic en la fila del modelo hace lo mismo. |
| **Move to account…** (Mover a la cuenta…) | Mueve el modelo a otra cuenta. Después usa la clave de esa cuenta. |
| **Folder** (Carpeta) | Pone el modelo en una carpeta. |
| **Duplicate** | Hace una copia completa con los mismos ajustes. |
| **Add to Shuffle** (Añadir a Shuffle) / **Remove from Shuffle** (Quitar de Shuffle) | Consulta [Shuffle](#shuffle). |
| **Change picture** (Cambiar imagen) | Abre las opciones de imagen. |
| **Remove** (Quitar) | Borra el modelo después de que confirmes. La confirmación enumera lo que lo usa. |

Cuando mueves un modelo, su nombre, su imagen, sus tareas y sus chats se mueven con él, y las opciones del servicio se restablecen.

En una computadora, puedes arrastrar una fila de modelo sobre un chat para usar ese modelo en el chat.

<a id="folders"></a>

## Carpetas

Las carpetas agrupan tus modelos, por ejemplo **RP** y **Work**. Elige **Group by folder** en **More actions** para mostrarlas. Un modelo está en una sola carpeta.

1. Haz clic en **⋯** en un modelo y elige **Folder**.
2. Elige una carpeta, o haz clic en **New folder…** (Nueva carpeta…), escribe un nombre y haz clic en **Create** (Crear).

Una carpeta puede tener un icono y un color. Para cambiar el nombre de una carpeta o borrarla, abre su menú **⋯**. Borrar una carpeta conserva sus modelos, en **Not in a folder** (Sin carpeta).

## Shuffle

Shuffle permite que un chat elija un modelo distinto cada vez que escribe una respuesta. Úsalo para repartir las solicitudes entre varios servicios o modelos.

1. Haz clic en **⋯** en cada modelo que quieras en el grupo y elige **Add to Shuffle**.
2. En un chat, abre **Model for this chat** desde la entrada del chat, o **Chat Settings → Connection → Model** (Ajustes del chat → Conexión → Modelo), y elige **Shuffle** (Aleatorio).

Entonces cada respuesta elige un modelo al azar de tu grupo de Shuffle.

Si el modelo que eligió una respuesta falla y **Main** tiene un modelo **If it fails** (Si falla), ese modelo escribe la respuesta en su lugar. Un aviso nombra el modelo que falló y un motivo breve, como "key rejected", "rate limited" o "not found". La respuesta conserva una pequeña etiqueta **Fallback** (Respaldo). Tócala, o pasa el puntero sobre ella, para volver a ver esa misma línea.

Una elección en **Model for this chat** cambia solo ese chat. Para cambiar el modelo de los chats nuevos, establece **Main** en el cuadro **Jobs**.

<a id="export-and-import"></a>

## Exportar e importar

Puedes exportar cuentas a un archivo para hacer una copia de seguridad o pasarlas a otra instalación, y luego importarlas más tarde.

> **Advertencia:** Las exportaciones nunca incluyen las API keys. Después de importar, abre cada cuenta y vuelve a escribir su clave. Nunca compartas una clave con nadie.

- **Exportar un modelo:** ábrelo con **Edit model** y haz clic en **Export model** (Exportar modelo).
- **Exportarlo todo:** abre **More actions** y elige **Export all accounts**. Marinara te recuerda que el archivo no contiene claves. Haz clic en **Export** (Exportar).
- **Importar:** abre **More actions** y elige **Import account**. Suelta uno o más archivos (`.json`, `.jsonl` o `.zip`) sobre la ventana, o haz clic para buscarlos. Esto incluye el `marinara-connections.zip` que exportaste. Cada cuenta importada tiene una clave vacía hasta que la rellenas.

Un solo modelo se descarga como un archivo `.connection.json`. Varios se descargan juntos como `marinara-connections.zip`. Las estrellas se incluyen. El catálogo de modelos del servicio no, así que se vuelve a cargar la primera vez que abres los modelos de la cuenta.

## Guías relacionadas

- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
- [Resumen de Chat Settings](../chats/chat-settings.md)
