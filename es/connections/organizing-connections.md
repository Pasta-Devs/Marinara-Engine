# Organizar las conexiones

Esta guía explica cómo mantener ordenadas tus cuentas y tus modelos en Marinara Engine. Cubre la lista de cuentas, los modelos con estrella, cómo mover y quitar modelos, las carpetas, Shuffle y cómo exportar o importar. Una cuenta es una clave, un inicio de sesión o una dirección de un proveedor de IA; un modelo es un modelo de IA que guardaste desde ella. Para añadir una cuenta, consulta [Conectarse a un proveedor de IA](connecting-to-a-provider.md).

## La lista de cuentas

Debajo del cuadro **Jobs** (Tareas), el panel **Connections** (Conexiones) enumera tus cuentas. Cada cuenta muestra su imagen, su nombre, cuántos modelos tiene y su dirección. Una fila de modelo muestra la imagen del modelo, su nombre e insignias como la tarea que hace —**Main** (Principal), **Agents** (Agentes), **Images** (Imágenes)—, **Custom settings** (Ajustes personalizados), su precio o **Plan** para los modelos incluidos en una suscripción.

Haz clic en la fila de una cuenta para plegar sus modelos, y haz clic de nuevo para mostrarlos. Marinara recuerda qué cuentas plegaste. **More actions** (Más acciones), en la parte superior del panel, tiene **Fold all accounts** (Plegar todas las cuentas) y **Open all accounts** (Abrir todas las cuentas), **Show only Off or Needs key** (Mostrar solo las cuentas desactivadas o sin clave) y **Show cost badges** (Mostrar insignias de costo). En un panel ancho, el menú desplegable de orden está junto a **Search models and accounts** (Buscar modelos y cuentas). En un panel estrecho, el orden está en **More actions**.

Una cuenta de pasarela que llega a varios creadores de modelos, por ejemplo un proxy o LinkAPI, agrupa sus modelos bajo encabezados **via**, como **via NanoGPT**, con el icono de ese creador.

La tarjeta **Built-in model** (Modelo integrado), debajo del cuadro Jobs, muestra el modelo que se ejecuta en tu computadora y su estado. Consulta [Configuración del modelo local](local-model.md).

### Acciones de la cuenta

Haz clic en **⋯** en la fila de una cuenta:

- **Edit account** (Editar cuenta) abre sus ajustes: **Name** (Nombre), **API key** (clave de API), **Address** (Dirección), **Usage and limits** (Uso y límites) y **Use this account** (Usar esta cuenta).
- **Replace key** (Reemplazar clave) pega una clave nueva.
- **Test** (Probar) comprueba la clave y muestra el resultado.
- **Add model** (Añadir modelo) abre la lista de modelos de la cuenta. **Add image model** (Añadir modelo de imagen) aparece con los proveedores que también crean imágenes.
- **Select models** (Seleccionar modelos) te permite mover o borrar varios modelos a la vez.
- **Duplicate** (Duplicar) añade una copia de la cuenta con copias de sus modelos.
- **Turn off** (Desactivar) hace que Marinara deje de usar la cuenta hasta que vuelvas a usar **Turn on** (Activar).
- **Delete account** (Borrar cuenta). Antes, Marinara enumera las tareas, los chats y los agentes que todavía usan sus modelos.

### Iconos de proveedor

Cada cuenta muestra el icono de su proveedor. Los iconos vienen con Marinara, así que Marinara nunca los carga desde internet. Una dirección personalizada muestra el icono de un servidor o una pasarela conocidos cuando su dirección o su nombre contiene uno, por ejemplo Ollama, LM Studio, KoboldCpp, Bifrost o LiteLLM. Si no, muestra la primera letra de su nombre. Haz clic en la imagen de una cuenta para elegir la tuya.

## Modelos con estrella

Una estrella marca los modelos que quieres tener a mano. Los modelos con estrella aparecen en **Starred** (Con estrella), cerca de la parte superior de cada selector de modelos: las ventanas **Model for** (Modelo para) del cuadro **Jobs**, la ventana **Model for this chat** (Modelo para este chat) del chat y los campos de modelo de **Chat Settings** (Ajustes del chat) y del editor de agentes.

