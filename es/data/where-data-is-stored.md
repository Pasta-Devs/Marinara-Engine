# Dónde guarda Marinara tus datos

Esta guía explica dónde guarda Marinara Engine tus datos en tu propia computadora. Cubre la carpeta principal de datos, las carpetas `storage` y de recursos que hay dentro, y el archivo de la clave de cifrado que protege tus API key (claves de API) guardadas.

Marinara Engine (llamado "Marinara" a partir de aquí) se ejecuta en tu propia máquina. Marinara guarda tus personajes, chats y ajustes solo en tu propia computadora. Ten en cuenta que, cuando generas una respuesta, Marinara sí envía el contenido de tu chat al proveedor de IA al que te conectaste.

## La carpeta de datos (DATA_DIR)

Todo lo que creas en Marinara vive dentro de una sola carpeta en la máquina que ejecuta el servidor. Esa carpeta se llama la carpeta de datos. La variable de entorno que apunta a ella se llama `DATA_DIR`. Una variable de entorno es un valor que defines en el servidor, fuera de la app. No la encontrarás dentro del panel **Settings** (Configuración) de la app.

De forma predeterminada, la carpeta de datos es una carpeta llamada `data` que Marinara crea junto a sus archivos de servidor. Si ejecutas Marinara en un contenedor oficial de Docker, la carpeta de datos es `/app/data` dentro del contenedor.

Si no estás seguro de dónde está la carpeta de datos, revisa el registro de inicio del servidor. Cuando Marinara arranca, imprime una línea que empieza por `[storage] DATA_DIR=` seguida de la ruta completa a tu carpeta de datos.

Puedes mover la carpeta de datos a otra ubicación definiendo tú mismo `DATA_DIR`. Para saber cómo definirla, consulta la [Referencia de configuración del servidor](../CONFIGURATION.md). Marinara debe reiniciarse para que un nuevo valor de `DATA_DIR` surta efecto.

## La carpeta storage y las carpetas de recursos

Dentro de la carpeta de datos, tus datos se reparten entre una carpeta `storage` y varias carpetas de recursos.

La carpeta `storage` contiene tus datos de texto: personajes, chats, mensajes, lorebooks, presets y conexiones. Marinara guarda cada tabla en archivos más pequeños agrupados por propietario —por ejemplo, los mensajes de un chat o las entradas de un lorebook— para que cambiar un elemento no vuelva a escribir un archivo JSON global cada vez mayor. Durante la actualización única desde un almacenamiento anterior, Marinara conserva los archivos de tabla originales junto a las carpetas nuevas con el sufijo `.pre-shard`.

Tus imágenes, audio y otros archivos multimedia viven en sus propias carpetas, cada una nombrada según lo que contiene. Las carpetas de recursos principales son:

| Carpeta | Qué contiene |
| --- | --- |
| `avatars` | Avatares de personaje y de persona |
| `sprites` | Arte de sprite del personaje |
| `backgrounds` | Fondos de chat que subiste |
| `gallery` | Imágenes de la galería |
| `fonts` | Fuentes personalizadas que añadiste |
| `knowledge-sources` | Archivos que subiste para agentes de conocimiento |
| `game-assets` | Recursos de Game Mode |
| `custom-emojis` | Imágenes de emoji personalizadas |
| `custom-stickers` | Imágenes de sticker personalizadas |

Para una explicación técnica más profunda de cómo funciona la carpeta `storage`, los desarrolladores pueden leer [Almacenamiento nativo en archivos](../development/file-storage.md).

## El archivo de la clave de cifrado

Marinara cifra tus API key guardadas para que no se almacenen como texto plano. La clave usada para este cifrado se guarda en un archivo llamado `.encryption-key` dentro de tu carpeta de datos.

Este archivo importa cuando mueves o restauras tus datos. Supón que copias tu carpeta de datos a una máquina nueva pero dejas atrás el archivo `.encryption-key`. Marinara ya no puede descifrar tus API key guardadas, así que tienes que volver a introducirlas. Mantén siempre este archivo junto con el resto de tus datos.

Algunas configuraciones avanzadas proporcionan la clave a través de una variable de entorno `ENCRYPTION_KEY` en lugar del archivo. Si usas esa variable, mantén el valor a salvo por su cuenta. En ese caso no hay ningún archivo `.encryption-key` que copiar. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md) para más detalles.

## Dónde están mis datos en Android

En Android, la carpeta de datos del servidor suele estar en un almacenamiento de la app que no puedes alcanzar sin acceso root. Esto significa que no puedes simplemente copiar la carpeta fuera del teléfono.

Para obtener una copia de tus datos en Android, usa el botón **Download Backup** (Descargar copia de seguridad). Lo encuentras en **Settings**, en la pestaña **Advanced**, en la sección **Backup & Export**. Esto crea un único archivo zip con tus datos. El zip incluye el archivo `.encryption-key` cuando existe uno. Esta es la forma más fiable de guardar tus datos desde un teléfono.

La misma sección puede conservar de 1 a 9999 archivos automáticos rotativos diarios, semanales o mensuales en `backups/`, dentro
de la carpeta de datos. El más reciente se llama `marinara-automatic-backup.zip` y los archivos automáticos anteriores que se
conservan llevan una marca de tiempo. Este límite se aplica únicamente a las copias de seguridad automáticas. Copia las copias
de seguridad importantes también en algún lugar fuera del almacenamiento de la app, porque desinstalar o restablecer la app
puede eliminar tanto los datos activos como sus copias de seguridad automáticas locales.

Para los pasos completos de copia de seguridad y restauración en cada plataforma, consulta [Copia de seguridad y restauración de Marinara](backup-and-restore.md).

## Guías relacionadas

- [Copia de seguridad y restauración de Marinara](backup-and-restore.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
- [Almacenamiento nativo en archivos](../development/file-storage.md)
