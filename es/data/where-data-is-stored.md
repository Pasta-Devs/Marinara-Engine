# Dónde guarda Marinara tus datos

Encuentra la carpeta donde Marinara Engine guarda tus datos y sabe qué partes conservar cuando los mudas o los copias.

Marinara se ejecuta en tu propia computadora y guarda allí tus personajes, chats y ajustes. Cuando generas una respuesta, Marinara sigue enviando el contenido de tu chat al servicio de IA que conectaste.

## Encontrar la carpeta de datos

Todo lo que creas vive en una sola carpeta de la computadora que ejecuta el servidor. Esta es la carpeta de datos. Su ajuste es `DATA_DIR`, un valor que le das al servidor antes de que arranque (una variable de entorno). No está en **Settings** (Configuración).

- De forma predeterminada es una carpeta llamada `data` junto a los archivos del servidor.
- En el contenedor oficial de Docker es `/app/data`.
- Para ver la ruta exacta, mira la ventana donde iniciaste Marinara (la terminal o la consola). Al arrancar, imprime una línea que empieza con `[storage] DATA_DIR=` seguida de la ruta. Si no encuentras esa ventana, busca una carpeta llamada `data` dentro de la carpeta de Marinara.

Para mover la carpeta, define `DATA_DIR` y reinicia Marinara. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).

## Qué hay dentro

Tus datos de texto están en la carpeta `storage`: personajes, chats, mensajes, lorebooks, presets y conexiones. Marinara los guarda como muchos archivos pequeños. Después de una actualización desde el formato anterior, puede que veas copias antiguas en `storage/tables/` con nombres que terminan en `.pre-shard`. Marinara nunca las borra. Puedes borrarlas tú para liberar espacio cuando todo funcione.

Tus imágenes, audio y otros archivos están en sus propias carpetas junto a `storage`. Los nombres de las carpetas son:

| Carpeta | Qué contiene |
| --- | --- |
| `avatars` | Avatares de personajes y personas |
| `sprites` | Arte de sprites de personajes |
| `avatar-models` | Archivos de los agentes **2D Avatars** y **3D Avatars**, como imágenes PNGTuber y modelos 3D |
| `backgrounds` | Fondos de chat que subiste |
| `gallery` | Imágenes de la galería |
| `fonts` | Fuentes personalizadas que agregaste |
| `knowledge-sources` | Archivos que subiste para los agentes de conocimiento |
| `game-assets` | Recursos de Game Mode |
| `game-scene-videos` | Videos de escenas de Game Mode |
| `conversation-call-character-videos` | Videos de personajes para las llamadas de Conversation |
| `custom-emojis` | Imágenes de emoji personalizados |
| `custom-stickers` | Imágenes de stickers personalizados |
| `notification-sounds` | Tu sonido de notificación personalizado |
| `long-term-memory` | Datos del agente de memoria a largo plazo |
| `lorebooks/images`, `prompts/images`, `agents/images`, `connections/images` | Imágenes adjuntas a lorebooks, presets, agentes y cuentas |

La carpeta de datos también contiene `backups/` (tus [copias de seguridad automáticas](backup-and-restore.md#automatic-backups)) y el archivo de la clave de cifrado. **Download Backup** incluye todas las carpetas de la tabla, `storage` y el archivo de la clave. Los desarrolladores pueden leer [Almacenamiento basado en archivos](../development/file-storage.md).

## Conserva el archivo de la clave de cifrado

Marinara cifra tus API keys (claves de API) guardadas. La clave para esto es el archivo `.encryption-key` de la carpeta de datos.

Si copias tus datos a una computadora nueva sin este archivo, Marinara no puede leer tus API keys guardadas. Tendrás que escribirlas de nuevo. Cópialo junto con el resto de la carpeta de datos.

Algunas configuraciones dan la clave mediante la variable de entorno `ENCRYPTION_KEY`. Entonces no hay ningún archivo que copiar. Guarda ese valor a salvo por separado. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).

## Copiar tus datos desde Android

En Android, la carpeta de datos está en el almacenamiento de la app, al que no puedes acceder sin acceso root, así que no puedes copiarla. Usa **Settings → Advanced → Backup & Export → Download Backup**. El `.zip` incluye el archivo `.encryption-key` cuando existe. Consulta [Copia de seguridad y restauración de Marinara](backup-and-restore.md).

Las copias de seguridad automáticas se guardan en el mismo almacenamiento de la app. Desinstalar o restablecer la app puede eliminarlas junto con los datos activos, así que guarda una copia en otro lugar.

## Guías relacionadas

- [Copia de seguridad y restauración de Marinara](backup-and-restore.md)
- [Borrar o restablecer tus datos](clearing-data.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
- [Almacenamiento basado en archivos](../development/file-storage.md)