Para marcar un modelo con estrella, haz clic en su estrella en la lista **Add model** de la cuenta, o elige **Star** (Marcar con estrella) en el menú **⋯** del modelo. Darle una tarea a un modelo también lo guarda.

Para quitarle la estrella a un modelo, haz clic de nuevo en su estrella. Marinara quita el modelo y muestra **Undo** (Deshacer) durante unos segundos. Un modelo se queda, sin su estrella, cuando todavía tiene un papel en **Jobs**, tiene sus propios ajustes o es el último modelo de su cuenta. El mensaje indica el motivo.

## Acciones del modelo

Haz clic en **⋯** en una fila de modelo:

- **Make default for…** (Hacer predeterminado para…) le da una tarea al modelo, igual que elegirlo en el cuadro **Jobs**.
- **Edit model** (Editar modelo) abre sus ajustes. Hacer clic en la fila del modelo hace lo mismo.
- **Move to account…** (Mover a la cuenta…) mueve el modelo a otra cuenta del mismo proveedor, o a una cuenta nueva. Después, el modelo usa la clave y el catálogo de esa cuenta. Los chats que usan el modelo siguen funcionando.
- **Folder** (Carpeta) pone el modelo en una carpeta. Las carpetas aparecen cuando eliges **Group by folder** (Agrupar por carpeta) en **More actions**.
- **Duplicate** hace una copia completa con los mismos ajustes, sin preguntar.
- **Add to Shuffle** (Añadir a Shuffle) o **Remove from Shuffle** (Quitar de Shuffle).
- **Change picture** (Cambiar imagen).
- **Remove** (Quitar) borra el modelo después de que confirmes.

En una computadora, puedes arrastrar una fila de modelo sobre un chat para usar ese modelo en el chat.

## Búsqueda

**Search models and accounts**, en la parte superior del panel, filtra la lista a medida que escribes. Cuando no hay coincidencias, el panel lo indica.

## Shuffle

Shuffle permite que un chat elija un modelo distinto cada vez que escribe una respuesta. Esto es útil cuando quieres repartir las peticiones entre varios proveedores o modelos.

Para añadir un modelo a Shuffle, elige **Add to Shuffle** en su menú **⋯**. Para que un chat use Shuffle, abre **Model for this chat** desde el área de entrada del chat o **Chat Settings → Connection → Model** (Ajustes del chat → Conexión → Modelo) y elige **Shuffle** (Aleatorio). Cada respuesta elige entonces un modelo al azar de tu Shuffle.

Si el modelo que eligió una respuesta falla y **Main** tiene un modelo **If it fails** (Si falla), ese modelo escribe la respuesta en su lugar. Un aviso nombra el modelo que falló y un motivo breve, como "key rejected", "rate limited" o "not found", para que sepas cuál necesita arreglo. La respuesta conserva una pequeña etiqueta **Fallback** (Respaldo); tócala, o pasa el puntero sobre ella, para volver a ver esa misma línea.

Una elección en **Model for this chat** cambia solo ese chat. Para cambiar el modelo de los chats nuevos, establece **Main** en el cuadro **Jobs**.

## Exportar e importar

Puedes exportar cuentas a un archivo para hacer una copia de seguridad o pasarlas a otra instalación, y luego importarlas más tarde.

**Tus API keys nunca se incluyen en una exportación.** Después de importar, abre cada cuenta y vuelve a escribir su clave. Las estrellas sí se incluyen; el catálogo del proveedor no, así que se vuelve a cargar la primera vez que abres los modelos de la cuenta.

Para exportar un solo modelo, ábrelo con **Edit model** y haz clic en su botón **Export** (Exportar), el icono de subir. Para exportarlo todo, abre **More actions** y elige **Export all accounts** (Exportar todas las cuentas). Marinara te recuerda que el archivo no contiene claves antes de que empiece la descarga.

Un solo modelo se descarga como un archivo `.connection.json`. Varios se descargan juntos como un archivo `marinara-connections.zip`.

Para importar, abre **More actions** y elige **Import account** (Importar cuenta). Suelta uno o más archivos `.json` sobre la ventana, o haz clic para buscarlos. Cada cuenta importada tiene una clave vacía hasta que la rellenas.

## Guías relacionadas

- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
- [Resumen de Chat Settings](../chats/chat-settings.md)
